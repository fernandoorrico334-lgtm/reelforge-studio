import {
  applyComicTtsPronunciation,
  assertComicDisplayTextHasNoPhoneticLeak,
  buildComicCuriosityPlan,
  buildComicNarrationActingPlan,
  buildComicNarrationEmotionArcPlan,
  buildComicNarrationPerformancePlan,
  buildComicNarratorDirectorPlan,
  buildComicOralPerformanceRewritePlan,
  buildComicPhraseVoicePlan,
  evaluateComicVisualNarrationContract,
} from "../packages/media-beast/dist/index.js";

const rawBeats = [
  {
    beatId: "beat-1",
    role: "cold_open",
    text: "Superman encontrou Godzilla no meio da cidade.",
    hiddenInformation: "o portal ja tinha sido aberto antes",
    stakes: "a Liga ainda nao entendia quem tinha provocado aquilo",
  },
  {
    beatId: "beat-2",
    role: "setup",
    text: "Batman percebeu que Lex Luthor estava escondendo o verdadeiro plano.",
    hiddenInformation: "a Caixa Materna era o centro da armadilha",
    stakes: "cada segundo deixava o portal mais instavel",
  },
  {
    beatId: "beat-3",
    role: "climax",
    text: "O golpe acertou Godzilla e abriu caminho para a fuga.",
    hiddenInformation: "a pancada deu a abertura que a Liga precisava",
    stakes: "se errassem aquele instante, todos cairiam junto com a cidade",
  },
  {
    beatId: "beat-4",
    role: "resolution",
    text: "Quando a poeira baixou, a pergunta mudou: quem tinha usado os monstros como arma?",
    hiddenInformation: "a luta era so o comeco",
    stakes: "o proximo passo revelaria o culpado",
  },
];

const oralPlan = buildComicOralPerformanceRewritePlan({ beats: rawBeats });
if (!oralPlan.passed) throw new Error(`Oral rewrite rejected: ${oralPlan.warnings.join(", ")}`);

const beats = oralPlan.rewrites.map((rewrite, index) => ({
  beatId: rewrite.beatId,
  role: rawBeats[index].role,
  narrationLine: rewrite.rewrittenText,
  sourcePages: [index + 1],
  durationSeconds: 6,
}));

const curiosityPlan = buildComicCuriosityPlan({
  beats,
  questions: [
    {
      questionId: "who-opened-portal",
      question: "Quem abriu o portal?",
      type: "who",
      openedAtBeatId: "beat-1",
      partialAnswerBeatIds: ["beat-2"],
      payoffBeatId: "beat-4",
      payoff: "Lex estava usando os monstros como arma.",
      evidenceBeatIds: ["beat-1", "beat-2", "beat-4"],
      isMacroQuestion: true,
      truthConfidence: 98,
    },
  ],
});

const phraseVoicePlan = buildComicPhraseVoicePlan({ beats });
const performancePlan = buildComicNarrationPerformancePlan({ phraseVoicePlan, curiosityPlan });
const actingPlan = buildComicNarrationActingPlan({ performancePlan });
const narratorPlan = buildComicNarratorDirectorPlan({ actingPlan, performancePlan, referenceDnaId: "historian_cinematic_ptbr_v1" });
const emotionArcPlan = buildComicNarrationEmotionArcPlan({ cues: narratorPlan.cues });
const visualContract = evaluateComicVisualNarrationContract({
  cues: narratorPlan.cues,
  visuals: [
    { sourceBeatIndex: 0, text: "Superman encara Godzilla no meio da cidade", focusTarget: "Superman Godzilla cidade" },
    { sourceBeatIndex: 1, text: "Batman observa Lex Luthor, a Caixa Materna e o portal instavel", focusTarget: "Batman Lex Luthor Caixa Materna portal" },
    { sourceBeatIndex: 2, text: "golpe acerta Godzilla e a cidade cai ao fundo", focusTarget: "golpe Godzilla cidade caminho" },
    { sourceBeatIndex: 3, text: "poeira baixa e os monstros viram arma", focusTarget: "monstros arma" },
  ],
});

const pronunciation = applyComicTtsPronunciation("Batman e Superman enfrentam Godzilla com força.");

if (!narratorPlan.passed) throw new Error(`Narrator rejected: ${narratorPlan.warnings.join(", ")}`);
if (!emotionArcPlan.passed) throw new Error(`Emotion arc rejected: ${emotionArcPlan.warnings.join(", ")}`);
if (visualContract.status !== "passed") throw new Error(`Visual contract rejected: ${visualContract.warnings.join(", ")}`);
if (!pronunciation.appliedLabels.includes("Batman") || !pronunciation.appliedLabels.includes("Superman")) throw new Error("Pronunciation dictionary did not apply hero names.");
if (!assertComicDisplayTextHasNoPhoneticLeak("Batman e Superman enfrentam Godzilla com força.")) throw new Error("Display text safety failed.");
if (assertComicDisplayTextHasNoPhoneticLeak(pronunciation.spokenText)) throw new Error("Spoken text should contain pronunciation guidance while display text stays clean.");

console.log(JSON.stringify({
  oralRewriteCoverage: oralPlan.rewriteCoverage,
  questionCount: oralPlan.questionCount,
  narratorReferenceDnaId: narratorPlan.referenceDnaId,
  deliveryModeCount: narratorPlan.deliveryModeCount,
  emotionArcStageCount: emotionArcPlan.stageCount,
  peakIntensity: emotionArcPlan.peakIntensity,
  visualContractCoverage: visualContract.averageCoverage,
  appliedPronunciations: pronunciation.appliedLabels,
  displayTextSafe: true,
  status: "completed",
}, null, 2));
