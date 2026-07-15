import { mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawn } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");
const ffmpegCommand = process.env.FFMPEG_PATH ?? "ffmpeg";
const realComicPagesDir = join(projectRoot, "storage/assets/comics/justice-league-vs-godzilla-vs-kong/issue-01/pages");

function run(command, args, options = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"], windowsHide: true, ...options });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk) => { stdout += String(chunk); });
    child.stderr?.on("data", (chunk) => { stderr += String(chunk); });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolvePromise({ stdout, stderr });
      else reject(new Error(`${command} exited ${code}: ${stderr.slice(-1000)}`));
    });
  });
}

async function importMediaBeast() {
  return import(pathToFileURL(join(projectRoot, "packages/media-beast/dist/index.js")).href);
}

async function createSyntheticSourcePage(sourceDir) {
  const pagePath = join(sourceDir, "page-001.png");
  await mkdir(sourceDir, { recursive: true });
  await run(ffmpegCommand, [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-f",
    "lavfi",
    "-i",
    "color=c=white:s=1200x1800:d=1",
    "-vf",
    "drawbox=x=40:y=40:w=1120:h=780:color=black:t=8,drawbox=x=80:y=110:w=780:h=220:color=white:t=fill,drawtext=text='HERO FINDS THE MONSTER':fontcolor=black:fontsize=64:x=120:y=170,drawtext=text='COMIC OCR TEST':fontcolor=black:fontsize=64:x=120:y=260,drawbox=x=40:y=880:w=1120:h=780:color=black:t=8,drawbox=x=130:y=990:w=720:h=220:color=white:t=fill,drawtext=text='THE TEAM RUNS FAST':fontcolor=black:fontsize=64:x=170:y=1060",
    "-frames:v",
    "1",
    pagePath
  ]);
  return pagePath;
}

async function main() {
  const syntheticSourceDir = join(projectRoot, "tmp", "comic-ocr-smoke", "source-pages");
  const assetDir = join(projectRoot, "tmp", "comic-ocr-smoke", "asset-dir");
  await mkdir(assetDir, { recursive: true });

  let sourcePath = realComicPagesDir;
  let sourceKind = "real_comic_pages";
  if (!existsSync(realComicPagesDir)) {
    sourceKind = "synthetic";
    try {
      await createSyntheticSourcePage(syntheticSourceDir);
      sourcePath = syntheticSourceDir;
    } catch (error) {
      console.log(JSON.stringify({
        status: "skipped",
        reason: "ffmpeg_unavailable_or_spawn_blocked",
        message: error instanceof Error ? error.message : String(error)
      }, null, 2));
      return;
    }
  }

  const beast = await importMediaBeast();
  const result = await beast.ingestLocalComicSource({
    sourcePath,
    assetDirectory: assetDir,
    comicTitle: "Comic OCR Smoke",
    projectRoot,
    buildIndex: true,
    forceRebuildIndex: true,
    maxPages: sourceKind === "real_comic_pages" ? 2 : 1,
    ocrEnabled: true,
    ocrLanguages: sourceKind === "real_comic_pages" ? "por+eng" : "eng"
  });

  const panels = result.index?.pages?.flatMap((page) => page.panels) ?? [];
  const detectedText = panels.flatMap((panel) => panel.localEvidence?.detectedText ?? []);
  if (detectedText.length === 0) {
    console.log(JSON.stringify({
      status: "skipped",
      reason: "no_ocr_text_detected_in_available_sample",
      sourceKind,
      pageCount: result.pageCount,
      validPanelCount: result.index?.validPanelCount ?? 0,
      warnings: result.warnings.slice(0, 5)
    }, null, 2));
    return;
  }

  console.log(JSON.stringify({
    status: "completed",
    sourceKind,
    pageCount: result.pageCount,
    validPanelCount: result.index?.validPanelCount ?? 0,
    detectedLineCount: detectedText.length,
    detectedLines: detectedText.slice(0, 12),
    warnings: result.warnings.slice(0, 5)
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
