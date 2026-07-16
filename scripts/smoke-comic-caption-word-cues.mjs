import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");

async function importVideoEngine() {
  return import(pathToFileURL(join(projectRoot, "packages/video-engine/dist/index.js")).href);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function nowIso() {
  return new Date().toISOString();
}

async function main() {
  const { buildRenderBlueprint } = await importVideoEngine();
  const visualRecipe = {
    source: "smoke-comic-caption-word-cues",
    captionRenderPlan: {
      text: "SUPERMAN SENTIU O IMPACTO",
      safeZone: "lower-third",
      animation: "slam_pop",
      impactScore: 96,
      emphasisWords: ["SUPERMAN", "IMPACTO"],
      wordCues: [
        { word: "SUPERMAN", startSeconds: 0, endSeconds: 0.55, emphasis: "impact", animation: "slam_pop" },
        { word: "SENTIU", startSeconds: 0.55, endSeconds: 1.05, emphasis: "punch", animation: "shake_pop" },
        { word: "IMPACTO", startSeconds: 1.05, endSeconds: 1.8, emphasis: "impact", animation: "slam_pop" }
      ]
    }
  };

  const project = {
    id: "comic-caption-word-cues-project",
    title: "Comic Caption Word Cues Smoke",
    status: "SCENE_PLANNING",
    channelId: "comic-channel",
    channel: {
      id: "comic-channel",
      name: "Comic Channel",
      niche: "comics",
      language: "pt-BR",
      visualStyle: "comic premium",
      narrativeTone: "dramatic",
      defaultTemplate: "cinematic_story",
      defaultRenderMode: "cinematic_v2",
      defaultRenderQuality: "standard",
      defaultAudioMood: "epic",
      defaultCaptionStyle: "comic_pop",
      defaultVisualPreset: "epic",
      defaultMusicAssetId: null,
      defaultVoiceoverAssetId: null,
      defaultDurationTarget: 36,
      defaultSceneDuration: 7,
      preferredAssetCategories: ["comic"],
      preferredAssetTags: ["godzilla", "superman"],
      createdAt: nowIso(),
      updatedAt: nowIso()
    },
    script: "Short de quadrinho com legenda por palavra-chave.",
    durationTarget: 36,
    format: "9:16",
    templateId: "cinematic_story",
    editingReferencePresetId: null,
    editingStyleSummary: null,
    defaultCaptionStyle: "comic_pop",
    backgroundMusicAssetId: null,
    backgroundMusicAsset: null,
    musicPresetId: null,
    voiceoverAssetId: null,
    voiceoverAsset: null,
    audioMood: "epic",
    musicVolume: 0.25,
    voiceVolume: 1,
    sfxVolume: 0.7,
    enableAudioDucking: true,
    duckingLevel: 0.3,
    scenes: [
      {
        id: "comic-caption-word-cues-scene",
        order: 1,
        title: "Cena 1: impacto",
        narrationText: "Quando o Godzilla acerta, ate o Superman sente o peso.",
        captionText: "SUPERMAN SENTIU O IMPACTO",
        duration: 7,
        emotion: "EPIC",
        assetId: "panel-asset",
        asset: {
          id: "panel-asset",
          filename: "panel.png",
          originalName: "panel.png",
          path: "storage/assets/comics/panel.png",
          type: "image",
          category: "comic_panel",
          franchise: "authorized-comic-test",
          character: "Superman",
          emotion: "epic",
          duration: null,
          width: 1080,
          height: 1920,
          mimeType: "image/png",
          extension: ".png"
        },
        generatedAssetId: null,
        generatedAsset: null,
        generatedNarrationAssetId: null,
        generatedNarrationAsset: null,
        narrationStatus: null,
        narrationProvider: null,
        narrationVoicePackId: null,
        visualSourceMode: "asset_only",
        sfxAssetId: null,
        sfxAsset: null,
        sfxStartTime: 0,
        sfxVolume: 0.7,
        visualPreset: "epic",
        transition: "flash",
        captionStyle: "comic_pop",
        captionPosition: "lower-third",
        captionEmphasisWords: ["SUPERMAN", "IMPACTO"],
        energyLevel: 9,
        editorialMicroclips: [],
        visualRecipe: JSON.stringify(visualRecipe)
      }
    ]
  };

  const blueprint = buildRenderBlueprint(project);
  const scene = blueprint.scenes[0];
  assert(scene.captionCues.length === 3, "expected three caption cues from wordCues");
  assert(scene.captionCues[0].text === "SUPERMAN", "first cue should preserve punch word");
  assert(scene.captionCues.some((cue) => cue.sfxSuggestion === "caption_hit"), "impact cues should suggest caption hit sfx");
  assert(scene.captionCues.every((cue) => cue.layout === "lower-third"), "word cues should inherit safe caption zone");
  assert(blueprint.subtitleExports.srt.includes("SUPERMAN"), "SRT export should include word cue text");
  assert(blueprint.subtitleExports.ass.includes("IMPACTO"), "ASS export should include word cue text");

  console.log(JSON.stringify({
    status: "completed",
    projectId: blueprint.projectId,
    sceneId: scene.sceneId,
    cueCount: scene.captionCues.length,
    cues: scene.captionCues.map((cue) => ({
      text: cue.text,
      startSeconds: cue.startSeconds,
      endSeconds: cue.endSeconds,
      animation: cue.animation,
      sfxSuggestion: cue.sfxSuggestion,
      highlightedWords: cue.highlightedWords
    })),
    subtitleExportReady: blueprint.subtitleExports.srt.includes("SUPERMAN") && blueprint.subtitleExports.ass.includes("IMPACTO")
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});