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

export interface EditingReferenceRepository {
  listReferences(filters?: EditingReferenceFilters): Promise<EditingReference[]>;
  getReferenceById(id: string): Promise<EditingReference | null>;
  createReference(input: CreateEditingReferenceInput): Promise<EditingReference>;
  updateReference(
    id: string,
    input: UpdateEditingReferenceInput
  ): Promise<EditingReference | null>;
  deleteReference(id: string): Promise<boolean>;
  listPresets(filters?: EditingReferencePresetFilters): Promise<EditingReferencePreset[]>;
  getPresetById(id: string): Promise<EditingReferencePreset | null>;
  getPresetBySlug(slug: string): Promise<EditingReferencePreset | null>;
  createPreset(
    input: CreateEditingReferencePresetInput
  ): Promise<EditingReferencePreset>;
  updatePreset(
    id: string,
    input: UpdateEditingReferencePresetInput
  ): Promise<EditingReferencePreset | null>;
  deletePreset(id: string): Promise<boolean>;
}
