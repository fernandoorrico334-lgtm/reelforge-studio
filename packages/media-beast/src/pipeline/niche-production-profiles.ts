import type { MediaBeastNiche } from "../providers/types.js";
import type { BeastVisualStyle } from "./visual-transformer.js";

export type ProductionEmotion =
  | "curious"
  | "tense"
  | "hype"
  | "dark"
  | "epic"
  | "calm"
  | "horror";

export interface NicheProductionProfile {
  niche: MediaBeastNiche;
  label: string;
  visualStyles: BeastVisualStyle[];
  colorGradeId: string;
  cameraStyle: string;
  narrationVoicePackId: string;
  narrationEmotion: string;
  narrationPacing: "tight" | "balanced" | "breathing";
  musicMoodPresetId: string;
  musicPresetId: string;
  masteringPresetId: string;
  editEnergy: "low" | "medium" | "high" | "extreme";
  productionEmotion: ProductionEmotion;
}

const profiles: Record<MediaBeastNiche, NicheProductionProfile> = {
  true_crime: {
    niche: "true_crime",
    label: "Dark Cinematic Investigation",
    visualStyles: ["dark_cinematic", "crime_board", "noir_investigation", "archive_grit"],
    colorGradeId: "noir_cold",
    cameraStyle: "slow_push_rack_focus",
    narrationVoicePackId: "true_crime_dark_ptbr",
    narrationEmotion: "controlled_dread",
    narrationPacing: "breathing",
    musicMoodPresetId: "dark_suspense",
    musicPresetId: "true_crime_dark",
    masteringPresetId: "true_crime_dark",
    editEnergy: "high",
    productionEmotion: "dark"
  },
  vintage_football: {
    niche: "vintage_football",
    label: "Hype Sports Documentary",
    visualStyles: ["hype_sports", "sports_hype", "cinematic_doc", "neon_retro"],
    colorGradeId: "stadium_warm",
    cameraStyle: "impact_zoom_whip",
    narrationVoicePackId: "sports_hype_ptbr",
    narrationEmotion: "explosive_pride",
    narrationPacing: "tight",
    musicMoodPresetId: "sports_hype",
    musicPresetId: "football_hype",
    masteringPresetId: "football_hype",
    editEnergy: "extreme",
    productionEmotion: "hype"
  },
  cinema: {
    niche: "cinema",
    label: "Horror Cinematic Analysis",
    visualStyles: ["horror_atmosphere", "dark_cinematic", "cinematic_doc", "museum_macro"],
    colorGradeId: "horror_teal_orange",
    cameraStyle: "creeping_dolly",
    narrationVoicePackId: "true_crime_dark_ptbr",
    narrationEmotion: "uneasy_reveal",
    narrationPacing: "balanced",
    musicMoodPresetId: "horror_tension",
    musicPresetId: "true_crime_dark",
    masteringPresetId: "true_crime_dark",
    editEnergy: "high",
    productionEmotion: "horror"
  },
  comics: {
    niche: "comics",
    label: "Documentary Pop Culture",
    visualStyles: ["comic_halftone", "documentary_premium", "museum_macro", "cinematic_doc"],
    colorGradeId: "print_warm",
    cameraStyle: "panel_push_macro",
    narrationVoicePackId: "story_epic_ptbr",
    narrationEmotion: "curious_wonder",
    narrationPacing: "balanced",
    musicMoodPresetId: "epic_rise",
    musicPresetId: "cinematic_epic",
    masteringPresetId: "cinematic_epic",
    editEnergy: "medium",
    productionEmotion: "curious"
  },
  bodybuilding: {
    niche: "bodybuilding",
    label: "Intense Physique Documentary",
    visualStyles: ["bodybuilding_metal", "hype_sports", "dark_cinematic", "cinematic_doc"],
    colorGradeId: "iron_contrast",
    cameraStyle: "muscle_push_impact",
    narrationVoicePackId: "sports_hype_ptbr",
    narrationEmotion: "disciplined_intensity",
    narrationPacing: "tight",
    musicMoodPresetId: "action_pulse",
    musicPresetId: "viral_fast_cut",
    masteringPresetId: "football_hype",
    editEnergy: "extreme",
    productionEmotion: "hype"
  },
  history: {
    niche: "history",
    label: "Premium History Documentary",
    visualStyles: ["documentary_premium", "archive_grit", "museum_macro", "cinematic_doc"],
    colorGradeId: "archive_neutral",
    cameraStyle: "slow_ken_burns",
    narrationVoicePackId: "documentary_ptbr",
    narrationEmotion: "measured_gravity",
    narrationPacing: "breathing",
    musicMoodPresetId: "documentary_bed",
    musicPresetId: "documentary_clean",
    masteringPresetId: "documentary_clean",
    editEnergy: "medium",
    productionEmotion: "epic"
  },
  anime: {
    niche: "anime",
    label: "Anime Shadow Documentary",
    visualStyles: ["anime_shadow", "neon_retro", "cinematic_doc", "documentary_premium"],
    colorGradeId: "neon_cool",
    cameraStyle: "dynamic_orbit",
    narrationVoicePackId: "story_epic_ptbr",
    narrationEmotion: "energetic_lore",
    narrationPacing: "balanced",
    musicMoodPresetId: "epic_rise",
    musicPresetId: "cinematic_epic",
    masteringPresetId: "cinematic_epic",
    editEnergy: "high",
    productionEmotion: "epic"
  },
  science_curiosities: {
    niche: "science_curiosities",
    label: "Clean Explainer Premium",
    visualStyles: ["documentary_premium", "museum_macro", "cinematic_doc", "archive_grit"],
    colorGradeId: "lab_clean",
    cameraStyle: "macro_reveal",
    narrationVoicePackId: "calm_explainer_ptbr",
    narrationEmotion: "curious_clarity",
    narrationPacing: "balanced",
    musicMoodPresetId: "calm_story",
    musicPresetId: "documentary_clean",
    masteringPresetId: "documentary_clean",
    editEnergy: "medium",
    productionEmotion: "curious"
  },
  generic_broll: {
    niche: "generic_broll",
    label: "Cinematic B-Roll Premium",
    visualStyles: ["cinematic_doc", "documentary_premium", "museum_macro", "archive_grit"],
    colorGradeId: "neutral_premium",
    cameraStyle: "smooth_drift",
    narrationVoicePackId: "narrator_clean_ptbr",
    narrationEmotion: "neutral_hook",
    narrationPacing: "balanced",
    musicMoodPresetId: "documentary_bed",
    musicPresetId: "shorts_clean_voice",
    masteringPresetId: "shorts_clean_voice",
    editEnergy: "medium",
    productionEmotion: "calm"
  }
};

export function getNicheProductionProfile(niche: MediaBeastNiche): NicheProductionProfile {
  return profiles[niche] ?? profiles.generic_broll;
}

export function resolveProductionEmotion(
  niche: MediaBeastNiche,
  channelTone: string
): ProductionEmotion {
  const tone = channelTone.toLowerCase();
  if (tone.includes("horror") || tone.includes("terror")) {
    return "horror";
  }
  if (tone.includes("hype") || tone.includes("sports")) {
    return "hype";
  }
  if (tone.includes("dark") || tone.includes("crime")) {
    return "dark";
  }
  if (tone.includes("epic") || tone.includes("hero")) {
    return "epic";
  }
  return getNicheProductionProfile(niche).productionEmotion;
}