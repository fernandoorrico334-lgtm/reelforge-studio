import type { ComicCaptionNarrationDirectorReport } from "./comic-caption-narration-director.js";
import type { ComicPremiumDirectorReport } from "./comic-premium-director.js";
import type { ComicSfxBeatDirectorReport } from "./comic-sfx-beat-director.js";
import type { ComicShortProductionPlan } from "./comic-shorts-factory.js";

export type ComicRenderQualityStatus = "render_ready" | "needs_review" | "blocked";

export type ComicRenderQualityBreakdown = {
  hookScore: number;
  visualEvidenceScore: number;
  panelCoverageScore: number;
  narrationScore: number;
  captionScore: number;
  cropScore: number;
  sfxScore: number;
  durationScore: number;
  retentionScore: number;
};

export type ComicRenderQualityScorerReport = {
  scorerId: "comic_render_quality_scorer_v1";
  status: ComicRenderQualityStatus;
  overallScore: number;
  minimumRecommendedScore: number;
  durationSeconds: number;
  minDurationSeconds: number;
  breakdown: ComicRenderQualityBreakdown;
  strengths: string[];
  blockers: string[];
  warnings: string[];
  recommendations: string[];
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function scoreDuration(short: ComicShortProductionPlan): number {
  const duration = short.estimatedDurationSeconds;
  if (duration < 30) return 0;
  if (duration >= 30 && duration <= 45) return 100;
  if (duration <= 60) return 82;
  return 65;
}

function scoreVisualEvidence(short: ComicShortProductionPlan): number {
  const sceneScores = short.scenes.map((scene) => {
    const evidence = scene.panelVisualEvidence;
    if (!evidence) return 25;
    let score = 35;
    if (evidence.evidenceCounts.characters > 0) score += 18;
    if (evidence.evidenceCounts.actions > 0) score += 18;
    if (evidence.evidenceCounts.soundEffects > 0) score += 8;
    if (evidence.strongestRelationshipType) score += 8;
    score += Math.round((evidence.confidence.overall ?? 0) * 13);
    return clamp(score, 0, 100);
  });
  return average(sceneScores);
}

function scoreHook(short: ComicShortProductionPlan, premiumDirector: ComicPremiumDirectorReport): number {
  let score = 45;
  if (short.qualityReport.hasHook) score += 20;
  if (premiumDirector.sceneDirections.some((scene) => scene.retentionGoal === "instant_hook")) score += 18;
  if (short.scenes[0]?.role === "hook" && short.scenes[0].panelVisualEvidence) score += 10;
  if (short.scenes[0]?.caption && short.scenes[0].caption.length <= 48) score += 7;
  return clamp(score, 0, 100);
}

function scoreNarration(captionNarration: ComicCaptionNarrationDirectorReport): number {
  return clamp(Math.round(captionNarration.averagePanelAlignmentScore * 0.65 + captionNarration.averageCaptionQualityScore * 0.35), 0, 100);
}

function scoreSfx(sfxBeatDirector: ComicSfxBeatDirectorReport, sceneCount: number): number {
  let score = 35;
  if (sfxBeatDirector.totalCueCount >= sceneCount) score += 25;
  if (sfxBeatDirector.cues.some((cue) => cue.beatRole === "hook_hit")) score += 12;
  if (sfxBeatDirector.cues.some((cue) => cue.beatRole === "climax_impact")) score += 16;
  score += Math.round(sfxBeatDirector.averageIntensityScore * 0.12);
  return clamp(score, 0, 100);
}

function scoreRetention(input: {
  short: ComicShortProductionPlan;
  premiumDirector: ComicPremiumDirectorReport;
  sfxBeatDirector: ComicSfxBeatDirectorReport;
}): number {
  let score = 42;
  if (input.short.qualityGate.status === "passed") score += 18;
  if (input.premiumDirector.qualityScore >= 85) score += 14;
  if (input.premiumDirector.smartCrop.averageConfidenceScore >= 85) score += 10;
  if (input.premiumDirector.captionNarration.averagePanelAlignmentScore >= 70) score += 8;
  if (input.sfxBeatDirector.cues.some((cue) => cue.intensity === "extreme")) score += 8;
  return clamp(score, 0, 100);
}

export function scoreComicRenderReadiness(input: {
  short: ComicShortProductionPlan;
  premiumDirector: ComicPremiumDirectorReport;
  sfxBeatDirector: ComicSfxBeatDirectorReport;
}): ComicRenderQualityScorerReport {
  const short = input.short;
  const captionNarration = input.premiumDirector.captionNarration;
  const breakdown: ComicRenderQualityBreakdown = {
    hookScore: scoreHook(short, input.premiumDirector),
    visualEvidenceScore: scoreVisualEvidence(short),
    panelCoverageScore: Math.round(clamp(short.qualityReport.panelCoverage * 100, 0, 100)),
    narrationScore: scoreNarration(captionNarration),
    captionScore: captionNarration.averageCaptionQualityScore,
    cropScore: input.premiumDirector.smartCrop.averageConfidenceScore,
    sfxScore: scoreSfx(input.sfxBeatDirector, short.scenes.length),
    durationScore: scoreDuration(short),
    retentionScore: scoreRetention(input)
  };

  const overallScore = Math.round(
    breakdown.hookScore * 0.13 +
      breakdown.visualEvidenceScore * 0.13 +
      breakdown.panelCoverageScore * 0.1 +
      breakdown.narrationScore * 0.16 +
      breakdown.captionScore * 0.1 +
      breakdown.cropScore * 0.12 +
      breakdown.sfxScore * 0.1 +
      breakdown.durationScore * 0.08 +
      breakdown.retentionScore * 0.08
  );

  const blockers: string[] = [];
  const warnings: string[] = [];
  const strengths: string[] = [];
  const recommendations: string[] = [];

  if (short.estimatedDurationSeconds < 30) blockers.push("duration_below_30s");
  if (short.qualityGate.status === "rejected") blockers.push(...short.qualityGate.blockers.map((blocker) => `quality_gate:${blocker}`));
  if (breakdown.panelCoverageScore < 100) blockers.push("missing_panel_assets");
  if (breakdown.narrationScore < 70) warnings.push("narration_panel_alignment_below_target");
  if (breakdown.cropScore < 78) warnings.push("smart_crop_confidence_below_target");
  if (breakdown.sfxScore < 70) warnings.push("sfx_impact_plan_below_target");
  if (breakdown.captionScore < 75) warnings.push("caption_quality_below_target");

  if (breakdown.hookScore >= 85) strengths.push("strong_hook");
  if (breakdown.visualEvidenceScore >= 80) strengths.push("strong_visual_evidence");
  if (breakdown.narrationScore >= 75) strengths.push("narration_aligned_to_panels");
  if (breakdown.cropScore >= 85) strengths.push("smart_crop_ready");
  if (breakdown.sfxScore >= 75) strengths.push("sfx_beat_plan_ready");
  if (breakdown.durationScore >= 90) strengths.push("duration_in_shorts_range");

  if (breakdown.narrationScore < 80) recommendations.push("Revisar narração cena a cena para citar exatamente ação/personagem visível no painel.");
  if (breakdown.sfxScore < 80) recommendations.push("Selecionar assets locais de hit/whoosh/riser/boom compatíveis com o SFX Beat Director.");
  if (breakdown.cropScore < 90) recommendations.push("Revisar crop 9:16 em cenas de ação e preservar balões importantes.");
  if (overallScore < 85) recommendations.push("Renderizar somente após melhorar os pontos fracos do score para competir com a referência.");

  const status: ComicRenderQualityStatus = blockers.length > 0
    ? "blocked"
    : overallScore >= 85 && warnings.length <= 1
      ? "render_ready"
      : "needs_review";

  return {
    scorerId: "comic_render_quality_scorer_v1",
    status,
    overallScore,
    minimumRecommendedScore: 85,
    durationSeconds: Number(short.estimatedDurationSeconds.toFixed(1)),
    minDurationSeconds: 30,
    breakdown,
    strengths,
    blockers,
    warnings,
    recommendations
  };
}
