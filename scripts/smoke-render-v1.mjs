import { spawn } from "node:child_process";
import { stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  buildEnvironmentBlockerMessage,
  ensureArtifactsExist,
  isSpawnPermissionError,
  printSmokeSummary,
  safeCheckFfmpeg,
  writeMinimalPng
} from "./lib/smoke-utils.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");
const smokeAssetsRoot = join(projectRoot, "storage", "assets", "smoke", "image");
const requestedRenderMode =
  process.argv[2] === "cinematic_v2" ? "cinematic_v2" : "v1";
const requestedRenderQuality =
  process.argv[3] === "draft" ||
  process.argv[3] === "standard" ||
  process.argv[3] === "high"
    ? process.argv[3]
    : "standard";

const smokeScenarios = {
  v1: {
    logPrefix: "smoke:render",
    projectTitle: "Smoke Render V1",
    script: "Render smoke test project with three deterministic scenes.",
    expectedDurationRange: [8, 15],
    assets: [
      {
        filename: "smoke_scene_1.png",
        color: "#171f3a",
        captionText: "Smoke test scene one online",
        narrationText: "Smoke test scene one validates image rendering.",
        emotion: "CURIOUS",
        visualPreset: "calm",
        transition: "fade",
        duration: 3
      },
      {
        filename: "smoke_scene_2.png",
        color: "#4c0f2f",
        captionText: "Scene two keeps the timeline moving",
        narrationText: "Smoke test scene two validates subtitle timing.",
        emotion: "EPIC",
        visualPreset: "drama",
        transition: "hard-cut",
        duration: 4
      },
      {
        filename: "smoke_scene_3.png",
        color: "#173d2f",
        captionText: "Scene three closes the smoke cycle",
        narrationText: "Smoke test scene three validates export completion.",
        emotion: "JOYFUL",
        visualPreset: "action",
        transition: "flash-cut",
        duration: 3
      }
    ]
  },
  cinematic_v2: {
    logPrefix: "smoke:render:cinematic",
    projectTitle: "Smoke Render Cinematic V2",
    script:
      "Render smoke test for cinematic_v2 with suspense, action, drama and epic presets.",
    expectedDurationRange: [10, 20],
    assets: [
      {
        filename: "smoke_cinematic_scene_1.png",
        color: "#111a2b",
        captionText: "Suspense opener starts the arc",
        narrationText: "The first scene validates darker cinematic motion.",
        emotion: "MYSTERIOUS",
        visualPreset: "suspense",
        transition: "fade",
        duration: 3
      },
      {
        filename: "smoke_cinematic_scene_2.png",
        color: "#5a1c0f",
        captionText: "Action beat raises the pressure",
        narrationText: "The second scene validates high-energy framing.",
        emotion: "TENSE",
        visualPreset: "action",
        transition: "fast_fade",
        duration: 3
      },
      {
        filename: "smoke_cinematic_scene_3.png",
        color: "#2b1533",
        captionText: "Drama gives the story breathing room",
        narrationText: "The third scene validates softer dramatic motion.",
        emotion: "SAD",
        visualPreset: "drama",
        transition: "fade",
        duration: 4
      },
      {
        filename: "smoke_cinematic_scene_4.png",
        color: "#25304f",
        captionText: "Epic finale closes the smoke journey",
        narrationText: "The fourth scene validates the premium heroic finish.",
        emotion: "EPIC",
        visualPreset: "epic",
        transition: "cut",
        duration: 4
      }
    ]
  }
};

const smokeScenario = smokeScenarios[requestedRenderMode];

function log(message) {
  console.log(`[${smokeScenario.logPrefix}] ${message}`);
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
      "apps/api/dist/modules/assets/infrastructure/prisma-asset-repository.js",
      "apps/api/dist/modules/render-jobs/infrastructure/local-render-storage.js",
      "apps/api/dist/modules/render-jobs/infrastructure/prisma-render-job-repository.js",
      "apps/api/dist/modules/render-jobs/application/render-job-service.js",
      "apps/worker/dist/infrastructure/prisma-client.js",
      "apps/worker/dist/services/render-worker.js"
    ],
    "Run 'npm run build' before running smoke:render."
  );
}

async function ensureSmokeAssets() {
  const fsModule = await import("node:fs/promises");
  await fsModule.mkdir(smokeAssetsRoot, { recursive: true });

  const assets = [];

  for (const smokeFile of smokeScenario.assets) {
    const relativePath = `storage/assets/smoke/image/${smokeFile.filename}`;
    const absolutePath = await writeMinimalPng(join(projectRoot, relativePath));
    const fileStats = await stat(absolutePath);

    assets.push({
      ...smokeFile,
      relativePath,
      absolutePath,
      fileSize: fileStats.size
    });
  }

  return assets;
}

async function prepareSmokeData(deps) {
  const smokeAssets = await ensureSmokeAssets();

  await deps.apiPrisma.videoProject.deleteMany({
    where: {
      title: smokeScenario.projectTitle
    }
  });

  const channel = await deps.apiPrisma.channel.upsert({
    where: {
      name: "Smoke Test Channel"
    },
    update: {
      niche: "Local render validation",
      language: "pt-BR",
      visualStyle: "Solid colors and deterministic captions for smoke validation",
      narrativeTone: "Technical verification",
      defaultTemplate: "cinematic_story"
    },
    create: {
      name: "Smoke Test Channel",
      niche: "Local render validation",
      language: "pt-BR",
      visualStyle: "Solid colors and deterministic captions for smoke validation",
      narrativeTone: "Technical verification",
      defaultTemplate: "cinematic_story"
    }
  });

  const persistedAssets = [];

  for (const smokeAsset of smokeAssets) {
    persistedAssets.push(
      await deps.apiPrisma.asset.upsert({
        where: {
          path: smokeAsset.relativePath
        },
        update: {
          filename: smokeAsset.filename,
          originalName: smokeAsset.filename,
          type: "IMAGE",
          category: "REFERENCE",
          franchise: "Smoke Test",
          character: null,
          emotion: smokeAsset.emotion,
          tags: JSON.stringify([
            "smoke",
            requestedRenderMode,
            smokeAsset.visualPreset
          ]),
          licenseType: "local-generated",
          copyrightRisk: "LOW",
          recommendedUse: "Render smoke test",
          duration: null,
          width: 1080,
          height: 1920,
          mimeType: "image/png",
          extension: ".png",
          fileSize: smokeAsset.fileSize
        },
        create: {
          filename: smokeAsset.filename,
          originalName: smokeAsset.filename,
          path: smokeAsset.relativePath,
          type: "IMAGE",
          category: "REFERENCE",
          franchise: "Smoke Test",
          character: null,
          emotion: smokeAsset.emotion,
          tags: JSON.stringify([
            "smoke",
            requestedRenderMode,
            smokeAsset.visualPreset
          ]),
          licenseType: "local-generated",
          copyrightRisk: "LOW",
          recommendedUse: "Render smoke test",
          duration: null,
          width: 1080,
          height: 1920,
          mimeType: "image/png",
          extension: ".png",
          fileSize: smokeAsset.fileSize
        }
      })
    );
  }

  const projectRepository = deps.createPrismaProjectRepository({
    prismaClient: deps.apiPrisma
  });
  const durationTarget = smokeScenario.assets.reduce(
    (total, asset) => total + asset.duration,
    0
  );
  const project = await projectRepository.create({
    title: smokeScenario.projectTitle,
    status: "READY_FOR_EDIT",
    channelId: channel.id,
    script: smokeScenario.script,
    durationTarget,
    format: "9:16",
    templateId: "cinematic_story",
    defaultCaptionStyle: "premium_yellow"
  });

  for (const [index, persistedAsset] of persistedAssets.entries()) {
    const smokeAsset = smokeAssets[index];

    await projectRepository.createScene(project.id, {
      title: `Smoke Scene ${index + 1}`,
      narrationText: smokeAsset.narrationText,
      captionText: smokeAsset.captionText,
      duration: smokeAsset.duration,
      emotion: smokeAsset.emotion,
      assetId: persistedAsset.id,
      visualPreset: smokeAsset.visualPreset,
      transition: smokeAsset.transition,
      captionStyle: "premium_yellow",
      captionPosition: "lower-third",
      captionEmphasisWords: ["smoke", `scene-${index + 1}`],
      energyLevel: 35 + index * 18
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
      renderMode: requestedRenderMode,
      renderQuality: requestedRenderQuality
    }
  );

  return {
    channelId: channel.id,
    projectId: project.id,
    renderJobId: renderJob.id
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
  const duration = Number(parsed.format?.duration ?? videoStream?.duration ?? 0);

  return {
    width: Number(videoStream?.width ?? 0),
    height: Number(videoStream?.height ?? 0),
    durationSeconds: Number.isFinite(duration) ? duration : 0,
    codecName:
      typeof videoStream?.codec_name === "string" ? videoStream.codec_name : null
  };
}

async function validateRenderResult(apiPrisma, projectId, renderJobId) {
  const renderJob = await apiPrisma.renderJob.findUnique({
    where: {
      id: renderJobId
    }
  });

  if (!renderJob) {
    throw new Error(`Smoke render job '${renderJobId}' was not found after worker execution.`);
  }

  if (renderJob.status !== "completed") {
    throw new Error(
      `Smoke render job '${renderJobId}' finished with status '${renderJob.status}' instead of 'completed'.`
    );
  }

  if (renderJob.renderMode !== requestedRenderMode) {
    throw new Error(
      `Smoke render job '${renderJobId}' persisted renderMode '${renderJob.renderMode}' instead of '${requestedRenderMode}'.`
    );
  }

  if (renderJob.renderQuality !== requestedRenderQuality) {
    throw new Error(
      `Smoke render job '${renderJobId}' persisted renderQuality '${renderJob.renderQuality}' instead of '${requestedRenderQuality}'.`
    );
  }

  if (!renderJob.outputPath) {
    throw new Error(`Smoke render job '${renderJobId}' has no outputPath.`);
  }

  if (!renderJob.thumbnailPath) {
    throw new Error(`Smoke render job '${renderJobId}' has no thumbnailPath.`);
  }

  const absoluteOutputPath = join(projectRoot, renderJob.outputPath);
  const absoluteThumbnailPath = join(projectRoot, renderJob.thumbnailPath);
  const outputStats = await stat(absoluteOutputPath);
  const thumbnailStats = await stat(absoluteThumbnailPath);

  if (outputStats.size <= 0) {
    throw new Error(`Smoke render output '${absoluteOutputPath}' has invalid size ${outputStats.size}.`);
  }

  if (thumbnailStats.size <= 0) {
    throw new Error(
      `Smoke render thumbnail '${absoluteThumbnailPath}' has invalid size ${thumbnailStats.size}.`
    );
  }

  const ffprobe = await inspectWithFfprobe(absoluteOutputPath);

  if (renderJob.outputWidth !== 1080 || renderJob.outputHeight !== 1920) {
    throw new Error(
      `Smoke render job metadata has invalid resolution ${renderJob.outputWidth}x${renderJob.outputHeight}.`
    );
  }

  if (
    typeof renderJob.outputDuration !== "number" ||
    Number.isNaN(renderJob.outputDuration) ||
    renderJob.outputDuration <= 0
  ) {
    throw new Error(
      `Smoke render job '${renderJobId}' has invalid outputDuration '${renderJob.outputDuration}'.`
    );
  }

  if (
    typeof renderJob.outputFileSize !== "number" ||
    Number.isNaN(renderJob.outputFileSize) ||
    renderJob.outputFileSize <= 0
  ) {
    throw new Error(
      `Smoke render job '${renderJobId}' has invalid outputFileSize '${renderJob.outputFileSize}'.`
    );
  }

  if (
    typeof renderJob.outputCodec !== "string" ||
    renderJob.outputCodec.trim().length === 0
  ) {
    throw new Error(`Smoke render job '${renderJobId}' has no outputCodec.`);
  }

  if (ffprobe) {
    if (ffprobe.width !== 1080 || ffprobe.height !== 1920) {
      throw new Error(
        `Smoke render output has invalid resolution ${ffprobe.width}x${ffprobe.height}.`
      );
    }

    if (
      ffprobe.durationSeconds < smokeScenario.expectedDurationRange[0] ||
      ffprobe.durationSeconds > smokeScenario.expectedDurationRange[1]
    ) {
      throw new Error(
        `Smoke render output has invalid duration ${ffprobe.durationSeconds.toFixed(2)}s.`
      );
    }

    if (ffprobe.codecName && !["h264", "avc1"].includes(ffprobe.codecName)) {
      throw new Error(
        `Smoke render output codec '${ffprobe.codecName}' is not H.264 compatible.`
      );
    }

    if (
      renderJob.outputCodec &&
      ffprobe.codecName &&
      renderJob.outputCodec !== ffprobe.codecName
    ) {
      throw new Error(
        `Smoke render job codec '${renderJob.outputCodec}' diverges from ffprobe '${ffprobe.codecName}'.`
      );
    }
  }

  return {
    projectId,
    renderJobId,
    outputPath: renderJob.outputPath,
    thumbnailPath: renderJob.thumbnailPath,
    outputBytes: outputStats.size,
    metadata: {
      renderMode: renderJob.renderMode,
      renderQuality: renderJob.renderQuality,
      outputWidth: renderJob.outputWidth,
      outputHeight: renderJob.outputHeight,
      outputDuration: renderJob.outputDuration,
      outputCodec: renderJob.outputCodec,
      outputFileSize: renderJob.outputFileSize
    },
    ffprobe
  };
}

async function loadSmokeDependencies() {
  const [
    apiPrismaModule,
    projectRepositoryModule,
    assetRepositoryModule,
    renderStorageModule,
    renderRepositoryModule,
    renderServiceModule,
    workerPrismaModule,
    workerServiceModule
  ] = await Promise.all([
    importModule("apps/api/dist/infrastructure/database/prisma-client.js"),
    importModule(
      "apps/api/dist/modules/projects/infrastructure/prisma-project-repository.js"
    ),
    importModule(
      "apps/api/dist/modules/assets/infrastructure/prisma-asset-repository.js"
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
    createPrismaProjectRepository:
      projectRepositoryModule.createPrismaProjectRepository,
    createPrismaAssetRepository:
      assetRepositoryModule.createPrismaAssetRepository,
    createLocalRenderStorage: renderStorageModule.createLocalRenderStorage,
    createPrismaRenderJobRepository:
      renderRepositoryModule.createPrismaRenderJobRepository,
    createRenderJobForProject: renderServiceModule.createRenderJobForProject,
    workerPrisma: workerPrismaModule.prisma,
    runRenderWorkerOnce: workerServiceModule.runRenderWorkerOnce
  };
}

async function main() {
  let deps = null;

  log("Checking FFmpeg availability.");
  const ffmpegAvailability = await safeCheckFfmpeg(runCommand);

  if (!ffmpegAvailability.available) {
    if (ffmpegAvailability.blockedByEnvironment) {
      throw new Error(
        buildEnvironmentBlockerMessage(
          "Smoke de render",
          "`npm run smoke:production:logic`"
        )
      );
    }

    throw new Error(
      `FFmpeg is unavailable. ${ffmpegAvailability.errorMessage ?? "Run 'ffmpeg -version' manually."}`
    );
  }

  await ensureBuildArtifacts();
  deps = await loadSmokeDependencies();

  try {
    log("Generating deterministic smoke assets and Prisma records.");
    const smokeSetup = await prepareSmokeData(deps);

    log(`Created smoke project ${smokeSetup.projectId} and render job ${smokeSetup.renderJobId}.`);
    log("Processing the queued render job in worker once mode.");

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
            "Smoke de render",
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
            "Smoke de render",
            "`npm run smoke:production:logic`"
          )
        );
      }

      throw new Error(
        workerResult.errorMessage ??
          `Worker once exited with code ${workerResult.exitCode}.`
      );
    }

    const validation = await validateRenderResult(
      deps.apiPrisma,
      smokeSetup.projectId,
      smokeSetup.renderJobId
    );

    const result = {
      projectId: validation.projectId,
      renderJobId: validation.renderJobId,
      renderMode: requestedRenderMode,
      renderQuality: requestedRenderQuality,
      outputPath: validation.outputPath,
      thumbnailPath: validation.thumbnailPath,
      outputBytes: validation.outputBytes,
      durationSeconds:
        validation.metadata.outputDuration ?? validation.ffprobe?.durationSeconds ?? null,
      resolution:
        validation.metadata.outputWidth && validation.metadata.outputHeight
          ? `${validation.metadata.outputWidth}x${validation.metadata.outputHeight}`
          : null,
      codec: validation.metadata.outputCodec ?? validation.ffprobe?.codecName ?? null,
      outputFileSize: validation.metadata.outputFileSize,
      finalStatus: "completed"
    };

    log("Smoke render completed successfully.");
    printSmokeSummary(result);
  } finally {
    if (deps) {
      if (deps.workerPrisma !== deps.apiPrisma) {
        await deps.workerPrisma.$disconnect();
      }

      await deps.apiPrisma.$disconnect();
    }
  }
}

await main();

