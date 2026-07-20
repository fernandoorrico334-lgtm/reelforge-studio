import {
  buildComicCuriosityPlan,
  buildComicNarrationPerformancePlan,
  buildComicPhraseVoicePlan,
  evaluateComicProsodyQuality,
  selectComicNarrationTake,
} from "../packages/media-beast/dist/index.js";

const beats = [
  { beatId: "beat-1", role: "cold_open", narrationLine: "Superman encontrou Godzila. Mas como ele chegou ate esse confronto?" },
  { beatId: "beat-2", role: "setup", narrationLine: "Enquanto todos olhavam para Kong, Lex conquistava exatamente o que queria." },
  { beatId: "beat-3", role: "reversal", narrationLine: "A resposta estava na Caixa Materna: Lex queria abrir um portal." },
  { beatId: "beat-4", role: "escalation", narrationLine: "Mas o golpe atingiu a caixa, rasgou o espaco e libertou os Titas." },
  { beatId: "beat-5", role: "climax", narrationLine: "Entao Superman atacou, e o impacto fez a cidade inteira tremer." },
  { beatId: "beat-6", role: "resolution", narrationLine: "Foi assim que a Liga finalmente entendeu o verdadeiro plano." },
];
const curiosityPlan = buildComicCuriosityPlan({
  beats: beats.map((beat, index) => ({ beatId: beat.beatId, narrationLine: beat.narrationLine, sourcePages: [index + 4], durationSeconds: 8 })),
  questions: [
    { questionId: "macro", question: "Como Superman chegou ao confronto?", type: "how", openedAtBeatId: "beat-1", partialAnswerBeatIds: ["beat-2"], payoffBeatId: "beat-6", payoff: "A Liga entendeu o plano.", evidenceBeatIds: ["beat-1", "beat-2", "beat-6"], isMacroQuestion: true, truthConfidence: 98 },
    { questionId: "lex", question: "O que Lex queria?", type: "what", openedAtBeatId: "beat-2", partialAnswerBeatIds: [], payoffBeatId: "beat-3", payoff: "Lex queria abrir o portal.", evidenceBeatIds: ["beat-2", "beat-3"], truthConfidence: 97 },
  ],
});
const phraseVoicePlan = buildComicPhraseVoicePlan({ beats });
const performancePlan = buildComicNarrationPerformancePlan({ phraseVoicePlan, curiosityPlan });
const plannedGate = evaluateComicProsodyQuality({ performancePlan });
if (!performancePlan.passed || plannedGate.status !== "passed") {
  throw new Error("Planned performance gate failed: " + plannedGate.warnings.join(","));
}
const selections = performancePlan.performances.map((performance) => {
  const targetSeconds = performance.text.split(" ").filter(Boolean).length / (performance.targetWordsPerMinute / 60);
  return selectComicNarrationTake({
    performance,
    takes: performance.takes.map((take, index) => ({
      takeId: take.takeId,
      path: "synthetic-take-" + index + ".wav",
      durationSeconds: targetSeconds * (index === performance.takes.length - 1 ? 1.01 : 1.24),
    })),
  });
});
const measuredGate = evaluateComicProsodyQuality({ performancePlan, selections });
if (measuredGate.status !== "passed") throw new Error("Measured performance gate failed: " + measuredGate.warnings.join(","));
if (performancePlan.criticalPhraseCount < 3) throw new Error("Expected multiple critical narration phrases.");
if (performancePlan.plannedTakeCount <= performancePlan.phraseCount) throw new Error("Critical phrases did not receive alternate takes.");
console.log(JSON.stringify({
  directorId: performancePlan.directorId,
  phraseCount: performancePlan.phraseCount,
  criticalPhraseCount: performancePlan.criticalPhraseCount,
  plannedTakeCount: performancePlan.plannedTakeCount,
  emotionalRange: performancePlan.emotionalRange,
  questionPhraseCount: performancePlan.questionPhraseCount,
  payoffPhraseCount: performancePlan.payoffPhraseCount,
  prosodyScore: measuredGate.score,
  averageSelectedTakeScore: measuredGate.averageSelectedTakeScore,
  status: "completed",
}, null, 2));

