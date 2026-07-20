import {
  buildComicCuriosityPlan,
  buildComicDialogueAwarenessPlan,
  buildComicNarrationActingPlan,
  buildComicNarrationEmotionArcPlan,
  buildComicNarrationPerformancePlan,
  buildComicNarrationVisualDriftAutoFixPlan,
  buildComicNarratorDirectorPlan,
  buildComicPhraseVoicePlan,
  buildComicSceneEmotionVoicePlan,
  evaluateComicVisualNarrationContract,
  getComicNarrationReferenceDnaById,
  scoreComicNarrationAgainstReference,
} from "../packages/media-beast/dist/index.js";

const beats = [
  { beatId: "beat-1", role: "cold_open", narrationLine: "Superman encarou Godzilla no meio da cidade. Mas como esse monstro chegou ali?", sourcePages: [1], durationSeconds: 7 },
  { beatId: "beat-2", role: "setup", narrationLine: "Enquanto todos olhavam para o caos, Batman percebeu o detalhe que entregava Lex Luthor.", sourcePages: [2], durationSeconds: 7 },
  { beatId: "beat-3", role: "climax", narrationLine: "A Caixa Materna abriu o portal, e o golpe jogou a cidade inteira para dentro da guerra.", sourcePages: [3], durationSeconds: 7 },
  { beatId: "beat-4", role: "resolution", narrationLine: "Agora a pergunta era outra: quem conseguiria fechar o portal antes do proximo ataque?", sourcePages: [4], durationSeconds: 7 },
];

const curiosityPlan = buildComicCuriosityPlan({
  beats,
  questions: [
    { questionId: "monster-arrival", question: "Como Godzilla chegou ali?", type: "how", openedAtBeatId: "beat-1", partialAnswerBeatIds: ["beat-2"], payoffBeatId: "beat-3", payoff: "A Caixa Materna abriu o portal.", evidenceBeatIds: ["beat-1", "beat-3"], isMacroQuestion: true, truthConfidence: 98 },
    { questionId: "close-portal", question: "Quem fecharia o portal?", type: "who", openedAtBeatId: "beat-4", partialAnswerBeatIds: [], payoffBeatId: "beat-4", payoff: "A resposta fica como gancho para a proxima parte.", evidenceBeatIds: ["beat-4"], truthConfidence: 92 },
  ],
});

const phraseVoicePlan = buildComicPhraseVoicePlan({ beats });
const performancePlan = buildComicNarrationPerformancePlan({ phraseVoicePlan, curiosityPlan });
const actingPlan = buildComicNarrationActingPlan({ performancePlan });
const narratorPlan = buildComicNarratorDirectorPlan({ actingPlan, performancePlan, referenceDnaId: "historian_cinematic_ptbr_v1" });
const emotionArcPlan = buildComicNarrationEmotionArcPlan({ cues: narratorPlan.cues });
const voicePlan = buildComicSceneEmotionVoicePlan({ narratorCues: narratorPlan.cues, emotionArcPlan });

const visualContract = evaluateComicVisualNarrationContract({
  cues: narratorPlan.cues,
  visuals: [
    { sourceBeatIndex: 0, text: "Superman encara Godzilla, monstro no meio da cidade", focusTarget: "Superman Godzilla monstro cidade" },
    { sourceBeatIndex: 1, text: "Batman observa Lex Luthor no caos e percebe detalhe", focusTarget: "Batman Lex Luthor caos detalhe" },
    { sourceBeatIndex: 2, text: "Caixa Materna abre portal e golpe atravessa a cidade", focusTarget: "Caixa Materna portal golpe cidade" },
    { sourceBeatIndex: 3, text: "portal aberto antes do proximo ataque", focusTarget: "portal ataque" },
  ],
});
const driftFixPlan = buildComicNarrationVisualDriftAutoFixPlan({ visualContractGate: visualContract });
const dialoguePlan = buildComicDialogueAwarenessPlan({
  cues: [
    { cueId: "cue-1", sourceBeatIndex: 0, hasDialogue: false, durationSeconds: 2.4, text: beats[0].narrationLine },
    { cueId: "cue-2", sourceBeatIndex: 1, hasDialogue: true, durationSeconds: 3.1, text: 'Batman pergunta: "O que Lex esta fazendo?"' },
    { cueId: "cue-3", sourceBeatIndex: 2, hasDialogue: false, durationSeconds: 2.8, text: beats[2].narrationLine },
    { cueId: "cue-4", sourceBeatIndex: 3, hasDialogue: true, durationSeconds: 3.2, text: 'A Liga grita: "Fechem o portal!"' },
  ],
  shots: [
    { beatIndex: 0, dialogueBalloonId: null, semanticAssociationConfidence: 70, shotRole: "impact", durationSeconds: 2.4 },
    { beatIndex: 1, dialogueBalloonId: "balloon-1", semanticAssociationConfidence: 88, shotRole: "dialogue", durationSeconds: 3.1 },
    { beatIndex: 2, dialogueBalloonId: null, semanticAssociationConfidence: 75, shotRole: "action", durationSeconds: 2.8 },
    { beatIndex: 3, dialogueBalloonId: "balloon-2", semanticAssociationConfidence: 82, shotRole: "dialogue", durationSeconds: 3.2 },
  ],
});
const referenceDna = getComicNarrationReferenceDnaById("historian_cinematic_ptbr_v1");
const referenceScore = scoreComicNarrationAgainstReference({ referenceDna, narratorPlan, emotionArcPlan });

if (!voicePlan.passed) throw new Error(`Scene emotion voice rejected: ${voicePlan.warnings.join(", ")}`);
if (visualContract.status !== "passed") throw new Error(`Visual contract rejected: ${visualContract.warnings.join(", ")}`);
if (!driftFixPlan.passed) throw new Error(`Visual drift fixer rejected: ${driftFixPlan.warnings.join(", ")}`);
if (!dialoguePlan.passed) throw new Error(`Dialogue awareness rejected: ${dialoguePlan.warnings.join(", ")}`);
if (dialoguePlan.dialogueCueCount < 2) throw new Error("Dialogue awareness must detect dialogue cues.");
if (referenceScore.status !== "passed") throw new Error(`Reference score rejected: ${referenceScore.warnings.join(", ")}`);

console.log(JSON.stringify({
  voiceCueCount: voicePlan.cueCount,
  averageExpressiveRangeDb: voicePlan.averageExpressiveRangeDb,
  dialogueCueCount: dialoguePlan.dialogueCueCount,
  averageDialogueHoldSeconds: dialoguePlan.averageHoldSeconds,
  visualContractCoverage: visualContract.averageCoverage,
  visualDriftFixCount: driftFixPlan.fixCount,
  referenceStyleScore: referenceScore.score,
  referencePauseScore: referenceScore.pauseScore,
  referenceEmotionScore: referenceScore.emotionScore,
  status: "completed",
}, null, 2));
