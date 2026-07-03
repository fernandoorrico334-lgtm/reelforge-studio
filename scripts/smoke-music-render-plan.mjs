import { dirname, join, resolve } from "node:path";
import { stat } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  apiArtifactPath,
  ensureArtifactsExist,
  printSmokeSummary,
  resolveApiBuildRoot,
  writeMinimalPng,
  writeMinimalWav
} from "./lib/smoke-utils.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");
const smokeChannelName = "Smoke Music Render Plan Channel";
const smokeProjectTitle = "Smoke Music Render Plan Project";
const smokeAssetsRoot = "storage/assets/smoke/music-render-plan";

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
    "Run 'npm run build' before running smoke:music-render-plan."
  );
  const apiArtifacts = [
    "infrastructure/database/prisma-client.js",
    "modules/assets/infrastructure/prisma-asset-repository.js",
    "modules/projects/infrastructure/prisma-project-repository.js",
    "modules/editorial-microclips/infrastructure/prisma-editorial-microclip-repository.js",
    "modules/projects/application/project-render-blueprint-service.js"
  ].map((relativePath) => apiArtifactPath(apiBuildRoot, relativePath));

  await ensureArtifactsExist(
    projectRoot,
    ["packages/video-engine/dist/index.js", "packages/audio-engine/dist/index.js", ...apiArtifacts],
    "Run 'npm run build' before running smoke:music-render-plan."
  );

  return { apiBuildRoot };
}

async function loadDependencies(apiBuildRoot) {
  const [
    prismaModule,
    assetRepositoryModule,
    projectRepositoryModule,
    editorialMicroclipRepositoryModule,
    renderBlueprintServiceModule
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
        "modules/projects/application/project-render-blueprint-service.js"
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
    getVideoProjectRenderBlueprint:
      renderBlueprintServiceModule.getVideoProjectRenderBlueprint
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

  await prismaClient.scene.deleteMany({
    where: { videoProjectId: { in: previousProjectIds } }
  });
  await prismaClient.videoProject.deleteMany({
    where: { id: { in: previousProjectIds } }
  });
  await prismaClient.asset.deleteMany({
    where: {
      OR: [
        { path: { startsWith: `${smokeAssetsRoot}/` } },
        { scenes: { some: { id: { in: previousSceneIds } } } }
      ]
    }
  });
}

async function ensureSmokeChannel(prismaClient) {
  return prismaClient.channel.upsert({
    where: { name: smokeChannelName },
    update: {
      niche: "music render plan smoke",
      language: "pt-BR",
      visualStyle: "deterministic sports board",
      narrativeTone: "hype validation",
      defaultTemplate: "sports_hype",
      defaultVisualPreset: "action"
    },
    create: {
      name: smokeChannelName,
      niche: "music render plan smoke",
      language: "pt-BR",
      visualStyle: "deterministic sports board",
      narrativeTone: "hype validation",
      defaultTemplate: "sports_hype",
      defaultVisualPreset: "action"
    }
  });
}

async function ensureImageAsset(prismaClient) {
  const relativePath = `${smokeAssetsRoot}/render-plan-base.png`;
  const absolutePath = await writeMinimalPng(
    join(projectRoot, relativePath),
    "music-render-base"
  );
  const fileStats = await stat(absolutePath);

  return prismaClient.asset.upsert({
    where: { path: relativePath },
    update: {
      filename: "render-plan-base.png",
      originalName: "render-plan-base.png",
      type: "IMAGE",
      category: "REFERENCE",
      emotion: "EPIC",
      tags: JSON.stringify(["smoke", "render-plan", "music", "base"]),
      licenseType: "local-smoke",
      copyrightRisk: "LOW",
      recommendedUse: "Base frame for music render plan smoke",
      width: 1080,
      height: 1920,
      mimeType: "image/png",
      extension: ".png",
      fileSize: fileStats.size,
      sourceProvider: "smoke-local"
    },
    create: {
      filename: "render-plan-base.png",
      originalName: "render-plan-base.png",
      path: relativePath,
      type: "IMAGE",
      category: "REFERENCE",
      franchise: null,
      character: null,
      emotion: "EPIC",
      tags: JSON.stringify(["smoke", "render-plan", "music", "base"]),
      licenseType: "local-smoke",
      copyrightRisk: "LOW",
      recommendedUse: "Base frame for music render plan smoke",
      width: 1080,
      height: 1920,
      mimeType: "image/png",
      extension: ".png",
      fileSize: fileStats.size,
      sourceProvider: "smoke-local"
    }
  });
}

async function ensureMusicAsset(prismaClient) {
  const relativePath = `${smokeAssetsRoot}/render-plan-track.wav`;
  const absolutePath = await writeMinimalWav(
    join(projectRoot, relativePath),
    10,
    16000,
    "music-render-track"
  );
  const fileStats = await stat(absolutePath);
  const asset = await prismaClient.asset.upsert({
    where: { path: relativePath },
    update: {
      filename: "render-plan-track.wav",
      originalName: "render-plan-track.wav",
      type: "MUSIC",
      category: "TRACK",
      emotion: "EPIC",
      tags: JSON.stringify(["smoke", "music", "football", "hype"]),
      licenseType: "owned-local",
      copyrightRisk: "LOW",
      recommendedUse: "Music render plan smoke track",
      duration: 10,
      mimeType: "audio/wav",
      extension: ".wav",
      fileSize: fileStats.size,
      sourceProvider: "smoke-local"
    },
    create: {
      filename: "render-plan-track.wav",
      originalName: "render-plan-track.wav",
      path: relativePath,
      type: "MUSIC",
      category: "TRACK",
      franchise: null,
      character: null,
      emotion: "EPIC",
      tags: JSON.stringify(["smoke", "music", "football", "hype"]),
      licenseType: "owned-local",
      copyrightRisk: "LOW",
      recommendedUse: "Music render plan smoke track",
      duration: 10,
      mimeType: "audio/wav",
      extension: ".wav",
      fileSize: fileStats.size,
      sourceProvider: "smoke-local"
    }
  });

  await prismaClient.musicAssetProfile.upsert({
    where: { assetId: asset.id },
    update: {
      title: "Render Plan Track",
      artist: "Smoke Library",
      sourceType: "user_owned",
      licenseStatus: "owned",
      mood: "hype",
      genre: "phonk",
      bpm: 148,
      bpmConfidence: 0.74,
      energy: "high",
      useCase: "football",
      durationSeconds: 10,
      loudness: -13.2,
      beatMarkers: JSON.stringify([
        { timeSeconds: 0.5, strength: 0.82, confidence: 0.72 },
        { timeSeconds: 1.3, strength: 0.86, confidence: 0.74 },
        { timeSeconds: 2.1, strength: 0.89, confidence: 0.76 }
      ]),
      energyTimeline: JSON.stringify([
        { timeSeconds: 0, energy: 56 },
        { timeSeconds: 5, energy: 78 },
        { timeSeconds: 10, energy: 72 }
      ]),
      notes: "Smoke render plan music profile",
      safetyWarning: null
    },
    create: {
      assetId: asset.id,
      title: "Render Plan Track",
      artist: "Smoke Library",
      sourceType: "user_owned",
      licenseStatus: "owned",
      mood: "hype",
      genre: "phonk",
      bpm: 148,
      bpmConfidence: 0.74,
      energy: "high",
      useCase: "football",
      durationSeconds: 10,
      loudness: -13.2,
      beatMarkers: JSON.stringify([
        { timeSeconds: 0.5, strength: 0.82, confidence: 0.72 },
        { timeSeconds: 1.3, strength: 0.86, confidence: 0.74 },
        { timeSeconds: 2.1, strength: 0.89, confidence: 0.76 }
      ]),
      energyTimeline: JSON.stringify([
        { timeSeconds: 0, energy: 56 },
        { timeSeconds: 5, energy: 78 },
        { timeSeconds: 10, energy: 72 }
      ]),
      notes: "Smoke render plan music profile",
      safetyWarning: null
    }
  });

  return asset;
}

async function ensureNarrationAsset(prismaClient) {
  const relativePath = `${smokeAssetsRoot}/render-plan-narration.wav`;
  const absolutePath = await writeMinimalWav(
    join(projectRoot, relativePath),
    3,
    16000,
    "music-render-narration"
  );
  const fileStats = await stat(absolutePath);

  return prismaClient.asset.upsert({
    where: { path: relativePath },
    update: {
      filename: "render-plan-narration.wav",
      originalName: "render-plan-narration.wav",
      type: "AUDIO",
      category: "TRACK",
      emotion: "NEUTRAL",
      tags: JSON.stringify(["smoke", "narration", "music-render-plan"]),
      licenseType: "local-generated",
      copyrightRisk: "LOW",
      recommendedUse: "Narration smoke asset",
      duration: 3,
      mimeType: "audio/wav",
      extension: ".wav",
      fileSize: fileStats.size,
      sourceProvider: "mock-tts"
    },
    create: {
      filename: "render-plan-narration.wav",
      originalName: "render-plan-narration.wav",
      path: relativePath,
      type: "AUDIO",
      category: "TRACK",
      franchise: null,
      character: null,
      emotion: "NEUTRAL",
      tags: JSON.stringify(["smoke", "narration", "music-render-plan"]),
      licenseType: "local-generated",
      copyrightRisk: "LOW",
      recommendedUse: "Narration smoke asset",
      duration: 3,
      mimeType: "audio/wav",
      extension: ".wav",
      fileSize: fileStats.size,
      sourceProvider: "mock-tts"
    }
  });
}

async function ensureProject(
  prismaClient,
  channelId,
  imageAssetId,
  musicAssetId,
  narrationAssetId
) {
  return prismaClient.videoProject.create({
    data: {
      title: smokeProjectTitle,
      status: "READY_FOR_EDIT",
      channelId,
      script: "Smoke music render plan script.",
      durationTarget: 12,
      format: "9:16",
      templateId: "sports_hype",
      backgroundMusicAssetId: musicAssetId,
      musicPresetId: "football_hype",
      enableAudioDucking: true,
      scenes: {
        create: [
          {
            order: 1,
            title: "Opening beat",
            narrationText: "Opening smoke narration.",
            captionText: "Opening smoke narration",
            duration: 4,
            emotion: "EPIC",
            assetId: imageAssetId,
            generatedNarrationAssetId: narrationAssetId
          },
          {
            order: 2,
            title: "Climax beat",
            narrationText: "Second beat.",
            captionText: "Second beat",
            duration: 4,
            emotion: "TENSE",
            assetId: imageAssetId
          }
        ]
      }
    }
  });
}

async function main() {
  const { apiBuildRoot } = await ensureBuildArtifacts();
  const dependencies = await loadDependencies(apiBuildRoot);
  await cleanupPreviousSmokeData(dependencies.prisma);

  const channel = await ensureSmokeChannel(dependencies.prisma);
  const imageAsset = await ensureImageAsset(dependencies.prisma);
  const musicAsset = await ensureMusicAsset(dependencies.prisma);
  const narrationAsset = await ensureNarrationAsset(dependencies.prisma);
  const project = await ensureProject(
    dependencies.prisma,
    channel.id,
    imageAsset.id,
    musicAsset.id,
    narrationAsset.id
  );

  const assetRepository = dependencies.createPrismaAssetRepository();
  const projectRepository = dependencies.createPrismaProjectRepository();
  const editorialMicroclipRepository =
    dependencies.createPrismaEditorialMicroclipRepository();

  const blueprint = await dependencies.getVideoProjectRenderBlueprint(
    projectRepository,
    assetRepository,
    editorialMicroclipRepository,
    project.id
  );

  assert(
    blueprint.selectedMusicAssetId === musicAsset.id,
    "Blueprint did not expose selectedMusicAssetId."
  );
  assert(
    blueprint.musicPresetId === "football_hype",
    "Blueprint did not preserve musicPresetId."
  );
  assert(blueprint.beatSyncPlan, "Blueprint did not generate beatSyncPlan.");
  assert(
    blueprint.audio.backgroundMusic,
    "Audio plan did not include background music."
  );
  assert(
    blueprint.audio.narrationDucking.enabled,
    "Audio plan did not preserve narration ducking."
  );

  printSmokeSummary({
    projectId: project.id,
    selectedMusicAssetId: blueprint.selectedMusicAssetId,
    musicPresetId: blueprint.musicPresetId,
    cutTimes: blueprint.beatSyncPlan?.suggestedCutTimes.length ?? 0,
    beatMarkersUsed: blueprint.beatSyncPlan?.beatMarkersUsed.length ?? 0,
    musicVolume: blueprint.audio.musicVolume,
    duckingEnabled: blueprint.audio.narrationDucking.enabled,
    status: "completed"
  });
}

await main();
