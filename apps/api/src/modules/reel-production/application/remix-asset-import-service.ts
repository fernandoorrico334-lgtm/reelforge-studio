import {
  importRemixAssetCandidatesToDisk,
  type RemixAssetSearchCandidate,
  type RemixImportedAssetBinding
} from "@reelforge/media-beast";
import type { AssetRepository } from "../../assets/application/asset-repository.js";
import type { AssetCategory, AssetType, CopyrightRisk } from "../../assets/domain/asset.js";

export interface ImportRemixAssetsInput {
  remixId: string;
  candidates: RemixAssetSearchCandidate[];
  contentContext?: {
    headline?: string;
    entities?: string[];
    domain?: string;
  };
  sceneRoles?: string[];
}

export interface ImportRemixAssetsResult {
  remixId: string;
  importedCount: number;
  failedCount: number;
  importedAssets: RemixImportedAssetBinding[];
  assets: Array<{
    assetId: string;
    candidateId: string;
    path: string;
    title: string;
    importMethod: string;
  }>;
  errors: Array<{ candidateId: string; message: string }>;
}

function mapPurposeToCategory(purpose: RemixAssetSearchCandidate["purpose"]): AssetCategory {
  switch (purpose) {
    case "comic_panel":
      return "PANEL";
    case "sports_photo":
      return "REFERENCE";
    case "archive_reference":
      return "REFERENCE";
    case "broll_mood":
      return "BROLL";
    default:
      return "REFERENCE";
  }
}

function mapRiskLevel(riskLevel: string): CopyrightRisk {
  switch (riskLevel) {
    case "low":
      return "LOW";
    case "medium":
      return "MEDIUM";
    case "high":
    case "blocked":
      return "HIGH";
    default:
      return "UNKNOWN";
  }
}

function mapLicense(licenseStatus: string) {
  if (licenseStatus === "public_domain") return "public-domain-remix";
  if (licenseStatus === "creative_commons") return "creative-commons-remix";
  if (licenseStatus === "owned") return "owned-remix";
  return "remix-discovery-approved";
}

export async function importApprovedRemixAssets(
  assetRepository: AssetRepository,
  input: ImportRemixAssetsInput
): Promise<ImportRemixAssetsResult> {
  if (!input.candidates.length) {
    throw new Error("Select at least one asset candidate to import.");
  }

  const importContext = {
    remixId: input.remixId,
    ...(input.contentContext?.headline ? { headline: input.contentContext.headline } : {}),
    ...(input.contentContext?.entities?.length
      ? { entities: input.contentContext.entities }
      : {}),
    ...(input.contentContext?.domain ? { domain: input.contentContext.domain } : {})
  };

  const diskResults = await importRemixAssetCandidatesToDisk(
    input.candidates,
    importContext
  );

  const importedAssets: RemixImportedAssetBinding[] = [];
  const assets: ImportRemixAssetsResult["assets"] = [];
  const errors: ImportRemixAssetsResult["errors"] = [];

  for (let index = 0; index < diskResults.length; index += 1) {
    const disk = diskResults[index]!;
    const candidate = input.candidates[index]!;

    if (!disk.success || !disk.localPath) {
      errors.push({
        candidateId: candidate.candidateId,
        message: disk.errorMessage ?? "Download/import failed."
      });
      continue;
    }

    const assetType: AssetType = disk.mimeType?.startsWith("image/") ? "IMAGE" : "DOCUMENT";
    const created = await assetRepository.create({
      filename: disk.localPath.split("/").at(-1) ?? candidate.candidateId,
      originalName: candidate.title.slice(0, 120),
      path: disk.localPath,
      type: assetType,
      category: mapPurposeToCategory(candidate.purpose),
      franchise: input.contentContext?.entities?.[0] ?? null,
      character: input.contentContext?.entities?.[0] ?? null,
      emotion: null,
      tags: [
        "remix-import",
        `remix:${input.remixId}`,
        candidate.providerId,
        candidate.purpose
      ],
      licenseType: mapLicense(candidate.licenseStatus),
      copyrightRisk: mapRiskLevel(candidate.riskLevel),
      recommendedUse: "Remix visual insert after explicit user approval.",
      duration: null,
      width: disk.width,
      height: disk.height,
      mimeType: disk.mimeType,
      extension: disk.localPath.split(".").at(-1) ?? null,
      fileSize: disk.fileSizeBytes,
      sourceProvider: candidate.providerId,
      sourceUrl: candidate.sourceUrl,
      sourceLicense: candidate.licenseStatus,
      downloadedAt: new Date().toISOString(),
      usageNotes: JSON.stringify({
        remixCandidateId: candidate.candidateId,
        importMethod: disk.importMethod,
        query: candidate.query,
        approvedByUser: true
      })
    });

    importedAssets.push({
      candidateId: candidate.candidateId,
      assetId: created.id,
      localPath: created.path,
      sceneRole: input.sceneRoles?.[index] ?? null,
      importMethod: disk.importMethod
    });

    assets.push({
      assetId: created.id,
      candidateId: candidate.candidateId,
      path: created.path,
      title: created.originalName ?? candidate.title,
      importMethod: disk.importMethod
    });
  }

  const roleSequence = ["hook", "context", "evidence", "climax", "outro"];
  const bound = importedAssets.map((asset, index) => ({
    ...asset,
    sceneRole: input.sceneRoles?.[index] ?? roleSequence[index] ?? roleSequence.at(-1) ?? null
  }));

  return {
    remixId: input.remixId,
    importedCount: assets.length,
    failedCount: errors.length,
    importedAssets: bound,
    assets,
    errors
  };
}