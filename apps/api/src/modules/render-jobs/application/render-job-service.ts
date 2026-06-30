import { NotFoundError, ValidationError } from "../../../shared/errors.js";
import { getVideoProjectRenderBlueprint } from "../../projects/application/project-render-blueprint-service.js";
import type { AssetRepository } from "../../assets/application/asset-repository.js";
import type { ProjectRepository } from "../../projects/application/project-repository.js";
import type { RenderJobRepository } from "./render-job-repository.js";
import type { RenderStorage } from "./render-storage.js";
import {
  assertRenderJobStatusTransition,
  canCancelRenderJob,
  canDeleteRenderJob,
  canRetryRenderJob,
  type CreateRenderJobInput,
  defaultRenderMode,
  defaultRenderQuality,
  type CreateRenderJobRequestInput
} from "../domain/render-job.js";

function buildRenderJobNotFoundError(renderJobId: string) {
  return new NotFoundError(`Render job '${renderJobId}' was not found.`);
}

function buildProjectNotFoundError(projectId: string) {
  return new NotFoundError(`Video project '${projectId}' was not found.`);
}

async function createPreparedRenderJob(
  renderJobRepository: RenderJobRepository,
  projectRepository: ProjectRepository,
  assetRepository: AssetRepository,
  renderStorage: RenderStorage,
  input: {
    videoProjectId: string;
    renderMode?: CreateRenderJobRequestInput["renderMode"];
    renderQuality?: CreateRenderJobRequestInput["renderQuality"];
    attempt?: number;
    retriedFromJobId?: string | null;
  }
) {
  const project = await projectRepository.getById(input.videoProjectId);

  if (!project) {
    throw buildProjectNotFoundError(input.videoProjectId);
  }

  const blueprint = await getVideoProjectRenderBlueprint(
    projectRepository,
    assetRepository,
    input.videoProjectId
  );
  const createInput: CreateRenderJobInput = {
    videoProjectId: input.videoProjectId,
    renderMode: input.renderMode ?? defaultRenderMode,
    renderQuality: input.renderQuality ?? defaultRenderQuality,
    retriedFromJobId: input.retriedFromJobId ?? null
  };

  if (typeof input.attempt === "number") {
    createInput.attempt = input.attempt;
  }

  const createdJob = await renderJobRepository.createQueued(createInput);
  const preparedPaths = await renderStorage.saveBlueprint(
    input.videoProjectId,
    createdJob.id,
    blueprint
  );
  const updatedJob = await renderJobRepository.update(createdJob.id, {
    blueprintPath: preparedPaths.blueprintPath,
    outputPath: preparedPaths.outputPath,
    srtPath: preparedPaths.srtPath,
    assPath: preparedPaths.assPath,
    logPath: preparedPaths.logPath,
    thumbnailPath: preparedPaths.thumbnailPath,
    progress: 0,
    currentStep: null,
    currentSceneIndex: null,
    totalScenes: blueprint.sceneCount,
    outputWidth: null,
    outputHeight: null,
    outputDuration: null,
    outputCodec: null,
    hasAudio: null,
    audioCodec: null,
    audioChannels: null,
    audioSampleRate: null,
    outputFileSize: null,
    cancelledAt: null,
    errorMessage: null,
    startedAt: null,
    completedAt: null
  });

  if (!updatedJob) {
    throw buildRenderJobNotFoundError(createdJob.id);
  }

  return updatedJob;
}

export async function createRenderJobForProject(
  renderJobRepository: RenderJobRepository,
  projectRepository: ProjectRepository,
  assetRepository: AssetRepository,
  renderStorage: RenderStorage,
  projectId: string,
  input: CreateRenderJobRequestInput = {}
) {
  const createInput: Parameters<typeof createPreparedRenderJob>[4] = {
    videoProjectId: projectId
  };

  if (input.renderMode) {
    createInput.renderMode = input.renderMode;
  }

  if (input.renderQuality) {
    createInput.renderQuality = input.renderQuality;
  }

  return createPreparedRenderJob(
    renderJobRepository,
    projectRepository,
    assetRepository,
    renderStorage,
    createInput
  );
}

export async function listRenderJobs(repository: RenderJobRepository) {
  return repository.list();
}

export async function listProjectRenderJobs(
  renderJobRepository: RenderJobRepository,
  projectRepository: ProjectRepository,
  projectId: string
) {
  const project = await projectRepository.getById(projectId);

  if (!project) {
    throw buildProjectNotFoundError(projectId);
  }

  return renderJobRepository.listByProjectId(projectId);
}

export async function getRenderJobById(
  repository: RenderJobRepository,
  id: string
) {
  const renderJob = await repository.getById(id);

  if (!renderJob) {
    throw buildRenderJobNotFoundError(id);
  }

  return renderJob;
}

export async function cancelRenderJob(
  repository: RenderJobRepository,
  id: string
) {
  const renderJob = await getRenderJobById(repository, id);

  if (!canCancelRenderJob(renderJob.status)) {
    throw new ValidationError(
      `Render job '${id}' cannot be cancelled while status is '${renderJob.status}'.`
    );
  }

  assertRenderJobStatusTransition(renderJob.status, "cancelled");

  const updated = await repository.update(id, {
    status: "cancelled",
    cancelledAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    errorMessage: "Render cancelled by user"
  });

  if (!updated) {
    throw buildRenderJobNotFoundError(id);
  }

  return updated;
}

export async function retryRenderJob(
  renderJobRepository: RenderJobRepository,
  projectRepository: ProjectRepository,
  assetRepository: AssetRepository,
  renderStorage: RenderStorage,
  renderJobId: string
) {
  const renderJob = await getRenderJobById(renderJobRepository, renderJobId);

  if (!canRetryRenderJob(renderJob.status)) {
    throw new ValidationError(
      `Render job '${renderJobId}' cannot be retried while status is '${renderJob.status}'.`
    );
  }

  return createPreparedRenderJob(
    renderJobRepository,
    projectRepository,
    assetRepository,
    renderStorage,
    {
      videoProjectId: renderJob.videoProjectId,
      renderMode: renderJob.renderMode,
      renderQuality: renderJob.renderQuality,
      retriedFromJobId: renderJob.id,
      attempt: renderJob.attempt + 1
    }
  );
}

export async function deleteRenderJob(
  repository: RenderJobRepository,
  id: string
) {
  const renderJob = await getRenderJobById(repository, id);

  if (!canDeleteRenderJob(renderJob.status)) {
    throw new ValidationError(
      `Render job '${id}' cannot be deleted while status is '${renderJob.status}'.`
    );
  }

  const deleted = await repository.delete(id);

  if (!deleted) {
    throw buildRenderJobNotFoundError(id);
  }
}

