export const PRIMARY_CATALOG_SOURCE_PRIORITY = "critical" as const;

export const PRIMARY_CATALOG_SOURCE_TIER = "primary_marvel_catalog" as const;

export type PrimaryCatalogPublisher = {
  id: string;
  label: string;
  indexUrl: string;
  franchise: string;
  priority: typeof PRIMARY_CATALOG_SOURCE_PRIORITY;
  heroScope: "multi_hero";
  notes: string;
};

export const SERIES_BONUS_MATCHERS: Array<{ weight: number; pattern: RegExp }> = [
  { weight: 12, pattern: /\banti[- ]?venom\b/i },
  { weight: 10, pattern: /\bvenom\b/i },
  { weight: 9, pattern: /\bsymbiote\b|\bsimbionte\b|\bsimbiose\b/i },
  { weight: 8, pattern: /\bhomem[- ]?aranha\b|\bspider[- ]?man\b/i },
  { weight: 7, pattern: /\bvolta ao negro\b|\bblack suit\b/i },
  { weight: 6, pattern: /\beddie brock\b/i },
  { weight: 5, pattern: /\bvenomverso\b|\bvenom inc\b/i }
];

export const HERO_ENTITY_ALIASES: Record<string, string[]> = {
  venom: ["venom", "anti-venom", "anti venom", "simbiote", "simbionte"],
  "homem-aranha": [
    "homem-aranha",
    "homem aranha",
    "spider-man",
    "spider man",
    "aranhaverso",
    "miles morales",
    "spider-gwen"
  ],
  "spider-man": ["spider-man", "spider man", "homem-aranha", "homem aranha", "aranha"],
  simbionte: ["simbionte", "symbiote", "simbiose", "venom"],
  symbiote: ["symbiote", "simbionte", "simbiose", "venom"],
  wolverine: ["wolverine", "logan", "arma x"],
  "capitao-america": ["capitão américa", "capitao america", "captain america", "cap america"],
  "homem-de-ferro": ["homem de ferro", "iron man", "invencivel homem de ferro"],
  "pantera-negra": ["pantera negra", "black panther"],
  "quarteto-fantastico": ["quarteto fantástico", "quarteto fantastico", "fantastic four"],
  hulk: ["hulk", "incredible hulk"],
  thor: ["thor", "poderoso thor"],
  daredevil: ["demolidor", "daredevil"],
  "x-men": ["x-men", "x men", "uncanny x-men"],
  deadpool: ["deadpool", "mercenario"],
  batman: ["batman", "coringa", "joker", "dark knight"],
  coringa: ["coringa", "joker", "batman"],
  joker: ["joker", "coringa", "batman"],
  superman: ["superman", "clark kent", "homem de aço", "homem de aco"],
  thanos: ["thanos", "infinity gauntlet", "joias do infinito"],
  spawn: ["spawn", "inferno", "hell"],
  "jean grey": ["jean grey", "phoenix", "fênix", "fenix"],
  fenix: ["fênix", "fenix", "phoenix", "jean grey"],
  "fênix": ["fênix", "fenix", "phoenix", "jean grey"],
  phoenix: ["phoenix", "fênix", "fenix", "jean grey"]
};

export const LOGO_OR_UI_PATTERN =
  /logo|favicon|emoji|dashicons|avatar|banner-ad|wp-smiley|mhq-logo|search\.png|eye-14x14|youtube\.png|resposta\.png/i;

export function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&#8211;/g, "-")
    .replace(/&#038;/g, "&")
    .replace(/&#8902;/g, "·")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function expandEntityTerms(entities: string[]): string[] {
  const expanded = new Set<string>();
  for (const entity of entities) {
    const trimmed = entity.trim().toLowerCase();
    if (!trimmed) continue;
    expanded.add(trimmed);
    const slug = trimmed.replace(/\s+/g, "-");
    expanded.add(slug);
    const aliases = HERO_ENTITY_ALIASES[slug] ?? HERO_ENTITY_ALIASES[trimmed] ?? [];
    for (const alias of aliases) expanded.add(alias.toLowerCase());
  }
  return [...expanded];
}

export function scoreEntityMatch(haystack: string, entityTerms: string[]): number {
  let score = 0;
  for (const term of entityTerms) {
    if (!term) continue;
    if (haystack.includes(term)) {
      score += 10;
      continue;
    }
    const slug = term.replace(/\s+/g, "-");
    if (slug !== term && haystack.includes(slug)) {
      score += 9;
    }
  }
  return score;
}

export function scoreComicsTitleRelevance(title: string, entities: string[]): number {
  const haystack = title.toLowerCase();
  let score = 1;
  for (const matcher of SERIES_BONUS_MATCHERS) {
    if (matcher.pattern.test(haystack)) score += matcher.weight;
  }
  return score + scoreEntityMatch(haystack, expandEntityTerms(entities));
}

export function isUsableCatalogCoverUrl(url: string): boolean {
  const normalized = url.toLowerCase();
  if (!normalized) return false;
  if (LOGO_OR_UI_PATTERN.test(normalized)) return false;
  if (/\.(jpe?g|png|webp|gif|avif)(\?|$)/i.test(normalized)) return true;
  if (/comicvine\.gamespot\.com\/a\/uploads\//i.test(normalized)) return true;
  if (/i\d\.wp\.com\/comicvine\.gamespot\.com/i.test(normalized)) return true;
  return false;
}