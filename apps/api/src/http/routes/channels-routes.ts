import type { IncomingMessage, ServerResponse } from "node:http";
import type { AssetRepository } from "../../modules/assets/application/asset-repository.js";
import {
  createChannel,
  deleteChannel,
  getChannelById,
  listChannels,
  updateChannel
} from "../../modules/channels/application/channel-service.js";
import type { ChannelRepository } from "../../modules/channels/application/channel-repository.js";
import {
  validateCreateChannelInput,
  validateUpdateChannelInput
} from "../../modules/channels/domain/channel.js";
import {
  handleRouteError,
  parseRouteId,
  readJsonBody,
  sendJson,
  sendMethodNotAllowed,
  sendNoContent
} from "../utils/http-utils.js";

interface ChannelRouteDependencies {
  assetRepository: AssetRepository;
  channelRepository: ChannelRepository;
}

export async function handleChannelRoute(
  request: IncomingMessage,
  response: ServerResponse,
  pathname: string,
  dependencies: ChannelRouteDependencies
): Promise<boolean> {
  const { assetRepository, channelRepository } = dependencies;

  if (pathname === "/channels") {
    try {
      if (request.method === "GET") {
        sendJson(response, 200, await listChannels(channelRepository));
        return true;
      }

      if (request.method === "POST") {
        const payload = await readJsonBody<unknown>(request);
        const created = await createChannel(
          channelRepository,
          assetRepository,
          validateCreateChannelInput(payload)
        );
        sendJson(response, 201, created);
        return true;
      }

      sendMethodNotAllowed(response, ["GET", "POST"]);
      return true;
    } catch (error) {
      handleRouteError(response, error);
      return true;
    }
  }

  const channelId = parseRouteId(pathname, "/channels");

  if (!channelId) {
    return false;
  }

  try {
    if (request.method === "GET") {
      sendJson(response, 200, await getChannelById(channelRepository, channelId));
      return true;
    }

    if (request.method === "PUT") {
      const payload = await readJsonBody<unknown>(request);
      const updated = await updateChannel(
        channelRepository,
        assetRepository,
        channelId,
        validateUpdateChannelInput(payload)
      );
      sendJson(response, 200, updated);
      return true;
    }

    if (request.method === "DELETE") {
      await deleteChannel(channelRepository, channelId);
      sendNoContent(response);
      return true;
    }

    sendMethodNotAllowed(response, ["GET", "PUT", "DELETE"]);
    return true;
  } catch (error) {
    handleRouteError(response, error);
    return true;
  }
}