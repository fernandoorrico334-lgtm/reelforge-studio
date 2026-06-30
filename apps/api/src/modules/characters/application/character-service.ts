import { NotFoundError, ValidationError } from "../../../shared/errors.js";
import type { AssetRepository } from "../../assets/application/asset-repository.js";
import type { IntakeRepository } from "../../intake/application/intake-repository.js";
import { manualIntakeProvider } from "../../intake/infrastructure/intake-filesystem.js";
import type { CharacterRepository } from "./character-repository.js";
import {
  buildCharacterProfileBasePrompt,
  type CharacterProfile,
  type CreateCharacterProfileInput,
  type CreateCharacterReferenceInput,
  type UpdateCharacterProfileInput,
  type UpdateCharacterReferenceInput
} from "../domain/character.js";

function ensureSlugValue(value: string) {
  const normalized = value.trim().toLowerCase();

  if (!normalized) {
    throw new ValidationError("characterSlug must be provided.");
  }

  return normalized;
}

function formatCharacterNameFromSlug(slug: string) {
  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function inferReferenceTypeFromPath(value: string | null | undefined) {
  const normalized = (value ?? "").toLowerCase();

  if (normalized.includes("face") || normalized.includes("portrait")) {
    return "face";
  }

  if (normalized.includes("full") || normalized.includes("body")) {
    return "full_body";
  }

  if (normalized.includes("pose")) {
    return "pose";
  }

  if (normalized.includes("outfit") || normalized.includes("costume")) {
    return "outfit";
  }

  if (normalized.includes("expression")) {
    return "expression";
  }

  if (normalized.includes("style")) {
    return "style";
  }

  return "other";
}

function buildReferenceLabel(value: string) {
  return value
    .split(/[\\/]/)
    .at(-1)
    ?.replace(/\.[a-z0-9]+$/i, "")
    .replace(/[-_]+/g, " ")
    .trim();
}

export async function listCharacters(repository: CharacterRepository) {
  return repository.list();
}

export async function getCharacterById(
  repository: CharacterRepository,
  characterId: string
) {
  const character = await repository.getById(characterId);

  if (!character) {
    throw new NotFoundError(`Character profile '${characterId}' was not found.`);
  }

  return character;
}

export async function createCharacter(
  repository: CharacterRepository,
  input: CreateCharacterProfileInput
) {
  const existing = await repository.getBySlug(input.slug);

  if (existing) {
    throw new ValidationError(`Character slug '${input.slug}' is already in use.`);
  }

  return repository.create(input);
}

export async function updateCharacter(
  repository: CharacterRepository,
  characterId: string,
  input: UpdateCharacterProfileInput
) {
  const existing = await repository.getById(characterId);

  if (!existing) {
    throw new NotFoundError(`Character profile '${characterId}' was not found.`);
  }

  if (input.slug && input.slug !== existing.slug) {
    const conflict = await repository.getBySlug(input.slug);

    if (conflict && conflict.id !== characterId) {
      throw new ValidationError(`Character slug '${input.slug}' is already in use.`);
    }
  }

  const updated = await repository.update(characterId, input);

  if (!updated) {
    throw new NotFoundError(`Character profile '${characterId}' was not found.`);
  }

  return updated;
}

export async function deleteCharacter(
  repository: CharacterRepository,
  characterId: string
) {
  const deleted = await repository.delete(characterId);

  if (!deleted) {
    throw new NotFoundError(`Character profile '${characterId}' was not found.`);
  }
}

export async function listCharacterReferences(
  repository: CharacterRepository,
  characterId: string
) {
  const character = await repository.getById(characterId);

  if (!character) {
    throw new NotFoundError(`Character profile '${characterId}' was not found.`);
  }

  return repository.listReferences(characterId);
}

export async function createCharacterReference(
  repository: CharacterRepository,
  characterId: string,
  input: CreateCharacterReferenceInput
) {
  const created = await repository.createReference(characterId, input);

  if (!created) {
    throw new NotFoundError(`Character profile '${characterId}' was not found.`);
  }

  return created;
}

export async function updateCharacterReference(
  repository: CharacterRepository,
  characterId: string,
  referenceId: string,
  input: UpdateCharacterReferenceInput
) {
  const updated = await repository.updateReference(characterId, referenceId, input);

  if (!updated) {
    throw new NotFoundError(
      `Character reference '${referenceId}' was not found for profile '${characterId}'.`
    );
  }

  return updated;
}

export async function deleteCharacterReference(
  repository: CharacterRepository,
  characterId: string,
  referenceId: string
) {
  const deleted = await repository.deleteReference(characterId, referenceId);

  if (!deleted) {
    throw new NotFoundError(
      `Character reference '${referenceId}' was not found for profile '${characterId}'.`
    );
  }
}

export async function buildBasePromptForCharacter(
  repository: CharacterRepository,
  characterId: string
) {
  const character = await repository.getById(characterId);

  if (!character) {
    throw new NotFoundError(`Character profile '${characterId}' was not found.`);
  }

  const { basePrompt, negativePrompt } = buildCharacterProfileBasePrompt(
    character,
    character.references
  );

  const updated = await repository.update(characterId, {
    basePrompt,
    negativePrompt
  });

  return updated ?? {
    ...character,
    basePrompt,
    negativePrompt
  };
}

export async function createCharacterProfileFromIntake(
  characterRepository: CharacterRepository,
  intakeRepository: IntakeRepository,
  assetRepository: AssetRepository,
  characterSlug: string
) {
  const slug = ensureSlugValue(characterSlug);
  const existing = await characterRepository.getBySlug(slug);
  const importedAssets = (await assetRepository.list()).filter((asset) => {
    const characterValue = (asset.character ?? "").trim().toLowerCase();
    return (
      characterValue === slug &&
      asset.sourceProvider === manualIntakeProvider
    );
  });
  const intakeCandidates = (await intakeRepository.listCandidates({
    provider: manualIntakeProvider
  })).filter((candidate) =>
    candidate.originalPath
      ?.replaceAll("\\", "/")
      .includes(`/characters/${slug}/references/`)
  );

  let profile: CharacterProfile;
  const warnings: string[] = [];
  const createdReferenceIds: string[] = [];

  if (existing) {
    profile = existing;
  } else {
    profile = await characterRepository.create({
      name: formatCharacterNameFromSlug(slug),
      slug,
      franchise: null,
      category: "intake-reference",
      description: null,
      basePrompt: null,
      negativePrompt: null,
      styleNotes: "Built from local user-provided character references.",
      defaultVisualStyle: null,
      referenceStrength: 0.75,
      preferredProvider: "mock-svg",
      tags: ["character-reference", slug]
    });
  }

  if (importedAssets.length === 0) {
    warnings.push(
      "Nenhum asset importado foi encontrado para esse slug. Importe os references via /intake primeiro."
    );
  }

  const existingReferences = await characterRepository.listReferences(profile.id);
  const linkedAssetIds = new Set(
    existingReferences
      .map((reference) => reference.assetId)
      .filter((value): value is string => Boolean(value))
  );

  for (const asset of importedAssets) {
    if (linkedAssetIds.has(asset.id)) {
      continue;
    }

    const created = await characterRepository.createReference(profile.id, {
      assetId: asset.id,
      sourcePath: asset.path,
      title: buildReferenceLabel(asset.originalName) ?? asset.filename,
      notes: asset.usageNotes ?? "Imported from local intake references.",
      referenceType: inferReferenceTypeFromPath(asset.originalName),
      strength: 0.75
    });

    if (created) {
      createdReferenceIds.push(created.id);
    }
  }

  if (intakeCandidates.length > 0 && importedAssets.length === 0) {
    warnings.push(
      `${intakeCandidates.length} candidate(s) foram encontrados em storage/inbox/characters/${slug}/references, mas ainda nao viraram assets.`
    );
  }

  const refreshed = await characterRepository.getById(profile.id);

  return {
    profile: refreshed ?? profile,
    referencesCreated: createdReferenceIds.length,
    warnings
  };
}

