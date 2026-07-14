import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");
const assetDir = join(projectRoot, "storage/assets/user-provided/remix/venom-partner");

const BEAT_SPECS = [
  { beatId: "beat-hook", beatRole: "hook", narrationRole: "hook" },
  { beatId: "beat-context", beatRole: "context", narrationRole: "context" },
  { beatId: "beat-curiosity_a", beatRole: "curiosity_a", narrationRole: "tension" },
  { beatId: "beat-curiosity_b", beatRole: "curiosity_b", narrationRole: "tension" },
  { beatId: "beat-development_a", beatRole: "development_a", narrationRole: "tension" },
  { beatId: "beat-development_b", beatRole: "development_b", narrationRole: "tension" },
  { beatId: "beat-climax", beatRole: "climax", narrationRole: "climax" },
  { beatId: "beat-closing", beatRole: "closing", narrationRole: "cta" }
];

async function importMediaBeast() {
  return import(
    pathToFileURL(join(projectRoot, "packages/media-beast/dist/index.js")).href
  );
}

function resolveBeatText(plan, narrationRole) {
  const beat =
    plan?.narrationPlan?.narrationBeats?.find((entry) => entry.role === narrationRole) ?? null;
  return beat?.text ?? "";
}

async function main() {
  const beast = await importMediaBeast();
  const {
    analyzeComicsVideoThemeFromAnalysis,
    buildBeatVisualRequirementsFromNarration,
    runBeatAssignmentValidationFromAssetDirectory,
    loadLocalComicPanelIndex
  } = beast;

  const planPath = join(projectRoot, "tmp", "variation-b-gated-plan.json");
  const plan = JSON.parse(await readFile(planPath, "utf8"));
  const themeAnalysis = analyzeComicsVideoThemeFromAnalysis(
    plan.videoAnalysis,
    plan.inputVideoTitle
  );

  const beats = BEAT_SPECS.map((spec) => ({
    beatId: spec.beatId,
    beatRole: spec.beatRole
  }));

  const requirements = buildBeatVisualRequirementsFromNarration({
    videoTitle: plan.inputVideoTitle ?? "Variation B",
    themeAnalysis,
    beats: BEAT_SPECS.map((spec) => ({
      beatId: spec.beatId,
      role: spec.beatRole,
      narrationText: resolveBeatText(plan, spec.narrationRole)
    }))
  });

  const result = await runBeatAssignmentValidationFromAssetDirectory({
    assetDirectory: assetDir,
    projectRoot,
    requirements,
    beats
  });

  const index = await loadLocalComicPanelIndex(assetDir);

  const summary = {
    page4Panel1: result.page4Panel1Diagnostic,
    assignments: result.assignments.map((entry) => ({
      beatRole: entry.beatRole,
      panelId: entry.panelId,
      pageNumber: entry.pageNumber,
      pageType: entry.pageType,
      cropAreaRatio: entry.cropAreaRatio,
      beatSpecificFitScore: entry.beatSpecificFitScore,
      reuseCount: entry.reuseCount
    })),
    uniquePanelCount: result.uniquePanelCount,
    maxPanelReuseCount: result.maxPanelReuseCount,
    continuityScore: result.continuityScore,
    scoresByBeat: result.scoresByBeat,
    averageBeatSpecificFitScore: result.averageBeatSpecificFitScore,
    canRender: result.canRender,
    canPublish: result.canPublish,
    blockReason: result.blockReason,
    reportPath: result.reportPath,
    contactSheetPath: result.contactSheetPath,
    validPanelCount: index.validPanelCount,
    totalPanelCount: index.panelCount
  };

  console.log(JSON.stringify(summary, null, 2));

  if (!result.canPublish) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("[validate-variation-b-beat-assignments] FAILED", error);
  process.exitCode = 1;
});