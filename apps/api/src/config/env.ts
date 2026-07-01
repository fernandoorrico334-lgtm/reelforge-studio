export type DataBackend = "memory" | "prisma";

export interface AppEnv {
  dataBackend: DataBackend;
  comfyUiBaseUrl: string;
  comfyUiDefaultWorkflow: string;
  comfyUiEnabled: boolean;
  comfyUiWorkflowDir: string;
  comfyUiTimeoutMs: number;
  narrationWindowsSapiEnabled: boolean;
  port: number;
}

function parseDataBackend(input: string | undefined): DataBackend {
  const normalized = (input ?? "memory").trim().toLowerCase();

  if (normalized === "memory" || normalized === "prisma") {
    return normalized;
  }

  throw new Error("DATA_BACKEND must be either 'memory' or 'prisma'.");
}

export function loadEnv(): AppEnv {
  const port = Number(process.env.PORT ?? 4000);
  const comfyUiTimeoutMs = Number(process.env.COMFYUI_TIMEOUT_MS ?? 300000);

  if (!Number.isFinite(port) || port <= 0) {
    throw new Error("PORT must be a positive number.");
  }

  if (!Number.isFinite(comfyUiTimeoutMs) || comfyUiTimeoutMs <= 0) {
    throw new Error("COMFYUI_TIMEOUT_MS must be a positive number.");
  }

  return {
    dataBackend: parseDataBackend(process.env.DATA_BACKEND),
    comfyUiBaseUrl: (process.env.COMFYUI_BASE_URL ?? "http://127.0.0.1:8188").trim(),
    comfyUiDefaultWorkflow:
      (process.env.COMFYUI_DEFAULT_WORKFLOW ?? "txt2img-basic").trim() ||
      "txt2img-basic",
    comfyUiEnabled:
      String(process.env.COMFYUI_ENABLED ?? "false").trim().toLowerCase() ===
      "true",
    comfyUiWorkflowDir:
      (process.env.COMFYUI_WORKFLOW_DIR ?? "storage/comfyui/workflows").trim() ||
      "storage/comfyui/workflows",
    comfyUiTimeoutMs,
    narrationWindowsSapiEnabled:
      String(process.env.NARRATION_WINDOWS_SAPI_ENABLED ?? "false")
        .trim()
        .toLowerCase() === "true",
    port
  };
}
