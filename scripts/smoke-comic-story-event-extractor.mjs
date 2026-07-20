import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");

async function importMediaBeast() {
  return import(pathToFileURL(join(projectRoot, "packages/media-beast/dist/index.js")).href);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function makePanel(buildMockPanel, id, pageNumber, storyFunction, evidence, overrides = {}) {
  return buildMockPanel({
    panelId: id,
    pageNumber,
    panelNumber: Number(id.split("-").at(-1) ?? pageNumber),
    readingOrder: pageNumber * 10 + Number(id.split("-").at(-1) ?? 1),
    sourcePagePath: join(projectRoot, "tmp", `event-page-${pageNumber}.jpg`),
    panelImagePath: join(projectRoot, "tmp", `event-panel-${id}.jpg`),
    panelImageSha256: `${id}-sha256`.padEnd(64, "e"),
    sequenceId: `event-seq-${Math.ceil(pageNumber / 4)}`,
    previousPanelId: null,
    nextPanelId: null,
    storyFunction,
    parentContext: {
      comicTitle: "Justice League vs Godzilla vs Kong Event Test",
      issueTitle: "O detalhe e a batalha",
      pageTitle: `Page ${pageNumber}`,
      parentTags: ["justice league", "godzilla", "superman", "kaiju"],
      parentEntities: ["justice_league", "godzilla", "superman"]
    },
    localEvidence: evidence,
    quality: overrides.quality ?? { visualQualityScore: 88, cropability916Score: 84, textHeavyRatio: 0.2 },
    confidence: overrides.confidence ?? {
      segmentation: 0.9,
      characters: 0.88,
      actions: 0.84,
      relationships: 0.82,
      text: 0.82,
      overall: 0.86
    },
    ...overrides
  });
}

async function main() {
  const beast = await importMediaBeast();
  const {
    buildMockPanel,
    mineComicStoryVault,
    buildComicSagaNarrativeMap,
    extractComicStoryEvents,
    mineComicSagaEventOpportunities
  } = beast;

  const curiosityEvidence = {
    characters: [{ name: "superman", confidence: 0.9, evidenceSource: "visual" }],
    actions: [{ label: "notices hidden kaiju signal", confidence: 0.72 }],
    relationships: [{ type: "conversation", entities: ["superman", "justice_league"], confidence: 0.78 }],
    detectedText: ["Voce percebeu o sinal?"],
    dialogue: ["Tem algo chamando o Godzilla."],
    narrationBoxes: ["Um detalhe pequeno revela que a cidade nao foi escolhida por acaso."],
    soundEffects: [],
    visualThemes: ["kaiju_crossover", "hidden_detail", "hero_team"],
    objects: ["signal"],
    locations: ["city"]
  };
  const battleEvidence = {
    characters: [
      { name: "superman", confidence: 0.92, evidenceSource: "visual" },
      { name: "godzilla", confidence: 0.94, evidenceSource: "visual" }
    ],
    actions: [{ label: "superman collides with godzilla blast", confidence: 0.94 }],
    relationships: [{ type: "conflict", entities: ["superman", "godzilla"], confidence: 0.94 }],
    detectedText: ["KRAKOOM"],
    dialogue: ["Eu seguro ele!"],
    narrationBoxes: ["A luta deixa claro que nem Superman controla sozinho essa escala."],
    soundEffects: ["KRAKOOM", "BOOM"],
    visualThemes: ["monster_battle", "titan_standoff", "kaiju_crossover"],
    objects: ["buildings"],
    locations: ["city"]
  };
  const reactionEvidence = {
    characters: [{ name: "justice_league", confidence: 0.9, evidenceSource: "visual" }],
    actions: [{ label: "heroes react to impossible threat", confidence: 0.82 }],
    relationships: [{ type: "conversation", entities: ["justice_league", "godzilla"], confidence: 0.78 }],
    detectedText: ["Plano B?"],
    dialogue: ["A gente tem um plano B?"],
    narrationBoxes: ["A resposta da Liga mostra o tamanho real do problema."],
    soundEffects: ["ROAR"],
    visualThemes: ["reaction", "monster_battle", "hero_team"],
    objects: [],
    locations: ["city"]
  };

  const panels = [
    makePanel(buildMockPanel, "curiosity-1", 1, "setup", curiosityEvidence),
    makePanel(buildMockPanel, "curiosity-2", 2, "dialogue", curiosityEvidence),
    makePanel(buildMockPanel, "curiosity-3", 3, "reveal", curiosityEvidence),
    makePanel(buildMockPanel, "battle-1", 4, "action", battleEvidence),
    makePanel(buildMockPanel, "battle-2", 5, "climax", battleEvidence),
    makePanel(buildMockPanel, "battle-3", 6, "reaction", reactionEvidence),
    makePanel(buildMockPanel, "battle-4", 7, "reveal", reactionEvidence)
  ];
  const pages = panels.map((panel) => ({
    sourceAssetId: `event-page-${panel.pageNumber}`,
    sourcePagePath: panel.sourcePagePath,
    sourceContentHash: `event-hash-${panel.pageNumber}`,
    pageNumber: panel.pageNumber,
    pageType: "story",
    indexable: true,
    parentContext: panel.parentContext,
    panels: [panel]
  }));
  const index = {
    version: 3,
    assetDirectory: join(projectRoot, "storage", "assets", "comics", "event-extractor-test"),
    generatedAt: new Date().toISOString(),
    sourcePageCount: pages.length,
    panelCount: panels.length,
    validPanelCount: panels.length,
    rejectedPanelCount: 0,
    sequenceCount: 2,
    pages
  };

  const report = mineComicStoryVault({ index, maxOpportunities: 40, minScore: 35 });
  const eventReport = extractComicStoryEvents(report);
  const sagaMap = buildComicSagaNarrativeMap({
    title: "Event Test Saga",
    issues: [{ issueNumber: 1, title: "Issue Event Test", report }]
  });
  const sagaEvents = mineComicSagaEventOpportunities({ sagaMap });

  assert(eventReport.extractorId === "comic_story_event_extractor_v1", "expected event extractor id");
  assert(eventReport.eventCount > 0, "expected events");
  assert(eventReport.recommendedShortEvents.length > 0, "expected recommended event shorts");
  assert(eventReport.events.some((event) => event.beats.length >= 4), "expected event beats");
  assert(eventReport.events.some((event) => event.zoomPlan.length >= 4), "expected zoom plan");
  assert(eventReport.events.every((event) => typeof event.editorialTitle === "string" && event.editorialTitle.length > 12), "expected editorial titles");
  assert(eventReport.events.every((event) => typeof event.narrationPreview === "string" && event.narrationPreview.length > 80), "expected narration previews");
  assert(eventReport.events.some((event) => event.languageQualityScore >= 80), "expected strong language quality score");
  assert(eventReport.events.every((event) => typeof event.specificHook === "string" && event.specificHook.length > 24), "expected specific hooks");
  assert(eventReport.events.some((event) => event.keyDialogueLine || event.keyActionLabel), "expected dialogue or action specificity");
  const expandedSelectionIds = new Set(eventReport.diversityPlan.selections.filter((selection) => selection.selectionMode === "expanded").map((selection) => selection.eventId));
  assert(eventReport.recommendedShortEvents.every((event) => !event.duplicateOfEventId || expandedSelectionIds.has(event.id)), "expected duplicates only when marked as expanded diversity selections");
  assert(eventReport.events.some((event) => event.duplicateOfEventId), "expected duplicate events to be annotated");
  assert(eventReport.diversityPlan.plannerId === "comic_short_opportunity_diversity_planner_v1", "expected diversity planner");
  assert(eventReport.diversityPlan.selectedCount === eventReport.recommendedShortEvents.length, "expected diversity selections to drive recommendations");
  assert(Object.values(eventReport.diversityPlan.slotCoverage).some((count) => count > 0), "expected editorial slot coverage");
  assert(Array.isArray(eventReport.diversityPlan.expansionAttempts), "expected diversity expansion attempts");
  assert(eventReport.diversityPlan.expansionAttempts.length >= eventReport.diversityPlan.missingSlots.length, "expected expansion attempt tracking");
  assert(sagaEvents.extractorId === "comic_saga_event_opportunity_miner_v1", "expected saga event miner id");
  assert(sagaEvents.recommendedShorts.length > 0, "expected saga event recommendations");
  assert(sagaEvents.episodePlan.length > 0, "expected episode plan");

  console.log(JSON.stringify({
    status: "completed",
    eventSummary: eventReport.eventSummary,
    eventCount: eventReport.eventCount,
    readyEventCount: eventReport.readyEventCount,
    curiosityEventCount: eventReport.curiosityEventCount,
    storyEventCount: eventReport.storyEventCount,
    duplicateEventCount: eventReport.events.filter((event) => event.duplicateOfEventId).length,
    recommendedUniqueCount: eventReport.recommendedShortEvents.length,
    diversityPlan: eventReport.diversityPlan,
    strongestEvents: eventReport.recommendedShortEvents.slice(0, 5).map((event) => ({
      title: event.title,
      editorialSlot: event.editorialSlot,
      editorialTitle: event.editorialTitle,
      languageQualityScore: event.languageQualityScore,
      specificHook: event.specificHook,
      keyDialogueLine: event.keyDialogueLine,
      keyActionLabel: event.keyActionLabel,
      visualSpecificityScore: event.visualSpecificityScore,
      narrationPreview: event.narrationPreview,
      type: event.type,
      score: event.score,
      readiness: event.readiness,
      shortAngle: event.shortAngle,
      pages: event.pages,
      beats: event.beats.map((beat) => ({ role: beat.role, panelId: beat.panelId, zoom: beat.zoomInstruction }))
    })),
    sagaUnderstanding: sagaEvents.whatSystemUnderstandsNow,
    episodePlan: sagaEvents.episodePlan.slice(0, 5)
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});