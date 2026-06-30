-- CreateTable
CREATE TABLE "Channel" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "niche" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "visualStyle" TEXT,
    "narrativeTone" TEXT,
    "defaultTemplate" TEXT,
    "defaultRenderMode" TEXT NOT NULL DEFAULT 'cinematic_v2',
    "defaultRenderQuality" TEXT NOT NULL DEFAULT 'standard',
    "defaultAudioMood" TEXT,
    "defaultCaptionStyle" TEXT,
    "defaultVisualPreset" TEXT,
    "defaultMusicAssetId" TEXT,
    "defaultVoiceoverAssetId" TEXT,
    "defaultDurationTarget" INTEGER,
    "defaultSceneDuration" REAL NOT NULL DEFAULT 4,
    "preferredAssetCategories" TEXT NOT NULL DEFAULT '[]',
    "preferredAssetTags" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Asset" (
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

-- CreateTable
CREATE TABLE "MediaCollection" (
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

-- CreateTable
CREATE TABLE "ResearchDossier" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "channelId" TEXT,
    "title" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "niche" TEXT,
    "tone" TEXT,
    "targetDuration" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "summary" TEXT,
    "narrativeAngle" TEXT,
    "editorialNotes" TEXT,
    "safetyNotes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ResearchDossier_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ResearchSource" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dossierId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT,
    "provider" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "author" TEXT,
    "publishedAt" TEXT,
    "accessedAt" TEXT,
    "reliabilityScore" INTEGER,
    "citationText" TEXT,
    "rawTextPath" TEXT,
    "excerpt" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'candidate',
    "errorMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ResearchSource_dossierId_fkey" FOREIGN KEY ("dossierId") REFERENCES "ResearchDossier" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ResearchFact" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dossierId" TEXT NOT NULL,
    "sourceId" TEXT,
    "claim" TEXT NOT NULL,
    "factType" TEXT NOT NULL,
    "confidence" TEXT NOT NULL,
    "dateValue" TEXT,
    "people" TEXT,
    "places" TEXT,
    "tags" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ResearchFact_dossierId_fkey" FOREIGN KEY ("dossierId") REFERENCES "ResearchDossier" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ResearchFact_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "ResearchSource" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ResearchTimelineEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dossierId" TEXT NOT NULL,
    "sourceId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "dateValue" TEXT,
    "order" INTEGER,
    "location" TEXT,
    "people" TEXT,
    "confidence" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ResearchTimelineEvent_dossierId_fkey" FOREIGN KEY ("dossierId") REFERENCES "ResearchDossier" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ResearchTimelineEvent_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "ResearchSource" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ResearchHook" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dossierId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "hookType" TEXT NOT NULL,
    "strengthScore" INTEGER,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ResearchHook_dossierId_fkey" FOREIGN KEY ("dossierId") REFERENCES "ResearchDossier" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ResearchAssetRequirement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dossierId" TEXT NOT NULL,
    "sceneRole" TEXT,
    "description" TEXT NOT NULL,
    "mediaType" TEXT NOT NULL,
    "suggestedTags" TEXT,
    "emotion" TEXT,
    "priority" INTEGER,
    "fulfilledAssetId" TEXT,
    "visualSourceMode" TEXT,
    "characterProfileId" TEXT,
    "generatedAssetId" TEXT,
    "visualPrompt" TEXT,
    "generationStatus" TEXT,
    "generationProvider" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ResearchAssetRequirement_dossierId_fkey" FOREIGN KEY ("dossierId") REFERENCES "ResearchDossier" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ResearchAssetRequirement_fulfilledAssetId_fkey" FOREIGN KEY ("fulfilledAssetId") REFERENCES "Asset" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ResearchAssetRequirement_characterProfileId_fkey" FOREIGN KEY ("characterProfileId") REFERENCES "CharacterProfile" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ResearchAssetRequirement_generatedAssetId_fkey" FOREIGN KEY ("generatedAssetId") REFERENCES "Asset" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ResearchOutlineScene" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dossierId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "role" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "narrationDraft" TEXT NOT NULL,
    "captionDraft" TEXT,
    "emotion" TEXT,
    "visualPreset" TEXT,
    "assetRequirementId" TEXT,
    "estimatedDuration" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ResearchOutlineScene_dossierId_fkey" FOREIGN KEY ("dossierId") REFERENCES "ResearchDossier" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ResearchOutlineScene_assetRequirementId_fkey" FOREIGN KEY ("assetRequirementId") REFERENCES "ResearchAssetRequirement" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VideoProject" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "channelId" TEXT NOT NULL,
    "script" TEXT,
    "durationTarget" INTEGER,
    "format" TEXT NOT NULL DEFAULT '9:16',
    "templateId" TEXT,
    "defaultCaptionStyle" TEXT,
    "backgroundMusicAssetId" TEXT,
    "voiceoverAssetId" TEXT,
    "audioMood" TEXT,
    "musicVolume" REAL NOT NULL DEFAULT 0.18,
    "voiceVolume" REAL NOT NULL DEFAULT 1.0,
    "sfxVolume" REAL NOT NULL DEFAULT 0.7,
    "enableAudioDucking" BOOLEAN NOT NULL DEFAULT false,
    "duckingLevel" REAL NOT NULL DEFAULT 0.35,
    "defaultRenderMode" TEXT NOT NULL DEFAULT 'v1',
    "defaultRenderQuality" TEXT NOT NULL DEFAULT 'standard',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "VideoProject_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Scene" (
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Scene_videoProjectId_fkey" FOREIGN KEY ("videoProjectId") REFERENCES "VideoProject" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Scene_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Scene_generatedAssetId_fkey" FOREIGN KEY ("generatedAssetId") REFERENCES "Asset" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Scene_characterProfileId_fkey" FOREIGN KEY ("characterProfileId") REFERENCES "CharacterProfile" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Scene_sfxAssetId_fkey" FOREIGN KEY ("sfxAssetId") REFERENCES "Asset" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RenderJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "videoProjectId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "renderMode" TEXT NOT NULL DEFAULT 'v1',
    "renderQuality" TEXT NOT NULL DEFAULT 'standard',
    "outputPath" TEXT,
    "blueprintPath" TEXT,
    "srtPath" TEXT,
    "assPath" TEXT,
    "logPath" TEXT,
    "errorMessage" TEXT,
    "progress" INTEGER,
    "currentStep" TEXT,
    "currentSceneIndex" INTEGER,
    "totalScenes" INTEGER,
    "outputWidth" INTEGER,
    "outputHeight" INTEGER,
    "outputDuration" REAL,
    "outputCodec" TEXT,
    "hasAudio" BOOLEAN,
    "audioCodec" TEXT,
    "audioChannels" INTEGER,
    "audioSampleRate" INTEGER,
    "outputFileSize" INTEGER,
    "thumbnailPath" TEXT,
    "cancelledAt" DATETIME,
    "retriedFromJobId" TEXT,
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RenderJob_videoProjectId_fkey" FOREIGN KEY ("videoProjectId") REFERENCES "VideoProject" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CharacterProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "franchise" TEXT,
    "category" TEXT,
    "description" TEXT,
    "basePrompt" TEXT,
    "negativePrompt" TEXT,
    "styleNotes" TEXT,
    "defaultVisualStyle" TEXT,
    "referenceStrength" REAL NOT NULL DEFAULT 0.75,
    "preferredProvider" TEXT NOT NULL DEFAULT 'mock-svg',
    "tags" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CharacterReference" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "characterProfileId" TEXT NOT NULL,
    "assetId" TEXT,
    "sourcePath" TEXT,
    "title" TEXT,
    "notes" TEXT,
    "referenceType" TEXT NOT NULL DEFAULT 'other',
    "strength" REAL NOT NULL DEFAULT 0.75,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CharacterReference_characterProfileId_fkey" FOREIGN KEY ("characterProfileId") REFERENCES "CharacterProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CharacterReference_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VisualGenerationJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "videoProjectId" TEXT,
    "sceneId" TEXT,
    "characterProfileId" TEXT,
    "researchAssetRequirementId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "provider" TEXT NOT NULL,
    "visualSourceMode" TEXT,
    "prompt" TEXT NOT NULL,
    "negativePrompt" TEXT,
    "stylePreset" TEXT,
    "seed" INTEGER,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "outputPath" TEXT,
    "generatedAssetId" TEXT,
    "errorMessage" TEXT,
    "metadata" TEXT,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "VisualGenerationJob_videoProjectId_fkey" FOREIGN KEY ("videoProjectId") REFERENCES "VideoProject" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "VisualGenerationJob_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "Scene" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "VisualGenerationJob_characterProfileId_fkey" FOREIGN KEY ("characterProfileId") REFERENCES "CharacterProfile" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "VisualGenerationJob_researchAssetRequirementId_fkey" FOREIGN KEY ("researchAssetRequirementId") REFERENCES "ResearchAssetRequirement" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "VisualGenerationJob_generatedAssetId_fkey" FOREIGN KEY ("generatedAssetId") REFERENCES "Asset" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Channel_name_key" ON "Channel"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Asset_path_key" ON "Asset"("path");

-- CreateIndex
CREATE INDEX "Asset_type_category_idx" ON "Asset"("type", "category");

-- CreateIndex
CREATE INDEX "Asset_franchise_character_idx" ON "Asset"("franchise", "character");

-- CreateIndex
CREATE INDEX "Asset_collectionId_createdAt_idx" ON "Asset"("collectionId", "createdAt");

-- CreateIndex
CREATE INDEX "Asset_sourceProvider_idx" ON "Asset"("sourceProvider");

-- CreateIndex
CREATE INDEX "MediaCollection_provider_status_idx" ON "MediaCollection"("provider", "status");

-- CreateIndex
CREATE INDEX "MediaCollection_projectId_status_idx" ON "MediaCollection"("projectId", "status");

-- CreateIndex
CREATE INDEX "MediaCollection_channelId_status_idx" ON "MediaCollection"("channelId", "status");

-- CreateIndex
CREATE INDEX "MediaCollection_dossierId_status_idx" ON "MediaCollection"("dossierId", "status");

-- CreateIndex
CREATE INDEX "MediaCollection_assetRequirementId_status_idx" ON "MediaCollection"("assetRequirementId", "status");

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

-- CreateIndex
CREATE INDEX "ResearchDossier_channelId_status_idx" ON "ResearchDossier"("channelId", "status");

-- CreateIndex
CREATE INDEX "ResearchDossier_topic_status_idx" ON "ResearchDossier"("topic", "status");

-- CreateIndex
CREATE INDEX "ResearchSource_dossierId_status_idx" ON "ResearchSource"("dossierId", "status");

-- CreateIndex
CREATE INDEX "ResearchSource_provider_sourceType_status_idx" ON "ResearchSource"("provider", "sourceType", "status");

-- CreateIndex
CREATE INDEX "ResearchFact_dossierId_factType_confidence_idx" ON "ResearchFact"("dossierId", "factType", "confidence");

-- CreateIndex
CREATE INDEX "ResearchFact_sourceId_idx" ON "ResearchFact"("sourceId");

-- CreateIndex
CREATE INDEX "ResearchTimelineEvent_dossierId_order_idx" ON "ResearchTimelineEvent"("dossierId", "order");

-- CreateIndex
CREATE INDEX "ResearchTimelineEvent_sourceId_idx" ON "ResearchTimelineEvent"("sourceId");

-- CreateIndex
CREATE INDEX "ResearchHook_dossierId_hookType_idx" ON "ResearchHook"("dossierId", "hookType");

-- CreateIndex
CREATE INDEX "ResearchAssetRequirement_dossierId_sceneRole_idx" ON "ResearchAssetRequirement"("dossierId", "sceneRole");

-- CreateIndex
CREATE INDEX "ResearchAssetRequirement_fulfilledAssetId_idx" ON "ResearchAssetRequirement"("fulfilledAssetId");

-- CreateIndex
CREATE INDEX "ResearchAssetRequirement_characterProfileId_idx" ON "ResearchAssetRequirement"("characterProfileId");

-- CreateIndex
CREATE INDEX "ResearchAssetRequirement_generatedAssetId_idx" ON "ResearchAssetRequirement"("generatedAssetId");

-- CreateIndex
CREATE INDEX "ResearchOutlineScene_assetRequirementId_idx" ON "ResearchOutlineScene"("assetRequirementId");

-- CreateIndex
CREATE UNIQUE INDEX "ResearchOutlineScene_dossierId_order_key" ON "ResearchOutlineScene"("dossierId", "order");

-- CreateIndex
CREATE INDEX "VideoProject_channelId_status_idx" ON "VideoProject"("channelId", "status");

-- CreateIndex
CREATE INDEX "Scene_assetId_idx" ON "Scene"("assetId");

-- CreateIndex
CREATE INDEX "Scene_generatedAssetId_idx" ON "Scene"("generatedAssetId");

-- CreateIndex
CREATE INDEX "Scene_characterProfileId_idx" ON "Scene"("characterProfileId");

-- CreateIndex
CREATE INDEX "Scene_sfxAssetId_idx" ON "Scene"("sfxAssetId");

-- CreateIndex
CREATE UNIQUE INDEX "Scene_videoProjectId_order_key" ON "Scene"("videoProjectId", "order");

-- CreateIndex
CREATE INDEX "RenderJob_videoProjectId_status_idx" ON "RenderJob"("videoProjectId", "status");

-- CreateIndex
CREATE INDEX "RenderJob_status_createdAt_idx" ON "RenderJob"("status", "createdAt");

-- CreateIndex
CREATE INDEX "RenderJob_retriedFromJobId_idx" ON "RenderJob"("retriedFromJobId");

-- CreateIndex
CREATE UNIQUE INDEX "CharacterProfile_slug_key" ON "CharacterProfile"("slug");

-- CreateIndex
CREATE INDEX "CharacterProfile_name_franchise_idx" ON "CharacterProfile"("name", "franchise");

-- CreateIndex
CREATE INDEX "CharacterReference_characterProfileId_referenceType_idx" ON "CharacterReference"("characterProfileId", "referenceType");

-- CreateIndex
CREATE INDEX "CharacterReference_assetId_idx" ON "CharacterReference"("assetId");

-- CreateIndex
CREATE INDEX "VisualGenerationJob_videoProjectId_status_idx" ON "VisualGenerationJob"("videoProjectId", "status");

-- CreateIndex
CREATE INDEX "VisualGenerationJob_sceneId_status_idx" ON "VisualGenerationJob"("sceneId", "status");

-- CreateIndex
CREATE INDEX "VisualGenerationJob_characterProfileId_status_idx" ON "VisualGenerationJob"("characterProfileId", "status");

-- CreateIndex
CREATE INDEX "VisualGenerationJob_researchAssetRequirementId_status_idx" ON "VisualGenerationJob"("researchAssetRequirementId", "status");

-- CreateIndex
CREATE INDEX "VisualGenerationJob_generatedAssetId_idx" ON "VisualGenerationJob"("generatedAssetId");
