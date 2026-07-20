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
    panelId: `bank-i${issue}-${id}`,
    pageNumber,
    panelNumber: Number(id.split("-").at(-1) ?? pageNumber),
    readingOrder: pageNumber * 10 + Number(id.split("-").at(-1) ?? 1),
    sourcePagePath: join(projectRoot, "tmp", `bank-i${issue}-page-${pageNumber}.jpg`),
    panelImagePath: join(projectRoot, "tmp", `bank-i${issue}-panel-${id}.jpg`),
    panelImageSha256: `bank-i${issue}-${id}-sha256`.padEnd(64, "b"),
    sequenceId: `bank-i${issue}-seq-${Math.ceil(pageNumber / 4)}`,
    previousPanelId: null,
    nextPanelId: null,
    storyFunction,
    parentContext: {
      comicTitle: "Justice League vs Godzilla vs Kong Story Bank Test",
      issueTitle: `Issue #${issue}`,
      pageTitle: `Issue ${issue} Page ${pageNumber}`,
      parentTags: ["justice league", "godzilla", "superman", "kaiju", "kong", "lore"],
      parentEntities: ["justice_league", "godzilla", "superman", "kong"]
    },
    localEvidence: evidence,
    quality: overrides.quality ?? { visualQualityScore: 88, cropability916Score: 84, textHeavyRatio: 0.2 },
    confidence: overrides.confidence ?? {
      segmentation: 0.9,
      characters: 0.88,
      actions: 0.86,
      relationships: 0.82,
      text: 0.76,
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
    visualThemes: ["hero_team", "kaiju_crossover", focus, "lore_context"],
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
    relationships: [{ type: "alliance tension", entities: ["justice_league", "godzilla"], confidence: 0.88 }],
    detectedText: ["Plano B?"],
    dialogue: ["Entao esse e o nosso problema agora."],
    narrationBoxes: ["A reacao deixa claro que a luta esta so comecando."],
    soundEffects: ["ROAR"],
    visualThemes: ["reaction", "monster_battle", "cliffhanger", focus],
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
    sourceAssetId: `bank-issue-${issue}-page-${panel.pageNumber}`,
    sourcePagePath: panel.sourcePagePath,
    sourceContentHash: `bank-issue-${issue}-hash-${panel.pageNumber}`,
    pageNumber: panel.pageNumber,
    pageType: "story",
    indexable: true,
    parentContext: panel.parentContext,
    panels: [panel]
  }));
  const index = {
    version: 3,
    assetDirectory: join(projectRoot, "storage", "assets", "comics", `story-bank-test-${issue}`),
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
  const { buildComicSagaNarrativeMap, buildComicHQWideStoryBank } = beast;
  const issues = [
    { issueNumber: 1, title: "Issue #1 - A ameaca aparece", report: makeIssueReport(beast, 1, "godzilla_arrival") },
    { issueNumber: 2, title: "Issue #2 - Kong entra na guerra", report: makeIssueReport(beast, 2, "kong_arrival") },
    { issueNumber: 3, title: "Issue #3 - Heróis contra titas", report: makeIssueReport(beast, 3, "titan_standoff") }
  ];
  const sagaMap = buildComicSagaNarrativeMap({ title: "Justice League vs Godzilla vs Kong", issues });
  const storyBank = buildComicHQWideStoryBank({ sagaMap, maxProductionPlanItems: 12 });

  assert(storyBank.bankId === "comic_hq_wide_story_bank_v1", "expected story bank id");
  assert(storyBank.totalIdeaCount >= sagaMap.recommendedShorts.length, "expected broad bank to include saga candidates");
  assert(storyBank.readyIdeaCount > 0, "expected ready or reviewable ideas");
  assert(storyBank.buckets.battle.ideaCount > 0, "expected battle ideas");
  assert(storyBank.buckets.curiosity.ideaCount > 0, "expected curiosity ideas");
  assert(storyBank.buckets.story_explainer.ideaCount > 0, "expected story explainer ideas");
  assert(storyBank.productionMiningPlan.length >= 3, "expected production mining plan");
  assert(storyBank.qualityGates.canGenerateShortBatch, "expected bank to support short batch");
  assert(storyBank.candidateFirst && storyBank.requiresManualApproval, "expected candidate-first manual approval");

  console.log(JSON.stringify({
    status: "completed",
    sagaTitle: storyBank.sagaTitle,
    totalIdeaCount: storyBank.totalIdeaCount,
    readyIdeaCount: storyBank.readyIdeaCount,
    whatItCanMine: storyBank.whatItCanMine,
    qualityGates: storyBank.qualityGates,
    bucketSummary: Object.fromEntries(Object.entries(storyBank.buckets).map(([category, bucket]) => [category, {
      ideaCount: bucket.ideaCount,
      readyCount: bucket.readyCount,
      strongestIdeaId: bucket.strongestIdeaId,
      warnings: bucket.warnings
    }])),
    productionMiningPlan: storyBank.productionMiningPlan.slice(0, 8),
    topIdeas: storyBank.topIdeas.slice(0, 5).map((idea) => ({
      id: idea.id,
      category: idea.category,
      title: idea.title,
      issueNumber: idea.issueNumber,
      pages: idea.pages,
      score: idea.score,
      readiness: idea.readiness
    })),
    warnings: storyBank.warnings
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});