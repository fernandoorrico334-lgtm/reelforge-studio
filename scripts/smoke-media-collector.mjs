import { access, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  apiArtifactPath,
  ensureArtifactsExist,
  resolveApiBuildRoot
} from "./lib/smoke-utils.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");
const runId = `run-${Date.now().toString(36)}`;
const smokeTag = "smoke-media-collector-stage10d";

const pngFallbackBuffer = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWOYAAAAASUVORK5CYII=",
  "base64"
);

function log(message) {
  console.log(`[smoke:media-collector] ${message}`);
}

async function importModule(relativePath) {
  return import(pathToFileURL(join(projectRoot, relativePath)).href);
}

async function ensureBuildArtifacts() {
  const apiBuildRoot = await resolveApiBuildRoot(
    projectRoot,
    "Run 'npm run build --workspace @reelforge/media-collector' and 'npm run build --workspace @reelforge/api' before this smoke test."
  );
  const apiArtifacts = [
    "infrastructure/database/prisma-client.js",
    "modules/media-collector/application/media-collector-service.js",
    "modules/assets/infrastructure/prisma-asset-repository.js",
    "modules/assets/infrastructure/local-asset-storage.js",
    "modules/channels/infrastructure/prisma-channel-repository.js",
    "modules/intake/infrastructure/prisma-intake-repository.js",
    "modules/projects/infrastructure/prisma-project-repository.js",
    "modules/research/infrastructure/prisma-research-repository.js"
  ].map((relativePath) => apiArtifactPath(apiBuildRoot, relativePath));

  await ensureArtifactsExist(
    projectRoot,
    ["packages/media-collector/dist/index.js", ...apiArtifacts],
    "Run 'npm run build --workspace @reelforge/media-collector' and 'npm run build --workspace @reelforge/api' before this smoke test."
  );

  return { apiBuildRoot };
}

function createSilentWavBuffer(durationSeconds = 0.8, sampleRate = 16000) {
  const channelCount = 1;
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;
  const frameCount = Math.max(1, Math.round(durationSeconds * sampleRate));
  const dataSize = frameCount * channelCount * bytesPerSample;
  const byteRate = sampleRate * channelCount * bytesPerSample;
  const blockAlign = channelCount * bytesPerSample;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write("RIFF", 0, "ascii");
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8, "ascii");
  buffer.write("fmt ", 12, "ascii");
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(channelCount, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  buffer.write("data", 36, "ascii");
  buffer.writeUInt32LE(dataSize, 40);

  return buffer;
}

async function writeFallbackFixtures(tempDirectory) {
  const imagePath = join(tempDirectory, `media-collector-${runId}.png`);
  const audioPath = join(tempDirectory, `media-collector-${runId}.wav`);

  await writeFile(imagePath, pngFallbackBuffer);
  await writeFile(audioPath, createSilentWavBuffer());

  return { imagePath, audioPath };
}

async function createLocalFixtures() {
  const tempDirectory = await mkdtemp(
    join(tmpdir(), "reelforge-media-collector-smoke-")
  );
  const fixtures = await writeFallbackFixtures(tempDirectory);

  return {
    tempDirectory,
    ...fixtures
  };
}

async function loadSmokeDependencies(apiBuildRoot) {
  const [
    apiPrismaModule,
    assetRepositoryModule,
    assetStorageModule,
    channelRepositoryModule,
    intakeRepositoryModule,
    projectRepositoryModule,
    researchRepositoryModule,
    mediaCollectorModule
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
        "modules/assets/infrastructure/local-asset-storage.js"
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
        "modules/intake/infrastructure/prisma-intake-repository.js"
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
        "modules/media-collector/application/media-collector-service.js"
      )
    )
  ]);

  return {
    prisma: apiPrismaModule.prisma,
    createPrismaAssetRepository:
      assetRepositoryModule.createPrismaAssetRepository,
    createLocalAssetStorage: assetStorageModule.createLocalAssetStorage,
    createPrismaChannelRepository:
      channelRepositoryModule.createPrismaChannelRepository,
    createPrismaIntakeRepository:
      intakeRepositoryModule.createPrismaIntakeRepository,
    createPrismaProjectRepository:
      projectRepositoryModule.createPrismaProjectRepository,
    createPrismaResearchRepository:
      researchRepositoryModule.createPrismaResearchRepository,
    createMediaCollectorService:
      mediaCollectorModule.createMediaCollectorService
  };
}

async function createSmokeChannel(prismaClient) {
  return prismaClient.channel.create({
    data: {
      name: `Smoke Media Collector Channel ${runId}`,
      niche: "Smoke validation for Media Collector",
      language: "pt-BR",
      visualStyle: "Dark studio collector desk",
      narrativeTone: "Analitico e seguro",
      defaultTemplate: "mystery_doc",
      defaultRenderMode: "cinematic_v2",
      defaultRenderQuality: "standard",
      defaultAudioMood: "documentary_bed",
      defaultCaptionStyle: "documentary_clean",
      defaultVisualPreset: "mystery",
      defaultDurationTarget: 24,
      defaultSceneDuration: 4,
      preferredAssetCategories: JSON.stringify(["REFERENCE", "BROLL"]),
      preferredAssetTags: JSON.stringify(["arquivo", "coleta", "research"])
    }
  });
}

async function createSmokeResearchArtifacts(prismaClient, channelId) {
  const dossier = await prismaClient.researchDossier.create({
    data: {
      channelId,
      title: `Smoke Media Collector Dossier ${runId}`,
      topic: "Observatorio Meridian",
      niche: "documental",
      tone: "investigativo",
      targetDuration: 24,
      status: "researching",
      summary: null,
      narrativeAngle: null,
      editorialNotes: null,
      safetyNotes: null
    }
  });

  const requirement = await prismaClient.researchAssetRequirement.create({
    data: {
      dossierId: dossier.id,
      sceneRole: "context",
      description: "Observatorio Meridian exterior em noite fria",
      mediaType: "image",
      suggestedTags: JSON.stringify(["observatorio", "arquivo", "noite"]),
      emotion: "MYSTERIOUS",
      priority: 1,
      fulfilledAssetId: null
    }
  });

  return { dossier, requirement };
}

async function main() {
  const { apiBuildRoot } = await ensureBuildArtifacts();
  const fixtures = await createLocalFixtures();
  const deps = await loadSmokeDependencies(apiBuildRoot);

  try {
    const assetRepository = deps.createPrismaAssetRepository({
      prismaClient: deps.prisma
    });
    const assetStorage = deps.createLocalAssetStorage();
    const channelRepository = deps.createPrismaChannelRepository({
      prismaClient: deps.prisma
    });
    const intakeRepository = deps.createPrismaIntakeRepository({
      prismaClient: deps.prisma
    });
    const projectRepository = deps.createPrismaProjectRepository({
      prismaClient: deps.prisma
    });
    const researchRepository = deps.createPrismaResearchRepository({
      prismaClient: deps.prisma
    });
    const mediaCollector = deps.createMediaCollectorService({
      assetRepository,
      assetStorage,
      channelRepository,
      intakeRepository,
      projectRepository,
      researchRepository
    });

    const channel = await createSmokeChannel(deps.prisma);
    const researchArtifacts = await createSmokeResearchArtifacts(
      deps.prisma,
      channel.id
    );

    const collection = await mediaCollector.createCollection({
      name: `Smoke Manual URL Collection ${runId}`,
      channelId: channel.id,
      projectId: null,
      dossierId: null,
      assetRequirementId: null,
      provider: "manual-url",
      query: null,
      targetCount: 2,
      mediaType: null,
      notes: `Smoke validation ${smokeTag}.`
    });

    const imageCandidate = await mediaCollector.addManualUrlCandidate({
      collectionId: collection.id,
      name: null,
      channelId: channel.id,
      projectId: null,
      dossierId: null,
      assetRequirementId: null,
      title: `Smoke image ${runId}`,
      sourceUrl: pathToFileURL(fixtures.imagePath).href,
      mediaType: "image",
      category: "REFERENCE",
      franchise: "Smoke Media Collector",
      character: null,
      emotion: "MYSTERIOUS",
      tags: [smokeTag, runId, "image"],
      copyrightRisk: "LOW",
      recommendedUse: "Smoke image import",
      sourceAuthor: "ReelForge Smoke",
      sourceLicense: "local-generated",
      sourceLicenseUrl: null,
      usageNotes: "Arquivo local gerado para validar importacao manual-url."
    });

    const audioCandidate = await mediaCollector.addManualUrlCandidate({
      collectionId: collection.id,
      name: null,
      channelId: channel.id,
      projectId: null,
      dossierId: null,
      assetRequirementId: null,
      title: `Smoke audio ${runId}`,
      sourceUrl: pathToFileURL(fixtures.audioPath).href,
      mediaType: "music",
      category: "TRACK",
      franchise: "Smoke Media Collector",
      character: null,
      emotion: "NEUTRAL",
      tags: [smokeTag, runId, "audio"],
      copyrightRisk: "LOW",
      recommendedUse: "Smoke audio import",
      sourceAuthor: "ReelForge Smoke",
      sourceLicense: "local-generated",
      sourceLicenseUrl: null,
      usageNotes: "Audio local gerado para validar importacao manual-url."
    });

    await mediaCollector.approveCandidate(imageCandidate.id);
    await mediaCollector.approveCandidate(audioCandidate.id);

    const importSummary = await mediaCollector.importApproved(collection.id);

    if (importSummary.failedCount !== 0 || importSummary.importedCount !== 2) {
      throw new Error(
        `Expected 2 imported assets and 0 failures, got ${importSummary.importedCount} import(s) and ${importSummary.failedCount} failure(s).`
      );
    }

    const importedAssets = await deps.prisma.asset.findMany({
      where: {
        id: {
          in: importSummary.assetIds
        }
      }
    });

    if (importedAssets.length !== 2) {
      throw new Error(
        `Expected 2 imported asset records, found ${importedAssets.length}.`
      );
    }

    for (const asset of importedAssets) {
      if (asset.sourceProvider !== "manual-url") {
        throw new Error(
          `Imported asset '${asset.id}' is missing sourceProvider=manual-url.`
        );
      }

      if (asset.collectionId !== collection.id) {
        throw new Error(
          `Imported asset '${asset.id}' is missing collectionId '${collection.id}'.`
        );
      }

      const absolutePath = join(projectRoot, asset.path);
      const fileStats = await stat(absolutePath);

      if (fileStats.size <= 0) {
        throw new Error(`Imported asset '${asset.path}' has invalid size.`);
      }
    }

    const requirementCollection =
      await mediaCollector.createCollectionFromResearchRequirement(
        researchArtifacts.requirement.id
      );
    const dossierDetail = await researchRepository.getDossierById(
      researchArtifacts.dossier.id
    );
    const linkedRequirement = dossierDetail?.assetRequirements.find(
      (entry) => entry.id === researchArtifacts.requirement.id
    );

    if (
      !linkedRequirement?.mediaCollections.some(
        (entry) => entry.id === requirementCollection.id
      )
    ) {
      throw new Error(
        "Research requirement was not linked back to the created media collection."
      );
    }

    console.log(
      JSON.stringify(
        {
          collectionId: collection.id,
          candidateCount: 2,
          importedCount: importSummary.importedCount,
          assetIds: importSummary.assetIds,
          requirementCollectionId: requirementCollection.id,
          status: "completed",
          runId
        },
        null,
        2
      )
    );
  } finally {
    await deps.prisma.$disconnect();
    await rm(fixtures.tempDirectory, {
      recursive: true,
      force: true
    });
  }
}

await main();

