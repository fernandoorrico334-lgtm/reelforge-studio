import { stableCandidateId } from "../providers/provider-utils.js";
import type { MediaBeastCandidate } from "../providers/types.js";
import { isUsableBlogspotCoverUrl } from "./blogspot-comics-discovery.js";
import {
  decodeHtmlEntities,
  PRIMARY_CATALOG_SOURCE_PRIORITY,
  PRIMARY_CATALOG_SOURCE_TIER,
  scoreComicsTitleRelevance,
  type PrimaryCatalogPublisher
} from "./comics-catalog-discovery-shared.js";

export const SOQUADRINHOSS_LANCAMENTOS_PAGE_URL =
  "https://soquadrinhoss.blogspot.com/p/lancamentos.html";

export const SQ_APRESENTA_BLOG_URL = "https://sq-apresenta.blogspot.com";

export const SOQUADRINHOSS_LANCAMENTOS_DISCOVERY_SOURCE = "soquadrinhoss_lancamentos_catalog";

export const SOQUADRINHOSS_LANCAMENTOS_SOURCE_PRIORITY = PRIMARY_CATALOG_SOURCE_PRIORITY;
export const SOQUADRINHOSS_LANCAMENTOS_SOURCE_TIER = PRIMARY_CATALOG_SOURCE_TIER;

export type SoQuadrinhossLancamentosPublisher = PrimaryCatalogPublisher;

export const SOQUADRINHOSS_LANCAMENTOS_PUBLISHER: SoQuadrinhossLancamentosPublisher = {
  id: "soquadrinhoss-lancamentos",
  label: "SoQuadrinhos — Lançamentos",
  indexUrl: SOQUADRINHOSS_LANCAMENTOS_PAGE_URL,
  franchise: "Marvel",
  priority: SOQUADRINHOSS_LANCAMENTOS_SOURCE_PRIORITY,
  heroScope: "multi_hero",
  notes:
    "Grade de lançamentos via sq-apresenta.blogspot.com (Lancamentos, Estreia, Última Edição). Capas postimg.cc e links para posts de download."
};

export const SOQUADRINHOSS_LANCAMENTOS_FEED_TAGS = [
  { tag: "Lancamentos", label: "Lançamentos" },
  { tag: "Estreia", label: "Estreias" },
  { tag: "Última Edição", label: "Última Edição" }
] as const;

const STATUS_TAGS = ["Em Andamento", "Última Edição", "Estreia", "Edição Única"] as const;

const PLACEHOLDER_COVER_PATTERN = /placeholder\.pics|sem%20imagem/i;

export type BloggerJsonFeedEntry = {
  title?: { $t?: string };
  content?: { $t?: string };
  summary?: { $t?: string };
  published?: { $t?: string };
  category?: Array<{ term?: string }>;
  link?: Array<{ rel?: string; href?: string }>;
  media$thumbnail?: { url?: string };
};

export type BloggerJsonFeed = {
  feed?: {
    entry?: BloggerJsonFeedEntry[];
  };
};

export type SoQuadrinhossLancamentosCard = {
  title: string;
  postUrl: string;
  imageUrl: string;
  feedUrl: string;
  feedTag: string;
  status: string;
  publishedAt: string | null;
  credits: string;
  relevanceScore: number;
};

export function isSoQuadrinhossLancamentosCandidate(
  candidate: Pick<MediaBeastCandidate, "metadata">
): boolean {
  return candidate.metadata.discoverySource === SOQUADRINHOSS_LANCAMENTOS_DISCOVERY_SOURCE;
}

export function buildSqApresentaFeedUrl(
  tag: string,
  options?: { maxResults?: number; startIndex?: number }
): string {
  const maxResults = options?.maxResults ?? 12;
  const startIndex = options?.startIndex ?? 1;
  return `${SQ_APRESENTA_BLOG_URL}/feeds/posts/default/-/${encodeURIComponent(tag)}?alt=json&max-results=${maxResults}&start-index=${startIndex}`;
}

export function normalizeSqApresentaCoverUrl(url: string): string {
  const trimmed = (url ?? "").trim();
  if (!trimmed) return trimmed;

  let normalized = trimmed.split("#")[0]?.split("?")[0] ?? trimmed;
  if (/^\/\//.test(normalized)) {
    normalized = `https:${normalized}`;
  }

  if (
    normalized.includes("blogger.googleusercontent.com") ||
    normalized.includes("bp.blogspot.com")
  ) {
    return normalized.replace(/\/s[0-9]+[^/]*\//i, "/w400-h600-c/");
  }

  if (normalized.includes("/s72-c/")) {
    return normalized.replace("/s72-c/", "/w400-h600-c/");
  }

  return normalized;
}

function stripHtmlTags(text: string): string {
  return decodeHtmlEntities(text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

function extractFirstImageUrl(html: string): string | null {
  const match = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  return match?.[1] ? normalizeSqApresentaCoverUrl(match[1]) : null;
}

function extractFirstLinkUrl(html: string): string | null {
  const match = html.match(/<a[^>]+href=["']([^"']+)["']/i);
  const href = match?.[1]?.trim();
  return href && /^https?:\/\//i.test(href) ? href : null;
}

function extractStatusFromCategories(
  categories: BloggerJsonFeedEntry["category"]
): string {
  for (const category of categories ?? []) {
    const term = category.term?.trim() ?? "";
    if ((STATUS_TAGS as readonly string[]).includes(term)) {
      return term;
    }
  }
  return "";
}

function extractCreditsFromHtml(html: string): string {
  const plain = stripHtmlTags(html);
  return plain.replace(/^equipe:\s*/i, "").trim();
}

function resolvePostUrl(entry: BloggerJsonFeedEntry, html: string): string {
  const bodyLink = extractFirstLinkUrl(html);
  if (bodyLink) return bodyLink;

  const alternate = entry.link?.find((link) => link.rel === "alternate")?.href;
  return alternate?.trim() ?? "";
}

function resolveCoverUrl(entry: BloggerJsonFeedEntry, html: string): string | null {
  const bodyImage = extractFirstImageUrl(html);
  if (bodyImage && isUsableBlogspotCoverUrl(bodyImage) && !PLACEHOLDER_COVER_PATTERN.test(bodyImage)) {
    return bodyImage;
  }

  const thumbnail = entry.media$thumbnail?.url;
  if (thumbnail) {
    const normalized = normalizeSqApresentaCoverUrl(thumbnail);
    if (isUsableBlogspotCoverUrl(normalized) && !PLACEHOLDER_COVER_PATTERN.test(normalized)) {
      return normalized;
    }
  }

  return null;
}

export function parseSoQuadrinhossLancamentosFeed(
  feed: BloggerJsonFeed,
  feedUrl: string,
  feedTag: string,
  entities: string[] = []
): SoQuadrinhossLancamentosCard[] {
  const entries = feed.feed?.entry ?? [];
  const cards: SoQuadrinhossLancamentosCard[] = [];
  const seen = new Set<string>();

  for (const entry of entries) {
    const title = decodeHtmlEntities(entry.title?.$t ?? "").trim();
    const html = entry.content?.$t ?? entry.summary?.$t ?? "";
    if (!title) continue;

    const imageUrl = resolveCoverUrl(entry, html);
    const postUrl = resolvePostUrl(entry, html);
    if (!imageUrl || !postUrl) continue;

    const dedupeKey = `${postUrl}:${imageUrl}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    cards.push({
      title,
      postUrl,
      imageUrl,
      feedUrl,
      feedTag,
      status: extractStatusFromCategories(entry.category),
      publishedAt: entry.published?.$t ?? null,
      credits: extractCreditsFromHtml(html),
      relevanceScore: scoreComicsTitleRelevance(title, entities)
    });
  }

  return cards.sort((left, right) => right.relevanceScore - left.relevanceScore);
}

function buildSoQuadrinhossLancamentosCandidate(
  card: SoQuadrinhossLancamentosCard,
  publisher: SoQuadrinhossLancamentosPublisher,
  franchise: string
): MediaBeastCandidate {
  const catalogTitle = `${card.title} — ${franchise} comic cover (SoQuadrinhos Lançamentos)`;

  return {
    id: stableCandidateId("comics-archive", `${card.imageUrl}:${card.postUrl}`),
    providerId: "comics-archive",
    kind: "image",
    title: catalogTitle.slice(0, 120),
    sourceUrl: card.imageUrl,
    previewUrl: card.imageUrl,
    licenseStatus: "editorial_only",
    riskLevel: "high",
    score: Math.min(100, 88 + Math.min(card.relevanceScore, 12)),
    reasons: [
      SOQUADRINHOSS_LANCAMENTOS_DISCOVERY_SOURCE,
      PRIMARY_CATALOG_SOURCE_PRIORITY,
      `feed_tag:${card.feedTag}`,
      card.status ? `status:${card.status}` : "status:unknown",
      `title_relevance:${card.relevanceScore}`
    ],
    warnings: [
      "SoQuadrinhos lançamentos cover art is copyrighted — verify editorial use before render.",
      "Primary catalog source — post may link to sq-apresenta download; user approval needed for ingestion."
    ],
    metadata: {
      discoverySource: SOQUADRINHOSS_LANCAMENTOS_DISCOVERY_SOURCE,
      sourcePriority: PRIMARY_CATALOG_SOURCE_PRIORITY,
      sourceTier: PRIMARY_CATALOG_SOURCE_TIER,
      catalogPublisherId: publisher.id,
      catalogHeroScope: publisher.heroScope,
      blogspotPostUrl: card.postUrl,
      soquadrinhossLancamentosFeedUrl: card.feedUrl,
      soquadrinhossLancamentosFeedTag: card.feedTag,
      soquadrinhossLancamentosStatus: card.status || null,
      soquadrinhossLancamentosCatalogPageUrl: SOQUADRINHOSS_LANCAMENTOS_PAGE_URL,
      franchise,
      query: `${card.title} ${franchise} comic cover`,
      directImage: true,
      searchSurface: false,
      catalogPriority: true,
      catalogRelevanceScore: card.relevanceScore,
      catalogPostTitle: card.title,
      comicsVisualLanguage: `${franchise} comic cover hq quadrinhos lancamentos postimg`
    }
  };
}

async function fetchSqApresentaJsonFeed(
  feedUrl: string,
  fetchFn: typeof fetch,
  timeoutMs = 20_000
): Promise<BloggerJsonFeed | null> {
  try {
    const response = await fetchFn(feedUrl, {
      headers: {
        "user-agent": "ReelForgeStudio/1.0 (+https://reelforge.studio; soquadrinhoss-lancamentos-discovery)",
        accept: "application/json,text/javascript"
      },
      signal: AbortSignal.timeout(timeoutMs)
    });
    if (!response.ok) return null;
    return (await response.json()) as BloggerJsonFeed;
  } catch {
    return null;
  }
}

export async function discoverSoQuadrinhossLancamentosAssets(input: {
  entities: string[];
  franchise?: string;
  maxResultsPerFeed?: number;
  maxFeeds?: number;
  maxCandidates?: number;
  fetchFn?: typeof fetch;
  feedJsonByUrl?: Record<string, BloggerJsonFeed>;
}): Promise<{
  candidates: MediaBeastCandidate[];
  cards: SoQuadrinhossLancamentosCard[];
  feedsScanned: number;
  entriesFound: number;
  publisher: SoQuadrinhossLancamentosPublisher;
  warnings: string[];
}> {
  const fetchFn = input.fetchFn ?? fetch;
  const warnings: string[] = [];
  const publisher = SOQUADRINHOSS_LANCAMENTOS_PUBLISHER;
  const franchise = input.franchise ?? publisher.franchise;
  const maxResultsPerFeed = input.maxResultsPerFeed ?? 12;
  const maxFeeds = input.maxFeeds ?? SOQUADRINHOSS_LANCAMENTOS_FEED_TAGS.length;
  const maxCandidates = input.maxCandidates ?? 32;

  const allCards: SoQuadrinhossLancamentosCard[] = [];
  let feedsScanned = 0;

  for (const feedTag of SOQUADRINHOSS_LANCAMENTOS_FEED_TAGS.slice(0, maxFeeds)) {
    const feedUrl = buildSqApresentaFeedUrl(feedTag.tag, { maxResults: maxResultsPerFeed });
    feedsScanned += 1;

    const feedJson =
      input.feedJsonByUrl?.[feedUrl] ?? (await fetchSqApresentaJsonFeed(feedUrl, fetchFn));
    if (!feedJson) {
      warnings.push(`soquadrinhoss_lancamentos_feed_fetch_failed:${feedTag.tag}`);
      continue;
    }

    const cards = parseSoQuadrinhossLancamentosFeed(feedJson, feedUrl, feedTag.tag, input.entities);
    if (cards.length === 0) {
      warnings.push(`soquadrinhoss_lancamentos_feed_empty:${feedTag.tag}`);
    }
    allCards.push(...cards);
  }

  const candidateMap = new Map<string, MediaBeastCandidate>();
  for (const card of allCards.sort((left, right) => right.relevanceScore - left.relevanceScore)) {
    if (input.entities.length > 0 ? card.relevanceScore <= 1 : card.relevanceScore <= 0) continue;
    const candidate = buildSoQuadrinhossLancamentosCandidate(card, publisher, franchise);
    candidateMap.set(candidate.id, candidate);
    if (candidateMap.size >= maxCandidates) break;
  }

  warnings.push(
    `SoQuadrinhos Lançamentos [${PRIMARY_CATALOG_SOURCE_PRIORITY}]: ${feedsScanned} feeds JSON, ${allCards.length} cards, ${candidateMap.size} capas relevantes.`
  );

  return {
    candidates: [...candidateMap.values()],
    cards: allCards,
    feedsScanned,
    entriesFound: allCards.length,
    publisher,
    warnings
  };
}