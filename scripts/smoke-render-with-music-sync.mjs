import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  printSmokeSummary,
  safeCheckFfmpeg,
  safeCheckFfprobe
} from "./lib/smoke-utils.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");

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
      process.stdout.write(chunk);
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
      process.stderr.write(chunk);
    });

    child.on("error", rejectPromise);
    child.on("close", (code) => {
      if (code === 0) {
        resolvePromise({ stdout, stderr });
        return;
      }

      rejectPromise(
        new Error(
          `Underlying premium audio render smoke failed with code ${code ?? "unknown"}.`
        )
      );
    });
  });
}

async function main() {
  const [ffmpeg, ffprobe] = await Promise.all([
    safeCheckFfmpeg(runCommand),
    safeCheckFfprobe(runCommand)
  ]);

  if (!ffmpeg.available || !ffprobe.available) {
    printSmokeSummary({
      status: "skipped",
      reason: ffmpeg.errorMessage ?? ffprobe.errorMessage ?? "FFmpeg/FFprobe unavailable.",
      ffmpeg: ffmpeg.versionLine,
      ffprobe: ffprobe.versionLine
    });
    return;
  }

  await runCommand(process.execPath, ["scripts/smoke-premium-audio-render.mjs"]);

  printSmokeSummary({
    delegatedTo: "smoke:premium-audio-render",
    note: "Background music, narration and premium mastering validated through the premium audio render smoke.",
    status: "completed"
  });
}

await main();
