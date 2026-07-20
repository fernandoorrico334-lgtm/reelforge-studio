import { access, mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

function log(message, payload = null) {
  if (payload) {
    console.log(`[smoke:narration-f5-tts:local] ${message}`, JSON.stringify(payload, null, 2));
    return;
  }

  console.log(`[smoke:narration-f5-tts:local] ${message}`);
}

async function importModule(relativePath, hint) {
  try {
    return await import(new URL(`../${relativePath}`, import.meta.url));
  } catch (error) {
    throw new Error(`${hint}\n${error instanceof Error ? error.message : String(error)}`);
  }
}

async function assertBuilt() {
  try {
    await access(new URL("../packages/narration-engine/dist/index.js", import.meta.url));
  } catch {
    throw new Error("Run 'npm run build --workspace @reelforge/narration-engine' before smoke:narration-f5-tts:local.");
  }
}

async function main() {
  if (String(process.env.F5_TTS_ENABLED ?? "false").trim().toLowerCase() !== "true") {
    log("skipped", {
      reason: "F5_TTS_ENABLED is not true.",
      requiredEnv: {
        F5_TTS_ENABLED: "true",
        F5_TTS_BASE_URL: "http://127.0.0.1:7860"
      }
    });
    return;
  }

  await assertBuilt();
  const narrationEngine = await importModule(
    "packages/narration-engine/dist/index.js",
    "Run 'npm run build' before running smoke:narration-f5-tts:local."
  );
  const baseUrl = (process.env.F5_TTS_BASE_URL ?? "http://127.0.0.1:7860").replace(/\/+$/, "");
  const providers = narrationEngine.getNarrationProviders({
    f5TtsEnabled: true,
    f5TtsBaseUrl: baseUrl
  });
  const provider = providers.find((entry) => entry.id === "f5-tts-local");

  if (!provider?.enabled) {
    throw new Error("f5-tts-local provider did not report enabled=true.");
  }

  const outputPath = "storage/assets/generated/narrations/smoke-f5-tts-local.wav";
  await mkdir(dirname(outputPath), { recursive: true });
  const audio = await narrationEngine.generateF5TtsNarrationWav({
    provider: "f5-tts-local",
    voicePackId: "story_epic_ptbr",
    language: "pt-BR",
    text: "Quando a Liga percebe o tamanho da ameaça, cada segundo vira uma batalha pela sobrevivência.",
    outputAbsolutePath: outputPath,
    baseUrl,
    timeoutMs: Number(process.env.F5_TTS_TIMEOUT_MS ?? 300000)
  });
  await writeFile(outputPath, audio.wavBuffer);

  log("completed", {
    provider: provider.id,
    baseUrl,
    outputPath,
    durationSeconds: audio.durationSeconds,
    sampleRate: audio.sampleRate,
    channels: audio.channels,
    seed: audio.seed,
    status: "completed"
  });
}

main().catch((error) => {
  console.error("[smoke:narration-f5-tts:local] failed", error);
  process.exitCode = 1;
});
