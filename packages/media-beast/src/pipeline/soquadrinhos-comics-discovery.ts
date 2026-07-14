import { stableCandidateId } from "../providers/provider-utils.js";
import type { MediaBeastCandidate } from "../providers/types.js";
import {
  decodeHtmlEntities,
  expandEntityTerms,
  isUsableCatalogCoverUrl,
  PRIMARY_CATALOG_SOURCE_PRIORITY,
  PRIMARY_CATALOG_SOURCE_TIER,
  scoreEntityMatch,
  SERIES_BONUS_MATCHERS,
  type PrimaryCatalogPublisher
} from "./comics-catalog-discovery-shared.js";

export const SOQUADRINHOS_MARVEL_INDEX_URL =
  "https://site.soquadrinhos.com/marvel-comics/";

export const SOQUADRINHOS_DISCOVERY_SOURCE = "soquadrinhos_catalog";

export const SOQUADRINHOS_SOURCE_PRIORITY = PRIMARY_CATALOG_SOURCE_PRIORITY;
export const SOQUADRINHOS_SOURCE_TIER = PRIMARY_CATALOG_SOURCE_TIER;
export type SoQuadrinhosCatalogPublisher = PrimaryCatalogPublisher;

export const SOQUADRINHOS_PUBLISHER_INDEXES: SoQuadrinhosCatalogPublisher[] = [
  {
    id: "soquadrinhos-marvel",
    label: "SoQuadrinhos — Marvel Comics",
    indexUrl: SOQUADRINHOS_MARVEL_INDEX_URL,
    franchise: "Marvel",
    priority: SOQUADRINHOS_SOURCE_PRIORITY,
    heroScope: "multi_hero",
    notes:
      "Índice A–Z com milhares de séries Marvel. Capas via ComicVine/SoQuadrinhos. Reutilizável para qualquer herói (Venom, Homem-Aranha, Capitão América, X-Men, etc.)."
  }
];

const SERIES_LINK_PATTERN =
  /<a href="(https:\/\/site\.soquadrinhos\.com\/[^"]+)">\s*([^<]+?)\s*<\/a>/gi;

function normalizeImageUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return trimmed;

  if (/^\/\//.test(trimmed)) {
    return `https:${trimmed}`;
  }

  const shortpixelMatch = trimmed.match(
    /shortpixel\.ai\/client\/[^/]+\/https:\/\/site\.soquadrinhos\.com\/wp-content\/uploads\/[^"'?]+\.(?:jpe?g|png|webp)/i
  );
  if (shortpixelMatch) {
    return shortpixelMatch[0].replace(/^https?:\/\/[^/]+\/client\/[^/]+\//i, "https://");
  }

  return trimmed.split("?")[0] ?? trimmed;
}

export function isSoQuadrinhosCatalogCandidate(
  candidate: Pick<MediaBeastCandidate, "metadata">
): boolean {
  return candidate.metadata.discoverySource === SOQUADRINHOS_DISCOVERY_SOURCE;
}

export type SoQuadrinhosSeriesRef = {
  title: string;
  seriesUrl: string;
  relevanceScore: number;
};

export type SoQuadrinhosCoverAsset = {
  title: string;
  seriesUrl: string;
  imageUrl: string;
  relevanceScore: number;
  imageKind: "comicvine_cover" | "soquadrinhos_upload" | "wp_cdn_cover";
  franchise: string;
};

export function parseSoQuadrinhosMarvelIndex(html: string): SoQuadrinhosSeriesRef[] {
  const seen = new Set<string>();
  const series: SoQuadrinhosSeriesRef[] = [];

  for (const match of html.matchAll(SERIES_LINK_PATTERN)) {
    const seriesUrl = match[1]?.trim();
    const title = decodeHtmlEntities(match[2] ?? "");
    if (!seriesUrl || !title) continue;
    if (seriesUrl.includes("/marvel-comics/")) continue;
    if (seen.has(seriesUrl)) continue;
    seen.add(seriesUrl);

    const haystack = `${title} ${seriesUrl}`;
    let relevanceScore = 1;
    for (const matcher of SERIES_BONUS_MATCHERS) {
      if (matcher.pattern.test(haystack)) {
        relevanceScore += matcher.weight;
      }
    }

    series.push({ title, seriesUrl, relevanceScore });
  }

  return series.sort((left, right) => right.relevanceScore - left.relevanceScore);
}

export function rankSoQuadrinhosSeriesForEntities(
  series: SoQuadrinhosSeriesRef[],
  entities: string[]
): SoQuadrinhosSeriesRef[] {
  const entityTerms = expandEntityTerms(entities);
  if (entityTerms.length === 0) return series;

  return [...series]
    .map((entry) => {
      const haystack = `${entry.title} ${entry.seriesUrl}`.toLowerCase();
      const entityBoost = scoreEntityMatch(haystack, entityTerms);
      return { ...entry, relevanceScore: entry.relevanceScore + entityBoost };
    })
    .sort((left, right) => right.relevanceScore - left.relevanceScore);
}

export function extractSoQuadrinhosSeriesCoverAssets(
  html: string,
  series: SoQuadrinhosSeriesRef,
  franchise = "Marvel"
): SoQuadrinhosCoverAsset[] {
  const imageUrls = new Set<string>();

  const ogImage = html.match(/property="og:image" content="([^"]+)"/i)?.[1];
  if (ogImage && isUsableCatalogCoverUrl(ogImage)) {
    imageUrls.add(normalizeImageUrl(ogImage));
  }

  for (const match of html.matchAll(/https?:\/\/[^"'<\s]+/gi)) {
    const raw = match[0];
    if (!isUsableCatalogCoverUrl(raw)) continue;
    imageUrls.add(normalizeImageUrl(raw));
  }

  return [...imageUrls].map((imageUrl) => ({
    title: series.title,
    seriesUrl: series.seriesUrl,
    imageUrl,
    relevanceScore: series.relevanceScore,
    imageKind: classifySoQuadrinhosImageKind(imageUrl),
    franchise
  }));
}

function classifySoQuadrinhosImageKind(
  imageUrl: string
): SoQuadrinhosCoverAsset["imageKind"] {
  if (/site\.soquadrinhos\.com\/wp-content\/uploads\//i.test(imageUrl)) {
    return "soquadrinhos_upload";
  }
  if (/i\d\.wp\.com\/comicvine\.gamespot\.com/i.test(imageUrl)) {
    return "wp_cdn_cover";
  }
  return "comicvine_cover";
}

function buildSoQuadrinhosCandidate(
  asset: SoQuadrinhosCoverAsset,
  publisher: SoQuadrinhosCatalogPublisher
): MediaBeastCandidate {
  const catalogTitle = `${asset.title} — ${asset.franchise} comic cover (SoQuadrinhos)`;

  return {
    id: stableCandidateId("comics-archive", `${asset.imageUrl}:${asset.seriesUrl}`),
    providerId: "comics-archive",
    kind: "image",
    title: catalogTitle.slice(0, 120),
    sourceUrl: asset.imageUrl,
    previewUrl: asset.imageUrl,
    licenseStatus: "editorial_only",
    riskLevel: "high",
    score: Math.min(100, 92 + Math.min(asset.relevanceScore, 8)),
    reasons: [
      "soquadrinhos_primary_marvel_catalog",
      PRIMARY_CATALOG_SOURCE_PRIORITY,
      `series_relevance:${asset.relevanceScore}`,
      asset.imageKind
    ],
    warnings: [
      "SoQuadrinhos/ComicVine cover art is copyrighted — verify editorial use before render.",
      "Primary catalog source — reusable across Marvel heroes; manual license review still required."
    ],
    metadata: {
      discoverySource: SOQUADRINHOS_DISCOVERY_SOURCE,
      sourcePriority: PRIMARY_CATALOG_SOURCE_PRIORITY,
      sourceTier: PRIMARY_CATALOG_SOURCE_TIER,
      catalogPublisherId: publisher.id,
      catalogHeroScope: publisher.heroScope,
      soquadrinhosSeriesUrl: asset.seriesUrl,
      soquadrinhosSeriesTitle: asset.title,
      franchise: asset.franchise,
      imageKind: asset.imageKind,
      query: `${asset.title} ${asset.franchise} comic cover`,
      directImage: true,
      searchSurface: false,
      catalogPriority: true,
      catalogRelevanceScore: asset.relevanceScore,
      catalogPostTitle: asset.title,
      comicsVisualLanguage: `${asset.franchise} comic cover hq quadrinhos marvel issue cover`
    }
  };
}

async function fetchSoQuadrinhosHtml(
  url: string,
  fetchFn: typeof fetch,
  timeoutMs = 20_000
): Promise<string | null> {
  try {
    const response = await fetchFn(url, {
      headers: {
        "user-agent": "ReelForgeStudio/1.0 (+https://reelforge.studio; comics-discovery)",
        accept: "text/html,application/xhtml+xml"
      },
      signal: AbortSignal.timeout(timeoutMs)
    });
    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  }
}

export async function discoverSoQuadrinhosComicsAssets(input: {
  entities: string[];
  indexUrl?: string;
  franchise?: string;
  publisherId?: string;
  maxSeries?: number;
  maxCandidates?: number;
  fetchFn?: typeof fetch;
  indexHtml?: string;
}): Promise<{
  candidates: MediaBeastCandidate[];
  seriesMatched: number;
  seriesScanned: number;
  coverAssetsFound: number;
  publisher: SoQuadrinhosCatalogPublisher;
  warnings: string[];
}> {
  const fetchFn = input.fetchFn ?? fetch;
  const warnings: string[] = [];
  const publisher =
    SOQUADRINHOS_PUBLISHER_INDEXES.find((entry) => entry.id === input.publisherId) ??
    SOQUADRINHOS_PUBLISHER_INDEXES[0]!;
  const indexUrl = input.indexUrl ?? publisher.indexUrl;
  const franchise = input.franchise ?? publisher.franchise;
  const maxSeries = input.maxSeries ?? 28;
  const maxCandidates = input.maxCandidates ?? 32;

  const indexHtml =
    input.indexHtml ?? (await fetchSoQuadrinhosHtml(indexUrl, fetchFn));
  if (!indexHtml) {
    warnings.push(`soquadrinhos_index_fetch_failed:${indexUrl}`);
    return {
      candidates: [],
      seriesMatched: 0,
      seriesScanned: 0,
      coverAssetsFound: 0,
      publisher,
      warnings
    };
  }

  const rankedSeries = rankSoQuadrinhosSeriesForEntities(
    parseSoQuadrinhosMarvelIndex(indexHtml),
    input.entities
  )
    .filter((entry) => entry.relevanceScore > 0)
    .slice(0, maxSeries);

  if (rankedSeries.length === 0) {
    warnings.push("soquadrinhos_no_relevant_series_for_entities");
    return {
      candidates: [],
      seriesMatched: 0,
      seriesScanned: 0,
      coverAssetsFound: 0,
      publisher,
      warnings
    };
  }

  const coverAssets: SoQuadrinhosCoverAsset[] = [];
  let seriesScanned = 0;

  for (const series of rankedSeries) {
    const seriesHtml = await fetchSoQuadrinhosHtml(series.seriesUrl, fetchFn);
    seriesScanned += 1;
    if (!seriesHtml) {
      warnings.push(`soquadrinhos_series_fetch_failed:${series.seriesUrl}`);
      continue;
    }
    const assets = extractSoQuadrinhosSeriesCoverAssets(seriesHtml, series, franchise);
    if (assets.length === 0) {
      warnings.push(`soquadrinhos_series_without_cover:${series.seriesUrl}`);
      continue;
    }
    coverAssets.push(...assets);
  }

  const candidateMap = new Map<string, MediaBeastCandidate>();
  for (const asset of coverAssets.sort((left, right) => right.relevanceScore - left.relevanceScore)) {
    const candidate = buildSoQuadrinhosCandidate(asset, publisher);
    candidateMap.set(candidate.id, candidate);
    if (candidateMap.size >= maxCandidates) break;
  }

  warnings.push(
    `SoQuadrinhos [${PRIMARY_CATALOG_SOURCE_PRIORITY}]: ${rankedSeries.length} séries alvo (${publisher.heroScope}), ${seriesScanned} páginas lidas, ${candidateMap.size} capas extraídas.`
  );

  return {
    candidates: [...candidateMap.values()],
    seriesMatched: rankedSeries.length,
    seriesScanned,
    coverAssetsFound: coverAssets.length,
    publisher,
    warnings
  };
}