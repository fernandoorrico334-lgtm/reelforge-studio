import type { MediaBeastCandidate } from "../providers/types.js";
import type { ChannelDNA } from "../scheduler/channel-dna.js";
import { getNicheProductionProfile } from "./niche-production-profiles.js";

export type BeastVisualStyle =
  | "archive_grit"
  | "cinematic_doc"
  | "anime_shadow"
  | "comic_halftone"
  | "sports_hype"
  | "crime_board"
  | "bodybuilding_metal"
  | "museum_macro"
  | "dark_cinematic"
  | "hype_sports"
  | "documentary_premium"
  | "horror_atmosphere"
  | "noir_investigation"
  | "neon_retro";

export interface VisualTransformerInput {
  candidate: MediaBeastCandidate;
  channelDNA?: ChannelDNA;
  seed?: number | null;
  preferredStyles?: BeastVisualStyle[];
  intensity?: "low" | "medium" | "moderate" | "high" | "extreme";
}

export interface BeastComfyVariation {
  variationId: string;
  workflowId: string;
  seed: number;
  style: BeastVisualStyle;
  denoise: number;
  cfg: number;
  steps: number;
  prompt: string;
  negativePrompt: string;
  sourceMixMode:
    | "approved_source_reference"
    | "generated_reconstruction"
    | "texture_overlay"
    | "transition_plate"
    | "depth_plate"
    | "color_grade_pass"
    | "hero_frame";
  qualityTier: "standard" | "premium" | "hero";
  cameraCue: string;
  colorGradeId: string;
}

export interface CinematicVisualEffect {
  effectId: string;
  type:
    | "film_grain"
    | "color_grade"
    | "light_leak"
    | "zoom_drift"
    | "vignette"
    | "halation"
    | "shutter_pulse"
    | "depth_of_field"
    | "smooth_dissolve"
    | "parallax_drift"
    | "lens_flare"
    | "film_gate_weave"
    | "chromatic_aberration";
  intensity: number;
  timing: "full_scene" | "opening" | "beat_hits" | "transition_only" | "climax";
}

export interface CameraMovementCue {
  cueId: string;
  type:
    | "push_in"
    | "pull_out"
    | "dolly_left"
    | "dolly_right"
    | "orbit_slow"
    | "handheld_drift"
    | "crane_rise"
    | "rack_focus"
    | "impact_zoom"
    | "whip_pan";
  startSeconds: number;
  endSeconds: number;
  intensity: number;
  easing: "linear" | "ease_in_out" | "ease_out" | "snap";
}

export interface ColorGradeProfile {
  profileId: string;
  name: string;
  lutHint: string;
  contrast: number;
  saturation: number;
  temperature: number;
  shadows: number;
  highlights: number;
  grainAmount: number;
}

export interface VisualTransformerPlan {
  seed: number;
  approvedSourceRequired: true;
  comfyUiProvider: "comfyui-local";
  productionProfileId: string;
  styleStack: BeastVisualStyle[];
  promptFragments: string[];
  negativePromptFragments: string[];
  colorGrade: ColorGradeProfile;
  cameraMovements: CameraMovementCue[];
  variationPasses: Array<{
    passId: string;
    purpose: string;
    strength: number;
    outputRole:
      | "base_visual"
      | "insert"
      | "texture"
      | "transition_plate"
      | "depth_plate"
      | "hero_frame";
  }>;
  comfyVariations: BeastComfyVariation[];
  cinematicEffects: CinematicVisualEffect[];
  transitionStyle: "smooth_cinematic" | "punchy_shorts" | "dark_tension" | "epic_build";
  randomizationProfile: {
    intensity: "low" | "medium" | "extreme";
    seedJitter: number[];
    workflowRotation: string[];
    variationCount: number;
    notes: string[];
  };
  safetyNotes: string[];
}

const stylePromptMap: Record<BeastVisualStyle, string> = {
  archive_grit: "archival texture, dust, scanned film grain, authentic era mood",
  cinematic_doc: "premium documentary frame, controlled contrast, dramatic depth",
  anime_shadow: "dark anime-inspired lighting, sharp silhouette, moody atmosphere",
  comic_halftone: "halftone ink texture, bold panel composition, aged paper",
  sports_hype: "high-energy sports poster, motion streaks, stadium light burst",
  crime_board: "investigation board aesthetic, evidence markers, tense shadows",
  bodybuilding_metal: "hard gym lighting, steel contrast, intense physique poster",
  museum_macro: "museum catalog macro, elegant detail, refined neutral light",
  dark_cinematic: "moody cinematic noir, controlled shadows, premium lens character",
  hype_sports: "broadcast-grade sports energy, kinetic framing, bold highlight roll-off",
  documentary_premium: "high-end documentary polish, natural skin tones, refined contrast",
  horror_atmosphere: "unsettling atmosphere, narrow depth, cold practical lighting",
  noir_investigation: "noir investigation mood, venetian blind shadows, tense framing",
  neon_retro: "retro neon accents, nostalgic glow, controlled bloom and halation"
};

const colorGradeProfiles: Record<string, ColorGradeProfile> = {
  noir_cold: {
    profileId: "noir_cold",
    name: "Noir Cold",
    lutHint: "teal_shadows_warm_highlights_subtle",
    contrast: 1.18,
    saturation: 0.82,
    temperature: -12,
    shadows: -8,
    highlights: 6,
    grainAmount: 0.34
  },
  stadium_warm: {
    profileId: "stadium_warm",
    name: "Stadium Warm",
    lutHint: "warm_highlights_punchy_mids",
    contrast: 1.24,
    saturation: 1.12,
    temperature: 14,
    shadows: -4,
    highlights: 10,
    grainAmount: 0.22
  },
  horror_teal_orange: {
    profileId: "horror_teal_orange",
    name: "Horror Teal Orange",
    lutHint: "horror_teal_shadows_orange_skin",
    contrast: 1.2,
    saturation: 0.9,
    temperature: -6,
    shadows: -12,
    highlights: 4,
    grainAmount: 0.38
  },
  print_warm: {
    profileId: "print_warm",
    name: "Print Warm",
    lutHint: "vintage_print_warm_paper",
    contrast: 1.08,
    saturation: 1.04,
    temperature: 8,
    shadows: -2,
    highlights: 5,
    grainAmount: 0.28
  },
  iron_contrast: {
    profileId: "iron_contrast",
    name: "Iron Contrast",
    lutHint: "steel_high_contrast_gym",
    contrast: 1.3,
    saturation: 0.96,
    temperature: 2,
    shadows: -10,
    highlights: 12,
    grainAmount: 0.18
  },
  archive_neutral: {
    profileId: "archive_neutral",
    name: "Archive Neutral",
    lutHint: "neutral_archive_film",
    contrast: 1.06,
    saturation: 0.88,
    temperature: -2,
    shadows: -3,
    highlights: 4,
    grainAmount: 0.32
  },
  neon_cool: {
    profileId: "neon_cool",
    name: "Neon Cool",
    lutHint: "neon_cool_magenta_cyan",
    contrast: 1.16,
    saturation: 1.08,
    temperature: -10,
    shadows: -6,
    highlights: 8,
    grainAmount: 0.2
  },
  lab_clean: {
    profileId: "lab_clean",
    name: "Lab Clean",
    lutHint: "clean_explainer_neutral",
    contrast: 1.04,
    saturation: 0.94,
    temperature: 0,
    shadows: 0,
    highlights: 3,
    grainAmount: 0.1
  },
  neutral_premium: {
    profileId: "neutral_premium",
    name: "Neutral Premium",
    lutHint: "premium_neutral_shorts",
    contrast: 1.1,
    saturation: 0.98,
    temperature: 0,
    shadows: -4,
    highlights: 6,
    grainAmount: 0.16
  }
};

function stableSeed(candidate: MediaBeastCandidate, seed?: number | null) {
  if (typeof seed === "number" && Number.isFinite(seed)) {
    return Math.abs(Math.trunc(seed));
  }

  return candidate.id.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
}

function normalizeIntensity(
  intensity: VisualTransformerInput["intensity"]
): "low" | "medium" | "extreme" {
  if (intensity === "extreme" || intensity === "high") {
    return "extreme";
  }

  if (intensity === "low") {
    return "low";
  }

  return "medium";
}

function pickStyleStack(input: VisualTransformerInput): BeastVisualStyle[] {
  if (input.preferredStyles && input.preferredStyles.length > 0) {
    return input.preferredStyles.slice(0, 5);
  }

  if (input.channelDNA) {
    const profile = getNicheProductionProfile(input.channelDNA.niche);
    const channelStyles = input.channelDNA.visualBias.filter((style) =>
      Object.hasOwn(stylePromptMap, style)
    ) as BeastVisualStyle[];
    if (channelStyles.length > 0) {
      return [...new Set([...channelStyles, ...profile.visualStyles])].slice(0, 5);
    }
    return profile.visualStyles;
  }

  if (input.candidate.providerId === "comics-archive") {
    return ["comic_halftone", "documentary_premium", "cinematic_doc", "archive_grit"];
  }

  if (input.candidate.providerId === "sports-archive") {
    return ["hype_sports", "sports_hype", "cinematic_doc", "neon_retro"];
  }

  if (input.candidate.providerId === "internet-archive") {
    return ["archive_grit", "documentary_premium", "museum_macro", "dark_cinematic"];
  }

  return ["cinematic_doc", "dark_cinematic", "documentary_premium", "archive_grit"];
}

function resolveTransitionStyle(
  channelDNA: ChannelDNA | undefined,
  intensity: "low" | "medium" | "extreme"
): VisualTransformerPlan["transitionStyle"] {
  if (!channelDNA) {
    return intensity === "extreme" ? "punchy_shorts" : "smooth_cinematic";
  }

  const profile = getNicheProductionProfile(channelDNA.niche);
  if (profile.editEnergy === "extreme") {
    return "punchy_shorts";
  }
  if (profile.productionEmotion === "dark" || profile.productionEmotion === "horror") {
    return "dark_tension";
  }
  if (profile.productionEmotion === "epic") {
    return "epic_build";
  }
  return "smooth_cinematic";
}

function buildCameraMovements(
  durationSeconds: number,
  cameraStyle: string,
  intensity: "low" | "medium" | "extreme"
): CameraMovementCue[] {
  const strong = intensity === "extreme";
  const cues: CameraMovementCue[] = [
    {
      cueId: "opening-push",
      type: cameraStyle.includes("whip") ? "impact_zoom" : "push_in",
      startSeconds: 0,
      endSeconds: Math.min(2.8, durationSeconds * 0.12),
      intensity: strong ? 78 : 58,
      easing: "ease_out"
    },
    {
      cueId: "context-drift",
      type: cameraStyle.includes("orbit") ? "orbit_slow" : "handheld_drift",
      startSeconds: Math.max(1.2, durationSeconds * 0.18),
      endSeconds: Math.min(durationSeconds * 0.45, durationSeconds - 8),
      intensity: strong ? 62 : 44,
      easing: "ease_in_out"
    },
    {
      cueId: "evidence-rack",
      type: "rack_focus",
      startSeconds: Math.max(2, durationSeconds * 0.42),
      endSeconds: Math.min(durationSeconds * 0.58, durationSeconds - 5),
      intensity: strong ? 70 : 52,
      easing: "ease_in_out"
    },
    {
      cueId: "climax-rise",
      type: cameraStyle.includes("impact") ? "impact_zoom" : "crane_rise",
      startSeconds: Math.max(3, durationSeconds * 0.62),
      endSeconds: Math.min(durationSeconds * 0.82, durationSeconds - 2),
      intensity: strong ? 86 : 64,
      easing: "snap"
    },
    {
      cueId: "closing-pull",
      type: "pull_out",
      startSeconds: Math.max(4, durationSeconds * 0.84),
      endSeconds: durationSeconds,
      intensity: strong ? 54 : 38,
      easing: "ease_in_out"
    }
  ];

  if (cameraStyle.includes("whip")) {
    cues.push({
      cueId: "whip-accent",
      type: "whip_pan",
      startSeconds: Math.max(2.5, durationSeconds * 0.3),
      endSeconds: Math.max(3.1, durationSeconds * 0.34),
      intensity: 92,
      easing: "snap"
    });
  }

  return cues;
}

function buildCinematicEffects(
  intensity: "low" | "medium" | "extreme",
  colorGrade: ColorGradeProfile
): CinematicVisualEffect[] {
  const high = intensity === "extreme";
  const mid = intensity === "medium";

  return [
    {
      effectId: "grain-layer",
      type: "film_grain",
      intensity: high ? 76 : mid ? 52 : 28,
      timing: "full_scene"
    },
    {
      effectId: "grade-pass",
      type: "color_grade",
      intensity: high ? 90 : mid ? 68 : 40,
      timing: "full_scene"
    },
    {
      effectId: "dof-simulation",
      type: "depth_of_field",
      intensity: high ? 72 : mid ? 54 : 30,
      timing: "beat_hits"
    },
    {
      effectId: "parallax-layer",
      type: "parallax_drift",
      intensity: high ? 64 : mid ? 46 : 22,
      timing: "full_scene"
    },
    {
      effectId: "leak-transition",
      type: "light_leak",
      intensity: high ? 74 : mid ? 50 : 24,
      timing: "transition_only"
    },
    {
      effectId: "smooth-dissolve",
      type: "smooth_dissolve",
      intensity: high ? 58 : mid ? 42 : 20,
      timing: "transition_only"
    },
    {
      effectId: "motion-zoom",
      type: "zoom_drift",
      intensity: high ? 82 : mid ? 58 : 30,
      timing: "beat_hits"
    },
    {
      effectId: "lens-flare-accent",
      type: "lens_flare",
      intensity: high ? 48 : mid ? 32 : 14,
      timing: "climax"
    },
    {
      effectId: "edge-vignette",
      type: "vignette",
      intensity: high ? 66 : mid ? 44 : 20,
      timing: "full_scene"
    },
    {
      effectId: "halation-glow",
      type: "halation",
      intensity: Math.round(colorGrade.highlights * 4 + (high ? 18 : 8)),
      timing: "climax"
    },
    {
      effectId: "gate-weave",
      type: "film_gate_weave",
      intensity: high ? 36 : mid ? 22 : 10,
      timing: "opening"
    },
    {
      effectId: "subtle-chroma",
      type: "chromatic_aberration",
      intensity: high ? 22 : mid ? 14 : 6,
      timing: "transition_only"
    }
  ];
}

function variationCountForIntensity(intensity: "low" | "medium" | "extreme") {
  if (intensity === "extreme") {
    return 5;
  }
  if (intensity === "medium") {
    return 4;
  }
  return 3;
}

function workflowRotationForIntensity(intensity: "low" | "medium" | "extreme") {
  if (intensity === "extreme") {
    return [
      "txt2img-basic",
      "img2img-reference-basic",
      "cinematic-remix",
      "texture-plate",
      "depth-pass",
      "color-grade-pass",
      "hero-frame",
      "transition-plate"
    ];
  }
  if (intensity === "medium") {
    return ["txt2img-basic", "img2img-reference-basic", "cinematic-remix", "texture-plate"];
  }
  return ["txt2img-basic", "img2img-reference-basic"];
}

function sourceMixModeForIndex(index: number): BeastComfyVariation["sourceMixMode"] {
  const modes: BeastComfyVariation["sourceMixMode"][] = [
    "approved_source_reference",
    "generated_reconstruction",
    "texture_overlay",
    "depth_plate",
    "transition_plate",
    "color_grade_pass",
    "generated_reconstruction",
    "hero_frame"
  ];
  return modes[index % modes.length] ?? "generated_reconstruction";
}

function qualityTierForIndex(
  index: number,
  intensity: "low" | "medium" | "extreme"
): BeastComfyVariation["qualityTier"] {
  if (intensity === "extreme" && index < 2) {
    return "hero";
  }
  if (index % 3 === 0) {
    return "premium";
  }
  return "standard";
}

export function buildVisualTransformerPlan(
  input: VisualTransformerInput,
  durationSeconds = 35
): VisualTransformerPlan {
  const seed = stableSeed(input.candidate, input.seed);
  const styleStack = pickStyleStack(input);
  const normalizedIntensity = normalizeIntensity(input.intensity ?? "medium");
  const profile = input.channelDNA
    ? getNicheProductionProfile(input.channelDNA.niche)
    : null;
  const colorGrade: ColorGradeProfile =
    colorGradeProfiles[profile?.colorGradeId ?? "neutral_premium"] ??
    colorGradeProfiles.neutral_premium!;
  const baseStrength =
    normalizedIntensity === "extreme"
      ? 0.9
      : normalizedIntensity === "medium"
        ? 0.74
        : 0.48;
  const workflowRotation = workflowRotationForIntensity(normalizedIntensity);
  const variationCount = variationCountForIntensity(normalizedIntensity);
  const seedJitter = [0, 11, 29, 47, 73, 101, 137, 173].slice(0, variationCount);
  const promptFragments = styleStack.map((style) => stylePromptMap[style]);
  const negativePromptFragments = [
    "misleading fake evidence",
    "real person impersonation",
    "copyrighted logo focus",
    "watermark",
    "low quality",
    "amateur framing",
    "oversaturated plastic look"
  ];
  const cameraMovements = buildCameraMovements(
    durationSeconds,
    profile?.cameraStyle ?? "smooth_drift",
    normalizedIntensity
  );

  return {
    seed,
    approvedSourceRequired: true,
    comfyUiProvider: "comfyui-local",
    productionProfileId: profile?.label ?? "Cinematic Premium",
    styleStack,
    promptFragments,
    negativePromptFragments,
    colorGrade,
    cameraMovements,
    variationPasses: [
      {
        passId: "base-reframe",
        purpose: "Create a rights-safe editorial hero frame from approved source or original prompt.",
        strength: baseStrength,
        outputRole: "base_visual"
      },
      {
        passId: "depth-pass",
        purpose: "Simulate premium depth layers for parallax and rack-focus editorial motion.",
        strength: Math.min(baseStrength + 0.06, 0.94),
        outputRole: "depth_plate"
      },
      {
        passId: "texture-breakup",
        purpose: "Add cinematic texture, grain-friendly layers and motion-friendly detail.",
        strength: Math.min(baseStrength + 0.08, 0.95),
        outputRole: "texture"
      },
      {
        passId: "impact-insert",
        purpose: "Generate short high-energy insert plates for premium fast cuts.",
        strength: Math.min(baseStrength + 0.14, 0.98),
        outputRole: "insert"
      },
      {
        passId: "hero-frame",
        purpose: "Produce a flagship cinematic frame for thumbnail and climax beats.",
        strength: Math.min(baseStrength + 0.1, 0.97),
        outputRole: "hero_frame"
      },
      {
        passId: "transition-plate",
        purpose: "Generate smooth dissolves, light leaks and whip-friendly transition plates.",
        strength: Math.min(baseStrength + 0.1, 0.96),
        outputRole: "transition_plate"
      }
    ],
    comfyVariations: seedJitter.map((jitter, index) => {
      const style = styleStack[index % styleStack.length] ?? "cinematic_doc";
      const workflowId = workflowRotation[index % workflowRotation.length] ?? "txt2img-basic";
      const mixMode = sourceMixModeForIndex(index);

      return {
        variationId: `variation-${index + 1}`,
        workflowId,
        seed: seed + jitter,
        style,
        denoise:
          normalizedIntensity === "extreme"
            ? 0.66 + index * 0.028
            : normalizedIntensity === "medium"
              ? 0.5 + index * 0.022
              : 0.34 + index * 0.018,
        cfg:
          normalizedIntensity === "extreme"
            ? 7.6 + index * 0.18
            : normalizedIntensity === "medium"
              ? 6.5 + index * 0.14
              : 5.7 + index * 0.1,
        steps:
          normalizedIntensity === "extreme"
            ? 36 + index * 2
            : normalizedIntensity === "medium"
              ? 28 + index
              : 20 + index,
        prompt: [
          stylePromptMap[style],
          "vertical 9:16 composition",
          "premium cinematic short-form editorial frame",
          "professional color grading, controlled contrast",
          "shallow depth of field, subject separation",
          input.candidate.title
        ].join(", "),
        negativePrompt: negativePromptFragments.join(", "),
        sourceMixMode: mixMode,
        qualityTier: qualityTierForIndex(index, normalizedIntensity),
        cameraCue: cameraMovements[index % cameraMovements.length]?.type ?? "push_in",
        colorGradeId: colorGrade.profileId
      };
    }),
    cinematicEffects: buildCinematicEffects(normalizedIntensity, colorGrade),
    transitionStyle: resolveTransitionStyle(input.channelDNA, normalizedIntensity),
    randomizationProfile: {
      intensity: normalizedIntensity,
      seedJitter,
      workflowRotation,
      variationCount,
      notes: [
        "Premium variation stack is deterministic from candidate and channel seeds.",
        "Hero and premium tiers prioritize climax frames and transition plates.",
        "Use high variation for creative originality and retention, not for hiding unauthorized reuse."
      ]
    },
    safetyNotes: [
      "This plan is for creative variation of approved assets or original generated visuals.",
      "Do not use visual transformation to hide unauthorized reuse or bypass detection systems.",
      "Final render requires candidate risk approval and source/license metadata."
    ]
  };
}

export function transformVisual(
  candidate: MediaBeastCandidate,
  channelDNA: ChannelDNA,
  intensity: "low" | "medium" | "extreme",
  durationSeconds = 35
): VisualTransformerPlan {
  const profile = getNicheProductionProfile(channelDNA.niche);
  const preferredStyles = [
    ...channelDNA.visualBias.filter((style) => Object.hasOwn(stylePromptMap, style)),
    ...profile.visualStyles
  ] as BeastVisualStyle[];

  return buildVisualTransformerPlan(
    {
      candidate,
      channelDNA,
      intensity,
      seed: stableSeed(candidate) + channelDNA.id.length * 31,
      preferredStyles: [...new Set(preferredStyles)].slice(0, 5)
    },
    durationSeconds
  );
}