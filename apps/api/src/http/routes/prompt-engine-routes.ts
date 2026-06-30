import type { IncomingMessage, ServerResponse } from "node:http";
import type { CharacterRepository } from "../../modules/characters/application/character-repository.js";
import {
  buildResearchRequirementVisualPrompt,
  buildSceneVisualPrompt,
  getNegativePromptPackByIdOrThrow,
  getPromptPackByIdOrThrow,
  listNegativePromptPacks,
  listPromptPacks,
  previewVisualPromptBuild
} from "../../modules/hybrid-visual/application/hybrid-visual-service.js";
import type { ProjectRepository } from "../../modules/projects/application/project-repository.js";
import type { ResearchRepository } from "../../modules/research/application/research-repository.js";
import { ValidationError } from "../../shared/errors.js";
import {
  handleRouteError,
  readJsonBody,
  sendJson,
  sendMethodNotAllowed
} from "../utils/http-utils.js";

function parsePromptEnginePath(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);

  if (segments[0] === "prompt-packs") {
    if (segments.length === 1) {
      return { kind: "prompt-packs" as const };
    }

    if (segments.length === 2) {
      return {
        kind: "prompt-pack-item" as const,
        promptPackId: decodeURIComponent(segments[1] ?? "")
      };
    }
  }

  if (segments[0] === "negative-prompt-packs") {
    if (segments.length === 1) {
      return { kind: "negative-prompt-packs" as const };
    }

    if (segments.length === 2) {
      return {
        kind: "negative-prompt-pack-item" as const,
        negativePromptPackId: decodeURIComponent(segments[1] ?? "")
      };
    }
  }

  if (segments[0] === "prompt-engine" && segments.length === 2 && segments[1] === "build") {
    return { kind: "prompt-engine-build" as const };
  }

  if (
    segments[0] === "scenes" &&
    segments.length === 3 &&
    segments[2] === "build-visual-prompt"
  ) {
    return {
      kind: "scene-build-visual-prompt" as const,
      sceneId: decodeURIComponent(segments[1] ?? "")
    };
  }

  if (
    segments[0] === "research" &&
    segments[1] === "asset-requirements" &&
    segments.length === 4 &&
    segments[3] === "build-visual-prompt"
  ) {
    return {
      kind: "requirement-build-visual-prompt" as const,
      requirementId: decodeURIComponent(segments[2] ?? "")
    };
  }

  return null;
}

function readOptionalString(value: unknown, fieldName: string) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    throw new ValidationError(`${fieldName} must be a string when provided.`);
  }

  const normalized = value.trim();
  return normalized || null;
}

function parsePromptBuildPayload(payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return {};
  }

  const record = payload as Record<string, unknown>;

  return {
    sceneId: readOptionalString(record.sceneId, "sceneId"),
    researchAssetRequirementId: readOptionalString(
      record.researchAssetRequirementId ?? record.requirementId,
      "researchAssetRequirementId"
    ),
    characterProfileId: readOptionalString(
      record.characterProfileId,
      "characterProfileId"
    ),
    promptPackId: readOptionalString(record.promptPackId, "promptPackId"),
    negativePackId: readOptionalString(record.negativePackId, "negativePackId"),
    variantType: readOptionalString(record.variantType, "variantType")
  };
}

interface PromptEngineRouteDependencies {
  characterRepository: CharacterRepository;
  projectRepository: ProjectRepository;
  researchRepository: ResearchRepository;
}

export async function handlePromptEngineRoute(
  request: IncomingMessage,
  response: ServerResponse,
  pathname: string,
  dependencies: PromptEngineRouteDependencies
): Promise<boolean> {
  const match = parsePromptEnginePath(pathname);

  if (!match) {
    return false;
  }

  const { characterRepository, projectRepository, researchRepository } = dependencies;

  try {
    if (match.kind === "prompt-packs") {
      if (request.method === "GET") {
        sendJson(response, 200, await listPromptPacks());
        return true;
      }

      sendMethodNotAllowed(response, ["GET"]);
      return true;
    }

    if (match.kind === "prompt-pack-item") {
      if (request.method === "GET") {
        sendJson(response, 200, await getPromptPackByIdOrThrow(match.promptPackId));
        return true;
      }

      sendMethodNotAllowed(response, ["GET"]);
      return true;
    }

    if (match.kind === "negative-prompt-packs") {
      if (request.method === "GET") {
        sendJson(response, 200, await listNegativePromptPacks());
        return true;
      }

      sendMethodNotAllowed(response, ["GET"]);
      return true;
    }

    if (match.kind === "negative-prompt-pack-item") {
      if (request.method === "GET") {
        sendJson(
          response,
          200,
          await getNegativePromptPackByIdOrThrow(match.negativePromptPackId)
        );
        return true;
      }

      sendMethodNotAllowed(response, ["GET"]);
      return true;
    }

    if (match.kind === "prompt-engine-build") {
      if (request.method === "POST") {
        const payload = parsePromptBuildPayload(await readJsonBody<unknown>(request));
        sendJson(
          response,
          200,
          await previewVisualPromptBuild(
            projectRepository,
            researchRepository,
            characterRepository,
            payload
          )
        );
        return true;
      }

      sendMethodNotAllowed(response, ["POST"]);
      return true;
    }

    if (match.kind === "scene-build-visual-prompt") {
      if (request.method === "POST") {
        const payload = parsePromptBuildPayload(await readJsonBody<unknown>(request));
        sendJson(
          response,
          200,
          await buildSceneVisualPrompt(
            projectRepository,
            characterRepository,
            match.sceneId,
            payload
          )
        );
        return true;
      }

      sendMethodNotAllowed(response, ["POST"]);
      return true;
    }

    if (match.kind === "requirement-build-visual-prompt") {
      if (request.method === "POST") {
        const payload = parsePromptBuildPayload(await readJsonBody<unknown>(request));
        sendJson(
          response,
          200,
          await buildResearchRequirementVisualPrompt(
            researchRepository,
            characterRepository,
            match.requirementId,
            payload
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

