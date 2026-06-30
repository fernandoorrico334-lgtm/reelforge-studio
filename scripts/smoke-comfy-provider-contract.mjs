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
    "Run 'npm run build' before running smoke:comfy-provider:contract."
  );
  const apiArtifacts = [
    "config/env.js",
    "modules/hybrid-visual/infrastructure/visual-generation-provider-registry.js"
  ].map((relativePath) => apiArtifactPath(apiBuildRoot, relativePath));

  await ensureArtifactsExist(
    projectRoot,
    ["packages/hybrid-visual-engine/dist/index.js", ...apiArtifacts],
    "Run 'npm run build' before running smoke:comfy-provider:contract."
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
  const [{ loadEnv }, hybridVisualModule, registryModule] = await Promise.all([
    importModule(apiArtifactPath(apiBuildRoot, "config/env.js")),
    importModule("packages/hybrid-visual-engine/dist/index.js"),
    importModule(
      apiArtifactPath(
        apiBuildRoot,
        "modules/hybrid-visual/infrastructure/visual-generation-provider-registry.js"
      )
    )
  ]);

  const originalEnv = {
    COMFYUI_BASE_URL: process.env.COMFYUI_BASE_URL,
    COMFYUI_ENABLED: process.env.COMFYUI_ENABLED,
    COMFYUI_DEFAULT_WORKFLOW: process.env.COMFYUI_DEFAULT_WORKFLOW,
    COMFYUI_WORKFLOW_DIR: process.env.COMFYUI_WORKFLOW_DIR,
    COMFYUI_TIMEOUT_MS: process.env.COMFYUI_TIMEOUT_MS
  };

  try {
    process.env.COMFYUI_BASE_URL = "http://127.0.0.1:8188";
    process.env.COMFYUI_ENABLED = "false";
    process.env.COMFYUI_DEFAULT_WORKFLOW = "txt2img-basic";
    process.env.COMFYUI_WORKFLOW_DIR = "storage/comfyui/workflows";
    process.env.COMFYUI_TIMEOUT_MS = "45000";

    const appEnv = loadEnv();

    assert(appEnv.comfyUiEnabled === false, "COMFYUI_ENABLED=false was not parsed.");
    assert(
      appEnv.comfyUiDefaultWorkflow === "txt2img-basic",
      "COMFYUI_DEFAULT_WORKFLOW was not parsed."
    );
    assert(appEnv.comfyUiTimeoutMs === 45000, "COMFYUI_TIMEOUT_MS was not parsed.");
    assert(
      appEnv.comfyUiWorkflowDir === "storage/comfyui/workflows",
      "COMFYUI_WORKFLOW_DIR was not parsed."
    );

    const txt2imgWorkflow =
      await hybridVisualModule.buildComfyWorkflowFromTemplate(
        "txt2img-basic",
        {
          prompt: "cinematic archive control room",
          negativePrompt: "watermark, logo",
          width: 720,
          height: 1280,
          seed: 77
        }
      );
    const img2imgWorkflow =
      await hybridVisualModule.buildComfyWorkflowFromTemplate(
        "img2img-reference-basic",
        {
          prompt: "editorial portrait under teal fog",
          negativePrompt: "extra fingers",
          width: 960,
          height: 1440,
          seed: 99,
          referenceImage: "reference-upload.png",
          denoise: 0.42
        }
      );

    assert(
      txt2imgWorkflow["6"]?.inputs?.text === "cinematic archive control room",
      "txt2img prompt token was not substituted."
    );
    assert(
      txt2imgWorkflow["5"]?.inputs?.width === 720 &&
        txt2imgWorkflow["5"]?.inputs?.height === 1280,
      "txt2img dimensions were not substituted."
    );
    assert(
      img2imgWorkflow["8"]?.inputs?.image === "reference-upload.png",
      "img2img reference image token was not substituted."
    );
    assert(
      img2imgWorkflow["3"]?.inputs?.denoise === 0.42,
      "img2img denoise token was not substituted."
    );
    const workflowValidation =
      await hybridVisualModule.validateComfyWorkflowTemplate("txt2img-basic");
    assert(workflowValidation.valid, "Default txt2img workflow should validate.");

    const comfyStatus = await registryModule.getComfyUiProviderStatus(appEnv);
    const providers = await registryModule.listVisualGenerationProviders(appEnv);
    const comfyProvider = providers.find((provider) => provider.id === "comfyui-local");

    assert(comfyStatus.enabled === false, "Disabled status should report enabled=false.");
    assert(
      comfyStatus.message.includes("COMFYUI_ENABLED=true"),
      "Disabled status should explain how to enable the provider."
    );
    assert(
      comfyStatus.workflowTemplateValid === true,
      "Disabled status should still validate the configured workflow."
    );
    assert(comfyProvider, "Provider registry did not include comfyui-local.");
    assert(
      comfyProvider.available === false,
      "Disabled ComfyUI should appear as unavailable."
    );

    printSmokeSummary({
      comfyUiEnabled: appEnv.comfyUiEnabled,
      comfyUiBaseUrl: appEnv.comfyUiBaseUrl,
      workflowTemplate: appEnv.comfyUiDefaultWorkflow,
      workflowState: comfyStatus.state,
      providerCount: providers.length,
      comfyProviderAvailable: comfyProvider.available,
      finalStatus: "completed"
    });
  } finally {
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

await main();

