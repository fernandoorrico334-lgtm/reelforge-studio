import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { writeMinimalPng } from "./lib/smoke-utils.mjs";

const root = process.cwd();

async function main() {
  const workDir = join(root, "tmp", "comic-assisted-patch-workflow-smoke");
  await mkdir(workDir, { recursive: true });
  const caixaPanelPath = join(workDir, "page-012-caixa-materna.png");
  const mutanoPanelPath = join(workDir, "page-031-mutano-gorila.png");
  await writeMinimalPng(caixaPanelPath, "caixa");
  await writeMinimalPng(mutanoPanelPath, "mutano");

  const retryPlan = {
    planId: "comic_post_render_retry_plan_v1",
    sourceVideoPath: "storage/renders/original.mp4",
    status: "needs_scene_retries",
    retrySceneCount: 2,
    highSeveritySceneCount: 1,
    renderWholeVideoAgain: false,
    recommendedMode: "rerender_marked_scenes_only",
    sceneRetries: [
      {
        sceneId: "scene-caixa",
        order: 4,
        timeRange: { startTimeSeconds: 12, endTimeSeconds: 15, durationSeconds: 3 },
        severity: "high",
        evidenceFrames: [{ timeSeconds: 13.1, outputPath: "frame-caixa.jpg" }],
        directorInstruction: "A narracao fala da Caixa Materna, mas o foco foi Clark.",
        actions: [
          {
            action: "retarget_crop",
            reason: "focus_target_not_visible",
            suggestedFix: "Focar a caixa materna danificada."
          }
        ]
      },
      {
        sceneId: "scene-mutano",
        order: 8,
        timeRange: { startTimeSeconds: 31, endTimeSeconds: 33.2, durationSeconds: 2.2 },
        severity: "medium",
        evidenceFrames: [],
        directorInstruction: "A legenda fala que Mutano virou gorila, mas ele nao aparece.",
        actions: [
          {
            action: "swap_panel",
            reason: "wrong_visual_for_narration",
            suggestedFix: "Usar painel do Mutano gorila gigante."
          }
        ]
      }
    ]
  };

  const panelCatalog = {
    panels: [
      {
        panelId: "issue-01-page-012-panel-03",
        panelImagePath: caixaPanelPath,
        pageNumber: 12,
        panelNumber: 3,
        qualityScore: 91,
        tags: ["caixa materna", "danificada", "energia", "lex"],
        captionText: "A Caixa Materna era o alvo",
        focus: { x: 0.5, y: 0.45, zoom: 1.14 }
      },
      {
        panelId: "issue-01-page-031-panel-02",
        panelImagePath: mutanoPanelPath,
        pageNumber: 31,
        panelNumber: 2,
        qualityScore: 88,
        tags: ["mutano", "gorila", "gigante", "combate"],
        captionText: "Mutano vira um gorila gigante",
        focus: { x: 0.5, y: 0.55, zoom: 1.08 }
      }
    ]
  };

  const module = await import(pathToFileURL(join(root, "scripts", "comic-assisted-patch-workflow.mjs")).href);
  const result = await module.buildAssistedPatchWorkflow({
    retryPlan,
    panelCatalog,
    outputDir: join(workDir, "out"),
    retryPlanPath: join(workDir, "retry-plan.json"),
    options: { title: "patch workflow smoke", approvedRequest: true, topN: 2, useDraftSources: false }
  });

  const { summary, request, manifest, suggestionPlan, generationPlan } = result;
  assert.equal(summary.workflowId, "comic_assisted_patch_workflow_v1");
  assert.equal(summary.renderWholeVideoAgain, false);
  assert.equal(summary.candidateFirst, true);
  assert.equal(summary.approvalRequired, true);
  assert.equal(summary.retrySceneCount, 2);
  assert.equal(summary.patchSlotCount, 2);
  assert.equal(summary.suggestedSourceCount, 2);
  assert.equal(summary.readyTaskCount, 0);
  assert.equal(summary.waitingTaskCount, 2);
  assert.equal(request.requestId, "comic_assisted_rerender_request_v1");
  assert.equal(manifest.manifestId, "comic_scene_patch_manifest_v1");
  assert.equal(suggestionPlan.patchSourcesDraft.sources.length, 2);
  assert.equal(suggestionPlan.patchSourcesDraft.sources[0].approved, false);
  assert.equal(generationPlan.planId, "comic_scene_patch_generation_plan_v1");
  assert.equal(generationPlan.tasks[0].status, "waiting_patch_source");

  console.log(JSON.stringify({
    status: "completed",
    retrySceneCount: summary.retrySceneCount,
    patchSlotCount: summary.patchSlotCount,
    suggestedSourceCount: summary.suggestedSourceCount,
    readyTaskCount: summary.readyTaskCount,
    waitingTaskCount: summary.waitingTaskCount,
    summaryPath: summary.files.summaryPath,
    renderWholeVideoAgain: summary.renderWholeVideoAgain
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
