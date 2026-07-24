import type { ComicVisualNarrationContractGate } from "./comic-visual-narration-contract-gate.js";

export type ComicNarrationVisualDriftFix = {
  phraseId: string;
  sourceBeatIndex: number;
  action: "keep" | "retarget_crop" | "swap_panel" | "hold_previous";
  reason: string;
  requiredTerms: string[];
  matchedTerms: string[];
};

export type ComicNarrationVisualDriftAutoFixPlan = {
  directorId: "comic_narration_visual_drift_auto_fixer_v1";
  fixes: ComicNarrationVisualDriftFix[];
  fixCount: number;
  hardSwapCount: number;
  warnings: string[];
  passed: boolean;
};

export function buildComicNarrationVisualDriftAutoFixPlan(input: { visualContractGate: ComicVisualNarrationContractGate }): ComicNarrationVisualDriftAutoFixPlan {
  const fixes = input.visualContractGate.reviews.map((review): ComicNarrationVisualDriftFix => {
    if (review.status === "passed") return { phraseId: review.phraseId, sourceBeatIndex: review.sourceBeatIndex, action: "keep", reason: "visual already proves narration", requiredTerms: review.expectedTerms, matchedTerms: review.matchedTerms };
    const hasConcreteEvidence = review.evidenceSources.length > 0;
    const preRenderEvidenceUnavailable = review.status === "warning" && !hasConcreteEvidence && review.recommendation.startsWith("pre_render_evidence_unavailable");
    if (preRenderEvidenceUnavailable) {
      const action = review.expectedTerms.length <= 1 ? "hold_previous" : "retarget_crop";
      return {
        phraseId: review.phraseId,
        sourceBeatIndex: review.sourceBeatIndex,
        action,
        reason: "pre-render evidence unavailable; keep render path and audit materialized frames after render",
        requiredTerms: review.expectedTerms,
        matchedTerms: review.matchedTerms,
      };
    }
    if (review.matchedTerms.length > 0) return { phraseId: review.phraseId, sourceBeatIndex: review.sourceBeatIndex, action: "retarget_crop", reason: "some evidence exists; crop must prioritize matched object/person", requiredTerms: review.expectedTerms, matchedTerms: review.matchedTerms };
    if (review.expectedTerms.length <= 1) return { phraseId: review.phraseId, sourceBeatIndex: review.sourceBeatIndex, action: "hold_previous", reason: "abstract bridge phrase can reuse previous visual", requiredTerms: review.expectedTerms, matchedTerms: review.matchedTerms };
    return { phraseId: review.phraseId, sourceBeatIndex: review.sourceBeatIndex, action: "swap_panel", reason: "narration promises visual terms that are absent", requiredTerms: review.expectedTerms, matchedTerms: review.matchedTerms };
  });
  const actionable = fixes.filter((fix) => fix.action !== "keep");
  const hardSwapCount = fixes.filter((fix) => fix.action === "swap_panel").length;
  const warnings = [
    ...(hardSwapCount > 0 ? [`visual_drift_requires_panel_swap:${hardSwapCount}`] : []),
  ];
  return { directorId: "comic_narration_visual_drift_auto_fixer_v1", fixes, fixCount: actionable.length, hardSwapCount, warnings, passed: hardSwapCount === 0 };
}
