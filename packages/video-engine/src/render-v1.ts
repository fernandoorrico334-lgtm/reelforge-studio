import { spawn } from "node:child_process";
import { constants } from "node:fs";
import { access, appendFile, mkdir, stat, writeFile } from "node:fs/promises";
import { basename, relative, resolve } from "node:path";
import {
  generateAssSubtitle,
  generateSrt,
  getCaptionStyleById
} from "@reelforge/caption-engine";
import type { AudioQualityReport } from "@reelforge/audio-engine/mastering";
import type { RenderBlueprint, RenderBlueprintScene } from "./index.js";
import { finalizeRenderAudio } from "./audio-mix.js";
import {
  escapeDrawtextText,
  escapeDrawtextValue
} from "./ffmpeg-filter-utils.js";
import {
  createRenderJobPaths,
  resolveStoragePath,
  toForwardSlashes,
  toRelativeStoragePath
} from "./render-paths.js";
import { validateRenderBlueprintAssets } from "./render-asset-validation.js";
import {
  checkFfmpegAvailable as checkResolvedFfmpegAvailable,
  getFfmpegCommand,
  type BinaryAvailability
} from "./ffmpeg-runtime.js";

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
  command?: string;
  source?: "env" | "path";
  envVar?: "FFMPEG_PATH" | "FFPROBE_PATH";
  blockedByEnvironment?: boolean;
  notFound?: boolean;
}

export interface RenderBlueprintV1Options {
  blueprint: RenderBlueprint;
  projectRoot: string;
  rendersStorageRoot: string;
  videoProjectId: string;
  renderJobId: string;
  audioMasteringPresetId?: string | null;
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
  audioQualityReport?: AudioQualityReport | null;
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

interface SceneBaseVisualSegment {
  kind: "base";
  duration: number;
  sourceOffsetSeconds: number;
}

interface SceneMicroclipVisualSegment {
  kind: "microclip";
  duration: number;
  microclip: RenderBlueprintScene["editorialMicroclips"][number];
}

type SceneVisualSegment =
  | SceneBaseVisualSegment
  | SceneMicroclipVisualSegment;

const maxCapturedCommandOutputChars = 200_000;
const maxRenderLogBytes = Number(process.env.REELFORGE_RENDER_LOG_MAX_BYTES ?? 1_000_000);

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

function appendCapturedOutput(current: string, chunk: string) {
  const nextValue = current + chunk;

  if (nextValue.length <= maxCapturedCommandOutputChars) {
    return nextValue;
  }

  return nextValue.slice(-maxCapturedCommandOutputChars);
}

const logWriteQueues = new Map<string, Promise<void>>();

function queueLogAppend(logPath: string, contents: string) {
  const previousWrite = logWriteQueues.get(logPath) ?? Promise.resolve();
  const nextWrite = previousWrite
    .catch(() => undefined)
    .then(async () => {
      if (!contents) {
        return;
      }

      if (Number.isFinite(maxRenderLogBytes) && maxRenderLogBytes > 0) {
        try {
          const currentStats = await stat(logPath);
          if (currentStats.size >= maxRenderLogBytes) {
            return;
          }
          const remainingBytes = maxRenderLogBytes - currentStats.size;
          if (Buffer.byteLength(contents, "utf8") > remainingBytes) {
            const marker = `\n[render-log-truncated] Log limit reached (${maxRenderLogBytes} bytes).\n`;
            const markerBytes = Buffer.byteLength(marker, "utf8");
            const contentBytes = Math.max(0, remainingBytes - markerBytes);
            if (contentBytes <= 0) {
              return;
            }
            const truncatedContents = Buffer.from(contents, "utf8")
              .subarray(0, contentBytes)
              .toString("utf8");
            await appendFile(
              logPath,
              `${truncatedContents}${marker}`,
              "utf8"
            );
            return;
          }
        } catch {
          // Log file may not exist yet.
        }
      }

      await appendFile(logPath, contents, "utf8");
    });

  logWriteQueues.set(logPath, nextWrite.catch(() => undefined));
  return nextWrite;
}

async function appendLog(logPath: string, context: LogContext, message: string) {
  await queueLogAppend(logPath, `${buildLogPrefix(context)} ${message}\n`);
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
      stdout = appendCapturedOutput(stdout, text);
      void queueLogAppend(logPath, formatLogChunk(text, context, "stdout"));
    });

    child.stderr.on("data", (chunk) => {
      const text = chunk.toString();
      stderr = appendCapturedOutput(stderr, text);
      void queueLogAppend(logPath, formatLogChunk(text, context, "stderr"));
    });

    child.on("error", (error) => {
      reject(error);
    });

    child.on("close", (code) => {
      void (async () => {
        await (logWriteQueues.get(logPath) ?? Promise.resolve());

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
      })();
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

async function resolveFontFile() {
  const candidates = [
    "C:/Windows/Fonts/arial.ttf",
    "C:/Windows/Fonts/segoeui.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/System/Library/Fonts/Supplemental/Arial.ttf"
  ];

  for (const candidate of candidates) {
    if (await fileExists(candidate)) {
      return toForwardSlashes(resolve(candidate));
    }
  }

  return null;
}

function getSceneDuration(scene: RenderBlueprintScene) {
  if (typeof scene.duration === "number" && scene.duration > 0) {
    return Math.max(scene.duration, 0.5);
  }

  return 4;
}

function normalizedCropFilter(scene: RenderBlueprintScene): string | null {
  const crop = scene.smartCropDirective?.normalizedCrop;
  if (!crop) return null;
  const x = Math.max(0, Math.min(0.98, crop.x));
  const y = Math.max(0, Math.min(0.98, crop.y));
  const width = Math.max(0.1, Math.min(1 - x, crop.width));
  const height = Math.max(0.1, Math.min(1 - y, crop.height));
  return `crop=iw*${width.toFixed(4)}:ih*${height.toFixed(4)}:iw*${x.toFixed(4)}:ih*${y.toFixed(4)}`;
}

function buildVisualFilter(scene: RenderBlueprintScene) {
  const smartCrop = normalizedCropFilter(scene);
  const filters = [
    ...(smartCrop ? [smartCrop] : []),
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

function createScenePartFilename(order: number, partIndex: number) {
  return `scene-${String(order).padStart(3, "0")}-part-${String(partIndex).padStart(3, "0")}.mp4`;
}

function createSceneConcatFilename(order: number) {
  return `scene-${String(order).padStart(3, "0")}-concat.txt`;
}

function toJobRelativePath(jobRoot: string, absolutePath: string) {
  return toForwardSlashes(relative(jobRoot, absolutePath));
}

function buildSceneVisualSegments(
  scene: RenderBlueprintScene,
  sceneDuration: number
): SceneVisualSegment[] {
  const sortedMicroclips = [...scene.editorialMicroclips].sort(
    (left, right) =>
      left.insertStartSeconds - right.insertStartSeconds ||
      left.orderIndex - right.orderIndex
  );
  const segments: SceneVisualSegment[] = [];
  let cursor = 0;

  for (const microclip of sortedMicroclips) {
    const start = Math.max(
      cursor,
      Math.min(microclip.insertStartSeconds, sceneDuration)
    );
    const end = Math.max(
      start,
      Math.min(microclip.insertEndSeconds, sceneDuration)
    );

    if (start - cursor > 0.04) {
      segments.push({
        kind: "base",
        duration: Math.round((start - cursor) * 1000) / 1000,
        sourceOffsetSeconds: Math.round(cursor * 1000) / 1000
      });
    }

    if (end - start > 0.04) {
      segments.push({
        kind: "microclip",
        duration: Math.round((end - start) * 1000) / 1000,
        microclip
      });
    }

    cursor = end;
  }

  if (sceneDuration - cursor > 0.04) {
    segments.push({
      kind: "base",
      duration: Math.round((sceneDuration - cursor) * 1000) / 1000,
      sourceOffsetSeconds: Math.round(cursor * 1000) / 1000
    });
  }

  if (segments.length === 0) {
    segments.push({
      kind: "base",
      duration: Math.round(sceneDuration * 1000) / 1000,
      sourceOffsetSeconds: 0
    });
  }

  return segments;
}

function buildMicroclipTextOverlayFilter(
  microclip: RenderBlueprintScene["editorialMicroclips"][number],
  fontFile: string | null
) {
  if (!microclip.textOverlay || !fontFile) {
    return null;
  }

  const fontSize = microclip.calloutStyle === "bold" ? 46 : 32;
  const boxBorder = microclip.calloutStyle === "bold" ? 28 : 18;
  const boxOpacity =
    microclip.calloutStyle === "bold" ? "black@0.52" : "black@0.28";
  const yPosition = microclip.calloutStyle === "bold" ? 1380 : 1460;

  return `drawtext=fontfile='${escapeDrawtextValue(fontFile)}':text='${escapeDrawtextText(
    microclip.textOverlay
  )}':fontcolor=white:fontsize=${fontSize}:x=(w-text_w)/2:y=${yPosition}:box=1:boxcolor=${boxOpacity}:boxborderw=${boxBorder}`;
}


function buildSubtitleScenes(blueprint: RenderBlueprint) {
  const subtitleScenes: Array<{ order: number; captionText: string | null; duration: number; captionStyle: string }> = [];
  for (const scene of [...blueprint.scenes].sort((left, right) => left.order - right.order)) {
    if (scene.captionCues.length === 0) {
      subtitleScenes.push({
        order: scene.order,
        captionText: scene.captionText ?? scene.narrationText,
        duration: getSceneDuration(scene),
        captionStyle: scene.captionStyle.style.id
      });
      continue;
    }
    const sceneDuration = getSceneDuration(scene);
    const cueTotal = Math.max(...scene.captionCues.map((cue) => cue.endSeconds), sceneDuration, 0.1);
    for (const cue of scene.captionCues) {
      const cueDuration = Math.max(0.35, cue.endSeconds - cue.startSeconds);
      subtitleScenes.push({
        order: scene.order + cue.cueIndex / 100,
        captionText: cue.text,
        duration: Math.max(0.35, (cueDuration / cueTotal) * sceneDuration),
        captionStyle: scene.captionStyle.style.id
      });
    }
  }
  return subtitleScenes;
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

  const subtitleScenes = buildSubtitleScenes(blueprint);

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

  await runCommand(getFfmpegCommand(), args, jobRoot, logPath, context);
}

async function renderVideoSegment(
  inputPath: string,
  outputPath: string,
  duration: number,
  filter: string,
  jobRoot: string,
  logPath: string,
  context: LogContext,
  options: {
    sourceOffsetSeconds?: number;
  } = {}
) {
  const args = [
    "-y",
    "-stream_loop",
    "-1"
  ];

  if (
    typeof options.sourceOffsetSeconds === "number" &&
    options.sourceOffsetSeconds > 0
  ) {
    args.push("-ss", options.sourceOffsetSeconds.toFixed(3));
  }

  args.push(
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
  );

  await runCommand(getFfmpegCommand(), args, jobRoot, logPath, context);
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

  await runCommand(getFfmpegCommand(), args, jobRoot, logPath, context);
}

async function renderBaseVisualSegment(
  scene: RenderBlueprintScene,
  projectRoot: string,
  outputPath: string,
  duration: number,
  sourceOffsetSeconds: number,
  jobRoot: string,
  logPath: string,
  context: LogContext
) {
  const renderAsset = scene.effectiveAsset ?? scene.asset;
  const visualFilter = buildVisualFilter(scene);
  const placeholderFilter = buildPlaceholderFilter(scene);

  if (!renderAsset) {
    await appendLog(
      logPath,
      context,
      `Base visual gap ${duration.toFixed(3)}s has no asset, using placeholder.`
    );
    await renderPlaceholderSegment(
      outputPath,
      duration,
      placeholderFilter,
      jobRoot,
      logPath,
      context
    );
    return;
  }

  let absoluteInputPath: string;

  try {
    absoluteInputPath = resolveStoragePath(projectRoot, renderAsset.path);
  } catch {
    await appendLog(
      logPath,
      context,
      `Base asset path '${renderAsset.path}' escaped storage root, using placeholder.`
    );
    await renderPlaceholderSegment(
      outputPath,
      duration,
      placeholderFilter,
      jobRoot,
      logPath,
      context
    );
    return;
  }

  if (!(await fileExists(absoluteInputPath))) {
    await appendLog(
      logPath,
      context,
      `Base asset '${absoluteInputPath}' not found, using placeholder.`
    );
    await renderPlaceholderSegment(
      outputPath,
      duration,
      placeholderFilter,
      jobRoot,
      logPath,
      context
    );
    return;
  }

  if (renderAsset.type === "IMAGE" || renderAsset.type === "OVERLAY") {
    await renderImageSegment(
      absoluteInputPath,
      outputPath,
      duration,
      visualFilter,
      jobRoot,
      logPath,
      context
    );
    return;
  }

  if (renderAsset.type === "VIDEO") {
    await renderVideoSegment(
      absoluteInputPath,
      outputPath,
      duration,
      visualFilter,
      jobRoot,
      logPath,
      context,
      {
        sourceOffsetSeconds
      }
    );
    return;
  }

  await appendLog(
    logPath,
    context,
    `Base asset type '${renderAsset.type}' is unsupported, using placeholder.`
  );
  await renderPlaceholderSegment(
    outputPath,
    duration,
    placeholderFilter,
    jobRoot,
    logPath,
    context
  );
}

async function renderMicroclipSegment(
  scene: RenderBlueprintScene,
  microclip: RenderBlueprintScene["editorialMicroclips"][number],
  projectRoot: string,
  outputPath: string,
  duration: number,
  jobRoot: string,
  logPath: string,
  context: LogContext,
  fontFile: string | null
) {
  const placeholderFilter = buildPlaceholderFilter(scene);

  if (!microclip.assetPath) {
    await appendLog(
      logPath,
      context,
      `Microclip '${microclip.label}' has no asset path, using placeholder insert.`
    );
    await renderPlaceholderSegment(
      outputPath,
      duration,
      placeholderFilter,
      jobRoot,
      logPath,
      context
    );
    return;
  }

  let absoluteInputPath: string;

  try {
    absoluteInputPath = resolveStoragePath(projectRoot, microclip.assetPath);
  } catch {
    await appendLog(
      logPath,
      context,
      `Microclip path '${microclip.assetPath}' escaped storage root, using placeholder insert.`
    );
    await renderPlaceholderSegment(
      outputPath,
      duration,
      placeholderFilter,
      jobRoot,
      logPath,
      context
    );
    return;
  }

  if (!(await fileExists(absoluteInputPath))) {
    await appendLog(
      logPath,
      context,
      `Microclip file '${absoluteInputPath}' not found, using placeholder insert.`
    );
    await renderPlaceholderSegment(
      outputPath,
      duration,
      placeholderFilter,
      jobRoot,
      logPath,
      context
    );
    return;
  }

  if (
    microclip.transitionIn !== "cut" ||
    microclip.transitionOut !== "cut"
  ) {
    await appendLog(
      logPath,
      context,
      `Microclip '${microclip.label}' requested transitions ${microclip.transitionIn}/${microclip.transitionOut}; Render V1 is using hard cuts in this stage.`
    );
  }

  if (microclip.textOverlay && !fontFile) {
    await appendLog(
      logPath,
      context,
      `Microclip '${microclip.label}' has textOverlay, but no local font was found. Overlay text was skipped.`
    );
  }

  const filter = [
    buildVisualFilter(scene),
    buildMicroclipTextOverlayFilter(microclip, fontFile)
  ]
    .filter((value): value is string => Boolean(value))
    .join(",");

  const args = [
    "-y",
    "-ss",
    microclip.startTimeSeconds.toFixed(3),
    "-i",
    absoluteInputPath,
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

  await appendLog(
    logPath,
    context,
    `Rendering editorial microclip '${microclip.label}' (${microclip.usageMode}) from ${microclip.startTimeSeconds.toFixed(3)}s to ${microclip.endTimeSeconds.toFixed(3)}s.`
  );
  await runCommand(getFfmpegCommand(), args, jobRoot, logPath, context);
}

async function renderSceneSegment(
  scene: RenderBlueprintScene,
  projectRoot: string,
  jobRoot: string,
  workDir: string,
  logPath: string,
  baseContext: LogContext,
  fontFile: string | null
) {
  const duration = getSceneDuration(scene);
  const outputPath = `${workDir}/${createSegmentFilename(scene.order)}`;
  const renderAsset = scene.effectiveAsset ?? scene.asset;
  const declaredAssetPath = renderAsset?.path ?? null;
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
    const visualSegments = buildSceneVisualSegments(scene, duration);

    if (scene.editorialMicroclips.length === 0) {
      await appendLog(
        logPath,
        context,
        renderAsset
          ? "Rendering scene without editorial microclips."
          : "No base asset linked, using placeholder background."
      );
      await renderBaseVisualSegment(
        scene,
        projectRoot,
        outputPath,
        duration,
        0,
        jobRoot,
        logPath,
        context
      );
      return outputPath;
    }

    await appendLog(
      logPath,
      context,
      `Rendering ${scene.editorialMicroclips.length} editorial microclip insert(s) across ${visualSegments.length} visual segment(s).`
    );

    const segmentPartPaths: string[] = [];

    for (const [partIndex, segment] of visualSegments.entries()) {
      const partPath = `${workDir}/${createScenePartFilename(scene.order, partIndex + 1)}`;
      const partContext = {
        ...context,
        label: `scene:${scene.order}:part:${partIndex + 1}`
      };

      if (segment.kind === "base") {
        await renderBaseVisualSegment(
          scene,
          projectRoot,
          partPath,
          segment.duration,
          segment.sourceOffsetSeconds,
          jobRoot,
          logPath,
          partContext
        );
      } else {
        await renderMicroclipSegment(
          scene,
          segment.microclip,
          projectRoot,
          partPath,
          segment.duration,
          jobRoot,
          logPath,
          partContext,
          fontFile
        );
      }

      segmentPartPaths.push(partPath);
    }

    await concatSegments(
      segmentPartPaths,
      `${workDir}/${createSceneConcatFilename(scene.order)}`,
      outputPath,
      jobRoot,
      logPath,
      {
        ...context,
        label: `scene:${scene.order}:concat`
      }
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
    await runCommand(getFfmpegCommand(), args, jobRoot, logPath, context);
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
    await runCommand(getFfmpegCommand(), args, jobRoot, logPath, context);
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
  const result: BinaryAvailability = await checkResolvedFfmpegAvailable();

  return result;
}

export async function renderBlueprintV1({
  blueprint,
  projectRoot,
  rendersStorageRoot,
  videoProjectId,
  renderJobId,
  audioMasteringPresetId,
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
  const fontFile = await resolveFontFile();

  await mkdir(paths.jobRoot, { recursive: true });
  await mkdir(paths.workDir, { recursive: true });

  await emitStep(onStep, "reading_blueprint");
  await emitProgress(onProgress, 5);
  await throwIfCancellationRequested(shouldCancel, "reading_blueprint");
  await appendLog(paths.logPath, baseContext, "Render Engine V1 started.");
  await appendLog(
    paths.logPath,
    baseContext,
    `FFmpeg command resolved from ${ffmpegAvailability.source ?? "path"}: ${ffmpegAvailability.command ?? getFfmpegCommand()}`
  );
  await appendLog(paths.logPath, baseContext, ffmpegAvailability.versionOutput);
  await appendLog(
    paths.logPath,
    baseContext,
    `Render blueprint project '${blueprint.projectId}' with ${blueprint.sceneCount} scene(s).`
  );
  const assetValidation = await validateRenderBlueprintAssets({
    blueprint,
    projectRoot
  });
  await appendLog(
    paths.logPath,
    {
      ...baseContext,
      label: "asset-validation"
    },
    `Checked ${assetValidation.checkedAssets} asset path(s); ${assetValidation.issues.length} issue(s).`
  );
  for (const issue of assetValidation.issues) {
    await appendLog(
      paths.logPath,
      {
        ...baseContext,
        label: "asset-validation"
      },
      `[${issue.severity}] scene ${issue.sceneOrder} '${issue.sceneTitle}' ${issue.assetRole} asset '${issue.assetId ?? "none"}': ${issue.message} Path: ${issue.path ?? "none"}.`
    );
  }
  if (!assetValidation.readyForFfmpeg) {
    throw new Error(
      "Render asset validation failed before FFmpeg. Fix unsafe asset paths before rendering."
    );
  }

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
        baseContext,
        fontFile
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

  const audioResult = await finalizeRenderAudio({
    blueprint,
    projectRoot,
    jobRoot: paths.jobRoot,
    visualOutputPath: paths.visualOutputPath,
    outputPath: paths.outputPath,
    totalDuration,
    logPath: paths.logPath,
    context: baseContext,
    audioMasteringPresetId: audioMasteringPresetId ?? null,
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
    logPath: toRelativeStoragePath(projectRoot, paths.logPath),
    audioQualityReport: audioResult.audioQualityReport
  };
}

