export type ComicIssueTransitionBeatInput = {
  beatId: string;
  issueNumber: number;
  narrationLine: string;
};

export type ComicIssueTransitionEvidence = {
  fromIssueNumber: number;
  toIssueNumber: number;
  previousConflictTerms: string[];
  causalBridgeTerms: string[];
  newConflictTerms: string[];
};

export type ComicIssueTransitionReview = {
  transitionId: string;
  fromIssueNumber: number;
  toIssueNumber: number;
  previousBeatId: string;
  nextBeatId: string;
  previousConflictConnected: boolean;
  causeExplained: boolean;
  newConflictIntroduced: boolean;
  ambiguousOpening: boolean;
  score: number;
  warnings: string[];
};

export type ComicIssueTransitionPlan = {
  directorId: "comic_issue_transition_director_v1";
  transitionCount: number;
  completeTransitionCount: number;
  minimumScore: number;
  reviews: ComicIssueTransitionReview[];
  warnings: string[];
  passed: boolean;
};

const AMBIGUOUS_OPENING = /^(?:ele|ela|eles|elas|isso|aquilo|ali|então|de repente)\b/i;

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function containsAny(text: string, terms: string[]) {
  const normalized = normalize(text);
  return terms.some((term) => normalized.includes(normalize(term)));
}

export function buildComicIssueTransitionPlan(input: {
  beats: ComicIssueTransitionBeatInput[];
  evidence: ComicIssueTransitionEvidence[];
  minimumScore?: number;
}): ComicIssueTransitionPlan {
  const minimumScore = Math.max(70, Math.min(100, input.minimumScore ?? 100));
  const reviews = input.evidence.map((evidence) => {
    const previous = [...input.beats].reverse().find((beat) => beat.issueNumber === evidence.fromIssueNumber);
    const next = input.beats.find((beat) => beat.issueNumber === evidence.toIssueNumber);
    if (!previous || !next) throw new Error(`Missing issue boundary ${evidence.fromIssueNumber}->${evidence.toIssueNumber}.`);
    const bridgeText = `${previous.narrationLine} ${next.narrationLine}`;
    const previousConflictConnected = containsAny(bridgeText, evidence.previousConflictTerms) && containsAny(next.narrationLine, evidence.previousConflictTerms);
    const causeExplained = containsAny(next.narrationLine, evidence.causalBridgeTerms);
    const newConflictIntroduced = containsAny(next.narrationLine, evidence.newConflictTerms);
    const ambiguousOpening = AMBIGUOUS_OPENING.test(next.narrationLine.trim());
    const score = [previousConflictConnected, causeExplained, newConflictIntroduced, !ambiguousOpening]
      .filter(Boolean).length * 25;
    const warnings = [
      !previousConflictConnected ? "previous_issue_conflict_not_connected" : null,
      !causeExplained ? "transition_cause_not_explained" : null,
      !newConflictIntroduced ? "next_issue_conflict_not_introduced" : null,
      ambiguousOpening ? "next_issue_opens_with_ambiguous_reference" : null,
    ].filter((warning): warning is string => Boolean(warning));
    return {
      transitionId: `issue-${evidence.fromIssueNumber}-to-${evidence.toIssueNumber}`,
      fromIssueNumber: evidence.fromIssueNumber,
      toIssueNumber: evidence.toIssueNumber,
      previousBeatId: previous.beatId,
      nextBeatId: next.beatId,
      previousConflictConnected,
      causeExplained,
      newConflictIntroduced,
      ambiguousOpening,
      score,
      warnings,
    };
  });
  const warnings = reviews.flatMap((review) => review.warnings.map((warning) => `${review.transitionId}:${warning}`));
  return {
    directorId: "comic_issue_transition_director_v1",
    transitionCount: reviews.length,
    completeTransitionCount: reviews.filter((review) => review.score >= minimumScore).length,
    minimumScore,
    reviews,
    warnings,
    passed: reviews.length > 0 && reviews.every((review) => review.score >= minimumScore),
  };
}