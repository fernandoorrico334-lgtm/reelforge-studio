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
const smokeTitlePrefix = "Smoke Workflow Pack Quality";
const smokeSlugPrefix = "smoke-workflow-pack-quality";

const scenarios = [
  {
    packId: "cinematic_story",
    qualityPresetId: "standard",
    channelName: "Smoke Workflow Quality Cinematic Story",
    channel: {
      niche: "cinematic storytelling",
      visualStyle:
        "premium editorial cinema, controlled amber practicals, atmospheric depth",
      narrativeTone: "dramatic, intimate and premium",
      defaultTemplate: "cinematic_story",
      defaultVisualPreset: "mystery"
    },
    character: {
      name: "Corridor Narrator",
      franchise: "Smoke Quality Files",
      category: "host",
      description:
        "composed narrator in a narrow corridor, tailored coat, reflective stare",
      basePrompt:
        "editorial host portrait, refined posture, atmospheric hallway, premium short-form keyframe",
      negativePrompt:
        "watermark, logo, extra fingers, distorted face, low detail",
      styleNotes:
        "cinematic realism, soft haze, amber edge light, clean silhouette and emotional restraint",
      defaultVisualStyle: "cinematic_story",
      referenceStrength: 0.8,
      preferredProvider: "comfyui-local",
      tags: ["host", "cinematic", "story", "hallway"],
      useReference: true
    },
    scene: {
      title: "The corridor confession",
      narrationText:
        "A solitary narrator pauses under amber corridor light just before confessing the one detail that reframes the entire story.",
      captionText: "One truth changes everything",
      duration: 4,
      emotion: "MYSTERIOUS",
      visualPreset: "mystery",
      transition: "fade"
    }
  },
  {
    packId: "anime_dark",
    qualityPresetId: "standard",
    channelName: "Smoke Workflow Quality Anime Dark",
    channel: {
      niche: "anime lore",
      visualStyle:
        "dark anime key art, sharp silhouettes, supernatural tension, premium poster finish",
      narrativeTone: "ominous, epic and lore-heavy",
      defaultTemplate: "anime_dark",
      defaultVisualPreset: "epic"
    },
    character: {
      name: "Night Blade Heir",
      franchise: "Smoke Quality Files",
      category: "hero",
      description:
        "young anime swordsman with shadow aura, battle-worn coat and determined gaze",
      basePrompt:
        "anime protagonist portrait, cursed blade aura, dramatic wind, vertical poster composition",
      negativePrompt:
        "watermark, logo, extra fingers, broken anatomy, muddy shading",
      styleNotes:
        "dark anime poster, sharp linework, shadow energy, clean rim light and premium contrast",
      defaultVisualStyle: "anime_dark",
      referenceStrength: 0.84,
      preferredProvider: "comfyui-local",
      tags: ["anime", "lore", "blade", "shadow"],
      useReference: true
    },
    scene: {
      title: "The cursed blade awakens",
      narrationText:
        "The heir grips a cursed blade as storm light cuts through the ruin and the shadow aura finally answers his call.",
      captionText: "Power answered his call",
      duration: 4,
      emotion: "EPIC",
      visualPreset: "epic",
      transition: "hard-cut"
    }
  },
  {
    packId: "true_crime_doc",
    qualityPresetId: "standard",
    channelName: "Smoke Workflow Quality True Crime",
    channel: {
      niche: "true crime documentary",
      visualStyle:
        "investigative editorial realism, evidence framing, cold practical lighting",
      narrativeTone: "forensic, tense and factual",
      defaultTemplate: "true_crime_doc",
      defaultVisualPreset: "documentary"
    },
    character: null,
    scene: {
      title: "The evidence board nobody could explain",
      narrationText:
        "Investigators isolate the only photograph linking the suspect to the abandoned station while red and blue reflections cross the evidence board.",
      captionText: "The clue nobody could explain",
      duration: 4,
      emotion: "TENSE",
      visualPreset: "documentary",
      transition: "cut"
    }
  }
];

async function importModule(relativePath) {
  return import(pathToFileURL(join(projectRoot, relativePath)).href);
}

async function ensureBuildArtifacts() {
  const apiBuildRoot = await resolveApiBuildRoot(
    projectRoot,
    "Run 'npm run build' before running smoke:workflow-pack-quality."
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
    [
      "packages/video-engine/dist/index.js",
      "packages/hybrid-visual-engine/dist/index.js",
      "packages/prompt-engine/dist/index.js",
      ...apiArtifacts
    ],
    "Run 'npm run build' before running smoke:workflow-pack-quality."
  );

  return { apiBuildRoot };
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function slugForPack(packId) {
  return `${smokeSlugPrefix}-${packId}`;
}

function projectTitleForPack(packId) {
  return `${smokeTitlePrefix} - ${packId}`;
}

function referenceFilenameForPack(packId) {
  return `${smokeSlugPrefix}-${packId}-reference.png`;
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
    where: {
      title: {
        startsWith: smokeTitlePrefix
      }
    },
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
  const previousProfiles = await prismaClient.characterProfile.findMany({
    where: {
      slug: {
        startsWith: smokeSlugPrefix
      }
    },
    select: { id: true }
  });
  const previousProfileIds = previousProfiles.map((item) => item.id);

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
      characterProfileId: { in: previousProfileIds }
    }
  });
  await prismaClient.characterProfile.deleteMany({
    where: { id: { in: previousProfileIds } }
  });
  await prismaClient.asset.deleteMany({
    where: {
      OR: [
        {
          filename: {
            startsWith: smokeSlugPrefix
          }
        },
        { id: { in: previousGeneratedAssetIds } }
      ]
    }
  });
}

async function ensureSmokeChannel(prismaClient, scenario) {
  return prismaClient.channel.upsert({
    where: {
      name: scenario.channelName
    },
    update: {
      niche: scenario.channel.niche,
      language: "pt-BR",
      visualStyle: scenario.channel.visualStyle,
      narrativeTone: scenario.channel.narrativeTone,
      defaultTemplate: scenario.channel.defaultTemplate,
      defaultVisualPreset: scenario.channel.defaultVisualPreset
    },
    create: {
      name: scenario.channelName,
      niche: scenario.channel.niche,
      language: "pt-BR",
      visualStyle: scenario.channel.visualStyle,
      narrativeTone: scenario.channel.narrativeTone,
      defaultTemplate: scenario.channel.defaultTemplate,
      defaultVisualPreset: scenario.channel.defaultVisualPreset
    }
  });
}

async function ensureCharacterProfile(prismaClient, scenario, referenceAssetPath) {
  if (!scenario.character) {
    return null;
  }

  const packSlug = slugForPack(scenario.packId);
  let referenceAssetId = null;

  if (scenario.character.useReference) {
    const referenceAsset = await prismaClient.asset.create({
      data: {
        filename: referenceFilenameForPack(scenario.packId),
        originalName: referenceFilenameForPack(scenario.packId),
        path: referenceAssetPath,
        type: "IMAGE",
        category: "REFERENCE",
        franchise: scenario.character.franchise,
        character: scenario.character.name,
        emotion: scenario.scene.emotion,
        tags: JSON.stringify(["reference", "workflow-pack", scenario.packId]),
        licenseType: "local-generated",
        copyrightRisk: "LOW",
        recommendedUse: `Workflow pack quality smoke reference for ${scenario.packId}.`,
        width: 1080,
        height: 1920,
        mimeType: "image/png",
        extension: ".png",
        fileSize: 1024,
        sourceProvider: "manual-intake"
      }
    });

    referenceAssetId = referenceAsset.id;
  }

  const characterProfile = await prismaClient.characterProfile.create({
    data: {
      name: scenario.character.name,
      slug: packSlug,
      franchise: scenario.character.franchise,
      category: scenario.character.category,
      description: scenario.character.description,
      basePrompt: scenario.character.basePrompt,
      negativePrompt: scenario.character.negativePrompt,
      styleNotes: scenario.character.styleNotes,
      defaultVisualStyle: scenario.character.defaultVisualStyle,
      referenceStrength: scenario.character.referenceStrength,
      preferredProvider: scenario.character.preferredProvider,
      tags: JSON.stringify(scenario.character.tags)
    }
  });

  if (referenceAssetId) {
    await prismaClient.characterReference.create({
      data: {
        characterProfileId: characterProfile.id,
        assetId: referenceAssetId,
        sourcePath: referenceAssetPath,
        title: `${scenario.character.name} reference`,
        notes: `Reference used by the workflow pack quality smoke for ${scenario.packId}.`,
        referenceType: "face",
        strength: scenario.character.referenceStrength
      }
    });
  }

  return characterProfile;
}

async function seedScenario(prismaClient, scenario, channelId, characterProfileId) {
  const project = await prismaClient.videoProject.create({
    data: {
      title: projectTitleForPack(scenario.packId),
      status: "SCENE_PLANNING",
      channelId,
      script: `Projeto de smoke para validar o workflow pack ${scenario.packId} com ComfyUI real.`,
      durationTarget: 12,
      format: "9:16",
      templateId: scenario.channel.defaultTemplate,
      defaultCaptionStyle: "documentary_clean",
      scenes: {
        create: [
          {
            order: 1,
            title: scenario.scene.title,
            narrationText: scenario.scene.narrationText,
            captionText: scenario.scene.captionText,
            duration: scenario.scene.duration,
            emotion: scenario.scene.emotion,
            characterProfileId,
            visualPreset: scenario.scene.visualPreset,
            visualSourceMode: "generated_only",
            transition: scenario.scene.transition
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

function readPromptQualityScore(metadata) {
  if (
    metadata &&
    typeof metadata === "object" &&
    metadata.qualityAnalysis &&
    typeof metadata.qualityAnalysis === "object" &&
    typeof metadata.qualityAnalysis.overallScore === "number"
  ) {
    return metadata.qualityAnalysis.overallScore;
  }

  return null;
}

async function runScenario(deps, appEnv, scenario, workflowOrigin) {
  const channel = await ensureSmokeChannel(deps.prisma, scenario);
  const referenceAssetPath = `storage/assets/generated/visuals/${referenceFilenameForPack(
    scenario.packId
  )}`;
  await writeMinimalPng(join(projectRoot, referenceAssetPath), scenario.packId);
  const characterProfile = await ensureCharacterProfile(
    deps.prisma,
    scenario,
    referenceAssetPath
  );
  const fixtures = await seedScenario(
    deps.prisma,
    scenario,
    channel.id,
    characterProfile?.id ?? null
  );

  assert(fixtures.sceneId, `Scenario ${scenario.packId} did not create a scene.`);

  const assetRepository = deps.createPrismaAssetRepository();
  const characterRepository = deps.createPrismaCharacterRepository();
  const projectRepository = deps.createPrismaProjectRepository();
  const visualJobRepository = deps.createPrismaVisualGenerationJobRepository();

  try {
    const result = await deps.generateVisualForScene(
      projectRepository,
      assetRepository,
      characterRepository,
      visualJobRepository,
      fixtures.sceneId,
      {
        provider: "comfyui-local",
        visualSourceMode: "generated_only",
        characterProfileId: characterProfile?.id ?? null,
        workflowPackId: scenario.packId,
        qualityPresetId: scenario.qualityPresetId,
        workflowId: appEnv.comfyUiDefaultWorkflow,
        seedMode: "reuse",
        steps: 20,
        cfg: 2.8,
        sampler: "res_multistep",
        scheduler: "simple",
        denoise: 0.75,
        width: 1080,
        height: 1920,
        seed: null,
        autoAttach: true
      },
      appEnv
    );

    assert(result.asset?.path, `Scenario ${scenario.packId} did not create a generated asset.`);
    assert(
      result.asset.path.endsWith(".png"),
      `Scenario ${scenario.packId} did not persist a PNG output.`
    );
    await assertFileExists(result.asset.path);

    const project = await projectRepository.getById(fixtures.projectId);
    assert(project, `Scenario ${scenario.packId} could not reload the project.`);
    const blueprint = deps.buildRenderBlueprint(
      deps.mapProjectToBlueprintInput(project)
    );
    const firstScene = project.scenes[0] ?? null;
    const firstBlueprintScene = blueprint.scenes[0] ?? null;
    const metadata = result.job.metadata ?? {};

    assert(
      firstScene?.generatedAssetId,
      `Scenario ${scenario.packId} did not attach generatedAssetId back to the scene.`
    );
    assert(
      firstBlueprintScene?.effectiveAssetId,
      `Scenario ${scenario.packId} did not expose effectiveAssetId in the blueprint.`
    );
    assert(
      firstBlueprintScene?.effectiveAssetPath,
      `Scenario ${scenario.packId} did not expose effectiveAssetPath in the blueprint.`
    );
    assert(
      metadata.workflowPackId === scenario.packId,
      `Scenario ${scenario.packId} did not persist workflowPackId in metadata.`
    );
    assert(
      metadata.qualityPresetId === scenario.qualityPresetId,
      `Scenario ${scenario.packId} did not persist qualityPresetId in metadata.`
    );

    return {
      packId: scenario.packId,
      projectId: fixtures.projectId,
      sceneId: fixtures.sceneId,
      jobId: result.job.id,
      generatedAssetId: result.asset.id,
      outputPath: result.asset.path,
      promptQualityScore: readPromptQualityScore(metadata),
      workflowOrigin: metadata.workflowOrigin ?? workflowOrigin ?? null,
      seed: result.job.seed ?? null,
      status: result.job.status,
      workflowPackId: metadata.workflowPackId ?? null,
      qualityPresetId: metadata.qualityPresetId ?? null,
      effectiveAssetId: firstBlueprintScene?.effectiveAssetId ?? null,
      effectiveAssetPath: firstBlueprintScene?.effectiveAssetPath ?? null,
      effectiveAssetSource: firstBlueprintScene?.effectiveAssetSource ?? null,
      errorMessage: null
    };
  } catch (error) {
    return {
      packId: scenario.packId,
      projectId: fixtures.projectId,
      sceneId: fixtures.sceneId,
      jobId: null,
      generatedAssetId: null,
      outputPath: null,
      promptQualityScore: null,
      workflowOrigin: workflowOrigin ?? null,
      seed: null,
      status: "failed",
      workflowPackId: scenario.packId,
      qualityPresetId: scenario.qualityPresetId,
      effectiveAssetId: null,
      effectiveAssetPath: null,
      effectiveAssetSource: null,
      errorMessage: error instanceof Error ? error.message : String(error)
    };
  }
}

async function main() {
  const { apiBuildRoot } = await ensureBuildArtifacts();
  const deps = await loadDependencies(apiBuildRoot);
  const appEnv = deps.loadEnv();
  const providerStatus = await deps.getComfyUiProviderStatus(appEnv);

  if (!appEnv.comfyUiEnabled) {
    printSmokeSummary({
      comfyUiEnabled: false,
      message: "COMFYUI_ENABLED=false. Skipping workflow pack quality smoke.",
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
    const results = [];

    for (const scenario of scenarios) {
      const result = await runScenario(
        deps,
        appEnv,
        scenario,
        providerStatus.workflowOrigin ?? null
      );
      results.push(result);
    }

    const failed = results.filter((result) => result.status !== "completed");
    printSmokeSummary({
      provider: "comfyui-local",
      workflowTemplate: appEnv.comfyUiDefaultWorkflow,
      workflowOrigin: providerStatus.workflowOrigin ?? null,
      completed: results.length - failed.length,
      failed: failed.length,
      results,
      finalStatus: failed.length === 0 ? "completed" : "failed"
    });

    if (failed.length > 0) {
      throw new Error(
        `Workflow pack quality smoke failed for: ${failed
          .map((result) => result.packId)
          .join(", ")}.`
      );
    }
  } finally {
    await deps.prisma.$disconnect();
  }
}

await main();
