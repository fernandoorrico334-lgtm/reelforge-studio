import type { DataBackend } from "../../../config/env.js";
import type { ChannelRepository } from "../application/channel-repository.js";
import { createInMemoryChannelRepository } from "./in-memory-channel-repository.js";

export interface ChannelRepositoryBinding {
  backend: DataBackend;
  label: string;
  repository: ChannelRepository;
}

export async function resolveChannelRepository(
  backend: DataBackend
): Promise<ChannelRepositoryBinding> {
  if (backend === "memory") {
    return {
      backend,
      label: "in-memory repository",
      repository: createInMemoryChannelRepository()
    };
  }

  try {
    const { createPrismaChannelRepository } = await import(
      "./prisma-channel-repository.js"
    );

    return {
      backend,
      label: "Prisma + SQLite repository",
      repository: createPrismaChannelRepository()
    };
  } catch (error) {
    console.warn("Falling back to in-memory channel repository:", error);

    return {
      backend: "memory",
      label: "in-memory repository (Prisma unavailable)",
      repository: createInMemoryChannelRepository()
    };
  }
}