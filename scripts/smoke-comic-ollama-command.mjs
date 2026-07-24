import { readFile, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { runComicOllamaCommand } from "./comic-ollama-command-runner.mjs";

const outputRoot = resolve("tmp/smoke-comic-ollama-command");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function baseOptions(outputDir) {
  return {
    mode: "plan",
    approved: false,
    outputDir,
    model: "mock-qwen",
    baseUrl: "mock",
    timeoutMs: 1000,
    mock: true,
    episode: 1,
    bibleConfig: "scripts/comic-saga-configs/batman-white-knight-narrative-bible.mjs",
    runtimeConfig: "scripts/comic-saga-configs/batman-white-knight-series-runtime.mjs"
  };
}

async function main() {
  await rm(outputRoot, { recursive: true, force: true });

  const planDir = join(outputRoot, "plan");
  const plan = await runComicOllamaCommand({
    ...baseOptions(planDir),
    prompt: "Faca o proximo video da HQ Batman Cavaleiro Branco com suspense premium"
  });
  assert(plan.response.status === "ready", "Plan response should be ready.");
  assert(plan.command.action === "comic_video_plan", "Expected comic_video_plan action.");
  assert(plan.downstreamCommands[0]?.includes("comic:one-click-assisted"), "Expected one-click downstream command.");
  const planResponse = JSON.parse(await readFile(join(planDir, "ollama-command-response.json"), "utf8"));
  assert(planResponse.status === "ready", "Plan response artifact should be ready.");

  const renderDir = join(outputRoot, "render-blocked");
  const blocked = await runComicOllamaCommand({
    ...baseOptions(renderDir),
    prompt: "Renderize agora o MP4 final",
    mode: "render"
  });
  assert(blocked.response.status === "blocked", "Render without --approved must be blocked.");
  assert(blocked.validationErrors.some((error) => error.includes("GATE_FAIL_RENDER_UNAPPROVED")), "Missing approval gate error.");

  const approvedDir = join(outputRoot, "render-approved");
  const approved = await runComicOllamaCommand({
    ...baseOptions(approvedDir),
    prompt: "Renderize agora o MP4 final",
    mode: "render",
    approved: true
  });
  assert(approved.response.status === "ready", "Approved render response should be ready.");
  assert(approved.downstreamCommands[0]?.includes("--approved"), "Approved downstream render command must include --approved.");

  console.log(JSON.stringify({
    status: "completed",
    planAction: plan.command.action,
    blockedGate: "GATE_FAIL_RENDER_UNAPPROVED",
    approvedAction: approved.command.action,
    outputRoot
  }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({ status: "failed", error: error instanceof Error ? error.message : String(error) }, null, 2));
  process.exitCode = 1;
});