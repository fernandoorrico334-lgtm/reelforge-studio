import {
  audioLicenseStatuses,
  musicGenres,
  musicMoods,
  musicPresetIds,
  musicSourceTypes,
  musicUseCases,
  sfxCategories,
  sfxIntensities,
  sfxUseCases,
  type MusicAssetProfile,
  type SfxAssetProfile
} from "@reelforge/audio-engine";
import { ValidationError } from "../../../shared/errors.js";
import type {
  BuildBeatSyncPlanRequestInput,
  SelectMusicRequestInput
} from "../application/audio-library-service.js";
import type {
  MusicProfileFilters,
  SfxProfileFilters,
  UpsertMusicAssetProfileInput,
  UpsertSfxAssetProfileInput
} from "../application/audio-library-repository.js";

type PartialMusicProfileInput = Partial<UpsertMusicAssetProfileInput>;
type PartialSfxProfileInput = Partial<UpsertSfxAssetProfileInput>;

function asRecord(payload: unknown): Record<string, unknown> {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new ValidationError("Expected a JSON object.");
  }

  return payload as Record<string, unknown>;
}

function normalizeString(value: unknown, fieldName: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ValidationError(`${fieldName} must be a non-empty string.`);
  }

  return value.trim();
}

function normalizeOptionalString(value: unknown, fieldName: string) {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    throw new ValidationError(`${fieldName} must be a string or null.`);
  }

  return value.trim() || null;
}

function normalizeOptionalBoolean(value: unknown, fieldName: string) {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "boolean") {
    throw new ValidationError(`${fieldName} must be a boolean.`);
  }

  return value;
}

function normalizeOptionalNumber(value: unknown, fieldName: string) {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || value === "") {
    return null;
  }

  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new ValidationError(`${fieldName} must be a number or null.`);
  }

  return Math.round(value * 1000) / 1000;
}

function normalizeRequiredPositiveNumber(value: unknown, fieldName: string) {
  if (typeof value !== "number" || Number.isNaN(value) || value <= 0) {
    throw new ValidationError(`${fieldName} must be a positive number.`);
  }

  return Math.round(value * 1000) / 1000;
}

function normalizeEnumValue<T extends readonly string[]>(
  value: unknown,
  enumValues: T,
  fieldName: string
): T[number] {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ValidationError(`${fieldName} must be one of: ${enumValues.join(", ")}.`);
  }

  const normalized = value.trim().replaceAll("-", "_").toLowerCase();

  if (!enumValues.includes(normalized)) {
    throw new ValidationError(`${fieldName} must be one of: ${enumValues.join(", ")}.`);
  }

  return normalized as T[number];
}

function normalizeOptionalEnumValue<T extends readonly string[]>(
  value: unknown,
  enumValues: T,
  fieldName: string
) {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || value === "") {
    return undefined;
  }

  return normalizeEnumValue(value, enumValues, fieldName);
}

function normalizeOptionalBeatMarkers(value: unknown) {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new ValidationError("beatMarkers must be an array.");
  }

  return value.map((entry, index) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new ValidationError(`beatMarkers[${index}] must be an object.`);
    }

    const record = entry as Record<string, unknown>;
    return {
      timeSeconds: normalizeRequiredPositiveNumber(record.timeSeconds, `beatMarkers[${index}].timeSeconds`),
      strength: normalizeRequiredPositiveNumber(record.strength, `beatMarkers[${index}].strength`),
      confidence:
        normalizeRequiredPositiveNumber(
          record.confidence,
          `beatMarkers[${index}].confidence`
        )
    };
  }) as MusicAssetProfile["beatMarkers"];
}

function normalizeOptionalEnergyTimeline(value: unknown) {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new ValidationError("energyTimeline must be an array.");
  }

  return value.map((entry, index) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new ValidationError(`energyTimeline[${index}] must be an object.`);
    }

    const record = entry as Record<string, unknown>;
    return {
      timeSeconds: normalizeRequiredPositiveNumber(
        record.timeSeconds,
        `energyTimeline[${index}].timeSeconds`
      ),
      energy: normalizeRequiredPositiveNumber(record.energy, `energyTimeline[${index}].energy`)
    };
  }) as MusicAssetProfile["energyTimeline"];
}

export function validateMusicProfileFilters(
  rawFilters: Record<string, string | undefined>
): MusicProfileFilters {
  return {
    ...(rawFilters.mood
      ? { mood: normalizeEnumValue(rawFilters.mood, musicMoods, "mood filter") }
      : {}),
    ...(rawFilters.genre
      ? { genre: normalizeEnumValue(rawFilters.genre, musicGenres, "genre filter") }
      : {}),
    ...(rawFilters.energy
      ? {
          energy: normalizeEnumValue(
            rawFilters.energy,
            ["low", "medium", "high", "extreme"] as const,
            "energy filter"
          )
        }
      : {}),
    ...(rawFilters.useCase
      ? {
          useCase: normalizeEnumValue(
            rawFilters.useCase,
            musicUseCases,
            "useCase filter"
          )
        }
      : {}),
    ...(rawFilters.licenseStatus
      ? {
          licenseStatus: normalizeEnumValue(
            rawFilters.licenseStatus,
            audioLicenseStatuses,
            "licenseStatus filter"
          )
        }
      : {}),
    ...(rawFilters.search?.trim() ? { search: rawFilters.search.trim() } : {})
  };
}

export function validateSfxProfileFilters(
  rawFilters: Record<string, string | undefined>
): SfxProfileFilters {
  return {
    ...(rawFilters.category
      ? {
          category: normalizeEnumValue(
            rawFilters.category,
            sfxCategories,
            "category filter"
          )
        }
      : {}),
    ...(rawFilters.intensity
      ? {
          intensity: normalizeEnumValue(
            rawFilters.intensity,
            sfxIntensities,
            "intensity filter"
          )
        }
      : {}),
    ...(rawFilters.useCase
      ? {
          useCase: normalizeEnumValue(
            rawFilters.useCase,
            sfxUseCases,
            "useCase filter"
          )
        }
      : {}),
    ...(rawFilters.licenseStatus
      ? {
          licenseStatus: normalizeEnumValue(
            rawFilters.licenseStatus,
            audioLicenseStatuses,
            "licenseStatus filter"
          )
        }
      : {}),
    ...(rawFilters.search?.trim() ? { search: rawFilters.search.trim() } : {})
  };
}

export function validatePartialMusicProfileInput(
  payload: unknown
): PartialMusicProfileInput {
  const record = asRecord(payload);
  const update: PartialMusicProfileInput = {};

  if ("title" in record) update.title = normalizeString(record.title, "title");
  if ("artist" in record) update.artist = normalizeOptionalString(record.artist, "artist") ?? null;
  if ("sourceType" in record) {
    const sourceType = normalizeOptionalEnumValue(
      record.sourceType,
      musicSourceTypes,
      "sourceType"
    );
    if (sourceType !== undefined) {
      update.sourceType = sourceType;
    }
  }
  if ("licenseStatus" in record) {
    const licenseStatus = normalizeOptionalEnumValue(
      record.licenseStatus,
      audioLicenseStatuses,
      "licenseStatus"
    );
    if (licenseStatus !== undefined) {
      update.licenseStatus = licenseStatus;
    }
  }
  if ("mood" in record) {
    const mood = normalizeOptionalEnumValue(record.mood, musicMoods, "mood");
    if (mood !== undefined) {
      update.mood = mood;
    }
  }
  if ("genre" in record) {
    const genre = normalizeOptionalEnumValue(record.genre, musicGenres, "genre");
    if (genre !== undefined) {
      update.genre = genre;
    }
  }
  if ("bpm" in record) update.bpm = normalizeOptionalNumber(record.bpm, "bpm") ?? null;
  if ("bpmConfidence" in record) {
    const bpmConfidence = normalizeOptionalNumber(record.bpmConfidence, "bpmConfidence");
    update.bpmConfidence = bpmConfidence ?? 0;
  }
  if ("energy" in record) {
    const energy = normalizeOptionalEnumValue(
      record.energy,
      ["low", "medium", "high", "extreme"] as const,
      "energy"
    );
    if (energy !== undefined) {
      update.energy = energy;
    }
  }
  if ("useCase" in record) {
    const useCase = normalizeOptionalEnumValue(record.useCase, musicUseCases, "useCase");
    if (useCase !== undefined) {
      update.useCase = useCase;
    }
  }
  if ("durationSeconds" in record) {
    update.durationSeconds =
      normalizeOptionalNumber(record.durationSeconds, "durationSeconds") ?? null;
  }
  if ("loudness" in record) {
    update.loudness = normalizeOptionalNumber(record.loudness, "loudness") ?? null;
  }
  if ("beatMarkers" in record) {
    update.beatMarkers = normalizeOptionalBeatMarkers(record.beatMarkers) ?? [];
  }
  if ("energyTimeline" in record) {
    update.energyTimeline = normalizeOptionalEnergyTimeline(record.energyTimeline) ?? [];
  }
  if ("notes" in record) update.notes = normalizeOptionalString(record.notes, "notes") ?? null;
  if ("safetyWarning" in record) {
    update.safetyWarning =
      normalizeOptionalString(record.safetyWarning, "safetyWarning") ?? null;
  }

  if (Object.keys(update).length === 0) {
    throw new ValidationError("At least one music profile field must be provided.");
  }

  return update;
}

export function validatePartialSfxProfileInput(
  payload: unknown
): PartialSfxProfileInput {
  const record = asRecord(payload);
  const update: PartialSfxProfileInput = {};

  if ("title" in record) update.title = normalizeString(record.title, "title");
  if ("category" in record) {
    const category = normalizeOptionalEnumValue(record.category, sfxCategories, "category");
    if (category !== undefined) {
      update.category = category;
    }
  }
  if ("intensity" in record) {
    const intensity = normalizeOptionalEnumValue(
      record.intensity,
      sfxIntensities,
      "intensity"
    );
    if (intensity !== undefined) {
      update.intensity = intensity;
    }
  }
  if ("durationSeconds" in record) {
    update.durationSeconds =
      normalizeOptionalNumber(record.durationSeconds, "durationSeconds") ?? null;
  }
  if ("useCase" in record) {
    const useCase = normalizeOptionalEnumValue(record.useCase, sfxUseCases, "useCase");
    if (useCase !== undefined) {
      update.useCase = useCase;
    }
  }
  if ("licenseStatus" in record) {
    const licenseStatus = normalizeOptionalEnumValue(
      record.licenseStatus,
      audioLicenseStatuses,
      "licenseStatus"
    );
    if (licenseStatus !== undefined) {
      update.licenseStatus = licenseStatus;
    }
  }
  if ("notes" in record) update.notes = normalizeOptionalString(record.notes, "notes") ?? null;

  if (Object.keys(update).length === 0) {
    throw new ValidationError("At least one SFX profile field must be provided.");
  }

  return update;
}

export function validateSelectMusicRequestInput(
  payload: unknown
): SelectMusicRequestInput {
  const record = asRecord(payload);

  return {
    templateId: normalizeOptionalString(record.templateId, "templateId") ?? null,
    musicPresetId:
      normalizeOptionalEnumValue(record.musicPresetId, musicPresetIds, "musicPresetId") ?? null,
    audioMasteringPresetId:
      normalizeOptionalString(record.audioMasteringPresetId, "audioMasteringPresetId") ?? null,
    tone: normalizeOptionalString(record.tone, "tone") ?? null,
    durationSeconds: normalizeRequiredPositiveNumber(record.durationSeconds, "durationSeconds"),
    useCase:
      normalizeOptionalEnumValue(record.useCase, musicUseCases, "useCase") ?? null,
    allowUnknownLicense:
      normalizeOptionalBoolean(record.allowUnknownLicense, "allowUnknownLicense") ?? false
  };
}

export function validateBeatSyncPlanRequestInput(
  payload: unknown
): BuildBeatSyncPlanRequestInput {
  const record = asRecord(payload);

  return {
    projectId: normalizeString(record.projectId, "projectId"),
    musicAssetId: normalizeOptionalString(record.musicAssetId, "musicAssetId") ?? null,
    musicPresetId:
      normalizeOptionalEnumValue(record.musicPresetId, musicPresetIds, "musicPresetId") ?? null,
    reelDurationSeconds:
      normalizeOptionalNumber(record.reelDurationSeconds, "reelDurationSeconds") ?? null
  };
}
