import { spawn } from "node:child_process";
import { access, stat } from "node:fs/promises";
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
  writeMinimalPng
} from "./lib/smoke-utils.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");
const smokeChannelName = "Smoke Render Microclips Channel";
const smokeProjectTitle = "Smoke Render With Microclips";
const smokeAssetsRoot = "storage/assets/smoke/render-with-microclips";

function log(message) {
  console.log(`[smoke:render-with-microclips] ${message}`);
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
    return formatCommand(
      error.command,
      Array.isArray(error.args) ? error.args : []
    );
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
    "Run 'npm run build' before running smoke:render-with-microclips."
  );
  const workerBuildRoot = await resolveFirstExistingPath(
    projectRoot,
    [
      "apps/worker/dist/apps/worker/src",
      "apps/worker/dist/src",
      "apps/worker/dist"
    ],
    "Run 'npm run build' before running smoke:render-with-microclips."
  );
  const apiArtifacts = [
    "infrastructure/database/prisma-client.js",
    "modules/assets/infrastructure/prisma-asset-repository.js",
    "modules/projects/infrastructure/prisma-project-repository.js",
    "modules/projects/application/project-render-blueprint-service.js",
    "modules/narration/infrastructure/prisma-narration-job-repository.js",
    "modules/narration/application/narration-service.js",
    "modules/editorial-microclips/infrastructure/prisma-editorial-microclip-repository.js",
    "modules/editorial-microclips/application/editorial-microclip-service.js",
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
    "Run 'npm run build' before running smoke:render-with-microclips."
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
    editorialMicroclipRepositoryModule,
    editorialMicroclipServiceModule,
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
        "modules/editorial-microclips/infrastructure/prisma-editorial-microclip-repository.js"
      )
    ),
    importModule(
      apiArtifactPath(
        apiBuildRoot,
        "modules/editorial-microclips/application/editorial-microclip-service.js"
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
    createPrismaEditorialMicroclipRepository:
      editorialMicroclipRepositoryModule.createPrismaEditorialMicroclipRepository,
    createEditorialMicroclip:
      editorialMicroclipServiceModule.createEditorialMicroclip,
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

  await prismaClient.editorialMicroclip.deleteMany({
    where: { projectId: { in: previousProjectIds } }
  });
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
        { path: { startsWith: `${smokeAssetsRoot}/` } }
      ]
    }
  });
}

async function ensureSmokeChannel(prismaClient) {
  return prismaClient.channel.upsert({
    where: { name: smokeChannelName },
    update: {
      niche: "render microclips smoke",
      language: "pt-BR",
      visualStyle: "editorial studio render validation board",
      narrativeTone: "technical validation",
      defaultTemplate: "cinematic_story"
    },
    create: {
      name: smokeChannelName,
      niche: "render microclips smoke",
      language: "pt-BR",
      visualStyle: "editorial studio render validation board",
      narrativeTone: "technical validation",
      defaultTemplate: "cinematic_story"
    }
  });
}

async function ensureSceneImageAsset(prismaClient, definition) {
  const relativePath = `${smokeAssetsRoot}/${definition.filename}`;
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
      tags: JSON.stringify(["smoke", "render-with-microclips", definition.visualPreset]),
      licenseType: "local-generated",
      copyrightRisk: "LOW",
      recommendedUse: "Render-with-microclips smoke base image",
      width: 1080,
      height: 1920,
      mimeType: "image/png",
      extension: ".png",
      fileSize: fileStats.size,
      sourceProvider: "manual-smoke"
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
      tags: JSON.stringify(["smoke", "render-with-microclips", definition.visualPreset]),
      licenseType: "local-generated",
      copyrightRisk: "LOW",
      recommendedUse: "Render-with-microclips smoke base image",
      width: 1080,
      height: 1920,
      mimeType: "image/png",
      extension: ".png",
      fileSize: fileStats.size,
      sourceProvider: "manual-smoke"
    }
  });
}

async function createSyntheticMicroclipVideo(ffmpegCommand, outputPath) {
  await runCommand(ffmpegCommand, [
    "-y",
    "-f",
    "lavfi",
    "-i",
    "testsrc=size=720x1280:rate=30",
    "-t",
    "2.4",
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    outputPath
  ]);
}

async function ensureMicroclipAsset(prismaClient, ffmpegCheck) {
  const relativePath = `${smokeAssetsRoot}/impact-insert.mp4`;
  const absolutePath = join(projectRoot, relativePath);
  await createSyntheticMicroclipVideo(ffmpegCheck.command, absolutePath);
  const fileStats = await stat(absolutePath);

  return prismaClient.asset.upsert({
    where: { path: relativePath },
    update: {
      filename: "impact-insert.mp4",
      originalName: "impact-insert.mp4",
      type: "VIDEO",
      category: "BROLL",
      franchise: "Smoke Test",
      character: null,
      emotion: "EPIC",
      tags: JSON.stringify(["smoke", "render", "microclip", "insert"]),
      licenseType: "local-generated",
      copyrightRisk: "LOW",
      recommendedUse: "Render smoke editorial insert",
      duration: 2.4,
      width: 720,
      height: 1280,
      mimeType: "video/mp4",
      extension: ".mp4",
      fileSize: fileStats.size,
      sourceProvider: "ffmpeg-smoke"
    },
    create: {
      filename: "impact-insert.mp4",
      originalName: "impact-insert.mp4",
      path: relativePath,
      type: "VIDEO",
      category: "BROLL",
      franchise: "Smoke Test",
      character: null,
      emotion: "EPIC",
      tags: JSON.stringify(["smoke", "render", "microclip", "insert"]),
      licenseType: "local-generated",
      copyrightRisk: "LOW",
      recommendedUse: "Render smoke editorial insert",
      duration: 2.4,
      width: 720,
      height: 1280,
      mimeType: "video/mp4",
      extension: ".mp4",
      fileSize: fileStats.size,
      sourceProvider: "ffmpeg-smoke"
    }
  });
}

async function seedSmokeProject(prismaClient, channelId, imageAssets) {
  const project = await prismaClient.videoProject.create({
    data: {
      title: smokeProjectTitle,
      status: "SCENE_PLANNING",
      channelId,
      script:
        "Projeto curto para validar render com narracao, visual base e insert editorial em microclip.",
      durationTarget: 6,
      format: "9:16",
      templateId: "cinematic_story",
      defaultCaptionStyle: "premium_yellow",
      scenes: {
        create: [
          {
            order: 1,
            title: "Editorial opener",
            narrationText:
              "A primeira cena valida um insert editorial por cima do visual base sem perder a narracao.",
            captionText: "microclip entra sem quebrar a narracao",
            duration: 3,
            emotion: "EPIC",
            assetId: imageAssets[0].id,
            visualPreset: "action",
            visualSourceMode: "asset_only",
            transition: "flash"
          },
          {
            order: 2,
            title: "Editorial close",
            narrationText:
              "A segunda cena fecha o smoke e confirma que o render final preserva o audio premium.",
            captionText: "render fecha com audio premium",
            duration: 3,
            emotion: "CURIOUS",
            assetId: imageAssets[1].id,
            visualPreset: "calm",
            visualSourceMode: "asset_only",
            transition: "cut"
          }
        ]
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

  return {
    projectId: project.id,
    sceneIds: project.scenes.map((scene) => scene.id)
  };
}

async function assertFileExists(projectRelativePath) {
  const absolutePath = join(projectRoot, projectRelativePath);
  await access(absolutePath);
  return absolutePath;
}

async function main() {
  const { apiBuildRoot, workerBuildRoot } = await ensureBuildArtifacts();
  const deps = await loadDependencies(apiBuildRoot, workerBuildRoot);

  try {
    const ffmpeg = await safeCheckFfmpeg(runCommand);
    const ffprobe = await safeCheckFfprobe(runCommand);

    if (!ffmpeg.available || !ffprobe.available) {
      printSmokeSummary({
        smoke: "render-with-microclips",
        status: "skipped",
        reason: ffmpeg.errorMessage ?? ffprobe.errorMessage,
        ffmpeg,
        ffprobe
      });
      return;
    }

    await cleanupPreviousSmokeData(deps.apiPrisma);
    const channel = await ensureSmokeChannel(deps.apiPrisma);
    const imageAssets = await Promise.all([
      ensureSceneImageAsset(deps.apiPrisma, {
        filename: "scene-1.png",
        emotion: "EPIC",
        visualPreset: "action"
      }),
      ensureSceneImageAsset(deps.apiPrisma, {
        filename: "scene-2.png",
        emotion: "CURIOUS",
        visualPreset: "calm"
      })
    ]);
    const microclipAsset = await ensureMicroclipAsset(deps.apiPrisma, ffmpeg);
    const fixtures = await seedSmokeProject(
      deps.apiPrisma,
      channel.id,
      imageAssets
    );

    assert(
      fixtures.sceneIds.length === 2,
      "Smoke render project did not create the expected scenes."
    );

    const assetRepository = deps.createPrismaAssetRepository();
    const projectRepository = deps.createPrismaProjectRepository();
    const narrationJobRepository = deps.createPrismaNarrationJobRepository();
    const editorialMicroclipRepository =
      deps.createPrismaEditorialMicroclipRepository();
    const renderStorage = deps.createLocalRenderStorage();
    const renderJobRepository = deps.createPrismaRenderJobRepository();

    log("Generating narrations for render scenes.");
    for (const sceneId of fixtures.sceneIds) {
      const narrationResult = await deps.generateNarrationForScene(
        projectRepository,
        assetRepository,
        narrationJobRepository,
        sceneId,
        {
          provider: "mock-tts",
          voicePackId: "documentary_ptbr",
          text: null,
          language: "pt-BR",
          autoAttach: true
        }
      );

      assert(
        narrationResult.job.status === "completed",
        `Narration job ${narrationResult.job.id} did not complete.`
      );
    }

    log("Creating the editorial insert.");
    const microclip = await deps.createEditorialMicroclip(
      editorialMicroclipRepository,
      projectRepository,
      assetRepository,
      {
        projectId: fixtures.projectId,
        sceneId: fixtures.sceneIds[0] ?? null,
        assetId: microclipAsset.id,
        label: "impact moment",
        sourceType: "library_clip",
        startTimeSeconds: 0.3,
        endTimeSeconds: 1.45,
        durationSeconds: 0,
        usageMode: "impact_moment",
        narrationOverlay: true,
        textOverlay: "impact moment",
        calloutStyle: "bold",
        transitionIn: "flash",
        transitionOut: "cut",
        volumeMode: "mute_original",
        orderIndex: 1,
        metadata: null
      }
    );

    const blueprint = await deps.getVideoProjectRenderBlueprint(
      projectRepository,
      assetRepository,
      editorialMicroclipRepository,
      fixtures.projectId
    );
    assert(blueprint.hasEditorialMicroclips, "Blueprint did not flag editorial microclips.");
    assert(blueprint.microclipCount === 1, "Blueprint microclipCount should be 1.");

    log("Queueing render job with editorial microclip support.");
    const renderJob = await deps.createRenderJobForProject(
      renderJobRepository,
      projectRepository,
      assetRepository,
      editorialMicroclipRepository,
      renderStorage,
      fixtures.projectId,
      {
        renderMode: "cinematic_v2",
        renderQuality: "draft",
        audioMasteringPresetId: "shorts_clean_voice"
      }
    );

    const workerResult = await deps.runRenderWorkerOnce({
      onLog(message) {
        log(message);
      }
    });

    if (
      workerResult.finalStatus === "failed" &&
      isSpawnPermissionError(new Error(workerResult.errorMessage ?? "spawn EPERM"))
    ) {
      printSmokeSummary({
        smoke: "render-with-microclips",
        status: "skipped",
        reason: buildEnvironmentBlockerMessage(
          "Render com microclips",
          "npm run smoke:render-with-microclips"
        ),
        attemptedCommand: extractAttemptedCommand(
          new Error(workerResult.errorMessage ?? "spawn EPERM"),
          `${resolveBinaryCommand("ffmpeg").command} ...`
        )
      });
      return;
    }

    assert(
      workerResult.finalStatus === "completed",
      `Render worker did not complete. ${workerResult.errorMessage ?? "Unknown error."}`
    );

    const persistedRenderJob = await deps.apiPrisma.renderJob.findUnique({
      where: { id: renderJob.id }
    });

    assert(persistedRenderJob, "Persisted render job was not found.");
    assert(
      persistedRenderJob.status === "completed",
      "Persisted render job did not complete."
    );
    assert(persistedRenderJob.outputPath, "Render job outputPath is missing.");
    const absoluteOutputPath = await assertFileExists(persistedRenderJob.outputPath);

    const metadata = parseRenderMetadata(persistedRenderJob.metadata);
    assert(
      metadata.hasEditorialMicroclips === true,
      "Render job metadata did not persist hasEditorialMicroclips=true."
    );
    assert(
      metadata.microclipCount >= 1,
      "Render job metadata did not persist microclipCount."
    );

    printSmokeSummary({
      smoke: "render-with-microclips",
      projectId: fixtures.projectId,
      sceneIds: fixtures.sceneIds,
      microclipIds: [microclip.id],
      renderJobId: renderJob.id,
      outputPath: persistedRenderJob.outputPath,
      absoluteOutputPath,
      microclipCount: metadata.microclipCount ?? 0,
      finalStatus: persistedRenderJob.status,
      status: "completed"
    });
  } catch (error) {
    if (isSpawnPermissionError(error)) {
      printSmokeSummary({
        smoke: "render-with-microclips",
        status: "skipped",
        reason: buildEnvironmentBlockerMessage(
          "Render com microclips",
          "npm run smoke:render-with-microclips"
        ),
        attemptedCommand: extractAttemptedCommand(
          error,
          `${resolveBinaryCommand("ffmpeg").command} ...`
        ),
        rawError: error instanceof Error ? error.message : String(error)
      });
      return;
    }

    throw error;
  } finally {
    await deps.apiPrisma.$disconnect();
    await deps.workerPrisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("[smoke:render-with-microclips] failed", error);
  process.exitCode = 1;
});
