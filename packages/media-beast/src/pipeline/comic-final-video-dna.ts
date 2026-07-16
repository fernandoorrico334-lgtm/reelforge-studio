export type ComicFinalVideoDnaVerdict = "reference_ready" | "strong" | "needs_pacing_fix" | "blocked";

export type ComicFinalVideoDnaTarget = {
  targetId: "comic_viral_reference_dna_v1";
  minDurationSeconds: number;
  maxDurationSeconds: number;
  minCutsPerMinute: number;
  maxAverageShotDurationSeconds: number;
  minCaptionCuesPerMinute: number;
  minAudioPeakCount: number;
  requiredWidth: 1080;
  requiredHeight: 1920;
  notes: string[];
};

export type ComicFinalVideoDnaMetrics = {
  outputPath?: string | null;
  durationSeconds: number | null;
  width: number | null;
  height: number | null;
  videoCodec: string | null;
  audioCodec: string | null;
  detectedCutTimesSeconds: number[];
  captionCueCount: number;
  audioPeakCount: number;
  narrationPresent: boolean;
  musicPresent: boolean;
  sfxPresent: boolean;
  extractionStatus: "measured" | "synthetic" | "skipped";
  extractionWarnings: string[];
};

export type ComicFinalVideoDnaReport = {
  dnaId: "comic_final_video_dna_v1";
  target: ComicFinalVideoDnaTarget;
  verdict: ComicFinalVideoDnaVerdict;
  overallScore: number;
  measured: ComicFinalVideoDnaMetrics & {
    cutCount: number;
    cutsPerMinute: number;
    averageShotDurationSeconds: number | null;
    captionCuesPerMinute: number;
    verticalConfirmed: boolean;
    audioLayerCount: number;
  };
  checks: {
    durationOk: boolean;
    verticalOk: boolean;
    pacingOk: boolean;
    captionsOk: boolean;
    audioOk: boolean;
    narrationOk: boolean;
    sfxOk: boolean;
  };
  strengths: string[];
  warnings: string[];
  blockers: string[];
  recommendations: string[];
};

export const COMIC_FINAL_VIDEO_DNA_TARGET: ComicFinalVideoDnaTarget = {
  targetId: "comic_viral_reference_dna_v1",
  minDurationSeconds: 30,
  maxDurationSeconds: 55,
  minCutsPerMinute: 28,
  maxAverageShotDurationSeconds: 2.2,
  minCaptionCuesPerMinute: 55,
  minAudioPeakCount: 8,
  requiredWidth: 1080,
  requiredHeight: 1920,
  notes: [
    "Referencia minima: corte rapido, vertical real, captions frequentes e audio com picos intencionais.",
    "Este DNA mede o arquivo final ou recebe metricas extraidas por FFmpeg/FFprobe.",
    "Se a extracao real estiver bloqueada, use metricas synthetic apenas como teste de contrato."
  ]
};

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function perMinute(count: number, durationSeconds: number | null): number {
  if (!durationSeconds || durationSeconds <= 0) return 0;
  return Number(((count / durationSeconds) * 60).toFixed(2));
}

function averageShotDuration(durationSeconds: number | null, cutCount: number): number | null {
  if (!durationSeconds || durationSeconds <= 0) return null;
  const shotCount = Math.max(1, cutCount + 1);
  return Number((durationSeconds / shotCount).toFixed(2));
}

function scoreBoolean(ok: boolean, weight: number): number {
  return ok ? weight : 0;
}

function resolveVerdict(score: number, blockers: string[], pacingOk: boolean): ComicFinalVideoDnaVerdict {
  if (blockers.length > 0) return "blocked";
  if (score >= 90) return "reference_ready";
  if (score >= 80 && pacingOk) return "strong";
  return "needs_pacing_fix";
}

export function analyzeComicFinalVideoDna(input: {
  metrics: ComicFinalVideoDnaMetrics;
  target?: Partial<ComicFinalVideoDnaTarget>;
}): ComicFinalVideoDnaReport {
  const target: ComicFinalVideoDnaTarget = {
    ...COMIC_FINAL_VIDEO_DNA_TARGET,
    ...input.target,
    notes: input.target?.notes ?? COMIC_FINAL_VIDEO_DNA_TARGET.notes
  };
  const cutCount = input.metrics.detectedCutTimesSeconds.length;
  const cutsPerMinute = perMinute(cutCount, input.metrics.durationSeconds);
  const avgShot = averageShotDuration(input.metrics.durationSeconds, cutCount);
  const captionCuesPerMinute = perMinute(input.metrics.captionCueCount, input.metrics.durationSeconds);
  const verticalConfirmed = input.metrics.width === target.requiredWidth && input.metrics.height === target.requiredHeight;
  const audioLayerCount = [input.metrics.narrationPresent, input.metrics.musicPresent, input.metrics.sfxPresent].filter(Boolean).length;
  const checks = {
    durationOk: input.metrics.durationSeconds != null && input.metrics.durationSeconds >= target.minDurationSeconds && input.metrics.durationSeconds <= target.maxDurationSeconds,
    verticalOk: verticalConfirmed,
    pacingOk: cutsPerMinute >= target.minCutsPerMinute && avgShot != null && avgShot <= target.maxAverageShotDurationSeconds,
    captionsOk: captionCuesPerMinute >= target.minCaptionCuesPerMinute,
    audioOk: Boolean(input.metrics.audioCodec) && input.metrics.audioPeakCount >= target.minAudioPeakCount,
    narrationOk: input.metrics.narrationPresent,
    sfxOk: input.metrics.sfxPresent
  };

  const blockers: string[] = [];
  const warnings: string[] = [...input.metrics.extractionWarnings];
  const strengths: string[] = [];
  const recommendations: string[] = [];

  if (!checks.durationOk) blockers.push("final_duration_outside_30_55s_window");
  if (!checks.verticalOk) blockers.push("final_video_not_1080x1920");
  if (!checks.audioOk) blockers.push("final_audio_not_punchy_or_missing");
  if (!checks.pacingOk) warnings.push("cut_pace_below_reference_dna");
  if (!checks.captionsOk) warnings.push("caption_density_below_reference_dna");
  if (!checks.narrationOk) warnings.push("narration_not_confirmed_in_final_dna");
  if (!checks.sfxOk) warnings.push("sfx_not_confirmed_in_final_dna");
  if (input.metrics.extractionStatus !== "measured") warnings.push(`final_dna_extraction_${input.metrics.extractionStatus}`);

  if (checks.durationOk) strengths.push("duration_matches_short_reference_window");
  if (checks.verticalOk) strengths.push("vertical_1080x1920_confirmed");
  if (checks.pacingOk) strengths.push("cut_pace_matches_reference_energy");
  if (checks.captionsOk) strengths.push("caption_density_matches_reference");
  if (checks.audioOk) strengths.push("audio_has_enough_peak_energy");
  if (checks.narrationOk) strengths.push("narration_layer_confirmed");
  if (checks.sfxOk) strengths.push("sfx_layer_confirmed");

  if (!checks.pacingOk) recommendations.push("Aumentar cortes/zoom punches para manter planos abaixo de 2.2s em media.");
  if (!checks.captionsOk) recommendations.push("Renderizar captions por frase curta/palavra-chave, nao legenda longa por cena.");
  if (!checks.audioOk) recommendations.push("Revisar mastering/SFX para adicionar picos audiveis em hooks, golpes e viradas.");
  if (!checks.verticalOk) recommendations.push("Re-renderizar em 1080x1920 antes de comparar com a referencia.");
  if (!checks.durationOk) recommendations.push("Ajustar roteiro final para ficar entre 30s e 55s.");

  const score = clamp(
    scoreBoolean(checks.durationOk, 16)
      + scoreBoolean(checks.verticalOk, 18)
      + scoreBoolean(checks.pacingOk, 22)
      + scoreBoolean(checks.captionsOk, 16)
      + scoreBoolean(checks.audioOk, 14)
      + scoreBoolean(checks.narrationOk, 8)
      + scoreBoolean(checks.sfxOk, 6)
  );

  return {
    dnaId: "comic_final_video_dna_v1",
    target,
    verdict: resolveVerdict(score, blockers, checks.pacingOk),
    overallScore: score,
    measured: {
      ...input.metrics,
      cutCount,
      cutsPerMinute,
      averageShotDurationSeconds: avgShot,
      captionCuesPerMinute,
      verticalConfirmed,
      audioLayerCount
    },
    checks,
    strengths,
    warnings,
    blockers,
    recommendations
  };
}
