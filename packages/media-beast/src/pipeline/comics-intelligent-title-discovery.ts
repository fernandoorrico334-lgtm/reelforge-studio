import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, extname, join, resolve } from "node:path";
import type { MediaBeastCandidate } from "../providers/types.js";
import {
  BLOGSPOT_CATALOG_PUBLISHERS,
  type BlogspotComicCard,
  discoverBlogspotComicsAssets,
  parseBlogspotComicCards,
  resolveBlogspotFeedsForPublisher
} from "./blogspot-comics-discovery.js";
import {
  scoreComicsTitleRelevance,
  SERIES_BONUS_MATCHERS
} from "./comics-catalog-discovery-shared.js";
import {
  ingestComicsCatalogPanelsFromPost,
  type ComicsCatalogDownloadIngestionResult,
  type ComicsCatalogPanelAsset
} from "./comics-catalog-download-ingestion.js";
import {
  buildNarrativeSubjectContext,
  type NarrativeSubjectContext
} from "./comics-subject-relevance-gate.js";
import {
  analyzeComicsVideoThemeFromAnalysis,
  scoreAssetForThemedSelection,
  type ComicsThemeAnalysis
} from "./comics-theme-intelligence.js";
import { validateComicsAssetForTheme } from "./comics-theme-asset-validator.js";
import { DEFAULT_USER_PROVIDED_DIR } from "./comics-user-provided-assets.js";
import {
  analyzeComicsPanelVisual,
  isHardVisualRejectReason
} from "./comics-panel-visual-analyzer.js";
import {
  classifyUserProvidedPanel,
  isLateCrossoverPanel
} from "./comics-user-provided-panel-gate.js";
import type { UserProvidedAssetManifestEntry } from "./comics-user-provided-assets.js";
import {
  discoverMultiversohqComicsAssets,
  MULTIVERSOHQ_DISCOVERY_SOURCE,
  parseMultiversohqComicCards,
  resolveMultiversohqFeedsForEntities,
  type MultiversohqComicCard
} from "./multiversohq-comics-discovery.js";
import {
  parseSoQuadrinhosMarvelIndex,
  SOQUADRINHOS_DISCOVERY_SOURCE,
  SOQUADRINHOS_MARVEL_INDEX_URL
} from "./soquadrinhos-comics-discovery.js";
import { discoverSoQuadrinhossLancamentosAssets } from "./soquadrinhoss-lancamentos-discovery.js";
import type { VideoRemixAnalysis } from "./remix-video-analyzer.js";

export const INTELLIGENT_COMICS_DISCOVERY_MODE = "intelligent_title_resolve_full_ingestion";

const TOPIC_TITLE_PATTERNS: Array<{ pattern: RegExp; signal: string; weight: number }> = [
  { pattern: /\bparceiro perfeito\b/i, signal: "parceiro_perfeito", weight: 28 },
  { pattern: /\bperfect partner\b/i, signal: "perfect_partner", weight: 26 },
  { pattern: /\bparceria\b|\bpartnership\b/i, signal: "partnership", weight: 20 },
  { pattern: /\bdupla\b|\bduo\b/i, signal: "duo", weight: 18 },
  { pattern: /\bsimbiose\b|\bsymbiosis\b/i, signal: "symbiosis", weight: 22 },
  { pattern: /\bsimbionte\b|\bsymbiote\b/i, signal: "symbiote", weight: 20 },
  { pattern: /\btraje preto\b|\bblack suit\b/i, signal: "black_suit", weight: 18 },
  { pattern: /\bvenom\b.*\b(homem[- ]?aranha|spider[- ]?man)\b/i, signal: "venom_spiderman", weight: 26 },
  { pattern: /\b(homem[- ]?aranha|spider[- ]?man)\b.*\bvenom\b/i, signal: "spiderman_venom", weight: 26 },
  { pattern: /\bespiral mortal\b|\bdeath spiral\b/i, signal: "espiral_mortal", weight: 24 },
  { pattern: /\beddie brock\b/i, signal: "eddie_brock", weight: 16 },
  { pattern: /\banti[- ]?venom\b/i, signal: "anti_venom", weight: -40 },
  { pattern: /\bmiles morales\b/i, signal: "miles_morales", weight: -50 },
  { pattern: /\bgwen stacy\b|\bspider-gwen\b/i, signal: "gwen_stacy", weight: -50 },
  { pattern: /\b2099\b/i, signal: "spider_2099", weight: -50 }
];

const TOPIC_SEARCH_FEEDS = [
  "https://podermarvel.blogspot.com/search/label/VENOM",
  "https://podermarvel.blogspot.com/search/label/HOMEM-ARANHA",
  "https://podermarvel.blogspot.com/search?q=venom+homem-aranha",
  "https://podermarvel.blogspot.com/search?q=simbionte",
  "https://podermarvel.blogspot.com/search?q=espiral+mortal",
  "https://multiversohq.com/homem-aranha/",
  "https://multiversohq.com/homem-aranha/page/2/",
  "https://multiversohq.com/homem-aranha/page/3/"
];

export type ResolvedComicTitle = {
  title: string;
  normalizedTitle: string;
  source:
    | "soquadrinhos_series"
    | "soquadrinhoss_lancamentos_post"
    | "blogspot_post"
    | "multiverso_post"
    | "topic_feed";
  sourceUrl: string;
  topicScore: number;
  matchedSignals: string[];
  postUrl: string | null;
  hasDownloadLink: boolean;
  downloadHost: string | null;
};

export type AnalyzedComicPage = {
  comicTitle: string;
  postUrl: string;
  pageIndex: number;
  pageFileName: string;
  localPath: string;
  themeScore: number;
  themeAligned: boolean;
  rejectReason: string | null;
  positiveSignals: string[];
  duoVisualScore: number;
  visualTags: string[];
};

export type IntelligentComicIngestion = {
  resolvedTitle: ResolvedComicTitle;
  ingestion: ComicsCatalogDownloadIngestionResult;
  totalPagesExtracted: number;
  pagesAnalyzed: AnalyzedComicPage[];
  onThemePages: AnalyzedComicPage[];
  candidates: MediaBeastCandidate[];
};

export type IntelligentComicsDiscoveryReport = {
  mode: typeof INTELLIGENT_COMICS_DISCOVERY_MODE;
  variation: string;
  generatedAt: string;
  narrativeSubject: NarrativeSubjectContext;
  theme: ComicsThemeAnalysis;
  topicSearchFeeds: string[];
  resolvedTitles: ResolvedComicTitle[];
  downloadableMatches: ResolvedComicTitle[];
  ingestions: IntelligentComicIngestion[];
  totalPagesExtracted: number;
  totalOnThemePages: number;
  acceptedPanelCandidates: MediaBeastCandidate[];
  warnings: string[];
  recommendation: string;
};

function normalizeComicTitle(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s/-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function scoreComicTitleForNarrativeTopic(input: {
  title: string;
  entities: string[];
  subjectContext: NarrativeSubjectContext;
}): { topicScore: number; matchedSignals: string[]; rejected: boolean; rejectReason: string | null } {
  const haystack = `${input.title} ${input.subjectContext.subjectTheme} ${input.subjectContext.videoTitle}`;
  const matchedSignals: string[] = [];
  let topicScore = scoreComicsTitleRelevance(input.title, input.entities);

  for (const entry of TOPIC_TITLE_PATTERNS) {
    if (entry.pattern.test(haystack) || entry.pattern.test(input.title)) {
      matchedSignals.push(entry.signal);
      topicScore += entry.weight;
    }
  }

  for (const matcher of SERIES_BONUS_MATCHERS) {
    if (matcher.pattern.test(input.title)) {
      matchedSignals.push(`series_bonus:${matcher.pattern.source}`);
    }
  }

  const subjectBlob = [
    input.subjectContext.subjectTheme,
    input.subjectContext.narrativeTheme,
    ...(input.subjectContext.actions ?? [])
  ]
    .join(" ")
    .toLowerCase();

  if (/\bparceiro\b|\bdupla\b|\bsimbiose\b/i.test(subjectBlob)) {
    if (/\bvenom\b/i.test(input.title) && /\b(homem[- ]?aranha|spider)\b/i.test(input.title)) {
      topicScore += 30;
      matchedSignals.push("venom_spiderman_duo_subject");
    }
    if (/\bsimbionte\b|\bsymbiote\b/i.test(input.title)) {
      topicScore += 18;
      matchedSignals.push("symbiote_subject_match");
    }
  }

  const rejected =
    matchedSignals.includes("miles_morales") ||
    matchedSignals.includes("gwen_stacy") ||
    matchedSignals.includes("spider_2099") ||
    matchedSignals.includes("anti_venom");

  return {
    topicScore,
    matchedSignals,
    rejected,
    rejectReason: rejected ? matchedSignals.find((s) => s.includes("miles") || s.includes("gwen") || s.includes("2099") || s.includes("anti")) ?? "off_theme_title" : null
  };
}

function titleOverlapScore(left: string, right: string): number {
  const a = new Set(normalizeComicTitle(left).split(" ").filter((t) => t.length > 2));
  const b = new Set(normalizeComicTitle(right).split(" ").filter((t) => t.length > 2));
  if (a.size === 0 || b.size === 0) return 0;
  let overlap = 0;
  for (const token of a) {
    if (b.has(token)) overlap += 1;
  }
  return Math.round((overlap / Math.max(a.size, b.size)) * 100);
}

async function fetchCatalogHtml(url: string, fetchFn: typeof fetch): Promise<string | null> {
  try {
    const response = await fetchFn(url, {
      headers: {
        "user-agent": "ReelForgeStudio/1.0 (+https://reelforge.studio; intelligent-comics-discovery)",
        accept: "text/html,application/xhtml+xml"
      },
      signal: AbortSignal.timeout(25_000)
    });
    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  }
}

export async function resolveComicTitlesFromSoQuadrinhosIndex(input: {
  entities: string[];
  subjectContext: NarrativeSubjectContext;
  fetchFn?: typeof fetch;
  indexHtml?: string;
  minTopicScore?: number;
  maxTitles?: number;
}): Promise<ResolvedComicTitle[]> {
  const fetchFn = input.fetchFn ?? fetch;
  const minTopicScore = input.minTopicScore ?? 35;
  const indexHtml =
    input.indexHtml ?? (await fetchCatalogHtml(SOQUADRINHOS_MARVEL_INDEX_URL, fetchFn));
  if (!indexHtml) return [];

  const series = parseSoQuadrinhosMarvelIndex(indexHtml);
  const resolved: ResolvedComicTitle[] = [];

  for (const entry of series) {
    const scored = scoreComicTitleForNarrativeTopic({
      title: entry.title,
      entities: input.entities,
      subjectContext: input.subjectContext
    });
    if (scored.rejected || scored.topicScore < minTopicScore) continue;

    resolved.push({
      title: entry.title,
      normalizedTitle: normalizeComicTitle(entry.title),
      source: "soquadrinhos_series",
      sourceUrl: entry.seriesUrl,
      topicScore: scored.topicScore,
      matchedSignals: scored.matchedSignals,
      postUrl: null,
      hasDownloadLink: false,
      downloadHost: null
    });
  }

  return resolved
    .sort((left, right) => right.topicScore - left.topicScore)
    .slice(0, input.maxTitles ?? 48);
}

export async function resolveComicTitlesFromDownloadableCatalogs(input: {
  entities: string[];
  subjectContext: NarrativeSubjectContext;
  fetchFn?: typeof fetch;
  minTopicScore?: number;
  maxTitles?: number;
}): Promise<{
  titles: ResolvedComicTitle[];
  blogspotCards: BlogspotComicCard[];
  multiversoCards: MultiversohqComicCard[];
  warnings: string[];
}> {
  const fetchFn = input.fetchFn ?? fetch;
  const minTopicScore = input.minTopicScore ?? 30;
  const warnings: string[] = [];
  const titles: ResolvedComicTitle[] = [];
  const blogspotCards: BlogspotComicCard[] = [];
  const multiversoCards: MultiversohqComicCard[] = [];

  const [blogspot, multiverso, soquadrinhossLancamentos] = await Promise.all([
    discoverBlogspotComicsAssets({
      entities: input.entities,
      maxFeeds: 10,
      maxPagesPerFeed: 6,
      maxCandidates: 96,
      fetchFn
    }),
    discoverMultiversohqComicsAssets({
      entities: input.entities,
      maxFeeds: 6,
      maxPagesPerFeed: 6,
      maxCandidates: 96,
      fetchFn
    }),
    discoverSoQuadrinhossLancamentosAssets({
      entities: input.entities,
      maxResultsPerFeed: 16,
      maxCandidates: 96,
      fetchFn
    })
  ]);
  warnings.push(
    ...blogspot.warnings,
    ...multiverso.warnings,
    ...soquadrinhossLancamentos.warnings
  );

  for (const publisher of BLOGSPOT_CATALOG_PUBLISHERS) {
    const feeds = [
      ...new Set([...resolveBlogspotFeedsForPublisher(publisher, input.entities), ...TOPIC_SEARCH_FEEDS])
    ].slice(0, 12);

    for (const feedUrl of feeds) {
      const html = await fetchCatalogHtml(feedUrl, fetchFn);
      if (!html) continue;
      blogspotCards.push(...parseBlogspotComicCards(html, feedUrl, publisher, input.entities));
    }
  }

  for (const feedUrl of [
    ...resolveMultiversohqFeedsForEntities(input.entities),
    ...TOPIC_SEARCH_FEEDS.filter((url) => url.includes("multiversohq"))
  ]) {
    const html = await fetchCatalogHtml(feedUrl, fetchFn);
    if (!html) continue;
    multiversoCards.push(...parseMultiversohqComicCards(html, feedUrl, input.entities));
  }

  const seen = new Set<string>();
  const pushTitle = (entry: ResolvedComicTitle) => {
    if (seen.has(entry.normalizedTitle)) return;
    seen.add(entry.normalizedTitle);
    titles.push(entry);
  };

  for (const card of blogspotCards) {
    const scored = scoreComicTitleForNarrativeTopic({
      title: card.title,
      entities: input.entities,
      subjectContext: input.subjectContext
    });
    if (scored.rejected || scored.topicScore < minTopicScore) continue;

    pushTitle({
      title: card.title,
      normalizedTitle: normalizeComicTitle(card.title),
      source: "blogspot_post",
      sourceUrl: card.postUrl,
      topicScore: scored.topicScore + (card.downloadLinks.length > 0 ? 25 : 0),
      matchedSignals: [
        ...scored.matchedSignals,
        ...(card.downloadLinks.length > 0 ? ["has_download_link"] : [])
      ],
      postUrl: card.postUrl,
      hasDownloadLink: card.downloadLinks.length > 0,
      downloadHost: card.downloadLinks[0]?.match(/workupload|mediafire|mega/i)?.[0] ?? null
    });
  }

  for (const card of multiversoCards) {
    const scored = scoreComicTitleForNarrativeTopic({
      title: card.title,
      entities: input.entities,
      subjectContext: input.subjectContext
    });
    if (scored.rejected || scored.topicScore < minTopicScore) continue;

    pushTitle({
      title: card.title,
      normalizedTitle: normalizeComicTitle(card.title),
      source: "multiverso_post",
      sourceUrl: card.postUrl,
      topicScore: scored.topicScore + 10,
      matchedSignals: scored.matchedSignals,
      postUrl: card.postUrl,
      hasDownloadLink: true,
      downloadHost: "multiverso_post"
    });
  }

  for (const card of soquadrinhossLancamentos.cards) {
    const scored = scoreComicTitleForNarrativeTopic({
      title: card.title,
      entities: input.entities,
      subjectContext: input.subjectContext
    });
    if (scored.rejected || scored.topicScore < minTopicScore) continue;

    pushTitle({
      title: card.title,
      normalizedTitle: normalizeComicTitle(card.title),
      source: "soquadrinhoss_lancamentos_post",
      sourceUrl: card.postUrl,
      topicScore: scored.topicScore + 12,
      matchedSignals: [
        ...scored.matchedSignals,
        `feed_tag:${card.feedTag}`,
        ...(card.status ? [`status:${card.status}`] : [])
      ],
      postUrl: card.postUrl,
      hasDownloadLink: true,
      downloadHost: "sq_apresenta_post"
    });
  }

  return {
    titles: titles.sort((left, right) => right.topicScore - left.topicScore).slice(0, input.maxTitles ?? 64),
    blogspotCards,
    multiversoCards,
    warnings
  };
}

export function matchResolvedTitlesToDownloadablePosts(input: {
  resolvedTitles: ResolvedComicTitle[];
  blogspotCards: BlogspotComicCard[];
  multiversoCards: MultiversohqComicCard[];
  entities: string[];
  subjectContext: NarrativeSubjectContext;
  minOverlapScore?: number;
}): ResolvedComicTitle[] {
  const minOverlap = input.minOverlapScore ?? 42;
  const matches: ResolvedComicTitle[] = [];
  const seenPosts = new Set<string>();

  const downloadableBlogspot = input.blogspotCards.filter((card) => card.downloadLinks.length > 0);
  const downloadableMultiverso = input.multiversoCards.filter((card) => card.postUrl.includes("multiversohq.com/"));

  for (const resolved of input.resolvedTitles) {
    if (resolved.postUrl && resolved.hasDownloadLink) {
      if (!seenPosts.has(resolved.postUrl)) {
        seenPosts.add(resolved.postUrl);
        matches.push(resolved);
      }
      continue;
    }

    let best: { postUrl: string; title: string; overlap: number; download: boolean; host: string | null } | null =
      null;

    for (const card of downloadableBlogspot) {
      const overlap = titleOverlapScore(resolved.title, card.title);
      if (overlap < minOverlap) continue;
      if (!best || overlap > best.overlap) {
        best = {
          postUrl: card.postUrl,
          title: card.title,
          overlap,
          download: true,
          host: card.downloadLinks[0]?.match(/workupload|mediafire|mega/i)?.[0] ?? "mediafire"
        };
      }
    }

    for (const card of downloadableMultiverso) {
      const overlap = titleOverlapScore(resolved.title, card.title);
      if (overlap < minOverlap) continue;
      if (!best || overlap > best.overlap) {
        best = {
          postUrl: card.postUrl,
          title: card.title,
          overlap,
          download: true,
          host: "multiverso_post"
        };
      }
    }

    if (best && !seenPosts.has(best.postUrl)) {
      seenPosts.add(best.postUrl);
      matches.push({
        ...resolved,
        title: best.title,
        normalizedTitle: normalizeComicTitle(best.title),
        postUrl: best.postUrl,
        hasDownloadLink: true,
        downloadHost: best.host,
        topicScore: resolved.topicScore + Math.round(best.overlap / 4),
        matchedSignals: [...resolved.matchedSignals, `title_overlap:${best.overlap}`]
      });
    }
  }

  for (const card of downloadableBlogspot) {
    const scored = scoreComicTitleForNarrativeTopic({
      title: card.title,
      entities: input.entities,
      subjectContext: input.subjectContext
    });
    if (scored.rejected || scored.topicScore < 40) continue;
    if (seenPosts.has(card.postUrl)) continue;
    seenPosts.add(card.postUrl);
    matches.push({
      title: card.title,
      normalizedTitle: normalizeComicTitle(card.title),
      source: "blogspot_post",
      sourceUrl: card.postUrl,
      topicScore: scored.topicScore + 25,
      matchedSignals: [...scored.matchedSignals, "direct_downloadable_post"],
      postUrl: card.postUrl,
      hasDownloadLink: true,
      downloadHost: card.downloadLinks[0]?.match(/workupload|mediafire|mega/i)?.[0] ?? null
    });
  }

  return matches.sort((left, right) => {
    const hostBoost = (entry: ResolvedComicTitle) => {
      if (entry.downloadHost === "workupload") return 20;
      if (entry.downloadHost === "mediafire") return 10;
      return 0;
    };
    return right.topicScore + hostBoost(right) - (left.topicScore + hostBoost(left));
  });
}

export async function analyzeComicPagesForTheme(input: {
  postTitle: string;
  postUrl: string;
  panels: ComicsCatalogPanelAsset[];
  themeAnalysis: ComicsThemeAnalysis;
  narrationText: string;
  videoTitle: string;
  projectRoot?: string;
  ffmpegCommand?: string;
  enableVisualAnalysis?: boolean;
}): Promise<AnalyzedComicPage[]> {
  const results: AnalyzedComicPage[] = [];
  const projectRoot = resolve(input.projectRoot ?? process.cwd());
  const enableVisualAnalysis = input.enableVisualAnalysis !== false;

  for (const panel of input.panels) {
    const pageTitle = `${input.postTitle} — página ${panel.pageIndex}`;
    let visualAnalysis = null as Awaited<ReturnType<typeof analyzeComicsPanelVisual>> | null;
    if (enableVisualAnalysis) {
      const panelPath = resolve(projectRoot, panel.localPath);
      visualAnalysis = await analyzeComicsPanelVisual({
        assetPath: panelPath,
        ...(input.ffmpegCommand ? { ffmpegCommand: input.ffmpegCommand } : {})
      });
    }

    const panelGate = classifyUserProvidedPanel({
      title: pageTitle,
      description: input.postTitle,
      width: panel.width ?? 2000,
      height: panel.height ?? 3000,
      bytes: panel.fileSizeBytes,
      selectionSignals: [],
      visualRejectReason: visualAnalysis?.rejectReason ?? null,
      ...(visualAnalysis?.duoVisualScore !== undefined
        ? { duoVisualScore: visualAnalysis.duoVisualScore }
        : {}),
      ...(visualAnalysis?.visualTags ? { visualTags: visualAnalysis.visualTags } : {})
    });
    const verdict = validateComicsAssetForTheme({
      assetTitle: pageTitle,
      assetDescription: input.postTitle,
      sourceType: "catalog_download",
      themeAnalysis: input.themeAnalysis,
      narrationText: input.narrationText,
      videoTitle: input.videoTitle
    });

    const themed = scoreAssetForThemedSelection({
      id: `${input.postUrl}:${panel.pageIndex}`,
      title: pageTitle,
      description: input.postTitle,
      category: "comic_panel",
      assetQualityScore: Math.min(100, Math.round(panel.fileSizeBytes / 20_000)),
      themeAnalysis: input.themeAnalysis
    });

    const lateCrossoverPanel = isLateCrossoverPanel({ title: pageTitle });
    const visualRejected =
      visualAnalysis?.rejectReason &&
      (isHardVisualRejectReason(visualAnalysis.rejectReason) ||
        visualAnalysis.rejectReason === "crowd_crossover_without_duo");
    const themeAligned =
      panelGate.eligible &&
      panelGate.panelKind === "story_panel" &&
      verdict.severity !== "reject" &&
      themed.relevance !== "reject" &&
      themed.themeMatchScore >= 28 &&
      !lateCrossoverPanel &&
      !visualRejected;

    results.push({
      comicTitle: input.postTitle,
      postUrl: input.postUrl,
      pageIndex: panel.pageIndex,
      pageFileName: panel.pageFileName,
      localPath: panel.localPath,
      themeScore: themed.themedFinalScore + (visualAnalysis?.duoVisualScore ?? 0) * 0.15,
      themeAligned,
      rejectReason: themeAligned
        ? null
        : visualAnalysis?.rejectReason ??
          panelGate.rejectReason ??
          verdict.reason ??
          themed.reason,
      positiveSignals: [
        ...themed.positiveSignals,
        ...(visualAnalysis?.visualTags ?? []),
        ...(visualAnalysis?.duoVisualScore
          ? [`duo_visual_score:${visualAnalysis.duoVisualScore}`]
          : [])
      ],
      duoVisualScore: visualAnalysis?.duoVisualScore ?? 0,
      visualTags: visualAnalysis?.visualTags ?? []
    });
  }

  return results;
}

export async function ingestFullComicAndAnalyze(input: {
  resolvedTitle: ResolvedComicTitle;
  entities: string[];
  themeAnalysis: ComicsThemeAnalysis;
  narrationText: string;
  videoTitle: string;
  projectRoot?: string;
  fetchFn?: typeof fetch;
  ffmpegCommand?: string;
  userApprovedDownload: boolean;
}): Promise<IntelligentComicIngestion | null> {
  if (!input.resolvedTitle.postUrl || !input.resolvedTitle.hasDownloadLink) return null;

  const ingestion = await ingestComicsCatalogPanelsFromPost({
    postUrl: input.resolvedTitle.postUrl,
    postTitle: input.resolvedTitle.title,
    entities: input.entities,
    franchise: "Marvel",
    catalogSource:
      input.resolvedTitle.source === "multiverso_post"
        ? MULTIVERSOHQ_DISCOVERY_SOURCE
        : SOQUADRINHOS_DISCOVERY_SOURCE,
    extractAllPages: true,
    userApprovedDownload: input.userApprovedDownload,
    ...(input.fetchFn ? { fetchFn: input.fetchFn } : {}),
    ...(input.projectRoot ? { projectRoot: input.projectRoot } : {})
  });

  if (ingestion.skippedReason || ingestion.panelAssets.length === 0) {
    return {
      resolvedTitle: input.resolvedTitle,
      ingestion,
      totalPagesExtracted: 0,
      pagesAnalyzed: [],
      onThemePages: [],
      candidates: []
    };
  }

  const pagesAnalyzed = await analyzeComicPagesForTheme({
    postTitle: ingestion.postTitle,
    postUrl: ingestion.postUrl,
    panels: ingestion.panelAssets,
    themeAnalysis: input.themeAnalysis,
    narrationText: input.narrationText,
    videoTitle: input.videoTitle,
    ...(input.projectRoot ? { projectRoot: input.projectRoot } : {}),
    ...(input.ffmpegCommand ? { ffmpegCommand: input.ffmpegCommand } : {})
  });

  const onThemePages = pagesAnalyzed.filter((page) => page.themeAligned);
  const onThemePageIndexes = new Set(onThemePages.map((page) => page.pageIndex));
  const candidates = ingestion.candidates.filter((candidate) => {
    const pageIndex = candidate.metadata.comicsPanelPage;
    return typeof pageIndex === "number" && onThemePageIndexes.has(pageIndex);
  });

  return {
    resolvedTitle: input.resolvedTitle,
    ingestion,
    totalPagesExtracted: ingestion.panelAssets.length,
    pagesAnalyzed,
    onThemePages,
    candidates
  };
}

export async function runIntelligentComicsDiscovery(input: {
  analysis: VideoRemixAnalysis;
  variation?: string;
  projectRoot?: string;
  fetchFn?: typeof fetch;
  userApprovedDownload?: boolean;
  minTopicScore?: number;
  maxComicsToDownload?: number;
  maxResolvedTitles?: number;
}): Promise<IntelligentComicsDiscoveryReport> {
  const projectRoot = resolve(input.projectRoot ?? process.cwd());
  const fetchFn = input.fetchFn ?? fetch;
  const userApprovedDownload = input.userApprovedDownload !== false;
  const maxComicsToDownload = input.maxComicsToDownload ?? 5;
  const warnings: string[] = [];

  const videoTitle = input.analysis.title ?? input.analysis.contentIntelligence.headline;
  const themeAnalysis = analyzeComicsVideoThemeFromAnalysis(input.analysis, videoTitle);
  const subjectContext = buildNarrativeSubjectContext(input.analysis);
  const narrationText = [
    input.analysis.contentIntelligence.narrativeHook,
    input.analysis.contentIntelligence.narrativeBrief,
    input.analysis.contentIntelligence.summary
  ]
    .filter(Boolean)
    .join(" ");
  const entities = themeAnalysis.entities.length > 0 ? themeAnalysis.entities : ["Venom", "Homem-Aranha"];

  const [soquadrinhosTitles, catalogTitles] = await Promise.all([
    resolveComicTitlesFromSoQuadrinhosIndex({
      entities,
      subjectContext,
      fetchFn,
      minTopicScore: input.minTopicScore ?? 35,
      maxTitles: input.maxResolvedTitles ?? 48
    }),
    resolveComicTitlesFromDownloadableCatalogs({
      entities,
      subjectContext,
      fetchFn,
      minTopicScore: input.minTopicScore ?? 28,
      maxTitles: input.maxResolvedTitles ?? 64
    })
  ]);

  warnings.push(...catalogTitles.warnings);

  const titleMap = new Map<string, ResolvedComicTitle>();
  for (const title of [...soquadrinhosTitles, ...catalogTitles.titles]) {
    const key = title.normalizedTitle;
    const existing = titleMap.get(key);
    if (!existing || title.topicScore > existing.topicScore) {
      titleMap.set(key, title);
    }
  }
  const resolvedTitles = [...titleMap.values()].sort(
    (left, right) => right.topicScore - left.topicScore
  );

  const downloadableMatches = matchResolvedTitlesToDownloadablePosts({
    resolvedTitles,
    blogspotCards: catalogTitles.blogspotCards,
    multiversoCards: catalogTitles.multiversoCards,
    entities,
    subjectContext
  }).slice(0, maxComicsToDownload * 3);

  warnings.push(
    `resolved_titles:${resolvedTitles.length}`,
    `downloadable_matches:${downloadableMatches.length}`,
    `soquadrinhos_series:${soquadrinhosTitles.length}`,
    `catalog_posts:${catalogTitles.titles.length}`
  );

  const ingestions: IntelligentComicIngestion[] = [];
  if (!userApprovedDownload) {
    warnings.push("full_ingestion_skipped:user_approval_required");
  } else {
    for (const match of downloadableMatches.slice(0, maxComicsToDownload)) {
      try {
        const result = await ingestFullComicAndAnalyze({
          resolvedTitle: match,
          entities,
          themeAnalysis,
          narrationText,
          videoTitle,
          projectRoot,
          fetchFn,
          userApprovedDownload: true
        });
        if (result) {
          ingestions.push(result);
          warnings.push(
            `${match.postUrl}:pages=${result.totalPagesExtracted}:on_theme=${result.onThemePages.length}`
          );
        }
      } catch (error) {
        warnings.push(
          `ingestion_failed:${match.postUrl}:${error instanceof Error ? error.message : "unknown"}`
        );
      }
    }
  }

  const acceptedPanelCandidates = ingestions.flatMap((entry) => entry.candidates);
  const totalPagesExtracted = ingestions.reduce((sum, entry) => sum + entry.totalPagesExtracted, 0);
  const totalOnThemePages = ingestions.reduce((sum, entry) => sum + entry.onThemePages.length, 0);

  let recommendation = "insufficient_on_theme_pages";
  if (totalOnThemePages >= 6) {
    recommendation = "ready_for_user_provided_import";
  } else if (downloadableMatches.length > 0 && totalPagesExtracted === 0) {
    recommendation = "downloadable_titles_found_ingestion_failed";
  } else if (resolvedTitles.length > 0 && downloadableMatches.length === 0) {
    recommendation = "titles_found_no_downloadable_posts";
  } else if (resolvedTitles.length === 0) {
    recommendation = "no_topic_aligned_titles_found";
  }

  return {
    mode: INTELLIGENT_COMICS_DISCOVERY_MODE,
    variation: input.variation ?? "B — Comics",
    generatedAt: new Date().toISOString(),
    narrativeSubject: subjectContext,
    theme: themeAnalysis,
    topicSearchFeeds: TOPIC_SEARCH_FEEDS,
    resolvedTitles: resolvedTitles.slice(0, 32),
    downloadableMatches,
    ingestions,
    totalPagesExtracted,
    totalOnThemePages,
    acceptedPanelCandidates,
    warnings,
    recommendation
  };
}

export async function saveIntelligentComicsDiscoveryReport(
  report: IntelligentComicsDiscoveryReport,
  projectRoot?: string
): Promise<string> {
  const root = resolve(projectRoot ?? process.cwd());
  const reportPath = join(root, "tmp", "variation-b-intelligent-comics-discovery-report.json");
  await writeFile(reportPath, JSON.stringify(report, null, 2), "utf8");
  return reportPath;
}

const BEAT_IMPORT_ORDER = [
  "development_b",
  "development_a",
  "climax",
  "curiosity_b",
  "curiosity_a",
  "closing",
  "context",
  "hook"
];

export type IntelligentDiscoveryImportResult = {
  importedCount: number;
  skippedCount: number;
  targetDir: string;
  manifestPath: string;
  importedFiles: string[];
  warnings: string[];
};

export async function importAcceptedPanelsToUserProvided(input: {
  report: IntelligentComicsDiscoveryReport;
  projectRoot?: string;
  targetDir?: string;
  maxPanels?: number;
  minThemeScore?: number;
}): Promise<IntelligentDiscoveryImportResult> {
  const projectRoot = resolve(input.projectRoot ?? process.cwd());
  const targetDir = resolve(projectRoot, input.targetDir ?? DEFAULT_USER_PROVIDED_DIR);
  const maxPanels = input.maxPanels ?? 8;
  const minThemeScore = input.minThemeScore ?? 28;
  const warnings: string[] = [];
  const importedFiles: string[] = [];

  const pagesByComic = new Map<string, typeof input.report.ingestions[0]["onThemePages"]>();
  for (const ingestion of input.report.ingestions) {
    const comicKey = ingestion.resolvedTitle.normalizedTitle;
    const pages = ingestion.onThemePages
      .filter((page) => page.themeScore >= minThemeScore)
      .sort((left, right) => right.themeScore - left.themeScore);
    if (pages.length > 0) pagesByComic.set(comicKey, pages);
  }

  const rankedPages: typeof input.report.ingestions[0]["onThemePages"] = [];
  const comicQueues = [...pagesByComic.entries()].map(([comic, pages]) => ({
    comic,
    pages: [...pages],
    cursor: 0
  }));
  comicQueues.sort(
    (left, right) => (right.pages[0]?.themeScore ?? 0) - (left.pages[0]?.themeScore ?? 0)
  );

  while (rankedPages.length < maxPanels) {
    let picked = false;
    for (const queue of comicQueues) {
      const page = queue.pages[queue.cursor];
      queue.cursor += 1;
      if (!page) continue;
      const pageTitle = `${page.comicTitle} — página ${page.pageIndex}`;
      const panelGate = classifyUserProvidedPanel({
        title: pageTitle,
        description: page.comicTitle,
        width: 2000,
        height: 3000,
        bytes: 400_000,
        selectionSignals: page.positiveSignals
      });
      if (!panelGate.eligible || panelGate.panelKind !== "story_panel") continue;
      rankedPages.push(page);
      picked = true;
      if (rankedPages.length >= maxPanels) break;
    }
    if (!picked) break;
  }

  const manifestPath = join(targetDir, "manifest.json");
  let manifest: {
    publishAssetPolicy: string;
    variation: string;
    subject: string;
    rightsConfirmedByUser: boolean;
    assets: UserProvidedAssetManifestEntry[];
  };

  try {
    manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  } catch {
    manifest = {
      publishAssetPolicy: "user_provided_real_assets_only",
      variation: input.report.variation,
      subject: "venom-partner",
      rightsConfirmedByUser: true,
      assets: []
    };
  }

  const existingFilenames = new Set(
    manifest.assets.map((entry) => entry.filename?.toLowerCase()).filter(Boolean)
  );
  const panelsToImport = rankedPages.slice(0, maxPanels);

  await mkdir(targetDir, { recursive: true });

  for (let index = 0; index < panelsToImport.length; index += 1) {
    const page = panelsToImport[index]!;
    const sourcePath = resolve(projectRoot, page.localPath);
    const sourceExt = extname(page.pageFileName) || extname(sourcePath) || ".jpg";
    const contentHash = createHash("sha1")
      .update(`${page.postUrl}:${page.pageIndex}:${page.comicTitle}`)
      .digest("hex")
      .slice(0, 12);
    const filename = `remix-asset-${contentHash}${sourceExt}`;
    if (existingFilenames.has(filename.toLowerCase())) {
      warnings.push(`skip_existing:${filename}`);
      continue;
    }

    const targetPath = join(targetDir, filename);
    try {
      await copyFile(sourcePath, targetPath);
    } catch (error) {
      warnings.push(
        `copy_failed:${filename}:${error instanceof Error ? error.message : "unknown"}`
      );
      continue;
    }

    const beat = BEAT_IMPORT_ORDER[index % BEAT_IMPORT_ORDER.length] ?? "development";
    manifest.assets.push({
      id: `user-remix-asset-${contentHash}`,
      filename,
      title: `${page.comicTitle} — página ${page.pageIndex}`,
      description: `${page.comicTitle} — painel on-theme (score ${page.themeScore})`,
      tags: ["venom", "homem-aranha", "simbionte", "intelligent-discovery", ...page.positiveSignals.slice(0, 4)],
      recommendedBeat: beat,
      sourceType: "intelligent_comics_discovery",
      approvalStatus: "approved_by_user",
      rightsStatus: "rights_confirmed_by_user"
    });
    existingFilenames.add(filename.toLowerCase());
    importedFiles.push(filename);
  }

  await writeFile(manifestPath, JSON.stringify(manifest, null, 2), "utf8");

  return {
    importedCount: importedFiles.length,
    skippedCount: panelsToImport.length - importedFiles.length,
    targetDir,
    manifestPath,
    importedFiles,
    warnings
  };
}