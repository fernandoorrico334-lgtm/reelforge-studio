import {
  buildGoogleSearchUrl,
  buildKeywordPhrase,
  buildNicheQueryPlans,
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

const SUBSTANTIVE_SURFACES = [
  { site: "en.wikipedia.org", angle: "overview article", intent: "wikipedia_article", score: 62 },
  { site: "archive.org/details", angle: "archived media item", intent: "archive_item", score: 60 },
  { site: "britannica.com", angle: "encyclopedia entry", intent: "encyclopedia", score: 55 },
  { site: "pbs.org", angle: "documentary feature", intent: "documentary_article", score: 54 },
  { site: "bbc.com", angle: "news archive report", intent: "news_archive", score: 53 }
];

function buildGenericWebPlans(input: MediaBeastSearchQuery): DiscoveryQueryPlan[] {
  const base = buildKeywordPhrase(input).replace(/^"|"$/g, "");
  const angles = getNicheDiscoveryAngles(input.niche);

  const surfacePlans: DiscoveryQueryPlan[] = SUBSTANTIVE_SURFACES.map((surface, index) => ({
    label: `Substantive: ${surface.site}`,
    query: buildSubstantiveQuery({
      phrase: base,
      site: surface.site,
      angle: surface.angle,
      niche: input.niche,
      temporal: index < 2 ? "past" : "present"
    }),
    lens: index < 2 ? "past" : "present",
    intent: surface.intent,
    score: surface.score - index,
    extraMetadata: { substantiveUrl: true, targetSite: surface.site }
  }));

  const contextPlans: DiscoveryQueryPlan[] = [
    {
      label: "Long-form article trail",
      query: buildSubstantiveQuery({
        phrase: base,
        angle: "in-depth article documentary",
        niche: input.niche,
        temporal: "past",
        excludeSearchPages: true,
        extraTerms: ["-inurl:tag -inurl:category"]
      }),
      lens: "past",
      intent: "article_trail",
      score: 52,
      extraMetadata: { substantiveUrl: false, contentTarget: "article" }
    },
    {
      label: "Primary source document",
      query: buildSubstantiveQuery({
        phrase: base,
        filetype: "pdf",
        angle: "primary source report",
        niche: input.niche,
        temporal: "past"
      }),
      lens: "past",
      intent: "primary_source",
      score: 51,
      kind: "document",
      extraMetadata: { substantiveUrl: false, contentTarget: "document" }
    },
    {
      label: "Community deep thread",
      query: buildSubstantiveQuery({
        phrase: base,
        site: "reddit.com",
        angle: "discussion thread sources",
        excludeSearchPages: true,
        extraTerms: ["inurl:comments"]
      }),
      lens: "present",
      intent: "community_thread",
      score: 48,
      extraMetadata: { substantiveUrl: false, contentTarget: "forum_thread" }
    }
  ];

  const nichePlans = buildNicheQueryPlans(base, input.niche, (angle, lens) => ({
    label: `Web ${lens}: ${angle}`,
    querySuffix: `${angle} source article`,
    intent: "niche_article_angle",
    score: lens === "past" ? 49 : lens === "present" ? 46 : 42,
    extraMetadata: { nicheAngle: angle, contentTarget: "article" }
  }));

  const forumPlans = angles.forumSurfaces.slice(0, 4).map((surface, index) => ({
    label: `Forum surface: ${surface}`,
    query: surface.startsWith("site:")
      ? buildSubstantiveQuery({
          phrase: base,
          site: surface.replace("site:", ""),
          angle: "archived discussion",
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
    lens: "past" as const,
    intent: "forum_surface",
    score: 50 - index,
    extraMetadata: { forumSurface: surface, contentTarget: "forum_thread" }
  }));

  return [...surfacePlans, ...contextPlans, ...forumPlans, ...nichePlans];
}

export const genericWebProvider: MediaBeastProvider = {
  descriptor: {
    id: "generic-web",
    name: "Generic Web Source Leads",
    description:
      "Substantive web discovery for Wikipedia, archive items, long-form articles, PDF primary sources and deep community threads.",
    enabled: true,
    capabilities: {
      supportsImages: true,
      supportsVideos: true,
      supportsAudio: true,
      supportsDocuments: true,
      supportsDateFilters: false,
      supportsLicenseMetadata: false,
      discoveryOnly: true,
      importSupported: false,
      requiresApiKey: false,
      setupInstructions:
        "Prioritize pages with real article text or archive items. Import only after manual permission/license review."
    },
    riskNotes: [
      "Generic websites rarely expose reliable reuse terms.",
      "Forum posts and fan uploads should be treated as high-risk by default.",
      "Use for research, not automatic download."
    ]
  },
  buildQueries(input: MediaBeastSearchQuery) {
    return limitQueryPlans(buildGenericWebPlans(input)).map((plan) => plan.query);
  },
  async searchCandidates(input: MediaBeastSearchQuery) {
    return mapQueryPlansToCandidates(
      "generic-web",
      buildGenericWebPlans(input),
      (plan) =>
        createDiscoveryCandidate({
          providerId: "generic-web",
          plan,
          title: `Web ${plan.lens} lead: ${plan.label}`,
          sourceUrl: buildGoogleSearchUrl(plan.query),
          reasons: [
            `Query substantiva com operadores para superficies com texto real (${plan.intent}).`,
            "Prioriza paginas de artigo, arquivo e thread em vez de indices de busca vazios.",
            "Filtros -inurl:search ajudam a evitar landing pages sem conteudo fixo."
          ],
          warnings: [
            "Discovery-only: no auto-download.",
            "Unknown rights require manual replacement or permission.",
            "Google pode ainda retornar superficie de busca — validacao leve ajusta o score."
          ],
          metadata: {
            sourcePackHint: input.niche,
            substantiveQuery: true,
            contentTarget:
              typeof plan.extraMetadata?.contentTarget === "string"
                ? plan.extraMetadata.contentTarget
                : "article"
          }
        }),
      input.maxCandidates ?? DEFAULT_PROVIDER_MAX_CANDIDATES
    );
  }
};