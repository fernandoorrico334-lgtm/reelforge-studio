import {
  extractBasicMetadataFromHtml,
  rankSourceCandidate
} from "@reelforge/research-collector";
import type {
  CreateResearchSourceInput,
  ResearchSourceType
} from "../domain/research.js";

const defaultFetchTimeoutMs = 8000;
const defaultMaxResponseBytes = 1_500_000;
const allowedTextContentTypes = [
  "text/html",
  "text/plain",
  "application/xhtml+xml"
] as const;

interface PublicResearchFetchResult {
  title: string;
  url: string;
  provider: string;
  sourceType: ResearchSourceType;
  author: string | null;
  publishedAt: string | null;
  excerpt: string | null;
  notes: string | null;
  citationText: string | null;
  rawText: string | null;
  reliabilityScore: number | null;
  errorMessage: string | null;
  status: CreateResearchSourceInput["status"];
}

interface SearchCandidateDraft {
  title: string;
  url: string | null;
  provider: string;
  sourceType: ResearchSourceType;
  author: string | null;
  publishedAt: string | null;
  excerpt: string | null;
  notes: string | null;
  citationText: string | null;
  reliabilityScore: number | null;
}

function inferProviderFromUrl(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "web";
  }
}

function stripHtmlSnippet(html: string) {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchTextResponse(
  url: string,
  timeoutMs = defaultFetchTimeoutMs,
  maxResponseBytes = defaultMaxResponseBytes
) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      headers: {
        "User-Agent": "ReelForge-Studio-ResearchCollector/1.0"
      },
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}.`);
    }

    const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";

    if (!allowedTextContentTypes.some((entry) => contentType.includes(entry))) {
      throw new Error(
        "Only public text or HTML responses are supported in this connector."
      );
    }

    const contentLength = Number(response.headers.get("content-length") ?? 0);

    if (Number.isFinite(contentLength) && contentLength > maxResponseBytes) {
      throw new Error(
        `Response exceeds the ${maxResponseBytes} byte safety limit.`
      );
    }

    const text = await response.text();
    const clippedText = text.length > maxResponseBytes ? text.slice(0, maxResponseBytes) : text;

    return {
      response,
      text: clippedText
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function fetchPublicResearchUrl(
  url: string,
  notes: string | null
): Promise<PublicResearchFetchResult> {
  try {
    const { response, text } = await fetchTextResponse(url);
    const metadata = extractBasicMetadataFromHtml(text, response.url);
    const loweredText = text.toLowerCase();

    if (
      loweredText.includes("paywall") ||
      loweredText.includes("subscribe to continue") ||
      loweredText.includes("sign in to continue")
    ) {
      throw new Error(
        "The page appears to require login, subscription or a paywall."
      );
    }

    const ranking = rankSourceCandidate({
      title: metadata.title ?? response.url,
      provider: inferProviderFromUrl(response.url),
      sourceType: "web_page",
      url: response.url,
      author: metadata.author,
      publishedAt: metadata.publishedAt,
      excerpt: metadata.excerpt,
      notes
    });

    return {
      title: metadata.title ?? response.url,
      url: response.url,
      provider: inferProviderFromUrl(response.url),
      sourceType: "web_page",
      author: metadata.author,
      publishedAt: metadata.publishedAt,
      excerpt: metadata.excerpt,
      notes,
      citationText: metadata.title
        ? `${metadata.title} (${response.url})`
        : response.url,
      rawText: metadata.text,
      reliabilityScore: ranking.score,
      errorMessage: null,
      status: "imported"
    };
  } catch (error) {
    const message =
      error instanceof Error && error.message.trim()
        ? error.message.trim()
        : "Public URL fetch failed.";

    return {
      title: url,
      url,
      provider: inferProviderFromUrl(url),
      sourceType: "web_page",
      author: null,
      publishedAt: null,
      excerpt: null,
      notes,
      citationText: null,
      rawText: null,
      reliabilityScore: null,
      errorMessage: message,
      status: "failed"
    };
  }
}

export async function searchWikipediaCandidates(
  topic: string,
  limit: number
): Promise<SearchCandidateDraft[]> {
  const apiUrl = new URL("https://pt.wikipedia.org/w/api.php");
  apiUrl.searchParams.set("action", "query");
  apiUrl.searchParams.set("list", "search");
  apiUrl.searchParams.set("format", "json");
  apiUrl.searchParams.set("utf8", "1");
  apiUrl.searchParams.set("srlimit", String(limit));
  apiUrl.searchParams.set("srsearch", topic);

  const { text } = await fetchTextResponse(apiUrl.toString(), 8000, 450_000);
  const payload = JSON.parse(text) as {
    query?: {
      search?: Array<{
        title: string;
        snippet: string;
        timestamp?: string;
      }>;
    };
  };

  return (payload.query?.search ?? []).map((entry) => {
    const url = `https://pt.wikipedia.org/wiki/${encodeURIComponent(entry.title.replaceAll(" ", "_"))}`;
    const ranking = rankSourceCandidate({
      title: entry.title,
      provider: "wikipedia",
      sourceType: "wikipedia",
      url,
      author: null,
      publishedAt: entry.timestamp ?? null,
      excerpt: stripHtmlSnippet(entry.snippet),
      notes: null
    });

    return {
      title: entry.title,
      url,
      provider: "wikipedia",
      sourceType: "wikipedia" as const,
      author: null,
      publishedAt: entry.timestamp ?? null,
      excerpt: stripHtmlSnippet(entry.snippet),
      notes: "Candidato importado via busca aberta da Wikipedia.",
      citationText: entry.title,
      reliabilityScore: ranking.score
    };
  });
}

export async function searchWikidataCandidates(
  topic: string,
  limit: number
): Promise<SearchCandidateDraft[]> {
  const apiUrl = new URL("https://www.wikidata.org/w/api.php");
  apiUrl.searchParams.set("action", "wbsearchentities");
  apiUrl.searchParams.set("search", topic);
  apiUrl.searchParams.set("language", "pt");
  apiUrl.searchParams.set("limit", String(limit));
  apiUrl.searchParams.set("format", "json");

  const { text } = await fetchTextResponse(apiUrl.toString(), 8000, 300_000);
  const payload = JSON.parse(text) as {
    search?: Array<{
      id: string;
      label: string;
      description?: string;
    }>;
  };

  return (payload.search ?? []).map((entry) => {
    const url = `https://www.wikidata.org/wiki/${encodeURIComponent(entry.id)}`;
    const excerpt = [entry.label, entry.description].filter(Boolean).join(" - ");
    const ranking = rankSourceCandidate({
      title: entry.label,
      provider: "wikidata",
      sourceType: "wikidata",
      url,
      author: null,
      publishedAt: null,
      excerpt,
      notes: null
    });

    return {
      title: entry.label,
      url,
      provider: "wikidata",
      sourceType: "wikidata" as const,
      author: null,
      publishedAt: null,
      excerpt,
      notes: `Entidade estruturada ${entry.id} vinda do Wikidata.`,
      citationText: `${entry.label} (${entry.id})`,
      reliabilityScore: ranking.score
    };
  });
}

