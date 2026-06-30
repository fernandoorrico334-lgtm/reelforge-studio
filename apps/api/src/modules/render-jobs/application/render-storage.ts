import type { RenderBlueprint } from "@reelforge/video-engine";
import type { StudioRenderJob } from "../domain/render-job.js";

export interface PreparedRenderPaths {
  outputPath: string;
  blueprintPath: string;
  srtPath: string;
  assPath: string;
  logPath: string;
  thumbnailPath: string;
}

export interface ResolvedRenderMedia {
  absolutePath: string;
  mimeType: string;
  fileSize: number;
  supportsRange: boolean;
}

export interface RenderStorage {
  saveBlueprint(
    videoProjectId: string,
    renderJobId: string,
    blueprint: RenderBlueprint
  ): Promise<PreparedRenderPaths>;
  resolveOutputMedia(
    renderJob: StudioRenderJob
  ): Promise<ResolvedRenderMedia | null>;
  resolveLogMedia(
    renderJob: StudioRenderJob
  ): Promise<ResolvedRenderMedia | null>;
  resolveThumbnailMedia(
    renderJob: StudioRenderJob
  ): Promise<ResolvedRenderMedia | null>;
}

