import type { FastCutEditorPlan, FastCutEffect } from "./fast-cut-editor.js";
import type { RemixTargetStyle } from "./remix-types.js";
import { shortSceneCount } from "./short-production-limits.js";
import type { VisualTransformerPlan } from "./visual-transformer.js";

export type RemixSceneRole =
  | "hook"
  | "context"
  | "evidence"
  | "tension"
  | "climax"
  | "outro";

export type RemixSceneSourceSegment =
  | "original_clip"
  | "comfy_insert"
  | "comfy_reconstruction"
  | "broll_overlay";

export interface RemixSceneSegment {
  sceneId: string;
  order: number;
  role: RemixSceneRole;
  startSeconds: number;
  endSeconds: number;
  sourceSegment: RemixSceneSourceSegment;
  transitionIn: string;
  effects: string[];
  captionHint: string;
  comfyVariationId: string | null;
}

export interface RemixSceneStructure {
  mode: "aggressive_restructure";
  totalScenes: number;
  originalFootprintRatio: number;
  segments: RemixSceneSegment[];
  narrativeArc: string[];
}

const ROLE_SEQUENCE: RemixSceneRole[] = [
  "hook",
  "context",
  "evidence",
  "climax",
  "outro"
];

const ROLE_CAPTIONS: Record<RemixSceneRole, string> = {
  hook: "Gancho visual imediato",
  context: "Contexto editorial",
  evidence: "Evidência / prova visual",
  tension: "Tensão narrativa",
  climax: "Clímax emocional",
  outro: "Fechamento memorável"
};

function sceneCountForDuration(durationSeconds: number, intensity: "medium" | "extreme") {
  return Math.min(ROLE_SEQUENCE.length, shortSceneCount(durationSeconds, intensity));
}

function assignSourceSegment(
  role: RemixSceneRole,
  index: number,
  intensity: "medium" | "extreme"
): RemixSceneSourceSegment {
  if (role === "hook" || role === "climax") {
    return index % 2 === 0 ? "comfy_reconstruction" : "comfy_insert";
  }
  if (role === "evidence" && intensity === "extreme") {
    return index % 3 === 0 ? "broll_overlay" : "original_clip";
  }
  if (role === "tension") {
    return "comfy_insert";
  }
  return index % 2 === 0 ? "original_clip" : "comfy_reconstruction";
}

function transitionForRole(role: RemixSceneRole): string {
  switch (role) {
    case "hook":
      return "flash-cut";
    case "context":
      return "soft-drift";
    case "evidence":
      return "cut";
    case "tension":
      return "dark-blink";
    case "climax":
      return "smash-zoom";
    case "outro":
      return "film-burn";
    default:
      return "cut";
  }
}

function effectsForRole(role: RemixSceneRole, intensity: "medium" | "extreme"): string[] {
  const power = intensity === "extreme" ? 3 : 2;
  const base: Record<RemixSceneRole, string[]> = {
    hook: ["zoom-punch", "glitch-card", "impact-freeze"],
    context: ["breath-hold", "hard-cut"],
    evidence: ["film-burn", "dark-blink"],
    tension: ["whip", "dark-blink", "glitch-card"],
    climax: ["zoom-punch", "impact-freeze", "flash"],
    outro: ["film-burn", "breath-hold"]
  };
  return base[role].slice(0, power);
}

export function buildAggressiveRemixSceneStructure(input: {
  durationSeconds: number;
  fastCutPlan: FastCutEditorPlan;
  targetStyle: RemixTargetStyle;
  intensity: "medium" | "extreme";
  visualPlan: VisualTransformerPlan;
}): RemixSceneStructure {
  const sceneCount = sceneCountForDuration(input.durationSeconds, input.intensity);
  const boundaries = [
    0,
    ...input.fastCutPlan.cutTimes.slice(0, sceneCount - 1),
    input.durationSeconds
  ];

  const segments: RemixSceneSegment[] = [];
  for (let index = 0; index < sceneCount; index += 1) {
    const role = ROLE_SEQUENCE[index] ?? "context";
    const startSeconds = boundaries[index] ?? 0;
    const endSeconds = boundaries[index + 1] ?? input.durationSeconds;
    const comfyVariation =
      input.visualPlan.comfyVariations[index] ??
      input.visualPlan.comfyVariations[index % input.visualPlan.comfyVariations.length] ??
      null;

    segments.push({
      sceneId: `remix-scene-${index + 1}`,
      order: index + 1,
      role,
      startSeconds: Number(startSeconds.toFixed(2)),
      endSeconds: Number(endSeconds.toFixed(2)),
      sourceSegment: assignSourceSegment(role, index, input.intensity),
      transitionIn: transitionForRole(role),
      effects: effectsForRole(role, input.intensity),
      captionHint: ROLE_CAPTIONS[role],
      comfyVariationId: comfyVariation?.variationId ?? null
    });
  }

  const originalScenes = segments.filter((s) => s.sourceSegment === "original_clip").length;
  const originalFootprintRatio = Number((originalScenes / segments.length).toFixed(2));

  return {
    mode: "aggressive_restructure",
    totalScenes: segments.length,
    originalFootprintRatio,
    segments,
    narrativeArc: [
      `Abertura com ${segments[0]?.sourceSegment ?? "comfy_insert"} para quebrar padrão do original.`,
      "Reestruturação editorial com cortes, inserts ComfyUI e nova trilha.",
      `Estilo alvo: ${input.targetStyle.replace(/_/g, " ")}.`,
      `${input.visualPlan.comfyVariations.length} variações visuais planejadas para substituir trechos fracos.`
    ]
  };
}

export function enhanceFastCutForAggressiveRemix(
  plan: FastCutEditorPlan,
  intensity: "medium" | "extreme"
): FastCutEditorPlan {
  if (intensity !== "extreme") {
    return plan;
  }

  const tighterAverage = Math.max(0.42, plan.averageShotLengthSeconds * 0.72);
  const extraCuts = plan.cutTimes
    .flatMap((time, index) => {
      const next = plan.cutTimes[index + 1] ?? plan.durationSeconds;
      const gap = next - time;
      if (gap < 1.2) {
        return [];
      }
      return [Number((time + gap * 0.45).toFixed(2))];
    })
    .filter((time) => time > 0 && time < plan.durationSeconds);

  const mergedCuts = [...new Set([...plan.cutTimes, ...extraCuts])].sort((a, b) => a - b);

  return {
    ...plan,
    averageShotLengthSeconds: Number(tighterAverage.toFixed(2)),
    cutTimes: mergedCuts,
    effectCues: [
      ...plan.effectCues,
      ...mergedCuts.slice(0, 4).map((time, index) => ({
        timeSeconds: time,
        effect: (index % 2 === 0 ? "glitch-card" : "impact-freeze") as FastCutEffect,
        intensity: 94
      }))
    ],
    microclipWindows: [
      ...plan.microclipWindows,
      {
        startSeconds: Number(Math.max(0.8, plan.durationSeconds * 0.38).toFixed(2)),
        endSeconds: Number(Math.min(plan.durationSeconds, plan.durationSeconds * 0.38 + 1.1).toFixed(2)),
        purpose: "breath" as const
      }
    ],
    warnings: [
      ...plan.warnings,
      "Aggressive remix: cortes mais rápidos e inserts visuais para distanciar do original."
    ]
  };
}