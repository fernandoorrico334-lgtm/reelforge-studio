import type {
  MusicAssetProfile,
  SfxAssetProfile
} from "@reelforge/audio-engine";
import {
  createTimestamp,
  getMemoryStudioState
} from "../../../infrastructure/memory/studio-memory-store.js";
import type {
  AudioLibraryRepository,
  MusicProfileFilters,
  SfxProfileFilters,
  UpsertMusicAssetProfileInput,
  UpsertSfxAssetProfileInput
} from "../application/audio-library-repository.js";

function matchesMusicFilters(
  profile: MusicAssetProfile,
  filters: MusicProfileFilters
) {
  if (filters.mood && profile.mood !== filters.mood) {
    return false;
  }

  if (filters.genre && profile.genre !== filters.genre) {
    return false;
  }

  if (filters.energy && profile.energy !== filters.energy) {
    return false;
  }

  if (filters.useCase && profile.useCase !== filters.useCase) {
    return false;
  }

  if (filters.licenseStatus && profile.licenseStatus !== filters.licenseStatus) {
    return false;
  }

  if (filters.search?.trim()) {
    const query = filters.search.toLowerCase();
    const haystack = [
      profile.title,
      profile.artist ?? "",
      profile.notes ?? "",
      profile.mood,
      profile.genre,
      profile.useCase
    ]
      .join(" ")
      .toLowerCase();

    if (!haystack.includes(query)) {
      return false;
    }
  }

  return true;
}

function matchesSfxFilters(profile: SfxAssetProfile, filters: SfxProfileFilters) {
  if (filters.category && profile.category !== filters.category) {
    return false;
  }

  if (filters.intensity && profile.intensity !== filters.intensity) {
    return false;
  }

  if (filters.useCase && profile.useCase !== filters.useCase) {
    return false;
  }

  if (filters.licenseStatus && profile.licenseStatus !== filters.licenseStatus) {
    return false;
  }

  if (filters.search?.trim()) {
    const query = filters.search.toLowerCase();
    const haystack = [
      profile.title,
      profile.notes ?? "",
      profile.category,
      profile.useCase
    ]
      .join(" ")
      .toLowerCase();

    if (!haystack.includes(query)) {
      return false;
    }
  }

  return true;
}

export function createInMemoryAudioLibraryRepository(): AudioLibraryRepository {
  const state = getMemoryStudioState();
  const compareUpdatedAtDesc = <
    T extends { updatedAt?: string; createdAt?: string; assetId: string }
  >(
    left: T,
    right: T
  ) =>
    (right.updatedAt ?? right.createdAt ?? right.assetId).localeCompare(
      left.updatedAt ?? left.createdAt ?? left.assetId
    );

  return {
    async listMusicProfiles(filters = {}) {
      return state.musicAssetProfiles
        .filter((profile) => matchesMusicFilters(profile, filters))
        .sort(compareUpdatedAtDesc);
    },
    async getMusicProfileByAssetId(assetId) {
      return state.musicAssetProfiles.find((profile) => profile.assetId === assetId) ?? null;
    },
    async upsertMusicProfile(input: UpsertMusicAssetProfileInput) {
      const timestamp = createTimestamp();
      const existingIndex = state.musicAssetProfiles.findIndex(
        (profile) => profile.assetId === input.assetId
      );
      const next: MusicAssetProfile = {
        ...input,
        createdAt:
          existingIndex >= 0
            ? (state.musicAssetProfiles[existingIndex]?.createdAt ?? timestamp)
            : timestamp,
        updatedAt: timestamp
      };

      if (existingIndex >= 0) {
        state.musicAssetProfiles[existingIndex] = next;
      } else {
        state.musicAssetProfiles.unshift(next);
      }

      return next;
    },
    async listSfxProfiles(filters = {}) {
      return state.sfxAssetProfiles
        .filter((profile) => matchesSfxFilters(profile, filters))
        .sort(compareUpdatedAtDesc);
    },
    async getSfxProfileByAssetId(assetId) {
      return state.sfxAssetProfiles.find((profile) => profile.assetId === assetId) ?? null;
    },
    async upsertSfxProfile(input: UpsertSfxAssetProfileInput) {
      const timestamp = createTimestamp();
      const existingIndex = state.sfxAssetProfiles.findIndex(
        (profile) => profile.assetId === input.assetId
      );
      const next: SfxAssetProfile = {
        ...input,
        createdAt:
          existingIndex >= 0
            ? (state.sfxAssetProfiles[existingIndex]?.createdAt ?? timestamp)
            : timestamp,
        updatedAt: timestamp
      };

      if (existingIndex >= 0) {
        state.sfxAssetProfiles[existingIndex] = next;
      } else {
        state.sfxAssetProfiles.unshift(next);
      }

      return next;
    }
  };
}
