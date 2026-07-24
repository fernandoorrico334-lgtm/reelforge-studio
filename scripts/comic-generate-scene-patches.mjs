import { access, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, extname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { spawn } from "node:child_process";
import {
  resolveBinaryCommand,
  safeCheckFfmpeg
} from "./lib/smoke-utils.mjs";

const root = process.cwd();

const imageExtensions = new Set([".jpg", ".jpeg", ".png", ".webp", ".bmp"]);
const videoExtensions = new Set([".mp4", ".mov", ".mkv", ".webm", ".avi"]);

function parseArgs(argv) {
  const options = {
    manifest: null,
    patchSources: null,
    outputDir: null,
    mode: "plan",
    approved: false,
    failOnMissingSource: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const next = argv[index + 1];
    if (token === "--manifest") {
      options.manifest = next ?? null;
      index += 1;
    } else if (token === "--patch-sources") {
      options.patchSources = next ?? null;
      index += 1;
    } else if (token === "--output-dir") {
      options.outputDir = next ?? null;
      index += 1;
    } else if (token === "--mode") {
      options.mode = next ?? options.mode;
      index += 1;
    } else if (token === "--approved") {
      options.approved = true;
    } else if (token === "--fail-on-missing-source") {
      options.failOnMissingSource = true;
    } else if (token === "--help" || token === "-h") {
      options.help = true;
    }
  }

  return options;
}

function printHelp() {
  console.log(`Usage:
node scripts/comic-generate-scene-patches.mjs --manifest <scene-patch-manifest.json> --patch-sources <patch-sources.json>

Modes:
  --mode plan       Build the patch generation plan only. Default.
  --mode generate   Generate approved scene patch clips with FFmpeg.

Safety:
  --approved is required for generate.
  Patch sources must be manually approved/local files.
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
  if (!path) return false;
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function normalizeSourceList(patchSources) {
  if (Array.isArray(patchSources)) return patchSources;
  if (Array.isArray(patchSources?.sources)) return patchSources.sources;
  return [];
}

function detectSourceType(source) {
  if (source?.sourceType) return source.sourceType;
  const extension = extname(source?.sourcePath ?? "").toLowerCase();
  if (imageExtensions.has(extension)) return "image";
  if (videoExtensions.has(extension)) return "video";
  return "unknown";
}

function indexPatchSources(patchSources) {
  const byKey = new Map();
  for (const source of normalizeSourceList(patchSources)) {
    const normalized = {
      ...source,
      sourcePath: source?.sourcePath ? resolve(source.sourcePath) : null,
      sourceType: detectSourceType(source)
    };
    for (const key of [source?.sceneId, source?.slotId, source?.requestItemId]) {
      if (key && !byKey.has(String(key))) byKey.set(String(key), normalized);
    }
  }
  return byKey;
}

function strategyForCorrectionType(correctionType) {
  switch (correctionType) {
    case "crop_retarget":
      return "image_zoom_patch";
    case "panel_swap":
      return "image_panel_patch";
    case "caption_rerender":
      return "caption_overlay_patch";
    case "timing_resync":
      return "hold_or_trim_patch";
    default:
      return "manual_patch";
  }
}

function findSourceForSlot(slot, indexedSources) {
  return (
    indexedSources.get(String(slot.sceneId)) ??
    indexedSources.get(String(slot.slotId)) ??
    indexedSources.get(String(slot.requestItemId)) ??
    null
  );
}

function durationForSlot(slot) {
  const value = Number(slot.requiredDurationSeconds ?? slot.timeRange?.durationSeconds ?? 0);
  return Number(Math.max(0.4, Number.isFinite(value) ? value : 0.4).toFixed(3));
}

function baseVideoFilter(source = {}) {
  const focus = source.focus ?? {};
  const zoom = Number(focus.zoom ?? 1);
  const safeZoom = Number.isFinite(zoom) ? Math.min(1.5, Math.max(1, zoom)) : 1;
  const scaledWidth = Math.round(1080 * safeZoom);
  const scaledHeight = Math.round(1920 * safeZoom);
  return `scale=${scaledWidth}:${scaledHeight}:force_original_aspect_ratio=increase,crop=1080:1920,format=yuv420p`;
}

function buildFfmpegArgsForSource({ source, task }) {
  const duration = durationForSlot(task.slot ?? task);
  const filter = baseVideoFilter(source);
  if (source.sourceType === "image") {
    return [
      "-y",
      "-loop",
      "1",
      "-i",
      source.sourcePath,
      "-t",
      duration.toFixed(3),
      "-vf",
      filter,
      "-an",
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "19",
      task.outputPath
    ];
  }

  return [
    "-y",
    "-i",
    source.sourcePath,
    "-t",
    duration.toFixed(3),
    "-vf",
    filter,
    "-an",
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "19",
    task.outputPath
  ];
}

export async function buildPatchGenerationPlan({ manifest, patchSources }) {
  const indexedSources = indexPatchSources(patchSources);
  const tasks = [];

  for (const slot of Array.isArray(manifest.patchSlots) ? manifest.patchSlots : []) {
    const source = findSourceForSlot(slot, indexedSources);
    const sourceExists = await fileExists(source?.sourcePath);
    const strategy = strategyForCorrectionType(slot.correctionType);
    const status = source
      ? sourceExists
        ? "ready_to_generate"
        : "missing_source_file"
      : "waiting_patch_source";
    const task = {
      taskId: `patch-gen-${String(tasks.length + 1).padStart(3, "0")}`,
      slotId: slot.slotId,
      requestItemId: slot.requestItemId,
      sceneId: slot.sceneId,
      order: slot.order,
      correctionType: slot.correctionType,
      strategy,
      status,
      severity: slot.severity,
      timeRange: slot.timeRange,
      durationSeconds: durationForSlot(slot),
      outputPath: slot.expectedPatchPath,
      source: source
        ? {
            sceneId: source.sceneId ?? null,
            slotId: source.slotId ?? null,
            requestItemId: source.requestItemId ?? null,
            sourcePath: source.sourcePath,
            sourceType: source.sourceType,
            captionText: source.captionText ?? null,
            focus: source.focus ?? null,
            approved: source.approved === true
          }
        : null,
      instructions: [
        `Correction strategy: ${strategy}`,
        ...(slot.instructions ?? []),
        "Gerar patch vertical 9:16 com a mesma duracao do slot.",
        "Usar apenas fonte local/autorizada aprovada manualmente."
      ],
      ffmpegArgsPreview: source && sourceExists
        ? buildFfmpegArgsForSource({ source, task: { slot, outputPath: slot.expectedPatchPath } })
        : null
    };
    tasks.push(task);
  }

  const readyTaskCount = tasks.filter((task) => task.status === "ready_to_generate").length;
  const waitingTaskCount = tasks.filter((task) => task.status !== "ready_to_generate").length;
  return {
    planId: "comic_scene_patch_generation_plan_v1",
    sourceManifestId: manifest.manifestId,
    sourceRequestId: manifest.sourceRequestId,
    sourceVideoPath: manifest.sourceVideoPath ?? null,
    renderWholeVideoAgain: false,
    mode: "generate_scene_patch_clips",
    patchTaskCount: tasks.length,
    readyTaskCount,
    waitingTaskCount,
    outputDir: manifest.outputDir,
    patchDir: manifest.patchDir,
    tasks,
    safety: {
      candidateFirst: true,
      requiresManualApproval: true,
      overwritesSourceVideo: false,
      generatesOnlyPatchClips: true
    },
    nextAction: readyTaskCount
      ? "Review sources, then run --mode generate --approved to create patch MP4 clips."
      : "Add approved patch sources for each waiting task."
  };
}

function markdownForPlan(plan, execution = null) {
  const lines = [
    "# Comic Scene Patch Generation Plan",
    "",
    `- Patch tasks: ${plan.patchTaskCount}`,
    `- Ready: ${plan.readyTaskCount}`,
    `- Waiting: ${plan.waitingTaskCount}`,
    `- Whole video rerender: ${plan.renderWholeVideoAgain ? "yes" : "no"}`,
    "",
    "## Tasks"
  ];

  for (const task of plan.tasks) {
    lines.push("");
    lines.push(`### ${task.order}. ${task.sceneId}`);
    lines.push(`- Status: ${task.status}`);
    lines.push(`- Strategy: ${task.strategy}`);
    lines.push(`- Source: ${task.source?.sourcePath ?? "waiting"}`);
    lines.push(`- Output: ${task.outputPath}`);
    lines.push(`- Duration: ${task.durationSeconds}s`);
  }

  if (execution) {
    lines.push("", "## Execution", "");
    lines.push(`- Status: ${execution.status}`);
    lines.push(`- Generated: ${execution.generatedCount ?? 0}`);
    lines.push(`- Failed: ${execution.failedCount ?? 0}`);
  }

  lines.push("", "## Next Action", "", plan.nextAction);
  return `${lines.join("\n")}\n`;
}

async function generatePatches({ plan, ffmpegCommand, failOnMissingSource }) {
  const results = [];
  let generatedCount = 0;
  let failedCount = 0;
  let waitingCount = 0;

  for (const task of plan.tasks) {
    if (task.status !== "ready_to_generate" || !task.source?.sourcePath) {
      waitingCount += 1;
      if (failOnMissingSource) {
        throw new Error(`Patch source missing for ${task.sceneId}: ${task.status}`);
      }
      results.push({
        taskId: task.taskId,
        sceneId: task.sceneId,
        status: task.status,
        outputPath: task.outputPath
      });
      continue;
    }

    await mkdir(dirname(task.outputPath), { recursive: true });
    try {
      const args = buildFfmpegArgsForSource({ source: task.source, task });
      await runCommand(ffmpegCommand, args);
      const outputStats = await stat(task.outputPath);
      generatedCount += 1;
      results.push({
        taskId: task.taskId,
        sceneId: task.sceneId,
        status: "generated",
        strategy: task.strategy,
        outputPath: task.outputPath,
        outputBytes: outputStats.size
      });
    } catch (error) {
      failedCount += 1;
      results.push({
        taskId: task.taskId,
        sceneId: task.sceneId,
        status: "failed",
        strategy: task.strategy,
        outputPath: task.outputPath,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  return {
    status: failedCount ? "partial" : "completed",
    generatedCount,
    failedCount,
    waitingCount,
    results
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }
  if (!options.manifest || !options.patchSources) {
    printHelp();
    throw new Error("--manifest and --patch-sources are required.");
  }
  if (!["plan", "generate"].includes(options.mode)) {
    throw new Error("--mode must be plan or generate.");
  }
  if (options.mode === "generate" && !options.approved) {
    throw new Error("Generate mode requires --approved. Review patch sources first.");
  }

  const manifestPath = resolve(options.manifest);
  const patchSourcesPath = resolve(options.patchSources);
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const patchSources = JSON.parse(await readFile(patchSourcesPath, "utf8"));
  if (manifest.manifestId !== "comic_scene_patch_manifest_v1") {
    throw new Error(`Unsupported manifest: ${manifest.manifestId ?? "unknown"}`);
  }
  const outputDir = resolve(options.outputDir ?? manifest.outputDir ?? dirname(manifestPath));
  await mkdir(outputDir, { recursive: true });

  const plan = await buildPatchGenerationPlan({ manifest, patchSources });
  const planPath = join(outputDir, "scene-patch-generation-plan.json");
  let execution = null;
  if (options.mode === "generate") {
    const ffmpeg = await safeCheckFfmpeg(runCommand);
    if (!ffmpeg.available) {
      execution = {
        status: "skipped",
        reason: ffmpeg.errorMessage ?? "FFmpeg unavailable.",
        ffmpeg
      };
    } else {
      execution = await generatePatches({
        plan,
        ffmpegCommand: ffmpeg.command ?? resolveBinaryCommand("ffmpeg").command,
        failOnMissingSource: options.failOnMissingSource
      });
    }
    await writeFile(join(outputDir, "scene-patch-generation-execution.json"), JSON.stringify(execution, null, 2), "utf8");
  }

  await writeFile(planPath, JSON.stringify(plan, null, 2), "utf8");
  await writeFile(join(outputDir, "scene-patch-generation-review.md"), markdownForPlan(plan, execution), "utf8");

  console.log(JSON.stringify({
    status: execution?.status ?? "planned",
    planPath,
    patchTaskCount: plan.patchTaskCount,
    readyTaskCount: plan.readyTaskCount,
    waitingTaskCount: plan.waitingTaskCount,
    renderWholeVideoAgain: plan.renderWholeVideoAgain,
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
