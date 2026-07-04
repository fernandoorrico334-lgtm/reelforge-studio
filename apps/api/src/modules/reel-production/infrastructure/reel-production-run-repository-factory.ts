import type { DataBackend } from "../../../config/env.js";
import type { ReelProductionRunRepository } from "../application/reel-production-run-repository.js";
import { createInMemoryReelProductionRunRepository } from "./in-memory-reel-production-run-repository.js";

export interface ReelProductionRunRepositoryBinding {
  backend: DataBackend;
  label: string;
  repository: ReelProductionRunRepository;
}

export async function resolveReelProductionRunRepository(
  backend: DataBackend
): Promise<ReelProductionRunRepositoryBinding> {
  if (backend === "memory") {
    return {
      backend,
      label: "in-memory repository",
      repository: createInMemoryReelProductionRunRepository()
    };
  }

  try {
    const { createPrismaReelProductionRunRepository } = await import(
      "./prisma-reel-production-run-repository.js"
    );

    return {
      backend,
      label: "Prisma + SQLite repository",
      repository: createPrismaReelProductionRunRepository()
    };
  } catch (error) {
    console.warn(
      "Falling back to in-memory reel production run repository:",
      error
    );

    return {
      backend: "memory",
      label: "in-memory repository (Prisma unavailable)",
      repository: createInMemoryReelProductionRunRepository()
    };
  }
}
