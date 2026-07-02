import { access } from "node:fs/promises";
import {
  buildAudioMixPlan,
  type AudioAssetInput
} from "@reelforge/audio-engine";
import { projectRoot } from "../../../config/paths.js";
import { NotFoundError } from "../../../shared/errors.js";
import type { AssetRepository } from "../../assets/application/asset-repository.js";
import type { StudioAsset } from "../../assets/domain/asset.js";
import type { EditorialMicroclipRepository } from "../../editorial-microclips/application/editorial-microclip-repository.js";
import type { StudioProject } from "../domain/project.js";
import type { ProjectRepository } from "./project-repository.js";

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

interface ResolvedProjectAudioAssets {
  backgroundMusicAsset: StudioAsset | null;
  voiceoverAsset: StudioAsset | null;
  sceneSfxAssets: Record<string, StudioAsset | null>;
  sceneNarrationAssets: Record<string, StudioAsset | null>;
}

function toAudioAssetInput(asset: StudioAsset | null): AudioAssetInput | null {
  if (!asset) {
    return null;
  }

  return {
    id: asset.id,
    filename: asset.filename,
    path: asset.path,
    type: asset.type,
    duration: asset.duration,
    mimeType: asset.mimeType,
    extension: asset.extension
  };
}

function buildAudioAssetCatalog(
  resolvedAssets: ResolvedProjectAudioAssets
): AudioAssetInput[] {
  const assets = [
    resolvedAssets.backgroundMusicAsset,
    resolvedAssets.voiceoverAsset,
    ...Object.values(resolvedAssets.sceneSfxAssets),
    ...Object.values(resolvedAssets.sceneNarrationAssets)
  ]
    .map(toAudioAssetInput)
    .filter((asset): asset is AudioAssetInput => asset !== null);

  return [...new Map(assets.map((asset) => [asset.id, asset])).values()];
}

async function fileExists(relativePath: string) {
  try {
    const { resolveStoragePath } = await import("@reelforge/video-engine/render-server");
    await access(resolveStoragePath(projectRoot, relativePath));
    return true;
  } catch {
    return false;
  }
}

async function resolveAssetById(
  assetRepository: AssetRepository,
  assetId: string | null
) {
  if (!assetId) {
    return null;
  }

  return assetRepository.getById(assetId);
}

export async function resolveProjectAudioAssets(
  assetRepository: AssetRepository,
  project: StudioProject
): Promise<ResolvedProjectAudioAssets> {
  const [
    backgroundMusicAsset,
    voiceoverAsset,
    ...sceneAssetResults
  ] = await Promise.all([
    resolveAssetById(assetRepository, project.backgroundMusicAssetId),
    resolveAssetById(assetRepository, project.voiceoverAssetId),
    ...project.scenes.flatMap((scene) => [
      resolveAssetById(assetRepository, scene.sfxAssetId),
      resolveAssetById(
        assetRepository,
        scene.generatedNarrationAssetId ?? null
      )
    ])
  ]);

  return {
    backgroundMusicAsset,
    voiceoverAsset,
    sceneSfxAssets: Object.fromEntries(
      project.scenes.map((scene, index) => [
        scene.id,
        sceneAssetResults[index * 2] ?? null
      ])
    ),
    sceneNarrationAssets: Object.fromEntries(
      project.scenes.map((scene, index) => [
        scene.id,
        sceneAssetResults[index * 2 + 1] ?? null
      ])
    )
  };
}

export async function getVideoProjectAudioPlan(
  repository: ProjectRepository,
  assetRepository: AssetRepository,
  editorialMicroclipRepositoryOrProjectId:
    | EditorialMicroclipRepository
    | string,
  projectIdMaybe?: string
) {
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

  const resolvedAssets = await resolveProjectAudioAssets(assetRepository, project);
  const editorialMicroclips =
    await editorialMicroclipRepository.listByProjectId(projectId);
  const audioAssets = [
    ...buildAudioAssetCatalog(resolvedAssets),
    ...editorialMicroclips
      .map((microclip) => toAudioAssetInput(microclip.asset))
      .filter((asset): asset is AudioAssetInput => asset !== null)
  ];

  return buildAudioMixPlan(
    {
      id: project.id,
      title: project.title,
      durationTarget: project.durationTarget,
      backgroundMusicAssetId: project.backgroundMusicAssetId,
      voiceoverAssetId: project.voiceoverAssetId,
      audioMood: project.audioMood,
      musicVolume: project.musicVolume,
      voiceVolume: project.voiceVolume,
      sfxVolume: project.sfxVolume,
      enableAudioDucking: project.enableAudioDucking,
      duckingLevel: project.duckingLevel
    },
    project.scenes.map((scene) => ({
      id: scene.id,
      order: scene.order,
      title: scene.title,
      duration: scene.duration,
      narrationAssetId: scene.generatedNarrationAssetId,
      narrationSource: scene.generatedNarrationAssetId ? "generated" : null,
      sfxAssetId: scene.sfxAssetId,
      sfxStartTime: scene.sfxStartTime,
      sfxVolume: scene.sfxVolume,
      clipAudioInserts: editorialMicroclips
        .filter(
          (microclip) =>
            microclip.sceneId === scene.id &&
            (microclip.volumeMode === "low_original" ||
              microclip.volumeMode === "keep_original")
        )
        .sort((left, right) => left.orderIndex - right.orderIndex)
        .map((microclip, index, items) => {
          const sceneDuration =
            typeof scene.duration === "number" && scene.duration > 0
              ? scene.duration
              : 4;
          const totalClipDuration = items.reduce(
            (total, entry) => total + entry.durationSeconds,
            0
          );
          const baseGap = Math.max(
            (sceneDuration - totalClipDuration) / (items.length + 1),
            0.08
          );
          const insertStartSeconds = Math.min(
            baseGap * (index + 1) +
              items
                .slice(0, index)
                .reduce((total, entry) => total + entry.durationSeconds, 0),
            Math.max(sceneDuration - microclip.durationSeconds, 0)
          );

          return {
            microclipId: microclip.id,
            label: microclip.label,
            assetId: microclip.assetId,
            startTime: Math.round(insertStartSeconds * 1000) / 1000,
            sourceStartTime: microclip.startTimeSeconds,
            duration: microclip.durationSeconds,
            volume: microclip.volumeMode === "keep_original" ? 0.78 : 0.34,
            volumeMode:
              microclip.volumeMode === "keep_original"
                ? "keep_original"
                : "low_original",
            narrationOverlay: microclip.narrationOverlay
          };
        })
    })),
    audioAssets,
    {
      resolveAssetExists: (asset) => {
        void asset;
        return true;
      }
    }
  );
}

export async function getVideoProjectAudioPlanWithDiskCheck(
  repository: ProjectRepository,
  assetRepository: AssetRepository,
  editorialMicroclipRepositoryOrProjectId:
    | EditorialMicroclipRepository
    | string,
  projectIdMaybe?: string
) {
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

  const resolvedAssets = await resolveProjectAudioAssets(assetRepository, project);
  const editorialMicroclips =
    await editorialMicroclipRepository.listByProjectId(projectId);
  const audioAssets = [
    ...buildAudioAssetCatalog(resolvedAssets),
    ...editorialMicroclips
      .map((microclip) => toAudioAssetInput(microclip.asset))
      .filter((asset): asset is AudioAssetInput => asset !== null)
  ];

  return buildAudioMixPlan(
    {
      id: project.id,
      title: project.title,
      durationTarget: project.durationTarget,
      backgroundMusicAssetId: project.backgroundMusicAssetId,
      voiceoverAssetId: project.voiceoverAssetId,
      audioMood: project.audioMood,
      musicVolume: project.musicVolume,
      voiceVolume: project.voiceVolume,
      sfxVolume: project.sfxVolume,
      enableAudioDucking: project.enableAudioDucking,
      duckingLevel: project.duckingLevel
    },
    project.scenes.map((scene) => ({
      id: scene.id,
      order: scene.order,
      title: scene.title,
      duration: scene.duration,
      narrationAssetId: scene.generatedNarrationAssetId,
      narrationSource: scene.generatedNarrationAssetId ? "generated" : null,
      sfxAssetId: scene.sfxAssetId,
      sfxStartTime: scene.sfxStartTime,
      sfxVolume: scene.sfxVolume,
      clipAudioInserts: editorialMicroclips
        .filter(
          (microclip) =>
            microclip.sceneId === scene.id &&
            (microclip.volumeMode === "low_original" ||
              microclip.volumeMode === "keep_original")
        )
        .sort((left, right) => left.orderIndex - right.orderIndex)
        .map((microclip, index, items) => {
          const sceneDuration =
            typeof scene.duration === "number" && scene.duration > 0
              ? scene.duration
              : 4;
          const totalClipDuration = items.reduce(
            (total, entry) => total + entry.durationSeconds,
            0
          );
          const baseGap = Math.max(
            (sceneDuration - totalClipDuration) / (items.length + 1),
            0.08
          );
          const insertStartSeconds = Math.min(
            baseGap * (index + 1) +
              items
                .slice(0, index)
                .reduce((total, entry) => total + entry.durationSeconds, 0),
            Math.max(sceneDuration - microclip.durationSeconds, 0)
          );

          return {
            microclipId: microclip.id,
            label: microclip.label,
            assetId: microclip.assetId,
            startTime: Math.round(insertStartSeconds * 1000) / 1000,
            sourceStartTime: microclip.startTimeSeconds,
            duration: microclip.durationSeconds,
            volume: microclip.volumeMode === "keep_original" ? 0.78 : 0.34,
            volumeMode:
              microclip.volumeMode === "keep_original"
                ? "keep_original"
                : "low_original",
            narrationOverlay: microclip.narrationOverlay
          };
        })
    })),
    audioAssets,
    {
      resolveAssetExists: (asset) => false
    }
  );
}

