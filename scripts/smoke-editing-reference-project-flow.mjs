import { spawn } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  apiArtifactPath,
  ensureArtifactsExist,
  ensureFileParent,
  printSmokeSummary,
  resolveApiBuildRoot,
  safeCheckFfmpeg,
  safeCheckFfprobe,
  writeMinimalTextFile
} from "./lib/smoke-utils.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");
const smokeChannelName = "Smoke Editing Reference Flow Channel";
const smokeReferenceTitle = "Smoke Editing Reference Flow";
const smokePresetSlug = "smoke-editing-reference-project-flow";
const smokeReferenceRoot = "storage/references/smoke";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function formatCommand(command, args) {
  return [command, ...args].join(" ");
}

function createCommandError(command, args, code, stdout, stderr) {
  const tail = `${stderr}${stdout}`
    .trim()
    .split(/\r?\n/u)
    .slice(-8)
    .join(" | ");

  return Object.assign(
    new Error(
      `Command '${formatCommand(command, args)}' failed with code ${code ?? "unknown"}. ${tail || "No stdout/stderr output captured."}`
    ),
    { command, args: [...args], stdout, stderr, code }
  );
}

function createSpawnError(command, args, error) {
  return Object.assign(
    new Error(`Failed to spawn '${formatCommand(command, args)}'. ${error.message}`),
    { command, args: [...args], stdout: "", stderr: "", code: error.code ?? null }
  );
}

function runCommand(command, args, cwd = projectRoot) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, {
      cwd,
      shell: false,
      windowsHide: true
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      rejectPromise(createSpawnError(command, args, error));
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolvePromise({ stdout, stderr });
        return;
      }

      rejectPromise(createCommandError(command, args, code, stdout, stderr));
    });
  });
}

async function importModule(relativePath) {
  return import(pathToFileURL(join(projectRoot, relativePath)).href);
}

async function ensureBuildArtifacts() {
  const apiBuildRoot = await resolveApiBuildRoot(
    projectRoot,
    "Run 'npm run build' before running smoke:editing-reference-project-flow."
  );
  const apiArtifacts = [
    "infrastructure/database/prisma-client.js",
    "modules/assets/infrastructure/prisma-asset-repository.js",
    "modules/channels/infrastructure/prisma-channel-repository.js",
    "modules/projects/infrastructure/prisma-project-repository.js",
    "modules/projects/application/project-render-blueprint-service.js",
    "modules/editing-references/infrastructure/prisma-editing-reference-repository.js",
    "modules/editing-references/application/editing-reference-service.js",
    "modules/reels-factory/application/reels-factory-service.js"
  ].map((relativePath) => apiArtifactPath(apiBuildRoot, relativePath));

  await ensureArtifactsExist(
    projectRoot,
    [
      "packages/story-engine/dist/index.js",
      "packages/video-engine/dist/index.js",
      "packages/editing-reference-engine/dist/index.js",
      ...apiArtifacts
    ],
    "Run 'npm run build' before running smoke:editing-reference-project-flow."
  );

  return { apiBuildRoot };
}

async function loadDependencies(apiBuildRoot) {
  const [
    prismaModule,
    assetRepositoryModule,
    channelRepositoryModule,
    projectRepositoryModule,
    renderBlueprintServiceModule,
    editingReferenceRepositoryModule,
    editingReferenceServiceModule,
    reelsFactoryServiceModule
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
        "modules/editing-references/infrastructure/prisma-editing-reference-repository.js"
      )
    ),
    importModule(
      apiArtifactPath(
        apiBuildRoot,
        "modules/editing-references/application/editing-reference-service.js"
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
    createPrismaAssetRepository: assetRepositoryModule.createPrismaAssetRepository,
    createPrismaChannelRepository:
      channelRepositoryModule.createPrismaChannelRepository,
    createPrismaProjectRepository:
      projectRepositoryModule.createPrismaProjectRepository,
    getVideoProjectRenderBlueprint:
      renderBlueprintServiceModule.getVideoProjectRenderBlueprint,
    createPrismaEditingReferenceRepository:
      editingReferenceRepositoryModule.createPrismaEditingReferenceRepository,
    createEditingReference: editingReferenceServiceModule.createEditingReference,
    analyzeStoredEditingReference:
      editingReferenceServiceModule.analyzeStoredEditingReference,
    buildPresetFromEditingReference:
      editingReferenceServiceModule.buildPresetFromEditingReference,
    createReelsFactoryProject:
      reelsFactoryServiceModule.createReelsFactoryProject
  };
}

async function cleanupPreviousSmokeData(prismaClient) {
  const smokeChannel = await prismaClient.channel.findUnique({
    where: { name: smokeChannelName },
    select: { id: true }
  });
  const previousProjectIds = smokeChannel
    ? (
        await prismaClient.videoProject.findMany({
          where: { channelId: smokeChannel.id },
          select: { id: true }
        })
      ).map((item) => item.id)
    : [];
  const previousSceneIds =
    previousProjectIds.length > 0
      ? (
          await prismaClient.scene.findMany({
            where: { videoProjectId: { in: previousProjectIds } },
            select: { id: true }
          })
        ).map((item) => item.id)
      : [];

  if (previousProjectIds.length > 0) {
    await prismaClient.editorialMicroclip.deleteMany({
      where: { projectId: { in: previousProjectIds } }
    });
    await prismaClient.visualGenerationJob.deleteMany({
      where: {
        OR: [
          { videoProjectId: { in: previousProjectIds } },
          { sceneId: { in: previousSceneIds } }
        ]
      }
    });
    await prismaClient.narrationJob.deleteMany({
      where: {
        OR: [
          { videoProjectId: { in: previousProjectIds } },
          { sceneId: { in: previousSceneIds } }
        ]
      }
    });
    await prismaClient.renderJob.deleteMany({
      where: { videoProjectId: { in: previousProjectIds } }
    });
    await prismaClient.scene.deleteMany({
      where: { videoProjectId: { in: previousProjectIds } }
    });
    await prismaClient.videoProject.deleteMany({
      where: { id: { in: previousProjectIds } }
    });
  }

  await prismaClient.editingReferencePreset.deleteMany({
    where: {
      OR: [
        { slug: smokePresetSlug },
        { name: { startsWith: "Smoke Editing Reference Flow Preset" } }
      ]
    }
  });
  await prismaClient.editingReference.deleteMany({
    where: {
      title: { startsWith: smokeReferenceTitle }
    }
  });
}

async function ensureSmokeChannel(prismaClient) {
  return prismaClient.channel.upsert({
    where: { name: smokeChannelName },
    update: {
      niche: "editing reference flow smoke",
      language: "pt-BR",
      visualStyle: "football analysis boards with premium momentum cues",
      narrativeTone: "hype and tactical urgency",
      defaultTemplate: "player_threat_analysis",
      defaultVisualPreset: "action"
    },
    create: {
      name: smokeChannelName,
      niche: "editing reference flow smoke",
      language: "pt-BR",
      visualStyle: "football analysis boards with premium momentum cues",
      narrativeTone: "hype and tactical urgency",
      defaultTemplate: "player_threat_analysis",
      defaultVisualPreset: "action"
    }
  });
}

async function ensureReferenceSource(ffmpegCommand, ffprobeAvailable) {
  if (ffmpegCommand && ffprobeAvailable) {
    const relativePath = `${smokeReferenceRoot}/smoke-editing-reference-project-flow.mp4`;
    const absolutePath = join(projectRoot, relativePath);

    await ensureFileParent(absolutePath);
    await runCommand(ffmpegCommand, [
      "-y",
      "-hide_banner",
      "-loglevel",
      "error",
      "-f",
      "lavfi",
      "-i",
      "color=c=black:s=720x1280:d=1.5:r=24",
      "-f",
      "lavfi",
      "-i",
      "color=c=yellow:s=720x1280:d=1.5:r=24",
      "-f",
      "lavfi",
      "-i",
      "color=c=red:s=720x1280:d=1.5:r=24",
      "-f",
      "lavfi",
      "-i",
      "sine=frequency=880:sample_rate=48000:duration=4.5",
      "-filter_complex",
      "[0:v][1:v][2:v]concat=n=3:v=1:a=0,format=yuv420p[v]",
      "-map",
      "[v]",
      "-map",
      "3:a",
      "-shortest",
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      absolutePath
    ]);

    return {
      relativePath,
      analysisMode: "ffmpeg"
    };
  }

  const relativePath = `${smokeReferenceRoot}/smoke-editing-reference-project-flow.txt`;
  const absolutePath = join(projectRoot, relativePath);
  await writeMinimalTextFile(
    absolutePath,
    "FFmpeg unavailable in this environment. Placeholder source for editing reference project flow smoke."
  );

  return {
    relativePath,
    analysisMode: "fallback"
  };
}

async function main() {
  const ffmpeg = await safeCheckFfmpeg(runCommand);
  const ffprobe = await safeCheckFfprobe(runCommand);
  const { apiBuildRoot } = await ensureBuildArtifacts();
  const deps = await loadDependencies(apiBuildRoot);

  try {
    await cleanupPreviousSmokeData(deps.prisma);
    const smokeChannel = await ensureSmokeChannel(deps.prisma);
    const source = await ensureReferenceSource(
      ffmpeg.available ? ffmpeg.command : null,
      ffprobe.available
    );
    const assetRepository = deps.createPrismaAssetRepository();
    const channelRepository = deps.createPrismaChannelRepository();
    const projectRepository = deps.createPrismaProjectRepository();
    const editingReferenceRepository =
      deps.createPrismaEditingReferenceRepository();

    const createdReference = await deps.createEditingReference(
      editingReferenceRepository,
      assetRepository,
      {
        title: `${smokeReferenceTitle} Football Pressure`,
        description:
          "Smoke local reference to validate editorial preset persistence through Reels Factory and Render Blueprint.",
        assetId: null,
        localPath: source.relativePath,
        sourceType: "local_file",
        category: "football",
        status: "draft",
        durationSeconds: source.analysisMode === "fallback" ? 4.5 : null,
        averageCutPaceSeconds: source.analysisMode === "fallback" ? 1.5 : null,
        beatIntensity: "high",
        pacing: "fast",
        zoomStyle: "aggressive",
        flashStyle: "medium",
        transitionStyle: "flash_cut",
        captionStyle: "center_bold",
        narrationStyle: "hype",
        musicStyle: "hype",
        sfxStyle: "high",
        hookStyle: "warning",
        ctaStyle: "strong",
        microclipPlacement: "climax",
        visualStyleNotes:
          "Premium football pressure board with short cuts and explosive inserts.",
        audioStyleNotes:
          "Narration-forward, high-energy bed and sharp impacts.",
        editingStyleNotes:
          "Use to bias Reels Factory toward fast momentum and climax-driven inserts.",
        analysisWarnings: []
      }
    );

    let analysisStatus = "skipped";
    let analyzedReference = createdReference;

    if (source.analysisMode === "ffmpeg" && ffmpeg.available && ffprobe.available) {
      const analysisResult = await deps.analyzeStoredEditingReference(
        editingReferenceRepository,
        createdReference.id
      );
      assert(
        analysisResult.analysis.status === "completed",
        "Editing reference analysis should complete when FFmpeg and FFprobe are available."
      );
      analyzedReference = analysisResult.reference;
      analysisStatus = analysisResult.analysis.status;
    }

    const builtPreset = await deps.buildPresetFromEditingReference(
      editingReferenceRepository,
      createdReference.id,
      {
        name: "Smoke Editing Reference Flow Preset",
        slug: smokePresetSlug,
        description:
          "Preset derivado do smoke para persistir estilo editorial no projeto e no blueprint.",
        recommendedTemplates: ["player_threat_analysis", "sports_hype"],
        recommendedMusicPresetId: "football_hype",
        recommendedAudioMasteringPresetId: "football_hype",
        recommendedNarrationVoicePackId: "sports_hype_ptbr",
        defaultShotDurationSeconds:
          analyzedReference.averageCutPaceSeconds ?? 1.5,
        notes:
          "Smoke preset to validate persisted editing style through project creation and blueprint generation."
      }
    );

    const createdProject = await deps.createReelsFactoryProject(
      projectRepository,
      channelRepository,
      {
        channelId: smokeChannel.id,
        topic: "Messi contra o Brasil",
        subject: "Messi",
        angle: "onde a pressao editorial deve acelerar",
        templateId: "player_threat_analysis",
        editingReferencePresetId: builtPreset.preset.id,
        tone: "hype",
        durationSeconds: 35,
        language: "pt-BR",
        includeMicroclip: true
      },
      editingReferenceRepository
    );

    assert(createdProject.projectId, "Reels Factory did not create a project.");
    assert(
      createdProject.preview.editingReferencePresetId === builtPreset.preset.id,
      "Preview did not preserve the editingReferencePresetId."
    );
    assert(
      createdProject.preview.editingStyleSummary?.presetId === builtPreset.preset.id,
      "Preview did not expose the derived editing style summary."
    );
    assert(
      createdProject.project.editingReferencePresetId === builtPreset.preset.id,
      "Created project did not persist the editingReferencePresetId."
    );
    assert(
      createdProject.project.editingStyleSummary?.presetId === builtPreset.preset.id,
      "Created project did not persist the editingStyleSummary."
    );
    assert(
      createdProject.project.musicPresetId ===
        builtPreset.preset.recommendedMusicPresetId,
      "Created project did not inherit the recommended music preset."
    );

    const firstSceneRecipe = JSON.parse(
      createdProject.project.scenes[0]?.visualRecipe ?? "{}"
    );

    assert(
      firstSceneRecipe.suggestedAudioMasteringPresetId ===
        builtPreset.preset.recommendedAudioMasteringPresetId,
      "Scene recipe did not inherit the recommended audio mastering preset."
    );
    assert(
      firstSceneRecipe.suggestedVoicePackId ===
        builtPreset.preset.recommendedNarrationVoicePackId,
      "Scene recipe did not inherit the recommended narration voice pack."
    );

    const blueprint = await deps.getVideoProjectRenderBlueprint(
      projectRepository,
      assetRepository,
      createdProject.projectId
    );
    const firstBlueprintScene = blueprint.scenes[0] ?? null;

    assert(
      blueprint.editingReferencePresetId === builtPreset.preset.id,
      "Render blueprint did not expose the persisted editingReferencePresetId."
    );
    assert(
      blueprint.editingReferencePresetName === builtPreset.preset.name,
      "Render blueprint did not expose the persisted preset name."
    );
    assert(
      blueprint.editingStyleSummary?.presetId === builtPreset.preset.id,
      "Render blueprint did not expose the editingStyleSummary."
    );
    assert(firstBlueprintScene, "Render blueprint did not include the first scene.");
    assert(
      firstBlueprintScene.suggestedShotDurationSeconds !== null,
      "Render blueprint scene is missing suggestedShotDurationSeconds."
    );
    assert(
      firstBlueprintScene.suggestedMicroclipPlacement ===
        builtPreset.preset.microclipPlacement,
      "Render blueprint scene is missing the editing-driven microclip placement."
    );
    assert(
      firstBlueprintScene.suggestedIntensity !== null,
      "Render blueprint scene is missing the derived editing intensity."
    );

    printSmokeSummary({
      referenceId: createdReference.id,
      presetId: builtPreset.preset.id,
      analysisStatus,
      analysisMode: source.analysisMode,
      projectId: createdProject.projectId,
      sceneId: firstBlueprintScene.sceneId,
      editingReferencePresetId: blueprint.editingReferencePresetId,
      editingReferencePresetName: blueprint.editingReferencePresetName,
      musicPresetId: createdProject.project.musicPresetId ?? null,
      suggestedShotDurationSeconds:
        firstBlueprintScene.suggestedShotDurationSeconds,
      suggestedMicroclipPlacement:
        firstBlueprintScene.suggestedMicroclipPlacement,
      suggestedIntensity: firstBlueprintScene.suggestedIntensity,
      status: "completed"
    });
  } finally {
    await deps.prisma.$disconnect();
  }
}

await main();
