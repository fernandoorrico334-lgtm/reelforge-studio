import {
  createMemoryId,
  createTimestamp,
  getMemoryStudioState
} from "../../../infrastructure/memory/studio-memory-store.js";
import type { ProjectRepository } from "../application/project-repository.js";
import type {
  CreateProjectInput,
  ProjectScene,
  StudioProject,
  UpdateProjectInput,
  UpdateSceneInput
} from "../domain/project.js";

export function createProjectRepository(): ProjectRepository {
  const state = getMemoryStudioState();

  function mapScene(sceneId: string): ProjectScene | null {
    const scene = state.scenes.find((entry) => entry.id === sceneId);

    if (!scene) {
      return null;
    }

    return {
      ...scene,
      asset: scene.assetId
        ? state.assets.find((asset) => asset.id === scene.assetId) ?? null
        : null,
      generatedAsset: scene.generatedAssetId
        ? state.assets.find((asset) => asset.id === scene.generatedAssetId) ?? null
        : null
    };
  }

  function listMappedScenes(projectId: string) {
    return state.scenes
      .filter((scene) => scene.videoProjectId === projectId)
      .sort((left, right) => left.order - right.order)
      .map((scene) => mapScene(scene.id))
      .filter((scene): scene is ProjectScene => scene !== null);
  }

  function mapProject(projectId: string): StudioProject | null {
    const project = state.videoProjects.find((entry) => entry.id === projectId);

    if (!project) {
      return null;
    }

    const channel = state.channels.find((entry) => entry.id === project.channelId);

    if (!channel) {
      return null;
    }

    return {
      ...project,
      channel,
      scenes: listMappedScenes(project.id)
    };
  }

  function reorderRemainingScenes(projectId: string) {
    const timestamp = createTimestamp();
    const orderedScenes = state.scenes
      .filter((scene) => scene.videoProjectId === projectId)
      .sort((left, right) => left.order - right.order);

    orderedScenes.forEach((scene, index) => {
      scene.order = index + 1;
      scene.updatedAt = timestamp;
    });
  }

  return {
    async list() {
      return state.videoProjects
        .map((project) => mapProject(project.id))
        .filter((project): project is StudioProject => project !== null)
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
    },
    async getById(id: string) {
      return mapProject(id);
    },
    async create(input: CreateProjectInput) {
      const timestamp = createTimestamp();
      const project = {
        id: createMemoryId("project"),
        createdAt: timestamp,
        updatedAt: timestamp,
        ...input,
        musicVolume: input.musicVolume ?? 0.18,
        voiceVolume: input.voiceVolume ?? 1,
        sfxVolume: input.sfxVolume ?? 0.7,
        enableAudioDucking: input.enableAudioDucking ?? false,
        duckingLevel: input.duckingLevel ?? 0.35
      };

      state.videoProjects.unshift(project);

      return mapProject(project.id) as StudioProject;
    },
    async update(id: string, input: UpdateProjectInput) {
      const projectIndex = state.videoProjects.findIndex(
        (project) => project.id === id
      );

      if (projectIndex === -1) {
        return null;
      }

      const existingProject = state.videoProjects[projectIndex];

      if (!existingProject) {
        return null;
      }

      state.videoProjects[projectIndex] = {
        ...existingProject,
        ...input,
        musicVolume:
          "musicVolume" in input ? input.musicVolume ?? 0.18 : existingProject.musicVolume,
        voiceVolume:
          "voiceVolume" in input ? input.voiceVolume ?? 1 : existingProject.voiceVolume,
        sfxVolume:
          "sfxVolume" in input ? input.sfxVolume ?? 0.7 : existingProject.sfxVolume,
        enableAudioDucking:
          "enableAudioDucking" in input
            ? input.enableAudioDucking ?? false
            : existingProject.enableAudioDucking,
        duckingLevel:
          "duckingLevel" in input ? input.duckingLevel ?? 0.35 : existingProject.duckingLevel,
        updatedAt: createTimestamp()
      };

      return mapProject(id);
    },
    async delete(id: string) {
      const projectIndex = state.videoProjects.findIndex(
        (project) => project.id === id
      );

      if (projectIndex === -1) {
        return false;
      }

      state.videoProjects.splice(projectIndex, 1);
      state.scenes = state.scenes.filter((scene) => scene.videoProjectId !== id);
      return true;
    },
    async listScenes(projectId: string) {
      return listMappedScenes(projectId);
    },
    async getSceneById(projectId: string, sceneId: string) {
      const scene = state.scenes.find(
        (entry) => entry.id === sceneId && entry.videoProjectId === projectId
      );

      return scene ? mapScene(scene.id) : null;
    },
    async createScene(projectId, input) {
      const project = state.videoProjects.find((entry) => entry.id === projectId);

      if (!project) {
        return null;
      }

      const timestamp = createTimestamp();
      const lastOrder = state.scenes
        .filter((scene) => scene.videoProjectId === projectId)
        .reduce((highestOrder, scene) => Math.max(highestOrder, scene.order), 0);

      const scene = {
        id: createMemoryId("scene"),
        videoProjectId: projectId,
        order: lastOrder + 1,
        createdAt: timestamp,
        updatedAt: timestamp,
        ...input,
        generatedAssetId: input.generatedAssetId ?? null,
        characterProfileId: input.characterProfileId ?? null,
        sfxStartTime: input.sfxStartTime ?? 0,
        sfxVolume: input.sfxVolume ?? 0.7,
        visualSourceMode: input.visualSourceMode ?? null,
        visualPrompt: input.visualPrompt ?? null,
        negativePrompt: input.negativePrompt ?? null,
        visualRecipe: input.visualRecipe ?? null,
        generationStatus: input.generationStatus ?? null,
        generationProvider: input.generationProvider ?? null,
        generationSeed: input.generationSeed ?? null
      };

      state.scenes.push(scene);

      const sceneView = mapScene(scene.id);
      return sceneView;
    },
    async updateScene(projectId, sceneId, input) {
      const sceneIndex = state.scenes.findIndex(
        (scene) => scene.id === sceneId && scene.videoProjectId === projectId
      );

      if (sceneIndex === -1) {
        return null;
      }

      const existingScene = state.scenes[sceneIndex];

      if (!existingScene) {
        return null;
      }

      state.scenes[sceneIndex] = {
        ...existingScene,
        ...input,
        generatedAssetId:
          "generatedAssetId" in input ? input.generatedAssetId ?? null : existingScene.generatedAssetId,
        characterProfileId:
          "characterProfileId" in input
            ? input.characterProfileId ?? null
            : existingScene.characterProfileId,
        sfxStartTime:
          "sfxStartTime" in input ? input.sfxStartTime ?? 0 : existingScene.sfxStartTime,
        sfxVolume:
          "sfxVolume" in input ? input.sfxVolume ?? 0.7 : existingScene.sfxVolume,
        visualSourceMode:
          "visualSourceMode" in input
            ? input.visualSourceMode ?? null
            : existingScene.visualSourceMode,
        visualPrompt:
          "visualPrompt" in input ? input.visualPrompt ?? null : existingScene.visualPrompt,
        negativePrompt:
          "negativePrompt" in input ? input.negativePrompt ?? null : existingScene.negativePrompt,
        visualRecipe:
          "visualRecipe" in input ? input.visualRecipe ?? null : existingScene.visualRecipe,
        generationStatus:
          "generationStatus" in input
            ? input.generationStatus ?? null
            : existingScene.generationStatus,
        generationProvider:
          "generationProvider" in input
            ? input.generationProvider ?? null
            : existingScene.generationProvider,
        generationSeed:
          "generationSeed" in input
            ? input.generationSeed ?? null
            : existingScene.generationSeed,
        updatedAt: createTimestamp()
      };

      return mapScene(sceneId);
    },
    async deleteScene(projectId, sceneId) {
      const sceneIndex = state.scenes.findIndex(
        (scene) => scene.id === sceneId && scene.videoProjectId === projectId
      );

      if (sceneIndex === -1) {
        return false;
      }

      state.scenes.splice(sceneIndex, 1);
      reorderRemainingScenes(projectId);
      return true;
    },
    async reorderScenes(projectId, sceneIds) {
      const timestamp = createTimestamp();

      sceneIds.forEach((sceneId, index) => {
        const scene = state.scenes.find(
          (entry) => entry.id === sceneId && entry.videoProjectId === projectId
        );

        if (!scene) {
          return;
        }

        scene.order = index + 1;
        scene.updatedAt = timestamp;
      });

      return listMappedScenes(projectId);
    },
    async count() {
      return state.videoProjects.length;
    }
  };
}

