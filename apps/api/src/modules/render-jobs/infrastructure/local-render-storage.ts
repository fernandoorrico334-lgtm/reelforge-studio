import { mkdir, stat, writeFile } from "node:fs/promises";
import { extname } from "node:path";
import {
  createRenderJobPaths,
  resolveStoragePath
} from "@reelforge/video-engine/render-server";
import { projectRoot, rendersStorageRoot } from "../../../config/paths.js";
import type {
  PreparedRenderPaths,
  RenderStorage
} from "../application/render-storage.js";
import type { StudioRenderJob } from "../domain/render-job.js";

const mimeTypesByExtension: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".json": "application/json",
  ".log": "text/plain; charset=utf-8",
  ".mp4": "video/mp4",
  ".srt": "application/x-subrip",
  ".ass": "text/plain; charset=utf-8"
};

function normalizeExtension(filename: string) {
  return extname(filename).trim().toLowerCase();
}

function inferMimeType(filePath: string) {
  return mimeTypesByExtension[normalizeExtension(filePath)] ?? "application/octet-stream";
}

function isRangePreviewable(mimeType: string) {
  return mimeType.startsWith("video/") || mimeType.startsWith("audio/");
}

async function resolveLocalMedia(relativePath: string | null) {
  if (!relativePath) {
    return null;
  }

  try {
    const absolutePath = resolveStoragePath(projectRoot, relativePath);
    const fileStats = await stat(absolutePath);

    if (!fileStats.isFile()) {
      return null;
    }

    const mimeType = inferMimeType(relativePath);

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

export function createLocalRenderStorage(): RenderStorage {
  return {
    async saveBlueprint(videoProjectId, renderJobId, blueprint) {
      const jobPaths = createRenderJobPaths(
        rendersStorageRoot,
        videoProjectId,
        renderJobId
      );

      await mkdir(jobPaths.jobRoot, { recursive: true });
      await mkdir(jobPaths.workDir, { recursive: true });
      await writeFile(
        jobPaths.blueprintPath,
        JSON.stringify(blueprint, null, 2),
        "utf8"
      );

      const preparedPaths: PreparedRenderPaths = {
        outputPath: `storage/renders/${videoProjectId}/${renderJobId}/output.mp4`,
        thumbnailPath: `storage/renders/${videoProjectId}/${renderJobId}/thumbnail.jpg`,
        blueprintPath: `storage/renders/${videoProjectId}/${renderJobId}/blueprint.json`,
        srtPath: `storage/renders/${videoProjectId}/${renderJobId}/captions.srt`,
        assPath: `storage/renders/${videoProjectId}/${renderJobId}/captions.ass`,
        logPath: `storage/renders/${videoProjectId}/${renderJobId}/render.log`
      };

      return preparedPaths;
    },

    async resolveOutputMedia(renderJob: StudioRenderJob) {
      return resolveLocalMedia(renderJob.outputPath);
    },

    async resolveLogMedia(renderJob: StudioRenderJob) {
      return resolveLocalMedia(renderJob.logPath);
    },

    async resolveThumbnailMedia(renderJob: StudioRenderJob) {
      return resolveLocalMedia(renderJob.thumbnailPath);
    }
  };
}

