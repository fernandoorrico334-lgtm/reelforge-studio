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
  sceneReports: Array<{
    panelId: string;
    beatRole: string;
    captionRisk: string;
    focusScore: number;
    safeZone: string;
    previewCheck: string;
    fixInstruction: string;
  }>;
  cropWarnings: string[];
  recommendations: string[];
};

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function fixInstruction(input: { captionRisk: string; focusScore: number; beatRole: string; hasActionFocus: boolean }) {
  if (input.captionRisk === "high") return "Mover legenda para zona sem balao ou reduzir caption para uma linha.";
  if (input.focusScore < 68) return "Recalcular crop usando primaryFocus do visual detector.";
  if ((input.beatRole === "hook" || input.beatRole === "climax") && !input.hasActionFocus) return "Trocar painel por alternativa com impacto visual claro.";
  return "Manter crop; validar preview de 8 segundos antes do render final.";
}

export function evaluateComicPostRenderCropQa(input: {
  visualDirections: ComicArcVisualDirection[];
  captionImpactPlan: ComicCaptionImpactPlan;
  longStoryReaderSafeMode?: boolean;
}): ComicPostRenderCropQaReport {
  const cropWarnings: string[] = [];
  let captionOverlapRiskCount = 0;
  let weakFocusCount = 0;
  let missingActionFocusCount = 0;
  const sceneReports: ComicPostRenderCropQaReport["sceneReports"] = [];
  for (const direction of input.visualDirections) {
    const map = direction.visualEvidenceMap;
    const focus = map?.visualFocus;
    const captionRiskForQa = input.longStoryReaderSafeMode && map?.layoutMap.captionRisk === "high" ? "medium" : map?.layoutMap.captionRisk;
    if (captionRiskForQa === "high") {
      captionOverlapRiskCount += 1;
      cropWarnings.push(`caption_overlap_risk:${direction.panelId}:${direction.beatRole}`);
    }
    const focusThreshold = input.longStoryReaderSafeMode ? 42 : 68;
    if ((focus?.focusScore ?? 0) < focusThreshold) {
      weakFocusCount += 1;
      cropWarnings.push(`weak_visual_focus:${direction.panelId}:${focus?.focusScore ?? 0}`);
    }
    if (!input.longStoryReaderSafeMode && (direction.beatRole === "hook" || direction.beatRole === "climax") && focus?.hasActionFocus !== true) {
      missingActionFocusCount += 1;
      cropWarnings.push(`missing_action_focus:${direction.panelId}:${direction.beatRole}`);
    }
    const captionRisk = captionRiskForQa ?? "unknown";
    const focusScore = focus?.focusScore ?? 0;
    sceneReports.push({
      panelId: direction.panelId,
      beatRole: direction.beatRole,
      captionRisk,
      focusScore,
      safeZone: direction.captionSafeZone,
      previewCheck: `frame_check:${direction.panelId}:${direction.captionSafeZone}:${focus?.primaryFocus.type ?? direction.primaryTarget}`,
      fixInstruction: fixInstruction({ captionRisk, focusScore, beatRole: direction.beatRole, hasActionFocus: focus?.hasActionFocus === true })
    });
  }
  const captionWarnings = input.captionImpactPlan.warnings.map((warning) => `caption:${warning}`);
  const score = clampScore(
    98 -
      captionOverlapRiskCount * 15 -
      weakFocusCount * (input.longStoryReaderSafeMode ? 3 : 10) -
      missingActionFocusCount * 12 -
      captionWarnings.length * (input.longStoryReaderSafeMode ? 2 : 6)
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
    sceneReports,
    cropWarnings: [...cropWarnings, ...captionWarnings],
    recommendations
  };
}
