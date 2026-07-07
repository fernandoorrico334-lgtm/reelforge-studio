import type { MediaBeastCandidate } from "../providers/types.js";

export type MediaBeastTransformStageId =
  | "rights_review"
  | "manual_import"
  | "comfyui_variation"
  | "narration_plan"
  | "cinematic_edit_plan"
  | "caption_plan"
  | "audio_mix_plan"
  | "render_blueprint";

export interface MediaBeastTransformStage {
  id: MediaBeastTransformStageId;
  name: string;
  engine:
    | "human-review"
    | "manual-intake"
    | "hybrid-visual-engine"
    | "narration-engine"
    | "cinematic-engine"
    | "caption-engine"
    | "audio-engine"
    | "video-engine";
  enabled: boolean;
  description: string;
  safetyNotes: string[];
}

export interface MediaBeastTransformPlan {
  candidateId: string;
  candidateTitle: string;
  eligibleForAutomation: boolean;
  stages: MediaBeastTransformStage[];
  variationStrategy: {
    visualVariationIntensity: "none" | "moderate" | "high";
    cutDensity: "low" | "medium" | "high";
    captionStyle: "clean" | "premium" | "kinetic";
    narrationMode: "none" | "local-generated" | "manual";
    renderMode: "blueprint-only" | "cinematic-v2";
  };
  warnings: string[];
}

const defaultStages: MediaBeastTransformStage[] = [
  {
    id: "rights_review",
    name: "Rights and Source Review",
    engine: "human-review",
    enabled: true,
    description:
      "Validate source URL, license, author attribution and platform terms before any import.",
    safetyNotes: [
      "This stage cannot be skipped.",
      "No transformation strategy should be used to hide unauthorized reuse."
    ]
  },
  {
    id: "manual_import",
    name: "Manual Intake Import",
    engine: "manual-intake",
    enabled: true,
    description:
      "Import only user-confirmed local, owned, licensed or public-domain files.",
    safetyNotes: ["No automatic download in Media Beast V1."]
  },
  {
    id: "comfyui_variation",
    name: "ComfyUI Visual Variation",
    engine: "hybrid-visual-engine",
    enabled: true,
    description:
      "Generate original supplemental visuals or style-consistent replacements from approved prompts/references.",
    safetyNotes: [
      "Use for creative transformation and original visuals, not for evading copyright detection."
    ]
  },
  {
    id: "narration_plan",
    name: "Local Narration Plan",
    engine: "narration-engine",
    enabled: true,
    description:
      "Create local narration from original script or licensed factual summary.",
    safetyNotes: ["Do not clone or imitate real people, celebrities or characters."]
  },
  {
    id: "cinematic_edit_plan",
    name: "Cinematic Edit Plan",
    engine: "cinematic-engine",
    enabled: true,
    description:
      "Plan pacing, transitions, zoom, motion, microclip inserts and scene energy.",
    safetyNotes: ["Editorial transformation must support original commentary or authorized use."]
  },
  {
    id: "caption_plan",
    name: "Premium Caption Plan",
    engine: "caption-engine",
    enabled: true,
    description:
      "Prepare readable, animated caption strategy for short-form retention.",
    safetyNotes: ["Captions should reflect original narration, not mislead viewers."]
  },
  {
    id: "audio_mix_plan",
    name: "Premium Audio Mix Plan",
    engine: "audio-engine",
    enabled: true,
    description:
      "Prepare voice, music, SFX, ducking, loudness and mastering strategy.",
    safetyNotes: ["Use only licensed/local music and SFX."]
  },
  {
    id: "render_blueprint",
    name: "Render Blueprint",
    engine: "video-engine",
    enabled: true,
    description:
      "Emit a render-ready plan for the existing local ReelForge render pipeline.",
    safetyNotes: ["Render only approved assets and generated original material."]
  }
];

export function buildMediaBeastTransformPlan(
  candidate: MediaBeastCandidate
): MediaBeastTransformPlan {
  const eligibleForAutomation =
    candidate.licenseStatus === "owned" ||
    candidate.licenseStatus === "public_domain" ||
    candidate.licenseStatus === "creative_commons" ||
    candidate.licenseStatus === "royalty_free";

  return {
    candidateId: candidate.id,
    candidateTitle: candidate.title,
    eligibleForAutomation,
    stages: defaultStages.map((stage) => ({ ...stage })),
    variationStrategy: {
      visualVariationIntensity: eligibleForAutomation ? "high" : "none",
      cutDensity: "high",
      captionStyle: "kinetic",
      narrationMode: "local-generated",
      renderMode: "cinematic-v2"
    },
    warnings: [
      "Candidate-first pipeline: discovery never means permission.",
      "Avoiding bans/detection is not a valid design goal; use rights-safe media and transparent editorial transformation.",
      "If license is unknown or restricted, use the candidate only for research/context until replaced."
    ]
  };
}

