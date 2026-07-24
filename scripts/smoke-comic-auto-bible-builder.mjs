import assert from "node:assert/strict";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const beast = await import(pathToFileURL(join(root, "packages/media-beast/dist/index.js")).href);

function section(role, start, end, summary, conflictSignal, chars, themes, score = 82) {
  return {
    role,
    title: summary,
    pageRange: { start, end },
    pages: Array.from({ length: end - start + 1 }, (_, index) => start + index),
    summary,
    conflictSignal,
    dominantCharacters: chars,
    dominantThemes: themes,
    strongestPanels: [],
    dialogueSamples: [conflictSignal],
    visualEvidence: { actionPageCount: 2, dialoguePageCount: 2, revealPageCount: 1, soundEffectCount: 1 },
    shortPotentialScore: score,
    warnings: []
  };
}

function issueMap(issueNumber, title, character, theme) {
  const sections = [
    section("opening", 4, 8, `${character} encara o primeiro sinal do problema`, `A cidade percebe que ${theme} nao e um detalhe pequeno.`, [character], [theme, "gotham"], 84),
    section("inciting_incident", 9, 13, `${character} encontra uma pista que muda a investigacao`, `A pista revela uma consequencia escondida.`, [character, "jack napier"], [theme, "revelacao"], 88),
    section("conflict_escalation", 14, 18, `A tensao cresce e Gotham escolhe um lado`, `O conflito deixa de ser pessoal e vira publico.`, [character, "gotham"], [theme, "conflito"], 90),
    section("climax", 19, 23, `A decisao final da edicao coloca todos em risco`, `A virada obriga a proxima parte a responder quem tem razao.`, [character, "jack napier"], [theme, "virada"], 92)
  ];
  return {
    issueId: `issue-${issueNumber}`,
    issueNumber,
    title,
    sourcePath: null,
    map: {
      mapId: "comic_issue_narrative_map_v1",
      generatedAt: new Date().toISOString(),
      source: {
        assetDirectory: `storage/assets/comics/mock-${issueNumber}`,
        comicTitles: [title],
        issueTitles: [title]
      },
      issueOverview: {
        title,
        pageCount: 24,
        narrativePageCount: 20,
        panelCount: 80,
        estimatedShortsAvailable: 3,
        mainCharacters: [character, "jack napier", "gotham"],
        mainThemes: [theme, "moralidade", "consequencia"],
        centralConflict: `${character} precisa entender se o vilao realmente mudou ou se Gotham esta sendo enganada.`,
        beginning: `${character} entra na historia tentando controlar o caos.`,
        middle: `Jack Napier transforma a cidade em tribunal contra o metodo do heroi.`,
        ending: `A edicao termina deixando uma pergunta aberta sobre quem realmente protege Gotham.`
      },
      sections,
      storyCandidates: [],
      curiosities: [],
      recommendedShorts: [],
      productionStrategy: {
        firstShortId: null,
        productionOrder: [],
        minimumDurationSeconds: 40,
        recommendedMinimumPageSpan: 15,
        recommendedBatchSize: 2,
        notes: []
      },
      coverage: {
        pagesCovered: sections.flatMap((item) => item.pages),
        missingNarrativePages: [],
        pagesWithNoStrongShort: [],
        panelIdsCovered: []
      },
      qualityGates: {
        hasBeginningMiddleEnd: true,
        hasClearConflict: true,
        hasCuriosities: true,
        hasAtLeastOneReadyShort: true,
        canAttemptAutomatedShort: true,
        blockers: []
      },
      warnings: [],
      candidateFirst: true,
      requiresManualApproval: true
    }
  };
}

const sagaMap = {
  mapId: "comic_saga_narrative_map_v1",
  generatedAt: new Date().toISOString(),
  sagaOverview: {
    title: "Batman White Knight Auto Bible Smoke",
    issueCount: 3,
    totalPages: 72,
    totalPanels: 240,
    estimatedShortsAvailable: 9,
    mainCharacters: ["batman", "jack napier", "gotham"],
    mainThemes: ["redencao", "controle", "politica"],
    centralPremise: "Batman precisa encarar uma Gotham que passa a enxergar Jack Napier como salvador.",
    beginning: "Batman perde o controle enquanto tenta parar o Coringa.",
    middle: "Jack usa sua lucidez para expor o custo da guerra de Batman.",
    ending: "Gotham percebe que o heroi e o vilao deixaram consequencias impossiveis de ignorar."
  },
  issueMaps: [
    issueMap(1, "Issue 1", "batman", "redencao"),
    issueMap(2, "Issue 2", "jack napier", "politica"),
    issueMap(3, "Issue 3", "gotham", "controle")
  ],
  timeline: [],
  storylines: [],
  recommendedShorts: [],
  whatSystemSees: {
    pageAndPanelCoverage: "mock",
    chronologyUnderstanding: "mock chronological",
    storyUnderstanding: "mock story",
    visualUnderstanding: "mock visual",
    dialogueUnderstanding: "mock dialogue",
    confidence: "high",
    currentBlindSpots: []
  },
  qualityGates: {
    hasMultipleIssues: true,
    hasChronologicalTimeline: true,
    hasReadyShorts: true,
    hasSeriesStorylines: true,
    canAttemptAutomatedSeriesShort: true,
    blockers: []
  },
  warnings: [],
  candidateFirst: true,
  requiresManualApproval: true
};
sagaMap.timeline = sagaMap.issueMaps.flatMap((issue) => issue.map.sections.map((section) => ({
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
  warnings: []
})));
sagaMap.recommendedShorts = sagaMap.timeline.map((entry, index) => ({
  id: `candidate-${index + 1}`,
  title: entry.summary,
  issueId: entry.issueId,
  issueNumber: entry.issueNumber,
  issueTitle: entry.issueTitle,
  localCandidateId: `local-${index + 1}`,
  source: "page_section",
  pages: entry.localPages,
  panelIds: entry.localPages.map((page) => `panel-${entry.issueNumber}-${page}`),
  characters: entry.dominantCharacters,
  themes: entry.dominantThemes,
  hook: `E se ${entry.dominantCharacters[0]} estivesse olhando para o problema errado?`,
  conflict: entry.conflictSignal,
  middle: entry.summary,
  payoff: `Essa virada explica por que a proxima pagina importa.`,
  estimatedDurationSeconds: 42,
  score: entry.shortPotentialScore,
  readiness: "ready_for_short",
  chronology: { startsAfterIssue: entry.issueNumber, localPageStart: entry.pageRange.start, localPageEnd: entry.pageRange.end },
  reasons: ["mock_auto_bible_candidate"],
  warnings: []
}));

const report = beast.buildComicAutoBibleFromSagaMap({ sagaMap, targetEventCount: 12, maximumEpisodeDurationSeconds: 180, targetWordsPerMinute: 160 });
assert.equal(report.builderId, "comic_auto_bible_builder_v1");
assert.equal(report.bible.gate.status, "passed");
assert.equal(report.episodePlan.status, "passed");
assert.ok(report.narrativeBibleInput.events.length >= 8);
assert.ok(report.episodeDefinitions.length >= 1);
assert.ok(report.productionGates.some((gate) => gate.renderAllowed));
assert.equal(report.candidateFirst, true);
assert.equal(report.requiresManualApproval, true);

console.log(JSON.stringify({
  status: "completed",
  builderId: report.builderId,
  generatedEventCount: report.whatItUnderstands.generatedEventCount,
  generatedEpisodeCount: report.whatItUnderstands.generatedEpisodeCount,
  bibleStatus: report.bible.gate.status,
  episodePlanStatus: report.episodePlan.status,
  productionReadyEpisodes: report.qualityGates.productionReadyEpisodes,
  scores: report.productionGates.map((gate) => gate.score),
  canFeedOneClickProduction: report.outputContract.canFeedOneClickProduction
}, null, 2));
