import { spawn } from "node:child_process";
import { mkdir, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  ensureDir,
  printSmokeSummary,
  resolveBinaryCommand,
  safeCheckFfmpeg,
  safeCheckFfprobe,
  isSpawnPermissionError,
  isBinaryNotFoundError
} from "./lib/smoke-utils.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");
const diagnosticsRoot = join(projectRoot, "storage", "renders", "diagnostics", "comic-caption-preview");

function runCommand(command, args, cwd = projectRoot) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, { cwd, shell: false, windowsHide: true });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      rejectPromise(Object.assign(error, { stdout, stderr, args, command }));
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolvePromise({ stdout, stderr });
        return;
      }

      const tail = `${stderr}${stdout}`.trim().split(/\r?\n/u).slice(-10).join(" | ");
      rejectPromise(Object.assign(new Error(`Command failed with code ${code ?? "unknown"}. ${tail}`), { stdout, stderr, args, command, code }));
    });
  });
}

async function importCaptionEngine() {
  return import(pathToFileURL(join(projectRoot, "packages", "caption-engine", "dist", "index.js")).href);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function probeOutput(ffprobeCommand, outputPath) {
  const { stdout } = await runCommand(ffprobeCommand, [
    "-v",
    "error",
    "-print_format",
    "json",
    "-show_format",
    "-show_streams",
    outputPath
  ], diagnosticsRoot);
  const parsed = JSON.parse(stdout);
  const videoStream = Array.isArray(parsed.streams) ? parsed.streams.find((entry) => entry.codec_type === "video") : null;
  const duration = Number(parsed.format?.duration ?? videoStream?.duration ?? 0);
  return {
    durationSeconds: Number.isFinite(duration) ? Math.round(duration * 1000) / 1000 : null,
    width: Number(videoStream?.width ?? 0) || null,
    height: Number(videoStream?.height ?? 0) || null,
    videoCodec: typeof videoStream?.codec_name === "string" ? videoStream.codec_name : null
  };
}

async function main() {
  await ensureDir(diagnosticsRoot);
  const ffmpegCheck = await safeCheckFfmpeg(runCommand);
  const ffprobeCheck = await safeCheckFfprobe(runCommand);
  const ffmpegCommand = resolveBinaryCommand("ffmpeg").command;
  const ffprobeCommand = resolveBinaryCommand("ffprobe").command;

  if (!ffmpegCheck.available) {
    printSmokeSummary({
      status: "skipped",
      reason: ffmpegCheck.errorMessage ?? "FFmpeg unavailable.",
      ffmpeg: ffmpegCheck,
      ffprobe: ffprobeCheck
    });
    return;
  }

  const { generateAssSubtitle } = await importCaptionEngine();
  const assPath = join(diagnosticsRoot, "captions.ass");
  const outputPath = join(diagnosticsRoot, "comic-caption-preview.mp4");
  const ass = generateAssSubtitle(
    {
      title: "Comic Caption Preview QA",
      scenes: [
        {
          order: 1,
          captionText: "SUPERMAN",
          duration: 0.65,
          captionStyle: "comic_pop",
          highlightedWords: ["SUPERMAN", "IMPACTO"],
          animation: "slam_pop",
          readingImpactScore: 96
        },
        {
          order: 2,
          captionText: "SENTIU",
          duration: 0.55,
          captionStyle: "comic_pop",
          highlightedWords: ["SENTIU", "SUPERMAN", "IMPACTO"],
          animation: "shake_pop",
          readingImpactScore: 94
        },
        {
          order: 3,
          captionText: "IMPACTO",
          duration: 0.8,
          captionStyle: "comic_pop",
          highlightedWords: ["IMPACTO", "SUPERMAN"],
          animation: "slam_pop",
          readingImpactScore: 98
        }
      ]
    },
    "comic_pop"
  );

  assert(ass.includes("\\fscx118") || ass.includes("\\fscx108"), "ASS should include kinetic scale tags.");
  assert(ass.includes("\\1c&H00"), "ASS should include color override tags.");
  assert(ass.includes("\\rDefault"), "ASS should reset highlighted words.");

  await writeFile(assPath, ass, "utf8");

  const args = [
    "-y",
    "-f",
    "lavfi",
    "-i",
    "color=c=#111827:s=1080x1920:d=2.2",
    "-vf",
    "subtitles=captions.ass",
    "-r",
    "30",
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "22",
    "-pix_fmt",
    "yuv420p",
    outputPath
  ];

  try {
    await runCommand(ffmpegCommand, args, diagnosticsRoot);
  } catch (error) {
    if (isSpawnPermissionError(error) || isBinaryNotFoundError(error)) {
      printSmokeSummary({
        status: "skipped",
        reason: error instanceof Error ? error.message : String(error),
        command: [ffmpegCommand, ...args].join(" "),
        ffmpeg: ffmpegCheck,
        ffprobe: ffprobeCheck
      });
      return;
    }
    throw error;
  }

  const outputStats = await stat(outputPath);
  assert(outputStats.size > 5000, "Preview MP4 should be larger than a tiny placeholder.");

  let probe = null;
  if (ffprobeCheck.available) {
    probe = await probeOutput(ffprobeCommand, outputPath);
    assert(probe.width === 1080 && probe.height === 1920, "Preview should be vertical 1080x1920.");
    assert((probe.durationSeconds ?? 0) >= 1.8, "Preview should last long enough to inspect captions.");
  }

  printSmokeSummary({
    status: "completed",
    outputPath,
    outputBytes: outputStats.size,
    assPath,
    assHasKineticStyle: ass.includes("\\fscx118") || ass.includes("\\fscx108"),
    assHasWordHighlight: ass.includes("\\rDefault"),
    ffmpegCommand,
    probe
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});