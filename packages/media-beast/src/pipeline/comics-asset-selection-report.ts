import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  HOOK_CLIMAX_MIN_SCORE,
  INSUFFICIENT_TRUE_COMICS_ASSETS,
  isTrueComicsAssetCategory,
  MIN_TRUE_COMICS_ASSETS,
  type ComicsAssetCategory,
  type ComicsAssetQualityResult
} from "./comics-asset-quality-gate.js";
import type { RemixAssetLike } from "./remix-visual-asset-selector.js";

export type ComicsAssetSelectionEntry = {
  id: string;
  title: string;
  sourceUrl?: string | null;
  score: number;
  category: ComicsAssetCategory;
  usedInScenes: string[];
  positiveSignals: string[];
  negativeSignals?: string[];
  rejectReason?: string;
};

export type ComicsAssetSelectionReport = {
  query: string;
  domain: "comics_superhero";
  acceptedAssets: ComicsAssetSelectionEntry[];
  rejectedAssets: ComicsAssetSelectionEntry[];
  hookAsset: ComicsAssetSelectionEntry | null;
  climaxAsset: ComicsAssetSelectionEntry | null;
  warnings: string[];
  canRender: boolean;
  blockReason: string | null;
  minGoodAssets: number;
  acceptedPremiumCount: number;
};

export type BuildComicsAssetSelectionReportInput = {
  entities: string[];
  candidates: Array<{
    asset: RemixAssetLike;
    quality: ComicsAssetQualityResult;
    sourceUrl?: string | null;
  }>;
  sceneAssignments: Map<string, string[]>;
  hookAssetId: string | null;
  climaxAssetId: string | null;
};

function toEntry(
  asset: RemixAssetLike,
  quality: ComicsAssetQualityResult,
  sourceUrl?: string | null,
  usedInScenes: string[] = []
): ComicsAssetSelectionEntry {
  const entry: ComicsAssetSelectionEntry = {
    id: asset.id,
    title: asset.title,
    sourceUrl: sourceUrl ?? asset.sourceUrl ?? null,
    score: quality.score,
    category: quality.category,
    usedInScenes,
    positiveSignals: quality.positiveSignals,
    negativeSignals: quality.negativeSignals
  };
  if (quality.rejectReason) {
    entry.rejectReason = quality.rejectReason;
  }
  return entry;
}

export function buildComicsAssetSelectionReport(
  input: BuildComicsAssetSelectionReportInput
): ComicsAssetSelectionReport {
  const acceptedAssets: ComicsAssetSelectionEntry[] = [];
  const rejectedAssets: ComicsAssetSelectionEntry[] = [];

  for (const candidate of input.candidates) {
    const usedInScenes = input.sceneAssignments.get(candidate.asset.id) ?? [];
    const entry = toEntry(
      candidate.asset,
      candidate.quality,
      candidate.sourceUrl,
      usedInScenes
    );
    if (candidate.quality.ok) {
      acceptedAssets.push(entry);
    } else {
      rejectedAssets.push(entry);
    }
  }

  const hookAsset =
    input.hookAssetId != null
      ? acceptedAssets.find((entry) => entry.id === input.hookAssetId) ?? null
      : null;
  const climaxAsset =
    input.climaxAssetId != null
      ? acceptedAssets.find((entry) => entry.id === input.climaxAssetId) ?? null
      : null;

  const isPremiumEntry = (entry: ComicsAssetSelectionEntry | null): boolean =>
    Boolean(
      entry &&
        entry.score >= HOOK_CLIMAX_MIN_SCORE &&
        isTrueComicsAssetCategory(entry.category)
    );

  const trueComicsCount = acceptedAssets.filter((entry) =>
    isTrueComicsAssetCategory(entry.category)
  ).length;
  const acceptedPremiumCount = acceptedAssets.filter((entry) => isPremiumEntry(entry)).length;
  const warnings: string[] = [];
  let canRender = true;
  let blockReason: string | null = null;

  if (trueComicsCount < MIN_TRUE_COMICS_ASSETS) {
    canRender = false;
    blockReason = INSUFFICIENT_TRUE_COMICS_ASSETS;
    warnings.push(`true_comics_assets_below_minimum:${trueComicsCount}/${MIN_TRUE_COMICS_ASSETS}`);
  } else if (acceptedAssets.length < 3) {
    canRender = false;
    blockReason = "insufficient_high_quality_comics_assets";
    warnings.push(`accepted_assets_below_minimum:${acceptedAssets.length}/3`);
  }
  if (!hookAsset) {
    canRender = false;
    blockReason = blockReason ?? "insufficient_high_quality_comics_assets";
    warnings.push("hook_asset_missing_or_below_threshold");
  } else if (!isPremiumEntry(hookAsset)) {
    canRender = false;
    blockReason = blockReason ?? "insufficient_high_quality_comics_assets";
    warnings.push(
      `hook_asset_not_premium:score_${hookAsset.score}_category_${hookAsset.category}`
    );
  }
  if (!climaxAsset) {
    canRender = false;
    blockReason = blockReason ?? "insufficient_high_quality_comics_assets";
    warnings.push("climax_asset_missing_or_below_threshold");
  } else if (!isPremiumEntry(climaxAsset)) {
    canRender = false;
    blockReason = blockReason ?? "insufficient_high_quality_comics_assets";
    warnings.push(
      `climax_asset_not_premium:score_${climaxAsset.score}_category_${climaxAsset.category}`
    );
  }

  return {
    query: input.entities.join(" "),
    domain: "comics_superhero",
    acceptedAssets,
    rejectedAssets,
    hookAsset,
    climaxAsset,
    warnings,
    canRender,
    blockReason,
    minGoodAssets: 3,
    acceptedPremiumCount
  };
}

export async function saveComicsAssetSelectionReport(
  report: ComicsAssetSelectionReport,
  projectRoot?: string
): Promise<string> {
  const root = projectRoot ?? process.cwd();
  const outputPath = join(root, "tmp", "comics-asset-selection-report.json");
  await writeFile(outputPath, JSON.stringify(report, null, 2), "utf8");
  return outputPath;
}