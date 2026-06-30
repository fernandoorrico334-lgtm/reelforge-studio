export const cinematicPresetIds = [
  "action",
  "drama",
  "suspense",
  "horror",
  "mystery",
  "epic",
  "calm"
] as const;

export type CinematicPresetId = (typeof cinematicPresetIds)[number];

export type PresetEmotionTag =
  | "NEUTRAL"
  | "CURIOUS"
  | "EPIC"
  | "MYSTERIOUS"
  | "DARK"
  | "TENSE"
  | "JOYFUL"
  | "SAD";

export type PanMode =
  | "static"
  | "drift"
  | "push-in"
  | "push-out"
  | "parallax"
  | "slow-left"
  | "slow-right";

export type CutPace =
  | "meditative"
  | "measured"
  | "steady"
  | "sharp"
  | "volatile";

export interface PresetEnergyCurve {
  opening: number;
  build: number;
  peak: number;
  release: number;
}

export interface CinematicPreset {
  id: CinematicPresetId;
  name: string;
  description: string;
  defaultZoomIntensity: number;
  defaultPanMode: PanMode;
  shakeIntensity: number;
  blurIntensity: number;
  glowIntensity: number;
  vignetteIntensity: number;
  colorMood: string;
  cutPace: CutPace;
  suggestedTransition: string;
  suggestedCaptionStyle: string;
  suggestedMusicMood: string;
  suggestedSfx: string;
  energyCurve: PresetEnergyCurve;
}

function clonePresetEnergyCurve(
  energyCurve: PresetEnergyCurve
): PresetEnergyCurve {
  return {
    opening: energyCurve.opening,
    build: energyCurve.build,
    peak: energyCurve.peak,
    release: energyCurve.release
  };
}

function clonePreset(preset: CinematicPreset): CinematicPreset {
  return {
    ...preset,
    energyCurve: clonePresetEnergyCurve(preset.energyCurve)
  };
}

const presetRegistry: Record<CinematicPresetId, CinematicPreset> = {
  action: {
    id: "action",
    name: "Action Surge",
    description:
      "Empurra a cena para frente com cortes rapidos, impacto visual e energia nervosa.",
    defaultZoomIntensity: 86,
    defaultPanMode: "push-in",
    shakeIntensity: 64,
    blurIntensity: 28,
    glowIntensity: 16,
    vignetteIntensity: 22,
    colorMood: "steel cyan with heated amber highlights",
    cutPace: "volatile",
    suggestedTransition: "whip-cut",
    suggestedCaptionStyle: "impact-bold",
    suggestedMusicMood: "hybrid percussion pulse",
    suggestedSfx: "hits, whooshes and air impacts",
    energyCurve: {
      opening: 86,
      build: 92,
      peak: 100,
      release: 58
    }
  },
  drama: {
    id: "drama",
    name: "Drama Focus",
    description:
      "Segura o olhar no texto e na performance emocional com respiracao e peso cinematografico.",
    defaultZoomIntensity: 48,
    defaultPanMode: "drift",
    shakeIntensity: 8,
    blurIntensity: 14,
    glowIntensity: 30,
    vignetteIntensity: 42,
    colorMood: "warm amber shadows",
    cutPace: "measured",
    suggestedTransition: "soft dissolve",
    suggestedCaptionStyle: "cinematic serif emphasis",
    suggestedMusicMood: "piano swell with restrained strings",
    suggestedSfx: "soft risers and cloth movement",
    energyCurve: {
      opening: 44,
      build: 58,
      peak: 72,
      release: 46
    }
  },
  suspense: {
    id: "suspense",
    name: "Suspense Coil",
    description:
      "ConstrÃ³i tensao com aproximacoes controladas, sombras densas e cortes mais secos no ponto de virada.",
    defaultZoomIntensity: 68,
    defaultPanMode: "slow-left",
    shakeIntensity: 24,
    blurIntensity: 32,
    glowIntensity: 10,
    vignetteIntensity: 54,
    colorMood: "cold graphite with poisoned green undertones",
    cutPace: "sharp",
    suggestedTransition: "tension cut",
    suggestedCaptionStyle: "narrow uppercase with punch words",
    suggestedMusicMood: "low pulse drone",
    suggestedSfx: "ticks, low booms and reversed swells",
    energyCurve: {
      opening: 62,
      build: 74,
      peak: 88,
      release: 40
    }
  },
  horror: {
    id: "horror",
    name: "Horror Veil",
    description:
      "Carrega a imagem com escuridao, respiracao desconfortavel e cortes imprevisiveis para medo crescente.",
    defaultZoomIntensity: 58,
    defaultPanMode: "push-in",
    shakeIntensity: 34,
    blurIntensity: 46,
    glowIntensity: 6,
    vignetteIntensity: 66,
    colorMood: "desaturated black-red dread",
    cutPace: "sharp",
    suggestedTransition: "blink cut",
    suggestedCaptionStyle: "distressed subtitle block",
    suggestedMusicMood: "sub-bass tension with dissonant scrape",
    suggestedSfx: "breaths, metallic screeches and room tones",
    energyCurve: {
      opening: 52,
      build: 70,
      peak: 90,
      release: 28
    }
  },
  mystery: {
    id: "mystery",
    name: "Mystery Drift",
    description:
      "Prioriza curiosidade, camadas visuais e movimento silencioso para puxar o espectador adiante.",
    defaultZoomIntensity: 54,
    defaultPanMode: "parallax",
    shakeIntensity: 12,
    blurIntensity: 22,
    glowIntensity: 18,
    vignetteIntensity: 48,
    colorMood: "midnight blue with silver haze",
    cutPace: "steady",
    suggestedTransition: "smoke fade",
    suggestedCaptionStyle: "editorial mystery card",
    suggestedMusicMood: "plucked pulse with airy texture",
    suggestedSfx: "soft swishes and glass textures",
    energyCurve: {
      opening: 58,
      build: 68,
      peak: 80,
      release: 44
    }
  },
  epic: {
    id: "epic",
    name: "Epic Lift",
    description:
      "Amplifica escala, heroismo e revelacoes grandes com movimento amplo e brilho controlado.",
    defaultZoomIntensity: 74,
    defaultPanMode: "push-out",
    shakeIntensity: 18,
    blurIntensity: 20,
    glowIntensity: 34,
    vignetteIntensity: 26,
    colorMood: "golden blue heroic contrast",
    cutPace: "steady",
    suggestedTransition: "flare reveal",
    suggestedCaptionStyle: "heroic split-caption",
    suggestedMusicMood: "orchestral rise with hybrid drums",
    suggestedSfx: "booms, metallic lifts and air sweeps",
    energyCurve: {
      opening: 68,
      build: 82,
      peak: 96,
      release: 64
    }
  },
  calm: {
    id: "calm",
    name: "Calm Flow",
    description:
      "Suaviza a montagem com deslocamentos leves, pouca agressividade e foco em clareza e respiro.",
    defaultZoomIntensity: 26,
    defaultPanMode: "slow-right",
    shakeIntensity: 0,
    blurIntensity: 8,
    glowIntensity: 22,
    vignetteIntensity: 18,
    colorMood: "soft neutral daylight",
    cutPace: "meditative",
    suggestedTransition: "gentle fade",
    suggestedCaptionStyle: "clean minimal lower-third",
    suggestedMusicMood: "light ambient bed",
    suggestedSfx: "paper moves and subtle room air",
    energyCurve: {
      opening: 24,
      build: 34,
      peak: 42,
      release: 30
    }
  }
};

export const cinematicPresets = cinematicPresetIds.map((presetId) =>
  clonePreset(presetRegistry[presetId])
);

function isCinematicPresetId(value: string): value is CinematicPresetId {
  return cinematicPresetIds.includes(value as CinematicPresetId);
}

export function listCinematicPresets(): CinematicPreset[] {
  return cinematicPresetIds.map((presetId) => clonePreset(presetRegistry[presetId]));
}

export function getCinematicPresetById(
  presetId: string | null | undefined
): CinematicPreset | null {
  if (typeof presetId !== "string" || presetId.trim().length === 0) {
    return null;
  }

  const normalized = presetId.trim().toLowerCase();

  if (!isCinematicPresetId(normalized)) {
    return null;
  }

  return clonePreset(presetRegistry[normalized]);
}

export function suggestPresetIdForEmotion(
  emotion: PresetEmotionTag | null | undefined
): CinematicPresetId {
  switch (emotion) {
    case "EPIC":
      return "epic";
    case "TENSE":
      return "action";
    case "DARK":
      return "horror";
    case "MYSTERIOUS":
      return "mystery";
    case "CURIOUS":
      return "suspense";
    case "SAD":
      return "drama";
    case "JOYFUL":
      return "calm";
    case "NEUTRAL":
      return "drama";
    default:
      return "calm";
  }
}

export function suggestPresetForEmotion(
  emotion: PresetEmotionTag | null | undefined
): CinematicPreset {
  return clonePreset(presetRegistry[suggestPresetIdForEmotion(emotion)]);
}

export function describePresetMotion(preset: CinematicPreset): string {
  return `${preset.defaultPanMode} com zoom ${preset.defaultZoomIntensity}% e corte ${preset.cutPace}`;
}

export function describePresetIntensity(preset: CinematicPreset): string {
  const combinedIntensity =
    preset.defaultZoomIntensity * 0.35 +
    preset.shakeIntensity * 0.25 +
    preset.blurIntensity * 0.15 +
    preset.vignetteIntensity * 0.25;

  if (combinedIntensity >= 72) {
    return "alta tensao";
  }

  if (combinedIntensity >= 48) {
    return "intensidade media";
  }

  return "intensidade controlada";
}

export type ShotSize = "macro" | "close-up" | "medium" | "wide";
export type MotionPreset =
  | "static"
  | "drift"
  | "push-in"
  | "push-out"
  | "parallax"
  | "whip-pan";
export type TransitionPreset = "cut" | "fade" | "flash" | "match-cut";

export interface CinematicBeat {
  beatId: string;
  shot: ShotSize;
  motion: MotionPreset;
  transitionOut: TransitionPreset;
  effectStack: string[];
}

export interface CinematicProfile {
  id: string;
  name: string;
  beats: CinematicBeat[];
  colorDirection: string;
  soundDirection: string;
}

export function buildCinematicProfile(
  id: string,
  name: string,
  beats: CinematicBeat[]
): CinematicProfile {
  return {
    id,
    name,
    beats,
    colorDirection: "Reserved for future color and grading strategy.",
    soundDirection: "Reserved for future soundtrack and SFX strategy."
  };
}

