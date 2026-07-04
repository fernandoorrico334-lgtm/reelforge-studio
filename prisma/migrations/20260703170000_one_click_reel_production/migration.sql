-- CreateEnum
CREATE TABLE "new_ReelProductionRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "videoProjectId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "mode" TEXT NOT NULL,
    "steps" TEXT NOT NULL DEFAULT '[]',
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "errorMessage" TEXT,
    "renderJobId" TEXT,
    "outputPath" TEXT,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ReelProductionRun_videoProjectId_fkey" FOREIGN KEY ("videoProjectId") REFERENCES "VideoProject" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ReelProductionRun_videoProjectId_createdAt_idx" ON "new_ReelProductionRun"("videoProjectId", "createdAt");

-- CreateIndex
CREATE INDEX "ReelProductionRun_status_createdAt_idx" ON "new_ReelProductionRun"("status", "createdAt");

ALTER TABLE "new_ReelProductionRun" RENAME TO "ReelProductionRun";
