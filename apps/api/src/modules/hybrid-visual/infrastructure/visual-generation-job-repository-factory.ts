import type { DataBackend } from "../../../config/env.js";
import type { VisualGenerationJobRepository } from "../application/visual-generation-job-repository.js";
import { createInMemoryVisualGenerationJobRepository } from "./in-memory-visual-generation-job-repository.js";

export interface VisualGenerationJobRepositoryBinding {
  backend: DataBackend;
  label: string;
  repository: VisualGenerationJobRepository;
}

export async function resolveVisualGenerationJobRepository(
  backend: DataBackend
): Promise<VisualGenerationJobRepositoryBinding> {
  if (backend === "memory") {
    return {
      backend,
      label: "in-memory repository",
      repository: createInMemoryVisualGenerationJobRepository()
    };
  }

  try {
    const { createPrismaVisualGenerationJobRepository } = await import(
      "./prisma-visual-generation-job-repository.js"
    );

    return {
      backend,
      label: "Prisma + SQLite repository",
      repository: createPrismaVisualGenerationJobRepository()
    };
  } catch (error) {
    console.warn("Falling back to in-memory visual generation job repository:", error);

    return {
      backend: "memory",
      label: "in-memory repository (Prisma unavailable)",
      repository: createInMemoryVisualGenerationJobRepository()
    };
  }
}

