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
    const impactScore = clampScore(
      72 +
        beat.delivery.emphasisWords.length * 4 +
        (timing?.pacingScore ?? 75) * 0.15 +
        (captionRisk === "low" ? 8 : captionRisk === "medium" ? 2 : -10) -
        (tooLong ? 10 : 0)
    );
    const cueWarnings = [
      ...(tooLong ? ["caption_too_long_for_punch"] : []),
      ...(captionRisk === "high" ? ["caption_zone_risky_over_text"] : [])
    ];
    return {
      sceneOrder: index + 1,
      panelId: beat.panelId,
      beatRole: beat.role,
      text,
      emphasisWords: beat.delivery.emphasisWords.slice(0, 4),
      startSeconds: timing?.captionInSeconds ?? 0.2,
      endSeconds: Math.max(timing?.exitCutSeconds ?? 2.8, (timing?.captionInSeconds ?? 0.2) + 1.2),
      animation: animationFor(beat.role),
      colorMood: colorFor(beat.role),
      safeZone,
      impactScore,
      warnings: cueWarnings
    };
  });
  const averageImpactScore = cues.length ? Math.round(cues.reduce((sum, cue) => sum + cue.impactScore, 0) / cues.length) : 0;
  if (averageImpactScore < 82) warnings.push(`caption_impact_average_low:${averageImpactScore}`);
  if (cues.some((cue) => cue.warnings.includes("caption_zone_risky_over_text"))) warnings.push("caption_impact_has_zone_risk");
  return {
    directorId: "comic_caption_impact_director_v1",
    cueCount: cues.length,
    averageImpactScore,
    cues,
    warnings
  };
}
