-- CreateTable
CREATE TABLE "MediaCollection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "channelId" TEXT,
    "projectId" TEXT,
    "provider" TEXT NOT NULL,
    "query" TEXT,
    "sourcePath" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "targetCount" INTEGER,
    "importedCount" INTEGER NOT NULL DEFAULT 0,
    "rejectedCount" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MediaCollection_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "MediaCollection_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "VideoProject" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MediaCandidate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "collectionId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "originalPath" TEXT,
    "title" TEXT NOT NULL,
    "previewUrl" TEXT,
    "downloadUrl" TEXT,
    "sourceUrl" TEXT,
    "sourceAuthor" TEXT,
    "sourceLicense" TEXT,
    "sourceLicenseUrl" TEXT,
    "mediaType" TEXT NOT NULL,
    "detectedType" TEXT,
    "suggestedCategory" TEXT,
    "suggestedTags" TEXT NOT NULL DEFAULT '[]',
    "suggestedCharacter" TEXT,
    "suggestedProject" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "duration" REAL,
    "fileSize" INTEGER,
    "extension" TEXT,
    "mimeType" TEXT,
    "category" TEXT,
    "franchise" TEXT,
    "character" TEXT,
    "emotion" TEXT,
    "tags" TEXT NOT NULL DEFAULT '[]',
    "copyrightRisk" TEXT,
    "recommendedUse" TEXT,
    "usageNotes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "assetId" TEXT,
    "errorMessage" TEXT,
    "contentHash" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MediaCandidate_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "MediaCandidate_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "MediaCollection" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Asset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "filename" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'REFERENCE',
    "franchise" TEXT,
    "character" TEXT,
    "emotion" TEXT,
    "tags" TEXT NOT NULL DEFAULT '[]',
    "licenseType" TEXT NOT NULL DEFAULT 'UNSPECIFIED',
    "copyrightRisk" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "recommendedUse" TEXT,
    "duration" REAL,
    "width" INTEGER,
    "height" INTEGER,
    "mimeType" TEXT,
    "extension" TEXT,
    "fileSize" INTEGER,
    "sourceProvider" TEXT,
    "sourceUrl" TEXT,
    "sourceAuthor" TEXT,
    "sourceLicense" TEXT,
    "sourceLicenseUrl" TEXT,
    "downloadedAt" DATETIME,
    "collectionId" TEXT,
    "usageNotes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Asset_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "MediaCollection" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Asset" ("category", "character", "copyrightRisk", "createdAt", "duration", "emotion", "extension", "fileSize", "filename", "franchise", "height", "id", "licenseType", "mimeType", "originalName", "path", "recommendedUse", "tags", "type", "updatedAt", "width") SELECT "category", "character", "copyrightRisk", "createdAt", "duration", "emotion", "extension", "fileSize", "filename", "franchise", "height", "id", "licenseType", "mimeType", "originalName", "path", "recommendedUse", "tags", "type", "updatedAt", "width" FROM "Asset";
DROP TABLE "Asset";
ALTER TABLE "new_Asset" RENAME TO "Asset";
CREATE UNIQUE INDEX "Asset_path_key" ON "Asset"("path");
CREATE INDEX "Asset_type_category_idx" ON "Asset"("type", "category");
CREATE INDEX "Asset_franchise_character_idx" ON "Asset"("franchise", "character");
CREATE INDEX "Asset_collectionId_createdAt_idx" ON "Asset"("collectionId", "createdAt");
CREATE INDEX "Asset_sourceProvider_idx" ON "Asset"("sourceProvider");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "MediaCollection_provider_status_idx" ON "MediaCollection"("provider", "status");

-- CreateIndex
CREATE INDEX "MediaCollection_projectId_status_idx" ON "MediaCollection"("projectId", "status");

-- CreateIndex
CREATE INDEX "MediaCollection_channelId_status_idx" ON "MediaCollection"("channelId", "status");

-- CreateIndex
CREATE INDEX "MediaCandidate_collectionId_status_idx" ON "MediaCandidate"("collectionId", "status");

-- CreateIndex
CREATE INDEX "MediaCandidate_provider_mediaType_status_idx" ON "MediaCandidate"("provider", "mediaType", "status");

-- CreateIndex
CREATE INDEX "MediaCandidate_provider_originalPath_idx" ON "MediaCandidate"("provider", "originalPath");

-- CreateIndex
CREATE INDEX "MediaCandidate_suggestedProject_suggestedCharacter_idx" ON "MediaCandidate"("suggestedProject", "suggestedCharacter");

-- CreateIndex
CREATE INDEX "MediaCandidate_fileSize_title_idx" ON "MediaCandidate"("fileSize", "title");

-- CreateIndex
CREATE INDEX "MediaCandidate_contentHash_idx" ON "MediaCandidate"("contentHash");

