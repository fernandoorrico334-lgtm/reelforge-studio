import type { ComicSagaNarrativeMap, ComicSagaShortCandidate, ComicSagaTimelineEntry } from "./comic-saga-narrative-map.js";
import { buildComicNarrativeBible, type ComicNarrativeBibleInput, type ComicNarrativeEvent } from "./comic-narrative-bible-engine.js";
import { buildComicNarrativeEpisodePlan, type ComicNarrativeEpisodeDefinition } from "./comic-narrative-episode-planner.js";
import { evaluateComicOneClickProductionGate } from "./comic-one-click-production-gate.js";

export type ComicAutoBibleEpisodeMode = "full_story_series" | "best_story_short" | "curiosity_batch";

export type ComicAutoBibleBuilderReport = {
  builderId: "comic_auto_bible_builder_v1";
  generatedAt: string;
  sagaTitle: string;
  mode: ComicAutoBibleEpisodeMode;
  narrativeBibleInput: ComicNarrativeBibleInput;
  episodeDefinitions: ComicNarrativeEpisodeDefinition[];
  bible: ReturnType<typeof buildComicNarrativeBible>;
  episodePlan: ReturnType<typeof buildComicNarrativeEpisodePlan>;
  productionGates: Array<{
    episodeId: string;
    episodeNumber: number;
    title: string;
    score: number;
    renderAllowed: boolean;
    status: string;
    blockers: string[];
    warnings: string[];
  }>;
  outputContract: {
    canFeedOneClickProduction: boolean;
    recommendedNextStep: string;
    minimumDurationSeconds: number;
    maximumDurationSeconds: number;
    targetWordsPerMinute: number;
  };
  whatItUnderstands: {
    premise: string;
    centralQuestion: string;
    beginning: string;
    middle: string;
    ending: string;
    strongestCharacters: string[];
    strongestThemes: string[];
    generatedEventCount: number;
    generatedEpisodeCount: number;
  };
  qualityGates: {
    hasEvents: boolean;
    hasEpisodes: boolean;
    biblePassed: boolean;
    episodePlannerPassed: boolean;
    productionReadyEpisodes: number;
    canAttemptAutomatedRender: boolean;
    blockers: string[];
    warnings: string[];
  };
  candidateFirst: true;
  requiresManualApproval: true;
};

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function slug(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "event";
}

function sentence(value: string): string {
  const clean = value.replace(/\s+/g, " ").trim();
  return clean && !/[.!?]$/.test(clean) ? `${clean}.` : clean;
}

function display(value: string | null | undefined, fallback = "a historia"): string {
  const raw = value?.trim() || fallback;
  return raw.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function mostFrequent(values: string[], limit: number): string[] {
  const counts = new Map<string, number>();
  for (const value of values.filter(Boolean)) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()].sort((left, right) => right[1] - left[1]).slice(0, limit).map(([value]) => value);
}

function pageNumbersFromTimeline(entry: ComicSagaTimelineEntry): number[] {
  return entry.localPages.length ? entry.localPages : Array.from({ length: Math.max(1, entry.pageRange.end - entry.pageRange.start + 1) }, (_, index) => entry.pageRange.start + index);
}

function termsForFact(...values: string[]): string[][] {
  const terms = values
    .flatMap((value) => value.split(/\s+/))
    .map((value) => value.replace(/[^\p{L}\p{N}-]/gu, "").trim())
    .filter((value) => value.length >= 4)
    .slice(0, 4);
  return terms.length ? terms.map((term) => [term]) : [["historia"]];
}

function eventFromCandidate(candidate: ComicSagaShortCandidate, sequence: number, previousEventId: string | null): ComicNarrativeEvent {
  const eventId = `auto-${String(sequence).padStart(3, "0")}-${slug(candidate.title).slice(0, 45)}`;
  const actors = candidate.characters.length ? candidate.characters : [candidate.themes[0] ?? "personagens da HQ"];
  const pages = unique(candidate.pages).sort((left, right) => left - right);
  const action = candidate.conflict || candidate.middle || candidate.hook;
  const motivation = candidate.hook || candidate.conflict || `Explicar por que ${display(actors[0])} importa nesta parte da historia`;
  const narrationText = sentence([
    candidate.hook,
    candidate.conflict,
    candidate.middle,
    candidate.payoff
  ].filter(Boolean).join(" "));
  return {
    eventId,
    beatIds: candidate.panelIds.length ? candidate.panelIds.slice(0, 8).map((panelId) => `auto-beat-${slug(panelId).slice(0, 35)}`) : [`auto-beat-${eventId}`],
    issueNumber: candidate.issueNumber,
    pageNumbers: pages,
    sequence,
    title: candidate.title,
    narrationText,
    actors,
    action,
    motivation,
    causes: previousEventId ? [previousEventId] : [],
    consequences: [],
    facts: [{
      factId: `${eventId}-critical-fact`,
      statement: sentence(candidate.conflict || candidate.payoff || candidate.hook || candidate.title),
      importance: "critical",
      requiredNarrationTerms: termsForFact(candidate.title, candidate.conflict, actors[0] ?? ""),
      sourcePages: pages
    }],
    visualTargets: unique([...actors, ...candidate.themes, ...candidate.panelIds.slice(0, 4)]),
    mustNarrate: true
  };
}

function eventFromTimeline(entry: ComicSagaTimelineEntry, sequence: number, previousEventId: string | null): ComicNarrativeEvent {
  const eventId = `auto-${String(sequence).padStart(3, "0")}-${slug(entry.summary).slice(0, 45)}`;
  const actors = entry.dominantCharacters.length ? entry.dominantCharacters : [entry.dominantThemes[0] ?? "personagens da HQ"];
  const pages = unique(pageNumbersFromTimeline(entry)).sort((left, right) => left - right);
  const action = entry.conflictSignal || entry.summary;
  const narrationText = sentence(`${entry.summary} ${entry.conflictSignal}`.trim());
  return {
    eventId,
    beatIds: [`auto-beat-${eventId}`],
    issueNumber: entry.issueNumber,
    pageNumbers: pages,
    sequence,
    title: entry.summary,
    narrationText,
    actors,
    action,
    motivation: entry.conflictSignal || `Mostrar por que ${display(actors[0])} muda o rumo da historia`,
    causes: previousEventId ? [previousEventId] : [],
    consequences: [],
    facts: [{
      factId: `${eventId}-critical-fact`,
      statement: narrationText,
      importance: "critical",
      requiredNarrationTerms: termsForFact(entry.summary, entry.conflictSignal, actors[0] ?? ""),
      sourcePages: pages
    }],
    visualTargets: unique([...actors, ...entry.dominantThemes]),
    mustNarrate: true
  };
}

function linkConsequences(events: ComicNarrativeEvent[]): ComicNarrativeEvent[] {
  return events.map((event, index) => ({
    ...event,
    consequences: events[index + 1] ? [events[index + 1]!.eventId] : []
  }));
}

function selectEvents(sagaMap: ComicSagaNarrativeMap, mode: ComicAutoBibleEpisodeMode, targetEventCount: number): ComicNarrativeEvent[] {
  const chronologicalCandidates = [...sagaMap.recommendedShorts]
    .sort((left, right) => left.issueNumber - right.issueNumber || left.chronology.localPageStart - right.chronology.localPageStart);
  const sourceCandidates = mode === "full_story_series"
    ? chronologicalCandidates
    : mode === "curiosity_batch"
      ? chronologicalCandidates.filter((candidate) => /curios|revel|segredo|detalhe|absurd/i.test([...candidate.themes, candidate.title, candidate.hook].join(" ")))
      : chronologicalCandidates.slice().sort((left, right) => right.score - left.score);

  const events: ComicNarrativeEvent[] = [];
  for (const candidate of sourceCandidates.slice(0, targetEventCount)) {
    events.push(eventFromCandidate(candidate, events.length + 1, events.at(-1)?.eventId ?? null));
  }

  if (events.length < Math.min(4, targetEventCount)) {
    for (const entry of sagaMap.timeline) {
      if (events.length >= targetEventCount) break;
      const duplicate = events.some((event) => event.issueNumber === entry.issueNumber && event.pageNumbers.some((page) => page >= entry.pageRange.start && page <= entry.pageRange.end));
      if (duplicate && events.length >= 4) continue;
      events.push(eventFromTimeline(entry, events.length + 1, events.at(-1)?.eventId ?? null));
    }
  }

  return linkConsequences(events.sort((left, right) => left.issueNumber - right.issueNumber || Math.min(...left.pageNumbers) - Math.min(...right.pageNumbers))
    .map((event, index) => ({ ...event, sequence: index + 1, causes: index > 0 ? [] : event.causes }))
    .map((event, index, ordered) => ({ ...event, causes: index > 0 ? [ordered[index - 1]!.eventId] : [] })));
}

function buildChapters(sagaMap: ComicSagaNarrativeMap, events: ComicNarrativeEvent[]): ComicNarrativeBibleInput["chapters"] {
  return sagaMap.issueMaps.map((issue) => {
    const issueEvents = events.filter((event) => event.issueNumber === issue.issueNumber);
    const storyPages = unique(issueEvents.flatMap((event) => event.pageNumbers)).sort((left, right) => left - right);
    return {
      issueNumber: issue.issueNumber,
      title: issue.title,
      storyPages,
      eventIds: issueEvents.map((event) => event.eventId),
      beginning: issue.map.issueOverview.beginning || issue.map.sections[0]?.summary || "A historia comeca apresentando o conflito principal.",
      centralConflict: issue.map.issueOverview.centralConflict || issue.map.sections.find((section) => section.conflictSignal)?.conflictSignal || sagaMap.sagaOverview.centralPremise,
      turningPoint: issue.map.sections.find((section) => ["midpoint", "climax", "conflict_escalation"].includes(section.role))?.summary ?? issue.map.issueOverview.middle,
      outcome: issue.map.issueOverview.ending || issue.map.sections.at(-1)?.summary || "A edicao deixa consequencias para a proxima parte.",
      openThreads: issueEvents.at(-1)?.consequences ?? [],
      resolvedThreads: issueEvents.flatMap((event) => event.causes)
    };
  }).filter((chapter) => chapter.eventIds.length > 0 && chapter.storyPages.length > 0);
}

function chunkEpisodes(events: ComicNarrativeEvent[], maximumEpisodeDurationSeconds: number, targetWordsPerMinute: number): ComicNarrativeEpisodeDefinition[] {
  const maxWords = Math.floor(maximumEpisodeDurationSeconds * targetWordsPerMinute / 60);
  const minEventsPerEpisode = 3;
  const episodes: ComicNarrativeEpisodeDefinition[] = [];
  let bucket: ComicNarrativeEvent[] = [];
  let words = 0;
  for (const event of events) {
    const eventWords = event.narrationText.split(/\s+/).filter(Boolean).length + 36;
    if (bucket.length >= minEventsPerEpisode && words + eventWords > maxWords) {
      episodes.push(makeEpisodeDefinition(bucket, episodes.length + 1));
      bucket = [];
      words = 0;
    }
    bucket.push(event);
    words += eventWords;
  }
  if (bucket.length) episodes.push(makeEpisodeDefinition(bucket, episodes.length + 1));
  return episodes;
}

function makeEpisodeDefinition(events: ComicNarrativeEvent[], episodeNumber: number): ComicNarrativeEpisodeDefinition {
  const first = events[0]!;
  const last = events.at(-1)!;
  const leadActor = display(first.actors[0]);
  const title = episodeNumber === 1
    ? `Parte ${episodeNumber}: Como ${leadActor} entrou no centro da historia`
    : `Parte ${episodeNumber}: O conflito fica maior`;
  return {
    episodeId: `auto-episode-${String(episodeNumber).padStart(2, "0")}-${slug(title)}`,
    title,
    eventIds: events.map((event) => event.eventId),
    hook: episodeNumber === 1
      ? `${leadActor} parecia estar diante de um problema comum. Mas essa historia ja estava preparando algo muito maior.`
      : `Quando parecia que a historia tinha explicado o conflito, uma nova peca muda tudo.`,
    context: `Esta parte acompanha as paginas ${Math.min(...events.flatMap((event) => event.pageNumbers))} ate ${Math.max(...events.flatMap((event) => event.pageNumbers))}, sempre em ordem, sem voltar na HQ.`,
    payoff: `${display(last.actors[0])} chega a um ponto em que a proxima decisao pode mudar completamente o rumo da historia.`,
    nextEpisodeHook: "E a parte seguinte precisa responder o que essa virada realmente provoca."
  };
}

export function buildComicAutoBibleFromSagaMap(input: {
  sagaMap: ComicSagaNarrativeMap;
  mode?: ComicAutoBibleEpisodeMode;
  targetEventCount?: number;
  maximumEpisodeDurationSeconds?: number;
  targetWordsPerMinute?: number;
}): ComicAutoBibleBuilderReport {
  const mode = input.mode ?? "full_story_series";
  const maximumEpisodeDurationSeconds = clamp(input.maximumEpisodeDurationSeconds ?? 180, 60, 180);
  const targetWordsPerMinute = clamp(input.targetWordsPerMinute ?? 160, 120, 190);
  const targetEventCount = clamp(input.targetEventCount ?? 24, 4, 80);
  const events = selectEvents(input.sagaMap, mode, targetEventCount);
  const chapters = buildChapters(input.sagaMap, events);
  const narrativeBibleInput: ComicNarrativeBibleInput = {
    sagaId: `auto-bible-${slug(input.sagaMap.sagaOverview.title)}`,
    title: input.sagaMap.sagaOverview.title,
    premise: input.sagaMap.sagaOverview.centralPremise || `Explicar a historia de ${input.sagaMap.sagaOverview.title} em partes claras e cinematograficas.`,
    centralQuestion: input.sagaMap.sagaOverview.middle || `Como essa HQ transforma seu conflito inicial em uma historia que prende ate o final?`,
    chapters,
    events
  };
  const episodeDefinitions = chunkEpisodes(events, maximumEpisodeDurationSeconds, targetWordsPerMinute);
  const bible = buildComicNarrativeBible(narrativeBibleInput);
  const episodePlan = buildComicNarrativeEpisodePlan({
    bible,
    episodes: episodeDefinitions,
    maximumEpisodeDurationSeconds,
    targetWordsPerMinute
  });
  const productionGates = episodePlan.episodes.map((episode) => {
    const gate = evaluateComicOneClickProductionGate({
      episode,
      minimumDurationSeconds: 30,
      maximumDurationSeconds: maximumEpisodeDurationSeconds,
      minimumScoreToRender: 86
    });
    return {
      episodeId: episode.episodeId,
      episodeNumber: episode.episodeNumber,
      title: episode.title,
      score: gate.score,
      renderAllowed: gate.renderAllowed,
      status: gate.status,
      blockers: gate.blockers,
      warnings: gate.warnings
    };
  });
  const blockers = [
    ...bible.gate.blockers.map((item) => `bible:${item}`),
    ...episodePlan.blockers.map((item) => `episode:${item}`),
    ...productionGates.flatMap((gate) => gate.blockers.map((item) => `${gate.episodeId}:${item}`))
  ];
  const warnings = [
    ...bible.gate.warnings.map((item) => `bible:${item}`),
    ...episodePlan.warnings.map((item) => `episode:${item}`),
    ...productionGates.flatMap((gate) => gate.warnings.map((item) => `${gate.episodeId}:${item}`))
  ];
  const productionReadyEpisodes = productionGates.filter((gate) => gate.renderAllowed).length;
  return {
    builderId: "comic_auto_bible_builder_v1",
    generatedAt: new Date().toISOString(),
    sagaTitle: input.sagaMap.sagaOverview.title,
    mode,
    narrativeBibleInput,
    episodeDefinitions,
    bible,
    episodePlan,
    productionGates,
    outputContract: {
      canFeedOneClickProduction: blockers.length === 0 && productionReadyEpisodes > 0,
      recommendedNextStep: blockers.length === 0 ? "Review generated episodes, then feed this bible into Comic One-Click Production." : "Review blockers before rendering.",
      minimumDurationSeconds: 30,
      maximumDurationSeconds: maximumEpisodeDurationSeconds,
      targetWordsPerMinute
    },
    whatItUnderstands: {
      premise: narrativeBibleInput.premise,
      centralQuestion: narrativeBibleInput.centralQuestion,
      beginning: input.sagaMap.sagaOverview.beginning,
      middle: input.sagaMap.sagaOverview.middle,
      ending: input.sagaMap.sagaOverview.ending,
      strongestCharacters: mostFrequent(events.flatMap((event) => event.actors), 8),
      strongestThemes: input.sagaMap.sagaOverview.mainThemes.slice(0, 8),
      generatedEventCount: events.length,
      generatedEpisodeCount: episodeDefinitions.length
    },
    qualityGates: {
      hasEvents: events.length > 0,
      hasEpisodes: episodeDefinitions.length > 0,
      biblePassed: bible.gate.status === "passed",
      episodePlannerPassed: episodePlan.status === "passed",
      productionReadyEpisodes,
      canAttemptAutomatedRender: blockers.length === 0 && productionReadyEpisodes > 0,
      blockers,
      warnings
    },
    candidateFirst: true,
    requiresManualApproval: true
  };
}

