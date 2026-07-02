-- CreateTable
CREATE TABLE "EditorialMicroclip" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "sceneId" TEXT,
    "assetId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "startTimeSeconds" REAL NOT NULL,
    "endTimeSeconds" REAL NOT NULL,
    "durationSeconds" REAL NOT NULL,
    "usageMode" TEXT NOT NULL,
    "narrationOverlay" BOOLEAN NOT NULL DEFAULT true,
    "textOverlay" TEXT,
    "calloutStyle" TEXT NOT NULL DEFAULT 'none',
    "transitionIn" TEXT NOT NULL DEFAULT 'cut',
    "transitionOut" TEXT NOT NULL DEFAULT 'cut',
    "volumeMode" TEXT NOT NULL DEFAULT 'mute_original',
    "orderIndex" INTEGER NOT NULL DEFAULT 1,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "EditorialMicroclip_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "VideoProject" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EditorialMicroclip_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "Scene" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "EditorialMicroclip_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "EditorialMicroclip_projectId_orderIndex_idx" ON "EditorialMicroclip"("projectId", "orderIndex");

-- CreateIndex
CREATE INDEX "EditorialMicroclip_sceneId_orderIndex_idx" ON "EditorialMicroclip"("sceneId", "orderIndex");

-- CreateIndex
CREATE INDEX "EditorialMicroclip_assetId_idx" ON "EditorialMicroclip"("assetId");
