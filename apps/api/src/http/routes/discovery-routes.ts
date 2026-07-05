import type { IncomingMessage, ServerResponse } from "node:http";
import {
  getProviderActivationMatrix,
  searchDiscoveryCandidates
} from "../../../../../packages/production-discovery-engine/src/index.js";
import type { IntakeRepository } from "../../modules/intake/application/intake-repository.js";
import type { IntakeMediaType } from "../../modules/intake/domain/intake.js";
import {
  handleRouteError,
  readJsonBody,
  sendJson,
  sendMethodNotAllowed
} from "../utils/http-utils.js";

interface DiscoveryRouteDependencies {
  intakeRepository: IntakeRepository;
}

function toCopyrightRisk(value: string) {
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

export async function handleDiscoveryRoute(
  request: IncomingMessage,
  response: ServerResponse,
  pathname: string,
  dependencies: DiscoveryRouteDependencies
): Promise<boolean> {
  try {
    if (pathname === "/discovery/providers/status") {
      if (request.method !== "GET") {
        sendMethodNotAllowed(response, ["GET"]);
        return true;
      }

      sendJson(response, 200, getProviderActivationMatrix(process.env));
      return true;
    }

    if (pathname === "/discovery/search") {
      if (request.method !== "POST") {
        sendMethodNotAllowed(response, ["POST"]);
        return true;
      }

      const payload = await readJsonBody<{
        query?: string;
        mediaType?: string;
        providers?: string[];
        targetCount?: number;
        niche?: string;
        projectId?: string;
        packageId?: string;
      }>(request);
      const result = searchDiscoveryCandidates(
        {
          query: payload.query ?? "",
          mediaType: payload.mediaType as never,
          providers: payload.providers ?? null,
          targetCount: payload.targetCount ?? 10,
          niche: payload.niche ?? null,
          projectId: payload.projectId ?? null,
          packageId: payload.packageId ?? null
        },
        process.env
      );
      const collection = await dependencies.intakeRepository.createCollection({
        name: `Discovery search: ${payload.query ?? "media reference"}`.slice(0, 120),
        channelId: null,
        projectId: payload.projectId ?? null,
        dossierId: null,
        assetRequirementId: null,
        provider: "discovery-search",
        query: payload.query ?? null,
        sourcePath: null,
        mediaType: payload.mediaType ? toIntakeMediaType(payload.mediaType) : null,
        status: "ready_for_review",
        targetCount: payload.targetCount ?? null,
        importedCount: 0,
        rejectedCount: 0,
        notes: "Provider Activation Matrix candidate-first search. No assets created."
      });
      const persistedCandidates = [];

      for (const candidate of result.candidates) {
        const saved = await dependencies.intakeRepository.createCandidate({
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
          mediaType: toIntakeMediaType(candidate.mediaType),
          detectedType: candidate.mediaType,
          suggestedCategory: candidate.mediaType === "video" ? "BROLL" : "REFERENCE",
          suggestedTags: [
            "discovery-search",
            payload.niche ?? "generic",
            `provider:${candidate.provider}`,
            `score:${candidate.overallScore}`
          ],
          suggestedCharacter: null,
          suggestedProject: payload.projectId ?? null,
          width: null,
          height: null,
          duration: null,
          fileSize: null,
          extension: null,
          mimeType: null,
          category: candidate.mediaType === "video" ? "BROLL" : "REFERENCE",
          franchise: null,
          character: null,
          emotion: null,
          tags: [
            "candidate-first",
            "requires-review",
            `license:${candidate.licenseStatus}`,
            `risk:${candidate.riskLevel}`
          ],
          copyrightRisk: toCopyrightRisk(candidate.riskLevel),
          recommendedUse: candidate.whyThisCandidate,
          usageNotes: JSON.stringify({
            relevanceScore: candidate.relevanceScore,
            qualityScore: candidate.qualityScore,
            sceneFitScore: candidate.sceneFitScore,
            overallScore: candidate.overallScore,
            licenseStatus: candidate.licenseStatus,
            riskLevel: candidate.riskLevel,
            requiresManualReview: true,
            noAutoImport: true
          }),
          status: "pending",
          assetId: null,
          errorMessage: null,
          contentHash: null
        });
        persistedCandidates.push(saved);
      }

      sendJson(response, 201, {
        ...result,
        collectionId: collection.id,
        candidates: persistedCandidates,
        assetsCreated: 0
      });
      return true;
    }

    return false;
  } catch (error) {
    handleRouteError(response, error);
    return true;
  }
}
