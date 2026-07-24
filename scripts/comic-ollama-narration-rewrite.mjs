import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";

function parseArgs(argv) {
  const options = {
    episode: Number.parseInt(process.env.COMIC_SAGA_EPISODE ?? "1", 10),
    bibleConfig: "scripts/comic-saga-configs/batman-white-knight-narrative-bible.mjs",
    model: process.env.OLLAMA_MODEL ?? "qwen3.5-27b-local:latest",
    baseUrl: process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434",
    outputDir: "tmp/comic-ollama-narration",
    timeoutMs: Number(process.env.OLLAMA_TIMEOUT_MS ?? 600000),
    numPredict: Number(process.env.OLLAMA_NUM_PREDICT ?? 1800),
    temperature: Number(process.env.OLLAMA_TEMPERATURE ?? 0.42),
    planOnly: false
  };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const next = argv[index + 1];
    if (token === "--episode") { options.episode = Number.parseInt(next ?? "1", 10); index += 1; }
    else if (token === "--bible-config") { options.bibleConfig = next ?? options.bibleConfig; index += 1; }
    else if (token === "--model") { options.model = next ?? options.model; index += 1; }
    else if (token === "--base-url") { options.baseUrl = next ?? options.baseUrl; index += 1; }
    else if (token === "--output-dir") { options.outputDir = next ?? options.outputDir; index += 1; }
    else if (token === "--timeout-ms") { options.timeoutMs = Number(next ?? options.timeoutMs); index += 1; }
    else if (token === "--num-predict") { options.numPredict = Number(next ?? options.numPredict); index += 1; }
    else if (token === "--temperature") { options.temperature = Number(next ?? options.temperature); index += 1; }
    else if (token === "--plan-only") options.planOnly = true;
    else if (token === "--help" || token === "-h") options.help = true;
  }
  return options;
}

function printHelp() {
  console.log("Usage:\nnode scripts/comic-ollama-narration-rewrite.mjs --episode 1 --output-dir tmp/ollama-test\n\nCreates an Ollama/Qwen narration override JSON. It does not render video.");
}

function stripCodeFence(value) {
  return String(value ?? "").replace(/^\s*```(?:json)?/i, "").replace(/```\s*$/i, "").trim();
}

function safeJsonParse(text) {
  const cleaned = stripCodeFence(text);
  try { return JSON.parse(cleaned); } catch {}
  const first = cleaned.indexOf("{");
  const last = cleaned.lastIndexOf("}");
  if (first >= 0 && last > first) return JSON.parse(cleaned.slice(first, last + 1));
  throw new Error("Ollama did not return valid JSON.");
}

function sanitizeNarrationText(text) {
  return String(text ?? "")
    .replace(/[\u0000-\u001f]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/Betman|Betimen|Betimem|BÃƒÂ©tman/gi, "Batman")
    .replace(/Gotam|GÃƒÂ³tam|gÃƒÂ³tham/gi, "Gotham")
    .replace(/Jake Napier|Jake NÃƒÂ¡pier|Jack NÃƒÂ¡pier/gi, "Jack Napier")
    .trim();
}

function validateOverrides(result, selectedEvents, model) {
  const beats = Array.isArray(result.beats) ? result.beats : [];
  const byId = new Map(beats.map((beat) => [beat.eventId, beat]));
  const normalizedBeats = selectedEvents.map((event) => {
    const override = byId.get(event.eventId) ?? beats.find((beat) => beat.id === event.eventId) ?? {};
    const narrationText = sanitizeNarrationText(override.narrationText ?? event.narrationText);
    if (narrationText.length < 60) throw new Error(`Ollama narration too short for ${event.eventId}.`);
    if (/\b(painel|quadrinho|pagina mostra|na imagem vemos)\b/i.test(narrationText)) {
      throw new Error(`Ollama narration still describes the comic instead of telling the story: ${event.eventId}.`);
    }
    return {
      eventId: event.eventId,
      title: event.title,
      headline: sanitizeNarrationText(override.headline ?? event.title.toUpperCase()),
      narrationText,
      characterIntent: sanitizeNarrationText(override.characterIntent ?? event.motivation),
      hiddenInformation: sanitizeNarrationText(override.hiddenInformation ?? event.facts?.[0]?.statement ?? ""),
      stakes: sanitizeNarrationText(override.stakes ?? event.consequences?.[0] ?? "")
    };
  });
  return {
    provider: "ollama-local",
    model,
    generatedAt: new Date().toISOString(),
    episodeId: result.episodeId,
    episodeHook: sanitizeNarrationText(result.episodeHook),
    episodeContext: sanitizeNarrationText(result.episodeContext),
    episodeHookHeadline: sanitizeNarrationText(result.episodeHookHeadline),
    beats: normalizedBeats,
    notes: Array.isArray(result.notes) ? result.notes.map(sanitizeNarrationText).filter(Boolean) : [],
    safety: { localOnly: true, noExternalApi: true, sourceFactsOnly: true, manualReviewRecommended: true }
  };
}

function buildPrompt({ episode, selectedEvents }) {
  const facts = selectedEvents.map((event, index) => ({
    order: index + 1,
    eventId: event.eventId,
    title: event.title,
    currentNarration: event.narrationText,
    actors: event.actors,
    action: event.action,
    motivation: event.motivation,
    pageNumbers: event.pageNumbers,
    facts: event.facts?.map((fact) => fact.statement) ?? [],
    consequences: event.consequences ?? [],
    visualTargets: event.visualTargets ?? []
  }));
  return [
    "Voce e o roteirista local do ReelForge Studio.",
    "Reescreva a narracao deste episodio de HQ para video vertical premium em PT-BR.",
    "Regras obrigatorias:",
    "- Conte a historia, nao descreva a pagina.",
    "- Nao invente fatos fora dos eventos.",
    "- Explique causa e consequencia para espectador leigo.",
    "- Use suspense, perguntas abertas e payoff.",
    "- Mantenha Batman, Gotham e Jack Napier escritos exatamente assim.",
    "- Evite erros de pronuncia: nao escreva Betman, Gotam ou Jake.",
    "- Cada fala deve ter 1 a 3 frases naturais, cinematograficas e humanas.",
    "- Nao use markdown. Retorne somente JSON valido.",
    "Formato JSON obrigatorio:",
    JSON.stringify({ episodeId: episode.episodeId, episodeHook: "...", episodeContext: "...", episodeHookHeadline: "...", beats: [{ eventId: "...", headline: "...", narrationText: "...", characterIntent: "...", hiddenInformation: "...", stakes: "..." }], notes: [] }, null, 2),
    "Episodio:",
    JSON.stringify({ episode, events: facts }, null, 2)
  ].join("\n");
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
    req.on("timeout", () => {
      req.destroy(new Error(`Ollama request timed out after ${timeoutMs}ms.`));
    });
    req.on("error", rejectPromise);
    req.write(body);
    req.end();
  });
}

async function callOllama(options, prompt) {
  return requestJson(`${options.baseUrl.replace(/\/$/, "")}/api/generate`, {
    model: options.model,
    stream: false,
    think: false,
    format: "json",
    prompt,
    options: {
      temperature: options.temperature,
      num_predict: options.numPredict,
      num_ctx: 32768,
      top_p: 0.9
    }
  }, options.timeoutMs);
}
async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) { printHelp(); return; }
  const biblePath = resolve(options.bibleConfig);
  const bibleModule = await import(pathToFileURL(biblePath).href);
  const episode = bibleModule.episodeDefinitions[options.episode - 1];
  if (!episode) throw new Error(`Episode ${options.episode} not found.`);
  const eventById = new Map(bibleModule.narrativeBibleInput.events.map((event) => [event.eventId, event]));
  const selectedEvents = episode.eventIds.map((eventId) => eventById.get(eventId));
  if (selectedEvents.some((event) => !event)) throw new Error("Episode references unknown events.");

  const outputDir = resolve(options.outputDir);
  await mkdir(outputDir, { recursive: true });
  const prompt = buildPrompt({ episode, selectedEvents });
  const promptPath = join(outputDir, `episode-${String(options.episode).padStart(2, "0")}-ollama-prompt.txt`);
  await writeFile(promptPath, prompt, "utf8");
  if (options.planOnly) {
    console.log(JSON.stringify({ status: "planned", promptPath }, null, 2));
    return;
  }

  const raw = await callOllama(options, prompt);
  const parsed = safeJsonParse(raw.response || raw.thinking || "{}");
  const overrides = validateOverrides(parsed, selectedEvents, options.model);
  const outputPath = join(outputDir, `episode-${String(options.episode).padStart(2, "0")}-ollama-narration-overrides.json`);
  await writeFile(outputPath, JSON.stringify(overrides, null, 2), "utf8");
  await writeFile(join(outputDir, `episode-${String(options.episode).padStart(2, "0")}-ollama-raw.json`), JSON.stringify(raw, null, 2), "utf8");
  console.log(JSON.stringify({ status: "completed", model: options.model, episode: options.episode, outputPath, promptPath, beatCount: overrides.beats.length, totalDurationMs: raw.total_duration ? Math.round(raw.total_duration / 1000000) : null, evalCount: raw.eval_count ?? null }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({ status: "failed", error: error instanceof Error ? error.message : String(error) }, null, 2));
  process.exitCode = 1;
});