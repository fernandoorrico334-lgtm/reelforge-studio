import {
  buildDateSuffix,
  buildKeywordBase,
  buildSubstantiveQuery,
  buildYouTubeSearchUrl,
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

const BASE_RISK_NOTES = [
  "YouTube content is usually copyrighted or platform-restricted.",
  "This provider must never auto-download or bypass platform controls.",
  "Use it to discover topics, public references, channel leads and manual review candidates.",
  "Trend and sound discovery is for editorial planning only, not asset reuse."
];

function buildYouTubePlans(input: MediaBeastSearchQuery): DiscoveryQueryPlan[] {
  const base = buildKeywordBase(input);
  const dateSuffix = buildDateSuffix(input);
  const hints = getNicheTemporalHints(input.niche);
  const language = input.language ?? "pt-BR";

  const plans: DiscoveryQueryPlan[] = [
    {
      label: "Historical archive footage",
      query: `${buildSubstantiveQuery({ phrase: base, angle: `${hints.past[0]} full documentary`, niche: input.niche, temporal: "past" })}${dateSuffix}`,
      lens: "past",
      intent: "archival_footage",
      score: 52,
      extraMetadata: { contentFormat: "long", uploadEra: "historical", longForm: true }
    },
    {
      label: "Legacy channel archive",
      query: buildSubstantiveQuery({
        phrase: base,
        angle: "old channel archive interview original",
        niche: input.niche,
        temporal: "past"
      }) + dateSuffix,
      lens: "past",
      intent: "channel_archive",
      score: 50,
      extraMetadata: { contentFormat: "channel_lead", uploadEra: "legacy", longForm: true }
    },
    {
      label: "Vintage viral reference",
      query: buildSubstantiveQuery({
        phrase: base,
        angle: "viral old video analysis original upload",
        niche: input.niche,
        temporal: "past"
      }) + dateSuffix,
      lens: "past",
      intent: "viral_archive",
      score: 48,
      extraMetadata: { contentFormat: "reference", uploadEra: "viral_legacy" }
    },
    {
      label: "Current shorts trend",
      query: buildSubstantiveQuery({
        phrase: base,
        angle: `#shorts ${hints.present[0]}`,
        niche: input.niche,
        temporal: "present"
      }),
      lens: "present",
      intent: "shorts_trend",
      score: 46,
      extraMetadata: { contentFormat: "short", platformSurface: "shorts_feed" }
    },
    {
      label: "Present-day documentary angle",
      query: buildSubstantiveQuery({
        phrase: base,
        angle: `${hints.present[1]} documentary explainer`,
        niche: input.niche,
        temporal: "present"
      }) + dateSuffix,
      lens: "present",
      intent: "current_narrative",
      score: 44,
      extraMetadata: { contentFormat: "long", uploadEra: "current", longForm: true }
    },
    {
      label: "Trending sound and audio lead",
      query: buildSubstantiveQuery({
        phrase: base,
        angle: "trending sound remix documentary narration",
        niche: input.niche,
        temporal: "present"
      }),
      lens: "present",
      intent: "audio_trend",
      score: 43,
      extraMetadata: { contentFormat: "audio_lead", platformSurface: "sound_trend" }
    },
    {
      label: "Rising topic signal",
      query: buildSubstantiveQuery({
        phrase: base,
        angle: `${hints.future[0]} explained deep dive`,
        niche: input.niche,
        temporal: "future"
      }),
      lens: "future",
      intent: "rising_topic",
      score: 41,
      extraMetadata: { contentFormat: "signal", signalStrength: "weak" }
    },
    {
      label: "Emerging creator format",
      query: buildSubstantiveQuery({
        phrase: base,
        angle: `${hints.future[1]} shorts format breakdown`,
        niche: input.niche,
        temporal: "future"
      }),
      lens: "future",
      intent: "format_signal",
      score: 39,
      extraMetadata: { contentFormat: "short", signalStrength: "emerging" }
    }
  ];

  if (language.startsWith("pt")) {
    plans.push({
      label: "Brazilian editorial context",
      query: buildSubstantiveQuery({
        phrase: base,
        angle: "documentario brasileiro reportagem completa",
        niche: input.niche,
        temporal: "present",
        extraTerms: ["#shorts"]
      }),
      lens: "present",
      intent: "regional_context",
      score: 45,
      extraMetadata: { contentFormat: "short", language: "pt-BR" }
    });
  }

  return plans;
}

export const youtubeProvider: MediaBeastProvider = {
  descriptor: {
    id: "youtube",
    name: "YouTube Discovery",
    description:
      "Multi-lens YouTube discovery for archival footage, legacy channels, viral references, shorts trends, audio leads and weak future signals.",
    enabled: true,
    capabilities: {
      supportsImages: false,
      supportsVideos: true,
      supportsAudio: true,
      supportsDocuments: false,
      supportsDateFilters: true,
      supportsLicenseMetadata: false,
      discoveryOnly: true,
      importSupported: false,
      requiresApiKey: false,
      setupInstructions:
        "Open generated search URLs manually. Review channel history, upload dates, description links and rights notes before any import."
    },
    riskNotes: BASE_RISK_NOTES
  },
  buildQueries(input: MediaBeastSearchQuery) {
    return limitQueryPlans(buildYouTubePlans(input)).map((plan) => plan.query);
  },
  async searchCandidates(input: MediaBeastSearchQuery) {
    return mapQueryPlansToCandidates(
      "youtube",
      buildYouTubePlans(input),
      (plan) =>
        createDiscoveryCandidate({
          providerId: "youtube",
          plan,
          title: `YouTube ${plan.lens} lead: ${plan.label}`,
          sourceUrl: buildYouTubeSearchUrl(plan.query, {
            longForm: plan.extraMetadata?.longForm === true,
            sortByDate: plan.lens === "past"
          }),
          reasons: [
            `Covers ${plan.lens} discovery for narrative angles, references and timeline context.`,
            `Intent '${plan.intent}' helps plan editorial structure before manual rights review.`,
            "Strong surface for comparing historical footage with current shorts patterns."
          ],
          warnings: [
            "Discovery-only: no automatic download, mirroring or re-upload.",
            "Trending sounds and viral formats are planning signals, not reusable assets.",
            "Do not use for ban evasion, fingerprint avoidance or copyright laundering."
          ],
          metadata: {
            dateAfter: input.dateAfter ?? null,
            dateBefore: input.dateBefore ?? null,
            sourcePackHint: input.niche
          }
        }),
      input.maxCandidates ?? 6
    );
  }
};