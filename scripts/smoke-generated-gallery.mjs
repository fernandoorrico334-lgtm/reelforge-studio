import { access } from "node:fs/promises";
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
const smokeChannelName = "Smoke Generated Gallery Channel";
const smokeProjectTitle = "Smoke Generated Gallery Project";

function log(message) {
  console.log(`[smoke:generated-gallery] ${message}`);
}

async function importModule(relativePath) {
  return import(pathToFileURL(join(projectRoot, relativePath)).href);
}

async function ensureBuildArtifacts() {
  const apiBuildRoot = await resolveApiBuildRoot(
    projectRoot,
    "Run 'npm run build' before running smoke:generated-gallery."
  );
  const apiArtifacts = [
    "infrastructure/database/prisma-client.js",
    "modules/assets/infrastructure/prisma-asset-repository.js",
    "modules/characters/infrastructure/prisma-character-repository.js",
    "modules/projects/infrastructure/prisma-project-repository.js",
    "modules/projects/application/project-video-engine-mapper.js",
    "modules/research/infrastructure/prisma-research-repository.js",
    "modules/hybrid-visual/infrastructure/prisma-visual-generation-job-repository.js",
    "modules/hybrid-visual/application/hybrid-visual-service.js"
  ].map((relativePath) => apiArtifactPath(apiBuildRoot, relativePath));

  await ensureArtifactsExist(
    projectRoot,
    ["packages/video-engine/dist/index.js", ...apiArtifacts],
    "Run 'npm run build' before running smoke:generated-gallery."
  );

  return { apiBuildRoot };
}

async function loadDependencies(apiBuildRoot) {
  const [
    prismaModule,
    assetRepositoryModule,
    characterRepositoryModule,
    projectRepositoryModule,
    projectMapperModule,
    researchRepositoryModule,
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
        "modules/research/infrastructure/prisma-research-repository.js"
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
    createPrismaCharacterRepository:
      characterRepositoryModule.createPrismaCharacterRepository,
    createPrismaProjectRepository:
      projectRepositoryModule.createPrismaProjectRepository,
    mapProjectToBlueprintInput: projectMapperModule.mapProjectToBlueprintInput,
    createPrismaResearchRepository:
      researchRepositoryModule.createPrismaResearchRepository,
    createPrismaVisualGenerationJobRepository:
      visualJobRepositoryModule.createPrismaVisualGenerationJobRepository,
    generateVisualForScene: hybridVisualServiceModule.generateVisualForScene,
    listSceneGeneratedImages: hybridVisualServiceModule.listSceneGeneratedImages,
    markVisualGenerationJobReviewed:
      hybridVisualServiceModule.markVisualGenerationJobReviewed,
    useGeneratedImageForScene:
      hybridVisualServiceModule.useGeneratedImageForScene,
    regenerateVisualGenerationJob:
      hybridVisualServiceModule.regenerateVisualGenerationJob,
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
    where: { id: { in: previousGeneratedAssetIds } }
  });
}

async function ensureSmokeChannel(prismaClient) {
  return prismaClient.channel.upsert({
    where: { name: smokeChannelName },
    update: {
      niche: "gallery review smoke",
      language: "pt-BR",
      visualStyle: "clean review board with cinematic generated stills",
      narrativeTone: "editorial and technical",
      defaultTemplate: "cinematic_story",
      defaultVisualPreset: "mystery"
    },
    create: {
      name: smokeChannelName,
      niche: "gallery review smoke",
      language: "pt-BR",
      visualStyle: "clean review board with cinematic generated stills",
      narrativeTone: "editorial and technical",
      defaultTemplate: "cinematic_story",
      defaultVisualPreset: "mystery"
    }
  });
}

async function seedSmokeProject(prismaClient, channelId) {
  const project = await prismaClient.videoProject.create({
    data: {
      title: smokeProjectTitle,
      status: "SCENE_PLANNING",
      channelId,
      script:
        "Projeto de smoke para validar galeria, review e promocao de imagens geradas.",
      durationTarget: 12,
      format: "9:16",
      templateId: "cinematic_story",
      defaultCaptionStyle: "documentary_clean",
      scenes: {
        create: [
          {
            order: 1,
            title: "Gallery choice moment",
            narrationText:
              "A equipe compara duas geracoes e escolhe a melhor antes do render.",
            captionText: "Escolha da imagem final",
            duration: 4,
            emotion: "MYSTERIOUS",
            visualPreset: "mystery",
            visualSourceMode: "generated_only",
            transition: "fade"
          }
        ]
      }
    },
    include: {
      scenes: true
    }
  });

  return {
    projectId: project.id,
    sceneId: project.scenes[0]?.id ?? null
  };
}

async function assertFileExists(projectRelativePath) {
  const absolutePath = join(projectRoot, projectRelativePath);
  await access(absolutePath);
  return absolutePath;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  const { apiBuildRoot } = await ensureBuildArtifacts();
  const deps = await loadDependencies(apiBuildRoot);

  try {
    await cleanupPreviousSmokeData(deps.prisma);
    const channel = await ensureSmokeChannel(deps.prisma);
    const fixtures = await seedSmokeProject(deps.prisma, channel.id);

    assert(fixtures.sceneId, "Smoke project did not create a scene.");

    const assetRepository = deps.createPrismaAssetRepository();
    const characterRepository = deps.createPrismaCharacterRepository();
    const projectRepository = deps.createPrismaProjectRepository();
    const researchRepository = deps.createPrismaResearchRepository();
    const visualJobRepository = deps.createPrismaVisualGenerationJobRepository();

    log("Generating first image.");
    const firstResult = await deps.generateVisualForScene(
      projectRepository,
      assetRepository,
      characterRepository,
      visualJobRepository,
      fixtures.sceneId,
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
        seed: 111,
        autoAttach: true
      }
    );

    log("Generating second image.");
    const secondResult = await deps.generateVisualForScene(
      projectRepository,
      assetRepository,
      characterRepository,
      visualJobRepository,
      fixtures.sceneId,
      {
        provider: "mock-svg",
        visualSourceMode: "generated_only",
        characterProfileId: null,
        workflowPackId: "anime_dark",
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
        seed: 222,
        autoAttach: true
      }
    );

    assert(firstResult.asset?.path, "First generation did not create an asset.");
    assert(secondResult.asset?.path, "Second generation did not create an asset.");
    await assertFileExists(firstResult.asset.path);
    await assertFileExists(secondResult.asset.path);

    log("Listing generated images for the scene.");
    const listedItems = await deps.listSceneGeneratedImages(
      visualJobRepository,
      projectRepository,
      fixtures.sceneId
    );

    assert(listedItems.length >= 2, "Scene gallery did not return at least two images.");

    log("Marking the first generated job as favorite.");
    const reviewedJob = await deps.markVisualGenerationJobReviewed(
      visualJobRepository,
      firstResult.job.id,
      {
        reviewStatus: "favorite",
        notes: "Best framing for smoke gallery."
      }
    );

    assert(
      reviewedJob.metadata?.reviewStatus === "favorite",
      "Favorite review status was not persisted."
    );

    log("Promoting the first generated image back to the scene.");
    const selectedScene = await deps.useGeneratedImageForScene(
      projectRepository,
      assetRepository,
      visualJobRepository,
      fixtures.sceneId,
      firstResult.asset.id
    );

    assert(
      selectedScene.scene.generatedAssetId === firstResult.asset.id,
      "Scene generatedAssetId was not updated by use-generated-image."
    );

    const reloadedProject = await projectRepository.getById(fixtures.projectId);
    assert(reloadedProject, "Project could not be reloaded after selecting the generated image.");

    const firstBlueprint = deps.buildRenderBlueprint(
      deps.mapProjectToBlueprintInput(reloadedProject)
    );
    const blueprintScene = firstBlueprint.scenes[0] ?? null;

    assert(blueprintScene, "Render blueprint did not include the smoke scene.");
    assert(
      blueprintScene.effectiveAssetId === firstResult.asset.id,
      "Render blueprint did not switch to the selected generated image."
    );

    log("Regenerating from the first job.");
    const regeneratedResult = await deps.regenerateVisualGenerationJob(
      projectRepository,
      researchRepository,
      assetRepository,
      characterRepository,
      visualJobRepository,
      firstResult.job.id,
      {
        seedMode: "random",
        workflowPackId: "cinematic_story",
        qualityPresetId: "standard"
      }
    );

    assert(
      regeneratedResult.job.id !== firstResult.job.id,
      "Regeneration did not create a new visual generation job."
    );
    assert(
      regeneratedResult.asset?.id,
      "Regeneration did not create a new generated asset."
    );
    assert(regeneratedResult.asset?.path, "Regeneration asset path is missing.");
    await assertFileExists(regeneratedResult.asset.path);

    const finalProject = await projectRepository.getById(fixtures.projectId);
    assert(finalProject, "Project could not be reloaded after regeneration.");

    const finalBlueprint = deps.buildRenderBlueprint(
      deps.mapProjectToBlueprintInput(finalProject)
    );
    const finalBlueprintScene = finalBlueprint.scenes[0] ?? null;

    assert(
      finalBlueprintScene?.effectiveAssetId === regeneratedResult.asset.id,
      "Render blueprint did not expose the regenerated asset as effective."
    );

    const finalListedItems = await deps.listSceneGeneratedImages(
      visualJobRepository,
      projectRepository,
      fixtures.sceneId
    );

    printSmokeSummary({
      projectId: fixtures.projectId,
      sceneId: fixtures.sceneId,
      generatedCount: finalListedItems.length,
      selectedAssetId: firstResult.asset.id,
      regeneratedJobId: regeneratedResult.job.id,
      finalEffectiveAssetId: finalBlueprintScene?.effectiveAssetId ?? null,
      finalEffectiveAssetPath: finalBlueprintScene?.effectiveAssetPath ?? null,
      status: "completed"
    });
  } finally {
    await deps.prisma.$disconnect();
  }
}

await main();
