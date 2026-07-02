import type { IncomingMessage, ServerResponse } from "node:http";
import type { AssetRepository } from "../../modules/assets/application/asset-repository.js";
import {
  createEditorialMicroclip,
  deleteEditorialMicroclip,
  getEditorialMicroclipById,
  listEditorialMicroclipsForProject,
  updateEditorialMicroclip
} from "../../modules/editorial-microclips/application/editorial-microclip-service.js";
import type { EditorialMicroclipRepository } from "../../modules/editorial-microclips/application/editorial-microclip-repository.js";
import {
  validateCreateEditorialMicroclipInput,
  validateUpdateEditorialMicroclipInput
} from "../../modules/editorial-microclips/domain/editorial-microclip.js";
import type { ProjectRepository } from "../../modules/projects/application/project-repository.js";
import {
  handleRouteError,
  readJsonBody,
  sendJson,
  sendMethodNotAllowed,
  sendNoContent
} from "../utils/http-utils.js";

function parseEditorialMicroclipPath(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);

  if (segments[0] !== "editorial-microclips") {
    return null;
  }

  if (
    segments.length === 3 &&
    segments[1] === "project" &&
    segments[2]?.trim().length
  ) {
    return {
      kind: "project-collection" as const,
      projectId: decodeURIComponent(segments[2])
    };
  }

  if (segments.length === 1) {
    return { kind: "collection" as const };
  }

  if (segments.length === 2 && segments[1]?.trim().length) {
    return {
      kind: "item" as const,
      microclipId: decodeURIComponent(segments[1])
    };
  }

  return null;
}

interface EditorialMicroclipRouteDependencies {
  assetRepository: AssetRepository;
  editorialMicroclipRepository: EditorialMicroclipRepository;
  projectRepository: ProjectRepository;
}

export async function handleEditorialMicroclipRoute(
  request: IncomingMessage,
  response: ServerResponse,
  pathname: string,
  dependencies: EditorialMicroclipRouteDependencies
): Promise<boolean> {
  const match = parseEditorialMicroclipPath(pathname);

  if (!match) {
    return false;
  }

  const {
    assetRepository,
    editorialMicroclipRepository,
    projectRepository
  } = dependencies;

  try {
    if (match.kind === "project-collection") {
      if (request.method !== "GET") {
        sendMethodNotAllowed(response, ["GET"]);
        return true;
      }

      sendJson(
        response,
        200,
        await listEditorialMicroclipsForProject(
          editorialMicroclipRepository,
          projectRepository,
          match.projectId
        )
      );
      return true;
    }

    if (match.kind === "collection") {
      if (request.method !== "POST") {
        sendMethodNotAllowed(response, ["POST"]);
        return true;
      }

      const payload = await readJsonBody<unknown>(request);
      sendJson(
        response,
        201,
        await createEditorialMicroclip(
          editorialMicroclipRepository,
          projectRepository,
          assetRepository,
          validateCreateEditorialMicroclipInput(payload)
        )
      );
      return true;
    }

    if (match.kind === "item") {
      if (request.method === "GET") {
        sendJson(
          response,
          200,
          await getEditorialMicroclipById(
            editorialMicroclipRepository,
            match.microclipId
          )
        );
        return true;
      }

      if (request.method === "PUT") {
        const payload = await readJsonBody<unknown>(request);
        sendJson(
          response,
          200,
          await updateEditorialMicroclip(
            editorialMicroclipRepository,
            projectRepository,
            assetRepository,
            match.microclipId,
            validateUpdateEditorialMicroclipInput(payload)
          )
        );
        return true;
      }

      if (request.method === "DELETE") {
        await deleteEditorialMicroclip(
          editorialMicroclipRepository,
          match.microclipId
        );
        sendNoContent(response);
        return true;
      }

      sendMethodNotAllowed(response, ["GET", "PUT", "DELETE"]);
      return true;
    }

    return false;
  } catch (error) {
    handleRouteError(response, error);
    return true;
  }
}
