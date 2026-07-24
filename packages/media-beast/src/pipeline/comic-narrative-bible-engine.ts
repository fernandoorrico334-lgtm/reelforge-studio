export type ComicNarrativeFact = {
  factId: string;
  statement: string;
  importance: "critical" | "supporting" | "detail";
  requiredNarrationTerms: string[][];
  sourcePages: number[];
};

export type ComicNarrativeEvent = {
  eventId: string;
  beatIds: string[];
  issueNumber: number;
  pageNumbers: number[];
  sequence: number;
  title: string;
  narrationText: string;
  actors: string[];
  action: string;
  motivation: string;
  causes: string[];
  consequences: string[];
  facts: ComicNarrativeFact[];
  visualTargets: string[];
  mustNarrate: boolean;
};

export type ComicNarrativeIssueChapter = {
  issueNumber: number;
  title: string;
  storyPages: number[];
  eventIds: string[];
  beginning: string;
  centralConflict: string;
  turningPoint: string;
  outcome: string;
  openThreads: string[];
  resolvedThreads: string[];
};

export type ComicNarrativeBibleInput = {
  sagaId: string;
  title: string;
  premise: string;
  centralQuestion: string;
  chapters: ComicNarrativeIssueChapter[];
  events: ComicNarrativeEvent[];
  relationships?: Array<{
    relationshipId: string;
    participants: string[];
    initialState: string;
    changes: Array<{ eventId: string; state: string; reason: string }>;
    finalState: string;
  }>;
};

export type ComicNarrativeBible = ComicNarrativeBibleInput & {
  bibleId: "comic_narrative_bible_v1";
  chronologicalEventIds: string[];
  criticalFactIds: string[];
  coverage: {
    storyPageCount: number;
    coveredStoryPageCount: number;
    missingStoryPages: Array<{ issueNumber: number; pageNumber: number }>;
    criticalFactCount: number;
  };
  gate: { status: "passed" | "blocked"; score: number; blockers: string[]; warnings: string[] };
};

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function normalize(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function containsFact(narration: string, fact: ComicNarrativeFact): boolean {
  const corpus = normalize(narration);
  return fact.requiredNarrationTerms.every((alternatives) =>
    alternatives.some((term) => corpus.includes(normalize(term)))
  );
}

function pageKey(issueNumber: number, pageNumber: number): string {
  return `${issueNumber}:${pageNumber}`;
}

export function buildComicNarrativeBible(input: ComicNarrativeBibleInput): ComicNarrativeBible {
  const blockers: string[] = [];
  const warnings: string[] = [];
  const eventIds = input.events.map((event) => event.eventId);
  const eventSet = new Set(eventIds);
  if (eventSet.size !== eventIds.length) blockers.push("duplicate_event_ids");
  const factIds = input.events.flatMap((event) => event.facts.map((fact) => fact.factId));
  if (new Set(factIds).size !== factIds.length) blockers.push("duplicate_fact_ids");

  const ordered = [...input.events].sort((left, right) => left.sequence - right.sequence);
  const order = new Map(ordered.map((event, index) => [event.eventId, index]));
  for (const event of ordered) {
    if (!event.motivation.trim()) blockers.push(`event_without_motivation:${event.eventId}`);
    if (event.mustNarrate && event.facts.every((fact) => fact.importance !== "critical")) {
      blockers.push(`required_event_without_critical_fact:${event.eventId}`);
    }
    for (const causeId of event.causes) {
      if (!eventSet.has(causeId)) blockers.push(`unknown_cause:${event.eventId}:${causeId}`);
      else if ((order.get(causeId) ?? Infinity) >= (order.get(event.eventId) ?? -1)) {
        blockers.push(`cause_not_before_effect:${causeId}->${event.eventId}`);
      }
    }
    for (const consequenceId of event.consequences) {
      if (!eventSet.has(consequenceId)) warnings.push(`unknown_consequence:${event.eventId}:${consequenceId}`);
    }
  }

  const expectedPages = new Set(input.chapters.flatMap((chapter) =>
    chapter.storyPages.map((page) => pageKey(chapter.issueNumber, page))
  ));
  const coveredPages = new Set(input.events.flatMap((event) =>
    event.pageNumbers.map((page) => pageKey(event.issueNumber, page))
  ));
  const missingStoryPages = [...expectedPages].filter((key) => !coveredPages.has(key)).map((key) => {
    const [issueNumber, pageNumber] = key.split(":").map(Number);
    return { issueNumber: issueNumber!, pageNumber: pageNumber! };
  });
  if (missingStoryPages.length > 0) blockers.push(`unmapped_story_pages:${missingStoryPages.length}`);

  for (const chapter of input.chapters) {
    if (!chapter.beginning || !chapter.centralConflict || !chapter.turningPoint || !chapter.outcome) {
      blockers.push(`incomplete_issue_chapter:${chapter.issueNumber}`);
    }
    for (const eventId of chapter.eventIds) {
      if (!eventSet.has(eventId)) blockers.push(`chapter_references_unknown_event:${chapter.issueNumber}:${eventId}`);
    }
  }

  const criticalFactIds = input.events.flatMap((event) =>
    event.facts.filter((fact) => fact.importance === "critical").map((fact) => fact.factId)
  );
  if (criticalFactIds.length === 0) blockers.push("narrative_bible_has_no_critical_facts");
  const score = Math.max(0, Math.round(100 - blockers.length * 14 - warnings.length * 2));
  return {
    ...input,
    bibleId: "comic_narrative_bible_v1",
    chronologicalEventIds: ordered.map((event) => event.eventId),
    criticalFactIds,
    coverage: {
      storyPageCount: expectedPages.size,
      coveredStoryPageCount: expectedPages.size - missingStoryPages.length,
      missingStoryPages,
      criticalFactCount: criticalFactIds.length,
    },
    gate: { status: blockers.length === 0 ? "passed" : "blocked", score, blockers: unique(blockers), warnings: unique(warnings) },
  };
}

export function evaluateComicNarrativeCoverage(input: {
  bible: ComicNarrativeBible;
  narrationBeats: Array<{ beatId: string; narrationText: string }>;
}) {
  const narrationByBeat = new Map(input.narrationBeats.map((beat) => [beat.beatId, beat.narrationText]));
  const coveredEventIds: string[] = [];
  const missingEventIds: string[] = [];
  const coveredCriticalFactIds: string[] = [];
  const missingCriticalFacts: Array<{ factId: string; statement: string; eventId: string }> = [];
  const coveredSet = new Set<string>();
  for (const event of input.bible.events) {
    const narration = event.beatIds.map((beatId) => narrationByBeat.get(beatId) ?? "").join(" ");
    const criticalFacts = event.facts.filter((fact) => fact.importance === "critical");
    const eventCovered = criticalFacts.every((fact) => containsFact(narration, fact));
    if (eventCovered || !event.mustNarrate) {
      coveredEventIds.push(event.eventId);
      coveredSet.add(event.eventId);
    } else missingEventIds.push(event.eventId);
    for (const fact of criticalFacts) {
      if (containsFact(narration, fact)) coveredCriticalFactIds.push(fact.factId);
      else missingCriticalFacts.push({ factId: fact.factId, statement: fact.statement, eventId: event.eventId });
    }
  }
  const unexplainedConsequences = input.bible.events.flatMap((event) => coveredSet.has(event.eventId)
    ? event.causes.filter((causeId) => !coveredSet.has(causeId)).map((missingCauseId) => ({ eventId: event.eventId, missingCauseId }))
    : []);
  const blockers = [
    ...missingEventIds.map((eventId) => `required_event_missing:${eventId}`),
    ...missingCriticalFacts.map((fact) => `critical_fact_missing:${fact.factId}`),
    ...unexplainedConsequences.map((entry) => `effect_without_cause:${entry.missingCauseId}->${entry.eventId}`),
  ];
  const score = Math.max(0, Math.round(
    coveredCriticalFactIds.length / Math.max(1, input.bible.criticalFactIds.length) * 100 - unexplainedConsequences.length * 8
  ));
  return {
    gateId: "comic_narrative_fact_coverage_gate_v1" as const,
    status: blockers.length === 0 && input.bible.gate.status === "passed" ? "passed" as const : "blocked" as const,
    score,
    coveredEventIds,
    missingEventIds,
    coveredCriticalFactIds,
    missingCriticalFacts,
    unexplainedConsequences,
    blockers,
    warnings: input.bible.gate.warnings,
  };
}
