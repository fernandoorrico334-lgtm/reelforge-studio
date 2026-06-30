import { spawn } from "node:child_process";
import { appendFile, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { RenderBlueprint, RenderBlueprintScene } from "@reelforge/video-engine";
import {
  RenderCancellationError,
  type RenderPipelineStep,
  renderCinematicV2,
  renderBlueprintV1,
  resolveStoragePath
} from "@reelforge/video-engine/render-server";
import { rendersStorageRoot, projectRoot } from "../config/paths.js";
import { prisma } from "../infrastructure/prisma-client.js";

const pollIntervalMs = 3_000;

type PersistedRenderStep =
  | "reading_blueprint"
  | "generating_subtitles"
  | "rendering_scene"
  | "concatenating_segments"
  | "burning_subtitles"
  | "generating_thumbnail"
  | "probing_output"
  | "completed";

interface RenderOutputMetadata {
  outputWidth: number | null;
  outputHeight: number | null;
  outputDuration: number | null;
  outputCodec: string | null;
  outputFileSize: number | null;
}

class WorkerCancellationError extends Error {
  readonly step: RenderPipelineStep;
  readonly sceneIndex: number | null;

  constructor(step: RenderPipelineStep, sceneIndex: number | null = null) {
    super("Render cancelled by user");
    this.name = "WorkerCancellationError";
    this.step = step;
    this.sceneIndex = sceneIndex;
  }
}

export interface WorkerLogOptions {
  logger?: (message: string) => void;
}

export interface WorkerOnceResult {
  foundQueuedJob: boolean;
  renderJobId: string | null;
  videoProjectId: string | null;
  finalStatus: "completed" | "failed" | "cancelled" | "not_found";
  errorMessage: string | null;
  exitCode: number;
}

function sleep(durationMs: number) {
  return new Promise((resolve) => setTimeout(resolve, durationMs));
}

function extractErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }

  return "Unknown render error.";
}

function isCancellationError(
  error: unknown
): error is WorkerCancellationError | RenderCancellationError {
  return (
    error instanceof WorkerCancellationError ||
    error instanceof RenderCancellationError
  );
}

function normalizePersistedStep(step: RenderPipelineStep): PersistedRenderStep {
  switch (step) {
    case "preparing_audio":
    case "mixing_audio":
    case "probing_audio":
      return "burning_subtitles";
    default:
      return step;
  }
}

function quoteArgForLog(value: string) {
  return /[\s"]/u.test(value)
    ? `"${value.replaceAll('"', '\\"')}"`
    : value;
}

function formatCommandForLog(command: string, args: string[]) {
  return [command, ...args.map(quoteArgForLog)].join(" ");
}

function formatLogPrefix(renderJobId: string, videoProjectId: string) {
  return `[${new Date().toISOString()}][job:${renderJobId}][project:${videoProjectId}]`;
}

async function appendRenderLog(
  relativeLogPath: string | null,
  renderJobId: string,
  videoProjectId: string,
  message: string
) {
  if (!relativeLogPath) {
    return;
  }

  try {
    const absoluteLogPath = resolveStoragePath(projectRoot, relativeLogPath);
    await mkdir(dirname(absoluteLogPath), { recursive: true });
    await appendFile(
      absoluteLogPath,
      `${formatLogPrefix(renderJobId, videoProjectId)} ${message}\n`,
      "utf8"
    );
  } catch {
    // Logging should never crash the worker loop.
  }
}

function emitWorkerLog(options: WorkerLogOptions | undefined, message: string) {
  options?.logger?.(message);
}

async function ensureRenderLog(relativeLogPath: string | null) {
  if (!relativeLogPath) {
    return;
  }

  try {
    const absoluteLogPath = resolveStoragePath(projectRoot, relativeLogPath);
    await mkdir(dirname(absoluteLogPath), { recursive: true });
    await writeFile(absoluteLogPath, "", "utf8");
  } catch {
    // Ignore log bootstrap failures here; the render step will surface them later.
  }
}

async function updateRenderJob(
  renderJobId: string,
  data: Parameters<typeof prisma.renderJob.update>[0]["data"]
) {
  await prisma.renderJob.update({
    where: {
      id: renderJobId
    },
    data
  });
}

async function readBlueprintForJob(blueprintPath: string | null) {
  if (!blueprintPath) {
    throw new Error("Render job has no blueprintPath.");
  }

  const absoluteBlueprintPath = resolveStoragePath(projectRoot, blueprintPath);
  const content = await readFile(absoluteBlueprintPath, "utf8");
  return JSON.parse(content) as RenderBlueprint;
}

async function readLiveRenderJob(renderJobId: string) {
  return prisma.renderJob.findUnique({
    where: {
      id: renderJobId
    }
  });
}

async function throwIfJobCancelled(
  renderJobId: string,
  logPath: string | null,
  videoProjectId: string,
  step: RenderPipelineStep,
  sceneIndex: number | null = null
) {
  const liveJob = await readLiveRenderJob(renderJobId);

  if (!liveJob) {
    throw new Error(`Render job '${renderJobId}' was not found during processing.`);
  }

  if (liveJob.status === "cancelled" || liveJob.cancelledAt) {
    await appendRenderLog(
      logPath,
      renderJobId,
      videoProjectId,
      `Cancellation detected before step '${step}'${sceneIndex ? ` at scene ${sceneIndex}` : ""}.`
    );
    throw new WorkerCancellationError(step, sceneIndex);
  }
}

async function runLoggedCommand(
  command: string,
  args: string[],
  logPath: string | null,
  renderJobId: string,
  videoProjectId: string
) {
  await appendRenderLog(
    logPath,
    renderJobId,
    videoProjectId,
    `$ ${formatCommandForLog(command, args)}`
  );

  return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: projectRoot,
      shell: false,
      windowsHide: true
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      const text = chunk.toString();
      stdout += text;
      void appendRenderLog(
        logPath,
        renderJobId,
        videoProjectId,
        `[stdout] ${text.trimEnd()}`
      );
    });

    child.stderr.on("data", (chunk) => {
      const text = chunk.toString();
      stderr += text;
      void appendRenderLog(
        logPath,
        renderJobId,
        videoProjectId,
        `[stderr] ${text.trimEnd()}`
      );
    });

    child.on("error", (error) => {
      reject(error);
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }

      reject(
        new Error(
          `Command '${command}' failed with code ${code ?? "unknown"}.`
        )
      );
    });
  });
}

async function generateThumbnail(
  outputPath: string,
  thumbnailPath: string,
  logPath: string | null,
  renderJobId: string,
  videoProjectId: string
) {
  const absoluteOutputPath = resolveStoragePath(projectRoot, outputPath);
  const absoluteThumbnailPath = resolveStoragePath(projectRoot, thumbnailPath);
  const attempts = ["1", "0"];

  await mkdir(dirname(absoluteThumbnailPath), { recursive: true });

  for (const seekSeconds of attempts) {
    try {
      await runLoggedCommand(
        "ffmpeg",
        [
          "-y",
          "-ss",
          seekSeconds,
          "-i",
          absoluteOutputPath,
          "-frames:v",
          "1",
          "-q:v",
          "2",
          absoluteThumbnailPath
        ],
        logPath,
        renderJobId,
        videoProjectId
      );
      await appendRenderLog(
        logPath,
        renderJobId,
        videoProjectId,
        `Thumbnail generated at ${thumbnailPath} using frame seek ${seekSeconds}s.`
      );
      return;
    } catch (error) {
      await appendRenderLog(
        logPath,
        renderJobId,
        videoProjectId,
        `Thumbnail attempt with seek ${seekSeconds}s failed: ${extractErrorMessage(error)}`
      );
    }
  }

  throw new Error("Unable to generate thumbnail from output.mp4.");
}

async function probeOutputMetadata(
  outputPath: string,
  logPath: string | null,
  renderJobId: string,
  videoProjectId: string
): Promise<RenderOutputMetadata> {
  const absoluteOutputPath = resolveStoragePath(projectRoot, outputPath);
  const fileStats = await stat(absoluteOutputPath);
  const fallback: RenderOutputMetadata = {
    outputWidth: null,
    outputHeight: null,
    outputDuration: null,
    outputCodec: null,
    outputFileSize: fileStats.size
  };

  try {
    const { stdout } = await runLoggedCommand(
      "ffprobe",
      [
        "-v",
        "error",
        "-print_format",
        "json",
        "-show_streams",
        "-show_format",
        absoluteOutputPath
      ],
      logPath,
      renderJobId,
      videoProjectId
    );
    const parsed = JSON.parse(stdout) as {
      streams?: Array<{
        codec_type?: string;
        width?: number | string;
        height?: number | string;
        duration?: number | string;
        codec_name?: string;
      }>;
      format?: {
        duration?: number | string;
      };
    };
    const videoStream = Array.isArray(parsed.streams)
      ? parsed.streams.find((stream) => stream.codec_type === "video")
      : null;
    const durationValue = Number(
      parsed.format?.duration ?? videoStream?.duration ?? 0
    );
    const metadata: RenderOutputMetadata = {
      outputWidth: Number(videoStream?.width ?? 0) || null,
      outputHeight: Number(videoStream?.height ?? 0) || null,
      outputDuration:
        Number.isFinite(durationValue) && durationValue > 0
          ? Math.round(durationValue * 1000) / 1000
          : null,
      outputCodec:
        typeof videoStream?.codec_name === "string" &&
        videoStream.codec_name.trim().length > 0
          ? videoStream.codec_name.trim()
          : null,
      outputFileSize: fileStats.size
    };

    await appendRenderLog(
      logPath,
      renderJobId,
      videoProjectId,
      `ffprobe metadata: ${JSON.stringify(metadata)}`
    );

    return metadata;
  } catch (error) {
    await appendRenderLog(
      logPath,
      renderJobId,
      videoProjectId,
      `ffprobe unavailable or failed; continuing without probe metadata. ${extractErrorMessage(error)}`
    );
    return fallback;
  }
}

async function processRenderJob(renderJobId: string) {
  const initialJob = await prisma.renderJob.findUnique({
    where: {
      id: renderJobId
    }
  });

  if (!initialJob) {
    return {
      renderJobId,
      videoProjectId: null,
      finalStatus: "not_found" as const,
      errorMessage: `Render job '${renderJobId}' was not found after claim.`
    };
  }

  await ensureRenderLog(initialJob.logPath);
  await appendRenderLog(
    initialJob.logPath,
    renderJobId,
    initialJob.videoProjectId,
    "Worker picked render job."
  );
  await appendRenderLog(
    initialJob.logPath,
    renderJobId,
    initialJob.videoProjectId,
    `Blueprint path: ${initialJob.blueprintPath ?? "missing"}.`
  );
  await appendRenderLog(
    initialJob.logPath,
    renderJobId,
    initialJob.videoProjectId,
    `Render mode: ${initialJob.renderMode ?? "v1"} | quality: ${initialJob.renderQuality ?? "standard"}.`
  );

  try {
    await throwIfJobCancelled(
      renderJobId,
      initialJob.logPath,
      initialJob.videoProjectId,
      "reading_blueprint"
    );
    const blueprint = await readBlueprintForJob(initialJob.blueprintPath);

    await updateRenderJob(renderJobId, {
      currentStep: "reading_blueprint",
      progress: 5,
      totalScenes: blueprint.sceneCount,
      currentSceneIndex: null
    });
    await appendRenderLog(
      initialJob.logPath,
      renderJobId,
      initialJob.videoProjectId,
      `Blueprint loaded for project ${initialJob.videoProjectId}.`
    );

    const renderMode = initialJob.renderMode ?? "v1";
    const renderQuality = initialJob.renderQuality ?? "standard";
    const renderCallbacks = {
      onStep: async (step: RenderPipelineStep) => {
        await updateRenderJob(renderJobId, {
          currentStep: normalizePersistedStep(step)
        });
        await appendRenderLog(
          initialJob.logPath,
          renderJobId,
          initialJob.videoProjectId,
          `Step started (${renderMode}): ${step}.`
        );
      },
      onScene: async (
        sceneIndex: number,
        totalScenes: number,
        scene: RenderBlueprintScene
      ) => {
        await updateRenderJob(renderJobId, {
          currentSceneIndex: sceneIndex,
          totalScenes
        });
        await appendRenderLog(
          initialJob.logPath,
          renderJobId,
          initialJob.videoProjectId,
          `Rendering scene ${sceneIndex}/${totalScenes}: ${scene.title} (${scene.asset?.path ?? "no-asset"}) with preset ${scene.visualPreset.preset.id}.`
        );
      },
      onProgress: async (progress: number) => {
        await updateRenderJob(renderJobId, {
          progress
        });
      },
      shouldCancel: async () => {
        const liveJob = await readLiveRenderJob(renderJobId);
        return Boolean(liveJob && (liveJob.status === "cancelled" || liveJob.cancelledAt));
      }
    };
    const artifacts =
      renderMode === "cinematic_v2"
        ? await renderCinematicV2({
            blueprint,
            projectRoot,
            rendersStorageRoot,
            videoProjectId: initialJob.videoProjectId,
            renderJobId,
            renderQuality,
            ...renderCallbacks
          })
        : await renderBlueprintV1({
            blueprint,
            projectRoot,
            rendersStorageRoot,
            videoProjectId: initialJob.videoProjectId,
            renderJobId,
            ...renderCallbacks
          });

    await throwIfJobCancelled(
      renderJobId,
      initialJob.logPath,
      initialJob.videoProjectId,
      "generating_thumbnail"
    );
    await updateRenderJob(renderJobId, {
      currentStep: "generating_thumbnail",
      progress: 96
    });
    await generateThumbnail(
      artifacts.outputPath,
      initialJob.thumbnailPath ?? `storage/renders/${initialJob.videoProjectId}/${renderJobId}/thumbnail.jpg`,
      initialJob.logPath,
      renderJobId,
      initialJob.videoProjectId
    );

    await throwIfJobCancelled(
      renderJobId,
      initialJob.logPath,
      initialJob.videoProjectId,
      "probing_output"
    );
    await updateRenderJob(renderJobId, {
      currentStep: "probing_output",
      progress: 98
    });
    const outputMetadata = await probeOutputMetadata(
      artifacts.outputPath,
      initialJob.logPath,
      renderJobId,
      initialJob.videoProjectId
    );

    await throwIfJobCancelled(
      renderJobId,
      initialJob.logPath,
      initialJob.videoProjectId,
      "completed"
    );
    await updateRenderJob(renderJobId, {
      status: "completed",
      outputPath: artifacts.outputPath,
      srtPath: artifacts.srtPath,
      assPath: artifacts.assPath,
      logPath: artifacts.logPath,
      thumbnailPath:
        initialJob.thumbnailPath ??
        `storage/renders/${initialJob.videoProjectId}/${renderJobId}/thumbnail.jpg`,
      outputWidth: outputMetadata.outputWidth,
      outputHeight: outputMetadata.outputHeight,
      outputDuration: outputMetadata.outputDuration,
      outputCodec: outputMetadata.outputCodec,
      outputFileSize: outputMetadata.outputFileSize,
      currentStep: "completed",
      progress: 100,
      errorMessage: null,
      completedAt: new Date(),
      cancelledAt: null
    });
    await appendRenderLog(
      artifacts.logPath,
      renderJobId,
      initialJob.videoProjectId,
      "Render job completed successfully."
    );
    return {
      renderJobId,
      videoProjectId: initialJob.videoProjectId,
      finalStatus: "completed" as const,
      errorMessage: null
    };
  } catch (error) {
    if (isCancellationError(error)) {
      const cancellationStep = error.step;
      const persistedCancellationStep = normalizePersistedStep(cancellationStep);

      await appendRenderLog(
        initialJob.logPath,
        renderJobId,
        initialJob.videoProjectId,
        `Render job cancelled during step '${cancellationStep}'.`
      );

      const liveJob = await readLiveRenderJob(renderJobId);
      const completedAt = liveJob?.completedAt ?? new Date();
      const cancelledAt = liveJob?.cancelledAt ?? new Date();

      await updateRenderJob(renderJobId, {
        status: "cancelled",
        currentStep: persistedCancellationStep,
        errorMessage: "Render cancelled by user",
        cancelledAt,
        completedAt
      });
      return {
        renderJobId,
        videoProjectId: initialJob.videoProjectId,
        finalStatus: "cancelled" as const,
        errorMessage: "Render cancelled by user"
      };
    }

    const message = extractErrorMessage(error);

    await appendRenderLog(
      initialJob.logPath,
      renderJobId,
      initialJob.videoProjectId,
      `Render job failed: ${message}`
    );
    await updateRenderJob(renderJobId, {
      status: "failed",
      errorMessage: message,
      completedAt: new Date()
    });
    return {
      renderJobId,
      videoProjectId: initialJob.videoProjectId,
      finalStatus: "failed" as const,
      errorMessage: message
    };
  }
}

async function claimNextQueuedJob() {
  const nextJob = await prisma.renderJob.findFirst({
    where: {
      status: "queued"
    },
    orderBy: {
      createdAt: "asc"
    }
  });

  if (!nextJob) {
    return null;
  }

  const claimResult = await prisma.renderJob.updateMany({
    where: {
      id: nextJob.id,
      status: "queued"
    },
    data: {
      status: "processing",
      progress: 0,
      currentStep: "reading_blueprint",
      currentSceneIndex: null,
      outputWidth: null,
      outputHeight: null,
      outputDuration: null,
      outputCodec: null,
      outputFileSize: null,
      startedAt: new Date(),
      completedAt: null,
      cancelledAt: null,
      errorMessage: null
    }
  });

  if (claimResult.count === 0) {
    return claimNextQueuedJob();
  }

  return nextJob.id;
}

export async function processNextRenderJob() {
  const renderJobId = await claimNextQueuedJob();

  if (!renderJobId) {
    return false;
  }

  await processRenderJob(renderJobId);
  return true;
}

export async function runRenderWorkerOnce(
  options?: WorkerLogOptions
): Promise<WorkerOnceResult> {
  const renderJobId = await claimNextQueuedJob();

  if (!renderJobId) {
    emitWorkerLog(options, "No queued render jobs were found.");
    return {
      foundQueuedJob: false,
      renderJobId: null,
      videoProjectId: null,
      finalStatus: "not_found",
      errorMessage: "No queued render jobs were found.",
      exitCode: 2
    };
  }

  emitWorkerLog(options, `Claimed queued render job ${renderJobId}.`);
  const result = await processRenderJob(renderJobId);

  if (result.finalStatus === "completed") {
    emitWorkerLog(
      options,
      `Render job ${renderJobId} completed successfully for project ${result.videoProjectId}.`
    );
    return {
      foundQueuedJob: true,
      renderJobId,
      videoProjectId: result.videoProjectId,
      finalStatus: "completed",
      errorMessage: null,
      exitCode: 0
    };
  }

  const message =
    result.errorMessage ??
    `Render job ${renderJobId} did not complete successfully.`;
  emitWorkerLog(options, message);
  return {
    foundQueuedJob: true,
    renderJobId,
    videoProjectId: result.videoProjectId,
    finalStatus: result.finalStatus,
    errorMessage: message,
    exitCode: 1
  };
}

export async function startRenderWorkerLoop() {
  let keepRunning = true;

  const stop = () => {
    keepRunning = false;
  };

  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);

  while (keepRunning) {
    const processed = await processNextRenderJob();

    if (!processed) {
      await sleep(pollIntervalMs);
    }
  }

  process.off("SIGINT", stop);
  process.off("SIGTERM", stop);
}

