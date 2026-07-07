import {
  buildGoogleSearchUrl,
  buildKeywordBase,
  buildNicheQueryPlans,
  buildRedditThreadDiscoveryUrl,
  buildSubstantiveQuery,
  createDiscoveryCandidate,
  DEFAULT_PROVIDER_MAX_CANDIDATES,
  getNicheDiscoveryAngles,
  limitQueryPlans,
  mapQueryPlansToCandidates,
  type DiscoveryQueryPlan
} from "./provider-utils.js";
import type {
  MediaBeastProvider,
  MediaBeastSearchQuery
} from "./types.js";

function buildRedditPlans(input: MediaBeastSearchQuery): DiscoveryQueryPlan[] {
  const base = buildKeywordBase(input);
  const angles = getNicheDiscoveryAngles(input.niche);

  const corePlans: DiscoveryQueryPlan[] = [
    {
      label: "Deep comment threads",
      query: buildSubstantiveQuery({
        phrase: base,
        site: "reddit.com",
        angle: "sourced discussion thread",
        excludeSearchPages: true,
        extraTerms: ["inurl:comments"]
      }),
      lens: "present",
      intent: "comment_threads",
      score: 58,
      extraMetadata: { contentTarget: "forum_thread", discoveryVia: "google" }
    },
    {
      label: "Unresolved mysteries community",
      query: buildSubstantiveQuery({
        phrase: base,
        site: "reddit.com/r/UnresolvedMysteries",
        angle: "case discussion sources",
        excludeSearchPages: true,
        extraTerms: ["inurl:comments"]
      }),
      lens: "present",
      intent: "unsolved_community",
      score: 56,
      extraMetadata: { contentTarget: "forum_thread", subreddit: "UnresolvedMysteries" }
    },
    {
      label: "AskHistorians sourced answers",
      query: buildSubstantiveQuery({
        phrase: base,
        site: "reddit.com/r/AskHistorians",
        angle: "historical sources cited",
        excludeSearchPages: true,
        extraTerms: ["inurl:comments"]
      }),
      lens: "past",
      intent: "historians_sources",
      score: 55,
      extraMetadata: { contentTarget: "forum_thread", subreddit: "AskHistorians" }
    },
    {
      label: "Explainer and sources thread",
      query: buildSubstantiveQuery({
        phrase: base,
        site: "reddit.com",
        angle: "explained with sources",
        temporal: "present",
        excludeSearchPages: true,
        extraTerms: ["inurl:comments"]
      }),
      lens: "present",
      intent: "explainer_thread",
      score: 52,
      extraMetadata: { contentTarget: "forum_thread" }
    }
  ];

  const communityPlans = angles.communityKeywords.slice(0, 4).map((keyword, index) => ({
    label: `Community: ${keyword}`,
    query: buildSubstantiveQuery({
      phrase: base,
      angle: keyword,
      site: "reddit.com",
      excludeSearchPages: true,
      extraTerms: ["inurl:comments"]
    }),
    lens: (index < 2 ? "present" : "past") as "present" | "past",
    intent: "niche_community",
    score: 50 - index,
    extraMetadata: { communityKeyword: keyword, contentTarget: "forum_thread" }
  }));

  const nichePlans = buildNicheQueryPlans(base, input.niche, (angle, lens) => ({
    label: `Reddit ${lens}: ${angle}`,
    querySuffix: `${angle} reddit thread sources`,
    intent: "niche_reddit_angle",
    score: lens === "past" ? 48 : lens === "present" ? 46 : 42,
    extraMetadata: { nicheAngle: angle, contentTarget: "forum_thread" }
  }));

  return [...corePlans, ...communityPlans, ...nichePlans];
}

function buildRedditSourceUrl(plan: DiscoveryQueryPlan): string {
  if (plan.extraMetadata?.discoveryVia === "google" || plan.query.includes("site:reddit.com")) {
    return buildGoogleSearchUrl(plan.query);
  }

  return `https://www.reddit.com/search/?q=${encodeURIComponent(plan.query)}&type=link`;
}

export const redditProvider: MediaBeastProvider = {
  descriptor: {
    id: "reddit",
    name: "Reddit Discovery",
    description:
      "Discovery-only provider for deep comment threads, sourced discussions and niche community context.",
    enabled: true,
    capabilities: {
      supportsImages: true,
      supportsVideos: true,
      supportsAudio: false,
      supportsDocuments: false,
      supportsDateFilters: true,
      supportsLicenseMetadata: false,
      discoveryOnly: true,
      importSupported: false,
      requiresApiKey: false,
      setupInstructions:
        "Use generated queries to find comment threads with sources. Do not copy user posts or media without rights and consent."
    },
    riskNotes: [
      "Reddit is usually user-generated and rights are unclear.",
      "Use for trend/context discovery, not automatic media import.",
      "Respect subreddit rules, privacy, deleted content and platform terms."
    ]
  },
  buildQueries(input: MediaBeastSearchQuery) {
    return limitQueryPlans(buildRedditPlans(input)).map((plan) => plan.query);
  },
  async searchCandidates(input: MediaBeastSearchQuery) {
    const base = buildKeywordBase(input);

    return mapQueryPlansToCandidates(
      "reddit",
      buildRedditPlans(input),
      (plan) =>
        createDiscoveryCandidate({
          providerId: "reddit",
          plan,
          title: `Reddit ${plan.lens} lead: ${plan.label}`,
          sourceUrl: buildRedditSourceUrl(plan),
          previewUrl: buildRedditThreadDiscoveryUrl(base),
          reasons: [
            "Queries com site:reddit.com e inurl:comments priorizam threads com texto real.",
            "Subreddits especializados costumam citar fontes e datas verificaveis.",
            `Intent '${plan.intent}' evita paginas de busca vazias do Reddit.`
          ],
          warnings: [
            "Discovery-only: no auto-import and no user-content scraping.",
            "Do not treat comments or uploaded media as reusable assets.",
            "Validacao leve penaliza superficies de busca sem thread fixa."
          ],
          metadata: {
            sourcePackHint: input.niche,
            substantiveQuery: true,
            communityContext: true,
            contentTarget: "forum_thread"
          }
        }),
      input.maxCandidates ?? DEFAULT_PROVIDER_MAX_CANDIDATES
    );
  }
};