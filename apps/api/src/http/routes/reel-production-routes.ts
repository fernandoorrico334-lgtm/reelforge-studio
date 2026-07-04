import type { IncomingMessage, ServerResponse } from "node:http";
import type { AppEnv } from "../../config/env.js";
import type { AssetRepository } from "../../modules/assets/application/asset-repository.js";
import type { AudioLibraryRepository } from "../../modules/audio-library/application/audio-library-repository.js";
import type { CharacterRepository } from "../../modules/characters/application/character-repository.js";
import type { EditorialMicroclipRepository } from "../../modules/editorial-microclips/application/editorial-microclip-repository.js";
import type { VisualGenerationJobRepository } from "../../modules/hybrid-visual/application/visual-generation-job-repository.js";
import type { NarrationJobRepository } from "../../modules/narration/application/narration-job-repository.js";
import {
  buildReelProductionChecklist,
  cancelReelProductionRun,
  getReelProductionRun,
  listReelProductionRunsForProject,
  runOneClickReelProduction
} from "../../modules/reel-production/application/reel-production-service.js";
import type { ReelProductionRunRepository } from "../../modules/reel-production/application/reel-production-run-repository.js";
import { validateOneClickRunInput } from "../../modules/reel-production/domain/reel-production.js";
import type { ProjectRepository } from "../../modules/projects/application/project-repository.js";
import type { RenderJobRepository } from "../../modules/render-jobs/application/render-job-repository.js";
import type { RenderStorage } from "../../modules/render-jobs/application/render-storage.js";
import {
  handleRouteError,
  readJsonBody,
  sendJson,
  sendMethodNotAllowed
} from "../utils/http-utils.js";

interface ReelProductionRouteDependencies {
  appEnv: AppEnv;
  assetRepository: AssetRepository;
  audioLibraryRepository: AudioLibraryRepository;
  characterRepository: CharacterRepository;
  editorialMicroclipRepository: EditorialMicroclipRepository;
  narrationJobRepository: NarrationJobRepository;
  projectRepository: ProjectRepository;
  renderJobRepository: RenderJobRepository;
  renderStorage: RenderStorage;
  runRepository: ReelProductionRunRepository;
  visualGenerationJobRepository: VisualGenerationJobRepository;
}

function parseReelProductionPath(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);

  if (segments[0] !== "reel-production") {
    return null;
  }

  if (segments.length === 4 && segments[1] === "projects") {
    const projectId = decodeURIComponent(segments[2] ?? "");

    if (segments[3] === "checklist") {
      return { kind: "project-checklist" as const, projectId };
    }

    if (segments[3] === "run") {
      return { kind: "project-run" as const, projectId };
    }

    if (segments[3] === "runs") {
      return { kind: "project-runs" as const, projectId };
    }
  }

  if (segments.length >= 3 && segments[1] === "runs") {
    const runId = decodeURIComponent(segments[2] ?? "");

    if (segments.length === 3) {
      return { kind: "run-item" as const, runId };
    }

    if (segments.length === 4 && segments[3] === "cancel") {
      return { kind: "run-cancel" as const, runId };
    }
  }

  return null;
}

export async function handleReelProductionRoute(
  request: IncomingMessage,
  response: ServerResponse,
  pathname: string,
  dependencies: ReelProductionRouteDependencies
): Promise<boolean> {
  const match = parseReelProductionPath(pathname);

  if (!match) {
    return false;
  }

  try {
    if (match.kind === "project-checklist") {
      if (request.method !== "GET") {
        sendMethodNotAllowed(response, ["GET"]);
        return true;
      }

      sendJson(
        response,
        200,
        await buildReelProductionChecklist(dependencies, match.projectId)
      );
      return true;
    }

    if (match.kind === "project-run") {
      if (request.method !== "POST") {
        sendMethodNotAllowed(response, ["POST"]);
        return true;
      }

      const payload = await readJsonBody<unknown>(request);
      sendJson(
        response,
        201,
        await runOneClickReelProduction(
          dependencies,
          match.projectId,
          validateOneClickRunInput(payload)
        )
      );
      return true;
    }

    if (match.kind === "project-runs") {
      if (request.method !== "GET") {
        sendMethodNotAllowed(response, ["GET"]);
        return true;
      }

      sendJson(
        response,
        200,
        await listReelProductionRunsForProject(dependencies, match.projectId)
      );
      return true;
    }

    if (match.kind === "run-item") {
      if (request.method !== "GET") {
        sendMethodNotAllowed(response, ["GET"]);
        return true;
      }

      sendJson(
        response,
        200,
        await getReelProductionRun(dependencies.runRepository, match.runId)
      );
      return true;
    }

    if (match.kind === "run-cancel") {
      if (request.method !== "POST") {
        sendMethodNotAllowed(response, ["POST"]);
        return true;
      }

      sendJson(
        response,
        200,
        await cancelReelProductionRun(dependencies.runRepository, match.runId)
      );
      return true;
    }
  } catch (error) {
    handleRouteError(response, error);
    return true;
  }

  return false;
}
