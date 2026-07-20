import type { ComicArcScriptBeat } from "./comic-arc-script-doctor-v2.js";
import type { ComicArcVisualDirection } from "./comic-arc-visual-director.js";

export type ComicBeatTimingEventType =
  | "visual_hold"
  | "caption_in"
  | "camera_move"
  | "sfx_hit"
  | "impact_punch"
  | "caption_out"
  | "micro_pause";

export type ComicBeatTimingEvent = {
  type: ComicBeatTimingEventType;
  startSeconds: number;
  durationSeconds: number;
  intensity: number;
  instruction: string;
};

export type ComicBeatTimingScenePlan = {
  sceneOrder: number;
  panelId: string;
  beatRole: ComicArcScriptBeat["role"];
  durationSeconds: number;
  cutStyle: "hard_cut" | "flash_cut" | "whoosh_cut" | "hold_reveal" | "page_tear";
  maxVisualHoldSeconds: number;
  openingHoldSeconds: number;
  captionInSeconds: number;
  punchMomentSeconds: number;
  exitCutSeconds: number;
  events: ComicBeatTimingEvent[];
  pacingScore: number;
  warnings: string[];
};

export type ComicBeatTimingPlan = {
  plannerId: "comic_beat_timing_plan_v1";
  sceneCount: number;
  totalDurationSeconds: number;
  averagePacingScore: number;
  scenes: ComicBeatTimingScenePlan[];
  warnings: string[];
};

function round(value: number) {
  return Math.round(value * 100) / 100;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function cutStyleFor(beat: ComicArcScriptBeat, visual?: ComicArcVisualDirection): ComicBeatTimingScenePlan["cutStyle"] {
  if (beat.role === "hook" || beat.role === "climax") return "page_tear";
  if (beat.role === "tension" || visual?.primaryTarget === "duo_conflict") return "page_tear";
  if (beat.role === "payoff") return "hold_reveal";
  return "page_tear";
}

function scoreScene(input: { beat: ComicArcScriptBeat; visual?: ComicArcVisualDirection | undefined; durationSeconds: number; events: ComicBeatTimingEvent[] }) {
  let score = 66;
  if (input.durationSeconds >= 3 && input.durationSeconds <= 9) score += 8;
  if (input.visual?.panelNarrationAlignmentScore) score += Math.round(input.visual.panelNarrationAlignmentScore / 8);
  if (input.visual?.selectedEvidenceRegion?.confidence) score += Math.round(input.visual.selectedEvidenceRegion.confidence / 12);
  if (input.events.some((event) => event.type === "caption_in")) score += 5;
  if (input.events.some((event) => event.type === "camera_move")) score += 5;
  if ((input.beat.role === "hook" || input.beat.role === "climax") && input.events.some((event) => event.type === "impact_punch" || event.type === "sfx_hit")) score += 8;
  if (input.visual?.visualEvidenceMap?.layoutMap.captionRisk === "high") score -= 10;
  return clamp(Math.round(score), 0, 100);
}

export function buildComicBeatTimingPlan(input: {
  beats: ComicArcScriptBeat[];
  durations: number[];
  visualDirections: ComicArcVisualDirection[];
}): ComicBeatTimingPlan {
  const scenes = input.beats.map((beat, index) => {
    const durationSeconds = Math.max(4, input.durations[index] ?? 6);
    const maxVisualHoldSeconds = 4;
    const visual = input.visualDirections.find((direction) => direction.panelId === beat.panelId && direction.beatRole === beat.role);
    const openingHoldSeconds = round(clamp(durationSeconds * (beat.role === "hook" ? 0.08 : 0.12), 0.35, 0.9));
    const captionInSeconds = round(clamp(openingHoldSeconds + 0.12, 0.35, 1.2));
    const punchMomentSeconds = round(clamp(
      beat.role === "hook" ? durationSeconds * 0.42 : beat.role === "climax" ? durationSeconds * 0.5 : durationSeconds * 0.62,
      1.2,
      Math.max(1.4, durationSeconds - 1.2)
    ));
    const exitCutSeconds = round(Math.max(0.2, durationSeconds - 0.32));
    const events: ComicBeatTimingEvent[] = [
      {
        type: "visual_hold",
        startSeconds: 0,
        durationSeconds: openingHoldSeconds,
        intensity: beat.role === "hook" ? 8 : 5,
        instruction: "Segurar o painel o bastante para o olho entender o contexto antes do movimento."
      },
      {
        type: "caption_in",
        startSeconds: captionInSeconds,
        durationSeconds: 0.32,
        intensity: beat.role === "hook" || beat.role === "climax" ? 9 : 7,
        instruction: `Entrada da legenda em ${visual?.captionSafeZone ?? "lower-third"}; evitar cobrir balao/regiao protegida.`
      },
      {
        type: "camera_move",
        startSeconds: round(captionInSeconds + 0.15),
        durationSeconds: round(Math.max(1.6, durationSeconds - captionInSeconds - 1.05)),
        intensity: visual?.motionIntensity ?? 6,
        instruction: `${visual?.cameraMove ?? "context_slow_push"}; anchored_zoom_no_shake; max_visual_hold=${maxVisualHoldSeconds}s; anchor=${visual?.anchorPoint.x ?? 0.5},${visual?.anchorPoint.y ?? 0.5}; scale=${visual?.startScale ?? 1.02}->${visual?.endScale ?? 1.1}.`
      },
      {
        type: "caption_out",
        startSeconds: exitCutSeconds,
        durationSeconds: 0.2,
        intensity: 5,
        instruction: "Fechar legenda antes do corte para nao embolar com a proxima cena."
      }
    ];

    if (beat.role === "hook" || beat.role === "climax" || visual?.primaryTarget === "impact_zone") {
      events.push({
        type: "impact_punch",
        startSeconds: punchMomentSeconds,
        durationSeconds: 0.22,
        intensity: 10,
        instruction: "Punch zoom curto no frame de impacto; sem shake; usar rasgo de pagina/flash curto se for climax/hook."
      });
      events.push({
        type: "sfx_hit",
        startSeconds: round(Math.max(0, punchMomentSeconds - 0.03)),
        durationSeconds: 0.35,
        intensity: 9,
        instruction: "SFX pontual sincronizado com golpe/virada; nao cobrir palavra importante da narracao."
      });
    }

    if (beat.delivery.pauseAfterMs >= 180 || beat.role === "payoff") {
      events.push({
        type: "micro_pause",
        startSeconds: round(Math.max(0.5, durationSeconds - 0.75)),
        durationSeconds: round(clamp(beat.delivery.pauseAfterMs / 1000, 0.18, 0.55)),
        intensity: beat.role === "payoff" ? 7 : 5,
        instruction: "Micro pausa para a frase respirar antes do proximo corte."
      });
    }

    events.sort((left, right) => left.startSeconds - right.startSeconds);
    const warnings: string[] = [];
    if ((visual?.panelNarrationAlignmentScore ?? 0) < 72) warnings.push("timing_visual_alignment_low");
    if (durationSeconds > maxVisualHoldSeconds) warnings.push(`scene_requires_internal_visual_refresh_every_${maxVisualHoldSeconds}s`);
    if (visual?.visualEvidenceMap?.layoutMap.captionRisk === "high") warnings.push("caption_timing_risk_high");
    const pacingScore = scoreScene({ beat, visual, durationSeconds, events });
    if (pacingScore < 76) warnings.push(`pacing_score_low:${pacingScore}`);

    return {
      sceneOrder: index + 1,
      panelId: beat.panelId,
      beatRole: beat.role,
      durationSeconds,
      cutStyle: cutStyleFor(beat, visual),
      maxVisualHoldSeconds,
      openingHoldSeconds,
      captionInSeconds,
      punchMomentSeconds,
      exitCutSeconds,
      events,
      pacingScore,
      warnings
    };
  });

  const totalDurationSeconds = scenes.reduce((sum, scene) => sum + scene.durationSeconds, 0);
  const averagePacingScore = scenes.length
    ? Math.round(scenes.reduce((sum, scene) => sum + scene.pacingScore, 0) / scenes.length)
    : 0;
  return {
    plannerId: "comic_beat_timing_plan_v1",
    sceneCount: scenes.length,
    totalDurationSeconds,
    averagePacingScore,
    scenes,
    warnings: scenes.flatMap((scene) => scene.warnings.map((warning) => `scene_${scene.sceneOrder}:${scene.panelId}:${warning}`))
  };
}

