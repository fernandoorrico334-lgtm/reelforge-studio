import {
  createMemoryId,
  createTimestamp,
  getMemoryStudioState
} from "../../../infrastructure/memory/studio-memory-store.js";
import type { RenderJobRepository } from "../application/render-job-repository.js";
import {
  buildRenderMediaLinks,
  normalizeOptionalAudioMasteringPresetId,
  type CreateRenderJobInput,
  type RenderJobProjectSummary,
  type RenderJobMetadata,
  type StudioRenderJob
} from "../domain/render-job.js";

function sortRenderJobsByDate(renderJobs: StudioRenderJob[]) {
  return [...renderJobs].sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt)
  );
}

function mapProjectSummary(videoProjectId: string): RenderJobProjectSummary | null {
  const state = getMemoryStudioState();
  const project = state.videoProjects.find((entry) => entry.id === videoProjectId);

  if (!project) {
    return null;
  }

  return {
    id: project.id,
    title: project.title,
    status: project.status,
    channelId: project.channelId,
    format: project.format
  };
}

function toStudioRenderJob(
  record: ReturnType<typeof getMemoryStudioState>["renderJobs"][number]
): StudioRenderJob | null {
  const projectSummary = mapProjectSummary(record.videoProjectId);

  if (!projectSummary) {
    return null;
  }

  let metadata: RenderJobMetadata | null = null;

  if (record.metadata) {
    try {
      const parsed = JSON.parse(record.metadata) as Record<string, unknown>;
      const audioMasteringPresetId = normalizeOptionalAudioMasteringPresetId(
        parsed.audioMasteringPresetId
      );

      if (audioMasteringPresetId) {
        const audioQualityReport =
          "audioQualityReport" in parsed
            ? (parsed.audioQualityReport as RenderJobMetadata["audioQualityReport"])
            : undefined;

        metadata =
          audioQualityReport === undefined
            ? {
                audioMasteringPresetId
              }
            : {
                audioMasteringPresetId,
                audioQualityReport
              };
      }
    } catch {
      metadata = null;
    }
  }

  return {
    ...record,
    currentStep: record.currentStep as StudioRenderJob["currentStep"],
    audioMasteringPresetId: metadata?.audioMasteringPresetId ?? null,
    metadata,
    ...buildRenderMediaLinks(record.id, {
      hasOutput: Boolean(record.outputPath),
      hasLog: Boolean(record.logPath),
      hasThumbnail: Boolean(record.thumbnailPath)
    }),
    videoProject: projectSummary
  };
}

function parseRecordMetadata(value: string | null) {
  if (!value) {
    return {};
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

export function createRenderJobRepository(): RenderJobRepository {
  return {
    async list() {
      return sortRenderJobsByDate(
        getMemoryStudioState()
          .renderJobs.map(toStudioRenderJob)
          .filter((renderJob): renderJob is StudioRenderJob => renderJob !== null)
      );
    },

    async listByProjectId(videoProjectId) {
      return sortRenderJobsByDate(
        getMemoryStudioState()
          .renderJobs.filter((renderJob) => renderJob.videoProjectId === videoProjectId)
          .map(toStudioRenderJob)
          .filter((renderJob): renderJob is StudioRenderJob => renderJob !== null)
      );
    },

    async getById(id) {
      const record = getMemoryStudioState().renderJobs.find((entry) => entry.id === id);
      return record ? toStudioRenderJob(record) : null;
    },

    async createQueued(input: CreateRenderJobInput) {
      const timestamp = createTimestamp();
      const record = {
        id: createMemoryId("render-job"),
        videoProjectId: input.videoProjectId,
        status: "queued" as const,
        renderMode: input.renderMode ?? "v1",
        renderQuality: input.renderQuality ?? "standard",
        metadata:
          input.metadata
            ? JSON.stringify(input.metadata)
            : input.audioMasteringPresetId
              ? JSON.stringify({
                  audioMasteringPresetId: input.audioMasteringPresetId
                })
              : null,
        outputPath: null,
        blueprintPath: null,
        srtPath: null,
        assPath: null,
        logPath: null,
        errorMessage: null,
        progress: 0,
        currentStep: null,
        currentSceneIndex: null,
        totalScenes: null,
        outputWidth: null,
        outputHeight: null,
        outputDuration: null,
        outputCodec: null,
        hasAudio: null,
        audioCodec: null,
        audioChannels: null,
        audioSampleRate: null,
        outputFileSize: null,
        thumbnailPath: null,
        cancelledAt: null,
        retriedFromJobId: input.retriedFromJobId ?? null,
        attempt: input.attempt ?? 1,
        startedAt: null,
        completedAt: null,
        createdAt: timestamp,
        updatedAt: timestamp
      };

      getMemoryStudioState().renderJobs.push(record);

      const mapped = toStudioRenderJob(record);

      if (!mapped) {
        throw new Error(`Video project '${input.videoProjectId}' was not found.`);
      }

      return mapped;
    },

    async update(id, input) {
      const record = getMemoryStudioState().renderJobs.find((entry) => entry.id === id);

      if (!record) {
        return null;
      }

      const {
        metadata,
        audioMasteringPresetId,
        ...restInput
      } = input;
      let nextMetadata = record.metadata;

      if (metadata !== undefined) {
        nextMetadata = metadata ? JSON.stringify(metadata) : null;
      } else if (audioMasteringPresetId !== undefined) {
        nextMetadata = JSON.stringify({
          ...parseRecordMetadata(record.metadata),
          audioMasteringPresetId
        });
      }

      const nextRecord = {
        ...record,
        ...restInput,
        metadata: nextMetadata,
        updatedAt: createTimestamp()
      };
      const renderJobs = getMemoryStudioState().renderJobs;
      const index = renderJobs.findIndex((entry) => entry.id === id);

      if (index === -1) {
        return null;
      }

      renderJobs[index] = nextRecord;

      return toStudioRenderJob(nextRecord);
    },

    async delete(id) {
      const renderJobs = getMemoryStudioState().renderJobs;
      const index = renderJobs.findIndex((entry) => entry.id === id);

      if (index === -1) {
        return false;
      }

      renderJobs.splice(index, 1);
      return true;
    },

    async count() {
      return getMemoryStudioState().renderJobs.length;
    }
  };
}

