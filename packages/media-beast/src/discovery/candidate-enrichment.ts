import { isDirectImageUrl } from "../providers/asset-api-clients.js";
import type { MediaBeastCandidate } from "../providers/types.js";

export type ContentSignalType =
  | "search_index"
  | "empty_landing"
  | "article"
  | "media_gallery"
  | "forum_thread"
  | "archive_item"
  | "video_page"
  | "unknown";

export interface PageContentSignals {
  pageTitle: string | null;
  pageDescription: string | null;
  contentType: ContentSignalType;
  substantiveScore: number;
  searchSurface: boolean;
  enriched: boolean;
  enrichError?: string;
}

export interface CandidateEnrichmentOptions {
  query?: string;
  minScore?: number;
  enrichRemote?: boolean;
  maxRemoteFetches?: number;
  maxConcurrent?: number;
}

const SEARCH_SURFACE_PATTERNS: Array<{ pattern: RegExp; type: ContentSignalType }> = [
  { pattern: /google\.com\/search/i, type: "search_index" },
  { pattern: /flickr\.com\/search/i, type: "search_index" },
  { pattern: /youtube\.com\/results/i, type: "search_index" },
  { pattern: /reddit\.com\/search/i, type: "search_index" },
  { pattern: /tiktok\.com\/search/i, type: "search_index" },
  { pattern: /pinterest\.com\/search/i, type: "search_index" },
  { pattern: /trends\.google\.com/i, type: "search_index" },
  { pattern: /archive\.org\/search/i, type: "search_index" },
  { pattern: /bing\.com\/search/i, type: "search_index" },
  { pattern: /duckduckgo\.com\/\?/i, type: "search_index" }
];

const SUBSTANTIVE_URL_PATTERNS: Array<{ pattern: RegExp; type: ContentSignalType; boost: number }> =
  [
    { pattern: /wikipedia\.org\/wiki\//i, type: "article", boost: 22 },
    { pattern: /archive\.org\/details\//i, type: "archive_item", boost: 24 },
    { pattern: /web\.archive\.org\/web\//i, type: "archive_item", boost: 20 },
    { pattern: /youtube\.com\/watch/i, type: "video_page", boost: 20 },
    { pattern: /youtu\.be\//i, type: "video_page", boost: 20 },
    { pattern: /reddit\.com\/r\/[^/]+\/comments\//i, type: "forum_thread", boost: 18 },
    { pattern: /flickr\.com\/photos\//i, type: "media_gallery", boost: 16 },
    { pattern: /news\.google\.com\/read/i, type: "article", boost: 14 },
    { pattern: /medium\.com\//i, type: "article", boost: 10 },
    { pattern: /substack\.com\//i, type: "article", boost: 10 }
  ];

const FETCH_BYTE_LIMIT = 24_000;
const DEFAULT_FETCH_TIMEOUT_MS = 4_500;

export function isSearchSurfaceUrl(url: string): boolean {
  return SEARCH_SURFACE_PATTERNS.some((entry) => entry.pattern.test(url));
}

export function inferContentTypeFromUrl(url: string): {
  contentType: ContentSignalType;
  substantiveBoost: number;
  searchSurface: boolean;
} {
  if (isSearchSurfaceUrl(url)) {
    const match = SEARCH_SURFACE_PATTERNS.find((entry) => entry.pattern.test(url));
    return {
      contentType: match?.type ?? "search_index",
      substantiveBoost: -32,
      searchSurface: true
    };
  }

  const substantive = SUBSTANTIVE_URL_PATTERNS.find((entry) => entry.pattern.test(url));
  if (substantive) {
    return {
      contentType: substantive.type,
      substantiveBoost: substantive.boost,
      searchSurface: false
    };
  }

  return {
    contentType: "unknown",
    substantiveBoost: 0,
    searchSurface: false
  };
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .trim();
}

function extractTagContent(html: string, tag: string): string | null {
  const match = html.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  if (!match?.[1]) {
    return null;
  }

  const cleaned = decodeHtmlEntities(match[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " "));
  return cleaned.length > 0 ? cleaned : null;
}

function extractMetaContent(html: string, key: string, attr: "name" | "property" = "name"): string | null {
  const pattern = new RegExp(
    `<meta[^>]+${attr}=["']${key}["'][^>]+content=["']([^"']+)["']`,
    "i"
  );
  const altPattern = new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]+${attr}=["']${key}["']`,
    "i"
  );

  const match = html.match(pattern) ?? html.match(altPattern);
  if (!match?.[1]) {
    return null;
  }

  const cleaned = decodeHtmlEntities(match[1].replace(/\s+/g, " "));
  return cleaned.length > 0 ? cleaned : null;
}

export function extractPageSignalsFromHtml(html: string, url: string): PageContentSignals {
  const urlInference = inferContentTypeFromUrl(url);
  const pageTitle =
    extractMetaContent(html, "og:title", "property") ??
    extractTagContent(html, "title");
  const pageDescription =
    extractMetaContent(html, "og:description", "property") ??
    extractMetaContent(html, "description", "name");

  let substantiveScore = 35;
  const titleLen = pageTitle?.length ?? 0;
  const descLen = pageDescription?.length ?? 0;

  if (titleLen >= 12) {
    substantiveScore += 12;
  }
  if (titleLen >= 40) {
    substantiveScore += 6;
  }
  if (descLen >= 40) {
    substantiveScore += 14;
  }
  if (descLen >= 120) {
    substantiveScore += 8;
  }

  const thinSignals = [
    /no results/i,
    /page not found/i,
    /404/,
    /sign in to continue/i,
    /enable javascript/i
  ];
  const combined = `${pageTitle ?? ""} ${pageDescription ?? ""}`;

  if (thinSignals.some((pattern) => pattern.test(combined))) {
    substantiveScore -= 25;
  }

  if (titleLen < 6 && descLen < 20) {
    substantiveScore -= 18;
  }

  substantiveScore += urlInference.substantiveBoost;
  substantiveScore = Math.max(0, Math.min(100, substantiveScore));

  let contentType = urlInference.contentType;
  if (!urlInference.searchSurface) {
    if (descLen >= 80 && /article|story|report/i.test(combined)) {
      contentType = "article";
    } else if (/forum|thread|discussion|comments/i.test(combined)) {
      contentType = "forum_thread";
    } else if (/photo|gallery|image|archive/i.test(combined)) {
      contentType = "media_gallery";
    }
  }

  if (substantiveScore < 20 && !urlInference.searchSurface) {
    contentType = "empty_landing";
  }

  return {
    pageTitle,
    pageDescription,
    contentType,
    substantiveScore,
    searchSurface: urlInference.searchSurface,
    enriched: true
  };
}

export function buildLocalPageSignals(url: string): PageContentSignals {
  const inference = inferContentTypeFromUrl(url);

  return {
    pageTitle: null,
    pageDescription: null,
    contentType: inference.contentType,
    substantiveScore: inference.searchSurface
      ? 12
      : Math.max(28, 40 + inference.substantiveBoost),
    searchSurface: inference.searchSurface,
    enriched: false
  };
}

async function fetchHtmlSnippet(url: string, timeoutMs = DEFAULT_FETCH_TIMEOUT_MS): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": "ReelForge-MediaBeast-Discovery/1.0 (+discovery-only; no-download)"
      },
      redirect: "follow"
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      const text = await response.text();
      return text.slice(0, FETCH_BYTE_LIMIT);
    }

    const chunks: Uint8Array[] = [];
    let total = 0;

    while (total < FETCH_BYTE_LIMIT) {
      const { done, value } = await reader.read();
      if (done || !value) {
        break;
      }
      chunks.push(value);
      total += value.length;
    }

    reader.cancel().catch(() => undefined);
    const merged = Buffer.concat(chunks);
    return merged.toString("utf8", 0, Math.min(merged.length, FETCH_BYTE_LIMIT));
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchLightPageSignals(url: string): Promise<PageContentSignals> {
  const local = buildLocalPageSignals(url);
  if (local.searchSurface) {
    return local;
  }

  try {
    const html = await fetchHtmlSnippet(url);
    return extractPageSignalsFromHtml(html, url);
  } catch (error) {
    return {
      ...local,
      enrichError: error instanceof Error ? error.message : "fetch_failed"
    };
  }
}

function extractQueryTerms(query: string): string[] {
  return query
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/\s+/)
    .map((term) => term.trim())
    .filter((term) => term.length > 3);
}

function countTermMatches(text: string, terms: string[]): number {
  const normalized = text.toLowerCase();
  return terms.filter((term) => normalized.includes(term)).length;
}

export function scoreCandidateWithSignals(
  candidate: MediaBeastCandidate,
  signals: PageContentSignals,
  queryTerms: string[]
): number {
  let adjusted = candidate.score;
  const previewUrl = candidate.previewUrl;
  const hasDirectPreview =
    Boolean(previewUrl) &&
    (isDirectImageUrl(previewUrl!) ||
      candidate.metadata.directImage === true ||
      candidate.metadata.searchSurface === false);

  if (hasDirectPreview) {
    adjusted += 28;
  }

  if (signals.searchSurface) {
    adjusted -= 52;
  } else {
    adjusted += Math.round((signals.substantiveScore - 40) * 0.35);
  }

  if (!candidate.previewUrl && signals.searchSurface) {
    adjusted -= 24;
  }

  const combinedText = `${signals.pageTitle ?? ""} ${signals.pageDescription ?? ""} ${candidate.title}`;
  const matches = countTermMatches(combinedText, queryTerms);
  if (matches > 0) {
    adjusted += Math.min(20, matches * 6);
  }

  if (signals.contentType === "empty_landing") {
    adjusted -= 22;
  } else if (signals.contentType === "article" || signals.contentType === "archive_item") {
    adjusted += 10;
  } else if (signals.contentType === "video_page" || signals.contentType === "forum_thread") {
    adjusted += 8;
  } else if (signals.contentType === "search_index") {
    adjusted -= 12;
  }

  if (candidate.metadata.broadFallback === true) {
    adjusted -= 8;
  }

  return Math.max(0, Math.min(100, adjusted));
}

function applySignalsToCandidate(
  candidate: MediaBeastCandidate,
  signals: PageContentSignals,
  queryTerms: string[]
): MediaBeastCandidate {
  const adjustedScore = scoreCandidateWithSignals(candidate, signals, queryTerms);
  const warnings = [...candidate.warnings];

  if (signals.searchSurface) {
    warnings.push("Superficie de busca: abre lista de resultados, nao pagina com conteudo fixo.");
  }
  if (signals.contentType === "empty_landing") {
    warnings.push("Pagina parece ter pouco conteudo textual — priorize outra fonte.");
  }
  if (signals.enrichError) {
    warnings.push(`Enriquecimento leve falhou (${signals.enrichError}); score baseado em URL e heuristica.`);
  }

  const enrichedTitle =
    signals.pageTitle &&
    signals.pageTitle.length > 8 &&
    !signals.searchSurface &&
    candidate.title.length < 40
      ? signals.pageTitle
      : candidate.title;

  return {
    ...candidate,
    title: enrichedTitle,
    score: adjustedScore,
    warnings,
    metadata: {
      ...candidate.metadata,
      searchSurface: signals.searchSurface,
      contentSignals: signals.contentType,
      substantiveScore: signals.substantiveScore,
      pageTitle: signals.pageTitle,
      pageDescription: signals.pageDescription,
      enrichmentApplied: true,
      enrichmentRemote: signals.enriched
    }
  };
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;

  async function worker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await mapper(items[index]!);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

export async function enrichAndScoreCandidates(
  candidates: MediaBeastCandidate[],
  options: CandidateEnrichmentOptions = {}
): Promise<{ candidates: MediaBeastCandidate[]; warnings: string[] }> {
  const queryTerms = extractQueryTerms(options.query ?? "");
  const minScore = options.minScore ?? 18;
  const enrichRemote = options.enrichRemote ?? true;
  const maxRemoteFetches = options.maxRemoteFetches ?? 12;
  const maxConcurrent = options.maxConcurrent ?? 4;

  const locallyScored = candidates.map((candidate) => {
    const signals = buildLocalPageSignals(candidate.sourceUrl);
    return applySignalsToCandidate(candidate, signals, queryTerms);
  });

  const remoteTargets = enrichRemote
    ? locallyScored
        .filter((candidate) => candidate.metadata.searchSurface !== true)
        .sort((left, right) => right.score - left.score)
        .slice(0, maxRemoteFetches)
    : [];

  const remoteSignals = new Map<string, PageContentSignals>();
  if (remoteTargets.length > 0) {
    const fetched = await mapWithConcurrency(
      remoteTargets,
      maxConcurrent,
      async (candidate) => {
        const signals = await fetchLightPageSignals(candidate.sourceUrl);
        return { id: candidate.id, signals };
      }
    );

    for (const entry of fetched) {
      remoteSignals.set(entry.id, entry.signals);
    }
  }

  const enriched = locallyScored.map((candidate) => {
    const remote = remoteSignals.get(candidate.id);
    if (!remote) {
      return candidate;
    }
    return applySignalsToCandidate(candidate, remote, queryTerms);
  });

  const sorted = enriched.sort((left, right) => right.score - left.score);
  const isDirectAsset = (candidate: MediaBeastCandidate) =>
    Boolean(candidate.previewUrl) &&
    candidate.metadata.searchSurface !== true &&
    !isSearchSurfaceUrl(candidate.sourceUrl) &&
    (candidate.metadata.directImage === true ||
      isDirectImageUrl(candidate.previewUrl ?? "") ||
      String(candidate.previewUrl).includes("wikimedia.org") ||
      String(candidate.previewUrl).includes("openverse.org"));

  const withDirectImages = sorted.filter(isDirectAsset);
  const withoutSearchSurfaces = sorted.filter(
    (candidate) =>
      candidate.metadata.searchSurface !== true && !isSearchSurfaceUrl(candidate.sourceUrl)
  );

  const passesScoreGate = (candidate: MediaBeastCandidate) =>
    candidate.metadata.directImage === true
      ? candidate.score >= Math.min(minScore, 14)
      : candidate.score >= minScore;

  let filtered =
    withDirectImages.length >= 8
      ? withDirectImages
      : withDirectImages.length >= 3
        ? withDirectImages
        : withoutSearchSurfaces.length >= 3
          ? withoutSearchSurfaces
          : sorted;

  if (minScore > 0) {
    const scoreFiltered = filtered.filter(passesScoreGate);
    const minimumAcceptable = Math.min(8, Math.max(3, withDirectImages.length));
    if (scoreFiltered.length >= minimumAcceptable) {
      filtered = scoreFiltered;
    }
  }

  const targetPool = Math.min(16, Math.max(8, withDirectImages.length || 8));
  const minimumKeep = Math.min(targetPool, Math.max(8, withDirectImages.length));
  if (withDirectImages.length >= 8) {
    filtered = withDirectImages.filter(passesScoreGate).slice(0, 12);
  } else if (filtered.length < minimumKeep) {
    filtered = [
      ...withDirectImages.filter(passesScoreGate),
      ...sorted
        .filter(
          (candidate) =>
            candidate.metadata.searchSurface !== true && !isDirectAsset(candidate)
        )
        .filter(passesScoreGate)
    ]
      .slice(0, minimumKeep);
  }
  if (filtered.length === 0) {
    filtered = sorted.slice(0, Math.min(8, minimumKeep));
  }

  const dropped = enriched.length - filtered.length;
  const searchSurfaces = enriched.filter((c) => c.metadata.searchSurface === true).length;
  const substantive = enriched.filter((c) => c.metadata.searchSurface !== true).length;

  const warnings = [
    `Enriquecimento aplicado: ${enriched.length} candidatos, ${substantive} com URL substantiva, ${searchSurfaces} superficies de busca.`,
    dropped > 0
      ? `${dropped} candidato(s) removido(s) por score abaixo de ${minScore} apos validacao leve.`
      : "Nenhum candidato removido pelo filtro de score minimo."
  ];

  if (enrichRemote && remoteTargets.length > 0) {
    warnings.push(
      `Validacao remota leve em ${remoteTargets.length} URL(s) (titulo/meta, sem download completo).`
    );
  }

  return { candidates: filtered, warnings };
}