import { searchDirectAssetBundle, simplifyAssetQuery } from "./asset-api-clients.js";
import type {
  MediaBeastCandidate,
  MediaBeastProvider,
  MediaBeastSearchQuery
} from "./types.js";

function buildComicsQueries(input: MediaBeastSearchQuery): string[] {
  const raw = input.keywords.join(" ").trim();
  const core = simplifyAssetQuery(raw, 3);
  const lead = input.keywords.find((keyword) => keyword.length > 3) ?? core.split(" ")[0] ?? core;

  return [
    core,
    `${lead} marvel comic`,
    `${lead} symbiote`,
    `${lead} superhero comic art`
  ].filter((query) => query.length > 4);
}

export const comicsArchiveProvider: MediaBeastProvider = {
  descriptor: {
    id: "comics-archive",
    name: "Comics Archive Leads",
    description:
      "Real comic panel and illustration discovery via Wikimedia Commons and Openverse.",
    enabled: true,
    capabilities: {
      supportsImages: true,
      supportsVideos: false,
      supportsAudio: false,
      supportsDocuments: true,
      supportsDateFilters: true,
      supportsLicenseMetadata: true,
      discoveryOnly: false,
      importSupported: true,
      requiresApiKey: false,
      setupInstructions:
        "Review issue dates, publishers, public-domain status and site terms before importing pages or panels."
    },
    riskNotes: [
      "Old comics are not automatically public domain.",
      "Trademarked characters and active franchises need extra caution.",
      "Prefer public-domain issues, commentary, generated recreations and original captions."
    ]
  },
  buildQueries(input: MediaBeastSearchQuery) {
    return buildComicsQueries(input);
  },
  async searchCandidates(input: MediaBeastSearchQuery) {
    const maxCandidates = input.maxCandidates ?? 6;
    const queries = buildComicsQueries(input).slice(0, 3);
    const perQuery = Math.max(4, Math.ceil(maxCandidates / Math.max(1, queries.length)));
    const candidateMap = new Map<string, MediaBeastCandidate>();

    const bundles = await Promise.all(
      queries.map((query) =>
        searchDirectAssetBundle({
          query,
          maxPerSource: perQuery,
          includeFlickr: false
        })
      )
    );

    for (const group of bundles) {
      for (const candidate of group) {
        candidateMap.set(candidate.id, candidate);
      }
    }

    return [...candidateMap.values()]
      .sort((left, right) => right.score - left.score)
      .slice(0, maxCandidates);
  }
};