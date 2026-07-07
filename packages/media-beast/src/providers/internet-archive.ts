import {
  buildArchiveOrgSearchUrl,
  buildGoogleSearchUrl,
  buildKeywordBase,
  buildSubstantiveQuery,
  createDiscoveryCandidate,
  limitQueryPlans,
  mapQueryPlansToCandidates,
  type DiscoveryQueryPlan
} from "./provider-utils.js";
import type {
  MediaBeastProvider,
  MediaBeastSearchQuery
} from "./types.js";

function buildArchivePlans(input: MediaBeastSearchQuery): DiscoveryQueryPlan[] {
  const base = buildKeywordBase(input);

  return [
    {
      label: "Archive film and video items",
      query: `${quoteArchiveQuery(base)} AND mediatype:movies`,
      lens: "past",
      intent: "archive_film",
      score: 64,
      kind: "video",
      licenseStatus: "unknown",
      extraMetadata: { mediatype: "movies", archiveSurface: "search" }
    },
    {
      label: "Historical image collections",
      query: `${quoteArchiveQuery(base)} AND mediatype:image`,
      lens: "past",
      intent: "archive_image",
      score: 62,
      kind: "image",
      extraMetadata: { mediatype: "image", archiveSurface: "search" }
    },
    {
      label: "Document and text scans",
      query: `${quoteArchiveQuery(base)} AND mediatype:texts`,
      lens: "past",
      intent: "archive_text",
      score: 60,
      kind: "document",
      extraMetadata: { mediatype: "texts", archiveSurface: "search" }
    },
    {
      label: "Audio and radio archive",
      query: `${quoteArchiveQuery(base)} AND mediatype:audio`,
      lens: "past",
      intent: "archive_audio",
      score: 58,
      kind: "audio",
      extraMetadata: { mediatype: "audio", archiveSurface: "search" }
    },
    {
      label: "Public domain collection",
      query: `${quoteArchiveQuery(base)} collection "public domain"`,
      lens: "past",
      intent: "public_domain_collection",
      score: 57,
      licenseStatus: "public_domain",
      extraMetadata: { mediatype: "movies", archiveSurface: "search" }
    },
    {
      label: "Deep item discovery via Google",
      query: buildSubstantiveQuery({
        phrase: base,
        site: "archive.org/details",
        angle: "documentary footage scan",
        niche: input.niche,
        temporal: "past"
      }),
      lens: "past",
      intent: "archive_item_page",
      score: 66,
      extraMetadata: { substantiveUrl: true, archiveSurface: "details" }
    },
    {
      label: "News and TV archive",
      query: `${quoteArchiveQuery(base)} AND mediatype:movies AND collection:news`,
      lens: "past",
      intent: "news_archive",
      score: 56,
      kind: "video",
      extraMetadata: { mediatype: "movies", archiveSurface: "search" }
    }
  ];
}

function quoteArchiveQuery(text: string): string {
  const trimmed = text.trim();
  return trimmed.includes(" ") ? `"${trimmed}"` : trimmed;
}

function buildArchiveSourceUrl(plan: DiscoveryQueryPlan): string {
  if (plan.extraMetadata?.archiveSurface === "details") {
    return buildGoogleSearchUrl(plan.query);
  }

  const mediatype =
    typeof plan.extraMetadata?.mediatype === "string"
      ? plan.extraMetadata.mediatype
      : undefined;

  return buildArchiveOrgSearchUrl(plan.query, mediatype ? { mediatype } : undefined);
}

export const internetArchiveProvider: MediaBeastProvider = {
  descriptor: {
    id: "internet-archive",
    name: "Internet Archive Candidate Search",
    description:
      "Candidate-first planner for archive materials with mediatype filters and deep /details item discovery.",
    enabled: true,
    capabilities: {
      supportsImages: true,
      supportsVideos: true,
      supportsAudio: true,
      supportsDocuments: true,
      supportsDateFilters: true,
      supportsLicenseMetadata: true,
      discoveryOnly: false,
      importSupported: false,
      requiresApiKey: false,
      setupInstructions:
        "Review item pages, collection terms and file metadata manually before importing local copies."
    },
    riskNotes: [
      "Archive availability does not always mean commercial reuse rights.",
      "Some collections are public domain; others are restricted or editorial-only.",
      "Keep original source URL and license notes with every imported asset."
    ]
  },
  buildQueries(input: MediaBeastSearchQuery) {
    return limitQueryPlans(buildArchivePlans(input)).map((plan) => plan.query);
  },
  async searchCandidates(input: MediaBeastSearchQuery) {
    return mapQueryPlansToCandidates(
      "internet-archive",
      buildArchivePlans(input),
      (plan) =>
        createDiscoveryCandidate({
          providerId: "internet-archive",
          plan,
          title: `Internet Archive ${plan.lens}: ${plan.label}`,
          sourceUrl: buildArchiveSourceUrl(plan),
          reasons: [
            `Query com filtro mediatype para conteudo arquivado real (${plan.intent}).`,
            "Colecoes do Archive costumam ter titulo, descricao e metadados de licenca.",
            plan.intent === "archive_item_page"
              ? "Busca site:archive.org/details para paginas de item em vez de indice vazio."
              : "Busca no Archive com operadores AND mediatype para reduzir ruido."
          ],
          warnings: [
            "Manual license review required before download/import.",
            "Do not assume public accessibility equals public-domain reuse.",
            "Paginas /search listam itens — abra o item /details antes de importar."
          ],
          metadata: {
            sourcePackHint: input.niche,
            substantiveQuery: true,
            mediatype:
              typeof plan.extraMetadata?.mediatype === "string"
                ? plan.extraMetadata.mediatype
                : null
          }
        }),
      input.maxCandidates ?? 6
    );
  }
};