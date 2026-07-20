import type { ComicStoryMinerReport } from "./comic-story-miner.js";
import {
  buildComicIssueNarrativeMap,
  type ComicIssueNarrativeMap,
  type ComicIssueStoryCandidate
} from "./comic-issue-narrative-map.js";

export type ComicSagaIssueInput = {
  issueId?: string;
  issueNumber?: number;
  title?: string;
  sourcePath?: string;
  report: ComicStoryMinerReport;
};

export type ComicSagaTimelineEntry = {
  issueId: string;
  issueNumber: number;
  issueTitle: string;
  role: string;
  absoluteOrder: number;
  localPages: number[];
  pageRange: { start: number; end: number };
  summary: string;
  conflictSignal: string;
  dominantCharacters: string[];
  dominantThemes: string[];
  shortPotentialScore: number;
  warnings: string[];
};

export type ComicSagaShortCandidate = {
  id: string;
  title: string;
  issueId: string;
  issueNumber: number;
  issueTitle: string;
  localCandidateId: string;
  source: ComicIssueStoryCandidate["source"];
  pages: number[];
  panelIds: string[];
  characters: string[];
  themes: string[];
  hook: string;
  conflict: string;
  middle: string;
  payoff: string;
  estimatedDurationSeconds: number;
  score: number;
  readiness: ComicIssueStoryCandidate["readiness"];
  chronology: {
    startsAfterIssue: number;
    localPageStart: number;
    localPageEnd: number;
  };
  reasons: string[];
  warnings: string[];
};

export type ComicSagaStoryline = {
  id: string;
  title: string;
  characters: string[];
  themes: string[];
  issueNumbers: number[];
  candidateIds: string[];
  beginning: string;
  conflict: string;
  middle: string;
  payoff: string;
  score: number;
  readiness: "ready_for_series_short" | "needs_more_story_context" | "weak_storyline";
  warnings: string[];
};

export type ComicSagaNarrativeMap = {
  mapId: "comic_saga_narrative_map_v1";
  generatedAt: string;
  sagaOverview: {
    title: string;
    issueCount: number;
    totalPages: number;
    totalPanels: number;
    estimatedShortsAvailable: number;
    mainCharacters: string[];
    mainThemes: string[];
    centralPremise: string;
    beginning: string;
    middle: string;
    ending: string;
  };
  issueMaps: Array<{
    issueId: string;
    issueNumber: number;
    title: string;
    sourcePath: string | null;
    map: ComicIssueNarrativeMap;
  }>;
  timeline: ComicSagaTimelineEntry[];
  storylines: ComicSagaStoryline[];
  recommendedShorts: ComicSagaShortCandidate[];
  whatSystemSees: {
    pageAndPanelCoverage: string;
    chronologyUnderstanding: string;
    storyUnderstanding: string;
    visualUnderstanding: string;
    dialogueUnderstanding: string;
    confidence: "high" | "medium" | "low";
    currentBlindSpots: string[];
  };
  qualityGates: {
    hasMultipleIssues: boolean;
    hasChronologicalTimeline: boolean;
    hasReadyShorts: boolean;
    hasSeriesStorylines: boolean;
    canAttemptAutomatedSeriesShort: boolean;
    blockers: string[];
  };
  warnings: string[];
  candidateFirst: true;
  requiresManualApproval: true;
};

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function titleFromReport(report: ComicStoryMinerReport): string {
  return report.source.issueTitles.find((title) => title.trim().length > 0)
    ?? report.source.comicTitles.find((title) => title.trim().length > 0)
    ?? "HQ importada";
}

function inferIssueNumber(input: ComicSagaIssueInput, fallback: number): number {
  if (typeof input.issueNumber === "number" && Number.isFinite(input.issueNumber)) return input.issueNumber;
  const text = [input.title, input.sourcePath, ...input.report.source.issueTitles, ...input.report.source.comicTitles].filter(Boolean).join(" ");
  const match = text.match(/#\s*(\d{1,3})|(?:issue|edicao|edi[cç][aã]o)\s*(\d{1,3})/i);
  const value = Number.parseInt(match?.[1] ?? match?.[2] ?? "", 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function mostFrequent(values: string[], limit: number): string[] {
  const counts = new Map<string, number>();
  for (const value of values.filter(Boolean)) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, limit)
    .map(([value]) => value);
}

function display(value: string): string {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .replace("Godzilla", "Godzilla")
    .replace("Kong", "Kong")
    .replace("Superman", "Superman")
    .replace("Batman", "Batman");
}

function candidateKey(candidate: ComicSagaShortCandidate): string {
  const chars = candidate.characters.slice(0, 2).sort().join("+") || "unknown";
  const theme = candidate.themes[0] ?? candidate.source;
  return `${chars}:${theme}`;
}

function buildTimeline(issueMaps: ComicSagaNarrativeMap["issueMaps"]): ComicSagaTimelineEntry[] {
  const entries: ComicSagaTimelineEntry[] = [];
  for (const issue of issueMaps) {
    for (const section of issue.map.sections) {
      entries.push({
        issueId: issue.issueId,
        issueNumber: issue.issueNumber,
        issueTitle: issue.title,
        role: section.role,
        absoluteOrder: issue.issueNumber * 10000 + section.pageRange.start,
        localPages: section.pages,
        pageRange: section.pageRange,
        summary: section.summary,
        conflictSignal: section.conflictSignal,
        dominantCharacters: section.dominantCharacters,
        dominantThemes: section.dominantThemes,
        shortPotentialScore: section.shortPotentialScore,
        warnings: section.warnings
      });
    }
  }
  return entries.sort((left, right) => left.absoluteOrder - right.absoluteOrder);
}

function buildShortCandidates(issueMaps: ComicSagaNarrativeMap["issueMaps"]): ComicSagaShortCandidate[] {
  return issueMaps.flatMap((issue) =>
    issue.map.storyCandidates.map((candidate): ComicSagaShortCandidate => ({
      id: `saga-short:${issue.issueId}:${candidate.id}`,
      title: candidate.title,
      issueId: issue.issueId,
      issueNumber: issue.issueNumber,
      issueTitle: issue.title,
      localCandidateId: candidate.id,
      source: candidate.source,
      pages: candidate.pages,
      panelIds: candidate.panelIds,
      characters: candidate.characters,
      themes: candidate.themes,
      hook: candidate.hook,
      conflict: candidate.conflict,
      middle: candidate.middle,
      payoff: candidate.payoff,
      estimatedDurationSeconds: Math.max(30, candidate.estimatedDurationSeconds),
      score: candidate.score,
      readiness: candidate.readiness,
      chronology: {
        startsAfterIssue: issue.issueNumber,
        localPageStart: Math.min(...candidate.pages),
        localPageEnd: Math.max(...candidate.pages)
      },
      reasons: candidate.reasons,
      warnings: candidate.warnings
    }))
  ).sort((left, right) => {
    const readyWeight = (candidate: ComicSagaShortCandidate) => candidate.readiness === "ready_for_short" ? 18 : candidate.readiness === "needs_manual_panel_review" ? 8 : 0;
    return right.score + readyWeight(right) - (left.score + readyWeight(left)) || left.issueNumber - right.issueNumber;
  });
}

function buildStorylines(candidates: ComicSagaShortCandidate[]): ComicSagaStoryline[] {
  const groups = new Map<string, ComicSagaShortCandidate[]>();
  for (const candidate of candidates) {
    const key = candidateKey(candidate);
    const group = groups.get(key) ?? [];
    group.push(candidate);
    groups.set(key, group);
  }

  return [...groups.entries()].map(([key, group], index): ComicSagaStoryline => {
    const ordered = [...group].sort((left, right) => left.issueNumber - right.issueNumber || left.chronology.localPageStart - right.chronology.localPageStart);
    const best = [...ordered].sort((left, right) => right.score - left.score)[0]!;
    const characters = mostFrequent(ordered.flatMap((item) => item.characters), 6);
    const themes = mostFrequent(ordered.flatMap((item) => item.themes), 8);
    const score = clampScore(
      ordered.reduce((sum, item) => sum + item.score, 0) / ordered.length +
      Math.min(12, ordered.length * 3) +
      (unique(ordered.map((item) => item.issueNumber)).length >= 2 ? 8 : 0)
    );
    const warnings: string[] = [];
    if (ordered.length < 2) warnings.push("storyline_single_candidate_only");
    if (ordered.every((item) => item.readiness === "weak_story" || item.readiness === "needs_more_context")) warnings.push("storyline_has_no_ready_short");
    return {
      id: `saga-storyline:${index + 1}:${key.replace(/[^a-z0-9_-]+/gi, "-")}`,
      title: `${display(characters[0] ?? themes[0] ?? "Historia")} - ${best.title}`,
      characters,
      themes,
      issueNumbers: unique(ordered.map((item) => item.issueNumber)).sort((left, right) => left - right),
      candidateIds: ordered.map((item) => item.id),
      beginning: ordered[0]?.hook ?? best.hook,
      conflict: best.conflict,
      middle: ordered[Math.floor(ordered.length / 2)]?.middle ?? best.middle,
      payoff: ordered[ordered.length - 1]?.payoff ?? best.payoff,
      score,
      readiness: score >= 82 && warnings.length === 0 ? "ready_for_series_short" : score >= 68 ? "needs_more_story_context" : "weak_storyline",
      warnings
    };
  }).sort((left, right) => right.score - left.score).slice(0, 24);
}

function buildWhatSystemSees(input: {
  issueMaps: ComicSagaNarrativeMap["issueMaps"];
  timeline: ComicSagaTimelineEntry[];
  candidates: ComicSagaShortCandidate[];
  storylines: ComicSagaStoryline[];
}): ComicSagaNarrativeMap["whatSystemSees"] {
  const totalPages = input.issueMaps.reduce((sum, issue) => sum + issue.map.issueOverview.pageCount, 0);
  const totalPanels = input.issueMaps.reduce((sum, issue) => sum + issue.map.issueOverview.panelCount, 0);
  const ready = input.candidates.filter((candidate) => candidate.readiness === "ready_for_short").length;
  const manual = input.candidates.filter((candidate) => candidate.readiness === "needs_manual_panel_review").length;
  const blindSpots: string[] = [];
  if (ready === 0) blindSpots.push("no_ready_short_without_manual_review");
  if (input.timeline.some((entry) => entry.warnings.includes("section_needs_visual_context_or_manual_reading"))) blindSpots.push("some_sections_need_manual_visual_reading_or_ocr");
  if (input.storylines.every((storyline) => storyline.readiness !== "ready_for_series_short")) blindSpots.push("no_series_storyline_ready_yet");
  return {
    pageAndPanelCoverage: `O sistema indexou ${totalPages} paginas e ${totalPanels} paineis em ${input.issueMaps.length} edicao(oes).`,
    chronologyUnderstanding: `A timeline tem ${input.timeline.length} secoes em ordem de edicao e pagina; ela evita voltar paginas dentro do mesmo short.`,
    storyUnderstanding: `Foram encontrados ${input.candidates.length} candidatos de short (${ready} prontos, ${manual} para revisao manual) e ${input.storylines.length} linhas de historia agrupadas por personagens/temas.`,
    visualUnderstanding: "Ele reconhece funcoes visuais como setup, dialogo, acao, climax, reacao, cropabilidade 9:16, texto/balao e evidencias de personagens/temas.",
    dialogueUnderstanding: "Ele usa texto detectado/OCR quando existe; quando OCR esta fraco, depende mais de evidencias visuais e marca pontos cegos.",
    confidence: ready > 0 && blindSpots.length <= 1 ? "high" : manual > 0 || input.candidates.length > 0 ? "medium" : "low",
    currentBlindSpots: blindSpots
  };
}

export function buildComicSagaNarrativeMap(input: {
  title?: string;
  issues: ComicSagaIssueInput[];
}): ComicSagaNarrativeMap {
  const sortedInputs = input.issues
    .map((issue, index) => ({ issue, issueNumber: inferIssueNumber(issue, index + 1) }))
    .sort((left, right) => left.issueNumber - right.issueNumber);

  const issueMaps: ComicSagaNarrativeMap["issueMaps"] = sortedInputs.map(({ issue, issueNumber }, index) => {
    const map = buildComicIssueNarrativeMap(issue.report);
    const title = issue.title ?? titleFromReport(issue.report);
    return {
      issueId: issue.issueId ?? `issue-${String(issueNumber).padStart(2, "0")}-${index + 1}`,
      issueNumber,
      title,
      sourcePath: issue.sourcePath ?? null,
      map
    };
  });

  const timeline = buildTimeline(issueMaps);
  const candidates = buildShortCandidates(issueMaps);
  const storylines = buildStorylines(candidates);
  const mainCharacters = mostFrequent(issueMaps.flatMap((issue) => issue.map.issueOverview.mainCharacters), 10);
  const mainThemes = mostFrequent(issueMaps.flatMap((issue) => issue.map.issueOverview.mainThemes), 12);
  const recommendedShorts = candidates
    .filter((candidate) => candidate.readiness === "ready_for_short" || candidate.readiness === "needs_manual_panel_review")
    .slice(0, 30);
  const blockers: string[] = [];
  if (issueMaps.length < 2) blockers.push("saga_map_has_single_issue_only");
  if (timeline.length === 0) blockers.push("saga_map_has_no_timeline_sections");
  if (recommendedShorts.length === 0) blockers.push("saga_map_has_no_ready_short_candidates");
  if (storylines.length === 0) blockers.push("saga_map_has_no_storylines");

  const whatSystemSees = buildWhatSystemSees({ issueMaps, timeline, candidates, storylines });
  const warnings = unique([
    ...issueMaps.flatMap((issue) => issue.map.warnings.map((warning) => `${issue.issueId}:${warning}`)),
    ...blockers,
    ...whatSystemSees.currentBlindSpots.map((warning) => `blind_spot:${warning}`)
  ]);

  return {
    mapId: "comic_saga_narrative_map_v1",
    generatedAt: new Date().toISOString(),
    sagaOverview: {
      title: input.title ?? issueMaps[0]?.title ?? "Saga de HQ importada",
      issueCount: issueMaps.length,
      totalPages: issueMaps.reduce((sum, issue) => sum + issue.map.issueOverview.pageCount, 0),
      totalPanels: issueMaps.reduce((sum, issue) => sum + issue.map.issueOverview.panelCount, 0),
      estimatedShortsAvailable: recommendedShorts.length,
      mainCharacters,
      mainThemes,
      centralPremise: storylines[0]?.conflict ?? candidates[0]?.conflict ?? "Premissa central ainda precisa de leitura manual.",
      beginning: timeline[0]?.summary ?? "Comeco ainda nao mapeado.",
      middle: timeline[Math.floor(timeline.length / 2)]?.summary ?? "Meio ainda nao mapeado.",
      ending: timeline[timeline.length - 1]?.summary ?? "Final ainda nao mapeado."
    },
    issueMaps,
    timeline,
    storylines,
    recommendedShorts,
    whatSystemSees,
    qualityGates: {
      hasMultipleIssues: issueMaps.length >= 2,
      hasChronologicalTimeline: timeline.length > 0,
      hasReadyShorts: recommendedShorts.length > 0,
      hasSeriesStorylines: storylines.length > 0,
      canAttemptAutomatedSeriesShort: blockers.length === 0,
      blockers
    },
    warnings,
    candidateFirst: true,
    requiresManualApproval: true
  };
}