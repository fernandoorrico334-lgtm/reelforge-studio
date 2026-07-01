import {
  buildNarrationPlan,
  buildNarrationTextFromScene,
  generateMockNarrationWav,
  generateWindowsSapiNarrationWav,
  getNarrationProviders,
  getVoicePackById,
  getVoicePacks,
  summarizeNarrationJob,
  type VoicePack
} from "@reelforge/narration-engine";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { AppEnv } from "../../../config/env.js";
import { assetsStorageRoot } from "../../../config/paths.js";
import { NotFoundError, ValidationError } from "../../../shared/errors.js";
import type { AssetRepository } from "../../assets/application/asset-repository.js";
import type { StudioAsset } from "../../assets/domain/asset.js";
import type { ProjectRepository } from "../../projects/application/project-repository.js";
import type { ProjectScene, StudioProject } from "../../projects/domain/project.js";
import type { NarrationJobRepository } from "./narration-job-repository.js";
import type {
  GeneratedNarrationGalleryFilters,
  GeneratedNarrationGalleryItem,
  GenerateNarrationRequestInput,
  GenerateNarrationResponse,
  NarrationJob,
  NarrationJobFilters,
  NarrationProvidersSnapshot,
  NarrationVoicePacksSnapshot,
  UseNarrationForSceneResponse
} from "../domain/narration.js";

type NarrationEnv = Pick<AppEnv, "narrationWindowsSapiEnabled">;

function buildNarrationJobNotFoundError(jobId: string) {
  return new NotFoundError(`Narration job '${jobId}' was not found.`);
}

function buildSceneNotFoundError(sceneId: string) {
  return new NotFoundError(`Scene '${sceneId}' was not found.`);
}

function resolveNarrationEnv(
  appEnv: Partial<NarrationEnv> = {}
): NarrationEnv {
  return {
    narrationWindowsSapiEnabled:
      typeof appEnv.narrationWindowsSapiEnabled === "boolean"
        ? appEnv.narrationWindowsSapiEnabled
        : String(process.env.NARRATION_WINDOWS_SAPI_ENABLED ?? "false")
            .trim()
            .toLowerCase() === "true"
  };
}

function buildGeneratedNarrationArtifactPaths(jobId: string) {
  const directory = join(assetsStorageRoot, "generated", "narrations");

  return {
    outputAbsolutePath: join(directory, `${jobId}.wav`),
    outputPath: `storage/assets/generated/narrations/${jobId}.wav`
  };
}

function toWordCount(text: string) {
  return text.split(/\s+/).filter(Boolean).length;
}

function buildJobMetadata(
  job: Pick<
    NarrationJob,
    | "id"
    | "videoProjectId"
    | "sceneId"
    | "provider"
    | "voicePackId"
    | "status"
    | "generatedAssetId"
    | "outputPath"
    | "errorMessage"
  >,
  voicePack: VoicePack,
  language: string,
  text: string,
  extras: Record<string, unknown> = {}
) {
  return {
    summary: summarizeNarrationJob({
      id: job.id,
      sceneId: job.sceneId,
      videoProjectId: job.videoProjectId,
      provider: job.provider,
      voicePackId: job.voicePackId,
      status: job.status,
      generatedAssetId: job.generatedAssetId,
      outputPath: job.outputPath,
      errorMessage: job.errorMessage
    }),
    provider: job.provider,
    voicePackId: voicePack.id,
    voicePackName: voicePack.name,
    language,
    text,
    wordCount: toWordCount(text),
    ...extras
  };
}

async function requireProjectAndSceneBySceneId(
  projectRepository: ProjectRepository,
  sceneId: string
) {
  const projects = await projectRepository.list();

  for (const project of projects) {
    const scene = project.scenes.find((entry) => entry.id === sceneId) ?? null;

    if (scene) {
      return {
        project,
        scene
      };
    }
  }

  throw buildSceneNotFoundError(sceneId);
}

function buildGalleryProjectSummary(project: StudioProject) {
  return {
    id: project.id,
    title: project.title,
    status: project.status,
    channelId: project.channelId,
    channelName: project.channel.name,
    format: project.format
  };
}

function buildGallerySceneSummary(projectId: string, scene: ProjectScene) {
  return {
    id: scene.id,
    order: scene.order,
    title: scene.title,
    videoProjectId: projectId,
    narrationText: scene.narrationText,
    duration: scene.duration,
    generatedNarrationAssetId: scene.generatedNarrationAssetId,
    narrationStatus: scene.narrationStatus,
    narrationProvider: scene.narrationProvider,
    narrationVoicePackId: scene.narrationVoicePackId
  };
}

function buildPreviewUrl(assetId: string | null) {
  return assetId ? `/media/assets/${encodeURIComponent(assetId)}` : null;
}

function toGeneratedNarrationItem(
  job: NarrationJob,
  project: StudioProject | null,
  scene: ProjectScene | null
): GeneratedNarrationGalleryItem {
  const asset = job.generatedAsset ?? null;
  const isCurrentSceneNarration = Boolean(
    scene && asset && scene.generatedNarrationAssetId === asset.id
  );

  return {
    job,
    asset,
    scene: scene && project ? buildGallerySceneSummary(project.id, scene) : null,
    project: project ? buildGalleryProjectSummary(project) : null,
    metadata: job.metadata ?? null,
    previewUrl: buildPreviewUrl(asset?.id ?? job.generatedAssetId),
    isCurrentSceneNarration,
    isSceneEffectiveNarration: isCurrentSceneNarration
  };
}

async function buildGeneratedNarrationItems(
  projectRepository: ProjectRepository,
  jobs: NarrationJob[]
) {
  const projects = await projectRepository.list();
  const projectMap = new Map(projects.map((project) => [project.id, project] as const));

  return jobs.map((job) => {
    const project =
      (job.videoProjectId ? projectMap.get(job.videoProjectId) ?? null : null) ??
      projects.find((entry) => entry.scenes.some((scene) => scene.id === job.sceneId)) ??
      null;
    const scene =
      job.sceneId && project
        ? project.scenes.find((entry) => entry.id === job.sceneId) ?? null
        : null;

    return toGeneratedNarrationItem(job, project, scene);
  });
}

function selectNarrationText(
  project: StudioProject,
  scene: ProjectScene,
  input: GenerateNarrationRequestInput
) {
  const provided = input.text?.trim() ?? "";

  if (provided) {
    return provided;
  }

  const built = buildNarrationTextFromScene(
    {
      id: scene.id,
      title: scene.title,
      narrationText: scene.narrationText,
      captionText: scene.captionText
    },
    {
      id: project.id,
      title: project.title,
      script: project.script,
      language: project.channel.language
    }
  );

  if (!built.trim()) {
    throw new ValidationError(
      `Scene '${scene.id}' does not have narration text, caption text or script context to build narration.`
    );
  }

  return built;
}

function createNarrationAssetInput(
  job: NarrationJob,
  scene: ProjectScene,
  voicePack: VoicePack,
  outputPath: string,
  durationSeconds: number,
  sampleRate: number
) {
  return {
    filename: `${job.id}.wav`,
    originalName: `${job.id}.wav`,
    path: outputPath,
    type: "AUDIO" as const,
    category: "TRACK" as const,
    franchise: scene.asset?.franchise ?? null,
    character: scene.asset?.character ?? null,
    emotion: scene.emotion,
    tags: [
      "generated-narration",
      "narration",
      scene.id,
      job.provider,
      voicePack.id,
      `scene:${scene.id}`,
      `provider:${job.provider}`,
      `voice-pack:${voicePack.id}`
    ],
    licenseType: "local-generated",
    copyrightRisk: "LOW" as const,
    recommendedUse: `Local narration generated for scene ${scene.order}.`,
    duration: Math.round(durationSeconds * 1000) / 1000,
    width: null,
    height: null,
    mimeType: "audio/wav",
    extension: ".wav",
    fileSize: null,
    sourceProvider: "narration-engine",
    usageNotes: `Voice pack ${voicePack.id} via ${job.provider}.`
  };
}

async function writeNarrationWav(
  provider: GenerateNarrationRequestInput["provider"],
  text: string,
  voicePack: VoicePack,
  outputAbsolutePath: string,
  language: string
) {
  if (provider === "windows-sapi-local") {
    return generateWindowsSapiNarrationWav({
      provider,
      voicePackId: voicePack.id,
      text,
      language,
      outputAbsolutePath
    });
  }

  const audio = generateMockNarrationWav({
    provider: "mock-tts",
    voicePackId: voicePack.id,
    language,
    text
  });

  await writeFile(outputAbsolutePath, audio.wavBuffer);
  return audio;
}

export async function listNarrationProvidersSnapshot(
  appEnv: Partial<NarrationEnv> = {}
): Promise<NarrationProvidersSnapshot> {
  const resolved = resolveNarrationEnv(appEnv);
  return getNarrationProviders({
    windowsSapiEnabled: resolved.narrationWindowsSapiEnabled
  });
}

export async function listNarrationVoicePacks(): Promise<NarrationVoicePacksSnapshot> {
  return getVoicePacks();
}

export async function getNarrationVoicePackByIdOrThrow(voicePackId: string) {
  const voicePack = getVoicePackById(voicePackId);

  if (!voicePack) {
    throw new NotFoundError(`Voice pack '${voicePackId}' was not found.`);
  }

  return voicePack;
}

export async function listNarrationJobsGallery(
  projectRepository: ProjectRepository,
  narrationJobRepository: NarrationJobRepository,
  filters: GeneratedNarrationGalleryFilters = {}
) {
  const repositoryFilters: NarrationJobFilters = {};

  if (filters.projectId) {
    repositoryFilters.videoProjectId = filters.projectId;
  }

  if (filters.sceneId) {
    repositoryFilters.sceneId = filters.sceneId;
  }

  if (filters.provider) {
    repositoryFilters.provider = filters.provider;
  }

  if (filters.voicePackId) {
    repositoryFilters.voicePackId = filters.voicePackId;
  }

  if (filters.status) {
    repositoryFilters.status = filters.status;
  }

  const jobs = await narrationJobRepository.list(repositoryFilters);

  return buildGeneratedNarrationItems(projectRepository, jobs);
}

export async function getNarrationJobDetail(
  projectRepository: ProjectRepository,
  narrationJobRepository: NarrationJobRepository,
  jobId: string
) {
  const job = await narrationJobRepository.getById(jobId);

  if (!job) {
    throw buildNarrationJobNotFoundError(jobId);
  }

  const [item] = await buildGeneratedNarrationItems(projectRepository, [job]);
  return item;
}

export async function listSceneNarrations(
  projectRepository: ProjectRepository,
  narrationJobRepository: NarrationJobRepository,
  sceneId: string
) {
  return listNarrationJobsGallery(projectRepository, narrationJobRepository, {
    sceneId
  });
}

export async function cancelNarrationJob(
  narrationJobRepository: NarrationJobRepository,
  jobId: string
) {
  const job = await narrationJobRepository.getById(jobId);

  if (!job) {
    throw buildNarrationJobNotFoundError(jobId);
  }

  if (
    job.status === "completed" ||
    job.status === "failed" ||
    job.status === "cancelled"
  ) {
    return job;
  }

  const cancelled = await narrationJobRepository.update(jobId, {
    status: "cancelled",
    errorMessage: null,
    completedAt: new Date().toISOString(),
    metadata: {
      ...(job.metadata ?? {}),
      cancelledBy: "api"
    }
  });

  return cancelled ?? job;
}

export async function useNarrationForScene(
  projectRepository: ProjectRepository,
  assetRepository: AssetRepository,
  narrationJobRepository: NarrationJobRepository,
  sceneId: string,
  assetId: string
): Promise<UseNarrationForSceneResponse> {
  const match = await requireProjectAndSceneBySceneId(projectRepository, sceneId);
  const asset = await assetRepository.getById(assetId);

  if (!asset) {
    throw new NotFoundError(`Asset '${assetId}' was not found.`);
  }

  if (asset.type !== "AUDIO") {
    throw new ValidationError(`Asset '${assetId}' must be AUDIO to be used as narration.`);
  }

  const jobs = await narrationJobRepository.list({ sceneId });
  const selectedJob = jobs.find((job) => job.generatedAssetId === assetId) ?? null;

  if (!selectedJob) {
    throw new ValidationError(
      `Asset '${assetId}' is not linked to a generated narration job for scene '${sceneId}'.`
    );
  }

  const updatedScene = await projectRepository.updateScene(
    match.project.id,
    match.scene.id,
    {
      generatedNarrationAssetId: asset.id,
      narrationStatus: selectedJob.status,
      narrationProvider: selectedJob.provider,
      narrationVoicePackId: selectedJob.voicePackId,
      narrationText: selectedJob.text
    }
  );

  if (!updatedScene) {
    throw buildSceneNotFoundError(sceneId);
  }

  return {
    scene: updatedScene,
    projectId: match.project.id,
    assetId: asset.id,
    selectedJobId: selectedJob.id
  };
}

export async function generateNarrationForScene(
  projectRepository: ProjectRepository,
  assetRepository: AssetRepository,
  narrationJobRepository: NarrationJobRepository,
  sceneId: string,
  input: GenerateNarrationRequestInput,
  appEnv: Partial<NarrationEnv> = {}
): Promise<GenerateNarrationResponse> {
  const env = resolveNarrationEnv(appEnv);
  const match = await requireProjectAndSceneBySceneId(projectRepository, sceneId);
  const text = selectNarrationText(match.project, match.scene, input);
  const voicePack =
    getVoicePackById(input.voicePackId) ?? getVoicePacks()[0];

  if (!voicePack) {
    throw new ValidationError("No narration voice packs are available.");
  }

  if (input.provider === "windows-sapi-local" && !env.narrationWindowsSapiEnabled) {
    throw new ValidationError(
      "windows-sapi-local is disabled. Set NARRATION_WINDOWS_SAPI_ENABLED=true to enable it."
    );
  }

  const plan = buildNarrationPlan({
    provider: input.provider,
    voicePackId: voicePack.id,
    language: input.language ?? match.project.channel.language ?? voicePack.language,
    text
  });
  const queuedJob = await narrationJobRepository.create({
    videoProjectId: match.project.id,
    sceneId: match.scene.id,
    provider: input.provider,
    voicePackId: voicePack.id,
    language: plan.language,
    status: input.provider === "mock-tts" ? "generating" : "queued",
    text,
    outputPath: null,
    generatedAssetId: null,
    durationSeconds: null,
    sampleRate: null,
    errorMessage: null,
    metadata: null,
    startedAt: new Date().toISOString(),
    completedAt: null
  });

  try {
    const artifact = buildGeneratedNarrationArtifactPaths(queuedJob.id);
    await mkdir(join(assetsStorageRoot, "generated", "narrations"), {
      recursive: true
    });
    const audio = await writeNarrationWav(
      input.provider,
      text,
      voicePack,
      artifact.outputAbsolutePath,
      plan.language
    );
    const asset = await assetRepository.create(
      createNarrationAssetInput(
        queuedJob,
        match.scene,
        voicePack,
        artifact.outputPath,
        audio.durationSeconds,
        audio.sampleRate
      )
    );
    const completedAt = new Date().toISOString();
    const nextJob = await narrationJobRepository.update(queuedJob.id, {
      status: "completed",
      outputPath: artifact.outputPath,
      generatedAssetId: asset.id,
      durationSeconds: audio.durationSeconds,
      sampleRate: audio.sampleRate,
      errorMessage: null,
      metadata: buildJobMetadata(
        {
          ...queuedJob,
          status: "completed",
          generatedAssetId: asset.id,
          outputPath: artifact.outputPath,
          errorMessage: null
        },
        voicePack,
        plan.language,
        text,
        {
          durationSeconds: audio.durationSeconds,
          sampleRate: audio.sampleRate,
          seed: audio.seed
        }
      ),
      completedAt
    });

    const updatedScene = await projectRepository.updateScene(
      match.project.id,
      match.scene.id,
      {
        narrationText: text,
        generatedNarrationAssetId: input.autoAttach ? asset.id : match.scene.generatedNarrationAssetId,
        narrationStatus: "completed",
        narrationProvider: input.provider,
        narrationVoicePackId: voicePack.id
      }
    );

    return {
      job: nextJob ?? queuedJob,
      asset,
      scene: updatedScene
    };
  } catch (error) {
    const message =
      error instanceof Error && error.message.trim()
        ? error.message.trim()
        : "Narration generation failed.";

    await narrationJobRepository.update(queuedJob.id, {
      status: "failed",
      errorMessage: message,
      metadata: buildJobMetadata(
        {
          ...queuedJob,
          status: "failed",
          generatedAssetId: null,
          outputPath: null,
          errorMessage: message
        },
        voicePack,
        plan.language,
        text
      ),
      completedAt: new Date().toISOString()
    });

    await projectRepository.updateScene(match.project.id, match.scene.id, {
      narrationText: text,
      narrationStatus: "failed",
      narrationProvider: input.provider,
      narrationVoicePackId: voicePack.id
    });

    throw error;
  }
}
