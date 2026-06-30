import type {
  CreateMediaCandidateInput,
  CreateMediaCollectionInput,
  MediaCandidate,
  MediaCandidateListFilters,
  MediaCollectionListFilters,
  MediaCollection,
  UpdateMediaCandidateInput,
  UpdateMediaCollectionInput
} from "../domain/intake.js";

export interface IntakeRepository {
  listCollections(filters?: MediaCollectionListFilters): Promise<MediaCollection[]>;
  getCollectionById(id: string): Promise<MediaCollection | null>;
  createCollection(input: CreateMediaCollectionInput): Promise<MediaCollection>;
  updateCollection(
    id: string,
    input: UpdateMediaCollectionInput
  ): Promise<MediaCollection | null>;
  listCandidates(filters?: MediaCandidateListFilters): Promise<MediaCandidate[]>;
  getCandidateById(id: string): Promise<MediaCandidate | null>;
  createCandidate(input: CreateMediaCandidateInput): Promise<MediaCandidate>;
  updateCandidate(
    id: string,
    input: UpdateMediaCandidateInput
  ): Promise<MediaCandidate | null>;
}

