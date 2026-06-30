import type { IncomingMessage, ServerResponse } from "node:http";
import type { AssetRepository } from "../../modules/assets/application/asset-repository.js";
import type { ChannelRepository } from "../../modules/channels/application/channel-repository.js";
import type { ProjectRepository } from "../../modules/projects/application/project-repository.js";
import {
  createProductionFromScript
} from "../../modules/production/application/production-service.js";
import { validateCreateProductionFromScriptInput } from "../../modules/production/domain/production.js";
import {
  handleRouteError,
  readJsonBody,
  sendJson,
  sendMethodNotAllowed
} from "../utils/http-utils.js";

interface ProductionRouteDependencies {
  assetRepository: AssetRepository;
  channelRepository: ChannelRepository;
  projectRepository: ProjectRepository;
}

export async function handleProductionRoute(
  request: IncomingMessage,
  response: ServerResponse,
  pathname: string,
  dependencies: ProductionRouteDependencies
): Promise<boolean> {
  if (pathname !== "/production/create-from-script") {
    return false;
  }

  try {
    if (request.method === "POST") {
      const payload = await readJsonBody<unknown>(request);
      const created = await createProductionFromScript(
        dependencies.projectRepository,
        dependencies.channelRepository,
        dependencies.assetRepository,
        validateCreateProductionFromScriptInput(payload)
      );
      sendJson(response, 201, created);
      return true;
    }

    sendMethodNotAllowed(response, ["POST"]);
    return true;
  } catch (error) {
    handleRouteError(response, error);
    return true;
  }
}

