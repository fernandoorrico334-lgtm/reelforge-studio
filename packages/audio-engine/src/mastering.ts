import type { AudioMixPlan } from "./index.js";

export const audioMasteringPresetIds = [
  "shorts_clean_voice",
  "football_hype",
  "true_crime_dark",
  "cinematic_epic",
  "documentary_clean",
  "viral_fast_cut"
] as const;

export type AudioMasteringPresetId =
  (typeof audioMasteringPresetIds)[number];

export type AudioDuckingMode = "sidechain" | "global_reduction" | "none";

export interface AudioMasteringPreset {
  id: AudioMasteringPresetId;
  name: string;
  description: string;
  targetLufs: number;
  truePeakDb: number;
  narrationGainDb: number;
  musicGainDb: number;
  sfxGainDb: number;
  duckingEnabled: boolean;
  duckingAmountDb: number;
  duckingAttackMs: number;
  duckingReleaseMs: number;
  compressorEnabled: boolean;
  compressorThresholdDb: number;
  compressorRatio: number;
  compressorAttackMs: number;
  compressorReleaseMs: number;
  limiterEnabled: boolean;
  fadeInMs: number;
  fadeOutMs: number;
  removeLongSilences: boolean;
  maxSilenceMs: number;
  recommendedUse: string;
}

export interface BuildPremiumAudioMixPlanInput {
  audioPlan: AudioMixPlan;
  audioMasteringPresetId?: string | null;
  preferSidechainDucking?: boolean;
  loudnormSupported?: boolean;
}

export interface PremiumAudioMixPlan {
  preset: AudioMasteringPreset;
  masteringPresetId: AudioMasteringPresetId;
  narrationIncluded: boolean;
  musicIncluded: boolean;
  sfxIncluded: boolean;
  duckingEnabled: boolean;
  duckingMode: AudioDuckingMode;
  compressorApplied: boolean;
  limiterApplied: boolean;
  loudnormApplied: boolean;
  removeLongSilences: boolean;
  maxSilenceMs: number;
  targetLufs: number;
  truePeakDb: number;
  narrationGainDb: number;
  musicGainDb: number;
  sfxGainDb: number;
  warnings: string[];
  summary: string;
}

export interface AudioQualityReport {
  masteringPresetId: AudioMasteringPresetId;
  masteringPresetName: string;
  targetLufs: number;
  truePeakDb: number;
  measuredInputDuration: number;
  measuredOutputDuration: number | null;
  narrationIncluded: boolean;
  musicIncluded: boolean;
  sfxIncluded: boolean;
  duckingEnabled: boolean;
  duckingMode: AudioDuckingMode;
  compressorApplied: boolean;
  limiterApplied: boolean;
  loudnormApplied: boolean;
  silenceTrimmingApplied: boolean;
  narrationGainDb: number;
  musicGainDb: number;
  sfxGainDb: number;
  finalAudioCodec: string | null;
  finalAudioSampleRate: number | null;
  finalAudioBitrate: string | null;
  warnings: string[];
  appliedFilters: string[];
}

const defaultAudioMasteringPresetId: AudioMasteringPresetId =
  "shorts_clean_voice";

const audioMasteringPresets: AudioMasteringPreset[] = [
  {
    id: "shorts_clean_voice",
    name: "Shorts Clean Voice",
    description:
      "Narracao clara na frente com cama discreta e mastering seguro para reels explicativos.",
    targetLufs: -15,
    truePeakDb: -1.2,
    narrationGainDb: 1.6,
    musicGainDb: -8,
    sfxGainDb: -2,
    duckingEnabled: true,
    duckingAmountDb: -10,
    duckingAttackMs: 24,
    duckingReleaseMs: 220,
    compressorEnabled: true,
    compressorThresholdDb: -19,
    compressorRatio: 2.6,
    compressorAttackMs: 12,
    compressorReleaseMs: 130,
    limiterEnabled: true,
    fadeInMs: 120,
    fadeOutMs: 180,
    removeLongSilences: true,
    maxSilenceMs: 680,
    recommendedUse: "Explicacao, lore, narracao limpa e storytelling direto."
  },
  {
    id: "football_hype",
    name: "Football Hype",
    description:
      "Mix mais agressivo com ducking rapido e impactos fortes para cortes esportivos.",
    targetLufs: -13.5,
    truePeakDb: -1,
    narrationGainDb: 1.8,
    musicGainDb: -4.5,
    sfxGainDb: 1.5,
    duckingEnabled: true,
    duckingAmountDb: -12,
    duckingAttackMs: 10,
    duckingReleaseMs: 120,
    compressorEnabled: true,
    compressorThresholdDb: -18,
    compressorRatio: 3.4,
    compressorAttackMs: 7,
    compressorReleaseMs: 95,
    limiterEnabled: true,
    fadeInMs: 80,
    fadeOutMs: 120,
    removeLongSilences: true,
    maxSilenceMs: 520,
    recommendedUse: "Futebol, esporte, hype reels e cortes de alta energia."
  },
  {
    id: "true_crime_dark",
    name: "True Crime Dark",
    description:
      "Narracao dominante, cama tensa baixa e dinamica controlada para misterio investigativo.",
    targetLufs: -15.5,
    truePeakDb: -1.5,
    narrationGainDb: 2,
    musicGainDb: -9.5,
    sfxGainDb: -1,
    duckingEnabled: true,
    duckingAmountDb: -11,
    duckingAttackMs: 28,
    duckingReleaseMs: 260,
    compressorEnabled: true,
    compressorThresholdDb: -21,
    compressorRatio: 2.9,
    compressorAttackMs: 16,
    compressorReleaseMs: 150,
    limiterEnabled: true,
    fadeInMs: 160,
    fadeOutMs: 220,
    removeLongSilences: true,
    maxSilenceMs: 760,
    recommendedUse: "True crime, horror documental, suspense e misterio."
  },
  {
    id: "cinematic_epic",
    name: "Cinematic Epic",
    description:
      "Camada cinematografica ampla, voz presente e limiter forte para hero shots.",
    targetLufs: -14,
    truePeakDb: -1,
    narrationGainDb: 1.2,
    musicGainDb: -5.5,
    sfxGainDb: 0.8,
    duckingEnabled: true,
    duckingAmountDb: -9,
    duckingAttackMs: 18,
    duckingReleaseMs: 240,
    compressorEnabled: true,
    compressorThresholdDb: -17,
    compressorRatio: 2.8,
    compressorAttackMs: 10,
    compressorReleaseMs: 180,
    limiterEnabled: true,
    fadeInMs: 220,
    fadeOutMs: 260,
    removeLongSilences: false,
    maxSilenceMs: 900,
    recommendedUse: "Climaxes, reveals heroicos e storytelling cinematografico."
  },
  {
    id: "documentary_clean",
    name: "Documentary Clean",
    description:
      "Natural, limpo e equilibrado para informacao confiavel e ritmo respirado.",
    targetLufs: -16,
    truePeakDb: -1.5,
    narrationGainDb: 1.1,
    musicGainDb: -9,
    sfxGainDb: -2.5,
    duckingEnabled: true,
    duckingAmountDb: -8,
    duckingAttackMs: 30,
    duckingReleaseMs: 260,
    compressorEnabled: true,
    compressorThresholdDb: -22,
    compressorRatio: 2.2,
    compressorAttackMs: 18,
    compressorReleaseMs: 170,
    limiterEnabled: true,
    fadeInMs: 140,
    fadeOutMs: 200,
    removeLongSilences: true,
    maxSilenceMs: 840,
    recommendedUse: "Documentario, explicacao limpa, historia e factual."
  },
  {
    id: "viral_fast_cut",
    name: "Viral Fast Cut",
    description:
      "Voz alta, transicoes secas e SFX destacados para cortes verticais agressivos.",
    targetLufs: -13,
    truePeakDb: -0.8,
    narrationGainDb: 2.2,
    musicGainDb: -6,
    sfxGainDb: 2,
    duckingEnabled: true,
    duckingAmountDb: -13,
    duckingAttackMs: 8,
    duckingReleaseMs: 90,
    compressorEnabled: true,
    compressorThresholdDb: -16,
    compressorRatio: 3.8,
    compressorAttackMs: 5,
    compressorReleaseMs: 85,
    limiterEnabled: true,
    fadeInMs: 60,
    fadeOutMs: 100,
    removeLongSilences: true,
    maxSilenceMs: 420,
    recommendedUse: "Shorts acelerados, cortes virais e montagens de impacto."
  }
];

function roundToThreeDecimals(value: number) {
  return Math.round(value * 1000) / 1000;
}

function normalizePresetId(
  value: string | null | undefined
): AudioMasteringPresetId | null {
  if (!value || typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().replaceAll("-", "_").toLowerCase();
  return audioMasteringPresets.some((preset) => preset.id === normalized)
    ? (normalized as AudioMasteringPresetId)
    : null;
}

export function getAudioMasteringPresets() {
  return [...audioMasteringPresets];
}

export function getAudioMasteringPresetById(
  id: string | null | undefined
) {
  const normalized = normalizePresetId(id);

  if (!normalized) {
    return null;
  }

  return audioMasteringPresets.find((preset) => preset.id === normalized) ?? null;
}

export function resolveAudioMasteringPreset(
  input: string | null | undefined
) {
  return (
    getAudioMasteringPresetById(input) ??
    getAudioMasteringPresetById(defaultAudioMasteringPresetId)!
  );
}

export function buildPremiumAudioMixPlan(
  input: BuildPremiumAudioMixPlanInput
): PremiumAudioMixPlan {
  const preset = resolveAudioMasteringPreset(input.audioMasteringPresetId);
  const narrationIncluded = Boolean(
    input.audioPlan.voiceover || input.audioPlan.sceneNarrations.length > 0
  );
  const musicIncluded = Boolean(input.audioPlan.backgroundMusic);
  const sfxIncluded = input.audioPlan.sceneSfx.length > 0;
  const duckingEnabled =
    preset.duckingEnabled && musicIncluded && narrationIncluded;
  const duckingMode: AudioDuckingMode = duckingEnabled
    ? input.preferSidechainDucking === false
      ? "global_reduction"
      : "sidechain"
    : "none";
  const warnings: string[] = [];

  if (preset.duckingEnabled && !musicIncluded) {
    warnings.push(
      `Preset '${preset.id}' pede ducking, mas o plano nao possui background music.`
    );
  }

  if (preset.duckingEnabled && !narrationIncluded) {
    warnings.push(
      `Preset '${preset.id}' pede ducking, mas o plano nao possui narracao efetiva.`
    );
  }

  if (!input.loudnormSupported) {
    warnings.push(
      "FFmpeg loudnorm indisponivel; a masterizacao cai para o fallback simples."
    );
  }

  const summary = [
    `${preset.name}`,
    narrationIncluded ? "narracao on" : "narracao off",
    musicIncluded ? "music on" : "music off",
    sfxIncluded ? "sfx on" : "sfx off",
    `ducking ${duckingMode}`,
    `target ${preset.targetLufs} LUFS`
  ].join(", ");

  return {
    preset,
    masteringPresetId: preset.id,
    narrationIncluded,
    musicIncluded,
    sfxIncluded,
    duckingEnabled,
    duckingMode,
    compressorApplied: preset.compressorEnabled,
    limiterApplied: preset.limiterEnabled,
    loudnormApplied: input.loudnormSupported !== false,
    removeLongSilences: preset.removeLongSilences,
    maxSilenceMs: preset.maxSilenceMs,
    targetLufs: preset.targetLufs,
    truePeakDb: preset.truePeakDb,
    narrationGainDb: preset.narrationGainDb,
    musicGainDb: preset.musicGainDb,
    sfxGainDb: preset.sfxGainDb,
    warnings,
    summary
  };
}
