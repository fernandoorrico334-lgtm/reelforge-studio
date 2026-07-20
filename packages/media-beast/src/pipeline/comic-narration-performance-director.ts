import type { ComicCuriosityPlan } from "./comic-curiosity-engine.js";
import type { ComicPhraseVoiceDirection, ComicPhraseVoicePlan, ComicVoiceEmotion } from "./comic-phrase-voice-director.js";

export type ComicNarrationTakeDirection = {
  takeId: string;
  seedOffset: number;
  exaggeration: number;
  cfgWeight: number;
  temperature: number;
};

export type ComicNarrationPhrasePerformance = ComicPhraseVoiceDirection & {
  narrativeFunction: "question" | "partial_answer" | "payoff" | "impact" | "bridge";
  subtext: string;
  energy: number;
  targetWordsPerMinute: number;
  pitchContour: "rising_question" | "falling_reveal" | "impact_peak" | "steady_forward" | "warm_resolution";
  criticalPhrase: boolean;
  continuityGroupId: string;
  takes: ComicNarrationTakeDirection[];
};

export type ComicNarrationPerformancePlan = {
  directorId: "comic_narration_performance_director_v1";
  performances: ComicNarrationPhrasePerformance[];
  phraseCount: number;
  criticalPhraseCount: number;
  plannedTakeCount: number;
  emotionalRange: number;
  questionPhraseCount: number;
  payoffPhraseCount: number;
  passed: boolean;
};

const EMOTION_ENERGY: Record<ComicVoiceEmotion, number> = {
  intrigue: 0.38,
  suspense: 0.46,
  controlled: 0.5,
  urgency: 0.76,
  reveal: 0.64,
  impact: 0.9,
  resolution: 0.42,
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function round(value: number) {
  return Math.round(value * 1000) / 1000;
}

export function buildComicNarrationPerformancePlan(input: {
  phraseVoicePlan: ComicPhraseVoicePlan;
  curiosityPlan: ComicCuriosityPlan;
}): ComicNarrationPerformancePlan {
  const questionOpeners = new Set(input.curiosityPlan.questions.map((question) => question.openedAtBeatId));
  const partialAnswers = new Set(input.curiosityPlan.questions.flatMap((question) => question.partialAnswerBeatIds ?? []));
  const payoffs = new Set(input.curiosityPlan.questions.map((question) => question.payoffBeatId));
  const performances = input.phraseVoicePlan.phrases.map((phrase, index): ComicNarrationPhrasePerformance => {
    const explicitQuestion = phrase.text.includes("?");
    const isQuestion = explicitQuestion || (questionOpeners.has(phrase.sourceBeatId) && phrase.phraseIndex === 0);
    const isPayoff = payoffs.has(phrase.sourceBeatId) && phrase.phraseIndex === 0;
    const isPartialAnswer = partialAnswers.has(phrase.sourceBeatId) && phrase.phraseIndex === 0;
    const narrativeFunction = isQuestion ? "question" as const : isPayoff ? "payoff" as const : isPartialAnswer ? "partial_answer" as const : phrase.emotion === "impact" ? "impact" as const : "bridge" as const;
    const arcLift = Math.sin((index / Math.max(1, input.phraseVoicePlan.phraseCount - 1)) * Math.PI) * 0.1;
    const energy = round(clamp(EMOTION_ENERGY[phrase.emotion] + arcLift + (isPayoff ? 0.08 : 0), 0.25, 0.98));
    const targetWordsPerMinute = phrase.emotion === "urgency" ? 184 : phrase.emotion === "impact" ? 178 : phrase.emotion === "suspense" ? 146 : isQuestion || phrase.emotion === "reveal" ? 150 : phrase.emotion === "resolution" ? 145 : 170;
    const pitchContour = isQuestion ? "rising_question" as const : isPayoff || phrase.emotion === "reveal" ? "falling_reveal" as const : phrase.emotion === "impact" ? "impact_peak" as const : phrase.emotion === "resolution" ? "warm_resolution" as const : "steady_forward" as const;
    const criticalPhrase = isQuestion || isPayoff || phrase.emotion === "impact" || phrase.emotion === "reveal" || phrase.emotion === "suspense";
    const base = phrase.chatterbox;
    const takes: ComicNarrationTakeDirection[] = [{ takeId: `${phrase.phraseId}-take-1`, seedOffset: 0, exaggeration: base.exaggeration, cfgWeight: base.cfgWeight, temperature: base.temperature }];
    if (criticalPhrase) {
      takes.push({
        takeId: `${phrase.phraseId}-take-2`,
        seedOffset: 1009,
        exaggeration: round(clamp(base.exaggeration + (isQuestion ? 0.04 : 0.07), 0.45, 0.9)),
        cfgWeight: round(clamp(base.cfgWeight - 0.02, 0.25, 0.4)),
        temperature: round(clamp(base.temperature + 0.035, 0.55, 0.76)),
      });
    }
    return {
      ...phrase,
      narrativeFunction,
      subtext: isQuestion ? "segure a resposta" : isPayoff ? "entregue a resposta com peso" : isPartialAnswer ? "revele apenas o necessario" : phrase.deliveryNote,
      energy,
      targetWordsPerMinute,
      pitchContour,
      criticalPhrase,
      continuityGroupId: `continuity-${Math.floor(index / 3) + 1}`,
      takes,
    };
  });
  const energies = performances.map((performance) => performance.energy);
  const emotionalRange = energies.length ? round(Math.max(...energies) - Math.min(...energies)) : 0;
  return {
    directorId: "comic_narration_performance_director_v1",
    performances,
    phraseCount: performances.length,
    criticalPhraseCount: performances.filter((performance) => performance.criticalPhrase).length,
    plannedTakeCount: performances.reduce((sum, performance) => sum + performance.takes.length, 0),
    emotionalRange,
    questionPhraseCount: performances.filter((performance) => performance.narrativeFunction === "question").length,
    payoffPhraseCount: performances.filter((performance) => performance.narrativeFunction === "payoff").length,
    passed: performances.length > 0 && emotionalRange >= 0.4 && performances.some((performance) => performance.narrativeFunction === "question") && performances.some((performance) => performance.narrativeFunction === "payoff"),
  };
}
