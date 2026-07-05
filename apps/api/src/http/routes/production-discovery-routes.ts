import type { IncomingMessage, ServerResponse } from "node:http";
import type { AssetRepository } from "../../modules/assets/application/asset-repository.js";
import type { ChannelRepository } from "../../modules/channels/application/channel-repository.js";
import type { IntakeRepository } from "../../modules/intake/application/intake-repository.js";
import type { ProjectRepository } from "../../modules/projects/application/project-repository.js";
import type { ProductionDiscoveryRepository } from "../../modules/production-discovery/application/production-discovery-repository.js";
import {
  buildProductionDiscoveryAssetRequirements,
  createProductionDiscoveryPackage,
  createProjectFromProductionDiscovery,
  getProductionDiscoveryPackage,
  listProductionDiscoveryNiches,
  listProductionDiscoveryPackages,
  runProductionDiscoveryResearch,
  searchProductionDiscoveryMediaCandidates
} from "../../modules/production-discovery/application/production-discovery-service.js";
import { validateCreateDiscoveryInput } from "../../modules/production-discovery/domain/production-discovery.js";
import type { ResearchRepository } from "../../modules/research/application/research-repository.js";
import {
  handleRouteError,
  readJsonBody,
  sendJson,
  sendMethodNotAllowed
} from "../utils/http-utils.js";

interface ProductionDiscoveryRouteDependencies {
  assetRepository: AssetRepository;
  channelRepository: ChannelRepository;
  intakeRepository: IntakeRepository;
  productionDiscoveryRepository: ProductionDiscoveryRepository;
  projectRepository: ProjectRepository;
  researchRepository: ResearchRepository;
}

function parsePackageRoute(pathname: string) {
  const prefix = "/production-discovery/packages/";
  if (!pathname.startsWith(prefix)) {
    return null;
  }

  const [packageId, action] = pathname.slice(prefix.length).split("/");

  return packageId
    ? {
        packageId: decodeURIComponent(packageId),
        action: action ? decodeURIComponent(action) : null
      }
    : null;
}

export async function handleProductionDiscoveryRoute(
  request: IncomingMessage,
  response: ServerResponse,
  pathname: string,
  dependencies: ProductionDiscoveryRouteDependencies
): Promise<boolean> {
  try {
    if (pathname === "/production-discovery/niches") {
      if (request.method !== "GET") {
        sendMethodNotAllowed(response, ["GET"]);
        return true;
      }

      sendJson(response, 200, listProductionDiscoveryNiches());
      return true;
    }

    if (pathname === "/production-discovery/create") {
      if (request.method !== "POST") {
        sendMethodNotAllowed(response, ["POST"]);
        return true;
      }

      const payload = await readJsonBody<unknown>(request);
      sendJson(
        response,
        201,
        await createProductionDiscoveryPackage(
          dependencies,
          validateCreateDiscoveryInput(payload)
        )
      );
      return true;
    }

    if (pathname === "/production-discovery/packages") {
      if (request.method !== "GET") {
        sendMethodNotAllowed(response, ["GET"]);
        return true;
      }

      sendJson(
        response,
        200,
        await listProductionDiscoveryPackages(
          dependencies.productionDiscoveryRepository
        )
      );
      return true;
    }

    const route = parsePackageRoute(pathname);
    if (!route) {
      return false;
    }

    if (!route.action) {
      if (request.method !== "GET") {
        sendMethodNotAllowed(response, ["GET"]);
        return true;
      }

      sendJson(
        response,
        200,
        await getProductionDiscoveryPackage(
          dependencies.productionDiscoveryRepository,
          route.packageId
        )
      );
      return true;
    }

    if (route.action === "run-research") {
      if (request.method !== "POST") {
        sendMethodNotAllowed(response, ["POST"]);
        return true;
      }

      sendJson(
        response,
        200,
        await runProductionDiscoveryResearch(dependencies, route.packageId)
      );
      return true;
    }

    if (route.action === "build-asset-requirements") {
      if (request.method !== "POST") {
        sendMethodNotAllowed(response, ["POST"]);
        return true;
      }

      sendJson(
        response,
        200,
        await buildProductionDiscoveryAssetRequirements(
          dependencies,
          route.packageId
        )
      );
      return true;
    }

    if (route.action === "search-media-candidates") {
      if (request.method !== "POST") {
        sendMethodNotAllowed(response, ["POST"]);
        return true;
      }

      sendJson(
        response,
        200,
        await searchProductionDiscoveryMediaCandidates(
          dependencies,
          route.packageId
        )
      );
      return true;
    }

    if (route.action === "create-project") {
      if (request.method !== "POST") {
        sendMethodNotAllowed(response, ["POST"]);
        return true;
      }

      sendJson(
        response,
        201,
        await createProjectFromProductionDiscovery(dependencies, route.packageId)
      );
      return true;
    }

    if (route.action === "media-candidates") {
      if (request.method !== "GET") {
        sendMethodNotAllowed(response, ["GET"]);
        return true;
      }

      const item = await getProductionDiscoveryPackage(
        dependencies.productionDiscoveryRepository,
        route.packageId
      );
      const candidates = (
        await Promise.all(
          item.mediaCollectionIds.map((collectionId) =>
            dependencies.intakeRepository.listCandidates({ collectionId })
          )
        )
      ).flat();
      sendJson(response, 200, candidates);
      return true;
    }

    if (route.action === "asset-requirements") {
      if (request.method !== "GET") {
        sendMethodNotAllowed(response, ["GET"]);
        return true;
      }

      const item = await getProductionDiscoveryPackage(
        dependencies.productionDiscoveryRepository,
        route.packageId
      );
      sendJson(response, 200, item.assetRequirements);
      return true;
    }

    return false;
  } catch (error) {
    handleRouteError(response, error);
    return true;
  }
}
