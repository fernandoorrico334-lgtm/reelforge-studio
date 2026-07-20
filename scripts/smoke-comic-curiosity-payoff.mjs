import { buildComicCuriosityPlan, evaluateComicPayoffs } from "../packages/media-beast/dist/index.js";

const beats = Array.from({ length: 7 }, (_, index) => ({ beatId: `beat-${index + 1}`, narrationLine: `Verified story beat ${index + 1}`, sourcePages: [index + 4], durationSeconds: 12 }));
const questions = [
  { questionId: "macro", question: "Como os herois sobrevivem?", type: "how", openedAtBeatId: "beat-1", partialAnswerBeatIds: ["beat-3", "beat-5"], payoffBeatId: "beat-7", payoff: "Eles fecham o portal.", evidenceBeatIds: ["beat-1", "beat-5", "beat-7"], isMacroQuestion: true, truthConfidence: 98 },
  { questionId: "micro-1", question: "O que o vilao queria?", type: "what", openedAtBeatId: "beat-1", partialAnswerBeatIds: ["beat-2"], payoffBeatId: "beat-3", payoff: "Ele queria abrir o portal.", evidenceBeatIds: ["beat-1", "beat-2", "beat-3"], truthConfidence: 95 },
  { questionId: "micro-2", question: "O plano final funcionaria?", type: "can", openedAtBeatId: "beat-4", partialAnswerBeatIds: ["beat-5"], payoffBeatId: "beat-6", payoff: "A abertura permitiu o ataque.", evidenceBeatIds: ["beat-4", "beat-5", "beat-6"], truthConfidence: 96 },
];
const plan = buildComicCuriosityPlan({ beats, questions });
const payoff = evaluateComicPayoffs({ curiosityPlan: plan });
if (!plan.passed) throw new Error(`Curiosity plan failed: ${plan.warnings.join(",")}`);
if (payoff.status !== "passed") throw new Error(`Payoff report failed: ${payoff.recommendations.join(",")}`);
if (plan.maximumSimultaneousOpenQuestions > 2) throw new Error("Too many simultaneous questions.");
if (payoff.payoffCoverage !== 1) throw new Error("Not every question received a payoff.");
console.log(JSON.stringify({ engineId: plan.engineId, questionCount: plan.questionCount, maximumSimultaneousOpenQuestions: plan.maximumSimultaneousOpenQuestions, maximumSecondsWithoutOpenQuestion: plan.maximumSecondsWithoutOpenQuestion, payoffManagerId: payoff.managerId, payoffScore: payoff.score, payoffCoverage: payoff.payoffCoverage, status: "completed" }, null, 2));
