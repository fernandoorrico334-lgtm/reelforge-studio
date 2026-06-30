import type { IncomingMessage, ServerResponse } from "node:http";
import {
  createAsset,
  deleteAsset,
  getAssetById,
  listAssets,
  updateAsset
} from "../../modules/assets/application/asset-service.js";
import type { AssetStorage } from "../../modules/assets/application/asset-storage.js";
import { uploadAsset } from "../../modules/assets/application/asset-upload-service.js";
import type { AssetRepository } from "../../modules/assets/application/asset-repository.js";
import {
  validateAssetFilters,
  validateCreateAssetInput,
  validateUpdateAssetInput
} from "../../modules/assets/domain/asset.js";
import { maxAssetUploadBytes } from "../../modules/assets/infrastructure/local-asset-storage.js";
import { ValidationError } from "../../shared/errors.js";
import {
  handleRouteError,
  parseRouteId,
  readMultipartFormData,
  readJsonBody,
  sendJson,
  sendMethodNotAllowed,
  sendNoContent
} from "../utils/http-utils.js";

function readMultipartField(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : undefined;
}

export async function handleAssetRoute(
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
  repository: AssetRepository,
  assetStorage: AssetStorage
): Promise<boolean> {
  if (url.pathname === "/assets/upload") {
    try {
      if (request.method === "POST") {
        const formData = await readMultipartFormData(
          request,
          url.toString(),
          maxAssetUploadBytes
        );
        const file = formData.get("file");

        if (!(file instanceof File)) {
          throw new ValidationError("file is required.");
        }

        const created = await uploadAsset(repository, assetStorage, {
          file,
          type: readMultipartField(formData, "type"),
          category: readMultipartField(formData, "category"),
          franchise: readMultipartField(formData, "franchise"),
          character: readMultipartField(formData, "character"),
          emotion: readMultipartField(formData, "emotion"),
          tags: readMultipartField(formData, "tags"),
          licenseType: readMultipartField(formData, "licenseType"),
          copyrightRisk: readMultipartField(formData, "copyrightRisk"),
          recommendedUse: readMultipartField(formData, "recommendedUse")
        });

        sendJson(response, 201, created);
        return true;
      }

      sendMethodNotAllowed(response, ["POST"]);
      return true;
    } catch (error) {
      handleRouteError(response, error);
      return true;
    }
  }

  if (url.pathname === "/assets") {
    try {
      if (request.method === "GET") {
        const filters = validateAssetFilters({
          type: url.searchParams.get("type") ?? undefined,
          category: url.searchParams.get("category") ?? undefined,
          emotion: url.searchParams.get("emotion") ?? undefined,
          copyrightRisk:
            url.searchParams.get("copyrightRisk") ?? undefined,
          search: url.searchParams.get("search") ?? undefined
        });

        sendJson(response, 200, await listAssets(repository, filters));
        return true;
      }

      if (request.method === "POST") {
        const payload = await readJsonBody<unknown>(request);
        const created = await createAsset(
          repository,
          validateCreateAssetInput(payload)
        );
        sendJson(response, 201, created);
        return true;
      }

      sendMethodNotAllowed(response, ["GET", "POST"]);
      return true;
    } catch (error) {
      handleRouteError(response, error);
      return true;
    }
  }

  const assetId = parseRouteId(url.pathname, "/assets");

  if (!assetId) {
    return false;
  }

  try {
    if (request.method === "GET") {
      sendJson(response, 200, await getAssetById(repository, assetId));
      return true;
    }

    if (request.method === "PUT") {
      const payload = await readJsonBody<unknown>(request);
      const updated = await updateAsset(
        repository,
        assetId,
        validateUpdateAssetInput(payload)
      );
      sendJson(response, 200, updated);
      return true;
    }

    if (request.method === "DELETE") {
      await deleteAsset(repository, assetId);
      sendNoContent(response);
      return true;
    }

    sendMethodNotAllowed(response, ["GET", "PUT", "DELETE"]);
    return true;
  } catch (error) {
    handleRouteError(response, error);
    return true;
  }
}

