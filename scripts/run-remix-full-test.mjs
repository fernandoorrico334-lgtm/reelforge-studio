import { readFile, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawn } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");

function runNodeScript(scriptName, args = []) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, [join(projectRoot, "scripts", scriptName), ...args], {
      cwd: projectRoot,
      shell: false
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      resolvePromise({ code, stdout, stderr });
    });
  });
}

function extractJsonBlock(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end < start) {
    throw new Error("JSON block not found in script output");
  }
  return JSON.parse(text.slice(start, end + 1));
}

async function fileInfo(relativePath) {
  try {
    const absolutePath = join(projectRoot, relativePath);
    const fileStat = await stat(absolutePath);
    return {
      path: relativePath,
      bytes: fileStat.size,
      modifiedAt: fileStat.mtime.toISOString()
    };
  } catch {
    return { path: relativePath, missing: true };
  }
}

async function main() {
  const startedAt = Date.now();
  const guardRun = await runNodeScript("test-remix-materialization-guard.mjs");
  const guard = extractJsonBlock(guardRun.stdout);

  const renderRun = await runNodeScript("render-remix-variation.mjs", [
    "https://youtube.com/shorts/mfOwjnNCV1A",
    "comics",
    "--output=variation-comics-final.mp4",
    "--reuse-plan"
  ]);
  const render = extractJsonBlock(renderRun.stdout);

  const materialization = JSON.parse(
    await readFile(join(projectRoot, "tmp/remix-materialization-report.json"), "utf8")
  );

  const guardOk = guard.results.every((entry) => entry.ok);
  const renderOk = renderRun.code === 0 && render.sourceFootprintRatio === 0 && render.hasAudio;

  const report = {
    generatedAt: new Date().toISOString(),
    elapsedMs: Date.now() - startedAt,
    testSuite: "remix-materialization-and-render",
    sourceUrl: "https://youtube.com/shorts/mfOwjnNCV1A",
    targetStyle: "comics",
    overallOk: guardOk && renderOk && materialization.canRender,
    guardTest: {
      exitCode: guardRun.code,
      passed: guard.passed,
      ok: guardOk,
      results: guard.results
    },
    renderTest: {
      exitCode: renderRun.code,
      ok: renderOk,
      outputPath: render.outputPath,
      contactSheetPath: render.contactSheetPath,
      durationSec: render.durationSec,
      sourceFootprintRatio: render.sourceFootprintRatio,
      providedAssetsUsageRatio: render.providedAssetsUsageRatio,
      timelineMode: render.timelineMode,
      materializedFastCutCount: render.materializedFastCutCount,
      fastCutCount: render.fastCutCount,
      hasAudio: render.hasAudio,
      audioMix: render.audioMix,
      approvedAssetsUsed: render.approvedAssetsUsed,
      rejectedAssets: render.rejectedAssets,
      warnings: render.warnings,
      plannedButNotMaterialized: render.plannedButNotMaterialized
    },
    materializationSummary: {
      canRender: materialization.canRender,
      blockReason: materialization.blockReason,
      timelineSceneCount: materialization.timelineScenes.length,
      captionStyleId: materialization.captionStyleId,
      musicPresetId: materialization.musicPresetId,
      materializedFastCutCount: materialization.materializedFastCutCount,
      timelineMode: materialization.timelineMode
    },
    artifacts: {
      mp4: await fileInfo("tmp/remix-renders/variation-comics-final.mp4"),
      contactSheet: await fileInfo("tmp/remix-renders/variation-comics-final-contact-sheet.jpg"),
      materializationReport: await fileInfo("tmp/remix-materialization-report.json"),
      renderReport: await fileInfo("tmp/remix-renders/variation-comics-final-render-report.json")
    }
  };

  const outPath = join(projectRoot, "tmp", "remix-full-test-report.json");
  await writeFile(outPath, JSON.stringify(report, null, 2), "utf8");

  console.log(JSON.stringify(report, null, 2));
  console.log(`[saved] ${outPath}`);

  if (!report.overallOk) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});