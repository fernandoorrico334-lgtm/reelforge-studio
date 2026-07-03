import {
  createMemoryId,
  createTimestamp,
  getMemoryStudioState
} from "../../../infrastructure/memory/studio-memory-store.js";
import type { AssetRepository } from "../application/asset-repository.js";
import {
  matchesAssetFilters,
  type AssetListFilters,
  type CreateAssetInput,
  type StudioAsset,
  type UpdateAssetInput
} from "../domain/asset.js";

function sortAssets(assets: StudioAsset[]) {
  return [...assets].sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt)
  );
}

function attachProfiles(asset: StudioAsset, state: ReturnType<typeof getMemoryStudioState>) {
  return {
    ...asset,
    musicProfile:
      state.musicAssetProfiles.find((profile) => profile.assetId === asset.id) ?? null,
    sfxProfile:
      state.sfxAssetProfiles.find((profile) => profile.assetId === asset.id) ?? null
  };
}

export function createInMemoryAssetRepository(): AssetRepository {
  const state = getMemoryStudioState();

  return {
    async list(filters: AssetListFilters = {}) {
      return sortAssets(
        state.assets
          .filter((asset) => matchesAssetFilters(asset, filters))
          .map((asset) => attachProfiles(asset, state))
      );
    },
    async getById(id) {
      const asset = state.assets.find((entry) => entry.id === id);
      return asset ? attachProfiles(asset, state) : null;
    },
    async create(input: CreateAssetInput) {
      const timestamp = createTimestamp();
      const asset: StudioAsset = {
        id: createMemoryId("asset"),
        createdAt: timestamp,
        updatedAt: timestamp,
        sourceProvider: input.sourceProvider ?? null,
        sourceUrl: input.sourceUrl ?? null,
        sourceAuthor: input.sourceAuthor ?? null,
        sourceLicense: input.sourceLicense ?? null,
        sourceLicenseUrl: input.sourceLicenseUrl ?? null,
        downloadedAt: input.downloadedAt ?? null,
        collectionId: input.collectionId ?? null,
        usageNotes: input.usageNotes ?? null,
        ...input
      };

      state.assets.unshift(asset);
      return attachProfiles(asset, state);
    },
    async update(id: string, input: UpdateAssetInput) {
      const assetIndex = state.assets.findIndex((asset) => asset.id === id);

      if (assetIndex === -1) {
        return null;
      }

      const existingAsset = state.assets[assetIndex];

      if (!existingAsset) {
        return null;
      }

      const updated: StudioAsset = {
        ...existingAsset,
        ...input,
        updatedAt: createTimestamp()
      };

      state.assets[assetIndex] = updated;
      return attachProfiles(updated, state);
    },
    async delete(id: string) {
      const assetIndex = state.assets.findIndex((asset) => asset.id === id);

      if (assetIndex === -1) {
        return false;
      }

      state.assets.splice(assetIndex, 1);
      state.scenes = state.scenes.map((scene) =>
        scene.assetId === id
          ? {
              ...scene,
              assetId: null,
              updatedAt: createTimestamp()
            }
          : scene
      );

      return true;
    }
  };
}

