import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { compareIntelligentApprovedToRenderInput } from "./audit-variation-b-render-input-mismatch.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");

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

async function createFixtureImages(fixtureRoot) {
  await mkdir(fixtureRoot, { recursive: true });
  const approvedPath = join(fixtureRoot, "approved-panel.jpg");
  const renderPath = join(fixtureRoot, "render-input.jpg");
  const staleCachePath = join(fixtureRoot, "stale-cache.jpg");
  const fullPagePath = join(fixtureRoot, "full-page.jpg");

  await runCommand("ffmpeg", [
    "-y",
    "-hide_banner",
    "-loglevel",
    "error",
    "-f",
    "lavfi",
    "-i",
    "color=c=blue:s=800x1200",
    "-frames:v",
    "1",
    approvedPath
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
    renderPath
  ]);
  await runCommand("ffmpeg", [
    "-y",
    "-hide_banner",
    "-loglevel",
    "error",
    "-f",
    "lavfi",
    "-i",
    "color=c=orange:s=800x1200",
    "-frames:v",
    "1",
    staleCachePath
  ]);
  await runCommand("ffmpeg", [
    "-y",
    "-hide_banner",
    "-loglevel",
    "error",
    "-f",
    "lavfi",
    "-i",
    "color=c=green:s=1200x1800",
    "-frames:v",
    "1",
    fullPagePath
  ]);

  return {
    approvedPath,
    approvedSha256: await sha256File(approvedPath),
    renderPath,
    renderSha256: await sha256File(renderPath),
    staleCachePath,
    staleCacheSha256: await sha256File(staleCachePath),
    fullPagePath,
    fullPageSha256: await sha256File(fullPagePath),
    cropBounds: { x: 0, y: 0, width: 800, height: 1200 }
  };
}

async function main() {
  const beast = await importMediaBeast();
  const { verifySelectedPanelMaterialization } = beast;
  const fixtureRoot = join(projectRoot, "tmp", "variation-b-render-input-mismatch-fixtures");
  const fixture = await createFixtureImages(fixtureRoot);
  const results = [];

  const mismatch = compareIntelligentApprovedToRenderInput({
    beat: "hook",
    approvedPanel: {
      panelId: "asset-a:page1:panel1",
      panelImagePath: fixture.approvedPath,
      panelImageSha256: fixture.approvedSha256,
      cropBounds: fixture.cropBounds
    },
    renderScene: {
      sceneId: "user-fastcut-001",
      assetPath: fixture.renderPath,
      assetId: "asset-b"
    },
    manifestEntry: {
      sceneId: "user-fastcut-001",
      panelId: "asset-b:midThird",
      panelImagePath: fixture.renderPath
    },
    renderInputSha256: fixture.renderSha256
  });
  assert(!mismatch.materializedCorrectly, "approved A vs ffmpeg B must fail");
  assert(!mismatch.hashMatch, "hash mismatch expected");
  assert(!mismatch.pathMatch, "path mismatch expected");
  results.push({ case: "approved_a_render_b_fails", ok: true });

  const staleCache = compareIntelligentApprovedToRenderInput({
    beat: "context",
    approvedPanel: {
      panelId: "asset-a:page18:panel1",
      panelImagePath: fixture.approvedPath,
      panelImageSha256: fixture.approvedSha256,
      cropBounds: fixture.cropBounds
    },
    renderScene: {
      sceneId: "user-fastcut-003",
      assetPath: fixture.staleCachePath,
      assetId: "asset-stale"
    },
    manifestEntry: {
      sceneId: "user-fastcut-003",
      panelId: "asset-stale:topThird",
      panelImagePath: fixture.staleCachePath
    },
    renderInputSha256: fixture.staleCacheSha256,
    pipelineMismatch: "stale_cached_timeline_asset"
  });
  assert(!staleCache.materializedCorrectly, "stale cached render input must fail");
  assert(staleCache.reason.includes("stale_cached_timeline_asset"), "stale cache reason expected");
  results.push({ case: "stale_cache_fails", ok: true });

  const fullPageFallback = await verifySelectedPanelMaterialization({
    selectedPanel: {
      panelId: "asset-a:page1:panel1",
      panelImagePath: fixture.approvedPath,
      panelImageSha256: fixture.approvedSha256,
      cropBounds: fixture.cropBounds,
      sourcePagePath: fixture.fullPagePath
    },
    timelineScene: {
      sceneId: "user-fastcut-007",
      assetPath: fixture.fullPagePath,
      sceneRole: "development_a"
    }
  });
  assert(!fullPageFallback.ok, "full page fallback must fail");
  assert(
    fullPageFallback.mismatches.includes("full_page_rendered_instead_of_crop"),
    "full page fallback reason expected"
  );
  results.push({ case: "full_page_fallback_fails", ok: true });

  const identical = compareIntelligentApprovedToRenderInput({
    beat: "climax",
    approvedPanel: {
      panelId: "asset-a:page7:panel1",
      panelImagePath: fixture.approvedPath,
      panelImageSha256: fixture.approvedSha256,
      cropBounds: fixture.cropBounds
    },
    renderScene: {
      sceneId: "user-fastcut-009",
      assetPath: fixture.approvedPath,
      assetId: "asset-a"
    },
    manifestEntry: {
      sceneId: "user-fastcut-009",
      panelId: "asset-a:page7:panel1",
      panelImagePath: fixture.approvedPath
    },
    renderInputSha256: fixture.approvedSha256
  });
  assert(identical.materializedCorrectly, "identical approved/render hashes must pass");
  assert(identical.hashMatch && identical.pathMatch, "hash/path match expected");
  results.push({ case: "identical_hashes_pass", ok: true });

  const reportPath = join(projectRoot, "tmp", "variation-b-render-input-mismatch-test.json");
  await writeFile(reportPath, JSON.stringify({ results, fixtureRoot }, null, 2), "utf8");
  console.log(JSON.stringify({ ok: true, results, reportPath }, null, 2));
}

main().catch((error) => {
  console.error("[test-variation-b-render-input-mismatch] FAIL");
  console.error(error);
  process.exit(1);
});