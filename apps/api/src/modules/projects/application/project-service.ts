import type { AssetRepository } from "../../assets/application/asset-repository.js";
import type { ChannelRepository } from "../../channels/application/channel-repository.js";
import { NotFoundError, ValidationError } from "../../../shared/errors.js";
import type {
  CreateProjectInput,
  CreateSceneInput,
  ReorderScenesInput,
  UpdateProjectInput,
  UpdateSceneInput
} from "../domain/project.js";
import type { ProjectRepository } from "./project-repository.js";

function buildProjectNotFoundError(projectId: string) {
  return new NotFoundError(`Video project '${projectId}' was not found.`);
}

function buildSceneNotFoundError(sceneId: string, projectId: string) {
  return new NotFoundError(
    `Scene '${sceneId}' was not found in video project '${projectId}'.`
  );
}

async function ensureProjectExists(
  repository: ProjectRepository,
  projectId: string
) {
  const project = await repository.getById(projectId);

  if (!project) {
    throw buildProjectNotFoundError(projectId);
  }

  return project;
}

async function ensureChannelExists(
  channelRepository: ChannelRepository,
  channelId: string
) {
  const channel = await channelRepository.getById(channelId);

  if (!channel) {
    throw new NotFoundError(`Channel '${channelId}' was not found.`);
  }
}

async function ensureAssetExists(
  assetRepository: AssetRepository,
  assetId: string
) {
  const asset = await assetRepository.getById(assetId);

  if (!asset) {
    throw new NotFoundError(`Asset '${assetId}' was not found.`);
  }
}

function clampOrder(value: number, totalScenes: number) {
  return Math.min(Math.max(value, 1), totalScenes);
}

function moveSceneIdToOrder(
  sceneIds: string[],
  sceneId: string,
  targetOrder: number
) {
  const currentIndex = sceneIds.findIndex((entry) => entry === sceneId);

  if (currentIndex === -1) {
    return sceneIds;
  }

  const nextIds = [...sceneIds];
  nextIds.splice(currentIndex, 1);
  nextIds.splice(targetOrder - 1, 0, sceneId);
  return nextIds;
}

function hasScenePatch(input: Omit<UpdateSceneInput, "order">) {
  return Object.keys(input).length > 0;
}

async function moveSceneWithinProject(
  repository: ProjectRepository,
  projectId: string,
  sceneId: string,
  requestedOrder: number
) {
  const scenes = await repository.listScenes(projectId);
  const targetOrder = clampOrder(requestedOrder, scenes.length);
  const reorderedIds = moveSceneIdToOrder(
    scenes.map((scene) => scene.id),
    sceneId,
    targetOrder
  );

  await repository.reorderScenes(projectId, reorderedIds);

  const updatedScene = await repository.getSceneById(projectId, sceneId);

  if (!updatedScene) {
    throw buildSceneNotFoundError(sceneId, projectId);
  }

  return updatedScene;
}

export async function listVideoProjects(repository: ProjectRepository) {
  return repository.list();
}

export async function getVideoProjectById(
  repository: ProjectRepository,
  id: string
) {
  const project = await repository.getById(id);

  if (!project) {
    throw buildProjectNotFoundError(id);
  }

  return project;
}

export async function createVideoProject(
  repository: ProjectRepository,
  channelRepository: ChannelRepository,
  assetRepository: AssetRepository,
  input: CreateProjectInput
) {
  await ensureChannelExists(channelRepository, input.channelId);

  if (input.backgroundMusicAssetId) {
    await ensureAssetExists(assetRepository, input.backgroundMusicAssetId);
  }

  if (input.voiceoverAssetId) {
    await ensureAssetExists(assetRepository, input.voiceoverAssetId);
  }

  return repository.create(input);
}

export async function updateVideoProject(
  repository: ProjectRepository,
  channelRepository: ChannelRepository,
  assetRepository: AssetRepository,
  id: string,
  input: UpdateProjectInput
) {
  if (input.channelId) {
    await ensureChannelExists(channelRepository, input.channelId);
  }

  if (input.backgroundMusicAssetId) {
    await ensureAssetExists(assetRepository, input.backgroundMusicAssetId);
  }

  if (input.voiceoverAssetId) {
    await ensureAssetExists(assetRepository, input.voiceoverAssetId);
  }

  const project = await repository.update(id, input);

  if (!project) {
    throw buildProjectNotFoundError(id);
  }

  return project;
}

export async function deleteVideoProject(
  repository: ProjectRepository,
  id: string
) {
  const deleted = await repository.delete(id);

  if (!deleted) {
    throw buildProjectNotFoundError(id);
  }
}

export async function listProjectScenes(
  repository: ProjectRepository,
  projectId: string
) {
  await ensureProjectExists(repository, projectId);
  return repository.listScenes(projectId);
}

export async function createProjectScene(
  repository: ProjectRepository,
  assetRepository: AssetRepository,
  projectId: string,
  input: CreateSceneInput
) {
  await ensureProjectExists(repository, projectId);

  if (input.assetId) {
    await ensureAssetExists(assetRepository, input.assetId);
  }

  if (input.sfxAssetId) {
    await ensureAssetExists(assetRepository, input.sfxAssetId);
  }

  const { order, ...sceneInput } = input;
  const scene = await repository.createScene(projectId, sceneInput);

  if (!scene) {
    throw buildProjectNotFoundError(projectId);
  }

  if (typeof order !== "number") {
    return scene;
  }

  return moveSceneWithinProject(repository, projectId, scene.id, order);
}

export async function updateProjectScene(
  repository: ProjectRepository,
  assetRepository: AssetRepository,
  projectId: string,
  sceneId: string,
  input: UpdateSceneInput
) {
  await ensureProjectExists(repository, projectId);

  const existingScene = await repository.getSceneById(projectId, sceneId);

  if (!existingScene) {
    throw buildSceneNotFoundError(sceneId, projectId);
  }

  if (input.assetId) {
    await ensureAssetExists(assetRepository, input.assetId);
  }

  if (input.sfxAssetId) {
    await ensureAssetExists(assetRepository, input.sfxAssetId);
  }

  const { order, ...scenePatch } = input;
  let scene = existingScene;

  if (hasScenePatch(scenePatch)) {
    const updatedScene = await repository.updateScene(
      projectId,
      sceneId,
      scenePatch
    );

    if (!updatedScene) {
      throw buildSceneNotFoundError(sceneId, projectId);
    }

    scene = updatedScene;
  }

  if (typeof order !== "number") {
    return scene;
  }

  return moveSceneWithinProject(repository, projectId, sceneId, order);
}

export async function deleteProjectScene(
  repository: ProjectRepository,
  projectId: string,
  sceneId: string
) {
  await ensureProjectExists(repository, projectId);

  const deleted = await repository.deleteScene(projectId, sceneId);

  if (!deleted) {
    throw buildSceneNotFoundError(sceneId, projectId);
  }
}

export async function reorderProjectScenes(
  repository: ProjectRepository,
  projectId: string,
  input: ReorderScenesInput
) {
  await ensureProjectExists(repository, projectId);

  const currentScenes = await repository.listScenes(projectId);
  const currentIds = currentScenes.map((scene) => scene.id);
  const requestedIds = input.sceneIds;

  if (new Set(requestedIds).size !== requestedIds.length) {
    throw new ValidationError(
      "sceneIds must contain each scene only once."
    );
  }

  if (requestedIds.length !== currentIds.length) {
    throw new ValidationError(
      "sceneIds must include every scene in the project exactly once."
    );
  }

  if (requestedIds.some((sceneId) => !currentIds.includes(sceneId))) {
    throw new ValidationError(
      "sceneIds contains a scene that does not belong to this project."
    );
  }

  return repository.reorderScenes(projectId, requestedIds);
}

