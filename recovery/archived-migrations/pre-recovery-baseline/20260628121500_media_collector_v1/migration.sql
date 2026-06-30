-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_MediaCollection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "channelId" TEXT,
    "projectId" TEXT,
    "dossierId" TEXT,
    "assetRequirementId" TEXT,
    "provider" TEXT NOT NULL,
    "query" TEXT,
    "sourcePath" TEXT,
    "mediaType" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "targetCount" INTEGER,
    "importedCount" INTEGER NOT NULL DEFAULT 0,
    "rejectedCount" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MediaCollection_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "MediaCollection_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "VideoProject" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "MediaCollection_dossierId_fkey" FOREIGN KEY ("dossierId") REFERENCES "ResearchDossier" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "MediaCollection_assetRequirementId_fkey" FOREIGN KEY ("assetRequirementId") REFERENCES "ResearchAssetRequirement" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_MediaCollection" (
    "id",
    "name",
    "channelId",
    "projectId",
    "provider",
    "query",
    "sourcePath",
    "status",
    "targetCount",
    "importedCount",
    "rejectedCount",
    "notes",
    "createdAt",
    "updatedAt"
)
SELECT
    "id",
    "name",
    "channelId",
    "projectId",
    "provider",
    "query",
    "sourcePath",
    "status",
    "targetCount",
    "importedCount",
    "rejectedCount",
    "notes",
    "createdAt",
    "updatedAt"
FROM "MediaCollection";
DROP TABLE "MediaCollection";
ALTER TABLE "new_MediaCollection" RENAME TO "MediaCollection";
CREATE INDEX "MediaCollection_provider_status_idx" ON "MediaCollection"("provider", "status");
CREATE INDEX "MediaCollection_projectId_status_idx" ON "MediaCollection"("projectId", "status");
CREATE INDEX "MediaCollection_channelId_status_idx" ON "MediaCollection"("channelId", "status");
CREATE INDEX "MediaCollection_dossierId_status_idx" ON "MediaCollection"("dossierId", "status");
CREATE INDEX "MediaCollection_assetRequirementId_status_idx" ON "MediaCollection"("assetRequirementId", "status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

