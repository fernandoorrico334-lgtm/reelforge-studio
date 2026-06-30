export type TransitionFadeMode = "cut" | "fade" | "fast_fade";

function toEvenInteger(value: number) {
  const rounded = Math.max(2, Math.round(value));
  return rounded % 2 === 0 ? rounded : rounded + 1;
}

export function clampNumber(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

export function normalizeSceneDuration(value: number | null | undefined) {
  if (typeof value === "number" && value > 0) {
    return Math.max(value, 0.5);
  }

  return 4;
}

export function computeFrameCount(duration: number, fps = 30) {
  return Math.max(1, Math.round(duration * fps));
}

export function buildOverscanDimensions(scaleFactor: number) {
  const width = toEvenInteger(1080 * scaleFactor);
  const height = toEvenInteger(1920 * scaleFactor);
  return { width, height };
}

export function joinFilters(filters: Array<string | null | undefined | false>) {
  return filters.filter((value): value is string => Boolean(value)).join(",");
}

export function roundToThreeDecimals(value: number) {
  return Math.round(value * 1000) / 1000;
}

export function mapTransitionToFadeMode(
  value: string | null | undefined
): TransitionFadeMode {
  const normalized = value?.trim().toLowerCase() ?? "";

  if (!normalized) {
    return "fade";
  }

  if (normalized === "cut" || normalized === "hard-cut") {
    return "cut";
  }

  if (
    normalized === "fast_fade" ||
    normalized === "fast-fade" ||
    normalized === "flash-cut" ||
    normalized === "whip-cut" ||
    normalized === "blink-cut" ||
    normalized === "tension cut" ||
    normalized === "shadow-flash"
  ) {
    return "fast_fade";
  }

  if (normalized.includes("fade") || normalized.includes("dissolve")) {
    return "fade";
  }

  return "cut";
}

export function buildFadeFilters(
  duration: number,
  transitionMode: TransitionFadeMode,
  fadeSeconds: number
) {
  if (transitionMode === "cut" || fadeSeconds <= 0) {
    return [] as string[];
  }

  const safeFade = clampNumber(fadeSeconds, 0.12, Math.max(duration / 2, 0.12));
  const fadeOutStart = Math.max(duration - safeFade, 0);

  return [
    `fade=t=in:st=0:d=${safeFade.toFixed(3)}`,
    `fade=t=out:st=${fadeOutStart.toFixed(3)}:d=${safeFade.toFixed(3)}`
  ];
}

export function escapeDrawtextValue(value: string) {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll(":", "\\:")
    .replaceAll("'", "\\'")
    .replaceAll(",", "\\,")
    .replaceAll("[", "\\[")
    .replaceAll("]", "\\]");
}

export function escapeDrawtextText(value: string) {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll(":", "\\:")
    .replaceAll("'", "\\'")
    .replaceAll("%", "\\%")
    .replaceAll(",", "\\,");
}