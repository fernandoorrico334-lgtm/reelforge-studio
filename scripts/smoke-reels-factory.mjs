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
const smokeChannelName = "Smoke Reels Factory Channel";

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
    "Run 'npm run build' before running smoke:reels-factory."
  );
  const apiArtifacts = [
    "infrastructure/database/prisma-client.js",
    "modules/channels/infrastructure/prisma-channel-repository.js",
    "modules/projects/infrastructure/prisma-project-repository.js",
    "modules/reels-factory/application/reels-factory-service.js"
  ].map((relativePath) => apiArtifactPath(apiBuildRoot, relativePath));

  await ensureArtifactsExist(
    projectRoot,
    ["packages/story-engine/dist/index.js", ...apiArtifacts],
    "Run 'npm run build' before running smoke:reels-factory."
  );

  return { apiBuildRoot };
}

async function loadDependencies(apiBuildRoot) {
  const [
    prismaModule,
    channelRepositoryModule,
    projectRepositoryModule,
    reelsFactoryServiceModule
  ] = await Promise.all([
    importModule(apiArtifactPath(apiBuildRoot, "infrastructure/database/prisma-client.js")),
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
        "modules/reels-factory/application/reels-factory-service.js"
      )
    )
  ]);

  return {
    prisma: prismaModule.prisma,
    createPrismaChannelRepository:
      channelRepositoryModule.createPrismaChannelRepository,
    createPrismaProjectRepository:
      projectRepositoryModule.createPrismaProjectRepository,
    listReelsFactoryTemplates:
      reelsFactoryServiceModule.listReelsFactoryTemplates,
    previewReelsFactory: reelsFactoryServiceModule.previewReelsFactory,
    createReelsFactoryProject:
      reelsFactoryServiceModule.createReelsFactoryProject,
    createReelsFactoryBatch: reelsFactoryServiceModule.createReelsFactoryBatch
  };
}

async function ensureSmokeChannel(prismaClient) {
  return prismaClient.channel.upsert({
    where: { name: smokeChannelName },
    update: {
      niche: "sports reels smoke",
      language: "pt-BR",
      visualStyle: "editorial football board with dramatic graphics",
      narrativeTone: "hype and tactical warning",
      defaultTemplate: "sports_hype",
      defaultVisualPreset: "action"
    },
    create: {
      name: smokeChannelName,
      niche: "sports reels smoke",
      language: "pt-BR",
      visualStyle: "editorial football board with dramatic graphics",
      narrativeTone: "hype and tactical warning",
      defaultTemplate: "sports_hype",
      defaultVisualPreset: "action"
    }
  });
}

async function cleanupPreviousSmokeData(prismaClient, channelId) {
  const previousProjects = await prismaClient.videoProject.findMany({
    where: { channelId },
    select: { id: true }
  });
  const previousProjectIds = previousProjects.map((project) => project.id);

  if (previousProjectIds.length === 0) {
    return;
  }

  await prismaClient.scene.deleteMany({
    where: { videoProjectId: { in: previousProjectIds } }
  });
  await prismaClient.videoProject.deleteMany({
    where: { id: { in: previousProjectIds } }
  });
}

async function main() {
  const { apiBuildRoot } = await ensureBuildArtifacts();
  const deps = await loadDependencies(apiBuildRoot);

  try {
    const smokeChannel = await ensureSmokeChannel(deps.prisma);
    await cleanupPreviousSmokeData(deps.prisma, smokeChannel.id);

    const channelRepository = deps.createPrismaChannelRepository();
    const projectRepository = deps.createPrismaProjectRepository();
    const templates = await deps.listReelsFactoryTemplates();

    assert(templates.length >= 8, "Reels Factory templates catalog is incomplete.");

    const preview = await deps.previewReelsFactory({
      channelId: smokeChannel.id,
      topic: "Haaland contra o Brasil",
      subject: "Haaland",
      angle: "por que ele pode ser o maior perigo",
      templateId: "player_threat_analysis",
      tone: "hype",
      durationSeconds: 35,
      language: "pt-BR",
      includeMicroclip: true
    });

    assert(preview.title.trim().length > 0, "Preview title is empty.");
    assert(preview.hook.trim().length > 0, "Preview hook is empty.");
    assert(preview.scenes.length >= 5, "Preview did not create the expected scenes.");
    assert(
      preview.scenes.every((scene) => scene.narrationText.trim().length > 0),
      "At least one preview scene is missing narrationText."
    );
    assert(
      preview.scenes.every((scene) => scene.visualPrompt.trim().length > 0),
      "At least one preview scene is missing visualPrompt."
    );
    assert(preview.caption.trim().length > 0, "Preview caption is empty.");
    assert(preview.hashtags.length > 0, "Preview hashtags are empty.");

    const createdProject = await deps.createReelsFactoryProject(
      projectRepository,
      channelRepository,
      {
        channelId: smokeChannel.id,
        topic: "Haaland contra o Brasil",
        subject: "Haaland",
        angle: "por que ele pode ser o maior perigo",
        templateId: "player_threat_analysis",
        tone: "hype",
        durationSeconds: 35,
        language: "pt-BR",
        includeMicroclip: true
      }
    );

    assert(createdProject.projectId, "Factory project id is missing.");
    assert(
      createdProject.project.scenes.length === createdProject.scenesCreated,
      "Factory project scene count does not match the creation response."
    );
    assert(
      createdProject.project.scenes.every(
        (scene) =>
          Boolean(scene.narrationText?.trim()) &&
          Boolean(scene.visualPrompt?.trim()) &&
          Boolean(scene.visualRecipe?.trim()) &&
          Boolean(scene.narrationVoicePackId?.trim())
      ),
      "Factory project scenes are missing metadata or prompts."
    );

    const firstRecipe = JSON.parse(
      createdProject.project.scenes[0]?.visualRecipe ?? "{}"
    );

    assert(
      firstRecipe.suggestedWorkflowPackId,
      "Factory scene recipe is missing workflow pack metadata."
    );
    assert(
      Array.isArray(firstRecipe.recommendedNextActions) &&
        firstRecipe.recommendedNextActions.length > 0,
      "Factory scene recipe is missing recommendedNextActions."
    );

    const batchResult = await deps.createReelsFactoryBatch(
      projectRepository,
      channelRepository,
      {
        channelId: smokeChannel.id,
        templateId: "player_threat_analysis",
        tone: "hype",
        durationSeconds: 35,
        language: "pt-BR",
        includeMicroclip: true,
        items: [
          {
            topic: "Haaland contra o Brasil",
            subject: "Haaland",
            angle: "o perigo fisico"
          },
          {
            topic: "Messi decide de novo",
            subject: "Messi",
            angle: "por que ele ainda muda jogos"
          }
        ]
      }
    );

    assert(
      batchResult.totalCreated === 2,
      `Expected totalCreated=2, received ${batchResult.totalCreated}.`
    );
    assert(
      batchResult.failures.length === 0,
      "Batch creation returned failures for the smoke scenario."
    );

    printSmokeSummary({
      smoke: "reels-factory",
      previewTitle: preview.title,
      projectId: createdProject.projectId,
      scenesCreated: createdProject.scenesCreated,
      batchProjectIds: batchResult.projects.map((project) => project.projectId),
      status: "completed"
    });
  } finally {
    await deps.prisma.$disconnect();
  }
}

await main();
