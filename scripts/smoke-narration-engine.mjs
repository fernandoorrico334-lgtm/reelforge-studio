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
const smokeChannelName = "Smoke Narration Channel";
const smokeProjectTitle = "Smoke Narration Project";

function log(message) {
  console.log(`[smoke:narration-engine] ${message}`);
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
    "Run 'npm run build' before running smoke:narration-engine."
  );
  const apiArtifacts = [
    "infrastructure/database/prisma-client.js",
    "modules/assets/infrastructure/prisma-asset-repository.js",
    "modules/projects/infrastructure/prisma-project-repository.js",
    "modules/projects/application/project-render-blueprint-service.js",
    "modules/narration/infrastructure/prisma-narration-job-repository.js",
    "modules/narration/application/narration-service.js"
  ].map((relativePath) => apiArtifactPath(apiBuildRoot, relativePath));

  await ensureArtifactsExist(
    projectRoot,
    [
      "packages/narration-engine/dist/index.js",
      "packages/video-engine/dist/index.js",
      ...apiArtifacts
    ],
    "Run 'npm run build' before running smoke:narration-engine."
  );

  return { apiBuildRoot };
}

async function loadDependencies(apiBuildRoot) {
  const [
    prismaModule,
    assetRepositoryModule,
    projectRepositoryModule,
    renderBlueprintServiceModule,
    narrationJobRepositoryModule,
    narrationServiceModule
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
    )
  ]);

  return {
    prisma: prismaModule.prisma,
    createPrismaAssetRepository: assetRepositoryModule.createPrismaAssetRepository,
    createPrismaProjectRepository:
      projectRepositoryModule.createPrismaProjectRepository,
    createPrismaNarrationJobRepository:
      narrationJobRepositoryModule.createPrismaNarrationJobRepository,
    getVideoProjectRenderBlueprint:
      renderBlueprintServiceModule.getVideoProjectRenderBlueprint,
    generateNarrationForScene: narrationServiceModule.generateNarrationForScene,
    listSceneNarrations: narrationServiceModule.listSceneNarrations
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
      niche: "narration smoke",
      language: "pt-BR",
      visualStyle: "clean narration verification board",
      narrativeTone: "technical and documentary",
      defaultTemplate: "documentary_clean",
      defaultVisualPreset: "calm"
    },
    create: {
      name: smokeChannelName,
      niche: "narration smoke",
      language: "pt-BR",
      visualStyle: "clean narration verification board",
      narrativeTone: "technical and documentary",
      defaultTemplate: "documentary_clean",
      defaultVisualPreset: "calm"
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
        "Projeto de smoke para validar o pipeline local de narracao e blueprint.",
      durationTarget: 10,
      format: "9:16",
      templateId: "cinematic_story",
      defaultCaptionStyle: "documentary_clean",
      scenes: {
        create: [
          {
            order: 1,
            title: "Narration pipeline proof",
            narrationText:
              "Esta cena valida a geracao offline de narracao e o attach automatico do WAV.",
            captionText: "Narracao pronta na cena",
            duration: 4,
            emotion: "CURIOUS",
            visualPreset: "calm",
            visualSourceMode: "asset_only",
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

async function main() {
  const { apiBuildRoot } = await ensureBuildArtifacts();
  const deps = await loadDependencies(apiBuildRoot);

  try {
    await cleanupPreviousSmokeData(deps.prisma);
    const channel = await ensureSmokeChannel(deps.prisma);
    const fixtures = await seedSmokeProject(deps.prisma, channel.id);

    assert(fixtures.sceneId, "Smoke project did not create a scene.");

    const assetRepository = deps.createPrismaAssetRepository();
    const projectRepository = deps.createPrismaProjectRepository();
    const narrationJobRepository = deps.createPrismaNarrationJobRepository();

    log("Generating offline mock narration.");
    const result = await deps.generateNarrationForScene(
      projectRepository,
      assetRepository,
      narrationJobRepository,
      fixtures.sceneId,
      {
        provider: "mock-tts",
        voicePackId: "documentary_ptbr",
        text: null,
        language: "pt-BR",
        autoAttach: true
      }
    );

    assert(result.job.status === "completed", "Narration job did not complete.");
    assert(result.asset?.type === "AUDIO", "Generated narration asset must be AUDIO.");
    assert(result.scene?.generatedNarrationAssetId === result.asset?.id, "Scene did not auto-attach generated narration.");

    const outputPath = result.job.outputPath ?? result.asset?.path ?? null;
    assert(outputPath, "Narration job did not produce an output path.");
    const absoluteOutputPath = await assertFileExists(outputPath);

    const sceneNarrations = await deps.listSceneNarrations(
      projectRepository,
      narrationJobRepository,
      fixtures.sceneId
    );
    assert(
      sceneNarrations.some((item) => item.job.id === result.job.id),
      "Scene narrations list does not include the generated narration job."
    );

    const blueprint = await deps.getVideoProjectRenderBlueprint(
      projectRepository,
      assetRepository,
      fixtures.projectId
    );
    const blueprintScene = blueprint.scenes.find(
      (scene) => scene.sceneId === fixtures.sceneId
    );

    assert(blueprintScene, "Render blueprint scene was not found.");
    assert(
      blueprintScene.effectiveNarrationAssetId === result.asset?.id,
      "Blueprint effective narration asset did not match generated narration."
    );
    assert(
      blueprintScene.effectiveNarrationAssetPath === outputPath,
      "Blueprint effective narration path did not match generated narration."
    );

    printSmokeSummary({
      smoke: "narration-engine",
      projectId: fixtures.projectId,
      sceneId: fixtures.sceneId,
      jobId: result.job.id,
      generatedAssetId: result.asset?.id ?? null,
      outputPath,
      absoluteOutputPath,
      durationSeconds: result.job.durationSeconds,
      status: result.job.status
    });
  } finally {
    await deps.prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("[smoke:narration-engine] failed", error);
  process.exitCode = 1;
});
