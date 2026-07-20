import assert from "node:assert/strict";
import {
  buildComicNarrationZoomPlan,
  reviewComicCueVisualEvidence,
} from "../packages/media-beast/dist/index.js";

const evidence = [
  { page: "i01-page-0029.jpg", targets: ["mother_box", "lex"] },
  { page: "i06-page-0029.jpg", targets: ["mutano", "mutano_combat", "kong"] },
];

const verified = reviewComicCueVisualEvidence({
  pages: ["i06-page-0029.jpg"],
  requestedTarget: "mutano",
  evidence,
});
assert.equal(verified.verified, true);
assert.deepEqual(verified.matchedPages, ["i06-page-0029.jpg"]);

const rejected = reviewComicCueVisualEvidence({
  pages: ["i01-page-0030.jpg"],
  requestedTarget: "mother_box",
  evidence,
});
assert.equal(rejected.verified, false);
assert.equal(rejected.safeFramingRequired, true);

const shot = {
  shotId: "shot-1",
  beatIndex: 0,
  page: "i01-page-0030.jpg",
  pageNumber: 30,
  panelId: "panel-1",
  panelReadingOrder: 1,
  shotRole: "dialogue",
  durationSeconds: 1.5,
  normalizedCrop: { x: 0.1, y: 0.1, width: 0.8, height: 0.8 },
  cameraMove: "dialogue_push",
  transitionIn: "cut",
  isColdOpen: false,
  narrativeOrderExempt: false,
  confidence: 80,
  dialogueBalloonId: "balloon-1",
  speakerAnchor: { x: 0.5, y: 0.5 },
  semanticAssociationConfidence: 88,
  warnings: [],
};

const unsafePlan = buildComicNarrationZoomPlan({
  cues: [{
    cueId: "cue-1",
    text: "A Caixa Materna manteve o portal aberto.",
    focusTarget: "mother_box",
    verifiedFocusTargets: [],
  }],
  shots: [shot],
});
assert.equal(unsafePlan.decisions[0].targetVerified, false);
assert.equal(unsafePlan.decisions[0].aggressiveZoomAllowed, false);
assert.equal(unsafePlan.decisions[0].cameraMove, "slow_push");

const safePlan = buildComicNarrationZoomPlan({
  cues: [{
    cueId: "cue-1",
    text: "Mutano enfrentou Kong.",
    focusTarget: "mutano",
    verifiedFocusTargets: ["mutano"],
  }],
  shots: [{ ...shot, page: "i06-page-0029.jpg" }],
});
assert.equal(safePlan.decisions[0].targetVerified, true);
assert.equal(safePlan.decisions[0].aggressiveZoomAllowed, true);

console.log(JSON.stringify({
  status: "completed",
  verifiedTarget: verified.requestedTarget,
  rejectedTarget: rejected.requestedTarget,
  unsafeCameraMove: unsafePlan.decisions[0].cameraMove,
  safeCameraMove: safePlan.decisions[0].cameraMove,
}, null, 2));
