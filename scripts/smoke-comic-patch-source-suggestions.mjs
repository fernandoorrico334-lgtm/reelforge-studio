import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { writeMinimalPng } from "./lib/smoke-utils.mjs";

const root = process.cwd();

async function main() {
  const workDir = join(root, "tmp", "comic-patch-source-suggestions-smoke");
  await mkdir(workDir, { recursive: true });
  const caixaPanelPath = join(workDir, "page-012-caixa-materna.png");
  const mutanoPanelPath = join(workDir, "page-031-mutano-gorila.png");
  await writeMinimalPng(caixaPanelPath, "caixa");
  await writeMinimalPng(mutanoPanelPath, "mutano");

  const manifest = {
    manifestId: "comic_scene_patch_manifest_v1",
    sourceRequestId: "comic_assisted_rerender_request_v1",
    outputDir: workDir,
    patchDir: join(workDir, "patches"),
    renderWholeVideoAgain: false,
    patchSlots: [
      {
        slotId: "patch-001",
        requestItemId: "retry-001",
        sceneId: "scene-caixa",
        order: 4,
        correctionType: "crop_retarget",
        severity: "high",
        expectedPatchPath: join(workDir, "patches", "004-scene-caixa-patch.mp4"),
        requiredDurationSeconds: 3,
        instructions: ["A narracao fala da Caixa Materna, mas o foco foi Clark. Focar a caixa materna danificada."]
      },
      {
        slotId: "patch-002",
        requestItemId: "retry-002",
        sceneId: "scene-mutano",
        order: 8,
        correctionType: "panel_swap",
        severity: "medium",
        expectedPatchPath: join(workDir, "patches", "008-scene-mutano-patch.mp4"),
        requiredDurationSeconds: 2.4,
        instructions: ["A legenda fala que Mutano virou gorila gigante, mas ele nao aparece. Usar painel do Mutano gorila."]
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
        tags: ["caixa materna", "arma", "lex", "energia vermelha"],
        captionText: "A Caixa Materna era o alvo",
        focus: { x: 0.48, y: 0.42, zoom: 1.18 }
      },
      {
        panelId: "issue-01-page-031-panel-02",
        panelImagePath: mutanoPanelPath,
        pageNumber: 31,
        panelNumber: 2,
        qualityScore: 87,
        tags: ["mutano", "gorila gigante", "combate", "acao"],
        captionText: "Mutano se torna um gorila gigante",
        focus: { x: 0.5, y: 0.55, zoom: 1.08 }
      },
      {
        panelId: "issue-01-page-018-panel-01",
        panelImagePath: join(workDir, "missing-clark.png"),
        pageNumber: 18,
        panelNumber: 1,
        qualityScore: 70,
        tags: ["clark", "lois", "alianca"],
        captionText: "Clark olha para Lois"
      }
    ]
  };

  const module = await import(pathToFileURL(join(root, "scripts", "comic-suggest-patch-sources.mjs")).href);
  const plan = await module.buildPatchSourceSuggestionPlan({ manifest, panelCatalog, topN: 2 });

  assert.equal(plan.planId, "comic_patch_source_suggestion_plan_v1");
  assert.equal(plan.renderWholeVideoAgain, false);
  assert.equal(plan.candidateFirst, true);
  assert.equal(plan.approvalRequired, true);
  assert.equal(plan.patchSlotCount, 2);
  assert.equal(plan.suggestedSourceCount, 2);
  assert.equal(plan.patchSourcesDraft.sources.length, 2);
  assert.equal(plan.patchSourcesDraft.sources[0].approved, false);
  assert.equal(plan.patchSourcesDraft.sources[0].approvalRequired, true);
  assert.match(plan.patchSourcesDraft.sources[0].sourcePath, /caixa-materna\.png$/u);
  assert.match(plan.patchSourcesDraft.sources[1].sourcePath, /mutano-gorila\.png$/u);
  assert.ok(plan.suggestions[0].bestCandidateScore > 0);
  assert.ok(plan.suggestions[0].candidates[0].reasons.includes("source_file_exists"));

  console.log(JSON.stringify({
    status: "completed",
    patchSlotCount: plan.patchSlotCount,
    suggestedSourceCount: plan.suggestedSourceCount,
    firstSource: plan.patchSourcesDraft.sources[0].sourcePath,
    secondSource: plan.patchSourcesDraft.sources[1].sourcePath,
    approvalRequired: plan.approvalRequired,
    renderWholeVideoAgain: plan.renderWholeVideoAgain
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
