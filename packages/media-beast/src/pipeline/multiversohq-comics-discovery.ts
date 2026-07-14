import { stableCandidateId } from "../providers/provider-utils.js";
import type { MediaBeastCandidate } from "../providers/types.js";
import {
  decodeHtmlEntities,
  expandEntityTerms,
  isUsableCatalogCoverUrl,
  PRIMARY_CATALOG_SOURCE_PRIORITY,
  PRIMARY_CATALOG_SOURCE_TIER,
  scoreComicsTitleRelevance,
  type PrimaryCatalogPublisher
} from "./comics-catalog-discovery-shared.js";

export const MULTIVERSOHQ_MARVEL_INDEX_URL =
  "https://multiversohq.com/marvel-comics/";

export const MULTIVERSOHQ_DISCOVERY_SOURCE = "multiversohq_catalog";

export const MULTIVERSOHQ_PUBLISHER_INDEXES: PrimaryCatalogPublisher[] = [
  {
    id: "multiversohq-marvel",
    label: "Multiverso HQ — Marvel Comics",
    indexUrl: MULTIVERSOHQ_MARVEL_INDEX_URL,
    franchise: "Marvel",
    priority: PRIMARY_CATALOG_SOURCE_PRIORITY,
    heroScope: "multi_hero",
    notes:
      "Catálogo com 1000+ edições Marvel, capas diretas em wp-content/uploads. Tags por herói (Homem-Aranha, Capitão América, Deadpool, etc.)."
  }
];

const MULTIVERSOHQ_HERO_FEED_SLUGS: Record<string, string> = {
  venom: "homem-aranha",
  symbiote: "homem-aranha",
  simbionte: "homem-aranha",
  "homem-aranha": "homem-aranha",
  "spider-man": "homem-aranha",
  wolverine: "wolverine",
  "capitao-america": "capitao-america",
  "homem-de-ferro": "homem-de-ferro",
  deadpool: "deadpool",
  demolidor: "demolidor",
  daredevil: "demolidor",
  thor: "thor",
  hulk: "hulk",
  "pantera-negra": "pantera-negra",
  "quarteto-fantastico": "quarteto-fantastico",
  "x-men": "x-men"
};

const LI_BLOCK_PATTERN =
  /<li>\s*<div class="video-conteudo">([\s\S]*?)<\/div>\s*<\/li>/gi;

export type MultiversohqComicCard = {
  title: string;
  postUrl: string;
  imageUrl: string;
  feedUrl: string;
  relevanceScore: number;
};

export function isMultiversohqCatalogCandidate(
  candidate: Pick<MediaBeastCandidate, "metadata">
): boolean {
  return candidate.metadata.discoverySource === MULTIVERSOHQ_DISCOVERY_SOURCE;
}

export function parseMultiversohqComicCards(
  html: string,
  feedUrl: string,
  entities: string[] = []
): MultiversohqComicCard[] {
  const cards: MultiversohqComicCard[] = [];
  const seen = new Set<string>();

  for (const blockMatch of html.matchAll(LI_BLOCK_PATTERN)) {
    const block = blockMatch[1] ?? "";
    const postUrl =
      block.match(/<a[^>]+href=["'](https:\/\/multiversohq\.com\/[^"']+)["']/i)?.[1] ??
      "";
    const title = decodeHtmlEntities(
      block.match(/alt=["']([^"']+)["']/i)?.[1] ??
        block.match(/<h2[^>]*>([^<]+)<\/h2>/i)?.[1] ??
        block.match(/title=["']([^"']+)["']/i)?.[1] ??
        ""
    );
    const imageUrl =
      block.match(/data-lazy-src=["'](https:\/\/multiversohq\.com\/wp-content\/uploads\/[^"']+)["']/i)?.[1] ??
      block.match(
        /<noscript>[\s\S]*?src=["'](https:\/\/multiversohq\.com\/wp-content\/uploads\/[^"']+)["']/i
      )?.[1] ??
      "";

    if (!title || !imageUrl || !isUsableCatalogCoverUrl(imageUrl)) continue;
    const dedupeKey = `${imageUrl}:${title}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    cards.push({
      title,
      postUrl: postUrl || feedUrl,
      imageUrl: imageUrl.split("?")[0] ?? imageUrl,
      feedUrl,
      relevanceScore: scoreComicsTitleRelevance(title, entities)
    });
  }

  return cards.sort((left, right) => right.relevanceScore - left.relevanceScore);
}

export function detectMultiversohqMaxPage(html: string): number {
  const pages = [...html.matchAll(/\/page\/(\d+)\//gi)].map((match) => Number(match[1]));
  return pages.length ? Math.max(...pages) : 1;
}

export function resolveMultiversohqFeedsForEntities(entities: string[]): string[] {
  const feeds = new Set<string>([MULTIVERSOHQ_MARVEL_INDEX_URL]);
  const terms = expandEntityTerms(entities);

  for (const term of terms) {
    const slug = term.replace(/\s+/g, "-");
    const feedSlug = MULTIVERSOHQ_HERO_FEED_SLUGS[slug];
    if (feedSlug) {
      feeds.add(`https://multiversohq.com/${feedSlug}/`);
    }
  }

  return [...feeds];
}

function buildMultiversohqCandidate(
  card: MultiversohqComicCard,
  publisher: PrimaryCatalogPublisher,
  franchise: string
): MediaBeastCandidate {
  const catalogTitle = `${card.title} — ${franchise} comic cover (Multiverso HQ)`;

  return {
    id: stableCandidateId("comics-archive", `${card.imageUrl}:${card.postUrl}`),
    providerId: "comics-archive",
    kind: "image",
    title: catalogTitle.slice(0, 120),
    sourceUrl: card.imageUrl,
    previewUrl: card.imageUrl,
    licenseStatus: "editorial_only",
    riskLevel: "high",
    score: Math.min(100, 91 + Math.min(card.relevanceScore, 9)),
    reasons: [
      "multiversohq_primary_marvel_catalog",
      PRIMARY_CATALOG_SOURCE_PRIORITY,
      `title_relevance:${card.relevanceScore}`
    ],
    warnings: [
      "Multiverso HQ cover art is copyrighted — verify editorial use before render.",
      "Primary catalog source — reusable across Marvel heroes; manual license review still required."
    ],
    metadata: {
      discoverySource: MULTIVERSOHQ_DISCOVERY_SOURCE,
      sourcePriority: PRIMARY_CATALOG_SOURCE_PRIORITY,
      sourceTier: PRIMARY_CATALOG_SOURCE_TIER,
      catalogPublisherId: publisher.id,
      catalogHeroScope: publisher.heroScope,
      multiversohqPostUrl: card.postUrl,
      multiversohqFeedUrl: card.feedUrl,
      franchise,
      query: `${card.title} ${franchise} comic cover`,
      directImage: true,
      searchSurface: false,
      catalogPriority: true,
      catalogRelevanceScore: card.relevanceScore,
      catalogPostTitle: card.title,
      comicsVisualLanguage: `${franchise} comic cover hq quadrinhos marvel issue cover`
    }
  };
}

async function fetchMultiversohqHtml(
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

function buildFeedPageUrls(feedUrl: string, maxPages: number): string[] {
  const normalized = feedUrl.endsWith("/") ? feedUrl : `${feedUrl}/`;
  const urls = [normalized];
  for (let page = 2; page <= maxPages; page += 1) {
    urls.push(`${normalized}page/${page}/`);
  }
  return urls;
}

export async function discoverMultiversohqComicsAssets(input: {
  entities: string[];
  franchise?: string;
  publisherId?: string;
  maxFeeds?: number;
  maxPagesPerFeed?: number;
  maxCandidates?: number;
  fetchFn?: typeof fetch;
  feedHtmlByUrl?: Record<string, string>;
}): Promise<{
  candidates: MediaBeastCandidate[];
  feedsScanned: number;
  pagesScanned: number;
  cardsFound: number;
  publisher: PrimaryCatalogPublisher;
  warnings: string[];
}> {
  const fetchFn = input.fetchFn ?? fetch;
  const warnings: string[] = [];
  const publisher =
    MULTIVERSOHQ_PUBLISHER_INDEXES.find((entry) => entry.id === input.publisherId) ??
    MULTIVERSOHQ_PUBLISHER_INDEXES[0]!;
  const franchise = input.franchise ?? publisher.franchise;
  const maxFeeds = input.maxFeeds ?? 4;
  const maxPagesPerFeed = input.maxPagesPerFeed ?? 2;
  const maxCandidates = input.maxCandidates ?? 32;

  const feeds = resolveMultiversohqFeedsForEntities(input.entities).slice(0, maxFeeds);
  const allCards: MultiversohqComicCard[] = [];
  let pagesScanned = 0;

  for (const feedUrl of feeds) {
    const firstHtml =
      input.feedHtmlByUrl?.[feedUrl] ?? (await fetchMultiversohqHtml(feedUrl, fetchFn));
    if (!firstHtml) {
      warnings.push(`multiversohq_feed_fetch_failed:${feedUrl}`);
      continue;
    }

    const pageLimit = Math.min(maxPagesPerFeed, detectMultiversohqMaxPage(firstHtml));
    const pageUrls = buildFeedPageUrls(feedUrl, pageLimit);

    for (const pageUrl of pageUrls) {
      const html =
        pageUrl === feedUrl
          ? firstHtml
          : input.feedHtmlByUrl?.[pageUrl] ?? (await fetchMultiversohqHtml(pageUrl, fetchFn));
      pagesScanned += 1;
      if (!html) {
        warnings.push(`multiversohq_page_fetch_failed:${pageUrl}`);
        continue;
      }
      allCards.push(...parseMultiversohqComicCards(html, feedUrl, input.entities));
    }
  }

  const candidateMap = new Map<string, MediaBeastCandidate>();
  for (const card of allCards.sort((left, right) => right.relevanceScore - left.relevanceScore)) {
    if (card.relevanceScore <= 0) continue;
    const candidate = buildMultiversohqCandidate(card, publisher, franchise);
    candidateMap.set(candidate.id, candidate);
    if (candidateMap.size >= maxCandidates) break;
  }

  warnings.push(
    `Multiverso HQ [${PRIMARY_CATALOG_SOURCE_PRIORITY}]: ${feeds.length} feeds, ${pagesScanned} páginas, ${candidateMap.size} capas extraídas.`
  );

  return {
    candidates: [...candidateMap.values()],
    feedsScanned: feeds.length,
    pagesScanned,
    cardsFound: allCards.length,
    publisher,
    warnings
  };
}