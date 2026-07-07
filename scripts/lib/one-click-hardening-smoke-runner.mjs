import { writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  apiArtifactPath,
  ensureArtifactsExist,
  isSpawnPermissionError,
  printSmokeSummary,
  resolveApiBuildRoot
} from "./smoke-utils.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "../..");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function isWorkerSpawnBlocked(message) {
  return /spawn\s+(EPERM|EINVAL)/i.test(message) || /Worker spawn failed/i.test(message);
}

async function importModule(relativePath) {
  return import(pathToFileURL(join(projectRoot, relativePath)).href);
}

async function loadDependencies() {
  const apiBuildRoot = await resolveApiBuildRoot(
    projectRoot,
    "Run 'npm run build' before one-click hardening smokes."
  );
  const artifacts = [
    "infrastructure/database/prisma-client.js",
    "modules/assets/infrastructure/prisma-asset-repository.js",
    "modules/audio-library/infrastructure/prisma-audio-library-repository.js",
    "modules/characters/infrastructure/prisma-character-repository.js",
    "modules/editorial-microclips/infrastructure/prisma-editorial-microclip-repository.js",
    "modules/hybrid-visual/infrastructure/prisma-visual-generation-job-repository.js",
    "modules/intake/infrastructure/prisma-intake-repository.js",
    "modules/narration/infrastructure/prisma-narration-job-repository.js",
    "modules/projects/infrastructure/prisma-project-repository.js",
    "modules/reel-production/infrastructure/prisma-reel-production-run-repository.js",
    "modules/render-jobs/infrastructure/prisma-render-job-repository.js",
    "modules/render-jobs/infrastructure/local-render-storage.js",
    "modules/reel-production/application/reel-production-service.js"
  ].map((relativePath) => apiArtifactPath(apiBuildRoot, relativePath));

  await ensureArtifactsExist(projectRoot, artifacts, "Run 'npm run build' first.");

  const [
    prismaModule,
    assetRepositoryModule,
    audioLibraryRepositoryModule,
    characterRepositoryModule,
    editorialMicroclipRepositoryModule,
    visualGenerationJobRepositoryModule,
    intakeRepositoryModule,
    narrationJobRepositoryModule,
    projectRepositoryModule,
    runRepositoryModule,
    renderJobRepositoryModule,
    renderStorageModule,
    serviceModule
  ] = await Promise.all(artifacts.map((artifact) => importModule(artifact)));

  return {
    prisma: prismaModule.prisma,
    createDependencies() {
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
        assetRepository: assetRepositoryModule.createPrismaAssetRepository(),
        audioLibraryRepository:
          audioLibraryRepositoryModule.createPrismaAudioLibraryRepository(),
        characterRepository: characterRepositoryModule.createPrismaCharacterRepository(),
        editorialMicroclipRepository:
          editorialMicroclipRepositoryModule.createPrismaEditorialMicroclipRepository(),
        intakeRepository: intakeRepositoryModule.createPrismaIntakeRepository(),
        narrationJobRepository:
          narrationJobRepositoryModule.createPrismaNarrationJobRepository(),
        projectRepository: projectRepositoryModule.createPrismaProjectRepository(),
        renderJobRepository: renderJobRepositoryModule.createPrismaRenderJobRepository(),
        renderStorage: renderStorageModule.createLocalRenderStorage(),
        runRepository: runRepositoryModule.createPrismaReelProductionRunRepository(),
        visualGenerationJobRepository:
          visualGenerationJobRepositoryModule.createPrismaVisualGenerationJobRepository()
      };
    },
    buildReelProductionChecklist: serviceModule.buildReelProductionChecklist,
    runOneClickReelProduction: serviceModule.runOneClickReelProduction
  };
}

function runId() {
  return `one-click-${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`;
}

async function createProject(prisma, suffix = runId()) {
  const channel = await prisma.channel.create({
    data: {
      name: `One-Click Runtime ${suffix}`,
      niche: "football",
      language: "pt-BR",
      visualStyle: "sports editorial",
      narrativeTone: "hype",
      defaultTemplate: "sports_hype",
      defaultVisualPreset: "action"
    }
  });
  const project = await prisma.videoProject.create({
    data: {
      title: `One-Click Runtime ${suffix}`,
      channelId: channel.id,
      script: "Gancho rapido, contexto e fechamento editorial.",
      durationTarget: 12,
      format: "9:16",
      templateId: "player_threat_analysis",
      musicPresetId: "football_hype",
      scenes: {
        create: [
          {
            order: 1,
            title: "Hook",
            narrationText: "Olha esse lance decisivo em poucos segundos.",
            captionText: "O lance que muda tudo",
            duration: 4,
            emotion: "TENSE",
            visualPreset: "action",
            transition: "cut"
          },
          {
            order: 2,
            title: "Impacto",
            narrationText: "A leitura, o espaco e a finalizacao aparecem no mesmo corte.",
            captionText: "Leitura, espaco e impacto",
            duration: 5,
            emotion: "EPIC",
            visualPreset: "epic",
            transition: "flash"
          }
        ]
      }
    }
  });

  return { channelId: channel.id, projectId: project.id };
}

function baseInput(mode, extra = {}) {
  return {
    mode,
    runWorkerOnce: false,
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
      createRenderJob: mode === "render",
      runRender: false,
      runWorkerOnce: false
    },
    ...extra
  };
}

async function disconnect(deps) {
  await deps.prisma.$disconnect();
}

export async function runOneClickBeastPlanSmoke() {
  const deps = await loadDependencies();

  try {
    const { projectId } = await createProject(deps.prisma);
    const beforeJobs = await deps.prisma.renderJob.count({ where: { videoProjectId: projectId } });
    const newModeResult = await deps.runOneClickReelProduction(
      deps.createDependencies(),
      projectId,
      baseInput("dry_run", {
        remixMode: "new",
        intensity: "extreme",
        newMusicPreset: "football_hype"
      })
    );

    assert(newModeResult.beastPlan, "New mode should return beastPlan.");
    assert(
      newModeResult.beastPlan.planType === "premium_reel",
      "New mode should return premium reel plan."
    );
    assert(
      newModeResult.beastPlan.canRenderAutomatically === false,
      "Beast plan must never auto-render."
    );
    assert(
      newModeResult.beastProductionPlan?.visualPlan,
      "Response should include full premium production plan."
    );

    const sampleVideoPath = join(projectRoot, "tmp", `one-click-remix-${runId()}.mp4`);
    await writeFile(sampleVideoPath, "one-click-remix-placeholder");

    const remixResult = await deps.runOneClickReelProduction(
      deps.createDependencies(),
      projectId,
      baseInput("prepare_only", {
        remixMode: "remix",
        inputVideoPath: sampleVideoPath,
        targetStyle: "hype_sports",
        newMusicPreset: "football_hype",
        addNarration: true,
        intensity: "extreme"
      })
    );

    assert(remixResult.beastPlan?.planType === "video_remix", "Remix mode should return video remix plan.");
    assert(remixResult.renderJobId === null, "Beast remix must not create render job.");

    const afterJobs = await deps.prisma.renderJob.count({ where: { videoProjectId: projectId } });
    assert(beforeJobs === afterJobs, "Beast modes must not create render jobs.");

    printSmokeSummary({
      smoke: "one-click-beast-plan",
      status: "completed",
      projectId,
      newPlanType: newModeResult.beastPlan.planType,
      remixPlanType: remixResult.beastPlan.planType,
      visualVariations: newModeResult.beastPlan.visualVariationCount,
      candidateFirst: true,
      renderJobsCreated: afterJobs - beforeJobs
    });
  } finally {
    await disconnect(deps);
  }
}

export async function runOneClickDryRunSmoke() {
  const deps = await loadDependencies();

  try {
    const { projectId } = await createProject(deps.prisma);
    const beforeJobs = await deps.prisma.renderJob.count({ where: { videoProjectId: projectId } });
    const beforeNarrations = await deps.prisma.narrationJob.count({ where: { videoProjectId: projectId } });
    const result = await deps.runOneClickReelProduction(
      deps.createDependencies(),
      projectId,
      baseInput("dry_run")
    );
    const afterJobs = await deps.prisma.renderJob.count({ where: { videoProjectId: projectId } });
    const afterNarrations = await deps.prisma.narrationJob.count({ where: { videoProjectId: projectId } });

    assert(result.status === "completed", "Dry run should complete.");
    assert(beforeJobs === afterJobs, "Dry run must not create render jobs.");
    assert(beforeNarrations === afterNarrations, "Dry run must not create narration jobs.");

    printSmokeSummary({
      smoke: "one-click-dry-run",
      status: "completed",
      projectId,
      runId: result.runId,
      renderJobsCreated: afterJobs - beforeJobs,
      narrationJobsCreated: afterNarrations - beforeNarrations,
      nextActions: result.nextActions
    });
  } finally {
    await disconnect(deps);
  }
}

export async function runOneClickPrepareAssetsSmoke() {
  const deps = await loadDependencies();

  try {
    const { projectId } = await createProject(deps.prisma);
    const result = await deps.runOneClickReelProduction(
      deps.createDependencies(),
      projectId,
      baseInput("prepare_only")
    );
    const project = await deps.prisma.videoProject.findUnique({
      where: { id: projectId },
      include: { scenes: true }
    });
    const renderJobs = await deps.prisma.renderJob.count({ where: { videoProjectId: projectId } });
    const narrationReady = project?.scenes.filter((scene) => scene.generatedNarrationAssetId).length ?? 0;
    const visualReady = project?.scenes.filter((scene) => scene.generatedAssetId || scene.assetId).length ?? 0;

    assert(result.status === "completed" || result.status === "partial", "Prepare must return a clear status.");
    assert(narrationReady > 0, "Prepare should generate narration.");
    assert(visualReady > 0, "Prepare should generate visuals.");
    assert(renderJobs === 0, "Prepare only must not create final RenderJob.");

    printSmokeSummary({
      smoke: "one-click-prepare-assets",
      status: "completed",
      projectId,
      runId: result.runId,
      narrationReady,
      visualReady,
      renderJobs,
      warnings: result.warnings
    });
  } finally {
    await disconnect(deps);
  }
}

export async function runOneClickCandidateGateSmoke() {
  const deps = await loadDependencies();

  try {
    const { projectId } = await createProject(deps.prisma);
    const collection = await deps.prisma.mediaCollection.create({
      data: {
        name: "One-click pending candidates",
        projectId,
        provider: "manual-url",
        query: "pending editorial visual",
        mediaType: "image",
        status: "ready_for_review",
        targetCount: 1
      }
    });
    const candidate = await deps.prisma.mediaCandidate.create({
      data: {
        collectionId: collection.id,
        provider: "manual-url",
        title: "Unconfirmed candidate",
        mediaType: "image",
        sourceUrl: "https://example.com/unconfirmed",
        sourceLicense: "unknown",
        tags: JSON.stringify(["candidate-first"]),
        usageNotes: JSON.stringify({ userConfirmedUse: false }),
        status: "pending"
      }
    });
    const result = await deps.runOneClickReelProduction(
      deps.createDependencies(),
      projectId,
      baseInput("prepare_only")
    );
    const updatedCandidate = await deps.prisma.mediaCandidate.findUnique({
      where: { id: candidate.id }
    });

    assert(updatedCandidate?.assetId === null, "Pending candidate must not become an asset.");
    assert(
      result.nextActions.includes("review_media_candidates") ||
        result.warnings.some((warning) => warning.includes("pendentes")),
      "Candidate gate warning/action should be present."
    );

    printSmokeSummary({
      smoke: "one-click-candidate-gate",
      status: "completed",
      projectId,
      candidateId: candidate.id,
      candidateStatus: updatedCandidate?.status,
      candidateAssetId: updatedCandidate?.assetId,
      pendingMediaCandidates: result.checklist.pendingMediaCandidates,
      unconfirmedCandidates: result.checklist.unconfirmedCandidates,
      nextActions: result.nextActions
    });
  } finally {
    await disconnect(deps);
  }
}

export async function runOneClickRenderRuntimeSmoke() {
  const deps = await loadDependencies();

  try {
    const { projectId } = await createProject(deps.prisma);
    const result = await deps.runOneClickReelProduction(
      deps.createDependencies(),
      projectId,
      baseInput("render", {
        runWorkerOnce: true,
        options: {
          ...baseInput("render").options,
          runWorkerOnce: true
        }
      })
    );
    const renderJob = result.renderJobId
      ? await deps.prisma.renderJob.findUnique({ where: { id: result.renderJobId } })
      : null;

    if (result.status !== "completed" || renderJob?.status !== "completed") {
      const message =
        result.warnings.join(" ") || renderJob?.errorMessage || "Worker/FFmpeg did not complete.";
      const skipped = isSpawnPermissionError(new Error(message)) || isWorkerSpawnBlocked(message);
      printSmokeSummary({
        smoke: "one-click-render-runtime",
        status: skipped ? "skipped" : "failed",
        projectId,
        runId: result.runId,
        renderJobId: result.renderJobId,
        runStatus: result.status,
        renderJobStatus: renderJob?.status ?? null,
        errorMessage: message,
        suggestion: "Execute fora do sandbox se FFmpeg/child_process estiver bloqueado."
      });
      if (!skipped) {
        process.exitCode = 1;
      }
      return;
    }

    assert(renderJob.outputPath, "Completed render job should have outputPath.");
    const metadata =
      typeof renderJob.metadata === "string"
        ? JSON.parse(renderJob.metadata)
        : renderJob.metadata ?? {};

    printSmokeSummary({
      smoke: "one-click-render-runtime",
      status: "completed",
      projectId,
      runId: result.runId,
      renderJobId: result.renderJobId,
      outputPath: renderJob.outputPath,
      narrationIncluded: Boolean(renderJob.hasAudio),
      audioQualityReport: Boolean(metadata.audioQualityReport),
      finalStatus: result.status
    });
  } finally {
    await disconnect(deps);
  }
}
