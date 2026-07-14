import { spawn } from "node:child_process";
import { copyFile, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { safeCheckFfmpeg } from "./lib/smoke-utils.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");
const OUTPUT_BASENAME = "variation-comics-final";

async function importMediaBeast() {
  return import(
    pathToFileURL(join(projectRoot, "packages/media-beast/dist/index.js")).href
  );
}

function probeCommand(command, args) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { shell: false });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr?.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolvePromise({ stdout, stderr });
      else reject(new Error(`${command} exited with code ${code}: ${stderr.slice(-400)}`));
    });
  });
}

async function validateMp4(inputPath, ffmpegCommand) {
  const { stdout } = await probeCommand(ffmpegCommand, [
    "-hide_banner",
    "-i",
    inputPath,
    "-f",
    "null",
    "-"
  ]);
  const fileStat = await stat(inputPath);
  const durationMatch = stdout.match(/Duration:\s*(\d+:\d+:\d+(?:\.\d+)?)/);
  return {
    bytes: fileStat.size,
    durationLabel: durationMatch?.[1] ?? null,
    ok: fileStat.size > 50_000
  };
}

async function main() {
  const ffmpeg = await safeCheckFfmpeg(probeCommand);
  if (!ffmpeg.available) {
    throw new Error(ffmpeg.errorMessage ?? "FFmpeg não disponível.");
  }

  const materializationPath = join(projectRoot, "tmp", "remix-materialization-report.json");
  const planPath = join(projectRoot, "tmp", "variation-b-gated-plan.json");
  const publishReportPath = join(projectRoot, "tmp", "variation-b-publish-readiness-report.json");

  const materialization = JSON.parse(await readFile(materializationPath, "utf8"));
  const plan = JSON.parse(await readFile(planPath, "utf8"));
  const publishReport = JSON.parse(await readFile(publishReportPath, "utf8"));

  if (!materialization.canPublish) {
    throw new Error(
      `Publish readiness bloqueado: ${materialization.publishBlockReason ?? publishReport.publishBlockReason ?? "unknown"}`
    );
  }

  const beast = await importMediaBeast();
  const { renderRemixTimelineFromMaterialization } = beast;

  const outDir = join(projectRoot, "tmp", "remix-renders");
  await mkdir(outDir, { recursive: true });
  const mp4Path = join(outDir, `${OUTPUT_BASENAME}.mp4`);
  const renderReportPath = join(outDir, `${OUTPUT_BASENAME}-render-report.json`);

  console.log(`[release-render] FFmpeg → ${mp4Path}`);
  const renderResult = await renderRemixTimelineFromMaterialization({
    report: materialization,
    plan,
    outputPath: mp4Path,
    projectRoot,
    workDir: join(outDir, `${OUTPUT_BASENAME}-timeline-work`),
    ffmpegCommand: ffmpeg.command ?? "ffmpeg"
  });

  const mp4Validation = await validateMp4(renderResult.outputPath, ffmpeg.command ?? "ffmpeg");
  if (!mp4Validation.ok) {
    throw new Error(`MP4 inválido ou muito pequeno: ${renderResult.outputPath}`);
  }

  await copyFile(renderResult.outputPath, join(outDir, "variation-comics.mp4"));

  const finalReport = {
    generatedAt: new Date().toISOString(),
    variation: "B — Comics",
    releaseCandidate: true,
    outputPath: renderResult.outputPath,
    contactSheetPath: renderResult.contactSheetPath,
    durationSec: renderResult.totalDurationSec,
    mp4Validation,
    canRender: materialization.canRender,
    canPublish: materialization.canPublish,
    publishReadinessReportPath: publishReportPath,
    publishReadinessContactSheetPath: publishReport.publishReadinessContactSheetPath ?? null,
    visualDiversity: publishReport.visualDiversity ?? materialization.timelineRotationStats,
    placeholderUsage: publishReport.placeholderUsage ?? materialization.placeholderUsage,
    sourceFootprintRatio: materialization.sourceFootprintRatio,
    hasAudio: renderResult.hasAudio,
    warnings: [...(materialization.warnings ?? []), ...(renderResult.audioMixPlan?.warnings ?? [])]
  };

  await writeFile(renderReportPath, JSON.stringify(finalReport, null, 2), "utf8");
  console.log(JSON.stringify(finalReport, null, 2));
  console.log(`[release-render] Concluído: ${renderResult.outputPath}`);
}

main().catch((error) => {
  console.error("[release-render] FAIL");
  console.error(error);
  process.exit(1);
});