import {
  buildBeatSyncPlan,
  getAudioMoodPresetById,
  getMusicPresetById,
  suggestMusicPresetByContext,
  type BeatSyncPlan,
  type MusicPreset
} from "@reelforge/audio-engine";
import { getAudioMasteringPresetById } from "@reelforge/audio-engine/mastering";
import type { ChannelDNA } from "../scheduler/channel-dna.js";
import type { FastCutEditorPlan } from "./fast-cut-editor.js";
import {
  getNicheProductionProfile,
  resolveProductionEmotion,
  type ProductionEmotion
} from "./niche-production-profiles.js";

export interface PremiumAudioScorePlan {
  moodPresetId: string;
  moodPresetName: string;
  musicPresetId: string;
  musicPresetName: string;
  masteringPresetId: string;
  masteringPresetName: string;
  productionEmotion: ProductionEmotion;
  musicVolume: number;
  sfxVolume: number;
  voiceVolume: number;
  duckingEnabled: boolean;
  duckingLevel: number;
  recommendedBpmRange: { min: number; max: number } | null;
  sfxCuePlan: Array<{
    timeSeconds: number;
    category: string;
    intensity: string;
    reason: string;
    alignedToCut: boolean;
  }>;
  beatSyncPlan: BeatSyncPlan;
  audioEnginePayload: {
    musicPresetId: string;
    audioMood: string;
    audioMasteringPresetId: string;
    musicVolume: number;
    voiceVolume: number;
    sfxVolume: number;
    enableAudioDucking: boolean;
    duckingLevel: number;
  };
  selectionReasons: string[];
  cautionNotes: string[];
}

function mapEmotionToMood(emotion: ProductionEmotion, channelDNA: ChannelDNA) {
  const profile = getNicheProductionProfile(channelDNA.niche);
  if (channelDNA.musicPresetId) {
    const preset = getMusicPresetById(channelDNA.musicPresetId);
    if (preset) {
      return preset;
    }
  }

  return (
    suggestMusicPresetByContext({
      tone: channelDNA.tone,
      niche: channelDNA.niche,
      useCase: channelDNA.niche === "vintage_football" ? "football" : channelDNA.niche
    }) ?? getMusicPresetById(profile.musicPresetId)!
  );
}

function buildSfxCuePlan(
  fastCutPlan: FastCutEditorPlan,
  musicPreset: MusicPreset
) {
  return fastCutPlan.effectCues.slice(0, 10).map((cue, index) => {
    const category =
      musicPreset.recommendedSfxCategories[
        index % musicPreset.recommendedSfxCategories.length
      ] ?? "transition";

    return {
      timeSeconds: cue.timeSeconds,
      category,
      intensity: cue.intensity >= 80 ? "high" : cue.intensity >= 60 ? "medium" : "low",
      reason: `Aligned ${cue.effect} at ${cue.timeSeconds}s for ${fastCutPlan.transitionSequence[index]?.transition ?? "cut"}.`,
      alignedToCut: fastCutPlan.cutTimes.includes(cue.timeSeconds)
    };
  });
}

export function buildPremiumAudioScorePlan(input: {
  channelDNA: ChannelDNA;
  durationSeconds: number;
  fastCutPlan: FastCutEditorPlan;
  emotion?: ProductionEmotion;
}): PremiumAudioScorePlan {
  const profile = getNicheProductionProfile(input.channelDNA.niche);
  const productionEmotion =
    input.emotion ?? resolveProductionEmotion(input.channelDNA.niche, input.channelDNA.tone);
  const musicPreset = mapEmotionToMood(productionEmotion, input.channelDNA);
  const moodPreset = getAudioMoodPresetById(profile.musicMoodPresetId);
  const masteringPreset =
    getAudioMasteringPresetById(input.channelDNA.audioMasteringPresetId) ??
    getAudioMasteringPresetById(profile.masteringPresetId) ??
    getAudioMasteringPresetById(musicPreset.recommendedAudioMasteringPresetId);

  const beatSyncPlan = buildBeatSyncPlan({
    musicAssetProfile: null,
    reelDurationSeconds: input.durationSeconds,
    sceneCount: Math.max(input.fastCutPlan.cutTimes.length, 4),
    presetId: musicPreset.id,
    narrationWindows: [
      { startSeconds: 0, endSeconds: Math.min(4.5, input.durationSeconds * 0.2) },
      {
        startSeconds: Math.max(0, input.durationSeconds * 0.55),
        endSeconds: Math.min(input.durationSeconds, input.durationSeconds * 0.75)
      }
    ]
  });

  const moodPresetId = moodPreset?.id ?? profile.musicMoodPresetId;
  const masteringPresetId = masteringPreset?.id ?? profile.masteringPresetId;

  return {
    moodPresetId,
    moodPresetName: moodPreset?.name ?? moodPresetId,
    musicPresetId: musicPreset.id,
    musicPresetName: musicPreset.name,
    masteringPresetId,
    masteringPresetName: masteringPreset?.name ?? masteringPresetId,
    productionEmotion,
    musicVolume: moodPreset?.recommendedMusicVolume ?? musicPreset.defaultMusicVolume,
    sfxVolume: moodPreset?.recommendedSfxVolume ?? 0.7,
    voiceVolume: moodPreset?.recommendedVoiceVolume ?? 1,
    duckingEnabled: true,
    duckingLevel: musicPreset.defaultNarrationDucking,
    recommendedBpmRange: musicPreset.bpmRange,
    sfxCuePlan: buildSfxCuePlan(input.fastCutPlan, musicPreset),
    beatSyncPlan,
    audioEnginePayload: {
      musicPresetId: musicPreset.id,
      audioMood: moodPresetId,
      audioMasteringPresetId: masteringPresetId,
      musicVolume: moodPreset?.recommendedMusicVolume ?? musicPreset.defaultMusicVolume,
      voiceVolume: moodPreset?.recommendedVoiceVolume ?? 1,
      sfxVolume: moodPreset?.recommendedSfxVolume ?? 0.7,
      enableAudioDucking: true,
      duckingLevel: musicPreset.defaultNarrationDucking
    },
    selectionReasons: [
      `Music preset '${musicPreset.name}' selected for niche '${input.channelDNA.niche}' and tone '${input.channelDNA.tone}'.`,
      `Mood '${moodPreset?.name ?? moodPresetId}' matches production emotion '${productionEmotion}'.`,
      `Mastering '${masteringPreset?.name ?? masteringPresetId}' optimizes voice clarity for shorts.`,
      `Beat sync plan generated ${beatSyncPlan.suggestedCutTimes.length} rhythmic cut suggestions.`
    ],
    cautionNotes: [
      "Music and SFX require local/licensed assets before render.",
      "Beat-sync suggestions are planning aids; final mix needs manual approval.",
      "Ducking values assume generated narration — adjust after voice render."
    ]
  };
}