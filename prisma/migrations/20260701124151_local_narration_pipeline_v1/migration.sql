-- CreateTable
CREATE TABLE "NarrationJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "videoProjectId" TEXT,
    "sceneId" TEXT,
    "provider" TEXT NOT NULL,
    "voicePackId" TEXT,
    "language" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "text" TEXT NOT NULL,
    "outputPath" TEXT,
    "generatedAssetId" TEXT,
    "durationSeconds" REAL,
    "sampleRate" INTEGER,
    "errorMessage" TEXT,
    "metadata" TEXT,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "NarrationJob_videoProjectId_fkey" FOREIGN KEY ("videoProjectId") REFERENCES "VideoProject" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "NarrationJob_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "Scene" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "NarrationJob_generatedAssetId_fkey" FOREIGN KEY ("generatedAssetId") REFERENCES "Asset" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Scene" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "videoProjectId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "narrationText" TEXT,
    "captionText" TEXT,
    "duration" REAL,
    "emotion" TEXT,
    "assetId" TEXT,
    "generatedAssetId" TEXT,
    "generatedNarrationAssetId" TEXT,
    "characterProfileId" TEXT,
    "sfxAssetId" TEXT,
    "sfxStartTime" REAL NOT NULL DEFAULT 0,
    "sfxVolume" REAL NOT NULL DEFAULT 0.7,
    "visualPreset" TEXT,
    "visualSourceMode" TEXT,
    "visualPrompt" TEXT,
    "negativePrompt" TEXT,
    "visualRecipe" TEXT,
    "generationStatus" TEXT,
    "generationProvider" TEXT,
    "generationSeed" INTEGER,
    "transition" TEXT,
    "captionStyle" TEXT,
    "captionPosition" TEXT,
    "captionEmphasisWords" TEXT,
    "energyLevel" INTEGER,
    "narrationStatus" TEXT,
    "narrationProvider" TEXT,
    "narrationVoicePackId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Scene_videoProjectId_fkey" FOREIGN KEY ("videoProjectId") REFERENCES "VideoProject" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Scene_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Scene_generatedAssetId_fkey" FOREIGN KEY ("generatedAssetId") REFERENCES "Asset" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Scene_generatedNarrationAssetId_fkey" FOREIGN KEY ("generatedNarrationAssetId") REFERENCES "Asset" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Scene_characterProfileId_fkey" FOREIGN KEY ("characterProfileId") REFERENCES "CharacterProfile" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Scene_sfxAssetId_fkey" FOREIGN KEY ("sfxAssetId") REFERENCES "Asset" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Scene" ("assetId", "captionEmphasisWords", "captionPosition", "captionStyle", "captionText", "characterProfileId", "createdAt", "duration", "emotion", "energyLevel", "generatedAssetId", "generationProvider", "generationSeed", "generationStatus", "id", "narrationText", "negativePrompt", "order", "sfxAssetId", "sfxStartTime", "sfxVolume", "title", "transition", "updatedAt", "videoProjectId", "visualPreset", "visualPrompt", "visualRecipe", "visualSourceMode") SELECT "assetId", "captionEmphasisWords", "captionPosition", "captionStyle", "captionText", "characterProfileId", "createdAt", "duration", "emotion", "energyLevel", "generatedAssetId", "generationProvider", "generationSeed", "generationStatus", "id", "narrationText", "negativePrompt", "order", "sfxAssetId", "sfxStartTime", "sfxVolume", "title", "transition", "updatedAt", "videoProjectId", "visualPreset", "visualPrompt", "visualRecipe", "visualSourceMode" FROM "Scene";
DROP TABLE "Scene";
ALTER TABLE "new_Scene" RENAME TO "Scene";
CREATE INDEX "Scene_assetId_idx" ON "Scene"("assetId");
CREATE INDEX "Scene_generatedAssetId_idx" ON "Scene"("generatedAssetId");
CREATE INDEX "Scene_generatedNarrationAssetId_idx" ON "Scene"("generatedNarrationAssetId");
CREATE INDEX "Scene_characterProfileId_idx" ON "Scene"("characterProfileId");
CREATE INDEX "Scene_sfxAssetId_idx" ON "Scene"("sfxAssetId");
CREATE UNIQUE INDEX "Scene_videoProjectId_order_key" ON "Scene"("videoProjectId", "order");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "NarrationJob_videoProjectId_status_idx" ON "NarrationJob"("videoProjectId", "status");

-- CreateIndex
CREATE INDEX "NarrationJob_sceneId_status_idx" ON "NarrationJob"("sceneId", "status");

-- CreateIndex
CREATE INDEX "NarrationJob_provider_status_idx" ON "NarrationJob"("provider", "status");

-- CreateIndex
CREATE INDEX "NarrationJob_generatedAssetId_idx" ON "NarrationJob"("generatedAssetId");
