import type { Prisma } from "@prisma/client";
import { prisma as defaultPrisma } from "../../../infrastructure/database/prisma-client.js";
import { parseSerializedTags } from "../../assets/domain/asset.js";
import type { ChannelRepository } from "../application/channel-repository.js";
import type {
  CreateChannelInput,
  StudioChannel,
  UpdateChannelInput
} from "../domain/channel.js";

interface PrismaChannelRepositoryOptions {
  prismaClient?: typeof defaultPrisma;
}

function mapChannel(channel: {
  id: string;
  name: string;
  niche: string;
  language: string;
  visualStyle: string | null;
  narrativeTone: string | null;
  defaultTemplate: string | null;
  defaultRenderMode: StudioChannel["defaultRenderMode"];
  defaultRenderQuality: StudioChannel["defaultRenderQuality"];
  defaultAudioMood: string | null;
  defaultCaptionStyle: string | null;
  defaultVisualPreset: string | null;
  defaultMusicAssetId: string | null;
  defaultVoiceoverAssetId: string | null;
  defaultDurationTarget: number | null;
  defaultSceneDuration: number;
  preferredAssetCategories: string;
  preferredAssetTags: string;
  createdAt: Date;
  updatedAt: Date;
}): StudioChannel {
  return {
    id: channel.id,
    name: channel.name,
    niche: channel.niche,
    language: channel.language,
    visualStyle: channel.visualStyle,
    narrativeTone: channel.narrativeTone,
    defaultTemplate: channel.defaultTemplate as StudioChannel["defaultTemplate"],
    defaultRenderMode: channel.defaultRenderMode,
    defaultRenderQuality: channel.defaultRenderQuality,
    defaultAudioMood: channel.defaultAudioMood as StudioChannel["defaultAudioMood"],
    defaultCaptionStyle:
      channel.defaultCaptionStyle as StudioChannel["defaultCaptionStyle"],
    defaultVisualPreset:
      channel.defaultVisualPreset as StudioChannel["defaultVisualPreset"],
    defaultMusicAssetId: channel.defaultMusicAssetId,
    defaultVoiceoverAssetId: channel.defaultVoiceoverAssetId,
    defaultDurationTarget: channel.defaultDurationTarget,
    defaultSceneDuration: channel.defaultSceneDuration,
    preferredAssetCategories:
      parseSerializedTags(channel.preferredAssetCategories) as StudioChannel["preferredAssetCategories"],
    preferredAssetTags: parseSerializedTags(channel.preferredAssetTags),
    createdAt: channel.createdAt.toISOString(),
    updatedAt: channel.updatedAt.toISOString()
  };
}

function serializeCreateInput(
  input: CreateChannelInput
): Prisma.ChannelCreateInput {
  return {
    name: input.name,
    niche: input.niche,
    language: input.language,
    visualStyle: input.visualStyle,
    narrativeTone: input.narrativeTone,
    defaultTemplate: input.defaultTemplate,
    defaultRenderMode: input.defaultRenderMode,
    defaultRenderQuality: input.defaultRenderQuality,
    defaultAudioMood: input.defaultAudioMood,
    defaultCaptionStyle: input.defaultCaptionStyle,
    defaultVisualPreset: input.defaultVisualPreset,
    defaultMusicAssetId: input.defaultMusicAssetId,
    defaultVoiceoverAssetId: input.defaultVoiceoverAssetId,
    defaultDurationTarget: input.defaultDurationTarget,
    defaultSceneDuration: input.defaultSceneDuration,
    preferredAssetCategories: JSON.stringify(input.preferredAssetCategories),
    preferredAssetTags: JSON.stringify(input.preferredAssetTags)
  };
}

function serializeUpdateInput(
  input: UpdateChannelInput
): Prisma.ChannelUpdateInput {
  const data: Prisma.ChannelUpdateInput = {};

  if ("name" in input) {
    data.name = input.name;
  }

  if ("niche" in input) {
    data.niche = input.niche;
  }

  if ("language" in input) {
    data.language = input.language;
  }

  if ("visualStyle" in input) {
    data.visualStyle = input.visualStyle;
  }

  if ("narrativeTone" in input) {
    data.narrativeTone = input.narrativeTone;
  }

  if ("defaultTemplate" in input) {
    data.defaultTemplate = input.defaultTemplate;
  }

  if ("defaultRenderMode" in input) {
    data.defaultRenderMode = input.defaultRenderMode;
  }

  if ("defaultRenderQuality" in input) {
    data.defaultRenderQuality = input.defaultRenderQuality;
  }

  if ("defaultAudioMood" in input) {
    data.defaultAudioMood = input.defaultAudioMood;
  }

  if ("defaultCaptionStyle" in input) {
    data.defaultCaptionStyle = input.defaultCaptionStyle;
  }

  if ("defaultVisualPreset" in input) {
    data.defaultVisualPreset = input.defaultVisualPreset;
  }

  if ("defaultMusicAssetId" in input) {
    data.defaultMusicAssetId = input.defaultMusicAssetId;
  }

  if ("defaultVoiceoverAssetId" in input) {
    data.defaultVoiceoverAssetId = input.defaultVoiceoverAssetId;
  }

  if ("defaultDurationTarget" in input) {
    data.defaultDurationTarget = input.defaultDurationTarget;
  }

  if ("defaultSceneDuration" in input) {
    data.defaultSceneDuration = input.defaultSceneDuration;
  }

  if ("preferredAssetCategories" in input) {
    data.preferredAssetCategories = JSON.stringify(
      input.preferredAssetCategories ?? []
    );
  }

  if ("preferredAssetTags" in input) {
    data.preferredAssetTags = JSON.stringify(input.preferredAssetTags ?? []);
  }

  return data;
}

export function createPrismaChannelRepository({
  prismaClient = defaultPrisma
}: PrismaChannelRepositoryOptions = {}): ChannelRepository {
  return {
    async list() {
      const channels = await prismaClient.channel.findMany({
        orderBy: {
          createdAt: "desc"
        }
      });

      return channels.map(mapChannel);
    },
    async getById(id) {
      const channel = await prismaClient.channel.findUnique({
        where: { id }
      });

      return channel ? mapChannel(channel) : null;
    },
    async create(input: CreateChannelInput) {
      const channel = await prismaClient.channel.create({
        data: serializeCreateInput(input)
      });

      return mapChannel(channel);
    },
    async update(id: string, input: UpdateChannelInput) {
      const existing = await prismaClient.channel.findUnique({
        where: { id }
      });

      if (!existing) {
        return null;
      }

      const channel = await prismaClient.channel.update({
        where: { id },
        data: serializeUpdateInput(input)
      });

      return mapChannel(channel);
    },
    async delete(id: string) {
      const existing = await prismaClient.channel.findUnique({
        where: { id }
      });

      if (!existing) {
        return false;
      }

      await prismaClient.channel.delete({
        where: { id }
      });

      return true;
    }
  };
}