import { spawn } from "node:child_process";
import { mkdir, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  apiArtifactPath,
  ensureArtifactsExist,
  printSmokeSummary,
  resolveApiBuildRoot,
  resolveBinaryCommand,
  safeCheckFfmpeg,
  safeCheckFfprobe
} from "./lib/smoke-utils.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");
const smokeChannelName = "Smoke Microclip Selector Channel";
const smokeProjectTitle = "Smoke Automatic Microclip Selector";
const smokeVideoRelativePath = "storage/assets/smoke/microclip-selector/long-football-test.mp4";

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
    child.on("error", rejectPromise);
    child.on("close", (code) => {
      if (code === 0) {
        resolvePromise({ stdout, stderr });
        return;
      }

      rejectPromise(
        new Error(
          `Command '${[command, ...args].join(" ")}' failed with code ${code ?? "unknown"}. ${stderr}`
        )
      );
    });
  });
}

async function importModule(relativePath) {
  return import(pathToFileURL(join(projectRoot, relativePath)).href);
}

async function ensureBuildArtifacts() {
  const apiBuildRoot = await resolveApiBuildRoot(
    projectRoot,
    "Run 'npm run build' before running smoke:microclip-selector."
  );
  await ensureArtifactsExist(
    projectRoot,
    [
      "packages/microclip-selector-engine/dist/index.js",
      apiArtifactPath(apiBuildRoot, "infrastructure/database/prisma-client.js"),
      apiArtifactPath(apiBuildRoot, "modules/assets/infrastructure/prisma-asset-repository.js"),
      apiArtifactPath(apiBuildRoot, "modules/editorial-microclips/infrastructure/prisma-editorial-microclip-repository.js"),
      apiArtifactPath(apiBuildRoot, "modules/microclip-selector/application/microclip-selector-service.js"),
      apiArtifactPath(apiBuildRoot, "modules/projects/infrastructure/prisma-project-repository.js"),
      apiArtifactPath(apiBuildRoot, "modules/projects/application/project-render-blueprint-service.js")
    ],
    "Run 'npm run build' before running smoke:microclip-selector."
  );

  return { apiBuildRoot };
}

async function loadDependencies(apiBuildRoot) {
  const [
    prismaModule,
    assetRepositoryModule,
    editorialRepositoryModule,
    selectorServiceModule,
    projectRepositoryModule,
    blueprintServiceModule
  ] = await Promise.all([
    importModule(apiArtifactPath(apiBuildRoot, "infrastructure/database/prisma-client.js")),
    importModule(apiArtifactPath(apiBuildRoot, "modules/assets/infrastructure/prisma-asset-repository.js")),
    importModule(apiArtifactPath(apiBuildRoot, "modules/editorial-microclips/infrastructure/prisma-editorial-microclip-repository.js")),
    importModule(apiArtifactPath(apiBuildRoot, "modules/microclip-selector/application/microclip-selector-service.js")),
    importModule(apiArtifactPath(apiBuildRoot, "modules/projects/infrastructure/prisma-project-repository.js")),
    importModule(apiArtifactPath(apiBuildRoot, "modules/projects/application/project-render-blueprint-service.js"))
  ]);

  return {
    prisma: prismaModule.prisma,
    createPrismaAssetRepository: assetRepositoryModule.createPrismaAssetRepository,
    createPrismaEditorialMicroclipRepository:
      editorialRepositoryModule.createPrismaEditorialMicroclipRepository,
    analyzeAssetForMicroclips: selectorServiceModule.analyzeAssetForMicroclips,
    applyMicroclipCandidate: selectorServiceModule.applyMicroclipCandidate,
    createPrismaProjectRepository:
      projectRepositoryModule.createPrismaProjectRepository,
    getVideoProjectRenderBlueprint:
      blueprintServiceModule.getVideoProjectRenderBlueprint
  };
}

async function ensureSyntheticVideo() {
  const ffmpeg = resolveBinaryCommand("ffmpeg").command;
  const absolutePath = join(projectRoot, smokeVideoRelativePath);

  await mkdir(dirname(absolutePath), { recursive: true });
  await runCommand(ffmpeg, [
    "-y",
    "-f",
    "lavfi",
    "-i",
    "testsrc2=size=1280x720:rate=30:duration=8",
    "-f",
    "lavfi",
    "-i",
    "sine=frequency=880:duration=8",
    "-vf",
    "format=yuv420p",
    "-c:v",
    "libx264",
    "-c:a",
    "aac",
    "-shortest",
    absolutePath
  ]);

  const fileStats = await stat(absolutePath);
  return { absolutePath, fileSize: fileStats.size };
}

async function ensureSmokeChannel(prisma) {
  return prisma.channel.upsert({
    where: { name: smokeChannelName },
    update: {
      niche: "football microclip selector smoke",
      language: "pt-BR",
      visualStyle: "sports editorial",
      narrativeTone: "hype",
      defaultTemplate: "sports_hype"
    },
    create: {
      name: smokeChannelName,
      niche: "football microclip selector smoke",
      language: "pt-BR",
      visualStyle: "sports editorial",
      narrativeTone: "hype",
      defaultTemplate: "sports_hype"
    }
  });
}

async function cleanup(prisma, channelId) {
  const projects = await prisma.videoProject.findMany({
    where: { channelId },
    select: { id: true }
  });
  const projectIds = projects.map((project) => project.id);

  if (projectIds.length) {
    await prisma.editorialMicroclip.deleteMany({
      where: { projectId: { in: projectIds } }
    });
    await prisma.scene.deleteMany({
      where: { videoProjectId: { in: projectIds } }
    });
    await prisma.videoProject.deleteMany({
      where: { id: { in: projectIds } }
    });
  }

  await prisma.asset.deleteMany({
    where: { path: smokeVideoRelativePath }
  });
}

async function main() {
  const [ffmpeg, ffprobe] = await Promise.all([
    safeCheckFfmpeg(runCommand),
    safeCheckFfprobe(runCommand)
  ]);

  if (!ffmpeg.available || !ffprobe.available) {
    printSmokeSummary({
      smoke: "microclip-selector",
      status: "skipped",
      reason: ffmpeg.errorMessage ?? ffprobe.errorMessage ?? "FFmpeg unavailable."
    });
    return;
  }

  const { apiBuildRoot } = await ensureBuildArtifacts();
  const deps = await loadDependencies(apiBuildRoot);

  try {
    const channel = await ensureSmokeChannel(deps.prisma);
    await cleanup(deps.prisma, channel.id);
    const syntheticVideo = await ensureSyntheticVideo();
    const asset = await deps.prisma.asset.create({
      data: {
        filename: "long-football-test.mp4",
        originalName: "long-football-test.mp4",
        path: smokeVideoRelativePath,
        type: "VIDEO",
        category: "BROLL",
        franchise: "Smoke Test",
        character: null,
        emotion: "EPIC",
        tags: JSON.stringify(["smoke", "microclip-selector", "football"]),
        licenseType: "local-generated",
        copyrightRisk: "LOW",
        recommendedUse: "Automatic microclip selector smoke video",
        duration: 8,
        width: 1280,
        height: 720,
        mimeType: "video/mp4",
        extension: ".mp4",
        fileSize: syntheticVideo.fileSize,
        sourceProvider: "smoke-test"
      }
    });
    const project = await deps.prisma.videoProject.create({
      data: {
        title: smokeProjectTitle,
        status: "SCENE_PLANNING",
        channelId: channel.id,
        script: "Smoke para validar seletor automatico de microclips.",
        durationTarget: 8,
        format: "9:16",
        templateId: "player_threat_analysis",
        scenes: {
          create: {
            order: 1,
            title: "Momento de impacto",
            narrationText: "Este trecho valida selecao automatica de microclip.",
            captionText: "momento de impacto",
            duration: 4,
            emotion: "EPIC",
            visualPreset: "action",
            transition: "cut"
          }
        }
      },
      include: {
        scenes: true
      }
    });
    const assetRepository = deps.createPrismaAssetRepository();
    const projectRepository = deps.createPrismaProjectRepository();
    const editorialMicroclipRepository =
      deps.createPrismaEditorialMicroclipRepository();
    const analysis = await deps.analyzeAssetForMicroclips(assetRepository, {
      assetId: asset.id,
      targetDurationSeconds: 1.5,
      topN: 10,
      useCase: "football",
      preset: "football_hype"
    });
    const selectedCandidate = analysis.candidates[0];

    if (!selectedCandidate) {
      throw new Error("Microclip selector returned no candidates.");
    }

    const applied = await deps.applyMicroclipCandidate(
      {
        assetRepository,
        editorialMicroclipRepository,
        projectRepository
      },
      {
        projectId: project.id,
        sceneId: project.scenes[0]?.id ?? null,
        assetId: asset.id,
        candidateId: selectedCandidate.id,
        label: "chute forte",
        usageMode: "impact_moment"
      }
    );
    const blueprint = await deps.getVideoProjectRenderBlueprint(
      projectRepository,
      assetRepository,
      editorialMicroclipRepository,
      project.id
    );

    if (!blueprint.hasEditorialMicroclips || blueprint.microclipCount < 1) {
      throw new Error("Render Blueprint did not include the applied microclip.");
    }

    printSmokeSummary({
      smoke: "microclip-selector",
      status: "completed",
      projectId: project.id,
      sceneId: project.scenes[0]?.id ?? null,
      assetId: asset.id,
      candidateCount: analysis.candidates.length,
      selectedCandidateId: selectedCandidate.id,
      microclipId: applied.microclip.id,
      microclipCount: blueprint.microclipCount,
      totalMicroclipDurationSeconds: blueprint.totalMicroclipDurationSeconds,
      warnings: analysis.warnings
    });
  } finally {
    await deps.prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("[smoke:microclip-selector] failed", error);
  process.exitCode = 1;
});
