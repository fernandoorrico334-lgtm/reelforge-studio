import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname } from "node:path";

export interface ComfyUiStatusPayload {
  reachable: boolean;
  message: string;
  info: Record<string, unknown> | null;
  serverInfo: Record<string, unknown> | null;
}

export interface ComfyUiEndpointProbeResult {
  reachable: boolean;
  ok: boolean;
  statusCode: number | null;
  message: string;
  payload: unknown;
}

export interface ComfyUiPromptQueueResult {
  promptId: string;
  number: number | null;
  nodeErrors: unknown;
}

export interface ComfyUiOutputImage {
  filename: string;
  subfolder: string | null;
  type: string | null;
}

export interface ComfyUiPromptCompletionResult {
  promptId: string;
  image: ComfyUiOutputImage;
  images: ComfyUiOutputImage[];
  history: Record<string, unknown>;
}

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.trim().replace(/\/+$/, "");
}

function buildUrl(baseUrl: string, pathname: string, search?: URLSearchParams) {
  const url = new URL(`${normalizeBaseUrl(baseUrl)}${pathname}`);

  if (search) {
    url.search = search.toString();
  }

  return url;
}

async function fetchWithTimeout(
  url: URL,
  init: RequestInit,
  timeoutMs: number
) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timer);
  }
}

async function parseJsonResponse<T>(response: Response) {
  if (!response.ok) {
    const bodyText = await response.text().catch(() => "");
    throw new Error(
      `ComfyUI request failed with status ${response.status}${bodyText.trim() ? `: ${bodyText.trim()}` : "."}`
    );
  }

  return (await response.json()) as T;
}

async function parseProbePayload(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    try {
      return await response.json();
    } catch {
      return null;
    }
  }

  const bodyText = await response.text().catch(() => "");

  if (!bodyText.trim()) {
    return null;
  }

  try {
    return JSON.parse(bodyText) as unknown;
  } catch {
    return bodyText.trim();
  }
}

function trimProbeDetails(payload: unknown) {
  if (typeof payload === "string") {
    return payload.length > 220 ? `${payload.slice(0, 217)}...` : payload;
  }

  if (payload && typeof payload === "object") {
    const serialized = JSON.stringify(payload);
    return serialized.length > 220
      ? `${serialized.slice(0, 217)}...`
      : serialized;
  }

  return null;
}

function getHistoryEntry(
  promptId: string,
  payload: unknown
): Record<string, unknown> | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  if (promptId in (payload as Record<string, unknown>)) {
    const entry = (payload as Record<string, unknown>)[promptId];
    return entry && typeof entry === "object"
      ? (entry as Record<string, unknown>)
      : null;
  }

  return payload as Record<string, unknown>;
}

function collectOutputImages(entry: Record<string, unknown>) {
  const outputs = entry.outputs;

  if (!outputs || typeof outputs !== "object") {
    return [];
  }

  const images: ComfyUiOutputImage[] = [];

  for (const nodeOutput of Object.values(outputs as Record<string, unknown>)) {
    if (!nodeOutput || typeof nodeOutput !== "object") {
      continue;
    }

    const nodeImages = (nodeOutput as Record<string, unknown>).images;

    if (!Array.isArray(nodeImages)) {
      continue;
    }

    for (const image of nodeImages) {
      if (!image || typeof image !== "object") {
        continue;
      }

      const candidate = image as Record<string, unknown>;
      const filename =
        typeof candidate.filename === "string" ? candidate.filename.trim() : "";

      if (!filename) {
        continue;
      }

      images.push({
        filename,
        subfolder:
          typeof candidate.subfolder === "string" && candidate.subfolder.trim()
            ? candidate.subfolder.trim()
            : null,
        type:
          typeof candidate.type === "string" && candidate.type.trim()
            ? candidate.type.trim()
            : null
      });
    }
  }

  return images;
}

function extractHistoryErrorMessage(entry: Record<string, unknown>) {
  const status = entry.status;

  if (!status || typeof status !== "object") {
    return null;
  }

  const messages = (status as Record<string, unknown>).messages;

  if (!Array.isArray(messages)) {
    return null;
  }

  for (const item of [...messages].reverse()) {
    if (!Array.isArray(item) || item.length < 2) {
      continue;
    }

    const [eventName, payload] = item;

    if (eventName !== "execution_error" || !payload || typeof payload !== "object") {
      continue;
    }

    const record = payload as Record<string, unknown>;
    const exceptionMessage =
      typeof record.exception_message === "string"
        ? record.exception_message.trim()
        : "";
    const nodeType =
      typeof record.node_type === "string" ? record.node_type.trim() : "";
    const nodeId = typeof record.node_id === "string" ? record.node_id.trim() : "";

    if (exceptionMessage) {
      const location =
        nodeType || nodeId
          ? ` at ${nodeType || "node"}${nodeId ? ` (${nodeId})` : ""}`
          : "";
      return `ComfyUI execution error${location}: ${exceptionMessage}`;
    }
  }

  return null;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function buildComfyErrorMessage(error: unknown, baseUrl?: string) {
  if (error instanceof Error) {
    const message = error.message.trim();
    const normalized = message.toLowerCase();

    if (error.name === "AbortError") {
      return `ComfyUI at ${baseUrl ?? "the configured base URL"} timed out before finishing the request.`;
    }

    if (
      /fetch failed/i.test(message) ||
      /econnrefused/i.test(message) ||
      /not reachable/i.test(normalized)
    ) {
      return `ComfyUI at ${baseUrl ?? "the configured base URL"} is not reachable. Start the local server and confirm COMFYUI_BASE_URL.`;
    }

    if (
      /missing node/i.test(normalized) ||
      /unknown node/i.test(normalized) ||
      /custom node/i.test(normalized) ||
      /node_errors/i.test(normalized)
    ) {
      return "ComfyUI workflow is incompatible with the current local server. Check missing custom nodes or switch to a custom workflow in storage/comfyui/workflows.";
    }

    if (
      /checkpoint/i.test(normalized) ||
      /ckpt_name/i.test(normalized) ||
      /safetensors/i.test(normalized)
    ) {
      return "ComfyUI workflow could not load the configured checkpoint/model. Review the workflow or create a custom JSON in storage/comfyui/workflows.";
    }

    if (/did not complete within/i.test(normalized) || /timed out/i.test(normalized)) {
      return "ComfyUI local generation timed out. Confirm the workflow, model load time and COMFYUI_TIMEOUT_MS.";
    }

    if (message) {
      return message;
    }
  }

  return "ComfyUI request failed with an unknown local error.";
}

export async function probeComfyEndpoint(
  baseUrl: string,
  pathname: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    search?: URLSearchParams;
  } = {},
  timeoutMs: number
) {
  const url = buildUrl(baseUrl, pathname, options.search);

  try {
    const requestInit: RequestInit = {
      method: options.method ?? "GET"
    };

    if (options.headers) {
      requestInit.headers = options.headers;
    }

    if (options.body !== undefined) {
      requestInit.body = options.body;
    }

    const response = await fetchWithTimeout(
      url,
      requestInit,
      timeoutMs
    );
    const payload = await parseProbePayload(response);
    const details = trimProbeDetails(payload);

    return {
      reachable: true,
      ok: response.ok,
      statusCode: response.status,
      message: response.ok
        ? `Endpoint ${pathname} respondeu com ${response.status}.`
        : `Endpoint ${pathname} respondeu com ${response.status}${details ? `: ${details}` : "."}`,
      payload
    } satisfies ComfyUiEndpointProbeResult;
  } catch (error) {
    return {
      reachable: false,
      ok: false,
      statusCode: null,
      message: buildComfyErrorMessage(error, baseUrl),
      payload: null
    } satisfies ComfyUiEndpointProbeResult;
  }
}

export async function getComfyStatus(baseUrl: string, timeoutMs: number) {
  const probe = await probeComfyEndpoint(baseUrl, "/system_stats", {}, timeoutMs);
  const serverInfo =
    probe.ok && probe.payload && typeof probe.payload === "object"
      ? (probe.payload as Record<string, unknown>)
      : null;

  return {
    reachable: probe.ok,
    message: probe.ok ? "ComfyUI local server reachable." : probe.message,
    info: serverInfo,
    serverInfo
  } satisfies ComfyUiStatusPayload;
}

export async function queuePrompt(
  baseUrl: string,
  workflow: Record<string, unknown>,
  clientId: string,
  timeoutMs: number
) {
  const url = buildUrl(baseUrl, "/prompt");
  const payload = await parseJsonResponse<Record<string, unknown>>(
    await fetchWithTimeout(
      url,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          prompt: workflow,
          client_id: clientId
        })
      },
      timeoutMs
    )
  );
  const promptId =
    typeof payload.prompt_id === "string" && payload.prompt_id.trim()
      ? payload.prompt_id.trim()
      : null;

  if (!promptId) {
    throw new Error("ComfyUI queue response did not include a prompt_id.");
  }

  return {
    promptId,
    number: typeof payload.number === "number" ? payload.number : null,
    nodeErrors: payload.node_errors ?? null
  } satisfies ComfyUiPromptQueueResult;
}

export async function getPromptHistory(
  baseUrl: string,
  promptId: string,
  timeoutMs: number
) {
  const url = buildUrl(baseUrl, `/history/${encodeURIComponent(promptId)}`);
  return parseJsonResponse<Record<string, unknown>>(
    await fetchWithTimeout(url, { method: "GET" }, timeoutMs)
  );
}

export async function waitForPromptCompletion(
  baseUrl: string,
  promptId: string,
  options: {
    timeoutMs: number;
    pollIntervalMs?: number;
  }
) {
  const startedAt = Date.now();
  const pollIntervalMs = options.pollIntervalMs ?? 1_500;

  while (Date.now() - startedAt < options.timeoutMs) {
    const history = await getPromptHistory(baseUrl, promptId, options.timeoutMs);
    const entry = getHistoryEntry(promptId, history);

    if (entry) {
      const status = entry.status;
      const statusText =
        status && typeof status === "object"
          ? (status as Record<string, unknown>).status_str
          : null;

      if (typeof statusText === "string" && statusText.toLowerCase() === "error") {
        const historyErrorMessage = extractHistoryErrorMessage(entry);
        throw new Error(
          historyErrorMessage ??
            `ComfyUI prompt ${promptId} failed according to history status.`
        );
      }

      const images = collectOutputImages(entry);

      if (images.length > 0) {
        return {
          promptId,
          image: images[0]!,
          images,
          history: entry
        } satisfies ComfyUiPromptCompletionResult;
      }
    }

    await sleep(pollIntervalMs);
  }

  throw new Error(
    `ComfyUI prompt ${promptId} did not complete within ${options.timeoutMs}ms.`
  );
}

export async function downloadComfyOutput(
  baseUrl: string,
  outputInfo: ComfyUiOutputImage,
  destinationPath: string,
  timeoutMs: number
) {
  const search = new URLSearchParams({
    filename: outputInfo.filename
  });

  if (outputInfo.subfolder) {
    search.set("subfolder", outputInfo.subfolder);
  }

  if (outputInfo.type) {
    search.set("type", outputInfo.type);
  }

  const url = buildUrl(baseUrl, "/view", search);
  const response = await fetchWithTimeout(url, { method: "GET" }, timeoutMs);

  if (!response.ok) {
    throw new Error(
      `ComfyUI output download failed with status ${response.status}.`
    );
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  await mkdir(dirname(destinationPath), { recursive: true });
  await writeFile(destinationPath, buffer);

  return {
    destinationPath,
    filename: basename(destinationPath),
    size: buffer.byteLength
  };
}

export async function uploadReferenceImage(
  baseUrl: string,
  filePath: string,
  timeoutMs: number
) {
  const binary = await readFile(filePath);
  const form = new FormData();
  form.append("image", new Blob([binary]), basename(filePath));
  form.append("overwrite", "true");

  const url = buildUrl(baseUrl, "/upload/image");
  return parseJsonResponse<Record<string, unknown>>(
    await fetchWithTimeout(
      url,
      {
        method: "POST",
        body: form
      },
      timeoutMs
    )
  );
}
