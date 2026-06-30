import { createReadStream } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { IntakeRepository } from "../../modules/intake/application/intake-repository.js";
import { getIntakeCandidateById } from "../../modules/intake/application/intake-service.js";
import { resolveCandidatePreview } from "../../modules/intake/infrastructure/intake-filesystem.js";
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

function parseCandidatePreviewId(pathname: string) {
  const match = pathname.match(/^\/media\/candidates\/([^/]+)\/preview$/);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

export async function handleCandidateMediaRoute(
  request: IncomingMessage,
  response: ServerResponse,
  pathname: string,
  repository: IntakeRepository
): Promise<boolean> {
  const candidateId = parseCandidatePreviewId(pathname);

  if (!candidateId) {
    return false;
  }

  try {
    if (request.method !== "GET" && request.method !== "HEAD") {
      sendMethodNotAllowed(response, ["GET", "HEAD"]);
      return true;
    }

    const candidate = await getIntakeCandidateById(repository, candidateId);
    const preview = await resolveCandidatePreview(candidate);

    if (!preview) {
      throw new NotFoundError(
        `Preview is unavailable for intake candidate '${candidateId}'.`
      );
    }

    const commonHeaders = {
      ...corsHeaders,
      "Accept-Ranges": preview.supportsRange ? "bytes" : "none",
      "Cache-Control": "no-store",
      "Content-Type": preview.mimeType
    };

    const rangeHeader = request.headers.range;

    if (preview.supportsRange && typeof rangeHeader === "string") {
      const range = parseByteRange(rangeHeader, preview.fileSize);

      if (!range) {
        sendInvalidRange(response, preview.fileSize);
        return true;
      }

      const contentLength = range.end - range.start + 1;

      response.writeHead(206, {
        ...commonHeaders,
        "Content-Length": contentLength,
        "Content-Range": `bytes ${range.start}-${range.end}/${preview.fileSize}`
      });

      if (request.method === "HEAD") {
        response.end();
        return true;
      }

      createReadStream(preview.absolutePath, {
        start: range.start,
        end: range.end
      }).pipe(response);
      return true;
    }

    response.writeHead(200, {
      ...commonHeaders,
      "Content-Length": preview.fileSize
    });

    if (request.method === "HEAD") {
      response.end();
      return true;
    }

    createReadStream(preview.absolutePath).pipe(response);
    return true;
  } catch (error) {
    handleRouteError(response, error);
    return true;
  }
}

