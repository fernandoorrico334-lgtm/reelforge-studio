import { writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { getCaptionStyleById } from "@reelforge/caption-engine";
import type { CaptionDirectionCue } from "./caption-direction-engine.js";
import {
  importRemixAssetCandidatesToDisk,
  type RemixAssetDiskImportResult
} from "./remix-asset-importer.js";
import type { RemixAssetSearchCandidate } from "./remix-asset-discovery.js";
import type { RemixSceneSegment, RemixSceneSourceSegment } from "./remix-scene-restructure.js";
import {
  calculateSourceFootprintRatio,
  INSUFFICIENT_ASSETS_ERROR,
  validateSourceFootprint,
  type TimelineSceneFootprint
} from "./source-footprint-guard.js";
import {
  INSUFFICIENT_HIGH_QUALITY_COMICS_ASSETS,
  INSUFFICIENT_TRUE_COMICS_ASSETS,
  evaluateComicsAssetQuality
} from "./comics-asset-quality-gate.js";
import {
  buildComicsAssetSelectionReport,
  saveComicsAssetSelectionReport
} from "./comics-asset-selection-report.js";
import { runComicsVisualAssetAudit } from "./comics-visual-asset-audit.js";
import {
  candidateToAssetLike,
  evaluateRemixAssetQuality,
  rejectHomonymOrIrrelevantAsset,
  selectVisualAssetForRemixScene,
  type RemixAssetLike,
  type VisualSourceType
} from "./remix-visual-asset-selector.js";
import {
  buildFastCutMicroSegments,
  shouldMaterializeFastCuts,
  type FastCutMicroSegment
} from "./remix-fast-cut-materializer.js";
import type { ComicsAssetCategory } from "./comics-asset-quality-gate.js";
import {
  analyzeComicsVideoThemeFromAnalysis,
  isActionableComicsThemeAnalysis,
  scoreAssetForThemedSelection,
  selectAssetForThemedBeat,
  type ComicsThemeAnalysis
} from "./comics-theme-intelligence.js";
import {
  isPremiumComicsPlaceholderAsset,
  isScenePremiumComicsPlaceholder,
  MIN_PUBLISH_UNIQUE_ASSETS,
  PREMIUM_PLACEHOLDER_COMICS_CATEGORY,
  supplementRotationPoolWithPremiumPlaceholders,
  type PremiumComicsPlaceholderAsset
} from "./comics-premium-placeholder-assets.js";
import {
  applyRotationPlanToMaterializedScenes,
  buildRemixAssetRotationPlan,
  buildRemixAssetRotationReport,
  computeTimelineRotationStats,
  distributeComicsFastCutVisualDiversity,
  INSUFFICIENT_THEME_ALIGNED_VISUAL_DIVERSITY,
  MIN_UNIQUE_ASSETS,
  scoreAssetForTimelineRotation,
  TIMELINE_NOT_READY,
  validateVisualTimelineReadiness,
  type RemixAssetRotationPlan,
  type RemixRotationAsset
} from "./remix-asset-rotation.js";
import {
  buildComicsPublishReadinessReport,
  COMICS_PUBLISH_CAPTION_STYLE,
  filterComicsAssetsForTheme,
  NOT_READY_FOR_PUBLICATION,
  type ComicsPublishReadinessReport
} from "./comics-publish-readiness.js";
import {
  INSUFFICIENT_THEME_ALIGNED_ASSETS,
  MIN_THEME_ALIGNED_COMICS_ASSETS,
  validateComicsAssetForTheme
} from "./comics-theme-asset-validator.js";
import { finalizeSemanticCaption } from "./comics-caption-semantic.js";
import type { VideoRemixPlan } from "./video-remixer.js";

const FFMPEG_RENDERABLE_ASSET_PATTERN =
  /\.(jpe?g|png|webp|gif|avif|mp4|webm|mov|m4v|mkv)$/i;

function isFfmpegRenderableAssetPath(path: string | null | undefined): boolean {
  return Boolean(path && FFMPEG_RENDERABLE_ASSET_PATTERN.test(path));
}

function rotationAssetToThemedCandidate(
  asset: RemixRotationAsset,
  themeAnalysis: ComicsThemeAnalysis
) {
  return scoreAssetForThemedSelection({
    id: asset.id ?? asset.title ?? "rotation-asset",
    title: asset.title ?? "",
    category: (asset.category as ComicsAssetCategory) ?? "unknown",
    assetQualityScore: asset.score,
    themeAnalysis
  });
}

function resolveThemedRotationAsset(
  rotationAssets: RemixRotationAsset[],
  themedId: string | null | undefined
): RemixRotationAsset | null {
  if (!themedId) return null;
  return (
    rotationAssets.find((asset) => asset.id === themedId) ??
    rotationAssets.find((asset) => asset.title === themedId) ??
    null
  );
}

function sanitizeNonRasterTimelineScenes(
  scenes: MaterializedTimelineScene[],
  approvedAssets: RemixAssetLike[],
  input: {
    themeAnalysis: ComicsThemeAnalysis | null;
    narrationText: string;
    videoTitle: string;
    entities: string[];
    targetStyle: string;
    premiumPlaceholders?: PremiumComicsPlaceholderAsset[];
  }
): { scenes: MaterializedTimelineScene[]; warnings: string[]; offThemeReplacementsBlocked: number } {
  const rasterCandidates = approvedAssets
    .filter((asset) => isFfmpegRenderableAssetPath(asset.localPath ?? null))
    .map((asset) => {
      const quality = evaluateRemixAssetQuality(asset, input.entities, input.targetStyle);
      return {
        asset,
        id: asset.id,
        title: asset.title,
        description: asset.purpose ?? asset.suggestedSceneRole ?? "",
        category: quality.category,
        sourceType: asset.origin ?? "approved_asset"
      };
    });

  let rasterAssets = rasterCandidates.map((entry) => entry.asset);
  const warnings: string[] = [];
  let offThemeReplacementsBlocked = 0;

  if (input.themeAnalysis) {
    const filtered = filterComicsAssetsForTheme({
      assets: rasterCandidates,
      themeAnalysis: input.themeAnalysis,
      narrationText: input.narrationText,
      videoTitle: input.videoTitle
    });
    rasterAssets = filtered.accepted.map((entry) => entry.asset);
    if (filtered.rejected.length > 0) {
      warnings.push(
        `raster_fallback_theme_filter_rejected:${filtered.rejected.length}`
      );
    }
  }

  if (rasterAssets.length === 0) {
    return {
      scenes,
      warnings: [...warnings, "no_theme_aligned_raster_assets_for_timeline_sanitization"],
      offThemeReplacementsBlocked: 0
    };
  }

  const usage = new Map<string, number>();
  let previousRasterId: string | null = null;
  let placeholderIndex = 0;
  const premiumPlaceholders = input.premiumPlaceholders ?? [];

  const pickPremiumPlaceholder = () => {
    if (premiumPlaceholders.length === 0) return null;
    const picked = premiumPlaceholders[placeholderIndex % premiumPlaceholders.length]!;
    placeholderIndex += 1;
    return picked;
  };

  const pickRaster = () => {
    const ranked = [...rasterAssets].sort(
      (left, right) => (usage.get(left.id) ?? 0) - (usage.get(right.id) ?? 0)
    );
    return ranked.find((asset) => asset.id !== previousRasterId) ?? ranked[0] ?? null;
  };

  const sanitized = scenes.map((scene) => {
    if (isFfmpegRenderableAssetPath(scene.assetPath)) {
      if (input.themeAnalysis && scene.assetId) {
        const assigned = approvedAssets.find((asset) => asset.id === scene.assetId);
        if (assigned) {
          const verdict = validateComicsAssetForTheme({
            assetTitle: assigned.title,
            assetDescription: assigned.purpose ?? assigned.suggestedSceneRole ?? "",
            themeAnalysis: input.themeAnalysis,
            narrationText: input.narrationText,
            videoTitle: input.videoTitle
          });
          if (verdict.severity === "reject") {
            offThemeReplacementsBlocked += 1;
            const replacement = pickRaster();
            if (!replacement?.localPath) {
              warnings.push(`off_theme_scene_blocked_no_replacement:${scene.sceneId}`);
              return {
                ...scene,
                assetPath: null,
                assetId: null,
                visualSourceType: "placeholder" as VisualSourceType,
                selectionReason: "premium_placeholder_comics_symbiote_texture"
              };
            }
            warnings.push(
              `off_theme_raster_replaced:${scene.sceneId}:${assigned.title}:${verdict.reason}`
            );
            previousRasterId = replacement.id;
            usage.set(
              replacement.id,
              (usage.get(replacement.id) ?? 0) + Math.max(0.01, scene.endSec - scene.startSec)
            );
            return {
              ...scene,
              assetPath: replacement.localPath,
              assetId: replacement.id,
              visualSourceType: "approved_asset" as VisualSourceType,
              selectionReason: `theme_aligned_raster_fallback_${replacement.id}`
            };
          }
        }
      }

      if (scene.assetId) {
        usage.set(
          scene.assetId,
          (usage.get(scene.assetId) ?? 0) + Math.max(0.01, scene.endSec - scene.startSec)
        );
      }
      previousRasterId = scene.assetId;
      return scene;
    }

    if (isScenePremiumComicsPlaceholder(scene)) {
      return scene;
    }

    const placeholder = pickPremiumPlaceholder();
    if (placeholder) {
      warnings.push(
        `non_raster_asset_replaced_with_placeholder:${scene.sceneId}:${scene.assetPath ?? "missing"}:${placeholder.id}`
      );
      previousRasterId = placeholder.id;
      return {
        ...scene,
        assetPath: null,
        assetId: placeholder.id,
        visualSourceType: "placeholder" as VisualSourceType,
        selectionReason: `premium_placeholder_comics_${placeholder.id}`
      };
    }

    const replacement = pickRaster();
    if (!replacement?.localPath) {
      warnings.push(`non_raster_scene_no_theme_aligned_fallback:${scene.sceneId}`);
      return {
        ...scene,
        assetPath: null,
        assetId: null,
        visualSourceType: "placeholder" as VisualSourceType,
        selectionReason: "premium_placeholder_comics_halftone_panel"
      };
    }

    warnings.push(`non_raster_asset_replaced:${scene.sceneId}:${scene.assetPath ?? "missing"}`);
    previousRasterId = replacement.id;
    usage.set(
      replacement.id,
      (usage.get(replacement.id) ?? 0) + Math.max(0.01, scene.endSec - scene.startSec)
    );

    return {
      ...scene,
      assetPath: replacement.localPath,
      assetId: replacement.id,
      visualSourceType: "approved_asset" as VisualSourceType,
      selectionReason: `theme_aligned_raster_fallback_${replacement.id}`
    };
  });

  return { scenes: sanitized, warnings, offThemeReplacementsBlocked };
}

export type MaterializedTimelineScene = {
  sceneId: string;
  startSec: number;
  endSec: number;
  visualSourceType: VisualSourceType;
  assetPath: string | null;
  assetId: string | null;
  caption: string;
  narration: string;
  transition: string;
  sfx: string;
  sceneRole: string;
  plannedSourceSegment: RemixSceneSourceSegment;
  selectionReason: string;
  motion?: string;
};

export type RemixMaterializationReport = {
  referenceVideoPath: string;
  allowReferenceVideoInFinal: boolean;
  sourceFootprintRatio: number;
  providedAssetsUsageRatio: number;
  approvedAssetsUsed: string[];
  rejectedAssets: Array<{ id: string; title: string; reason: string }>;
  timelineScenes: MaterializedTimelineScene[];
  canRender: boolean;
  blockReason: string | null;
  warnings: string[];
  plannedButNotMaterialized: string[];
  captionStyleId: string;
  captionCues: CaptionDirectionCue[];
  musicPresetId: string | null;
  fastCutCount: number;
  sceneStructureSceneCount: number;
  materializedFastCutCount: number;
  timelineMode: "fast_cut" | "scene_structure";
  comicsAssetSelectionReportPath: string | null;
  visualAssetAuditReportPath: string | null;
  visualAssetContactSheetPath: string | null;
  assetRotationReportPath: string | null;
  timelineRotationStats: {
    visualSegmentCount: number;
    uniqueAssetCount: number;
    dominantAssetRatio: number;
    longestStaticSegmentSec: number;
    dominantAssetId: string | null;
    dominantAssetTitle: string | null;
  } | null;
  canPublish: boolean;
  publishBlockReason: string | null;
  publishReadinessReportPath: string | null;
  publishReadinessContactSheetPath: string | null;
  themeFilterCache: {
    used: boolean;
    invalidatedOffThemeAssets: string[];
  };
  narrativeReady: boolean;
  captionReady: boolean;
  renderBlockReason: string | null;
  placeholderUsage: {
    used: boolean;
    count: number;
    placeholders: string[];
  };
};

export type RemixMaterializationInput = {
  plan: VideoRemixPlan;
  allowReferenceVideoInFinal?: boolean;
  maxAllowedSourceFootprintRatio?: number;
  providedAssets?: RemixAssetLike[];
  importTopCandidates?: number;
  projectRoot?: string;
};

function mapSourceSegmentToVisualType(
  segment: RemixSceneSourceSegment,
  allowReference: boolean
): VisualSourceType {
  if (segment === "original_clip") {
    return allowReference ? "reference_video" : "reference_video";
  }
  if (segment === "broll_overlay") return "approved_asset";
  if (segment === "comfy_insert" || segment === "comfy_reconstruction") {
    return "approved_asset";
  }
  return "approved_asset";
}

function shortenCaption(text: string, maxWords = 6): string {
  return finalizeSemanticCaption(text, { maxWords }).caption;
}

function overlapSeconds(
  startA: number,
  endA: number,
  startB: number,
  endB: number
): number {
  return Math.max(0, Math.min(endA, endB) - Math.max(startA, startB));
}

function mapSceneRoleToNarrationBeat(role: string): string {
  const base = role.replace(/_\d+$/, "");
  const roleMap: Record<string, string> = {
    hook: "hook",
    context: "context",
    curiosity: "context",
    development_a: "tension",
    development_b: "tension",
    development: "tension",
    evidence: "tension",
    tension: "tension",
    climax_setup: "climax",
    climax: "climax",
    outro: "cta",
    outro_a: "cta",
    outro_b: "cta",
    loop_closing: "cta"
  };
  return roleMap[base] ?? base;
}

function resolveCaptionFromSources(input: {
  startSec: number;
  endSec: number;
  sceneRole: string;
  captionCues: CaptionDirectionCue[];
  narrationBeats: Array<{ role: string; text: string }>;
  captionPlanScenes: Array<{ startSeconds: number; endSeconds: number; captionText: string }>;
  captionHint?: string;
}): string {
  let bestCue: CaptionDirectionCue | null = null;
  let bestCueOverlap = 0;
  for (const cue of input.captionCues) {
    const overlap = overlapSeconds(
      input.startSec,
      input.endSec,
      cue.startSec ?? 0,
      cue.endSec ?? input.endSec
    );
    if (overlap > bestCueOverlap && cue.textOnScreen?.trim()) {
      bestCueOverlap = overlap;
      bestCue = cue;
    }
  }
  if (bestCue?.textOnScreen?.trim()) {
    return shortenCaption(bestCue.textOnScreen);
  }

  let bestPlan: { captionText: string } | null = null;
  let bestPlanOverlap = 0;
  for (const scene of input.captionPlanScenes) {
    const overlap = overlapSeconds(
      input.startSec,
      input.endSec,
      scene.startSeconds,
      scene.endSeconds
    );
    if (overlap > bestPlanOverlap && scene.captionText?.trim()) {
      bestPlanOverlap = overlap;
      bestPlan = scene;
    }
  }
  if (bestPlan?.captionText?.trim()) {
    return shortenCaption(bestPlan.captionText);
  }

  const beatRole = mapSceneRoleToNarrationBeat(input.sceneRole);
  const beat = input.narrationBeats.find((entry) => entry.role === beatRole);
  if (beat?.text?.trim()) {
    return shortenCaption(beat.text);
  }

  if (input.captionHint?.trim()) {
    return shortenCaption(input.captionHint);
  }

  return shortenCaption(input.sceneRole.replace(/_/g, " "));
}

function captionForScene(
  segment: RemixSceneSegment,
  captionCues: CaptionDirectionCue[],
  narrationBeats: Array<{ role: string; text: string }>,
  captionPlanScenes: Array<{ startSeconds: number; endSeconds: number; captionText: string }>
): string {
  return resolveCaptionFromSources({
    startSec: segment.startSeconds,
    endSec: segment.endSeconds,
    sceneRole: segment.role,
    captionCues,
    narrationBeats,
    captionPlanScenes,
    captionHint: segment.captionHint
  });
}

function captionForMicroSegment(
  micro: FastCutMicroSegment,
  captionCues: CaptionDirectionCue[],
  narrationBeats: Array<{ role: string; text: string }>,
  captionPlanScenes: Array<{ startSeconds: number; endSeconds: number; captionText: string }>
): string {
  return resolveCaptionFromSources({
    startSec: micro.startSeconds,
    endSec: micro.endSeconds,
    sceneRole: micro.role,
    captionCues,
    narrationBeats,
    captionPlanScenes,
    captionHint: micro.captionHint
  });
}

function fillMissingTimelineCaptions(
  scenes: MaterializedTimelineScene[],
  captionCues: CaptionDirectionCue[],
  narrationBeats: Array<{ role: string; text: string }>,
  captionPlanScenes: Array<{ startSeconds: number; endSeconds: number; captionText: string }>
): MaterializedTimelineScene[] {
  const beatCaptionCache = new Map<string, string>();

  return scenes.map((scene) => {
    if (scene.caption?.trim()) return scene;

    const beatRole = mapSceneRoleToNarrationBeat(scene.sceneRole);
    let caption = beatCaptionCache.get(beatRole);
    if (!caption) {
      caption = resolveCaptionFromSources({
        startSec: scene.startSec,
        endSec: scene.endSec,
        sceneRole: scene.sceneRole,
        captionCues,
        narrationBeats,
        captionPlanScenes,
        captionHint: scene.sceneRole
      });
      if (caption) beatCaptionCache.set(beatRole, caption);
    }

    return caption ? { ...scene, caption } : scene;
  });
}

function narrationForMicroSegment(
  micro: FastCutMicroSegment,
  narrationBeats: Array<{ role: string; text: string }>
): string {
  const roleMap: Record<string, string> = {
    hook: "hook",
    context: "context",
    evidence: "tension",
    tension: "tension",
    climax: "climax",
    outro: "cta"
  };
  const beatRole = roleMap[micro.role] ?? micro.role;
  return narrationBeats.find((entry) => entry.role === beatRole)?.text?.trim() ?? "";
}

function narrationForScene(
  segment: RemixSceneSegment,
  narrationBeats: Array<{ role: string; text: string }>
): string {
  const roleMap: Record<string, string> = {
    hook: "hook",
    context: "context",
    evidence: "tension",
    tension: "tension",
    climax: "climax",
    outro: "cta"
  };
  const beatRole = roleMap[segment.role] ?? segment.role;
  return narrationBeats.find((entry) => entry.role === beatRole)?.text?.trim() ?? "";
}

function collectCaptionCues(plan: VideoRemixPlan): CaptionDirectionCue[] {
  const retention = plan.narrationPlan?.retentionMetadata as
    | { captionDirection?: { cues?: CaptionDirectionCue[] } }
    | undefined;
  return retention?.captionDirection?.cues ?? [];
}

function buildRejectedList(
  candidates: RemixAssetSearchCandidate[],
  entities: string[],
  options: { comicsDomain: boolean; targetStyle: string }
): Array<{ id: string; title: string; reason: string }> {
  const rejected: Array<{ id: string; title: string; reason: string }> = [];
  for (const candidate of candidates) {
    const assetLike = candidateToAssetLike(candidate);
    const verdict = rejectHomonymOrIrrelevantAsset(assetLike, entities);
    if (verdict.rejected) {
      rejected.push({
        id: candidate.candidateId,
        title: candidate.title,
        reason: verdict.reason ?? "rejected"
      });
      continue;
    }

    if (options.comicsDomain) {
      const quality = evaluateRemixAssetQuality(assetLike, entities, options.targetStyle);
      if (!quality.ok) {
        rejected.push({
          id: candidate.candidateId,
          title: candidate.title,
          reason: quality.rejectReason ?? `comics_quality_score_${quality.score}`
        });
      }
    }
  }
  return rejected;
}

function assetFromImport(
  candidate: RemixAssetSearchCandidate,
  importResult: RemixAssetDiskImportResult | undefined,
  projectRoot: string
): RemixAssetLike {
  const localPath = importResult?.localPath
    ? resolve(projectRoot, importResult.localPath)
    : null;
  const asset = candidateToAssetLike(candidate, localPath, "imported");
  if (importResult?.width) asset.width = importResult.width;
  if (importResult?.height) asset.height = importResult.height;
  return asset;
}

export async function buildRemixMaterializationReport(
  input: RemixMaterializationInput
): Promise<RemixMaterializationReport> {
  const plan = input.plan;
  const projectRoot = input.projectRoot ?? process.cwd();
  const allowReference = input.allowReferenceVideoInFinal === true;
  const warnings: string[] = [];
  const plannedButNotMaterialized: string[] = [];
  const entities =
    plan.videoAnalysis?.contentIntelligence?.entities?.map((e) => e.name) ?? [];
  const contentDomain = plan.videoAnalysis?.contentIntelligence?.domain ?? "generic";
  const isComicsDomain = contentDomain === "comics_superhero" || plan.targetStyle === "comics";

  const candidates = plan.assetDiscovery?.imageSearch?.candidates ?? [];
  const rejectedAssets = buildRejectedList(candidates, entities, {
    comicsDomain: isComicsDomain,
    targetStyle: plan.targetStyle
  });
  const rejectedIds = new Set(rejectedAssets.map((entry) => entry.id));

  const eligibleCandidates = candidates
    .filter((c) => {
      if (rejectedIds.has(c.candidateId)) return false;
      if (!isComicsDomain) return true;
      const assetLike = candidateToAssetLike(c);
      const quality = evaluateRemixAssetQuality(assetLike, entities, plan.targetStyle);
      return quality.ok;
    })
    .sort((a, b) => {
      const qualityA = evaluateRemixAssetQuality(candidateToAssetLike(a), entities, plan.targetStyle).score;
      const qualityB = evaluateRemixAssetQuality(candidateToAssetLike(b), entities, plan.targetStyle).score;
      return qualityB - qualityA || (b.combinedScore ?? 0) - (a.combinedScore ?? 0);
    })
    .slice(0, input.importTopCandidates ?? 8);

  const importResults = await importRemixAssetCandidatesToDisk(eligibleCandidates, {
    remixId: plan.remixId,
    headline: plan.videoAnalysis?.contentIntelligence?.headline,
    entities,
    domain: plan.videoAnalysis?.contentIntelligence?.domain
  });

  const importById = new Map(importResults.map((r) => [r.candidateId, r]));
  const importedAssets = eligibleCandidates.map((candidate) =>
    assetFromImport(candidate, importById.get(candidate.candidateId), projectRoot)
  );

  const providedAssets = input.providedAssets ?? [];
  let approvedAssets = [
    ...providedAssets,
    ...importedAssets.filter((a) => Boolean(a.localPath))
  ];

  const videoTitle =
    plan.inputVideoTitle ?? plan.videoAnalysis?.contentIntelligence?.headline ?? "";
  let themeFilterCache: RemixMaterializationReport["themeFilterCache"] = {
    used: false,
    invalidatedOffThemeAssets: []
  };
  let comicsThemeAnalysis: ComicsThemeAnalysis | null = null;

  if (isComicsDomain) {
    const rawThemeAnalysis = analyzeComicsVideoThemeFromAnalysis(plan.videoAnalysis);
    if (isActionableComicsThemeAnalysis(rawThemeAnalysis)) {
      comicsThemeAnalysis = rawThemeAnalysis;
      const themeFilter = filterComicsAssetsForTheme({
        assets: approvedAssets.map((asset) => {
          const quality = evaluateRemixAssetQuality(asset, entities, plan.targetStyle);
          return {
            asset,
            id: asset.id,
            title: asset.title,
            description: asset.purpose ?? asset.suggestedSceneRole ?? "",
            category: quality.category,
            sourceType: asset.origin ?? "provided_asset"
          };
        }),
        themeAnalysis: rawThemeAnalysis,
        narrationText: [
          plan.videoAnalysis?.contentIntelligence?.narrativeHook,
          plan.videoAnalysis?.contentIntelligence?.narrativeBrief,
          ...(plan.narrationPlan?.narrationBeats?.map((beat) => beat.text) ?? [])
        ]
          .filter(Boolean)
          .join(" "),
        videoTitle
      });

      if (themeFilter.rejected.length > 0) {
        themeFilterCache = {
          used: Boolean(input.providedAssets?.length),
          invalidatedOffThemeAssets: themeFilter.rejected.map(
            (entry) => `${entry.asset.id ?? entry.asset.title ?? "unknown"}:${entry.reason}`
          )
        };
        for (const rejected of themeFilter.rejected) {
          rejectedAssets.push({
            id: rejected.asset.id ?? rejected.asset.title ?? "unknown",
            title: rejected.asset.title ?? "unknown",
            reason: `theme_filter:${rejected.reason}`
          });
        }
        warnings.push(
          `theme_filter_removed_off_theme_assets:${themeFilter.rejected.length}`
        );
      }

      approvedAssets = themeFilter.accepted.map((entry) => entry.asset);

      if (approvedAssets.length < MIN_THEME_ALIGNED_COMICS_ASSETS) {
        warnings.push(
          `${INSUFFICIENT_THEME_ALIGNED_ASSETS}:${approvedAssets.length}/${MIN_THEME_ALIGNED_COMICS_ASSETS}`
        );
      }
    }
  }

  if (plan.assetDiscovery?.importedAssets?.length) {
    for (const binding of plan.assetDiscovery.importedAssets) {
      approvedAssets.push({
        id: binding.candidateId,
        title: binding.candidateId,
        localPath: resolve(projectRoot, binding.localPath),
        suggestedSceneRole: binding.sceneRole,
        origin: "approved"
      });
    }
  }

  const generatedAssets: RemixAssetLike[] = (plan.visualPlan?.comfyVariations ?? []).map(
    (variation, index) => ({
      id: variation.variationId,
      title: `generated_${variation.style}`,
      localPath: null,
      suggestedSceneRole: index === 0 ? "hook" : "climax",
      origin: "generated" as const,
      combinedScore: 40
    })
  );

  if (generatedAssets.length > 0) {
    plannedButNotMaterialized.push("visualPlan.comfyVariations (sem arquivo gerado local)");
  }

  const useFastCutTimeline = shouldMaterializeFastCuts({
    cutTimes: plan.fastCutPlan?.cutTimes ?? [],
    sceneSegmentCount: plan.sceneStructure?.segments?.length ?? 0,
    targetStyle: plan.targetStyle,
    intensity: plan.intensity
  });

  let microSegments: FastCutMicroSegment[] = [];
  if (useFastCutTimeline && plan.sceneStructure && plan.fastCutPlan) {
    microSegments = buildFastCutMicroSegments({
      durationSeconds: plan.durationSeconds,
      cutTimes: plan.fastCutPlan.cutTimes,
      sceneStructure: plan.sceneStructure,
      fastCutPlan: plan.fastCutPlan
    });
  }

  if (plan.fastCutPlan?.cutTimes?.length && microSegments.length === 0) {
    const applied = plan.sceneStructure?.segments?.length ?? 0;
    if (applied < plan.fastCutPlan.cutTimes.length) {
      plannedButNotMaterialized.push(
        `fastCutPlan.cutTimes (${plan.fastCutPlan.cutTimes.length} cortes planejados, ${applied} cenas materializadas)`
      );
    }
  }

  const narrationBeats =
    plan.narrationPlan?.narrationBeats?.map((beat) => ({
      role: beat.role,
      text: beat.text
    })) ?? [];

  const captionCues = collectCaptionCues(plan);
  const captionStyleId =
    isComicsDomain || plan.targetStyle === "comics"
      ? COMICS_PUBLISH_CAPTION_STYLE
      : (plan.captionPlan?.style?.id ?? COMICS_PUBLISH_CAPTION_STYLE);
  getCaptionStyleById(captionStyleId);
  const captionPlanScenes = plan.captionPlan?.scenes ?? [];
  const narrationText = [
    plan.videoAnalysis?.contentIntelligence?.narrativeHook,
    plan.videoAnalysis?.contentIntelligence?.narrativeBrief,
    plan.videoAnalysis?.contentIntelligence?.summary,
    ...(plan.narrationPlan?.narrationBeats?.map((beat) => beat.text) ?? [])
  ]
    .filter(Boolean)
    .join(" ");

  const segments = plan.sceneStructure?.segments ?? [];
  const usedAssetIds = new Set<string>();
  let timelineScenes: MaterializedTimelineScene[] = [];
  const timelineUnits =
    microSegments.length > 0
      ? microSegments.map((micro) => ({
          kind: "fast_cut" as const,
          micro,
          segment: null
        }))
      : segments.map((segment) => ({
          kind: "scene" as const,
          micro: null,
          segment
        }));

  for (const unit of timelineUnits) {
    const segment = unit.segment;
    const micro = unit.micro;
    if (!segment && !micro) continue;

    const sceneRole = segment?.role ?? micro!.role;
    const sceneId = segment?.sceneId ?? micro!.sceneId;
    const startSec = segment?.startSeconds ?? micro!.startSeconds;
    const endSec = segment?.endSeconds ?? micro!.endSeconds;
    const sourceSegment = segment?.sourceSegment ?? micro!.sourceSegment;
    const transition = segment?.transitionIn ?? micro!.transitionIn;
    const sfx = segment?.effects[0] ?? micro!.sfx;
    const intendedType = mapSourceSegmentToVisualType(sourceSegment, allowReference);

    if (intendedType === "reference_video" && !allowReference) {
      const selection = selectVisualAssetForRemixScene({
        sceneRole,
        targetStyle: plan.targetStyle,
        entities,
        providedAssets,
        approvedAssets,
        generatedAssets,
        usedAssetIds
      });

      if (selection.asset) {
        usedAssetIds.add(selection.asset.id);
      }

      const hasLocalAsset = Boolean(selection.asset?.localPath);
      timelineScenes.push({
        sceneId,
        startSec,
        endSec,
        visualSourceType: hasLocalAsset ? selection.sourceType : "placeholder",
        assetPath: selection.asset?.localPath ?? null,
        assetId: selection.asset?.id ?? null,
        caption: segment
          ? captionForScene(segment, captionCues, narrationBeats, plan.captionPlan.scenes)
          : captionForMicroSegment(micro!, captionCues, narrationBeats, plan.captionPlan.scenes),
        narration: segment
          ? narrationForScene(segment, narrationBeats)
          : narrationForMicroSegment(micro!, narrationBeats),
        transition,
        sfx,
        sceneRole,
        plannedSourceSegment: sourceSegment,
        selectionReason: selection.asset
          ? `reference_blocked:${selection.reason}`
          : "reference_blocked:no_asset_fallback"
      });

      if (!hasLocalAsset) {
        warnings.push(`reference_video_blocked_as_final_visual:${sceneId}`);
      }
      continue;
    }

    const selection = selectVisualAssetForRemixScene({
      sceneRole,
      targetStyle: plan.targetStyle,
      entities,
      providedAssets,
      approvedAssets,
      generatedAssets,
      usedAssetIds
    });

    if (selection.asset) {
      usedAssetIds.add(selection.asset.id);
    }

    const hasLocalAsset = Boolean(selection.asset?.localPath);
    timelineScenes.push({
      sceneId,
      startSec,
      endSec,
      visualSourceType: hasLocalAsset ? selection.sourceType : "placeholder",
      assetPath: selection.asset?.localPath ?? null,
      assetId: selection.asset?.id ?? null,
      caption: segment
        ? captionForScene(segment, captionCues, narrationBeats, plan.captionPlan.scenes)
        : captionForMicroSegment(micro!, captionCues, narrationBeats, captionPlanScenes),
      narration: segment
        ? narrationForScene(segment, narrationBeats)
        : narrationForMicroSegment(micro!, narrationBeats),
      transition,
      sfx,
      sceneRole,
      plannedSourceSegment: sourceSegment,
      selectionReason: selection.reason
    });
  }

  let assetRotationReportPath: string | null = null;
  let timelineRotationStats: RemixMaterializationReport["timelineRotationStats"] = null;
  let rotationTimelineValidation: ReturnType<typeof validateVisualTimelineReadiness> | null =
    null;
  let rotationPlanForReport: RemixAssetRotationPlan | null = null;
  let rotationBeforeStats: ReturnType<typeof computeTimelineRotationStats> | null = null;
  let rotationAssetsForReport: RemixRotationAsset[] = [];
  let placeholderUsage: RemixMaterializationReport["placeholderUsage"] = {
    used: false,
    count: 0,
    placeholders: []
  };
  let premiumPlaceholderCatalog: PremiumComicsPlaceholderAsset[] = [];

  const comicsPublishDiversityOptions = {
    minUniqueAssets: MIN_PUBLISH_UNIQUE_ASSETS,
    maxDominantAssetRatio: 0.4
  };

  if (
    isComicsDomain &&
    timelineScenes.length > 0 &&
    approvedAssets.filter((asset) => Boolean(asset.localPath)).length >=
      MIN_THEME_ALIGNED_COMICS_ASSETS
  ) {
    const beforeStats = computeTimelineRotationStats(timelineScenes);
    const rotationAssets: RemixRotationAsset[] = approvedAssets
      .filter((asset) => isFfmpegRenderableAssetPath(asset.localPath ?? null))
      .map((asset) => {
        const quality = evaluateRemixAssetQuality(asset, entities, plan.targetStyle);
        return {
          id: asset.id,
          title: asset.title,
          path: asset.localPath ?? null,
          sourceUrl: asset.sourceUrl ?? null,
          score: quality.score,
          category: quality.category,
          recommendedScene: asset.suggestedSceneRole ?? null
        };
      })
      .filter((asset) => asset.score >= (comicsThemeAnalysis ? 38 : 55));

    const supplemented = supplementRotationPoolWithPremiumPlaceholders(
      [...rotationAssets],
      comicsThemeAnalysis,
      MIN_PUBLISH_UNIQUE_ASSETS,
      isFfmpegRenderableAssetPath
    );
    premiumPlaceholderCatalog = supplemented.placeholdersAdded;
    if (supplemented.placeholdersAdded.length > 0) {
      placeholderUsage = {
        used: true,
        count: supplemented.placeholdersAdded.length,
        placeholders: supplemented.placeholdersAdded.map((entry) => entry.id)
      };
      warnings.push(`premium_placeholder_pool_added:${supplemented.placeholdersAdded.length}`);
    }
    const rotationPool = supplemented.pool;

    const rawThemeAnalysis = analyzeComicsVideoThemeFromAnalysis(plan.videoAnalysis);
    const themeAnalysis = isActionableComicsThemeAnalysis(rawThemeAnalysis)
      ? rawThemeAnalysis
      : null;
    const themePool = themeAnalysis
      ? rotationPool.map((asset) => rotationAssetToThemedCandidate(asset, themeAnalysis))
      : [];

    const hookSelection = themeAnalysis
      ? selectAssetForThemedBeat({
          beatRole: "hook",
          themeAnalysis,
          acceptedAssets: themePool
        })
      : { asset: null, reason: "theme_analysis_not_actionable" };
    const climaxSelection = themeAnalysis
      ? selectAssetForThemedBeat({
          beatRole: "climax",
          themeAnalysis,
          acceptedAssets: themePool,
          excludeIds: hookSelection.asset ? [hookSelection.asset.id] : []
        })
      : { asset: null, reason: "theme_analysis_not_actionable" };

    const hookRotationAsset =
      resolveThemedRotationAsset(rotationPool, hookSelection.asset?.id) ??
      ([...rotationPool]
        .map((asset) => ({
          asset,
          timelineScore: scoreAssetForTimelineRotation(asset, "hook")
        }))
        .filter((entry) => entry.timelineScore >= 70)
        .sort((left, right) => right.timelineScore - left.timelineScore)[0]?.asset ??
        null);
    const climaxRotationAsset =
      resolveThemedRotationAsset(rotationPool, climaxSelection.asset?.id) ??
      ([...rotationPool]
        .filter((asset) => asset.id !== hookRotationAsset?.id)
        .map((asset) => ({
          asset,
          timelineScore: scoreAssetForTimelineRotation(asset, "climax")
        }))
        .filter((entry) => entry.timelineScore >= 70)
        .sort((left, right) => right.timelineScore - left.timelineScore)[0]?.asset ??
        null);

    const rotationPlan = buildRemixAssetRotationPlan({
      durationSeconds: plan.durationSeconds,
      targetStyle: plan.targetStyle,
      timelineScenes: timelineScenes.map((scene) => ({
        sceneId: scene.sceneId,
        role: scene.sceneRole,
        startSec: scene.startSec,
        endSec: scene.endSec,
        currentAssetPath: scene.assetPath,
        visualSourceType: scene.visualSourceType
      })),
      acceptedAssets: rotationPool,
      hookAsset: hookRotationAsset,
      climaxAsset: climaxRotationAsset,
      themeAnalysis,
      narrationText,
      videoTitle: plan.inputVideoTitle ?? plan.videoAnalysis?.contentIntelligence?.headline ?? ""
    });

    if (themeAnalysis && hookSelection.asset) {
      warnings.push(`themed_hook:${hookSelection.reason}`);
    } else {
      warnings.push(
        themeAnalysis ? "themed_hook:fallback_timeline_scoring" : "themed_hook:skipped_weak_theme_analysis"
      );
    }
    if (themeAnalysis && climaxSelection.asset) {
      warnings.push(`themed_climax:${climaxSelection.reason}`);
    } else {
      warnings.push(
        themeAnalysis
          ? "themed_climax:fallback_timeline_scoring"
          : "themed_climax:skipped_weak_theme_analysis"
      );
    }
    if (rotationPlan.themedPoolSize != null) {
      warnings.push(`themed_rotation_pool:${rotationPlan.themedPoolSize}/${rotationPool.length}`);
    }

    timelineScenes = applyRotationPlanToMaterializedScenes(timelineScenes, rotationPlan);
    if (microSegments.length > 0) {
      timelineScenes = distributeComicsFastCutVisualDiversity(timelineScenes, rotationPool);
      warnings.push("fastcut_visual_diversity_distribution_applied");
    }
    timelineRotationStats = computeTimelineRotationStats(timelineScenes);
    warnings.push(...rotationPlan.warnings);

    rotationPlanForReport = rotationPlan;
    rotationBeforeStats = beforeStats;
    rotationAssetsForReport = rotationPool;

    rotationTimelineValidation = validateVisualTimelineReadiness(
      timelineRotationStats,
      calculateSourceFootprintRatio({
        timelineScenes: timelineScenes.map((scene) => ({
          visualSourceType: scene.visualSourceType,
          assetPath: scene.assetPath,
          durationSeconds: Math.max(0.1, scene.endSec - scene.startSec)
        }))
      }),
      comicsPublishDiversityOptions
    );
  }

  timelineScenes = fillMissingTimelineCaptions(
    timelineScenes,
    captionCues,
    narrationBeats,
    captionPlanScenes
  );

  const rasterSanitization = sanitizeNonRasterTimelineScenes(timelineScenes, approvedAssets, {
    themeAnalysis: comicsThemeAnalysis,
    narrationText,
    videoTitle,
    entities,
    targetStyle: plan.targetStyle,
    premiumPlaceholders: premiumPlaceholderCatalog
  });
  if (rasterSanitization.warnings.length > 0) {
    timelineScenes = rasterSanitization.scenes;
    warnings.push(...rasterSanitization.warnings);
  }

  if (
    isComicsDomain &&
    microSegments.length > 0 &&
    rotationAssetsForReport.length > 0
  ) {
    let postSanitizeStats = computeTimelineRotationStats(timelineScenes);
    if (postSanitizeStats.uniqueAssetCount < MIN_PUBLISH_UNIQUE_ASSETS) {
      timelineScenes = distributeComicsFastCutVisualDiversity(
        timelineScenes,
        rotationAssetsForReport
      );
      warnings.push("post_sanitize_visual_diversity_redistribution_applied");
      postSanitizeStats = computeTimelineRotationStats(timelineScenes);
    }
    timelineRotationStats = postSanitizeStats;
    rotationTimelineValidation = validateVisualTimelineReadiness(
      postSanitizeStats,
      calculateSourceFootprintRatio({
        timelineScenes: timelineScenes.map((scene) => ({
          visualSourceType: scene.visualSourceType,
          assetPath: scene.assetPath,
          durationSeconds: Math.max(0.1, scene.endSec - scene.startSec)
        }))
      }),
      comicsPublishDiversityOptions
    );
  } else if (rasterSanitization.warnings.length > 0 && isComicsDomain && timelineScenes.length > 0) {
    timelineRotationStats = computeTimelineRotationStats(timelineScenes);
    rotationTimelineValidation = validateVisualTimelineReadiness(
      timelineRotationStats,
      calculateSourceFootprintRatio({
        timelineScenes: timelineScenes.map((scene) => ({
          visualSourceType: scene.visualSourceType,
          assetPath: scene.assetPath,
          durationSeconds: Math.max(0.1, scene.endSec - scene.startSec)
        }))
      }),
      comicsPublishDiversityOptions
    );
  }

  if (isComicsDomain) {
    const usedPlaceholderIds = [
      ...new Set(
        timelineScenes
          .filter((scene) =>
            isScenePremiumComicsPlaceholder({
              assetId: scene.assetId,
              visualSourceType: scene.visualSourceType,
              selectionReason: scene.selectionReason
            })
          )
          .map((scene) => scene.assetId)
          .filter((id): id is string => Boolean(id))
      )
    ];
    if (usedPlaceholderIds.length > 0) {
      placeholderUsage = {
        used: true,
        count: usedPlaceholderIds.length,
        placeholders: usedPlaceholderIds
      };
    }
  }

  const footprintInput: TimelineSceneFootprint[] = timelineScenes.map((scene) => ({
    visualSourceType: scene.visualSourceType,
    assetPath: scene.assetPath,
    sourcePath: scene.visualSourceType === "reference_video" ? plan.inputVideoPath : null,
    durationSeconds: Math.max(0.1, scene.endSec - scene.startSec)
  }));

  const sourceFootprintRatio = calculateSourceFootprintRatio({
    timelineScenes: footprintInput,
    referenceVideoPath: plan.inputVideoPath
  });

  const footprintValidation = validateSourceFootprint({
    sourceFootprintRatio,
    allowReferenceVideoInFinal: allowReference,
    maxAllowedSourceFootprintRatio: input.maxAllowedSourceFootprintRatio ?? 0.2
  });

  warnings.push(...footprintValidation.warnings);

  const sceneHasPublishableVisual = (scene: MaterializedTimelineScene) =>
    Boolean(
      scene.assetPath &&
        scene.visualSourceType !== "placeholder" &&
        scene.visualSourceType !== "reference_video"
    ) ||
    isScenePremiumComicsPlaceholder({
      assetId: scene.assetId,
      visualSourceType: scene.visualSourceType,
      selectionReason: scene.selectionReason
    });

  const scenesWithRealAssets = timelineScenes.filter(
    (scene) =>
      scene.assetPath &&
      scene.visualSourceType !== "placeholder" &&
      scene.visualSourceType !== "reference_video"
  ).length;

  const scenesWithApprovedVisuals = timelineScenes.filter(sceneHasPublishableVisual).length;

  const timelineDenominator = timelineScenes.length > 0 ? timelineScenes.length : segments.length;
  const providedAssetsUsageRatio =
    timelineDenominator > 0
      ? Number((scenesWithApprovedVisuals / timelineDenominator).toFixed(4))
      : 0;

  const minRequiredCoverage = 0.5;
  const hasPremiumPlaceholderScenes = timelineScenes.some((scene) =>
    isScenePremiumComicsPlaceholder({
      assetId: scene.assetId,
      visualSourceType: scene.visualSourceType,
      selectionReason: scene.selectionReason
    })
  );
  const hasPlaceholderOnly =
    hasPremiumPlaceholderScenes ||
    timelineScenes.some((scene) => scene.visualSourceType === "placeholder" && !scene.assetPath);

  let canRender = footprintValidation.ok && scenesWithRealAssets > 0;
  let blockReason: string | null = null;
  let comicsAssetSelectionReportPath: string | null = null;
  let visualAssetAuditReportPath: string | null = null;
  let visualAssetContactSheetPath: string | null = null;

  if (!footprintValidation.ok) {
    canRender = false;
    blockReason = footprintValidation.reason ?? "reference_video_blocked_as_final_visual";
  } else if (scenesWithRealAssets === 0) {
    canRender = false;
    blockReason = INSUFFICIENT_ASSETS_ERROR;
    warnings.push("no_approved_assets_materialized");
  } else if (
    hasPlaceholderOnly &&
    !hasPremiumPlaceholderScenes &&
    providedAssetsUsageRatio < minRequiredCoverage
  ) {
    canRender = false;
    blockReason = INSUFFICIENT_ASSETS_ERROR;
    warnings.push(
      `insufficient_scene_coverage:${(providedAssetsUsageRatio * 100).toFixed(0)}%`
    );
  }

  if (rotationTimelineValidation && !rotationTimelineValidation.ok) {
    canRender = false;
    blockReason =
      blockReason ??
      rotationTimelineValidation.blockReason ??
      INSUFFICIENT_THEME_ALIGNED_VISUAL_DIVERSITY;
    warnings.push(...rotationTimelineValidation.warnings);
  }

  if (
    isComicsDomain &&
    comicsThemeAnalysis &&
    approvedAssets.length < MIN_THEME_ALIGNED_COMICS_ASSETS
  ) {
    canRender = false;
    blockReason = blockReason ?? INSUFFICIENT_THEME_ALIGNED_ASSETS;
    warnings.push(
      `insufficient_theme_aligned_assets_after_filtering:${approvedAssets.length}`
    );
  }

  if (isComicsDomain) {
    const sceneAssignments = new Map<string, string[]>();
    for (const scene of timelineScenes) {
      if (!scene.assetId) continue;
      const current = sceneAssignments.get(scene.assetId) ?? [];
      current.push(scene.sceneId);
      sceneAssignments.set(scene.assetId, current);
    }

    const hookScene = timelineScenes.find((scene) => scene.sceneRole === "hook");
    const climaxScene = timelineScenes.find((scene) => scene.sceneRole === "climax");

    const evaluatedById = new Map<
      string,
      { asset: RemixAssetLike; quality: ReturnType<typeof evaluateRemixAssetQuality>; sourceUrl?: string | null }
    >();

    for (const candidate of candidates) {
      const asset = candidateToAssetLike(candidate);
      const importResult = importById.get(candidate.candidateId);
      if (importResult?.localPath) {
        asset.localPath = resolve(projectRoot, importResult.localPath);
        asset.width = importResult.width;
        asset.height = importResult.height;
      }
      const quality = evaluateRemixAssetQuality(asset, entities, plan.targetStyle);
      evaluatedById.set(asset.id, { asset, quality, sourceUrl: candidate.sourceUrl });
    }

    for (const asset of approvedAssets) {
      if (evaluatedById.has(asset.id)) continue;
      const quality = evaluateRemixAssetQuality(asset, entities, plan.targetStyle);
      evaluatedById.set(asset.id, { asset, quality, sourceUrl: asset.sourceUrl ?? null });
    }

    const evaluatedCandidates = [...evaluatedById.values()];

    const comicsSelection = buildComicsAssetSelectionReport({
      entities,
      candidates: evaluatedCandidates,
      sceneAssignments,
      hookAssetId: hookScene?.assetId ?? null,
      climaxAssetId: climaxScene?.assetId ?? null
    });

    comicsAssetSelectionReportPath = await saveComicsAssetSelectionReport(
      comicsSelection,
      projectRoot
    );

    if (!comicsSelection.canRender) {
      canRender = false;
      blockReason =
        blockReason ?? comicsSelection.blockReason ?? INSUFFICIENT_HIGH_QUALITY_COMICS_ASSETS;
      warnings.push(...comicsSelection.warnings);
    } else if (
      hookScene?.visualSourceType === "placeholder" ||
      climaxScene?.visualSourceType === "placeholder"
    ) {
      canRender = false;
      blockReason = INSUFFICIENT_HIGH_QUALITY_COMICS_ASSETS;
      warnings.push("hook_or_climax_used_placeholder_instead_of_premium_comics_asset");
    }

    const assetById = new Map<string, RemixAssetLike>();
    for (const entry of evaluatedCandidates) {
      assetById.set(entry.asset.id, entry.asset);
    }
    for (const asset of approvedAssets) {
      if (!assetById.has(asset.id)) assetById.set(asset.id, asset);
    }

    const visualAudit = await runComicsVisualAssetAudit({
      timelineScenes,
      assetById,
      selectionReport: comicsSelection,
      projectRoot
    });
    visualAssetAuditReportPath = visualAudit.reportPath;
    visualAssetContactSheetPath = visualAudit.contactSheetPath;
    warnings.push(...visualAudit.report.warnings);

    if (!visualAudit.report.canRender) {
      canRender = false;
      blockReason =
        blockReason ?? visualAudit.report.blockReason ?? INSUFFICIENT_TRUE_COMICS_ASSETS;
    }
  }

  if (rotationPlanForReport && rotationBeforeStats) {
    const rotationReport = buildRemixAssetRotationReport({
      variation: plan.variationLabel ?? "B — Comics",
      targetStyle: plan.targetStyle,
      before: rotationBeforeStats,
      plan: rotationPlanForReport,
      acceptedAssets: rotationAssetsForReport,
      durationSeconds: plan.durationSeconds,
      visualVariationGuard:
        rotationTimelineValidation ??
        validateVisualTimelineReadiness(rotationPlanForReport.stats, sourceFootprintRatio),
      sourceFootprintGuard: {
        ok: footprintValidation.ok,
        ...(footprintValidation.reason ? { reason: footprintValidation.reason } : {}),
        warnings: footprintValidation.warnings,
        sourceFootprintRatio
      },
      materializationGuard: {
        ok: scenesWithRealAssets > 0 && providedAssetsUsageRatio >= minRequiredCoverage,
        blockReason:
          scenesWithRealAssets === 0
            ? INSUFFICIENT_ASSETS_ERROR
            : providedAssetsUsageRatio < minRequiredCoverage
              ? INSUFFICIENT_ASSETS_ERROR
              : null,
        providedAssetsUsageRatio,
        scenesWithRealAssets
      },
      canRender,
      blockReason,
      extraWarnings: warnings
    });

    assetRotationReportPath = join(projectRoot, "tmp", "variation-b-asset-rotation-report.json");
    await writeFile(assetRotationReportPath, JSON.stringify(rotationReport, null, 2), "utf8");
  }

  let canPublish = false;
  let publishBlockReason: string | null = NOT_READY_FOR_PUBLICATION;
  let renderBlockReason: string | null = blockReason;
  let narrativeReady = false;
  let captionReady = false;
  let publishReadinessReportPath: string | null = null;
  let publishReadinessContactSheetPath: string | null = null;

  if (isComicsDomain) {
    const themeAnalysis: ComicsThemeAnalysis = analyzeComicsVideoThemeFromAnalysis(plan.videoAnalysis);
    const assetMetaById = new Map<string, { title: string; category?: string; score?: number }>();
    for (const asset of approvedAssets) {
      assetMetaById.set(asset.id, {
        title: asset.title,
        category: evaluateRemixAssetQuality(asset, entities, plan.targetStyle).category,
        score: evaluateRemixAssetQuality(asset, entities, plan.targetStyle).score
      });
    }
    for (const placeholder of premiumPlaceholderCatalog) {
      assetMetaById.set(placeholder.id, {
        title: placeholder.title,
        category: PREMIUM_PLACEHOLDER_COMICS_CATEGORY,
        score: 72
      });
    }
    for (const candidate of candidates) {
      if (!assetMetaById.has(candidate.candidateId)) {
        const quality = evaluateRemixAssetQuality(candidateToAssetLike(candidate), entities, plan.targetStyle);
        assetMetaById.set(candidate.candidateId, {
          title: candidate.title,
          category: quality.category,
          score: quality.score
        });
      }
    }

    const publishBundle = await buildComicsPublishReadinessReport({
      variation: plan.variationLabel ?? "B — Comics",
      targetStyle: plan.targetStyle,
      videoTitle: plan.inputVideoTitle ?? plan.videoAnalysis?.contentIntelligence?.headline ?? "",
      narrationText,
      themeAnalysis,
      materialization: {
        referenceVideoPath: plan.inputVideoPath,
        allowReferenceVideoInFinal: allowReference,
        sourceFootprintRatio,
        providedAssetsUsageRatio,
        approvedAssetsUsed: [...usedAssetIds],
        rejectedAssets,
        timelineScenes,
        canRender,
        blockReason,
        warnings,
        plannedButNotMaterialized,
        captionStyleId,
        captionCues,
        musicPresetId: plan.musicPlan?.musicPresetId ?? null,
        fastCutCount: plan.fastCutPlan?.cutTimes?.length ?? 0,
        sceneStructureSceneCount: segments.length,
        materializedFastCutCount: microSegments.length,
        timelineMode: microSegments.length > 0 ? "fast_cut" : "scene_structure",
        comicsAssetSelectionReportPath,
        visualAssetAuditReportPath,
        visualAssetContactSheetPath,
        assetRotationReportPath,
        timelineRotationStats,
        canPublish: false,
        publishBlockReason: null,
        publishReadinessReportPath: null,
        publishReadinessContactSheetPath: null,
        themeFilterCache,
        placeholderUsage,
        narrativeReady: false,
        captionReady: false,
        renderBlockReason: blockReason
      },
      assetMetaById,
      projectRoot,
      cache: themeFilterCache
    });

    canPublish = publishBundle.report.canPublish;
    publishBlockReason = publishBundle.report.publishBlockReason;
    renderBlockReason = publishBundle.report.renderBlockReason;
    narrativeReady = publishBundle.report.narrativeReady;
    captionReady = publishBundle.report.captionReady;
    canRender = publishBundle.report.canRender;
    blockReason = canRender ? null : renderBlockReason;
    publishReadinessReportPath = publishBundle.reportPath;
    publishReadinessContactSheetPath = publishBundle.contactSheetPath;
    warnings.push(
      canPublish ? "publish_readiness:ok" : `publish_readiness_blocked:${publishBlockReason ?? "unknown"}`
    );
    if (!canPublish) {
      warnings.push(NOT_READY_FOR_PUBLICATION);
    }
  } else {
    canPublish = canRender;
    publishBlockReason = canRender ? null : blockReason;
  }

  return {
    referenceVideoPath: plan.inputVideoPath,
    allowReferenceVideoInFinal: allowReference,
    sourceFootprintRatio,
    providedAssetsUsageRatio,
    approvedAssetsUsed: [...usedAssetIds],
    rejectedAssets,
    timelineScenes,
    canRender,
    blockReason,
    warnings,
    plannedButNotMaterialized,
    captionStyleId,
    captionCues,
    musicPresetId: plan.musicPlan?.musicPresetId ?? null,
    fastCutCount: plan.fastCutPlan?.cutTimes?.length ?? 0,
    sceneStructureSceneCount: segments.length,
    materializedFastCutCount: microSegments.length,
    timelineMode: microSegments.length > 0 ? "fast_cut" : "scene_structure",
    comicsAssetSelectionReportPath,
    visualAssetAuditReportPath,
    visualAssetContactSheetPath,
    assetRotationReportPath,
    timelineRotationStats,
    canPublish,
    publishBlockReason,
    publishReadinessReportPath,
    publishReadinessContactSheetPath,
    themeFilterCache,
    narrativeReady,
    captionReady,
    renderBlockReason: canRender ? null : renderBlockReason,
    placeholderUsage
  };
}

export async function saveRemixMaterializationReport(
  report: RemixMaterializationReport,
  projectRoot?: string
): Promise<string> {
  const root = projectRoot ?? process.cwd();
  const outputPath = join(root, "tmp", "remix-materialization-report.json");
  await writeFile(outputPath, JSON.stringify(report, null, 2), "utf8");
  return outputPath;
}

export {
  INSUFFICIENT_ASSETS_ERROR,
  INSUFFICIENT_HIGH_QUALITY_COMICS_ASSETS,
  INSUFFICIENT_TRUE_COMICS_ASSETS,
  TIMELINE_NOT_READY
};