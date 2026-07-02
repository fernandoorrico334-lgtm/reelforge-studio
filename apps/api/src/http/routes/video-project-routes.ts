import type { IncomingMessage, ServerResponse } from "node:http";
import type { AssetRepository } from "../../modules/assets/application/asset-repository.js";
import type { ChannelRepository } from "../../modules/channels/application/channel-repository.js";
import type { EditorialMicroclipRepository } from "../../modules/editorial-microclips/application/editorial-microclip-repository.js";
import { getVideoProjectCaptionAnalysis } from "../../modules/projects/application/project-caption-analysis-service.js";
import {
  createProjectScene,
  createVideoProject,
  deleteProjectScene,
  deleteVideoProject,
  getVideoProjectById,
  listProjectScenes,
  listVideoProjects,
  reorderProjectScenes,
  updateProjectScene,
  updateVideoProject
} from "../../modules/projects/application/project-service.js";
import { getVideoProjectRenderBlueprint } from "../../modules/projects/application/project-render-blueprint-service.js";
import { getVideoProjectAudioPlan } from "../../modules/projects/application/project-audio-plan-service.js";
import { getVideoProjectStoryAnalysis } from "../../modules/projects/application/project-story-analysis-service.js";
import type { ProjectRepository } from "../../modules/projects/application/project-repository.js";
import {
  applyChannelDefaultsToProject,
  getVideoProjectAssetSuggestions,
  getVideoProjectProductionChecklist
} from "../../modules/production/application/production-service.js";
import {
  createRenderJobForProject,
  listProjectRenderJobs
} from "../../modules/render-jobs/application/render-job-service.js";
import type { RenderJobRepository } from "../../modules/render-jobs/application/render-job-repository.js";
import type { RenderStorage } from "../../modules/render-jobs/application/render-storage.js";
import { validateCreateRenderJobRequestInput } from "../../modules/render-jobs/domain/render-job.js";
import {
  validateCreateProjectInput,
  validateCreateSceneInput,
  validateReorderScenesInput,
  validateUpdateProjectInput,
  validateUpdateSceneInput
} from "../../modules/projects/domain/project.js";
import {
  handleRouteError,
  readJsonBody,
  sendJson,
  sendMethodNotAllowed,
  sendNoContent
} from "../utils/http-utils.js";

function parseVideoProjectPath(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);

  if (segments[0] !== "video-projects") {
    return null;
  }

  if (segments.length === 1) {
    return {
      kind: "collection" as const
    };
  }

  const projectId = decodeURIComponent(segments[1] ?? "");

  if (!projectId) {
    return null;
  }

  if (segments.length === 2) {
    return {
      kind: "project" as const,
      projectId
    };
  }

  if (segments.length === 3 && segments[2] === "story-analysis") {
    return {
      kind: "story-analysis" as const,
      projectId
    };
  }

  if (segments.length === 3 && segments[2] === "caption-analysis") {
    return {
      kind: "caption-analysis" as const,
      projectId
    };
  }

  if (segments.length === 3 && segments[2] === "render-blueprint") {
    return {
      kind: "render-blueprint" as const,
      projectId
    };
  }

  if (segments.length === 3 && segments[2] === "audio-plan") {
    return {
      kind: "audio-plan" as const,
      projectId
    };
  }

  if (segments.length === 3 && segments[2] === "production-checklist") {
    return {
      kind: "production-checklist" as const,
      projectId
    };
  }

  if (segments.length === 3 && segments[2] === "asset-suggestions") {
    return {
      kind: "asset-suggestions" as const,
      projectId
    };
  }

  if (segments.length === 3 && segments[2] === "apply-channel-defaults") {
    return {
      kind: "apply-channel-defaults" as const,
      projectId
    };
  }

  if (segments.length === 3 && segments[2] === "render-jobs") {
    return {
      kind: "render-job-collection" as const,
      projectId
    };
  }

  if (segments[2] !== "scenes") {
    return null;
  }

  if (segments.length === 3) {
    return {
      kind: "scene-collection" as const,
      projectId
    };
  }

  if (segments.length === 4 && segments[3] === "reorder") {
    return {
      kind: "scene-reorder" as const,
      projectId
    };
  }

  if (segments.length === 4) {
    return {
      kind: "scene-item" as const,
      projectId,
      sceneId: decodeURIComponent(segments[3] ?? "")
    };
  }

  return null;
}

interface VideoProjectRouteDependencies {
  assetRepository: AssetRepository;
  channelRepository: ChannelRepository;
  editorialMicroclipRepository: EditorialMicroclipRepository;
  projectRepository: ProjectRepository;
  renderJobRepository: RenderJobRepository;
  renderStorage: RenderStorage;
}

export async function handleVideoProjectRoute(
  request: IncomingMessage,
  response: ServerResponse,
  pathname: string,
  dependencies: VideoProjectRouteDependencies
): Promise<boolean> {
  const match = parseVideoProjectPath(pathname);

  if (!match) {
    return false;
  }

  const {
    assetRepository,
    channelRepository,
    editorialMicroclipRepository,
    projectRepository,
    renderJobRepository,
    renderStorage
  } =
    dependencies;

  try {
    if (match.kind === "collection") {
      if (request.method === "GET") {
        sendJson(response, 200, await listVideoProjects(projectRepository));
        return true;
      }

      if (request.method === "POST") {
        const payload = await readJsonBody<unknown>(request);
        const created = await createVideoProject(
          projectRepository,
          channelRepository,
          assetRepository,
          validateCreateProjectInput(payload)
        );
        sendJson(response, 201, created);
        return true;
      }

      sendMethodNotAllowed(response, ["GET", "POST"]);
      return true;
    }

    if (match.kind === "project") {
      if (request.method === "GET") {
        sendJson(
          response,
          200,
          await getVideoProjectById(projectRepository, match.projectId)
        );
        return true;
      }

      if (request.method === "PUT") {
        const payload = await readJsonBody<unknown>(request);
        const updated = await updateVideoProject(
          projectRepository,
          channelRepository,
          assetRepository,
          match.projectId,
          validateUpdateProjectInput(payload)
        );
        sendJson(response, 200, updated);
        return true;
      }

      if (request.method === "DELETE") {
        await deleteVideoProject(projectRepository, match.projectId);
        sendNoContent(response);
        return true;
      }

      sendMethodNotAllowed(response, ["GET", "PUT", "DELETE"]);
      return true;
    }

    if (match.kind === "story-analysis") {
      if (request.method === "GET") {
        sendJson(
          response,
          200,
          await getVideoProjectStoryAnalysis(
            projectRepository,
            match.projectId
          )
        );
        return true;
      }

      sendMethodNotAllowed(response, ["GET"]);
      return true;
    }

    if (match.kind === "caption-analysis") {
      if (request.method === "GET") {
        sendJson(
          response,
          200,
          await getVideoProjectCaptionAnalysis(
            projectRepository,
            match.projectId
          )
        );
        return true;
      }

      sendMethodNotAllowed(response, ["GET"]);
      return true;
    }

    if (match.kind === "render-blueprint") {
      if (request.method === "GET") {
        sendJson(
          response,
          200,
          await getVideoProjectRenderBlueprint(
            projectRepository,
            assetRepository,
            editorialMicroclipRepository,
            match.projectId
          )
        );
        return true;
      }

      sendMethodNotAllowed(response, ["GET"]);
      return true;
    }

    if (match.kind === "audio-plan") {
      if (request.method === "GET") {
        sendJson(
          response,
          200,
          await getVideoProjectAudioPlan(
            projectRepository,
            assetRepository,
            editorialMicroclipRepository,
            match.projectId
          )
        );
        return true;
      }

      sendMethodNotAllowed(response, ["GET"]);
      return true;
    }

    if (match.kind === "production-checklist") {
      if (request.method === "GET") {
        sendJson(
          response,
          200,
          await getVideoProjectProductionChecklist(
            projectRepository,
            channelRepository,
            match.projectId
          )
        );
        return true;
      }

      sendMethodNotAllowed(response, ["GET"]);
      return true;
    }

    if (match.kind === "asset-suggestions") {
      if (request.method === "GET") {
        sendJson(
          response,
          200,
          await getVideoProjectAssetSuggestions(
            projectRepository,
            channelRepository,
            assetRepository,
            match.projectId
          )
        );
        return true;
      }

      sendMethodNotAllowed(response, ["GET"]);
      return true;
    }

    if (match.kind === "apply-channel-defaults") {
      if (request.method === "POST") {
        sendJson(
          response,
          200,
          await applyChannelDefaultsToProject(
            projectRepository,
            channelRepository,
            assetRepository,
            match.projectId
          )
        );
        return true;
      }

      sendMethodNotAllowed(response, ["POST"]);
      return true;
    }

    if (match.kind === "render-job-collection") {
      if (request.method === "GET") {
        sendJson(
          response,
          200,
          await listProjectRenderJobs(
            renderJobRepository,
            projectRepository,
            match.projectId
          )
        );
        return true;
      }

      if (request.method === "POST") {
        const payload = await readJsonBody<unknown>(request);
        sendJson(
          response,
          201,
          await createRenderJobForProject(
            renderJobRepository,
            projectRepository,
            assetRepository,
            editorialMicroclipRepository,
            renderStorage,
            match.projectId,
            validateCreateRenderJobRequestInput(payload)
          )
        );
        return true;
      }

      sendMethodNotAllowed(response, ["GET", "POST"]);
      return true;
    }

    if (match.kind === "scene-collection") {
      if (request.method === "GET") {
        sendJson(
          response,
          200,
          await listProjectScenes(projectRepository, match.projectId)
        );
        return true;
      }

      if (request.method === "POST") {
        const payload = await readJsonBody<unknown>(request);
        const created = await createProjectScene(
          projectRepository,
          assetRepository,
          match.projectId,
          validateCreateSceneInput(payload)
        );
        sendJson(response, 201, created);
        return true;
      }

      sendMethodNotAllowed(response, ["GET", "POST"]);
      return true;
    }

    if (match.kind === "scene-item") {
      if (request.method === "PUT") {
        const payload = await readJsonBody<unknown>(request);
        const updated = await updateProjectScene(
          projectRepository,
          assetRepository,
          match.projectId,
          match.sceneId,
          validateUpdateSceneInput(payload)
        );
        sendJson(response, 200, updated);
        return true;
      }

      if (request.method === "DELETE") {
        await deleteProjectScene(
          projectRepository,
          match.projectId,
          match.sceneId
        );
        sendNoContent(response);
        return true;
      }

      sendMethodNotAllowed(response, ["PUT", "DELETE"]);
      return true;
    }

    if (match.kind === "scene-reorder") {
      if (request.method === "POST") {
        const payload = await readJsonBody<unknown>(request);
        const scenes = await reorderProjectScenes(
          projectRepository,
          match.projectId,
          validateReorderScenesInput(payload)
        );
        sendJson(response, 200, scenes);
        return true;
      }

      sendMethodNotAllowed(response, ["POST"]);
      return true;
    }

    return false;
  } catch (error) {
    handleRouteError(response, error);
    return true;
  }
}

