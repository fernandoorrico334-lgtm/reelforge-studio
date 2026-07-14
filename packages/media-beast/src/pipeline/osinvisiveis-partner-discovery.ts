import { stableCandidateId } from "../providers/provider-utils.js";
import type { MediaBeastCandidate } from "../providers/types.js";
import {
  decodeHtmlEntities,
  PRIMARY_CATALOG_SOURCE_PRIORITY,
  PRIMARY_CATALOG_SOURCE_TIER
} from "./comics-catalog-discovery-shared.js";
import {
  OSINVISIVEIS_BLOGSPOT_URL,
  OSINVISIVEIS_DISCOVERY_SOURCE,
  type BlogspotCatalogPublisher,
  type BlogspotComicCard,
  isUsableBlogspotCoverUrl,
  parseBlogspotComicCards
} from "./blogspot-comics-discovery.js";

export const OSINVISIVEIS_PARTNER_DISCOVERY_SOURCE = "osinvisiveis_partner_catalog";

export type OsinvisiveisPartnerSiteKind =
  | "blogspot"
  | "wordpress"
  | "telegram"
  | "facebook"
  | "comics_site"
  | "other";

export type OsinvisiveisPartnerLink = {
  url: string;
  normalizedUrl: string;
  host: string;
  label: string | null;
  category: string;
  siteKind: OsinvisiveisPartnerSiteKind;
  crawlable: boolean;
  alreadyIntegrated: boolean;
};

const PARTNER_PUBLISHER_ID = "osinvisiveis-partner-blog";

const SKIP_HOSTS = new Set([
  "osinvisiveishq.blogspot.com",
  "www.osinvisiveishq.blogspot.com",
  "site.soquadrinhos.com",
  "multiversohq.com",
  "ndrangheta-br.blogspot.com",
  "podermarvel.blogspot.com",
  "podermarvel.blogspot.com.br",
  "www.blogger.com",
  "blogger.com",
  "facebook.com",
  "www.facebook.com",
  "t.me",
  "imgur.com",
  "i.imgur.com",
  "i.ibb.co",
  "google.com",
  "www.google.com"
]);

const WIDGET_WITH_TITLE_PATTERN =
  /<div class='widget HTML'[^>]*>[\s\S]*?<h2 class='title'>([^<]*)<\/h2>\s*<div class='widget-content'>([\s\S]*?)<\/div>\s*<div class='clear'><\/div>/gi;

const WIDGET_CONTENT_ONLY_PATTERN =
  /<div class='widget HTML'[^>]*id='HTML1'[^>]*>\s*<div class='widget-content'>([\s\S]*?)<\/div>\s*<div class='clear'><\/div>/i;

const PARTNER_ANCHOR_PATTERN =
  /<a\s+href=["']([^"']+)["'][^>]*>(?:[\s\S]*?<img[^>]*alt=["']([^"']*)["'][^>]*>)?/gi;

const PARTNER_BLOGSPOT_PUBLISHER: BlogspotCatalogPublisher = {
  id: PARTNER_PUBLISHER_ID,
  discoverySource: OSINVISIVEIS_PARTNER_DISCOVERY_SOURCE,
  label: "Os Invisíveis HQ — parceiro Blogspot",
  indexUrl: OSINVISIVEIS_BLOGSPOT_URL,
  baseUrl: OSINVISIVEIS_BLOGSPOT_URL,
  franchise: "Marvel",
  priority: PRIMARY_CATALOG_SOURCE_PRIORITY,
  heroScope: "multi_hero",
  notes: "Blog parceiro descoberto via sidebar Os Invisíveis HQ."
};

function normalizePartnerUrl(url: string): string {
  try {
    const parsed = new URL(url.trim());
    const host = parsed.hostname.replace(/^www\./i, "").toLowerCase();
    if (/blogspot\.com/i.test(host)) {
      return `https://${host}/`;
    }
    return `${parsed.protocol}//${host}${parsed.pathname}`.replace(/\/$/, "") || `${parsed.protocol}//${host}/`;
  } catch {
    return url.trim();
  }
}

function classifyPartnerSite(url: string): OsinvisiveisPartnerSiteKind {
  const lower = url.toLowerCase();
  if (/\.blogspot\.com/i.test(lower)) return "blogspot";
  if (/t\.me\//i.test(lower)) return "telegram";
  if (/facebook\.com/i.test(lower)) return "facebook";
  if (/soquadrinhos|multiversohq|ds-club|theoldshinobi/i.test(lower)) return "comics_site";
  if (/\.wordpress\.com|\/wp-content\//i.test(lower)) return "wordpress";
  return "other";
}

function isAlreadyIntegratedHost(host: string): boolean {
  const normalized = host.replace(/^www\./i, "").toLowerCase();
  if (SKIP_HOSTS.has(normalized)) return true;
  if (normalized === "ndrangheta-br.blogspot.com") return true;
  if (normalized === "podermarvel.blogspot.com" || normalized === "podermarvel.blogspot.com.br") {
    return true;
  }
  return false;
}

function isCrawlablePartner(partner: Pick<OsinvisiveisPartnerLink, "siteKind" | "alreadyIntegrated" | "host">): boolean {
  if (partner.alreadyIntegrated) return false;
  return partner.siteKind === "blogspot";
}

function extractAnchorsFromBlock(blockHtml: string, category: string): OsinvisiveisPartnerLink[] {
  const links: OsinvisiveisPartnerLink[] = [];
  const seen = new Set<string>();

  for (const match of blockHtml.matchAll(PARTNER_ANCHOR_PATTERN)) {
    const rawUrl = decodeHtmlEntities(match[1] ?? "").trim();
    if (!rawUrl || rawUrl.startsWith("#") || rawUrl.startsWith("mailto:")) continue;

    const normalizedUrl = normalizePartnerUrl(rawUrl);
    if (seen.has(normalizedUrl)) continue;
    seen.add(normalizedUrl);

    let host = "";
    try {
      host = new URL(rawUrl).hostname.replace(/^www\./i, "").toLowerCase();
    } catch {
      continue;
    }

    const siteKind = classifyPartnerSite(rawUrl);
    const label = decodeHtmlEntities(match[2] ?? "").trim() || null;
    const alreadyIntegrated = isAlreadyIntegratedHost(host);

    links.push({
      url: rawUrl,
      normalizedUrl,
      host,
      label,
      category,
      siteKind,
      crawlable: false,
      alreadyIntegrated
    });
  }

  for (const link of links) {
    link.crawlable = isCrawlablePartner(link);
  }

  return links;
}

export function parseOsinvisiveisPartnerLinks(html: string): OsinvisiveisPartnerLink[] {
  const allLinks: OsinvisiveisPartnerLink[] = [];
  const seen = new Set<string>();

  const html1 = html.match(WIDGET_CONTENT_ONLY_PATTERN)?.[1];
  if (html1) {
    for (const link of extractAnchorsFromBlock(html1, "parceiros")) {
      if (seen.has(link.normalizedUrl)) continue;
      seen.add(link.normalizedUrl);
      allLinks.push(link);
    }
  }

  for (const match of html.matchAll(WIDGET_WITH_TITLE_PATTERN)) {
    const category = decodeHtmlEntities(match[1] ?? "parceiros").trim() || "parceiros";
    const block = match[2] ?? "";
    for (const link of extractAnchorsFromBlock(block, category)) {
      if (seen.has(link.normalizedUrl)) continue;
      seen.add(link.normalizedUrl);
      allLinks.push(link);
    }
  }

  return allLinks.sort((left, right) => {
    const score = (link: OsinvisiveisPartnerLink) =>
      (link.crawlable ? 4 : 0) + (link.siteKind === "comics_site" ? 3 : 0) + (link.alreadyIntegrated ? 0 : 2);
    return score(right) - score(left);
  });
}

function buildPartnerCandidate(
  card: BlogspotComicCard,
  partner: OsinvisiveisPartnerLink,
  franchise: string
): MediaBeastCandidate {
  const catalogTitle = `${card.title} — ${franchise} comic cover (${partner.label ?? partner.host})`;

  return {
    id: stableCandidateId("comics-archive", `${card.imageUrl}:${card.postUrl}:${partner.normalizedUrl}`),
    providerId: "comics-archive",
    kind: "image",
    title: catalogTitle.slice(0, 120),
    sourceUrl: card.imageUrl,
    previewUrl: card.imageUrl,
    licenseStatus: "editorial_only",
    riskLevel: "high",
    score: Math.min(100, 88 + Math.min(card.relevanceScore, 10)),
    reasons: [
      OSINVISIVEIS_PARTNER_DISCOVERY_SOURCE,
      PRIMARY_CATALOG_SOURCE_PRIORITY,
      `partner:${partner.host}`,
      `title_relevance:${card.relevanceScore}`,
      card.downloadLinks.length ? "has_download_links" : "cover_only"
    ],
    warnings: [
      "Partner blog cover via Os Invisíveis HQ sidebar — copyrighted; editorial use only.",
      "Discovered through Os Invisíveis partner network; manual license review required."
    ],
    metadata: {
      discoverySource: OSINVISIVEIS_PARTNER_DISCOVERY_SOURCE,
      sourcePriority: PRIMARY_CATALOG_SOURCE_PRIORITY,
      sourceTier: PRIMARY_CATALOG_SOURCE_TIER,
      catalogPublisherId: PARTNER_PUBLISHER_ID,
      catalogHeroScope: "multi_hero",
      referredBy: OSINVISIVEIS_DISCOVERY_SOURCE,
      partnerSiteUrl: partner.normalizedUrl,
      partnerSiteLabel: partner.label,
      partnerCategory: partner.category,
      partnerHost: partner.host,
      blogspotPostUrl: card.postUrl,
      blogspotFeedUrl: partner.normalizedUrl,
      blogspotDownloadLinks: card.downloadLinks.slice(0, 8).join("|"),
      franchise,
      query: `${card.title} ${franchise} comic cover`,
      directImage: true,
      searchSurface: false,
      catalogPriority: true,
      comicsVisualLanguage: `${franchise} comic cover hq quadrinhos blogspot partner scan`
    }
  };
}

async function fetchPartnerHtml(url: string, fetchFn: typeof fetch): Promise<string | null> {
  try {
    const response = await fetchFn(url, {
      headers: {
        "user-agent": "ReelForgeStudio/1.0 (+https://reelforge.studio; osinvisiveis-partner-discovery)",
        accept: "text/html,application/xhtml+xml"
      },
      signal: AbortSignal.timeout(20_000)
    });
    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  }
}

export async function discoverOsinvisiveisPartnerCatalogAssets(input: {
  entities: string[];
  franchise?: string;
  pageHtml?: string;
  maxPartners?: number;
  maxCandidates?: number;
  fetchFn?: typeof fetch;
  partnerHtmlByUrl?: Record<string, string>;
}): Promise<{
  partners: OsinvisiveisPartnerLink[];
  candidates: MediaBeastCandidate[];
  partnersCrawled: number;
  warnings: string[];
}> {
  const fetchFn = input.fetchFn ?? fetch;
  const franchise = input.franchise ?? "Marvel";
  const maxPartners = input.maxPartners ?? 16;
  const maxCandidates = input.maxCandidates ?? 24;
  const warnings: string[] = [];

  const pageHtml =
    input.pageHtml ??
    input.partnerHtmlByUrl?.[OSINVISIVEIS_BLOGSPOT_URL] ??
    (await fetchPartnerHtml(OSINVISIVEIS_BLOGSPOT_URL, fetchFn));

  if (!pageHtml) {
    return {
      partners: [],
      candidates: [],
      partnersCrawled: 0,
      warnings: ["osinvisiveis_partner_page_fetch_failed"]
    };
  }

  const partners = parseOsinvisiveisPartnerLinks(pageHtml);
  const crawlable = partners.filter((partner) => partner.crawlable).slice(0, maxPartners);
  const candidateMap = new Map<string, MediaBeastCandidate>();
  let partnersCrawled = 0;

  warnings.push(
    `Os Invisíveis partners: ${partners.length} links (${partners.filter((p) => p.crawlable).length} blogs crawláveis, ${partners.filter((p) => p.alreadyIntegrated).length} já integrados).`
  );

  for (const partner of crawlable) {
    const html =
      input.partnerHtmlByUrl?.[partner.normalizedUrl] ??
      (await fetchPartnerHtml(partner.normalizedUrl, fetchFn));
    partnersCrawled += 1;
    if (!html) {
      warnings.push(`partner_fetch_failed:${partner.host}`);
      continue;
    }

    const cards = parseBlogspotComicCards(
      html,
      partner.normalizedUrl,
      PARTNER_BLOGSPOT_PUBLISHER,
      input.entities
    ).filter((card) => isUsableBlogspotCoverUrl(card.imageUrl));

    for (const card of cards) {
      if (card.relevanceScore <= 0) continue;
      const candidate = buildPartnerCandidate(
        {
          ...card,
          publisherId: PARTNER_PUBLISHER_ID,
          discoverySource: OSINVISIVEIS_PARTNER_DISCOVERY_SOURCE,
          feedUrl: partner.normalizedUrl
        },
        partner,
        franchise
      );
      candidateMap.set(candidate.id, candidate);
      if (candidateMap.size >= maxCandidates) break;
    }

    if (candidateMap.size >= maxCandidates) break;
  }

  warnings.push(
    `Os Invisíveis partner crawl: ${partnersCrawled} blogs, ${candidateMap.size} capas extraídas.`
  );

  return {
    partners,
    candidates: [...candidateMap.values()],
    partnersCrawled,
    warnings
  };
}

export function isOsinvisiveisPartnerCandidate(
  candidate: Pick<MediaBeastCandidate, "metadata">
): boolean {
  return candidate.metadata.discoverySource === OSINVISIVEIS_PARTNER_DISCOVERY_SOURCE;
}