import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { buildRerenderRequest } from "./comic-rerender-request-from-qa.mjs";
import { buildScenePatchManifest } from "./comic-scene-patch-renderer.mjs";
import { buildPatchSourceSuggestionPlan } from "./comic-suggest-patch-sources.mjs";
import { buildPatchGenerationPlan } from "./comic-generate-scene-patches.mjs";

function parseArgs(argv) {
  const options = {
    retryPlan: null,
    panelCatalog: null,
    outputDir: null,
    title: "comic-assisted-patch-workflow",
    episode: null,
    approvedRequest: false,
    topN: 3,
    useDraftSources: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const next = argv[index + 1];
    if (token === "--retry-plan") {
      options.retryPlan = next ?? null;
      index += 1;
    } else if (token === "--panel-catalog") {
      options.panelCatalog = next ?? null;
      index += 1;
    } else if (token === "--output-dir") {
      options.outputDir = next ?? null;
      index += 1;
    } else if (token === "--title") {
      options.title = next ?? options.title;
      index += 1;
    } else if (token === "--episode") {
      options.episode = Number.parseInt(next ?? "", 10);
      index += 1;
    } else if (token === "--top-n") {
      options.topN = Number(next ?? options.topN);
      index += 1;
    } else if (token === "--approved-request") {
      options.approvedRequest = true;
    } else if (token === "--use-draft-sources") {
      options.useDraftSources = true;
    } else if (token === "--help" || token === "-h") {
      options.help = true;
    }
  }

  return options;
}

function printHelp() {
  console.log(`Usage:
node scripts/comic-assisted-patch-workflow.mjs --retry-plan <comic-post-render-retry-plan.json> --panel-catalog <panels.json> --output-dir <dir>

Pipeline:
  retry plan -> assisted rerender request -> scene patch manifest -> patch source suggestions -> patch generation plan

Safety:
  This command does not render patches or stitch video.
  Suggested patch sources are drafts and remain approved=false.
  Use --approved-request only when the QA retry request has already been reviewed.
`);
}

function requestMarkdown(request) {
  const lines = [
    "# Comic Assisted Patch Workflow Request",
    "",
    `- Status: ${request.status}`,
    `- Source video: ${request.sourceVideoPath ?? "n/a"}`,
    `- Retry scenes: ${request.retrySceneCount}`,
    `- Whole video rerender: ${request.renderWholeVideoAgain ? "yes" : "no"}`,
    "",
    "## Items"
  ];

  for (const item of request.items) {
    lines.push("");
    lines.push(`### ${item.order}. ${item.sceneId}`);
    lines.push(`- Correction: ${item.correctionType}`);
    lines.push(`- Action: ${item.primaryAction}`);
    lines.push(`- Reason: ${item.reason}`);
    lines.push(`- Suggested fix: ${item.suggestedFix}`);
    lines.push(`- Approval status: ${item.status}`);
  }

  return `${lines.join("\n")}\n`;
}

function manifestMarkdown(manifest) {
  const lines = [
    "# Comic Scene Patch Manifest",
    "",
    `- Patch slots: ${manifest.patchSlotCount}`,
    `- Final output: ${manifest.finalOutputPath}`,
    `- Whole video rerender: ${manifest.renderWholeVideoAgain ? "yes" : "no"}`,
    "",
    "## Slots"
  ];

  for (const slot of manifest.patchSlots) {
    lines.push("");
    lines.push(`### ${slot.order}. ${slot.sceneId}`);
    lines.push(`- Correction: ${slot.correctionType}`);
    lines.push(`- Expected patch: ${slot.expectedPatchPath}`);
    lines.push(`- Duration: ${slot.requiredDurationSeconds}s`);
  }

  return `${lines.join("\n")}\n`;
}

function suggestionsMarkdown(suggestionPlan) {
  const lines = [
    "# Comic Patch Source Suggestions",
    "",
    `- Suggested sources: ${suggestionPlan.suggestedSourceCount}`,
    `- Approval required: ${suggestionPlan.approvalRequired ? "yes" : "no"}`,
    "",
    "## Suggestions"
  ];

  for (const suggestion of suggestionPlan.suggestions) {
    lines.push("");
    lines.push(`### ${suggestion.order}. ${suggestion.sceneId}`);
    lines.push(`- Correction: ${suggestion.correctionType}`);
    lines.push(`- Status: ${suggestion.status}`);
    for (const candidate of suggestion.candidates) {
      lines.push(`- Candidate: ${candidate.candidateId} | score ${candidate.score} | ${candidate.sourcePath}`);
      lines.push(`  Reasons: ${candidate.reasons.join(", ")}`);
    }
  }

  return `${lines.join("\n")}\n`;
}

function generationMarkdown(generationPlan) {
  const lines = [
    "# Comic Scene Patch Generation Plan",
    "",
    `- Patch tasks: ${generationPlan.patchTaskCount}`,
    `- Ready: ${generationPlan.readyTaskCount}`,
    `- Waiting: ${generationPlan.waitingTaskCount}`,
    `- Whole video rerender: ${generationPlan.renderWholeVideoAgain ? "yes" : "no"}`,
    "",
    "## Tasks"
  ];

  for (const task of generationPlan.tasks) {
    lines.push("");
    lines.push(`### ${task.order}. ${task.sceneId}`);
    lines.push(`- Status: ${task.status}`);
    lines.push(`- Strategy: ${task.strategy}`);
    lines.push(`- Source: ${task.source?.sourcePath ?? "waiting"}`);
    lines.push(`- Output: ${task.outputPath}`);
  }

  return `${lines.join("\n")}\n`;
}

function workflowMarkdown(summary) {
  const lines = [
    "# Comic Assisted Patch Workflow",
    "",
    `- Status: ${summary.status}`,
    `- Retry scenes: ${summary.retrySceneCount}`,
    `- Patch slots: ${summary.patchSlotCount}`,
    `- Suggested sources: ${summary.suggestedSourceCount}`,
    `- Ready patch tasks: ${summary.readyTaskCount}`,
    `- Waiting patch tasks: ${summary.waitingTaskCount}`,
    `- Whole video rerender: ${summary.renderWholeVideoAgain ? "yes" : "no"}`,
    "",
    "## Files",
    `- Request: ${summary.files.requestPath}`,
    `- Manifest: ${summary.files.manifestPath}`,
    `- Suggestions: ${summary.files.suggestionsPath}`,
    `- Patch sources draft: ${summary.files.patchSourcesDraftPath}`,
    `- Generation plan: ${summary.files.generationPlanPath}`,
    "",
    "## Next Action",
    "Review patch-sources-draft.json, set approved=true only for correct sources, then run comic:generate-scene-patches. After patch MP4 clips exist, run comic:scene-patch-renderer --mode execute --approved."
  ];

  return `${lines.join("\n")}\n`;
}

async function writeJson(path, data) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(data, null, 2), "utf8");
}

export async function buildAssistedPatchWorkflow({ retryPlan, panelCatalog, outputDir, options = {}, retryPlanPath = null }) {
  const workflowDir = resolve(outputDir);
  await mkdir(workflowDir, { recursive: true });

  const request = buildRerenderRequest({
    retryPlan,
    options: {
      title: options.title ?? "comic-assisted-patch-workflow",
      episode: options.episode,
      approved: options.approvedRequest === true
    },
    retryPlanPath
  });
  const manifest = buildScenePatchManifest({ request, outputDir: workflowDir });
  const suggestionPlan = await buildPatchSourceSuggestionPlan({
    manifest,
    panelCatalog,
    topN: Number.isFinite(options.topN) ? options.topN : 3
  });
  const patchSourcesForGeneration = options.useDraftSources
    ? suggestionPlan.patchSourcesDraft
    : { sources: [] };
  const generationPlan = await buildPatchGenerationPlan({
    manifest,
    patchSources: patchSourcesForGeneration
  });

  const files = {
    requestPath: join(workflowDir, "assisted-rerender-request.json"),
    requestReviewPath: join(workflowDir, "assisted-rerender-request.md"),
    manifestPath: join(workflowDir, "scene-patch-manifest.json"),
    manifestReviewPath: join(workflowDir, "scene-patch-review.md"),
    suggestionsPath: join(workflowDir, "patch-source-suggestions.json"),
    suggestionsReviewPath: join(workflowDir, "patch-source-suggestions.md"),
    patchSourcesDraftPath: join(workflowDir, "patch-sources-draft.json"),
    generationPlanPath: join(workflowDir, "scene-patch-generation-plan.json"),
    generationReviewPath: join(workflowDir, "scene-patch-generation-review.md"),
    summaryPath: join(workflowDir, "assisted-patch-workflow-summary.json"),
    summaryReviewPath: join(workflowDir, "assisted-patch-workflow-summary.md")
  };

  const summary = {
    workflowId: "comic_assisted_patch_workflow_v1",
    status: request.retrySceneCount ? "review_required" : "clean",
    sourceRetryPlanPath: retryPlanPath,
    sourceVideoPath: retryPlan.sourceVideoPath ?? null,
    retrySceneCount: request.retrySceneCount,
    patchSlotCount: manifest.patchSlotCount,
    suggestedSourceCount: suggestionPlan.suggestedSourceCount,
    readyTaskCount: generationPlan.readyTaskCount,
    waitingTaskCount: generationPlan.waitingTaskCount,
    renderWholeVideoAgain: false,
    candidateFirst: true,
    approvalRequired: true,
    usedDraftSourcesForGeneration: options.useDraftSources === true,
    files,
    safety: {
      rendersPatches: false,
      stitchesVideo: false,
      overwritesSourceVideo: false,
      approvesSourcesAutomatically: false,
      userMustApprovePatchSources: true
    },
    nextAction: "Review patch-sources-draft.json, approve correct sources manually, then generate patches."
  };

  await writeJson(files.requestPath, request);
  await writeFile(files.requestReviewPath, requestMarkdown(request), "utf8");
  await writeJson(files.manifestPath, manifest);
  await writeFile(files.manifestReviewPath, manifestMarkdown(manifest), "utf8");
  await writeJson(files.suggestionsPath, suggestionPlan);
  await writeFile(files.suggestionsReviewPath, suggestionsMarkdown(suggestionPlan), "utf8");
  await writeJson(files.patchSourcesDraftPath, suggestionPlan.patchSourcesDraft);
  await writeJson(files.generationPlanPath, generationPlan);
  await writeFile(files.generationReviewPath, generationMarkdown(generationPlan), "utf8");
  await writeJson(files.summaryPath, summary);
  await writeFile(files.summaryReviewPath, workflowMarkdown(summary), "utf8");

  return { summary, request, manifest, suggestionPlan, generationPlan };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }
  if (!options.retryPlan || !options.panelCatalog || !options.outputDir) {
    printHelp();
    throw new Error("--retry-plan, --panel-catalog and --output-dir are required.");
  }

  const retryPlanPath = resolve(options.retryPlan);
  const panelCatalogPath = resolve(options.panelCatalog);
  const retryPlan = JSON.parse(await readFile(retryPlanPath, "utf8"));
  const panelCatalog = JSON.parse(await readFile(panelCatalogPath, "utf8"));
  if (retryPlan.planId !== "comic_post_render_retry_plan_v1") {
    throw new Error(`Unsupported retry plan: ${retryPlan.planId ?? "unknown"}`);
  }

  const result = await buildAssistedPatchWorkflow({
    retryPlan,
    panelCatalog,
    outputDir: options.outputDir,
    retryPlanPath,
    options
  });

  console.log(JSON.stringify({
    status: result.summary.status,
    summaryPath: result.summary.files.summaryPath,
    retrySceneCount: result.summary.retrySceneCount,
    patchSlotCount: result.summary.patchSlotCount,
    suggestedSourceCount: result.summary.suggestedSourceCount,
    readyTaskCount: result.summary.readyTaskCount,
    waitingTaskCount: result.summary.waitingTaskCount,
    renderWholeVideoAgain: result.summary.renderWholeVideoAgain,
    nextAction: result.summary.nextAction
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
