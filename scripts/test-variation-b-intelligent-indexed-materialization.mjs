import { readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");

const BEAT_ROLES = [
  "hook",
  "context",
  "curiosity_a",
  "curiosity_b",
  "development_a",
  "development_b",
  "climax",
  "closing"
];

async function importMediaBeast() {
  return import(
    pathToFileURL(join(projectRoot, "packages/media-beast/dist/index.js")).href
  );
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function main() {
  const beast = await importMediaBeast();
  const {
    applyReferenceAlignedNarrationToPlan,
    buildUserProvidedPreflightReport,
    buildIntelligentIndexedPanelMaterializationReport,
    verifyIntelligentIndexedRenderMaterialization
  } = beast;

  const plan = applyReferenceAlignedNarrationToPlan(
    JSON.parse(await readFile(join(projectRoot, "tmp", "variation-b-gated-plan.json"), "utf8"))
  );

  const intelligentPreflight = JSON.parse(
    await readFile(join(projectRoot, "tmp", "variation-b-intelligent-preflight-report.json"), "utf8")
  );

  const legacyPreflight = await buildUserProvidedPreflightReport({
    plan,
    projectRoot,
    ffprobeCommand: process.env.FFPROBE_PATH?.trim() || "ffprobe"
  });

  const indexedBeats = intelligentPreflight.beats
    .filter((beat) => beat.selectedPanel?.panelImagePath && beat.selectedPanel?.panelImageSha256)
    .map((beat) => ({
      beatRole: beat.beatRole,
      panelId: beat.selectedPanel.panelId,
      panelImagePath: beat.selectedPanel.panelImagePath,
      panelImageSha256: beat.selectedPanel.panelImageSha256,
      cropBounds: beat.selectedPanel.cropBounds,
      sourcePagePath: beat.selectedPanel.sourcePagePath,
      pageNumber: beat.selectedPanel.pageNumber,
      sequenceId: beat.sequenceId ?? null
    }));

  assert(indexedBeats.length === BEAT_ROLES.length, "expected 8 indexed beats from intelligent preflight");

  const materialization = buildIntelligentIndexedPanelMaterializationReport({
    plan,
    beats: indexedBeats,
    beatAssignments: legacyPreflight.beatAssignments,
    assets: legacyPreflight.assetsAccepted,
    projectRoot,
    publishAssetPolicy: legacyPreflight.publishAssetPolicy
  });

  assert(
    materialization.timelineScenes.length === BEAT_ROLES.length,
    `expected 8 scenes, got ${materialization.timelineScenes.length}`
  );
  assert(materialization.timelineMode === "scene_structure", "expected scene_structure timeline");
  assert(materialization.fastCutCount === 0, "fast cuts must be disabled for indexed wiring");
  assert(
    materialization.warnings.includes("indexed_intelligent_panel_materialization:true"),
    "missing indexed materialization marker"
  );

  for (const beat of indexedBeats) {
    const scene = materialization.timelineScenes.find((entry) => entry.sceneRole === beat.beatRole);
    assert(scene, `missing scene for ${beat.beatRole}`);
    assert(scene.assetPath === beat.panelImagePath, `path mismatch for ${beat.beatRole}`);
    assert(!scene.assetPath.includes("panel-crops"), `legacy crop path leaked into ${beat.beatRole}`);
    assert(!/:topThird|:midThird|:bottomThird$/.test(scene.selectionReason ?? ""), `region crop leaked into ${beat.beatRole}`);
  }

  const integrity = await verifyIntelligentIndexedRenderMaterialization({
    beats: indexedBeats,
    timelineScenes: materialization.timelineScenes,
    ffprobeCommand: process.env.FFPROBE_PATH?.trim() || "ffprobe"
  });

  assert(integrity.canRender, `integrity failed: ${JSON.stringify(integrity.mismatches)}`);
  assert(integrity.failedSceneCount === 0, "expected zero integrity failures");
  assert(integrity.verifiedSceneCount === BEAT_ROLES.length, "expected 8 verified scenes");

  const legacyMaterialization = JSON.parse(
    await readFile(join(projectRoot, "tmp", "variation-b-user-assets-materialization.json"), "utf8")
  );
  const legacyHookScene = legacyMaterialization.timelineScenes.find((scene) => scene.sceneRole === "hook");
  const indexedHookScene = materialization.timelineScenes.find((scene) => scene.sceneRole === "hook");
  assert(
    legacyHookScene?.assetPath !== indexedHookScene?.assetPath,
    "indexed wiring should diverge from legacy materialization on hook"
  );

  const indexedMaterializationPath = join(
    projectRoot,
    "tmp",
    "variation-b-intelligent-indexed-materialization.json"
  );
  await writeFile(indexedMaterializationPath, JSON.stringify(materialization, null, 2), "utf8");

  const reportPath = join(projectRoot, "tmp", "variation-b-intelligent-indexed-materialization-test.json");
  await writeFile(
    reportPath,
    JSON.stringify(
      {
        ok: true,
        sceneCount: materialization.timelineScenes.length,
        integrity,
        indexedHookPath: indexedHookScene?.assetPath,
        legacyHookPath: legacyHookScene?.assetPath
      },
      null,
      2
    ),
    "utf8"
  );

  console.log(JSON.stringify({ ok: true, reportPath, verifiedSceneCount: integrity.verifiedSceneCount }, null, 2));
}

main().catch((error) => {
  console.error("[test-variation-b-intelligent-indexed-materialization] FAIL");
  console.error(error);
  process.exit(1);
});