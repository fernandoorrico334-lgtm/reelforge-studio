import assert from "node:assert/strict";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const beast = await import(pathToFileURL(join(root, "packages/media-beast/dist/index.js")).href);

function scene(order, overrides = {}) {
  return {
    sceneId: `scene-${order}`,
    order,
    panelId: `panel-${order}`,
    pageNumber: order + 5,
    durationSeconds: 3.2,
    frameSampleCount: 8,
    visualHash: `hash-${order}`,
    previousVisualHash: order > 1 ? `hash-${order - 1}` : null,
    repeatedFrameRisk: "none",
    blackFrameRatio: 0,
    captionVisible: true,
    captionOverflowRisk: "none",
    focusTargetVisible: true,
    narrationAligned: true,
    notes: [],
    ...overrides
  };
}

const panelMatchPlan = {
  matcherId: "comic_narration_panel_matcher_v1",
  generatedAt: new Date().toISOString(),
  beatCount: 4,
  matchedCount: 4,
  highConfidenceCount: 4,
  repeatedPanelCount: 0,
  averageScore: 88,
  warnings: [],
  matches: [1, 2, 3, 4].map((index) => ({
    beatId: `beat-${index}`,
    eventId: `event-${index}`,
    order: index,
    narrationText: `Beat ${index}`,
    selectedPanelId: `panel-${index}`,
    selectedPanelImagePath: `panel-${index}.png`,
    sourcePagePath: `page-${index}.png`,
    issueNumber: 1,
    pageNumber: index + 5,
    panelNumber: 1,
    readingOrder: index,
    normalizedCrop: { x: 0.1, y: 0.1, width: 0.8, height: 0.75 },
    score: 88,
    confidence: "high",
    reasons: ["matched"],
    warnings: [],
    zoomInstruction: {
      mode: index === 3 ? "action_focus" : "dialogue_focus",
      holdSeconds: 3,
      avoidCuttingDialogue: true,
      keepFullActionVisible: index === 3,
      preferredMotion: index === 3 ? "impact_punch_in" : "panel_pan"
    },
    alternatives: [{ panelId: `panel-${index}-alt`, panelImagePath: `panel-${index}-alt.png`, pageNumber: index + 5, panelNumber: 2, score: 78, reasons: ["same page"] }]
  }))
};

const godModeGate = {
  gateId: "comic_episode_god_mode_gate_v1",
  status: "god_ready",
  score: 94,
  renderCandidateAllowed: true,
  checks: [],
  blockers: [],
  warnings: [],
  directorNotes: []
};

const cropQa = {
  qaId: "comic_post_render_crop_qa_v1",
  status: "passed",
  score: 92,
  checkedSceneCount: 4,
  captionOverlapRiskCount: 0,
  weakFocusCount: 0,
  missingActionFocusCount: 0,
  sceneReports: [],
  cropWarnings: [],
  recommendations: []
};

const prosodyQualityGate = {
  gateId: "comic_prosody_quality_gate_v1",
  status: "passed",
  score: 91,
  emotionalRange: 0.72,
  energyLevelCount: 6,
  paceLevelCount: 4,
  multiTakeCriticalCoverage: 1,
  questionDirectionCoverage: 1,
  payoffDirectionCoverage: 1,
  averageSelectedTakeScore: 88,
  warnings: []
};

const good = beast.buildComicPostRenderDirectorReport({
  scenes: [scene(1), scene(2), scene(3), scene(4)],
  panelMatchPlan,
  godModeGate,
  cropQa,
  visualDriftFixPlan: { directorId: "comic_narration_visual_drift_auto_fixer_v1", fixes: [], fixCount: 0, hardSwapCount: 0, warnings: [], passed: true },
  prosodyQualityGate,
  measuredNarrationHumanScore: 92
});

assert.equal(good.reportId, "comic_post_render_director_v1");
assert.equal(good.status, "approved");
assert.equal(good.retryActions.length, 0);
assert.ok(good.score >= 90);

const bad = beast.buildComicPostRenderDirectorReport({
  scenes: [
    scene(1),
    scene(2, { visualHash: "hash-1", previousVisualHash: "hash-1", repeatedFrameRisk: "high" }),
    scene(3, { focusTargetVisible: false, narrationAligned: false, captionOverflowRisk: "high", durationSeconds: 4.8 }),
    scene(4, { captionVisible: false })
  ],
  panelMatchPlan: { ...panelMatchPlan, averageScore: 52, repeatedPanelCount: 1, highConfidenceCount: 1 },
  godModeGate: { ...godModeGate, status: "needs_director_review", score: 78, renderCandidateAllowed: false, warnings: ["panel_match_score"] },
  cropQa: { ...cropQa, status: "needs_review", score: 70, captionOverlapRiskCount: 2, weakFocusCount: 1, cropWarnings: ["caption_overlap"] },
  visualDriftFixPlan: {
    directorId: "comic_narration_visual_drift_auto_fixer_v1",
    fixes: [{ phraseId: "p3", sourceBeatIndex: 2, action: "swap_panel", reason: "missing visual terms", requiredTerms: ["Batman"], matchedTerms: [] }],
    fixCount: 1,
    hardSwapCount: 1,
    warnings: ["visual_drift_requires_panel_swap:1"],
    passed: false
  },
  prosodyQualityGate: { ...prosodyQualityGate, status: "rejected", score: 62, warnings: ["emotional_curve_too_flat"] },
  measuredNarrationHumanScore: 64
});

assert.equal(bad.status, "blocked");
assert.ok(bad.retryActions.some((action) => action.action === "swap_panel"));
assert.ok(bad.retryActions.some((action) => action.action === "resync_narration"));
assert.ok(bad.retryActions.some((action) => action.action === "rerender_caption"));
assert.ok(bad.retryActions.some((action) => action.action === "regenerate_narration_take"));
assert.ok(bad.blockers.some((blocker) => blocker.startsWith("hard_retry_actions")));

console.log(JSON.stringify({
  status: "completed",
  goodStatus: good.status,
  goodScore: good.score,
  badStatus: bad.status,
  badScore: bad.score,
  retrySceneCount: bad.retrySceneCount,
  retryActions: bad.retryActions.map((action) => ({ order: action.order, action: action.action, reason: action.reason, severity: action.severity })),
  blockers: bad.blockers
}, null, 2));
