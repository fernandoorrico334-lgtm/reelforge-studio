import {
  buildGoogleSearchUrl,
  buildKeywordBase,
  buildSubstantiveQuery,
  createDiscoveryCandidate,
  getNicheTemporalHints,
  limitQueryPlans,
  mapQueryPlansToCandidates,
  type DiscoveryQueryPlan
} from "./provider-utils.js";
import type {
  MediaBeastProvider,
  MediaBeastSearchQuery
} from "./types.js";



function buildGoogleImagePlans(input: MediaBeastSearchQuery): DiscoveryQueryPlan[] {
  const base = buildKeywordBase(input);
  const hints = getNicheTemporalHints(input.niche);

  return [
    {
      label: "Historical archive reference",
      query: buildSubstantiveQuery({
        phrase: base,
        angle: `${hints.past[0]} archive press photo`,
        niche: input.niche,
        temporal: "past",
        extraTerms: ["news photo", "high resolution"]
      }),
      lens: "past",
      intent: "historical_visual",
      score: 46,
      extraMetadata: { imageEra: "historical", filterHint: "isz:l" }
    },
    {
      label: "Vintage public-domain lead",
      query: buildSubstantiveQuery({
        phrase: base,
        angle: "vintage public domain photograph scan",
        niche: input.niche,
        temporal: "past"
      }),
      lens: "past",
      intent: "public_domain_lead",
      score: 48,
      licenseStatus: "unknown",
      extraMetadata: { imageEra: "vintage", filterHint: "sur:fc" }
    },
    {
      label: "Decade-specific visual trail",
      query: buildSubstantiveQuery({
        phrase: base,
        angle: `${hints.past[1]} historical photograph`,
        niche: input.niche,
        temporal: "past"
      }),
      lens: "past",
      intent: "decade_reference",
      score: 44,
      extraMetadata: { imageEra: "decade_specific", filterHint: "cdr:1,cd_min:1/1/1960,cd_max:12/31/1999" }
    },
    {
      label: "Current editorial reference",
      query: buildSubstantiveQuery({
        phrase: base,
        angle: `${hints.present[0]} editorial news photo`,
        niche: input.niche,
        temporal: "present"
      }),
      lens: "present",
      intent: "current_editorial",
      score: 42,
      extraMetadata: { imageEra: "current", filterHint: "qdr:y" }
    },
    {
      label: "Contemporary visual motif",
      query: buildSubstantiveQuery({
        phrase: base,
        angle: "reference image documentary still",
        niche: input.niche,
        temporal: "present"
      }),
      lens: "present",
      intent: "visual_motif",
      score: 40,
      extraMetadata: { imageEra: "current", filterHint: "isz:l" }
    },
    {
      label: "Emerging aesthetic signal",
      query: buildSubstantiveQuery({
        phrase: base,
        angle: `${hints.future[0]} visual trend`,
        niche: input.niche,
        temporal: "future"
      }),
      lens: "future",
      intent: "aesthetic_signal",
      score: 38,
      extraMetadata: { imageEra: "trend_signal", filterHint: "qdr:m" }
    },
    {
      label: "Future visual language",
      query: buildSubstantiveQuery({
        phrase: base,
        angle: `${hints.future[1]} cinematic visual style`,
        niche: input.niche,
        temporal: "future"
      }),
      lens: "future",
      intent: "style_forecast",
      score: 36,
      extraMetadata: { imageEra: "emerging", signalStrength: "weak" }
    },
    {
      label: "Creative Commons discovery",
      query: buildSubstantiveQuery({
        phrase: base,
        angle: "creative commons licensed photograph",
        niche: input.niche,
        temporal: "present"
      }),
      lens: "present",
      intent: "cc_discovery",
      score: 45,
      licenseStatus: "creative_commons",
      riskLevel: "medium",
      extraMetadata: { filterHint: "sur:fc", licenseReviewRequired: true }
    }
  ];
}

export const googleImagesProvider: MediaBeastProvider = {
  descriptor: {
    id: "google-images",
    name: "Google Images Discovery",
    description:
      "Temporal image discovery planner for historical archives, current editorial references, CC leads and emerging aesthetic signals.",
    enabled: true,
    capabilities: {
      supportsImages: true,
      supportsVideos: false,
      supportsAudio: false,
      supportsDocuments: false,
      supportsDateFilters: true,
      supportsLicenseMetadata: false,
      discoveryOnly: true,
      importSupported: false,
      requiresApiKey: false,
      setupInstructions:
        "Open generated URLs with filter hints in metadata. Trace every image to its original page and verify license before import."
    },
    riskNotes: [
      "Google Images is a discovery surface, not a license source.",
      "Result thumbnails must not be treated as reusable assets.",
      "Always verify the original page, license and rights holder.",
      "Date and license filter hints are planning aids; they do not guarantee rights."
    ]
  },
  buildQueries(input: MediaBeastSearchQuery) {
    return limitQueryPlans(buildGoogleImagePlans(input)).map((plan) => plan.query);
  },
  async searchCandidates(input: MediaBeastSearchQuery) {
    return mapQueryPlansToCandidates(
      "google-images",
      buildGoogleImagePlans(input),
      (plan) => {
        const filterHint =
          typeof plan.extraMetadata?.filterHint === "string"
            ? plan.extraMetadata.filterHint
            : undefined;
        const searchOptions: { imageSearch: boolean; tbs?: string } = { imageSearch: true };
        if (filterHint) {
          searchOptions.tbs = filterHint;
        }

        return createDiscoveryCandidate({
          providerId: "google-images",
          plan,
          title: `Image ${plan.lens} lead: ${plan.label}`,
          sourceUrl: buildGoogleSearchUrl(plan.query, searchOptions),
          reasons: [
            `Targets ${plan.lens} visual discovery for shot lists, mood boards and source trails.`,
            `Intent '${plan.intent}' supports planning before manual rights verification.`,
            "Useful for locating original source pages rather than copying thumbnails."
          ],
          warnings: [
            "Discovery-only: no scraping and no automatic download.",
            "Filter hints do not replace license verification on the source page.",
            "Transformation does not remove copyright obligations."
          ],
          metadata: {
            originalSourceRequired: true,
            sourcePackHint: input.niche,
            filterHint: filterHint ?? null
          }
        });
      },
      input.maxCandidates ?? 6
    );
  }
};