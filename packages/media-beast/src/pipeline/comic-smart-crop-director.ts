import type { ComicPremiumSceneDirection } from "./comic-premium-director.js";
import type { ComicShortProductionPlan, ComicShortScenePlan } from "./comic-shorts-factory.js";

export type ComicSmartCropFocus =
  | "impact_detail"
  | "face_or_character"
  | "action_center"
  | "speech_safe"
  | "wide_context"
  | "payoff_reveal";

export type NormalizedCropBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type ComicSmartCropDirective = {
  sceneOrder: number;
  panelId: string;
  pageNumber: number | null;
  focus: ComicSmartCropFocus;
  normalizedCrop: NormalizedCropBox;
  safeCaptionZone: "top" | "center" | "lower-third" | "bottom";
  cameraMove:
    | "snap_zoom_out"
    | "slow_push_center"
    | "diagonal_panel_pan"
    | "impact_punch_zoom"
    | "payoff_pull_back";
  startScale: number;
  endScale: number;
  anchorPoint: { x: number; y: number };
  holdSeconds: number;
  motionIntensity: number;
  textSafety: "protect_speech_balloons" | "caption_safe" | "visual_priority";
  renderInstruction: string;
  reasons: string[];
  confidenceScore: number;
};

export type ComicSmartCropDirectorReport = {
  directorId: "comic_smart_crop_director_v2";
  targetFormat: "vertical_9_16";
  directives: ComicSmartCropDirective[];
  averageConfidenceScore: number;
  warnings: string[];
  nextImprovements: string[];
};

const VERTICAL_9_16_WIDTH = 0.5625;

type PanelVisualEvidence = NonNullable<ComicShortScenePlan["panelVisualEvidence"]>;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function roleFocus(scene: ComicShortScenePlan): ComicSmartCropFocus {
  if (scene.role === "hook") return "impact_detail";
  if (scene.role === "context") return "wide_context";
  if (scene.role === "development") {
    return scene.caption.length > 44 || scene.narration.length > 96 ? "speech_safe" : "face_or_character";
  }
  if (scene.role === "climax") return "action_center";
  return "payoff_reveal";
}

function evidenceTextLoad(evidence: PanelVisualEvidence | undefined): number {
  if (!evidence) return 0;
  return (
    evidence.evidenceCounts.dialogue +
    evidence.evidenceCounts.narrationBoxes +
    evidence.evidenceCounts.detectedText
  );
}

function hasActionEvidence(evidence: PanelVisualEvidence | undefined): boolean {
  if (!evidence) return false;
  return (
    evidence.evidenceCounts.soundEffects > 0 ||
    evidence.evidenceCounts.actions > 0 ||
    evidence.confidence.actions >= 0.7 ||
    ["action", "climax", "transformation", "reveal"].includes(evidence.storyFunction)
  );
}

function hasCharacterEvidence(evidence: PanelVisualEvidence | undefined): boolean {
  if (!evidence) return false;
  return evidence.evidenceCounts.characters > 0 && evidence.confidence.characters >= 0.55;
}

function evidenceFocus(scene: ComicShortScenePlan): ComicSmartCropFocus {
  const fallback = roleFocus(scene);
  const evidence = scene.panelVisualEvidence;
  if (!evidence) return fallback;

  const textLoad = evidenceTextLoad(evidence);
  const textHeavy = evidence.quality.textHeavyRatio >= 0.34 || textLoad >= 3;
  const action = hasActionEvidence(evidence);
  const character = hasCharacterEvidence(evidence);

  if (scene.role === "climax" && action) return "action_center";
  if (scene.role === "hook" && action) return "impact_detail";
  if (textHeavy && !action) return "speech_safe";
  if (character && (scene.role === "development" || scene.role === "payoff")) return "face_or_character";
  if (evidence.storyFunction === "reveal") return "payoff_reveal";
  if (evidence.storyFunction === "dialogue") return "speech_safe";
  return fallback;
}

function cropForFocus(focus: ComicSmartCropFocus, scene: ComicShortScenePlan): NormalizedCropBox {
  const evidence = scene.panelVisualEvidence;
  const textHeavy = scene.caption.length > 44 || scene.narration.length > 96 || (evidence?.quality.textHeavyRatio ?? 0) >= 0.34;
  const cropability = evidence?.quality.cropability916Score ?? 76;
  const canTighten = cropability >= 82 && !textHeavy;
  const needsWide = evidence?.visualFlags.duoVisible || evidence?.strongestRelationshipType === "conflict";

  if (focus === "impact_detail") {
    return { x: canTighten ? 0.25 : 0.22, y: 0.08, width: canTighten ? 0.54 : VERTICAL_9_16_WIDTH, height: 0.9 };
  }
  if (focus === "action_center") {
    return needsWide
      ? { x: 0.18, y: 0.04, width: 0.66, height: 0.92 }
      : { x: 0.21, y: 0.05, width: VERTICAL_9_16_WIDTH, height: 0.92 };
  }
  if (focus === "wide_context") {
    return { x: 0.18, y: 0.02, width: 0.64, height: 0.96 };
  }
  if (focus === "speech_safe" || textHeavy) {
    return { x: 0.17, y: 0.02, width: 0.66, height: 0.96 };
  }
  if (focus === "payoff_reveal") {
    return { x: 0.19, y: 0.06, width: needsWide ? 0.66 : 0.62, height: 0.9 };
  }
  return { x: canTighten ? 0.24 : 0.22, y: 0.06, width: canTighten ? 0.54 : VERTICAL_9_16_WIDTH, height: 0.92 };
}

function cameraMoveForScene(scene: ComicShortScenePlan, focus: ComicSmartCropFocus): ComicSmartCropDirective["cameraMove"] {
  if (focus === "impact_detail" || scene.role === "hook") return "snap_zoom_out";
  if (focus === "wide_context" || scene.role === "context") return "slow_push_center";
  if (focus === "speech_safe") return "diagonal_panel_pan";
  if (focus === "action_center" || scene.role === "climax") return "impact_punch_zoom";
  return "payoff_pull_back";
}

function captionZoneForScene(scene: ComicShortScenePlan, focus: ComicSmartCropFocus): ComicSmartCropDirective["safeCaptionZone"] {
  const evidence = scene.panelVisualEvidence;
  if (focus === "speech_safe" || evidenceTextLoad(evidence) >= 3) return "bottom";
  if (scene.role === "hook" || scene.role === "climax") return "center";
  if (scene.caption.length > 44 || scene.narration.length > 96) return "bottom";
  return "lower-third";
}

function textSafetyForScene(scene: ComicShortScenePlan, focus: ComicSmartCropFocus): ComicSmartCropDirective["textSafety"] {
  const evidence = scene.panelVisualEvidence;
  if (focus === "speech_safe" || evidenceTextLoad(evidence) >= 2 || (evidence?.quality.textHeavyRatio ?? 0) >= 0.26) {
    return "protect_speech_balloons";
  }
  if (focus === "impact_detail" || focus === "action_center") return "visual_priority";
  return "caption_safe";
}

function scaleForScene(scene: ComicShortScenePlan, focus: ComicSmartCropFocus): { startScale: number; endScale: number } {
  if (focus === "speech_safe") return { startScale: 1.02, endScale: 1.08 };
  if (scene.role === "hook") return { startScale: 1.16, endScale: 1.04 };
  if (scene.role === "climax") return { startScale: 1.04, endScale: 1.22 };
  if (scene.role === "context") return { startScale: 1.02, endScale: 1.1 };
  if (scene.role === "payoff") return { startScale: 1.12, endScale: 1 };
  return { startScale: 1.04, endScale: 1.14 };
}

function anchorForScene(scene: ComicShortScenePlan, crop: NormalizedCropBox, focus: ComicSmartCropFocus): { x: number; y: number } {
  const evidence = scene.panelVisualEvidence;
  const x = crop.x + crop.width / 2;
  let yBias = scene.role === "hook" || scene.role === "climax" ? 0.46 : scene.role === "context" ? 0.4 : 0.52;
  if (focus === "speech_safe") yBias = 0.42;
  if (focus === "payoff_reveal") yBias = 0.5;
  if ((evidence?.quality.textHeavyRatio ?? 0) >= 0.34) yBias = 0.38;
  return { x: round(clamp(x, 0.2, 0.8)), y: round(clamp(crop.y + crop.height * yBias, 0.18, 0.82)) };
}

function confidenceForScene(scene: ComicShortScenePlan, crop: NormalizedCropBox, focus: ComicSmartCropFocus): number {
  const evidence = scene.panelVisualEvidence;
  let score = 66;
  if (scene.panelImagePath) score += 8;
  if (evidence) score += 8;
  if (scene.role === "hook" || scene.role === "climax") score += 6;
  if (crop.width >= VERTICAL_9_16_WIDTH && crop.height >= 0.88) score += 5;
  if (scene.caption.length <= 48) score += 3;
  if (evidence?.confidence.overall) score += Math.round(evidence.confidence.overall * 8);
  if (focus === "speech_safe" && evidenceTextLoad(evidence) > 0) score += 4;
  if ((focus === "action_center" || focus === "impact_detail") && hasActionEvidence(evidence)) score += 5;
  if (focus === "face_or_character" && hasCharacterEvidence(evidence)) score += 5;
  if ((evidence?.quality.cropability916Score ?? 0) >= 82) score += 4;
  if (!scene.panelImagePath) score -= 12;
  return clamp(score, 0, 100);
}

function evidenceReasons(scene: ComicShortScenePlan): string[] {
  const evidence = scene.panelVisualEvidence;
  if (!evidence) return ["visual_evidence:missing"];
  const reasons = [
    `visual_evidence:story_function:${evidence.storyFunction}`,
    `visual_evidence:text_load:${evidenceTextLoad(evidence)}`,
    `visual_evidence:characters:${evidence.evidenceCounts.characters}`,
    `visual_evidence:actions:${evidence.evidenceCounts.actions}`,
    `visual_evidence:sfx:${evidence.evidenceCounts.soundEffects}`,
    `visual_evidence:cropability:${evidence.quality.cropability916Score}`
  ];
  if (evidence.strongestActionLabel) reasons.push(`visual_evidence:action:${evidence.strongestActionLabel}`);
  if (evidence.strongestRelationshipType) reasons.push(`visual_evidence:relationship:${evidence.strongestRelationshipType}`);
  return reasons;
}

function buildInstruction(input: {
  scene: ComicShortScenePlan;
  focus: ComicSmartCropFocus;
  crop: NormalizedCropBox;
  direction?: ComicPremiumSceneDirection;
}): string {
  const premium = input.direction?.cropInstruction ? ` ${input.direction.cropInstruction}` : "";
  const evidence = input.scene.panelVisualEvidence
    ? ` Evidencia local usada: ${evidenceReasons(input.scene).slice(0, 4).join(", ")}.`
    : " Evidencia local indisponivel; usando fallback por papel narrativo.";
  return [
    `Usar crop vertical 9:16 normalizado x=${input.crop.x}, y=${input.crop.y}, w=${input.crop.width}, h=${input.crop.height}.`,
    `Foco: ${input.focus}.`,
    `Manter legenda em zona segura e preservar leitura do painel.`,
    evidence,
    premium.trim()
  ].filter(Boolean).join(" ");
}

export function directComicSmartCrops(input: {
  short: ComicShortProductionPlan;
  premiumDirections?: ComicPremiumSceneDirection[];
}): ComicSmartCropDirectorReport {
  const warnings: string[] = [];
  const directives = input.short.scenes.map((scene) => {
    const premiumDirection = input.premiumDirections?.find((entry) => entry.sceneOrder === scene.order);
    const focus = evidenceFocus(scene);
    const rawCrop = cropForFocus(focus, scene);
    const crop = {
      x: round(clamp(rawCrop.x, 0, 1 - rawCrop.width)),
      y: round(clamp(rawCrop.y, 0, 1 - rawCrop.height)),
      width: round(clamp(rawCrop.width, VERTICAL_9_16_WIDTH, 0.72)),
      height: round(clamp(rawCrop.height, 0.82, 1))
    };
    const scales = scaleForScene(scene, focus);
    const confidenceScore = confidenceForScene(scene, crop, focus);
    if (!scene.panelImagePath) warnings.push(`smart_crop:missing_panel_image_path:${scene.panelId}`);
    if (!scene.panelVisualEvidence) warnings.push(`smart_crop:missing_visual_evidence:${scene.panelId}`);
    if (confidenceScore < 78) warnings.push(`smart_crop:low_confidence:${scene.panelId}`);
    const directive: ComicSmartCropDirective = {
      sceneOrder: scene.order,
      panelId: scene.panelId,
      pageNumber: scene.pageNumber,
      focus,
      normalizedCrop: crop,
      safeCaptionZone: captionZoneForScene(scene, focus),
      cameraMove: cameraMoveForScene(scene, focus),
      startScale: scales.startScale,
      endScale: scales.endScale,
      anchorPoint: anchorForScene(scene, crop, focus),
      holdSeconds: round(clamp(scene.durationSeconds * 0.28, 0.24, 0.7)),
      motionIntensity: scene.role === "hook" || scene.role === "climax" ? 10 : scene.role === "development" ? 8 : 6,
      textSafety: textSafetyForScene(scene, focus),
      renderInstruction: buildInstruction({ scene, focus, crop, ...(premiumDirection ? { direction: premiumDirection } : {}) }),
      reasons: [
        `role:${scene.role}`,
        `motion:${scene.motion}`,
        `transition:${scene.transition}`,
        ...evidenceReasons(scene),
        ...(premiumDirection ? [`premium_goal:${premiumDirection.retentionGoal}`] : [])
      ],
      confidenceScore
    };
    return directive;
  });

  const averageConfidenceScore = directives.length > 0
    ? Math.round(directives.reduce((sum, directive) => sum + directive.confidenceScore, 0) / directives.length)
    : 0;

  return {
    directorId: "comic_smart_crop_director_v2",
    targetFormat: "vertical_9_16",
    directives,
    averageConfidenceScore,
    warnings,
    nextImprovements: [
      "Adicionar bounding boxes reais de rosto/balao/acao no indexador local para posicionamento pixel-perfect.",
      "Renderizar contact sheet com crop aprovado e score de legibilidade antes do render em lote.",
      "Comparar crop final contra o DNA do video referencia para ajustar movimento e tempo de hold."
    ]
  };
}