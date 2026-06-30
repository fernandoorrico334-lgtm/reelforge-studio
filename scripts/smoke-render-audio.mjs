import { spawn } from "node:child_process";
import { mkdir, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  buildEnvironmentBlockerMessage,
  ensureArtifactsExist,
  isSpawnPermissionError,
  printSmokeSummary,
  safeCheckFfmpeg,
  writeMinimalPng,
  writeMinimalWav
} from "./lib/smoke-utils.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");

const smokeProjectTitle = "Smoke Render Audio Engine";

function log(message) {
  console.log(`[smoke:render:audio] ${message}`);
}

function runCommand(command, args, cwd = projectRoot) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, {
      cwd,
      shell: false,
      windowsHide: true
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      rejectPromise(error);
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolvePromise({ stdout, stderr });
        return;
      }

      const tail = `${stderr}${stdout}`
        .trim()
        .split(/\r?\n/u)
        .slice(-8)
        .join(" | ");
      rejectPromise(
        new Error(
          `Command '${command}' failed with code ${code ?? "unknown"}. ${tail || "No stdout/stderr output captured."}`
        )
      );
    });
  });
}

async function importModule(relativePath) {
  return import(pathToFileURL(join(projectRoot, relativePath)).href);
}

async function ensureBuildArtifacts() {
  await ensureArtifactsExist(
    projectRoot,
    [
      "apps/api/dist/infrastructure/database/prisma-client.js",
      "apps/api/dist/modules/projects/infrastructure/prisma-project-repository.js",
      "apps/api/dist/modules/render-jobs/infrastructure/local-render-storage.js",
      "apps/api/dist/modules/render-jobs/infrastructure/prisma-render-job-repository.js",
      "apps/api/dist/modules/render-jobs/application/render-job-service.js",
      "apps/api/dist/modules/assets/infrastructure/prisma-asset-repository.js",
      "apps/worker/dist/infrastructure/prisma-client.js",
      "apps/worker/dist/services/render-worker.js"
    ],
    "Run 'npm run build' before running smoke:render:audio."
  );
}

async function ensureSmokeAssets() {
  const imageDir = join(projectRoot, "storage", "assets", "smoke", "image");
  const musicDir = join(projectRoot, "storage", "assets", "smoke", "music");
  const audioDir = join(projectRoot, "storage", "assets", "smoke", "audio");
  const sfxDir = join(projectRoot, "storage", "assets", "smoke", "sfx");

  await Promise.all([
    mkdir(imageDir, { recursive: true }),
    mkdir(musicDir, { recursive: true }),
    mkdir(audioDir, { recursive: true }),
    mkdir(sfxDir, { recursive: true })
  ]);

  const imageDefinitions = [
    {
      filename: "smoke_audio_scene_1.png",
      color: "#111f33",
      captionText: "Audio smoke scene one",
      narrationText: "The first scene validates the music bed and subtitle pass.",
      emotion: "MYSTERIOUS",
      visualPreset: "suspense",
      transition: "fade",
      duration: 3
    },
    {
      filename: "smoke_audio_scene_2.png",
      color: "#3a1628",
      captionText: "Voiceover keeps the center line",
      narrationText: "The second scene keeps voiceover present over the entire cut.",
      emotion: "DARK",
      visualPreset: "drama",
      transition: "hard-cut",
      duration: 4
    },
    {
      filename: "smoke_audio_scene_3.png",
      color: "#17362a",
      captionText: "SFX lands on the final beat",
      narrationText: "The third scene confirms the local SFX offset and mix export.",
      emotion: "EPIC",
      visualPreset: "epic",
      transition: "flash-cut",
      duration: 3
    }
  ];

  const images = [];

  for (const definition of imageDefinitions) {
    const relativePath = `storage/assets/smoke/image/${definition.filename}`;
    const absolutePath = await writeMinimalPng(join(projectRoot, relativePath));
    const fileStats = await stat(absolutePath);

    images.push({
      ...definition,
      relativePath,
      fileSize: fileStats.size
    });
  }

  const musicRelativePath = "storage/assets/smoke/music/smoke_music.wav";
  const voiceRelativePath = "storage/assets/smoke/audio/smoke_voice.wav";
  const sfxRelativePath = "storage/assets/smoke/sfx/smoke_hit.wav";

  await writeMinimalWav(join(projectRoot, musicRelativePath), 3, 48000);
  await writeMinimalWav(join(projectRoot, voiceRelativePath), 7, 48000);
  await writeMinimalWav(join(projectRoot, sfxRelativePath), 0.4, 48000);

  return {
    images,
    music: {
      relativePath: musicRelativePath,
      fileSize: (await stat(join(projectRoot, musicRelativePath))).size
    },
    voice: {
      relativePath: voiceRelativePath,
      fileSize: (await stat(join(projectRoot, voiceRelativePath))).size
    },
    sfx: {
      relativePath: sfxRelativePath,
      fileSize: (await stat(join(projectRoot, sfxRelativePath))).size
    }
  };
}

async function loadSmokeDependencies() {
  const [
    apiPrismaModule,
    projectRepositoryModule,
    renderStorageModule,
    renderRepositoryModule,
    renderServiceModule,
    assetRepositoryModule,
    workerPrismaModule,
    workerServiceModule
  ] = await Promise.all([
    importModule("apps/api/dist/infrastructure/database/prisma-client.js"),
    importModule(
      "apps/api/dist/modules/projects/infrastructure/prisma-project-repository.js"
    ),
    importModule(
      "apps/api/dist/modules/render-jobs/infrastructure/local-render-storage.js"
    ),
    importModule(
      "apps/api/dist/modules/render-jobs/infrastructure/prisma-render-job-repository.js"
    ),
    importModule(
      "apps/api/dist/modules/render-jobs/application/render-job-service.js"
    ),
    importModule(
      "apps/api/dist/modules/assets/infrastructure/prisma-asset-repository.js"
    ),
    importModule("apps/worker/dist/infrastructure/prisma-client.js"),
    importModule("apps/worker/dist/services/render-worker.js")
  ]);

  return {
    apiPrisma: apiPrismaModule.prisma,
    createPrismaProjectRepository:
      projectRepositoryModule.createPrismaProjectRepository,
    createLocalRenderStorage: renderStorageModule.createLocalRenderStorage,
    createPrismaRenderJobRepository:
      renderRepositoryModule.createPrismaRenderJobRepository,
    createRenderJobForProject: renderServiceModule.createRenderJobForProject,
    createPrismaAssetRepository:
      assetRepositoryModule.createPrismaAssetRepository,
    workerPrisma: workerPrismaModule.prisma,
    runRenderWorkerOnce: workerServiceModule.runRenderWorkerOnce
  };
}

async function prepareSmokeData(deps) {
  const smokeAssets = await ensureSmokeAssets();

  await deps.apiPrisma.videoProject.deleteMany({
    where: {
      title: smokeProjectTitle
    }
  });

  const channel = await deps.apiPrisma.channel.upsert({
    where: {
      name: "Smoke Audio Channel"
    },
    update: {
      niche: "Local render audio validation",
      language: "pt-BR",
      visualStyle: "Deterministic smoke assets",
      narrativeTone: "Technical verification",
      defaultTemplate: "cinematic_story"
    },
    create: {
      name: "Smoke Audio Channel",
      niche: "Local render audio validation",
      language: "pt-BR",
      visualStyle: "Deterministic smoke assets",
      narrativeTone: "Technical verification",
      defaultTemplate: "cinematic_story"
    }
  });

  const persistedImages = [];

  for (const smokeImage of smokeAssets.images) {
    persistedImages.push(
      await deps.apiPrisma.asset.upsert({
        where: {
          path: smokeImage.relativePath
        },
        update: {
          filename: smokeImage.filename,
          originalName: smokeImage.filename,
          type: "IMAGE",
          category: "REFERENCE",
          franchise: "Smoke Test",
          character: null,
          emotion: smokeImage.emotion,
          tags: JSON.stringify(["smoke", "audio", smokeImage.visualPreset]),
          licenseType: "local-generated",
          copyrightRisk: "LOW",
          recommendedUse: "Audio smoke image",
          duration: null,
          width: 1080,
          height: 1920,
          mimeType: "image/png",
          extension: ".png",
          fileSize: smokeImage.fileSize
        },
        create: {
          filename: smokeImage.filename,
          originalName: smokeImage.filename,
          path: smokeImage.relativePath,
          type: "IMAGE",
          category: "REFERENCE",
          franchise: "Smoke Test",
          character: null,
          emotion: smokeImage.emotion,
          tags: JSON.stringify(["smoke", "audio", smokeImage.visualPreset]),
          licenseType: "local-generated",
          copyrightRisk: "LOW",
          recommendedUse: "Audio smoke image",
          duration: null,
          width: 1080,
          height: 1920,
          mimeType: "image/png",
          extension: ".png",
          fileSize: smokeImage.fileSize
        }
      })
    );
  }

  const musicAsset = await deps.apiPrisma.asset.upsert({
    where: {
      path: smokeAssets.music.relativePath
    },
    update: {
      filename: "smoke_music.wav",
      originalName: "smoke_music.wav",
      type: "MUSIC",
      category: "TRACK",
      franchise: "Smoke Test",
      character: null,
      emotion: "DARK",
      tags: JSON.stringify(["smoke", "music"]),
      licenseType: "local-generated",
      copyrightRisk: "LOW",
      recommendedUse: "Audio smoke music bed",
      duration: 3,
      mimeType: "audio/wav",
      extension: ".wav",
      fileSize: smokeAssets.music.fileSize
    },
    create: {
      filename: "smoke_music.wav",
      originalName: "smoke_music.wav",
      path: smokeAssets.music.relativePath,
      type: "MUSIC",
      category: "TRACK",
      franchise: "Smoke Test",
      character: null,
      emotion: "DARK",
      tags: JSON.stringify(["smoke", "music"]),
      licenseType: "local-generated",
      copyrightRisk: "LOW",
      recommendedUse: "Audio smoke music bed",
      duration: 3,
      mimeType: "audio/wav",
      extension: ".wav",
      fileSize: smokeAssets.music.fileSize
    }
  });

  const voiceAsset = await deps.apiPrisma.asset.upsert({
    where: {
      path: smokeAssets.voice.relativePath
    },
    update: {
      filename: "smoke_voice.wav",
      originalName: "smoke_voice.wav",
      type: "AUDIO",
      category: "TRACK",
      franchise: "Smoke Test",
      character: null,
      emotion: "NEUTRAL",
      tags: JSON.stringify(["smoke", "voice"]),
      licenseType: "local-generated",
      copyrightRisk: "LOW",
      recommendedUse: "Audio smoke voiceover",
      duration: 7,
      mimeType: "audio/wav",
      extension: ".wav",
      fileSize: smokeAssets.voice.fileSize
    },
    create: {
      filename: "smoke_voice.wav",
      originalName: "smoke_voice.wav",
      path: smokeAssets.voice.relativePath,
      type: "AUDIO",
      category: "TRACK",
      franchise: "Smoke Test",
      character: null,
      emotion: "NEUTRAL",
      tags: JSON.stringify(["smoke", "voice"]),
      licenseType: "local-generated",
      copyrightRisk: "LOW",
      recommendedUse: "Audio smoke voiceover",
      duration: 7,
      mimeType: "audio/wav",
      extension: ".wav",
      fileSize: smokeAssets.voice.fileSize
    }
  });

  const sfxAsset = await deps.apiPrisma.asset.upsert({
    where: {
      path: smokeAssets.sfx.relativePath
    },
    update: {
      filename: "smoke_hit.wav",
      originalName: "smoke_hit.wav",
      type: "SFX",
      category: "EFFECT",
      franchise: "Smoke Test",
      character: null,
      emotion: "TENSE",
      tags: JSON.stringify(["smoke", "sfx"]),
      licenseType: "local-generated",
      copyrightRisk: "LOW",
      recommendedUse: "Audio smoke SFX",
      duration: 0.4,
      mimeType: "audio/wav",
      extension: ".wav",
      fileSize: smokeAssets.sfx.fileSize
    },
    create: {
      filename: "smoke_hit.wav",
      originalName: "smoke_hit.wav",
      path: smokeAssets.sfx.relativePath,
      type: "SFX",
      category: "EFFECT",
      franchise: "Smoke Test",
      character: null,
      emotion: "TENSE",
      tags: JSON.stringify(["smoke", "sfx"]),
      licenseType: "local-generated",
      copyrightRisk: "LOW",
      recommendedUse: "Audio smoke SFX",
      duration: 0.4,
      mimeType: "audio/wav",
      extension: ".wav",
      fileSize: smokeAssets.sfx.fileSize
    }
  });

  const projectRepository = deps.createPrismaProjectRepository({
    prismaClient: deps.apiPrisma
  });
  const project = await projectRepository.create({
    title: smokeProjectTitle,
    status: "READY_FOR_EDIT",
    channelId: channel.id,
    script: "Audio smoke project with music, voiceover and scene SFX.",
    durationTarget: 10,
    format: "9:16",
    templateId: "cinematic_story",
    defaultCaptionStyle: "premium_yellow",
    backgroundMusicAssetId: musicAsset.id,
    voiceoverAssetId: voiceAsset.id,
    audioMood: "dark_suspense",
    musicVolume: 0.18,
    voiceVolume: 1,
    sfxVolume: 0.72,
    enableAudioDucking: true,
    duckingLevel: 0.35
  });

  for (const [index, persistedImage] of persistedImages.entries()) {
    const sceneDefinition = smokeAssets.images[index];

    await projectRepository.createScene(project.id, {
      title: `Smoke Audio Scene ${index + 1}`,
      narrationText: sceneDefinition.narrationText,
      captionText: sceneDefinition.captionText,
      duration: sceneDefinition.duration,
      emotion: sceneDefinition.emotion,
      assetId: persistedImage.id,
      sfxAssetId: index === 1 ? null : sfxAsset.id,
      sfxStartTime: index === 0 ? 0.1 : index === 2 ? 0.25 : 0,
      sfxVolume: index === 0 ? 0.7 : index === 2 ? 0.76 : 0.7,
      visualPreset: sceneDefinition.visualPreset,
      transition: sceneDefinition.transition,
      captionStyle: "premium_yellow",
      captionPosition: "lower-third",
      captionEmphasisWords: ["audio", `scene-${index + 1}`],
      energyLevel: 48 + index * 16
    });
  }

  const renderJobRepository = deps.createPrismaRenderJobRepository({
    prismaClient: deps.apiPrisma
  });
  const renderStorage = deps.createLocalRenderStorage();
  const renderJob = await deps.createRenderJobForProject(
    renderJobRepository,
    projectRepository,
    deps.createPrismaAssetRepository({
      prismaClient: deps.apiPrisma
    }),
    renderStorage,
    project.id,
    {
      renderMode: "cinematic_v2",
      renderQuality: "standard"
    }
  );

  return {
    projectId: project.id,
    renderJobId: renderJob.id
  };
}

async function inspectWithFfprobe(absoluteOutputPath) {
  const { stdout } = await runCommand("ffprobe", [
    "-v",
    "error",
    "-print_format",
    "json",
    "-show_streams",
    "-show_format",
    absoluteOutputPath
  ]);

  const parsed = JSON.parse(stdout);
  const videoStream = Array.isArray(parsed.streams)
    ? parsed.streams.find((stream) => stream.codec_type === "video")
    : null;
  const audioStream = Array.isArray(parsed.streams)
    ? parsed.streams.find((stream) => stream.codec_type === "audio")
    : null;
  const duration = Number(parsed.format?.duration ?? videoStream?.duration ?? 0);

  return {
    width: Number(videoStream?.width ?? 0),
    height: Number(videoStream?.height ?? 0),
    durationSeconds: Number.isFinite(duration) ? duration : 0,
    videoCodec:
      typeof videoStream?.codec_name === "string" ? videoStream.codec_name : null,
    hasAudio: Boolean(audioStream),
    audioCodec:
      typeof audioStream?.codec_name === "string" ? audioStream.codec_name : null,
    audioChannels: Number(audioStream?.channels ?? 0) || null,
    audioSampleRate: Number(audioStream?.sample_rate ?? 0) || null
  };
}

async function validateRenderResult(apiPrisma, renderJobId) {
  const renderJob = await apiPrisma.renderJob.findUnique({
    where: {
      id: renderJobId
    }
  });

  if (!renderJob) {
    throw new Error(`Render job '${renderJobId}' was not found after worker execution.`);
  }

  if (renderJob.status !== "completed") {
    throw new Error(
      `Render job '${renderJobId}' finished with status '${renderJob.status}' instead of 'completed'.`
    );
  }

  if (!renderJob.outputPath || !renderJob.thumbnailPath) {
    throw new Error(`Render job '${renderJobId}' has incomplete output paths.`);
  }

  const absoluteOutputPath = join(projectRoot, renderJob.outputPath);
  const absoluteThumbnailPath = join(projectRoot, renderJob.thumbnailPath);
  const outputStats = await stat(absoluteOutputPath);
  const thumbnailStats = await stat(absoluteThumbnailPath);
  const ffprobe = await inspectWithFfprobe(absoluteOutputPath);

  if (outputStats.size <= 0 || thumbnailStats.size <= 0) {
    throw new Error("Audio smoke render generated empty output artifacts.");
  }

  if (renderJob.outputWidth !== 1080 || renderJob.outputHeight !== 1920) {
    throw new Error(
      `Expected 1080x1920 output, got ${renderJob.outputWidth}x${renderJob.outputHeight}.`
    );
  }

  if (!renderJob.hasAudio || !ffprobe.hasAudio) {
    throw new Error("Audio smoke render completed without an audio stream.");
  }

  if (!renderJob.audioCodec || !renderJob.audioChannels || !renderJob.audioSampleRate) {
    throw new Error("Audio metadata was not persisted on the render job.");
  }

  if (!["h264", "avc1"].includes(ffprobe.videoCodec ?? "")) {
    throw new Error(`Unexpected video codec '${ffprobe.videoCodec}'.`);
  }

  if (!ffprobe.audioCodec) {
    throw new Error("ffprobe did not detect the audio codec.");
  }

  return {
    outputPath: renderJob.outputPath,
    duration: renderJob.outputDuration ?? ffprobe.durationSeconds,
    resolution: `${renderJob.outputWidth}x${renderJob.outputHeight}`,
    videoCodec: renderJob.outputCodec ?? ffprobe.videoCodec,
    audioCodec: renderJob.audioCodec ?? ffprobe.audioCodec,
    audioChannels: renderJob.audioChannels ?? ffprobe.audioChannels,
    audioSampleRate: renderJob.audioSampleRate ?? ffprobe.audioSampleRate,
    hasAudio: renderJob.hasAudio,
    outputFileSize: renderJob.outputFileSize ?? outputStats.size,
    status: renderJob.status
  };
}

async function main() {
  const ffmpegAvailability = await safeCheckFfmpeg(runCommand);

  if (!ffmpegAvailability.available) {
    if (ffmpegAvailability.blockedByEnvironment) {
      throw new Error(
        buildEnvironmentBlockerMessage(
          "Smoke de render com audio",
          "`npm run smoke:production:logic`"
        )
      );
    }

    throw new Error(
      `FFmpeg is unavailable. ${ffmpegAvailability.errorMessage ?? "Run 'ffmpeg -version' manually."}`
    );
  }

  await ensureBuildArtifacts();
  const deps = await loadSmokeDependencies();

  try {
    log("Generating deterministic local assets for audio smoke.");
    const setup = await prepareSmokeData(deps);

    log(`Created project ${setup.projectId} and render job ${setup.renderJobId}.`);
    let workerResult;

    try {
      workerResult = await deps.runRenderWorkerOnce({
        logger: (message) => {
          log(`[worker] ${message}`);
        }
      });
    } catch (error) {
      if (isSpawnPermissionError(error)) {
        throw new Error(
          buildEnvironmentBlockerMessage(
            "Smoke de render com audio",
            "`npm run smoke:production:logic`"
          )
        );
      }

      throw error;
    }

    if (workerResult.exitCode !== 0) {
      if (isSpawnPermissionError(workerResult.errorMessage ?? "")) {
        throw new Error(
          buildEnvironmentBlockerMessage(
            "Smoke de render com audio",
            "`npm run smoke:production:logic`"
          )
        );
      }

      throw new Error(
        workerResult.errorMessage ??
          `Worker once exited with code ${workerResult.exitCode}.`
      );
    }

    const result = await validateRenderResult(
      deps.apiPrisma,
      setup.renderJobId
    );

    printSmokeSummary({
      projectId: setup.projectId,
      renderJobId: setup.renderJobId,
      ...result
    });
  } finally {
    if (deps.workerPrisma !== deps.apiPrisma) {
      await deps.workerPrisma.$disconnect();
    }

    await deps.apiPrisma.$disconnect();
  }
}

await main();

