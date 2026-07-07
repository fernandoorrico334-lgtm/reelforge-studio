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

function buildTrendScannerPlans(input: MediaBeastSearchQuery): DiscoveryQueryPlan[] {
  const base = buildKeywordBase(input);
  const hints = getNicheTemporalHints(input.niche);
  const angles = getNicheDiscoveryAngles(input.niche);

  const corePlans: DiscoveryQueryPlan[] = [
    {
      label: "Google Trends exploration",
      query: base,
      lens: "present",
      intent: "search_trend",
      score: 62,
      riskLevel: "low",
      extraMetadata: { surface: "google_trends", trendType: "search_volume" }
    },
    {
      label: "Rising related query",
      query: `${base} ${input.niche}`,
      lens: "future",
      intent: "rising_query",
      score: 60,
      riskLevel: "low",
      extraMetadata: { surface: "google_trends", trendType: "rising" }
    },
    {
      label: "Breakout topic signal",
      query: `${base} ${hints.future[0]}`,
      lens: "future",
      intent: "breakout_signal",
      score: 58,
      riskLevel: "low",
      extraMetadata: { surface: "google_trends", trendType: "breakout" }
    },
    {
      label: "Cross-platform trend check",
      query: `${base} ${input.niche} trending now`,
      lens: "present",
      intent: "cross_platform",
      score: 54,
      riskLevel: "low",
      extraMetadata: { surface: "web_search", trendType: "cross_platform" }
    },
    {
      label: "Seasonal resurgence pattern",
      query: `${base} ${hints.past[0]} resurgence trend`,
      lens: "past",
      intent: "resurgence_pattern",
      score: 52,
      riskLevel: "low",
      extraMetadata: { surface: "google_trends", trendType: "seasonal" }
    },
    {
      label: "Weak future signal",
      query: `${base} ${hints.future[1]} 2026`,
      lens: "future",
      intent: "weak_future_signal",
      score: 48,
      riskLevel: "low",
      extraMetadata: { surface: "web_search", trendType: "forecast", signalStrength: "weak" }
    },
    {
      label: "Audience question mining",
      query: `${base} ${input.niche} people also ask`,
      lens: "present",
      intent: "question_mining",
      score: 53,
      riskLevel: "low",
      extraMetadata: { surface: "web_search", trendType: "questions" }
    },
    {
      label: "YouTube trending overlap",
      query: `${base} ${input.niche} youtube trending shorts`,
      lens: "present",
      intent: "youtube_overlap",
      score: 51,
      riskLevel: "low",
      extraMetadata: { surface: "web_search", trendType: "youtube_overlap" }
    },
    {
      label: "TikTok trend crossover",
      query: `${base} ${input.niche} tiktok trend crossover`,
      lens: "present",
      intent: "tiktok_crossover",
      score: 50,
      riskLevel: "low",
      extraMetadata: { surface: "web_search", trendType: "tiktok_crossover" }
    },
    {
      label: "Reddit rising topic",
      query: `${base} ${input.niche} site:reddit.com rising`,
      lens: "present",
      intent: "reddit_rising",
      score: 49,
      riskLevel: "low",
      extraMetadata: { surface: "reddit", trendType: "reddit_rising" }
    },
    {
      label: "News cycle timing",
      query: `${base} ${input.niche} news coverage trend`,
      lens: "present",
      intent: "news_cycle",
      score: 47,
      riskLevel: "low",
      extraMetadata: { surface: "web_search", trendType: "news_cycle" }
    },
    {
      label: "Historical interest spike",
      query: `${base} ${hints.past[1]} interest over time`,
      lens: "past",
      intent: "historical_spike",
      score: 46,
      riskLevel: "low",
      extraMetadata: { surface: "google_trends", trendType: "historical_spike" }
    }
  ];

  const platformPlans = angles.trendPlatforms.map((platform, index) => ({
    label: `Platform trend: ${platform}`,
    query: `${base} ${platform}`,
    lens: (index < 2 ? "present" : "future") as "present" | "future",
    intent: "niche_platform_trend",
    score: 55 - index,
    riskLevel: "low" as const,
    extraMetadata: { surface: "google_trends", trendType: "niche_platform", platform }
  }));

  const nichePlans = buildNicheQueryPlans(base, input.niche, (angle, lens) => ({
    label: `Trend ${lens}: ${angle}`,
    querySuffix: `${angle} trend`,
    intent: "niche_trend_angle",
    score: lens === "present" ? 52 : lens === "past" ? 49 : 47,
    riskLevel: "low",
    extraMetadata: {
      surface: lens === "future" ? "web_search" : "google_trends",
      trendType: "niche_angle",
      nicheAngle: angle
    }
  }));

  return [...corePlans, ...platformPlans, ...nichePlans];
}

function buildTrendSourceUrl(plan: DiscoveryQueryPlan) {
  if (plan.extraMetadata?.surface === "google_trends") {
    const query = plan.query;
    return `https://trends.google.com/trends/explore?q=${encodeURIComponent(query)}`;
  }

  if (plan.extraMetadata?.surface === "reddit") {
    return `https://www.reddit.com/search/?q=${encodeURIComponent(plan.query)}`;
  }

  return `https://www.google.com/search?q=${encodeURIComponent(plan.query)}`;
}

export const trendScannerProvider: MediaBeastProvider = {
  descriptor: {
    id: "trend-scanner",
    name: "Trend Scanner",
    description:
      "Cross-surface trend discovery for search momentum, rising queries, breakout topics, platform crossovers, seasonal resurgence and weak future signals.",
    enabled: true,
    capabilities: {
      supportsImages: false,
      supportsVideos: false,
      supportsAudio: false,
      supportsDocuments: false,
      supportsDateFilters: true,
      supportsLicenseMetadata: false,
      discoveryOnly: true,
      importSupported: false,
      requiresApiKey: false,
      setupInstructions:
        "Use trend URLs to plan editorial calendars and topic timing. Trends inform scripts; they are not media assets."
    },
    riskNotes: [
      "Trend data is editorial intelligence, not a license to reuse third-party content.",
      "Rising topics can be volatile, misleading or region-specific.",
      "Validate trend signals against multiple sources before committing production slots.",
      "Do not chase trends that require infringing clips or sensational unverified claims.",
      "Cross-platform trend overlap does not guarantee audience fit for your channel."
    ]
  },
  buildQueries(input: MediaBeastSearchQuery) {
    return limitQueryPlans(buildTrendScannerPlans(input)).map((plan) => plan.query);
  },
  async searchCandidates(input: MediaBeastSearchQuery) {
    return mapQueryPlansToCandidates(
      "trend-scanner",
      buildTrendScannerPlans(input),
      (plan) =>
        createDiscoveryCandidate({
          providerId: "trend-scanner",
          plan,
          title: `Trend ${plan.lens} signal: ${plan.label}`,
          sourceUrl: buildTrendSourceUrl(plan),
          reasons: [
            `Captures ${plan.lens} demand signals to time topics before they peak.`,
            `Intent '${plan.intent}' supports editorial planning without media import.`,
            "Low-risk intelligence layer for past resurgence and future breakout detection.",
            "Multi-platform crossover queries reveal where niche interest is accelerating."
          ],
          warnings: [
            "Discovery-only: trend surfaces do not provide reusable media.",
            "Regional and platform-specific trends may not transfer to your audience.",
            "Cross-check weak future signals with archive and community providers.",
            "News-cycle timing can create short windows — validate before scheduling."
          ],
          metadata: {
            sourcePackHint: input.niche,
            trendType:
              typeof plan.extraMetadata?.trendType === "string"
                ? plan.extraMetadata.trendType
                : "general",
            signalStrength:
              typeof plan.extraMetadata?.signalStrength === "string"
                ? plan.extraMetadata.signalStrength
                : plan.lens === "future"
                  ? "emerging"
                  : "confirmed"
          }
        }),
      input.maxCandidates ?? DEFAULT_PROVIDER_MAX_CANDIDATES
    );
  }
};