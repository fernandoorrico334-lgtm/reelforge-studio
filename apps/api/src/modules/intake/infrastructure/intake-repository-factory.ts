import type { DataBackend } from "../../../config/env.js";
import type { IntakeRepository } from "../application/intake-repository.js";
import { createInMemoryIntakeRepository } from "./in-memory-intake-repository.js";

export interface IntakeRepositoryBinding {
  backend: DataBackend;
  label: string;
  repository: IntakeRepository;
}

export async function resolveIntakeRepository(
  backend: DataBackend
): Promise<IntakeRepositoryBinding> {
  if (backend === "memory") {
    return {
      backend,
      label: "in-memory repository",
      repository: createInMemoryIntakeRepository()
    };
  }

  try {
    const { createPrismaIntakeRepository } = await import(
      "./prisma-intake-repository.js"
    );

    return {
      backend,
      label: "Prisma + SQLite repository",
      repository: createPrismaIntakeRepository()
    };
  } catch (error) {
    console.warn("Falling back to in-memory intake repository:", error);

    return {
      backend: "memory",
      label: "in-memory repository (Prisma unavailable)",
      repository: createInMemoryIntakeRepository()
    };
  }
}