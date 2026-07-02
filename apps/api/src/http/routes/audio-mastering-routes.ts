import type { IncomingMessage, ServerResponse } from "node:http";
import {
  getAudioMasteringPresetById,
  getAudioMasteringPresets
} from "@reelforge/audio-engine/mastering";
import {
  parseRouteId,
  sendJson,
  sendMethodNotAllowed
} from "../utils/http-utils.js";

export async function handleAudioMasteringRoute(
  request: IncomingMessage,
  response: ServerResponse,
  pathname: string
): Promise<boolean> {
  if (pathname === "/audio/mastering-presets") {
    if (request.method !== "GET") {
      sendMethodNotAllowed(response, ["GET"]);
      return true;
    }

    sendJson(response, 200, getAudioMasteringPresets());
    return true;
  }

  const presetId = parseRouteId(pathname, "/audio/mastering-presets");

  if (!presetId) {
    return false;
  }

  if (request.method !== "GET") {
    sendMethodNotAllowed(response, ["GET"]);
    return true;
  }

  const preset = getAudioMasteringPresetById(presetId);

  if (!preset) {
    sendJson(response, 404, {
      error: `Audio mastering preset '${presetId}' was not found.`
    });
    return true;
  }

  sendJson(response, 200, preset);
  return true;
}
