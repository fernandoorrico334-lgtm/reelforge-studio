import type { ComicNarrationPerformancePlan } from "./comic-narration-performance-director.js";
import type { ComicNarrationTakeSelection } from "./comic-narration-take-selector.js";

export type ComicProsodyQualityGate = {
  gateId: "comic_prosody_quality_gate_v1";
  status: "passed" | "rejected";
  score: number;
  emotionalRange: number;
  energyLevelCount: number;
  paceLevelCount: number;
  multiTakeCriticalCoverage: number;
  questionDirectionCoverage: number;
  payoffDirectionCoverage: number;
  averageSelectedTakeScore: number | null;
  warnings: string[];
};

export function evaluateComicProsodyQuality(input: {
  performancePlan: ComicNarrationPerformancePlan;
  selections?: ComicNarrationTakeSelection[];
}): ComicProsodyQualityGate {
  const performances = input.performancePlan.performances;
  const critical = performances.filter((performance) => performance.criticalPhrase);
  const questions = performances.filter((performance) => performance.narrativeFunction === "question");
  const payoffs = performances.filter((performance) => performance.narrativeFunction === "payoff");
  const ratio = (hits: number, total: number) => total ? Number((hits / total).toFixed(3)) : 0;
  const multiTakeCriticalCoverage = ratio(critical.filter((performance) => performance.takes.length >= 2).length, critical.length);
  const questionDirectionCoverage = ratio(questions.filter((performance) => performance.pitchContour === "rising_question" && performance.subtext.includes("resposta")).length, questions.length);
  const payoffDirectionCoverage = ratio(payoffs.filter((performance) => performance.pitchContour === "falling_reveal" && performance.subtext.includes("peso")).length, payoffs.length);
  const energyLevelCount = new Set(performances.map((performance) => Math.round(performance.energy * 10))).size;
  const paceLevelCount = new Set(performances.map((performance) => performance.targetWordsPerMinute)).size;
  const averageSelectedTakeScore = input.selections?.length ? Number((input.selections.reduce((sum, selection) => sum + selection.score, 0) / input.selections.length).toFixed(2)) : null;
  const warnings: string[] = [];
  if (input.performancePlan.emotionalRange < 0.4) warnings.push("emotional_curve_too_flat");
  if (energyLevelCount < 4) warnings.push("insufficient_energy_variation");
  if (paceLevelCount < 3) warnings.push("insufficient_pace_variation");
  if (multiTakeCriticalCoverage < 1) warnings.push("critical_phrase_without_alternate_take");
  if (questionDirectionCoverage < 1) warnings.push("question_without_suspense_direction");
  if (payoffDirectionCoverage < 1) warnings.push("payoff_without_release_direction");
  if (averageSelectedTakeScore !== null && averageSelectedTakeScore < 60) warnings.push("selected_take_quality_below_threshold");
  if (input.selections?.some((selection) => !selection.presencePassed)) warnings.push("selected_take_presence_below_threshold");
  const score = Math.max(0, Math.min(100, Math.round(
    input.performancePlan.emotionalRange * 30 + Math.min(20, energyLevelCount * 3) + Math.min(15, paceLevelCount * 4) + multiTakeCriticalCoverage * 15 + questionDirectionCoverage * 10 + payoffDirectionCoverage * 10
  )));
  if (input.selections?.some((selection) => !selection.asrPassed)) warnings.push("selected_take_intelligibility_below_threshold");
  return { gateId: "comic_prosody_quality_gate_v1", status: input.performancePlan.passed && warnings.length === 0 && score >= 80 ? "passed" : "rejected", score, emotionalRange: input.performancePlan.emotionalRange, energyLevelCount, paceLevelCount, multiTakeCriticalCoverage, questionDirectionCoverage, payoffDirectionCoverage, averageSelectedTakeScore, warnings };
}
