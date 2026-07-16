import { spawn } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  ensureDir,
  printSmokeSummary,
  resolveBinaryCommand,
  safeCheckFfmpeg,
  safeCheckFfprobe
} from "./lib/smoke-utils.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");
const outputRoot = join(projectRoot, "storage", "renders", "diagnostics", "comic-final-video-dna");
const outputPath = join(outputRoot, "comic-final-video-dna.mp4");

async function importMediaBeast() {
  return import(pathToFileURL(join(projectRoot, "packages/media-beast/dist/index.js")).href);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function runCommand(command, args, cwd = projectRoot) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, { cwd, shell: false, windowsHide: true });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
    child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
    child.on("error", (error) => rejectPromise(Object.assign(error, { command, args, stdout, stderr })));
    child.on("close", (code) => {
      if (code === 0) resolvePromise({ stdout, stderr });
      else rejectPromise(Object.assign(new Error(`Command failed with code ${code}: ${command} ${args.join(" ")}\n${stderr.slice(-1200)}`), { command, args, stdout, stderr, code }));
    });
  });
}

function buildSyntheticMetrics() {
  const durationSeconds = 33;
  const cutTimes = Array.from({ length: 21 }, (_, index) => Number(((index + 1) * 1.48).toFixed(2))).filter((time) => time < durationSeconds);
  return {
    outputPath: null,
    durationSeconds,
    width: 1080,
    height: 1920,
    videoCodec: "h264",
    audioCodec: "aac",
    detectedCutTimesSeconds: cutTimes,
    captionCueCount: 36,
    audioPeakCount: 13,
    narrationPresent: true,
    musicPresent: true,
    sfxPresent: true,
    extractionStatus: "synthetic",
    extractionWarnings: ["synthetic_final_dna_metrics_used_for_contract_test"]
  };
}

async function createHardCutVideo(durationSeconds = 33) {
  await ensureDir(outputRoot);
  const colors = ["#111827", "#7f1d1d", "#1e3a8a", "#064e3b", "#581c87", "#78350f", "#172554", "#3f3f46", "#0f172a", "#450a0a"];
  const segmentDuration = 1.5;
  const segmentCount = Math.ceil(durationSeconds / segmentDuration);
  const ffmpeg = resolveBinaryCommand("ffmpeg").command;
  const args = ["-y"];
  for (let index = 0; index < segmentCount; index += 1) {
    args.push("-f", "lavfi", "-i", `color=c=${colors[index % colors.length]}:s=1080x1920:d=${segmentDuration}`);
  }
  args.push("-f", "lavfi", "-i", `sine=frequency=330:duration=${durationSeconds}:sample_rate=48000`);
  const videoInputs = Array.from({ length: segmentCount }, (_, index) => `[${index}:v]`).join("");
  const audioIndex = segmentCount;
  args.push(
    "-filter_complex",
    `${videoInputs}concat=n=${segmentCount}:v=1:a=0[v]`,
    "-map", "[v]",
    "-map", `${audioIndex}:a`,
    "-t", String(durationSeconds),
    "-c:v", "libx264",
    "-pix_fmt", "yuv420p",
    "-c:a", "aac",
    "-b:a", "128k",
    "-movflags", "+faststart",
    outputPath
  );
  await runCommand(ffmpeg, args, outputRoot);
  return outputPath;
}

async function probeVideo(filePath) {
  const ffprobe = resolveBinaryCommand("ffprobe").command;
  const { stdout } = await runCommand(ffprobe, ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", filePath]);
  const parsed = JSON.parse(stdout);
  const videoStream = Array.isArray(parsed.streams) ? parsed.streams.find((entry) => entry.codec_type === "video") : null;
  const audioStream = Array.isArray(parsed.streams) ? parsed.streams.find((entry) => entry.codec_type === "audio") : null;
  const duration = Number(parsed.format?.duration ?? videoStream?.duration ?? 0);
  return {
    durationSeconds: Number.isFinite(duration) ? Number(duration.toFixed(3)) : null,
    width: Number(videoStream?.width ?? 0) || null,
    height: Number(videoStream?.height ?? 0) || null,
    videoCodec: typeof videoStream?.codec_name === "string" ? videoStream.codec_name : null,
    audioCodec: typeof audioStream?.codec_name === "string" ? audioStream.codec_name : null
  };
}

async function detectCuts(filePath) {
  const ffmpeg = resolveBinaryCommand("ffmpeg").command;
  const { stderr } = await runCommand(ffmpeg, ["-i", filePath, "-filter:v", "select='gt(scene,0.20)',showinfo", "-f", "null", "-"]);
  const matches = [...stderr.matchAll(/pts_time:([0-9.]+)/g)].map((match) => Number(match[1])).filter((value) => Number.isFinite(value));
  return [...new Set(matches.map((value) => Number(value.toFixed(2))))];
}

async function main() {
  const beast = await importMediaBeast();
  const { analyzeComicFinalVideoDna } = beast;
  const syntheticReport = analyzeComicFinalVideoDna({ metrics: buildSyntheticMetrics() });

  assert(syntheticReport.dnaId === "comic_final_video_dna_v1", "expected final video DNA id");
  assert(syntheticReport.verdict === "reference_ready", `expected synthetic reference_ready, got ${syntheticReport.verdict}`);
  assert(syntheticReport.measured.cutsPerMinute >= 28, "expected cuts/minute above target");
  assert(syntheticReport.checks.captionsOk, "expected captions to match target");

  const ffmpegCheck = await safeCheckFfmpeg(runCommand);
  const ffprobeCheck = await safeCheckFfprobe(runCommand);
  let realReport = null;

  if (ffmpegCheck.available && ffprobeCheck.available) {
    const filePath = await createHardCutVideo(33);
    const probed = await probeVideo(filePath);
    const detectedCutTimesSeconds = await detectCuts(filePath);
    realReport = analyzeComicFinalVideoDna({
      metrics: {
        outputPath: filePath,
        ...probed,
        detectedCutTimesSeconds,
        captionCueCount: 36,
        audioPeakCount: 13,
        narrationPresent: true,
        musicPresent: true,
        sfxPresent: true,
        extractionStatus: "measured",
        extractionWarnings: []
      }
    });
  }

  printSmokeSummary({
    status: "completed",
    smoke: "comic-final-video-dna",
    synthetic: {
      verdict: syntheticReport.verdict,
      score: syntheticReport.overallScore,
      cutsPerMinute: syntheticReport.measured.cutsPerMinute,
      averageShotDurationSeconds: syntheticReport.measured.averageShotDurationSeconds,
      captionCuesPerMinute: syntheticReport.measured.captionCuesPerMinute,
      warnings: syntheticReport.warnings,
      blockers: syntheticReport.blockers
    },
    realExtraction: realReport
      ? {
          verdict: realReport.verdict,
          score: realReport.overallScore,
          outputPath: realReport.measured.outputPath,
          durationSeconds: realReport.measured.durationSeconds,
          width: realReport.measured.width,
          height: realReport.measured.height,
          cutsPerMinute: realReport.measured.cutsPerMinute,
          detectedCuts: realReport.measured.cutCount,
          warnings: realReport.warnings,
          blockers: realReport.blockers
        }
      : {
          status: "skipped",
          reason: "FFmpeg/FFprobe unavailable or blocked in this environment.",
          ffmpeg: ffmpegCheck.errorMessage,
          ffprobe: ffprobeCheck.errorMessage
        }
  });
}

main().catch((error) => {
  printSmokeSummary({
    status: "failed",
    smoke: "comic-final-video-dna",
    reason: error instanceof Error ? error.message : String(error)
  });
  process.exitCode = 1;
});
