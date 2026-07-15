import type { ComicGoldenRenderArtifact, ComicGoldenRenderQaReport } from "./comic-golden-render-qa.js";

export type ComicGoldenRuntimeQaVerdict = "publish_review_ready" | "render_passed" | "needs_fix" | "blocked" | "skipped";

export type ComicGoldenRuntimeQaReport = {
  runtimeQaId: "comic_golden_runtime_render_qa_v1";
  planQaId: ComicGoldenRenderQaReport["qaId"];
  verdict: ComicGoldenRuntimeQaVerdict;
  overallScore: number;
  artifact: ComicGoldenRenderArtifact;
  checks: {
    artifactExists: boolean;
    vertical1080x1920: boolean;
    durationAtLeast30s: boolean;
    durationCloseToPlan: boolean;
    videoCodecReady: boolean;
    audioCodecReady: boolean;
    audioPresent: boolean;
    planWasReady: boolean;
  };
  measuredVsPlan: {
    plannedDurationSeconds: number;
    actualDurationSeconds: number | null;
    durationDeltaSeconds: number | null;
    plannedScore: number;
  };
  warnings: string[];
  blockers: string[];
  recommendations: string[];
};

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function hasReadyVideoCodec(codec: string | null | undefined): boolean {
  if (!codec) return false;
  return ["h264", "hevc", "mpeg4"].includes(codec.toLowerCase());
}

function hasReadyAudioCodec(codec: string | null | undefined): boolean {
  if (!codec) return false;
  return ["aac", "mp3", "opus", "pcm_s16le"].includes(codec.toLowerCase());
}

function scoreChecks(checks: ComicGoldenRuntimeQaReport["checks"]): number {
  const weights: Array<[keyof ComicGoldenRuntimeQaReport["checks"], number]> = [
    ["artifactExists", 18],
    ["vertical1080x1920", 18],
    ["durationAtLeast30s", 18],
    ["durationCloseToPlan", 10],
    ["videoCodecReady", 12],
    ["audioCodecReady", 10],
    ["audioPresent", 8],
    ["planWasReady", 6]
  ];

  return clamp(weights.reduce((sum, [key, weight]) => sum + (checks[key] ? weight : 0), 0));
}

function verdictFor(score: number, blockers: string[], artifactExists: boolean): ComicGoldenRuntimeQaVerdict {
  if (!artifactExists) return "skipped";
  if (blockers.length > 0) return "blocked";
  if (score >= 92) return "publish_review_ready";
  if (score >= 85) return "render_passed";
  return "needs_fix";
}

export function buildComicGoldenRuntimeQaReport(input: {
  planQa: ComicGoldenRenderQaReport;
  artifact: ComicGoldenRenderArtifact;
}): ComicGoldenRuntimeQaReport {
  const actualDuration = input.artifact.durationSeconds ?? null;
  const plannedDuration = input.planQa.measured.durationSeconds;
  const durationDelta = actualDuration == null ? null : Number((actualDuration - plannedDuration).toFixed(3));
  const artifactExists = input.artifact.exists === true;
  const checks = {
    artifactExists,
    vertical1080x1920: input.artifact.width === 1080 && input.artifact.height === 1920,
    durationAtLeast30s: actualDuration != null && actualDuration >= 30,
    durationCloseToPlan: actualDuration != null && Math.abs(actualDuration - plannedDuration) <= 2,
    videoCodecReady: hasReadyVideoCodec(input.artifact.videoCodec),
    audioCodecReady: hasReadyAudioCodec(input.artifact.audioCodec),
    audioPresent: Boolean(input.artifact.audioCodec),
    planWasReady: input.planQa.releaseVerdict === "ready_to_render" || input.planQa.releaseVerdict === "ready_to_publish_review"
  } satisfies ComicGoldenRuntimeQaReport["checks"];

  const warnings: string[] = [];
  const blockers: string[] = [];
  const recommendations: string[] = [];

  if (!checks.artifactExists) blockers.push("render_artifact_missing");
  if (!checks.vertical1080x1920) blockers.push("render_not_vertical_1080x1920");
  if (!checks.durationAtLeast30s) blockers.push("runtime_duration_below_30s");
  if (!checks.videoCodecReady) blockers.push("video_codec_not_publish_ready");
  if (!checks.audioPresent) blockers.push("audio_missing");
  if (!checks.audioCodecReady) warnings.push("audio_codec_needs_review");
  if (!checks.durationCloseToPlan) warnings.push("runtime_duration_differs_from_plan");
  if (!checks.planWasReady) warnings.push("plan_quality_was_not_ready_before_render");

  if (blockers.includes("render_artifact_missing")) recommendations.push("Renderizar o MP4 antes de executar QA runtime final.");
  if (blockers.includes("render_not_vertical_1080x1920")) recommendations.push("Re-renderizar em 1080x1920 vertical antes de publicar.");
  if (blockers.includes("runtime_duration_below_30s")) recommendations.push("Aumentar roteiro/cenas para manter no minimo 30s no arquivo final.");
  if (blockers.includes("audio_missing")) recommendations.push("Verificar mix de narracao/musica/SFX e re-renderizar com audio AAC.");
  if (warnings.includes("runtime_duration_differs_from_plan")) recommendations.push("Comparar duracao real com blueprint para evitar cortes perdidos ou silencio extra.");

  const overallScore = scoreChecks(checks);

  return {
    runtimeQaId: "comic_golden_runtime_render_qa_v1",
    planQaId: input.planQa.qaId,
    verdict: verdictFor(overallScore, blockers, artifactExists),
    overallScore,
    artifact: input.artifact,
    checks,
    measuredVsPlan: {
      plannedDurationSeconds: plannedDuration,
      actualDurationSeconds: actualDuration,
      durationDeltaSeconds: durationDelta,
      plannedScore: input.planQa.overallScore
    },
    warnings,
    blockers,
    recommendations
  };
}
