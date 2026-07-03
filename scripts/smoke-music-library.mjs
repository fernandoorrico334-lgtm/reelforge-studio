import { spawn } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { stat } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  apiArtifactPath,
  ensureArtifactsExist,
  printSmokeSummary,
  resolveApiBuildRoot,
  safeCheckFfmpeg,
  safeCheckFfprobe,
  writeMinimalWav
} from "./lib/smoke-utils.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");
const smokeChannelName = "Smoke Music Library Channel";
const smokeProjectTitle = "Smoke Music Library Project";
const smokeAssetsRoot = "storage/assets/smoke/music-library";

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
    .slice(-8)
    .join(" | ");

  return Object.assign(
    new Error(
      `Command '${formatCommand(command, args)}' failed with code ${code ?? "unknown"}. ${tail || "No stdout/stderr output captured."}`
    ),
    { command, args: [...args], stdout, stderr, code }
  );
}

function createSpawnError(command, args, error) {
  return Object.assign(
    new Error(`Failed to spawn '${formatCommand(command, args)}'. ${error.message}`),
    { command, args: [...args], stdout: "", stderr: "", code: error.code ?? null }
  );
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
    "Run 'npm run build' before running smoke:music-library."
  );
  const apiArtifacts = [
    "infrastructure/database/prisma-client.js",
    "modules/assets/infrastructure/prisma-asset-repository.js",
    "modules/projects/infrastructure/prisma-project-repository.js",
    "modules/editorial-microclips/infrastructure/prisma-editorial-microclip-repository.js",
    "modules/audio-library/infrastructure/prisma-audio-library-repository.js",
    "modules/audio-library/application/audio-library-service.js"
  ].map((relativePath) => apiArtifactPath(apiBuildRoot, relativePath));

  await ensureArtifactsExist(
    projectRoot,
    ["packages/audio-engine/dist/index.js", ...apiArtifacts],
    "Run 'npm run build' before running smoke:music-library."
  );

  return { apiBuildRoot };
}

async function loadDependencies(apiBuildRoot) {
  const [
    prismaModule,
    assetRepositoryModule,
    projectRepositoryModule,
    editorialMicroclipRepositoryModule,
    audioLibraryRepositoryModule,
    audioLibraryServiceModule
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
        "modules/editorial-microclips/infrastructure/prisma-editorial-microclip-repository.js"
      )
    ),
    importModule(
      apiArtifactPath(
        apiBuildRoot,
        "modules/audio-library/infrastructure/prisma-audio-library-repository.js"
      )
    ),
    importModule(
      apiArtifactPath(
        apiBuildRoot,
        "modules/audio-library/application/audio-library-service.js"
      )
    )
  ]);

  return {
    prisma: prismaModule.prisma,
    createPrismaAssetRepository: assetRepositoryModule.createPrismaAssetRepository,
    createPrismaProjectRepository:
      projectRepositoryModule.createPrismaProjectRepository,
    createPrismaEditorialMicroclipRepository:
      editorialMicroclipRepositoryModule.createPrismaEditorialMicroclipRepository,
    createPrismaAudioLibraryRepository:
      audioLibraryRepositoryModule.createPrismaAudioLibraryRepository,
    analyzeMusicLibraryAsset:
      audioLibraryServiceModule.analyzeMusicLibraryAsset,
    listMusicLibrary: audioLibraryServiceModule.listMusicLibrary,
    selectMusicForProject: audioLibraryServiceModule.selectMusicForProject,
    buildProjectBeatSyncPlan:
      audioLibraryServiceModule.buildProjectBeatSyncPlan
  };
}

async function cleanupPreviousSmokeData(prismaClient) {
  const previousProjects = await prismaClient.videoProject.findMany({
    where: { title: smokeProjectTitle },
    select: { id: true }
  });
  const previousProjectIds = previousProjects.map((item) => item.id);

  await prismaClient.scene.deleteMany({
    where: { videoProjectId: { in: previousProjectIds } }
  });
  await prismaClient.videoProject.deleteMany({
    where: { id: { in: previousProjectIds } }
  });
  await prismaClient.musicAssetProfile.deleteMany({
    where: {
      asset: {
        path: {
          startsWith: `${smokeAssetsRoot}/`
        }
      }
    }
  });
  await prismaClient.sfxAssetProfile.deleteMany({
    where: {
      asset: {
        path: {
          startsWith: `${smokeAssetsRoot}/`
        }
      }
    }
  });
  await prismaClient.asset.deleteMany({
    where: {
      path: {
        startsWith: `${smokeAssetsRoot}/`
      }
    }
  });
}

async function ensureSmokeChannel(prismaClient) {
  return prismaClient.channel.upsert({
    where: { name: smokeChannelName },
    update: {
      niche: "music library smoke",
      language: "pt-BR",
      visualStyle: "sports edit bench",
      narrativeTone: "hype technical validation",
      defaultTemplate: "sports_hype",
      defaultVisualPreset: "action"
    },
    create: {
      name: smokeChannelName,
      niche: "music library smoke",
      language: "pt-BR",
      visualStyle: "sports edit bench",
      narrativeTone: "hype technical validation",
      defaultTemplate: "sports_hype",
      defaultVisualPreset: "action"
    }
  });
}

async function ensureMusicAsset(prismaClient) {
  const relativePath = `${smokeAssetsRoot}/smoke-library-track.wav`;
  const absolutePath = await writeMinimalWav(
    join(projectRoot, relativePath),
    8,
    16000,
    "music-library-track"
  );
  const fileStats = await stat(absolutePath);

  return prismaClient.asset.upsert({
    where: { path: relativePath },
    update: {
      filename: "smoke-library-track.wav",
      originalName: "smoke-library-track.wav",
      type: "MUSIC",
      category: "TRACK",
      emotion: "EPIC",
      tags: JSON.stringify(["smoke", "music", "football", "hype"]),
      licenseType: "royalty-free-local",
      copyrightRisk: "LOW",
      recommendedUse: "Smoke validation football hype track",
      duration: 8,
      mimeType: "audio/wav",
      extension: ".wav",
      fileSize: fileStats.size,
      sourceProvider: "smoke-local"
    },
    create: {
      filename: "smoke-library-track.wav",
      originalName: "smoke-library-track.wav",
      path: relativePath,
      type: "MUSIC",
      category: "TRACK",
      franchise: null,
      character: null,
      emotion: "EPIC",
      tags: JSON.stringify(["smoke", "music", "football", "hype"]),
      licenseType: "royalty-free-local",
      copyrightRisk: "LOW",
      recommendedUse: "Smoke validation football hype track",
      duration: 8,
      mimeType: "audio/wav",
      extension: ".wav",
      fileSize: fileStats.size,
      sourceProvider: "smoke-local"
    }
  });
}

async function ensureProject(prismaClient, channelId, musicAssetId) {
  return prismaClient.videoProject.create({
    data: {
      title: smokeProjectTitle,
      status: "SCENE_PLANNING",
      channelId,
      script: "Smoke music library validation project",
      durationTarget: 16,
      format: "9:16",
      templateId: "sports_hype",
      backgroundMusicAssetId: musicAssetId,
      musicPresetId: "football_hype",
      scenes: {
        create: [
          {
            order: 1,
            title: "Hook",
            narrationText: "Smoke music hook.",
            captionText: "Smoke music hook",
            duration: 4,
            emotion: "EPIC"
          },
          {
            order: 2,
            title: "Impact",
            narrationText: "Impact moment.",
            captionText: "Impact moment",
            duration: 4,
            emotion: "TENSE"
          }
        ]
      }
    }
  });
}

async function main() {
  const ffmpeg = await safeCheckFfmpeg(runCommand);
  const ffprobe = await safeCheckFfprobe(runCommand);

  if (!ffmpeg.available || !ffprobe.available) {
    printSmokeSummary({
      status: "skipped",
      reason: ffmpeg.errorMessage ?? ffprobe.errorMessage ?? "FFmpeg/FFprobe unavailable.",
      ffmpeg: ffmpeg.versionLine,
      ffprobe: ffprobe.versionLine
    });
    return;
  }

  const { apiBuildRoot } = await ensureBuildArtifacts();
  const dependencies = await loadDependencies(apiBuildRoot);
  await cleanupPreviousSmokeData(dependencies.prisma);

  const channel = await ensureSmokeChannel(dependencies.prisma);
  const musicAsset = await ensureMusicAsset(dependencies.prisma);
  const project = await ensureProject(
    dependencies.prisma,
    channel.id,
    musicAsset.id
  );

  const assetRepository = dependencies.createPrismaAssetRepository();
  const projectRepository = dependencies.createPrismaProjectRepository();
  const editorialMicroclipRepository =
    dependencies.createPrismaEditorialMicroclipRepository();
  const audioLibraryRepository =
    dependencies.createPrismaAudioLibraryRepository();

  const analyzed = await dependencies.analyzeMusicLibraryAsset(
    assetRepository,
    audioLibraryRepository,
    musicAsset.id
  );
  const musicLibrary = await dependencies.listMusicLibrary(assetRepository, {});
  const selection = await dependencies.selectMusicForProject(assetRepository, {
    templateId: "sports_hype",
    musicPresetId: "football_hype",
    tone: "hype",
    durationSeconds: 16,
    useCase: "football",
    allowUnknownLicense: false
  });
  const beatSync = await dependencies.buildProjectBeatSyncPlan(
    projectRepository,
    assetRepository,
    editorialMicroclipRepository,
    {
      projectId: project.id,
      musicAssetId: musicAsset.id,
      musicPresetId: "football_hype",
      reelDurationSeconds: 16
    }
  );

  assert(analyzed.profile, "Music analysis did not persist a profile.");
  assert(musicLibrary.length > 0, "Music library is empty after analysis.");
  assert(
    selection.selectedMusicAsset,
    "Automatic music selection did not return any compatible music asset."
  );
  assert(
    selection.selectedMusicAsset.profile?.licenseStatus !== "unknown" &&
      selection.selectedMusicAsset.profile?.licenseStatus !== "platform_only",
    "Automatic music selection picked an asset with unsafe license status."
  );
  assert(
    selection.selectedMusicAsset.profile?.useCase === "football",
    "Automatic music selection did not pick a football-compatible track."
  );
  assert(
    ["hype", "aggressive", "epic", "cinematic"].includes(
      selection.selectedMusicAsset.profile?.mood ?? ""
    ),
    "Automatic music selection returned a track with incompatible mood for football_hype."
  );
  assert(
    beatSync.selectedMusicAssetId === musicAsset.id,
    "Beat sync plan did not keep the selected music asset."
  );

  printSmokeSummary({
    projectId: project.id,
    assetId: musicAsset.id,
    selectedMusicAssetId: selection.selectedMusicAsset?.asset.id ?? null,
    selectedMusicFilename: selection.selectedMusicAsset?.asset.filename ?? null,
    beatMarkersUsed: analyzed.profile?.beatMarkers.length ?? 0,
    beatSyncConfidence: beatSync.beatSyncPlan.confidence,
    warnings: beatSync.warnings,
    status: "completed"
  });
}

await main();
