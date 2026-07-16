import type { ComicShortScenePlan } from "./comic-shorts-factory.js";
import type { ComicPanelMomentType } from "./comic-panel-moment-selector.js";

export type ComicPanelVisualTargetType =
  | "speech_balloon"
  | "speaker_face"
  | "impact_zone"
  | "duo_conflict"
  | "wide_context"
  | "payoff_detail";

export type NormalizedVisualTargetBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type ComicPanelVisualTarget = {
  targetId: string;
  sceneOrder: number;
  panelId: string;
  type: ComicPanelVisualTargetType;
  confidence: number;
  priority: number;
  box: NormalizedVisualTargetBox;
  anchorPoint: { x: number; y: number };
  textSafeZone: "top" | "center" | "lower-third" | "bottom";
  recommendedCameraMove:
    | "balloon_read_push"
    | "face_reaction_push"
    | "impact_snap_zoom"
    | "duo_tension_pan"
    | "context_slow_push"
    | "payoff_hold_pull";
  renderInstruction: string;
  reasons: string[];
  warnings: string[];
};

type Evidence = NonNullable<ComicShortScenePlan["panelVisualEvidence"]>;

function clamp(value: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, value));
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function textLoad(scene: ComicShortScenePlan): number {
  const evidence = scene.panelVisualEvidence;
  if (!evidence) return scene.caption.length > 52 || scene.narration.length > 110 ? 2 : 0;
  return evidence.evidenceCounts.dialogue + evidence.evidenceCounts.narrationBoxes + evidence.evidenceCounts.detectedText;
}

function hasDuoConflict(evidence?: Evidence): boolean {
  if (!evidence) return false;
  return evidence.visualFlags.duoVisible || /conflict|threat|rival|enemy|host/i.test(evidence.strongestRelationshipType ?? "");
}

function hasAction(evidence?: Evidence): boolean {
  if (!evidence) return false;
  return evidence.evidenceCounts.actions > 0 || evidence.evidenceCounts.soundEffects > 0 || evidence.confidence.actions >= 0.7;
}

function hasCharacters(evidence?: Evidence): boolean {
  if (!evidence) return false;
  return evidence.evidenceCounts.characters > 0 && evidence.confidence.characters >= 0.55;
}

function safeBox(box: NormalizedVisualTargetBox): NormalizedVisualTargetBox {
  const width = clamp(box.width, 0.22, 0.86);
  const height = clamp(box.height, 0.18, 0.96);
  return {
    x: round(clamp(box.x, 0, 1 - width)),
    y: round(clamp(box.y, 0, 1 - height)),
    width: round(width),
    height: round(height)
  };
}

function anchorFor(box: NormalizedVisualTargetBox, yBias = 0.5): { x: number; y: number } {
  return {
    x: round(clamp(box.x + box.width / 2, 0.08, 0.92)),
    y: round(clamp(box.y + box.height * yBias, 0.08, 0.92))
  };
}

function baseConfidence(scene: ComicShortScenePlan): number {
  const evidence = scene.panelVisualEvidence;
  let score = 56;
  if (scene.panelImagePath) score += 8;
  if (evidence) score += 10;
  if (evidence?.confidence.overall) score += evidence.confidence.overall * 12;
  if ((evidence?.quality.cropability916Score ?? 0) >= 82) score += 6;
  return score;
}

function buildTarget(input: {
  scene: ComicShortScenePlan;
  type: ComicPanelVisualTargetType;
  priority: number;
  box: NormalizedVisualTargetBox;
  confidence: number;
  cameraMove: ComicPanelVisualTarget["recommendedCameraMove"];
  textSafeZone: ComicPanelVisualTarget["textSafeZone"];
  instruction: string;
  reasons: string[];
  warnings?: string[];
}): ComicPanelVisualTarget {
  const box = safeBox(input.box);
  return {
    targetId: `${input.scene.panelId}:${input.scene.order}:${input.type}`,
    sceneOrder: input.scene.order,
    panelId: input.scene.panelId,
    type: input.type,
    confidence: clampScore(input.confidence),
    priority: input.priority,
    box,
    anchorPoint: anchorFor(box, input.type === "speech_balloon" ? 0.38 : input.type === "impact_zone" ? 0.48 : 0.52),
    textSafeZone: input.textSafeZone,
    recommendedCameraMove: input.cameraMove,
    renderInstruction: input.instruction,
    reasons: input.reasons,
    warnings: input.warnings ?? []
  };
}

export function detectComicPanelVisualTargets(input: {
  scene: ComicShortScenePlan;
  preferredMomentType?: ComicPanelMomentType;
}): ComicPanelVisualTarget[] {
  const { scene } = input;
  const evidence = scene.panelVisualEvidence;
  const targets: ComicPanelVisualTarget[] = [];
  const text = textLoad(scene);
  const confidence = baseConfidence(scene);

  if (text > 0 || input.preferredMomentType === "speech_balloon") {
    targets.push(buildTarget({
      scene,
      type: "speech_balloon",
      priority: input.preferredMomentType === "speech_balloon" ? 100 : 82,
      box: { x: 0.08, y: 0.03, width: 0.84, height: text >= 3 ? 0.42 : 0.34 },
      confidence: confidence + Math.min(18, text * 7) + ((evidence?.confidence.text ?? 0) * 8),
      cameraMove: "balloon_read_push",
      textSafeZone: "bottom",
      instruction: "Preservar o balao inteiro, com respiro nas bordas; iniciar aberto e empurrar suavemente para o personagem que fala.",
      reasons: [`text_load:${text}`, `scene_role:${scene.role}`, "protect_readability_first"],
      warnings: text === 0 ? ["balloon_target_without_text_evidence"] : []
    }));
  }

  if (hasCharacters(evidence) || input.preferredMomentType === "character_reaction") {
    targets.push(buildTarget({
      scene,
      type: "speaker_face",
      priority: input.preferredMomentType === "character_reaction" ? 98 : scene.role === "payoff" ? 88 : 70,
      box: scene.role === "payoff"
        ? { x: 0.26, y: 0.08, width: 0.48, height: 0.62 }
        : { x: 0.22, y: 0.1, width: 0.56, height: 0.68 },
      confidence: confidence + (evidence?.confidence.characters ?? 0.45) * 18,
      cameraMove: "face_reaction_push",
      textSafeZone: text > 0 ? "bottom" : "lower-third",
      instruction: "Buscar rosto/expressao ou personagem dominante; manter olhos no terco superior e nao cortar boca/balao proximo.",
      reasons: [`characters:${evidence?.evidenceCounts.characters ?? 0}`, `scene_role:${scene.role}`, "reaction_retention_anchor"]
    }));
  }

  if (hasAction(evidence) || input.preferredMomentType === "action_impact") {
    targets.push(buildTarget({
      scene,
      type: "impact_zone",
      priority: input.preferredMomentType === "action_impact" ? 100 : scene.role === "climax" ? 94 : 76,
      box: { x: 0.19, y: 0.12, width: 0.62, height: 0.7 },
      confidence: confidence + (evidence?.confidence.actions ?? 0.52) * 18 + Math.min(10, (evidence?.evidenceCounts.soundEffects ?? 0) * 5),
      cameraMove: "impact_snap_zoom",
      textSafeZone: "lower-third",
      instruction: "Centralizar golpe/explosao/impacto; usar snap zoom curto, shake leve e segurar o frame mais legivel do impacto.",
      reasons: [`actions:${evidence?.evidenceCounts.actions ?? 0}`, `sfx:${evidence?.evidenceCounts.soundEffects ?? 0}`, `scene_role:${scene.role}`]
    }));
  }

  if (hasDuoConflict(evidence) || input.preferredMomentType === "conflict_pair") {
    targets.push(buildTarget({
      scene,
      type: "duo_conflict",
      priority: input.preferredMomentType === "conflict_pair" ? 96 : 74,
      box: { x: 0.1, y: 0.07, width: 0.8, height: 0.82 },
      confidence: confidence + 14 + (evidence?.confidence.relationships ?? 0.5) * 12,
      cameraMove: "duo_tension_pan",
      textSafeZone: "bottom",
      instruction: "Manter os dois lados do confronto visiveis; pan/zoom deve revelar escala e dominancia sem cortar personagens principais.",
      reasons: [`relationship:${evidence?.strongestRelationshipType ?? "unknown"}`, `duo_visible:${Boolean(evidence?.visualFlags.duoVisible)}`]
    }));
  }

  if (scene.role === "context" || input.preferredMomentType === "wide_context") {
    targets.push(buildTarget({
      scene,
      type: "wide_context",
      priority: input.preferredMomentType === "wide_context" ? 90 : 62,
      box: { x: 0.12, y: 0.02, width: 0.76, height: 0.94 },
      confidence: confidence + 6,
      cameraMove: "context_slow_push",
      textSafeZone: "bottom",
      instruction: "Mostrar geografia visual da pagina/painel antes de fechar no detalhe; ideal para explicar contexto sem perder escala.",
      reasons: [`scene_role:${scene.role}`, "context_preservation"]
    }));
  }

  if (scene.role === "payoff" || input.preferredMomentType === "payoff_detail") {
    targets.push(buildTarget({
      scene,
      type: "payoff_detail",
      priority: input.preferredMomentType === "payoff_detail" ? 94 : 78,
      box: { x: 0.2, y: 0.14, width: 0.6, height: 0.68 },
      confidence: confidence + (scene.role === "payoff" ? 14 : 6),
      cameraMove: "payoff_hold_pull",
      textSafeZone: "lower-third",
      instruction: "Segurar o detalhe que fecha a ideia; evitar corte rapido demais para o payoff respirar.",
      reasons: [`scene_role:${scene.role}`, "payoff_clarity"]
    }));
  }

  if (targets.length === 0) {
    targets.push(buildTarget({
      scene,
      type: "wide_context",
      priority: 50,
      box: { x: 0.16, y: 0.04, width: 0.68, height: 0.92 },
      confidence,
      cameraMove: "context_slow_push",
      textSafeZone: "bottom",
      instruction: "Fallback: usar crop de contexto com push leve ate existir evidencia visual mais forte.",
      reasons: ["fallback_no_specific_target"],
      warnings: ["no_specific_visual_target_detected"]
    }));
  }

  return targets.sort((left, right) => right.priority + right.confidence * 0.2 - (left.priority + left.confidence * 0.2));
}
