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

function makePanel(buildMockPanel, id, pageNumber, storyFunction, localEvidence, overrides = {}) {
  return buildMockPanel({
    panelId: id,
    pageNumber,
    panelNumber: Number(id.split("-").at(-1) ?? pageNumber),
    readingOrder: pageNumber * 10 + Number(id.split("-").at(-1) ?? 1),
    sourcePagePath: join(projectRoot, "tmp", `narrative-map-page-${pageNumber}.jpg`),
    panelImagePath: join(projectRoot, "tmp", `narrative-map-panel-${id}.jpg`),
    panelImageSha256: `${id}-sha256`.padEnd(64, "c"),
    sequenceId: overrides.sequenceId ?? `issue-seq-${Math.ceil(pageNumber / 4)}`,
    previousPanelId: overrides.previousPanelId ?? null,
    nextPanelId: overrides.nextPanelId ?? null,
    storyFunction,
    parentContext: {
      comicTitle: "Justice League vs Godzilla vs Kong Test Issue",
      issueTitle: "A Escala do Desastre",
      pageTitle: `Page ${pageNumber}`,
      parentTags: ["justice league", "godzilla", "superman", "kaiju"],
      parentEntities: ["justice_league", "godzilla", "superman"]
    },
    localEvidence,
    quality: overrides.quality ?? { visualQualityScore: 86, cropability916Score: 82, textHeavyRatio: 0.22 },
    confidence: overrides.confidence ?? {
      segmentation: 0.9,
      characters: 0.86,
      actions: 0.84,
      relationships: 0.78,
      text: 0.72,
      overall: 0.84
    },
    ...overrides
  });
}

async function main() {
  const beast = await importMediaBeast();
  const { buildMockPanel, mineComicStoryVault, buildComicIssueNarrativeMap } = beast;

  const setupEvidence = {
    characters: [{ name: "superman", confidence: 0.88, evidenceSource: "visual" }],
    actions: [{ label: "arrival warning", confidence: 0.68 }],
    relationships: [{ type: "conversation", entities: ["superman", "justice_league"], confidence: 0.74 }],
    detectedText: ["Algo esta vindo"],
    dialogue: ["Isso nao e uma ameaca comum."],
    narrationBoxes: ["A Liga percebe que a cidade inteira esta em risco."],
    soundEffects: [],
    visualThemes: ["hero_team", "city_destruction", "kaiju_crossover"],
    objects: [],
    locations: ["city"]
  };
  const conflictEvidence = {
    characters: [
      { name: "godzilla", confidence: 0.92, evidenceSource: "visual" },
      { name: "justice_league", confidence: 0.82, evidenceSource: "visual" }
    ],
    actions: [{ label: "kaiju attack city destruction", confidence: 0.9 }],
    relationships: [{ type: "conflict", entities: ["godzilla", "justice_league"], confidence: 0.9 }],
    detectedText: ["ROAR"],
    dialogue: ["Ele nao vai parar."],
    narrationBoxes: [],
    soundEffects: ["ROAR", "KRAK"],
    visualThemes: ["monster_battle", "city_destruction", "titan_standoff"],
    objects: ["buildings"],
    locations: ["city"]
  };
  const climaxEvidence = {
    characters: [
      { name: "superman", confidence: 0.9, evidenceSource: "visual" },
      { name: "godzilla", confidence: 0.94, evidenceSource: "visual" }
    ],
    actions: [{ label: "superman confronts godzilla impact", confidence: 0.93 }],
    relationships: [{ type: "conflict", entities: ["superman", "godzilla"], confidence: 0.94 }],
    detectedText: ["KRAKOOM"],
    dialogue: ["Eu seguro ele."],
    narrationBoxes: ["O confronto que ninguem esperava finalmente acontece."],
    soundEffects: ["KRAKOOM", "BOOM"],
    visualThemes: ["monster_battle", "hero_team", "titan_standoff"],
    objects: [],
    locations: ["city"]
  };
  const curiosityEvidence = {
    characters: [{ name: "green_lantern", confidence: 0.78, evidenceSource: "visual" }],
    actions: [{ label: "reaction detail", confidence: 0.64 }],
    relationships: [{ type: "conversation", entities: ["green_lantern", "justice_league"], confidence: 0.62 }],
    detectedText: ["Plano B?"],
    dialogue: ["A gente tem um plano B?"],
    narrationBoxes: ["Um detalhe pequeno mostra o medo real dos herois."],
    soundEffects: [],
    visualThemes: ["visual_curiosity", "hero_team", "reaction"],
    objects: [],
    locations: ["city"]
  };

  const panels = [
    makePanel(buildMockPanel, "setup-1", 1, "setup", setupEvidence),
    makePanel(buildMockPanel, "setup-2", 2, "context", setupEvidence),
    makePanel(buildMockPanel, "setup-3", 3, "dialogue", setupEvidence),
    makePanel(buildMockPanel, "conflict-1", 4, "action", conflictEvidence),
    makePanel(buildMockPanel, "conflict-2", 5, "reaction", conflictEvidence),
    makePanel(buildMockPanel, "conflict-3", 6, "action", conflictEvidence),
    makePanel(buildMockPanel, "curiosity-1", 7, "dialogue", curiosityEvidence),
    makePanel(buildMockPanel, "curiosity-2", 8, "reveal", curiosityEvidence),
    makePanel(buildMockPanel, "climax-1", 9, "climax", climaxEvidence),
    makePanel(buildMockPanel, "climax-2", 10, "action", climaxEvidence),
    makePanel(buildMockPanel, "climax-3", 11, "reaction", climaxEvidence),
    makePanel(buildMockPanel, "ending-1", 12, "reveal", climaxEvidence)
  ];

  const pages = panels.map((panel) => ({
    sourceAssetId: `page-${panel.pageNumber}`,
    sourcePagePath: panel.sourcePagePath,
    sourceContentHash: `hash-${panel.pageNumber}`,
    pageNumber: panel.pageNumber,
    pageType: "story",
    indexable: true,
    parentContext: panel.parentContext,
    panels: [panel]
  }));

  const index = {
    version: 3,
    assetDirectory: join(projectRoot, "storage", "assets", "comics", "narrative-map-test"),
    generatedAt: new Date().toISOString(),
    sourcePageCount: pages.length,
    panelCount: panels.length,
    validPanelCount: panels.length,
    rejectedPanelCount: 0,
    sequenceCount: 3,
    pages
  };

  const report = mineComicStoryVault({ index, maxOpportunities: 40, minScore: 40 });
  const map = buildComicIssueNarrativeMap(report);

  assert(map.mapId === "comic_issue_narrative_map_v1", "expected narrative map id");
  assert(map.issueOverview.pageCount === 12, "expected full issue page count");
  assert(map.sections.length >= 3, "expected beginning/middle/end sections");
  assert(map.qualityGates.hasBeginningMiddleEnd, "expected beginning/middle/end gate");
  assert(map.qualityGates.hasClearConflict, "expected clear conflict gate");
  assert(map.curiosities.length > 0, "expected curiosities");
  assert(map.storyCandidates.length > 0, "expected story candidates");
  assert(map.recommendedShorts.length > 0, "expected recommended shorts");
  assert(map.recommendedShorts[0].estimatedDurationSeconds >= 30, "recommended short must be >= 30s");
  assert(map.productionStrategy.firstShortId, "expected first short id");
  assert(map.candidateFirst && map.requiresManualApproval, "expected candidate-first approval");

  console.log(JSON.stringify({
    status: "completed",
    title: map.issueOverview.title,
    centralConflict: map.issueOverview.centralConflict,
    beginning: map.issueOverview.beginning,
    middle: map.issueOverview.middle,
    ending: map.issueOverview.ending,
    sections: map.sections.map((section) => ({ role: section.role, pages: section.pages, score: section.shortPotentialScore })),
    curiosities: map.curiosities.slice(0, 3).map((curiosity) => ({ title: curiosity.title, pages: curiosity.pages, score: curiosity.score })),
    firstShort: map.recommendedShorts[0],
    qualityGates: map.qualityGates,
    productionStrategy: map.productionStrategy
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
