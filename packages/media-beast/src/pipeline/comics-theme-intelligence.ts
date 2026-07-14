import type { ComicsAssetCategory } from "./comics-asset-quality-gate.js";
import {
  expandEntityTerms,
  scoreComicsTitleRelevance,
  scoreEntityMatch
} from "./comics-catalog-discovery-shared.js";
import type { VideoRemixAnalysis } from "./remix-video-analyzer.js";
import {
  evaluateAssetSubjectRelevance,
  type SubjectRelevanceLevel,
  type SubjectScoredAssetCandidate
} from "./comics-subject-relevance-gate.js";

export type ComicsNarrativeTheme =
  | "partnership"
  | "symbiosis"
  | "rivalry"
  | "origin"
  | "transformation"
  | "betrayal"
  | "team_up"
  | "multiverse"
  | "power_reveal"
  | "identity_reveal"
  | "corruption"
  | "redemption"
  | "legacy"
  | "chaos"
  | "unknown";

export type ComicsRelationshipType =
  | "duo"
  | "host_symbiote"
  | "hero_vs_villain"
  | "mentor_student"
  | "team"
  | "multiverse_variant"
  | "unknown";

export type ComicsBeatRole =
  | "hook"
  | "context"
  | "curiosity"
  | "development"
  | "climax"
  | "closing"
  | "cta";

export interface ComicsThemeAnalysis {
  entities: string[];
  primaryEntity: string | null;
  secondaryEntities: string[];
  narrativeThemes: ComicsNarrativeTheme[];
  relationshipType: ComicsRelationshipType;
  visualMotifs: string[];
  recommendedAssetSignals: string[];
  disallowedAssetSignals: string[];
  themeLabels: string[];
}

export type ComicsThemeProfile = {
  id: ComicsNarrativeTheme;
  labels: string[];
  detectPatterns: RegExp[];
  positiveAssetPatterns: Array<{ pattern: RegExp; signal: string; weight: number }>;
  negativeAssetPatterns: Array<{ pattern: RegExp; signal: string; weight: number }>;
  preferredCategories: ComicsAssetCategory[];
  prohibitedCategories: ComicsAssetCategory[];
  hookSignals: RegExp;
  climaxSignals: RegExp;
  contextSignals: RegExp;
  visualMotifs: string[];
  discoveryQueryFragments: string[];
};

export type ThemeScoredAssetCandidate = SubjectScoredAssetCandidate & {
  themeMatchScore: number;
  relationshipMatchScore: number;
  beatFitScore: number;
  themedFinalScore: number;
  themeSignals: string[];
  themeNegativeSignals: string[];
};

export const MIN_THEME_MATCH_SCORE = 28;

export function isActionableComicsThemeAnalysis(
  themeAnalysis: ComicsThemeAnalysis | null | undefined
): themeAnalysis is ComicsThemeAnalysis {
  if (!themeAnalysis) return false;
  const themes = themeAnalysis.narrativeThemes.filter((theme) => theme !== "unknown");
  if (themes.length === 0) return false;
  if (themeAnalysis.recommendedAssetSignals.length === 0) return false;
  return true;
}

export type ComicsThemeIntelligenceReport = {
  generatedAt: string;
  input: {
    videoTitle: string;
    narrationText?: string;
    curiosityAngle?: string;
    entities: string[];
    tags?: string[];
  };
  analysis: ComicsThemeAnalysis;
  hookAssetSuggestion: { title: string; reason: string } | null;
  climaxAssetSuggestion: { title: string; reason: string } | null;
  discoveryQueries: string[];
};

const THEME_DETECTORS: Array<{
  theme: ComicsNarrativeTheme;
  patterns: RegExp[];
  weight: number;
}> = [
  {
    theme: "partnership",
    patterns: [
      /\bparceiro perfeito\b/i,
      /\bperfect partner\b/i,
      /\bideal partner\b/i,
      /\bpartner(?:ship)?\b/i,
      /\bparceiro\b/i,
      /\bdupla\b/i,
      /\bduo\b/i,
      /\bpair\b/i,
      /\bbond(?:ing)?\b/i,
      /\bconex[aã]o\b/i,
      /\bliga[cç][aã]o\b/i,
      /\bjuntos\b/i,
      /\btogether\b/i
    ],
    weight: 10
  },
  {
    theme: "symbiosis",
    patterns: [
      /\bsimbiose\b/i,
      /\bsymbiosis\b/i,
      /\bsimbionte\b/i,
      /\bsymbiote\b/i,
      /\bhospedeiro\b/i,
      /\bhost\b/i,
      /\bfus[aã]o\b/i,
      /\bbond\b.*\b(symbiote|simbionte)\b/i
    ],
    weight: 10
  },
  {
    theme: "rivalry",
    patterns: [
      /\bvs\.?\b/i,
      /\bversus\b/i,
      /\brival\b/i,
      /\brivalidade\b/i,
      /\binimigo\b/i,
      /\bvillain\b/i,
      /\bconfronto\b/i,
      /\bduelo\b/i,
      /\bface[- ]?off\b/i,
      /\bcontra\b/i
    ],
    weight: 9
  },
  {
    theme: "origin",
    patterns: [
      /\borigem\b/i,
      /\borigin\b/i,
      /\bprimeira vez\b/i,
      /\bfirst appearance\b/i,
      /\bcomo nasceu\b/i,
      /\bhow (?:he|she|it) (?:was|got) born\b/i,
      /\bsurgiu\b/i,
      /\bbeginning\b/i,
      /\bissue\s*#?1\b/i,
      /\b#1\b/
    ],
    weight: 9
  },
  {
    theme: "transformation",
    patterns: [
      /\btransforma[cç][aã]o\b/i,
      /\btransformation\b/i,
      /\bvirou\b/i,
      /\bbecome\b/i,
      /\bbecomes\b/i,
      /\bse tornou\b/i,
      /\bturned into\b/i,
      /\btraje\b/i,
      /\bsuit\b/i,
      /\bmetamorphosis\b/i
    ],
    weight: 9
  },
  {
    theme: "betrayal",
    patterns: [/\btrai[cç][aã]o\b/i, /\bbetrayal\b/i, /\bbetrayed\b/i, /\btraitor\b/i],
    weight: 8
  },
  {
    theme: "team_up",
    patterns: [
      /\bteam[- ]?up\b/i,
      /\bequipe\b/i,
      /\bteam\b/i,
      /\bassemble\b/i,
      /\bunidos\b/i,
      /\balliance\b/i,
      /\balian[cç]a\b/i
    ],
    weight: 8
  },
  {
    theme: "multiverse",
    patterns: [
      /\bmultiverso\b/i,
      /\bmultiverse\b/i,
      /\baranhaverso\b/i,
      /\bspider[- ]?verse\b/i,
      /\b2099\b/i,
      /\bvariante\b/i,
      /\bvariant\b/i,
      /\balternate\b/i,
      /\bwhat if\b/i,
      /\be se\b/i
    ],
    weight: 9
  },
  {
    theme: "power_reveal",
    patterns: [
      /\bpoder\b/i,
      /\bpower\b/i,
      /\brevela[cç][aã]o\b/i,
      /\breveal\b/i,
      /\bforma final\b/i,
      /\bfinal form\b/i,
      /\bhidden power\b/i,
      /\bpoder escondido\b/i,
      /\bsplash page\b/i,
      /\bmanifesta[cç][aã]o\b/i
    ],
    weight: 8
  },
  {
    theme: "identity_reveal",
    patterns: [
      /\bidentidade\b/i,
      /\bidentity\b/i,
      /\bsecret identity\b/i,
      /\bidentidade secreta\b/i,
      /\bm[aá]scara\b/i,
      /\bunmask\b/i,
      /\bdesmascarar\b/i
    ],
    weight: 8
  },
  {
    theme: "corruption",
    patterns: [
      /\bcorrup[cç][aã]o\b/i,
      /\bcorruption\b/i,
      /\binferno\b/i,
      /\bhell\b/i,
      /\bdemonic\b/i,
      /\bdemon[ií]aco\b/i,
      /\bdarkness\b/i,
      /\bescurid[aã]o\b/i
    ],
    weight: 8
  },
  {
    theme: "redemption",
    patterns: [/\breden[cç][aã]o\b/i, /\bredemption\b/i, /\batonement\b/i, /\bsegunda chance\b/i],
    weight: 7
  },
  {
    theme: "legacy",
    patterns: [/\blegado\b/i, /\blegacy\b/i, /\bsucessor\b/i, /\bsuccessor\b/i, /\bheran[cç]a\b/i],
    weight: 7
  },
  {
    theme: "chaos",
    patterns: [/\bcaos\b/i, /\bchaos\b/i, /\bdestrui[cç][aã]o\b/i, /\bapocalypse\b/i, /\bapocalipse\b/i],
    weight: 7
  }
];

const RELATIONSHIP_DETECTORS: Array<{
  type: ComicsRelationshipType;
  patterns: RegExp[];
  requiresThemes?: ComicsNarrativeTheme[];
  minEntities?: number;
}> = [
  {
    type: "host_symbiote",
    patterns: [/\bsymbiote\b/i, /\bsimbionte\b/i, /\bhost\b/i, /\bhospedeiro\b/i],
    requiresThemes: ["symbiosis", "transformation"]
  },
  {
    type: "hero_vs_villain",
    patterns: [/\bvs\.?\b/i, /\bversus\b/i, /\bcontra\b/i, /\bduelo\b/i],
    requiresThemes: ["rivalry"],
    minEntities: 2
  },
  {
    type: "duo",
    patterns: [/\bdupla\b/i, /\bduo\b/i, /\bpair\b/i, /\bparceiro\b/i, /\bpartner\b/i, /\bjuntos\b/i],
    requiresThemes: ["partnership", "team_up", "symbiosis"],
    minEntities: 2
  },
  {
    type: "mentor_student",
    patterns: [/\bmentor\b/i, /\bstudent\b/i, /\bmaster\b/i, /\bmestre\b/i, /\baprendiz\b/i, /\bpadawan\b/i]
  },
  {
    type: "team",
    patterns: [/\bteam\b/i, /\bequipe\b/i, /\bassemble\b/i, /\bavengers\b/i, /\bvingadores\b/i, /\bx-men\b/i],
    requiresThemes: ["team_up"],
    minEntities: 2
  },
  {
    type: "multiverse_variant",
    patterns: [/\bmultiverso\b/i, /\bmultiverse\b/i, /\b2099\b/i, /\bvariante\b/i, /\baranhaverso\b/i],
    requiresThemes: ["multiverse"]
  }
];

export const COMICS_THEME_PROFILES: Record<Exclude<ComicsNarrativeTheme, "unknown">, ComicsThemeProfile> = {
  partnership: {
    id: "partnership",
    labels: ["parceria", "dupla", "partnership"],
    detectPatterns: THEME_DETECTORS.find((d) => d.theme === "partnership")!.patterns,
    positiveAssetPatterns: [
      { pattern: /\bduo\b|\bdupla\b|\bpair\b|\bparceiro\b|\bpartner\b/i, signal: "duo_pair", weight: 20 },
      { pattern: /\btwo characters?\b|\bdois personagens\b/i, signal: "two_characters", weight: 16 },
      { pattern: /\binteraction\b|\bintera[cç][aã]o\b/i, signal: "interaction", weight: 14 },
      { pattern: /\btogether\b|\bjuntos\b/i, signal: "together", weight: 18 },
      { pattern: /\bcomic panel\b.*\bduo\b/i, signal: "duo_panel", weight: 16 },
      {
        pattern: /\bvenom\b[^a-z0-9]{0,8}\b(homem[- ]?aranha|spider[- ]?man)\b/i,
        signal: "venom_spiderman_together",
        weight: 22
      },
      {
        pattern: /\b(homem[- ]?aranha|spider[- ]?man)\b[^a-z0-9]{0,8}\bvenom\b/i,
        signal: "spiderman_venom_together",
        weight: 22
      },
      { pattern: /\bsimbionte\b/i, signal: "simbionte_pt", weight: 18 },
      { pattern: /\bespiral mortal\b/i, signal: "espiral_mortal_duo", weight: 16 }
    ],
    negativeAssetPatterns: [
      { pattern: /\blogo\b|\bwordmark\b/i, signal: "logo_only", weight: 24 },
      { pattern: /\btext page\b/i, signal: "text_page", weight: 28 },
      { pattern: /\bwithout\b.*\b(partner|duo|context)\b/i, signal: "without_partnership_context", weight: 20 }
    ],
    preferredCategories: ["comic_panel", "comic_cover", "character_art"],
    prohibitedCategories: ["logo", "irrelevant"],
    hookSignals:
      /duo_pair|together|two_characters|interaction|parceiro|partner|venom_spiderman_together|spiderman_venom_together|entity_pair|both_entities_present|simbionte/,
    climaxSignals:
      /duo_pair|together|interaction|payoff_duo|venom_spiderman_together|spiderman_venom_together|entity_pair|both_entities_present|simbionte|espiral_mortal/,
    contextSignals: /together|duo_pair|comic_cover/,
    visualMotifs: ["two_characters", "side_by_side", "shared_frame"],
    discoveryQueryFragments: ["duo comic panel", "partnership comic cover", "together comic art"]
  },
  symbiosis: {
    id: "symbiosis",
    labels: ["simbiose", "simbionte", "symbiosis"],
    detectPatterns: THEME_DETECTORS.find((d) => d.theme === "symbiosis")!.patterns,
    positiveAssetPatterns: [
      { pattern: /\bsymbiote\b|\bsimbionte\b/i, signal: "symbiote", weight: 22 },
      { pattern: /\bhost\b|\bhospedeiro\b/i, signal: "host", weight: 18 },
      { pattern: /\bblack suit\b|\btraje preto\b/i, signal: "black_suit", weight: 20 },
      { pattern: /\bbond\b|\bliga[cç][aã]o\b/i, signal: "symbiote_bond", weight: 16 },
      { pattern: /\btransformation\b|\btransforma[cç][aã]o\b/i, signal: "symbiote_transformation", weight: 18 },
      { pattern: /\bfusion\b|\bfus[aã]o\b/i, signal: "fusion", weight: 16 }
    ],
    negativeAssetPatterns: [
      { pattern: /\banti[- ]?symbiote\b|\banti[- ]?venom\b/i, signal: "anti_symbiote_off_theme", weight: 22 },
      { pattern: /\bwithout symbiote\b|\bsem simbionte\b/i, signal: "without_symbiote", weight: 20 }
    ],
    preferredCategories: ["comic_panel", "comic_cover"],
    prohibitedCategories: ["logo", "irrelevant"],
    hookSignals: /symbiote|host|black_suit|symbiote_bond|simbionte/,
    climaxSignals: /symbiote_transformation|fusion|black_suit|symbiote_bond|simbionte/,
    contextSignals: /symbiote|host|black_suit/,
    visualMotifs: ["liquid_texture", "black_suit", "host_body", "tendrils"],
    discoveryQueryFragments: ["symbiote bond comic panel", "black suit comic cover", "host symbiote comic art"]
  },
  rivalry: {
    id: "rivalry",
    labels: ["rivalidade", "confronto", "rivalry"],
    detectPatterns: THEME_DETECTORS.find((d) => d.theme === "rivalry")!.patterns,
    positiveAssetPatterns: [
      { pattern: /\bvs\.?\b|\bversus\b/i, signal: "versus", weight: 22 },
      { pattern: /\bduel\b|\bduelo\b/i, signal: "duel", weight: 20 },
      { pattern: /\bconfronto\b|\bconfrontation\b/i, signal: "confrontation", weight: 18 },
      { pattern: /\bfight\b|\bluta\b|\bbattle\b/i, signal: "battle", weight: 14 },
      { pattern: /\bface[- ]?off\b/i, signal: "face_off", weight: 16 }
    ],
    negativeAssetPatterns: [
      { pattern: /\bteam[- ]?up\b|\bparceiro\b/i, signal: "partnership_off_rivalry", weight: 18 },
      { pattern: /\blogo\b/i, signal: "logo_only", weight: 24 }
    ],
    preferredCategories: ["comic_panel", "comic_cover"],
    prohibitedCategories: ["logo", "irrelevant"],
    hookSignals: /versus|duel|face_off|confrontation/,
    climaxSignals: /battle|duel|versus|confrontation/,
    contextSignals: /versus|confrontation/,
    visualMotifs: ["opposing_poses", "clash", "versus_composition"],
    discoveryQueryFragments: ["vs comic panel", "duel comic cover", "battle comic art"]
  },
  origin: {
    id: "origin",
    labels: ["origem", "origin story"],
    detectPatterns: THEME_DETECTORS.find((d) => d.theme === "origin")!.patterns,
    positiveAssetPatterns: [
      { pattern: /\borigin\b|\borigem\b/i, signal: "origin", weight: 22 },
      { pattern: /\bfirst appearance\b|\bprimeira apari[cç][aã]o\b/i, signal: "first_appearance", weight: 24 },
      { pattern: /\bissue\s*#?1\b|\b#1\b/i, signal: "issue_one", weight: 18 },
      { pattern: /\bgolden age\b|\bidade de ouro\b/i, signal: "golden_age", weight: 14 },
      { pattern: /\bclassic\b|\bcl[aá]ssico\b/i, signal: "classic_origin", weight: 12 }
    ],
    negativeAssetPatterns: [
      { pattern: /\brandom fight\b|\bluta gen[eé]rica\b/i, signal: "generic_fight", weight: 18 }
    ],
    preferredCategories: ["comic_cover", "comic_panel"],
    prohibitedCategories: ["logo"],
    hookSignals: /origin|first_appearance|issue_one/,
    climaxSignals: /origin|first_appearance|classic_origin/,
    contextSignals: /origin|classic_origin/,
    visualMotifs: ["vintage_cover", "first_issue", "origin_scene"],
    discoveryQueryFragments: ["origin comic cover", "first appearance comic", "issue 1 comic art"]
  },
  transformation: {
    id: "transformation",
    labels: ["transformação", "transformation"],
    detectPatterns: THEME_DETECTORS.find((d) => d.theme === "transformation")!.patterns,
    positiveAssetPatterns: [
      { pattern: /\btransformation\b|\btransforma[cç][aã]o\b/i, signal: "transformation", weight: 22 },
      { pattern: /\bmetamorphosis\b|\bmetamorfose\b/i, signal: "metamorphosis", weight: 20 },
      { pattern: /\bsuit\b|\btraje\b|\bcostume\b/i, signal: "costume_change", weight: 16 },
      { pattern: /\bpower[- ]?up\b|\bpoder\b/i, signal: "power_up", weight: 14 },
      { pattern: /\bphoenix\b|\bf[eê]nix\b/i, signal: "phoenix_transform", weight: 18 }
    ],
    negativeAssetPatterns: [
      { pattern: /\bstatic portrait\b|\bheadshot only\b/i, signal: "static_portrait", weight: 14 }
    ],
    preferredCategories: ["comic_panel", "comic_cover"],
    prohibitedCategories: ["logo", "irrelevant"],
    hookSignals: /transformation|metamorphosis|costume_change/,
    climaxSignals: /transformation|phoenix_transform|power_up|metamorphosis/,
    contextSignals: /transformation|costume_change/,
    visualMotifs: ["mid_transform", "energy_burst", "costume_shift"],
    discoveryQueryFragments: ["transformation comic panel", "power up comic page", "metamorphosis comic art"]
  },
  betrayal: {
    id: "betrayal",
    labels: ["traição", "betrayal"],
    detectPatterns: THEME_DETECTORS.find((d) => d.theme === "betrayal")!.patterns,
    positiveAssetPatterns: [
      { pattern: /\bbetrayal\b|\btrai[cç][aã]o\b/i, signal: "betrayal", weight: 22 },
      { pattern: /\btraitor\b|\btraidor\b/i, signal: "traitor", weight: 18 },
      { pattern: /\bbackstab\b|\bknife\b/i, signal: "betrayal_visual", weight: 14 }
    ],
    negativeAssetPatterns: [{ pattern: /\bteam[- ]?up\b/i, signal: "team_up_off_betrayal", weight: 16 }],
    preferredCategories: ["comic_panel", "comic_cover"],
    prohibitedCategories: ["logo"],
    hookSignals: /betrayal|traitor/,
    climaxSignals: /betrayal|betrayal_visual/,
    contextSignals: /betrayal/,
    visualMotifs: ["shock_reveal", "turned_ally"],
    discoveryQueryFragments: ["betrayal comic panel", "traitor comic cover"]
  },
  team_up: {
    id: "team_up",
    labels: ["equipe", "team up"],
    detectPatterns: THEME_DETECTORS.find((d) => d.theme === "team_up")!.patterns,
    positiveAssetPatterns: [
      { pattern: /\bteam[- ]?up\b/i, signal: "team_up", weight: 22 },
      { pattern: /\bassemble\b|\breunidos\b/i, signal: "assemble", weight: 18 },
      { pattern: /\bgroup shot\b|\bgrupo\b/i, signal: "group_shot", weight: 16 },
      { pattern: /\bavengers\b|\bvingadores\b/i, signal: "avengers", weight: 14 },
      { pattern: /\bx-men\b/i, signal: "x_men", weight: 14 }
    ],
    negativeAssetPatterns: [{ pattern: /\bvs\.?\b/i, signal: "versus_off_team", weight: 12 }],
    preferredCategories: ["comic_cover", "comic_panel", "character_art"],
    prohibitedCategories: ["logo"],
    hookSignals: /team_up|assemble|group_shot/,
    climaxSignals: /team_up|assemble|group_shot/,
    contextSignals: /team_up|group_shot/,
    visualMotifs: ["ensemble", "group_pose"],
    discoveryQueryFragments: ["team up comic cover", "assemble comic panel", "group shot comic art"]
  },
  multiverse: {
    id: "multiverse",
    labels: ["multiverso", "multiverse"],
    detectPatterns: THEME_DETECTORS.find((d) => d.theme === "multiverse")!.patterns,
    positiveAssetPatterns: [
      { pattern: /\bmultiverse\b|\bmultiverso\b/i, signal: "multiverse", weight: 22 },
      { pattern: /\bspider[- ]?verse\b|\baranhaverso\b/i, signal: "spider_verse", weight: 22 },
      { pattern: /\b2099\b/i, signal: "future_variant", weight: 16 },
      { pattern: /\bvariant\b|\bvariante\b/i, signal: "variant", weight: 16 },
      { pattern: /\bmultiple\b.*\b(spider|heroes|versions)\b/i, signal: "multiple_versions", weight: 18 }
    ],
    negativeAssetPatterns: [
      { pattern: /\bsingle hero only\b/i, signal: "single_hero_only", weight: 10 }
    ],
    preferredCategories: ["comic_cover", "comic_panel", "character_art"],
    prohibitedCategories: ["logo"],
    hookSignals: /spider_verse|multiple_versions/,
    climaxSignals: /multiverse|spider_verse|future_variant|multiple_versions|variant/,
    contextSignals: /multiverse|variant|spider_verse/,
    visualMotifs: ["multiple_versions", "portal", "variant_grid"],
    discoveryQueryFragments: ["multiverse comic cover", "spider-verse comic panel", "variant comic art"]
  },
  power_reveal: {
    id: "power_reveal",
    labels: ["revelação de poder", "power reveal"],
    detectPatterns: THEME_DETECTORS.find((d) => d.theme === "power_reveal")!.patterns,
    positiveAssetPatterns: [
      { pattern: /\bsplash page\b/i, signal: "splash_page", weight: 20 },
      { pattern: /\bpower\b|\bpoder\b/i, signal: "power", weight: 16 },
      { pattern: /\bfinal form\b|\bforma final\b/i, signal: "final_form", weight: 22 },
      { pattern: /\breveal\b|\brevela[cç][aã]o\b/i, signal: "reveal", weight: 18 },
      { pattern: /\benergy\b|\benergia\b/i, signal: "energy_burst", weight: 14 }
    ],
    negativeAssetPatterns: [{ pattern: /\btext page\b/i, signal: "text_page", weight: 28 }],
    preferredCategories: ["comic_panel", "comic_cover", "character_art"],
    prohibitedCategories: ["logo", "irrelevant"],
    hookSignals: /power|reveal|splash_page/,
    climaxSignals: /final_form|power|energy_burst|splash_page/,
    contextSignals: /power|reveal/,
    visualMotifs: ["splash", "power_manifestation", "dramatic_pose"],
    discoveryQueryFragments: ["power reveal comic splash", "final form comic panel", "energy burst comic art"]
  },
  identity_reveal: {
    id: "identity_reveal",
    labels: ["identidade secreta", "identity reveal"],
    detectPatterns: THEME_DETECTORS.find((d) => d.theme === "identity_reveal")!.patterns,
    positiveAssetPatterns: [
      { pattern: /\bsecret identity\b|\bidentidade secreta\b/i, signal: "secret_identity", weight: 22 },
      { pattern: /\bunmask\b|\bdesmascarar\b/i, signal: "unmask", weight: 20 },
      { pattern: /\bmask\b|\bm[aá]scara\b/i, signal: "mask", weight: 14 }
    ],
    negativeAssetPatterns: [],
    preferredCategories: ["comic_panel", "comic_cover"],
    prohibitedCategories: ["logo"],
    hookSignals: /secret_identity|unmask|mask/,
    climaxSignals: /unmask|secret_identity/,
    contextSignals: /mask|secret_identity/,
    visualMotifs: ["mask_removed", "dual_identity"],
    discoveryQueryFragments: ["secret identity comic panel", "unmask comic cover"]
  },
  corruption: {
    id: "corruption",
    labels: ["corrupção", "corruption"],
    detectPatterns: THEME_DETECTORS.find((d) => d.theme === "corruption")!.patterns,
    positiveAssetPatterns: [
      { pattern: /\bcorruption\b|\bcorrup[cç][aã]o\b/i, signal: "corruption", weight: 22 },
      { pattern: /\bhell\b|\binferno\b/i, signal: "hell", weight: 20 },
      { pattern: /\bdemonic\b|\bdemon[ií]aco\b/i, signal: "demonic", weight: 18 },
      { pattern: /\bspawn\b/i, signal: "spawn", weight: 16 }
    ],
    negativeAssetPatterns: [{ pattern: /\bredemption\b/i, signal: "redemption_off_corruption", weight: 12 }],
    preferredCategories: ["comic_panel", "comic_cover", "character_art"],
    prohibitedCategories: ["logo"],
    hookSignals: /corruption|hell|demonic/,
    climaxSignals: /hell|corruption|demonic/,
    contextSignals: /corruption|hell/,
    visualMotifs: ["dark_aura", "infernal", "corrupted_form"],
    discoveryQueryFragments: ["hell comic panel", "corruption comic cover", "demonic comic art"]
  },
  redemption: {
    id: "redemption",
    labels: ["redenção", "redemption"],
    detectPatterns: THEME_DETECTORS.find((d) => d.theme === "redemption")!.patterns,
    positiveAssetPatterns: [
      { pattern: /\bredemption\b|\breden[cç][aã]o\b/i, signal: "redemption", weight: 22 },
      { pattern: /\batonement\b|\bexpia[cç][aã]o\b/i, signal: "atonement", weight: 18 },
      { pattern: /\bsecond chance\b|\bsegunda chance\b/i, signal: "second_chance", weight: 16 }
    ],
    negativeAssetPatterns: [{ pattern: /\bhell\b|\bcorruption\b/i, signal: "corruption_off_redemption", weight: 14 }],
    preferredCategories: ["comic_panel", "comic_cover"],
    prohibitedCategories: ["logo"],
    hookSignals: /redemption|second_chance/,
    climaxSignals: /redemption|atonement/,
    contextSignals: /redemption/,
    visualMotifs: ["light_return", "hero_rise"],
    discoveryQueryFragments: ["redemption comic panel", "second chance comic cover"]
  },
  legacy: {
    id: "legacy",
    labels: ["legado", "legacy"],
    detectPatterns: THEME_DETECTORS.find((d) => d.theme === "legacy")!.patterns,
    positiveAssetPatterns: [
      { pattern: /\blegacy\b|\blegado\b/i, signal: "legacy", weight: 22 },
      { pattern: /\bsuccessor\b|\bsucessor\b/i, signal: "successor", weight: 18 },
      { pattern: /\bpassing the torch\b|\btocha\b/i, signal: "passing_torch", weight: 16 }
    ],
    negativeAssetPatterns: [],
    preferredCategories: ["comic_cover", "comic_panel"],
    prohibitedCategories: ["logo"],
    hookSignals: /legacy|successor/,
    climaxSignals: /legacy|passing_torch/,
    contextSignals: /legacy|successor/,
    visualMotifs: ["generational", "mantle_passed"],
    discoveryQueryFragments: ["legacy comic cover", "successor comic panel"]
  },
  chaos: {
    id: "chaos",
    labels: ["caos", "chaos"],
    detectPatterns: THEME_DETECTORS.find((d) => d.theme === "chaos")!.patterns,
    positiveAssetPatterns: [
      { pattern: /\bchaos\b|\bcaos\b/i, signal: "chaos", weight: 22 },
      { pattern: /\binfinity gauntlet\b|\bjoias do infinito\b/i, signal: "infinity_gauntlet", weight: 28 },
      { pattern: /\bapocalypse\b|\bapocalipse\b/i, signal: "apocalypse", weight: 20 },
      { pattern: /\bdestruction\b|\bdestrui[cç][aã]o\b/i, signal: "destruction", weight: 18 },
      { pattern: /\bthanos\b|\binfinity\b|\bjoias\b/i, signal: "cosmic_chaos", weight: 16 }
    ],
    negativeAssetPatterns: [],
    preferredCategories: ["comic_panel", "comic_cover", "character_art"],
    prohibitedCategories: ["logo"],
    hookSignals: /chaos|infinity_gauntlet|cosmic_chaos/,
    climaxSignals: /apocalypse|destruction|cosmic_chaos/,
    contextSignals: /chaos|destruction/,
    visualMotifs: ["destruction", "cosmic_scale", "ruin"],
    discoveryQueryFragments: ["apocalypse comic splash", "chaos comic panel", "destruction comic cover"]
  }
};

const CROSS_THEME_NEGATIVE: Array<{
  whenThemes: ComicsNarrativeTheme[];
  notThemes: ComicsNarrativeTheme[];
  assetPatterns: Array<{ pattern: RegExp; signal: string }>;
}> = [
  {
    whenThemes: ["partnership", "symbiosis"],
    notThemes: ["multiverse"],
    assetPatterns: [
      { pattern: /\b2099\b/i, signal: "future_variant_off_partnership" },
      { pattern: /\baranhaverso\b|\bspider[- ]?verse\b/i, signal: "spider_verse_off_partnership" },
      { pattern: /\bgwen stacy\b|\bmorte de gwen\b/i, signal: "gwen_tragedy_off_partnership" }
    ]
  },
  {
    whenThemes: ["rivalry"],
    notThemes: ["partnership", "team_up"],
    assetPatterns: [{ pattern: /\bparceiro\b|\bpartner\b|\bdupla ideal\b/i, signal: "partnership_off_rivalry" }]
  },
  {
    whenThemes: ["origin"],
    notThemes: ["multiverse"],
    assetPatterns: [{ pattern: /\b2099\b|\bvariant\b/i, signal: "variant_off_origin" }]
  },
  {
    whenThemes: ["multiverse"],
    notThemes: ["partnership", "symbiosis", "rivalry"],
    assetPatterns: []
  }
];

function probeThemeText(input: {
  videoTitle?: string;
  narrationText?: string;
  curiosityAngle?: string;
  tags?: string[];
  assetTitle?: string;
  assetDescription?: string;
}): string {
  return [
    input.videoTitle,
    input.narrationText,
    input.curiosityAngle,
    input.tags?.join(" "),
    input.assetTitle,
    input.assetDescription
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function assetProbe(title: string, description?: string) {
  return description
    ? { assetTitle: title, assetDescription: description }
    : { assetTitle: title };
}

function detectThemes(haystack: string): ComicsNarrativeTheme[] {
  const scored: Array<{ theme: ComicsNarrativeTheme; score: number }> = [];
  for (const detector of THEME_DETECTORS) {
    let hits = 0;
    for (const pattern of detector.patterns) {
      if (pattern.test(haystack)) hits += 1;
    }
    if (hits > 0) scored.push({ theme: detector.theme, score: hits * detector.weight });
  }
  scored.sort((a, b) => b.score - a.score);
  if (scored.length === 0) return ["unknown"];
  const top = scored[0]!.score;
  return scored.filter((entry) => entry.score >= top * 0.55).map((entry) => entry.theme);
}

function detectRelationship(
  haystack: string,
  themes: ComicsNarrativeTheme[],
  entities: string[]
): ComicsRelationshipType {
  const entityCount = entities.filter(Boolean).length;

  if (entityCount >= 2 && (themes.includes("partnership") || themes.includes("team_up"))) {
    if (/\bassemble\b|\bavengers\b|\bvingadores\b|\bgroup shot\b|\bgrupo\b/i.test(haystack)) {
      return "team";
    }
    if (
      entityCount === 2 ||
      /\bduo\b|\bdupla\b|\bparceiro\b|\bpartner\b|\bjuntos\b|\btogether\b|\bteam[- ]?up\b/i.test(
        haystack
      )
    ) {
      return "duo";
    }
  }
  if (entityCount >= 2 && themes.includes("rivalry")) {
    return "hero_vs_villain";
  }
  if (themes.includes("multiverse")) {
    return "multiverse_variant";
  }

  for (const detector of RELATIONSHIP_DETECTORS) {
    const themeOk =
      !detector.requiresThemes ||
      detector.requiresThemes.some((theme) => themes.includes(theme));
    const entityOk = !detector.minEntities || entityCount >= detector.minEntities;
    const patternOk = detector.patterns.some((pattern) => pattern.test(haystack));
    if (themeOk && entityOk && patternOk) return detector.type;
  }
  if (themes.includes("multiverse")) return "multiverse_variant";
  if (entityCount >= 2 && (themes.includes("partnership") || themes.includes("team_up"))) return "duo";
  if (entityCount >= 2 && themes.includes("rivalry")) return "hero_vs_villain";
  return "unknown";
}

function collectProfiles(themes: ComicsNarrativeTheme[]): ComicsThemeProfile[] {
  return themes
    .filter((theme): theme is Exclude<ComicsNarrativeTheme, "unknown"> => theme !== "unknown")
    .map((theme) => COMICS_THEME_PROFILES[theme])
    .filter(Boolean);
}

export function analyzeComicsVideoTheme(input: {
  videoTitle: string;
  narrationText?: string;
  curiosityAngle?: string;
  entities: string[];
  tags?: string[];
}): ComicsThemeAnalysis {
  const entities = input.entities.map((e) => e.trim()).filter(Boolean);
  const haystack = probeThemeText(input);
  const narrativeThemes = detectThemes(haystack);
  const profiles = collectProfiles(narrativeThemes);
  const relationshipType = detectRelationship(haystack, narrativeThemes, entities);

  const recommendedAssetSignals = new Set<string>();
  const disallowedAssetSignals = new Set<string>();
  const visualMotifs = new Set<string>();
  const themeLabels = new Set<string>();

  for (const profile of profiles) {
    for (const label of profile.labels) themeLabels.add(label);
    for (const motif of profile.visualMotifs) visualMotifs.add(motif);
    for (const entry of profile.positiveAssetPatterns) recommendedAssetSignals.add(entry.signal);
    for (const entry of profile.negativeAssetPatterns) disallowedAssetSignals.add(entry.signal);
  }

  for (const cross of CROSS_THEME_NEGATIVE) {
    const active = cross.whenThemes.some((t) => narrativeThemes.includes(t));
    const blocked = cross.notThemes.some((t) => narrativeThemes.includes(t));
    if (active && !blocked) {
      for (const entry of cross.assetPatterns) disallowedAssetSignals.add(entry.signal);
    }
  }

  if (relationshipType === "duo" || relationshipType === "hero_vs_villain") {
    recommendedAssetSignals.add("entity_pair");
    recommendedAssetSignals.add("together");
  }
  if (relationshipType === "host_symbiote") {
    recommendedAssetSignals.add("symbiote");
    recommendedAssetSignals.add("host");
  }

  return {
    entities,
    primaryEntity: entities[0] ?? null,
    secondaryEntities: entities.slice(1),
    narrativeThemes,
    relationshipType,
    visualMotifs: [...visualMotifs],
    recommendedAssetSignals: [...recommendedAssetSignals],
    disallowedAssetSignals: [...disallowedAssetSignals],
    themeLabels: [...themeLabels]
  };
}

export function analyzeComicsVideoThemeFromAnalysis(
  analysis: VideoRemixAnalysis,
  videoTitle?: string
): ComicsThemeAnalysis {
  const intel = analysis.contentIntelligence;
  const narrationParts = [
    intel.narrativeHook,
    intel.narrativeBrief,
    intel.summary,
    intel.curiosityAngle,
    ...(intel.actions?.map((a) => a.label) ?? [])
  ].filter(Boolean);

  return analyzeComicsVideoTheme({
    videoTitle: videoTitle ?? analysis.title ?? intel.headline ?? "",
    narrationText: narrationParts.join(" "),
    ...(intel.curiosityAngle ? { curiosityAngle: intel.curiosityAngle } : {}),
    entities: intel.entities?.map((e) => e.name).filter(Boolean) ?? [],
    tags: analysis.contextKeywords ?? intel.entities?.flatMap((e) => e.aliases ?? [])
  });
}

function scorePatterns(
  haystack: string,
  patterns: Array<{ pattern: RegExp; signal: string; weight: number }>
): { score: number; signals: string[] } {
  let score = 0;
  const signals: string[] = [];
  for (const entry of patterns) {
    if (entry.pattern.test(haystack)) {
      score += entry.weight;
      signals.push(entry.signal);
    }
  }
  return { score, signals };
}

export function scoreAssetThemeMatch(input: {
  assetTitle: string;
  assetDescription?: string;
  category: ComicsAssetCategory;
  themeAnalysis: ComicsThemeAnalysis;
}): { score: number; signals: string[]; negativeSignals: string[] } {
  const haystack = probeThemeText(assetProbe(input.assetTitle, input.assetDescription));
  const profiles = collectProfiles(input.themeAnalysis.narrativeThemes);
  let score = 0;
  const signals: string[] = [];
  const negativeSignals: string[] = [];

  for (const profile of profiles) {
    const positive = scorePatterns(haystack, profile.positiveAssetPatterns);
    const negative = scorePatterns(haystack, profile.negativeAssetPatterns);
    score += positive.score;
    signals.push(...positive.signals);
    negative.score > 0 && negativeSignals.push(...negative.signals);

    if (profile.preferredCategories.includes(input.category)) score += 8;
    if (profile.prohibitedCategories.includes(input.category)) {
      score -= 30;
      negativeSignals.push(`prohibited_category:${input.category}`);
    }
  }

  for (const cross of CROSS_THEME_NEGATIVE) {
    const active = cross.whenThemes.some((t) => input.themeAnalysis.narrativeThemes.includes(t));
    const blocked = cross.notThemes.some((t) => input.themeAnalysis.narrativeThemes.includes(t));
    if (active && !blocked) {
      for (const entry of cross.assetPatterns) {
        if (entry.pattern.test(haystack)) {
          score -= 18;
          negativeSignals.push(entry.signal);
        }
      }
    }
  }

  for (const disallowed of input.themeAnalysis.disallowedAssetSignals) {
    if (signals.includes(disallowed)) {
      score -= 12;
      negativeSignals.push(`theme_disallowed:${disallowed}`);
    }
  }

  const entityTerms = expandEntityTerms(input.themeAnalysis.entities);
  const entityHits = scoreEntityMatch(haystack, entityTerms);
  if (entityHits >= 1) score += Math.min(20, entityHits * 6);
  if (
    entityHits >= 2 &&
    (input.themeAnalysis.relationshipType === "duo" ||
      input.themeAnalysis.narrativeThemes.some((theme) =>
        ["partnership", "symbiosis", "team_up"].includes(theme)
      ))
  ) {
    score += 22;
    signals.push("entity_pair_duo_boost");
  }

  return {
    score: Math.max(0, Math.min(100, score)),
    signals: [...new Set(signals)],
    negativeSignals: [...new Set(negativeSignals)]
  };
}

export function scoreAssetRelationshipMatch(input: {
  assetTitle: string;
  assetDescription?: string;
  themeAnalysis: ComicsThemeAnalysis;
}): { score: number; signals: string[] } {
  const haystack = probeThemeText(assetProbe(input.assetTitle, input.assetDescription));
  const entities = input.themeAnalysis.entities;
  const entityTerms = expandEntityTerms(entities);
  let score = 0;
  const signals: string[] = [];

  const entityHitCount = entityTerms.filter((term) => haystack.includes(term.toLowerCase())).length;
  if (entityHitCount >= 2) {
    score += 28;
    signals.push("entity_pair");
  } else if (entityHitCount === 1 && entities.length === 1) {
    score += 18;
    signals.push("single_entity_focus");
  }

  switch (input.themeAnalysis.relationshipType) {
    case "duo":
      if (/\bduo\b|\bdupla\b|\btogether\b|\bjuntos\b|\band\b|\be\b/i.test(haystack)) {
        score += 22;
        signals.push("duo_composition");
      }
      if (entityHitCount >= 2) {
        score += 16;
        signals.push("both_entities_present");
      }
      break;
    case "hero_vs_villain":
      if (/\bvs\.?\b|\bversus\b|\bcontra\b/i.test(haystack)) {
        score += 26;
        signals.push("versus_composition");
      }
      break;
    case "host_symbiote":
      if (/\bsymbiote\b|\bsimbionte\b|\bhost\b|\bhospedeiro\b/i.test(haystack)) {
        score += 24;
        signals.push("host_symbiote_relation");
      }
      break;
    case "team":
      if (/\bteam\b|\bequipe\b|\bgroup\b|\bgrupo\b/i.test(haystack)) {
        score += 20;
        signals.push("team_composition");
      }
      break;
    case "multiverse_variant":
      if (/\bvariant\b|\b2099\b|\bmultiverse\b|\baranhaverso\b/i.test(haystack)) {
        score += 24;
        signals.push("multiverse_variant");
      }
      break;
    case "mentor_student":
      if (/\bmentor\b|\bstudent\b|\bmestre\b|\baprendiz\b/i.test(haystack)) {
        score += 22;
        signals.push("mentor_student");
      }
      break;
    default:
      if (entityHitCount >= 1) score += 10;
  }

  return { score: Math.max(0, Math.min(100, score)), signals: [...new Set(signals)] };
}

export function scoreAssetBeatFit(input: {
  beatRole: ComicsBeatRole;
  assetTitle: string;
  assetDescription?: string;
  category: ComicsAssetCategory;
  themeAnalysis: ComicsThemeAnalysis;
  themeSignals: string[];
}): { score: number; signals: string[] } {
  const haystack = probeThemeText(assetProbe(input.assetTitle, input.assetDescription));
  const profiles = collectProfiles(input.themeAnalysis.narrativeThemes);
  const primary = profiles[0];
  if (!primary) return { score: 40, signals: ["unknown_theme_beat"] };

  let score = 42;
  const signals: string[] = [];
  const signalHaystack = [...input.themeSignals, haystack].join(" ");

  const roleSignalMap: Record<ComicsBeatRole, RegExp> = {
    hook: primary.hookSignals,
    context: primary.contextSignals,
    curiosity: primary.contextSignals,
    development: /panel|cover|together|variant|transformation|versus/,
    climax: primary.climaxSignals,
    closing: primary.contextSignals,
    cta: /together|duo|team|comment|cta/
  };

  const rolePattern = roleSignalMap[input.beatRole];
  if (rolePattern.test(signalHaystack)) {
    score += 28;
    signals.push(`beat_fit:${input.beatRole}`);
  }

  if (input.beatRole === "hook" && input.category === "comic_cover") score += 8;
  if (input.beatRole === "climax" && input.category === "comic_panel") {
    score += 10;
  }
  if (input.beatRole === "development" && input.category === "comic_panel") score += 12;

  return { score: Math.max(0, Math.min(100, score)), signals };
}

export function computeThemedFinalSelectionScore(input: {
  entityMatchScore: number;
  themeMatchScore: number;
  relationshipMatchScore: number;
  assetQualityScore: number;
  beatFitScore?: number;
}): number {
  const beatFit = input.beatFitScore ?? 50;
  return Math.round(
    input.entityMatchScore * 0.2 +
      input.themeMatchScore * 0.3 +
      input.relationshipMatchScore * 0.2 +
      input.assetQualityScore * 0.15 +
      beatFit * 0.15
  );
}

export function scoreAssetForThemedSelection(input: {
  id: string;
  title: string;
  sourceUrl?: string;
  description?: string;
  tags?: string[];
  category: ComicsAssetCategory;
  assetQualityScore: number;
  themeAnalysis: ComicsThemeAnalysis;
  beatRole?: ComicsBeatRole;
  targetStyle?: string;
}): ThemeScoredAssetCandidate {
  const text = probeThemeText({
    ...assetProbe(input.title, input.description),
    ...(input.tags ? { tags: input.tags } : {})
  });
  const entityMatch = scoreEntityMatch(text, expandEntityTerms(input.themeAnalysis.entities));
  const entityMatchScore = Math.min(100, entityMatch * 14);

  const theme = scoreAssetThemeMatch({
    ...assetProbe(input.title, input.description),
    category: input.category,
    themeAnalysis: input.themeAnalysis
  });
  const relationship = scoreAssetRelationshipMatch({
    ...assetProbe(input.title, input.description),
    themeAnalysis: input.themeAnalysis
  });
  const beatRole = input.beatRole ?? "development";
  const beatFit = scoreAssetBeatFit({
    beatRole,
    ...assetProbe(input.title, input.description),
    category: input.category,
    themeAnalysis: input.themeAnalysis,
    themeSignals: [...theme.signals, ...relationship.signals]
  });

  const subjectProbeTitle = [input.title, input.description].filter(Boolean).join(" — ");
  const subject = evaluateAssetSubjectRelevance({
    videoTitle: input.themeAnalysis.entities.join(" / "),
    narrativeTheme: input.themeAnalysis.themeLabels.join(" / "),
    entities: input.themeAnalysis.entities,
    actions: input.themeAnalysis.themeLabels,
    assetTitle: subjectProbeTitle,
    ...(input.tags ? { assetTags: input.tags } : {}),
    assetCategory: input.category,
    targetStyle: input.targetStyle ?? "comics"
  });

  const catalogRelevance = scoreComicsTitleRelevance(subjectProbeTitle, input.themeAnalysis.entities);
  let subjectRelevanceScore = Math.min(100, Math.max(theme.score, subject.score));
  if (catalogRelevance >= 16) subjectRelevanceScore = Math.min(100, subjectRelevanceScore + 8);

  let relevance: SubjectRelevanceLevel = subject.relevance;
  if (theme.score >= 52 && relationship.score >= 40) relevance = "direct_subject_match";
  else if (theme.score >= 36 || relationship.score >= 28) relevance = "supporting_context";
  else if (entityMatchScore >= 40 && theme.score < 24) relevance = "generic_entity_match";
  else if (theme.score < 16 && entityMatchScore < 30) relevance = "reject";

  if (theme.negativeSignals.length > 0 && theme.score < 30) relevance = "weak_match";

  const themedFinalScore = computeThemedFinalSelectionScore({
    entityMatchScore,
    themeMatchScore: theme.score,
    relationshipMatchScore: relationship.score,
    assetQualityScore: input.assetQualityScore,
    beatFitScore: beatFit.score
  });

  const subjectOk =
    relevance === "direct_subject_match" ||
    (relevance === "supporting_context" &&
      theme.score >= 28 &&
      (entityMatchScore >= 24 || theme.score >= 52));

  if (theme.negativeSignals.some((s) => s.startsWith("prohibited_category"))) {
    return {
      id: input.id,
      title: input.title,
      ...(input.sourceUrl ? { sourceUrl: input.sourceUrl } : {}),
      ...(input.description ? { description: input.description } : {}),
      ...(input.tags ? { tags: input.tags } : {}),
      category: input.category,
      assetQualityScore: input.assetQualityScore,
      entityMatchScore,
      subjectRelevanceScore,
      finalSelectionScore: themedFinalScore,
      relevance: "reject",
      recommendedBeat: "reject",
      reason: "prohibited_category_for_theme",
      positiveSignals: [...theme.signals, ...relationship.signals],
      negativeSignals: [...theme.negativeSignals, ...subject.negativeSignals],
      subjectOk: false,
      themeMatchScore: theme.score,
      relationshipMatchScore: relationship.score,
      beatFitScore: beatFit.score,
      themedFinalScore,
      themeSignals: theme.signals,
      themeNegativeSignals: theme.negativeSignals
    };
  }

  return {
    id: input.id,
    title: input.title,
    ...(input.sourceUrl ? { sourceUrl: input.sourceUrl } : {}),
    ...(input.description ? { description: input.description } : {}),
    ...(input.tags ? { tags: input.tags } : {}),
    category: input.category,
    assetQualityScore: input.assetQualityScore,
    entityMatchScore,
    subjectRelevanceScore,
    finalSelectionScore: themedFinalScore,
    themedFinalScore,
    relevance,
    recommendedBeat: recommendThemedBeat(relevance, theme.signals, input.category, input.themeAnalysis),
    reason:
      relevance === "direct_subject_match"
        ? "direct_theme_alignment"
        : relevance === "supporting_context"
          ? "supporting_theme_context"
          : subject.reason,
    positiveSignals: [...new Set([...theme.signals, ...relationship.signals, ...beatFit.signals, ...subject.positiveSignals])],
    negativeSignals: [...new Set([...theme.negativeSignals, ...subject.negativeSignals])],
    subjectOk,
    themeMatchScore: theme.score,
    relationshipMatchScore: relationship.score,
    beatFitScore: beatFit.score,
    themeSignals: theme.signals,
    themeNegativeSignals: theme.negativeSignals
  };
}

function recommendThemedBeat(
  relevance: SubjectRelevanceLevel,
  themeSignals: string[],
  category: ComicsAssetCategory,
  themeAnalysis: ComicsThemeAnalysis
): string {
  if (relevance === "reject" || relevance === "weak_match") return "reject";
  const profiles = collectProfiles(themeAnalysis.narrativeThemes);
  const primary = profiles[0];
  if (!primary) return "development";
  const signalText = themeSignals.join(" ");
  if (primary.hookSignals.test(signalText)) return "hook";
  if (primary.climaxSignals.test(signalText)) return "climax";
  if (category === "comic_cover") return "context";
  return "development";
}

export function isBeatThemeAligned(input: {
  asset: ThemeScoredAssetCandidate;
  beatRole: ComicsBeatRole;
  themeAnalysis: ComicsThemeAnalysis;
}): boolean {
  if (!input.asset.subjectOk) return false;
  if (input.asset.relevance === "reject" || input.asset.relevance === "weak_match") return false;
  if (input.asset.relevance === "generic_entity_match") return false;
  if (input.asset.themeMatchScore < 28) return false;
  if (input.asset.themeNegativeSignals.length > 0 && input.asset.themeMatchScore < 45) return false;

  const profiles = collectProfiles(input.themeAnalysis.narrativeThemes);
  if (profiles.length === 0) return input.asset.themeMatchScore >= 40;

  const signals = [...input.asset.themeSignals, ...input.asset.positiveSignals].join(" ");
  const rolePatterns: Record<ComicsBeatRole, RegExp[]> = {
    hook: profiles.map((profile) => profile.hookSignals),
    context: profiles.map((profile) => profile.contextSignals),
    curiosity: profiles.map((profile) => profile.contextSignals),
    development: [/panel|cover|together|variant|transformation|versus|symbiote|duo/],
    climax: profiles.map((profile) => profile.climaxSignals),
    closing: profiles.map((profile) => profile.contextSignals),
    cta: [/duo|team|together/]
  };

  const minScores: Record<ComicsBeatRole, number> = {
    hook: 42,
    context: 30,
    curiosity: 32,
    development: 28,
    climax: 38,
    closing: 26,
    cta: 24
  };

  const entityPairDuo =
    input.themeAnalysis.relationshipType === "duo" &&
    /entity_pair|both_entities_present|venom_spiderman_together|spiderman_venom_together|entity_pair_duo_boost/.test(
      signals
    );

  if (input.beatRole === "hook" || input.beatRole === "climax") {
    if (
      entityPairDuo &&
      input.asset.relevance === "supporting_context" &&
      input.asset.themeMatchScore >= MIN_THEME_MATCH_SCORE
    ) {
      return true;
    }
    if (input.asset.themeMatchScore < minScores[input.beatRole]) return false;
    return (
      rolePatterns[input.beatRole].some((pattern) => pattern.test(signals)) ||
      input.asset.themeMatchScore >= minScores[input.beatRole] + 18
    );
  }

  if (input.asset.themeMatchScore < minScores[input.beatRole]) return false;
  return input.asset.themeMatchScore >= minScores[input.beatRole];
}

export function selectAssetForThemedBeat(input: {
  beatRole: ComicsBeatRole;
  beatText?: string;
  themeAnalysis: ComicsThemeAnalysis;
  acceptedAssets: ThemeScoredAssetCandidate[];
  excludeIds?: string[];
}): { asset: ThemeScoredAssetCandidate | null; reason: string } {
  const pool = input.acceptedAssets.filter(
    (asset) => asset.subjectOk && !input.excludeIds?.includes(asset.id)
  );
  const hookPreferenceBonus = (asset: ThemeScoredAssetCandidate) => {
    const text = [...asset.themeSignals, ...asset.positiveSignals].join(" ");
    let bonus = 0;
    if (/infinity_gauntlet|duo_pair|spider_verse|multiple_versions|origin|first_appearance/.test(text)) {
      bonus += 22;
    }
    if (/apocalypse|destruction|redemption|second_chance/.test(text)) bonus -= 18;
    return bonus;
  };

  const rank = (assets: ThemeScoredAssetCandidate[]) =>
    [...assets].sort((left, right) => {
      const leftScore =
        left.themedFinalScore + (input.beatRole === "hook" ? hookPreferenceBonus(left) : 0);
      const rightScore =
        right.themedFinalScore + (input.beatRole === "hook" ? hookPreferenceBonus(right) : 0);
      return rightScore - leftScore;
    });

  const aligned = pool.filter((asset) =>
    isBeatThemeAligned({ asset, beatRole: input.beatRole, themeAnalysis: input.themeAnalysis })
  );

  const profiles = collectProfiles(input.themeAnalysis.narrativeThemes);
  const roleSignalPatterns =
    input.beatRole === "hook"
      ? profiles.map((profile) => profile.hookSignals)
      : input.beatRole === "climax"
        ? profiles.map((profile) => profile.climaxSignals)
        : profiles.map((profile) => profile.contextSignals);

  const signalPreferred = aligned.filter((asset) => {
    const signalText = [...asset.themeSignals, ...asset.positiveSignals].join(" ");
    return roleSignalPatterns.some((pattern) => pattern.test(signalText));
  });

  const beatFitRanked = rank(
    aligned.map((asset) => ({
      ...asset,
      themedFinalScore: computeThemedFinalSelectionScore({
        entityMatchScore: asset.entityMatchScore,
        themeMatchScore: asset.themeMatchScore,
        relationshipMatchScore: asset.relationshipMatchScore,
        assetQualityScore: asset.assetQualityScore,
        beatFitScore: scoreAssetBeatFit({
          beatRole: input.beatRole,
          ...assetProbe(asset.title, asset.description),
          category: asset.category,
          themeAnalysis: input.themeAnalysis,
          themeSignals: asset.themeSignals
        }).score
      })
    }))
  );

  const primaryProfile = profiles[0];
  const primarySignalPreferred = primaryProfile
    ? signalPreferred.filter((asset) =>
        primaryProfile[
          input.beatRole === "hook"
            ? "hookSignals"
            : input.beatRole === "climax"
              ? "climaxSignals"
              : "contextSignals"
        ].test([...asset.themeSignals, ...asset.positiveSignals].join(" "))
      )
    : [];

  const entityPairFallback = pool.filter((asset) => {
    const signalText = [...asset.themeSignals, ...asset.positiveSignals].join(" ");
    return (
      input.themeAnalysis.relationshipType === "duo" &&
      asset.relevance === "supporting_context" &&
      asset.themeMatchScore >= MIN_THEME_MATCH_SCORE &&
      /entity_pair|both_entities_present|venom_spiderman_together|spiderman_venom_together|entity_pair_duo_boost|simbionte/.test(
        signalText
      )
    );
  });

  const pick =
    rank(primarySignalPreferred)[0] ??
    rank(signalPreferred)[0] ??
    beatFitRanked[0] ??
    rank(aligned)[0] ??
    rank(entityPairFallback)[0] ??
    rank(pool.filter((a) => a.themeMatchScore >= 32))[0];
  return pick
    ? {
        asset: pick,
        reason: `${input.beatRole}_theme_aligned:${entityPairFallback.some((asset) => asset.id === pick.id) ? "entity_pair_fallback" : pick.reason}`
      }
    : { asset: null, reason: `no_${input.beatRole}_theme_aligned_asset` };
}

export function buildThemeDiscoveryQueries(input: {
  themeAnalysis: ComicsThemeAnalysis;
  franchise?: string | null;
}): string[] {
  const entities = input.themeAnalysis.entities;
  const lead = entities[0] ?? "Marvel";
  const partner = entities[1] ?? "";
  const profiles = collectProfiles(input.themeAnalysis.narrativeThemes);
  const queries = new Set<string>();

  for (const profile of profiles) {
    for (const fragment of profile.discoveryQueryFragments) {
      queries.add(`${lead} ${fragment}`);
      if (partner) queries.add(`${lead} ${partner} ${fragment}`);
    }
  }

  for (const label of input.themeAnalysis.themeLabels.slice(0, 3)) {
    queries.add(`${lead} ${label} comic panel`);
    queries.add(`${lead} ${label} comic cover`);
    if (partner) queries.add(`${lead} ${partner} ${label} comic art`);
  }

  if (input.themeAnalysis.relationshipType === "hero_vs_villain" && partner) {
    queries.add(`${lead} vs ${partner} comic panel`);
    queries.add(`${lead} ${partner} duel comic cover`);
  }
  if (input.themeAnalysis.relationshipType === "duo" && partner) {
    queries.add(`${lead} ${partner} duo comic panel`);
    queries.add(`${lead} and ${partner} together comic cover`);
  }
  if (input.themeAnalysis.relationshipType === "host_symbiote") {
    queries.add(`${lead} symbiote host comic panel`);
    queries.add(`${lead} symbiote bond comic art`);
  }
  if (input.themeAnalysis.relationshipType === "multiverse_variant") {
    queries.add(`${lead} multiverse comic cover`);
    queries.add(`${lead} variant comic panel`);
  }

  if (input.franchise) {
    queries.add(`${input.franchise} ${lead} comic panel archive`);
  }

  return [...queries].slice(0, 28);
}

export function buildComicsThemeIntelligenceReport(input: {
  videoTitle: string;
  narrationText?: string;
  curiosityAngle?: string;
  entities: string[];
  tags?: string[];
  candidateAssets?: Array<{
    id: string;
    title: string;
    description?: string;
    category: ComicsAssetCategory;
    assetQualityScore?: number;
  }>;
}): ComicsThemeIntelligenceReport {
  const analysis = analyzeComicsVideoTheme(input);
  const candidates = (input.candidateAssets ?? []).map((asset) =>
    scoreAssetForThemedSelection({
      id: asset.id,
      title: asset.title,
      ...(asset.description ? { description: asset.description } : {}),
      category: asset.category,
      assetQualityScore: asset.assetQualityScore ?? 80,
      themeAnalysis: analysis
    })
  );

  const hookSelection = selectAssetForThemedBeat({
    beatRole: "hook",
    themeAnalysis: analysis,
    acceptedAssets: candidates
  });
  const climaxSelection = selectAssetForThemedBeat({
    beatRole: "climax",
    themeAnalysis: analysis,
    acceptedAssets: candidates,
    excludeIds: hookSelection.asset ? [hookSelection.asset.id] : []
  });

  return {
    generatedAt: new Date().toISOString(),
    input: {
      videoTitle: input.videoTitle,
      ...(input.narrationText ? { narrationText: input.narrationText } : {}),
      ...(input.curiosityAngle ? { curiosityAngle: input.curiosityAngle } : {}),
      entities: input.entities,
      ...(input.tags ? { tags: input.tags } : {})
    },
    analysis,
    hookAssetSuggestion: hookSelection.asset
      ? { title: hookSelection.asset.title, reason: hookSelection.reason }
      : null,
    climaxAssetSuggestion: climaxSelection.asset
      ? { title: climaxSelection.asset.title, reason: climaxSelection.reason }
      : null,
    discoveryQueries: buildThemeDiscoveryQueries({ themeAnalysis: analysis })
  };
}