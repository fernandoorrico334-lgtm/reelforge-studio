import {
  createMemoryId,
  createTimestamp,
  getMemoryStudioState
} from "../../../infrastructure/memory/studio-memory-store.js";
import {
  defaultRenderMode,
  defaultRenderQuality
} from "../../render-jobs/domain/render-job.js";
import type { ChannelRepository } from "../application/channel-repository.js";
import type {
  CreateChannelInput,
  StudioChannel,
  UpdateChannelInput
} from "../domain/channel.js";

function sortChannels(channels: StudioChannel[]) {
  return [...channels].sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt)
  );
}

export function createInMemoryChannelRepository(): ChannelRepository {
  const state = getMemoryStudioState();

  return {
    async list() {
      return sortChannels(state.channels);
    },
    async getById(id) {
      return state.channels.find((channel) => channel.id === id) ?? null;
    },
    async create(input: CreateChannelInput) {
      const timestamp = createTimestamp();
      const channel: StudioChannel = {
        ...input,
        id: createMemoryId("channel"),
        createdAt: timestamp,
        updatedAt: timestamp,
        defaultRenderMode: input.defaultRenderMode ?? defaultRenderMode,
        defaultRenderQuality:
          input.defaultRenderQuality ?? defaultRenderQuality,
        defaultAudioMood: input.defaultAudioMood ?? null,
        defaultCaptionStyle: input.defaultCaptionStyle ?? null,
        defaultVisualPreset: input.defaultVisualPreset ?? null,
        defaultMusicAssetId: input.defaultMusicAssetId ?? null,
        defaultVoiceoverAssetId: input.defaultVoiceoverAssetId ?? null,
        defaultDurationTarget: input.defaultDurationTarget ?? null,
        defaultSceneDuration: input.defaultSceneDuration ?? 4,
        preferredAssetCategories: [...(input.preferredAssetCategories ?? [])],
        preferredAssetTags: [...(input.preferredAssetTags ?? [])]
      };

      state.channels.unshift(channel);
      return channel;
    },
    async update(id: string, input: UpdateChannelInput) {
      const channelIndex = state.channels.findIndex((channel) => channel.id === id);

      if (channelIndex === -1) {
        return null;
      }

      const existingChannel = state.channels[channelIndex];

      if (!existingChannel) {
        return null;
      }

      const updated: StudioChannel = {
        ...existingChannel,
        ...input,
        preferredAssetCategories:
          "preferredAssetCategories" in input
            ? [...(input.preferredAssetCategories ?? [])]
            : existingChannel.preferredAssetCategories,
        preferredAssetTags:
          "preferredAssetTags" in input
            ? [...(input.preferredAssetTags ?? [])]
            : existingChannel.preferredAssetTags,
        updatedAt: createTimestamp()
      };

      state.channels[channelIndex] = updated;
      return updated;
    },
    async delete(id: string) {
      const channelIndex = state.channels.findIndex((channel) => channel.id === id);

      if (channelIndex === -1) {
        return false;
      }

      state.channels.splice(channelIndex, 1);

      const projectIds = state.videoProjects
        .filter((project) => project.channelId === id)
        .map((project) => project.id);

      state.videoProjects = state.videoProjects.filter(
        (project) => project.channelId !== id
      );
      state.scenes = state.scenes.filter(
        (scene) => !projectIds.includes(scene.videoProjectId)
      );

      return true;
    }
  };
}
