import { spawn } from "node:child_process";
import { constants } from "node:fs";
import { access, appendFile, mkdir, stat, writeFile } from "node:fs/promises";
import { basename, dirname, relative, resolve } from "node:path";
import {
  generateAssSubtitle,
  generateSrt,
  getCaptionStyleById
} from "@reelforge/caption-engine";
import type { RenderBlueprint, RenderBlueprintScene } from "./index.js";
import { finalizeRenderAudio } from "./audio-mix.js";
import {
  getRenderQualityProfile,
  resolveCinematicFilterPlan,
  type CinematicRenderQuality
} from "./cinematic-filter-plans.js";
import {
  buildOverscanDimensions,
  computeFrameCount,
  escapeDrawtextText,
  escapeDrawtextValue,
  joinFilters,
  normalizeSceneDuration,
  roundToThreeDecimals
} from "./ffmpeg-filter-utils.js";
import {
  createRenderJobPaths,
  resolveStoragePath,
  toForwardSlashes,
  toRelativeStoragePath
} from "./render-paths.js";
import {
  checkFfmpegAvailable,
  type RenderArtifacts,
  RenderCancellationError,
  type RenderBlueprintV1Options,
  type RenderPipelineStep
} from "./render-v1.js";

interface CommandResult {
  stdout: string;
  stderr: string;
}

interface LogContext {
  jobId: string;
  projectId: string;
  label?: string;
}

interface PlaceholderVisualConfig {
  primary: string;
  accent: string;
  sceneTitle: string;
  emotionLabel: string;
  presetLabel: string;
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

export interface RenderCinematicV2Options extends RenderBlueprintV1Options {
  renderQuality?: CinematicRenderQuality;
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

  return new Promise((resolvePromise, rejectPromise) => {
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
      rejectPromise(error);
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolvePromise({ stdout, stderr });
        return;
      }

      rejectPromise(
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

async function emitStep(
  callback: RenderBlueprintV1Options["onStep"],
  step: RenderPipelineStep
) {
  if (callback) {
    await callback(step);
  }
}

async function emitScene(
  callback: RenderBlueprintV1Options["onScene"],
  sceneIndex: number,
  totalScenes: number,
  scene: RenderBlueprintScene
) {
  if (callback) {
    await callback(sceneIndex, totalScenes, scene);
  }
}

async function emitProgress(
  callback: RenderBlueprintV1Options["onProgress"],
  progress: number
) {
  if (callback) {
    await callback(progress);
  }
}

async function throwIfCancellationRequested(
  shouldCancel: RenderBlueprintV1Options["shouldCancel"],
  step: RenderPipelineStep,
  sceneIndex: number | null = null
) {
  if (!shouldCancel) {
    return;
  }

  if (await shouldCancel()) {
    throw new RenderCancellationError(step, sceneIndex);
  }
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
    duration: normalizeSceneDuration(scene.duration),
    captionStyle: scene.captionStyle.style.id
  }));

  await writeFile(
    srtPath,
    generateSrt({
      title: blueprint.title,
      scenes: subtitleScenes
    }),
    "utf8"
  );
  await writeFile(
    assPath,
    generateAssSubtitle(
      {
        title: blueprint.title,
        scenes: subtitleScenes
      },
      defaultStyle
    ),
    "utf8"
  );
}

function createSegmentFilename(order: number) {
  return `segment-${String(order).padStart(3, "0")}.mp4`;
}

function createImageZoomExpressions(
  totalFrames: number,
  startZoom: number,
  endZoom: number,
  panMode: RenderBlueprintScene["visualPreset"]["preset"]["defaultPanMode"],
  order: number,
  energyLevel: number | null
) {
  const zoomStep = Math.max(Math.abs(endZoom - startZoom) / Math.max(totalFrames, 1), 0.0001);
  const direction = endZoom >= startZoom ? "in" : "out";
  const zoomExpression =
    direction === "in"
      ? `if(eq(on,1),${startZoom.toFixed(4)},min(${endZoom.toFixed(4)},zoom+${zoomStep.toFixed(5)}))`
      : `if(eq(on,1),${startZoom.toFixed(4)},max(${endZoom.toFixed(4)},zoom-${zoomStep.toFixed(5)}))`;
  const xRange = "max(iw/zoom-ow,0)";
  const yRange = "max(ih/zoom-oh,0)";
  const motionSeed = Math.max(order, 1) + Math.max(energyLevel ?? 40, 1);
  const phase = Math.max(12, Math.round(motionSeed / 2));
  let xExpression = `${xRange}/2`;
  let yExpression = `${yRange}/2`;

  switch (panMode) {
    case "slow-left":
      xExpression = `${xRange}*(0.72-0.42*on/${Math.max(totalFrames, 1)})`;
      yExpression = `${yRange}*(0.36+0.06*sin(on/${phase}))`;
      break;
    case "slow-right":
      xExpression = `${xRange}*(0.12+0.46*on/${Math.max(totalFrames, 1)})`;
      yExpression = `${yRange}*(0.34+0.05*cos(on/${phase}))`;
      break;
    case "parallax":
      xExpression = `${xRange}*(0.18+0.42*on/${Math.max(totalFrames, 1)})`;
      yExpression = `${yRange}*(0.24+0.16*sin(on/${Math.max(phase, 8)}))`;
      break;
    case "push-in":
    case "push-out":
      xExpression = `${xRange}/2+6*sin(on/${Math.max(phase, 8)})`;
      yExpression = `${yRange}*(0.42+0.04*cos(on/${Math.max(phase, 8)}))`;
      break;
    case "drift":
      xExpression = `${xRange}*(0.28+0.12*sin(on/${Math.max(phase, 8)}))`;
      yExpression = `${yRange}*(0.32+0.08*cos(on/${Math.max(phase, 8)}))`;
      break;
    default:
      xExpression = `${xRange}/2`;
      yExpression = `${yRange}/2`;
      break;
  }

  return {
    zoomExpression,
    xExpression,
    yExpression
  };
}

function buildColorFilters(plan: ReturnType<typeof resolveCinematicFilterPlan>["plan"]) {
  return [
    `eq=brightness=${plan.brightness.toFixed(3)}:contrast=${plan.contrast.toFixed(
      3
    )}:saturation=${plan.saturation.toFixed(3)}:gamma=${plan.gamma.toFixed(3)}`,
    plan.blurSigma > 0.01 ? `gblur=sigma=${plan.blurSigma.toFixed(3)}` : null,
    plan.vignetteAngle ? `vignette=${plan.vignetteAngle}` : null
  ];
}

function buildVideoMotionCropFilter(
  scene: RenderBlueprintScene,
  driftX: number,
  driftY: number,
  shakeX: number,
  shakeY: number
) {
  const orderSeed = Math.max(scene.order, 1);
  const energySeed = Math.max(scene.energyLevel ?? 40, 10);
  const xExpression =
    `min(max((iw-ow)/2+${driftX.toFixed(1)}*sin((n+${orderSeed})/${Math.max(
      18,
      orderSeed + 8
    )})+${shakeX.toFixed(1)}*sin((n+${energySeed})/3),0),iw-ow)`;
  const yExpression =
    `min(max((ih-oh)/2+${driftY.toFixed(1)}*cos((n+${orderSeed})/${Math.max(
      22,
      orderSeed + 10
    )})+${shakeY.toFixed(1)}*cos((n+${energySeed})/4),0),ih-oh)`;

  return `crop=1080:1920:x='${xExpression}':y='${yExpression}'`;
}

function buildPlaceholderFilter(
  visualConfig: PlaceholderVisualConfig,
  duration: number,
  fontFile: string | null
) {
  const accentOpacity = "@0.16";
  const textFilters = fontFile
    ? [
        `drawtext=fontfile='${escapeDrawtextValue(fontFile)}':text='${escapeDrawtextText(
          visualConfig.sceneTitle
        )}':fontcolor=white:fontsize=54:x=78:y=760`,
        `drawtext=fontfile='${escapeDrawtextValue(fontFile)}':text='${escapeDrawtextText(
          visualConfig.emotionLabel
        )}':fontcolor=${visualConfig.accent}:fontsize=30:x=82:y=840`,
        `drawtext=fontfile='${escapeDrawtextValue(fontFile)}':text='${escapeDrawtextText(
          visualConfig.presetLabel
        )}':fontcolor=#dfe7ff:fontsize=26:x=82:y=892`
      ]
    : [];

  return joinFilters([
    `drawbox=x=0:y=0:w=1080:h=1920:color=${visualConfig.primary}:t=fill`,
    `drawbox=x=42:y=118:w=996:h=146:color=${visualConfig.accent}${accentOpacity}:t=fill`,
    `drawbox=x=60:y=680:w=960:h=340:color=black@0.28:t=fill`,
    ...textFilters,
    ...[
      `fade=t=in:st=0:d=${Math.min(0.35, duration / 4).toFixed(3)}`,
      `fade=t=out:st=${Math.max(duration - 0.3, 0).toFixed(3)}:d=${Math.min(
        0.3,
        duration / 4
      ).toFixed(3)}`,
      "fps=30",
      "format=yuv420p"
    ]
  ]);
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

async function renderImageSegment(
  scene: RenderBlueprintScene,
  inputPath: string,
  outputPath: string,
  duration: number,
  logPath: string,
  context: LogContext,
  templateId: string,
  renderQuality: CinematicRenderQuality
) {
  const { plan, qualityProfile, fadeFilters } = resolveCinematicFilterPlan({
    scene,
    templateId,
    renderQuality
  });
  const totalFrames = computeFrameCount(duration, 30);
  const overscan = buildOverscanDimensions(plan.overscanScale);
  const zoomExpressions = createImageZoomExpressions(
    totalFrames,
    plan.zoomStart,
    plan.zoomEnd,
    plan.panMode === "center" ? "drift" : plan.panMode,
    scene.order,
    scene.energyLevel
  );
  const filter = joinFilters([
    `scale=${overscan.width}:${overscan.height}:force_original_aspect_ratio=increase`,
    `crop=${overscan.width}:${overscan.height}`,
    `zoompan=z='${zoomExpressions.zoomExpression}':x='${zoomExpressions.xExpression}':y='${zoomExpressions.yExpression}':d=${totalFrames}:s=1080x1920:fps=30`,
    ...buildColorFilters(plan),
    ...fadeFilters,
    "fps=30",
    "format=yuv420p"
  ]);

  await appendLog(
    logPath,
    context,
    `Cinematic V2 image plan '${plan.presetKey}' (${plan.presetLabel}) with filters: ${plan.notes.join("; ")}.`
  );

  await runCommand(
    "ffmpeg",
    [
      "-y",
      "-loop",
      "1",
      "-i",
      inputPath,
      "-frames:v",
      String(totalFrames),
      "-vf",
      filter,
      "-r",
      "30",
      "-c:v",
      "libx264",
      "-preset",
      qualityProfile.segmentPreset,
      "-crf",
      String(qualityProfile.segmentCrf),
      "-pix_fmt",
      "yuv420p",
      "-an",
      outputPath
    ],
    dirname(outputPath),
    logPath,
    context
  );
}

async function renderVideoSegment(
  scene: RenderBlueprintScene,
  inputPath: string,
  outputPath: string,
  duration: number,
  logPath: string,
  context: LogContext,
  templateId: string,
  renderQuality: CinematicRenderQuality
) {
  const { plan, qualityProfile, fadeFilters } = resolveCinematicFilterPlan({
    scene,
    templateId,
    renderQuality
  });
  const overscan = buildOverscanDimensions(plan.overscanScale);
  const filter = joinFilters([
    `scale=${overscan.width}:${overscan.height}:force_original_aspect_ratio=increase`,
    buildVideoMotionCropFilter(
      scene,
      plan.driftX,
      plan.driftY,
      plan.shakeX,
      plan.shakeY
    ),
    ...buildColorFilters(plan),
    ...fadeFilters,
    "fps=30",
    "format=yuv420p"
  ]);

  await appendLog(
    logPath,
    context,
    `Cinematic V2 video plan '${plan.presetKey}' with crop motion and ${plan.transitionMode} transition handling.`
  );

  await runCommand(
    "ffmpeg",
    [
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
      qualityProfile.segmentPreset,
      "-crf",
      String(qualityProfile.segmentCrf),
      "-pix_fmt",
      "yuv420p",
      "-an",
      outputPath
    ],
    dirname(outputPath),
    logPath,
    context
  );
}

async function renderPlaceholderSegment(
  scene: RenderBlueprintScene,
  outputPath: string,
  duration: number,
  logPath: string,
  context: LogContext,
  templateId: string,
  renderQuality: CinematicRenderQuality,
  fontFile: string | null
) {
  const { plan, qualityProfile } = resolveCinematicFilterPlan({
    scene,
    templateId,
    renderQuality
  });

  if (!fontFile) {
    await appendLog(
      logPath,
      context,
      "No local system font found for placeholder text; falling back to styled boxes only."
    );
  }

  const filter = buildPlaceholderFilter(
    {
      primary: plan.placeholderPrimary,
      accent: plan.placeholderAccent,
      sceneTitle: scene.title || "Scene without asset",
      emotionLabel: `Emotion: ${scene.emotion ?? "NEUTRAL"}`,
      presetLabel: `Preset: ${plan.presetKey}`
    },
    duration,
    fontFile
  );

  await runCommand(
    "ffmpeg",
    [
      "-y",
      "-f",
      "lavfi",
      "-i",
      `color=c=${plan.placeholderPrimary}:s=1080x1920:d=${duration.toFixed(3)}`,
      "-vf",
      filter,
      "-r",
      "30",
      "-c:v",
      "libx264",
      "-preset",
      qualityProfile.segmentPreset,
      "-crf",
      String(qualityProfile.segmentCrf),
      "-pix_fmt",
      "yuv420p",
      "-an",
      outputPath
    ],
    dirname(outputPath),
    logPath,
    context
  );
}

async function renderSceneSegment(
  scene: RenderBlueprintScene,
  projectRoot: string,
  jobRoot: string,
  workDir: string,
  logPath: string,
  baseContext: LogContext,
  templateId: string,
  renderQuality: CinematicRenderQuality,
  fontFile: string | null
) {
  const duration = normalizeSceneDuration(scene.duration);
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
    `Cinematic V2 scene '${scene.title}' starting. Asset path: ${declaredAssetPath ?? "none"}. Effective source: ${scene.effectiveAssetSource}. Preset: ${scene.visualPreset.preset.id}. Emotion: ${scene.emotion ?? "NEUTRAL"}.`
  );

  try {
    if (!renderAsset) {
      await appendLog(
        logPath,
        context,
        "No asset linked, generating cinematic placeholder."
      );
      await renderPlaceholderSegment(
        scene,
        outputPath,
        duration,
        logPath,
        context,
        templateId,
        renderQuality,
        fontFile
      );
      return outputPath;
    }

    let absoluteInputPath: string;

    try {
      absoluteInputPath = resolveStoragePath(projectRoot, renderAsset.path);
    } catch {
      await appendLog(
        logPath,
        context,
        `Asset path '${renderAsset.path}' escaped storage root, using cinematic placeholder instead.`
      );
      await renderPlaceholderSegment(
        scene,
        outputPath,
        duration,
        logPath,
        context,
        templateId,
        renderQuality,
        fontFile
      );
      return outputPath;
    }

    if (!(await fileExists(absoluteInputPath))) {
      await appendLog(
        logPath,
        context,
        `Asset file '${absoluteInputPath}' was not found, using cinematic placeholder.`
      );
      await renderPlaceholderSegment(
        scene,
        outputPath,
        duration,
        logPath,
        context,
        templateId,
        renderQuality,
        fontFile
      );
      return outputPath;
    }

    await appendLog(
      logPath,
      context,
      `Resolved asset absolute path '${absoluteInputPath}'.`
    );

    if (renderAsset.type === "IMAGE" || renderAsset.type === "OVERLAY") {
      await renderImageSegment(
        scene,
        absoluteInputPath,
        outputPath,
        duration,
        logPath,
        context,
        templateId,
        renderQuality
      );
      return outputPath;
    }

    if (renderAsset.type === "VIDEO") {
      await renderVideoSegment(
        scene,
        absoluteInputPath,
        outputPath,
        duration,
        logPath,
        context,
        templateId,
        renderQuality
      );
      return outputPath;
    }

    await appendLog(
      logPath,
      context,
      `Asset type '${renderAsset.type}' is not supported in Cinematic V2 yet, using placeholder fallback.`
    );
    await renderPlaceholderSegment(
      scene,
      outputPath,
      duration,
      logPath,
      context,
      templateId,
      renderQuality,
      fontFile
    );
    return outputPath;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown cinematic render error.";
    await appendLog(
      logPath,
      context,
      `Scene failed during cinematic_v2. Asset path used: ${declaredAssetPath ?? "none"}. ${message}`
    );
    throw new Error(
      `Cinematic V2 scene ${scene.order} '${scene.title}' failed using asset '${declaredAssetPath ?? "none"}': ${message}`
    );
  }
}

async function concatSegments(
  segmentPaths: string[],
  concatListPath: string,
  mergedVideoPath: string,
  jobRoot: string,
  logPath: string,
  context: LogContext,
  renderQuality: CinematicRenderQuality
) {
  const { finalPreset, finalCrf } = getRenderQualityProfile(renderQuality);

  const concatFileContents = segmentPaths
    .map((segmentPath) => `file '${basename(segmentPath)}'`)
    .join("\n");

  await writeFile(concatListPath, concatFileContents, "utf8");

  await runCommand(
    "ffmpeg",
    [
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
      finalPreset,
      "-crf",
      String(finalCrf),
      "-pix_fmt",
      "yuv420p",
      "-an",
      toJobRelativePath(jobRoot, mergedVideoPath)
    ],
    jobRoot,
    logPath,
    context
  );
}

async function burnSubtitlesToVideoOnly(
  mergedVideoPath: string,
  assPath: string,
  outputPath: string,
  jobRoot: string,
  logPath: string,
  context: LogContext,
  renderQuality: CinematicRenderQuality
) {
  const qualityProfile = getRenderQualityProfile(renderQuality);

  await runCommand(
    "ffmpeg",
    [
      "-y",
      "-i",
      toJobRelativePath(jobRoot, mergedVideoPath),
      "-vf",
      `ass=${basename(assPath)}`,
      "-c:v",
      "libx264",
      "-preset",
      qualityProfile.finalPreset,
      "-crf",
      String(qualityProfile.finalCrf),
      "-pix_fmt",
      "yuv420p",
      "-r",
      "30",
      "-movflags",
      "+faststart",
      toJobRelativePath(jobRoot, outputPath)
    ],
    jobRoot,
    logPath,
    context
  );
}

export async function renderCinematicV2({
  blueprint,
  projectRoot,
  rendersStorageRoot,
  videoProjectId,
  renderJobId,
  renderQuality = "standard",
  onStep,
  onScene,
  onProgress,
  shouldCancel
}: RenderCinematicV2Options): Promise<RenderArtifacts> {
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
  await appendLog(paths.logPath, baseContext, "Render Engine Cinematic V2 started.");
  await appendLog(paths.logPath, baseContext, ffmpegAvailability.versionOutput);
  await appendLog(
    paths.logPath,
    baseContext,
    `Render mode cinematic_v2 with quality '${renderQuality}'. Blueprint project '${blueprint.projectId}' with ${blueprint.sceneCount} scene(s).`
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
    "Subtitle artifacts generated and ready for burn-in."
  );

  const orderedScenes = [...blueprint.scenes].sort((left, right) => left.order - right.order);
  const segmentPaths: string[] = [];
  const totalScenes = orderedScenes.length;
  const templateId = blueprint.template.template.id;

  await emitStep(onStep, "rendering_scene");

  for (const [index, scene] of orderedScenes.entries()) {
    const sceneIndex = index + 1;

    await throwIfCancellationRequested(
      shouldCancel,
      "rendering_scene",
      sceneIndex
    );
    await emitScene(onScene, sceneIndex, totalScenes, scene);

    const filterPlan = resolveCinematicFilterPlan({
      scene,
      templateId,
      renderQuality
    });

    await appendLog(
      paths.logPath,
      {
        ...baseContext,
        label: `scene:${scene.order}`
      },
      `Preset ${filterPlan.plan.presetKey}, quality ${renderQuality}, filters ${filterPlan.plan.notes.join("; ")}.`
    );

    segmentPaths.push(
      await renderSceneSegment(
        scene,
        projectRoot,
        paths.jobRoot,
        paths.workDir,
        paths.logPath,
        baseContext,
        templateId,
        renderQuality,
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
    `Generated ${segmentPaths.length} cinematic scene segments in ${paths.workDir}.`
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
    },
    renderQuality
  );

  const totalDuration = roundToThreeDecimals(
    orderedScenes.reduce(
      (sum, scene) => sum + normalizeSceneDuration(scene.duration),
      0
    )
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
    },
    renderQuality
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
    `Final cinematic_v2 render completed with ${outputStats.size} bytes at ${paths.outputPath}.`
  );
  await emitProgress(onProgress, blueprint.audio.enabled ? 95 : 94);

  return {
    outputPath: toRelativeStoragePath(projectRoot, paths.outputPath),
    srtPath: toRelativeStoragePath(projectRoot, paths.srtPath),
    assPath: toRelativeStoragePath(projectRoot, paths.assPath),
    logPath: toRelativeStoragePath(projectRoot, paths.logPath)
  };
}

