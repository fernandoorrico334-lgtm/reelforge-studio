import {
  buildRenderBlueprint,
  type RenderBlueprint
} from "@reelforge/video-engine";
import { NotFoundError } from "../../../shared/errors.js";
import type { AssetRepository } from "../../assets/application/asset-repository.js";
import type { ProjectRepository } from "./project-repository.js";
import { mapProjectToBlueprintInput } from "./project-video-engine-mapper.js";
import { resolveProjectAudioAssets } from "./project-audio-plan-service.js";

export async function getVideoProjectRenderBlueprint(
  repository: ProjectRepository,
  assetRepository: AssetRepository,
  projectId: string
): Promise<RenderBlueprint> {
  const project = await repository.getById(projectId);

  if (!project) {
    throw new NotFoundError(`Video project '${projectId}' was not found.`);
  }

  const resolvedAudioAssets = await resolveProjectAudioAssets(
    assetRepository,
    project
  );

  return buildRenderBlueprint(
    mapProjectToBlueprintInput(project, resolvedAudioAssets)
  );
}

