import { createReadStream } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { AssetRepository } from "../../modules/assets/application/asset-repository.js";
import type { AssetStorage } from "../../modules/assets/application/asset-storage.js";
import { getAssetById } from "../../modules/assets/application/asset-service.js";
import { NotFoundError, ValidationError } from "../../shared/errors.js";
import {
  corsHeaders,
  handleRouteError,
  parseRouteId,
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

export async function handleAssetMediaRoute(
  request: IncomingMessage,
  response: ServerResponse,
  pathname: string,
  repository: AssetRepository,
  assetStorage: AssetStorage
): Promise<boolean> {
  const assetId = parseRouteId(pathname, "/media/assets");

  if (!assetId) {
    return false;
  }

  try {
    if (request.method !== "GET" && request.method !== "HEAD") {
      sendMethodNotAllowed(response, ["GET", "HEAD"]);
      return true;
    }

    const asset = await getAssetById(repository, assetId);
    const resolvedMedia = await assetStorage.resolveMedia(asset);

    if (!resolvedMedia) {
      throw new NotFoundError(
        `Preview is unavailable for asset '${assetId}'.`
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
    if (error instanceof ValidationError) {
      sendInvalidRange(response, 0);
      return true;
    }

    handleRouteError(response, error);
    return true;
  }
}