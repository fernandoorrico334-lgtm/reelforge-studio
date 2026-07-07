import { enrichAndScoreCandidates, isSearchSurfaceUrl } from "../discovery/candidate-enrichment.js";
import { listMediaBeastProviders } from "../providers/index.js";
import type { MediaBeastCandidate, MediaBeastNiche, MediaBeastProviderId } from "../providers/types.js";
import type { VideoRemixAnalysis } from "./remix-video-analyzer.js";
import type { BeastComfyVariation } from "./visual-transformer.js";

export interface RemixAssetSearchCandidate {
  candidateId: string;
  providerId: string;
  title: string;
  sourceUrl: string;
  previewUrl: string | null;
  query: string;
  score: number;
  qualityScore: number;
  recommended: boolean;
  defaultSelected: boolean;
  importReady: boolean;
  purpose: "archive_reference" | "comic_panel" | "sports_photo" | "broll_mood" | "differentiation";
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

export interface RemixAssetDiscoveryPlan {
  enabled: true;
  candidateFirst: true;
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

const PROVIDER_QUALITY_WEIGHT: Record<string, number> = {
  "internet-archive": 18,
  flickr: 16,
  "comics-archive": 15,
  "sports-archive": 14,
  "google-images": 8,
  "generic-web": 6
};

const PROVIDER_TIER: Record<string, RemixAssetSearchCandidate["providerTier"]> = {
  "internet-archive": "premium_archive",
  flickr: "editorial_photo",
  "comics-archive": "comic_reference",
  "sports-archive": "editorial_photo",
  "google-images": "generic_lead",
  "generic-web": "generic_lead"
};

function sanitizeTitle(title: string): string {
  return title
    .replace(/[#@]|shorts?|reels?|tiktok/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

function resolveProviderIds(
  domain: string,
  enableImageSearch: boolean
): RemixAssetDiscoveryPlan["imageSearch"]["providerIds"] {
  if (!enableImageSearch) {
    return [];
  }

  switch (domain) {
    case "comics_superhero":
      return ["comics-archive", "internet-archive", "flickr", "google-images"];
    case "sports":
      return ["sports-archive", "internet-archive", "flickr", "google-images"];
    case "gaming":
    case "anime":
      return ["internet-archive", "flickr", "google-images", "generic-web"];
    case "true_crime":
    case "documentary":
      return ["internet-archive", "flickr", "google-images", "generic-web"];
    default:
      return ["internet-archive", "flickr", "google-images"];
  }
}

function buildPrioritizedQueries(analysis: VideoRemixAnalysis): string[] {
  const intelligence = analysis.contentIntelligence;
  const lead = intelligence.entities[0]?.name ?? sanitizeTitle(analysis.title);
  const franchise = intelligence.entities[0]?.franchise ?? null;
  const action = intelligence.actions[0]?.label ?? "highlight";
  const domain = intelligence.domain;

  const domainQueries: string[] = [];

  switch (domain) {
    case "comics_superhero":
      domainQueries.push(
        `${lead} comic book panel high resolution`,
        `${franchise ?? lead} official art reference`,
        `${lead} golden age comics archive scan`,
        `${lead} comic halftone poster editorial`
      );
      break;
    case "sports":
      domainQueries.push(
        `${lead} match action sports photography`,
        `${lead} stadium editorial archive photo`,
        `${lead} ${action} press photo`,
        `${lead} sports documentary b-roll`
      );
      break;
    case "anime":
      domainQueries.push(
        `${lead} anime key visual reference`,
        `${lead} manga panel composition`,
        `${lead} anime action frame study`
      );
      break;
    case "gaming":
      domainQueries.push(
        `${lead} game character concept art`,
        `${lead} fighting game arcade poster`,
        `${lead} esports highlight still`
      );
      break;
    default:
      domainQueries.push(
        `${lead} editorial archive photograph`,
        `${lead} documentary reference still`,
        `${lead} news photo high quality`
      );
  }

  const queries = [
    ...intelligence.visualSearchQueries,
    ...domainQueries,
    ...analysis.contextKeywords.map((keyword) => `${keyword} archive photo HQ`),
    `${lead} remix vertical b-roll reference`
  ]
    .map((query) => query.trim())
    .filter(Boolean);

  return [...new Set(queries)].slice(0, 10);
}

function mapCandidatePurpose(
  domain: string,
  providerId: string
): RemixAssetSearchCandidate["purpose"] {
  if (providerId === "comics-archive") return "comic_panel";
  if (providerId === "sports-archive") return "sports_photo";
  if (domain === "documentary" || domain === "true_crime") return "archive_reference";
  return "differentiation";
}

function computeQualityScore(candidate: MediaBeastCandidate, purpose: RemixAssetSearchCandidate["purpose"]) {
  let score = candidate.score;
  score += PROVIDER_QUALITY_WEIGHT[candidate.providerId] ?? 0;

  if (candidate.previewUrl) score += 12;
  if (!isSearchSurfaceUrl(candidate.sourceUrl)) score += 8;
  if (candidate.licenseStatus === "public_domain" || candidate.licenseStatus === "creative_commons") {
    score += 10;
  }
  if (candidate.riskLevel === "low") score += 6;
  if (candidate.riskLevel === "high") score -= 8;
  if (purpose === "comic_panel" || purpose === "archive_reference") score += 4;

  return Math.max(0, Math.round(score));
}

export function rankRemixAssetCandidates(
  candidates: MediaBeastCandidate[],
  analysis: VideoRemixAnalysis
): RemixAssetSearchCandidate[] {
  const domain = analysis.contentIntelligence.domain;

  const ranked: RemixAssetSearchCandidate[] = candidates
    .map((candidate) => {
      const purpose = mapCandidatePurpose(domain, candidate.providerId);
      const qualityScore = computeQualityScore(candidate, purpose);
      const importReady = Boolean(
        candidate.previewUrl || !isSearchSurfaceUrl(candidate.sourceUrl)
      );

      return {
        candidateId: candidate.id,
        providerId: candidate.providerId,
        title: candidate.title,
        sourceUrl: candidate.sourceUrl,
        previewUrl: candidate.previewUrl,
        query: String(candidate.metadata?.query ?? candidate.title),
        score: candidate.score,
        qualityScore,
        recommended: qualityScore >= 70,
        defaultSelected: false,
        importReady,
        purpose,
        licenseStatus: candidate.licenseStatus,
        riskLevel: candidate.riskLevel,
        providerTier: PROVIDER_TIER[candidate.providerId] ?? "generic_lead"
      };
    })
    .sort((left, right) => right.qualityScore - left.qualityScore);

  const defaultCount = Math.min(3, ranked.length);
  for (let index = 0; index < defaultCount; index += 1) {
    const item = ranked[index];
    if (item) {
      item.defaultSelected = true;
      item.recommended = true;
    }
  }

  return ranked;
}

function buildStyleTokens(domain: string, franchise: string | null): string[] {
  switch (domain) {
    case "comics_superhero":
      return ["comic halftone", "cinematic poster", franchise ?? "superhero", "vertical 9:16"];
    case "sports":
      return ["sports photography", "stadium energy", "dynamic action", "broadcast grade"];
    case "anime":
      return ["anime key visual", "cel shading", "speed lines", "dramatic lighting"];
    case "gaming":
      return ["arcade neon", "character pose", "HUD accents", "competitive mood"];
    case "true_crime":
      return ["noir documentary", "archive texture", "investigative mood"];
    default:
      return ["editorial documentary", "premium lens", "vertical short-form"];
  }
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
  discoveredCandidates?: MediaBeastCandidate[];
  importedAssets?: RemixImportedAssetBinding[];
}): RemixAssetDiscoveryPlan {
  const intelligence = input.analysis.contentIntelligence;
  const uniqueQueries = buildPrioritizedQueries(input.analysis);
  const providerIds = resolveProviderIds(
    intelligence.domain,
    input.enableImageSearch !== false
  );

  const searchCandidates = rankRemixAssetCandidates(
    input.discoveredCandidates ?? [],
    input.analysis
  ).slice(0, 20);

  const defaultSelectedCandidateIds = searchCandidates
    .filter((candidate) => candidate.defaultSelected)
    .map((candidate) => candidate.candidateId);

  const contextualPrompts = buildComfyContextualPrompts(input.analysis, input.comfyVariations);
  const importedAssets = input.importedAssets ?? [];

  return {
    enabled: true,
    candidateFirst: true,
    imageSearch: {
      providerIds,
      queries: uniqueQueries,
      maxCandidatesPerQuery: 4,
      purpose: "differentiate_visuals_from_source",
      executed: searchCandidates.length > 0,
      candidates: searchCandidates,
      defaultSelectedCandidateIds
    },
    importPlan: {
      requiresExplicitApproval: true,
      autoImportOnDiscovery: false,
      maxSelectable: 6,
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
  const queries = buildPrioritizedQueries(input.analysis).slice(0, input.maxQueries ?? 6);
  const providerIds: MediaBeastProviderId[] =
    input.providerIds ??
    (resolveProviderIds(intelligence.domain, true) as MediaBeastProviderId[]);

  const providers = listMediaBeastProviders().filter(
    (provider) =>
      provider.descriptor.enabled && providerIds.includes(provider.descriptor.id)
  );

  const warnings: string[] = [];
  const candidateMap = new Map<string, MediaBeastCandidate>();

  for (const query of queries) {
    const groups = await Promise.all(
      providers.map((provider) =>
        provider.searchCandidates({
          keywords: query.split(/\s+/).filter((token) => token.length > 2),
          niche: input.niche,
          maxCandidates: input.maxCandidatesPerQuery ?? 3
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
    minScore: 10,
    enrichRemote: true,
    maxRemoteFetches: 8
  });

  warnings.push(...enrichment.warnings);

  const candidates = enrichment.candidates.sort((left, right) => right.score - left.score);
  const rankedCandidates = rankRemixAssetCandidates(candidates, input.analysis);

  if (candidates.length === 0) {
    warnings.push("Nenhum candidato visual retornado — revise queries ou providers.");
  }

  return {
    candidates,
    rankedCandidates,
    queriesExecuted: queries,
    warnings
  };
}

export function buildSceneAssetBindings(input: {
  analysis: VideoRemixAnalysis;
  importedAssets: RemixImportedAssetBinding[];
}): RemixImportedAssetBinding[] {
  if (input.importedAssets.length === 0) {
    return [];
  }

  const scenes = input.analysis.mainScenes;
  return input.importedAssets.map((asset, index) => ({
    ...asset,
    sceneRole: scenes[index]?.role ?? scenes[scenes.length - 1]?.role ?? null
  }));
}