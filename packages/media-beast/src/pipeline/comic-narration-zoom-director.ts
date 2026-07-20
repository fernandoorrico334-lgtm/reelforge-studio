import type {
  ComicPanelBox,
  ComicPanelShot,
  ComicShotCameraMove,
} from "./comic-panel-shot-director.js";

export type ComicNarrationFocusKind =
  | "character"
  | "dialogue"
  | "object"
  | "action"
  | "environment"
  | "group"
  | "context";

export type ComicNarrationFocusCue = {
  cueId: string;
  text: string;
  focusTarget?: string | null;
  hasDialogue?: boolean | undefined;
  hasImpact?: boolean | undefined;
  verifiedFocusTargets?: string[] | null | undefined;
  evidenceWarnings?: string[] | undefined;
};

export type ComicNarrationZoomDecision = {
  shotId: string;
  cueId: string | null;
  focusKind: ComicNarrationFocusKind;
  focusTarget: string | null;
  confidence: number;
  aggressiveZoomAllowed: boolean;
  cameraMove: ComicShotCameraMove;
  zoomIntensity: number;
  focusPoint: { x: number; y: number } | null;
  reason: string;
  targetVerified: boolean;
};

export type ComicNarrationZoomPlan = {
  directorId: "comic_narration_zoom_director_v1";
  decisionCount: number;
  aggressiveZoomCount: number;
  safeWideCount: number;
  unsafeAggressiveZoomCount: number;
  decisions: ComicNarrationZoomDecision[];
  warnings: string[];
};

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function containsAny(text: string, values: string[]) {
  return values.some((value) => text.includes(value));
}

export function inferComicNarrationFocus(input: {
  text: string;
  explicitTarget?: string | null | undefined;
  hasDialogue?: boolean | undefined;
  hasImpact?: boolean | undefined;
}): { kind: ComicNarrationFocusKind; target: string | null; baseConfidence: number } {
  if (input.explicitTarget) {
    return { kind: "object", target: input.explicitTarget, baseConfidence: 100 };
  }

  const text = normalize(input.text);
  const objects = ["caixa materna", "portal", "anel", "arma", "barreira", "fortaleza"];
  const actions = ["atac", "golpe", "colid", "explod", "rasg", "caiu", "empurr", "voando", "batalha"];
  const characters = ["superman", "clark", "lois", "lex", "godzila", "godzilla", "kong", "mutano", "flash", "lanterna"];
  const environments = ["oceano", "cidade", "metropolis", "ilha", "ceu", "ruas", "profundezas"];

  const object = objects.find((value) => text.includes(value));
  if (object) return { kind: "object", target: object.replaceAll(" ", "_"), baseConfidence: 72 };
  if (input.hasImpact || containsAny(text, actions)) return { kind: "action", target: null, baseConfidence: 68 };
  const character = characters.find((value) => text.includes(value));
  if (character) return { kind: "character", target: character, baseConfidence: 64 };
  if (input.hasDialogue) return { kind: "dialogue", target: null, baseConfidence: 60 };
  if (containsAny(text, environments)) return { kind: "environment", target: null, baseConfidence: 58 };
  if (containsAny(text, ["liga", "herois", "viloes", "todos", "equipe"])) {
    return { kind: "group", target: null, baseConfidence: 56 };
  }
  return { kind: "context", target: null, baseConfidence: 48 };
}

export function resolveCropRelativeFocus(input: {
  crop: ComicPanelBox;
  absolutePoint?: { x: number; y: number } | null;
}) {
  if (!input.absolutePoint) return { x: 0.5, y: 0.5 };
  return {
    x: Math.max(0.08, Math.min(0.92, (input.absolutePoint.x - input.crop.x) / Math.max(0.01, input.crop.width))),
    y: Math.max(0.08, Math.min(0.92, (input.absolutePoint.y - input.crop.y) / Math.max(0.01, input.crop.height))),
  };
}

export function buildComicNarrationZoomPlan(input: {
  cues: ComicNarrationFocusCue[];
  shots: ComicPanelShot[];
}): ComicNarrationZoomPlan {
  const cueMap = new Map(input.cues.map((cue) => [cue.cueId, cue]));
  const decisions: ComicNarrationZoomDecision[] = [];
  const warnings: string[] = [];

  for (const shot of input.shots) {
    const cue = shot.beatIndex >= 0 ? input.cues[shot.beatIndex] ?? null : null;
    const focus = inferComicNarrationFocus({
      text: cue?.text ?? "",
      explicitTarget: cue?.focusTarget,
      hasDialogue: cue?.hasDialogue,
      hasImpact: cue?.hasImpact,
    });
    const hasSemanticAnchor = Boolean(shot.speakerAnchor) && shot.semanticAssociationConfidence >= 65;
    const explicitObject = Boolean(cue?.focusTarget);
    const normalizedExplicitTarget = cue?.focusTarget ? normalize(cue.focusTarget).replace(/[^a-z0-9]+/g, "_") : null;
    const targetVerified = !explicitObject || cue?.verifiedFocusTargets == null || cue.verifiedFocusTargets
      .map((target) => normalize(target).replace(/[^a-z0-9]+/g, "_"))
      .includes(normalizedExplicitTarget!);
    const verifiedExplicitObject = explicitObject && targetVerified;
    const actionIsClear = focus.kind === "action" && shot.confidence >= 75;
    const aggressiveZoomAllowed = verifiedExplicitObject || (!explicitObject && (hasSemanticAnchor || actionIsClear));
    const confidence = Math.min(100, Math.round(
      focus.baseConfidence * 0.45 +
      shot.confidence * 0.25 +
      (verifiedExplicitObject ? 30 : hasSemanticAnchor ? 22 : actionIsClear ? 14 : 0),
    ));

    let cameraMove: ComicShotCameraMove = "slow_push";
    let reason = "safe_wide_fallback_no_confirmed_target";
    let zoomIntensity = 0.035;
    if (verifiedExplicitObject) {
      cameraMove = "impact_snap";
      reason = "verified_explicit_visual_target";
      zoomIntensity = 0.1;
    } else if (explicitObject) {
      cameraMove = "slow_push";
      reason = "safe_wide_fallback_unverified_named_target";
      zoomIntensity = 0.025;
    } else if (hasSemanticAnchor && (focus.kind === "dialogue" || focus.kind === "character")) {
      cameraMove = focus.kind === "dialogue" ? "dialogue_push" : "reaction_push";
      reason = "balloon_speaker_anchor";
      zoomIntensity = 0.065;
    } else if (actionIsClear) {
      cameraMove = shot.shotRole === "impact" ? "impact_snap" : "action_pan";
      reason = "high_confidence_action_panel";
      zoomIntensity = shot.shotRole === "impact" ? 0.09 : 0.06;
    } else if (shot.shotRole === "payoff" && shot.confidence >= 70) {
      cameraMove = "payoff_hold";
      reason = "high_confidence_payoff";
      zoomIntensity = 0.045;
    }

    decisions.push({
      shotId: shot.shotId,
      cueId: cue?.cueId ?? null,
      focusKind: focus.kind,
      focusTarget: focus.target,
      confidence,
      aggressiveZoomAllowed,
      cameraMove,
      zoomIntensity,
      focusPoint: shot.speakerAnchor,
      reason,
      targetVerified,
    });
    if (!targetVerified && cue?.focusTarget) warnings.push("named_visual_target_unverified:" + cue.focusTarget + ":" + shot.shotId);
  }

  const unsafeAggressiveZoomCount = decisions.filter((decision) =>
    !decision.aggressiveZoomAllowed &&
    ["dialogue_push", "reaction_push", "action_pan", "impact_snap"].includes(decision.cameraMove)
  ).length;
  if (unsafeAggressiveZoomCount > 0) warnings.push("aggressive_zoom_without_confirmed_visual_target");

  return {
    directorId: "comic_narration_zoom_director_v1",
    decisionCount: decisions.length,
    aggressiveZoomCount: decisions.filter((decision) => decision.aggressiveZoomAllowed).length,
    safeWideCount: decisions.filter((decision) => !decision.aggressiveZoomAllowed).length,
    unsafeAggressiveZoomCount,
    decisions,
    warnings,
  };
}


