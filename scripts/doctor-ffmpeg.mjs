import { spawn } from "node:child_process";
import { stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ensureDir,
  printSmokeSummary,
  resolveBinaryCommand,
  safeCheckFfmpeg,
  safeCheckFfprobe,
  summarizePathForDiagnostics,
  writeMinimalWav
} from "./lib/smoke-utils.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");
const diagnosticsRoot = join(
  projectRoot,
  "storage",
  "renders",
  "diagnostics"
);

function formatCommand(command, args) {
  return [command, ...args].join(" ");
}

function createCommandError(command, args, code, stdout, stderr) {
  const tail = `${stderr}${stdout}`
    .trim()
    .split(/\r?\n/u)
    .slice(-8)
    .join(" | ");
  const error = new Error(
    `Command '${formatCommand(command, args)}' failed with code ${code ?? "unknown"}. ${tail || "No stdout/stderr output captured."}`
  );

  return Object.assign(error, {
    command,
    args: [...args],
    stdout,
    stderr,
    code
  });
}

function createSpawnError(command, args, error) {
  const wrapped = new Error(
    `Failed to spawn '${formatCommand(command, args)}'. ${error.message}`
  );

  return Object.assign(wrapped, {
    command,
    args: [...args],
    stdout: "",
    stderr: "",
    code: error.code ?? null,
    cause: error
  });
}

function runCommand(command, args, cwd = projectRoot) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, {
      cwd,
      shell: false,
      windowsHide: true
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      rejectPromise(createSpawnError(command, args, error));
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolvePromise({ stdout, stderr });
        return;
      }

      rejectPromise(createCommandError(command, args, code, stdout, stderr));
    });
  });
}

async function locateBinary(binary) {
  const locator = process.platform === "win32" ? "where.exe" : "which";

  try {
    const { stdout, stderr } = await runCommand(locator, [binary]);
    const output = `${stdout}${stderr}`
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .filter(Boolean);

    return {
      command: locator,
      available: true,
      matches: output
    };
  } catch (error) {
    return {
      command: locator,
      available: false,
      matches: [],
      errorMessage: error instanceof Error ? error.message : String(error)
    };
  }
}

async function buildTestRender(ffmpegCheck, ffprobeCheck) {
  const wavPath = join(diagnosticsRoot, "doctor-ffmpeg-input.wav");
  const mp4Path = join(diagnosticsRoot, "doctor-ffmpeg-output.mp4");
  const renderCommand = resolveBinaryCommand("ffmpeg").command;

  await ensureDir(diagnosticsRoot);
  await writeMinimalWav(wavPath, 1, 16000, "doctor-ffmpeg");

  if (!ffmpegCheck.available) {
    return {
      status: "skipped",
      reason: ffmpegCheck.errorMessage ?? "FFmpeg unavailable.",
      command: formatCommand(renderCommand, ["-version"]),
      wavPath
    };
  }

  const args = [
    "-y",
    "-f",
    "lavfi",
    "-i",
    "color=c=#182133:s=1080x1920:d=1",
    "-i",
    wavPath,
    "-shortest",
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-movflags",
    "+faststart",
    mp4Path
  ];

  try {
    await runCommand(renderCommand, args, diagnosticsRoot);
    const outputStats = await stat(mp4Path);
    let probe = null;

    if (ffprobeCheck.available) {
      try {
        const { stdout } = await runCommand(resolveBinaryCommand("ffprobe").command, [
          "-v",
          "error",
          "-print_format",
          "json",
          "-show_format",
          "-show_streams",
          mp4Path
        ]);
        const parsed = JSON.parse(stdout);
        const videoStream = Array.isArray(parsed.streams)
          ? parsed.streams.find((entry) => entry.codec_type === "video")
          : null;
        const audioStream = Array.isArray(parsed.streams)
          ? parsed.streams.find((entry) => entry.codec_type === "audio")
          : null;
        const durationValue = Number(parsed.format?.duration ?? videoStream?.duration ?? 0);

        probe = {
          durationSeconds:
            Number.isFinite(durationValue) && durationValue > 0
              ? Math.round(durationValue * 1000) / 1000
              : null,
          width: Number(videoStream?.width ?? 0) || null,
          height: Number(videoStream?.height ?? 0) || null,
          videoCodec:
            typeof videoStream?.codec_name === "string" ? videoStream.codec_name : null,
          audioCodec:
            typeof audioStream?.codec_name === "string" ? audioStream.codec_name : null
        };
      } catch (error) {
        probe = {
          errorMessage: error instanceof Error ? error.message : String(error)
        };
      }
    }

    return {
      status: "completed",
      command: formatCommand(renderCommand, args),
      wavPath,
      outputPath: mp4Path,
      outputBytes: outputStats.size,
      probe
    };
  } catch (error) {
    return {
      status: "failed",
      reason: error instanceof Error ? error.message : String(error),
      command: formatCommand(renderCommand, args),
      wavPath,
      outputPath: mp4Path
    };
  }
}

async function main() {
  const ffmpegCheck = await safeCheckFfmpeg(runCommand);
  const ffprobeCheck = await safeCheckFfprobe(runCommand);
  const ffmpegWhere = await locateBinary("ffmpeg");
  const ffprobeWhere = await locateBinary("ffprobe");
  const testRender = await buildTestRender(ffmpegCheck, ffprobeCheck);

  const status =
    ffmpegCheck.available &&
    ffprobeCheck.available &&
    testRender.status === "completed"
      ? "completed"
      : "issues_detected";

  printSmokeSummary({
    doctor: "ffmpeg",
    status,
    platform: process.platform,
    nodeVersion: process.version,
    cwd: projectRoot,
    pathSummary: summarizePathForDiagnostics(),
    ffmpeg: {
      ...ffmpegCheck,
      where: ffmpegWhere.matches,
      locatorCommand: ffmpegWhere.command
    },
    ffprobe: {
      ...ffprobeCheck,
      where: ffprobeWhere.matches,
      locatorCommand: ffprobeWhere.command
    },
    testRender
  });
}

main().catch((error) => {
  printSmokeSummary({
    doctor: "ffmpeg",
    status: "failed",
    reason: error instanceof Error ? error.message : String(error)
  });
  process.exitCode = 1;
});
