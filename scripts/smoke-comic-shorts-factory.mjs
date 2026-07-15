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
  const isRelationship = /relationship|relacao/i.test(categoryText);
  return buildMockPanel({
    panelId: id,
    pageNumber,
    panelNumber: pageNumber,
    readingOrder: pageNumber,
    sourcePagePath: join(projectRoot, "tmp", `factory-page-${pageNumber}.jpg`),
    panelImagePath: join(projectRoot, "tmp", `factory-panel-${id}.jpg`),
    panelImageSha256: `${id}-sha256`.padEnd(64, "c"),
    sequenceId,
    storyFunction,
    parentContext: {
      comicTitle: "Factory Test Comic",
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
      relationships: [{ type: isFight ? "conflict" : isRelationship ? "conversation" : "host_symbiote", entities: ["hero", "villain"], confidence: 0.86 }],
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
    buildComicIngestionPlan
  } = beast;

  const panels = [];
  for (let i = 1; i <= 5; i += 1) panels.push(makePanel(buildMockPanel, `fight-${i}`, i, "fight-seq", i === 5 ? "climax" : "action", "fight luta boom"));
  for (let i = 6; i <= 10; i += 1) panels.push(makePanel(buildMockPanel, `rel-${i}`, i, "rel-seq", i === 10 ? "reaction" : "dialogue", "relationship relacao curiosidade"));
  for (let i = 11; i <= 15; i += 1) panels.push(makePanel(buildMockPanel, `reveal-${i}`, i, "reveal-seq", i === 13 ? "reveal" : "transformation", "reveal origem transformacao"));

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
      assetDirectory: join(projectRoot, "storage", "assets", "comics", "factory-test"),
      generatedAt: new Date().toISOString(),
      sourcePageCount: pages.length,
      panelCount: panels.length,
      validPanelCount: panels.length,
      rejectedPanelCount: 0,
      sequenceCount: 3,
      pages
    },
    maxOpportunities: 40,
    minScore: 50
  });

  const batch = buildComicShortsBatchFactoryPlan({ minerReport, targetCount: 6, minScore: 60 });
  const ingestion = buildComicIngestionPlan({ sourcePath: "C:/comics/test.pdf" });

  assert(ingestion.sourceType === "pdf", "expected pdf ingestion plan");
  assert(batch.selectedCount > 0, "expected selected shorts");
  assert(batch.shorts.every((short) => short.scenes.length > 0), "each short needs scenes");
  assert(batch.shorts.every((short) => short.narrationScript.length > 20), "each short needs narration");
  assert(batch.shorts.every((short) => short.qualityReport.hasHook), "each short needs hook");
  assert(batch.candidateFirst && batch.requiresManualApproval, "factory must stay candidate-first");

  console.log(JSON.stringify({
    status: "completed",
    requestedCount: batch.requestedCount,
    selectedCount: batch.selectedCount,
    firstShort: batch.shorts[0].title,
    firstDuration: batch.shorts[0].estimatedDurationSeconds,
    firstSceneCount: batch.shorts[0].scenes.length,
    ingestionSourceType: ingestion.sourceType,
    candidateFirst: batch.candidateFirst
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
