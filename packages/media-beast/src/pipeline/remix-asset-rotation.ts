import type { ComicsAssetCategory } from "./comics-asset-quality-gate.js";
import {
  isPremiumComicsPlaceholderAsset,
  MIN_PUBLISH_UNIQUE_ASSETS
} from "./comics-premium-placeholder-assets.js";
import { isThemeRejectedComicsAsset } from "./comics-theme-asset-validator.js";
import {
  isActionableComicsThemeAnalysis,
  MIN_THEME_MATCH_SCORE,
  scoreAssetForThemedSelection,
  type ComicsBeatRole,
  type ComicsThemeAnalysis
} from "./comics-theme-intelligence.js";

export type MaterializedSceneWithMotion = {
  sceneId: string;
  startSec: number;
  endSec: number;
  visualSourceType: string;
  assetPath: string | null;
  assetId: string | null;
  caption: string;
  narration: string;
  transition: string;
  sfx: string;
  sceneRole: string;
  plannedSourceSegment: string;
  selectionReason: string;
  motion?: string;
};

export type RemixRotationAsset = {
  id?: string;
  title?: string;
  path?: string | null;
  sourceUrl?: string | null;
  score: number;
  category: string;
  recommendedScene?: string | null;
};

export type RemixRotationTimelineInput = {
  sceneId: string;
  role: string;
  startSec: number;
  endSec: number;
  currentAssetPath?: string | null;
  visualSourceType?: string;
};

export type RotatedTimelineScene = {
  sceneId: string;
  role: string;
  startSec: number;
  endSec: number;
  assetPath: string | null;
  assetId?: string | null;
  assetTitle?: string | null;
  visualSourceType: string;
  motion: string;
  transition: string;
  reason: string;
};

export type TimelineRotationStats = {
  visualSegmentCount: number;
  uniqueAssetCount: number;
  dominantAssetRatio: number;
  longestStaticSegmentSec: number;
  dominantAssetId: string | null;
  dominantAssetTitle: string | null;
};

export type RemixAssetRotationPlan = {
  timelineScenes: RotatedTimelineScene[];
  beatWindows: Array<{
    role: string;
    startSec: number;
    endSec: number;
    assetId: string | null;
    assetTitle: string | null;
    motion: string;
  }>;
  stats: TimelineRotationStats;
  warnings: string[];
  themeAnalysis?: ComicsThemeAnalysis;
  themedPoolSize?: number;
};

export const TIMELINE_NOT_READY = "timeline_not_ready";
export const INSUFFICIENT_THEME_ALIGNED_VISUAL_DIVERSITY =
  "insufficient_theme_aligned_visual_diversity";
export const RENDER_NOT_READY_INSUFFICIENT_VISUAL_DIVERSITY =
  "render_not_ready:insufficient_visual_diversity";
export const MAX_DOMINANT_ASSET_RATIO = 0.4;
export const MAX_STATIC_SEGMENT_SEC = 6;
export const MAX_SINGLE_ASSET_SHARE = 0.4;
export const MIN_UNIQUE_ASSETS = 5;
export const MIN_VISUAL_SEGMENTS = 6;

const TIMELINE_SUPPORT_ONLY_PATTERNS: RegExp[] = [
  /\bcoloring page\b/i,
  /\bcolor page\b/i,
  /\blego\b/i,
  /\bconvention\b/i,
  /\bcomic-con\b/i,
  /\bww st louis\b/i,
  /\bwizard world\b/i,
  /\bnycc\b/i,
  /\banime expo\b/i,
  /\binternet archive past\b/i,
  /\bflickr past lead\b/i,
  /\bflickr present lead\b/i,
  /\bdeep item discovery\b/i,
  /\bhistorical image collections\b/i,
  /\bcollection:\b/i,
  /\bsuperhero in real life\b/i,
  /\breal life\b/i,
  /\bsketchfab\b/i,
  /\b3d model\b/i,
  /\bcolorify\b/i
];

const MOVIE_POSTER_PATTERNS: RegExp[] = [
  /\bposter\b/i,
  /\blet there be carnage\b/i,
  /\bmovie\b/i,
  /\bfilm\b/i,
  /\bhollywood\b/i
];

const PREMIUM_CATEGORIES = new Set<ComicsAssetCategory>([
  "comic_panel",
  "comic_cover",
  "character_art"
]);

function probeTitle(asset: RemixRotationAsset): string {
  return `${asset.title ?? ""} ${asset.sourceUrl ?? ""}`.toLowerCase();
}

function isTimelineSupportOnlyAsset(asset: RemixRotationAsset): boolean {
  const text = probeTitle(asset);
  if (TIMELINE_SUPPORT_ONLY_PATTERNS.some((pattern) => pattern.test(text))) {
    return true;
  }
  if (MOVIE_POSTER_PATTERNS.some((pattern) => pattern.test(text))) {
    return true;
  }
  if (/\b(search\?|\/search\/|collection:|free download, borrow|wikimedia commons\/?$)/i.test(text)) {
    return true;
  }
  const title = (asset.title ?? "").trim();
  if (title.length > 0 && title.length < 12 && !/\b(comic|venom|spider|symbiote|marvel)\b/i.test(title)) {
    return true;
  }
  return false;
}

export function scoreAssetForTimelineRotation(
  asset: RemixRotationAsset,
  sceneRole: string
): number {
  let score = asset.score;
  const text = probeTitle(asset);

  if (PREMIUM_CATEGORIES.has(asset.category as ComicsAssetCategory)) {
    score += asset.category === "comic_panel" ? 12 : asset.category === "comic_cover" ? 10 : 8;
  }

  if (/\bcomic panel\b|\bcomic cover\b|\billustration\b|\bsymbiote\b/i.test(text)) {
    score += 8;
  }

  for (const pattern of TIMELINE_SUPPORT_ONLY_PATTERNS) {
    if (pattern.test(text)) {
      score -= 28;
    }
  }

  if (MOVIE_POSTER_PATTERNS.some((pattern) => pattern.test(text))) {
    score -= sceneRole === "hook" || sceneRole === "climax" ? 22 : 10;
  }

  if (asset.recommendedScene && asset.recommendedScene === sceneRole) {
    score += 6;
  }

  const title = (asset.title ?? "").trim();
  if (title.length > 0 && title.length < 14) {
    score -= 12;
  }
  if (/^venom\b|^spider-man\b|^symbiote\b/i.test(title) && !/\b(comic|panel|cover|illustration|art)\b/i.test(text)) {
    score -= 10;
  }

  return Math.max(0, Math.round(score));
}

export function mapRotationRoleToThemedBeat(role: string): ComicsBeatRole {
  const base = baseRole(role);
  switch (base) {
    case "hook":
      return "hook";
    case "context":
      return "context";
    case "curiosity":
      return "curiosity";
    case "development_a":
    case "development_b":
      return "development";
    case "climax_setup":
      return "climax";
    case "climax":
      return "climax";
    case "outro":
    case "outro_a":
    case "outro_b":
    case "loop_closing":
      return "closing";
    default:
      return "development";
  }
}

export function scoreAssetForThemedTimelineRotation(
  asset: RemixRotationAsset,
  sceneRole: string,
  themeAnalysis?: ComicsThemeAnalysis | null,
  narrationText?: string,
  videoTitle = ""
): number {
  const base = scoreAssetForTimelineRotation(asset, sceneRole);
  if (!themeAnalysis) return base;

  if (
    isThemeRejectedComicsAsset({
      assetTitle: asset.title ?? null,
      themeAnalysis,
      narrationText: narrationText ?? "",
      videoTitle
    })
  ) {
    return Math.max(0, Math.round(base * 0.05));
  }

  const beatRole = mapRotationRoleToThemedBeat(sceneRole);
  const themed = scoreAssetForThemedSelection({
    id: asset.id ?? asset.title ?? "rotation-asset",
    title: asset.title ?? "",
    category: (asset.category as ComicsAssetCategory) ?? "unknown",
    assetQualityScore: asset.score,
    themeAnalysis,
    beatRole
  });

  if (
    themed.relevance === "reject" ||
    themed.relevance === "generic_entity_match" ||
    themed.themeMatchScore < MIN_THEME_MATCH_SCORE
  ) {
    return Math.max(0, Math.round(base * 0.25));
  }

  return Math.round(base * 0.35 + themed.themedFinalScore * 0.65);
}

export function isAssetThemeEligibleForTimeline(
  asset: RemixRotationAsset,
  themeAnalysis: ComicsThemeAnalysis,
  narrationText = "",
  videoTitle = ""
): boolean {
  if (
    isThemeRejectedComicsAsset({
      assetTitle: asset.title ?? null,
      themeAnalysis,
      narrationText,
      videoTitle
    })
  ) {
    return false;
  }

  const themed = scoreAssetForThemedSelection({
    id: asset.id ?? asset.title ?? "rotation-asset",
    title: asset.title ?? "",
    category: (asset.category as ComicsAssetCategory) ?? "unknown",
    assetQualityScore: asset.score,
    themeAnalysis
  });

  if (themed.relevance === "reject" || themed.relevance === "generic_entity_match") {
    return false;
  }
  if (themed.themeMatchScore < MIN_THEME_MATCH_SCORE) return false;
  if (
    themed.themeNegativeSignals.some((signal) =>
      themeAnalysis.disallowedAssetSignals.includes(signal)
    )
  ) {
    return false;
  }
  return themed.subjectOk || themed.themeMatchScore >= 36;
}

function filterPoolByTheme(
  pool: RemixRotationAsset[],
  themeAnalysis: ComicsThemeAnalysis,
  narrationText = "",
  videoTitle = ""
): { pool: RemixRotationAsset[]; warnings: string[] } {
  const themed = pool.filter((asset) =>
    isAssetThemeEligibleForTimeline(asset, themeAnalysis, narrationText, videoTitle)
  );
  const warnings: string[] = [];
  if (themed.length < MIN_UNIQUE_ASSETS) {
    const relaxed = pool.filter((asset) => {
      if (
        isThemeRejectedComicsAsset({
          assetTitle: asset.title ?? null,
          themeAnalysis,
          narrationText,
          videoTitle
        })
      ) {
        return false;
      }
      const scored = scoreAssetForThemedSelection({
        id: asset.id ?? asset.title ?? "rotation-asset",
        title: asset.title ?? "",
        category: (asset.category as ComicsAssetCategory) ?? "unknown",
        assetQualityScore: asset.score,
        themeAnalysis
      });
      return scored.themeMatchScore >= 20 && scored.relevance !== "reject";
    });
    warnings.push(
      `theme_pool_relaxed:${themed.length}_strict_${relaxed.length}_relaxed`
    );
    return { pool: relaxed.length >= themed.length ? relaxed : pool, warnings };
  }
  return { pool: themed, warnings };
}

function motionForRole(role: string, index: number): string {
  switch (role) {
    case "hook":
      return "punch_zoom";
    case "context":
      return index % 2 === 0 ? "slow_zoom_in" : "pan_right";
    case "curiosity":
      return "push_in";
    case "development_a":
      return index % 2 === 0 ? "pan_left" : "comic_panel_drift";
    case "development_b":
      return index % 2 === 0 ? "slow_zoom_in" : "pan_right";
    case "climax_setup":
      return "push_in";
    case "climax":
      return "punch_zoom";
    case "outro":
    case "outro_a":
      return "zoom_out";
    case "outro_b":
      return "pull_out";
    case "loop_closing":
      return "pull_out";
    default:
      return index % 2 === 0 ? "comic_panel_drift" : "halftone_pulse";
  }
}

function transitionForRole(role: string): string {
  if (role === "hook" || role === "climax") return "flash-cut";
  if (role === "climax_setup") return "cut";
  return "cut";
}

const MAX_BEAT_WINDOW_SEC = 5;

function expandBeatWindowsForRotation(
  windows: Array<{ role: string; startSec: number; endSec: number }>
): Array<{ role: string; startSec: number; endSec: number }> {
  const expanded: Array<{ role: string; startSec: number; endSec: number }> = [];

  for (const beat of windows) {
    const duration = beat.endSec - beat.startSec;
    if (duration <= MAX_BEAT_WINDOW_SEC) {
      expanded.push(beat);
      continue;
    }

    const sliceCount = Math.ceil(duration / MAX_BEAT_WINDOW_SEC);
    const sliceDuration = duration / sliceCount;
    for (let index = 0; index < sliceCount; index += 1) {
      const startSec = beat.startSec + sliceDuration * index;
      const endSec =
        index === sliceCount - 1 ? beat.endSec : beat.startSec + sliceDuration * (index + 1);
      expanded.push({
        role: sliceCount > 1 ? `${beat.role}_${index + 1}` : beat.role,
        startSec,
        endSec
      });
    }
  }

  return expanded;
}

export function buildComicsBeatWindows(durationSeconds: number): Array<{
  role: string;
  startSec: number;
  endSec: number;
}> {
  const end = Math.max(8, durationSeconds);
  if (end >= 36) {
    return [
      { role: "hook", startSec: 0, endSec: 3 },
      { role: "context", startSec: 3, endSec: 8 },
      { role: "curiosity", startSec: 8, endSec: 14 },
      { role: "development_a", startSec: 14, endSec: 20 },
      { role: "development_b", startSec: 20, endSec: 26 },
      { role: "climax_setup", startSec: 26, endSec: 32 },
      { role: "climax", startSec: 32, endSec: 36 },
      { role: "outro", startSec: 36, endSec: end }
    ];
  }

  const slice = end / 8;
  return [
    { role: "hook", startSec: 0, endSec: slice },
    { role: "context", startSec: slice, endSec: slice * 2 },
    { role: "curiosity", startSec: slice * 2, endSec: slice * 3 },
    { role: "development_a", startSec: slice * 3, endSec: slice * 4 },
    { role: "development_b", startSec: slice * 4, endSec: slice * 5 },
    { role: "climax_setup", startSec: slice * 5, endSec: slice * 6 },
    { role: "climax", startSec: slice * 6, endSec: slice * 7 },
    { role: "outro", startSec: slice * 7, endSec: end }
  ];
}

function resolveRotationAsset(
  asset: RemixRotationAsset | null | undefined
): { id: string | null; title: string | null; path: string | null } {
  if (!asset) return { id: null, title: null, path: null };
  return {
    id: asset.id ?? asset.title ?? null,
    title: asset.title ?? null,
    path: asset.path ?? null
  };
}

function pickAssetForBeat(
  pool: RemixRotationAsset[],
  role: string,
  previousId: string | null,
  forced: RemixRotationAsset | null | undefined,
  assetUsageSec: Map<string, number>,
  totalDuration: number,
  beatDuration = 5,
  themeAnalysis?: ComicsThemeAnalysis | null,
  narrationText?: string,
  videoTitle = ""
): RemixRotationAsset | null {
  if (forced?.path || forced?.id) {
    if (themeAnalysis) {
      const forcedRejected = isThemeRejectedComicsAsset({
        assetTitle: forced.title ?? null,
        themeAnalysis,
        narrationText: narrationText ?? "",
        videoTitle
      });
      if (forcedRejected) {
        forced = null;
      }
    }
    if (forced?.path || forced?.id) {
      return forced;
    }
  }

  const primaryBeat =
    role === "hook" ||
    role === "climax" ||
    role === "climax_setup" ||
    role === "curiosity";
  const eligiblePool =
    themeAnalysis != null
      ? pool.filter(
          (asset) =>
            !isThemeRejectedComicsAsset({
              assetTitle: asset.title ?? null,
              themeAnalysis,
              narrationText: narrationText ?? "",
              videoTitle
            })
        )
      : pool;
  const ranked = [...eligiblePool]
    .map((asset) => ({
      asset,
      score: scoreAssetForThemedTimelineRotation(
        asset,
        role,
        themeAnalysis,
        narrationText,
        videoTitle
      )
    }))
    .sort((left, right) => right.score - left.score);

  const canUseAsset = (id: string, duration: number) => {
    if (id === previousId) return false;
    const projected = (assetUsageSec.get(id) ?? 0) + duration;
    return projected / Math.max(totalDuration, 1) <= MAX_SINGLE_ASSET_SHARE;
  };

  const pickLeastUsed = (minScore: number, allowSupportOnly = false) => {
    const candidates = ranked.filter((entry) => {
      const id = entry.asset.id ?? entry.asset.title ?? "";
      if (!allowSupportOnly && primaryBeat && isTimelineSupportOnlyAsset(entry.asset)) {
        return false;
      }
      const usable =
        Boolean(id) &&
        (Boolean(entry.asset.path) ||
          isPremiumComicsPlaceholderAsset({
            id: entry.asset.id ?? null,
            category: entry.asset.category ?? null
          }));
      return usable && canUseAsset(id, beatDuration) && entry.score >= minScore;
    });

    candidates.sort((left, right) => {
      const leftId = left.asset.id ?? left.asset.title ?? "";
      const rightId = right.asset.id ?? right.asset.title ?? "";
      const usageDelta =
        (assetUsageSec.get(leftId) ?? 0) - (assetUsageSec.get(rightId) ?? 0);
      return usageDelta !== 0 ? usageDelta : right.score - left.score;
    });

    return candidates[0]?.asset ?? null;
  };

  const minPrimary = themeAnalysis ? 58 : 65;
  const minSecondary = themeAnalysis ? 48 : 55;

  return (
    pickLeastUsed(primaryBeat ? minPrimary : minSecondary) ??
    pickLeastUsed(primaryBeat ? minSecondary : 45) ??
    pickLeastUsed(themeAnalysis ? 40 : 35, true) ??
    ranked.find((entry) => {
      const id = entry.asset.id ?? entry.asset.title ?? "";
      const usable =
        Boolean(entry.asset.path) ||
        isPremiumComicsPlaceholderAsset({
          id: entry.asset.id ?? null,
          category: entry.asset.category ?? null
        });
      return Boolean(id && usable && id !== previousId);
    })?.asset ??
    null
  );
}

export function distributeComicsFastCutVisualDiversity<T extends {
  sceneId: string;
  startSec: number;
  endSec: number;
  assetId: string | null;
  assetPath: string | null;
  visualSourceType: string;
  selectionReason: string;
  assetTitle?: string | null;
}>(
  scenes: T[],
  pool: RemixRotationAsset[]
): T[] {
  const eligible = pool.filter(
    (asset) =>
      Boolean(asset.id) &&
      (Boolean(asset.path) ||
        isPremiumComicsPlaceholderAsset({
          id: asset.id ?? null,
          category: asset.category ?? null
        }))
  );
  if (eligible.length === 0) return scenes;

  let previousId: string | null = null;
  let poolIndex = 0;

  return scenes.map((scene) => {
    let picked = eligible[poolIndex % eligible.length]!;
    poolIndex += 1;
    if ((picked.id ?? null) === previousId && eligible.length > 1) {
      picked = eligible[poolIndex % eligible.length]!;
      poolIndex += 1;
    }
    previousId = picked.id ?? null;

    if (picked.path) {
      return {
        ...scene,
        assetId: picked.id ?? null,
        assetPath: picked.path,
        assetTitle: picked.title ?? picked.id ?? null,
        visualSourceType: "approved_asset",
        selectionReason: `fastcut_visual_diversity_${picked.id}`
      };
    }

    return {
      ...scene,
      assetId: picked.id ?? null,
      assetPath: null,
      assetTitle: picked.title ?? picked.id ?? null,
      visualSourceType: "placeholder",
      selectionReason: `premium_placeholder_comics_${picked.id}`
    };
  });
}

export function computeTimelineRotationStats(
  scenes: Array<{
    startSec: number;
    endSec: number;
    assetId?: string | null;
    assetPath?: string | null;
    visualSourceType?: string;
  }>
): TimelineRotationStats {
  const isCountableScene = (scene: {
    assetId?: string | null;
    assetPath?: string | null;
    visualSourceType?: string;
  }) => {
    if (scene.visualSourceType === "reference_video") return false;
    if (
      isPremiumComicsPlaceholderAsset({
        id: scene.assetId ?? null,
        sourceType: scene.visualSourceType ?? null
      })
    ) {
      return Boolean(scene.assetId);
    }
    return Boolean(scene.assetPath && scene.visualSourceType !== "placeholder");
  };

  const visualScenes = scenes.filter(isCountableScene);

  const assetDuration = new Map<string, number>();
  const assetTitles = new Map<string, string>();
  let longestStaticSegmentSec = 0;
  let currentAssetId: string | null = null;
  let currentRunSec = 0;

  for (const scene of scenes) {
    const duration = Math.max(0.01, scene.endSec - scene.startSec);
    const assetId = scene.assetId ?? (scene.assetPath ? scene.assetPath : null);
    const sceneTitle =
      "assetTitle" in scene && typeof scene.assetTitle === "string"
        ? scene.assetTitle
        : null;

    if (assetId && isCountableScene(scene)) {
      assetDuration.set(assetId, (assetDuration.get(assetId) ?? 0) + duration);
      if (sceneTitle) assetTitles.set(assetId, sceneTitle);
    }

    if (assetId && assetId === currentAssetId) {
      currentRunSec += duration;
    } else {
      longestStaticSegmentSec = Math.max(longestStaticSegmentSec, currentRunSec);
      currentAssetId = assetId;
      currentRunSec = assetId ? duration : 0;
    }
  }
  longestStaticSegmentSec = Math.max(longestStaticSegmentSec, currentRunSec);

  const totalVisualDuration = visualScenes.reduce(
    (sum, scene) => sum + Math.max(0.01, scene.endSec - scene.startSec),
    0
  );

  let dominantAssetId: string | null = null;
  let dominantAssetTitle: string | null = null;
  let maxAssetDuration = 0;
  for (const [assetId, duration] of assetDuration.entries()) {
    if (duration > maxAssetDuration) {
      maxAssetDuration = duration;
      dominantAssetId = assetId;
      dominantAssetTitle = assetTitles.get(assetId) ?? assetId;
    }
  }

  const dominantAssetRatio =
    totalVisualDuration > 0 ? maxAssetDuration / totalVisualDuration : 1;

  return {
    visualSegmentCount: visualScenes.length,
    uniqueAssetCount: assetDuration.size,
    dominantAssetRatio: Number(dominantAssetRatio.toFixed(4)),
    longestStaticSegmentSec: Number(longestStaticSegmentSec.toFixed(2)),
    dominantAssetId,
    dominantAssetTitle
  };
}

export function validateVisualTimelineReadiness(
  stats: TimelineRotationStats,
  sourceFootprintRatio = 0,
  options?: {
    minUniqueAssets?: number;
    maxDominantAssetRatio?: number;
  }
): {
  ok: boolean;
  blockReason: string | null;
  warnings: string[];
} {
  const warnings: string[] = [];
  const minUniqueAssets = options?.minUniqueAssets ?? MIN_UNIQUE_ASSETS;
  const maxDominantAssetRatio = options?.maxDominantAssetRatio ?? MAX_DOMINANT_ASSET_RATIO;

  if (stats.visualSegmentCount < MIN_VISUAL_SEGMENTS) {
    warnings.push(`visual_segment_count_below_minimum:${stats.visualSegmentCount}/${MIN_VISUAL_SEGMENTS}`);
  }
  if (stats.uniqueAssetCount < minUniqueAssets) {
    warnings.push(`unique_asset_count_below_minimum:${stats.uniqueAssetCount}/${minUniqueAssets}`);
  }
  if (stats.dominantAssetRatio > maxDominantAssetRatio) {
    warnings.push(
      `dominant_asset_ratio_exceeded:${stats.dominantAssetRatio}>${maxDominantAssetRatio}:${stats.dominantAssetTitle ?? stats.dominantAssetId}`
    );
  }
  if (stats.longestStaticSegmentSec > MAX_STATIC_SEGMENT_SEC) {
    warnings.push(
      `longest_static_segment_exceeded:${stats.longestStaticSegmentSec}s>${MAX_STATIC_SEGMENT_SEC}s`
    );
  }
  if (sourceFootprintRatio > 0.2) {
    warnings.push(`source_footprint_ratio_exceeded:${sourceFootprintRatio}`);
  }

  const ok =
    stats.visualSegmentCount >= MIN_VISUAL_SEGMENTS &&
    stats.uniqueAssetCount >= minUniqueAssets &&
    stats.dominantAssetRatio <= maxDominantAssetRatio &&
    stats.longestStaticSegmentSec <= MAX_STATIC_SEGMENT_SEC &&
    sourceFootprintRatio <= 0.2;

  return {
    ok,
    blockReason: ok ? null : TIMELINE_NOT_READY,
    warnings
  };
}

function splitLongStaticRunsInRotatedScenes(
  scenes: RotatedTimelineScene[],
  pool: RemixRotationAsset[],
  assetUsageSec: Map<string, number>,
  totalDuration: number,
  themeAnalysis?: ComicsThemeAnalysis | null,
  narrationText?: string,
  videoTitle = ""
): RotatedTimelineScene[] {
  if (scenes.length === 0) return scenes;

  const result = scenes.map((scene) => ({ ...scene }));
  const maxRunSec = MAX_STATIC_SEGMENT_SEC - 0.35;

  let runStart = 0;
  for (let index = 1; index <= result.length; index += 1) {
    const previousScene = result[index - 1]!;
    const currentScene = result[index];
    const runAssetId = result[runStart]?.assetId ?? null;
    const runBroken = !currentScene || currentScene.assetId !== runAssetId;

    if (!runBroken || !runAssetId) continue;

    const runScenes = result.slice(runStart, index);
    const runDuration = runScenes.reduce(
      (sum, scene) => sum + Math.max(0.01, scene.endSec - scene.startSec),
      0
    );

    if (runDuration > MAX_STATIC_SEGMENT_SEC) {
      let consumed = 0;
      let swapAfterIndex = -1;
      for (let sceneIndex = 0; sceneIndex < runScenes.length; sceneIndex += 1) {
        consumed += Math.max(0.01, runScenes[sceneIndex]!.endSec - runScenes[sceneIndex]!.startSec);
        if (consumed >= maxRunSec) {
          swapAfterIndex = sceneIndex;
          break;
        }
      }

      if (swapAfterIndex >= 0 && swapAfterIndex < runScenes.length - 1) {
        let previousId = runAssetId;
        for (let sceneIndex = swapAfterIndex + 1; sceneIndex < runScenes.length; sceneIndex += 1) {
          const targetIndex = runStart + sceneIndex;
          const sceneDuration = Math.max(
            0.01,
            result[targetIndex]!.endSec - result[targetIndex]!.startSec
          );
          const alternate = pickAssetForBeat(
            pool,
            baseRole(result[targetIndex]!.role),
            previousId,
            null,
            assetUsageSec,
            totalDuration,
            sceneDuration,
            themeAnalysis,
            narrationText,
            videoTitle
          );
          if (!alternate) continue;

          const resolved = resolveRotationAsset(alternate);
          const alternateId = resolved.id ?? previousId;
          assetUsageSec.set(
            alternateId,
            (assetUsageSec.get(alternateId) ?? 0) + sceneDuration
          );

          result[targetIndex] = {
            ...result[targetIndex]!,
            assetPath: resolved.path,
            assetId: resolved.id,
            assetTitle: resolved.title,
            visualSourceType: resolved.path ? "approved_asset" : "placeholder",
            motion: motionForRole(baseRole(result[targetIndex]!.role), targetIndex),
            reason: `rotation_static_split_asset_${resolved.id ?? "missing"}`
          };
          previousId = alternateId;
        }
      }
    }

    runStart = index;
  }

  return result;
}

function baseRole(role: string): string {
  return role.replace(/_\d+$/, "");
}

export function buildRemixAssetRotationPlan(input: {
  durationSeconds: number;
  targetStyle: string;
  timelineScenes: RemixRotationTimelineInput[];
  acceptedAssets: RemixRotationAsset[];
  hookAsset?: RemixRotationAsset | null;
  climaxAsset?: RemixRotationAsset | null;
  themeAnalysis?: ComicsThemeAnalysis | null;
  narrationText?: string;
  videoTitle?: string;
}): RemixAssetRotationPlan {
  const warnings: string[] = [];
  const macroBeats = buildComicsBeatWindows(input.durationSeconds);
  const beatWindows = expandBeatWindowsForRotation(macroBeats);
  const themeAnalysis = isActionableComicsThemeAnalysis(input.themeAnalysis)
    ? input.themeAnalysis
    : null;
  let pool = input.acceptedAssets.filter((asset) => Boolean(asset.path || asset.id));
  let themedPoolSize = pool.length;

  const narrationText = input.narrationText ?? input.videoTitle ?? "";
  const videoTitle = input.videoTitle ?? "";
  if (themeAnalysis) {
    const filtered = filterPoolByTheme(pool, themeAnalysis, narrationText, videoTitle);
    warnings.push(...filtered.warnings);
    pool = filtered.pool;
    themedPoolSize = pool.length;
  }
  const beatAssignments: RemixAssetRotationPlan["beatWindows"] = [];
  const assetUsageSec = new Map<string, number>();
  let previousId: string | null = null;

  const hookForced = input.hookAsset ?? null;
  const climaxForced = input.climaxAsset ?? null;

  for (const [index, beat] of beatWindows.entries()) {
    const beatDuration = Math.max(0.1, beat.endSec - beat.startSec);
    const role = baseRole(beat.role);
    let forced: RemixRotationAsset | null = null;
    if (role === "hook") forced = hookForced;
    if (role === "climax") {
      forced = climaxForced;
      const forcedId = forced?.id ?? forced?.title ?? null;
      if (forcedId && forcedId === previousId) {
        const alternateClimax = pickAssetForBeat(
          pool,
          role,
          previousId,
          null,
          assetUsageSec,
          input.durationSeconds,
          beatDuration,
          themeAnalysis,
          narrationText,
          videoTitle
        );
        if (alternateClimax) forced = alternateClimax;
      }
    }
    if (role === "outro" && hookForced) {
      const hookId = hookForced.id ?? hookForced.title ?? "";
      const hookUsage = assetUsageSec.get(hookId) ?? 0;
      if ((hookUsage + beatDuration) / Math.max(input.durationSeconds, 1) <= MAX_SINGLE_ASSET_SHARE) {
        forced = hookForced;
      }
    }

    const picked = pickAssetForBeat(
      pool,
      role,
      previousId,
      forced,
      assetUsageSec,
      input.durationSeconds,
      beatDuration,
      themeAnalysis,
      narrationText,
      videoTitle
    );
    const resolved = resolveRotationAsset(picked);
    if (resolved.id) {
      assetUsageSec.set(
        resolved.id,
        (assetUsageSec.get(resolved.id) ?? 0) + beatDuration
      );
      previousId = resolved.id;
    } else {
      warnings.push(`beat_without_asset:${role}`);
    }

    const assignment = {
      role: beat.role,
      startSec: beat.startSec,
      endSec: beat.endSec,
      assetId: resolved.id,
      assetTitle: resolved.title,
      motion: motionForRole(role, index)
    };
    beatAssignments.push(assignment);
  }

  let rotatedScenes: RotatedTimelineScene[] = input.timelineScenes.map((scene) => {
    const beat =
      beatAssignments.find(
        (entry) => scene.startSec >= entry.startSec && scene.startSec < entry.endSec
      ) ?? beatAssignments[beatAssignments.length - 1]!;

    const asset = pool.find(
      (entry) => (entry.id ?? entry.title) === beat.assetId || entry.title === beat.assetTitle
    );
    const duration = Math.max(0.01, scene.endSec - scene.startSec);
    const motion =
      duration > 2.5 ? beat.motion : duration > 1.2 ? "hold_frame" : beat.motion;

    return {
      sceneId: scene.sceneId,
      role: scene.role,
      startSec: scene.startSec,
      endSec: scene.endSec,
      assetPath: asset?.path ?? null,
      assetId: beat.assetId,
      assetTitle: beat.assetTitle,
      visualSourceType: asset?.path ? "approved_asset" : "placeholder",
      motion,
      transition: transitionForRole(baseRole(beat.role)),
      reason: `rotation_beat_${beat.role}_asset_${beat.assetId ?? "missing"}`
    };
  });

  for (let pass = 0; pass < 4; pass += 1) {
    const passStats = computeTimelineRotationStats(rotatedScenes);
    if (passStats.longestStaticSegmentSec <= MAX_STATIC_SEGMENT_SEC) break;
    rotatedScenes = splitLongStaticRunsInRotatedScenes(
      rotatedScenes,
      pool,
      assetUsageSec,
      input.durationSeconds,
      themeAnalysis,
      narrationText,
      videoTitle
    );
  }

  const stats = computeTimelineRotationStats(rotatedScenes);

  if (stats.dominantAssetRatio > MAX_DOMINANT_ASSET_RATIO) {
    warnings.push(
      `dominant_asset_after_rotation:${stats.dominantAssetTitle ?? stats.dominantAssetId}:${stats.dominantAssetRatio}`
    );
  }
  if (stats.longestStaticSegmentSec > MAX_STATIC_SEGMENT_SEC) {
    warnings.push(`static_segment_after_rotation:${stats.longestStaticSegmentSec}s`);
  }

  return {
    timelineScenes: rotatedScenes,
    beatWindows: beatAssignments,
    stats,
    warnings,
    ...(themeAnalysis ? { themeAnalysis, themedPoolSize } : {})
  };
}

export type RemixAssetRotationReportScene = {
  sceneId: string;
  role: string;
  startSec: number;
  endSec: number;
  assetTitle: string | null;
  assetPath: string | null;
  category: string;
  score: number;
  motion: string;
  transition: string;
  reason: string;
};

export type RemixAssetRotationReportUsage = {
  assetId: string | null;
  assetTitle: string | null;
  totalDurationSec: number;
  ratio: number;
  usedInScenes: string[];
};

export type RemixAssetRotationReport = {
  variation: string;
  targetStyle: string;
  before: TimelineRotationStats;
  after: TimelineRotationStats;
  timelineScenes: RemixAssetRotationReportScene[];
  assetUsage: RemixAssetRotationReportUsage[];
  beatWindows: RemixAssetRotationPlan["beatWindows"];
  guards: {
    visualVariation: ReturnType<typeof validateVisualTimelineReadiness>;
    sourceFootprint: {
      ok: boolean;
      reason?: string;
      warnings: string[];
      sourceFootprintRatio: number;
    };
    materialization: {
      ok: boolean;
      blockReason: string | null;
      providedAssetsUsageRatio: number;
      scenesWithRealAssets: number;
    };
  };
  canRender: boolean;
  blockReason: string | null;
  warnings: string[];
};

export function buildAssetUsageFromRotatedScenes(
  scenes: Array<{
    sceneId: string;
    assetId?: string | null;
    assetTitle?: string | null;
    startSec: number;
    endSec: number;
    assetPath?: string | null;
    visualSourceType?: string;
  }>,
  totalDurationSeconds: number
): RemixAssetRotationReportUsage[] {
  const usage = new Map<
    string,
    { assetTitle: string | null; totalDurationSec: number; usedInScenes: string[] }
  >();

  for (const scene of scenes) {
    if (!scene.assetPath || scene.visualSourceType === "placeholder") continue;
    const assetId = scene.assetId ?? scene.assetPath ?? "unknown";
    const duration = Math.max(0.01, scene.endSec - scene.startSec);
    const current = usage.get(assetId) ?? {
      assetTitle: scene.assetTitle ?? assetId,
      totalDurationSec: 0,
      usedInScenes: []
    };
    current.totalDurationSec += duration;
    current.usedInScenes.push(scene.sceneId);
    usage.set(assetId, current);
  }

  const totalVisual = [...usage.values()].reduce((sum, entry) => sum + entry.totalDurationSec, 0);

  return [...usage.entries()]
    .map(([assetId, entry]) => ({
      assetId,
      assetTitle: entry.assetTitle,
      totalDurationSec: Number(entry.totalDurationSec.toFixed(2)),
      ratio: Number(
        (entry.totalDurationSec / Math.max(totalVisual || totalDurationSeconds, 1)).toFixed(4)
      ),
      usedInScenes: entry.usedInScenes
    }))
    .sort((left, right) => right.totalDurationSec - left.totalDurationSec);
}

export function buildRemixAssetRotationReport(input: {
  variation: string;
  targetStyle: string;
  before: TimelineRotationStats;
  plan: RemixAssetRotationPlan;
  acceptedAssets: RemixRotationAsset[];
  durationSeconds: number;
  visualVariationGuard: ReturnType<typeof validateVisualTimelineReadiness>;
  sourceFootprintGuard: {
    ok: boolean;
    reason?: string;
    warnings: string[];
    sourceFootprintRatio: number;
  };
  materializationGuard: {
    ok: boolean;
    blockReason: string | null;
    providedAssetsUsageRatio: number;
    scenesWithRealAssets: number;
  };
  canRender: boolean;
  blockReason: string | null;
  extraWarnings?: string[];
}): RemixAssetRotationReport {
  const assetMeta = new Map(
    input.acceptedAssets.map((asset) => [
      asset.id ?? asset.title ?? "",
      { category: asset.category, score: asset.score, title: asset.title ?? null }
    ])
  );

  const timelineScenes: RemixAssetRotationReportScene[] = input.plan.timelineScenes.map((scene) => {
    const meta = assetMeta.get(scene.assetId ?? "") ?? assetMeta.get(scene.assetTitle ?? "");
    return {
      sceneId: scene.sceneId,
      role: scene.role,
      startSec: scene.startSec,
      endSec: scene.endSec,
      assetTitle: scene.assetTitle ?? null,
      assetPath: scene.assetPath,
      category: meta?.category ?? "unknown",
      score: meta?.score ?? 0,
      motion: scene.motion,
      transition: scene.transition,
      reason: scene.reason
    };
  });

  const assetUsage = buildAssetUsageFromRotatedScenes(
    input.plan.timelineScenes,
    input.durationSeconds
  );

  const warnings = [
    ...input.plan.warnings,
    ...input.visualVariationGuard.warnings,
    ...input.sourceFootprintGuard.warnings,
    ...(input.extraWarnings ?? [])
  ];

  return {
    variation: input.variation,
    targetStyle: input.targetStyle,
    before: input.before,
    after: input.plan.stats,
    timelineScenes,
    assetUsage,
    beatWindows: input.plan.beatWindows,
    guards: {
      visualVariation: input.visualVariationGuard,
      sourceFootprint: input.sourceFootprintGuard,
      materialization: input.materializationGuard
    },
    canRender: input.canRender,
    blockReason: input.blockReason,
    warnings
  };
}

export function applyRotationPlanToMaterializedScenes<T extends MaterializedSceneWithMotion>(
  scenes: T[],
  plan: RemixAssetRotationPlan
): T[] {
  const bySceneId = new Map(plan.timelineScenes.map((scene) => [scene.sceneId, scene]));

  return scenes.map((scene) => {
    const rotated = bySceneId.get(scene.sceneId);
    if (!rotated) return scene;

    const hasAsset = Boolean(rotated.assetPath);
    return {
      ...scene,
      assetPath: rotated.assetPath,
      assetId: rotated.assetId ?? null,
      visualSourceType: hasAsset ? "approved_asset" : "placeholder",
      transition: rotated.transition || scene.transition,
      selectionReason: rotated.reason,
      motion: rotated.motion
    };
  });
}