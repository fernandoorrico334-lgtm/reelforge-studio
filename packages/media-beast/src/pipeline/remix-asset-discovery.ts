import { enrichAndScoreCandidates, isSearchSurfaceUrl } from "../discovery/candidate-enrichment.js";
import {
  isDirectImageUrl,
  searchDirectAssetBundle,
  simplifyAssetQuery
} from "../providers/asset-api-clients.js";
import { listMediaBeastProviders } from "../providers/index.js";
import type { MediaBeastCandidate, MediaBeastNiche, MediaBeastProviderId } from "../providers/types.js";
import type { RemixTargetStyle } from "./remix-types.js";
import type { VideoRemixAnalysis } from "./remix-video-analyzer.js";
import type { BeastComfyVariation } from "./visual-transformer.js";
import {
  buildEntityAwareAssetQueries,
  buildNarrativeHookAssetQueries,
  buildStrategyAssetQueries,
  normalizeAssetTitleKey,
  normalizePreviewUrlKey,
  resolvePurposeForCandidate,
  resolveRemixAssetDiscoveryStrategy,
  scoreAssetDomainRelevance,
  suggestSceneRoleForPurpose,
  type RemixAssetPurpose
} from "./remix-asset-discovery-strategies.js";

export type { RemixAssetPurpose };

export interface RemixAssetSearchCandidate {
  candidateId: string;
  providerId: string;
  title: string;
  sourceUrl: string;
  previewUrl: string | null;
  query: string;
  score: number;
  qualityScore: number;
  relevanceScore: number;
  combinedScore: number;
  recommended: boolean;
  defaultSelected: boolean;
  importReady: boolean;
  previewAvailable: boolean;
  purpose: RemixAssetPurpose;
  suggestedSceneRole: string;
  licenseStatus: string;
  riskLevel: string;
  providerTier: "premium_archive" | "editorial_photo" | "comic_reference" | "generic_lead";
}

export interface RemixImportedAssetBinding {
  candidateId: string;
  assetId: string;
  localPath: string;
  sceneRole: string | null;
  importMethod: string;
}

export interface RemixComfyContextualPrompt {
  variationId: string;
  workflowId: string;
  positivePrompt: string;
  negativePrompt: string;
  contextEntity: string | null;
  contextAction: string | null;
  purpose: string;
  styleTokens: string[];
}

export interface RemixAssetDiscoveryProfile {
  domain: string;
  domainLabel: string;
  niche?: MediaBeastNiche;
  strategyId: string;
  providerIds: MediaBeastProviderId[];
  queryCount: number;
}

export interface RemixAssetDiscoveryPlan {
  enabled: true;
  candidateFirst: true;
  discoveryProfile: RemixAssetDiscoveryProfile;
  imageSearch: {
    providerIds: Array<"google-images" | "internet-archive" | "flickr" | "comics-archive" | "sports-archive" | "generic-web">;
    queries: string[];
    maxCandidatesPerQuery: number;
    purpose: "differentiate_visuals_from_source";
    executed: boolean;
    candidates: RemixAssetSearchCandidate[];
    defaultSelectedCandidateIds: string[];
  };
  importPlan: {
    requiresExplicitApproval: true;
    autoImportOnDiscovery: false;
    maxSelectable: number;
    recommendedCount: number;
    storageRoot: "storage/assets/remix-imports";
  };
  comfyui: {
    enabled: boolean;
    variationCount: number;
    workflowIds: string[];
    purpose: "generated_reconstruction_and_broll";
    variations: Array<{
      variationId: string;
      workflowId: string;
      style: string;
      sourceMixMode: string;
    }>;
    contextualPrompts: RemixComfyContextualPrompt[];
  };
  importedAssets: RemixImportedAssetBinding[];
  integrationNotes: string[];
}

const PROVIDER_TIER: Record<string, RemixAssetSearchCandidate["providerTier"]> = {
  "internet-archive": "premium_archive",
  flickr: "editorial_photo",
  "comics-archive": "comic_reference",
  "sports-archive": "editorial_photo",
  "google-images": "generic_lead",
  "generic-web": "generic_lead",
  pinterest: "editorial_photo",
  reddit: "generic_lead",
  "old-forums": "premium_archive"
};

function sanitizeTitle(title: string): string {
  return title
    .replace(/[#@]|shorts?|reels?|tiktok/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

function computeQualityScore(
  candidate: MediaBeastCandidate,
  purpose: RemixAssetPurpose,
  strategyWeights: Partial<Record<MediaBeastProviderId, number>>
) {
  let score = candidate.score;
  score += strategyWeights[candidate.providerId] ?? 6;

  if (candidate.previewUrl && isDirectImageUrl(candidate.previewUrl)) score += 28;
  else if (candidate.previewUrl) score += 10;
  if (!isSearchSurfaceUrl(candidate.sourceUrl)) score += 8;
  if (isSearchSurfaceUrl(candidate.sourceUrl)) score -= 45;
  if (candidate.metadata.searchSurface === true) score -= 35;
  if (candidate.licenseStatus === "public_domain" || candidate.licenseStatus === "creative_commons") {
    score += 10;
  }
  if (candidate.riskLevel === "low") score += 6;
  if (candidate.riskLevel === "high") score -= 8;
  if (purpose === "comic_panel" || purpose === "archive_reference" || purpose === "documentary_still") {
    score += 4;
  }

  return Math.max(0, Math.round(score));
}

function applyDefaultAssetSelection(ranked: RemixAssetSearchCandidate[]): void {
  const previewPool = ranked.filter((candidate) => candidate.previewAvailable);
  const defaultCount = previewPool.length >= 8 ? 4 : Math.min(4, ranked.length);

  for (const item of ranked) {
    item.defaultSelected = false;
  }

  for (let index = 0; index < defaultCount; index += 1) {
    const item = previewPool[index] ?? ranked[index];
    if (item) {
      item.defaultSelected = true;
      item.recommended = true;
    }
  }
}

function deduplicateRankedCandidates(
  ranked: RemixAssetSearchCandidate[]
): RemixAssetSearchCandidate[] {
  const seenTitles = new Set<string>();
  const seenPreviews = new Set<string>();
  const deduped: RemixAssetSearchCandidate[] = [];

  for (const candidate of ranked) {
    const titleKey = normalizeAssetTitleKey(candidate.title);
    const previewKey = normalizePreviewUrlKey(candidate.previewUrl);

    if (seenTitles.has(titleKey)) continue;
    if (previewKey && seenPreviews.has(previewKey)) continue;

    seenTitles.add(titleKey);
    if (previewKey) seenPreviews.add(previewKey);
    deduped.push(candidate);
  }

  return deduped;
}

interface VariationAssetPreference {
  preferredPurposes: RemixAssetPurpose[];
  titleKeywords: string[];
  avoidKeywords: string[];
  queryKeywords: string[];
}

const VARIATION_ASSET_PREFERENCES: Partial<Record<RemixTargetStyle, VariationAssetPreference>> = {
  documentary: {
    preferredPurposes: ["archive_reference", "documentary_still", "comic_panel"],
    titleKeywords: ["archive", "photograph", "panel", "golden age", "classic", "editorial"],
    avoidKeywords: ["cosplay", "neon", "anime", "carnaval"],
    queryKeywords: ["archive", "editorial", "documentary", "golden age"]
  },
  comics: {
    preferredPurposes: ["comic_panel", "character_art"],
    titleKeywords: ["comic", "spider", "venom", "symbiote", "panel", "marvel", "vs", "illustration"],
    avoidKeywords: ["photograph", "carnaval", "ceramica", "cerâmica"],
    queryKeywords: ["comic", "panel", "halftone", "illustration", "marvel"]
  },
  dark_cinematic: {
    preferredPurposes: ["character_art", "comic_panel", "broll_mood"],
    titleKeywords: ["symbiote", "venom", "dark", "noir", "shadow", "vs", "bond"],
    avoidKeywords: ["carnival", "carnaval", "bright", "cosplay", "carnaval"],
    queryKeywords: ["symbiote", "bond", "dark", "noir", "partnership"]
  },
  horror: {
    preferredPurposes: ["broll_mood", "character_art", "documentary_still"],
    titleKeywords: ["horror", "dark", "noir", "shadow", "venom", "symbiote"],
    avoidKeywords: ["cosplay", "carnaval", "bright"],
    queryKeywords: ["noir", "dark", "atmospheric", "horror"]
  },
  true_crime: {
    preferredPurposes: ["archive_reference", "documentary_still"],
    titleKeywords: ["archive", "newspaper", "investigation", "evidence"],
    avoidKeywords: ["cosplay", "comic", "anime"],
    queryKeywords: ["archive", "newspaper", "investigation"]
  },
  anime: {
    preferredPurposes: ["character_art", "differentiation"],
    titleKeywords: ["anime", "manga", "key visual", "illustration"],
    avoidKeywords: ["photograph", "archive", "newspaper"],
    queryKeywords: ["anime", "manga", "key visual"]
  },
  hype_sports: {
    preferredPurposes: ["sports_photo", "archive_reference"],
    titleKeywords: ["match", "goal", "stadium", "action", "sports"],
    avoidKeywords: ["comic", "anime", "cosplay"],
    queryKeywords: ["match", "sports", "action", "stadium"]
  },
  generic: {
    preferredPurposes: ["archive_reference", "differentiation"],
    titleKeywords: ["editorial", "archive", "reference"],
    avoidKeywords: ["cosplay", "meme"],
    queryKeywords: ["editorial", "archive"]
  }
};

function scoreCandidateForVariationStyle(
  candidate: RemixAssetSearchCandidate,
  targetStyle: RemixTargetStyle
): number {
  const preference = VARIATION_ASSET_PREFERENCES[targetStyle] ?? VARIATION_ASSET_PREFERENCES.generic!;
  const haystack = `${candidate.title} ${candidate.query}`.toLowerCase();
  let boost = 0;

  if (preference.preferredPurposes.includes(candidate.purpose)) {
    boost += 14;
  }
  for (const keyword of preference.titleKeywords) {
    if (haystack.includes(keyword.toLowerCase())) {
      boost += 7;
    }
  }
  for (const keyword of preference.queryKeywords) {
    if (candidate.query.toLowerCase().includes(keyword.toLowerCase())) {
      boost += 5;
    }
  }
  for (const keyword of preference.avoidKeywords) {
    if (haystack.includes(keyword.toLowerCase())) {
      boost -= 18;
    }
  }

  return candidate.combinedScore + boost;
}

export function selectVariationAssetCandidates(
  ranked: RemixAssetSearchCandidate[],
  input: {
    variationIndex: number;
    variationCount: number;
    targetStyle: RemixTargetStyle;
    minTarget?: number;
    maxTarget?: number;
    excludeCandidateIds?: string[];
  }
): RemixAssetSearchCandidate[] {
  const minTarget = input.minTarget ?? 8;
  const maxTarget = input.maxTarget ?? 12;
  const excludeIds = new Set(input.excludeCandidateIds ?? []);
  const variationCount = Math.max(1, input.variationCount);

  const styleRanked = ranked
    .filter((candidate) => !excludeIds.has(candidate.candidateId))
    .map((candidate) => ({
      candidate,
      styleScore: scoreCandidateForVariationStyle(candidate, input.targetStyle)
    }))
    .sort((left, right) => right.styleScore - left.styleScore);

  const chunkSize = Math.max(4, Math.ceil(styleRanked.length / variationCount));
  const rotatedStart = (input.variationIndex * chunkSize) % Math.max(1, styleRanked.length);
  const rotated = [
    ...styleRanked.slice(rotatedStart),
    ...styleRanked.slice(0, rotatedStart)
  ].map((entry) => entry.candidate);

  const seen = new Set<string>();
  const variationPool: RemixAssetSearchCandidate[] = [];
  for (const candidate of rotated) {
    const key = normalizeAssetTitleKey(candidate.title);
    if (seen.has(key)) continue;
    seen.add(key);
    variationPool.push(candidate);
    if (variationPool.length >= maxTarget + 4) break;
  }

  const selected = selectTopAssetCandidates(variationPool, minTarget, maxTarget);
  if (selected.length >= minTarget) {
    return selected;
  }

  const fallbackPool = ranked
    .filter((candidate) => !excludeIds.has(candidate.candidateId))
    .map((candidate) => ({
      candidate,
      styleScore: scoreCandidateForVariationStyle(candidate, input.targetStyle)
    }))
    .sort((left, right) => right.styleScore - left.styleScore)
    .map((entry) => entry.candidate);

  const relaxed = selectTopAssetCandidates(fallbackPool, minTarget, maxTarget);
  return relaxed.length > 0 ? relaxed : selected;
}

export function buildVariationAssetQueries(
  baseQueries: string[],
  targetStyle: RemixTargetStyle,
  variationIndex: number
): string[] {
  const preference = VARIATION_ASSET_PREFERENCES[targetStyle];
  if (!preference) {
    return baseQueries;
  }

  const boosted = baseQueries.map((query, index) => ({
    query,
    score:
      preference.queryKeywords.filter((keyword) =>
        query.toLowerCase().includes(keyword.toLowerCase())
      ).length *
        3 +
      (baseQueries.length - index)
  }));

  const rotatedStart = (variationIndex * 2) % Math.max(1, boosted.length);
  const ordered = [...boosted.slice(rotatedStart), ...boosted.slice(0, rotatedStart)]
    .sort((left, right) => right.score - left.score)
    .map((entry) => entry.query);

  return [...new Set(ordered)];
}

function selectTopAssetCandidates(
  ranked: RemixAssetSearchCandidate[],
  minTarget = 8,
  maxTarget = 12
): RemixAssetSearchCandidate[] {
  const withPreview = ranked.filter((candidate) => candidate.previewAvailable);
  const substantive = ranked.filter(
    (candidate) => candidate.importReady && !isSearchSurfaceUrl(candidate.sourceUrl)
  );
  const pool =
    withPreview.length >= minTarget
      ? withPreview
      : substantive.length >= 3
        ? substantive
        : ranked;
  return pool.slice(0, maxTarget);
}

export function rankRemixAssetCandidates(
  candidates: MediaBeastCandidate[],
  analysis: VideoRemixAnalysis,
  options?: {
    niche?: MediaBeastNiche;
    queryPurposeByText?: Map<string, RemixAssetPurpose>;
  }
): RemixAssetSearchCandidate[] {
  const intelligence = analysis.contentIntelligence;
  const strategy = resolveRemixAssetDiscoveryStrategy({
    domain: intelligence.domain,
    ...(options?.niche ? { niche: options.niche } : {})
  });
  const queryPurposeByText = options?.queryPurposeByText ?? new Map();

  const ranked: RemixAssetSearchCandidate[] = candidates
    .map((candidate, index) => {
      const query = String(candidate.metadata?.query ?? candidate.title);
      const purpose = resolvePurposeForCandidate(
        strategy,
        candidate.providerId,
        queryPurposeByText.get(query.toLowerCase())
      );
      const qualityScore = computeQualityScore(candidate, purpose, strategy.providerWeights);
      const description =
        typeof candidate.metadata?.pageDescription === "string"
          ? candidate.metadata.pageDescription
          : typeof candidate.metadata?.description === "string"
            ? candidate.metadata.description
            : undefined;
      const relevanceScore = scoreAssetDomainRelevance({
        title: candidate.title,
        query,
        providerId: candidate.providerId,
        analysis,
        strategy,
        purpose,
        ...(description ? { description } : {})
      });
      const combinedScore = Math.round(qualityScore * 0.42 + relevanceScore * 0.58);
      const previewAvailable = Boolean(
        candidate.previewUrl &&
          (isDirectImageUrl(candidate.previewUrl) || candidate.metadata.directImage === true)
      );
      const importReady = Boolean(
        previewAvailable ||
          (candidate.previewUrl && !isSearchSurfaceUrl(candidate.sourceUrl))
      );

      return {
        candidateId: candidate.id,
        providerId: candidate.providerId,
        title: candidate.title,
        sourceUrl: candidate.sourceUrl,
        previewUrl: candidate.previewUrl,
        query,
        score: candidate.score,
        qualityScore,
        relevanceScore,
        combinedScore,
        recommended: combinedScore >= 68 && previewAvailable,
        defaultSelected: false,
        importReady,
        previewAvailable,
        purpose,
        suggestedSceneRole: suggestSceneRoleForPurpose(strategy, purpose, index),
        licenseStatus: candidate.licenseStatus,
        riskLevel: candidate.riskLevel,
        providerTier: PROVIDER_TIER[candidate.providerId] ?? "generic_lead"
      };
    })
    .sort((left, right) => right.combinedScore - left.combinedScore);

  const deduped = deduplicateRankedCandidates(ranked);
  applyDefaultAssetSelection(deduped);

  return deduped;
}

function buildStyleTokens(domain: VideoRemixAnalysis["contentIntelligence"]["domain"], franchise: string | null): string[] {
  const strategy = resolveRemixAssetDiscoveryStrategy({ domain });
  return strategy.visualKeywords.slice(0, 4).concat(
    franchise ? [franchise] : [],
    ["vertical 9:16", "premium editorial"]
  );
}

function buildComfyContextualPrompts(
  analysis: VideoRemixAnalysis,
  comfyVariations: BeastComfyVariation[]
): RemixComfyContextualPrompt[] {
  const intelligence = analysis.contentIntelligence;
  const lead = intelligence.entities[0]?.name ?? sanitizeTitle(analysis.title);
  const franchise = intelligence.entities[0]?.franchise ?? null;
  const action = intelligence.actions[0]?.label ?? "highlight moment";
  const fragments = intelligence.comfyPromptFragments;
  const styleTokens = buildStyleTokens(intelligence.domain, franchise);

  return comfyVariations.map((variation, index) => {
    const fragment = fragments[index % fragments.length] ?? fragments[0] ?? "cinematic editorial b-roll";
    const sceneInsight = intelligence.sceneInsights[index];
    const sceneRole = sceneInsight?.role ?? "context";

    return {
      variationId: variation.variationId,
      workflowId: variation.workflowId,
      positivePrompt: [
        fragment,
        `${lead} inspired composition`,
        sceneInsight?.visualHint ?? "premium vertical short",
        ...styleTokens.slice(0, 3),
        `editorial ${sceneRole} beat`,
        "original remix-safe frame, no watermark"
      ].join(", "),
      negativePrompt: [
        variation.negativePrompt,
        "copyrighted screenshot",
        "exact movie frame clone",
        "low resolution",
        "blurry text overlay"
      ].join(", "),
      contextEntity: lead,
      contextAction: sceneInsight?.focusAction ?? action,
      purpose: sceneInsight?.visualHint ?? "differentiate_from_source",
      styleTokens
    };
  });
}

export function buildRemixAssetDiscoveryPlan(input: {
  analysis: VideoRemixAnalysis;
  comfyVariations: BeastComfyVariation[];
  enableImageSearch?: boolean;
  niche?: MediaBeastNiche;
  discoveredCandidates?: MediaBeastCandidate[];
  importedAssets?: RemixImportedAssetBinding[];
  variationIndex?: number;
  variationCount?: number;
  targetStyle?: RemixTargetStyle;
  rankedAssetPool?: RemixAssetSearchCandidate[];
  excludeAssetCandidateIds?: string[];
}): RemixAssetDiscoveryPlan {
  const intelligence = input.analysis.contentIntelligence;
  const strategy = resolveRemixAssetDiscoveryStrategy({
    domain: intelligence.domain,
    ...(input.niche ? { niche: input.niche } : {})
  });
  const strategyQueries = buildStrategyAssetQueries(input.analysis, strategy, 14);
  const baseQueries = strategyQueries.map((entry) => entry.query);
  const uniqueQueries =
    input.targetStyle !== undefined && input.variationIndex !== undefined
      ? buildVariationAssetQueries(baseQueries, input.targetStyle, input.variationIndex)
      : baseQueries;
  const queryPurposeByText = new Map(
    strategyQueries.map((entry) => [entry.query.toLowerCase(), entry.purpose])
  );

  const providerIds = (
    input.enableImageSearch !== false ? strategy.providerIds : []
  ) as RemixAssetDiscoveryPlan["imageSearch"]["providerIds"];

  const rankedSearchCandidates =
    input.rankedAssetPool ??
    rankRemixAssetCandidates(input.discoveredCandidates ?? [], input.analysis, {
      ...(input.niche ? { niche: input.niche } : {}),
      queryPurposeByText
    });

  const searchCandidates =
    input.targetStyle !== undefined && input.variationIndex !== undefined
      ? selectVariationAssetCandidates(rankedSearchCandidates, {
          variationIndex: input.variationIndex,
          variationCount: input.variationCount ?? 3,
          targetStyle: input.targetStyle,
          ...(input.excludeAssetCandidateIds
            ? { excludeCandidateIds: input.excludeAssetCandidateIds }
            : {})
        })
      : selectTopAssetCandidates(rankedSearchCandidates, 8, 12);
  applyDefaultAssetSelection(searchCandidates);

  const defaultSelectedCandidateIds = searchCandidates
    .filter((candidate) => candidate.defaultSelected)
    .map((candidate) => candidate.candidateId);

  const contextualPrompts = buildComfyContextualPrompts(input.analysis, input.comfyVariations);
  const importedAssets = input.importedAssets ?? [];

  const discoveryProfile: RemixAssetDiscoveryProfile = {
    domain: intelligence.domain,
    domainLabel: strategy.label,
    ...(input.niche ? { niche: input.niche } : {}),
    strategyId: strategy.domain,
    providerIds: strategy.providerIds,
    queryCount: uniqueQueries.length
  };

  return {
    enabled: true,
    candidateFirst: true,
    discoveryProfile,
    imageSearch: {
      providerIds,
      queries: uniqueQueries,
      maxCandidatesPerQuery: 6,
      purpose: "differentiate_visuals_from_source",
      executed: searchCandidates.length > 0,
      candidates: searchCandidates,
      defaultSelectedCandidateIds
    },
    importPlan: {
      requiresExplicitApproval: true,
      autoImportOnDiscovery: false,
      maxSelectable: 12,
      recommendedCount: defaultSelectedCandidateIds.length,
      storageRoot: "storage/assets/remix-imports"
    },
    comfyui: {
      enabled: input.comfyVariations.length > 0,
      variationCount: input.comfyVariations.length,
      workflowIds: [
        ...new Set(input.comfyVariations.map((variation) => variation.workflowId))
      ],
      purpose: "generated_reconstruction_and_broll",
      variations: input.comfyVariations.map((variation) => ({
        variationId: variation.variationId,
        workflowId: variation.workflowId,
        style: variation.style,
        sourceMixMode: variation.sourceMixMode
      })),
      contextualPrompts
    },
    importedAssets,
    integrationNotes: [
      "Selecione candidatos e clique em importar — download + registro em storage/assets/remix-imports.",
      `Perfil de descoberta: ${strategy.label} (${strategy.providerIds.slice(0, 3).join(", ")}).`,
      "ComfyUI usa prompts contextuais com entidade, ação e tokens de estilo por domínio.",
      `${input.comfyVariations.length} variações visuais planejadas para diferenciar o remix.`,
      intelligence.entities.length
        ? `Entidades para assets: ${intelligence.entities.map((entity) => entity.name).join(", ")}.`
        : "Sem entidade forte — queries priorizam arquivo editorial/HQ.",
      uniqueQueries.length
        ? `Consultas priorizadas: ${uniqueQueries.slice(0, 3).join(" | ")}.`
        : "Sem consultas de imagem — use apenas variações ComfyUI.",
      searchCandidates.length
        ? `${searchCandidates.length} candidatos ranqueados (${defaultSelectedCandidateIds.length} pré-selecionados).`
        : "Nenhum candidato retornado — revise providers ou contexto do vídeo.",
      importedAssets.length
        ? `${importedAssets.length} asset(s) importado(s) e prontos para o remix.`
        : "Nenhum asset importado ainda — aprove e importe os selecionados."
    ]
  };
}

export async function discoverRemixAssetCandidates(input: {
  analysis: VideoRemixAnalysis;
  niche: MediaBeastNiche;
  providerIds?: MediaBeastProviderId[];
  maxCandidatesPerQuery?: number;
  maxQueries?: number;
}): Promise<{
  candidates: MediaBeastCandidate[];
  rankedCandidates: RemixAssetSearchCandidate[];
  queriesExecuted: string[];
  warnings: string[];
}> {
  const intelligence = input.analysis.contentIntelligence;
  const strategy = resolveRemixAssetDiscoveryStrategy({
    domain: intelligence.domain,
    niche: input.niche
  });
  const maxQueries = input.maxQueries ?? 14;
  const maxCandidatesPerQuery = input.maxCandidatesPerQuery ?? 6;
  const strategyQueries = buildStrategyAssetQueries(input.analysis, strategy, maxQueries);
  const queryPurposeByText = new Map(
    strategyQueries.map((entry) => [entry.query.toLowerCase(), entry.purpose])
  );
  const queries = strategyQueries.map((entry) => entry.query);

  const SEARCH_SURFACE_PROVIDERS = new Set<MediaBeastProviderId>([
    "google-images",
    "generic-web"
  ]);
  const providerIds: MediaBeastProviderId[] =
    input.providerIds ?? strategy.providerIds;

  const providers = listMediaBeastProviders().filter(
    (provider) =>
      provider.descriptor.enabled &&
      providerIds.includes(provider.descriptor.id) &&
      !SEARCH_SURFACE_PROVIDERS.has(provider.descriptor.id)
  );

  const warnings: string[] = [];
  const candidateMap = new Map<string, MediaBeastCandidate>();
  const entityTerms = [
    ...new Set(
      intelligence.entities.flatMap((entity) =>
        [entity.name, ...entity.aliases]
          .map((term) => term.toLowerCase().trim())
          .filter((term) => term.length > 2)
      )
    )
  ];

  const entityCoreQueries = intelligence.entities.flatMap((entity) => [
    entity.name,
    `${entity.name} comic art`,
    `${entity.name} illustration`
  ]);

  const directQuerySeeds = [
    ...buildNarrativeHookAssetQueries(input.analysis).map((entry) => entry.query),
    ...entityCoreQueries,
    ...buildEntityAwareAssetQueries(input.analysis).map((entry) => entry.query),
    ...queries
  ]
    .map((query) => simplifyAssetQuery(query, 5) || query.trim())
    .filter((query) => query.length > 4);

  const uniqueDirectQueries: string[] = [];
  const seenDirectQueries = new Set<string>();
  for (const query of directQuerySeeds) {
    const key = query.toLowerCase();
    if (seenDirectQueries.has(key)) continue;
    seenDirectQueries.add(key);
    uniqueDirectQueries.push(query);
    if (uniqueDirectQueries.length >= 12) break;
  }

  const directBundles = await Promise.all(
    uniqueDirectQueries.map((query) =>
      searchDirectAssetBundle({
        query,
        maxPerSource: 5,
        entityTerms,
        includeFlickr: true,
        domain: intelligence.domain
      })
    )
  );

  for (const group of directBundles) {
    for (const candidate of group) {
      const query = String(candidate.metadata.query ?? uniqueDirectQueries[0] ?? queries[0] ?? "");
      candidateMap.set(candidate.id, {
        ...candidate,
        metadata: {
          ...candidate.metadata,
          query
        }
      });
    }
  }

  for (const query of queries) {
    const groups = await Promise.all(
      providers.map((provider) =>
        provider.searchCandidates({
          keywords: query.split(/\s+/).filter((token) => token.length > 2),
          niche: input.niche,
          maxCandidates: maxCandidatesPerQuery
        })
      )
    );

    for (const group of groups) {
      for (const candidate of group) {
        candidateMap.set(candidate.id, {
          ...candidate,
          metadata: {
            ...candidate.metadata,
            query
          }
        });
      }
    }
  }

  const rawCandidates = [...candidateMap.values()];
  const enrichment = await enrichAndScoreCandidates(rawCandidates, {
    query: intelligence.headline,
    minScore: 20,
    enrichRemote: true,
    maxRemoteFetches: 20
  });

  warnings.push(...enrichment.warnings);

  const candidates = enrichment.candidates.sort((left, right) => right.score - left.score);
  const rankedCandidates = selectTopAssetCandidates(
    rankRemixAssetCandidates(candidates, input.analysis, {
      niche: input.niche,
      queryPurposeByText
    }),
    8,
    12
  );
  applyDefaultAssetSelection(rankedCandidates);

  if (candidates.length === 0) {
    warnings.push(`Nenhum candidato visual retornado para ${strategy.label} — revise queries ou providers.`);
  } else {
    const withPreview = rankedCandidates.filter((candidate) => candidate.previewAvailable).length;
    warnings.push(
      `Pool final: ${rankedCandidates.length} candidatos ranqueados (${withPreview} com preview direto).`
    );
  }

  return {
    candidates,
    rankedCandidates,
    queriesExecuted: queries,
    warnings
  };
}

export function bindImportedAssetsToScenes(input: {
  importedAssets: RemixImportedAssetBinding[];
  candidates: RemixAssetSearchCandidate[];
  sceneRoles?: string[];
}): RemixImportedAssetBinding[] {
  if (input.importedAssets.length === 0) {
    return [];
  }

  const candidateById = new Map(
    input.candidates.map((candidate) => [candidate.candidateId, candidate])
  );
  const roleSequence = ["hook", "context", "evidence", "climax", "outro"];

  return input.importedAssets.map((asset, index) => {
    const candidate = candidateById.get(asset.candidateId);
    const suggestedRole = candidate?.suggestedSceneRole;
    const fallbackRole =
      input.sceneRoles?.[index] ?? roleSequence[index] ?? roleSequence.at(-1) ?? null;

    return {
      ...asset,
      sceneRole: suggestedRole ?? asset.sceneRole ?? fallbackRole
    };
  });
}

export function buildSceneAssetBindings(input: {
  analysis: VideoRemixAnalysis;
  importedAssets: RemixImportedAssetBinding[];
  candidates?: RemixAssetSearchCandidate[];
}): RemixImportedAssetBinding[] {
  if (input.importedAssets.length === 0) {
    return [];
  }

  if (input.candidates?.length) {
    const scenes = input.analysis.mainScenes;
    return bindImportedAssetsToScenes({
      importedAssets: input.importedAssets,
      candidates: input.candidates,
      sceneRoles: scenes.map((scene) => scene.role)
    });
  }

  const scenes = input.analysis.mainScenes;
  return input.importedAssets.map((asset, index) => ({
    ...asset,
    sceneRole: scenes[index]?.role ?? scenes[scenes.length - 1]?.role ?? null
  }));
}