import type { DataBackend } from "../../../config/env.js";
import type { ProjectRepository } from "../application/project-repository.js";
import { createProjectRepository as createInMemoryProjectRepository } from "./in-memory-project-repository.js";

export interface ProjectRepositoryBinding {
  backend: DataBackend;
  label: string;
  repository: ProjectRepository;
}

export async function resolveProjectRepository(
  backend: DataBackend
): Promise<ProjectRepositoryBinding> {
  if (backend === "memory") {
    return {
      backend,
      label: "in-memory repository",
      repository: createInMemoryProjectRepository()
    };
  }

  const { createPrismaProjectRepository } = await import(
    "./prisma-project-repository.js"
  );

  return {
    backend,
    label: "Prisma + SQLite repository",
    repository: createPrismaProjectRepository()
  };
}

