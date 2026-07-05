export type MicroclipSelectorUseCase = "football" | "shorts" | "documentary" | "generic";

export type MicroclipSelectorPreset =
  | "football_hype"
  | "viral_fast_cut"
  | "cinematic_epic"
  | "documentary_clean"
  | "generic";

export type MicroclipUsageMode =
  | "impact_moment"
  | "supporting_evidence"
  | "quick_reference";

export type MicroclipTransition = "cut" | "flash" | "whoosh";

export type MicroclipVolumeMode =
  | "mute_original"
  | "low_original"
  | "keep_original";

export interface MicroclipSignal {
  timeSeconds: number;
  strength: number;
  reason: string;
}

export interface MicroclipCandidate {
  id: string;
  assetId: string;
  startTimeSeconds: number;
  endTimeSeconds: number;
  durationSeconds: number;
  score: number;
  reasons: string[];
  usageMode: MicroclipUsageMode;
  recommendedTextOverlay: string | null;
  recommendedTransitionIn: MicroclipTransition;
  recommendedTransitionOut: MicroclipTransition;
  recommendedVolumeMode: MicroclipVolumeMode;
}

export interface AnalyzeVideoForMicroclipsInput {
  assetId: string;
  durationSeconds: number;
  targetDurationSeconds?: number | null;
  topN?: number | null;
  useCase?: MicroclipSelectorUseCase | string | null;
  preset?: MicroclipSelectorPreset | string | null;
  sceneChanges?: MicroclipSignal[];
  audioPeaks?: MicroclipSignal[];
  motionEnergy?: MicroclipSignal[];
}

export interface AnalyzeVideoForMicroclipsResult {
  assetId: string;
  durationSeconds: number;
  targetDurationSeconds: number;
  candidates: MicroclipCandidate[];
  warnings: string[];
}

const minCandidateDurationSeconds = 0.5;
const maxCandidateDurationSeconds = 2.5;
const defaultTargetDurationSeconds = 1.5;
const defaultTopN = 10;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function round(value: number) {
  return Math.round(value * 1000) / 1000;
}

function normalizeStrength(value: number) {
  return clamp(Number.isFinite(value) ? value : 0, 0, 1);
}

function normalizeTargetDuration(value: number | null | undefined) {
  return round(
    clamp(
      typeof value === "number" && Number.isFinite(value)
        ? value
        : defaultTargetDurationSeconds,
      minCandidateDurationSeconds,
      maxCandidateDurationSeconds
    )
  );
}

function normalizeTopN(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return defaultTopN;
  }

  return Math.min(Math.max(Math.round(value), 1), 20);
}

function normalizePreset(value: string | null | undefined): MicroclipSelectorPreset {
  switch (value) {
    case "football_hype":
    case "viral_fast_cut":
    case "cinematic_epic":
    case "documentary_clean":
      return value;
    default:
      return "generic";
  }
}

function normalizeUseCase(value: string | null | undefined): MicroclipSelectorUseCase {
  switch (value) {
    case "football":
    case "shorts":
    case "documentary":
      return value;
    default:
      return "generic";
  }
}

function buildSyntheticSignals(
  durationSeconds: number,
  count: number,
  label: string,
  phase: number
): MicroclipSignal[] {
  const usableDuration = Math.max(durationSeconds, 1);
  const signalCount = Math.max(1, Math.min(count, Math.floor(usableDuration * 2)));

  return Array.from({ length: signalCount }, (_, index) => {
    const position = (index + 1) / (signalCount + 1);
    const strength = 0.45 + Math.abs(Math.sin((index + 1) * 1.73 + phase)) * 0.55;

    return {
      timeSeconds: round(position * usableDuration),
      strength: round(normalizeStrength(strength)),
      reason: label
    };
  });
}

export function detectSceneChanges(input: AnalyzeVideoForMicroclipsInput) {
  if (input.sceneChanges?.length) {
    return input.sceneChanges.map((signal) => ({
      ...signal,
      timeSeconds: round(signal.timeSeconds),
      strength: normalizeStrength(signal.strength),
      reason: signal.reason || "scene-change"
    }));
  }

  return buildSyntheticSignals(input.durationSeconds, 8, "scene-change", 0.2);
}

export function detectAudioPeaks(input: AnalyzeVideoForMicroclipsInput) {
  if (input.audioPeaks?.length) {
    return input.audioPeaks.map((signal) => ({
      ...signal,
      timeSeconds: round(signal.timeSeconds),
      strength: normalizeStrength(signal.strength),
      reason: signal.reason || "audio-peak"
    }));
  }

  return buildSyntheticSignals(input.durationSeconds, 10, "audio-peak", 1.1);
}

export function detectMotionEnergy(input: AnalyzeVideoForMicroclipsInput) {
  if (input.motionEnergy?.length) {
    return input.motionEnergy.map((signal) => ({
      ...signal,
      timeSeconds: round(signal.timeSeconds),
      strength: normalizeStrength(signal.strength),
      reason: signal.reason || "motion-energy"
    }));
  }

  return buildSyntheticSignals(input.durationSeconds, 12, "motion-energy", 2.4);
}

function nearestStrength(timeSeconds: number, signals: MicroclipSignal[]) {
  if (signals.length === 0) {
    return 0;
  }

  return signals.reduce((best, signal) => {
    const distance = Math.abs(signal.timeSeconds - timeSeconds);
    const weighted = signal.strength * Math.max(0, 1 - distance / 1.5);
    return Math.max(best, weighted);
  }, 0);
}

function buildCandidateId(assetId: string, start: number, end: number) {
  return `mc-${assetId.slice(0, 8)}-${Math.round(start * 1000)}-${Math.round(end * 1000)}`;
}

function candidateTextOverlay(
  score: number,
  usageMode: MicroclipUsageMode,
  useCase: MicroclipSelectorUseCase
) {
  if (score > 0.82 && useCase === "football") {
    return "impacto do lance";
  }

  if (usageMode === "supporting_evidence") {
    return "prova visual";
  }

  if (usageMode === "quick_reference") {
    return "olha o detalhe";
  }

  return "momento-chave";
}

export function scoreMicroclipCandidates(
  input: AnalyzeVideoForMicroclipsInput
): MicroclipCandidate[] {
  const targetDuration = normalizeTargetDuration(input.targetDurationSeconds);
  const durationSeconds = Math.max(input.durationSeconds, targetDuration);
  const useCase = normalizeUseCase(input.useCase);
  const preset = normalizePreset(input.preset);
  const sceneChanges = detectSceneChanges(input);
  const audioPeaks = detectAudioPeaks(input);
  const motionEnergy = detectMotionEnergy(input);
  const stride = Math.max(0.35, targetDuration / 2);
  const candidates: MicroclipCandidate[] = [];

  for (
    let center = targetDuration / 2;
    center <= durationSeconds - targetDuration / 2;
    center += stride
  ) {
    const motion = nearestStrength(center, motionEnergy);
    const audio = nearestStrength(center, audioPeaks);
    const scene = nearestStrength(center, sceneChanges);
    const presetBoost =
      preset === "football_hype" || preset === "viral_fast_cut" ? 0.08 : 0;
    const score = normalizeStrength(
      motion * 0.44 + audio * 0.34 + scene * 0.18 + presetBoost
    );
    const start = round(clamp(center - targetDuration / 2, 0, durationSeconds));
    const end = round(clamp(start + targetDuration, start + minCandidateDurationSeconds, durationSeconds));
    const usageMode: MicroclipUsageMode =
      score >= 0.78
        ? "impact_moment"
        : scene >= audio
          ? "quick_reference"
          : "supporting_evidence";
    const reasons = [
      motion > 0.45 ? `motion ${motion.toFixed(2)}` : null,
      audio > 0.45 ? `audio peak ${audio.toFixed(2)}` : null,
      scene > 0.45 ? `scene change ${scene.toFixed(2)}` : null,
      presetBoost ? `preset ${preset}` : null
    ].filter((item): item is string => Boolean(item));

    candidates.push({
      id: buildCandidateId(input.assetId, start, end),
      assetId: input.assetId,
      startTimeSeconds: start,
      endTimeSeconds: end,
      durationSeconds: round(end - start),
      score: round(score),
      reasons: reasons.length ? reasons : ["balanced local signal"],
      usageMode,
      recommendedTextOverlay: candidateTextOverlay(score, usageMode, useCase),
      recommendedTransitionIn: score > 0.76 ? "flash" : "cut",
      recommendedTransitionOut: score > 0.84 ? "whoosh" : "cut",
      recommendedVolumeMode: audio > 0.68 ? "low_original" : "mute_original"
    });
  }

  return candidates;
}

export function mergeNearbyCandidates(candidates: MicroclipCandidate[]) {
  const sorted = [...candidates].sort(
    (left, right) => left.startTimeSeconds - right.startTimeSeconds
  );
  const merged: MicroclipCandidate[] = [];

  for (const candidate of sorted) {
    const previous = merged.at(-1);

    if (
      previous &&
      candidate.startTimeSeconds - previous.endTimeSeconds < 0.25
    ) {
      if (candidate.score > previous.score) {
        merged[merged.length - 1] = candidate;
      }

      continue;
    }

    merged.push(candidate);
  }

  return merged;
}

export function rankMicroclipCandidates(candidates: MicroclipCandidate[]) {
  return [...candidates].sort(
    (left, right) =>
      right.score - left.score ||
      left.startTimeSeconds - right.startTimeSeconds
  );
}

export function buildMicroclipSuggestions(input: AnalyzeVideoForMicroclipsInput) {
  const topN = normalizeTopN(input.topN);
  return rankMicroclipCandidates(
    mergeNearbyCandidates(scoreMicroclipCandidates(input))
  ).slice(0, topN);
}

export function analyzeVideoForMicroclips(
  input: AnalyzeVideoForMicroclipsInput
): AnalyzeVideoForMicroclipsResult {
  const warnings: string[] = [];

  if (!input.assetId.trim()) {
    warnings.push("assetId is empty.");
  }

  if (!Number.isFinite(input.durationSeconds) || input.durationSeconds <= 0) {
    warnings.push("Video duration is missing; using a short fallback analysis window.");
  }

  const durationSeconds =
    Number.isFinite(input.durationSeconds) && input.durationSeconds > 0
      ? round(input.durationSeconds)
      : 8;
  const targetDurationSeconds = normalizeTargetDuration(input.targetDurationSeconds);
  const candidates = buildMicroclipSuggestions({
    ...input,
    durationSeconds,
    targetDurationSeconds
  });

  if (candidates.length > 2) {
    warnings.push("Review suggestions manually; ReelForge will not auto-apply more than 2 microclips per project.");
  }

  return {
    assetId: input.assetId,
    durationSeconds,
    targetDurationSeconds,
    candidates,
    warnings
  };
}
