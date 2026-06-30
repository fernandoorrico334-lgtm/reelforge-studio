import type {
  CharacterProfile,
  CharacterReference,
  CreateCharacterProfileInput,
  CreateCharacterReferenceInput,
  UpdateCharacterProfileInput,
  UpdateCharacterReferenceInput
} from "../domain/character.js";

export interface CharacterRepository {
  list(): Promise<CharacterProfile[]>;
  getById(id: string): Promise<CharacterProfile | null>;
  getBySlug(slug: string): Promise<CharacterProfile | null>;
  create(input: CreateCharacterProfileInput): Promise<CharacterProfile>;
  update(
    id: string,
    input: UpdateCharacterProfileInput
  ): Promise<CharacterProfile | null>;
  delete(id: string): Promise<boolean>;
  listReferences(characterProfileId: string): Promise<CharacterReference[]>;
  getReferenceById(
    characterProfileId: string,
    referenceId: string
  ): Promise<CharacterReference | null>;
  createReference(
    characterProfileId: string,
    input: CreateCharacterReferenceInput
  ): Promise<CharacterReference | null>;
  updateReference(
    characterProfileId: string,
    referenceId: string,
    input: UpdateCharacterReferenceInput
  ): Promise<CharacterReference | null>;
  deleteReference(
    characterProfileId: string,
    referenceId: string
  ): Promise<boolean>;
}

