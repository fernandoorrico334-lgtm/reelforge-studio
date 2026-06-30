import type {
  CreateProjectInput,
  CreateSceneInput,
  ProjectScene,
  StudioProject,
  UpdateProjectInput,
  UpdateSceneInput
} from "../domain/project.js";

export interface ProjectRepository {
  list(): Promise<StudioProject[]>;
  getById(id: string): Promise<StudioProject | null>;
  create(input: CreateProjectInput): Promise<StudioProject>;
  update(
    id: string,
    input: UpdateProjectInput
  ): Promise<StudioProject | null>;
  delete(id: string): Promise<boolean>;
  listScenes(projectId: string): Promise<ProjectScene[]>;
  getSceneById(
    projectId: string,
    sceneId: string
  ): Promise<ProjectScene | null>;
  createScene(
    projectId: string,
    input: Omit<CreateSceneInput, "order">
  ): Promise<ProjectScene | null>;
  updateScene(
    projectId: string,
    sceneId: string,
    input: Omit<UpdateSceneInput, "order">
  ): Promise<ProjectScene | null>;
  deleteScene(projectId: string, sceneId: string): Promise<boolean>;
  reorderScenes(
    projectId: string,
    sceneIds: string[]
  ): Promise<ProjectScene[]>;
  count(): Promise<number>;
}

