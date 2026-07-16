import type { ComicArcScriptBeat } from "./comic-arc-script-doctor-v2.js";
import type { ComicBeatTimingPlan } from "./comic-beat-timing-plan.js";
import type { ComicArcVisualDirection } from "./comic-arc-visual-director.js";

export type ComicCaptionImpactCue = {
  sceneOrder: number;
  panelId: string;
  beatRole: string;
  text: string;
  emphasisWords: string[];
  startSeconds: number;
  endSeconds: number;
  animation: "pop" | "shake" | "slam" | "type_on" | "glow_hold";
  colorMood: "yellow" | "red" | "cyan" | "white";
  safeZone: string;
  wordCues: Array<{
    word: string;
    startSeconds: number;
    endSeconds: number;
    emphasis: "normal" | "strong" | "impact";
    animation: "none" | "pop" | "shake" | "glow";
  }>;
  renderStyle: {
    fontWeight: "bold" | "black";
    stroke: boolean;
    shadow: boolean;
    maxLines: number;
  };
  impactScore: number;
  warnings: string[];
};

export type ComicCaptionImpactPlan = {
  directorId: "comic_caption_impact_director_v1";
  cueCount: number;
  averageImpactScore: number;
  cues: ComicCaptionImpactCue[];
  warnings: string[];
};

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function compactCaption(text: string) {
  const clean = text.replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
  const words = clean.split(/\s+/).filter(Boolean);
  return words.slice(0, 5).join(" ").toUpperCase();
}

function animationFor(role: string) {
  if (role === "hook") return "slam" as const;
  if (role === "climax") return "shake" as const;
  if (role === "tension") return "pop" as const;
  if (role === "payoff") return "glow_hold" as const;
  return "type_on" as const;
}

function colorFor(role: string) {
  if (role === "hook" || role === "climax") return "yellow" as const;
  if (role === "tension") return "red" as const;
  if (role === "payoff") return "cyan" as const;
  return "white" as const;
}

function normalizeWord(word: string) {
  return word.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function buildWordCues(input: { text: string; startSeconds: number; endSeconds: number; emphasisWords: string[]; role: string }) {
  const words = input.text.split(/\s+/).filter(Boolean);
  const duration = Math.max(0.6, input.endSeconds - input.startSeconds);
  const step = duration / Math.max(1, words.length);
  const emphasis = new Set(input.emphasisWords.map(normalizeWord));
  return words.map((word, index) => {
    const normalized = normalizeWord(word);
    const strong = emphasis.has(normalized) || /IMPACTO|VIRADA|ABSURDO|CONTRA|AMEACA|ESCALA/.test(word);
    const isImpact = strong && (input.role === "hook" || input.role === "climax");
    return {
      word,
      startSeconds: Number((input.startSeconds + index * step).toFixed(2)),
      endSeconds: Number((input.startSeconds + (index + 1) * step).toFixed(2)),
      emphasis: isImpact ? "impact" as const : strong ? "strong" as const : "normal" as const,
      animation: isImpact ? "shake" as const : strong ? "pop" as const : "none" as const
    };
  });
}

function renderStyleFor(role: string) {
  return {
    fontWeight: role === "hook" || role === "climax" ? "black" as const : "bold" as const,
    stroke: true,
    shadow: true,
    maxLines: role === "hook" || role === "climax" ? 2 : 1
  };
}

export function buildComicCaptionImpactPlan(input: {
  beats: ComicArcScriptBeat[];
  timingPlan: ComicBeatTimingPlan;
  visualDirections: ComicArcVisualDirection[];
}): ComicCaptionImpactPlan {
  const warnings: string[] = [];
  const cues = input.beats.map((beat, index) => {
    const timing = input.timingPlan.scenes.find((scene) => scene.panelId === beat.panelId && scene.beatRole === beat.role);
    const visual = input.visualDirections.find((scene) => scene.panelId === beat.panelId && scene.beatRole === beat.role);
    const text = compactCaption(beat.captionText || beat.narrationText);
    const tooLong = text.split(/\s+/).length > 5;
    const safeZone = visual?.captionSafeZone ?? "lower-third";
    const captionRisk = visual?.visualEvidenceMap?.layoutMap.captionRisk ?? "unknown";
    const startSeconds = timing?.captionInSeconds ?? 0.2;
    const endSeconds = Math.max(timing?.exitCutSeconds ?? 2.8, startSeconds + 1.2);
    const emphasisWords = beat.delivery.emphasisWords.slice(0, 4);
    const wordCues = buildWordCues({ text, startSeconds, endSeconds, emphasisWords, role: beat.role });
    const impactWordBonus = wordCues.some((cue) => cue.emphasis === "impact") ? 6 : wordCues.some((cue) => cue.emphasis === "strong") ? 3 : 0;
    const impactScore = clampScore(
      72 +
        emphasisWords.length * 4 +
        (timing?.pacingScore ?? 75) * 0.15 +
        (captionRisk === "low" ? 8 : captionRisk === "medium" ? 2 : -10) +
        impactWordBonus -
        (tooLong ? 10 : 0)
    );
    const cueWarnings = [
      ...(tooLong ? ["caption_too_long_for_punch"] : []),
      ...(captionRisk === "high" ? ["caption_zone_risky_over_text"] : []),
      ...(wordCues.length === 0 ? ["caption_has_no_word_cues"] : [])
    ];
    return {
      sceneOrder: index + 1,
      panelId: beat.panelId,
      beatRole: beat.role,
      text,
      emphasisWords,
      startSeconds,
      endSeconds,
      animation: animationFor(beat.role),
      colorMood: colorFor(beat.role),
      safeZone,
      wordCues,
      renderStyle: renderStyleFor(beat.role),
      impactScore,
      warnings: cueWarnings
    };
  });
  const averageImpactScore = cues.length ? Math.round(cues.reduce((sum, cue) => sum + cue.impactScore, 0) / cues.length) : 0;
  if (averageImpactScore < 82) warnings.push(`caption_impact_average_low:${averageImpactScore}`);
  if (cues.some((cue) => cue.warnings.includes("caption_zone_risky_over_text"))) warnings.push("caption_impact_has_zone_risk");
  if (cues.some((cue) => cue.wordCues.length === 0)) warnings.push("caption_word_cues_missing");
  return {
    directorId: "comic_caption_impact_director_v1",
    cueCount: cues.length,
    averageImpactScore,
    cues,
    warnings
  };
}
