import {
  getGenerationProviders,
  type ComfyWorkflowTemplateOrigin,
  validateComfyWorkflowTemplate
} from "@reelforge/hybrid-visual-engine";
import { isAbsolute, join } from "node:path";
import type { AppEnv } from "../../../config/env.js";
import { projectRoot } from "../../../config/paths.js";
import {
  getComfyStatus,
  probeComfyEndpoint
} from "./comfyui-client.js";

export type ComfyUiProviderState =
  | "disabled"
  | "not_reachable"
  | "reachable"
  | "workflow_invalid"
  | "ready";

export interface ComfyUiProviderStatus {
  enabled: boolean;
  baseUrl: string;
  reachable: boolean;
  message: string;
  workflowTemplate: string;
  configuredWorkflow: string;
  timeoutMs: number;
  info: Record<string, unknown> | null;
  serverInfo: Record<string, unknown> | null;
  queueStatus: Record<string, unknown> | null;
  historyEndpointReachable: boolean;
  promptEndpointReachable: boolean;
  viewEndpointReachable: boolean;
  workflowTemplateExists: boolean;
  workflowTemplateValid: boolean;
  workflowTemplatePath: string | null;
  workflowOrigin: ComfyWorkflowTemplateOrigin | null;
  workflowWarnings: string[];
  placeholdersFound: string[];
  missingPlaceholders: string[];
  state: ComfyUiProviderState;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function resolveComfyWorkflowDirectory(
  workflowDirectory: string | null | undefined
) {
  if (!workflowDirectory?.trim()) {
    return null;
  }

  return isAbsolute(workflowDirectory)
    ? workflowDirectory
    : join(projectRoot, workflowDirectory);
}

function buildComfyMessage(status: {
  enabled: boolean;
  reachable: boolean;
  configuredWorkflow: string;
  workflowTemplateValid: boolean;
  workflowOrigin: ComfyWorkflowTemplateOrigin | null;
  workflowTemplatePath: string | null;
  promptEndpointReachable: boolean;
  historyEndpointReachable: boolean;
  viewEndpointReachable: boolean;
  fallbackMessage: string;
}) {
  if (!status.enabled) {
    return "ComfyUI provider disabled. Enable COMFYUI_ENABLED=true.";
  }

  if (!status.reachable) {
    return status.fallbackMessage;
  }

  if (!status.workflowTemplateValid) {
    return `Workflow '${status.configuredWorkflow}' is invalid or incomplete. Review the template and use storage/comfyui/workflows for overrides.`;
  }

  const failingEndpoints = [
    !status.promptEndpointReachable ? "/prompt" : null,
    !status.historyEndpointReachable ? "/history/:id" : null,
    !status.viewEndpointReachable ? "/view" : null
  ].filter((value): value is string => Boolean(value));

  if (failingEndpoints.length > 0) {
    return `ComfyUI server is reachable, but these endpoints still need attention: ${failingEndpoints.join(", ")}.`;
  }

  return `ComfyUI ready with workflow '${status.configuredWorkflow}' from ${status.workflowOrigin === "storage-custom" ? "storage custom" : "package default"}${status.workflowTemplatePath ? ` (${status.workflowTemplatePath})` : ""}.`;
}

async function collectComfyUiStatus(
  appEnv: Pick<
    AppEnv,
    | "comfyUiBaseUrl"
    | "comfyUiDefaultWorkflow"
    | "comfyUiEnabled"
    | "comfyUiTimeoutMs"
    | "comfyUiWorkflowDir"
  >
) {
  const configuredWorkflow = appEnv.comfyUiDefaultWorkflow;
  const workflowDirectory = resolveComfyWorkflowDirectory(
    appEnv.comfyUiWorkflowDir
  );
  const workflowValidation = await validateComfyWorkflowTemplate(
    configuredWorkflow,
    {
      workflowDirectory
    }
  );

  if (!appEnv.comfyUiEnabled) {
    return {
      enabled: false,
      baseUrl: appEnv.comfyUiBaseUrl,
      reachable: false,
      message: buildComfyMessage({
        enabled: false,
        reachable: false,
        configuredWorkflow,
        workflowTemplateValid: workflowValidation.valid,
        workflowOrigin: workflowValidation.origin,
        workflowTemplatePath: workflowValidation.templatePath,
        promptEndpointReachable: false,
        historyEndpointReachable: false,
        viewEndpointReachable: false,
        fallbackMessage: "ComfyUI provider disabled. Enable COMFYUI_ENABLED=true."
      }),
      workflowTemplate: configuredWorkflow,
      configuredWorkflow,
      timeoutMs: appEnv.comfyUiTimeoutMs,
      info: null,
      serverInfo: null,
      queueStatus: null,
      historyEndpointReachable: false,
      promptEndpointReachable: false,
      viewEndpointReachable: false,
      workflowTemplateExists: Boolean(workflowValidation.templatePath),
      workflowTemplateValid: workflowValidation.valid,
      workflowTemplatePath: workflowValidation.templatePath,
      workflowOrigin: workflowValidation.origin,
      workflowWarnings: workflowValidation.warnings,
      placeholdersFound: workflowValidation.placeholdersFound,
      missingPlaceholders: workflowValidation.missingPlaceholders,
      state: "disabled"
    } satisfies ComfyUiProviderStatus;
  }

  if (!appEnv.comfyUiBaseUrl.trim()) {
    return {
      enabled: true,
      baseUrl: appEnv.comfyUiBaseUrl,
      reachable: false,
      message: "COMFYUI_BASE_URL is empty. Configure the local server URL before testing the provider.",
      workflowTemplate: configuredWorkflow,
      configuredWorkflow,
      timeoutMs: appEnv.comfyUiTimeoutMs,
      info: null,
      serverInfo: null,
      queueStatus: null,
      historyEndpointReachable: false,
      promptEndpointReachable: false,
      viewEndpointReachable: false,
      workflowTemplateExists: Boolean(workflowValidation.templatePath),
      workflowTemplateValid: workflowValidation.valid,
      workflowTemplatePath: workflowValidation.templatePath,
      workflowOrigin: workflowValidation.origin,
      workflowWarnings: workflowValidation.warnings,
      placeholdersFound: workflowValidation.placeholdersFound,
      missingPlaceholders: workflowValidation.missingPlaceholders,
      state: workflowValidation.valid ? "not_reachable" : "workflow_invalid"
    } satisfies ComfyUiProviderStatus;
  }

  const statusProbe = await getComfyStatus(
    appEnv.comfyUiBaseUrl,
    appEnv.comfyUiTimeoutMs
  );

  if (!statusProbe.reachable) {
    return {
      enabled: true,
      baseUrl: appEnv.comfyUiBaseUrl,
      reachable: false,
      message: buildComfyMessage({
        enabled: true,
        reachable: false,
        configuredWorkflow,
        workflowTemplateValid: workflowValidation.valid,
        workflowOrigin: workflowValidation.origin,
        workflowTemplatePath: workflowValidation.templatePath,
        promptEndpointReachable: false,
        historyEndpointReachable: false,
        viewEndpointReachable: false,
        fallbackMessage: statusProbe.message
      }),
      workflowTemplate: configuredWorkflow,
      configuredWorkflow,
      timeoutMs: appEnv.comfyUiTimeoutMs,
      info: statusProbe.info,
      serverInfo: statusProbe.serverInfo,
      queueStatus: null,
      historyEndpointReachable: false,
      promptEndpointReachable: false,
      viewEndpointReachable: false,
      workflowTemplateExists: Boolean(workflowValidation.templatePath),
      workflowTemplateValid: workflowValidation.valid,
      workflowTemplatePath: workflowValidation.templatePath,
      workflowOrigin: workflowValidation.origin,
      workflowWarnings: workflowValidation.warnings,
      placeholdersFound: workflowValidation.placeholdersFound,
      missingPlaceholders: workflowValidation.missingPlaceholders,
      state: workflowValidation.valid ? "not_reachable" : "workflow_invalid"
    } satisfies ComfyUiProviderStatus;
  }

  const [queueProbe, promptProbe, historyProbe, viewProbe] = await Promise.all([
    probeComfyEndpoint(appEnv.comfyUiBaseUrl, "/queue", {}, appEnv.comfyUiTimeoutMs),
    probeComfyEndpoint(
      appEnv.comfyUiBaseUrl,
      "/prompt",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({})
      },
      appEnv.comfyUiTimeoutMs
    ),
    probeComfyEndpoint(
      appEnv.comfyUiBaseUrl,
      "/history/reelforge-diagnostic",
      {},
      appEnv.comfyUiTimeoutMs
    ),
    probeComfyEndpoint(
      appEnv.comfyUiBaseUrl,
      "/view",
      {
        search: new URLSearchParams({
          filename: "reelforge-diagnostic.png",
          type: "output"
        })
      },
      appEnv.comfyUiTimeoutMs
    )
  ]);

  const promptEndpointReachable = promptProbe.reachable;
  const historyEndpointReachable = historyProbe.reachable;
  const viewEndpointReachable = viewProbe.reachable;
  const state: ComfyUiProviderState = !workflowValidation.valid
    ? "workflow_invalid"
    : promptEndpointReachable && historyEndpointReachable && viewEndpointReachable
      ? "ready"
      : "reachable";

  return {
    enabled: true,
    baseUrl: appEnv.comfyUiBaseUrl,
    reachable: true,
    message: buildComfyMessage({
      enabled: true,
      reachable: true,
      configuredWorkflow,
      workflowTemplateValid: workflowValidation.valid,
      workflowOrigin: workflowValidation.origin,
      workflowTemplatePath: workflowValidation.templatePath,
      promptEndpointReachable,
      historyEndpointReachable,
      viewEndpointReachable,
      fallbackMessage: statusProbe.message
    }),
    workflowTemplate: configuredWorkflow,
    configuredWorkflow,
    timeoutMs: appEnv.comfyUiTimeoutMs,
    info: statusProbe.info,
    serverInfo: statusProbe.serverInfo,
    queueStatus:
      queueProbe.ok && isRecord(queueProbe.payload)
        ? queueProbe.payload
        : null,
    historyEndpointReachable,
    promptEndpointReachable,
    viewEndpointReachable,
    workflowTemplateExists: Boolean(workflowValidation.templatePath),
    workflowTemplateValid: workflowValidation.valid,
    workflowTemplatePath: workflowValidation.templatePath,
    workflowOrigin: workflowValidation.origin,
    workflowWarnings: workflowValidation.warnings,
    placeholdersFound: workflowValidation.placeholdersFound,
    missingPlaceholders: workflowValidation.missingPlaceholders,
    state
  } satisfies ComfyUiProviderStatus;
}

export async function getComfyUiProviderStatus(
  appEnv: Pick<
    AppEnv,
    | "comfyUiBaseUrl"
    | "comfyUiDefaultWorkflow"
    | "comfyUiEnabled"
    | "comfyUiTimeoutMs"
    | "comfyUiWorkflowDir"
  >
) {
  return collectComfyUiStatus(appEnv);
}

export async function listVisualGenerationProviders(
  appEnv: Pick<
    AppEnv,
    | "comfyUiBaseUrl"
    | "comfyUiDefaultWorkflow"
    | "comfyUiEnabled"
    | "comfyUiTimeoutMs"
    | "comfyUiWorkflowDir"
  >
) {
  const comfyStatus = await getComfyUiProviderStatus(appEnv);

  return getGenerationProviders()
    .filter((provider) => provider.id !== "other")
    .map((provider) => {
      if (provider.id === "comfyui-local") {
        return {
          ...provider,
          configured: comfyStatus.enabled,
          available: comfyStatus.state === "ready",
          message: comfyStatus.message,
          requiresLocalServer: true,
          baseUrl: comfyStatus.baseUrl
        };
      }

      if (provider.id === "stable-diffusion-local") {
        return {
          ...provider,
          configured: false,
          available: false,
          message:
            "Stub provider. Keep using mock-svg or comfyui-local for now.",
          requiresLocalServer: true,
          baseUrl: null
        };
      }

      return provider;
    });
}