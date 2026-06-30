import { NotFoundError, ValidationError } from "../../../shared/errors.js";
import type { AssetRepository } from "../../assets/application/asset-repository.js";
import type {
  CreateChannelInput,
  UpdateChannelInput
} from "../domain/channel.js";
import type { ChannelRepository } from "./channel-repository.js";

async function ensureAssetExists(
  assetRepository: AssetRepository,
  assetId: string,
  allowedTypes: string[],
  fieldName: string
) {
  const asset = await assetRepository.getById(assetId);

  if (!asset) {
    throw new NotFoundError(`Asset '${assetId}' was not found.`);
  }

  if (!allowedTypes.includes(asset.type)) {
    throw new ValidationError(
      `${fieldName} must reference one of: ${allowedTypes.join(", ")}.`
    );
  }
}

async function validateChannelAssetDefaults(
  assetRepository: AssetRepository,
  input: Pick<
    CreateChannelInput | UpdateChannelInput,
    "defaultMusicAssetId" | "defaultVoiceoverAssetId"
  >
) {
  if (input.defaultMusicAssetId) {
    await ensureAssetExists(
      assetRepository,
      input.defaultMusicAssetId,
      ["MUSIC", "AUDIO"],
      "defaultMusicAssetId"
    );
  }

  if (input.defaultVoiceoverAssetId) {
    await ensureAssetExists(
      assetRepository,
      input.defaultVoiceoverAssetId,
      ["AUDIO"],
      "defaultVoiceoverAssetId"
    );
  }
}

export async function listChannels(repository: ChannelRepository) {
  return repository.list();
}

export async function getChannelById(
  repository: ChannelRepository,
  id: string
) {
  const channel = await repository.getById(id);

  if (!channel) {
    throw new NotFoundError(`Channel '${id}' was not found.`);
  }

  return channel;
}

export async function createChannel(
  repository: ChannelRepository,
  assetRepository: AssetRepository,
  input: CreateChannelInput
) {
  await validateChannelAssetDefaults(assetRepository, input);
  return repository.create(input);
}

export async function updateChannel(
  repository: ChannelRepository,
  assetRepository: AssetRepository,
  id: string,
  input: UpdateChannelInput
) {
  await validateChannelAssetDefaults(assetRepository, input);

  const channel = await repository.update(id, input);

  if (!channel) {
    throw new NotFoundError(`Channel '${id}' was not found.`);
  }

  return channel;
}

export async function deleteChannel(
  repository: ChannelRepository,
  id: string
) {
  const deleted = await repository.delete(id);

  if (!deleted) {
    throw new NotFoundError(`Channel '${id}' was not found.`);
  }
}