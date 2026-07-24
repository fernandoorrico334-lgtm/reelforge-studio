import { mkdir, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { buildGodModePatchCycleFromRetryPlan } from "./comic-god-mode-patch-cycle.mjs";

const outputDir = resolve("tmp/smoke-comic-god-mode-patch-cycle");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  await rm(outputDir, { recursive: true, force: true });
  await mkdir(outputDir, { recursive: true });

  const retryPlan = {
    planId: "comic_post_render_retry_plan_v1",
    status: "retry_required",
    sourceVideoPath: "storage/renders/comic/test-output.mp4",
    retrySceneCount: 1,
    renderWholeVideoAgain: false,
    recommendedMode: "rerender_marked_scenes_only",
    sceneRetries: [
      {
        sceneId: "scene-portal",
        order: 3,
        startTimeSeconds: 12,
        endTimeSeconds: 15.5,
        durationSeconds: 3.5,
        severity: "high",
        correctionType: "swap_panel",
        primaryAction: "replace_visual_focus",
        reason: "Narration mentions the portal but the shot repeats a Superman close-up.",
        suggestedFix: "Use the panel with the portal and keep page order moving forward.",
        timeRange: { startTimeSeconds: 12, endTimeSeconds: 15.5 }
      }
    ]
  };

  const panelCatalog = {
    panels: [
      {
        panelId: "panel-portal-01",
        pageNumber: 14,
        sourcePath: "storage/assets/comics/test/page-014-panel-03.png",
        tags: ["portal", "caixa materna", "impacto"],
        characters: ["Lex Luthor"],
        speechText: "A caixa abriu o portal.",
        visualRole: "action",
        score: 91
      },
      {
        panelId: "panel-batman-01",
        pageNumber: 6,
        sourcePath: "storage/assets/comics/test/page-006-panel-01.png",
        tags: ["batman"],
        characters: ["Batman"],
        speechText: "Batman observa Gotham.",
        visualRole: "context",
        score: 65
      }
    ]
  };

  const retryPlanPath = join(outputDir, "retry-plan.json");
  await writeFile(retryPlanPath, JSON.stringify(retryPlan, null, 2), "utf8");

  const result = await buildGodModePatchCycleFromRetryPlan({
    retryPlan,
    retryPlanPath,
    panelCatalog,
    outputDir,
    options: {
      mode: "from-retry-plan",
      approvedRequest: true,
      topN: 2
    }
  });

  assert(result.summary.cycleId === "comic_god_mode_patch_cycle_v1", "Unexpected cycle id.");
  assert(result.summary.status === "review_required", "Cycle should require review.");
  assert(result.summary.patchSlotCount === 1, "Expected one patch slot.");
  assert(result.summary.suggestedSourceCount >= 1, "Expected at least one suggested source.");
  assert(result.summary.approvalRequired === true, "Approval gate must be active.");
  assert(result.summary.nextCommands.approveAndExecute.includes("--approved"), "Execution command must require approval.");
  assert(result.workflow.suggestionPlan.patchSourcesDraft.sources.every((source) => source.approved === false), "Draft sources must not be auto-approved.");

  console.log(JSON.stringify({
    status: "completed",
    summaryPath: result.summary.files.summaryPath,
    reviewPath: result.summary.files.reviewPath,
    patchSlotCount: result.summary.patchSlotCount,
    suggestedSourceCount: result.summary.suggestedSourceCount,
    approvalRequired: result.summary.approvalRequired
  }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({
    status: "failed",
    error: error instanceof Error ? error.message : String(error)
  }, null, 2));
  process.exitCode = 1;
});
