import { enrichAndScoreCandidates, isSearchSurfaceUrl } from "../discovery/candidate-enrichment.js";
import {
  isDirectImageUrl,
  searchDirectAssetBundle,
  simplifyAssetQuery
} from "../providers/asset-api-clients.js";
import { listMediaBeastProviders } from "../providers/index.js";
import type { MediaBeastCandidate, MediaBeastNiche, MediaBeastProviderId } from "../providers/types.js";
import type { VideoRemixAnalysis } from "./remix-video-analyzer.js";
import type { BeastComfyVariation } from "./visual-transformer.js";
import {
  buildEntityAwareAssetQueries,
  buildStrategyAssetQueries,
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
      const relevanceScore = scoreAssetDomainRelevance({
        title: candidate.title,
        query,
        providerId: candidate.providerId,
        analysis,
        strategy,
        purpose
      });
      const combinedScore = Math.round(qualityScore * 0.55 + relevanceScore * 0.45);
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

  applyDefaultAssetSelection(ranked);

  return ranked;
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
}): RemixAssetDiscoveryPlan {
  const intelligence = input.analysis.contentIntelligence;
  const strategy = resolveRemixAssetDiscoveryStrategy({
    domain: intelligence.domain,
    ...(input.niche ? { niche: input.niche } : {})
  });
  const strategyQueries = buildStrategyAssetQueries(input.analysis, strategy, 14);
  const uniqueQueries = strategyQueries.map((entry) => entry.query);
  const queryPurposeByText = new Map(
    strategyQueries.map((entry) => [entry.query.toLowerCase(), entry.purpose])
  );

  const providerIds = (
    input.enableImageSearch !== false ? strategy.providerIds : []
  ) as RemixAssetDiscoveryPlan["imageSearch"]["providerIds"];

  const rankedSearchCandidates = rankRemixAssetCandidates(
    input.discoveredCandidates ?? [],
    input.analysis,
    {
      ...(input.niche ? { niche: input.niche } : {}),
      queryPurposeByText
    }
  );
  const searchCandidates = selectTopAssetCandidates(rankedSearchCandidates, 8, 12);
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
    if (uniqueDirectQueries.length >= 10) break;
  }

  const directBundles = await Promise.all(
    uniqueDirectQueries.map((query) =>
      searchDirectAssetBundle({
        query,
        maxPerSource: 5,
        entityTerms,
        includeFlickr: true
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