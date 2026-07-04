import type { Prisma } from "@prisma/client";
import { prisma } from "../../../infrastructure/database/prisma-client.js";
import type { ReelProductionRunRepository } from "../application/reel-production-run-repository.js";
import type {
  CreateReelProductionRunInput,
  ReelProductionRun,
  ReelProductionRunMode,
  ReelProductionRunStatus,
  ReelProductionStep,
  UpdateReelProductionRunInput
} from "../domain/reel-production.js";

type ReelProductionRunRecord = Prisma.ReelProductionRunGetPayload<object>;

function parseJson<T>(value: string | null, fallback: T): T {
  if (!value) {
    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function mapRun(record: ReelProductionRunRecord): ReelProductionRun {
  return {
    id: record.id,
    videoProjectId: record.videoProjectId,
    status: record.status as ReelProductionRunStatus,
    mode: record.mode as ReelProductionRunMode,
    steps: parseJson<ReelProductionStep[]>(record.steps, []),
    startedAt: record.startedAt?.toISOString() ?? null,
    completedAt: record.completedAt?.toISOString() ?? null,
    errorMessage: record.errorMessage,
    renderJobId: record.renderJobId,
    outputPath: record.outputPath,
    metadata: parseJson<Record<string, unknown> | null>(record.metadata, null),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString()
  };
}

function serializeCreateInput(
  input: CreateReelProductionRunInput
): Prisma.ReelProductionRunUncheckedCreateInput {
  return {
    videoProjectId: input.videoProjectId,
    status: input.status,
    mode: input.mode,
    steps: JSON.stringify(input.steps),
    startedAt: input.startedAt ? new Date(input.startedAt) : null,
    completedAt: input.completedAt ? new Date(input.completedAt) : null,
    errorMessage: input.errorMessage,
    renderJobId: input.renderJobId,
    outputPath: input.outputPath,
    metadata: input.metadata ? JSON.stringify(input.metadata) : null
  };
}

function serializeUpdateInput(
  input: UpdateReelProductionRunInput
): Prisma.ReelProductionRunUncheckedUpdateInput {
  const data: Prisma.ReelProductionRunUncheckedUpdateInput = {};

  if ("status" in input) data.status = input.status;
  if ("steps" in input) data.steps = JSON.stringify(input.steps ?? []);
  if ("startedAt" in input) {
    data.startedAt = input.startedAt ? new Date(input.startedAt) : null;
  }
  if ("completedAt" in input) {
    data.completedAt = input.completedAt ? new Date(input.completedAt) : null;
  }
  if ("errorMessage" in input) data.errorMessage = input.errorMessage;
  if ("renderJobId" in input) data.renderJobId = input.renderJobId;
  if ("outputPath" in input) data.outputPath = input.outputPath;
  if ("metadata" in input) {
    data.metadata = input.metadata ? JSON.stringify(input.metadata) : null;
  }

  return data;
}

export function createPrismaReelProductionRunRepository(): ReelProductionRunRepository {
  return {
    async listByProjectId(videoProjectId) {
      const runs = await prisma.reelProductionRun.findMany({
        where: { videoProjectId },
        orderBy: { createdAt: "desc" }
      });

      return runs.map(mapRun);
    },

    async getById(id) {
      const run = await prisma.reelProductionRun.findUnique({ where: { id } });
      return run ? mapRun(run) : null;
    },

    async create(input) {
      const run = await prisma.reelProductionRun.create({
        data: serializeCreateInput(input)
      });

      return mapRun(run);
    },

    async update(id, input) {
      try {
        const run = await prisma.reelProductionRun.update({
          where: { id },
          data: serializeUpdateInput(input)
        });

        return mapRun(run);
      } catch (error) {
        if (
          typeof error === "object" &&
          error !== null &&
          "code" in error &&
          error.code === "P2025"
        ) {
          return null;
        }

        throw error;
      }
    }
  };
}
