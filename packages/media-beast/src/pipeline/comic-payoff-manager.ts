import type { ComicCuriosityPlan } from "./comic-curiosity-engine.js";

export type ComicPayoffReport = {
  managerId: "comic_payoff_manager_v1";
  status: "passed" | "rejected";
  score: number;
  orphanQuestionIds: string[];
  prematurePayoffQuestionIds: string[];
  missingPartialAnswerQuestionIds: string[];
  unsupportedPayoffQuestionIds: string[];
  payoffCoverage: number;
  recommendations: string[];
};

export function evaluateComicPayoffs(input: {
  curiosityPlan: ComicCuriosityPlan;
  minimumBeatDistance?: number;
}): ComicPayoffReport {
  const minimumBeatDistance = input.minimumBeatDistance ?? 1;
  const orphanQuestionIds = input.curiosityPlan.questions.filter((question) => question.status !== "resolved").map((question) => question.questionId);
  const prematurePayoffQuestionIds = input.curiosityPlan.questions.filter((question) => question.payoffBeatIndex - question.openedAtBeatIndex < minimumBeatDistance).map((question) => question.questionId);
  const missingPartialAnswerQuestionIds = input.curiosityPlan.questions.filter((question) =>
    question.isMacroQuestion && (question.partialAnswerBeatIds?.length ?? 0) < 2
  ).map((question) => question.questionId);
  const unsupportedPayoffQuestionIds = input.curiosityPlan.questions.filter((question) =>
    question.truthConfidence < 70 || question.evidenceBeatIds.length === 0
  ).map((question) => question.questionId);
  const resolved = input.curiosityPlan.questions.length - orphanQuestionIds.length;
  const payoffCoverage = input.curiosityPlan.questions.length ? Number((resolved / input.curiosityPlan.questions.length).toFixed(3)) : 0;
  const score = Math.max(0, Math.min(100, Math.round(
    payoffCoverage * 55 +
    (input.curiosityPlan.macroQuestionCount > 0 ? 15 : 0) +
    (input.curiosityPlan.maximumSimultaneousOpenQuestions <= 2 ? 10 : 0) +
    (missingPartialAnswerQuestionIds.length === 0 ? 10 : 0) +
    (unsupportedPayoffQuestionIds.length === 0 ? 10 : 0) -
    prematurePayoffQuestionIds.length * 8
  )));
  const recommendations: string[] = [];
  if (orphanQuestionIds.length) recommendations.push("Fechar toda pergunta aberta com uma resposta visualmente comprovada.");
  if (prematurePayoffQuestionIds.length) recommendations.push("Adicionar complicacao antes de entregar o payoff.");
  if (missingPartialAnswerQuestionIds.length) recommendations.push("Distribuir respostas parciais da pergunta principal ao longo do video.");
  if (unsupportedPayoffQuestionIds.length) recommendations.push("Ancorar o payoff em paginas e beats confirmados.");
  const status = input.curiosityPlan.passed && score >= 85 && orphanQuestionIds.length === 0 && unsupportedPayoffQuestionIds.length === 0 ? "passed" : "rejected";
  return { managerId: "comic_payoff_manager_v1", status, score, orphanQuestionIds, prematurePayoffQuestionIds, missingPartialAnswerQuestionIds, unsupportedPayoffQuestionIds, payoffCoverage, recommendations };
}
