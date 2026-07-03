import type {
  MusicAssetProfile,
  SfxAssetProfile
} from "@reelforge/audio-engine";
import { prisma as defaultPrisma } from "../../../infrastructure/database/prisma-client.js";
import type {
  AudioLibraryRepository,
  MusicProfileFilters,
  SfxProfileFilters,
  UpsertMusicAssetProfileInput,
  UpsertSfxAssetProfileInput
} from "../application/audio-library-repository.js";

interface PrismaAudioLibraryRepositoryOptions {
  prismaClient?: typeof defaultPrisma;
}

function toIsoString(value: Date) {
  return value.toISOString();
}

function parseJsonArray<T>(value: string, fallback: T[]) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as T[]) : fallback;
  } catch {
    return fallback;
  }
}

function mapMusicProfile(profile: {
  assetId: string;
  title: string;
  artist: string | null;
  sourceType: MusicAssetProfile["sourceType"];
  licenseStatus: MusicAssetProfile["licenseStatus"];
  mood: MusicAssetProfile["mood"];
  genre: MusicAssetProfile["genre"];
  bpm: number | null;
  bpmConfidence: number;
  energy: MusicAssetProfile["energy"];
  useCase: MusicAssetProfile["useCase"];
  durationSeconds: number | null;
  loudness: number | null;
  beatMarkers: string;
  energyTimeline: string;
  notes: string | null;
  safetyWarning: string | null;
  createdAt: Date;
  updatedAt: Date;
}): MusicAssetProfile {
  return {
    assetId: profile.assetId,
    title: profile.title,
    artist: profile.artist,
    sourceType: profile.sourceType,
    licenseStatus: profile.licenseStatus,
    mood: profile.mood,
    genre: profile.genre,
    bpm: profile.bpm,
    bpmConfidence: profile.bpmConfidence,
    energy: profile.energy,
    useCase: profile.useCase,
    durationSeconds: profile.durationSeconds,
    loudness: profile.loudness,
    beatMarkers: parseJsonArray(profile.beatMarkers, []),
    energyTimeline: parseJsonArray(profile.energyTimeline, []),
    notes: profile.notes,
    safetyWarning: profile.safetyWarning,
    createdAt: toIsoString(profile.createdAt),
    updatedAt: toIsoString(profile.updatedAt)
  };
}

function mapSfxProfile(profile: {
  assetId: string;
  title: string;
  category: SfxAssetProfile["category"];
  intensity: SfxAssetProfile["intensity"];
  durationSeconds: number | null;
  useCase: SfxAssetProfile["useCase"];
  licenseStatus: SfxAssetProfile["licenseStatus"];
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}): SfxAssetProfile {
  return {
    assetId: profile.assetId,
    title: profile.title,
    category: profile.category,
    intensity: profile.intensity,
    durationSeconds: profile.durationSeconds,
    useCase: profile.useCase,
    licenseStatus: profile.licenseStatus,
    notes: profile.notes,
    createdAt: toIsoString(profile.createdAt),
    updatedAt: toIsoString(profile.updatedAt)
  };
}

function buildMusicWhere(filters: MusicProfileFilters) {
  return {
    ...(filters.mood ? { mood: filters.mood } : {}),
    ...(filters.genre ? { genre: filters.genre } : {}),
    ...(filters.energy ? { energy: filters.energy } : {}),
    ...(filters.useCase ? { useCase: filters.useCase } : {}),
    ...(filters.licenseStatus ? { licenseStatus: filters.licenseStatus } : {}),
    ...(filters.search
      ? {
          OR: [
            { title: { contains: filters.search } },
            { artist: { contains: filters.search } },
            { notes: { contains: filters.search } }
          ]
        }
      : {})
  };
}

function buildSfxWhere(filters: SfxProfileFilters) {
  return {
    ...(filters.category ? { category: filters.category } : {}),
    ...(filters.intensity ? { intensity: filters.intensity } : {}),
    ...(filters.useCase ? { useCase: filters.useCase } : {}),
    ...(filters.licenseStatus ? { licenseStatus: filters.licenseStatus } : {}),
    ...(filters.search
      ? {
          OR: [{ title: { contains: filters.search } }, { notes: { contains: filters.search } }]
        }
      : {})
  };
}

export function createPrismaAudioLibraryRepository({
  prismaClient = defaultPrisma
}: PrismaAudioLibraryRepositoryOptions = {}): AudioLibraryRepository {
  return {
    async listMusicProfiles(filters = {}) {
      const profiles = await prismaClient.musicAssetProfile.findMany({
        where: buildMusicWhere(filters),
        orderBy: {
          updatedAt: "desc"
        }
      });

      return profiles.map(mapMusicProfile);
    },
    async getMusicProfileByAssetId(assetId) {
      const profile = await prismaClient.musicAssetProfile.findUnique({
        where: { assetId }
      });

      return profile ? mapMusicProfile(profile) : null;
    },
    async upsertMusicProfile(input: UpsertMusicAssetProfileInput) {
      const profile = await prismaClient.musicAssetProfile.upsert({
        where: {
          assetId: input.assetId
        },
        update: {
          title: input.title,
          artist: input.artist,
          sourceType: input.sourceType,
          licenseStatus: input.licenseStatus,
          mood: input.mood,
          genre: input.genre,
          bpm: input.bpm,
          bpmConfidence: input.bpmConfidence,
          energy: input.energy,
          useCase: input.useCase,
          durationSeconds: input.durationSeconds,
          loudness: input.loudness,
          beatMarkers: JSON.stringify(input.beatMarkers ?? []),
          energyTimeline: JSON.stringify(input.energyTimeline ?? []),
          notes: input.notes,
          safetyWarning: input.safetyWarning
        },
        create: {
          assetId: input.assetId,
          title: input.title,
          artist: input.artist,
          sourceType: input.sourceType,
          licenseStatus: input.licenseStatus,
          mood: input.mood,
          genre: input.genre,
          bpm: input.bpm,
          bpmConfidence: input.bpmConfidence,
          energy: input.energy,
          useCase: input.useCase,
          durationSeconds: input.durationSeconds,
          loudness: input.loudness,
          beatMarkers: JSON.stringify(input.beatMarkers ?? []),
          energyTimeline: JSON.stringify(input.energyTimeline ?? []),
          notes: input.notes,
          safetyWarning: input.safetyWarning
        }
      });

      return mapMusicProfile(profile);
    },
    async listSfxProfiles(filters = {}) {
      const profiles = await prismaClient.sfxAssetProfile.findMany({
        where: buildSfxWhere(filters),
        orderBy: {
          updatedAt: "desc"
        }
      });

      return profiles.map(mapSfxProfile);
    },
    async getSfxProfileByAssetId(assetId) {
      const profile = await prismaClient.sfxAssetProfile.findUnique({
        where: { assetId }
      });

      return profile ? mapSfxProfile(profile) : null;
    },
    async upsertSfxProfile(input: UpsertSfxAssetProfileInput) {
      const profile = await prismaClient.sfxAssetProfile.upsert({
        where: {
          assetId: input.assetId
        },
        update: {
          title: input.title,
          category: input.category,
          intensity: input.intensity,
          durationSeconds: input.durationSeconds,
          useCase: input.useCase,
          licenseStatus: input.licenseStatus,
          notes: input.notes
        },
        create: {
          assetId: input.assetId,
          title: input.title,
          category: input.category,
          intensity: input.intensity,
          durationSeconds: input.durationSeconds,
          useCase: input.useCase,
          licenseStatus: input.licenseStatus,
          notes: input.notes
        }
      });

      return mapSfxProfile(profile);
    }
  };
}
