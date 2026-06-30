import type { RenderBlueprintScene } from "./index.js";
import {
  buildFadeFilters,
  clampNumber,
  mapTransitionToFadeMode,
  type TransitionFadeMode
} from "./ffmpeg-filter-utils.js";

export const cinematicRenderQualities = [
  "draft",
  "standard",
  "high"
] as const;

export type CinematicRenderQuality =
  (typeof cinematicRenderQualities)[number];

export interface RenderQualityProfile {
  id: CinematicRenderQuality;
  segmentPreset: string;
  segmentCrf: number;
  finalPreset: string;
  finalCrf: number;
  effectMultiplier: number;
  overscanScaleBoost: number;
}

export interface CinematicFilterPlan {
  presetKey:
    | "action"
    | "drama"
    | "suspense"
    | "horror"
    | "mystery"
    | "epic"
    | "calm"
    | "sports_hype";
  presetLabel: string;
  zoomDirection: "in" | "out";
  zoomStart: number;
  zoomEnd: number;
  panMode:
    | "center"
    | "drift"
    | "push-in"
    | "push-out"
    | "slow-left"
    | "slow-right"
    | "parallax";
  driftX: number;
  driftY: number;
  shakeX: number;
  shakeY: number;
  overscanScale: number;
  brightness: number;
  contrast: number;
  saturation: number;
  gamma: number;
  blurSigma: number;
  vignetteAngle: string | null;
  noiseStrength: number;
  fadeSeconds: number;
  transitionMode: TransitionFadeMode;
  placeholderPrimary: string;
  placeholderAccent: string;
  notes: string[];
}

const qualityProfiles: Record<CinematicRenderQuality, RenderQualityProfile> = {
  draft: {
    id: "draft",
    segmentPreset: "veryfast",
    segmentCrf: 26,
    finalPreset: "veryfast",
    finalCrf: 23,
    effectMultiplier: 0.84,
    overscanScaleBoost: 0
  },
  standard: {
    id: "standard",
    segmentPreset: "fast",
    segmentCrf: 22,
    finalPreset: "fast",
    finalCrf: 20,
    effectMultiplier: 1,
    overscanScaleBoost: 0.02
  },
  high: {
    id: "high",
    segmentPreset: "medium",
    segmentCrf: 18,
    finalPreset: "medium",
    finalCrf: 17,
    effectMultiplier: 1.08,
    overscanScaleBoost: 0.04
  }
};

const presetPlanRegistry: Record<
  CinematicFilterPlan["presetKey"],
  Omit<CinematicFilterPlan, "transitionMode">
> = {
  action: {
    presetKey: "action",
    presetLabel: "Action Surge",
    zoomDirection: "in",
    zoomStart: 1.04,
    zoomEnd: 1.16,
    panMode: "push-in",
    driftX: 18,
    driftY: 10,
    shakeX: 6,
    shakeY: 4,
    overscanScale: 1.18,
    brightness: 0.03,
    contrast: 1.18,
    saturation: 1.16,
    gamma: 1,
    blurSigma: 0.1,
    vignetteAngle: "PI/7",
    noiseStrength: 0,
    fadeSeconds: 0.16,
    placeholderPrimary: "#0f1724",
    placeholderAccent: "#ff7c45",
    notes: [
      "high contrast action pass",
      "micro drift used as safe shake fallback"
    ]
  },
  drama: {
    presetKey: "drama",
    presetLabel: "Drama Focus",
    zoomDirection: "in",
    zoomStart: 1.02,
    zoomEnd: 1.09,
    panMode: "drift",
    driftX: 12,
    driftY: 8,
    shakeX: 0,
    shakeY: 0,
    overscanScale: 1.12,
    brightness: -0.02,
    contrast: 1.06,
    saturation: 1.04,
    gamma: 1.02,
    blurSigma: 0.15,
    vignetteAngle: "PI/7",
    noiseStrength: 0,
    fadeSeconds: 0.48,
    placeholderPrimary: "#161826",
    placeholderAccent: "#d8a45a",
    notes: ["slow inward focus", "soft dramatic vignette"]
  },
  suspense: {
    presetKey: "suspense",
    presetLabel: "Suspense Coil",
    zoomDirection: "in",
    zoomStart: 1.03,
    zoomEnd: 1.12,
    panMode: "slow-left",
    driftX: 16,
    driftY: 8,
    shakeX: 2,
    shakeY: 1,
    overscanScale: 1.14,
    brightness: -0.08,
    contrast: 1.12,
    saturation: 0.8,
    gamma: 0.94,
    blurSigma: 0.2,
    vignetteAngle: "PI/5",
    noiseStrength: 0,
    fadeSeconds: 0.26,
    placeholderPrimary: "#0d1320",
    placeholderAccent: "#5cc4a1",
    notes: ["cold suspense grading", "strong vignette with restrained blur"]
  },
  mystery: {
    presetKey: "mystery",
    presetLabel: "Mystery Drift",
    zoomDirection: "in",
    zoomStart: 1.02,
    zoomEnd: 1.1,
    panMode: "parallax",
    driftX: 14,
    driftY: 6,
    shakeX: 0,
    shakeY: 0,
    overscanScale: 1.14,
    brightness: -0.04,
    contrast: 1.08,
    saturation: 0.86,
    gamma: 0.98,
    blurSigma: 0.55,
    vignetteAngle: "PI/6",
    noiseStrength: 0,
    fadeSeconds: 0.34,
    placeholderPrimary: "#101a2c",
    placeholderAccent: "#8bb9ff",
    notes: ["initial blur wash replaces animated reveal for stability"]
  },
  horror: {
    presetKey: "horror",
    presetLabel: "Horror Veil",
    zoomDirection: "in",
    zoomStart: 1.03,
    zoomEnd: 1.13,
    panMode: "push-in",
    driftX: 10,
    driftY: 10,
    shakeX: 4,
    shakeY: 3,
    overscanScale: 1.16,
    brightness: -0.1,
    contrast: 1.18,
    saturation: 0.72,
    gamma: 0.9,
    blurSigma: 0.28,
    vignetteAngle: "PI/4",
    noiseStrength: 0,
    fadeSeconds: 0.24,
    placeholderPrimary: "#120d14",
    placeholderAccent: "#b44a4a",
    notes: [
      "grain omitted for windows stability",
      "vignette and darkening drive the horror look"
    ]
  },
  epic: {
    presetKey: "epic",
    presetLabel: "Epic Lift",
    zoomDirection: "out",
    zoomStart: 1.12,
    zoomEnd: 1.02,
    panMode: "push-out",
    driftX: 14,
    driftY: 6,
    shakeX: 0,
    shakeY: 0,
    overscanScale: 1.16,
    brightness: 0.04,
    contrast: 1.14,
    saturation: 1.1,
    gamma: 1.04,
    blurSigma: 0.08,
    vignetteAngle: "PI/7",
    noiseStrength: 0,
    fadeSeconds: 0.32,
    placeholderPrimary: "#182032",
    placeholderAccent: "#ffd16e",
    notes: ["heroic pullback reveal", "light lift instead of unstable glow"]
  },
  calm: {
    presetKey: "calm",
    presetLabel: "Calm Flow",
    zoomDirection: "in",
    zoomStart: 1.01,
    zoomEnd: 1.05,
    panMode: "slow-right",
    driftX: 10,
    driftY: 4,
    shakeX: 0,
    shakeY: 0,
    overscanScale: 1.1,
    brightness: 0.01,
    contrast: 1.02,
    saturation: 0.98,
    gamma: 1.01,
    blurSigma: 0.1,
    vignetteAngle: null,
    noiseStrength: 0,
    fadeSeconds: 0.56,
    placeholderPrimary: "#132130",
    placeholderAccent: "#72d2cf",
    notes: ["gentle drift", "low intensity fade handling"]
  },
  sports_hype: {
    presetKey: "sports_hype",
    presetLabel: "Sports Hype",
    zoomDirection: "in",
    zoomStart: 1.05,
    zoomEnd: 1.17,
    panMode: "push-in",
    driftX: 22,
    driftY: 12,
    shakeX: 7,
    shakeY: 5,
    overscanScale: 1.2,
    brightness: 0.04,
    contrast: 1.2,
    saturation: 1.18,
    gamma: 1,
    blurSigma: 0.08,
    vignetteAngle: "PI/8",
    noiseStrength: 0,
    fadeSeconds: 0.14,
    placeholderPrimary: "#111926",
    placeholderAccent: "#63ffe1",
    notes: ["sports alias mapped to high-energy action language"]
  }
};

function normalizePresetCandidate(
  scene: RenderBlueprintScene,
  templateId: string
): CinematicFilterPlan["presetKey"] {
  const configured = scene.visualPreset.configuredPresetId?.toLowerCase() ?? null;
  const resolved = scene.visualPreset.preset.id.toLowerCase();
  const templateNormalized = templateId.trim().toLowerCase();

  if (
    configured === "sports_hype" ||
    configured === "sports" ||
    templateNormalized === "sports_hype"
  ) {
    return "sports_hype";
  }

  switch (configured ?? resolved) {
    case "action":
    case "drama":
    case "suspense":
    case "horror":
    case "mystery":
    case "epic":
    case "calm":
      return (configured ?? resolved) as CinematicFilterPlan["presetKey"];
    case "sports":
    case "sports_hype":
      return "sports_hype";
    default:
      return resolved === "action" && templateNormalized === "sports_hype"
        ? "sports_hype"
        : "drama";
  }
}

export function getRenderQualityProfile(
  quality: CinematicRenderQuality | string | null | undefined
) {
  if (quality === "draft" || quality === "standard" || quality === "high") {
    return qualityProfiles[quality];
  }

  return qualityProfiles.standard;
}

export function resolveCinematicFilterPlan(options: {
  scene: RenderBlueprintScene;
  templateId: string;
  renderQuality: CinematicRenderQuality | string | null | undefined;
}) {
  const qualityProfile = getRenderQualityProfile(options.renderQuality);
  const basePlan =
    presetPlanRegistry[
      normalizePresetCandidate(options.scene, options.templateId)
    ];
  const energyFactor = clampNumber(
    (options.scene.energyLevel ?? 50) / 100,
    0.3,
    1.2
  );
  const transitionMode = mapTransitionToFadeMode(options.scene.transition);
  const zoomDelta =
    Math.abs(basePlan.zoomEnd - basePlan.zoomStart) *
    (0.85 + energyFactor * 0.2);
  const adjustedZoomEnd =
    basePlan.zoomDirection === "in"
      ? basePlan.zoomStart + zoomDelta
      : Math.max(1.01, basePlan.zoomStart - zoomDelta);
  const fadeMultiplier =
    transitionMode === "fast_fade" ? 0.7 : transitionMode === "cut" ? 0 : 1;
  const notes = [...basePlan.notes];

  if (basePlan.presetKey === "mystery") {
    notes.push("progressive reveal simplified to stable blur grading");
  }

  if (basePlan.presetKey === "horror") {
    notes.push("noise/grain fallback skipped to preserve Windows stability");
  }

  return {
    qualityProfile,
    plan: {
      ...basePlan,
      zoomEnd: Number(adjustedZoomEnd.toFixed(4)),
      driftX: Math.round(basePlan.driftX * (0.75 + energyFactor * 0.35)),
      driftY: Math.round(basePlan.driftY * (0.75 + energyFactor * 0.3)),
      shakeX: Math.round(basePlan.shakeX * qualityProfile.effectMultiplier),
      shakeY: Math.round(basePlan.shakeY * qualityProfile.effectMultiplier),
      overscanScale: Number(
        (basePlan.overscanScale + qualityProfile.overscanScaleBoost).toFixed(3)
      ),
      blurSigma: Number(
        (basePlan.blurSigma * qualityProfile.effectMultiplier).toFixed(3)
      ),
      fadeSeconds: Number(
        (basePlan.fadeSeconds * fadeMultiplier).toFixed(3)
      ),
      transitionMode,
      notes
    } satisfies CinematicFilterPlan,
    fadeFilters: buildFadeFilters(
      options.scene.duration ?? 4,
      transitionMode,
      basePlan.fadeSeconds * fadeMultiplier
    )
  };
}
