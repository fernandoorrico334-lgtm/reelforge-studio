import { spawn } from "node:child_process";
import { constants } from "node:fs";
import { access, mkdir, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import {
  extractLocalPanelEntityIds,
  extractLocalPanelThemeIds,
  normalizeBeatEntityName
} from "./comics-beat-panel-requirements.js";
import {
  isOversizedStoryMixedCrop,
  isPromotionalPanelRegion,
  type ComicPageType,
  type LocalComicPanelEvidence
} from "./comics-local-panel-index.js";
import {
  buildComicPanelSequences,
  findSequenceForPanel,
  type ComicPanelSequence
} from "./comics-panel-sequences.js";

export const SCENE_FIRST_PROPOSALS_FILENAME = "variation-b-scene-first-proposals.json";
export const SCENE_FIRST_BEST_SCRIPT_FILENAME = "variation-b-scene-first-best-script.json";
export const SCENE_FIRST_STORYBOARD_CONTACT_SHEET_FILENAME =
  "variation-b-scene-first-storyboard-contact-sheet.jpg";

export const SCENE_FIRST_ALIGNMENT_THRESHOLDS = {
  hook: 90,
  climax: 90,
  other: 80,
  average: 85
} as const;

export const SCENE_FIRST_PROPOSAL_THRESHOLDS = {
  topicSupport: 80,
  continuity: 70,
  visualClarity: 70,
  materialCoverage: 80
} as const;

export const FORBIDDEN_NARRATION_PHRASES = [
  "venom na tela",
  "venom no foco",
  "o corte mostra",
  "a cena aparece",
  "aqui vemos",
  "neste frame",
  "a dupla ideal existe",
  "isso vem dos quadrinhos",
  "o detalhe vem agora",
  "olha só isso",
  "sem repetir o visual",
  "o contexto muda a leitura",
  "fica até o fim",
  "o painel seguinte",
  "neste painel"
] as const;

export type NarrationEvidenceType =
  | "direct_current_scene"
  | "adjacent_scene_sequence"
  | "local_dialogue"
  | "local_narration_box"
  | "authorized_context"
  | "unsupported";

export interface SceneEvidenceContract {
  sceneId: string;
  panelId: string;
  panelImagePath: string;
  panelImageSha256: string;
  pageNumber: number;
  panelNumber: number;

  literalDescription: string;

  visibleEntities: Array<{
    name: string;
    confidence: number;
  }>;

  visibleActions: Array<{
    action: string;
    confidence: number;
  }>;

  visibleRelationships: Array<{
    type:
      | "duo"
      | "conflict"
      | "host_symbiote"
      | "conversation"
      | "transformation"
      | "reaction"
      | "unknown";
    entities: string[];
    confidence: number;
  }>;

  visibleThemes: string[];
  localDialogue: string[];
  localNarrationBoxes: string[];

  allowedClaims: string[];
  forbiddenClaims: string[];

  evidenceConfidence: number;
}

export interface SceneFirstStoryProposal {
  proposalId: string;
  title: string;
  topic: string;
  angle: string;

  sceneIds: string[];
  panelIds: string[];

  visualArc: {
    setup: string;
    development: string;
    payoff: string;
  };

  topicSupportScore: number;
  continuityScore: number;
  visualClarityScore: number;
  materialCoverageScore: number;
  overallScore: number;

  unsupportedIdeas: string[];
  warnings: string[];
}

export interface SceneFirstNarrationCue {
  beatId: string;
  role: "hook" | "context" | "development" | "climax" | "closing";

  sceneId: string;
  panelId: string;

  startSec: number;
  endSec: number;

  narrationText: string;

  narrationPurpose:
    | "explain_visible_action"
    | "add_consequence"
    | "connect_sequence"
    | "reveal_local_context"
    | "deliver_payoff"
    | "ask_grounded_question";

  evidenceReferences: string[];
  sceneNarrationAlignmentScore: number;
  warnings: string[];
}

export interface SceneShotValidation {
  subjectVisible: boolean;
  mainActionVisible: boolean;
  importantContextVisible: boolean;

  subjectOccupancyRatio: number;
  importantContentLossRatio: number;

  abstractFragmentDetected: boolean;
  excessiveZoomRequired: boolean;

  recommendedFit:
    | "cover"
    | "contain_blurred_background"
    | "smart_crop"
    | "split_panel";

  valid: boolean;
  reasons: string[];
}

export type SceneFirstStoryboardEntry = {
  sceneId: string;
  panelId: string;
  panelImagePath: string;
  literalDescription: string;
  visibleEntities: string[];
  visibleActions: string[];
  visibleRelationships: string[];
  narrationText: string;
  narrationPurpose: SceneFirstNarrationCue["narrationPurpose"];
  evidenceReferences: string[];
  alignmentScore: number;
  shotValidation: SceneShotValidation;
  startSec: number;
  endSec: number;
};

export type SceneFirstPipelineResult = {
  generatedAt: string;
  proposals: SceneFirstStoryProposal[];
  selectedProposal: SceneFirstStoryProposal | null;
  perfectPartnerRejected: boolean;
  scenes: SceneEvidenceContract[];
  narrationCues: SceneFirstNarrationCue[];
  storyboard: SceneFirstStoryboardEntry[];
  unsupportedNarrationCueCount: number;
  genericNarrationPhraseCount: number;
  hookAlignmentScore: number;
  climaxAlignmentScore: number;
  averageAlignmentScore: number;
  invalidShotCount: number;
  wrongCharacterCount: number;
  promotionalSceneCount: number;
  canRender: boolean;
  canPublish: boolean;
  blockReason: string | null;
  proposalsPath: string | null;
  scriptPath: string | null;
  storyboardContactSheetPath: string | null;
};

const ENTITY_DISPLAY: Record<string, string> = {
  venom: "Venom",
  "spider-man": "Homem-Aranha",
  symbiote: "simbionte",
  eddie_brock: "Eddie Brock",
  doctor_strange: "Doutor Estranho",
  black_widow: "Natasha"
};

const BEAT_TIMING: Record<SceneFirstNarrationCue["role"], { startSec: number; endSec: number }> = {
  hook: { startSec: 0, endSec: 4.5 },
  context: { startSec: 4.5, endSec: 9 },
  development: { startSec: 9, endSec: 21 },
  climax: { startSec: 21, endSec: 28 },
  closing: { startSec: 28, endSec: 32 }
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function displayEntity(entity: string): string {
  return ENTITY_DISPLAY[entity] ?? entity.replace(/_/g, " ");
}

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function detectGenericNarrationPhrase(text: string): boolean {
  const normalized = normalizeText(text);
  if (FORBIDDEN_NARRATION_PHRASES.some((phrase) => normalized.includes(normalizeText(phrase)))) {
    return true;
  }
  if (normalized.length < 24) return true;
  if (
    !/[—–-]/.test(text) &&
    !/\b(porque|quando|depois|enquanto|mas|e o|e a|não ao|não é)\b/i.test(text)
  ) {
    if (!/\?/.test(text)) return true;
  }
  return false;
}

function buildLiteralDescription(panel: LocalComicPanelEvidence): string {
  const entities = extractLocalPanelEntityIds(panel).map(displayEntity);
  const actions = panel.localEvidence.actions
    .filter((entry) => entry.confidence >= 0.5)
    .map((entry) => entry.label.replace(/_/g, " "));
  const relationships = panel.localEvidence.relationships
    .filter((entry) => entry.confidence >= 0.5)
    .map((entry) => entry.type.replace(/_/g, " "));

  if (actions.length > 0 && entities.length > 0) {
    return `${entities.join(" e ")} ${actions[0]}.`;
  }
  if (relationships.includes("host symbiote") && entities.includes("Homem-Aranha")) {
    return "O traje preto envolve o corpo do Homem-Aranha.";
  }
  if (relationships.includes("conflict") && entities.length >= 1) {
    return `${entities.join(" e ")} entram em confronto direto.`;
  }
  if (entities.length > 0) {
    return `${entities.join(" e ")} aparecem na cena.`;
  }
  if (panel.localEvidence.narrationBoxes.length > 0) {
    return panel.localEvidence.narrationBoxes[0]!.slice(0, 120);
  }
  return "Ação visual sem personagem identificado com confiança.";
}

function buildAllowedClaims(panel: LocalComicPanelEvidence): string[] {
  const claims: string[] = [];
  const entities = extractLocalPanelEntityIds(panel);
  const themes = extractLocalPanelThemeIds(panel);

  for (const action of panel.localEvidence.actions) {
    if (action.confidence >= 0.55) {
      claims.push(action.label.replace(/_/g, " "));
    }
  }
  for (const rel of panel.localEvidence.relationships) {
    if (rel.confidence >= 0.55) {
      if (rel.type === "host_symbiote") {
        claims.push("há uma ligação entre o personagem e o simbionte");
        claims.push("o traje está se transformando");
      }
      if (rel.type === "conflict") claims.push("há confronto entre os personagens");
      if (rel.type === "duo" && entities.includes("venom") && entities.includes("spider-man")) {
        claims.push("Venom e Homem-Aranha compartilham a mesma cena");
      }
    }
  }
  if (themes.includes("symbiosis")) {
    claims.push("a transformação envolve o simbionte");
  }
  if (panel.localEvidence.dialogue.length > 0) {
    claims.push(`diálogo local: ${panel.localEvidence.dialogue[0]!.slice(0, 80)}`);
  }
  if (panel.localEvidence.narrationBoxes.length > 0) {
    claims.push(`caixa narrativa: ${panel.localEvidence.narrationBoxes[0]!.slice(0, 80)}`);
  }
  return [...new Set(claims)].slice(0, 8);
}

function buildForbiddenClaims(panel: LocalComicPanelEvidence): string[] {
  const entities = extractLocalPanelEntityIds(panel);
  const forbidden: string[] = [];

  if (!entities.includes("venom")) {
    forbidden.push("Venom aparece", "Venom no foco", "a dupla Venom e Homem-Aranha");
  }
  if (!entities.includes("spider-man")) {
    forbidden.push("Homem-Aranha lidera a cena sozinho com dupla");
  }
  if (!(entities.includes("venom") && entities.includes("spider-man"))) {
    forbidden.push("Venom e Homem-Aranha formam uma dupla", "parceiro perfeito", "dupla ideal");
  }
  if (!entities.includes("eddie_brock")) {
    forbidden.push("Eddie Brock aparece");
  }
  if (panel.visualFlags.doctorStrangeVisible || entities.includes("doctor_strange")) {
    // no extra forbidden
  } else {
    forbidden.push("Doutor Estranho participa da cena");
  }
  if (!panel.visualFlags.unrelatedCharacterVisible && !entities.includes("black_widow")) {
    forbidden.push("Natasha participa da cena");
  }
  if (entities.includes("doctor_strange") || panel.visualFlags.doctorStrangeVisible) {
    forbidden.push("Venom e Homem-Aranha formam uma dupla");
  }
  return forbidden;
}

export function buildSceneEvidenceContract(panel: LocalComicPanelEvidence): SceneEvidenceContract {
  const entities = extractLocalPanelEntityIds(panel);
  return {
    sceneId: `scene-${panel.panelId}`,
    panelId: panel.panelId,
    panelImagePath: panel.panelImagePath,
    panelImageSha256: panel.panelImageSha256,
    pageNumber: panel.pageNumber,
    panelNumber: panel.panelNumber,
    literalDescription: buildLiteralDescription(panel),
    visibleEntities: entities.map((name) => ({
      name: displayEntity(name),
      confidence: Number(
        (
          panel.localEvidence.characters.find(
            (entry) => normalizeBeatEntityName(entry.name) === name
          )?.confidence ?? panel.confidence.characters
        ).toFixed(2)
      )
    })),
    visibleActions: panel.localEvidence.actions
      .filter((entry) => entry.confidence >= 0.45)
      .map((entry) => ({
        action: entry.label.replace(/_/g, " "),
        confidence: entry.confidence
      })),
    visibleRelationships: panel.localEvidence.relationships
      .filter((entry) => entry.confidence >= 0.45)
      .map((entry) => ({
        type: entry.type,
        entities: entry.entities.map(displayEntity),
        confidence: entry.confidence
      })),
    visibleThemes: extractLocalPanelThemeIds(panel),
    localDialogue: [...panel.localEvidence.dialogue],
    localNarrationBoxes: [...panel.localEvidence.narrationBoxes],
    allowedClaims: buildAllowedClaims(panel),
    forbiddenClaims: buildForbiddenClaims(panel),
    evidenceConfidence: Number(panel.confidence.overall.toFixed(2))
  };
}

function hasConfirmedCropEvidence(panel: LocalComicPanelEvidence): boolean {
  const confirmedCharacters = panel.localEvidence.characters.some((entry) => entry.confidence >= 0.8);
  const confirmedRelationships = panel.localEvidence.relationships.some(
    (entry) => entry.confidence >= 0.55
  );
  const confirmedActions = panel.localEvidence.actions.some((entry) => entry.confidence >= 0.8);
  return (
    confirmedCharacters ||
    confirmedRelationships ||
    confirmedActions ||
    panel.evidenceTier === "direct_evidence" ||
    panel.visualFlags.duoVisible ||
    panel.visualFlags.venomVisible ||
    panel.visualFlags.symbioteVisible
  );
}

function editTechniqueRescuesShot(input: {
  panel: LocalComicPanelEvidence;
  excessiveZoomRequired: boolean;
  isHorizontal: boolean;
}): boolean {
  if (!input.panel.isActualPanelCrop || !hasConfirmedCropEvidence(input.panel)) {
    return false;
  }
  if (input.panel.visualFlags.unrelatedCharacterVisible || input.panel.visualFlags.doctorStrangeVisible) {
    return false;
  }
  if (input.panel.quality.textHeavyRatio > 0.55) return false;
  return input.excessiveZoomRequired || input.isHorizontal;
}

export function validateSceneShot(input: {
  panel: LocalComicPanelEvidence;
  pageType?: ComicPageType;
}): SceneShotValidation {
  const { panel } = input;
  const pageType = input.pageType ?? "story";
  const bounds = panel.cropBounds;
  const aspect = bounds.width / Math.max(1, bounds.height);
  const isHorizontal = aspect > 1.15;
  const entities = extractLocalPanelEntityIds(panel);
  const subjectVisible =
    entities.length > 0 ||
    panel.localEvidence.actions.some((entry) => entry.confidence >= 0.5) ||
    panel.localEvidence.relationships.some((entry) => entry.confidence >= 0.55);
  const mainActionVisible =
    panel.localEvidence.actions.some((entry) => entry.confidence >= 0.5) ||
    panel.localEvidence.relationships.some((entry) => entry.confidence >= 0.55);
  const importantContextVisible =
    panel.localEvidence.dialogue.length > 0 ||
    panel.localEvidence.narrationBoxes.length > 0 ||
    panel.localEvidence.relationships.length > 0 ||
    mainActionVisible;

  const characterConfidence =
    panel.localEvidence.characters.length > 0
      ? panel.localEvidence.characters.reduce((sum, entry) => sum + entry.confidence, 0) /
        panel.localEvidence.characters.length
      : 0;
  const subjectOccupancyRatio = clamp(
    Math.max(panel.quality.cropability916Score / 100, characterConfidence * 0.45),
    0,
    1
  );
  const importantContentLossRatio = clamp(
    panel.isWholePageFallback ? 0.45 : Math.max(0, 1 - panel.quality.cropability916Score / 100),
    0,
    1
  );

  const abstractFragmentDetected =
    panel.quality.textHeavyRatio > 0.55 ||
    (!subjectVisible && panel.quality.textHeavyRatio > 0.35);
  const excessiveZoomRequired =
    panel.quality.cropability916Score < 45 ||
    (isHorizontal && panel.quality.cropability916Score < 58);
  const editRescued = editTechniqueRescuesShot({
    panel,
    excessiveZoomRequired,
    isHorizontal
  });

  const reasons: string[] = [];
  if (!subjectVisible && panel.storyFunction !== "setup") {
    reasons.push("subject_not_visible");
  }
  if (
    !mainActionVisible &&
    panel.storyFunction !== "reaction" &&
    panel.storyFunction !== "setup" &&
    panel.storyFunction !== "relationship"
  ) {
    reasons.push("main_action_not_visible");
  }
  if (abstractFragmentDetected) reasons.push("abstract_fragment");
  if (excessiveZoomRequired && !editRescued) reasons.push("excessive_zoom_required");
  if (subjectOccupancyRatio < 0.35 && !editRescued) {
    reasons.push("subject_occupancy_below_35pct");
  }
  if (importantContentLossRatio > 0.35 && !editRescued) {
    reasons.push("important_content_loss_above_35pct");
  }
  if (
    isOversizedStoryMixedCrop({
      pageType,
      cropAreaRatio: panel.cropAreaRatio
    })
  ) {
    reasons.push("oversized_story_mixed_crop");
  }
  if (panel.visualFlags.unrelatedCharacterVisible) reasons.push("off_theme_character_visible");

  const promo = isPromotionalPanelRegion({
    title: panel.parentContext.pageTitle ?? "",
    tags: panel.parentContext.parentTags,
    visual: {
      analyzable: true,
      eligible: false,
      rejectReason: null,
      duoVisualScore: 0,
      visualTags: panel.localEvidence.visualThemes,
      profile: null,
      warnings: []
    }
  });
  if (promo.reject) reasons.push("promotional_scene");

  let recommendedFit: SceneShotValidation["recommendedFit"] = "smart_crop";
  if (editRescued || isHorizontal) recommendedFit = "smart_crop";
  else if (panel.cropAreaRatio > 0.65) recommendedFit = "cover";
  else if (panel.estimatedPanelCount > 1) recommendedFit = "split_panel";

  return {
    subjectVisible,
    mainActionVisible,
    importantContextVisible,
    subjectOccupancyRatio,
    importantContentLossRatio,
    abstractFragmentDetected,
    excessiveZoomRequired,
    recommendedFit,
    valid: reasons.length === 0,
    reasons
  };
}

function scorePanelVisualClarity(panel: LocalComicPanelEvidence): number {
  const shot = validateSceneShot({ panel, pageType: "story" });
  const cropabilityForScore =
    shot.valid && shot.recommendedFit === "smart_crop"
      ? Math.max(panel.quality.cropability916Score, 62)
      : panel.quality.cropability916Score;
  let score = panel.quality.visualQualityScore * 0.45;
  score += cropabilityForScore * 0.35;
  score += panel.confidence.overall * 20;
  if (panel.evidenceTier === "direct_evidence") score += 8;
  if (shot.valid && shot.recommendedFit === "smart_crop") score += 6;
  if (panel.isWholePageFallback) score -= 30;
  return clamp(Math.round(score), 0, 100);
}

function panelsForSequence(
  sequence: ComicPanelSequence,
  panelById: Map<string, LocalComicPanelEvidence>,
  pageTypeByPanelId?: Map<string, ComicPageType>
): LocalComicPanelEvidence[] {
  return sequence.panelIds
    .map((panelId) => panelById.get(panelId))
    .filter((panel): panel is LocalComicPanelEvidence => {
      if (!panel?.valid) return false;
      const shot = validateSceneShot({
        panel,
        pageType: pageTypeByPanelId?.get(panel.panelId) ?? "story"
      });
      return shot.valid;
    });
}

function duoSupportScore(panels: LocalComicPanelEvidence[]): number {
  if (panels.length === 0) return 0;
  const duoPanels = panels.filter(panelSupportsDuo).length;
  return clamp(Math.round((duoPanels / panels.length) * 100), 0, 100);
}

function panelSupportsDuo(panel: LocalComicPanelEvidence): boolean {
  const entities = extractLocalPanelEntityIds(panel);
  return (
    entities.includes("venom") &&
    entities.includes("spider-man") &&
    panel.localEvidence.relationships.some((rel) => rel.type === "duo" && rel.confidence >= 0.55)
  );
}

function panelSupportsSymbioteTransformation(panel: LocalComicPanelEvidence): boolean {
  return (
    extractLocalPanelThemeIds(panel).includes("symbiosis") ||
    panel.localEvidence.relationships.some((rel) => rel.type === "host_symbiote")
  );
}

function sortPanelsForStory(panels: LocalComicPanelEvidence[]): LocalComicPanelEvidence[] {
  return [...panels].sort((left, right) => {
    if (left.pageNumber !== right.pageNumber) return left.pageNumber - right.pageNumber;
    return left.readingOrder - right.readingOrder;
  });
}

function sameEditionPanel(left: LocalComicPanelEvidence, right: LocalComicPanelEvidence): boolean {
  const leftTitle = left.parentContext.comicTitle ?? left.parentContext.issueTitle ?? "";
  const rightTitle = right.parentContext.comicTitle ?? right.parentContext.issueTitle ?? "";
  return leftTitle.length > 0 && leftTitle === rightTitle;
}

function crossPanelContinuityScore(panels: LocalComicPanelEvidence[]): number {
  if (panels.length < 2) return 50;
  let total = 0;
  for (let index = 1; index < panels.length; index += 1) {
    const previous = panels[index - 1]!;
    const current = panels[index]!;
    if (previous.nextPanelId === current.panelId || previous.sequenceId === current.sequenceId) {
      total += 100;
    } else if (
      previous.pageNumber === current.pageNumber &&
      previous.panelId.split(":").slice(0, 2).join(":") === current.panelId.split(":").slice(0, 2).join(":")
    ) {
      total += 90;
    } else if (sameEditionPanel(previous, current)) {
      total += 74;
    } else {
      total += 58;
    }
  }
  return clamp(Math.round(total / (panels.length - 1)), 0, 100);
}

function proposalFromPanels(input: {
  panels: LocalComicPanelEvidence[];
  topic: string;
  title: string;
  angle: string;
  proposalId: string;
  continuityScore: number;
}): SceneFirstStoryProposal {
  const { panels } = input;
  const clarity =
    panels.length > 0
      ? Math.round(
          panels.reduce((sum, panel) => sum + scorePanelVisualClarity(panel), 0) / panels.length
        )
      : 0;
  const coverage =
    panels.length >= 6
      ? 100
      : panels.length >= 4
        ? 92
        : panels.length >= 3
          ? 84
          : clamp(Math.round((panels.length / 3) * 80), 0, 79);
  const topicSupport =
    input.topic === "parceiro_perfeito"
      ? duoSupportScore(panels)
      : input.topic === "transformacao_traje_preto"
        ? clamp(
            Math.round(
              (panels.filter((panel) =>
                extractLocalPanelThemeIds(panel).includes("symbiosis") ||
                panel.localEvidence.relationships.some((rel) => rel.type === "host_symbiote")
              ).length /
                Math.max(1, panels.length)) *
                100
            ),
            0,
            100
          )
        : input.topic === "conflito_venom_aranha"
          ? clamp(
              Math.round(
                (panels.filter((panel) =>
                  panel.localEvidence.relationships.some((rel) => rel.type === "conflict")
                ).length /
                  Math.max(1, panels.length)) *
                  100
              ),
              0,
              100
            )
          : clarity;

  const unsupportedIdeas: string[] = [];
  if (input.topic === "parceiro_perfeito" && topicSupport < SCENE_FIRST_PROPOSAL_THRESHOLDS.topicSupport) {
    unsupportedIdeas.push("parceiro_perfeito_sem_dupla_visivel");
  }

  const overall = Math.round(
    topicSupport * 0.35 +
      input.continuityScore * 0.25 +
      clarity * 0.2 +
      coverage * 0.2
  );

  return {
    proposalId: input.proposalId,
    title: input.title,
    topic: input.topic,
    angle: input.angle,
    sceneIds: panels.map((panel) => `scene-${panel.panelId}`),
    panelIds: panels.map((panel) => panel.panelId),
    visualArc: {
      setup: buildLiteralDescription(panels[0] ?? panels[panels.length - 1]!),
      development:
        panels.length > 2
          ? buildLiteralDescription(panels[Math.floor(panels.length / 2)]!)
          : buildLiteralDescription(panels[0]!),
      payoff: buildLiteralDescription(panels[panels.length - 1]!)
    },
    topicSupportScore: topicSupport,
    continuityScore: input.continuityScore,
    visualClarityScore: clarity,
    materialCoverageScore: coverage,
    overallScore: overall,
    unsupportedIdeas,
    warnings: unsupportedIdeas
  };
}

function proposalFromSequence(input: {
  sequence: ComicPanelSequence;
  panels: LocalComicPanelEvidence[];
  topic: string;
  title: string;
  angle: string;
  proposalId: string;
}): SceneFirstStoryProposal {
  return proposalFromPanels({
    ...input,
    continuityScore: input.sequence.continuityScore
  });
}

function buildCompositeStoryProposals(input: {
  validPanels: LocalComicPanelEvidence[];
  topicSpecs: Array<{
    topic: string;
    title: string;
    angle: string;
    panelFilter: (panel: LocalComicPanelEvidence) => boolean;
  }>;
}): SceneFirstStoryProposal[] {
  const proposals: SceneFirstStoryProposal[] = [];
  for (const spec of input.topicSpecs) {
    const matched = sortPanelsForStory(
      input.validPanels.filter((panel) => spec.panelFilter(panel))
    );
    if (matched.length < 3) continue;

    const ranked = [...matched].sort(
      (left, right) => scorePanelVisualClarity(right) - scorePanelVisualClarity(left)
    );
    const selectedIds = new Set(ranked.slice(0, 6).map((panel) => panel.panelId));
    const ordered = sortPanelsForStory(matched.filter((panel) => selectedIds.has(panel.panelId)));
    const panels = ordered.slice(0, Math.min(6, ordered.length));
    if (panels.length < 3) continue;

    proposals.push(
      proposalFromPanels({
        panels,
        topic: spec.topic,
        title: spec.title,
        angle: spec.angle,
        proposalId: `composite:${spec.topic}:${panels.map((panel) => panel.panelId).join("|")}`,
        continuityScore: crossPanelContinuityScore(panels)
      })
    );
  }
  return proposals;
}

export function generateSceneFirstStoryProposals(input: {
  panels: LocalComicPanelEvidence[];
  pageTypeByPanelId?: Map<string, ComicPageType>;
}): SceneFirstStoryProposal[] {
  const validPanels = input.panels.filter((panel) => {
    if (!panel.valid) return false;
    const shot = validateSceneShot({
      panel,
      pageType: input.pageTypeByPanelId?.get(panel.panelId) ?? "story"
    });
    return shot.valid;
  });
  const panelById = new Map(validPanels.map((panel) => [panel.panelId, panel]));
  const sequences = buildComicPanelSequences(validPanels).slice(0, 8);

  const candidates: SceneFirstStoryProposal[] = [];
  const usedPanelSets = new Set<string>();

  const topicSpecs: Array<{
    topic: string;
    title: string;
    angle: string;
    filter: (panels: LocalComicPanelEvidence[]) => boolean;
    panelFilter: (panel: LocalComicPanelEvidence) => boolean;
  }> = [
    {
      topic: "transformacao_traje_preto",
      title: "Transformação do traje preto",
      angle: "O simbionte envolve o corpo e muda o controle da cena.",
      filter: (panels) => panels.some(panelSupportsSymbioteTransformation),
      panelFilter: panelSupportsSymbioteTransformation
    },
    {
      topic: "conflito_venom_aranha",
      title: "Confronto entre Venom e Homem-Aranha",
      angle: "A rivalidade explode quando os dois se reconhecem na mesma cena.",
      filter: (panels) =>
        panels.some((panel) =>
          panel.localEvidence.relationships.some((rel) => rel.type === "conflict")
        ),
      panelFilter: (panel) =>
        panel.localEvidence.relationships.some((rel) => rel.type === "conflict")
    },
    {
      topic: "parceiro_perfeito",
      title: "Parceiro perfeito",
      angle: "Dupla Venom e Homem-Aranha só se a cena mostrar os dois juntos.",
      filter: (panels) => duoSupportScore(panels) >= 50,
      panelFilter: panelSupportsDuo
    },
    {
      topic: "sequencia_acao",
      title: "Sequência de ação",
      angle: "Ação contínua com começo, escalada e reação.",
      filter: (panels) =>
        panels.some((panel) => panel.storyFunction === "action" || panel.storyFunction === "climax"),
      panelFilter: (panel) => panel.storyFunction === "action" || panel.storyFunction === "climax"
    },
    {
      topic: "reacao_revelacao",
      title: "Reação após revelação",
      angle: "Um detalhe muda a leitura e o personagem reage na sequência.",
      filter: (panels) =>
        panels.some(
          (panel) => panel.storyFunction === "reveal" || panel.storyFunction === "reaction"
        ),
      panelFilter: (panel) => panel.storyFunction === "reveal" || panel.storyFunction === "reaction"
    }
  ];

  for (const sequence of sequences) {
    const seqPanels = panelsForSequence(sequence, panelById, input.pageTypeByPanelId).slice(0, 6);
    if (seqPanels.length < 3) continue;
    const key = seqPanels.map((panel) => panel.panelId).join("|");
    if (usedPanelSets.has(key)) continue;

    for (const spec of topicSpecs) {
      if (!spec.filter(seqPanels)) continue;
      const proposal = proposalFromSequence({
        sequence,
        panels: seqPanels,
        topic: spec.topic,
        title: spec.title,
        angle: spec.angle,
        proposalId: `${spec.topic}:${sequence.sequenceId}`
      });
      candidates.push(proposal);
      usedPanelSets.add(key);
      break;
    }
  }

  const composite = buildCompositeStoryProposals({
    validPanels,
    topicSpecs: topicSpecs.map((spec) => ({
      topic: spec.topic,
      title: spec.title,
      angle: spec.angle,
      panelFilter: spec.panelFilter
    }))
  });
  for (const proposal of composite) {
    const key = proposal.panelIds.join("|");
    if (usedPanelSets.has(key)) continue;
    candidates.push(proposal);
    usedPanelSets.add(key);
  }

  const ranked = [...candidates].sort((left, right) => right.overallScore - left.overallScore);
  const top = ranked.slice(0, 3);

  if (top.length < 3 && validPanels.length >= 3) {
    const ordered = sortPanelsForStory(validPanels);
    for (let size = 3; size <= Math.min(4, ordered.length) && top.length < 3; size += 1) {
      for (let start = 0; start <= ordered.length - size && top.length < 3; start += 1) {
        const fallbackPanels = ordered.slice(start, start + size);
        const key = fallbackPanels.map((panel) => panel.panelId).join("|");
        if (usedPanelSets.has(key)) continue;
        top.push(
          proposalFromPanels({
            panels: fallbackPanels,
            topic: "mini_historia_visual",
            title: `Mini-história visual ${top.length + 1}`,
            angle: "Sequência local com setup e payoff visíveis.",
            proposalId: `mini_historia:${key}`,
            continuityScore: crossPanelContinuityScore(fallbackPanels)
          })
        );
        usedPanelSets.add(key);
      }
    }
  }

  return top.slice(0, 3);
}

export function selectSceneFirstStoryProposal(
  proposals: SceneFirstStoryProposal[]
): SceneFirstStoryProposal | null {
  const passing = proposals.filter(
    (proposal) =>
      proposal.topicSupportScore >= SCENE_FIRST_PROPOSAL_THRESHOLDS.topicSupport &&
      proposal.continuityScore >= SCENE_FIRST_PROPOSAL_THRESHOLDS.continuity &&
      proposal.visualClarityScore >= SCENE_FIRST_PROPOSAL_THRESHOLDS.visualClarity &&
      proposal.materialCoverageScore >= SCENE_FIRST_PROPOSAL_THRESHOLDS.materialCoverage
  );
  if (passing.length === 0) return null;
  return [...passing].sort((left, right) => right.overallScore - left.overallScore)[0] ?? null;
}

function narrationPurposeForRole(
  role: SceneFirstNarrationCue["role"],
  index: number,
  total: number
): SceneFirstNarrationCue["narrationPurpose"] {
  if (role === "hook") return "explain_visible_action";
  if (role === "context") return "reveal_local_context";
  if (role === "development") return index === 0 ? "connect_sequence" : "add_consequence";
  if (role === "climax") return "deliver_payoff";
  return "ask_grounded_question";
}

function composeNarrationText(input: {
  scene: SceneEvidenceContract;
  role: SceneFirstNarrationCue["role"];
  proposal: SceneFirstStoryProposal;
  panel: LocalComicPanelEvidence;
  previousScene?: SceneEvidenceContract;
}): string {
  const entities = input.scene.visibleEntities.map((entry) => entry.name);
  const entityIds = extractLocalPanelEntityIds(input.panel);
  const action = input.scene.visibleActions[0]?.action ?? input.scene.literalDescription;
  const rel = input.scene.visibleRelationships[0]?.type ?? "unknown";
  const duoVisible = entityIds.includes("venom") && entityIds.includes("spider-man");
  const symbioteOnly =
    entityIds.includes("symbiote") && !entityIds.includes("venom") && !entityIds.includes("spider-man");

  if (
    input.proposal.topic === "parceiro_perfeito" &&
    entities.includes("Venom") &&
    entities.includes("Homem-Aranha")
  ) {
    if (input.role === "hook") {
      return "Venom e Homem-Aranha dividem o mesmo quadro — e a tensão entre os dois começa ali mesmo.";
    }
    if (input.role === "context") {
      return "Os dois ocupam o mesmo espaço visual — e a relação entre eles deixa de ser abstrata na hora.";
    }
    if (input.role === "development") {
      return input.previousScene
        ? "A presença dos dois na sequência confirma o vínculo — e cada corte reforça que ninguém está sozinho na cena."
        : "A dupla permanece visível cena a cena — e isso sustenta a leitura de parceria sem inventar contexto.";
    }
    if (input.role === "climax") {
      return "O confronto fica explícito quando nenhum dos dois recua — a cena entrega o payoff da rivalidade.";
    }
    return "Depois de ver os dois juntos em sequência, ainda faz sentido tratar essa relação como coincidência?";
  }

  if (
    rel === "host_symbiote" ||
    (input.scene.visibleThemes.includes("symbiosis") &&
      input.proposal.topic !== "parceiro_perfeito")
  ) {
    if (input.role === "hook") {
      return "O traje começa a envolver o corpo — e o personagem perde o controle da situação.";
    }
    if (input.role === "context") {
      return "Repara no traje preto: ele não funciona como roupa comum, mas como parte do próprio corpo.";
    }
    if (input.role === "development") {
      if (symbioteOnly) {
        return "A massa do simbionte domina o quadro — e o vínculo deixa de parecer algo que dá para ignorar.";
      }
      if (duoVisible) {
        return input.previousScene
          ? "A presença dos dois na sequência confirma a transformação — e cada corte reforça a ligação com o simbionte."
          : "A transformação avança cena a cena — cada detalhe reforça a ligação com o simbionte.";
      }
      return "A transformação avança cena a cena — cada detalhe reforça a ligação com o simbionte.";
    }
    if (input.role === "climax") {
      if (duoVisible && rel === "duo") {
        return "O clímax fecha com os dois no mesmo quadro — e a simbiose deixa de ser detalhe para virar eixo da cena.";
      }
      return "A mudança deixa de ser visual — o corpo responde ao simbionte, não ao herói.";
    }
    return "Depois dessa transformação, ainda dá para dizer que ele está lutando sozinho?";
  }

  if (rel === "conflict") {
    if (input.role === "hook") {
      return "Os dois entram em confronto porque o simbionte reconhece exatamente quem está na frente dele.";
    }
    if (input.role === "climax") {
      return "O embate explode no clímax — a rivalidade deixa de ser subtexto e vira ação visível.";
    }
    return `${entities[0] ?? "O personagem"} reage ao choque direto — e a sequência não dá trégua.`;
  }

  if (input.scene.localDialogue.length > 0) {
    return `O diálogo local confirma o que a imagem mostra: ${input.scene.localDialogue[0]!.slice(0, 90)}.`;
  }

  return `${input.scene.literalDescription.replace(/\.$/, "")} — e isso muda o rumo da sequência.`;
}

export function validateSceneNarrationAlignment(input: {
  scene: SceneEvidenceContract;
  narration: SceneFirstNarrationCue;
}): {
  ok: boolean;
  score: number;
  unsupportedEntities: string[];
  unsupportedActions: string[];
  unsupportedRelationships: string[];
  genericPhraseDetected: boolean;
  reasons: string[];
} {
  const text = normalizeText(input.narration.narrationText);
  const sceneEntities = input.scene.visibleEntities.map((entry) => normalizeText(entry.name));
  const unsupportedEntities: string[] = [];
  const unsupportedActions: string[] = [];
  const unsupportedRelationships: string[] = [];
  const reasons: string[] = [];

  for (const forbidden of input.scene.forbiddenClaims) {
    if (text.includes(normalizeText(forbidden))) {
      reasons.push(`forbidden_claim:${forbidden}`);
    }
  }

  const mentionedVenom = /\bvenom\b/i.test(input.narration.narrationText);
  const mentionedSpider = /homem-aranha|spider-man/i.test(input.narration.narrationText);
  const mentionedDuo =
    /dupla|parceiro perfeito|parceria ideal|dupla ideal|os dois/i.test(
      input.narration.narrationText
    );
  const mentionedStrange = /doutor estranho|doctor strange/i.test(input.narration.narrationText);
  const mentionedNatasha = /natasha|black widow/i.test(input.narration.narrationText);

  if (mentionedVenom && !sceneEntities.some((entity) => entity.includes("venom"))) {
    unsupportedEntities.push("venom");
  }
  if (mentionedSpider && !sceneEntities.some((entity) => entity.includes("homem-aranha"))) {
    unsupportedEntities.push("spider-man");
  }
  if (
    mentionedDuo &&
    !input.scene.visibleRelationships.some((rel) => rel.type === "duo") &&
    sceneEntities.filter((entity) => entity.includes("venom") || entity.includes("homem-aranha"))
      .length < 2
  ) {
    unsupportedRelationships.push("duo");
  }
  if (mentionedStrange) unsupportedEntities.push("doctor_strange");
  if (mentionedNatasha) unsupportedEntities.push("black_widow");

  const genericPhraseDetected = detectGenericNarrationPhrase(input.narration.narrationText);
  if (genericPhraseDetected) reasons.push("generic_or_meta_phrase");

  const entityScore =
    unsupportedEntities.length === 0
      ? 100
      : clamp(100 - unsupportedEntities.length * 35, 0, 100);
  const actionScore = input.scene.visibleActions.length > 0 ? 90 : 55;
  const relationshipScore =
    unsupportedRelationships.length === 0
      ? input.scene.visibleRelationships.length > 0
        ? 92
        : 70
      : clamp(100 - unsupportedRelationships.length * 40, 0, 100);
  const editorialScore = genericPhraseDetected ? 20 : 88;
  const clarityScore = input.narration.narrationText.length >= 40 ? 90 : 45;

  const score = Math.round(
    entityScore * 0.25 +
      actionScore * 0.25 +
      relationshipScore * 0.25 +
      editorialScore * 0.15 +
      clarityScore * 0.1
  );

  const threshold =
    input.narration.role === "hook" || input.narration.role === "climax"
      ? SCENE_FIRST_ALIGNMENT_THRESHOLDS.hook
      : SCENE_FIRST_ALIGNMENT_THRESHOLDS.other;

  const ok =
    score >= threshold &&
    unsupportedEntities.length === 0 &&
    unsupportedRelationships.length === 0 &&
    !genericPhraseDetected &&
    reasons.length === 0;

  return {
    ok,
    score,
    unsupportedEntities,
    unsupportedActions,
    unsupportedRelationships,
    genericPhraseDetected,
    reasons
  };
}

export function rewriteSceneFirstNarrationCue(input: {
  scene: SceneEvidenceContract;
  cue: SceneFirstNarrationCue;
  panel: LocalComicPanelEvidence;
  proposal: SceneFirstStoryProposal;
  previousScene?: SceneEvidenceContract;
}): SceneFirstNarrationCue {
  const narrationText = composeNarrationText({
    scene: input.scene,
    role: input.cue.role,
    proposal: input.proposal,
    panel: input.panel,
    ...(input.previousScene ? { previousScene: input.previousScene } : {})
  });
  const alignment = validateSceneNarrationAlignment({
    scene: input.scene,
    narration: { ...input.cue, narrationText }
  });
  return {
    ...input.cue,
    narrationText,
    sceneNarrationAlignmentScore: alignment.score,
    warnings: alignment.ok ? [] : alignment.reasons
  };
}

export function generateSceneFirstNarrationCues(input: {
  proposal: SceneFirstStoryProposal;
  scenes: SceneEvidenceContract[];
  panelsById: Map<string, LocalComicPanelEvidence>;
}): SceneFirstNarrationCue[] {
  const orderedScenes = input.proposal.panelIds
    .map((panelId) => input.scenes.find((scene) => scene.panelId === panelId))
    .filter((scene): scene is SceneEvidenceContract => Boolean(scene));

  const rolePlan: Array<{
    role: SceneFirstNarrationCue["role"];
    sceneIndex: number;
    devOffset?: number;
  }> = [
    { role: "hook", sceneIndex: 0 },
    { role: "context", sceneIndex: Math.min(1, orderedScenes.length - 1) },
    { role: "development", sceneIndex: Math.min(1, orderedScenes.length - 1), devOffset: 0 },
    {
      role: "development",
      sceneIndex: Math.min(2, orderedScenes.length - 1),
      devOffset: 6
    },
    { role: "climax", sceneIndex: orderedScenes.length - 1 },
    { role: "closing", sceneIndex: 0 }
  ];

  const cues: SceneFirstNarrationCue[] = [];
  for (const [index, plan] of rolePlan.entries()) {
    const scene = orderedScenes[plan.sceneIndex];
    if (!scene) continue;
    const panel = input.panelsById.get(scene.panelId);
    if (!panel) continue;
    const timing = BEAT_TIMING[plan.role];
    const devOffset = plan.devOffset ?? 0;
    const previousScene =
      plan.sceneIndex > 0 ? orderedScenes[plan.sceneIndex - 1] : undefined;

    let cue: SceneFirstNarrationCue = {
      beatId: `scene-first-${plan.role}-${index + 1}`,
      role: plan.role,
      sceneId: scene.sceneId,
      panelId: scene.panelId,
      startSec: timing.startSec + devOffset,
      endSec: timing.endSec + devOffset,
      narrationText: composeNarrationText({
        scene,
        role: plan.role,
        proposal: input.proposal,
        panel,
        ...(previousScene ? { previousScene } : {})
      }),
      narrationPurpose: narrationPurposeForRole(plan.role, index, orderedScenes.length),
      evidenceReferences: scene.allowedClaims.slice(0, 3),
      sceneNarrationAlignmentScore: 0,
      warnings: []
    };

    let alignment = validateSceneNarrationAlignment({ scene, narration: cue });
    if (!alignment.ok) {
      cue = rewriteSceneFirstNarrationCue({
        scene,
        cue,
        panel,
        proposal: input.proposal,
        ...(previousScene ? { previousScene } : {})
      });
      alignment = validateSceneNarrationAlignment({ scene, narration: cue });
    }

    cue.sceneNarrationAlignmentScore = alignment.score;
    if (!alignment.ok) cue.warnings = alignment.reasons;
    cues.push(cue);
  }

  return cues;
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK | constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

async function runFfmpeg(ffmpegCommand: string, args: string[]): Promise<void> {
  await new Promise<void>((resolvePromise, reject) => {
    const child = spawn(ffmpegCommand, args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr?.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolvePromise();
      else reject(new Error(`ffmpeg exited ${code}: ${stderr.slice(-500)}`));
    });
  });
}

export async function renderSceneFirstStoryboardContactSheet(input: {
  storyboard: SceneFirstStoryboardEntry[];
  outputPath: string;
  ffmpegCommand?: string;
}): Promise<string | null> {
  const usable = input.storyboard.filter((entry) => entry.panelImagePath);
  if (usable.length === 0) return null;

  await mkdir(dirname(input.outputPath), { recursive: true });
  const ffmpegCommand = input.ffmpegCommand ?? "ffmpeg";
  const annotatedDir = join(dirname(input.outputPath), `${basename(input.outputPath)}.annotated`);
  await mkdir(annotatedDir, { recursive: true });

  const annotatedPaths: string[] = [];
  for (const [index, entry] of usable.entries()) {
    if (!(await fileExists(entry.panelImagePath))) continue;
    const label = `${entry.sceneId} | ${entry.visibleEntities.join("+") || "?"} | fit${entry.alignmentScore} | ${entry.narrationPurpose}`
      .replace(/[:\\']/g, " ");
    const annotatedPath = join(annotatedDir, `scene-${String(index + 1).padStart(2, "0")}.jpg`);
    await runFfmpeg(ffmpegCommand, [
      "-y",
      "-hide_banner",
      "-loglevel",
      "error",
      "-i",
      entry.panelImagePath,
      "-vf",
      `scale=320:320:force_original_aspect_ratio=decrease,pad=320:320:(ow-iw)/2:(oh-ih)/2:color=black,drawtext=text='${label}':fontsize=9:fontcolor=white:x=8:y=8:box=1:boxcolor=black@0.55`,
      "-frames:v",
      "1",
      annotatedPath
    ]);
    annotatedPaths.push(annotatedPath);
  }

  if (annotatedPaths.length === 0) return null;

  const listPath = `${input.outputPath}.list.txt`;
  const escaped = annotatedPaths.map((path) => `file '${path.replace(/'/g, "'\\''")}'`).join("\n");
  await writeFile(listPath, escaped, "utf8");
  const columns = Math.min(4, Math.max(1, Math.ceil(Math.sqrt(annotatedPaths.length))));
  const rows = Math.ceil(annotatedPaths.length / columns);
  await runFfmpeg(ffmpegCommand, [
    "-y",
    "-hide_banner",
    "-loglevel",
    "error",
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    listPath,
    "-vf",
    `tile=${columns}x${rows}`,
    "-frames:v",
    "1",
    input.outputPath
  ]);

  return resolve(input.outputPath);
}

export async function runSceneFirstNarrationPipeline(input: {
  panels: LocalComicPanelEvidence[];
  projectRoot?: string;
  ffmpegCommand?: string;
  pageTypeByPanelId?: Map<string, ComicPageType>;
}): Promise<SceneFirstPipelineResult> {
  const projectRoot = resolve(input.projectRoot ?? process.cwd());
  const tmpDir = join(projectRoot, "tmp");
  await mkdir(tmpDir, { recursive: true });

  const validPanels = input.panels.filter((panel) => panel.valid);
  const panelById = new Map(validPanels.map((panel) => [panel.panelId, panel]));
  const proposals = generateSceneFirstStoryProposals({
    panels: validPanels,
    ...(input.pageTypeByPanelId ? { pageTypeByPanelId: input.pageTypeByPanelId } : {})
  });
  const selectedProposal = selectSceneFirstStoryProposal(proposals);
  const perfectPartnerRejected = proposals.some(
    (proposal) =>
      proposal.topic === "parceiro_perfeito" &&
      proposal.topicSupportScore < SCENE_FIRST_PROPOSAL_THRESHOLDS.topicSupport
  );

  if (!selectedProposal) {
    const result: SceneFirstPipelineResult = {
      generatedAt: new Date().toISOString(),
      proposals,
      selectedProposal: null,
      perfectPartnerRejected,
      scenes: [],
      narrationCues: [],
      storyboard: [],
      unsupportedNarrationCueCount: 0,
      genericNarrationPhraseCount: 0,
      hookAlignmentScore: 0,
      climaxAlignmentScore: 0,
      averageAlignmentScore: 0,
      invalidShotCount: 0,
      wrongCharacterCount: 0,
      promotionalSceneCount: 0,
      canRender: false,
      canPublish: false,
      blockReason: "no_story_proposal_passed_thresholds",
      proposalsPath: null,
      scriptPath: null,
      storyboardContactSheetPath: null
    };
    const proposalsPath = join(tmpDir, SCENE_FIRST_PROPOSALS_FILENAME);
    await writeFile(proposalsPath, JSON.stringify(result, null, 2), "utf8");
    result.proposalsPath = proposalsPath;
    return result;
  }

  const shotValidPanels = selectedProposal.panelIds
    .map((panelId) => panelById.get(panelId))
    .filter((panel): panel is LocalComicPanelEvidence => {
      if (!panel) return false;
      const shot = validateSceneShot({
        panel,
        pageType: input.pageTypeByPanelId?.get(panel.panelId) ?? "story"
      });
      return shot.valid;
    });
  const scenes = shotValidPanels.map((panel) => buildSceneEvidenceContract(panel));
  const effectiveProposal: SceneFirstStoryProposal = {
    ...selectedProposal,
    panelIds: shotValidPanels.map((panel) => panel.panelId),
    sceneIds: shotValidPanels.map((panel) => `scene-${panel.panelId}`)
  };

  let wrongCharacterCount = 0;
  let promotionalSceneCount = 0;
  let invalidShotCount = 0;
  const storyboard: SceneFirstStoryboardEntry[] = [];

  for (const scene of scenes) {
    const panel = panelById.get(scene.panelId);
    if (!panel) continue;
    const pageType = input.pageTypeByPanelId?.get(panel.panelId) ?? "story";
    const shotValidation = validateSceneShot({ panel, pageType });
    if (!shotValidation.valid) invalidShotCount += 1;
    if (panel.visualFlags.doctorStrangeVisible || panel.visualFlags.unrelatedCharacterVisible) {
      wrongCharacterCount += 1;
    }
    const promo = isPromotionalPanelRegion({
      title: panel.parentContext.pageTitle ?? "",
      tags: panel.parentContext.parentTags,
      visual: {
        analyzable: true,
        eligible: false,
        rejectReason: null,
        duoVisualScore: 0,
        visualTags: panel.localEvidence.visualThemes,
        profile: null,
        warnings: []
      }
    });
    if (promo.reject) promotionalSceneCount += 1;
  }

  const narrationCues = generateSceneFirstNarrationCues({
    proposal: effectiveProposal,
    scenes,
    panelsById: panelById
  });

  for (const cue of narrationCues) {
    const scene = scenes.find((entry) => entry.sceneId === cue.sceneId);
    const panel = panelById.get(cue.panelId);
    if (!scene || !panel) continue;
    const shotValidation = validateSceneShot({
      panel,
      pageType: input.pageTypeByPanelId?.get(panel.panelId) ?? "story"
    });
    storyboard.push({
      sceneId: scene.sceneId,
      panelId: scene.panelId,
      panelImagePath: scene.panelImagePath,
      literalDescription: scene.literalDescription,
      visibleEntities: scene.visibleEntities.map((entry) => entry.name),
      visibleActions: scene.visibleActions.map((entry) => entry.action),
      visibleRelationships: scene.visibleRelationships.map((entry) => entry.type),
      narrationText: cue.narrationText,
      narrationPurpose: cue.narrationPurpose,
      evidenceReferences: cue.evidenceReferences,
      alignmentScore: cue.sceneNarrationAlignmentScore,
      shotValidation,
      startSec: cue.startSec,
      endSec: cue.endSec
    });
  }

  const unsupportedNarrationCueCount = narrationCues.filter((cue) => cue.warnings.length > 0).length;
  const genericNarrationPhraseCount = narrationCues.filter((cue) =>
    detectGenericNarrationPhrase(cue.narrationText)
  ).length;
  const hookCue = narrationCues.find((cue) => cue.role === "hook");
  const climaxCue = narrationCues.find((cue) => cue.role === "climax");
  const hookAlignmentScore = hookCue?.sceneNarrationAlignmentScore ?? 0;
  const climaxAlignmentScore = climaxCue?.sceneNarrationAlignmentScore ?? 0;
  const averageAlignmentScore =
    narrationCues.length > 0
      ? Number(
          (
            narrationCues.reduce((sum, cue) => sum + cue.sceneNarrationAlignmentScore, 0) /
            narrationCues.length
          ).toFixed(2)
        )
      : 0;

  const gateFailures: string[] = [];
  if (proposals.length < 3) gateFailures.push(`storyProposalCount:${proposals.length}`);
  if (scenes.length < 3) gateFailures.push(`shotValidSceneCount:${scenes.length}`);
  if (effectiveProposal.topicSupportScore < SCENE_FIRST_PROPOSAL_THRESHOLDS.topicSupport) {
    gateFailures.push(`topicSupport:${selectedProposal.topicSupportScore}`);
  }
  if (unsupportedNarrationCueCount > 0) {
    gateFailures.push(`unsupportedNarrationCueCount:${unsupportedNarrationCueCount}`);
  }
  if (genericNarrationPhraseCount > 0) {
    gateFailures.push(`genericNarrationPhraseCount:${genericNarrationPhraseCount}`);
  }
  if (hookAlignmentScore < SCENE_FIRST_ALIGNMENT_THRESHOLDS.hook) {
    gateFailures.push(`hookAlignment:${hookAlignmentScore}`);
  }
  if (climaxAlignmentScore < SCENE_FIRST_ALIGNMENT_THRESHOLDS.climax) {
    gateFailures.push(`climaxAlignment:${climaxAlignmentScore}`);
  }
  if (averageAlignmentScore < SCENE_FIRST_ALIGNMENT_THRESHOLDS.average) {
    gateFailures.push(`averageAlignment:${averageAlignmentScore}`);
  }
  if (invalidShotCount > 0) gateFailures.push(`invalidShotCount:${invalidShotCount}`);
  if (wrongCharacterCount > 0) gateFailures.push(`wrongCharacterCount:${wrongCharacterCount}`);
  if (promotionalSceneCount > 0) gateFailures.push(`promotionalSceneCount:${promotionalSceneCount}`);

  const proposalsPath = join(tmpDir, SCENE_FIRST_PROPOSALS_FILENAME);
  const scriptPath = join(tmpDir, SCENE_FIRST_BEST_SCRIPT_FILENAME);
  const storyboardContactSheetTarget = join(tmpDir, SCENE_FIRST_STORYBOARD_CONTACT_SHEET_FILENAME);

  const result: SceneFirstPipelineResult = {
    generatedAt: new Date().toISOString(),
    proposals,
    selectedProposal: effectiveProposal,
    perfectPartnerRejected,
    scenes,
    narrationCues,
    storyboard,
    unsupportedNarrationCueCount,
    genericNarrationPhraseCount,
    hookAlignmentScore,
    climaxAlignmentScore,
    averageAlignmentScore,
    invalidShotCount,
    wrongCharacterCount,
    promotionalSceneCount,
    canRender: gateFailures.length === 0,
    canPublish: gateFailures.length === 0,
    blockReason: gateFailures.length > 0 ? gateFailures.join(";") : null,
    proposalsPath,
    scriptPath,
    storyboardContactSheetPath: null
  };

  await writeFile(
    proposalsPath,
    JSON.stringify({ proposals, selectedProposalId: effectiveProposal.proposalId }, null, 2),
    "utf8"
  );
  await writeFile(
    scriptPath,
    JSON.stringify(
      {
        selectedProposal: effectiveProposal,
        scenes,
        narrationCues,
        storyboard,
        gates: {
          hookAlignmentScore,
          climaxAlignmentScore,
          averageAlignmentScore,
          canRender: result.canRender,
          canPublish: result.canPublish,
          blockReason: result.blockReason
        }
      },
      null,
      2
    ),
    "utf8"
  );

  if (storyboard.length > 0) {
    result.storyboardContactSheetPath = await renderSceneFirstStoryboardContactSheet({
      storyboard,
      outputPath: storyboardContactSheetTarget,
      ...(input.ffmpegCommand ? { ffmpegCommand: input.ffmpegCommand } : {})
    });
  }

  return result;
}

export function classifyNarrationEvidenceType(input: {
  scene: SceneEvidenceContract;
  cue: SceneFirstNarrationCue;
  previousScene?: SceneEvidenceContract;
  nextScene?: SceneEvidenceContract;
  sequence?: ComicPanelSequence | null;
}): NarrationEvidenceType {
  if (input.cue.evidenceReferences.some((ref) => input.scene.allowedClaims.includes(ref))) {
    return "direct_current_scene";
  }
  if (input.scene.localDialogue.length > 0) return "local_dialogue";
  if (input.scene.localNarrationBoxes.length > 0) return "local_narration_box";
  if (
    input.sequence &&
    input.previousScene &&
    input.sequence.panelIds.includes(input.previousScene.panelId)
  ) {
    return "adjacent_scene_sequence";
  }
  if (
    input.sequence &&
    input.nextScene &&
    input.sequence.panelIds.includes(input.nextScene.panelId)
  ) {
    return "adjacent_scene_sequence";
  }
  return "unsupported";
}

export function findAdjacentSequenceEvidence(input: {
  panel: LocalComicPanelEvidence;
  sequences: ComicPanelSequence[];
}): ComicPanelSequence | null {
  return findSequenceForPanel(input.sequences, input.panel.panelId);
}