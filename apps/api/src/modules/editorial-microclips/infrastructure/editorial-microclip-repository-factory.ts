import type { DataBackend } from "../../../config/env.js";
import type { EditorialMicroclipRepository } from "../application/editorial-microclip-repository.js";
import { createEditorialMicroclipRepository as createInMemoryEditorialMicroclipRepository } from "./in-memory-editorial-microclip-repository.js";

export interface EditorialMicroclipRepositoryBinding {
  backend: DataBackend;
  label: string;
  repository: EditorialMicroclipRepository;
}

export async function resolveEditorialMicroclipRepository(
  backend: DataBackend
): Promise<EditorialMicroclipRepositoryBinding> {
  if (backend === "memory") {
    return {
      backend,
      label: "in-memory editorial microclip repository",
      repository: createInMemoryEditorialMicroclipRepository()
    };
  }

  const { createPrismaEditorialMicroclipRepository } = await import(
    "./prisma-editorial-microclip-repository.js"
  );

  return {
    backend,
    label: "Prisma + SQLite editorial microclip repository",
    repository: createPrismaEditorialMicroclipRepository()
  };
}
