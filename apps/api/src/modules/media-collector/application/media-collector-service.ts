import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildSearchQueriesFromAssetRequirement,
  normalizeMediaType,
  type MediaProviderCandidateLike
} from "@reelforge/media-collector";
import { NotFoundError, ValidationError } from "../../../shared/errors.js";
import type { AssetRepository } from "../../assets/application/asset-repository.js";
import type {
  AssetStorage,
  AssetUploadFile
} from "../../assets/application/asset-storage.js";
import {
  normalizeOptionalAssetCategoryValue,
  type AssetCategory,
  type StudioAsset
} from "../../assets/domain/asset.js";
import type { ChannelRepository } from "../../channels/application/channel-repository.js";
import type { StudioChannel } from "../../channels/domain/channel.js";
import type { IntakeRepository } from "../../intake/application/intake-repository.js";
import {
  approveIntakeCandidate,
  getIntakeCandidateById,
  getIntakeCollectionById,
  listIntakeCandidates,
  updateIntakeCandidate
} from "../../intake/application/intake-service.js";
import type {
  CreateMediaCandidateInput,
  IntakeMediaType,
  MediaCandidate,
  MediaCollection
} from "../../intake/domain/intake.js";
import {
  importCandidateFile,
  resolveAssetCategoryFromCandidate,
  resolveAssetTypeFromCandidate
} from "../../intake/infrastructure/intake-filesystem.js";
import type { ProjectRepository } from "../../projects/application/project-repository.js";
import type { ResearchRepository } from "../../research/application/research-repository.js";
import type {
  CreateMediaCollectionRequestInput,
  CreateManualUrlCandidateInput,
  CreateMediaCollectionsForProjectSummary,
  MediaCollectionSearchSummary,
  MediaCollectorProviderDescriptor,
  MediaCollectorProviderId
} from "../domain/media-collector.js";
import {
  getMediaProviderApiKey,
  getMediaProviderEntry,
  resolveMediaProviderEntries
} from "../infrastructure/media-provider-registry.js";

interface MediaCollectorDependencies {
  assetRepository: AssetRepository;
  assetStorage: AssetStorage;
  channelRepository: ChannelRepository;
  intakeRepository: IntakeRepository;
  projectRepository: ProjectRepository;
  researchRepository: ResearchRepository;
}

interface ImportCandidateOutcome {
  candidateId: string;
  assetId: string | null;
  error: string | null;
}

function buildCollectionNotFoundError(collectionId: string) {
  return new NotFoundError(
    `Media collection '${collectionId}' was not found.`
  );
}

function buildCandidateNotFoundError(candidateId: string) {
  return new NotFoundError(
    `Media candidate '${candidateId}' was not found.`
  );
}

function compareMaybeString(
  left: string | null | undefined,
  right: string | null | undefined
) {
  return (left ?? "").trim().toLowerCase() === (right ?? "").trim().toLowerCase();
}

function toProviderCandidate(candidate: MediaCandidate): MediaProviderCandidateLike {
  return {
    title: candidate.title,
    previewUrl: candidate.previewUrl,
    downloadUrl: candidate.downloadUrl,
    sourceUrl: candidate.sourceUrl,
    mediaType: candidate.mediaType,
    mimeType: candidate.mimeType,
    extension: candidate.extension
  };
}

function normalizeSuggestedCategory(
  value: string | null | undefined
): AssetCategory | null {
  if (!value) {
    return null;
  }

  try {
    return normalizeOptionalAssetCategoryValue(value, "suggestedCategory") ?? null;
  } catch {
    return null;
  }
}

function createUploadFile(
  filename: string,
  mimeType: string | null,
  buffer: Buffer
): AssetUploadFile {
  const arrayBuffer = Uint8Array.from(buffer).buffer;

  return {
    name: filename,
    size: buffer.byteLength,
    type: mimeType ?? "",
    async arrayBuffer() {
      return arrayBuffer;
    }
  };
}

function buildCollectionName(prefix: string, title: string) {
  return `${prefix}: ${title}`.slice(0, 120);
}

function buildProjectSceneQuery(
  projectTitle: string,
  scene: {
    title: string;
    narrationText: string | null;
    captionText: string | null;
    emotion: string | null;
    visualPreset: string | null;
  },
  channel: StudioChannel
) {
  return [
    projectTitle,
    scene.title,
    scene.narrationText ?? "",
    scene.captionText ?? "",
    scene.emotion ?? "",
    scene.visualPreset ?? "",
    ...channel.preferredAssetTags
  ]
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

async function syncCollectionStats(
  repository: IntakeRepository,
  collectionId: string,
  statusOverride?: MediaCollection["status"]
) {
  const candidates = await repository.listCandidates({ collectionId });
  const pendingCount = candidates.filter((candidate) => candidate.status === "pending").length;
  const approvedCount = candidates.filter((candidate) => candidate.status === "approved").length;
  const rejectedCount = candidates.filter((candidate) => candidate.status === "rejected").length;
  const importedCount = candidates.filter((candidate) => candidate.status === "imported").length;
  const failedCount = candidates.filter((candidate) => candidate.status === "failed").length;
  const nextStatus =
    statusOverride ??
    (approvedCount === 0 && pendingCount === 0
      ? failedCount > 0
        ? "failed"
        : "completed"
      : "ready_for_review");

  return repository.updateCollection(collectionId, {
    status: nextStatus,
    targetCount: candidates.length,
    importedCount,
    rejectedCount,
    notes:
      nextStatus === "completed"
        ? "Colecao revisada e importada."
        : nextStatus === "failed"
          ? "Colecao com falhas pendentes."
          : "Colecao pronta para revisao."
  });
}

async function requireCollection(
  repository: IntakeRepository,
  collectionId: string
) {
  const collection = await repository.getCollectionById(collectionId);

  if (!collection) {
    throw buildCollectionNotFoundError(collectionId);
  }

  return collection;
}

async function requireCandidate(
  repository: IntakeRepository,
  candidateId: string
) {
  const candidate = await repository.getCandidateById(candidateId);

  if (!candidate) {
    throw buildCandidateNotFoundError(candidateId);
  }

  return candidate;
}

function isDuplicateCandidate(
  existingCandidates: MediaCandidate[],
  candidateInput: Pick<
    CreateMediaCandidateInput,
    "sourceUrl" | "downloadUrl" | "title" | "provider" | "mediaType"
  >
) {
  return existingCandidates.some((existing) => {
    if (
      existing.sourceUrl &&
      candidateInput.sourceUrl &&
      compareMaybeString(existing.sourceUrl, candidateInput.sourceUrl)
    ) {
      return true;
    }

    if (
      existing.downloadUrl &&
      candidateInput.downloadUrl &&
      compareMaybeString(existing.downloadUrl, candidateInput.downloadUrl)
    ) {
      return true;
    }

    return (
      compareMaybeString(existing.provider, candidateInput.provider) &&
      compareMaybeString(existing.title, candidateInput.title) &&
      existing.mediaType === candidateInput.mediaType
    );
  });
}

async function ensureTargetCollection(
  intakeRepository: IntakeRepository,
  input:
    | CreateManualUrlCandidateInput
    | (CreateMediaCollectionRequestInput & {
        provider: MediaCollectorProviderId;
      })
) {
  if ("collectionId" in input && input.collectionId) {
    return requireCollection(intakeRepository, input.collectionId);
  }

  return intakeRepository.createCollection({
    name:
      "title" in input
        ? buildCollectionName("Manual URL", input.name ?? input.title)
        : input.name,
    channelId: input.channelId,
    projectId: input.projectId,
    dossierId: input.dossierId,
    assetRequirementId: input.assetRequirementId,
    provider: "provider" in input ? input.provider : "manual-url",
    query: "query" in input ? input.query : input.title,
    sourcePath: null,
    mediaType: "mediaType" in input ? input.mediaType : null,
    status: "draft",
    targetCount: "targetCount" in input ? input.targetCount : 1,
    importedCount: 0,
    rejectedCount: 0,
    notes: "notes" in input ? input.notes : "Colecao criada a partir de URL direta."
  });
}

async function importStoredFileAsAsset(
  assetStorage: AssetStorage,
  assetRepository: AssetRepository,
  candidate: MediaCandidate,
  storedFile: {
    filename: string;
    path: string;
    type: NonNullable<ReturnType<typeof resolveAssetTypeFromCandidate>>;
    mimeType: string;
    extension: string;
    fileSize: number;
    width: number | null;
    height: number | null;
  }
) {
  return assetRepository.create({
    filename: storedFile.filename,
    originalName:
      candidate.originalPath?.split(/[\\/]/u).at(-1) ??
      candidate.title + (storedFile.extension || ""),
    path: storedFile.path,
    type: storedFile.type,
    category: resolveAssetCategoryFromCandidate(candidate),
    franchise: candidate.franchise,
    character: candidate.character ?? candidate.suggestedCharacter,
    emotion: candidate.emotion,
    tags: candidate.tags.length > 0 ? candidate.tags : candidate.suggestedTags,
    licenseType: candidate.sourceLicense ?? "manual-review-required",
    copyrightRisk: candidate.copyrightRisk ?? "UNKNOWN",
    recommendedUse: candidate.recommendedUse,
    duration: candidate.duration,
    width: storedFile.width,
    height: storedFile.height,
    mimeType: storedFile.mimeType,
    extension: storedFile.extension,
    fileSize: storedFile.fileSize,
    sourceProvider: candidate.provider,
    sourceUrl: candidate.sourceUrl ?? candidate.downloadUrl ?? candidate.previewUrl,
    sourceAuthor: candidate.sourceAuthor,
    sourceLicense: candidate.sourceLicense,
    sourceLicenseUrl: candidate.sourceLicenseUrl,
    downloadedAt: new Date().toISOString(),
    collectionId: candidate.collectionId,
    usageNotes: candidate.usageNotes
  });
}

async function importRemoteOrManualCandidate(
  candidate: MediaCandidate,
  providerId: MediaCollectorProviderId,
  providerEntry: NonNullable<ReturnType<typeof getMediaProviderEntry>>,
  assetStorage: AssetStorage,
  assetRepository: AssetRepository
) {
  const assetType = resolveAssetTypeFromCandidate(candidate);

  if (!assetType) {
    throw new ValidationError(
      "This candidate does not map to a supported AssetType yet."
    );
  }

  const tempDirectory = await mkdtemp(
    join(tmpdir(), "reelforge-media-collector-")
  );

  try {
    const downloaded = await providerEntry.provider.download(
      toProviderCandidate(candidate),
      tempDirectory
    );
    const buffer = await readFile(downloaded.localPath);
    const stored = await assetStorage.storeUpload({
      category: resolveAssetCategoryFromCandidate(candidate),
      requestedType: assetType,
      file: createUploadFile(downloaded.filename, downloaded.mimeType, buffer)
    });

    return importStoredFileAsAsset(
      assetStorage,
      assetRepository,
      candidate,
      {
        ...stored,
        type: stored.type as NonNullable<ReturnType<typeof resolveAssetTypeFromCandidate>>
      }
    );
  } finally {
    await rm(tempDirectory, {
      recursive: true,
      force: true
    });
  }
}

async function importSingleCandidate(
  dependencies: MediaCollectorDependencies,
  candidate: MediaCandidate
): Promise<ImportCandidateOutcome> {
  try {
    if (candidate.provider === "manual-intake") {
      const importedFile = await importCandidateFile(candidate);

      if (!importedFile) {
        throw new ValidationError(
          "Nao foi possivel copiar o arquivo do inbox para storage/assets."
        );
      }

      const asset = await importStoredFileAsAsset(
        dependencies.assetStorage,
        dependencies.assetRepository,
        candidate,
        importedFile
      );

      await dependencies.intakeRepository.updateCandidate(candidate.id, {
        status: "imported",
        assetId: asset.id,
        extension: importedFile.extension,
        mimeType: importedFile.mimeType,
        fileSize: importedFile.fileSize,
        width: importedFile.width,
        height: importedFile.height,
        errorMessage: null
      });

      return {
        candidateId: candidate.id,
        assetId: asset.id,
        error: null
      };
    }

    const providerId = candidate.provider as MediaCollectorProviderId;
    const providerEntry = getMediaProviderEntry(providerId);

    if (!providerEntry) {
      throw new ValidationError(
        `Provider '${candidate.provider}' is not supported by Media Collector.`
      );
    }

    const asset = await importRemoteOrManualCandidate(
      candidate,
      providerId,
      providerEntry,
      dependencies.assetStorage,
      dependencies.assetRepository
    );

    await dependencies.intakeRepository.updateCandidate(candidate.id, {
      status: "imported",
      assetId: asset.id,
      errorMessage: null
    });

    return {
      candidateId: candidate.id,
      assetId: asset.id,
      error: null
    };
  } catch (error) {
    const message =
      error instanceof Error && error.message.trim()
        ? error.message.trim()
        : "Importacao falhou.";

    await dependencies.intakeRepository.updateCandidate(candidate.id, {
      status: "failed",
      errorMessage: message
    });

    return {
      candidateId: candidate.id,
      assetId: null,
      error: message
    };
  }
}

export function createMediaCollectorService(
  dependencies: MediaCollectorDependencies
) {
  const {
    assetRepository,
    assetStorage,
    channelRepository,
    intakeRepository,
    projectRepository,
    researchRepository
  } = dependencies;

  return {
    listProviders(): MediaCollectorProviderDescriptor[] {
      return resolveMediaProviderEntries().map((entry) => entry.descriptor);
    },

    async listCollections() {
      return intakeRepository.listCollections();
    },

    async getCollectionById(collectionId: string) {
      return getIntakeCollectionById(intakeRepository, collectionId);
    },

    async listCollectionCandidates(collectionId: string) {
      await requireCollection(intakeRepository, collectionId);
      return listIntakeCandidates(intakeRepository, { collectionId });
    },

    async getCandidateById(candidateId: string) {
      return getIntakeCandidateById(intakeRepository, candidateId);
    },

    async createCollection(input: CreateMediaCollectionRequestInput) {
      const providerEntry = getMediaProviderEntry(input.provider);

      if (!providerEntry) {
        throw new ValidationError(`Provider '${input.provider}' is not supported.`);
      }

      return intakeRepository.createCollection({
        name: input.name,
        channelId: input.channelId,
        projectId: input.projectId,
        dossierId: input.dossierId,
        assetRequirementId: input.assetRequirementId,
        provider: input.provider,
        query: input.query,
        sourcePath: null,
        mediaType: input.mediaType,
        status: "draft",
        targetCount: input.targetCount,
        importedCount: 0,
        rejectedCount: 0,
        notes: input.notes
      });
    },

    async searchCollection(collectionId: string): Promise<MediaCollectionSearchSummary> {
      const collection = await requireCollection(intakeRepository, collectionId);
      const providerId = collection.provider as MediaCollectorProviderId;
      const providerEntry = getMediaProviderEntry(providerId);

      if (!providerEntry) {
        throw new ValidationError(
          `Provider '${collection.provider}' is not supported.`
        );
      }

      if (providerId === "manual-url") {
        throw new ValidationError(
          "manual-url collections do not support search. Add direct candidates manually."
        );
      }

      await intakeRepository.updateCollection(collectionId, {
        status: "scanning",
        notes: "Buscando candidatos no provider configurado."
      });

      const results = await providerEntry.provider.search(collection.query ?? "", {
        limit: collection.targetCount ?? 8,
        mediaType: collection.mediaType,
        apiKey: getMediaProviderApiKey(providerId)
      });
      const existingCandidates = await intakeRepository.listCandidates({
        collectionId
      });
      let candidatesCreated = 0;
      let candidatesSkipped = 0;

      for (const result of results) {
        const details = (await providerEntry.provider.getCandidateDetails({
          title: result.title,
          previewUrl: result.previewUrl,
          downloadUrl: result.downloadUrl,
          sourceUrl: result.sourceUrl,
          mediaType: result.mediaType,
          mimeType: result.mimeType,
          extension: result.extension
        })) as Partial<{
          mediaType: string | null;
          detectedType: string | null;
          suggestedCategory: string | null;
          suggestedTags: string[];
          suggestedCharacter: string | null;
          suggestedProject: string | null;
          extension: string | null;
          mimeType: string | null;
          usageNotes: string | null;
        }>;
        const mediaType = normalizeMediaType(
          (details.mediaType as string | null | undefined) ?? result.mediaType
        ) as IntakeMediaType;
        const candidateInput: CreateMediaCandidateInput = {
          collectionId,
          provider: providerId,
          originalPath: null,
          title: result.title,
          previewUrl: result.previewUrl,
          downloadUrl: result.downloadUrl,
          sourceUrl: result.sourceUrl,
          sourceAuthor: result.sourceAuthor,
          sourceLicense: result.sourceLicense,
          sourceLicenseUrl: result.sourceLicenseUrl,
          mediaType,
          detectedType:
            (details.detectedType as string | null | undefined) ??
            result.detectedType,
          suggestedCategory: normalizeSuggestedCategory(
            (details.suggestedCategory as string | null | undefined) ??
              result.suggestedCategory
          ),
          suggestedTags:
            (details.suggestedTags as string[] | undefined) ?? result.suggestedTags,
          suggestedCharacter:
            (details.suggestedCharacter as string | null | undefined) ?? null,
          suggestedProject:
            collection.projectId ??
            (details.suggestedProject as string | null | undefined) ??
            null,
          width: result.width,
          height: result.height,
          duration: result.duration,
          fileSize: result.fileSize,
          extension:
            (details.extension as string | null | undefined) ?? result.extension,
          mimeType:
            (details.mimeType as string | null | undefined) ?? result.mimeType,
          category: null,
          franchise: null,
          character: null,
          emotion: null,
          tags: [],
          copyrightRisk: null,
          recommendedUse:
            (details.usageNotes as string | null | undefined) ?? result.usageNotes,
          usageNotes:
            (details.usageNotes as string | null | undefined) ?? result.usageNotes,
          status: "pending",
          assetId: null,
          errorMessage: null,
          contentHash: null
        };

        if (isDuplicateCandidate(existingCandidates, candidateInput)) {
          candidatesSkipped += 1;
          continue;
        }

        const created = await intakeRepository.createCandidate(candidateInput);
        existingCandidates.push(created);
        candidatesCreated += 1;
      }

      await syncCollectionStats(intakeRepository, collectionId, "ready_for_review");

      return {
        collectionId,
        candidatesCreated,
        candidatesSkipped
      };
    },

    async addManualUrlCandidate(input: CreateManualUrlCandidateInput) {
      const collection = await ensureTargetCollection(intakeRepository, input);
      const existingCandidates = await intakeRepository.listCandidates({
        collectionId: collection.id
      });
      const sourceValue = input.sourceUrl.trim();
      const isLocalSource =
        sourceValue.startsWith("file://") ||
        /^[a-zA-Z]:\\/u.test(sourceValue) ||
        sourceValue.startsWith("./") ||
        sourceValue.startsWith("../") ||
        sourceValue.startsWith("storage/");
      const candidateInput: CreateMediaCandidateInput = {
        collectionId: collection.id,
        provider: "manual-url",
        originalPath: isLocalSource ? sourceValue : null,
        title: input.title,
        previewUrl: isLocalSource ? null : sourceValue,
        downloadUrl: sourceValue,
        sourceUrl: sourceValue,
        sourceAuthor: input.sourceAuthor,
        sourceLicense: input.sourceLicense,
        sourceLicenseUrl: input.sourceLicenseUrl,
        mediaType: input.mediaType,
        detectedType: normalizeMediaType(input.mediaType),
        suggestedCategory: input.category,
        suggestedTags: input.tags,
        suggestedCharacter: input.character,
        suggestedProject: collection.projectId,
        width: null,
        height: null,
        duration: null,
        fileSize: null,
        extension: null,
        mimeType: null,
        category: input.category,
        franchise: input.franchise,
        character: input.character,
        emotion: input.emotion,
        tags: input.tags,
        copyrightRisk: input.copyrightRisk,
        recommendedUse: input.recommendedUse,
        usageNotes: input.usageNotes,
        status: "pending",
        assetId: null,
        errorMessage: null,
        contentHash: null
      };

      if (isDuplicateCandidate(existingCandidates, candidateInput)) {
        throw new ValidationError(
          "A candidate with the same source is already present in this collection."
        );
      }

      const created = await intakeRepository.createCandidate(candidateInput);
      await syncCollectionStats(intakeRepository, collection.id, "ready_for_review");
      return getIntakeCandidateById(intakeRepository, created.id);
    },

    async approveCandidate(candidateId: string) {
      return approveIntakeCandidate(intakeRepository, candidateId);
    },

    async rejectCandidate(candidateId: string) {
      const updated = await intakeRepository.updateCandidate(candidateId, {
        status: "rejected"
      });

      if (!updated) {
        throw buildCandidateNotFoundError(candidateId);
      }

      await syncCollectionStats(
        intakeRepository,
        updated.collectionId,
        "ready_for_review"
      );
      return getIntakeCandidateById(intakeRepository, candidateId);
    },

    async updateCandidate(candidateId: string, payload: Parameters<typeof updateIntakeCandidate>[2]) {
      return updateIntakeCandidate(intakeRepository, candidateId, payload);
    },

    async importApproved(collectionId: string) {
      const collection = await requireCollection(intakeRepository, collectionId);
      await intakeRepository.updateCollection(collection.id, {
        status: "importing",
        notes: "Importando candidatos aprovados para storage/assets."
      });

      const approvedCandidates = await intakeRepository.listCandidates({
        collectionId,
        status: "approved"
      });
      const results: ImportCandidateOutcome[] = [];

      for (const candidate of approvedCandidates) {
        results.push(await importSingleCandidate(dependencies, candidate));
      }

      await syncCollectionStats(intakeRepository, collectionId);

      return {
        collectionIds: [collectionId],
        candidateIds: approvedCandidates.map((candidate) => candidate.id),
        assetIds: results
          .map((result) => result.assetId)
          .filter((assetId): assetId is string => Boolean(assetId)),
        importedCount: results.filter((result) => result.assetId).length,
        failedCount: results.filter((result) => result.error).length,
        errors: results
          .filter((result) => result.error)
          .map((result) => ({
            candidateId: result.candidateId,
            title:
              approvedCandidates.find((candidate) => candidate.id === result.candidateId)
                ?.title ?? result.candidateId,
            message: result.error ?? "Importacao falhou."
          }))
      };
    },

    async createCollectionFromResearchRequirement(requirementId: string) {
      const requirement = await researchRepository.getAssetRequirementById(
        requirementId
      );

      if (!requirement) {
        throw new NotFoundError(
          `Research asset requirement '${requirementId}' was not found.`
        );
      }

      const existing = await intakeRepository.listCollections({
        assetRequirementId: requirement.id
      });

      if (existing[0]) {
        return existing[0];
      }

      const dossier = await researchRepository.getDossierById(requirement.dossierId);

      if (!dossier) {
        throw new NotFoundError(
          `Research dossier '${requirement.dossierId}' was not found.`
        );
      }

      const [primaryQuery] = buildSearchQueriesFromAssetRequirement({
        description: requirement.description,
        emotion: requirement.emotion,
        mediaType: requirement.mediaType,
        sceneRole: requirement.sceneRole,
        suggestedTags: requirement.suggestedTags
      });

      return this.createCollection({
        name: buildCollectionName("Research Assets", requirement.description),
        channelId: dossier.dossier.channelId,
        projectId: null,
        dossierId: dossier.dossier.id,
        assetRequirementId: requirement.id,
        provider: "wikimedia-commons",
        query: primaryQuery?.query ?? requirement.description,
        targetCount: 8,
        mediaType: normalizeMediaType(requirement.mediaType) as IntakeMediaType,
        notes: `Colecao criada a partir do requirement "${requirement.description}".`
      });
    },

    async createCollectionsFromDossierMissingAssets(dossierId: string) {
      const dossier = await researchRepository.getDossierById(dossierId);

      if (!dossier) {
        throw new NotFoundError(`Research dossier '${dossierId}' was not found.`);
      }

      const createdCollections: MediaCollection[] = [];

      for (const requirement of dossier.assetRequirements.filter(
        (entry) => !entry.fulfilledAssetId
      )) {
        createdCollections.push(
          await this.createCollectionFromResearchRequirement(requirement.id)
        );
      }

      return {
        dossierId,
        createdCount: createdCollections.length,
        collectionIds: createdCollections.map((collection) => collection.id),
        collections: createdCollections
      };
    },

    async createCollectionsForProjectMissingAssets(
      projectId: string
    ): Promise<CreateMediaCollectionsForProjectSummary> {
      const project = await projectRepository.getById(projectId);

      if (!project) {
        throw new NotFoundError(`Video project '${projectId}' was not found.`);
      }

      const channel = await channelRepository.getById(project.channelId);

      if (!channel) {
        throw new NotFoundError(`Channel '${project.channelId}' was not found.`);
      }

      const missingScenes = project.scenes.filter((scene) => !scene.assetId);
      const collectionIds: string[] = [];

      for (const scene of missingScenes) {
        const query = buildProjectSceneQuery(project.title, scene, channel);
        const created = await this.createCollection({
          name: buildCollectionName(
            `Project ${scene.order}`,
            scene.title || project.title
          ),
          channelId: channel.id,
          projectId: project.id,
          dossierId: null,
          assetRequirementId: null,
          provider: "wikimedia-commons",
          query,
          targetCount: 6,
          mediaType: "image",
          notes: `Colecao criada para cena ${scene.order} sem asset.`
        });

        collectionIds.push(created.id);
      }

      return {
        projectId,
        missingSceneCount: missingScenes.length,
        collectionsCreated: collectionIds.length,
        collectionIds
      };
    }
  };
}

