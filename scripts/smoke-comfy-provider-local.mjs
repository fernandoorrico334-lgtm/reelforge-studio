import { access } from "node:fs/promises";
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
const smokeChannelName = "Smoke Comfy Provider Channel";
const smokeCharacterSlug = "smoke-comfy-provider-host";
const smokeProjectTitle = "Smoke Comfy Provider Project";
const smokeReferenceFilename = "smoke-comfy-provider-reference.png";

async function importModule(relativePath) {
  return import(pathToFileURL(join(projectRoot, relativePath)).href);
}

async function ensureBuildArtifacts() {
  const apiBuildRoot = await resolveApiBuildRoot(
    projectRoot,
    "Run 'npm run build' before running smoke:comfy-provider:local."
  );
  const apiArtifacts = [
    "config/env.js",
    "infrastructure/database/prisma-client.js",
    "modules/assets/infrastructure/prisma-asset-repository.js",
    "modules/characters/infrastructure/prisma-character-repository.js",
    "modules/projects/infrastructure/prisma-project-repository.js",
    "modules/projects/application/project-video-engine-mapper.js",
    "modules/hybrid-visual/infrastructure/prisma-visual-generation-job-repository.js",
    "modules/hybrid-visual/infrastructure/visual-generation-provider-registry.js",
    "modules/hybrid-visual/application/hybrid-visual-service.js"
  ].map((relativePath) => apiArtifactPath(apiBuildRoot, relativePath));

  await ensureArtifactsExist(
    projectRoot,
    ["packages/video-engine/dist/index.js", ...apiArtifacts],
    "Run 'npm run build' before running smoke:comfy-provider:local."
  );

  return { apiBuildRoot };
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function loadDependencies(apiBuildRoot) {
  const [
    envModule,
    prismaModule,
    assetRepositoryModule,
    characterRepositoryModule,
    projectRepositoryModule,
    projectMapperModule,
    visualJobRepositoryModule,
    providerRegistryModule,
    hybridVisualServiceModule,
    videoEngineModule
  ] = await Promise.all([
    importModule(apiArtifactPath(apiBuildRoot, "config/env.js")),
    importModule(
      apiArtifactPath(apiBuildRoot, "infrastructure/database/prisma-client.js")
    ),
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
        "modules/hybrid-visual/infrastructure/visual-generation-provider-registry.js"
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
    loadEnv: envModule.loadEnv,
    prisma: prismaModule.prisma,
    createPrismaAssetRepository: assetRepositoryModule.createPrismaAssetRepository,
    createPrismaCharacterRepository:
      characterRepositoryModule.createPrismaCharacterRepository,
    createPrismaProjectRepository:
      projectRepositoryModule.createPrismaProjectRepository,
    mapProjectToBlueprintInput: projectMapperModule.mapProjectToBlueprintInput,
    createPrismaVisualGenerationJobRepository:
      visualJobRepositoryModule.createPrismaVisualGenerationJobRepository,
    getComfyUiProviderStatus: providerRegistryModule.getComfyUiProviderStatus,
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
      niche: "Smoke validation for ComfyUI local provider",
      language: "pt-BR",
      visualStyle: "Cinematic local generation with deterministic fallback",
      narrativeTone: "Editoral e atmosferico",
      defaultTemplate: "mystery_doc",
      defaultVisualPreset: "mystery"
    },
    create: {
      name: smokeChannelName,
      niche: "Smoke validation for ComfyUI local provider",
      language: "pt-BR",
      visualStyle: "Cinematic local generation with deterministic fallback",
      narrativeTone: "Editoral e atmosferico",
      defaultTemplate: "mystery_doc",
      defaultVisualPreset: "mystery"
    }
  });
}

async function seedSmokeFixtures(prismaClient, channelId, referenceAssetPath) {
  const referenceAsset = await prismaClient.asset.create({
    data: {
      filename: smokeReferenceFilename,
      originalName: smokeReferenceFilename,
      path: referenceAssetPath,
      type: "IMAGE",
      category: "REFERENCE",
      franchise: "Smoke Files",
      character: "Comfy Provider Host",
      emotion: "MYSTERIOUS",
      tags: JSON.stringify(["reference", "comfy", "smoke"]),
      licenseType: "local-generated",
      copyrightRisk: "LOW",
      recommendedUse: "Comfy provider smoke reference",
      width: 1080,
      height: 1920,
      mimeType: "image/png",
      extension: ".png",
      fileSize: 1024,
      sourceProvider: "manual-intake"
    }
  });

  const characterProfile = await prismaClient.characterProfile.create({
    data: {
      name: "Comfy Provider Host",
      slug: smokeCharacterSlug,
      franchise: "Smoke Files",
      category: "host",
      description: "Host recorrente usado para validar o provider local.",
      basePrompt:
        "editorial host portrait, atmospheric archive lighting, vertical frame",
      negativePrompt:
        "watermark, brand logo, extra fingers, deformed anatomy",
      styleNotes: "Priorizar luz teal, neblina suave e contraste cinematografico.",
      defaultVisualStyle: "mystery",
      referenceStrength: 0.82,
      preferredProvider: "comfyui-local",
      tags: JSON.stringify(["host", "comfy", "smoke"])
    }
  });

  await prismaClient.characterReference.create({
    data: {
      characterProfileId: characterProfile.id,
      assetId: referenceAsset.id,
      sourcePath: referenceAssetPath,
      title: "Comfy Provider Host Reference",
      notes: "Reference used by the local ComfyUI smoke test.",
      referenceType: "face",
      strength: 0.82
    }
  });

  const project = await prismaClient.videoProject.create({
    data: {
      title: smokeProjectTitle,
      status: "SCENE_PLANNING",
      channelId,
      script: "Projeto usado para validar o provider local do ComfyUI.",
      durationTarget: 12,
      format: "9:16",
      templateId: "mystery_doc",
      defaultCaptionStyle: "documentary_clean",
      scenes: {
        create: [
          {
            order: 1,
            title: "Arquivo sob luz teal",
            narrationText:
              "Um host editorial observa o arquivo enquanto o ambiente pulsa em neon suave.",
            captionText: "Arquivo sob controle",
            duration: 4,
            emotion: "MYSTERIOUS",
            characterProfileId: characterProfile.id,
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
    sceneId: project.scenes[0]?.id,
    characterProfileId: characterProfile.id
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
  const appEnv = deps.loadEnv();
  const providerStatus = await deps.getComfyUiProviderStatus(appEnv);

  if (!appEnv.comfyUiEnabled) {
    printSmokeSummary({
      comfyUiEnabled: false,
      message: "COMFYUI_ENABLED=false. Skipping local smoke test.",
      finalStatus: "skipped"
    });
    await deps.prisma.$disconnect();
    return;
  }

  if (!providerStatus.reachable) {
    printSmokeSummary({
      comfyUiEnabled: true,
      baseUrl: appEnv.comfyUiBaseUrl,
      message: providerStatus.message,
      finalStatus: "skipped"
    });
    await deps.prisma.$disconnect();
    return;
  }

  try {
    await cleanupPreviousSmokeData(deps.prisma);
    const channel = await ensureSmokeChannel(deps.prisma);
    const referenceAssetPath = "storage/assets/generated/visuals/smoke-comfy-provider-reference.png";
    await writeMinimalPng(join(projectRoot, referenceAssetPath), "comfy-provider");
    const fixtures = await seedSmokeFixtures(
      deps.prisma,
      channel.id,
      referenceAssetPath
    );

    const assetRepository = deps.createPrismaAssetRepository();
    const characterRepository = deps.createPrismaCharacterRepository();
    const projectRepository = deps.createPrismaProjectRepository();
    const visualJobRepository = deps.createPrismaVisualGenerationJobRepository();

    const result = await deps.generateVisualForScene(
      projectRepository,
      assetRepository,
      characterRepository,
      visualJobRepository,
      fixtures.sceneId,
      {
        provider: "comfyui-local",
        visualSourceMode: "generated_only",
        characterProfileId: fixtures.characterProfileId,
        width: 1080,
        height: 1920,
        seed: 707,
        autoAttach: true
      },
      appEnv
    );

    assert(result.asset?.path, "ComfyUI smoke did not create a generated asset.");
    assert(
      result.asset.path.endsWith(".png"),
      "ComfyUI smoke asset must persist as PNG."
    );
    await assertFileExists(result.asset.path);

    const project = await projectRepository.getById(fixtures.projectId);
    const blueprint = deps.buildRenderBlueprint(
      deps.mapProjectToBlueprintInput(project)
    );

    assert(project, "Smoke project could not be reloaded after generation.");
    assert(
      project.scenes[0]?.generatedAssetId,
      "Generated asset was not attached back to the scene."
    );
    assert(
      blueprint.scenes[0]?.effectiveAssetId,
      "Render blueprint did not expose an effective generated asset."
    );

    printSmokeSummary({
      projectId: fixtures.projectId,
      sceneId: fixtures.sceneId,
      generatedAssetId: result.asset.id,
      outputPath: result.asset.path,
      promptId: result.job.metadata?.promptId ?? null,
      effectiveAssetId: blueprint.scenes[0]?.effectiveAssetId ?? null,
      workflowTemplate: appEnv.comfyUiDefaultWorkflow,
      finalStatus: "completed"
    });
  } finally {
    await deps.prisma.$disconnect();
  }
}

await main();
