import { spawn } from "node:child_process";
import { constants } from "node:fs";
import { access } from "node:fs/promises";

export const COMICS_PANEL_VISUAL_SAMPLE_SIZE = 128;

export type ComicsPanelColorRegionStats = {
  whiteRatio: number;
  blackRatio: number;
  redRatio: number;
  blueRatio: number;
  yellowRatio: number;
  greenRatio: number;
  saturatedRatio: number;
  colorBucketCount: number;
};

export type ComicsPanelVisualProfile = {
  global: ComicsPanelColorRegionStats;
  topThird: ComicsPanelColorRegionStats;
  midThird: ComicsPanelColorRegionStats;
  bottomThird: ComicsPanelColorRegionStats;
};

export type ComicsPanelVisualVerdict = {
  analyzable: boolean;
  eligible: boolean;
  rejectReason: string | null;
  duoVisualScore: number;
  visualTags: string[];
  profile: ComicsPanelVisualProfile | null;
  warnings: string[];
};

export type ComicsPanelVisualAnalysisInput = {
  assetPath: string;
  ffmpegCommand?: string;
  sampleSize?: number;
};

const HARD_VISUAL_REJECT_REASONS = new Set([
  "catalog_ad_visual",
  "mystical_off_theme_hero",
  "text_heavy_visual_page"
]);

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK | constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function isNearWhite(r: number, g: number, b: number): boolean {
  return r >= 238 && g >= 238 && b >= 238;
}

function isNearBlack(r: number, g: number, b: number): boolean {
  return r <= 32 && g <= 32 && b <= 32;
}

function isRedDominant(r: number, g: number, b: number): boolean {
  return r >= 145 && r >= g * 1.35 && r >= b * 1.35;
}

function isBlueDominant(r: number, g: number, b: number): boolean {
  return b >= 110 && b >= r * 1.15 && b >= g * 1.05;
}

function isYellowDominant(r: number, g: number, b: number): boolean {
  return r >= 170 && g >= 145 && b <= 110 && r >= b * 1.35;
}

function isGreenDominant(r: number, g: number, b: number): boolean {
  return g >= 120 && g >= r * 1.1 && g >= b * 1.1;
}

function isSaturated(r: number, g: number, b: number): boolean {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max - min >= 55 && max >= 90;
}

function colorBucket(r: number, g: number, b: number): number {
  const rq = r >> 4;
  const gq = g >> 4;
  const bq = b >> 4;
  return (rq << 8) | (gq << 4) | bq;
}

function createEmptyRegionStats(): ComicsPanelColorRegionStats {
  return {
    whiteRatio: 0,
    blackRatio: 0,
    redRatio: 0,
    blueRatio: 0,
    yellowRatio: 0,
    greenRatio: 0,
    saturatedRatio: 0,
    colorBucketCount: 0
  };
}

export function analyzePixelBuffer(
  pixels: Buffer,
  sampleSize = COMICS_PANEL_VISUAL_SAMPLE_SIZE
): ComicsPanelVisualProfile | null {
  const expectedBytes = sampleSize * sampleSize * 3;
  if (pixels.length < expectedBytes) return null;

  const regionHeight = Math.floor(sampleSize / 3);
  const regions = {
    global: createEmptyRegionStats(),
    topThird: createEmptyRegionStats(),
    midThird: createEmptyRegionStats(),
    bottomThird: createEmptyRegionStats()
  };
  const bucketCounts = {
    global: new Map<number, number>(),
    topThird: new Map<number, number>(),
    midThird: new Map<number, number>(),
    bottomThird: new Map<number, number>()
  };

  const assignRegion = (y: number): "topThird" | "midThird" | "bottomThird" => {
    if (y < regionHeight) return "topThird";
    if (y < regionHeight * 2) return "midThird";
    return "bottomThird";
  };

  const bump = (
    stats: ComicsPanelColorRegionStats,
    buckets: Map<number, number>,
    r: number,
    g: number,
    b: number
  ) => {
    stats.whiteRatio += isNearWhite(r, g, b) ? 1 : 0;
    stats.blackRatio += isNearBlack(r, g, b) ? 1 : 0;
    stats.redRatio += isRedDominant(r, g, b) ? 1 : 0;
    stats.blueRatio += isBlueDominant(r, g, b) ? 1 : 0;
    stats.yellowRatio += isYellowDominant(r, g, b) ? 1 : 0;
    stats.greenRatio += isGreenDominant(r, g, b) ? 1 : 0;
    stats.saturatedRatio += isSaturated(r, g, b) ? 1 : 0;
    const bucket = colorBucket(r, g, b);
    buckets.set(bucket, (buckets.get(bucket) ?? 0) + 1);
  };

  let pixelIndex = 0;
  for (let y = 0; y < sampleSize; y += 1) {
    const regionKey = assignRegion(y);
    for (let x = 0; x < sampleSize; x += 1) {
      const r = pixels[pixelIndex] ?? 0;
      const g = pixels[pixelIndex + 1] ?? 0;
      const b = pixels[pixelIndex + 2] ?? 0;
      pixelIndex += 3;
      bump(regions.global, bucketCounts.global, r, g, b);
      bump(regions[regionKey], bucketCounts[regionKey], r, g, b);
    }
  }

  const finalize = (
    stats: ComicsPanelColorRegionStats,
    buckets: Map<number, number>,
    totalPixels: number
  ) => {
    stats.whiteRatio = Number((stats.whiteRatio / totalPixels).toFixed(4));
    stats.blackRatio = Number((stats.blackRatio / totalPixels).toFixed(4));
    stats.redRatio = Number((stats.redRatio / totalPixels).toFixed(4));
    stats.blueRatio = Number((stats.blueRatio / totalPixels).toFixed(4));
    stats.yellowRatio = Number((stats.yellowRatio / totalPixels).toFixed(4));
    stats.greenRatio = Number((stats.greenRatio / totalPixels).toFixed(4));
    stats.saturatedRatio = Number((stats.saturatedRatio / totalPixels).toFixed(4));
    const minBucketPixels = Math.max(8, Math.floor(totalPixels * 0.004));
    stats.colorBucketCount = [...buckets.values()].filter((count) => count >= minBucketPixels).length;
  };

  const totalPixels = sampleSize * sampleSize;
  const thirdPixels = regionHeight * sampleSize;
  finalize(regions.global, bucketCounts.global, totalPixels);
  finalize(regions.topThird, bucketCounts.topThird, thirdPixels);
  finalize(regions.midThird, bucketCounts.midThird, thirdPixels);
  finalize(regions.bottomThird, bucketCounts.bottomThird, thirdPixels);

  return regions;
}

export function isCatalogAdVisual(profile: ComicsPanelVisualProfile): boolean {
  return (
    profile.global.whiteRatio >= 0.33 &&
    profile.global.colorBucketCount >= 9 &&
    profile.global.saturatedRatio <= 0.42
  );
}

export function isTextHeavyVisualPage(profile: ComicsPanelVisualProfile): boolean {
  return profile.global.whiteRatio >= 0.4 && profile.global.blackRatio <= 0.08;
}

export function isEnsembleCameoPanelVisual(profile: ComicsPanelVisualProfile): boolean {
  const mutedEnsemble =
    profile.global.colorBucketCount >= 45 &&
    profile.global.saturatedRatio <= 0.11 &&
    profile.global.blackRatio >= 0.18 &&
    profile.global.blackRatio <= 0.32;
  const darkMysticalCrossover =
    profile.global.blackRatio >= 0.38 &&
    profile.topThird.blueRatio >= 0.11 &&
    profile.midThird.redRatio <= 0.08 &&
    profile.global.redRatio <= 0.05;
  return mutedEnsemble || darkMysticalCrossover;
}

export function isMysticalOffThemeHeroVisual(profile: ComicsPanelVisualProfile): boolean {
  return isEnsembleCameoPanelVisual(profile);
}

export function isCrowdCrossoverVisual(profile: ComicsPanelVisualProfile): boolean {
  return (
    profile.global.colorBucketCount >= 42 &&
    profile.global.saturatedRatio <= 0.14 &&
    profile.global.blackRatio >= 0.14 &&
    profile.global.blackRatio <= 0.34
  );
}

export function isSymbioteDuoVisual(profile: ComicsPanelVisualProfile): boolean {
  if (isEnsembleCameoPanelVisual(profile)) return false;

  const simbionteBlueFocus =
    profile.global.blueRatio >= 0.12 &&
    profile.global.blackRatio >= 0.02 &&
    profile.global.blackRatio <= 0.18 &&
    profile.global.saturatedRatio >= 0.18;
  const venomMassDuo =
    profile.global.blackRatio >= 0.1 &&
    profile.global.blackRatio <= 0.34 &&
    (profile.global.redRatio >= 0.04 || profile.global.blueRatio >= 0.05) &&
    profile.global.saturatedRatio >= 0.12;
  const bottomDarkAccent = profile.bottomThird.blackRatio >= 0.09;
  return simbionteBlueFocus || (venomMassDuo && bottomDarkAccent);
}

export function scoreDuoVisual(profile: ComicsPanelVisualProfile): number {
  let score = 38;
  if (isSymbioteDuoVisual(profile)) score += 34;
  if (profile.global.blackRatio >= 0.11) score += 10;
  if (profile.global.redRatio >= 0.055 && profile.global.blueRatio >= 0.045) score += 12;
  if (profile.bottomThird.blackRatio >= 0.13) score += 8;
  if (isEnsembleCameoPanelVisual(profile)) score -= 72;
  if (isCatalogAdVisual(profile)) score -= 65;
  if (isTextHeavyVisualPage(profile)) score -= 55;
  if (isCrowdCrossoverVisual(profile) && !isSymbioteDuoVisual(profile)) score -= 28;
  return clamp(Math.round(score), 0, 100);
}

export type ComicsPanelRegionKey = "topThird" | "midThird" | "bottomThird";

export function buildRegionFocusedVisualProfile(
  profile: ComicsPanelVisualProfile,
  region: ComicsPanelRegionKey | "global"
): ComicsPanelVisualProfile {
  if (region === "global") return profile;
  const focus = profile[region];
  return {
    global: { ...focus },
    topThird: { ...focus },
    midThird: { ...focus },
    bottomThird: { ...focus }
  };
}

export function evaluateRegionPanelVisual(
  profile: ComicsPanelVisualProfile,
  region: ComicsPanelRegionKey | "global"
): ComicsPanelVisualVerdict {
  const focused = buildRegionFocusedVisualProfile(profile, region);
  return evaluateComicsPanelVisualProfile(focused);
}

export function evaluateComicsPanelVisualProfile(
  profile: ComicsPanelVisualProfile
): ComicsPanelVisualVerdict {
  const visualTags: string[] = [];
  const warnings: string[] = [];

  if (isSymbioteDuoVisual(profile)) visualTags.push("visual_symbiote_duo");
  if (isEnsembleCameoPanelVisual(profile)) visualTags.push("visual_ensemble_cameo");
  if (isMysticalOffThemeHeroVisual(profile)) visualTags.push("visual_mystical_off_theme");
  if (isCatalogAdVisual(profile)) visualTags.push("visual_catalog_ad");
  if (isTextHeavyVisualPage(profile)) visualTags.push("visual_text_heavy");
  if (isCrowdCrossoverVisual(profile)) visualTags.push("visual_crowd_crossover");

  let rejectReason: string | null = null;
  if (isCatalogAdVisual(profile)) rejectReason = "catalog_ad_visual";
  else if (isTextHeavyVisualPage(profile)) rejectReason = "text_heavy_visual_page";
  else if (isEnsembleCameoPanelVisual(profile)) rejectReason = "mystical_off_theme_hero";

  const duoVisualScore = scoreDuoVisual(profile);
  if (
    !rejectReason &&
    isCrowdCrossoverVisual(profile) &&
    !isSymbioteDuoVisual(profile) &&
    duoVisualScore < 45
  ) {
    rejectReason = "crowd_crossover_without_duo";
    warnings.push("crowd_scene_low_duo_score");
  }

  return {
    analyzable: true,
    eligible: rejectReason === null,
    rejectReason,
    duoVisualScore,
    visualTags,
    profile,
    warnings
  };
}

export function isHardVisualRejectReason(reason: string | null | undefined): boolean {
  return Boolean(reason && HARD_VISUAL_REJECT_REASONS.has(reason));
}

async function readRasterPixelsViaFfmpeg(input: {
  assetPath: string;
  ffmpegCommand?: string;
  sampleSize?: number;
}): Promise<Buffer> {
  const sampleSize = input.sampleSize ?? COMICS_PANEL_VISUAL_SAMPLE_SIZE;
  const ffmpegCommand = input.ffmpegCommand ?? "ffmpeg";

  return new Promise((resolvePromise, reject) => {
    const chunks: Buffer[] = [];
    const child = spawn(
      ffmpegCommand,
      [
        "-hide_banner",
        "-loglevel",
        "error",
        "-i",
        input.assetPath,
        "-vf",
        `scale=${sampleSize}:${sampleSize}:flags=area,format=rgb24`,
        "-frames:v",
        "1",
        "-f",
        "rawvideo",
        "pipe:1"
      ],
      { stdio: ["ignore", "pipe", "pipe"] }
    );

    let stderr = "";
    child.stdout?.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
    });
    child.stderr?.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolvePromise(Buffer.concat(chunks));
      else reject(new Error(`ffmpeg visual sample exited ${code}: ${stderr.slice(-500)}`));
    });
  });
}

export async function analyzeComicsPanelVisual(
  input: ComicsPanelVisualAnalysisInput
): Promise<ComicsPanelVisualVerdict> {
  if (!(await fileExists(input.assetPath))) {
    return {
      analyzable: false,
      eligible: true,
      rejectReason: null,
      duoVisualScore: 0,
      visualTags: [],
      profile: null,
      warnings: ["visual_analysis_asset_missing"]
    };
  }

  if (!/\.(jpe?g|png|webp|gif|avif)$/i.test(input.assetPath)) {
    return {
      analyzable: false,
      eligible: true,
      rejectReason: null,
      duoVisualScore: 0,
      visualTags: [],
      profile: null,
      warnings: ["visual_analysis_non_raster"]
    };
  }

  try {
    const pixels = await readRasterPixelsViaFfmpeg(input);
    const profile = analyzePixelBuffer(pixels, input.sampleSize ?? COMICS_PANEL_VISUAL_SAMPLE_SIZE);
    if (!profile) {
      return {
        analyzable: false,
        eligible: true,
        rejectReason: null,
        duoVisualScore: 0,
        visualTags: [],
        profile: null,
        warnings: ["visual_analysis_empty_sample"]
      };
    }
    return evaluateComicsPanelVisualProfile(profile);
  } catch (error) {
    return {
      analyzable: false,
      eligible: true,
      rejectReason: null,
      duoVisualScore: 0,
      visualTags: [],
      profile: null,
      warnings: [
        `visual_analysis_failed:${error instanceof Error ? error.message : "unknown"}`
      ]
    };
  }
}

export async function analyzeComicsPanelVisualBatch<T extends { assetPath: string }>(
  items: T[],
  options?: { ffmpegCommand?: string; concurrency?: number }
): Promise<Map<string, ComicsPanelVisualVerdict>> {
  const concurrency = Math.max(1, options?.concurrency ?? 4);
  const results = new Map<string, ComicsPanelVisualVerdict>();
  let cursor = 0;

  async function worker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      const item = items[index];
      if (!item) continue;
      const verdict = await analyzeComicsPanelVisual({
        assetPath: item.assetPath,
        ...(options?.ffmpegCommand ? { ffmpegCommand: options.ffmpegCommand } : {})
      });
      results.set(item.assetPath, verdict);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
  return results;
}