export * from "./comfy-workflows.js";
export * from "./image-quality-presets.js";
export * from "./workflow-packs.js";

export const visualSourceModes = [
  "asset_only",
  "generated_only",
  "hybrid_overlay",
  "fallback_generated",
  "mixed_sequence"
] as const;

export type VisualSourceMode = (typeof visualSourceModes)[number];

export const visualGenerationProviders = [
  "mock-svg",
  "manual",
  "comfyui-local",
  "stable-diffusion-local",
  "other"
] as const;

export type VisualGenerationProvider =
  (typeof visualGenerationProviders)[number];

export const visualGenerationStatuses = [
  "draft",
  "queued",
  "generating",
  "completed",
  "failed",
  "cancelled"
] as const;

export type VisualGenerationStatus =
  (typeof visualGenerationStatuses)[number];

export const characterReferenceTypes = [
  "face",
  "full_body",
  "pose",
  "outfit",
  "style",
  "expression",
  "other"
] as const;

export type CharacterReferenceType = (typeof characterReferenceTypes)[number];

export interface HybridCharacterReference {
  id: string;
  assetId: string | null;
  sourcePath: string | null;
  title: string | null;
  notes: string | null;
  referenceType: CharacterReferenceType;
  strength: number | null;
  tags?: string[];
}

export interface HybridCharacterProfile {
  id: string;
  name: string;
  slug: string;
  franchise?: string | null;
  category?: string | null;
  description?: string | null;
  basePrompt?: string | null;
  negativePrompt?: string | null;
  styleNotes?: string | null;
  defaultVisualStyle?: string | null;
  referenceStrength?: number | null;
  preferredProvider?: string | null;
  tags?: string[];
  references?: HybridCharacterReference[];
}

export interface HybridChannelInput {
  id?: string;
  name?: string | null;
  niche?: string | null;
  language?: string | null;
  visualStyle?: string | null;
  narrativeTone?: string | null;
  defaultVisualPreset?: string | null;
  preferredAssetTags?: string[];
  preferredAssetCategories?: string[];
}

export interface HybridAssetInput {
  id: string;
  filename: string;
  type: string;
  category: string;
  franchise?: string | null;
  character?: string | null;
  emotion?: string | null;
  tags: string[];
  sourceProvider?: string | null;
  recommendedUse?: string | null;
}

export interface HybridSceneInput {
  id: string;
  order: number;
  title: string;
  narrationText?: string | null;
  captionText?: string | null;
  duration?: number | null;
  emotion?: string | null;
  assetId?: string | null;
  asset?: HybridAssetInput | null;
  visualPreset?: string | null;
  transition?: string | null;
  energyLevel?: number | null;
  visualSourceMode?: VisualSourceMode | null;
  characterProfileId?: string | null;
  visualPrompt?: string | null;
  negativePrompt?: string | null;
  generatedAssetId?: string | null;
}

export interface HybridProjectInput {
  id: string;
  title: string;
  script?: string | null;
  channelId?: string | null;
  durationTarget?: number | null;
  format?: string | null;
}

export interface VisualPromptBuildOptions {
  visualStyle?: string | null;
  supportTags?: string[];
  includeNarration?: boolean;
  includeCaption?: boolean;
}

export interface VisualPromptResult {
  prompt: string;
  tokens: string[];
  summary: string;
}

export interface VisualRecipe {
  mode: VisualSourceMode;
  sceneTitle: string;
  headline: string;
  colorMood: string;
  abstractShapes: string[];
  typographyStyle: string;
  gradient: {
    from: string;
    to: string;
    accent: string;
  };
  overlays: string[];
  tags: string[];
}

export interface SceneVisualNeedAnalysis {
  sceneId: string;
  order: number;
  title: string;
  hasAsset: boolean;
  usesRepeatedAsset: boolean;
  weakVisual: boolean;
  captionStrength: number;
  narrationStrength: number;
  score: number;
  reasons: string[];
  suggestedVisualSourceMode: VisualSourceMode;
  suggestedTags: string[];
  priority: "low" | "medium" | "high";
  readyForGeneration: boolean;
}

export interface MissingVisualSceneReport extends SceneVisualNeedAnalysis {
  currentAssetId: string | null;
  currentAsset: HybridAssetInput | null;
  suggestedPrompt: string;
  suggestedNegativePrompt: string | null;
  suggestedCharacterProfileId: string | null;
}

export interface MissingVisualReport {
  projectId: string;
  totalScenes: number;
  scenesWithoutAsset: number;
  scenesWithWeakVisual: number;
  scenesWithRepeatedAssets: number;
  readyForGeneration: boolean;
  items: MissingVisualSceneReport[];
}

export interface MockGeneratedVisualInput {
  jobId: string;
  prompt: string;
  sceneTitle: string;
  emotion?: string | null;
  visualPreset?: string | null;
  characterProfile?: HybridCharacterProfile | null;
  width?: number;
  height?: number;
  seed?: number | null;
}

export interface VisualGenerationJobSummaryInput {
  id: string;
  sceneId?: string | null;
  videoProjectId?: string | null;
  characterProfileId?: string | null;
  status: VisualGenerationStatus;
  provider: VisualGenerationProvider;
  visualSourceMode?: string | null;
  stylePreset?: string | null;
  generatedAssetId?: string | null;
  outputPath?: string | null;
  errorMessage?: string | null;
}

export interface GeneratedAssetMetadata {
  filename: string;
  originalName: string;
  path: string;
  type: "IMAGE";
  category: "GENERATED";
  mimeType: "image/png";
  extension: ".png";
  width: number;
  height: number;
  sourceProvider: "hybrid-visual-engine";
  debugSvgPath: string;
  previewType: "png";
  renderReady: true;
  usageNotes: string;
}

export interface VisualSourceModeDescriptor {
  id: VisualSourceMode;
  name: string;
  description: string;
}

export interface VisualGenerationProviderDescriptor {
  id: VisualGenerationProvider;
  name: string;
  configured: boolean;
  available: boolean;
  message: string;
  requiresLocalServer: boolean;
  baseUrl?: string | null;
  kind: "local" | "stub" | "manual";
  description: string;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

function normalizeText(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[^\x00-\x7F]/g, "")
    .toLowerCase();
}

function toTokens(parts: Array<string | null | undefined>) {
  return uniqueStrings(
    parts
      .join(" ")
      .split(/[^a-zA-Z0-9]+/g)
      .map((token) => normalizeText(token))
      .filter((token) => token.length >= 3)
  );
}

function summarizePrompt(prompt: string, maxLength = 120) {
  const normalized = prompt.replace(/\s+/g, " ").trim();

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 3).trim()}...`;
}

function mapColorMood(emotion?: string | null, preset?: string | null) {
  const key = normalizeText(`${emotion ?? ""} ${preset ?? ""}`);

  if (key.includes("epic")) {
    return {
      colorMood: "amber steel",
      gradient: { from: "#110b20", to: "#2d173a", accent: "#ffb36b" }
    };
  }

  if (key.includes("horror") || key.includes("dark")) {
    return {
      colorMood: "crimson shadow",
      gradient: { from: "#09070d", to: "#240f19", accent: "#d64d5f" }
    };
  }

  if (key.includes("mysterious") || key.includes("mystery")) {
    return {
      colorMood: "teal noir",
      gradient: { from: "#071118", to: "#16323e", accent: "#63ffe1" }
    };
  }

  if (key.includes("tense") || key.includes("suspense")) {
    return {
      colorMood: "electric indigo",
      gradient: { from: "#0b0f21", to: "#1f2450", accent: "#7ea2ff" }
    };
  }

  if (key.includes("joyful") || key.includes("calm")) {
    return {
      colorMood: "soft aurora",
      gradient: { from: "#08151b", to: "#20434f", accent: "#9de7d7" }
    };
  }

  return {
    colorMood: "studio graphite",
    gradient: { from: "#0b1017", to: "#1b2631", accent: "#9ec1ff" }
  };
}

function computeTextStrength(text: string | null | undefined) {
  if (!text?.trim()) {
    return 0;
  }

  const tokens = toTokens([text]);
  let score = clamp(tokens.length * 6, 10, 80);

  if (/[!?]/.test(text)) {
    score += 8;
  }

  if (text.length >= 80) {
    score += 10;
  }

  return clamp(score, 0, 100);
}

function inferWeakVisual(
  scene: HybridSceneInput,
  availableAssets: HybridAssetInput[],
  repeatedAssetIds: Set<string>
) {
  if (!scene.assetId) {
    return true;
  }

  const asset = scene.asset ?? availableAssets.find((entry) => entry.id === scene.assetId);

  if (!asset) {
    return true;
  }

  const weakCategory = ["REFERENCE", "BACKGROUND"].includes(asset.category);
  const weakProvider =
    asset.sourceProvider === "hybrid-visual-engine" ||
    asset.sourceProvider === "generated-local";

  return weakCategory || weakProvider || repeatedAssetIds.has(asset.id);
}

function buildCharacterPromptFragments(
  characterProfile?: HybridCharacterProfile | null
) {
  if (!characterProfile) {
    return [];
  }

  return uniqueStrings([
    characterProfile.description ?? null,
    characterProfile.basePrompt ?? null,
    characterProfile.styleNotes ?? null,
    characterProfile.defaultVisualStyle ?? null,
    ...(characterProfile.tags ?? [])
  ]);
}

export function getVisualSourceModes(): VisualSourceModeDescriptor[] {
  return [
    {
      id: "asset_only",
      name: "Asset Only",
      description: "Usa apenas asset existente, sem geracao local."
    },
    {
      id: "generated_only",
      name: "Generated Only",
      description: "Prioriza visual gerado quando a cena precisa de apoio total."
    },
    {
      id: "hybrid_overlay",
      name: "Hybrid Overlay",
      description: "Mantem o asset base e prepara camada gerada para reforco visual."
    },
    {
      id: "fallback_generated",
      name: "Fallback Generated",
      description: "Gera placeholder quando a cena nao possui asset visual suficiente."
    },
    {
      id: "mixed_sequence",
      name: "Mixed Sequence",
      description: "Alterna asset existente com material gerado para reduzir repeticao."
    }
  ];
}

export function getGenerationProviders(): VisualGenerationProviderDescriptor[] {
  return [
    {
      id: "mock-svg",
      name: "Mock SVG",
      configured: true,
      available: true,
      message: "Deterministic local mock provider ready.",
      requiresLocalServer: false,
      baseUrl: null,
      kind: "local",
      description: "Gera SVG vertical local para preview e planejamento sem IA."
    },
    {
      id: "manual",
      name: "Manual",
      configured: true,
      available: true,
      message: "Creates a manual placeholder job without local generation.",
      requiresLocalServer: false,
      baseUrl: null,
      kind: "manual",
      description: "Cria job para associacao manual posterior."
    },
    {
      id: "comfyui-local",
      name: "ComfyUI Local",
      configured: false,
      available: false,
      message: "Optional local provider. Enable COMFYUI_ENABLED=true to activate.",
      requiresLocalServer: true,
      baseUrl: "http://127.0.0.1:8188",
      kind: "local",
      description: "Provider local opcional para workflow/prompt via ComfyUI."
    },
    {
      id: "stable-diffusion-local",
      name: "Stable Diffusion Local",
      configured: false,
      available: false,
      message: "Stub reservado para integracao local futura.",
      requiresLocalServer: true,
      baseUrl: null,
      kind: "stub",
      description: "Stub preparado para provider local futuro."
    },
    {
      id: "other",
      name: "Other",
      configured: false,
      available: false,
      message: "Placeholder reservado para provedores experimentais.",
      requiresLocalServer: false,
      baseUrl: null,
      kind: "stub",
      description: "Canal generico para provedores locais futuros."
    }
  ];
}

export function buildVisualPromptForScene(
  scene: HybridSceneInput,
  project: HybridProjectInput,
  channel?: HybridChannelInput | null,
  characterProfile?: HybridCharacterProfile | null,
  options: VisualPromptBuildOptions = {}
): VisualPromptResult {
  const tokens = uniqueStrings([
    ...toTokens([
      scene.title,
      options.includeNarration === false ? null : scene.narrationText ?? null,
      options.includeCaption === false ? null : scene.captionText ?? null,
      scene.emotion ?? null,
      scene.visualPreset ?? null,
      channel?.visualStyle ?? null,
      channel?.narrativeTone ?? null,
      options.visualStyle ?? null
    ]),
    ...(channel?.preferredAssetTags ?? []),
    ...(options.supportTags ?? []),
    ...(characterProfile?.tags ?? [])
  ]).slice(0, 18);

  const subject = uniqueStrings([
    scene.title,
    scene.narrationText ?? null,
    scene.captionText ?? null
  ])
    .join(". ")
    .trim();
  const characterFragments = buildCharacterPromptFragments(characterProfile);
  const visualDirection = uniqueStrings([
    options.visualStyle ?? null,
    channel?.visualStyle ?? null,
    scene.visualPreset ?? null,
    scene.emotion ?? null,
    ...characterFragments
  ]).join(", ");

  const prompt = [
    "Vertical cinematic key art for a short-form scene.",
    subject ? `Scene idea: ${summarizePrompt(subject, 180)}.` : null,
    visualDirection ? `Visual direction: ${visualDirection}.` : null,
    channel?.narrativeTone
      ? `Narrative tone: ${channel.narrativeTone}.`
      : null,
    tokens.length > 0 ? `Keywords: ${tokens.join(", ")}.` : null,
    project.title ? `Project context: ${project.title}.` : null
  ]
    .filter((entry): entry is string => Boolean(entry))
    .join(" ");

  return {
    prompt,
    tokens,
    summary: summarizePrompt(prompt, 140)
  };
}

export function buildNegativePrompt(
  characterProfile?: HybridCharacterProfile | null,
  channel?: HybridChannelInput | null,
  options: { extras?: string[] } = {}
) {
  const tokens = uniqueStrings([
    "low detail",
    "washed colors",
    "watermark",
    "brand logo",
    "tiny unreadable text",
    "distorted anatomy",
    "duplicate limbs",
    characterProfile?.negativePrompt ?? null,
    channel?.visualStyle?.includes("clean") ? "chaotic clutter" : null,
    ...(options.extras ?? [])
  ]);

  return tokens.join(", ");
}

export function buildVisualRecipe(
  scene: HybridSceneInput,
  prompt: string,
  characterProfile?: HybridCharacterProfile | null,
  options: { mode?: VisualSourceMode | null } = {}
): VisualRecipe {
  const mode =
    options.mode ??
    scene.visualSourceMode ??
    (scene.assetId ? "hybrid_overlay" : "fallback_generated");
  const palette = mapColorMood(scene.emotion, scene.visualPreset);
  const tags = uniqueStrings([
    ...toTokens([scene.title, scene.narrationText ?? null, scene.captionText ?? null]),
    ...(characterProfile?.tags ?? [])
  ]).slice(0, 10);

  return {
    mode,
    sceneTitle: scene.title,
    headline: summarizePrompt(prompt, 72),
    colorMood: palette.colorMood,
    abstractShapes:
      scene.emotion === "EPIC"
        ? ["angular shards", "glow streak", "radial flare"]
        : scene.emotion === "MYSTERIOUS"
          ? ["soft fog", "signal grid", "shadow columns"]
          : ["cinematic blocks", "grain veil", "accent lines"],
    typographyStyle:
      scene.visualPreset === "horror" ? "condensed whisper" : "editorial bold",
    gradient: palette.gradient,
    overlays:
      mode === "hybrid_overlay"
        ? ["overlay frame", "depth haze"]
        : mode === "mixed_sequence"
          ? ["sequence marker", "split highlight"]
          : ["light texture"],
    tags
  };
}

export function analyzeSceneVisualNeed(
  scene: HybridSceneInput,
  assets: HybridAssetInput[],
  channel?: HybridChannelInput | null
): SceneVisualNeedAnalysis {
  const repeatedAssetIds = new Set<string>();
  const assetCounts = new Map<string, number>();

  assets.forEach((asset) => {
    assetCounts.set(asset.id, (assetCounts.get(asset.id) ?? 0) + 1);
  });

  if (scene.assetId && (assetCounts.get(scene.assetId) ?? 0) > 1) {
    repeatedAssetIds.add(scene.assetId);
  }

  const captionStrength = computeTextStrength(scene.captionText);
  const narrationStrength = computeTextStrength(scene.narrationText);
  const weakVisual = inferWeakVisual(scene, assets, repeatedAssetIds);
  const usesRepeatedAsset = Boolean(
    scene.assetId && repeatedAssetIds.has(scene.assetId)
  );
  const reasons: string[] = [];
  let score = weakVisual ? 68 : 24;

  if (!scene.assetId) {
    score += 24;
    reasons.push("scene without asset");
  }

  if (usesRepeatedAsset) {
    score += 16;
    reasons.push("repeated asset on timeline");
  }

  if (weakVisual) {
    reasons.push("current visual is weak for the scene weight");
  }

  if (captionStrength >= 55 || narrationStrength >= 60) {
    score += 10;
    reasons.push("text beats are strong enough to justify custom support visual");
  }

  if (channel?.preferredAssetTags?.length) {
    score += 4;
  }

  const suggestedVisualSourceMode = suggestVisualSourceMode(scene, assets, []);
  const priority =
    score >= 80 ? "high" : score >= 55 ? "medium" : "low";

  return {
    sceneId: scene.id,
    order: scene.order,
    title: scene.title,
    hasAsset: Boolean(scene.assetId),
    usesRepeatedAsset,
    weakVisual,
    captionStrength,
    narrationStrength,
    score: clamp(Math.round(score), 0, 100),
    reasons,
    suggestedVisualSourceMode,
    suggestedTags: uniqueStrings([
      ...toTokens([scene.title, scene.captionText ?? null, scene.narrationText ?? null]),
      ...(channel?.preferredAssetTags ?? [])
    ]).slice(0, 8),
    priority,
    readyForGeneration:
      suggestedVisualSourceMode !== "asset_only" &&
      (captionStrength > 0 || narrationStrength > 0 || !scene.assetId)
  };
}

export function suggestVisualSourceMode(
  scene: HybridSceneInput,
  availableAssets: HybridAssetInput[],
  characterProfiles: HybridCharacterProfile[]
): VisualSourceMode {
  const hasCharacterProfile = Boolean(
    scene.characterProfileId &&
      characterProfiles.some((profile) => profile.id === scene.characterProfileId)
  );
  const currentAsset =
    scene.asset ?? availableAssets.find((asset) => asset.id === scene.assetId);
  const repeatedLike = Boolean(
    currentAsset && currentAsset.sourceProvider === "hybrid-visual-engine"
  );

  if (!scene.assetId) {
    return hasCharacterProfile ? "generated_only" : "fallback_generated";
  }

  if (scene.visualPrompt?.trim()) {
    return "hybrid_overlay";
  }

  if (repeatedLike) {
    return "mixed_sequence";
  }

  if (currentAsset?.category === "REFERENCE" || currentAsset?.category === "BACKGROUND") {
    return "hybrid_overlay";
  }

  return "asset_only";
}

export function selectCharacterReferences(
  characterProfile: HybridCharacterProfile | null | undefined,
  limit = 3
) {
  if (!characterProfile?.references?.length) {
    return [];
  }

  return [...characterProfile.references]
    .sort((left, right) => (right.strength ?? 0.75) - (left.strength ?? 0.75))
    .slice(0, Math.max(1, limit));
}

export function buildMissingVisualReport(
  project: HybridProjectInput,
  scenes: HybridSceneInput[],
  assets: HybridAssetInput[],
  channel?: HybridChannelInput | null,
  characterProfiles: HybridCharacterProfile[] = []
): MissingVisualReport {
  const assetUsageCount = new Map<string, number>();

  scenes.forEach((scene) => {
    if (scene.assetId) {
      assetUsageCount.set(scene.assetId, (assetUsageCount.get(scene.assetId) ?? 0) + 1);
    }
  });

  const items = scenes
    .slice()
    .sort((left, right) => left.order - right.order)
    .map((scene) => {
      const currentAsset =
        scene.asset ?? assets.find((asset) => asset.id === scene.assetId) ?? null;
      const characterProfile =
        characterProfiles.find((entry) => entry.id === scene.characterProfileId) ?? null;
      const analysis = analyzeSceneVisualNeed(scene, assets, channel);
      const promptResult = buildVisualPromptForScene(
        scene,
        project,
        channel,
        characterProfile,
        { supportTags: analysis.suggestedTags }
      );
      const negativePrompt = buildNegativePrompt(characterProfile, channel);

      return {
        ...analysis,
        usesRepeatedAsset: Boolean(
          scene.assetId && (assetUsageCount.get(scene.assetId) ?? 0) > 1
        ),
        currentAssetId: scene.assetId ?? null,
        currentAsset,
        suggestedPrompt: promptResult.prompt,
        suggestedNegativePrompt: negativePrompt || null,
        suggestedCharacterProfileId: characterProfile?.id ?? null
      } satisfies MissingVisualSceneReport;
    });

  return {
    projectId: project.id,
    totalScenes: scenes.length,
    scenesWithoutAsset: items.filter((item) => !item.hasAsset).length,
    scenesWithWeakVisual: items.filter((item) => item.weakVisual).length,
    scenesWithRepeatedAssets: items.filter((item) => item.usesRepeatedAsset).length,
    readyForGeneration: items.some((item) => item.readyForGeneration),
    items
  };
}

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function buildSvgLineBreaks(value: string, maxChars = 28) {
  const words = value.split(/\s+/g);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;

    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }

  if (current) {
    lines.push(current);
  }

  return lines.slice(0, 4);
}

export function createMockGeneratedVisualSvg(
  input: MockGeneratedVisualInput
) {
  const width = input.width ?? 1080;
  const height = input.height ?? 1920;
  const palette = mapColorMood(input.emotion, input.visualPreset);
  const promptSummary = summarizePrompt(input.prompt, 120);
  const titleLines = buildSvgLineBreaks(input.sceneTitle, 20);
  const promptLines = buildSvgLineBreaks(promptSummary, 38);
  const seedLabel =
    typeof input.seed === "number" && Number.isFinite(input.seed)
      ? String(input.seed)
      : "auto";
  const accentX = 120 + ((input.seed ?? input.jobId.length * 37) % 420);
  const accentY = 240 + ((input.seed ?? input.jobId.length * 53) % 760);
  const characterBadge = input.characterProfile
    ? escapeXml(input.characterProfile.slug)
    : "scene-support";

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Hybrid Visual Engine mock generated visual">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${palette.gradient.from}" />
      <stop offset="100%" stop-color="${palette.gradient.to}" />
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="30%" r="65%">
      <stop offset="0%" stop-color="${palette.gradient.accent}" stop-opacity="0.42" />
      <stop offset="100%" stop-color="${palette.gradient.accent}" stop-opacity="0" />
    </radialGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#bg)" />
  <rect x="0" y="0" width="${width}" height="${height}" fill="url(#glow)" />
  <circle cx="${accentX}" cy="${accentY}" r="220" fill="${palette.gradient.accent}" opacity="0.11" />
  <rect x="96" y="140" width="${width - 192}" height="${height - 280}" rx="46" fill="rgba(5,8,14,0.36)" stroke="rgba(255,255,255,0.12)" />
  <rect x="128" y="176" width="188" height="42" rx="21" fill="rgba(255,255,255,0.08)" />
  <text x="156" y="204" font-family="Arial, Helvetica, sans-serif" font-size="18" fill="#f5f7fb" letter-spacing="3">HYBRID VISUAL</text>
  <text x="128" y="304" font-family="Arial, Helvetica, sans-serif" font-size="28" fill="${palette.gradient.accent}" letter-spacing="2">MODE ${escapeXml(input.visualPreset ?? "auto").toUpperCase()}</text>
  ${titleLines
    .map(
      (line, index) =>
        `<text x="128" y="${396 + index * 88}" font-family="Arial, Helvetica, sans-serif" font-size="72" font-weight="700" fill="#ffffff">${escapeXml(line)}</text>`
    )
    .join("\n  ")}
  <rect x="128" y="${height - 710}" width="${width - 256}" height="2" fill="rgba(255,255,255,0.12)" />
  ${promptLines
    .map(
      (line, index) =>
        `<text x="128" y="${height - 620 + index * 48}" font-family="Arial, Helvetica, sans-serif" font-size="28" fill="#d6dde9" opacity="0.92">${escapeXml(line)}</text>`
    )
    .join("\n  ")}
  <rect x="128" y="${height - 250}" width="${width - 256}" height="92" rx="24" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.08)" />
  <text x="160" y="${height - 194}" font-family="Arial, Helvetica, sans-serif" font-size="24" fill="#ffffff">emotion ${escapeXml((input.emotion ?? "neutral").toLowerCase())}</text>
  <text x="${width - 400}" y="${height - 194}" font-family="Arial, Helvetica, sans-serif" font-size="24" fill="#ffffff">seed ${escapeXml(seedLabel)}</text>
  <text x="160" y="${height - 154}" font-family="Arial, Helvetica, sans-serif" font-size="21" fill="${palette.gradient.accent}">character ${characterBadge}</text>
  <rect x="${width - 260}" y="184" width="88" height="88" rx="24" fill="rgba(255,255,255,0.08)" />
  <rect x="${width - 348}" y="228" width="156" height="12" rx="6" fill="${palette.gradient.accent}" opacity="0.75" />
  <rect x="${width - 348}" y="256" width="188" height="12" rx="6" fill="#ffffff" opacity="0.18" />
</svg>`;
}

export function createGeneratedAssetMetadata(
  job: Pick<VisualGenerationJobSummaryInput, "id" | "sceneId" | "videoProjectId">,
  outputPath: string,
  options: {
    debugSvgPath: string;
    width?: number;
    height?: number;
  }
): GeneratedAssetMetadata {
  const filename = outputPath.split(/[\\/]/).at(-1) ?? `${job.id}.png`;
  const width = options.width ?? 1080;
  const height = options.height ?? 1920;

  return {
    filename,
    originalName: `generated-${job.sceneId ?? job.id}-render-ready.png`,
    path: outputPath.replaceAll("\\", "/"),
    type: "IMAGE",
    category: "GENERATED",
    mimeType: "image/png",
    extension: ".png",
    width,
    height,
    sourceProvider: "hybrid-visual-engine",
    debugSvgPath: options.debugSvgPath.replaceAll("\\", "/"),
    previewType: "png",
    renderReady: true,
    usageNotes: `Generated locally for job ${job.id} on scene ${job.sceneId ?? "n/a"} in project ${job.videoProjectId ?? "n/a"}.`
  };
}

export function summarizeVisualGenerationJob(
  job: VisualGenerationJobSummaryInput
) {
  if (job.status === "failed") {
    return `Job ${job.id} falhou em ${job.provider}: ${job.errorMessage ?? "erro nao informado"}`;
  }

  if (job.status === "completed") {
    return `Job ${job.id} concluiu com ${job.provider} e gerou ${job.generatedAssetId ?? "asset pendente"}.`;
  }

  if (job.status === "cancelled") {
    return `Job ${job.id} foi cancelado antes da conclusao.`;
  }

  return `Job ${job.id} esta em ${job.status} com provider ${job.provider}.`;
}

