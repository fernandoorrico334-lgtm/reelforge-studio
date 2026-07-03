-- CreateTable
CREATE TABLE "EditingReference" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "assetId" TEXT,
    "localPath" TEXT,
    "sourceType" TEXT NOT NULL DEFAULT 'local_file',
    "category" TEXT NOT NULL DEFAULT 'generic',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "durationSeconds" REAL,
    "averageCutPaceSeconds" REAL,
    "beatIntensity" TEXT NOT NULL DEFAULT 'medium',
    "pacing" TEXT NOT NULL DEFAULT 'medium',
    "zoomStyle" TEXT NOT NULL DEFAULT 'subtle',
    "flashStyle" TEXT NOT NULL DEFAULT 'none',
    "transitionStyle" TEXT NOT NULL DEFAULT 'cut',
    "captionStyle" TEXT NOT NULL DEFAULT 'lower_clean',
    "narrationStyle" TEXT NOT NULL DEFAULT 'calm',
    "musicStyle" TEXT NOT NULL DEFAULT 'none',
    "sfxStyle" TEXT NOT NULL DEFAULT 'none',
    "hookStyle" TEXT NOT NULL DEFAULT 'curiosity',
    "ctaStyle" TEXT NOT NULL DEFAULT 'short',
    "microclipPlacement" TEXT NOT NULL DEFAULT 'none',
    "visualStyleNotes" TEXT,
    "audioStyleNotes" TEXT,
    "editingStyleNotes" TEXT,
    "analysisWarnings" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "EditingReference_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EditingReferencePreset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "referenceId" TEXT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "useCase" TEXT NOT NULL DEFAULT 'generic',
    "cutPace" REAL,
    "pacing" TEXT NOT NULL DEFAULT 'medium',
    "zoomStyle" TEXT NOT NULL DEFAULT 'subtle',
    "flashStyle" TEXT NOT NULL DEFAULT 'none',
    "transitionStyle" TEXT NOT NULL DEFAULT 'cut',
    "captionStyle" TEXT NOT NULL DEFAULT 'lower_clean',
    "narrationStyle" TEXT NOT NULL DEFAULT 'calm',
    "musicStyle" TEXT NOT NULL DEFAULT 'none',
    "sfxStyle" TEXT NOT NULL DEFAULT 'none',
    "hookStyle" TEXT NOT NULL DEFAULT 'curiosity',
    "ctaStyle" TEXT NOT NULL DEFAULT 'short',
    "microclipPlacement" TEXT NOT NULL DEFAULT 'none',
    "recommendedTemplates" TEXT NOT NULL DEFAULT '[]',
    "recommendedMusicPresetId" TEXT,
    "recommendedAudioMasteringPresetId" TEXT,
    "recommendedNarrationVoicePackId" TEXT,
    "defaultShotDurationSeconds" REAL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "EditingReferencePreset_referenceId_fkey" FOREIGN KEY ("referenceId") REFERENCES "EditingReference" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "EditingReference_category_status_idx" ON "EditingReference"("category", "status");

-- CreateIndex
CREATE INDEX "EditingReference_assetId_idx" ON "EditingReference"("assetId");

-- CreateIndex
CREATE UNIQUE INDEX "EditingReferencePreset_slug_key" ON "EditingReferencePreset"("slug");

-- CreateIndex
CREATE INDEX "EditingReferencePreset_referenceId_idx" ON "EditingReferencePreset"("referenceId");

-- CreateIndex
CREATE INDEX "EditingReferencePreset_useCase_slug_idx" ON "EditingReferencePreset"("useCase", "slug");
