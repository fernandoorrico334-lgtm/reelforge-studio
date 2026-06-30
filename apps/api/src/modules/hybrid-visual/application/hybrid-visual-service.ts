import {
  buildMissingVisualReport,
  buildVisualRecipe,
  createGeneratedAssetMetadata,
  createMockGeneratedVisualSvg,
  getVisualSourceModes,
  suggestVisualSourceMode,
  summarizeVisualGenerationJob,
  validateComfyWorkflowTemplate,
  type HybridAssetInput,
  type HybridChannelInput,
  type HybridCharacterProfile,
  type HybridProjectInput,
  type HybridSceneInput,
  type VisualRecipe
} from "@reelforge/hybrid-visual-engine";
import {
  buildVisualPrompt,
  getNegativePromptPackById,
  getNegativePromptPacks,
  getVisualPromptPackById,
  getVisualPromptPacks,
  promptVariantTypes,
  type PromptBuildInput,
  type PromptBuildResult,
  type PromptVariantType
} from "@reelforge/prompt-engine";
import { mkdir, writeFile } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import type { AppEnv } from "../../../config/env.js";
import { assetsStorageRoot, projectRoot } from "../../../config/paths.js";
import { NotFoundError, ValidationError } from "../../../shared/errors.js";
import type { AssetRepository } from "../../assets/application/asset-repository.js";
import type { CharacterRepository } from "../../characters/application/character-repository.js";
import type { CharacterProfile } from "../../characters/domain/character.js";
import type { ProjectRepository } from "../../projects/application/project-repository.js";
import type { ProjectScene, StudioProject } from "../../projects/domain/project.js";
import type { ResearchRepository } from "../../research/application/research-repository.js";
import type {
  ResearchAssetRequirement,
  ResearchDossierDetail
} from "../../research/domain/research.js";
import type { VisualGenerationJobRepository } from "./visual-generation-job-repository.js";
import type {
  GenerateMissingVisualsInput,
  GenerateVisualRequestInput,
  VisualGenerationJob,
  VisualGenerationJobFilters
} from "../domain/visual-generation.js";
import { writeMockGeneratedVisualPng } from "../infrastructure/mock-visual-rasterizer.js";
import {
  getComfyUiProviderStatus,
  listVisualGenerationProviders as listRegisteredVisualGenerationProviders
} from "../infrastructure/visual-generation-provider-registry.js";

type HybridVisualEnv = Pick<
  AppEnv,
  | "comfyUiBaseUrl"
  | "comfyUiDefaultWorkflow"
  | "comfyUiEnabled"
  | "comfyUiWorkflowDir"
  | "comfyUiTimeoutMs"
>;

interface PromptBuildRequestInput {
  sceneId?: string | null;
  researchAssetRequirementId?: string | null;
  characterProfileId?: string | null;
  promptPackId?: string | null;
  negativePackId?: string | null;
  variantType?: string | null;
}

interface NormalizedPromptBuildRequestInput {
  characterProfileId?: string | null;
  promptPackId?: string | null;
  negativePackId?: string | null;
  variantType?: PromptVariantType | null;
}

interface StoredPromptMetadata {
  promptPackId: string | null;
  negativePackId: string | null;
  variantType: PromptVariantType | null;
}

interface GeneratedVisualArtifactPaths {
  outputAbsolutePath: string;
  outputPath: string;
  debugSvgAbsolutePath: string;
  debugSvgPath: string;
}

type PromptReadyProject = HybridProjectInput & {
  templateId?: string | null;
};

type PromptReadyChannel = HybridChannelInput & {
  defaultTemplate?: string | null;
};

function buildJobNotFoundError(jobId: string) {
  return new NotFoundError(`Visual generation job '${jobId}' was not found.`);
}

function buildSceneNotFoundError(sceneId: string) {
  return new NotFoundError(`Scene '${sceneId}' was not found.`);
}

function buildRequirementNotFoundError(requirementId: string) {
  return new NotFoundError(
    `Research asset requirement '${requirementId}' was not found.`
  );
}

function resolveHybridVisualEnv(
  input: Partial<HybridVisualEnv> = {}
): HybridVisualEnv {
  const comfyUiEnabled =
    typeof input.comfyUiEnabled === "boolean"
      ? input.comfyUiEnabled
      : String(process.env.COMFYUI_ENABLED ?? "false").trim().toLowerCase() === "true";
  const comfyUiBaseUrl =
    input.comfyUiBaseUrl ??
    (process.env.COMFYUI_BASE_URL ?? "http://127.0.0.1:8188").trim();
  const comfyUiDefaultWorkflow =
    input.comfyUiDefaultWorkflow ??
    ((process.env.COMFYUI_DEFAULT_WORKFLOW ?? "txt2img-basic").trim() ||
      "txt2img-basic");
  const comfyUiWorkflowDir =
    input.comfyUiWorkflowDir ??
    ((process.env.COMFYUI_WORKFLOW_DIR ?? "storage/comfyui/workflows").trim() ||
      "storage/comfyui/workflows");
  const comfyUiTimeoutMs =
    input.comfyUiTimeoutMs ?? Number(process.env.COMFYUI_TIMEOUT_MS ?? 300_000);

  return {
    comfyUiBaseUrl,
    comfyUiDefaultWorkflow,
    comfyUiEnabled,
    comfyUiWorkflowDir,
    comfyUiTimeoutMs:
      Number.isFinite(comfyUiTimeoutMs) && comfyUiTimeoutMs > 0
        ? comfyUiTimeoutMs
        : 300_000
  };
}

function resolveWorkspacePath(pathValue: string) {
  return isAbsolute(pathValue) ? pathValue : join(projectRoot, pathValue);
}

function resolveComfyWorkflowOptions(
  appEnv: Pick<HybridVisualEnv, "comfyUiWorkflowDir">
) {
  if (!appEnv.comfyUiWorkflowDir.trim()) {
    return {};
  }

  return {
    workflowDirectory: resolveWorkspacePath(appEnv.comfyUiWorkflowDir)
  };
}

function createDeterministicSeed(seed: number | null, key: string) {
  if (typeof seed === "number") {
    return seed;
  }

  let acc = 17;

  for (const char of key) {
    acc = (acc * 31 + char.charCodeAt(0)) % 999_983;
  }

  return acc;
}

function tryParseJsonRecord(value: string | null | undefined) {
  if (!value?.trim()) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as unknown;

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }

    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

function isPromptVariantType(value: unknown): value is PromptVariantType {
  return typeof value === "string" && promptVariantTypes.includes(value as PromptVariantType);
}

function deriveVariantTypeFromPromptVariantId(value: string | null | undefined) {
  if (!value?.trim()) {
    return null;
  }

  const candidate = value.split(":").at(-1) ?? null;
  return isPromptVariantType(candidate) ? candidate : null;
}

function readStoredPromptMetadata(value: string | null | undefined): StoredPromptMetadata {
  const parsed = tryParseJsonRecord(value);
  const promptPackId =
    typeof parsed?.promptPackId === "string" && parsed.promptPackId.trim()
      ? parsed.promptPackId.trim()
      : null;
  const negativePackId =
    typeof parsed?.negativePackId === "string" && parsed.negativePackId.trim()
      ? parsed.negativePackId.trim()
      : null;
  const promptVariantType =
    isPromptVariantType(parsed?.promptVariantType) ? parsed.promptVariantType : null;
  const promptVariantId =
    typeof parsed?.promptVariantId === "string" && parsed.promptVariantId.trim()
      ? parsed.promptVariantId.trim()
      : null;

  return {
    promptPackId,
    negativePackId,
    variantType: promptVariantType ?? deriveVariantTypeFromPromptVariantId(promptVariantId)
  };
}

function normalizePromptBuildRequestInput(
  input: PromptBuildRequestInput = {}
): NormalizedPromptBuildRequestInput {
  const normalized: NormalizedPromptBuildRequestInput = {};

  if (input.characterProfileId !== undefined) {
    normalized.characterProfileId = input.characterProfileId;
  }

  if (input.promptPackId !== undefined) {
    if (input.promptPackId && !getVisualPromptPackById(input.promptPackId)) {
      throw new ValidationError(`Prompt pack '${input.promptPackId}' was not found.`);
    }

    normalized.promptPackId = input.promptPackId;
  }

  if (input.negativePackId !== undefined) {
    if (input.negativePackId && !getNegativePromptPackById(input.negativePackId)) {
      throw new ValidationError(
        `Negative prompt pack '${input.negativePackId}' was not found.`
      );
    }

    normalized.negativePackId = input.negativePackId;
  }

  if (input.variantType !== undefined) {
    if (input.variantType === null || input.variantType === "") {
      normalized.variantType = null;
    } else if (!isPromptVariantType(input.variantType)) {
      throw new ValidationError(
        `Variant '${input.variantType}' is invalid. Supported variants: ${promptVariantTypes.join(", ")}.`
      );
    } else {
      normalized.variantType = input.variantType;
    }
  }

  return normalized;
}

function mapAsset(asset: ProjectScene["asset"] | ResearchAssetRequirement["fulfilledAsset"]): HybridAssetInput | null {
  if (!asset) {
    return null;
  }

  return {
    id: asset.id,
    filename: asset.filename,
    type: asset.type,
    category: asset.category,
    franchise: asset.franchise,
    character: asset.character,
    emotion: asset.emotion,
    tags: [...asset.tags],
    sourceProvider: asset.sourceProvider,
    recommendedUse: asset.recommendedUse
  };
}

function mapChannel(
  channel: StudioProject["channel"] | ResearchDossierDetail["dossier"]["channel"]
): PromptReadyChannel | null {
  if (!channel) {
    return null;
  }

  return {
    id: channel.id,
    name: channel.name,
    niche: channel.niche,
    language: channel.language,
    visualStyle: channel.visualStyle,
    narrativeTone: channel.narrativeTone,
    defaultTemplate: channel.defaultTemplate,
    defaultVisualPreset: channel.defaultVisualPreset,
    preferredAssetTags: [...channel.preferredAssetTags],
    preferredAssetCategories: [...channel.preferredAssetCategories]
  };
}

function mapCharacterProfile(profile: CharacterProfile | null): HybridCharacterProfile | null {
  if (!profile) {
    return null;
  }

  return {
    id: profile.id,
    name: profile.name,
    slug: profile.slug,
    franchise: profile.franchise,
    category: profile.category,
    description: profile.description,
    basePrompt: profile.basePrompt,
    negativePrompt: profile.negativePrompt,
    styleNotes: profile.styleNotes,
    defaultVisualStyle: profile.defaultVisualStyle,
    referenceStrength: profile.referenceStrength,
    preferredProvider: profile.preferredProvider,
    tags: [...profile.tags],
    references: profile.references.map((reference) => ({
      id: reference.id,
      assetId: reference.assetId,
      sourcePath: reference.sourcePath,
      title: reference.title,
      notes: reference.notes,
      referenceType: reference.referenceType,
      strength: reference.strength,
      tags: reference.asset?.tags ? [...reference.asset.tags] : []
    }))
  };
}

function mapProject(project: StudioProject): PromptReadyProject {
  return {
    id: project.id,
    title: project.title,
    script: project.script,
    channelId: project.channelId,
    durationTarget: project.durationTarget,
    format: project.format,
    templateId: project.templateId ?? null
  };
}

function mapScene(scene: ProjectScene): HybridSceneInput {
  const effectiveAsset = scene.generatedAsset ?? scene.asset;
  const effectiveAssetId = scene.generatedAssetId ?? scene.assetId;

  return {
    id: scene.id,
    order: scene.order,
    title: scene.title,
    narrationText: scene.narrationText,
    captionText: scene.captionText,
    duration: scene.duration,
    emotion: scene.emotion,
    assetId: effectiveAssetId,
    asset: mapAsset(effectiveAsset),
    visualPreset: scene.visualPreset,
    transition: scene.transition,
    energyLevel: scene.energyLevel,
    visualSourceMode: scene.visualSourceMode,
    characterProfileId: scene.characterProfileId,
    visualPrompt: scene.visualPrompt,
    negativePrompt: scene.negativePrompt,
    generatedAssetId: scene.generatedAssetId
  };
}

function mapRequirementToSceneInput(requirement: ResearchAssetRequirement): HybridSceneInput {
  const effectiveAsset = requirement.generatedAsset ?? requirement.fulfilledAsset;
  const effectiveAssetId = requirement.generatedAssetId ?? requirement.fulfilledAssetId;

  return {
    id: requirement.id,
    order: requirement.priority ?? 0,
    title: requirement.description,
    narrationText: requirement.description,
    captionText: null,
    duration: null,
    emotion: requirement.emotion,
    assetId: effectiveAssetId,
    asset: mapAsset(effectiveAsset),
    visualPreset: null,
    transition: null,
    energyLevel: requirement.priority,
    visualSourceMode: requirement.visualSourceMode,
    characterProfileId: requirement.characterProfileId,
    visualPrompt: requirement.visualPrompt,
    negativePrompt: null,
    generatedAssetId: requirement.generatedAssetId
  };
}

function buildSceneVisualRecipePayload(
  currentValue: string | null | undefined,
  recipe: VisualRecipe,
  promptResult: PromptBuildResult
) {
  const current = tryParseJsonRecord(currentValue);
  const leadVariant = promptResult.variants[0] ?? null;

  return JSON.stringify({
    ...(current ?? {}),
    ...recipe,
    promptPackId: promptResult.promptPack.id,
    negativePackId: promptResult.negativePromptPack.id,
    promptQualityScore: promptResult.qualityAnalysis.overallScore,
    promptVariantId: leadVariant?.id ?? null,
    promptVariantType: leadVariant?.type ?? promptResult.context.variantType ?? null,
    promptPlanSummary: promptResult.promptPlanSummary,
    promptPlan: promptResult.plan,
    promptQualityAnalysis: promptResult.qualityAnalysis,
    promptVariants: promptResult.variants
  });
}

async function resolveCharacterProfile(
  characterRepository: CharacterRepository,
  characterProfileId: string | null
) {
  if (!characterProfileId) {
    return null;
  }

  const profile = await characterRepository.getById(characterProfileId);

  if (!profile) {
    throw new NotFoundError(`Character profile '${characterProfileId}' was not found.`);
  }

  return profile;
}

function createPromptBuildInput(
  sceneLike: HybridSceneInput,
  project: PromptReadyProject,
  channel: PromptReadyChannel | null,
  characterProfile: CharacterProfile | null,
  requirement: ResearchAssetRequirement | null,
  normalizedInput: NormalizedPromptBuildRequestInput,
  supportTags: string[]
): PromptBuildInput {
  const promptScene: NonNullable<PromptBuildInput["scene"]> = {
    id: sceneLike.id,
    title: sceneLike.title,
    narrationText: sceneLike.narrationText ?? null,
    captionText: sceneLike.captionText ?? null,
    emotion: sceneLike.emotion ?? null,
    visualPreset: sceneLike.visualPreset ?? null,
    energyLevel: sceneLike.energyLevel ?? null,
    visualPrompt: sceneLike.visualPrompt ?? null,
    negativePrompt: sceneLike.negativePrompt ?? null
  };
  const promptProject: NonNullable<PromptBuildInput["project"]> = {
    id: project.id,
    title: project.title,
    script: project.script ?? null,
    format: project.format ?? null,
    templateId: project.templateId ?? null
  };
  const promptChannel: PromptBuildInput["channel"] = channel
    ? {
        ...(channel.id ? { id: channel.id } : {}),
        ...(channel.name !== undefined ? { name: channel.name ?? null } : {}),
        ...(channel.niche !== undefined ? { niche: channel.niche ?? null } : {}),
        ...(channel.visualStyle !== undefined
          ? { visualStyle: channel.visualStyle ?? null }
          : {}),
        ...(channel.narrativeTone !== undefined
          ? { narrativeTone: channel.narrativeTone ?? null }
          : {}),
        ...(channel.defaultTemplate !== undefined
          ? { defaultTemplate: channel.defaultTemplate ?? null }
          : {})
      }
    : null;
  const promptInput: PromptBuildInput = {
    scene: promptScene,
    project: promptProject,
    channel: promptChannel,
    characterProfile: characterProfile
      ? {
          id: characterProfile.id,
          name: characterProfile.name,
          franchise: characterProfile.franchise,
          description: characterProfile.description,
          basePrompt: characterProfile.basePrompt,
          negativePrompt: characterProfile.negativePrompt,
          styleNotes: characterProfile.styleNotes,
          defaultVisualStyle: characterProfile.defaultVisualStyle,
          tags: [...characterProfile.tags],
          references: characterProfile.references.map((reference) => ({
            title: reference.title,
            notes: reference.notes,
            referenceType: reference.referenceType,
            tags: reference.asset?.tags ? [...reference.asset.tags] : []
          }))
        }
      : null,
    researchAssetRequirement: requirement
      ? {
          id: requirement.id,
          description: requirement.description,
          suggestedTags: [...requirement.suggestedTags],
          emotion: requirement.emotion,
          mediaType: requirement.mediaType,
          sceneRole: requirement.sceneRole
        }
      : null,
    supportTags,
    preferManualPrompt: false
  };

  if (normalizedInput.promptPackId) {
    promptInput.promptPackId = normalizedInput.promptPackId as NonNullable<
      PromptBuildInput["promptPackId"]
    >;
  }

  if (normalizedInput.negativePackId) {
    promptInput.negativePackId = normalizedInput.negativePackId as NonNullable<
      PromptBuildInput["negativePackId"]
    >;
  }

  if (normalizedInput.variantType !== undefined) {
    promptInput.variantType = normalizedInput.variantType;
  }

  if ("templateId" in project && project.templateId) {
    promptInput.templateId = project.templateId;
  } else if (channel && "defaultTemplate" in channel && channel.defaultTemplate) {
    promptInput.templateId = channel.defaultTemplate;
  }

  return promptInput;
}

async function buildScenePromptDraft(
  projectRepository: ProjectRepository,
  characterRepository: CharacterRepository,
  sceneId: string,
  input: PromptBuildRequestInput = {}
) {
  const normalizedInput = normalizePromptBuildRequestInput(input);
  const match = await findProjectBySceneId(projectRepository, sceneId);

  if (!match) {
    throw buildSceneNotFoundError(sceneId);
  }

  const { project, scene } = match;
  const channel = mapChannel(project.channel);
  const sceneLike = mapScene(scene);
  const mappedProject = mapProject(project);
  const storedPromptMetadata = readStoredPromptMetadata(scene.visualRecipe);
  const characterProfile = await resolveCharacterProfile(
    characterRepository,
    normalizedInput.characterProfileId ?? scene.characterProfileId ?? null
  );
  const mappedCharacter = mapCharacterProfile(characterProfile);
  const mode =
    sceneLike.visualSourceMode ??
    suggestVisualSourceMode(
      sceneLike,
      sceneLike.asset ? [sceneLike.asset] : [],
      mappedCharacter ? [mappedCharacter] : []
    );
  const promptResult = buildVisualPrompt(
    createPromptBuildInput(
      sceneLike,
      mappedProject,
      channel,
      characterProfile,
      null,
      {
        ...normalizedInput,
        promptPackId:
          normalizedInput.promptPackId ?? storedPromptMetadata.promptPackId,
        negativePackId:
          normalizedInput.negativePackId ?? storedPromptMetadata.negativePackId,
        variantType:
          normalizedInput.variantType ?? storedPromptMetadata.variantType
      },
      sceneLike.asset?.tags ?? []
    )
  );
  const recipe = buildVisualRecipe(
    {
      ...sceneLike,
      visualPrompt: promptResult.prompt,
      negativePrompt: promptResult.negativePrompt,
      visualSourceMode: mode
    },
    promptResult.prompt,
    mappedCharacter,
    { mode }
  );

  return {
    project,
    scene,
    channel,
    sceneLike,
    mappedProject,
    mappedCharacter,
    characterProfile,
    mode,
    promptResult,
    recipe
  };
}

async function buildRequirementPromptDraft(
  researchRepository: ResearchRepository,
  characterRepository: CharacterRepository,
  requirementId: string,
  input: PromptBuildRequestInput = {}
) {
  const normalizedInput = normalizePromptBuildRequestInput(input);
  const requirement = await researchRepository.getAssetRequirementById(requirementId);

  if (!requirement) {
    throw buildRequirementNotFoundError(requirementId);
  }

  const dossier = await researchRepository.getDossierById(requirement.dossierId);

  if (!dossier) {
    throw new NotFoundError(
      `Research dossier '${requirement.dossierId}' was not found for requirement '${requirementId}'.`
    );
  }

  const channel = mapChannel(dossier.dossier.channel);
  const sceneLike = mapRequirementToSceneInput(requirement);
  const mappedProject: HybridProjectInput = {
    id: dossier.dossier.id,
    title: dossier.dossier.title,
    script: dossier.dossier.summary,
    channelId: dossier.dossier.channelId,
    durationTarget: dossier.dossier.targetDuration,
    format: "vertical_9_16"
  };
  const characterProfile = await resolveCharacterProfile(
    characterRepository,
    normalizedInput.characterProfileId ?? requirement.characterProfileId ?? null
  );
  const mappedCharacter = mapCharacterProfile(characterProfile);
  const mode =
    sceneLike.visualSourceMode ??
    suggestVisualSourceMode(
      sceneLike,
      sceneLike.asset ? [sceneLike.asset] : [],
      mappedCharacter ? [mappedCharacter] : []
    );
  const promptResult = buildVisualPrompt(
    createPromptBuildInput(
      sceneLike,
      mappedProject,
      channel,
      characterProfile,
      requirement,
      normalizedInput,
      requirement.suggestedTags
    )
  );
  const recipe = buildVisualRecipe(
    {
      ...sceneLike,
      visualPrompt: promptResult.prompt,
      negativePrompt: promptResult.negativePrompt,
      visualSourceMode: mode
    },
    promptResult.prompt,
    mappedCharacter,
    { mode }
  );

  return {
    dossier,
    requirement,
    channel,
    sceneLike,
    mappedProject,
    mappedCharacter,
    characterProfile,
    mode,
    promptResult,
    recipe
  };
}

async function findProjectBySceneId(projectRepository: ProjectRepository, sceneId: string) {
  const projects = await projectRepository.list();

  for (const project of projects) {
    const scene = project.scenes.find((entry) => entry.id === sceneId);

    if (scene) {
      return { project, scene };
    }
  }

  return null;
}

function resolveGeneratedVisualArtifactPaths(jobId: string): GeneratedVisualArtifactPaths {
  const directory = join(assetsStorageRoot, "generated", "visuals");

  return {
    outputAbsolutePath: join(directory, `${jobId}.png`),
    outputPath: `storage/assets/generated/visuals/${jobId}.png`,
    debugSvgAbsolutePath: join(directory, `${jobId}.svg`),
    debugSvgPath: `storage/assets/generated/visuals/${jobId}.svg`
  };
}

async function writeGeneratedSceneVisuals(
  jobId: string,
  svg: string,
  recipe: VisualRecipe,
  width: number,
  height: number,
  seed: number | null
) {
  const paths = resolveGeneratedVisualArtifactPaths(jobId);
  await mkdir(join(assetsStorageRoot, "generated", "visuals"), {
    recursive: true
  });

  await Promise.all([
    writeFile(paths.debugSvgAbsolutePath, svg, "utf8"),
    writeMockGeneratedVisualPng(paths.outputAbsolutePath, {
      width,
      height,
      seed,
      primary: recipe.gradient.from,
      secondary: recipe.gradient.to,
      accent: recipe.gradient.accent
    })
  ]);

  return paths;
}

function buildJobMetadata(
  job: Pick<
    VisualGenerationJob,
    | "id"
    | "sceneId"
    | "videoProjectId"
    | "characterProfileId"
    | "status"
    | "provider"
    | "visualSourceMode"
    | "generatedAssetId"
    | "outputPath"
    | "errorMessage"
    | "width"
    | "height"
    | "seed"
  >,
  recipe: VisualRecipe,
  promptResult: PromptBuildResult,
  extras: Record<string, unknown> = {}
) {
  return {
    promptSummary: summarizeVisualGenerationJob({
      id: job.id,
      sceneId: job.sceneId,
      videoProjectId: job.videoProjectId,
      characterProfileId: job.characterProfileId,
      status: job.status,
      provider: job.provider,
      visualSourceMode: job.visualSourceMode,
      stylePreset: recipe.sceneTitle,
      generatedAssetId: job.generatedAssetId,
      outputPath: job.outputPath,
      errorMessage: job.errorMessage
    }),
    prompt: promptResult.prompt,
    negativePrompt: promptResult.negativePrompt,
    promptPackId: promptResult.promptPack.id,
    negativePackId: promptResult.negativePromptPack.id,
    promptPlanSummary: promptResult.promptPlanSummary,
    promptPlan: promptResult.plan,
    variants: promptResult.variants,
    qualityAnalysis: promptResult.qualityAnalysis,
    recipe,
    width: job.width,
    height: job.height,
    provider: job.provider,
    mode: job.visualSourceMode,
    ...extras
  };
}

async function createGeneratedAssetRecord(
  assetRepository: AssetRepository,
  artifacts: GeneratedVisualArtifactPaths,
  job: VisualGenerationJob,
  sceneOrRequirement: HybridSceneInput,
  profile: CharacterProfile | null,
  promptTokens: string[]
) {
  const metadata = createGeneratedAssetMetadata(job, artifacts.outputPath, {
    debugSvgPath: artifacts.debugSvgPath,
    width: job.width,
    height: job.height
  });

  return assetRepository.create({
    filename: metadata.filename,
    originalName: metadata.originalName,
    path: metadata.path,
    type: metadata.type,
    category: "REFERENCE",
    franchise: profile?.franchise ?? sceneOrRequirement.asset?.franchise ?? null,
    character: profile?.name ?? sceneOrRequirement.asset?.character ?? null,
    emotion:
      (sceneOrRequirement.emotion as Parameters<
        typeof assetRepository.create
      >[0]["emotion"]) ?? null,
    tags: [...new Set(["generated", "hybrid-visual", ...promptTokens].slice(0, 24))],
    licenseType: "local-generated",
    copyrightRisk: "LOW",
    recommendedUse: `Local generated visual for ${sceneOrRequirement.title}.`,
    duration: null,
    width: metadata.width,
    height: metadata.height,
    mimeType: metadata.mimeType,
    extension: metadata.extension,
    fileSize: null,
    sourceProvider: job.provider,
    usageNotes: `${metadata.usageNotes} Debug SVG: ${metadata.debugSvgPath}.`
  });
}

async function createQueuedJob(
  visualGenerationJobRepository: VisualGenerationJobRepository,
  projectId: string | null,
  sceneId: string | null,
  requirementId: string | null,
  characterProfileId: string | null,
  input: GenerateVisualRequestInput,
  promptResult: PromptBuildResult,
  mode: HybridSceneInput["visualSourceMode"]
) {
  return visualGenerationJobRepository.create({
    videoProjectId: projectId,
    sceneId,
    characterProfileId,
    researchAssetRequirementId: requirementId,
    status: input.provider === "mock-svg" ? "generating" : "queued",
    provider: input.provider,
    visualSourceMode: mode ?? null,
    prompt: promptResult.prompt,
    negativePrompt: promptResult.negativePrompt,
    stylePreset: promptResult.context.channel?.visualStyle ?? null,
    seed: input.seed,
    width: input.width,
    height: input.height,
    outputPath: null,
    generatedAssetId: null,
    errorMessage: null,
    metadata: null,
    startedAt: new Date().toISOString(),
    completedAt: null
  });
}

export async function listPromptPacks() {
  return getVisualPromptPacks();
}

export async function getPromptPackByIdOrThrow(promptPackId: string) {
  const pack = getVisualPromptPackById(promptPackId);

  if (!pack) {
    throw new NotFoundError(`Prompt pack '${promptPackId}' was not found.`);
  }

  return pack;
}

export async function listNegativePromptPacks() {
  return getNegativePromptPacks();
}

export async function getNegativePromptPackByIdOrThrow(negativePackId: string) {
  const pack = getNegativePromptPackById(negativePackId);

  if (!pack) {
    throw new NotFoundError(
      `Negative prompt pack '${negativePackId}' was not found.`
    );
  }

  return pack;
}

export async function previewVisualPromptBuild(
  projectRepository: ProjectRepository,
  researchRepository: ResearchRepository,
  characterRepository: CharacterRepository,
  input: PromptBuildRequestInput & {
    sceneId?: string | null;
    researchAssetRequirementId?: string | null;
  }
) {
  if (input.sceneId) {
    const draft = await buildScenePromptDraft(
      projectRepository,
      characterRepository,
      input.sceneId,
      input
    );

    return {
      sceneId: draft.scene.id,
      projectId: draft.project.id,
      prompt: draft.promptResult.prompt,
      negativePrompt: draft.promptResult.negativePrompt,
      variants: draft.promptResult.variants,
      qualityAnalysis: draft.promptResult.qualityAnalysis,
      promptPlanSummary: draft.promptResult.promptPlanSummary,
      promptPackId: draft.promptResult.promptPack.id,
      negativePackId: draft.promptResult.negativePromptPack.id
    };
  }

  if (input.researchAssetRequirementId) {
    const draft = await buildRequirementPromptDraft(
      researchRepository,
      characterRepository,
      input.researchAssetRequirementId,
      input
    );

    return {
      researchAssetRequirementId: draft.requirement.id,
      dossierId: draft.dossier.dossier.id,
      prompt: draft.promptResult.prompt,
      negativePrompt: draft.promptResult.negativePrompt,
      variants: draft.promptResult.variants,
      qualityAnalysis: draft.promptResult.qualityAnalysis,
      promptPlanSummary: draft.promptResult.promptPlanSummary,
      promptPackId: draft.promptResult.promptPack.id,
      negativePackId: draft.promptResult.negativePromptPack.id
    };
  }

  throw new ValidationError(
    "sceneId or researchAssetRequirementId is required to build a visual prompt."
  );
}

export async function buildSceneVisualPrompt(
  projectRepository: ProjectRepository,
  characterRepository: CharacterRepository,
  sceneId: string,
  input: PromptBuildRequestInput = {}
) {
  const draft = await buildScenePromptDraft(
    projectRepository,
    characterRepository,
    sceneId,
    input
  );
  const visualRecipe = buildSceneVisualRecipePayload(
    draft.scene.visualRecipe,
    draft.recipe,
    draft.promptResult
  );
  const updatedScene = await projectRepository.updateScene(draft.project.id, draft.scene.id, {
    characterProfileId: draft.characterProfile?.id ?? null,
    visualSourceMode: draft.mode,
    visualPrompt: draft.promptResult.prompt,
    negativePrompt: draft.promptResult.negativePrompt,
    visualRecipe
  });

  return {
    scene:
      updatedScene ??
      ({
        ...draft.scene,
        characterProfileId: draft.characterProfile?.id ?? null,
        visualSourceMode: draft.mode,
        visualPrompt: draft.promptResult.prompt,
        negativePrompt: draft.promptResult.negativePrompt,
        visualRecipe
      } satisfies ProjectScene),
    prompt: draft.promptResult.prompt,
    negativePrompt: draft.promptResult.negativePrompt,
    variants: draft.promptResult.variants,
    qualityAnalysis: draft.promptResult.qualityAnalysis,
    promptPlanSummary: draft.promptResult.promptPlanSummary,
    promptPackId: draft.promptResult.promptPack.id,
    negativePackId: draft.promptResult.negativePromptPack.id
  };
}

export async function buildResearchRequirementVisualPrompt(
  researchRepository: ResearchRepository,
  characterRepository: CharacterRepository,
  requirementId: string,
  input: PromptBuildRequestInput = {}
) {
  const draft = await buildRequirementPromptDraft(
    researchRepository,
    characterRepository,
    requirementId,
    input
  );
  const updatedRequirement = await researchRepository.updateAssetRequirement(
    draft.requirement.id,
    {
      characterProfileId: draft.characterProfile?.id ?? null,
      visualSourceMode: draft.mode,
      visualPrompt: draft.promptResult.prompt
    }
  );

  return {
    requirement:
      updatedRequirement ??
      ({
        ...draft.requirement,
        characterProfileId: draft.characterProfile?.id ?? null,
        visualSourceMode: draft.mode,
        visualPrompt: draft.promptResult.prompt
      } satisfies ResearchAssetRequirement),
    prompt: draft.promptResult.prompt,
    negativePrompt: draft.promptResult.negativePrompt,
    variants: draft.promptResult.variants,
    qualityAnalysis: draft.promptResult.qualityAnalysis,
    promptPlanSummary: draft.promptResult.promptPlanSummary,
    promptPackId: draft.promptResult.promptPack.id,
    negativePackId: draft.promptResult.negativePromptPack.id
  };
}

export async function listVisualSourceModes() {
  return getVisualSourceModes();
}

export async function listVisualGenerationProviders(
  appEnvInput: Partial<HybridVisualEnv> = {}
) {
  return listRegisteredVisualGenerationProviders(resolveHybridVisualEnv(appEnvInput));
}

export async function getComfyUiProviderStatusSnapshot(
  appEnvInput: Partial<HybridVisualEnv> = {}
) {
  return getComfyUiProviderStatus(resolveHybridVisualEnv(appEnvInput));
}

export async function testComfyUiProvider(
  appEnvInput: Partial<HybridVisualEnv> = {}
) {
  return getComfyUiProviderStatus(resolveHybridVisualEnv(appEnvInput));
}

export async function validateComfyUiWorkflowTemplateSnapshot(
  templateId: string | null | undefined,
  appEnvInput: Partial<HybridVisualEnv> = {}
) {
  const appEnv = resolveHybridVisualEnv(appEnvInput);

  return validateComfyWorkflowTemplate(
    (templateId?.trim() || appEnv.comfyUiDefaultWorkflow).trim(),
    resolveComfyWorkflowOptions(appEnv)
  );
}

export async function listVisualGenerationJobs(
  repository: VisualGenerationJobRepository,
  filters: VisualGenerationJobFilters = {}
) {
  return repository.list(filters);
}

export async function getVisualGenerationJobById(
  repository: VisualGenerationJobRepository,
  jobId: string
) {
  const job = await repository.getById(jobId);

  if (!job) {
    throw buildJobNotFoundError(jobId);
  }

  return job;
}

export async function cancelVisualGenerationJob(
  repository: VisualGenerationJobRepository,
  projectRepository: ProjectRepository,
  researchRepository: ResearchRepository,
  jobId: string
) {
  const job = await repository.getById(jobId);

  if (!job) {
    throw buildJobNotFoundError(jobId);
  }

  if (job.status === "completed") {
    throw new ValidationError("Completed visual generation jobs cannot be cancelled.");
  }

  const cancelled = await repository.update(jobId, {
    status: "cancelled",
    completedAt: new Date().toISOString(),
    errorMessage: null
  });

  if (job.sceneId && job.videoProjectId) {
    await projectRepository.updateScene(job.videoProjectId, job.sceneId, {
      generationStatus: "cancelled",
      generationProvider: job.provider
    });
  }

  if (job.researchAssetRequirementId) {
    await researchRepository.updateAssetRequirement(job.researchAssetRequirementId, {
      generationStatus: "cancelled",
      generationProvider: job.provider
    });
  }

  return cancelled ?? job;
}

export async function getProjectMissingVisualReport(
  projectRepository: ProjectRepository,
  characterRepository: CharacterRepository,
  projectId: string
) {
  const project = await projectRepository.getById(projectId);

  if (!project) {
    throw new NotFoundError(`Video project '${projectId}' was not found.`);
  }

  const characters = await characterRepository.list();

  return buildMissingVisualReport(
    mapProject(project),
    project.scenes
      .slice()
      .sort((left, right) => left.order - right.order)
      .map(mapScene),
    project.scenes
      .map((scene) => scene.generatedAsset ?? scene.asset)
      .filter((asset): asset is NonNullable<typeof asset> => asset !== null)
      .map((asset) => mapAsset(asset) as HybridAssetInput),
    mapChannel(project.channel),
    characters
      .map((character) => mapCharacterProfile(character))
      .filter((character): character is HybridCharacterProfile => character !== null)
  );
}

async function generateVisualForContext(
  assetRepository: AssetRepository,
  characterRepository: CharacterRepository,
  visualGenerationJobRepository: VisualGenerationJobRepository,
  context:
    | {
        kind: "scene";
        projectRepository: ProjectRepository;
        project: StudioProject;
        scene: ProjectScene;
      }
    | {
        kind: "requirement";
        researchRepository: ResearchRepository;
        dossier: ResearchDossierDetail;
        requirement: ResearchAssetRequirement;
      },
  input: GenerateVisualRequestInput,
  appEnvInput: Partial<HybridVisualEnv> = {}
) {
  void resolveHybridVisualEnv(appEnvInput);

  const draft =
    context.kind === "scene"
      ? await buildScenePromptDraft(
          context.projectRepository,
          characterRepository,
          context.scene.id,
          { characterProfileId: input.characterProfileId }
        )
      : await buildRequirementPromptDraft(
          context.researchRepository,
          characterRepository,
          context.requirement.id,
          { characterProfileId: input.characterProfileId }
        );

  const seed = createDeterministicSeed(
    input.seed,
    `${draft.mappedProject.id}:${draft.sceneLike.id}:${draft.promptResult.promptPlanSummary}`
  );
  let job = await createQueuedJob(
    visualGenerationJobRepository,
    context.kind === "scene" ? context.project.id : null,
    context.kind === "scene" ? context.scene.id : null,
    context.kind === "requirement" ? context.requirement.id : null,
    draft.characterProfile?.id ?? null,
    input,
    draft.promptResult,
    draft.mode
  );

  if (input.provider !== "mock-svg") {
    const queuedJob = await visualGenerationJobRepository.update(job.id, {
      metadata: buildJobMetadata(
        {
          ...job,
          seed,
          status: "queued",
          outputPath: null,
          generatedAssetId: null,
          errorMessage: null
        },
        draft.recipe,
        draft.promptResult,
        {
          reason:
            input.provider === "comfyui-local"
              ? "ComfyUI local provider is exposed for diagnostics; generation remains queued during recovery."
              : "Provider reserved for future local integration."
        }
      )
    });

    job = queuedJob ?? job;

    if (context.kind === "scene") {
      await context.projectRepository.updateScene(context.project.id, context.scene.id, {
        characterProfileId: draft.characterProfile?.id ?? null,
        visualSourceMode: draft.mode,
        visualPrompt: draft.promptResult.prompt,
        negativePrompt: draft.promptResult.negativePrompt,
        visualRecipe: buildSceneVisualRecipePayload(
          context.scene.visualRecipe,
          draft.recipe,
          draft.promptResult
        ),
        generationStatus: "queued",
        generationProvider: input.provider,
        generationSeed: seed
      });
    } else {
      await context.researchRepository.updateAssetRequirement(context.requirement.id, {
        characterProfileId: draft.characterProfile?.id ?? null,
        visualSourceMode: draft.mode,
        visualPrompt: draft.promptResult.prompt,
        generationStatus: "queued",
        generationProvider: input.provider
      });
    }

    return {
      job,
      asset: null
    };
  }

  try {
    const svg = createMockGeneratedVisualSvg({
      jobId: job.id,
      prompt: draft.promptResult.prompt,
      sceneTitle: draft.sceneLike.title,
      emotion: draft.sceneLike.emotion ?? null,
      visualPreset: draft.sceneLike.visualPreset ?? null,
      characterProfile: draft.mappedCharacter,
      width: input.width,
      height: input.height,
      seed
    });
    const visualArtifacts = await writeGeneratedSceneVisuals(
      job.id,
      svg,
      draft.recipe,
      input.width,
      input.height,
      seed
    );
    const asset = await createGeneratedAssetRecord(
      assetRepository,
      visualArtifacts,
      job,
      draft.sceneLike,
      draft.characterProfile,
      draft.promptResult.context.supportTags
    );
    const completedAt = new Date().toISOString();
    const nextJob = await visualGenerationJobRepository.update(job.id, {
      status: "completed",
      outputPath: visualArtifacts.outputPath,
      generatedAssetId: asset.id,
      metadata: buildJobMetadata(
        {
          ...job,
          seed,
          status: "completed",
          outputPath: visualArtifacts.outputPath,
          generatedAssetId: asset.id,
          errorMessage: null
        },
        draft.recipe,
        draft.promptResult,
        {
          debugSvgPath: visualArtifacts.debugSvgPath,
          previewType: "png",
          renderReady: true
        }
      ),
      completedAt
    });

    if (context.kind === "scene") {
      await context.projectRepository.updateScene(context.project.id, context.scene.id, {
        characterProfileId: draft.characterProfile?.id ?? null,
        generatedAssetId: input.autoAttach ? asset.id : null,
        visualSourceMode: draft.mode,
        visualPrompt: draft.promptResult.prompt,
        negativePrompt: draft.promptResult.negativePrompt,
        visualRecipe: buildSceneVisualRecipePayload(
          context.scene.visualRecipe,
          draft.recipe,
          draft.promptResult
        ),
        generationStatus: "completed",
        generationProvider: input.provider,
        generationSeed: seed
      });
    } else {
      await context.researchRepository.updateAssetRequirement(context.requirement.id, {
        characterProfileId: draft.characterProfile?.id ?? null,
        generatedAssetId: input.autoAttach ? asset.id : null,
        visualSourceMode: draft.mode,
        visualPrompt: draft.promptResult.prompt,
        generationStatus: "completed",
        generationProvider: input.provider
      });
    }

    return {
      job: nextJob ?? job,
      asset
    };
  } catch (error) {
    const message =
      error instanceof Error && error.message.trim()
        ? error.message.trim()
        : "Mock visual generation failed.";

    const failedJob = await visualGenerationJobRepository.update(job.id, {
      status: "failed",
      errorMessage: message,
      completedAt: new Date().toISOString(),
      metadata: buildJobMetadata(
        {
          ...job,
          seed,
          status: "failed",
          outputPath: null,
          generatedAssetId: null,
          errorMessage: message
        },
        draft.recipe,
        draft.promptResult
      )
    });

    if (context.kind === "scene") {
      await context.projectRepository.updateScene(context.project.id, context.scene.id, {
        characterProfileId: draft.characterProfile?.id ?? null,
        visualSourceMode: draft.mode,
        visualPrompt: draft.promptResult.prompt,
        negativePrompt: draft.promptResult.negativePrompt,
        visualRecipe: buildSceneVisualRecipePayload(
          context.scene.visualRecipe,
          draft.recipe,
          draft.promptResult
        ),
        generationStatus: "failed",
        generationProvider: input.provider,
        generationSeed: seed
      });
    } else {
      await context.researchRepository.updateAssetRequirement(context.requirement.id, {
        characterProfileId: draft.characterProfile?.id ?? null,
        visualSourceMode: draft.mode,
        visualPrompt: draft.promptResult.prompt,
        generationStatus: "failed",
        generationProvider: input.provider
      });
    }

    throw new ValidationError(failedJob?.errorMessage ?? message);
  }
}

export async function generateVisualForScene(
  projectRepository: ProjectRepository,
  assetRepository: AssetRepository,
  characterRepository: CharacterRepository,
  visualGenerationJobRepository: VisualGenerationJobRepository,
  sceneId: string,
  input: GenerateVisualRequestInput,
  appEnvInput: Partial<HybridVisualEnv> = {}
) {
  const match = await findProjectBySceneId(projectRepository, sceneId);

  if (!match) {
    throw buildSceneNotFoundError(sceneId);
  }

  return generateVisualForContext(
    assetRepository,
    characterRepository,
    visualGenerationJobRepository,
    {
      kind: "scene",
      projectRepository,
      project: match.project,
      scene: match.scene
    },
    input,
    appEnvInput
  );
}

export async function generateVisualForResearchRequirement(
  researchRepository: ResearchRepository,
  assetRepository: AssetRepository,
  characterRepository: CharacterRepository,
  visualGenerationJobRepository: VisualGenerationJobRepository,
  requirementId: string,
  input: GenerateVisualRequestInput,
  appEnvInput: Partial<HybridVisualEnv> = {}
) {
  const requirement = await researchRepository.getAssetRequirementById(requirementId);

  if (!requirement) {
    throw buildRequirementNotFoundError(requirementId);
  }

  const dossier = await researchRepository.getDossierById(requirement.dossierId);

  if (!dossier) {
    throw new NotFoundError(
      `Research dossier '${requirement.dossierId}' was not found for requirement '${requirementId}'.`
    );
  }

  return generateVisualForContext(
    assetRepository,
    characterRepository,
    visualGenerationJobRepository,
    {
      kind: "requirement",
      researchRepository,
      dossier,
      requirement
    },
    input,
    appEnvInput
  );
}

export async function generateMissingVisualsForProject(
  projectRepository: ProjectRepository,
  assetRepository: AssetRepository,
  characterRepository: CharacterRepository,
  visualGenerationJobRepository: VisualGenerationJobRepository,
  projectId: string,
  input: GenerateMissingVisualsInput,
  appEnvInput: Partial<HybridVisualEnv> = {}
) {
  const project = await projectRepository.getById(projectId);

  if (!project) {
    throw new NotFoundError(`Video project '${projectId}' was not found.`);
  }

  const report = await getProjectMissingVisualReport(
    projectRepository,
    characterRepository,
    projectId
  );
  const queue = report.items
    .filter((item) => item.readyForGeneration)
    .filter((item) => !item.currentAssetId || item.weakVisual || item.usesRepeatedAsset)
    .slice(0, input.maxScenes);
  const jobs: VisualGenerationJob[] = [];
  const assetIds: string[] = [];

  for (const item of queue) {
    const result = await generateVisualForScene(
      projectRepository,
      assetRepository,
      characterRepository,
      visualGenerationJobRepository,
      item.sceneId,
      {
        ...input,
        characterProfileId: input.characterProfileId ?? item.suggestedCharacterProfileId
      },
      appEnvInput
    );

    jobs.push(result.job);

    if (result.asset) {
      assetIds.push(result.asset.id);
    }
  }

  return {
    projectId,
    generatedCount: jobs.length,
    assetIds,
    sceneIds: queue.map((item) => item.sceneId),
    report,
    jobs
  };
}
