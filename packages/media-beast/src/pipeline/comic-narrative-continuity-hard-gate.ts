import type { ComicArcScriptBeat } from "./comic-arc-script-doctor-v2.js";
import type { ComicPanelBattleTestReport } from "./comic-panel-battle-test.js";
import type { ComicPanelContinuityReport } from "./comic-panel-continuity-checker.js";
import type { ComicPostRenderCropQaReport } from "./comic-post-render-crop-qa.js";
import type { ComicShortFinalQaReport } from "./comic-short-final-quality-gate.js";

export type ComicNarrativeContinuityHardGate = {
  gateId: "comic_narrative_continuity_hard_gate_v1";
  status: "passed" | "blocked";
  score: number;
  minimumScore: 86;
  pageSequence: number[];
  panelSequence: string[];
  repeatedPanelCount: number;
  backwardPageJumpCount: number;
  largeForwardJumpCount: number;
  visualQualityReady: boolean;
  storyFlowReady: boolean;
  blockers: string[];
  warnings: string[];
  recommendations: string[];
};

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}


function panelOrderFromId(panelId: string): number {
  const match = panelId.match(/panel(\d+)/i);
  return match ? Number(match[1]) : 0;
}
function countRepeated(values: string[]): number {
  return Math.max(0, values.length - new Set(values).size);
}

export function evaluateComicNarrativeContinuityHardGate(input: {
  beats: ComicArcScriptBeat[];
  panelBattleTest: ComicPanelBattleTestReport;
  panelContinuityReport: ComicPanelContinuityReport;
  postRenderCropQa: ComicPostRenderCropQaReport;
  finalQualityGate: ComicShortFinalQaReport;
  allowReaderSafeWideContext?: boolean;
}): ComicNarrativeContinuityHardGate {
  const pageSequence = input.beats.map((beat) => beat.pageNumber);
  const panelSequence = input.beats.map((beat) => beat.panelId);
  const blockers: string[] = [];
  const warnings: string[] = [];
  const recommendations: string[] = [];

  const repeatedPanelCount = countRepeated(panelSequence);
  let backwardPageJumpCount = 0;
  let samePageBackwardPanelCount = 0;
  let largeForwardJumpCount = 0;
  for (let index = 1; index < pageSequence.length; index += 1) {
    const previous = pageSequence[index - 1] ?? 0;
    const current = pageSequence[index] ?? 0;
    const previousPanelOrder = panelOrderFromId(panelSequence[index - 1] ?? "");
    const currentPanelOrder = panelOrderFromId(panelSequence[index] ?? "");
    if (current < previous) {
      backwardPageJumpCount += 1;
      blockers.push(`page_sequence_goes_backward:${previous}->${current}`);
    }
    if (current === previous && currentPanelOrder > 0 && previousPanelOrder > 0 && currentPanelOrder < previousPanelOrder) {
      samePageBackwardPanelCount += 1;
      blockers.push(`same_page_panel_sequence_goes_backward:p${current}:panel${previousPanelOrder}->panel${currentPanelOrder}`);
    }
    if (current - previous > 4) {
      largeForwardJumpCount += 1;
      warnings.push(`large_forward_page_jump:${previous}->${current}`);
    }
  }
  if (repeatedPanelCount > 0) blockers.push(`repeated_panels:${repeatedPanelCount}`);
  if (input.panelBattleTest.averageSelectedScore < 72) {
    blockers.push(`panel_battle_score_too_low:${input.panelBattleTest.averageSelectedScore}`);
  }
  if (input.panelContinuityReport.repeatedPanelCount > 0) {
    blockers.push(`continuity_repeated_panels:${input.panelContinuityReport.repeatedPanelCount}`);
  }
  if (input.panelContinuityReport.status === "rejected") {
    blockers.push(`continuity_rejected:${input.panelContinuityReport.score}`);
  }
  const cropCanBeReaderSafeWarning = (input.postRenderCropQa.score >= 55 || input.allowReaderSafeWideContext === true) && input.finalQualityGate.status === "passed" && input.panelContinuityReport.status !== "rejected" && repeatedPanelCount === 0 && backwardPageJumpCount === 0;
  if (input.postRenderCropQa.score < 78) {
    if (cropCanBeReaderSafeWarning) warnings.push(`crop_qa_reader_safe_review:${input.postRenderCropQa.score}`);
    else blockers.push(`crop_qa_too_low:${input.postRenderCropQa.score}`);
  }
  if (input.finalQualityGate.status === "rejected") {
    blockers.push(`final_quality_rejected:${input.finalQualityGate.score}`);
  }

  if (!pageSequence.length) blockers.push("empty_page_sequence");
  if (pageSequence.length < 4) blockers.push("too_few_story_beats");
  if (input.panelBattleTest.averageSelectedScore < 82) warnings.push(`panel_battle_score_below_premium:${input.panelBattleTest.averageSelectedScore}`);
  if (input.postRenderCropQa.score < 88) warnings.push(`crop_qa_below_premium:${input.postRenderCropQa.score}`);
  if (input.panelContinuityReport.score < 88) warnings.push(`continuity_below_premium:${input.panelContinuityReport.score}`);

  if (backwardPageJumpCount > 0 || samePageBackwardPanelCount > 0) recommendations.push("Escolher apenas paineis em ordem de leitura: pagina crescente e painel crescente dentro da mesma pagina.");
  if (repeatedPanelCount > 0) recommendations.push("Substituir paineis repetidos por reacao/contexto/climax da mesma sequencia.");
  if (largeForwardJumpCount > 0) recommendations.push("Adicionar ponte visual ou escolher paineis intermediarios antes de saltos grandes.");
  if (input.panelBattleTest.averageSelectedScore < 82) recommendations.push("Reexecutar selecao privilegiando acao, balao, rosto e evidencia direta.");
  if (input.postRenderCropQa.score < 88) recommendations.push("Usar reader-safe crop expandido antes de renderizar.");

  const visualQualityReady =
    input.panelBattleTest.averageSelectedScore >= 72 &&
    (input.postRenderCropQa.score >= 78 || cropCanBeReaderSafeWarning) &&
    input.finalQualityGate.status !== "rejected";
  const storyFlowReady =
    repeatedPanelCount === 0 &&
    backwardPageJumpCount === 0 &&
    input.panelContinuityReport.status !== "rejected" &&
    pageSequence.length >= 4;

  const score = clampScore(
    100 -
      repeatedPanelCount * 24 -
      backwardPageJumpCount * 30 -
      largeForwardJumpCount * 8 -
      Math.max(0, 82 - input.panelBattleTest.averageSelectedScore) -
      Math.max(0, (cropCanBeReaderSafeWarning ? 62 : 88) - input.postRenderCropQa.score) -
      Math.max(0, 88 - input.panelContinuityReport.score)
  );

  return {
    gateId: "comic_narrative_continuity_hard_gate_v1",
    status: blockers.length === 0 && storyFlowReady && visualQualityReady && (score >= 86 || input.allowReaderSafeWideContext === true) ? "passed" : "blocked",
    score,
    minimumScore: 86,
    pageSequence,
    panelSequence,
    repeatedPanelCount,
    backwardPageJumpCount,
    largeForwardJumpCount,
    visualQualityReady,
    storyFlowReady,
    blockers,
    warnings,
    recommendations
  };
}
