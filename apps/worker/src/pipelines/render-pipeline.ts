export interface PipelineStage {
  id: string;
  description: string;
  status: "planned" | "blocked";
}

export interface RenderPipelineDefinition {
  engine: string;
  stages: PipelineStage[];
}

export function createRenderPipeline(): RenderPipelineDefinition {
  return {
    engine: "ffmpeg-planned-local",
    stages: [
      {
        id: "ingest-assets",
        description: "Normalize source assets into an internal timeline model.",
        status: "planned"
      },
      {
        id: "compose-cinematic-cuts",
        description: "Apply template, motion, caption and effect decisions.",
        status: "planned"
      },
      {
        id: "execute-render",
        description: "Reserved for future FFmpeg orchestration.",
        status: "blocked"
      }
    ]
  };
}