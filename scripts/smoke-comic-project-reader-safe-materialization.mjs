import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
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

function run(command, args) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    child.stderr?.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolvePromise();
      else reject(new Error(`${command} ${args.join(" ")} exited ${code}: ${stderr.slice(-800)}`));
    });
  });
}

async function createSyntheticPage(path, color, label) {
  await mkdir(dirname(path), { recursive: true });
  await run("ffmpeg", [
    "-y",
    "-hide_banner",
    "-loglevel",
    "error",
    "-f",
    "lavfi",
    "-i",
    `color=c=${color}:s=1600x2400:d=1`,
    "-vf",
    [
      "drawbox=x=80:y=120:w=660:h=840:color=white@0.55:t=8",
      "drawbox=x=860:y=240:w=560:h=720:color=red@0.35:t=fill",
      "drawbox=x=160:y=1120:w=1250:h=860:color=blue@0.30:t=fill",
      `drawtext=text='${label}':x=120:y=70:fontsize=72:fontcolor=white`
    ].join(","),
    "-frames:v",
    "1",
    path
  ]);
}

function makePanel(buildMockPanel, id, pageNumber, sourcePagePath, storyFunction, cropBounds, options = {}) {
  return buildMockPanel({
    panelId: id,
    pageNumber,
    panelNumber: pageNumber,
    readingOrder: pageNumber,
    sourcePagePath,
    panelImagePath: join(projectRoot, "storage", "assets", "generated", "comic-reader-safe-smoke", "raw-crops", `${id}.jpg`),
    panelImageSha256: `${id}-sha256`.padEnd(64, "c"),
    cropBounds,
    cropAreaRatio: (cropBounds.width * cropBounds.height) / (1600 * 2400),
    sequenceId: "reader-safe-materialization-seq",
    previousPanelId: null,
    nextPanelId: null,
    storyFunction,
    parentContext: {
      comicTitle: "Liga da Justica vs Godzilla vs Kong Test",
      issueTitle: "Teste de materializacao reader-safe",
      pageTitle: `Page ${pageNumber}`,
      parentTags: ["godzilla", "superman", "justice league", "kaiju", "comic"],
      parentEntities: ["Superman", "Godzilla", "Liga da Justica"]
    },
    localEvidence: {
      characters: [
        { name: "Superman", confidence: 0.95, evidenceSource: "visual" },
        { name: "Godzilla", confidence: 0.96, evidenceSource: "visual" }
      ],
      actions: [{ label: options.action ?? "Godzilla confronts Superman", confidence: 0.94 }],
      relationships: [{ type: "conflict", entities: ["Superman", "Godzilla"], confidence: 0.92 }],
      detectedText: options.text ? [options.text] : [],
      dialogue: options.dialogue ? [options.dialogue] : [],
      narrationBoxes: options.narrationBox ? [options.narrationBox] : [],
      soundEffects: options.sfx ? [options.sfx] : ["BOOM"],
      visualThemes: ["kaiju_crossover", "monster_battle", "city_destruction", "comics_source"],
      objects: [],
      locations: ["destroyed city"]
    },
    quality: { visualQualityScore: 94, cropability916Score: 93, textHeavyRatio: options.textHeavyRatio ?? 0.12 },
    confidence: {
      segmentation: 0.94,
      characters: 0.95,
      actions: 0.94,
      relationships: 0.92,
      text: options.text || options.dialogue ? 0.86 : 0.58,
      overall: 0.93
    }
  });
}

async function main() {
  const pageDir = join(projectRoot, "storage", "assets", "generated", "comic-reader-safe-smoke", "pages");
  const outputDirectory = join(projectRoot, "storage", "assets", "generated", "comic-reader-safe-smoke", "reader-safe-project");

  try {
    await createSyntheticPage(join(pageDir, "page-1.jpg"), "0x111827", "PAGE 1");
    await createSyntheticPage(join(pageDir, "page-2.jpg"), "0x1f2937", "PAGE 2");
    await createSyntheticPage(join(pageDir, "page-3.jpg"), "0x312e81", "PAGE 3");
    await createSyntheticPage(join(pageDir, "page-4.jpg"), "0x7f1d1d", "PAGE 4");
    await createSyntheticPage(join(pageDir, "page-5.jpg"), "0x064e3b", "PAGE 5");
  } catch (error) {
    console.log(JSON.stringify({
      status: "skipped",
      reason: "ffmpeg_unavailable_or_spawn_blocked",
      error: error instanceof Error ? error.message : String(error)
    }, null, 2));
    return;
  }

  const beast = await importMediaBeast();
  const {
    buildMockPanel,
    mineComicStoryVault,
    buildComicArcProjectsFromMinerV2,
    materializeComicProjectReaderSafeAssets
  } = beast;

  const panels = [
    makePanel(buildMockPanel, "rs-1", 1, join(pageDir, "page-1.jpg"), "setup", { x: 80, y: 120, width: 660, height: 840 }, { dialogue: "Isso nao e so um monstro.", text: "A cidade para" }),
    makePanel(buildMockPanel, "rs-2", 2, join(pageDir, "page-2.jpg"), "context", { x: 160, y: 1120, width: 1250, height: 860 }, { narrationBox: "A Liga percebe que a escala mudou." }),
    makePanel(buildMockPanel, "rs-3", 3, join(pageDir, "page-3.jpg"), "action", { x: 860, y: 240, width: 560, height: 720 }, { action: "Superman flies toward Godzilla blast", sfx: "WHOOSH" }),
    makePanel(buildMockPanel, "rs-4", 4, join(pageDir, "page-4.jpg"), "climax", { x: 140, y: 980, width: 1160, height: 980 }, { action: "Godzilla blast hits Superman", sfx: "KRAK" }),
    makePanel(buildMockPanel, "rs-5", 5, join(pageDir, "page-5.jpg"), "reaction", { x: 120, y: 180, width: 900, height: 760 }, { dialogue: "Ele aguentou isso?" })
  ];

  const pages = panels.map((panel) => ({
    sourceAssetId: `reader-safe-page-${panel.pageNumber}`,
    sourcePagePath: panel.sourcePagePath,
    sourceContentHash: `reader-safe-hash-${panel.pageNumber}`,
    pageNumber: panel.pageNumber,
    pageType: "story",
    indexable: true,
    parentContext: panel.parentContext,
    panels: [panel]
  }));

  const index = {
    version: 3,
    assetDirectory: join(projectRoot, "storage", "assets", "comics", "reader-safe-materialization-test"),
    generatedAt: new Date().toISOString(),
    sourcePageCount: pages.length,
    panelCount: panels.length,
    validPanelCount: panels.length,
    rejectedPanelCount: 0,
    sequenceCount: 1,
    pages
  };

  const report = mineComicStoryVault({
    index,
    maxOpportunities: 12,
    minScore: 50
  });

  const batch = buildComicArcProjectsFromMinerV2({
    report,
    channelId: "channel-reader-safe-materialization-test",
    maxProjects: 1,
    titlePrefix: "Teste"
  });
  const payload = batch.projects[0];
  assert(payload, "expected project payload");

  const materialized = await materializeComicProjectReaderSafeAssets({
    payload,
    panelIndex: index,
    outputDirectory,
    forceRebuild: true
  });

  assert(materialized.candidateFirst === true, "materializer must stay candidate-first");
  assert(materialized.requiresManualApproval === true, "materializer must require manual approval");
  assert(materialized.report.materializedAssetCount === materialized.payload.scenes.length, "every scene should have a reader-safe asset");
  assert(materialized.payload.scenes.every((scene) => scene.assetId?.startsWith("reader-safe-")), "every scene should receive a deterministic assetId");
  assert(materialized.payload.scenes.every((scene) => scene.visualSourceMode === "asset_only"), "reader-safe project should use asset_only mode");
  assert(materialized.payload.panelAssetManifest.every((entry) => entry.panelImagePath?.endsWith(".reader-safe.jpg")), "manifest should point to reader-safe images");
  assert(materialized.payload.renderBlueprintHints.readerSafePanelAssets?.length === materialized.payload.scenes.length, "blueprint hints should expose reader-safe assets");
  assert(materialized.payload.qualityChecklist.some((item) => item.id === "panel_assets_required" && item.status === "ready"), "panel asset checklist should be ready");

  const visualRecipes = materialized.payload.scenes.map((scene) => JSON.parse(scene.visualRecipe));
  assert(visualRecipes.every((recipe) => recipe.readerSafePanelAsset?.readerSafeImagePath), "visual recipes should embed reader-safe asset metadata");
  assert(visualRecipes.every((recipe) => recipe.readerSafePanelAsset?.outputWidth === 1080), "reader-safe width must be 1080");
  assert(visualRecipes.every((recipe) => recipe.readerSafePanelAsset?.outputHeight === 1920), "reader-safe height must be 1920");

  console.log(JSON.stringify({
    status: "completed",
    projectTitle: materialized.payload.project.title,
    sceneCount: materialized.payload.scenes.length,
    materializedAssetCount: materialized.report.materializedAssetCount,
    selectedStoryCandidateId: materialized.payload.renderBlueprintHints.selectedStoryCandidateId,
    firstAsset: materialized.report.assets[0],
    warnings: materialized.payload.warnings
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
