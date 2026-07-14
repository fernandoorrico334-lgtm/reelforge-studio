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
    loadComicsSelectionFeedbackLedger,
    buildComicsSelectionFeedbackReport,
    resolveComicsSelectionFeedbackPath,
    FEEDBACK_BONUS_CAP,
    FEEDBACK_PENALTY_CAP
  } = beast;

  const ledger = await loadComicsSelectionFeedbackLedger(projectRoot);
  const report = buildComicsSelectionFeedbackReport(ledger);

  console.log(
    JSON.stringify(
      {
        ledgerPath: resolveComicsSelectionFeedbackPath(projectRoot),
        limits: {
          bonusCap: FEEDBACK_BONUS_CAP,
          penaltyCap: FEEDBACK_PENALTY_CAP
        },
        ...report
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error("[report-comics-selection-feedback] FAIL");
  console.error(error);
  process.exit(1);
});