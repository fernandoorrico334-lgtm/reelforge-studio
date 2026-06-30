import { NotFoundError } from "../../../shared/errors.js";
import type {
  AssetListFilters,
  CreateAssetInput,
  UpdateAssetInput
} from "../domain/asset.js";
import type { AssetRepository } from "./asset-repository.js";

export async function listAssets(
  repository: AssetRepository,
  filters: AssetListFilters
) {
  return repository.list(filters);
}

export async function getAssetById(
  repository: AssetRepository,
  id: string
) {
  const asset = await repository.getById(id);

  if (!asset) {
    throw new NotFoundError(`Asset '${id}' was not found.`);
  }

  return asset;
}

export async function createAsset(
  repository: AssetRepository,
  input: CreateAssetInput
) {
  return repository.create(input);
}

export async function updateAsset(
  repository: AssetRepository,
  id: string,
  input: UpdateAssetInput
) {
  const asset = await repository.update(id, input);

  if (!asset) {
    throw new NotFoundError(`Asset '${id}' was not found.`);
  }

  return asset;
}

export async function deleteAsset(
  repository: AssetRepository,
  id: string
) {
  const deleted = await repository.delete(id);

  if (!deleted) {
    throw new NotFoundError(`Asset '${id}' was not found.`);
  }
}