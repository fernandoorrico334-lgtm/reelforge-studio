import type { Prisma } from "@prisma/client";
import { prisma } from "../../../infrastructure/database/prisma-client.js";
import type { RenderJobRepository } from "../application/render-job-repository.js";
import {
  buildRenderMediaLinks,
  defaultRenderMode,
  defaultRenderQuality,
  normalizeOptionalAttempt,
  normalizeOptionalIndex,
  normalizeOptionalPositiveNumber,
  normalizeOptionalProgress,
  normalizeOptionalRenderMode,
  normalizeOptionalRenderQuality,
  normalizeOptionalRenderJobStep,
  normalizeOptionalString,
  type CreateRenderJobInput,
  type StudioRenderJob,
  type UpdateRenderJobInput
} from "../domain/render-job.js";

const renderJobInclude = {
  videoProject: {
    select: {
      id: true,
      title: true,
      status: true,
      channelId: true,
      format: true
    }
  }
} satisfies Prisma.RenderJobInclude;

type RenderJobRecord = Prisma.RenderJobGetPayload<{
  include: typeof renderJobInclude;
}>;

function mapRenderJob(record: RenderJobRecord): StudioRenderJob {
  return {
    id: record.id,
    videoProjectId: record.videoProjectId,
    status: record.status,
    renderMode: record.renderMode ?? defaultRenderMode,
    renderQuality: record.renderQuality ?? defaultRenderQuality,
    outputPath: record.outputPath,
    blueprintPath: record.blueprintPath,
    srtPath: record.srtPath,
    assPath: record.assPath,
    logPath: record.logPath,
    errorMessage: record.errorMessage,
    progress: record.progress,
    currentStep: record.currentStep as StudioRenderJob["currentStep"],
    currentSceneIndex: record.currentSceneIndex,
    totalScenes: record.totalScenes,
    outputWidth: record.outputWidth,
    outputHeight: record.outputHeight,
    outputDuration: record.outputDuration,
    outputCodec: record.outputCodec,
    hasAudio: record.hasAudio,
    audioCodec: record.audioCodec,
    audioChannels: record.audioChannels,
    audioSampleRate: record.audioSampleRate,
    outputFileSize: record.outputFileSize,
    thumbnailPath: record.thumbnailPath,
    cancelledAt: record.cancelledAt?.toISOString() ?? null,
    retriedFromJobId: record.retriedFromJobId,
    attempt: record.attempt,
    startedAt: record.startedAt?.toISOString() ?? null,
    completedAt: record.completedAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    ...buildRenderMediaLinks(record.id, {
      hasOutput: Boolean(record.outputPath),
      hasLog: Boolean(record.logPath),
      hasThumbnail: Boolean(record.thumbnailPath)
    }),
    videoProject: {
      id: record.videoProject.id,
      title: record.videoProject.title,
      status: record.videoProject.status,
      channelId: record.videoProject.channelId,
      format: record.videoProject.format
    }
  };
}

function serializeCreateInput(
  input: CreateRenderJobInput
): Prisma.RenderJobCreateInput {
  const attempt = normalizeOptionalAttempt(input.attempt) ?? 1;

  return {
    videoProject: {
      connect: {
        id: input.videoProjectId
      }
    },
    status: "queued",
    renderMode:
      normalizeOptionalRenderMode(input.renderMode) ?? defaultRenderMode,
    renderQuality:
      normalizeOptionalRenderQuality(input.renderQuality) ?? defaultRenderQuality,
    progress: 0,
    attempt,
    retriedFromJobId: normalizeOptionalString(
      input.retriedFromJobId,
      "retriedFromJobId"
    ) ?? null
  };
}

function serializeUpdateInput(input: UpdateRenderJobInput): Prisma.RenderJobUpdateInput {
  const updateData: Prisma.RenderJobUpdateInput = {};

  if ("status" in input) {
    updateData.status = input.status;
  }

  if ("renderMode" in input) {
    const renderMode = normalizeOptionalRenderMode(input.renderMode);

    if (renderMode !== undefined) {
      updateData.renderMode = renderMode;
    }
  }

  if ("renderQuality" in input) {
    const renderQuality = normalizeOptionalRenderQuality(input.renderQuality);

    if (renderQuality !== undefined) {
      updateData.renderQuality = renderQuality;
    }
  }

  if ("outputPath" in input) {
    const outputPath = normalizeOptionalString(input.outputPath, "outputPath");

    if (outputPath !== undefined) {
      updateData.outputPath = outputPath;
    }
  }

  if ("blueprintPath" in input) {
    const blueprintPath = normalizeOptionalString(
      input.blueprintPath,
      "blueprintPath"
    );

    if (blueprintPath !== undefined) {
      updateData.blueprintPath = blueprintPath;
    }
  }

  if ("srtPath" in input) {
    const srtPath = normalizeOptionalString(input.srtPath, "srtPath");

    if (srtPath !== undefined) {
      updateData.srtPath = srtPath;
    }
  }

  if ("assPath" in input) {
    const assPath = normalizeOptionalString(input.assPath, "assPath");

    if (assPath !== undefined) {
      updateData.assPath = assPath;
    }
  }

  if ("logPath" in input) {
    const logPath = normalizeOptionalString(input.logPath, "logPath");

    if (logPath !== undefined) {
      updateData.logPath = logPath;
    }
  }

  if ("errorMessage" in input) {
    const errorMessage = normalizeOptionalString(
      input.errorMessage,
      "errorMessage"
    );

    if (errorMessage !== undefined) {
      updateData.errorMessage = errorMessage;
    }
  }

  if ("progress" in input) {
    const progress = normalizeOptionalProgress(input.progress);

    if (progress !== undefined) {
      updateData.progress = progress;
    }
  }

  if ("currentStep" in input) {
    const currentStep = normalizeOptionalRenderJobStep(input.currentStep);

    if (currentStep !== undefined) {
      updateData.currentStep = currentStep;
    }
  }

  if ("currentSceneIndex" in input) {
    const currentSceneIndex = normalizeOptionalIndex(
      input.currentSceneIndex,
      "currentSceneIndex"
    );

    if (currentSceneIndex !== undefined) {
      updateData.currentSceneIndex = currentSceneIndex;
    }
  }

  if ("totalScenes" in input) {
    const totalScenes = normalizeOptionalIndex(input.totalScenes, "totalScenes");

    if (totalScenes !== undefined) {
      updateData.totalScenes = totalScenes;
    }
  }

  if ("outputWidth" in input) {
    const outputWidth = normalizeOptionalIndex(input.outputWidth, "outputWidth");

    if (outputWidth !== undefined) {
      updateData.outputWidth = outputWidth;
    }
  }

  if ("outputHeight" in input) {
    const outputHeight = normalizeOptionalIndex(
      input.outputHeight,
      "outputHeight"
    );

    if (outputHeight !== undefined) {
      updateData.outputHeight = outputHeight;
    }
  }

  if ("outputDuration" in input) {
    const outputDuration = normalizeOptionalPositiveNumber(
      input.outputDuration,
      "outputDuration"
    );

    if (outputDuration !== undefined) {
      updateData.outputDuration = outputDuration;
    }
  }

  if ("outputCodec" in input) {
    const outputCodec = normalizeOptionalString(input.outputCodec, "outputCodec");

    if (outputCodec !== undefined) {
      updateData.outputCodec = outputCodec;
    }
  }

  if ("hasAudio" in input) {
    updateData.hasAudio = input.hasAudio ?? null;
  }

  if ("audioCodec" in input) {
    const audioCodec = normalizeOptionalString(input.audioCodec, "audioCodec");

    if (audioCodec !== undefined) {
      updateData.audioCodec = audioCodec;
    }
  }

  if ("audioChannels" in input) {
    const audioChannels = normalizeOptionalIndex(
      input.audioChannels,
      "audioChannels"
    );

    if (audioChannels !== undefined) {
      updateData.audioChannels = audioChannels;
    }
  }

  if ("audioSampleRate" in input) {
    const audioSampleRate = normalizeOptionalIndex(
      input.audioSampleRate,
      "audioSampleRate"
    );

    if (audioSampleRate !== undefined) {
      updateData.audioSampleRate = audioSampleRate;
    }
  }

  if ("outputFileSize" in input) {
    const outputFileSize = normalizeOptionalIndex(
      input.outputFileSize,
      "outputFileSize"
    );

    if (outputFileSize !== undefined) {
      updateData.outputFileSize = outputFileSize;
    }
  }

  if ("thumbnailPath" in input) {
    const thumbnailPath = normalizeOptionalString(
      input.thumbnailPath,
      "thumbnailPath"
    );

    if (thumbnailPath !== undefined) {
      updateData.thumbnailPath = thumbnailPath;
    }
  }

  if ("cancelledAt" in input) {
    updateData.cancelledAt = input.cancelledAt ? new Date(input.cancelledAt) : null;
  }

  if ("retriedFromJobId" in input) {
    const retriedFromJobId = normalizeOptionalString(
      input.retriedFromJobId,
      "retriedFromJobId"
    );

    if (retriedFromJobId !== undefined) {
      updateData.retriedFromJobId = retriedFromJobId;
    }
  }

  if ("attempt" in input) {
    const attempt = normalizeOptionalAttempt(input.attempt);

    if (attempt !== undefined) {
      updateData.attempt = attempt;
    }
  }

  if ("startedAt" in input) {
    updateData.startedAt = input.startedAt ? new Date(input.startedAt) : null;
  }

  if ("completedAt" in input) {
    updateData.completedAt = input.completedAt
      ? new Date(input.completedAt)
      : null;
  }

  return updateData;
}

export function createPrismaRenderJobRepository(): RenderJobRepository {
  return {
    async list() {
      const renderJobs = await prisma.renderJob.findMany({
        include: renderJobInclude,
        orderBy: {
          createdAt: "desc"
        }
      });

      return renderJobs.map(mapRenderJob);
    },

    async listByProjectId(videoProjectId) {
      const renderJobs = await prisma.renderJob.findMany({
        where: {
          videoProjectId
        },
        include: renderJobInclude,
        orderBy: {
          createdAt: "desc"
        }
      });

      return renderJobs.map(mapRenderJob);
    },

    async getById(id) {
      const renderJob = await prisma.renderJob.findUnique({
        where: {
          id
        },
        include: renderJobInclude
      });

      return renderJob ? mapRenderJob(renderJob) : null;
    },

    async createQueued(input) {
      const renderJob = await prisma.renderJob.create({
        data: serializeCreateInput(input),
        include: renderJobInclude
      });

      return mapRenderJob(renderJob);
    },

    async update(id, input) {
      try {
        const renderJob = await prisma.renderJob.update({
          where: {
            id
          },
          data: serializeUpdateInput(input),
          include: renderJobInclude
        });

        return mapRenderJob(renderJob);
      } catch (error) {
        if (
          typeof error === "object" &&
          error !== null &&
          "code" in error &&
          error.code === "P2025"
        ) {
          return null;
        }

        throw error;
      }
    },

    async delete(id) {
      try {
        await prisma.renderJob.delete({
          where: {
            id
          }
        });
        return true;
      } catch (error) {
        if (
          typeof error === "object" &&
          error !== null &&
          "code" in error &&
          error.code === "P2025"
        ) {
          return false;
        }

        throw error;
      }
    },

    async count() {
      return prisma.renderJob.count();
    }
  };
}

