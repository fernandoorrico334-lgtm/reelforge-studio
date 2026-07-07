import type { VisualTransformerPlan } from "./visual-transformer.js";

export type FastCutEffect =
  | "flash"
  | "whip"
  | "zoom-punch"
  | "film-burn"
  | "glitch-card"
  | "dark-blink"
  | "hard-cut"
  | "breath-hold"
  | "impact-freeze";

export interface FastCutEditorInput {
  durationSeconds: number;
  energy: "low" | "medium" | "high" | "extreme";
  visualPlan: VisualTransformerPlan;
  beatMarkers?: number[];
  emotion?: "curious" | "tense" | "hype" | "dark" | "epic" | "calm" | "horror";
}

export interface FastCutEditorPlan {
  durationSeconds: number;
  averageShotLengthSeconds: number;
  cutTimes: number[];
  effectCues: Array<{
    timeSeconds: number;
    effect: FastCutEffect;
    intensity: number;
  }>;
  transitionSequence: Array<{
    fromCutSeconds: number;
    toCutSeconds: number;
    transition:
      | "cut"
      | "flash-cut"
      | "whip-pan"
      | "smash-zoom"
      | "film-burn"
      | "dark-blink"
      | "soft-drift";
    emotion: NonNullable<FastCutEditorInput["emotion"]>;
  }>;
  microclipWindows: Array<{
    startSeconds: number;
    endSeconds: number;
    purpose: "impact" | "evidence" | "breath";
  }>;
  warnings: string[];
}

function resolveShotLength(energy: FastCutEditorInput["energy"]) {
  switch (energy) {
    case "extreme":
      return 0.65;
    case "high":
      return 0.9;
    case "medium":
      return 1.35;
    case "low":
    default:
      return 1.8;
  }
}

function resolveEmotion(input: FastCutEditorInput): NonNullable<FastCutEditorInput["emotion"]> {
  if (input.emotion) {
    return input.emotion;
  }

  if (input.energy === "extreme") {
    return "hype";
  }

  if (
    input.visualPlan.styleStack.includes("horror_atmosphere") ||
    input.visualPlan.transitionStyle === "dark_tension"
  ) {
    return "horror";
  }

  if (input.visualPlan.styleStack.includes("crime_board")) {
    return "dark";
  }

  if (input.visualPlan.transitionStyle === "punchy_shorts") {
    return "hype";
  }

  return "curious";
}

function transitionForEmotion(
  emotion: NonNullable<FastCutEditorInput["emotion"]>,
  index: number,
  visualPlan: VisualTransformerPlan
): FastCutEditorPlan["transitionSequence"][number]["transition"] {
  const styleOverrides: Record<
    VisualTransformerPlan["transitionStyle"],
    FastCutEditorPlan["transitionSequence"][number]["transition"][]
  > = {
    smooth_cinematic: ["soft-drift", "cut", "film-burn", "soft-drift"],
    punchy_shorts: ["whip-pan", "smash-zoom", "flash-cut", "cut"],
    dark_tension: ["dark-blink", "film-burn", "cut", "smash-zoom"],
    epic_build: ["film-burn", "smash-zoom", "soft-drift", "flash-cut"]
  };

  const emotionMap: Record<
    NonNullable<FastCutEditorInput["emotion"]>,
    FastCutEditorPlan["transitionSequence"][number]["transition"][]
  > = {
    curious: ["cut", "flash-cut", "soft-drift"],
    tense: ["dark-blink", "cut", "smash-zoom"],
    hype: ["whip-pan", "smash-zoom", "flash-cut"],
    dark: ["dark-blink", "film-burn", "cut"],
    epic: ["film-burn", "smash-zoom", "flash-cut"],
    calm: ["soft-drift", "cut", "soft-drift"],
    horror: ["dark-blink", "film-burn", "smash-zoom"]
  };

  const options =
    styleOverrides[visualPlan.transitionStyle] ?? emotionMap[emotion];
  return options[index % options.length] ?? "cut";
}

export function buildFastCutEditorPlan(
  input: FastCutEditorInput
): FastCutEditorPlan {
  const averageShotLengthSeconds = resolveShotLength(input.energy);
  const emotion = resolveEmotion(input);
  const cutTimes: number[] = [];
  const variability =
    input.energy === "extreme" ? 0.22 : input.energy === "high" ? 0.16 : 0.08;
  let cutIndex = 0;
  for (
    let time = averageShotLengthSeconds;
    time < input.durationSeconds;
    time += averageShotLengthSeconds *
      (1 + (cutIndex % 3 === 0 ? -variability : cutIndex % 3 === 1 ? variability : 0))
  ) {
    cutTimes.push(Number(time.toFixed(2)));
    cutIndex += 1;
  }

  const beatTimes =
    input.beatMarkers && input.beatMarkers.length > 0
      ? [...new Set([...input.beatMarkers, ...cutTimes])].sort((a, b) => a - b)
      : cutTimes;
  const effects = [
    "zoom-punch",
    "flash",
    "whip",
      "film-burn",
      "glitch-card",
      "hard-cut",
      "breath-hold",
      "impact-freeze"
    ] as const;
  const effectCues = beatTimes.slice(0, 12).map((time, index) => {
    const effect: FastCutEffect =
      emotion === "calm"
        ? "breath-hold"
        : emotion === "horror" || emotion === "dark"
          ? index % 2 === 0
            ? "film-burn"
            : "dark-blink"
          : emotion === "hype"
            ? index % 2 === 0
              ? "zoom-punch"
              : "impact-freeze"
            : effects[index % effects.length] ?? "zoom-punch";

    return {
    timeSeconds: Number(time.toFixed(2)),
    effect,
    intensity:
      input.energy === "extreme" ? 92 : input.energy === "high" ? 78 : 56
    };
  });
  const transitionSequence = cutTimes.slice(0, -1).map((time, index) => ({
    fromCutSeconds: time,
    toCutSeconds: cutTimes[index + 1] ?? Number((time + averageShotLengthSeconds).toFixed(2)),
    transition: transitionForEmotion(emotion, index, input.visualPlan),
    emotion
  }));

  return {
    durationSeconds: input.durationSeconds,
    averageShotLengthSeconds,
    cutTimes,
    effectCues,
    transitionSequence,
    microclipWindows: [
      {
        startSeconds: Number(Math.max(0.5, input.durationSeconds * 0.22).toFixed(2)),
        endSeconds: Number(Math.min(input.durationSeconds, input.durationSeconds * 0.22 + 1.4).toFixed(2)),
        purpose: "impact"
      },
      {
        startSeconds: Number(Math.max(1, input.durationSeconds * 0.62).toFixed(2)),
        endSeconds: Number(Math.min(input.durationSeconds, input.durationSeconds * 0.62 + 1.2).toFixed(2)),
        purpose: "evidence"
      }
    ],
    warnings: [
      "Fast-cut plans should keep captions readable.",
      "Do not use edit intensity to disguise unauthorized source material."
    ]
  };
}
