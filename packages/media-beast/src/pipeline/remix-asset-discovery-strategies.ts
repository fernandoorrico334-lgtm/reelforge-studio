import type { MediaBeastNiche, MediaBeastProviderId } from "../providers/types.js";
import type { RemixContentDomain } from "./remix-content-intelligence.js";
import type { VideoRemixAnalysis } from "./remix-video-analyzer.js";

export type RemixAssetPurpose =
  | "archive_reference"
  | "comic_panel"
  | "sports_photo"
  | "broll_mood"
  | "differentiation"
  | "character_art"
  | "documentary_still";

export interface RemixAssetQueryTemplate {
  template: string;
  priority: number;
  purpose: RemixAssetPurpose;
}

export interface RemixAssetDiscoveryStrategy {
  domain: RemixContentDomain;
  label: string;
  providerIds: MediaBeastProviderId[];
  providerWeights: Partial<Record<MediaBeastProviderId, number>>;
  queryTemplates: RemixAssetQueryTemplate[];
  purposeByProvider: Partial<Record<MediaBeastProviderId, RemixAssetPurpose>>;
  sceneRoleByPurpose: Partial<Record<RemixAssetPurpose, string>>;
  visualKeywords: string[];
}

const ROLE_SEQUENCE = ["hook", "context", "evidence", "climax", "outro"] as const;

const BASE_STRATEGIES: Record<RemixContentDomain, RemixAssetDiscoveryStrategy> = {
  comics_superhero: {
    domain: "comics_superhero",
    label: "Quadrinhos / super-heróis",
    providerIds: ["comics-archive", "internet-archive", "flickr", "google-images", "generic-web"],
    providerWeights: {
      "comics-archive": 22,
      "internet-archive": 18,
      flickr: 14,
      "google-images": 8,
      "generic-web": 5
    },
    queryTemplates: [
      { template: "{lead} comic book panel high resolution archive", priority: 10, purpose: "comic_panel" },
      { template: "{franchise} {lead} official art reference editorial", priority: 9, purpose: "character_art" },
      { template: "{lead} golden age comics scan public domain", priority: 8, purpose: "comic_panel" },
      { template: "{lead} comic halftone poster noir vertical", priority: 7, purpose: "broll_mood" },
      { template: "{action} {lead} comic scene composition", priority: 6, purpose: "differentiation" }
    ],
    purposeByProvider: { "comics-archive": "comic_panel" },
    sceneRoleByPurpose: {
      comic_panel: "evidence",
      character_art: "context",
      broll_mood: "hook",
      archive_reference: "context",
      differentiation: "climax"
    },
    visualKeywords: ["comic panel", "halftone", "poster", "key art", "golden age"]
  },
  sports: {
    domain: "sports",
    label: "Esportes / futebol",
    providerIds: ["sports-archive", "internet-archive", "flickr", "google-images", "generic-web"],
    providerWeights: {
      "sports-archive": 22,
      "internet-archive": 16,
      flickr: 14,
      "google-images": 9,
      "generic-web": 5
    },
    queryTemplates: [
      { template: "{lead} match action sports photography press", priority: 10, purpose: "sports_photo" },
      { template: "{lead} stadium editorial archive photo", priority: 9, purpose: "sports_photo" },
      { template: "{lead} {action} sports documentary still", priority: 8, purpose: "sports_photo" },
      { template: "{setting} football vintage photo archive", priority: 7, purpose: "archive_reference" },
      { template: "{lead} sports b-roll crowd energy vertical", priority: 6, purpose: "broll_mood" }
    ],
    purposeByProvider: { "sports-archive": "sports_photo" },
    sceneRoleByPurpose: {
      sports_photo: "evidence",
      archive_reference: "context",
      broll_mood: "hook",
      differentiation: "climax"
    },
    visualKeywords: ["stadium", "match", "goal", "action", "sports photography"]
  },
  true_crime: {
    domain: "true_crime",
    label: "True crime / investigação",
    providerIds: ["internet-archive", "flickr", "old-forums", "google-images", "generic-web"],
    providerWeights: {
      "internet-archive": 22,
      flickr: 15,
      "old-forums": 12,
      "google-images": 8,
      "generic-web": 6
    },
    queryTemplates: [
      { template: "{lead} newspaper archive crime investigation photo", priority: 10, purpose: "archive_reference" },
      { template: "{lead} documentary crime still noir editorial", priority: 9, purpose: "documentary_still" },
      { template: "{lead} evidence board investigation reference", priority: 8, purpose: "archive_reference" },
      { template: "{action} {lead} news archive photograph", priority: 7, purpose: "documentary_still" },
      { template: "true crime documentary b-roll texture archive", priority: 6, purpose: "broll_mood" }
    ],
    purposeByProvider: { "internet-archive": "archive_reference" },
    sceneRoleByPurpose: {
      archive_reference: "context",
      documentary_still: "evidence",
      broll_mood: "hook",
      differentiation: "climax"
    },
    visualKeywords: ["newspaper", "archive", "investigation", "noir", "evidence"]
  },
  documentary: {
    domain: "documentary",
    label: "Documentário / história",
    providerIds: ["internet-archive", "flickr", "google-images", "old-forums", "generic-web"],
    providerWeights: {
      "internet-archive": 24,
      flickr: 16,
      "old-forums": 10,
      "google-images": 8,
      "generic-web": 5
    },
    queryTemplates: [
      { template: "{lead} historical photograph archive high quality", priority: 10, purpose: "archive_reference" },
      { template: "{lead} documentary editorial still {setting}", priority: 9, purpose: "documentary_still" },
      { template: "{lead} museum archive photo reference", priority: 8, purpose: "archive_reference" },
      { template: "{action} {lead} news photo history", priority: 7, purpose: "documentary_still" },
      { template: "documentary b-roll texture film grain vertical", priority: 6, purpose: "broll_mood" }
    ],
    purposeByProvider: { "internet-archive": "archive_reference" },
    sceneRoleByPurpose: {
      archive_reference: "context",
      documentary_still: "evidence",
      broll_mood: "hook",
      differentiation: "climax"
    },
    visualKeywords: ["historical", "archive", "museum", "documentary", "editorial"]
  },
  anime: {
    domain: "anime",
    label: "Anime / mangá",
    providerIds: ["internet-archive", "flickr", "pinterest", "google-images", "generic-web"],
    providerWeights: {
      "internet-archive": 14,
      flickr: 12,
      pinterest: 16,
      "google-images": 10,
      "generic-web": 6
    },
    queryTemplates: [
      { template: "{lead} anime key visual reference editorial", priority: 10, purpose: "character_art" },
      { template: "{lead} manga panel composition study", priority: 9, purpose: "comic_panel" },
      { template: "{lead} anime action frame reference", priority: 8, purpose: "differentiation" },
      { template: "{franchise} {lead} promotional art archive", priority: 7, purpose: "character_art" },
      { template: "anime b-roll neon speed lines vertical", priority: 6, purpose: "broll_mood" }
    ],
    purposeByProvider: { pinterest: "character_art" },
    sceneRoleByPurpose: {
      character_art: "hook",
      comic_panel: "evidence",
      broll_mood: "context",
      differentiation: "climax"
    },
    visualKeywords: ["anime", "manga", "key visual", "cel shading", "promotional"]
  },
  gaming: {
    domain: "gaming",
    label: "Games / esports",
    providerIds: ["internet-archive", "flickr", "reddit", "google-images", "generic-web"],
    providerWeights: {
      "internet-archive": 14,
      flickr: 12,
      reddit: 14,
      "google-images": 10,
      "generic-web": 7
    },
    queryTemplates: [
      { template: "{lead} game character concept art reference", priority: 10, purpose: "character_art" },
      { template: "{lead} fighting game arcade poster archive", priority: 9, purpose: "archive_reference" },
      { template: "{lead} esports highlight still photography", priority: 8, purpose: "sports_photo" },
      { template: "{action} {lead} gameplay reference frame", priority: 7, purpose: "differentiation" },
      { template: "arcade neon gaming b-roll vertical", priority: 6, purpose: "broll_mood" }
    ],
    purposeByProvider: { reddit: "differentiation" },
    sceneRoleByPurpose: {
      character_art: "hook",
      archive_reference: "context",
      sports_photo: "evidence",
      broll_mood: "context",
      differentiation: "climax"
    },
    visualKeywords: ["arcade", "character", "esports", "game art", "HUD"]
  },
  science: {
    domain: "science",
    label: "Ciência / curiosidades",
    providerIds: ["internet-archive", "flickr", "google-images", "generic-web"],
    providerWeights: {
      "internet-archive": 18,
      flickr: 14,
      "google-images": 10,
      "generic-web": 6
    },
    queryTemplates: [
      { template: "{lead} science documentary photograph archive", priority: 10, purpose: "documentary_still" },
      { template: "{lead} scientific illustration reference editorial", priority: 9, purpose: "archive_reference" },
      { template: "{action} {lead} research photo high quality", priority: 8, purpose: "documentary_still" },
      { template: "science explainer b-roll macro texture", priority: 7, purpose: "broll_mood" },
      { template: "{lead} space nature documentary still", priority: 6, purpose: "archive_reference" }
    ],
    purposeByProvider: {},
    sceneRoleByPurpose: {
      documentary_still: "evidence",
      archive_reference: "context",
      broll_mood: "hook",
      differentiation: "climax"
    },
    visualKeywords: ["science", "macro", "laboratory", "space", "explainer"]
  },
  horror: {
    domain: "horror",
    label: "Horror / cinema sombrio",
    providerIds: ["internet-archive", "flickr", "google-images", "generic-web"],
    providerWeights: {
      "internet-archive": 18,
      flickr: 14,
      "google-images": 9,
      "generic-web": 6
    },
    queryTemplates: [
      { template: "{lead} horror film still archive editorial", priority: 10, purpose: "documentary_still" },
      { template: "{lead} cinema noir photograph reference", priority: 9, purpose: "archive_reference" },
      { template: "horror atmosphere fog texture b-roll", priority: 8, purpose: "broll_mood" },
      { template: "{lead} classic horror movie poster archive", priority: 7, purpose: "character_art" },
      { template: "{action} {lead} dark cinematic still", priority: 6, purpose: "differentiation" }
    ],
    purposeByProvider: {},
    sceneRoleByPurpose: {
      documentary_still: "evidence",
      broll_mood: "hook",
      archive_reference: "context",
      character_art: "context",
      differentiation: "climax"
    },
    visualKeywords: ["horror", "noir", "fog", "cinema", "atmospheric"]
  },
  generic: {
    domain: "generic",
    label: "Editorial genérico",
    providerIds: ["internet-archive", "flickr", "google-images", "generic-web", "pinterest"],
    providerWeights: {
      "internet-archive": 18,
      flickr: 14,
      "google-images": 10,
      pinterest: 8,
      "generic-web": 6
    },
    queryTemplates: [
      { template: "{lead} editorial photograph archive high quality", priority: 10, purpose: "archive_reference" },
      { template: "{lead} documentary reference still {setting}", priority: 9, purpose: "documentary_still" },
      { template: "{action} {lead} news photo editorial", priority: 8, purpose: "documentary_still" },
      { template: "{lead} vertical b-roll mood reference", priority: 7, purpose: "broll_mood" },
      { template: "{mood} cinematic texture plate remix", priority: 6, purpose: "differentiation" }
    ],
    purposeByProvider: {},
    sceneRoleByPurpose: {
      archive_reference: "context",
      documentary_still: "evidence",
      broll_mood: "hook",
      differentiation: "climax"
    },
    visualKeywords: ["editorial", "documentary", "archive", "reference", "premium"]
  }
};

const NICHE_STRATEGY_HINTS: Partial<
  Record<MediaBeastNiche, Partial<Pick<RemixAssetDiscoveryStrategy, "providerIds" | "queryTemplates" | "label">>>
> = {
  vintage_football: {
    label: "Futebol vintage",
    providerIds: ["sports-archive", "internet-archive", "flickr", "google-images"],
    queryTemplates: [
      { template: "{lead} vintage football match archive photo", priority: 10, purpose: "sports_photo" },
      { template: "{lead} maracana libertadores historical photo", priority: 9, purpose: "archive_reference" }
    ]
  },
  bodybuilding: {
    label: "Fisiculturismo",
    queryTemplates: [
      { template: "{lead} bodybuilding competition archive photo", priority: 10, purpose: "sports_photo" },
      { template: "{lead} gym physique editorial reference", priority: 9, purpose: "documentary_still" }
    ]
  },
  true_crime: {
    label: "True crime",
    providerIds: ["internet-archive", "flickr", "old-forums", "google-images"]
  },
  comics: {
    label: "Quadrinhos",
    providerIds: ["comics-archive", "internet-archive", "flickr", "google-images"]
  },
  cinema: {
    label: "Cinema",
    queryTemplates: [
      { template: "{lead} cinema film still editorial archive", priority: 10, purpose: "documentary_still" },
      { template: "{lead} movie poster reference photography", priority: 8, purpose: "character_art" }
    ]
  },
  history: {
    label: "História",
    providerIds: ["internet-archive", "flickr", "old-forums", "google-images"]
  },
  anime: {
    label: "Anime",
    providerIds: ["internet-archive", "pinterest", "flickr", "google-images"]
  }
};

const strategyRegistry = new Map<RemixContentDomain, RemixAssetDiscoveryStrategy>(
  Object.entries(BASE_STRATEGIES) as Array<[RemixContentDomain, RemixAssetDiscoveryStrategy]>
);

export function registerRemixAssetDiscoveryStrategy(strategy: RemixAssetDiscoveryStrategy) {
  strategyRegistry.set(strategy.domain, strategy);
}

function mergeStrategies(
  base: RemixAssetDiscoveryStrategy,
  patch: Partial<Pick<RemixAssetDiscoveryStrategy, "providerIds" | "queryTemplates" | "label">>
): RemixAssetDiscoveryStrategy {
  const mergedProviders = patch.providerIds
    ? [...new Set([...patch.providerIds, ...base.providerIds])]
    : base.providerIds;

  const mergedTemplates = patch.queryTemplates
    ? [...patch.queryTemplates, ...base.queryTemplates]
        .sort((left, right) => right.priority - left.priority)
        .slice(0, 12)
    : base.queryTemplates;

  return {
    ...base,
    label: patch.label ?? base.label,
    providerIds: mergedProviders,
    queryTemplates: mergedTemplates
  };
}

export function resolveRemixAssetDiscoveryStrategy(input: {
  domain: RemixContentDomain;
  niche?: MediaBeastNiche;
}): RemixAssetDiscoveryStrategy {
  const base = strategyRegistry.get(input.domain) ?? BASE_STRATEGIES.generic;
  const nicheHint = input.niche ? NICHE_STRATEGY_HINTS[input.niche] : undefined;

  if (!nicheHint) {
    return base;
  }

  if (input.domain !== "generic") {
    return mergeStrategies(base, {
      label: nicheHint.label ?? base.label,
      ...(nicheHint.queryTemplates ? { queryTemplates: nicheHint.queryTemplates } : {})
    });
  }

  return mergeStrategies(base, {
    ...(nicheHint.label ? { label: nicheHint.label } : {}),
    ...(nicheHint.providerIds ? { providerIds: nicheHint.providerIds } : {}),
    ...(nicheHint.queryTemplates ? { queryTemplates: nicheHint.queryTemplates } : {})
  });
}

export function buildStrategyContext(analysis: VideoRemixAnalysis) {
  const intelligence = analysis.contentIntelligence;
  const lead = intelligence.entities[0]?.name ?? analysis.title.slice(0, 60);
  return {
    lead,
    franchise: intelligence.entities[0]?.franchise ?? lead,
    action: intelligence.actions[0]?.label ?? "highlight",
    setting: intelligence.setting ?? "",
    mood: intelligence.mood,
    domain: intelligence.domain
  };
}

function fillTemplate(template: string, context: ReturnType<typeof buildStrategyContext>) {
  return template
    .replace(/\{lead\}/g, context.lead)
    .replace(/\{franchise\}/g, context.franchise)
    .replace(/\{action\}/g, context.action)
    .replace(/\{setting\}/g, context.setting)
    .replace(/\{mood\}/g, context.mood)
    .replace(/\s+/g, " ")
    .trim();
}

export function buildEntityAwareAssetQueries(
  analysis: VideoRemixAnalysis
): Array<{ query: string; purpose: RemixAssetPurpose; priority: number }> {
  const entities = analysis.contentIntelligence.entities;
  const lead = entities[0]?.name ?? analysis.title.slice(0, 40);
  const queries: Array<{ query: string; purpose: RemixAssetPurpose; priority: number }> = [];

  for (let index = 0; index < Math.min(entities.length, 3); index += 1) {
    const entity = entities[index]!;
    queries.push({
      query: `${entity.name} comic art`,
      purpose: index === 0 ? "character_art" : "differentiation",
      priority: 9 - index
    });
    queries.push({
      query: `${entity.name} marvel illustration`,
      purpose: "comic_panel",
      priority: 8 - index
    });
  }

  if (entities.length >= 2) {
    queries.push({
      query: `${lead} ${entities[1]!.name} comic panel`,
      purpose: "comic_panel",
      priority: 9
    });
    queries.push({
      query: `${entities[1]!.name} ${lead} symbiote`,
      purpose: "character_art",
      priority: 8
    });
  }

  return queries;
}

export function buildStrategyAssetQueries(
  analysis: VideoRemixAnalysis,
  strategy: RemixAssetDiscoveryStrategy,
  maxQueries = 16
): Array<{ query: string; purpose: RemixAssetPurpose; priority: number }> {
  const context = buildStrategyContext(analysis);
  const fromTemplates = strategy.queryTemplates.map((entry) => ({
    query: fillTemplate(entry.template, context),
    purpose: entry.purpose,
    priority: entry.priority
  }));

  const fromIntelligence = analysis.contentIntelligence.visualSearchQueries.map((query, index) => ({
    query: query.trim(),
    purpose: "differentiation" as RemixAssetPurpose,
    priority: 6 - Math.min(index, 5)
  }));

  const fromKeywords = analysis.contextKeywords.slice(0, 6).map((keyword) => ({
    query: `${keyword} ${context.lead} archive photo`,
    purpose: "archive_reference" as RemixAssetPurpose,
    priority: 4
  }));

  const fromEntities = buildEntityAwareAssetQueries(analysis);

  const unique = new Map<string, { query: string; purpose: RemixAssetPurpose; priority: number }>();
  for (const entry of [...fromEntities, ...fromTemplates, ...fromIntelligence, ...fromKeywords]) {
    if (!entry.query || entry.query.length < 8) continue;
    const key = entry.query.toLowerCase();
    const existing = unique.get(key);
    if (!existing || entry.priority > existing.priority) {
      unique.set(key, entry);
    }
  }

  return [...unique.values()]
    .sort((left, right) => right.priority - left.priority)
    .slice(0, maxQueries);
}

export function resolvePurposeForCandidate(
  strategy: RemixAssetDiscoveryStrategy,
  providerId: string,
  queryPurpose?: RemixAssetPurpose
): RemixAssetPurpose {
  if (queryPurpose) {
    return queryPurpose;
  }
  return (
    strategy.purposeByProvider[providerId as MediaBeastProviderId] ??
    (providerId === "comics-archive"
      ? "comic_panel"
      : providerId === "sports-archive"
        ? "sports_photo"
        : "differentiation")
  );
}

export function suggestSceneRoleForPurpose(
  strategy: RemixAssetDiscoveryStrategy,
  purpose: RemixAssetPurpose,
  rankIndex: number
): string {
  return (
    strategy.sceneRoleByPurpose[purpose] ??
    ROLE_SEQUENCE[rankIndex % ROLE_SEQUENCE.length] ??
    "context"
  );
}

export function scoreAssetDomainRelevance(input: {
  title: string;
  query: string;
  providerId: string;
  analysis: VideoRemixAnalysis;
  strategy: RemixAssetDiscoveryStrategy;
  purpose: RemixAssetPurpose;
}): number {
  const haystack = `${input.title} ${input.query}`.toLowerCase();
  let score = input.strategy.providerWeights[input.providerId as MediaBeastProviderId] ?? 6;

  for (const entity of input.analysis.contentIntelligence.entities) {
    if (haystack.includes(entity.name.toLowerCase())) {
      score += entity.confidence === "high" ? 18 : 12;
    }
    for (const alias of entity.aliases) {
      if (alias.length > 3 && haystack.includes(alias.toLowerCase())) {
        score += 6;
      }
    }
  }

  for (const keyword of input.strategy.visualKeywords) {
    if (haystack.includes(keyword.toLowerCase())) {
      score += 4;
    }
  }

  if (input.analysis.contentIntelligence.actions[0]?.label) {
    const action = input.analysis.contentIntelligence.actions[0].label.toLowerCase();
    if (haystack.includes(action)) {
      score += 8;
    }
  }

  if (input.purpose === "archive_reference" || input.purpose === "documentary_still") {
    score += 3;
  }

  if (/\.(jpg|jpeg|png|webp|gif|avif)(\?|$)/i.test(input.query)) {
    score += 4;
  }

  return Math.max(0, Math.round(score));
}