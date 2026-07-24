import type { ComicEpisodeGodModeGate } from "./comic-episode-god-mode-gate.js";
import type { ComicNarrationPanelMatchPlan } from "./comic-narration-panel-matcher.js";
import type { ComicNarrationVisualDriftAutoFixPlan } from "./comic-narration-visual-drift-auto-fixer.js";
import type { ComicPostRenderCropQaReport } from "./comic-post-render-crop-qa.js";
import type { ComicProsodyQualityGate } from "./comic-prosody-quality-gate.js";

export type ComicPostRenderDirectorStatus = "approved" | "retry_required" | "blocked";

export type ComicRenderedSceneFrameQa = {
  sceneId: string;
  order: number;
  panelId?: string | null;
  pageNumber?: number | null;
  durationSeconds: number;
  frameSampleCount: number;
  visualHash?: string | null;
  previousVisualHash?: string | null;
  repeatedFrameRisk: "none" | "low" | "medium" | "high";
  blackFrameRatio?: number;
  captionVisible: boolean;
  captionOverflowRisk: "none" | "low" | "medium" | "high";
  focusTargetVisible: boolean;
  narrationAligned: boolean;
  notes?: string[];
};

export type ComicDirectorRetryAction = {
  sceneId: string;
  order: number;
  action:
    | "keep"
    | "swap_panel"
    | "retarget_crop"
    | "rerender_caption"
    | "resync_narration"
    | "regenerate_narration_take"
    | "shorten_hold"
    | "manual_review";
  severity: "low" | "medium" | "high";
  reason: string;
  suggestedFix: string;
};

export type ComicPostRenderDirectorReport = {
  reportId: "comic_post_render_director_v1";
  status: ComicPostRenderDirectorStatus;
  score: number;
  minimumApprovalScore: number;
  sceneCount: number;
  retrySceneCount: number;
  frameQaScore: number;
  visualAlignmentScore: number;
  narrationHumanScore: number;
  captionScore: number;
  continuityScore: number;
  godModeScore: number | null;
  blockers: string[];
  warnings: string[];
  retryActions: ComicDirectorRetryAction[];
  approvedSceneIds: string[];
  directorNotes: string[];
};

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function average(values: number[]): number {
  return values.length ? clamp(values.reduce((sum, value) => sum + value, 0) / values.length) : 0;
}

function frameSceneScore(scene: ComicRenderedSceneFrameQa): number {
  let score = 100;
  if (scene.repeatedFrameRisk === "high") score -= 45;
  if (scene.repeatedFrameRisk === "medium") score -= 25;
  if (scene.repeatedFrameRisk === "low") score -= 8;
  if ((scene.blackFrameRatio ?? 0) > 0.08) score -= 25;
  else if ((scene.blackFrameRatio ?? 0) > 0.03) score -= 10;
  if (!scene.captionVisible) score -= 25;
  if (scene.captionOverflowRisk === "high") score -= 35;
  if (scene.captionOverflowRisk === "medium") score -= 18;
  if (!scene.focusTargetVisible) score -= 30;
  if (!scene.narrationAligned) score -= 32;
  if (scene.durationSeconds > 4.2) score -= 12;
  return clamp(score);
}

function retryActionsForScene(scene: ComicRenderedSceneFrameQa, matchPlan?: ComicNarrationPanelMatchPlan | null): ComicDirectorRetryAction[] {
  const actions: ComicDirectorRetryAction[] = [];
  const match = matchPlan?.matches.find((item) => item.selectedPanelId && item.selectedPanelId === scene.panelId);
  if (scene.repeatedFrameRisk === "high" || scene.previousVisualHash && scene.previousVisualHash === scene.visualHash) {
    actions.push({
      sceneId: scene.sceneId,
      order: scene.order,
      action: "swap_panel",
      severity: "high",
      reason: "visual_repetition_detected",
      suggestedFix: "Trocar para uma alternativa do panel matcher ou inserir reação/contexto da mesma página sem voltar a história."
    });
  }
  if (!scene.focusTargetVisible) {
    actions.push({
      sceneId: scene.sceneId,
      order: scene.order,
      action: match?.alternatives.length ? "retarget_crop" : "manual_review",
      severity: "high",
      reason: "focus_target_not_visible",
      suggestedFix: match?.alternatives.length
        ? `Recalcular crop para ${match.zoomInstruction.mode} ou testar alternativa ${match.alternatives[0]?.panelId}.`
        : "Revisar painel manualmente; a fala promete algo que não aparece na tela."
    });
  }
  if (!scene.narrationAligned) {
    actions.push({
      sceneId: scene.sceneId,
      order: scene.order,
      action: "resync_narration",
      severity: "high",
      reason: "narration_visual_timing_mismatch",
      suggestedFix: "Deslocar início da cena ou trocar painel para o beat correto antes de renderizar de novo."
    });
  }
  if (!scene.captionVisible || scene.captionOverflowRisk === "high") {
    actions.push({
      sceneId: scene.sceneId,
      order: scene.order,
      action: "rerender_caption",
      severity: scene.captionOverflowRisk === "high" ? "high" : "medium",
      reason: "caption_not_publish_safe",
      suggestedFix: "Quebrar legenda em frases menores e mover para zona sem balão/rosto."
    });
  }
  if (scene.durationSeconds > 4.2) {
    actions.push({
      sceneId: scene.sceneId,
      order: scene.order,
      action: "shorten_hold",
      severity: "medium",
      reason: "scene_hold_too_long",
      suggestedFix: "Reduzir para até 4s ou dividir em close + reação."
    });
  }
  return actions;
}

function scoreCaptionFromFrames(frames: ComicRenderedSceneFrameQa[], cropQa?: ComicPostRenderCropQaReport | null): number {
  const frameCaptionScore = average(frames.map((scene) => {
    if (!scene.captionVisible) return 35;
    if (scene.captionOverflowRisk === "high") return 45;
    if (scene.captionOverflowRisk === "medium") return 72;
    if (scene.captionOverflowRisk === "low") return 88;
    return 96;
  }));
  if (!cropQa) return frameCaptionScore;
  return average([frameCaptionScore, cropQa.score]);
}

export function buildComicPostRenderDirectorReport(input: {
  scenes: ComicRenderedSceneFrameQa[];
  panelMatchPlan?: ComicNarrationPanelMatchPlan | null;
  godModeGate?: ComicEpisodeGodModeGate | null;
  cropQa?: ComicPostRenderCropQaReport | null;
  visualDriftFixPlan?: ComicNarrationVisualDriftAutoFixPlan | null;
  prosodyQualityGate?: ComicProsodyQualityGate | null;
  measuredNarrationHumanScore?: number | null;
  minimumApprovalScore?: number;
}): ComicPostRenderDirectorReport {
  const minimumApprovalScore = input.minimumApprovalScore ?? 90;
  const scenes = input.scenes;
  const sceneScores = scenes.map(frameSceneScore);
  const frameQaScore = average(sceneScores);
  const panelCoverageScore = input.panelMatchPlan?.beatCount
    ? clamp((input.panelMatchPlan.matchedCount / input.panelMatchPlan.beatCount) * 100)
    : 0;
  const panelConfidenceScore = input.panelMatchPlan?.averageScore ?? 0;
  const visualAlignmentScore = average([
    panelCoverageScore,
    panelConfidenceScore,
    input.visualDriftFixPlan ? (input.visualDriftFixPlan.passed ? 96 : Math.max(35, 86 - input.visualDriftFixPlan.hardSwapCount * 18)) : 80,
    average(scenes.map((scene) => scene.narrationAligned && scene.focusTargetVisible ? 96 : scene.narrationAligned || scene.focusTargetVisible ? 62 : 30))
  ]);
  const narrationHumanScore = clamp(input.measuredNarrationHumanScore ?? input.prosodyQualityGate?.score ?? 70);
  const captionScore = scoreCaptionFromFrames(scenes, input.cropQa);
  const continuityScore = average([
    input.panelMatchPlan ? (input.panelMatchPlan.repeatedPanelCount === 0 ? 100 : Math.max(20, 100 - input.panelMatchPlan.repeatedPanelCount * 35)) : 70,
    average(scenes.map((scene, index) => {
      if (index === 0) return 100;
      const previous = scenes[index - 1]!;
      if (scene.pageNumber !== null && scene.pageNumber !== undefined && previous.pageNumber !== null && previous.pageNumber !== undefined && scene.pageNumber < previous.pageNumber) return 25;
      return 96;
    }))
  ]);
  const godModeScore = input.godModeGate?.score ?? null;

  const retryActions = scenes.flatMap((scene) => retryActionsForScene(scene, input.panelMatchPlan));
  if (input.visualDriftFixPlan && !input.visualDriftFixPlan.passed) {
    for (const fix of input.visualDriftFixPlan.fixes.filter((item) => item.action !== "keep")) {
      retryActions.push({
        sceneId: `beat-${fix.sourceBeatIndex}`,
        order: fix.sourceBeatIndex + 1,
        action: fix.action === "swap_panel" ? "swap_panel" : fix.action === "retarget_crop" ? "retarget_crop" : "manual_review",
        severity: fix.action === "swap_panel" ? "high" : "medium",
        reason: fix.reason,
        suggestedFix: `Termos esperados: ${fix.requiredTerms.join(", ") || "n/a"}; encontrados: ${fix.matchedTerms.join(", ") || "nenhum"}.`
      });
    }
  }
  if (input.prosodyQualityGate && input.prosodyQualityGate.status === "rejected") {
    retryActions.push({
      sceneId: "narration-track",
      order: 0,
      action: "regenerate_narration_take",
      severity: "high",
      reason: "narration_prosody_rejected",
      suggestedFix: "Gerar um take único/por ato com curva emocional, pergunta subindo e payoff descendo, sem trocar timbre-base."
    });
  }

  const blockers: string[] = [];
  const warnings: string[] = [];
  if (frameQaScore < 78) blockers.push(`frame_qa_low:${frameQaScore}`);
  else if (frameQaScore < 90) warnings.push(`frame_qa_below_premium:${frameQaScore}`);
  if (visualAlignmentScore < 78) blockers.push(`visual_alignment_low:${visualAlignmentScore}`);
  else if (visualAlignmentScore < 90) warnings.push(`visual_alignment_below_premium:${visualAlignmentScore}`);
  if (narrationHumanScore < 72) blockers.push(`narration_human_score_low:${narrationHumanScore}`);
  else if (narrationHumanScore < 86) warnings.push(`narration_human_score_below_premium:${narrationHumanScore}`);
  if (captionScore < 76) blockers.push(`caption_score_low:${captionScore}`);
  else if (captionScore < 88) warnings.push(`caption_score_below_premium:${captionScore}`);
  if (continuityScore < 82) blockers.push(`continuity_score_low:${continuityScore}`);
  if (input.godModeGate && input.godModeGate.status === "blocked") blockers.push("god_mode_gate_blocked");
  else if (input.godModeGate && input.godModeGate.status !== "god_ready") warnings.push(`god_mode_gate_${input.godModeGate.status}`);

  const score = clamp(
    frameQaScore * 0.22 +
      visualAlignmentScore * 0.24 +
      narrationHumanScore * 0.18 +
      captionScore * 0.14 +
      continuityScore * 0.14 +
      (godModeScore ?? 80) * 0.08
  );
  const uniqueRetryActions = retryActions.filter((action, index, list) =>
    list.findIndex((item) => item.sceneId === action.sceneId && item.action === action.action && item.reason === action.reason) === index
  );
  const hardRetryCount = uniqueRetryActions.filter((action) => action.severity === "high").length;
  if (hardRetryCount > 0) blockers.push(`hard_retry_actions:${hardRetryCount}`);
  else if (uniqueRetryActions.length > 0) warnings.push(`retry_actions:${uniqueRetryActions.length}`);

  const status: ComicPostRenderDirectorStatus = blockers.length > 0
    ? "blocked"
    : score >= minimumApprovalScore && uniqueRetryActions.length === 0
      ? "approved"
      : "retry_required";

  return {
    reportId: "comic_post_render_director_v1",
    status,
    score,
    minimumApprovalScore,
    sceneCount: scenes.length,
    retrySceneCount: new Set(uniqueRetryActions.map((action) => action.sceneId)).size,
    frameQaScore,
    visualAlignmentScore,
    narrationHumanScore,
    captionScore,
    continuityScore,
    godModeScore,
    blockers: [...new Set(blockers)],
    warnings: [...new Set(warnings)],
    retryActions: uniqueRetryActions,
    approvedSceneIds: scenes.filter((scene) => !uniqueRetryActions.some((action) => action.sceneId === scene.sceneId)).map((scene) => scene.sceneId),
    directorNotes: [
      status === "approved"
        ? "Video aprovado para publicacao: frame, narracao, legenda e continuidade estao no alvo premium."
        : status === "retry_required"
          ? "Video quase pronto: refazer apenas cenas marcadas antes do render final."
          : "Video bloqueado: o resultado atual nao deve ser publicado sem correcoes.",
      uniqueRetryActions.length
        ? `Refazer ${new Set(uniqueRetryActions.map((action) => action.sceneId)).size} cena(s): ${uniqueRetryActions.slice(0, 5).map((action) => `${action.order}:${action.action}`).join(", ")}.`
        : "Nenhuma cena marcada para retry.",
      "O report e candidate-first: ele nao apaga renders e nao substitui assets sem aprovacao."
    ]
  };
}
