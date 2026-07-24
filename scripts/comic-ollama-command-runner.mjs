import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { pathToFileURL } from "node:url";

const ALLOWED_ACTIONS = new Set([
  "comic_video_plan",
  "comic_narration_rewrite",
  "comic_render_approved",
  "comic_patch_cycle",
  "status_only"
]);
const RENDER_ACTIONS = new Set(["comic_render_approved"]);
const MAX_DURATION_SECONDS = 180;

function parseArgs(argv) {
  const options = {
    prompt: "",
    mode: "plan",
    approved: false,
    outputDir: "tmp/comic-ollama-command",
    model: process.env.OLLAMA_MODEL ?? "qwen3.5-27b-local:latest",
    baseUrl: process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434",
    timeoutMs: Number(process.env.OLLAMA_TIMEOUT_MS ?? 600000),
    mock: process.env.REELFORGE_MOCK_OLLAMA === "true",
    episode: Number.parseInt(process.env.COMIC_SAGA_EPISODE ?? "1", 10),
    bibleConfig: "scripts/comic-saga-configs/batman-white-knight-narrative-bible.mjs",
    runtimeConfig: "scripts/comic-saga-configs/batman-white-knight-series-runtime.mjs"
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const next = argv[index + 1];
    if (token === "--prompt") { options.prompt = next ?? ""; index += 1; }
    else if (token === "--mode") { options.mode = next ?? options.mode; index += 1; }
    else if (token === "--approved") options.approved = true;
    else if (token === "--output-dir") { options.outputDir = next ?? options.outputDir; index += 1; }
    else if (token === "--model") { options.model = next ?? options.model; index += 1; }
    else if (token === "--base-url") { options.baseUrl = next ?? options.baseUrl; index += 1; }
    else if (token === "--timeout-ms") { options.timeoutMs = Number(next ?? options.timeoutMs); index += 1; }
    else if (token === "--episode") { options.episode = Number.parseInt(next ?? String(options.episode), 10); index += 1; }
    else if (token === "--bible-config") { options.bibleConfig = next ?? options.bibleConfig; index += 1; }
    else if (token === "--runtime-config") { options.runtimeConfig = next ?? options.runtimeConfig; index += 1; }
    else if (token === "--mock") options.mock = true;
    else if (token === "--help" || token === "-h") options.help = true;
  }

  return options;
}

function printHelp() {
  console.log(`Comic Ollama Command Runner\n\nUsage:\n  npm run comic:ollama-command -- --prompt "FaÃƒÂ§a o prÃƒÂ³ximo video dessa HQ" --mode plan\n  npm run comic:ollama-command -- --prompt "Renderize o plano aprovado" --mode render --approved\n\nSafety:\n  plan/status commands write JSON/MD artifacts only. Render actions require --approved and still emit downstream commands for review.`);
}

function slugify(value) {
  return String(value ?? "comic")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "comic";
}

function requestJson(url, payload, timeoutMs) {
  return new Promise((resolvePromise, rejectPromise) => {
    const target = new URL(url);
    const body = JSON.stringify(payload);
    const transport = target.protocol === "https:" ? httpsRequest : httpRequest;
    const req = transport({
      method: "POST",
      hostname: target.hostname,
      port: target.port,
      path: `${target.pathname}${target.search}`,
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body)
      },
      timeout: timeoutMs
    }, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => {
        const text = Buffer.concat(chunks).toString("utf8");
        if ((res.statusCode ?? 500) >= 400) {
          rejectPromise(new Error(`Ollama failed (${res.statusCode}): ${text.slice(0, 1000)}`));
          return;
        }
        try { resolvePromise(JSON.parse(text)); }
        catch (error) { rejectPromise(new Error(`Ollama returned invalid JSON envelope: ${error instanceof Error ? error.message : String(error)}`)); }
      });
    });
    req.on("timeout", () => req.destroy(new Error(`Ollama request timed out after ${timeoutMs}ms.`)));
    req.on("error", rejectPromise);
    req.write(body);
    req.end();
  });
}

function stripCodeFence(value) {
  return String(value ?? "").replace(/^\s*```(?:json)?/i, "").replace(/```\s*$/i, "").trim();
}

function parseQwenJson(raw) {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    if (raw.action) return raw;
    const content = raw.message?.content || raw.response || raw.thinking || "";
    if (content) return parseQwenJson(content);
  }
  const text = stripCodeFence(raw);
  try { return JSON.parse(text); } catch {}
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first >= 0 && last > first) return JSON.parse(text.slice(first, last + 1));
  throw new Error("Invalid JSON output from Ollama/Qwen.");
}

async function readOptionalJson(path) {
  const fullPath = resolve(path);
  if (!existsSync(fullPath)) return null;
  try { return JSON.parse(await readFile(fullPath, "utf8")); }
  catch { return null; }
}

async function buildLocalContext(options) {
  const bible = await readOptionalJson("tmp/comic-auto-bible/latest.json");
  const lastAssisted = await readOptionalJson("tmp/comic-one-click-assisted/latest/assisted-plan.json");
  return {
    project: "ReelForge Studio",
    workspace: resolve("."),
    currentMode: "comic_one_click_premium",
    defaultEpisode: Number.isFinite(options.episode) ? options.episode : 1,
    maxDurationSeconds: MAX_DURATION_SECONDS,
    defaultNarrationProvider: "voicebox-qwen",
    defaultSessionMode: "single",
    bibleConfig: resolve(options.bibleConfig),
    runtimeConfig: resolve(options.runtimeConfig),
    existingContext: {
      hasAutoBibleLatest: Boolean(bible),
      hasLastAssistedPlan: Boolean(lastAssisted)
    },
    qualityRules: [
      "Tell the story, do not describe comic pages.",
      "Keep visual panel selection aligned with narration.",
      "Never render without manual approval.",
      "Keep videos at or below 180 seconds.",
      "Critical spellings: Batman, Gotham, Jack Napier."
    ],
    allowedActions: [...ALLOWED_ACTIONS]
  };
}

function buildSystemPrompt(context) {
  return [
    "You are the local ReelForge Comic Command Runner.",
    "Convert the user request into one safe JSON command for existing local scripts.",
    "Return JSON only. No markdown. No prose.",
    "Allowed actions: " + [...ALLOWED_ACTIONS].join(", "),
    "If user asks to create or prepare a comic video, use comic_video_plan unless they explicitly ask only narration.",
    "If user asks to rewrite narration, use comic_narration_rewrite.",
    "If user asks to render/export/final MP4, use comic_render_approved and requiresApproval=true.",
    "If user asks to analyze/correct an existing MP4, use comic_patch_cycle.",
    "Never invent files. Use provided defaults if uncertain.",
    "durationLimitSeconds must never exceed " + MAX_DURATION_SECONDS + ".",
    "narrationProvider should default to voicebox-qwen and sessionMode to single.",
    "Schema:",
    JSON.stringify({
      action: "comic_video_plan",
      comicName: "Batman Cavaleiro Branco",
      episode: 1,
      style: "suspense",
      durationLimitSeconds: 180,
      narrationProvider: "voicebox-qwen",
      sessionMode: "single",
      requiresApproval: true,
      reason: "short reason",
      downstream: { script: "comic:one-click-assisted", mode: "plan" }
    }),
    "Local context:",
    JSON.stringify(context)
  ].join("\n");
}

function mockResponseForPrompt(prompt, options) {
  const wantsRender = /render|renderiz|mp4|export|final/i.test(prompt) || options.mode === "render";
  const wantsPatch = /corrig|patch|analis/i.test(prompt);
  const wantsNarration = /narra|roteir/i.test(prompt);
  if (wantsRender) {
    return { action: "comic_render_approved", comicName: "Batman Cavaleiro Branco", episode: options.episode, style: "suspense", durationLimitSeconds: 180, narrationProvider: "voicebox-qwen", sessionMode: "single", requiresApproval: true, reason: "User requested final render.", downstream: { script: "comic:one-click-assisted", mode: "render" } };
  }
  if (wantsPatch) {
    return { action: "comic_patch_cycle", comicName: "current comic", episode: options.episode, style: "premium", durationLimitSeconds: 180, narrationProvider: "voicebox-qwen", sessionMode: "single", requiresApproval: true, reason: "User requested QA patch cycle.", downstream: { script: "comic:god-mode-patch-cycle", mode: "analyze" } };
  }
  if (wantsNarration) {
    return { action: "comic_narration_rewrite", comicName: "current comic", episode: options.episode, style: "suspense", durationLimitSeconds: 180, narrationProvider: "voicebox-qwen", sessionMode: "single", requiresApproval: false, reason: "User requested narration rewrite.", downstream: { script: "comic:ollama-narration-rewrite", mode: "plan" } };
  }
  return { action: "comic_video_plan", comicName: "current comic", episode: options.episode, style: "suspense", durationLimitSeconds: 180, narrationProvider: "voicebox-qwen", sessionMode: "single", requiresApproval: true, reason: "User requested a comic video plan.", downstream: { script: "comic:one-click-assisted", mode: "plan" } };
}

async function callOllamaCommand(options, context) {
  if (options.mock) return mockResponseForPrompt(options.prompt, options);
  const response = await requestJson(`${options.baseUrl.replace(/\/$/, "")}/api/chat`, {
    model: options.model,
    stream: false,
    think: false,
    format: "json",
    messages: [
      { role: "system", content: buildSystemPrompt(context) },
      { role: "user", content: options.prompt }
    ],
    options: { temperature: 0.12, num_predict: 700, num_ctx: 8192 }
  }, options.timeoutMs);
  return parseQwenJson(response);
}

function validateCommand(command, options) {
  const errors = [];
  if (!ALLOWED_ACTIONS.has(command.action)) errors.push(`Action not allowed: ${command.action}`);
  if (!Number.isFinite(Number(command.episode)) || Number(command.episode) < 1) errors.push("episode must be a positive integer.");
  if (Number(command.durationLimitSeconds) > MAX_DURATION_SECONDS) errors.push(`durationLimitSeconds must be <= ${MAX_DURATION_SECONDS}.`);
  if (!command.narrationProvider) command.narrationProvider = "voicebox-qwen";
  if (!command.sessionMode) command.sessionMode = "single";
  if (RENDER_ACTIONS.has(command.action)) command.requiresApproval = true;
  if ((options.mode === "render" || RENDER_ACTIONS.has(command.action)) && !options.approved) {
    errors.push("GATE_FAIL_RENDER_UNAPPROVED: render actions require --approved.");
  }
  return errors;
}

function downstreamCommands(command, options) {
  const episode = Number(command.episode || options.episode || 1);
  const styleSlug = slugify(command.style ?? "suspense");
  const out = resolve(options.outputDir);
  if (command.action === "comic_narration_rewrite") {
    return [`npm run comic:ollama-narration-rewrite -- --episode ${episode} --output-dir "${join(out, "narration")}" --model "${options.model}"`];
  }
  if (command.action === "comic_render_approved") {
    return [`npm run comic:one-click-assisted -- --mode render --approved --episodes ${episode} --output-dir "${join(out, "render", styleSlug)}" --provider "${command.narrationProvider}" --session-mode "${command.sessionMode}"`];
  }
  if (command.action === "comic_patch_cycle") {
    return [`npm run comic:god-mode-patch-cycle -- --input "storage/renders/comic/latest/output.mp4" --scene-plan "tmp/comic-scene-plan.json" --panel-catalog "tmp/comic-panel-catalog.json" --output-dir "${join(out, "patch-cycle")}" --approved-request`];
  }
  if (command.action === "status_only") return [];
  return [`npm run comic:one-click-assisted -- --mode plan --episodes ${episode} --output-dir "${join(out, "plan", styleSlug)}" --provider "${command.narrationProvider}" --session-mode "${command.sessionMode}"`];
}
function planMarkdown({ options, context, command, validationErrors, commands }) {
  const lines = [
    "# Comic Ollama Command Plan",
    "",
    `- Status: ${validationErrors.length ? "blocked" : "ready"}`,
    `- Prompt: ${options.prompt}`,
    `- Action: ${command.action ?? "unknown"}`,
    `- Episode: ${command.episode ?? context.defaultEpisode}`,
    `- Style: ${command.style ?? "suspense"}`,
    `- Duration limit: ${command.durationLimitSeconds ?? MAX_DURATION_SECONDS}s`,
    `- Narration provider: ${command.narrationProvider ?? "voicebox-qwen"}`,
    `- Requires approval: ${command.requiresApproval === true ? "yes" : "no"}`,
    "",
    "## Validation"
  ];
  if (validationErrors.length) validationErrors.forEach((error) => lines.push(`- BLOCKED: ${error}`));
  else lines.push("- Passed local action gates.");
  lines.push("", "## Downstream Commands");
  if (commands.length) commands.forEach((commandLine) => lines.push("```powershell", commandLine, "```"));
  else lines.push("- No downstream command needed.");
  lines.push("", "## Safety", "- Candidate-first/manual approval remains active.", "- This runner does not download media or touch Prisma schema/migrations.", "- Render actions are blocked without --approved.");
  return `${lines.join("\n")}\n`;
}

export async function runComicOllamaCommand(options) {
  if (!options.prompt?.trim()) throw new Error("--prompt is required.");
  if (!["plan", "render", "status"].includes(options.mode)) throw new Error("--mode must be plan, render or status.");

  const outputDir = resolve(options.outputDir);
  await mkdir(outputDir, { recursive: true });
  const context = await buildLocalContext(options);
  const command = await callOllamaCommand(options, context);
  const validationErrors = validateCommand(command, options);
  const commands = validationErrors.length ? [] : downstreamCommands(command, options);

  const request = { prompt: options.prompt, mode: options.mode, approved: options.approved, model: options.model, baseUrl: options.mock ? "mock" : options.baseUrl, context };
  const response = { command, validationErrors, downstreamCommands: commands, status: validationErrors.length ? "blocked" : "ready" };
  await writeFile(join(outputDir, "ollama-command-request.json"), JSON.stringify(request, null, 2), "utf8");
  await writeFile(join(outputDir, "ollama-command-response.json"), JSON.stringify(response, null, 2), "utf8");
  await writeFile(join(outputDir, "ollama-command-plan.md"), planMarkdown({ options, context, command, validationErrors, commands }), "utf8");

  return { options: { ...options, outputDir }, context, command, validationErrors, downstreamCommands: commands, response };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) { printHelp(); return; }
  const result = await runComicOllamaCommand(options);
  console.log(JSON.stringify({ status: result.response.status, action: result.command.action, requiresApproval: result.command.requiresApproval, outputDir: result.options.outputDir, downstreamCommandCount: result.downstreamCommands.length, validationErrors: result.validationErrors }, null, 2));
  if (result.validationErrors.length) process.exitCode = 1;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    console.error(JSON.stringify({ status: "failed", error: error instanceof Error ? error.message : String(error) }, null, 2));
    process.exitCode = 1;
  });
}