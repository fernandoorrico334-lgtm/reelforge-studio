import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();

async function main() {
  const workDir = join(root, "tmp", "comic-scene-patch-renderer-smoke");
  const outputDir = join(workDir, "out");
  await mkdir(outputDir, { recursive: true });
  const requestPath = join(workDir, "assisted-rerender-request.json");
  await writeFile(requestPath, JSON.stringify({
    requestId: "comic_assisted_rerender_request_v1",
    title: "scene patch smoke",
    sourceVideoPath: "storage/renders/demo-original.mp4",
    status: "approved",
    renderWholeVideoAgain: false,
    retrySceneCount: 2,
    items: [
      {
        requestItemId: "retry-001",
        sceneId: "scene-caixa",
        order: 4,
        episodeNumber: 1,
        timeRange: { startTimeSeconds: 12, endTimeSeconds: 15.4, durationSeconds: 3.4 },
        severity: "high",
        correctionType: "crop_retarget",
        primaryAction: "retarget_crop",
        reason: "focus_target_not_visible",
        suggestedFix: "Focar a Caixa Materna.",
        evidenceFrames: [{ timeSeconds: 13.1, outputPath: "frame-001.jpg" }],
        directorInstruction: "Refazer somente esta cena com crop correto.",
        safeRerenderScope: "scene_only",
        renderWholeVideoAgain: false,
        requiresHumanApproval: false,
        status: "approved_for_future_scene_rerender"
      },
      {
        requestItemId: "retry-002",
        sceneId: "scene-mutano",
        order: 8,
        episodeNumber: 1,
        timeRange: { startTimeSeconds: 31.2, endTimeSeconds: 34.2, durationSeconds: 3 },
        severity: "medium",
        correctionType: "panel_swap",
        primaryAction: "swap_panel",
        reason: "visual_repetition_detected",
        suggestedFix: "Trocar para painel de Mutano visivel.",
        evidenceFrames: [],
        directorInstruction: "Usar mesma pagina ou pagina posterior.",
        safeRerenderScope: "scene_only",
        renderWholeVideoAgain: false,
        requiresHumanApproval: false,
        status: "approved_for_future_scene_rerender"
      }
    ]
  }, null, 2), "utf8");

  const module = await import(pathToFileURL(join(root, "scripts", "comic-scene-patch-renderer.mjs")).href);
  const request = JSON.parse(await readFile(requestPath, "utf8"));
  const manifest = module.buildScenePatchManifest({ request, outputDir });

  assert.equal(manifest.manifestId, "comic_scene_patch_manifest_v1");
  assert.equal(manifest.patchSlotCount, 2);
  assert.equal(manifest.renderWholeVideoAgain, false);
  assert.equal(manifest.patchSlots[0].correctionType, "crop_retarget");
  assert.equal(manifest.patchSlots[0].status, "waiting_patch_clip");
  assert.ok(manifest.timeline.some((entry) => entry.type === "patch_clip"));
  assert.ok(manifest.timeline.some((entry) => entry.type === "source_slice"));
  assert.ok(manifest.timeline.at(-1).type === "source_tail");

  console.log(JSON.stringify({
    status: "completed",
    patchSlotCount: manifest.patchSlotCount,
    timelineEntryCount: manifest.timeline.length,
    firstPatchPath: manifest.patchSlots[0].expectedPatchPath,
    finalOutputPath: manifest.finalOutputPath,
    renderWholeVideoAgain: manifest.renderWholeVideoAgain
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
