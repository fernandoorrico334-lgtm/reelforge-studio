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

function makePanel(buildMockPanel, id, pageNumber, sequenceId, storyFunction, categoryText) {
  const isFight = /fight|luta/i.test(categoryText);
  const isReveal = /reveal|origem|transform/i.test(categoryText);
  return buildMockPanel({
    panelId: id,
    pageNumber,
    panelNumber: pageNumber,
    readingOrder: pageNumber,
    sourcePagePath: join(projectRoot, "tmp", `bridge-page-${pageNumber}.jpg`),
    panelImagePath: join(projectRoot, "tmp", `bridge-panel-${id}.jpg`),
    panelImageSha256: `${id}-sha256`.padEnd(64, "d"),
    sequenceId,
    storyFunction,
    parentContext: {
      comicTitle: "Bridge Test Comic",
      issueTitle: "Issue 1",
      pageTitle: `Page ${pageNumber}`,
      parentTags: ["comic", "authorized"],
      parentEntities: ["hero", "villain"]
    },
    localEvidence: {
      characters: [
        { name: "Hero", confidence: 0.9, evidenceSource: "visual" },
        { name: "Villain", confidence: 0.82, evidenceSource: "visual" }
      ],
      actions: [{ label: isFight ? "fight attack impact" : isReveal ? "reveal transformation origin" : "conversation relationship", confidence: 0.88 }],
      relationships: [{ type: isFight ? "conflict" : "conversation", entities: ["hero", "villain"], confidence: 0.86 }],
      detectedText: [categoryText],
      dialogue: [`dialogue ${categoryText}`],
      narrationBoxes: [`narration ${categoryText}`],
      soundEffects: isFight ? ["BOOM"] : [],
      visualThemes: isFight ? ["rivalry", "comics_source"] : isReveal ? ["origin", "transformation", "comics_source"] : ["relationship", "comics_source"],
      objects: [],
      locations: []
    },
    quality: { visualQualityScore: 88, cropability916Score: 90, textHeavyRatio: 0.12 },
    confidence: {
      segmentation: 0.9,
      characters: 0.9,
      actions: 0.88,
      relationships: 0.86,
      text: 0.8,
      overall: 0.9
    }
  });
}

async function main() {
  const beast = await importMediaBeast();
  const {
    buildMockPanel,
    mineComicStoryVault,
    buildComicShortsBatchFactoryPlan,
    buildComicShortProjectBridgePayload,
    buildComicBatchProjectBridgePayload
  } = beast;

  const panels = [];
  for (let i = 1; i <= 5; i += 1) panels.push(makePanel(buildMockPanel, `fight-${i}`, i, "fight-seq", i === 5 ? "climax" : "action", "fight luta boom"));
  for (let i = 6; i <= 10; i += 1) panels.push(makePanel(buildMockPanel, `reveal-${i}`, i, "reveal-seq", i === 8 ? "reveal" : "transformation", "reveal origem transformacao"));

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

  const minerReport = mineComicStoryVault({
    index: {
      version: 3,
      assetDirectory: join(projectRoot, "storage", "assets", "comics", "bridge-test"),
      generatedAt: new Date().toISOString(),
      sourcePageCount: pages.length,
      panelCount: panels.length,
      validPanelCount: panels.length,
      rejectedPanelCount: 0,
      sequenceCount: 2,
      pages
    },
    maxOpportunities: 20,
    minScore: 50
  });

  const batch = buildComicShortsBatchFactoryPlan({ minerReport, targetCount: 4, minScore: 60 });
  assert(batch.selectedCount > 0, "expected a short batch");

  const projectPayload = buildComicShortProjectBridgePayload({
    short: batch.shorts[0],
    channelId: "channel-comics-test",
    titlePrefix: "HQ Short"
  });
  const batchPayload = buildComicBatchProjectBridgePayload({
    batch,
    channelId: "channel-comics-test",
    maxProjects: 2,
    titlePrefix: "HQ Batch"
  });

  assert(projectPayload.candidateFirst === true, "project payload must stay candidate-first");
  assert(projectPayload.requiresManualApproval === true, "project payload must require manual approval");
  assert(projectPayload.project.status === "SCENE_PLANNING", "project should be scene planning");
  assert(projectPayload.project.channelId === "channel-comics-test", "channel should be propagated");
  assert(projectPayload.project.format === "9:16", "format should be vertical");
  assert(projectPayload.project.musicPresetId, "music preset should be included");
  assert(projectPayload.scenes.length === batch.shorts[0].scenes.length, "scene count should match short plan");
  assert(projectPayload.scenes.every((scene) => scene.visualSourceMode === "asset_only"), "comic scenes should require panel assets");
  assert(projectPayload.scenes.every((scene) => scene.visualRecipe?.includes("comic-short-project-bridge")), "visual recipe should preserve provenance");
  assert(projectPayload.panelAssetManifest.every((entry) => entry.importRequired === true), "panel assets must be manual import candidates");
  assert(projectPayload.qualityChecklist.some((item) => item.id === "manual_rights_review"), "rights checklist is required");
  assert(projectPayload.renderBlueprintHints.zoomPlan.length === projectPayload.scenes.length, "zoom plan should align to scenes");
  assert(batchPayload.projects.length === Math.min(2, batch.selectedCount), "batch bridge should cap projects");
  assert(batchPayload.warnings.includes("no_render_started_automatically"), "batch bridge must not render automatically");

  console.log(JSON.stringify({
    status: "completed",
    shortId: projectPayload.shortId,
    projectTitle: projectPayload.project.title,
    sceneCount: projectPayload.scenes.length,
    panelAssetManifestCount: projectPayload.panelAssetManifest.length,
    firstScene: {
      title: projectPayload.scenes[0].title,
      emotion: projectPayload.scenes[0].emotion,
      visualSourceMode: projectPayload.scenes[0].visualSourceMode,
      captionStyle: projectPayload.scenes[0].captionStyle,
      zoom: projectPayload.renderBlueprintHints.zoomPlan[0]
    },
    batchProjectCount: batchPayload.projects.length,
    candidateFirst: projectPayload.candidateFirst,
    requiresManualApproval: projectPayload.requiresManualApproval
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
