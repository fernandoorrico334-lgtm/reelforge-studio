import type {
  CreateNarrationJobInput,
  NarrationJob,
  NarrationJobFilters,
  UpdateNarrationJobInput
} from "../domain/narration.js";

export interface NarrationJobRepository {
  list(filters?: NarrationJobFilters): Promise<NarrationJob[]>;
  getById(id: string): Promise<NarrationJob | null>;
  create(input: CreateNarrationJobInput): Promise<NarrationJob>;
  update(
    id: string,
    input: UpdateNarrationJobInput
  ): Promise<NarrationJob | null>;
}
