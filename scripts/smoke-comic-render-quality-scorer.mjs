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

function makePanel(buildMockPanel, id, pageNumber, role) {
  return buildMockPanel({
    panelId: id,
    pageNumber,
    panelNumber: pageNumber,
    readingOrder: pageNumber,
    sourcePagePath: join(projectRoot, "tmp", `quality-page-${pageNumber}.jpg`),
    panelImagePath: join(projectRoot, "tmp", `quality-panel-${id}.jpg`),
    panelImageSha256: `${id}-sha256`.padEnd(64, "q"),
    sequenceId: "quality-fight-seq",
    storyFunction: role,
    parentContext: {
      comicTitle: "Render Quality Test Comic",
      issueTitle: "Issue 1",
      pageTitle: `Page ${pageNumber}`,
      parentTags: ["comic", "authorized"],
      parentEntities: ["hero", "villain"]
    },
    localEvidence: {
      characters: [
        { name: "Hero", confidence: 0.92, evidenceSource: "visual" },
        { name: "Villain", confidence: 0.88, evidenceSource: "visual" }
      ],
      actions: [{ label: role === "climax" ? "impact explosion attack" : "fight threat pose", confidence: 0.91 }],
      relationships: [{ type: "conflict", entities: ["hero", "villain"], confidence: 0.9 }],
      detectedText: ["BOOM fight impact"],
      dialogue: ["dialogue boom"],
      narrationBoxes: ["narration fight"],
      soundEffects: role === "climax" ? ["BOOM"] : ["WHOOSH"],
      visualThemes: ["impact", "rivalry", "comics_source"],
      objects: [],
      locations: []
    },
    quality: { visualQualityScore: 92, cropability916Score: 94, textHeavyRatio: 0.08 },
    confidence: {
      segmentation: 0.92,
      characters: 0.92,
      actions: 0.91,
      relationships: 0.9,
      text: 0.8,
      overall: 0.92
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
    buildComicShortProjectBridgePayload
  } = beast;

  const roles = ["setup", "action", "action", "climax", "reaction"];
  const panels = roles.map((role, index) => makePanel(buildMockPanel, `quality-${index + 1}`, index + 1, role));
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
      assetDirectory: join(projectRoot, "storage", "assets", "comics", "quality-test"),
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
  assert(baseShort, "expected base short");
  const directed = applyComicPremiumDirector({ short: baseShort });
  const sfxBeatDirector = directComicSfxBeatPlan({ short: directed.short, premiumDirector: directed.report });
  const score = scoreComicRenderReadiness({ short: directed.short, premiumDirector: directed.report, sfxBeatDirector });

  assert(score.scorerId === "comic_render_quality_scorer_v1", "expected scorer id");
  assert(score.durationSeconds >= 30, "expected minimum 30s duration");
  assert(score.overallScore >= 80, `expected strong score, got ${score.overallScore}`);
  assert(score.breakdown.narrationScore >= 70, "expected narration score >= 70");
  assert(score.breakdown.sfxScore >= 70, "expected sfx score >= 70");
  assert(score.breakdown.cropScore >= 78, "expected crop score >= 78");
  assert(score.strengths.includes("strong_hook"), "expected strong hook strength");
  assert(!score.blockers.includes("duration_below_30s"), "should not block duration");

  const payload = buildComicShortProjectBridgePayload({ short: baseShort, channelId: "channel-quality-test" });
  assert(payload.renderBlueprintHints.renderQualityScore.scorerId === "comic_render_quality_scorer_v1", "bridge should expose render quality score");
  assert(payload.qualityChecklist.some((item) => item.id === "render_quality_score"), "bridge checklist should include render quality score");
  assert(payload.warnings.includes("comic_render_quality_scorer_applied"), "bridge should mark scorer applied");

  console.log(JSON.stringify({
    status: "completed",
    shortId: directed.short.id,
    renderQualityStatus: score.status,
    overallScore: score.overallScore,
    breakdown: score.breakdown,
    strengths: score.strengths,
    warnings: score.warnings,
    blockers: score.blockers,
    bridgeChecklistStatus: payload.qualityChecklist.find((item) => item.id === "render_quality_score")?.status
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
