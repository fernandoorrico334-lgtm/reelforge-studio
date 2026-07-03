import type {
  MusicAssetProfile,
  SfxAssetProfile
} from "@reelforge/audio-engine";

export interface MusicProfileFilters {
  mood?: MusicAssetProfile["mood"];
  genre?: MusicAssetProfile["genre"];
  energy?: MusicAssetProfile["energy"];
  useCase?: MusicAssetProfile["useCase"];
  licenseStatus?: MusicAssetProfile["licenseStatus"];
  search?: string;
}

export interface SfxProfileFilters {
  category?: SfxAssetProfile["category"];
  intensity?: SfxAssetProfile["intensity"];
  useCase?: SfxAssetProfile["useCase"];
  licenseStatus?: SfxAssetProfile["licenseStatus"];
  search?: string;
}

export type UpsertMusicAssetProfileInput = Omit<
  MusicAssetProfile,
  "createdAt" | "updatedAt"
>;

export type UpsertSfxAssetProfileInput = Omit<
  SfxAssetProfile,
  "createdAt" | "updatedAt"
>;

export interface AudioLibraryRepository {
  listMusicProfiles(filters?: MusicProfileFilters): Promise<MusicAssetProfile[]>;
  getMusicProfileByAssetId(assetId: string): Promise<MusicAssetProfile | null>;
  upsertMusicProfile(
    input: UpsertMusicAssetProfileInput
  ): Promise<MusicAssetProfile>;
  listSfxProfiles(filters?: SfxProfileFilters): Promise<SfxAssetProfile[]>;
  getSfxProfileByAssetId(assetId: string): Promise<SfxAssetProfile | null>;
  upsertSfxProfile(input: UpsertSfxAssetProfileInput): Promise<SfxAssetProfile>;
}
