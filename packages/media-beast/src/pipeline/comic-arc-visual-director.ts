import type { ComicArcScriptBeat } from "./comic-arc-script-doctor-v2.js";
import type { ComicStoryArcV2 } from "./comic-story-arc-miner-v2.js";
import type { ComicStoryMinerPanelRef } from "./comic-story-miner.js";
import {
  buildComicPanelEvidenceMap,
  selectComicPanelEvidenceRegion,
  type ComicPanelEvidenceMap,
  type ComicPanelEvidenceRegion
} from "./comic-panel-evidence-map.js";

export type ComicArcVisualTargetType =
  | "speech_balloon"
  | "speaker_face"
  | "impact_zone"
  | "duo_conflict"
  | "wide_context"
  | "payoff_detail";

export type ComicArcCameraMove =
  | "balloon_read_push"
  | "face_reaction_push"
  | "impact_snap_zoom"
  | "duo_tension_pan"
  | "context_slow_push"
  | "payoff_hold_pull";

export type ComicArcVisualDirection = {
  directorId: "comic_arc_visual_director_v1";
  panelId: string;
  pageNumber: number;
  beatRole: ComicArcScriptBeat["role"];
  primaryTarget: ComicArcVisualTargetType;
  normalizedCrop: { x: number; y: number; width: number; height: number };
  visualEvidenceMap: ComicPanelEvidenceMap | null;
  selectedEvidenceRegion: ComicPanelEvidenceRegion | null;
  anchorPoint: { x: number; y: number };
  cameraMove: ComicArcCameraMove;
  captionSafeZone: "top" | "center" | "lower-third" | "bottom";
  startScale: number;
  endScale: number;
  motionIntensity: number;
  panelNarrationAlignmentScore: number;
  evidenceMatched: string[];
  renderInstruction: string;
  warnings: string[];
};

function clamp(value: number, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function round(value: number) {
  return Math.round(value * 1000) / 1000;
}

function textTokens(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length >= 4);
}

function includesAny(text: string, values: string[]) {
  const normalized = textTokens(text).join(" ");
  return values.some((value) => normalized.includes(textTokens(value).join(" ")));
}

function panelHasAction(panel?: ComicStoryMinerPanelRef | null) {
  if (!panel) return false;
  const evidence = panel.visualCropEvidence;
  return evidence.evidenceCounts.actions > 0 || evidence.evidenceCounts.soundEffects > 0 || evidence.confidence.actions >= 0.7 || Boolean(evidence.strongestActionLabel);
}

function panelHasSpeech(panel?: ComicStoryMinerPanelRef | null) {
  if (!panel) return false;
  const evidence = panel.visualCropEvidence;
  return evidence.evidenceCounts.dialogue > 0 || evidence.evidenceCounts.narrationBoxes > 0 || evidence.evidenceCounts.detectedText > 0;
}

function panelHasDuoConflict(panel?: ComicStoryMinerPanelRef | null) {
  if (!panel) return false;
  const evidence = panel.visualCropEvidence;
  return evidence.visualFlags.duoVisible || /conflict|threat|enemy|rival|versus|host/i.test(evidence.strongestRelationshipType ?? "");
}

function pickTarget(beat: ComicArcScriptBeat, panel?: ComicStoryMinerPanelRef | null): ComicArcVisualTargetType {
  if (beat.role === "climax" && panelHasAction(panel)) return "impact_zone";
  if (beat.role === "hook" && panelHasDuoConflict(panel)) return "duo_conflict";
  if (beat.role === "hook" && panelHasAction(panel)) return "impact_zone";
  if ((beat.role === "setup" || beat.role === "tension") && panelHasSpeech(panel)) return "speech_balloon";
  if (beat.role === "payoff") return panelHasSpeech(panel) ? "speech_balloon" : "payoff_detail";
  if (panel?.visualCropEvidence.evidenceCounts.characters) return "speaker_face";
  return "wide_context";
}

function cropForTarget(target: ComicArcVisualTargetType, panel?: ComicStoryMinerPanelRef | null, evidenceRegion?: ComicPanelEvidenceRegion | null) {
  if (evidenceRegion) return evidenceRegion.box;
  const textHeavy = (panel?.visualCropEvidence.quality.textHeavyRatio ?? 0) >= 0.34;
  const cropable = (panel?.visualCropEvidence.quality.cropability916Score ?? 0) >= 82;
  if (target === "speech_balloon") return { x: 0.08, y: 0.02, width: 0.84, height: textHeavy ? 0.78 : 0.7 };
  if (target === "impact_zone") return { x: cropable ? 0.2 : 0.16, y: 0.08, width: cropable ? 0.6 : 0.68, height: 0.82 };
  if (target === "duo_conflict") return { x: 0.08, y: 0.05, width: 0.84, height: 0.86 };
  if (target === "speaker_face") return { x: 0.2, y: 0.08, width: 0.6, height: 0.74 };
  if (target === "payoff_detail") return { x: 0.18, y: 0.08, width: 0.64, height: 0.82 };
  return { x: 0.12, y: 0.02, width: 0.76, height: 0.94 };
}

function cameraMoveForTarget(target: ComicArcVisualTargetType): ComicArcCameraMove {
  if (target === "speech_balloon") return "balloon_read_push";
  if (target === "speaker_face") return "face_reaction_push";
  if (target === "impact_zone") return "impact_snap_zoom";
  if (target === "duo_conflict") return "duo_tension_pan";
  if (target === "payoff_detail") return "payoff_hold_pull";
  return "context_slow_push";
}

function captionZoneForTarget(target: ComicArcVisualTargetType, beat: ComicArcScriptBeat) {
  if (target === "speech_balloon") return "bottom" as const;
  if (beat.role === "hook" || beat.role === "climax") return "center" as const;
  return "lower-third" as const;
}

function alignmentScore(input: { arc: ComicStoryArcV2; beat: ComicArcScriptBeat; panel?: ComicStoryMinerPanelRef | null; target: ComicArcVisualTargetType; selectedRegion?: ComicPanelEvidenceRegion | null }) {
  const evidenceMatched: string[] = [];
  const warnings: string[] = [];
  const narration = input.beat.narrationText;
  const panel = input.panel;
  let score = 48;

  if (panel) score += 12;
  if (input.selectedRegion && input.selectedRegion.confidence >= 70) score += 5;
  if (panel?.visibleCharacters.length && includesAny(narration, [...panel.visibleCharacters, ...input.arc.characters])) {
    score += 16;
    evidenceMatched.push("narration_mentions_visible_character");
  }
  if (panelHasAction(panel) && /(impacto|golpe|acao|virada|pancada|luta|ameaca|confronto|escala|explode|corte forte)/i.test(narration)) {
    score += 16;
    evidenceMatched.push("narration_matches_action_or_impact");
  }
  if (panelHasSpeech(panel) && (input.target === "speech_balloon" || /(texto|pista|pagina|contexto|fala|detalhe)/i.test(narration))) {
    score += 10;
    evidenceMatched.push("narration_respects_speech_or_text");
  }
  if (panelHasDuoConflict(panel) && /(contra|conflito|tensao|ameaca|encarar|sobreviver|escala)/i.test(narration)) {
    score += 12;
    evidenceMatched.push("narration_matches_conflict");
  }
  if (input.beat.role === "climax" && input.target === "impact_zone") score += 8;
  if (input.beat.role === "payoff" && ["payoff_detail", "speech_balloon"].includes(input.target)) score += 6;

  if (!panel) warnings.push("missing_panel_evidence");
  if (evidenceMatched.length === 0) warnings.push("narration_not_visibly_grounded_in_panel");
  if (panel && (panel.visualCropEvidence.quality.cropability916Score ?? 0) < 58) warnings.push("low_9_16_cropability");
  if (input.target === "speech_balloon" && !panelHasSpeech(panel)) warnings.push("speech_target_without_text_evidence");
  if (input.selectedRegion && input.selectedRegion.confidence < 64) warnings.push("low_confidence_visual_region");

  return {
    score: Math.max(0, Math.min(100, Math.round(score - warnings.length * 7))),
    evidenceMatched,
    warnings
  };
}

export function directComicArcVisualScene(input: {
  arc: ComicStoryArcV2;
  beat: ComicArcScriptBeat;
  panel?: ComicStoryMinerPanelRef | null;
}): ComicArcVisualDirection {
  const panel = input.panel ?? null;
  const visualEvidenceMap = panel ? buildComicPanelEvidenceMap(panel) : null;
  const target = pickTarget(input.beat, panel);
  const selectedEvidenceRegion = selectComicPanelEvidenceRegion({ evidenceMap: visualEvidenceMap, target });
  const rawCrop = cropForTarget(target, panel, selectedEvidenceRegion);
  const crop = {
    x: round(clamp(rawCrop.x, 0, 1 - rawCrop.width)),
    y: round(clamp(rawCrop.y, 0, 1 - rawCrop.height)),
    width: round(clamp(rawCrop.width, 0.5625, 0.88)),
    height: round(clamp(rawCrop.height, 0.58, 1))
  };
  const alignment = alignmentScore({ arc: input.arc, beat: input.beat, panel, target, selectedRegion: selectedEvidenceRegion });
  const fallbackAnchorPoint = {
    x: round(clamp(crop.x + crop.width / 2, 0.08, 0.92)),
    y: round(clamp(crop.y + crop.height * (target === "speech_balloon" ? 0.38 : 0.5), 0.08, 0.92))
  };
  const captionSafeZone = captionZoneForTarget(target, input.beat);
  const cameraMove = cameraMoveForTarget(target);
  const startScale = target === "impact_zone" ? 1.08 : target === "speech_balloon" ? 1.02 : 1.04;
  const endScale = target === "impact_zone" ? 1.24 : target === "payoff_detail" ? 1 : 1.12;

  return {
    directorId: "comic_arc_visual_director_v1",
    panelId: input.beat.panelId,
    pageNumber: input.beat.pageNumber,
    beatRole: input.beat.role,
    primaryTarget: target,
    normalizedCrop: crop,
    visualEvidenceMap,
    selectedEvidenceRegion,
    anchorPoint: selectedEvidenceRegion?.anchorPoint ?? fallbackAnchorPoint,
    cameraMove,
    captionSafeZone,
    startScale,
    endScale,
    motionIntensity: input.beat.role === "hook" || input.beat.role === "climax" ? 10 : input.beat.role === "tension" ? 8 : 6,
    panelNarrationAlignmentScore: alignment.score,
    evidenceMatched: alignment.evidenceMatched,
    renderInstruction: [
      `Usar target visual ${target} no painel ${input.beat.panelId}.`,
      `Crop 9:16 normalizado x=${crop.x}, y=${crop.y}, w=${crop.width}, h=${crop.height}.`,
      `Camera move: ${cameraMove}; escala ${startScale}->${endScale}; legenda em ${captionSafeZone}.`,
      `Regiao de evidencia: ${selectedEvidenceRegion?.type ?? "fallback"} (${selectedEvidenceRegion?.confidence ?? 0}/100).`,
      "Se houver balao, preservar leitura; se houver impacto, centralizar golpe/monstro/personagem antes de aplicar zoom."
    ].join(" "),
    warnings: [
      ...alignment.warnings,
      ...(visualEvidenceMap?.warnings.map((warning) => `evidence_map:${warning}`) ?? []),
      ...(selectedEvidenceRegion?.warnings.map((warning) => `selected_region:${warning}`) ?? [])
    ]
  };
}

export function directComicArcVisualPlan(input: {
  arc: ComicStoryArcV2;
  scriptBeats: ComicArcScriptBeat[];
  panelsById: Map<string, ComicStoryMinerPanelRef>;
}) {
  const scenes = input.scriptBeats.map((beat) => directComicArcVisualScene({
    arc: input.arc,
    beat,
    panel: input.panelsById.get(beat.panelId) ?? null
  }));
  const averagePanelNarrationAlignmentScore = scenes.length
    ? Math.round(scenes.reduce((sum, scene) => sum + scene.panelNarrationAlignmentScore, 0) / scenes.length)
    : 0;
  return {
    directorId: "comic_arc_visual_director_v1" as const,
    sceneCount: scenes.length,
    averagePanelNarrationAlignmentScore,
    scenes,
    warnings: scenes.flatMap((scene) => scene.warnings.map((warning) => `scene_${scene.beatRole}:${scene.panelId}:${warning}`))
  };
}
