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

async function main() {
  const beast = await importMediaBeast();
  const { buildComicIngestionPlan, ingestLocalComicSource } = beast;
  const plan = buildComicIngestionPlan({
    sourcePath: "C:/authorized/local-comic.pdf",
    recommendedAssetDirectory: "storage/assets/comics/local-comic"
  });

  assert(plan.sourceType === "pdf", "expected pdf source type");
  assert(plan.supported === true, "expected pdf to be supported with local rasterizer tooling");
  assert(plan.steps.some((step) => step.stepId === "extract_pages" && step.status === "ready"), "expected pdf extraction step to be ready");
  assert(plan.warnings.some((warning) => warning.includes("pdf_requires_local_rasterizer")), "expected rasterizer warning");

  const testPdfPath = process.env.REELFORGE_TEST_PDF_PATH;
  if (!testPdfPath) {
    console.log(JSON.stringify({
      status: "skipped",
      reason: "Set REELFORGE_TEST_PDF_PATH to an authorized local PDF to run real PDF rasterization.",
      sourceType: plan.sourceType,
      supported: plan.supported,
      warnings: plan.warnings
    }, null, 2));
    return;
  }

  const assetDirectory = join(projectRoot, "tmp", "comic-pdf-rasterizer-smoke", "asset-dir");
  await mkdir(assetDirectory, { recursive: true });
  const result = await ingestLocalComicSource({
    sourcePath: testPdfPath,
    assetDirectory,
    comicTitle: "PDF Rasterizer Smoke Comic",
    projectRoot,
    buildIndex: false,
    pdfDpi: 160
  });

  await writeFile(join(assetDirectory, "smoke-result.json"), JSON.stringify(result, null, 2), "utf8");
  assert(result.sourceType === "pdf", "expected pdf ingestion result");
  assert(result.pageCount > 0, "expected at least one rasterized page");
  assert(result.warnings.some((warning) => warning.startsWith("pdf_rasterizer_used:")), "expected rasterizer used warning");

  console.log(JSON.stringify({
    status: "completed",
    sourceType: result.sourceType,
    pageCount: result.pageCount,
    assetDirectory: result.assetDirectory,
    manifestPath: result.manifestPath,
    warnings: result.warnings.slice(0, 8)
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
