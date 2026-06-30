import type {
  AssetCategory,
  AssetType,
  StudioAsset
} from "../domain/asset.js";

export interface AssetUploadFile {
  name: string;
  size: number;
  type: string;
  arrayBuffer(): Promise<ArrayBuffer>;
}

export interface StoreAssetUploadInput {
  category: AssetCategory;
  requestedType: AssetType | null;
  file: AssetUploadFile;
}

export interface StoredAssetFile {
  filename: string;
  path: string;
  type: AssetType;
  mimeType: string;
  extension: string;
  fileSize: number;
  width: number | null;
  height: number | null;
}

export interface ResolvedAssetMedia {
  absolutePath: string;
  mimeType: string;
  fileSize: number;
  supportsRange: boolean;
}

export interface AssetStorage {
  storeUpload(input: StoreAssetUploadInput): Promise<StoredAssetFile>;
  resolveMedia(asset: StudioAsset): Promise<ResolvedAssetMedia | null>;
}

