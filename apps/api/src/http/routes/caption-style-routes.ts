import type { IncomingMessage, ServerResponse } from "node:http";
import {
  getCaptionStyleById,
  getCaptionStyles
} from "@reelforge/caption-engine";
import {
  parseRouteId,
  sendJson,
  sendMethodNotAllowed
} from "../utils/http-utils.js";

export async function handleCaptionStyleRoute(
  request: IncomingMessage,
  response: ServerResponse,
  pathname: string
): Promise<boolean> {
  if (pathname === "/caption-styles") {
    if (request.method !== "GET") {
      sendMethodNotAllowed(response, ["GET"]);
      return true;
    }

    sendJson(response, 200, getCaptionStyles());
    return true;
  }

  const styleId = parseRouteId(pathname, "/caption-styles");

  if (!styleId) {
    return false;
  }

  if (request.method !== "GET") {
    sendMethodNotAllowed(response, ["GET"]);
    return true;
  }

  const style = getCaptionStyleById(styleId);

  if (!style) {
    sendJson(response, 404, {
      error: `Caption style '${styleId}' was not found.`
    });
    return true;
  }

  sendJson(response, 200, style);
  return true;
}

