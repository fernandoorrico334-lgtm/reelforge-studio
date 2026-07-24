import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { spawn } from "node:child_process";
import {
  resolveBinaryCommand,
  safeCheckFfmpeg,
  safeCheckFfprobe
} from "./lib/smoke-utils.mjs";
import { buildPatchGenerationPlan, generatePatches } from "./comic-generate-scene-patches.mjs";
import { executePatchManifest } from "./comic-scene-patch-renderer.mjs";

const root = process.cwd();

function parseArgs(argv) {
  const options = {
    manifest: null,
    patchSources: null,
    outputDir: null,
    mode: "plan",
    approved: false,
    failOnMissingSource: false,
    failOnMissingPatches: false
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
node scripts/comic-approved-patch-execution.mjs --manifest <scene-patch-manifest.json> --patch-sources <approved-patch-sources.json> --output-dir <dir>

Modes:
  --mode plan      Validate approvals and write execution plan. Default.
  --mode execute   Generate approved patch clips and stitch output-patched.mp4.

Safety:
  --approved is required for execute.
  Every patch source must have approved=true.
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

function normalizeSourceList(patchSources) {
  if (Array.isArray(patchSources)) return patchSources;
  if (Array.isArray(patchSources?.sources)) return patchSources.sources;
  return [];
}

function approvalKey(source) {
  return String(source.sceneId ?? source.slotId ?? source.requestItemId ?? source.sourcePath ?? "unknown");
}

function buildApprovalReport({ manifest, patchSources, generationPlan }) {
  const sources = normalizeSourceList(patchSources);
  const unapprovedSources = sources.filter((source) => source.approved !== true);
  const readyTasks = generationPlan.tasks.filter((task) => task.status === "ready_to_generate");
  const waitingTasks = generationPlan.tasks.filter((task) => task.status !== "ready_to_generate");
  const readyButUnapprovedTasks = readyTasks.filter((task) => task.source?.approved !== true);
  const canExecute =
    manifest.manifestId === "comic_scene_patch_manifest_v1" &&
    generationPlan.patchTaskCount > 0 &&
    readyTasks.length === generationPlan.patchTaskCount &&
    readyButUnapprovedTasks.length === 0 &&
    unapprovedSources.length === 0;

  return {
    status: canExecute ? "approved_ready" : "blocked_not_approved",
    canExecute,
    sourceCount: sources.length,
    unapprovedSourceCount: unapprovedSources.length,
    readyTaskCount: readyTasks.length,
    waitingTaskCount: waitingTasks.length,
    readyButUnapprovedTaskCount: readyButUnapprovedTasks.length,
    unapprovedSources: unapprovedSources.map((source) => ({
      key: approvalKey(source),
      sourcePath: source.sourcePath ?? null,
      approved: source.approved === true
    })),
    waitingTasks: waitingTasks.map((task) => ({
      taskId: task.taskId,
      sceneId: task.sceneId,
      status: task.status,
      sourcePath: task.source?.sourcePath ?? null
    })),
    readyButUnapprovedTasks: readyButUnapprovedTasks.map((task) => ({
      taskId: task.taskId,
      sceneId: task.sceneId,
      sourcePath: task.source?.sourcePath ?? null,
      approved: task.source?.approved === true
    }))
  };
}

export async function buildApprovedPatchExecutionPlan({ manifest, patchSources, outputDir }) {
  const executionDir = resolve(outputDir ?? manifest.outputDir ?? ".");
  await mkdir(executionDir, { recursive: true });
  const generationPlan = await buildPatchGenerationPlan({ manifest, patchSources });
  const approvalReport = buildApprovalReport({ manifest, patchSources, generationPlan });
  return {
    planId: "comic_approved_patch_execution_plan_v1",
    mode: "approved_scene_patch_execution",
    status: approvalReport.status,
    canExecute: approvalReport.canExecute,
    renderWholeVideoAgain: false,
    outputDir: executionDir,
    finalOutputPath: manifest.finalOutputPath,
    manifest,
    generationPlan,
    approvalReport,
    safety: {
      requiresApprovedFlag: true,
      requiresEverySourceApproved: true,
      overwritesSourceVideo: false,
      rendersOnlyPatchClipsBeforeStitch: true,
      originalVideoPath: manifest.sourceVideoPath ?? null
    },
    nextAction: approvalReport.canExecute
      ? "Run with --mode execute --approved to generate patch clips and stitch output-patched.mp4."
      : "Review patch sources, set approved=true for every correct local source, and ensure all patch files are ready to generate."
  };
}

function markdownForPlan(plan, execution = null) {
  const lines = [
    "# Comic Approved Patch Execution",
    "",
    `- Status: ${plan.status}`,
    `- Can execute: ${plan.canExecute ? "yes" : "no"}`,
    `- Patch tasks: ${plan.generationPlan.patchTaskCount}`,
    `- Ready tasks: ${plan.approvalReport.readyTaskCount}`,
    `- Waiting tasks: ${plan.approvalReport.waitingTaskCount}`,
    `- Unapproved sources: ${plan.approvalReport.unapprovedSourceCount}`,
    `- Final output: ${plan.finalOutputPath}`,
    `- Whole video rerender: ${plan.renderWholeVideoAgain ? "yes" : "no"}`,
    "",
    "## Tasks"
  ];

  for (const task of plan.generationPlan.tasks) {
    lines.push("");
    lines.push(`### ${task.order}. ${task.sceneId}`);
    lines.push(`- Status: ${task.status}`);
    lines.push(`- Strategy: ${task.strategy}`);
    lines.push(`- Approved: ${task.source?.approved === true ? "yes" : "no"}`);
    lines.push(`- Source: ${task.source?.sourcePath ?? "waiting"}`);
    lines.push(`- Patch output: ${task.outputPath}`);
  }

  if (execution) {
    lines.push("", "## Execution", "");
    lines.push(`- Status: ${execution.status}`);
    lines.push(`- Patch generation: ${execution.patchGeneration?.status ?? "n/a"}`);
    lines.push(`- Stitch: ${execution.stitch?.status ?? "n/a"}`);
    if (execution.stitch?.finalOutputPath) lines.push(`- Output: ${execution.stitch.finalOutputPath}`);
  }

  lines.push("", "## Next Action", "", plan.nextAction);
  return `${lines.join("\n")}\n`;
}

async function writeJson(path, data) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(data, null, 2), "utf8");
}

async function executeApprovedPlan({ plan, failOnMissingSource, failOnMissingPatches }) {
  const ffmpeg = await safeCheckFfmpeg(runCommand);
  const ffprobe = await safeCheckFfprobe(runCommand);
  if (!ffmpeg.available || !ffprobe.available) {
    return {
      status: "skipped",
      reason: ffmpeg.errorMessage ?? ffprobe.errorMessage ?? "FFmpeg/FFprobe unavailable.",
      ffmpeg,
      ffprobe
    };
  }

  const ffmpegCommand = ffmpeg.command ?? resolveBinaryCommand("ffmpeg").command;
  const ffprobeCommand = ffprobe.command ?? resolveBinaryCommand("ffprobe").command;
  const patchGeneration = await generatePatches({
    plan: plan.generationPlan,
    ffmpegCommand,
    failOnMissingSource
  });
  if (!["completed", "partial"].includes(patchGeneration.status) || patchGeneration.failedCount > 0 || patchGeneration.waitingCount > 0) {
    return {
      status: "patch_generation_incomplete",
      patchGeneration,
      stitch: null
    };
  }

  const stitch = await executePatchManifest({
    manifest: plan.manifest,
    ffmpegCommand,
    ffprobeCommand,
    failOnMissingPatches
  });

  return {
    status: stitch.status === "completed" ? "completed" : "partial",
    patchGeneration,
    stitch
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }
  if (!options.manifest || !options.patchSources || !options.outputDir) {
    printHelp();
    throw new Error("--manifest, --patch-sources and --output-dir are required.");
  }
  if (!["plan", "execute"].includes(options.mode)) {
    throw new Error("--mode must be plan or execute.");
  }
  if (options.mode === "execute" && !options.approved) {
    throw new Error("Execute mode requires --approved. Review every patch source first.");
  }

  const manifest = JSON.parse(await readFile(resolve(options.manifest), "utf8"));
  const patchSources = JSON.parse(await readFile(resolve(options.patchSources), "utf8"));
  if (manifest.manifestId !== "comic_scene_patch_manifest_v1") {
    throw new Error(`Unsupported manifest: ${manifest.manifestId ?? "unknown"}`);
  }
  const outputDir = resolve(options.outputDir);
  await mkdir(outputDir, { recursive: true });
  const plan = await buildApprovedPatchExecutionPlan({ manifest, patchSources, outputDir });
  const planPath = join(outputDir, "approved-patch-execution-plan.json");
  let execution = null;

  if (options.mode === "execute") {
    if (!plan.canExecute) {
      execution = {
        status: "blocked_not_approved",
        approvalReport: plan.approvalReport
      };
    } else {
      execution = await executeApprovedPlan({
        plan,
        failOnMissingSource: options.failOnMissingSource,
        failOnMissingPatches: options.failOnMissingPatches
      });
    }
    await writeJson(join(outputDir, "approved-patch-execution-result.json"), execution);
  }

  await writeJson(planPath, plan);
  await writeFile(join(outputDir, "approved-patch-execution-review.md"), markdownForPlan(plan, execution), "utf8");

  console.log(JSON.stringify({
    status: execution?.status ?? plan.status,
    planPath,
    canExecute: plan.canExecute,
    readyTaskCount: plan.approvalReport.readyTaskCount,
    waitingTaskCount: plan.approvalReport.waitingTaskCount,
    unapprovedSourceCount: plan.approvalReport.unapprovedSourceCount,
    finalOutputPath: plan.finalOutputPath,
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
