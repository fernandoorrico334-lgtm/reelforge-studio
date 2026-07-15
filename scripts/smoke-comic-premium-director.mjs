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
  return buildMockPanel({
    panelId: id,
    pageNumber,
    panelNumber: pageNumber,
    readingOrder: pageNumber,
    sourcePagePath: join(projectRoot, "tmp", `premium-page-${pageNumber}.jpg`),
    panelImagePath: join(projectRoot, "tmp", `premium-panel-${id}.jpg`),
    panelImageSha256: `${id}-sha256`.padEnd(64, "f"),
    sequenceId,
    storyFunction,
    parentContext: {
      comicTitle: "Premium Director Test Comic",
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
      actions: [{ label: "fight attack impact reveal transformation", confidence: 0.88 }],
      relationships: [{ type: "conflict", entities: ["hero", "villain"], confidence: 0.86 }],
      detectedText: [categoryText],
      dialogue: [`dialogue ${categoryText}`],
      narrationBoxes: [`narration ${categoryText}`],
      soundEffects: ["BOOM"],
      visualThemes: ["rivalry", "impact", "comics_source"],
      objects: [],
      locations: []
    },
    quality: { visualQualityScore: 90, cropability916Score: 92, textHeavyRatio: 0.1 },
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
    applyComicPremiumDirector,
    directComicCaptionNarration,
    buildComicShortProjectBridgePayload
  } = beast;

  const panels = [];
  for (let i = 1; i <= 5; i += 1) {
    panels.push(makePanel(buildMockPanel, `premium-fight-${i}`, i, "premium-fight-seq", i === 5 ? "climax" : i === 1 ? "setup" : "action", "fight luta boom reveal impact"));
  }

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
      assetDirectory: join(projectRoot, "storage", "assets", "comics", "premium-test"),
      generatedAt: new Date().toISOString(),
      sourcePageCount: pages.length,
      panelCount: panels.length,
      validPanelCount: panels.length,
      rejectedPanelCount: 0,
      sequenceCount: 1,
      pages
    },
    maxOpportunities: 10,
    minScore: 50
  });

  const batch = buildComicShortsBatchFactoryPlan({ minerReport, targetCount: 1, minScore: 60 });
  const baseShort = batch.shorts[0];
  assert(baseShort, "expected base short");

  const captionNarration = directComicCaptionNarration({ short: baseShort });
  const directed = applyComicPremiumDirector({ short: baseShort });
  assert(directed.report.referencePresetId === "builtin-comic-viral-reference-antman", "expected reference preset");
  assert(captionNarration.captionCueCount >= baseShort.scenes.length, "expected caption cues for every scene");
  assert(captionNarration.averageCaptionQualityScore >= 70, `expected caption quality >= 70, got ${captionNarration.averageCaptionQualityScore}`);
  assert(directed.report.qualityScore >= 80, `expected strong quality score, got ${directed.report.qualityScore}`);
  assert(directed.report.captionNarration.directorId === "comic_caption_narration_v2", "premium report should include V2 caption/narration director");
  assert(directed.report.smartCrop.directorId === "comic_smart_crop_director_v1", "premium report should include smart crop director");
  assert(directed.report.smartCrop.averageConfidenceScore >= 78, `expected smart crop confidence >= 78, got ${directed.report.smartCrop.averageConfidenceScore}`);
  assert(directed.short.captionStyleId === "sports_hype", "expected sports_hype captions");
  assert(directed.short.audioMasteringPresetId === "viral_fast_cut", "expected viral mastering");
  assert(directed.short.musicPresetId === "viral_fast_cut", "expected viral music");
  assert(directed.short.estimatedDurationSeconds < baseShort.estimatedDurationSeconds, "premium direction should tighten duration");
  assert(directed.short.scenes.every((scene) => scene.durationSeconds <= 2.2), "scenes should be fast-cut ready");
  assert(directed.short.scenes.every((scene) => scene.caption === scene.caption.toUpperCase()), "captions should be impact uppercase");
  assert(directed.short.scenes.every((scene) => scene.caption.includes("/") || scene.caption.split(/\s+/).length <= 5), "captions should be cue-ready and compact");
  assert(directed.report.sceneDirections.some((scene) => scene.sfxCue !== "none"), "expected sfx cues");

  const payload = buildComicShortProjectBridgePayload({
    short: baseShort,
    channelId: "channel-premium-test"
  });
  assert(payload.renderBlueprintHints.premiumDirector.qualityScore >= 80, "bridge should include premium director report");
  assert(payload.warnings.includes("premium_director_applied"), "bridge warnings should mark premium director");
  assert(payload.scenes.every((scene) => scene.visualRecipe?.includes("premiumDirection")), "visual recipes should include premium direction");
  assert(payload.scenes.every((scene) => scene.visualRecipe?.includes("smartCropDirective")), "visual recipes should include smart crop directives");
  assert(payload.renderBlueprintHints.smartCrop.directives.length === directed.short.scenes.length, "bridge should expose smart crop directives");

  console.log(JSON.stringify({
    status: "completed",
    baseDuration: baseShort.estimatedDurationSeconds,
    directedDuration: directed.short.estimatedDurationSeconds,
    qualityScore: directed.report.qualityScore,
    captionNarrationQuality: directed.report.captionNarration.averageCaptionQualityScore,
    captionCueCount: directed.report.captionNarration.captionCueCount,
    smartCropConfidence: directed.report.smartCrop.averageConfidenceScore,
    sceneCount: directed.short.scenes.length,
    firstScene: {
      narration: directed.short.scenes[0].narration,
      caption: directed.short.scenes[0].caption,
      captionCues: directed.report.captionNarration.scenes[0].captionCues,
      duration: directed.short.scenes[0].durationSeconds,
      sfxCue: directed.report.sceneDirections[0].sfxCue,
      zoomPreset: directed.report.sceneDirections[0].zoomPreset,
      smartCrop: directed.report.smartCrop.directives[0]
    },
    presetId: directed.report.referencePresetId,
    bridgeHasPremiumDirector: Boolean(payload.renderBlueprintHints.premiumDirector)
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
