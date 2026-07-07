import {
  buildGoogleSearchUrl,
  buildKeywordBase,
  buildNicheQueryPlans,
  buildSubstantiveQuery,
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

function buildCommunitySourceUrl(plan: DiscoveryQueryPlan) {
  const platform = plan.extraMetadata?.platform;

  if (platform === "reddit" && !plan.query.includes("site:reddit.com")) {
    return `https://www.reddit.com/search/?q=${encodeURIComponent(plan.query)}&type=link`;
  }

  return buildGoogleSearchUrl(plan.query);
}

function buildCommunityMinerPlans(input: MediaBeastSearchQuery): DiscoveryQueryPlan[] {
  const base = buildKeywordBase(input);
  const hints = getNicheTemporalHints(input.niche);
  const angles = getNicheDiscoveryAngles(input.niche);

  const corePlans: DiscoveryQueryPlan[] = [
    {
      label: "Reddit niche community",
      query: buildSubstantiveQuery({
        phrase: base,
        site: "reddit.com",
        angle: "sourced discussion thread",
        excludeSearchPages: true,
        extraTerms: ["inurl:comments"]
      }),
      lens: "present",
      intent: "reddit_community",
      score: 55,
      extraMetadata: { communityType: "reddit", platform: "google" }
    },
    {
      label: "Reddit deep thread mining",
      query: buildSubstantiveQuery({
        phrase: base,
        site: "reddit.com",
        angle: "deep thread with sources cited",
        excludeSearchPages: true,
        extraTerms: ["inurl:comments"]
      }),
      lens: "present",
      intent: "reddit_deep",
      score: 54,
      extraMetadata: { communityType: "reddit_deep", platform: "google" }
    },
    {
      label: "Discord server discovery",
      query: buildSubstantiveQuery({
        phrase: base,
        site: "disboard.org",
        angle: "community server listing",
        niche: input.niche,
        temporal: "present"
      }),
      lens: "present",
      intent: "discord_community",
      score: 52,
      extraMetadata: { communityType: "discord", platform: "google" }
    },
    {
      label: "Facebook group lead",
      query: buildSubstantiveQuery({
        phrase: base,
        site: "facebook.com/groups",
        angle: "community discussion archive",
        niche: input.niche,
        temporal: "present"
      }),
      lens: "present",
      intent: "facebook_group",
      score: 50,
      extraMetadata: { communityType: "facebook_group", platform: "google" }
    },
    {
      label: "Telegram channel signal",
      query: buildSubstantiveQuery({
        phrase: base,
        angle: "telegram channel public archive",
        niche: input.niche,
        temporal: "present"
      }),
      lens: "present",
      intent: "telegram_channel",
      score: 49,
      extraMetadata: { communityType: "telegram", platform: "google" }
    },
    {
      label: "Quora discourse lead",
      query: buildSubstantiveQuery({
        phrase: base,
        site: "quora.com",
        angle: "answered question with sources",
        niche: input.niche,
        temporal: "present",
        excludeSearchPages: true
      }),
      lens: "present",
      intent: "quora_discourse",
      score: 48,
      extraMetadata: { communityType: "quora", platform: "google" }
    },
    {
      label: "Stack Exchange specialist",
      query: buildSubstantiveQuery({
        phrase: base,
        site: "stackexchange.com",
        angle: "accepted answer sources",
        niche: input.niche,
        temporal: "present",
        excludeSearchPages: true
      }),
      lens: "present",
      intent: "stack_exchange",
      score: 47,
      extraMetadata: { communityType: "stack_exchange", platform: "google" }
    },
    {
      label: "Fandom wiki deep dive",
      query: buildSubstantiveQuery({
        phrase: base,
        site: "fandom.com",
        angle: "wiki article references",
        niche: input.niche,
        temporal: "present",
        excludeSearchPages: true
      }),
      lens: "present",
      intent: "fandom_wiki",
      score: 46,
      extraMetadata: { communityType: "fandom_wiki", platform: "google" }
    },
    {
      label: "Legacy fan community archive",
      query: buildSubstantiveQuery({
        phrase: base,
        angle: `${hints.past[0]} fan community archive thread`,
        niche: input.niche,
        temporal: "past",
        excludeSearchPages: true
      }),
      lens: "past",
      intent: "legacy_fandom",
      score: 53,
      extraMetadata: { communityType: "fandom_archive", platform: "google" }
    },
    {
      label: "Archived mailing list",
      query: buildSubstantiveQuery({
        phrase: base,
        site: "google.com/groups",
        angle: "mailing list archive discussion",
        niche: input.niche,
        temporal: "past",
        excludeSearchPages: true
      }),
      lens: "past",
      intent: "mailing_list",
      score: 51,
      extraMetadata: { communityType: "mailing_list", platform: "google" }
    },
    {
      label: "Emerging micro-community",
      query: buildSubstantiveQuery({
        phrase: base,
        angle: `${hints.future[0]} community discussion`,
        niche: input.niche,
        temporal: "future",
        excludeSearchPages: true
      }),
      lens: "future",
      intent: "emerging_community",
      score: 46,
      extraMetadata: {
        communityType: "emerging",
        platform: "multi",
        signalStrength: "weak"
      }
    },
    {
      label: "Cross-community language mining",
      query: buildSubstantiveQuery({
        phrase: base,
        angle: "community discussion terminology sources",
        niche: input.niche,
        temporal: "present",
        excludeSearchPages: true
      }),
      lens: "present",
      intent: "language_mining",
      score: 51,
      extraMetadata: { communityType: "cross_platform", platform: "multi" }
    },
    {
      label: "Controversy angle mapping",
      query: buildSubstantiveQuery({
        phrase: base,
        angle: "community debate controversy sourced",
        niche: input.niche,
        temporal: "present",
        excludeSearchPages: true
      }),
      lens: "present",
      intent: "controversy_mapping",
      score: 45,
      extraMetadata: { communityType: "debate", platform: "multi" }
    },
    {
      label: "Question and myth mining",
      query: buildSubstantiveQuery({
        phrase: base,
        angle: "FAQ myths misconceptions explained",
        niche: input.niche,
        temporal: "present",
        excludeSearchPages: true
      }),
      lens: "present",
      intent: "myth_mining",
      score: 48,
      extraMetadata: { communityType: "faq", platform: "multi" }
    }
  ];

  const communityPlans = angles.communityKeywords.map((keyword, index) => {
    const queryParts: Parameters<typeof buildSubstantiveQuery>[0] = {
      phrase: base,
      angle: keyword,
      niche: input.niche,
      temporal: index < 2 ? "past" : "present",
      excludeSearchPages: keyword.includes("reddit")
    };
    if (keyword.includes("reddit")) {
      queryParts.extraTerms = ["inurl:comments"];
    }

    return {
    label: `Community: ${keyword}`,
    query: buildSubstantiveQuery(queryParts),
    lens: (index < 2 ? "past" : index < 4 ? "present" : "future") as
      | "past"
      | "present"
      | "future",
    intent: "niche_community",
    score: 52 - index,
    extraMetadata: {
      communityType: "niche_keyword",
      platform: keyword.includes("reddit") ? "reddit" : "multi",
      communityKeyword: keyword
    }
  };
  });

  const nichePlans = buildNicheQueryPlans(base, input.niche, (angle, lens) => ({
    label: `Community ${lens}: ${angle}`,
    querySuffix: `${angle} community discussion`,
    intent: "niche_community_angle",
    score: lens === "present" ? 50 : lens === "past" ? 48 : 43,
    extraMetadata: { communityType: "niche_angle", platform: "multi", nicheAngle: angle }
  }));

  return [...corePlans, ...communityPlans, ...nichePlans];
}

export const communityMinerProvider: MediaBeastProvider = {
  descriptor: {
    id: "community-miner",
    name: "Community Miner",
    description:
      "Multi-platform community discovery for audience language, controversy angles, fandom archives, deep Reddit threads and emerging micro-community signals.",
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
        "Use generated community search URLs for research. Respect privacy, group rules and platform terms before engaging or quoting."
    },
    riskNotes: [
      "Community content is user-generated and rarely rights-clear.",
      "Do not scrape, bulk-export or auto-import posts, images or videos from groups.",
      "Use for language, myths, questions, controversy mapping and source leads only.",
      "Private communities require explicit permission before referencing or quoting.",
      "Controversy mapping is editorial research — avoid defamatory framing in scripts."
    ]
  },
  buildQueries(input: MediaBeastSearchQuery) {
    return limitQueryPlans(buildCommunityMinerPlans(input)).map((plan) => plan.query);
  },
  async searchCandidates(input: MediaBeastSearchQuery) {
    return mapQueryPlansToCandidates(
      "community-miner",
      buildCommunityMinerPlans(input),
      (plan) =>
        createDiscoveryCandidate({
          providerId: "community-miner",
          plan,
          title: `Community ${plan.lens} lead: ${plan.label}`,
          sourceUrl: buildCommunitySourceUrl(plan),
          reasons: [
            `Maps ${plan.lens} audience conversations, terminology and controversy angles.`,
            `Intent '${plan.intent}' reveals what communities care about beyond mainstream search.`,
            "Strong complement to trend-scanner for editorial voice and hook calibration.",
            "Deep thread and niche community keywords surface obscure discourse missed by generic search."
          ],
          warnings: [
            "Discovery-only: no scraping of posts, media or private group content.",
            "Community quotes require ethical review and often explicit permission.",
            "Do not treat uploaded community media as reusable production assets.",
            "Controversy angles need fact-checking before inclusion in narration."
          ],
          metadata: {
            sourcePackHint: input.niche,
            substantiveQuery: true,
            communityType:
              typeof plan.extraMetadata?.communityType === "string"
                ? plan.extraMetadata.communityType
                : "general",
            platform:
              typeof plan.extraMetadata?.platform === "string"
                ? plan.extraMetadata.platform
                : "multi"
          }
        }),
      input.maxCandidates ?? DEFAULT_PROVIDER_MAX_CANDIDATES
    );
  }
};