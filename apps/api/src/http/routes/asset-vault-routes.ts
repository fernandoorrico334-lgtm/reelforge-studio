import type { IncomingMessage, ServerResponse } from "node:http";
import {
  analyzeAssetVaultGaps,
  buildSearchMissionQueries,
  deduplicateCandidates,
  scoreDiscoveryCandidate,
  searchDiscoveryCandidates
} from "../../../../../packages/production-discovery-engine/src/index.js";
import { prisma } from "../../infrastructure/database/prisma-client.js";
import type { AssetRepository } from "../../modules/assets/application/asset-repository.js";
import type { IntakeRepository } from "../../modules/intake/application/intake-repository.js";
import type { IntakeMediaType, MediaCandidate } from "../../modules/intake/domain/intake.js";
import {
  handleRouteError,
  readJsonBody,
  sendJson,
  sendMethodNotAllowed
} from "../utils/http-utils.js";

interface AssetVaultRouteDependencies {
  assetRepository: AssetRepository;
  intakeRepository: IntakeRepository;
}

function parseJsonArray(value: string | null | undefined): string[] {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

function serializeArray(value: unknown): string {
  return JSON.stringify(
    Array.isArray(value)
      ? value.map((item) => String(item).trim()).filter(Boolean)
      : typeof value === "string"
        ? value.split(",").map((item) => item.trim()).filter(Boolean)
        : []
  );
}

function parseNotes(value: string | null | undefined): Record<string, unknown> {
  if (!value) {
    return {};
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function mapVault(record: Awaited<ReturnType<typeof prisma.assetVault.findFirst>>) {
  if (!record) {
    return null;
  }

  return {
    ...record,
    targetAssetTypes: parseJsonArray(record.targetAssetTypes),
    tags: parseJsonArray(record.tags)
  };
}

function mapMission(record: Awaited<ReturnType<typeof prisma.searchMission.findFirst>>) {
  if (!record) {
    return null;
  }

  return {
    ...record,
    providers: parseJsonArray(record.providers),
    querySet: parseJsonArray(record.querySet)
  };
}

function toIntakeMediaType(value: string): IntakeMediaType {
  switch (value) {
    case "video":
    case "microclip":
      return "video";
    case "audio":
    case "music":
      return "audio";
    case "sfx":
      return "sfx";
    case "document":
    case "source_link":
    case "research_source":
      return "reference";
    case "image":
    case "generated_image":
    default:
      return "image";
  }
}

function toAssetType(value: IntakeMediaType) {
  switch (value) {
    case "video":
      return "VIDEO" as const;
    case "audio":
    case "music":
      return "AUDIO" as const;
    case "sfx":
      return "SFX" as const;
    case "document":
    case "reference":
      return "DOCUMENT" as const;
    default:
      return "IMAGE" as const;
  }
}

function toCopyrightRisk(value: string | null | undefined) {
  switch (value) {
    case "low":
      return "LOW" as const;
    case "medium":
    case "editorial_only":
      return "MEDIUM" as const;
    case "high":
    case "restricted":
      return "HIGH" as const;
    default:
      return "UNKNOWN" as const;
  }
}

async function listCandidatesByTag(tag: string, intakeRepository: IntakeRepository) {
  const candidates = await intakeRepository.listCandidates();
  return candidates.filter((candidate) => candidate.tags.includes(tag));
}

async function refreshVaultCounts(vaultId: string, intakeRepository: IntakeRepository) {
  const candidates = await listCandidatesByTag(`vault:${vaultId}`, intakeRepository);
  const counts = {
    candidateCount: candidates.length,
    approvedCount: candidates.filter((candidate) => candidate.status === "approved").length,
    importedCount: candidates.filter((candidate) => candidate.status === "imported").length,
    rejectedCount: candidates.filter((candidate) => candidate.status === "rejected").length
  };
  await prisma.assetVault.update({
    where: { id: vaultId },
    data: counts
  });
  return counts;
}

async function refreshMissionCounts(missionId: string, intakeRepository: IntakeRepository) {
  const candidates = await listCandidatesByTag(`mission:${missionId}`, intakeRepository);
  const counts = {
    candidateCount: candidates.length,
    reviewRequiredCount: candidates.filter((candidate) => candidate.status === "pending").length,
    approvedCount: candidates.filter((candidate) => candidate.status === "approved").length,
    importedCount: candidates.filter((candidate) => candidate.status === "imported").length,
    rejectedCount: candidates.filter((candidate) => candidate.status === "rejected").length
  };
  await prisma.searchMission.update({
    where: { id: missionId },
    data: counts
  });
  return counts;
}

async function createCandidatesForMission(
  mission: NonNullable<Awaited<ReturnType<typeof prisma.searchMission.findUnique>>>,
  intakeRepository: IntakeRepository
) {
  const providers = parseJsonArray(mission.providers);
  const querySet = parseJsonArray(mission.querySet);
  const query = querySet[0] ?? mission.topic;
  const result = searchDiscoveryCandidates({
    query,
    mediaType: "image",
    providers,
    targetCount: mission.targetCount,
    niche: mission.niche,
    projectId: mission.projectId,
    packageId: mission.packageId
  }, process.env);
  const deduped = deduplicateCandidates(
    result.candidates.map((candidate) => ({
      id: candidate.id,
      provider: candidate.provider,
      title: candidate.title,
      sourceUrl: candidate.sourceUrl,
      previewUrl: candidate.previewUrl,
      downloadUrl: candidate.downloadUrl
    }))
  );
  const collection = await intakeRepository.createCollection({
    name: `Search Mission: ${mission.topic}`.slice(0, 120),
    channelId: null,
    projectId: mission.projectId,
    dossierId: null,
    assetRequirementId: null,
    provider: "asset-vault-search-mission",
    query,
    sourcePath: null,
    mediaType: null,
    status: "ready_for_review",
    targetCount: mission.targetCount,
    importedCount: 0,
    rejectedCount: 0,
    notes: `mission:${mission.id}; vault:${mission.vaultId ?? "none"}`
  });
  const saved: MediaCandidate[] = [];

  for (const candidate of result.candidates) {
    const dedup = deduped.find((item) => item.id === candidate.id);
    const score = scoreDiscoveryCandidate({
      title: candidate.title,
      query,
      mediaType: candidate.mediaType,
      providerId: candidate.provider,
      previewUrl: candidate.previewUrl,
      sourceUrl: candidate.sourceUrl,
      licenseStatus: candidate.licenseStatus,
      riskLevel: candidate.riskLevel
    });
    const mediaType = toIntakeMediaType(candidate.mediaType);
    const savedCandidate = await intakeRepository.createCandidate({
      collectionId: collection.id,
      provider: candidate.provider,
      originalPath: null,
      title: candidate.title,
      previewUrl: candidate.previewUrl,
      downloadUrl: null,
      sourceUrl: candidate.sourceUrl,
      sourceAuthor: candidate.sourceAuthor,
      sourceLicense: candidate.sourceLicense,
      sourceLicenseUrl: candidate.sourceLicenseUrl,
      mediaType,
      detectedType: candidate.mediaType,
      suggestedCategory: mediaType === "video" ? "BROLL" : "REFERENCE",
      suggestedTags: ["asset-vault", mission.niche, mission.sourcePackId ?? ""].filter(Boolean),
      suggestedCharacter: null,
      suggestedProject: mission.projectId,
      width: null,
      height: null,
      duration: null,
      fileSize: null,
      extension: null,
      mimeType: null,
      category: mediaType === "video" ? "BROLL" : "REFERENCE",
      franchise: null,
      character: null,
      emotion: null,
      tags: [
        "asset-vault",
        "candidate-first",
        `mission:${mission.id}`,
        ...(mission.vaultId ? [`vault:${mission.vaultId}`] : []),
        `provider:${candidate.provider}`,
        `score:${score.overallScore}`
      ],
      copyrightRisk: toCopyrightRisk(score.riskLevel),
      recommendedUse: score.whyThisCandidate,
      usageNotes: JSON.stringify({
        missionId: mission.id,
        vaultId: mission.vaultId,
        sourcePackId: mission.sourcePackId,
        requiresUserReview: true,
        userConfirmedUse: false,
        relevanceScore: score.relevanceScore,
        qualityScore: score.qualityScore,
        sceneFitScore: score.sceneFitScore,
        licenseConfidence: score.licenseConfidence,
        sourceReliabilityScore: score.sourceReliabilityScore,
        overallScore: score.overallScore,
        riskLevel: score.riskLevel,
        whyThisCandidate: score.whyThisCandidate,
        duplicateWarning: dedup?.duplicateWarning ?? null,
        possibleDuplicateOf: dedup?.possibleDuplicateOf ?? null,
        lowResolutionWarning: score.lowResolutionWarning,
        watermarkWarning: score.watermarkWarning,
        alreadyUsedWarning: null
      }),
      status: "pending",
      assetId: null,
      errorMessage: null,
      contentHash: null
    });
    saved.push(savedCandidate);
  }

  await prisma.searchMission.update({
    where: { id: mission.id },
    data: {
      status: "ready_for_review",
      candidateCount: saved.length,
      reviewRequiredCount: saved.length,
      errorMessage: null
    }
  });

  if (mission.vaultId) {
    await refreshVaultCounts(mission.vaultId, intakeRepository);
  }

  return {
    collection,
    candidates: saved,
    providerResults: result.providerResults,
    warnings: result.warnings
  };
}

function candidateConfirmed(candidate: MediaCandidate) {
  const notes = parseNotes(candidate.usageNotes);
  return notes.userConfirmedUse === true;
}

export async function handleAssetVaultRoute(
  request: IncomingMessage,
  response: ServerResponse,
  pathname: string,
  dependencies: AssetVaultRouteDependencies
): Promise<boolean> {
  try {
    if (pathname === "/asset-vault") {
      if (request.method === "GET") {
        const vaults = await prisma.assetVault.findMany({
          orderBy: { createdAt: "desc" }
        });
        sendJson(response, 200, vaults.map(mapVault));
        return true;
      }

      if (request.method === "POST") {
        const payload = await readJsonBody<Record<string, unknown>>(request);
        const vault = await prisma.assetVault.create({
          data: {
            name: String(payload.name ?? "Untitled Vault"),
            niche: String(payload.niche ?? "generic"),
            description: payload.description ? String(payload.description) : null,
            sourcePackId: payload.sourcePackId ? String(payload.sourcePackId) : null,
            targetAssetTypes: serializeArray(payload.targetAssetTypes),
            tags: serializeArray(payload.tags),
            status: "draft",
            notes: payload.notes ? String(payload.notes) : null
          }
        });
        sendJson(response, 201, mapVault(vault));
        return true;
      }

      sendMethodNotAllowed(response, ["GET", "POST"]);
      return true;
    }

    const vaultMissionMatch = pathname.match(/^\/asset-vault\/([^/]+)\/create-search-mission$/);
    if (vaultMissionMatch) {
      if (request.method !== "POST") {
        sendMethodNotAllowed(response, ["POST"]);
        return true;
      }

      const vault = await prisma.assetVault.findUnique({
        where: { id: decodeURIComponent(vaultMissionMatch[1] ?? "") }
      });
      if (!vault) {
        sendJson(response, 404, { error: "Asset vault not found." });
        return true;
      }

      const payload = await readJsonBody<Record<string, unknown>>(request);
      const plan = buildSearchMissionQueries({
        topic: String(payload.topic ?? vault.name),
        niche: String(payload.niche ?? vault.niche),
        sourcePackId: String(payload.sourcePackId ?? vault.sourcePackId ?? ""),
        providers: Array.isArray(payload.providers)
          ? payload.providers.map(String)
          : null,
        targetCount: Number(payload.targetCount ?? 10)
      });
      const mission = await prisma.searchMission.create({
        data: {
          vaultId: vault.id,
          projectId: payload.projectId ? String(payload.projectId) : null,
          packageId: payload.packageId ? String(payload.packageId) : null,
          topic: plan.topic,
          niche: plan.niche,
          sourcePackId: plan.sourcePackId,
          providers: JSON.stringify(plan.providers),
          querySet: JSON.stringify(plan.queries),
          targetCount: plan.targetCount,
          status: "draft"
        }
      });

      sendJson(response, 201, mapMission(mission));
      return true;
    }

    const vaultActionMatch = pathname.match(/^\/asset-vault\/([^/]+)\/(analyze-gaps|search-missions|candidates)$/);
    if (vaultActionMatch) {
      const vaultId = decodeURIComponent(vaultActionMatch[1] ?? "");
      const action = vaultActionMatch[2];
      const vault = await prisma.assetVault.findUnique({ where: { id: vaultId } });
      if (!vault) {
        sendJson(response, 404, { error: "Asset vault not found." });
        return true;
      }

      if (action === "analyze-gaps") {
        if (request.method !== "POST") {
          sendMethodNotAllowed(response, ["POST"]);
          return true;
        }
        const candidates = await listCandidatesByTag(`vault:${vaultId}`, dependencies.intakeRepository);
        const candidateCounts = candidates.reduce<Record<string, number>>((acc, candidate) => {
          acc[candidate.mediaType] = (acc[candidate.mediaType] ?? 0) + 1;
          return acc;
        }, {});
        const analysis = analyzeAssetVaultGaps({
          niche: vault.niche,
          targetAssetTypes: parseJsonArray(vault.targetAssetTypes),
          existingCounts: {},
          candidateCounts
        });
        await prisma.assetVault.update({
          where: { id: vaultId },
          data: { missingCount: analysis.missingByMediaType.length }
        });
        sendJson(response, 200, analysis);
        return true;
      }

      if (action === "search-missions") {
        if (request.method !== "GET") {
          sendMethodNotAllowed(response, ["GET"]);
          return true;
        }
        const missions = await prisma.searchMission.findMany({
          where: { vaultId },
          orderBy: { createdAt: "desc" }
        });
        sendJson(response, 200, missions.map(mapMission));
        return true;
      }

      if (action === "candidates") {
        if (request.method !== "GET") {
          sendMethodNotAllowed(response, ["GET"]);
          return true;
        }
        sendJson(response, 200, await listCandidatesByTag(`vault:${vaultId}`, dependencies.intakeRepository));
        return true;
      }
    }

    const vaultDetailMatch = pathname.match(/^\/asset-vault\/([^/]+)$/);
    if (vaultDetailMatch) {
      const id = decodeURIComponent(vaultDetailMatch[1] ?? "");
      if (request.method === "GET") {
        sendJson(response, 200, mapVault(await prisma.assetVault.findUnique({ where: { id } })));
        return true;
      }
      if (request.method === "PUT") {
        const payload = await readJsonBody<Record<string, unknown>>(request);
        const vault = await prisma.assetVault.update({
          where: { id },
          data: {
            ...(payload.name ? { name: String(payload.name) } : {}),
            ...(payload.niche ? { niche: String(payload.niche) } : {}),
            ...(payload.description !== undefined ? { description: payload.description ? String(payload.description) : null } : {}),
            ...(payload.sourcePackId !== undefined ? { sourcePackId: payload.sourcePackId ? String(payload.sourcePackId) : null } : {}),
            ...(payload.targetAssetTypes ? { targetAssetTypes: serializeArray(payload.targetAssetTypes) } : {}),
            ...(payload.tags ? { tags: serializeArray(payload.tags) } : {}),
            ...(payload.status ? { status: String(payload.status) as never } : {}),
            ...(payload.notes !== undefined ? { notes: payload.notes ? String(payload.notes) : null } : {})
          }
        });
        sendJson(response, 200, mapVault(vault));
        return true;
      }
      if (request.method === "DELETE") {
        await prisma.assetVault.update({ where: { id }, data: { status: "archived" } });
        sendJson(response, 200, { archived: true });
        return true;
      }
    }

    if (pathname === "/discovery/search-missions") {
      if (request.method === "GET") {
        const missions = await prisma.searchMission.findMany({
          orderBy: { createdAt: "desc" }
        });
        sendJson(response, 200, missions.map(mapMission));
        return true;
      }
      if (request.method === "POST") {
        const payload = await readJsonBody<Record<string, unknown>>(request);
        const plan = buildSearchMissionQueries({
          topic: String(payload.topic ?? "media reference"),
          niche: String(payload.niche ?? "generic"),
          sourcePackId: payload.sourcePackId ? String(payload.sourcePackId) : null,
          providers: Array.isArray(payload.providers) ? payload.providers.map(String) : null,
          targetCount: Number(payload.targetCount ?? 10)
        });
        const mission = await prisma.searchMission.create({
          data: {
            vaultId: payload.vaultId ? String(payload.vaultId) : null,
            projectId: payload.projectId ? String(payload.projectId) : null,
            packageId: payload.packageId ? String(payload.packageId) : null,
            topic: plan.topic,
            niche: plan.niche,
            sourcePackId: plan.sourcePackId,
            providers: JSON.stringify(plan.providers),
            querySet: JSON.stringify(plan.queries),
            targetCount: plan.targetCount,
            status: "draft"
          }
        });
        sendJson(response, 201, mapMission(mission));
        return true;
      }
      sendMethodNotAllowed(response, ["GET", "POST"]);
      return true;
    }

    const missionActionMatch = pathname.match(/^\/discovery\/search-missions\/([^/]+)(?:\/(run|candidates))?$/);
    if (missionActionMatch) {
      const missionId = decodeURIComponent(missionActionMatch[1] ?? "");
      const action = missionActionMatch[2] ?? null;
      const mission = await prisma.searchMission.findUnique({ where: { id: missionId } });
      if (!mission) {
        sendJson(response, 404, { error: "Search mission not found." });
        return true;
      }

      if (!action) {
        if (request.method !== "GET") {
          sendMethodNotAllowed(response, ["GET"]);
          return true;
        }
        sendJson(response, 200, mapMission(mission));
        return true;
      }

      if (action === "run") {
        if (request.method !== "POST") {
          sendMethodNotAllowed(response, ["POST"]);
          return true;
        }
        await prisma.searchMission.update({ where: { id: mission.id }, data: { status: "searching" } });
        const result = await createCandidatesForMission(mission, dependencies.intakeRepository);
        sendJson(response, 200, {
          mission: mapMission(await prisma.searchMission.findUnique({ where: { id: mission.id } })),
          ...result,
          assetsCreated: 0
        });
        return true;
      }

      if (action === "candidates") {
        if (request.method !== "GET") {
          sendMethodNotAllowed(response, ["GET"]);
          return true;
        }
        sendJson(response, 200, await listCandidatesByTag(`mission:${mission.id}`, dependencies.intakeRepository));
        return true;
      }
    }

    const candidateActionMatch = pathname.match(/^\/discovery\/candidates\/([^/]+)\/(confirm-use|import|reject|favorite)$/);
    if (candidateActionMatch) {
      if (request.method !== "POST") {
        sendMethodNotAllowed(response, ["POST"]);
        return true;
      }
      const candidateId = decodeURIComponent(candidateActionMatch[1] ?? "");
      const action = candidateActionMatch[2];
      const candidate = await dependencies.intakeRepository.getCandidateById(candidateId);
      if (!candidate) {
        sendJson(response, 404, { error: "Candidate not found." });
        return true;
      }
      const notes = parseNotes(candidate.usageNotes);

      if (action === "confirm-use" || action === "favorite") {
        const payload: Record<string, unknown> = await readJsonBody<Record<string, unknown>>(request).catch(() => ({}));
        const updated = await dependencies.intakeRepository.updateCandidate(candidate.id, {
          status: action === "confirm-use" ? "approved" : candidate.status,
          tags: [...new Set([...candidate.tags, action === "favorite" ? "favorite" : "user-confirmed"])],
          usageNotes: JSON.stringify({
            ...notes,
            userConfirmedUse: action === "confirm-use" ? true : notes.userConfirmedUse,
            userConfirmedAt: action === "confirm-use" ? new Date().toISOString() : notes.userConfirmedAt,
            userConfirmationNote: payload.note ? String(payload.note) : notes.userConfirmationNote,
            favorite: action === "favorite" ? true : notes.favorite
          })
        });
        if (notes.missionId) {
          await refreshMissionCounts(String(notes.missionId), dependencies.intakeRepository);
        }
        if (notes.vaultId) {
          await refreshVaultCounts(String(notes.vaultId), dependencies.intakeRepository);
        }
        sendJson(response, 200, updated);
        return true;
      }

      if (action === "reject") {
        const updated = await dependencies.intakeRepository.updateCandidate(candidate.id, {
          status: "rejected"
        });
        if (notes.missionId) {
          await refreshMissionCounts(String(notes.missionId), dependencies.intakeRepository);
        }
        if (notes.vaultId) {
          await refreshVaultCounts(String(notes.vaultId), dependencies.intakeRepository);
        }
        sendJson(response, 200, updated);
        return true;
      }

      if (action === "import") {
        if (!candidateConfirmed(candidate)) {
          sendJson(response, 409, {
            error: "Confirme o uso do candidato antes de importar.",
            requiredAction: "confirm-use"
          });
          return true;
        }
        if (!candidate.originalPath) {
          sendJson(response, 409, {
            error: "Este candidato nao possui arquivo local autorizado. Abra a fonte ou importe um arquivo local pelo Intake/Media Collector.",
            requiredAction: "manual-local-import"
          });
          return true;
        }
        const asset = await dependencies.assetRepository.create({
          filename: candidate.originalPath.split(/[\\/]/).pop() ?? `${candidate.id}.asset`,
          originalName: candidate.title,
          path: candidate.originalPath,
          type: toAssetType(candidate.mediaType),
          category: candidate.category ?? "REFERENCE",
          franchise: candidate.franchise,
          character: candidate.character,
          emotion: candidate.emotion,
          tags: [...candidate.tags, "asset-vault-import"],
          licenseType: candidate.sourceLicense ?? "local_user_review",
          copyrightRisk: candidate.copyrightRisk ?? "UNKNOWN",
          recommendedUse: candidate.recommendedUse,
          duration: candidate.duration,
          width: candidate.width,
          height: candidate.height,
          mimeType: candidate.mimeType,
          extension: candidate.extension,
          fileSize: candidate.fileSize,
          sourceProvider: candidate.provider,
          sourceUrl: candidate.sourceUrl,
          sourceAuthor: candidate.sourceAuthor,
          sourceLicense: candidate.sourceLicense,
          sourceLicenseUrl: candidate.sourceLicenseUrl,
          downloadedAt: null,
          collectionId: candidate.collectionId,
          usageNotes: candidate.usageNotes
        });
        const updated = await dependencies.intakeRepository.updateCandidate(candidate.id, {
          status: "imported",
          assetId: asset.id
        });
        if (notes.missionId) {
          await refreshMissionCounts(String(notes.missionId), dependencies.intakeRepository);
        }
        if (notes.vaultId) {
          await refreshVaultCounts(String(notes.vaultId), dependencies.intakeRepository);
        }
        sendJson(response, 200, { candidate: updated, asset });
        return true;
      }
    }

    return false;
  } catch (error) {
    handleRouteError(response, error);
    return true;
  }
}
