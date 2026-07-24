import assert from "node:assert/strict";
import { buildComicComfyVisualEnrichmentPlan } from "../packages/media-beast/dist/index.js";

const plan = buildComicComfyVisualEnrichmentPlan({
  title: "Batman White Knight",
  niche: "comics",
  tone: "dramatic suspense",
  cues: [
    {
      cueId: "cue-001",
      sourceBeatIndex: 0,
      text: "Batman perseguia o Coringa por Gotham, mas a cidade comecava a ver perigo no proprio heroi.",
      pages: ["i01-page-006.jpg"],
      role: "hook",
      hasImpact: true,
      focusTarget: "batman_joker_chase",
      verifiedFocusTargets: ["batman_joker_chase"],
      evidenceTerms: ["Batman", "Coringa", "Gotham"],
      evidenceConfidence: 0.88,
      transitionHint: "page_tear",
    },
    {
      cueId: "cue-002",
      sourceBeatIndex: 1,
      text: "Depois da perseguicao, Jack Napier usou a destruicao como argumento contra Batman.",
      pages: ["i02-page-011.jpg"],
      role: "context",
      hasDialogue: true,
      focusTarget: "jack_napier_argument",
      verifiedFocusTargets: [],
      evidenceTerms: ["Jack", "Gotham", "destruicao"],
      evidenceConfidence: 0.42,
      transitionHint: "direct",
    },
    {
      cueId: "cue-003",
      sourceBeatIndex: 2,
      text: "A guerra em Gotham explodiu quando os simbolos da cidade viraram armas politicas.",
      pages: ["i05-page-005.jpg"],
      role: "climax",
      hasImpact: true,
      focusTarget: "gotham_war",
      verifiedFocusTargets: ["gotham_war"],
      evidenceTerms: ["Gotham", "guerra", "politica"],
      evidenceConfidence: 0.72,
      transitionHint: "page_tear",
    },
  ],
  beats: [
    { issueNumber: 1, pages: [6, 7], headline: "BATMAN VIROU O PROBLEMA", role: "hook" },
    { issueNumber: 2, pages: [11, 12], headline: "JACK VIROU A CIDADE", role: "context" },
    { issueNumber: 5, pages: [5, 6], headline: "GOTHAM ENTROU EM GUERRA", role: "climax" },
  ],
  maxContextCards: 3,
});

assert.equal(plan.directorId, "comic_comfy_visual_enrichment_director_v1");
assert.equal(plan.manualApprovalRequired, true);
assert.ok(plan.items.some((item) => item.use === "cold_open"));
assert.ok(plan.items.some((item) => item.use === "thumbnail"));
assert.ok(plan.items.some((item) => item.use === "weak_panel_support"));
assert.ok(plan.items.some((item) => item.use === "impact_reconstruction"));
assert.ok(plan.items.every((item) => item.manualApprovalRequired === true));
assert.ok(plan.items.every((item) => item.prompt.includes("Vertical 9:16")));
assert.ok(plan.itemCount >= 4);

console.log(JSON.stringify({
  status: "completed",
  directorId: plan.directorId,
  itemCount: plan.itemCount,
  criticalItemCount: plan.criticalItemCount,
  uses: [...new Set(plan.items.map((item) => item.use))],
  defaultWorkflowPack: plan.recommendedDefaultWorkflowPackId,
  approval: "manual_required",
}, null, 2));