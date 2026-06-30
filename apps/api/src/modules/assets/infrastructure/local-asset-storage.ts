import { mkdir, stat, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { assetsStorageRoot, projectRoot } from "../../../config/paths.js";
import {
  PayloadTooLargeError,
  ValidationError
} from "../../../shared/errors.js";
import type {
  AssetStorage,
  AssetUploadFile,
  StoreAssetUploadInput
} from "../application/asset-storage.js";
import type { StudioAsset } from "../domain/asset.js";
import {
  createStoredFilename,
  detectImageDimensions,
  inferAssetType,
  inferMimeType,
  isPathInsideRoot,
  isRangePreviewable,
  normalizeExtension,
  toForwardSlashes,
  validateExtensionForType
} from "./asset-file-utils.js";

export const maxAssetUploadBytes = 250 * 1024 * 1024;

function resolveAssetAbsolutePath(assetPath: string) {
  return resolve(projectRoot, assetPath);
}

function assertValidUploadFile(file: AssetUploadFile) {
  if (!file || typeof file.name !== "string" || file.size <= 0) {
    throw new ValidationError("file is required.");
  }

  if (file.size > maxAssetUploadBytes) {
    throw new PayloadTooLargeError(
      `Uploaded file exceeds the ${maxAssetUploadBytes} byte limit.`
    );
  }
}

export function createLocalAssetStorage(): AssetStorage {
  return {
    async storeUpload({ category, requestedType, file }) {
      assertValidUploadFile(file);

      const extension = normalizeExtension(file.name);

      if (!extension) {
        throw new ValidationError("Uploaded files must include an extension.");
      }

      const mimeType = inferMimeType(extension, file.type);
      const type = inferAssetType(requestedType, extension, mimeType, category);

      if (!type) {
        throw new ValidationError(
          "type is required when the uploaded file format cannot be inferred."
        );
      }

      validateExtensionForType(type, extension);

      const relativeDirectory = toForwardSlashes(
        join("storage", "assets", category.toLowerCase(), type.toLowerCase())
      );
      const absoluteDirectory = join(
        assetsStorageRoot,
        category.toLowerCase(),
        type.toLowerCase()
      );

      await mkdir(absoluteDirectory, { recursive: true });

      const filename = createStoredFilename(file.name, extension);
      const absolutePath = join(absoluteDirectory, filename);
      const buffer = Buffer.from(await file.arrayBuffer());
      const dimensions = detectImageDimensions(buffer, extension, mimeType);

      await writeFile(absolutePath, buffer);

      return {
        filename,
        path: `${relativeDirectory}/${filename}`,
        type,
        mimeType,
        extension,
        fileSize: buffer.byteLength,
        width: dimensions.width,
        height: dimensions.height
      };
    },

    async resolveMedia(asset: StudioAsset) {
      const absolutePath = resolveAssetAbsolutePath(asset.path);

      if (!isPathInsideRoot(absolutePath, assetsStorageRoot)) {
        return null;
      }

      try {
        const fileStats = await stat(absolutePath);

        if (!fileStats.isFile()) {
          return null;
        }

        const extension = asset.extension ?? normalizeExtension(asset.filename);
        const mimeType = asset.mimeType ?? inferMimeType(extension, "");

        return {
          absolutePath,
          mimeType,
          fileSize: fileStats.size,
          supportsRange: isRangePreviewable(mimeType)
        };
      } catch (error) {
        if (
          typeof error === "object" &&
          error !== null &&
          "code" in error &&
          error.code === "ENOENT"
        ) {
          return null;
        }

        throw error;
      }
    }
  };
}

