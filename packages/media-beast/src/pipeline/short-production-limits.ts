export const SHORT_MIN_DURATION_SECONDS = 30;
export const SHORT_MAX_DURATION_SECONDS = 60;
export const SHORT_DEFAULT_DURATION_SECONDS = 35;

/** Fase 1 Video Remixer: saída do remix */
export const REMIX_MAX_OUTPUT_SECONDS = 45;
export const REMIX_MIN_OUTPUT_SECONDS = 25;
export const REMIX_DEFAULT_OUTPUT_SECONDS = 35;

/** Fase 1 Video Remixer: download do vídeo original via yt-dlp */
export const REMIX_MAX_SOURCE_SECONDS = 60;
export const SHORT_MAX_SCENES = 5;
export const SHORT_NARRATION_BEATS = 4;

export function clampShortDuration(seconds: number | null | undefined): number {
  const value =
    typeof seconds === "number" && Number.isFinite(seconds)
      ? Math.round(seconds)
      : SHORT_DEFAULT_DURATION_SECONDS;

  return Math.min(
    SHORT_MAX_DURATION_SECONDS,
    Math.max(SHORT_MIN_DURATION_SECONDS, value)
  );
}

export function shortSceneCount(
  durationSeconds: number,
  intensity: "medium" | "extreme" = "medium"
): number {
  const clamped = clampShortDuration(durationSeconds);
  const ideal = Math.round(clamped / 8);
  const floor = intensity === "extreme" ? 4 : SHORT_NARRATION_BEATS;
  const cap = intensity === "extreme" ? SHORT_MAX_SCENES : SHORT_MAX_SCENES - 1;

  return Math.min(SHORT_MAX_SCENES, Math.max(floor, Math.min(ideal, cap)));
}

export function shortVisualVariationCount(intensity: "medium" | "extreme"): number {
  return intensity === "extreme" ? 5 : 4;
}

export function evenSceneDurations(
  totalSeconds: number,
  sceneCount: number
): number[] {
  const clampedTotal = clampShortDuration(totalSeconds);
  const count = Math.max(1, Math.min(sceneCount, SHORT_MAX_SCENES));
  const base = Math.floor((clampedTotal / count) * 10) / 10;
  const durations = Array.from({ length: count }, () => base);
  const allocated = durations.reduce((sum, value) => sum + value, 0);
  const remainder = Number((clampedTotal - allocated).toFixed(1));

  if (durations.length > 0 && remainder > 0) {
    durations[durations.length - 1] = Number(
      ((durations[durations.length - 1] ?? base) + remainder).toFixed(1)
    );
  }

  return durations;
}

export function limitNarrationLines(lines: string[], maxLines = SHORT_MAX_SCENES): string[] {
  return lines
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, maxLines);
}

export function clampRemixOutputDuration(seconds: number | null | undefined): number {
  const value =
    typeof seconds === "number" && Number.isFinite(seconds)
      ? Math.round(seconds)
      : REMIX_DEFAULT_OUTPUT_SECONDS;

  return Math.min(
    REMIX_MAX_OUTPUT_SECONDS,
    Math.max(REMIX_MIN_OUTPUT_SECONDS, value)
  );
}

export function clampRemixSourceDuration(seconds: number | null | undefined): number {
  const value =
    typeof seconds === "number" && Number.isFinite(seconds)
      ? Math.round(seconds)
      : REMIX_MAX_SOURCE_SECONDS;

  return Math.min(REMIX_MAX_SOURCE_SECONDS, Math.max(15, value));
}