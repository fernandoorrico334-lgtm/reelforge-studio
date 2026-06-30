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
const smokeChannelName = "Smoke Hybrid Render Ready Channel";
const smokeCharacterSlug = "smoke-render-ready-host";
const smokeProjectTitle = "Smoke Hybrid Visual Render Ready";
const smokeReferenceFilename = "smoke-render-ready-reference.png";

function log(message) {
  console.log(`[smoke:hybrid-visual:render-ready] ${message}`);
}

async function importModule(relativePath) {
  return import(pathToFileURL(join(projectRoot, relativePath)).href);
}

async function ensureBuildArtifacts() {
  const apiBuildRoot = await resolveApiBuildRoot(
    projectRoot,
    "Run 'npm run build' before running smoke:hybrid-visual:render-ready."
  );
  const apiArtifacts = [
    "infrastructure/database/prisma-client.js",
    "modules/assets/infrastructure/prisma-asset-repository.js",
    "modules/characters/infrastructure/prisma-character-repository.js",
    "modules/projects/infrastructure/prisma-project-repository.js",
    "modules/projects/application/project-video-engine-mapper.js",
    "modules/hybrid-visual/infrastructure/prisma-visual-generation-job-repository.js",
    "modules/hybrid-visual/application/hybrid-visual-service.js"
  ].map((relativePath) => apiArtifactPath(apiBuildRoot, relativePath));

  await ensureArtifactsExist(
    projectRoot,
    [
      "packages/hybrid-visual-engine/dist/index.js",
      "packages/video-engine/dist/index.js",
      ...apiArtifacts
    ],
    "Run 'npm run build' before running smoke:hybrid-visual:render-ready."
  );

  return { apiBuildRoot };
}

async function loadSmokeDependencies(apiBuildRoot) {
  const [
    prismaModule,
    assetRepositoryModule,
    characterRepositoryModule,
    projectRepositoryModule,
    projectMapperModule,
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
    createPrismaVisualGenerationJobRepository:
      visualJobRepositoryModule.createPrismaVisualGenerationJobRepository,
    generateMissingVisualsForProject:
      hybridVisualServiceModule.generateMissingVisualsForProject,
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
    where: {
      OR: [
        { filename: smokeReferenceFilename },
        { id: { in: previousGeneratedAssetIds } }
      ]
    }
  });
}

async function ensureSmokeChannel(prismaClient) {
  return prismaClient.channel.upsert({
    where: {
      name: smokeChannelName
    },
    update: {
      niche: "Smoke validation for render-ready hybrid visuals",
      language: "pt-BR",
      visualStyle: "Teal mystery overlays and editorial documentary lighting",
      narrativeTone: "Tenso e investigativo",
      defaultTemplate: "mystery_doc",
      defaultVisualPreset: "mystery"
    },
    create: {
      name: smokeChannelName,
      niche: "Smoke validation for render-ready hybrid visuals",
      language: "pt-BR",
      visualStyle: "Teal mystery overlays and editorial documentary lighting",
      narrativeTone: "Tenso e investigativo",
      defaultTemplate: "mystery_doc",
      defaultVisualPreset: "mystery"
    }
  });
}

async function seedSmokeFixtures(prismaClient, channelId) {
  const referenceAsset = await prismaClient.asset.create({
    data: {
      filename: smokeReferenceFilename,
      originalName: smokeReferenceFilename,
      path: "storage/assets/character/image/smoke-render-ready-reference.png",
      type: "IMAGE",
      category: "REFERENCE",
      franchise: "Smoke Files",
      character: "Render Ready Host",
      emotion: "MYSTERIOUS",
      tags: JSON.stringify(["reference", "render-ready", "smoke"]),
      licenseType: "local-generated",
      copyrightRisk: "LOW",
      recommendedUse: "Hybrid render-ready reference",
      width: 1080,
      height: 1920,
      mimeType: "image/png",
      extension: ".png",
      fileSize: 212000,
      sourceProvider: "manual-intake"
    }
  });

  const characterProfile = await prismaClient.characterProfile.create({
    data: {
      name: "Render Ready Host",
      slug: smokeCharacterSlug,
      franchise: "Smoke Files",
      category: "host",
      description: "Figura recorrente com enquadramento vertical e atmosfera noir.",
      basePrompt:
        "archivist host, noir vertical poster, documentary mystery composition",
      negativePrompt:
        "watermark, logo, deformed hands, unreadable text, low detail",
      styleNotes: "Misturar grids luminosos, contraste escuro e accento teal.",
      defaultVisualStyle: "mystery",
      referenceStrength: 0.88,
      preferredProvider: "mock-svg",
      tags: JSON.stringify(["host", "mystery", "render-ready"])
    }
  });

  await prismaClient.characterReference.create({
    data: {
      characterProfileId: characterProfile.id,
      assetId: referenceAsset.id,
      sourcePath: referenceAsset.path,
      title: "Render Ready Host Reference",
      notes: "Reference for the render-ready hybrid visual smoke.",
      referenceType: "face",
      strength: 0.88
    }
  });

  const project = await prismaClient.videoProject.create({
    data: {
      title: smokeProjectTitle,
      status: "SCENE_PLANNING",
      channelId,
      script:
        "Smoke project that validates generated visuals can become render-ready effective assets.",
      durationTarget: 15,
      format: "9:16",
      templateId: "mystery_doc",
      defaultCaptionStyle: "documentary_clean",
      scenes: {
        create: [
          {
            order: 1,
            title: "Cold open no archive",
            narrationText:
              "The opening has no base asset and must rely on a generated render-ready visual.",
            captionText: "Opening without base asset",
            duration: 4,
            emotion: "MYSTERIOUS",
            characterProfileId: characterProfile.id,
            visualPreset: "mystery",
            visualSourceMode: "generated_only",
            transition: "fade"
          },
          {
            order: 2,
            title: "Reference wall",
            narrationText:
              "The second scene keeps the manual reference as the primary source.",
            captionText: "Reference stays primary",
            duration: 5,
            emotion: "CURIOUS",
            assetId: referenceAsset.id,
            characterProfileId: characterProfile.id,
            visualPreset: "calm",
            visualSourceMode: "fallback_generated",
            transition: "hard-cut"
          },
          {
            order: 3,
            title: "Manual prompt escalation",
            narrationText:
              "The third scene carries a manual prompt and should use the generated asset when available.",
            captionText: "Prompt-driven escalation",
            duration: 4,
            emotion: "TENSE",
            characterProfileId: characterProfile.id,
            visualPreset: "suspense",
            visualSourceMode: "mixed_sequence",
            visualPrompt:
              "Vertical suspense key art with archive screens, teal beams and looming silhouette.",
            transition: "fast_fade"
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
    characterProfileId: characterProfile.id,
    sceneIds: project.scenes.map((scene) => scene.id)
  };
}

async function assertFileExists(projectRelativePath) {
  const absolutePath = join(projectRoot, projectRelativePath);
  await access(absolutePath);
  return absolutePath;
}

async function main() {
  const { apiBuildRoot } = await ensureBuildArtifacts();
  const deps = await loadSmokeDependencies(apiBuildRoot);

  try {
    await cleanupPreviousSmokeData(deps.prisma);
    const channel = await ensureSmokeChannel(deps.prisma);
    const fixtures = await seedSmokeFixtures(deps.prisma, channel.id);

    const assetRepository = deps.createPrismaAssetRepository();
    const characterRepository = deps.createPrismaCharacterRepository();
    const projectRepository = deps.createPrismaProjectRepository();
    const visualJobRepository = deps.createPrismaVisualGenerationJobRepository();

    log("Generating render-ready visuals for the smoke project.");
    const result = await deps.generateMissingVisualsForProject(
      projectRepository,
      assetRepository,
      characterRepository,
      visualJobRepository,
      fixtures.projectId,
      {
        provider: "mock-svg",
        visualSourceMode: null,
        characterProfileId: fixtures.characterProfileId,
        width: 1080,
        height: 1920,
        seed: 404,
        autoAttach: true,
        maxScenes: 5
      }
    );

    const project = await projectRepository.getById(fixtures.projectId);
    const jobs = await visualJobRepository.list({
      videoProjectId: fixtures.projectId
    });

    if (!project) {
      throw new Error("Smoke project could not be reloaded after visual generation.");
    }

    if (jobs.length < 2 || jobs.some((job) => job.status !== "completed")) {
      throw new Error("Render-ready smoke did not complete the expected visual jobs.");
    }

    const generatedScenes = project.scenes.filter((scene) => scene.generatedAssetId);

    if (generatedScenes.length < 2) {
      throw new Error("Expected at least two scenes with generatedAssetId.");
    }

    for (const scene of generatedScenes) {
      if (!scene.generatedAsset?.path?.endsWith(".png")) {
        throw new Error(`Scene ${scene.order} did not persist a PNG generated asset.`);
      }

      if (scene.generatedAsset.width !== 1080 || scene.generatedAsset.height !== 1920) {
        throw new Error(`Scene ${scene.order} generated asset has invalid dimensions.`);
      }

      await assertFileExists(scene.generatedAsset.path);
    }

    for (const job of jobs) {
      if (job.metadata?.renderReady !== true) {
        throw new Error(`Visual job ${job.id} did not persist renderReady=true.`);
      }

      if (typeof job.metadata?.debugSvgPath !== "string") {
        throw new Error(`Visual job ${job.id} did not persist debugSvgPath.`);
      }

      await assertFileExists(job.outputPath);
      await assertFileExists(job.metadata.debugSvgPath);
    }

    const blueprint = deps.buildRenderBlueprint(
      deps.mapProjectToBlueprintInput(project)
    );
    const effectiveScenes = blueprint.scenes.filter(
      (scene) => scene.effectiveAssetId && scene.effectiveAssetPath
    );
    const generatedEffectiveScene = blueprint.scenes.find(
      (scene) => scene.effectiveAssetSource === "generated_asset"
    );

    if (effectiveScenes.length < 2) {
      throw new Error("Render blueprint did not expose enough effective assets.");
    }

    if (!generatedEffectiveScene) {
      throw new Error("Render blueprint did not mark any scene as generated.");
    }

    printSmokeSummary({
      projectId: fixtures.projectId,
      jobsCreated: jobs.length,
      generatedAssetIds: generatedScenes
        .map((scene) => scene.generatedAssetId)
        .filter((value) => typeof value === "string"),
      pngPaths: generatedScenes
        .map((scene) => scene.generatedAsset?.path)
        .filter((value) => typeof value === "string"),
      effectiveAssetCount: effectiveScenes.length,
      effectiveAssetSources: blueprint.scenes.map((scene) => ({
        sceneId: scene.sceneId,
        source: scene.effectiveAssetSource,
        effectiveAssetId: scene.effectiveAssetId
      })),
      generatedCount: result.generatedCount,
      finalStatus: "completed"
    });
  } finally {
    await deps.prisma.$disconnect();
  }
}

await main();

