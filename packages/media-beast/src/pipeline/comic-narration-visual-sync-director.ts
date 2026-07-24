export type ComicNarrationVisualCueInput = {
  text: string;
  pages: string[];
  focusTarget?: string;
  durationSeconds?: number;
  verifiedFocusTargets?: string[];
  evidenceTerms?: string[];
  evidenceConfidence?: number;
  evidenceSource?: "detector" | "editorial_audit" | "ocr" | "metadata";
  evidenceWarnings?: string[];
};

export type ComicNarrationVisualBeatInput = {
  spokenText: string;
  pages: string[];
  durationSeconds: number;
  role?: "hook" | "setup" | "context" | "tension" | "escalation" | "reversal" | "climax" | "resolution" | "payoff";
  hasDialogue?: boolean;
  hasImpact?: boolean;
  visualCues?: ComicNarrationVisualCueInput[];
};

export type ComicNarrationVisualCue = {
  cueId: string;
  sourceBeatIndex: number;
  cueIndex: number;
  text: string;
  pages: string[];
  durationSeconds: number;
  startSeconds: number;
  endSeconds: number;
  role: ComicNarrationVisualBeatInput["role"];
  hasDialogue: boolean;
  hasImpact: boolean;
  transitionHint: "page_tear" | "direct";
  focusTarget: string | null;
  verifiedFocusTargets: string[] | null;
  evidenceTerms: string[];
  evidenceConfidence: number;
  evidenceSource: ComicNarrationVisualCueInput["evidenceSource"] | null;
  evidenceWarnings: string[];
};

export type ComicNarrationVisualSyncPlan = {
  directorId: "comic_narration_visual_sync_director_v1";
  cueCount: number;
  totalDurationSeconds: number;
  timelineDriftSeconds: number;
  cues: ComicNarrationVisualCue[];
  warnings: string[];
};

function round(value: number) {
  return Math.round(value * 1000) / 1000;
}

function wordCount(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function splitSemanticClauses(text: string) {
  const sentences = text
    .split(/(?<=[.!?;:])\s+/)
    .map((value) => value.trim())
    .filter(Boolean);
  const clauses = sentences.flatMap((sentence) => {
    if (wordCount(sentence) < 13) return [sentence];
    const split = sentence
      .split(/,\s+|\s+e\s+(?=[a-zA-ZÀ-ÿ])/i)
      .map((value) => value.trim())
      .filter((value) => wordCount(value) >= 3);
    return split.length > 1 ? split : [sentence];
  });
  return clauses.length ? clauses : [text];
}

function allocatePages(pages: string[], count: number, weights: number[] = []) {
  if (count <= 1) return [pages];
  const sizes = Array.from({ length: count }, () => 1);
  let remaining = Math.max(0, pages.length - count);
  while (remaining > 0) {
    let bestIndex = 0;
    let bestNeed = -1;
    for (let index = 0; index < count; index += 1) {
      const need = (weights[index] ?? 1) / sizes[index]!;
      if (need > bestNeed) { bestNeed = need; bestIndex = index; }
    }
    sizes[bestIndex]! += 1;
    remaining -= 1;
  }
  const groups: string[][] = [];
  let cursor = 0;
  for (const size of sizes) { groups.push(pages.slice(cursor, cursor + size)); cursor += size; }
  return groups.filter((group) => group.length > 0);
}

function resolveCues(beat: ComicNarrationVisualBeatInput): ComicNarrationVisualCueInput[] {
  if (beat.visualCues?.length) return beat.visualCues;
  const clauses = splitSemanticClauses(beat.spokenText);
  const usableCount = Math.min(clauses.length, beat.pages.length);
  const clauseWeights = clauses.slice(0, usableCount).map(wordCount);
  const pageGroups = allocatePages(beat.pages, usableCount, clauseWeights);
  if (clauses.length <= usableCount) {
    return clauses.map((text, index) => ({ text, pages: pageGroups[index] ?? beat.pages }));
  }
  return pageGroups.map((pages, index) => {
    const from = Math.floor(index * clauses.length / pageGroups.length);
    const to = Math.floor((index + 1) * clauses.length / pageGroups.length);
    return { text: clauses.slice(from, Math.max(from + 1, to)).join(" "), pages };
  });
}

export function buildComicNarrationVisualSyncPlan(input: {
  beats: ComicNarrationVisualBeatInput[];
  pageTearEveryBeats?: number;
}): ComicNarrationVisualSyncPlan {
  const cues: ComicNarrationVisualCue[] = [];
  const warnings: string[] = [];
  const pageTearEveryBeats = Math.max(1, input.pageTearEveryBeats ?? 2);
  let cursor = 0;

  input.beats.forEach((beat, sourceBeatIndex) => {
    const resolved = resolveCues(beat);
    const weights = resolved.map((cue) => Math.max(0.001, cue.durationSeconds ?? wordCount(cue.text)));
    const totalWeight = weights.reduce((sum, value) => sum + value, 0);
    let assignedDuration = 0;

    resolved.forEach((cue, cueIndex) => {
      const durationSeconds = cueIndex === resolved.length - 1
        ? round(beat.durationSeconds - assignedDuration)
        : round(beat.durationSeconds * weights[cueIndex]! / totalWeight);
      const startSeconds = round(cursor);
      const endSeconds = round(cursor + durationSeconds);
      cues.push({
        cueId: `beat-${sourceBeatIndex + 1}-cue-${cueIndex + 1}`,
        sourceBeatIndex,
        cueIndex,
        text: cue.text,
        pages: cue.pages,
        durationSeconds,
        startSeconds,
        endSeconds,
        role: beat.role,
        hasDialogue: Boolean(beat.hasDialogue),
        hasImpact: Boolean(beat.hasImpact),
        transitionHint: cueIndex === 0 && sourceBeatIndex % pageTearEveryBeats === 0 ? "page_tear" : "direct",
        focusTarget: cue.focusTarget ?? null,
        verifiedFocusTargets: cue.verifiedFocusTargets ?? null,
        evidenceWarnings: cue.evidenceWarnings ?? [],
        evidenceTerms: cue.evidenceTerms ?? [],
        evidenceConfidence: cue.evidenceConfidence ?? 0,
        evidenceSource: cue.evidenceSource ?? null,
      });
      assignedDuration = round(assignedDuration + durationSeconds);
      cursor = endSeconds;
    });
  });

  const sourceDuration = round(input.beats.reduce((sum, beat) => sum + beat.durationSeconds, 0));
  const totalDurationSeconds = round(cues.reduce((sum, cue) => sum + cue.durationSeconds, 0));
  const timelineDriftSeconds = round(Math.abs(sourceDuration - totalDurationSeconds));
  if (timelineDriftSeconds > 0.01) warnings.push("narration_visual_timeline_drift");
  if (cues.some((cue) => cue.pages.length === 0)) warnings.push("semantic_cue_without_visual_page");

  return {
    directorId: "comic_narration_visual_sync_director_v1",
    cueCount: cues.length,
    totalDurationSeconds,
    timelineDriftSeconds,
    cues,
    warnings,
  };
}


