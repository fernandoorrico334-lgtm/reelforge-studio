import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();

async function main() {
  const workDir = join(root, "tmp", "comic-assisted-rerender-request-smoke");
  await mkdir(workDir, { recursive: true });
  const retryPlanPath = join(workDir, "comic-post-render-retry-plan.json");
  await writeFile(retryPlanPath, JSON.stringify({
    planId: "comic_post_render_retry_plan_v1",
    sourceVideoPath: "storage/renders/comic-demo/output.mp4",
    status: "retry_required",
    retrySceneCount: 2,
    highSeveritySceneCount: 1,
    renderWholeVideoAgain: false,
    recommendedMode: "rerender_marked_scenes_only",
    sceneRetries: [
      {
        sceneId: "scene-caixa-materna",
        order: 4,
        timeRange: { startTimeSeconds: 18.2, endTimeSeconds: 21.6, durationSeconds: 3.4 },
        severity: "high",
        actions: [
          {
            action: "retarget_crop",
            label: "recalcular zoom/crop",
            severity: "high",
            reason: "focus_target_not_visible",
            suggestedFix: "Focar a Caixa Materna, nao o Clark."
          }
        ],
        evidenceFrames: [{ timeSeconds: 19.4, outputPath: "frame-004.jpg", sha256: "a", sizeBytes: 1024 }],
        directorInstruction: "Refazer somente esta cena com crop mais aberto/inteligente."
      },
      {
        sceneId: "scene-caption",
        order: 7,
        timeRange: { startTimeSeconds: 31, endTimeSeconds: 34.1, durationSeconds: 3.1 },
        severity: "medium",
        actions: [
          {
            action: "rerender_caption",
            label: "refazer legenda",
            severity: "medium",
            reason: "caption_not_publish_safe",
            suggestedFix: "Quebrar legenda em duas frases."
          }
        ],
        evidenceFrames: [],
        directorInstruction: "Refazer legenda sem mexer no painel."
      }
    ]
  }, null, 2), "utf8");

  const outputDir = join(workDir, "out");
  await mkdir(outputDir, { recursive: true });
  const module = await import(pathToFileURL(join(root, "scripts", "comic-rerender-request-from-qa.mjs")).href);
  const retryPlan = JSON.parse(await readFile(retryPlanPath, "utf8"));
  const request = module.buildRerenderRequest({
    retryPlan,
    retryPlanPath,
    options: { episode: 1, title: "smoke-rerender", approved: false }
  });
  const requestPath = join(outputDir, "assisted-rerender-request.json");
  const reviewPath = join(outputDir, "assisted-rerender-request.md");
  await writeFile(requestPath, JSON.stringify(request, null, 2), "utf8");
  assert.equal(request.requestId, "comic_assisted_rerender_request_v1");
  assert.equal(request.retrySceneCount, 2);
  assert.equal(request.highSeveritySceneCount, 1);
  assert.equal(request.renderWholeVideoAgain, false);
  assert.equal(request.items[0].correctionType, "crop_retarget");
  assert.equal(request.items[0].safeRerenderScope, "scene_only");
  assert.equal(request.items[0].requiresHumanApproval, true);

  console.log(JSON.stringify({
    status: "completed",
    requestPath,
    reviewPath,
    retrySceneCount: request.retrySceneCount,
    firstCorrectionType: request.items[0].correctionType,
    renderWholeVideoAgain: request.renderWholeVideoAgain
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
