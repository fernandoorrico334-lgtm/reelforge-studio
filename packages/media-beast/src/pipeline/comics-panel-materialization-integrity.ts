import { createHash } from "node:crypto";
import { access, constants, mkdir, readFile, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { basename, dirname, join, resolve } from "node:path";
import { extractPageIndex } from "./comics-user-provided-panel-gate.js";
import {
  renderPanelBeatCropContactSheet,
  type IntelligentIndexedBeatPanelRef,
  type PanelCropBounds,
  type PanelCropDescriptor,
  type UserProvidedAssetRecord,
  type UserProvidedBeatAssignment
} from "./comics-user-provided-assets.js";
import type { MaterializedTimelineScene } from "./remix-materialization.js";

export const PANEL_MATERIALIZATION_MANIFEST_FILENAME = "variation-b-panel-materialization-manifest.json";
export const MATERIALIZED_PANEL_CONTACT_SHEET_FILENAME = "variation-b-materialized-panel-contact-sheet.jpg";
export const SELECTED_PANEL_RENDER_PATH_MISMATCH = "selected_panel_render_path_mismatch";

export type PanelMaterializationManifestEntry = {
  sceneId: string;
  beatId: string;
  panelId: string;
  pageNumber: number;
  sourcePagePath: string;
  sourcePageSha256: string;
  panelImagePath: string;
  panelImageSha256: string;
  cropBounds: PanelCropBounds;
  verificationHash: string;
};

export type SelectedPanelMaterializationRef = {
  panelId: string;
  panelImagePath: string;
  panelImageSha256: string;
  cropBounds: PanelCropBounds;
  sourcePagePath?: string;
};

export type PanelMaterializationVerificationResult = {
  ok: boolean;
  blockReason: string | null;
  mismatches: string[];
};

export type PanelMaterializationIntegrityReport = {
  verifiedSceneCount: number;
  failedSceneCount: number;
  canRender: boolean;
  blockReason: string | null;
  mismatches: Array<{ sceneId: string; beatId: string; mismatches: string[] }>;
  sceneHashes: Array<{ sceneId: string; beatId: string; panelImageSha256: string; verificationHash: string }>;
};

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK | constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

async function sha256File(path: string): Promise<string> {
  const bytes = await readFile(path);
  return createHash("sha256").update(bytes).digest("hex");
}

function runCommand(command: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { shell: false });
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
      if (code === 0) resolvePromise({ stdout, stderr });
      else reject(new Error(`${command} exited ${code}: ${stderr.slice(-500)}`));
    });
  });
}

async function probeImageDimensions(
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

function cropBoundsEqual(left: PanelCropBounds, right: PanelCropBounds): boolean {
  return (
    left.x === right.x &&
    left.y === right.y &&
    left.width === right.width &&
    left.height === right.height
  );
}

export function buildVerificationHash(
  entry: Omit<PanelMaterializationManifestEntry, "verificationHash">
): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        sceneId: entry.sceneId,
        beatId: entry.beatId,
        panelId: entry.panelId,
        pageNumber: entry.pageNumber,
        sourcePagePath: entry.sourcePagePath,
        sourcePageSha256: entry.sourcePageSha256,
        panelImagePath: entry.panelImagePath,
        panelImageSha256: entry.panelImageSha256,
        cropBounds: entry.cropBounds
      })
    )
    .digest("hex");
}

export async function buildPanelMaterializationManifestEntry(input: {
  scene: MaterializedTimelineScene;
  asset: UserProvidedAssetRecord;
  descriptor: PanelCropDescriptor;
  sourcePageSha256: string;
  panelImageSha256: string;
}): Promise<PanelMaterializationManifestEntry> {
  const base = {
    sceneId: input.scene.sceneId,
    beatId: input.scene.sceneRole ?? "unknown",
    panelId: input.descriptor.panelId,
    pageNumber: extractPageIndex(input.asset.title) ?? 0,
    sourcePagePath: input.descriptor.sourceAssetPath,
    sourcePageSha256: input.sourcePageSha256,
    panelImagePath: input.descriptor.panelImagePath,
    panelImageSha256: input.panelImageSha256,
    cropBounds: input.descriptor.cropBounds
  };
  return {
    ...base,
    verificationHash: buildVerificationHash(base)
  };
}

export async function buildPanelMaterializationManifest(input: {
  timelineScenes: MaterializedTimelineScene[];
  assets: UserProvidedAssetRecord[];
  cropDescriptors: Map<string, PanelCropDescriptor>;
}): Promise<PanelMaterializationManifestEntry[]> {
  const assetById = new Map(input.assets.map((asset) => [asset.id, asset]));
  const entries: PanelMaterializationManifestEntry[] = [];

  for (const scene of input.timelineScenes) {
    if (!scene.assetId || !scene.assetPath) continue;
    const asset = assetById.get(scene.assetId);
    const descriptor = input.cropDescriptors.get(scene.assetId);
    if (!asset || !descriptor) continue;

    const [sourcePageSha256, panelImageSha256] = await Promise.all([
      sha256File(descriptor.sourceAssetPath),
      sha256File(descriptor.panelImagePath)
    ]);

    entries.push(
      await buildPanelMaterializationManifestEntry({
        scene,
        asset,
        descriptor,
        sourcePageSha256,
        panelImageSha256
      })
    );
  }

  return entries;
}

export function verifyApprovedPanelMatchesManifest(input: {
  approvedPanel: Pick<
    UserProvidedBeatAssignment,
    "panelId" | "panelImagePath" | "cropBounds" | "cropContentHash"
  >;
  manifestEntry: PanelMaterializationManifestEntry;
}): PanelMaterializationVerificationResult {
  const mismatches: string[] = [];

  if (!input.approvedPanel.panelImagePath) {
    mismatches.push("panel_image_path_missing");
  }
  if (!input.approvedPanel.panelId) {
    mismatches.push("panel_id_missing");
  }
  if (!input.approvedPanel.cropBounds) {
    mismatches.push("crop_bounds_missing");
  }
  if (
    input.approvedPanel.panelId &&
    input.manifestEntry.panelId &&
    input.approvedPanel.panelId !== input.manifestEntry.panelId
  ) {
    mismatches.push(
      `panel_id_mismatch:${input.approvedPanel.panelId}!=${input.manifestEntry.panelId}`
    );
  }
  if (
    input.approvedPanel.panelImagePath &&
    input.approvedPanel.panelImagePath !== input.manifestEntry.panelImagePath
  ) {
    mismatches.push(
      `panel_path_mismatch:${input.approvedPanel.panelImagePath}!=${input.manifestEntry.panelImagePath}`
    );
  }
  if (
    input.approvedPanel.cropBounds &&
    !cropBoundsEqual(input.approvedPanel.cropBounds, input.manifestEntry.cropBounds)
  ) {
    mismatches.push("crop_bounds_mismatch");
  }

  return {
    ok: mismatches.length === 0,
    blockReason: mismatches.length > 0 ? SELECTED_PANEL_RENDER_PATH_MISMATCH : null,
    mismatches
  };
}

export async function verifySelectedPanelMaterialization(input: {
  selectedPanel: SelectedPanelMaterializationRef;
  timelineScene: Pick<MaterializedTimelineScene, "sceneId" | "assetPath" | "sceneRole">;
  ffprobeCommand?: string;
}): Promise<PanelMaterializationVerificationResult> {
  const mismatches: string[] = [];
  const { selectedPanel, timelineScene } = input;

  if (!selectedPanel.panelId?.trim()) {
    mismatches.push("panel_id_missing");
  }
  if (!selectedPanel.panelImagePath?.trim()) {
    mismatches.push("panel_image_path_missing");
  }
  if (!selectedPanel.cropBounds) {
    mismatches.push("crop_bounds_missing");
  }

  const renderPath = timelineScene.assetPath;
  if (!renderPath) {
    mismatches.push("timeline_asset_path_missing");
  } else if (!selectedPanel.panelImagePath) {
    mismatches.push("panel_image_path_missing");
  } else if (renderPath !== selectedPanel.panelImagePath) {
    mismatches.push(`render_path_mismatch:${renderPath}!=${selectedPanel.panelImagePath}`);
  }

  if (
    selectedPanel.sourcePagePath &&
    renderPath &&
    renderPath === selectedPanel.sourcePagePath
  ) {
    mismatches.push("full_page_rendered_instead_of_crop");
  }

  if (selectedPanel.panelImagePath) {
    if (!(await fileExists(selectedPanel.panelImagePath))) {
      mismatches.push("panel_image_file_missing");
    } else {
      let actualSha256: string | null = null;
      try {
        actualSha256 = await sha256File(selectedPanel.panelImagePath);
      } catch {
        mismatches.push("panel_image_file_unreadable");
      }

      if (actualSha256 && actualSha256 !== selectedPanel.panelImageSha256) {
        mismatches.push(`panel_image_sha256_mismatch:${actualSha256}!=${selectedPanel.panelImageSha256}`);
      }

      const dimensions = await probeImageDimensions(
        selectedPanel.panelImagePath,
        input.ffprobeCommand ?? "ffprobe"
      );
      if (!dimensions) {
        mismatches.push("panel_image_probe_failed");
      } else if (selectedPanel.cropBounds) {
        const widthDelta = Math.abs(dimensions.width - selectedPanel.cropBounds.width);
        const heightDelta = Math.abs(dimensions.height - selectedPanel.cropBounds.height);
        if (widthDelta > 1 || heightDelta > 1) {
          mismatches.push(
            `panel_resolution_mismatch:${dimensions.width}x${dimensions.height}!=${selectedPanel.cropBounds.width}x${selectedPanel.cropBounds.height}`
          );
        }
      }
    }
  }

  return {
    ok: mismatches.length === 0,
    blockReason: mismatches.length > 0 ? SELECTED_PANEL_RENDER_PATH_MISMATCH : null,
    mismatches
  };
}

export function patchTimelineScenesWithMaterializedPanelPaths(input: {
  timelineScenes: MaterializedTimelineScene[];
  cropDescriptors: Map<string, PanelCropDescriptor>;
}): MaterializedTimelineScene[] {
  return input.timelineScenes.map((scene) => {
    if (!scene.assetId) return scene;
    const descriptor = input.cropDescriptors.get(scene.assetId);
    if (!descriptor) return scene;
    if (scene.assetPath && scene.assetPath !== descriptor.sourceAssetPath) {
      return scene;
    }
    return {
      ...scene,
      assetPath: descriptor.panelImagePath
    };
  });
}

export async function verifyTimelinePanelMaterializationIntegrity(input: {
  manifest: PanelMaterializationManifestEntry[];
  timelineScenes: MaterializedTimelineScene[];
  ffprobeCommand?: string;
}): Promise<PanelMaterializationIntegrityReport> {
  const manifestByScene = new Map(input.manifest.map((entry) => [entry.sceneId, entry]));
  const mismatches: PanelMaterializationIntegrityReport["mismatches"] = [];

  for (const scene of input.timelineScenes) {
    const manifestEntry = manifestByScene.get(scene.sceneId);
    if (!manifestEntry) {
      mismatches.push({
        sceneId: scene.sceneId,
        beatId: scene.sceneRole ?? "unknown",
        mismatches: ["manifest_entry_missing"]
      });
      continue;
    }

    const sceneMismatches: string[] = [];
    const renderCheck = await verifySelectedPanelMaterialization({
      selectedPanel: {
        panelId: manifestEntry.panelId,
        panelImagePath: manifestEntry.panelImagePath,
        panelImageSha256: manifestEntry.panelImageSha256,
        cropBounds: manifestEntry.cropBounds,
        sourcePagePath: manifestEntry.sourcePagePath
      },
      timelineScene: scene,
      ...(input.ffprobeCommand ? { ffprobeCommand: input.ffprobeCommand } : {})
    });
    sceneMismatches.push(...renderCheck.mismatches);

    if (sceneMismatches.length > 0) {
      mismatches.push({
        sceneId: scene.sceneId,
        beatId: manifestEntry.beatId,
        mismatches: sceneMismatches
      });
    }
  }

  const verifiedSceneCount = input.timelineScenes.length - mismatches.length;
  const failedSceneCount = mismatches.length;

  return {
    verifiedSceneCount,
    failedSceneCount,
    canRender: failedSceneCount === 0 && input.timelineScenes.length > 0,
    blockReason: failedSceneCount > 0 ? SELECTED_PANEL_RENDER_PATH_MISMATCH : null,
    mismatches,
    sceneHashes: input.manifest.map((entry) => ({
      sceneId: entry.sceneId,
      beatId: entry.beatId,
      panelImageSha256: entry.panelImageSha256,
      verificationHash: entry.verificationHash
    }))
  };
}

export async function renderMaterializedPanelContactSheet(input: {
  manifest: PanelMaterializationManifestEntry[];
  outputPath: string;
  ffmpegCommand?: string;
}): Promise<string | null> {
  return renderPanelBeatCropContactSheet({
    entries: input.manifest.map((entry) => ({
      beatRole: entry.beatId,
      panelId: entry.panelId,
      page: entry.pageNumber,
      score: 0,
      localVisualEvidence: [],
      panelImagePath: entry.panelImagePath
    })),
    outputPath: input.outputPath,
    ...(input.ffmpegCommand ? { ffmpegCommand: input.ffmpegCommand } : {})
  });
}

export async function savePanelMaterializationManifest(
  manifest: PanelMaterializationManifestEntry[],
  projectRoot?: string
): Promise<string> {
  const root = resolve(projectRoot ?? process.cwd());
  const reportPath = join(root, "tmp", PANEL_MATERIALIZATION_MANIFEST_FILENAME);
  await mkdir(dirname(reportPath), { recursive: true });
  await writeFile(reportPath, JSON.stringify(manifest, null, 2), "utf8");
  return reportPath;
}

export function materializedPanelContactSheetPath(projectRoot?: string): string {
  return join(resolve(projectRoot ?? process.cwd()), "tmp", MATERIALIZED_PANEL_CONTACT_SHEET_FILENAME);
}

export async function verifyIntelligentIndexedRenderMaterialization(input: {
  beats: IntelligentIndexedBeatPanelRef[];
  timelineScenes: MaterializedTimelineScene[];
  ffprobeCommand?: string;
}): Promise<PanelMaterializationIntegrityReport> {
  const sceneByRole = new Map(
    input.timelineScenes.map((scene) => [scene.sceneRole ?? "", scene])
  );
  const mismatches: PanelMaterializationIntegrityReport["mismatches"] = [];

  for (const beat of input.beats) {
    const scene = sceneByRole.get(beat.beatRole);
    if (!scene) {
      mismatches.push({
        sceneId: `beat-${beat.beatRole}`,
        beatId: beat.beatRole,
        mismatches: ["timeline_scene_missing"]
      });
      continue;
    }

    const renderCheck = await verifySelectedPanelMaterialization({
      selectedPanel: {
        panelId: beat.panelId,
        panelImagePath: beat.panelImagePath,
        panelImageSha256: beat.panelImageSha256,
        cropBounds: beat.cropBounds
      },
      timelineScene: scene,
      ...(input.ffprobeCommand ? { ffprobeCommand: input.ffprobeCommand } : {})
    });

    if (!renderCheck.ok) {
      mismatches.push({
        sceneId: scene.sceneId,
        beatId: beat.beatRole,
        mismatches: renderCheck.mismatches
      });
    }
  }

  const failedSceneCount = mismatches.length;
  const verifiedSceneCount = input.beats.length - failedSceneCount;

  return {
    verifiedSceneCount,
    failedSceneCount,
    canRender: failedSceneCount === 0 && input.beats.length > 0,
    blockReason: failedSceneCount > 0 ? SELECTED_PANEL_RENDER_PATH_MISMATCH : null,
    mismatches,
    sceneHashes: input.beats.map((beat) => {
      const scene = sceneByRole.get(beat.beatRole);
      return {
        sceneId: scene?.sceneId ?? `beat-${beat.beatRole}`,
        beatId: beat.beatRole,
        panelImageSha256: beat.panelImageSha256,
        verificationHash: buildVerificationHash({
          sceneId: scene?.sceneId ?? `beat-${beat.beatRole}`,
          beatId: beat.beatRole,
          panelId: beat.panelId,
          pageNumber: 0,
          sourcePagePath: "",
          sourcePageSha256: "",
          panelImagePath: beat.panelImagePath,
          panelImageSha256: beat.panelImageSha256,
          cropBounds: beat.cropBounds
        })
      };
    })
  };
}