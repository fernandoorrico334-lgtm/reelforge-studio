import type { IncomingMessage, ServerResponse } from "node:http";
import type { AssetRepository } from "../../modules/assets/application/asset-repository.js";
import type { IntakeRepository } from "../../modules/intake/application/intake-repository.js";
import {
  approveIntakeCandidate,
  getIntakeCollectionById,
  getIntakeFolders,
  getIntakeCandidateById,
  importApprovedInboxCandidates,
  listIntakeCandidates,
  listIntakeCollections,
  rejectIntakeCandidate,
  scanInbox,
  updateIntakeCandidate
} from "../../modules/intake/application/intake-service.js";
import {
  validateMediaCandidateFilters,
  validateUpdateMediaCandidateInput
} from "../../modules/intake/domain/intake.js";
import {
  handleRouteError,
  readJsonBody,
  sendJson,
  sendMethodNotAllowed
} from "../utils/http-utils.js";

function splitPath(pathname: string) {
  return pathname.split("/").filter(Boolean);
}

export async function handleIntakeRoute(
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
  dependencies: {
    assetRepository: AssetRepository;
    intakeRepository: IntakeRepository;
  }
): Promise<boolean> {
  const { assetRepository, intakeRepository } = dependencies;
  const segments = splitPath(url.pathname);

  if (segments[0] !== "intake") {
    return false;
  }

  try {
    if (segments.length === 2 && segments[1] === "folders") {
      if (request.method !== "GET") {
        sendMethodNotAllowed(response, ["GET"]);
        return true;
      }

      sendJson(response, 200, await getIntakeFolders());
      return true;
    }

    if (segments.length === 2 && segments[1] === "scan") {
      if (request.method !== "POST") {
        sendMethodNotAllowed(response, ["POST"]);
        return true;
      }

      sendJson(response, 200, await scanInbox(intakeRepository, assetRepository));
      return true;
    }

    if (segments.length === 2 && segments[1] === "import-approved") {
      if (request.method !== "POST") {
        sendMethodNotAllowed(response, ["POST"]);
        return true;
      }

      sendJson(
        response,
        200,
        await importApprovedInboxCandidates(intakeRepository, assetRepository)
      );
      return true;
    }

    if (segments.length === 2 && segments[1] === "collections") {
      if (request.method !== "GET") {
        sendMethodNotAllowed(response, ["GET"]);
        return true;
      }

      sendJson(response, 200, await listIntakeCollections(intakeRepository));
      return true;
    }

    if (segments.length === 3 && segments[1] === "collections") {
      if (request.method !== "GET") {
        sendMethodNotAllowed(response, ["GET"]);
        return true;
      }

      sendJson(
        response,
        200,
        await getIntakeCollectionById(intakeRepository, decodeURIComponent(segments[2] ?? ""))
      );
      return true;
    }

    if (segments.length === 2 && segments[1] === "candidates") {
      if (request.method !== "GET") {
        sendMethodNotAllowed(response, ["GET"]);
        return true;
      }

      sendJson(
        response,
        200,
        await listIntakeCandidates(
          intakeRepository,
          validateMediaCandidateFilters({
            collectionId: url.searchParams.get("collectionId") ?? undefined,
            status: url.searchParams.get("status") ?? undefined,
            provider: url.searchParams.get("provider") ?? undefined,
            mediaType: url.searchParams.get("mediaType") ?? undefined,
            category: url.searchParams.get("category") ?? undefined,
            character: url.searchParams.get("character") ?? undefined,
            suggestedProject:
              url.searchParams.get("suggestedProject") ?? undefined
          })
        )
      );
      return true;
    }

    if (segments.length === 3 && segments[1] === "candidates") {
      const candidateId = decodeURIComponent(segments[2] ?? "");

      if (request.method === "GET") {
        sendJson(response, 200, await getIntakeCandidateById(intakeRepository, candidateId));
        return true;
      }

      if (request.method === "PUT") {
        const payload = await readJsonBody<unknown>(request);
        sendJson(
          response,
          200,
          await updateIntakeCandidate(
            intakeRepository,
            candidateId,
            validateUpdateMediaCandidateInput(payload)
          )
        );
        return true;
      }

      sendMethodNotAllowed(response, ["GET", "PUT"]);
      return true;
    }

    if (segments.length === 4 && segments[1] === "candidates" && segments[3] === "approve") {
      if (request.method !== "POST") {
        sendMethodNotAllowed(response, ["POST"]);
        return true;
      }

      sendJson(
        response,
        200,
        await approveIntakeCandidate(
          intakeRepository,
          decodeURIComponent(segments[2] ?? "")
        )
      );
      return true;
    }

    if (segments.length === 4 && segments[1] === "candidates" && segments[3] === "reject") {
      if (request.method !== "POST") {
        sendMethodNotAllowed(response, ["POST"]);
        return true;
      }

      sendJson(
        response,
        200,
        await rejectIntakeCandidate(
          intakeRepository,
          decodeURIComponent(segments[2] ?? "")
        )
      );
      return true;
    }

    return false;
  } catch (error) {
    handleRouteError(response, error);
    return true;
  }
}

