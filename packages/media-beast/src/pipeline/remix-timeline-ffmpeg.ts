import { spawn } from "node:child_process";
import { constants } from "node:fs";
import { access, mkdir, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { getCaptionStyleById } from "@reelforge/caption-engine";
import {
  buildRemixAudioMixPlan,
  mixAudioIntoRemixVideo,
  type RemixAudioMixPlan
} from "./remix-audio-mix.js";
import type {
  MaterializedTimelineScene,
  RemixMaterializationReport
} from "./remix-materialization.js";
import { splitCaptionIntoLines } from "./comics-caption-semantic.js";
import type { CaptionDirectionCue } from "./caption-direction-engine.js";
import type { VideoRemixPlan } from "./video-remixer.js";

export type RemixTimelineRenderInput = {
  report: RemixMaterializationReport;
  plan: VideoRemixPlan;
  outputPath: string;
  projectRoot?: string;
  workDir?: string;
  ffmpegCommand?: string;
  verbose?: boolean;
  publishQualityAudio?: boolean;
};

export type RemixTimelineRenderResult = {
  outputPath: string;
  contactSheetPath: string;
  sceneClipPaths: string[];
  totalDurationSec: number;
  hasAudio: boolean;
  audioMixPlan: RemixAudioMixPlan | null;
};

const VIDEO_EXTENSIONS = new Set([".mp4", ".webm", ".mov", ".m4v", ".mkv"]);

function escapeDrawtextValue(value: string) {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll(":", "\\:")
    .replaceAll("'", "\\'")
    .replaceAll(",", "\\,")
    .replaceAll("[", "\\[")
    .replaceAll("]", "\\]");
}

function escapeDrawtextText(value: string) {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll(":", "\\:")
    .replaceAll("'", "\\'")
    .replaceAll("%", "\\%")
    .replaceAll(",", "\\,");
}

async function fileExists(path: string) {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function resolveFontFile() {
  const candidates = [
    "C:/Windows/Fonts/impact.ttf",
    "C:/Windows/Fonts/arialbd.ttf",
    "C:/Windows/Fonts/arial.ttf",
    "C:/Windows/Fonts/segoeui.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/System/Library/Fonts/Supplemental/Arial Bold.ttf"
  ];

  for (const candidate of candidates) {
    if (await fileExists(candidate)) {
      return candidate.replace(/\\/g, "/");
    }
  }

  return null;
}

function runFfmpeg(
  command: string,
  args: string[],
  verbose = false
): Promise<void> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      shell: false,
      stdio: verbose ? "inherit" : ["ignore", "ignore", "pipe"]
    });
    let stderr = "";
    child.stderr?.on("data", (chunk) => {
      const next = stderr + String(chunk);
      stderr = next.length > 4000 ? next.slice(-4000) : next;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolvePromise();
      else {
        reject(
          new Error(
            `${command} exited with code ${code}${stderr ? `: ${stderr.slice(-800)}` : ""}`
          )
        );
      }
    });
  });
}

function isVideoAsset(assetPath: string) {
  const lower = assetPath.toLowerCase();
  for (const ext of VIDEO_EXTENSIONS) {
    if (lower.endsWith(ext)) return true;
  }
  return false;
}

function sceneDuration(scene: MaterializedTimelineScene) {
  return Math.max(0.35, scene.endSec - scene.startSec);
}

type RenderSceneGroup = {
  scenes: MaterializedTimelineScene[];
  assetPath: string | null;
  duration: number;
};

function groupConsecutiveScenes(scenes: MaterializedTimelineScene[]): RenderSceneGroup[] {
  const groups: RenderSceneGroup[] = [];

  for (const scene of scenes) {
    const duration = sceneDuration(scene);
    const previous = groups[groups.length - 1];
    if (
      previous &&
      previous.assetPath === scene.assetPath &&
      previous.scenes.length < 8
    ) {
      previous.scenes.push(scene);
      previous.duration += duration;
      continue;
    }

    groups.push({
      scenes: [scene],
      assetPath: scene.assetPath,
      duration
    });
  }

  return groups;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await mapper(items[index]!, index);
    }
  });

  await Promise.all(workers);
  return results;
}

function buildComicCaptionFilter(
  caption: string,
  duration: number,
  fontFile: string | null,
  startOffset = 0
) {
  const lines = splitCaptionIntoLines(caption.trim().toUpperCase(), 20);
  if (lines.length === 0) return null;
  const text = lines.join("\\n");
  const start = startOffset.toFixed(3);
  const end = (startOffset + duration).toFixed(3);

  const style = getCaptionStyleById("comic_pop");
  const fontColor = "#f59e0b";
  const outlineColor = style?.outline?.color ?? "#111827";
  const outlineWidth = style?.outline?.width ?? 6;
  const baseFontSize = style?.fontSize ?? 60;
  const fontSize = text.length > 24 ? Math.max(42, baseFontSize - 10) : baseFontSize;
  const yPosition =
    lines.length > 1
      ? "h*0.74-(text_h/2)"
      : style?.position === "center"
        ? "(h-text_h)/2"
        : "h*0.76";
  const xPosition = "max(w*0.08\\,min((w-text_w)/2\\,w*0.92-text_w))";

  if (!fontFile) {
    return `drawtext=text='${escapeDrawtextText(text)}':fontcolor=${fontColor}:fontsize=${fontSize}:line_spacing=8:borderw=${outlineWidth}:bordercolor=${outlineColor}:x=${xPosition}:y=${yPosition}:box=1:boxcolor=${fontColor}@0.18:boxborderw=14:enable='between(t,${start},${end})'`;
  }

  return `drawtext=fontfile='${escapeDrawtextValue(fontFile)}':text='${escapeDrawtextText(
    text
  )}':fontcolor=${fontColor}:fontsize=${fontSize}:line_spacing=8:borderw=${outlineWidth}:bordercolor=${outlineColor}:x=${xPosition}:y=${yPosition}:box=1:boxcolor=${fontColor}@0.18:boxborderw=14:enable='between(t,${start},${end})'`;
}

function buildSceneVisualFilter(
  scenes: MaterializedTimelineScene[],
  duration: number,
  fontFile: string | null,
  captionStyleId: string,
  skipSceneCaptions = false
) {
  const base = [
    "scale=1080:1920:force_original_aspect_ratio=increase",
    "crop=1080:1920",
    "setsar=1"
  ];

  if (skipSceneCaptions) {
    return base.join(",");
  }

  let offset = 0;
  for (const scene of scenes) {
    const sceneLen = sceneDuration(scene);
    const caption =
      captionStyleId === "comic_pop" || captionStyleId.includes("comic")
        ? buildComicCaptionFilter(scene.caption, sceneLen, fontFile, offset)
        : buildComicCaptionFilter(scene.caption, sceneLen, fontFile, offset);
    if (caption) base.push(caption);
    offset += sceneLen;
  }

  return base.join(",");
}

function buildBeatCaptionOverlayFilter(
  cues: CaptionDirectionCue[],
  fontFile: string | null
): string | null {
  const filters: string[] = [];
  for (const cue of cues) {
    const startSec = cue.startSec ?? 0;
    const endSec = cue.endSec ?? startSec + 1;
    const duration = Math.max(0.35, endSec - startSec);
    const filter = buildComicCaptionFilter(cue.textOnScreen, duration, fontFile, startSec);
    if (filter) filters.push(filter);
  }
  return filters.length > 0 ? filters.join(",") : null;
}

async function applyBeatCaptionOverlay(input: {
  sourcePath: string;
  outputPath: string;
  cues: CaptionDirectionCue[];
  ffmpegCommand: string;
  fontFile: string | null;
  verbose: boolean;
}) {
  const overlay = buildBeatCaptionOverlayFilter(input.cues, input.fontFile);
  if (!overlay) {
    await runFfmpeg(
      input.ffmpegCommand,
      [
        "-y",
        "-hide_banner",
        "-loglevel",
        "error",
        "-i",
        input.sourcePath,
        "-c",
        "copy",
        input.outputPath
      ],
      input.verbose
    );
    return;
  }

  await runFfmpeg(
    input.ffmpegCommand,
    [
      "-y",
      "-hide_banner",
      "-loglevel",
      "error",
      "-i",
      input.sourcePath,
      "-vf",
      overlay,
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "18",
      "-c:a",
      "copy",
      input.outputPath
    ],
    input.verbose
  );
}

function buildPlaceholderFilter(
  scene: MaterializedTimelineScene,
  duration: number,
  fontFile: string | null
) {
  const hue = scene.sceneRole === "hook" ? "0x1a1038" : "0x101820";
  const filters = ["scale=1080:1920"];
  const caption = buildComicCaptionFilter(
    scene.caption || scene.sceneRole.toUpperCase(),
    duration,
    fontFile
  );
  if (caption) filters.push(caption);
  return {
    color: `color=c=${hue}:s=1080x1920:r=30`,
    vf: filters.join(",")
  };
}

async function renderSceneClip(input: {
  group: RenderSceneGroup;
  outputPath: string;
  workDir: string;
  ffmpegCommand: string;
  captionStyleId: string;
  fontFile: string | null;
  verbose: boolean;
  skipSceneCaptions?: boolean;
}) {
  const { group, outputPath, ffmpegCommand, captionStyleId, fontFile, verbose } = input;
  const duration = group.duration;
  const assetPath = group.assetPath;
  const scene = group.scenes[0]!;

  if (assetPath && (await fileExists(assetPath))) {
    const filter = buildSceneVisualFilter(
      group.scenes,
      duration,
      fontFile,
      captionStyleId,
      input.skipSceneCaptions === true
    );

    if (isVideoAsset(assetPath)) {
      await runFfmpeg(
        ffmpegCommand,
        [
          "-y",
          "-hide_banner",
          "-loglevel",
          "error",
          "-i",
          assetPath,
          "-t",
          duration.toFixed(3),
          "-vf",
          filter,
          "-r",
          "30",
          "-c:v",
          "libx264",
          "-preset",
          "ultrafast",
          "-crf",
          "24",
          "-pix_fmt",
          "yuv420p",
          "-an",
          outputPath
        ],
        verbose
      );
      return;
    }

    await runFfmpeg(
      ffmpegCommand,
      [
        "-y",
        "-hide_banner",
        "-loglevel",
        "error",
        "-loop",
        "1",
        "-i",
        assetPath,
        "-t",
        duration.toFixed(3),
        "-vf",
        filter,
        "-r",
        "30",
        "-c:v",
        "libx264",
        "-preset",
        "ultrafast",
        "-crf",
        "24",
        "-pix_fmt",
        "yuv420p",
        "-an",
        outputPath
      ],
      verbose
    );
    return;
  }

  const placeholder = buildPlaceholderFilter(scene, duration, fontFile);
  await runFfmpeg(
    ffmpegCommand,
    [
      "-y",
      "-hide_banner",
      "-loglevel",
      "error",
      "-f",
      "lavfi",
      "-i",
      placeholder.color,
      "-t",
      duration.toFixed(3),
      "-vf",
      placeholder.vf,
      "-r",
      "30",
      "-c:v",
      "libx264",
      "-preset",
      "ultrafast",
      "-crf",
      "24",
      "-pix_fmt",
      "yuv420p",
      "-an",
      outputPath
    ],
    verbose
  );
}

async function concatSceneClips(
  clipPaths: string[],
  outputPath: string,
  workDir: string,
  ffmpegCommand: string,
  verbose: boolean
) {
  const concatListPath = join(workDir, "timeline-concat.txt");
  const concatBody = clipPaths
    .map((clipPath) => `file '${clipPath.replace(/\\/g, "/").replace(/'/g, "'\\''")}'`)
    .join("\n");
  await writeFile(concatListPath, concatBody, "utf8");

  await runFfmpeg(
    ffmpegCommand,
    [
      "-y",
      "-hide_banner",
      "-loglevel",
      "error",
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      concatListPath,
      "-c",
      "copy",
      outputPath
    ],
    verbose
  );
}

async function renderContactSheet(
  videoPath: string,
  outputPath: string,
  ffmpegCommand: string,
  verbose: boolean
) {
  await runFfmpeg(
    ffmpegCommand,
    [
      "-y",
      "-hide_banner",
      "-loglevel",
      "error",
      "-i",
      videoPath,
      "-vf",
      "fps=1/3,scale=360:640:force_original_aspect_ratio=decrease,pad=360:640:(ow-iw)/2:(oh-ih)/2,tile=3x2",
      "-frames:v",
      "1",
      outputPath
    ],
    verbose
  );
}

export async function renderRemixTimelineFromMaterialization(
  input: RemixTimelineRenderInput
): Promise<RemixTimelineRenderResult> {
  const report = input.report;
  if (!report.canRender) {
    throw new Error(report.blockReason ?? "remix_materialization_blocked");
  }

  const ffmpegCommand = input.ffmpegCommand ?? "ffmpeg";
  const workDir = input.workDir ?? join(dirname(input.outputPath), "timeline-work");
  await mkdir(workDir, { recursive: true });
  await mkdir(dirname(input.outputPath), { recursive: true });

  const fontFile = await resolveFontFile();
  const useBeatCaptionOverlay = report.captionCues.length > 0;
  const sceneGroups = groupConsecutiveScenes(report.timelineScenes);
  const sceneClipPaths = await mapWithConcurrency(sceneGroups, 4, async (group, index) => {
    const sceneId = group.scenes[0]?.sceneId ?? `group-${index}`;
    const clipPath = join(workDir, `scene-${String(index).padStart(3, "0")}-${sceneId}.mp4`);
    await renderSceneClip({
      group,
      outputPath: clipPath,
      workDir,
      ffmpegCommand,
      captionStyleId: report.captionStyleId,
      fontFile,
      verbose: input.verbose === true,
      skipSceneCaptions: useBeatCaptionOverlay
    });
    return resolve(clipPath);
  });

  const silentOutput = join(workDir, "timeline-silent.mp4");
  await concatSceneClips(sceneClipPaths, silentOutput, workDir, ffmpegCommand, input.verbose === true);

  const totalDurationSec = report.timelineScenes.reduce(
    (acc, scene) => acc + sceneDuration(scene),
    0
  );

  const silentTrimmed = join(workDir, "timeline-silent-trimmed.mp4");
  await runFfmpeg(
    ffmpegCommand,
    [
      "-y",
      "-hide_banner",
      "-loglevel",
      "error",
      "-i",
      silentOutput,
      "-t",
      totalDurationSec.toFixed(3),
      "-c",
      "copy",
      silentTrimmed
    ],
    input.verbose === true
  );

  const projectRoot = input.projectRoot ?? process.cwd();
  const audioWorkDir = join(workDir, "audio");
  const audioMixPlan = await buildRemixAudioMixPlan({
    plan: input.plan,
    projectRoot,
    totalDurationSec,
    workDir: audioWorkDir
  });

  const mixedOutput = join(workDir, "timeline-with-audio.mp4");
  const audioResult = await mixAudioIntoRemixVideo({
    videoPath: silentTrimmed,
    outputPath: mixedOutput,
    audioPlan: audioMixPlan,
    ffmpegCommand,
    verbose: input.verbose === true,
    publishQuality: input.publishQualityAudio === true
  });

  const finalSource = audioResult.hasAudio ? mixedOutput : silentTrimmed;
  const captionedOutput = join(workDir, "timeline-captioned.mp4");
  if (useBeatCaptionOverlay) {
    await applyBeatCaptionOverlay({
      sourcePath: finalSource,
      outputPath: captionedOutput,
      cues: report.captionCues,
      ffmpegCommand,
      fontFile,
      verbose: input.verbose === true
    });
    await runFfmpeg(
      ffmpegCommand,
      [
        "-y",
        "-hide_banner",
        "-loglevel",
        "error",
        "-i",
        captionedOutput,
        "-c",
        "copy",
        input.outputPath
      ],
      input.verbose === true
    );
  } else {
    await runFfmpeg(
      ffmpegCommand,
      [
        "-y",
        "-hide_banner",
        "-loglevel",
        "error",
        "-i",
        finalSource,
        "-c",
        "copy",
        input.outputPath
      ],
      input.verbose === true
    );
  }

  const contactSheetPath = input.outputPath.replace(/\.mp4$/i, "-contact-sheet.jpg");
  try {
    await renderContactSheet(
      input.outputPath,
      contactSheetPath,
      ffmpegCommand,
      input.verbose === true
    );
  } catch {
    // Contact sheet is best-effort.
  }

  return {
    outputPath: resolve(input.outputPath),
    contactSheetPath: resolve(contactSheetPath),
    sceneClipPaths,
    totalDurationSec,
    hasAudio: audioResult.hasAudio,
    audioMixPlan
  };
}