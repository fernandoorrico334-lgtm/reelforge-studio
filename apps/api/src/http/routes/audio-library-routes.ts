import type { IncomingMessage, ServerResponse } from "node:http";
import {
  getMusicPresetById,
  getMusicPresets
} from "@reelforge/audio-engine";
import type { AssetRepository } from "../../modules/assets/application/asset-repository.js";
import type { AudioLibraryRepository } from "../../modules/audio-library/application/audio-library-repository.js";
import {
  analyzeMusicLibraryAsset,
  buildProjectBeatSyncPlan,
  listMusicLibrary,
  listSfxLibrary,
  selectMusicForProject,
  updateMusicLibraryProfile,
  updateSfxLibraryProfile
} from "../../modules/audio-library/application/audio-library-service.js";
import {
  validateBeatSyncPlanRequestInput,
  validateMusicProfileFilters,
  validatePartialMusicProfileInput,
  validatePartialSfxProfileInput,
  validateSelectMusicRequestInput,
  validateSfxProfileFilters
} from "../../modules/audio-library/domain/audio-library.js";
import type { EditorialMicroclipRepository } from "../../modules/editorial-microclips/application/editorial-microclip-repository.js";
import type { ProjectRepository } from "../../modules/projects/application/project-repository.js";
import {
  handleRouteError,
  parseRouteId,
  readJsonBody,
  sendJson,
  sendMethodNotAllowed
} from "../utils/http-utils.js";

interface AudioLibraryRouteDependencies {
  assetRepository: AssetRepository;
  audioLibraryRepository: AudioLibraryRepository;
  editorialMicroclipRepository: EditorialMicroclipRepository;
  projectRepository: ProjectRepository;
}

export async function handleAudioLibraryRoute(
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
  dependencies: AudioLibraryRouteDependencies
): Promise<boolean> {
  const { pathname } = url;

  try {
    if (pathname === "/audio/music-presets") {
      if (request.method !== "GET") {
        sendMethodNotAllowed(response, ["GET"]);
        return true;
      }

      sendJson(response, 200, getMusicPresets());
      return true;
    }

    const musicPresetId = parseRouteId(pathname, "/audio/music-presets");

    if (musicPresetId) {
      if (request.method !== "GET") {
        sendMethodNotAllowed(response, ["GET"]);
        return true;
      }

      const preset = getMusicPresetById(musicPresetId);

      if (!preset) {
        sendJson(response, 404, {
          error: `Music preset '${musicPresetId}' was not found.`
        });
        return true;
      }

      sendJson(response, 200, preset);
      return true;
    }

    if (pathname === "/audio/music-library") {
      if (request.method !== "GET") {
        sendMethodNotAllowed(response, ["GET"]);
        return true;
      }

      const filters = validateMusicProfileFilters(
        Object.fromEntries(url.searchParams.entries())
      );
      const items = await listMusicLibrary(
        dependencies.assetRepository,
        filters
      );
      sendJson(response, 200, items);
      return true;
    }

    const analyzeMatch = pathname.match(/^\/audio\/music-library\/analyze\/([^/]+)$/u);

    if (analyzeMatch) {
      if (request.method !== "POST") {
        sendMethodNotAllowed(response, ["POST"]);
        return true;
      }

      const assetId = decodeURIComponent(analyzeMatch[1] ?? "");
      const result = await analyzeMusicLibraryAsset(
        dependencies.assetRepository,
        dependencies.audioLibraryRepository,
        assetId
      );
      sendJson(response, 200, result);
      return true;
    }

    const musicProfileId = pathname.match(/^\/audio\/music-library\/([^/]+)\/profile$/u);

    if (musicProfileId) {
      if (request.method !== "PUT") {
        sendMethodNotAllowed(response, ["PUT"]);
        return true;
      }

      const assetId = decodeURIComponent(musicProfileId[1] ?? "");
      const payload = await readJsonBody(request);
      const input = validatePartialMusicProfileInput(payload);
      const result = await updateMusicLibraryProfile(
        dependencies.assetRepository,
        dependencies.audioLibraryRepository,
        assetId,
        input
      );
      sendJson(response, 200, result);
      return true;
    }

    if (pathname === "/audio/sfx-library") {
      if (request.method !== "GET") {
        sendMethodNotAllowed(response, ["GET"]);
        return true;
      }

      const filters = validateSfxProfileFilters(
        Object.fromEntries(url.searchParams.entries())
      );
      const items = await listSfxLibrary(
        dependencies.assetRepository,
        filters
      );
      sendJson(response, 200, items);
      return true;
    }

    const sfxProfileId = pathname.match(/^\/audio\/sfx-library\/([^/]+)\/profile$/u);

    if (sfxProfileId) {
      if (request.method !== "PUT") {
        sendMethodNotAllowed(response, ["PUT"]);
        return true;
      }

      const assetId = decodeURIComponent(sfxProfileId[1] ?? "");
      const payload = await readJsonBody(request);
      const input = validatePartialSfxProfileInput(payload);
      const result = await updateSfxLibraryProfile(
        dependencies.assetRepository,
        dependencies.audioLibraryRepository,
        assetId,
        input
      );
      sendJson(response, 200, result);
      return true;
    }

    if (pathname === "/audio/select-music") {
      if (request.method !== "POST") {
        sendMethodNotAllowed(response, ["POST"]);
        return true;
      }

      const payload = await readJsonBody(request);
      const input = validateSelectMusicRequestInput(payload);
      const result = await selectMusicForProject(
        dependencies.assetRepository,
        input
      );
      sendJson(response, 200, result);
      return true;
    }

    if (pathname === "/audio/beat-sync-plan") {
      if (request.method !== "POST") {
        sendMethodNotAllowed(response, ["POST"]);
        return true;
      }

      const payload = await readJsonBody(request);
      const input = validateBeatSyncPlanRequestInput(payload);
      const result = await buildProjectBeatSyncPlan(
        dependencies.projectRepository,
        dependencies.assetRepository,
        dependencies.editorialMicroclipRepository,
        input
      );
      sendJson(response, 200, result);
      return true;
    }

    return false;
  } catch (error) {
    handleRouteError(response, error);
    return true;
  }
}
