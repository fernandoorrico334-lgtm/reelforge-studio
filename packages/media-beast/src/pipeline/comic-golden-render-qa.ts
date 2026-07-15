import type { ComicPremiumDirectorReport } from "./comic-premium-director.js";
import type { ComicRenderQualityScorerReport } from "./comic-render-quality-scorer.js";
import type { ComicSfxBeatDirectorReport } from "./comic-sfx-beat-director.js";
import type { ComicShortProductionPlan } from "./comic-shorts-factory.js";

export type ComicGoldenRenderQaVerdict = "ready_to_publish_review" | "ready_to_render" | "needs_editing" | "blocked";

export type ComicGoldenReferenceTarget = {
  referencePresetId: string;
  name: string;
  minDurationSeconds: number;
  idealDurationRangeSeconds: { min: number; max: number };
  minRenderQualityScore: number;
  minPanelAlignmentScore: number;
  minCaptionQualityScore: number;
  minCropConfidenceScore: number;
  minSfxIntensityScore: number;
  targetResolution: { width: 1080; height: 1920 };
  notes: string[];
};

export type ComicGoldenRenderArtifact = {
  outputPath?: string | null;
  exists?: boolean;
  width?: number | null;
  height?: number | null;
  durationSeconds?: number | null;
  videoCodec?: string | null;
  audioCodec?: string | null;
};

export type ComicGoldenRenderQaReport = {
  qaId: "comic_golden_render_qa_v1";
  referenceTarget: ComicGoldenReferenceTarget;
  releaseVerdict: ComicGoldenRenderQaVerdict;
  overallScore: number;
  measured: {
    durationSeconds: number;
    sceneCount: number;
    averageSceneDurationSeconds: number;
    narrationWordCount: number;
    captionCueCount: number;
    captionCueDensityPerSecond: number;
    sfxCueCount: number;
    sfxAverageIntensity: number;
    panelAlignmentScore: number;
    captionQualityScore: number;
    cropConfidenceScore: number;
    renderQualityScore: number;
    renderArtifactStatus: "not_rendered" | "present" | "missing" | "invalid";
  };
  referenceComparison: {
    durationMeetsMinimum: boolean;
    durationInsideIdealRange: boolean;
    renderQualityMeetsTarget: boolean;
    panelAlignmentMeetsTarget: boolean;
    captionQualityMeetsTarget: boolean;
    cropConfidenceMeetsTarget: boolean;
    sfxIntensityMeetsTarget: boolean;
    verticalFormatConfirmed: boolean | null;
  };
  strengths: string[];
  warnings: string[];
  blockers: string[];
  recommendations: string[];
  renderArtifact?: ComicGoldenRenderArtifact;
};

export const COMIC_GOLDEN_REFERENCE_TARGET: ComicGoldenReferenceTarget = {
  referencePresetId: "builtin-comic-viral-reference-antman",
  name: "Comic Viral Reference Baseline",
  minDurationSeconds: 30,
  idealDurationRangeSeconds: { min: 30, max: 45 },
  minRenderQualityScore: 85,
  minPanelAlignmentScore: 72,
  minCaptionQualityScore: 74,
  minCropConfidenceScore: 78,
  minSfxIntensityScore: 65,
  targetResolution: { width: 1080, height: 1920 },
  notes: [
    "Shorts de HQ devem ter pelo menos 30s para sustentar hook, conflito e payoff.",
    "A referencia minima exige narracao dramatica, crop inteligente, captions curtas e SFX pontuais.",
    "Este QA e candidate-first: ele avalia o plano e nao publica/renderiza sem aprovacao manual."
  ]
};

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function resolveArtifactStatus(artifact?: ComicGoldenRenderArtifact): ComicGoldenRenderQaReport["measured"]["renderArtifactStatus"] {
  if (!artifact) return "not_rendered";
  if (artifact.exists === false) return "missing";
  if (artifact.width != null && artifact.height != null && (artifact.width <= 0 || artifact.height <= 0)) return "invalid";
  return "present";
}

function resolveVerdict(input: {
  blockers: string[];
  warnings: string[];
  overallScore: number;
  artifactStatus: ComicGoldenRenderQaReport["measured"]["renderArtifactStatus"];
}): ComicGoldenRenderQaVerdict {
  if (input.blockers.length > 0) return "blocked";
  if (input.overallScore >= 90 && input.artifactStatus === "present") return "ready_to_publish_review";
  if (input.overallScore >= 85) return "ready_to_render";
  return "needs_editing";
}

export function buildComicGoldenRenderQaReport(input: {
  short: ComicShortProductionPlan;
  premiumDirector: ComicPremiumDirectorReport;
  sfxBeatDirector: ComicSfxBeatDirectorReport;
  renderQualityScore: ComicRenderQualityScorerReport;
  renderArtifact?: ComicGoldenRenderArtifact;
  referenceTarget?: Partial<ComicGoldenReferenceTarget>;
}): ComicGoldenRenderQaReport {
  const target: ComicGoldenReferenceTarget = {
    ...COMIC_GOLDEN_REFERENCE_TARGET,
    ...input.referenceTarget,
    idealDurationRangeSeconds: input.referenceTarget?.idealDurationRangeSeconds ?? COMIC_GOLDEN_REFERENCE_TARGET.idealDurationRangeSeconds,
    targetResolution: input.referenceTarget?.targetResolution ?? COMIC_GOLDEN_REFERENCE_TARGET.targetResolution,
    notes: input.referenceTarget?.notes ?? COMIC_GOLDEN_REFERENCE_TARGET.notes
  };

  const durationSeconds = Math.round(input.short.estimatedDurationSeconds);
  const sceneCount = input.short.scenes.length;
  const averageSceneDurationSeconds = sceneCount > 0 ? Number((durationSeconds / sceneCount).toFixed(2)) : 0;
  const narrationWordCount = countWords(input.short.narrationScript);
  const captionCueCount = input.premiumDirector.captionNarration.scenes.reduce((sum, scene) => sum + scene.captionCues.length, 0);
  const captionCueDensityPerSecond = durationSeconds > 0 ? Number((captionCueCount / durationSeconds).toFixed(2)) : 0;
  const sfxCueCount = input.sfxBeatDirector.cues.length;
  const sfxAverageIntensity = clamp(input.sfxBeatDirector.averageIntensityScore);
  const panelAlignmentScore = clamp(input.premiumDirector.captionNarration.averagePanelAlignmentScore);
  const captionQualityScore = clamp(input.renderQualityScore.breakdown.captionScore);
  const cropConfidenceScore = clamp(input.renderQualityScore.breakdown.cropScore);
  const renderQuality = clamp(input.renderQualityScore.overallScore);
  const artifactStatus = resolveArtifactStatus(input.renderArtifact);
  const verticalFormatConfirmed = input.renderArtifact?.width != null && input.renderArtifact?.height != null
    ? input.renderArtifact.width === target.targetResolution.width && input.renderArtifact.height === target.targetResolution.height
    : null;

  const referenceComparison = {
    durationMeetsMinimum: durationSeconds >= target.minDurationSeconds,
    durationInsideIdealRange: durationSeconds >= target.idealDurationRangeSeconds.min && durationSeconds <= target.idealDurationRangeSeconds.max,
    renderQualityMeetsTarget: renderQuality >= target.minRenderQualityScore,
    panelAlignmentMeetsTarget: panelAlignmentScore >= target.minPanelAlignmentScore,
    captionQualityMeetsTarget: captionQualityScore >= target.minCaptionQualityScore,
    cropConfidenceMeetsTarget: cropConfidenceScore >= target.minCropConfidenceScore,
    sfxIntensityMeetsTarget: sfxAverageIntensity >= target.minSfxIntensityScore,
    verticalFormatConfirmed
  };

  const blockers: string[] = [];
  const warnings: string[] = [];
  const strengths: string[] = [];
  const recommendations: string[] = [];

  if (!referenceComparison.durationMeetsMinimum) blockers.push("duration_below_30s");
  if (!referenceComparison.renderQualityMeetsTarget) blockers.push("render_quality_below_golden_target");
  if (artifactStatus === "missing" || artifactStatus === "invalid") blockers.push("render_artifact_invalid_or_missing");
  if (verticalFormatConfirmed === false) blockers.push("render_not_vertical_1080x1920");

  if (!referenceComparison.durationInsideIdealRange) warnings.push("duration_outside_ideal_30_45s_range");
  if (!referenceComparison.panelAlignmentMeetsTarget) warnings.push("panel_alignment_needs_scene_doctor");
  if (!referenceComparison.captionQualityMeetsTarget) warnings.push("caption_cues_need_more_short_punchy_lines");
  if (!referenceComparison.cropConfidenceMeetsTarget) warnings.push("smart_crop_confidence_needs_visual_review");
  if (!referenceComparison.sfxIntensityMeetsTarget) warnings.push("sfx_beat_director_needs_more_punch");
  if (artifactStatus === "not_rendered") warnings.push("render_artifact_not_generated_yet");

  if (referenceComparison.durationMeetsMinimum) strengths.push("duration_supports_full_retention_arc");
  if (referenceComparison.renderQualityMeetsTarget) strengths.push("render_quality_meets_reference_baseline");
  if (referenceComparison.panelAlignmentMeetsTarget) strengths.push("narration_aligned_to_visual_panels");
  if (referenceComparison.captionQualityMeetsTarget) strengths.push("caption_plan_ready_for_short_form");
  if (referenceComparison.cropConfidenceMeetsTarget) strengths.push("smart_crop_ready_for_9_16");
  if (referenceComparison.sfxIntensityMeetsTarget) strengths.push("sfx_beats_have_enough_impact");
  if (verticalFormatConfirmed === true) strengths.push("render_artifact_vertical_1080x1920_confirmed");

  if (blockers.includes("duration_below_30s")) recommendations.push("Aumentar o short para no minimo 30s com mais contexto visual, virada e payoff.");
  if (blockers.includes("render_quality_below_golden_target")) recommendations.push("Reprocessar Script Doctor, Smart Crop e SFX Director antes de renderizar.");
  if (warnings.includes("caption_cues_need_more_short_punchy_lines")) recommendations.push("Quebrar captions em frases curtas com palavras-chave destacadas.");
  if (warnings.includes("smart_crop_confidence_needs_visual_review")) recommendations.push("Revisar recorte de rostos, golpes, baloes e monstros antes do render final.");
  if (warnings.includes("sfx_beat_director_needs_more_punch")) recommendations.push("Adicionar hits/whooshes apenas nos beats fortes para nao poluir o audio.");
  if (artifactStatus === "not_rendered") recommendations.push("Rodar render curto e reavaliar codec, duracao real, audio e resolucao antes de publicar.");

  const weightedScore = clamp(
    renderQuality * 0.44
      + panelAlignmentScore * 0.16
      + captionQualityScore * 0.14
      + cropConfidenceScore * 0.14
      + sfxAverageIntensity * 0.08
      + (referenceComparison.durationInsideIdealRange ? 100 : referenceComparison.durationMeetsMinimum ? 88 : 40) * 0.04
  );
  const overallScore = blockers.length > 0 ? Math.min(weightedScore, 84) : weightedScore;
  const releaseVerdict = resolveVerdict({ blockers, warnings, overallScore, artifactStatus });

  return {
    qaId: "comic_golden_render_qa_v1",
    referenceTarget: target,
    releaseVerdict,
    overallScore,
    measured: {
      durationSeconds,
      sceneCount,
      averageSceneDurationSeconds,
      narrationWordCount,
      captionCueCount,
      captionCueDensityPerSecond,
      sfxCueCount,
      sfxAverageIntensity,
      panelAlignmentScore,
      captionQualityScore,
      cropConfidenceScore,
      renderQualityScore: renderQuality,
      renderArtifactStatus: artifactStatus
    },
    referenceComparison,
    strengths,
    warnings,
    blockers,
    recommendations,
    ...(input.renderArtifact ? { renderArtifact: input.renderArtifact } : {})
  };
}
