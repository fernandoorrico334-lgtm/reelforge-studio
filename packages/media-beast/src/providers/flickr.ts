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
      query: `${base} ${input.niche} ${hints.past[0]}`,
      lens: "past",
      intent: "historical_cc",
      score: 60,
      licenseStatus: "creative_commons",
      riskLevel: "medium",
      extraMetadata: { licenseFilter: true, photoEra: "historical" }
    },
    {
      label: "Archive photograph trail",
      query: `${base} ${input.niche} archive photograph vintage`,
      lens: "past",
      intent: "archive_photo",
      score: 58,
      licenseStatus: "unknown",
      riskLevel: "medium",
      extraMetadata: { licenseFilter: true, photoEra: "vintage" }
    },
    {
      label: "Museum and collection lead",
      query: `${base} ${input.niche} museum collection flickr`,
      lens: "past",
      intent: "collection_lead",
      score: 57,
      licenseStatus: "creative_commons",
      riskLevel: "medium",
      extraMetadata: { licenseFilter: true, photoEra: "collection" }
    },
    {
      label: "Press and editorial archive",
      query: `${base} ${input.niche} press photo editorial archive`,
      lens: "past",
      intent: "press_archive",
      score: 55,
      licenseStatus: "editorial_only",
      riskLevel: "medium",
      extraMetadata: { licenseFilter: true, photoEra: "press" }
    },
    {
      label: "1970s decade filter",
      query: `${base} ${input.niche} 1970s documentary photograph`,
      lens: "past",
      intent: "decade_archive",
      score: 54,
      licenseStatus: "creative_commons",
      riskLevel: "medium",
      extraMetadata: { licenseFilter: true, photoEra: "1970s" }
    },
    {
      label: "1980s decade filter",
      query: `${base} ${input.niche} 1980s archive photograph`,
      lens: "past",
      intent: "decade_archive",
      score: 53,
      licenseStatus: "creative_commons",
      riskLevel: "medium",
      extraMetadata: { licenseFilter: true, photoEra: "1980s" }
    },
    {
      label: "Current editorial reference",
      query: `${base} ${input.niche} ${hints.present[0]} documentary photo`,
      lens: "present",
      intent: "editorial_photo",
      score: 50,
      extraMetadata: { licenseFilter: true, photoEra: "current" }
    },
    {
      label: "Photojournalism lead",
      query: `${base} ${input.niche} photojournalism documentary flickr`,
      lens: "present",
      intent: "photojournalism",
      score: 49,
      licenseStatus: "editorial_only",
      riskLevel: "medium",
      extraMetadata: { licenseFilter: true, photoEra: "current" }
    },
    {
      label: "Emerging visual motif",
      query: `${base} ${input.niche} ${hints.future[0]} photography trend`,
      lens: "future",
      intent: "visual_signal",
      score: 45,
      extraMetadata: { licenseFilter: false, signalStrength: "weak" }
    },
    {
      label: "Rising aesthetic pattern",
      query: `${base} ${input.niche} ${hints.future[1]} visual style photography`,
      lens: "future",
      intent: "aesthetic_signal",
      score: 43,
      extraMetadata: { licenseFilter: false, signalStrength: "emerging" }
    }
  ];

  const collectionPlans = angles.flickrCollections.map((collection, index) => ({
    label: `Collection: ${collection}`,
    query: `${base} ${input.niche} ${collection}`,
    lens: (index < 2 ? "past" : index < 4 ? "present" : "future") as
      | "past"
      | "present"
      | "future",
    intent: "niche_collection",
    score: 56 - index,
    licenseStatus: (index < 3 ? "creative_commons" : "unknown") as
      | "creative_commons"
      | "unknown",
    riskLevel: "medium" as const,
    extraMetadata: { licenseFilter: index < 3, collection, photoEra: "collection" }
  }));

  const nichePlans = buildNicheQueryPlans(base, input.niche, (angle, lens) => ({
    label: `Flickr ${lens}: ${angle}`,
    querySuffix: `${angle} flickr`,
    intent: "niche_photo_angle",
    score: lens === "past" ? 52 : lens === "present" ? 48 : 42,
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
      "Photo-archive discovery with Creative Commons filter hints for historical, editorial, museum collection and decade-specific visual leads.",
    enabled: true,
    capabilities: {
      supportsImages: true,
      supportsVideos: false,
      supportsAudio: false,
      supportsDocuments: false,
      supportsDateFilters: true,
      supportsLicenseMetadata: true,
      discoveryOnly: true,
      importSupported: false,
      requiresApiKey: false,
      setupInstructions:
        "Open Flickr search URLs with license filters. Read each photo page license badge and attribution requirements before import."
    },
    riskNotes: [
      "Creative Commons on Flickr still requires attribution and license compliance.",
      "Not all historical photos are rights-safe for commercial shorts.",
      "Verify whether CC terms match your distribution channel before import.",
      "Discovery URLs do not download or import media automatically.",
      "Press and editorial collections may be view-only or no-derivatives."
    ]
  },
  buildQueries(input: MediaBeastSearchQuery) {
    return limitQueryPlans(buildFlickrPlans(input)).map((plan) => plan.query);
  },
  async searchCandidates(input: MediaBeastSearchQuery) {
    return mapQueryPlansToCandidates(
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
          previewUrl: buildFlickrUrl(plan.query, { license: useLicenseFilter }),
          reasons: [
            `Strong ${plan.lens} photo discovery with clearer license metadata than generic image search.`,
            `Intent '${plan.intent}' helps locate archive-quality references for manual review.`,
            "Flickr collections often expose attribution and license badges on item pages.",
            "Niche collection angles surface museum and press archives missed by broad image search."
          ],
          warnings: [
            "Discovery-only: no automatic download despite CC filter hints.",
            "CC license type must be confirmed on the individual photo page.",
            "Some museum uploads are editorial-only or no-derivatives.",
            "Decade filters are planning hints — verify actual upload date and rights on page."
          ],
          metadata: {
            sourcePackHint: input.niche,
            licenseFilterEnabled: useLicenseFilter,
            attributionRequired: plan.licenseStatus === "creative_commons",
            searchSurface: true,
            substantiveQuery: true
          }
        });
      },
      input.maxCandidates ?? DEFAULT_PROVIDER_MAX_CANDIDATES
    );
  }
};