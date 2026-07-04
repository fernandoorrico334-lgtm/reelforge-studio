import {
  createMemoryId,
  createTimestamp
} from "../../../infrastructure/memory/studio-memory-store.js";
import type { ReelProductionRunRepository } from "../application/reel-production-run-repository.js";
import type {
  CreateReelProductionRunInput,
  ReelProductionRun
} from "../domain/reel-production.js";

const runs: ReelProductionRun[] = [];

function sortRuns(items: ReelProductionRun[]) {
  return [...items].sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt)
  );
}

export function createInMemoryReelProductionRunRepository(): ReelProductionRunRepository {
  return {
    async listByProjectId(videoProjectId) {
      return sortRuns(runs.filter((run) => run.videoProjectId === videoProjectId));
    },

    async getById(id) {
      return runs.find((run) => run.id === id) ?? null;
    },

    async create(input: CreateReelProductionRunInput) {
      const timestamp = createTimestamp();
      const run: ReelProductionRun = {
        id: createMemoryId("production-run"),
        ...input,
        createdAt: timestamp,
        updatedAt: timestamp
      };

      runs.push(run);
      return run;
    },

    async update(id, input) {
      const index = runs.findIndex((run) => run.id === id);

      if (index === -1) {
        return null;
      }

      const current = runs[index]!;
      const next = {
        ...current,
        ...input,
        updatedAt: createTimestamp()
      };

      runs[index] = next;
      return next;
    }
  };
}
