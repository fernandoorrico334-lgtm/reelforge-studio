import { writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import {
  isBeatThemeAligned,
  scoreAssetForThemedSelection,
  type ComicsThemeAnalysis
} from "./comics-theme-intelligence.js";
import {
  isPremiumComicsPlaceholderAsset,
  MIN_PUBLISH_UNIQUE_ASSETS
} from "./comics-premium-placeholder-assets.js";
import {
  INSUFFICIENT_THEME_ALIGNED_ASSETS,
  isTextHeavyComicsAsset,
  validateComicsAssetForTheme
} from "./comics-theme-asset-validator.js";
import {
  MAX_DOMINANT_ASSET_RATIO,
  MAX_STATIC_SEGMENT_SEC,
  MIN_VISUAL_SEGMENTS,
  RENDER_NOT_READY_INSUFFICIENT_VISUAL_DIVERSITY
} from "./remix-asset-rotation.js";
import { renderSelectedAssetsContactSheet } from "./comics-visual-asset-audit.js";
import type { RemixMaterializationReport } from "./remix-materialization.js";

export { isTextHeavyComicsAsset, validateComicsAssetForTheme } from "./comics-theme-asset-validator.js";
export {
  filterRasterPanelsForComicsTheme,
  filterComicsAssetsForTheme,
  INSUFFICIENT_THEME_ALIGNED_ASSETS
} from "./comics-theme-asset-validator.js";
export {
  RENDER_NOT_READY_INSUFFICIENT_VISUAL_DIVERSITY,
  INSUFFICIENT_THEME_ALIGNED_VISUAL_DIVERSITY
} from "./remix-asset-rotation.js";

export const NOT_READY_FOR_PUBLICATION = "not_ready_for_publication";
export const PLACEHOLDER_FORBIDDEN_IN_PUBLISH = "placeholder_assets_forbidden";
export const BLANK_VISUAL_RATIO_EXCEEDED = "blank_visual_ratio_exceeded";
export const REAL_ASSET_DURATION_RATIO_LOW = "real_asset_duration_ratio_low";
export const MIN_ON_THEME_RATIO = 0.85;
export const MIN_CAPTION_MATERIALIZATION_RATE = 0.9;
export const COMICS_PUBLISH_CAPTION_STYLE = "comic_pop";

export function isPublishOffThemeAsset(input: {
  assetTitle?: string | null;
  assetDescription?: string | null;
  assetTags?: string[];
  themeAnalysis: ComicsThemeAnalysis;
  narrationText: string;
  videoTitle?: string;
}): { offTheme: boolean; reason: string | null } {
  const verdict = validateComicsAssetForTheme({
    assetTitle: input.assetTitle ?? null,
    assetDescription: input.assetDescription ?? null,
    ...(input.assetTags ? { assetTags: input.assetTags } : {}),
    themeAnalysis: input.themeAnalysis,
    narrationText: input.narrationText,
    videoTitle: input.videoTitle ?? ""
  });
  if (verdict.severity === "reject") {
    return { offTheme: true, reason: verdict.reason };
  }
  return { offTheme: false, reason: null };
}

function normalizeSceneRole(role: string): string {
  return role.replace(/_\d+$/, "");
}

function isHookRole(role: string): boolean {
  return normalizeSceneRole(role) === "hook";
}

function isClimaxRole(role: string): boolean {
  const base = normalizeSceneRole(role);
  return base === "climax" || base === "climax_setup";
}

function isMainTimelineRole(role: string): boolean {
  const base = normalizeSceneRole(role);
  // Fast-cut micro segments reuse roles like "outro" across the full timeline — only
  // loop_closing is excluded from publish-readiness checks.
  return base !== "loop_closing";
}

export function validateThemeAlignedTimeline(input: {
  videoTitle: string;
  narrationText: string;
  themeAnalysis: ComicsThemeAnalysis;
  timelineScenes: Array<{
    sceneId: string;
    role: string;
    startSec: number;
    endSec: number;
    assetId?: string | null;
    assetTitle?: string | null;
    assetDescription?: string | null;
    assetTags?: string[];
    caption?: string | null;
    assetCategory?: string;
    assetQualityScore?: number;
  }>;
}): {
  ok: boolean;
  offThemeScenes: Array<{ sceneId: string; assetTitle: string; reason: string }>;
  onThemeRatio: number;
  hookAligned: boolean;
  climaxAligned: boolean;
  warnings: string[];
} {
  const warnings: string[] = [];
  const offThemeScenes: Array<{ sceneId: string; assetTitle: string; reason: string }> = [];
  let onThemeCount = 0;
  let mainCount = 0;
  let hookSceneCount = 0;
  let hookBeatAlignedCount = 0;
  let climaxSceneCount = 0;
  let climaxBeatAlignedCount = 0;

  for (const scene of input.timelineScenes) {
    if (!isMainTimelineRole(scene.role)) continue;
    mainCount += 1;

    const assetTitle = scene.assetTitle ?? scene.sceneId;
    const assetId = scene.assetId ?? assetTitle;

    if (isPremiumComicsPlaceholderAsset({ id: assetId })) {
      onThemeCount += 1;
      if (isHookRole(scene.role)) {
        hookSceneCount += 1;
        hookBeatAlignedCount += 1;
      }
      if (isClimaxRole(scene.role)) {
        climaxSceneCount += 1;
        climaxBeatAlignedCount += 1;
      }
      continue;
    }

    const offTheme = isPublishOffThemeAsset({
      assetTitle: scene.assetTitle ?? null,
      assetDescription: scene.assetDescription ?? null,
      ...(scene.assetTags ? { assetTags: scene.assetTags } : {}),
      themeAnalysis: input.themeAnalysis,
      narrationText: input.narrationText,
      videoTitle: input.videoTitle
    });

    if (offTheme.offTheme) {
      offThemeScenes.push({
        sceneId: scene.sceneId,
        assetTitle,
        reason: offTheme.reason ?? "off_theme"
      });
      continue;
    }

    const themed = scoreAssetForThemedSelection({
      id: scene.sceneId,
      title: assetTitle,
      description: scene.assetDescription ?? "",
      category: (scene.assetCategory as "comic_panel") ?? "unknown",
      assetQualityScore: scene.assetQualityScore ?? 70,
      themeAnalysis: input.themeAnalysis
    });

    if (
      themed.relevance === "reject" ||
      themed.relevance === "generic_entity_match" ||
      themed.themeMatchScore < 28
    ) {
      offThemeScenes.push({
        sceneId: scene.sceneId,
        assetTitle,
        reason: `weak_theme_match:${themed.reason}`
      });
      continue;
    }

    onThemeCount += 1;

    if (isHookRole(scene.role)) {
      hookSceneCount += 1;
      if (
        isBeatThemeAligned({
          asset: themed,
          beatRole: "hook",
          themeAnalysis: input.themeAnalysis
        })
      ) {
        hookBeatAlignedCount += 1;
      }
    }
    if (isClimaxRole(scene.role)) {
      climaxSceneCount += 1;
      if (
        isBeatThemeAligned({
          asset: themed,
          beatRole: "climax",
          themeAnalysis: input.themeAnalysis
        })
      ) {
        climaxBeatAlignedCount += 1;
      }
    }
  }

  if (mainCount === 0) {
    warnings.push("no_main_timeline_scenes");
  }

  const hookOffThemeCount = offThemeScenes.filter((entry) => {
    const scene = input.timelineScenes.find((s) => s.sceneId === entry.sceneId);
    return scene && isHookRole(scene.role);
  }).length;
  const climaxOffThemeCount = offThemeScenes.filter((entry) => {
    const scene = input.timelineScenes.find((s) => s.sceneId === entry.sceneId);
    return scene && isClimaxRole(scene.role);
  }).length;

  const hookAligned =
    hookSceneCount > 0 && hookOffThemeCount === 0 && hookBeatAlignedCount > 0;
  const climaxAligned =
    climaxSceneCount > 0 && climaxOffThemeCount === 0 && climaxBeatAlignedCount > 0;

  if (hookSceneCount > 0 && !hookAligned) {
    warnings.push("hook_window_not_theme_aligned");
  }
  if (climaxSceneCount > 0 && !climaxAligned) {
    warnings.push("climax_window_not_theme_aligned");
  }

  const onThemeRatio = mainCount > 0 ? Number((onThemeCount / mainCount).toFixed(4)) : 0;
  const ok =
    offThemeScenes.length === 0 &&
    onThemeRatio >= MIN_ON_THEME_RATIO &&
    hookAligned &&
    climaxAligned;

  if (onThemeRatio < MIN_ON_THEME_RATIO) {
    warnings.push(`on_theme_ratio_below_minimum:${onThemeRatio}<${MIN_ON_THEME_RATIO}`);
  }
  if (offThemeScenes.length > 0) {
    warnings.push(`off_theme_scenes_detected:${offThemeScenes.length}`);
  }

  return { ok, offThemeScenes, onThemeRatio, hookAligned, climaxAligned, warnings };
}

export function validateCaptionMaterialization(input: {
  timelineScenes: Array<{
    sceneId: string;
    role: string;
    caption?: string | null;
    captionStyle?: string | null;
  }>;
  targetStyle: string;
}): {
  ok: boolean;
  captionMaterializationRate: number;
  missingCaptionScenes: string[];
  wrongStyleScenes: string[];
  warnings: string[];
} {
  const warnings: string[] = [];
  const expectedStyle = input.targetStyle === "comics" ? COMICS_PUBLISH_CAPTION_STYLE : input.targetStyle;
  const mainScenes = input.timelineScenes.filter((scene) => isMainTimelineRole(scene.role));
  const missingCaptionScenes: string[] = [];
  const wrongStyleScenes: string[] = [];

  let captioned = 0;
  for (const scene of mainScenes) {
    const caption = scene.caption?.trim() ?? "";
    if (caption.length > 0) captioned += 1;
    else missingCaptionScenes.push(scene.sceneId);

    const style = scene.captionStyle ?? expectedStyle;
    if (input.targetStyle === "comics" && style !== COMICS_PUBLISH_CAPTION_STYLE) {
      wrongStyleScenes.push(scene.sceneId);
    }
  }

  const hookMissing = mainScenes
    .filter((s) => isHookRole(s.role))
    .some((s) => !(s.caption?.trim()));
  const climaxMissing = mainScenes
    .filter((s) => isClimaxRole(s.role))
    .some((s) => !(s.caption?.trim()));

  const captionMaterializationRate =
    mainScenes.length > 0 ? Number((captioned / mainScenes.length).toFixed(4)) : 0;

  if (captionMaterializationRate < MIN_CAPTION_MATERIALIZATION_RATE) {
    warnings.push(
      `caption_materialization_rate_below_minimum:${captionMaterializationRate}<${MIN_CAPTION_MATERIALIZATION_RATE}`
    );
  }
  if (hookMissing) warnings.push("hook_missing_caption");
  if (climaxMissing) warnings.push("climax_missing_caption");
  if (wrongStyleScenes.length > 0) warnings.push(`wrong_caption_style:${wrongStyleScenes.length}`);

  const ok =
    captionMaterializationRate >= MIN_CAPTION_MATERIALIZATION_RATE &&
    wrongStyleScenes.length === 0 &&
    !hookMissing &&
    !climaxMissing;

  return {
    ok,
    captionMaterializationRate,
    missingCaptionScenes,
    wrongStyleScenes,
    warnings
  };
}

export type ComicsVisualDiversityReport = {
  uniqueAssetCount: number;
  minimumUniqueAssetCount: number;
  dominantAssetRatio: number;
  longestStaticSegmentSec: number;
  visualSegmentCount: number;
  ok: boolean;
};

export type ComicsPlaceholderUsageReport = {
  used: boolean;
  count: number;
  placeholders: string[];
};

export type ComicsReadinessFlags = {
  canRender: boolean;
  narrativeReady: boolean;
  captionReady: boolean;
  canPublish: boolean;
  publishBlockReason: string | null;
  renderBlockReason: string | null;
  visualDiversity: ComicsVisualDiversityReport;
  placeholderUsage: ComicsPlaceholderUsageReport;
};

export type ComicsPublishReadinessReport = {
  variation: string;
  canRender: boolean;
  narrativeReady: boolean;
  captionReady: boolean;
  canPublish: boolean;
  publishBlockReason: string | null;
  renderBlockReason: string | null;
  theme: {
    primaryTheme: string;
    relationshipType: string;
    requiredSignals: string[];
    disallowedSignals: string[];
  };
  themeAlignment: {
    onThemeRatio: number;
    offThemeScenes: Array<{ sceneId: string; assetTitle: string; reason: string }>;
    hookAligned: boolean;
    climaxAligned: boolean;
  };
  captionMaterialization: {
    captionMaterializationRate: number;
    missingCaptionScenes: string[];
    wrongStyleScenes: string[];
  };
  timelineScenes: Array<{
    sceneId: string;
    role: string;
    startSec: number;
    endSec: number;
    assetTitle: string;
    themeAligned: boolean;
    caption: string;
    captionStyle: string;
    publishReady: boolean;
    warnings: string[];
  }>;
  recommendation: string;
  contactSheetPath: string | null;
  generatedAt: string;
  cache: {
    used: boolean;
    invalidatedOffThemeAssets: string[];
  };
  bypassRoutesBlocked: string[];
  visualDiversity: ComicsVisualDiversityReport;
  placeholderUsage: ComicsPlaceholderUsageReport;
};

export function evaluateComicsVisualDiversity(input: {
  uniqueAssetCount: number;
  dominantAssetRatio: number;
  longestStaticSegmentSec: number;
  visualSegmentCount: number;
  minimumUniqueAssetCount?: number;
}): ComicsVisualDiversityReport {
  const minimumUniqueAssetCount = input.minimumUniqueAssetCount ?? MIN_PUBLISH_UNIQUE_ASSETS;
  const ok =
    input.uniqueAssetCount >= minimumUniqueAssetCount &&
    input.dominantAssetRatio <= MAX_DOMINANT_ASSET_RATIO &&
    input.longestStaticSegmentSec <= MAX_STATIC_SEGMENT_SEC &&
    input.visualSegmentCount >= MIN_VISUAL_SEGMENTS;

  return {
    uniqueAssetCount: input.uniqueAssetCount,
    minimumUniqueAssetCount,
    dominantAssetRatio: input.dominantAssetRatio,
    longestStaticSegmentSec: input.longestStaticSegmentSec,
    visualSegmentCount: input.visualSegmentCount,
    ok
  };
}

export function evaluateUserProvidedRealAssetGates(input: {
  placeholderCount: number;
  blankVisualRatio: number;
  realAssetDurationRatio: number;
  uniqueRenderedCompositionCount: number;
  dominantRenderedCompositionRatio: number;
}): { ok: boolean; publishBlockReason: string | null } {
  if (input.placeholderCount > 0) {
    return { ok: false, publishBlockReason: PLACEHOLDER_FORBIDDEN_IN_PUBLISH };
  }
  if (input.blankVisualRatio > 0.05) {
    return { ok: false, publishBlockReason: BLANK_VISUAL_RATIO_EXCEEDED };
  }
  if (input.realAssetDurationRatio < 0.95) {
    return { ok: false, publishBlockReason: REAL_ASSET_DURATION_RATIO_LOW };
  }
  if (input.uniqueRenderedCompositionCount < MIN_PUBLISH_UNIQUE_ASSETS) {
    return { ok: false, publishBlockReason: "insufficient_unique_compositions" };
  }
  if (input.dominantRenderedCompositionRatio > MAX_DOMINANT_ASSET_RATIO) {
    return { ok: false, publishBlockReason: "dominant_composition_ratio_exceeded" };
  }
  return { ok: true, publishBlockReason: null };
}

export function evaluateComicsReadinessFlags(input: {
  sourceFootprintOk: boolean;
  materializationOk: boolean;
  themeAlignment: ReturnType<typeof validateThemeAlignedTimeline>;
  captionMaterialization: ReturnType<typeof validateCaptionMaterialization>;
  visualDiversity: ComicsVisualDiversityReport;
  renderBlockReason?: string | null;
  placeholderUsage?: ComicsPlaceholderUsageReport;
  userProvidedRealAssetGates?: ReturnType<typeof evaluateUserProvidedRealAssetGates>;
}): ComicsReadinessFlags {
  const narrativeReady =
    input.themeAlignment.ok &&
    input.themeAlignment.offThemeScenes.length === 0 &&
    input.themeAlignment.hookAligned &&
    input.themeAlignment.climaxAligned;

  const captionReady = input.captionMaterialization.ok;

  const visualDiversityOk = input.visualDiversity.ok;
  let renderBlockReason = input.renderBlockReason ?? null;
  if (!visualDiversityOk) {
    renderBlockReason = "insufficient_visual_diversity";
  }

  const canRender =
    input.sourceFootprintOk && input.materializationOk && visualDiversityOk;

  let canPublish = canRender && narrativeReady && captionReady;
  let publishBlockReason: string | null = null;

  if (!narrativeReady) {
    canPublish = false;
    publishBlockReason =
      input.themeAlignment.offThemeScenes.length > 0
        ? `off_theme_timeline:${input.themeAlignment.offThemeScenes.length}`
        : !input.themeAlignment.hookAligned
          ? "hook_not_theme_aligned"
          : !input.themeAlignment.climaxAligned
            ? "climax_not_theme_aligned"
            : `on_theme_ratio_low:${input.themeAlignment.onThemeRatio}`;
  } else if (!captionReady) {
    canPublish = false;
    publishBlockReason = "captions_not_materialized";
  } else if (!canRender) {
    canPublish = false;
    publishBlockReason = RENDER_NOT_READY_INSUFFICIENT_VISUAL_DIVERSITY;
    if (!renderBlockReason) {
      renderBlockReason = "insufficient_visual_diversity";
    }
  } else if (input.renderBlockReason === INSUFFICIENT_THEME_ALIGNED_ASSETS) {
    canPublish = false;
    publishBlockReason = INSUFFICIENT_THEME_ALIGNED_ASSETS;
    renderBlockReason = INSUFFICIENT_THEME_ALIGNED_ASSETS;
  } else if (input.userProvidedRealAssetGates && !input.userProvidedRealAssetGates.ok) {
    canPublish = false;
    publishBlockReason = input.userProvidedRealAssetGates.publishBlockReason;
  } else if (
    input.placeholderUsage &&
    input.placeholderUsage.count > 0 &&
    input.userProvidedRealAssetGates
  ) {
    canPublish = false;
    publishBlockReason = PLACEHOLDER_FORBIDDEN_IN_PUBLISH;
  }

  return {
    canRender,
    narrativeReady,
    captionReady,
    canPublish,
    publishBlockReason,
    renderBlockReason: canRender ? null : renderBlockReason,
    visualDiversity: input.visualDiversity,
    placeholderUsage: input.placeholderUsage ?? { used: false, count: 0, placeholders: [] }
  };
}

export function evaluateComicsPublishReadiness(input: {
  variation: string;
  targetStyle: string;
  videoTitle: string;
  narrationText: string;
  themeAnalysis: ComicsThemeAnalysis;
  canRender: boolean;
  renderBlockReason?: string | null;
  sourceFootprintOk?: boolean;
  materializationOk?: boolean;
  visualDiversity?: ComicsVisualDiversityReport;
  placeholderUsage?: ComicsPlaceholderUsageReport;
  timelineScenes: Array<{
    sceneId: string;
    role: string;
    startSec: number;
    endSec: number;
    assetId?: string | null;
    assetTitle?: string | null;
    assetDescription?: string | null;
    assetTags?: string[];
    caption?: string | null;
    captionStyle?: string | null;
    assetCategory?: string;
    assetQualityScore?: number;
    assetPath?: string | null;
  }>;
}): ComicsPublishReadinessReport {
  const themeAlignment = validateThemeAlignedTimeline({
    videoTitle: input.videoTitle,
    narrationText: input.narrationText,
    themeAnalysis: input.themeAnalysis,
    timelineScenes: input.timelineScenes
  });

  const captionMaterialization = validateCaptionMaterialization({
    timelineScenes: input.timelineScenes.map((scene) => ({
      sceneId: scene.sceneId,
      role: scene.role,
      caption: scene.caption ?? null,
      captionStyle: scene.captionStyle ?? COMICS_PUBLISH_CAPTION_STYLE
    })),
    targetStyle: input.targetStyle
  });

  const offThemeByScene = new Map(themeAlignment.offThemeScenes.map((s) => [s.sceneId, s.reason]));
  const timelineReport = input.timelineScenes.map((scene) => {
    const offReason = offThemeByScene.get(scene.sceneId);
    const sceneWarnings: string[] = [];
    if (offReason) sceneWarnings.push(offReason);
    if (!(scene.caption?.trim())) sceneWarnings.push("missing_caption");

    const themeAligned = !offReason;
    const publishReady =
      themeAligned &&
      Boolean(scene.caption?.trim()) &&
      (input.targetStyle !== "comics" || (scene.captionStyle ?? COMICS_PUBLISH_CAPTION_STYLE) === COMICS_PUBLISH_CAPTION_STYLE);

    return {
      sceneId: scene.sceneId,
      role: scene.role,
      startSec: scene.startSec,
      endSec: scene.endSec,
      assetTitle: scene.assetTitle ?? scene.sceneId,
      themeAligned,
      caption: scene.caption?.trim() ?? "",
      captionStyle: scene.captionStyle ?? COMICS_PUBLISH_CAPTION_STYLE,
      publishReady,
      warnings: sceneWarnings
    };
  });

  const visualDiversity =
    input.visualDiversity ??
    evaluateComicsVisualDiversity({
      uniqueAssetCount: 0,
      dominantAssetRatio: 1,
      longestStaticSegmentSec: 999,
      visualSegmentCount: 0
    });

  const flags = evaluateComicsReadinessFlags({
    sourceFootprintOk: input.sourceFootprintOk ?? true,
    materializationOk: input.materializationOk ?? input.canRender,
    themeAlignment,
    captionMaterialization,
    visualDiversity,
    renderBlockReason: input.renderBlockReason ?? null,
    ...(input.placeholderUsage ? { placeholderUsage: input.placeholderUsage } : {})
  });

  let recommendation = "ready_for_publication";
  if (!flags.canPublish) {
    recommendation = NOT_READY_FOR_PUBLICATION;
  } else if (!flags.canRender) {
    recommendation = "fix_render_blockers_before_publish_readiness";
  }

  return {
    variation: input.variation,
    canRender: flags.canRender,
    narrativeReady: flags.narrativeReady,
    captionReady: flags.captionReady,
    canPublish: flags.canPublish,
    publishBlockReason: flags.publishBlockReason,
    renderBlockReason: flags.renderBlockReason,
    theme: {
      primaryTheme: input.themeAnalysis.narrativeThemes[0] ?? "unknown",
      relationshipType: input.themeAnalysis.relationshipType,
      requiredSignals: input.themeAnalysis.recommendedAssetSignals,
      disallowedSignals: input.themeAnalysis.disallowedAssetSignals
    },
    themeAlignment: {
      onThemeRatio: themeAlignment.onThemeRatio,
      offThemeScenes: themeAlignment.offThemeScenes,
      hookAligned: themeAlignment.hookAligned,
      climaxAligned: themeAlignment.climaxAligned
    },
    captionMaterialization: {
      captionMaterializationRate: captionMaterialization.captionMaterializationRate,
      missingCaptionScenes: captionMaterialization.missingCaptionScenes,
      wrongStyleScenes: captionMaterialization.wrongStyleScenes
    },
    timelineScenes: timelineReport,
    recommendation,
    contactSheetPath: null,
    generatedAt: new Date().toISOString(),
    cache: {
      used: false,
      invalidatedOffThemeAssets: []
    },
    bypassRoutesBlocked: [],
    visualDiversity: flags.visualDiversity,
    placeholderUsage: flags.placeholderUsage
  };
}

export async function buildComicsPublishReadinessReport(input: {
  variation: string;
  targetStyle: string;
  videoTitle: string;
  narrationText: string;
  themeAnalysis: ComicsThemeAnalysis;
  materialization: RemixMaterializationReport;
  assetMetaById?: Map<string, { title: string; category?: string; score?: number }>;
  projectRoot?: string;
  cache?: ComicsPublishReadinessReport["cache"];
  bypassRoutesBlocked?: string[];
}): Promise<{ report: ComicsPublishReadinessReport; reportPath: string; contactSheetPath: string | null }> {
  const projectRoot = resolve(input.projectRoot ?? process.cwd());
  const assetMeta = input.assetMetaById ?? new Map();

  const timelineScenes = input.materialization.timelineScenes.map((scene) => {
    const meta = assetMeta.get(scene.assetId ?? "") ?? assetMeta.get(scene.assetPath ?? "");
    return {
      sceneId: scene.sceneId,
      role: scene.sceneRole,
      startSec: scene.startSec,
      endSec: scene.endSec,
      assetId: scene.assetId,
      assetTitle: meta?.title ?? scene.assetId ?? scene.sceneId,
      caption: scene.caption,
      captionStyle: input.materialization.captionStyleId,
      assetCategory: meta?.category,
      assetQualityScore: meta?.score,
      assetPath: scene.assetPath
    };
  });

  const rotationStats = input.materialization.timelineRotationStats;
  const visualDiversity = evaluateComicsVisualDiversity({
    uniqueAssetCount: rotationStats?.uniqueAssetCount ?? 0,
    dominantAssetRatio: rotationStats?.dominantAssetRatio ?? 1,
    longestStaticSegmentSec: rotationStats?.longestStaticSegmentSec ?? 999,
    visualSegmentCount: rotationStats?.visualSegmentCount ?? 0
  });

  const report = evaluateComicsPublishReadiness({
    variation: input.variation,
    targetStyle: input.targetStyle,
    videoTitle: input.videoTitle,
    narrationText: input.narrationText,
    themeAnalysis: input.themeAnalysis,
    canRender: input.materialization.canRender,
    renderBlockReason: input.materialization.blockReason,
    sourceFootprintOk: input.materialization.sourceFootprintRatio <= 0.2,
    materializationOk: input.materialization.timelineScenes.some(
      (scene) => scene.assetPath || scene.visualSourceType === "placeholder"
    ),
    visualDiversity,
    placeholderUsage: input.materialization.placeholderUsage ?? {
      used: false,
      count: 0,
      placeholders: []
    },
    timelineScenes
  });

  const rasterPaths = input.materialization.timelineScenes
    .map((scene) => scene.assetPath)
    .filter((path): path is string => Boolean(path && /\.(jpe?g|png|webp|gif|avif)$/i.test(path)));

  const contactSheetPath = join(projectRoot, "tmp", "variation-b-publish-readiness-contact-sheet.jpg");
  const renderedSheet = await renderSelectedAssetsContactSheet({
    assetPaths: [...new Set(rasterPaths)].slice(0, 16),
    outputPath: contactSheetPath
  });
  report.contactSheetPath = renderedSheet;
  report.cache = input.cache ?? input.materialization.themeFilterCache ?? {
    used: false,
    invalidatedOffThemeAssets: []
  };
  report.bypassRoutesBlocked = input.bypassRoutesBlocked ?? [
    "focused_discovery_acceptance",
    "catalog_download_ingestion",
    "raster_fallback_sanitization",
    "asset_rotation_pool",
    "materialization_approved_assets"
  ];

  const reportPath = join(projectRoot, "tmp", "variation-b-publish-readiness-report.json");
  await writeFile(reportPath, JSON.stringify(report, null, 2), "utf8");

  return { report, reportPath, contactSheetPath: renderedSheet };
}

export async function saveComicsPublishReadinessReport(
  report: ComicsPublishReadinessReport,
  projectRoot?: string
): Promise<string> {
  const root = resolve(projectRoot ?? process.cwd());
  const reportPath = join(root, "tmp", "variation-b-publish-readiness-report.json");
  await writeFile(reportPath, JSON.stringify(report, null, 2), "utf8");
  return reportPath;
}