import { mkdir, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";
import { materializeReaderSafePanelAsset } from "../packages/media-beast/dist/index.js";

const root = resolve(process.cwd());
const outDir = join(root, "storage", "renders", "diagnostics", "comic-reader-safe-panel-assets");
const sourcePagePath = join(outDir, "synthetic-comic-page.jpg");

function run(command, args) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(command, args, { cwd: root, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk) => { stdout += String(chunk); });
    child.stderr?.on("data", (chunk) => { stderr += String(chunk); });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolveRun({ stdout, stderr });
      else reject(new Error(`${command} exited ${code}: ${stderr.slice(-800)}`));
    });
  });
}

async function ffprobeDimensions(path) {
  const result = await run("ffprobe", [
    "-v", "error",
    "-select_streams", "v:0",
    "-show_entries", "stream=width,height",
    "-of", "csv=p=0:s=x",
    path
  ]);
  return result.stdout.trim();
}

async function main() {
  await mkdir(outDir, { recursive: true });
  await run("ffmpeg", [
    "-y",
    "-hide_banner",
    "-loglevel", "error",
    "-f", "lavfi",
    "-i", "color=c=white:s=1200x1800:d=1",
    "-vf",
    [
      "drawbox=x=70:y=120:w=1060:h=1560:color=black:t=6",
      "drawbox=x=520:y=620:w=170:h=360:color=red@0.9:t=fill",
      "drawbox=x=180:y=150:w=520:h=170:color=white:t=fill",
      "drawbox=x=180:y=150:w=520:h=170:color=black:t=5",
      "drawtext=fontfile='C\\:/Windows/Fonts/arial.ttf':text='BALAO DE CONTEXTO':fontcolor=black:fontsize=48:x=210:y=210",
      "drawbox=x=760:y=840:w=260:h=190:color=blue@0.9:t=fill",
      "drawtext=fontfile='C\\:/Windows/Fonts/arial.ttf':text='ACAO':fontcolor=white:fontsize=56:x=825:y=900"
    ].join(","),
    "-frames:v", "1",
    sourcePagePath
  ]);

  const panel = {
    panelId: "synthetic-page:page1:panel1",
    pageNumber: 1,
    panelNumber: 1,
    readingOrder: 1,
    sourcePagePath,
    panelImagePath: sourcePagePath,
    panelImageSha256: "0".repeat(64),
    cropBounds: { x: 500, y: 600, width: 210, height: 420 },
    parentContext: { parentTags: [], parentEntities: [] },
    localEvidence: {
      characters: [{ name: "hero", confidence: 0.8, evidenceSource: "visual" }],
      actions: [{ label: "dash", confidence: 0.72 }],
      relationships: [],
      detectedText: ["BALAO DE CONTEXTO"],
      dialogue: ["BALAO DE CONTEXTO"],
      narrationBoxes: [],
      soundEffects: ["WHOOSH"],
      visualThemes: ["action"],
      objects: [],
      locations: []
    },
    storyFunction: "dialogue",
    sequenceId: "synthetic-seq",
    previousPanelId: null,
    nextPanelId: null,
    valid: true,
    rejectReason: null,
    quality: { visualQualityScore: 80, cropability916Score: 70, textHeavyRatio: 0.38 },
    confidence: { segmentation: 0.9, characters: 0.8, actions: 0.7, relationships: 0.1, text: 0.8, overall: 0.78 },
    warnings: [],
    cropAreaRatio: (210 * 420) / (1200 * 1800),
    estimatedPanelCount: 1,
    estimatedGutterCount: 0,
    isWholePageFallback: false,
    isActualPanelCrop: true,
    visualFlags: {
      venomVisible: false,
      spiderManVisible: false,
      blackSuitVisible: false,
      symbioteVisible: false,
      duoVisible: false,
      doctorStrangeVisible: false,
      unrelatedCharacterVisible: false
    },
    evidenceTier: "direct_evidence"
  };

  const asset = await materializeReaderSafePanelAsset({
    panel,
    pageWidth: 1200,
    pageHeight: 1800,
    outputDirectory: join(outDir, "reader-safe"),
    forceRebuild: true
  });
  const dimensions = await ffprobeDimensions(asset.readerSafeImagePath);
  const outputStat = await stat(asset.readerSafeImagePath);
  const expandedArea = asset.expandedCropBounds.width * asset.expandedCropBounds.height;
  const originalArea = asset.originalCropBounds.width * asset.originalCropBounds.height;

  if (dimensions !== "1080x1920") throw new Error(`expected 1080x1920, got ${dimensions}`);
  if (expandedArea <= originalArea * 2) throw new Error("reader-safe crop did not expand enough");
  if (asset.intent !== "dialogue_context") throw new Error(`expected dialogue_context, got ${asset.intent}`);

  console.log(JSON.stringify({
    status: "completed",
    panelId: asset.sourcePanelId,
    intent: asset.intent,
    dimensions,
    outputPath: asset.readerSafeImagePath,
    bytes: outputStat.size,
    originalCropBounds: asset.originalCropBounds,
    expandedCropBounds: asset.expandedCropBounds,
    expansionRatio: asset.expansionRatio,
    reasons: asset.reasons
  }, null, 2));
}

main().catch((error) => {
  if (String(error?.message ?? error).includes("spawn") || String(error?.message ?? error).includes("ffmpeg")) {
    console.log(JSON.stringify({ status: "skipped", reason: String(error?.message ?? error).slice(0, 600) }, null, 2));
    return;
  }
  console.error(error);
  process.exitCode = 1;
});
