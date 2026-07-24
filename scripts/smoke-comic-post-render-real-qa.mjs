import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  printSmokeSummary,
  resolveBinaryCommand,
  safeCheckFfmpeg,
  safeCheckFfprobe
} from "./lib/smoke-utils.mjs";

const root = process.cwd();

function runCommand(command, args, options = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      cwd: root,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
      ...options
    });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr?.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolvePromise({ stdout, stderr });
        return;
      }
      const error = new Error(`Command failed (${code}): ${command} ${args.join(" ")}\n${stderr.slice(-1200)}`);
      error.code = code;
      reject(error);
    });
  });
}

async function createSyntheticComicMp4(ffmpegCommand, outputPath) {
  await runCommand(ffmpegCommand, [
    "-y",
    "-f",
    "lavfi",
    "-i",
    "testsrc2=size=1080x1920:rate=30:duration=3",
    "-f",
    "lavfi",
    "-i",
    "sine=frequency=440:duration=3",
    "-vf",
    "drawbox=x=70:y=150:w=940:h=1180:color=black@0.08:t=8,drawbox=x=130:y=240:w=820:h=360:color=white@0.35:t=4,drawbox=x=130:y=680:w=820:h=520:color=yellow@0.18:t=4,drawbox=x=210:y=1440:w=660:h=180:color=black@0.55:t=fill",
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "23",
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    "-pix_fmt",
    "yuv420p",
    "-shortest",
    outputPath
  ]);
}

async function main() {
  const ffmpeg = await safeCheckFfmpeg(runCommand);
  const ffprobe = await safeCheckFfprobe(runCommand);

  if (!ffmpeg.available || !ffprobe.available) {
    printSmokeSummary({
      status: "skipped",
      reason: ffmpeg.errorMessage ?? ffprobe.errorMessage ?? "FFmpeg/FFprobe unavailable.",
      ffmpeg,
      ffprobe
    });
    return;
  }

  const diagnosticsDir = join(root, "storage", "renders", "diagnostics", "comic-post-render-real-qa");
  await mkdir(diagnosticsDir, { recursive: true });
  const videoPath = join(diagnosticsDir, "synthetic-comic-post-render-qa.mp4");
  const reportDir = join(diagnosticsDir, "report");

  await createSyntheticComicMp4(ffmpeg.command ?? resolveBinaryCommand("ffmpeg").command, videoPath);

  const { stdout } = await runCommand(process.execPath, [
    join(root, "scripts", "comic-post-render-qa.mjs"),
    "--input",
    videoPath,
    "--output-dir",
    reportDir,
    "--sample-count",
    "8",
    "--minimum-approval-score",
    "80"
  ]);

  const lines = stdout.trim().split(/\r?\n/u).filter(Boolean);
  const summary = JSON.parse(lines.at(-1) ?? "{}");
  const report = JSON.parse(await readFile(summary.reportPath, "utf8"));

  assert.equal(report.reportId, "comic_post_render_real_qa_v1");
  assert.ok(report.probe.width === 1080 && report.probe.height === 1920);
  assert.ok(report.frameSamples.length >= 3);
  assert.ok(["completed", "blocked"].includes(report.status));
  assert.ok(["approved", "retry_required", "blocked"].includes(report.directorReport.status));

  printSmokeSummary({
    status: "completed",
    videoPath,
    reportPath: summary.reportPath,
    durationSeconds: report.probe.durationSeconds,
    resolution: `${report.probe.width}x${report.probe.height}`,
    frameSampleCount: report.frameSamples.length,
    repeatedFrameRisk: report.repeatedFrameStats.risk,
    directorStatus: report.directorReport.status,
    directorScore: report.directorReport.score,
    retrySceneCount: report.directorReport.retrySceneCount
  });
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  if (/spawn\s+(EPERM|EINVAL)|\bEPERM\b|\bEINVAL\b/u.test(message)) {
    printSmokeSummary({
      status: "skipped",
      reason: "child_process.spawn/FFmpeg bloqueado pelo ambiente. Rode este smoke em um terminal Windows normal.",
      error: message
    });
    return;
  }
  console.error(error);
  process.exitCode = 1;
});
