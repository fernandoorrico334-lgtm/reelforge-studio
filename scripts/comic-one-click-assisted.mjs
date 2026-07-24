import { mkdir, readFile, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { join, resolve, basename } from "node:path";
import { pathToFileURL } from "node:url";

const root = resolve(decodeURIComponent(new URL("..", import.meta.url).pathname).replace(/^\/(.:)/, "$1"));

function parseArgs(argv) {
  const options = {
    mode: "plan",
    episodes: "all",
    maxDurationSeconds: 180,
    targetWordsPerMinute: 160,
    narrationProvider: process.env.COMIC_NARRATION_PROVIDER ?? "voicebox-qwen",
    narrationSessionMode: process.env.COMIC_NARRATION_SESSION_MODE ?? "single",
    approved: false,
    renderPlanOnly: false,
    title: "comic-one-click-assisted",
    bibleConfig: join(root, "scripts/comic-saga-configs/batman-white-knight-narrative-bible.mjs"),
    runtimeConfig: join(root, "scripts/comic-saga-configs/batman-white-knight-series-runtime.mjs"),
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];
    if (arg === "--mode") { options.mode = next ?? options.mode; index += 1; }
    else if (arg === "--episodes") { options.episodes = next ?? options.episodes; index += 1; }
    else if (arg === "--bible-config") { options.bibleConfig = resolve(next ?? options.bibleConfig); index += 1; }
    else if (arg === "--runtime-config") { options.runtimeConfig = resolve(next ?? options.runtimeConfig); index += 1; }
    else if (arg === "--output-dir") { options.outputDir = resolve(next ?? ""); index += 1; }
    else if (arg === "--title") { options.title = next ?? options.title; index += 1; }
    else if (arg === "--max-duration") { options.maxDurationSeconds = Number.parseInt(next ?? "180", 10); index += 1; }
    else if (arg === "--wpm") { options.targetWordsPerMinute = Number.parseInt(next ?? "160", 10); index += 1; }
    else if (arg === "--provider") { options.narrationProvider = next ?? options.narrationProvider; index += 1; }
    else if (arg === "--session-mode") { options.narrationSessionMode = next ?? options.narrationSessionMode; index += 1; }
    else if (arg === "--approved") options.approved = true;
    else if (arg === "--render-plan-only") options.renderPlanOnly = true;
    else if (arg === "--help") options.help = true;
  }
  return options;
}

function printHelp() {
  console.log(`Comic One-Click Assisted V1\n\nUsage:\n  npm run comic:one-click-assisted -- --mode plan\n  npm run comic:one-click-assisted -- --mode render --approved --episodes 1,2\n\nOptions:\n  --mode plan|render          plan creates review artifacts only; render requires --approved\n  --episodes all|1,2,3        selected episodes\n  --bible-config <path>       module exporting narrativeBibleInput and episodeDefinitions\n  --runtime-config <path>     renderer config module\n  --output-dir <path>         output directory for reports/renders\n  --title <text>              run label\n  --max-duration <seconds>    default 180\n  --wpm <number>              default 160\n  --provider <provider>       default voicebox-qwen\n  --session-mode <mode>       single|act|phrase, default single\n  --render-plan-only          pass --plan-only to renderer during render mode\n  --approved                  required for render mode\n`);
}

function slugify(value) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "comic-one-click-assisted";
}

function selectEpisodeIndexes(spec, count) {
  if (spec === "all") return Array.from({ length: count }, (_, index) => index);
  const selected = spec.split(",")
    .map((part) => Number.parseInt(part.trim(), 10))
    .filter((value) => Number.isFinite(value) && value >= 1 && value <= count)
    .map((value) => value - 1);
  return [...new Set(selected)].sort((left, right) => left - right);
}

function renderCommandForEpisode(options, episodeNumber, episodeOutputDir) {
  return {
    command: process.execPath,
    args: [join(root, "scripts/render-comic-complete-saga-v1.mjs"), ...(options.renderPlanOnly ? ["--plan-only"] : [])],
    cwd: root,
    env: {
      COMIC_SAGA_CONFIG: options.runtimeConfig,
      COMIC_SAGA_EPISODE: String(episodeNumber),
      COMIC_NARRATION_PROVIDER: options.narrationProvider,
      COMIC_NARRATION_SESSION_MODE: options.narrationSessionMode,
      COMIC_SAGA_OUTPUT_DIR: episodeOutputDir,
    },
  };
}

function runChild(command, args, options) {
  return new Promise((resolvePromise) => {
    const child = spawn(command, args, options);
    child.on("error", (error) => resolvePromise({ code: 1, error: error.message }));
    child.on("exit", (code) => resolvePromise({ code: code ?? 1 }));
  });
}

function buildReviewMarkdown(report) {
  const lines = [
    `# Comic One-Click Assisted Review`,
    "",
    `- Status: ${report.status}`,
    `- Mode: ${report.mode}`,
    `- Episodes: ${report.selectedEpisodes.length}/${report.episodeCount}`,
    `- Human approval required: ${report.humanApprovalRequired}`,
    `- Narration provider: ${report.narrationProvider}`,
    `- Narration session mode: ${report.narrationSessionMode}`,
    "",
    "## Episodes",
  ];
  for (const episode of report.selectedEpisodes) {
    lines.push("", `### ${episode.episodeNumber}. ${episode.title}`);
    lines.push(`- ID: ${episode.episodeId}`);
    lines.push(`- Status: ${episode.status}`);
    lines.push(`- Estimated duration: ${episode.estimatedDurationSeconds}s`);
    lines.push(`- Issues: ${episode.issueNumbers.join(", ")}`);
    lines.push(`- Events: ${episode.eventCount}`);
    lines.push(`- Critical facts: ${episode.criticalFactCount}`);
    lines.push(`- Gate: ${episode.gateStatus}`);
    if (episode.blockers?.length) lines.push(`- Blockers: ${episode.blockers.join("; ")}`);
    if (episode.renderOutputDir) lines.push(`- Output dir: ${episode.renderOutputDir}`);
  }
  lines.push("", "## Human Review Gate", "");
  lines.push("Approve only after checking: story clarity, page order, panel focus, narration text, pronunciation risks, ComfyUI enrichment candidates, captions, and no repeated visual beats.");
  return `${lines.join("\n")}\n`;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) { printHelp(); return; }
  if (!["plan", "render"].includes(options.mode)) throw new Error("--mode must be plan or render.");
  if (!["single", "act", "phrase"].includes(options.narrationSessionMode)) throw new Error("--session-mode must be single, act, or phrase.");
  if (options.mode === "render" && !options.approved) {
    throw new Error("Render mode is blocked by the Human Review Gate. Re-run with --approved after reviewing the generated plan.");
  }

  const bibleModule = await import(pathToFileURL(resolve(options.bibleConfig)).href);
  const bibleEngine = await import(pathToFileURL(join(root, "packages/media-beast/dist/pipeline/comic-narrative-bible-engine.js")).href);
  const episodePlanner = await import(pathToFileURL(join(root, "packages/media-beast/dist/pipeline/comic-narrative-episode-planner.js")).href);
  const bible = bibleEngine.buildComicNarrativeBible(bibleModule.narrativeBibleInput);
  const plan = episodePlanner.buildComicNarrativeEpisodePlan({
    bible,
    episodes: bibleModule.episodeDefinitions,
    maximumEpisodeDurationSeconds: options.maxDurationSeconds,
    targetWordsPerMinute: options.targetWordsPerMinute,
  });

  const outputDir = options.outputDir
    ?? join(root, "storage/renders/comic-one-click-assisted", `${slugify(options.title)}-${Date.now()}`);
  await mkdir(outputDir, { recursive: true });

  const selectedIndexes = selectEpisodeIndexes(options.episodes, plan.episodeCount);
  if (!selectedIndexes.length) throw new Error(`No valid episodes selected. Use all or values between 1 and ${plan.episodeCount}.`);

  const selectedEpisodes = [];
  let failedRenderCount = 0;
  for (const episodeIndex of selectedIndexes) {
    const episode = plan.episodes[episodeIndex];
    const episodeNumber = episodeIndex + 1;
    const episodeOutputDir = join(outputDir, `episode-${String(episodeNumber).padStart(2, "0")}-${slugify(episode.episodeId)}`);
    const episodeReport = {
      episodeNumber,
      episodeId: episode.episodeId,
      title: episode.title,
      issueNumbers: episode.issueNumbers,
      eventCount: episode.eventIds.length,
      estimatedDurationSeconds: episode.estimatedDurationSeconds,
      criticalFactCount: episode.criticalFactIds.length,
      gateStatus: episode.gate.status,
      blockers: episode.gate.blockers,
      renderOutputDir: options.mode === "render" ? episodeOutputDir : null,
      status: episode.gate.status === "passed" ? "ready_for_review" : "blocked",
    };

    if (options.mode === "render" && episode.gate.status === "passed") {
      await mkdir(episodeOutputDir, { recursive: true });
      const childSpec = renderCommandForEpisode(options, episodeNumber, episodeOutputDir);
      const result = await runChild(childSpec.command, childSpec.args, {
        cwd: childSpec.cwd,
        stdio: "inherit",
        env: { ...process.env, ...childSpec.env },
      });
      episodeReport.renderExitCode = result.code;
      episodeReport.renderError = result.error ?? null;
      episodeReport.status = result.code === 0 ? "render_completed" : "render_failed";
      if (result.code !== 0) failedRenderCount += 1;
    }

    selectedEpisodes.push(episodeReport);
  }

  const report = {
    status: plan.status === "passed" && failedRenderCount === 0 ? (options.mode === "render" ? "completed" : "ready_for_review") : "needs_attention",
    mode: options.mode,
    generatedAt: new Date().toISOString(),
    title: options.title,
    outputDir,
    bibleConfig: resolve(options.bibleConfig),
    runtimeConfig: resolve(options.runtimeConfig),
    bibleStatus: bible.status,
    plannerStatus: plan.status,
    plannerBlockers: plan.blockers,
    episodeCount: plan.episodeCount,
    selectedEpisodeCount: selectedEpisodes.length,
    maxDurationSeconds: options.maxDurationSeconds,
    targetWordsPerMinute: options.targetWordsPerMinute,
    narrationProvider: options.narrationProvider,
    narrationSessionMode: options.narrationSessionMode,
    humanApprovalRequired: options.mode !== "render" || !options.approved,
    selectedEpisodes,
    nextAction: options.mode === "plan"
      ? "Review assisted-review.md, then run with --mode render --approved for selected episodes."
      : failedRenderCount ? "Review failed episode logs and rerun only failed episodes." : "Review rendered MP4s and QA reports.",
  };

  await writeFile(join(outputDir, "assisted-plan.json"), JSON.stringify(report, null, 2), "utf8");
  await writeFile(join(outputDir, "assisted-review.md"), buildReviewMarkdown(report), "utf8");
  console.log(JSON.stringify({
    status: report.status,
    outputDir,
    reviewPath: join(outputDir, "assisted-review.md"),
    planPath: join(outputDir, "assisted-plan.json"),
    selectedEpisodeCount: selectedEpisodes.length,
    mode: options.mode,
    nextAction: report.nextAction,
  }, null, 2));

  if (failedRenderCount > 0 || plan.status !== "passed") process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
