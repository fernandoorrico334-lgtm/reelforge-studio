import { stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  buildEnvironmentBlockerMessage,
  ensureArtifactsExist,
  isSpawnPermissionError,
  printSmokeSummary,
  safeCheckFfmpeg
} from "./lib/smoke-utils.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");
const smokeChannelName = "Smoke Hybrid Render Channel";
const smokeCharacterSlug = "smoke-render-host";
const smokeProjectTitle = "Smoke Hybrid Visual Render";

function log(message) {
  console.log(`[smoke:hybrid-visual:render] ${message}`);
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
      "apps/api/dist/modules/assets/infrastructure/prisma-asset-repository.js",
      "apps/api/dist/modules/characters/infrastructure/prisma-character-repository.js",
      "apps/api/dist/modules/projects/infrastructure/prisma-project-repository.js",
      "apps/api/dist/modules/hybrid-visual/infrastructure/prisma-visual-generation-job-repository.js",
      "apps/api/dist/modules/hybrid-visual/application/hybrid-visual-service.js",
      "apps/api/dist/modules/render-jobs/infrastructure/local-render-storage.js",
      "apps/api/dist/modules/render-jobs/infrastructure/prisma-render-job-repository.js",
      "apps/api/dist/modules/render-jobs/application/render-job-service.js",
      "apps/worker/dist/infrastructure/prisma-client.js",
      "apps/worker/dist/services/render-worker.js"
    ],
    "Run 'npm run build' before running smoke:hybrid-visual:render."
  );
}

async function loadSmokeDependencies() {
  const [
    apiPrismaModule,
    assetRepositoryModule,
    characterRepositoryModule,
    projectRepositoryModule,
    visualJobRepositoryModule,
    hybridVisualServiceModule,
    renderStorageModule,
    renderRepositoryModule,
    renderServiceModule,
    workerPrismaModule,
    workerServiceModule
  ] = await Promise.all([
    importModule("apps/api/dist/infrastructure/database/prisma-client.js"),
    importModule(
      "apps/api/dist/modules/assets/infrastructure/prisma-asset-repository.js"
    ),
    importModule(
      "apps/api/dist/modules/characters/infrastructure/prisma-character-repository.js"
    ),
    importModule(
      "apps/api/dist/modules/projects/infrastructure/prisma-project-repository.js"
    ),
    importModule(
      "apps/api/dist/modules/hybrid-visual/infrastructure/prisma-visual-generation-job-repository.js"
    ),
    importModule(
      "apps/api/dist/modules/hybrid-visual/application/hybrid-visual-service.js"
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
    importModule("apps/worker/dist/infrastructure/prisma-client.js"),
    importModule("apps/worker/dist/services/render-worker.js")
  ]);

  return {
    apiPrisma: apiPrismaModule.prisma,
    createPrismaAssetRepository: assetRepositoryModule.createPrismaAssetRepository,
    createPrismaCharacterRepository:
      characterRepositoryModule.createPrismaCharacterRepository,
    createPrismaProjectRepository:
      projectRepositoryModule.createPrismaProjectRepository,
    createPrismaVisualGenerationJobRepository:
      visualJobRepositoryModule.createPrismaVisualGenerationJobRepository,
    generateMissingVisualsForProject:
      hybridVisualServiceModule.generateMissingVisualsForProject,
    createLocalRenderStorage: renderStorageModule.createLocalRenderStorage,
    createPrismaRenderJobRepository:
      renderRepositoryModule.createPrismaRenderJobRepository,
    createRenderJobForProject: renderServiceModule.createRenderJobForProject,
    workerPrisma: workerPrismaModule.prisma,
    runRenderWorkerOnce: workerServiceModule.runRenderWorkerOnce
  };
}

async function cleanupPreviousSmokeData(prismaClient) {
  const previousProjects = await prismaClient.videoProject.findMany({
    where: { title: smokeProjectTitle },
    select: { id: true }
  });
  const projectIds = previousProjects.map((item) => item.id);
  const sceneIds = (
    await prismaClient.scene.findMany({
      where: { videoProjectId: { in: projectIds } },
      select: { id: true }
    })
  ).map((item) => item.id);
  const generatedAssetIds = (
    await prismaClient.visualGenerationJob.findMany({
      where: {
        OR: [
          { videoProjectId: { in: projectIds } },
          { sceneId: { in: sceneIds } }
        ]
      },
      select: { generatedAssetId: true }
    })
  )
    .map((item) => item.generatedAssetId)
    .filter((value) => typeof value === "string");

  await prismaClient.renderJob.deleteMany({
    where: { videoProjectId: { in: projectIds } }
  });
  await prismaClient.visualGenerationJob.deleteMany({
    where: {
      OR: [
        { videoProjectId: { in: projectIds } },
        { sceneId: { in: sceneIds } }
      ]
    }
  });
  await prismaClient.scene.deleteMany({
    where: { videoProjectId: { in: projectIds } }
  });
  await prismaClient.videoProject.deleteMany({
    where: { id: { in: projectIds } }
  });
  await prismaClient.characterReference.deleteMany({
    where: {
      characterProfile: {
        slug: smokeCharacterSlug
      }
    }
  });
  await prismaClient.characterProfile.deleteMany({
    where: { slug: smokeCharacterSlug }
  });
  await prismaClient.asset.deleteMany({
    where: { id: { in: generatedAssetIds } }
  });
}

async function prepareSmokeData(deps) {
  await cleanupPreviousSmokeData(deps.apiPrisma);

  const channel = await deps.apiPrisma.channel.upsert({
    where: {
      name: smokeChannelName
    },
    update: {
      niche: "Hybrid render validation",
      language: "pt-BR",
      visualStyle: "Noir generated posters and suspense lighting",
      narrativeTone: "Investigativo",
      defaultTemplate: "mystery_doc"
    },
    create: {
      name: smokeChannelName,
      niche: "Hybrid render validation",
      language: "pt-BR",
      visualStyle: "Noir generated posters and suspense lighting",
      narrativeTone: "Investigativo",
      defaultTemplate: "mystery_doc"
    }
  });

  const characterProfile = await deps.apiPrisma.characterProfile.create({
    data: {
      name: "Smoke Render Host",
      slug: smokeCharacterSlug,
      franchise: "Smoke Files",
      category: "host",
      description: "Recurring narrator for hybrid render validation.",
      basePrompt: "noir host, cinematic poster, vertical 9:16 composition",
      negativePrompt: "watermark, logo, low detail, duplicated limbs",
      styleNotes: "High contrast, teal accents, suspense framing.",
      defaultVisualStyle: "mystery",
      referenceStrength: 0.84,
      preferredProvider: "mock-svg",
      tags: JSON.stringify(["smoke", "render", "host"])
    }
  });

  const projectRepository = deps.createPrismaProjectRepository({
    prismaClient: deps.apiPrisma
  });
  const project = await projectRepository.create({
    title: smokeProjectTitle,
    status: "READY_FOR_EDIT",
    channelId: channel.id,
    script: "Generated visuals should render in cinematic_v2 end to end.",
    durationTarget: 10,
    format: "9:16",
    templateId: "mystery_doc",
    defaultCaptionStyle: "documentary_clean"
  });

  await projectRepository.createScene(project.id, {
    title: "Generated opener",
    narrationText: "The first scene depends entirely on the generated PNG visual.",
    captionText: "Generated opener",
    duration: 5,
    emotion: "MYSTERIOUS",
    characterProfileId: characterProfile.id,
    visualPreset: "mystery",
    visualSourceMode: "generated_only",
    transition: "fade"
  });

  await projectRepository.createScene(project.id, {
    title: "Generated escalation",
    narrationText: "The second scene proves the cinematic render can reuse generated assets.",
    captionText: "Generated escalation",
    duration: 5,
    emotion: "TENSE",
    characterProfileId: characterProfile.id,
    visualPreset: "suspense",
    visualSourceMode: "mixed_sequence",
    transition: "hard-cut"
  });

  const assetRepository = deps.createPrismaAssetRepository({
    prismaClient: deps.apiPrisma
  });
  const characterRepository = deps.createPrismaCharacterRepository({
    prismaClient: deps.apiPrisma
  });
  const visualJobRepository = deps.createPrismaVisualGenerationJobRepository({
    prismaClient: deps.apiPrisma
  });

  await deps.generateMissingVisualsForProject(
    projectRepository,
    assetRepository,
    characterRepository,
    visualJobRepository,
    project.id,
    {
      provider: "mock-svg",
      visualSourceMode: null,
      characterProfileId: characterProfile.id,
      width: 1080,
      height: 1920,
      seed: 707,
      autoAttach: true,
      maxScenes: 4
    }
  );

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
      renderMode: "cinematic_v2",
      renderQuality: "draft"
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
  const duration = Number(parsed.format?.duration ?? videoStream?.duration ?? 0);

  return {
    width: Number(videoStream?.width ?? 0),
    height: Number(videoStream?.height ?? 0),
    durationSeconds: Number.isFinite(duration) ? duration : 0,
    codecName:
      typeof videoStream?.codec_name === "string" ? videoStream.codec_name : null
  };
}

async function validateRenderResult(apiPrisma, renderJobId) {
  const renderJob = await apiPrisma.renderJob.findUnique({
    where: { id: renderJobId }
  });

  if (!renderJob) {
    throw new Error(`Render job '${renderJobId}' was not found after worker execution.`);
  }

  if (renderJob.status !== "completed" || !renderJob.outputPath || !renderJob.thumbnailPath) {
    throw new Error(`Render job '${renderJobId}' did not complete successfully.`);
  }

  const absoluteOutputPath = join(projectRoot, renderJob.outputPath);
  const absoluteThumbnailPath = join(projectRoot, renderJob.thumbnailPath);
  const outputStats = await stat(absoluteOutputPath);
  const thumbnailStats = await stat(absoluteThumbnailPath);
  const ffprobe = await inspectWithFfprobe(absoluteOutputPath);

  if (outputStats.size <= 0 || thumbnailStats.size <= 0) {
    throw new Error("Hybrid visual render generated empty output artifacts.");
  }

  if (ffprobe.width !== 1080 || ffprobe.height !== 1920) {
    throw new Error(`Unexpected render resolution ${ffprobe.width}x${ffprobe.height}.`);
  }

  return {
    outputPath: renderJob.outputPath,
    thumbnailPath: renderJob.thumbnailPath,
    durationSeconds: ffprobe.durationSeconds,
    resolution: `${ffprobe.width}x${ffprobe.height}`,
    codec: ffprobe.codecName ?? renderJob.outputCodec ?? null,
    status: renderJob.status
  };
}

async function main() {
  const ffmpegAvailability = await safeCheckFfmpeg(runCommand);

  if (!ffmpegAvailability.available) {
    if (ffmpegAvailability.blockedByEnvironment) {
      throw new Error(
        buildEnvironmentBlockerMessage(
          "Smoke de hybrid visual render",
          "`npm run smoke:hybrid-visual:render-ready`"
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
    log("Preparing project with generated visuals only.");
    const setup = await prepareSmokeData(deps);

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
            "Smoke de hybrid visual render",
            "`npm run smoke:hybrid-visual:render-ready`"
          )
        );
      }

      throw error;
    }

    if (workerResult.exitCode !== 0) {
      if (isSpawnPermissionError(workerResult.errorMessage ?? "")) {
        throw new Error(
          buildEnvironmentBlockerMessage(
            "Smoke de hybrid visual render",
            "`npm run smoke:hybrid-visual:render-ready`"
          )
        );
      }

      throw new Error(
        workerResult.errorMessage ??
          `Worker once exited with code ${workerResult.exitCode}.`
      );
    }

    const result = await validateRenderResult(deps.apiPrisma, setup.renderJobId);

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