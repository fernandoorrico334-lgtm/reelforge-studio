import type { IncomingMessage, ServerResponse } from "node:http";
import type { AssetRepository } from "../../modules/assets/application/asset-repository.js";
import type { AssetStorage } from "../../modules/assets/application/asset-storage.js";
import type { ChannelRepository } from "../../modules/channels/application/channel-repository.js";
import type { IntakeRepository } from "../../modules/intake/application/intake-repository.js";
import { validateUpdateMediaCandidateInput } from "../../modules/intake/domain/intake.js";
import { createMediaCollectorService } from "../../modules/media-collector/application/media-collector-service.js";
import {
  validateCreateManualUrlCandidateInput,
  validateCreateMediaCollectionRequestInput
} from "../../modules/media-collector/domain/media-collector.js";
import type { ProjectRepository } from "../../modules/projects/application/project-repository.js";
import type { ResearchRepository } from "../../modules/research/application/research-repository.js";
import {
  handleRouteError,
  readJsonBody,
  sendJson,
  sendMethodNotAllowed
} from "../utils/http-utils.js";

interface MediaCollectorRouteDependencies {
  assetRepository: AssetRepository;
  assetStorage: AssetStorage;
  channelRepository: ChannelRepository;
  intakeRepository: IntakeRepository;
  projectRepository: ProjectRepository;
  researchRepository: ResearchRepository;
}

function parsePath(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);

  if (segments[0] === "media-collector") {
    if (segments.length === 2 && segments[1] === "providers") {
      return { kind: "providers" as const };
    }

    if (segments.length === 2 && segments[1] === "manual-url") {
      return { kind: "manual-url" as const };
    }
  }

  if (segments[0] === "media-collections") {
    if (segments.length === 1) {
      return { kind: "collection-collection" as const };
    }

    const collectionId = decodeURIComponent(segments[1] ?? "");

    if (!collectionId) {
      return null;
    }

    if (segments.length === 2) {
      return { kind: "collection-item" as const, collectionId };
    }

    if (segments.length === 3 && segments[2] === "search") {
      return { kind: "search-collection" as const, collectionId };
    }

    if (segments.length === 3 && segments[2] === "candidates") {
      return { kind: "collection-candidates" as const, collectionId };
    }

    if (segments.length === 3 && segments[2] === "import-approved") {
      return { kind: "import-approved" as const, collectionId };
    }
  }

  if (segments[0] === "media-candidates") {
    const candidateId = decodeURIComponent(segments[1] ?? "");

    if (!candidateId) {
      return null;
    }

    if (segments.length === 2) {
      return { kind: "candidate-item" as const, candidateId };
    }

    if (segments.length === 3 && segments[2] === "approve") {
      return { kind: "approve-candidate" as const, candidateId };
    }

    if (segments.length === 3 && segments[2] === "reject") {
      return { kind: "reject-candidate" as const, candidateId };
    }
  }

  if (segments[0] === "research" && segments[1] === "asset-requirements") {
    const requirementId = decodeURIComponent(segments[2] ?? "");

    if (
      requirementId &&
      segments.length === 4 &&
      segments[3] === "create-media-collection"
    ) {
      return { kind: "requirement-media-collection" as const, requirementId };
    }
  }

  if (segments[0] === "research" && segments[1] === "dossiers") {
    const dossierId = decodeURIComponent(segments[2] ?? "");

    if (
      dossierId &&
      segments.length === 4 &&
      segments[3] === "create-media-collections-for-requirements"
    ) {
      return { kind: "dossier-media-collections" as const, dossierId };
    }
  }

  return null;
}

export async function handleMediaCollectorRoute(
  request: IncomingMessage,
  response: ServerResponse,
  pathname: string,
  dependencies: MediaCollectorRouteDependencies
): Promise<boolean> {
  const match = parsePath(pathname);

  if (!match) {
    return false;
  }

  const service = createMediaCollectorService(dependencies);

  try {
    if (match.kind === "providers") {
      if (request.method === "GET") {
        sendJson(response, 200, service.listProviders());
        return true;
      }

      sendMethodNotAllowed(response, ["GET"]);
      return true;
    }

    if (match.kind === "manual-url") {
      if (request.method === "POST") {
        const payload = await readJsonBody<unknown>(request);
        sendJson(
          response,
          201,
          await service.addManualUrlCandidate(
            validateCreateManualUrlCandidateInput(payload)
          )
        );
        return true;
      }

      sendMethodNotAllowed(response, ["POST"]);
      return true;
    }

    if (match.kind === "collection-collection") {
      if (request.method === "GET") {
        sendJson(response, 200, await service.listCollections());
        return true;
      }

      if (request.method === "POST") {
        const payload = await readJsonBody<unknown>(request);
        sendJson(
          response,
          201,
          await service.createCollection(
            validateCreateMediaCollectionRequestInput(payload)
          )
        );
        return true;
      }

      sendMethodNotAllowed(response, ["GET", "POST"]);
      return true;
    }

    if (match.kind === "collection-item") {
      if (request.method === "GET") {
        sendJson(response, 200, await service.getCollectionById(match.collectionId));
        return true;
      }

      sendMethodNotAllowed(response, ["GET"]);
      return true;
    }

    if (match.kind === "search-collection") {
      if (request.method === "POST") {
        sendJson(
          response,
          200,
          await service.searchCollection(match.collectionId)
        );
        return true;
      }

      sendMethodNotAllowed(response, ["POST"]);
      return true;
    }

    if (match.kind === "collection-candidates") {
      if (request.method === "GET") {
        sendJson(
          response,
          200,
          await service.listCollectionCandidates(match.collectionId)
        );
        return true;
      }

      sendMethodNotAllowed(response, ["GET"]);
      return true;
    }

    if (match.kind === "import-approved") {
      if (request.method === "POST") {
        sendJson(
          response,
          200,
          await service.importApproved(match.collectionId)
        );
        return true;
      }

      sendMethodNotAllowed(response, ["POST"]);
      return true;
    }

    if (match.kind === "candidate-item") {
      if (request.method === "GET") {
        sendJson(response, 200, await service.getCandidateById(match.candidateId));
        return true;
      }

      if (request.method === "PUT") {
        const payload = await readJsonBody<unknown>(request);
        sendJson(
          response,
          200,
          await service.updateCandidate(
            match.candidateId,
            validateUpdateMediaCandidateInput(payload)
          )
        );
        return true;
      }

      sendMethodNotAllowed(response, ["GET", "PUT"]);
      return true;
    }

    if (match.kind === "approve-candidate") {
      if (request.method === "POST") {
        sendJson(
          response,
          200,
          await service.approveCandidate(match.candidateId)
        );
        return true;
      }

      sendMethodNotAllowed(response, ["POST"]);
      return true;
    }

    if (match.kind === "reject-candidate") {
      if (request.method === "POST") {
        sendJson(
          response,
          200,
          await service.rejectCandidate(match.candidateId)
        );
        return true;
      }

      sendMethodNotAllowed(response, ["POST"]);
      return true;
    }

    if (match.kind === "requirement-media-collection") {
      if (request.method === "POST") {
        sendJson(
          response,
          201,
          await service.createCollectionFromResearchRequirement(
            match.requirementId
          )
        );
        return true;
      }

      sendMethodNotAllowed(response, ["POST"]);
      return true;
    }

    if (match.kind === "dossier-media-collections") {
      if (request.method === "POST") {
        sendJson(
          response,
          201,
          await service.createCollectionsFromDossierMissingAssets(
            match.dossierId
          )
        );
        return true;
      }

      sendMethodNotAllowed(response, ["POST"]);
      return true;
    }

    return false;
  } catch (error) {
    handleRouteError(response, error);
    return true;
  }
}

