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

function buildTikTokPlans(input: MediaBeastSearchQuery): DiscoveryQueryPlan[] {
  const base = buildKeywordBase(input);
  const hints = getNicheTemporalHints(input.niche);
  const angles = getNicheDiscoveryAngles(input.niche);

  const corePlans: DiscoveryQueryPlan[] = [
    {
      label: "Retro viral pattern",
      query: `${base} ${input.niche} ${hints.past[0]}`,
      lens: "past",
      intent: "viral_archive",
      score: 54,
      extraMetadata: { contentFormat: "short", platformSurface: "search" }
    },
    {
      label: "Classic edit format",
      query: `${base} ${input.niche} old edit style documentary`,
      lens: "past",
      intent: "format_archive",
      score: 51,
      extraMetadata: { contentFormat: "short", platformSurface: "search" }
    },
    {
      label: "Legacy creator archive",
      query: `${base} ${input.niche} old creator documentary archive`,
      lens: "past",
      intent: "creator_archive",
      score: 49,
      extraMetadata: { contentFormat: "creator_lead", platformSurface: "profile" }
    },
    {
      label: "Current shorts trend",
      query: `${base} ${input.niche} ${hints.present[0]}`,
      lens: "present",
      intent: "shorts_trend",
      score: 58,
      extraMetadata: { contentFormat: "short", platformSurface: "fyp_signal" }
    },
    {
      label: "Trending sound lead",
      query: `${base} ${input.niche} trending sound`,
      lens: "present",
      intent: "sound_trend",
      score: 57,
      extraMetadata: { contentFormat: "audio_lead", platformSurface: "sound" }
    },
    {
      label: "Hashtag momentum",
      query: `#${input.niche.replace(/_/g, "")} ${base}`,
      lens: "present",
      intent: "hashtag_trend",
      score: 53,
      extraMetadata: { contentFormat: "hashtag", platformSurface: "hashtag" }
    },
    {
      label: "Niche creator discovery",
      query: `${base} ${input.niche} creator documentary shorts`,
      lens: "present",
      intent: "niche_creator",
      score: 52,
      extraMetadata: { contentFormat: "creator_lead", platformSurface: "creator" }
    },
    {
      label: "Duet and stitch format",
      query: `${base} ${input.niche} duet stitch reaction documentary`,
      lens: "present",
      intent: "duet_format",
      score: 48,
      extraMetadata: { contentFormat: "reaction", platformSurface: "duet" }
    },
    {
      label: "Emerging niche format",
      query: `${base} ${hints.future[0]} ${input.niche} shorts`,
      lens: "future",
      intent: "format_signal",
      score: 47,
      extraMetadata: { contentFormat: "short", signalStrength: "emerging" }
    },
    {
      label: "Weak trend signal",
      query: `${base} ${input.niche} ${hints.future[1]}`,
      lens: "future",
      intent: "weak_signal",
      score: 44,
      extraMetadata: { contentFormat: "signal", signalStrength: "weak" }
    },
    {
      label: "Audio remix pattern",
      query: `${base} ${input.niche} original sound remix trend`,
      lens: "future",
      intent: "audio_remix_signal",
      score: 45,
      extraMetadata: { contentFormat: "audio_lead", signalStrength: "emerging" }
    }
  ];

  const formatPlans = angles.tiktokFormats.map((format, index) => ({
    label: `Niche format: ${format}`,
    query: `${base} ${input.niche} ${format}`,
    lens: (index < 2 ? "past" : index < 4 ? "present" : "future") as
      | "past"
      | "present"
      | "future",
    intent: "niche_format",
    score: 50 - index,
    extraMetadata: {
      contentFormat: "short",
      nicheFormat: format,
      platformSurface: index % 2 === 0 ? "fyp_signal" : "search"
    }
  }));

  const nichePlans = buildNicheQueryPlans(base, input.niche, (angle, lens) => ({
    label: `TikTok ${lens}: ${angle}`,
    querySuffix: `${angle} tiktok`,
    intent: "niche_angle",
    score: lens === "present" ? 51 : lens === "past" ? 48 : 43,
    extraMetadata: { contentFormat: "short", nicheAngle: angle }
  }));

  return [...corePlans, ...formatPlans, ...nichePlans];
}

export const tiktokProvider: MediaBeastProvider = {
  descriptor: {
    id: "tiktok",
    name: "TikTok Discovery",
    description:
      "Short-form trend discovery for viral patterns, hashtag momentum, sound leads, niche creators and emerging format signals across past, present and future lenses.",
    enabled: true,
    capabilities: {
      supportsImages: true,
      supportsVideos: true,
      supportsAudio: true,
      supportsDocuments: false,
      supportsDateFilters: false,
      supportsLicenseMetadata: false,
      discoveryOnly: true,
      importSupported: false,
      requiresApiKey: false,
      setupInstructions:
        "Use generated TikTok search URLs for trend research. Never download, repost or fingerprint-evade platform content."
    },
    riskNotes: [
      "TikTok media is almost always platform-restricted and user-generated.",
      "Trending sounds require separate licensing review before use in renders.",
      "Use for format, hook and pacing research — not automatic asset import.",
      "Respect creator attribution, platform terms and regional restrictions.",
      "Niche creator leads are editorial references, not rights-safe footage."
    ]
  },
  buildQueries(input: MediaBeastSearchQuery) {
    return limitQueryPlans(buildTikTokPlans(input)).map((plan) => plan.query);
  },
  async searchCandidates(input: MediaBeastSearchQuery) {
    return mapQueryPlansToCandidates(
      "tiktok",
      buildTikTokPlans(input),
      (plan) =>
        createDiscoveryCandidate({
          providerId: "tiktok",
          plan,
          title: `TikTok ${plan.lens} lead: ${plan.label}`,
          sourceUrl: `https://www.tiktok.com/search?q=${encodeURIComponent(plan.query)}`,
          previewUrl: `https://www.tiktok.com/search/video?q=${encodeURIComponent(plan.query)}`,
          reasons: [
            `Surfaces ${plan.lens} short-form patterns useful for hooks, pacing and topic framing.`,
            `Intent '${plan.intent}' helps compare legacy virality with current momentum.`,
            "Strong signal layer for what audiences currently engage with in the niche.",
            "Niche-specific format angles expand creator and sound discovery beyond generic search."
          ],
          warnings: [
            "Discovery-only: no scraping, download or repost automation.",
            "Sounds and clips are planning references until manually licensed or replaced.",
            "Do not treat FYP trends as rights-safe assets.",
            "Creator discovery URLs require manual review before any reference or inspiration use."
          ],
          metadata: {
            sourcePackHint: input.niche,
            platformSurface:
              typeof plan.extraMetadata?.platformSurface === "string"
                ? plan.extraMetadata.platformSurface
                : "search"
          }
        }),
      input.maxCandidates ?? DEFAULT_PROVIDER_MAX_CANDIDATES
    );
  }
};