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

const FORUM_SURFACES = [
  "site:archive.org",
  "site:web.archive.org",
  "forum archive",
  "phpbb archive",
  "vbulletin thread",
  "blogspot archive",
  "livejournal archive",
  "geocities mirror"
];

function buildOldForumPlans(input: MediaBeastSearchQuery): DiscoveryQueryPlan[] {
  const base = buildKeywordBase(input);
  const hints = getNicheTemporalHints(input.niche);
  const angles = getNicheDiscoveryAngles(input.niche);

  const corePlans: DiscoveryQueryPlan[] = [
    {
      label: "Wayback forum thread",
      query: buildSubstantiveQuery({
        phrase: base,
        site: "web.archive.org",
        angle: "forum thread discussion",
        niche: input.niche,
        temporal: "past",
        excludeSearchPages: true
      }),
      lens: "past",
      intent: "wayback_thread",
      score: 57,
      extraMetadata: { forumEra: "archived", surface: "wayback" }
    },
    {
      label: "Internet Archive forum capture",
      query: buildSubstantiveQuery({
        phrase: base,
        site: "archive.org",
        angle: `${hints.past[0]} forum capture`,
        temporal: "past",
        excludeSearchPages: true
      }),
      lens: "past",
      intent: "archive_forum",
      score: 56,
      extraMetadata: { forumEra: "archived", surface: "internet_archive" }
    },
    {
      label: "Legacy community discussion",
      query: buildSubstantiveQuery({
        phrase: base,
        angle: `${FORUM_SURFACES[2]} 2000s thread`,
        niche: input.niche,
        temporal: "past",
        excludeSearchPages: true
      }),
      lens: "past",
      intent: "legacy_discussion",
      score: 54,
      extraMetadata: { forumEra: "legacy", surface: "google_archive" }
    },
    {
      label: "Historical source trail",
      query: buildSubstantiveQuery({
        phrase: base,
        angle: `${hints.past[1]} ${FORUM_SURFACES[3]} sourced`,
        niche: input.niche,
        temporal: "past",
        excludeSearchPages: true
      }),
      lens: "past",
      intent: "source_trail",
      score: 53,
      extraMetadata: { forumEra: "historical", surface: "phpbb" }
    },
    {
      label: "Niche blog archive",
      query: buildSubstantiveQuery({
        phrase: base,
        site: "blogspot.com",
        angle: "deep dive article archive",
        niche: input.niche,
        temporal: "past",
        excludeSearchPages: true
      }),
      lens: "past",
      intent: "blog_archive",
      score: 52,
      extraMetadata: { forumEra: "blog", surface: "blogspot" }
    },
    {
      label: "Early web community mirror",
      query: buildSubstantiveQuery({
        phrase: base,
        angle: `${FORUM_SURFACES[7]} fan site archive`,
        niche: input.niche,
        temporal: "past",
        excludeSearchPages: true
      }),
      lens: "past",
      intent: "early_web_mirror",
      score: 50,
      extraMetadata: { forumEra: "early_web", surface: "geocities" }
    },
    {
      label: "Personal journal archive",
      query: buildSubstantiveQuery({
        phrase: base,
        site: "livejournal.com",
        angle: "eyewitness account archive",
        niche: input.niche,
        temporal: "past",
        excludeSearchPages: true
      }),
      lens: "past",
      intent: "journal_archive",
      score: 48,
      extraMetadata: { forumEra: "personal", surface: "livejournal" }
    },
    {
      label: "Active niche forum",
      query: buildSubstantiveQuery({
        phrase: base,
        angle: `${hints.present[0]} forum discussion thread`,
        niche: input.niche,
        temporal: "present",
        excludeSearchPages: true
      }),
      lens: "present",
      intent: "active_forum",
      score: 49,
      extraMetadata: { forumEra: "current", surface: "active" }
    },
    {
      label: "Specialist board lead",
      query: buildSubstantiveQuery({
        phrase: base,
        angle: "specialist forum board thread sources",
        niche: input.niche,
        temporal: "present",
        excludeSearchPages: true
      }),
      lens: "present",
      intent: "specialist_board",
      score: 47,
      extraMetadata: { forumEra: "current", surface: "specialist" }
    },
    {
      label: "Emerging community thread",
      query: buildSubstantiveQuery({
        phrase: base,
        angle: `${hints.future[0]} forum thread`,
        niche: input.niche,
        temporal: "future",
        excludeSearchPages: true
      }),
      lens: "future",
      intent: "emerging_thread",
      score: 44,
      extraMetadata: { forumEra: "emerging", signalStrength: "weak" }
    },
    {
      label: "New niche blog signal",
      query: buildSubstantiveQuery({
        phrase: base,
        angle: `${hints.future[1]} blog analysis article`,
        niche: input.niche,
        temporal: "future",
        excludeSearchPages: true
      }),
      lens: "future",
      intent: "blog_signal",
      score: 42,
      extraMetadata: { forumEra: "emerging", surface: "blog", signalStrength: "weak" }
    }
  ];

  const surfacePlans = angles.forumSurfaces.map((surface, index) => ({
    label: `Forum surface: ${surface}`,
    query: surface.startsWith("site:")
      ? buildSubstantiveQuery({
          phrase: base,
          site: surface.replace("site:", ""),
          angle: "archived thread",
          temporal: "past",
          excludeSearchPages: true
        })
      : buildSubstantiveQuery({
          phrase: base,
          angle: `${surface} thread`,
          niche: input.niche,
          temporal: "past",
          excludeSearchPages: true
        }),
    lens: (index < 3 ? "past" : index < 5 ? "present" : "future") as
      | "past"
      | "present"
      | "future",
    intent: "niche_forum_surface",
    score: 55 - index,
    extraMetadata: { forumEra: index < 3 ? "archived" : "current", surface }
  }));

  const nichePlans = buildNicheQueryPlans(base, input.niche, (angle, lens) => ({
    label: `Forum ${lens}: ${angle}`,
    querySuffix: `${angle} forum thread`,
    intent: "niche_forum_angle",
    score: lens === "past" ? 51 : lens === "present" ? 46 : 41,
    extraMetadata: { forumEra: lens, nicheAngle: angle }
  }));

  return [...corePlans, ...surfacePlans, ...nichePlans];
}

export const oldForumsProvider: MediaBeastProvider = {
  descriptor: {
    id: "old-forums",
    name: "Old Forums Discovery",
    description:
      "Historical forum, blog and community-archive discovery via Wayback, Internet Archive, legacy boards and niche specialist surfaces.",
    enabled: true,
    capabilities: {
      supportsImages: true,
      supportsVideos: false,
      supportsAudio: false,
      supportsDocuments: true,
      supportsDateFilters: true,
      supportsLicenseMetadata: false,
      discoveryOnly: true,
      importSupported: false,
      requiresApiKey: false,
      setupInstructions:
        "Use generated queries to locate archived threads and source trails. Quote or import only with verified rights and ethical review."
    },
    riskNotes: [
      "Forum posts are user-generated and rarely carry reusable media rights.",
      "Archived threads may contain outdated, harmful or unverified claims.",
      "Use for research, terminology, timelines and source discovery only.",
      "Do not scrape private boards or bypass access controls.",
      "Blog and journal archives may include personal data — handle ethically."
    ]
  },
  buildQueries(input: MediaBeastSearchQuery) {
    return limitQueryPlans(buildOldForumPlans(input)).map((plan) => plan.query);
  },
  async searchCandidates(input: MediaBeastSearchQuery) {
    return mapQueryPlansToCandidates(
      "old-forums",
      buildOldForumPlans(input),
      (plan) =>
        createDiscoveryCandidate({
          providerId: "old-forums",
          plan,
          title: `Forum ${plan.lens} lead: ${plan.label}`,
          sourceUrl: buildGoogleSearchUrl(plan.query),
          reasons: [
            `Surfaces ${plan.lens} community knowledge, terminology and historical context.`,
            `Intent '${plan.intent}' helps uncover obscure leads missed by mainstream providers.`,
            "Especially strong for true crime, history, sports nostalgia and niche fandom research.",
            "Niche forum surfaces expose deep community trails from the 1990s–2010s web."
          ],
          warnings: [
            "Discovery-only: no automated scraping of forum posts or attachments.",
            "Treat user-uploaded media as high-risk until manually verified.",
            "Separate speculation from sourced facts in editorial scripts.",
            "Archived personal journals require extra ethical review before quoting."
          ],
          metadata: {
            sourcePackHint: input.niche,
            forumSurface:
              typeof plan.extraMetadata?.surface === "string"
                ? plan.extraMetadata.surface
                : "google_archive"
          }
        }),
      input.maxCandidates ?? DEFAULT_PROVIDER_MAX_CANDIDATES
    );
  }
};