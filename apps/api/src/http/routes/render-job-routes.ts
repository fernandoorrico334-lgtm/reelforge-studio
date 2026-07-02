import type { IncomingMessage, ServerResponse } from "node:http";
import {
  cancelRenderJob,
  deleteRenderJob,
  getRenderJobById,
  listRenderJobs,
  retryRenderJob
} from "../../modules/render-jobs/application/render-job-service.js";
import type { AssetRepository } from "../../modules/assets/application/asset-repository.js";
import type { EditorialMicroclipRepository } from "../../modules/editorial-microclips/application/editorial-microclip-repository.js";
import type { RenderJobRepository } from "../../modules/render-jobs/application/render-job-repository.js";
import type { ProjectRepository } from "../../modules/projects/application/project-repository.js";
import type { RenderStorage } from "../../modules/render-jobs/application/render-storage.js";
import {
  handleRouteError,
  sendJson,
  sendMethodNotAllowed,
  sendNoContent
} from "../utils/http-utils.js";

function parseRenderJobPath(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);

  if (segments[0] !== "render-jobs") {
    return null;
  }

  if (segments.length === 1) {
    return {
      kind: "collection" as const
    };
  }

  const renderJobId = decodeURIComponent(segments[1] ?? "");

  if (!renderJobId) {
    return null;
  }

  if (segments.length === 2) {
    return {
      kind: "item" as const,
      renderJobId
    };
  }

  if (segments.length === 3 && segments[2] === "cancel") {
    return {
      kind: "cancel" as const,
      renderJobId
    };
  }

  if (segments.length === 3 && segments[2] === "retry") {
    return {
      kind: "retry" as const,
      renderJobId
    };
  }

  return null;
}

interface RenderJobRouteDependencies {
  assetRepository: AssetRepository;
  editorialMicroclipRepository: EditorialMicroclipRepository;
  projectRepository: ProjectRepository;
  renderJobRepository: RenderJobRepository;
  renderStorage: RenderStorage;
}

export async function handleRenderJobRoute(
  request: IncomingMessage,
  response: ServerResponse,
  pathname: string,
  dependencies: RenderJobRouteDependencies
): Promise<boolean> {
  const match = parseRenderJobPath(pathname);

  if (!match) {
    return false;
  }

  const {
    assetRepository,
    editorialMicroclipRepository,
    projectRepository,
    renderJobRepository,
    renderStorage
  } = dependencies;

  try {
    if (match.kind === "collection") {
      if (request.method !== "GET") {
        sendMethodNotAllowed(response, ["GET"]);
        return true;
      }

      sendJson(response, 200, await listRenderJobs(renderJobRepository));
      return true;
    }

    if (match.kind === "item") {
      if (request.method === "GET") {
        sendJson(
          response,
          200,
          await getRenderJobById(renderJobRepository, match.renderJobId)
        );
        return true;
      }

      if (request.method === "DELETE") {
        await deleteRenderJob(renderJobRepository, match.renderJobId);
        sendNoContent(response);
        return true;
      }

      sendMethodNotAllowed(response, ["GET", "DELETE"]);
      return true;
    }

    if (match.kind === "cancel") {
      if (request.method !== "POST") {
        sendMethodNotAllowed(response, ["POST"]);
        return true;
      }

      sendJson(
        response,
        200,
        await cancelRenderJob(renderJobRepository, match.renderJobId)
      );
      return true;
    }

    if (match.kind === "retry") {
      if (request.method !== "POST") {
        sendMethodNotAllowed(response, ["POST"]);
        return true;
      }

      sendJson(
        response,
        201,
        await retryRenderJob(
          renderJobRepository,
          projectRepository,
          assetRepository,
          editorialMicroclipRepository,
          renderStorage,
          match.renderJobId
        )
      );
      return true;
    }

    return false;
  } catch (error) {
    handleRouteError(response, error);
    return true;
  }
}

