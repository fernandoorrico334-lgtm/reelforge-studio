import base from "./batman-white-knight-issues-01-08.mjs";
import { narrativeBibleInput, episodeDefinitions } from "./batman-white-knight-narrative-bible.mjs";
import { buildCoverageRichComicNarration } from "../../packages/media-beast/dist/index.js";

const requestedEpisode = Number.parseInt(process.env.COMIC_SAGA_EPISODE ?? "1", 10);
const episodeIndex = Number.isFinite(requestedEpisode) ? requestedEpisode - 1 : 0;
const episode = episodeDefinitions[episodeIndex];
if (!episode) throw new Error(`Unknown COMIC_SAGA_EPISODE=${process.env.COMIC_SAGA_EPISODE}. Expected 1-${episodeDefinitions.length}.`);

const eventById = new Map(narrativeBibleInput.events.map((event) => [event.eventId, event]));
const selectedEvents = episode.eventIds.map((eventId) => eventById.get(eventId));
if (selectedEvents.some((event) => !event)) throw new Error(`Episode ${episode.episodeId} references an unknown narrative event.`);
const issueNumbers = [...new Set(selectedEvents.map((event) => event.issueNumber))];
const issueRanges = base.issueRanges.filter((range) => issueNumbers.includes(range.issueNumber));
const baseBeatIndexes = selectedEvents.map((event) => Number.parseInt(event.beatIds[0].replace("saga-beat-", ""), 10) - 1);
const enrichedNarrationByEventId = new Map(selectedEvents.map((event) => [event.eventId, buildCoverageRichComicNarration({ event, bible: narrativeBibleInput, maxAddedSentences: 2 })]));

const beats = selectedEvents.map((event, index) => ({
  ...base.beats[baseBeatIndexes[index]],
  spokenText: enrichedNarrationByEventId.get(event.eventId) ?? event.narrationText,
  issueNumber: event.issueNumber,
  pages: event.pageNumbers,
  headline: event.title.toLocaleUpperCase("pt-BR"),
  weight: 1,
}));

const cinematicNarration = selectedEvents.map((event, index) => ({
  ...(base.cinematicNarration[baseBeatIndexes[index]] ?? {}),
  cinematicLine: enrichedNarrationByEventId.get(event.eventId) ?? event.narrationText,
  characterIntent: event.motivation,
  hiddenInformation: event.facts[0].statement,
  stakes: event.consequences[0] ? `Este acontecimento provoca ${event.consequences[0].replace(/-/g, " ")}.` : "O desfecho da saga depende desta escolha.",
}));

const visualCueOverrides = selectedEvents.map((event, index) => [index, event.visualCues?.length
  ? event.visualCues
  : [{
      text: event.narrationText,
      pages: event.pageNumbers,
      focusTarget: event.visualTargets[0],
    }],
]);

const issueTransitionEvidence = episode.issueTransitionEvidence ?? issueNumbers.slice(0, -1).map((issueNumber, index) => ({
  fromIssueNumber: issueNumber,
  toIssueNumber: issueNumbers[index + 1],
  previousConflictTerms: selectedEvents.filter((event) => event.issueNumber === issueNumber).at(-1).actors.slice(0, 1).map((actor) => actor.split(" ")[0]),
  causalBridgeTerms: ["porque", "por isso", "quando", "enquanto", "com"],
  newConflictTerms: selectedEvents.find((event) => event.issueNumber === issueNumbers[index + 1]).actors.slice(0, 1).map((actor) => actor.split(" ")[0]),
}));

export default {
  ...base,
  outputSlug: `${episode.episodeId}-narrative-bible`,
  coldOpenPage: episode.coldOpenPage ?? base.coldOpenPage,
  expectedIssueCount: issueRanges.length,
  isComplete: true,
  issueRanges,
  beats,
  cinematicNarration,
  visualCueOverrides,
  issueTransitionEvidence,
  requireVerifiedVisualContract: true,
  temporalHook: {
    ...base.temporalHook,
    hookNarration: episode.hook,
    setupNarration: episode.context,
    hookHeadline: episode.hookHeadline ?? episode.title.toLocaleUpperCase("pt-BR"),
    visualPromiseTerms: episode.visualPromiseTerms ?? selectedEvents[0].actors,
    contextAnchors: episode.contextAnchors ?? selectedEvents[0].actors.slice(0, 2).map((entity) => ({ entity, explanationTerms: [entity] })),
    rewindLabel: episode.rewindLabel ?? base.temporalHook.rewindLabel,
  },
  curiosityQuestions: [{
    questionId: `${episode.episodeId}-central-question`,
    question: episode.hook,
    type: "how",
    openedAtBeatId: "saga-beat-1",
    partialAnswerBeatIds: selectedEvents.slice(1, -1).map((_, index) => `saga-beat-${index + 2}`),
    payoffBeatId: `saga-beat-${selectedEvents.length}`,
    payoff: episode.payoff,
    evidenceBeatIds: selectedEvents.map((_, index) => `saga-beat-${index + 1}`),
    isMacroQuestion: true,
    truthConfidence: 96,
  }],
  narrativeBibleInput,
  narrativeEpisode: episode,
};
