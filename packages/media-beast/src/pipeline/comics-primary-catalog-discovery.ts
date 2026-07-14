import type { MediaBeastCandidate } from "../providers/types.js";
import { discoverBlogspotComicsAssets } from "./blogspot-comics-discovery.js";
import {
  DEFAULT_MAX_DOWNLOAD_BYTES,
  discoverComicsCatalogPanelAssets
} from "./comics-catalog-download-ingestion.js";
import { discoverOsinvisiveisPartnerCatalogAssets } from "./osinvisiveis-partner-discovery.js";
import type { PrimaryCatalogPublisher } from "./comics-catalog-discovery-shared.js";
import {
  discoverMultiversohqComicsAssets,
  MULTIVERSOHQ_DISCOVERY_SOURCE
} from "./multiversohq-comics-discovery.js";
import { discoverSoQuadrinhosComicsAssets } from "./soquadrinhos-comics-discovery.js";
import { discoverSoQuadrinhossLancamentosAssets } from "./soquadrinhoss-lancamentos-discovery.js";

export type ComicsPrimaryCatalogDiscoveryResult = {
  candidates: MediaBeastCandidate[];
  publishers: PrimaryCatalogPublisher[];
  warnings: string[];
  stats: {
    soquadrinhosCandidates: number;
    soquadrinhossLancamentosCandidates: number;
    multiversohqCandidates: number;
    blogspotCandidates: number;
    osinvisiveisPartnerCandidates: number;
    downloadPanelCandidates: number;
    totalCandidates: number;
  };
};

export function isPrimaryCatalogCandidate(
  candidate: Pick<MediaBeastCandidate, "metadata">
): boolean {
  return candidate.metadata.catalogPriority === true;
}

export async function discoverComicsPrimaryCatalogAssets(input: {
  entities: string[];
  franchise?: string;
  maxSeries?: number;
  maxCandidatesPerSource?: number;
  multiversohqMaxFeeds?: number;
  multiversohqMaxPagesPerFeed?: number;
  enableDownloadIngestion?: boolean;
  userApprovedDownload?: boolean;
  maxDownloadPosts?: number;
  maxPanelsPerPost?: number;
  maxDownloadBytes?: number;
  projectRoot?: string;
  crawlOsinvisiveisPartners?: boolean;
  maxOsinvisiveisPartners?: number;
}): Promise<ComicsPrimaryCatalogDiscoveryResult> {
  const maxCandidatesPerSource = input.maxCandidatesPerSource ?? 32;
  const crawlPartners = input.crawlOsinvisiveisPartners !== false;
  const [soquadrinhos, soquadrinhossLancamentos, multiversohq, blogspot, osinvisiveisPartners] =
    await Promise.all([
    discoverSoQuadrinhosComicsAssets({
      entities: input.entities,
      franchise: input.franchise ?? "Marvel",
      maxSeries: input.maxSeries ?? 28,
      maxCandidates: maxCandidatesPerSource
    }),
    discoverSoQuadrinhossLancamentosAssets({
      entities: input.entities,
      franchise: input.franchise ?? "Marvel",
      maxResultsPerFeed: 12,
      maxCandidates: maxCandidatesPerSource
    }),
    discoverMultiversohqComicsAssets({
      entities: input.entities,
      franchise: input.franchise ?? "Marvel",
      maxFeeds: input.multiversohqMaxFeeds ?? 4,
      maxPagesPerFeed: input.multiversohqMaxPagesPerFeed ?? 2,
      maxCandidates: maxCandidatesPerSource
    }),
    discoverBlogspotComicsAssets({
      entities: input.entities,
      franchise: input.franchise ?? "Marvel",
      maxFeeds: 4,
      maxPagesPerFeed: 2,
      maxCandidates: maxCandidatesPerSource
    }),
    crawlPartners
      ? discoverOsinvisiveisPartnerCatalogAssets({
          entities: input.entities,
          franchise: input.franchise ?? "Marvel",
          maxPartners: input.maxOsinvisiveisPartners ?? 16,
          maxCandidates: maxCandidatesPerSource
        })
      : Promise.resolve({
          partners: [],
          candidates: [],
          partnersCrawled: 0,
          warnings: ["osinvisiveis_partner_crawl_disabled"]
        })
  ]);

  const candidateMap = new Map<string, MediaBeastCandidate>();
  const warnings = [
    ...soquadrinhos.warnings,
    ...soquadrinhossLancamentos.warnings,
    ...multiversohq.warnings,
    ...blogspot.warnings,
    ...osinvisiveisPartners.warnings
  ];
  for (const candidate of [
    ...soquadrinhos.candidates,
    ...soquadrinhossLancamentos.candidates,
    ...multiversohq.candidates,
    ...blogspot.candidates,
    ...osinvisiveisPartners.candidates
  ]) {
    candidateMap.set(candidate.id, candidate);
  }

  let downloadPanelCandidates = 0;
  if (input.enableDownloadIngestion && input.userApprovedDownload) {
    const postUrls = [
      ...new Set(
        [
          ...multiversohq.candidates,
          ...blogspot.candidates,
          ...osinvisiveisPartners.candidates,
          ...soquadrinhossLancamentos.candidates
        ]
          .map(
            (candidate) =>
              candidate.metadata.multiversohqPostUrl ?? candidate.metadata.blogspotPostUrl
          )
          .filter((url): url is string => typeof url === "string" && url.length > 0)
      )
    ];
    const panelDiscovery = await discoverComicsCatalogPanelAssets({
      postUrls,
      entities: input.entities,
      franchise: input.franchise ?? "Marvel",
      catalogSource: MULTIVERSOHQ_DISCOVERY_SOURCE,
      maxPosts: input.maxDownloadPosts ?? 3,
      maxPanelsPerPost: input.maxPanelsPerPost ?? 6,
      maxDownloadBytes: input.maxDownloadBytes ?? DEFAULT_MAX_DOWNLOAD_BYTES,
      userApprovedDownload: true,
      ...(input.projectRoot ? { projectRoot: input.projectRoot } : {})
    });
    warnings.push(...panelDiscovery.warnings);
    for (const candidate of panelDiscovery.candidates) {
      candidateMap.set(candidate.id, candidate);
    }
    downloadPanelCandidates = panelDiscovery.candidates.length;
    warnings.push(
      `Catalog download ingestion: ${panelDiscovery.ingestions.length} posts scanned, ${downloadPanelCandidates} panel candidates.`
    );
  } else if (input.enableDownloadIngestion) {
    warnings.push("download_ingestion_skipped:user_approval_required");
  }

  return {
    candidates: [...candidateMap.values()],
    publishers: [
      soquadrinhos.publisher,
      soquadrinhossLancamentos.publisher,
      multiversohq.publisher,
      ...blogspot.publishers
    ],
    warnings,
    stats: {
      soquadrinhosCandidates: soquadrinhos.candidates.length,
      soquadrinhossLancamentosCandidates: soquadrinhossLancamentos.candidates.length,
      multiversohqCandidates: multiversohq.candidates.length,
      blogspotCandidates: blogspot.candidates.length,
      osinvisiveisPartnerCandidates: osinvisiveisPartners.candidates.length,
      downloadPanelCandidates,
      totalCandidates: candidateMap.size
    }
  };
}