import type {
  CreateVisualGenerationJobInput,
  UpdateVisualGenerationJobInput,
  VisualGenerationJob,
  VisualGenerationJobFilters
} from "../domain/visual-generation.js";

export interface VisualGenerationJobRepository {
  list(filters?: VisualGenerationJobFilters): Promise<VisualGenerationJob[]>;
  getById(id: string): Promise<VisualGenerationJob | null>;
  create(input: CreateVisualGenerationJobInput): Promise<VisualGenerationJob>;
  update(
    id: string,
    input: UpdateVisualGenerationJobInput
  ): Promise<VisualGenerationJob | null>;
}

