import type { DataBackend } from "../../../config/env.js";
import type { ProductionDiscoveryRepository } from "../application/production-discovery-repository.js";
import { createInMemoryProductionDiscoveryRepository } from "./in-memory-production-discovery-repository.js";

export interface ProductionDiscoveryRepositoryBinding {
  backend: DataBackend;
  label: string;
  repository: ProductionDiscoveryRepository;
}

export async function resolveProductionDiscoveryRepository(
  backend: DataBackend
): Promise<ProductionDiscoveryRepositoryBinding> {
  if (backend === "memory") {
    return {
      backend,
      label: "in-memory repository",
      repository: createInMemoryProductionDiscoveryRepository()
    };
  }

  try {
    const { createPrismaProductionDiscoveryRepository } = await import(
      "./prisma-production-discovery-repository.js"
    );

    return {
      backend,
      label: "Prisma + SQLite repository",
      repository: createPrismaProductionDiscoveryRepository()
    };
  } catch (error) {
    console.warn("Falling back to in-memory production discovery repository:", error);

    return {
      backend: "memory",
      label: "in-memory repository (Prisma unavailable)",
      repository: createInMemoryProductionDiscoveryRepository()
    };
  }
}
