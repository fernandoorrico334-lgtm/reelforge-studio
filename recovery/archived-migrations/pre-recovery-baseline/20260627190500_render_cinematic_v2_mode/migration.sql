-- AlterTable
ALTER TABLE "RenderJob" ADD COLUMN "renderMode" TEXT NOT NULL DEFAULT 'v1';
ALTER TABLE "RenderJob" ADD COLUMN "renderQuality" TEXT NOT NULL DEFAULT 'standard';