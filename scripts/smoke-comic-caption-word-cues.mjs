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
    premiumDirection: {
      captionCues: [
        {
          cueIndex: 1,
          text: "SUPERMAN SENTIU",
          keyword: "SUPERMAN",
          startSeconds: 0,
          endSeconds: 0.65,
          emphasis: "impact",
          colorMood: "red",
          highlightedWords: ["SUPERMAN"],
          animation: "slam_pop",
          sfxSuggestion: "caption_hit",
          readingImpactScore: 98
        },
        {
          cueIndex: 2,
          text: "O IMPACTO",
          keyword: "IMPACTO",
          startSeconds: 0.65,
          endSeconds: 1.2,
          emphasis: "shake",
          colorMood: "gold",
          highlightedWords: ["IMPACTO"],
          animation: "shake_pop",
          sfxSuggestion: "caption_hit",
          readingImpactScore: 95
        },
        {
          cueIndex: 3,
          text: "NA HORA",
          keyword: "HORA",
          startSeconds: 1.2,
          endSeconds: 1.8,
          emphasis: "glow",
          colorMood: "blue",
          highlightedWords: ["HORA"],
          animation: "flash_glow",
          readingImpactScore: 91
        }
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
  assert(scene.captionCues[0].text === "SUPERMAN SENTIU", "first cue should preserve premium phrase");
  assert(scene.captionCues[0].keyword === "SUPERMAN", "first cue should preserve keyword");
  assert(scene.captionCues[1].emphasis === "shake", "second cue should preserve emphasis");
  assert(scene.captionCues[2].colorMood === "blue", "third cue should preserve color mood");
  assert(scene.captionCues.some((cue) => cue.sfxSuggestion === "caption_hit"), "impact cues should suggest caption hit sfx");
  assert(scene.captionCues.every((cue) => cue.layout === null), "premium cues can omit layout and use style defaults");
  assert(blueprint.subtitleExports.srt.includes("SUPERMAN SENTIU"), "SRT export should include premium cue text");
  assert(blueprint.subtitleExports.ass.includes("IMPACTO"), "ASS export should include word cue text");
  assert(/\\fscx(?:1[01][0-9]|12[0-9])/.test(blueprint.subtitleExports.ass), "ASS export should include kinetic scale override");
  assert(blueprint.subtitleExports.ass.includes("\\1c&H00"), "ASS export should include color override for impact words");
  assert(blueprint.subtitleExports.ass.includes("\\rDefault"), "ASS export should reset highlighted words to default style");
  assert(blueprint.captionSfxCueCount === 2, "expected caption impact cues to be counted as SFX cues");
  assert(blueprint.captionSfxCues[0]?.absoluteStartSeconds === 0, "expected first caption SFX cue at project start");
  assert(blueprint.captionSfxCues[1]?.sfxSuggestion === "caption_hit", "expected caption SFX suggestion to survive blueprint export");

  console.log(JSON.stringify({
    status: "completed",
    projectId: blueprint.projectId,
    sceneId: scene.sceneId,
    cueCount: scene.captionCues.length,
    cues: scene.captionCues.map((cue) => ({
      text: cue.text,
      keyword: cue.keyword,
      emphasis: cue.emphasis,
      colorMood: cue.colorMood,
      startSeconds: cue.startSeconds,
      endSeconds: cue.endSeconds,
      animation: cue.animation,
      sfxSuggestion: cue.sfxSuggestion,
      highlightedWords: cue.highlightedWords
    })),
    subtitleExportReady: blueprint.subtitleExports.srt.includes("SUPERMAN") && blueprint.subtitleExports.ass.includes("IMPACTO"),
    assHasKineticStyle: /\\fscx(?:1[01][0-9]|12[0-9])/.test(blueprint.subtitleExports.ass),
    assHasWordHighlight: blueprint.subtitleExports.ass.includes("\\rDefault"),
    captionSfxCueCount: blueprint.captionSfxCueCount,
    captionSfxCues: blueprint.captionSfxCues
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
