import { NotFoundError, ValidationError } from "../../../shared/errors.js";
import type { AssetRepository } from "../../assets/application/asset-repository.js";
import type { ProjectRepository } from "../../projects/application/project-repository.js";
import type { EditorialMicroclipRepository } from "./editorial-microclip-repository.js";
import {
  mergeEditorialMicroclipMetadata,
  type CreateEditorialMicroclipInput,
  type EditorialMicroclip,
  type UpdateEditorialMicroclipInput
} from "../domain/editorial-microclip.js";

const maxMicroclipsPerProject = 2;
const recommendedMaxSingleDurationSeconds = 2.5;
const recommendedMaxTotalDurationSeconds = 4.5;

function buildProjectNotFoundError(projectId: string) {
  return new NotFoundError(`Video project '${projectId}' was not found.`);
}

function buildSceneNotFoundError(sceneId: string) {
  return new NotFoundError(`Scene '${sceneId}' was not found.`);
}

function buildMicroclipNotFoundError(microclipId: string) {
  return new NotFoundError(`Editorial microclip '${microclipId}' was not found.`);
}

function roundToThreeDecimals(value: number) {
  return Math.round(value * 1000) / 1000;
}

async function ensureProjectExists(
  projectRepository: ProjectRepository,
  projectId: string
) {
  const project = await projectRepository.getById(projectId);

  if (!project) {
    throw buildProjectNotFoundError(projectId);
  }

  return project;
}

async function ensureSceneBelongsToProject(
  projectRepository: ProjectRepository,
  projectId: string,
  sceneId: string | null
) {
  if (!sceneId) {
    return null;
  }

  const scene = await projectRepository.getSceneById(projectId, sceneId);

  if (!scene) {
    throw buildSceneNotFoundError(sceneId);
  }

  return scene;
}

async function ensureVideoAsset(
  assetRepository: AssetRepository,
  assetId: string
) {
  const asset = await assetRepository.getById(assetId);

  if (!asset) {
    throw new NotFoundError(`Asset '${assetId}' was not found.`);
  }

  if (asset.type !== "VIDEO") {
    throw new ValidationError(
      `Asset '${assetId}' must be VIDEO to be used as an editorial microclip.`
    );
  }

  return asset;
}

function validateTimes(startTimeSeconds: number, endTimeSeconds: number) {
  if (endTimeSeconds <= startTimeSeconds) {
    throw new ValidationError(
      "endTimeSeconds must be greater than startTimeSeconds."
    );
  }

  return roundToThreeDecimals(endTimeSeconds - startTimeSeconds);
}

async function buildWarnings(
  repository: EditorialMicroclipRepository,
  projectId: string,
  durationSeconds: number,
  existingMicroclipId: string | null = null
) {
  const currentMicroclips = await repository.listByProjectId(projectId);
  const relevantMicroclips = existingMicroclipId
    ? currentMicroclips.filter((clip) => clip.id !== existingMicroclipId)
    : currentMicroclips;
  const warnings: string[] = [];
  const nextTotalDuration = roundToThreeDecimals(
    durationSeconds +
      relevantMicroclips.reduce((total, clip) => total + clip.durationSeconds, 0)
  );

  if (durationSeconds > recommendedMaxSingleDurationSeconds) {
    warnings.push(
      `Microclip duration ${durationSeconds}s is above the recommended ${recommendedMaxSingleDurationSeconds}s editorial limit.`
    );
  }

  if (nextTotalDuration > recommendedMaxTotalDurationSeconds) {
    warnings.push(
      `Project total microclip duration ${nextTotalDuration}s is above the recommended ${recommendedMaxTotalDurationSeconds}s limit.`
    );
  }

  return warnings;
}

export async function listEditorialMicroclipsForProject(
  repository: EditorialMicroclipRepository,
  projectRepository: ProjectRepository,
  projectId: string
) {
  await ensureProjectExists(projectRepository, projectId);
  return repository.listByProjectId(projectId);
}

export async function getEditorialMicroclipById(
  repository: EditorialMicroclipRepository,
  microclipId: string
) {
  const microclip = await repository.getById(microclipId);

  if (!microclip) {
    throw buildMicroclipNotFoundError(microclipId);
  }

  return microclip;
}

export async function createEditorialMicroclip(
  repository: EditorialMicroclipRepository,
  projectRepository: ProjectRepository,
  assetRepository: AssetRepository,
  input: CreateEditorialMicroclipInput
) {
  await ensureProjectExists(projectRepository, input.projectId);
  await ensureSceneBelongsToProject(projectRepository, input.projectId, input.sceneId);
  await ensureVideoAsset(assetRepository, input.assetId);

  const currentCount = await repository.countByProjectId(input.projectId);

  if (currentCount >= maxMicroclipsPerProject) {
    throw new ValidationError(
      `Project '${input.projectId}' already reached the limit of ${maxMicroclipsPerProject} editorial microclips.`
    );
  }

  const durationSeconds = validateTimes(
    input.startTimeSeconds,
    input.endTimeSeconds
  );
  const warnings = await buildWarnings(
    repository,
    input.projectId,
    durationSeconds
  );

  return repository.create({
    ...input,
    durationSeconds,
    metadata: mergeEditorialMicroclipMetadata(input.metadata, warnings)
  });
}

export async function updateEditorialMicroclip(
  repository: EditorialMicroclipRepository,
  projectRepository: ProjectRepository,
  assetRepository: AssetRepository,
  microclipId: string,
  input: UpdateEditorialMicroclipInput
) {
  const existing = await repository.getById(microclipId);

  if (!existing) {
    throw buildMicroclipNotFoundError(microclipId);
  }

  if (input.sceneId !== undefined) {
    await ensureSceneBelongsToProject(
      projectRepository,
      existing.projectId,
      input.sceneId ?? null
    );
  }

  if (input.assetId) {
    await ensureVideoAsset(assetRepository, input.assetId);
  }

  const startTimeSeconds = input.startTimeSeconds ?? existing.startTimeSeconds;
  const endTimeSeconds = input.endTimeSeconds ?? existing.endTimeSeconds;
  const durationSeconds = validateTimes(startTimeSeconds, endTimeSeconds);
  const warnings = await buildWarnings(
    repository,
    existing.projectId,
    durationSeconds,
    existing.id
  );
  const nextMetadata =
    "metadata" in input
      ? mergeEditorialMicroclipMetadata(input.metadata ?? null, warnings)
      : mergeEditorialMicroclipMetadata(existing.metadata, warnings);

  const updated = await repository.update(microclipId, {
    ...input,
    durationSeconds,
    metadata: nextMetadata
  });

  if (!updated) {
    throw buildMicroclipNotFoundError(microclipId);
  }

  return updated;
}

export async function deleteEditorialMicroclip(
  repository: EditorialMicroclipRepository,
  microclipId: string
) {
  const deleted = await repository.delete(microclipId);

  if (!deleted) {
    throw buildMicroclipNotFoundError(microclipId);
  }
}

export function groupEditorialMicroclipsByScene(
  microclips: EditorialMicroclip[]
) {
  return microclips.reduce<Record<string, EditorialMicroclip[]>>((accumulator, clip) => {
    if (!clip.sceneId) {
      return accumulator;
    }

    if (!accumulator[clip.sceneId]) {
      accumulator[clip.sceneId] = [];
    }

    accumulator[clip.sceneId]?.push(clip);
    accumulator[clip.sceneId]?.sort((left, right) => left.orderIndex - right.orderIndex);
    return accumulator;
  }, {});
}
