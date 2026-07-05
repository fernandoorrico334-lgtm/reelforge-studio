import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  apiArtifactPath,
  ensureArtifactsExist,
  printSmokeSummary,
  resolveApiBuildRoot
} from "./smoke-utils.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "../..");

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
    "Run 'npm run build' before running production discovery smokes."
  );
  const apiArtifacts = [
    "infrastructure/database/prisma-client.js",
    "modules/assets/infrastructure/prisma-asset-repository.js",
    "modules/channels/infrastructure/prisma-channel-repository.js",
    "modules/intake/infrastructure/prisma-intake-repository.js",
    "modules/projects/infrastructure/prisma-project-repository.js",
    "modules/production-discovery/infrastructure/prisma-production-discovery-repository.js",
    "modules/production-discovery/application/production-discovery-service.js",
    "modules/research/infrastructure/prisma-research-repository.js"
  ].map((relativePath) => apiArtifactPath(apiBuildRoot, relativePath));

  await ensureArtifactsExist(
    projectRoot,
    ["packages/production-discovery-engine/dist/index.js", ...apiArtifacts],
    "Run 'npm run build' before running production discovery smokes."
  );

  return { apiBuildRoot };
}

async function loadDependencies(apiBuildRoot) {
  const [
    prismaModule,
    assetRepositoryModule,
    channelRepositoryModule,
    intakeRepositoryModule,
    projectRepositoryModule,
    productionDiscoveryRepositoryModule,
    productionDiscoveryServiceModule,
    researchRepositoryModule
  ] = await Promise.all([
    importModule(apiArtifactPath(apiBuildRoot, "infrastructure/database/prisma-client.js")),
    importModule(
      apiArtifactPath(apiBuildRoot, "modules/assets/infrastructure/prisma-asset-repository.js")
    ),
    importModule(
      apiArtifactPath(apiBuildRoot, "modules/channels/infrastructure/prisma-channel-repository.js")
    ),
    importModule(
      apiArtifactPath(apiBuildRoot, "modules/intake/infrastructure/prisma-intake-repository.js")
    ),
    importModule(
      apiArtifactPath(apiBuildRoot, "modules/projects/infrastructure/prisma-project-repository.js")
    ),
    importModule(
      apiArtifactPath(
        apiBuildRoot,
        "modules/production-discovery/infrastructure/prisma-production-discovery-repository.js"
      )
    ),
    importModule(
      apiArtifactPath(
        apiBuildRoot,
        "modules/production-discovery/application/production-discovery-service.js"
      )
    ),
    importModule(
      apiArtifactPath(apiBuildRoot, "modules/research/infrastructure/prisma-research-repository.js")
    )
  ]);

  return {
    prisma: prismaModule.prisma,
    createPrismaAssetRepository: assetRepositoryModule.createPrismaAssetRepository,
    createPrismaChannelRepository: channelRepositoryModule.createPrismaChannelRepository,
    createPrismaIntakeRepository: intakeRepositoryModule.createPrismaIntakeRepository,
    createPrismaProjectRepository: projectRepositoryModule.createPrismaProjectRepository,
    createPrismaProductionDiscoveryRepository:
      productionDiscoveryRepositoryModule.createPrismaProductionDiscoveryRepository,
    createPrismaResearchRepository: researchRepositoryModule.createPrismaResearchRepository,
    ...productionDiscoveryServiceModule
  };
}

function scenarioForNiche(niche) {
  if (niche === "true_crime") {
    return {
      smoke: "production-discovery-true-crime",
      topic: "Caso ficticio da Rua Neblina",
      niche,
      angle: "uma timeline segura sem sensacionalismo",
      tone: "dark documentary",
      expectedRequirementMedia: "document"
    };
  }

  if (niche === "comics") {
    return {
      smoke: "production-discovery-comics",
      topic: "Capitao Aurora",
      niche,
      angle: "por que o poder dele escala no terceiro arco",
      tone: "epic analysis",
      expectedRequirementMedia: "generated_image"
    };
  }

  return {
    smoke: "production-discovery-football",
    topic: "Haaland contra o Brasil",
    niche: "football",
    angle: "por que ele pode ser o maior perigo",
    tone: "hype",
    expectedRequirementMedia: "microclip"
  };
}

export async function runProductionDiscoverySmoke(niche) {
  const scenario = scenarioForNiche(niche);
  const { apiBuildRoot } = await ensureBuildArtifacts();
  const deps = await loadDependencies(apiBuildRoot);
  const dependencies = {
    assetRepository: deps.createPrismaAssetRepository(),
    channelRepository: deps.createPrismaChannelRepository(),
    intakeRepository: deps.createPrismaIntakeRepository(),
    projectRepository: deps.createPrismaProjectRepository(),
    productionDiscoveryRepository: deps.createPrismaProductionDiscoveryRepository(),
    researchRepository: deps.createPrismaResearchRepository()
  };

  try {
    const created = await deps.createProductionDiscoveryPackage(dependencies, {
      topic: scenario.topic,
      niche: scenario.niche,
      angle: scenario.angle,
      language: "pt-BR",
      tone: scenario.tone,
      targetDurationSeconds: 35
    });
    assert(created.status === "draft", "Package should start as draft.");

    const researched = await deps.runProductionDiscoveryResearch(
      dependencies,
      created.id
    );
    assert(researched?.researchDossierId, "Research dossier should be linked.");
    assert((researched?.outline ?? []).length > 0, "Outline should be generated.");

    const withRequirements =
      await deps.buildProductionDiscoveryAssetRequirements(dependencies, created.id);
    assert(
      (withRequirements?.assetRequirements ?? []).length > 0,
      "Asset requirements should be generated."
    );

    const withCandidates =
      await deps.searchProductionDiscoveryMediaCandidates(dependencies, created.id);
    assert(
      (withCandidates?.mediaCollectionIds ?? []).length > 0,
      "Media collections should be created."
    );
    assert(
      (withCandidates?.mediaCandidatesSummary ?? []).length > 0,
      "Candidate summaries should be stored."
    );

    const candidates = (
      await Promise.all(
        withCandidates.mediaCollectionIds.map((collectionId) =>
          dependencies.intakeRepository.listCandidates({ collectionId })
        )
      )
    ).flat();
    assert(candidates.length > 0, "At least one media candidate should be created.");
    assert(
      candidates.every((candidate) => candidate.status === "pending"),
      "Candidates must remain pending."
    );
    assert(
      candidates.every((candidate) => candidate.assetId === null),
      "Candidates must not become assets automatically."
    );

    const withProject = await deps.createProjectFromProductionDiscovery(
      dependencies,
      created.id
    );
    assert(withProject?.createdProjectId, "Project should be created.");

    const project = await dependencies.projectRepository.getById(
      withProject.createdProjectId
    );
    assert(project, "Created project should be readable.");
    assert(project.scenes.length > 0, "Created project should contain scenes.");

    printSmokeSummary({
      smoke: scenario.smoke,
      status: "completed",
      packageId: created.id,
      niche: scenario.niche,
      researchDossierId: withProject.researchDossierId,
      projectId: withProject.createdProjectId,
      scenes: project.scenes.length,
      visualRequirements: withProject.assetRequirements.length,
      mediaCollections: withProject.mediaCollectionIds.length,
      mediaCandidates: candidates.length,
      pendingCandidates: candidates.filter((candidate) => candidate.status === "pending").length,
      nextActions: [
        "review_media_candidates",
        "generate_images",
        "generate_narration",
        "attach_microclips",
        "render"
      ]
    });
  } finally {
    await deps.prisma.$disconnect();
  }
}
