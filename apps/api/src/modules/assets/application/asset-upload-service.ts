import type { AssetRepository } from "./asset-repository.js";
import type { AssetStorage, AssetUploadFile } from "./asset-storage.js";
import { createAsset } from "./asset-service.js";
import {
  normalizeAssetCategoryValue,
  normalizeOptionalAssetTypeValue,
  normalizeOptionalCopyrightRiskValue,
  normalizeOptionalEmotionTagValue,
  normalizeOptionalString,
  parseTagInput
} from "../domain/asset.js";

export interface UploadAssetInput {
  file: AssetUploadFile;
  type?: unknown;
  category?: unknown;
  franchise?: unknown;
  character?: unknown;
  emotion?: unknown;
  tags?: unknown;
  licenseType?: unknown;
  copyrightRisk?: unknown;
  recommendedUse?: unknown;
}

function normalizeLicenseType(value: unknown) {
  return normalizeOptionalString(value, "licenseType") ?? "UNSPECIFIED";
}

export async function uploadAsset(
  repository: AssetRepository,
  storage: AssetStorage,
  input: UploadAssetInput
) {
  const category = normalizeAssetCategoryValue(input.category);
  const requestedType =
    normalizeOptionalAssetTypeValue(input.type) ?? null;
  const storedFile = await storage.storeUpload({
    category,
    requestedType,
    file: input.file
  });

  return createAsset(repository, {
    filename: storedFile.filename,
    originalName: input.file.name,
    path: storedFile.path,
    type: storedFile.type,
    category,
    franchise: normalizeOptionalString(input.franchise, "franchise") ?? null,
    character: normalizeOptionalString(input.character, "character") ?? null,
    emotion:
      normalizeOptionalEmotionTagValue(input.emotion, "emotion") ?? null,
    tags: parseTagInput(input.tags),
    licenseType: normalizeLicenseType(input.licenseType),
    copyrightRisk:
      normalizeOptionalCopyrightRiskValue(
        input.copyrightRisk,
        "copyrightRisk"
      ) ?? "UNKNOWN",
    recommendedUse:
      normalizeOptionalString(input.recommendedUse, "recommendedUse") ?? null,
    duration: null,
    width: storedFile.width,
    height: storedFile.height,
    mimeType: storedFile.mimeType,
    extension: storedFile.extension,
    fileSize: storedFile.fileSize
  });
}