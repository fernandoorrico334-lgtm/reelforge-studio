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

function makePanel(buildMockPanel, id, issue, pageNumber, storyFunction, evidence, overrides = {}) {
  return buildMockPanel({
    panelId: `i${issue}-${id}`,
    pageNumber,
    panelNumber: Number(id.split("-").at(-1) ?? pageNumber),
    readingOrder: pageNumber * 10 + Number(id.split("-").at(-1) ?? 1),
    sourcePagePath: join(projectRoot, "tmp", `saga-i${issue}-page-${pageNumber}.jpg`),
    panelImagePath: join(projectRoot, "tmp", `saga-i${issue}-panel-${id}.jpg`),
    panelImageSha256: `saga-i${issue}-${id}-sha256`.padEnd(64, "d"),
    sequenceId: `saga-i${issue}-seq-${Math.ceil(pageNumber / 4)}`,
    previousPanelId: null,
    nextPanelId: null,
    storyFunction,
    parentContext: {
      comicTitle: "Justice League vs Godzilla vs Kong Test Saga",
      issueTitle: `Issue #${issue}`,
      pageTitle: `Issue ${issue} Page ${pageNumber}`,
      parentTags: ["justice league", "godzilla", "superman", "kaiju", "kong"],
      parentEntities: ["justice_league", "godzilla", "superman", "kong"]
    },
    localEvidence: evidence,
    quality: overrides.quality ?? { visualQualityScore: 88, cropability916Score: 84, textHeavyRatio: 0.22 },
    confidence: overrides.confidence ?? {
      segmentation: 0.9,
      characters: 0.88,
      actions: 0.86,
      relationships: 0.82,
      text: 0.74,
      overall: 0.86
    },
    ...overrides
  });
}

function makeIssueReport(beast, issue, focus) {
  const { buildMockPanel, mineComicStoryVault } = beast;
  const setupEvidence = {
    characters: [{ name: "superman", confidence: 0.9, evidenceSource: "visual" }],
    actions: [{ label: "heroes discover kaiju threat", confidence: 0.72 }],
    relationships: [{ type: "conversation", entities: ["superman", "justice_league"], confidence: 0.78 }],
    detectedText: ["Isso nao e normal"],
    dialogue: ["A ameaca esta crescendo."],
    narrationBoxes: ["A Liga entende que a crise saiu do controle."],
    soundEffects: [],
    visualThemes: ["hero_team", "kaiju_crossover", focus],
    objects: [],
    locations: ["city"]
  };
  const actionEvidence = {
    characters: [
      { name: "superman", confidence: 0.9, evidenceSource: "visual" },
      { name: focus === "kong_arrival" ? "kong" : "godzilla", confidence: 0.94, evidenceSource: "visual" }
    ],
    actions: [{ label: "titan impact battle city destruction", confidence: 0.94 }],
    relationships: [{ type: "conflict", entities: ["superman", focus === "kong_arrival" ? "kong" : "godzilla"], confidence: 0.94 }],
    detectedText: ["KRAKOOM"],
    dialogue: ["Segura ele!"],
    narrationBoxes: ["O confronto muda a escala da batalha."],
    soundEffects: ["KRAKOOM", "BOOM"],
    visualThemes: ["monster_battle", "titan_standoff", focus],
    objects: ["buildings"],
    locations: ["city"]
  };
  const payoffEvidence = {
    characters: [
      { name: "justice_league", confidence: 0.88, evidenceSource: "visual" },
      { name: "godzilla", confidence: 0.9, evidenceSource: "visual" }
    ],
    actions: [{ label: "heroes react to impossible scale", confidence: 0.82 }],
    relationships: [{ type: "conflict", entities: ["justice_league", "godzilla"], confidence: 0.88 }],
    detectedText: ["Plano B?"],
    dialogue: ["Entao esse e o nosso problema agora."],
    narrationBoxes: ["A reacao deixa claro que a luta esta so comecando."],
    soundEffects: ["ROAR"],
    visualThemes: ["reaction", "monster_battle", focus],
    objects: [],
    locations: ["city"]
  };

  const panels = [
    makePanel(buildMockPanel, "setup-1", issue, 1, "setup", setupEvidence),
    makePanel(buildMockPanel, "setup-2", issue, 2, "dialogue", setupEvidence),
    makePanel(buildMockPanel, "action-1", issue, 3, "action", actionEvidence),
    makePanel(buildMockPanel, "action-2", issue, 4, "climax", actionEvidence),
    makePanel(buildMockPanel, "payoff-1", issue, 5, "reaction", payoffEvidence),
    makePanel(buildMockPanel, "payoff-2", issue, 6, "reveal", payoffEvidence)
  ];
  const pages = panels.map((panel) => ({
    sourceAssetId: `issue-${issue}-page-${panel.pageNumber}`,
    sourcePagePath: panel.sourcePagePath,
    sourceContentHash: `issue-${issue}-hash-${panel.pageNumber}`,
    pageNumber: panel.pageNumber,
    pageType: "story",
    indexable: true,
    parentContext: panel.parentContext,
    panels: [panel]
  }));
  const index = {
    version: 3,
    assetDirectory: join(projectRoot, "storage", "assets", "comics", `saga-map-test-${issue}`),
    generatedAt: new Date().toISOString(),
    sourcePageCount: pages.length,
    panelCount: panels.length,
    validPanelCount: panels.length,
    rejectedPanelCount: 0,
    sequenceCount: 2,
    pages
  };
  return mineComicStoryVault({ index, maxOpportunities: 30, minScore: 35 });
}

async function main() {
  const beast = await importMediaBeast();
  const { buildComicSagaNarrativeMap } = beast;
  const issues = [
    { issueNumber: 1, title: "Issue #1 - A ameaca aparece", report: makeIssueReport(beast, 1, "godzilla_arrival") },
    { issueNumber: 2, title: "Issue #2 - A escala explode", report: makeIssueReport(beast, 2, "kong_arrival") },
    { issueNumber: 3, title: "Issue #3 - Heróis contra titas", report: makeIssueReport(beast, 3, "titan_standoff") }
  ];
  const sagaMap = buildComicSagaNarrativeMap({ title: "Justice League vs Godzilla vs Kong", issues });

  assert(sagaMap.mapId === "comic_saga_narrative_map_v1", "expected saga map id");
  assert(sagaMap.sagaOverview.issueCount === 3, "expected 3 issues");
  assert(sagaMap.timeline.length >= 6, "expected timeline sections");
  assert(sagaMap.storylines.length > 0, "expected storylines");
  assert(sagaMap.recommendedShorts.length > 0, "expected recommended shorts");
  assert(sagaMap.recommendedShorts[0].estimatedDurationSeconds >= 30, "expected shorts >= 30 seconds");
  assert(sagaMap.whatSystemSees.storyUnderstanding.includes("candidatos"), "expected what-system-sees story summary");
  assert(sagaMap.candidateFirst && sagaMap.requiresManualApproval, "expected candidate-first");

  console.log(JSON.stringify({
    status: "completed",
    overview: sagaMap.sagaOverview,
    whatSystemSees: sagaMap.whatSystemSees,
    qualityGates: sagaMap.qualityGates,
    timelineSample: sagaMap.timeline.slice(0, 5),
    storylines: sagaMap.storylines.slice(0, 3).map((storyline) => ({
      id: storyline.id,
      title: storyline.title,
      issueNumbers: storyline.issueNumbers,
      score: storyline.score,
      readiness: storyline.readiness
    })),
    recommendedShorts: sagaMap.recommendedShorts.slice(0, 5).map((candidate) => ({
      id: candidate.id,
      title: candidate.title,
      issueNumber: candidate.issueNumber,
      pages: candidate.pages,
      score: candidate.score,
      readiness: candidate.readiness
    }))
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});