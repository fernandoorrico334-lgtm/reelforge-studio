import type {
  CreateRenderJobInput,
  StudioRenderJob,
  UpdateRenderJobInput
} from "../domain/render-job.js";

export interface RenderJobRepository {
  list(): Promise<StudioRenderJob[]>;
  listByProjectId(videoProjectId: string): Promise<StudioRenderJob[]>;
  getById(id: string): Promise<StudioRenderJob | null>;
  createQueued(input: CreateRenderJobInput): Promise<StudioRenderJob>;
  update(
    id: string,
    input: UpdateRenderJobInput
  ): Promise<StudioRenderJob | null>;
  delete(id: string): Promise<boolean>;
  count(): Promise<number>;
}

