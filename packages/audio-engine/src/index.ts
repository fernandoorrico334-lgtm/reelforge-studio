export const audioMoodPresetIds = [
  "dark_suspense",
  "epic_rise",
  "horror_tension",
  "documentary_bed",
  "sports_hype",
  "calm_story",
  "action_pulse",
  "emotional_piano"
] as const;

export type AudioMoodPresetId = (typeof audioMoodPresetIds)[number];

export type AudioDuckingStrategy = "none" | "bed_under_voice";

export interface AudioMoodPreset {
  id: AudioMoodPresetId;
  name: string;
  description: string;
  musicMood: string;
  recommendedMusicVolume: number;
  recommendedSfxVolume: number;
  recommendedVoiceVolume: number;
  fadeInDuration: number;
  fadeOutDuration: number;
  duckingStrategy: AudioDuckingStrategy;
  energyLevel: number;
}

export interface AudioAssetInput {
  id: string;
  filename: string;
  path: string;
  type: string;
  duration?: number | null;
  mimeType?: string | null;
  extension?: string | null;
}

export interface AudioProjectInput {
  id: string;
  title: string;
  durationTarget?: number | null;
  backgroundMusicAssetId?: string | null;
  voiceoverAssetId?: string | null;
  audioMood?: string | null;
  musicVolume?: number | null;
  voiceVolume?: number | null;
  sfxVolume?: number | null;
  enableAudioDucking?: boolean | null;
  duckingLevel?: number | null;
}

export interface AudioSceneInput {
  id: string;
  order: number;
  title: string;
  duration?: number | null;
  narrationAssetId?: string | null;
  narrationSource?: "generated" | "manual" | null;
  narrationVolume?: number | null;
  duckMusicDuringNarration?: boolean | null;
  narrationFadeInMs?: number | null;
  narrationFadeOutMs?: number | null;
  sfxAssetId?: string | null;
  sfxStartTime?: number | null;
  sfxVolume?: number | null;
  clipAudioInserts?: AudioSceneClipInsertInput[];
}

export interface AudioSceneClipInsertInput {
  microclipId: string;
  label: string;
  assetId: string;
  startTime: number;
  sourceStartTime: number;
  duration: number;
  volume: number;
  volumeMode: "low_original" | "keep_original";
  narrationOverlay?: boolean | null;
}

export interface AudioMixPlanAsset {
  assetId: string;
  filename: string;
  path: string;
  type: string;
  duration: number | null;
  mimeType: string | null;
  extension: string | null;
  exists: boolean;
}

export interface AudioMixPlanTrack {
  asset: AudioMixPlanAsset;
  volume: number;
  fadeInDuration: number;
  fadeOutDuration: number;
  loopToDuration: boolean;
  cutToDuration: boolean;
  duckedByVoiceover: boolean;
  duckedBySceneNarration: boolean;
}

export interface AudioMixPlanSceneNarration {
  sceneId: string;
  sceneOrder: number;
  sceneTitle: string;
  startTime: number;
  duration: number;
  volume: number;
  duckMusicDuringNarration: boolean;
  fadeInDuration: number;
  fadeOutDuration: number;
  source: "generated" | "manual";
  asset: AudioMixPlanAsset;
}

export interface AudioMixPlanSceneSfx {
  sceneId: string;
  sceneOrder: number;
  sceneTitle: string;
  startTime: number;
  volume: number;
  asset: AudioMixPlanAsset;
}

export interface AudioMixPlanSceneClipAudio {
  microclipId: string;
  label: string;
  sceneId: string;
  sceneOrder: number;
  sceneTitle: string;
  startTime: number;
  sourceStartTime: number;
  duration: number;
  volume: number;
  volumeMode: "low_original" | "keep_original";
  narrationOverlay: boolean;
  asset: AudioMixPlanAsset;
}

export interface AudioMixPlanValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface AudioMixPlan {
  enabled: boolean;
  hasConfiguredAudio: boolean;
  totalDuration: number;
  mood: AudioMoodPreset | null;
  backgroundMusic: AudioMixPlanTrack | null;
  voiceover: AudioMixPlanTrack | null;
  sceneNarrations: AudioMixPlanSceneNarration[];
  sceneSfx: AudioMixPlanSceneSfx[];
  sceneClipAudio: AudioMixPlanSceneClipAudio[];
  musicVolume: number;
  voiceVolume: number;
  sfxVolume: number;
  enableAudioDucking: boolean;
  duckingLevel: number;
  warnings: string[];
  validation: AudioMixPlanValidation;
  summary: string;
}

export interface BuildAudioMixPlanOptions {
  resolveAssetExists?: (asset: AudioAssetInput) => boolean;
  defaultSceneDuration?: number;
}


const audioMoodPresets: AudioMoodPreset[] = [
  {
    id: "dark_suspense",
    name: "Dark Suspense",
    description: "Cama tensa e baixa para narrativas obscuras e cliffhangers.",
    musicMood: "dark atmospheric pulses",
    recommendedMusicVolume: 0.16,
    recommendedSfxVolume: 0.74,
    recommendedVoiceVolume: 1,
    fadeInDuration: 0.8,
    fadeOutDuration: 1.1,
    duckingStrategy: "bed_under_voice",
    energyLevel: 54
  },
  {
    id: "epic_rise",
    name: "Epic Rise",
    description: "Ascensao cinematografica para revelacoes, build-ups e finais heroicos.",
    musicMood: "heroic rise with broad low end",
    recommendedMusicVolume: 0.2,
    recommendedSfxVolume: 0.68,
    recommendedVoiceVolume: 1,
    fadeInDuration: 0.6,
    fadeOutDuration: 0.9,
    duckingStrategy: "bed_under_voice",
    energyLevel: 80
  },
  {
    id: "horror_tension",
    name: "Horror Tension",
    description: "Textura ansiosa para medo, desconforto e cortes secos.",
    musicMood: "dissonant drones and narrow pulses",
    recommendedMusicVolume: 0.14,
    recommendedSfxVolume: 0.82,
    recommendedVoiceVolume: 1,
    fadeInDuration: 0.5,
    fadeOutDuration: 0.7,
    duckingStrategy: "bed_under_voice",
    energyLevel: 70
  },
  {
    id: "documentary_bed",
    name: "Documentary Bed",
    description: "Base discreta para informacao, contexto e narracao limpa.",
    musicMood: "neutral documentary bed",
    recommendedMusicVolume: 0.12,
    recommendedSfxVolume: 0.56,
    recommendedVoiceVolume: 1,
    fadeInDuration: 0.4,
    fadeOutDuration: 0.6,
    duckingStrategy: "bed_under_voice",
    energyLevel: 38
  },
  {
    id: "sports_hype",
    name: "Sports Hype",
    description: "Energia ritmada para cortes rapidos, impacto e celebracao.",
    musicMood: "hybrid sports beat with punch",
    recommendedMusicVolume: 0.22,
    recommendedSfxVolume: 0.78,
    recommendedVoiceVolume: 0.96,
    fadeInDuration: 0.35,
    fadeOutDuration: 0.55,
    duckingStrategy: "bed_under_voice",
    energyLevel: 88
  },
  {
    id: "calm_story",
    name: "Calm Story",
    description: "Base suave para storytelling, reflexao e ritmo respirado.",
    musicMood: "gentle pads and steady pulse",
    recommendedMusicVolume: 0.14,
    recommendedSfxVolume: 0.5,
    recommendedVoiceVolume: 1,
    fadeInDuration: 0.7,
    fadeOutDuration: 0.8,
    duckingStrategy: "bed_under_voice",
    energyLevel: 28
  },
  {
    id: "action_pulse",
    name: "Action Pulse",
    description: "Impulso direto para acao, urgencia e aceleração de ritmo.",
    musicMood: "tight pulse with aggressive percussive bed",
    recommendedMusicVolume: 0.2,
    recommendedSfxVolume: 0.8,
    recommendedVoiceVolume: 0.98,
    fadeInDuration: 0.25,
    fadeOutDuration: 0.45,
    duckingStrategy: "bed_under_voice",
    energyLevel: 92
  },
  {
    id: "emotional_piano",
    name: "Emotional Piano",
    description: "Piano emocional para peso dramatico, nostalgia e resolucao.",
    musicMood: "soft piano and emotional sustain",
    recommendedMusicVolume: 0.17,
    recommendedSfxVolume: 0.48,
    recommendedVoiceVolume: 1,
    fadeInDuration: 0.65,
    fadeOutDuration: 1,
    duckingStrategy: "bed_under_voice",
    energyLevel: 46
  }
];

const validMusicTypes = new Set(["MUSIC", "AUDIO"]);
const validVoiceTypes = new Set(["AUDIO"]);
const validNarrationTypes = new Set(["AUDIO"]);
const validSfxTypes = new Set(["SFX", "AUDIO"]);
const validClipAudioTypes = new Set(["VIDEO", "AUDIO", "SFX"]);

function roundToThreeDecimals(value: number) {
  return Math.round(value * 1000) / 1000;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function normalizeVolume(value: number | null | undefined, fallback: number) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return fallback;
  }

  return roundToThreeDecimals(clamp(value, 0, 1));
}

function normalizeTime(value: number | null | undefined) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return 0;
  }

  return roundToThreeDecimals(Math.max(value, 0));
}

function normalizeDuration(value: number | null | undefined, fallback: number) {
  if (typeof value !== "number" || Number.isNaN(value) || value <= 0) {
    return fallback;
  }

  return roundToThreeDecimals(value);
}

function normalizeFadeDurationMs(
  value: number | null | undefined,
  fallbackMs: number
) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return roundToThreeDecimals(Math.max(fallbackMs, 0) / 1000);
  }

  return roundToThreeDecimals(Math.max(value, 0) / 1000);
}

function buildAssetMap(assets: AudioAssetInput[]) {
  return new Map(assets.map((asset) => [asset.id, asset] as const));
}

function toPlanAsset(
  asset: AudioAssetInput | null,
  resolveAssetExists?: BuildAudioMixPlanOptions["resolveAssetExists"]
): AudioMixPlanAsset | null {
  if (!asset) {
    return null;
  }

  return {
    assetId: asset.id,
    filename: asset.filename,
    path: asset.path,
    type: asset.type,
    duration: asset.duration ?? null,
    mimeType: asset.mimeType ?? null,
    extension: asset.extension ?? null,
    exists: resolveAssetExists ? resolveAssetExists(asset) : true
  };
}

export function getAudioMoodPresets() {
  return [...audioMoodPresets];
}

export function getAudioMoodPresetById(id: string | null | undefined) {
  if (!id) {
    return null;
  }

  return audioMoodPresets.find((preset) => preset.id === id) ?? null;
}

export function validateAudioMixPlan(plan: AudioMixPlan): AudioMixPlanValidation {
  const errors: string[] = [];
  const warnings = [...plan.warnings];

  if (plan.backgroundMusic) {
    if (!validMusicTypes.has(plan.backgroundMusic.asset.type)) {
      errors.push(
        `Background music asset '${plan.backgroundMusic.asset.filename}' must be MUSIC or AUDIO.`
      );
    }

    if (!plan.backgroundMusic.asset.exists) {
      errors.push(
        `Background music asset '${plan.backgroundMusic.asset.path}' is missing on disk.`
      );
    }
  }

  if (plan.voiceover) {
    if (!validVoiceTypes.has(plan.voiceover.asset.type)) {
      errors.push(
        `Voiceover asset '${plan.voiceover.asset.filename}' must be AUDIO.`
      );
    }

    if (!plan.voiceover.asset.exists) {
      errors.push(
        `Voiceover asset '${plan.voiceover.asset.path}' is missing on disk.`
      );
    }
  }

  for (const sceneNarration of plan.sceneNarrations) {
    if (!validNarrationTypes.has(sceneNarration.asset.type)) {
      errors.push(
        `Scene narration '${sceneNarration.asset.filename}' must be AUDIO.`
      );
    }

    if (!sceneNarration.asset.exists) {
      errors.push(
        `Scene narration asset '${sceneNarration.asset.path}' is missing on disk.`
      );
    }

    if (sceneNarration.startTime > plan.totalDuration) {
      warnings.push(
        `Scene '${sceneNarration.sceneTitle}' has narration start ${sceneNarration.startTime}s beyond total duration ${plan.totalDuration}s.`
      );
    }

    if (
      sceneNarration.asset.duration &&
      sceneNarration.asset.duration > sceneNarration.duration
    ) {
      warnings.push(
        `Scene narration '${sceneNarration.asset.filename}' exceeds scene window ${sceneNarration.duration}s and will be trimmed.`
      );
    }
  }

  for (const sceneSfx of plan.sceneSfx) {
    if (!validSfxTypes.has(sceneSfx.asset.type)) {
      errors.push(
        `Scene SFX '${sceneSfx.asset.filename}' must be SFX or AUDIO.`
      );
    }

    if (!sceneSfx.asset.exists) {
      errors.push(
        `Scene SFX asset '${sceneSfx.asset.path}' is missing on disk.`
      );
    }

    if (sceneSfx.startTime > plan.totalDuration) {
      warnings.push(
        `Scene '${sceneSfx.sceneTitle}' has SFX start ${sceneSfx.startTime}s beyond total duration ${plan.totalDuration}s.`
      );
    }
  }

  for (const sceneClipAudio of plan.sceneClipAudio) {
    if (!validClipAudioTypes.has(sceneClipAudio.asset.type)) {
      errors.push(
        `Microclip audio '${sceneClipAudio.asset.filename}' must be VIDEO, AUDIO or SFX.`
      );
    }

    if (!sceneClipAudio.asset.exists) {
      errors.push(
        `Microclip audio asset '${sceneClipAudio.asset.path}' is missing on disk.`
      );
    }

    if (sceneClipAudio.startTime > plan.totalDuration) {
      warnings.push(
        `Scene '${sceneClipAudio.sceneTitle}' has microclip audio start ${sceneClipAudio.startTime}s beyond total duration ${plan.totalDuration}s.`
      );
    }
  }

  if (plan.voiceover?.asset.duration && plan.voiceover.asset.duration > plan.totalDuration) {
    warnings.push(
      `Voiceover duration ${plan.voiceover.asset.duration}s exceeds project duration ${plan.totalDuration}s and will be trimmed.`
    );
  }

  if (plan.backgroundMusic?.asset.duration && plan.backgroundMusic.asset.duration < plan.totalDuration) {
    warnings.push(
      `Background music '${plan.backgroundMusic.asset.filename}' is shorter than the project and will be looped.`
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings: [...new Set(warnings)]
  };
}

export function estimateAudioTimelineDuration(plan: AudioMixPlan) {
  return roundToThreeDecimals(plan.totalDuration);
}

export function summarizeAudioPlan(plan: AudioMixPlan) {
  if (!plan.enabled) {
    return "Audio disabled. Render keeps the current silent fallback output.";
  }

  const fragments = [
    plan.mood ? `mood ${plan.mood.name}` : "mood custom",
    plan.backgroundMusic
      ? `music ${plan.backgroundMusic.asset.filename} at ${Math.round(
          plan.musicVolume * 100
        )}%`
      : "no background music",
    plan.voiceover
      ? `voiceover ${plan.voiceover.asset.filename} at ${Math.round(
          plan.voiceVolume * 100
        )}%`
      : "no voiceover",
    `${plan.sceneNarrations.length} scene narrations`,
    `${plan.sceneSfx.length} scene SFX`,
    `${plan.sceneClipAudio.length} microclip audio`,
    plan.enableAudioDucking && (plan.voiceover || plan.sceneNarrations.length > 0)
      ? `ducking ${Math.round(plan.duckingLevel * 100)}%`
      : "ducking off"
  ];

  return fragments.join(", ");
}

export function buildAudioMixPlan(
  project: AudioProjectInput,
  scenes: AudioSceneInput[],
  assets: AudioAssetInput[],
  options: BuildAudioMixPlanOptions = {}
): AudioMixPlan {
  const orderedScenes = [...scenes].sort((left, right) => left.order - right.order);
  const assetMap = buildAssetMap(assets);
  const mood = getAudioMoodPresetById(project.audioMood);
  const musicVolume = normalizeVolume(
    project.musicVolume,
    mood?.recommendedMusicVolume ?? 0.18
  );
  const voiceVolume = normalizeVolume(
    project.voiceVolume,
    mood?.recommendedVoiceVolume ?? 1
  );
  const sfxVolume = normalizeVolume(
    project.sfxVolume,
    mood?.recommendedSfxVolume ?? 0.7
  );
  const duckingLevel = normalizeVolume(project.duckingLevel, 0.35);
  const enableAudioDucking = Boolean(project.enableAudioDucking);
  const defaultSceneDuration = options.defaultSceneDuration ?? 4;
  const totalDuration = roundToThreeDecimals(
    orderedScenes.reduce(
      (total, scene) => total + normalizeDuration(scene.duration, defaultSceneDuration),
      0
    ) || normalizeDuration(project.durationTarget, 0)
  );
  const backgroundMusicAsset = toPlanAsset(
    assetMap.get(project.backgroundMusicAssetId ?? "") ?? null,
    options.resolveAssetExists
  );
  const voiceoverAsset = toPlanAsset(
    assetMap.get(project.voiceoverAssetId ?? "") ?? null,
    options.resolveAssetExists
  );
  const warnings: string[] = [];

  if (project.audioMood && !mood) {
    warnings.push(`Audio mood '${project.audioMood}' is unknown and local defaults were applied.`);
  }

  if (project.backgroundMusicAssetId && !backgroundMusicAsset) {
    warnings.push(`Background music asset '${project.backgroundMusicAssetId}' was not found.`);
  }

  if (project.voiceoverAssetId && !voiceoverAsset) {
    warnings.push(`Voiceover asset '${project.voiceoverAssetId}' was not found.`);
  }

  let accumulatedSceneStart = 0;
  const sceneNarrations: AudioMixPlanSceneNarration[] = [];
  const sceneSfx: AudioMixPlanSceneSfx[] = [];
  const sceneClipAudio: AudioMixPlanSceneClipAudio[] = [];

  for (const scene of orderedScenes) {
    const resolvedSceneDuration = normalizeDuration(scene.duration, defaultSceneDuration);
    const sceneStartTime = roundToThreeDecimals(accumulatedSceneStart);
    const sceneAsset = toPlanAsset(
      assetMap.get(scene.sfxAssetId ?? "") ?? null,
      options.resolveAssetExists
    );
    const narrationAsset = toPlanAsset(
      assetMap.get(scene.narrationAssetId ?? "") ?? null,
      options.resolveAssetExists
    );
    const clipAudioInserts = scene.clipAudioInserts ?? [];
    const sfxStartTime =
      roundToThreeDecimals(sceneStartTime + normalizeTime(scene.sfxStartTime));

    if (scene.sfxAssetId && !sceneAsset) {
      warnings.push(`Scene '${scene.title}' references missing SFX asset '${scene.sfxAssetId}'.`);
    }

    if (scene.narrationAssetId && !narrationAsset) {
      warnings.push(
        `Scene '${scene.title}' references missing narration asset '${scene.narrationAssetId}'.`
      );
    }

    if (narrationAsset) {
      sceneNarrations.push({
        sceneId: scene.id,
        sceneOrder: scene.order,
        sceneTitle: scene.title,
        startTime: sceneStartTime,
        duration: resolvedSceneDuration,
        volume: normalizeVolume(scene.narrationVolume, voiceVolume),
        duckMusicDuringNarration:
          scene.duckMusicDuringNarration ?? enableAudioDucking,
        fadeInDuration: normalizeFadeDurationMs(scene.narrationFadeInMs, 80),
        fadeOutDuration: normalizeFadeDurationMs(scene.narrationFadeOutMs, 120),
        source: scene.narrationSource ?? "generated",
        asset: narrationAsset
      });
    }

    if (sceneAsset) {
      sceneSfx.push({
        sceneId: scene.id,
        sceneOrder: scene.order,
        sceneTitle: scene.title,
        startTime: sfxStartTime,
        volume: normalizeVolume(scene.sfxVolume, sfxVolume),
        asset: sceneAsset
      });
    }

    for (const clipAudioInsert of clipAudioInserts) {
      const clipAsset = toPlanAsset(
        assetMap.get(clipAudioInsert.assetId) ?? null,
        options.resolveAssetExists
      );

      if (!clipAsset) {
        warnings.push(
          `Scene '${scene.title}' references missing microclip audio asset '${clipAudioInsert.assetId}'.`
        );
        continue;
      }

      sceneClipAudio.push({
        microclipId: clipAudioInsert.microclipId,
        label: clipAudioInsert.label,
        sceneId: scene.id,
        sceneOrder: scene.order,
        sceneTitle: scene.title,
        startTime: roundToThreeDecimals(
          sceneStartTime + normalizeTime(clipAudioInsert.startTime)
        ),
        sourceStartTime: normalizeTime(clipAudioInsert.sourceStartTime),
        duration: normalizeDuration(clipAudioInsert.duration, resolvedSceneDuration),
        volume: normalizeVolume(clipAudioInsert.volume, sfxVolume),
        volumeMode: clipAudioInsert.volumeMode,
        narrationOverlay: clipAudioInsert.narrationOverlay ?? true,
        asset: clipAsset
      });
    }

    accumulatedSceneStart += resolvedSceneDuration;
  }

  const backgroundMusic =
    backgroundMusicAsset
      ? {
          asset: backgroundMusicAsset,
          volume: musicVolume,
          fadeInDuration: mood?.fadeInDuration ?? 0.6,
          fadeOutDuration: mood?.fadeOutDuration ?? 0.8,
          loopToDuration:
            typeof backgroundMusicAsset.duration === "number" &&
            backgroundMusicAsset.duration < totalDuration,
          cutToDuration: true,
          duckedByVoiceover: enableAudioDucking && Boolean(voiceoverAsset),
          duckedBySceneNarration:
            enableAudioDucking &&
            sceneNarrations.some((entry) => entry.duckMusicDuringNarration)
        }
      : null;

  const voiceover =
    voiceoverAsset
      ? {
          asset: voiceoverAsset,
          volume: voiceVolume,
          fadeInDuration: 0,
          fadeOutDuration: 0,
          loopToDuration: false,
          cutToDuration: true,
          duckedByVoiceover: false,
          duckedBySceneNarration: false
        }
      : null;

  const hasConfiguredAudio = Boolean(
    project.backgroundMusicAssetId ||
      project.voiceoverAssetId ||
      sceneNarrations.length > 0 ||
      sceneSfx.length > 0 ||
      sceneClipAudio.length > 0 ||
      orderedScenes.some(
        (scene) =>
          Boolean(
            scene.sfxAssetId ||
              scene.narrationAssetId ||
              (scene.clipAudioInserts?.length ?? 0) > 0
          )
      )
  );
  const enabled = Boolean(
    backgroundMusic ||
      voiceover ||
      sceneNarrations.length > 0 ||
      sceneSfx.length > 0 ||
      sceneClipAudio.length > 0
  );

  const preliminaryPlan: AudioMixPlan = {
    enabled,
    hasConfiguredAudio,
    totalDuration,
    mood,
    backgroundMusic,
    voiceover,
    sceneNarrations,
    sceneSfx,
    sceneClipAudio,
    musicVolume,
    voiceVolume,
    sfxVolume,
    enableAudioDucking,
    duckingLevel,
    warnings: [...new Set(warnings)],
    validation: {
      valid: true,
      errors: [],
      warnings: []
    },
    summary: ""
  };

  const validation = validateAudioMixPlan(preliminaryPlan);

  return {
    ...preliminaryPlan,
    validation,
    warnings: [...new Set([...preliminaryPlan.warnings, ...validation.warnings])],
    summary: summarizeAudioPlan(preliminaryPlan)
  };
}
