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
  safeCheckFfprobe
} from "./lib/smoke-utils.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");
const smokeChannelName = "Smoke One-Click Render Channel";

function log(message) {
  console.log(`[smoke:one-click-render] ${message}`);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
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

    child.on("error", rejectPromise);
    child.on("close", (code) => {
      if (code === 0) {
        resolvePromise({ stdout, stderr });
        return;
      }

      rejectPromise(
        new Error(
          `Command '${[command, ...args].join(" ")}' failed with code ${code ?? "unknown"}. ${stderr
            .trim()
            .split(/\r?\n/u)
            .slice(-6)
            .join(" | ")}`
        )
      );
    });
  });
}

async function importModule(relativePath) {
  return import(pathToFileURL(join(projectRoot, relativePath)).href);
}

async function ensureBuildArtifacts() {
  const apiBuildRoot = await resolveApiBuildRoot(
    projectRoot,
    "Run 'npm run build' before running smoke:one-click-render."
  );
  const workerBuildRoot = await resolveFirstExistingPath(
    projectRoot,
    [
      "apps/worker/dist/apps/worker/src",
      "apps/worker/dist/src",
      "apps/worker/dist"
    ],
    "Run 'npm run build' before running smoke:one-click-render."
  );
  const apiArtifacts = [
    "infrastructure/database/prisma-client.js",
    "modules/assets/infrastructure/prisma-asset-repository.js",
    "modules/audio-library/infrastructure/prisma-audio-library-repository.js",
    "modules/characters/infrastructure/prisma-character-repository.js",
    "modules/channels/infrastructure/prisma-channel-repository.js",
    "modules/editorial-microclips/infrastructure/prisma-editorial-microclip-repository.js",
    "modules/hybrid-visual/infrastructure/prisma-visual-generation-job-repository.js",
    "modules/intake/infrastructure/prisma-intake-repository.js",
    "modules/narration/infrastructure/prisma-narration-job-repository.js",
    "modules/projects/infrastructure/prisma-project-repository.js",
    "modules/projects/application/project-render-blueprint-service.js",
    "modules/reel-production/infrastructure/prisma-reel-production-run-repository.js",
    "modules/render-jobs/infrastructure/prisma-render-job-repository.js",
    "modules/render-jobs/infrastructure/local-render-storage.js",
    "modules/reels-factory/application/reels-factory-service.js",
    "modules/reel-production/application/reel-production-service.js"
  ].map((relativePath) => apiArtifactPath(apiBuildRoot, relativePath));

  await ensureArtifactsExist(
    projectRoot,
    [
      "packages/audio-engine/dist/index.js",
      "packages/video-engine/dist/index.js",
      "packages/story-engine/dist/reels-factory.js",
      "packages/hybrid-visual-engine/dist/index.js",
      "packages/narration-engine/dist/index.js",
      `${workerBuildRoot}/infrastructure/prisma-client.js`,
      `${workerBuildRoot}/services/render-worker.js`,
      ...apiArtifacts
    ],
    "Run 'npm run build' before running smoke:one-click-render."
  );

  return { apiBuildRoot, workerBuildRoot };
}

async function loadDependencies(apiBuildRoot, workerBuildRoot) {
  const [
    prismaModule,
    assetRepositoryModule,
    audioLibraryRepositoryModule,
    characterRepositoryModule,
    channelRepositoryModule,
    editorialMicroclipRepositoryModule,
    visualGenerationJobRepositoryModule,
    intakeRepositoryModule,
    narrationJobRepositoryModule,
    projectRepositoryModule,
    renderBlueprintServiceModule,
    productionRunRepositoryModule,
    renderJobRepositoryModule,
    renderStorageModule,
    reelsFactoryServiceModule,
    reelProductionServiceModule,
    workerPrismaModule,
    workerServiceModule
  ] = await Promise.all([
    importModule(apiArtifactPath(apiBuildRoot, "infrastructure/database/prisma-client.js")),
    importModule(apiArtifactPath(apiBuildRoot, "modules/assets/infrastructure/prisma-asset-repository.js")),
    importModule(apiArtifactPath(apiBuildRoot, "modules/audio-library/infrastructure/prisma-audio-library-repository.js")),
    importModule(apiArtifactPath(apiBuildRoot, "modules/characters/infrastructure/prisma-character-repository.js")),
    importModule(apiArtifactPath(apiBuildRoot, "modules/channels/infrastructure/prisma-channel-repository.js")),
    importModule(apiArtifactPath(apiBuildRoot, "modules/editorial-microclips/infrastructure/prisma-editorial-microclip-repository.js")),
    importModule(apiArtifactPath(apiBuildRoot, "modules/hybrid-visual/infrastructure/prisma-visual-generation-job-repository.js")),
    importModule(apiArtifactPath(apiBuildRoot, "modules/intake/infrastructure/prisma-intake-repository.js")),
    importModule(apiArtifactPath(apiBuildRoot, "modules/narration/infrastructure/prisma-narration-job-repository.js")),
    importModule(apiArtifactPath(apiBuildRoot, "modules/projects/infrastructure/prisma-project-repository.js")),
    importModule(apiArtifactPath(apiBuildRoot, "modules/projects/application/project-render-blueprint-service.js")),
    importModule(apiArtifactPath(apiBuildRoot, "modules/reel-production/infrastructure/prisma-reel-production-run-repository.js")),
    importModule(apiArtifactPath(apiBuildRoot, "modules/render-jobs/infrastructure/prisma-render-job-repository.js")),
    importModule(apiArtifactPath(apiBuildRoot, "modules/render-jobs/infrastructure/local-render-storage.js")),
    importModule(apiArtifactPath(apiBuildRoot, "modules/reels-factory/application/reels-factory-service.js")),
    importModule(apiArtifactPath(apiBuildRoot, "modules/reel-production/application/reel-production-service.js")),
    importModule(`${workerBuildRoot}/infrastructure/prisma-client.js`),
    importModule(`${workerBuildRoot}/services/render-worker.js`)
  ]);

  return {
    prisma: prismaModule.prisma,
    createPrismaAssetRepository: assetRepositoryModule.createPrismaAssetRepository,
    createPrismaAudioLibraryRepository:
      audioLibraryRepositoryModule.createPrismaAudioLibraryRepository,
    createPrismaCharacterRepository:
      characterRepositoryModule.createPrismaCharacterRepository,
    createPrismaChannelRepository:
      channelRepositoryModule.createPrismaChannelRepository,
    createPrismaEditorialMicroclipRepository:
      editorialMicroclipRepositoryModule.createPrismaEditorialMicroclipRepository,
    createPrismaVisualGenerationJobRepository:
      visualGenerationJobRepositoryModule.createPrismaVisualGenerationJobRepository,
    createPrismaIntakeRepository:
      intakeRepositoryModule.createPrismaIntakeRepository,
    createPrismaNarrationJobRepository:
      narrationJobRepositoryModule.createPrismaNarrationJobRepository,
    createPrismaProjectRepository:
      projectRepositoryModule.createPrismaProjectRepository,
    getVideoProjectRenderBlueprint:
      renderBlueprintServiceModule.getVideoProjectRenderBlueprint,
    createPrismaReelProductionRunRepository:
      productionRunRepositoryModule.createPrismaReelProductionRunRepository,
    createPrismaRenderJobRepository:
      renderJobRepositoryModule.createPrismaRenderJobRepository,
    createLocalRenderStorage: renderStorageModule.createLocalRenderStorage,
    createReelsFactoryProject:
      reelsFactoryServiceModule.createReelsFactoryProject,
    runOneClickReelProduction:
      reelProductionServiceModule.runOneClickReelProduction,
    workerPrisma: workerPrismaModule.prisma,
    runRenderWorkerOnce: workerServiceModule.runRenderWorkerOnce
  };
}

async function ensureSmokeChannel(prismaClient) {
  return prismaClient.channel.upsert({
    where: { name: smokeChannelName },
    update: {
      niche: "football one-click render smoke",
      language: "pt-BR",
      visualStyle: "sports editorial studio",
      narrativeTone: "hype tactical",
      defaultTemplate: "sports_hype",
      defaultVisualPreset: "action",
      defaultRenderMode: "cinematic_v2",
      defaultRenderQuality: "draft"
    },
    create: {
      name: smokeChannelName,
      niche: "football one-click render smoke",
      language: "pt-BR",
      visualStyle: "sports editorial studio",
      narrativeTone: "hype tactical",
      defaultTemplate: "sports_hype",
      defaultVisualPreset: "action",
      defaultRenderMode: "cinematic_v2",
      defaultRenderQuality: "draft"
    }
  });
}

async function cleanupPreviousSmokeData(prismaClient, channelId) {
  const previousProjects = await prismaClient.videoProject.findMany({
    where: { channelId },
    select: { id: true }
  });
  const previousProjectIds = previousProjects.map((project) => project.id);

  if (previousProjectIds.length === 0) {
    return;
  }

  const previousSceneIds = (
    await prismaClient.scene.findMany({
      where: { videoProjectId: { in: previousProjectIds } },
      select: { id: true }
    })
  ).map((scene) => scene.id);
  const previousGeneratedAssetIds = [
    ...(await prismaClient.narrationJob.findMany({
      where: {
        OR: [
          { videoProjectId: { in: previousProjectIds } },
          { sceneId: { in: previousSceneIds } }
        ]
      },
      select: { generatedAssetId: true }
    })),
    ...(await prismaClient.visualGenerationJob.findMany({
      where: {
        OR: [
          { videoProjectId: { in: previousProjectIds } },
          { sceneId: { in: previousSceneIds } }
        ]
      },
      select: { generatedAssetId: true }
    }))
  ]
    .map((item) => item.generatedAssetId)
    .filter((value) => typeof value === "string");

  await prismaClient.reelProductionRun.deleteMany({
    where: { videoProjectId: { in: previousProjectIds } }
  });
  await prismaClient.renderJob.deleteMany({
    where: { videoProjectId: { in: previousProjectIds } }
  });
  await prismaClient.visualGenerationJob.deleteMany({
    where: { videoProjectId: { in: previousProjectIds } }
  });
  await prismaClient.narrationJob.deleteMany({
    where: {
      OR: [
        { videoProjectId: { in: previousProjectIds } },
        { sceneId: { in: previousSceneIds } }
      ]
    }
  });
  await prismaClient.scene.deleteMany({
    where: { videoProjectId: { in: previousProjectIds } }
  });
  await prismaClient.videoProject.deleteMany({
    where: { id: { in: previousProjectIds } }
  });
  await prismaClient.asset.deleteMany({
    where: { id: { in: previousGeneratedAssetIds } }
  });
}

function createDependencies(deps) {
  return {
    appEnv: {
      dataBackend: "prisma",
      comfyUiBaseUrl: "http://127.0.0.1:8189",
      comfyUiDefaultWorkflow: "txt2img-basic",
      comfyUiEnabled: false,
      comfyUiWorkflowDir: "storage/comfyui/workflows",
      comfyUiTimeoutMs: 300000,
      narrationWindowsSapiEnabled: false,
      port: 4000
    },
    assetRepository: deps.createPrismaAssetRepository(),
    audioLibraryRepository: deps.createPrismaAudioLibraryRepository(),
    characterRepository: deps.createPrismaCharacterRepository(),
    editorialMicroclipRepository:
      deps.createPrismaEditorialMicroclipRepository(),
    intakeRepository: deps.createPrismaIntakeRepository(),
    narrationJobRepository: deps.createPrismaNarrationJobRepository(),
    projectRepository: deps.createPrismaProjectRepository(),
    renderJobRepository: deps.createPrismaRenderJobRepository(),
    renderStorage: deps.createLocalRenderStorage(),
    runRepository: deps.createPrismaReelProductionRunRepository(),
    visualGenerationJobRepository:
      deps.createPrismaVisualGenerationJobRepository()
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

  return {
    hasAudio: Boolean(audioStream),
    audioCodec:
      typeof audioStream?.codec_name === "string" ? audioStream.codec_name : null,
    videoCodec:
      typeof videoStream?.codec_name === "string" ? videoStream.codec_name : null,
    durationSeconds: Number(parsed.format?.duration ?? 0) || null
  };
}

async function main() {
  let currentStage = "ffmpeg-check";
  let deps = null;
  let ffmpegAvailability = null;
  let ffprobeAvailability = null;

  try {
    ffmpegAvailability = await safeCheckFfmpeg(runCommand);
    ffprobeAvailability = await safeCheckFfprobe(runCommand);

    if (!ffmpegAvailability.available || !ffprobeAvailability.available) {
      printSmokeSummary({
        smoke: "one-click-render",
        status: "skipped",
        stage: currentStage,
        reason:
          ffmpegAvailability.errorMessage ??
          ffprobeAvailability.errorMessage ??
          "FFmpeg/ffprobe unavailable.",
        ffmpegCommand: ffmpegAvailability.command,
        ffmpegSource: ffmpegAvailability.source,
        ffprobeCommand: ffprobeAvailability.command,
        ffprobeSource: ffprobeAvailability.source,
        suggestion: ffmpegAvailability.blockedByEnvironment
          ? buildEnvironmentBlockerMessage(
              "Smoke One-Click Render",
              "`npm run smoke:one-click-production`"
            )
          : "Confirme PATH/FFMPEG_PATH/FFPROBE_PATH."
      });
      return;
    }

    currentStage = "build-artifacts";
    const { apiBuildRoot, workerBuildRoot } = await ensureBuildArtifacts();
    currentStage = "load-dependencies";
    deps = await loadDependencies(apiBuildRoot, workerBuildRoot);

    currentStage = "prepare-project";
    const smokeChannel = await ensureSmokeChannel(deps.prisma);
    await cleanupPreviousSmokeData(deps.prisma, smokeChannel.id);
    const channelRepository = deps.createPrismaChannelRepository();
    const dependencies = createDependencies(deps);
    const created = await deps.createReelsFactoryProject(
      dependencies.projectRepository,
      channelRepository,
      {
        channelId: smokeChannel.id,
        topic: "Copa do Mundo",
        subject: "contra-ataque decisivo",
        angle: "como o lance acelerou o jogo em poucos segundos",
        templateId: "player_threat_analysis",
        editingReferencePresetId: "sports_hype_cut",
        tone: "hype",
        durationSeconds: 12,
        language: "pt-BR",
        includeMicroclip: false
      }
    );
    const projectId = created.projectId;

    currentStage = "one-click-render-run";
    const productionRun = await deps.runOneClickReelProduction(
      dependencies,
      projectId,
      {
        mode: "render",
        providerStrategy: {
          visualProvider: "mock-svg",
          fallbackVisualProvider: "mock-svg",
          narrationProvider: "mock-tts"
        },
        defaults: {
          voicePackId: "sports_hype_ptbr",
          musicPresetId: "football_hype",
          audioMasteringPresetId: "football_hype",
          qualityPresetId: "standard",
          workflowPackId: "sports_hype"
        },
        options: {
          generateMissingNarration: true,
          generateMissingVisuals: true,
          selectMusic: true,
          buildBeatSyncPlan: true,
          useEditorialMicroclips: true,
          createRenderJob: true,
          runRender: true
        }
      }
    );

    assert(productionRun.renderJobId, "One-click render did not create RenderJob.");

    currentStage = "worker-run";
    const workerResult = await deps.runRenderWorkerOnce({
      logger: (message) => log(`[worker] ${message}`)
    });
    assert(
      workerResult.exitCode === 0,
      workerResult.errorMessage ?? "Worker did not complete successfully."
    );
    assert(
      workerResult.renderJobId === productionRun.renderJobId,
      "Worker processed a different RenderJob than the one-click run created."
    );

    currentStage = "validate-render";
    const renderJob = await deps.prisma.renderJob.findUnique({
      where: { id: productionRun.renderJobId }
    });
    assert(renderJob, "RenderJob was not found after worker run.");
    assert(renderJob.status === "completed", `RenderJob ended as ${renderJob.status}.`);
    assert(renderJob.outputPath, "RenderJob completed without outputPath.");

    const absoluteOutputPath = join(projectRoot, renderJob.outputPath);
    const outputStats = await stat(absoluteOutputPath);
    assert(outputStats.size > 0, "One-click render output is empty.");
    const ffprobe = await inspectWithFfprobe(absoluteOutputPath);
    assert(ffprobe.hasAudio, "One-click render output has no audio stream.");

    const projectRepository = deps.createPrismaProjectRepository();
    const assetRepository = deps.createPrismaAssetRepository();
    const blueprint = await deps.getVideoProjectRenderBlueprint(
      projectRepository,
      assetRepository,
      dependencies.editorialMicroclipRepository,
      projectId
    );
    const metadata = renderJob.metadata ? JSON.parse(renderJob.metadata) : {};
    const audioQualityReport = metadata.audioQualityReport ?? null;

    assert(audioQualityReport, "RenderJob metadata is missing audioQualityReport.");
    assert(
      blueprint.audio.sceneNarrations.length > 0,
      "Render Blueprint did not include generated narration."
    );

    printSmokeSummary({
      smoke: "one-click-render",
      status: "completed",
      projectId,
      productionRunId: productionRun.runId,
      renderJobId: productionRun.renderJobId,
      workerProcessed: true,
      outputPath: renderJob.outputPath,
      absoluteOutputPath,
      outputBytes: outputStats.size,
      narrationIncluded:
        blueprint.audio.sceneNarrations.length > 0 && Boolean(renderJob.hasAudio),
      musicIncluded: Boolean(blueprint.selectedMusicAssetId),
      selectedMusicAssetId: blueprint.selectedMusicAssetId,
      musicPresetId: blueprint.musicPresetId,
      audioMasteringPresetId: audioQualityReport.masteringPresetId,
      audioQualityReportPresent: Boolean(audioQualityReport),
      audioCodec: renderJob.audioCodec ?? ffprobe.audioCodec,
      videoCodec: renderJob.outputCodec ?? ffprobe.videoCodec,
      durationSeconds: renderJob.outputDuration ?? ffprobe.durationSeconds,
      blueprintCoherent:
        blueprint.sceneCount > 0 &&
        blueprint.scenes.every((scene) => scene.effectiveAssetId),
      warnings: productionRun.warnings
    });
  } catch (error) {
    printSmokeSummary({
      smoke: "one-click-render",
      status: isSpawnPermissionError(error) ? "skipped" : "failed",
      stage: currentStage,
      reason: error instanceof Error ? error.message : String(error),
      ffmpegCommand:
        ffmpegAvailability?.command ?? resolveBinaryCommand("ffmpeg").command,
      ffmpegSource: ffmpegAvailability?.source ?? resolveBinaryCommand("ffmpeg").source,
      ffprobeCommand:
        ffprobeAvailability?.command ?? resolveBinaryCommand("ffprobe").command,
      ffprobeSource:
        ffprobeAvailability?.source ?? resolveBinaryCommand("ffprobe").source,
      suggestion: isSpawnPermissionError(error)
        ? "Execute este smoke em terminal Windows normal/elevado fora do sandbox."
        : "Veja o render log do RenderJob gerado para o comando FFmpeg completo."
    });

    if (!isSpawnPermissionError(error)) {
      process.exitCode = 1;
    }
  } finally {
    if (deps?.workerPrisma && deps.workerPrisma !== deps.prisma) {
      await deps.workerPrisma.$disconnect();
    }

    if (deps?.prisma) {
      await deps.prisma.$disconnect();
    }
  }
}

main().catch((error) => {
  console.error("[smoke:one-click-render] failed unexpectedly", error);
  process.exitCode = 1;
});
