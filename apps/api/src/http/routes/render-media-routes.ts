import { createReadStream } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { RenderJobRepository } from "../../modules/render-jobs/application/render-job-repository.js";
import type { RenderStorage } from "../../modules/render-jobs/application/render-storage.js";
import { getRenderJobById } from "../../modules/render-jobs/application/render-job-service.js";
import { NotFoundError } from "../../shared/errors.js";
import {
  corsHeaders,
  handleRouteError,
  sendMethodNotAllowed
} from "../utils/http-utils.js";

interface ByteRange {
  start: number;
  end: number;
}

function parseByteRange(headerValue: string, fileSize: number): ByteRange | null {
  if (!headerValue.startsWith("bytes=")) {
    return null;
  }

  const [rawStart, rawEnd] = headerValue.slice(6).split("-", 2);

  if (!rawStart && !rawEnd) {
    return null;
  }

  if (!rawStart && rawEnd) {
    const suffixLength = Number(rawEnd);

    if (!Number.isFinite(suffixLength) || suffixLength <= 0) {
      return null;
    }

    return {
      start: Math.max(0, fileSize - suffixLength),
      end: fileSize - 1
    };
  }

  const start = Number(rawStart);
  const end = rawEnd ? Number(rawEnd) : fileSize - 1;

  if (
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    start < 0 ||
    end < start ||
    start >= fileSize
  ) {
    return null;
  }

  return {
    start,
    end: Math.min(end, fileSize - 1)
  };
}

function sendInvalidRange(response: ServerResponse, fileSize: number) {
  response.writeHead(416, {
    ...corsHeaders,
    "Content-Range": `bytes */${fileSize}`
  });
  response.end();
}

function parseRenderMediaPath(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);

  if (segments[0] !== "media" || segments[1] !== "renders") {
    return null;
  }

  const renderJobId = decodeURIComponent(segments[2] ?? "");

  if (!renderJobId) {
    return null;
  }

  if (segments.length === 3) {
    return {
      kind: "output" as const,
      renderJobId
    };
  }

  if (segments.length === 4 && segments[3] === "log") {
    return {
      kind: "log" as const,
      renderJobId
    };
  }

  return null;
}

export async function handleRenderMediaRoute(
  request: IncomingMessage,
  response: ServerResponse,
  pathname: string,
  renderJobRepository: RenderJobRepository,
  renderStorage: RenderStorage
): Promise<boolean> {
  const match = parseRenderMediaPath(pathname);

  if (!match) {
    return false;
  }

  try {
    if (request.method !== "GET" && request.method !== "HEAD") {
      sendMethodNotAllowed(response, ["GET", "HEAD"]);
      return true;
    }

    const renderJob = await getRenderJobById(
      renderJobRepository,
      match.renderJobId
    );
    const resolvedMedia =
      match.kind === "log"
        ? await renderStorage.resolveLogMedia(renderJob)
        : await renderStorage.resolveOutputMedia(renderJob);

    if (!resolvedMedia) {
      throw new NotFoundError(
        match.kind === "log"
          ? `Render log is unavailable for job '${match.renderJobId}'.`
          : `Render output is unavailable for job '${match.renderJobId}'.`
      );
    }

    const commonHeaders = {
      ...corsHeaders,
      "Accept-Ranges": resolvedMedia.supportsRange ? "bytes" : "none",
      "Cache-Control": "no-store",
      "Content-Type": resolvedMedia.mimeType
    };

    const rangeHeader = request.headers.range;

    if (resolvedMedia.supportsRange && typeof rangeHeader === "string") {
      const range = parseByteRange(rangeHeader, resolvedMedia.fileSize);

      if (!range) {
        sendInvalidRange(response, resolvedMedia.fileSize);
        return true;
      }

      const contentLength = range.end - range.start + 1;

      response.writeHead(206, {
        ...commonHeaders,
        "Content-Length": contentLength,
        "Content-Range": `bytes ${range.start}-${range.end}/${resolvedMedia.fileSize}`
      });

      if (request.method === "HEAD") {
        response.end();
        return true;
      }

      createReadStream(resolvedMedia.absolutePath, {
        start: range.start,
        end: range.end
      }).pipe(response);
      return true;
    }

    response.writeHead(200, {
      ...commonHeaders,
      "Content-Length": resolvedMedia.fileSize
    });

    if (request.method === "HEAD") {
      response.end();
      return true;
    }

    createReadStream(resolvedMedia.absolutePath).pipe(response);
    return true;
  } catch (error) {
    handleRouteError(response, error);
    return true;
  }
}