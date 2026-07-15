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
    sourcePagePath: join(projectRoot, "tmp", `sfx-page-${pageNumber}.jpg`),
    panelImagePath: join(projectRoot, "tmp", `sfx-panel-${id}.jpg`),
    panelImageSha256: `${id}-sha256`.padEnd(64, "d"),
    sequenceId: "sfx-fight-seq",
    storyFunction: role,
    parentContext: {
      comicTitle: "SFX Director Test Comic",
      issueTitle: "Issue 1",
      pageTitle: `Page ${pageNumber}`,
      parentTags: ["comic", "authorized"],
      parentEntities: ["hero", "villain"]
    },
    localEvidence: {
      characters: [
        { name: "Hero", confidence: 0.9, evidenceSource: "visual" },
        { name: "Villain", confidence: 0.85, evidenceSource: "visual" }
      ],
      actions: [{ label: role === "climax" ? "impact explosion attack" : "fight tension pose", confidence: 0.9 }],
      relationships: [{ type: "conflict", entities: ["hero", "villain"], confidence: 0.88 }],
      detectedText: ["BOOM fight impact"],
      dialogue: ["dialogue boom"],
      narrationBoxes: ["narration fight"],
      soundEffects: role === "climax" ? ["BOOM"] : ["WHOOSH"],
      visualThemes: ["impact", "rivalry", "comics_source"],
      objects: [],
      locations: []
    },
    quality: { visualQualityScore: 90, cropability916Score: 92, textHeavyRatio: 0.08 },
    confidence: {
      segmentation: 0.9,
      characters: 0.9,
      actions: 0.9,
      relationships: 0.88,
      text: 0.78,
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
    applyComicPremiumDirector,
    directComicSfxBeatPlan,
    buildComicShortProjectBridgePayload
  } = beast;

  const roles = ["setup", "action", "action", "climax", "reaction"];
  const panels = roles.map((role, index) => makePanel(buildMockPanel, `sfx-${index + 1}`, index + 1, role));
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
      assetDirectory: join(projectRoot, "storage", "assets", "comics", "sfx-test"),
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
  const sfxPlan = directComicSfxBeatPlan({ short: directed.short, premiumDirector: directed.report });
  assert(sfxPlan.directorId === "comic_sfx_beat_director_v1", "expected sfx director id");
  assert(sfxPlan.totalCueCount === directed.short.scenes.length, "expected one cue per scene");
  assert(sfxPlan.cues.some((cue) => cue.beatRole === "hook_hit"), "expected hook hit cue");
  assert(sfxPlan.cues.some((cue) => cue.beatRole === "climax_impact"), "expected climax impact cue");
  assert(sfxPlan.averageIntensityScore >= 65, "expected strong average SFX intensity");
  assert(sfxPlan.cues.every((cue) => cue.startSeconds >= 0), "cue start times must be non-negative");

  const payload = buildComicShortProjectBridgePayload({ short: baseShort, channelId: "channel-sfx-test" });
  assert(payload.renderBlueprintHints.sfxBeatDirector.totalCueCount === payload.scenes.length, "bridge should expose sfx beat director");
  assert(payload.warnings.includes("comic_sfx_beat_director_applied"), "bridge should mark sfx director applied");
  assert(payload.scenes.every((scene) => scene.visualRecipe?.includes("sfxBeatCue")), "visual recipe should include sfx beat cue");

  console.log(JSON.stringify({
    status: "completed",
    shortId: directed.short.id,
    sceneCount: directed.short.scenes.length,
    totalCueCount: sfxPlan.totalCueCount,
    strongestCueSceneOrder: sfxPlan.strongestCueSceneOrder,
    averageIntensityScore: sfxPlan.averageIntensityScore,
    firstCue: sfxPlan.cues[0],
    bridgeHasSfxDirector: Boolean(payload.renderBlueprintHints.sfxBeatDirector)
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
