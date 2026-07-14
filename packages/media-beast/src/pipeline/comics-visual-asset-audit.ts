import { spawn } from "node:child_process";
import { constants } from "node:fs";
import { access, mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import type { ComicsAssetSelectionEntry, ComicsAssetSelectionReport } from "./comics-asset-selection-report.js";
import {
  detectForbiddenVisualAuditReason,
  HOOK_CLIMAX_MIN_SCORE,
  INSUFFICIENT_TRUE_COMICS_ASSETS,
  isTrueComicsAssetCategory,
  MIN_TRUE_COMICS_ASSETS,
  TRUE_COMICS_TIMELINE_CATEGORIES,
  type ComicsAssetCategory
} from "./comics-asset-quality-gate.js";
import type { MaterializedTimelineScene } from "./remix-materialization.js";
import type { RemixAssetLike } from "./remix-visual-asset-selector.js";

export type VisualAuditStatus = "accepted" | "rejected" | "needs_manual_review";

export type VisualAssetAuditEntry = {
  id: string;
  title: string;
  category: ComicsAssetCategory | string;
  score: number;
  assetPath: string | null;
  usedInScenes: string[];
  visualAuditStatus: VisualAuditStatus;
  visualRejectReason: string | null;
};

export type ComicsVisualAssetAuditReport = {
  selectedAssets: VisualAssetAuditEntry[];
  rejectedAfterVisualAudit: VisualAssetAuditEntry[];
  trueComicsAssetCount: number;
  forbiddenAssetCount: number;
  hasForbiddenTerms: boolean;
  hookPremium: boolean;
  climaxPremium: boolean;
  contactSheetPath: string | null;
  canRender: boolean;
  blockReason: string | null;
  warnings: string[];
};

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function runFfmpeg(command: string, args: string[]): Promise<void> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { shell: false, stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr?.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolvePromise();
      else reject(new Error(`ffmpeg exited with code ${code}: ${stderr.slice(-500)}`));
    });
  });
}

export async function renderSelectedAssetsContactSheet(input: {
  assetPaths: string[];
  outputPath: string;
  ffmpegCommand?: string;
}): Promise<string | null> {
  const rasterPaths: string[] = [];
  for (const assetPath of input.assetPaths) {
    if (!assetPath) continue;
    if (!/\.(jpe?g|png|webp|gif|avif)$/i.test(assetPath)) continue;
    if (await fileExists(assetPath)) rasterPaths.push(assetPath);
  }

  if (rasterPaths.length === 0) return null;

  await mkdir(dirname(input.outputPath), { recursive: true });
  const ffmpegCommand = input.ffmpegCommand ?? "ffmpeg";
  const listPath = `${input.outputPath}.list.txt`;
  const escaped = rasterPaths.map((path) => `file '${path.replace(/'/g, "'\\''")}'`).join("\n");
  await writeFile(listPath, escaped, "utf8");

  try {
    await runFfmpeg(ffmpegCommand, [
      "-y",
      "-hide_banner",
      "-loglevel",
      "error",
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      listPath,
      "-vf",
      "scale=320:320:force_original_aspect_ratio=decrease,pad=320:320:(ow-iw)/2:(oh-ih)/2:color=black,tile=4x3",
      "-frames:v",
      "1",
      input.outputPath
    ]);
    return resolve(input.outputPath);
  } catch {
    return null;
  }
}

function isPremiumTimelineEntry(entry: ComicsAssetSelectionEntry | null): boolean {
  return Boolean(
    entry &&
      entry.score >= HOOK_CLIMAX_MIN_SCORE &&
      TRUE_COMICS_TIMELINE_CATEGORIES.includes(entry.category)
  );
}

export function buildComicsVisualAssetAuditReport(input: {
  timelineScenes: MaterializedTimelineScene[];
  assetById: Map<string, RemixAssetLike>;
  selectionReport: ComicsAssetSelectionReport | null;
  contactSheetPath?: string | null;
}): ComicsVisualAssetAuditReport {
  const usageByAssetId = new Map<string, { scenes: string[]; assetPath: string | null }>();

  for (const scene of input.timelineScenes) {
    if (!scene.assetId || !scene.assetPath) continue;
    const current = usageByAssetId.get(scene.assetId) ?? { scenes: [], assetPath: scene.assetPath };
    current.scenes.push(scene.sceneId);
    current.assetPath = scene.assetPath;
    usageByAssetId.set(scene.assetId, current);
  }

  const selectedAssets: VisualAssetAuditEntry[] = [];
  const rejectedAfterVisualAudit: VisualAssetAuditEntry[] = [];

  for (const [assetId, usage] of usageByAssetId.entries()) {
    const asset = input.assetById.get(assetId);
    const selectionEntry =
      input.selectionReport?.acceptedAssets.find((entry) => entry.id === assetId) ?? null;
    const title = asset?.title ?? selectionEntry?.title ?? assetId;
    const category = selectionEntry?.category ?? "unknown";
    const score = selectionEntry?.score ?? asset?.comicsQuality?.score ?? 0;
    const forbiddenReason = detectForbiddenVisualAuditReason(
      [
        title,
        asset?.purpose,
        asset?.sourceUrl,
        asset?.query,
        selectionEntry?.positiveSignals?.join(" ")
      ]
        .filter(Boolean)
        .join(" ")
    );
    const notTrueComics = !isTrueComicsAssetCategory(category as ComicsAssetCategory);

    let visualAuditStatus: VisualAuditStatus = "accepted";
    let visualRejectReason: string | null = null;

    if (forbiddenReason) {
      visualAuditStatus = "rejected";
      visualRejectReason = forbiddenReason;
    } else if (notTrueComics) {
      visualAuditStatus = "rejected";
      visualRejectReason = "category_not_true_comics";
    } else if (score < HOOK_CLIMAX_MIN_SCORE && usage.scenes.length >= 8) {
      visualAuditStatus = "needs_manual_review";
      visualRejectReason = "low_score_heavy_usage";
    }

    const entry: VisualAssetAuditEntry = {
      id: assetId,
      title,
      category,
      score,
      assetPath: usage.assetPath,
      usedInScenes: usage.scenes,
      visualAuditStatus,
      visualRejectReason
    };

    if (visualAuditStatus === "rejected") {
      rejectedAfterVisualAudit.push(entry);
    } else {
      selectedAssets.push(entry);
    }
  }

  const trueComicsAssetCount = selectedAssets.filter(
    (entry) =>
      entry.visualAuditStatus !== "rejected" &&
      isTrueComicsAssetCategory(entry.category as ComicsAssetCategory)
  ).length;

  const forbiddenAssetCount = rejectedAfterVisualAudit.length;
  const hasForbiddenTerms = forbiddenAssetCount > 0;
  const hookPremium = isPremiumTimelineEntry(input.selectionReport?.hookAsset ?? null);
  const climaxPremium = isPremiumTimelineEntry(input.selectionReport?.climaxAsset ?? null);

  const warnings: string[] = [];
  let canRender = true;
  let blockReason: string | null = null;

  if (trueComicsAssetCount < MIN_TRUE_COMICS_ASSETS) {
    canRender = false;
    blockReason = INSUFFICIENT_TRUE_COMICS_ASSETS;
    warnings.push(`true_comics_asset_count_below_minimum:${trueComicsAssetCount}/${MIN_TRUE_COMICS_ASSETS}`);
  }
  if (hasForbiddenTerms) {
    canRender = false;
    blockReason = blockReason ?? "forbidden_visual_assets_in_timeline";
    warnings.push(`forbidden_visual_assets_detected:${forbiddenAssetCount}`);
  }
  if (!hookPremium) {
    canRender = false;
    blockReason = blockReason ?? INSUFFICIENT_TRUE_COMICS_ASSETS;
    warnings.push("hook_not_true_premium_comics_asset");
  }
  if (!climaxPremium) {
    canRender = false;
    blockReason = blockReason ?? INSUFFICIENT_TRUE_COMICS_ASSETS;
    warnings.push("climax_not_true_premium_comics_asset");
  }
  if (selectedAssets.some((entry) => entry.visualAuditStatus === "needs_manual_review")) {
    canRender = false;
    blockReason = blockReason ?? "visual_asset_audit_needs_manual_review";
    warnings.push("selected_assets_need_manual_visual_review");
  }
  if (!input.contactSheetPath) {
    canRender = false;
    blockReason = blockReason ?? "no_raster_contact_sheet_available";
    warnings.push("no_raster_assets_for_visual_contact_sheet");
  }

  return {
    selectedAssets: [...selectedAssets, ...rejectedAfterVisualAudit],
    rejectedAfterVisualAudit,
    trueComicsAssetCount,
    forbiddenAssetCount,
    hasForbiddenTerms,
    hookPremium,
    climaxPremium,
    contactSheetPath: input.contactSheetPath ?? null,
    canRender,
    blockReason,
    warnings
  };
}

export async function saveComicsVisualAssetAuditReport(
  report: ComicsVisualAssetAuditReport,
  projectRoot?: string
): Promise<string> {
  const root = projectRoot ?? process.cwd();
  const outputPath = join(root, "tmp", "variation-b-visual-asset-audit.json");
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, JSON.stringify(report, null, 2), "utf8");
  return outputPath;
}

export async function runComicsVisualAssetAudit(input: {
  timelineScenes: MaterializedTimelineScene[];
  assetById: Map<string, RemixAssetLike>;
  selectionReport: ComicsAssetSelectionReport | null;
  projectRoot?: string;
  ffmpegCommand?: string;
}): Promise<{ report: ComicsVisualAssetAuditReport; reportPath: string; contactSheetPath: string | null }> {
  const root = input.projectRoot ?? process.cwd();
  const uniquePaths = [
    ...new Set(
      input.timelineScenes
        .map((scene) => scene.assetPath)
        .filter((path): path is string => Boolean(path))
    )
  ];

  const contactSheetPath = await renderSelectedAssetsContactSheet({
    assetPaths: uniquePaths,
    outputPath: join(root, "tmp", "variation-b-selected-assets-contact-sheet.jpg"),
    ...(input.ffmpegCommand ? { ffmpegCommand: input.ffmpegCommand } : {})
  });

  const report = buildComicsVisualAssetAuditReport({
    timelineScenes: input.timelineScenes,
    assetById: input.assetById,
    selectionReport: input.selectionReport,
    contactSheetPath
  });
  const reportPath = await saveComicsVisualAssetAuditReport(report, root);
  return { report, reportPath, contactSheetPath };
}