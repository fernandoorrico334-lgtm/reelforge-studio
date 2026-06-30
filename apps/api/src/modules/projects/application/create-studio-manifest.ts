import { projectStatuses } from "../domain/project.js";
import type { ProjectRepository } from "./project-repository.js";

export interface StudioManifest {
  name: string;
  currentPhase: string;
  constraints: string[];
  plannedIntegrations: string[];
  projectCount: number;
  stageModel: string[];
}

export async function createStudioManifest(
  repository: ProjectRepository
): Promise<StudioManifest> {
  return {
    name: "ReelForge Studio",
    currentPhase: "Foundation architecture",
    constraints: [
      "No AI generation or inference in this phase",
      "No render execution in this phase",
      "No external APIs or internet downloads in this phase",
      "No auth, scraping or background infrastructure yet"
    ],
    plannedIntegrations: [
      "SQLite + Prisma for persistence",
      "FFmpeg for local render orchestration",
      "Worker queue for deterministic video pipelines"
    ],
    projectCount: await repository.count(),
    stageModel: [...projectStatuses]
  };
}

