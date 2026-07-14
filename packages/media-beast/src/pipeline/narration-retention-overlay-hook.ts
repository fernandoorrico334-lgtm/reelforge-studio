import type { ProductionEmotion } from "./niche-production-profiles.js";
import type { NarrationBeatDraft } from "./narration-curiosity-engine.js";
import {
  isNarrationRetentionEngineEnabled,
  refineRemixNarrationWithRetention,
  type NarrationRetentionOverlayMetadata
} from "./narration-retention-adapter.js";
import type { NarrationVariantAngle } from "./narration-retention-packs.js";
import type { RemixResearchDossier } from "./remix-research-bridge.js";
import type { RemixTargetStyle } from "./remix-types.js";
import type { VideoRemixAnalysis } from "./remix-video-analyzer.js";

export interface RetentionOverlayHookInput {
  legacyBeats: NarrationBeatDraft[];
  legacyScript: string;
  analysis: VideoRemixAnalysis;
  targetStyle: RemixTargetStyle;
  productionEmotion: ProductionEmotion;
  maxDurationSeconds: number;
  seed: string;
  variationIndex?: number;
  priorVariationScripts?: string[];
  priorVariationAngles?: NarrationVariantAngle[];
  researchDossier?: RemixResearchDossier | null;
}

export interface RetentionOverlayHookResult {
  narrationBeats: NarrationBeatDraft[];
  suggestedScript: string;
  retentionMetadata?: NarrationRetentionOverlayMetadata;
  retentionAttempted: boolean;
}

export function applyRetentionRefinementToOverlay(
  input: RetentionOverlayHookInput
): RetentionOverlayHookResult {
  if (!isNarrationRetentionEngineEnabled()) {
    return {
      narrationBeats: input.legacyBeats,
      suggestedScript: input.legacyScript,
      retentionAttempted: false
    };
  }

  const retentionRefine = refineRemixNarrationWithRetention({
    legacyBeats: input.legacyBeats,
    legacyScript: input.legacyScript,
    analysis: input.analysis,
    researchDossier: input.researchDossier ?? input.analysis.researchDossier,
    targetStyle: input.targetStyle,
    variationIndex: input.variationIndex ?? 0,
    productionEmotion: input.productionEmotion,
    priorVariationScripts: input.priorVariationScripts ?? [],
    priorVariationAngles: input.priorVariationAngles ?? [],
    seed: input.seed,
    maxDurationSeconds: input.maxDurationSeconds
  });

  const useRefinedOutput =
    retentionRefine.usedRetentionEngine ||
    retentionRefine.metadata.fallbackMode === "partial_upgrade_on_legacy";

  return {
    narrationBeats: useRefinedOutput ? retentionRefine.narrationBeats : input.legacyBeats,
    suggestedScript: useRefinedOutput ? retentionRefine.suggestedScript : input.legacyScript,
    retentionMetadata: retentionRefine.metadata,
    retentionAttempted: true
  };
}