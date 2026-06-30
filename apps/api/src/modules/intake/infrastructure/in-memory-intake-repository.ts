import {
  createMemoryId,
  createTimestamp,
  getMemoryStudioState
} from "../../../infrastructure/memory/studio-memory-store.js";
import type { IntakeRepository } from "../application/intake-repository.js";
import type {
  CreateMediaCandidateInput,
  CreateMediaCollectionInput,
  MediaCandidate,
  MediaCandidateListFilters,
  MediaCollectionListFilters,
  MediaCollection,
  UpdateMediaCandidateInput,
  UpdateMediaCollectionInput
} from "../domain/intake.js";

function sortCollections(collections: MediaCollection[]) {
  return [...collections].sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt)
  );
}

function sortCandidates(candidates: MediaCandidate[]) {
  return [...candidates].sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt)
  );
}

function matchesCollectionFilters(
  collection: MediaCollection,
  filters: MediaCollectionListFilters
) {
  if (filters.channelId && collection.channelId !== filters.channelId) {
    return false;
  }

  if (filters.projectId && collection.projectId !== filters.projectId) {
    return false;
  }

  if (filters.dossierId && collection.dossierId !== filters.dossierId) {
    return false;
  }

  if (
    filters.assetRequirementId &&
    collection.assetRequirementId !== filters.assetRequirementId
  ) {
    return false;
  }

  if (filters.provider && collection.provider !== filters.provider) {
    return false;
  }

  return true;
}

function hydrateCollection(
  state: ReturnType<typeof getMemoryStudioState>,
  collection: MediaCollection
): MediaCollection {
  const candidates = state.mediaCandidates.filter(
    (candidate) => candidate.collectionId === collection.id
  );

  return {
    ...collection,
    candidateCount: candidates.length,
    pendingCount: candidates.filter((candidate) => candidate.status === "pending").length,
    approvedCount: candidates.filter((candidate) => candidate.status === "approved").length,
    failedCount: candidates.filter((candidate) => candidate.status === "failed").length
  };
}

function matchesCandidateFilters(
  candidate: MediaCandidate,
  filters: MediaCandidateListFilters
) {
  if (filters.collectionId && candidate.collectionId !== filters.collectionId) {
    return false;
  }

  if (filters.status && candidate.status !== filters.status) {
    return false;
  }

  if (filters.provider && candidate.provider !== filters.provider) {
    return false;
  }

  if (filters.mediaType && candidate.mediaType !== filters.mediaType) {
    return false;
  }

  if (filters.category && candidate.category !== filters.category) {
    return false;
  }

  if (filters.character && candidate.character !== filters.character) {
    return false;
  }

  if (
    filters.suggestedProject &&
    candidate.suggestedProject !== filters.suggestedProject
  ) {
    return false;
  }

  return true;
}

export function createInMemoryIntakeRepository(): IntakeRepository {
  const state = getMemoryStudioState();

  return {
    async listCollections(filters: MediaCollectionListFilters = {}) {
      return sortCollections(
        state.mediaCollections
          .filter((collection) => matchesCollectionFilters(collection, filters))
          .map((collection) => hydrateCollection(state, collection))
      );
    },
    async getCollectionById(id) {
      const collection = state.mediaCollections.find((entry) => entry.id === id);
      return collection ? hydrateCollection(state, collection) : null;
    },
    async createCollection(input: CreateMediaCollectionInput) {
      const timestamp = createTimestamp();
      const collection: MediaCollection = {
        id: createMemoryId("collection"),
        createdAt: timestamp,
        updatedAt: timestamp,
        candidateCount: 0,
        pendingCount: 0,
        approvedCount: 0,
        failedCount: 0,
        ...input
      };

      state.mediaCollections.unshift(collection);
      return hydrateCollection(state, collection);
    },
    async updateCollection(id, input: UpdateMediaCollectionInput) {
      const index = state.mediaCollections.findIndex((entry) => entry.id === id);

      if (index === -1) {
        return null;
      }

      const existing = state.mediaCollections[index];

      if (!existing) {
        return null;
      }

      const updated: MediaCollection = {
        ...existing,
        ...input,
        updatedAt: createTimestamp()
      };

      state.mediaCollections[index] = updated;
      return hydrateCollection(state, updated);
    },
    async listCandidates(filters: MediaCandidateListFilters = {}) {
      return sortCandidates(
        state.mediaCandidates.filter((candidate) =>
          matchesCandidateFilters(candidate, filters)
        )
      );
    },
    async getCandidateById(id) {
      return state.mediaCandidates.find((candidate) => candidate.id === id) ?? null;
    },
    async createCandidate(input: CreateMediaCandidateInput) {
      const timestamp = createTimestamp();
      const candidate: MediaCandidate = {
        id: createMemoryId("candidate"),
        createdAt: timestamp,
        updatedAt: timestamp,
        ...input
      };

      state.mediaCandidates.unshift(candidate);
      return candidate;
    },
    async updateCandidate(id, input: UpdateMediaCandidateInput) {
      const index = state.mediaCandidates.findIndex((entry) => entry.id === id);

      if (index === -1) {
        return null;
      }

      const existing = state.mediaCandidates[index];

      if (!existing) {
        return null;
      }

      const updated: MediaCandidate = {
        ...existing,
        ...input,
        updatedAt: createTimestamp()
      };

      state.mediaCandidates[index] = updated;
      return updated;
    }
  };
}

