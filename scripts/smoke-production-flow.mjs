import { spawn } from "node:child_process";
import { mkdir, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  apiArtifactPath,
  ensureArtifactsExist,
  resolveApiBuildRoot
} from "./lib/smoke-utils.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");
const smokeProjectTitle = "Smoke Production Flow";
const smokeChannelName = "Smoke Production Channel";
const npmCliPath =
  typeof process.env.npm_execpath === "string" &&
  process.env.npm_execpath.trim().length > 0
    ? process.env.npm_execpath
    : null;

function log(message) {
  console.log(`[smoke:production] ${message}`);
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

async function runNpm(argumentsList) {
  if (!npmCliPath) {
    throw new Error(
      "npm_execpath is unavailable. Run the smoke test through 'npm run smoke:production'."
    );
  }

  return runCommand(process.execPath, [npmCliPath, ...argumentsList]);
}

async function importModule(relativePath) {
  return import(pathToFileURL(join(projectRoot, relativePath)).href);
}

async function ensureBuildArtifacts() {
  const apiBuildRoot = await resolveApiBuildRoot(
    projectRoot,
    "Run 'npm run build' before running smoke:production:logic."
  );
  const apiArtifacts = [
    "infrastructure/database/prisma-client.js",
    "modules/assets/infrastructure/prisma-asset-repository.js",
    "modules/channels/infrastructure/prisma-channel-repository.js",
    "modules/projects/infrastructure/prisma-project-repository.js",
    "modules/render-jobs/infrastructure/prisma-render-job-repository.js",
    "modules/render-jobs/infrastructure/local-render-storage.js",
    "modules/render-jobs/application/render-job-service.js",
    "modules/production/application/production-service.js"
  ].map((relativePath) => apiArtifactPath(apiBuildRoot, relativePath));

  await ensureArtifactsExist(
    projectRoot,
    [...apiArtifacts, "apps/worker/dist/infrastructure/prisma-client.js", "apps/worker/dist/services/render-worker.js"],
    "Run 'npm run build' before running smoke:production:logic."
  );

  return { apiBuildRoot };
}

async function checkBinaryAvailable(binaryName) {
  try {
    await runCommand(binaryName, ["-version"]);
    return true;
  } catch {
    return false;
  }
}

async function ensureToolingAvailable() {
  return checkBinaryAvailable("ffmpeg");
}

async function generateColorFrame(relativePath, color) {
  const absolutePath = join(projectRoot, relativePath);

  await runCommand("ffmpeg", [
    "-y",
    "-f",
    "lavfi",
    "-i",
    `color=c=${color}:s=1080x1920`,
    "-frames:v",
    "1",
    absolutePath
  ]);

  return absolutePath;
}

async function generateTone(relativePath, frequency, durationSeconds, extraFilter = null) {
  const absolutePath = join(projectRoot, relativePath);
  const args = [
    "-y",
    "-f",
    "lavfi",
    "-i",
    `sine=frequency=${frequency}:sample_rate=48000:duration=${durationSeconds}`,
    "-c:a",
    "pcm_s16le"
  ];

  if (extraFilter) {
    args.push("-af", extraFilter);
  }

  args.push(absolutePath);
  await runCommand("ffmpeg", args);
  return absolutePath;
}

async function ensureSmokeAssets() {
  const directories = [
    join(projectRoot, "storage", "assets", "smoke", "production", "image"),
    join(projectRoot, "storage", "assets", "smoke", "production", "music"),
    join(projectRoot, "storage", "assets", "smoke", "production", "audio")
  ];

  await Promise.all(
    directories.map((directoryPath) => mkdir(directoryPath, { recursive: true }))
  );

  const imageDefinitions = [
    {
      filename: "production_hook.png",
      color: "#1d2645",
      emotion: "CURIOUS",
      category: "COVER",
      tags: ["smoke", "production", "hook", "segredo", "arquivo"],
      recommendedUse: "Hook de abertura"
    },
    {
      filename: "production_context.png",
      color: "#27343c",
      emotion: "MYSTERIOUS",
      category: "REFERENCE",
      tags: ["smoke", "production", "context", "arquivo", "origem"],
      recommendedUse: "Contexto e origem"
    },
    {
      filename: "production_climax.png",
      color: "#4a1e28",
      emotion: "EPIC",
      category: "BROLL",
      tags: ["smoke", "production", "climax", "verdade", "confronto", "guerra"],
      recommendedUse: "Climax e confronto"
    },
    {
      filename: "production_cta.png",
      color: "#21354e",
      emotion: "JOYFUL",
      category: "CHARACTER",
      tags: ["smoke", "production", "cta", "parte 2", "inscreva", "comenta"],
      recommendedUse: "Encerramento com CTA"
    }
  ];

  const images = [];

  for (const definition of imageDefinitions) {
    const relativePath = `storage/assets/smoke/production/image/${definition.filename}`;
    const absolutePath = await generateColorFrame(relativePath, definition.color);
    const fileStats = await stat(absolutePath);

    images.push({
      ...definition,
      relativePath,
      fileSize: fileStats.size
    });
  }

  const musicRelativePath = "storage/assets/smoke/production/music/production_music.wav";
  const voiceRelativePath = "storage/assets/smoke/production/audio/production_voice.wav";

  await generateTone(musicRelativePath, 240, 12, "volume=0.24");
  await generateTone(voiceRelativePath, 560, 12, "volume=0.72");

  return {
    images,
    music: {
      relativePath: musicRelativePath,
      fileSize: (await stat(join(projectRoot, musicRelativePath))).size
    },
    voice: {
      relativePath: voiceRelativePath,
      fileSize: (await stat(join(projectRoot, voiceRelativePath))).size
    }
  };
}

async function loadSmokeDependencies(apiBuildRoot) {
  const [
    apiPrismaModule,
    assetRepositoryModule,
    channelRepositoryModule,
    projectRepositoryModule,
    productionServiceModule,
    renderRepositoryModule,
    renderStorageModule,
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
        "modules/channels/infrastructure/prisma-channel-repository.js"
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
        "modules/production/application/production-service.js"
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
        "modules/render-jobs/infrastructure/local-render-storage.js"
      )
    ),
    importModule(
      apiArtifactPath(
        apiBuildRoot,
        "modules/render-jobs/application/render-job-service.js"
      )
    ),
    importModule("apps/worker/dist/infrastructure/prisma-client.js"),
    importModule("apps/worker/dist/services/render-worker.js")
  ]);

  return {
    apiPrisma: apiPrismaModule.prisma,
    createPrismaAssetRepository:
      assetRepositoryModule.createPrismaAssetRepository,
    createPrismaChannelRepository:
      channelRepositoryModule.createPrismaChannelRepository,
    createPrismaProjectRepository:
      projectRepositoryModule.createPrismaProjectRepository,
    createProductionFromScript:
      productionServiceModule.createProductionFromScript,
    getVideoProjectProductionChecklist:
      productionServiceModule.getVideoProjectProductionChecklist,
    getVideoProjectAssetSuggestions:
      productionServiceModule.getVideoProjectAssetSuggestions,
    createPrismaRenderJobRepository:
      renderRepositoryModule.createPrismaRenderJobRepository,
    createLocalRenderStorage: renderStorageModule.createLocalRenderStorage,
    createRenderJobForProject: renderServiceModule.createRenderJobForProject,
    workerPrisma: workerPrismaModule.prisma,
    runRenderWorkerOnce: workerServiceModule.runRenderWorkerOnce
  };
}

async function upsertAssetRecord(prismaClient, data) {
  return prismaClient.asset.upsert({
    where: {
      path: data.path
    },
    update: data,
    create: data
  });
}

async function prepareSmokeData(deps) {
  const smokeAssets = await ensureSmokeAssets();

  await deps.apiPrisma.videoProject.deleteMany({
    where: {
      title: smokeProjectTitle
    }
  });

  const persistedVisualAssets = [];

  for (const image of smokeAssets.images) {
    persistedVisualAssets.push(
      await upsertAssetRecord(deps.apiPrisma, {
        filename: image.filename,
        originalName: image.filename,
        path: image.relativePath,
        type: "IMAGE",
        category: image.category,
        franchise: "Smoke Production",
        character: null,
        emotion: image.emotion,
        tags: JSON.stringify(image.tags),
        licenseType: "local-generated",
        copyrightRisk: "LOW",
        recommendedUse: image.recommendedUse,
        duration: null,
        width: 1080,
        height: 1920,
        mimeType: "image/png",
        extension: ".png",
        fileSize: image.fileSize
      })
    );
  }

  const musicAsset = await upsertAssetRecord(deps.apiPrisma, {
    filename: "production_music.wav",
    originalName: "production_music.wav",
    path: smokeAssets.music.relativePath,
    type: "MUSIC",
    category: "TRACK",
    franchise: "Smoke Production",
    character: null,
    emotion: "EPIC",
    tags: JSON.stringify(["smoke", "production", "music", "epic_rise"]),
    licenseType: "local-generated",
    copyrightRisk: "LOW",
    recommendedUse: "Trilha base do smoke de producao",
    duration: 12,
    width: null,
    height: null,
    mimeType: "audio/wav",
    extension: ".wav",
    fileSize: smokeAssets.music.fileSize
  });

  const voiceAsset = await upsertAssetRecord(deps.apiPrisma, {
    filename: "production_voice.wav",
    originalName: "production_voice.wav",
    path: smokeAssets.voice.relativePath,
    type: "AUDIO",
    category: "TRACK",
    franchise: "Smoke Production",
    character: null,
    emotion: "NEUTRAL",
    tags: JSON.stringify(["smoke", "production", "voiceover"]),
    licenseType: "local-generated",
    copyrightRisk: "LOW",
    recommendedUse: "Narracao base do smoke de producao",
    duration: 12,
    width: null,
    height: null,
    mimeType: "audio/wav",
    extension: ".wav",
    fileSize: smokeAssets.voice.fileSize
  });

  const channel = await deps.apiPrisma.channel.upsert({
    where: {
      name: smokeChannelName
    },
    update: {
      niche: "Smoke production flow validation",
      language: "pt-BR",
      visualStyle: "Deterministic cinematic smoke frames",
      narrativeTone: "Epic mystery proof flow",
      defaultTemplate: "cinematic_story",
      defaultRenderMode: "cinematic_v2",
      defaultRenderQuality: "standard",
      defaultAudioMood: "epic_rise",
      defaultCaptionStyle: "bold_impact",
      defaultVisualPreset: "epic",
      defaultMusicAssetId: musicAsset.id,
      defaultVoiceoverAssetId: voiceAsset.id,
      defaultDurationTarget: 12,
      defaultSceneDuration: 3,
      preferredAssetCategories: JSON.stringify([
        "COVER",
        "REFERENCE",
        "BROLL",
        "CHARACTER"
      ]),
      preferredAssetTags: JSON.stringify([
        "smoke",
        "production",
        "hook",
        "climax",
        "cta"
      ])
    },
    create: {
      name: smokeChannelName,
      niche: "Smoke production flow validation",
      language: "pt-BR",
      visualStyle: "Deterministic cinematic smoke frames",
      narrativeTone: "Epic mystery proof flow",
      defaultTemplate: "cinematic_story",
      defaultRenderMode: "cinematic_v2",
      defaultRenderQuality: "standard",
      defaultAudioMood: "epic_rise",
      defaultCaptionStyle: "bold_impact",
      defaultVisualPreset: "epic",
      defaultMusicAssetId: musicAsset.id,
      defaultVoiceoverAssetId: voiceAsset.id,
      defaultDurationTarget: 12,
      defaultSceneDuration: 3,
      preferredAssetCategories: JSON.stringify([
        "COVER",
        "REFERENCE",
        "BROLL",
        "CHARACTER"
      ]),
      preferredAssetTags: JSON.stringify([
        "smoke",
        "production",
        "hook",
        "climax",
        "cta"
      ])
    }
  });

  const projectRepository = deps.createPrismaProjectRepository();
  const channelRepository = deps.createPrismaChannelRepository();
  const assetRepository = deps.createPrismaAssetRepository();
  const script = [
    "Pouca gente percebeu como essa lenda realmente comecou.",
    "Nos arquivos esquecidos, o heroi reuniu pistas que mudaram a origem do conflito.",
    "Mas entao a verdade explodiu no maior confronto da guerra e tudo mudou.",
    "Se quiser a parte 2, comenta e se inscreva para a proxima revelacao."
  ].join("\n\n");

  const productionResult = await deps.createProductionFromScript(
    projectRepository,
    channelRepository,
    assetRepository,
    {
      channelId: channel.id,
      title: smokeProjectTitle,
      script,
      durationTarget: 12,
      sceneDuration: 3,
      format: "9:16",
      status: "READY_FOR_EDIT",
      autoCreateScenes: true,
      autoSuggestAssets: true,
      applyChannelDefaults: true
    }
  );

  const checklistResult = await deps.getVideoProjectProductionChecklist(
    projectRepository,
    channelRepository,
    productionResult.project.id
  );
  const suggestionsResult = await deps.getVideoProjectAssetSuggestions(
    projectRepository,
    channelRepository,
    assetRepository,
    productionResult.project.id
  );

  const renderJobRepository = deps.createPrismaRenderJobRepository();
  const renderStorage = deps.createLocalRenderStorage();
  const renderJob = await deps.createRenderJobForProject(
    renderJobRepository,
    projectRepository,
    assetRepository,
    renderStorage,
    productionResult.project.id,
    {
      renderMode: "cinematic_v2",
      renderQuality: "standard"
    }
  );

  return {
    channelId: channel.id,
    projectId: productionResult.project.id,
    renderJobId: renderJob.id,
    productionResult,
    checklistResult,
    suggestionsResult,
    persistedVisualAssets
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
      typeof audioStream?.codec_name === "string" ? audioStream.codec_name : null
  };
}

async function validateProductionSetup(setup) {
  if (!setup.productionResult.project.id) {
    throw new Error("Production flow did not create a project id.");
  }

  if (setup.productionResult.scenesCreated < 1) {
    throw new Error("Production flow did not create scenes from the script.");
  }

  if (setup.suggestionsResult.scenes.length !== setup.productionResult.scenesCreated) {
    throw new Error("Asset suggestions were not returned for every created scene.");
  }

  if (!setup.checklistResult.checklist.readyToRender) {
    const warningText = [
      ...setup.checklistResult.checklist.alerts,
      ...setup.checklistResult.checklist.warnings,
      ...setup.checklistResult.checklist.suggestions
    ].join(" | ");
    throw new Error(
      `Production checklist is not ready to render. ${warningText || "No detailed warning returned."}`
    );
  }
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
    throw new Error(`Render job '${renderJobId}' has incomplete output artifacts.`);
  }

  const absoluteOutputPath = join(projectRoot, renderJob.outputPath);
  const absoluteThumbnailPath = join(projectRoot, renderJob.thumbnailPath);
  const outputStats = await stat(absoluteOutputPath);
  const thumbnailStats = await stat(absoluteThumbnailPath);
  const ffprobe = await inspectWithFfprobe(absoluteOutputPath);

  if (outputStats.size <= 0 || thumbnailStats.size <= 0) {
    throw new Error("Production smoke generated empty render artifacts.");
  }

  if (renderJob.outputWidth !== 1080 || renderJob.outputHeight !== 1920) {
    throw new Error(
      `Expected 1080x1920 output, got ${renderJob.outputWidth}x${renderJob.outputHeight}.`
    );
  }

  if (!renderJob.hasAudio || !ffprobe.hasAudio) {
    throw new Error("Production smoke render completed without audio.");
  }

  if (!["h264", "avc1"].includes(ffprobe.videoCodec ?? "")) {
    throw new Error(`Unexpected video codec '${ffprobe.videoCodec}'.`);
  }

  return {
    outputPath: renderJob.outputPath,
    thumbnailPath: renderJob.thumbnailPath,
    resolution: `${renderJob.outputWidth}x${renderJob.outputHeight}`,
    durationSeconds: renderJob.outputDuration ?? ffprobe.durationSeconds,
    codec: renderJob.outputCodec ?? ffprobe.videoCodec,
    hasAudio: renderJob.hasAudio,
    status: renderJob.status
  };
}

async function main() {
  const ffmpegAvailable = await ensureToolingAvailable();

  if (!ffmpegAvailable) {
    console.log(
      JSON.stringify(
        {
          status: "skipped",
          reason:
            "FFmpeg or child_process spawn is unavailable in this environment."
        },
        null,
        2
      )
    );
    return;
  }

  const { apiBuildRoot } = await ensureBuildArtifacts();

  const deps = await loadSmokeDependencies(apiBuildRoot);

  try {
    log("Preparing deterministic channel defaults, assets and production project.");
    const setup = await prepareSmokeData(deps);

    await validateProductionSetup(setup);
    log(
      `Created project ${setup.projectId} with ${setup.productionResult.scenesCreated} scene(s) and render job ${setup.renderJobId}.`
    );

    const workerResult = await deps.runRenderWorkerOnce({
      logger: (message) => {
        log(`[worker] ${message}`);
      }
    });

    if (workerResult.exitCode !== 0) {
      throw new Error(
        workerResult.errorMessage ??
          `Worker once exited with code ${workerResult.exitCode}.`
      );
    }

    const renderResult = await validateRenderResult(
      deps.apiPrisma,
      setup.renderJobId
    );

    console.log(
      JSON.stringify(
        {
          channelId: setup.channelId,
          projectId: setup.projectId,
          renderJobId: setup.renderJobId,
          sceneCount: setup.productionResult.scenesCreated,
          readyToRender: setup.checklistResult.checklist.readyToRender,
          outputPath: renderResult.outputPath,
          thumbnailPath: renderResult.thumbnailPath,
          resolution: renderResult.resolution,
          durationSeconds: renderResult.durationSeconds,
          codec: renderResult.codec,
          hasAudio: renderResult.hasAudio,
          status: renderResult.status
        },
        null,
        2
      )
    );
  } finally {
    if (deps.workerPrisma !== deps.apiPrisma) {
      await deps.workerPrisma.$disconnect();
    }

    await deps.apiPrisma.$disconnect();
  }
}

await main();

