import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

function parseArgs(argv) {
  const options = {
    retryPlan: null,
    outputDir: null,
    episode: null,
    title: "comic-rerender-request",
    approved: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const next = argv[index + 1];
    if (token === "--retry-plan") {
      options.retryPlan = next ?? null;
      index += 1;
    } else if (token === "--output-dir") {
      options.outputDir = next ?? null;
      index += 1;
    } else if (token === "--episode") {
      options.episode = Number.parseInt(next ?? "", 10);
      index += 1;
    } else if (token === "--title") {
      options.title = next ?? options.title;
      index += 1;
    } else if (token === "--approved") {
      options.approved = true;
    } else if (token === "--help" || token === "-h") {
      options.help = true;
    }
  }

  return options;
}

function printHelp() {
  console.log(`Usage:
node scripts/comic-rerender-request-from-qa.mjs --retry-plan <comic-post-render-retry-plan.json> --output-dir <dir>

Creates an assisted rerender request from post-render QA.

Options:
  --episode <number>  Episode number, if known.
  --title <text>      Human-readable label.
  --approved          Mark request as approved for a future rerender worker.
`);
}

async function fileExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function actionPriority(action) {
  const weights = {
    swap_panel: 100,
    retarget_crop: 90,
    resync_narration: 85,
    rerender_caption: 70,
    regenerate_narration_take: 65,
    shorten_hold: 45,
    manual_review: 40,
    keep: 0
  };
  return weights[action] ?? 10;
}

function buildPrimaryFix(actions) {
  return [...actions].sort((a, b) => actionPriority(b.action) - actionPriority(a.action))[0] ?? null;
}

export function buildRerenderRequest({ retryPlan, options, retryPlanPath }) {
  const sceneRetries = Array.isArray(retryPlan.sceneRetries) ? retryPlan.sceneRetries : [];
  const items = sceneRetries.map((scene, index) => {
    const primaryFix = buildPrimaryFix(scene.actions ?? []);
    const correctionType =
      primaryFix?.action === "swap_panel"
        ? "panel_swap"
        : primaryFix?.action === "retarget_crop"
          ? "crop_retarget"
          : primaryFix?.action === "resync_narration"
            ? "timing_resync"
            : primaryFix?.action === "rerender_caption"
              ? "caption_rerender"
              : primaryFix?.action === "regenerate_narration_take"
                ? "narration_take"
                : "manual_review";

    return {
      requestItemId: `retry-${String(index + 1).padStart(3, "0")}`,
      sceneId: scene.sceneId,
      order: scene.order,
      episodeNumber: Number.isFinite(options.episode) ? options.episode : null,
      timeRange: scene.timeRange,
      severity: scene.severity,
      correctionType,
      primaryAction: primaryFix?.action ?? "manual_review",
      reason: primaryFix?.reason ?? "manual_review_required",
      suggestedFix: primaryFix?.suggestedFix ?? scene.directorInstruction ?? "Review scene before rerender.",
      allActions: scene.actions ?? [],
      evidenceFrames: scene.evidenceFrames ?? [],
      directorInstruction: scene.directorInstruction,
      safeRerenderScope: "scene_only",
      renderWholeVideoAgain: false,
      requiresHumanApproval: !options.approved,
      status: options.approved ? "approved_for_future_scene_rerender" : "waiting_human_review"
    };
  });

  return {
    requestId: "comic_assisted_rerender_request_v1",
    title: options.title,
    generatedAt: new Date().toISOString(),
    sourceRetryPlanPath: retryPlanPath,
    sourceVideoPath: retryPlan.sourceVideoPath ?? null,
    status: items.length ? (options.approved ? "approved" : "review_required") : "clean",
    recommendedMode: retryPlan.recommendedMode ?? "rerender_marked_scenes_only",
    renderWholeVideoAgain: false,
    retrySceneCount: items.length,
    highSeveritySceneCount: items.filter((item) => item.severity === "high").length,
    items,
    guardrails: [
      "Nao apagar MP4 original.",
      "Nao trocar assets sem aprovacao manual.",
      "Nao voltar paginas quando trocar painel; usar mesma pagina ou pagina posterior.",
      "Refazer somente cenas marcadas quando o render worker suportar patch scene-only.",
      "Se a cena exigir manual_review, bloquear rerender automatico."
    ],
    nextAction: items.length
      ? "Review assisted-rerender-request.md. Depois, quando o worker scene-only estiver ligado, rerenderizar apenas os itens aprovados."
      : "Nenhuma cena marcada para retry."
  };
}

function markdownForRequest(request) {
  const lines = [
    "# Comic Assisted Rerender Request",
    "",
    `- Status: ${request.status}`,
    `- Source video: ${request.sourceVideoPath ?? "n/a"}`,
    `- Retry scenes: ${request.retrySceneCount}`,
    `- High severity: ${request.highSeveritySceneCount}`,
    `- Whole video rerender: ${request.renderWholeVideoAgain ? "yes" : "no"}`,
    "",
    "## Scenes"
  ];

  for (const item of request.items) {
    lines.push("");
    lines.push(`### ${item.order}. ${item.sceneId}`);
    lines.push(`- Status: ${item.status}`);
    lines.push(`- Time: ${item.timeRange?.startTimeSeconds ?? "?"}s -> ${item.timeRange?.endTimeSeconds ?? "?"}s`);
    lines.push(`- Severity: ${item.severity}`);
    lines.push(`- Primary fix: ${item.primaryAction} (${item.correctionType})`);
    lines.push(`- Reason: ${item.reason}`);
    lines.push(`- Suggested fix: ${item.suggestedFix}`);
    lines.push(`- Evidence frames: ${item.evidenceFrames.length}`);
  }

  lines.push("", "## Guardrails");
  for (const guardrail of request.guardrails) lines.push(`- ${guardrail}`);
  lines.push("", `Next action: ${request.nextAction}`);
  return `${lines.join("\n")}\n`;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }
  if (!options.retryPlan || !options.outputDir) {
    printHelp();
    throw new Error("--retry-plan and --output-dir are required.");
  }

  const retryPlanPath = resolve(options.retryPlan);
  if (!(await fileExists(retryPlanPath))) {
    throw new Error(`Retry plan not found: ${retryPlanPath}`);
  }

  const retryPlan = JSON.parse(await readFile(retryPlanPath, "utf8"));
  if (retryPlan.planId !== "comic_post_render_retry_plan_v1") {
    throw new Error(`Unsupported retry plan: ${retryPlan.planId ?? "unknown"}`);
  }

  const outputDir = resolve(options.outputDir);
  await mkdir(outputDir, { recursive: true });
  const request = buildRerenderRequest({ retryPlan, options, retryPlanPath });
  const requestPath = join(outputDir, "assisted-rerender-request.json");
  const reviewPath = join(outputDir, "assisted-rerender-request.md");
  await writeFile(requestPath, JSON.stringify(request, null, 2), "utf8");
  await writeFile(reviewPath, markdownForRequest(request), "utf8");

  console.log(JSON.stringify({
    status: request.status,
    requestPath,
    reviewPath,
    retrySceneCount: request.retrySceneCount,
    highSeveritySceneCount: request.highSeveritySceneCount,
    renderWholeVideoAgain: request.renderWholeVideoAgain,
    nextAction: request.nextAction
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
