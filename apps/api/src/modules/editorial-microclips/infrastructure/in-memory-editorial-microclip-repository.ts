import {
  createMemoryId,
  createTimestamp,
  getMemoryStudioState
} from "../../../infrastructure/memory/studio-memory-store.js";
import type { EditorialMicroclipRepository } from "../application/editorial-microclip-repository.js";
import type {
  CreateEditorialMicroclipInput,
  EditorialMicroclip,
  UpdateEditorialMicroclipInput
} from "../domain/editorial-microclip.js";

export function createEditorialMicroclipRepository(): EditorialMicroclipRepository {
  const state = getMemoryStudioState();

  function mapMicroclip(id: string): EditorialMicroclip | null {
    const clip = state.editorialMicroclips.find((entry) => entry.id === id);

    if (!clip) {
      return null;
    }

    return {
      ...clip,
      asset: state.assets.find((asset) => asset.id === clip.assetId) ?? null,
      metadata: clip.metadata
        ? (JSON.parse(clip.metadata) as Record<string, unknown>)
        : null
    };
  }

  return {
    async listByProjectId(projectId) {
      return state.editorialMicroclips
        .filter((clip) => clip.projectId === projectId)
        .sort((left, right) => left.orderIndex - right.orderIndex)
        .map((clip) => mapMicroclip(clip.id))
        .filter((clip): clip is EditorialMicroclip => clip !== null);
    },
    async getById(id) {
      return mapMicroclip(id);
    },
    async create(input: CreateEditorialMicroclipInput) {
      const timestamp = createTimestamp();
      const clip = {
        id: createMemoryId("microclip"),
        createdAt: timestamp,
        updatedAt: timestamp,
        ...input,
        metadata: input.metadata ? JSON.stringify(input.metadata) : null
      };

      state.editorialMicroclips.push(clip);
      return mapMicroclip(clip.id) as EditorialMicroclip;
    },
    async update(id: string, input: UpdateEditorialMicroclipInput) {
      const index = state.editorialMicroclips.findIndex((clip) => clip.id === id);

      if (index === -1) {
        return null;
      }

      const existing = state.editorialMicroclips[index];

      if (!existing) {
        return null;
      }

      state.editorialMicroclips[index] = {
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

      return mapMicroclip(id);
    },
    async delete(id: string) {
      const index = state.editorialMicroclips.findIndex((clip) => clip.id === id);

      if (index === -1) {
        return false;
      }

      state.editorialMicroclips.splice(index, 1);
      return true;
    },
    async countByProjectId(projectId: string) {
      return state.editorialMicroclips.filter((clip) => clip.projectId === projectId)
        .length;
    }
  };
}
