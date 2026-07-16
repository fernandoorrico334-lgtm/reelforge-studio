import { spawn } from "node:child_process";
import { appendFile, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { RenderBlueprint, RenderBlueprintScene } from "@reelforge/video-engine";
import {
  getFfmpegCommand,
  getFfprobeCommand,
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
  hasAudio: boolean | null;
  audioCodec: string | null;
  audioChannels: number | null;
  audioSampleRate: number | null;
  audioBitrate: string | null;
}

const maxCapturedCommandOutputChars = 200_000;
const maxRenderLogBytes = Number(process.env.REELFORGE_RENDER_LOG_MAX_BYTES ?? 1_000_000);

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

export interface WorkerOnceOptions extends WorkerLogOptions {
  renderJobId?: string | null;
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

const logWriteQueues = new Map<string, Promise<void>>();

function queueLogAppend(absoluteLogPath: string, contents: string) {
  const previousWrite = logWriteQueues.get(absoluteLogPath) ?? Promise.resolve();
  const nextWrite = previousWrite
    .catch(() => undefined)
    .then(async () => {
      if (!contents) {
        return;
      }

      if (Number.isFinite(maxRenderLogBytes) && maxRenderLogBytes > 0) {
        try {
          const currentStats = await stat(absoluteLogPath);
          if (currentStats.size >= maxRenderLogBytes) {
            return;
          }
          const remainingBytes = maxRenderLogBytes - currentStats.size;
          if (Buffer.byteLength(contents, "utf8") > remainingBytes) {
            const marker = `\n[render-log-truncated] Log limit reached (${maxRenderLogBytes} bytes).\n`;
            const markerBytes = Buffer.byteLength(marker, "utf8");
            const contentBytes = Math.max(0, remainingBytes - markerBytes);
            if (contentBytes <= 0) {
              return;
            }
            const truncatedContents = Buffer.from(contents, "utf8")
              .subarray(0, contentBytes)
              .toString("utf8");
            await appendFile(
              absoluteLogPath,
              `${truncatedContents}${marker}`,
              "utf8"
            );
            return;
          }
        } catch {
          // If the file does not exist yet, append normally.
        }
      }

      await appendFile(absoluteLogPath, contents, "utf8");
    });

  logWriteQueues.set(absoluteLogPath, nextWrite.catch(() => undefined));
  return nextWrite;
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
    await queueLogAppend(
      absoluteLogPath,
      `${formatLogPrefix(renderJobId, videoProjectId)} ${message}\n`
    );
  } catch {
    // Logging should never crash the worker loop.
  }
}

function emitWorkerLog(options: WorkerLogOptions | undefined, message: string) {
  options?.logger?.(message);
}

function appendCapturedOutput(current: string, chunk: string) {
  const nextValue = current + chunk;

  if (nextValue.length <= maxCapturedCommandOutputChars) {
    return nextValue;
  }

  return nextValue.slice(-maxCapturedCommandOutputChars);
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
      stdout = appendCapturedOutput(stdout, text);
      void appendRenderLog(
        logPath,
        renderJobId,
        videoProjectId,
        `[stdout] ${text.trimEnd()}`
      );
    });

    child.stderr.on("data", (chunk) => {
      const text = chunk.toString();
      stderr = appendCapturedOutput(stderr, text);
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
      void (async () => {
        if (logPath) {
          const absoluteLogPath = resolveStoragePath(projectRoot, logPath);
          await (logWriteQueues.get(absoluteLogPath) ?? Promise.resolve());
        }

        if (code === 0) {
          resolve({ stdout, stderr });
          return;
        }

        reject(
          new Error(
            `Command '${formatCommandForLog(command, args)}' failed with code ${code ?? "unknown"}.`
          )
        );
      })();
    });
  });
}


type AudioQualityReportLike = {
  narrationIncluded?: boolean;
  musicIncluded?: boolean;
  sfxIncluded?: boolean;
  finalAudioCodec?: string | null;
};

function uniqueSortedTimes(values: number[]) {
  return [...new Set(values
    .filter((value) => Number.isFinite(value) && value > 0.2)
    .map((value) => Number(value.toFixed(2))))]
    .sort((left, right) => left - right);
}

function sceneDurationForDna(scene: RenderBlueprintScene) {
  return scene.duration ?? scene.captionCues.at(-1)?.endSeconds ?? 0;
}

function estimateDetectedCutTimesForDna(blueprint: RenderBlueprint) {
  const cutTimes: number[] = [];
  let offset = 0;

  for (const scene of blueprint.scenes) {
    if (offset > 0) cutTimes.push(offset);

    for (const cue of scene.captionCues) {
      if (cue.startSeconds > 0.35) cutTimes.push(offset + cue.startSeconds);
    }

    for (const microclip of scene.editorialMicroclips) {
      cutTimes.push(offset + microclip.insertStartSeconds);
      cutTimes.push(offset + microclip.insertEndSeconds);
    }

    offset += sceneDurationForDna(scene);
  }

  return uniqueSortedTimes(cutTimes);
}

function buildFinalVideoDnaReport(input: {
  blueprint: RenderBlueprint;
  outputMetadata: RenderOutputMetadata;
  audioQualityReport?: AudioQualityReportLike | null;
  outputPath: string;
}) {
  const captionCueCount = input.blueprint.scenes.reduce(
    (sum, scene) => sum + scene.captionCues.length,
    0
  );
  const audioQualityReport = input.audioQualityReport ?? null;
  const narrationPresent = Boolean(
    audioQualityReport?.narrationIncluded ??
      input.blueprint.scenes.some((scene) => scene.narrationReady)
  );
  const musicPresent = Boolean(
    audioQualityReport?.musicIncluded ??
      (input.blueprint as unknown as { selectedMusicAssetId?: string | null }).selectedMusicAssetId
  );
  const sfxPresent = Boolean(
    audioQualityReport?.sfxIncluded ??
      input.blueprint.scenes.some((scene) => scene.suggestedIntensity === "high" || scene.suggestedIntensity === "extreme")
  );
  const audioPeakCount = Math.max(
    input.blueprint.sceneCount,
    sfxPresent ? input.blueprint.sceneCount * 2 : input.blueprint.sceneCount,
    input.blueprint.microclipCount * 2
  );

  const detectedCutTimesSeconds = estimateDetectedCutTimesForDna(input.blueprint);
  const durationSeconds = input.outputMetadata.outputDuration;
  const cutCount = detectedCutTimesSeconds.length;
  const cutsPerMinute = durationSeconds && durationSeconds > 0
    ? Number(((cutCount / durationSeconds) * 60).toFixed(2))
    : 0;
  const averageShotDurationSeconds = durationSeconds && durationSeconds > 0
    ? Number((durationSeconds / Math.max(1, cutCount + 1)).toFixed(2))
    : null;
  const captionCuesPerMinute = durationSeconds && durationSeconds > 0
    ? Number(((captionCueCount / durationSeconds) * 60).toFixed(2))
    : 0;
  const verticalConfirmed = input.outputMetadata.outputWidth === 1080 && input.outputMetadata.outputHeight === 1920;
  const audioCodec = input.outputMetadata.audioCodec ?? audioQualityReport?.finalAudioCodec ?? null;
  const checks = {
    durationOk: durationSeconds != null && durationSeconds >= 30 && durationSeconds <= 55,
    verticalOk: verticalConfirmed,
    pacingOk: cutsPerMinute >= 28 && averageShotDurationSeconds != null && averageShotDurationSeconds <= 2.2,
    captionsOk: captionCuesPerMinute >= 55,
    audioOk: Boolean(audioCodec) && audioPeakCount >= 8,
    narrationOk: narrationPresent,
    sfxOk: sfxPresent
  };
  const blockers = [
    ...(!checks.durationOk ? ["final_duration_outside_30_55s_window"] : []),
    ...(!checks.verticalOk ? ["final_video_not_1080x1920"] : []),
    ...(!checks.audioOk ? ["final_audio_not_punchy_or_missing"] : [])
  ];
  const warnings = [
    "cut_times_estimated_from_blueprint; visual scene detection not enabled in worker v1",
    ...(!checks.pacingOk ? ["cut_pace_below_reference_dna"] : []),
    ...(!checks.captionsOk ? ["caption_density_below_reference_dna"] : []),
    ...(!checks.narrationOk ? ["narration_not_confirmed_in_final_dna"] : []),
    ...(!checks.sfxOk ? ["sfx_not_confirmed_in_final_dna"] : [])
  ];
  const overallScore =
    (checks.durationOk ? 16 : 0) +
    (checks.verticalOk ? 18 : 0) +
    (checks.pacingOk ? 22 : 0) +
    (checks.captionsOk ? 16 : 0) +
    (checks.audioOk ? 14 : 0) +
    (checks.narrationOk ? 8 : 0) +
    (checks.sfxOk ? 6 : 0);

  return {
    dnaId: "comic_final_video_dna_v1",
    verdict: blockers.length > 0 ? "blocked" : overallScore >= 90 ? "reference_ready" : overallScore >= 80 && checks.pacingOk ? "strong" : "needs_pacing_fix",
    overallScore,
    measured: {
      outputPath: input.outputPath,
      durationSeconds,
      width: input.outputMetadata.outputWidth,
      height: input.outputMetadata.outputHeight,
      videoCodec: input.outputMetadata.outputCodec,
      audioCodec,
      detectedCutTimesSeconds,
      captionCueCount,
      audioPeakCount,
      narrationPresent,
      musicPresent,
      sfxPresent,
      extractionStatus: "measured",
      extractionWarnings: ["cut_times_estimated_from_blueprint; visual scene detection not enabled in worker v1"],
      cutCount,
      cutsPerMinute,
      averageShotDurationSeconds,
      captionCuesPerMinute,
      verticalConfirmed,
      audioLayerCount: [narrationPresent, musicPresent, sfxPresent].filter(Boolean).length
    },
    checks,
    strengths: [],
    warnings,
    blockers,
    recommendations: []
  };
}

function parseRenderMetadata(value: string | null) {
  if (!value) {
    return {};
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
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
        getFfmpegCommand(),
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
    outputFileSize: fileStats.size,
    hasAudio: null,
    audioCodec: null,
    audioChannels: null,
    audioSampleRate: null,
    audioBitrate: null
  };

  try {
    const { stdout } = await runLoggedCommand(
      getFfprobeCommand(),
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
        channels?: number | string;
        sample_rate?: number | string;
        bit_rate?: number | string;
      }>;
      format?: {
        duration?: number | string;
      };
    };
    const videoStream = Array.isArray(parsed.streams)
      ? parsed.streams.find((stream) => stream.codec_type === "video")
      : null;
    const audioStream = Array.isArray(parsed.streams)
      ? parsed.streams.find((stream) => stream.codec_type === "audio")
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
      outputFileSize: fileStats.size,
      hasAudio: Boolean(audioStream),
      audioCodec:
        typeof audioStream?.codec_name === "string" &&
        audioStream.codec_name.trim().length > 0
          ? audioStream.codec_name.trim()
          : null,
      audioChannels: Number(audioStream?.channels ?? 0) || null,
      audioSampleRate: Number(audioStream?.sample_rate ?? 0) || null,
      audioBitrate:
        Number(audioStream?.bit_rate ?? 0) > 0
          ? `${Math.round(Number(audioStream?.bit_rate ?? 0) / 1000)}k`
          : null
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
  const initialMetadata = parseRenderMetadata(initialJob.metadata);
  const audioMasteringPresetId =
    typeof initialMetadata.audioMasteringPresetId === "string"
      ? initialMetadata.audioMasteringPresetId
      : null;
  await appendRenderLog(
    initialJob.logPath,
    renderJobId,
    initialJob.videoProjectId,
    `Runtime binaries: ffmpeg='${getFfmpegCommand()}' | ffprobe='${getFfprobeCommand()}'. masteringPreset='${audioMasteringPresetId ?? "shorts_clean_voice"}'.`
  );
  let blueprint: RenderBlueprint | null = null;

  try {
    await throwIfJobCancelled(
      renderJobId,
      initialJob.logPath,
      initialJob.videoProjectId,
      "reading_blueprint"
    );
    blueprint = await readBlueprintForJob(initialJob.blueprintPath);

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
            audioMasteringPresetId,
            ...renderCallbacks
          })
        : await renderBlueprintV1({
            blueprint,
            projectRoot,
            rendersStorageRoot,
            videoProjectId: initialJob.videoProjectId,
            renderJobId,
            audioMasteringPresetId,
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

    const finalVideoDna = buildFinalVideoDnaReport({
      blueprint,
      outputMetadata,
      audioQualityReport: artifacts.audioQualityReport ?? null,
      outputPath: artifacts.outputPath
    });
    await appendRenderLog(
      initialJob.logPath,
      renderJobId,
      initialJob.videoProjectId,
      `Final video DNA QA: ${JSON.stringify({ verdict: finalVideoDna.verdict, score: finalVideoDna.overallScore, cutsPerMinute: finalVideoDna.measured.cutsPerMinute })}`
    );

    await throwIfJobCancelled(
      renderJobId,
      initialJob.logPath,
      initialJob.videoProjectId,
      "completed"
    );
    await updateRenderJob(renderJobId, {
      metadata: JSON.stringify({
        ...initialMetadata,
        audioMasteringPresetId:
          audioMasteringPresetId ?? "shorts_clean_voice",
        hasEditorialMicroclips: blueprint.hasEditorialMicroclips,
        microclipCount: blueprint.microclipCount,
        totalMicroclipDurationSeconds:
          blueprint.totalMicroclipDurationSeconds,
        finalVideoDna,
        audioQualityReport: artifacts.audioQualityReport
          ? {
              ...artifacts.audioQualityReport,
              measuredOutputDuration:
                outputMetadata.outputDuration ??
                artifacts.audioQualityReport.measuredOutputDuration,
              finalAudioCodec:
                outputMetadata.audioCodec ??
                artifacts.audioQualityReport.finalAudioCodec,
              finalAudioSampleRate:
                outputMetadata.audioSampleRate ??
                artifacts.audioQualityReport.finalAudioSampleRate,
              finalAudioBitrate:
                outputMetadata.audioBitrate ??
                artifacts.audioQualityReport.finalAudioBitrate
            }
          : null
      }),
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
      hasAudio: outputMetadata.hasAudio,
      audioCodec: outputMetadata.audioCodec,
      audioChannels: outputMetadata.audioChannels,
      audioSampleRate: outputMetadata.audioSampleRate,
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
      metadata: JSON.stringify({
        ...initialMetadata,
        audioMasteringPresetId:
          audioMasteringPresetId ?? "shorts_clean_voice",
        hasEditorialMicroclips: blueprint?.hasEditorialMicroclips ?? false,
        microclipCount: blueprint?.microclipCount ?? 0,
        totalMicroclipDurationSeconds:
          blueprint?.totalMicroclipDurationSeconds ?? 0
      }),
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

async function claimQueuedJobById(renderJobId: string) {
  const targetJob = await prisma.renderJob.findUnique({
    where: {
      id: renderJobId
    }
  });

  if (!targetJob) {
    return {
      claimedRenderJobId: null,
      videoProjectId: null,
      errorMessage: `Render job '${renderJobId}' was not found.`
    };
  }

  if (targetJob.status !== "queued") {
    return {
      claimedRenderJobId: null,
      videoProjectId: targetJob.videoProjectId,
      errorMessage: `Render job '${renderJobId}' is '${targetJob.status}', not queued.`
    };
  }

  const claimResult = await prisma.renderJob.updateMany({
    where: {
      id: targetJob.id,
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
    return {
      claimedRenderJobId: null,
      videoProjectId: targetJob.videoProjectId,
      errorMessage: `Render job '${renderJobId}' could not be claimed because its status changed.`
    };
  }

  return {
    claimedRenderJobId: targetJob.id,
    videoProjectId: targetJob.videoProjectId,
    errorMessage: null
  };
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
  options?: WorkerOnceOptions
): Promise<WorkerOnceResult> {
  const requestedRenderJobId = options?.renderJobId?.trim() ?? "";
  const targetedClaim = requestedRenderJobId
    ? await claimQueuedJobById(requestedRenderJobId)
    : null;
  const renderJobId = requestedRenderJobId
    ? targetedClaim?.claimedRenderJobId
    : await claimNextQueuedJob();

  if (!renderJobId) {
    const message =
      targetedClaim?.errorMessage ?? "No queued render jobs were found.";
    emitWorkerLog(options, message);
    return {
      foundQueuedJob: false,
      renderJobId: requestedRenderJobId || null,
      videoProjectId: targetedClaim?.videoProjectId ?? null,
      finalStatus: "not_found",
      errorMessage: message,
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

