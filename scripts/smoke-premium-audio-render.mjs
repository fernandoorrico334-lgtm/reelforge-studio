import { spawn } from "node:child_process";
import { stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  apiArtifactPath,
  buildEnvironmentBlockerMessage,
  ensureArtifactsExist,
  isSpawnPermissionError,
  printSmokeSummary,
  resolveApiBuildRoot,
  resolveBinaryCommand,
  resolveFirstExistingPath,
  safeCheckFfmpeg,
  safeCheckFfprobe,
  writeMinimalPng,
  writeMinimalWav
} from "./lib/smoke-utils.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");
const smokeChannelName = "Smoke Premium Audio Channel";
const smokeProjectTitle = "Smoke Premium Audio Render";

function log(message) {
  console.log(`[smoke:premium-audio-render] ${message}`);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function formatCommand(command, args) {
  return [command, ...args].join(" ");
}

function createCommandError(command, args, code, stdout, stderr) {
  const tail = `${stderr}${stdout}`
    .trim()
    .split(/\r?\n/u)
    .slice(-10)
    .join(" | ");
  const error = new Error(
    `Command '${formatCommand(command, args)}' failed with code ${code ?? "unknown"}. ${tail || "No stdout/stderr output captured."}`
  );

  return Object.assign(error, {
    command,
    args: [...args],
    stdout,
    stderr,
    code
  });
}

function createSpawnError(command, args, error) {
  const wrapped = new Error(
    `Failed to spawn '${formatCommand(command, args)}'. ${error.message}`
  );

  return Object.assign(wrapped, {
    command,
    args: [...args],
    stdout: "",
    stderr: "",
    code: error.code ?? null,
    cause: error
  });
}

function extractAttemptedCommand(error, fallbackCommand = null) {
  if (error && typeof error === "object" && "command" in error && "args" in error) {
    return formatCommand(error.command, Array.isArray(error.args) ? error.args : []);
  }

  return fallbackCommand;
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
      rejectPromise(createSpawnError(command, args, error));
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolvePromise({ stdout, stderr });
        return;
      }

      rejectPromise(createCommandError(command, args, code, stdout, stderr));
    });
  });
}

async function importModule(relativePath) {
  return import(pathToFileURL(join(projectRoot, relativePath)).href);
}

async function ensureBuildArtifacts() {
  const apiBuildRoot = await resolveApiBuildRoot(
    projectRoot,
    "Run 'npm run build' before running smoke:premium-audio-render."
  );
  const workerBuildRoot = await resolveFirstExistingPath(
    projectRoot,
    [
      "apps/worker/dist/apps/worker/src",
      "apps/worker/dist/src",
      "apps/worker/dist"
    ],
    "Run 'npm run build' before running smoke:premium-audio-render."
  );
  const apiArtifacts = [
    "infrastructure/database/prisma-client.js",
    "modules/assets/infrastructure/prisma-asset-repository.js",
    "modules/projects/infrastructure/prisma-project-repository.js",
    "modules/projects/application/project-render-blueprint-service.js",
    "modules/narration/infrastructure/prisma-narration-job-repository.js",
    "modules/narration/application/narration-service.js",
    "modules/render-jobs/infrastructure/local-render-storage.js",
    "modules/render-jobs/infrastructure/prisma-render-job-repository.js",
    "modules/render-jobs/application/render-job-service.js"
  ].map((relativePath) => apiArtifactPath(apiBuildRoot, relativePath));
  const workerArtifacts = [
    `${workerBuildRoot}/infrastructure/prisma-client.js`,
    `${workerBuildRoot}/services/render-worker.js`
  ];

  await ensureArtifactsExist(
    projectRoot,
    [
      "packages/audio-engine/dist/index.js",
      "packages/video-engine/dist/index.js",
      "packages/narration-engine/dist/index.js",
      ...apiArtifacts,
      ...workerArtifacts
    ],
    "Run 'npm run build' before running smoke:premium-audio-render."
  );

  return { apiBuildRoot, workerBuildRoot };
}

async function loadDependencies(apiBuildRoot, workerBuildRoot) {
  const [
    apiPrismaModule,
    assetRepositoryModule,
    projectRepositoryModule,
    renderBlueprintServiceModule,
    narrationJobRepositoryModule,
    narrationServiceModule,
    renderStorageModule,
    renderRepositoryModule,
    renderServiceModule,
    workerPrismaModule,
    workerServiceModule
  ] = await Promise.all([
    importModule(apiArtifactPath(apiBuildRoot, "infrastructure/database/prisma-client.js")),
    importModule(
      apiArtifactPath(
        apiBuildRoot,
        "modules/assets/infrastructure/prisma-asset-repository.js"
      )
    ),
    importModule(
      apiArtifactPath(
        apiBuildRoot,
        "modules/projects/infrastructure/prisma-project-repository.js"
      )
    ),
    importModule(
      apiArtifactPath(
        apiBuildRoot,
        "modules/projects/application/project-render-blueprint-service.js"
      )
    ),
    importModule(
      apiArtifactPath(
        apiBuildRoot,
        "modules/narration/infrastructure/prisma-narration-job-repository.js"
      )
    ),
    importModule(
      apiArtifactPath(
        apiBuildRoot,
        "modules/narration/application/narration-service.js"
      )
    ),
    importModule(
      apiArtifactPath(
        apiBuildRoot,
        "modules/render-jobs/infrastructure/local-render-storage.js"
      )
    ),
    importModule(
      apiArtifactPath(
        apiBuildRoot,
        "modules/render-jobs/infrastructure/prisma-render-job-repository.js"
      )
    ),
    importModule(
      apiArtifactPath(
        apiBuildRoot,
        "modules/render-jobs/application/render-job-service.js"
      )
    ),
    importModule(`${workerBuildRoot}/infrastructure/prisma-client.js`),
    importModule(`${workerBuildRoot}/services/render-worker.js`)
  ]);

  return {
    apiPrisma: apiPrismaModule.prisma,
    createPrismaAssetRepository: assetRepositoryModule.createPrismaAssetRepository,
    createPrismaProjectRepository:
      projectRepositoryModule.createPrismaProjectRepository,
    getVideoProjectRenderBlueprint:
      renderBlueprintServiceModule.getVideoProjectRenderBlueprint,
    createPrismaNarrationJobRepository:
      narrationJobRepositoryModule.createPrismaNarrationJobRepository,
    generateNarrationForScene: narrationServiceModule.generateNarrationForScene,
    createLocalRenderStorage: renderStorageModule.createLocalRenderStorage,
    createPrismaRenderJobRepository:
      renderRepositoryModule.createPrismaRenderJobRepository,
    createRenderJobForProject: renderServiceModule.createRenderJobForProject,
    workerPrisma: workerPrismaModule.prisma,
    runRenderWorkerOnce: workerServiceModule.runRenderWorkerOnce
  };
}

function parseRenderMetadata(value) {
  if (!value) {
    return {};
  }

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed
      : {};
  } catch {
    return {};
  }
}

async function cleanupPreviousSmokeData(prismaClient) {
  const previousProjects = await prismaClient.videoProject.findMany({
    where: { title: smokeProjectTitle },
    select: { id: true }
  });
  const previousProjectIds = previousProjects.map((item) => item.id);
  const previousSceneIds = (
    await prismaClient.scene.findMany({
      where: { videoProjectId: { in: previousProjectIds } },
      select: { id: true }
    })
  ).map((item) => item.id);
  const previousGeneratedAssetIds = (
    await prismaClient.narrationJob.findMany({
      where: {
        OR: [
          { videoProjectId: { in: previousProjectIds } },
          { sceneId: { in: previousSceneIds } }
        ]
      },
      select: { generatedAssetId: true }
    })
  )
    .map((item) => item.generatedAssetId)
    .filter((value) => typeof value === "string");

  await prismaClient.narrationJob.deleteMany({
    where: {
      OR: [
        { videoProjectId: { in: previousProjectIds } },
        { sceneId: { in: previousSceneIds } }
      ]
    }
  });
  await prismaClient.renderJob.deleteMany({
    where: { videoProjectId: { in: previousProjectIds } }
  });
  await prismaClient.scene.deleteMany({
    where: { videoProjectId: { in: previousProjectIds } }
  });
  await prismaClient.videoProject.deleteMany({
    where: { id: { in: previousProjectIds } }
  });
  await prismaClient.asset.deleteMany({
    where: {
      OR: [
        { id: { in: previousGeneratedAssetIds } },
        { path: { startsWith: "storage/assets/smoke/premium-audio-render/" } }
      ]
    }
  });
}

async function ensureSmokeChannel(prismaClient) {
  return prismaClient.channel.upsert({
    where: { name: smokeChannelName },
    update: {
      niche: "premium audio smoke",
      language: "pt-BR",
      visualStyle: "deterministic smoke frames",
      narrativeTone: "technical validation",
      defaultTemplate: "cinematic_story"
    },
    create: {
      name: smokeChannelName,
      niche: "premium audio smoke",
      language: "pt-BR",
      visualStyle: "deterministic smoke frames",
      narrativeTone: "technical validation",
      defaultTemplate: "cinematic_story"
    }
  });
}

async function ensureSceneImageAsset(prismaClient, definition) {
  const relativePath = `storage/assets/smoke/premium-audio-render/${definition.filename}`;
  const absolutePath = await writeMinimalPng(
    join(projectRoot, relativePath),
    definition.filename
  );
  const fileStats = await stat(absolutePath);

  return prismaClient.asset.upsert({
    where: { path: relativePath },
    update: {
      filename: definition.filename,
      originalName: definition.filename,
      type: "IMAGE",
      category: "REFERENCE",
      franchise: "Smoke Test",
      character: null,
      emotion: definition.emotion,
      tags: JSON.stringify(["smoke", "premium-audio-render", definition.visualPreset]),
      licenseType: "local-generated",
      copyrightRisk: "LOW",
      recommendedUse: "Premium audio render smoke image",
      duration: null,
      width: 1080,
      height: 1920,
      mimeType: "image/png",
      extension: ".png",
      fileSize: fileStats.size
    },
    create: {
      filename: definition.filename,
      originalName: definition.filename,
      path: relativePath,
      type: "IMAGE",
      category: "REFERENCE",
      franchise: "Smoke Test",
      character: null,
      emotion: definition.emotion,
      tags: JSON.stringify(["smoke", "premium-audio-render", definition.visualPreset]),
      licenseType: "local-generated",
      copyrightRisk: "LOW",
      recommendedUse: "Premium audio render smoke image",
      duration: null,
      width: 1080,
      height: 1920,
      mimeType: "image/png",
      extension: ".png",
      fileSize: fileStats.size
    }
  });
}

async function ensureWaveAsset(prismaClient, definition) {
  const relativePath = `storage/assets/smoke/premium-audio-render/${definition.filename}`;
  const absolutePath = await writeMinimalWav(
    join(projectRoot, relativePath),
    definition.duration,
    definition.sampleRate ?? 48000,
    definition.filename
  );
  const fileStats = await stat(absolutePath);

  return prismaClient.asset.upsert({
    where: { path: relativePath },
    update: {
      filename: definition.filename,
      originalName: definition.filename,
      type: definition.type,
      category: definition.category,
      franchise: "Smoke Test",
      character: null,
      emotion: definition.emotion,
      tags: JSON.stringify(definition.tags),
      licenseType: "local-generated",
      copyrightRisk: "LOW",
      recommendedUse: definition.recommendedUse,
      duration: definition.duration,
      width: null,
      height: null,
      mimeType: "audio/wav",
      extension: ".wav",
      fileSize: fileStats.size
    },
    create: {
      filename: definition.filename,
      originalName: definition.filename,
      path: relativePath,
      type: definition.type,
      category: definition.category,
      franchise: "Smoke Test",
      character: null,
      emotion: definition.emotion,
      tags: JSON.stringify(definition.tags),
      licenseType: "local-generated",
      copyrightRisk: "LOW",
      recommendedUse: definition.recommendedUse,
      duration: definition.duration,
      width: null,
      height: null,
      mimeType: "audio/wav",
      extension: ".wav",
      fileSize: fileStats.size
    }
  });
}

async function prepareSmokeData(deps) {
  const sceneDefinitions = [
    {
      filename: "scene-1.png",
      title: "Opening beat",
      narrationText:
        "A abertura valida a narracao mock sobre uma cama musical com ducking premium.",
      captionText: "Narracao + musica + ducking",
      duration: 3,
      emotion: "EPIC",
      visualPreset: "epic",
      transition: "fade",
      sfxStartTime: 0.15
    },
    {
      filename: "scene-2.png",
      title: "Closing beat",
      narrationText:
        "A segunda cena confirma o limiter final e o equilibrio do audio no export vertical.",
      captionText: "Limiter e loudness",
      duration: 3,
      emotion: "TENSE",
      visualPreset: "action",
      transition: "hard-cut",
      sfxStartTime: 0.25
    }
  ];

  await cleanupPreviousSmokeData(deps.apiPrisma);
  const channel = await ensureSmokeChannel(deps.apiPrisma);

  const imageAssets = [];

  for (const definition of sceneDefinitions) {
    imageAssets.push(await ensureSceneImageAsset(deps.apiPrisma, definition));
  }

  const musicAsset = await ensureWaveAsset(deps.apiPrisma, {
    filename: "music-bed.wav",
    duration: 6,
    sampleRate: 48000,
    type: "MUSIC",
    category: "TRACK",
    emotion: "EPIC",
    tags: ["smoke", "premium-audio-render", "music"],
    recommendedUse: "Premium audio render smoke music bed"
  });
  const sfxAsset = await ensureWaveAsset(deps.apiPrisma, {
    filename: "impact.wav",
    duration: 0.5,
    sampleRate: 48000,
    type: "SFX",
    category: "EFFECT",
    emotion: "TENSE",
    tags: ["smoke", "premium-audio-render", "sfx"],
    recommendedUse: "Premium audio render smoke transition SFX"
  });

  const project = await deps.apiPrisma.videoProject.create({
    data: {
      title: smokeProjectTitle,
      status: "READY_FOR_EDIT",
      channelId: channel.id,
      script: "Projeto de smoke para validar mix premium com narracao, musica e SFX.",
      durationTarget: 6,
      format: "9:16",
      templateId: "cinematic_story",
      defaultCaptionStyle: "premium_yellow",
      backgroundMusicAssetId: musicAsset.id,
      audioMood: "sports_hype",
      musicVolume: 0.22,
      voiceVolume: 1,
      sfxVolume: 0.82,
      enableAudioDucking: true,
      duckingLevel: 0.35,
      scenes: {
        create: sceneDefinitions.map((definition, index) => ({
          order: index + 1,
          title: definition.title,
          narrationText: definition.narrationText,
          captionText: definition.captionText,
          duration: definition.duration,
          emotion: definition.emotion,
          assetId: imageAssets[index]?.id ?? null,
          sfxAssetId: sfxAsset.id,
          sfxStartTime: definition.sfxStartTime,
          sfxVolume: index === 0 ? 0.76 : 0.84,
          visualPreset: definition.visualPreset,
          visualSourceMode: "asset_only",
          transition: definition.transition,
          captionStyle: "premium_yellow",
          captionPosition: "lower-third",
          captionEmphasisWords: JSON.stringify(["premium", "audio", `scene-${index + 1}`]),
          energyLevel: index === 0 ? 72 : 86
        }))
      }
    },
    include: {
      scenes: {
        orderBy: {
          order: "asc"
        }
      }
    }
  });

  const projectRepository = deps.createPrismaProjectRepository({
    prismaClient: deps.apiPrisma
  });
  const assetRepository = deps.createPrismaAssetRepository({
    prismaClient: deps.apiPrisma
  });
  const narrationJobRepository = deps.createPrismaNarrationJobRepository({
    prismaClient: deps.apiPrisma
  });

  const narrationResults = [];

  for (const scene of project.scenes) {
    narrationResults.push(
      await deps.generateNarrationForScene(
        projectRepository,
        assetRepository,
        narrationJobRepository,
        scene.id,
        {
          provider: "mock-tts",
          voicePackId: "sports_hype_ptbr",
          text: null,
          language: "pt-BR",
          autoAttach: true
        }
      )
    );
  }

  const renderJobRepository = deps.createPrismaRenderJobRepository({
    prismaClient: deps.apiPrisma
  });
  const renderStorage = deps.createLocalRenderStorage();
  const renderJob = await deps.createRenderJobForProject(
    renderJobRepository,
    projectRepository,
    assetRepository,
    renderStorage,
    project.id,
    {
      renderMode: "v1",
      renderQuality: "standard",
      audioMasteringPresetId: "football_hype"
    }
  );

  return {
    projectId: project.id,
    sceneIds: project.scenes.map((scene) => scene.id),
    renderJobId: renderJob.id,
    narrationResults
  };
}

async function inspectWithFfprobe(absoluteOutputPath) {
  const ffprobeCommand = resolveBinaryCommand("ffprobe").command;
  const { stdout } = await runCommand(ffprobeCommand, [
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
  const durationValue = Number(
    parsed.format?.duration ?? videoStream?.duration ?? audioStream?.duration ?? 0
  );

  return {
    hasAudio: Boolean(audioStream),
    audioCodec:
      typeof audioStream?.codec_name === "string" ? audioStream.codec_name : null,
    audioChannels: Number(audioStream?.channels ?? 0) || null,
    audioSampleRate: Number(audioStream?.sample_rate ?? 0) || null,
    durationSeconds:
      Number.isFinite(durationValue) && durationValue > 0
        ? Math.round(durationValue * 1000) / 1000
        : null
  };
}

async function validateRenderResult(deps, smokeSetup) {
  const renderJob = await deps.apiPrisma.renderJob.findUnique({
    where: { id: smokeSetup.renderJobId }
  });

  if (!renderJob) {
    throw new Error(`Render job '${smokeSetup.renderJobId}' was not found.`);
  }

  if (renderJob.status !== "completed") {
    throw new Error(
      `Render job '${smokeSetup.renderJobId}' finished with status '${renderJob.status}'.`
    );
  }

  assert(renderJob.outputPath, "Render job outputPath is missing.");
  const absoluteOutputPath = join(projectRoot, renderJob.outputPath);
  const outputStats = await stat(absoluteOutputPath);
  const ffprobe = await inspectWithFfprobe(absoluteOutputPath);

  if (outputStats.size <= 0) {
    throw new Error("Render output is empty.");
  }

  const metadata = parseRenderMetadata(renderJob.metadata);
  const audioQualityReport = metadata.audioQualityReport ?? null;

  assert(audioQualityReport, "Render job metadata is missing audioQualityReport.");
  assert(
    audioQualityReport.masteringPresetId === "football_hype",
    `Expected masteringPresetId=football_hype, received ${audioQualityReport.masteringPresetId}.`
  );
  assert(audioQualityReport.narrationIncluded, "Expected narrationIncluded=true.");
  assert(audioQualityReport.musicIncluded, "Expected musicIncluded=true.");
  assert(audioQualityReport.sfxIncluded, "Expected sfxIncluded=true.");
  assert(audioQualityReport.duckingEnabled, "Expected duckingEnabled=true.");
  assert(
    audioQualityReport.duckingMode === "sidechain" ||
      audioQualityReport.duckingMode === "global_reduction",
    `Unexpected duckingMode '${audioQualityReport.duckingMode}'.`
  );

  const audioCodec = renderJob.audioCodec ?? ffprobe.audioCodec;
  assert(audioCodec === "aac", `Expected audioCodec=aac, received ${audioCodec}.`);
  assert(Boolean(renderJob.hasAudio && ffprobe.hasAudio), "Render output is missing audio.");

  const projectRepository = deps.createPrismaProjectRepository({
    prismaClient: deps.apiPrisma
  });
  const assetRepository = deps.createPrismaAssetRepository({
    prismaClient: deps.apiPrisma
  });
  const blueprint = await deps.getVideoProjectRenderBlueprint(
    projectRepository,
    assetRepository,
    smokeSetup.projectId
  );

  assert(
    blueprint.audio.sceneNarrations.length >= 2,
    "Blueprint audio plan did not include generated scene narrations."
  );
  assert(
    blueprint.scenes.every((scene) => Boolean(scene.effectiveNarrationAssetId)),
    "Expected every smoke scene to expose effectiveNarrationAssetId."
  );

  return {
    renderJob,
    ffprobe,
    blueprint,
    audioQualityReport,
    absoluteOutputPath
  };
}

async function main() {
  let currentStage = "ffmpeg-check";
  let ffmpegAvailability = null;
  let ffprobeAvailability = null;
  let deps = null;
  let lastAttemptedCommand = null;

  const ffmpegResolution = resolveBinaryCommand("ffmpeg");
  const ffprobeResolution = resolveBinaryCommand("ffprobe");

  log("Checking FFmpeg and FFprobe availability.");

  try {
    ffmpegAvailability = await safeCheckFfmpeg(runCommand);
    ffprobeAvailability = await safeCheckFfprobe(runCommand);

    if (!ffmpegAvailability.available || !ffprobeAvailability.available) {
      const blockingBinary = !ffmpegAvailability.available
        ? ffmpegAvailability
        : ffprobeAvailability;

      printSmokeSummary({
        smoke: "premium-audio-render",
        status: "skipped",
        stage: currentStage,
        reason: blockingBinary.blockedByEnvironment
          ? buildEnvironmentBlockerMessage(
              "Smoke de render premium com audio",
              "`npm run smoke:audio-mastering-presets`"
            )
          : blockingBinary.errorMessage ?? "FFmpeg or FFprobe unavailable.",
        ffmpegCommand: ffmpegAvailability.command,
        ffmpegSource: ffmpegAvailability.source,
        ffmpegEnvVar: ffmpegAvailability.envVar,
        ffmpegError: ffmpegAvailability.errorMessage,
        ffprobeCommand: ffprobeAvailability.command,
        ffprobeSource: ffprobeAvailability.source,
        ffprobeEnvVar: ffprobeAvailability.envVar,
        ffprobeError: ffprobeAvailability.errorMessage,
        suggestion: blockingBinary.notFound
          ? `Confirme o PATH ou defina ${blockingBinary.envVar}.`
          : "Rode `npm run doctor:ffmpeg` para diagnosticar o runtime antes do smoke premium."
      });
      return;
    }

    currentStage = "build-artifacts";
    const { apiBuildRoot, workerBuildRoot } = await ensureBuildArtifacts();
    currentStage = "load-dependencies";
    deps = await loadDependencies(apiBuildRoot, workerBuildRoot);

    currentStage = "prepare-smoke-data";
    const smokeSetup = await prepareSmokeData(deps);

    let workerResult;

    try {
      currentStage = "worker-run";
      workerResult = await deps.runRenderWorkerOnce({
        logger: (message) => {
          log(`[worker] ${message}`);
        }
      });
    } catch (error) {
      if (isSpawnPermissionError(error)) {
        printSmokeSummary({
          smoke: "premium-audio-render",
          status: "skipped",
          stage: currentStage,
          reason: buildEnvironmentBlockerMessage(
            "Smoke de render premium com audio",
            "`npm run smoke:audio-mastering-presets`"
          ),
          ffmpegCommand: ffmpegAvailability.command,
          ffmpegSource: ffmpegAvailability.source,
          ffprobeCommand: ffprobeAvailability.command,
          ffprobeSource: ffprobeAvailability.source,
          attemptedCommand: extractAttemptedCommand(error, lastAttemptedCommand),
          suggestion:
            "O runtime do Node nao conseguiu abrir um processo filho. Rode `npm run doctor:ffmpeg` e depois execute este smoke fora do sandbox."
        });
        return;
      }

      throw error;
    }

    if (workerResult.exitCode !== 0) {
      if (isSpawnPermissionError(workerResult.errorMessage ?? "")) {
        printSmokeSummary({
          smoke: "premium-audio-render",
          status: "skipped",
          stage: currentStage,
          reason: buildEnvironmentBlockerMessage(
            "Smoke de render premium com audio",
            "`npm run smoke:audio-mastering-presets`"
          ),
          ffmpegCommand: ffmpegAvailability.command,
          ffprobeCommand: ffprobeAvailability.command,
          suggestion:
            "O worker encontrou bloqueio de spawn. Rode `npm run doctor:ffmpeg` em terminal normal/elevado."
        });
        return;
      }

      throw new Error(
        workerResult.errorMessage ??
          `Worker once exited with code ${workerResult.exitCode}.`
      );
    }

    currentStage = "validate-render-output";
    const validation = await validateRenderResult(deps, smokeSetup);

    printSmokeSummary({
      smoke: "premium-audio-render",
      projectId: smokeSetup.projectId,
      sceneIds: smokeSetup.sceneIds,
      jobId: smokeSetup.renderJobId,
      generatedNarrationAssetIds: smokeSetup.narrationResults.map(
        (result) => result.asset?.id ?? null
      ),
      outputPath: validation.renderJob.outputPath,
      absoluteOutputPath: validation.absoluteOutputPath,
      masteringPresetId: validation.audioQualityReport.masteringPresetId,
      narrationIncluded: validation.audioQualityReport.narrationIncluded,
      musicIncluded: validation.audioQualityReport.musicIncluded,
      sfxIncluded: validation.audioQualityReport.sfxIncluded,
      duckingEnabled: validation.audioQualityReport.duckingEnabled,
      duckingMode: validation.audioQualityReport.duckingMode,
      compressorApplied: validation.audioQualityReport.compressorApplied,
      limiterApplied: validation.audioQualityReport.limiterApplied,
      loudnormApplied: validation.audioQualityReport.loudnormApplied,
      audioCodec: validation.renderJob.audioCodec ?? validation.ffprobe.audioCodec ?? null,
      finalAudioSampleRate:
        validation.audioQualityReport.finalAudioSampleRate ??
        validation.ffprobe.audioSampleRate,
      durationSeconds:
        validation.renderJob.outputDuration ?? validation.ffprobe.durationSeconds ?? null,
      ffmpegCommand: ffmpegAvailability.command,
      ffmpegSource: ffmpegAvailability.source,
      ffmpegVersion: ffmpegAvailability.versionLine,
      ffprobeCommand: ffprobeAvailability.command,
      ffprobeSource: ffprobeAvailability.source,
      ffprobeVersion: ffprobeAvailability.versionLine,
      status: "completed"
    });
  } catch (error) {
    lastAttemptedCommand = extractAttemptedCommand(error, lastAttemptedCommand);

    printSmokeSummary({
      smoke: "premium-audio-render",
      status: isSpawnPermissionError(error) ? "skipped" : "failed",
      stage: currentStage,
      reason: error instanceof Error ? error.message : String(error),
      ffmpegCommand: ffmpegAvailability?.command ?? ffmpegResolution.command,
      ffmpegSource: ffmpegAvailability?.source ?? ffmpegResolution.source,
      ffmpegEnvVar: ffmpegAvailability?.envVar ?? ffmpegResolution.envVar,
      ffmpegError: ffmpegAvailability?.errorMessage ?? null,
      ffprobeCommand: ffprobeAvailability?.command ?? ffprobeResolution.command,
      ffprobeSource: ffprobeAvailability?.source ?? ffprobeResolution.source,
      ffprobeEnvVar: ffprobeAvailability?.envVar ?? ffprobeResolution.envVar,
      ffprobeError: ffprobeAvailability?.errorMessage ?? null,
      attemptedCommand: lastAttemptedCommand,
      suggestion: isSpawnPermissionError(error)
        ? "O shell encontra o binario, mas o Node nao conseguiu abrir subprocesso. Rode o smoke em terminal normal/elevado."
        : "Abra o render.log do job gerado e compare o pipeline com `npm run doctor:ffmpeg`."
    });

    if (!isSpawnPermissionError(error)) {
      process.exitCode = 1;
    }
  } finally {
    if (deps?.workerPrisma && deps.workerPrisma !== deps.apiPrisma) {
      await deps.workerPrisma.$disconnect();
    }

    if (deps?.apiPrisma) {
      await deps.apiPrisma.$disconnect();
    }
  }
}

main().catch((error) => {
  console.error("[smoke:premium-audio-render] failed unexpectedly", error);
  process.exitCode = 1;
});
