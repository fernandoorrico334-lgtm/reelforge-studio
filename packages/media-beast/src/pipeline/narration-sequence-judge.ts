import type { ScoredNarrationTake, TakeScore, TransitionScore } from "./voicebox-qwen-types.js";

const WEIGHTS: Record<keyof TakeScore, number> = {
  semanticAccuracy: 0.2,
  pronunciationScore: 0.16,
  actingMatch: 0.17,
  naturalness: 0.16,
  audioQuality: 0.08,
  timbreSimilarity: 0.09,
  pauseQuality: 0.05,
  pitchVariation: 0.045,
  energyVariation: 0.045,
};

function takeValue(score: TakeScore) {
  return Object.entries(WEIGHTS).reduce((sum, [key, weight]) => sum + score[key as keyof TakeScore] * weight, 0);
}

function transitionValue(score: TransitionScore) {
  return score.timbreContinuity * 0.3 + score.pitchContinuity * 0.15 + score.energyContinuity * 0.15 + score.emotionalProgression * 0.25 + score.pauseCompatibility * 0.15;
}

export function selectBestNarrationSequence(input: { takesByBlock: ScoredNarrationTake[][]; transitions: TransitionScore[] }) {
  if (!input.takesByBlock.length || input.takesByBlock.some((takes) => !takes.length)) throw new Error("Every synthesis block requires at least one scored take.");
  const transitionMap = new Map(input.transitions.map((score) => [`${score.fromTakeId}->${score.toTakeId}`, score]));
  let states = new Map(input.takesByBlock[0]!.map((take) => [take.id, { value: takeValue(take.score), path: [take] }]));
  for (let index = 1; index < input.takesByBlock.length; index += 1) {
    const next = new Map<string, { value: number; path: ScoredNarrationTake[] }>();
    for (const take of input.takesByBlock[index]!) {
      for (const state of states.values()) {
        const previous = state.path.at(-1)!;
        const transition = transitionMap.get(`${previous.id}->${take.id}`);
        const value = state.value + takeValue(take.score) + (transition ? transitionValue(transition) : 0);
        const existing = next.get(take.id);
        if (!existing || value > existing.value) next.set(take.id, { value, path: [...state.path, take] });
      }
    }
    states = next;
  }
  const winner = [...states.values()].sort((left, right) => right.value - left.value)[0]!;
  return { selectedTakes: winner.path, globalScore: Number((winner.value / winner.path.length).toFixed(3)) };
}

