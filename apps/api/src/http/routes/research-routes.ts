import type { IncomingMessage, ServerResponse } from "node:http";
import type { AssetRepository } from "../../modules/assets/application/asset-repository.js";
import type { ChannelRepository } from "../../modules/channels/application/channel-repository.js";
import type { ProjectRepository } from "../../modules/projects/application/project-repository.js";
import type { ResearchRepository } from "../../modules/research/application/research-repository.js";
import {
  addManualResearchSource,
  analyzeResearchDossier,
  approveResearchSource,
  createProductionFromResearchDossier,
  createResearchDossier,
  deleteResearchDossier,
  fetchResearchSourceFromPublicUrl,
  generateDossierSearchQueryBundle,
  getResearchDossierById,
  getResearchSourceById,
  listResearchAssetRequirements,
  listResearchDossiers,
  listResearchFacts,
  listResearchHooks,
  listResearchOutlineScenes,
  listResearchSources,
  listResearchTimeline,
  rejectResearchSource,
  searchWikipediaResearchSources,
  searchWikidataResearchSources,
  updateResearchDossier
} from "../../modules/research/application/research-service.js";
import {
  validateCreateProductionFromResearchInput,
  validateCreateResearchDossierInput,
  validateManualResearchSourceInput,
  validateResearchConnectorSearchInput,
  validateResearchUrlFetchInput,
  validateUpdateResearchDossierInput
} from "../../modules/research/domain/research.js";
import {
  handleRouteError,
  readJsonBody,
  sendJson,
  sendMethodNotAllowed,
  sendNoContent
} from "../utils/http-utils.js";

function parseResearchPath(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);

  if (segments[0] !== "research") {
    return null;
  }

  if (segments[1] === "dossiers") {
    if (segments.length === 2) {
      return { kind: "dossier-collection" as const };
    }

    const dossierId = decodeURIComponent(segments[2] ?? "");

    if (!dossierId) {
      return null;
    }

    if (segments.length === 3) {
      return { kind: "dossier-item" as const, dossierId };
    }

    if (segments.length === 4) {
      switch (segments[3]) {
        case "generate-search-queries":
          return { kind: "generate-search-queries" as const, dossierId };
        case "sources":
          return { kind: "dossier-sources" as const, dossierId };
        case "analyze":
          return { kind: "analyze-dossier" as const, dossierId };
        case "facts":
          return { kind: "facts" as const, dossierId };
        case "timeline":
          return { kind: "timeline" as const, dossierId };
        case "hooks":
          return { kind: "hooks" as const, dossierId };
        case "asset-requirements":
          return { kind: "asset-requirements" as const, dossierId };
        case "outline":
          return { kind: "outline" as const, dossierId };
        case "create-production":
          return { kind: "create-production" as const, dossierId };
        default:
          return null;
      }
    }

    if (segments.length === 5 && segments[3] === "sources") {
      switch (segments[4]) {
        case "manual":
          return { kind: "manual-source" as const, dossierId };
        case "fetch-url":
          return { kind: "fetch-url-source" as const, dossierId };
        case "search-wikipedia":
          return { kind: "search-wikipedia" as const, dossierId };
        case "search-wikidata":
          return { kind: "search-wikidata" as const, dossierId };
        default:
          return null;
      }
    }
  }

  if (segments[1] === "sources") {
    const sourceId = decodeURIComponent(segments[2] ?? "");

    if (!sourceId) {
      return null;
    }

    if (segments.length === 3) {
      return { kind: "source-item" as const, sourceId };
    }

    if (segments.length === 4) {
      switch (segments[3]) {
        case "approve":
          return { kind: "approve-source" as const, sourceId };
        case "reject":
          return { kind: "reject-source" as const, sourceId };
        default:
          return null;
      }
    }
  }

  return null;
}

interface ResearchRouteDependencies {
  assetRepository: AssetRepository;
  channelRepository: ChannelRepository;
  projectRepository: ProjectRepository;
  researchRepository: ResearchRepository;
}

export async function handleResearchRoute(
  request: IncomingMessage,
  response: ServerResponse,
  pathname: string,
  dependencies: ResearchRouteDependencies
): Promise<boolean> {
  const match = parseResearchPath(pathname);

  if (!match) {
    return false;
  }

  const {
    assetRepository,
    channelRepository,
    projectRepository,
    researchRepository
  } = dependencies;

  try {
    if (match.kind === "dossier-collection") {
      if (request.method === "GET") {
        sendJson(response, 200, await listResearchDossiers(researchRepository));
        return true;
      }

      if (request.method === "POST") {
        const payload = await readJsonBody<unknown>(request);
        sendJson(
          response,
          201,
          await createResearchDossier(
            researchRepository,
            channelRepository,
            validateCreateResearchDossierInput(payload)
          )
        );
        return true;
      }

      sendMethodNotAllowed(response, ["GET", "POST"]);
      return true;
    }

    if (match.kind === "dossier-item") {
      if (request.method === "GET") {
        sendJson(
          response,
          200,
          await getResearchDossierById(researchRepository, match.dossierId)
        );
        return true;
      }

      if (request.method === "PUT") {
        const payload = await readJsonBody<unknown>(request);
        sendJson(
          response,
          200,
          await updateResearchDossier(
            researchRepository,
            channelRepository,
            match.dossierId,
            validateUpdateResearchDossierInput(payload)
          )
        );
        return true;
      }

      if (request.method === "DELETE") {
        await deleteResearchDossier(researchRepository, match.dossierId);
        sendNoContent(response);
        return true;
      }

      sendMethodNotAllowed(response, ["GET", "PUT", "DELETE"]);
      return true;
    }

    if (match.kind === "generate-search-queries") {
      if (request.method === "POST") {
        sendJson(
          response,
          200,
          await generateDossierSearchQueryBundle(
            researchRepository,
            match.dossierId
          )
        );
        return true;
      }

      sendMethodNotAllowed(response, ["POST"]);
      return true;
    }

    if (match.kind === "dossier-sources") {
      if (request.method === "GET") {
        sendJson(
          response,
          200,
          await listResearchSources(researchRepository, match.dossierId)
        );
        return true;
      }

      sendMethodNotAllowed(response, ["GET"]);
      return true;
    }

    if (match.kind === "manual-source") {
      if (request.method === "POST") {
        const payload = await readJsonBody<unknown>(request);
        sendJson(
          response,
          201,
          await addManualResearchSource(
            researchRepository,
            match.dossierId,
            validateManualResearchSourceInput(payload)
          )
        );
        return true;
      }

      sendMethodNotAllowed(response, ["POST"]);
      return true;
    }

    if (match.kind === "fetch-url-source") {
      if (request.method === "POST") {
        const payload = await readJsonBody<unknown>(request);
        sendJson(
          response,
          201,
          await fetchResearchSourceFromPublicUrl(
            researchRepository,
            match.dossierId,
            validateResearchUrlFetchInput(payload)
          )
        );
        return true;
      }

      sendMethodNotAllowed(response, ["POST"]);
      return true;
    }

    if (match.kind === "search-wikipedia") {
      if (request.method === "POST") {
        const payload = await readJsonBody<unknown>(request);
        sendJson(
          response,
          200,
          await searchWikipediaResearchSources(
            researchRepository,
            match.dossierId,
            validateResearchConnectorSearchInput(payload)
          )
        );
        return true;
      }

      sendMethodNotAllowed(response, ["POST"]);
      return true;
    }

    if (match.kind === "search-wikidata") {
      if (request.method === "POST") {
        const payload = await readJsonBody<unknown>(request);
        sendJson(
          response,
          200,
          await searchWikidataResearchSources(
            researchRepository,
            match.dossierId,
            validateResearchConnectorSearchInput(payload)
          )
        );
        return true;
      }

      sendMethodNotAllowed(response, ["POST"]);
      return true;
    }

    if (match.kind === "source-item") {
      if (request.method === "GET") {
        sendJson(
          response,
          200,
          await getResearchSourceById(researchRepository, match.sourceId)
        );
        return true;
      }

      sendMethodNotAllowed(response, ["GET"]);
      return true;
    }

    if (match.kind === "approve-source") {
      if (request.method === "POST") {
        sendJson(
          response,
          200,
          await approveResearchSource(researchRepository, match.sourceId)
        );
        return true;
      }

      sendMethodNotAllowed(response, ["POST"]);
      return true;
    }

    if (match.kind === "reject-source") {
      if (request.method === "POST") {
        sendJson(
          response,
          200,
          await rejectResearchSource(researchRepository, match.sourceId)
        );
        return true;
      }

      sendMethodNotAllowed(response, ["POST"]);
      return true;
    }

    if (match.kind === "analyze-dossier") {
      if (request.method === "POST") {
        sendJson(
          response,
          200,
          await analyzeResearchDossier(researchRepository, match.dossierId)
        );
        return true;
      }

      sendMethodNotAllowed(response, ["POST"]);
      return true;
    }

    if (match.kind === "facts") {
      if (request.method === "GET") {
        sendJson(
          response,
          200,
          await listResearchFacts(researchRepository, match.dossierId)
        );
        return true;
      }

      sendMethodNotAllowed(response, ["GET"]);
      return true;
    }

    if (match.kind === "timeline") {
      if (request.method === "GET") {
        sendJson(
          response,
          200,
          await listResearchTimeline(researchRepository, match.dossierId)
        );
        return true;
      }

      sendMethodNotAllowed(response, ["GET"]);
      return true;
    }

    if (match.kind === "hooks") {
      if (request.method === "GET") {
        sendJson(
          response,
          200,
          await listResearchHooks(researchRepository, match.dossierId)
        );
        return true;
      }

      sendMethodNotAllowed(response, ["GET"]);
      return true;
    }

    if (match.kind === "asset-requirements") {
      if (request.method === "GET") {
        sendJson(
          response,
          200,
          await listResearchAssetRequirements(
            researchRepository,
            match.dossierId
          )
        );
        return true;
      }

      sendMethodNotAllowed(response, ["GET"]);
      return true;
    }

    if (match.kind === "outline") {
      if (request.method === "GET") {
        sendJson(
          response,
          200,
          await listResearchOutlineScenes(researchRepository, match.dossierId)
        );
        return true;
      }

      sendMethodNotAllowed(response, ["GET"]);
      return true;
    }

    if (match.kind === "create-production") {
      if (request.method === "POST") {
        const payload = await readJsonBody<unknown>(request);
        sendJson(
          response,
          201,
          await createProductionFromResearchDossier(
            researchRepository,
            projectRepository,
            channelRepository,
            assetRepository,
            match.dossierId,
            validateCreateProductionFromResearchInput(payload)
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

