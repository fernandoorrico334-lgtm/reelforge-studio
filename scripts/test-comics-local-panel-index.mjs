import { createHash } from "node:crypto";
import { access, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");
const assetDir = join(projectRoot, "storage/assets/user-provided/remix/venom-partner");

const MYSTICAL_PAGE = {
  id: "user-remix-asset-505d6d331cf6",
  filename: "remix-asset-505d6d331cf6.jpg",
  title: "O ESPETACULAR HOMEM-ARANHA/VENOM: Espiral Mortal (2026) — página 30",
  description: "O ESPETACULAR HOMEM-ARANHA/VENOM: Espiral Mortal (2026) — página 30",
  tags: ["venom", "homem-aranha", "espiral mortal", "marvel"]
};

async function importMediaBeast() {
  return import(
    pathToFileURL(join(projectRoot, "packages/media-beast/dist/index.js")).href
  );
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function fileExists(path) {
  try {
    await access(path, constants.F_OK | constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

async function probePage(assetPath) {
  const { spawn } = await import("node:child_process");
  const ffprobe = process.env.FFPROBE_PATH?.trim() || "ffprobe";
  return new Promise((resolvePromise, reject) => {
    const child = spawn(
      ffprobe,
      [
        "-v",
        "error",
        "-select_streams",
        "v:0",
        "-show_entries",
        "stream=width,height",
        "-of",
        "json",
        assetPath
      ],
      { stdio: ["ignore", "pipe", "pipe"] }
    );
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`ffprobe failed: ${stderr.slice(-300)}`));
        return;
      }
      const parsed = JSON.parse(stdout);
      const stream = parsed.streams?.[0];
      resolvePromise({
        width: Number(stream?.width ?? 0),
        height: Number(stream?.height ?? 0)
      });
    });
  });
}

function hashFileMeta(assetPath, bytes, width, height) {
  return createHash("sha256")
    .update(`${assetPath}|${bytes}|${width}x${height}`)
    .digest("hex")
    .slice(0, 12);
}

async function main() {
  const {
    upsertLocalComicPanelIndex,
    loadLocalComicPanelIndex,
    validateLocalEvidenceDoesNotInheritParent,
    LOCAL_PANEL_INDEX_FILENAME,
    extractParentContextFromPageMetadata
  } = await importMediaBeast();

  const assetPath = join(assetDir, MYSTICAL_PAGE.filename);
  assert(await fileExists(assetPath), `missing test asset: ${assetPath}`);

  const parentContext = extractParentContextFromPageMetadata({
    title: MYSTICAL_PAGE.title,
    description: MYSTICAL_PAGE.description,
    tags: MYSTICAL_PAGE.tags
  });
  assert(
    parentContext.parentEntities.includes("venom"),
    "parentContext should list venom from page title for discovery"
  );

  const { stat } = await import("node:fs/promises");
  const fileStat = await stat(assetPath);
  const dims = await probePage(assetPath);
  const contentHash = hashFileMeta(assetPath, fileStat.size, dims.width, dims.height);

  const pageInput = {
    id: MYSTICAL_PAGE.id,
    assetPath,
    title: MYSTICAL_PAGE.title,
    description: MYSTICAL_PAGE.description,
    tags: MYSTICAL_PAGE.tags,
    width: dims.width,
    height: dims.height,
    contentHash,
    mediaType: "raster"
  };

  const first = await upsertLocalComicPanelIndex({
    assetDirectory: assetDir,
    pages: [pageInput],
    forceRebuild: true
  });

  assert(first.index.panelCount > 0, "expected at least one indexed panel");
  const indexPath = join(assetDir, LOCAL_PANEL_INDEX_FILENAME);
  assert(await fileExists(indexPath), `index file missing: ${indexPath}`);

  const savedRaw = JSON.parse(await readFile(indexPath, "utf8"));
  assert(savedRaw.version === 1, "index version should be 1");
  assert(savedRaw.pages.length === 1, "expected one indexed page");

  const indexedPage = first.index.pages.find(
    (page) => page.sourceContentHash === contentHash
  );
  assert(indexedPage, "indexed page not found in upsert result");

  const panelShaById = new Map(
    indexedPage.panels.map((panel) => [panel.panelId, panel.panelImageSha256])
  );

  let mysticalPanelCount = 0;
  for (const panel of indexedPage.panels) {
    const inheritance = validateLocalEvidenceDoesNotInheritParent(panel);
    assert(inheritance.ok, `inheritance violation on ${panel.panelId}: ${inheritance.violations.join(", ")}`);

    const localNames = panel.localEvidence.characters.map((entry) => entry.name);
    const hasVenom = localNames.includes("venom");
    const hasMysticalPair =
      localNames.includes("doctor_strange") && localNames.includes("black_widow");

    if (hasMysticalPair) {
      mysticalPanelCount += 1;
      assert(!hasVenom, `${panel.panelId} must not inherit venom from parent title`);
      assert(
        !panel.localEvidence.visualThemes.some((theme) =>
          MYSTICAL_PAGE.tags.includes(theme)
        ),
        `${panel.panelId} must not copy parent tags into visualThemes`
      );
    }
  }

  assert(
    mysticalPanelCount > 0,
    "expected at least one panel with doctor_strange + black_widow local evidence"
  );

  const second = await upsertLocalComicPanelIndex({
    assetDirectory: assetDir,
    pages: [pageInput]
  });

  const cachedPage = second.index.pages.find(
    (page) => page.sourceContentHash === contentHash
  );
  assert(cachedPage, "cached page missing on second upsert");

  for (const panel of cachedPage.panels) {
    assert(
      panelShaById.get(panel.panelId) === panel.panelImageSha256,
      `panel crop changed on cache hit: ${panel.panelId}`
    );
  }

  const reloaded = await loadLocalComicPanelIndex(assetDir);
  assert(reloaded?.panelCount === first.index.panelCount, "reloaded panel count mismatch");

  console.log(
    JSON.stringify(
      {
        ok: true,
        indexPath,
        panelCount: first.index.panelCount,
        mysticalPanelCount,
        parentEntities: parentContext.parentEntities,
        samplePanel: indexedPage.panels.find((panel) =>
          panel.localEvidence.characters.some((entry) => entry.name === "doctor_strange")
        )
      },
      null,
      2
    )
  );
  console.log("[test-comics-local-panel-index] OK");
}

main().catch((error) => {
  console.error("[test-comics-local-panel-index] FAILED", error);
  process.exitCode = 1;
});