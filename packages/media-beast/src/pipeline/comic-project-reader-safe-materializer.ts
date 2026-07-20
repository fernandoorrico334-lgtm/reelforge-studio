import { spawn } from "node:child_process";
import { constants } from "node:fs";
import { access, mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { ComicArcProjectBuilderV2Payload } from "./comic-arc-project-builder-v2.js";
import {
  materializeReaderSafePanelAsset,
  type ComicReaderSafePanelAsset
} from "./comic-reader-safe-panel-assets.js";
import type {
  LocalComicPanelEvidence,
  LocalComicPanelIndex
} from "./comics-local-panel-index.js";

export type ComicProjectReaderSafeMaterializedAsset = {
  sceneOrder: number;
  panelId: string;
  assetId: string;
  readerSafeImagePath: string;
  readerSafeImageSha256: string;
  outputWidth: 1080;
  outputHeight: 1920;
  intent: ComicReaderSafePanelAsset["intent"];
  originalCropBounds: ComicReaderSafePanelAsset["originalCropBounds"];
  expandedCropBounds: ComicReaderSafePanelAsset["expandedCropBounds"];
  reasons: string[];
  warnings: string[];
};

export type ComicProjectReaderSafeMaterializationReport = {
  source: "comic-project-reader-safe-materializer";
  generatedAt: string;
  materializedAssetCount: number;
  outputDirectory: string;
  assets: ComicProjectReaderSafeMaterializedAsset[];
  warnings: string[];
  candidateFirst: true;
  requiresManualApproval: true;
};

export type ComicProjectReaderSafeMaterializationResult = {
  source: "comic-project-reader-safe-materializer";
  generatedAt: string;
  payload: ComicArcProjectBuilderV2Payload;
  report: ComicProjectReaderSafeMaterializationReport;
  candidateFirst: true;
  requiresManualApproval: true;
};

type ImageDimensions = {
  width: number;
  height: number;
};

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK | constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

function runFfprobeDimensions(input: {
  imagePath: string;
  ffprobeCommand?: string;
}): Promise<ImageDimensions> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(
      input.ffprobeCommand ?? "ffprobe",
      [
        "-v",
        "error",
        "-select_streams",
        "v:0",
        "-show_entries",
        "stream=width,height",
        "-of",
        "json",
        input.imagePath
      ],
      { stdio: ["ignore", "pipe", "pipe"] }
    );
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr?.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`ffprobe image dimensions exited ${code}: ${stderr.slice(-800)}`));
        return;
      }
      try {
        const parsed = JSON.parse(stdout) as { streams?: Array<{ width?: number; height?: number }> };
        const stream = parsed.streams?.[0];
        if (!stream?.width || !stream.height) {
          reject(new Error(`ffprobe_missing_dimensions:${input.imagePath}`));
          return;
        }
        resolvePromise({ width: stream.width, height: stream.height });
      } catch (error) {
        reject(error);
      }
    });
  });
}

function buildPanelMap(index: LocalComicPanelIndex): Map<string, LocalComicPanelEvidence> {
  return new Map(index.pages.flatMap((page) => page.panels.map((panel) => [panel.panelId, panel] as const)));
}

function safeAssetId(panelId: string, sceneOrder: number): string {
  return `reader-safe-${sceneOrder}-${panelId.replace(/[^a-zA-Z0-9_-]/g, "-")}`.slice(0, 96);
}

function parseVisualRecipe(value: string | null): Record<string, unknown> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
  } catch {
    return {};
  }
  return {};
}

function stringifyVisualRecipe(value: Record<string, unknown>): string {
  return JSON.stringify(value, null, 0);
}

export async function materializeComicProjectReaderSafeAssets(input: {
  payload: ComicArcProjectBuilderV2Payload;
  panelIndex: LocalComicPanelIndex;
  outputDirectory: string;
  ffmpegCommand?: string;
  ffprobeCommand?: string;
  forceRebuild?: boolean;
}): Promise<ComicProjectReaderSafeMaterializationResult> {
  const warnings: string[] = [];
  const assets: ComicProjectReaderSafeMaterializedAsset[] = [];
  const panelById = buildPanelMap(input.panelIndex);
  const dimensionsBySourcePath = new Map<string, ImageDimensions>();
  const sceneByImageHash = new Map<string, Array<{ sceneOrder: number; panelId: string }>>();

  await mkdir(input.outputDirectory, { recursive: true });

  const scenes = [...input.payload.scenes];
  const panelAssetManifest = [...input.payload.panelAssetManifest];

  for (const manifest of panelAssetManifest) {
    const panel = panelById.get(manifest.panelId);
    const sceneIndex = scenes.findIndex((scene) => scene.order === manifest.sceneOrder);
    if (!panel) {
      warnings.push(`reader_safe_panel_missing:${manifest.panelId}`);
      continue;
    }
    if (sceneIndex < 0) {
      warnings.push(`reader_safe_scene_missing:${manifest.sceneOrder}:${manifest.panelId}`);
      continue;
    }
    if (!(await fileExists(panel.sourcePagePath))) {
      warnings.push(`reader_safe_source_page_missing:${panel.sourcePagePath}`);
      continue;
    }

    let dimensions = dimensionsBySourcePath.get(panel.sourcePagePath);
    if (!dimensions) {
      dimensions = await runFfprobeDimensions({
        imagePath: panel.sourcePagePath,
        ...(input.ffprobeCommand ? { ffprobeCommand: input.ffprobeCommand } : {})
      });
      dimensionsBySourcePath.set(panel.sourcePagePath, dimensions);
    }

    const materialized = await materializeReaderSafePanelAsset({
      panel,
      pageWidth: dimensions.width,
      pageHeight: dimensions.height,
      outputDirectory: join(input.outputDirectory, `scene-${manifest.sceneOrder}`),
      ...(input.ffmpegCommand ? { ffmpegCommand: input.ffmpegCommand } : {}),
      ...(input.forceRebuild !== undefined ? { forceRebuild: input.forceRebuild } : {})
    });

    const assetId = safeAssetId(manifest.panelId, manifest.sceneOrder);
    manifest.panelImagePath = materialized.readerSafeImagePath;
    manifest.importRequired = false;
    manifest.recommendedTags = [
      ...new Set([
        ...manifest.recommendedTags,
        "reader-safe",
        "vertical-916",
        `reader-safe-intent:${materialized.intent}`
      ])
    ];

    const scene = scenes[sceneIndex];
    if (!scene) {
      warnings.push('reader_safe_scene_unavailable:' + manifest.sceneOrder + ':' + manifest.panelId);
      continue;
    }
    const recipe = parseVisualRecipe(scene.visualRecipe);
    scenes[sceneIndex] = {
      ...scene,
      assetId,
      visualSourceMode: "asset_only",
      visualRecipe: stringifyVisualRecipe({
        ...recipe,
        readerSafePanelAsset: {
          assetId,
          panelId: materialized.sourcePanelId,
          readerSafeImagePath: materialized.readerSafeImagePath,
          readerSafeImageSha256: materialized.readerSafeImageSha256,
          outputWidth: materialized.outputWidth,
          outputHeight: materialized.outputHeight,
          intent: materialized.intent,
          originalCropBounds: materialized.originalCropBounds,
          expandedCropBounds: materialized.expandedCropBounds,
          reasons: materialized.reasons,
          warnings: materialized.warnings
        }
      })
    };

    const duplicateScenes = sceneByImageHash.get(materialized.readerSafeImageSha256) ?? [];
    if (duplicateScenes.length > 0) {
      warnings.push(`reader_safe_duplicate_image_hash:${materialized.readerSafeImageSha256.slice(0, 16)}:scene${manifest.sceneOrder}:${manifest.panelId}:matches:${duplicateScenes.map((entry) => `scene${entry.sceneOrder}:${entry.panelId}`).join("|")}`);
    }
    sceneByImageHash.set(materialized.readerSafeImageSha256, [
      ...duplicateScenes,
      { sceneOrder: manifest.sceneOrder, panelId: manifest.panelId }
    ]);

    assets.push({
      sceneOrder: manifest.sceneOrder,
      panelId: manifest.panelId,
      assetId,
      readerSafeImagePath: materialized.readerSafeImagePath,
      readerSafeImageSha256: materialized.readerSafeImageSha256,
      outputWidth: materialized.outputWidth,
      outputHeight: materialized.outputHeight,
      intent: materialized.intent,
      originalCropBounds: materialized.originalCropBounds,
      expandedCropBounds: materialized.expandedCropBounds,
      reasons: materialized.reasons,
      warnings: materialized.warnings
    });
  }

  if (assets.length === 0) warnings.push("no_reader_safe_assets_materialized");

  const report: ComicProjectReaderSafeMaterializationReport = {
    source: "comic-project-reader-safe-materializer",
    generatedAt: new Date().toISOString(),
    materializedAssetCount: assets.length,
    outputDirectory: input.outputDirectory,
    assets,
    warnings,
    candidateFirst: true,
    requiresManualApproval: true
  };

  return {
    source: "comic-project-reader-safe-materializer",
    generatedAt: report.generatedAt,
    payload: {
      ...input.payload,
      scenes,
      panelAssetManifest,
      renderBlueprintHints: {
        ...input.payload.renderBlueprintHints,
        readerSafePanelAssets: assets,
        readerSafeMaterializationReport: report
      },
      qualityChecklist: input.payload.qualityChecklist.map((item) =>
        item.id === "panel_assets_required"
          ? {
              ...item,
              label: "Paineis reader-safe materializados",
              status: assets.length === scenes.length ? "ready" : "needs_review",
              detail: `assets=${assets.length}/${scenes.length}; imagens verticais geradas localmente a partir da HQ autorizada.`
            }
          : item
      ),
      warnings: [
        ...new Set([
          ...input.payload.warnings,
          "reader_safe_panel_assets_materialized",
          ...warnings
        ])
      ]
    },
    report,
    candidateFirst: true,
    requiresManualApproval: true
  };
}

export async function writeComicProjectReaderSafeMaterializationReport(input: {
  report: ComicProjectReaderSafeMaterializationReport;
  outputPath: string;
}): Promise<void> {
  await mkdir(dirname(input.outputPath), { recursive: true });
  await writeFile(input.outputPath, `${JSON.stringify(input.report, null, 2)}\n`, "utf8");
}
