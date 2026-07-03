import { isAbsolute, resolve } from "node:path";
import {
  analyzeEditingReference,
  buildEditingReferencePreset,
  getEditingReferencePresetCatalog,
  suggestReferencePresetsForTemplate,
  summarizeEditingReference,
  summarizeEditingReferencePreset,
  type EditingReferencePresetRecord
} from "@reelforge/editing-reference-engine";
import { projectRoot } from "../../../config/paths.js";
import { NotFoundError, ValidationError } from "../../../shared/errors.js";
import type { AssetRepository } from "../../assets/application/asset-repository.js";
import type { EditingReferenceRepository } from "./editing-reference-repository.js";
import type {
  BuildEditingReferencePresetPayload,
  CreateEditingReferenceInput,
  CreateEditingReferencePresetInput,
  EditingReference,
  EditingReferenceFilters,
  EditingReferencePreset,
  EditingReferencePresetFilters,
  EditingReferenceSuggestion,
  UpdateEditingReferenceInput,
  UpdateEditingReferencePresetInput
} from "../domain/editing-reference.js";

function resolveAbsoluteReferencePath(pathValue: string) {
  return isAbsolute(pathValue) ? pathValue : resolve(projectRoot, pathValue);
}

async function ensureVideoAsset(
  assetRepository: AssetRepository,
  assetId: string | null
) {
  if (!assetId) {
    return null;
  }

  const asset = await assetRepository.getById(assetId);

  if (!asset) {
    throw new NotFoundError(`Asset '${assetId}' was not found.`);
  }

  if (asset.type !== "VIDEO") {
    throw new ValidationError(
      `Asset '${assetId}' must be VIDEO to be used as an editing reference.`
    );
  }

  return asset;
}

async function ensureReferenceExists(
  repository: EditingReferenceRepository,
  referenceId: string
) {
  const reference = await repository.getReferenceById(referenceId);

  if (!reference) {
    throw new NotFoundError(`Editing reference '${referenceId}' was not found.`);
  }

  return reference;
}

async function ensurePresetExists(
  repository: EditingReferenceRepository,
  presetId: string
) {
  const preset = await repository.getPresetById(presetId);

  if (!preset) {
    throw new NotFoundError(`Editing reference preset '${presetId}' was not found.`);
  }

  return preset;
}

function resolveReferencePath(reference: EditingReference) {
  if (reference.localPath) {
    return resolveAbsoluteReferencePath(reference.localPath);
  }

  if (reference.asset?.path) {
    return resolveAbsoluteReferencePath(reference.asset.path);
  }

  throw new ValidationError(
    "Editing reference requires either localPath or an asset-backed path for analysis."
  );
}

function slugify(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[^\w\s-]/gu, "")
    .trim()
    .replace(/[\s_]+/gu, "-")
    .replace(/-+/gu, "-")
    .toLowerCase();
}

function toCreatePresetInput(
  preset: EditingReferencePresetRecord
): CreateEditingReferencePresetInput {
  return {
    referenceId: preset.referenceId,
    name: preset.name,
    slug: preset.slug,
    description: preset.description,
    useCase: preset.useCase,
    cutPace: preset.cutPace,
    pacing: preset.pacing,
    zoomStyle: preset.zoomStyle,
    flashStyle: preset.flashStyle,
    transitionStyle: preset.transitionStyle,
    captionStyle: preset.captionStyle,
    narrationStyle: preset.narrationStyle,
    musicStyle: preset.musicStyle,
    sfxStyle: preset.sfxStyle,
    hookStyle: preset.hookStyle,
    ctaStyle: preset.ctaStyle,
    microclipPlacement: preset.microclipPlacement,
    recommendedTemplates: [...preset.recommendedTemplates],
    recommendedMusicPresetId: preset.recommendedMusicPresetId,
    recommendedAudioMasteringPresetId: preset.recommendedAudioMasteringPresetId,
    recommendedNarrationVoicePackId: preset.recommendedNarrationVoicePackId,
    defaultShotDurationSeconds: preset.defaultShotDurationSeconds,
    notes: preset.notes
  };
}

function buildSuggestionOrigin(
  suggestion: EditingReferenceSuggestion["origin"]
) {
  return suggestion === "saved" ? "Preset salvo" : "Catalogo local";
}

export async function listEditingReferences(
  repository: EditingReferenceRepository,
  filters: EditingReferenceFilters = {}
) {
  return repository.listReferences(filters);
}

export async function getEditingReference(
  repository: EditingReferenceRepository,
  referenceId: string
) {
  return ensureReferenceExists(repository, referenceId);
}

export async function createEditingReference(
  repository: EditingReferenceRepository,
  assetRepository: AssetRepository,
  input: CreateEditingReferenceInput
) {
  await ensureVideoAsset(assetRepository, input.assetId);
  return repository.createReference(input);
}

export async function updateEditingReference(
  repository: EditingReferenceRepository,
  assetRepository: AssetRepository,
  referenceId: string,
  input: UpdateEditingReferenceInput
) {
  await ensureReferenceExists(repository, referenceId);

  if ("assetId" in input) {
    await ensureVideoAsset(assetRepository, input.assetId ?? null);
  }

  const updated = await repository.updateReference(referenceId, input);

  if (!updated) {
    throw new NotFoundError(`Editing reference '${referenceId}' was not found.`);
  }

  return updated;
}

export async function deleteEditingReference(
  repository: EditingReferenceRepository,
  referenceId: string
) {
  const deleted = await repository.deleteReference(referenceId);

  if (!deleted) {
    throw new NotFoundError(`Editing reference '${referenceId}' was not found.`);
  }
}

export async function analyzeStoredEditingReference(
  repository: EditingReferenceRepository,
  referenceId: string
) {
  const reference = await ensureReferenceExists(repository, referenceId);
  const analysis = await analyzeEditingReference({
    referencePath: resolveReferencePath(reference),
    title: reference.title,
    category: reference.category
  });
  const updated = await repository.updateReference(referenceId, {
    status: analysis.status === "completed" ? "analyzed" : reference.status,
    durationSeconds: analysis.durationSeconds ?? reference.durationSeconds,
    averageCutPaceSeconds:
      analysis.averageCutPaceSeconds ?? reference.averageCutPaceSeconds,
    beatIntensity: analysis.beatIntensity ?? reference.beatIntensity,
    pacing: analysis.pacing ?? reference.pacing,
    analysisWarnings: analysis.warnings
  });

  if (!updated) {
    throw new NotFoundError(`Editing reference '${referenceId}' was not found.`);
  }

  return {
    reference: updated,
    analysis,
    summary: summarizeEditingReference(updated)
  };
}

export async function listEditingReferencePresets(
  repository: EditingReferenceRepository,
  filters: EditingReferencePresetFilters = {}
) {
  return repository.listPresets(filters);
}

export async function getEditingReferencePreset(
  repository: EditingReferenceRepository,
  presetId: string
) {
  return ensurePresetExists(repository, presetId);
}

export async function createEditingReferencePreset(
  repository: EditingReferenceRepository,
  input: CreateEditingReferencePresetInput
) {
  const existing = await repository.getPresetBySlug(input.slug);

  if (existing) {
    throw new ValidationError(
      `Editing reference preset slug '${input.slug}' already exists.`
    );
  }

  return repository.createPreset(input);
}

export async function updateEditingReferencePreset(
  repository: EditingReferenceRepository,
  presetId: string,
  input: UpdateEditingReferencePresetInput
) {
  const current = await ensurePresetExists(repository, presetId);

  if (input.slug && input.slug !== current.slug) {
    const existing = await repository.getPresetBySlug(input.slug);

    if (existing) {
      throw new ValidationError(
        `Editing reference preset slug '${input.slug}' already exists.`
      );
    }
  }

  const updated = await repository.updatePreset(presetId, input);

  if (!updated) {
    throw new NotFoundError(`Editing reference preset '${presetId}' was not found.`);
  }

  return updated;
}

export async function deleteEditingReferencePreset(
  repository: EditingReferenceRepository,
  presetId: string
) {
  const deleted = await repository.deletePreset(presetId);

  if (!deleted) {
    throw new NotFoundError(`Editing reference preset '${presetId}' was not found.`);
  }
}

export async function buildPresetFromEditingReference(
  repository: EditingReferenceRepository,
  referenceId: string,
  payload: BuildEditingReferencePresetPayload
) {
  const reference = await ensureReferenceExists(repository, referenceId);
  const builtPreset = buildEditingReferencePreset({
    reference: {
      id: reference.id,
      title: reference.title,
      category: reference.category,
      averageCutPaceSeconds: reference.averageCutPaceSeconds,
      pacing: reference.pacing,
      zoomStyle: reference.zoomStyle,
      flashStyle: reference.flashStyle,
      transitionStyle: reference.transitionStyle,
      captionStyle: reference.captionStyle,
      narrationStyle: reference.narrationStyle,
      musicStyle: reference.musicStyle,
      sfxStyle: reference.sfxStyle,
      hookStyle: reference.hookStyle,
      ctaStyle: reference.ctaStyle,
      microclipPlacement: reference.microclipPlacement,
      visualStyleNotes: reference.visualStyleNotes,
      audioStyleNotes: reference.audioStyleNotes,
      editingStyleNotes: reference.editingStyleNotes,
      analysisWarnings: reference.analysisWarnings
    },
    ...payload
  });
  const nextSlug = payload.slug?.trim()
    ? slugify(payload.slug)
    : builtPreset.slug;
  const collision = await repository.getPresetBySlug(nextSlug);

  if (collision) {
    throw new ValidationError(
      `Editing reference preset slug '${nextSlug}' already exists.`
    );
  }

  const created = await repository.createPreset(
    toCreatePresetInput({
      ...builtPreset,
      slug: nextSlug
    })
  );
  await repository.updateReference(referenceId, {
    status: "preset_ready"
  });

  return {
    preset: created,
    summary: summarizeEditingReferencePreset(created)
  };
}

export async function getEditingReferencePresetSuggestions(
  repository: EditingReferenceRepository,
  templateId: string
) {
  const savedPresets = await repository.listPresets({
    templateId
  });
  const savedSuggestions: EditingReferenceSuggestion[] = savedPresets.map((preset) => ({
    templateId,
    preset,
    origin: "saved",
    reason: `Preset salvo recomenda o template '${templateId}'.`
  }));
  const seenSlugs = new Set(savedPresets.map((preset) => preset.slug));
  const catalogSuggestions = suggestReferencePresetsForTemplate(templateId)
    .filter((suggestion) => !seenSlugs.has(suggestion.preset.slug))
    .map<EditingReferenceSuggestion>((suggestion) => ({
      templateId,
      preset: {
        ...suggestion.preset,
        reference: null
      },
      origin: "catalog",
      reason: suggestion.reason
    }));

  return [...savedSuggestions, ...catalogSuggestions].map((item) => ({
    ...item,
    reason: `${buildSuggestionOrigin(item.origin)}: ${item.reason}`
  }));
}

export async function ensureEditingReferenceCatalogSeeded(
  repository: EditingReferenceRepository
) {
  const currentPresets = await repository.listPresets();

  if (currentPresets.length > 0) {
    return;
  }

  for (const preset of getEditingReferencePresetCatalog()) {
    await repository.createPreset(toCreatePresetInput(preset));
  }
}
