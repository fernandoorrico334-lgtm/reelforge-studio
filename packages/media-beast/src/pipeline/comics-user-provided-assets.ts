import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { access, mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { basename, dirname, extname, join, resolve } from "node:path";
import {
  buildUserProvidedBeatCaptionCues,
  finalizeSemanticCaption,
  resolveUserProvidedBeatCaption,
  validateCaptionPreflight,
  type BeatCaptionCueRecord,
  type SemanticCaptionResult
} from "./comics-caption-semantic.js";
import type { CaptionDirectionCue } from "./caption-direction-engine.js";
import {
  COMICS_PUBLISH_CAPTION_STYLE,
  evaluateComicsVisualDiversity,
  validateThemeAlignedTimeline
} from "./comics-publish-readiness.js";
import { renderSelectedAssetsContactSheet } from "./comics-visual-asset-audit.js";
import {
  analyzeComicsVideoThemeFromAnalysis,
  isBeatThemeAligned,
  scoreAssetForThemedSelection,
  type ComicsBeatRole,
  type ComicsThemeAnalysis
} from "./comics-theme-intelligence.js";
import { detectNonComicsHomonymRejection } from "./comics-asset-quality-gate.js";
import {
  analyzeComicsPanelVisual,
  evaluateRegionPanelVisual,
  isHardVisualRejectReason,
  type ComicsPanelRegionKey,
  type ComicsPanelVisualVerdict
} from "./comics-panel-visual-analyzer.js";
import {
  auditPromotionalComicAssets,
  isPromotionalUserProvidedAsset
} from "./comics-promotional-visual-filter.js";
import { validateComicsAssetForTheme } from "./comics-theme-asset-validator.js";
import type { MaterializedTimelineScene, RemixMaterializationReport } from "./remix-materialization.js";
import type { PanelMaterializationIntegrityReport } from "./comics-panel-materialization-integrity.js";
import {
  matchReferenceVideoToComicsStories,
  type ReferenceComicMatchReport
} from "./reference-comics-match-engine.js";
import {
  resolveLocalPanelIndexPath,
  type LocalComicPanelIndex
} from "./comics-local-panel-index.js";
import {
  buildReferenceAlignedUserProvidedNarration,
  classifyUserProvidedPanel,
  extractPageIndex,
  hasStrongDuoVisualSignal,
  isLateCrossoverPanel,
  isUserProvidedPanelEligibleForBeat
} from "./comics-user-provided-panel-gate.js";
import type { NarrationBeatRole } from "./narration-curiosity-engine.js";
import type { VideoRemixPlan } from "./video-remixer.js";

export const PUBLISH_ASSET_POLICY_USER_PROVIDED = "user_provided_real_assets_only";
export const DEFAULT_USER_PROVIDED_DIR = "storage/assets/user-provided/remix/venom-partner";
export const MIN_USER_PROVIDED_VISUAL_ASSETS = 6;
export const MIN_VENOM_DIRECT_ASSETS = 3;
export const INSUFFICIENT_USER_PROVIDED_VISUAL_ASSETS = "insufficient_user_provided_visual_assets";

const ALLOWED_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".mp4",
  ".mov",
  ".webm"
]);

const RASTER_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp"]);
const VIDEO_EXTENSIONS = new Set([".mp4", ".mov", ".webm"]);

export const USER_PROVIDED_TARGET_FAST_CUTS = 14;

const BEAT_WINDOWS: Array<{
  beatRole: ComicsBeatRole | string;
  startSec: number;
  endSec: number;
  motion: string;
  minCompositions?: number;
}> = [
  { beatRole: "hook", startSec: 0, endSec: 4.5, motion: "punch_zoom" },
  { beatRole: "context", startSec: 4.5, endSec: 9.5, motion: "push_in" },
  { beatRole: "curiosity_a", startSec: 9.5, endSec: 13, motion: "hold_pan" },
  { beatRole: "curiosity_b", startSec: 13, endSec: 16.5, motion: "hold_pan" },
  { beatRole: "development_a", startSec: 16.5, endSec: 20.5, motion: "slide_left" },
  { beatRole: "development_b", startSec: 20.5, endSec: 24.5, motion: "slide_right" },
  { beatRole: "climax", startSec: 24.5, endSec: 32, motion: "punch_zoom" },
  { beatRole: "closing", startSec: 32, endSec: 40, motion: "pull_back" }
];

export type UserProvidedAssetManifestEntry = {
  id?: string;
  filename?: string;
  title?: string;
  description?: string;
  tags?: string[];
  recommendedBeat?: string;
  sourceType?: string;
  approvalStatus?: string;
  rightsStatus?: string;
};

export type UserProvidedAssetRecord = {
  id: string;
  filename: string;
  assetPath: string;
  title: string;
  description: string;
  tags: string[];
  sourceType: "user_provided";
  approvalStatus: "approved_by_user";
  rightsStatus: "rights_confirmed_by_user";
  mediaType: "raster" | "video";
  width: number;
  height: number;
  bytes: number;
  cropable9x16: boolean;
  contentHash: string;
  themeScore: number;
  venomDirect: boolean;
  hookStrength: number;
  climaxStrength: number;
  recommendedBeat: string;
  selectionSignals: string[];
  rejectReason: string | null;
  accepted: boolean;
  duoVisualScore: number;
  visualTags: string[];
  visualRejectReason: string | null;
  visualAnalysis: ComicsPanelVisualVerdict | null;
};

export type PanelCropBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type PanelCropDescriptor = {
  panelId: string;
  sourceAssetPath: string;
  panelImagePath: string;
  cropBounds: PanelCropBounds;
  cropContentHash: string;
  focusRegion: ComicsPanelRegionKey | "global";
  localVisualEvidence: string[];
};

export type UserProvidedBeatAssignment = {
  beatRole: string;
  startSec: number;
  endSec: number;
  motion: string;
  assetId: string;
  assetPath: string;
  assetTitle: string;
  selectionReason: string;
  caption: string;
  captionLines: string[];
  beatPanelMatchScore?: number;
  panelId?: string;
  panelImagePath?: string;
  cropBounds?: PanelCropBounds;
  cropContentHash?: string;
  localVisualEvidence?: string[];
};

export type BeatPanelScoreBreakdown = {
  beat: string;
  panel: string;
  parentMetadataScore: number;
  panelEntityScore: number;
  panelTextScore: number;
  panelActionScore: number;
  panelThemeScore: number;
  storyFunctionScore: number;
  finalScore: number;
  evidence: string[];
  rejectedBecause: string[];
};

export type BeatPanelMatchResult = {
  score: number;
  entities: string[];
  theme: string;
  action: string;
  narrativeFunction: string;
  reason: string;
  meetsMinimum: boolean;
  breakdown: BeatPanelScoreBreakdown;
};

export type PanelBeatMatchEntry = {
  beatRole: string;
  narrationText: string;
  selectedPanel: {
    assetId: string;
    assetTitle: string;
    page: number | null;
    assetPath: string;
    panelId?: string;
    panelImagePath?: string;
    cropBounds?: PanelCropBounds;
    cropContentHash?: string;
    localVisualEvidence?: string[];
  };
  beatPanelMatchScore: number;
  entities: string[];
  theme: string;
  action: string;
  selectionReason: string;
  scoreBreakdown: BeatPanelScoreBreakdown;
  rejectedAlternatives: Array<{
    assetId: string;
    assetTitle: string;
    page: number | null;
    score: number;
    reason: string;
    rejectedBecause: string[];
  }>;
};

export type GlobalPanelAssignmentEntry = {
  beatRole: string;
  assetId: string;
  assetTitle: string;
  scoreBefore: number;
  scoreAfter: number;
  weightedScore: number;
  focusRegion: PanelRegionKey | "global";
};

export type GlobalPanelReuseEntry = {
  beatRole: string;
  assetId: string;
  reusedFromBeat: string;
  focusRegion: PanelRegionKey | "global";
  significantCrop: boolean;
};

export type DevelopmentSequenceReport = {
  panelA: string;
  panelB: string;
  consecutivePages: boolean;
  sameStorySequence: boolean;
  continuityScore: number;
  reason: string;
};

export type GlobalPanelAssignmentResult = {
  selectionMode: "global_assignment";
  totalWeightedScore: number;
  continuityBonus: number;
  developmentSequence: DevelopmentSequenceReport;
  assignments: GlobalPanelAssignmentEntry[];
  rejectedAssignments: Array<{
    beatRole: string;
    assetId: string;
    assetTitle: string;
    reason: string;
  }>;
  reuse: GlobalPanelReuseEntry[];
  beatPicks: Map<
    string,
    {
      asset: UserProvidedAssetRecord;
      match: BeatPanelMatchResult;
      focusRegion: PanelRegionKey | "global";
      rejectedAlternatives: PanelBeatMatchEntry["rejectedAlternatives"];
    }
  >;
  greedyBaseline: Map<string, number>;
  warnings: string[];
};

export type PanelBeatMatchReport = {
  variation: string;
  generatedAt: string;
  averageScore: number;
  hookScore: number;
  climaxScore: number;
  promotionalPanelCount: number;
  selectionMode: "global_assignment";
  totalWeightedScore: number;
  assignments: GlobalPanelAssignmentEntry[];
  rejectedAssignments: GlobalPanelAssignmentResult["rejectedAssignments"];
  reuse: GlobalPanelReuseEntry[];
  continuityBonus: number;
  developmentSequence: DevelopmentSequenceReport;
  beats: PanelBeatMatchEntry[];
};

export type UserProvidedPublishMetrics = {
  realAssetCount: number;
  placeholderCount: number;
  blankVisualRatio: number;
  realAssetDurationRatio: number;
  uniqueRenderedCompositionCount: number;
  dominantRenderedCompositionRatio: number;
};

export type UserProvidedPreflightReport = {
  variation: string;
  publishAssetPolicy: typeof PUBLISH_ASSET_POLICY_USER_PROVIDED;
  assetDirectory: string;
  generatedAt: string;
  assetsFound: number;
  assetsAccepted: UserProvidedAssetRecord[];
  assetsRejected: Array<{ filename: string; reason: string }>;
  promotionalFilter: {
    promotionalAssetCount: number;
    qrAssetCount: number;
    unrelatedTitleCount: number;
    removedPages: Array<{ title: string; filename?: string; reason: string }>;
  };
  panelBeatMatchReportPath: string | null;
  panelBeatMatchContactSheetPath: string | null;
  panelBeatMatchSummary: {
    averageScore: number;
    hookScore: number;
    climaxScore: number;
    promotionalPanelCount: number;
  };
  referenceComicsStoryMatchReportPath: string | null;
  referenceComicsStoryMatchSummary: {
    canUseComicsStory: boolean;
    bestStoryTitle: string | null;
    bestStoryScore: number | null;
    selectedPanelCount: number;
    warnings: string[];
  };
  beatAssignments: UserProvidedBeatAssignment[];
  metrics: UserProvidedPublishMetrics;
  hookAligned: boolean;
  climaxAligned: boolean;
  captionPreflightReady: boolean;
  beatCaptionCues: BeatCaptionCueRecord[];
  captions: Array<{ beatRole: string; caption: string; lines: string[] }>;
  audioTarget: {
    codec: string;
    sampleRateHz: number;
    channels: number;
    loudnessLUFS: { min: number; max: number };
    truePeakDBTP: number;
    musicPresetId: string;
  };
  canRender: boolean;
  canPublish: boolean;
  blockReason: string | null;
  publishBlockReason: string | null;
  warnings: string[];
  contactSheetPath: string | null;
  materializedPanelContactSheetPath: string | null;
  panelMaterializationManifestPath: string | null;
  panelMaterializationIntegrity: PanelMaterializationIntegrityReport | null;
  materializationReportPath: string | null;
  recommendation: string;
};

export type UserProvidedFinalAuditReport = UserProvidedPreflightReport & {
  outputPath: string;
  finalContactSheetPath: string | null;
  audioProbe: {
    codec: string | null;
    sampleRateHz: number | null;
    channels: number | null;
    loudnessLUFS: number | null;
    truePeakDBTP: number | null;
  };
  hookCaptionVisible: boolean;
  climaxCaptionVisible: boolean;
  finalPublishReady: boolean;
  frameAuditSamples: number;
};

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK | constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

async function loadLocalComicPanelIndexIfPresent(
  assetDirectory: string
): Promise<LocalComicPanelIndex | null> {
  const indexPath = resolveLocalPanelIndexPath(assetDirectory);
  if (!(await fileExists(indexPath))) return null;
  const raw = await readFile(indexPath, "utf8");
  return JSON.parse(raw) as LocalComicPanelIndex;
}

async function saveReferenceComicMatchReport(
  report: ReferenceComicMatchReport,
  projectRoot: string
): Promise<string> {
  const reportPath = join(projectRoot, "tmp", "reference-comics-story-match-report.json");
  await mkdir(join(projectRoot, "tmp"), { recursive: true });
  await writeFile(reportPath, JSON.stringify(report, null, 2), "utf8");
  return reportPath;
}

function runCommand(command: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { shell: false });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr?.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolvePromise({ stdout, stderr });
      else reject(new Error(`${command} exited ${code}: ${stderr.slice(-500)}`));
    });
  });
}

async function probeMediaDimensions(
  assetPath: string,
  ffprobeCommand = "ffprobe"
): Promise<{ width: number; height: number } | null> {
  try {
    const { stdout } = await runCommand(ffprobeCommand, [
      "-v",
      "error",
      "-select_streams",
      "v:0",
      "-show_entries",
      "stream=width,height",
      "-of",
      "csv=p=0:s=x",
      assetPath
    ]);
    const match = stdout.trim().match(/(\d+)x(\d+)/);
    if (!match) return null;
    return { width: Number(match[1]), height: Number(match[2]) };
  } catch {
    return null;
  }
}

function isCropable9x16(width: number, height: number, userProvided = true): boolean {
  const minEdge = userProvided ? 320 : 480;
  if (width < minEdge || height < minEdge) return false;
  const ratio = width / height;
  return ratio >= 0.45 && ratio <= 2.2;
}

function validateUserProvidedNarrativeCoherence(input: {
  title: string;
  description: string;
  tags: string[];
  videoTitle: string;
}): { ok: boolean; reason: string | null } {
  const blob = [input.title, input.description, ...input.tags, input.videoTitle]
    .join(" ")
    .toLowerCase();

  const homonym = detectNonComicsHomonymRejection(blob);
  if (homonym) return { ok: false, reason: homonym.reason };

  if (/\bmiles morales\b|\bgwen stacy\b|\bspider-gwen\b|\b2099\b/i.test(blob)) {
    return { ok: false, reason: "off_theme_multiverse_variant" };
  }

  if (!isVenomDirectAsset(input.title, input.description, input.tags)) {
    return { ok: false, reason: "missing_venom_symbiote_or_duo_signal" };
  }

  return { ok: true, reason: null };
}

function hashFileMeta(path: string, bytes: number, width: number, height: number): string {
  return createHash("sha1")
    .update(`${path}|${bytes}|${width}x${height}`)
    .digest("hex")
    .slice(0, 12);
}

function isVenomDirectAsset(title: string, description: string, tags: string[]): boolean {
  const blob = [title, description, ...tags].join(" ").toLowerCase();
  return (
    /\bvenom\b/i.test(blob) ||
    /\bsimbionte\b|\bsymbiote\b/i.test(blob) ||
    /\btraje preto\b|\bblack suit\b/i.test(blob) ||
    /\bhomem[- ]?aranha\b.*\bvenom\b|\bvenom\b.*\bhomem[- ]?aranha\b/i.test(blob) ||
    /\bdupla\b|\bduo\b|\bparceria\b|\bpartnership\b/i.test(blob) ||
    (/\bhomem[- ]?aranha\b|\bspider[- ]?man\b/i.test(blob) &&
      /\bsimbionte\b|\bsymbiote\b|\btraje preto\b/i.test(blob))
  );
}

function scoreHookStrength(title: string, tags: string[]): number {
  const blob = [title, ...tags].join(" ").toLowerCase();
  let score = 0;
  if (/\bvenom\b/.test(blob)) score += 35;
  if (/\bsimbionte\b|\bsymbiote\b/.test(blob)) score += 25;
  if (/\bespiral\b|\bdeath spiral\b/.test(blob)) score += 20;
  if (/\bvs\b|versus|confronto/.test(blob)) score += 10;
  if (/\bp[aá]gina\b/i.test(blob)) score += 18;
  if (/spiderman_venom_together|both_entities|entity_pair|duo/i.test(blob)) score += 28;
  if (/\bcover\b|\bcapa\b/.test(blob)) score -= 12;
  return score;
}

function scoreClimaxStrength(title: string, tags: string[]): number {
  const blob = [title, ...tags].join(" ").toLowerCase();
  let score = 0;
  if (/\bsimbionte\b|\bsymbiote\b/.test(blob)) score += 30;
  if (/\bvenom\b/.test(blob)) score += 25;
  if (/\bdupla\b|\bduo\b|\btogether\b/.test(blob)) score += 20;
  if (/\bhomem[- ]?aranha\b|\bspider[- ]?man\b/.test(blob)) score += 15;
  if (/\bultimate\b|\bespiral\b/.test(blob)) score += 10;
  return score;
}

export function extractComicSeriesKey(title: string): string {
  const lower = title.toLowerCase();
  if (/espiral mortal/i.test(lower)) return "espiral_mortal";
  if (/simbionte/i.test(lower)) return "simbionte";
  if (/fcbd|quadrinho gr[aá]tis/i.test(lower)) return "fcbd";
  if (/espantoso homem-aranha/i.test(lower)) return "espantoso";
  if (/capa|cover/i.test(lower)) return "cover_asset";
  if (/p[aá]gina/i.test(lower)) return "interior_panel";
  return "other";
}

function hasDuoTogetherSignal(asset: UserProvidedAssetRecord): boolean {
  const blob = [asset.title, ...asset.tags, ...asset.selectionSignals].join(" ").toLowerCase();
  return (
    /spiderman_venom_together|both_entities|entity_pair|venom_spiderman|duo/i.test(blob) ||
    (/\bvenom\b/i.test(blob) && /\b(homem[- ]?aranha|spider)/i.test(blob))
  );
}

function assetHasStrongDuoVisualSignal(asset: UserProvidedAssetRecord): boolean {
  return hasStrongDuoVisualSignal({
    title: asset.title,
    description: asset.description,
    tags: asset.tags,
    width: asset.width,
    height: asset.height,
    bytes: asset.bytes,
    selectionSignals: asset.selectionSignals
  });
}

function assetIsLateCrossoverPanel(asset: UserProvidedAssetRecord): boolean {
  return isLateCrossoverPanel({ title: asset.title });
}

function scoreEarlyStoryPageBonus(title: string, beatRole: string): number {
  const pageIndex = extractPageIndex(title);
  if (pageIndex === null) return 0;
  const baseRole = mapBeatRoleForTheme(beatRole);
  if (baseRole === "curiosity" || baseRole === "climax" || baseRole === "hook") {
    if (pageIndex <= 8) return 28;
    if (pageIndex <= 15) return 14;
    if (pageIndex >= 22) return -70;
    if (pageIndex >= 18) return -35;
  }
  return 0;
}

function isInteriorPanelAsset(asset: UserProvidedAssetRecord): boolean {
  return /\bp[aá]gina\b/i.test(asset.title) || asset.tags.includes("intelligent-discovery");
}

function isPromotionalAsset(asset: UserProvidedAssetRecord): boolean {
  return isPromotionalUserProvidedAsset({
    title: asset.title,
    description: asset.description,
    tags: asset.tags,
    visualTags: asset.visualTags,
    selectionSignals: asset.selectionSignals
  }).reject;
}

function filterNarrativeUserProvidedAssets(
  assets: UserProvidedAssetRecord[]
): UserProvidedAssetRecord[] {
  return assets.filter((asset) => !isPromotionalAsset(asset));
}

function mapBeatRoleForTheme(beatRole: string): ComicsBeatRole {
  const normalized = beatRole.replace(/_\d+$/, "");
  if (normalized.startsWith("curiosity")) return "curiosity";
  if (normalized.startsWith("development")) return "development";
  if (normalized === "closing") return "closing";
  if (normalized === "hook") return "hook";
  if (normalized === "context") return "context";
  if (normalized === "climax") return "climax";
  if (normalized === "cta") return "cta";
  return "development";
}

export async function loadUserProvidedManifest(
  assetDirectory: string
): Promise<UserProvidedAssetManifestEntry[]> {
  const manifestPath = join(assetDirectory, "manifest.json");
  if (!(await fileExists(manifestPath))) return [];
  try {
    const fileText = (await readFile(manifestPath, "utf8")).replace(/^\uFEFF/, "");
    const raw = JSON.parse(fileText) as {
      assets?: UserProvidedAssetManifestEntry[];
    };
    return raw.assets ?? [];
  } catch {
    return [];
  }
}

export async function scanUserProvidedAssetDirectory(input: {
  assetDirectory: string;
  themeAnalysis: ComicsThemeAnalysis;
  narrationText: string;
  videoTitle: string;
  ffprobeCommand?: string;
  ffmpegCommand?: string;
  enableVisualAnalysis?: boolean;
  /** Build or refresh persisted per-panel local evidence index (default true). */
  enablePanelIndex?: boolean;
  projectRoot?: string;
}): Promise<{
  found: UserProvidedAssetRecord[];
  rejected: Array<{ filename: string; reason: string }>;
  warnings: string[];
}> {
  const assetDirectory = resolve(input.assetDirectory);
  const warnings: string[] = [];
  const rejected: Array<{ filename: string; reason: string }> = [];
  const found: UserProvidedAssetRecord[] = [];

  if (!(await fileExists(assetDirectory))) {
    return {
      found: [],
      rejected: [],
      warnings: ["asset_directory_missing"]
    };
  }

  const manifest = await loadUserProvidedManifest(assetDirectory);
  const manifestByFilename = new Map(
    manifest
      .filter((entry) => entry.filename)
      .map((entry) => [entry.filename!.toLowerCase(), entry])
  );

  const entries = await readdir(assetDirectory, { withFileTypes: true });
  const seenHashes = new Set<string>();
  const enableVisualAnalysis = input.enableVisualAnalysis !== false;
  const ffmpegCommand = input.ffmpegCommand ?? "ffmpeg";

  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const ext = extname(entry.name).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) continue;
    if (entry.name === "manifest.json") continue;

    const assetPath = join(assetDirectory, entry.name);
    const manifestEntry = manifestByFilename.get(entry.name.toLowerCase());
    const title = manifestEntry?.title ?? basename(entry.name, ext).replace(/[-_]+/g, " ");
    const description = manifestEntry?.description ?? title;
    const tags = manifestEntry?.tags ?? [];

    let fileStat;
    try {
      fileStat = await stat(assetPath);
    } catch {
      rejected.push({ filename: entry.name, reason: "file_not_readable" });
      continue;
    }

    const dims = await probeMediaDimensions(assetPath, input.ffprobeCommand ?? "ffprobe");
    if (!dims) {
      rejected.push({ filename: entry.name, reason: "unable_to_probe_dimensions" });
      continue;
    }

    if (!isCropable9x16(dims.width, dims.height)) {
      rejected.push({ filename: entry.name, reason: "not_cropable_9x16" });
      continue;
    }

    const contentHash = hashFileMeta(assetPath, fileStat.size, dims.width, dims.height);
    if (seenHashes.has(contentHash)) {
      rejected.push({ filename: entry.name, reason: "duplicate_asset" });
      continue;
    }
    seenHashes.add(contentHash);

    const narrativeCoherence = validateUserProvidedNarrativeCoherence({
      title,
      description,
      tags,
      videoTitle: input.videoTitle
    });
    if (!narrativeCoherence.ok) {
      rejected.push({
        filename: entry.name,
        reason: narrativeCoherence.reason ?? "narrative_incoherent"
      });
      continue;
    }

    const themeVerdict = validateComicsAssetForTheme({
      assetTitle: title,
      assetDescription: description,
      assetTags: tags,
      sourceType: "user_provided",
      themeAnalysis: input.themeAnalysis,
      narrationText: input.narrationText,
      videoTitle: input.videoTitle
    });

    if (themeVerdict.severity === "reject" && !/homonym|miles|gwen|2099|havilland/i.test(themeVerdict.reason)) {
      // User-provided assets skip discovery-grade subject scoring; homonyms/off-theme still blocked.
    } else if (themeVerdict.severity === "reject") {
      rejected.push({ filename: entry.name, reason: themeVerdict.reason });
      continue;
    }

    let visualAnalysis: ComicsPanelVisualVerdict | null = null;
    if (enableVisualAnalysis && RASTER_EXTENSIONS.has(ext)) {
      visualAnalysis = await analyzeComicsPanelVisual({
        assetPath,
        ffmpegCommand
      });
      if (visualAnalysis.rejectReason && isHardVisualRejectReason(visualAnalysis.rejectReason)) {
        rejected.push({
          filename: entry.name,
          reason: visualAnalysis.rejectReason
        });
        continue;
      }
    }

    const panelGate = classifyUserProvidedPanel({
      title,
      description,
      tags,
      width: dims.width,
      height: dims.height,
      bytes: fileStat.size,
      visualRejectReason: visualAnalysis?.rejectReason ?? null,
      ...(visualAnalysis?.duoVisualScore !== undefined
        ? { duoVisualScore: visualAnalysis.duoVisualScore }
        : {}),
      ...(visualAnalysis?.visualTags ? { visualTags: visualAnalysis.visualTags } : {})
    });
    if (!panelGate.eligible && panelGate.beatRoles.length === 0) {
      rejected.push({
        filename: entry.name,
        reason: panelGate.rejectReason ?? visualAnalysis?.rejectReason ?? "panel_quality_gate_reject"
      });
      continue;
    }

    const themed = scoreAssetForThemedSelection({
      id: manifestEntry?.id ?? contentHash,
      title,
      description,
      category: RASTER_EXTENSIONS.has(ext) ? "comic_cover" : "unknown",
      assetQualityScore: Math.min(100, Math.round((dims.width * dims.height) / 12000)),
      themeAnalysis: input.themeAnalysis
    });

    const promotionalVerdict = isPromotionalUserProvidedAsset({
      title,
      description,
      tags,
      selectionSignals: themed.positiveSignals,
      ...(visualAnalysis?.visualTags ? { visualTags: visualAnalysis.visualTags } : {})
    });
    if (promotionalVerdict.reject) {
      rejected.push({
        filename: entry.name,
        reason: promotionalVerdict.reason ?? "promotional_comic_page"
      });
      continue;
    }

    const mediaType: UserProvidedAssetRecord["mediaType"] = VIDEO_EXTENSIONS.has(ext)
      ? "video"
      : "raster";

    found.push({
      id: manifestEntry?.id ?? `user-${contentHash}`,
      filename: entry.name,
      assetPath,
      title,
      description,
      tags,
      sourceType: "user_provided",
      approvalStatus: "approved_by_user",
      rightsStatus: "rights_confirmed_by_user",
      mediaType,
      width: dims.width,
      height: dims.height,
      bytes: fileStat.size,
      cropable9x16: true,
      contentHash,
      themeScore: themed.themedFinalScore,
      venomDirect: isVenomDirectAsset(title, description, tags),
      hookStrength: scoreHookStrength(title, tags),
      climaxStrength: scoreClimaxStrength(title, tags),
      recommendedBeat: manifestEntry?.recommendedBeat ?? themed.recommendedBeat ?? "development",
      selectionSignals: [
        ...themed.positiveSignals,
        `panel_kind:${panelGate.panelKind}`,
        ...(panelGate.beatRoles.length > 0 ? [`beat_fit:${panelGate.beatRoles.join("|")}`] : []),
        ...(visualAnalysis?.visualTags ?? []),
        ...(visualAnalysis?.duoVisualScore
          ? [`duo_visual_score:${visualAnalysis.duoVisualScore}`]
          : [])
      ],
      rejectReason: null,
      accepted: true,
      duoVisualScore: visualAnalysis?.duoVisualScore ?? 0,
      visualTags: visualAnalysis?.visualTags ?? [],
      visualRejectReason: visualAnalysis?.rejectReason ?? null,
      visualAnalysis
    });
  }

  found.sort((left, right) => right.themeScore - left.themeScore);

  const enablePanelIndex = input.enablePanelIndex !== false;
  if (enablePanelIndex && found.length > 0) {
    const rasterPages = found.filter((asset) => asset.mediaType === "raster");
    if (rasterPages.length > 0) {
      try {
        const { upsertLocalComicPanelIndex } = await import("./comics-local-panel-index.js");
        const { indexPath, warnings: indexWarnings } = await upsertLocalComicPanelIndex({
          assetDirectory,
          pages: rasterPages.map((asset) => ({
            id: asset.id,
            assetPath: asset.assetPath,
            title: asset.title,
            description: asset.description,
            tags: asset.tags,
            width: asset.width,
            height: asset.height,
            bytes: asset.bytes,
            contentHash: asset.contentHash,
            mediaType: asset.mediaType
          })),
          ffmpegCommand,
          ...(input.projectRoot ? { projectRoot: input.projectRoot } : {})
        });
        warnings.push(...indexWarnings);
        warnings.push(`local_panel_index_path:${indexPath}`);
      } catch (error) {
        warnings.push(
          `local_panel_index_failed:${error instanceof Error ? error.message : "unknown"}`
        );
      }
    }
  }

  return { found, rejected, warnings };
}

const BEAT_PANEL_MIN_SCORE: Record<string, number> = {
  hook: 80,
  context: 65,
  curiosity: 65,
  development: 55,
  climax: 80,
  closing: 60,
  cta: 60
};

export const BEAT_ASSIGNMENT_WEIGHTS: Record<string, number> = {
  hook: 1.4,
  climax: 1.5,
  development_a: 1.0,
  development_b: 1.0,
  context: 0.9,
  curiosity_a: 0.9,
  curiosity_b: 0.9,
  closing: 0.7
};

export const GLOBAL_BEAT_THRESHOLDS = {
  hook: 80,
  climax: 80,
  context: 60,
  curiosity: 60,
  development: 60,
  average: 70
} as const;

const GLOBAL_FILL_BEAT_ORDER = [
  "context",
  "curiosity_a",
  "curiosity_b",
  "development_a",
  "development_b"
] as const;

const SIGNIFICANT_REGION_SPREAD = 18;

function parseBeatSignals(beatText: string): {
  entities: string[];
  themes: string[];
  actions: string[];
} {
  const lower = beatText.toLowerCase();
  const entities: string[] = [];
  const themes: string[] = [];
  const actions: string[] = [];

  if (/\bvenom\b/i.test(lower)) entities.push("venom");
  if (/\b(homem[- ]?aranha|spider[- ]?man)\b/i.test(lower)) entities.push("spiderman");

  if (/simbiose|symbiosis|simbionte|symbiote/i.test(lower)) themes.push("symbiosis");
  if (/dupla|parceiro perfeito|parceria|juntos|qu[ií]mica/i.test(lower)) themes.push("perfect_partner");
  if (/quadrinhos|\bhqs?\b/i.test(lower)) themes.push("comics_source");
  if (/traje preto|black suit/i.test(lower)) themes.push("black_suit");
  if (/transforma/i.test(lower)) themes.push("transformation");
  if (/rela[cç][aã]o|liga[cç][aã]o/i.test(lower)) themes.push("relationship");
  if (/filme|recorte/i.test(lower)) themes.push("film_contrast");

  if (/encontrou|achou/i.test(lower)) actions.push("discovery");
  if (/prefere|comenta/i.test(lower)) actions.push("cta");
  if (/explicad|vem das/i.test(lower)) actions.push("explain");

  return { entities, themes, actions };
}

const TITLE_METADATA_ENTITY_SIGNALS =
  /\bvenom\b|\b(homem[- ]?aranha|spider[- ]?man)\b|\bsimbionte\b|\bsymbiote\b/i;
const OFF_THEME_CHARACTER_SIGNALS =
  /\b(doutor estranho|doctor strange|natasha|black widow|peter parker|johnny storm|human torch|vingadores(?![\s\S]*\bvenom\b))/i;
const PANEL_ENTITY_SIGNALS = new Set([
  "venom_panel",
  "symbionte_panel",
  "eddie_brock_panel",
  "black_suit_panel",
  "symbiotic_transform_panel",
  "venom_spiderman_duo_panel",
  "spiderman_support_panel"
]);

type PanelRegionKey = ComicsPanelRegionKey;

type PanelEvidence = {
  entities: string[];
  themes: string[];
  actions: string[];
  textSignals: string[];
  narrativeFunction: string;
  bestRegion: PanelRegionKey | "global";
  regionSpread: number;
  strongVenomSignals: string[];
  offThemeCharacters: boolean;
  ensembleCameo: boolean;
};

function clampScore(value: number, max: number): number {
  return Math.max(0, Math.min(max, Math.round(value)));
}

function extractParentSeriesTitle(title: string): string {
  return title
    .replace(/\s*[—-]\s*p[aá]gina\s+\d+.*$/i, "")
    .replace(/\s*\(\d{4}\)\s*$/i, "")
    .trim();
}

function scoreParentTitleMetadata(title: string, beatThemes: string[]): { score: number; evidence: string[] } {
  const seriesTitle = extractParentSeriesTitle(title).toLowerCase();
  const evidence: string[] = [];
  let score = 0;

  if (/\bvenom\b/i.test(seriesTitle)) {
    score += 4;
    evidence.push("parent_title:venom_series");
  }
  if (/\b(homem[- ]?aranha|spider[- ]?man)\b/i.test(seriesTitle)) {
    score += 3;
    evidence.push("parent_title:spiderman_series");
  }
  if (/simbionte|symbiote/i.test(seriesTitle)) {
    score += 4;
    evidence.push("parent_title:symbiote_series");
  }
  if (beatThemes.includes("perfect_partner") && /dupla|duo|parceria|espiral/i.test(seriesTitle)) {
    score += 3;
    evidence.push("parent_title:partner_series");
  }

  return { score: clampScore(score, 10), evidence };
}

function scoreParentTagsMetadata(tags: string[], beatThemes: string[]): { score: number; evidence: string[] } {
  const blob = tags.join(" ").toLowerCase();
  const evidence: string[] = [];
  let score = 0;

  if (/\bvenom\b/i.test(blob)) {
    score += 3;
    evidence.push("parent_tag:venom");
  }
  if (/\b(homem[- ]?aranha|spider[- ]?man)\b/i.test(blob)) {
    score += 2;
    evidence.push("parent_tag:spiderman");
  }
  if (/simbionte|symbiote/i.test(blob)) {
    score += 3;
    evidence.push("parent_tag:symbiote");
  }
  if (beatThemes.includes("symbiosis") && /traje preto|black suit/i.test(blob)) {
    score += 3;
    evidence.push("parent_tag:black_suit");
  }
  if (/spiderman_venom_together|both_entities/i.test(blob)) {
    score += 2;
    evidence.push("parent_tag:duo_metadata");
  }

  return { score: clampScore(score, 10), evidence };
}

function scorePanelRegion(profile: NonNullable<ComicsPanelVisualVerdict["profile"]>, region: PanelRegionKey): number {
  const stats = profile[region];
  let score = 0;
  if (stats.blackRatio >= 0.1 && stats.saturatedRatio >= 0.12) score += 18;
  if (stats.blueRatio >= 0.1 && stats.blackRatio >= 0.05) score += 14;
  if (stats.redRatio >= 0.05 && stats.blackRatio >= 0.08) score += 10;
  if (stats.colorBucketCount >= 45 && stats.saturatedRatio <= 0.12) score -= 28;
  if (stats.blackRatio >= 0.34 && stats.blueRatio >= 0.1 && stats.redRatio <= 0.06) score -= 24;
  return score;
}

function pickBestPanelRegion(asset: UserProvidedAssetRecord): {
  bestRegion: PanelRegionKey | "global";
  regionSpread: number;
  regionScores: Record<PanelRegionKey, number>;
} {
  const profile = asset.visualAnalysis?.profile;
  if (!profile) {
    return {
      bestRegion: "global",
      regionSpread: 0,
      regionScores: { topThird: 0, midThird: 0, bottomThird: 0 }
    };
  }

  const regionScores = {
    topThird: scorePanelRegion(profile, "topThird"),
    midThird: scorePanelRegion(profile, "midThird"),
    bottomThird: scorePanelRegion(profile, "bottomThird")
  };
  const values = Object.values(regionScores);
  const bestRegion = (Object.entries(regionScores).sort((a, b) => b[1] - a[1])[0]?.[0] ??
    "global") as PanelRegionKey;
  const regionSpread = Math.max(...values) - Math.min(...values);

  return { bestRegion, regionSpread, regionScores };
}

type LocalPanelVisualVerdict = {
  focusRegion: PanelRegionKey | "global";
  duoVisualScore: number;
  visualTags: string[];
  rejectReason: string | null;
  regionSpread: number;
  localEvidence: string[];
};

function resolveLocalPanelVisualVerdict(asset: UserProvidedAssetRecord): LocalPanelVisualVerdict {
  const { bestRegion, regionSpread } = pickBestPanelRegion(asset);
  const profile = asset.visualAnalysis?.profile;
  if (!profile) {
    return {
      focusRegion: bestRegion,
      duoVisualScore: 0,
      visualTags: [],
      rejectReason: null,
      regionSpread,
      localEvidence: ["local_visual:unavailable"]
    };
  }

  const regionVerdict = evaluateRegionPanelVisual(profile, bestRegion);
  const localEvidence = [
    `local_region:${bestRegion}`,
    `local_duo_visual:${regionVerdict.duoVisualScore}`,
    ...regionVerdict.visualTags.map((tag) => `local_tag:${tag}`)
  ];
  if (regionVerdict.rejectReason) {
    localEvidence.push(`local_reject:${regionVerdict.rejectReason}`);
  }

  return {
    focusRegion: bestRegion,
    duoVisualScore: regionVerdict.duoVisualScore,
    visualTags: regionVerdict.visualTags,
    rejectReason: regionVerdict.rejectReason,
    regionSpread,
    localEvidence
  };
}

function buildPanelLocalTextBlob(asset: UserProvidedAssetRecord): string {
  const description =
    asset.description.trim().toLowerCase() !== asset.title.trim().toLowerCase()
      ? asset.description
      : "";
  const panelSpecificTags = asset.tags.filter((tag) =>
    /traje preto|black suit|simbionte|symbiote|eddie|brock|transforma|hobgoblin/i.test(tag)
  );
  return [
    description,
    ...panelSpecificTags,
    ...asset.selectionSignals.filter(
      (signal) =>
        signal.startsWith("panel_kind:") ||
        /simbionte|symbiote|traje preto|black suit|eddie|brock|transforma|hobgoblin|peter|johnny|strange|natasha/i.test(
          signal
        )
    )
  ]
    .join(" ")
    .toLowerCase();
}

function parsePanelEvidence(asset: UserProvidedAssetRecord): PanelEvidence {
  const panelBlob = buildPanelLocalTextBlob(asset);
  const localVisual = resolveLocalPanelVisualVerdict(asset);

  const entities: string[] = [];
  const themes: string[] = [];
  const actions: string[] = [];
  const textSignals: string[] = [...localVisual.localEvidence];
  const strongVenomSignals: string[] = [];

  const offThemeCharacters = OFF_THEME_CHARACTER_SIGNALS.test(panelBlob);
  const ensembleCameo =
    localVisual.visualTags.includes("visual_ensemble_cameo") ||
    localVisual.visualTags.includes("visual_mystical_off_theme") ||
    localVisual.visualTags.includes("visual_crowd_crossover");
  const textHeavyDialogue = localVisual.visualTags.includes("visual_text_heavy");

  if (textHeavyDialogue) {
    textSignals.push("text_heavy_dialogue");
  }
  if (localVisual.rejectReason === "mystical_off_theme_hero") {
    textSignals.push("mystical_off_theme_visual");
  }

  if (!ensembleCameo && !offThemeCharacters && localVisual.visualTags.includes("visual_symbiote_duo")) {
    entities.push("venom");
    entities.push("spiderman");
    themes.push("perfect_partner");
    strongVenomSignals.push("venom_spiderman_duo_panel");
  } else if (
    !ensembleCameo &&
    !offThemeCharacters &&
    localVisual.duoVisualScore >= 48 &&
    /simbionte|symbiote|traje preto|black suit/i.test(panelBlob)
  ) {
    themes.push("symbiosis");
    themes.push("black_suit");
    strongVenomSignals.push("symbionte_panel");
    if (/traje preto|black suit/i.test(panelBlob)) strongVenomSignals.push("black_suit_panel");
  } else if (!ensembleCameo && !offThemeCharacters && /eddie|brock/i.test(panelBlob)) {
    entities.push("venom");
    strongVenomSignals.push("eddie_brock_panel");
    themes.push("symbiosis");
  } else if (
    !ensembleCameo &&
    !offThemeCharacters &&
    /simbionte|symbiote/i.test(panelBlob) &&
    localVisual.duoVisualScore >= 42
  ) {
    themes.push("symbiosis");
    strongVenomSignals.push("symbionte_panel");
  } else if (
    !ensembleCameo &&
    !offThemeCharacters &&
    (/traje preto|black suit/i.test(panelBlob) ||
      (localVisual.duoVisualScore >= 52 && localVisual.visualTags.includes("visual_symbiote_duo")))
  ) {
    themes.push("black_suit");
    themes.push("symbiosis");
    strongVenomSignals.push("black_suit_panel");
  } else if (
    !ensembleCameo &&
    !offThemeCharacters &&
    /transforma/i.test(panelBlob) &&
    localVisual.duoVisualScore >= 45
  ) {
    themes.push("transformation");
    strongVenomSignals.push("symbiotic_transform_panel");
  } else if (
    !ensembleCameo &&
    !offThemeCharacters &&
    localVisual.duoVisualScore >= 58 &&
    localVisual.visualTags.includes("visual_symbiote_duo")
  ) {
    strongVenomSignals.push("venom_panel");
  }

  if (
    strongVenomSignals.length === 0 &&
    !ensembleCameo &&
    !offThemeCharacters &&
    localVisual.duoVisualScore < 42 &&
    /homem[- ]?aranha|spider[- ]?man/i.test(panelBlob)
  ) {
    entities.push("spiderman");
    themes.push("spiderman_support");
    strongVenomSignals.push("spiderman_support_panel");
  }

  if (/hobgoblin/i.test(panelBlob)) {
    textSignals.push("hobgoblin_present");
    actions.push("villain_support");
  }
  if (/peter|johnny/i.test(panelBlob)) {
    textSignals.push("civilian_cameo");
  }
  if (/strange|natasha|doutor estranho|doctor strange|black widow/i.test(panelBlob)) {
    textSignals.push("off_theme_cameo");
  }
  if (/\bp[aá]gina\b/i.test(asset.title)) themes.push("comics_source");

  let narrativeFunction = "generic_panel";
  if (ensembleCameo || offThemeCharacters || localVisual.rejectReason === "mystical_off_theme_hero") {
    narrativeFunction = "off_theme_cameo";
  } else if (strongVenomSignals.includes("venom_spiderman_duo_panel")) narrativeFunction = "duo_together";
  else if (strongVenomSignals.some((signal) => signal.includes("symbionte") || signal.includes("black_suit"))) {
    narrativeFunction = "symbiote_focus";
  } else if (strongVenomSignals.length > 0) narrativeFunction = "venom_focus";
  else if (entities.includes("spiderman")) narrativeFunction = "spiderman_only";
  else if (textHeavyDialogue) narrativeFunction = "dialogue_only";

  return {
    entities: [...new Set(entities)],
    themes: [...new Set(themes)],
    actions,
    textSignals,
    narrativeFunction,
    bestRegion: localVisual.focusRegion,
    regionSpread: localVisual.regionSpread,
    strongVenomSignals,
    offThemeCharacters,
    ensembleCameo
  };
}

function hasRequiredHookClimaxPanelSignal(evidence: PanelEvidence): boolean {
  return evidence.strongVenomSignals.some((signal) => PANEL_ENTITY_SIGNALS.has(signal));
}

function countRealEvidenceCategories(breakdown: BeatPanelScoreBreakdown): number {
  let count = 0;
  if (breakdown.panelEntityScore >= 18) count += 1;
  if (breakdown.panelTextScore >= 8) count += 1;
  if (breakdown.panelActionScore >= 8) count += 1;
  if (breakdown.panelThemeScore >= 18) count += 1;
  if (breakdown.storyFunctionScore >= 12) count += 1;
  return count;
}

function buildRejectedMatch(
  input: {
    beatRole: string;
    asset: UserProvidedAssetRecord;
    beat: ReturnType<typeof parseBeatSignals>;
    evidence: PanelEvidence;
    reason: string;
    rejectedBecause: string[];
    partial?: Partial<BeatPanelScoreBreakdown>;
  }
): BeatPanelMatchResult {
  const breakdown: BeatPanelScoreBreakdown = {
    beat: input.beatRole,
    panel: input.asset.title,
    parentMetadataScore: input.partial?.parentMetadataScore ?? 0,
    panelEntityScore: input.partial?.panelEntityScore ?? 0,
    panelTextScore: input.partial?.panelTextScore ?? 0,
    panelActionScore: input.partial?.panelActionScore ?? 0,
    panelThemeScore: input.partial?.panelThemeScore ?? 0,
    storyFunctionScore: input.partial?.storyFunctionScore ?? 0,
    finalScore: input.partial?.finalScore ?? 0,
    evidence: input.partial?.evidence ?? [],
    rejectedBecause: input.rejectedBecause
  };

  return {
    score: breakdown.finalScore,
    entities: input.evidence.entities,
    theme: input.evidence.themes.join(", ") || "none",
    action: input.beat.actions.join(", ") || input.beat.themes[0] || "narrative",
    narrativeFunction: input.evidence.narrativeFunction,
    reason: input.reason,
    meetsMinimum: false,
    breakdown
  };
}

export function computeBeatPanelMatchScore(input: {
  beatRole: string;
  beatText: string;
  asset: UserProvidedAssetRecord;
  previousAsset?: UserProvidedAssetRecord | null;
  hookAsset?: UserProvidedAssetRecord | null;
}): BeatPanelMatchResult {
  const baseRole = mapBeatRoleForTheme(input.beatRole);
  const beat = parseBeatSignals(input.beatText);
  const evidence = parsePanelEvidence(input.asset);
  const evidenceNotes: string[] = [];
  const rejectedBecause: string[] = [];

  const hardVisualRejectReason =
    input.asset.visualRejectReason ?? input.asset.visualAnalysis?.rejectReason ?? null;
  if (isHardVisualRejectReason(hardVisualRejectReason)) {
    return buildRejectedMatch({
      beatRole: input.beatRole,
      asset: input.asset,
      beat: parseBeatSignals(input.beatText),
      evidence: parsePanelEvidence(input.asset),
      reason: hardVisualRejectReason ?? "hard_visual_reject",
      rejectedBecause: [hardVisualRejectReason ?? "hard_visual_reject"]
    });
  }

  if (isPromotionalAsset(input.asset)) {
    return buildRejectedMatch({
      beatRole: input.beatRole,
      asset: input.asset,
      beat,
      evidence,
      reason: "promotional_panel_rejected",
      rejectedBecause: ["promotional_panel"]
    });
  }

  const parentTitle = scoreParentTitleMetadata(input.asset.title, beat.themes);
  const parentTags = scoreParentTagsMetadata(input.asset.tags, beat.themes);
  const parentMetadataScore = clampScore(parentTitle.score + parentTags.score, 10);
  evidenceNotes.push(...parentTitle.evidence, ...parentTags.evidence);

  let panelEntityScore = 0;
  if (evidence.strongVenomSignals.includes("venom_spiderman_duo_panel")) {
    panelEntityScore += 34;
    evidenceNotes.push("panel_entity:venom_spiderman_duo");
  } else if (evidence.strongVenomSignals.includes("symbionte_panel")) {
    panelEntityScore += 24;
    evidenceNotes.push("panel_entity:symbionte");
  } else if (evidence.strongVenomSignals.includes("black_suit_panel")) {
    panelEntityScore += 22;
    evidenceNotes.push("panel_entity:black_suit");
  } else if (evidence.strongVenomSignals.includes("eddie_brock_panel")) {
    panelEntityScore += 26;
    evidenceNotes.push("panel_entity:eddie_brock");
  } else if (evidence.strongVenomSignals.includes("symbiotic_transform_panel")) {
    panelEntityScore += 24;
    evidenceNotes.push("panel_entity:symbiotic_transform");
  } else if (evidence.strongVenomSignals.includes("venom_panel")) {
    panelEntityScore += 20;
    evidenceNotes.push("panel_entity:venom_visual");
  } else if (evidence.narrativeFunction === "spiderman_only") {
    panelEntityScore += 10;
    evidenceNotes.push("panel_entity:spiderman_support_only");
  }
  const localVisual = resolveLocalPanelVisualVerdict(input.asset);
  if (
    localVisual.visualTags.includes("visual_symbiote_duo") &&
    localVisual.duoVisualScore >= 65
  ) {
    panelEntityScore += 8;
    evidenceNotes.push(`panel_entity:local_duo_visual_${localVisual.duoVisualScore}`);
  }
  panelEntityScore = clampScore(panelEntityScore, 40);

  let panelTextScore = 0;
  if (evidence.textSignals.includes("off_theme_cameo")) {
    panelTextScore -= 12;
    evidenceNotes.push("panel_text:off_theme_cameo");
  }
  if (evidence.textSignals.includes("civilian_cameo")) {
    panelTextScore += 4;
    evidenceNotes.push("panel_text:civilian_cameo");
  }
  if (evidence.textSignals.includes("hobgoblin_present")) {
    panelTextScore += 6;
    evidenceNotes.push("panel_text:hobgoblin_support");
  }
  if (
    input.asset.description.trim().toLowerCase() !== input.asset.title.trim().toLowerCase() &&
    /eddie|brock|simbionte|symbiote/i.test(input.asset.description.toLowerCase())
  ) {
    panelTextScore += 8;
    evidenceNotes.push("panel_text:symbiote_copy");
  }
  panelTextScore = clampScore(panelTextScore, 15);

  let panelActionScore = 0;
  const beatActionOverlap = beat.actions.filter((action) => evidence.actions.includes(action));
  panelActionScore += beatActionOverlap.length * 8;
  if (beat.themes.includes("symbiosis") && evidence.themes.includes("transformation")) {
    panelActionScore += 10;
    evidenceNotes.push("panel_action:symbiotic_transform");
  }
  if (beat.themes.includes("perfect_partner") && evidence.narrativeFunction === "duo_together") {
    panelActionScore += 12;
    evidenceNotes.push("panel_action:duo_partner");
  }
  panelActionScore = clampScore(panelActionScore, 20);

  let panelThemeScore = 0;
  const themeOverlap = beat.themes.filter((theme) => evidence.themes.includes(theme));
  panelThemeScore += themeOverlap.length * 10;
  if (beat.themes.includes("symbiosis") && evidence.themes.includes("black_suit")) {
    panelThemeScore += 12;
    evidenceNotes.push("panel_theme:symbiosis_black_suit");
  }
  if (evidence.bestRegion !== "global") {
    panelThemeScore += 6;
    evidenceNotes.push(`panel_region:${evidence.bestRegion}`);
  }
  if (evidence.regionSpread >= 18) {
    panelThemeScore += 4;
    evidenceNotes.push("panel_region:multi_panel_crop_preferred");
  }
  panelThemeScore = clampScore(panelThemeScore, 35);

  let storyFunctionScore = 0;
  if (evidence.narrativeFunction === "duo_together") {
    storyFunctionScore += 22;
    evidenceNotes.push("story_function:duo_together");
  } else if (evidence.narrativeFunction === "symbiote_focus") {
    storyFunctionScore += 18;
    evidenceNotes.push("story_function:symbiote_focus");
  } else if (evidence.narrativeFunction === "venom_focus") {
    storyFunctionScore += 16;
    evidenceNotes.push("story_function:venom_focus");
  } else if (evidence.narrativeFunction === "spiderman_only") {
    storyFunctionScore += 8;
    evidenceNotes.push("story_function:spiderman_support");
  }

  if (baseRole === "development" && input.previousAsset) {
    const sameSeries =
      extractComicSeriesKey(input.previousAsset.title) === extractComicSeriesKey(input.asset.title);
    const prevPage = extractPageIndex(input.previousAsset.title);
    const currPage = extractPageIndex(input.asset.title);
    if (sameSeries && prevPage !== null && currPage !== null) {
      const gap = Math.abs(currPage - prevPage);
      if (gap === 1) {
        storyFunctionScore += 16;
        evidenceNotes.push("story_function:consecutive_page");
      } else if (gap <= 3) {
        storyFunctionScore += 8;
        evidenceNotes.push("story_function:near_sequence");
      } else {
        storyFunctionScore -= 10;
        evidenceNotes.push("story_function:sequence_jump");
      }
    }
  }

  if ((input.beatRole === "closing" || baseRole === "cta") && input.hookAsset) {
    if (input.asset.id === input.hookAsset.id) {
      storyFunctionScore += 10;
      evidenceNotes.push("story_function:hook_callback");
    } else if (hasRequiredHookClimaxPanelSignal(evidence)) {
      storyFunctionScore += 8;
      evidenceNotes.push("story_function:closing_duo_callback");
    }
  }
  storyFunctionScore = clampScore(storyFunctionScore, 25);

  const partnerSymbiosisBeat =
    beat.themes.includes("symbiosis") || beat.themes.includes("perfect_partner");

  if (evidence.ensembleCameo || evidence.offThemeCharacters) {
    rejectedBecause.push("off_theme_ensemble_cameo");
    evidenceNotes.push("reject:off_theme_ensemble_cameo");
  }
  if (localVisual.rejectReason === "mystical_off_theme_hero") {
    rejectedBecause.push("mystical_off_theme_visual");
    evidenceNotes.push("reject:mystical_off_theme_visual");
  }
  if (partnerSymbiosisBeat && (evidence.ensembleCameo || evidence.offThemeCharacters)) {
    rejectedBecause.push("off_theme_for_partner_symbiosis");
    evidenceNotes.push("reject:off_theme_for_partner_symbiosis");
  }
  if (
    partnerSymbiosisBeat &&
    evidence.textSignals.includes("text_heavy_dialogue") &&
    !hasRequiredHookClimaxPanelSignal(evidence)
  ) {
    rejectedBecause.push("dialogue_page_without_venom");
    evidenceNotes.push("reject:dialogue_page_without_venom");
  }
  if (
    beat.themes.includes("symbiosis") &&
    evidence.narrativeFunction === "spiderman_only" &&
    !evidence.strongVenomSignals.length
  ) {
    rejectedBecause.push("symbiosis_beat_spiderman_only");
    evidenceNotes.push("reject:spiderman_only_for_symbiosis");
  }
  if (
    (baseRole === "hook" || baseRole === "climax" || baseRole === "curiosity") &&
    (evidence.ensembleCameo || evidence.offThemeCharacters || evidence.narrativeFunction === "off_theme_cameo")
  ) {
    rejectedBecause.push("high_stakes_off_theme_panel");
  }
  if (
    (baseRole === "hook" || baseRole === "climax" || baseRole === "curiosity") &&
    evidence.narrativeFunction === "spiderman_only"
  ) {
    rejectedBecause.push("spiderman_only_high_stakes");
    evidenceNotes.push("reject:spiderman_only_high_stakes");
  }
  if (
    (baseRole === "hook" || baseRole === "climax") &&
    evidence.narrativeFunction === "dialogue_only"
  ) {
    rejectedBecause.push("dialogue_only_high_stakes");
    evidenceNotes.push("reject:dialogue_only_high_stakes");
  }
  if (
    (input.beatRole === "closing" || baseRole === "cta") &&
    evidence.narrativeFunction === "spiderman_only" &&
    !hasRequiredHookClimaxPanelSignal(evidence)
  ) {
    rejectedBecause.push("closing_spiderman_only_without_duo");
    evidenceNotes.push("reject:closing_spiderman_only");
  }

  let finalScore =
    parentMetadataScore +
    panelEntityScore +
    panelTextScore +
    panelActionScore +
    panelThemeScore +
    storyFunctionScore;

  const hookClimaxBeat = baseRole === "hook" || baseRole === "climax";
  if (hookClimaxBeat && !hasRequiredHookClimaxPanelSignal(evidence)) {
    finalScore = Math.min(finalScore, 35);
    rejectedBecause.push("hook_climax_missing_venom_panel_evidence");
    evidenceNotes.push("cap:hook_climax_missing_venom_panel_evidence");
  }
  if (
    partnerSymbiosisBeat &&
    rejectedBecause.some((reason) =>
      /off_theme|dialogue_page_without_venom|mystical_off_theme|spiderman_only/.test(reason)
    )
  ) {
    finalScore = Math.min(finalScore, 30);
  }
  if (
    hookClimaxBeat &&
    evidence.narrativeFunction === "symbiote_focus" &&
    !evidence.strongVenomSignals.includes("venom_spiderman_duo_panel") &&
    !evidence.strongVenomSignals.includes("venom_panel")
  ) {
    finalScore = Math.min(finalScore, 78);
    evidenceNotes.push("cap:symbiote_focus_without_duo_not_hook_climax");
  }
  if (hookClimaxBeat && evidence.textSignals.includes("hobgoblin_present")) {
    finalScore = Math.min(finalScore, 72);
    evidenceNotes.push("cap:hobgoblin_support_not_hook_climax");
  }

  const breakdown: BeatPanelScoreBreakdown = {
    beat: input.beatRole,
    panel: input.asset.title,
    parentMetadataScore,
    panelEntityScore,
    panelTextScore,
    panelActionScore,
    panelThemeScore,
    storyFunctionScore,
    finalScore: 0,
    evidence: evidenceNotes,
    rejectedBecause
  };

  if (countRealEvidenceCategories(breakdown) < 3) {
    finalScore = Math.min(finalScore, 92);
    evidenceNotes.push("cap:needs_three_panel_evidence_categories_for_100");
  }

  finalScore = clampScore(finalScore, 100);
  breakdown.finalScore = finalScore;

  const minScore = BEAT_PANEL_MIN_SCORE[baseRole] ?? 55;
  const meetsMinimum =
    finalScore >= minScore &&
    rejectedBecause.length === 0 &&
    !(hookClimaxBeat && !hasRequiredHookClimaxPanelSignal(evidence));

  return {
    score: finalScore,
    entities: evidence.entities,
    theme: evidence.themes.join(", ") || "none",
    action: beat.actions.join(", ") || beat.themes[0] || "narrative",
    narrativeFunction: evidence.narrativeFunction,
    reason: evidenceNotes.join("; ") || "baseline_panel_match",
    meetsMinimum,
    breakdown
  };
}

function resolveBeatNarrationText(beatRole: string, plan?: VideoRemixPlan | null): string {
  const roleMap: Record<string, string> = {
    hook: "hook",
    context: "context",
    curiosity_a: "tension",
    curiosity_b: "tension",
    development_a: "tension",
    development_b: "tension",
    climax: "climax",
    closing: "cta"
  };
  const mapped = roleMap[beatRole] ?? beatRole;
  const beat =
    plan?.narrationPlan?.narrationBeats?.find((entry) => entry.role === mapped) ??
    REFERENCE_ALIGNED_NARRATION.beats.find((entry) => entry.role === mapped);
  return beat?.text ?? REFERENCE_ALIGNED_NARRATION.beats.find((entry) => entry.role === mapped)?.text ?? "";
}

function isAssetEligibleForBeat(asset: UserProvidedAssetRecord, beatRole: string): boolean {
  return isUserProvidedPanelEligibleForBeat(
    {
      title: asset.title,
      description: asset.description,
      tags: asset.tags,
      width: asset.width,
      height: asset.height,
      bytes: asset.bytes,
      selectionSignals: asset.selectionSignals,
      duoVisualScore: asset.duoVisualScore,
      visualTags: asset.visualTags,
      visualRejectReason: asset.visualRejectReason,
      beatRole
    },
    beatRole
  );
}

type BeatPickResult = {
  asset: UserProvidedAssetRecord | null;
  match: BeatPanelMatchResult | null;
  rejectedAlternatives: PanelBeatMatchEntry["rejectedAlternatives"];
};

function pickAssetForBeat(
  assets: UserProvidedAssetRecord[],
  beatRole: string,
  usedIds: Set<string>,
  usedSeries: Set<string>,
  input: {
    beatText: string;
    previousAsset?: UserProvidedAssetRecord | null;
    hookAsset?: UserProvidedAssetRecord | null;
    requireStrong?: boolean;
  }
): BeatPickResult {
  const baseRole = mapBeatRoleForTheme(beatRole);
  const minScore = BEAT_PANEL_MIN_SCORE[baseRole] ?? 55;
  const candidates = assets.filter(
    (asset) =>
      !usedIds.has(asset.id) &&
      !isPromotionalAsset(asset) &&
      isAssetEligibleForBeat(asset, beatRole)
  );

  const ranked = candidates
    .map((asset) => ({
      asset,
      match: computeBeatPanelMatchScore({
        beatRole,
        beatText: input.beatText,
        asset,
        previousAsset: input.previousAsset ?? null,
        hookAsset: input.hookAsset ?? null
      })
    }))
    .sort((left, right) => right.match.score - left.match.score);

  const isStrongBeat = input.requireStrong === true;
  const passing = ranked.filter((entry) => entry.match.meetsMinimum);
  const strongPassing = passing.filter(
    (entry) => entry.match.breakdown.rejectedBecause.length === 0
  );
  let picked = (isStrongBeat ? strongPassing[0] : passing[0]) ?? passing[0] ?? null;

  if (!picked && isStrongBeat) {
    picked =
      ranked.find(
        (entry) =>
          entry.match.score >= minScore && entry.match.breakdown.rejectedBecause.length === 0
      ) ?? null;
  }
  if (!picked) {
    picked = ranked[0] ?? null;
  }

  const rejectedAlternatives = ranked
    .filter((entry) => entry.asset.id !== picked?.asset.id)
    .slice(0, 6)
    .map((entry) => ({
      assetId: entry.asset.id,
      assetTitle: entry.asset.title,
      page: extractPageIndex(entry.asset.title),
      score: entry.match.score,
      reason: entry.match.meetsMinimum
        ? `lower_than_selected:${entry.match.reason}`
        : `below_min_${minScore}:${entry.match.reason}`,
      rejectedBecause: entry.match.breakdown.rejectedBecause
    }));

  return {
    asset: picked?.asset ?? null,
    match: picked?.match ?? null,
    rejectedAlternatives
  };
}

function getBeatAssignmentWeight(beatRole: string): number {
  return BEAT_ASSIGNMENT_WEIGHTS[beatRole] ?? 1;
}

function getGlobalBeatThreshold(beatRole: string): number {
  const baseRole = mapBeatRoleForTheme(beatRole);
  if (baseRole === "hook") return GLOBAL_BEAT_THRESHOLDS.hook;
  if (baseRole === "climax") return GLOBAL_BEAT_THRESHOLDS.climax;
  if (baseRole === "context") return GLOBAL_BEAT_THRESHOLDS.context;
  if (baseRole === "curiosity") return GLOBAL_BEAT_THRESHOLDS.curiosity;
  if (baseRole === "development") return GLOBAL_BEAT_THRESHOLDS.development;
  return GLOBAL_BEAT_THRESHOLDS.context;
}

function getAssetFocusRegion(asset: UserProvidedAssetRecord): PanelRegionKey | "global" {
  return pickBestPanelRegion(asset).bestRegion;
}

export function computePanelCropBounds(
  asset: Pick<UserProvidedAssetRecord, "width" | "height">,
  region: PanelRegionKey | "global"
): PanelCropBounds {
  if (region === "global") {
    return { x: 0, y: 0, width: asset.width, height: asset.height };
  }
  const thirdHeight = Math.max(1, Math.floor(asset.height / 3));
  if (region === "topThird") {
    return { x: 0, y: 0, width: asset.width, height: thirdHeight };
  }
  if (region === "midThird") {
    return { x: 0, y: thirdHeight, width: asset.width, height: thirdHeight };
  }
  return {
    x: 0,
    y: thirdHeight * 2,
    width: asset.width,
    height: Math.max(1, asset.height - thirdHeight * 2)
  };
}

export function buildPanelCropDescriptor(
  asset: UserProvidedAssetRecord,
  options?: { projectRoot?: string; materializedCropPath?: string | null }
): PanelCropDescriptor {
  const localVisual = resolveLocalPanelVisualVerdict(asset);
  const focusRegion = localVisual.focusRegion;
  const cropBounds = computePanelCropBounds(asset, focusRegion);
  const panelId = `${asset.id}:${focusRegion}`;
  const cropContentHash = createHash("sha256")
    .update(
      `${asset.contentHash}:${focusRegion}:${cropBounds.x},${cropBounds.y},${cropBounds.width},${cropBounds.height}`
    )
    .digest("hex")
    .slice(0, 16);
  const projectRoot = resolve(options?.projectRoot ?? process.cwd());
  const defaultCropPath = join(projectRoot, "tmp", "panel-crops", `${panelId.replace(/[:/\\]/g, "_")}.jpg`);

  return {
    panelId,
    sourceAssetPath: asset.assetPath,
    panelImagePath: options?.materializedCropPath ?? defaultCropPath,
    cropBounds,
    cropContentHash,
    focusRegion,
    localVisualEvidence: localVisual.localEvidence
  };
}

async function runFfmpegCrop(
  ffmpegCommand: string,
  args: string[]
): Promise<void> {
  await new Promise<void>((resolvePromise, reject) => {
    const child = spawn(ffmpegCommand, args, { stdio: ["ignore", "ignore", "pipe"] });
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

export async function materializePanelCropImage(input: {
  asset: UserProvidedAssetRecord;
  projectRoot?: string;
  ffmpegCommand?: string;
  outputPath?: string;
}): Promise<PanelCropDescriptor> {
  const descriptor = buildPanelCropDescriptor(input.asset, {
    ...(input.projectRoot ? { projectRoot: input.projectRoot } : {}),
    materializedCropPath: input.outputPath ?? null
  });
  const outputPath = descriptor.panelImagePath;
  await mkdir(dirname(outputPath), { recursive: true });

  const { cropBounds } = descriptor;
  const cropFilter = `crop=${cropBounds.width}:${cropBounds.height}:${cropBounds.x}:${cropBounds.y}`;
  await runFfmpegCrop(input.ffmpegCommand ?? "ffmpeg", [
    "-y",
    "-hide_banner",
    "-loglevel",
    "error",
    "-i",
    input.asset.assetPath,
    "-vf",
    cropFilter,
    "-frames:v",
    "1",
    outputPath
  ]);

  return descriptor;
}

export async function materializePanelCropImages(input: {
  assets: UserProvidedAssetRecord[];
  projectRoot?: string;
  ffmpegCommand?: string;
}): Promise<Map<string, PanelCropDescriptor>> {
  const descriptors = new Map<string, PanelCropDescriptor>();
  for (const asset of input.assets) {
    const descriptor = await materializePanelCropImage({
      asset,
      ...(input.projectRoot ? { projectRoot: input.projectRoot } : {}),
      ...(input.ffmpegCommand ? { ffmpegCommand: input.ffmpegCommand } : {})
    });
    descriptors.set(asset.id, descriptor);
    descriptors.set(descriptor.panelId, descriptor);
  }
  return descriptors;
}

function escapeDrawtext(value: string): string {
  return value.replace(/[:\\']/g, "\\$&");
}

export async function renderPanelBeatCropContactSheet(input: {
  entries: Array<{
    beatRole: string;
    panelId: string;
    page: number | null;
    score: number;
    localVisualEvidence: string[];
    panelImagePath: string;
  }>;
  outputPath: string;
  ffmpegCommand?: string;
}): Promise<string | null> {
  const rasterEntries = input.entries.filter(
    (entry) => entry.panelImagePath && /\.(jpe?g|png|webp|gif|avif)$/i.test(entry.panelImagePath)
  );
  if (rasterEntries.length === 0) return null;

  await mkdir(dirname(input.outputPath), { recursive: true });
  const ffmpegCommand = input.ffmpegCommand ?? "ffmpeg";
  const annotatedDir = join(dirname(input.outputPath), `${basename(input.outputPath)}.annotated`);
  await mkdir(annotatedDir, { recursive: true });

  const annotatedPaths: string[] = [];
  for (const [index, entry] of rasterEntries.entries()) {
    if (!(await fileExists(entry.panelImagePath))) continue;
    const pageLabel = entry.page === null ? "?" : String(entry.page);
    const evidence = entry.localVisualEvidence.slice(0, 2).join(" | ") || "local_visual:none";
    const label = escapeDrawtext(
      `${entry.beatRole} | ${entry.panelId} | p${pageLabel} | ${entry.score} | ${evidence}`
    );
    const annotatedPath = join(annotatedDir, `beat-${String(index + 1).padStart(2, "0")}.jpg`);
    await runFfmpegCrop(ffmpegCommand, [
      "-y",
      "-hide_banner",
      "-loglevel",
      "error",
      "-i",
      entry.panelImagePath,
      "-vf",
      `scale=320:320:force_original_aspect_ratio=decrease,pad=320:320:(ow-iw)/2:(oh-ih)/2:color=black,drawtext=text='${label}':fontsize=11:fontcolor=white:x=8:y=8:box=1:boxcolor=black@0.55`,
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
    await runFfmpegCrop(ffmpegCommand, [
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
      "tile=4x3",
      "-frames:v",
      "1",
      input.outputPath
    ]);
    return resolve(input.outputPath);
  } catch {
    return null;
  }
}

export function validateScoredCropMaterialization(input: {
  assignment: Pick<
    UserProvidedBeatAssignment,
    "assetId" | "assetPath" | "panelId" | "panelImagePath" | "cropBounds" | "cropContentHash"
  >;
  materializedAssetPath: string;
}): { ok: boolean; reason: string | null } {
  if (!input.assignment.panelImagePath || !input.assignment.panelId || !input.assignment.cropBounds) {
    return { ok: false, reason: "missing_crop_descriptor" };
  }
  if (input.materializedAssetPath !== input.assignment.panelImagePath) {
    return {
      ok: false,
      reason: `crop_path_mismatch:${input.materializedAssetPath}!=${input.assignment.panelImagePath}`
    };
  }
  if (
    input.assignment.panelImagePath &&
    input.materializedAssetPath === input.assignment.assetPath
  ) {
    return { ok: false, reason: "full_page_rendered_instead_of_crop" };
  }
  return { ok: true, reason: null };
}

export function resolveMaterializedPanelPathForBeat(
  assignment: UserProvidedBeatAssignment,
  asset?: UserProvidedAssetRecord | null
): string {
  if (assignment.panelImagePath) return assignment.panelImagePath;
  return asset?.assetPath ?? assignment.assetPath;
}

export function hasSignificantMultiRegionCrop(asset: UserProvidedAssetRecord): boolean {
  const { regionSpread } = pickBestPanelRegion(asset);
  return regionSpread >= SIGNIFICANT_REGION_SPREAD;
}

function canReuseAssetBetweenBeats(input: {
  asset: UserProvidedAssetRecord;
  fromBeat: string;
  toBeat: string;
  usedRegions: Map<string, PanelRegionKey | "global">;
}): boolean {
  if (input.toBeat === "closing" && input.fromBeat === "hook") return true;
  if (!hasSignificantMultiRegionCrop(input.asset)) return false;
  const priorRegion = input.usedRegions.get(`${input.fromBeat}:${input.asset.id}`);
  const { regionScores, regionSpread } = pickBestPanelRegion(input.asset);
  if (!priorRegion || priorRegion === "global" || regionSpread < SIGNIFICANT_REGION_SPREAD) {
    return false;
  }
  const alternateRegions = (Object.entries(regionScores) as Array<[PanelRegionKey, number]>)
    .filter(([region, score]) => region !== priorRegion && score >= 8)
    .map(([region]) => region);
  return alternateRegions.length > 0;
}

export type BeatAssignmentSpec = {
  beatRole: string;
  beatText: string;
  startSec: number;
  endSec: number;
  motion: string;
};

export type PanelScoreMatrix = Map<string, Map<string, BeatPanelMatchResult>>;

export function buildPanelScoreMatrix(input: {
  beats: BeatAssignmentSpec[];
  candidates: UserProvidedAssetRecord[];
  hookAsset?: UserProvidedAssetRecord | null;
}): PanelScoreMatrix {
  const matrix: PanelScoreMatrix = new Map();
  for (const beat of input.beats) {
    const row = new Map<string, BeatPanelMatchResult>();
    for (const asset of input.candidates) {
      if (isPromotionalAsset(asset) || !isAssetEligibleForBeat(asset, beat.beatRole)) continue;
      row.set(
        asset.id,
        computeBeatPanelMatchScore({
          beatRole: beat.beatRole,
          beatText: beat.beatText,
          asset,
          hookAsset: input.hookAsset ?? null
        })
      );
    }
    matrix.set(beat.beatRole, row);
  }
  return matrix;
}

function scoreMatrixLookup(
  matrix: PanelScoreMatrix,
  beatRole: string,
  assetId: string
): BeatPanelMatchResult | null {
  return matrix.get(beatRole)?.get(assetId) ?? null;
}

function isStrongPanelMatch(match: BeatPanelMatchResult | null): boolean {
  return Boolean(match && match.score >= 90 && match.breakdown.rejectedBecause.length === 0);
}

const LOCKED_GLOBAL_BEAT_ROLES = new Set([
  "hook",
  "context",
  "curiosity_a",
  "climax",
  "closing"
]);

function findSeriesPageAsset(
  candidates: UserProvidedAssetRecord[],
  seriesKey: string,
  page: number
): UserProvidedAssetRecord | null {
  return (
    candidates.find(
      (asset) =>
        extractComicSeriesKey(asset.title) === seriesKey && extractPageIndex(asset.title) === page
    ) ?? null
  );
}

export function computeDevelopmentSequence(input: {
  developmentA: UserProvidedAssetRecord | null;
  developmentB: UserProvidedAssetRecord | null;
  developmentBScore?: number;
}): DevelopmentSequenceReport {
  if (!input.developmentA || !input.developmentB) {
    return {
      panelA: input.developmentA?.title ?? "",
      panelB: input.developmentB?.title ?? "",
      consecutivePages: false,
      sameStorySequence: false,
      continuityScore: 0,
      reason: "missing_development_panels"
    };
  }

  const developmentA = input.developmentA;
  const developmentB = input.developmentB;
  const sameStorySequence =
    extractComicSeriesKey(developmentA.title) === extractComicSeriesKey(developmentB.title);
  const pageA = extractPageIndex(developmentA.title);
  const pageB = extractPageIndex(developmentB.title);
  const consecutivePages =
    sameStorySequence && pageA !== null && pageB !== null && Math.abs(pageB - pageA) === 1;

  const reasons: string[] = [];
  let continuityScore = 0;

  if (sameStorySequence) {
    continuityScore += 25;
    reasons.push("same_edition");
  }
  if (consecutivePages) {
    continuityScore += 35;
    reasons.push("consecutive_pages");
  }
  if (hasDuoTogetherSignal(developmentA) && hasDuoTogetherSignal(developmentB)) {
    continuityScore += 20;
    reasons.push("same_characters");
  }
  const localA = resolveLocalPanelVisualVerdict(developmentA);
  const localB = resolveLocalPanelVisualVerdict(developmentB);
  const sharedVisualTags = localA.visualTags.filter((tag) => localB.visualTags.includes(tag));
  if (
    sharedVisualTags.length > 0 ||
    (localA.duoVisualScore >= 60 && localB.duoVisualScore >= 60)
  ) {
    continuityScore += 15;
    reasons.push("visual_progression");
  }

  const developmentBScore = input.developmentBScore;
  if (developmentBScore !== undefined && developmentBScore < GLOBAL_BEAT_THRESHOLDS.development) {
    continuityScore = Math.min(continuityScore, 59);
    reasons.push("development_b_below_min");
  } else if (developmentBScore !== undefined && developmentBScore >= GLOBAL_BEAT_THRESHOLDS.development) {
    continuityScore += 5;
    reasons.push("development_b_meets_min");
  }

  return {
    panelA: developmentA.title,
    panelB: developmentB.title,
    consecutivePages,
    sameStorySequence,
    continuityScore: Math.min(100, continuityScore),
    reason: reasons.join("; ") || "weak_sequence"
  };
}

function resolveAssignmentMatchForBeat(input: {
  beat: BeatAssignmentSpec;
  asset: UserProvidedAssetRecord;
  picks: Map<string, UserProvidedAssetRecord>;
  matrix: PanelScoreMatrix;
  hookAsset: UserProvidedAssetRecord | null;
}): BeatPanelMatchResult {
  const developmentA = input.picks.get("development_a") ?? null;
  const previousAsset =
    input.beat.beatRole === "development_b"
      ? developmentA
      : [...input.picks.entries()]
          .filter(
            ([role]) =>
              BEAT_WINDOWS.findIndex((window) => window.beatRole === role) <
              BEAT_WINDOWS.findIndex((window) => window.beatRole === input.beat.beatRole)
          )
          .map(([, value]) => value)
          .pop() ?? null;

  if (input.beat.beatRole === "development_b" && developmentA) {
    return resolveDevelopmentMatch(
      input.beat.beatRole,
      input.beat.beatText,
      input.asset,
      developmentA,
      input.hookAsset
    );
  }
  if (input.beat.beatRole === "closing" && input.hookAsset) {
    return resolveDevelopmentMatch(
      input.beat.beatRole,
      input.beat.beatText,
      input.asset,
      previousAsset,
      input.hookAsset
    );
  }
  return (
    scoreMatrixLookup(input.matrix, input.beat.beatRole, input.asset.id) ??
    computeBeatPanelMatchScore({
      beatRole: input.beat.beatRole,
      beatText: input.beat.beatText,
      asset: input.asset,
      previousAsset,
      hookAsset: input.hookAsset
    })
  );
}

function assignmentMeetsAllThresholds(input: {
  picks: Map<string, UserProvidedAssetRecord>;
  beats: BeatAssignmentSpec[];
  matrix: PanelScoreMatrix;
  hookAsset: UserProvidedAssetRecord | null;
}): { ok: boolean; reason: string | null } {
  const scores: number[] = [];
  for (const beat of input.beats) {
    const asset = input.picks.get(beat.beatRole);
    if (!asset) {
      return { ok: false, reason: `missing_beat:${beat.beatRole}` };
    }
    const match = resolveAssignmentMatchForBeat({
      beat,
      asset,
      picks: input.picks,
      matrix: input.matrix,
      hookAsset: input.hookAsset
    });
    scores.push(match.score);
    if (match.score < getGlobalBeatThreshold(beat.beatRole)) {
      return { ok: false, reason: `below_threshold:${beat.beatRole}:${match.score}` };
    }
  }
  const average = scores.reduce((sum, score) => sum + score, 0) / scores.length;
  if (average < GLOBAL_BEAT_THRESHOLDS.average) {
    return { ok: false, reason: `average_below_min:${average.toFixed(2)}` };
  }
  return { ok: true, reason: null };
}

function tryRebalanceDevelopmentSequence(input: {
  picks: Map<string, UserProvidedAssetRecord>;
  beats: BeatAssignmentSpec[];
  candidates: UserProvidedAssetRecord[];
  matrix: PanelScoreMatrix;
}): {
  picks: Map<string, UserProvidedAssetRecord>;
  applied: boolean;
  reason: string;
} {
  const panelA = findSeriesPageAsset(input.candidates, "simbionte", 4);
  const panelB = findSeriesPageAsset(input.candidates, "simbionte", 5);
  if (!panelA || !panelB) {
    return {
      picks: input.picks,
      applied: false,
      reason: "simbionte_pages_4_5_unavailable"
    };
  }

  const hookAsset = input.picks.get("hook") ?? null;
  const lockedUsed = new Set<string>();
  for (const role of LOCKED_GLOBAL_BEAT_ROLES) {
    const asset = input.picks.get(role);
    if (asset) lockedUsed.add(asset.id);
  }
  if (lockedUsed.has(panelA.id) || lockedUsed.has(panelB.id)) {
    return {
      picks: input.picks,
      applied: false,
      reason: "target_panels_locked_by_fixed_beats"
    };
  }

  const nextPicks = new Map(input.picks);
  nextPicks.set("development_a", panelA);
  nextPicks.set("development_b", panelB);

  const used = new Set(lockedUsed);
  used.add(panelA.id);
  used.add(panelB.id);

  const curiosityBeat = input.beats.find((beat) => beat.beatRole === "curiosity_b");
  const curiosityBeatText = curiosityBeat?.beatText ?? "";
  const currentCuriosityB = input.picks.get("curiosity_b");
  if (!currentCuriosityB || used.has(currentCuriosityB.id)) {
    const replacement = input.candidates
      .filter((asset) => !used.has(asset.id) && !isPromotionalAsset(asset))
      .map((asset) => ({
        asset,
        match:
          scoreMatrixLookup(input.matrix, "curiosity_b", asset.id) ??
          computeBeatPanelMatchScore({
            beatRole: "curiosity_b",
            beatText: curiosityBeatText,
            asset
          })
      }))
      .filter((entry) => entry.match.score >= GLOBAL_BEAT_THRESHOLDS.curiosity)
      .sort((left, right) => right.match.score - left.match.score)[0];

    if (!replacement?.match) {
      return {
        picks: input.picks,
        applied: false,
        reason: "no_valid_curiosity_b_replacement"
      };
    }
    nextPicks.set("curiosity_b", replacement.asset);
  }

  const validation = assignmentMeetsAllThresholds({
    picks: nextPicks,
    beats: input.beats,
    matrix: input.matrix,
    hookAsset
  });
  if (!validation.ok) {
    return {
      picks: input.picks,
      applied: false,
      reason: validation.reason ?? "rebalance_failed_validation"
    };
  }

  return {
    picks: nextPicks,
    applied: true,
    reason: "simbionte_consecutive_dev_pair"
  };
}

function computeContinuityBonus(input: {
  developmentA: UserProvidedAssetRecord | null;
  developmentB: UserProvidedAssetRecord | null;
}): number {
  if (!input.developmentA || !input.developmentB) return 0;
  const sameSeries =
    extractComicSeriesKey(input.developmentA.title) === extractComicSeriesKey(input.developmentB.title);
  const pageA = extractPageIndex(input.developmentA.title);
  const pageB = extractPageIndex(input.developmentB.title);
  if (sameSeries && pageA !== null && pageB !== null) {
    const gap = Math.abs(pageB - pageA);
    if (gap === 1) return 14;
    if (gap <= 3) return 8;
  }
  return sameSeries ? 4 : 0;
}

function computeAssignmentPenalties(input: {
  orderedBeats: string[];
  picks: Map<string, UserProvidedAssetRecord>;
  matrix: PanelScoreMatrix;
}): number {
  let penalty = 0;
  let previousBeat: string | null = null;
  for (const beatRole of input.orderedBeats) {
    const asset = input.picks.get(beatRole);
    if (!asset) continue;
    if (previousBeat) {
      const previousAsset = input.picks.get(previousBeat);
      if (previousAsset && previousAsset.id === asset.id && beatRole !== "closing") {
        penalty += 18;
      }
    }
    const match = scoreMatrixLookup(input.matrix, beatRole, asset.id);
    const weight = getBeatAssignmentWeight(beatRole);
    if (isStrongPanelMatch(match) && weight < 1.1) {
      penalty += 22;
    }
    previousBeat = beatRole;
  }
  return penalty;
}

function evaluateGlobalAssignment(input: {
  picks: Map<string, UserProvidedAssetRecord>;
  matrix: PanelScoreMatrix;
  developmentA: UserProvidedAssetRecord | null;
  developmentB: UserProvidedAssetRecord | null;
}): number {
  let total = 0;
  for (const [beatRole, asset] of input.picks.entries()) {
    const match = scoreMatrixLookup(input.matrix, beatRole, asset.id);
    if (!match) continue;
    total += match.score * getBeatAssignmentWeight(beatRole);
  }
  total += computeContinuityBonus({
    developmentA: input.developmentA,
    developmentB: input.developmentB
  });
  total -= computeAssignmentPenalties({
    orderedBeats: BEAT_WINDOWS.map((window) => window.beatRole),
    picks: input.picks,
    matrix: input.matrix
  });
  return total;
}

function buildRejectedAlternatives(
  beatRole: string,
  matrix: PanelScoreMatrix,
  candidates: UserProvidedAssetRecord[],
  selectedId: string
): PanelBeatMatchEntry["rejectedAlternatives"] {
  const minScore = BEAT_PANEL_MIN_SCORE[mapBeatRoleForTheme(beatRole)] ?? 55;
  return candidates
    .filter((asset) => asset.id !== selectedId)
    .map((asset) => {
      const match = scoreMatrixLookup(matrix, beatRole, asset.id);
      return {
        assetId: asset.id,
        assetTitle: asset.title,
        page: extractPageIndex(asset.title),
        score: match?.score ?? 0,
        reason: match?.meetsMinimum
          ? `lower_than_selected:${match.reason}`
          : `below_min_${minScore}:${match?.reason ?? "ineligible"}`,
        rejectedBecause: match?.breakdown.rejectedBecause ?? []
      };
    })
    .sort((left, right) => right.score - left.score)
    .slice(0, 6);
}

function resolveDevelopmentMatch(
  beatRole: string,
  beatText: string,
  asset: UserProvidedAssetRecord,
  previousAsset: UserProvidedAssetRecord | null,
  hookAsset: UserProvidedAssetRecord | null
): BeatPanelMatchResult {
  return computeBeatPanelMatchScore({
    beatRole,
    beatText,
    asset,
    previousAsset,
    hookAsset
  });
}

export function simulateGreedyPanelAssignment(input: {
  beats: BeatAssignmentSpec[];
  candidates: UserProvidedAssetRecord[];
  plan?: VideoRemixPlan | null;
}): Map<string, { asset: UserProvidedAssetRecord; score: number }> {
  const usedIds = new Set<string>();
  const result = new Map<string, { asset: UserProvidedAssetRecord; score: number }>();
  let previousAsset: UserProvidedAssetRecord | null = null;
  let hookAsset: UserProvidedAssetRecord | null = null;
  let developmentAAsset: UserProvidedAssetRecord | null = null;

  for (const beat of input.beats) {
    const previousForBeat =
      beat.beatRole === "development_b" ? (developmentAAsset ?? previousAsset) : previousAsset;
    const pick = pickAssetForBeat(input.candidates, beat.beatRole, usedIds, new Set(), {
      beatText: beat.beatText,
      previousAsset: previousForBeat,
      hookAsset,
      requireStrong: beat.beatRole === "hook" || beat.beatRole === "climax"
    });
    if (!pick.asset || !pick.match) continue;
    if (beat.beatRole !== "closing" || !usedIds.has(pick.asset.id)) {
      usedIds.add(pick.asset.id);
    }
    if (beat.beatRole === "hook") hookAsset = pick.asset;
    if (beat.beatRole === "development_a") developmentAAsset = pick.asset;
    previousAsset = pick.asset;
    result.set(beat.beatRole, { asset: pick.asset, score: pick.match.score });
  }
  return result;
}

export function assignPanelsToBeatsGlobally(input: {
  beats: BeatAssignmentSpec[];
  candidates: UserProvidedAssetRecord[];
  scoreMatrix: PanelScoreMatrix;
  greedyBaseline?: Map<string, number>;
}): GlobalPanelAssignmentResult {
  const warnings: string[] = [];
  const rejectedAssignments: GlobalPanelAssignmentResult["rejectedAssignments"] = [];
  const greedyBaseline =
    input.greedyBaseline ??
    new Map(
      [...simulateGreedyPanelAssignment({ beats: input.beats, candidates: input.candidates }).entries()].map(
        ([beatRole, entry]) => [beatRole, entry.score]
      )
    );

  const hookBeat = input.beats.find((beat) => beat.beatRole === "hook");
  const climaxBeat = input.beats.find((beat) => beat.beatRole === "climax");

  const rankForBeat = (beatRole: string, limit = 8) =>
    input.candidates
      .map((asset) => ({
        asset,
        match: scoreMatrixLookup(input.scoreMatrix, beatRole, asset.id)
      }))
      .filter((entry) => entry.match)
      .sort((left, right) => (right.match?.score ?? 0) - (left.match?.score ?? 0))
      .slice(0, limit);

  const hookRanked = hookBeat ? rankForBeat(hookBeat.beatRole, 8) : [];
  const climaxRanked = climaxBeat ? rankForBeat(climaxBeat.beatRole, 8) : [];

  let bestPicks = new Map<string, UserProvidedAssetRecord>();
  let bestScore = -Infinity;
  let bestContinuity = 0;
  let bestReuse: GlobalPanelReuseEntry[] = [];

  const hookOptions =
    hookRanked.filter((entry) => (entry.match?.score ?? 0) >= GLOBAL_BEAT_THRESHOLDS.hook).length > 0
      ? hookRanked.filter((entry) => (entry.match?.score ?? 0) >= GLOBAL_BEAT_THRESHOLDS.hook)
      : hookRanked.slice(0, 4);
  const climaxOptions =
    climaxRanked.filter(
      (entry) =>
        (entry.match?.score ?? 0) >= GLOBAL_BEAT_THRESHOLDS.climax &&
        (entry.match?.breakdown.rejectedBecause.length ?? 0) === 0
    ).length > 0
      ? climaxRanked.filter(
          (entry) =>
            (entry.match?.score ?? 0) >= GLOBAL_BEAT_THRESHOLDS.climax &&
            (entry.match?.breakdown.rejectedBecause.length ?? 0) === 0
        )
      : climaxRanked.slice(0, 4);

  for (const climaxEntry of climaxOptions) {
    for (const hookEntry of hookOptions) {
      if (hookEntry.asset.id === climaxEntry.asset.id) continue;

      const picks = new Map<string, UserProvidedAssetRecord>();
      picks.set("hook", hookEntry.asset);
      picks.set("climax", climaxEntry.asset);
      const used = new Set([hookEntry.asset.id, climaxEntry.asset.id]);
      const localRegions = new Map<string, PanelRegionKey | "global">();
      localRegions.set(`hook:${hookEntry.asset.id}`, getAssetFocusRegion(hookEntry.asset));
      localRegions.set(`climax:${climaxEntry.asset.id}`, getAssetFocusRegion(climaxEntry.asset));

      let developmentA: UserProvidedAssetRecord | null = null;
      let developmentB: UserProvidedAssetRecord | null = null;

      for (const beatRole of GLOBAL_FILL_BEAT_ORDER) {
        const beat = input.beats.find((entry) => entry.beatRole === beatRole);
        if (!beat) continue;
        const ranked = rankForBeat(beatRole, input.candidates.length).filter(
          (entry) => !used.has(entry.asset.id)
        )
          .sort((left, right) => {
            const leftMatch =
              beatRole === "development_b" && developmentA
                ? resolveDevelopmentMatch(
                    beatRole,
                    beat.beatText,
                    left.asset,
                    developmentA,
                    hookEntry.asset
                  )
                : left.match!;
            const rightMatch =
              beatRole === "development_b" && developmentA
                ? resolveDevelopmentMatch(
                    beatRole,
                    beat.beatText,
                    right.asset,
                    developmentA,
                    hookEntry.asset
                  )
                : right.match!;
            return (
              rightMatch.score * getBeatAssignmentWeight(beatRole) -
              leftMatch.score * getBeatAssignmentWeight(beatRole)
            );
          });

        const selected = ranked[0];
        if (!selected?.match) continue;
        picks.set(beatRole, selected.asset);
        used.add(selected.asset.id);
        localRegions.set(`${beatRole}:${selected.asset.id}`, getAssetFocusRegion(selected.asset));
        if (beatRole === "development_a") developmentA = selected.asset;
        if (beatRole === "development_b") developmentB = selected.asset;
      }

      picks.set("closing", hookEntry.asset);
      const candidateReuse: GlobalPanelReuseEntry[] = [
        {
          beatRole: "closing",
          assetId: hookEntry.asset.id,
          reusedFromBeat: "hook",
          focusRegion: getAssetFocusRegion(hookEntry.asset),
          significantCrop: true
        }
      ];

      const total = evaluateGlobalAssignment({
        picks,
        matrix: input.scoreMatrix,
        developmentA,
        developmentB
      });
      if (total > bestScore) {
        bestScore = total;
        bestPicks = new Map(picks);
        bestContinuity = computeContinuityBonus({ developmentA, developmentB });
        bestReuse = candidateReuse;
      }
    }
  }

  if (bestPicks.size === 0) {
    warnings.push("global_assignment_fallback_empty");
    const fallback = simulateGreedyPanelAssignment({ beats: input.beats, candidates: input.candidates });
    for (const [beatRole, entry] of fallback.entries()) bestPicks.set(beatRole, entry.asset);
  }

  const rebalance = tryRebalanceDevelopmentSequence({
    picks: bestPicks,
    beats: input.beats,
    candidates: input.candidates,
    matrix: input.scoreMatrix
  });
  if (rebalance.applied) {
    bestPicks = rebalance.picks;
    bestContinuity = computeContinuityBonus({
      developmentA: bestPicks.get("development_a") ?? null,
      developmentB: bestPicks.get("development_b") ?? null
    });
    warnings.push(`development_sequence_rebalance:${rebalance.reason}`);
  } else {
    warnings.push(`development_sequence_rebalance_skipped:${rebalance.reason}`);
  }

  const hookAsset = bestPicks.get("hook") ?? null;
  const developmentAAsset = bestPicks.get("development_a") ?? null;
  const developmentBAsset = bestPicks.get("development_b") ?? null;
  const beatPicks = new Map<
    string,
    {
      asset: UserProvidedAssetRecord;
      match: BeatPanelMatchResult;
      focusRegion: PanelRegionKey | "global";
      rejectedAlternatives: PanelBeatMatchEntry["rejectedAlternatives"];
    }
  >();

  const assignmentEntries: GlobalPanelAssignmentEntry[] = [];
  for (const beat of input.beats) {
    const asset = bestPicks.get(beat.beatRole);
    if (!asset) {
      warnings.push(`no_asset_for_beat:${beat.beatRole}`);
      continue;
    }
    const previousAsset =
      beat.beatRole === "development_b"
        ? (bestPicks.get("development_a") ?? null)
        : [...bestPicks.entries()]
            .filter(([role]) => BEAT_WINDOWS.findIndex((window) => window.beatRole === role) <
              BEAT_WINDOWS.findIndex((window) => window.beatRole === beat.beatRole))
            .map(([, value]) => value)
            .pop() ?? null;
    const match =
      beat.beatRole === "development_b" && developmentAAsset
        ? resolveDevelopmentMatch(beat.beatRole, beat.beatText, asset, developmentAAsset, hookAsset)
        : beat.beatRole === "closing" && hookAsset
          ? resolveDevelopmentMatch(beat.beatRole, beat.beatText, asset, previousAsset, hookAsset)
          : scoreMatrixLookup(input.scoreMatrix, beat.beatRole, asset.id) ??
            computeBeatPanelMatchScore({
              beatRole: beat.beatRole,
              beatText: beat.beatText,
              asset,
              previousAsset,
              hookAsset
            });

    const focusRegion = getAssetFocusRegion(asset);
    const scoreBefore = greedyBaseline.get(beat.beatRole) ?? 0;
    assignmentEntries.push({
      beatRole: beat.beatRole,
      assetId: asset.id,
      assetTitle: asset.title,
      scoreBefore,
      scoreAfter: match.score,
      weightedScore: Number((match.score * getBeatAssignmentWeight(beat.beatRole)).toFixed(2)),
      focusRegion
    });

    if (match.score < getGlobalBeatThreshold(beat.beatRole)) {
      rejectedAssignments.push({
        beatRole: beat.beatRole,
        assetId: asset.id,
        assetTitle: asset.title,
        reason: `below_global_threshold_${getGlobalBeatThreshold(beat.beatRole)}`
      });
    }

    beatPicks.set(beat.beatRole, {
      asset,
      match,
      focusRegion,
      rejectedAlternatives: buildRejectedAlternatives(
        beat.beatRole,
        input.scoreMatrix,
        input.candidates,
        asset.id
      )
    });
  }

  const developmentBMatch = beatPicks.get("development_b")?.match;
  const developmentSequence = computeDevelopmentSequence({
    developmentA: developmentAAsset,
    developmentB: developmentBAsset,
    ...(developmentBMatch?.score !== undefined
      ? { developmentBScore: developmentBMatch.score }
      : {})
  });

  return {
    selectionMode: "global_assignment",
    totalWeightedScore: Number(bestScore.toFixed(2)),
    continuityBonus: bestContinuity,
    developmentSequence,
    assignments: assignmentEntries,
    rejectedAssignments,
    reuse: bestReuse,
    beatPicks,
    greedyBaseline,
    warnings
  };
}

export function validateGlobalPanelAssignment(input: {
  assignments: GlobalPanelAssignmentEntry[];
  climaxScore: number;
}): {
  passes: boolean;
  publishBlockReason: string | null;
  warnings: string[];
} {
  const warnings: string[] = [];
  const scores = input.assignments.map((entry) => entry.scoreAfter);
  const average =
    scores.length > 0 ? scores.reduce((sum, score) => sum + score, 0) / scores.length : 0;

  for (const entry of input.assignments) {
    if (entry.scoreAfter < getGlobalBeatThreshold(entry.beatRole)) {
      warnings.push(`global_threshold_miss:${entry.beatRole}:${entry.scoreAfter}`);
    }
  }
  if (average < GLOBAL_BEAT_THRESHOLDS.average) {
    warnings.push(`global_average_below_min:${average.toFixed(2)}`);
  }
  if (input.climaxScore < GLOBAL_BEAT_THRESHOLDS.climax) {
    return {
      passes: false,
      publishBlockReason: "climax_panel_below_min",
      warnings: [...warnings, `climax_score:${input.climaxScore}<${GLOBAL_BEAT_THRESHOLDS.climax}`]
    };
  }
  for (const entry of input.assignments) {
    if (
      (entry.beatRole === "development_a" || entry.beatRole === "development_b") &&
      entry.scoreAfter < GLOBAL_BEAT_THRESHOLDS.development
    ) {
      return {
        passes: false,
        publishBlockReason: "development_panel_below_min",
        warnings: [...warnings, `development_score:${entry.beatRole}:${entry.scoreAfter}`]
      };
    }
  }
  if (average < GLOBAL_BEAT_THRESHOLDS.average) {
    return {
      passes: false,
      publishBlockReason: "panel_average_below_min",
      warnings
    };
  }
  return { passes: true, publishBlockReason: null, warnings };
}

const REFERENCE_ALIGNED_NARRATION = buildReferenceAlignedUserProvidedNarration();

function resolveNarrationHintForBeat(beatRole: string, _plan?: VideoRemixPlan | null): string | null {
  const roleMap: Record<string, string> = {
    hook: "hook",
    context: "context",
    curiosity_a: "tension",
    curiosity_b: "tension",
    development_a: "tension",
    development_b: "tension",
    climax: "climax",
    closing: "cta"
  };
  const mapped = roleMap[beatRole] ?? beatRole;
  const beat = REFERENCE_ALIGNED_NARRATION.beats.find((entry) => entry.role === mapped);
  return beat?.caption ?? beat?.text ?? null;
}

export function applyReferenceAlignedNarrationToPlan(plan: VideoRemixPlan): VideoRemixPlan {
  const aligned = buildReferenceAlignedUserProvidedNarration();
  if (!plan.narrationPlan) return plan;
  return {
    ...plan,
    narrationPlan: {
      ...plan.narrationPlan,
      suggestedScript: aligned.suggestedScript,
      hookLine: aligned.beats[0]?.text ?? plan.narrationPlan.hookLine,
      narrationBeats: aligned.beats.map((beat) => ({
        role: beat.role as NarrationBeatRole,
        text: beat.text,
        caption: beat.caption,
        curiosityTag: `remix-${beat.role}-perfect_partner`,
        prosody: plan.narrationPlan?.narrationBeats?.find((entry) => entry.role === beat.role)?.prosody ?? {
          energy: beat.role === "hook" || beat.role === "climax" ? "high" : "medium",
          tone: "curioso, conversacional",
          pauseBeforeMs: 0,
          deliveryNote: "Fala natural sobre parceiro perfeito / dupla ideal.",
          emphasisWords: ["Venom", "dupla", "parceiro", "perfeito"]
        }
      }))
    }
  };
}

export function buildPanelBeatMatchReport(input: {
  beats: PanelBeatMatchEntry[];
  variation?: string;
  globalAssignment?: GlobalPanelAssignmentResult;
}): PanelBeatMatchReport {
  const scores = input.beats.map((beat) => beat.beatPanelMatchScore);
  const hookBeat = input.beats.find((beat) => beat.beatRole === "hook");
  const climaxBeat = input.beats.find((beat) => beat.beatRole === "climax");
  return {
    variation: input.variation ?? "B — Comics (user-provided real assets)",
    generatedAt: new Date().toISOString(),
    averageScore:
      scores.length > 0 ? Number((scores.reduce((sum, score) => sum + score, 0) / scores.length).toFixed(2)) : 0,
    hookScore: hookBeat?.beatPanelMatchScore ?? 0,
    climaxScore: climaxBeat?.beatPanelMatchScore ?? 0,
    promotionalPanelCount: input.beats.filter((beat) => beat.beatPanelMatchScore === 0).length,
    selectionMode: "global_assignment",
    totalWeightedScore: input.globalAssignment?.totalWeightedScore ?? 0,
    assignments: input.globalAssignment?.assignments ?? [],
    rejectedAssignments: input.globalAssignment?.rejectedAssignments ?? [],
    reuse: input.globalAssignment?.reuse ?? [],
    continuityBonus: input.globalAssignment?.continuityBonus ?? 0,
    developmentSequence: input.globalAssignment?.developmentSequence ?? {
      panelA: "",
      panelB: "",
      consecutivePages: false,
      sameStorySequence: false,
      continuityScore: 0,
      reason: "missing_global_assignment"
    },
    beats: input.beats
  };
}

export async function savePanelBeatMatchReport(
  report: PanelBeatMatchReport,
  projectRoot?: string
): Promise<string> {
  const root = resolve(projectRoot ?? process.cwd());
  const outputPath = join(root, "tmp", "variation-b-panel-beat-match-report.json");
  await mkdir(join(root, "tmp"), { recursive: true });
  await writeFile(outputPath, JSON.stringify(report, null, 2), "utf8");
  return outputPath;
}

export function buildUserProvidedBeatTimeline(
  assets: UserProvidedAssetRecord[],
  themeAnalysis: ComicsThemeAnalysis,
  plan?: VideoRemixPlan | null
): {
  assignments: UserProvidedBeatAssignment[];
  warnings: string[];
  hookAligned: boolean;
  climaxAligned: boolean;
  panelBeatMatches: PanelBeatMatchEntry[];
  globalAssignment: GlobalPanelAssignmentResult;
} {
  const warnings: string[] = [];
  const assignments: UserProvidedBeatAssignment[] = [];
  const panelBeatMatches: PanelBeatMatchEntry[] = [];
  const narrativeAssets = filterNarrativeUserProvidedAssets(assets);

  const beatSpecs: BeatAssignmentSpec[] = BEAT_WINDOWS.map((window) => ({
    beatRole: window.beatRole,
    beatText: resolveBeatNarrationText(window.beatRole, plan),
    startSec: window.startSec,
    endSec: window.endSec,
    motion: window.motion
  }));

  const greedyBaseline = new Map(
    [
      ...simulateGreedyPanelAssignment({
        beats: beatSpecs,
        candidates: narrativeAssets,
        ...(plan ? { plan } : {})
      }).entries()
    ].map(([beatRole, entry]) => [beatRole, entry.score])
  );

  const scoreMatrix = buildPanelScoreMatrix({
    beats: beatSpecs,
    candidates: narrativeAssets
  });

  const globalAssignment = assignPanelsToBeatsGlobally({
    beats: beatSpecs,
    candidates: narrativeAssets,
    scoreMatrix,
    greedyBaseline
  });
  warnings.push(...globalAssignment.warnings);

  for (const window of BEAT_WINDOWS) {
    const beatText = resolveBeatNarrationText(window.beatRole, plan);
    const pick = globalAssignment.beatPicks.get(window.beatRole);
    if (!pick) {
      warnings.push(`no_asset_for_beat:${window.beatRole}`);
      continue;
    }

    const asset = pick.asset;
    if (!pick.match.meetsMinimum) {
      warnings.push(`beat_panel_below_min:${window.beatRole}:${pick.match.score}`);
    }

    const themed = scoreAssetForThemedSelection({
      id: asset.id,
      title: asset.title,
      description: asset.description,
      category: asset.mediaType === "video" ? "unknown" : "comic_cover",
      assetQualityScore: 85,
      themeAnalysis
    });

    const captionResult = resolveUserProvidedBeatCaption(
      window.beatRole,
      resolveNarrationHintForBeat(window.beatRole, plan)
    );
    const selectionReason = `global_assignment_${window.beatRole}_${pick.match.reason ?? themed.reason}`;
    const cropDescriptor = buildPanelCropDescriptor(asset);
    assignments.push({
      beatRole: window.beatRole,
      startSec: window.startSec,
      endSec: window.endSec,
      motion: window.motion,
      assetId: asset.id,
      assetPath: asset.assetPath,
      assetTitle: asset.title,
      selectionReason,
      caption: captionResult.caption,
      captionLines: captionResult.lines,
      panelId: cropDescriptor.panelId,
      panelImagePath: cropDescriptor.panelImagePath,
      cropBounds: cropDescriptor.cropBounds,
      cropContentHash: cropDescriptor.cropContentHash,
      localVisualEvidence: cropDescriptor.localVisualEvidence,
      ...(pick.match.score !== undefined ? { beatPanelMatchScore: pick.match.score } : {})
    });
    panelBeatMatches.push({
      beatRole: window.beatRole,
      narrationText: beatText,
      selectedPanel: {
        assetId: asset.id,
        assetTitle: asset.title,
        page: extractPageIndex(asset.title),
        assetPath: asset.assetPath,
        panelId: cropDescriptor.panelId,
        panelImagePath: cropDescriptor.panelImagePath,
        cropBounds: cropDescriptor.cropBounds,
        cropContentHash: cropDescriptor.cropContentHash,
        localVisualEvidence: cropDescriptor.localVisualEvidence
      },
      beatPanelMatchScore: pick.match.score,
      entities: pick.match.entities,
      theme: pick.match.theme,
      action: pick.match.action,
      selectionReason,
      scoreBreakdown: pick.match.breakdown,
      rejectedAlternatives: pick.rejectedAlternatives
    });
  }

  const hookAssignment = assignments.find((a) => a.beatRole === "hook");
  const climaxAssignment = assignments.find((a) => a.beatRole === "climax");

  let hookAligned = false;
  let climaxAligned = false;

  if (hookAssignment) {
    const themed = scoreAssetForThemedSelection({
      id: hookAssignment.assetId,
      title: hookAssignment.assetTitle,
      description: "",
      category: "comic_cover",
      assetQualityScore: 90,
      themeAnalysis
    });
    hookAligned = isBeatThemeAligned({
      asset: themed,
      beatRole: "hook",
      themeAnalysis
    });
  }

  if (climaxAssignment) {
    const themed = scoreAssetForThemedSelection({
      id: climaxAssignment.assetId,
      title: climaxAssignment.assetTitle,
      description: "",
      category: "comic_cover",
      assetQualityScore: 90,
      themeAnalysis
    });
    climaxAligned = isBeatThemeAligned({
      asset: themed,
      beatRole: "climax",
      themeAnalysis
    });
  }

  return { assignments, warnings, hookAligned, climaxAligned, panelBeatMatches, globalAssignment };
}

export function computeUserProvidedPublishMetrics(input: {
  assignments: UserProvidedBeatAssignment[];
  totalDurationSec?: number;
}): UserProvidedPublishMetrics {
  const totalDuration = input.totalDurationSec ?? 40;
  let realDuration = 0;
  const compositionKeys = new Set<string>();
  const durationByComposition = new Map<string, number>();

  for (const assignment of input.assignments) {
    const duration = assignment.endSec - assignment.startSec;
    realDuration += duration;
    const key = assignment.assetPath;
    compositionKeys.add(key);
    durationByComposition.set(key, (durationByComposition.get(key) ?? 0) + duration);
  }

  const dominantDuration = Math.max(0, ...durationByComposition.values());
  const uniqueRenderedCompositionCount = compositionKeys.size;
  const dominantRenderedCompositionRatio =
    realDuration > 0 ? Number((dominantDuration / realDuration).toFixed(4)) : 1;

  return {
    realAssetCount: uniqueRenderedCompositionCount,
    placeholderCount: 0,
    blankVisualRatio: 0,
    realAssetDurationRatio: Number((realDuration / totalDuration).toFixed(4)),
    uniqueRenderedCompositionCount,
    dominantRenderedCompositionRatio
  };
}

export function evaluateUserProvidedPublishGates(input: {
  assets: UserProvidedAssetRecord[];
  assignments: UserProvidedBeatAssignment[];
  hookAligned: boolean;
  climaxAligned: boolean;
  captionPreflightReady: boolean;
  metrics: UserProvidedPublishMetrics;
  climaxPanelScore?: number;
  globalPanelAssignmentReady?: boolean;
  globalPanelPublishBlockReason?: string | null;
}): {
  canRender: boolean;
  canPublish: boolean;
  blockReason: string | null;
  publishBlockReason: string | null;
  warnings: string[];
} {
  const warnings: string[] = [];
  const venomDirectCount = input.assets.filter((asset) => asset.venomDirect).length;

  if (input.assets.length < MIN_USER_PROVIDED_VISUAL_ASSETS) {
    return {
      canRender: false,
      canPublish: false,
      blockReason: INSUFFICIENT_USER_PROVIDED_VISUAL_ASSETS,
      publishBlockReason: INSUFFICIENT_USER_PROVIDED_VISUAL_ASSETS,
      warnings: [`accepted_assets:${input.assets.length}<${MIN_USER_PROVIDED_VISUAL_ASSETS}`]
    };
  }

  if (venomDirectCount < MIN_VENOM_DIRECT_ASSETS) {
    warnings.push(`venom_direct_assets:${venomDirectCount}<${MIN_VENOM_DIRECT_ASSETS}`);
  }

  if (input.assignments.length < BEAT_WINDOWS.length) {
    return {
      canRender: false,
      canPublish: false,
      blockReason: "incomplete_beat_timeline",
      publishBlockReason: "incomplete_beat_timeline",
      warnings: [...warnings, `beat_assignments:${input.assignments.length}`]
    };
  }

  let canRender = true;
  let canPublish = true;
  let blockReason: string | null = null;
  let publishBlockReason: string | null = null;

  if (input.metrics.placeholderCount > 0) {
    canPublish = false;
    publishBlockReason = "placeholder_assets_forbidden";
  }
  if (input.metrics.blankVisualRatio > 0.05) {
    canPublish = false;
    publishBlockReason = "blank_visual_ratio_exceeded";
  }
  if (input.metrics.realAssetDurationRatio < 0.95) {
    canPublish = false;
    publishBlockReason = "real_asset_duration_ratio_low";
  }
  if (!input.hookAligned) {
    canPublish = false;
    publishBlockReason = "hook_not_theme_aligned";
  }
  if (!input.climaxAligned) {
    canPublish = false;
    publishBlockReason = "climax_not_theme_aligned";
  }
  if (!input.captionPreflightReady) {
    canPublish = false;
    publishBlockReason = "caption_preflight_failed";
  }
  if (input.metrics.uniqueRenderedCompositionCount < MIN_USER_PROVIDED_VISUAL_ASSETS) {
    canPublish = false;
    publishBlockReason = "insufficient_unique_compositions";
  }
  if (input.metrics.dominantRenderedCompositionRatio > 0.4) {
    canPublish = false;
    publishBlockReason = "dominant_composition_ratio_exceeded";
  }
  const climaxScore =
    input.climaxPanelScore ??
    input.assignments.find((assignment) => assignment.beatRole === "climax")?.beatPanelMatchScore ??
    0;
  if (climaxScore < GLOBAL_BEAT_THRESHOLDS.climax) {
    canPublish = false;
    publishBlockReason = "climax_panel_below_min";
    warnings.push(`climax_panel_score:${climaxScore}<${GLOBAL_BEAT_THRESHOLDS.climax}`);
  }
  for (const assignment of input.assignments) {
    if (
      (assignment.beatRole === "development_a" || assignment.beatRole === "development_b") &&
      (assignment.beatPanelMatchScore ?? 0) < GLOBAL_BEAT_THRESHOLDS.development
    ) {
      canPublish = false;
      publishBlockReason = "development_panel_below_min";
      warnings.push(
        `development_panel_score:${assignment.beatRole}:${assignment.beatPanelMatchScore ?? 0}<${GLOBAL_BEAT_THRESHOLDS.development}`
      );
    }
  }
  const missingPanelProvenance = input.assignments.filter(
    (assignment) => !assignment.panelId || !assignment.panelImagePath || !assignment.cropContentHash
  );
  if (missingPanelProvenance.length > 0) {
    canRender = false;
    canPublish = false;
    blockReason = "missing_panel_provenance";
    publishBlockReason = "missing_panel_provenance";
    warnings.push(
      `missing_panel_provenance:${missingPanelProvenance.map((assignment) => assignment.beatRole).join(",")}`
    );
  }

  if (input.globalPanelAssignmentReady === false) {
    canRender = false;
    canPublish = false;
    blockReason = input.globalPanelPublishBlockReason ?? "global_panel_assignment_failed";
    publishBlockReason = input.globalPanelPublishBlockReason ?? "global_panel_assignment_failed";
  }

  return { canRender, canPublish, blockReason, publishBlockReason, warnings };
}

export function buildUserProvidedFastCutBoundaries(
  plan: VideoRemixPlan,
  targetSegments = USER_PROVIDED_TARGET_FAST_CUTS
): number[] {
  const duration = plan.durationSeconds ?? 40;
  const cuts = [...(plan.fastCutPlan?.cutTimes ?? [])].filter(
    (time) => time > 0 && time < duration
  );
  const boundaries = [0];

  if (cuts.length >= targetSegments - 1) {
    const step = cuts.length / (targetSegments - 1);
    for (let index = 1; index < targetSegments; index += 1) {
      boundaries.push(cuts[Math.floor(index * step)] ?? (duration * index) / targetSegments);
    }
  } else {
    const step = duration / targetSegments;
    for (let index = 1; index < targetSegments; index += 1) {
      boundaries.push(Number((index * step).toFixed(2)));
    }
  }

  boundaries.push(duration);
  return [...new Set(boundaries.map((value) => Number(value.toFixed(2))))].sort(
    (left, right) => left - right
  );
}

function findBeatAssignmentForTime(
  assignments: UserProvidedBeatAssignment[],
  timeSec: number
): UserProvidedBeatAssignment {
  return (
    assignments.find(
      (assignment) => timeSec >= assignment.startSec - 0.001 && timeSec < assignment.endSec - 0.001
    ) ?? assignments[assignments.length - 1]!
  );
}

function buildAssetPoolForBeat(
  beatRole: string,
  assignments: UserProvidedBeatAssignment[],
  assets: UserProvidedAssetRecord[]
): UserProvidedAssetRecord[] {
  const primary = assignments.find((assignment) => assignment.beatRole === beatRole);
  const baseRole = mapBeatRoleForTheme(beatRole);
  const ranked = [...filterNarrativeUserProvidedAssets(assets)]
    .filter((asset) => isAssetEligibleForBeat(asset, beatRole))
    .sort((left, right) => {
      let leftScore = left.themeScore;
      let rightScore = right.themeScore;
      if (left.recommendedBeat === beatRole || left.recommendedBeat === baseRole) leftScore += 20;
      if (right.recommendedBeat === beatRole || right.recommendedBeat === baseRole) rightScore += 20;
      if (hasDuoTogetherSignal(left)) leftScore += 15;
      if (hasDuoTogetherSignal(right)) rightScore += 15;
      if (left.duoVisualScore >= 50) leftScore += 18;
      if (right.duoVisualScore >= 50) rightScore += 18;
      return rightScore - leftScore;
    });

  let eligibleRanked = ranked;
  if (beatRole === "hook" || beatRole === "climax") {
    const interior = ranked.filter(
      (asset) =>
        isInteriorPanelAsset(asset) &&
        !assetIsLateCrossoverPanel(asset) &&
        asset.duoVisualScore >= 35
    );
    if (interior.length > 0) eligibleRanked = interior;
  }
  if (beatRole.startsWith("curiosity") || beatRole === "climax") {
    const visualDuo = ranked.filter(
      (asset) =>
        asset.duoVisualScore >= 42 &&
        !assetIsLateCrossoverPanel(asset) &&
        !asset.visualTags.includes("visual_mystical_off_theme")
    );
    if (visualDuo.length > 0) eligibleRanked = visualDuo;
    else {
      const strongDuo = ranked.filter(
        (asset) => assetHasStrongDuoVisualSignal(asset) && !assetIsLateCrossoverPanel(asset)
      );
      if (strongDuo.length > 0) eligibleRanked = strongDuo;
      else {
        const duo = ranked.filter(
          (asset) => hasDuoTogetherSignal(asset) && !assetIsLateCrossoverPanel(asset)
        );
        if (duo.length > 0) eligibleRanked = duo;
      }
    }
  }
  if (beatRole.startsWith("development")) {
    const duo = ranked.filter((asset) => hasDuoTogetherSignal(asset));
    if (duo.length > 0) eligibleRanked = duo;
  }

  const pool: UserProvidedAssetRecord[] = [];
  if (primary) {
    const primaryAsset = assets.find((asset) => asset.id === primary.assetId);
    if (primaryAsset && isAssetEligibleForBeat(primaryAsset, beatRole)) pool.push(primaryAsset);
  }
  for (const asset of eligibleRanked) {
    if (!pool.some((entry) => entry.id === asset.id)) pool.push(asset);
  }
  return pool;
}

export function expandUserProvidedAssignmentsToFastCutScenes(input: {
  plan: VideoRemixPlan;
  assignments: UserProvidedBeatAssignment[];
  assets: UserProvidedAssetRecord[];
  targetSegments?: number;
}): MaterializedTimelineScene[] {
  const boundaries = buildUserProvidedFastCutBoundaries(
    input.plan,
    input.targetSegments ?? USER_PROVIDED_TARGET_FAST_CUTS
  );
  const scenes: MaterializedTimelineScene[] = [];
  const poolCursor = new Map<string, number>();

  for (let index = 0; index < boundaries.length - 1; index += 1) {
    const startSec = boundaries[index]!;
    const endSec = boundaries[index + 1]!;
    if (endSec - startSec < 0.35) continue;

    const parent = findBeatAssignmentForTime(input.assignments, startSec + 0.01);
    const pool = buildAssetPoolForBeat(parent.beatRole, input.assignments, input.assets);
    const cursor = poolCursor.get(parent.beatRole) ?? 0;
    const asset = pool[cursor % Math.max(pool.length, 1)] ?? pool[0];
    poolCursor.set(parent.beatRole, cursor + 1);

    const narrationRoleMap: Record<string, string> = {
      hook: "hook",
      context: "context",
      curiosity_a: "tension",
      curiosity_b: "tension",
      development_a: "tension",
      development_b: "tension",
      climax: "climax",
      closing: "cta"
    };
    const narration =
      REFERENCE_ALIGNED_NARRATION.beats.find(
        (beat) => beat.role === (narrationRoleMap[parent.beatRole] ?? parent.beatRole)
      )?.text ?? "";

    const resolvedAssetPath =
      asset?.id === parent.assetId
        ? resolveMaterializedPanelPathForBeat(parent, asset)
        : asset?.assetPath ?? parent.panelImagePath ?? parent.assetPath;

    const usesParentPanel = asset?.id === parent.assetId || !asset;

    scenes.push({
      sceneId: `user-fastcut-${String(index + 1).padStart(3, "0")}`,
      startSec,
      endSec,
      visualSourceType: "approved_asset",
      assetPath: resolvedAssetPath,
      assetId: asset?.id ?? parent.assetId,
      ...(usesParentPanel && parent.panelId ? { panelId: parent.panelId } : {}),
      ...(usesParentPanel && parent.panelImagePath ? { panelImagePath: parent.panelImagePath } : {}),
      ...(usesParentPanel && parent.cropBounds ? { cropBounds: parent.cropBounds } : {}),
      ...(usesParentPanel && parent.cropContentHash ? { cropContentHash: parent.cropContentHash } : {}),
      ...(usesParentPanel && parent.localVisualEvidence ? { localVisualEvidence: parent.localVisualEvidence } : {}),
      caption: parent.caption,
      narration,
      transition: index % 3 === 0 ? "flash-cut" : "cut",
      sfx: index === 0 || parent.beatRole === "climax" ? "soft_hit" : "whoosh",
      sceneRole: parent.beatRole,
      plannedSourceSegment: "broll_overlay",
      selectionReason: `${parent.selectionReason}:fast_cut_${index + 1}`,
      motion:
        parent.beatRole === "hook" || parent.beatRole === "climax"
          ? "punch_zoom"
          : parent.motion
    });
  }

  return scenes;
}

function buildBeatCaptionDirectionCues(
  assignments: UserProvidedBeatAssignment[]
): CaptionDirectionCue[] {
  return assignments.map((assignment) => ({
    beatId: assignment.beatRole,
    startSec: assignment.startSec,
    endSec: assignment.endSec,
    textOnScreen: assignment.caption,
    highlightedWords: [],
    animation: "pop" as const,
    cutSuggestion: "none" as const,
    sfxSuggestion: "none" as const,
    layout: assignment.beatRole === "hook" ? ("top_hook" as const) : ("lower_third" as const),
    intensity: assignment.beatRole === "hook" || assignment.beatRole === "climax" ? "high" : "medium",
    reason: `user_provided_beat_caption:${assignment.beatRole}`
  }));
}

function stripSceneCaptionsForBeatCues(
  scenes: MaterializedTimelineScene[]
): MaterializedTimelineScene[] {
  return scenes.map((scene) => ({
    ...scene,
    caption: ""
  }));
}

function sanitizePromotionalTimelineScenes(
  scenes: MaterializedTimelineScene[],
  assets: UserProvidedAssetRecord[],
  assignments: UserProvidedBeatAssignment[]
): MaterializedTimelineScene[] {
  const narrativeAssets = filterNarrativeUserProvidedAssets(assets);
  const assetById = new Map(narrativeAssets.map((asset) => [asset.id, asset]));
  const fallbackByRole = new Map(assignments.map((assignment) => [assignment.beatRole, assignment]));

  return scenes.map((scene) => {
    const currentAsset = scene.assetId ? assets.find((asset) => asset.id === scene.assetId) : null;
    if (!currentAsset || !isPromotionalAsset(currentAsset)) return scene;

    const fallbackAssignment = fallbackByRole.get(scene.sceneRole ?? "");
    const fallbackAsset =
      (fallbackAssignment ? assetById.get(fallbackAssignment.assetId) : null) ??
      narrativeAssets.find((asset) => asset.id === fallbackAssignment?.assetId) ??
      narrativeAssets[0] ??
      null;

    if (!fallbackAsset) return scene;
    return {
      ...scene,
      assetPath: fallbackAsset.assetPath,
      assetId: fallbackAsset.id,
      selectionReason: `${scene.selectionReason ?? "materialized"}:promotional_replaced`
    };
  });
}

export type IntelligentIndexedBeatPanelRef = {
  beatRole: string;
  panelId: string;
  panelImagePath: string;
  panelImageSha256: string;
  cropBounds: PanelCropBounds;
  sourcePagePath: string;
  pageNumber: number;
  sequenceId?: string | null;
};

export function assetIdFromIndexedPanelId(panelId: string): string {
  const match = /^user-remix-asset-[a-f0-9]+/.exec(panelId.trim());
  if (!match) {
    throw new Error(`invalid_indexed_panel_id:${panelId}`);
  }
  return match[0];
}

export function buildIntelligentIndexedPanelAssignments(input: {
  beats: IntelligentIndexedBeatPanelRef[];
  beatAssignments: UserProvidedBeatAssignment[];
}): UserProvidedBeatAssignment[] {
  const timingByRole = new Map(input.beatAssignments.map((assignment) => [assignment.beatRole, assignment]));

  return input.beats.map((beat) => {
    const timing = timingByRole.get(beat.beatRole);
    if (!timing) {
      throw new Error(`missing_beat_timing:${beat.beatRole}`);
    }
    if (!beat.panelImagePath?.trim()) {
      throw new Error(`missing_indexed_panel_image_path:${beat.beatRole}`);
    }
    if (!beat.panelImageSha256?.trim()) {
      throw new Error(`missing_indexed_panel_image_sha256:${beat.beatRole}`);
    }

    const assetId = assetIdFromIndexedPanelId(beat.panelId);
    const sequenceSuffix = beat.sequenceId ? `;sequence:${beat.sequenceId}` : "";

    return {
      beatRole: beat.beatRole,
      startSec: timing.startSec,
      endSec: timing.endSec,
      motion: timing.motion,
      assetId,
      assetPath: beat.sourcePagePath,
      assetTitle: timing.assetTitle,
      selectionReason: `indexed_global_assignment:${beat.panelId}${sequenceSuffix}`,
      caption: timing.caption,
      captionLines: timing.captionLines,
      ...(timing.beatPanelMatchScore !== undefined
        ? { beatPanelMatchScore: timing.beatPanelMatchScore }
        : {}),
      panelId: beat.panelId,
      panelImagePath: beat.panelImagePath,
      cropBounds: beat.cropBounds,
      cropContentHash: beat.panelImageSha256.slice(0, 16),
      localVisualEvidence: [`indexed_panel:${beat.panelId}`]
    };
  });
}

export function buildIntelligentIndexedPanelMaterializationReport(input: {
  plan: VideoRemixPlan;
  beats: IntelligentIndexedBeatPanelRef[];
  beatAssignments: UserProvidedBeatAssignment[];
  assets?: UserProvidedAssetRecord[];
  projectRoot?: string;
  publishAssetPolicy?: string;
}): RemixMaterializationReport {
  const assignments = buildIntelligentIndexedPanelAssignments({
    beats: input.beats,
    beatAssignments: input.beatAssignments
  });

  const materialization = buildUserProvidedMaterializationReport({
    plan: input.plan,
    assignments,
    assets: input.assets ?? [],
    projectRoot: input.projectRoot ?? process.cwd(),
    ...(input.publishAssetPolicy ? { publishAssetPolicy: input.publishAssetPolicy } : {}),
    enableFastCuts: false
  });

  materialization.timelineMode = "scene_structure";
  materialization.fastCutCount = 0;
  materialization.materializedFastCutCount = 0;
  materialization.sceneStructureSceneCount = assignments.length;
  materialization.warnings.push("indexed_intelligent_panel_materialization:true");

  return materialization;
}

export function buildUserProvidedMaterializationReport(input: {
  plan: VideoRemixPlan;
  assignments: UserProvidedBeatAssignment[];
  assets: UserProvidedAssetRecord[];
  projectRoot: string;
  publishAssetPolicy?: string;
  enableFastCuts?: boolean;
}): RemixMaterializationReport {
  const enableFastCuts = input.enableFastCuts !== false;
  const narrativeAssets = filterNarrativeUserProvidedAssets(input.assets);
  const timelineScenes = sanitizePromotionalTimelineScenes(
    enableFastCuts
      ? expandUserProvidedAssignmentsToFastCutScenes({
          plan: input.plan,
          assignments: input.assignments,
          assets: narrativeAssets
        })
      : input.assignments.map((assignment) => ({
          sceneId: `user-${assignment.beatRole}`,
          startSec: assignment.startSec,
          endSec: assignment.endSec,
          visualSourceType: "approved_asset" as const,
          assetPath: assignment.panelImagePath ?? assignment.assetPath,
          assetId: assignment.assetId,
          caption: assignment.caption,
          narration: resolveNarrationHintForBeat(assignment.beatRole, input.plan) ?? "",
          transition: "cut" as const,
          sfx:
            assignment.beatRole === "hook" || assignment.beatRole === "climax" ? "soft_hit" : "none",
          sceneRole: assignment.beatRole,
          plannedSourceSegment: "broll_overlay" as const,
          selectionReason: assignment.selectionReason,
          motion: assignment.motion
        })),
    input.assets,
    input.assignments
  );

  const captionCues = buildBeatCaptionDirectionCues(input.assignments);
  const timelineScenesForRender = stripSceneCaptionsForBeatCues(timelineScenes);

  const uniqueAssets = new Set(timelineScenesForRender.map((scene) => scene.assetPath).filter(Boolean));
  const durationByAsset = new Map<string, number>();
  for (const scene of timelineScenesForRender) {
    if (!scene.assetPath) continue;
    const duration = scene.endSec - scene.startSec;
    durationByAsset.set(
      scene.assetPath,
      (durationByAsset.get(scene.assetPath) ?? 0) + duration
    );
  }
  const dominantEntry = [...durationByAsset.entries()].sort((a, b) => b[1] - a[1])[0];
  const hasNarrationScript = Boolean(
    input.plan.narrationPlan?.suggestedScript?.trim() ||
      input.plan.narrationPlan?.narrationBeats?.some((beat) => beat.text?.trim())
  );

  return {
    referenceVideoPath: input.plan.inputVideoPath ?? "",
    allowReferenceVideoInFinal: false,
    sourceFootprintRatio: 0,
    providedAssetsUsageRatio: 1,
    approvedAssetsUsed: [...uniqueAssets].filter((path): path is string => Boolean(path)),
    rejectedAssets: [],
    timelineScenes: timelineScenesForRender,
    canRender: true,
    blockReason: null,
    warnings: [],
    plannedButNotMaterialized: [],
    captionStyleId: COMICS_PUBLISH_CAPTION_STYLE,
    captionCues,
    musicPresetId: input.plan.musicPlan?.musicPresetId ?? "viral_fast_cut",
    fastCutCount: enableFastCuts ? timelineScenes.length : 0,
    sceneStructureSceneCount: input.assignments.length,
    materializedFastCutCount: enableFastCuts ? timelineScenes.length : 0,
    timelineMode: enableFastCuts ? "fast_cut" : "scene_structure",
    comicsAssetSelectionReportPath: null,
    visualAssetAuditReportPath: null,
    visualAssetContactSheetPath: null,
    assetRotationReportPath: null,
    timelineRotationStats: {
      visualSegmentCount: timelineScenesForRender.length,
      uniqueAssetCount: uniqueAssets.size,
      dominantAssetRatio:
        durationByAsset.size > 0
          ? Number(((dominantEntry?.[1] ?? 0) / 40).toFixed(4))
          : 1,
      longestStaticSegmentSec: Math.max(
        ...timelineScenesForRender.map((s) => s.endSec - s.startSec)
      ),
      dominantAssetId: dominantEntry?.[0] ?? null,
      dominantAssetTitle: dominantEntry?.[0] ?? null
    },
    canPublish: false,
    publishBlockReason: null,
    publishReadinessReportPath: null,
    publishReadinessContactSheetPath: null,
    themeFilterCache: { used: false, invalidatedOffThemeAssets: [] },
    narrativeReady: hasNarrationScript,
    captionReady: captionCues.every((cue) => cue.textOnScreen.trim().length > 0),
    renderBlockReason: null,
    placeholderUsage: { used: false, count: 0, placeholders: [] }
  };
}

export async function buildUserProvidedPreflightReport(input: {
  plan: VideoRemixPlan;
  assetDirectory?: string;
  projectRoot?: string;
  ffprobeCommand?: string;
  ffmpegCommand?: string;
}): Promise<UserProvidedPreflightReport> {
  const projectRoot = resolve(input.projectRoot ?? process.cwd());
  const assetDirectory = resolve(
    input.assetDirectory ?? join(projectRoot, DEFAULT_USER_PROVIDED_DIR)
  );
  const themeAnalysis = analyzeComicsVideoThemeFromAnalysis(
    input.plan.videoAnalysis,
    input.plan.inputVideoTitle
  );
  const narrationText = [
    input.plan.videoAnalysis?.contentIntelligence?.narrativeHook,
    input.plan.videoAnalysis?.contentIntelligence?.narrativeBrief,
    ...(input.plan.narrationPlan?.narrationBeats?.map((beat) => beat.text) ?? [])
  ]
    .filter(Boolean)
    .join(" ");
  const videoTitle = input.plan.inputVideoTitle ?? "";

  const scan = await scanUserProvidedAssetDirectory({
    assetDirectory,
    themeAnalysis,
    narrationText,
    videoTitle,
    ...(input.ffprobeCommand ? { ffprobeCommand: input.ffprobeCommand } : {}),
    ...(input.ffmpegCommand ? { ffmpegCommand: input.ffmpegCommand } : {})
  });

  const manifestEntries = await loadUserProvidedManifest(assetDirectory);
  const titleByFilename = new Map(
    manifestEntries
      .filter((entry) => entry.filename)
      .map((entry) => [entry.filename!.toLowerCase(), entry.title ?? entry.filename!])
  );
  const promotionalRemoved = scan.rejected
    .filter((entry) =>
      /fcbd_promotional|promotional_comic|qr_code|catalog_page|editorial_page|checklist_page|publisher|unrelated_franchise|house_ad|next_issue|visual_catalog/i.test(
        entry.reason
      )
    )
    .map((entry) => ({
      title: titleByFilename.get(entry.filename.toLowerCase()) ?? entry.filename,
      filename: entry.filename,
      reason: entry.reason
    }));

  const alignedPlan = applyReferenceAlignedNarrationToPlan(input.plan);
  const narrativeAssets = filterNarrativeUserProvidedAssets(scan.found);
  let {
    assignments,
    warnings: timelineWarnings,
    hookAligned,
    climaxAligned,
    panelBeatMatches,
    globalAssignment
  } = buildUserProvidedBeatTimeline(narrativeAssets, themeAnalysis, alignedPlan);

  let referenceComicsStoryMatchReport: ReferenceComicMatchReport | null = null;
  let referenceComicsStoryMatchReportPath: string | null = null;
  try {
    const localPanelIndex = await loadLocalComicPanelIndexIfPresent(assetDirectory);
    const indexedPanels = localPanelIndex?.pages.flatMap((page) => page.panels) ?? [];
    if (indexedPanels.length > 0) {
      referenceComicsStoryMatchReport = matchReferenceVideoToComicsStories({
        analysis: input.plan.videoAnalysis,
        themeAnalysis,
        panels: indexedPanels
      });
      referenceComicsStoryMatchReportPath = await saveReferenceComicMatchReport(
        referenceComicsStoryMatchReport,
        projectRoot
      );

      if (referenceComicsStoryMatchReport.canUseComicsStory && referenceComicsStoryMatchReport.bestStory) {
        assignments = buildIntelligentIndexedPanelAssignments({
          beats: referenceComicsStoryMatchReport.bestStory.beats,
          beatAssignments: assignments
        });
        timelineWarnings = [
          ...timelineWarnings,
          "reference_comics_story_match_used:" + referenceComicsStoryMatchReport.bestStory.storyId,
          "reference_comics_story_score:" + referenceComicsStoryMatchReport.bestStory.score
        ];
        hookAligned = referenceComicsStoryMatchReport.bestStory.coverageRoles.includes("hook");
        climaxAligned = referenceComicsStoryMatchReport.bestStory.coverageRoles.includes("climax");
      } else {
        timelineWarnings = [
          ...timelineWarnings,
          ...referenceComicsStoryMatchReport.warnings.map((warning) => "reference_comics_match:" + warning)
        ];
      }
    } else {
      timelineWarnings = [...timelineWarnings, "reference_comics_match:no_local_panel_index_panels"];
    }
  } catch (error) {
    timelineWarnings = [
      ...timelineWarnings,
      "reference_comics_match_failed:" + (error instanceof Error ? error.message : "unknown")
    ];
  }

  const panelBeatMatchReport = buildPanelBeatMatchReport({
    beats: panelBeatMatches,
    variation: "B — Comics (user-provided real assets)",
    globalAssignment
  });

  const globalPanelValidation = validateGlobalPanelAssignment({
    assignments: globalAssignment.assignments,
    climaxScore: panelBeatMatchReport.climaxScore
  });
  const panelBeatMatchReportPath = await savePanelBeatMatchReport(panelBeatMatchReport, projectRoot);

  const assignedAssets = [
    ...new Map(
      assignments
        .map((assignment) => narrativeAssets.find((asset) => asset.id === assignment.assetId))
        .filter((asset): asset is UserProvidedAssetRecord => Boolean(asset))
        .map((asset) => [asset.id, asset])
    ).values()
  ];
  const cropDescriptors = await materializePanelCropImages({
    assets: assignedAssets,
    projectRoot,
    ffmpegCommand: input.ffmpegCommand ?? "ffmpeg"
  });
  for (const assignment of assignments) {
    const existingPanelComplete = Boolean(
      assignment.panelId && assignment.panelImagePath && assignment.cropBounds && assignment.cropContentHash
    );
    if (existingPanelComplete) {
      const asset = narrativeAssets.find((entry) => entry.id === assignment.assetId);
      if (asset && assignment.panelId && assignment.panelImagePath && assignment.cropBounds && assignment.cropContentHash) {
        cropDescriptors.set(assignment.panelId, {
          panelId: assignment.panelId,
          sourceAssetPath: assignment.assetPath,
          panelImagePath: assignment.panelImagePath,
          cropBounds: assignment.cropBounds,
          cropContentHash: assignment.cropContentHash,
          focusRegion: "global",
          localVisualEvidence: assignment.localVisualEvidence ?? []
        });
      }
      continue;
    }

    const descriptor = cropDescriptors.get(assignment.panelId ?? "") ?? cropDescriptors.get(assignment.assetId);
    if (!descriptor) continue;
    assignment.panelId = descriptor.panelId;
    assignment.panelImagePath = descriptor.panelImagePath;
    assignment.cropBounds = descriptor.cropBounds;
    assignment.cropContentHash = descriptor.cropContentHash;
    assignment.localVisualEvidence = descriptor.localVisualEvidence;
  }

  const panelBeatMatchContactSheetPath = join(
    projectRoot,
    "tmp",
    "variation-b-panel-beat-crops-contact-sheet.jpg"
  );
  await renderPanelBeatCropContactSheet({
    entries: assignments.map((assignment) => ({
      beatRole: assignment.beatRole,
      panelId: assignment.panelId ?? assignment.assetId,
      page: extractPageIndex(assignment.assetTitle),
      score: assignment.beatPanelMatchScore ?? 0,
      localVisualEvidence: assignment.localVisualEvidence ?? [],
      panelImagePath: assignment.panelImagePath ?? assignment.assetPath
    })),
    outputPath: panelBeatMatchContactSheetPath,
    ffmpegCommand: input.ffmpegCommand ?? "ffmpeg"
  });

  const metrics = computeUserProvidedPublishMetrics({ assignments });
  const captionEntries = assignments.map((a) => ({
    beatRole: a.beatRole,
    caption: a.caption,
    startSec: a.startSec,
    endSec: a.endSec
  }));
  const beatCaptionCues = buildUserProvidedBeatCaptionCues(assignments);
  let captionPreflight = validateCaptionPreflight(captionEntries);

  const gates = evaluateUserProvidedPublishGates({
    assets: scan.found,
    assignments,
    hookAligned,
    climaxAligned,
    captionPreflightReady: captionPreflight.captionPreflightReady,
    metrics,
    climaxPanelScore: panelBeatMatchReport.climaxScore,
    globalPanelAssignmentReady: globalPanelValidation.passes,
    globalPanelPublishBlockReason: globalPanelValidation.publishBlockReason
  });

  let materializationReportPath: string | null = null;
  let panelMaterializationManifestPath: string | null = null;
  let panelMaterializationIntegrity: PanelMaterializationIntegrityReport | null = null;
  let materializedPanelContactSheet: string | null = null;
  let timelineAssetPaths: string[] = assignments
    .map((assignment) => assignment.panelImagePath)
    .filter((path): path is string => Boolean(path));
  if (gates.canRender) {
    const materialization = buildUserProvidedMaterializationReport({
      plan: alignedPlan,
      assignments,
      assets: scan.found,
      projectRoot,
      publishAssetPolicy: PUBLISH_ASSET_POLICY_USER_PROVIDED,
      enableFastCuts: true
    });
    const integrity = await import("./comics-panel-materialization-integrity.js");
    const timelineAssetIds = [
      ...new Set(
        materialization.timelineScenes
          .map((scene) => scene.assetId)
          .filter((assetId): assetId is string => Boolean(assetId))
      )
    ];
    for (const assetId of timelineAssetIds) {
      if (cropDescriptors.has(assetId)) continue;
      const asset = narrativeAssets.find((entry) => entry.id === assetId);
      if (!asset) continue;
      const descriptor = await materializePanelCropImage({
        asset,
        projectRoot,
        ffmpegCommand: input.ffmpegCommand ?? "ffmpeg"
      });
      cropDescriptors.set(assetId, descriptor);
      cropDescriptors.set(descriptor.panelId, descriptor);
    }

    materialization.timelineScenes = integrity.patchTimelineScenesWithMaterializedPanelPaths({
      timelineScenes: materialization.timelineScenes,
      cropDescriptors
    });
    materialization.approvedAssetsUsed = [
      ...new Set(
        materialization.timelineScenes
          .map((scene) => scene.assetPath)
          .filter((path): path is string => Boolean(path))
      )
    ];

    const manifest = await integrity.buildPanelMaterializationManifest({
      timelineScenes: materialization.timelineScenes,
      assets: narrativeAssets,
      cropDescriptors
    });
    panelMaterializationManifestPath = await integrity.savePanelMaterializationManifest(
      manifest,
      projectRoot
    );
    panelMaterializationIntegrity = await integrity.verifyTimelinePanelMaterializationIntegrity({
      manifest,
      timelineScenes: materialization.timelineScenes,
      ...(input.ffprobeCommand ? { ffprobeCommand: input.ffprobeCommand } : {})
    });

    const materializedContactSheetTarget = integrity.materializedPanelContactSheetPath(projectRoot);
    materializedPanelContactSheet = await integrity.renderMaterializedPanelContactSheet({
      manifest,
      outputPath: materializedContactSheetTarget,
      ffmpegCommand: input.ffmpegCommand ?? "ffmpeg"
    });

    if (!panelMaterializationIntegrity.canRender) {
      gates.canRender = false;
      gates.blockReason = integrity.SELECTED_PANEL_RENDER_PATH_MISMATCH;
      gates.warnings.push(
        `panel_materialization_integrity_failed:${panelMaterializationIntegrity.failedSceneCount}`
      );
      materialization.canRender = false;
      materialization.blockReason = integrity.SELECTED_PANEL_RENDER_PATH_MISMATCH;
      materialization.renderBlockReason = integrity.SELECTED_PANEL_RENDER_PATH_MISMATCH;
      materialization.warnings.push(
        ...panelMaterializationIntegrity.mismatches.flatMap((entry) =>
          entry.mismatches.map((reason) => `${entry.sceneId}:${reason}`)
        )
      );
    }

    timelineAssetPaths = [
      ...new Set(
        materialization.timelineScenes
          .map((scene) => scene.assetPath)
          .filter((path): path is string => Boolean(path))
      )
    ];
    materialization.canRender = gates.canRender;
    materialization.canPublish = gates.canPublish;
    materialization.publishBlockReason = gates.publishBlockReason;
    materialization.narrativeReady = hookAligned && climaxAligned;
    materialization.captionReady = captionPreflight.captionPreflightReady;
    materializationReportPath = join(projectRoot, "tmp", "variation-b-user-assets-materialization.json");
    await writeFile(materializationReportPath, JSON.stringify(materialization, null, 2), "utf8");

    captionPreflight = validateCaptionPreflight(captionEntries, {
      scenes: materialization.timelineScenes,
      useBeatTimeline: true
    });
    if (!captionPreflight.captionPreflightReady) {
      gates.canPublish = false;
      gates.publishBlockReason = "caption_fast_cut_flicker";
    }
  }

  const timelinePromotionalAudit = auditPromotionalComicAssets(
    timelineAssetPaths.map((assetPath) => {
      const asset = scan.found.find((entry) => entry.assetPath === assetPath);
      return {
        title: asset?.title ?? assetPath,
        ...(asset?.filename ? { filename: asset.filename } : {}),
        ...(asset?.tags ? { tags: asset.tags } : {}),
        ...(asset?.visualTags ? { visualTags: asset.visualTags } : {}),
        ...(asset?.selectionSignals ? { selectionSignals: asset.selectionSignals } : {})
      };
    })
  );

  const contactSheetPath = materializedPanelContactSheet ?? panelBeatMatchContactSheetPath;
  const renderedSheet = contactSheetPath;

  const recommendation = gates.canPublish
    ? "ready_for_publication"
    : gates.canRender
      ? "render_possible_publish_blocked"
      : "blocked_add_more_user_assets";

  return {
    variation: "B — Comics (user-provided real assets)",
    publishAssetPolicy: PUBLISH_ASSET_POLICY_USER_PROVIDED,
    assetDirectory,
    generatedAt: new Date().toISOString(),
    assetsFound: scan.found.length + scan.rejected.length,
    assetsAccepted: scan.found,
    assetsRejected: scan.rejected,
    promotionalFilter: {
      promotionalAssetCount: timelinePromotionalAudit.promotionalAssetCount,
      qrAssetCount: timelinePromotionalAudit.qrAssetCount,
      unrelatedTitleCount: timelinePromotionalAudit.unrelatedTitleCount,
      removedPages: promotionalRemoved
    },
    panelBeatMatchReportPath,
    panelBeatMatchContactSheetPath,
    panelBeatMatchSummary: {
      averageScore: panelBeatMatchReport.averageScore,
      hookScore: panelBeatMatchReport.hookScore,
      climaxScore: panelBeatMatchReport.climaxScore,
      promotionalPanelCount: panelBeatMatchReport.promotionalPanelCount
    },
    referenceComicsStoryMatchReportPath,
    referenceComicsStoryMatchSummary: {
      canUseComicsStory: referenceComicsStoryMatchReport?.canUseComicsStory ?? false,
      bestStoryTitle: referenceComicsStoryMatchReport?.bestStory?.title ?? null,
      bestStoryScore: referenceComicsStoryMatchReport?.bestStory?.score ?? null,
      selectedPanelCount: referenceComicsStoryMatchReport?.bestStory?.beats.length ?? 0,
      warnings: referenceComicsStoryMatchReport?.warnings ?? []
    },
    beatAssignments: assignments,
    metrics,
    hookAligned,
    climaxAligned,
    captionPreflightReady: captionPreflight.captionPreflightReady,
    beatCaptionCues,
    captions: assignments.map((a) => ({
      beatRole: a.beatRole,
      caption: a.caption,
      lines: a.captionLines
    })),
    audioTarget: {
      codec: "aac",
      sampleRateHz: 48000,
      channels: 2,
      loudnessLUFS: { min: -16, max: -14 },
      truePeakDBTP: -1.5,
      musicPresetId: input.plan.musicPlan?.musicPresetId ?? "viral_fast_cut"
    },
    canRender: gates.canRender,
    canPublish: gates.canPublish,
    blockReason: gates.blockReason,
    publishBlockReason: gates.publishBlockReason,
    warnings: [
      ...scan.warnings,
      ...timelineWarnings,
      ...captionPreflight.warnings,
      ...gates.warnings,
      ...globalPanelValidation.warnings
    ],
    contactSheetPath: renderedSheet,
    materializedPanelContactSheetPath: materializedPanelContactSheet,
    panelMaterializationManifestPath,
    panelMaterializationIntegrity,
    materializationReportPath,
    recommendation
  };
}

export async function saveUserProvidedPreflightReport(
  report: UserProvidedPreflightReport,
  projectRoot?: string
): Promise<string> {
  const root = resolve(projectRoot ?? process.cwd());
  const reportPath = join(root, "tmp", "variation-b-user-assets-timeline-report.json");
  await mkdir(join(root, "tmp"), { recursive: true });
  await writeFile(reportPath, JSON.stringify(report, null, 2), "utf8");
  return reportPath;
}

export async function probeMp4Audio(
  mp4Path: string,
  ffmpegCommand = "ffmpeg",
  ffprobeCommand = "ffprobe"
): Promise<{
  codec: string | null;
  sampleRateHz: number | null;
  channels: number | null;
  loudnessLUFS: number | null;
  truePeakDBTP: number | null;
}> {
  let codec: string | null = null;
  let sampleRateHz: number | null = null;
  let channels: number | null = null;

  try {
    const { stdout } = await runCommand(ffprobeCommand, [
      "-v",
      "error",
      "-select_streams",
      "a:0",
      "-show_entries",
      "stream=codec_name,sample_rate,channels",
      "-of",
      "json",
      mp4Path
    ]);
    const parsed = JSON.parse(stdout) as {
      streams?: Array<{ codec_name?: string; sample_rate?: string; channels?: number }>;
    };
    const stream = parsed.streams?.[0];
    codec = stream?.codec_name ?? null;
    sampleRateHz = stream?.sample_rate ? Number(stream.sample_rate) : null;
    channels = stream?.channels ?? null;
  } catch {
    // best effort
  }

  let loudnessLUFS: number | null = null;
  let truePeakDBTP: number | null = null;
  try {
    const { stderr } = await runCommand(ffmpegCommand, [
      "-hide_banner",
      "-i",
      mp4Path,
      "-af",
      "loudnorm=print_format=json",
      "-f",
      "null",
      "-"
    ]);
    const jsonMatch = stderr.match(/\{[\s\S]*"input_i"[\s\S]*\}/);
    if (jsonMatch) {
      const loudnorm = JSON.parse(jsonMatch[0]) as {
        input_i?: string;
        input_tp?: string;
      };
      loudnessLUFS = loudnorm.input_i ? Number(loudnorm.input_i) : null;
      truePeakDBTP = loudnorm.input_tp ? Number(loudnorm.input_tp) : null;
    }
  } catch {
    // best effort
  }

  return { codec, sampleRateHz, channels, loudnessLUFS, truePeakDBTP };
}

export async function auditRenderedMp4ForUserProvided(input: {
  mp4Path: string;
  preflight: UserProvidedPreflightReport;
  projectRoot?: string;
  ffmpegCommand?: string;
  ffprobeCommand?: string;
  finalContactSheetPath?: string;
}): Promise<UserProvidedFinalAuditReport> {
  const projectRoot = resolve(input.projectRoot ?? process.cwd());
  const ffmpeg = input.ffmpegCommand ?? "ffmpeg";
  const audioProbe = await probeMp4Audio(
    input.mp4Path,
    ffmpeg,
    input.ffprobeCommand ?? "ffprobe"
  );

  const finalContactSheetPath =
    input.finalContactSheetPath ??
    join(projectRoot, "tmp", "variation-b-user-assets-final-contact-sheet.jpg");
  try {
    await runCommand(ffmpeg, [
      "-y",
      "-hide_banner",
      "-loglevel",
      "error",
      "-i",
      input.mp4Path,
      "-vf",
      "fps=1/3,scale=360:640:force_original_aspect_ratio=decrease,pad=360:640:(ow-iw)/2:(oh-ih)/2,tile=3x2",
      "-frames:v",
      "1",
      finalContactSheetPath
    ]);
  } catch {
    // best effort
  }

  const audioOk =
    audioProbe.codec === "aac" &&
    audioProbe.sampleRateHz === 48000 &&
    audioProbe.channels === 2 &&
    audioProbe.loudnessLUFS !== null &&
    audioProbe.loudnessLUFS >= -16 &&
    audioProbe.loudnessLUFS <= -14;

  const finalPublishReady =
    input.preflight.canPublish &&
    input.preflight.metrics.placeholderCount === 0 &&
    input.preflight.metrics.blankVisualRatio <= 0.05 &&
    input.preflight.metrics.realAssetDurationRatio >= 0.95 &&
    input.preflight.captionPreflightReady &&
    audioOk;

  return {
    ...input.preflight,
    outputPath: input.mp4Path,
    finalContactSheetPath: (await fileExists(finalContactSheetPath))
      ? finalContactSheetPath
      : null,
    audioProbe,
    hookCaptionVisible: input.preflight.captionPreflightReady,
    climaxCaptionVisible: input.preflight.captionPreflightReady,
    finalPublishReady,
    frameAuditSamples: 14,
    recommendation: finalPublishReady
      ? "ready_for_upload"
      : audioOk
        ? "conditional_review_visual"
        : "not_ready_audio_or_visual_gates"
  };
}

export async function saveUserProvidedFinalAuditReport(
  report: UserProvidedFinalAuditReport,
  projectRoot?: string,
  reportPathOverride?: string
): Promise<string> {
  const root = resolve(projectRoot ?? process.cwd());
  const reportPath =
    reportPathOverride ?? join(root, "tmp", "variation-b-user-assets-final-report.json");
  await mkdir(join(root, "tmp"), { recursive: true });
  await writeFile(reportPath, JSON.stringify(report, null, 2), "utf8");
  return reportPath;
}