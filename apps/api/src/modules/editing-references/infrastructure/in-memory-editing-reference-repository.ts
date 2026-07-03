import type { EditingReferenceRepository } from "../application/editing-reference-repository.js";
import {
  createMemoryId,
  createTimestamp,
  getMemoryStudioState
} from "../../../infrastructure/memory/studio-memory-store.js";
import type {
  CreateEditingReferenceInput,
  CreateEditingReferencePresetInput,
  EditingReference,
  EditingReferenceFilters,
  EditingReferencePreset,
  EditingReferencePresetFilters,
  UpdateEditingReferenceInput,
  UpdateEditingReferencePresetInput
} from "../domain/editing-reference.js";

function matchesReferenceFilters(
  item: EditingReference,
  filters: EditingReferenceFilters
) {
  if (filters.category && item.category !== filters.category) {
    return false;
  }

  if (filters.status && item.status !== filters.status) {
    return false;
  }

  if (filters.sourceType && item.sourceType !== filters.sourceType) {
    return false;
  }

  return true;
}

function matchesPresetFilters(
  item: EditingReferencePreset,
  filters: EditingReferencePresetFilters
) {
  if (filters.useCase && item.useCase !== filters.useCase) {
    return false;
  }

  if (filters.referenceId && item.referenceId !== filters.referenceId) {
    return false;
  }

  if (
    filters.templateId &&
    !item.recommendedTemplates.includes(filters.templateId)
  ) {
    return false;
  }

  return true;
}

function cloneReference(reference: EditingReference) {
  return JSON.parse(JSON.stringify(reference)) as EditingReference;
}

function clonePreset(preset: EditingReferencePreset) {
  return JSON.parse(JSON.stringify(preset)) as EditingReferencePreset;
}

export function createInMemoryEditingReferenceRepository(): EditingReferenceRepository {
  const state = getMemoryStudioState();

  function materializeReference(id: string): EditingReference | null {
    const record = state.editingReferences.find((item) => item.id === id);

    if (!record) {
      return null;
    }

    return {
      ...record,
      asset: record.assetId
        ? state.assets.find((asset) => asset.id === record.assetId) ?? null
        : null
    };
  }

  function materializePreset(id: string): EditingReferencePreset | null {
    const record = state.editingReferencePresets.find((item) => item.id === id);

    if (!record) {
      return null;
    }

    return {
      ...record,
      recommendedTemplates: [...record.recommendedTemplates],
      reference: record.referenceId ? materializeReference(record.referenceId) : null
    };
  }

  return {
    async listReferences(filters = {}) {
      return state.editingReferences
        .map((item) => materializeReference(item.id))
        .filter((item): item is EditingReference => item !== null)
        .filter((item) => matchesReferenceFilters(item, filters))
        .map(cloneReference);
    },

    async getReferenceById(id) {
      const reference = materializeReference(id);
      return reference ? cloneReference(reference) : null;
    },

    async createReference(input) {
      const timestamp = createTimestamp();
      const record = {
        id: createMemoryId("editing-reference"),
        ...input,
        createdAt: timestamp,
        updatedAt: timestamp
      };

      state.editingReferences.unshift(record);
      return cloneReference(materializeReference(record.id)!);
    },

    async updateReference(id, input) {
      const index = state.editingReferences.findIndex((item) => item.id === id);

      if (index < 0) {
        return null;
      }

      const current = state.editingReferences[index]!;
      state.editingReferences[index] = {
        ...current,
        ...input,
        updatedAt: createTimestamp()
      };

      return cloneReference(materializeReference(id)!);
    },

    async deleteReference(id) {
      const index = state.editingReferences.findIndex((item) => item.id === id);

      if (index < 0) {
        return false;
      }

      state.editingReferencePresets = state.editingReferencePresets.map((preset) =>
        preset.referenceId === id ? { ...preset, referenceId: null } : preset
      );
      state.editingReferences.splice(index, 1);
      return true;
    },

    async listPresets(filters = {}) {
      return state.editingReferencePresets
        .map((item) => materializePreset(item.id))
        .filter((item): item is EditingReferencePreset => item !== null)
        .filter((item) => matchesPresetFilters(item, filters))
        .map(clonePreset);
    },

    async getPresetById(id) {
      const preset = materializePreset(id);
      return preset ? clonePreset(preset) : null;
    },

    async getPresetBySlug(slug) {
      const record = state.editingReferencePresets.find((item) => item.slug === slug);
      return record ? clonePreset(materializePreset(record.id)!) : null;
    },

    async createPreset(input) {
      const timestamp = createTimestamp();
      const record = {
        id: createMemoryId("editing-preset"),
        ...input,
        recommendedTemplates: [...input.recommendedTemplates],
        createdAt: timestamp,
        updatedAt: timestamp
      };

      state.editingReferencePresets.unshift(record);
      return clonePreset(materializePreset(record.id)!);
    },

    async updatePreset(id, input) {
      const index = state.editingReferencePresets.findIndex((item) => item.id === id);

      if (index < 0) {
        return null;
      }

      const current = state.editingReferencePresets[index]!;
      state.editingReferencePresets[index] = {
        ...current,
        ...input,
        recommendedTemplates:
          input.recommendedTemplates !== undefined
            ? [...input.recommendedTemplates]
            : current.recommendedTemplates,
        updatedAt: createTimestamp()
      };

      return clonePreset(materializePreset(id)!);
    },

    async deletePreset(id) {
      const index = state.editingReferencePresets.findIndex((item) => item.id === id);

      if (index < 0) {
        return false;
      }

      state.editingReferencePresets.splice(index, 1);
      return true;
    }
  };
}
