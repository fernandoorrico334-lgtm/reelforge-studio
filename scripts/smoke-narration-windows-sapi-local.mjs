import { access } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { ensureArtifactsExist, printSmokeSummary } from "./lib/smoke-utils.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");
const outputPath = "storage/assets/generated/narrations/smoke-windows-sapi-local.wav";

function log(message) {
  console.log(`[smoke:narration-windows-sapi:local] ${message}`);
}

async function importModule(relativePath) {
  return import(pathToFileURL(join(projectRoot, relativePath)).href);
}

async function main() {
  if (process.platform !== "win32") {
    printSmokeSummary({
      smoke: "narration-windows-sapi:local",
      status: "skipped",
      reason: "windows-only"
    });
    return;
  }

  if (String(process.env.NARRATION_WINDOWS_SAPI_ENABLED ?? "false").trim().toLowerCase() !== "true") {
    printSmokeSummary({
      smoke: "narration-windows-sapi:local",
      status: "skipped",
      reason: "NARRATION_WINDOWS_SAPI_ENABLED=false"
    });
    return;
  }

  await ensureArtifactsExist(
    projectRoot,
    ["packages/narration-engine/dist/index.js"],
    "Run 'npm run build' before running smoke:narration-windows-sapi:local."
  );

  const narrationEngine = await importModule("packages/narration-engine/dist/index.js");
  const providers = narrationEngine.getNarrationProviders({
    windowsSapiEnabled: true
  });
  const windowsProvider = providers.find((provider) => provider.id === "windows-sapi-local");

  if (!windowsProvider?.available || windowsProvider.status !== "ready") {
    printSmokeSummary({
      smoke: "narration-windows-sapi:local",
      status: "skipped",
      reason: windowsProvider?.reason ?? "provider-unavailable"
    });
    return;
  }

  log("Generating local Windows SAPI narration.");
  const result = await narrationEngine.generateWindowsSapiNarrationWav({
    provider: "windows-sapi-local",
    voicePackId: "documentary_ptbr",
    text: "Smoke local narration generated with Windows SAPI.",
    language: "pt-BR",
    outputAbsolutePath: join(projectRoot, outputPath)
  });

  await access(join(projectRoot, outputPath));

  printSmokeSummary({
    smoke: "narration-windows-sapi:local",
    status: "completed",
    outputPath,
    durationSeconds: result.durationSeconds,
    sampleRate: result.sampleRate,
    provider: "windows-sapi-local"
  });
}

main().catch((error) => {
  console.error("[smoke:narration-windows-sapi:local] failed", error);
  process.exitCode = 1;
});
