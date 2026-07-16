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

function makePanel(buildMockPanel, id, pageNumber, role, options = {}) {
  return buildMockPanel({
    panelId: id,
    pageNumber,
    panelNumber: pageNumber,
    readingOrder: pageNumber,
    sourcePagePath: join(projectRoot, "tmp", `moment-page-${pageNumber}.jpg`),
    panelImagePath: join(projectRoot, "tmp", `moment-panel-${id}.jpg`),
    panelImageSha256: `${id}-sha256`.padEnd(64, "m"),
    sequenceId: "moment-godzilla-seq",
    storyFunction: role,
    parentContext: {
      comicTitle: "Superman vs Godzilla Test Comic",
      issueTitle: "Issue 1",
      pageTitle: `Page ${pageNumber}`,
      parentTags: ["comic", "authorized", "godzilla", "superman"],
      parentEntities: ["Superman", "Godzilla", "Kong", "Batman"]
    },
    localEvidence: {
      characters: [
        { name: "Superman", confidence: 0.95, evidenceSource: "visual" },
        { name: "Godzilla", confidence: 0.94, evidenceSource: "visual" }
      ],
      actions: [{ label: options.action ?? "Godzilla blast impact against Superman", confidence: 0.95 }],
      relationships: [{ type: "conflict", entities: ["Superman", "Godzilla"], confidence: 0.94 }],
      detectedText: options.text ? [options.text] : [],
      dialogue: options.dialogue ? [options.dialogue] : [],
      narrationBoxes: options.narrationBox ? [options.narrationBox] : [],
      soundEffects: role === "climax" || options.sfx ? [options.sfx ?? "BOOM"] : ["WHOOSH"],
      visualThemes: ["impact", "monster", "superhero", "comics_source"],
      objects: [],
      locations: [{ label: "destroyed city", confidence: 0.82 }]
    },
    quality: { visualQualityScore: 94, cropability916Score: 95, textHeavyRatio: options.textHeavyRatio ?? 0.12 },
    confidence: {
      segmentation: 0.94,
      characters: 0.95,
      actions: 0.95,
      relationships: 0.94,
      text: options.text ? 0.9 : 0.55,
      overall: 0.94
    }
  });
}

async function main() {
  const beast = await importMediaBeast();
  const {
    buildMockPanel,
    mineComicStoryVault,
    buildComicShortsBatchFactoryPlan,
    selectComicPanelMoments,
    buildComicShortProjectBridgePayload
  } = beast;

  const panels = [
    makePanel(buildMockPanel, "moment-1", 1, "setup", { action: "Godzilla arrives as Superman sees the threat", dialogue: "Isso nao e uma batalha comum", text: "SUPERMAN VS GODZILLA" }),
    makePanel(buildMockPanel, "moment-2", 2, "dialogue", { dialogue: "Se ele cair aqui, a cidade inteira cai junto", text: "A cidade inteira cai", textHeavyRatio: 0.28 }),
    makePanel(buildMockPanel, "moment-3", 3, "action", { action: "Superman punches Godzilla through smoke", sfx: "KRAK" }),
    makePanel(buildMockPanel, "moment-4", 4, "climax", { action: "Godzilla blast hits Superman in the chest", sfx: "BOOM" }),
    makePanel(buildMockPanel, "moment-5", 5, "reaction", { action: "Batman watches shocked after the impact", dialogue: "Ele aguentou isso?" })
  ];

  const pages = panels.map((panel) => ({
    sourceAssetId: `moment-page-${panel.pageNumber}`,
    sourcePagePath: panel.sourcePagePath,
    sourceContentHash: `moment-hash-${panel.pageNumber}`,
    pageNumber: panel.pageNumber,
    pageType: "story",
    indexable: true,
    parentContext: panel.parentContext,
    panels: [panel]
  }));

  const minerReport = mineComicStoryVault({
    index: {
      version: 3,
      assetDirectory: join(projectRoot, "storage", "assets", "comics", "moment-test"),
      generatedAt: new Date().toISOString(),
      sourcePageCount: pages.length,
      panelCount: panels.length,
      validPanelCount: panels.length,
      rejectedPanelCount: 0,
      sequenceCount: 1,
      pages
    },
    maxOpportunities: 5,
    minScore: 50
  });

  const batch = buildComicShortsBatchFactoryPlan({ minerReport, targetCount: 1, minScore: 60 });
  const short = batch.shorts[0];
  assert(short, "expected comic short");
  assert(short.estimatedDurationSeconds >= 30, "short must stay at least 30s");

  const report = selectComicPanelMoments({ short });
  assert(report.selectorId === "comic_panel_moment_selector_v1", "expected selector id");
  assert(report.selectedMoments.length === short.scenes.length, "expected one selected moment per scene");
  assert(report.averageMomentScore >= 72, `expected premium-ish moment score, got ${report.averageMomentScore}`);
  assert(report.selectedMoments.some((moment) => moment.type === "action_impact"), "expected action moment");
  assert(report.selectedMoments.some((moment) => moment.type === "speech_balloon"), "expected speech balloon moment");

  const bridge = buildComicShortProjectBridgePayload({ short, channelId: "channel-moment-selector-test" });
  assert(bridge.renderBlueprintHints.panelMomentSelector.selectorId === "comic_panel_moment_selector_v1", "bridge should expose panel moment selector");
  assert(bridge.warnings.includes("comic_panel_moment_selector_applied"), "bridge should mark moment selector applied");
  const recipe = JSON.parse(bridge.scenes[0].visualRecipe ?? "{}");
  assert(recipe.selectedPanelMoment, "visual recipe should include selectedPanelMoment");

  console.log(JSON.stringify({
    status: "completed",
    shortId: short.id,
    durationSeconds: short.estimatedDurationSeconds,
    averageMomentScore: report.averageMomentScore,
    selectedMoments: report.selectedMoments.map((moment) => ({
      sceneOrder: moment.sceneOrder,
      panelId: moment.panelId,
      type: moment.type,
      score: moment.score,
      cutIntent: moment.cutIntent,
      crop: moment.normalizedCrop,
      hold: moment.recommendedHoldSeconds,
      reasons: moment.reasons.slice(0, 4)
    })),
    bridgeHasSelector: Boolean(bridge.renderBlueprintHints.panelMomentSelector),
    warnings: report.warnings
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
