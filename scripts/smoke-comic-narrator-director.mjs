import {
  buildComicCuriosityPlan,
  buildComicNarrationActingPlan,
  buildComicNarrationPerformancePlan,
  getComicNarrationReferenceDnaById,
  buildComicNarratorDirectorPlan,
  buildComicPhraseVoicePlan,
} from "../packages/media-beast/dist/index.js";

const beats = [
  { beatId: "beat-1", role: "cold_open", narrationLine: "Por que Batman protegeria uma cidade que parecia apagada do mapa?" },
  { beatId: "beat-2", role: "setup", narrationLine: "Enquanto todos procuravam respostas faceis, ele percebeu que Arcadia escondia uma mentira antiga." },
  { beatId: "beat-3", role: "escalation", narrationLine: "Cada pista levava a uma sala mais escura, e cada porta aberta deixava o perigo mais perto." },
  { beatId: "beat-4", role: "climax", narrationLine: "Entao a verdade veio de uma vez: Ceres nunca existiu, e o ataque ja tinha comecado!" },
  { beatId: "beat-5", role: "resolution", narrationLine: "Batman entendeu tarde demais que aquela cidade nao queria ser salva do jeito que ele imaginava." },
];

const curiosityPlan = buildComicCuriosityPlan({
  beats: beats.map((beat, index) => ({ beatId: beat.beatId, narrationLine: beat.narrationLine, sourcePages: [index + 1], durationSeconds: 5 })),
  questions: [
    {
      questionId: "arcadia-secret",
      question: "Por que Batman protegeria Arcadia?",
      type: "why",
      openedAtBeatId: "beat-1",
      partialAnswerBeatIds: ["beat-2", "beat-3"],
      payoffBeatId: "beat-4",
      payoff: "Ceres nunca existiu e Arcadia era a armadilha.",
      evidenceBeatIds: ["beat-1", "beat-2", "beat-4"],
      isMacroQuestion: true,
      truthConfidence: 98,
    },
  ],
});

const phraseVoicePlan = buildComicPhraseVoicePlan({ beats });
const performancePlan = buildComicNarrationPerformancePlan({ phraseVoicePlan, curiosityPlan });
const actingPlan = buildComicNarrationActingPlan({ performancePlan });
const narratorPlan = buildComicNarratorDirectorPlan({ actingPlan, performancePlan });
const referenceDna = getComicNarrationReferenceDnaById("thwip_storytelling_v1");

if (!narratorPlan.passed) throw new Error(`Narrator Director rejected: ${narratorPlan.warnings.join(", ")}`);
if (narratorPlan.deliveryModeCount < 5) throw new Error("Narrator Director did not create enough delivery modes.");
if (narratorPlan.openQuestionCount < 1) throw new Error("Narrator Director must preserve open questions.");
if (narratorPlan.visualContractCoverage !== 1) throw new Error("Narrator Director must create visual contracts for every phrase.");
if (narratorPlan.referenceDnaId !== referenceDna.id) throw new Error("Narrator Director did not use the expected reference DNA.");
if (!narratorPlan.microPausePlan.passed) throw new Error(`Micro Pause Director rejected: ${narratorPlan.microPausePlan.warnings.join(", ")}`);
if (narratorPlan.averagePauseAfterMs < referenceDna.pauseProfile.shortPauseMs[0]) throw new Error("Average micro-pause is too short.");
if (narratorPlan.longPauseCount < 1) throw new Error("Narrator Director must create long reveal/payoff pauses.");
if (narratorPlan.averageEmotionIntensity < referenceDna.emotionalProfile.minimumEmotionIntensity) throw new Error("Narrator emotion intensity is too low.");

console.log(JSON.stringify({
  directorId: narratorPlan.directorId,
  cueCount: narratorPlan.cueCount,
  deliveryModeCount: narratorPlan.deliveryModeCount,
  openQuestionCount: narratorPlan.openQuestionCount,
  visualContractCoverage: narratorPlan.visualContractCoverage,
  referenceDnaId: narratorPlan.referenceDnaId,
  averagePauseAfterMs: narratorPlan.averagePauseAfterMs,
  longPauseCount: narratorPlan.longPauseCount,
  averageEmotionIntensity: narratorPlan.averageEmotionIntensity,
  status: "completed",
}, null, 2));
