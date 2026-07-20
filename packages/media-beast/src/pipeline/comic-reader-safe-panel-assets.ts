import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { access, mkdir, readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { basename, dirname, join } from "node:path";
import type {
  LocalComicPanelEvidence,
  LocalPanelCropBounds
} from "./comics-local-panel-index.js";

export type ComicReaderSafeIntent =
  | "dialogue_context"
  | "action_context"
  | "reaction_context"
  | "wide_story_context";

export type ComicReaderSafePanelAsset = {
  sourcePanelId: string;
  sourcePagePath: string;
  originalPanelImagePath: string;
  readerSafeImagePath: string;
  readerSafeImageSha256: string;
  originalCropBounds: LocalPanelCropBounds;
  expandedCropBounds: LocalPanelCropBounds;
  outputWidth: 1080;
  outputHeight: 1920;
  intent: ComicReaderSafeIntent;
  expansionRatio: number;
  reasons: string[];
  warnings: string[];
};

export type ComicReaderSafePanelAssetReport = {
  source: "comic-reader-safe-panel-assets";
  generatedAt: string;
  assetCount: number;
  assets: ComicReaderSafePanelAsset[];
  warnings: string[];
};

const OUTPUT_WIDTH = 1080 as const;
const OUTPUT_HEIGHT = 1920 as const;

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK | constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

async function sha256File(path: string): Promise<string> {
  const bytes = await readFile(path);
  return createHash("sha256").update(bytes).digest("hex");
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function round(value: number): number {
  return Math.round(value);
}

function safeFilename(value: string): string {
  return value.replace(/[:/\\\s]+/g, "_").replace(/[^a-zA-Z0-9_.-]/g, "");
}

function evidenceTextLoad(panel: LocalComicPanelEvidence): number {
  return (
    panel.localEvidence.dialogue.length +
    panel.localEvidence.narrationBoxes.length +
    panel.localEvidence.detectedText.length
  );
}

export function resolveReaderSafeIntent(panel: LocalComicPanelEvidence): ComicReaderSafeIntent {
  const textLoad = evidenceTextLoad(panel);
  if (textLoad > 0 || panel.storyFunction === "dialogue") return "dialogue_context";
  if (panel.storyFunction === "reaction" || panel.storyFunction === "reveal") return "reaction_context";
  if (
    panel.storyFunction === "action" ||
    panel.storyFunction === "climax" ||
    panel.localEvidence.actions.length > 0 ||
    panel.localEvidence.soundEffects.length > 0
  ) {
    return "action_context";
  }
  return "wide_story_context";
}

function expansionForIntent(intent: ComicReaderSafeIntent, panel: LocalComicPanelEvidence): number {
  const textLoad = evidenceTextLoad(panel);
  const narrowPanel = panel.cropBounds.width / Math.max(1, panel.cropBounds.height) < 0.58;
  const smallPanel = panel.cropAreaRatio < 0.12;

  let expansion = 1.45;
  if (intent === "dialogue_context") expansion = 1.95;
  if (intent === "action_context") expansion = 1.7;
  if (intent === "reaction_context") expansion = 1.85;
  if (intent === "wide_story_context") expansion = 1.6;
  if (textLoad >= 2) expansion += 0.2;
  if (narrowPanel) expansion += 0.28;
  if (smallPanel) expansion += 0.18;

  return clamp(expansion, 1.35, 2.55);
}

export function expandPanelCropForReaderSafeContext(input: {
  panel: LocalComicPanelEvidence;
  pageWidth: number;
  pageHeight: number;
  intent?: ComicReaderSafeIntent;
}): { bounds: LocalPanelCropBounds; intent: ComicReaderSafeIntent; expansionRatio: number; reasons: string[] } {
  const intent = input.intent ?? resolveReaderSafeIntent(input.panel);
  const expansionRatio = expansionForIntent(intent, input.panel);
  const crop = input.panel.cropBounds;

  const targetAspect = OUTPUT_WIDTH / OUTPUT_HEIGHT;
  let width = crop.width * expansionRatio;
  let height = crop.height * expansionRatio;
  const currentAspect = width / Math.max(1, height);

  if (currentAspect > targetAspect) {
    height = width / targetAspect;
  } else {
    width = height * targetAspect;
  }

  width = clamp(width, Math.max(crop.width, 96), input.pageWidth);
  height = clamp(height, Math.max(crop.height, 160), input.pageHeight);

  // Small comic panels can become visually identical when expanded to a full-page 9:16 crop.
  // Keep enough context for balloons/action, but preserve the panel's own position and identity.
  if (input.panel.cropAreaRatio < 0.18) {
    const maxSmallPanelHeight = Math.max(crop.height, input.pageHeight * 0.68);
    if (height > maxSmallPanelHeight) {
      height = maxSmallPanelHeight;
      width = height * targetAspect;
    }
    const maxSmallPanelWidth = Math.max(crop.width, input.pageWidth * 0.72);
    if (width > maxSmallPanelWidth) {
      width = maxSmallPanelWidth;
      height = width / targetAspect;
    }
  }

  const centerX = crop.x + crop.width / 2;
  const centerY = crop.y + crop.height / 2;
  const x = clamp(centerX - width / 2, 0, Math.max(0, input.pageWidth - width));
  const y = clamp(centerY - height / 2, 0, Math.max(0, input.pageHeight - height));

  const reasons = [
    `intent:${intent}`,
    `expansion_ratio:${expansionRatio.toFixed(2)}`,
    `text_load:${evidenceTextLoad(input.panel)}`,
    `story_function:${input.panel.storyFunction}`,
    `crop_area_ratio:${input.panel.cropAreaRatio.toFixed(3)}`
  ];

  if (input.panel.cropBounds.width / Math.max(1, input.panel.cropBounds.height) < 0.58) {
    reasons.push("narrow_panel_expand_for_context");
  }
  if (input.panel.cropAreaRatio < 0.12) {
    reasons.push("small_panel_expand_for_context");
  }

  return {
    bounds: {
      x: round(x),
      y: round(y),
      width: round(width),
      height: round(height)
    },
    intent,
    expansionRatio,
    reasons
  };
}

function runFfmpegCropToVerticalCanvas(input: {
  sourcePath: string;
  outputPath: string;
  cropBounds: LocalPanelCropBounds;
  ffmpegCommand?: string;
}): Promise<void> {
  return new Promise((resolvePromise, reject) => {
    const crop = input.cropBounds;
    const filter = [
      `crop=${crop.width}:${crop.height}:${crop.x}:${crop.y}`,
      `scale=${OUTPUT_WIDTH}:${OUTPUT_HEIGHT}:force_original_aspect_ratio=decrease`,
      `pad=${OUTPUT_WIDTH}:${OUTPUT_HEIGHT}:(ow-iw)/2:(oh-ih)/2:color=black`,
      "setsar=1",
      "format=yuv420p"
    ].join(",");
    const child = spawn(
      input.ffmpegCommand ?? "ffmpeg",
      [
        "-y",
        "-hide_banner",
        "-loglevel",
        "error",
        "-i",
        input.sourcePath,
        "-vf",
        filter,
        "-frames:v",
        "1",
        input.outputPath
      ],
      { stdio: ["ignore", "ignore", "pipe"] }
    );
    let stderr = "";
    child.stderr?.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolvePromise();
      else reject(new Error(`ffmpeg reader-safe crop exited ${code}: ${stderr.slice(-800)}`));
    });
  });
}

export async function materializeReaderSafePanelAsset(input: {
  panel: LocalComicPanelEvidence;
  pageWidth: number;
  pageHeight: number;
  outputDirectory: string;
  intent?: ComicReaderSafeIntent;
  ffmpegCommand?: string;
  forceRebuild?: boolean;
}): Promise<ComicReaderSafePanelAsset> {
  const warnings: string[] = [];
  if (!(await fileExists(input.panel.sourcePagePath))) {
    throw new Error(`source_page_missing:${input.panel.sourcePagePath}`);
  }
  if (!(await fileExists(input.panel.panelImagePath))) {
    warnings.push(`original_panel_crop_missing:${input.panel.panelImagePath}`);
  }

  const expanded = expandPanelCropForReaderSafeContext({
    panel: input.panel,
    pageWidth: input.pageWidth,
    pageHeight: input.pageHeight,
    ...(input.intent ? { intent: input.intent } : {})
  });
  const outputPath = join(
    input.outputDirectory,
    `${safeFilename(input.panel.panelId)}.reader-safe.jpg`
  );

  await mkdir(dirname(outputPath), { recursive: true });
  if (input.forceRebuild || !(await fileExists(outputPath))) {
    await runFfmpegCropToVerticalCanvas({
      sourcePath: input.panel.sourcePagePath,
      outputPath,
      cropBounds: expanded.bounds,
      ...(input.ffmpegCommand ? { ffmpegCommand: input.ffmpegCommand } : {})
    });
  }

  return {
    sourcePanelId: input.panel.panelId,
    sourcePagePath: input.panel.sourcePagePath,
    originalPanelImagePath: input.panel.panelImagePath,
    readerSafeImagePath: outputPath,
    readerSafeImageSha256: await sha256File(outputPath),
    originalCropBounds: input.panel.cropBounds,
    expandedCropBounds: expanded.bounds,
    outputWidth: OUTPUT_WIDTH,
    outputHeight: OUTPUT_HEIGHT,
    intent: expanded.intent,
    expansionRatio: Number(expanded.expansionRatio.toFixed(3)),
    reasons: expanded.reasons,
    warnings
  };
}

export async function materializeReaderSafePanelAssets(input: {
  panels: LocalComicPanelEvidence[];
  pageDimensionsBySourcePath: Map<string, { width: number; height: number }>;
  outputDirectory: string;
  ffmpegCommand?: string;
  forceRebuild?: boolean;
}): Promise<ComicReaderSafePanelAssetReport> {
  const assets: ComicReaderSafePanelAsset[] = [];
  const warnings: string[] = [];

  for (const panel of input.panels) {
    const dimensions = input.pageDimensionsBySourcePath.get(panel.sourcePagePath);
    if (!dimensions) {
      warnings.push(`missing_page_dimensions:${basename(panel.sourcePagePath)}:${panel.panelId}`);
      continue;
    }
    try {
      assets.push(await materializeReaderSafePanelAsset({
        panel,
        pageWidth: dimensions.width,
        pageHeight: dimensions.height,
        outputDirectory: input.outputDirectory,
        ...(input.ffmpegCommand ? { ffmpegCommand: input.ffmpegCommand } : {}),
        ...(input.forceRebuild !== undefined ? { forceRebuild: input.forceRebuild } : {})
      }));
    } catch (error) {
      warnings.push(`reader_safe_asset_failed:${panel.panelId}:${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return {
    source: "comic-reader-safe-panel-assets",
    generatedAt: new Date().toISOString(),
    assetCount: assets.length,
    assets,
    warnings
  };
}
