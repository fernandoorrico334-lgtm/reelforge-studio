import type { ComicStoryArcV2 } from "./comic-story-arc-miner-v2.js";
import type { ComicArcScriptDoctorV2Result } from "./comic-arc-script-doctor-v2.js";
import type { ComicProjectBridgeSceneInput, ComicProjectPanelAssetManifestEntry } from "./comic-project-bridge.js";
import type { directComicArcVisualPlan } from "./comic-arc-visual-director.js";

export type ComicShortFinalQaStatus = "passed" | "needs_review" | "rejected";

export type ComicShortFinalQaReport = {
  qaId: "comic_short_final_quality_gate_v1";
  status: ComicShortFinalQaStatus;
  score: number;
  minimumScore: number;
  blockers: string[];
  warnings: string[];
  strengths: string[];
  checks: {
    durationSeconds: number;
    sceneCount: number;
    panelCount: number;
    uniquePanelCount: number;
    hasHook: boolean;
    hasClimax: boolean;
    hasPayoff: boolean;
    arcScore: number;
    scriptScore: number;
    humanScore: number;
    retentionScore: number;
    averageSceneDurationSeconds: number;
    genericNarrationSignals: string[];
    missingPanelScenes: number;
    repeatedPanelCount: number;
    averagePanelNarrationAlignmentScore: number;
  };
  nextActions: string[];
};

export type ComicShortFinalQaInput = {
  arc: ComicStoryArcV2;
  script: ComicArcScriptDoctorV2Result;
  scenes: ComicProjectBridgeSceneInput[];
  panelAssetManifest: ComicProjectPanelAssetManifestEntry[];
  targetDurationSeconds: number;
  arcVisualPlan?: ReturnType<typeof directComicArcVisualPlan>;
};

const genericNarrationPatterns = [
  /isso e (muito )?(louco|incrivel|absurdo)/i,
  /voce nao vai acreditar/i,
  /olha so/i,
  /nesse video/i,
  /essa historia e muito boa/i,
  /acontece uma coisa/i,
  /algo acontece/i
];

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function genericSignals(text: string) {
  return genericNarrationPatterns
    .filter((pattern) => pattern.test(text))
    .map((pattern) => `generic_phrase:${pattern.source}`);
}

function roleSet(input: ComicShortFinalQaInput) {
  return new Set(input.script.beats.map((beat) => beat.role));
}

export function evaluateComicShortFinalQualityGate(input: ComicShortFinalQaInput): ComicShortFinalQaReport {
  const totalDuration = input.scenes.reduce((sum, scene) => sum + (scene.duration ?? 0), 0) || input.targetDurationSeconds;
  const panelIds = input.panelAssetManifest.map((panel) => panel.panelId).filter(Boolean);
  const uniquePanelIds = unique(panelIds);
  const roles = roleSet(input);
  const fullNarration = [input.script.fullNarration, ...input.scenes.map((scene) => scene.narrationText ?? "")].join("\n");
  const narrationSignals = genericSignals(fullNarration);
  const missingPanelScenes = input.scenes.filter((scene) => !scene.visualPrompt?.trim() && !scene.visualRecipe?.trim()).length;
  const repeatedPanelCount = Math.max(0, panelIds.length - uniquePanelIds.length);
  const averageSceneDuration = input.scenes.length > 0 ? totalDuration / input.scenes.length : 0;
  const averagePanelNarrationAlignmentScore = input.arcVisualPlan?.averagePanelNarrationAlignmentScore ?? 0;

  const blockers: string[] = [];
  const warnings: string[] = [];
  const strengths: string[] = [];

  if (totalDuration < 30) blockers.push("duration_below_30_seconds");
  if (input.scenes.length < 4) blockers.push("too_few_scenes_for_story_short");
  if (!roles.has("hook")) blockers.push("missing_hook_beat");
  if (!roles.has("climax")) blockers.push("missing_climax_beat");
  if (!roles.has("payoff")) warnings.push("missing_payoff_beat");
  if (input.arc.overallScore < 78) warnings.push("arc_score_below_premium_threshold");
  if (input.script.overallScore < 82) warnings.push("script_score_below_premium_threshold");
  if (input.script.humanScore < 86) warnings.push("narration_human_score_below_premium_threshold");
  if (input.script.retentionScore < 80) warnings.push("retention_score_below_premium_threshold");
  if (narrationSignals.length > 0) blockers.push("generic_narration_detected");
  if (missingPanelScenes > 0) blockers.push("scenes_missing_visual_panel_reference");
  if (repeatedPanelCount > Math.max(1, Math.floor(panelIds.length * 0.35))) warnings.push("too_many_reused_panels");
  if (averageSceneDuration > 9) warnings.push("scene_pace_too_slow_for_shorts");
  if (input.arcVisualPlan && averagePanelNarrationAlignmentScore < 72) blockers.push("panel_narration_alignment_below_minimum");
  else if (input.arcVisualPlan && averagePanelNarrationAlignmentScore < 82) warnings.push("panel_narration_alignment_needs_review");
  if (input.arc.visualStrengthScore >= 85) strengths.push("strong_visual_arc");
  if (input.script.humanScore >= 90) strengths.push("human_narration_ready");
  if (input.script.retentionScore >= 85) strengths.push("strong_retention_structure");
  if (roles.has("hook") && roles.has("climax") && roles.has("payoff")) strengths.push("complete_story_shape");
  if (uniquePanelIds.length >= Math.min(4, input.scenes.length)) strengths.push("panel_variety_ready");
  if (averagePanelNarrationAlignmentScore >= 86) strengths.push("panel_narration_alignment_ready");

  let score = 100;
  score -= blockers.length * 20;
  score -= warnings.length * 8;
  score += strengths.length * 4;
  score += clamp(input.arc.overallScore - 80, 0, 12) * 0.5;
  score += clamp(input.script.overallScore - 82, 0, 12) * 0.5;
  score = Math.round(clamp(score));

  const minimumScore = 82;
  const status: ComicShortFinalQaStatus = blockers.length > 0
    ? "rejected"
    : score >= minimumScore && warnings.length <= 2
      ? "passed"
      : "needs_review";

  const nextActions: string[] = [];
  if (blockers.includes("duration_below_30_seconds")) nextActions.push("Aumentar duracao total para pelo menos 30 segundos.");
  if (blockers.includes("generic_narration_detected")) nextActions.push("Reprocessar Script Doctor para remover frases genericas e criar fala mais humana.");
  if (blockers.includes("scenes_missing_visual_panel_reference")) nextActions.push("Selecionar paineis reais para todas as cenas antes do render.");
  if (warnings.includes("scene_pace_too_slow_for_shorts")) nextActions.push("Dividir cenas longas em cortes menores com zoom/SFX.");
  if (warnings.includes("too_many_reused_panels")) nextActions.push("Substituir paineis repetidos por alternativas da mesma pagina/arco.");
  if (blockers.includes("panel_narration_alignment_below_minimum") || warnings.includes("panel_narration_alignment_needs_review")) nextActions.push("Trocar painel ou reescrever narracao para provar exatamente o que aparece no quadro.");
  if (nextActions.length === 0) nextActions.push("Revisar direitos, importar paineis aprovados e validar render blueprint antes do render final.");

  return {
    qaId: "comic_short_final_quality_gate_v1",
    status,
    score,
    minimumScore,
    blockers,
    warnings,
    strengths,
    checks: {
      durationSeconds: totalDuration,
      sceneCount: input.scenes.length,
      panelCount: panelIds.length,
      uniquePanelCount: uniquePanelIds.length,
      hasHook: roles.has("hook"),
      hasClimax: roles.has("climax"),
      hasPayoff: roles.has("payoff"),
      arcScore: input.arc.overallScore,
      scriptScore: input.script.overallScore,
      humanScore: input.script.humanScore,
      retentionScore: input.script.retentionScore,
      averageSceneDurationSeconds: Math.round(averageSceneDuration * 10) / 10,
      genericNarrationSignals: narrationSignals,
      missingPanelScenes,
      repeatedPanelCount,
      averagePanelNarrationAlignmentScore
    },
    nextActions
  };
}
