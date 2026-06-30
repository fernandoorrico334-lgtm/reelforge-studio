import type { IncomingMessage, ServerResponse } from "node:http";
import { getTemplateById, getTemplates } from "@reelforge/templates";
import {
  parseRouteId,
  sendJson,
  sendMethodNotAllowed
} from "../utils/http-utils.js";

export async function handleTemplateRoute(
  request: IncomingMessage,
  response: ServerResponse,
  pathname: string
): Promise<boolean> {
  if (pathname === "/templates") {
    if (request.method !== "GET") {
      sendMethodNotAllowed(response, ["GET"]);
      return true;
    }

    sendJson(response, 200, getTemplates());
    return true;
  }

  const templateId = parseRouteId(pathname, "/templates");

  if (!templateId) {
    return false;
  }

  if (request.method !== "GET") {
    sendMethodNotAllowed(response, ["GET"]);
    return true;
  }

  const template = getTemplateById(templateId);

  if (!template) {
    sendJson(response, 404, {
      error: `Template '${templateId}' was not found.`
    });
    return true;
  }

  sendJson(response, 200, template);
  return true;
}

