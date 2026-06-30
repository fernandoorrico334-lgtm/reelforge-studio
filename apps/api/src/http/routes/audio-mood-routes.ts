import type { IncomingMessage, ServerResponse } from "node:http";
import {
  getAudioMoodPresetById,
  getAudioMoodPresets
} from "@reelforge/audio-engine";
import {
  parseRouteId,
  sendJson,
  sendMethodNotAllowed
} from "../utils/http-utils.js";

export async function handleAudioMoodRoute(
  request: IncomingMessage,
  response: ServerResponse,
  pathname: string
): Promise<boolean> {
  if (pathname === "/audio-moods") {
    if (request.method !== "GET") {
      sendMethodNotAllowed(response, ["GET"]);
      return true;
    }

    sendJson(response, 200, getAudioMoodPresets());
    return true;
  }

  const moodId = parseRouteId(pathname, "/audio-moods");

  if (!moodId) {
    return false;
  }

  if (request.method !== "GET") {
    sendMethodNotAllowed(response, ["GET"]);
    return true;
  }

  const mood = getAudioMoodPresetById(moodId);

  if (!mood) {
    sendJson(response, 404, {
      error: `Audio mood '${moodId}' was not found.`
    });
    return true;
  }

  sendJson(response, 200, mood);
  return true;
}