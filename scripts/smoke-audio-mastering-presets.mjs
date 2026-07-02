import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  ensureArtifactsExist,
  printSmokeSummary
} from "./lib/smoke-utils.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function importAudioEngine() {
  const [audioEngine, masteringEngine] = await Promise.all([
    import(pathToFileURL(join(projectRoot, "packages/audio-engine/dist/index.js")).href),
    import(pathToFileURL(join(projectRoot, "packages/audio-engine/dist/mastering.js")).href)
  ]);

  return {
    ...audioEngine,
    ...masteringEngine
  };
}

async function main() {
  await ensureArtifactsExist(
    projectRoot,
    ["packages/audio-engine/dist/index.js"],
    "Run 'npm run build --workspace @reelforge/audio-engine' or 'npm run build' before smoke:audio-mastering-presets."
  );

  const audioEngine = await importAudioEngine();
  const presets = audioEngine.getAudioMasteringPresets();
  const expectedPresetIds = [
    "shorts_clean_voice",
    "football_hype",
    "true_crime_dark",
    "cinematic_epic",
    "documentary_clean",
    "viral_fast_cut"
  ];

  assert(
    presets.length === expectedPresetIds.length,
    `Expected ${expectedPresetIds.length} mastering presets, received ${presets.length}.`
  );

  for (const presetId of expectedPresetIds) {
    const preset = audioEngine.getAudioMasteringPresetById(presetId);
    assert(preset, `Preset '${presetId}' was not found.`);
    assert(typeof preset.targetLufs === "number", `${presetId} targetLufs missing.`);
    assert(typeof preset.truePeakDb === "number", `${presetId} truePeakDb missing.`);
    assert(typeof preset.duckingEnabled === "boolean", `${presetId} duckingEnabled missing.`);
    assert(typeof preset.compressorEnabled === "boolean", `${presetId} compressorEnabled missing.`);
    assert(typeof preset.limiterEnabled === "boolean", `${presetId} limiterEnabled missing.`);
  }

  const audioPlan = audioEngine.buildAudioMixPlan(
    {
      id: "smoke-project",
      title: "Smoke Premium Audio Presets",
      durationTarget: 12,
      backgroundMusicAssetId: "music-bed-1",
      voiceoverAssetId: null,
      audioMood: "sports_hype",
      musicVolume: 0.2,
      voiceVolume: 1,
      sfxVolume: 0.8,
      enableAudioDucking: true,
      duckingLevel: 0.35
    },
    [
      {
        id: "scene-1",
        order: 1,
        title: "Opening hook",
        duration: 4,
        narrationAssetId: "narration-1",
        narrationSource: "generated",
        sfxAssetId: "sfx-hit-1",
        sfxStartTime: 0.2,
        sfxVolume: 0.85
      },
      {
        id: "scene-2",
        order: 2,
        title: "Climax",
        duration: 4,
        narrationAssetId: "narration-2",
        narrationSource: "generated",
        sfxAssetId: null,
        sfxStartTime: 0,
        sfxVolume: 0.8
      },
      {
        id: "scene-3",
        order: 3,
        title: "Payoff",
        duration: 4,
        narrationAssetId: null,
        narrationSource: null,
        sfxAssetId: null,
        sfxStartTime: 0,
        sfxVolume: 0.8
      }
    ],
    [
      {
        id: "music-bed-1",
        filename: "music-bed.wav",
        path: "storage/assets/smoke/audio-mastering/music-bed.wav",
        type: "MUSIC",
        duration: 12,
        mimeType: "audio/wav",
        extension: ".wav"
      },
      {
        id: "narration-1",
        filename: "scene-1.wav",
        path: "storage/assets/smoke/audio-mastering/scene-1.wav",
        type: "AUDIO",
        duration: 3.4,
        mimeType: "audio/wav",
        extension: ".wav"
      },
      {
        id: "narration-2",
        filename: "scene-2.wav",
        path: "storage/assets/smoke/audio-mastering/scene-2.wav",
        type: "AUDIO",
        duration: 2.8,
        mimeType: "audio/wav",
        extension: ".wav"
      },
      {
        id: "sfx-hit-1",
        filename: "impact.wav",
        path: "storage/assets/smoke/audio-mastering/impact.wav",
        type: "SFX",
        duration: 0.4,
        mimeType: "audio/wav",
        extension: ".wav"
      }
    ]
  );

  const premiumPlan = audioEngine.buildPremiumAudioMixPlan({
    audioPlan,
    audioMasteringPresetId: "football_hype",
    preferSidechainDucking: true,
    loudnormSupported: true
  });

  assert(premiumPlan.masteringPresetId === "football_hype", "Preset resolution failed.");
  assert(premiumPlan.narrationIncluded, "Expected narrationIncluded to be true.");
  assert(premiumPlan.musicIncluded, "Expected musicIncluded to be true.");
  assert(premiumPlan.sfxIncluded, "Expected sfxIncluded to be true.");
  assert(premiumPlan.duckingEnabled, "Expected duckingEnabled to be true.");
  assert(premiumPlan.duckingMode === "sidechain", "Expected sidechain ducking preview.");
  assert(premiumPlan.compressorApplied, "Expected compressorApplied to be true.");
  assert(premiumPlan.limiterApplied, "Expected limiterApplied to be true.");
  assert(premiumPlan.loudnormApplied, "Expected loudnormApplied to be true.");

  printSmokeSummary({
    smoke: "audio-mastering-presets",
    presets: presets.map((preset) => preset.id),
    validatedPresetId: premiumPlan.masteringPresetId,
    narrationIncluded: premiumPlan.narrationIncluded,
    musicIncluded: premiumPlan.musicIncluded,
    sfxIncluded: premiumPlan.sfxIncluded,
    duckingEnabled: premiumPlan.duckingEnabled,
    duckingMode: premiumPlan.duckingMode,
    targetLufs: premiumPlan.targetLufs,
    summary: premiumPlan.summary,
    status: "completed"
  });
}

await main();
