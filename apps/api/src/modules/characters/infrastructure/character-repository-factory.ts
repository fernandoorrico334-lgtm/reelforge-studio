import type { DataBackend } from "../../../config/env.js";
import type { CharacterRepository } from "../application/character-repository.js";
import { createInMemoryCharacterRepository } from "./in-memory-character-repository.js";

export interface CharacterRepositoryBinding {
  backend: DataBackend;
  label: string;
  repository: CharacterRepository;
}

export async function resolveCharacterRepository(
  backend: DataBackend
): Promise<CharacterRepositoryBinding> {
  if (backend === "memory") {
    return {
      backend,
      label: "in-memory repository",
      repository: createInMemoryCharacterRepository()
    };
  }

  try {
    const { createPrismaCharacterRepository } = await import(
      "./prisma-character-repository.js"
    );

    return {
      backend,
      label: "Prisma + SQLite repository",
      repository: createPrismaCharacterRepository()
    };
  } catch (error) {
    console.warn("Falling back to in-memory character repository:", error);

    return {
      backend: "memory",
      label: "in-memory repository (Prisma unavailable)",
      repository: createInMemoryCharacterRepository()
    };
  }
}