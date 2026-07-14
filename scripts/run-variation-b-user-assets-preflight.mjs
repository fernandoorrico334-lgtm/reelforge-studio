import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");

async function importMediaBeast() {
  return import(
    pathToFileURL(join(projectRoot, "packages/media-beast/dist/index.js")).href
  );
}

async function main() {
  const beast = await importMediaBeast();
  const {
    buildUserProvidedPreflightReport,
    saveUserProvidedPreflightReport,
    DEFAULT_USER_PROVIDED_DIR,
    PUBLISH_ASSET_POLICY_USER_PROVIDED
  } = beast;

  const planPath = join(projectRoot, "tmp", "variation-b-gated-plan.json");
  const plan = JSON.parse(await readFile(planPath, "utf8"));
  const assetDirectory =
    process.env.USER_PROVIDED_ASSET_DIR ?? join(projectRoot, DEFAULT_USER_PROVIDED_DIR);

  const report = await buildUserProvidedPreflightReport({
    plan,
    assetDirectory,
    projectRoot,
    ffprobeCommand: process.env.FFPROBE_PATH?.trim() || "ffprobe"
  });

  const reportPath = await saveUserProvidedPreflightReport(report, projectRoot);

  const summary = {
    publishAssetPolicy: PUBLISH_ASSET_POLICY_USER_PROVIDED,
    assetDirectory: report.assetDirectory,
    assetsFound: report.assetsFound,
    assetsAccepted: report.assetsAccepted.length,
    assetsRejected: report.assetsRejected.length,
    realAssetCount: report.metrics.realAssetCount,
    placeholderCount: report.metrics.placeholderCount,
    realAssetDurationRatio: report.metrics.realAssetDurationRatio,
    blankVisualRatio: report.metrics.blankVisualRatio,
    hookAligned: report.hookAligned,
    climaxAligned: report.climaxAligned,
    captionPreflightReady: report.captionPreflightReady,
    canRender: report.canRender,
    canPublish: report.canPublish,
    blockReason: report.blockReason,
    publishBlockReason: report.publishBlockReason,
    recommendation: report.recommendation,
    reportPath,
    contactSheetPath: report.contactSheetPath
  };

  console.log(JSON.stringify(summary, null, 2));
  console.log(`[user-assets-preflight] Relatório: ${reportPath}`);

  if (!report.canRender) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("[user-assets-preflight] FAIL");
  console.error(error);
  process.exit(1);
});