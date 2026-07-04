import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  apiArtifactPath,
  ensureArtifactsExist,
  printSmokeSummary,
  resolveApiBuildRoot
} from "./lib/smoke-utils.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");
const smokeChannelName = "Smoke One-Click Production Channel";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function importModule(relativePath) {
  return import(pathToFileURL(join(projectRoot, relativePath)).href);
}

async function ensureBuildArtifacts() {
  const apiBuildRoot = await resolveApiBuildRoot(
    projectRoot,
    "Run 'npm run build' before running smoke:one-click-production."
  );
  const apiArtifacts = [
    "infrastructure/database/prisma-client.js",
    "modules/assets/infrastructure/prisma-asset-repository.js",
    "modules/audio-library/infrastructure/prisma-audio-library-repository.js",
    "modules/characters/infrastructure/prisma-character-repository.js",
    "modules/channels/infrastructure/prisma-channel-repository.js",
    "modules/editorial-microclips/infrastructure/prisma-editorial-microclip-repository.js",
    "modules/hybrid-visual/infrastructure/prisma-visual-generation-job-repository.js",
    "modules/narration/infrastructure/prisma-narration-job-repository.js",
    "modules/projects/infrastructure/prisma-project-repository.js",
    "modules/reel-production/infrastructure/prisma-reel-production-run-repository.js",
    "modules/render-jobs/infrastructure/prisma-render-job-repository.js",
    "modules/render-jobs/infrastructure/local-render-storage.js",
    "modules/reels-factory/application/reels-factory-service.js",
    "modules/reel-production/application/reel-production-service.js"
  ].map((relativePath) => apiArtifactPath(apiBuildRoot, relativePath));

  await ensureArtifactsExist(
    projectRoot,
    [
      "packages/story-engine/dist/reels-factory.js",
      "packages/hybrid-visual-engine/dist/index.js",
      "packages/narration-engine/dist/index.js",
      ...apiArtifacts
    ],
    "Run 'npm run build' before running smoke:one-click-production."
  );

  return { apiBuildRoot };
}

async function loadDependencies(apiBuildRoot) {
  const [
    prismaModule,
    assetRepositoryModule,
    audioLibraryRepositoryModule,
    characterRepositoryModule,
    channelRepositoryModule,
    editorialMicroclipRepositoryModule,
    visualGenerationJobRepositoryModule,
    narrationJobRepositoryModule,
    projectRepositoryModule,
    productionRunRepositoryModule,
    renderJobRepositoryModule,
    renderStorageModule,
    reelsFactoryServiceModule,
    reelProductionServiceModule
  ] = await Promise.all([
    importModule(apiArtifactPath(apiBuildRoot, "infrastructure/database/prisma-client.js")),
    importModule(apiArtifactPath(apiBuildRoot, "modules/assets/infrastructure/prisma-asset-repository.js")),
    importModule(apiArtifactPath(apiBuildRoot, "modules/audio-library/infrastructure/prisma-audio-library-repository.js")),
    importModule(apiArtifactPath(apiBuildRoot, "modules/characters/infrastructure/prisma-character-repository.js")),
    importModule(apiArtifactPath(apiBuildRoot, "modules/channels/infrastructure/prisma-channel-repository.js")),
    importModule(apiArtifactPath(apiBuildRoot, "modules/editorial-microclips/infrastructure/prisma-editorial-microclip-repository.js")),
    importModule(apiArtifactPath(apiBuildRoot, "modules/hybrid-visual/infrastructure/prisma-visual-generation-job-repository.js")),
    importModule(apiArtifactPath(apiBuildRoot, "modules/narration/infrastructure/prisma-narration-job-repository.js")),
    importModule(apiArtifactPath(apiBuildRoot, "modules/projects/infrastructure/prisma-project-repository.js")),
    importModule(apiArtifactPath(apiBuildRoot, "modules/reel-production/infrastructure/prisma-reel-production-run-repository.js")),
    importModule(apiArtifactPath(apiBuildRoot, "modules/render-jobs/infrastructure/prisma-render-job-repository.js")),
    importModule(apiArtifactPath(apiBuildRoot, "modules/render-jobs/infrastructure/local-render-storage.js")),
    importModule(apiArtifactPath(apiBuildRoot, "modules/reels-factory/application/reels-factory-service.js")),
    importModule(apiArtifactPath(apiBuildRoot, "modules/reel-production/application/reel-production-service.js"))
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
    createPrismaNarrationJobRepository:
      narrationJobRepositoryModule.createPrismaNarrationJobRepository,
    createPrismaProjectRepository:
      projectRepositoryModule.createPrismaProjectRepository,
    createPrismaReelProductionRunRepository:
      productionRunRepositoryModule.createPrismaReelProductionRunRepository,
    createPrismaRenderJobRepository:
      renderJobRepositoryModule.createPrismaRenderJobRepository,
    createLocalRenderStorage: renderStorageModule.createLocalRenderStorage,
    createReelsFactoryProject:
      reelsFactoryServiceModule.createReelsFactoryProject,
    buildReelProductionChecklist:
      reelProductionServiceModule.buildReelProductionChecklist,
    runOneClickReelProduction:
      reelProductionServiceModule.runOneClickReelProduction
  };
}

async function ensureSmokeChannel(prismaClient) {
  return prismaClient.channel.upsert({
    where: { name: smokeChannelName },
    update: {
      niche: "football one-click smoke",
      language: "pt-BR",
      visualStyle: "sports editorial studio",
      narrativeTone: "hype tactical",
      defaultTemplate: "sports_hype",
      defaultVisualPreset: "action"
    },
    create: {
      name: smokeChannelName,
      niche: "football one-click smoke",
      language: "pt-BR",
      visualStyle: "sports editorial studio",
      narrativeTone: "hype tactical",
      defaultTemplate: "sports_hype",
      defaultVisualPreset: "action"
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
    where: { videoProjectId: { in: previousProjectIds } }
  });
  await prismaClient.scene.deleteMany({
    where: { videoProjectId: { in: previousProjectIds } }
  });
  await prismaClient.videoProject.deleteMany({
    where: { id: { in: previousProjectIds } }
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
    narrationJobRepository: deps.createPrismaNarrationJobRepository(),
    projectRepository: deps.createPrismaProjectRepository(),
    renderJobRepository: deps.createPrismaRenderJobRepository(),
    renderStorage: deps.createLocalRenderStorage(),
    runRepository: deps.createPrismaReelProductionRunRepository(),
    visualGenerationJobRepository:
      deps.createPrismaVisualGenerationJobRepository()
  };
}

async function main() {
  const { apiBuildRoot } = await ensureBuildArtifacts();
  const deps = await loadDependencies(apiBuildRoot);

  try {
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
        subject: "jogada decisiva",
        angle: "por que esse lance mudou o ritmo do jogo",
        templateId: "player_threat_analysis",
        editingReferencePresetId: null,
        tone: "hype",
        durationSeconds: 18,
        language: "pt-BR",
        includeMicroclip: false
      }
    );
    const projectId = created.projectId;
    const checklist = await deps.buildReelProductionChecklist(
      dependencies,
      projectId
    );

    assert(checklist.scenesTotal > 0, "Checklist should include scenes.");

    const dryRun = await deps.runOneClickReelProduction(dependencies, projectId, {
      mode: "dry_run",
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
        createRenderJob: false,
        runRender: false
      }
    });

    assert(dryRun.status === "completed", "Dry run should complete.");

    const prepared = await deps.runOneClickReelProduction(dependencies, projectId, {
      mode: "prepare_only",
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
        createRenderJob: false,
        runRender: false
      }
    });

    const refreshedProject = await dependencies.projectRepository.getById(projectId);
    const narrationReadyCount =
      refreshedProject?.scenes.filter((scene) => scene.generatedNarrationAssetId).length ??
      0;
    const visualReadyCount =
      refreshedProject?.scenes.filter((scene) => scene.generatedAssetId ?? scene.assetId)
        .length ?? 0;

    assert(refreshedProject, "Project should still exist after prepare_only.");
    assert(narrationReadyCount > 0, "prepare_only should generate narration.");
    assert(visualReadyCount > 0, "prepare_only should generate visuals.");
    assert(
      prepared.checklist.renderReady || prepared.status === "partial",
      "prepare_only should be completed or partial with warnings."
    );

    printSmokeSummary("smoke:one-click-production", {
      status: "completed",
      projectId,
      runId: prepared.runId,
      dryRunId: dryRun.runId,
      scenesTotal: prepared.checklist.scenesTotal,
      narrationReadyCount,
      visualReadyCount,
      selectedMusicAssetId: refreshedProject?.backgroundMusicAssetId ?? null,
      renderReady: prepared.checklist.renderReady,
      warnings: prepared.warnings
    });
  } finally {
    await deps.prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
