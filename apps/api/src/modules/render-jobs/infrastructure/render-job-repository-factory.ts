import type { DataBackend } from "../../../config/env.js";
import type { RenderJobRepository } from "../application/render-job-repository.js";
import { createRenderJobRepository as createInMemoryRenderJobRepository } from "./in-memory-render-job-repository.js";

export interface RenderJobRepositoryBinding {
  backend: DataBackend;
  label: string;
  repository: RenderJobRepository;
}

export async function resolveRenderJobRepository(
  backend: DataBackend
): Promise<RenderJobRepositoryBinding> {
  if (backend === "memory") {
    return {
      backend,
      label: "in-memory repository",
      repository: createInMemoryRenderJobRepository()
    };
  }

  try {
    const { createPrismaRenderJobRepository } = await import(
      "./prisma-render-job-repository.js"
    );

    return {
      backend,
      label: "Prisma + SQLite repository",
      repository: createPrismaRenderJobRepository()
    };
  } catch (error) {
    console.warn("Falling back to in-memory render job repository:", error);

    return {
      backend: "memory",
      label: "in-memory repository (Prisma unavailable)",
      repository: createInMemoryRenderJobRepository()
    };
  }
}