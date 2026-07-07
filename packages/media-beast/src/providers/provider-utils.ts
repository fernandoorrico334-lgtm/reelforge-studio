import type {
  MediaBeastCandidate,
  MediaBeastCandidateKind,
  MediaBeastLicenseStatus,
  MediaBeastProviderId,
  MediaBeastRiskLevel,
  MediaBeastSearchQuery
} from "./types.js";

export type DiscoveryTemporalLens = "past" | "present" | "future";

export interface DiscoveryQueryPlan {
  label: string;
  query: string;
  lens: DiscoveryTemporalLens;
  intent: string;
  score: number;
  kind?: MediaBeastCandidateKind;
  licenseStatus?: MediaBeastLicenseStatus;
  riskLevel?: MediaBeastRiskLevel;
  extraMetadata?: Record<string, string | number | boolean | null>;
}

export function stableCandidateId(providerId: string, seed: string) {
  return `${providerId}-${Buffer.from(seed).toString("base64url").slice(0, 16)}`;
}

export function buildKeywordBase(input: MediaBeastSearchQuery) {
  return input.keywords.join(" ").trim();
}

export function extractKeywordsFromQuery(query: string): string[] {
  const trimmed = query.trim();
  if (!trimmed) {
    return [];
  }

  return [trimmed];
}

export function quoteIfPhrase(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) {
    return "";
  }

  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed;
  }

  return trimmed.includes(" ") ? `"${trimmed}"` : trimmed;
}

export function buildKeywordPhrase(input: MediaBeastSearchQuery): string {
  const base = buildKeywordBase(input);
  if (!base) {
    return "";
  }

  return quoteIfPhrase(base);
}

export interface SubstantiveQueryParts {
  phrase: string;
  niche?: string;
  angle?: string;
  site?: string;
  intitle?: string;
  filetype?: string;
  temporal?: DiscoveryTemporalLens;
  excludeSearchPages?: boolean;
  extraTerms?: string[];
}

export function buildSubstantiveQuery(parts: SubstantiveQueryParts): string {
  const tokens: string[] = [];

  if (parts.site) {
    tokens.push(parts.site.startsWith("site:") ? parts.site : `site:${parts.site}`);
  }
  if (parts.intitle) {
    tokens.push(`intitle:${quoteIfPhrase(parts.intitle)}`);
  }
  if (parts.filetype) {
    tokens.push(`filetype:${parts.filetype}`);
  }

  tokens.push(quoteIfPhrase(parts.phrase));

  if (parts.angle) {
    tokens.push(parts.angle);
  }
  if (parts.niche && parts.niche !== "generic_broll") {
    tokens.push(parts.niche.replace(/_/g, " "));
  }
  if (parts.extraTerms) {
    tokens.push(...parts.extraTerms);
  }

  if (parts.temporal === "past") {
    tokens.push("(archive OR vintage OR historical OR documentary)");
  } else if (parts.temporal === "present") {
    tokens.push("(documentary OR explainer OR analysis)");
  } else if (parts.temporal === "future") {
    tokens.push("(emerging OR rising OR new angle)");
  }

  if (parts.excludeSearchPages) {
    tokens.push("-inurl:search -inurl:results -inurl:feed");
  }

  return tokens.join(" ").replace(/\s+/g, " ").trim();
}

export function buildGoogleSearchUrl(query: string, options?: { imageSearch?: boolean; tbs?: string }) {
  const params = new URLSearchParams({ q: query });
  if (options?.imageSearch) {
    params.set("tbm", "isch");
  }
  if (options?.tbs) {
    params.set("tbs", options.tbs);
  }
  return `https://www.google.com/search?${params.toString()}`;
}

export function buildYouTubeSearchUrl(query: string, options?: { sortByDate?: boolean; longForm?: boolean }) {
  const params = new URLSearchParams({ search_query: query });
  if (options?.sortByDate) {
    params.set("sp", "CAI%253D");
  }
  if (options?.longForm) {
    params.set("sp", "EgQQARgB");
  }
  return `https://www.youtube.com/results?${params.toString()}`;
}

export function buildArchiveOrgSearchUrl(query: string, options?: { mediatype?: string }) {
  const params = new URLSearchParams({ query });
  if (options?.mediatype) {
    params.set("and[]", `mediatype:"${options.mediatype}"`);
  }
  return `https://archive.org/search?${params.toString()}`;
}

export function buildRedditThreadDiscoveryUrl(query: string) {
  return buildGoogleSearchUrl(
    buildSubstantiveQuery({
      phrase: query,
      site: "reddit.com",
      excludeSearchPages: true,
      extraTerms: ["inurl:comments"]
    })
  );
}

export function buildDateSuffix(input: MediaBeastSearchQuery) {
  const parts: string[] = [];
  if (input.dateAfter) {
    parts.push(`after:${input.dateAfter}`);
  }
  if (input.dateBefore) {
    parts.push(`before:${input.dateBefore}`);
  }
  return parts.length > 0 ? ` ${parts.join(" ")}` : "";
}

export function getNicheTemporalHints(niche: string) {
  const hints: Record<DiscoveryTemporalLens, string[]> = {
    past: ["archive", "vintage", "historical", "classic", "retro"],
    present: ["trending", "viral", "current", "2026", "today"],
    future: ["emerging", "rising", "next wave", "forecast", "early signal"]
  };

  switch (niche) {
    case "true_crime":
      hints.past = ["cold case archive", "1970s documentary", "court records"];
      hints.present = ["unsolved case update", "true crime shorts"];
      hints.future = ["emerging investigation angle", "new evidence signal"];
      break;
    case "vintage_football":
      hints.past = ["classic match", "old players", "retro football"];
      hints.present = ["football nostalgia trend", "vintage edit shorts"];
      hints.future = ["rising retro football aesthetic", "old school hype trend"];
      break;
    case "cinema":
      hints.past = ["classic horror", "behind the scenes archive"];
      hints.present = ["film analysis trend", "cinema shorts"];
      hints.future = ["emerging film discourse", "restoration buzz"];
      break;
    case "comics":
      hints.past = ["golden age comics", "public domain issue"];
      hints.present = ["comic history shorts", "panel analysis trend"];
      hints.future = ["rising comic nostalgia", "indie comic signal"];
      break;
    case "bodybuilding":
      hints.past = ["old school bodybuilding", "golden era physique"];
      hints.present = ["gym motivation trend", "physique documentary shorts"];
      hints.future = ["emerging training discourse", "retro gym aesthetic"];
      break;
    case "history":
      hints.past = ["historical archive", "primary source", "obscure event"];
      hints.present = ["history shorts trend", "documentary explainer"];
      hints.future = ["emerging historical debate", "revision signal"];
      break;
    default:
      break;
  }

  return hints;
}

export interface NicheDiscoveryAngles {
  pastQueries: string[];
  presentQueries: string[];
  futureQueries: string[];
  communityKeywords: string[];
  forumSurfaces: string[];
  visualMotifs: string[];
  tiktokFormats: string[];
  trendPlatforms: string[];
  flickrCollections: string[];
}

const DEFAULT_NICHE_ANGLES: NicheDiscoveryAngles = {
  pastQueries: ["archive footage", "vintage documentary", "historical reference"],
  presentQueries: ["trending shorts", "viral edit", "current discourse"],
  futureQueries: ["emerging topic", "rising interest", "next wave format"],
  communityKeywords: ["fan community", "discussion thread", "niche forum"],
  forumSurfaces: ["phpbb", "vbulletin", "blog archive", "wayback machine forum"],
  visualMotifs: ["moodboard", "aesthetic reference", "editorial still"],
  tiktokFormats: ["documentary shorts", "storytime", "explainer edit"],
  trendPlatforms: ["google trends", "youtube trending", "reddit rising"],
  flickrCollections: ["museum upload", "historical society", "press photo archive"]
};

const NICHE_DISCOVERY_ANGLES: Partial<Record<string, NicheDiscoveryAngles>> = {
  true_crime: {
    pastQueries: [
      "cold case timeline",
      "1970s serial killer documentary",
      "court transcript archive",
      "FBI file release",
      "crime scene photo archive"
    ],
    presentQueries: [
      "unsolved case update shorts",
      "true crime documentary edit",
      "case breakdown viral",
      "crime board aesthetic trend"
    ],
    futureQueries: [
      "new evidence angle",
      "reopened investigation signal",
      "podcast crossover trend",
      "forensic method discourse"
    ],
    communityKeywords: [
      "unsolved mysteries reddit",
      "cold case forum",
      "serial killer discussion",
      "crime archive community"
    ],
    forumSurfaces: [
      "site:websleuths.com",
      "site:reddit.com/r/UnresolvedMysteries",
      "true crime forum archive",
      "cold case blog 2000s"
    ],
    visualMotifs: [
      "crime board aesthetic",
      "newspaper clipping collage",
      "mugshot era reference",
      "police evidence board"
    ],
    tiktokFormats: [
      "case timeline shorts",
      "unsolved mystery storytime",
      "crime documentary voiceover",
      "evidence board edit"
    ],
    trendPlatforms: [
      "true crime podcast trend",
      "cold case resurgence",
      "documentary shorts crime"
    ],
    flickrCollections: [
      "historical crime photography",
      "newspaper archive flickr",
      "police museum collection"
    ]
  },
  vintage_football: {
    pastQueries: [
      "classic world cup final",
      "retro football highlights",
      "old stadium atmosphere",
      "legendary player interview archive"
    ],
    presentQueries: [
      "football nostalgia edit",
      "vintage goal compilation shorts",
      "retro jersey trend",
      "classic derby hype"
    ],
    futureQueries: [
      "retro football aesthetic rising",
      "old school tactics discourse",
      "vintage kit revival signal"
    ],
    communityKeywords: [
      "classic football forum",
      "retro soccer reddit",
      "vintage football collectors",
      "old players fan group"
    ],
    forumSurfaces: [
      "site:bigsoccer.com archive",
      "football history blog",
      "vintage football forum phpbb",
      "stadium memories thread"
    ],
    visualMotifs: [
      "retro football poster",
      "vintage stadium crowd",
      "classic kit moodboard",
      "grainy matchday aesthetic"
    ],
    tiktokFormats: [
      "goal edit with trending sound",
      "player legend tribute shorts",
      "retro match hype edit",
      "football history countdown"
    ],
    trendPlatforms: [
      "vintage football edit trend",
      "classic goal resurgence",
      "retro sports nostalgia"
    ],
    flickrCollections: [
      "vintage football photography",
      "stadium history flickr",
      "world cup archive photos"
    ]
  },
  cinema: {
    pastQueries: [
      "classic horror behind the scenes",
      "vintage film still archive",
      "old hollywood production photos",
      "public domain horror trailer"
    ],
    presentQueries: [
      "film analysis shorts",
      "horror cinema edit trend",
      "cinematic breakdown viral",
      "movie lore explainer"
    ],
    futureQueries: [
      "film restoration buzz",
      "cult horror resurgence",
      "indie horror discourse",
      "director cut rumor signal"
    ],
    communityKeywords: [
      "horror film reddit",
      "classic cinema forum",
      "cinephile discord",
      "film analysis community"
    ],
    forumSurfaces: [
      "site:imdb.com board archive",
      "classic horror blog",
      "film forum vbulletin",
      "cinematography discussion archive"
    ],
    visualMotifs: [
      "film noir moodboard",
      "horror poster aesthetic",
      "cinematic lighting reference",
      "vintage movie still collage"
    ],
    tiktokFormats: [
      "movie theory shorts",
      "horror scene breakdown",
      "cinematic edit trend",
      "behind the scenes lore"
    ],
    trendPlatforms: [
      "horror movie trend 2026",
      "classic film resurgence",
      "cinema discourse rising"
    ],
    flickrCollections: [
      "film still archive",
      "movie production photos",
      "cinema museum flickr"
    ]
  },
  comics: {
    pastQueries: [
      "golden age comic scan",
      "public domain comic issue",
      "vintage comic panel archive",
      "silver age cover reference"
    ],
    presentQueries: [
      "comic history shorts",
      "panel analysis trend",
      "vintage comic edit",
      "superhero lore explainer"
    ],
    futureQueries: [
      "comic nostalgia revival",
      "indie comic signal",
      "public domain hero trend",
      "retro panel aesthetic rising"
    ],
    communityKeywords: [
      "comic collectors forum",
      "golden age comics reddit",
      "public domain superhero community",
      "vintage comic fandom"
    ],
    forumSurfaces: [
      "comic book forum archive",
      "golden age comics blog",
      "site:reddit.com/r/comicbooks",
      "public domain comics discussion"
    ],
    visualMotifs: [
      "halftone comic aesthetic",
      "vintage panel moodboard",
      "golden age cover palette",
      "ink line art reference"
    ],
    tiktokFormats: [
      "comic lore shorts",
      "panel breakdown edit",
      "vintage hero storytime",
      "public domain comic explainer"
    ],
    trendPlatforms: [
      "comic history trend",
      "golden age resurgence",
      "public domain hero interest"
    ],
    flickrCollections: [
      "comic art archive flickr",
      "vintage illustration collection",
      "museum comic exhibit photos"
    ]
  },
  bodybuilding: {
    pastQueries: [
      "golden era bodybuilding photos",
      "old school gym archive",
      "classic physique competition",
      "vintage muscle magazine scan"
    ],
    presentQueries: [
      "gym motivation shorts",
      "old school training edit",
      "physique documentary trend",
      "retro gym aesthetic"
    ],
    futureQueries: [
      "natural training discourse",
      "retro physique revival",
      "old school method trend",
      "golden era nostalgia signal"
    ],
    communityKeywords: [
      "bodybuilding forum archive",
      "golden era physique reddit",
      "old school gym community",
      "classic bodybuilder fans"
    ],
    forumSurfaces: [
      "bodybuilding forum phpbb",
      "golden era training blog",
      "site:reddit.com/r/bodybuilding",
      "vintage physique discussion"
    ],
    visualMotifs: [
      "old school gym moodboard",
      "grainy physique photography",
      "vintage muscle magazine aesthetic",
      "black and white gym reference"
    ],
    tiktokFormats: [
      "old school training shorts",
      "physique legend tribute",
      "gym motivation documentary edit",
      "golden era comparison"
    ],
    trendPlatforms: [
      "old school gym trend",
      "natural bodybuilding discourse",
      "retro physique edit"
    ],
    flickrCollections: [
      "vintage bodybuilding photography",
      "sports archive physique",
      "historical gym photos"
    ]
  },
  history: {
    pastQueries: [
      "obscure historical event archive",
      "primary source document scan",
      "forgotten history photograph",
      "historical map reference"
    ],
    presentQueries: [
      "history shorts trend",
      "obscure event explainer",
      "documentary mystery edit",
      "historical what-if discourse"
    ],
    futureQueries: [
      "revisionist history debate",
      "new archive release signal",
      "obscure topic resurgence",
      "historical podcast crossover"
    ],
    communityKeywords: [
      "obscure history reddit",
      "historical research forum",
      "archive hunters community",
      "forgotten events discussion"
    ],
    forumSurfaces: [
      "history forum archive",
      "obscure history blog",
      "site:reddit.com/r/AskHistorians",
      "historical mystery thread"
    ],
    visualMotifs: [
      "aged document aesthetic",
      "historical map moodboard",
      "archive photograph collage",
      "museum artifact reference"
    ],
    tiktokFormats: [
      "obscure history shorts",
      "forgotten event storytime",
      "historical mystery edit",
      "timeline documentary voiceover"
    ],
    trendPlatforms: [
      "obscure history trend",
      "documentary mystery rising",
      "archive release interest"
    ],
    flickrCollections: [
      "historical society flickr",
      "museum archive photos",
      "public domain historical images"
    ]
  }
};

export function getNicheDiscoveryAngles(niche: string): NicheDiscoveryAngles {
  const angles = NICHE_DISCOVERY_ANGLES[niche];
  if (!angles) {
    return { ...DEFAULT_NICHE_ANGLES };
  }

  return {
    pastQueries: angles.pastQueries ?? DEFAULT_NICHE_ANGLES.pastQueries,
    presentQueries: angles.presentQueries ?? DEFAULT_NICHE_ANGLES.presentQueries,
    futureQueries: angles.futureQueries ?? DEFAULT_NICHE_ANGLES.futureQueries,
    communityKeywords:
      angles.communityKeywords ?? DEFAULT_NICHE_ANGLES.communityKeywords,
    forumSurfaces: angles.forumSurfaces ?? DEFAULT_NICHE_ANGLES.forumSurfaces,
    visualMotifs: angles.visualMotifs ?? DEFAULT_NICHE_ANGLES.visualMotifs,
    tiktokFormats: angles.tiktokFormats ?? DEFAULT_NICHE_ANGLES.tiktokFormats,
    trendPlatforms: angles.trendPlatforms ?? DEFAULT_NICHE_ANGLES.trendPlatforms,
    flickrCollections:
      angles.flickrCollections ?? DEFAULT_NICHE_ANGLES.flickrCollections
  };
}

export const DEFAULT_PROVIDER_MAX_CANDIDATES = 10;

export interface NicheQueryPlanPartial {
  label: string;
  querySuffix: string;
  intent: string;
  score?: number;
  kind?: MediaBeastCandidateKind;
  licenseStatus?: MediaBeastLicenseStatus;
  riskLevel?: MediaBeastRiskLevel;
  extraMetadata?: Record<string, string | number | boolean | null>;
}

export function buildNicheQueryPlans(
  base: string,
  niche: string,
  buildPlan: (
    angle: string,
    lens: DiscoveryTemporalLens,
    index: number
  ) => NicheQueryPlanPartial
): DiscoveryQueryPlan[] {
  const angles = getNicheDiscoveryAngles(niche);
  const plans: DiscoveryQueryPlan[] = [];

  const lensGroups: Array<{
    lens: DiscoveryTemporalLens;
    angles: string[];
    scoreBase: number;
  }> = [
    { lens: "past", angles: angles.pastQueries, scoreBase: 52 },
    { lens: "present", angles: angles.presentQueries, scoreBase: 50 },
    { lens: "future", angles: angles.futureQueries, scoreBase: 46 }
  ];

  for (const group of lensGroups) {
    group.angles.forEach((angle, index) => {
      const partial = buildPlan(angle, group.lens, index);
      const plan: DiscoveryQueryPlan = {
        label: partial.label,
        query: buildSubstantiveQuery({
          phrase: base,
          angle: partial.querySuffix,
          niche,
          temporal: group.lens,
          excludeSearchPages:
            partial.querySuffix.includes("forum") ||
            partial.querySuffix.includes("thread") ||
            partial.querySuffix.includes("site:")
        }),
        lens: group.lens,
        intent: partial.intent,
        score: partial.score ?? group.scoreBase - index
      };

      if (partial.kind !== undefined) {
        plan.kind = partial.kind;
      }
      if (partial.licenseStatus !== undefined) {
        plan.licenseStatus = partial.licenseStatus;
      }
      if (partial.riskLevel !== undefined) {
        plan.riskLevel = partial.riskLevel;
      }
      if (partial.extraMetadata !== undefined) {
        plan.extraMetadata = partial.extraMetadata;
      }

      plans.push(plan);
    });
  }

  return plans;
}

export function limitQueryPlans(
  plans: DiscoveryQueryPlan[],
  maxCandidates = 5
): DiscoveryQueryPlan[] {
  const seen = new Set<string>();
  const unique: DiscoveryQueryPlan[] = [];

  for (const plan of plans.sort((left, right) => right.score - left.score)) {
    const key = `${plan.lens}:${plan.query}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(plan);
    if (unique.length >= maxCandidates) {
      break;
    }
  }

  return unique;
}

export interface CreateDiscoveryCandidateInput {
  providerId: MediaBeastProviderId;
  plan: DiscoveryQueryPlan;
  title: string;
  sourceUrl: string;
  previewUrl?: string | null;
  reasons: string[];
  warnings: string[];
  metadata?: Record<string, string | number | boolean | null>;
}

export function createDiscoveryCandidate(
  input: CreateDiscoveryCandidateInput
): MediaBeastCandidate {
  const { plan, providerId } = input;

  return {
    id: stableCandidateId(providerId, `${plan.lens}:${plan.query}:${plan.intent}`),
    providerId,
    kind: plan.kind ?? "webpage",
    title: input.title,
    sourceUrl: input.sourceUrl,
    previewUrl: input.previewUrl ?? null,
    licenseStatus: plan.licenseStatus ?? "unknown",
    riskLevel: plan.riskLevel ?? "high",
    score: plan.score,
    reasons: input.reasons,
    warnings: input.warnings,
    metadata: {
      query: plan.query,
      temporalLens: plan.lens,
      searchIntent: plan.intent,
      discoveryOnly: true,
      substantiveQuery: true,
      ...plan.extraMetadata,
      ...input.metadata
    }
  };
}

export function mapQueryPlansToCandidates(
  providerId: MediaBeastProviderId,
  plans: DiscoveryQueryPlan[],
  buildCandidate: (plan: DiscoveryQueryPlan) => MediaBeastCandidate,
  maxCandidates = 5
): MediaBeastCandidate[] {
  return limitQueryPlans(plans, maxCandidates).map(buildCandidate);
}