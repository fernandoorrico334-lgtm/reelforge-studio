import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");

async function importMediaBeast() {
  return import(pathToFileURL(join(projectRoot, "packages/media-beast/dist/index.js")).href);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function beat(role, pageNumber, panelId) {
  return {
    role,
    panelId,
    pageNumber,
    purpose: role,
    narrationText: `Narracao ${role}`,
    captionText: `Caption ${role}`,
    evidenceReason: "synthetic"
  };
}

async function main() {
  const { evaluateComicNarrativeContinuityHardGate } = await importMediaBeast();
  const common = {
    panelBattleTest: {
      testerId: "comic_panel_battle_test_v1",
      beatCount: 5,
      improvedBeatCount: 0,
      averageSelectedScore: 84,
      optimizedBeats: [],
      beatResults: [],
      selectedPanelIds: [],
      rejectedAlternatives: [],
      warnings: []
    },
    panelContinuityReport: {
      checkerId: "comic_panel_continuity_checker_v1",
      status: "passed",
      score: 92,
      pageJumpWarnings: [],
      roleSequence: ["hook", "setup", "tension", "climax", "payoff"],
      panelSequence: [],
      visualFocusSequence: [],
      bridgeNarrationHints: [],
      continuityCuts: [],
      missingContextCount: 0,
      repeatedPanelCount: 0,
      warnings: []
    },
    postRenderCropQa: {
      qaId: "comic_post_render_crop_qa_v1",
      status: "passed",
      score: 92,
      captionOverlapRiskCount: 0,
      weakFocusCount: 0,
      sceneReports: [],
      warnings: [],
      recommendations: []
    },
    finalQualityGate: {
      gateId: "comic_short_final_quality_gate_v1",
      status: "passed",
      score: 95,
      minimumScore: 82,
      blockers: [],
      warnings: [],
      recommendations: []
    }
  };

  const passed = evaluateComicNarrativeContinuityHardGate({
    beats: [
      beat("hook", 3, "p1"),
      beat("setup", 4, "p2"),
      beat("tension", 5, "p3"),
      beat("climax", 6, "p4"),
      beat("payoff", 7, "p5")
    ],
    ...common
  });
  assert(passed.status === "passed", "forward unique sequence should pass");
  assert(passed.backwardPageJumpCount === 0, "forward sequence must not have backward jumps");

  const blocked = evaluateComicNarrativeContinuityHardGate({
    beats: [
      beat("hook", 8, "p1"),
      beat("setup", 9, "p2"),
      beat("tension", 8, "p1"),
      beat("climax", 10, "p4"),
      beat("payoff", 3, "p5")
    ],
    ...common
  });
  assert(blocked.status === "blocked", "backward/repeated sequence should be blocked");
  assert(blocked.repeatedPanelCount === 1, "expected repeated panel count");
  assert(blocked.backwardPageJumpCount === 2, "expected two backward page jumps");
  assert(blocked.blockers.some((item) => item.startsWith("page_sequence_goes_backward")), "expected backward page blocker");
  assert(blocked.blockers.some((item) => item.startsWith("repeated_panels")), "expected repeated panel blocker");

  console.log(JSON.stringify({
    status: "completed",
    passed: {
      score: passed.score,
      pageSequence: passed.pageSequence,
      blockers: passed.blockers
    },
    blocked: {
      score: blocked.score,
      pageSequence: blocked.pageSequence,
      repeatedPanelCount: blocked.repeatedPanelCount,
      backwardPageJumpCount: blocked.backwardPageJumpCount,
      blockers: blocked.blockers
    }
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
