import { comicStoryPremiumFlowPolicy, resolveComicPremiumFlowPolicy } from "../packages/media-beast/dist/index.js";

const policy = resolveComicPremiumFlowPolicy();
const requiredGates = [
  "materialized_visual_repetition_audit",
  "narration_acting_director_v2",
  "narration_reference_dna",
  "narrator_director",
  "micro_pause_director",
  "visual_sync_director",
  "monotonic_story_progression",
  "prosody_quality_gate"
];

if (policy.policyId !== "comic_story_premium_v1") throw new Error("Unexpected comic premium policy id.");
if (policy.templateId !== "comic_story_premium_v1") throw new Error("Comic Studio must default to comic_story_premium_v1.");
if (policy.maximumDurationSeconds !== 180) throw new Error("Premium comic saga must preserve the 3-minute Shorts ceiling.");
if (policy.maximumShotDurationSeconds !== 4) throw new Error("Premium comic saga must keep shots under 4 seconds.");
if (!policy.minimumMaterializedVisualAuditPassed) throw new Error("Materialized visual audit must be mandatory.");
if (!policy.requiresMonotonicStoryProgression) throw new Error("Story progression must be monotonic.");
if (!policy.requiresManualPanelApproval) throw new Error("Manual panel approval must stay enabled.");
for (const gate of requiredGates) {
  if (!policy.gates.includes(gate)) throw new Error(`Missing premium gate: ${gate}`);
}
const overridden = resolveComicPremiumFlowPolicy({ templateId: "custom_template", editingReferencePresetId: "custom_reference" });
if (overridden.templateId !== "custom_template" || overridden.editingReferencePresetId !== "custom_reference") {
  throw new Error("Premium policy override support is broken.");
}
console.log(JSON.stringify({
  policyId: comicStoryPremiumFlowPolicy.policyId,
  templateId: policy.templateId,
  gateCount: policy.gates.length,
  requiredGatesPresent: requiredGates.length,
  maximumDurationSeconds: policy.maximumDurationSeconds,
  maximumShotDurationSeconds: policy.maximumShotDurationSeconds,
  status: "completed"
}, null, 2));
