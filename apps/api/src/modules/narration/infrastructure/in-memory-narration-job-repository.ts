import { summarizeNarrationJob } from "@reelforge/narration-engine";
import {
  createMemoryId,
  createTimestamp,
  getMemoryStudioState
} from "../../../infrastructure/memory/studio-memory-store.js";
import type { NarrationJobRepository } from "../application/narration-job-repository.js";
import type {
  CreateNarrationJobInput,
  NarrationJob,
  NarrationJobFilters,
  UpdateNarrationJobInput
} from "../domain/narration.js";

function sortByCreatedAtDesc<T extends { createdAt: string }>(items: T[]) {
  return [...items].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export function createInMemoryNarrationJobRepository(): NarrationJobRepository {
  const state = getMemoryStudioState();

  function mapJob(jobId: string): NarrationJob | null {
    const job = state.narrationJobs.find((entry) => entry.id === jobId);

    if (!job) {
      return null;
    }

    const generatedAsset = job.generatedAssetId
      ? state.assets.find((asset) => asset.id === job.generatedAssetId) ?? null
      : null;

    return {
      ...job,
      provider: job.provider as NarrationJob["provider"],
      status: job.status as NarrationJob["status"],
      generatedAsset,
      metadata: job.metadata ? (JSON.parse(job.metadata) as Record<string, unknown>) : null,
      summary: summarizeNarrationJob({
        id: job.id,
        sceneId: job.sceneId,
        videoProjectId: job.videoProjectId,
        provider: job.provider,
        voicePackId: job.voicePackId,
        status: job.status ?? "draft",
        generatedAssetId: job.generatedAssetId,
        outputPath: job.outputPath,
        errorMessage: job.errorMessage
      })
    };
  }

  return {
    async list(filters: NarrationJobFilters = {}) {
      return sortByCreatedAtDesc(
        state.narrationJobs
          .filter((job) => {
            if (filters.videoProjectId && job.videoProjectId !== filters.videoProjectId) {
              return false;
            }

            if (filters.sceneId && job.sceneId !== filters.sceneId) {
              return false;
            }

            if (filters.provider && job.provider !== filters.provider) {
              return false;
            }

            if (filters.voicePackId && job.voicePackId !== filters.voicePackId) {
              return false;
            }

            if (filters.status && job.status !== filters.status) {
              return false;
            }

            return true;
          })
          .map((job) => mapJob(job.id))
          .filter((job): job is NarrationJob => job !== null)
      );
    },
    async getById(id: string) {
      return mapJob(id);
    },
    async create(input: CreateNarrationJobInput) {
      const timestamp = createTimestamp();
      const job = {
        id: createMemoryId("narration-job"),
        videoProjectId: input.videoProjectId,
        sceneId: input.sceneId,
        provider: input.provider,
        voicePackId: input.voicePackId,
        language: input.language,
        status: input.status,
        text: input.text,
        outputPath: input.outputPath,
        generatedAssetId: input.generatedAssetId,
        durationSeconds: input.durationSeconds,
        sampleRate: input.sampleRate,
        errorMessage: input.errorMessage,
        metadata: input.metadata ? JSON.stringify(input.metadata) : null,
        startedAt: input.startedAt,
        completedAt: input.completedAt,
        createdAt: timestamp,
        updatedAt: timestamp
      };

      state.narrationJobs.unshift(job);
      return mapJob(job.id) as NarrationJob;
    },
    async update(id: string, input: UpdateNarrationJobInput) {
      const index = state.narrationJobs.findIndex((entry) => entry.id === id);

      if (index === -1) {
        return null;
      }

      const existing = state.narrationJobs[index];

      if (!existing) {
        return null;
      }

      state.narrationJobs[index] = {
        ...existing,
        ...input,
        metadata:
          "metadata" in input
            ? input.metadata
              ? JSON.stringify(input.metadata)
              : null
            : existing.metadata,
        updatedAt: createTimestamp()
      };

      return mapJob(id);
    }
  };
}
