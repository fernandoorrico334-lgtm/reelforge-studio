import type { ComfyWorkflowPack, SeedStrategy } from "./workflow-packs.js";

export const imageQualityPresetIds = ["draft", "standard", "high"] as const;

export type ImageQualityPresetId = (typeof imageQualityPresetIds)[number];

export interface ImageQualityPreset {
  id: ImageQualityPresetId;
  name: string;
  description: string;
  width: number;
  height: number;
  steps: number;
  cfg: number;
  sampler?: string;
  scheduler?: string;
  denoise?: number;
  seedMode: SeedStrategy;
  timeoutMs: number;
  recommendedUse: string;
}

export interface GenerationParameterOverrides {
  workflowId?: string | null;
  workflowPackId?: string | null;
  qualityPresetId?: string | null;
  prompt?: string | null;
  negativePrompt?: string | null;
  width?: number | null;
  height?: number | null;
  seed?: number | null;
  seedMode?: SeedStrategy | null;
  steps?: number | null;
  cfg?: number | null;
  sampler?: string | null;
  scheduler?: string | null;
  denoise?: number | null;
}

export interface BuiltGenerationParameters {
  workflowId: string;
  workflowPackId: string;
  qualityPresetId: ImageQualityPresetId;
  promptPackId: string;
  negativePromptPackId: string;
  width: number;
  height: number;
  seed: number | null;
  seedStrategy: SeedStrategy;
  steps: number;
  cfg: number;
  sampler: string | null;
  scheduler: string | null;
  denoise: number | null;
  timeoutMs: number;
  appliedParameters: Record<string, string | number | null>;
  ignoredParameters: Record<string, string | number | null>;
}

const imageQualityPresets: ImageQualityPreset[] = [
  {
    id: "draft",
    name: "Draft",
    description: "Iteracao rapida para validar prompt, composicao e provider.",
    width: 720,
    height: 1280,
    steps: 12,
    cfg: 2.2,
    sampler: "res_multistep",
    scheduler: "simple",
    denoise: 0.8,
    seedMode: "random",
    timeoutMs: 180_000,
    recommendedUse: "Teste visual rapido, Prompt Lab e comparacao mock vs ComfyUI."
  },
  {
    id: "standard",
    name: "Standard",
    description: "Baseline render-ready 9:16 para imagens finais de cenas.",
    width: 1080,
    height: 1920,
    steps: 20,
    cfg: 2.8,
    sampler: "res_multistep",
    scheduler: "simple",
    denoise: 0.75,
    seedMode: "reuse",
    timeoutMs: 300_000,
    recommendedUse: "Padrao recomendado para producao local com ComfyUI."
  },
  {
    id: "high",
    name: "High",
    description: "Mais passos e paciencia para frames hero/render final.",
    width: 1080,
    height: 1920,
    steps: 30,
    cfg: 3.4,
    sampler: "res_multistep",
    scheduler: "simple",
    denoise: 0.68,
    seedMode: "reuse",
    timeoutMs: 480_000,
    recommendedUse: "Climax, thumbnails internas e scenes hero com maior exigencia visual."
  }
];

function clampInteger(
  value: number | null | undefined,
  fallback: number,
  min: number,
  max: number
) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(Math.max(Math.trunc(value), min), max);
}

function clampNumber(
  value: number | null | undefined,
  fallback: number,
  min: number,
  max: number
) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(Math.max(value, min), max);
}

function cleanString(value: string | null | undefined) {
  return value?.trim() || null;
}

export function getImageQualityPresets() {
  return [...imageQualityPresets];
}

export function getImageQualityPresetById(id: string | null | undefined) {
  return imageQualityPresets.find((preset) => preset.id === id) ?? null;
}

export function resolveQualityPreset(input: string | null | undefined) {
  return getImageQualityPresetById(input) ?? getImageQualityPresetById("standard")!;
}

export function buildGenerationParameters(
  pack: ComfyWorkflowPack,
  qualityPreset: ImageQualityPreset,
  overrides: GenerationParameterOverrides = {},
  supportedPlaceholders: string[] = [
    "{{PROMPT}}",
    "{{NEGATIVE_PROMPT}}",
    "{{WIDTH}}",
    "{{HEIGHT}}",
    "{{SEED}}",
    "{{STEPS}}",
    "{{CFG}}",
    "{{SAMPLER}}",
    "{{SCHEDULER}}",
    "{{DENOISE}}"
  ]
): BuiltGenerationParameters {
  const width = clampInteger(
    overrides.width,
    qualityPreset.width || pack.defaultWidth,
    128,
    4096
  );
  const height = clampInteger(
    overrides.height,
    qualityPreset.height || pack.defaultHeight,
    128,
    4096
  );
  const steps = clampInteger(overrides.steps, qualityPreset.steps, 1, 80);
  const cfg = clampNumber(overrides.cfg, qualityPreset.cfg, 0, 30);
  const denoise =
    overrides.denoise === null
      ? null
      : clampNumber(overrides.denoise, qualityPreset.denoise ?? 0.75, 0, 1);
  const sampler = cleanString(overrides.sampler) ?? qualityPreset.sampler ?? null;
  const scheduler = cleanString(overrides.scheduler) ?? qualityPreset.scheduler ?? null;
  const seedStrategy = overrides.seedMode ?? qualityPreset.seedMode ?? pack.defaultSeedStrategy;

  const candidateParameters: Record<string, string | number | null> = {
    "{{PROMPT}}": cleanString(overrides.prompt) ?? "",
    "{{NEGATIVE_PROMPT}}": cleanString(overrides.negativePrompt) ?? "",
    "{{WIDTH}}": width,
    "{{HEIGHT}}": height,
    "{{SEED}}": overrides.seed ?? null,
    "{{STEPS}}": steps,
    "{{CFG}}": cfg,
    "{{SAMPLER}}": sampler,
    "{{SCHEDULER}}": scheduler,
    "{{DENOISE}}": denoise
  };
  const supported = new Set(supportedPlaceholders);
  const appliedParameters: Record<string, string | number | null> = {};
  const ignoredParameters: Record<string, string | number | null> = {};

  Object.entries(candidateParameters).forEach(([key, value]) => {
    if (supported.has(key)) {
      appliedParameters[key] = value;
    } else {
      ignoredParameters[key] = value;
    }
  });

  return {
    workflowId: cleanString(overrides.workflowId) ?? pack.recommendedWorkflowId,
    workflowPackId: pack.id,
    qualityPresetId: qualityPreset.id,
    promptPackId: pack.recommendedPromptPackId,
    negativePromptPackId: pack.recommendedNegativePromptPackId,
    width,
    height,
    seed: overrides.seed ?? null,
    seedStrategy,
    steps,
    cfg,
    sampler,
    scheduler,
    denoise,
    timeoutMs: qualityPreset.timeoutMs,
    appliedParameters,
    ignoredParameters
  };
}
