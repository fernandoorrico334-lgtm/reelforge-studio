export type TimelineSceneFootprint = {
  visualSourceType: string;
  assetPath?: string | null;
  sourcePath?: string | null;
  durationSeconds: number;
};

export function calculateSourceFootprintRatio(input: {
  timelineScenes: TimelineSceneFootprint[];
  referenceVideoPath?: string | null;
}): number {
  const total = input.timelineScenes.reduce((acc, scene) => acc + scene.durationSeconds, 0);
  if (total <= 0) return 0;

  const referenceSeconds = input.timelineScenes
    .filter((scene) => scene.visualSourceType === "reference_video")
    .reduce((acc, scene) => acc + scene.durationSeconds, 0);

  return Number((referenceSeconds / total).toFixed(4));
}

export function validateSourceFootprint(input: {
  sourceFootprintRatio: number;
  allowReferenceVideoInFinal?: boolean;
  maxAllowedSourceFootprintRatio?: number;
}): {
  ok: boolean;
  reason?: string;
  warnings: string[];
} {
  const warnings: string[] = [];
  const maxAllowed = input.maxAllowedSourceFootprintRatio ?? 0.2;
  const ratio = input.sourceFootprintRatio;

  if (input.allowReferenceVideoInFinal === true) {
    if (ratio > maxAllowed) {
      warnings.push(
        `reference_video_footprint_high: ${(ratio * 100).toFixed(1)}% (limite ${(maxAllowed * 100).toFixed(0)}%)`
      );
    }
    return { ok: ratio <= maxAllowed, warnings };
  }

  if (ratio > 0.001) {
    return {
      ok: false,
      reason: "reference_video_blocked_as_final_visual",
      warnings: [
        ...warnings,
        `reference_video_blocked_as_final_visual (${(ratio * 100).toFixed(1)}% do timeline usa vídeo referência)`
      ]
    };
  }

  return { ok: true, warnings };
}

export const INSUFFICIENT_ASSETS_ERROR = "insufficient_approved_assets_for_remix_render";