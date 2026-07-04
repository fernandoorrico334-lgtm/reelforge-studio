import type {
  CreateReelProductionRunInput,
  ReelProductionRun,
  UpdateReelProductionRunInput
} from "../domain/reel-production.js";

export interface ReelProductionRunRepository {
  listByProjectId(videoProjectId: string): Promise<ReelProductionRun[]>;
  getById(id: string): Promise<ReelProductionRun | null>;
  create(input: CreateReelProductionRunInput): Promise<ReelProductionRun>;
  update(
    id: string,
    input: UpdateReelProductionRunInput
  ): Promise<ReelProductionRun | null>;
}
