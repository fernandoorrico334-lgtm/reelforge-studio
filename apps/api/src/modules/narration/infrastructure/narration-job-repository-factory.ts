import type { DataBackend } from "../../../config/env.js";
import type { NarrationJobRepository } from "../application/narration-job-repository.js";
import { createInMemoryNarrationJobRepository } from "./in-memory-narration-job-repository.js";

export interface NarrationJobRepositoryBinding {
  backend: DataBackend;
  label: string;
  repository: NarrationJobRepository;
}

export async function resolveNarrationJobRepository(
  backend: DataBackend
): Promise<NarrationJobRepositoryBinding> {
  if (backend === "memory") {
    return {
      backend,
      label: "in-memory repository",
      repository: createInMemoryNarrationJobRepository()
    };
  }

  try {
    const { createPrismaNarrationJobRepository } = await import(
      "./prisma-narration-job-repository.js"
    );

    return {
      backend,
      label: "Prisma + SQLite repository",
      repository: createPrismaNarrationJobRepository()
    };
  } catch (error) {
    console.warn("Falling back to in-memory narration job repository:", error);

    return {
      backend: "memory",
      label: "in-memory repository (Prisma unavailable)",
      repository: createInMemoryNarrationJobRepository()
    };
  }
}
