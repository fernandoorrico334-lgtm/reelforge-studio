import type { ComicStoryMinerPanelRef } from "./comic-story-miner.js";
import type { NormalizedComicEvidenceBox } from "./comic-panel-evidence-map.js";

export type ComicOcrRegionType = "dialogue" | "narration_box" | "sound_effect" | "detected_text";

export type ComicOcrRegion = {
  regionId: string;
  type: ComicOcrRegionType;
  text: string;
  box: NormalizedComicEvidenceBox;
  confidence: number;
  readingOrder: number;
  recommendedAction: "protect" | "read_first" | "impact_punch" | "context";
  reasons: string[];
};

export type ComicOcrRegionIntelligence = {
  detectorId: "comic_ocr_region_intelligence_v1";
  panelId: string;
  textLineCount: number;
  dialogueLineCount: number;
  narrationBoxCount: number;
  soundEffectCount: number;
  regions: ComicOcrRegion[];
  protectedRegions: ComicOcrRegion[];
  primaryReadingRegion: ComicOcrRegion | null;
  impactTextRegion: ComicOcrRegion | null;
  textDensity: "none" | "light" | "medium" | "heavy";
  confidence: number;
  warnings: string[];
};

function clamp(value: number, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function round(value: number) {
  return Math.round(value * 1000) / 1000;
}

function normalizedBox(input: NormalizedComicEvidenceBox): NormalizedComicEvidenceBox {
  const width = clamp(input.width, 0.18, 0.92);
  const height = clamp(input.height, 0.1, 0.72);
  return {
    x: round(clamp(input.x, 0, 1 - width)),
    y: round(clamp(input.y, 0, 1 - height)),
    width: round(width),
    height: round(height)
  };
}

function uniqueLines(values: string[]) {
  const seen = new Set<string>();
  const lines: string[] = [];
  for (const value of values) {
    const line = value.trim().replace(/\s+/g, " ");
    if (!line || seen.has(line.toLowerCase())) continue;
    seen.add(line.toLowerCase());
    lines.push(line);
  }
  return lines.slice(0, 8);
}

function lineConfidence(line: string, base: number) {
  const lengthBoost = Math.min(14, Math.round(line.length / 4));
  const punctuationBoost = /[?!]/.test(line) ? 5 : 0;
  const allCapsBoost = line.length >= 3 && line === line.toUpperCase() ? 4 : 0;
  return Math.max(45, Math.min(98, base + lengthBoost + punctuationBoost + allCapsBoost));
}

function boxForLine(input: {
  type: ComicOcrRegionType;
  index: number;
  total: number;
  textHeavyRatio: number;
}): NormalizedComicEvidenceBox {
  const row = input.index;
  const textHeavy = input.textHeavyRatio >= 0.34 || input.total >= 4;
  if (input.type === "sound_effect") {
    return normalizedBox({
      x: row % 2 === 0 ? 0.18 : 0.42,
      y: row % 2 === 0 ? 0.18 : 0.48,
      width: 0.42,
      height: 0.18
    });
  }
  if (input.type === "narration_box") {
    return normalizedBox({
      x: 0.08,
      y: 0.05 + row * 0.12,
      width: 0.78,
      height: textHeavy ? 0.18 : 0.14
    });
  }
  if (input.type === "dialogue") {
    return normalizedBox({
      x: row % 2 === 0 ? 0.08 : 0.2,
      y: 0.08 + row * (textHeavy ? 0.11 : 0.13),
      width: row % 2 === 0 ? 0.7 : 0.62,
      height: textHeavy ? 0.18 : 0.15
    });
  }
  return normalizedBox({
    x: 0.1,
    y: 0.06 + row * 0.12,
    width: 0.76,
    height: textHeavy ? 0.17 : 0.13
  });
}

function makeRegions(input: {
  panel: ComicStoryMinerPanelRef;
  type: ComicOcrRegionType;
  lines: string[];
  baseConfidence: number;
  startOrder: number;
  textHeavyRatio: number;
}): ComicOcrRegion[] {
  return input.lines.map((line, index) => {
    const isImpact = input.type === "sound_effect";
    const isDialogue = input.type === "dialogue";
    const isNarration = input.type === "narration_box";
    return {
      regionId: `${input.panel.panelId}:ocr:${input.type}:${index + 1}`,
      type: input.type,
      text: line,
      box: boxForLine({
        type: input.type,
        index,
        total: input.lines.length,
        textHeavyRatio: input.textHeavyRatio
      }),
      confidence: lineConfidence(line, input.baseConfidence),
      readingOrder: input.startOrder + index,
      recommendedAction: isImpact ? "impact_punch" : isDialogue || isNarration ? "read_first" : "protect",
      reasons: [
        `ocr_type:${input.type}`,
        `line_length:${line.length}`,
        isImpact ? "sound_effect_should_drive_punch_cut" : "text_region_must_not_be_covered_by_caption"
      ]
    };
  });
}

export function buildComicOcrRegionIntelligence(panel: ComicStoryMinerPanelRef): ComicOcrRegionIntelligence {
  const dialogue = uniqueLines(panel.localDialogue);
  const narrationBoxes = uniqueLines(panel.localNarrationBoxes);
  const soundEffects = uniqueLines(panel.soundEffects);
  const detectedText = uniqueLines(
    panel.visualCropEvidence.evidenceCounts.detectedText > 0
      ? [
          ...panel.localDialogue,
          ...panel.localNarrationBoxes,
          ...panel.soundEffects
        ]
      : []
  );
  const warnings: string[] = [];
  const textHeavyRatio = panel.visualCropEvidence.quality.textHeavyRatio;
  const regions = [
    ...makeRegions({
      panel,
      type: "narration_box",
      lines: narrationBoxes,
      baseConfidence: 70,
      startOrder: 1,
      textHeavyRatio
    }),
    ...makeRegions({
      panel,
      type: "dialogue",
      lines: dialogue,
      baseConfidence: 68,
      startOrder: 10,
      textHeavyRatio
    }),
    ...makeRegions({
      panel,
      type: "sound_effect",
      lines: soundEffects,
      baseConfidence: 76,
      startOrder: 40,
      textHeavyRatio
    }),
    ...makeRegions({
      panel,
      type: "detected_text",
      lines: detectedText.filter((line) => !dialogue.includes(line) && !narrationBoxes.includes(line) && !soundEffects.includes(line)),
      baseConfidence: 58,
      startOrder: 70,
      textHeavyRatio
    })
  ].sort((left, right) => left.readingOrder - right.readingOrder);

  const protectedRegions = regions.filter((region) => region.type !== "sound_effect");
  const primaryReadingRegion = regions.find((region) => region.type === "narration_box")
    ?? regions.find((region) => region.type === "dialogue")
    ?? regions.find((region) => region.type === "detected_text")
    ?? null;
  const impactTextRegion = regions.find((region) => region.type === "sound_effect") ?? null;
  const textLineCount = dialogue.length + narrationBoxes.length + detectedText.length + soundEffects.length;
  const textDensity = textLineCount === 0
    ? "none"
    : textLineCount <= 2
      ? "light"
      : textLineCount <= 4
        ? "medium"
        : "heavy";
  if (textLineCount === 0) warnings.push("ocr_region_intelligence:no_text_lines_available");
  if (textDensity === "heavy") warnings.push("ocr_region_intelligence:text_heavy_panel_needs_caption_protection");
  if (soundEffects.length > 0 && !impactTextRegion) warnings.push("ocr_region_intelligence:missing_sfx_region");

  const confidence = Math.round(
    Math.min(96, Math.max(35, 52 + regions.length * 7 + panel.visualCropEvidence.confidence.text * 18))
  );

  return {
    detectorId: "comic_ocr_region_intelligence_v1",
    panelId: panel.panelId,
    textLineCount,
    dialogueLineCount: dialogue.length,
    narrationBoxCount: narrationBoxes.length,
    soundEffectCount: soundEffects.length,
    regions,
    protectedRegions,
    primaryReadingRegion,
    impactTextRegion,
    textDensity,
    confidence,
    warnings
  };
}
