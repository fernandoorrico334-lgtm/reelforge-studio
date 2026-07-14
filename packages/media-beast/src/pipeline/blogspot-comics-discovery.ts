import { stableCandidateId } from "../providers/provider-utils.js";
import type { MediaBeastCandidate } from "../providers/types.js";
import {
  decodeHtmlEntities,
  expandEntityTerms,
  PRIMARY_CATALOG_SOURCE_PRIORITY,
  PRIMARY_CATALOG_SOURCE_TIER,
  scoreComicsTitleRelevance,
  type PrimaryCatalogPublisher
} from "./comics-catalog-discovery-shared.js";

export const PODERMARVEL_BLOGSPOT_URL = "https://podermarvel.blogspot.com/";
export const NDRANGHETA_BLOGSPOT_URL = "https://ndrangheta-br.blogspot.com/2025/";
export const OSINVISIVEIS_BLOGSPOT_URL = "https://osinvisiveishq.blogspot.com/";

export const PODERMARVEL_DISCOVERY_SOURCE = "podermarvel_blogspot_catalog";
export const NDRANGHETA_DISCOVERY_SOURCE = "ndrangheta_blogspot_catalog";
export const OSINVISIVEIS_DISCOVERY_SOURCE = "osinvisiveis_blogspot_catalog";

const BLOGSPOT_UI_ASSET_PATTERN =
  /medifire\.gif|sidebar\.png|search\.png|likeme|soquadrinhoslogo|icon18_|favicon|logo\.png|date\.png|\/s1600\/post\.png/i;

const POST_CARD_PATTERN =
  /<meta content=['"]([^'"]+)['"] itemprop=['"]image_url['"]\/>[\s\S]*?<h3 class='post-title entry-title'[^>]*>\s*<a href=['"]([^'"]+)['"][^>]*>([\s\S]*?)<\/a>/gi;

export type BlogspotComicCard = {
  title: string;
  postUrl: string;
  imageUrl: string;
  feedUrl: string;
  publisherId: string;
  discoverySource: string;
  downloadLinks: string[];
  relevanceScore: number;
};

export type BlogspotCatalogPublisher = PrimaryCatalogPublisher & {
  discoverySource: string;
  baseUrl: string;
};

export const BLOGSPOT_CATALOG_PUBLISHERS: BlogspotCatalogPublisher[] = [
  {
    id: "podermarvel-blogspot",
    discoverySource: PODERMARVEL_DISCOVERY_SOURCE,
    label: "Poder Marvel — Blogspot",
    indexUrl: PODERMARVEL_BLOGSPOT_URL,
    baseUrl: PODERMARVEL_BLOGSPOT_URL,
    franchise: "Marvel",
    priority: PRIMARY_CATALOG_SOURCE_PRIORITY,
    heroScope: "multi_hero",
    notes:
      "Blog Marvel com capas em Supabase e downloads MediaFire por edição. Labels VENOM, HOMEM-ARANHA, WOLVERINE, ULTIMATE."
  },
  {
    id: "ndrangheta-blogspot",
    discoverySource: NDRANGHETA_DISCOVERY_SOURCE,
    label: "Ndrangheta HQs — Blogspot",
    indexUrl: NDRANGHETA_BLOGSPOT_URL,
    baseUrl: NDRANGHETA_BLOGSPOT_URL,
    franchise: "Marvel",
    priority: PRIMARY_CATALOG_SOURCE_PRIORITY,
    heroScope: "multi_hero",
    notes:
      "Arquivo amplo (euro + marvel). Feeds por ano (/2025/) e label Marvel. Downloads MediaFire CBR/CBZ."
  },
  {
    id: "osinvisiveis-blogspot",
    discoverySource: OSINVISIVEIS_DISCOVERY_SOURCE,
    label: "Os Invisíveis HQ — Blogspot",
    indexUrl: OSINVISIVEIS_BLOGSPOT_URL,
    baseUrl: OSINVISIVEIS_BLOGSPOT_URL,
    franchise: "Marvel",
    priority: PRIMARY_CATALOG_SOURCE_PRIORITY,
    heroScope: "multi_hero",
    notes:
      "Catálogo massivo por labels. Downloads MediaFire CBZ/CBR. Label Marvel Comics + busca por herói."
  }
];

const BLOGSPOT_ENTITY_LABEL_FEEDS: Record<string, Record<string, string>> = {
  "podermarvel-blogspot": {
    venom: "https://podermarvel.blogspot.com/search/label/VENOM",
    symbiote: "https://podermarvel.blogspot.com/search/label/VENOM",
    simbionte: "https://podermarvel.blogspot.com/search/label/VENOM",
    "homem-aranha": "https://podermarvel.blogspot.com/search/label/HOMEM-ARANHA",
    "spider-man": "https://podermarvel.blogspot.com/search/label/HOMEM-ARANHA",
    wolverine: "https://podermarvel.blogspot.com/search/label/WOLVERINE",
    "homem-de-ferro": "https://podermarvel.blogspot.com/search/label/HOMEM%20DE%20FERRO",
    deadpool: "https://podermarvel.blogspot.com/search/label/DEADPOOL",
    "capitao-america": "https://podermarvel.blogspot.com/search/label/CAPIT%C3%83O%20AM%C3%89RICA",
    thor: "https://podermarvel.blogspot.com/search/label/THOR",
    hulk: "https://podermarvel.blogspot.com/search/label/HULK",
    "x-men": "https://podermarvel.blogspot.com/search/label/X-MEN",
    ultimate: "https://podermarvel.blogspot.com/search/label/ULTIMATE",
    marvel: "https://podermarvel.blogspot.com/search/label/MARVEL"
  },
  "ndrangheta-blogspot": {
    marvel: "https://ndrangheta-br.blogspot.com/search/label/Marvel",
    ultimate: "https://ndrangheta-br.blogspot.com/search/label/Ultimate",
    "homem-de-ferro": "https://ndrangheta-br.blogspot.com/search/label/Homem%20de%20Ferro",
    spider: "https://ndrangheta-br.blogspot.com/search/label/Spider",
    wolverine: "https://ndrangheta-br.blogspot.com/search/label/Wolverine"
  },
  "osinvisiveis-blogspot": {
    marvel: "https://osinvisiveishq.blogspot.com/search/label/Marvel%20Comics",
    spider: "https://osinvisiveishq.blogspot.com/search/label/Spider",
    wolverine: "https://osinvisiveishq.blogspot.com/search/label/Wolverine",
    deadpool: "https://osinvisiveishq.blogspot.com/search/label/Deadpool",
    thor: "https://osinvisiveishq.blogspot.com/search/label/Thor",
    hulk: "https://osinvisiveishq.blogspot.com/search/label/Hulk"
  }
};

export function isBlogspotCatalogCandidate(
  candidate: Pick<MediaBeastCandidate, "metadata">
): boolean {
  const source = candidate.metadata.discoverySource;
  return (
    source === PODERMARVEL_DISCOVERY_SOURCE ||
    source === NDRANGHETA_DISCOVERY_SOURCE ||
    source === OSINVISIVEIS_DISCOVERY_SOURCE
  );
}

export function isUsableBlogspotCoverUrl(url: string): boolean {
  const normalized = (url ?? "").trim();
  if (!normalized || BLOGSPOT_UI_ASSET_PATTERN.test(normalized)) return false;
  if (/pinimg\.com/i.test(normalized)) return false;
  if (/supabase\.co\/storage\/v1\/object\/public\/comic-covers\//i.test(normalized)) {
    return true;
  }
  if (/postimg\.cc|i\.wp\.com\/i\.postimg/i.test(normalized)) {
    return true;
  }
  if (/blogger\.googleusercontent\.com/i.test(normalized)) {
    return /\.(jpe?g|png|webp|gif)(\?|$)/i.test(normalized) || /\/s\d+\//i.test(normalized);
  }
  return /\.(jpe?g|png|webp|gif|avif)(\?|$)/i.test(normalized);
}

function normalizeBlogspotImageUrl(url: string): string {
  return url.split("#")[0]?.split("?")[0] ?? url;
}

function extractPostDownloadLinks(postHtml: string): string[] {
  const links = new Set<string>();
  for (const match of postHtml.matchAll(/href=["'](https?:\/\/[^"']+)["']/gi)) {
    const url = match[1] ?? "";
    if (/mediafire\.com\/file\//i.test(url)) links.add(url);
    if (/workupload\.com\/(?:file|archive)\//i.test(url)) links.add(url);
    if (/\.(?:cbr|cbz|pdf)(?:\/file)?(?:\?|$)/i.test(url)) links.add(url);
  }
  return [...links];
}

function stripHtmlTags(text: string): string {
  return decodeHtmlEntities(text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

export function parseBlogspotComicCards(
  html: string,
  feedUrl: string,
  publisher: BlogspotCatalogPublisher,
  entities: string[] = []
): BlogspotComicCard[] {
  const cards: BlogspotComicCard[] = [];
  const seen = new Set<string>();

  for (const match of html.matchAll(POST_CARD_PATTERN)) {
    const imageUrl = normalizeBlogspotImageUrl(match[1] ?? "");
    const postUrl = match[2] ?? "";
    const title = stripHtmlTags(match[3] ?? "");
    if (!title || !postUrl || !isUsableBlogspotCoverUrl(imageUrl)) continue;
    if (/feliz ano novo|amantes das hqs|^\s*info\s*$/i.test(title)) continue;

    const postBlock = html.slice(Math.max(0, (match.index ?? 0) - 200), (match.index ?? 0) + 4000);
    const downloadLinks = extractPostDownloadLinks(postBlock);
    const dedupeKey = `${postUrl}:${imageUrl}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    cards.push({
      title,
      postUrl,
      imageUrl,
      feedUrl,
      publisherId: publisher.id,
      discoverySource: publisher.discoverySource,
      downloadLinks,
      relevanceScore: scoreComicsTitleRelevance(title, entities)
    });
  }

  return cards.sort((left, right) => right.relevanceScore - left.relevanceScore);
}

export function detectBlogspotOlderPageUrl(html: string): string | null {
  const href =
    html.match(/<a class='blog-pager-older-link' href='([^']+)'/i)?.[1] ??
    html.match(/<a class="blog-pager-older-link" href="([^"]+)"/i)?.[1];
  return href ? decodeHtmlEntities(href) : null;
}

export function resolveBlogspotFeedsForPublisher(
  publisher: BlogspotCatalogPublisher,
  entities: string[]
): string[] {
  const feeds = new Set<string>([publisher.baseUrl]);
  const labelFeeds = BLOGSPOT_ENTITY_LABEL_FEEDS[publisher.id] ?? {};
  const terms = expandEntityTerms(entities);

  for (const term of terms) {
    const slug = term.replace(/\s+/g, "-");
    const feed = labelFeeds[slug] ?? labelFeeds[term];
    if (feed) feeds.add(feed);
  }

  if (publisher.id === "osinvisiveis-blogspot") {
    feeds.add("https://osinvisiveishq.blogspot.com/search/label/Marvel%20Comics");
  }
  if (publisher.id === "ndrangheta-blogspot") {
    feeds.add("https://ndrangheta-br.blogspot.com/search/label/Marvel");
  }

  return [...feeds];
}

function buildBlogspotCandidate(
  card: BlogspotComicCard,
  publisher: BlogspotCatalogPublisher,
  franchise: string
): MediaBeastCandidate {
  const catalogTitle = `${card.title} — ${franchise} comic cover (${publisher.label})`;

  return {
    id: stableCandidateId("comics-archive", `${card.imageUrl}:${card.postUrl}`),
    providerId: "comics-archive",
    kind: "image",
    title: catalogTitle.slice(0, 120),
    sourceUrl: card.imageUrl,
    previewUrl: card.imageUrl,
    licenseStatus: "editorial_only",
    riskLevel: "high",
    score: Math.min(100, 90 + Math.min(card.relevanceScore, 10)),
    reasons: [
      `${publisher.discoverySource}`,
      PRIMARY_CATALOG_SOURCE_PRIORITY,
      `title_relevance:${card.relevanceScore}`,
      card.downloadLinks.length ? "has_download_links" : "cover_only"
    ],
    warnings: [
      "Blogspot catalog cover art is copyrighted — verify editorial use before render.",
      "Primary catalog source — downloads may require MediaFire; user approval needed for ingestion."
    ],
    metadata: {
      discoverySource: card.discoverySource,
      sourcePriority: PRIMARY_CATALOG_SOURCE_PRIORITY,
      sourceTier: PRIMARY_CATALOG_SOURCE_TIER,
      catalogPublisherId: publisher.id,
      catalogHeroScope: publisher.heroScope,
      blogspotPostUrl: card.postUrl,
      blogspotFeedUrl: card.feedUrl,
      blogspotDownloadLinks: card.downloadLinks.slice(0, 8).join("|"),
      franchise,
      query: `${card.title} ${franchise} comic cover`,
      directImage: true,
      searchSurface: false,
      catalogPriority: true,
      catalogRelevanceScore: card.relevanceScore,
      catalogPostTitle: card.title,
      comicsVisualLanguage: `${franchise} comic cover hq quadrinhos blogspot scan`
    }
  };
}

async function fetchBlogspotHtml(
  url: string,
  fetchFn: typeof fetch,
  timeoutMs = 20_000
): Promise<string | null> {
  try {
    const response = await fetchFn(url, {
      headers: {
        "user-agent": "ReelForgeStudio/1.0 (+https://reelforge.studio; blogspot-comics-discovery)",
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

export async function discoverBlogspotComicsAssets(input: {
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
  publishers: BlogspotCatalogPublisher[];
  feedsScanned: number;
  pagesScanned: number;
  cardsFound: number;
  warnings: string[];
}> {
  const fetchFn = input.fetchFn ?? fetch;
  const warnings: string[] = [];
  const franchise = input.franchise ?? "Marvel";
  const maxFeeds = input.maxFeeds ?? 4;
  const maxPagesPerFeed = input.maxPagesPerFeed ?? 2;
  const maxCandidates = input.maxCandidates ?? 24;

  const publishers = input.publisherId
    ? BLOGSPOT_CATALOG_PUBLISHERS.filter((entry) => entry.id === input.publisherId)
    : BLOGSPOT_CATALOG_PUBLISHERS;

  const allCards: BlogspotComicCard[] = [];
  let feedsScanned = 0;
  let pagesScanned = 0;

  for (const publisher of publishers) {
    const feeds = resolveBlogspotFeedsForPublisher(publisher, input.entities).slice(0, maxFeeds);

    for (const feedUrl of feeds) {
      feedsScanned += 1;
      let pageUrl: string | null = feedUrl;
      let pagesForFeed = 0;

      while (pageUrl && pagesForFeed < maxPagesPerFeed) {
        const html =
          input.feedHtmlByUrl?.[pageUrl] ?? (await fetchBlogspotHtml(pageUrl, fetchFn));
        pagesScanned += 1;
        pagesForFeed += 1;
        if (!html) {
          warnings.push(`blogspot_page_fetch_failed:${publisher.id}:${pageUrl}`);
          break;
        }

        allCards.push(...parseBlogspotComicCards(html, feedUrl, publisher, input.entities));
        pageUrl = detectBlogspotOlderPageUrl(html);
      }
    }
  }

  const candidateMap = new Map<string, MediaBeastCandidate>();
  for (const card of allCards.sort((left, right) => right.relevanceScore - left.relevanceScore)) {
    if (card.relevanceScore <= 0) continue;
    const publisher =
      BLOGSPOT_CATALOG_PUBLISHERS.find((entry) => entry.id === card.publisherId) ??
      BLOGSPOT_CATALOG_PUBLISHERS[0]!;
    const candidate = buildBlogspotCandidate(card, publisher, franchise);
    candidateMap.set(candidate.id, candidate);
    if (candidateMap.size >= maxCandidates) break;
  }

  warnings.push(
    `Blogspot catalogs [${PRIMARY_CATALOG_SOURCE_PRIORITY}]: ${feedsScanned} feeds, ${pagesScanned} páginas, ${candidateMap.size} capas de ${publishers.length} blogs.`
  );

  return {
    candidates: [...candidateMap.values()],
    publishers,
    feedsScanned,
    pagesScanned,
    cardsFound: allCards.length,
    warnings
  };
}