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
  resolveFirstExistingPath,
  safeCheckFfmpeg,
  writeMinimalPng
} from "./lib/smoke-utils.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");
const smokeChannelName = "Smoke Render Narration Channel";
const smokeProjectTitle = "Smoke Render With Narration";

function log(message) {
  console.log(`[smoke:render-with-narration] ${message}`);
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
  const apiBuildRoot = await resolveApiBuildRoot(
    projectRoot,
    "Run 'npm run build' before running smoke:render-with-narration."
  );
  const workerBuildRoot = await resolveFirstExistingPath(
    projectRoot,
    [
      "apps/worker/dist/apps/worker/src",
      "apps/worker/dist/src",
      "apps/worker/dist"
    ],
    "Run 'npm run build' before running smoke:render-with-narration."
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
    "Run 'npm run build' before running smoke:render-with-narration."
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
    where: { id: { in: previousGeneratedAssetIds } }
  });
}

async function ensureSmokeChannel(prismaClient) {
  return prismaClient.channel.upsert({
    where: { name: smokeChannelName },
    update: {
      niche: "render narration smoke",
      language: "pt-BR",
      visualStyle: "deterministic smoke boards",
      narrativeTone: "technical validation",
      defaultTemplate: "cinematic_story"
    },
    create: {
      name: smokeChannelName,
      niche: "render narration smoke",
      language: "pt-BR",
      visualStyle: "deterministic smoke boards",
      narrativeTone: "technical validation",
      defaultTemplate: "cinematic_story"
    }
  });
}

async function ensureSceneImageAsset(prismaClient, definition) {
  const relativePath = `storage/assets/smoke/render-with-narration/${definition.filename}`;
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
      tags: JSON.stringify(["smoke", "render-with-narration", definition.visualPreset]),
      licenseType: "local-generated",
      copyrightRisk: "LOW",
      recommendedUse: "Render with narration smoke image",
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
      tags: JSON.stringify(["smoke", "render-with-narration", definition.visualPreset]),
      licenseType: "local-generated",
      copyrightRisk: "LOW",
      recommendedUse: "Render with narration smoke image",
      duration: null,
      width: 1080,
      height: 1920,
      mimeType: "image/png",
      extension: ".png",
      fileSize: fileStats.size
    }
  });
}

async function prepareSmokeData(deps) {
  const sceneDefinitions = [
    {
      filename: "scene-1.png",
      title: "Narrated opener",
      narrationText:
        "Esta primeira cena valida a entrada de narracao mock no render final.",
      captionText: "Narracao presente no mix",
      duration: 3,
      emotion: "CURIOUS",
      visualPreset: "calm",
      transition: "fade"
    },
    {
      filename: "scene-2.png",
      title: "Narrated close",
      narrationText:
        "A segunda cena fecha o smoke e confirma que o blueprint usa narration effective asset.",
      captionText: "Blueprint com effective narration",
      duration: 3,
      emotion: "EPIC",
      visualPreset: "epic",
      transition: "hard-cut"
    }
  ];

  await cleanupPreviousSmokeData(deps.apiPrisma);
  const channel = await ensureSmokeChannel(deps.apiPrisma);

  const imageAssets = [];

  for (const definition of sceneDefinitions) {
    imageAssets.push(await ensureSceneImageAsset(deps.apiPrisma, definition));
  }

  const project = await deps.apiPrisma.videoProject.create({
    data: {
      title: smokeProjectTitle,
      status: "READY_TO_RENDER",
      channelId: channel.id,
      script: "Projeto de smoke para validar mix local de narracao no render.",
      durationTarget: 6,
      format: "9:16",
      templateId: "cinematic_story",
      defaultCaptionStyle: "premium_yellow",
      scenes: {
        create: sceneDefinitions.map((definition, index) => ({
          order: index + 1,
          title: definition.title,
          narrationText: definition.narrationText,
          captionText: definition.captionText,
          duration: definition.duration,
          emotion: definition.emotion,
          assetId: imageAssets[index]?.id ?? null,
          visualPreset: definition.visualPreset,
          visualSourceMode: "asset_only",
          transition: definition.transition
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
          voicePackId: "documentary_ptbr",
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
      renderQuality: "draft"
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
  try {
    await runCommand("ffprobe", ["-version"]);
  } catch {
    return null;
  }

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

  return {
    hasAudio: Boolean(audioStream),
    audioCodec:
      typeof audioStream?.codec_name === "string" ? audioStream.codec_name : null,
    videoCodec:
      typeof videoStream?.codec_name === "string" ? videoStream.codec_name : null
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

  if (!renderJob.hasAudio || !ffprobe?.hasAudio) {
    throw new Error("Render completed without an audio stream containing narration.");
  }

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
    blueprint.audio.sceneNarrations.length >= 1,
    "Blueprint audio plan did not include scene narrations."
  );

  return {
    renderJob,
    ffprobe,
    blueprint,
    absoluteOutputPath
  };
}

async function main() {
  log("Checking FFmpeg availability.");
  const ffmpegAvailability = await safeCheckFfmpeg(runCommand);

  if (!ffmpegAvailability.available) {
    printSmokeSummary({
      smoke: "render-with-narration",
      status: "skipped",
      reason: ffmpegAvailability.blockedByEnvironment
        ? buildEnvironmentBlockerMessage(
            "Smoke de render com narracao",
            "`npm run smoke:narration-render-plan`"
          )
        : ffmpegAvailability.errorMessage ?? "FFmpeg unavailable."
    });
    return;
  }

  const { apiBuildRoot, workerBuildRoot } = await ensureBuildArtifacts();
  const deps = await loadDependencies(apiBuildRoot, workerBuildRoot);

  try {
    const smokeSetup = await prepareSmokeData(deps);

    let workerResult;

    try {
      workerResult = await deps.runRenderWorkerOnce({
        logger: (message) => {
          log(`[worker] ${message}`);
        }
      });
    } catch (error) {
      if (isSpawnPermissionError(error)) {
        printSmokeSummary({
          smoke: "render-with-narration",
          status: "skipped",
          reason: buildEnvironmentBlockerMessage(
            "Smoke de render com narracao",
            "`npm run smoke:narration-render-plan`"
          )
        });
        return;
      }

      throw error;
    }

    if (workerResult.exitCode !== 0) {
      if (isSpawnPermissionError(workerResult.errorMessage ?? "")) {
        printSmokeSummary({
          smoke: "render-with-narration",
          status: "skipped",
          reason: buildEnvironmentBlockerMessage(
            "Smoke de render com narracao",
            "`npm run smoke:narration-render-plan`"
          )
        });
        return;
      }

      throw new Error(
        workerResult.errorMessage ??
          `Worker once exited with code ${workerResult.exitCode}.`
      );
    }

    const validation = await validateRenderResult(deps, smokeSetup);

    printSmokeSummary({
      smoke: "render-with-narration",
      projectId: smokeSetup.projectId,
      sceneIds: smokeSetup.sceneIds,
      jobId: smokeSetup.renderJobId,
      generatedNarrationAssetIds: smokeSetup.narrationResults.map(
        (result) => result.asset?.id ?? null
      ),
      outputPath: validation.renderJob.outputPath,
      absoluteOutputPath: validation.absoluteOutputPath,
      narrationIncluded:
        validation.blueprint.audio.sceneNarrations.length > 0 &&
        Boolean(validation.renderJob.hasAudio),
      audioCodec: validation.renderJob.audioCodec ?? validation.ffprobe?.audioCodec ?? null,
      status: "completed"
    });
  } finally {
    if (deps.workerPrisma !== deps.apiPrisma) {
      await deps.workerPrisma.$disconnect();
    }

    await deps.apiPrisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("[smoke:render-with-narration] failed", error);
  process.exitCode = 1;
});
