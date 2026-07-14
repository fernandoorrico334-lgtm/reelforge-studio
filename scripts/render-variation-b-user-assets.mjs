import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { safeCheckFfmpeg } from "./lib/smoke-utils.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");
const OUTPUT_BASENAME = "variation-b-user-assets-final-v2";
const FINAL_CONTACT_SHEET_PATH = join(projectRoot, "tmp", "variation-b-final-v2-contact-sheet.jpg");
const FINAL_REPORT_PATH = join(projectRoot, "tmp", "variation-b-final-v2-report.json");

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

async function importMediaBeast() {
  return import(
    pathToFileURL(join(projectRoot, "packages/media-beast/dist/index.js")).href
  );
}

async function main() {
  const ffmpeg = await safeCheckFfmpeg(probeCommand);
  if (!ffmpeg.available) {
    throw new Error(ffmpeg.errorMessage ?? "FFmpeg não disponível.");
  }

  const beast = await importMediaBeast();
  const {
    buildUserProvidedPreflightReport,
    saveUserProvidedPreflightReport,
    auditRenderedMp4ForUserProvided,
    saveUserProvidedFinalAuditReport,
    renderRemixTimelineFromMaterialization,
    applyReferenceAlignedNarrationToPlan
  } = beast;

  const planPath = join(projectRoot, "tmp", "variation-b-gated-plan.json");
  const plan = applyReferenceAlignedNarrationToPlan(
    JSON.parse(await readFile(planPath, "utf8"))
  );

  const preflight = await buildUserProvidedPreflightReport({
    plan,
    projectRoot,
    ffprobeCommand: process.env.FFPROBE_PATH?.trim() || "ffprobe"
  });
  await saveUserProvidedPreflightReport(preflight, projectRoot);

  if (!preflight.canRender) {
    throw new Error(
      `Preflight bloqueado: ${preflight.blockReason ?? preflight.publishBlockReason ?? "unknown"}`
    );
  }
  if (!preflight.canPublish) {
    throw new Error(
      `Publish gates não passaram: ${preflight.publishBlockReason ?? "unknown"} — render abortado.`
    );
  }
  if (!preflight.materializationReportPath) {
    throw new Error("Materialization report ausente após preflight.");
  }

  const materialization = JSON.parse(
    await readFile(preflight.materializationReportPath, "utf8")
  );

  const outDir = join(projectRoot, "tmp", "remix-renders");
  const mp4Path = join(outDir, `${OUTPUT_BASENAME}.mp4`);

  console.log(`[user-assets-render] FFmpeg → ${mp4Path}`);
  const renderResult = await renderRemixTimelineFromMaterialization({
    report: materialization,
    plan,
    outputPath: mp4Path,
    projectRoot,
    workDir: join(outDir, `${OUTPUT_BASENAME}-timeline-work`),
    ffmpegCommand: ffmpeg.command ?? "ffmpeg",
    publishQualityAudio: true
  });

  const finalAudit = await auditRenderedMp4ForUserProvided({
    mp4Path: renderResult.outputPath,
    preflight,
    projectRoot,
    ffmpegCommand: ffmpeg.command ?? "ffmpeg",
    ffprobeCommand: process.env.FFPROBE_PATH?.trim() || "ffprobe",
    finalContactSheetPath: FINAL_CONTACT_SHEET_PATH
  });

  const finalReportPath = await saveUserProvidedFinalAuditReport(
    finalAudit,
    projectRoot,
    FINAL_REPORT_PATH
  );

  const summary = {
    outputPath: renderResult.outputPath,
    contactSheetPath: renderResult.contactSheetPath,
    finalContactSheetPath: finalAudit.finalContactSheetPath,
    finalReportPath,
    beatCaptionCues: preflight.beatCaptionCues,
    hasAudio: renderResult.hasAudio,
    finalPublishReady: finalAudit.finalPublishReady,
    audioProbe: finalAudit.audioProbe,
    metrics: finalAudit.metrics,
    recommendation: finalAudit.recommendation
  };

  console.log(JSON.stringify(summary, null, 2));

  if (!finalAudit.finalPublishReady) {
    console.error("[user-assets-render] MP4 gerado mas NÃO está pronto para publicação.");
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("[user-assets-render] FAIL");
  console.error(error);
  process.exit(1);
});