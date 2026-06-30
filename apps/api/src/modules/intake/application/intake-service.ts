import { NotFoundError } from "../../../shared/errors.js";
import type { AssetRepository } from "../../assets/application/asset-repository.js";
import type { StudioAsset } from "../../assets/domain/asset.js";
import type { IntakeRepository } from "./intake-repository.js";
import type {
  ImportApprovedSummary,
  IntakeCollectionDetail,
  IntakeFoldersResponse,
  MediaCandidate,
  MediaCandidateListFilters,
  MediaCollection,
  ScanInboxSummary,
  UpdateMediaCandidateInput
} from "../domain/intake.js";
import {
  getCandidatePreviewUrl,
  getInboxFolders,
  importCandidateFile,
  manualIntakeProvider,
  resolveAssetCategoryFromCandidate,
  resolveAssetTypeFromCandidate,
  scanInboxFiles
} from "../infrastructure/intake-filesystem.js";

const openCollectionStatuses = new Set<MediaCollection["status"]>([
  "draft",
  "scanning",
  "ready_for_review"
]);

function compareMaybeString(left: string | null | undefined, right: string | null | undefined) {
  return (left ?? "").trim().toLowerCase() === (right ?? "").trim().toLowerCase();
}

function compareMaybeNumber(left: number | null | undefined, right: number | null | undefined) {
  return left !== null && left !== undefined && right !== null && right !== undefined && left === right;
}

function withComputedCandidate(candidate: MediaCandidate): MediaCandidate {
  return {
    ...candidate,
    previewUrl: candidate.previewUrl ?? getCandidatePreviewUrl(candidate.id)
  };
}

function withComputedCandidates(candidates: MediaCandidate[]) {
  return candidates.map(withComputedCandidate);
}

function buildCollectionName() {
  const formatter = new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  });

  return `Manual Intake ${formatter.format(new Date())}`;
}

async function getOrCreateOpenManualCollection(repository: IntakeRepository) {
  const collections = await repository.listCollections();
  const existing = collections.find(
    (collection) =>
      collection.provider === manualIntakeProvider &&
      openCollectionStatuses.has(collection.status)
  );

  if (existing) {
    return existing;
  }

  return repository.createCollection({
    name: buildCollectionName(),
    channelId: null,
    projectId: null,
    dossierId: null,
    assetRequirementId: null,
    provider: manualIntakeProvider,
    query: null,
    sourcePath: "storage/inbox",
    mediaType: null,
    status: "draft",
    targetCount: 0,
    importedCount: 0,
    rejectedCount: 0,
    notes: "Inbox local aguardando varredura."
  });
}

async function syncCollectionStats(
  repository: IntakeRepository,
  collectionId: string,
  collectionStatus?: MediaCollection["status"]
) {
  const candidates = await repository.listCandidates({ collectionId });
  const pendingCount = candidates.filter((candidate) => candidate.status === "pending").length;
  const approvedCount = candidates.filter((candidate) => candidate.status === "approved").length;
  const rejectedCount = candidates.filter((candidate) => candidate.status === "rejected").length;
  const importedCount = candidates.filter((candidate) => candidate.status === "imported").length;
  const failedCount = candidates.filter((candidate) => candidate.status === "failed").length;

  const nextStatus =
    collectionStatus ??
    (approvedCount === 0 && pendingCount === 0
      ? failedCount > 0
        ? "failed"
        : "completed"
      : "ready_for_review");

  await repository.updateCollection(collectionId, {
    status: nextStatus,
    targetCount: candidates.length,
    importedCount,
    rejectedCount,
    notes:
      nextStatus === "completed"
        ? "Colecao revisada e importada."
        : nextStatus === "failed"
          ? "Colecao possui falhas de importacao pendentes de revisao."
          : "Colecao aberta para revisao manual."
  });
}

function isDuplicateCandidate(
  existingCandidates: MediaCandidate[],
  candidate: Awaited<ReturnType<typeof scanInboxFiles>>[number]
) {
  return existingCandidates.some((existing) => {
    if (
      existing.originalPath &&
      compareMaybeString(existing.originalPath, candidate.originalPath)
    ) {
      return true;
    }

    if (
      compareMaybeString(existing.title, candidate.title) &&
      compareMaybeNumber(existing.fileSize, candidate.fileSize)
    ) {
      return true;
    }

    if (
      existing.contentHash &&
      candidate.contentHash &&
      compareMaybeString(existing.contentHash, candidate.contentHash)
    ) {
      return true;
    }

    return false;
  });
}

function isDuplicateAsset(
  assets: StudioAsset[],
  candidate: Awaited<ReturnType<typeof scanInboxFiles>>[number]
) {
  return assets.some((asset) => {
    if (
      compareMaybeString(asset.originalName, `${candidate.title}${candidate.extension}`) &&
      compareMaybeNumber(asset.fileSize, candidate.fileSize)
    ) {
      return true;
    }

    return false;
  });
}

export async function getIntakeFolders() {
  return getInboxFolders();
}

export async function listIntakeCollections(repository: IntakeRepository) {
  return repository.listCollections();
}

export async function getIntakeCollectionById(
  repository: IntakeRepository,
  collectionId: string
): Promise<IntakeCollectionDetail> {
  const collection = await repository.getCollectionById(collectionId);

  if (!collection) {
    throw new NotFoundError(`Intake collection '${collectionId}' was not found.`);
  }

  const candidates = await repository.listCandidates({ collectionId });

  return {
    collection,
    candidates: withComputedCandidates(candidates)
  };
}

export async function listIntakeCandidates(
  repository: IntakeRepository,
  filters: MediaCandidateListFilters
) {
  return withComputedCandidates(await repository.listCandidates(filters));
}

export async function getIntakeCandidateById(
  repository: IntakeRepository,
  candidateId: string
) {
  const candidate = await repository.getCandidateById(candidateId);

  if (!candidate) {
    throw new NotFoundError(`Intake candidate '${candidateId}' was not found.`);
  }

  return withComputedCandidate(candidate);
}

export async function updateIntakeCandidate(
  repository: IntakeRepository,
  candidateId: string,
  input: UpdateMediaCandidateInput
) {
  const updated = await repository.updateCandidate(candidateId, input);

  if (!updated) {
    throw new NotFoundError(`Intake candidate '${candidateId}' was not found.`);
  }

  await syncCollectionStats(repository, updated.collectionId);
  return withComputedCandidate((await repository.getCandidateById(candidateId)) ?? updated);
}

export async function approveIntakeCandidate(
  repository: IntakeRepository,
  candidateId: string
) {
  const updated = await repository.updateCandidate(candidateId, {
    status: "approved",
    errorMessage: null
  });

  if (!updated) {
    throw new NotFoundError(`Intake candidate '${candidateId}' was not found.`);
  }

  await syncCollectionStats(repository, updated.collectionId, "ready_for_review");
  return withComputedCandidate((await repository.getCandidateById(candidateId)) ?? updated);
}

export async function rejectIntakeCandidate(
  repository: IntakeRepository,
  candidateId: string
) {
  const updated = await repository.updateCandidate(candidateId, {
    status: "rejected"
  });

  if (!updated) {
    throw new NotFoundError(`Intake candidate '${candidateId}' was not found.`);
  }

  await syncCollectionStats(repository, updated.collectionId, "ready_for_review");
  return withComputedCandidate((await repository.getCandidateById(candidateId)) ?? updated);
}

export async function scanInbox(
  repository: IntakeRepository,
  assetRepository: AssetRepository
): Promise<ScanInboxSummary> {
  const collection = await getOrCreateOpenManualCollection(repository);
  await repository.updateCollection(collection.id, {
    status: "scanning",
    sourcePath: "storage/inbox"
  });

  const [existingCandidates, scannedFiles, assets] = await Promise.all([
    repository.listCandidates({ provider: manualIntakeProvider }),
    scanInboxFiles(),
    assetRepository.list()
  ]);

  let candidatesCreated = 0;
  let candidatesSkipped = 0;
  const createdCandidateIds: string[] = [];

  for (const scannedFile of scannedFiles) {
    const duplicateCandidate = isDuplicateCandidate(existingCandidates, scannedFile);
    const duplicateAsset = duplicateCandidate
      ? false
      : isDuplicateAsset(assets, scannedFile);

    if (duplicateCandidate || duplicateAsset) {
      candidatesSkipped += 1;
      continue;
    }

    const created = await repository.createCandidate({
      collectionId: collection.id,
      provider: manualIntakeProvider,
      originalPath: scannedFile.originalPath,
      title: scannedFile.title,
      previewUrl: null,
      downloadUrl: null,
      sourceUrl: null,
      sourceAuthor: null,
      sourceLicense: null,
      sourceLicenseUrl: null,
      mediaType: scannedFile.mediaType,
      detectedType: scannedFile.detectedType,
      suggestedCategory: scannedFile.suggestedCategory,
      suggestedTags: scannedFile.suggestedTags,
      suggestedCharacter: scannedFile.suggestedCharacter,
      suggestedProject: scannedFile.suggestedProject,
      width: scannedFile.width,
      height: scannedFile.height,
      duration: scannedFile.duration,
      fileSize: scannedFile.fileSize,
      extension: scannedFile.extension,
      mimeType: scannedFile.mimeType,
      category: scannedFile.category,
      franchise: scannedFile.franchise,
      character: scannedFile.character,
      emotion: null,
      tags: scannedFile.tags,
      copyrightRisk: null,
      recommendedUse: scannedFile.recommendedUse,
      usageNotes: null,
      status: "pending",
      assetId: null,
      errorMessage: null,
      contentHash: scannedFile.contentHash
    });

    existingCandidates.push(created);
    candidatesCreated += 1;
    createdCandidateIds.push(created.id);
  }

  await syncCollectionStats(repository, collection.id, "ready_for_review");
  const refreshedCollection = await repository.getCollectionById(collection.id);
  const candidates = await repository.listCandidates({ collectionId: collection.id });

  return {
    collection: refreshedCollection ?? collection,
    candidatesCreated,
    candidatesSkipped,
    createdCandidateIds,
    candidates: withComputedCandidates(candidates)
  };
}

export async function importApprovedInboxCandidates(
  repository: IntakeRepository,
  assetRepository: AssetRepository
): Promise<ImportApprovedSummary> {
  const approvedCandidates = await repository.listCandidates({
    provider: manualIntakeProvider,
    status: "approved"
  });

  const touchedCollections = new Set<string>();
  const candidateIds: string[] = [];
  const assetIds: string[] = [];
  const errors: ImportApprovedSummary["errors"] = [];

  await Promise.all(
    [...new Set(approvedCandidates.map((candidate) => candidate.collectionId))].map(
      async (collectionId) => {
        await repository.updateCollection(collectionId, {
          status: "importing",
          notes: "Colecao em importacao para a biblioteca de assets."
        });
      }
    )
  );

  for (const candidate of approvedCandidates) {
    touchedCollections.add(candidate.collectionId);
    candidateIds.push(candidate.id);

    try {
      const assetType = resolveAssetTypeFromCandidate(candidate);
      const importedFile = assetType ? await importCandidateFile(candidate) : null;

      if (!assetType || !importedFile) {
        const errorMessage =
          candidate.mediaType === "document" || candidate.mediaType === "reference"
            ? "Este candidato ainda nao mapeia para um AssetType suportado pela biblioteca."
            : "Nao foi possivel copiar o arquivo aprovado para storage/assets.";

        await repository.updateCandidate(candidate.id, {
          status: "failed",
          errorMessage
        });

        errors.push({
          candidateId: candidate.id,
          title: candidate.title,
          message: errorMessage
        });
        continue;
      }

      const createdAsset = await assetRepository.create({
        filename: importedFile.filename,
        originalName:
          candidate.originalPath?.split("/").at(-1) ?? `${candidate.title}${candidate.extension ?? ""}`,
        path: importedFile.path,
        type: importedFile.type,
        category: resolveAssetCategoryFromCandidate(candidate),
        franchise: candidate.franchise,
        character: candidate.character ?? candidate.suggestedCharacter,
        emotion: candidate.emotion,
        tags: candidate.tags.length > 0 ? candidate.tags : candidate.suggestedTags,
        licenseType: candidate.sourceLicense ?? "manual-intake-local",
        copyrightRisk: candidate.copyrightRisk ?? "UNKNOWN",
        recommendedUse: candidate.recommendedUse,
        duration: candidate.duration,
        width: importedFile.width,
        height: importedFile.height,
        mimeType: importedFile.mimeType,
        extension: importedFile.extension,
        fileSize: importedFile.fileSize,
        sourceProvider: manualIntakeProvider,
        sourceUrl: candidate.sourceUrl,
        sourceAuthor: candidate.sourceAuthor,
        sourceLicense: candidate.sourceLicense,
        sourceLicenseUrl: candidate.sourceLicenseUrl,
        downloadedAt: new Date().toISOString(),
        collectionId: candidate.collectionId,
        usageNotes: candidate.usageNotes
      });

      assetIds.push(createdAsset.id);

      await repository.updateCandidate(candidate.id, {
        status: "imported",
        assetId: createdAsset.id,
        category: resolveAssetCategoryFromCandidate(candidate),
        character: candidate.character ?? candidate.suggestedCharacter,
        errorMessage: null
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error && error.message.trim()
          ? error.message.trim()
          : "Importacao falhou.";

      await repository.updateCandidate(candidate.id, {
        status: "failed",
        errorMessage
      });

      errors.push({
        candidateId: candidate.id,
        title: candidate.title,
        message: errorMessage
      });
    }
  }

  for (const collectionId of touchedCollections) {
    const candidates = await repository.listCandidates({ collectionId });
    const pendingCount = candidates.filter((candidate) => candidate.status === "pending").length;
    const approvedCount = candidates.filter((candidate) => candidate.status === "approved").length;
    const failedCount = candidates.filter((candidate) => candidate.status === "failed").length;

    const nextStatus =
      approvedCount === 0 && pendingCount === 0
        ? failedCount > 0
          ? "failed"
          : "completed"
        : "ready_for_review";

    await syncCollectionStats(repository, collectionId, nextStatus);
  }

  return {
    collectionIds: [...touchedCollections],
    candidateIds,
    assetIds,
    importedCount: assetIds.length,
    failedCount: errors.length,
    errors
  };
}

