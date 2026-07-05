import { spawn } from "node:child_process";
import { stat } from "node:fs/promises";
import { resolve } from "node:path";
import {
  analyzeVideoForMicroclips,
  type MicroclipCandidate
} from "../../../../../../packages/microclip-selector-engine/src/index.js";
import { getFfprobeCommand } from "@reelforge/video-engine/render-server";
import { projectRoot } from "../../../config/paths.js";
import { NotFoundError, ValidationError } from "../../../shared/errors.js";
import type { AssetRepository } from "../../assets/application/asset-repository.js";
import type { StudioAsset } from "../../assets/domain/asset.js";
import { createEditorialMicroclip } from "../../editorial-microclips/application/editorial-microclip-service.js";
import type { EditorialMicroclipRepository } from "../../editorial-microclips/application/editorial-microclip-repository.js";
import type {
  EditorialMicroclip,
  EditorialMicroclipUsageMode
} from "../../editorial-microclips/domain/editorial-microclip.js";
import type { ProjectRepository } from "../../projects/application/project-repository.js";

export interface MicroclipSelectorAnalyzeInput {
  assetId: string;
  targetDurationSeconds: number;
  topN: number;
  useCase: string;
  preset: string;
}

export interface MicroclipSelectorApplyInput {
  projectId: string;
  sceneId: string | null;
  assetId: string;
  candidateId: string;
  label: string | null;
  usageMode: EditorialMicroclipUsageMode | null;
}

export interface MicroclipSelectorAnalyzeResult {
  assetId: string;
  durationSeconds: number;
  targetDurationSeconds: number;
  candidates: MicroclipCandidate[];
  warnings: string[];
}

export interface MicroclipSelectorApplyResult {
  microclip: EditorialMicroclip;
  candidate: MicroclipCandidate;
  warnings: string[];
}

function runCommand(command: string, args: string[]) {
  return new Promise<{ stdout: string; stderr: string }>((resolvePromise, reject) => {
    const child = spawn(command, args, {
      cwd: projectRoot,
      shell: false,
      windowsHide: true
    });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolvePromise({ stdout, stderr });
        return;
      }

      reject(
        new Error(
          `ffprobe exited with code ${code ?? "unknown"}: ${stderr.trim()}`
        )
      );
    });
  });
}

function resolveAssetPath(asset: StudioAsset) {
  const absolutePath = resolve(projectRoot, asset.path);

  if (!absolutePath.startsWith(projectRoot)) {
    throw new ValidationError(`Asset '${asset.id}' path is outside project storage.`);
  }

  return absolutePath;
}

async function ensureVideoAsset(repository: AssetRepository, assetId: string) {
  const asset = await repository.getById(assetId);

  if (!asset) {
    throw new NotFoundError(`Asset '${assetId}' was not found.`);
  }

  if (asset.type !== "VIDEO") {
    throw new ValidationError(
      `Asset '${assetId}' must be VIDEO for microclip selection.`
    );
  }

  return asset;
}

async function probeVideoDuration(asset: StudioAsset) {
  const absolutePath = resolveAssetPath(asset);
  await stat(absolutePath);
  const { stdout } = await runCommand(getFfprobeCommand(), [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "default=noprint_wrappers=1:nokey=1",
    absolutePath
  ]);
  const duration = Number(stdout.trim());

  return Number.isFinite(duration) && duration > 0 ? duration : asset.duration;
}

export async function analyzeAssetForMicroclips(
  assetRepository: AssetRepository,
  input: MicroclipSelectorAnalyzeInput
): Promise<MicroclipSelectorAnalyzeResult> {
  const asset = await ensureVideoAsset(assetRepository, input.assetId);
  const warnings: string[] = [];
  let durationSeconds = asset.duration ?? 0;

  try {
    durationSeconds = (await probeVideoDuration(asset)) ?? durationSeconds;
  } catch (error) {
    warnings.push(
      error instanceof Error
        ? `ffprobe unavailable: ${error.message}`
        : "ffprobe unavailable; using stored duration if available."
    );
  }

  const result = analyzeVideoForMicroclips({
    assetId: asset.id,
    durationSeconds,
    targetDurationSeconds: input.targetDurationSeconds,
    topN: input.topN,
    useCase: input.useCase,
    preset: input.preset
  });

  return {
    ...result,
    warnings: [...warnings, ...result.warnings]
  };
}

export async function applyMicroclipCandidate(
  dependencies: {
    assetRepository: AssetRepository;
    editorialMicroclipRepository: EditorialMicroclipRepository;
    projectRepository: ProjectRepository;
  },
  input: MicroclipSelectorApplyInput
): Promise<MicroclipSelectorApplyResult> {
  const analysis = await analyzeAssetForMicroclips(dependencies.assetRepository, {
    assetId: input.assetId,
    targetDurationSeconds: 1.5,
    topN: 10,
    useCase: "football",
    preset: "football_hype"
  });
  const candidate = analysis.candidates.find((item) => item.id === input.candidateId);

  if (!candidate) {
    throw new NotFoundError(
      `Microclip candidate '${input.candidateId}' was not found for asset '${input.assetId}'.`
    );
  }

  const microclip = await createEditorialMicroclip(
    dependencies.editorialMicroclipRepository,
    dependencies.projectRepository,
    dependencies.assetRepository,
    {
      projectId: input.projectId,
      sceneId: input.sceneId,
      assetId: input.assetId,
      label: input.label ?? candidate.recommendedTextOverlay ?? "microclip sugerido",
      sourceType: "library_clip",
      startTimeSeconds: candidate.startTimeSeconds,
      endTimeSeconds: candidate.endTimeSeconds,
      durationSeconds: candidate.durationSeconds,
      usageMode: input.usageMode ?? candidate.usageMode,
      narrationOverlay: true,
      textOverlay: candidate.recommendedTextOverlay,
      calloutStyle: candidate.usageMode === "impact_moment" ? "bold" : "minimal",
      transitionIn: candidate.recommendedTransitionIn,
      transitionOut: candidate.recommendedTransitionOut,
      volumeMode: candidate.recommendedVolumeMode,
      orderIndex: 1,
      metadata: {
        source: "automatic-microclip-selector",
        candidateId: candidate.id,
        score: candidate.score,
        reasons: candidate.reasons
      }
    }
  );

  return {
    microclip,
    candidate,
    warnings: analysis.warnings
  };
}
