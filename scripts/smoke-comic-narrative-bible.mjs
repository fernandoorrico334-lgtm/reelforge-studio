import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { narrativeBibleInput, episodeDefinitions } from "./comic-saga-configs/batman-white-knight-narrative-bible.mjs";

const root = resolve(decodeURIComponent(new URL("..", import.meta.url).pathname).replace(/^\/(.:)/, "$1"));
const bibleEngine = await import(pathToFileURL(join(root, "packages/media-beast/dist/pipeline/comic-narrative-bible-engine.js")).href);
const episodePlanner = await import(pathToFileURL(join(root, "packages/media-beast/dist/pipeline/comic-narrative-episode-planner.js")).href);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const bible = bibleEngine.buildComicNarrativeBible(narrativeBibleInput);
assert(bible.gate.status === "passed", `Narrative Bible blocked: ${bible.gate.blockers.join(", ")}`);
assert(bible.coverage.missingStoryPages.length === 0, "Every story page must belong to a narrative event.");
assert(bible.events.some((event) => event.eventId === "joker-becomes-jack"), "Medication origin event is missing.");
assert(bible.events.some((event) => event.eventId === "nightwing-breaks-with-batman"), "Nightwing conflict is missing.");
assert(bible.events.some((event) => event.eventId === "gotham-becomes-war-zone"), "War causality event is missing.");

const plan = episodePlanner.buildComicNarrativeEpisodePlan({ bible, episodes: episodeDefinitions, maximumEpisodeDurationSeconds: 180, targetWordsPerMinute: 160 });
assert(plan.status === "passed", `Episode plan blocked: ${plan.blockers.join(", ")}`);
assert(plan.episodeCount === 4, "White Knight must be split into four detailed episodes.");
assert(plan.episodes.every((episode) => episode.estimatedDurationSeconds <= 180), "Episode exceeds three-minute limit.");
assert(plan.missingEventIds.length === 0, "A required event was omitted from the series.");
assert(plan.duplicatedEventIds.length === 0, "An event was repeated across episodes.");

const brokenNarration = narrativeBibleInput.events.map((event) => ({
  beatId: event.beatIds[0],
  narrationText: event.eventId === "joker-becomes-jack" ? "O Coringa virou Jack Napier." : event.narrationText,
}));
const brokenCoverage = bibleEngine.evaluateComicNarrativeCoverage({ bible, narrationBeats: brokenNarration });
assert(brokenCoverage.status === "blocked", "The gate must reject narration that removes the medication cause.");
assert(brokenCoverage.missingCriticalFacts.some((fact) => fact.eventId === "joker-becomes-jack"), "Medication omission was not identified.");

console.log(JSON.stringify({
  status: "completed",
  bibleId: bible.bibleId,
  bibleScore: bible.gate.score,
  storyPageCount: bible.coverage.storyPageCount,
  coveredStoryPageCount: bible.coverage.coveredStoryPageCount,
  criticalFactCount: bible.coverage.criticalFactCount,
  episodeCount: plan.episodeCount,
  episodes: plan.episodes.map((episode) => ({
    episodeId: episode.episodeId,
    title: episode.title,
    issueNumbers: episode.issueNumbers,
    eventCount: episode.eventIds.length,
    wordCount: episode.wordCount,
    estimatedDurationSeconds: episode.estimatedDurationSeconds,
    status: episode.gate.status,
  })),
  regressionGate: {
    removedFact: "medication_causes_jack_lucidity",
    status: brokenCoverage.status,
    missingCriticalFacts: brokenCoverage.missingCriticalFacts.map((fact) => fact.factId),
  },
}, null, 2));
