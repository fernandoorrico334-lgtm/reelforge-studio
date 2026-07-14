import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { access, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { basename, dirname, join, resolve } from "node:path";
import {
  analyzeCropVisualEvidenceFromVisualVerdict,
  type CropVisualEvidence
} from "./comics-crop-visual-evidence.js";
import {
  analyzeComicsPanelVisual,
  type ComicsPanelVisualVerdict
} from "./comics-panel-visual-analyzer.js";
import {
  buildPromotionalDetectedTextFromAsset,
  isPromotionalComicVisual,
  isPromotionalUserProvidedAsset,
  type PromotionalComicVisualVerdict
} from "./comics-promotional-visual-filter.js";
import {
  classifyUserProvidedPanel,
  extractPageIndex
} from "./comics-user-provided-panel-gate.js";

function resolveComicSeriesLabel(title: string): string {
  const lower = title.toLowerCase();
  if (/espiral mortal/i.test(lower)) return "Espiral Mortal";
  if (/simbionte/i.test(lower)) return "Simbionte Homem-Aranha";
  if (/fcbd|quadrinho gr[aá]tis/i.test(lower)) return "FCBD";
  if (/espantoso homem-aranha/i.test(lower)) return "Espantoso Homem-Aranha";
  if (/capa|cover/i.test(lower)) return "Cover";
  return title.split(/[—-]/)[0]?.trim() || title;
}

export const LOCAL_PANEL_INDEX_VERSION = 3 as const;
export const LOCAL_PANEL_INDEX_FILENAME = ".comics-local-panel-index.json";
export const LOCAL_PANEL_CROPS_DIR = ".panel-index/crops";
export const LOCAL_PANEL_INDEX_REPORT_FILENAME = "variation-b-local-panel-index.json";
export const LOCAL_PANEL_INDEX_CONTACT_SHEET_FILENAME =
  "variation-b-local-panel-index-contact-sheet.jpg";
export const ACTUAL_PANEL_CROPS_REPORT_FILENAME = "variation-b-actual-panel-crops-report.json";
export const ACTUAL_PANEL_CROPS_CONTACT_SHEET_FILENAME =
  "variation-b-actual-panel-crops-contact-sheet.jpg";

export type PanelVisualFlags = {
  venomVisible: boolean;
  spiderManVisible: boolean;
  blackSuitVisible: boolean;
  symbioteVisible: boolean;
  duoVisible: boolean;
  doctorStrangeVisible: boolean;
  unrelatedCharacterVisible: boolean;
};

export type PanelEvidenceTier = "direct_evidence" | "supporting_only" | "rejected";

export type ComicPageType =
  | "story"
  | "cover"
  | "splash"
  | "mixed"
  | "recap"
  | "credits"
  | "editorial"
  | "advertisement"
  | "catalog"
  | "qr_promo"
  | "next_issue"
  | "letters"
  | "unknown";

export const NON_NARRATIVE_PAGE_TYPES = new Set<ComicPageType>([
  "advertisement",
  "catalog",
  "qr_promo",
  "credits",
  "editorial",
  "letters"
]);

export type LocalPanelCropBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type LocalComicPanelParentContext = {
  comicTitle?: string;
  issueTitle?: string;
  pageTitle?: string;
  parentTags: string[];
  /** Discovery-only entities from page/HQ metadata — never copied into localEvidence. */
  parentEntities: string[];
};

export type LocalComicPanelEvidence = {
  panelId: string;
  pageNumber: number;
  panelNumber: number;
  readingOrder: number;

  sourcePagePath: string;
  panelImagePath: string;
  panelImageSha256: string;

  cropBounds: LocalPanelCropBounds;

  parentContext: LocalComicPanelParentContext;

  localEvidence: {
    characters: Array<{
      name: string;
      confidence: number;
      evidenceSource: "visual" | "ocr" | "dialogue";
    }>;
    actions: Array<{
      label: string;
      confidence: number;
    }>;
    relationships: Array<{
      type:
        | "duo"
        | "conflict"
        | "host_symbiote"
        | "conversation"
        | "transformation"
        | "unknown";
      entities: string[];
      confidence: number;
    }>;
    detectedText: string[];
    dialogue: string[];
    narrationBoxes: string[];
    soundEffects: string[];
    visualThemes: string[];
    objects: string[];
    locations: string[];
  };

  storyFunction:
    | "setup"
    | "context"
    | "dialogue"
    | "action"
    | "relationship"
    | "transformation"
    | "reveal"
    | "climax"
    | "reaction"
    | "transition"
    | "splash"
    | "unknown";

  sequenceId: string | null;
  previousPanelId: string | null;
  nextPanelId: string | null;

  valid: boolean;
  rejectReason: string | null;

  quality: {
    visualQualityScore: number;
    cropability916Score: number;
    textHeavyRatio: number;
  };

  confidence: {
    segmentation: number;
    characters: number;
    actions: number;
    relationships: number;
    text: number;
    overall: number;
  };

  warnings: string[];

  cropAreaRatio: number;
  estimatedPanelCount: number;
  estimatedGutterCount: number;
  isWholePageFallback: boolean;
  isActualPanelCrop: boolean;
  visualFlags: PanelVisualFlags;
  evidenceTier: PanelEvidenceTier;
};

export type LocalComicPanelIndexPage = {
  sourceAssetId: string;
  sourcePagePath: string;
  sourceContentHash: string;
  pageNumber: number;
  pageType: ComicPageType;
  indexable: boolean;
  parentContext: LocalComicPanelParentContext;
  panels: LocalComicPanelEvidence[];
};

export type LocalComicPanelIndex = {
  version: typeof LOCAL_PANEL_INDEX_VERSION;
  assetDirectory: string;
  generatedAt: string;
  sourcePageCount: number;
  panelCount: number;
  validPanelCount: number;
  rejectedPanelCount: number;
  sequenceCount: number;
  pages: LocalComicPanelIndexPage[];
};

export type LocalPanelIndexReport = {
  generatedAt: string;
  assetDirectory: string;
  indexPath: string;
  contactSheetPath: string | null;
  totalPages: number;
  totalPanels: number;
  validPanels: number;
  rejectedPanels: number;
  panelsWithPreventedInheritedTags: number;
  sequenceCount: number;
  pathHashMismatches: number;
  pages: Array<{
    pageNumber: number;
    pageType: ComicPageType;
    indexable: boolean;
    panelCount: number;
    validCount: number;
    rejectedCount: number;
  }>;
};

export type IndexUserProvidedComicPageInput = {
  assetId: string;
  assetPath: string;
  title: string;
  description?: string;
  tags?: string[];
  width: number;
  height: number;
  bytes?: number;
  contentHash: string;
  assetDirectory: string;
  ffmpegCommand?: string;
  forceRebuild?: boolean;
};

export type IndexUserProvidedComicPageResult = {
  pageType: ComicPageType;
  indexable: boolean;
  panels: LocalComicPanelEvidence[];
};

const SEGMENTATION_SAMPLE_WIDTH = 640;
const GUTTER_LUMINANCE_MIN = 232;
const GUTTER_SPAN_RATIO = 0.68;
const GUTTER_SPAN_RETRY_RATIOS = [0.68, 0.55, 0.42, 0.35] as const;
const WHOLE_PAGE_CROP_RATIO_THRESHOLD = 0.7;
const MIN_PANEL_AREA_RATIO = 0.035;
const MIN_PANEL_DIMENSION_PX = 48;

const PROMO_REASON_TO_PAGE_TYPE: Record<string, ComicPageType> = {
  qr_code: "qr_promo",
  catalog_page: "catalog",
  checklist_page: "catalog",
  visual_catalog_ad: "catalog",
  fcbd_promotional_sampler: "catalog",
  unrelated_franchise_catalog: "catalog",
  editorial_page: "editorial",
  credits_page: "credits",
  letters_page: "letters",
  next_issue_page: "next_issue",
  publisher_ad: "advertisement",
  publisher_cta_acesse: "advertisement",
  publisher_cta_acompanhe: "advertisement",
  publisher_cta_compre: "advertisement",
  publisher_cta_apoie: "advertisement",
  publisher_cta_descubra: "advertisement",
  publisher_url: "advertisement"
};

const CHARACTER_DISPLAY_NAMES: Record<string, string> = {
  doctor_strange: "Doutor Estranho",
  black_widow: "Natasha",
  venom: "Venom",
  "spider-man": "Homem-Aranha",
  symbiote: "Simbionte"
};

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK | constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function roundBounds(bounds: LocalPanelCropBounds): LocalPanelCropBounds {
  return {
    x: Math.max(0, Math.round(bounds.x)),
    y: Math.max(0, Math.round(bounds.y)),
    width: Math.max(1, Math.round(bounds.width)),
    height: Math.max(1, Math.round(bounds.height))
  };
}

function clampCropBoundsToPage(
  bounds: LocalPanelCropBounds,
  pageWidth: number,
  pageHeight: number
): LocalPanelCropBounds | null {
  const rounded = roundBounds(bounds);
  const x = clamp(rounded.x, 0, Math.max(0, pageWidth - MIN_PANEL_DIMENSION_PX));
  const y = clamp(rounded.y, 0, Math.max(0, pageHeight - MIN_PANEL_DIMENSION_PX));
  const width = clamp(rounded.width, MIN_PANEL_DIMENSION_PX, pageWidth - x);
  const height = clamp(rounded.height, MIN_PANEL_DIMENSION_PX, pageHeight - y);
  if (width < MIN_PANEL_DIMENSION_PX || height < MIN_PANEL_DIMENSION_PX) return null;
  if (x + width > pageWidth || y + height > pageHeight) return null;
  return { x, y, width, height };
}

export function mapPromoReasonToPageType(reason: string): ComicPageType {
  return PROMO_REASON_TO_PAGE_TYPE[reason] ?? "advertisement";
}

export function classifyComicPageType(input: {
  title: string;
  description?: string;
  tags?: string[];
  width: number;
  height: number;
  bytes?: number;
  fullPageVisual?: ComicsPanelVisualVerdict | null;
}): { pageType: ComicPageType; promoReason: string | null; indexable: boolean } {
  const promo = isPromotionalUserProvidedAsset({
    title: input.title,
    ...(input.description !== undefined ? { description: input.description } : {}),
    ...(input.tags !== undefined ? { tags: input.tags } : {}),
    ...(input.fullPageVisual?.visualTags
      ? { visualTags: input.fullPageVisual.visualTags }
      : {})
  });

  if (promo.reject && promo.reason) {
    const pageType = mapPromoReasonToPageType(promo.reason);
    return {
      pageType,
      promoReason: promo.reason,
      indexable: !NON_NARRATIVE_PAGE_TYPES.has(pageType)
    };
  }

  const panelGate = classifyUserProvidedPanel({
    title: input.title,
    ...(input.description !== undefined ? { description: input.description } : {}),
    ...(input.tags !== undefined ? { tags: input.tags } : {}),
    width: input.width,
    height: input.height,
    bytes: input.bytes ?? input.width * input.height,
    ...(input.fullPageVisual?.visualTags
      ? { visualTags: input.fullPageVisual.visualTags }
      : {}),
    visualRejectReason: input.fullPageVisual?.rejectReason ?? null
  });

  if (panelGate.panelKind === "cover") {
    return { pageType: "cover", promoReason: panelGate.rejectReason, indexable: false };
  }
  if (panelGate.panelKind === "catalog_ad") {
    return { pageType: "catalog", promoReason: panelGate.rejectReason, indexable: false };
  }

  if (/\brecap\b|\banteriormente\b|\bpreviously\b/i.test(input.title)) {
    return { pageType: "recap", promoReason: null, indexable: true };
  }

  if (
    extractPageIndex(input.title) !== null &&
    input.fullPageVisual?.profile &&
    input.fullPageVisual.profile.global.blackRatio >= 0.18 &&
    input.fullPageVisual.profile.global.saturatedRatio >= 0.2 &&
    input.width * input.height >= 1_200_000
  ) {
    return { pageType: "splash", promoReason: null, indexable: true };
  }

  return { pageType: "story", promoReason: null, indexable: true };
}

export function isPromotionalPanelRegion(input: {
  title: string;
  tags?: string[];
  visual: ComicsPanelVisualVerdict;
}): PromotionalComicVisualVerdict {
  const promo = isPromotionalComicVisual({
    title: input.title,
    ...(input.tags !== undefined ? { tags: input.tags } : {}),
    detectedText: buildPromotionalDetectedTextFromAsset({
      ...(input.tags !== undefined ? { tags: input.tags } : {}),
      visualTags: input.visual.visualTags
    })
  });
  if (promo.reject) return promo;

  if (input.visual.rejectReason === "catalog_ad_visual") {
    return { reject: true, reason: "visual_catalog_ad" };
  }
  if (input.visual.visualTags.includes("visual_catalog_ad")) {
    return { reject: true, reason: "visual_catalog_ad" };
  }

  return { reject: false };
}

export function extractParentContextFromPageMetadata(input: {
  title: string;
  description?: string;
  tags?: string[];
}): LocalComicPanelParentContext {
  const title = input.title.trim();
  const description = (input.description ?? title).trim();
  const tags = [...(input.tags ?? [])];
  const blob = [title, description, ...tags].join(" ").toLowerCase();
  const parentEntities = new Set<string>();

  if (/\bvenom\b/i.test(blob)) parentEntities.add("venom");
  if (/\b(homem[- ]?aranha|spider[- ]?man)\b/i.test(blob)) parentEntities.add("spider-man");
  if (/\bsimbionte\b|\bsymbiote\b/i.test(blob)) parentEntities.add("symbiote");
  if (/\btraje preto\b|\bblack suit\b/i.test(blob)) parentEntities.add("black_suit");
  if (/\b(doutor estranho|doctor strange)\b/i.test(blob)) parentEntities.add("doctor_strange");
  if (/\b(natasha|black widow)\b/i.test(blob)) parentEntities.add("black_widow");
  if (/\beddie brock\b/i.test(blob)) parentEntities.add("eddie_brock");

  return {
    comicTitle: resolveComicSeriesLabel(title),
    issueTitle: title,
    pageTitle: title,
    parentTags: tags,
    parentEntities: [...parentEntities]
  };
}

function isGutterPixel(r: number, g: number, b: number): boolean {
  return (
    (r >= GUTTER_LUMINANCE_MIN && g >= GUTTER_LUMINANCE_MIN && b >= GUTTER_LUMINANCE_MIN) ||
    (r <= 24 && g <= 24 && b <= 24)
  );
}

function dilateAxisScores(scores: number[], radius: number): number[] {
  const dilated = [...scores];
  for (let index = 0; index < scores.length; index += 1) {
    const score = scores[index] ?? 0;
    if (score < GUTTER_SPAN_RATIO * 0.85) continue;
    for (let offset = -radius; offset <= radius; offset += 1) {
      const target = index + offset;
      if (target < 0 || target >= scores.length) continue;
      dilated[target] = Math.max(dilated[target] ?? 0, score);
    }
  }
  return dilated;
}

function computeAxisGutterScores(
  pixels: Buffer,
  width: number,
  height: number,
  axis: "row" | "column"
): number[] {
  const scores: number[] = [];
  if (axis === "row") {
    for (let y = 0; y < height; y += 1) {
      let gutterCount = 0;
      for (let x = 0; x < width; x += 1) {
        const index = (y * width + x) * 3;
        const r = pixels[index] ?? 0;
        const g = pixels[index + 1] ?? 0;
        const b = pixels[index + 2] ?? 0;
        if (isGutterPixel(r, g, b)) gutterCount += 1;
      }
      scores.push(gutterCount / width);
    }
    return scores;
  }

  for (let x = 0; x < width; x += 1) {
    let gutterCount = 0;
    for (let y = 0; y < height; y += 1) {
      const index = (y * width + x) * 3;
      const r = pixels[index] ?? 0;
      const g = pixels[index + 1] ?? 0;
      const b = pixels[index + 2] ?? 0;
      if (isGutterPixel(r, g, b)) gutterCount += 1;
    }
    scores.push(gutterCount / height);
  }
  return scores;
}

function findSplitLines(
  scores: number[],
  minGap: number,
  gutterSpanRatio: number = GUTTER_SPAN_RATIO
): number[] {
  const splits: number[] = [];
  let runStart: number | null = null;

  for (let index = 0; index < scores.length; index += 1) {
    const isGutter = (scores[index] ?? 0) >= gutterSpanRatio;
    if (isGutter && runStart === null) runStart = index;
    if (!isGutter && runStart !== null) {
      const runLength = index - runStart;
      if (runLength >= minGap) {
        splits.push(Math.floor(runStart + runLength / 2));
      }
      runStart = null;
    }
  }

  if (runStart !== null) {
    const runLength = scores.length - runStart;
    if (runLength >= minGap) {
      splits.push(Math.floor(runStart + runLength / 2));
    }
  }

  return splits;
}

function buildIntervals(
  total: number,
  splitLines: number[],
  minSize: number
): Array<{ start: number; end: number }> {
  const boundaries = [0, ...splitLines.filter((line) => line > 0 && line < total), total];
  const intervals: Array<{ start: number; end: number }> = [];

  for (let index = 0; index < boundaries.length - 1; index += 1) {
    const start = boundaries[index] ?? 0;
    const end = boundaries[index + 1] ?? total;
    if (end - start >= minSize) {
      intervals.push({ start, end });
    }
  }

  if (intervals.length === 0) {
    return [{ start: 0, end: total }];
  }
  return intervals;
}

export type PageSegmentationResult = {
  bounds: LocalPanelCropBounds[];
  segmentationConfidence: number;
  rowSplitCount: number;
  colSplitCount: number;
  estimatedPagePanelCount: number;
};

function segmentPageIntoPanelBoundsAtThreshold(input: {
  pageWidth: number;
  pageHeight: number;
  sampleWidth: number;
  sampleHeight: number;
  pixels: Buffer;
  gutterSpanRatio: number;
  allowFullPageFallback: boolean;
}): PageSegmentationResult {
  const rowScores = dilateAxisScores(
    computeAxisGutterScores(input.pixels, input.sampleWidth, input.sampleHeight, "row"),
    3
  );
  const columnScores = dilateAxisScores(
    computeAxisGutterScores(input.pixels, input.sampleWidth, input.sampleHeight, "column"),
    3
  );

  const minRowGap = Math.max(2, Math.floor(input.sampleHeight * 0.004));
  const minColGap = Math.max(2, Math.floor(input.sampleWidth * 0.004));
  const rowSplits = findSplitLines(rowScores, minRowGap, input.gutterSpanRatio);
  const colSplits = findSplitLines(columnScores, minColGap, input.gutterSpanRatio);

  const rowIntervals = buildIntervals(
    input.sampleHeight,
    rowSplits,
    Math.max(6, Math.floor(input.sampleHeight * 0.05))
  );
  const colIntervals = buildIntervals(
    input.sampleWidth,
    colSplits,
    Math.max(6, Math.floor(input.sampleWidth * 0.05))
  );

  const scaleX = input.pageWidth / input.sampleWidth;
  const scaleY = input.pageHeight / input.sampleHeight;
  const pageArea = input.pageWidth * input.pageHeight;
  const bounds: LocalPanelCropBounds[] = [];

  for (const row of rowIntervals) {
    for (const col of colIntervals) {
      const candidate = clampCropBoundsToPage(
        {
          x: col.start * scaleX,
          y: row.start * scaleY,
          width: (col.end - col.start) * scaleX,
          height: (row.end - row.start) * scaleY
        },
        input.pageWidth,
        input.pageHeight
      );
      if (!candidate) continue;
      const areaRatio = (candidate.width * candidate.height) / pageArea;
      if (areaRatio < MIN_PANEL_AREA_RATIO) continue;
      bounds.push(candidate);
    }
  }

  if (bounds.length === 0) {
    if (!input.allowFullPageFallback) {
      return {
        bounds: [],
        segmentationConfidence: 0.2,
        rowSplitCount: rowSplits.length,
        colSplitCount: colSplits.length,
        estimatedPagePanelCount: 0
      };
    }
    return {
      bounds: [
        roundBounds({
          x: 0,
          y: 0,
          width: input.pageWidth,
          height: input.pageHeight
        })
      ],
      segmentationConfidence: 0.42,
      rowSplitCount: rowSplits.length,
      colSplitCount: colSplits.length,
      estimatedPagePanelCount: 1
    };
  }

  const panelCountFactor = clamp(bounds.length / 6, 0.35, 1);
  const gutterStrength =
    (rowSplits.length > 0 ? 0.5 : 0.2) + (colSplits.length > 0 ? 0.5 : 0.2);
  const segmentationConfidence = clamp(
    Math.round((0.45 + gutterStrength * 0.35 + panelCountFactor * 0.2) * 100) / 100,
    0.35,
    0.95
  );

  return {
    bounds,
    segmentationConfidence,
    rowSplitCount: rowSplits.length,
    colSplitCount: colSplits.length,
    estimatedPagePanelCount: bounds.length
  };
}

function isFullPageBounds(
  bounds: LocalPanelCropBounds,
  pageWidth: number,
  pageHeight: number
): boolean {
  const widthRatio = bounds.width / Math.max(1, pageWidth);
  const heightRatio = bounds.height / Math.max(1, pageHeight);
  return bounds.x <= 2 && bounds.y <= 2 && widthRatio >= 0.96 && heightRatio >= 0.96;
}

export function segmentPageIntoPanelBounds(input: {
  pageWidth: number;
  pageHeight: number;
  sampleWidth: number;
  sampleHeight: number;
  pixels: Buffer;
  allowFullPageFallback?: boolean;
}): PageSegmentationResult {
  const allowFullPageFallback = input.allowFullPageFallback !== false;
  let best: PageSegmentationResult | null = null;

  for (const gutterSpanRatio of GUTTER_SPAN_RETRY_RATIOS) {
    const attempt = segmentPageIntoPanelBoundsAtThreshold({
      ...input,
      gutterSpanRatio,
      allowFullPageFallback: false
    });

    if (attempt.bounds.length === 0) continue;

    const singleFullPage =
      attempt.bounds.length === 1 &&
      isFullPageBounds(attempt.bounds[0]!, input.pageWidth, input.pageHeight);
    const hasMultiplePanels = attempt.bounds.length > 1;
    const hasDetectedGutters = attempt.rowSplitCount + attempt.colSplitCount > 0;

    if (hasMultiplePanels) {
      best = attempt;
      break;
    }

    if (!singleFullPage) {
      best = attempt;
      break;
    }
  }

  if (best && best.bounds.length > 0) {
    const onlyFullPage =
      best.bounds.length === 1 &&
      isFullPageBounds(best.bounds[0]!, input.pageWidth, input.pageHeight);
    if (!onlyFullPage || allowFullPageFallback) {
      return best;
    }
  }

  if (!allowFullPageFallback) {
    return {
      bounds: [],
      segmentationConfidence: 0.2,
      rowSplitCount: 0,
      colSplitCount: 0,
      estimatedPagePanelCount: 0
    };
  }

  return segmentPageIntoPanelBoundsAtThreshold({
    ...input,
    gutterSpanRatio: GUTTER_SPAN_RATIO,
    allowFullPageFallback: true
  });
}

export function estimatePanelsInCropBounds(input: {
  cropBounds: LocalPanelCropBounds;
  pageWidth: number;
  pageHeight: number;
  rowSplitCount: number;
  colSplitCount: number;
  segmentedPanelCount: number;
}): { estimatedPanelCount: number; estimatedGutterCount: number } {
  const cropAreaRatio =
    (input.cropBounds.width * input.cropBounds.height) /
    Math.max(1, input.pageWidth * input.pageHeight);

  if (cropAreaRatio >= 0.96) {
    const gutterCount = input.rowSplitCount + input.colSplitCount;
    if (gutterCount > 0) {
      const gridEstimate = Math.max(
        2,
        (input.rowSplitCount + 1) * (input.colSplitCount + 1)
      );
      return {
        estimatedPanelCount: Math.max(gridEstimate, input.segmentedPanelCount),
        estimatedGutterCount: gutterCount
      };
    }
    return {
      estimatedPanelCount: input.segmentedPanelCount,
      estimatedGutterCount: 0
    };
  }

  if (input.segmentedPanelCount > 1) {
    return {
      estimatedPanelCount: 1,
      estimatedGutterCount: 0
    };
  }

  return {
    estimatedPanelCount: 1,
    estimatedGutterCount: 0
  };
}

export function isOversizedStoryMixedCrop(input: {
  pageType: ComicPageType;
  cropAreaRatio: number;
}): boolean {
  if (input.pageType === "splash" || input.pageType === "cover") {
    return false;
  }
  if (input.pageType !== "story" && input.pageType !== "mixed") {
    return false;
  }
  return input.cropAreaRatio > WHOLE_PAGE_CROP_RATIO_THRESHOLD;
}

export function isWholePagePanelCrop(input: {
  cropBounds: LocalPanelCropBounds;
  pageWidth: number;
  pageHeight: number;
  pageType: ComicPageType;
  cropAreaRatio: number;
  estimatedPanelCount: number;
  estimatedGutterCount: number;
  segmentedPanelCount: number;
}): boolean {
  if (isOversizedStoryMixedCrop({ pageType: input.pageType, cropAreaRatio: input.cropAreaRatio })) {
    return true;
  }
  if (input.pageType === "splash" || input.pageType === "cover") {
    return false;
  }
  if (input.pageType !== "story" && input.pageType !== "mixed") {
    return false;
  }

  if (input.estimatedPanelCount > 1 || input.estimatedGutterCount > 0) {
    return true;
  }
  if (isFullPageBounds(input.cropBounds, input.pageWidth, input.pageHeight)) {
    return true;
  }
  return false;
}

function cropEvidenceFromVisual(input: {
  visual: ComicsPanelVisualVerdict;
  panelId?: string;
  panelImagePath?: string;
  panelImageSha256?: string;
}): CropVisualEvidence {
  return analyzeCropVisualEvidenceFromVisualVerdict({
    panelId: input.panelId ?? "synthetic-panel",
    panelImagePath: input.panelImagePath ?? "",
    panelImageSha256: input.panelImageSha256 ?? "",
    visual: input.visual
  });
}

export function derivePanelVisualFlags(input: {
  visual: ComicsPanelVisualVerdict;
  panelId?: string;
  panelImagePath?: string;
  panelImageSha256?: string;
}): PanelVisualFlags {
  return cropEvidenceFromVisual(input).legacyVisualFlags;
}

export function classifyPanelEvidenceTier(input: {
  visualFlags: PanelVisualFlags;
  isWholePageFallback: boolean;
  isActualPanelCrop: boolean;
}): PanelEvidenceTier {
  if (input.isWholePageFallback || !input.isActualPanelCrop) {
    return "rejected";
  }
  if (input.visualFlags.doctorStrangeVisible || input.visualFlags.unrelatedCharacterVisible) {
    return "rejected";
  }
  if (input.visualFlags.duoVisible && input.visualFlags.venomVisible && input.visualFlags.spiderManVisible) {
    return "direct_evidence";
  }
  if (input.visualFlags.venomVisible && input.visualFlags.spiderManVisible) {
    return "direct_evidence";
  }
  if (input.visualFlags.venomVisible) {
    return "direct_evidence";
  }
  if (
    (input.visualFlags.blackSuitVisible || input.visualFlags.symbioteVisible) &&
    !input.visualFlags.venomVisible
  ) {
    return "supporting_only";
  }
  if (input.visualFlags.spiderManVisible && !input.visualFlags.venomVisible) {
    return "supporting_only";
  }
  return "supporting_only";
}

export function inferLocalEvidenceFromPanelVisual(input: {
  visual: ComicsPanelVisualVerdict;
  visualFlags?: PanelVisualFlags;
  panelId?: string;
  panelImagePath?: string;
  panelImageSha256?: string;
}): LocalComicPanelEvidence["localEvidence"] {
  if (!input.visual.profile || !input.visual.analyzable) {
    return {
      characters: [],
      actions: [],
      relationships: [],
      detectedText: [],
      dialogue: [],
      narrationBoxes: [],
      soundEffects: [],
      visualThemes: ["unanalyzed"],
      objects: [],
      locations: []
    };
  }

  return cropEvidenceFromVisual(input).localEvidence;
}

export function classifyStoryFunctionFromLocalEvidence(input: {
  localEvidence: LocalComicPanelEvidence["localEvidence"];
  visual: ComicsPanelVisualVerdict;
  panelAreaRatio: number;
}): LocalComicPanelEvidence["storyFunction"] {
  if (input.visual.visualTags.includes("visual_text_heavy")) {
    return "dialogue";
  }
  if (input.localEvidence.relationships.some((entry) => entry.type === "duo")) {
    return "relationship";
  }
  if (input.localEvidence.relationships.some((entry) => entry.type === "host_symbiote")) {
    return "transformation";
  }
  if (input.localEvidence.actions.some((entry) => /action|contrast/.test(entry.label))) {
    return "action";
  }
  if (input.panelAreaRatio >= 0.62) {
    return "splash";
  }
  if (input.localEvidence.characters.length > 0) {
    return "context";
  }
  return "unknown";
}

export function computeCropability916Score(bounds: LocalPanelCropBounds): number {
  const ratio = bounds.width / Math.max(1, bounds.height);
  const target = 9 / 16;
  const delta = Math.abs(ratio - target);
  return clamp(Math.round((1 - delta / target) * 100), 0, 100);
}

export function computeVisualQualityScore(visual: ComicsPanelVisualVerdict): number {
  if (!visual.analyzable || !visual.profile) return 0;
  let score = 55;
  score += Math.min(visual.duoVisualScore, 100) * 0.25;
  if (visual.visualTags.includes("visual_text_heavy")) score -= 18;
  if (visual.visualTags.includes("visual_catalog_ad")) score -= 35;
  if (visual.rejectReason) score -= 28;
  return clamp(Math.round(score), 0, 100);
}

export function validateLocalEvidenceDoesNotInheritParent(
  panel: LocalComicPanelEvidence
): { ok: boolean; violations: string[] } {
  const violations: string[] = [];
  const parentEntities = new Set(
    panel.parentContext.parentEntities.map((entity) => entity.toLowerCase())
  );
  const localCharacterNames = new Set(
    panel.localEvidence.characters.map((entry) => entry.name.toLowerCase())
  );

  for (const parentOnly of ["venom", "symbiote", "spider-man"]) {
    if (
      parentEntities.has(parentOnly) &&
      !localCharacterNames.has(parentOnly) &&
      panel.localEvidence.relationships.some((rel) =>
        rel.entities.map((entity) => entity.toLowerCase()).includes(parentOnly)
      )
    ) {
      violations.push(`inherited_relationship_entity:${parentOnly}`);
    }
  }

  for (const tag of panel.parentContext.parentTags) {
    if (panel.localEvidence.visualThemes.includes(tag)) {
      violations.push(`inherited_parent_tag_as_visual_theme:${tag}`);
    }
  }

  if (
    parentEntities.has("venom") &&
    localCharacterNames.has("doctor_strange") &&
    localCharacterNames.has("venom")
  ) {
    violations.push("venom_present_without_local_visual_support");
  }

  return { ok: violations.length === 0, violations };
}

export function panelPreventedInheritedParentTags(panel: LocalComicPanelEvidence): boolean {
  const parentThemeEntities = new Set(
    panel.parentContext.parentEntities.map((entity) => entity.toLowerCase())
  );
  const localNames = new Set(
    panel.localEvidence.characters.map((entry) => entry.name.toLowerCase())
  );
  if (parentThemeEntities.size === 0) return false;
  const parentOnlyPresent = [...parentThemeEntities].some(
    (entity) => !localNames.has(entity) && localNames.size > 0
  );
  return parentOnlyPresent;
}

export async function validatePanelCropIntegrity(input: {
  panelImagePath: string;
  panelImageSha256: string;
}): Promise<{ valid: boolean; rejectReason: string | null; actualSha256: string | null }> {
  if (!(await fileExists(input.panelImagePath))) {
    return {
      valid: false,
      rejectReason: "panel_crop_integrity_mismatch",
      actualSha256: null
    };
  }

  let fileStat;
  try {
    fileStat = await stat(input.panelImagePath);
  } catch {
    return {
      valid: false,
      rejectReason: "panel_crop_integrity_mismatch",
      actualSha256: null
    };
  }

  if (fileStat.size < 512) {
    return {
      valid: false,
      rejectReason: "panel_crop_integrity_mismatch",
      actualSha256: null
    };
  }

  const actualSha256 = await sha256File(input.panelImagePath);
  if (actualSha256 !== input.panelImageSha256) {
    return {
      valid: false,
      rejectReason: "panel_crop_integrity_mismatch",
      actualSha256
    };
  }

  return { valid: true, rejectReason: null, actualSha256 };
}

async function readPagePixelsScaled(input: {
  assetPath: string;
  pageWidth: number;
  pageHeight: number;
  ffmpegCommand?: string;
}): Promise<{ pixels: Buffer; sampleWidth: number; sampleHeight: number }> {
  const sampleWidth = SEGMENTATION_SAMPLE_WIDTH;
  const sampleHeight = Math.max(
    32,
    Math.round((input.pageHeight / input.pageWidth) * sampleWidth)
  );
  const ffmpegCommand = input.ffmpegCommand ?? "ffmpeg";

  const pixels = await new Promise<Buffer>((resolvePromise, reject) => {
    const chunks: Buffer[] = [];
    const child = spawn(
      ffmpegCommand,
      [
        "-hide_banner",
        "-loglevel",
        "error",
        "-i",
        input.assetPath,
        "-vf",
        `scale=${sampleWidth}:${sampleHeight}:flags=area,format=rgb24`,
        "-frames:v",
        "1",
        "-f",
        "rawvideo",
        "pipe:1"
      ],
      { stdio: ["ignore", "pipe", "pipe"] }
    );
    let stderr = "";
    child.stdout?.on("data", (chunk: Buffer) => chunks.push(chunk));
    child.stderr?.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolvePromise(Buffer.concat(chunks));
      else reject(new Error(`ffmpeg page sample exited ${code}: ${stderr.slice(-500)}`));
    });
  });

  return { pixels, sampleWidth, sampleHeight };
}

async function sha256File(path: string): Promise<string> {
  const bytes = await readFile(path);
  return createHash("sha256").update(bytes).digest("hex");
}

async function materializePanelCrop(input: {
  sourcePath: string;
  outputPath: string;
  cropBounds: LocalPanelCropBounds;
  ffmpegCommand?: string;
}): Promise<void> {
  await mkdir(dirname(input.outputPath), { recursive: true });
  const crop = input.cropBounds;
  const filter = `crop=${crop.width}:${crop.height}:${crop.x}:${crop.y}`;
  await new Promise<void>((resolvePromise, reject) => {
    const child = spawn(
      input.ffmpegCommand ?? "ffmpeg",
      [
        "-y",
        "-hide_banner",
        "-loglevel",
        "error",
        "-i",
        input.sourcePath,
        "-vf",
        filter,
        "-frames:v",
        "1",
        input.outputPath
      ],
      { stdio: ["ignore", "ignore", "pipe"] }
    );
    let stderr = "";
    child.stderr?.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolvePromise();
      else reject(new Error(`ffmpeg crop exited ${code}: ${stderr.slice(-500)}`));
    });
  });
}

function buildPanelId(assetId: string, pageNumber: number, panelNumber: number): string {
  return `${assetId}:page${pageNumber}:panel${panelNumber}`;
}

function formatCharacterNames(
  characters: LocalComicPanelEvidence["localEvidence"]["characters"]
): string {
  if (characters.length === 0) return "none";
  return characters
    .map((entry) => CHARACTER_DISPLAY_NAMES[entry.name] ?? entry.name)
    .join("+");
}

export function assignLocalPanelSequences(pages: LocalComicPanelIndexPage[]): number {
  const validPanels = pages
    .filter((page) => page.indexable && !NON_NARRATIVE_PAGE_TYPES.has(page.pageType))
    .flatMap((page) => page.panels.filter((panel) => panel.valid))
    .sort((left, right) => {
      if (left.pageNumber !== right.pageNumber) return left.pageNumber - right.pageNumber;
      return left.panelNumber - right.panelNumber;
    });

  for (const panel of pages.flatMap((page) => page.panels)) {
    panel.sequenceId = null;
    panel.previousPanelId = null;
    panel.nextPanelId = null;
    panel.readingOrder = 0;
  }

  if (validPanels.length === 0) return 0;

  const lastPanelByPage = new Map<number, LocalComicPanelEvidence>();
  const firstPanelByPage = new Map<number, LocalComicPanelEvidence>();
  for (const panel of validPanels) {
    const existingLast = lastPanelByPage.get(panel.pageNumber);
    if (!existingLast || panel.panelNumber > existingLast.panelNumber) {
      lastPanelByPage.set(panel.pageNumber, panel);
    }
    const existingFirst = firstPanelByPage.get(panel.pageNumber);
    if (!existingFirst || panel.panelNumber < existingFirst.panelNumber) {
      firstPanelByPage.set(panel.pageNumber, panel);
    }
  }

  let sequenceCount = 0;
  let runStartIndex = 0;

  const finalizeRun = (start: number, end: number, sequenceNumber: number) => {
    const seriesKey =
      validPanels[start]?.parentContext.comicTitle?.toLowerCase().replace(/[^a-z0-9]+/g, "_") ??
      "unknown_series";
    const sequenceId = `${seriesKey}:seq:${sequenceNumber}`;
    for (let index = start; index <= end; index += 1) {
      const panel = validPanels[index]!;
      panel.sequenceId = sequenceId;
      panel.readingOrder = index + 1;
    }
  };

  for (let index = 0; index < validPanels.length; index += 1) {
    const current = validPanels[index]!;
    const previous = index > 0 ? validPanels[index - 1]! : null;
    let breaksRun = index === 0;

    if (previous) {
      if (current.pageNumber === previous.pageNumber) {
        breaksRun = current.panelNumber !== previous.panelNumber + 1;
      } else {
        breaksRun = current.pageNumber !== previous.pageNumber + 1;
      }
    }

    if (breaksRun && index > 0) {
      sequenceCount += 1;
      finalizeRun(runStartIndex, index - 1, sequenceCount);
      runStartIndex = index;
    }
  }

  sequenceCount += 1;
  finalizeRun(runStartIndex, validPanels.length - 1, sequenceCount);

  for (let index = 0; index < validPanels.length; index += 1) {
    const current = validPanels[index]!;
    const previous = index > 0 ? validPanels[index - 1]! : null;
    const next = index < validPanels.length - 1 ? validPanels[index + 1]! : null;

    let previousPanelId: string | null = null;
    let nextPanelId: string | null = null;

    if (previous) {
      if (current.pageNumber === previous.pageNumber) {
        if (current.panelNumber === previous.panelNumber + 1) {
          previousPanelId = previous.panelId;
        }
      } else if (
        current.pageNumber === previous.pageNumber + 1 &&
        current.panelNumber === (firstPanelByPage.get(current.pageNumber)?.panelNumber ?? 1) &&
        previous.panelId === lastPanelByPage.get(previous.pageNumber)?.panelId
      ) {
        previousPanelId = previous.panelId;
      }
    }

    if (next) {
      if (current.pageNumber === next.pageNumber) {
        if (next.panelNumber === current.panelNumber + 1) {
          nextPanelId = next.panelId;
        }
      } else if (
        next.pageNumber === current.pageNumber + 1 &&
        next.panelNumber === (firstPanelByPage.get(next.pageNumber)?.panelNumber ?? 1) &&
        current.panelId === lastPanelByPage.get(current.pageNumber)?.panelId
      ) {
        nextPanelId = next.panelId;
      }
    }

    current.previousPanelId = previousPanelId;
    current.nextPanelId = nextPanelId;
  }

  return sequenceCount;
}

export async function indexUserProvidedComicPage(
  input: IndexUserProvidedComicPageInput
): Promise<IndexUserProvidedComicPageResult> {
  const assetDirectory = resolve(input.assetDirectory);
  const cropsRoot = join(assetDirectory, LOCAL_PANEL_CROPS_DIR);
  const parentContext = extractParentContextFromPageMetadata({
    title: input.title,
    ...(input.description !== undefined ? { description: input.description } : {}),
    ...(input.tags !== undefined ? { tags: input.tags } : {})
  });
  const pageNumber = extractPageIndex(input.title) ?? 0;

  const fullPageVisual = await analyzeComicsPanelVisual({
    assetPath: input.assetPath,
    ...(input.ffmpegCommand ? { ffmpegCommand: input.ffmpegCommand } : {})
  });

  const pageClassification = classifyComicPageType({
    title: input.title,
    ...(input.description !== undefined ? { description: input.description } : {}),
    ...(input.tags !== undefined ? { tags: input.tags } : {}),
    width: input.width,
    height: input.height,
    ...(input.bytes !== undefined ? { bytes: input.bytes } : {}),
    fullPageVisual
  });

  if (NON_NARRATIVE_PAGE_TYPES.has(pageClassification.pageType)) {
    return {
      pageType: pageClassification.pageType,
      indexable: false,
      panels: []
    };
  }

  if (!pageClassification.indexable && pageClassification.pageType === "cover") {
    return {
      pageType: pageClassification.pageType,
      indexable: false,
      panels: []
    };
  }

  const { pixels, sampleWidth, sampleHeight } = await readPagePixelsScaled({
    assetPath: input.assetPath,
    pageWidth: input.width,
    pageHeight: input.height,
    ...(input.ffmpegCommand ? { ffmpegCommand: input.ffmpegCommand } : {})
  });

  const treatAsMixed =
    pageClassification.pageType === "mixed" ||
    (pageClassification.pageType === "story" &&
      /\bmixed\b|\bmista\b|\bhouse ad\b/i.test(
        [input.title, input.description ?? "", ...(input.tags ?? [])].join(" ")
      ));

  let pageType = pageClassification.pageType;
  const allowFullPageFallback = pageType === "splash";

  const segmentation = segmentPageIntoPanelBounds({
    pageWidth: input.width,
    pageHeight: input.height,
    sampleWidth,
    sampleHeight,
    pixels,
    allowFullPageFallback
  });

  if (
    segmentation.bounds.length === 0 &&
    (pageType === "story" || pageType === "mixed" || treatAsMixed)
  ) {
    return {
      pageType,
      indexable: pageClassification.indexable || pageType === "mixed",
      panels: []
    };
  }

  const pageArea = input.width * input.height;
  const panels: LocalComicPanelEvidence[] = [];

  const sortedBounds = [...segmentation.bounds].sort((left, right) => {
    if (Math.abs(left.y - right.y) > input.height * 0.05) return left.y - right.y;
    return left.x - right.x;
  });

  for (let index = 0; index < sortedBounds.length; index += 1) {
    const cropBounds = sortedBounds[index]!;
    const panelNumber = index + 1;
    const panelId = buildPanelId(input.assetId, pageNumber, panelNumber);
    const panelImagePath = join(cropsRoot, `${panelId.replace(/[:/\\]/g, "_")}.jpg`);

    if (input.forceRebuild || !(await fileExists(panelImagePath))) {
      await materializePanelCrop({
        sourcePath: input.assetPath,
        outputPath: panelImagePath,
        cropBounds,
        ...(input.ffmpegCommand ? { ffmpegCommand: input.ffmpegCommand } : {})
      });
    }

    let panelImageSha256 = await sha256File(panelImagePath);
    const integrity = await validatePanelCropIntegrity({
      panelImagePath,
      panelImageSha256
    });

    const visual = await analyzeComicsPanelVisual({
      assetPath: panelImagePath,
      ...(input.ffmpegCommand ? { ffmpegCommand: input.ffmpegCommand } : {})
    });

    const regionPromo = isPromotionalPanelRegion({
      title: input.title,
      ...(input.tags !== undefined ? { tags: input.tags } : {}),
      visual
    });

    const cropAreaRatio = (cropBounds.width * cropBounds.height) / pageArea;
    const cropPanelEstimate = estimatePanelsInCropBounds({
      cropBounds,
      pageWidth: input.width,
      pageHeight: input.height,
      rowSplitCount: segmentation.rowSplitCount,
      colSplitCount: segmentation.colSplitCount,
      segmentedPanelCount: segmentation.bounds.length
    });
    const wholePageFallback = isWholePagePanelCrop({
      cropBounds,
      pageWidth: input.width,
      pageHeight: input.height,
      pageType: treatAsMixed ? "mixed" : pageType,
      cropAreaRatio,
      estimatedPanelCount: cropPanelEstimate.estimatedPanelCount,
      estimatedGutterCount: cropPanelEstimate.estimatedGutterCount,
      segmentedPanelCount: segmentation.bounds.length
    });
    const isActualPanelCrop = !wholePageFallback;
    const cropEvidence = analyzeCropVisualEvidenceFromVisualVerdict({
      panelId,
      panelImagePath,
      panelImageSha256,
      visual
    });
    const visualFlags = cropEvidence.legacyVisualFlags;
    const evidenceTier = cropEvidence.evidenceTier;
    const localEvidence = cropEvidence.localEvidence;
    const storyFunction = classifyStoryFunctionFromLocalEvidence({
      localEvidence,
      visual,
      panelAreaRatio: cropAreaRatio
    });

    const characterConfidence =
      localEvidence.characters.length > 0
        ? localEvidence.characters.reduce((sum, entry) => sum + entry.confidence, 0) /
          localEvidence.characters.length
        : 0;
    const actionConfidence =
      localEvidence.actions.length > 0
        ? localEvidence.actions.reduce((sum, entry) => sum + entry.confidence, 0) /
          localEvidence.actions.length
        : 0;
    const relationshipConfidence =
      localEvidence.relationships.length > 0
        ? localEvidence.relationships.reduce((sum, entry) => sum + entry.confidence, 0) /
          localEvidence.relationships.length
        : 0;
    const textHeavyRatio = visual.profile?.global.whiteRatio ?? 0;
    const overallConfidence = clamp(
      Math.round(
        (segmentation.segmentationConfidence * 0.25 +
          characterConfidence * 0.35 +
          actionConfidence * 0.15 +
          relationshipConfidence * 0.2 +
          (visual.analyzable ? 0.05 : 0)) *
          100
      ) / 100,
      0,
      1
    );

    let valid = integrity.valid && !regionPromo.reject && isActualPanelCrop && evidenceTier !== "rejected";
    let rejectReason: string | null = null;
    if (!integrity.valid) {
      rejectReason = integrity.rejectReason;
    } else if (wholePageFallback) {
      valid = false;
      rejectReason = isOversizedStoryMixedCrop({
        pageType: treatAsMixed ? "mixed" : pageType,
        cropAreaRatio
      })
        ? "oversized_story_mixed_crop"
        : "whole_page_fallback";
    } else if (evidenceTier === "rejected") {
      valid = false;
      rejectReason = visualFlags.doctorStrangeVisible
        ? "forbidden_character_evidence"
        : "panel_evidence_rejected";
    } else if (regionPromo.reject) {
      rejectReason = regionPromo.reason ?? "promotional_region";
    }

    const inheritanceCheck = validateLocalEvidenceDoesNotInheritParent({
      panelId,
      pageNumber,
      panelNumber,
      readingOrder: panelNumber,
      sourcePagePath: input.assetPath,
      panelImagePath,
      panelImageSha256,
      cropBounds,
      parentContext,
      localEvidence,
      storyFunction,
      sequenceId: null,
      previousPanelId: null,
      nextPanelId: null,
      valid,
      rejectReason,
      quality: {
        visualQualityScore: computeVisualQualityScore(visual),
        cropability916Score: computeCropability916Score(cropBounds),
        textHeavyRatio
      },
      confidence: {
        segmentation: segmentation.segmentationConfidence,
        characters: characterConfidence,
        actions: actionConfidence,
        relationships: relationshipConfidence,
        text: visual.visualTags.includes("visual_text_heavy") ? 0.72 : 0.12,
        overall: overallConfidence
      },
      warnings: [...visual.warnings],
      cropAreaRatio,
      estimatedPanelCount: cropPanelEstimate.estimatedPanelCount,
      estimatedGutterCount: cropPanelEstimate.estimatedGutterCount,
      isWholePageFallback: wholePageFallback,
      isActualPanelCrop,
      visualFlags,
      evidenceTier
    });

    if (!inheritanceCheck.ok) {
      valid = false;
      rejectReason = rejectReason ?? "inherited_parent_evidence";
    }

    panels.push({
      panelId,
      pageNumber,
      panelNumber,
      readingOrder: panelNumber,
      sourcePagePath: input.assetPath,
      panelImagePath,
      panelImageSha256,
      cropBounds,
      parentContext,
      localEvidence,
      storyFunction,
      sequenceId: null,
      previousPanelId: null,
      nextPanelId: null,
      valid,
      rejectReason,
      quality: {
        visualQualityScore: computeVisualQualityScore(visual),
        cropability916Score: computeCropability916Score(cropBounds),
        textHeavyRatio
      },
      confidence: {
        segmentation: segmentation.segmentationConfidence,
        characters: characterConfidence,
        actions: actionConfidence,
        relationships: relationshipConfidence,
        text: visual.visualTags.includes("visual_text_heavy") ? 0.72 : 0.12,
        overall: overallConfidence
      },
      warnings: [
        ...visual.warnings,
        ...(inheritanceCheck.ok ? [] : inheritanceCheck.violations.map((v) => `inheritance:${v}`)),
        ...(wholePageFallback ? ["whole_page_fallback"] : []),
        ...(evidenceTier === "supporting_only" ? ["evidence_tier:supporting_only"] : [])
      ],
      cropAreaRatio,
      estimatedPanelCount: cropPanelEstimate.estimatedPanelCount,
      estimatedGutterCount: cropPanelEstimate.estimatedGutterCount,
      isWholePageFallback: wholePageFallback,
      isActualPanelCrop,
      visualFlags,
      evidenceTier
    });
  }
  const validCount = panels.filter((panel) => panel.valid).length;
  const rejectedCount = panels.filter((panel) => !panel.valid).length;
  if (pageType === "story" && validCount > 0 && rejectedCount > 0) {
    pageType = "mixed";
  }

  return {
    pageType,
    indexable: pageClassification.indexable || pageType === "mixed",
    panels
  };
}

export function resolveLocalPanelIndexPath(assetDirectory: string): string {
  return join(resolve(assetDirectory), LOCAL_PANEL_INDEX_FILENAME);
}

export async function loadLocalComicPanelIndex(
  assetDirectory: string
): Promise<LocalComicPanelIndex | null> {
  const indexPath = resolveLocalPanelIndexPath(assetDirectory);
  if (!(await fileExists(indexPath))) return null;
  try {
    const raw = JSON.parse(await readFile(indexPath, "utf8")) as LocalComicPanelIndex;
    if (raw.version !== LOCAL_PANEL_INDEX_VERSION) return null;
    return raw;
  } catch {
    return null;
  }
}

export async function saveLocalComicPanelIndex(
  assetDirectory: string,
  index: LocalComicPanelIndex
): Promise<string> {
  const indexPath = resolveLocalPanelIndexPath(assetDirectory);
  await mkdir(dirname(indexPath), { recursive: true });
  await writeFile(indexPath, JSON.stringify(index, null, 2), "utf8");
  return indexPath;
}

export function buildLocalPanelIndexReport(input: {
  index: LocalComicPanelIndex;
  indexPath: string;
  contactSheetPath?: string | null;
}): LocalPanelIndexReport {
  const allPanels = input.index.pages.flatMap((page) => page.panels);
  const validPanels = allPanels.filter((panel) => panel.valid);
  const rejectedPanels = allPanels.filter((panel) => !panel.valid);

  return {
    generatedAt: input.index.generatedAt,
    assetDirectory: input.index.assetDirectory,
    indexPath: input.indexPath,
    contactSheetPath: input.contactSheetPath ?? null,
    totalPages: input.index.sourcePageCount,
    totalPanels: allPanels.length,
    validPanels: validPanels.length,
    rejectedPanels: rejectedPanels.length,
    panelsWithPreventedInheritedTags: validPanels.filter((panel) =>
      panelPreventedInheritedParentTags(panel)
    ).length,
    sequenceCount: input.index.sequenceCount,
    pathHashMismatches: allPanels.filter(
      (panel) => panel.rejectReason === "panel_crop_integrity_mismatch"
    ).length,
    pages: input.index.pages.map((page) => ({
      pageNumber: page.pageNumber,
      pageType: page.pageType,
      indexable: page.indexable,
      panelCount: page.panels.length,
      validCount: page.panels.filter((panel) => panel.valid).length,
      rejectedCount: page.panels.filter((panel) => !panel.valid).length
    }))
  };
}

export type ActualPanelCropBeatAssignment = {
  beatRole: string;
  beatId: string;
  panelId: string;
};

export type ActualPanelCropsReport = {
  generatedAt: string;
  assetDirectory: string;
  indexPath: string;
  contactSheetPath: string | null;
  pagesPretendingToBePanels: number;
  actualPanelCropCount: number;
  wholePageFallbackCount: number;
  forbiddenCharacterCount: number;
  actualPanelCropRate: number;
  hookDirectEvidence: boolean;
  climaxDirectEvidence: boolean;
  canRender: boolean;
  canPublish: boolean;
  blockReason: string | null;
  beatsWithoutSufficientEvidence: string[];
  panels: Array<{
    panelId: string;
    pageNumber: number;
    panelNumber: number;
    valid: boolean;
    cropAreaRatio: number;
    estimatedPanelCount: number;
    estimatedGutterCount: number;
    isWholePageFallback: boolean;
    isActualPanelCrop: boolean;
    evidenceTier: PanelEvidenceTier;
    visualFlags: PanelVisualFlags;
    panelImagePath: string;
    panelImageSha256: string;
    rejectReason: string | null;
  }>;
  beats: Array<{
    beatRole: string;
    beatId: string;
    panelId: string | null;
    isActualPanelCrop: boolean;
    evidenceTier: PanelEvidenceTier | null;
    hasDirectEvidence: boolean;
    blockReason: string | null;
    panelImagePath: string | null;
  }>;
};

const HIGH_STAKES_BEAT_ROLES = new Set(["hook", "climax", "development_a", "development_b"]);

function beatAllowsEvidenceTier(beatRole: string, tier: PanelEvidenceTier): boolean {
  const baseRole = beatRole.replace(/_[ab]$/i, "");
  if (tier === "rejected") return false;
  if (tier === "supporting_only" && (HIGH_STAKES_BEAT_ROLES.has(beatRole) || baseRole === "development")) {
    return false;
  }
  return tier === "direct_evidence" || tier === "supporting_only";
}

export function buildActualPanelCropsReport(input: {
  index: LocalComicPanelIndex;
  indexPath: string;
  beatAssignments?: ActualPanelCropBeatAssignment[];
}): ActualPanelCropsReport {
  const allPanels = input.index.pages.flatMap((page) => page.panels);
  const wholePagePanels = allPanels.filter((panel) => panel.isWholePageFallback);
  const actualPanels = allPanels.filter((panel) => panel.isActualPanelCrop && panel.valid);
  const forbiddenPanels = allPanels.filter(
    (panel) =>
      panel.valid &&
      (panel.visualFlags.doctorStrangeVisible ||
        panel.visualFlags.unrelatedCharacterVisible ||
        panel.rejectReason === "forbidden_character_evidence")
  );

  const actualPanelCropRate =
    allPanels.length === 0
      ? 0
      : allPanels.filter((panel) => panel.isActualPanelCrop).length / allPanels.length;

  const beats: ActualPanelCropsReport["beats"] = [];
  const beatsWithoutSufficientEvidence: string[] = [];

  for (const assignment of input.beatAssignments ?? []) {
    const panel = findLocalPanelById(input.index, assignment.panelId);
    if (!panel) {
      beats.push({
        beatRole: assignment.beatRole,
        beatId: assignment.beatId,
        panelId: assignment.panelId,
        isActualPanelCrop: false,
        evidenceTier: null,
        hasDirectEvidence: false,
        blockReason: "panel_not_found",
        panelImagePath: null
      });
      beatsWithoutSufficientEvidence.push(assignment.beatId);
      continue;
    }

    const hasDirectEvidence = panel.evidenceTier === "direct_evidence" && panel.isActualPanelCrop;
    const tierAllowed = beatAllowsEvidenceTier(assignment.beatRole, panel.evidenceTier);
    let blockReason: string | null = null;

    if (panel.isWholePageFallback) {
      blockReason = "whole_page_fallback";
    } else if (!panel.isActualPanelCrop) {
      blockReason = "not_actual_panel_crop";
    } else if (!tierAllowed) {
      blockReason =
        panel.evidenceTier === "supporting_only"
          ? "supporting_only_not_allowed"
          : "evidence_rejected";
    } else if (
      (assignment.beatRole === "hook" || assignment.beatRole === "climax") &&
      !hasDirectEvidence
    ) {
      blockReason = "high_stakes_requires_direct_evidence";
    } else if (!panel.valid) {
      blockReason = panel.rejectReason ?? "panel_invalid";
    }

    if (blockReason) {
      beatsWithoutSufficientEvidence.push(assignment.beatId);
    }

    beats.push({
      beatRole: assignment.beatRole,
      beatId: assignment.beatId,
      panelId: panel.panelId,
      isActualPanelCrop: panel.isActualPanelCrop,
      evidenceTier: panel.evidenceTier,
      hasDirectEvidence,
      blockReason,
      panelImagePath: panel.panelImagePath
    });
  }

  const hookBeat = beats.find((beat) => beat.beatRole === "hook");
  const climaxBeat = beats.find((beat) => beat.beatRole === "climax");
  const hookDirectEvidence = hookBeat?.hasDirectEvidence === true && hookBeat.blockReason === null;
  const climaxDirectEvidence =
    climaxBeat?.hasDirectEvidence === true && climaxBeat.blockReason === null;

  const gateFailures: string[] = [];
  if (actualPanelCropRate < 1) gateFailures.push("actual_panel_crop_rate_below_1");
  if (wholePagePanels.length > 0) gateFailures.push("whole_page_fallback_present");
  if (forbiddenPanels.length > 0) gateFailures.push("forbidden_character_present");
  if (!hookDirectEvidence && (input.beatAssignments ?? []).some((b) => b.beatRole === "hook")) {
    gateFailures.push("hook_missing_direct_evidence");
  }
  if (!climaxDirectEvidence && (input.beatAssignments ?? []).some((b) => b.beatRole === "climax")) {
    gateFailures.push("climax_missing_direct_evidence");
  }
  if (beatsWithoutSufficientEvidence.length > 0) {
    gateFailures.push("beats_without_sufficient_evidence");
  }

  const hasBeatAssignments = (input.beatAssignments ?? []).length > 0;
  const canRender =
    actualPanelCropRate === 1 &&
    wholePagePanels.filter((panel) => panel.valid).length === 0 &&
    forbiddenPanels.filter((panel) => panel.valid).length === 0 &&
    (!hasBeatAssignments || beatsWithoutSufficientEvidence.length === 0);
  const canPublish = canRender && hookDirectEvidence && climaxDirectEvidence;

  return {
    generatedAt: new Date().toISOString(),
    assetDirectory: input.index.assetDirectory,
    indexPath: input.indexPath,
    contactSheetPath: null,
    pagesPretendingToBePanels: wholePagePanels.length,
    actualPanelCropCount: actualPanels.length,
    wholePageFallbackCount: wholePagePanels.length,
    forbiddenCharacterCount: forbiddenPanels.length,
    actualPanelCropRate: Math.round(actualPanelCropRate * 1000) / 1000,
    hookDirectEvidence,
    climaxDirectEvidence,
    canRender,
    canPublish,
    blockReason: gateFailures.length > 0 ? gateFailures.join("|") : null,
    beatsWithoutSufficientEvidence,
    panels: allPanels.map((panel) => ({
      panelId: panel.panelId,
      pageNumber: panel.pageNumber,
      panelNumber: panel.panelNumber,
      valid: panel.valid,
      cropAreaRatio: panel.cropAreaRatio,
      estimatedPanelCount: panel.estimatedPanelCount,
      estimatedGutterCount: panel.estimatedGutterCount,
      isWholePageFallback: panel.isWholePageFallback,
      isActualPanelCrop: panel.isActualPanelCrop,
      evidenceTier: panel.evidenceTier,
      visualFlags: panel.visualFlags,
      panelImagePath: panel.panelImagePath,
      panelImageSha256: panel.panelImageSha256,
      rejectReason: panel.rejectReason
    })),
    beats
  };
}

export async function renderActualPanelCropsContactSheet(input: {
  beats: ActualPanelCropsReport["beats"];
  outputPath: string;
  ffmpegCommand?: string;
}): Promise<string | null> {
  const entries = input.beats.filter(
    (beat) => beat.panelImagePath && beat.isActualPanelCrop && beat.blockReason === null
  );
  if (entries.length === 0) return null;

  await mkdir(dirname(input.outputPath), { recursive: true });
  const ffmpegCommand = input.ffmpegCommand ?? "ffmpeg";
  const annotatedDir = join(dirname(input.outputPath), `${basename(input.outputPath)}.annotated`);
  await mkdir(annotatedDir, { recursive: true });

  const annotatedPaths: string[] = [];
  for (const [index, beat] of entries.entries()) {
    if (!beat.panelImagePath || !(await fileExists(beat.panelImagePath))) continue;
    const label = escapeDrawtext(
      `${beat.beatRole} | ${beat.panelId} | ${beat.evidenceTier} | direct:${beat.hasDirectEvidence}`
    );
    const annotatedPath = join(annotatedDir, `actual-${String(index + 1).padStart(2, "0")}.jpg`);
    await runFfmpegCommand(ffmpegCommand, [
      "-y",
      "-hide_banner",
      "-loglevel",
      "error",
      "-i",
      beat.panelImagePath,
      "-vf",
      `scale=320:320:force_original_aspect_ratio=decrease,pad=320:320:(ow-iw)/2:(oh-ih)/2:color=black,drawtext=text='${label}':fontsize=10:fontcolor=white:x=8:y=8:box=1:boxcolor=black@0.55`,
      "-frames:v",
      "1",
      annotatedPath
    ]);
    annotatedPaths.push(annotatedPath);
  }

  if (annotatedPaths.length === 0) return null;

  const listPath = `${input.outputPath}.list.txt`;
  const escaped = annotatedPaths.map((path) => `file '${path.replace(/'/g, "'\\''")}'`).join("\n");
  await writeFile(listPath, escaped, "utf8");

  const columns = Math.min(4, Math.max(1, Math.ceil(Math.sqrt(annotatedPaths.length))));
  const rows = Math.ceil(annotatedPaths.length / columns);
  try {
    await runFfmpegCommand(ffmpegCommand, [
      "-y",
      "-hide_banner",
      "-loglevel",
      "error",
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      listPath,
      "-vf",
      `tile=${columns}x${rows}`,
      "-frames:v",
      "1",
      input.outputPath
    ]);
    return resolve(input.outputPath);
  } catch {
    return null;
  }
}

export async function saveActualPanelCropsReport(input: {
  index: LocalComicPanelIndex;
  indexPath: string;
  projectRoot: string;
  beatAssignments?: ActualPanelCropBeatAssignment[];
  ffmpegCommand?: string;
}): Promise<{ reportPath: string; contactSheetPath: string | null; report: ActualPanelCropsReport }> {
  const tmpDir = join(resolve(input.projectRoot), "tmp");
  await mkdir(tmpDir, { recursive: true });
  const reportPath = join(tmpDir, ACTUAL_PANEL_CROPS_REPORT_FILENAME);
  const contactSheetTarget = join(tmpDir, ACTUAL_PANEL_CROPS_CONTACT_SHEET_FILENAME);

  const report = buildActualPanelCropsReport({
    index: input.index,
    indexPath: input.indexPath,
    ...(input.beatAssignments ? { beatAssignments: input.beatAssignments } : {})
  });

  const contactSheetPath = await renderActualPanelCropsContactSheet({
    beats: report.beats,
    outputPath: contactSheetTarget,
    ...(input.ffmpegCommand ? { ffmpegCommand: input.ffmpegCommand } : {})
  });
  report.contactSheetPath = contactSheetPath;

  await writeFile(reportPath, JSON.stringify(report, null, 2), "utf8");
  return { reportPath, contactSheetPath, report };
}

function escapeDrawtext(value: string): string {
  return value.replace(/[:\\']/g, "\\$&");
}

async function runFfmpegCommand(ffmpegCommand: string, args: string[]): Promise<void> {
  await new Promise<void>((resolvePromise, reject) => {
    const child = spawn(ffmpegCommand, args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr?.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolvePromise();
      else reject(new Error(`ffmpeg exited ${code}: ${stderr.slice(-500)}`));
    });
  });
}

export async function renderLocalPanelIndexContactSheet(input: {
  index: LocalComicPanelIndex;
  outputPath: string;
  ffmpegCommand?: string;
}): Promise<string | null> {
  const rasterPanels: LocalComicPanelEvidence[] = [];
  for (const panel of input.index.pages.flatMap((page) => page.panels)) {
    if (!panel.valid) continue;
    if (await fileExists(panel.panelImagePath)) rasterPanels.push(panel);
  }

  if (rasterPanels.length === 0) return null;

  await mkdir(dirname(input.outputPath), { recursive: true });
  const ffmpegCommand = input.ffmpegCommand ?? "ffmpeg";
  const annotatedDir = join(dirname(input.outputPath), `${basename(input.outputPath)}.annotated`);
  await mkdir(annotatedDir, { recursive: true });

  const annotatedPaths: string[] = [];
  for (const [index, panel] of rasterPanels.entries()) {
    const characters = formatCharacterNames(panel.localEvidence.characters);
    const action = panel.localEvidence.actions[0]?.label ?? "none";
    const relation = panel.localEvidence.relationships[0]?.type ?? "none";
    const shaShort = panel.panelImageSha256.slice(0, 8);
    const label = escapeDrawtext(
      `p${panel.pageNumber}#${panel.panelNumber} | ${panel.panelId} | ${characters} | ${action} | ${relation} | ${panel.storyFunction} | c${Math.round(panel.confidence.overall * 100)} | ${shaShort}`
    );

    const annotatedPath = join(annotatedDir, `panel-${String(index + 1).padStart(3, "0")}.jpg`);
    await runFfmpegCommand(ffmpegCommand, [
      "-y",
      "-hide_banner",
      "-loglevel",
      "error",
      "-i",
      panel.panelImagePath,
      "-vf",
      `scale=320:320:force_original_aspect_ratio=decrease,pad=320:320:(ow-iw)/2:(oh-ih)/2:color=black,drawtext=text='${label}':fontsize=10:fontcolor=white:x=8:y=8:box=1:boxcolor=black@0.55`,
      "-frames:v",
      "1",
      annotatedPath
    ]);
    annotatedPaths.push(annotatedPath);
  }

  if (annotatedPaths.length === 0) return null;

  const listPath = `${input.outputPath}.list.txt`;
  const escaped = annotatedPaths.map((path) => `file '${path.replace(/'/g, "'\\''")}'`).join("\n");
  await writeFile(listPath, escaped, "utf8");

  try {
    const columns = Math.min(4, Math.max(1, Math.ceil(Math.sqrt(annotatedPaths.length))));
    const rows = Math.ceil(annotatedPaths.length / columns);
    await runFfmpegCommand(ffmpegCommand, [
      "-y",
      "-hide_banner",
      "-loglevel",
      "error",
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      listPath,
      "-vf",
      `tile=${columns}x${rows}`,
      "-frames:v",
      "1",
      input.outputPath
    ]);
    return resolve(input.outputPath);
  } catch {
    return null;
  }
}

export async function saveLocalPanelIndexReports(input: {
  index: LocalComicPanelIndex;
  indexPath: string;
  projectRoot: string;
  ffmpegCommand?: string;
  beatAssignments?: ActualPanelCropBeatAssignment[];
}): Promise<{
  reportPath: string;
  contactSheetPath: string | null;
  report: LocalPanelIndexReport;
  actualPanelCropsReportPath?: string;
  actualPanelCropsContactSheetPath?: string | null;
}> {
  const tmpDir = join(resolve(input.projectRoot), "tmp");
  await mkdir(tmpDir, { recursive: true });
  const reportPath = join(tmpDir, LOCAL_PANEL_INDEX_REPORT_FILENAME);
  const contactSheetTarget = join(tmpDir, LOCAL_PANEL_INDEX_CONTACT_SHEET_FILENAME);

  const contactSheetPath = await renderLocalPanelIndexContactSheet({
    index: input.index,
    outputPath: contactSheetTarget,
    ...(input.ffmpegCommand ? { ffmpegCommand: input.ffmpegCommand } : {})
  });

  const report = buildLocalPanelIndexReport({
    index: input.index,
    indexPath: input.indexPath,
    contactSheetPath
  });
  await writeFile(reportPath, JSON.stringify(report, null, 2), "utf8");

  const actualPanelCrops = await saveActualPanelCropsReport({
    index: input.index,
    indexPath: input.indexPath,
    projectRoot: input.projectRoot,
    ...(input.beatAssignments ? { beatAssignments: input.beatAssignments } : {}),
    ...(input.ffmpegCommand ? { ffmpegCommand: input.ffmpegCommand } : {})
  });

  return {
    reportPath,
    contactSheetPath,
    report,
    actualPanelCropsReportPath: actualPanelCrops.reportPath,
    actualPanelCropsContactSheetPath: actualPanelCrops.contactSheetPath
  };
}

export async function buildLocalComicPanelIndex(input: {
  assetDirectory: string;
  pages: Array<{
    id: string;
    assetPath: string;
    title: string;
    description?: string;
    tags?: string[];
    width: number;
    height: number;
    bytes?: number;
    contentHash: string;
    mediaType?: string;
  }>;
  ffmpegCommand?: string;
  forceRebuild?: boolean;
  projectRoot?: string;
}): Promise<{ index: LocalComicPanelIndex; warnings: string[]; reportPath?: string; contactSheetPath?: string | null }> {
  const assetDirectory = resolve(input.assetDirectory);
  const warnings: string[] = [];
  const indexedPages: LocalComicPanelIndexPage[] = [];

  const rasterPages = input.pages.filter(
    (page) => page.mediaType !== "video" && /\.(jpe?g|png|webp|gif|avif)$/i.test(page.assetPath)
  );

  for (const page of rasterPages) {
    try {
      const pageResult = await indexUserProvidedComicPage({
        assetId: page.id,
        assetPath: page.assetPath,
        title: page.title,
        ...(page.description !== undefined ? { description: page.description } : {}),
        ...(page.tags !== undefined ? { tags: page.tags } : {}),
        width: page.width,
        height: page.height,
        ...(page.bytes !== undefined ? { bytes: page.bytes } : {}),
        contentHash: page.contentHash,
        assetDirectory,
        ...(input.ffmpegCommand ? { ffmpegCommand: input.ffmpegCommand } : {}),
        ...(input.forceRebuild ? { forceRebuild: true } : {})
      });
      indexedPages.push({
        sourceAssetId: page.id,
        sourcePagePath: page.assetPath,
        sourceContentHash: page.contentHash,
        pageNumber: extractPageIndex(page.title) ?? 0,
        pageType: pageResult.pageType,
        indexable: pageResult.indexable,
        parentContext: extractParentContextFromPageMetadata({
          title: page.title,
          ...(page.description !== undefined ? { description: page.description } : {}),
          ...(page.tags !== undefined ? { tags: page.tags } : {})
        }),
        panels: pageResult.panels
      });
    } catch (error) {
      warnings.push(
        `panel_index_page_failed:${basename(page.assetPath)}:${error instanceof Error ? error.message : "unknown"}`
      );
    }
  }

  const sequenceCount = assignLocalPanelSequences(indexedPages);
  const allPanels = indexedPages.flatMap((page) => page.panels);
  const index: LocalComicPanelIndex = {
    version: LOCAL_PANEL_INDEX_VERSION,
    assetDirectory,
    generatedAt: new Date().toISOString(),
    sourcePageCount: indexedPages.length,
    panelCount: allPanels.length,
    validPanelCount: allPanels.filter((panel) => panel.valid).length,
    rejectedPanelCount: allPanels.filter((panel) => !panel.valid).length,
    sequenceCount,
    pages: indexedPages
  };

  let reportPath: string | undefined;
  let contactSheetPath: string | null | undefined;
  if (input.projectRoot) {
    const indexPath = resolveLocalPanelIndexPath(assetDirectory);
    const saved = await saveLocalPanelIndexReports({
      index,
      indexPath,
      projectRoot: input.projectRoot,
      ...(input.ffmpegCommand ? { ffmpegCommand: input.ffmpegCommand } : {})
    });
    reportPath = saved.reportPath;
    contactSheetPath = saved.contactSheetPath;
  }

  return {
    index,
    warnings,
    ...(reportPath ? { reportPath } : {}),
    ...(contactSheetPath !== undefined ? { contactSheetPath } : {})
  };
}

export async function upsertLocalComicPanelIndex(input: {
  assetDirectory: string;
  pages: Array<{
    id: string;
    assetPath: string;
    title: string;
    description?: string;
    tags?: string[];
    width: number;
    height: number;
    bytes?: number;
    contentHash: string;
    mediaType?: string;
  }>;
  ffmpegCommand?: string;
  forceRebuild?: boolean;
  projectRoot?: string;
}): Promise<{
  index: LocalComicPanelIndex;
  indexPath: string;
  warnings: string[];
  reportPath?: string;
  contactSheetPath?: string | null;
}> {
  const warnings: string[] = [];
  const existing = input.forceRebuild ? null : await loadLocalComicPanelIndex(input.assetDirectory);
  const existingByHash = new Map(
    (existing?.pages ?? []).map((page) => [page.sourceContentHash, page])
  );

  const pagesToIndex = input.pages.filter((page) => {
    if (input.forceRebuild) return true;
    const cached = existingByHash.get(page.contentHash);
    return !cached;
  });

  const mergedPages: LocalComicPanelIndexPage[] = [];

  for (const page of input.pages) {
    const cached = !input.forceRebuild ? existingByHash.get(page.contentHash) : null;
    if (cached) {
      mergedPages.push(cached);
    }
  }

  if (pagesToIndex.length > 0) {
    const { index: rebuilt, warnings: buildWarnings } = await buildLocalComicPanelIndex({
      assetDirectory: input.assetDirectory,
      pages: pagesToIndex,
      ...(input.ffmpegCommand ? { ffmpegCommand: input.ffmpegCommand } : {}),
      ...(input.forceRebuild ? { forceRebuild: true } : {}),
      ...(input.projectRoot ? { projectRoot: input.projectRoot } : {})
    });
    warnings.push(...buildWarnings);
    const rebuiltByHash = new Map(rebuilt.pages.map((page) => [page.sourceContentHash, page]));
    for (const page of input.pages) {
      if (mergedPages.some((entry) => entry.sourceContentHash === page.contentHash)) continue;
      const indexed = rebuiltByHash.get(page.contentHash);
      if (indexed) mergedPages.push(indexed);
    }
  }

  mergedPages.sort((left, right) => left.pageNumber - right.pageNumber);
  const sequenceCount = assignLocalPanelSequences(mergedPages);
  const allPanels = mergedPages.flatMap((page) => page.panels);

  const merged: LocalComicPanelIndex = {
    version: LOCAL_PANEL_INDEX_VERSION,
    assetDirectory: resolve(input.assetDirectory),
    generatedAt: new Date().toISOString(),
    sourcePageCount: mergedPages.length,
    panelCount: allPanels.length,
    validPanelCount: allPanels.filter((panel) => panel.valid).length,
    rejectedPanelCount: allPanels.filter((panel) => !panel.valid).length,
    sequenceCount,
    pages: mergedPages
  };

  const indexPath = await saveLocalComicPanelIndex(input.assetDirectory, merged);
  warnings.push(
    `local_panel_index_saved:${merged.validPanelCount} valid / ${merged.panelCount} total panels from ${merged.sourcePageCount} pages`
  );

  let reportPath: string | undefined;
  let contactSheetPath: string | null | undefined;
  if (input.projectRoot) {
    const saved = await saveLocalPanelIndexReports({
      index: merged,
      indexPath,
      projectRoot: input.projectRoot,
      ...(input.ffmpegCommand ? { ffmpegCommand: input.ffmpegCommand } : {})
    });
    reportPath = saved.reportPath;
    contactSheetPath = saved.contactSheetPath;
  }

  return {
    index: merged,
    indexPath,
    warnings,
    ...(reportPath ? { reportPath } : {}),
    ...(contactSheetPath !== undefined ? { contactSheetPath } : {})
  };
}

export function findLocalPanelById(
  index: LocalComicPanelIndex,
  panelId: string
): LocalComicPanelEvidence | null {
  for (const page of index.pages) {
    const hit = page.panels.find((panel) => panel.panelId === panelId);
    if (hit) return hit;
  }
  return null;
}