import type {
  CreateChannelInput,
  StudioChannel,
  UpdateChannelInput
} from "../domain/channel.js";

export interface ChannelRepository {
  list(): Promise<StudioChannel[]>;
  getById(id: string): Promise<StudioChannel | null>;
  create(input: CreateChannelInput): Promise<StudioChannel>;
  update(
    id: string,
    input: UpdateChannelInput
  ): Promise<StudioChannel | null>;
  delete(id: string): Promise<boolean>;
}