import type { IncomingMessage, ServerResponse } from "node:http";
import type { ChannelRepository } from "../../modules/channels/application/channel-repository.js";
import type { ProjectRepository } from "../../modules/projects/application/project-repository.js";
import {
  createReelsFactoryBatch,
  createReelsFactoryProject,
  getReelsFactoryTemplate,
  listReelsFactoryTemplates,
  previewReelsFactory
} from "../../modules/reels-factory/application/reels-factory-service.js";
import {
  validateReelsFactoryBatchInput,
  validateReelsFactoryPreviewInput
} from "../../modules/reels-factory/domain/reels-factory.js";
import {
  handleRouteError,
  parseRouteId,
  readJsonBody,
  sendJson,
  sendMethodNotAllowed
} from "../utils/http-utils.js";

interface ReelsFactoryRouteDependencies {
  channelRepository: ChannelRepository;
  projectRepository: ProjectRepository;
}

export async function handleReelsFactoryRoute(
  request: IncomingMessage,
  response: ServerResponse,
  pathname: string,
  dependencies: ReelsFactoryRouteDependencies
): Promise<boolean> {
  try {
    if (pathname === "/reels-factory/templates") {
      if (request.method !== "GET") {
        sendMethodNotAllowed(response, ["GET"]);
        return true;
      }

      sendJson(response, 200, await listReelsFactoryTemplates());
      return true;
    }

    const templateId = parseRouteId(pathname, "/reels-factory/templates");

    if (templateId) {
      if (request.method !== "GET") {
        sendMethodNotAllowed(response, ["GET"]);
        return true;
      }

      sendJson(response, 200, await getReelsFactoryTemplate(templateId));
      return true;
    }

    if (pathname === "/reels-factory/preview") {
      if (request.method !== "POST") {
        sendMethodNotAllowed(response, ["POST"]);
        return true;
      }

      const payload = await readJsonBody<unknown>(request);
      sendJson(
        response,
        200,
        await previewReelsFactory(validateReelsFactoryPreviewInput(payload))
      );
      return true;
    }

    if (pathname === "/reels-factory/create-project") {
      if (request.method !== "POST") {
        sendMethodNotAllowed(response, ["POST"]);
        return true;
      }

      const payload = await readJsonBody<unknown>(request);
      sendJson(
        response,
        201,
        await createReelsFactoryProject(
          dependencies.projectRepository,
          dependencies.channelRepository,
          validateReelsFactoryPreviewInput(payload)
        )
      );
      return true;
    }

    if (pathname === "/reels-factory/create-batch") {
      if (request.method !== "POST") {
        sendMethodNotAllowed(response, ["POST"]);
        return true;
      }

      const payload = await readJsonBody<unknown>(request);
      sendJson(
        response,
        201,
        await createReelsFactoryBatch(
          dependencies.projectRepository,
          dependencies.channelRepository,
          validateReelsFactoryBatchInput(payload)
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

