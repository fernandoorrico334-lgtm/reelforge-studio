-- AlterTable
ALTER TABLE "VideoProject" ADD COLUMN "musicPresetId" TEXT;

-- CreateTable
CREATE TABLE "MusicAssetProfile" (
    "assetId" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "artist" TEXT,
    "sourceType" TEXT NOT NULL DEFAULT 'unknown',
    "licenseStatus" TEXT NOT NULL DEFAULT 'unknown',
    "mood" TEXT NOT NULL DEFAULT 'cinematic',
    "genre" TEXT NOT NULL DEFAULT 'generic',
    "bpm" REAL,
    "bpmConfidence" REAL NOT NULL DEFAULT 0,
    "energy" TEXT NOT NULL DEFAULT 'medium',
    "useCase" TEXT NOT NULL DEFAULT 'generic',
    "durationSeconds" REAL,
    "loudness" REAL,
    "beatMarkers" TEXT NOT NULL DEFAULT '[]',
    "energyTimeline" TEXT NOT NULL DEFAULT '[]',
    "notes" TEXT,
    "safetyWarning" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MusicAssetProfile_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SfxAssetProfile" (
    "assetId" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "intensity" TEXT NOT NULL DEFAULT 'medium',
    "durationSeconds" REAL,
    "useCase" TEXT NOT NULL DEFAULT 'generic',
    "licenseStatus" TEXT NOT NULL DEFAULT 'unknown',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SfxAssetProfile_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "MusicAssetProfile_licenseStatus_useCase_energy_idx" ON "MusicAssetProfile"("licenseStatus", "useCase", "energy");

-- CreateIndex
CREATE INDEX "MusicAssetProfile_mood_genre_bpm_idx" ON "MusicAssetProfile"("mood", "genre", "bpm");

-- CreateIndex
CREATE INDEX "SfxAssetProfile_category_intensity_idx" ON "SfxAssetProfile"("category", "intensity");

-- CreateIndex
CREATE INDEX "SfxAssetProfile_licenseStatus_useCase_idx" ON "SfxAssetProfile"("licenseStatus", "useCase");
