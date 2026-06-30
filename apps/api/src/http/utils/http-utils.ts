import type { IncomingMessage, ServerResponse } from "node:http";
import { Readable } from "node:stream";
import {
  NotFoundError,
  PayloadTooLargeError,
  ValidationError
} from "../../shared/errors.js";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Range",
  "Access-Control-Expose-Headers": "Content-Length, Content-Range, Accept-Ranges",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS"
} as const;

export function sendJson(
  response: ServerResponse,
  statusCode: number,
  body: unknown
) {
  response.writeHead(statusCode, {
    ...corsHeaders,
    "Content-Type": "application/json; charset=utf-8"
  });
  response.end(JSON.stringify(body, null, 2));
}

export function sendNoContent(
  response: ServerResponse,
  statusCode = 204
) {
  response.writeHead(statusCode, corsHeaders);
  response.end();
}

export function sendMethodNotAllowed(
  response: ServerResponse,
  allowedMethods: string[]
) {
  response.writeHead(405, {
    ...corsHeaders,
    Allow: allowedMethods.join(", "),
    "Content-Type": "application/json; charset=utf-8"
  });
  response.end(
    JSON.stringify(
      {
        error: "Method not allowed",
        allowedMethods
      },
      null,
      2
    )
  );
}

export async function readJsonBody<T>(request: IncomingMessage): Promise<T> {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (chunks.length === 0) {
    return {} as T;
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as T;
  } catch {
    throw new ValidationError("Invalid JSON body.");
  }
}

function toHeadersInit(request: IncomingMessage): Headers {
  const headers = new Headers();

  for (const [key, value] of Object.entries(request.headers)) {
    if (Array.isArray(value)) {
      headers.set(key, value.join(", "));
      continue;
    }

    if (typeof value === "string") {
      headers.set(key, value);
    }
  }

  return headers;
}

export async function readMultipartFormData(
  request: IncomingMessage,
  targetUrl: string,
  maxContentLengthBytes: number
): Promise<FormData> {
  const contentType = request.headers["content-type"] ?? "";

  if (!contentType.toLowerCase().includes("multipart/form-data")) {
    throw new ValidationError(
      "Expected a multipart/form-data request body."
    );
  }

  const contentLengthHeader = request.headers["content-length"];
  const contentLength = Number(contentLengthHeader ?? 0);

  if (Number.isFinite(contentLength) && contentLength > maxContentLengthBytes) {
    throw new PayloadTooLargeError(
      `Request body exceeds the ${maxContentLengthBytes} byte limit.`
    );
  }

  try {
    const webRequest = new Request(targetUrl, {
      method: request.method,
      headers: toHeadersInit(request),
      body: Readable.toWeb(request),
      duplex: "half"
    } as RequestInit & {
      duplex: "half";
    });

    return await webRequest.formData();
  } catch (error) {
    if (error instanceof PayloadTooLargeError) {
      throw error;
    }

    throw new ValidationError("Invalid multipart/form-data body.");
  }
}

export function parseRouteId(
  pathname: string,
  collectionPath: string
): string | null {
  if (!pathname.startsWith(`${collectionPath}/`)) {
    return null;
  }

  const suffix = pathname.slice(collectionPath.length + 1);

  if (!suffix || suffix.includes("/")) {
    return null;
  }

  return decodeURIComponent(suffix);
}

export function handleRouteError(
  response: ServerResponse,
  error: unknown
) {
  if (error instanceof ValidationError) {
    sendJson(response, 400, { error: error.message });
    return;
  }

  if (error instanceof PayloadTooLargeError) {
    sendJson(response, 413, { error: error.message });
    return;
  }

  if (error instanceof NotFoundError) {
    sendJson(response, 404, { error: error.message });
    return;
  }

  console.error("Unhandled route error:", error);
  sendJson(response, 500, {
    error: "Internal server error"
  });
}

