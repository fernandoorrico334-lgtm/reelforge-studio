import {
  createMemoryId,
  createTimestamp,
  getMemoryStudioState
} from "../../../infrastructure/memory/studio-memory-store.js";
import { summarizeVisualGenerationJob } from "@reelforge/hybrid-visual-engine";
import type { VisualGenerationJobRepository } from "../application/visual-generation-job-repository.js";
import type {
  CreateVisualGenerationJobInput,
  UpdateVisualGenerationJobInput,
  VisualGenerationJob,
  VisualGenerationJobFilters
} from "../domain/visual-generation.js";

function sortByCreatedAtDesc<T extends { createdAt: string }>(items: T[]) {
  return [...items].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export function createInMemoryVisualGenerationJobRepository(): VisualGenerationJobRepository {
  const state = getMemoryStudioState();

  function mapJob(jobId: string): VisualGenerationJob | null {
    const job = state.visualGenerationJobs.find((entry) => entry.id === jobId);

    if (!job) {
      return null;
    }

    const characterProfile = job.characterProfileId
      ? state.characterProfiles.find((entry) => entry.id === job.characterProfileId) ?? null
      : null;
    const generatedAsset = job.generatedAssetId
      ? state.assets.find((entry) => entry.id === job.generatedAssetId) ?? null
      : null;

    return {
      ...job,
      status: job.status as VisualGenerationJob["status"],
      provider: job.provider as VisualGenerationJob["provider"],
      visualSourceMode: job.visualSourceMode as VisualGenerationJob["visualSourceMode"],
      characterProfile: characterProfile
        ? {
            ...characterProfile,
            tags: [...characterProfile.tags],
            references: []
          }
        : null,
      generatedAsset,
      metadata: job.metadata ? (JSON.parse(job.metadata) as Record<string, unknown>) : null,
      summary: summarizeVisualGenerationJob({
        id: job.id,
        sceneId: job.sceneId,
        videoProjectId: job.videoProjectId,
        characterProfileId: job.characterProfileId,
        status: job.status as VisualGenerationJob["status"],
        provider: job.provider as VisualGenerationJob["provider"],
        visualSourceMode: job.visualSourceMode,
        stylePreset: job.stylePreset,
        generatedAssetId: job.generatedAssetId,
        outputPath: job.outputPath,
        errorMessage: job.errorMessage
      })
    };
  }

  return {
    async list(filters: VisualGenerationJobFilters = {}) {
      return sortByCreatedAtDesc(
        state.visualGenerationJobs
          .filter((job) => {
            if (filters.videoProjectId && job.videoProjectId !== filters.videoProjectId) {
              return false;
            }

            if (filters.sceneId && job.sceneId !== filters.sceneId) {
              return false;
            }

            if (
              filters.researchAssetRequirementId &&
              job.researchAssetRequirementId !== filters.researchAssetRequirementId
            ) {
              return false;
            }

            if (
              filters.characterProfileId &&
              job.characterProfileId !== filters.characterProfileId
            ) {
              return false;
            }

            if (filters.status && job.status !== filters.status) {
              return false;
            }

            return true;
          })
          .map((job) => mapJob(job.id))
          .filter((job): job is VisualGenerationJob => job !== null)
      );
    },
    async getById(id: string) {
      return mapJob(id);
    },
    async create(input: CreateVisualGenerationJobInput) {
      const timestamp = createTimestamp();
      const job = {
        id: createMemoryId("visual-job"),
        videoProjectId: input.videoProjectId,
        sceneId: input.sceneId,
        characterProfileId: input.characterProfileId,
        researchAssetRequirementId: input.researchAssetRequirementId,
        status: input.status,
        provider: input.provider,
        visualSourceMode: input.visualSourceMode,
        prompt: input.prompt,
        negativePrompt: input.negativePrompt,
        stylePreset: input.stylePreset,
        seed: input.seed,
        width: input.width,
        height: input.height,
        outputPath: input.outputPath,
        generatedAssetId: input.generatedAssetId,
        errorMessage: input.errorMessage,
        metadata: input.metadata ? JSON.stringify(input.metadata) : null,
        createdAt: timestamp,
        updatedAt: timestamp,
        startedAt: input.startedAt,
        completedAt: input.completedAt
      };

      state.visualGenerationJobs.unshift(job);
      return mapJob(job.id) as VisualGenerationJob;
    },
    async update(id: string, input: UpdateVisualGenerationJobInput) {
      const index = state.visualGenerationJobs.findIndex((entry) => entry.id === id);

      if (index === -1) {
        return null;
      }

      const existing = state.visualGenerationJobs[index];

      if (!existing) {
        return null;
      }

      state.visualGenerationJobs[index] = {
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