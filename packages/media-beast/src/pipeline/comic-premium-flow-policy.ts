export type ComicPremiumFlowPolicy = {
  policyId: "comic_story_premium_v1";
  templateId: string;
  editingReferencePresetId: string;
  maximumDurationSeconds: 180;
  maximumShotDurationSeconds: 4;
  minimumMaterializedVisualAuditPassed: true;
  minimumNarrationProsodyScore: number;
  maximumNarrationVisualDriftSeconds: number;
  requiresMonotonicStoryProgression: true;
  requiresManualPanelApproval: true;
  gates: string[];
};

export const comicStoryPremiumFlowPolicy: ComicPremiumFlowPolicy = {
  policyId: "comic_story_premium_v1",
  templateId: "comic_story_premium_v1",
  editingReferencePresetId: "builtin-comic-viral-reference-antman",
  maximumDurationSeconds: 180,
  maximumShotDurationSeconds: 4,
  minimumMaterializedVisualAuditPassed: true,
  minimumNarrationProsodyScore: 85,
  maximumNarrationVisualDriftSeconds: 0.02,
  requiresMonotonicStoryProgression: true,
  requiresManualPanelApproval: true,
  gates: [
    "audience_context_director",
    "temporal_hook_director",
    "issue_transition_director",
    "curiosity_engine",
    "payoff_manager",
    "cinematic_narration_director",
    "narration_language_gate",
    "narration_acting_director_v2",
    "oral_performance_rewriter",
    "pronunciation_dictionary",
    "emotion_arc_director",
    "visual_narration_contract_gate",
    "reference_style_score",
    "dialogue_awareness_director",
    "visual_drift_auto_fixer",
    "scene_emotion_voice_renderer",
    "narration_reference_dna",
    "narrator_director",
    "micro_pause_director",
    "prosody_quality_gate",
    "visual_sync_director",
    "combat_framing_director",
    "materialized_visual_repetition_audit",
    "monotonic_story_progression"
  ]
};

export function resolveComicPremiumFlowPolicy(input?: {
  templateId?: string | undefined;
  editingReferencePresetId?: string | undefined;
}): ComicPremiumFlowPolicy {
  return {
    ...comicStoryPremiumFlowPolicy,
    templateId: input?.templateId ?? comicStoryPremiumFlowPolicy.templateId,
    editingReferencePresetId: input?.editingReferencePresetId ?? comicStoryPremiumFlowPolicy.editingReferencePresetId
  };
}


