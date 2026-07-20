export type ComicSagaStoryRange = {
  issueNumber: number;
  firstStoryPage: number;
  lastStoryPage: number;
  excludedPages: number[];
};

export type ComicSagaNarrativeBeat = {
  beatId: string;
  issueNumber: number;
  pageNumbers: number[];
  role: "cold_open" | "setup" | "escalation" | "reversal" | "climax" | "resolution";
  narrationText: string;
  headline: string;
  hasDialogue: boolean;
  hasImpact: boolean;
  weight: number;
};

export type ComicCompleteSagaPlan = {
  directorId: "comic_complete_saga_director_v1";
  maximumDurationSeconds: number;
  targetWordsPerMinute: number;
  estimatedDurationSeconds: number;
  totalWordCount: number;
  issueCount: number;
  coveredIssueNumbers: number[];
  storyPageCount: number;
  selectedPageCount: number;
  beats: Array<ComicSagaNarrativeBeat & { allocatedDurationSeconds: number }>;
  pageTearAfterBeatIds: string[];
  excludedPageReasons: Record<string, "cover_or_variant" | "credits_or_intro" | "advertisement_or_backmatter">;
  completeStoryCovered: boolean;
  warnings: string[];
};

function wordCount(value: string) {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

function round(value: number) {
  return Math.round(value * 1000) / 1000;
}

function unique(values: number[]) {
  return [...new Set(values)];
}

export function buildCompleteComicSagaPlan(input: {
  issueRanges: ComicSagaStoryRange[];
  beats: ComicSagaNarrativeBeat[];
  maximumDurationSeconds?: number;
  targetWordsPerMinute?: number;
}): ComicCompleteSagaPlan {
  const maximumDurationSeconds = Math.min(180, Math.max(60, input.maximumDurationSeconds ?? 180));
  const targetWordsPerMinute = Math.min(180, Math.max(130, input.targetWordsPerMinute ?? 165));
  const warnings: string[] = [];
  const sortedRanges = [...input.issueRanges].sort((left, right) => left.issueNumber - right.issueNumber);
  const sortedBeats = [...input.beats].sort((left, right) =>
    left.issueNumber - right.issueNumber ||
    Math.min(...left.pageNumbers) - Math.min(...right.pageNumbers)
  );
  const totalWordCount = sortedBeats.reduce((sum, beat) => sum + wordCount(beat.narrationText), 0);
  const estimatedDurationSeconds = totalWordCount / targetWordsPerMinute * 60;
  const allocatedTotal = Math.min(maximumDurationSeconds, Math.max(1, estimatedDurationSeconds));
  const weightTotal = sortedBeats.reduce((sum, beat) => sum + Math.max(0.1, beat.weight), 0);
  const beats = sortedBeats.map((beat) => ({
    ...beat,
    allocatedDurationSeconds: round(allocatedTotal * Math.max(0.1, beat.weight) / weightTotal)
  }));

  const coveredIssueNumbers = unique(beats.map((beat) => beat.issueNumber));
  const expectedIssues = sortedRanges.map((range) => range.issueNumber);
  const issueOrderIsMonotonic = beats.every((beat, index) => index === 0 || beat.issueNumber >= beats[index - 1]!.issueNumber);
  const pageOrderIsMonotonic = beats.every((beat, index) => {
    if (index === 0 || beat.issueNumber !== beats[index - 1]!.issueNumber) return true;
    return Math.min(...beat.pageNumbers) >= Math.min(...beats[index - 1]!.pageNumbers);
  });
  if (!issueOrderIsMonotonic) warnings.push("issue_order_is_not_monotonic");
  if (!pageOrderIsMonotonic) warnings.push("page_order_is_not_monotonic_inside_issue");
  if (estimatedDurationSeconds > maximumDurationSeconds) warnings.push("narration_requires_pacing_or_script_compression");

  const excludedPageReasons: ComicCompleteSagaPlan["excludedPageReasons"] = {};
  for (const range of sortedRanges) {
    for (const page of range.excludedPages) {
      const reason = page < range.firstStoryPage
        ? page === range.firstStoryPage - 1 ? "credits_or_intro" : "cover_or_variant"
        : "advertisement_or_backmatter";
      excludedPageReasons[`issue-${range.issueNumber}:page-${page}`] = reason;
    }
  }

  const pageTearAfterBeatIds = beats
    .filter((beat, index) => index < beats.length - 1 && beats[index + 1]!.issueNumber !== beat.issueNumber)
    .map((beat) => beat.beatId);
  const completeStoryCovered =
    expectedIssues.every((issue) => coveredIssueNumbers.includes(issue)) &&
    issueOrderIsMonotonic &&
    pageOrderIsMonotonic &&
    estimatedDurationSeconds <= maximumDurationSeconds;

  return {
    directorId: "comic_complete_saga_director_v1",
    maximumDurationSeconds,
    targetWordsPerMinute,
    estimatedDurationSeconds: round(estimatedDurationSeconds),
    totalWordCount,
    issueCount: sortedRanges.length,
    coveredIssueNumbers,
    storyPageCount: sortedRanges.reduce((sum, range) => sum + range.lastStoryPage - range.firstStoryPage + 1, 0),
    selectedPageCount: unique(beats.flatMap((beat) => beat.pageNumbers.map((page) => beat.issueNumber * 10000 + page))).length,
    beats,
    pageTearAfterBeatIds,
    excludedPageReasons,
    completeStoryCovered,
    warnings
  };
}
