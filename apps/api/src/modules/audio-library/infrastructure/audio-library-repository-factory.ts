import type { DataBackend } from "../../../config/env.js";
import type { AudioLibraryRepository } from "../application/audio-library-repository.js";
import { createInMemoryAudioLibraryRepository } from "./in-memory-audio-library-repository.js";

export interface AudioLibraryRepositoryBinding {
  backend: DataBackend;
  label: string;
  repository: AudioLibraryRepository;
}

export async function resolveAudioLibraryRepository(
  backend: DataBackend
): Promise<AudioLibraryRepositoryBinding> {
  if (backend === "memory") {
    return {
      backend,
      label: "in-memory audio library repository",
      repository: createInMemoryAudioLibraryRepository()
    };
  }

  try {
    const { createPrismaAudioLibraryRepository } = await import(
      "./prisma-audio-library-repository.js"
    );

    return {
      backend,
      label: "Prisma + SQLite audio library repository",
      repository: createPrismaAudioLibraryRepository()
    };
  } catch (error) {
    console.warn("Falling back to in-memory audio library repository:", error);

    return {
      backend: "memory",
      label: "in-memory audio library repository (Prisma unavailable)",
      repository: createInMemoryAudioLibraryRepository()
    };
  }
}
