import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { writeMinimalPng } from "./lib/smoke-utils.mjs";

const root = process.cwd();

async function main() {
  const workDir = join(root, "tmp", "comic-approved-patch-execution-smoke");
  const patchDir = join(workDir, "patches");
  await mkdir(patchDir, { recursive: true });
  const sourcePath = join(workDir, "approved-caixa-panel.png");
  await writeMinimalPng(sourcePath, "approved-source");

  const manifest = {
    manifestId: "comic_scene_patch_manifest_v1",
    sourceRequestId: "comic_assisted_rerender_request_v1",
    sourceVideoPath: "storage/renders/original.mp4",
    outputDir: workDir,
    patchDir,
    workDir: join(workDir, "work"),
    finalOutputPath: join(workDir, "output-patched.mp4"),
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
        instructions: ["Focar a Caixa Materna."]
      }
    ],
    timeline: []
  };

  const unapprovedSources = {
    sources: [
      {
        sceneId: "scene-caixa",
        sourcePath,
        sourceType: "image",
        approved: false,
        focus: { x: 0.5, y: 0.5, zoom: 1.1 }
      }
    ]
  };
  const approvedSources = {
    sources: [
      {
        ...unapprovedSources.sources[0],
        approved: true
      }
    ]
  };

  const module = await import(pathToFileURL(join(root, "scripts", "comic-approved-patch-execution.mjs")).href);
  const blockedPlan = await module.buildApprovedPatchExecutionPlan({
    manifest,
    patchSources: unapprovedSources,
    outputDir: workDir
  });
  const approvedPlan = await module.buildApprovedPatchExecutionPlan({
    manifest,
    patchSources: approvedSources,
    outputDir: workDir
  });

  assert.equal(blockedPlan.planId, "comic_approved_patch_execution_plan_v1");
  assert.equal(blockedPlan.canExecute, false);
  assert.equal(blockedPlan.status, "blocked_not_approved");
  assert.equal(blockedPlan.approvalReport.unapprovedSourceCount, 1);
  assert.equal(blockedPlan.renderWholeVideoAgain, false);
  assert.equal(approvedPlan.canExecute, true);
  assert.equal(approvedPlan.status, "approved_ready");
  assert.equal(approvedPlan.approvalReport.unapprovedSourceCount, 0);
  assert.equal(approvedPlan.approvalReport.readyTaskCount, 1);
  assert.equal(approvedPlan.generationPlan.tasks[0].status, "ready_to_generate");
  assert.equal(approvedPlan.generationPlan.tasks[0].source.approved, true);

  console.log(JSON.stringify({
    status: "completed",
    blockedStatus: blockedPlan.status,
    approvedStatus: approvedPlan.status,
    canExecute: approvedPlan.canExecute,
    readyTaskCount: approvedPlan.approvalReport.readyTaskCount,
    unapprovedSourceCount: approvedPlan.approvalReport.unapprovedSourceCount,
    finalOutputPath: approvedPlan.finalOutputPath,
    renderWholeVideoAgain: approvedPlan.renderWholeVideoAgain
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
