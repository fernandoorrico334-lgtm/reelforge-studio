import type { MediaBeastCandidate } from "../providers/types.js";
import type { ChannelDNA } from "../scheduler/channel-dna.js";
import {
  buildVisualTransformerPlan,
  type BeastComfyVariation,
  type BeastVisualStyle,
  type VisualTransformerPlan
} from "./visual-transformer.js";
import type { RemixSceneStructure } from "./remix-scene-restructure.js";
import type { RemixTargetStyle } from "./remix-types.js";
import { shortVisualVariationCount } from "./short-production-limits.js";

const REMIX_WORKFLOW_STACK = [
  "img2img-reference-basic",
  "cinematic-remix",
  "generated-reconstruction",
  "texture-plate",
  "depth-pass",
  "hero-frame",
  "transition-plate",
  "color-grade-pass",
  "broll-synthesis",
  "impact-insert",
  "style-transfer-pass",
  "climax-hero"
] as const;

const STYLE_BY_REMIX_TARGET: Record<RemixTargetStyle, BeastVisualStyle[]> = {
  dark_cinematic: ["dark_cinematic", "noir_investigation", "crime_board", "horror_atmosphere"],
  hype_sports: ["hype_sports", "sports_hype", "neon_retro", "cinematic_doc"],
  documentary: ["documentary_premium", "cinematic_doc", "museum_macro", "archive_grit"],
  horror: ["horror_atmosphere", "dark_cinematic", "noir_investigation", "neon_retro"],
  true_crime: ["crime_board", "noir_investigation", "dark_cinematic", "archive_grit"],
  vintage_football: ["hype_sports", "sports_hype", "neon_retro", "archive_grit"],
  anime: ["anime_shadow", "neon_retro", "cinematic_doc", "dark_cinematic"],
  comics: ["comic_halftone", "neon_retro", "cinematic_doc", "documentary_premium"],
  bodybuilding: ["bodybuilding_metal", "sports_hype", "dark_cinematic", "cinematic_doc"],
  generic: ["cinematic_doc", "documentary_premium", "museum_macro", "archive_grit"]
};

function remixVariationCount(intensity: "medium" | "extreme") {
  return shortVisualVariationCount(intensity);
}

function sourceMixForScene(
  sceneStructure: RemixSceneStructure | undefined,
  index: number
): BeastComfyVariation["sourceMixMode"] {
  const segment = sceneStructure?.segments[index];
  if (!segment) {
    return index % 2 === 0 ? "generated_reconstruction" : "texture_overlay";
  }

  switch (segment.sourceSegment) {
    case "comfy_insert":
      return "transition_plate";
    case "comfy_reconstruction":
      return "generated_reconstruction";
    case "broll_overlay":
      return "texture_overlay";
    case "original_clip":
    default:
      return index % 3 === 0 ? "approved_source_reference" : "color_grade_pass";
  }
}

export function buildAggressiveRemixVisualPlan(
  candidate: MediaBeastCandidate,
  channelDNA: ChannelDNA,
  intensity: "medium" | "extreme",
  durationSeconds: number,
  targetStyle: RemixTargetStyle,
  sceneStructure?: RemixSceneStructure
): VisualTransformerPlan {
  const preferredStyles = STYLE_BY_REMIX_TARGET[targetStyle] ?? STYLE_BY_REMIX_TARGET.generic;
  const basePlan = buildVisualTransformerPlan(
    {
      candidate,
      channelDNA,
      intensity: intensity === "extreme" ? "extreme" : "high",
      preferredStyles
    },
    durationSeconds
  );

  const variationCount = remixVariationCount(intensity);
  const seed = basePlan.seed;

  const comfyVariations: BeastComfyVariation[] = Array.from({ length: variationCount }, (_, index) => {
    const template = basePlan.comfyVariations[index % basePlan.comfyVariations.length];
    const style = preferredStyles[index % preferredStyles.length] ?? "cinematic_doc";
    const workflowId = REMIX_WORKFLOW_STACK[index % REMIX_WORKFLOW_STACK.length] ?? "cinematic-remix";
    const mixMode = sourceMixForScene(sceneStructure, index);
    const segment = sceneStructure?.segments[index];

    return {
      variationId: `remix-variation-${index + 1}`,
      workflowId,
      seed: seed + index * 37,
      style,
      denoise: intensity === "extreme" ? 0.74 + index * 0.018 : 0.58 + index * 0.015,
      cfg: intensity === "extreme" ? 8.2 + index * 0.12 : 7.1 + index * 0.1,
      steps: intensity === "extreme" ? 40 + index * 2 : 30 + index,
      prompt: [
        template?.prompt ?? "premium cinematic remix frame",
        "aggressive editorial remix",
        "new composition distinct from source clip",
        segment ? `${segment.role} beat, ${segment.captionHint}` : "short-form vertical scene",
        "9:16 vertical, high retention framing",
        candidate.title
      ].join(", "),
      negativePrompt: [
        template?.negativePrompt ?? "watermark, low quality",
        "identical copy of source frame",
        "copyright logo",
        "unchanged original composition"
      ].join(", "),
      sourceMixMode: mixMode,
      qualityTier: index < 2 ? "hero" : index < 5 ? "premium" : "standard",
      cameraCue: template?.cameraCue ?? "push_in",
      colorGradeId: basePlan.colorGrade.profileId
    };
  });

  return {
    ...basePlan,
    productionProfileId: `Aggressive Remix · ${targetStyle}`,
    styleStack: preferredStyles,
    transitionStyle: intensity === "extreme" ? "punchy_shorts" : basePlan.transitionStyle,
    variationPasses: [
      ...basePlan.variationPasses,
      {
        passId: "remix-reconstruction",
        purpose: "Rebuild key beats with ComfyUI so the timeline diverges from the source clip.",
        strength: intensity === "extreme" ? 0.96 : 0.82,
        outputRole: "insert"
      },
      {
        passId: "remix-broll-synthesis",
        purpose: "Generate supplemental b-roll inserts for evidence and climax scenes.",
        strength: intensity === "extreme" ? 0.92 : 0.78,
        outputRole: "hero_frame"
      }
    ],
    comfyVariations,
    cinematicEffects: basePlan.cinematicEffects.map((effect) => ({
      ...effect,
      intensity: Math.min(100, effect.intensity + (intensity === "extreme" ? 14 : 6))
    })),
    randomizationProfile: {
      ...basePlan.randomizationProfile,
      intensity: intensity === "extreme" ? "extreme" : "medium",
      variationCount: comfyVariations.length,
      workflowRotation: [...REMIX_WORKFLOW_STACK],
      notes: [
        "Aggressive remix stack prioritizes generated_reconstruction over source reference.",
        "ComfyUI inserts replace weak or repetitive segments from the downloaded clip.",
        "Hero variations anchor hook and climax scenes.",
        ...basePlan.randomizationProfile.notes
      ]
    },
    safetyNotes: [
      "Aggressive remix still requires manual rights approval before render.",
      "Visual reconstruction must not be used to bypass copyright or platform enforcement.",
      ...basePlan.safetyNotes
    ]
  };
}