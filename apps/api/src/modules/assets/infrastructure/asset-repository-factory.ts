import type { DataBackend } from "../../../config/env.js";
import type { AssetRepository } from "../application/asset-repository.js";
import { createInMemoryAssetRepository } from "./in-memory-asset-repository.js";

export interface AssetRepositoryBinding {
  backend: DataBackend;
  label: string;
  repository: AssetRepository;
}

export async function resolveAssetRepository(
  backend: DataBackend
): Promise<AssetRepositoryBinding> {
  if (backend === "memory") {
    return {
      backend,
      label: "in-memory repository",
      repository: createInMemoryAssetRepository()
    };
  }

  try {
    const { createPrismaAssetRepository } = await import(
      "./prisma-asset-repository.js"
    );

    return {
      backend,
      label: "Prisma + SQLite repository",
      repository: createPrismaAssetRepository()
    };
  } catch (error) {
    console.warn("Falling back to in-memory asset repository:", error);

    return {
      backend: "memory",
      label: "in-memory repository (Prisma unavailable)",
      repository: createInMemoryAssetRepository()
    };
  }
}