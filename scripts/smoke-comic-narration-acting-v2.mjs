import {
  buildComicCuriosityPlan,
  buildComicNarrationActingPlan,
  buildComicNarrationPerformancePlan,
  buildComicPhraseVoicePlan,
  evaluateComicNarrationScreenAlignment,
  selectComicNarrationTake,
} from "../packages/media-beast/dist/index.js";

const beats = [
  { beatId: "beat-1", role: "cold_open", narrationLine: "Por que Batman protegeria Arcadia?" },
  { beatId: "beat-2", role: "reversal", narrationLine: "A verdade estava escondida nos arquivos." },
  { beatId: "beat-3", role: "climax", narrationLine: "Ceres nunca existiu. A tropa atacou!" },
  { beatId: "beat-4", role: "resolution", narrationLine: "A resposta viria depois do confronto." },
];
const curiosityPlan = buildComicCuriosityPlan({
  beats: beats.map((beat, index) => ({ beatId: beat.beatId, narrationLine: beat.narrationLine, sourcePages: [index + 1], durationSeconds: 5 })),
  questions: [{ questionId: "arcadia", question: "Por que Batman protegeria Arcadia?", type: "why", openedAtBeatId: "beat-1", partialAnswerBeatIds: ["beat-2"], payoffBeatId: "beat-3", payoff: "Ceres era uma mentira.", evidenceBeatIds: ["beat-1", "beat-2", "beat-3"], isMacroQuestion: true, truthConfidence: 98 }],
});
const phraseVoicePlan = buildComicPhraseVoicePlan({ beats });
const performancePlan = buildComicNarrationPerformancePlan({ phraseVoicePlan, curiosityPlan });
const actingPlan = buildComicNarrationActingPlan({ performancePlan });
if (!actingPlan.passed || actingPlan.intentionCount < 4) throw new Error("Acting Director V2 did not create enough acting variation.");

const performance = performancePlan.performances[0];
const direction = actingPlan.directions[0];
const selected = selectComicNarrationTake({
  performance,
  targetExpressiveRangeDb: direction.targetExpressiveRangeDb,
  takes: [
    { takeId: "flat", path: "flat.wav", durationSeconds: 2.1, expressiveRangeDb: 1.2, energyVariation: 0.1 },
    { takeId: "human", path: "human.wav", durationSeconds: 2.2, expressiveRangeDb: direction.targetExpressiveRangeDb, energyVariation: 0.42 },
  ],
});
if (selected.selectedTakeId !== "human") throw new Error("Flat narration take was not rejected.");

const cues = actingPlan.directions.map((item, index) => ({ cueId: `cue-${index + 1}`, sourceBeatIndex: item.sourceBeatIndex, text: item.displayText, focusTarget: item.expectedVisualTerms[0] ?? null, startSeconds: index * 2, endSeconds: index * 2 + 2 }));
const alignment = evaluateComicNarrationScreenAlignment({ actingPlan, cues });
if (alignment.status !== "passed") throw new Error(`Screen alignment failed: ${alignment.coverage}`);

console.log(JSON.stringify({ directorId: actingPlan.directorId, intentionCount: actingPlan.intentionCount, expressivePhraseCoverage: actingPlan.expressivePhraseCoverage, selectedTakeId: selected.selectedTakeId, screenAlignmentCoverage: alignment.coverage, status: "completed" }, null, 2));
