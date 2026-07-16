import type { ComicStoryMinerPanelRef } from "./comic-story-miner.js";
import {
  buildComicOcrRegionIntelligence,
  type ComicOcrRegionIntelligence
} from "./comic-ocr-region-intelligence.js";
import {
  detectComicVisualFocus,
  type ComicVisualFocusReport
} from "./comic-visual-focus-detector.js";

export type ComicPanelEvidenceRegionType =
  | "speech_balloon"
  | "speaker_face"
  | "impact_zone"
  | "duo_conflict"
  | "wide_context"
  | "payoff_detail";

export type NormalizedComicEvidenceBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type ComicPanelEvidenceRegion = {
  regionId: string;
  type: ComicPanelEvidenceRegionType;
  box: NormalizedComicEvidenceBox;
  anchorPoint: { x: number; y: number };
  confidence: number;
  priority: number;
  reasons: string[];
  warnings: string[];
};

export type ComicPanelSafeCaptionZone = "top" | "center" | "lower-third" | "bottom";

export type ComicPanelLayoutMap = {
  layoutId: "comic_panel_layout_map_v1";
  preferredCaptionZone: ComicPanelSafeCaptionZone;
  protectedTextRegions: ComicPanelEvidenceRegion[];
  motionFocusRegion: ComicPanelEvidenceRegion | null;
  readingPath: Array<{ regionId: string; type: ComicPanelEvidenceRegionType; order: number; holdWeight: number }>;
  captionRisk: "low" | "medium" | "high";
  ocrProtectedRegionCount: number;
  ocrReadingOrder: string[];
  warnings: string[];
};

export type ComicPanelEvidenceMap = {
  detectorId: "comic_panel_evidence_map_v1";
  panelId: string;
  pageNumber: number;
  regions: ComicPanelEvidenceRegion[];
  bestRegionByType: Partial<Record<ComicPanelEvidenceRegionType, ComicPanelEvidenceRegion>>;
  layoutMap: ComicPanelLayoutMap;
  ocrIntelligence: ComicOcrRegionIntelligence;
  visualFocus: ComicVisualFocusReport;
  warnings: string[];
};

function clamp(value: number, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function round(value: number) {
  return Math.round(value * 1000) / 1000;
}

function safeBox(box: NormalizedComicEvidenceBox): NormalizedComicEvidenceBox {
  const width = clamp(box.width, 0.2, 0.9);
  const height = clamp(box.height, 0.18, 1);
  return {
    x: round(clamp(box.x, 0, 1 - width)),
    y: round(clamp(box.y, 0, 1 - height)),
    width: round(width),
    height: round(height)
  };
}

function anchorFor(box: NormalizedComicEvidenceBox, yBias = 0.5) {
  return {
    x: round(clamp(box.x + box.width / 2, 0.08, 0.92)),
    y: round(clamp(box.y + box.height * yBias, 0.08, 0.92))
  };
}

function addRegion(input: {
  panel: ComicStoryMinerPanelRef;
  type: ComicPanelEvidenceRegionType;
  box: NormalizedComicEvidenceBox;
  confidence: number;
  priority: number;
  reasons: string[];
  warnings?: string[];
  yBias?: number;
}): ComicPanelEvidenceRegion {
  const box = safeBox(input.box);
  return {
    regionId: `${input.panel.panelId}:${input.type}`,
    type: input.type,
    box,
    anchorPoint: anchorFor(box, input.yBias ?? 0.5),
    confidence: clampScore(input.confidence),
    priority: input.priority,
    reasons: input.reasons,
    warnings: input.warnings ?? []
  };
}

function intersectsVerticalBand(box: NormalizedComicEvidenceBox, band: ComicPanelSafeCaptionZone): boolean {
  const top = box.y;
  const bottom = box.y + box.height;
  if (band === "top") return top < 0.26;
  if (band === "center") return top < 0.68 && bottom > 0.32;
  if (band === "lower-third") return bottom > 0.58;
  return bottom > 0.72;
}

function buildLayoutMap(input: {
  regions: ComicPanelEvidenceRegion[];
  ocrIntelligence: ComicOcrRegionIntelligence;
  visualFocus: ComicVisualFocusReport;
  textLoad: number;
  textHeavy: boolean;
  hasAction: boolean;
  warnings: string[];
}): ComicPanelLayoutMap {
  const protectedTextRegions = input.regions.filter((region) => region.type === "speech_balloon");
  const ocrProtectedRegions = input.ocrIntelligence.protectedRegions;
  const visualPrimaryFocus = input.visualFocus.primaryFocus;
  const motionFocusRegion = input.regions.find((region) => region.type === "impact_zone" && region.regionId.includes(visualPrimaryFocus.type))
    ?? input.regions.find((region) => region.type === "impact_zone")
    ?? input.regions.find((region) => region.type === "duo_conflict")
    ?? input.regions.find((region) => region.type === "speaker_face")
    ?? input.regions.find((region) => region.type === "wide_context")
    ?? null;
  const zones: ComicPanelSafeCaptionZone[] = ["lower-third", "bottom", "top", "center"];
  const preferredCaptionZone = zones
    .map((zone) => ({
      zone,
      penalty: protectedTextRegions.reduce((sum, region) => sum + (intersectsVerticalBand(region.box, zone) ? 20 + region.confidence / 5 : 0), 0)
        + ocrProtectedRegions.reduce((sum, region) => sum + (intersectsVerticalBand(region.box, zone) ? 18 + region.confidence / 6 : 0), 0)
        + (zone === "center" && input.hasAction ? 14 : 0)
        + (zone === "bottom" && input.textHeavy ? 12 : 0)
    }))
    .sort((left, right) => left.penalty - right.penalty)[0]?.zone ?? "lower-third";
  const captionRisk = protectedTextRegions.some((region) => intersectsVerticalBand(region.box, preferredCaptionZone))
    || ocrProtectedRegions.some((region) => intersectsVerticalBand(region.box, preferredCaptionZone))
    ? "high"
    : input.textHeavy || input.ocrIntelligence.textDensity === "heavy"
      ? "medium"
      : "low";
  const ocrReadingOrder = input.ocrIntelligence.regions
    .slice(0, 5)
    .map((region) => `${region.readingOrder}:${region.type}:${region.text.slice(0, 28)}`);
  return {
    layoutId: "comic_panel_layout_map_v1",
    preferredCaptionZone,
    protectedTextRegions,
    motionFocusRegion,
    readingPath: input.regions
      .filter((region) => ["speech_balloon", "speaker_face", "impact_zone", "duo_conflict", "payoff_detail"].includes(region.type))
      .slice(0, 4)
      .map((region, index) => ({
        regionId: region.regionId,
        type: region.type,
        order: index + 1,
        holdWeight: Math.max(1, Math.round((region.priority + region.confidence) / 50))
      })),
    captionRisk,
    ocrProtectedRegionCount: ocrProtectedRegions.length,
    ocrReadingOrder,
    warnings: [
      ...input.warnings,
      ...input.ocrIntelligence.warnings,
      ...(captionRisk === "high" ? ["caption_zone_overlaps_protected_text"] : []),
      ...(ocrProtectedRegions.length > 0 ? ["ocr_text_protection_active"] : []),
      ...(motionFocusRegion ? [] : ["missing_motion_focus_region"])
    ]
  };
}
export function buildComicPanelEvidenceMap(panel: ComicStoryMinerPanelRef): ComicPanelEvidenceMap {
  const evidence = panel.visualCropEvidence;
  const ocrIntelligence = buildComicOcrRegionIntelligence(panel);
  const visualFocus = detectComicVisualFocus(panel);
  const counts = evidence.evidenceCounts;
  const confidence = evidence.confidence;
  const regions: ComicPanelEvidenceRegion[] = [];
  const warnings: string[] = [];
  const textLoad = counts.dialogue + counts.narrationBoxes + counts.detectedText;
  const textHeavy = evidence.quality.textHeavyRatio >= 0.34 || textLoad >= 3;
  const hasAction = counts.actions > 0 || counts.soundEffects > 0 || confidence.actions >= 0.7;
  const hasCharacters = counts.characters > 0 || confidence.characters >= 0.58;
  const hasDuoConflict = evidence.visualFlags.duoVisible || /conflict|threat|rival|enemy|host/i.test(evidence.strongestRelationshipType ?? "");
  const cropable = evidence.quality.cropability916Score >= 78;

  regions.push(addRegion({
    panel,
    type: "wide_context",
    box: { x: 0.12, y: 0.02, width: 0.76, height: 0.94 },
    confidence: 58 + confidence.overall * 22 + (cropable ? 5 : 0),
    priority: 45,
    reasons: ["fallback_context_region", `story_function:${evidence.storyFunction}`, `cropability:${evidence.quality.cropability916Score}`],
    warnings: cropable ? [] : ["wide_context_low_cropability"]
  }));

  if (textLoad > 0) {
    const ocrPrimary = ocrIntelligence.primaryReadingRegion;
    regions.push(addRegion({
      panel,
      type: "speech_balloon",
      box: ocrPrimary?.box ?? { x: 0.07, y: 0.02, width: 0.86, height: textHeavy ? 0.52 : 0.4 },
      confidence: Math.max(62 + Math.min(20, textLoad * 6) + confidence.text * 16, ocrPrimary?.confidence ?? 0),
      priority: 82,
      yBias: 0.34,
      reasons: [`text_load:${textLoad}`, `dialogue:${counts.dialogue}`, `narration_boxes:${counts.narrationBoxes}`, `ocr_density:${ocrIntelligence.textDensity}`, "protect_readable_text"],
      warnings: textHeavy ? ["speech_region_text_heavy_use_wider_crop"] : []
    }));
  }

  if (hasCharacters) {
    const characterFocus = visualFocus.candidates.find((candidate) => candidate.type === "character_face" || candidate.type === "reaction_detail");
    regions.push(addRegion({
      panel,
      type: "speaker_face",
      box: characterFocus?.box ?? { x: textHeavy ? 0.18 : 0.22, y: 0.08, width: textHeavy ? 0.64 : 0.56, height: 0.68 },
      confidence: Math.max(60 + confidence.characters * 24 + Math.min(8, counts.characters * 3), characterFocus?.confidence ?? 0),
      priority: 72,
      yBias: 0.45,
      reasons: [`characters:${counts.characters}`, `character_confidence:${round(confidence.characters)}`, `visual_focus:${characterFocus?.type ?? "fallback"}`, "face_or_character_reaction_anchor"],
      warnings: characterFocus?.warnings ?? []
    }));
  }

  if (hasAction) {
    const ocrImpact = ocrIntelligence.impactTextRegion;
    const actionFocus = visualFocus.candidates.find((candidate) => candidate.type === "action_impact");
    const useOcrImpact = Boolean(ocrImpact && (!actionFocus || ocrImpact.confidence >= actionFocus.confidence + 6));
    regions.push(addRegion({
      panel,
      type: "impact_zone",
      box: useOcrImpact ? ocrImpact?.box ?? actionFocus?.box ?? { x: cropable ? 0.2 : 0.14, y: 0.08, width: cropable ? 0.6 : 0.72, height: 0.82 } : actionFocus?.box ?? { x: cropable ? 0.2 : 0.14, y: 0.08, width: cropable ? 0.6 : 0.72, height: 0.82 },
      confidence: Math.max(64 + confidence.actions * 22 + Math.min(12, counts.soundEffects * 5), ocrImpact?.confidence ?? 0, actionFocus?.confidence ?? 0),
      priority: 90,
      yBias: 0.5,
      reasons: [`actions:${counts.actions}`, `sfx:${counts.soundEffects}`, `ocr_impact:${ocrImpact?.text ?? "none"}`, `visual_focus:${actionFocus?.type ?? "fallback"}`, `action:${evidence.strongestActionLabel ?? "unknown"}`, "impact_retention_anchor"],
      warnings: [...(cropable ? [] : ["impact_region_needs_wider_crop"]), ...(actionFocus?.warnings ?? [])]
    }));
  }

  if (hasDuoConflict) {
    const duoFocus = visualFocus.candidates.find((candidate) => candidate.type === "duo_standoff");
    regions.push(addRegion({
      panel,
      type: "duo_conflict",
      box: duoFocus?.box ?? { x: 0.08, y: 0.05, width: 0.84, height: 0.86 },
      confidence: Math.max(64 + confidence.relationships * 20 + (evidence.visualFlags.duoVisible ? 10 : 0), duoFocus?.confidence ?? 0),
      priority: 86,
      yBias: 0.48,
      reasons: [`relationship:${evidence.strongestRelationshipType ?? "unknown"}`, `duo_visible:${evidence.visualFlags.duoVisible}`, `visual_focus:${duoFocus?.type ?? "fallback"}`, "keep_both_sides_visible"],
      warnings: duoFocus?.warnings ?? []
    }));
  }

  if (evidence.storyFunction === "reveal" || evidence.storyFunction === "reaction" || panel.localDialogue.length > 0) {
    regions.push(addRegion({
      panel,
      type: "payoff_detail",
      box: { x: 0.18, y: 0.1, width: 0.64, height: 0.78 },
      confidence: 58 + confidence.overall * 20 + (panel.localDialogue.length > 0 ? 8 : 0),
      priority: 68,
      reasons: [`story_function:${evidence.storyFunction}`, `dialogue:${panel.localDialogue.length}`, "payoff_readability_anchor"]
    }));
  }

  if (!textLoad) warnings.push("no_text_region_detected_from_panel_evidence");
  if (!hasAction) warnings.push("no_action_region_detected_from_panel_evidence");
  if (!hasCharacters) warnings.push("no_character_region_detected_from_panel_evidence");

  const sorted = regions.sort((left, right) => right.priority + right.confidence * 0.25 - (left.priority + left.confidence * 0.25));
  const bestRegionByType: ComicPanelEvidenceMap["bestRegionByType"] = {};
  for (const region of sorted) {
    bestRegionByType[region.type] ??= region;
  }

  const layoutMap = buildLayoutMap({ regions: sorted, ocrIntelligence, visualFocus, textLoad, textHeavy, hasAction, warnings });

  return {
    detectorId: "comic_panel_evidence_map_v1",
    panelId: panel.panelId,
    pageNumber: panel.pageNumber,
    regions: sorted,
    bestRegionByType,
    layoutMap,
    ocrIntelligence,
    visualFocus,
    warnings
  };
}

export function selectComicPanelEvidenceRegion(input: {
  evidenceMap: ComicPanelEvidenceMap | null;
  target: ComicPanelEvidenceRegionType;
}): ComicPanelEvidenceRegion | null {
  if (!input.evidenceMap) return null;
  return input.evidenceMap.bestRegionByType[input.target]
    ?? input.evidenceMap.bestRegionByType.wide_context
    ?? input.evidenceMap.regions[0]
    ?? null;
}



