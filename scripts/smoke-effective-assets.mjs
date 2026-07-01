import { access, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  apiArtifactPath,
  ensureArtifactsExist,
  printSmokeSummary,
  resolveApiBuildRoot,
  writeMinimalPng
} from "./lib/smoke-utils.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");
const smokeChannelName = "Smoke Effective Assets Channel";
const smokeProjectTitle = "Smoke Effective Assets Project";
const baseAssetRelativePath =
  "storage/assets/smoke/effective-assets/image/smoke-effective-base.png";

function log(message) {
  console.log(`[smoke:effective-assets] ${message}`);
}

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
    "Run 'npm run build' before running smoke:effective-assets."
  );
  const apiArtifacts = [
    "infrastructure/database/prisma-client.js",
    "modules/assets/infrastructure/prisma-asset-repository.js",
    "modules/channels/infrastructure/prisma-channel-repository.js",
    "modules/characters/infrastructure/prisma-character-repository.js",
    "modules/projects/infrastructure/prisma-project-repository.js",
    "modules/projects/application/project-video-engine-mapper.js",
    "modules/production/application/production-service.js",
    "modules/hybrid-visual/infrastructure/prisma-visual-generation-job-repository.js",
    "modules/hybrid-visual/application/hybrid-visual-service.js"
  ].map((relativePath) => apiArtifactPath(apiBuildRoot, relativePath));

  await ensureArtifactsExist(
    projectRoot,
    ["packages/video-engine/dist/index.js", ...apiArtifacts],
    "Run 'npm run build' before running smoke:effective-assets."
  );

  return { apiBuildRoot };
}

async function loadDependencies(apiBuildRoot) {
  const [
    prismaModule,
    assetRepositoryModule,
    channelRepositoryModule,
    characterRepositoryModule,
    projectRepositoryModule,
    projectMapperModule,
    productionServiceModule,
    visualJobRepositoryModule,
    hybridVisualServiceModule,
    videoEngineModule
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
        "modules/characters/infrastructure/prisma-character-repository.js"
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
        "modules/projects/application/project-video-engine-mapper.js"
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
        "modules/hybrid-visual/infrastructure/prisma-visual-generation-job-repository.js"
      )
    ),
    importModule(
      apiArtifactPath(
        apiBuildRoot,
        "modules/hybrid-visual/application/hybrid-visual-service.js"
      )
    ),
    importModule("packages/video-engine/dist/index.js")
  ]);

  return {
    prisma: prismaModule.prisma,
    createPrismaAssetRepository: assetRepositoryModule.createPrismaAssetRepository,
    createPrismaChannelRepository:
      channelRepositoryModule.createPrismaChannelRepository,
    createPrismaCharacterRepository:
      characterRepositoryModule.createPrismaCharacterRepository,
    createPrismaProjectRepository:
      projectRepositoryModule.createPrismaProjectRepository,
    mapProjectToBlueprintInput: projectMapperModule.mapProjectToBlueprintInput,
    getVideoProjectProductionChecklist:
      productionServiceModule.getVideoProjectProductionChecklist,
    createPrismaVisualGenerationJobRepository:
      visualJobRepositoryModule.createPrismaVisualGenerationJobRepository,
    generateVisualForScene: hybridVisualServiceModule.generateVisualForScene,
    buildRenderBlueprint: videoEngineModule.buildRenderBlueprint
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
    await prismaClient.visualGenerationJob.findMany({
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

  await prismaClient.visualGenerationJob.deleteMany({
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
    where: {
      OR: [
        { id: { in: previousGeneratedAssetIds } },
        { path: baseAssetRelativePath }
      ]
    }
  });
}

async function ensureSmokeChannel(prismaClient) {
  return prismaClient.channel.upsert({
    where: { name: smokeChannelName },
    update: {
      niche: "effective asset smoke",
      language: "pt-BR",
      visualStyle: "deterministic validation board",
      narrativeTone: "technical and cinematic",
      defaultTemplate: "cinematic_story",
      defaultRenderMode: "cinematic_v2",
      defaultRenderQuality: "standard",
      defaultCaptionStyle: "documentary_clean",
      defaultVisualPreset: "mystery",
      defaultDurationTarget: 12,
      defaultSceneDuration: 4
    },
    create: {
      name: smokeChannelName,
      niche: "effective asset smoke",
      language: "pt-BR",
      visualStyle: "deterministic validation board",
      narrativeTone: "technical and cinematic",
      defaultTemplate: "cinematic_story",
      defaultRenderMode: "cinematic_v2",
      defaultRenderQuality: "standard",
      defaultCaptionStyle: "documentary_clean",
      defaultVisualPreset: "mystery",
      defaultDurationTarget: 12,
      defaultSceneDuration: 4
    }
  });
}

async function ensureBaseAsset(prismaClient) {
  const absolutePath = join(projectRoot, baseAssetRelativePath);
  await writeMinimalPng(absolutePath, "effective-base");
  const fileStats = await stat(absolutePath);

  return prismaClient.asset.upsert({
    where: { path: baseAssetRelativePath },
    update: {
      filename: "smoke-effective-base.png",
      originalName: "smoke-effective-base.png",
      type: "IMAGE",
      category: "REFERENCE",
      emotion: "CURIOUS",
      tags: JSON.stringify(["smoke", "effective", "base", "visual"]),
      licenseType: "local-smoke",
      copyrightRisk: "LOW",
      recommendedUse: "Base asset for effective visual smoke validation",
      width: 1080,
      height: 1920,
      mimeType: "image/png",
      extension: "png",
      fileSize: fileStats.size,
      sourceProvider: "manual"
    },
    create: {
      filename: "smoke-effective-base.png",
      originalName: "smoke-effective-base.png",
      path: baseAssetRelativePath,
      type: "IMAGE",
      category: "REFERENCE",
      franchise: "Smoke",
      character: null,
      emotion: "CURIOUS",
      tags: JSON.stringify(["smoke", "effective", "base", "visual"]),
      licenseType: "local-smoke",
      copyrightRisk: "LOW",
      recommendedUse: "Base asset for effective visual smoke validation",
      width: 1080,
      height: 1920,
      mimeType: "image/png",
      extension: "png",
      fileSize: fileStats.size,
      sourceProvider: "manual"
    }
  });
}

async function seedSmokeProject(prismaClient, channelId, baseAssetId) {
  const project = await prismaClient.videoProject.create({
    data: {
      title: smokeProjectTitle,
      status: "READY_FOR_EDIT",
      channelId,
      script:
        "Projeto para validar asset efetivo com base asset, visual gerado e fallback.",
      durationTarget: 12,
      format: "9:16",
      templateId: "cinematic_story",
      defaultCaptionStyle: "documentary_clean",
      scenes: {
        create: [
          {
            order: 1,
            title: "Generated only proof",
            narrationText: "Cena sem asset base, dependente do visual gerado.",
            captionText: "Visual gerado assume a cena",
            duration: 4,
            emotion: "MYSTERIOUS",
            visualPreset: "mystery",
            visualSourceMode: "generated_only",
            transition: "cut"
          },
          {
            order: 2,
            title: "Base asset proof",
            narrationText: "Cena apoiada por asset base da biblioteca.",
            captionText: "Base asset continua valido",
            duration: 4,
            emotion: "CURIOUS",
            assetId: baseAssetId,
            visualPreset: "calm",
            visualSourceMode: "asset_only",
            transition: "fade"
          },
          {
            order: 3,
            title: "Fallback generated proof",
            narrationText: "Cena sem asset base recebe visual gerado pelo fallback.",
            captionText: "Fallback generated cobre a falta do asset",
            duration: 4,
            emotion: "EPIC",
            visualPreset: "epic",
            visualSourceMode: "fallback_generated",
            transition: "flash"
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
    generatedOnlySceneId: project.scenes[0]?.id ?? null,
    assetOnlySceneId: project.scenes[1]?.id ?? null,
    fallbackSceneId: project.scenes[2]?.id ?? null
  };
}

async function assertFileExists(projectRelativePath) {
  const absolutePath = join(projectRoot, projectRelativePath);
  await access(absolutePath);
  return absolutePath;
}

async function main() {
  const { apiBuildRoot } = await ensureBuildArtifacts();
  const deps = await loadDependencies(apiBuildRoot);

  try {
    await cleanupPreviousSmokeData(deps.prisma);
    const channel = await ensureSmokeChannel(deps.prisma);
    const baseAsset = await ensureBaseAsset(deps.prisma);
    const fixtures = await seedSmokeProject(deps.prisma, channel.id, baseAsset.id);

    assert(fixtures.generatedOnlySceneId, "Smoke project did not create generated-only scene.");
    assert(fixtures.assetOnlySceneId, "Smoke project did not create asset-only scene.");
    assert(fixtures.fallbackSceneId, "Smoke project did not create fallback scene.");

    const assetRepository = deps.createPrismaAssetRepository();
    const channelRepository = deps.createPrismaChannelRepository();
    const characterRepository = deps.createPrismaCharacterRepository();
    const projectRepository = deps.createPrismaProjectRepository();
    const visualJobRepository = deps.createPrismaVisualGenerationJobRepository();

    log("Generating mock visual for generated_only scene.");
    const generatedOnlyResult = await deps.generateVisualForScene(
      projectRepository,
      assetRepository,
      characterRepository,
      visualJobRepository,
      fixtures.generatedOnlySceneId,
      {
        provider: "mock-svg",
        visualSourceMode: "generated_only",
        characterProfileId: null,
        workflowPackId: "cinematic_story",
        qualityPresetId: "standard",
        workflowId: "txt2img-basic",
        seedMode: "fixed",
        steps: 20,
        cfg: 2.8,
        sampler: "res_multistep",
        scheduler: "simple",
        denoise: 0.75,
        width: 1080,
        height: 1920,
        seed: 5151,
        autoAttach: true
      }
    );

    log("Generating mock visual for fallback_generated scene.");
    const fallbackResult = await deps.generateVisualForScene(
      projectRepository,
      assetRepository,
      characterRepository,
      visualJobRepository,
      fixtures.fallbackSceneId,
      {
        provider: "mock-svg",
        visualSourceMode: "fallback_generated",
        characterProfileId: null,
        workflowPackId: "cinematic_story",
        qualityPresetId: "standard",
        workflowId: "txt2img-basic",
        seedMode: "fixed",
        steps: 20,
        cfg: 2.8,
        sampler: "res_multistep",
        scheduler: "simple",
        denoise: 0.75,
        width: 1080,
        height: 1920,
        seed: 6161,
        autoAttach: true
      }
    );

    assert(generatedOnlyResult.asset?.path, "Generated-only scene did not create a generated asset.");
    assert(fallbackResult.asset?.path, "Fallback scene did not create a generated asset.");
    await assertFileExists(generatedOnlyResult.asset.path);
    await assertFileExists(fallbackResult.asset.path);

    const checklistResult = await deps.getVideoProjectProductionChecklist(
      projectRepository,
      channelRepository,
      fixtures.projectId
    );

    assert(
      (checklistResult.checklist.missingVisuals ?? checklistResult.checklist.missingAssets) === 0,
      "Production checklist still reports missing visuals."
    );
    assert(
      checklistResult.checklist.visualReadyScenes === 3,
      "Production checklist did not mark all scenes as visually ready."
    );
    assert(
      (checklistResult.checklist.generatedVisualScenes ?? 0) >= 2,
      "Production checklist did not count generated visual scenes."
    );

    const reloadedProject = await projectRepository.getById(fixtures.projectId);
    assert(reloadedProject, "Project could not be reloaded after visual generation.");

    const blueprint = deps.buildRenderBlueprint(
      deps.mapProjectToBlueprintInput(reloadedProject)
    );
    const generatedOnlyScene =
      blueprint.scenes.find((scene) => scene.sceneId === fixtures.generatedOnlySceneId) ??
      null;
    const assetOnlyScene =
      blueprint.scenes.find((scene) => scene.sceneId === fixtures.assetOnlySceneId) ?? null;
    const fallbackScene =
      blueprint.scenes.find((scene) => scene.sceneId === fixtures.fallbackSceneId) ?? null;

    assert(generatedOnlyScene, "Blueprint did not include generated-only scene.");
    assert(assetOnlyScene, "Blueprint did not include asset-only scene.");
    assert(fallbackScene, "Blueprint did not include fallback-generated scene.");

    assert(
      generatedOnlyScene.effectiveAssetId === generatedOnlyResult.asset.id,
      "Generated-only scene did not expose generated asset as effective."
    );
    assert(
      generatedOnlyScene.effectiveAssetSource === "generated_asset",
      "Generated-only scene did not expose generated_asset source."
    );
    assert(
      assetOnlyScene.effectiveAssetId === baseAsset.id,
      "Asset-only scene did not preserve base asset as effective."
    );
    assert(
      assetOnlyScene.effectiveAssetSource === "project_asset",
      "Asset-only scene did not expose project_asset source."
    );
    assert(
      fallbackScene.effectiveAssetId === fallbackResult.asset.id,
      "Fallback scene did not expose generated asset as effective."
    );
    assert(
      fallbackScene.effectiveAssetSource === "fallback_generated",
      "Fallback scene did not expose fallback_generated source."
    );

    printSmokeSummary({
      projectId: fixtures.projectId,
      sceneId: fixtures.generatedOnlySceneId,
      assetOnlySceneId: fixtures.assetOnlySceneId,
      fallbackSceneId: fixtures.fallbackSceneId,
      generatedAssetId: generatedOnlyResult.asset.id,
      fallbackGeneratedAssetId: fallbackResult.asset.id,
      effectiveAssetId: fallbackScene.effectiveAssetId,
      missingVisualCount:
        checklistResult.checklist.missingVisuals ??
        checklistResult.checklist.missingAssets,
      status: "completed"
    });
  } finally {
    await deps.prisma.$disconnect();
  }
}

await main();
