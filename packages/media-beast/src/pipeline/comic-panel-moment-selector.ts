import type { ComicShortProductionPlan, ComicShortScenePlan } from "./comic-shorts-factory.js";
import { detectComicPanelVisualTargets, type ComicPanelVisualTarget } from "./comic-panel-visual-targets.js";

export type ComicPanelMomentType =
  | "speech_balloon"
  | "action_impact"
  | "character_reaction"
  | "conflict_pair"
  | "wide_context"
  | "payoff_detail";

export type ComicPanelMoment = {
  momentId: string;
  sceneOrder: number;
  panelId: string;
  pageNumber: number | null;
  type: ComicPanelMomentType;
  score: number;
  narrativeMatchScore: number;
  visualStrengthScore: number;
  retentionValueScore: number;
  normalizedCrop: { x: number; y: number; width: number; height: number };
  primaryVisualTarget: ComicPanelVisualTarget | null;
  visualTargets: ComicPanelVisualTarget[];
  zoomInstruction: string;
  cutIntent: "hook_shock" | "proof" | "action_punch" | "reaction" | "payoff";
  recommendedHoldSeconds: number;
  reasons: string[];
  warnings: string[];
};

export type ComicPanelMomentSelectorReport = {
  selectorId: "comic_panel_moment_selector_v1";
  shortId: string;
  averageMomentScore: number;
  selectedMoments: ComicPanelMoment[];
  rejectedMoments: ComicPanelMoment[];
  warnings: string[];
  nextImprovements: string[];
};

type Evidence = NonNullable<ComicShortScenePlan["panelVisualEvidence"]>;

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function evidence(scene: ComicShortScenePlan): Evidence | null {
  return scene.panelVisualEvidence ?? null;
}

function textLoad(scene: ComicShortScenePlan): number {
  const item = evidence(scene);
  if (!item) return scene.caption.length > 44 || scene.narration.length > 96 ? 2 : 0;
  return item.evidenceCounts.dialogue + item.evidenceCounts.narrationBoxes + item.evidenceCounts.detectedText;
}

function actionScore(scene: ComicShortScenePlan): number {
  const item = evidence(scene);
  let score = 0;
  if (scene.role === "hook" || scene.role === "climax") score += 24;
  if (scene.motion === "impact_cut" || scene.transition === "flash") score += 14;
  if (item) {
    score += Math.min(24, item.evidenceCounts.actions * 10);
    score += Math.min(20, item.evidenceCounts.soundEffects * 8);
    if (item.strongestActionLabel) score += 14;
    if (/action|fight|climax|impact|attack|battle|transformation/i.test(String(item.storyFunction))) score += 12;
    score += Math.round((item.confidence.actions ?? 0) * 10);
  }
  return clamp(score);
}

function characterScore(scene: ComicShortScenePlan): number {
  const item = evidence(scene);
  if (!item) return scene.role === "payoff" ? 35 : 20;
  return clamp(18 + Math.min(35, item.evidenceCounts.characters * 12) + Math.round(item.confidence.characters * 35));
}

function conflictScore(scene: ComicShortScenePlan): number {
  const item = evidence(scene);
  let score = scene.role === "climax" ? 40 : scene.role === "development" ? 28 : 18;
  if (item?.strongestRelationshipType) score += /conflict|threat|rival|enemy|host/i.test(item.strongestRelationshipType) ? 34 : 12;
  if (item?.visualFlags.duoVisible) score += 18;
  if (/contra|versus|ameaca|perigo|luta|impacto|virada|domina/i.test(scene.narration)) score += 14;
  return clamp(score);
}

function narrationMatch(scene: ComicShortScenePlan, type: ComicPanelMomentType): number {
  const text = `${scene.narration} ${scene.caption}`.toLowerCase();
  let score = 35;
  if (type === "speech_balloon" && /(fala|texto|pista|diz|dialogo|balao|explica)/i.test(text)) score += 34;
  if (type === "action_impact" && /(impacto|golpe|luta|explode|acao|pancada|ameaca|virada)/i.test(text)) score += 34;
  if (type === "character_reaction" && /(olha|repara|assusta|percebe|rosto|expressao|personagem)/i.test(text)) score += 28;
  if (type === "conflict_pair" && /(contra|conflito|versus|perigo|domina|pressiona)/i.test(text)) score += 30;
  if (type === "wide_context" && /(antes|contexto|prepara|pagina|cidade|cena)/i.test(text)) score += 24;
  if (type === "payoff_detail" && /(por isso|muda tudo|consequencia|proximo|fecha|pergunta)/i.test(text)) score += 30;
  if (scene.role === "hook" && (type === "action_impact" || type === "conflict_pair")) score += 12;
  if (scene.role === "context" && (type === "speech_balloon" || type === "wide_context")) score += 12;
  if (scene.role === "climax" && type === "action_impact") score += 14;
  if (scene.role === "payoff" && (type === "payoff_detail" || type === "character_reaction")) score += 12;
  return clamp(score);
}

function fallbackCropForType(type: ComicPanelMomentType, scene: ComicShortScenePlan) {
  const textHeavy = textLoad(scene) >= 2 || scene.caption.length > 54;
  if (type === "speech_balloon") return { x: 0.12, y: 0.04, width: 0.76, height: 0.72 };
  if (type === "action_impact") return { x: 0.2, y: 0.08, width: 0.6, height: 0.84 };
  if (type === "character_reaction") return { x: 0.24, y: 0.08, width: 0.52, height: 0.78 };
  if (type === "conflict_pair") return { x: 0.14, y: 0.06, width: 0.72, height: 0.86 };
  if (type === "payoff_detail") return { x: 0.2, y: 0.1, width: 0.62, height: 0.78 };
  return textHeavy ? { x: 0.1, y: 0.02, width: 0.8, height: 0.92 } : { x: 0.16, y: 0.03, width: 0.68, height: 0.92 };
}

function cutIntentFor(type: ComicPanelMomentType, scene: ComicShortScenePlan): ComicPanelMoment["cutIntent"] {
  if (scene.role === "hook") return "hook_shock";
  if (type === "speech_balloon") return "proof";
  if (type === "action_impact" || scene.role === "climax") return "action_punch";
  if (type === "character_reaction") return "reaction";
  if (scene.role === "payoff" || type === "payoff_detail") return "payoff";
  return "proof";
}

function holdSecondsFor(scene: ComicShortScenePlan, type: ComicPanelMomentType): number {
  const base = type === "speech_balloon" ? 0.72 : type === "action_impact" ? 0.38 : 0.52;
  return round(Math.max(0.28, Math.min(0.9, base + scene.durationSeconds * 0.03)));
}

function zoomInstructionFor(type: ComicPanelMomentType, scene: ComicShortScenePlan): string {
  if (type === "speech_balloon") return "Start wide enough to read the balloon, then push 6% toward the speaker without covering text.";
  if (type === "action_impact") return "Snap into the impact center, add tiny shake on the beat, then hold the strongest visual detail.";
  if (type === "character_reaction") return "Push toward the face/expression and keep the eyes in the upper third.";
  if (type === "conflict_pair") return "Keep both characters/monsters visible, then micro-zoom toward the dominant threat.";
  if (type === "payoff_detail") return "Hold the payoff detail long enough for the narration to land, then pull back slightly.";
  return "Start with a context crop, then slow-push toward the element named by the narration.";
}

function visualStrength(scene: ComicShortScenePlan, type: ComicPanelMomentType): number {
  if (type === "speech_balloon") return clamp(35 + textLoad(scene) * 18 + characterScore(scene) * 0.18);
  if (type === "action_impact") return clamp(30 + actionScore(scene) * 0.65 + conflictScore(scene) * 0.18);
  if (type === "character_reaction") return clamp(25 + characterScore(scene) * 0.62 + conflictScore(scene) * 0.18);
  if (type === "conflict_pair") return clamp(25 + conflictScore(scene) * 0.62 + characterScore(scene) * 0.2);
  if (type === "payoff_detail") return clamp(30 + characterScore(scene) * 0.24 + narrationMatch(scene, type) * 0.38);
  return clamp(42 + (evidence(scene)?.quality.visualQualityScore ?? 70) * 0.3);
}

function retentionValue(scene: ComicShortScenePlan, type: ComicPanelMomentType): number {
  let score = 38;
  if (scene.role === "hook" && (type === "action_impact" || type === "conflict_pair")) score += 32;
  if (scene.role === "context" && (type === "speech_balloon" || type === "wide_context")) score += 22;
  if (scene.role === "development" && (type === "speech_balloon" || type === "character_reaction")) score += 22;
  if (scene.role === "climax" && type === "action_impact") score += 36;
  if (scene.role === "payoff" && type === "payoff_detail") score += 30;
  if (scene.role === "payoff" && type === "character_reaction") score += 24;
  if (scene.role === "payoff" && type === "action_impact") score -= 12;
  if (scene.role === "development" && textLoad(scene) > 0 && type === "action_impact") score -= 8;
  if (textLoad(scene) > 0 && type === "speech_balloon") score += 10;
  return clamp(score);
}

function reasonsFor(scene: ComicShortScenePlan, type: ComicPanelMomentType): string[] {
  const item = evidence(scene);
  return [
    `role:${scene.role}`,
    `moment:${type}`,
    `text_load:${textLoad(scene)}`,
    `action_score:${actionScore(scene)}`,
    `character_score:${characterScore(scene)}`,
    `conflict_score:${conflictScore(scene)}`,
    ...(item?.strongestActionLabel ? [`action:${item.strongestActionLabel}`] : []),
    ...(item?.strongestRelationshipType ? [`relationship:${item.strongestRelationshipType}`] : [])
  ];
}

function candidateTypes(scene: ComicShortScenePlan): ComicPanelMomentType[] {
  const types: ComicPanelMomentType[] = [];
  if (textLoad(scene) > 0) types.push("speech_balloon");
  if (actionScore(scene) >= 45 || scene.role === "hook" || scene.role === "climax") types.push("action_impact");
  if (characterScore(scene) >= 45) types.push("character_reaction");
  if (conflictScore(scene) >= 45) types.push("conflict_pair");
  if (scene.role === "context") types.push("wide_context");
  if (scene.role === "payoff") types.push("payoff_detail");
  if (types.length === 0) types.push("wide_context");
  return [...new Set(types)];
}

function buildMoment(short: ComicShortProductionPlan, scene: ComicShortScenePlan, type: ComicPanelMomentType): ComicPanelMoment {
  const narrativeMatchScore = narrationMatch(scene, type);
  const visualStrengthScore = visualStrength(scene, type);
  const retentionValueScore = retentionValue(scene, type);
  const roleBonus =
    scene.role === "payoff" && type === "character_reaction"
      ? 8
      : scene.role === "payoff" && type === "payoff_detail"
        ? 6
        : scene.role === "context" && type === "speech_balloon"
          ? 6
          : 0;
  const score = clamp(narrativeMatchScore * 0.38 + visualStrengthScore * 0.36 + retentionValueScore * 0.26 + roleBonus);
  const visualTargets = detectComicPanelVisualTargets({ scene, preferredMomentType: type });
  const primaryVisualTarget = visualTargets[0] ?? null;
  const warnings: string[] = [];
  if (!scene.panelImagePath) warnings.push("missing_panel_image_path");
  if (!scene.panelVisualEvidence) warnings.push("missing_panel_visual_evidence");
  if (type === "speech_balloon" && textLoad(scene) === 0) warnings.push("speech_balloon_selected_without_text_evidence");
  if (score < 72) warnings.push("moment_score_below_premium_target");

  return {
    momentId: `${short.id}:scene-${scene.order}:${type}`,
    sceneOrder: scene.order,
    panelId: scene.panelId,
    pageNumber: scene.pageNumber,
    type,
    score,
    narrativeMatchScore,
    visualStrengthScore,
    retentionValueScore,
    normalizedCrop: primaryVisualTarget?.box ?? fallbackCropForType(type, scene),
    primaryVisualTarget,
    visualTargets,
    zoomInstruction: primaryVisualTarget
      ? `${zoomInstructionFor(type, scene)} Target: ${primaryVisualTarget.type}; anchor ${JSON.stringify(primaryVisualTarget.anchorPoint)}; ${primaryVisualTarget.renderInstruction}`
      : zoomInstructionFor(type, scene),
    cutIntent: cutIntentFor(type, scene),
    recommendedHoldSeconds: holdSecondsFor(scene, type),
    reasons: [
      ...reasonsFor(scene, type),
      ...(primaryVisualTarget ? [`target:${primaryVisualTarget.type}`, `target_confidence:${primaryVisualTarget.confidence}`] : [])
    ],
    warnings
  };
}

export function selectComicPanelMoments(input: {
  short: ComicShortProductionPlan;
}): ComicPanelMomentSelectorReport {
  const selectedMoments: ComicPanelMoment[] = [];
  const rejectedMoments: ComicPanelMoment[] = [];
  const warnings: string[] = [];

  for (const scene of input.short.scenes) {
    const candidates = candidateTypes(scene)
      .map((type) => buildMoment(input.short, scene, type))
      .sort((left, right) => right.score - left.score);
    const selected = candidates[0];
    if (selected) selectedMoments.push(selected);
    rejectedMoments.push(...candidates.slice(1));
    if (!selected || selected.score < 76) warnings.push(`scene_${scene.order}:no_premium_visual_moment`);
    if (selected?.type !== "speech_balloon" && textLoad(scene) >= 3 && scene.role !== "climax") {
      warnings.push(`scene_${scene.order}:dialogue_available_but_not_selected`);
    }
    if (!selected?.primaryVisualTarget || selected.primaryVisualTarget.confidence < 74) {
      warnings.push(`scene_${scene.order}:visual_target_needs_manual_review`);
    }
  }

  const averageMomentScore = selectedMoments.length
    ? Math.round(selectedMoments.reduce((sum, moment) => sum + moment.score, 0) / selectedMoments.length)
    : 0;

  return {
    selectorId: "comic_panel_moment_selector_v1",
    shortId: input.short.id,
    averageMomentScore,
    selectedMoments,
    rejectedMoments,
    warnings,
    nextImprovements: [
      "Add real CV/OCR bounding boxes for faces, balloons and action impacts to replace heuristic target boxes.",
      "Render a contact sheet for every selected target before approving a batch of shorts.",
      "Compare selected targets against the reference-video DNA to tune hold time, zoom speed and cut rhythm."
    ]
  };
}
