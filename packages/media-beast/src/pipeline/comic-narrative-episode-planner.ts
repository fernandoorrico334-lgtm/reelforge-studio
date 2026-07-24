import type { ComicNarrativeBible, ComicNarrativeEvent } from "./comic-narrative-bible-engine.js";
import { evaluateComicNarrativeCoverage } from "./comic-narrative-bible-engine.js";

export type ComicNarrativeEpisodeDefinition = {
  episodeId: string;
  title: string;
  eventIds: string[];
  hook: string;
  context: string;
  payoff: string;
  nextEpisodeHook?: string;
};

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function wordCount(value: string): number {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

function sentence(value: string): string {
  const clean = value.replace(/\s+/g, " ").trim();
  return clean && !/[.!?]$/.test(clean) ? `${clean}.` : clean;
}

function narration(definition: ComicNarrativeEpisodeDefinition, events: ComicNarrativeEvent[]): string {
  return [definition.hook, definition.context, ...events.map((event) => event.narrationText), definition.payoff, definition.nextEpisodeHook]
    .filter((value): value is string => Boolean(value?.trim())).map(sentence).join(" ");
}

export function buildComicNarrativeEpisodePlan(input: {
  bible: ComicNarrativeBible;
  episodes: ComicNarrativeEpisodeDefinition[];
  maximumEpisodeDurationSeconds?: number;
  targetWordsPerMinute?: number;
}) {
  const maximumEpisodeDurationSeconds = Math.min(180, Math.max(60, input.maximumEpisodeDurationSeconds ?? 180));
  const targetWordsPerMinute = Math.min(190, Math.max(120, input.targetWordsPerMinute ?? 160));
  const eventById = new Map(input.bible.events.map((event) => [event.eventId, event]));
  const assignedEventIds = input.episodes.flatMap((episode) => episode.eventIds);
  const missingEventIds = input.bible.events.filter((event) => event.mustNarrate && !assignedEventIds.includes(event.eventId)).map((event) => event.eventId);
  const duplicatedEventIds = unique(assignedEventIds.filter((eventId, index) => assignedEventIds.indexOf(eventId) !== index));
  const blockers: string[] = [];
  const warnings: string[] = [];
  if (input.bible.gate.status !== "passed") blockers.push(...input.bible.gate.blockers.map((item) => `bible:${item}`));
  if (missingEventIds.length) blockers.push(`required_events_without_episode:${missingEventIds.join(",")}`);
  if (duplicatedEventIds.length) blockers.push(`events_repeated_across_episodes:${duplicatedEventIds.join(",")}`);

  const episodes = input.episodes.map((definition, index) => {
    const episodeBlockers: string[] = [];
    const episodeWarnings: string[] = [];
    const events = definition.eventIds.map((eventId) => eventById.get(eventId)).filter((event): event is ComicNarrativeEvent => Boolean(event));
    const unknownIds = definition.eventIds.filter((eventId) => !eventById.has(eventId));
    if (unknownIds.length) episodeBlockers.push(`unknown_episode_events:${unknownIds.join(",")}`);
    const sorted = [...events].sort((left, right) => left.sequence - right.sequence);
    if (sorted.some((event, eventIndex) => event.eventId !== events[eventIndex]?.eventId)) episodeBlockers.push("episode_events_not_chronological");
    const episodeNarration = narration(definition, events);
    const words = wordCount(episodeNarration);
    const estimatedDurationSeconds = Math.round(words / targetWordsPerMinute * 600) / 10;
    if (estimatedDurationSeconds > maximumEpisodeDurationSeconds) episodeBlockers.push(`episode_duration_exceeds_limit:${estimatedDurationSeconds}>${maximumEpisodeDurationSeconds}`);
    if (words < 120) episodeWarnings.push(`episode_narration_may_be_too_short:${words}`);
    const coverage = evaluateComicNarrativeCoverage({
      bible: { ...input.bible, events, criticalFactIds: events.flatMap((event) => event.facts.filter((fact) => fact.importance === "critical").map((fact) => fact.factId)) },
      narrationBeats: events.flatMap((event) => event.beatIds.map((beatId) => ({ beatId, narrationText: event.narrationText }))),
    });
    episodeBlockers.push(...coverage.missingCriticalFacts.map((fact) => `episode_missing_critical_fact:${fact.factId}`));
    const issueNumbers = unique(events.map((event) => event.issueNumber)).sort((left, right) => left - right);
    const pageReferences = issueNumbers.map((issueNumber) => ({
      issueNumber,
      pageNumbers: unique(events.filter((event) => event.issueNumber === issueNumber).flatMap((event) => event.pageNumbers)).sort((left, right) => left - right),
    }));
    return {
      ...definition,
      episodeNumber: index + 1,
      issueNumbers,
      pageReferences,
      narrationBeats: events.map((event) => ({ eventId: event.eventId, beatIds: event.beatIds, narrationText: event.narrationText, sourcePages: event.pageNumbers, visualTargets: event.visualTargets })),
      narration: episodeNarration,
      wordCount: words,
      estimatedDurationSeconds,
      criticalFactIds: events.flatMap((event) => event.facts.filter((fact) => fact.importance === "critical").map((fact) => fact.factId)),
      gate: { status: episodeBlockers.length === 0 ? "passed" as const : "blocked" as const, blockers: episodeBlockers, warnings: episodeWarnings },
    };
  });
  blockers.push(...episodes.flatMap((episode) => episode.gate.blockers.map((item) => `${episode.episodeId}:${item}`)));
  warnings.push(...episodes.flatMap((episode) => episode.gate.warnings.map((item) => `${episode.episodeId}:${item}`)));
  return {
    plannerId: "comic_narrative_episode_planner_v1" as const,
    sagaId: input.bible.sagaId,
    maximumEpisodeDurationSeconds,
    targetWordsPerMinute,
    episodeCount: episodes.length,
    episodes,
    assignedEventIds,
    missingEventIds,
    duplicatedEventIds,
    status: blockers.length === 0 ? "passed" as const : "blocked" as const,
    blockers: unique(blockers),
    warnings: unique(warnings),
  };
}
