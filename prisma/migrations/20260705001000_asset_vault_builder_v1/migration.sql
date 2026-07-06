-- CreateTable
CREATE TABLE "AssetVault" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "niche" TEXT NOT NULL,
    "description" TEXT,
    "sourcePackId" TEXT,
    "targetAssetTypes" TEXT NOT NULL DEFAULT '[]',
    "tags" TEXT NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "candidateCount" INTEGER NOT NULL DEFAULT 0,
    "approvedCount" INTEGER NOT NULL DEFAULT 0,
    "importedCount" INTEGER NOT NULL DEFAULT 0,
    "rejectedCount" INTEGER NOT NULL DEFAULT 0,
    "missingCount" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SearchMission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "vaultId" TEXT,
    "projectId" TEXT,
    "packageId" TEXT,
    "topic" TEXT NOT NULL,
    "niche" TEXT NOT NULL,
    "sourcePackId" TEXT,
    "providers" TEXT NOT NULL DEFAULT '[]',
    "querySet" TEXT NOT NULL DEFAULT '[]',
    "targetCount" INTEGER NOT NULL DEFAULT 10,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "candidateCount" INTEGER NOT NULL DEFAULT 0,
    "reviewRequiredCount" INTEGER NOT NULL DEFAULT 0,
    "approvedCount" INTEGER NOT NULL DEFAULT 0,
    "importedCount" INTEGER NOT NULL DEFAULT 0,
    "rejectedCount" INTEGER NOT NULL DEFAULT 0,
    "missingCount" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SearchMission_vaultId_fkey" FOREIGN KEY ("vaultId") REFERENCES "AssetVault" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SearchMission_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "VideoProject" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "AssetVault_niche_status_idx" ON "AssetVault"("niche", "status");

-- CreateIndex
CREATE INDEX "AssetVault_sourcePackId_idx" ON "AssetVault"("sourcePackId");

-- CreateIndex
CREATE INDEX "SearchMission_vaultId_status_idx" ON "SearchMission"("vaultId", "status");

-- CreateIndex
CREATE INDEX "SearchMission_projectId_status_idx" ON "SearchMission"("projectId", "status");

-- CreateIndex
CREATE INDEX "SearchMission_packageId_status_idx" ON "SearchMission"("packageId", "status");

-- CreateIndex
CREATE INDEX "SearchMission_niche_status_idx" ON "SearchMission"("niche", "status");
