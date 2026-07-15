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

function makePanel(buildMockPanel, id, pageNumber, role, actionLabel) {
  return buildMockPanel({
    panelId: id,
    pageNumber,
    panelNumber: pageNumber,
    readingOrder: pageNumber,
    sourcePagePath: join(projectRoot, "tmp", `golden-page-${pageNumber}.jpg`),
    panelImagePath: join(projectRoot, "tmp", `golden-panel-${id}.jpg`),
    panelImageSha256: `${id}-sha256`.padEnd(64, "g"),
    sequenceId: "golden-viral-seq",
    storyFunction: role,
    parentContext: {
      comicTitle: "Golden QA Test Comic",
      issueTitle: "Issue 1",
      pageTitle: `Page ${pageNumber}`,
      parentTags: ["comic", "authorized", "viral"],
      parentEntities: ["Batman", "Superman", "Godzilla", "Kong"]
    },
    localEvidence: {
      characters: [
        { name: "Batman", confidence: 0.94, evidenceSource: "visual" },
        { name: "Godzilla", confidence: 0.91, evidenceSource: "visual" },
        { name: "Kong", confidence: 0.88, evidenceSource: "visual" }
      ],
      actions: [{ label: actionLabel, confidence: 0.94 }],
      relationships: [{ type: "conflict", entities: ["Batman", "Godzilla"], confidence: 0.91 }],
      detectedText: [role === "climax" ? "BOOM IMPACT" : "WHOOSH threat"],
      dialogue: [role === "climax" ? "Ele derrubou todos de uma vez" : "Isso nao era para acontecer"],
      narrationBoxes: ["A ameaca cresceu em segundos"],
      soundEffects: role === "climax" ? ["BOOM", "CRASH"] : ["WHOOSH"],
      visualThemes: ["impact", "rivalry", "monster", "comics_source", "action"],
      objects: [{ label: "debris", confidence: 0.78 }],
      locations: [{ label: "destroyed city", confidence: 0.8 }]
    },
    quality: { visualQualityScore: 94, cropability916Score: 95, textHeavyRatio: 0.06 },
    confidence: {
      segmentation: 0.94,
      characters: 0.93,
      actions: 0.94,
      relationships: 0.91,
      text: 0.82,
      overall: 0.93
    }
  });
}

async function main() {
  const beast = await importMediaBeast();
  const {
    buildMockPanel,
    mineComicStoryVault,
    buildComicShortsBatchFactoryPlan,
    applyComicPremiumDirector,
    directComicSfxBeatPlan,
    scoreComicRenderReadiness,
    buildComicGoldenRenderQaReport,
    buildComicShortProjectBridgePayload
  } = beast;

  const panelSpecs = [
    ["golden-1", 1, "setup", "monster arrival city panic"],
    ["golden-2", 2, "action", "hero charges into monster fight"],
    ["golden-3", 3, "action", "Kong smashes through battlefield"],
    ["golden-4", 4, "climax", "Godzilla impact explosion defeats heroes"],
    ["golden-5", 5, "reaction", "shocked heroes reveal final threat"]
  ];
  const panels = panelSpecs.map(([id, page, role, action]) => makePanel(buildMockPanel, id, page, role, action));
  const pages = panels.map((panel) => ({
    sourceAssetId: `golden-page-${panel.pageNumber}`,
    sourcePagePath: panel.sourcePagePath,
    sourceContentHash: `golden-hash-${panel.pageNumber}`,
    pageNumber: panel.pageNumber,
    pageType: "story",
    indexable: true,
    parentContext: panel.parentContext,
    panels: [panel]
  }));

  const minerReport = mineComicStoryVault({
    index: {
      version: 3,
      assetDirectory: join(projectRoot, "storage", "assets", "comics", "golden-test"),
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
  const baseShort = batch.shorts[0];
  assert(baseShort, "expected golden short");
  assert(baseShort.estimatedDurationSeconds >= 30, "golden QA requires minimum 30s short");

  const directed = applyComicPremiumDirector({ short: baseShort });
  const sfxBeatDirector = directComicSfxBeatPlan({ short: directed.short, premiumDirector: directed.report });
  const renderQualityScore = scoreComicRenderReadiness({ short: directed.short, premiumDirector: directed.report, sfxBeatDirector });
  const goldenQa = buildComicGoldenRenderQaReport({ short: directed.short, premiumDirector: directed.report, sfxBeatDirector, renderQualityScore });

  assert(goldenQa.qaId === "comic_golden_render_qa_v1", "expected golden QA id");
  assert(goldenQa.referenceTarget.minDurationSeconds === 30, "expected 30s minimum target");
  assert(goldenQa.measured.durationSeconds >= 30, "expected measured duration >= 30s");
  assert(goldenQa.measured.renderQualityScore >= 85, `expected render quality >= 85, got ${goldenQa.measured.renderQualityScore}`);
  assert(goldenQa.releaseVerdict === "ready_to_render" || goldenQa.releaseVerdict === "ready_to_publish_review", `unexpected verdict ${goldenQa.releaseVerdict}`);
  assert(!goldenQa.blockers.includes("duration_below_30s"), "duration should not block golden QA");

  const payload = buildComicShortProjectBridgePayload({ short: baseShort, channelId: "channel-golden-test" });
  assert(payload.renderBlueprintHints.goldenRenderQa.qaId === "comic_golden_render_qa_v1", "bridge should expose golden QA");
  assert(payload.qualityChecklist.some((item) => item.id === "golden_render_qa"), "bridge checklist should include golden QA");
  assert(payload.warnings.includes("comic_golden_render_qa_applied"), "bridge should mark golden QA applied");

  console.log(JSON.stringify({
    status: "completed",
    shortId: directed.short.id,
    verdict: goldenQa.releaseVerdict,
    overallScore: goldenQa.overallScore,
    durationSeconds: goldenQa.measured.durationSeconds,
    renderQualityScore: goldenQa.measured.renderQualityScore,
    panelAlignmentScore: goldenQa.measured.panelAlignmentScore,
    captionQualityScore: goldenQa.measured.captionQualityScore,
    cropConfidenceScore: goldenQa.measured.cropConfidenceScore,
    sfxCueCount: goldenQa.measured.sfxCueCount,
    sfxAverageIntensity: goldenQa.measured.sfxAverageIntensity,
    warnings: goldenQa.warnings,
    blockers: goldenQa.blockers,
    bridgeChecklistStatus: payload.qualityChecklist.find((item) => item.id === "golden_render_qa")?.status
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
