import type { IncomingMessage, ServerResponse } from "node:http";
import type { AssetRepository } from "../../modules/assets/application/asset-repository.js";
import {
  analyzeStoredEditingReference,
  buildPresetFromEditingReference,
  createEditingReference,
  createEditingReferencePreset,
  deleteEditingReference,
  deleteEditingReferencePreset,
  getEditingReference,
  getEditingReferencePreset,
  getEditingReferencePresetSuggestions,
  listEditingReferencePresets,
  listEditingReferences,
  updateEditingReference,
  updateEditingReferencePreset
} from "../../modules/editing-references/application/editing-reference-service.js";
import type { EditingReferenceRepository } from "../../modules/editing-references/application/editing-reference-repository.js";
import {
  validateBuildEditingReferencePresetPayload,
  validateCreateEditingReferenceInput,
  validateCreateEditingReferencePresetInput,
  validateEditingReferenceFilters,
  validateEditingReferencePresetFilters,
  validateUpdateEditingReferenceInput,
  validateUpdateEditingReferencePresetInput
} from "../../modules/editing-references/domain/editing-reference.js";
import {
  handleRouteError,
  parseRouteId,
  readJsonBody,
  sendJson,
  sendMethodNotAllowed,
  sendNoContent
} from "../utils/http-utils.js";

interface EditingReferenceRouteDependencies {
  assetRepository: AssetRepository;
  editingReferenceRepository: EditingReferenceRepository;
}

export async function handleEditingReferenceRoute(
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
  dependencies: EditingReferenceRouteDependencies
): Promise<boolean> {
  const { pathname } = url;

  try {
    if (pathname === "/editing-references") {
      if (request.method === "GET") {
        const filters = validateEditingReferenceFilters(
          Object.fromEntries(url.searchParams.entries())
        );
        sendJson(
          response,
          200,
          await listEditingReferences(
            dependencies.editingReferenceRepository,
            filters
          )
        );
        return true;
      }

      if (request.method === "POST") {
        const payload = await readJsonBody(request);
        const input = validateCreateEditingReferenceInput(payload);
        const created = await createEditingReference(
          dependencies.editingReferenceRepository,
          dependencies.assetRepository,
          input
        );
        sendJson(response, 201, created);
        return true;
      }

      sendMethodNotAllowed(response, ["GET", "POST"]);
      return true;
    }

    const analyzeMatch = pathname.match(/^\/editing-references\/([^/]+)\/analyze$/u);

    if (analyzeMatch) {
      if (request.method !== "POST") {
        sendMethodNotAllowed(response, ["POST"]);
        return true;
      }

      const referenceId = decodeURIComponent(analyzeMatch[1] ?? "");
      const result = await analyzeStoredEditingReference(
        dependencies.editingReferenceRepository,
        referenceId
      );
      sendJson(response, 200, result);
      return true;
    }

    const buildPresetMatch =
      pathname.match(/^\/editing-references\/([^/]+)\/build-preset$/u);

    if (buildPresetMatch) {
      if (request.method !== "POST") {
        sendMethodNotAllowed(response, ["POST"]);
        return true;
      }

      const referenceId = decodeURIComponent(buildPresetMatch[1] ?? "");
      const payload = await readJsonBody(request);
      const input = validateBuildEditingReferencePresetPayload(payload);
      const result = await buildPresetFromEditingReference(
        dependencies.editingReferenceRepository,
        referenceId,
        input
      );
      sendJson(response, 201, result);
      return true;
    }

    const referenceId = parseRouteId(pathname, "/editing-references");

    if (referenceId) {
      if (request.method === "GET") {
        sendJson(
          response,
          200,
          await getEditingReference(
            dependencies.editingReferenceRepository,
            referenceId
          )
        );
        return true;
      }

      if (request.method === "PUT") {
        const payload = await readJsonBody(request);
        const input = validateUpdateEditingReferenceInput(payload);
        const updated = await updateEditingReference(
          dependencies.editingReferenceRepository,
          dependencies.assetRepository,
          referenceId,
          input
        );
        sendJson(response, 200, updated);
        return true;
      }

      if (request.method === "DELETE") {
        await deleteEditingReference(
          dependencies.editingReferenceRepository,
          referenceId
        );
        sendNoContent(response);
        return true;
      }

      sendMethodNotAllowed(response, ["GET", "PUT", "DELETE"]);
      return true;
    }

    if (pathname === "/editing-reference-presets/suggestions") {
      if (request.method !== "GET") {
        sendMethodNotAllowed(response, ["GET"]);
        return true;
      }

      const templateId = url.searchParams.get("templateId")?.trim();

      if (!templateId) {
        sendJson(response, 400, {
          error: "templateId is required."
        });
        return true;
      }

      sendJson(
        response,
        200,
        await getEditingReferencePresetSuggestions(
          dependencies.editingReferenceRepository,
          templateId
        )
      );
      return true;
    }

    if (pathname === "/editing-reference-presets/suggest") {
      if (request.method !== "POST") {
        sendMethodNotAllowed(response, ["POST"]);
        return true;
      }

      const payload = await readJsonBody<Record<string, unknown>>(request);
      const templateId =
        typeof payload.templateId === "string" ? payload.templateId.trim() : "";

      if (!templateId) {
        sendJson(response, 400, {
          error: "templateId is required."
        });
        return true;
      }

      sendJson(
        response,
        200,
        await getEditingReferencePresetSuggestions(
          dependencies.editingReferenceRepository,
          templateId
        )
      );
      return true;
    }

    if (pathname === "/editing-reference-presets") {
      if (request.method === "GET") {
        const filters = validateEditingReferencePresetFilters(
          Object.fromEntries(url.searchParams.entries())
        );
        sendJson(
          response,
          200,
          await listEditingReferencePresets(
            dependencies.editingReferenceRepository,
            filters
          )
        );
        return true;
      }

      if (request.method === "POST") {
        const payload = await readJsonBody(request);
        const input = validateCreateEditingReferencePresetInput(payload);
        const created = await createEditingReferencePreset(
          dependencies.editingReferenceRepository,
          input
        );
        sendJson(response, 201, created);
        return true;
      }

      sendMethodNotAllowed(response, ["GET", "POST"]);
      return true;
    }

    const presetId = parseRouteId(pathname, "/editing-reference-presets");

    if (presetId) {
      if (request.method === "GET") {
        sendJson(
          response,
          200,
          await getEditingReferencePreset(
            dependencies.editingReferenceRepository,
            presetId
          )
        );
        return true;
      }

      if (request.method === "PUT") {
        const payload = await readJsonBody(request);
        const input = validateUpdateEditingReferencePresetInput(payload);
        const updated = await updateEditingReferencePreset(
          dependencies.editingReferenceRepository,
          presetId,
          input
        );
        sendJson(response, 200, updated);
        return true;
      }

      if (request.method === "DELETE") {
        await deleteEditingReferencePreset(
          dependencies.editingReferenceRepository,
          presetId
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
