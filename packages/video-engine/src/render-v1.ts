import { spawn } from "node:child_process";
import { constants } from "node:fs";
import { access, appendFile, mkdir, stat, writeFile } from "node:fs/promises";
import { basename, relative } from "node:path";
import {
  generateAssSubtitle,
  generateSrt,
  getCaptionStyleById
} from "@reelforge/caption-engine";
import type { RenderBlueprint, RenderBlueprintScene } from "./index.js";
import { finalizeRenderAudio } from "./audio-mix.js";
import {
  createRenderJobPaths,
  resolveStoragePath,
  toForwardSlashes,
  toRelativeStoragePath
} from "./render-paths.js";

export const renderPipelineSteps = [
  "reading_blueprint",
  "generating_subtitles",
  "rendering_scene",
  "concatenating_segments",
  "burning_subtitles",
  "preparing_audio",
  "mixing_audio",
  "probing_audio",
  "generating_thumbnail",
  "probing_output",
  "completed"
] as const;

export type RenderPipelineStep = (typeof renderPipelineSteps)[number];

export interface FfmpegAvailability {
  available: boolean;
  versionOutput: string;
  errorMessage: string | null;
}

export interface RenderBlueprintV1Options {
  blueprint: RenderBlueprint;
  projectRoot: string;
  rendersStorageRoot: string;
  videoProjectId: string;
  renderJobId: string;
  onStep?: (step: RenderPipelineStep) => Promise<void> | void;
  onScene?: (
    sceneIndex: number,
    totalScenes: number,
    scene: RenderBlueprintScene
  ) => Promise<void> | void;
  onProgress?: (progress: number) => Promise<void> | void;
  shouldCancel?: () => Promise<boolean> | boolean;
}

export interface RenderArtifacts {
  outputPath: string;
  srtPath: string;
  assPath: string;
  logPath: string;
}

interface CommandResult {
  stdout: string;
  stderr: string;
}

interface LogContext {
  jobId: string;
  projectId: string;
  label?: string;
}

class CommandExecutionError extends Error {
  readonly command: string;
  readonly args: string[];
  readonly code: number | null;
  readonly stdout: string;
  readonly stderr: string;

  constructor(options: {
    command: string;
    args: string[];
    code: number | null;
    stdout: string;
    stderr: string;
  }) {
    const stderrTail = options.stderr.trim().split(/\r?\n/u).slice(-6).join(" | ");
    const stdoutTail = options.stdout.trim().split(/\r?\n/u).slice(-3).join(" | ");
    const outputTail = stderrTail || stdoutTail || "No stdout/stderr output captured.";

    super(
      `Command '${options.command}' failed with code ${options.code ?? "unknown"}. ${outputTail}`
    );

    this.name = "CommandExecutionError";
    this.command = options.command;
    this.args = [...options.args];
    this.code = options.code;
    this.stdout = options.stdout;
    this.stderr = options.stderr;
  }
}

export class RenderCancellationError extends Error {
  readonly step: RenderPipelineStep;
  readonly sceneIndex: number | null;

  constructor(step: RenderPipelineStep, sceneIndex: number | null = null) {
    super("Render cancelled by user");
    this.name = "RenderCancellationError";
    this.step = step;
    this.sceneIndex = sceneIndex;
  }
}

function quoteArgForLog(value: string) {
  return /[\s"]/u.test(value)
    ? `"${value.replaceAll('"', '\\"')}"`
    : value;
}

function formatCommandForLog(command: string, args: string[]) {
  return [command, ...args.map(quoteArgForLog)].join(" ");
}

function buildLogPrefix(context: LogContext) {
  const parts = [
    `[${new Date().toISOString()}]`,
    `[job:${context.jobId}]`,
    `[project:${context.projectId}]`
  ];

  if (context.label) {
    parts.push(`[${context.label}]`);
  }

  return parts.join("");
}

function formatLogChunk(text: string, context: LogContext, source: "stdout" | "stderr") {
  if (!text) {
    return "";
  }

  const normalized = text.replace(/\r\n/g, "\n");
  const trailingNewline = normalized.endsWith("\n");
  const lines = normalized.split("\n");

  if (trailingNewline) {
    lines.pop();
  }

  const formatted = lines
    .filter((line) => line.length > 0)
    .map((line) => `${buildLogPrefix(context)}[${source}] ${line}`)
    .join("\n");

  return formatted.length > 0 ? `${formatted}\n` : "";
}

async function appendLog(logPath: string, context: LogContext, message: string) {
  await appendFile(logPath, `${buildLogPrefix(context)} ${message}\n`, "utf8");
}

async function runCommand(
  command: string,
  args: string[],
  cwd: string,
  logPath: string,
  context: LogContext
): Promise<CommandResult> {
  await appendLog(logPath, context, `$ ${formatCommandForLog(command, args)}`);

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      shell: false,
      windowsHide: true
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      const text = chunk.toString();
      stdout += text;
      void appendFile(logPath, formatLogChunk(text, context, "stdout"), "utf8");
    });

    child.stderr.on("data", (chunk) => {
      const text = chunk.toString();
      stderr += text;
      void appendFile(logPath, formatLogChunk(text, context, "stderr"), "utf8");
    });

    child.on("error", (error) => {
      reject(error);
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }

      reject(
        new CommandExecutionError({
          command,
          args,
          code,
          stdout,
          stderr
        })
      );
    });
  });
}

async function fileExists(absolutePath: string) {
  try {
    await access(absolutePath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function getSceneDuration(scene: RenderBlueprintScene) {
  if (typeof scene.duration === "number" && scene.duration > 0) {
    return Math.max(scene.duration, 0.5);
  }

  return 4;
}

function buildVisualFilter(scene: RenderBlueprintScene) {
  const filters = [
    "scale=1080:1920:force_original_aspect_ratio=increase",
    "crop=1080:1920",
    "setsar=1"
  ];

  if (
    scene.visualPreset.preset.id === "horror" ||
    scene.visualPreset.preset.id === "mystery" ||
    scene.visualPreset.preset.id === "suspense"
  ) {
    filters.push("eq=brightness=-0.04:saturation=0.82");
    filters.push("vignette=PI/6");
  }

  filters.push("fps=30");
  filters.push("format=yuv420p");

  return filters.join(",");
}

function buildPlaceholderFilter(scene: RenderBlueprintScene) {
  const filters = ["format=yuv420p"];

  if (
    scene.visualPreset.preset.id === "horror" ||
    scene.visualPreset.preset.id === "mystery" ||
    scene.visualPreset.preset.id === "suspense"
  ) {
    filters.unshift("eq=brightness=-0.08:saturation=0.75");
    filters.push("vignette=PI/6");
  }

  return filters.join(",");
}

function createSegmentFilename(order: number) {
  return `segment-${String(order).padStart(3, "0")}.mp4`;
}

function toJobRelativePath(jobRoot: string, absolutePath: string) {
  return toForwardSlashes(relative(jobRoot, absolutePath));
}

async function writeSubtitleArtifacts(
  blueprint: RenderBlueprint,
  srtPath: string,
  assPath: string
) {
  const defaultStyle =
    getCaptionStyleById(blueprint.defaultCaptionStyle.id) ??
    getCaptionStyleById("premium_yellow");

  if (!defaultStyle) {
    throw new Error("No default caption style is available for subtitle export.");
  }

  const subtitleScenes = blueprint.scenes.map((scene) => ({
    order: scene.order,
    captionText: scene.captionText ?? scene.narrationText,
    duration: getSceneDuration(scene),
    captionStyle: scene.captionStyle.style.id
  }));

  const srt = generateSrt({
    title: blueprint.title,
    scenes: subtitleScenes
  });
  const ass = generateAssSubtitle(
    {
      title: blueprint.title,
      scenes: subtitleScenes
    },
    defaultStyle
  );

  await writeFile(srtPath, srt, "utf8");
  await writeFile(assPath, ass, "utf8");
}

async function renderImageSegment(
  inputPath: string,
  outputPath: string,
  duration: number,
  filter: string,
  jobRoot: string,
  logPath: string,
  context: LogContext
) {
  const args = [
    "-y",
    "-loop",
    "1",
    "-i",
    inputPath,
    "-t",
    duration.toFixed(3),
    "-vf",
    filter,
    "-r",
    "30",
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "22",
    "-pix_fmt",
    "yuv420p",
    "-an",
    outputPath
  ];

  await runCommand("ffmpeg", args, jobRoot, logPath, context);
}

async function renderVideoSegment(
  inputPath: string,
  outputPath: string,
  duration: number,
  filter: string,
  jobRoot: string,
  logPath: string,
  context: LogContext
) {
  const args = [
    "-y",
    "-stream_loop",
    "-1",
    "-i",
    inputPath,
    "-t",
    duration.toFixed(3),
    "-vf",
    filter,
    "-r",
    "30",
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "22",
    "-pix_fmt",
    "yuv420p",
    "-an",
    outputPath
  ];

  await runCommand("ffmpeg", args, jobRoot, logPath, context);
}

async function renderPlaceholderSegment(
  outputPath: string,
  duration: number,
  filter: string,
  jobRoot: string,
  logPath: string,
  context: LogContext
) {
  const args = [
    "-y",
    "-f",
    "lavfi",
    "-i",
    `color=c=#10131a:s=1080x1920:d=${duration.toFixed(3)}`,
    "-vf",
    filter,
    "-r",
    "30",
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "22",
    "-pix_fmt",
    "yuv420p",
    "-an",
    outputPath
  ];

  await runCommand("ffmpeg", args, jobRoot, logPath, context);
}

async function renderSceneSegment(
  scene: RenderBlueprintScene,
  projectRoot: string,
  jobRoot: string,
  workDir: string,
  logPath: string,
  baseContext: LogContext
) {
  const duration = getSceneDuration(scene);
  const outputPath = `${workDir}/${createSegmentFilename(scene.order)}`;
  const visualFilter = buildVisualFilter(scene);
  const placeholderFilter = buildPlaceholderFilter(scene);
  const declaredAssetPath = scene.asset?.path ?? null;
  const context = {
    ...baseContext,
    label: `scene:${scene.order}`
  };

  await appendLog(
    logPath,
    context,
    `Scene '${scene.title}' starting. Asset path: ${declaredAssetPath ?? "none"}. Blueprint preset: ${scene.visualPreset.preset.id}.`
  );

  try {
    if (!scene.asset) {
      await appendLog(
        logPath,
        context,
        "No asset linked, using placeholder background."
      );
      await renderPlaceholderSegment(
        outputPath,
        duration,
        placeholderFilter,
        jobRoot,
        logPath,
        context
      );
      return outputPath;
    }

    let absoluteInputPath: string;

    try {
      absoluteInputPath = resolveStoragePath(projectRoot, scene.asset.path);
    } catch {
      await appendLog(
        logPath,
        context,
        `Asset path '${scene.asset.path}' escaped storage root, using placeholder.`
      );
      await renderPlaceholderSegment(
        outputPath,
        duration,
        placeholderFilter,
        jobRoot,
        logPath,
        context
      );
      return outputPath;
    }

    if (!(await fileExists(absoluteInputPath))) {
      await appendLog(
        logPath,
        context,
        `Asset file '${absoluteInputPath}' not found, using placeholder.`
      );
      await renderPlaceholderSegment(
        outputPath,
        duration,
        placeholderFilter,
        jobRoot,
        logPath,
        context
      );
      return outputPath;
    }

    await appendLog(
      logPath,
      context,
      `Resolved asset absolute path '${absoluteInputPath}'.`
    );

    if (scene.asset.type === "IMAGE" || scene.asset.type === "OVERLAY") {
      await appendLog(
        logPath,
        context,
        "Rendering image asset with stable scale/crop. Advanced motion remains planned."
      );
      await renderImageSegment(
        absoluteInputPath,
        outputPath,
        duration,
        visualFilter,
        jobRoot,
        logPath,
        context
      );
      return outputPath;
    }

    if (scene.asset.type === "VIDEO") {
      await appendLog(
        logPath,
        context,
        "Rendering video asset with loop/cut normalization and stable framing."
      );
      await renderVideoSegment(
        absoluteInputPath,
        outputPath,
        duration,
        visualFilter,
        jobRoot,
        logPath,
        context
      );
      return outputPath;
    }

    await appendLog(
      logPath,
      context,
      `Asset type '${scene.asset.type}' is not supported in Render V1, using placeholder.`
    );
    await renderPlaceholderSegment(
      outputPath,
      duration,
      placeholderFilter,
      jobRoot,
      logPath,
      context
    );
    return outputPath;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown scene render error.";
    await appendLog(
      logPath,
      context,
      `Scene failed. Asset path used: ${declaredAssetPath ?? "none"}. ${message}`
    );
    throw new Error(
      `Scene ${scene.order} '${scene.title}' failed using asset '${declaredAssetPath ?? "none"}': ${message}`
    );
  }
}

async function concatSegments(
  segmentPaths: string[],
  concatListPath: string,
  mergedVideoPath: string,
  jobRoot: string,
  logPath: string,
  context: LogContext
) {
  const concatFileContents = segmentPaths
    .map((segmentPath) => `file '${basename(segmentPath)}'`)
    .join("\n");

  await writeFile(concatListPath, concatFileContents, "utf8");

  const args = [
    "-y",
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    toJobRelativePath(jobRoot, concatListPath),
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "22",
    "-pix_fmt",
    "yuv420p",
    "-an",
    toJobRelativePath(jobRoot, mergedVideoPath)
  ];

  try {
    await runCommand("ffmpeg", args, jobRoot, logPath, context);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown concat error.";
    await appendLog(logPath, context, `Concat step failed. ${message}`);
    throw new Error(`Concat step failed: ${message}`);
  }
}

async function burnSubtitlesToVideoOnly(
  mergedVideoPath: string,
  assPath: string,
  outputPath: string,
  jobRoot: string,
  logPath: string,
  context: LogContext
) {
  const args = [
    "-y",
    "-i",
    toJobRelativePath(jobRoot, mergedVideoPath),
    "-vf",
    `ass=${basename(assPath)}`,
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "20",
    "-pix_fmt",
    "yuv420p",
    "-r",
    "30",
    "-movflags",
    "+faststart",
    toJobRelativePath(jobRoot, outputPath)
  ];

  try {
    await runCommand("ffmpeg", args, jobRoot, logPath, context);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown subtitle burn error.";
    await appendLog(logPath, context, `Subtitle burn step failed. ASS path: ${assPath}. ${message}`);
    throw new Error(`Subtitle burn step failed: ${message}`);
  }
}

async function emitStep(
  callback: RenderBlueprintV1Options["onStep"],
  step: RenderPipelineStep
) {
  if (!callback) {
    return;
  }

  await callback(step);
}

async function emitScene(
  callback: RenderBlueprintV1Options["onScene"],
  sceneIndex: number,
  totalScenes: number,
  scene: RenderBlueprintScene
) {
  if (!callback) {
    return;
  }

  await callback(sceneIndex, totalScenes, scene);
}

async function emitProgress(
  callback: RenderBlueprintV1Options["onProgress"],
  progress: number
) {
  if (!callback) {
    return;
  }

  await callback(progress);
}

async function throwIfCancellationRequested(
  shouldCancel: RenderBlueprintV1Options["shouldCancel"],
  step: RenderPipelineStep,
  sceneIndex: number | null = null
) {
  if (!shouldCancel) {
    return;
  }

  const cancelled = await shouldCancel();

  if (cancelled) {
    throw new RenderCancellationError(step, sceneIndex);
  }
}

export async function checkFfmpegAvailable(): Promise<FfmpegAvailability> {
  return new Promise((resolve) => {
    const child = spawn("ffmpeg", ["-version"], {
      shell: false,
      windowsHide: true
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      resolve({
        available: false,
        versionOutput: "",
        errorMessage: error.message
      });
    });

    child.on("close", (code) => {
      resolve({
        available: code === 0,
        versionOutput: `${stdout}${stderr}`.trim(),
        errorMessage:
          code === 0
            ? null
            : `ffmpeg -version exited with code ${code ?? "unknown"}.`
      });
    });
  });
}

export async function renderBlueprintV1({
  blueprint,
  projectRoot,
  rendersStorageRoot,
  videoProjectId,
  renderJobId,
  onStep,
  onScene,
  onProgress,
  shouldCancel
}: RenderBlueprintV1Options): Promise<RenderArtifacts> {
  if (blueprint.scenes.length === 0) {
    throw new Error("Render Blueprint has no scenes to render.");
  }

  const ffmpegAvailability = await checkFfmpegAvailable();

  if (!ffmpegAvailability.available) {
    throw new Error(
      `FFmpeg is unavailable. ${ffmpegAvailability.errorMessage ?? "Run 'ffmpeg -version' to verify the local installation."}`
    );
  }

  const paths = createRenderJobPaths(
    rendersStorageRoot,
    videoProjectId,
    renderJobId
  );
  const baseContext: LogContext = {
    jobId: renderJobId,
    projectId: videoProjectId
  };

  await mkdir(paths.jobRoot, { recursive: true });
  await mkdir(paths.workDir, { recursive: true });

  await emitStep(onStep, "reading_blueprint");
  await emitProgress(onProgress, 5);
  await throwIfCancellationRequested(shouldCancel, "reading_blueprint");
  await appendLog(paths.logPath, baseContext, "Render Engine V1 started.");
  await appendLog(paths.logPath, baseContext, ffmpegAvailability.versionOutput);
  await appendLog(
    paths.logPath,
    baseContext,
    `Render blueprint project '${blueprint.projectId}' with ${blueprint.sceneCount} scene(s).`
  );

  await emitStep(onStep, "generating_subtitles");
  await emitProgress(onProgress, 15);
  await throwIfCancellationRequested(shouldCancel, "generating_subtitles");
  await writeSubtitleArtifacts(blueprint, paths.srtPath, paths.assPath);
  await appendLog(
    paths.logPath,
    {
      ...baseContext,
      label: "subtitles"
    },
    "Subtitle artifacts generated from Caption Engine."
  );

  const orderedScenes = [...blueprint.scenes].sort((left, right) => left.order - right.order);
  const segmentPaths: string[] = [];
  const totalScenes = orderedScenes.length;

  await emitStep(onStep, "rendering_scene");

  for (const [index, scene] of orderedScenes.entries()) {
    const sceneIndex = index + 1;

    await throwIfCancellationRequested(
      shouldCancel,
      "rendering_scene",
      sceneIndex
    );
    await emitScene(onScene, sceneIndex, totalScenes, scene);
    segmentPaths.push(
      await renderSceneSegment(
        scene,
        projectRoot,
        paths.jobRoot,
        paths.workDir,
        paths.logPath,
        baseContext
      )
    );
    await emitProgress(
      onProgress,
      Math.min(75, 20 + Math.round((sceneIndex / totalScenes) * 50))
    );
  }

  await appendLog(
    paths.logPath,
    {
      ...baseContext,
      label: "segments"
    },
    `Generated ${segmentPaths.length} scene segments in ${paths.workDir}.`
  );

  await emitStep(onStep, "concatenating_segments");
  await emitProgress(onProgress, 80);
  await throwIfCancellationRequested(shouldCancel, "concatenating_segments");
  await concatSegments(
    segmentPaths,
    paths.concatListPath,
    paths.mergedVideoPath,
    paths.jobRoot,
    paths.logPath,
    {
      ...baseContext,
      label: "concat"
    }
  );
  await appendLog(
    paths.logPath,
    {
      ...baseContext,
      label: "concat"
    },
    "Scene segments concatenated."
  );

  const totalDuration = orderedScenes.reduce(
    (sum, scene) => sum + getSceneDuration(scene),
    0
  );

  await emitStep(onStep, "burning_subtitles");
  await emitProgress(onProgress, 86);
  await throwIfCancellationRequested(shouldCancel, "burning_subtitles");
  await burnSubtitlesToVideoOnly(
    paths.mergedVideoPath,
    paths.assPath,
    paths.visualOutputPath,
    paths.jobRoot,
    paths.logPath,
    {
      ...baseContext,
      label: "burn"
    }
  );
  await appendLog(
    paths.logPath,
    {
      ...baseContext,
      label: "burn"
    },
    `Visual output prepared at ${paths.visualOutputPath}.`
  );

  if (blueprint.audio.enabled) {
    await emitStep(onStep, "preparing_audio");
    await emitProgress(onProgress, 88);
    await throwIfCancellationRequested(shouldCancel, "preparing_audio");
    await appendLog(
      paths.logPath,
      {
        ...baseContext,
        label: "audio"
      },
      `Audio plan: ${blueprint.audio.summary}`
    );

    await emitStep(onStep, "mixing_audio");
    await emitProgress(onProgress, 92);
    await throwIfCancellationRequested(shouldCancel, "mixing_audio");
  }

  await finalizeRenderAudio({
    blueprint,
    projectRoot,
    jobRoot: paths.jobRoot,
    visualOutputPath: paths.visualOutputPath,
    outputPath: paths.outputPath,
    totalDuration,
    logPath: paths.logPath,
    context: baseContext,
    logger: {
      appendLog,
      runCommand
    }
  });

  const outputStats = await stat(paths.outputPath);
  await appendLog(
    paths.logPath,
    {
      ...baseContext,
      label: "final-output"
    },
    `Final render completed with ${outputStats.size} bytes at ${paths.outputPath}.`
  );
  await emitProgress(onProgress, blueprint.audio.enabled ? 95 : 94);

  return {
    outputPath: toRelativeStoragePath(projectRoot, paths.outputPath),
    srtPath: toRelativeStoragePath(projectRoot, paths.srtPath),
    assPath: toRelativeStoragePath(projectRoot, paths.assPath),
    logPath: toRelativeStoragePath(projectRoot, paths.logPath)
  };
}

