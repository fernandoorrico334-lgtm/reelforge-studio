import {
  createMemoryId,
  createTimestamp,
  getMemoryStudioState
} from "../../../infrastructure/memory/studio-memory-store.js";
import type { CharacterRepository } from "../application/character-repository.js";
import type {
  CharacterProfile,
  CharacterReference,
  CreateCharacterProfileInput,
  CreateCharacterReferenceInput,
  UpdateCharacterProfileInput,
  UpdateCharacterReferenceInput
} from "../domain/character.js";

function sortByCreatedAtDesc<T extends { createdAt: string }>(items: T[]) {
  return [...items].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export function createInMemoryCharacterRepository(): CharacterRepository {
  const state = getMemoryStudioState();

  function mapReference(referenceId: string): CharacterReference | null {
    const reference = state.characterReferences.find((entry) => entry.id === referenceId);

    if (!reference) {
      return null;
    }

    return {
      ...reference,
      asset: reference.assetId
        ? state.assets.find((asset) => asset.id === reference.assetId) ?? null
        : null
    };
  }

  function listMappedReferences(characterProfileId: string) {
    return sortByCreatedAtDesc(
      state.characterReferences
        .filter((reference) => reference.characterProfileId === characterProfileId)
        .map((reference) => mapReference(reference.id))
        .filter((reference): reference is CharacterReference => reference !== null)
    );
  }

  function mapProfile(characterProfileId: string): CharacterProfile | null {
    const profile = state.characterProfiles.find((entry) => entry.id === characterProfileId);

    if (!profile) {
      return null;
    }

    return {
      ...profile,
      tags: [...profile.tags],
      references: listMappedReferences(profile.id)
    };
  }

  return {
    async list() {
      return sortByCreatedAtDesc(
        state.characterProfiles
          .map((profile) => mapProfile(profile.id))
          .filter((profile): profile is CharacterProfile => profile !== null)
      );
    },
    async getById(id: string) {
      return mapProfile(id);
    },
    async getBySlug(slug: string) {
      const profile = state.characterProfiles.find((entry) => entry.slug === slug);
      return profile ? mapProfile(profile.id) : null;
    },
    async create(input: CreateCharacterProfileInput) {
      const timestamp = createTimestamp();
      const profile = {
        id: createMemoryId("character"),
        name: input.name,
        slug: input.slug,
        franchise: input.franchise,
        category: input.category,
        description: input.description,
        basePrompt: input.basePrompt,
        negativePrompt: input.negativePrompt,
        styleNotes: input.styleNotes,
        defaultVisualStyle: input.defaultVisualStyle,
        referenceStrength: input.referenceStrength ?? 0.75,
        preferredProvider: input.preferredProvider ?? "mock-svg",
        tags: [...input.tags],
        createdAt: timestamp,
        updatedAt: timestamp
      };

      state.characterProfiles.unshift(profile);
      return mapProfile(profile.id) as CharacterProfile;
    },
    async update(id: string, input: UpdateCharacterProfileInput) {
      const index = state.characterProfiles.findIndex((entry) => entry.id === id);

      if (index === -1) {
        return null;
      }

      const existing = state.characterProfiles[index];

      if (!existing) {
        return null;
      }

      state.characterProfiles[index] = {
        ...existing,
        ...input,
        referenceStrength:
          "referenceStrength" in input
            ? input.referenceStrength ?? 0.75
            : existing.referenceStrength,
        preferredProvider:
          "preferredProvider" in input
            ? input.preferredProvider ?? "mock-svg"
            : existing.preferredProvider,
        tags: "tags" in input ? [...(input.tags ?? [])] : existing.tags,
        updatedAt: createTimestamp()
      };

      return mapProfile(id);
    },
    async delete(id: string) {
      const index = state.characterProfiles.findIndex((entry) => entry.id === id);

      if (index === -1) {
        return false;
      }

      state.characterProfiles.splice(index, 1);
      state.characterReferences = state.characterReferences.filter(
        (reference) => reference.characterProfileId !== id
      );
      return true;
    },
    async listReferences(characterProfileId: string) {
      return listMappedReferences(characterProfileId);
    },
    async getReferenceById(characterProfileId: string, referenceId: string) {
      const reference = state.characterReferences.find(
        (entry) =>
          entry.id === referenceId && entry.characterProfileId === characterProfileId
      );

      return reference ? mapReference(reference.id) : null;
    },
    async createReference(characterProfileId: string, input: CreateCharacterReferenceInput) {
      const profile = state.characterProfiles.find((entry) => entry.id === characterProfileId);

      if (!profile) {
        return null;
      }

      const timestamp = createTimestamp();
      const reference = {
        id: createMemoryId("character-reference"),
        characterProfileId,
        assetId: input.assetId ?? null,
        sourcePath: input.sourcePath ?? null,
        title: input.title ?? null,
        notes: input.notes ?? null,
        referenceType: input.referenceType,
        strength: input.strength ?? profile.referenceStrength,
        createdAt: timestamp,
        updatedAt: timestamp
      };

      state.characterReferences.unshift(reference);
      return mapReference(reference.id);
    },
    async updateReference(
      characterProfileId: string,
      referenceId: string,
      input: UpdateCharacterReferenceInput
    ) {
      const index = state.characterReferences.findIndex(
        (entry) =>
          entry.id === referenceId && entry.characterProfileId === characterProfileId
      );

      if (index === -1) {
        return null;
      }

      const existing = state.characterReferences[index];

      if (!existing) {
        return null;
      }

      state.characterReferences[index] = {
        ...existing,
        ...input,
        assetId: "assetId" in input ? input.assetId ?? null : existing.assetId,
        sourcePath:
          "sourcePath" in input ? input.sourcePath ?? null : existing.sourcePath,
        title: "title" in input ? input.title ?? null : existing.title,
        notes: "notes" in input ? input.notes ?? null : existing.notes,
        referenceType:
          "referenceType" in input
            ? input.referenceType ?? existing.referenceType
            : existing.referenceType,
        strength: "strength" in input ? input.strength ?? existing.strength : existing.strength,
        updatedAt: createTimestamp()
      };

      return mapReference(referenceId);
    },
    async deleteReference(characterProfileId: string, referenceId: string) {
      const index = state.characterReferences.findIndex(
        (entry) =>
          entry.id === referenceId && entry.characterProfileId === characterProfileId
      );

      if (index === -1) {
        return false;
      }

      state.characterReferences.splice(index, 1);
      return true;
    }
  };
}