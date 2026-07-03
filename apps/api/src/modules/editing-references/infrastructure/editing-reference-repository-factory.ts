import type { DataBackend } from "../../../config/env.js";
import type { EditingReferenceRepository } from "../application/editing-reference-repository.js";
import { createInMemoryEditingReferenceRepository } from "./in-memory-editing-reference-repository.js";

export interface EditingReferenceRepositoryBinding {
  backend: DataBackend;
  label: string;
  repository: EditingReferenceRepository;
}

export async function resolveEditingReferenceRepository(
  backend: DataBackend
): Promise<EditingReferenceRepositoryBinding> {
  if (backend === "memory") {
    return {
      backend,
      label: "in-memory editing reference repository",
      repository: createInMemoryEditingReferenceRepository()
    };
  }

  try {
    const { createPrismaEditingReferenceRepository } = await import(
      "./prisma-editing-reference-repository.js"
    );

    return {
      backend,
      label: "Prisma + SQLite editing reference repository",
      repository: createPrismaEditingReferenceRepository()
    };
  } catch (error) {
    console.warn("Falling back to in-memory editing reference repository:", error);

    return {
      backend: "memory",
      label: "in-memory editing reference repository (Prisma unavailable)",
      repository: createInMemoryEditingReferenceRepository()
    };
  }
}
