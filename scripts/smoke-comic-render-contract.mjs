import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function importDist(packagePath) {
  return import(pathToFileURL(join(projectRoot, packagePath)).href);
}

function makePanel(buildMockPanel, id, pageNumber, storyFunction) {
  return buildMockPanel({
    panelId: id,
    pageNumber,
    panelNumber: pageNumber,
    readingOrder: pageNumber,
    sourcePagePath: join(projectRoot, "tmp", `contract-page-${pageNumber}.jpg`),
    panelImagePath: join(projectRoot, "tmp", `contract-panel-${id}.jpg`),
    panelImageSha256: `${id}-sha256`.padEnd(64, "f"),
    sequenceId: "contract-fight-seq",
    storyFunction,
    parentContext: {
      comicTitle: "Contract Comic",
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
      actions: [{ label: "fight impact boom reveal", confidence: 0.88 }],
      relationships: [{ type: "conflict", entities: ["hero", "villain"], confidence: 0.86 }],
      detectedText: ["fight impact"],
      dialogue: ["dialogue fight impact"],
      narrationBoxes: ["narration fight impact"],
      soundEffects: ["BOOM"],
      visualThemes: ["impact", "comics_source"],
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
  const beast = await importDist("packages/media-beast/dist/index.js");
  const videoEngine = await importDist("packages/video-engine/dist/index.js");
  const { buildMockPanel, mineComicStoryVault, buildComicShortsBatchFactoryPlan, buildComicShortProjectBridgePayload } = beast;
  const { buildRenderBlueprint } = videoEngine;

  const panels = [1, 2, 3, 4, 5].map((page) => makePanel(
    buildMockPanel,
    `contract-fight-${page}`,
    page,
    page === 1 ? "setup" : page === 5 ? "climax" : "action"
  ));
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
      assetDirectory: join(projectRoot, "storage", "assets", "comics", "contract-test"),
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
  const payload = buildComicShortProjectBridgePayload({ short, channelId: "channel-contract" });

  const blueprint = buildRenderBlueprint({
    id: "project-contract",
    title: payload.project.title,
    status: payload.project.status,
    channelId: payload.channelId,
    channel: {
      id: payload.channelId,
      name: "Comic Channel",
      niche: "comics",
      language: "pt-BR",
      visualStyle: "viral comics",
      narrativeTone: "hype",
      defaultTemplate: "comic_drama",
      defaultRenderMode: null,
      defaultRenderQuality: null,
      defaultAudioMood: null,
      defaultCaptionStyle: "sports_hype",
      defaultVisualPreset: "action",
      defaultMusicAssetId: null,
      defaultVoiceoverAssetId: null,
      defaultDurationTarget: 30,
      defaultSceneDuration: 1.6,
      preferredAssetCategories: [],
      preferredAssetTags: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    script: payload.project.script,
    durationTarget: payload.project.durationTarget,
    format: "9:16",
    templateId: payload.project.templateId,
    editingReferencePresetId: payload.project.editingReferencePresetId,
    editingStyleSummary: null,
    defaultCaptionStyle: payload.project.defaultCaptionStyle,
    backgroundMusicAssetId: null,
    backgroundMusicAsset: null,
    musicPresetId: payload.project.musicPresetId,
    voiceoverAssetId: null,
    voiceoverAsset: null,
    audioMood: payload.project.audioMood,
    musicVolume: payload.project.musicVolume,
    voiceVolume: payload.project.voiceVolume,
    sfxVolume: payload.project.sfxVolume,
    enableAudioDucking: payload.project.enableAudioDucking,
    duckingLevel: payload.project.duckingLevel,
    scenes: payload.scenes.map((scene, index) => ({
      id: `scene-${index + 1}`,
      order: scene.order,
      title: scene.title,
      narrationText: scene.narrationText,
      captionText: scene.captionText,
      duration: scene.duration,
      emotion: scene.emotion,
      assetId: null,
      asset: null,
      generatedAssetId: null,
      generatedAsset: null,
      generatedNarrationAssetId: null,
      generatedNarrationAsset: null,
      narrationStatus: null,
      narrationProvider: null,
      narrationVoicePackId: scene.narrationVoicePackId,
      visualSourceMode: scene.visualSourceMode,
      sfxAssetId: null,
      sfxAsset: null,
      sfxStartTime: scene.sfxStartTime,
      sfxVolume: scene.sfxVolume,
      visualPreset: scene.visualPreset,
      transition: scene.transition,
      captionStyle: scene.captionStyle,
      captionPosition: scene.captionPosition,
      captionEmphasisWords: scene.captionEmphasisWords,
      energyLevel: scene.energyLevel,
      visualRecipe: scene.visualRecipe,
      editorialMicroclips: []
    }))
  });

  assert(blueprint.scenes.length === payload.scenes.length, "expected all scenes in blueprint");
  assert(blueprint.scenes.every((scene) => scene.smartCropDirective), "expected every scene to expose smart crop directive");
  assert(blueprint.scenes.every((scene) => scene.captionCues.length > 0), "expected every scene to expose caption cues");
  assert(blueprint.subtitleExports.ass.includes("Dialogue:"), "expected ASS dialogue rows");
  assert(blueprint.subtitleExports.ass.includes("ESSE") || blueprint.subtitleExports.ass.includes("CONTRA"), "expected cue text in ASS export");

  console.log(JSON.stringify({
    status: "completed",
    sceneCount: blueprint.scenes.length,
    firstSmartCrop: blueprint.scenes[0].smartCropDirective,
    firstCaptionCueCount: blueprint.scenes[0].captionCues.length,
    subtitleCueMode: blueprint.scenes.some((scene) => scene.captionCues.length > 1),
    assLength: blueprint.subtitleExports.ass.length
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
