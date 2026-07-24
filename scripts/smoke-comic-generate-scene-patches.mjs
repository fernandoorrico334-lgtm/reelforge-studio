import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { writeMinimalPng } from "./lib/smoke-utils.mjs";

const root = process.cwd();

async function main() {
  const workDir = join(root, "tmp", "comic-generate-scene-patches-smoke");
  const patchDir = join(workDir, "patches");
  await mkdir(patchDir, { recursive: true });
  const sourceImagePath = join(workDir, "approved-caixa-panel.png");
  await writeMinimalPng(sourceImagePath, "patch-source");

  const manifest = {
    manifestId: "comic_scene_patch_manifest_v1",
    sourceRequestId: "comic_assisted_rerender_request_v1",
    sourceVideoPath: "storage/renders/original.mp4",
    outputDir: workDir,
    patchDir,
    renderWholeVideoAgain: false,
    patchSlots: [
      {
        slotId: "patch-001",
        requestItemId: "retry-001",
        sceneId: "scene-caixa",
        order: 4,
        correctionType: "crop_retarget",
        severity: "high",
        timeRange: { startTimeSeconds: 12, endTimeSeconds: 15, durationSeconds: 3 },
        expectedPatchPath: join(patchDir, "004-scene-caixa-patch.mp4"),
        requiredDurationSeconds: 3,
        instructions: ["Focar a Caixa Materna, nao Clark."]
      },
      {
        slotId: "patch-002",
        requestItemId: "retry-002",
        sceneId: "scene-mutano",
        order: 8,
        correctionType: "panel_swap",
        severity: "medium",
        timeRange: { startTimeSeconds: 31, endTimeSeconds: 33.2, durationSeconds: 2.2 },
        expectedPatchPath: join(patchDir, "008-scene-mutano-patch.mp4"),
        requiredDurationSeconds: 2.2,
        instructions: ["Trocar para painel com Mutano visivel."]
      }
    ]
  };

  const patchSources = {
    sources: [
      {
        sceneId: "scene-caixa",
        sourcePath: sourceImagePath,
        sourceType: "image",
        captionText: "A CAIXA MATERNA ERA O ALVO",
        focus: { x: 0.5, y: 0.5, zoom: 1.12 },
        approved: true
      }
    ]
  };

  const module = await import(pathToFileURL(join(root, "scripts", "comic-generate-scene-patches.mjs")).href);
  const plan = await module.buildPatchGenerationPlan({ manifest, patchSources });

  assert.equal(plan.planId, "comic_scene_patch_generation_plan_v1");
  assert.equal(plan.renderWholeVideoAgain, false);
  assert.equal(plan.patchTaskCount, 2);
  assert.equal(plan.readyTaskCount, 1);
  assert.equal(plan.waitingTaskCount, 1);
  assert.equal(plan.tasks[0].strategy, "image_zoom_patch");
  assert.equal(plan.tasks[0].status, "ready_to_generate");
  assert.equal(plan.tasks[0].outputPath, manifest.patchSlots[0].expectedPatchPath);
  assert.ok(Array.isArray(plan.tasks[0].ffmpegArgsPreview));
  assert.equal(plan.tasks[1].strategy, "image_panel_patch");
  assert.equal(plan.tasks[1].status, "waiting_patch_source");

  console.log(JSON.stringify({
    status: "completed",
    patchTaskCount: plan.patchTaskCount,
    readyTaskCount: plan.readyTaskCount,
    waitingTaskCount: plan.waitingTaskCount,
    firstStrategy: plan.tasks[0].strategy,
    firstOutputPath: plan.tasks[0].outputPath,
    renderWholeVideoAgain: plan.renderWholeVideoAgain
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
