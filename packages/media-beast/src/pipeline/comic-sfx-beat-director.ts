import type { ComicPremiumDirectorReport } from "./comic-premium-director.js";
import type { ComicShortProductionPlan, ComicShortScenePlan } from "./comic-shorts-factory.js";

export type ComicSfxCueType = "bass_hit" | "whoosh" | "riser" | "flash_hit" | "impact_boom" | "silence_snap";
export type ComicSfxBeatRole = "hook_hit" | "context_riser" | "tension_whoosh" | "climax_impact" | "payoff_snap";

export type ComicSfxBeatCue = {
  sceneOrder: number;
  panelId: string;
  beatRole: ComicSfxBeatRole;
  cueType: ComicSfxCueType;
  startSeconds: number;
  durationSeconds: number;
  intensity: "low" | "medium" | "high" | "extreme";
  volume: number;
  transitionSync: ComicShortScenePlan["transition"];
  captionSync: "first_caption" | "second_caption" | "scene_start" | "scene_end";
  reason: string;
  manualAssetCategoryHint: "hit" | "whoosh" | "riser" | "boom" | "transition";
};

export type ComicSfxBeatDirectorReport = {
  directorId: "comic_sfx_beat_director_v1";
  styleTarget: "viral_comic_impact";
  totalCueCount: number;
  strongestCueSceneOrder: number | null;
  averageIntensityScore: number;
  cues: ComicSfxBeatCue[];
  warnings: string[];
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function cueForScene(scene: ComicShortScenePlan, premiumCue?: string): Pick<ComicSfxBeatCue, "beatRole" | "cueType" | "intensity" | "manualAssetCategoryHint"> {
  if (scene.role === "hook") {
    return { beatRole: "hook_hit", cueType: premiumCue === "flash_hit" ? "flash_hit" : "bass_hit", intensity: "extreme", manualAssetCategoryHint: "hit" };
  }
  if (scene.role === "context") {
    return { beatRole: "context_riser", cueType: "riser", intensity: "medium", manualAssetCategoryHint: "riser" };
  }
  if (scene.role === "development") {
    return { beatRole: "tension_whoosh", cueType: "whoosh", intensity: "high", manualAssetCategoryHint: "whoosh" };
  }
  if (scene.role === "climax") {
    return { beatRole: "climax_impact", cueType: "impact_boom", intensity: "extreme", manualAssetCategoryHint: "boom" };
  }
  return { beatRole: "payoff_snap", cueType: "silence_snap", intensity: "low", manualAssetCategoryHint: "transition" };
}

function intensityScore(intensity: ComicSfxBeatCue["intensity"]): number {
  if (intensity === "extreme") return 100;
  if (intensity === "high") return 80;
  if (intensity === "medium") return 55;
  return 30;
}

function cueStart(scene: ComicShortScenePlan): number {
  if (scene.role === "hook") return 0;
  if (scene.role === "climax") return Number(Math.max(0, scene.durationSeconds * 0.18).toFixed(2));
  if (scene.role === "payoff") return Number(Math.max(0, scene.durationSeconds * 0.72).toFixed(2));
  return Number(Math.max(0, scene.durationSeconds * 0.08).toFixed(2));
}

function cueReason(scene: ComicShortScenePlan, cue: Pick<ComicSfxBeatCue, "beatRole" | "cueType">): string {
  const evidence = scene.panelVisualEvidence;
  const action = evidence?.strongestActionLabel ? `acao=${evidence.strongestActionLabel}` : "acao=role_based";
  const relation = evidence?.strongestRelationshipType ? `relacao=${evidence.strongestRelationshipType}` : "relacao=n/a";
  return `${cue.beatRole}:${cue.cueType}:scene_${scene.order}:${scene.role}:${action}:${relation}`;
}

export function directComicSfxBeatPlan(input: {
  short: ComicShortProductionPlan;
  premiumDirector?: ComicPremiumDirectorReport | null;
}): ComicSfxBeatDirectorReport {
  const warnings: string[] = [];
  let timelineOffset = 0;
  const cues: ComicSfxBeatCue[] = [];

  for (const scene of input.short.scenes) {
    const premiumDirection = input.premiumDirector?.sceneDirections.find((entry) => entry.sceneOrder === scene.order);
    const mapped = cueForScene(scene, premiumDirection?.sfxCue);
    const localStart = cueStart(scene);
    const startSeconds = Number((timelineOffset + localStart).toFixed(2));
    const volume = mapped.intensity === "extreme" ? 0.86 : mapped.intensity === "high" ? 0.74 : mapped.intensity === "medium" ? 0.56 : 0.38;
    cues.push({
      sceneOrder: scene.order,
      panelId: scene.panelId,
      beatRole: mapped.beatRole,
      cueType: mapped.cueType,
      startSeconds,
      durationSeconds: mapped.cueType === "riser" ? 0.9 : mapped.cueType === "whoosh" ? 0.45 : 0.28,
      intensity: mapped.intensity,
      volume,
      transitionSync: scene.transition,
      captionSync: scene.role === "payoff" ? "scene_end" : scene.role === "climax" ? "second_caption" : "first_caption",
      reason: cueReason(scene, mapped),
      manualAssetCategoryHint: mapped.manualAssetCategoryHint
    });
    timelineOffset += scene.durationSeconds;
  }

  if (!cues.some((cue) => cue.beatRole === "climax_impact")) warnings.push("missing_climax_impact_cue");
  if (!cues.some((cue) => cue.beatRole === "hook_hit")) warnings.push("missing_hook_hit_cue");

  const averageIntensityScore = cues.length
    ? Math.round(cues.reduce((sum, cue) => sum + intensityScore(cue.intensity), 0) / cues.length)
    : 0;
  const strongest = [...cues].sort((left, right) => intensityScore(right.intensity) - intensityScore(left.intensity))[0] ?? null;

  return {
    directorId: "comic_sfx_beat_director_v1",
    styleTarget: "viral_comic_impact",
    totalCueCount: cues.length,
    strongestCueSceneOrder: strongest?.sceneOrder ?? null,
    averageIntensityScore,
    cues,
    warnings
  };
}
