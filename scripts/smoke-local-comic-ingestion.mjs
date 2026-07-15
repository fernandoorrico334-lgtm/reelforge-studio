import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");

async function importMediaBeast() {
  return import(pathToFileURL(join(projectRoot, "packages/media-beast/dist/index.js")).href);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const tinyPngBase64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/l4xK5wAAAABJRU5ErkJggg==";

async function main() {
  const beast = await importMediaBeast();
  const { ingestLocalComicSource, mineComicStoryVaultFromDirectory, buildComicShortsBatchFactoryPlan } = beast;
  const sourceDir = join(projectRoot, "tmp", "comic-ingestion-smoke", "source-pages");
  const assetDir = join(projectRoot, "tmp", "comic-ingestion-smoke", "asset-dir");
  await mkdir(sourceDir, { recursive: true });
  for (let index = 1; index <= 3; index += 1) {
    await writeFile(join(sourceDir, `page-${String(index).padStart(3, "0")}.png`), Buffer.from(tinyPngBase64, "base64"));
  }

  const result = await ingestLocalComicSource({
    sourcePath: sourceDir,
    assetDirectory: assetDir,
    comicTitle: "Smoke Comic",
    projectRoot,
    buildIndex: true,
    forceRebuildIndex: true,
    maxPages: 3
  });

  assert(result.sourceType === "image_directory", "expected image directory source");
  assert(result.pageCount === 3, `expected 3 pages, got ${result.pageCount}`);
  assert(result.manifestPath.endsWith("manifest.json"), "expected manifest path");
  assert(result.indexPath, "expected index path");
  assert(result.index, "expected panel index");

  const mined = await mineComicStoryVaultFromDirectory({ assetDirectory: assetDir, maxOpportunities: 10, minScore: 0 });
  const factory = buildComicShortsBatchFactoryPlan({ minerReport: mined, targetCount: 3, minScore: 0 });

  console.log(JSON.stringify({
    status: "completed",
    sourceType: result.sourceType,
    pageCount: result.pageCount,
    indexPath: result.indexPath,
    validPanelCount: result.index?.validPanelCount ?? 0,
    opportunities: mined.opportunities.length,
    plannedShorts: factory.selectedCount,
    warnings: result.warnings.slice(0, 5)
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
