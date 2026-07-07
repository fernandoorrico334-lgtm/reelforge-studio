import { constants } from "node:fs";
import { access } from "node:fs/promises";
import type { RenderBlueprint, RenderBlueprintScene } from "./index.js";
import { resolveStoragePath } from "./render-paths.js";

export interface RenderAssetValidationIssue {
  sceneOrder: number;
  sceneTitle: string;
  assetRole: "base" | "microclip" | "narration" | "music";
  assetId: string | null;
  path: string | null;
  severity: "warning" | "error";
  message: string;
}

export interface RenderAssetValidationReport {
  checkedAssets: number;
  issues: RenderAssetValidationIssue[];
  readyForFfmpeg: boolean;
}

async function canReadFile(absolutePath: string) {
  try {
    await access(absolutePath, constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

async function validateAssetPath(input: {
  projectRoot: string;
  scene: RenderBlueprintScene;
  assetRole: RenderAssetValidationIssue["assetRole"];
  assetId?: string | null;
  assetPath?: string | null;
}): Promise<RenderAssetValidationIssue | null> {
  const path = input.assetPath?.trim() || null;

  if (!path) {
    return {
      sceneOrder: input.scene.order,
      sceneTitle: input.scene.title,
      assetRole: input.assetRole,
      assetId: input.assetId ?? null,
      path,
      severity: "warning",
      message: `${input.assetRole} asset has no path; render will use a fallback if needed.`
    };
  }

  let absolutePath: string;
  try {
    absolutePath = resolveStoragePath(input.projectRoot, path);
  } catch {
    return {
      sceneOrder: input.scene.order,
      sceneTitle: input.scene.title,
      assetRole: input.assetRole,
      assetId: input.assetId ?? null,
      path,
      severity: "error",
      message: `${input.assetRole} asset path escapes the project storage root.`
    };
  }

  if (!(await canReadFile(absolutePath))) {
    return {
      sceneOrder: input.scene.order,
      sceneTitle: input.scene.title,
      assetRole: input.assetRole,
      assetId: input.assetId ?? null,
      path,
      severity: "warning",
      message: `${input.assetRole} asset file is missing or unreadable; render will use a fallback if supported.`
    };
  }

  return null;
}

export async function validateRenderBlueprintAssets(input: {
  blueprint: RenderBlueprint;
  projectRoot: string;
}): Promise<RenderAssetValidationReport> {
  const issues: RenderAssetValidationIssue[] = [];
  let checkedAssets = 0;

  for (const scene of input.blueprint.scenes) {
    const baseAsset = scene.effectiveAsset ?? scene.asset;
    if (baseAsset) {
      checkedAssets += 1;
      const issue = await validateAssetPath({
        projectRoot: input.projectRoot,
        scene,
        assetRole: "base",
        assetId: baseAsset.id,
        assetPath: baseAsset.path
      });
      if (issue) {
        issues.push(issue);
      }
    }

    if (scene.effectiveNarrationAssetPath) {
      checkedAssets += 1;
      const issue = await validateAssetPath({
        projectRoot: input.projectRoot,
        scene,
        assetRole: "narration",
        assetId: scene.effectiveNarrationAssetId,
        assetPath: scene.effectiveNarrationAssetPath
      });
      if (issue) {
        issues.push(issue);
      }
    }

    for (const microclip of scene.editorialMicroclips) {
      checkedAssets += 1;
      const issue = await validateAssetPath({
        projectRoot: input.projectRoot,
        scene,
        assetRole: "microclip",
        assetId: microclip.assetId,
        assetPath: microclip.assetPath
      });
      if (issue) {
        issues.push(issue);
      }
    }
  }

  if (input.blueprint.selectedMusicAssetPath) {
    const firstScene = input.blueprint.scenes[0];
    if (firstScene) {
      checkedAssets += 1;
      const issue = await validateAssetPath({
        projectRoot: input.projectRoot,
        scene: firstScene,
        assetRole: "music",
        assetId: input.blueprint.selectedMusicAssetId,
        assetPath: input.blueprint.selectedMusicAssetPath
      });
      if (issue) {
        issues.push(issue);
      }
    }
  }

  return {
    checkedAssets,
    issues,
    readyForFfmpeg: issues.every((issue) => issue.severity !== "error")
  };
}
