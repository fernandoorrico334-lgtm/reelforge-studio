import type { CaptionDirectionInput, CaptionDirectionResult } from "./caption-direction-engine.js";
import { generateCaptionDirection } from "./caption-direction-engine.js";
import type { NarrationBeatDraft } from "./narration-curiosity-engine.js";
import {
  oralizeActionLabelsInNarration,
  oralizeNarrationBeats
} from "./narration-action-oralization.js";
import type { RetentionBeatMetadata } from "./narration-retention-engine.js";
import type { NarrationRetentionSubject } from "./narration-retention-packs.js";
import { RETENTION_BEAT_TIMINGS } from "./narration-retention-packs.js";
import type { TruthGuardResult } from "./narration-truth-guard.js";
import { validateNarrationTruth } from "./narration-truth-guard.js";
import { sanitizeNarrationForSpeech } from "./narration-pad-sanitizer.js";
import type { RemixTargetStyle } from "./remix-types.js";
import type { SpeechTimingBeat, SpeechTimingResult } from "./speech-timing-optimizer.js";
import {
  estimateSpeechDurationPtBr,
  optimizeSpeechTiming
} from "./speech-timing-optimizer.js";

export type NarrationUpgradesInput = {
  beats: RetentionBeatMetadata[];
  script: string;
  facts: string[];
  topic?: string;
  visualDescription?: string;
  allowedContext?: string[];
  targetDurationSec: number;
  subjectCategory?: NarrationRetentionSubject;
  truthStrictness?: "low" | "medium" | "high";
  captionStyle?: CaptionDirectionInput["style"];
  targetStyle?: RemixTargetStyle;
};

export type NarrationUpgradesResult = {
  finalScript: string;
  beats: RetentionBeatMetadata[];
  truthGuard: TruthGuardResult;
  speechTiming: SpeechTimingResult;
  captionDirection: CaptionDirectionResult;
  warnings: string[];
};

export type PartialLegacyUpgradesInput = {
  legacyBeats: NarrationBeatDraft[];
  legacyScript: string;
  facts: string[];
  topic?: string;
  visualDescription?: string;
  allowedContext?: string[];
  targetDurationSec: number;
  subjectCategory?: NarrationRetentionSubject;
  truthStrictness?: "low" | "medium" | "high";
  captionStyle?: CaptionDirectionInput["style"];
  targetStyle?: RemixTargetStyle;
};

export type PartialLegacyUpgradesResult = {
  narrationBeats: NarrationBeatDraft[];
  finalScript: string;
  truthGuard: TruthGuardResult;
  speechTiming: SpeechTimingResult;
  captionDirection: CaptionDirectionResult;
  warnings: string[];
};

function subjectToCaptionStyle(
  subject?: NarrationRetentionSubject
): NonNullable<CaptionDirectionInput["style"]> {
  const map: Partial<Record<NarrationRetentionSubject, NonNullable<CaptionDirectionInput["style"]>>> = {
    juridico_bancario: "legal",
    misterio_terror: "dark",
    tecnologia_ia: "tech",
    comics_anime_filmes: "viral",
    historia_curiosidades: "documentary",
    produto_review: "premium",
    noticia_polemica: "documentary",
    generico: "premium"
  };
  return map[subject ?? "generico"] ?? "premium";
}

function emotionFromRetention(emotion: string): "curious" | "tense" | "excited" | "serious" | "surprised" {
  const lower = emotion.toLowerCase();
  if (lower.includes("suspen") || lower.includes("sombri")) return "tense";
  if (lower.includes("entus") || lower.includes("rápid")) return "excited";
  if (lower.includes("document") || lower.includes("segur")) return "serious";
  if (lower.includes("revel")) return "surprised";
  return "curious";
}

function paceFromRetention(pace: RetentionBeatMetadata["pace"]): "slow" | "normal" | "fast" {
  if (pace === "slow") return "slow";
  if (pace === "fast") return "fast";
  return "normal";
}

function retentionToTimingBeats(beats: RetentionBeatMetadata[]): SpeechTimingBeat[] {
  return beats.map((beat, index) => ({
    id: `${beat.role}-${index}`,
    role: beat.role,
    text: beat.text,
    timing: beat.timing,
    pace: paceFromRetention(beat.pace),
    pauseAfterMs: beat.pauseAfterMs
  }));
}

function applyTimingToRetention(
  retentionBeats: RetentionBeatMetadata[],
  timingBeats: SpeechTimingBeat[]
): RetentionBeatMetadata[] {
  return retentionBeats.map((beat, index) => {
    const timed = timingBeats.find((b) => b.role === beat.role && b.id === `${beat.role}-${index}`) ??
      timingBeats.find((b) => b.role === beat.role);
    if (!timed) return beat;
    return {
      ...beat,
      text: timed.text,
      pauseAfterMs: timed.pauseAfterMs ?? beat.pauseAfterMs,
      pace: timed.pace === "slow" ? "slow" : timed.pace === "fast" ? "fast" : "medium"
    };
  });
}

function distributeSanitizedScript(
  beats: RetentionBeatMetadata[],
  sanitizedScript: string
): RetentionBeatMetadata[] {
  const lines = sanitizedScript.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return beats;

  return beats.map((beat, index) => ({
    ...beat,
    text: lines[index] ?? beat.text
  }));
}

function legacyToRetentionBeats(legacyBeats: NarrationBeatDraft[]): RetentionBeatMetadata[] {
  const byRole = new Map(legacyBeats.map((beat) => [beat.role, beat]));
  const tension = byRole.get("tension")?.text ?? "";
  const context = byRole.get("context")?.text ?? "";
  const tensionSentences = tension.split(/(?<=[.!?])\s+/).filter(Boolean);

  const sourceByRetention: Record<RetentionBeatMetadata["role"], string> = {
    hook: byRole.get("hook")?.text ?? "",
    promise_context: context,
    curiosity: tensionSentences[0] ?? (tension || context),
    development: tensionSentences.slice(1).join(" ") || context,
    climax_reveal: byRole.get("climax")?.text ?? "",
    loop_closing: byRole.get("cta")?.text ?? ""
  };

  return (Object.keys(RETENTION_BEAT_TIMINGS) as RetentionBeatMetadata["role"][]).map((role) => {
    const timing = RETENTION_BEAT_TIMINGS[role];
    const text = oralizeActionLabelsInNarration(sourceByRetention[role] || legacyBeats[0]?.text || "");
    return {
      role,
      text,
      emotion: "curioso, conversacional",
      pace: "medium" as const,
      pauseAfterMs: role === "hook" ? 120 : role === "loop_closing" ? 180 : 220,
      emphasisWords: text
        .split(/\s+/)
        .filter((word) => /^[A-ZÀ-Ú]/.test(word))
        .slice(0, 4)
        .map((word) => word.replace(/[,.!?;:]/g, "")),
      captionWords: text.split(/\s+/).slice(0, 7).map((word) => word.replace(/[,.!?;:]/g, "")),
      visualCue: "sincronizar com visual",
      retentionGoal: timing.retentionGoal,
      timing: { startSec: timing.startSec, endSec: timing.endSec }
    };
  });
}

function retentionToLegacyBeats(
  retentionBeats: RetentionBeatMetadata[],
  legacyBeats: NarrationBeatDraft[]
): NarrationBeatDraft[] {
  const curiosity = retentionBeats.find((beat) => beat.role === "curiosity")?.text ?? "";
  const development = retentionBeats.find((beat) => beat.role === "development")?.text ?? "";
  const mergedTension = [curiosity, development].filter(Boolean).join(" ").trim();
  const roleText: Partial<Record<NarrationBeatDraft["role"], string>> = {};
  const hookText = retentionBeats.find((beat) => beat.role === "hook")?.text;
  const contextText = retentionBeats.find((beat) => beat.role === "promise_context")?.text;
  const climaxText = retentionBeats.find((beat) => beat.role === "climax_reveal")?.text;
  const ctaText = retentionBeats.find((beat) => beat.role === "loop_closing")?.text;
  if (hookText) roleText.hook = hookText;
  if (contextText) roleText.context = contextText;
  if (mergedTension) roleText.tension = mergedTension;
  if (climaxText) roleText.climax = climaxText;
  if (ctaText) roleText.cta = ctaText;

  const order: NarrationBeatDraft["role"][] = ["hook", "context", "tension", "climax", "cta"];
  const legacyByRole = new Map(legacyBeats.map((beat) => [beat.role, beat]));

  return order
    .filter((role) => Boolean(roleText[role]?.trim()))
    .map((role) => {
      const text = roleText[role]!.trim();
      const legacy = legacyByRole.get(role);
      return {
        role,
        text,
        caption: legacy?.caption ?? text.split(/\s+/).slice(0, 7).join(" "),
        curiosityTag: legacy?.curiosityTag ?? `legacy-${role}`,
        ...(legacy?.prosody ? { prosody: legacy.prosody } : {})
      };
    });
}

export function applyPartialUpgradesOnLegacy(
  input: PartialLegacyUpgradesInput
): PartialLegacyUpgradesResult {
  const oralizedLegacyBeats = oralizeNarrationBeats(input.legacyBeats);
  const oralizedScript = oralizeActionLabelsInNarration(input.legacyScript);
  const retentionBeats = legacyToRetentionBeats(oralizedLegacyBeats);

  const upgrades = applyNarrationUpgrades({
    beats: retentionBeats,
    script: oralizedScript,
    facts: input.facts,
    ...(input.topic ? { topic: input.topic } : {}),
    ...(input.visualDescription ? { visualDescription: input.visualDescription } : {}),
    ...(input.allowedContext ? { allowedContext: input.allowedContext } : {}),
    targetDurationSec: input.targetDurationSec,
    ...(input.subjectCategory ? { subjectCategory: input.subjectCategory } : {}),
    truthStrictness: input.truthStrictness ?? "medium",
    ...(input.captionStyle ? { captionStyle: input.captionStyle } : {}),
    ...(input.targetStyle ? { targetStyle: input.targetStyle } : {})
  });

  const narrationBeats = retentionToLegacyBeats(upgrades.beats, oralizedLegacyBeats);

  return {
    narrationBeats,
    finalScript: narrationBeats.map((beat) => beat.text).join("\n"),
    truthGuard: upgrades.truthGuard,
    speechTiming: upgrades.speechTiming,
    captionDirection: upgrades.captionDirection,
    warnings: upgrades.warnings
  };
}

export function applyNarrationUpgrades(input: NarrationUpgradesInput): NarrationUpgradesResult {
  const warnings: string[] = [];
  let beats = oralizeNarrationBeats(input.beats);
  let script = oralizeActionLabelsInNarration(input.script);

  const truthGuard = validateNarrationTruth({
    facts: input.facts,
    generatedScript: script,
    ...(input.topic ? { topic: input.topic } : {}),
    ...(input.visualDescription ? { visualDescription: input.visualDescription } : {}),
    ...(input.allowedContext ? { allowedContext: input.allowedContext } : {}),
    strictness: input.truthStrictness ?? "medium"
  });

  if (!truthGuard.ok || truthGuard.sanitizedScript !== script) {
    script = truthGuard.sanitizedScript;
    beats = distributeSanitizedScript(beats, script);
    warnings.push(
      ...truthGuard.removedOrSoftenedClaims.map((entry) => `truth_guard: ${entry}`)
    );
  }

  if (truthGuard.score < 60) {
    warnings.push(`truth_guard_score_baixo: ${truthGuard.score}`);
  }

  const timingResult = optimizeSpeechTiming({
    beats: retentionToTimingBeats(beats),
    targetDurationSec: input.targetDurationSec,
    wpm: 155,
    allowCompression: true,
    allowExpansion: true,
    authorizedFacts: input.facts,
    ...(input.targetStyle ? { targetStyle: input.targetStyle } : {})
  });

  beats = applyTimingToRetention(beats, timingResult.beats);
  beats = beats.map((beat) => ({
    ...beat,
    text: sanitizeNarrationForSpeech(beat.text)
  }));
  script = sanitizeNarrationForSpeech(beats.map((beat) => beat.text).join("\n"));
  warnings.push(...timingResult.warnings);

  if (!timingResult.ok) {
    warnings.push(
      `timing_diff: ${timingResult.differenceSec}s (alvo ${input.targetDurationSec}s)`
    );
  }

  const captionStyle =
    input.captionStyle ?? subjectToCaptionStyle(input.subjectCategory);

  const captionDirection = generateCaptionDirection({
    style: captionStyle,
    beats: beats.map((beat, index) => ({
      id: `${beat.role}-${index}`,
      text: beat.text,
      emotion: emotionFromRetention(beat.emotion),
      pace: paceFromRetention(beat.pace),
      pauseAfterMs: beat.pauseAfterMs,
      emphasisWords: beat.emphasisWords,
      captionWords: beat.captionWords,
      visualCue: beat.visualCue,
      retentionGoal: beat.retentionGoal,
      timing: beat.timing
    })),
    maxWordsOnScreen: 7
  });

  warnings.push(...captionDirection.warnings);

  return {
    finalScript: script,
    beats,
    truthGuard,
    speechTiming: timingResult,
    captionDirection,
    warnings
  };
}

export { estimateSpeechDurationPtBr };