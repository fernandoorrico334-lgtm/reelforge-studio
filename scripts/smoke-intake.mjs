import { spawn } from "node:child_process";
import { mkdir, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  apiArtifactPath,
  ensureArtifactsExist,
  resolveApiBuildRoot,
  writeMinimalPng,
  writeMinimalWav
} from "./lib/smoke-utils.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");
const smokeTag = "smoke-intake-stage10b";
const runId = `run-${Date.now().toString(36)}`;
const npmCliPath =
  typeof process.env.npm_execpath === "string" &&
  process.env.npm_execpath.trim().length > 0
    ? process.env.npm_execpath
    : null;

const smokeFileDefinitions = [
  {
    relativePath: `storage/inbox/drop/images/smoke-intake-drop-image-${runId}.png`,
    kind: "image",
    expectedMediaType: "image"
  },
  {
    relativePath: `storage/inbox/drop/music/smoke-intake-bed-${runId}.wav`,
    kind: "audio",
    expectedMediaType: "music"
  },
  {
    relativePath: `storage/inbox/drop/sfx/smoke-intake-impact-${runId}.wav`,
    kind: "audio",
    expectedMediaType: "sfx"
  },
  {
    relativePath: `storage/inbox/characters/smoke-character/references/smoke-intake-character-${runId}.png`,
    kind: "image",
    expectedMediaType: "image"
  },
  {
    relativePath: `storage/inbox/projects/smoke-project/raw/smoke-intake-project-${runId}.png`,
    kind: "image",
    expectedMediaType: "image"
  }
];

function log(message) {
  console.log(`[smoke:intake] ${message}`);
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
      rejectPromise(error);
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolvePromise({ stdout, stderr });
        return;
      }

      const tail = `${stderr}${stdout}`
        .trim()
        .split(/\r?\n/u)
        .slice(-8)
        .join(" | ");
      rejectPromise(
        new Error(
          `Command '${command}' failed with code ${code ?? "unknown"}. ${tail || "No stdout/stderr output captured."}`
        )
      );
    });
  });
}

async function runNpm(argumentsList) {
  if (!npmCliPath) {
    throw new Error(
      "npm_execpath is unavailable. Run the smoke test through 'npm run smoke:intake'."
    );
  }

  return runCommand(process.execPath, [npmCliPath, ...argumentsList]);
}

async function importModule(relativePath) {
  return import(pathToFileURL(join(projectRoot, relativePath)).href);
}

async function ensureBuildArtifacts() {
  const apiBuildRoot = await resolveApiBuildRoot(
    projectRoot,
    "Run 'npm run build' before running smoke:intake."
  );
  const apiArtifacts = [
    "infrastructure/database/prisma-client.js",
    "modules/assets/infrastructure/prisma-asset-repository.js",
    "modules/intake/infrastructure/prisma-intake-repository.js",
    "modules/intake/application/intake-service.js"
  ].map((relativePath) => apiArtifactPath(apiBuildRoot, relativePath));

  await ensureArtifactsExist(
    projectRoot,
    apiArtifacts,
    "Run 'npm run build' before running smoke:intake."
  );

  return { apiBuildRoot };
}

async function checkBinaryAvailable(binaryName) {
  try {
    await runCommand(binaryName, ["-version"]);
    return true;
  } catch {
    return false;
  }
}

async function writeFallbackFile(relativePath, kind) {
  const absolutePath = join(projectRoot, relativePath);
  await mkdir(dirname(absolutePath), { recursive: true });

  if (kind === "image") {
    await writeMinimalPng(absolutePath, relativePath);
    return absolutePath;
  }

  await writeMinimalWav(absolutePath, 0.6, 16000, relativePath);
  return absolutePath;
}

async function writeFfmpegFile(relativePath, kind, index) {
  const absolutePath = join(projectRoot, relativePath);
  await mkdir(dirname(absolutePath), { recursive: true });

  if (kind === "image") {
    const colors = ["#20314d", "#4d2035", "#203f37", "#3c294f", "#32411e"];
    await runCommand("ffmpeg", [
      "-y",
      "-f",
      "lavfi",
      "-i",
      `color=c=${colors[index % colors.length]}:s=1080x1920`,
      "-frames:v",
      "1",
      "-pix_fmt",
      "rgb24",
      absolutePath
    ]);
    return absolutePath;
  }

  const frequencies = [220, 330, 440, 550, 660];
  await runCommand("ffmpeg", [
    "-y",
    "-f",
    "lavfi",
    "-i",
    `sine=frequency=${frequencies[index % frequencies.length]}:sample_rate=44100:duration=0.8`,
    "-c:a",
    "pcm_s16le",
    absolutePath
  ]);
  return absolutePath;
}

async function createSmokeFiles() {
  const ffmpegAvailable = await checkBinaryAvailable("ffmpeg");

  log(
    ffmpegAvailable
      ? "FFmpeg detected. Generating full-size sample media."
      : "FFmpeg unavailable. Falling back to minimal valid PNG/WAV fixtures."
  );

  const created = [];

  for (const [index, definition] of smokeFileDefinitions.entries()) {
    const absolutePath = ffmpegAvailable
      ? await writeFfmpegFile(definition.relativePath, definition.kind, index)
      : await writeFallbackFile(definition.relativePath, definition.kind);
    const fileStats = await stat(absolutePath);

    created.push({
      ...definition,
      absolutePath,
      fileSize: fileStats.size
    });
  }

  return created;
}

async function loadSmokeDependencies(apiBuildRoot) {
  const [
    apiPrismaModule,
    assetRepositoryModule,
    intakeRepositoryModule,
    intakeServiceModule
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
        "modules/intake/infrastructure/prisma-intake-repository.js"
      )
    ),
    importModule(
      apiArtifactPath(apiBuildRoot, "modules/intake/application/intake-service.js")
    )
  ]);

  return {
    prisma: apiPrismaModule.prisma,
    createPrismaAssetRepository:
      assetRepositoryModule.createPrismaAssetRepository,
    createPrismaIntakeRepository:
      intakeRepositoryModule.createPrismaIntakeRepository,
    scanInbox: intakeServiceModule.scanInbox,
    approveIntakeCandidate: intakeServiceModule.approveIntakeCandidate,
    importApprovedInboxCandidates:
      intakeServiceModule.importApprovedInboxCandidates
  };
}

function matchesRunCandidate(candidate) {
  return (
    typeof candidate.originalPath === "string" &&
    candidate.originalPath.includes(runId)
  );
}

async function ensureNoPreexistingApprovedCandidates(prismaClient) {
  const approvedCandidates = await prismaClient.mediaCandidate.findMany({
    where: {
      provider: "manual-intake",
      status: "approved"
    },
    select: {
      id: true,
      title: true,
      originalPath: true
    }
  });

  if (approvedCandidates.length > 0) {
    const sample = approvedCandidates
      .slice(0, 3)
      .map((candidate) => candidate.originalPath ?? candidate.title)
      .join(", ");

    throw new Error(
      `There are ${approvedCandidates.length} approved intake candidate(s) already pending import (${sample}). Import or clear them before running smoke:intake to avoid touching real review data.`
    );
  }
}

async function prepareCandidates(deps, createdFiles) {
  const intakeRepository = deps.createPrismaIntakeRepository({
    prismaClient: deps.prisma
  });
  const assetRepository = deps.createPrismaAssetRepository({
    prismaClient: deps.prisma
  });

  const scanSummary = await deps.scanInbox(intakeRepository, assetRepository);
  const runCandidates = scanSummary.candidates.filter(matchesRunCandidate);

  if (runCandidates.length !== createdFiles.length) {
    throw new Error(
      `Expected ${createdFiles.length} smoke candidates after scan, but found ${runCandidates.length}.`
    );
  }

  const characterReference = runCandidates.find((candidate) =>
    candidate.originalPath?.includes("/characters/smoke-character/references/")
  );
  const projectMaterial = runCandidates.find((candidate) =>
    candidate.originalPath?.includes("/projects/smoke-project/raw/")
  );

  if (
    !characterReference ||
    characterReference.suggestedCharacter !== "smoke-character" ||
    !characterReference.suggestedTags.includes("character-reference")
  ) {
    throw new Error(
      "Character reference candidate was not inferred correctly from storage/inbox/characters."
    );
  }

  if (
    !projectMaterial ||
    projectMaterial.suggestedProject !== "smoke-project" ||
    projectMaterial.recommendedUse !== "project-material"
  ) {
    throw new Error(
      "Project material candidate was not inferred correctly from storage/inbox/projects."
    );
  }

  for (const candidate of runCandidates) {
    await intakeRepository.updateCandidate(candidate.id, {
      tags: [...new Set([...candidate.tags, smokeTag, runId])],
      copyrightRisk: "LOW",
      sourceAuthor: "smoke:intake",
      sourceLicense: "local-generated",
      usageNotes: `Smoke intake validation ${runId}.`,
      recommendedUse:
        candidate.recommendedUse ??
        (candidate.originalPath?.includes("/projects/")
          ? "project-material"
          : "smoke-import")
    });
    await deps.approveIntakeCandidate(intakeRepository, candidate.id);
  }

  const refreshedCandidates = await Promise.all(
    runCandidates.map((candidate) => intakeRepository.getCandidateById(candidate.id))
  );

  if (refreshedCandidates.some((candidate) => candidate?.status !== "approved")) {
    throw new Error("Not every smoke candidate reached approved status.");
  }

  return {
    intakeRepository,
    assetRepository,
    scanSummary,
    runCandidates: refreshedCandidates.filter(Boolean)
  };
}

async function validateImportedAssets(prismaClient, candidates, importSummary) {
  if (importSummary.failedCount !== 0) {
    throw new Error(
      `Expected zero intake import failures, but got ${importSummary.failedCount}.`
    );
  }

  if (importSummary.importedCount !== candidates.length) {
    throw new Error(
      `Expected ${candidates.length} imported candidates, but got ${importSummary.importedCount}.`
    );
  }

  const candidateIds = candidates.map((candidate) => candidate.id);
  const refreshedCandidates = await prismaClient.mediaCandidate.findMany({
    where: {
      id: {
        in: candidateIds
      }
    }
  });

  if (
    refreshedCandidates.length !== candidates.length ||
    refreshedCandidates.some(
      (candidate) => candidate.status !== "imported" || !candidate.assetId
    )
  ) {
    throw new Error(
      "Imported candidates were not persisted with status 'imported' and linked asset ids."
    );
  }

  const assetIds = refreshedCandidates
    .map((candidate) => candidate.assetId)
    .filter((assetId) => typeof assetId === "string");
  const importedAssets = await prismaClient.asset.findMany({
    where: {
      id: {
        in: assetIds
      }
    }
  });

  if (importedAssets.length !== candidates.length) {
    throw new Error(
      `Expected ${candidates.length} imported assets, but found ${importedAssets.length}.`
    );
  }

  for (const asset of importedAssets) {
    if (asset.sourceProvider !== "manual-intake") {
      throw new Error(
        `Imported asset '${asset.id}' is missing sourceProvider=manual-intake.`
      );
    }

    const absoluteAssetPath = join(projectRoot, asset.path);
    const fileStats = await stat(absoluteAssetPath);

    if (fileStats.size <= 0) {
      throw new Error(`Imported asset '${asset.path}' has invalid size.`);
    }
  }

  return {
    refreshedCandidates,
    importedAssets
  };
}

async function main() {
  const { apiBuildRoot } = await ensureBuildArtifacts();
  const deps = await loadSmokeDependencies(apiBuildRoot);

  try {
    await ensureNoPreexistingApprovedCandidates(deps.prisma);
    const createdFiles = await createSmokeFiles();
    log(`Created ${createdFiles.length} local inbox fixture(s) for ${runId}.`);

    const prepared = await prepareCandidates(deps, createdFiles);
    log(
      `Scan linked ${prepared.runCandidates.length} smoke candidate(s) to collection ${prepared.scanSummary.collection.id}.`
    );

    const importSummary = await deps.importApprovedInboxCandidates(
      prepared.intakeRepository,
      prepared.assetRepository
    );
    const validation = await validateImportedAssets(
      deps.prisma,
      prepared.runCandidates,
      importSummary
    );

    console.log(
      JSON.stringify(
        {
          collectionId: prepared.scanSummary.collection.id,
          candidatesCreated: prepared.runCandidates.length,
          importedCount: importSummary.importedCount,
          assetIds: validation.importedAssets.map((asset) => asset.id),
          status: "completed",
          runId,
          smokeTag
        },
        null,
        2
      )
    );
  } finally {
    await deps.prisma.$disconnect();
  }
}

await main();

