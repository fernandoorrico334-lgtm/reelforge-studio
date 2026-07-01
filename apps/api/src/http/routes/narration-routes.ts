import type { IncomingMessage, ServerResponse } from "node:http";
import type { AppEnv } from "../../config/env.js";
import type { AssetRepository } from "../../modules/assets/application/asset-repository.js";
import type { NarrationJobRepository } from "../../modules/narration/application/narration-job-repository.js";
import {
  cancelNarrationJob,
  generateNarrationForScene,
  getNarrationJobDetail,
  getNarrationVoicePackByIdOrThrow,
  listNarrationJobsGallery,
  listNarrationProvidersSnapshot,
  listNarrationVoicePacks,
  listSceneNarrations,
  useNarrationForScene
} from "../../modules/narration/application/narration-service.js";
import {
  validateAssetId,
  validateGenerateNarrationRequestInput,
  validateNarrationJobFilters,
  validateNarrationJobId,
  validateSceneId
} from "../../modules/narration/domain/narration.js";
import type { ProjectRepository } from "../../modules/projects/application/project-repository.js";
import {
  handleRouteError,
  readJsonBody,
  sendJson,
  sendMethodNotAllowed
} from "../utils/http-utils.js";

function parseNarrationPath(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);

  if (segments[0] === "narration") {
    if (segments.length === 2 && segments[1] === "providers") {
      return { kind: "providers" as const };
    }

    if (segments.length === 2 && segments[1] === "voice-packs") {
      return { kind: "voice-packs" as const };
    }

    if (segments.length === 3 && segments[1] === "voice-packs") {
      return {
        kind: "voice-pack-item" as const,
        voicePackId: decodeURIComponent(segments[2] ?? "")
      };
    }

    if (segments.length === 2 && segments[1] === "jobs") {
      return { kind: "jobs" as const };
    }

    if (segments.length === 3 && segments[1] === "jobs") {
      return {
        kind: "job-item" as const,
        jobId: decodeURIComponent(segments[2] ?? "")
      };
    }

    if (segments.length === 4 && segments[1] === "jobs" && segments[3] === "cancel") {
      return {
        kind: "cancel-job" as const,
        jobId: decodeURIComponent(segments[2] ?? "")
      };
    }
  }

  if (segments[0] === "scenes" && segments.length === 3 && segments[2] === "narrations") {
    return {
      kind: "scene-narrations" as const,
      sceneId: decodeURIComponent(segments[1] ?? "")
    };
  }

  if (
    segments[0] === "scenes" &&
    segments.length === 3 &&
    segments[2] === "generate-narration"
  ) {
    return {
      kind: "generate-scene-narration" as const,
      sceneId: decodeURIComponent(segments[1] ?? "")
    };
  }

  if (
    segments[0] === "scenes" &&
    segments.length === 4 &&
    segments[2] === "use-narration"
  ) {
    return {
      kind: "use-scene-narration" as const,
      sceneId: decodeURIComponent(segments[1] ?? ""),
      assetId: decodeURIComponent(segments[3] ?? "")
    };
  }

  return null;
}

interface NarrationRouteDependencies {
  appEnv: Pick<AppEnv, "narrationWindowsSapiEnabled">;
  assetRepository: AssetRepository;
  narrationJobRepository: NarrationJobRepository;
  projectRepository: ProjectRepository;
}

export async function handleNarrationRoute(
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
  dependencies: NarrationRouteDependencies
): Promise<boolean> {
  const match = parseNarrationPath(url.pathname);

  if (!match) {
    return false;
  }

  const {
    appEnv,
    assetRepository,
    narrationJobRepository,
    projectRepository
  } = dependencies;

  try {
    if (match.kind === "providers") {
      if (request.method === "GET") {
        sendJson(response, 200, await listNarrationProvidersSnapshot(appEnv));
        return true;
      }

      sendMethodNotAllowed(response, ["GET"]);
      return true;
    }

    if (match.kind === "voice-packs") {
      if (request.method === "GET") {
        sendJson(response, 200, await listNarrationVoicePacks());
        return true;
      }

      sendMethodNotAllowed(response, ["GET"]);
      return true;
    }

    if (match.kind === "voice-pack-item") {
      if (request.method === "GET") {
        sendJson(
          response,
          200,
          await getNarrationVoicePackByIdOrThrow(match.voicePackId)
        );
        return true;
      }

      sendMethodNotAllowed(response, ["GET"]);
      return true;
    }

    if (match.kind === "jobs") {
      if (request.method === "GET") {
        sendJson(
          response,
          200,
          await listNarrationJobsGallery(
            projectRepository,
            narrationJobRepository,
            validateNarrationJobFilters(url.searchParams)
          )
        );
        return true;
      }

      sendMethodNotAllowed(response, ["GET"]);
      return true;
    }

    if (match.kind === "job-item") {
      if (request.method === "GET") {
        sendJson(
          response,
          200,
          await getNarrationJobDetail(
            projectRepository,
            narrationJobRepository,
            validateNarrationJobId(match.jobId)
          )
        );
        return true;
      }

      sendMethodNotAllowed(response, ["GET"]);
      return true;
    }

    if (match.kind === "cancel-job") {
      if (request.method === "POST") {
        sendJson(
          response,
          200,
          await cancelNarrationJob(
            narrationJobRepository,
            validateNarrationJobId(match.jobId)
          )
        );
        return true;
      }

      sendMethodNotAllowed(response, ["POST"]);
      return true;
    }

    if (match.kind === "scene-narrations") {
      if (request.method === "GET") {
        sendJson(
          response,
          200,
          await listSceneNarrations(
            projectRepository,
            narrationJobRepository,
            validateSceneId(match.sceneId)
          )
        );
        return true;
      }

      sendMethodNotAllowed(response, ["GET"]);
      return true;
    }

    if (match.kind === "generate-scene-narration") {
      if (request.method === "POST") {
        const payload = await readJsonBody<unknown>(request);
        const generated = await generateNarrationForScene(
          projectRepository,
          assetRepository,
          narrationJobRepository,
          validateSceneId(match.sceneId),
          validateGenerateNarrationRequestInput(payload),
          appEnv
        );
        sendJson(response, 201, generated);
        return true;
      }

      sendMethodNotAllowed(response, ["POST"]);
      return true;
    }

    if (match.kind === "use-scene-narration") {
      if (request.method === "POST") {
        sendJson(
          response,
          200,
          await useNarrationForScene(
            projectRepository,
            assetRepository,
            narrationJobRepository,
            validateSceneId(match.sceneId),
            validateAssetId(match.assetId)
          )
        );
        return true;
      }

      sendMethodNotAllowed(response, ["POST"]);
      return true;
    }
  } catch (error) {
    handleRouteError(response, error);
    return true;
  }

  return false;
}
