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
  const { importAcceptedPanelsToUserProvided } = beast;

  const reportPath = join(projectRoot, "tmp", "variation-b-intelligent-comics-discovery-report.json");
  const report = JSON.parse(await readFile(reportPath, "utf8"));

  const result = await importAcceptedPanelsToUserProvided({
    report,
    projectRoot,
    maxPanels: Number(process.env.MAX_PANELS_TO_IMPORT ?? 16),
    minThemeScore: Number(process.env.MIN_THEME_SCORE ?? 28)
  });

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error("[reimport-diverse-panels] FAIL");
  console.error(error);
  process.exit(1);
});