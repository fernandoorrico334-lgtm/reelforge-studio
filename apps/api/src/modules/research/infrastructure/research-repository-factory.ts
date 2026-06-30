import type { DataBackend } from "../../../config/env.js";
import type { ResearchRepository } from "../application/research-repository.js";
import { createInMemoryResearchRepository } from "./in-memory-research-repository.js";

export interface ResearchRepositoryBinding {
  backend: DataBackend;
  label: string;
  repository: ResearchRepository;
}

export async function resolveResearchRepository(
  backend: DataBackend
): Promise<ResearchRepositoryBinding> {
  if (backend === "memory") {
    return {
      backend,
      label: "in-memory repository",
      repository: createInMemoryResearchRepository()
    };
  }

  try {
    const { createPrismaResearchRepository } = await import(
      "./prisma-research-repository.js"
    );

    return {
      backend,
      label: "Prisma + SQLite repository",
      repository: createPrismaResearchRepository()
    };
  } catch (error) {
    console.warn("Falling back to in-memory research repository:", error);

    return {
      backend: "memory",
      label: "in-memory repository (Prisma unavailable)",
      repository: createInMemoryResearchRepository()
    };
  }
}

