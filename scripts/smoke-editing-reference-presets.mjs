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
  safeCheckFfprobe
} from "./lib/smoke-utils.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");
const smokeReferenceTitle = "Smoke Editing Reference Local";
const smokeReferenceSlug = "smoke-editing-reference-football";
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
    "Run 'npm run build' before running smoke:editing-reference-presets."
  );
  const apiArtifacts = [
    "infrastructure/database/prisma-client.js",
    "modules/assets/infrastructure/prisma-asset-repository.js",
    "modules/editing-references/infrastructure/prisma-editing-reference-repository.js",
    "modules/editing-references/application/editing-reference-service.js"
  ].map((relativePath) => apiArtifactPath(apiBuildRoot, relativePath));

  await ensureArtifactsExist(
    projectRoot,
    ["packages/editing-reference-engine/dist/index.js", ...apiArtifacts],
    "Run 'npm run build' before running smoke:editing-reference-presets."
  );

  return { apiBuildRoot };
}

async function loadDependencies(apiBuildRoot) {
  const [
    prismaModule,
    assetRepositoryModule,
    editingReferenceRepositoryModule,
    editingReferenceServiceModule
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
        "modules/editing-references/infrastructure/prisma-editing-reference-repository.js"
      )
    ),
    importModule(
      apiArtifactPath(
        apiBuildRoot,
        "modules/editing-references/application/editing-reference-service.js"
      )
    )
  ]);

  return {
    prisma: prismaModule.prisma,
    createPrismaAssetRepository: assetRepositoryModule.createPrismaAssetRepository,
    createPrismaEditingReferenceRepository:
      editingReferenceRepositoryModule.createPrismaEditingReferenceRepository,
    createEditingReference: editingReferenceServiceModule.createEditingReference,
    analyzeStoredEditingReference:
      editingReferenceServiceModule.analyzeStoredEditingReference,
    buildPresetFromEditingReference:
      editingReferenceServiceModule.buildPresetFromEditingReference,
    getEditingReferencePresetSuggestions:
      editingReferenceServiceModule.getEditingReferencePresetSuggestions
  };
}

async function cleanupPreviousSmokeData(prismaClient) {
  await prismaClient.editingReferencePreset.deleteMany({
    where: {
      OR: [
        { slug: { startsWith: smokeReferenceSlug } },
        { name: { startsWith: "Smoke Editing Reference" } }
      ]
    }
  });
  await prismaClient.editingReference.deleteMany({
    where: {
      title: { startsWith: smokeReferenceTitle }
    }
  });
}

async function ensureReferenceVideo(ffmpegCommand) {
  const relativePath = `${smokeReferenceRoot}/smoke-editing-reference-grid.mp4`;
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
    "color=c=black:s=720x1280:d=2:r=24",
    "-f",
    "lavfi",
    "-i",
    "color=c=navy:s=720x1280:d=2:r=24",
    "-f",
    "lavfi",
    "-i",
    "color=c=red:s=720x1280:d=2:r=24",
    "-f",
    "lavfi",
    "-i",
    "sine=frequency=720:sample_rate=48000:duration=6",
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

  return { relativePath, absolutePath };
}

async function main() {
  const ffmpeg = await safeCheckFfmpeg(runCommand);
  const ffprobe = await safeCheckFfprobe(runCommand);

  if (!ffmpeg.available || !ffprobe.available) {
    printSmokeSummary({
      status: "skipped",
      reason:
        ffmpeg.errorMessage ??
        ffprobe.errorMessage ??
        "FFmpeg/FFprobe unavailable.",
      ffmpeg: ffmpeg.versionLine,
      ffprobe: ffprobe.versionLine
    });
    return;
  }

  const { apiBuildRoot } = await ensureBuildArtifacts();
  const dependencies = await loadDependencies(apiBuildRoot);
  await cleanupPreviousSmokeData(dependencies.prisma);

  const referenceVideo = await ensureReferenceVideo(ffmpeg.command);
  const assetRepository = dependencies.createPrismaAssetRepository();
  const editingReferenceRepository =
    dependencies.createPrismaEditingReferenceRepository();

  const createdReference = await dependencies.createEditingReference(
    editingReferenceRepository,
    assetRepository,
    {
      title: `${smokeReferenceTitle} Football`,
      description:
        "Smoke local reference for editorial cut pace, captions and football hype cadence.",
      assetId: null,
      localPath: referenceVideo.relativePath,
      sourceType: "local_file",
      category: "football",
      status: "draft",
      durationSeconds: null,
      averageCutPaceSeconds: null,
      beatIntensity: "medium",
      pacing: "medium",
      zoomStyle: "aggressive",
      flashStyle: "medium",
      transitionStyle: "flash_cut",
      captionStyle: "center_bold",
      narrationStyle: "hype",
      musicStyle: "hype",
      sfxStyle: "high",
      hookStyle: "explosive",
      ctaStyle: "strong",
      microclipPlacement: "climax",
      visualStyleNotes: "Smoke reference generated locally with clear scene changes.",
      audioStyleNotes: "Synthetic tone for audio energy estimation.",
      editingStyleNotes: "Used to validate local editorial preset extraction.",
      analysisWarnings: []
    }
  );
  const analysisResult = await dependencies.analyzeStoredEditingReference(
    editingReferenceRepository,
    createdReference.id
  );

  assert(
    analysisResult.analysis.status === "completed",
    "Editing reference analysis should complete when FFmpeg/FFprobe are available."
  );
  assert(
    typeof analysisResult.reference.durationSeconds === "number" &&
      analysisResult.reference.durationSeconds > 0,
    "Editing reference duration was not persisted."
  );
  assert(
    typeof analysisResult.reference.averageCutPaceSeconds === "number" &&
      analysisResult.reference.averageCutPaceSeconds > 0,
    "Editing reference average cut pace was not persisted."
  );

  const builtPreset = await dependencies.buildPresetFromEditingReference(
    editingReferenceRepository,
    createdReference.id,
    {
      name: "Smoke Editing Reference Football Preset",
      slug: smokeReferenceSlug,
      recommendedTemplates: ["sports_hype", "player_threat_analysis"],
      notes: "Smoke derived preset for local editorial validation."
    }
  );
  const suggestions = await dependencies.getEditingReferencePresetSuggestions(
    editingReferenceRepository,
    "sports_hype"
  );
  const matchingSuggestion = suggestions.find(
    (item) => item.preset.slug === builtPreset.preset.slug
  );

  assert(
    builtPreset.preset.referenceId === createdReference.id,
    "Built editing reference preset is not linked to the source reference."
  );
  assert(
    builtPreset.preset.recommendedTemplates.includes("sports_hype"),
    "Built editing reference preset does not recommend the target template."
  );
  assert(
    matchingSuggestion,
    "Editing reference preset suggestions did not include the new preset."
  );

  printSmokeSummary({
    referenceId: createdReference.id,
    presetId: builtPreset.preset.id,
    templateId: "sports_hype",
    durationSeconds: analysisResult.reference.durationSeconds,
    averageCutPaceSeconds: analysisResult.reference.averageCutPaceSeconds,
    beatIntensity: analysisResult.reference.beatIntensity,
    pacing: analysisResult.reference.pacing,
    warningCount: analysisResult.analysis.warnings.length,
    sourceVideo: referenceVideo.relativePath,
    status: "completed"
  });
}

await main();
