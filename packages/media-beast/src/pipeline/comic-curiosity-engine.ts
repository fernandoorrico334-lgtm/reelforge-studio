export type ComicCuriosityQuestionType = "how" | "why" | "what" | "who" | "can";

export type ComicCuriosityBeatInput = {
  beatId: string;
  narrationLine: string;
  sourcePages: number[];
  issueNumber?: number;
  durationSeconds?: number;
};

export type ComicCuriosityQuestionInput = {
  questionId: string;
  question: string;
  type: ComicCuriosityQuestionType;
  openedAtBeatId: string;
  partialAnswerBeatIds?: string[];
  payoffBeatId: string;
  payoff: string;
  evidenceBeatIds: string[];
  isMacroQuestion?: boolean;
  truthConfidence: number;
};

export type ComicCuriosityQuestion = ComicCuriosityQuestionInput & {
  openedAtBeatIndex: number;
  payoffBeatIndex: number;
  openedAtSeconds: number | null;
  payoffAtSeconds: number | null;
  openDurationSeconds: number | null;
  status: "open" | "partially_answered" | "resolved" | "invalid";
};

export type ComicCuriosityPlan = {
  engineId: "comic_curiosity_engine_v1";
  questions: ComicCuriosityQuestion[];
  questionCount: number;
  macroQuestionCount: number;
  resolvedQuestionCount: number;
  maximumSimultaneousOpenQuestions: number;
  maximumSecondsWithoutOpenQuestion: number | null;
  unsupportedQuestionIds: string[];
  warnings: string[];
  passed: boolean;
};

function timelineStarts(beats: ComicCuriosityBeatInput[]) {
  let cursor = 0;
  return beats.map((beat) => {
    const start = cursor;
    cursor += beat.durationSeconds ?? 0;
    return start;
  });
}

export function buildComicCuriosityPlan(input: {
  beats: ComicCuriosityBeatInput[];
  questions: ComicCuriosityQuestionInput[];
  maximumOpenQuestions?: number;
  maximumGapSeconds?: number;
}): ComicCuriosityPlan {
  const beatIndex = new Map(input.beats.map((beat, index) => [beat.beatId, index]));
  const starts = timelineStarts(input.beats);
  const hasTiming = input.beats.every((beat) => typeof beat.durationSeconds === "number");
  const unsupportedQuestionIds: string[] = [];
  const questions = input.questions.map((question): ComicCuriosityQuestion => {
    const openedAtBeatIndex = beatIndex.get(question.openedAtBeatId) ?? -1;
    const payoffBeatIndex = beatIndex.get(question.payoffBeatId) ?? -1;
    const evidenceExists = question.evidenceBeatIds.length > 0 && question.evidenceBeatIds.every((id) => beatIndex.has(id));
    const valid = openedAtBeatIndex >= 0 && payoffBeatIndex > openedAtBeatIndex && evidenceExists && question.truthConfidence >= 70;
    if (!valid) unsupportedQuestionIds.push(question.questionId);
    const openedAtSeconds = valid && hasTiming ? starts[openedAtBeatIndex] ?? null : null;
    const payoffAtSeconds = valid && hasTiming ? starts[payoffBeatIndex] ?? null : null;
    return {
      ...question,
      openedAtBeatIndex,
      payoffBeatIndex,
      openedAtSeconds,
      payoffAtSeconds,
      openDurationSeconds: openedAtSeconds !== null && payoffAtSeconds !== null ? Number((payoffAtSeconds - openedAtSeconds).toFixed(3)) : null,
      status: !valid ? "invalid" : question.partialAnswerBeatIds?.length ? "resolved" : "resolved",
    };
  });
  let maximumSimultaneousOpenQuestions = 0;
  for (let index = 0; index < input.beats.length; index += 1) {
    const open = questions.filter((question) => question.openedAtBeatIndex <= index && question.payoffBeatIndex >= index && question.status !== "invalid").length;
    maximumSimultaneousOpenQuestions = Math.max(maximumSimultaneousOpenQuestions, open);
  }
  let maximumSecondsWithoutOpenQuestion: number | null = null;
  if (hasTiming) {
    let gap = 0;
    let maxGap = 0;
    input.beats.forEach((beat, index) => {
      const covered = questions.some((question) => question.openedAtBeatIndex <= index && question.payoffBeatIndex >= index && question.status !== "invalid");
      gap = covered ? 0 : gap + (beat.durationSeconds ?? 0);
      maxGap = Math.max(maxGap, gap);
    });
    maximumSecondsWithoutOpenQuestion = Number(maxGap.toFixed(3));
  }
  const warnings: string[] = [];
  if (!questions.some((question) => question.isMacroQuestion)) warnings.push("missing_macro_question");
  if (maximumSimultaneousOpenQuestions > (input.maximumOpenQuestions ?? 2)) warnings.push("too_many_simultaneous_questions");
  if (maximumSecondsWithoutOpenQuestion !== null && maximumSecondsWithoutOpenQuestion > (input.maximumGapSeconds ?? 25)) warnings.push("retention_gap_without_open_question");
  if (unsupportedQuestionIds.length) warnings.push("question_without_verified_evidence_or_payoff");
  return {
    engineId: "comic_curiosity_engine_v1",
    questions,
    questionCount: questions.length,
    macroQuestionCount: questions.filter((question) => question.isMacroQuestion).length,
    resolvedQuestionCount: questions.filter((question) => question.status === "resolved").length,
    maximumSimultaneousOpenQuestions,
    maximumSecondsWithoutOpenQuestion,
    unsupportedQuestionIds,
    warnings,
    passed: questions.length > 0 && warnings.length === 0,
  };
}
