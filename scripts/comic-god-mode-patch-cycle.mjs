import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { spawn } from "node:child_process";
import { buildAssistedPatchWorkflow } from "./comic-assisted-patch-workflow.mjs";
import { buildApprovedPatchExecutionPlan } from "./comic-approved-patch-execution.mjs";

function parseArgs(argv) {
  const options = {
    mode: "analyze",
    input: null,
    scenePlan: null,
    retryPlan: null,
    panelCatalog: null,
    patchSources: null,
    outputDir: "tmp/comic-god-mode-patch-cycle",
    approvedRequest: false,
    approved: false,
    topN: 3,
    sampleCount: 32,
    minimumApprovalScore: 78,
    failOnBlocked: false,
    failOnMissingSource: true,
    failOnMissingPatches: true
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const next = argv[index + 1];
    if (token === "--mode") {
      options.mode = next ?? options.mode;
      index += 1;
    } else if (token === "--input" || token === "--video") {
      options.input = next ?? null;
      index += 1;
    } else if (token === "--scene-plan") {
      options.scenePlan = next ?? null;
      index += 1;
    } else if (token === "--retry-plan") {
      options.retryPlan = next ?? null;
      index += 1;
    } else if (token === "--panel-catalog") {
      options.panelCatalog = next ?? null;
      index += 1;
    } else if (token === "--patch-sources") {
      options.patchSources = next ?? null;
      index += 1;
    } else if (token === "--output-dir") {
      options.outputDir = next ?? options.outputDir;
      index += 1;
    } else if (token === "--top-n") {
      options.topN = Number(next ?? options.topN);
      index += 1;
    } else if (token === "--sample-count") {
      options.sampleCount = Number(next ?? options.sampleCount);
      index += 1;
    } else if (token === "--minimum-approval-score") {
      options.minimumApprovalScore = Number(next ?? options.minimumApprovalScore);
      index += 1;
    } else if (token === "--approved-request") {
      options.approvedRequest = true;
    } else if (token === "--approved") {
      options.approved = true;
    } else if (token === "--fail-on-blocked") {
      options.failOnBlocked = true;
    } else if (token === "--allow-missing-source") {
      options.failOnMissingSource = false;
    } else if (token === "--allow-missing-patches") {
      options.failOnMissingPatches = false;
    } else if (token === "--help" || token === "-h") {
      options.help = true;
    }
  }

  return options;
}

function printHelp() {
  console.log(`Usage:
node scripts/comic-god-mode-patch-cycle.mjs --input <video.mp4> --scene-plan <scene-plan.json> --panel-catalog <panel-catalog.json> --output-dir <dir>

Modes:
  analyze           Runs post-render QA, creates retry plan, suggests patch sources and writes approval files.
  from-retry-plan   Skips video QA and starts from an existing comic-post-render-retry-plan.json.
  execute-approved Validates approved patch sources, renders patch clips and stitches output-patched.mp4.

Safety:
  This workflow is candidate-first. It never approves patch sources automatically.
  execute-approved requires --approved and approved=true in the patch source file.
`);
}

async function readJson(path) {
  return JSON.parse(await readFile(resolve(path), "utf8"));
}

async function writeJson(path, data) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(data, null, 2), "utf8");
}

function runNodeScript(args, { cwd = process.cwd() } = {}) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(process.execPath, args, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
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
    child.on("error", rejectPromise);
    child.on("close", (code) => {
      if (code && code !== 0) {
        const error = new Error(stderr.trim() || stdout.trim() || `Command failed with code ${code}`);
        error.stdout = stdout;
        error.stderr = stderr;
        error.code = code;
        rejectPromise(error);
        return;
      }
      resolvePromise({ stdout, stderr, code });
    });
  });
}

function toCliPath(path) {
  return path ? resolve(path) : null;
}

function buildAnalyzeCommand({ input, scenePlan, panelCatalog, outputDir }) {
  const parts = [
    "npm run comic:god-mode-patch-cycle --",
    `--input "${input}"`,
    scenePlan ? `--scene-plan "${scenePlan}"` : "",
    `--panel-catalog "${panelCatalog}"`,
    `--output-dir "${outputDir}"`,
    "--approved-request"
  ].filter(Boolean);
  return parts.join(" ");
}

function buildExecuteCommand({ manifestPath, patchSourcesPath, outputDir }) {
  return [
    "npm run comic:approved-patch-execution --",
    `--manifest "${manifestPath}"`,
    `--patch-sources "${patchSourcesPath}"`,
    `--output-dir "${outputDir}"`,
    "--mode execute --approved --fail-on-missing-source --fail-on-missing-patches"
  ].join(" ");
}

function cycleMarkdown(summary) {
  const lines = [
    "# Comic God Mode Patch Cycle",
    "",
    `- Status: ${summary.status}`,
    `- Mode: ${summary.mode}`,
    `- Source video: ${summary.sourceVideoPath ?? "n/a"}`,
    `- Retry scenes: ${summary.retrySceneCount}`,
    `- Patch slots: ${summary.patchSlotCount}`,
    `- Suggested sources: ${summary.suggestedSourceCount}`,
    `- Approval required: ${summary.approvalRequired ? "yes" : "no"}`,
    "",
    "## Files",
    `- QA report: ${summary.files.qaReportPath ?? "n/a"}`,
    `- Retry plan: ${summary.files.retryPlanPath ?? "n/a"}`,
    `- Workflow summary: ${summary.files.workflowSummaryPath ?? "n/a"}`,
    `- Patch sources draft: ${summary.files.patchSourcesDraftPath ?? "n/a"}`,
    `- Scene patch manifest: ${summary.files.manifestPath ?? "n/a"}`,
    `- Final patched output: ${summary.files.finalPatchedOutputPath ?? "n/a"}`,
    "",
    "## Next Actions",
    "1. Review patch-sources-draft.json.",
    "2. Set approved=true only for local, authorized and semantically correct panel/video sources.",
    "3. Run the approved execution command.",
    "",
    "## Approved Execution Command",
    "```powershell",
    summary.nextCommands.approveAndExecute,
    "```"
  ];

  return `${lines.join("\n")}\n`;
}

export async function buildGodModePatchCycleFromRetryPlan({
  retryPlan,
  retryPlanPath = null,
  panelCatalog,
  outputDir,
  options = {}
}) {
  const cycleDir = resolve(outputDir);
  const workflowDir = join(cycleDir, "workflow");
  await mkdir(cycleDir, { recursive: true });

  const workflow = await buildAssistedPatchWorkflow({
    retryPlan,
    panelCatalog,
    outputDir: workflowDir,
    retryPlanPath,
    options: {
      approvedRequest: options.approvedRequest === true,
      topN: Number.isFinite(options.topN) ? options.topN : 3,
      useDraftSources: false
    }
  });

  const summaryPath = join(cycleDir, "comic-god-mode-patch-cycle-summary.json");
  const reviewPath = join(cycleDir, "comic-god-mode-patch-cycle-review.md");
  const manifestPath = workflow.summary.files.manifestPath;
  const patchSourcesDraftPath = workflow.summary.files.patchSourcesDraftPath;
  const finalPatchedOutputPath = workflow.manifest.finalOutputPath;
  const approveAndExecute = buildExecuteCommand({
    manifestPath,
    patchSourcesPath: patchSourcesDraftPath,
    outputDir: workflowDir
  });

  const summary = {
    cycleId: "comic_god_mode_patch_cycle_v1",
    mode: options.mode ?? "from-retry-plan",
    status: workflow.summary.status,
    sourceVideoPath: retryPlan.sourceVideoPath ?? null,
    retrySceneCount: workflow.summary.retrySceneCount,
    patchSlotCount: workflow.summary.patchSlotCount,
    suggestedSourceCount: workflow.summary.suggestedSourceCount,
    readyTaskCount: workflow.summary.readyTaskCount,
    waitingTaskCount: workflow.summary.waitingTaskCount,
    candidateFirst: true,
    approvalRequired: true,
    files: {
      qaReportPath: options.qaReportPath ?? null,
      retryPlanPath,
      workflowSummaryPath: workflow.summary.files.summaryPath,
      patchSourcesDraftPath,
      manifestPath,
      finalPatchedOutputPath,
      summaryPath,
      reviewPath
    },
    nextCommands: {
      analyzeAgain: options.analyzeCommand ?? null,
      approveAndExecute
    },
    safety: {
      approvesSourcesAutomatically: false,
      rendersBeforeApproval: false,
      overwritesSourceVideo: false,
      requiresManualPatchSourceApproval: true
    }
  };

  await writeJson(summaryPath, summary);
  await writeFile(reviewPath, cycleMarkdown(summary), "utf8");
  return { summary, workflow };
}

async function runAnalyzeMode(options) {
  if (!options.input || !options.panelCatalog) {
    throw new Error("--input and --panel-catalog are required for analyze mode.");
  }

  const outputDir = resolve(options.outputDir);
  const qaDir = join(outputDir, "qa");
  await mkdir(qaDir, { recursive: true });

  const qaArgs = [
    "scripts/comic-post-render-qa.mjs",
    "--input",
    toCliPath(options.input),
    "--output-dir",
    qaDir,
    "--sample-count",
    String(options.sampleCount),
    "--minimum-approval-score",
    String(options.minimumApprovalScore)
  ];
  if (options.scenePlan) {
    qaArgs.push("--scene-plan", toCliPath(options.scenePlan));
  }
  if (options.failOnBlocked) {
    qaArgs.push("--fail-on-blocked");
  }

  const qaRun = await runNodeScript(qaArgs);
  const retryPlanPath = join(qaDir, "comic-post-render-retry-plan.json");
  const retryPlan = await readJson(retryPlanPath);
  const panelCatalog = await readJson(options.panelCatalog);
  const result = await buildGodModePatchCycleFromRetryPlan({
    retryPlan,
    retryPlanPath,
    panelCatalog,
    outputDir,
    options: {
      mode: "analyze",
      approvedRequest: options.approvedRequest,
      topN: options.topN,
      qaReportPath: join(qaDir, "comic-post-render-director-report.json"),
      analyzeCommand: buildAnalyzeCommand({
        input: toCliPath(options.input),
        scenePlan: options.scenePlan ? toCliPath(options.scenePlan) : null,
        panelCatalog: toCliPath(options.panelCatalog),
        outputDir
      })
    }
  });

  return { ...result, qaRun };
}

async function runFromRetryPlanMode(options) {
  if (!options.retryPlan || !options.panelCatalog) {
    throw new Error("--retry-plan and --panel-catalog are required for from-retry-plan mode.");
  }
  const retryPlanPath = resolve(options.retryPlan);
  const retryPlan = await readJson(retryPlanPath);
  const panelCatalog = await readJson(options.panelCatalog);
  return buildGodModePatchCycleFromRetryPlan({
    retryPlan,
    retryPlanPath,
    panelCatalog,
    outputDir: options.outputDir,
    options: {
      mode: "from-retry-plan",
      approvedRequest: options.approvedRequest,
      topN: options.topN
    }
  });
}

async function runExecuteApprovedMode(options) {
  if (!options.patchSources) {
    throw new Error("--patch-sources is required for execute-approved mode.");
  }
  if (!options.approved) {
    throw new Error("execute-approved requires --approved.");
  }
  const workflowDir = join(resolve(options.outputDir), "workflow");
  const manifestPath = join(workflowDir, "scene-patch-manifest.json");
  const manifest = await readJson(manifestPath);
  const patchSources = await readJson(options.patchSources);
  const plan = await buildApprovedPatchExecutionPlan({
    manifest,
    patchSources,
    outputDir: workflowDir
  });
  if (!plan.canExecute) {
    throw new Error(`Approved execution is not ready: ${plan.blockers.join("; ")}`);
  }

  const executionArgs = [
    "scripts/comic-approved-patch-execution.mjs",
    "--manifest",
    manifestPath,
    "--patch-sources",
    resolve(options.patchSources),
    "--output-dir",
    workflowDir,
    "--mode",
    "execute",
    "--approved"
  ];
  if (options.failOnMissingSource) {
    executionArgs.push("--fail-on-missing-source");
  }
  if (options.failOnMissingPatches) {
    executionArgs.push("--fail-on-missing-patches");
  }

  const executionRun = await runNodeScript(executionArgs);
  return {
    summary: {
      cycleId: "comic_god_mode_patch_cycle_v1",
      mode: "execute-approved",
      status: "completed",
      patchSlotCount: manifest.patchSlotCount,
      finalOutputPath: manifest.finalOutputPath,
      executionStdout: executionRun.stdout.trim()
    },
    executionRun
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  let result;
  if (options.mode === "analyze") {
    result = await runAnalyzeMode(options);
  } else if (options.mode === "from-retry-plan") {
    result = await runFromRetryPlanMode(options);
  } else if (options.mode === "execute-approved") {
    result = await runExecuteApprovedMode(options);
  } else {
    throw new Error(`Unsupported mode: ${options.mode}`);
  }

  console.log(JSON.stringify({
    status: result.summary.status,
    mode: result.summary.mode,
    retrySceneCount: result.summary.retrySceneCount ?? null,
    patchSlotCount: result.summary.patchSlotCount ?? null,
    suggestedSourceCount: result.summary.suggestedSourceCount ?? null,
    summaryPath: result.summary.files?.summaryPath ?? null,
    reviewPath: result.summary.files?.reviewPath ?? null,
    finalOutputPath: result.summary.finalOutputPath ?? result.summary.files?.finalPatchedOutputPath ?? null,
    nextAction: result.summary.nextCommands?.approveAndExecute ?? null
  }, null, 2));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    console.error(JSON.stringify({
      status: "failed",
      error: error instanceof Error ? error.message : String(error),
      stdout: error?.stdout,
      stderr: error?.stderr
    }, null, 2));
    process.exitCode = 1;
  });
}
