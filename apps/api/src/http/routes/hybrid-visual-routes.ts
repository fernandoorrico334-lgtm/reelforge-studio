import type { IncomingMessage, ServerResponse } from "node:http";
import type { AppEnv } from "../../config/env.js";
import type { AssetRepository } from "../../modules/assets/application/asset-repository.js";
import type { CharacterRepository } from "../../modules/characters/application/character-repository.js";
import {
  cancelVisualGenerationJob,
  generateMissingVisualsForProject,
  generateVisualForResearchRequirement,
  generateVisualForScene,
  getComfyUiProviderStatusSnapshot,
  getProjectMissingVisualReport,
  getVisualGenerationJobById,
  listVisualGenerationJobs,
  listVisualGenerationProviders,
  listVisualSourceModes,
  testComfyUiProvider,
  validateComfyUiWorkflowTemplateSnapshot
} from "../../modules/hybrid-visual/application/hybrid-visual-service.js";
import type { VisualGenerationJobRepository } from "../../modules/hybrid-visual/application/visual-generation-job-repository.js";
import {
  normalizeOptionalVisualGenerationStatusValue,
  validateGenerateMissingVisualsInput,
  validateGenerateVisualRequestInput
} from "../../modules/hybrid-visual/domain/visual-generation.js";
import type { ProjectRepository } from "../../modules/projects/application/project-repository.js";
import type { ResearchRepository } from "../../modules/research/application/research-repository.js";
import {
  handleRouteError,
  readJsonBody,
  sendJson,
  sendMethodNotAllowed
} from "../utils/http-utils.js";

function parseHybridVisualPath(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);

  if (segments[0] === "visual-source-modes" && segments.length === 1) {
    return { kind: "visual-source-modes" as const };
  }

  if (segments[0] === "visual-generation") {
    if (segments.length === 2 && segments[1] === "providers") {
      return { kind: "providers" as const };
    }

    if (
      segments.length === 4 &&
      segments[1] === "providers" &&
      segments[2] === "comfyui-local" &&
      segments[3] === "status"
    ) {
      return { kind: "comfyui-status" as const };
    }

    if (
      segments.length === 4 &&
      segments[1] === "providers" &&
      segments[2] === "comfyui-local" &&
      segments[3] === "test"
    ) {
      return { kind: "comfyui-test" as const };
    }

    if (
      segments.length === 4 &&
      segments[1] === "providers" &&
      segments[2] === "comfyui-local" &&
      segments[3] === "validate-workflow"
    ) {
      return { kind: "comfyui-validate-workflow" as const };
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

  if (segments[0] === "video-projects" && segments.length === 3) {
    const projectId = decodeURIComponent(segments[1] ?? "");

    if (!projectId) {
      return null;
    }

    if (segments[2] === "missing-visual-report") {
      return { kind: "missing-visual-report" as const, projectId };
    }

    if (segments[2] === "generate-missing-visuals") {
      return { kind: "generate-missing-visuals" as const, projectId };
    }
  }

  if (
    segments[0] === "scenes" &&
    segments.length === 3 &&
    segments[2] === "generate-visual"
  ) {
    return {
      kind: "generate-scene-visual" as const,
      sceneId: decodeURIComponent(segments[1] ?? "")
    };
  }

  if (
    segments[0] === "research" &&
    segments[1] === "asset-requirements" &&
    segments.length === 4 &&
    segments[3] === "generate-visual"
  ) {
    return {
      kind: "generate-requirement-visual" as const,
      requirementId: decodeURIComponent(segments[2] ?? "")
    };
  }

  return null;
}

interface HybridVisualRouteDependencies {
  appEnv: Pick<
    AppEnv,
    | "comfyUiBaseUrl"
    | "comfyUiDefaultWorkflow"
    | "comfyUiEnabled"
    | "comfyUiWorkflowDir"
    | "comfyUiTimeoutMs"
  >;
  assetRepository: AssetRepository;
  characterRepository: CharacterRepository;
  projectRepository: ProjectRepository;
  researchRepository: ResearchRepository;
  visualGenerationJobRepository: VisualGenerationJobRepository;
}

export async function handleHybridVisualRoute(
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
  dependencies: HybridVisualRouteDependencies
): Promise<boolean> {
  const match = parseHybridVisualPath(url.pathname);

  if (!match) {
    return false;
  }

  const {
    appEnv,
    assetRepository,
    characterRepository,
    projectRepository,
    researchRepository,
    visualGenerationJobRepository
  } = dependencies;

  try {
    if (match.kind === "visual-source-modes") {
      if (request.method === "GET") {
        sendJson(response, 200, await listVisualSourceModes());
        return true;
      }

      sendMethodNotAllowed(response, ["GET"]);
      return true;
    }

    if (match.kind === "providers") {
      if (request.method === "GET") {
        sendJson(response, 200, await listVisualGenerationProviders(appEnv));
        return true;
      }

      sendMethodNotAllowed(response, ["GET"]);
      return true;
    }

    if (match.kind === "comfyui-status") {
      if (request.method === "GET") {
        sendJson(response, 200, await getComfyUiProviderStatusSnapshot(appEnv));
        return true;
      }

      sendMethodNotAllowed(response, ["GET"]);
      return true;
    }

    if (match.kind === "comfyui-test") {
      if (request.method === "POST") {
        sendJson(response, 200, await testComfyUiProvider(appEnv));
        return true;
      }

      sendMethodNotAllowed(response, ["POST"]);
      return true;
    }

    if (match.kind === "comfyui-validate-workflow") {
      if (request.method === "POST") {
        const payload = await readJsonBody<{ templateId?: string }>(request);
        sendJson(
          response,
          200,
          await validateComfyUiWorkflowTemplateSnapshot(
            payload?.templateId,
            appEnv
          )
        );
        return true;
      }

      sendMethodNotAllowed(response, ["POST"]);
      return true;
    }

    if (match.kind === "jobs") {
      if (request.method === "GET") {
        const filters: Parameters<typeof listVisualGenerationJobs>[1] = {};
        const videoProjectId = url.searchParams.get("videoProjectId");
        const sceneId = url.searchParams.get("sceneId");
        const researchAssetRequirementId = url.searchParams.get("researchAssetRequirementId");
        const characterProfileId = url.searchParams.get("characterProfileId");
        const status =
          normalizeOptionalVisualGenerationStatusValue(
            url.searchParams.get("status"),
            "status"
          ) ?? undefined;

        if (videoProjectId) filters.videoProjectId = videoProjectId;
        if (sceneId) filters.sceneId = sceneId;
        if (researchAssetRequirementId) {
          filters.researchAssetRequirementId = researchAssetRequirementId;
        }
        if (characterProfileId) {
          filters.characterProfileId = characterProfileId;
        }
        if (status) filters.status = status;

        sendJson(
          response,
          200,
          await listVisualGenerationJobs(visualGenerationJobRepository, filters)
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
          await getVisualGenerationJobById(visualGenerationJobRepository, match.jobId)
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
          await cancelVisualGenerationJob(
            visualGenerationJobRepository,
            projectRepository,
            researchRepository,
            match.jobId
          )
        );
        return true;
      }

      sendMethodNotAllowed(response, ["POST"]);
      return true;
    }

    if (match.kind === "missing-visual-report") {
      if (request.method === "GET") {
        sendJson(
          response,
          200,
          await getProjectMissingVisualReport(
            projectRepository,
            characterRepository,
            match.projectId
          )
        );
        return true;
      }

      sendMethodNotAllowed(response, ["GET"]);
      return true;
    }

    if (match.kind === "generate-missing-visuals") {
      if (request.method === "POST") {
        const payload = await readJsonBody<unknown>(request);
        sendJson(
          response,
          201,
          await generateMissingVisualsForProject(
            projectRepository,
            assetRepository,
            characterRepository,
            visualGenerationJobRepository,
            match.projectId,
            validateGenerateMissingVisualsInput(payload),
            appEnv
          )
        );
        return true;
      }

      sendMethodNotAllowed(response, ["POST"]);
      return true;
    }

    if (match.kind === "generate-scene-visual") {
      if (request.method === "POST") {
        const payload = await readJsonBody<unknown>(request);
        sendJson(
          response,
          201,
          await generateVisualForScene(
            projectRepository,
            assetRepository,
            characterRepository,
            visualGenerationJobRepository,
            match.sceneId,
            validateGenerateVisualRequestInput(payload),
            appEnv
          )
        );
        return true;
      }

      sendMethodNotAllowed(response, ["POST"]);
      return true;
    }

    if (match.kind === "generate-requirement-visual") {
      if (request.method === "POST") {
        const payload = await readJsonBody<unknown>(request);
        sendJson(
          response,
          201,
          await generateVisualForResearchRequirement(
            researchRepository,
            assetRepository,
            characterRepository,
            visualGenerationJobRepository,
            match.requirementId,
            validateGenerateVisualRequestInput(payload),
            appEnv
          )
        );
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

