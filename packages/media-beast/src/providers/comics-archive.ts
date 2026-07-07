import type {
  MediaBeastCandidate,
  MediaBeastProvider,
  MediaBeastSearchQuery
} from "./types.js";

function stableCandidateId(seed: string) {
  return `comics-archive-${Buffer.from(seed).toString("base64url").slice(0, 16)}`;
}

export const comicsArchiveProvider: MediaBeastProvider = {
  descriptor: {
    id: "comics-archive",
    name: "Comics Archive Leads",
    description:
      "Candidate planner for old comics, public-domain collections and issue metadata review.",
    enabled: true,
    capabilities: {
      supportsImages: true,
      supportsVideos: false,
      supportsAudio: false,
      supportsDocuments: true,
      supportsDateFilters: true,
      supportsLicenseMetadata: true,
      discoveryOnly: false,
      importSupported: false,
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
    const base = input.keywords.join(" ");
    return [
      `${base} public domain comics archive`,
      `${base} golden age comics issue`,
      `${base} comic book database old issue`
    ];
  },
  async searchCandidates(input: MediaBeastSearchQuery) {
    return this.buildQueries(input).slice(0, input.maxCandidates ?? 5).map(
      (query): MediaBeastCandidate => ({
        id: stableCandidateId(query),
        providerId: "comics-archive",
        kind: "webpage",
        title: `Comics archive candidate: ${query}`,
        sourceUrl: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
        previewUrl: null,
        licenseStatus: "unknown",
        riskLevel: "medium",
        score: 52,
        reasons: [
          "Useful for golden-age/public-domain candidate discovery.",
          "Can feed visual requirements for ComfyUI-safe original variations."
        ],
        warnings: [
          "Manual public-domain verification required.",
          "Do not import pages from active copyrighted franchises without rights."
        ],
        metadata: {
          query,
          comicsFocus: true
        }
      })
    );
  }
};

