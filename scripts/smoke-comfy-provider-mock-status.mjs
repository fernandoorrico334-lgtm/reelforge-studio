import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  apiArtifactPath,
  ensureArtifactsExist,
  printSmokeSummary,
  resolveApiBuildRoot
} from "./lib/smoke-utils.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");

async function importModule(relativePath) {
  return import(pathToFileURL(join(projectRoot, relativePath)).href);
}

async function ensureBuildArtifacts() {
  const apiBuildRoot = await resolveApiBuildRoot(
    projectRoot,
    "Run 'npm run build' before running smoke:comfy-provider:mock-status."
  );
  await ensureArtifactsExist(
    projectRoot,
    [
      apiArtifactPath(
        apiBuildRoot,
        "modules/hybrid-visual/infrastructure/visual-generation-provider-registry.js"
      )
    ],
    "Run 'npm run build' before running smoke:comfy-provider:mock-status."
  );

  return { apiBuildRoot };
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  const { apiBuildRoot } = await ensureBuildArtifacts();
  const registryModule = await importModule(
    apiArtifactPath(
      apiBuildRoot,
      "modules/hybrid-visual/infrastructure/visual-generation-provider-registry.js"
    )
  );

  const appEnv = {
    comfyUiBaseUrl: "http://127.0.0.1:8188",
    comfyUiDefaultWorkflow: "txt2img-basic",
    comfyUiEnabled: false,
    comfyUiTimeoutMs: 300000
  };

  const status = await registryModule.getComfyUiProviderStatus(appEnv);
  const providers = await registryModule.listVisualGenerationProviders(appEnv);
  const mockProvider = providers.find((provider) => provider.id === "mock-svg");
  const comfyProvider = providers.find((provider) => provider.id === "comfyui-local");

  assert(status.reachable === false, "Disabled mock status should not be reachable.");
  assert(mockProvider?.available === true, "mock-svg should remain available.");
  assert(comfyProvider?.configured === false, "Disabled ComfyUI should not be configured.");
  assert(comfyProvider?.available === false, "Disabled ComfyUI should not be available.");

  printSmokeSummary({
    mockProviderAvailable: mockProvider.available,
    comfyProviderConfigured: comfyProvider.configured,
    comfyProviderAvailable: comfyProvider.available,
    comfyMessage: comfyProvider.message,
    finalStatus: "completed"
  });
}

await main();
