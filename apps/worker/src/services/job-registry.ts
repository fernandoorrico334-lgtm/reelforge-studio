import type { RenderVideoJob } from "../jobs/render-video.job.js";
import { createRenderPipeline } from "../pipelines/render-pipeline.js";

export interface RegisteredJob {
  type: "render-video";
  description: string;
  pipeline: ReturnType<typeof createRenderPipeline>;
  samplePayload: RenderVideoJob;
}

export function buildJobRegistry(): RegisteredJob[] {
  return [
    {
      type: "render-video",
      description:
        "Future local render job. Kept as a contract placeholder while render execution is intentionally disabled.",
      pipeline: createRenderPipeline(),
      samplePayload: {
        id: "job-demo-001",
        projectId: "foundation-demo",
        templateId: "kinetic-reveal",
        plannedOutputPath: "storage/renders/foundation-demo/final.mp4",
        requestedAt: "2026-06-26T00:00:00.000Z"
      }
    }
  ];
}