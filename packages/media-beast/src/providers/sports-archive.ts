import type {
  MediaBeastCandidate,
  MediaBeastProvider,
  MediaBeastSearchQuery
} from "./types.js";

function stableCandidateId(seed: string) {
  return `sports-archive-${Buffer.from(seed).toString("base64url").slice(0, 16)}`;
}

export const sportsArchiveProvider: MediaBeastProvider = {
  descriptor: {
    id: "sports-archive",
    name: "Sports Archive Leads",
    description:
      "Candidate planner for old football and basketball materials across archives, stats references and local library leads.",
    enabled: true,
    capabilities: {
      supportsImages: true,
      supportsVideos: true,
      supportsAudio: false,
      supportsDocuments: true,
      supportsDateFilters: true,
      supportsLicenseMetadata: false,
      discoveryOnly: true,
      importSupported: false,
      requiresApiKey: false,
      setupInstructions:
        "Use for locating authorized local clips, public archive references and stats. Imported footage must be owned/licensed/manual."
    },
    riskNotes: [
      "Sports broadcast footage is usually heavily restricted.",
      "Stats and factual references are safer than video footage.",
      "Final renders should use owned clips, licensed packs, generated visuals or approved microclips."
    ]
  },
  buildQueries(input: MediaBeastSearchQuery) {
    const base = input.keywords.join(" ");
    return [
      `${base} vintage football archive`,
      `${base} basketball historical footage archive`,
      `${base} match report statistics old season`
    ];
  },
  async searchCandidates(input: MediaBeastSearchQuery) {
    return this.buildQueries(input).slice(0, input.maxCandidates ?? 5).map(
      (query): MediaBeastCandidate => ({
        id: stableCandidateId(query),
        providerId: "sports-archive",
        kind: "webpage",
        title: `Sports archive lead: ${query}`,
        sourceUrl: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
        previewUrl: null,
        licenseStatus: "editorial_only",
        riskLevel: "high",
        score: 54,
        reasons: [
          "Strong niche fit for football/basketball shorts.",
          "Can drive script, stats and shot-list needs before manual asset selection."
        ],
        warnings: [
          "Broadcast clips require explicit rights or owned/local source.",
          "Candidate is not render-ready until reviewed and imported manually."
        ],
        metadata: {
          query,
          sportsFocus: true
        }
      })
    );
  }
};

