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

function buildPinterestPlans(input: MediaBeastSearchQuery): DiscoveryQueryPlan[] {
  const base = buildKeywordBase(input);
  const hints = getNicheTemporalHints(input.niche);
  const angles = getNicheDiscoveryAngles(input.niche);

  const corePlans: DiscoveryQueryPlan[] = [
    {
      label: "Vintage visual board",
      query: `${base} ${input.niche} ${hints.past[0]} vintage aesthetic`,
      lens: "past",
      intent: "vintage_moodboard",
      score: 53,
      extraMetadata: { visualType: "moodboard", era: "vintage" }
    },
    {
      label: "Historical reference collage",
      query: `${base} ${input.niche} historical visual reference`,
      lens: "past",
      intent: "historical_collage",
      score: 51,
      extraMetadata: { visualType: "reference", era: "historical" }
    },
    {
      label: "Decade-specific aesthetic",
      query: `${base} ${input.niche} 1970s 1980s aesthetic board`,
      lens: "past",
      intent: "decade_aesthetic",
      score: 49,
      extraMetadata: { visualType: "era_board", era: "decade" }
    },
    {
      label: "Current aesthetic trend",
      query: `${base} ${input.niche} ${hints.present[0]} aesthetic`,
      lens: "present",
      intent: "aesthetic_trend",
      score: 56,
      extraMetadata: { visualType: "trend_board", era: "current" }
    },
    {
      label: "Editorial shot-list inspiration",
      query: `${base} ${input.niche} cinematic visual mood`,
      lens: "present",
      intent: "shot_inspiration",
      score: 52,
      extraMetadata: { visualType: "shot_list", era: "current" }
    },
    {
      label: "Typography and title card",
      query: `${base} ${input.niche} documentary title card typography`,
      lens: "present",
      intent: "typography_reference",
      score: 48,
      extraMetadata: { visualType: "typography", era: "current" }
    },
    {
      label: "Color grading reference",
      query: `${base} ${input.niche} color grading mood cinematic`,
      lens: "present",
      intent: "color_grading",
      score: 47,
      extraMetadata: { visualType: "color_grade", era: "current" }
    },
    {
      label: "Emerging visual language",
      query: `${base} ${input.niche} ${hints.future[0]} visual trend`,
      lens: "future",
      intent: "visual_forecast",
      score: 46,
      extraMetadata: { visualType: "forecast", signalStrength: "emerging" }
    },
    {
      label: "Future palette signal",
      query: `${base} ${input.niche} ${hints.future[1]} color palette`,
      lens: "future",
      intent: "palette_signal",
      score: 43,
      extraMetadata: { visualType: "palette", signalStrength: "weak" }
    },
    {
      label: "Layout and composition board",
      query: `${base} ${input.niche} editorial layout composition board`,
      lens: "future",
      intent: "layout_signal",
      score: 42,
      extraMetadata: { visualType: "layout", signalStrength: "emerging" }
    }
  ];

  const motifPlans = angles.visualMotifs.map((motif, index) => ({
    label: `Visual motif: ${motif}`,
    query: `${base} ${input.niche} ${motif}`,
    lens: (index < 2 ? "past" : index < 4 ? "present" : "future") as
      | "past"
      | "present"
      | "future",
    intent: "niche_motif",
    score: 50 - index,
    extraMetadata: { visualType: "niche_motif", motif }
  }));

  const nichePlans = buildNicheQueryPlans(base, input.niche, (angle, lens) => ({
    label: `Pinterest ${lens}: ${angle}`,
    querySuffix: `${angle} aesthetic board`,
    intent: "niche_visual_angle",
    score: lens === "present" ? 50 : lens === "past" ? 47 : 41,
    extraMetadata: { visualType: "niche_angle", nicheAngle: angle }
  }));

  return [...corePlans, ...motifPlans, ...nichePlans];
}

export const pinterestProvider: MediaBeastProvider = {
  descriptor: {
    id: "pinterest",
    name: "Pinterest Visual Discovery",
    description:
      "Visual trend and mood-board discovery for historical aesthetics, editorial shot-lists, typography references, palette signals and emerging visual language.",
    enabled: true,
    capabilities: {
      supportsImages: true,
      supportsVideos: true,
      supportsAudio: false,
      supportsDocuments: false,
      supportsDateFilters: false,
      supportsLicenseMetadata: false,
      discoveryOnly: true,
      importSupported: false,
      requiresApiKey: false,
      setupInstructions:
        "Use Pinterest boards for visual direction research. Trace every pin to its source page and verify rights before import."
    },
    riskNotes: [
      "Pins often repost third-party images without clear license chains.",
      "Mood boards are planning tools, not asset libraries.",
      "Always verify the original source behind a pin before any reuse.",
      "Do not bulk-scrape or auto-import pin images.",
      "Typography and color references still require rights review if reproduced literally."
    ]
  },
  buildQueries(input: MediaBeastSearchQuery) {
    return limitQueryPlans(buildPinterestPlans(input)).map((plan) => plan.query);
  },
  async searchCandidates(input: MediaBeastSearchQuery) {
    return mapQueryPlansToCandidates(
      "pinterest",
      buildPinterestPlans(input),
      (plan) =>
        createDiscoveryCandidate({
          providerId: "pinterest",
          plan,
          title: `Pinterest ${plan.lens} lead: ${plan.label}`,
          sourceUrl: `https://www.pinterest.com/search/pins/?q=${encodeURIComponent(plan.query)}`,
          previewUrl: `https://www.pinterest.com/search/boards/?q=${encodeURIComponent(plan.query)}`,
          reasons: [
            `Useful ${plan.lens} visual discovery for palettes, framing and editorial mood.`,
            `Intent '${plan.intent}' supports shot-list planning without assuming rights.`,
            "Strong bridge between historical aesthetics and current visual trends.",
            "Niche motif expansion surfaces era-specific boards missed by generic image search."
          ],
          warnings: [
            "Discovery-only: no pin scraping or automatic download.",
            "Pins are secondary references — verify upstream source rights.",
            "Generated visuals should replace unclear-rights references in final renders.",
            "Board previews are planning aids, not licensed assets."
          ],
          metadata: {
            sourcePackHint: input.niche,
            visualType:
              typeof plan.extraMetadata?.visualType === "string"
                ? plan.extraMetadata.visualType
                : "moodboard"
          }
        }),
      input.maxCandidates ?? DEFAULT_PROVIDER_MAX_CANDIDATES
    );
  }
};