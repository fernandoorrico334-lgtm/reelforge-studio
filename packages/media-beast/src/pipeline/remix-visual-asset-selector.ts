import type { RemixAssetSearchCandidate } from "./remix-asset-discovery.js";
import {
  evaluateComicsAssetQuality,
  HOOK_CLIMAX_MIN_SCORE,
  isPremiumHookClimaxAsset,
  type ComicsAssetQualityResult
} from "./comics-asset-quality-gate.js";

export type RemixAssetLike = {
  id: string;
  title: string;
  previewUrl?: string | null;
  sourceUrl?: string | null;
  localPath?: string | null;
  purpose?: string;
  suggestedSceneRole?: string | null;
  combinedScore?: number;
  providerId?: string;
  origin?: "provided" | "approved" | "generated" | "imported";
  query?: string | null;
  width?: number | null;
  height?: number | null;
  comicsQuality?: ComicsAssetQualityResult;
};

export type VisualSourceType =
  | "provided_asset"
  | "approved_asset"
  | "generated_asset"
  | "microclip"
  | "reference_video"
  | "placeholder";

const HOMONYM_REJECTION_PATTERNS: RegExp[] = [
  /\bpogonomyrmex\b/i,
  /\bformiga\b/i,
  /\bant venom\b/i,
  /\bvenom hoodie\b/i,
  /\bmoletom\b/i,
  /\bsweatshirt\b/i,
  /\bt[- ]?shirt\b/i,
  /\bproduto\b/i,
  /\bmerch\b/i,
  /\blogo\.png\b/i,
  /\bvenom 2018 logo\b/i,
  /\bfoli[oõ]es\b/i,
  /\bcarnaval\b/i,
  /\bcosplay\b/i,
  /\bcosplayer\b/i,
  /\bcostume\b/i,
  /\bveneno\b/i,
  /\bpoison\b/i,
  /\binsect\b/i,
  /\barachnid\b/i,
  /\bcandle\b/i,
  /\bvela\b/i,
  /\bbeetle\b/i,
  /\bmollusk\b/i,
  /\bpleurotoma\b/i,
  /\blego\b/i,
  /\bminifigure\b/i,
  /\btoy\b/i,
  /\bkombucha\b/i,
  /\bphotophore\b/i,
  /\bnaturalis\b/i,
  /\bfmib\b/i
];

const WEAK_LOGO_ONLY = /\blogo\b/i;

export function rejectHomonymOrIrrelevantAsset(
  asset: RemixAssetLike,
  entities: string[] = []
): { rejected: boolean; reason?: string } {
  const probe = `${asset.title} ${asset.purpose ?? ""} ${asset.sourceUrl ?? ""} ${asset.query ?? ""}`.toLowerCase();

  for (const pattern of HOMONYM_REJECTION_PATTERNS) {
    if (pattern.test(probe)) {
      return { rejected: true, reason: `homonym_or_irrelevant:${pattern.source}` };
    }
  }

  const entityTokens = entities
    .map((e) => e.toLowerCase())
    .flatMap((e) => e.split(/[\s/_-]+/))
    .filter((t) => t.length > 3);

  const hasEntity = entityTokens.some((token) => probe.includes(token));
  if (WEAK_LOGO_ONLY.test(asset.title) && !hasEntity) {
    return { rejected: true, reason: "weak_logo_only" };
  }

  return { rejected: false };
}

export function evaluateRemixAssetQuality(
  asset: RemixAssetLike,
  entities: string[],
  targetStyle?: string
): ComicsAssetQualityResult {
  if (asset.comicsQuality) return asset.comicsQuality;

  const quality = evaluateComicsAssetQuality({
    title: asset.title,
    entities,
    userApproved: asset.origin === "provided",
    ...(asset.purpose ? { description: asset.purpose } : {}),
    ...(asset.sourceUrl ? { sourceUrl: asset.sourceUrl } : {}),
    ...(asset.query ? { query: asset.query } : {}),
    ...(asset.width != null ? { width: asset.width } : {}),
    ...(asset.height != null ? { height: asset.height } : {}),
    ...(targetStyle ? { targetStyle } : {})
  });
  asset.comicsQuality = quality;
  return quality;
}

function isHookOrClimaxRole(sceneRole: string): boolean {
  const role = sceneRole.toLowerCase();
  return role === "hook" || role === "climax";
}

function passesSceneQualityGate(
  asset: RemixAssetLike,
  sceneRole: string,
  entities: string[],
  targetStyle?: string
): boolean {
  if (asset.origin === "provided") return true;

  const quality = evaluateRemixAssetQuality(asset, entities, targetStyle);
  if (!quality.ok) return false;

  if (isHookOrClimaxRole(sceneRole)) {
    return isPremiumHookClimaxAsset(quality, asset.origin);
  }

  return quality.score >= 55;
}

function scoreAssetForScene(
  asset: RemixAssetLike,
  sceneRole: string,
  entities: string[],
  targetStyle?: string
): number {
  const quality = evaluateRemixAssetQuality(asset, entities, targetStyle);
  let score = quality.score;
  const title = asset.title.toLowerCase();
  const role = sceneRole.toLowerCase();

  if (asset.origin === "provided") score += 40;
  else if (asset.origin === "approved" || asset.origin === "imported") score += 12;
  else if (asset.origin === "generated") score += 8;

  if (asset.suggestedSceneRole && asset.suggestedSceneRole.toLowerCase() === role) {
    score += 14;
  }

  if (isHookOrClimaxRole(role)) {
    if (isPremiumHookClimaxAsset(quality, asset.origin)) score += 24;
    else score -= 60;
    if (quality.category === "comic_panel" || quality.category === "comic_cover") score += 12;
  }

  if (role === "evidence" && /\bcomic\b|\bpanel\b|\billustration\b/i.test(title)) {
    score += 8;
  }

  for (const entity of entities) {
    if (title.includes(entity.toLowerCase())) score += 6;
  }

  if (asset.localPath) score += 10;

  return score;
}

export function selectVisualAssetForRemixScene(input: {
  sceneRole: string;
  targetStyle: string;
  entities: string[];
  providedAssets: RemixAssetLike[];
  approvedAssets: RemixAssetLike[];
  generatedAssets: RemixAssetLike[];
  rejectedAssets?: RemixAssetLike[];
  usedAssetIds?: Set<string>;
}): {
  asset: RemixAssetLike | null;
  sourceType: VisualSourceType;
  reason: string;
} {
  const used = input.usedAssetIds ?? new Set<string>();
  const pools: Array<{ assets: RemixAssetLike[]; sourceType: VisualSourceType }> = [
    { assets: input.providedAssets, sourceType: "provided_asset" },
    { assets: input.approvedAssets, sourceType: "approved_asset" },
    { assets: input.generatedAssets, sourceType: "generated_asset" }
  ];

  const candidates: Array<{ asset: RemixAssetLike; sourceType: VisualSourceType; score: number }> =
    [];

  for (const pool of pools) {
    for (const asset of pool.assets) {
      if (used.has(asset.id)) continue;
      if (pool.sourceType === "generated_asset" && !asset.localPath) continue;

      const rejection = rejectHomonymOrIrrelevantAsset(asset, input.entities);
      if (rejection.rejected) continue;

      if (input.targetStyle === "comics") {
        const quality = evaluateRemixAssetQuality(asset, input.entities, input.targetStyle);
        if (!quality.ok || !["comic_panel", "comic_cover", "character_art"].includes(quality.category)) {
          continue;
        }
        if (!passesSceneQualityGate(asset, input.sceneRole, input.entities, input.targetStyle)) {
          continue;
        }
      }

      candidates.push({
        asset,
        sourceType: pool.sourceType,
        score: scoreAssetForScene(asset, input.sceneRole, input.entities, input.targetStyle)
      });
    }
  }

  candidates.sort((left, right) => right.score - left.score);
  let best = candidates[0];

  if (!best) {
    const reuseCandidates: Array<{
      asset: RemixAssetLike;
      sourceType: VisualSourceType;
      score: number;
    }> = [];

    for (const pool of pools) {
      for (const asset of pool.assets) {
        const rejection = rejectHomonymOrIrrelevantAsset(asset, input.entities);
        if (rejection.rejected) continue;
        if (
          input.targetStyle === "comics" &&
          !passesSceneQualityGate(asset, input.sceneRole, input.entities, input.targetStyle)
        ) {
          continue;
        }
        reuseCandidates.push({
          asset,
          sourceType: pool.sourceType,
          score: scoreAssetForScene(asset, input.sceneRole, input.entities, input.targetStyle)
        });
      }
    }

    reuseCandidates.sort((left, right) => right.score - left.score);
    best = reuseCandidates[0];
    if (best) {
      const quality = evaluateRemixAssetQuality(best.asset, input.entities, input.targetStyle);
      return {
        asset: best.asset,
        sourceType: best.sourceType,
        reason: `reused_${best.sourceType}_score_${best.score}_quality_${quality.score}`
      };
    }
  }

  if (!best && isHookOrClimaxRole(input.sceneRole)) {
    return {
      asset: null,
      sourceType: "placeholder",
      reason: `hook_climax_requires_score_${HOOK_CLIMAX_MIN_SCORE}_comic_asset`
    };
  }

  if (best) {
    const quality = evaluateRemixAssetQuality(best.asset, input.entities, input.targetStyle);
    return {
      asset: best.asset,
      sourceType: best.sourceType,
      reason: `selected_${best.sourceType}_score_${best.score}_quality_${quality.score}_${quality.category}`
    };
  }

  return {
    asset: null,
    sourceType: "placeholder",
    reason: "no_approved_asset_for_scene"
  };
}

export function candidateToAssetLike(
  candidate: RemixAssetSearchCandidate,
  localPath?: string | null,
  origin: RemixAssetLike["origin"] = "approved"
): RemixAssetLike {
  return {
    id: candidate.candidateId,
    title: candidate.title,
    previewUrl: candidate.previewUrl,
    sourceUrl: candidate.sourceUrl,
    localPath: localPath ?? null,
    purpose: candidate.purpose,
    suggestedSceneRole: candidate.suggestedSceneRole,
    combinedScore: candidate.combinedScore,
    providerId: candidate.providerId,
    origin,
    query: candidate.query,
    width: null,
    height: null
  };
}