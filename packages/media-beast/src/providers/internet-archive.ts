import { searchInternetArchiveImages, simplifyAssetQuery } from "./asset-api-clients.js";
import {
  buildArchiveOrgSearchUrl,
  buildKeywordBase,
  buildSubstantiveQuery,
  createDiscoveryCandidate,
  limitQueryPlans,
  mapQueryPlansToCandidates,
  type DiscoveryQueryPlan
} from "./provider-utils.js";
import type {
  MediaBeastProvider,
  MediaBeastSearchQuery
} from "./types.js";

function buildArchivePlans(input: MediaBeastSearchQuery): DiscoveryQueryPlan[] {
  const base = buildKeywordBase(input);

  return [
    {
      label: "Historical image collections",
      query: `${quoteArchiveQuery(base)} AND mediatype:image`,
      lens: "past",
      intent: "archive_image",
      score: 62,
      kind: "image",
      extraMetadata: { mediatype: "image", archiveSurface: "search" }
    },
    {
      label: "Deep item discovery via Google",
      query: buildSubstantiveQuery({
        phrase: base,
        site: "archive.org/details",
        angle: "documentary photograph scan",
        niche: input.niche,
        temporal: "past"
      }),
      lens: "past",
      intent: "archive_item_page",
      score: 66,
      extraMetadata: { substantiveUrl: true, archiveSurface: "details" }
    }
  ];
}

function quoteArchiveQuery(text: string): string {
  const trimmed = text.trim();
  return trimmed.includes(" ") ? `"${trimmed}"` : trimmed;
}

function buildArchiveSourceUrl(plan: DiscoveryQueryPlan): string {
  if (plan.extraMetadata?.archiveSurface === "details") {
    return `https://archive.org/search?query=${encodeURIComponent(plan.query)}`;
  }

  const mediatype =
    typeof plan.extraMetadata?.mediatype === "string"
      ? plan.extraMetadata.mediatype
      : undefined;

  return buildArchiveOrgSearchUrl(plan.query, mediatype ? { mediatype } : undefined);
}

export const internetArchiveProvider: MediaBeastProvider = {
  descriptor: {
    id: "internet-archive",
    name: "Internet Archive Candidate Search",
    description:
      "Real archive image items via Internet Archive API with direct thumbnails.",
    enabled: true,
    capabilities: {
      supportsImages: true,
      supportsVideos: true,
      supportsAudio: true,
      supportsDocuments: true,
      supportsDateFilters: true,
      supportsLicenseMetadata: true,
      discoveryOnly: false,
      importSupported: true,
      requiresApiKey: false,
      setupInstructions:
        "Review item pages, collection terms and file metadata manually before importing local copies."
    },
    riskNotes: [
      "Archive availability does not always mean commercial reuse rights.",
      "Some collections are public domain; others are restricted or editorial-only.",
      "Keep original source URL and license notes with every imported asset."
    ]
  },
  buildQueries(input: MediaBeastSearchQuery) {
    return limitQueryPlans(buildArchivePlans(input)).map((plan) => plan.query);
  },
  async searchCandidates(input: MediaBeastSearchQuery) {
    const maxCandidates = input.maxCandidates ?? 6;
    const base = simplifyAssetQuery(buildKeywordBase(input), 4);
    const apiCandidates = base.length > 2 ? await searchInternetArchiveImages(base, maxCandidates) : [];

    if (apiCandidates.length >= Math.min(2, maxCandidates)) {
      return apiCandidates.slice(0, maxCandidates);
    }

    const fallback = mapQueryPlansToCandidates(
      "internet-archive",
      buildArchivePlans(input),
      (plan) =>
        createDiscoveryCandidate({
          providerId: "internet-archive",
          plan,
          title: `Internet Archive ${plan.lens}: ${plan.label}`,
          sourceUrl: buildArchiveSourceUrl(plan),
          reasons: ["Fallback search surface — prefer API results when available."],
          warnings: [
            "Search surface only — no direct image URL.",
            "Manual license review required before download/import."
          ],
          metadata: {
            sourcePackHint: input.niche,
            searchSurface: true,
            substantiveQuery: false
          }
        }),
      Math.max(1, maxCandidates - apiCandidates.length)
    ).map((candidate) => ({
      ...candidate,
      score: Math.max(8, candidate.score - 40),
      previewUrl: null
    }));

    return [...apiCandidates, ...fallback]
      .sort((left, right) => right.score - left.score)
      .slice(0, maxCandidates);
  }
};