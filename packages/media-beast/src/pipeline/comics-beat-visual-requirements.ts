import type { ComicsThemeAnalysis } from "./comics-theme-intelligence.js";
import { normalizeBeatEntityName, normalizeBeatThemeName } from "./comics-beat-panel-requirements.js";

export type BeatVisualRequirement = {
  beatId: string;
  role: string;
  narrationText: string;

  requiredEntities: string[];
  preferredEntities: string[];

  requiredThemes: string[];
  preferredThemes: string[];

  requiredActions: string[];
  preferredActions: string[];

  preferredRelationships: string[];

  forbiddenEntities: string[];
  forbiddenThemes: string[];

  allowSupportingVisual: boolean;
  directEvidenceRequired: boolean;

  minimumDirectEvidenceScore: number;
};

const DEFAULT_FORBIDDEN_ENTITIES = [
  "doctor_strange",
  "black_widow",
  "miles_morales",
  "gwen_stacy",
  "spider-man_2099"
];

const DEFAULT_FORBIDDEN_THEMES = [
  "visual_mystical_off_theme",
  "visual_ensemble_cameo",
  "visual_catalog_ad",
  "visual_crowd_crossover",
  "dialogue_heavy"
];

const ROLE_MIN_SCORE: Record<string, number> = {
  hook: 80,
  climax: 80,
  context: 60,
  curiosity: 60,
  curiosity_a: 60,
  curiosity_b: 60,
  tension: 60,
  development: 60,
  development_a: 60,
  development_b: 60,
  closing: 60,
  cta: 60
};

const HIGH_STAKES_ROLES = new Set(["hook", "climax"]);

function normalizeThemeEntity(value: string): string {
  return normalizeBeatEntityName(value);
}

function detectNarrationEntities(text: string): {
  required: string[];
  preferred: string[];
} {
  const lower = text.toLowerCase();
  const required: string[] = [];
  const preferred: string[] = [];

  if (/\bvenom\b/i.test(lower)) required.push("venom");
  if (/\b(homem[- ]?aranha|spider[- ]?man)\b/i.test(lower)) {
    if (required.includes("venom")) preferred.push("spider-man");
    else preferred.push("spider-man");
  }
  if (/\beddie brock\b/i.test(lower)) preferred.push("eddie_brock");
  if (/\bsimbionte\b|\bsymbiote\b/i.test(lower)) preferred.push("symbiote");

  return { required, preferred };
}

function detectNarrationThemes(text: string): {
  required: string[];
  preferred: string[];
} {
  const lower = text.toLowerCase();
  const required: string[] = [];
  const preferred: string[] = [];

  if (/dupla ideal|parceiro perfeito|perfect partner|parceria|partnership/i.test(lower)) {
    required.push("partnership");
  } else if (/dupla|duo|parceiro|juntos|qu[ií]mica/i.test(lower)) {
    preferred.push("partnership");
  }

  if (/simbiose|symbiosis|simbionte|symbiote|traje preto|black suit/i.test(lower)) {
    required.push("symbiosis");
  }

  if (/quadrinhos|\bhqs?\b/i.test(lower)) preferred.push("comics_source");
  if (/filme|recorte/i.test(lower)) preferred.push("film_contrast");
  if (/rela[cç][aã]o|liga[cç][aã]o/i.test(lower)) preferred.push("relationship");

  return { required, preferred };
}

function detectNarrationActions(text: string): {
  required: string[];
  preferred: string[];
} {
  const lower = text.toLowerCase();
  const required: string[] = [];
  const preferred: string[] = [];

  if (/encontrou|achou|found/i.test(lower)) preferred.push("discovery");
  if (/prefere|comenta/i.test(lower)) preferred.push("cta");
  if (/explicad|vem das/i.test(lower)) preferred.push("explain");
  if (/simbiose|symbiosis|dupla|duo/i.test(lower)) preferred.push("symbiote_duo_presence");

  return { required, preferred };
}

function detectPreferredRelationships(
  text: string,
  themeAnalysis: ComicsThemeAnalysis
): string[] {
  const relationships = new Set<string>();
  const lower = text.toLowerCase();

  if (/dupla|duo|parceria|juntos/i.test(lower)) relationships.add("duo");
  if (/simbiose|symbiosis|simbionte/i.test(lower)) relationships.add("host_symbiote");
  if (/conflito|conflict|versus|vs\b/i.test(lower)) relationships.add("conflict");

  if (themeAnalysis.relationshipType === "duo") relationships.add("duo");
  if (themeAnalysis.relationshipType === "host_symbiote") relationships.add("host_symbiote");

  return [...relationships];
}

function mergeUniqueNormalized(values: string[], normalizer: (v: string) => string): string[] {
  return [...new Set(values.map((value) => normalizer(value)))];
}

function resolveRoleThresholds(role: string): {
  minimumDirectEvidenceScore: number;
  directEvidenceRequired: boolean;
  allowSupportingVisual: boolean;
} {
  const baseRole = role.replace(/_[ab]$/i, "").replace(/_\d+$/, "");
  const minimumDirectEvidenceScore = ROLE_MIN_SCORE[role] ?? ROLE_MIN_SCORE[baseRole] ?? 60;
  const highStakes = HIGH_STAKES_ROLES.has(role) || HIGH_STAKES_ROLES.has(baseRole);

  return {
    minimumDirectEvidenceScore,
    directEvidenceRequired: highStakes || /\bvenom\b/i.test(role),
    allowSupportingVisual: !highStakes
  };
}

export function buildBeatVisualRequirement(input: {
  beatId: string;
  role: string;
  narrationText: string;
  videoTitle: string;
  themeAnalysis: ComicsThemeAnalysis;
}): BeatVisualRequirement {
  const narrationEntities = detectNarrationEntities(input.narrationText);
  const narrationThemes = detectNarrationThemes(input.narrationText);
  const narrationActions = detectNarrationActions(input.narrationText);
  const roleThresholds = resolveRoleThresholds(input.role);

  const themeEntities = [
    ...(input.themeAnalysis.primaryEntity ? [input.themeAnalysis.primaryEntity] : []),
    ...input.themeAnalysis.secondaryEntities,
    ...input.themeAnalysis.entities
  ];

  const requiredEntities = mergeUniqueNormalized(
    [
      ...narrationEntities.required,
      ...(input.themeAnalysis.primaryEntity &&
      /venom|symbiote|spider/i.test(input.themeAnalysis.primaryEntity)
        ? [input.themeAnalysis.primaryEntity]
        : [])
    ],
    normalizeThemeEntity
  );

  const preferredEntities = mergeUniqueNormalized(
    [...narrationEntities.preferred, ...themeEntities.filter((entity) => !requiredEntities.includes(normalizeThemeEntity(entity)))],
    normalizeThemeEntity
  ).filter((entity) => !requiredEntities.includes(entity));

  const requiredThemes = mergeUniqueNormalized([...narrationThemes.required], normalizeBeatThemeName);

  const preferredThemes = mergeUniqueNormalized(
    [
      ...narrationThemes.preferred,
      ...input.themeAnalysis.narrativeThemes
        .filter((theme) => theme !== "unknown")
        .map((theme) => normalizeBeatThemeName(theme)),
      ...input.themeAnalysis.visualMotifs,
      ...input.themeAnalysis.themeLabels
    ],
    normalizeBeatThemeName
  ).filter((theme) => !requiredThemes.includes(theme));

  const requiredActions = mergeUniqueNormalized(narrationActions.required, (value) =>
    value.toLowerCase().replace(/\s+/g, "_")
  );
  const preferredActions = mergeUniqueNormalized(narrationActions.preferred, (value) =>
    value.toLowerCase().replace(/\s+/g, "_")
  );

  const preferredRelationships = detectPreferredRelationships(
    input.narrationText,
    input.themeAnalysis
  );

  const highStakes =
    HIGH_STAKES_ROLES.has(input.role) ||
    HIGH_STAKES_ROLES.has(input.role.replace(/_[ab]$/i, ""));

  if (highStakes && !requiredEntities.includes("venom")) {
    if (/\bvenom\b/i.test(input.videoTitle) || input.themeAnalysis.primaryEntity === "venom") {
      requiredEntities.unshift("venom");
    }
  }

  if (
    /dupla ideal|parceiro perfeito|simbiose certa/i.test(input.narrationText) &&
    !requiredThemes.includes("partnership")
  ) {
    requiredThemes.push("partnership");
  }
  if (
    /simbiose|symbiosis|simbionte/i.test(input.narrationText) &&
    !requiredThemes.includes("symbiosis")
  ) {
    requiredThemes.push("symbiosis");
  }

  return {
    beatId: input.beatId,
    role: input.role,
    narrationText: input.narrationText,
    requiredEntities,
    preferredEntities,
    requiredThemes,
    preferredThemes,
    requiredActions,
    preferredActions,
    preferredRelationships,
    forbiddenEntities: [...DEFAULT_FORBIDDEN_ENTITIES],
    forbiddenThemes: [...DEFAULT_FORBIDDEN_THEMES],
    allowSupportingVisual: roleThresholds.allowSupportingVisual,
    directEvidenceRequired: highStakes || requiredEntities.length > 0,
    minimumDirectEvidenceScore: roleThresholds.minimumDirectEvidenceScore
  };
}

export function buildBeatVisualRequirementsFromNarration(input: {
  beats: Array<{ beatId: string; role: string; narrationText: string }>;
  videoTitle: string;
  themeAnalysis: ComicsThemeAnalysis;
}): BeatVisualRequirement[] {
  return input.beats.map((beat) =>
    buildBeatVisualRequirement({
      beatId: beat.beatId,
      role: beat.role,
      narrationText: beat.narrationText,
      videoTitle: input.videoTitle,
      themeAnalysis: input.themeAnalysis
    })
  );
}