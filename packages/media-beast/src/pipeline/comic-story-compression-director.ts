export type ComicStoryCompressionRole =
  | "hook"
  | "setup"
  | "escalation"
  | "turn"
  | "climax"
  | "resolution"
  | "sting";

export type ComicStoryCompressionBeatInput = {
  role: ComicStoryCompressionRole;
  text: string;
  pageNumbers?: number[];
  panelIds?: string[];
  importance?: number;
};

export type ComicStoryCompressionBeat = ComicStoryCompressionBeatInput & {
  text: string;
  wordCount: number;
  estimatedDurationSeconds: number;
};

export type ComicStoryCompressionPlan = {
  directorId: "comic_story_compression_director_v1";
  targetDurationSeconds: number;
  maximumDurationSeconds: number;
  targetWordCount: number;
  minimumWordCount: number;
  maximumWordCount: number;
  sourceWordCount: number;
  compressedWordCount: number;
  estimatedDurationSeconds: number;
  compressionRatio: number;
  compressedNarration: string;
  beats: ComicStoryCompressionBeat[];
  visualMomentTarget: number;
  maximumVisualDurationSeconds: number;
  storySpine: Record<ComicStoryCompressionRole, boolean>;
  storySpineComplete: boolean;
  chronologicalPages: number[];
  warnings: string[];
};

export type ComicStoryCompressionInput = {
  narration?: string;
  beats?: ComicStoryCompressionBeatInput[];
  targetDurationSeconds?: number;
  maximumDurationSeconds?: number;
  wordsPerSecond?: number;
  minimumWordCount?: number;
  maximumWordCount?: number;
  visualMomentTarget?: number;
};

const ROLE_ORDER: ComicStoryCompressionRole[] = [
  "hook", "setup", "escalation", "turn", "climax", "resolution", "sting"
];

const REQUIRED_ROLES: ComicStoryCompressionRole[] = [
  "hook", "setup", "escalation", "climax", "resolution"
];

const ROLE_WEIGHTS: Record<ComicStoryCompressionRole, number> = {
  hook: 0.1,
  setup: 0.14,
  escalation: 0.2,
  turn: 0.14,
  climax: 0.2,
  resolution: 0.16,
  sting: 0.06
};

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function clean(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function words(value: string): string[] {
  return clean(value).split(/\s+/).filter(Boolean);
}

function sentenceList(value: string): string[] {
  return clean(value).split(/(?<=[.!?])\s+/).map(clean).filter(Boolean);
}

function finishSentence(value: string): string {
  const result = clean(value).replace(/[,;:]$/, "");
  if (!result) return "";
  return /[.!?]$/.test(result) ? result : `${result}.`;
}

function trimToWordBudget(value: string, budget: number): string {
  const sourceWords = words(value);
  if (sourceWords.length <= budget) return finishSentence(value);
  const joined = sourceWords.slice(0, Math.max(1, budget)).join(" ");
  const safeBoundary = Math.max(joined.lastIndexOf(","), joined.lastIndexOf(";"), joined.lastIndexOf(":"));
  const candidate = safeBoundary >= Math.floor(joined.length * 0.55)
    ? joined.slice(0, safeBoundary)
    : joined;
  return finishSentence(candidate);
}

function inferRole(index: number, count: number): ComicStoryCompressionRole {
  if (index === 0) return "hook";
  if (index === count - 1) return "resolution";
  const progress = index / Math.max(1, count - 1);
  if (progress <= 0.2) return "setup";
  if (progress <= 0.48) return "escalation";
  if (progress <= 0.65) return "turn";
  if (progress <= 0.84) return "climax";
  return "resolution";
}

function beatsFromNarration(narration: string): ComicStoryCompressionBeatInput[] {
  const sentences = sentenceList(narration);
  return sentences.map((text, index) => ({
    role: inferRole(index, sentences.length),
    text,
    importance: index === 0 || index === sentences.length - 1 ? 1 : 0.75
  }));
}

function groupBeats(beats: ComicStoryCompressionBeatInput[]): Map<ComicStoryCompressionRole, ComicStoryCompressionBeatInput[]> {
  const grouped = new Map<ComicStoryCompressionRole, ComicStoryCompressionBeatInput[]>();
  for (const beat of beats) {
    const entries = grouped.get(beat.role) ?? [];
    entries.push({ ...beat, text: clean(beat.text) });
    grouped.set(beat.role, entries);
  }
  return grouped;
}

function selectRoleText(entries: ComicStoryCompressionBeatInput[], budget: number): string {
  const ranked = [...entries].sort((left, right) => (right.importance ?? 0.5) - (left.importance ?? 0.5));
  const selected: string[] = [];
  let remaining = budget;
  for (const entry of ranked) {
    if (remaining <= 3) break;
    const entryWords = words(entry.text).length;
    const text = trimToWordBudget(entry.text, Math.min(entryWords, remaining));
    if (!text) continue;
    selected.push(text);
    remaining -= words(text).length;
  }
  return clean(selected.join(" "));
}

function uniqueSortedPages(beats: ComicStoryCompressionBeatInput[]): number[] {
  return [...new Set(beats.flatMap((beat) => beat.pageNumbers ?? []))]
    .filter((page) => Number.isFinite(page))
    .sort((left, right) => left - right);
}

export function buildComicStoryCompressionPlan(input: ComicStoryCompressionInput): ComicStoryCompressionPlan {
  const maximumDurationSeconds = clamp(input.maximumDurationSeconds ?? 59, 30, 59);
  const targetDurationSeconds = clamp(input.targetDurationSeconds ?? 56, 30, maximumDurationSeconds);
  const wordsPerSecond = clamp(input.wordsPerSecond ?? 2.55, 2, 3.2);
  const computedMaximumWords = Math.floor(maximumDurationSeconds * wordsPerSecond);
  const maximumWordCount = clamp(input.maximumWordCount ?? computedMaximumWords, 90, computedMaximumWords);
  const minimumWordCount = clamp(input.minimumWordCount ?? 110, 70, maximumWordCount);
  const targetWordCount = clamp(Math.round(targetDurationSeconds * wordsPerSecond), minimumWordCount, maximumWordCount);
  const sourceBeats = (input.beats?.length ? input.beats : beatsFromNarration(input.narration ?? ""))
    .filter((beat) => clean(beat.text).length > 0);
  const sourceNarration = clean(input.narration ?? sourceBeats.map((beat) => beat.text).join(" "));
  const sourceWordCount = words(sourceNarration).length;
  const grouped = groupBeats(sourceBeats);
  const compressedBeats: ComicStoryCompressionBeat[] = [];

  for (const role of ROLE_ORDER) {
    const entries = grouped.get(role) ?? [];
    if (entries.length === 0) continue;
    const roleBudget = Math.max(8, Math.round(targetWordCount * ROLE_WEIGHTS[role]));
    const text = selectRoleText(entries, roleBudget);
    const wordCount = words(text).length;
    compressedBeats.push({
      role,
      text,
      pageNumbers: uniqueSortedPages(entries),
      panelIds: [...new Set(entries.flatMap((entry) => entry.panelIds ?? []))],
      importance: Math.max(...entries.map((entry) => entry.importance ?? 0.5)),
      wordCount,
      estimatedDurationSeconds: Math.round((wordCount / wordsPerSecond) * 10) / 10
    });
  }

  let compressedNarration = clean(compressedBeats.map((beat) => beat.text).join(" "));
  if (words(compressedNarration).length > maximumWordCount) {
    compressedNarration = trimToWordBudget(compressedNarration, maximumWordCount);
  }

  const compressedWordCount = words(compressedNarration).length;
  const estimatedDurationSeconds = Math.round((compressedWordCount / wordsPerSecond) * 10) / 10;
  const storySpine = Object.fromEntries(ROLE_ORDER.map((role) => [role, grouped.has(role)])) as Record<ComicStoryCompressionRole, boolean>;
  const storySpineComplete = REQUIRED_ROLES.every((role) => storySpine[role]);
  const chronologicalPages = uniqueSortedPages(sourceBeats);
  const warnings: string[] = [];
  if (!storySpineComplete) warnings.push(`incomplete_story_spine:${REQUIRED_ROLES.filter((role) => !storySpine[role]).join(",")}`);
  if (compressedWordCount < minimumWordCount) warnings.push(`narration_below_target_words:${compressedWordCount}<${minimumWordCount}`);
  if (estimatedDurationSeconds > maximumDurationSeconds) warnings.push(`duration_above_shorts_limit:${estimatedDurationSeconds}>${maximumDurationSeconds}`);

  return {
    directorId: "comic_story_compression_director_v1",
    targetDurationSeconds,
    maximumDurationSeconds,
    targetWordCount,
    minimumWordCount,
    maximumWordCount,
    sourceWordCount,
    compressedWordCount,
    estimatedDurationSeconds,
    compressionRatio: sourceWordCount > 0 ? Math.round((compressedWordCount / sourceWordCount) * 1000) / 1000 : 0,
    compressedNarration,
    beats: compressedBeats,
    visualMomentTarget: clamp(input.visualMomentTarget ?? 20, 18, 24),
    maximumVisualDurationSeconds: 3.2,
    storySpine,
    storySpineComplete,
    chronologicalPages,
    warnings
  };
}

export function validateComicStoryCompressionPlan(plan: ComicStoryCompressionPlan): {
  passed: boolean;
  blockers: string[];
} {
  const blockers: string[] = [];
  if (plan.estimatedDurationSeconds > plan.maximumDurationSeconds) blockers.push("shorts_duration_limit_exceeded");
  if (!plan.storySpineComplete) blockers.push("story_spine_incomplete");
  if (plan.compressedWordCount > plan.maximumWordCount) blockers.push("narration_word_budget_exceeded");
  if (plan.compressedWordCount < plan.minimumWordCount) blockers.push("narration_too_short_for_complete_story");
  return { passed: blockers.length === 0, blockers };
}
