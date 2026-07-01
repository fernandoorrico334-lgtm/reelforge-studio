import { stat } from "node:fs/promises";
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
const smokeChannelName = "Smoke Narration Render Plan Channel";
const smokeProjectTitle = "Smoke Narration Render Plan Project";

function log(message) {
  console.log(`[smoke:narration-render-plan] ${message}`);
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
    "Run 'npm run build' before running smoke:narration-render-plan."
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
      "packages/audio-engine/dist/index.js",
      "packages/video-engine/dist/index.js",
      "packages/narration-engine/dist/index.js",
      ...apiArtifacts
    ],
    "Run 'npm run build' before running smoke:narration-render-plan."
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
    generateNarrationForScene: narrationServiceModule.generateNarrationForScene
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
      niche: "narration render planning smoke",
      language: "pt-BR",
      visualStyle: "deterministic storyboard cards",
      narrativeTone: "technical validation",
      defaultTemplate: "documentary_clean",
      defaultVisualPreset: "calm"
    },
    create: {
      name: smokeChannelName,
      niche: "narration render planning smoke",
      language: "pt-BR",
      visualStyle: "deterministic storyboard cards",
      narrativeTone: "technical validation",
      defaultTemplate: "documentary_clean",
      defaultVisualPreset: "calm"
    }
  });
}

async function ensureSceneImageAsset(prismaClient, definition) {
  const relativePath = `storage/assets/smoke/narration-render-plan/${definition.filename}`;
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
      tags: JSON.stringify(["smoke", "narration-render-plan", definition.visualPreset]),
      licenseType: "local-generated",
      copyrightRisk: "LOW",
      recommendedUse: "Narration render plan smoke image",
      duration: null,
      width: 1080,
      height: 1920,
      mimeType: "image/png",
      extension: ".png",
      fileSize: fileStats.size
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
      tags: JSON.stringify(["smoke", "narration-render-plan", definition.visualPreset]),
      licenseType: "local-generated",
      copyrightRisk: "LOW",
      recommendedUse: "Narration render plan smoke image",
      duration: null,
      width: 1080,
      height: 1920,
      mimeType: "image/png",
      extension: ".png",
      fileSize: fileStats.size
    }
  });
}

async function seedSmokeProject(prismaClient, channelId) {
  const sceneDefinitions = [
    {
      filename: "scene-1.png",
      title: "Hook with generated narration",
      narrationText:
        "A primeira cena confirma que a narracao mock vira plano de audio por cena.",
      captionText: "Narracao gerada na abertura",
      duration: 3,
      emotion: "CURIOUS",
      visualPreset: "calm",
      transition: "fade"
    },
    {
      filename: "scene-2.png",
      title: "Middle beat with generated narration",
      narrationText:
        "A segunda cena valida a continuidade da narracao e a marcacao de startTime.",
      captionText: "Segunda narracao mixada",
      duration: 4,
      emotion: "MYSTERIOUS",
      visualPreset: "mystery",
      transition: "hard-cut"
    },
    {
      filename: "scene-3.png",
      title: "Closing beat without narration",
      narrationText: null,
      captionText: "Cena final sem narracao",
      duration: 3,
      emotion: "NEUTRAL",
      visualPreset: "drama",
      transition: "fade"
    }
  ];

  const assets = [];

  for (const definition of sceneDefinitions) {
    assets.push(await ensureSceneImageAsset(prismaClient, definition));
  }

  const project = await prismaClient.videoProject.create({
    data: {
      title: smokeProjectTitle,
      status: "SCENE_PLANNING",
      channelId,
      script:
        "Projeto de smoke para validar blueprint e audio plan com narracoes por cena.",
      durationTarget: 10,
      format: "9:16",
      templateId: "cinematic_story",
      defaultCaptionStyle: "documentary_clean",
      scenes: {
        create: sceneDefinitions.map((definition, index) => ({
          order: index + 1,
          title: definition.title,
          narrationText: definition.narrationText,
          captionText: definition.captionText,
          duration: definition.duration,
          emotion: definition.emotion,
          assetId: assets[index]?.id ?? null,
          visualPreset: definition.visualPreset,
          visualSourceMode: "asset_only",
          transition: definition.transition
        }))
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

async function main() {
  const { apiBuildRoot } = await ensureBuildArtifacts();
  const deps = await loadDependencies(apiBuildRoot);

  try {
    await cleanupPreviousSmokeData(deps.prisma);
    const channel = await ensureSmokeChannel(deps.prisma);
    const fixtures = await seedSmokeProject(deps.prisma, channel.id);

    const assetRepository = deps.createPrismaAssetRepository();
    const projectRepository = deps.createPrismaProjectRepository();
    const narrationJobRepository = deps.createPrismaNarrationJobRepository();

    log("Generating two mock narrations for the smoke project.");
    const narrationResults = [];

    for (const sceneId of fixtures.sceneIds.slice(0, 2)) {
      narrationResults.push(
        await deps.generateNarrationForScene(
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
        )
      );
    }

    const blueprint = await deps.getVideoProjectRenderBlueprint(
      projectRepository,
      assetRepository,
      fixtures.projectId
    );

    assert(
      blueprint.audio.sceneNarrations.length === 2,
      `Expected 2 scene narration tracks, received ${blueprint.audio.sceneNarrations.length}.`
    );

    for (const result of narrationResults) {
      const blueprintScene = blueprint.scenes.find(
        (scene) => scene.sceneId === result.scene?.id
      );

      assert(blueprintScene, `Blueprint scene '${result.scene?.id}' was not found.`);
      assert(
        blueprintScene.narrationReady,
        `Blueprint scene '${blueprintScene.sceneId}' did not mark narrationReady.`
      );
      assert(
        (blueprintScene.effectiveNarrationSource ?? blueprintScene.narrationSource) ===
          "generated",
        `Blueprint scene '${blueprintScene.sceneId}' did not resolve generated narration.`
      );
      assert(
        blueprintScene.effectiveNarrationAssetId === result.asset?.id,
        `Blueprint scene '${blueprintScene.sceneId}' resolved narration asset '${blueprintScene.effectiveNarrationAssetId}' instead of '${result.asset?.id}'.`
      );
    }

    const lastScene = blueprint.scenes.find(
      (scene) => scene.sceneId === fixtures.sceneIds[2]
    );

    assert(lastScene, "The scene without narration was not found in the blueprint.");
    assert(
      !lastScene.narrationReady,
      "The scene without narration should remain valid but not narration-ready."
    );
    assert(
      (lastScene.effectiveNarrationSource ?? lastScene.narrationSource) === "missing",
      "The scene without narration should resolve to missing narration source."
    );
    assert(
      lastScene.ready,
      "The scene without narration should still be considered render-ready for visuals/captions."
    );

    printSmokeSummary({
      smoke: "narration-render-plan",
      projectId: fixtures.projectId,
      sceneIds: fixtures.sceneIds,
      narrationAssetIds: narrationResults.map((result) => result.asset?.id ?? null),
      narrationReadyCount: blueprint.scenes.filter((scene) => scene.narrationReady).length,
      missingNarrationCount: blueprint.scenes.filter((scene) => !scene.narrationReady).length,
      audioSceneNarrationCount: blueprint.audio.sceneNarrations.length,
      status: "completed"
    });
  } finally {
    await deps.prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("[smoke:narration-render-plan] failed", error);
  process.exitCode = 1;
});
