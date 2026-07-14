import {
  extractLocalPanelEntityIds,
  extractLocalPanelThemeIds,
  normalizeBeatEntityName
} from "./comics-beat-panel-requirements.js";
import type { LocalComicPanelEvidence } from "./comics-local-panel-index.js";

export type ComicPanelStoryArc =
  | "setup_to_payoff"
  | "conflict"
  | "transformation"
  | "relationship"
  | "reveal"
  | "reaction"
  | "single_visual";

export type ComicPanelSequence = {
  sequenceId: string;
  panelIds: string[];
  pageNumbers: number[];

  primaryCharacters: string[];
  primaryTheme: string;
  primaryAction: string;
  primaryRelationship: string;

  storyArc: ComicPanelStoryArc;
  continuityScore: number;
  selfContainedScore: number;
  narrativeProgressionScore: number;
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function jaccardSimilarity(left: string[], right: string[]): number {
  const a = new Set(left);
  const b = new Set(right);
  if (a.size === 0 && b.size === 0) return 1;
  let intersection = 0;
  for (const value of a) {
    if (b.has(value)) intersection += 1;
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function dominantValue(values: string[]): string {
  const counts = new Map<string, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] ?? "unknown";
}

function panelCharacters(panel: LocalComicPanelEvidence): string[] {
  return extractLocalPanelEntityIds(panel);
}

function panelThemes(panel: LocalComicPanelEvidence): string[] {
  return extractLocalPanelThemeIds(panel);
}

function panelActions(panel: LocalComicPanelEvidence): string[] {
  return panel.localEvidence.actions.map((entry) => entry.label);
}

function panelRelationships(panel: LocalComicPanelEvidence): string[] {
  return panel.localEvidence.relationships.map((entry) => entry.type);
}

function sameEdition(left: LocalComicPanelEvidence, right: LocalComicPanelEvidence): boolean {
  const leftTitle = left.parentContext.comicTitle ?? left.parentContext.issueTitle ?? "";
  const rightTitle = right.parentContext.comicTitle ?? right.parentContext.issueTitle ?? "";
  return leftTitle.length > 0 && leftTitle === rightTitle;
}

function shouldSplitSequenceRun(
  previous: LocalComicPanelEvidence,
  current: LocalComicPanelEvidence
): boolean {
  if (previous.nextPanelId && current.panelId !== previous.nextPanelId) {
    if (current.previousPanelId && previous.panelId !== current.previousPanelId) {
      return true;
    }
  }

  const pageGap = Math.abs(current.pageNumber - previous.pageNumber);
  if (pageGap > 1) return true;

  const characterSimilarity = jaccardSimilarity(panelCharacters(previous), panelCharacters(current));
  if (characterSimilarity < 0.34 && panelCharacters(previous).length > 0 && panelCharacters(current).length > 0) {
    return true;
  }

  const themeSimilarity = jaccardSimilarity(panelThemes(previous), panelThemes(current));
  if (themeSimilarity < 0.2 && panelThemes(previous).length > 0 && panelThemes(current).length > 0) {
    return true;
  }

  if (previous.sequenceId && current.sequenceId && previous.sequenceId !== current.sequenceId) {
    return true;
  }

  return false;
}

function classifyStoryArc(panels: LocalComicPanelEvidence[]): ComicPanelStoryArc {
  if (panels.length <= 1) return "single_visual";

  const relationships = panels.flatMap(panelRelationships);
  const functions = panels.map((panel) => panel.storyFunction);

  if (relationships.includes("conflict")) return "conflict";
  if (relationships.includes("duo") || relationships.includes("conversation")) return "relationship";
  if (relationships.includes("host_symbiote") || functions.includes("transformation")) {
    return "transformation";
  }
  if (functions.includes("reveal")) return "reveal";
  if (functions.includes("reaction")) return "reaction";
  if (functions.includes("setup") && (functions.includes("climax") || functions.includes("reveal"))) {
    return "setup_to_payoff";
  }

  return "relationship";
}

function scoreContinuity(panels: LocalComicPanelEvidence[]): number {
  if (panels.length <= 1) return panels[0]?.valid ? 52 : 0;

  let score = 40;
  let consecutiveLinks = 0;
  let consecutivePages = 0;
  let sameEditionCount = 0;

  for (let index = 1; index < panels.length; index += 1) {
    const previous = panels[index - 1]!;
    const current = panels[index]!;

    if (previous.nextPanelId === current.panelId || current.previousPanelId === previous.panelId) {
      consecutiveLinks += 1;
      score += 10;
    }
    if (Math.abs(current.pageNumber - previous.pageNumber) === 1) {
      consecutivePages += 1;
      score += 12;
    } else if (current.pageNumber === previous.pageNumber) {
      score += 6;
    } else {
      score -= 18;
    }
    if (sameEdition(previous, current)) sameEditionCount += 1;
    score += Math.round(jaccardSimilarity(panelCharacters(previous), panelCharacters(current)) * 8);
  }

  score += sameEditionCount * 4;
  if (consecutiveLinks >= panels.length - 1) score += 8;
  if (consecutivePages >= Math.max(1, panels.length - 2)) score += 10;

  return clamp(Math.round(score), 0, 100);
}

function scoreSelfContained(panels: LocalComicPanelEvidence[]): number {
  if (panels.length === 0) return 0;
  const allCharacters = panels.map(panelCharacters);
  const allThemes = panels.map(panelThemes);
  const allActions = panels.map(panelActions);
  const allRelationships = panels.map(panelRelationships);

  let characterScore = 100;
  let themeScore = 100;
  let actionScore = 100;
  let relationshipScore = 100;
  const baselineCharacters = allCharacters[0] ?? [];
  const baselineThemes = allThemes[0] ?? [];
  const baselineActions = allActions[0] ?? [];
  const baselineRelationships = allRelationships[0] ?? [];

  for (let index = 1; index < panels.length; index += 1) {
    characterScore = Math.min(characterScore, Math.round(jaccardSimilarity(baselineCharacters, allCharacters[index] ?? []) * 100));
    themeScore = Math.min(themeScore, Math.round(jaccardSimilarity(baselineThemes, allThemes[index] ?? []) * 100));
    actionScore = Math.min(actionScore, Math.round(jaccardSimilarity(baselineActions, allActions[index] ?? []) * 100));
    relationshipScore = Math.min(
      relationshipScore,
      Math.round(jaccardSimilarity(baselineRelationships, allRelationships[index] ?? []) * 100)
    );
  }

  return clamp(Math.round((characterScore + themeScore + actionScore + relationshipScore) / 4), 0, 100);
}

function scoreNarrativeProgression(panels: LocalComicPanelEvidence[]): number {
  if (panels.length <= 1) return 45;

  const progressionPairs: Array<[string, string]> = [
    ["setup", "context"],
    ["context", "action"],
    ["action", "relationship"],
    ["relationship", "climax"],
    ["dialogue", "reveal"],
    ["transformation", "reaction"]
  ];

  let score = 35;
  for (let index = 1; index < panels.length; index += 1) {
    const previous = panels[index - 1]!.storyFunction;
    const current = panels[index]!.storyFunction;
    if (progressionPairs.some(([from, to]) => from === previous && to === current)) {
      score += 14;
    } else if (previous === current) {
      score += 4;
    } else {
      score -= 6;
    }
  }

  const arc = classifyStoryArc(panels);
  if (arc === "setup_to_payoff") score += 12;
  if (arc === "relationship" || arc === "transformation") score += 8;

  return clamp(score, 0, 100);
}

function buildSequenceFromRun(
  run: LocalComicPanelEvidence[],
  runIndex: number
): ComicPanelSequence | null {
  if (run.length === 0) return null;

  const characters = run.flatMap(panelCharacters).map(normalizeBeatEntityName);
  const themes = run.flatMap(panelThemes);
  const actions = run.flatMap(panelActions);
  const relationships = run.flatMap(panelRelationships);

  const sequenceKey =
    run[0]?.sequenceId ??
    `${(run[0]?.parentContext.comicTitle ?? "unknown").toLowerCase().replace(/[^a-z0-9]+/g, "_")}:run${runIndex}`;

  return {
    sequenceId: `${sequenceKey}:${run[0]?.panelId ?? "unknown"}`,
    panelIds: run.map((panel) => panel.panelId),
    pageNumbers: [...new Set(run.map((panel) => panel.pageNumber))].sort((left, right) => left - right),
    primaryCharacters: [...new Set(characters)],
    primaryTheme: dominantValue(themes),
    primaryAction: dominantValue(actions),
    primaryRelationship: dominantValue(relationships),
    storyArc: classifyStoryArc(run),
    continuityScore: scoreContinuity(run),
    selfContainedScore: scoreSelfContained(run),
    narrativeProgressionScore: scoreNarrativeProgression(run)
  };
}

export function buildComicPanelSequences(panels: LocalComicPanelEvidence[]): ComicPanelSequence[] {
  const validPanels = panels
    .filter((panel) => panel.valid)
    .sort((left, right) => {
      if (left.readingOrder !== right.readingOrder) return left.readingOrder - right.readingOrder;
      if (left.pageNumber !== right.pageNumber) return left.pageNumber - right.pageNumber;
      return left.panelNumber - right.panelNumber;
    });

  const grouped = new Map<string, LocalComicPanelEvidence[]>();
  for (const panel of validPanels) {
    const key = panel.sequenceId ?? `page:${panel.pageNumber}`;
    const bucket = grouped.get(key) ?? [];
    bucket.push(panel);
    grouped.set(key, bucket);
  }

  const sequences: ComicPanelSequence[] = [];
  let runIndex = 0;

  for (const group of grouped.values()) {
    const sorted = [...group].sort((left, right) => left.readingOrder - right.readingOrder);
    let run: LocalComicPanelEvidence[] = [];

    for (const panel of sorted) {
      if (run.length === 0) {
        run.push(panel);
        continue;
      }
      const previous = run[run.length - 1]!;
      if (shouldSplitSequenceRun(previous, panel)) {
        const built = buildSequenceFromRun(run, runIndex);
        if (built) sequences.push(built);
        runIndex += 1;
        run = [panel];
      } else {
        run.push(panel);
      }
    }

    const built = buildSequenceFromRun(run, runIndex);
    if (built) sequences.push(built);
    runIndex += 1;
  }

  return sequences.sort((left, right) => right.continuityScore - left.continuityScore);
}

export function findSequenceForPanel(
  sequences: ComicPanelSequence[],
  panelId: string
): ComicPanelSequence | null {
  return sequences.find((sequence) => sequence.panelIds.includes(panelId)) ?? null;
}

export function scorePairContinuity(
  panelA: LocalComicPanelEvidence,
  panelB: LocalComicPanelEvidence,
  sequences: ComicPanelSequence[]
): number {
  const sequence = findSequenceForPanel(sequences, panelA.panelId);
  const sameSequence =
    sequence?.panelIds.includes(panelB.panelId) ??
    (panelA.sequenceId !== null && panelA.sequenceId === panelB.sequenceId);

  let score = 20;
  if (panelA.nextPanelId === panelB.panelId || panelB.previousPanelId === panelA.panelId) score += 25;
  if (Math.abs(panelA.pageNumber - panelB.pageNumber) === 1) score += 22;
  else if (panelA.pageNumber === panelB.pageNumber) score += 10;
  else score -= 20;

  if (sameEdition(panelA, panelB)) score += 8;
  if (sameSequence) score += 18;
  score += Math.round(jaccardSimilarity(panelCharacters(panelA), panelCharacters(panelB)) * 12);
  score += Math.round(jaccardSimilarity(panelThemes(panelA), panelThemes(panelB)) * 8);

  const sharedSequence = findSequenceForPanel(sequences, panelB.panelId);
  if (sequence && sharedSequence && sequence.sequenceId === sharedSequence.sequenceId) {
    score += Math.min(sequence.continuityScore, sharedSequence.continuityScore) * 0.15;
  }

  return clamp(Math.round(score), 0, 100);
}