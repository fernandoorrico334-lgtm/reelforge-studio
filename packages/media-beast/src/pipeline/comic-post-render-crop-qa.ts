import type { ComicArcVisualDirection } from "./comic-arc-visual-director.js";
import type { ComicCaptionImpactPlan } from "./comic-caption-impact-director.js";

export type ComicPostRenderCropQaReport = {
  qaId: "comic_post_render_crop_qa_v1";
  status: "passed" | "needs_review" | "rejected";
  score: number;
  checkedSceneCount: number;
  captionOverlapRiskCount: number;
  weakFocusCount: number;
  missingActionFocusCount: number;
  cropWarnings: string[];
  recommendations: string[];
};

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function evaluateComicPostRenderCropQa(input: {
  visualDirections: ComicArcVisualDirection[];
  captionImpactPlan: ComicCaptionImpactPlan;
}): ComicPostRenderCropQaReport {
  const cropWarnings: string[] = [];
  let captionOverlapRiskCount = 0;
  let weakFocusCount = 0;
  let missingActionFocusCount = 0;
  for (const direction of input.visualDirections) {
    const map = direction.visualEvidenceMap;
    const focus = map?.visualFocus;
    if (map?.layoutMap.captionRisk === "high") {
      captionOverlapRiskCount += 1;
      cropWarnings.push(`caption_overlap_risk:${direction.panelId}:${direction.beatRole}`);
    }
    if ((focus?.focusScore ?? 0) < 68) {
      weakFocusCount += 1;
      cropWarnings.push(`weak_visual_focus:${direction.panelId}:${focus?.focusScore ?? 0}`);
    }
    if ((direction.beatRole === "hook" || direction.beatRole === "climax") && focus?.hasActionFocus !== true) {
      missingActionFocusCount += 1;
      cropWarnings.push(`missing_action_focus:${direction.panelId}:${direction.beatRole}`);
    }
  }
  const captionWarnings = input.captionImpactPlan.warnings.map((warning) => `caption:${warning}`);
  const score = clampScore(
    98 -
      captionOverlapRiskCount * 15 -
      weakFocusCount * 10 -
      missingActionFocusCount * 12 -
      captionWarnings.length * 6
  );
  const status = score >= 86 ? "passed" : score >= 72 ? "needs_review" : "rejected";
  const recommendations: string[] = [];
  if (captionOverlapRiskCount) recommendations.push("Mover legenda para zona segura ou reduzir texto no quadro.");
  if (weakFocusCount) recommendations.push("Trocar crop para rosto, golpe ou conflito principal.");
  if (missingActionFocusCount) recommendations.push("Hook/climax precisam mostrar acao visual clara.");
  if (!recommendations.length) recommendations.push("Render preview pode seguir; revisar manualmente antes de publicar.");
  return {
    qaId: "comic_post_render_crop_qa_v1",
    status,
    score,
    checkedSceneCount: input.visualDirections.length,
    captionOverlapRiskCount,
    weakFocusCount,
    missingActionFocusCount,
    cropWarnings: [...cropWarnings, ...captionWarnings],
    recommendations
  };
}
