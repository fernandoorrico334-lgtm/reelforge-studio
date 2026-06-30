import type {
  AssetListFilters,
  CreateAssetInput,
  StudioAsset,
  UpdateAssetInput
} from "../domain/asset.js";

export interface AssetRepository {
  list(filters?: AssetListFilters): Promise<StudioAsset[]>;
  getById(id: string): Promise<StudioAsset | null>;
  create(input: CreateAssetInput): Promise<StudioAsset>;
  update(id: string, input: UpdateAssetInput): Promise<StudioAsset | null>;
  delete(id: string): Promise<boolean>;
}

