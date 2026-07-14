import { join, resolve } from "node:path";
import { enrichAndScoreCandidates } from "../discovery/candidate-enrichment.js";
import { searchDirectAssetBundle } from "../providers/asset-api-clients.js";
import { listMediaBeastProviders } from "../providers/index.js";
import type { MediaBeastCandidate } from "../providers/types.js";
import {
  evaluateComicsAssetQuality,
  HOOK_CLIMAX_MIN_SCORE,
  INSUFFICIENT_TRUE_COMICS_ASSETS,
  isBlockedComicsQuery,
  isPremiumHookClimaxAsset,
  isSearchSurfaceAsset,
  isSubstantiveComicsAssetUrl,
  isTrueComicsAssetCategory,
  MIN_PREMIUM_ACCEPTED_COUNT,
  MIN_TRUE_COMICS_ASSETS,
  TRUE_COMICS_TIMELINE_CATEGORIES,
  type ComicsAssetCategory,
  type ComicsAssetQualityResult
} from "./comics-asset-quality-gate.js";
import { renderSelectedAssetsContactSheet } from "./comics-visual-asset-audit.js";
import { importRemixAssetCandidatesToDisk } from "./remix-asset-importer.js";
import { COMICS_CATALOG_DOWNLOAD_INGESTION_SOURCE } from "./comics-catalog-download-ingestion.js";
import {
  discoverComicsPrimaryCatalogAssets,
  isPrimaryCatalogCandidate
} from "./comics-primary-catalog-discovery.js";
import { PRIMARY_CATALOG_SOURCE_PRIORITY } from "./comics-catalog-discovery-shared.js";
import {
  MULTIVERSOHQ_DISCOVERY_SOURCE,
  MULTIVERSOHQ_MARVEL_INDEX_URL
} from "./multiversohq-comics-discovery.js";
import {
  NDRANGHETA_BLOGSPOT_URL,
  NDRANGHETA_DISCOVERY_SOURCE,
  OSINVISIVEIS_BLOGSPOT_URL,
  OSINVISIVEIS_DISCOVERY_SOURCE,
  PODERMARVEL_BLOGSPOT_URL,
  PODERMARVEL_DISCOVERY_SOURCE
} from "./blogspot-comics-discovery.js";
import { OSINVISIVEIS_PARTNER_DISCOVERY_SOURCE } from "./osinvisiveis-partner-discovery.js";
import {
  SOQUADRINHOS_DISCOVERY_SOURCE,
  SOQUADRINHOS_MARVEL_INDEX_URL
} from "./soquadrinhos-comics-discovery.js";
import {
  SOQUADRINHOSS_LANCAMENTOS_DISCOVERY_SOURCE,
  SOQUADRINHOSS_LANCAMENTOS_PAGE_URL
} from "./soquadrinhoss-lancamentos-discovery.js";
import type { PrimaryCatalogPublisher } from "./comics-catalog-discovery-shared.js";
import {
  rankRemixAssetCandidates,
  type RemixAssetSearchCandidate
} from "./remix-asset-discovery.js";
import {
  buildNarrativeSubjectContext,
  MIN_SUBJECT_ALIGNED_ASSETS,
  MIN_SUBJECT_RELEVANCE_SCORE,
  type NarrativeSubjectContext,
  type SubjectRelevanceLevel,
  type SubjectScoredAssetCandidate
} from "./comics-subject-relevance-gate.js";
import {
  analyzeComicsVideoThemeFromAnalysis,
  buildThemeDiscoveryQueries,
  isBeatThemeAligned,
  MIN_THEME_MATCH_SCORE,
  selectAssetForThemedBeat,
  scoreAssetForThemedSelection,
  type ComicsThemeAnalysis,
  type ThemeScoredAssetCandidate
} from "./comics-theme-intelligence.js";
import { validateComicsAssetForTheme } from "./comics-theme-asset-validator.js";
import type { VideoRemixAnalysis } from "./remix-video-analyzer.js";

export const INSUFFICIENT_SUBJECT_ALIGNED_ASSETS = "insufficient_subject_aligned_assets";
export const SUBJECT_NOT_ALIGNED_FOR_RENDER = "subject_not_aligned_for_render";
export const FOCUSED_COMICS_DISCOVERY_MODE = "focused_comics_discovery";
export const FOCUSED_PREMIUM_MIN_THEMED_SCORE = 58;
export const FOCUSED_MAX_ACCEPTED_ASSETS = 16;

export const FOCUSED_COMICS_PRIMARY_CATALOG_SOURCES = [
  {
    id: SOQUADRINHOS_DISCOVERY_SOURCE,
    priority: PRIMARY_CATALOG_SOURCE_PRIORITY,
    label: "SoQuadrinhos Marvel HQ catalog",
    heroScope: "multi_hero" as const,
    indexUrl: SOQUADRINHOS_MARVEL_INDEX_URL
  },
  {
    id: SOQUADRINHOSS_LANCAMENTOS_DISCOVERY_SOURCE,
    priority: PRIMARY_CATALOG_SOURCE_PRIORITY,
    label: "SoQuadrinhos Lançamentos",
    heroScope: "multi_hero" as const,
    indexUrl: SOQUADRINHOSS_LANCAMENTOS_PAGE_URL
  },
  {
    id: MULTIVERSOHQ_DISCOVERY_SOURCE,
    priority: PRIMARY_CATALOG_SOURCE_PRIORITY,
    label: "Multiverso HQ Marvel catalog",
    heroScope: "multi_hero" as const,
    indexUrl: MULTIVERSOHQ_MARVEL_INDEX_URL
  },
  {
    id: PODERMARVEL_DISCOVERY_SOURCE,
    priority: PRIMARY_CATALOG_SOURCE_PRIORITY,
    label: "Poder Marvel Blogspot",
    heroScope: "multi_hero" as const,
    indexUrl: PODERMARVEL_BLOGSPOT_URL
  },
  {
    id: NDRANGHETA_DISCOVERY_SOURCE,
    priority: PRIMARY_CATALOG_SOURCE_PRIORITY,
    label: "Ndrangheta HQs Blogspot",
    heroScope: "multi_hero" as const,
    indexUrl: NDRANGHETA_BLOGSPOT_URL
  },
  {
    id: OSINVISIVEIS_DISCOVERY_SOURCE,
    priority: PRIMARY_CATALOG_SOURCE_PRIORITY,
    label: "Os Invisíveis HQ Blogspot",
    heroScope: "multi_hero" as const,
    indexUrl: OSINVISIVEIS_BLOGSPOT_URL
  },
  {
    id: OSINVISIVEIS_PARTNER_DISCOVERY_SOURCE,
    priority: PRIMARY_CATALOG_SOURCE_PRIORITY,
    label: "Os Invisíveis HQ — rede de parceiros",
    heroScope: "multi_hero" as const,
    indexUrl: OSINVISIVEIS_BLOGSPOT_URL
  }
];

export const FOCUSED_COMICS_SOURCES_ALLOWED = [
  "soquadrinhos_catalog",
  "soquadrinhoss_lancamentos_catalog",
  "multiversohq_catalog",
  "podermarvel_blogspot_catalog",
  "ndrangheta_blogspot_catalog",
  "osinvisiveis_blogspot_catalog",
  "osinvisiveis_partner_catalog",
  "comics_catalog_download_ingestion",
  "storage/assets/comics-catalog-panels",
  "site.soquadrinhos.com/wp-content/uploads",
  "multiversohq.com/wp-content/uploads",
  "blogger.googleusercontent.com",
  "supabase.co/storage/v1/object/public/comic-covers",
  "postimg.cc",
  "mediafire.com/file",
  "comicvine.gamespot.com/a/uploads",
  "archive.org/details",
  "archive.org/download",
  "flickr.com/photos",
  "commons.wikimedia.org/wiki/File:",
  "upload.wikimedia.org",
  "staticflickr.com",
  "live.staticflickr.com",
  "user_provided_asset",
  "approved_generated_comics_visual"
];

export const FOCUSED_COMICS_DISCOVERY_QUERIES = [
  "Venom Spider-Man comic panel",
  "Venom symbiote comic cover",
  "Spider-Man black suit comic panel",
  "Venom Eddie Brock comic art",
  "Venom vs Spider-Man comic panel",
  "Marvel Venom symbiote comic cover",
  "Venom comic issue cover",
  "black suit Spider-Man comic cover",
  "Eddie Brock Venom comic panel",
  "Venom symbiote character art",
  "Venom Spider-Man symbiote bond comic panel",
  "Spider-Man black suit symbiote comic cover",
  "Eddie Brock Venom symbiote host comic art",
  "Venom and Spider-Man comic panel duo",
  "Venom symbiote transformation comic page",
  "Venom perfect partner symbiote bond comic"
];

const FOCUSED_PROVIDER_IDS = new Set(["comics-archive", "internet-archive", "flickr"]);

export type PremiumComicsPlaceholderEntry = {
  id: string;
  sceneRole: "hook" | "context" | "curiosity" | "development" | "climax" | "closing";
  category: "premium_placeholder_comics";
  visualPlan: {
    halftone: boolean;
    splitPanel: boolean;
    symbioteSilhouette: boolean;
    comicTexture: boolean;
    palette: string[];
    aspectRatio: "9:16";
    notes: string;
  };
};

export type FocusedComicsDiscoveryAssetEntry = {
  id: string;
  title: string;
  sourceUrl: string;
  score: number;
  category: ComicsAssetCategory;
  visualAuditStatus: "accepted" | "rejected" | "needs_manual_review";
  recommendedScene: string;
  assetQualityScore: number;
  entityMatchScore: number;
  subjectRelevanceScore: number;
  themeMatchScore?: number;
  relationshipMatchScore?: number;
  beatFitScore?: number;
  themedFinalScore?: number;
  finalSelectionScore: number;
  relevance: SubjectRelevanceLevel;
  recommendedBeat: string;
  reason: string;
  positiveSignals: string[];
  negativeSignals?: string[];
  rejectReason?: string | null;
  substantiveUrlReason?: string;
  localPath?: string | null;
};

export type FocusedComicsSubjectSummary = {
  subjectTheme: string;
  narrativeTheme: string;
  videoTitle: string;
  directSubjectMatchCount: number;
  genericEntityMatchCount: number;
  rejectedForWeakSubjectRelevance: number;
  hookSubjectAligned: boolean;
  climaxSubjectAligned: boolean;
  hookSelectionReason: string | null;
  climaxSelectionReason: string | null;
};

export type FocusedComicsThemeSummary = {
  narrativeThemes: ComicsThemeAnalysis["narrativeThemes"];
  relationshipType: ComicsThemeAnalysis["relationshipType"];
  visualMotifs: string[];
  recommendedAssetSignals: string[];
  disallowedAssetSignals: string[];
  themeAlignedCount: number;
  rejectedForWeakThemeMatch: number;
};

export type FocusedComicsDiscoveryReport = {
  variation: string;
  mode: typeof FOCUSED_COMICS_DISCOVERY_MODE;
  queriesUsed: string[];
  sourcesAllowed: string[];
  primaryCatalogSources: Array<{
    id: string;
    priority: typeof PRIMARY_CATALOG_SOURCE_PRIORITY;
    label: string;
    heroScope: PrimaryCatalogPublisher["heroScope"];
    indexUrl: string;
  }>;
  totalCandidatesFound: number;
  substantiveUrlCount: number;
  acceptedCount: number;
  premiumAcceptedCount: number;
  trueComicsAssetCount: number;
  rejectedCount: number;
  acceptedAssets: FocusedComicsDiscoveryAssetEntry[];
  rejectedAssets: FocusedComicsDiscoveryAssetEntry[];
  hookAsset: FocusedComicsDiscoveryAssetEntry | null;
  climaxAsset: FocusedComicsDiscoveryAssetEntry | null;
  placeholderPlan: PremiumComicsPlaceholderEntry[];
  contactSheetPath: string | null;
  canRender: boolean;
  blockReason: string | null;
  subjectSummary: FocusedComicsSubjectSummary;
  themeSummary: FocusedComicsThemeSummary;
  themeAnalysis: ComicsThemeAnalysis;
  warnings: string[];
};

export function buildFocusedComicsDiscoveryQueries(input: {
  entities: string[];
  topic: string;
  franchise?: string | null;
  themeAnalysis?: ComicsThemeAnalysis;
}): string[] {
  const names = input.entities.map((entity) => entity.trim()).filter(Boolean);
  const lead = names[0] ?? "Marvel";
  const partner = names[1] ?? "";
  const queries = new Set<string>();

  for (const entity of names) {
    queries.add(`${entity} comic panel`);
    queries.add(`${entity} comic cover art`);
    queries.add(`${entity} comic book page`);
  }
  if (partner) {
    queries.add(`${lead} ${partner} comic panel`);
    queries.add(`${lead} ${partner} comic cover`);
  }
  if (input.topic.trim().length >= 8) {
    queries.add(`${lead} ${input.topic} comic panel`);
    queries.add(`${lead} ${input.topic} comic cover`);
  }

  if (input.themeAnalysis) {
    for (const query of buildThemeDiscoveryQueries({
      themeAnalysis: input.themeAnalysis,
      ...(input.franchise ? { franchise: input.franchise } : {})
    })) {
      queries.add(query);
    }
  }

  const themes = input.themeAnalysis?.narrativeThemes ?? [];
  if (
    themes.includes("symbiosis") ||
    themes.includes("partnership") ||
    /venom|symbiote|simbionte/i.test(`${lead} ${partner} ${input.topic}`)
  ) {
    for (const query of FOCUSED_COMICS_DISCOVERY_QUERIES) queries.add(query);
  }

  if (input.franchise) {
    queries.add(`${input.franchise} ${lead} comic panel archive`);
  }

  return [...queries].filter((query) => query.trim().length >= 12 && !isBlockedComicsQuery(query));
}

export function buildPremiumComicsPlaceholderPlan(): PremiumComicsPlaceholderEntry[] {
  const baseVisual = {
    halftone: true,
    splitPanel: true,
    symbioteSilhouette: true,
    comicTexture: true,
    palette: ["#0b0b0f", "#c1121f", "#f8f9fa"],
    aspectRatio: "9:16" as const,
    notes: "Composicao abstrata estilo HQ — sem copiar personagem protegido sem asset licenciado."
  };

  return [
    { id: "premium_placeholder_comics_hook", sceneRole: "hook", category: "premium_placeholder_comics", visualPlan: { ...baseVisual, splitPanel: false, notes: "Hook: silhueta simbionte + halftone vermelho/preto, vertical 9:16." } },
    { id: "premium_placeholder_comics_context", sceneRole: "context", category: "premium_placeholder_comics", visualPlan: { ...baseVisual, notes: "Contexto: painel dividido com textura de HQ e fundo escuro." } },
    { id: "premium_placeholder_comics_curiosity", sceneRole: "curiosity", category: "premium_placeholder_comics", visualPlan: { ...baseVisual, symbioteSilhouette: false, notes: "Curiosidade: close de textura simbionte/halftone sem personagem identificavel." } },
    { id: "premium_placeholder_comics_development", sceneRole: "development", category: "premium_placeholder_comics", visualPlan: { ...baseVisual, notes: "Desenvolvimento: composicao vertical com bordas de painel." } },
    { id: "premium_placeholder_comics_climax", sceneRole: "climax", category: "premium_placeholder_comics", visualPlan: { ...baseVisual, splitPanel: false, notes: "Climax: contraste vermelho/preto com silhueta simbionte central." } },
    { id: "premium_placeholder_comics_closing", sceneRole: "closing", category: "premium_placeholder_comics", visualPlan: { ...baseVisual, symbioteSilhouette: false, notes: "Fechamento: textura de HQ e halftone suave." } }
  ];
}

function candidateHasSubstantiveSurface(candidate: MediaBeastCandidate): {
  ok: boolean;
  reason: string;
} {
  if (
    isSearchSurfaceAsset({
      title: candidate.title,
      sourceUrl: candidate.sourceUrl
    })
  ) {
    return { ok: false, reason: "search_surface_asset" };
  }

  const sourceCheck = isSubstantiveComicsAssetUrl(candidate.sourceUrl);
  if (sourceCheck.ok) return sourceCheck;

  if (candidate.previewUrl) {
    const previewCheck = isSubstantiveComicsAssetUrl(candidate.previewUrl);
    if (previewCheck.ok) {
      return { ok: true, reason: `preview:${previewCheck.reason}` };
    }
  }

  return sourceCheck;
}

function resolveCatalogContext(
  meta?: MediaBeastCandidate["metadata"]
): {
  catalogPriority: boolean;
  catalogRelevanceScore?: number;
  seriesTitle?: string;
  comicsVisualLanguage?: string;
} {
  if (!meta) return { catalogPriority: false };
  return {
    catalogPriority: meta.catalogPriority === true,
    ...(typeof meta.catalogRelevanceScore === "number"
      ? { catalogRelevanceScore: meta.catalogRelevanceScore }
      : {}),
    ...(typeof meta.soquadrinhosSeriesTitle === "string"
      ? { seriesTitle: meta.soquadrinhosSeriesTitle }
      : typeof meta.catalogPostTitle === "string"
        ? { seriesTitle: meta.catalogPostTitle }
        : {}),
    ...(typeof meta.comicsVisualLanguage === "string"
      ? { comicsVisualLanguage: meta.comicsVisualLanguage }
      : {})
  };
}

function purposeToRecommendedScene(
  purpose: string,
  score: number,
  category: ComicsAssetCategory,
  catalogPriority = false
): string {
  if (score >= HOOK_CLIMAX_MIN_SCORE && category === "comic_panel") return "hook";
  if (score >= HOOK_CLIMAX_MIN_SCORE && category === "character_art") return "climax";
  if (score >= HOOK_CLIMAX_MIN_SCORE && category === "comic_cover") {
    return catalogPriority ? "context" : "hook";
  }
  if (category === "comic_panel" || purpose === "comic_panel") return "evidence";
  if (category === "comic_cover" && catalogPriority) return "context";
  if (purpose === "character_art") return "context";
  return "support";
}

function toFocusedEntry(
  candidate: RemixAssetSearchCandidate,
  quality: ComicsAssetQualityResult,
  subject: SubjectScoredAssetCandidate | ThemeScoredAssetCandidate,
  substantiveReason: string,
  catalogPriority = false,
  visualAuditStatus: FocusedComicsDiscoveryAssetEntry["visualAuditStatus"] = "accepted",
  rejectReason?: string | null,
  localPath?: string | null
): FocusedComicsDiscoveryAssetEntry {
  const mergedPositive = [...new Set([...quality.positiveSignals, ...subject.positiveSignals])];
  const mergedNegative = [
    ...new Set([...(quality.negativeSignals ?? []), ...subject.negativeSignals])
  ];

  return {
    id: candidate.candidateId,
    title: candidate.title,
    sourceUrl: candidate.sourceUrl,
    score: "themedFinalScore" in subject ? subject.themedFinalScore : subject.finalSelectionScore,
    category: quality.category,
    visualAuditStatus,
    recommendedScene: subject.recommendedBeat || purposeToRecommendedScene(
      candidate.purpose,
      quality.score,
      quality.category,
      catalogPriority
    ),
    assetQualityScore: subject.assetQualityScore,
    entityMatchScore: subject.entityMatchScore,
    subjectRelevanceScore: subject.subjectRelevanceScore,
    ...("themeMatchScore" in subject
      ? {
          themeMatchScore: subject.themeMatchScore,
          relationshipMatchScore: subject.relationshipMatchScore,
          beatFitScore: subject.beatFitScore,
          themedFinalScore: subject.themedFinalScore
        }
      : {}),
    finalSelectionScore: "themedFinalScore" in subject ? subject.themedFinalScore : subject.finalSelectionScore,
    relevance: subject.relevance,
    recommendedBeat: subject.recommendedBeat,
    reason: subject.reason,
    positiveSignals: mergedPositive,
    ...(mergedNegative.length ? { negativeSignals: mergedNegative } : {}),
    ...(rejectReason ? { rejectReason } : quality.rejectReason ? { rejectReason: quality.rejectReason } : {}),
    substantiveUrlReason: substantiveReason,
    ...(localPath ? { localPath } : {})
  };
}

function themedCandidateFromEntry(entry: FocusedComicsDiscoveryAssetEntry): ThemeScoredAssetCandidate {
  return {
    id: entry.id,
    title: entry.title,
    sourceUrl: entry.sourceUrl,
    category: entry.category,
    assetQualityScore: entry.assetQualityScore,
    entityMatchScore: entry.entityMatchScore,
    subjectRelevanceScore: entry.subjectRelevanceScore,
    finalSelectionScore: entry.finalSelectionScore,
    relevance: entry.relevance,
    recommendedBeat: entry.recommendedBeat,
    reason: entry.reason,
    positiveSignals: entry.positiveSignals,
    negativeSignals: entry.negativeSignals ?? [],
    subjectOk: entry.relevance === "direct_subject_match" || entry.relevance === "supporting_context",
    themeMatchScore: entry.themeMatchScore ?? entry.subjectRelevanceScore,
    relationshipMatchScore: entry.relationshipMatchScore ?? 0,
    beatFitScore: entry.beatFitScore ?? 0,
    themedFinalScore: entry.themedFinalScore ?? entry.finalSelectionScore,
    themeSignals: entry.positiveSignals,
    themeNegativeSignals: entry.negativeSignals ?? []
  };
}

function evaluateFocusedRenderReadiness(input: {
  trueComicsAssetCount: number;
  premiumAcceptedCount: number;
  subjectAlignedCount: number;
  hookAsset: FocusedComicsDiscoveryAssetEntry | null;
  climaxAsset: FocusedComicsDiscoveryAssetEntry | null;
  hookSubjectAligned: boolean;
  climaxSubjectAligned: boolean;
  genericEntityMatchCount: number;
  genericAcceptedCount: number;
  contactSheetPath: string | null;
}): { canRender: boolean; blockReason: string | null; warnings: string[] } {
  const warnings: string[] = [];
  let canRender = true;
  let blockReason: string | null = null;

  if (input.trueComicsAssetCount < MIN_TRUE_COMICS_ASSETS) {
    canRender = false;
    blockReason = INSUFFICIENT_TRUE_COMICS_ASSETS;
    warnings.push(
      `true_comics_asset_count_below_minimum:${input.trueComicsAssetCount}/${MIN_TRUE_COMICS_ASSETS}`
    );
  }
  if (input.premiumAcceptedCount < MIN_PREMIUM_ACCEPTED_COUNT) {
    canRender = false;
    blockReason = blockReason ?? INSUFFICIENT_TRUE_COMICS_ASSETS;
    warnings.push(
      `premium_accepted_below_minimum:${input.premiumAcceptedCount}/${MIN_PREMIUM_ACCEPTED_COUNT}`
    );
  }
  if (input.subjectAlignedCount < MIN_SUBJECT_ALIGNED_ASSETS) {
    canRender = false;
    blockReason = blockReason ?? INSUFFICIENT_SUBJECT_ALIGNED_ASSETS;
    warnings.push(
      `subject_aligned_assets_below_minimum:${input.subjectAlignedCount}/${MIN_SUBJECT_ALIGNED_ASSETS}`
    );
  }
  if (!input.hookSubjectAligned || !input.hookAsset) {
    canRender = false;
    blockReason = blockReason ?? SUBJECT_NOT_ALIGNED_FOR_RENDER;
    warnings.push("hook_subject_not_aligned");
  } else if (
    !TRUE_COMICS_TIMELINE_CATEGORIES.includes(input.hookAsset.category) ||
    input.hookAsset.visualAuditStatus === "rejected"
  ) {
    canRender = false;
    blockReason = blockReason ?? SUBJECT_NOT_ALIGNED_FOR_RENDER;
    warnings.push("hook_asset_not_premium_true_comics");
  }
  if (!input.climaxSubjectAligned || !input.climaxAsset) {
    canRender = false;
    blockReason = blockReason ?? SUBJECT_NOT_ALIGNED_FOR_RENDER;
    warnings.push("climax_subject_not_aligned");
  } else if (
    !TRUE_COMICS_TIMELINE_CATEGORIES.includes(input.climaxAsset.category) ||
    input.climaxAsset.visualAuditStatus === "rejected"
  ) {
    canRender = false;
    blockReason = blockReason ?? SUBJECT_NOT_ALIGNED_FOR_RENDER;
    warnings.push("climax_asset_not_premium_true_comics");
  }
  if (
    input.genericAcceptedCount > 0 &&
    input.genericAcceptedCount >= input.subjectAlignedCount &&
    input.subjectAlignedCount < MIN_SUBJECT_ALIGNED_ASSETS
  ) {
    canRender = false;
    blockReason = blockReason ?? SUBJECT_NOT_ALIGNED_FOR_RENDER;
    warnings.push("generic_entity_assets_dominate_accepted_pool");
  }
  if (!input.contactSheetPath) {
    canRender = false;
    blockReason = blockReason ?? "no_raster_contact_sheet_available";
    warnings.push("no_raster_assets_for_visual_contact_sheet");
  }

  return { canRender, blockReason, warnings };
}

export async function discoverFocusedComicsAssets(input: {
  analysis: VideoRemixAnalysis;
  entities: string[];
  franchise?: string | null;
  maxPerQuery?: number;
  enableDownloadIngestion?: boolean;
  userApprovedDownload?: boolean;
  maxDownloadPosts?: number;
  projectRoot?: string;
}): Promise<{
  queriesUsed: string[];
  rankedCandidates: RemixAssetSearchCandidate[];
  candidateMetadataById: Map<string, MediaBeastCandidate["metadata"]>;
  substantiveUrlCount: number;
  warnings: string[];
}> {
  const themeAnalysis = analyzeComicsVideoThemeFromAnalysis(input.analysis);
  const queriesUsed = buildFocusedComicsDiscoveryQueries({
    entities: input.entities,
    topic: input.analysis.contentIntelligence.headline,
    themeAnalysis,
    ...(input.franchise ? { franchise: input.franchise } : {})
  });
  const entityTerms = input.entities.map((entity) => entity.toLowerCase());
  const maxPerQuery = input.maxPerQuery ?? 8;
  const candidateMap = new Map<string, MediaBeastCandidate>();
  const candidateMetadataById = new Map<string, MediaBeastCandidate["metadata"]>();
  const warnings: string[] = [];

  const [directBundles, primaryCatalogDiscovery] = await Promise.all([
    Promise.all(
      queriesUsed.map((query) =>
        searchDirectAssetBundle({
          query,
          maxPerSource: maxPerQuery,
          entityTerms,
          includeFlickr: true,
          domain: "comics_superhero"
        })
      )
    ),
    discoverComicsPrimaryCatalogAssets({
      entities: input.entities,
      franchise: input.franchise ?? "Marvel",
      maxSeries: 28,
      maxCandidatesPerSource: 32,
      multiversohqMaxFeeds: 4,
      multiversohqMaxPagesPerFeed: 2,
      ...(input.enableDownloadIngestion
        ? {
            enableDownloadIngestion: true,
            userApprovedDownload: input.userApprovedDownload ?? true,
            maxDownloadPosts: input.maxDownloadPosts ?? 3,
            ...(input.projectRoot ? { projectRoot: input.projectRoot } : {})
          }
        : {})
    })
  ]);

  for (const group of directBundles) {
    for (const candidate of group) {
      candidateMap.set(candidate.id, candidate);
      candidateMetadataById.set(candidate.id, candidate.metadata);
    }
  }

  for (const candidate of primaryCatalogDiscovery.candidates) {
    candidateMap.set(candidate.id, candidate);
    candidateMetadataById.set(candidate.id, candidate.metadata);
  }
  warnings.push(...primaryCatalogDiscovery.warnings);

  const providers = listMediaBeastProviders().filter(
    (provider) =>
      provider.descriptor.enabled && FOCUSED_PROVIDER_IDS.has(provider.descriptor.id)
  );

  for (const query of queriesUsed) {
    const groups = await Promise.all(
      providers.map((provider) =>
        provider.searchCandidates({
          keywords: query.split(/\s+/).filter((token) => token.length > 2),
          niche: "comics",
          maxCandidates: maxPerQuery
        })
      )
    );
    for (const group of groups) {
      for (const candidate of group) {
        if (isSearchSurfaceAsset({ title: candidate.title, sourceUrl: candidate.sourceUrl })) {
          continue;
        }
        const merged = {
          ...candidate,
          metadata: {
            ...candidate.metadata,
            query
          }
        };
        candidateMap.set(candidate.id, merged);
        candidateMetadataById.set(candidate.id, merged.metadata);
      }
    }
  }

  const substantiveCandidates: MediaBeastCandidate[] = [];
  let substantiveUrlCount = 0;
  for (const candidate of candidateMap.values()) {
    const substantive = candidateHasSubstantiveSurface(candidate);
    if (!substantive.ok) continue;
    substantiveUrlCount += 1;
    substantiveCandidates.push({
      ...candidate,
      metadata: {
        ...candidate.metadata,
        substantiveUrlReason: substantive.reason
      }
    });
  }

  warnings.push(
    `Focused discovery: ${candidateMap.size} brutos, ${substantiveUrlCount} com URL substantiva.`
  );

  const catalogCandidates = substantiveCandidates.filter((candidate) =>
    isPrimaryCatalogCandidate(candidate)
  );
  const downloadedPanelCandidates = catalogCandidates.filter(
    (candidate) =>
      candidate.metadata.discoverySource === COMICS_CATALOG_DOWNLOAD_INGESTION_SOURCE
  );
  const catalogCoverCandidates = catalogCandidates.filter(
    (candidate) =>
      candidate.metadata.discoverySource !== COMICS_CATALOG_DOWNLOAD_INGESTION_SOURCE
  );
  const apiCandidates = substantiveCandidates.filter(
    (candidate) => !isPrimaryCatalogCandidate(candidate)
  );

  const enrichmentOptions = {
    query: input.analysis.contentIntelligence.headline,
    minScore: 25,
    enrichRemote: true,
    maxRemoteFetches: 24
  };

  const [catalogEnrichment, apiEnrichment] = await Promise.all([
    enrichAndScoreCandidates(catalogCoverCandidates, {
      ...enrichmentOptions,
      enrichRemote: false,
      minScore: 10,
      maxPoolSize: 48
    }),
    enrichAndScoreCandidates(apiCandidates, enrichmentOptions)
  ]);
  warnings.push(...catalogEnrichment.warnings, ...apiEnrichment.warnings);
  const videoTitle = input.analysis.title ?? input.analysis.contentIntelligence.headline;
  const themeAnalysisForPanels = analyzeComicsVideoThemeFromAnalysis(input.analysis, videoTitle);
  const panelNarration = [
    input.analysis.contentIntelligence.narrativeHook,
    input.analysis.contentIntelligence.narrativeBrief,
    input.analysis.contentIntelligence.summary
  ]
    .filter(Boolean)
    .join(" ");

  const themeFilteredPanels = downloadedPanelCandidates.filter((candidate) => {
    const verdict = validateComicsAssetForTheme({
      assetTitle: candidate.title,
      assetDescription: candidate.reasons?.join(" | ") ?? candidate.title,
      themeAnalysis: themeAnalysisForPanels,
      narrationText: panelNarration,
      videoTitle
    });
    return verdict.severity !== "reject";
  });
  if (downloadedPanelCandidates.length > themeFilteredPanels.length) {
    warnings.push(
      `catalog_download_theme_filter_rejected:${downloadedPanelCandidates.length - themeFilteredPanels.length}`
    );
  }

  if (themeFilteredPanels.length > 0) {
    warnings.push(
      `Catalog download panels preserved: ${themeFilteredPanels.length} interior page(s) bypass enrichment cap.`
    );
  }

  const rankedCatalog = rankRemixAssetCandidates(
    [...catalogEnrichment.candidates, ...themeFilteredPanels],
    input.analysis,
    { niche: "comics" }
  ).filter((candidate) => candidate.importReady || candidate.previewAvailable);

  const rankedApi = rankRemixAssetCandidates(apiEnrichment.candidates, input.analysis, {
    niche: "comics"
  }).filter((candidate) => candidate.importReady || candidate.previewAvailable);

  const rankedById = new Map<string, RemixAssetSearchCandidate>();
  for (const candidate of rankedCatalog) {
    rankedById.set(candidate.candidateId, candidate);
  }
  for (const candidate of rankedApi) {
    if (!rankedById.has(candidate.candidateId)) {
      rankedById.set(candidate.candidateId, candidate);
    }
  }
  const rankedCandidates = [...rankedById.values()]
    .sort((left, right) => {
      const leftMeta = candidateMetadataById.get(left.candidateId);
      const rightMeta = candidateMetadataById.get(right.candidateId);
      const leftPanelBoost = leftMeta?.comicsPanelPage ? 18 : 0;
      const rightPanelBoost = rightMeta?.comicsPanelPage ? 18 : 0;
      const leftCatalogBoost = leftMeta?.catalogPriority === true ? 8 : 0;
      const rightCatalogBoost = rightMeta?.catalogPriority === true ? 8 : 0;
      const leftScore = left.combinedScore + leftPanelBoost + leftCatalogBoost;
      const rightScore = right.combinedScore + rightPanelBoost + rightCatalogBoost;
      return rightScore - leftScore;
    })
    .slice(0, 64);

  for (const candidate of rankedCandidates) {
    if (!candidateMetadataById.has(candidate.candidateId)) {
      const source = candidateMap.get(candidate.candidateId);
      if (source) candidateMetadataById.set(candidate.candidateId, source.metadata);
    }
  }

  return {
    queriesUsed,
    rankedCandidates,
    candidateMetadataById,
    substantiveUrlCount,
    warnings
  };
}

export async function runFocusedComicsDiscovery(input: {
  analysis: VideoRemixAnalysis;
  entities: string[];
  franchise?: string | null;
  projectRoot?: string;
  importTopAccepted?: number;
  enableDownloadIngestion?: boolean;
  userApprovedDownload?: boolean;
  maxDownloadPosts?: number;
}): Promise<FocusedComicsDiscoveryReport> {
  const projectRoot = resolve(input.projectRoot ?? process.cwd());
  const discovery = await discoverFocusedComicsAssets({
    analysis: input.analysis,
    entities: input.entities,
    projectRoot,
    ...(input.franchise ? { franchise: input.franchise } : {}),
    ...(input.enableDownloadIngestion
      ? {
          enableDownloadIngestion: true,
          userApprovedDownload: input.userApprovedDownload ?? true,
          maxDownloadPosts: input.maxDownloadPosts ?? 3
        }
      : {})
  });

  const narrativeContext = buildNarrativeSubjectContext(
    input.analysis,
    input.analysis.title ?? input.analysis.contentIntelligence.headline
  );
  const themeAnalysis = analyzeComicsVideoThemeFromAnalysis(
    input.analysis,
    input.analysis.title ?? input.analysis.contentIntelligence.headline
  );
  const acceptedAssets: FocusedComicsDiscoveryAssetEntry[] = [];
  const rejectedAssets: FocusedComicsDiscoveryAssetEntry[] = [];
  let rejectedForWeakSubjectRelevance = 0;
  let rejectedForWeakThemeMatch = 0;
  let genericEntityMatchCount = 0;
  let directSubjectMatchCount = 0;

  for (const candidate of discovery.rankedCandidates) {
    const substantiveReason =
      isSubstantiveComicsAssetUrl(candidate.sourceUrl).reason ||
      (candidate.previewUrl
        ? isSubstantiveComicsAssetUrl(candidate.previewUrl).reason
        : "non_substantive_url");

    const catalogContext = resolveCatalogContext(
      discovery.candidateMetadataById.get(candidate.candidateId)
    );
    const quality = evaluateComicsAssetQuality({
      title: candidate.title,
      description: candidate.purpose,
      sourceUrl: candidate.sourceUrl,
      entities: input.entities,
      franchise: input.franchise ?? "Marvel",
      targetStyle: "comics",
      requireSubstantiveUrl: true,
      catalogPriority: catalogContext.catalogPriority,
      ...(catalogContext.catalogRelevanceScore !== undefined
        ? { catalogRelevanceScore: catalogContext.catalogRelevanceScore }
        : {}),
      ...(catalogContext.seriesTitle ? { seriesTitle: catalogContext.seriesTitle } : {}),
      ...(catalogContext.comicsVisualLanguage
        ? { comicsVisualLanguage: catalogContext.comicsVisualLanguage }
        : {})
    });

    const subject = scoreAssetForThemedSelection({
      id: candidate.candidateId,
      title: candidate.title,
      sourceUrl: candidate.sourceUrl,
      description: [
        candidate.purpose,
        catalogContext.comicsVisualLanguage,
        catalogContext.seriesTitle
      ]
        .filter(Boolean)
        .join(" | "),
      category: quality.category,
      assetQualityScore: quality.score,
      themeAnalysis,
      targetStyle: "comics"
    });

    const qualityAccepted = quality.ok && isTrueComicsAssetCategory(quality.category, quality);
    const themeGate = validateComicsAssetForTheme({
      assetTitle: candidate.title,
      assetDescription: [
        candidate.purpose,
        catalogContext.comicsVisualLanguage,
        catalogContext.seriesTitle
      ]
        .filter(Boolean)
        .join(" | "),
      assetCategory: quality.category,
      themeAnalysis,
      narrationText: [
        input.analysis.contentIntelligence.narrativeHook,
        input.analysis.contentIntelligence.narrativeBrief,
        input.analysis.contentIntelligence.summary
      ]
        .filter(Boolean)
        .join(" "),
      videoTitle: input.analysis.title ?? input.analysis.contentIntelligence.headline
    });

    const subjectAccepted =
      themeGate.severity !== "reject" &&
      subject.subjectOk &&
      subject.themeMatchScore >= MIN_THEME_MATCH_SCORE &&
      subject.subjectRelevanceScore >= MIN_SUBJECT_RELEVANCE_SCORE &&
      subject.relevance !== "generic_entity_match" &&
      subject.relevance !== "weak_match" &&
      subject.relevance !== "reject";

    if (subject.relevance === "generic_entity_match") genericEntityMatchCount += 1;
    if (subject.relevance === "direct_subject_match") directSubjectMatchCount += 1;

    const entry = toFocusedEntry(
      candidate,
      quality,
      subject,
      substantiveReason,
      catalogContext.catalogPriority,
      qualityAccepted && subjectAccepted ? "accepted" : "rejected",
      !qualityAccepted
        ? quality.rejectReason ?? "quality_gate_failed"
        : themeGate.severity === "reject"
          ? `theme_gate:${themeGate.reason}`
          : !subjectAccepted
            ? subject.relevance === "generic_entity_match"
              ? "generic_entity_match_only"
              : "weak_subject_relevance"
            : null
    );

    if (qualityAccepted && subjectAccepted) {
      acceptedAssets.push(entry);
    } else {
      if (qualityAccepted && !subjectAccepted) {
        if (subject.themeMatchScore < MIN_THEME_MATCH_SCORE) rejectedForWeakThemeMatch += 1;
        else rejectedForWeakSubjectRelevance += 1;
      }
      rejectedAssets.push(entry);
    }
  }

  if (acceptedAssets.length < MIN_TRUE_COMICS_ASSETS) {
    const acceptedIds = new Set(acceptedAssets.map((entry) => entry.id));
    const rescueCandidates = rejectedAssets
      .filter(
        (entry) =>
          !acceptedIds.has(entry.id) &&
          isTrueComicsAssetCategory(entry.category) &&
          entry.visualAuditStatus !== "rejected" &&
          (entry.themeMatchScore ?? 0) >= MIN_THEME_MATCH_SCORE &&
          entry.subjectRelevanceScore >= MIN_SUBJECT_RELEVANCE_SCORE &&
          (entry.relevance === "supporting_context" || entry.relevance === "direct_subject_match") &&
          (entry.positiveSignals ?? []).some((signal) =>
            /entity_pair|both_entities_present|venom_spiderman_together|spiderman_venom_together|simbionte/.test(
              signal
            )
          )
      )
      .sort(
        (left, right) =>
          (right.themedFinalScore ?? right.finalSelectionScore) -
          (left.themedFinalScore ?? left.finalSelectionScore)
      );

    for (const entry of rescueCandidates) {
      if (acceptedAssets.length >= MIN_TRUE_COMICS_ASSETS) break;
      acceptedAssets.push({ ...entry, visualAuditStatus: "accepted" });
      acceptedIds.add(entry.id);
      rejectedAssets.splice(
        rejectedAssets.findIndex((rejected) => rejected.id === entry.id),
        1
      );
      discovery.warnings.push(`focused_rescue_promoted:${entry.id}`);
    }
  }

  acceptedAssets.sort(
    (left, right) => (right.themedFinalScore ?? right.finalSelectionScore) - (left.themedFinalScore ?? left.finalSelectionScore)
  );

  if (acceptedAssets.length > FOCUSED_MAX_ACCEPTED_ASSETS) {
    const beforeCap = acceptedAssets.length;
    const overflow = acceptedAssets.splice(FOCUSED_MAX_ACCEPTED_ASSETS);
    for (const entry of overflow) {
      rejectedAssets.push({
        ...entry,
        visualAuditStatus: "rejected",
        rejectReason: "focused_accept_cap"
      });
    }
    discovery.warnings.push(`focused_accept_capped:${FOCUSED_MAX_ACCEPTED_ASSETS}/${beforeCap}`);
  }

  rejectedAssets.sort((left, right) => right.finalSelectionScore - left.finalSelectionScore);

  const subjectAlignedCount = acceptedAssets.filter(
    (entry) =>
      entry.subjectRelevanceScore >= MIN_SUBJECT_RELEVANCE_SCORE &&
      (entry.themeMatchScore ?? 0) >= MIN_THEME_MATCH_SCORE &&
      (entry.relevance === "direct_subject_match" || entry.relevance === "supporting_context")
  ).length;
  const themeAlignedCount = acceptedAssets.filter(
    (entry) => (entry.themeMatchScore ?? 0) >= MIN_THEME_MATCH_SCORE
  ).length;

  const premiumAccepted = acceptedAssets.filter(
    (entry) =>
      (entry.themedFinalScore ?? entry.finalSelectionScore) >= FOCUSED_PREMIUM_MIN_THEMED_SCORE &&
      entry.assetQualityScore >= HOOK_CLIMAX_MIN_SCORE &&
      (entry.relevance === "direct_subject_match" || entry.relevance === "supporting_context")
  );

  const genericAcceptedCount = acceptedAssets.filter(
    (entry) => entry.relevance === "generic_entity_match"
  ).length;

  const importCandidates = acceptedAssets
    .slice(0, input.importTopAccepted ?? 12)
    .map((entry) => discovery.rankedCandidates.find((candidate) => candidate.candidateId === entry.id))
    .filter((candidate): candidate is RemixAssetSearchCandidate => Boolean(candidate));

  const localPathById = new Map<string, string>();
  if (importCandidates.length > 0) {
    const importResults = await importRemixAssetCandidatesToDisk(importCandidates, {
      remixId: "remix-aHR0cHM6Ly93d3cueW91"
    });
    for (const result of importResults) {
      if (result.success && result.localPath) {
        localPathById.set(result.candidateId, join(projectRoot, result.localPath));
      }
    }
    for (const entry of acceptedAssets) {
      const localPath = localPathById.get(entry.id);
      if (localPath) entry.localPath = localPath;
    }
  }

  const rasterPaths = acceptedAssets
    .map((entry) => entry.localPath)
    .filter((path): path is string => Boolean(path));

  const contactSheetPath = await renderSelectedAssetsContactSheet({
    assetPaths: rasterPaths,
    outputPath: join(projectRoot, "tmp", "variation-b-focused-assets-contact-sheet.jpg")
  });

  const trueComicsAssetCount = acceptedAssets.filter((entry) =>
    isTrueComicsAssetCategory(entry.category)
  ).length;

  const themePool = acceptedAssets.map(themedCandidateFromEntry);
  const hookSelection = selectAssetForThemedBeat({
    beatRole: "hook",
    themeAnalysis,
    acceptedAssets: themePool
  });
  const climaxSelection = selectAssetForThemedBeat({
    beatRole: "climax",
    themeAnalysis,
    acceptedAssets: themePool,
    excludeIds: hookSelection.asset ? [hookSelection.asset.id] : []
  });

  const hookAsset =
    hookSelection.asset != null
      ? acceptedAssets.find((entry) => entry.id === hookSelection.asset?.id) ?? null
      : null;
  const climaxAsset =
    climaxSelection.asset != null
      ? acceptedAssets.find((entry) => entry.id === climaxSelection.asset?.id) ?? null
      : null;

  const hookSubjectAligned = hookAsset
    ? isBeatThemeAligned({
        asset: themedCandidateFromEntry(hookAsset),
        beatRole: "hook",
        themeAnalysis
      })
    : false;
  const climaxSubjectAligned = climaxAsset
    ? isBeatThemeAligned({
        asset: themedCandidateFromEntry(climaxAsset),
        beatRole: "climax",
        themeAnalysis
      })
    : false;

  const placeholderPlan = buildPremiumComicsPlaceholderPlan();
  const readiness = evaluateFocusedRenderReadiness({
    trueComicsAssetCount,
    premiumAcceptedCount: premiumAccepted.length,
    subjectAlignedCount,
    hookAsset,
    climaxAsset,
    hookSubjectAligned,
    climaxSubjectAligned,
    genericEntityMatchCount,
    genericAcceptedCount,
    contactSheetPath
  });

  if (!readiness.canRender && trueComicsAssetCount < MIN_TRUE_COMICS_ASSETS) {
    readiness.warnings.push("placeholder_plan_available_without_render");
  }

  return {
    variation: "B — Comics",
    mode: FOCUSED_COMICS_DISCOVERY_MODE,
    queriesUsed: discovery.queriesUsed,
    sourcesAllowed: [...FOCUSED_COMICS_SOURCES_ALLOWED],
    primaryCatalogSources: [...FOCUSED_COMICS_PRIMARY_CATALOG_SOURCES],
    totalCandidatesFound: discovery.rankedCandidates.length,
    substantiveUrlCount: discovery.substantiveUrlCount,
    acceptedCount: acceptedAssets.length,
    premiumAcceptedCount: premiumAccepted.length,
    trueComicsAssetCount,
    rejectedCount: rejectedAssets.length,
    acceptedAssets,
    rejectedAssets,
    hookAsset,
    climaxAsset,
    placeholderPlan,
    contactSheetPath,
    canRender: readiness.canRender,
    blockReason: readiness.blockReason,
    subjectSummary: {
      subjectTheme: narrativeContext.subjectTheme,
      narrativeTheme: narrativeContext.narrativeTheme,
      videoTitle: narrativeContext.videoTitle,
      directSubjectMatchCount,
      genericEntityMatchCount,
      rejectedForWeakSubjectRelevance,
      hookSubjectAligned,
      climaxSubjectAligned,
      hookSelectionReason: hookSelection.reason,
      climaxSelectionReason: climaxSelection.reason
    },
    themeSummary: {
      narrativeThemes: themeAnalysis.narrativeThemes,
      relationshipType: themeAnalysis.relationshipType,
      visualMotifs: themeAnalysis.visualMotifs,
      recommendedAssetSignals: themeAnalysis.recommendedAssetSignals,
      disallowedAssetSignals: themeAnalysis.disallowedAssetSignals,
      themeAlignedCount,
      rejectedForWeakThemeMatch
    },
    themeAnalysis,
    warnings: [
      ...discovery.warnings,
      ...readiness.warnings,
      `subject_theme:${narrativeContext.subjectTheme}`,
      `narrative_themes:${themeAnalysis.narrativeThemes.join(",")}`,
      `relationship_type:${themeAnalysis.relationshipType}`,
      `subject_aligned_assets:${subjectAlignedCount}`,
      `theme_aligned_assets:${themeAlignedCount}`,
      `rejected_weak_subject:${rejectedForWeakSubjectRelevance}`,
      `rejected_weak_theme:${rejectedForWeakThemeMatch}`
    ]
  };
}