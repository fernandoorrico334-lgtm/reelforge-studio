-- CreateTable
CREATE TABLE "ProductionDiscoveryPackage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "topic" TEXT NOT NULL,
    "niche" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "angle" TEXT,
    "language" TEXT NOT NULL DEFAULT 'pt-BR',
    "tone" TEXT,
    "targetDurationSeconds" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "researchDossierId" TEXT,
    "mediaCollectionIds" TEXT NOT NULL DEFAULT '[]',
    "suggestedTemplateId" TEXT,
    "suggestedEditingReferencePresetId" TEXT,
    "suggestedMusicPresetId" TEXT,
    "suggestedAudioMasteringPresetId" TEXT,
    "suggestedWorkflowPackId" TEXT,
    "summary" TEXT,
    "outline" TEXT NOT NULL DEFAULT '[]',
    "assetRequirements" TEXT NOT NULL DEFAULT '[]',
    "mediaCandidatesSummary" TEXT NOT NULL DEFAULT '[]',
    "warnings" TEXT NOT NULL DEFAULT '[]',
    "createdProjectId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "ProductionDiscoveryPackage_niche_status_idx" ON "ProductionDiscoveryPackage"("niche", "status");

-- CreateIndex
CREATE INDEX "ProductionDiscoveryPackage_createdProjectId_idx" ON "ProductionDiscoveryPackage"("createdProjectId");

-- CreateIndex
CREATE INDEX "ProductionDiscoveryPackage_researchDossierId_idx" ON "ProductionDiscoveryPackage"("researchDossierId");
