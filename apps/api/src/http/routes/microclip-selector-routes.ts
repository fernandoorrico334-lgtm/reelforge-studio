import type { IncomingMessage, ServerResponse } from "node:http";
import type { AssetRepository } from "../../modules/assets/application/asset-repository.js";
import type { EditorialMicroclipRepository } from "../../modules/editorial-microclips/application/editorial-microclip-repository.js";
import {
  analyzeAssetForMicroclips,
  applyMicroclipCandidate,
  type MicroclipSelectorAnalyzeInput,
  type MicroclipSelectorApplyInput
} from "../../modules/microclip-selector/application/microclip-selector-service.js";
import type { ProjectRepository } from "../../modules/projects/application/project-repository.js";
import { ValidationError } from "../../shared/errors.js";
import {
  handleRouteError,
  readJsonBody,
  sendJson,
  sendMethodNotAllowed
} from "../utils/http-utils.js";

interface MicroclipSelectorRouteDependencies {
  assetRepository: AssetRepository;
  editorialMicroclipRepository: EditorialMicroclipRepository;
  projectRepository: ProjectRepository;
}

function asRecord(payload: unknown): Record<string, unknown> {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new ValidationError("Expected a JSON object.");
  }

  return payload as Record<string, unknown>;
}

function readString(record: Record<string, unknown>, field: string) {
  const value = record[field];

  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ValidationError(`${field} must be a non-empty string.`);
  }

  return value.trim();
}

function readOptionalString(record: Record<string, unknown>, field: string) {
  const value = record[field];

  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    throw new ValidationError(`${field} must be a string or null.`);
  }

  return value.trim() || null;
}

function readNumber(record: Record<string, unknown>, field: string, fallback: number) {
  const value = record[field];

  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new ValidationError(`${field} must be a number.`);
  }

  return value;
}

function validateAnalyzePayload(payload: unknown): MicroclipSelectorAnalyzeInput {
  const record = asRecord(payload);

  return {
    assetId: readString(record, "assetId"),
    targetDurationSeconds: readNumber(record, "targetDurationSeconds", 1.5),
    topN: Math.max(1, Math.min(Math.round(readNumber(record, "topN", 10)), 20)),
    useCase: readOptionalString(record, "useCase") ?? "football",
    preset: readOptionalString(record, "preset") ?? "football_hype"
  };
}

function validateApplyPayload(payload: unknown): MicroclipSelectorApplyInput {
  const record = asRecord(payload);
  const usageMode = readOptionalString(record, "usageMode");

  if (
    usageMode &&
    !["impact_moment", "supporting_evidence", "quick_reference"].includes(usageMode)
  ) {
    throw new ValidationError(
      "usageMode must be impact_moment, supporting_evidence or quick_reference."
    );
  }

  return {
    projectId: readString(record, "projectId"),
    sceneId: readOptionalString(record, "sceneId"),
    assetId: readString(record, "assetId"),
    candidateId: readString(record, "candidateId"),
    label: readOptionalString(record, "label"),
    usageMode: usageMode as MicroclipSelectorApplyInput["usageMode"]
  };
}

export async function handleMicroclipSelectorRoute(
  request: IncomingMessage,
  response: ServerResponse,
  pathname: string,
  dependencies: MicroclipSelectorRouteDependencies
) {
  try {
    if (pathname === "/microclip-selector/analyze") {
      if (request.method !== "POST") {
        sendMethodNotAllowed(response, ["POST"]);
        return true;
      }

      const payload = await readJsonBody(request);
      const input = validateAnalyzePayload(payload);
      sendJson(
        response,
        200,
        await analyzeAssetForMicroclips(dependencies.assetRepository, input)
      );
      return true;
    }

    if (pathname === "/microclip-selector/apply") {
      if (request.method !== "POST") {
        sendMethodNotAllowed(response, ["POST"]);
        return true;
      }

      const payload = await readJsonBody(request);
      const input = validateApplyPayload(payload);
      sendJson(response, 201, await applyMicroclipCandidate(dependencies, input));
      return true;
    }

    return false;
  } catch (error) {
    handleRouteError(response, error);
    return true;
  }
}
