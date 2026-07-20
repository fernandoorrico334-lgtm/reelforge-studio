import type { ComicDetectedPage, ComicPanelShot } from "./comic-panel-shot-director.js";

export type ComicCombatFramingDecision = {
  shotId: string;
  mode: "standard_crop" | "full_panel_stage";
  sourcePixelAspectRatio: number;
  isCombatShot: boolean;
  preservesAttackerAndTarget: boolean;
  maximumZoomIntensity: number;
  cameraStrategy: "standard" | "establish_then_impact_pan";
  targetFocusX: number;
  reason: string;
};

export type ComicCombatFramingPlan = {
  directorId: "comic_combat_framing_director_v1";
  decisionCount: number;
  fullPanelStageCount: number;
  unsafeWideCombatCropCount: number;
  decisions: ComicCombatFramingDecision[];
  passed: boolean;
};

function round(value: number) {
  return Math.round(value * 1000) / 1000;
}

export function buildComicCombatFramingPlan(input: {
  shots: ComicPanelShot[];
  detectedPages: ComicDetectedPage[];
  wideCombatAspectThreshold?: number;
}): ComicCombatFramingPlan {
  const pageMap = new Map(input.detectedPages.map((page) => [page.page, page]));
  const threshold = input.wideCombatAspectThreshold ?? 0.82;
  const decisions = input.shots.map((shot): ComicCombatFramingDecision => {
    const page = pageMap.get(shot.page);
    const pixelAspect = page
      ? (shot.normalizedCrop.width * page.width) / Math.max(1, shot.normalizedCrop.height * page.height)
      : shot.normalizedCrop.width / Math.max(0.01, shot.normalizedCrop.height);
    const isCombat = shot.shotRole === "action" || shot.shotRole === "impact" || shot.shotRole === "cold_open";
    const needsFullPanel = isCombat && pixelAspect > threshold;
    return {
      shotId: shot.shotId,
      mode: needsFullPanel ? "full_panel_stage" : "standard_crop",
      sourcePixelAspectRatio: round(pixelAspect),
      isCombatShot: isCombat,
      preservesAttackerAndTarget: needsFullPanel,
      maximumZoomIntensity: needsFullPanel ? 0.065 : 0.1,
      cameraStrategy: needsFullPanel ? "establish_then_impact_pan" : "standard",
      targetFocusX: shot.speakerAnchor
        ? Math.max(0.18, Math.min(0.82, (shot.speakerAnchor.x - shot.normalizedCrop.x) / Math.max(0.01, shot.normalizedCrop.width)))
        : 0.5,
      reason: needsFullPanel ? "wide_combat_panel_preserves_action_pair" : "vertical_safe_standard_crop",
    };
  });
  const unsafeWideCombatCropCount = decisions.filter((decision) =>
    decision.isCombatShot && decision.sourcePixelAspectRatio > threshold && decision.mode !== "full_panel_stage"
  ).length;
  return {
    directorId: "comic_combat_framing_director_v1",
    decisionCount: decisions.length,
    fullPanelStageCount: decisions.filter((decision) => decision.mode === "full_panel_stage").length,
    unsafeWideCombatCropCount,
    decisions,
    passed: unsafeWideCombatCropCount === 0,
  };
}
