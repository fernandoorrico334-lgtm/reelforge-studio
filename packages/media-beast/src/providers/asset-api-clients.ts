import type { RemixContentDomain } from "../pipeline/remix-content-intelligence.js";
import {
  isAssetHomonymMismatch,
  isLowQualityAssetTitle,
  normalizeAssetTitleKey,
  normalizePreviewUrlKey,
  scoreHomonymPenalty
} from "../pipeline/remix-asset-discovery-strategies.js";
import type { MediaBeastCandidate, MediaBeastProviderId } from "./types.js";
import { stableCandidateId } from "./provider-utils.js";

const IMAGE_EXTENSIONS = /\.(jpg|jpeg|png|webp|gif|avif)(\?|$)/i;
const CACHE_TTL_MS = 15 * 60 * 1000;
const MAX_CACHE_ENTRIES = 200;

const QUERY_STOP_WORDS = new Set([
  "archive",
  "photo",
  "high",
  "resolution",
  "comic",
  "book",
  "panel",
  "public",
  "domain",
  "editorial",
  "reference",
  "official",
  "art",
  "illustration",
  "scan",
  "golden",
  "age",
  "match",
  "action",
  "scene",
  "composition",
  "vertical",
  "noir",
  "poster",
  "halftone",
  "history",
  "historical",
  "documentary",
  "press",
  "marvel",
  "ideal",
  "perfeito",
  "perfect",
  "partner",
  "parceiro"
]);

const apiJsonCache = new Map<string, { expiresAt: number; data: unknown }>();

export function clearAssetApiCache() {
  apiJsonCache.clear();
}

export function simplifyAssetQuery(query: string, maxTerms = 4): string {
  const terms = query
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/\s+/)
    .map((term) => term.trim())
    .filter((term) => term.length > 2 && !QUERY_STOP_WORDS.has(term));

  return [...new Set(terms)].slice(0, maxTerms).join(" ");
}

export function extractEntityTermsFromQuery(query: string): string[] {
  return simplifyAssetQuery(query, 6)
    .split(/\s+/)
    .filter((term) => term.length > 2);
}

export function scoreAssetQueryRelevance(
  title: string,
  query: string,
  entityTerms?: string[]
): number {
  const simplified = simplifyAssetQuery(query);
  const terms = [
    ...simplified.split(/\s+/).filter((term) => term.length > 2),
    ...(entityTerms ?? [])
  ];
  const uniqueTerms = [...new Set(terms.map((term) => term.toLowerCase()))];
  if (uniqueTerms.length === 0) return 0;

  const haystack = title.toLowerCase();
  let score = 0;
  for (const term of uniqueTerms) {
    if (haystack.includes(term)) score += 12;
  }
  return score;
}

export interface AssetTitleRelevanceOptions {
  entityTerms?: string[];
  domain?: RemixContentDomain;
  description?: string;
}

function buildAssetTitleRelevanceOptions(input: {
  entityTerms?: string[];
  domain?: RemixContentDomain;
  description?: string;
}): AssetTitleRelevanceOptions {
  return {
    ...(input.entityTerms?.length ? { entityTerms: input.entityTerms } : {}),
    ...(input.domain ? { domain: input.domain } : {}),
    ...(input.description ? { description: input.description } : {})
  };
}

function isRelevantAssetTitle(
  title: string,
  query: string,
  options?: AssetTitleRelevanceOptions
): boolean {
  const entityTerms = options?.entityTerms;
  const relevance = scoreAssetQueryRelevance(title, query, entityTerms);
  const terms = extractEntityTermsFromQuery(query);
  const mergedTerms = [...new Set([...terms, ...(entityTerms ?? [])])];
  const haystack = title.toLowerCase();

  if (/\.(pdf|djvu|epub)(\b|\.)/i.test(title)) return false;
  if (/essay|manuscript|newspaper page \d/i.test(haystack) && relevance < 16) return false;

  if (options?.domain) {
    if (
      isAssetHomonymMismatch({
        domain: options.domain,
        title,
        ...(options.description ? { description: options.description } : {}),
        ...(entityTerms?.length ? { entityNames: entityTerms } : {})
      })
    ) {
      return false;
    }
    if (
      isLowQualityAssetTitle({
        domain: options.domain,
        title,
        ...(options.description ? { description: options.description } : {})
      })
    ) {
      return false;
    }
  }

  if (mergedTerms.length === 0) return relevance >= 8;
  const matched = mergedTerms.filter((term) => haystack.includes(term)).length;
  if (matched >= 2) return true;
  if (matched >= 1 && relevance >= 10) return true;
  return relevance >= 14;
}

function applyHomonymScoreAdjustment(
  baseScore: number,
  title: string,
  options?: AssetTitleRelevanceOptions
): number {
  if (!options?.domain) return baseScore;
  const penalty = scoreHomonymPenalty({
    domain: options.domain,
    title,
    ...(options.description ? { description: options.description } : {}),
    ...(options.entityTerms?.length ? { entityNames: options.entityTerms } : {})
  });
  return Math.max(0, baseScore - penalty);
}

export function isDirectImageUrl(url: string): boolean {
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    return IMAGE_EXTENSIONS.test(pathname);
  } catch {
    return IMAGE_EXTENSIONS.test(url);
  }
}

function trimCache() {
  if (apiJsonCache.size <= MAX_CACHE_ENTRIES) return;
  const overflow = apiJsonCache.size - MAX_CACHE_ENTRIES;
  const keys = [...apiJsonCache.keys()].slice(0, overflow);
  for (const key of keys) apiJsonCache.delete(key);
}

async function fetchJson<T>(url: string, timeoutMs = 12_000, retries = 2): Promise<T | null> {
  const cached = apiJsonCache.get(url);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data as T;
  }

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { "user-agent": "ReelForge-MediaBeast/1.0 (+asset-discovery)" },
        signal: AbortSignal.timeout(timeoutMs)
      });
      if (!response.ok) return null;
      const data = (await response.json()) as T;
      apiJsonCache.set(url, { expiresAt: Date.now() + CACHE_TTL_MS, data });
      trimCache();
      return data;
    } catch {
      if (attempt === retries) return null;
      await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
    }
  }
  return null;
}

function buildImageCandidate(input: {
  providerId: MediaBeastProviderId;
  title: string;
  sourceUrl: string;
  previewUrl: string;
  query: string;
  score: number;
  licenseStatus: MediaBeastCandidate["licenseStatus"];
  riskLevel: MediaBeastCandidate["riskLevel"];
  reasons: string[];
  metadata?: Record<string, string | number | boolean | null>;
}): MediaBeastCandidate {
  return {
    id: stableCandidateId(
      input.providerId,
      `${input.previewUrl || input.sourceUrl}:${input.title}`
    ),
    providerId: input.providerId,
    kind: "image",
    title: input.title.slice(0, 120),
    sourceUrl: input.sourceUrl,
    previewUrl: input.previewUrl,
    licenseStatus: input.licenseStatus,
    riskLevel: input.riskLevel,
    score: input.score,
    reasons: input.reasons,
    warnings: ["Verify license and attribution before import."],
    metadata: {
      query: input.query,
      directImage: true,
      searchSurface: false,
      ...input.metadata
    }
  };
}

interface ArchiveSearchResponse {
  response?: {
    docs?: Array<{
      identifier?: string;
      title?: string;
      description?: string;
    }>;
  };
}

export async function searchInternetArchiveImages(
  query: string,
  maxResults = 6,
  entityTerms?: string[],
  domain?: RemixContentDomain
): Promise<MediaBeastCandidate[]> {
  const simplified = simplifyAssetQuery(query, 5);
  if (!simplified) return [];

  const archiveQuery = `${simplified} AND mediatype:image`;
  const url = new URL("https://archive.org/advancedsearch.php");
  url.searchParams.set("q", archiveQuery);
  url.searchParams.append("fl[]", "identifier");
  url.searchParams.append("fl[]", "title");
  url.searchParams.append("fl[]", "description");
  url.searchParams.set("output", "json");
  url.searchParams.set("rows", String(Math.min(maxResults * 2, 16)));

  const data = await fetchJson<ArchiveSearchResponse>(url.toString());
  const docs = data?.response?.docs ?? [];

  return docs
    .filter((doc) => doc.identifier)
    .map((doc) => {
      const title = doc.title ?? doc.identifier!;
      const relevance = scoreAssetQueryRelevance(title, query, entityTerms);
      return { doc, relevance, title };
    })
    .filter((entry) =>
      isRelevantAssetTitle(
        entry.title,
        query,
        buildAssetTitleRelevanceOptions({
          ...(entityTerms?.length ? { entityTerms } : {}),
          ...(domain ? { domain } : {}),
          ...(entry.doc.description ? { description: entry.doc.description } : {})
        })
      )
    )
    .sort((left, right) => right.relevance - left.relevance)
    .slice(0, maxResults)
    .map(({ doc, relevance, title }) => {
      const identifier = doc.identifier!;
      const itemUrl = `https://archive.org/details/${identifier}`;
      const previewUrl = `https://archive.org/services/img/${identifier}`;
      const relevanceOptions = buildAssetTitleRelevanceOptions({
        ...(entityTerms?.length ? { entityTerms } : {}),
        ...(domain ? { domain } : {}),
        ...(doc.description ? { description: doc.description } : {})
      });

      return buildImageCandidate({
        providerId: "internet-archive",
        title: doc.title ?? identifier,
        sourceUrl: itemUrl,
        previewUrl,
        query,
        score: applyHomonymScoreAdjustment(72 + Math.min(24, relevance), title, relevanceOptions),
        licenseStatus: "unknown",
        riskLevel: "medium",
        reasons: [
          "Item real do Internet Archive com thumbnail direto.",
          "Pagina /details com metadados e arquivo importavel."
        ],
        metadata: {
          archiveIdentifier: identifier,
          archiveMediatype: "image"
        }
      });
    });
}

interface OpenverseImage {
  id?: string;
  title?: string;
  url?: string;
  thumbnail?: string;
  foreign_landing_url?: string;
  source?: string;
  license?: string;
  creator?: string;
}

interface OpenverseResponse {
  result_count?: number;
  results?: OpenverseImage[];
}

function mapOpenverseLicense(license?: string): MediaBeastCandidate["licenseStatus"] {
  if (!license) return "unknown";
  const normalized = license.toLowerCase();
  if (normalized.includes("cc0") || normalized.includes("public")) return "public_domain";
  if (normalized.startsWith("cc")) return "creative_commons";
  return "unknown";
}

export async function searchOpenverseImages(
  query: string,
  options?: {
    providerId?: MediaBeastProviderId;
    source?: string;
    maxResults?: number;
    entityTerms?: string[];
    domain?: RemixContentDomain;
  }
): Promise<MediaBeastCandidate[]> {
  const providerId = options?.providerId ?? "generic-web";
  const maxResults = options?.maxResults ?? 6;
  const simplified = simplifyAssetQuery(query, 5) || query;
  const url = new URL("https://api.openverse.org/v1/images/");
  url.searchParams.set("q", simplified);
  url.searchParams.set("page_size", String(Math.min(maxResults * 2, 20)));
  if (options?.source) {
    url.searchParams.set("source", options.source);
  }

  const data = await fetchJson<OpenverseResponse>(url.toString());
  const results = data?.results ?? [];

  return results
    .filter((item) => item.url && (item.thumbnail || isDirectImageUrl(item.url)))
    .map((item) => {
      const title = item.title ?? query;
      const relevance = scoreAssetQueryRelevance(title, query, options?.entityTerms);
      return { item, relevance, title };
    })
    .filter((entry) =>
      isRelevantAssetTitle(
        entry.title,
        query,
        buildAssetTitleRelevanceOptions({
          ...(options?.entityTerms?.length ? { entityTerms: options.entityTerms } : {}),
          ...(options?.domain ? { domain: options.domain } : {})
        })
      )
    )
    .sort((left, right) => right.relevance - left.relevance)
    .slice(0, maxResults)
    .map(({ item, relevance, title }) => {
      const previewUrl = item.thumbnail ?? item.url!;
      const sourceUrl = item.foreign_landing_url ?? item.url!;
      const relevanceOptions = buildAssetTitleRelevanceOptions({
        ...(options?.entityTerms?.length ? { entityTerms: options.entityTerms } : {}),
        ...(options?.domain ? { domain: options.domain } : {})
      });

      return buildImageCandidate({
        providerId,
        title: item.title ?? query,
        sourceUrl,
        previewUrl,
        query,
        score: applyHomonymScoreAdjustment(
          (options?.source === "flickr" ? 68 : 64) + Math.min(24, relevance),
          title,
          relevanceOptions
        ),
        licenseStatus: mapOpenverseLicense(item.license),
        riskLevel: "low",
        reasons: [
          "Imagem real com URL direta via Openverse.",
          item.source ? `Fonte original: ${item.source}.` : "Fonte indexada com thumbnail utilizavel."
        ],
        metadata: {
          openverseId: item.id ?? null,
          openverseSource: item.source ?? null,
          creator: item.creator ?? null,
          license: item.license ?? null
        }
      });
    });
}

interface WikimediaSearchResponse {
  query?: {
    pages?: Record<
      string,
      {
        title?: string;
        imageinfo?: Array<{ thumburl?: string; url?: string; descriptionurl?: string }>;
      }
    >;
  };
}

export async function searchWikimediaCommonsImages(
  query: string,
  maxResults = 6,
  entityTerms?: string[],
  domain?: RemixContentDomain
): Promise<MediaBeastCandidate[]> {
  const simplified = simplifyAssetQuery(query, 5) || query;
  const url = new URL("https://commons.wikimedia.org/w/api.php");
  url.searchParams.set("action", "query");
  url.searchParams.set("generator", "search");
  url.searchParams.set("gsrsearch", simplified);
  url.searchParams.set("gsrnamespace", "6");
  url.searchParams.set("gsrlimit", String(Math.min(maxResults * 2, 20)));
  url.searchParams.set("prop", "imageinfo");
  url.searchParams.set("iiprop", "url|thumburl");
  url.searchParams.set("iiurlwidth", "960");
  url.searchParams.set("format", "json");
  url.searchParams.set("origin", "*");

  const data = await fetchJson<WikimediaSearchResponse>(url.toString());
  const pages = data?.query?.pages ?? {};

  return Object.values(pages)
    .map((page) => {
      const info = page.imageinfo?.[0];
      if (!info?.thumburl && !info?.url) return null;

      const pageTitle = (page.title ?? query).replace(/^File:/i, "");
      const relevanceOptions = buildAssetTitleRelevanceOptions({
        ...(entityTerms?.length ? { entityTerms } : {}),
        ...(domain ? { domain } : {})
      });
      if (!isRelevantAssetTitle(pageTitle, query, relevanceOptions)) return null;

      const relevance = scoreAssetQueryRelevance(pageTitle, query, entityTerms);
      const previewUrl = info.thumburl ?? info.url!;
      const sourceUrl = info.descriptionurl ?? info.url!;

      return buildImageCandidate({
        providerId: "comics-archive",
        title: pageTitle,
        sourceUrl,
        previewUrl,
        query,
        score: applyHomonymScoreAdjustment(
          70 + Math.min(24, relevance),
          pageTitle,
          relevanceOptions
        ),
        licenseStatus: "creative_commons",
        riskLevel: "low",
        reasons: [
          "Imagem real do Wikimedia Commons com thumbnail direto.",
          "Util para referencia editorial e paineis de dominio publico/CC."
        ],
        metadata: {
          wikimediaFile: page.title ?? null,
          commonsAsset: true
        }
      });
    })
    .filter((candidate): candidate is MediaBeastCandidate => candidate !== null)
    .sort((left, right) => right.score - left.score)
    .slice(0, maxResults);
}

export async function searchDirectAssetBundle(input: {
  query: string;
  maxPerSource?: number;
  entityTerms?: string[];
  includeFlickr?: boolean;
  domain?: RemixContentDomain;
}): Promise<MediaBeastCandidate[]> {
  const maxPerSource = input.maxPerSource ?? 5;
  const entityTerms = input.entityTerms ?? extractEntityTermsFromQuery(input.query);
  const domain = input.domain;
  const candidateMap = new Map<string, MediaBeastCandidate>();
  const seenTitleKeys = new Set<string>();
  const seenPreviewKeys = new Set<string>();

  const [wikimedia, openverse, archive, flickr] = await Promise.all([
    searchWikimediaCommonsImages(input.query, maxPerSource, entityTerms, domain),
    searchOpenverseImages(input.query, {
      providerId: "comics-archive",
      maxResults: maxPerSource,
      entityTerms,
      ...(domain ? { domain } : {})
    }),
    searchInternetArchiveImages(input.query, maxPerSource, entityTerms, domain),
    input.includeFlickr !== false
      ? searchOpenverseImages(input.query, {
          providerId: "flickr",
          source: "flickr",
          maxResults: maxPerSource,
          entityTerms,
          ...(domain ? { domain } : {})
        })
      : Promise.resolve([])
  ]);

  for (const group of [wikimedia, openverse, archive, flickr]) {
    for (const candidate of group) {
      const titleKey = normalizeAssetTitleKey(candidate.title);
      const previewKey = normalizePreviewUrlKey(candidate.previewUrl);
      if (seenTitleKeys.has(titleKey)) continue;
      if (previewKey && seenPreviewKeys.has(previewKey)) continue;

      seenTitleKeys.add(titleKey);
      if (previewKey) seenPreviewKeys.add(previewKey);
      const existing = candidateMap.get(candidate.id);
      if (!existing || candidate.score > existing.score) {
        candidateMap.set(candidate.id, candidate);
      }
    }
  }

  return [...candidateMap.values()].sort((left, right) => right.score - left.score);
}