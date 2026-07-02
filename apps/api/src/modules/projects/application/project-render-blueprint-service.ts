import {
  buildRenderBlueprint,
  type RenderBlueprint
} from "@reelforge/video-engine";
import { NotFoundError } from "../../../shared/errors.js";
import type { AssetRepository } from "../../assets/application/asset-repository.js";
import type { EditorialMicroclipRepository } from "../../editorial-microclips/application/editorial-microclip-repository.js";
import type { ProjectRepository } from "./project-repository.js";
import { mapProjectToBlueprintInput } from "./project-video-engine-mapper.js";
import { resolveProjectAudioAssets } from "./project-audio-plan-service.js";

const emptyEditorialMicroclipRepository: EditorialMicroclipRepository = {
  async listByProjectId() {
    return [];
  },
  async getById() {
    return null;
  },
  async create() {
    throw new Error("Editorial microclip creation is unavailable in empty repository mode.");
  },
  async update() {
    return null;
  },
  async delete() {
    return false;
  },
  async countByProjectId() {
    return 0;
  }
};

export async function getVideoProjectRenderBlueprint(
  repository: ProjectRepository,
  assetRepository: AssetRepository,
  editorialMicroclipRepositoryOrProjectId:
    | EditorialMicroclipRepository
    | string,
  projectIdMaybe?: string
): Promise<RenderBlueprint> {
  const editorialMicroclipRepository =
    typeof editorialMicroclipRepositoryOrProjectId === "string"
      ? emptyEditorialMicroclipRepository
      : editorialMicroclipRepositoryOrProjectId;
  const projectId =
    typeof editorialMicroclipRepositoryOrProjectId === "string"
      ? editorialMicroclipRepositoryOrProjectId
      : (projectIdMaybe ?? "");
  const project = await repository.getById(projectId);

  if (!project) {
    throw new NotFoundError(`Video project '${projectId}' was not found.`);
  }

  const resolvedAudioAssets = await resolveProjectAudioAssets(
    assetRepository,
    project
  );
  const editorialMicroclips =
    await editorialMicroclipRepository.listByProjectId(projectId);

  return buildRenderBlueprint(
    mapProjectToBlueprintInput(project, resolvedAudioAssets, editorialMicroclips)
  );
}

