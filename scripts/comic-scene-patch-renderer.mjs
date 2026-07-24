import { access, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { spawn } from "node:child_process";
import {
  resolveBinaryCommand,
  safeCheckFfmpeg,
  safeCheckFfprobe
} from "./lib/smoke-utils.mjs";

const root = process.cwd();

function parseArgs(argv) {
  const options = {
    request: null,
    outputDir: null,
    mode: "plan",
    approved: false,
    failOnMissingPatches: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const next = argv[index + 1];
    if (token === "--request") {
      options.request = next ?? null;
      index += 1;
    } else if (token === "--output-dir") {
      options.outputDir = next ?? null;
      index += 1;
    } else if (token === "--mode") {
      options.mode = next ?? options.mode;
      index += 1;
    } else if (token === "--approved") {
      options.approved = true;
    } else if (token === "--fail-on-missing-patches") {
      options.failOnMissingPatches = true;
    } else if (token === "--help" || token === "-h") {
      options.help = true;
    }
  }

  return options;
}

function printHelp() {
  console.log(`Usage:
node scripts/comic-scene-patch-renderer.mjs --request <assisted-rerender-request.json> --output-dir <dir>

Modes:
  --mode plan      Create patch slots and remux manifest only. Default.
  --mode execute   Stitch source video + provided patch clips when FFmpeg is available.

Safety:
  --approved is required for execute.
  The original MP4 is never overwritten.
`);
}

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
      reject(new Error(`Command failed (${code}): ${command} ${args.join(" ")}\n${stderr.slice(-1800)}`));
    });
  });
}

async function fileExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function slugify(value) {
  return String(value ?? "scene")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .slice(0, 90) || "scene";
}

function normalizeTimeRange(range) {
  const startTimeSeconds = Number(range?.startTimeSeconds ?? 0);
  const endTimeSeconds = Number(range?.endTimeSeconds ?? 0);
  const safeStart = Number.isFinite(startTimeSeconds) ? Math.max(0, startTimeSeconds) : 0;
  const safeEnd = Number.isFinite(endTimeSeconds) ? Math.max(safeStart, endTimeSeconds) : safeStart;
  return {
    startTimeSeconds: Number(safeStart.toFixed(3)),
    endTimeSeconds: Number(safeEnd.toFixed(3)),
    durationSeconds: Number(Math.max(0, safeEnd - safeStart).toFixed(3))
  };
}

function patchClipName(item) {
  return `${String(item.order ?? 0).padStart(3, "0")}-${slugify(item.sceneId)}-patch.mp4`;
}

export function buildScenePatchManifest({ request, outputDir }) {
  const items = Array.isArray(request.items) ? request.items : [];
  const patchDir = join(outputDir, "patches");
  const workDir = join(outputDir, "work");
  const finalOutputPath = join(outputDir, "output-patched.mp4");
  const sourceVideoPath = request.sourceVideoPath ? resolve(request.sourceVideoPath) : null;
  let cursor = 0;
  const timeline = [];
  const patchSlots = items
    .filter((item) => item.safeRerenderScope === "scene_only")
    .sort((left, right) => (left.timeRange?.startTimeSeconds ?? 0) - (right.timeRange?.startTimeSeconds ?? 0))
    .map((item, index) => {
      const timeRange = normalizeTimeRange(item.timeRange);
      if (timeRange.startTimeSeconds > cursor) {
        timeline.push({
          type: "source_slice",
          startTimeSeconds: Number(cursor.toFixed(3)),
          endTimeSeconds: timeRange.startTimeSeconds,
          durationSeconds: Number((timeRange.startTimeSeconds - cursor).toFixed(3)),
          outputPath: join(workDir, `source-${String(index).padStart(3, "0")}-before.mp4`)
        });
      }
      const patchPath = join(patchDir, patchClipName(item));
      const slot = {
        slotId: `patch-${String(index + 1).padStart(3, "0")}`,
        requestItemId: item.requestItemId,
        sceneId: item.sceneId,
        order: item.order,
        correctionType: item.correctionType,
        severity: item.severity,
        timeRange,
        expectedPatchPath: patchPath,
        requiredDurationSeconds: timeRange.durationSeconds,
        sourceEvidenceFrames: item.evidenceFrames ?? [],
        status: item.requiresHumanApproval ? "waiting_human_approval" : "waiting_patch_clip",
        instructions: [
          item.directorInstruction,
          item.suggestedFix,
          "Renderize este patch com a mesma duracao do timeRange para o encaixe ficar limpo."
        ].filter(Boolean)
      };
      timeline.push({
        type: "patch_clip",
        sceneId: item.sceneId,
        patchSlotId: slot.slotId,
        startTimeSeconds: timeRange.startTimeSeconds,
        endTimeSeconds: timeRange.endTimeSeconds,
        durationSeconds: timeRange.durationSeconds,
        inputPath: patchPath
      });
      cursor = Math.max(cursor, timeRange.endTimeSeconds);
      return slot;
    });

  timeline.push({
    type: "source_tail",
    startTimeSeconds: Number(cursor.toFixed(3)),
    endTimeSeconds: null,
    durationSeconds: null,
    outputPath: join(workDir, "source-tail.mp4")
  });

  return {
    manifestId: "comic_scene_patch_manifest_v1",
    sourceRequestId: request.requestId,
    sourceVideoPath,
    outputDir,
    patchDir,
    workDir,
    finalOutputPath,
    mode: "scene_patch",
    renderWholeVideoAgain: false,
    patchSlotCount: patchSlots.length,
    highSeverityPatchCount: patchSlots.filter((slot) => slot.severity === "high").length,
    patchSlots,
    timeline,
    safety: {
      overwriteSource: false,
      requiresHumanApproval: patchSlots.some((slot) => slot.status === "waiting_human_approval"),
      canExecuteWithoutPatchClips: false
    },
    nextAction: patchSlots.length
      ? "Generate/approve each expectedPatchPath, then run with --mode execute --approved."
      : "No patch slots required."
  };
}

function markdownForManifest(manifest) {
  const lines = [
    "# Comic Scene Patch Manifest",
    "",
    `- Source video: ${manifest.sourceVideoPath ?? "n/a"}`,
    `- Patch slots: ${manifest.patchSlotCount}`,
    `- High severity: ${manifest.highSeverityPatchCount}`,
    `- Final output: ${manifest.finalOutputPath}`,
    `- Whole video rerender: ${manifest.renderWholeVideoAgain ? "yes" : "no"}`,
    "",
    "## Patch Slots"
  ];

  for (const slot of manifest.patchSlots) {
    lines.push("");
    lines.push(`### ${slot.order}. ${slot.sceneId}`);
    lines.push(`- Status: ${slot.status}`);
    lines.push(`- Correction: ${slot.correctionType}`);
    lines.push(`- Time: ${slot.timeRange.startTimeSeconds}s -> ${slot.timeRange.endTimeSeconds}s`);
    lines.push(`- Expected patch: ${slot.expectedPatchPath}`);
    for (const instruction of slot.instructions) lines.push(`- ${instruction}`);
  }

  lines.push("", "## Next Action", "", manifest.nextAction);
  return `${lines.join("\n")}\n`;
}

async function probeDuration(ffprobeCommand, inputPath) {
  const { stdout } = await runCommand(ffprobeCommand, [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "default=nw=1:nk=1",
    inputPath
  ]);
  const value = Number(stdout.trim());
  return Number.isFinite(value) ? value : null;
}

async function writeConcatList(path, entries) {
  await writeFile(path, entries.map((entry) => `file '${entry.replaceAll("'", "'\\''")}'`).join("\n"), "utf8");
}

async function executePatchManifest({ manifest, ffmpegCommand, ffprobeCommand, failOnMissingPatches }) {
  if (!manifest.sourceVideoPath || !(await fileExists(manifest.sourceVideoPath))) {
    throw new Error(`Source video is missing: ${manifest.sourceVideoPath ?? "n/a"}`);
  }

  await mkdir(manifest.workDir, { recursive: true });
  await mkdir(dirname(manifest.finalOutputPath), { recursive: true });

  const sourceDuration = await probeDuration(ffprobeCommand, manifest.sourceVideoPath);
  const missingPatchSlots = [];
  for (const slot of manifest.patchSlots) {
    if (!(await fileExists(slot.expectedPatchPath))) {
      missingPatchSlots.push(slot);
    }
  }
  if (missingPatchSlots.length) {
    const message = `Missing patch clips: ${missingPatchSlots.map((slot) => basename(slot.expectedPatchPath)).join(", ")}`;
    if (failOnMissingPatches) throw new Error(message);
    return {
      status: "waiting_patch_clips",
      sourceDuration,
      missingPatchCount: missingPatchSlots.length,
      missingPatchSlots: missingPatchSlots.map((slot) => ({ sceneId: slot.sceneId, expectedPatchPath: slot.expectedPatchPath }))
    };
  }

  const concatEntries = [];
  let sourcePartIndex = 0;
  for (const entry of manifest.timeline) {
    if (entry.type === "patch_clip") {
      concatEntries.push(entry.inputPath);
      continue;
    }
    if (entry.type === "source_slice") {
      if (entry.durationSeconds <= 0) continue;
      await runCommand(ffmpegCommand, [
        "-y",
        "-ss",
        entry.startTimeSeconds.toFixed(3),
        "-i",
        manifest.sourceVideoPath,
        "-t",
        entry.durationSeconds.toFixed(3),
        "-c",
        "copy",
        entry.outputPath
      ]);
      concatEntries.push(entry.outputPath);
      sourcePartIndex += 1;
      continue;
    }
    if (entry.type === "source_tail" && sourceDuration !== null && entry.startTimeSeconds < sourceDuration - 0.05) {
      await runCommand(ffmpegCommand, [
        "-y",
        "-ss",
        entry.startTimeSeconds.toFixed(3),
        "-i",
        manifest.sourceVideoPath,
        "-c",
        "copy",
        entry.outputPath
      ]);
      concatEntries.push(entry.outputPath);
      sourcePartIndex += 1;
    }
  }

  const concatListPath = join(manifest.workDir, "patched-concat-list.txt");
  await writeConcatList(concatListPath, concatEntries);
  await runCommand(ffmpegCommand, [
    "-y",
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    concatListPath,
    "-c",
    "copy",
    manifest.finalOutputPath
  ]);
  const outputStats = await stat(manifest.finalOutputPath);
  return {
    status: "completed",
    sourceDuration,
    finalOutputPath: manifest.finalOutputPath,
    outputBytes: outputStats.size,
    concatEntryCount: concatEntries.length,
    sourcePartCount: sourcePartIndex
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }
  if (!options.request || !options.outputDir) {
    printHelp();
    throw new Error("--request and --output-dir are required.");
  }
  if (!["plan", "execute"].includes(options.mode)) {
    throw new Error("--mode must be plan or execute.");
  }
  if (options.mode === "execute" && !options.approved) {
    throw new Error("Execute mode requires --approved. Review patch manifest first.");
  }

  const requestPath = resolve(options.request);
  const outputDir = resolve(options.outputDir);
  const request = JSON.parse(await readFile(requestPath, "utf8"));
  if (request.requestId !== "comic_assisted_rerender_request_v1") {
    throw new Error(`Unsupported request: ${request.requestId ?? "unknown"}`);
  }
  await mkdir(outputDir, { recursive: true });
  const manifest = buildScenePatchManifest({ request, outputDir });
  const manifestPath = join(outputDir, "scene-patch-manifest.json");
  const reviewPath = join(outputDir, "scene-patch-review.md");
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2), "utf8");
  await writeFile(reviewPath, markdownForManifest(manifest), "utf8");

  let execution = null;
  if (options.mode === "execute") {
    const ffmpeg = await safeCheckFfmpeg(runCommand);
    const ffprobe = await safeCheckFfprobe(runCommand);
    if (!ffmpeg.available || !ffprobe.available) {
      execution = {
        status: "skipped",
        reason: ffmpeg.errorMessage ?? ffprobe.errorMessage ?? "FFmpeg/FFprobe unavailable.",
        ffmpeg,
        ffprobe
      };
    } else {
      execution = await executePatchManifest({
        manifest,
        ffmpegCommand: ffmpeg.command ?? resolveBinaryCommand("ffmpeg").command,
        ffprobeCommand: ffprobe.command ?? resolveBinaryCommand("ffprobe").command,
        failOnMissingPatches: options.failOnMissingPatches
      });
    }
    await writeFile(join(outputDir, "scene-patch-execution.json"), JSON.stringify(execution, null, 2), "utf8");
  }

  console.log(JSON.stringify({
    status: execution?.status ?? "planned",
    manifestPath,
    reviewPath,
    patchSlotCount: manifest.patchSlotCount,
    finalOutputPath: manifest.finalOutputPath,
    renderWholeVideoAgain: manifest.renderWholeVideoAgain,
    execution
  }, null, 2));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    console.error(JSON.stringify({
      status: "failed",
      error: error instanceof Error ? error.message : String(error)
    }, null, 2));
    process.exitCode = 1;
  });
}
