import type {
  ProjectScene,
  StudioAsset,
  VisualSourceMode
} from "./studio-types";

type SceneEffectiveSource = "base" | "generated" | "fallback" | "missing";

type EffectiveSceneLike = Pick<
  ProjectScene,
  "assetId" | "generatedAssetId" | "visualSourceMode"
> & {
  asset?: Pick<StudioAsset, "id" | "filename"> | null;
  generatedAsset?: Pick<StudioAsset, "id" | "filename"> | null;
  effectiveAssetId?: string | null;
};

function normalizeVisualSourceMode(
  value: VisualSourceMode | null | undefined
): VisualSourceMode | null {
  switch (value) {
    case "asset_only":
    case "generated_only":
    case "hybrid_overlay":
    case "fallback_generated":
    case "mixed_sequence":
      return value;
    default:
      return null;
  }
}

function resolveSceneEffectiveState(scene: EffectiveSceneLike) {
  const mode = normalizeVisualSourceMode(scene.visualSourceMode);
  const assetId = scene.assetId ?? null;
  const generatedAssetId = scene.generatedAssetId ?? null;
  const resolvedEffectiveAssetId = scene.effectiveAssetId ?? null;

  switch (mode) {
    case "asset_only":
      return {
        assetId: assetId ?? resolvedEffectiveAssetId,
        source:
          assetId ?? resolvedEffectiveAssetId
            ? ("base" as const)
            : ("missing" as const)
      };
    case "generated_only":
      return {
        assetId: generatedAssetId ?? resolvedEffectiveAssetId,
        source: generatedAssetId ?? resolvedEffectiveAssetId
          ? ("generated" as const)
          : ("missing" as const)
      };
    case "fallback_generated":
      return {
        assetId: assetId ?? generatedAssetId ?? resolvedEffectiveAssetId,
        source:
          assetId ?? generatedAssetId ?? resolvedEffectiveAssetId
            ? ("fallback" as const)
            : ("missing" as const)
      };
    case "mixed_sequence":
      return {
        assetId: generatedAssetId ?? resolvedEffectiveAssetId ?? assetId,
        source:
          generatedAssetId ?? resolvedEffectiveAssetId
            ? ("generated" as const)
            : assetId
              ? ("base" as const)
              : ("missing" as const)
      };
    case "hybrid_overlay":
      return {
        assetId: assetId ?? generatedAssetId ?? resolvedEffectiveAssetId,
        source:
          assetId ? ("base" as const) : generatedAssetId || resolvedEffectiveAssetId
            ? ("generated" as const)
            : ("missing" as const)
      };
    default:
      if (generatedAssetId) {
        return {
          assetId: generatedAssetId,
          source: "generated" as const
        };
      }

      if (assetId) {
        return {
          assetId,
          source: "base" as const
        };
      }

      return {
        assetId: resolvedEffectiveAssetId,
        source: resolvedEffectiveAssetId
          ? ("generated" as const)
          : ("missing" as const)
      };
  }
}

function resolveSceneEffectiveAssetRecord(scene: EffectiveSceneLike) {
  const source = getSceneEffectiveAssetSource(scene);

  if (source === "generated") {
    return scene.generatedAsset ?? null;
  }

  if (source === "base") {
    return scene.asset ?? null;
  }

  if (source === "fallback") {
    return scene.asset ?? scene.generatedAsset ?? null;
  }

  return null;
}

export function getSceneEffectiveAssetId(scene: EffectiveSceneLike) {
  return resolveSceneEffectiveState(scene).assetId ?? null;
}

export function sceneHasEffectiveAsset(scene: EffectiveSceneLike) {
  return Boolean(getSceneEffectiveAssetId(scene));
}

export function getSceneEffectiveAssetSource(
  scene: EffectiveSceneLike
): SceneEffectiveSource {
  return resolveSceneEffectiveState(scene).source;
}

export function isGeneratedAssetActive(scene: EffectiveSceneLike) {
  const effectiveAssetId = getSceneEffectiveAssetId(scene);
  return Boolean(
    effectiveAssetId &&
      scene.generatedAssetId &&
      effectiveAssetId === scene.generatedAssetId
  );
}

export function isBaseAssetActive(scene: EffectiveSceneLike) {
  const effectiveAssetId = getSceneEffectiveAssetId(scene);
  return Boolean(
    effectiveAssetId && scene.assetId && effectiveAssetId === scene.assetId
  );
}

export function getSceneEffectiveAssetLabel(scene: EffectiveSceneLike) {
  const effectiveAsset = resolveSceneEffectiveAssetRecord(scene);

  if (effectiveAsset?.filename?.trim()) {
    return effectiveAsset.filename.trim();
  }

  const effectiveAssetId = getSceneEffectiveAssetId(scene);

  if (effectiveAssetId) {
    return effectiveAssetId;
  }

  return "Sem visual efetivo";
}
