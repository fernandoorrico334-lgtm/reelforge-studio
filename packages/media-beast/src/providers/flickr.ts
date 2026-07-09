import { searchOpenverseImages, simplifyAssetQuery } from "./asset-api-clients.js";
import {
  buildKeywordBase,
  buildNicheQueryPlans,
  createDiscoveryCandidate,
  DEFAULT_PROVIDER_MAX_CANDIDATES,
  getNicheDiscoveryAngles,
  getNicheTemporalHints,
  limitQueryPlans,
  mapQueryPlansToCandidates,
  type DiscoveryQueryPlan
} from "./provider-utils.js";
import type {
  MediaBeastProvider,
  MediaBeastSearchQuery
} from "./types.js";

function buildFlickrUrl(query: string, options?: { license?: boolean; historical?: boolean }) {
  const params = new URLSearchParams({ text: query });
  if (options?.license) {
    params.set("license", "2,3,4,5,6,9,10");
  }
  if (options?.historical) {
    params.set("date_from", "1900-01-01");
    params.set("date_to", "1999-12-31");
  }
  return `https://www.flickr.com/search/?${params.toString()}`;
}

function buildFlickrPlans(input: MediaBeastSearchQuery): DiscoveryQueryPlan[] {
  const base = buildKeywordBase(input);
  const hints = getNicheTemporalHints(input.niche);
  const angles = getNicheDiscoveryAngles(input.niche);

  const corePlans: DiscoveryQueryPlan[] = [
    {
      label: "Historical CC photo lead",
      query: `${base} ${input.niche} ${hints.past[0]} archive photograph`,
      lens: "past",
      intent: "historical_cc",
      score: 60,
      licenseStatus: "creative_commons",
      riskLevel: "medium",
      extraMetadata: { licenseFilter: true, photoEra: "historical" }
    },
    {
      label: "Press and editorial archive",
      query: `${base} ${input.niche} press photo editorial`,
      lens: "past",
      intent: "press_archive",
      score: 55,
      licenseStatus: "editorial_only",
      riskLevel: "medium",
      extraMetadata: { licenseFilter: true, photoEra: "press" }
    }
  ];

  const collectionPlans = angles.flickrCollections.slice(0, 2).map((collection, index) => ({
    label: `Collection: ${collection}`,
    query: `${base} ${input.niche} ${collection}`,
    lens: (index < 1 ? "past" : "present") as "past" | "present" | "future",
    intent: "niche_collection",
    score: 56 - index,
    licenseStatus: "creative_commons" as const,
    riskLevel: "medium" as const,
    extraMetadata: { licenseFilter: true, collection, photoEra: "collection" }
  }));

  const nichePlans = buildNicheQueryPlans(base, input.niche, (angle, lens) => ({
    label: `Flickr ${lens}: ${angle}`,
    querySuffix: `${angle} flickr`,
    intent: "niche_photo_angle",
    score: lens === "past" ? 52 : 48,
    licenseStatus: lens === "past" ? "creative_commons" : "unknown",
    riskLevel: "medium",
    extraMetadata: { licenseFilter: lens === "past", nicheAngle: angle }
  }));

  return [...corePlans, ...collectionPlans, ...nichePlans];
}

export const flickrProvider: MediaBeastProvider = {
  descriptor: {
    id: "flickr",
    name: "Flickr Archive Discovery",
    description:
      "Real Flickr photos via Openverse API with direct image URLs and CC metadata.",
    enabled: true,
    capabilities: {
      supportsImages: true,
      supportsVideos: false,
      supportsAudio: false,
      supportsDocuments: false,
      supportsDateFilters: true,
      supportsLicenseMetadata: true,
      discoveryOnly: false,
      importSupported: true,
      requiresApiKey: false,
      setupInstructions:
        "Open Flickr photo pages with license filters. Read each photo page license badge and attribution requirements before import."
    },
    riskNotes: [
      "Creative Commons on Flickr still requires attribution and license compliance.",
      "Not all historical photos are rights-safe for commercial shorts.",
      "Verify whether CC terms match your distribution channel before import."
    ]
  },
  buildQueries(input: MediaBeastSearchQuery) {
    return limitQueryPlans(buildFlickrPlans(input)).map((plan) => plan.query);
  },
  async searchCandidates(input: MediaBeastSearchQuery) {
    const maxCandidates = input.maxCandidates ?? DEFAULT_PROVIDER_MAX_CANDIDATES;
    const base = simplifyAssetQuery(buildKeywordBase(input), 4);
    const queries = [base, `${base} editorial photograph`].filter((query) => query.length > 4);

    const candidateMap = new Map<string, Awaited<ReturnType<typeof searchOpenverseImages>>[number]>();

    for (const query of queries) {
      const results = await searchOpenverseImages(query, {
        providerId: "flickr",
        source: "flickr",
        maxResults: Math.ceil(maxCandidates / queries.length)
      });
      for (const candidate of results) {
        candidateMap.set(candidate.id, candidate);
      }
    }

    const apiCandidates = [...candidateMap.values()].sort((left, right) => right.score - left.score);

    if (apiCandidates.length >= Math.min(2, maxCandidates)) {
      return apiCandidates.slice(0, maxCandidates);
    }

    const fallback = mapQueryPlansToCandidates(
      "flickr",
      buildFlickrPlans(input),
      (plan) => {
        const useLicenseFilter = plan.extraMetadata?.licenseFilter === true;
        const isHistorical = plan.lens === "past";

        return createDiscoveryCandidate({
          providerId: "flickr",
          plan,
          title: `Flickr ${plan.lens} lead: ${plan.label}`,
          sourceUrl: buildFlickrUrl(plan.query, {
            license: useLicenseFilter,
            historical: isHistorical
          }),
          reasons: ["Fallback search surface — prefer Openverse Flickr results."],
          warnings: ["Search surface only — no direct image URL."],
          metadata: {
            sourcePackHint: input.niche,
            searchSurface: true,
            substantiveQuery: false
          }
        });
      },
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