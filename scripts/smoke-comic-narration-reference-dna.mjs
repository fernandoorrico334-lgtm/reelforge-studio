import {
  buildComicMicroPausePlan,
  getComicNarrationReferenceDnaById,
} from "../packages/media-beast/dist/index.js";

const dna = getComicNarrationReferenceDnaById("thwip_storytelling_v1");

const cues = [
  {
    phraseId: "hook",
    deliveryMode: "cold_open_question",
    emotionIntensity: 0.76,
    pauseBeforeMs: 0,
    pauseAfterMs: 120,
    openQuestion: "Como Batman entrou nessa historia?",
    payoffExpectation: null,
    shouldHoldVisual: true,
  },
  {
    phraseId: "context",
    deliveryMode: "controlled_storytelling",
    emotionIntensity: 0.7,
    pauseBeforeMs: 0,
    pauseAfterMs: 130,
    openQuestion: null,
    payoffExpectation: null,
    shouldHoldVisual: false,
  },
  {
    phraseId: "impact",
    deliveryMode: "impact_hit",
    emotionIntensity: 0.9,
    pauseBeforeMs: 0,
    pauseAfterMs: 140,
    openQuestion: null,
    payoffExpectation: null,
    shouldHoldVisual: false,
  },
  {
    phraseId: "reveal",
    deliveryMode: "weighted_reveal",
    emotionIntensity: 0.86,
    pauseBeforeMs: 90,
    pauseAfterMs: 160,
    openQuestion: null,
    payoffExpectation: "A revelacao precisa responder a pergunta aberta.",
    shouldHoldVisual: true,
  },
  {
    phraseId: "release",
    deliveryMode: "emotional_release",
    emotionIntensity: 0.74,
    pauseBeforeMs: 80,
    pauseAfterMs: 180,
    openQuestion: null,
    payoffExpectation: "A consequencia precisa respirar.",
    shouldHoldVisual: true,
  },
];

const plan = buildComicMicroPausePlan({ cues, referenceDna: dna });
const patterns = new Set(plan.cues.map((cue) => cue.pausePattern));

if (!plan.passed) throw new Error(`Micro-pause plan rejected: ${plan.warnings.join(", ")}`);
if (dna.loudnessProfile.recommendedShortsIntegratedLufs !== -14.5) throw new Error("Unexpected shorts loudness target.");
if (!patterns.has("short") || !patterns.has("medium") || !patterns.has("long")) throw new Error("Micro-pause plan must include short, medium and long pauses.");
if (plan.longPauseCount < 2) throw new Error("Expected long pauses for reveal and emotional release.");
if (plan.averagePauseAfterMs < dna.pauseProfile.shortPauseMs[0]) throw new Error("Average pause is too short for human narration.");

console.log(JSON.stringify({
  referenceDnaId: dna.id,
  targetLufs: dna.loudnessProfile.recommendedShortsIntegratedLufs,
  cueCount: plan.cues.length,
  pausePatterns: [...patterns],
  averagePauseAfterMs: plan.averagePauseAfterMs,
  longPauseCount: plan.longPauseCount,
  repeatedPauseRunCount: plan.repeatedPauseRunCount,
  status: "completed",
}, null, 2));
