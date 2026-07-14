import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");
const fixtureRoot = join(projectRoot, "tmp", "panel-materialization-integrity-fixtures");

async function importMediaBeast() {
  return import(
    pathToFileURL(join(projectRoot, "packages/media-beast/dist/index.js")).href
  );
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function runCommand(command, args) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    child.stderr?.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolvePromise();
      else reject(new Error(`${command} failed (${code}): ${stderr.slice(-400)}`));
    });
  });
}

async function sha256File(path) {
  const bytes = await readFile(path);
  return createHash("sha256").update(bytes).digest("hex");
}

async function createFixtureImages() {
  await mkdir(fixtureRoot, { recursive: true });
  const sourcePagePath = join(fixtureRoot, "source-page.jpg");
  const panelImagePath = join(fixtureRoot, "panel-crop.jpg");
  const wrongPanelPath = join(fixtureRoot, "wrong-panel.jpg");

  await runCommand("ffmpeg", [
    "-y",
    "-hide_banner",
    "-loglevel",
    "error",
    "-f",
    "lavfi",
    "-i",
    "color=c=blue:s=1200x1800",
    "-frames:v",
    "1",
    sourcePagePath
  ]);

  await runCommand("ffmpeg", [
    "-y",
    "-hide_banner",
    "-loglevel",
    "error",
    "-i",
    sourcePagePath,
    "-vf",
    "crop=800:1200:100:200",
    "-frames:v",
    "1",
    panelImagePath
  ]);

  await runCommand("ffmpeg", [
    "-y",
    "-hide_banner",
    "-loglevel",
    "error",
    "-f",
    "lavfi",
    "-i",
    "color=c=red:s=800x1200",
    "-frames:v",
    "1",
    wrongPanelPath
  ]);

  const panelImageSha256 = await sha256File(panelImagePath);
  const sourcePageSha256 = await sha256File(sourcePagePath);

  return {
    sourcePagePath,
    sourcePageSha256,
    panelImagePath,
    panelImageSha256,
    wrongPanelPath,
    cropBounds: { x: 100, y: 200, width: 800, height: 1200 }
  };
}

function buildManifestEntry(fixture, overrides = {}) {
  const panelId = overrides.panelId ?? "asset-1:global";
  const panelImagePath = overrides.panelImagePath ?? fixture.panelImagePath;
  const panelImageSha256 = overrides.panelImageSha256 ?? fixture.panelImageSha256;
  const cropBounds = overrides.cropBounds ?? fixture.cropBounds;
  const base = {
    sceneId: overrides.sceneId ?? "user-fastcut-001",
    beatId: overrides.beatId ?? "hook",
    panelId,
    pageNumber: 3,
    sourcePagePath: fixture.sourcePagePath,
    sourcePageSha256: fixture.sourcePageSha256,
    panelImagePath,
    panelImageSha256,
    cropBounds
  };
  return {
    ...base,
    verificationHash: createHash("sha256").update(JSON.stringify(base)).digest("hex")
  };
}

function buildTimelineScene(fixture, overrides = {}) {
  return {
    sceneId: overrides.sceneId ?? "user-fastcut-001",
    assetPath: overrides.assetPath ?? fixture.panelImagePath,
    sceneRole: overrides.sceneRole ?? "hook"
  };
}

function buildAssignment(fixture, overrides = {}) {
  return {
    beatRole: overrides.beatRole ?? "hook",
    startSec: 0,
    endSec: 4,
    motion: "punch_zoom",
    assetId: "asset-1",
    assetPath: fixture.sourcePagePath,
    assetTitle: "Page 3",
    selectionReason: "mock",
    caption: "TEST",
    captionLines: ["TEST"],
    panelId: overrides.panelId ?? "asset-1:global",
    panelImagePath: overrides.panelImagePath ?? fixture.panelImagePath,
    cropBounds: overrides.cropBounds ?? fixture.cropBounds,
    cropContentHash: "mock"
  };
}

async function main() {
  const beast = await importMediaBeast();
  const {
    verifySelectedPanelMaterialization,
    verifyApprovedPanelMatchesManifest,
    SELECTED_PANEL_RENDER_PATH_MISMATCH
  } = beast;

  const fixture = await createFixtureImages();
  const results = [];

  const passCase = await verifySelectedPanelMaterialization({
    selectedPanel: {
      panelId: "asset-1:global",
      panelImagePath: fixture.panelImagePath,
      panelImageSha256: fixture.panelImageSha256,
      cropBounds: fixture.cropBounds,
      sourcePagePath: fixture.sourcePagePath
    },
    timelineScene: buildTimelineScene(fixture)
  });
  assert(passCase.ok, "expected matching crop/hash to pass");
  results.push({ case: "crop_and_hash_correct", ok: passCase.ok });

  const panelIdMismatch = verifyApprovedPanelMatchesManifest({
    approvedPanel: buildAssignment(fixture, { panelId: "asset-1:top" }),
    manifestEntry: buildManifestEntry(fixture, { panelId: "asset-1:global" })
  });
  assert(!panelIdMismatch.ok, "expected panelId mismatch to fail");
  assert(
    panelIdMismatch.mismatches.some((entry) => entry.startsWith("panel_id_mismatch")),
    "expected panel_id_mismatch reason"
  );
  results.push({ case: "panel_id_different", ok: !panelIdMismatch.ok });

  const pathMismatch = await verifySelectedPanelMaterialization({
    selectedPanel: {
      panelId: "asset-1:global",
      panelImagePath: fixture.panelImagePath,
      panelImageSha256: fixture.panelImageSha256,
      cropBounds: fixture.cropBounds,
      sourcePagePath: fixture.sourcePagePath
    },
    timelineScene: buildTimelineScene(fixture, { assetPath: fixture.wrongPanelPath })
  });
  assert(!pathMismatch.ok, "expected path mismatch to fail");
  assert(
    pathMismatch.mismatches.some((entry) => entry.startsWith("render_path_mismatch")),
    "expected render_path_mismatch reason"
  );
  results.push({ case: "path_different", ok: !pathMismatch.ok });

  const hashMismatch = await verifySelectedPanelMaterialization({
    selectedPanel: {
      panelId: "asset-1:global",
      panelImagePath: fixture.panelImagePath,
      panelImageSha256: "0".repeat(64),
      cropBounds: fixture.cropBounds,
      sourcePagePath: fixture.sourcePagePath
    },
    timelineScene: buildTimelineScene(fixture)
  });
  assert(!hashMismatch.ok, "expected hash mismatch to fail");
  assert(
    hashMismatch.mismatches.some((entry) => entry.startsWith("panel_image_sha256_mismatch")),
    "expected panel_image_sha256_mismatch reason"
  );
  results.push({ case: "hash_different", ok: !hashMismatch.ok });

  const cropBoundsMismatch = verifyApprovedPanelMatchesManifest({
    approvedPanel: buildAssignment(fixture, {
      cropBounds: { x: 0, y: 0, width: 800, height: 1200 }
    }),
    manifestEntry: buildManifestEntry(fixture)
  });
  assert(!cropBoundsMismatch.ok, "expected cropBounds mismatch to fail");
  assert(
    cropBoundsMismatch.mismatches.includes("crop_bounds_mismatch"),
    "expected crop_bounds_mismatch reason"
  );
  results.push({ case: "crop_bounds_different", ok: !cropBoundsMismatch.ok });

  const missingPath = await verifySelectedPanelMaterialization({
    selectedPanel: {
      panelId: "asset-1:global",
      panelImagePath: "",
      panelImageSha256: fixture.panelImageSha256,
      cropBounds: fixture.cropBounds,
      sourcePagePath: fixture.sourcePagePath
    },
    timelineScene: buildTimelineScene(fixture, { assetPath: null })
  });
  assert(!missingPath.ok, "expected missing panelImagePath to fail");
  assert(
    missingPath.mismatches.includes("panel_image_path_missing"),
    "expected panel_image_path_missing reason"
  );
  results.push({ case: "panel_image_path_absent", ok: !missingPath.ok });

  const fullPageFallback = await verifySelectedPanelMaterialization({
    selectedPanel: {
      panelId: "asset-1:global",
      panelImagePath: fixture.panelImagePath,
      panelImageSha256: fixture.panelImageSha256,
      cropBounds: fixture.cropBounds,
      sourcePagePath: fixture.sourcePagePath
    },
    timelineScene: buildTimelineScene(fixture, { assetPath: fixture.sourcePagePath })
  });
  assert(!fullPageFallback.ok, "expected full page fallback to fail");
  assert(
    fullPageFallback.mismatches.includes("full_page_rendered_instead_of_crop"),
    "expected full_page_rendered_instead_of_crop reason"
  );
  assert(
    fullPageFallback.blockReason === SELECTED_PANEL_RENDER_PATH_MISMATCH,
    "expected selected_panel_render_path_mismatch block reason"
  );
  results.push({ case: "full_page_fallback", ok: !fullPageFallback.ok });

  const reportPath = join(projectRoot, "tmp", "variation-b-panel-materialization-integrity-test.json");
  await writeFile(reportPath, JSON.stringify({ results, fixtureRoot }, null, 2), "utf8");

  console.log(JSON.stringify({ ok: true, results, reportPath }, null, 2));
}

main().catch((error) => {
  console.error("[test-panel-materialization-integrity] FAIL");
  console.error(error);
  process.exit(1);
});