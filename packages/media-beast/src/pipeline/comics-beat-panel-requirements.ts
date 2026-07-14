import type { BeatVisualRequirement } from "./comics-beat-visual-requirements.js";
import type { LocalComicPanelEvidence } from "./comics-local-panel-index.js";

export type BeatPanelRelationshipType =
  | "duo"
  | "host_symbiote"
  | "conflict"
  | "conversation"
  | "transformation"
  | "unknown";

export type BeatPanelEvidenceRequirements = {
  requiredEntities: string[];
  preferredEntities: string[];
  requiredThemes: string[];
  preferredRelationships: BeatPanelRelationshipType[];
  forbiddenEntities: string[];
  allowSupportingVisual: boolean;
  directEvidenceRequired: boolean;
  minimumDirectEvidenceScore: number;
};

export type BeatPanelRequirementsEvaluation = {
  requirements: BeatPanelEvidenceRequirements;
  directEvidenceScore: number;
  meetsMinimum: boolean;
  valid: boolean;
  rejectReason: string | null;
  matchedRequiredEntities: string[];
  matchedPreferredEntities: string[];
  matchedRequiredThemes: string[];
  matchedRelationships: BeatPanelRelationshipType[];
  forbiddenHits: string[];
  evidenceNotes: string[];
};

const ENTITY_ALIASES: Record<string, string> = {
  venom: "venom",
  "homem-aranha": "spider-man",
  "homem aranha": "spider-man",
  "spider-man": "spider-man",
  spiderman: "spider-man",
  "eddie brock": "eddie_brock",
  eddie_brock: "eddie_brock",
  symbiote: "symbiote",
  simbionte: "symbiote",
  "doutor estranho": "doctor_strange",
  "doctor strange": "doctor_strange",
  doctor_strange: "doctor_strange",
  natasha: "black_widow",
  "black widow": "black_widow",
  black_widow: "black_widow",
  "miles morales": "miles_morales",
  miles_morales: "miles_morales",
  "gwen stacy": "gwen_stacy",
  gwen_stacy: "gwen_stacy",
  "homem-aranha 2099": "spider-man_2099",
  "spider-man 2099": "spider-man_2099",
  spider_man_2099: "spider-man_2099"
};

const THEME_ALIASES: Record<string, string> = {
  partnership: "partnership",
  perfect_partner: "partnership",
  parceria: "partnership",
  duo: "partnership",
  symbiosis: "symbiosis",
  simbiose: "symbiosis",
  symbiote: "symbiosis",
  simbionte: "symbiosis",
  black_suit: "symbiosis",
  "traje preto": "symbiosis",
  relationship: "partnership",
  conflict: "conflict"
};

export const VENOM_DUO_IDEAL_BEAT_REQUIREMENTS: BeatPanelEvidenceRequirements = {
  requiredEntities: ["venom"],
  preferredEntities: ["spider-man", "eddie_brock"],
  requiredThemes: ["partnership", "symbiosis"],
  preferredRelationships: ["duo", "host_symbiote", "conflict"],
  forbiddenEntities: [
    "doctor_strange",
    "black_widow",
    "miles_morales",
    "gwen_stacy",
    "spider-man_2099"
  ],
  allowSupportingVisual: false,
  directEvidenceRequired: true,
  minimumDirectEvidenceScore: 80
};

export function normalizeBeatEntityName(name: string): string {
  const key = name.trim().toLowerCase();
  return ENTITY_ALIASES[key] ?? key.replace(/\s+/g, "_");
}

export function normalizeBeatThemeName(theme: string): string {
  const key = theme.trim().toLowerCase();
  return THEME_ALIASES[key] ?? key.replace(/\s+/g, "_");
}

export function extractLocalPanelEntityIds(panel: LocalComicPanelEvidence): string[] {
  return panel.localEvidence.characters
    .filter((entry) => entry.confidence >= 0.5)
    .map((entry) => normalizeBeatEntityName(entry.name));
}

export function extractLocalPanelThemeIds(panel: LocalComicPanelEvidence): string[] {
  const themes = new Set<string>();
  for (const theme of panel.localEvidence.visualThemes) {
    themes.add(normalizeBeatThemeName(theme));
  }
  for (const action of panel.localEvidence.actions) {
    if (/duo|partner|symbiote|symbiosis|black_suit/i.test(action.label)) {
      themes.add(normalizeBeatThemeName(action.label));
    }
  }
  if (panel.localEvidence.relationships.some((rel) => rel.type === "duo")) {
    themes.add("partnership");
  }
  if (
    panel.localEvidence.relationships.some((rel) =>
      ["host_symbiote", "duo"].includes(rel.type)
    )
  ) {
    themes.add("symbiosis");
  }
  return [...themes];
}

export function inferBeatPanelEvidenceRequirements(
  beatText: string
): BeatPanelEvidenceRequirements {
  const lower = beatText.toLowerCase();

  if (
    /\bdupla ideal\b|\bparceiro perfeito\b|\bperfect partner\b/i.test(lower) ||
    (/simbiose|symbiosis|simbionte|symbiote/i.test(lower) &&
      /dupla|duo|parceria|partnership|juntos|qu[ií]mica/i.test(lower))
  ) {
    return { ...VENOM_DUO_IDEAL_BEAT_REQUIREMENTS };
  }

  if (/\bvenom\b/i.test(lower) && /dupla|duo|parceria|partner/i.test(lower)) {
    return {
      ...VENOM_DUO_IDEAL_BEAT_REQUIREMENTS,
      minimumDirectEvidenceScore: 70
    };
  }

  const requiredEntities: string[] = [];
  const preferredEntities: string[] = [];
  const requiredThemes: string[] = [];
  const preferredRelationships: BeatPanelRelationshipType[] = [];

  if (/\bvenom\b/i.test(lower)) requiredEntities.push("venom");
  if (/\b(homem[- ]?aranha|spider[- ]?man)\b/i.test(lower)) {
    preferredEntities.push("spider-man");
  }
  if (/\beddie brock\b/i.test(lower)) preferredEntities.push("eddie_brock");
  if (/simbiose|symbiosis|simbionte|symbiote/i.test(lower)) {
    requiredThemes.push("symbiosis");
  }
  if (/dupla|duo|parceria|partnership|parceiro/i.test(lower)) {
    requiredThemes.push("partnership");
    preferredRelationships.push("duo");
  }
  if (/conflito|conflict|rival/i.test(lower)) {
    preferredRelationships.push("conflict");
  }

  return {
    requiredEntities,
    preferredEntities,
    requiredThemes,
    preferredRelationships,
    forbiddenEntities: [
      "doctor_strange",
      "black_widow",
      "miles_morales",
      "gwen_stacy",
      "spider-man_2099"
    ],
    allowSupportingVisual: false,
    directEvidenceRequired: requiredEntities.length > 0,
    minimumDirectEvidenceScore: requiredEntities.includes("venom") ? 80 : 60
  };
}

export function evaluateLocalPanelAgainstBeatRequirements(input: {
  panel: LocalComicPanelEvidence;
  requirements: BeatPanelEvidenceRequirements;
}): BeatPanelRequirementsEvaluation {
  const { panel, requirements } = input;
  const evidenceNotes: string[] = [];
  const localEntities = extractLocalPanelEntityIds(panel);
  const localThemes = extractLocalPanelThemeIds(panel);
  const localRelationships = panel.localEvidence.relationships
    .filter((rel) => rel.confidence >= 0.5)
    .map((rel) => rel.type);

  const requiredEntities = requirements.requiredEntities.map(normalizeBeatEntityName);
  const preferredEntities = requirements.preferredEntities.map(normalizeBeatEntityName);
  const requiredThemes = requirements.requiredThemes.map(normalizeBeatThemeName);
  const forbiddenEntities = requirements.forbiddenEntities.map(normalizeBeatEntityName);

  const matchedRequiredEntities = requiredEntities.filter((entity) =>
    localEntities.includes(entity)
  );
  const matchedPreferredEntities = preferredEntities.filter((entity) =>
    localEntities.includes(entity)
  );
  const matchedRequiredThemes = requiredThemes.filter((theme) => localThemes.includes(theme));
  const matchedRelationships = requirements.preferredRelationships.filter((rel) =>
    localRelationships.includes(rel)
  );
  const forbiddenHits = forbiddenEntities.filter((entity) => localEntities.includes(entity));

  let directEvidenceScore = 0;

  if (requiredEntities.length > 0) {
    const requiredRatio = matchedRequiredEntities.length / requiredEntities.length;
    directEvidenceScore += Math.round(requiredRatio * 45);
    evidenceNotes.push(`required_entities:${matchedRequiredEntities.join("|") || "none"}`);
  }

  if (requiredThemes.length > 0) {
    const themeRatio = matchedRequiredThemes.length / requiredThemes.length;
    directEvidenceScore += Math.round(themeRatio * 25);
    evidenceNotes.push(`required_themes:${matchedRequiredThemes.join("|") || "none"}`);
  }

  if (preferredEntities.length > 0) {
    const preferredRatio = matchedPreferredEntities.length / preferredEntities.length;
    directEvidenceScore += Math.round(preferredRatio * 15);
    evidenceNotes.push(`preferred_entities:${matchedPreferredEntities.join("|") || "none"}`);
  }

  if (requirements.preferredRelationships.length > 0) {
    const relationshipRatio =
      matchedRelationships.length / requirements.preferredRelationships.length;
    directEvidenceScore += Math.round(relationshipRatio * 15);
    evidenceNotes.push(`preferred_relationships:${matchedRelationships.join("|") || "none"}`);
  }

  const rejectReasons: string[] = [];

  if (forbiddenHits.length > 0) {
    rejectReasons.push(`forbidden_entity_local_evidence:${forbiddenHits.join("|")}`);
    directEvidenceScore = 0;
  }

  if (
    !requirements.allowSupportingVisual &&
    localEntities.includes("spider-man") &&
    !localEntities.includes("venom") &&
    requiredEntities.includes("venom")
  ) {
    rejectReasons.push("supporting_visual_only_spiderman");
    directEvidenceScore = Math.min(directEvidenceScore, 35);
  }

  if (
    requiredEntities.includes("venom") &&
    !matchedRequiredEntities.includes("venom") &&
    panel.parentContext.parentEntities.map(normalizeBeatEntityName).includes("venom")
  ) {
    rejectReasons.push("venom_only_in_parent_context");
    directEvidenceScore = Math.min(directEvidenceScore, 20);
    evidenceNotes.push("reject:parent_context_venom_not_local");
  }

  if (!panel.valid) {
    rejectReasons.push(panel.rejectReason ?? "panel_invalid");
  }

  directEvidenceScore = Math.max(0, Math.min(100, directEvidenceScore));

  const meetsMinimum =
    !requirements.directEvidenceRequired ||
    directEvidenceScore >= requirements.minimumDirectEvidenceScore;

  const valid =
    panel.valid &&
    forbiddenHits.length === 0 &&
    meetsMinimum &&
    matchedRequiredEntities.length === requiredEntities.length &&
    (requiredThemes.length === 0 || matchedRequiredThemes.length > 0) &&
    rejectReasons.length === 0;

  return {
    requirements,
    directEvidenceScore,
    meetsMinimum,
    valid,
    rejectReason: rejectReasons[0] ?? null,
    matchedRequiredEntities,
    matchedPreferredEntities,
    matchedRequiredThemes,
    matchedRelationships,
    forbiddenHits,
    evidenceNotes
  };
}

export function evaluateBeatTextAgainstLocalPanel(input: {
  beatText: string;
  panel: LocalComicPanelEvidence;
}): BeatPanelRequirementsEvaluation {
  return evaluateLocalPanelAgainstBeatRequirements({
    panel: input.panel,
    requirements: inferBeatPanelEvidenceRequirements(input.beatText)
  });
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function computeBeatSpecificFitScore(input: {
  panel: LocalComicPanelEvidence;
  requirement: BeatVisualRequirement;
}): number {
  if (!input.panel.valid || input.panel.isWholePageFallback) {
    return 0;
  }
  if (input.panel.cropAreaRatio > 0.7) {
    return 0;
  }

  const evaluation = evaluateLocalPanelAgainstBeatRequirements({
    panel: input.panel,
    requirements: {
      requiredEntities: input.requirement.requiredEntities,
      preferredEntities: input.requirement.preferredEntities,
      requiredThemes: input.requirement.requiredThemes,
      preferredRelationships: input.requirement.preferredRelationships as BeatPanelRelationshipType[],
      forbiddenEntities: input.requirement.forbiddenEntities,
      allowSupportingVisual: input.requirement.allowSupportingVisual,
      directEvidenceRequired: input.requirement.directEvidenceRequired,
      minimumDirectEvidenceScore: input.requirement.minimumDirectEvidenceScore
    }
  });

  let score = evaluation.directEvidenceScore * 0.5;
  const localThemes = extractLocalPanelThemeIds(input.panel);
  const localEntities = extractLocalPanelEntityIds(input.panel);
  const narration = input.requirement.narrationText.toLowerCase();
  const baseRole = input.requirement.role.replace(/_[ab]$/i, "");

  if (input.requirement.requiredEntities.length > 0) {
    const matched = input.requirement.requiredEntities.filter((entity) =>
      localEntities.includes(normalizeBeatEntityName(entity))
    ).length;
    score += (matched / input.requirement.requiredEntities.length) * 20;
  }

  if (input.requirement.requiredThemes.length > 0) {
    const matched = input.requirement.requiredThemes.filter((theme) =>
      localThemes.includes(normalizeBeatThemeName(theme))
    ).length;
    score += (matched / input.requirement.requiredThemes.length) * 15;
  }

  const storyFunction = input.panel.storyFunction;
  if (baseRole === "hook" && /\bvenom\b/i.test(narration) && input.panel.visualFlags.venomVisible) {
    score += 12;
  }
  if (baseRole === "hook" && ["relationship", "action", "splash"].includes(storyFunction)) score += 10;
  if (baseRole === "climax" && ["relationship", "transformation", "action"].includes(storyFunction)) {
    score += 10;
  }
  if (baseRole === "context" && ["context", "dialogue", "setup"].includes(storyFunction)) score += 8;
  if (baseRole === "development" && ["action", "transformation", "relationship"].includes(storyFunction)) {
    score += 8;
  }
  if (/curiosity/.test(baseRole) && ["context", "dialogue", "reveal"].includes(storyFunction)) score += 8;
  if (baseRole === "closing" && ["reaction", "relationship", "context"].includes(storyFunction)) score += 6;

  if (/quadrinhos|\bhqs?\b|filme|recorte/i.test(narration) && !localThemes.includes("comics_source")) {
    score -= 12;
  }
  if (/simbiose|symbiosis|simbionte/i.test(narration)) {
    if (localThemes.includes("symbiosis") || input.panel.visualFlags.symbioteVisible) {
      score += 10;
    } else {
      score -= 15;
    }
  }
  if (/\bvenom\b/i.test(narration) && input.panel.visualFlags.venomVisible) {
    score += 8;
  }
  if (/hqs?|quadrinhos|marvel/i.test(narration) && localThemes.includes("comics_source")) {
    score += 6;
  }
  if (/dupla ideal|parceiro perfeito|perfect partner/i.test(narration) && !localThemes.includes("partnership")) {
    score -= 15;
  }

  if (
    input.panel.evidenceTier === "supporting_only" &&
    (baseRole === "hook" || baseRole === "climax" || baseRole === "development")
  ) {
    score = Math.min(score, 45);
  }

  if (evaluation.forbiddenHits.length > 0) {
    return 0;
  }

  return clampScore(score);
}