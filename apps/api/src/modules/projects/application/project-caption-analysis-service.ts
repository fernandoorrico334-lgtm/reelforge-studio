import {
  buildProjectCaptionAnalysis,
  type ProjectCaptionAnalysis
} from "@reelforge/video-engine";
import { NotFoundError } from "../../../shared/errors.js";
import type { ProjectRepository } from "./project-repository.js";
import { mapProjectToBlueprintInput } from "./project-video-engine-mapper.js";

export async function getVideoProjectCaptionAnalysis(
  repository: ProjectRepository,
  projectId: string
): Promise<ProjectCaptionAnalysis> {
  const project = await repository.getById(projectId);

  if (!project) {
    throw new NotFoundError(`Video project '${projectId}' was not found.`);
  }

  return buildProjectCaptionAnalysis(mapProjectToBlueprintInput(project));
}