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
import { validateRenderBlueprintAssets } from "./render-asset-validation.js";
import {
  getFfmpegCommand
} from "./ffmpeg-runtime.js";
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
      stdout = appendCapturedOutput(stdout, text);
      void queueLogAppend(logPath, formatLogChunk(text, context, "stdout"));
    });

    child.stderr.on("data", (chunk) => {
      const text = chunk.toString();
      stderr = appendCapturedOutput(stderr, text);
      void queueLogAppend(logPath, formatLogChunk(text, context, "stderr"));
    });

    child.on("error", (error) => {
      rejectPromise(error);
    });

    child.on("close", (code) => {
      void (async () => {
        await (logWriteQueues.get(logPath) ?? Promise.resolve());

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


function buildSubtitleScenes(blueprint: RenderBlueprint) {
  const subtitleScenes: Array<{ order: number; captionText: string | null; duration: number; captionStyle: string; highlightedWords?: string[]; animation?: string | null; readingImpactScore?: number | null; keyword?: string | null; emphasis?: string | null; colorMood?: string | null }> = [];
  for (const scene of [...blueprint.scenes].sort((left, right) => left.order - right.order)) {
    if (scene.captionCues.length === 0) {
      subtitleScenes.push({
        order: scene.order,
        captionText: scene.captionText ?? scene.narrationText,
        duration: normalizeSceneDuration(scene.duration),
        captionStyle: scene.captionStyle.style.id
      });
      continue;
    }
    const sceneDuration = normalizeSceneDuration(scene.duration);
    const cueTotal = Math.max(...scene.captionCues.map((cue) => cue.endSeconds), sceneDuration, 0.1);
    for (const cue of scene.captionCues) {
      const cueDuration = Math.max(0.35, cue.endSeconds - cue.startSeconds);
      subtitleScenes.push({
        order: scene.order + cue.cueIndex / 100,
        captionText: cue.text,
        duration: Math.max(0.35, (cueDuration / cueTotal) * sceneDuration),
        captionStyle: scene.captionStyle.style.id,
        highlightedWords: cue.highlightedWords,
        animation: cue.animation,
        readingImpactScore: cue.readingImpactScore,
        keyword: cue.keyword,
        emphasis: cue.emphasis,
        colorMood: cue.colorMood
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

function createScenePartFilename(order: number, partIndex: number) {
  return `scene-${String(order).padStart(3, "0")}-part-${String(partIndex).padStart(3, "0")}.mp4`;
}

function createSceneConcatFilename(order: number) {
  return `scene-${String(order).padStart(3, "0")}-concat.txt`;
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
        duration: roundToThreeDecimals(start - cursor),
        sourceOffsetSeconds: roundToThreeDecimals(cursor)
      });
    }

    if (end - start > 0.04) {
      segments.push({
        kind: "microclip",
        duration: roundToThreeDecimals(end - start),
        microclip
      });
    }

    cursor = end;
  }

  if (sceneDuration - cursor > 0.04) {
    segments.push({
      kind: "base",
      duration: roundToThreeDecimals(sceneDuration - cursor),
      sourceOffsetSeconds: roundToThreeDecimals(cursor)
    });
  }

  if (segments.length === 0) {
    segments.push({
      kind: "base",
      duration: roundToThreeDecimals(sceneDuration),
      sourceOffsetSeconds: 0
    });
  }

  return segments;
}

type FocusAnchor = {
  x: number;
  y: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function clampRatio(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0.08, Math.min(0.92, value))
    : fallback;
}

function getComicDynamicEditingRecipe(scene: RenderBlueprintScene): Record<string, unknown> | null {
  const recipe = scene.premiumVisualRecipe;
  if (!isRecord(recipe)) return null;
  const dynamic = recipe.comicDynamicEditing;
  return isRecord(dynamic) ? dynamic : null;
}

function getSceneFocusAnchor(scene: RenderBlueprintScene): FocusAnchor | null {
  const dynamic = getComicDynamicEditingRecipe(scene);
  const dynamicAnchor = isRecord(dynamic?.anchorPoint) ? dynamic.anchorPoint : null;
  const smartAnchor = scene.smartCropDirective?.anchorPoint ?? null;
  if (dynamicAnchor) {
    return {
      x: clampRatio(dynamicAnchor.x, smartAnchor?.x ?? 0.5),
      y: clampRatio(dynamicAnchor.y, smartAnchor?.y ?? 0.5)
    };
  }
  if (smartAnchor) {
    return {
      x: clampRatio(smartAnchor.x, 0.5),
      y: clampRatio(smartAnchor.y, 0.5)
    };
  }
  return null;
}

function shouldAvoidShake(scene: RenderBlueprintScene) {
  const dynamic = getComicDynamicEditingRecipe(scene);
  return String(dynamic?.motionPolicy ?? "").includes("no_shake") || scene.transition.includes("page_tear");
}

function shouldUsePageTear(scene: RenderBlueprintScene) {
  const dynamic = getComicDynamicEditingRecipe(scene);
  return scene.transition.includes("page_tear") || String(dynamic?.transitionStyle ?? "").includes("page_tear");
}

function getMaxVisualHoldSeconds(scene: RenderBlueprintScene) {
  const dynamic = getComicDynamicEditingRecipe(scene);
  const value = dynamic?.maxVisualHoldSeconds;
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(2.5, Math.min(4, value))
    : 4;
}

function buildPageTearFilters(scene: RenderBlueprintScene, duration: number): string[] {
  if (!shouldUsePageTear(scene)) return [];
  const maxHold = getMaxVisualHoldSeconds(scene);
  const cutTimes = [0];
  for (let time = maxHold; time < duration - 0.45; time += maxHold) {
    cutTimes.push(Number(time.toFixed(2)));
  }

  return cutTimes.flatMap((start, index) => {
    const st = start.toFixed(3);
    const sweep = `(t-${st})`;
    const direction = index % 2 === 0 ? 1 : -1;
    const xExpression = direction > 0
      ? `if(between(t,${st},${(start + 0.28).toFixed(3)}),-180+${sweep}*4700,2000)`
      : `if(between(t,${st},${(start + 0.28).toFixed(3)}),1160-${sweep}*4700,2000)`;
    const shadowExpression = direction > 0
      ? `if(between(t,${st},${(start + 0.28).toFixed(3)}),-230+${sweep}*4700,2000)`
      : `if(between(t,${st},${(start + 0.28).toFixed(3)}),1210-${sweep}*4700,2000)`;
    return [
      `drawbox=x='${shadowExpression}':y=0:w=54:h=1920:color=black@0.28:t=fill`,
      `drawbox=x='${xExpression}':y=0:w=38:h=1920:color=white@0.82:t=fill`,
    ];
  });
}
function createImageZoomExpressions(
  totalFrames: number,
  startZoom: number,
  endZoom: number,
  panMode: RenderBlueprintScene["visualPreset"]["preset"]["defaultPanMode"],
  order: number,
  energyLevel: number | null,
  focusAnchor: FocusAnchor | null
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

  if (focusAnchor) {
    const anchorX = focusAnchor.x.toFixed(4);
    const anchorY = focusAnchor.y.toFixed(4);
    xExpression = `min(max(iw*${anchorX}-(iw/zoom/2),0),max(iw-iw/zoom,0))`;
    yExpression = `min(max(ih*${anchorY}-(ih/zoom/2),0),max(ih-ih/zoom,0))`;
  } else {
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

function normalizedSmartCropFilter(scene: RenderBlueprintScene): string | null {
  const crop = scene.smartCropDirective?.normalizedCrop;
  if (!crop) return null;
  const x = Math.max(0, Math.min(0.98, crop.x));
  const y = Math.max(0, Math.min(0.98, crop.y));
  const width = Math.max(0.1, Math.min(1 - x, crop.width));
  const height = Math.max(0.1, Math.min(1 - y, crop.height));
  return `crop=iw*${width.toFixed(4)}:ih*${height.toFixed(4)}:iw*${x.toFixed(4)}:ih*${y.toFixed(4)}`;
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
    scene.energyLevel,
    getSceneFocusAnchor(scene)
  );
  const smartCrop = normalizedSmartCropFilter(scene);
  const filter = joinFilters([
    smartCrop,
    `scale=${overscan.width}:${overscan.height}:force_original_aspect_ratio=increase`,
    `crop=${overscan.width}:${overscan.height}`,
    `zoompan=z='${zoomExpressions.zoomExpression}':x='${zoomExpressions.xExpression}':y='${zoomExpressions.yExpression}':d=${totalFrames}:s=1080x1920:fps=30`,
    ...buildColorFilters(plan),
    ...buildPageTearFilters(scene, duration),
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
    getFfmpegCommand(),
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
  renderQuality: CinematicRenderQuality,
  options: {
    sourceOffsetSeconds?: number;
    overlayFilter?: string | null;
  } = {}
) {
  const { plan, qualityProfile, fadeFilters } = resolveCinematicFilterPlan({
    scene,
    templateId,
    renderQuality
  });
  const overscan = buildOverscanDimensions(plan.overscanScale);
  const smartCrop = normalizedSmartCropFilter(scene);
  const filter = joinFilters([
    smartCrop,
    `scale=${overscan.width}:${overscan.height}:force_original_aspect_ratio=increase`,
    buildVideoMotionCropFilter(
      scene,
      plan.driftX,
      plan.driftY,
      shouldAvoidShake(scene) ? 0 : plan.shakeX,
      shouldAvoidShake(scene) ? 0 : plan.shakeY
    ),
    ...buildColorFilters(plan),
    options.overlayFilter ?? null,
    ...buildPageTearFilters(scene, duration),
    ...fadeFilters,
    "fps=30",
    "format=yuv420p"
  ]);

  await appendLog(
    logPath,
    context,
    `Cinematic V2 video plan '${plan.presetKey}' with crop motion and ${plan.transitionMode} transition handling.`
  );

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
    qualityProfile.segmentPreset,
    "-crf",
    String(qualityProfile.segmentCrf),
    "-pix_fmt",
    "yuv420p",
    "-an",
    outputPath
  );

  await runCommand(
    getFfmpegCommand(),
    args,
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
    getFfmpegCommand(),
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

function buildMicroclipOverlayFilter(
  microclip: RenderBlueprintScene["editorialMicroclips"][number],
  fontFile: string | null
) {
  if (!microclip.textOverlay || !fontFile) {
    return null;
  }

  const fontSize = microclip.calloutStyle === "bold" ? 50 : 34;
  const boxBorder = microclip.calloutStyle === "bold" ? 30 : 20;
  const boxOpacity =
    microclip.calloutStyle === "bold" ? "black@0.58" : "black@0.30";
  const yPosition = microclip.calloutStyle === "bold" ? 1360 : 1450;

  return `drawtext=fontfile='${escapeDrawtextValue(fontFile)}':text='${escapeDrawtextText(
    microclip.textOverlay
  )}':fontcolor=white:fontsize=${fontSize}:x=(w-text_w)/2:y=${yPosition}:box=1:boxcolor=${boxOpacity}:boxborderw=${boxBorder}`;
}

async function renderBaseVisualSegment(
  scene: RenderBlueprintScene,
  projectRoot: string,
  outputPath: string,
  duration: number,
  sourceOffsetSeconds: number,
  logPath: string,
  context: LogContext,
  templateId: string,
  renderQuality: CinematicRenderQuality,
  fontFile: string | null
) {
  const renderAsset = scene.effectiveAsset ?? scene.asset;

  if (!renderAsset) {
    await appendLog(
      logPath,
      context,
      `Base visual gap ${duration.toFixed(3)}s has no asset, generating cinematic placeholder.`
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
      scene,
      outputPath,
      duration,
      logPath,
      context,
      templateId,
      renderQuality,
      fontFile
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
      scene,
      outputPath,
      duration,
      logPath,
      context,
      templateId,
      renderQuality,
      fontFile
    );
    return;
  }

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
    return;
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
      renderQuality,
      {
        sourceOffsetSeconds
      }
    );
    return;
  }

  await appendLog(
    logPath,
    context,
    `Base asset type '${renderAsset.type}' is unsupported in cinematic_v2, using placeholder.`
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
}

async function renderMicroclipSegment(
  scene: RenderBlueprintScene,
  microclip: RenderBlueprintScene["editorialMicroclips"][number],
  projectRoot: string,
  outputPath: string,
  duration: number,
  logPath: string,
  context: LogContext,
  templateId: string,
  renderQuality: CinematicRenderQuality,
  fontFile: string | null
) {
  if (!microclip.assetPath) {
    await appendLog(
      logPath,
      context,
      `Microclip '${microclip.label}' has no asset path, using cinematic placeholder insert.`
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
    return;
  }

  let absoluteInputPath: string;

  try {
    absoluteInputPath = resolveStoragePath(projectRoot, microclip.assetPath);
  } catch {
    await appendLog(
      logPath,
      context,
      `Microclip path '${microclip.assetPath}' escaped storage root, using cinematic placeholder insert.`
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
    return;
  }

  if (!(await fileExists(absoluteInputPath))) {
    await appendLog(
      logPath,
      context,
      `Microclip file '${absoluteInputPath}' not found, using cinematic placeholder insert.`
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
    return;
  }

  if (
    microclip.transitionIn !== "cut" ||
    microclip.transitionOut !== "cut"
  ) {
    await appendLog(
      logPath,
      context,
      `Microclip '${microclip.label}' requested transitions ${microclip.transitionIn}/${microclip.transitionOut}; cinematic_v2 is using hard cuts in this V1 support layer.`
    );
  }

  if (microclip.textOverlay && !fontFile) {
    await appendLog(
      logPath,
      context,
      `Microclip '${microclip.label}' has textOverlay, but no local font was found. Overlay text was skipped.`
    );
  }

  const overlayFilter = buildMicroclipOverlayFilter(microclip, fontFile);

  await appendLog(
    logPath,
    context,
    `Rendering cinematic editorial microclip '${microclip.label}' (${microclip.usageMode}) from ${microclip.startTimeSeconds.toFixed(3)}s to ${microclip.endTimeSeconds.toFixed(3)}s.`
  );

  await renderVideoSegment(
    scene,
    absoluteInputPath,
    outputPath,
    duration,
    logPath,
    context,
    templateId,
    renderQuality,
    {
      sourceOffsetSeconds: microclip.startTimeSeconds,
      overlayFilter
    }
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
    const visualSegments = buildSceneVisualSegments(scene, duration);

    if (scene.editorialMicroclips.length === 0) {
      await appendLog(
        logPath,
        context,
        renderAsset
          ? "Rendering scene without editorial microclips."
          : "No asset linked, generating cinematic placeholder."
      );
      await renderBaseVisualSegment(
        scene,
        projectRoot,
        outputPath,
        duration,
        0,
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
      `Rendering ${scene.editorialMicroclips.length} editorial microclip insert(s) across ${visualSegments.length} cinematic visual segment(s).`
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
          logPath,
          partContext,
          templateId,
          renderQuality,
          fontFile
        );
      } else {
        await renderMicroclipSegment(
          scene,
          segment.microclip,
          projectRoot,
          partPath,
          segment.duration,
          logPath,
          partContext,
          templateId,
          renderQuality,
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
      },
      renderQuality
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
    getFfmpegCommand(),
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
    getFfmpegCommand(),
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
  audioMasteringPresetId,
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
  await appendLog(
    paths.logPath,
    baseContext,
    `FFmpeg command resolved from ${ffmpegAvailability.source ?? "path"}: ${ffmpegAvailability.command ?? getFfmpegCommand()}`
  );
  await appendLog(paths.logPath, baseContext, ffmpegAvailability.versionOutput);
  await appendLog(
    paths.logPath,
    baseContext,
    `Render mode cinematic_v2 with quality '${renderQuality}'. Blueprint project '${blueprint.projectId}' with ${blueprint.sceneCount} scene(s).`
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
    `Final cinematic_v2 render completed with ${outputStats.size} bytes at ${paths.outputPath}.`
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
