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
const smokeChannelName = "Smoke Hybrid Visual Channel";
const smokeCharacterSlug = "smoke-hybrid-archivist";
const smokeProjectTitle = "Smoke Hybrid Visual Project";
const smokeDossierTitle = "Smoke Hybrid Visual Dossier";
const smokeReferenceFilename = "smoke-hybrid-reference.png";

function log(message) {
  console.log(`[smoke:hybrid-visual] ${message}`);
}

async function importModule(relativePath) {
  return import(pathToFileURL(join(projectRoot, relativePath)).href);
}

async function ensureBuildArtifacts() {
  const apiBuildRoot = await resolveApiBuildRoot(
    projectRoot,
    "Run 'npm run build' before running smoke:hybrid-visual."
  );
  const apiArtifacts = [
    "infrastructure/database/prisma-client.js",
    "modules/assets/infrastructure/prisma-asset-repository.js",
    "modules/characters/infrastructure/prisma-character-repository.js",
    "modules/projects/infrastructure/prisma-project-repository.js",
    "modules/research/infrastructure/prisma-research-repository.js",
    "modules/hybrid-visual/infrastructure/prisma-visual-generation-job-repository.js",
    "modules/hybrid-visual/application/hybrid-visual-service.js"
  ].map((relativePath) => apiArtifactPath(apiBuildRoot, relativePath));

  await ensureArtifactsExist(
    projectRoot,
    ["packages/hybrid-visual-engine/dist/index.js", ...apiArtifacts],
    "Run 'npm run build' before running smoke:hybrid-visual."
  );

  return { apiBuildRoot };
}

async function loadSmokeDependencies(apiBuildRoot) {
  const [
    prismaModule,
    assetRepositoryModule,
    characterRepositoryModule,
    projectRepositoryModule,
    researchRepositoryModule,
    visualJobRepositoryModule,
    hybridVisualServiceModule
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
    )
  ]);

  return {
    prisma: prismaModule.prisma,
    createPrismaAssetRepository: assetRepositoryModule.createPrismaAssetRepository,
    createPrismaCharacterRepository:
      characterRepositoryModule.createPrismaCharacterRepository,
    createPrismaProjectRepository:
      projectRepositoryModule.createPrismaProjectRepository,
    createPrismaResearchRepository:
      researchRepositoryModule.createPrismaResearchRepository,
    createPrismaVisualGenerationJobRepository:
      visualJobRepositoryModule.createPrismaVisualGenerationJobRepository,
    getProjectMissingVisualReport:
      hybridVisualServiceModule.getProjectMissingVisualReport,
    generateVisualForScene: hybridVisualServiceModule.generateVisualForScene,
    generateVisualForResearchRequirement:
      hybridVisualServiceModule.generateVisualForResearchRequirement,
    generateMissingVisualsForProject:
      hybridVisualServiceModule.generateMissingVisualsForProject
  };
}

async function cleanupPreviousSmokeData(prismaClient) {
  const previousProjectIds = (
    await prismaClient.videoProject.findMany({
      where: { title: smokeProjectTitle },
      select: { id: true }
    })
  ).map((item) => item.id);

  const previousDossiers = await prismaClient.researchDossier.findMany({
    where: { title: smokeDossierTitle },
    select: { id: true }
  });
  const previousDossierIds = previousDossiers.map((item) => item.id);

  const previousRequirementIds = (
    await prismaClient.researchAssetRequirement.findMany({
      where: { dossierId: { in: previousDossierIds } },
      select: { id: true }
    })
  ).map((item) => item.id);

  const previousGeneratedAssetIds = (
    await prismaClient.visualGenerationJob.findMany({
      where: {
        OR: [
          { videoProjectId: { in: previousProjectIds } },
          { researchAssetRequirementId: { in: previousRequirementIds } }
        ]
      },
      select: {
        generatedAssetId: true
      }
    })
  )
    .map((item) => item.generatedAssetId)
    .filter((value) => typeof value === "string");

  await prismaClient.visualGenerationJob.deleteMany({
    where: {
      OR: [
        { videoProjectId: { in: previousProjectIds } },
        { researchAssetRequirementId: { in: previousRequirementIds } }
      ]
    }
  });

  await prismaClient.characterReference.deleteMany({
    where: {
      characterProfile: {
        slug: smokeCharacterSlug
      }
    }
  });

  await prismaClient.characterProfile.deleteMany({
    where: {
      slug: smokeCharacterSlug
    }
  });

  await prismaClient.researchOutlineScene.deleteMany({
    where: {
      dossierId: { in: previousDossierIds }
    }
  });

  await prismaClient.researchAssetRequirement.deleteMany({
    where: {
      dossierId: { in: previousDossierIds }
    }
  });

  await prismaClient.researchHook.deleteMany({
    where: {
      dossierId: { in: previousDossierIds }
    }
  });

  await prismaClient.researchTimelineEvent.deleteMany({
    where: {
      dossierId: { in: previousDossierIds }
    }
  });

  await prismaClient.researchFact.deleteMany({
    where: {
      dossierId: { in: previousDossierIds }
    }
  });

  await prismaClient.researchSource.deleteMany({
    where: {
      dossierId: { in: previousDossierIds }
    }
  });

  await prismaClient.researchDossier.deleteMany({
    where: {
      id: { in: previousDossierIds }
    }
  });

  await prismaClient.scene.deleteMany({
    where: {
      videoProjectId: { in: previousProjectIds }
    }
  });

  await prismaClient.videoProject.deleteMany({
    where: {
      id: { in: previousProjectIds }
    }
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
      niche: "Smoke validation for Hybrid Visual Engine",
      language: "pt-BR",
      visualStyle: "Editorial noir, teal accents and cinematic silhouettes",
      narrativeTone: "Investigativo e atmosferico",
      defaultTemplate: "mystery_doc",
      defaultRenderMode: "cinematic_v2",
      defaultRenderQuality: "draft",
      defaultAudioMood: "documentary_bed",
      defaultCaptionStyle: "documentary_clean",
      defaultVisualPreset: "mystery",
      defaultDurationTarget: 28,
      defaultSceneDuration: 4,
      preferredAssetCategories: JSON.stringify([
        "REFERENCE",
        "CHARACTER",
        "BACKGROUND"
      ]),
      preferredAssetTags: JSON.stringify([
        "archive",
        "mystery",
        "research",
        "hybrid"
      ])
    },
    create: {
      name: smokeChannelName,
      niche: "Smoke validation for Hybrid Visual Engine",
      language: "pt-BR",
      visualStyle: "Editorial noir, teal accents and cinematic silhouettes",
      narrativeTone: "Investigativo e atmosferico",
      defaultTemplate: "mystery_doc",
      defaultRenderMode: "cinematic_v2",
      defaultRenderQuality: "draft",
      defaultAudioMood: "documentary_bed",
      defaultCaptionStyle: "documentary_clean",
      defaultVisualPreset: "mystery",
      defaultDurationTarget: 28,
      defaultSceneDuration: 4,
      preferredAssetCategories: JSON.stringify([
        "REFERENCE",
        "CHARACTER",
        "BACKGROUND"
      ]),
      preferredAssetTags: JSON.stringify([
        "archive",
        "mystery",
        "research",
        "hybrid"
      ])
    }
  });
}

async function seedSmokeFixtures(prismaClient, channelId) {
  const referenceAsset = await prismaClient.asset.create({
    data: {
      filename: smokeReferenceFilename,
      originalName: smokeReferenceFilename,
      path: "storage/assets/character/image/smoke-hybrid-reference.png",
      type: "IMAGE",
      category: "REFERENCE",
      franchise: "Smoke Files",
      character: "Smoke Archivist",
      emotion: "MYSTERIOUS",
      tags: JSON.stringify(["archive", "character", "reference", "smoke"]),
      licenseType: "local-generated",
      copyrightRisk: "LOW",
      recommendedUse: "Smoke character reference for hybrid visuals",
      width: 1080,
      height: 1920,
      mimeType: "image/png",
      extension: ".png",
      fileSize: 214000,
      sourceProvider: "manual-intake"
    }
  });

  const characterProfile = await prismaClient.characterProfile.create({
    data: {
      name: "Smoke Archivist",
      slug: smokeCharacterSlug,
      franchise: "Smoke Files",
      category: "host",
      description:
        "Apresentador recorrente, perfil editorial sombrio com postura calma.",
      basePrompt:
        "silver archivist host, noir documentary portrait, vertical cinematic composition",
      negativePrompt:
        "watermark, logo, duplicated face, distorted anatomy, low detail",
      styleNotes:
        "Priorizar atmosfera documental escura com acento teal e tipografia editorial.",
      defaultVisualStyle: "mystery",
      referenceStrength: 0.9,
      preferredProvider: "mock-svg",
      tags: JSON.stringify(["archive", "host", "mystery", "smoke"])
    }
  });

  await prismaClient.characterReference.create({
    data: {
      characterProfileId: characterProfile.id,
      assetId: referenceAsset.id,
      sourcePath: referenceAsset.path,
      title: "Smoke Archivist Reference",
      notes: "Reference used by the hybrid visual smoke test.",
      referenceType: "face",
      strength: 0.9
    }
  });

  const project = await prismaClient.videoProject.create({
    data: {
      title: smokeProjectTitle,
      status: "SCENE_PLANNING",
      channelId,
      script:
        "Uma figura de arquivo conduz a historia de um apagao misterioso em duas cenas.",
      durationTarget: 18,
      format: "9:16",
      templateId: "mystery_doc",
      defaultCaptionStyle: "documentary_clean",
      scenes: {
        create: [
          {
            order: 1,
            title: "Arquivo principal",
            narrationText:
              "A luz caiu e o unico rosto no arquivo parecia saber que algo pior estava vindo.",
            captionText: "O arquivo ja sabia",
            duration: 5.5,
            emotion: "MYSTERIOUS",
            characterProfileId: characterProfile.id,
            visualPreset: "mystery",
            visualSourceMode: "generated_only",
            transition: "fade"
          },
          {
            order: 2,
            title: "Mapa da estacao",
            narrationText:
              "Documentos fragmentados e um mapa rasgado sustentam a teoria mais inquietante.",
            captionText: "Pistas espalhadas",
            duration: 4.5,
            emotion: "TENSE",
            assetId: referenceAsset.id,
            characterProfileId: characterProfile.id,
            visualPreset: "suspense",
            visualSourceMode: "hybrid_overlay",
            transition: "hard-cut"
          }
        ]
      }
    },
    include: {
      scenes: true
    }
  });

  const dossier = await prismaClient.researchDossier.create({
    data: {
      channelId,
      title: smokeDossierTitle,
      topic: "Apagao no observatorio cinza",
      niche: "documentario sombrio",
      tone: "investigativo",
      targetDuration: 32,
      status: "ready_for_review",
      summary:
        "Dossie usado para validar preview local de requirement via Hybrid Visual Engine."
    }
  });

  const requirement = await prismaClient.researchAssetRequirement.create({
    data: {
      dossierId: dossier.id,
      sceneRole: "hook",
      description:
        "Poster vertical com o archivist diante de paineis de arquivo e grids luminosos.",
      mediaType: "image",
      suggestedTags: JSON.stringify(["archive", "poster", "hook", "hybrid"]),
      emotion: "MYSTERIOUS",
      priority: 88,
      visualSourceMode: "generated_only",
      characterProfileId: characterProfile.id
    }
  });

  return {
    referenceAsset,
    characterProfile,
    projectId: project.id,
    sceneIds: project.scenes.map((scene) => scene.id),
    requirementId: requirement.id
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
    const researchRepository = deps.createPrismaResearchRepository();
    const visualJobRepository = deps.createPrismaVisualGenerationJobRepository();

    log("Loading report for missing visuals.");
    const report = await deps.getProjectMissingVisualReport(
      projectRepository,
      characterRepository,
      fixtures.projectId
    );

    if (!report.readyForGeneration || report.items.length < 1) {
      throw new Error(
        "Missing visual report did not mark the project as ready for generation."
      );
    }

    log("Generating local visual for the first scene.");
    const singleSceneResult = await deps.generateVisualForScene(
      projectRepository,
      assetRepository,
      characterRepository,
      visualJobRepository,
      fixtures.sceneIds[0],
      {
        provider: "mock-svg",
        visualSourceMode: "generated_only",
        characterProfileId: fixtures.characterProfile.id,
        width: 1080,
        height: 1920,
        seed: 101,
        autoAttach: true
      }
    );

    if (!singleSceneResult.asset?.path) {
      throw new Error("Scene generation did not create a generated asset.");
    }

    if (!singleSceneResult.asset.path.endsWith(".png")) {
      throw new Error("Scene generated asset is not pointing to a render-ready PNG.");
    }

    await assertFileExists(singleSceneResult.asset.path);

    if (typeof singleSceneResult.job.metadata?.debugSvgPath !== "string") {
      throw new Error("Scene generation job did not persist debugSvgPath metadata.");
    }

    await assertFileExists(singleSceneResult.job.metadata.debugSvgPath);

    log("Generating local visual for the research requirement.");
    const requirementResult = await deps.generateVisualForResearchRequirement(
      researchRepository,
      assetRepository,
      characterRepository,
      visualJobRepository,
      fixtures.requirementId,
      {
        provider: "mock-svg",
        visualSourceMode: "generated_only",
        characterProfileId: fixtures.characterProfile.id,
        width: 1080,
        height: 1920,
        seed: 202,
        autoAttach: true
      }
    );

    if (!requirementResult.asset?.path) {
      throw new Error("Requirement generation did not create a generated asset.");
    }

    if (!requirementResult.asset.path.endsWith(".png")) {
      throw new Error("Requirement generated asset is not pointing to a render-ready PNG.");
    }

    await assertFileExists(requirementResult.asset.path);

    log("Generating remaining project visuals in batch.");
    const batchResult = await deps.generateMissingVisualsForProject(
      projectRepository,
      assetRepository,
      characterRepository,
      visualJobRepository,
      fixtures.projectId,
      {
        provider: "mock-svg",
        visualSourceMode: null,
        characterProfileId: fixtures.characterProfile.id,
        width: 1080,
        height: 1920,
        seed: null,
        autoAttach: true,
        maxScenes: 4
      }
    );

    const updatedProject = await projectRepository.getById(fixtures.projectId);
    const updatedRequirement = await researchRepository.getAssetRequirementById(
      fixtures.requirementId
    );
    const jobs = await visualJobRepository.list({
      videoProjectId: fixtures.projectId
    });

    if (!updatedProject || updatedProject.scenes.length < 2) {
      throw new Error("Updated project was not found after generation.");
    }

    if (
      updatedProject.scenes.some(
        (scene) => !scene.generatedAssetId || !scene.visualPrompt
      )
    ) {
      throw new Error(
        "Not every scene ended the smoke test with generatedAssetId and visualPrompt."
      );
    }

    if (!updatedRequirement?.generatedAssetId || !updatedRequirement.visualPrompt) {
      throw new Error(
        "Research requirement did not persist generatedAssetId and visualPrompt."
      );
    }

    if (jobs.length < 2 || jobs.some((job) => job.status !== "completed")) {
      throw new Error("Visual generation jobs did not complete successfully.");
    }

    if (jobs.some((job) => job.metadata?.renderReady !== true)) {
      throw new Error("At least one visual generation job did not persist renderReady=true.");
    }

    printSmokeSummary({
      projectId: fixtures.projectId,
      requirementId: fixtures.requirementId,
      sceneJobId: singleSceneResult.job.id,
      requirementJobId: requirementResult.job.id,
      batchGeneratedCount: batchResult.generatedCount,
      projectScenes: updatedProject.scenes.length,
      reportReady: report.readyForGeneration,
      generatedAssetPaths: [
        singleSceneResult.asset.path,
        requirementResult.asset.path,
        ...batchResult.jobs
          .map((job) => job.outputPath)
          .filter((value) => typeof value === "string")
      ],
      debugSvgPaths: [
        singleSceneResult.job.metadata.debugSvgPath,
        requirementResult.job.metadata.debugSvgPath
      ],
      finalStatus: "completed"
    });
  } finally {
    await deps.prisma.$disconnect();
  }
}

await main();

