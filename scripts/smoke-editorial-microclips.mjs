import { spawn } from "node:child_process";
import { access, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  apiArtifactPath,
  ensureArtifactsExist,
  ensureFileParent,
  printSmokeSummary,
  resolveApiBuildRoot,
  safeCheckFfmpeg,
  writeMinimalPng
} from "./lib/smoke-utils.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");
const smokeChannelName = "Smoke Editorial Microclips Channel";
const smokeProjectTitle = "Smoke Editorial Microclips Project";
const smokeAssetsRoot = "storage/assets/smoke/editorial-microclips";

function log(message) {
  console.log(`[smoke:editorial-microclips] ${message}`);
}

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
  const error = new Error(
    `Command '${formatCommand(command, args)}' failed with code ${code ?? "unknown"}. ${tail || "No stdout/stderr output captured."}`
  );

  return Object.assign(error, {
    command,
    args: [...args],
    stdout,
    stderr,
    code
  });
}

function createSpawnError(command, args, error) {
  const wrapped = new Error(
    `Failed to spawn '${formatCommand(command, args)}'. ${error.message}`
  );

  return Object.assign(wrapped, {
    command,
    args: [...args],
    stdout: "",
    stderr: "",
    code: error.code ?? null,
    cause: error
  });
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
    "Run 'npm run build' before running smoke:editorial-microclips."
  );
  const apiArtifacts = [
    "infrastructure/database/prisma-client.js",
    "modules/assets/infrastructure/prisma-asset-repository.js",
    "modules/projects/infrastructure/prisma-project-repository.js",
    "modules/projects/application/project-render-blueprint-service.js",
    "modules/narration/infrastructure/prisma-narration-job-repository.js",
    "modules/narration/application/narration-service.js",
    "modules/editorial-microclips/infrastructure/prisma-editorial-microclip-repository.js",
    "modules/editorial-microclips/application/editorial-microclip-service.js"
  ].map((relativePath) => apiArtifactPath(apiBuildRoot, relativePath));

  await ensureArtifactsExist(
    projectRoot,
    [
      "packages/video-engine/dist/index.js",
      "packages/narration-engine/dist/index.js",
      ...apiArtifacts
    ],
    "Run 'npm run build' before running smoke:editorial-microclips."
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
    narrationServiceModule,
    editorialMicroclipRepositoryModule,
    editorialMicroclipServiceModule
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
    ),
    importModule(
      apiArtifactPath(
        apiBuildRoot,
        "modules/editorial-microclips/infrastructure/prisma-editorial-microclip-repository.js"
      )
    ),
    importModule(
      apiArtifactPath(
        apiBuildRoot,
        "modules/editorial-microclips/application/editorial-microclip-service.js"
      )
    )
  ]);

  return {
    prisma: prismaModule.prisma,
    createPrismaAssetRepository: assetRepositoryModule.createPrismaAssetRepository,
    createPrismaProjectRepository:
      projectRepositoryModule.createPrismaProjectRepository,
    getVideoProjectRenderBlueprint:
      renderBlueprintServiceModule.getVideoProjectRenderBlueprint,
    createPrismaNarrationJobRepository:
      narrationJobRepositoryModule.createPrismaNarrationJobRepository,
    generateNarrationForScene: narrationServiceModule.generateNarrationForScene,
    createPrismaEditorialMicroclipRepository:
      editorialMicroclipRepositoryModule.createPrismaEditorialMicroclipRepository,
    createEditorialMicroclip:
      editorialMicroclipServiceModule.createEditorialMicroclip
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

  await prismaClient.editorialMicroclip.deleteMany({
    where: { projectId: { in: previousProjectIds } }
  });
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
    where: {
      OR: [
        { id: { in: previousGeneratedAssetIds } },
        { path: { startsWith: `${smokeAssetsRoot}/` } }
      ]
    }
  });
}

async function ensureSmokeChannel(prismaClient) {
  return prismaClient.channel.upsert({
    where: { name: smokeChannelName },
    update: {
      niche: "editorial microclips smoke",
      language: "pt-BR",
      visualStyle: "editorial sports board with cinematic inserts",
      narrativeTone: "technical validation",
      defaultTemplate: "sports_hype",
      defaultVisualPreset: "action"
    },
    create: {
      name: smokeChannelName,
      niche: "editorial microclips smoke",
      language: "pt-BR",
      visualStyle: "editorial sports board with cinematic inserts",
      narrativeTone: "technical validation",
      defaultTemplate: "sports_hype",
      defaultVisualPreset: "action"
    }
  });
}

async function ensureImageAsset(prismaClient, definition) {
  const relativePath = `${smokeAssetsRoot}/${definition.filename}`;
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
      tags: JSON.stringify(["smoke", "editorial-microclips", definition.title]),
      licenseType: "local-generated",
      copyrightRisk: "LOW",
      recommendedUse: "Editorial microclip blueprint smoke base image",
      width: 1080,
      height: 1920,
      mimeType: "image/png",
      extension: ".png",
      fileSize: fileStats.size,
      sourceProvider: "manual-smoke"
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
      tags: JSON.stringify(["smoke", "editorial-microclips", definition.title]),
      licenseType: "local-generated",
      copyrightRisk: "LOW",
      recommendedUse: "Editorial microclip blueprint smoke base image",
      width: 1080,
      height: 1920,
      mimeType: "image/png",
      extension: ".png",
      fileSize: fileStats.size,
      sourceProvider: "manual-smoke"
    }
  });
}

async function ensureMicroclipVideoAsset(prismaClient) {
  const relativePath = `${smokeAssetsRoot}/editorial-impact.mp4`;
  const absolutePath = join(projectRoot, relativePath);
  const ffmpeg = await safeCheckFfmpeg(runCommand);

  await ensureFileParent(absolutePath);

  if (ffmpeg.available) {
    await runCommand(ffmpeg.command, [
      "-y",
      "-f",
      "lavfi",
      "-i",
      "testsrc=size=720x1280:rate=30",
      "-t",
      "2.6",
      "-pix_fmt",
      "yuv420p",
      absolutePath
    ]);
  } else {
    await writeFile(absolutePath, Buffer.alloc(0));
  }

  const fileStats = await stat(absolutePath);
  const asset = await prismaClient.asset.upsert({
    where: { path: relativePath },
    update: {
      filename: "editorial-impact.mp4",
      originalName: "editorial-impact.mp4",
      type: "VIDEO",
      category: "BROLL",
      franchise: "Smoke Test",
      character: null,
      emotion: "EPIC",
      tags: JSON.stringify(["smoke", "editorial", "microclip", "video"]),
      licenseType: "local-generated",
      copyrightRisk: "LOW",
      recommendedUse: "Editorial microclip blueprint smoke video",
      duration: 2.6,
      width: 720,
      height: 1280,
      mimeType: "video/mp4",
      extension: ".mp4",
      fileSize: fileStats.size,
      sourceProvider: ffmpeg.available ? "ffmpeg-smoke" : "manual-smoke"
    },
    create: {
      filename: "editorial-impact.mp4",
      originalName: "editorial-impact.mp4",
      path: relativePath,
      type: "VIDEO",
      category: "BROLL",
      franchise: "Smoke Test",
      character: null,
      emotion: "EPIC",
      tags: JSON.stringify(["smoke", "editorial", "microclip", "video"]),
      licenseType: "local-generated",
      copyrightRisk: "LOW",
      recommendedUse: "Editorial microclip blueprint smoke video",
      duration: 2.6,
      width: 720,
      height: 1280,
      mimeType: "video/mp4",
      extension: ".mp4",
      fileSize: fileStats.size,
      sourceProvider: ffmpeg.available ? "ffmpeg-smoke" : "manual-smoke"
    }
  });

  return {
    asset,
    ffmpegAvailable: ffmpeg.available
  };
}

async function seedSmokeProject(prismaClient, channelId, sceneAssets) {
  const project = await prismaClient.videoProject.create({
    data: {
      title: smokeProjectTitle,
      status: "SCENE_PLANNING",
      channelId,
      script:
        "Projeto para validar que microclips editoriais convivem com visual efetivo e narracao gerada.",
      durationTarget: 10,
      format: "9:16",
      templateId: "sports_hype",
      defaultCaptionStyle: "sports_hype",
      scenes: {
        create: [
          {
            order: 1,
            title: "Ataque e prova visual",
            narrationText:
              "A primeira cena mantem o visual base, mas recebe um microclip curto como evidencia editorial.",
            captionText: "microclip como evidencia",
            duration: 4,
            emotion: "EPIC",
            assetId: sceneAssets[0].id,
            visualPreset: "action",
            visualSourceMode: "asset_only",
            transition: "flash"
          },
          {
            order: 2,
            title: "Impacto final",
            narrationText:
              "A segunda cena segura a narracao e usa um segundo microclip para fechar com impacto.",
            captionText: "impacto editorial final",
            duration: 4,
            emotion: "TENSE",
            assetId: sceneAssets[1].id,
            visualPreset: "epic",
            visualSourceMode: "asset_only",
            transition: "cut"
          }
        ]
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
    const sceneAssets = await Promise.all([
      ensureImageAsset(deps.prisma, {
        filename: "scene-1-base.png",
        title: "scene-1-base",
        emotion: "EPIC"
      }),
      ensureImageAsset(deps.prisma, {
        filename: "scene-2-base.png",
        title: "scene-2-base",
        emotion: "TENSE"
      })
    ]);
    const microclipVideo = await ensureMicroclipVideoAsset(deps.prisma);
    const fixtures = await seedSmokeProject(
      deps.prisma,
      channel.id,
      sceneAssets
    );

    assert(
      fixtures.sceneIds.length === 2,
      "Smoke project did not create the expected scenes."
    );

    const assetRepository = deps.createPrismaAssetRepository();
    const projectRepository = deps.createPrismaProjectRepository();
    const narrationJobRepository = deps.createPrismaNarrationJobRepository();
    const editorialMicroclipRepository =
      deps.createPrismaEditorialMicroclipRepository();

    log("Generating mock narrations for both scenes.");
    const narrationResults = [];

    for (const sceneId of fixtures.sceneIds) {
      narrationResults.push(
        await deps.generateNarrationForScene(
          projectRepository,
          assetRepository,
          narrationJobRepository,
          sceneId,
          {
            provider: "mock-tts",
            voicePackId: "sports_hype_ptbr",
            text: null,
            language: "pt-BR",
            autoAttach: true
          }
        )
      );
    }

    for (const result of narrationResults) {
      assert(
        result.job.status === "completed",
        `Narration job ${result.job.id} did not complete.`
      );
      assert(
        result.asset?.path,
        `Narration job ${result.job.id} did not generate an audio asset path.`
      );
      await assertFileExists(result.asset.path);
    }

    log("Creating editorial microclips.");
    const microclipOne = await deps.createEditorialMicroclip(
      editorialMicroclipRepository,
      projectRepository,
      assetRepository,
      {
        projectId: fixtures.projectId,
        sceneId: fixtures.sceneIds[0] ?? null,
        assetId: microclipVideo.asset.id,
        label: "chute forte",
        sourceType: "library_clip",
        startTimeSeconds: 0.2,
        endTimeSeconds: 0.95,
        durationSeconds: 0,
        usageMode: "supporting_evidence",
        narrationOverlay: true,
        textOverlay: "chute forte",
        calloutStyle: "minimal",
        transitionIn: "flash",
        transitionOut: "cut",
        volumeMode: "mute_original",
        orderIndex: 1,
        metadata: null
      }
    );
    const microclipTwo = await deps.createEditorialMicroclip(
      editorialMicroclipRepository,
      projectRepository,
      assetRepository,
      {
        projectId: fixtures.projectId,
        sceneId: fixtures.sceneIds[1] ?? null,
        assetId: microclipVideo.asset.id,
        label: "comemoracao curta",
        sourceType: "library_clip",
        startTimeSeconds: 1.05,
        endTimeSeconds: 1.9,
        durationSeconds: 0,
        usageMode: "impact_moment",
        narrationOverlay: true,
        textOverlay: "comemoracao",
        calloutStyle: "bold",
        transitionIn: "cut",
        transitionOut: "flash",
        volumeMode: "low_original",
        orderIndex: 2,
        metadata: null
      }
    );

    const blueprint = await deps.getVideoProjectRenderBlueprint(
      projectRepository,
      assetRepository,
      editorialMicroclipRepository,
      fixtures.projectId
    );

    assert(blueprint.hasEditorialMicroclips, "Blueprint did not flag editorial microclips.");
    assert(blueprint.microclipCount === 2, "Blueprint microclipCount should be 2.");
    assert(
      blueprint.totalMicroclipDurationSeconds ===
        Number((microclipOne.durationSeconds + microclipTwo.durationSeconds).toFixed(3)),
      "Blueprint totalMicroclipDurationSeconds did not match the created microclips."
    );

    const blueprintSceneOne = blueprint.scenes.find(
      (scene) => scene.sceneId === fixtures.sceneIds[0]
    );
    const blueprintSceneTwo = blueprint.scenes.find(
      (scene) => scene.sceneId === fixtures.sceneIds[1]
    );

    assert(blueprintSceneOne, "First blueprint scene was not found.");
    assert(blueprintSceneTwo, "Second blueprint scene was not found.");
    assert(
      blueprintSceneOne.effectiveAssetId === sceneAssets[0].id,
      "First scene lost its effective base asset after adding editorial microclips."
    );
    assert(
      blueprintSceneTwo.effectiveAssetId === sceneAssets[1].id,
      "Second scene lost its effective base asset after adding editorial microclips."
    );
    assert(
      Boolean(blueprintSceneOne.effectiveNarrationAssetId),
      "First scene did not keep an effective narration asset."
    );
    assert(
      Boolean(blueprintSceneTwo.effectiveNarrationAssetId),
      "Second scene did not keep an effective narration asset."
    );
    assert(
      blueprintSceneOne.editorialMicroclips.length === 1,
      "First scene did not expose its editorial microclip in the blueprint."
    );
    assert(
      blueprintSceneTwo.editorialMicroclips.length === 1,
      "Second scene did not expose its editorial microclip in the blueprint."
    );
    assert(
      blueprintSceneTwo.editorialMicroclips[0]?.volumeMode === "low_original",
      "Second scene microclip did not persist the configured volume mode."
    );

    printSmokeSummary({
      smoke: "editorial-microclips",
      projectId: fixtures.projectId,
      sceneIds: fixtures.sceneIds,
      microclipIds: [microclipOne.id, microclipTwo.id],
      microclipCount: blueprint.microclipCount,
      totalMicroclipDurationSeconds: blueprint.totalMicroclipDurationSeconds,
      ffmpegVideoCreated: microclipVideo.ffmpegAvailable,
      status: "completed"
    });
  } finally {
    await deps.prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("[smoke:editorial-microclips] failed", error);
  process.exitCode = 1;
});
