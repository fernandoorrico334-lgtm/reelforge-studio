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
  directorId: "comic_smart_crop_director_v1";
  targetFormat: "vertical_9_16";
  directives: ComicSmartCropDirective[];
  averageConfidenceScore: number;
  warnings: string[];
  nextImprovements: string[];
};

const VERTICAL_9_16_WIDTH = 0.5625;

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

function cropForFocus(focus: ComicSmartCropFocus, scene: ComicShortScenePlan): NormalizedCropBox {
  const textHeavy = scene.caption.length > 44 || scene.narration.length > 96;
  if (focus === "impact_detail") {
    return { x: 0.22, y: 0.08, width: VERTICAL_9_16_WIDTH, height: 0.9 };
  }
  if (focus === "action_center") {
    return { x: 0.21, y: 0.05, width: VERTICAL_9_16_WIDTH, height: 0.92 };
  }
  if (focus === "wide_context") {
    return { x: 0.18, y: 0.02, width: 0.64, height: 0.96 };
  }
  if (focus === "speech_safe" || textHeavy) {
    return { x: 0.2, y: 0.02, width: 0.6, height: 0.96 };
  }
  if (focus === "payoff_reveal") {
    return { x: 0.19, y: 0.06, width: 0.62, height: 0.9 };
  }
  return { x: 0.22, y: 0.06, width: VERTICAL_9_16_WIDTH, height: 0.92 };
}

function cameraMoveForScene(scene: ComicShortScenePlan): ComicSmartCropDirective["cameraMove"] {
  if (scene.role === "hook") return "snap_zoom_out";
  if (scene.role === "context") return "slow_push_center";
  if (scene.role === "development") return "diagonal_panel_pan";
  if (scene.role === "climax") return "impact_punch_zoom";
  return "payoff_pull_back";
}

function captionZoneForScene(scene: ComicShortScenePlan): ComicSmartCropDirective["safeCaptionZone"] {
  if (scene.role === "hook" || scene.role === "climax") return "center";
  if (scene.caption.length > 44 || scene.narration.length > 96) return "bottom";
  return "lower-third";
}

function textSafetyForScene(scene: ComicShortScenePlan): ComicSmartCropDirective["textSafety"] {
  if (scene.caption.length > 44 || scene.narration.length > 96) return "protect_speech_balloons";
  if (scene.role === "hook" || scene.role === "climax") return "visual_priority";
  return "caption_safe";
}

function scaleForScene(scene: ComicShortScenePlan): { startScale: number; endScale: number } {
  if (scene.role === "hook") return { startScale: 1.16, endScale: 1.04 };
  if (scene.role === "climax") return { startScale: 1.04, endScale: 1.22 };
  if (scene.role === "context") return { startScale: 1.02, endScale: 1.1 };
  if (scene.role === "payoff") return { startScale: 1.12, endScale: 1 };
  return { startScale: 1.04, endScale: 1.14 };
}

function anchorForScene(scene: ComicShortScenePlan, crop: NormalizedCropBox): { x: number; y: number } {
  const x = crop.x + crop.width / 2;
  const yBias = scene.role === "hook" || scene.role === "climax" ? 0.46 : scene.role === "context" ? 0.4 : 0.52;
  return { x: round(clamp(x, 0.2, 0.8)), y: round(clamp(crop.y + crop.height * yBias, 0.18, 0.82)) };
}

function confidenceForScene(scene: ComicShortScenePlan, crop: NormalizedCropBox): number {
  let score = 72;
  if (scene.panelImagePath) score += 8;
  if (scene.role === "hook" || scene.role === "climax") score += 7;
  if (crop.width >= VERTICAL_9_16_WIDTH && crop.height >= 0.88) score += 6;
  if (scene.caption.length <= 48) score += 4;
  if (!scene.panelImagePath) score -= 12;
  return clamp(score, 0, 100);
}

function buildInstruction(input: {
  scene: ComicShortScenePlan;
  focus: ComicSmartCropFocus;
  crop: NormalizedCropBox;
  direction?: ComicPremiumSceneDirection;
}): string {
  const premium = input.direction?.cropInstruction ? ` ${input.direction.cropInstruction}` : "";
  return [
    `Usar crop vertical 9:16 normalizado x=${input.crop.x}, y=${input.crop.y}, w=${input.crop.width}, h=${input.crop.height}.`,
    `Foco: ${input.focus}.`,
    `Manter legenda em zona segura e preservar leitura do painel.`,
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
    const focus = roleFocus(scene);
    const rawCrop = cropForFocus(focus, scene);
    const crop = {
      x: round(clamp(rawCrop.x, 0, 1 - rawCrop.width)),
      y: round(clamp(rawCrop.y, 0, 1 - rawCrop.height)),
      width: round(clamp(rawCrop.width, VERTICAL_9_16_WIDTH, 0.72)),
      height: round(clamp(rawCrop.height, 0.82, 1))
    };
    const scales = scaleForScene(scene);
    const confidenceScore = confidenceForScene(scene, crop);
    if (!scene.panelImagePath) warnings.push(`smart_crop:missing_panel_image_path:${scene.panelId}`);
    if (confidenceScore < 75) warnings.push(`smart_crop:low_confidence:${scene.panelId}`);
    const directive: ComicSmartCropDirective = {
      sceneOrder: scene.order,
      panelId: scene.panelId,
      pageNumber: scene.pageNumber,
      focus,
      normalizedCrop: crop,
      safeCaptionZone: captionZoneForScene(scene),
      cameraMove: cameraMoveForScene(scene),
      startScale: scales.startScale,
      endScale: scales.endScale,
      anchorPoint: anchorForScene(scene, crop),
      holdSeconds: round(clamp(scene.durationSeconds * 0.28, 0.24, 0.7)),
      motionIntensity: scene.role === "hook" || scene.role === "climax" ? 10 : scene.role === "development" ? 8 : 6,
      textSafety: textSafetyForScene(scene),
      renderInstruction: buildInstruction({ scene, focus, crop, ...(premiumDirection ? { direction: premiumDirection } : {}) }),
      reasons: [
        `role:${scene.role}`,
        `motion:${scene.motion}`,
        `transition:${scene.transition}`,
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
    directorId: "comic_smart_crop_director_v1",
    targetFormat: "vertical_9_16",
    directives,
    averageConfidenceScore,
    warnings,
    nextImprovements: [
      "Usar deteccao real de rosto/balao/acao dentro do painel para refinar anchorPoint.",
      "Renderizar preview de crop 9:16 antes da aprovacao humana.",
      "Comparar crop final contra o DNA do video referencia para ajustar movimento e tempo de hold."
    ]
  };
}
