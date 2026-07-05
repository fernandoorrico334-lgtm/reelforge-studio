import { getAudioMoodPresets } from "@reelforge/audio-engine";
import { getCaptionStyles } from "@reelforge/caption-engine";
import {
  buildBeatSyncPlan,
  getMusicPresetById,
  getMusicPresets,
  selectMusicForReel
} from "@reelforge/audio-engine";
import {
  buildEditingStyleSummaryFromPreset,
  getEditingReferencePresetCatalog,
  suggestReferencePresetsForTemplate
} from "@reelforge/editing-reference-engine";
import {
  getNegativePromptPacks,
  getVisualPromptPacks
} from "@reelforge/prompt-engine";
import {
  generateReelsFactoryPreview,
  getReelsFactoryTemplates
} from "@reelforge/story-engine/reels-factory";
import { getTemplates } from "@reelforge/templates";
import {
  mockAssets,
  mockChannels,
  mockDashboardSnapshot,
  mockProjects,
  mockResearchDossierDetails,
  mockResearchDossiers,
  mockRenderJobs
} from "./mock-studio-data";
import {
  buildLocalProductionChecklist,
  buildLocalProjectAssetSuggestions,
  createLocalProductionFromScript
} from "./production-flow";
import { buildProjectStoryAnalysis } from "./project-story-analysis";
import {
  buildLocalProjectCaptionAnalysis,
  buildLocalAudioPlan,
  buildLocalRenderBlueprint
} from "./project-video-blueprint";
import type {
  ProductionDiscoveryCreatePayload,
  DiscoveryProviderActivationStatus,
  DiscoverySearchPayload,
  DiscoverySearchResponse,
  ProductionDiscoveryNicheProfile,
  ProductionDiscoveryPackage,
  ProductionDiscoveryProvider,
  ProductionDiscoverySourcePack
} from "./production-discovery-types";
import type {
  AudioMoodPresetSummary,
  ApplyChannelDefaultsResponse,
  AssetPayload,
  CaptionStyleSummary,
  CharacterCreateFromIntakeResponse,
  CharacterProfile,
  CharacterProfilePayload,
  CharacterReference,
  CharacterReferencePayload,
  ChannelPayload,
  ComfyWorkflowPack,
  ComfyWorkflowValidationResult,
  ComfyUiProviderStatus,
  CreateProductionFromScriptPayload,
  CreateProductionFromScriptResponse,
  CreateRenderJobPayload,
  DashboardSnapshot,
  DataSource,
  BuildBeatSyncPlanResponse,
  EditorialMicroclip,
  EditorialMicroclipPayload,
  EditingReference,
  EditingReferenceAnalysisResponse,
  EditingReferencePreset,
  EditingReferenceSuggestion,
  BuildEditingReferencePresetResponse,
  GenerateMissingVisualsPayload,
  GenerateMissingVisualsResponse,
  GeneratedAudioGalleryItem,
  GeneratedImageGalleryFilters,
  GeneratedImageGalleryItem,
  GeneratedNarrationGalleryFilters,
  GenerateNarrationPayload,
  GenerateNarrationResponse,
  GenerateSceneVisualResponse,
  GenerateVisualPayload,
  ImageQualityPreset,
  ImportApprovedResponse,
  IntakeCandidateFilters,
  IntakeCandidatePayload,
  IntakeCollectionDetail,
  IntakeFoldersResponse,
  ManualUrlCandidatePayload,
  MediaCandidate,
  MediaCollection,
  MediaCollectionPayload,
  MediaCollectionSearchResponse,
  MediaCollectorProviderDescriptor,
  MicroclipSelectorAnalyzePayload,
  MicroclipSelectorAnalyzeResponse,
  MicroclipSelectorApplyPayload,
  MicroclipSelectorApplyResponse,
  MusicLibraryItemRecord,
  ProjectMissingAssetCollectionsResponse,
  ProjectAssetSuggestionsResponse,
  ProjectCaptionAnalysisResponse,
  ProjectMissingVisualReport,
  ProjectAudioPlanResponse,
  ProjectPayload,
  ProjectProductionChecklistResponse,
  ProjectScene,
  ProjectStoryAnalysisResponse,
  PromptBuildResponse,
  ManualResearchSourcePayload,
  NegativePromptPack,
  NarrationJob,
  NarrationProviderDescriptor,
  NarrationVoicePack,
  OneClickProductionPayload,
  OneClickProductionResponse,
  ResearchAnalyzeResponse,
  ResearchConnectorSearchPayload,
  ResearchCreateProductionPayload,
  ResearchCreateProductionResponse,
  ResearchDossier,
  ResearchDossierCollectionsCreateResponse,
  ResearchDossierDetail,
  ResearchDossierPayload,
  ResearchFetchUrlPayload,
  ResearchRequirementCollectionCreateResponse,
  ResearchSearchBundleResponse,
  ResearchSearchCandidatesResponse,
  ResearchSource,
  ResearchSourceChecklistItem,
  ResearchSearchLinkSuggestion,
  ResearchSearchQuerySuggestion,
  ResearchSourceStatus,
  ResearchSourceType,
  ReelTemplateSummary,
  ReelsFactoryBatchPayload,
  ReelsFactoryBatchResponse,
  ReelsFactoryCreateProjectResponse,
  ReelsFactoryPreviewPayload,
  ReelsFactoryPreviewResponse,
  ReelsFactoryTemplate,
  RenderBlueprintResponse,
  ReelProductionChecklist,
  ReelProductionRun,
  ResearchRequirementPromptBuildResponse,
  ScenePayload,
  ScenePromptBuildResponse,
  SceneReorderPayload,
  SelectMusicResponse,
  SfxAssetProfile,
  SfxLibraryItemRecord,
  StudioAsset,
  StudioChannel,
  StudioProject,
  StudioRenderJob,
  UseGeneratedImageForSceneResponse,
  UseNarrationForSceneResponse,
  VisualGenerationJob,
  VisualReviewStatus,
  VisualGenerationProviderDescriptor,
  VisualPromptPack,
  VisualSourceModeDescriptor,
  WorkflowPackSuggestion
} from "./studio-types";

const defaultApiBaseUrl = "http://127.0.0.1:4000";

function resolveApiBaseUrl() {
  if (typeof window === "undefined") {
    return (
      process.env.REELFORGE_API_BASE_URL?.trim() ||
      process.env.NEXT_PUBLIC_API_BASE_URL?.trim() ||
      defaultApiBaseUrl
    );
  }

  return process.env.NEXT_PUBLIC_API_BASE_URL?.trim() || defaultApiBaseUrl;
}

const mockIntakeFolders: IntakeFoldersResponse = {
  rootPath: "storage/inbox",
  folders: [
    {
      id: "drop-images",
      label: "drop/images",
      relativePath: "storage/inbox/drop/images",
      absolutePath: "storage/inbox/drop/images"
    },
    {
      id: "drop-videos",
      label: "drop/videos",
      relativePath: "storage/inbox/drop/videos",
      absolutePath: "storage/inbox/drop/videos"
    },
    {
      id: "drop-audio",
      label: "drop/audio",
      relativePath: "storage/inbox/drop/audio",
      absolutePath: "storage/inbox/drop/audio"
    },
    {
      id: "drop-music",
      label: "drop/music",
      relativePath: "storage/inbox/drop/music",
      absolutePath: "storage/inbox/drop/music"
    },
    {
      id: "drop-sfx",
      label: "drop/sfx",
      relativePath: "storage/inbox/drop/sfx",
      absolutePath: "storage/inbox/drop/sfx"
    },
    {
      id: "characters",
      label: "characters",
      relativePath: "storage/inbox/characters",
      absolutePath: "storage/inbox/characters"
    },
    {
      id: "projects",
      label: "projects",
      relativePath: "storage/inbox/projects",
      absolutePath: "storage/inbox/projects"
    }
  ]
};

const mockMediaCollectorProviders: MediaCollectorProviderDescriptor[] = [
  {
    id: "manual-url",
    name: "Manual URL",
    description: "URLs diretas e caminhos locais revisados manualmente.",
    requiresApiKey: false,
    apiKeyEnv: null,
    configured: true,
    experimental: false,
    supportedMediaTypes: [
      "image",
      "video",
      "audio",
      "music",
      "sfx",
      "overlay",
      "document",
      "reference"
    ]
  },
  {
    id: "wikimedia-commons",
    name: "Wikimedia Commons",
    description: "Busca assistida em acervo publico da Wikimedia Commons.",
    requiresApiKey: false,
    apiKeyEnv: null,
    configured: true,
    experimental: false,
    supportedMediaTypes: ["image", "overlay", "reference"]
  },
  {
    id: "nasa-media",
    name: "NASA Media",
    description: "Busca assistida em acervo oficial publico da NASA.",
    requiresApiKey: false,
    apiKeyEnv: null,
    configured: true,
    experimental: false,
    supportedMediaTypes: ["image", "video", "reference"]
  },
  {
    id: "internet-archive",
    name: "Internet Archive",
    description: "Provider experimental para busca documental e visual publica.",
    requiresApiKey: false,
    apiKeyEnv: null,
    configured: true,
    experimental: true,
    supportedMediaTypes: ["image", "document", "reference"]
  },
  {
    id: "pexels",
    name: "Pexels",
    description: "API oficial com key opcional para fotos e videos.",
    requiresApiKey: true,
    apiKeyEnv: "PEXELS_API_KEY",
    configured: false,
    experimental: false,
    supportedMediaTypes: ["image", "video", "reference"]
  },
  {
    id: "pixabay",
    name: "Pixabay",
    description: "API oficial com key opcional para fotos e videos.",
    requiresApiKey: true,
    apiKeyEnv: "PIXABAY_API_KEY",
    configured: false,
    experimental: false,
    supportedMediaTypes: ["image", "video", "reference"]
  },
  {
    id: "unsplash",
    name: "Unsplash",
    description: "API oficial com access key opcional para imagens.",
    requiresApiKey: true,
    apiKeyEnv: "UNSPLASH_ACCESS_KEY",
    configured: false,
    experimental: false,
    supportedMediaTypes: ["image", "reference"]
  }
];

const mockVisualSourceModes: VisualSourceModeDescriptor[] = [
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

const mockVisualGenerationProviders: VisualGenerationProviderDescriptor[] = [
  {
    id: "mock-svg",
    name: "Mock SVG",
    configured: true,
    available: true,
    message: "Deterministic mock provider ready for local previews.",
    requiresLocalServer: false,
    baseUrl: null,
    kind: "local",
    description:
      "Gera SVG de debug e PNG render-ready local para preview e pipeline sem IA."
  },
  {
    id: "manual",
    name: "Manual",
    configured: true,
    available: true,
    message: "Manual placeholder flow available.",
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
    message: "ComfyUI provider disabled. Enable COMFYUI_ENABLED=true.",
    requiresLocalServer: true,
    baseUrl: "http://127.0.0.1:8188",
    kind: "local",
    description: "Provider local opcional para prompts/workflows via ComfyUI."
  },
  {
    id: "stable-diffusion-local",
    name: "Stable Diffusion Local",
    configured: false,
    available: false,
    message: "Stub local provider reservado para evolucao futura.",
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

const mockComfyUiProviderStatus: ComfyUiProviderStatus = {
  enabled: false,
  baseUrl: "http://127.0.0.1:8188",
  reachable: false,
  message: "ComfyUI provider disabled. Enable COMFYUI_ENABLED=true.",
  workflowTemplate: "txt2img-basic",
  configuredWorkflow: "txt2img-basic",
  timeoutMs: 300000,
  info: null,
  serverInfo: null,
  queueStatus: null,
  historyEndpointReachable: false,
  promptEndpointReachable: false,
  viewEndpointReachable: false,
  workflowTemplateExists: true,
  workflowTemplateValid: true,
  workflowTemplatePath:
    "packages/hybrid-visual-engine/workflows/comfyui/txt2img-basic.json",
  workflowOrigin: "package-default",
  workflowWarnings: [],
  placeholdersFound: [
    "{{PROMPT}}",
    "{{NEGATIVE_PROMPT}}",
    "{{WIDTH}}",
    "{{HEIGHT}}",
    "{{SEED}}"
  ],
  missingPlaceholders: [],
  state: "disabled"
};

const mockComfyWorkflowPacks: ComfyWorkflowPack[] = [
  ["anime_dark", "Anime Dark", "anime lore", "clean_anime"],
  ["comic_drama", "Comic Drama", "comics", "clean_comic"],
  ["true_crime_doc", "True Crime Doc", "true crime", "clean_photoreal"],
  ["mystery_doc", "Mystery Doc", "mystery", "clean_dark_cinematic"],
  ["history_dark", "History Dark", "history", "clean_history"],
  ["sports_hype", "Sports Hype", "sports", "clean_sports"],
  ["game_epic", "Game Epic", "gaming", "clean_dark_cinematic"],
  ["cinematic_story", "Cinematic Story", "cinematic storytelling", "clean_dark_cinematic"],
  ["horror_tension", "Horror Tension", "horror", "clean_dark_cinematic"],
  ["documentary_clean", "Documentary Clean", "documentary", "clean_documentary"]
].map(([id, name, niche, negativePack]) => ({
  id,
  name,
  description: `${name} workflow pack for local ComfyUI generation.`,
  niche,
  recommendedWorkflowId: "txt2img-basic",
  recommendedPromptPackId: id,
  recommendedNegativePromptPackId: negativePack,
  defaultWidth: 1080,
  defaultHeight: 1920,
  defaultSeedStrategy: id === "sports_hype" || id === "horror_tension" ? "random" : "reuse",
  defaultQualityPreset: id === "game_epic" ? "high" : id === "sports_hype" ? "draft" : "standard",
  styleNotes: `Fallback local notes for ${name}. API local provides the canonical pack.`,
  cameraNotes: "Vertical cinematic framing with caption-safe composition.",
  lightingNotes: "Controlled contrast and readable subject separation.",
  compositionNotes: "Single strong focal point in 9:16.",
  recommendedUse: `Use for ${niche} scenes when API catalog is unavailable.`,
  limitations: "Fallback UI catalog only; generation rules live in the API/package.",
  supportsReferences: true,
  supportsImageToImage: true,
  providerCompatibility: ["mock-svg", "mock-png", "comfyui-local"]
})) as ComfyWorkflowPack[];

const mockImageQualityPresets: ImageQualityPreset[] = [
  {
    id: "draft",
    name: "Draft",
    description: "Fast prompt validation.",
    width: 720,
    height: 1280,
    steps: 12,
    cfg: 2.2,
    sampler: "res_multistep",
    scheduler: "simple",
    denoise: 0.8,
    seedMode: "random",
    timeoutMs: 180000,
    recommendedUse: "Prompt and workflow iteration."
  },
  {
    id: "standard",
    name: "Standard",
    description: "Render-ready 9:16 baseline.",
    width: 1080,
    height: 1920,
    steps: 20,
    cfg: 2.8,
    sampler: "res_multistep",
    scheduler: "simple",
    denoise: 0.75,
    seedMode: "reuse",
    timeoutMs: 300000,
    recommendedUse: "Default local ComfyUI generation."
  },
  {
    id: "high",
    name: "High",
    description: "Higher patience for hero frames.",
    width: 1080,
    height: 1920,
    steps: 30,
    cfg: 3.4,
    sampler: "res_multistep",
    scheduler: "simple",
    denoise: 0.68,
    seedMode: "reuse",
    timeoutMs: 480000,
    recommendedUse: "Climax and hero scenes."
  }
];

const mockNarrationProviders: NarrationProviderDescriptor[] = [
  {
    id: "mock-tts",
    name: "Mock TTS",
    description: "Provider offline deterministico para validar pipeline local.",
    available: true,
    enabled: true,
    requiresWindows: false,
    offline: true,
    status: "ready",
    reason: null
  },
  {
    id: "windows-sapi-local",
    name: "Windows SAPI Local",
    description: "Provider opcional usando a voz instalada no Windows.",
    available: false,
    enabled: false,
    requiresWindows: true,
    offline: true,
    status: "disabled",
    reason: "Habilite NARRATION_WINDOWS_SAPI_ENABLED=true na API local."
  }
];

const mockNarrationVoicePacks: NarrationVoicePack[] = [
  {
    id: "narrator_clean_ptbr",
    name: "Narrador Clean PT-BR",
    description: "Locucao limpa e neutra para explicacoes diretas.",
    language: "pt-BR",
    tone: "clean",
    rate: -1,
    pitch: null,
    volume: 90,
    recommendedUse: "Explicacoes gerais, demos e cortes informativos.",
    safetyNotes: "Nao representa voz real especifica."
  },
  {
    id: "documentary_ptbr",
    name: "Documentary PT-BR",
    description: "Cadencia documental mais pausada para contexto e fatos.",
    language: "pt-BR",
    tone: "documentary",
    rate: -2,
    pitch: null,
    volume: 92,
    recommendedUse: "Docu-style, lore e explicacoes investigativas.",
    safetyNotes: "Mantem timbre generico e neutro."
  },
  {
    id: "true_crime_dark_ptbr",
    name: "True Crime Dark PT-BR",
    description: "Cadencia densa para misterio e narrativas sombrias.",
    language: "pt-BR",
    tone: "dark",
    rate: -3,
    pitch: -1,
    volume: 94,
    recommendedUse: "True crime, horror leve e suspense documental.",
    safetyNotes: "Nao imita narradores reconheciveis."
  },
  {
    id: "story_epic_ptbr",
    name: "Story Epic PT-BR",
    description: "Ritmo mais energico para viradas e revelacoes.",
    language: "pt-BR",
    tone: "epic",
    rate: 0,
    pitch: 1,
    volume: 96,
    recommendedUse: "Lore heroico, games e storytelling com energia.",
    safetyNotes: "Uso generico, sem personagem real."
  },
  {
    id: "sports_hype_ptbr",
    name: "Sports Hype PT-BR",
    description: "Ataque mais rapido para highlights e hype.",
    language: "pt-BR",
    tone: "hype",
    rate: 1,
    pitch: 1,
    volume: 96,
    recommendedUse: "Clipes esportivos, chamadas e energia alta.",
    safetyNotes: "Evita assinatura vocal de apresentadores reais."
  },
  {
    id: "calm_explainer_ptbr",
    name: "Calm Explainer PT-BR",
    description: "Narracao suave para fluxo calmo e didatico.",
    language: "pt-BR",
    tone: "calm",
    rate: -2,
    pitch: null,
    volume: 88,
    recommendedUse: "Explicadores, historia e contexto longo.",
    safetyNotes: "Timbre abstrato e generico."
  }
];

function buildApiUrl(path: string) {
  return `${resolveApiBaseUrl().replace(/\/$/, "")}${path}`;
}

function buildQueryString(filters: Record<string, string | undefined>) {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(filters)) {
    if (value?.trim()) {
      searchParams.set(key, value);
    }
  }

  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

function cloneValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }

  return String(error);
}

function logServerFallback(scope: string, error: unknown) {
  if (typeof window !== "undefined") {
    return;
  }

  console.warn(
    `[studio-api] Fallback to mock for ${scope}: ${getErrorMessage(error)}`
  );
}

async function readErrorMessage(response: Response) {
  try {
    const bodyText = await response.text();

    if (!bodyText.trim()) {
      return `Request failed with status ${response.status}.`;
    }

    try {
      const body = JSON.parse(bodyText) as { error?: string };

      if (typeof body.error === "string" && body.error.trim()) {
        return body.error.trim();
      }
    } catch {
      return bodyText.trim();
    }
  } catch {
    return `Request failed with status ${response.status}.`;
  }

  return `Request failed with status ${response.status}.`;
}

function findMockProject(id: string) {
  return mockProjects.find((project) => project.id === id) ?? null;
}

function findMockResearchDossier(id: string) {
  return mockResearchDossiers.find((dossier) => dossier.id === id) ?? null;
}

function findMockResearchDetail(id: string) {
  return (
    mockResearchDossierDetails.find((detail) => detail.dossier.id === id) ?? null
  );
}

function buildMusicLibrarySummary(asset: StudioAsset) {
  const profile = asset.musicProfile ?? null;

  if (!profile) {
    return `Perfil pendente para ${asset.filename}`;
  }

  const bpmLabel =
    typeof profile.bpm === "number" && Number.isFinite(profile.bpm)
      ? `${Math.round(profile.bpm)} BPM`
      : "BPM n/d";

  return [
    profile.mood,
    profile.genre,
    profile.energy,
    profile.useCase,
    bpmLabel
  ].join(" / ");
}

function buildMockMusicLibraryItems(): MusicLibraryItemRecord[] {
  return cloneValue(
    mockAssets
      .filter(
        (asset) =>
          asset.type === "MUSIC" ||
          (asset.type === "AUDIO" && Boolean(asset.musicProfile))
      )
      .map((asset) => ({
        asset,
        profile: asset.musicProfile ?? null,
        status: asset.musicProfile ? ("profiled" as const) : ("pending" as const),
        summary: buildMusicLibrarySummary(asset),
        warnings: asset.musicProfile?.safetyWarning
          ? [asset.musicProfile.safetyWarning]
          : asset.musicProfile
            ? []
            : ["Asset sem perfil musical detalhado."]
      }))
      .sort((left, right) =>
        right.asset.updatedAt.localeCompare(left.asset.updatedAt)
      )
  );
}

function buildMockSfxLibraryItems(): SfxLibraryItemRecord[] {
  return cloneValue(
    mockAssets
      .filter(
        (asset) =>
          asset.type === "SFX" ||
          (asset.type === "AUDIO" && Boolean(asset.sfxProfile))
      )
      .map((asset) => ({
        asset,
        profile: asset.sfxProfile ?? null,
        status: asset.sfxProfile ? ("profiled" as const) : ("pending" as const),
        warnings: asset.sfxProfile ? [] : ["Asset sem perfil de SFX detalhado."]
      }))
      .sort((left, right) =>
        right.asset.updatedAt.localeCompare(left.asset.updatedAt)
      )
  );
}

function buildMockEditingReferences(): EditingReference[] {
  const darkVideo =
    mockAssets.find((asset) => asset.id === "asset-dark-001") ??
    mockAssets.find((asset) => asset.type === "VIDEO") ??
    null;

  return cloneValue([
    {
      id: "editing-reference-aurora",
      title: "Aurora Case Editorial Cut",
      description:
        "Referencia local para documentario sombrio com cortes curtos, captions limpas e narrativa investigativa.",
      assetId: darkVideo?.id ?? null,
      asset: darkVideo,
      localPath: "storage/references/true-crime/aurora-case-cut.mp4",
      sourceType: "asset_library",
      category: "true_crime",
      status: "preset_ready",
      durationSeconds: 24.6,
      averageCutPaceSeconds: 2.8,
      beatIntensity: "medium",
      pacing: "fast",
      zoomStyle: "subtle",
      flashStyle: "low",
      transitionStyle: "mixed",
      captionStyle: "lower_clean",
      narrationStyle: "documentary",
      musicStyle: "dark",
      sfxStyle: "medium",
      hookStyle: "warning",
      ctaStyle: "subtle",
      microclipPlacement: "middle",
      visualStyleNotes: "Arquivos, close lento e luz fria.",
      audioStyleNotes: "Trilha baixa com ducking controlado e hits discretos.",
      editingStyleNotes:
        "Alterna contexto com inserts curtos e deixa perguntas abertas no final.",
      analysisWarnings: [
        "Referencia mock local. O video real nao acompanha o repositorio."
      ],
      createdAt: "2026-07-03T00:00:00.000Z",
      updatedAt: "2026-07-03T00:00:00.000Z"
    },
    {
      id: "editing-reference-stadium",
      title: "Stadium Pressure Short",
      description:
        "Referencia esportiva local para cortes ritmados, flashes pontuais e microclips de impacto.",
      assetId: null,
      asset: null,
      localPath: "storage/references/football/stadium-pressure-short.mp4",
      sourceType: "local_file",
      category: "football",
      status: "analyzed",
      durationSeconds: 19.2,
      averageCutPaceSeconds: 1.7,
      beatIntensity: "high",
      pacing: "hyper",
      zoomStyle: "aggressive",
      flashStyle: "medium",
      transitionStyle: "flash_cut",
      captionStyle: "center_bold",
      narrationStyle: "hype",
      musicStyle: "hype",
      sfxStyle: "high",
      hookStyle: "explosive",
      ctaStyle: "strong",
      microclipPlacement: "climax",
      visualStyleNotes: "Punch-ins rapidos, freeze-frame e crowd overlays.",
      audioStyleNotes: "Phonk alta energia com hits e whooshes curtos.",
      editingStyleNotes:
        "Mantem bloco de pressao crescente e guarda o microclip principal para a reta final.",
      analysisWarnings: [
        "BPM e cortes representam uma estimativa curada manualmente para desenvolvimento local."
      ],
      createdAt: "2026-07-03T00:00:00.000Z",
      updatedAt: "2026-07-03T00:00:00.000Z"
    }
  ]);
}

function buildMockEditingReferencePresets(): EditingReferencePreset[] {
  const references = buildMockEditingReferences();

  return cloneValue(
    getEditingReferencePresetCatalog().map((preset, index) => ({
      ...preset,
      referenceId:
        index === 0
          ? "editing-reference-stadium"
          : index === 2
            ? "editing-reference-aurora"
            : null,
      reference:
        index === 0
          ? references.find((item) => item.id === "editing-reference-stadium") ?? null
          : index === 2
            ? references.find((item) => item.id === "editing-reference-aurora") ?? null
            : null,
      createdAt: "2026-07-03T00:00:00.000Z",
      updatedAt: "2026-07-03T00:00:00.000Z"
    }))
  );
}

function buildMockEditingReferenceSuggestions(
  templateId: string
): EditingReferenceSuggestion[] {
  const presets = buildMockEditingReferencePresets();
  const presetMap = new Map(presets.map((preset) => [preset.slug, preset] as const));

  return cloneValue(
    suggestReferencePresetsForTemplate(templateId).map((suggestion) => ({
      templateId: suggestion.templateId,
      preset: presetMap.get(suggestion.preset.slug) ?? {
        ...suggestion.preset,
        reference: null,
        createdAt: "2026-07-03T00:00:00.000Z",
        updatedAt: "2026-07-03T00:00:00.000Z"
      },
      origin: "catalog" as const,
      reason: suggestion.reason
    }))
  );
}

function resolveMockEditingStyleSummary(
  presetId: string | null | undefined
) {
  if (!presetId) {
    return null;
  }

  const presets = buildMockEditingReferencePresets();
  const preset =
    presets.find((entry) => entry.id === presetId || entry.slug === presetId) ?? null;

  return preset ? buildEditingStyleSummaryFromPreset(preset) : null;
}

function applyMockSfxProfileUpdate(
  asset: StudioAsset,
  patch: Partial<SfxAssetProfile>
): SfxLibraryItemRecord {
  const nextProfile = {
    assetId: asset.id,
    title: asset.sfxProfile?.title ?? asset.filename,
    category: asset.sfxProfile?.category ?? "transition",
    intensity: asset.sfxProfile?.intensity ?? "medium",
    durationSeconds: asset.sfxProfile?.durationSeconds ?? asset.duration ?? null,
    useCase: asset.sfxProfile?.useCase ?? "generic",
    licenseStatus: asset.sfxProfile?.licenseStatus ?? "unknown",
    notes: asset.sfxProfile?.notes ?? null,
    ...patch
  } satisfies SfxAssetProfile;

  return {
    asset: cloneValue({
      ...asset,
      sfxProfile: nextProfile
    }),
    profile: cloneValue(nextProfile),
    status: "profiled",
    warnings: []
  };
}

async function requestJson<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const headers = new Headers(init?.headers ?? {});

  if (!(init?.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(buildApiUrl(path), {
    ...init,
    cache: "no-store",
    headers
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

async function requestProjectsFromApi() {
  let primaryError: unknown;

  try {
    return await requestJson<StudioProject[]>("/video-projects");
  } catch (error) {
    primaryError = error;
  }

  try {
    return await requestJson<StudioProject[]>("/projects");
  } catch (legacyError) {
    throw new Error(
      `Primary /video-projects failed: ${getErrorMessage(primaryError)}. Legacy /projects failed: ${getErrorMessage(legacyError)}.`
    );
  }
}

export async function getChannelsSnapshot(): Promise<{
  items: StudioChannel[];
  source: DataSource;
}> {
  try {
    const items = await requestJson<StudioChannel[]>("/channels");
    return { items, source: "api" };
  } catch (error) {
    logServerFallback("channels", error);
    return { items: cloneValue(mockChannels), source: "mock" };
  }
}

export async function getAssetsSnapshot(): Promise<{
  items: StudioAsset[];
  source: DataSource;
}> {
  try {
    const items = await requestJson<StudioAsset[]>("/assets");
    return { items, source: "api" };
  } catch (error) {
    logServerFallback("assets", error);
    return { items: cloneValue(mockAssets), source: "mock" };
  }
}

export async function getProductionDiscoveryNiches() {
  return requestJson<ProductionDiscoveryNicheProfile[]>("/production-discovery/niches");
}

export async function getProductionDiscoveryProviders() {
  return requestJson<ProductionDiscoveryProvider[]>("/production-discovery/providers");
}

export async function getProductionDiscoverySourcePacks() {
  return requestJson<ProductionDiscoverySourcePack[]>("/production-discovery/source-packs");
}

export async function getDiscoveryProviderActivationStatus() {
  return requestJson<DiscoveryProviderActivationStatus[]>("/discovery/providers/status");
}

export async function runDiscoverySearchRequest(payload: DiscoverySearchPayload) {
  return requestJson<DiscoverySearchResponse>("/discovery/search", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function listProductionDiscoveryPackages() {
  return requestJson<ProductionDiscoveryPackage[]>("/production-discovery/packages");
}

export async function createProductionDiscoveryPackageRequest(
  payload: ProductionDiscoveryCreatePayload
) {
  return requestJson<ProductionDiscoveryPackage>("/production-discovery/create", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function runProductionDiscoveryResearchRequest(packageId: string) {
  return requestJson<ProductionDiscoveryPackage>(
    `/production-discovery/packages/${encodeURIComponent(packageId)}/run-research`,
    { method: "POST" }
  );
}

export async function buildProductionDiscoveryRequirementsRequest(packageId: string) {
  return requestJson<ProductionDiscoveryPackage>(
    `/production-discovery/packages/${encodeURIComponent(packageId)}/build-asset-requirements`,
    { method: "POST" }
  );
}

export async function searchProductionDiscoveryCandidatesRequest(packageId: string) {
  return requestJson<ProductionDiscoveryPackage>(
    `/production-discovery/packages/${encodeURIComponent(packageId)}/search-media-candidates`,
    { method: "POST" }
  );
}

export async function createProductionDiscoveryProjectRequest(packageId: string) {
  return requestJson<ProductionDiscoveryPackage>(
    `/production-discovery/packages/${encodeURIComponent(packageId)}/create-project`,
    { method: "POST" }
  );
}

export async function getProductionDiscoveryMediaCandidates(packageId: string) {
  return requestJson<MediaCandidate[]>(
    `/production-discovery/packages/${encodeURIComponent(packageId)}/media-candidates`
  );
}

export async function getMusicLibraryRequest(
  filters: {
    mood?: string;
    genre?: string;
    energy?: string;
    useCase?: string;
    licenseStatus?: string;
    search?: string;
  } = {}
) {
  const query = buildQueryString({
    mood: filters.mood,
    genre: filters.genre,
    energy: filters.energy,
    useCase: filters.useCase,
    licenseStatus: filters.licenseStatus,
    search: filters.search
  });

  return requestJson<MusicLibraryItemRecord[]>(`/audio/music-library${query}`);
}

export async function getMusicLibrarySnapshot(
  filters: Parameters<typeof getMusicLibraryRequest>[0] = {}
): Promise<{
  items: MusicLibraryItemRecord[];
  source: DataSource;
}> {
  try {
    const items = await getMusicLibraryRequest(filters);
    return { items, source: "api" };
  } catch (error) {
    logServerFallback("audio/music-library", error);
    return { items: buildMockMusicLibraryItems(), source: "mock" };
  }
}

export async function analyzeMusicLibraryAssetRequest(assetId: string) {
  return requestJson<MusicLibraryItemRecord>(
    `/audio/music-library/analyze/${encodeURIComponent(assetId)}`,
    {
      method: "POST",
      body: JSON.stringify({})
    }
  );
}

export async function updateMusicLibraryProfileRequest(
  assetId: string,
  payload: Partial<NonNullable<MusicLibraryItemRecord["profile"]>>
) {
  return requestJson<MusicLibraryItemRecord>(
    `/audio/music-library/${encodeURIComponent(assetId)}/profile`,
    {
      method: "PUT",
      body: JSON.stringify(payload)
    }
  );
}

export async function getSfxLibraryRequest(
  filters: {
    category?: string;
    intensity?: string;
    useCase?: string;
    licenseStatus?: string;
    search?: string;
  } = {}
) {
  const query = buildQueryString({
    category: filters.category,
    intensity: filters.intensity,
    useCase: filters.useCase,
    licenseStatus: filters.licenseStatus,
    search: filters.search
  });

  return requestJson<SfxLibraryItemRecord[]>(`/audio/sfx-library${query}`);
}

export async function getSfxLibrarySnapshot(
  filters: Parameters<typeof getSfxLibraryRequest>[0] = {}
): Promise<{
  items: SfxLibraryItemRecord[];
  source: DataSource;
}> {
  try {
    const items = await getSfxLibraryRequest(filters);
    return { items, source: "api" };
  } catch (error) {
    logServerFallback("audio/sfx-library", error);
    return { items: buildMockSfxLibraryItems(), source: "mock" };
  }
}

export async function updateSfxLibraryProfileRequest(
  assetId: string,
  payload: Partial<SfxAssetProfile>
) {
  return requestJson<SfxLibraryItemRecord>(
    `/audio/sfx-library/${encodeURIComponent(assetId)}/profile`,
    {
      method: "PUT",
      body: JSON.stringify(payload)
    }
  );
}

export async function getEditingReferencesRequest(
  filters: {
    category?: string;
    status?: string;
    sourceType?: string;
  } = {}
) {
  const query = buildQueryString({
    category: filters.category,
    status: filters.status,
    sourceType: filters.sourceType
  });

  return requestJson<EditingReference[]>(`/editing-references${query}`);
}

export async function getEditingReferencesSnapshot(
  filters: Parameters<typeof getEditingReferencesRequest>[0] = {}
): Promise<{
  items: EditingReference[];
  source: DataSource;
}> {
  try {
    const items = await getEditingReferencesRequest(filters);
    return { items, source: "api" };
  } catch (error) {
    logServerFallback("editing-references", error);
    const items = buildMockEditingReferences().filter((item) => {
      if (filters.category && item.category !== filters.category) {
        return false;
      }

      if (filters.status && item.status !== filters.status) {
        return false;
      }

      if (filters.sourceType && item.sourceType !== filters.sourceType) {
        return false;
      }

      return true;
    });
    return { items, source: "mock" };
  }
}

export async function createEditingReferenceRequest(payload: Record<string, unknown>) {
  return requestJson<EditingReference>("/editing-references", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function updateEditingReferenceRequest(
  referenceId: string,
  payload: Record<string, unknown>
) {
  return requestJson<EditingReference>(
    `/editing-references/${encodeURIComponent(referenceId)}`,
    {
      method: "PUT",
      body: JSON.stringify(payload)
    }
  );
}

export async function deleteEditingReferenceRequest(referenceId: string) {
  await requestJson<void>(`/editing-references/${encodeURIComponent(referenceId)}`, {
    method: "DELETE"
  });
}

export async function analyzeEditingReferenceRequest(referenceId: string) {
  return requestJson<EditingReferenceAnalysisResponse>(
    `/editing-references/${encodeURIComponent(referenceId)}/analyze`,
    {
      method: "POST",
      body: JSON.stringify({})
    }
  );
}

export async function buildEditingReferencePresetRequest(
  referenceId: string,
  payload: Record<string, unknown> = {}
) {
  return requestJson<BuildEditingReferencePresetResponse>(
    `/editing-references/${encodeURIComponent(referenceId)}/build-preset`,
    {
      method: "POST",
      body: JSON.stringify(payload)
    }
  );
}

export async function getEditingReferencePresetsRequest(
  filters: {
    useCase?: string;
    referenceId?: string;
    templateId?: string;
  } = {}
) {
  const query = buildQueryString({
    useCase: filters.useCase,
    referenceId: filters.referenceId,
    templateId: filters.templateId
  });

  return requestJson<EditingReferencePreset[]>(`/editing-reference-presets${query}`);
}

export async function getEditingReferencePresetsSnapshot(
  filters: Parameters<typeof getEditingReferencePresetsRequest>[0] = {}
): Promise<{
  items: EditingReferencePreset[];
  source: DataSource;
}> {
  try {
    const items = await getEditingReferencePresetsRequest(filters);
    return { items, source: "api" };
  } catch (error) {
    logServerFallback("editing-reference-presets", error);
    let items = buildMockEditingReferencePresets();

    if (filters.useCase) {
      items = items.filter((item) => item.useCase === filters.useCase);
    }

    if (filters.referenceId) {
      items = items.filter((item) => item.referenceId === filters.referenceId);
    }

    if (filters.templateId) {
      items = items.filter((item) =>
        item.recommendedTemplates.includes(filters.templateId!)
      );
    }

    return { items, source: "mock" };
  }
}

export async function createEditingReferencePresetRequest(
  payload: Record<string, unknown>
) {
  return requestJson<EditingReferencePreset>("/editing-reference-presets", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function updateEditingReferencePresetRequest(
  presetId: string,
  payload: Record<string, unknown>
) {
  return requestJson<EditingReferencePreset>(
    `/editing-reference-presets/${encodeURIComponent(presetId)}`,
    {
      method: "PUT",
      body: JSON.stringify(payload)
    }
  );
}

export async function deleteEditingReferencePresetRequest(presetId: string) {
  await requestJson<void>(
    `/editing-reference-presets/${encodeURIComponent(presetId)}`,
    {
      method: "DELETE"
    }
  );
}

export async function getEditingReferencePresetSuggestionsRequest(
  templateId: string
) {
  return requestJson<EditingReferenceSuggestion[]>(
    `/editing-reference-presets/suggestions${buildQueryString({ templateId })}`
  );
}

export async function getEditingReferencePresetSuggestionsSnapshot(
  templateId: string
): Promise<{
  items: EditingReferenceSuggestion[];
  source: DataSource;
}> {
  try {
    const items = await getEditingReferencePresetSuggestionsRequest(templateId);
    return { items, source: "api" };
  } catch (error) {
    logServerFallback(`editing-reference-presets/suggestions:${templateId}`, error);
    return {
      items: buildMockEditingReferenceSuggestions(templateId),
      source: "mock"
    };
  }
}

export async function selectMusicForProjectRequest(payload: {
  templateId?: string | null;
  musicPresetId?: string | null;
  audioMasteringPresetId?: string | null;
  tone?: string | null;
  durationSeconds: number;
  useCase?: string | null;
  allowUnknownLicense?: boolean;
}) {
  return requestJson<SelectMusicResponse>("/audio/select-music", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function selectMusicForProjectSnapshot(payload: {
  templateId?: string | null;
  musicPresetId?: string | null;
  audioMasteringPresetId?: string | null;
  tone?: string | null;
  durationSeconds: number;
  useCase?: string | null;
  allowUnknownLicense?: boolean;
}): Promise<{
  item: SelectMusicResponse;
  source: DataSource;
}> {
  try {
    const item = await selectMusicForProjectRequest(payload);
    return { item, source: "api" };
  } catch (error) {
    logServerFallback("audio/select-music", error);
    const mockMusicLibrary = buildMockMusicLibraryItems();
    const mockSfxLibrary = buildMockSfxLibraryItems();
    const result = selectMusicForReel({
      templateId: payload.templateId ?? null,
      musicPresetId: payload.musicPresetId ?? null,
      audioMasteringPresetId: payload.audioMasteringPresetId ?? null,
      tone: payload.tone ?? null,
      durationSeconds: payload.durationSeconds,
      useCase: payload.useCase ?? null,
      allowUnknownLicense: payload.allowUnknownLicense ?? false,
      musicAssets: mockMusicLibrary.flatMap((item) =>
        item.profile ? [{ asset: item.asset, profile: item.profile }] : []
      ),
      sfxAssets: mockSfxLibrary.flatMap((item) =>
        item.profile ? [{ asset: item.asset, profile: item.profile }] : []
      )
    });
    const preset =
      getMusicPresetById(payload.musicPresetId ?? null) ??
      getMusicPresetById("shorts_clean_voice") ??
      getMusicPresets()[0]!;
    const selectedMusicAsset = result.selectedMusicAsset
      ? (mockMusicLibrary.find(
          (item) => item.asset.id === result.selectedMusicAsset?.asset.id
        ) ?? null)
      : null;
    const selectedSfxAssets = result.selectedSfxAssets
      .map((item) =>
        mockSfxLibrary.find((record) => record.asset.id === item.asset.id) ?? null
      )
      .filter((item): item is SfxLibraryItemRecord => item !== null);

    return {
      item: {
        preset,
        selectedMusicAsset,
        selectedSfxAssets,
        reason: result.reason,
        warnings: result.warnings,
        confidence: result.confidence
      },
      source: "mock"
    };
  }
}

export async function getProjectBeatSyncPlanRequest(payload: {
  projectId: string;
  musicAssetId?: string | null;
  musicPresetId?: string | null;
  reelDurationSeconds?: number | null;
}) {
  return requestJson<BuildBeatSyncPlanResponse>("/audio/beat-sync-plan", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function getProjectBeatSyncPlanSnapshot(payload: {
  projectId: string;
  musicAssetId?: string | null;
  musicPresetId?: string | null;
  reelDurationSeconds?: number | null;
}): Promise<{
  item: BuildBeatSyncPlanResponse | null;
  source: DataSource;
}> {
  try {
    const item = await getProjectBeatSyncPlanRequest(payload);
    return { item, source: "api" };
  } catch (error) {
    logServerFallback("audio/beat-sync-plan", error);

    const project = findMockProject(payload.projectId);

    if (!project) {
      return { item: null, source: "mock" };
    }

    const selectedMusicAsset =
      mockAssets.find(
        (asset) =>
          asset.id === (payload.musicAssetId ?? project.backgroundMusicAssetId)
      ) ?? null;
    const reelDurationSeconds =
      payload.reelDurationSeconds ??
      project.durationTarget ??
      project.scenes.reduce((total, scene) => total + (scene.duration ?? 0), 0);
    const beatSyncPlan = buildBeatSyncPlan({
      musicAssetProfile: selectedMusicAsset?.musicProfile ?? null,
      reelDurationSeconds,
      sceneCount: project.scenes.length,
      presetId: payload.musicPresetId ?? project.musicPresetId ?? null,
      microclips: []
    });

    return {
      item: {
        projectId: project.id,
        selectedMusicAssetId: selectedMusicAsset?.id ?? null,
        selectedMusicAssetPath: selectedMusicAsset?.path ?? null,
        musicPresetId: payload.musicPresetId ?? project.musicPresetId ?? null,
        beatSyncPlan,
        warnings: beatSyncPlan.warnings
      },
      source: "mock"
    };
  }
}

export async function getCharactersSnapshot(): Promise<{
  items: CharacterProfile[];
  source: DataSource;
}> {
  try {
    const items = await requestJson<CharacterProfile[]>("/characters");
    return { items, source: "api" };
  } catch {
    return { items: [], source: "mock" };
  }
}

export async function getIntakeFoldersSnapshot(): Promise<{
  item: IntakeFoldersResponse;
  source: DataSource;
}> {
  try {
    const item = await requestJson<IntakeFoldersResponse>("/intake/folders");
    return { item, source: "api" };
  } catch {
    return { item: cloneValue(mockIntakeFolders), source: "mock" };
  }
}

export async function getIntakeCollectionsSnapshot(): Promise<{
  items: MediaCollection[];
  source: DataSource;
}> {
  try {
    const items = await requestJson<MediaCollection[]>("/intake/collections");
    return { items, source: "api" };
  } catch {
    return { items: [], source: "mock" };
  }
}

export async function getIntakeCollectionDetailSnapshot(
  collectionId: string
): Promise<{
  item: IntakeCollectionDetail | null;
  source: DataSource;
}> {
  try {
    const item = await requestJson<IntakeCollectionDetail>(
      `/intake/collections/${encodeURIComponent(collectionId)}`
    );
    return { item, source: "api" };
  } catch {
    return { item: null, source: "mock" };
  }
}

export async function getIntakeCandidatesSnapshot(
  filters: IntakeCandidateFilters = {}
): Promise<{
  items: MediaCandidate[];
  source: DataSource;
}> {
  try {
    const query = buildQueryString({
      collectionId: filters.collectionId,
      status: filters.status,
      provider: filters.provider,
      mediaType: filters.mediaType,
      category: filters.category,
      character: filters.character,
      suggestedProject: filters.suggestedProject
    });
    const items = await requestJson<MediaCandidate[]>(`/intake/candidates${query}`);
    return { items, source: "api" };
  } catch {
    return { items: [], source: "mock" };
  }
}

export async function getMediaCollectorProvidersSnapshot(): Promise<{
  items: MediaCollectorProviderDescriptor[];
  source: DataSource;
}> {
  try {
    const items = await requestJson<MediaCollectorProviderDescriptor[]>(
      "/media-collector/providers"
    );
    return { items, source: "api" };
  } catch {
    return { items: cloneValue(mockMediaCollectorProviders), source: "mock" };
  }
}

export async function getMediaCollectionsSnapshot(): Promise<{
  items: MediaCollection[];
  source: DataSource;
}> {
  try {
    const items = await requestJson<MediaCollection[]>("/media-collections");
    return { items, source: "api" };
  } catch {
    return { items: [], source: "mock" };
  }
}

export async function getMediaCollectionDetailSnapshot(
  collectionId: string
): Promise<{
  item: IntakeCollectionDetail | null;
  source: DataSource;
}> {
  try {
    const item = await requestJson<IntakeCollectionDetail>(
      `/media-collections/${encodeURIComponent(collectionId)}`
    );
    return { item, source: "api" };
  } catch {
    return { item: null, source: "mock" };
  }
}

export async function getMediaCollectionCandidatesSnapshot(
  collectionId: string
): Promise<{
  items: MediaCandidate[];
  source: DataSource;
}> {
  try {
    const items = await requestJson<MediaCandidate[]>(
      `/media-collections/${encodeURIComponent(collectionId)}/candidates`
    );
    return { items, source: "api" };
  } catch {
    return { items: [], source: "mock" };
  }
}

export async function getProjectsSnapshot(): Promise<{
  items: StudioProject[];
  source: DataSource;
}> {
  try {
    const items = await requestProjectsFromApi();
    return { items, source: "api" };
  } catch (error) {
    logServerFallback("projects", error);
    return { items: cloneValue(mockProjects), source: "mock" };
  }
}

export async function getResearchDossiersSnapshot(): Promise<{
  items: ResearchDossier[];
  source: DataSource;
}> {
  try {
    const items = await requestJson<ResearchDossier[]>("/research/dossiers");
    return { items, source: "api" };
  } catch {
    return { items: cloneValue(mockResearchDossiers), source: "mock" };
  }
}

export async function getResearchDossierDetailSnapshot(
  dossierId: string
): Promise<{
  item: ResearchDossierDetail | null;
  source: DataSource;
}> {
  try {
    const item = await requestJson<ResearchDossierDetail>(
      `/research/dossiers/${encodeURIComponent(dossierId)}`
    );
    return { item, source: "api" };
  } catch {
    return {
      item: cloneValue(findMockResearchDetail(dossierId)),
      source: "mock"
    };
  }
}

export async function getRenderJobsSnapshot(): Promise<{
  items: StudioRenderJob[];
  source: DataSource;
}> {
  try {
    const items = await requestJson<StudioRenderJob[]>("/render-jobs");
    return { items, source: "api" };
  } catch {
    return { items: cloneValue(mockRenderJobs), source: "mock" };
  }
}

export async function getProjectRenderJobsSnapshot(
  projectId: string
): Promise<{
  items: StudioRenderJob[];
  source: DataSource;
}> {
  try {
    const items = await requestJson<StudioRenderJob[]>(
      `/video-projects/${encodeURIComponent(projectId)}/render-jobs`
    );
    return { items, source: "api" };
  } catch {
    return {
      items: cloneValue(
        mockRenderJobs.filter((renderJob) => renderJob.videoProjectId === projectId)
      ),
      source: "mock"
    };
  }
}

export async function getProjectDetailSnapshot(id: string): Promise<{
  item: StudioProject | null;
  source: DataSource;
}> {
  try {
    const item = await requestJson<StudioProject>(
      `/video-projects/${encodeURIComponent(id)}`
    );
    return { item, source: "api" };
  } catch (error) {
    logServerFallback(`project:${id}`, error);
    return {
      item: cloneValue(findMockProject(id)),
      source: "mock"
    };
  }
}

export async function getTemplatesSnapshot(): Promise<{
  items: ReelTemplateSummary[];
  source: DataSource;
}> {
  try {
    const items = await requestJson<ReelTemplateSummary[]>('/templates');
    return { items, source: 'api' };
  } catch (error) {
    logServerFallback('templates', error);
    return { items: getTemplates(), source: 'mock' };
  }
}

export async function getReelsFactoryTemplatesSnapshot(): Promise<{
  items: ReelsFactoryTemplate[];
  source: DataSource;
}> {
  try {
    const items = await requestJson<ReelsFactoryTemplate[]>(
      "/reels-factory/templates"
    );
    return { items, source: "api" };
  } catch (error) {
    logServerFallback("reels-factory/templates", error);
    return {
      items: getReelsFactoryTemplates() as unknown as ReelsFactoryTemplate[],
      source: "mock"
    };
  }
}

export async function previewReelsFactoryRequest(
  payload: ReelsFactoryPreviewPayload
) {
  return requestJson<ReelsFactoryPreviewResponse>("/reels-factory/preview", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function previewReelsFactorySnapshot(
  payload: ReelsFactoryPreviewPayload
): Promise<{
  item: ReelsFactoryPreviewResponse;
  source: DataSource;
}> {
  try {
    const item = await previewReelsFactoryRequest(payload);
    return { item, source: "api" };
  } catch (error) {
    logServerFallback("reels-factory/preview", error);
    const editingStyleSummary = resolveMockEditingStyleSummary(
      payload.editingReferencePresetId ?? null
    );
    return {
      item: generateReelsFactoryPreview({
        ...payload,
        editingStyleSummary
      }) as unknown as ReelsFactoryPreviewResponse,
      source: "mock"
    };
  }
}

export async function createReelsFactoryProjectRequest(
  payload: ReelsFactoryPreviewPayload
) {
  return requestJson<ReelsFactoryCreateProjectResponse>(
    "/reels-factory/create-project",
    {
      method: "POST",
      body: JSON.stringify(payload)
    }
  );
}

export async function createReelsFactoryBatchRequest(
  payload: ReelsFactoryBatchPayload
) {
  return requestJson<ReelsFactoryBatchResponse>(
    "/reels-factory/create-batch",
    {
      method: "POST",
      body: JSON.stringify(payload)
    }
  );
}

export async function getCaptionStylesSnapshot(): Promise<{
  items: CaptionStyleSummary[];
  source: DataSource;
}> {
  try {
    const items = await requestJson<CaptionStyleSummary[]>('/caption-styles');
    return { items, source: 'api' };
  } catch (error) {
    logServerFallback('caption-styles', error);
    return { items: getCaptionStyles(), source: 'mock' };
  }
}

export async function getPromptPacksSnapshot(): Promise<{
  items: VisualPromptPack[];
  source: DataSource;
}> {
  try {
    const items = await requestJson<VisualPromptPack[]>('/prompt-packs');
    return { items, source: 'api' };
  } catch (error) {
    logServerFallback('prompt-packs', error);
    return { items: getVisualPromptPacks(), source: 'mock' };
  }
}

export async function getNegativePromptPacksSnapshot(): Promise<{
  items: NegativePromptPack[];
  source: DataSource;
}> {
  try {
    const items = await requestJson<NegativePromptPack[]>('/negative-prompt-packs');
    return { items, source: 'api' };
  } catch (error) {
    logServerFallback('negative-prompt-packs', error);
    return { items: getNegativePromptPacks(), source: 'mock' };
  }
}

export async function getComfyWorkflowPacksSnapshot(): Promise<{
  items: ComfyWorkflowPack[];
  source: DataSource;
}> {
  try {
    const items = await requestJson<ComfyWorkflowPack[]>('/comfy-workflow-packs');
    return { items, source: 'api' };
  } catch (error) {
    logServerFallback('comfy-workflow-packs', error);
    return { items: cloneValue(mockComfyWorkflowPacks), source: 'mock' };
  }
}

export async function getImageQualityPresetsSnapshot(): Promise<{
  items: ImageQualityPreset[];
  source: DataSource;
}> {
  try {
    const items = await requestJson<ImageQualityPreset[]>('/image-quality-presets');
    return { items, source: 'api' };
  } catch (error) {
    logServerFallback('image-quality-presets', error);
    return { items: cloneValue(mockImageQualityPresets), source: 'mock' };
  }
}

export async function suggestComfyWorkflowPackRequest(payload: {
  channelId?: string | null;
  projectId?: string | null;
  sceneId?: string | null;
  templateId?: string | null;
  niche?: string | null;
  researchAssetRequirementId?: string | null;
}) {
  return requestJson<WorkflowPackSuggestion>('/comfy-workflow-packs/suggest', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function getVisualSourceModesSnapshot(): Promise<{
  items: VisualSourceModeDescriptor[];
  source: DataSource;
}> {
  try {
    const items = await requestJson<VisualSourceModeDescriptor[]>('/visual-source-modes');
    return { items, source: 'api' };
  } catch (error) {
    logServerFallback('visual-source-modes', error);
    return { items: cloneValue(mockVisualSourceModes), source: 'mock' };
  }
}

export async function getVisualGenerationProvidersSnapshot(): Promise<{
  items: VisualGenerationProviderDescriptor[];
  source: DataSource;
}> {
  try {
    const items = await requestJson<VisualGenerationProviderDescriptor[]>('/visual-generation/providers');
    return { items, source: 'api' };
  } catch (error) {
    logServerFallback('visual-generation/providers', error);
    return { items: cloneValue(mockVisualGenerationProviders), source: 'mock' };
  }
}

export async function getComfyProviderStatusSnapshot(): Promise<{
  item: ComfyUiProviderStatus;
  source: DataSource;
}> {
  try {
    const item = await requestJson<ComfyUiProviderStatus>('/visual-generation/providers/comfyui-local/status');
    return { item, source: 'api' };
  } catch (error) {
    logServerFallback('visual-generation/providers/comfyui-local/status', error);
    return { item: cloneValue(mockComfyUiProviderStatus), source: 'mock' };
  }
}

export async function testComfyProviderRequest() {
  return requestJson<ComfyUiProviderStatus>('/visual-generation/providers/comfyui-local/test', {
    method: 'POST',
    body: JSON.stringify({})
  });
}

export async function validateComfyWorkflowRequest(templateId: string) {
  return requestJson<ComfyWorkflowValidationResult>('/visual-generation/providers/comfyui-local/validate-workflow', {
    method: 'POST',
    body: JSON.stringify({ templateId })
  });
}

export async function getGeneratedImagesGalleryRequest(
  filters: GeneratedImageGalleryFilters = {}
) {
  const query = buildQueryString({
    projectId: filters.projectId,
    sceneId: filters.sceneId,
    characterProfileId: filters.characterProfileId,
    workflowPackId: filters.workflowPackId,
    qualityPresetId: filters.qualityPresetId,
    status: filters.status,
    provider: filters.provider,
    sourceProvider: filters.sourceProvider
  });

  return requestJson<GeneratedImageGalleryItem[]>(
    `/visual-generation/gallery${query}`
  );
}

export async function getGeneratedImagesGallerySnapshot(
  filters: GeneratedImageGalleryFilters = {}
): Promise<{
  items: GeneratedImageGalleryItem[];
  source: DataSource;
}> {
  try {
    const items = await getGeneratedImagesGalleryRequest(filters);
    return { items, source: "api" };
  } catch (error) {
    logServerFallback("visual-generation/gallery", error);
    return { items: [], source: "mock" };
  }
}

export async function getSceneGeneratedImagesRequest(sceneId: string) {
  return requestJson<GeneratedImageGalleryItem[]>(
    `/scenes/${encodeURIComponent(sceneId)}/generated-images`
  );
}

export async function getSceneGeneratedImagesSnapshot(sceneId: string): Promise<{
  items: GeneratedImageGalleryItem[];
  source: DataSource;
}> {
  try {
    const items = await getSceneGeneratedImagesRequest(sceneId);
    return { items, source: "api" };
  } catch (error) {
    logServerFallback(`scenes/${sceneId}/generated-images`, error);
    return { items: [], source: "mock" };
  }
}

export async function getNarrationProvidersRequest() {
  return requestJson<NarrationProviderDescriptor[]>("/narration/providers");
}

export async function getNarrationProvidersSnapshot(): Promise<{
  items: NarrationProviderDescriptor[];
  source: DataSource;
}> {
  try {
    const items = await getNarrationProvidersRequest();
    return { items, source: "api" };
  } catch (error) {
    logServerFallback("narration/providers", error);
    return { items: cloneValue(mockNarrationProviders), source: "mock" };
  }
}

export async function getNarrationVoicePacksRequest() {
  return requestJson<NarrationVoicePack[]>("/narration/voice-packs");
}

export async function getNarrationVoicePacksSnapshot(): Promise<{
  items: NarrationVoicePack[];
  source: DataSource;
}> {
  try {
    const items = await getNarrationVoicePacksRequest();
    return { items, source: "api" };
  } catch (error) {
    logServerFallback("narration/voice-packs", error);
    return { items: cloneValue(mockNarrationVoicePacks), source: "mock" };
  }
}

export async function getGeneratedAudioGalleryRequest(
  filters: GeneratedNarrationGalleryFilters = {}
) {
  const query = buildQueryString({
    projectId: filters.projectId,
    sceneId: filters.sceneId,
    provider: filters.provider,
    voicePackId: filters.voicePackId,
    status: filters.status
  });

  return requestJson<GeneratedAudioGalleryItem[]>(`/narration/jobs${query}`);
}

export async function getGeneratedAudioGallerySnapshot(
  filters: GeneratedNarrationGalleryFilters = {}
): Promise<{
  items: GeneratedAudioGalleryItem[];
  source: DataSource;
}> {
  try {
    const items = await getGeneratedAudioGalleryRequest(filters);
    return { items, source: "api" };
  } catch (error) {
    logServerFallback("narration/jobs", error);
    return { items: [], source: "mock" };
  }
}

export async function getSceneNarrationsRequest(sceneId: string) {
  return requestJson<GeneratedAudioGalleryItem[]>(
    `/scenes/${encodeURIComponent(sceneId)}/narrations`
  );
}

export async function getSceneNarrationsSnapshot(sceneId: string): Promise<{
  items: GeneratedAudioGalleryItem[];
  source: DataSource;
}> {
  try {
    const items = await getSceneNarrationsRequest(sceneId);
    return { items, source: "api" };
  } catch (error) {
    logServerFallback(`scenes/${sceneId}/narrations`, error);
    return { items: [], source: "mock" };
  }
}

export async function generateSceneNarrationRequest(
  sceneId: string,
  payload: GenerateNarrationPayload
) {
  return requestJson<GenerateNarrationResponse>(
    `/scenes/${encodeURIComponent(sceneId)}/generate-narration`,
    {
      method: "POST",
      body: JSON.stringify(payload)
    }
  );
}

export async function useSceneNarrationRequest(sceneId: string, assetId: string) {
  return requestJson<UseNarrationForSceneResponse>(
    `/scenes/${encodeURIComponent(sceneId)}/use-narration/${encodeURIComponent(assetId)}`,
    {
      method: "POST",
      body: JSON.stringify({})
    }
  );
}

export async function getNarrationJobRequest(jobId: string) {
  return requestJson<GeneratedAudioGalleryItem>(
    `/narration/jobs/${encodeURIComponent(jobId)}`
  );
}

export async function cancelNarrationJobRequest(jobId: string) {
  return requestJson<NarrationJob>(
    `/narration/jobs/${encodeURIComponent(jobId)}/cancel`,
    {
      method: "POST",
      body: JSON.stringify({})
    }
  );
}

export async function getProjectStoryAnalysisRequest(projectId: string) {
  return requestJson<ProjectStoryAnalysisResponse>(
    `/video-projects/${encodeURIComponent(projectId)}/story-analysis`
  );
}

export async function getProjectStoryAnalysisSnapshot(
  projectId: string,
  fallbackProject?: StudioProject | null
): Promise<{
  item: ProjectStoryAnalysisResponse | null;
  source: DataSource;
}> {
  try {
    const item = await getProjectStoryAnalysisRequest(projectId);
    return { item, source: 'api' };
  } catch (error) {
    const project = fallbackProject ?? findMockProject(projectId);

    if (!project) {
      logServerFallback(`project-story:${projectId}`, error);
      return { item: null, source: 'mock' };
    }

    return {
      item: buildProjectStoryAnalysis(cloneValue(project)),
      source: 'mock'
    };
  }
}

export async function getProjectCaptionAnalysisRequest(projectId: string) {
  return requestJson<ProjectCaptionAnalysisResponse>(
    `/video-projects/${encodeURIComponent(projectId)}/caption-analysis`
  );
}

export async function getProjectCaptionAnalysisSnapshot(
  projectId: string,
  fallbackProject?: StudioProject | null,
  fallbackAssets: StudioAsset[] = []
): Promise<{
  item: ProjectCaptionAnalysisResponse | null;
  source: DataSource;
}> {
  try {
    const item = await getProjectCaptionAnalysisRequest(projectId);
    return { item, source: 'api' };
  } catch (error) {
    const project = fallbackProject ?? findMockProject(projectId);

    if (!project) {
      logServerFallback(`project-caption:${projectId}`, error);
      return { item: null, source: 'mock' };
    }

    return {
      item: buildLocalProjectCaptionAnalysis(
        cloneValue(project),
        cloneValue(fallbackAssets)
      ) as ProjectCaptionAnalysisResponse,
      source: 'mock'
    };
  }
}

export async function getProjectAudioPlanRequest(projectId: string) {
  return requestJson<ProjectAudioPlanResponse>(
    `/video-projects/${encodeURIComponent(projectId)}/audio-plan`
  );
}

export async function getProjectAudioPlanSnapshot(
  projectId: string,
  fallbackProject?: StudioProject | null,
  fallbackAssets: StudioAsset[] = []
): Promise<{
  item: ProjectAudioPlanResponse | null;
  source: DataSource;
}> {
  try {
    const item = await getProjectAudioPlanRequest(projectId);
    return { item, source: 'api' };
  } catch (error) {
    const project = fallbackProject ?? findMockProject(projectId);

    if (!project) {
      logServerFallback(`project-audio:${projectId}`, error);
      return { item: null, source: 'mock' };
    }

    return {
      item: buildLocalAudioPlan(cloneValue(project), cloneValue(fallbackAssets)),
      source: 'mock'
    };
  }
}

export async function getProjectRenderBlueprintRequest(projectId: string) {
  return requestJson<RenderBlueprintResponse>(
    `/video-projects/${encodeURIComponent(projectId)}/render-blueprint`
  );
}

export async function getProjectRenderBlueprintSnapshot(
  projectId: string,
  fallbackProject?: StudioProject | null,
  fallbackAssets: StudioAsset[] = []
): Promise<{
  item: RenderBlueprintResponse | null;
  source: DataSource;
}> {
  try {
    const item = await getProjectRenderBlueprintRequest(projectId);
    return { item, source: 'api' };
  } catch (error) {
    const project = fallbackProject ?? findMockProject(projectId);

    if (!project) {
      logServerFallback(`project-blueprint:${projectId}`, error);
      return { item: null, source: 'mock' };
    }

    return {
      item: buildLocalRenderBlueprint(cloneValue(project), cloneValue(fallbackAssets)),
      source: 'mock'
    };
  }
}

export async function getProjectProductionChecklistRequest(projectId: string) {
  return requestJson<ProjectProductionChecklistResponse>(
    `/video-projects/${encodeURIComponent(projectId)}/production-checklist`
  );
}

export async function getProjectProductionChecklistSnapshot(
  projectId: string,
  fallbackProject?: StudioProject | null
): Promise<{
  item: ProjectProductionChecklistResponse | null;
  source: DataSource;
}> {
  try {
    const item = await getProjectProductionChecklistRequest(projectId);
    return { item, source: 'api' };
  } catch (error) {
    const project = fallbackProject ?? findMockProject(projectId);

    if (!project) {
      logServerFallback(`project-checklist:${projectId}`, error);
      return { item: null, source: 'mock' };
    }

    return {
      item: buildLocalProductionChecklist(cloneValue(project)),
      source: 'mock'
    };
  }
}

function buildLocalOneClickChecklist(project: StudioProject): ReelProductionChecklist {
  const scenes = project.scenes.map((scene) => ({
    sceneId: scene.id,
    order: scene.order,
    title: scene.title,
    narrationReady: Boolean(scene.generatedNarrationAssetId),
    visualReady: Boolean(scene.generatedAssetId ?? scene.assetId),
    microclipCount: 0,
    effectiveAssetId: scene.generatedAssetId ?? scene.assetId ?? null,
    effectiveNarrationAssetId: scene.generatedNarrationAssetId ?? null,
    warnings: [
      ...(!scene.generatedNarrationAssetId ? ["Cena sem narracao gerada."] : []),
      ...(!(scene.generatedAssetId ?? scene.assetId)
        ? ["Cena sem visual efetivo."]
        : [])
    ]
  }));
  const scenesWithNarration = scenes.filter((scene) => scene.narrationReady).length;
  const scenesWithVisual = scenes.filter((scene) => scene.visualReady).length;
  const missingItems = [
    ...(scenesWithNarration < project.scenes.length ? ["narration"] : []),
    ...(scenesWithVisual < project.scenes.length ? ["visuals"] : [])
  ];

  return {
    projectId: project.id,
    scenesTotal: project.scenes.length,
    scenesWithNarration,
    scenesWithVisual,
    scenesWithMicroclips: 0,
    hasMusic: Boolean(project.backgroundMusicAssetId),
    hasBeatSyncPlan: Boolean(project.backgroundMusicAssetId || project.musicPresetId),
    hasEditingReferencePreset: Boolean(project.editingReferencePresetId),
    hasAudioMasteringPreset: true,
    renderReady: project.scenes.length > 0 && missingItems.length === 0,
    missingItems,
    scenes,
    warnings: [
      ...(!project.backgroundMusicAssetId ? ["Projeto sem musica selecionada."] : []),
      ...(!project.editingReferencePresetId ? ["Projeto sem preset editorial."] : [])
    ],
    nextActions: [
      ...(missingItems.includes("narration") ? ["generate_missing_narration"] : []),
      ...(missingItems.includes("visuals") ? ["generate_missing_visuals"] : []),
      ...(!project.backgroundMusicAssetId ? ["select_music_optional"] : []),
      "prepare_assets"
    ]
  };
}

export async function getOneClickProductionChecklistRequest(projectId: string) {
  return requestJson<ReelProductionChecklist>(
    `/reel-production/projects/${encodeURIComponent(projectId)}/checklist`
  );
}

export async function getOneClickProductionChecklistSnapshot(
  projectId: string,
  fallbackProject?: StudioProject | null
): Promise<{
  item: ReelProductionChecklist | null;
  source: DataSource;
}> {
  try {
    const item = await getOneClickProductionChecklistRequest(projectId);
    return { item, source: "api" };
  } catch (error) {
    const project = fallbackProject ?? findMockProject(projectId);

    if (!project) {
      logServerFallback(`reel-production-checklist:${projectId}`, error);
      return { item: null, source: "mock" };
    }

    return {
      item: buildLocalOneClickChecklist(cloneValue(project)),
      source: "mock"
    };
  }
}

export async function runOneClickProductionRequest(
  projectId: string,
  payload: OneClickProductionPayload
) {
  return requestJson<OneClickProductionResponse>(
    `/reel-production/projects/${encodeURIComponent(projectId)}/run`,
    {
      method: "POST",
      body: JSON.stringify(payload)
    }
  );
}

export async function getOneClickProductionRunsRequest(projectId: string) {
  return requestJson<ReelProductionRun[]>(
    `/reel-production/projects/${encodeURIComponent(projectId)}/runs`
  );
}

export async function getOneClickProductionRunsSnapshot(
  projectId: string
): Promise<{
  items: ReelProductionRun[];
  source: DataSource;
}> {
  try {
    const items = await getOneClickProductionRunsRequest(projectId);
    return { items, source: "api" };
  } catch (error) {
    logServerFallback(`reel-production-runs:${projectId}`, error);
    return { items: [], source: "mock" };
  }
}

export async function getProjectAssetSuggestionsRequest(projectId: string) {
  return requestJson<ProjectAssetSuggestionsResponse>(
    `/video-projects/${encodeURIComponent(projectId)}/asset-suggestions`
  );
}

export async function getProjectAssetSuggestionsSnapshot(
  projectId: string,
  fallbackProject?: StudioProject | null,
  fallbackAssets: StudioAsset[] = []
): Promise<{
  item: ProjectAssetSuggestionsResponse | null;
  source: DataSource;
}> {
  try {
    const item = await getProjectAssetSuggestionsRequest(projectId);
    return { item, source: 'api' };
  } catch (error) {
    const project = fallbackProject ?? findMockProject(projectId);

    if (!project) {
      logServerFallback(`project-asset-suggestions:${projectId}`, error);
      return { item: null, source: 'mock' };
    }

    return {
      item: buildLocalProjectAssetSuggestions(
        cloneValue(project),
        cloneValue(fallbackAssets)
      ),
      source: 'mock'
    };
  }
}
export async function getDashboardSnapshot(): Promise<DashboardSnapshot> {
  const [channels, assets, projects, renders] = await Promise.all([
    getChannelsSnapshot(),
    getAssetsSnapshot(),
    getProjectsSnapshot(),
    getRenderJobsSnapshot()
  ]);

  return {
    channels: channels.items,
    assets: assets.items,
    projects: projects.items,
    renders:
      renders.source === "api"
        ? renders.items
        : cloneValue(mockDashboardSnapshot.renders),
    sources: {
      channels: channels.source,
      assets: assets.source,
      projects: projects.source,
      renders: renders.source
    }
  };
}

export async function createChannelRequest(payload: ChannelPayload) {
  return requestJson<StudioChannel>("/channels", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function createCharacterRequest(payload: CharacterProfilePayload) {
  return requestJson<CharacterProfile>("/characters", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function updateCharacterRequest(
  id: string,
  payload: Partial<CharacterProfilePayload>
) {
  return requestJson<CharacterProfile>(`/characters/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(payload)
  });
}

export async function deleteCharacterRequest(id: string) {
  await requestJson<void>(`/characters/${encodeURIComponent(id)}`, {
    method: "DELETE"
  });
}

export async function buildCharacterBasePromptRequest(id: string) {
  return requestJson<CharacterProfile>(
    `/characters/${encodeURIComponent(id)}/build-base-prompt`,
    {
      method: "POST",
      body: JSON.stringify({})
    }
  );
}

export async function previewPromptBuildRequest(payload: {
  sceneId?: string | null;
  researchAssetRequirementId?: string | null;
  characterProfileId?: string | null;
  promptPackId?: string | null;
  negativePackId?: string | null;
  variantType?: string | null;
}) {
  return requestJson<PromptBuildResponse>("/prompt-engine/build", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function buildSceneVisualPromptRequest(
  sceneId: string,
  payload: {
    characterProfileId?: string | null;
    promptPackId?: string | null;
    negativePackId?: string | null;
    variantType?: string | null;
  } = {}
) {
  return requestJson<ScenePromptBuildResponse>(
    `/scenes/${encodeURIComponent(sceneId)}/build-visual-prompt`,
    {
      method: "POST",
      body: JSON.stringify(payload)
    }
  );
}

export async function buildResearchRequirementVisualPromptRequest(
  requirementId: string,
  payload: {
    characterProfileId?: string | null;
    promptPackId?: string | null;
    negativePackId?: string | null;
    variantType?: string | null;
  } = {}
) {
  return requestJson<ResearchRequirementPromptBuildResponse>(
    `/research/asset-requirements/${encodeURIComponent(requirementId)}/build-visual-prompt`,
    {
      method: "POST",
      body: JSON.stringify(payload)
    }
  );
}

export async function createCharacterFromIntakeRequest(slug: string) {
  return requestJson<CharacterCreateFromIntakeResponse>(
    `/characters/create-from-intake/${encodeURIComponent(slug)}`,
    {
      method: "POST",
      body: JSON.stringify({})
    }
  );
}

export async function createCharacterReferenceRequest(
  characterId: string,
  payload: CharacterReferencePayload
) {
  return requestJson<CharacterReference>(
    `/characters/${encodeURIComponent(characterId)}/references`,
    {
      method: "POST",
      body: JSON.stringify(payload)
    }
  );
}

export async function updateCharacterReferenceRequest(
  characterId: string,
  referenceId: string,
  payload: Partial<CharacterReferencePayload>
) {
  return requestJson<CharacterReference>(
    `/characters/${encodeURIComponent(characterId)}/references/${encodeURIComponent(referenceId)}`,
    {
      method: "PUT",
      body: JSON.stringify(payload)
    }
  );
}

export async function deleteCharacterReferenceRequest(
  characterId: string,
  referenceId: string
) {
  await requestJson<void>(
    `/characters/${encodeURIComponent(characterId)}/references/${encodeURIComponent(referenceId)}`,
    {
      method: "DELETE"
    }
  );
}

export async function updateChannelRequest(
  id: string,
  payload: ChannelPayload
) {
  return requestJson<StudioChannel>(`/channels/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload)
  });
}

export async function deleteChannelRequest(id: string) {
  await requestJson<void>(`/channels/${id}`, {
    method: "DELETE"
  });
}

export async function createAssetRequest(payload: AssetPayload) {
  return requestJson<StudioAsset>("/assets", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function updateAssetRequest(
  id: string,
  payload: AssetPayload
) {
  return requestJson<StudioAsset>(`/assets/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload)
  });
}

export async function deleteAssetRequest(id: string) {
  await requestJson<void>(`/assets/${id}`, {
    method: "DELETE"
  });
}

export async function createProjectRequest(payload: ProjectPayload) {
  return requestJson<StudioProject>("/video-projects", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function createResearchDossierRequest(
  payload: ResearchDossierPayload
) {
  return requestJson<ResearchDossier>("/research/dossiers", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function updateResearchDossierRequest(
  dossierId: string,
  payload: Partial<ResearchDossierPayload>
) {
  return requestJson<ResearchDossier>(
    `/research/dossiers/${encodeURIComponent(dossierId)}`,
    {
      method: "PUT",
      body: JSON.stringify(payload)
    }
  );
}

export async function deleteResearchDossierRequest(dossierId: string) {
  await requestJson<void>(`/research/dossiers/${encodeURIComponent(dossierId)}`, {
    method: "DELETE"
  });
}

export async function generateResearchSearchQueriesRequest(dossierId: string) {
  return requestJson<ResearchSearchBundleResponse>(
    `/research/dossiers/${encodeURIComponent(dossierId)}/generate-search-queries`,
    {
      method: "POST",
      body: JSON.stringify({})
    }
  );
}

export async function addManualResearchSourceRequest(
  dossierId: string,
  payload: ManualResearchSourcePayload
) {
  return requestJson<ResearchSource>(
    `/research/dossiers/${encodeURIComponent(dossierId)}/sources/manual`,
    {
      method: "POST",
      body: JSON.stringify(payload)
    }
  );
}

export async function fetchResearchSourceUrlRequest(
  dossierId: string,
  payload: ResearchFetchUrlPayload
) {
  return requestJson<ResearchSource>(
    `/research/dossiers/${encodeURIComponent(dossierId)}/sources/fetch-url`,
    {
      method: "POST",
      body: JSON.stringify(payload)
    }
  );
}

export async function searchWikipediaResearchSourcesRequest(
  dossierId: string,
  payload: ResearchConnectorSearchPayload
) {
  return requestJson<ResearchSearchCandidatesResponse>(
    `/research/dossiers/${encodeURIComponent(dossierId)}/sources/search-wikipedia`,
    {
      method: "POST",
      body: JSON.stringify(payload)
    }
  );
}

export async function searchWikidataResearchSourcesRequest(
  dossierId: string,
  payload: ResearchConnectorSearchPayload
) {
  return requestJson<ResearchSearchCandidatesResponse>(
    `/research/dossiers/${encodeURIComponent(dossierId)}/sources/search-wikidata`,
    {
      method: "POST",
      body: JSON.stringify(payload)
    }
  );
}

export async function approveResearchSourceRequest(sourceId: string) {
  return requestJson<ResearchSource>(
    `/research/sources/${encodeURIComponent(sourceId)}/approve`,
    {
      method: "POST",
      body: JSON.stringify({})
    }
  );
}

export async function rejectResearchSourceRequest(sourceId: string) {
  return requestJson<ResearchSource>(
    `/research/sources/${encodeURIComponent(sourceId)}/reject`,
    {
      method: "POST",
      body: JSON.stringify({})
    }
  );
}

export async function analyzeResearchDossierRequest(dossierId: string) {
  return requestJson<ResearchAnalyzeResponse>(
    `/research/dossiers/${encodeURIComponent(dossierId)}/analyze`,
    {
      method: "POST",
      body: JSON.stringify({})
    }
  );
}

export async function createProductionFromResearchDossierRequest(
  dossierId: string,
  payload: ResearchCreateProductionPayload
) {
  return requestJson<ResearchCreateProductionResponse>(
    `/research/dossiers/${encodeURIComponent(dossierId)}/create-production`,
    {
      method: "POST",
      body: JSON.stringify(payload)
    }
  );
}

export async function updateProjectRequest(
  id: string,
  payload: ProjectPayload
) {
  return requestJson<StudioProject>(`/video-projects/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload)
  });
}

export async function deleteProjectRequest(id: string) {
  await requestJson<void>(`/video-projects/${id}`, {
    method: "DELETE"
  });
}

export async function createSceneRequest(
  projectId: string,
  payload: ScenePayload
) {
  return requestJson<ProjectScene>(
    `/video-projects/${projectId}/scenes`,
    {
      method: "POST",
      body: JSON.stringify(payload)
    }
  );
}

export async function updateSceneRequest(
  projectId: string,
  sceneId: string,
  payload: ScenePayload
) {
  return requestJson<ProjectScene>(
    `/video-projects/${projectId}/scenes/${sceneId}`,
    {
      method: "PUT",
      body: JSON.stringify(payload)
    }
  );
}

export async function deleteSceneRequest(
  projectId: string,
  sceneId: string
) {
  await requestJson<void>(`/video-projects/${projectId}/scenes/${sceneId}`, {
    method: "DELETE"
  });
}

export async function reorderScenesRequest(
  projectId: string,
  payload: SceneReorderPayload
) {
  return requestJson<ProjectScene[]>(
    `/video-projects/${projectId}/scenes/reorder`,
    {
      method: "POST",
      body: JSON.stringify(payload)
    }
  );
}

export async function applyChannelDefaultsRequest(projectId: string) {
  return requestJson<ApplyChannelDefaultsResponse>(
    `/video-projects/${encodeURIComponent(projectId)}/apply-channel-defaults`,
    {
      method: "POST",
      body: JSON.stringify({})
    }
  );
}

export async function createProductionFromScriptRequest(
  payload: CreateProductionFromScriptPayload
) {
  return requestJson<CreateProductionFromScriptResponse>(
    "/production/create-from-script",
    {
      method: "POST",
      body: JSON.stringify(payload)
    }
  );
}

export async function createProductionFromScriptSnapshot(
  payload: CreateProductionFromScriptPayload,
  fallbackChannels: StudioChannel[] = [],
  fallbackAssets: StudioAsset[] = []
): Promise<{
  item: CreateProductionFromScriptResponse | null;
  source: DataSource;
}> {
  try {
    const item = await createProductionFromScriptRequest(payload);
    return { item, source: "api" };
  } catch {
    return {
      item: createLocalProductionFromScript(
        cloneValue(payload),
        cloneValue(fallbackChannels),
        cloneValue(fallbackAssets)
      ),
      source: "mock"
    };
  }
}

export async function uploadAssetRequest(payload: FormData) {
  return requestJson<StudioAsset>("/assets/upload", {
    method: "POST",
    body: payload
  });
}

export async function scanInboxRequest() {
  return requestJson<{
    collection: MediaCollection;
    candidatesCreated: number;
    candidatesSkipped: number;
    createdCandidateIds: string[];
    candidates: MediaCandidate[];
  }>("/intake/scan", {
    method: "POST",
    body: JSON.stringify({})
  });
}

export async function updateIntakeCandidateRequest(
  candidateId: string,
  payload: IntakeCandidatePayload
) {
  return requestJson<MediaCandidate>(`/intake/candidates/${encodeURIComponent(candidateId)}`, {
    method: "PUT",
    body: JSON.stringify(payload)
  });
}

export async function approveIntakeCandidateRequest(candidateId: string) {
  return requestJson<MediaCandidate>(
    `/intake/candidates/${encodeURIComponent(candidateId)}/approve`,
    {
      method: "POST",
      body: JSON.stringify({})
    }
  );
}

export async function rejectIntakeCandidateRequest(candidateId: string) {
  return requestJson<MediaCandidate>(
    `/intake/candidates/${encodeURIComponent(candidateId)}/reject`,
    {
      method: "POST",
      body: JSON.stringify({})
    }
  );
}

export async function importApprovedCandidatesRequest() {
  return requestJson<ImportApprovedResponse>("/intake/import-approved", {
    method: "POST",
    body: JSON.stringify({})
  });
}

export async function createMediaCollectionRequest(
  payload: MediaCollectionPayload
) {
  return requestJson<MediaCollection>("/media-collections", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function searchMediaCollectionRequest(collectionId: string) {
  return requestJson<MediaCollectionSearchResponse>(
    `/media-collections/${encodeURIComponent(collectionId)}/search`,
    {
      method: "POST",
      body: JSON.stringify({})
    }
  );
}

export async function importApprovedMediaCollectionRequest(collectionId: string) {
  return requestJson<ImportApprovedResponse>(
    `/media-collections/${encodeURIComponent(collectionId)}/import-approved`,
    {
      method: "POST",
      body: JSON.stringify({})
    }
  );
}

export async function createManualUrlCandidateRequest(
  payload: ManualUrlCandidatePayload
) {
  return requestJson<MediaCandidate>("/media-collector/manual-url", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function updateMediaCandidateRequest(
  candidateId: string,
  payload: IntakeCandidatePayload
) {
  return requestJson<MediaCandidate>(
    `/media-candidates/${encodeURIComponent(candidateId)}`,
    {
      method: "PUT",
      body: JSON.stringify(payload)
    }
  );
}

export async function approveMediaCandidateRequest(candidateId: string) {
  return requestJson<MediaCandidate>(
    `/media-candidates/${encodeURIComponent(candidateId)}/approve`,
    {
      method: "POST",
      body: JSON.stringify({})
    }
  );
}

export async function rejectMediaCandidateRequest(candidateId: string) {
  return requestJson<MediaCandidate>(
    `/media-candidates/${encodeURIComponent(candidateId)}/reject`,
    {
      method: "POST",
      body: JSON.stringify({})
    }
  );
}

export async function createMediaCollectionFromRequirementRequest(
  requirementId: string
) {
  return requestJson<ResearchRequirementCollectionCreateResponse>(
    `/research/asset-requirements/${encodeURIComponent(requirementId)}/create-media-collection`,
    {
      method: "POST",
      body: JSON.stringify({})
    }
  );
}

export async function createMediaCollectionsFromDossierRequest(dossierId: string) {
  return requestJson<ResearchDossierCollectionsCreateResponse>(
    `/research/dossiers/${encodeURIComponent(dossierId)}/create-media-collections-for-requirements`,
    {
      method: "POST",
      body: JSON.stringify({})
    }
  );
}

export async function createProjectMissingAssetCollectionsRequest(
  projectId: string
) {
  return requestJson<ProjectMissingAssetCollectionsResponse>(
    `/video-projects/${encodeURIComponent(projectId)}/create-media-collection-for-missing-assets`,
    {
      method: "POST",
      body: JSON.stringify({})
    }
  );
}

export async function getProjectMissingVisualReportRequest(projectId: string) {
  return requestJson<ProjectMissingVisualReport>(
    `/video-projects/${encodeURIComponent(projectId)}/missing-visual-report`
  );
}

export async function getProjectMissingVisualReportSnapshot(projectId: string) {
  try {
    const item = await getProjectMissingVisualReportRequest(projectId);
    return { item, source: "api" as const };
  } catch {
    return { item: null, source: "mock" as const };
  }
}

export async function generateSceneVisualRequest(
  sceneId: string,
  payload: Partial<GenerateVisualPayload> = {}
) {
  return requestJson<GenerateSceneVisualResponse>(
    `/scenes/${encodeURIComponent(sceneId)}/generate-visual`,
    {
      method: "POST",
      body: JSON.stringify(payload)
    }
  );
}

export async function generateRequirementVisualRequest(
  requirementId: string,
  payload: Partial<GenerateVisualPayload> = {}
) {
  return requestJson<GenerateSceneVisualResponse>(
    `/research/asset-requirements/${encodeURIComponent(requirementId)}/generate-visual`,
    {
      method: "POST",
      body: JSON.stringify(payload)
    }
  );
}

export async function generateMissingVisualsRequest(
  projectId: string,
  payload: Partial<GenerateMissingVisualsPayload> = {}
) {
  return requestJson<GenerateMissingVisualsResponse>(
    `/video-projects/${encodeURIComponent(projectId)}/generate-missing-visuals`,
    {
      method: "POST",
      body: JSON.stringify(payload)
    }
  );
}

export async function cancelVisualGenerationJobRequest(jobId: string) {
  return requestJson<VisualGenerationJob>(
    `/visual-generation/jobs/${encodeURIComponent(jobId)}/cancel`,
    {
      method: "POST",
      body: JSON.stringify({})
    }
  );
}

export async function markVisualGenerationJobReviewedRequest(
  jobId: string,
  reviewStatus: VisualReviewStatus,
  notes: string | null = null
) {
  return requestJson<VisualGenerationJob>(
    `/visual-generation/jobs/${encodeURIComponent(jobId)}/mark-reviewed`,
    {
      method: "POST",
      body: JSON.stringify({
        reviewStatus,
        notes
      })
    }
  );
}

export async function regenerateVisualGenerationJobRequest(
  jobId: string,
  payload: {
    seedMode?: "random" | "fixed" | "reuse" | "increment" | null;
    qualityPresetId?: string | null;
    workflowPackId?: string | null;
  } = {}
) {
  return requestJson<GenerateSceneVisualResponse>(
    `/visual-generation/jobs/${encodeURIComponent(jobId)}/regenerate`,
    {
      method: "POST",
      body: JSON.stringify(payload)
    }
  );
}

export async function useGeneratedImageForSceneRequest(
  sceneId: string,
  assetId: string
) {
  return requestJson<UseGeneratedImageForSceneResponse>(
    `/scenes/${encodeURIComponent(sceneId)}/use-generated-image/${encodeURIComponent(assetId)}`,
    {
      method: "POST",
      body: JSON.stringify({})
    }
  );
}

export async function getEditorialMicroclipsForProjectRequest(projectId: string) {
  return requestJson<EditorialMicroclip[]>(
    `/editorial-microclips/project/${encodeURIComponent(projectId)}`
  );
}

export async function createEditorialMicroclipRequest(
  payload: EditorialMicroclipPayload
) {
  return requestJson<EditorialMicroclip>("/editorial-microclips", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function updateEditorialMicroclipRequest(
  microclipId: string,
  payload: Partial<EditorialMicroclipPayload>
) {
  return requestJson<EditorialMicroclip>(
    `/editorial-microclips/${encodeURIComponent(microclipId)}`,
    {
      method: "PUT",
      body: JSON.stringify(payload)
    }
  );
}

export async function deleteEditorialMicroclipRequest(microclipId: string) {
  await requestJson<void>(`/editorial-microclips/${encodeURIComponent(microclipId)}`, {
    method: "DELETE"
  });
}

export async function analyzeMicroclipSelectorRequest(
  payload: MicroclipSelectorAnalyzePayload
) {
  return requestJson<MicroclipSelectorAnalyzeResponse>(
    "/microclip-selector/analyze",
    {
      method: "POST",
      body: JSON.stringify(payload)
    }
  );
}

export async function applyMicroclipSelectorCandidateRequest(
  payload: MicroclipSelectorApplyPayload
) {
  return requestJson<MicroclipSelectorApplyResponse>(
    "/microclip-selector/apply",
    {
      method: "POST",
      body: JSON.stringify(payload)
    }
  );
}

export async function createRenderJobRequest(
  projectId: string,
  payload: CreateRenderJobPayload = {}
) {
  return requestJson<StudioRenderJob>(
    `/video-projects/${encodeURIComponent(projectId)}/render-jobs`,
    {
      method: "POST",
      body: JSON.stringify(payload)
    }
  );
}

export async function cancelRenderJobRequest(renderJobId: string) {
  return requestJson<StudioRenderJob>(
    `/render-jobs/${encodeURIComponent(renderJobId)}/cancel`,
    {
      method: "POST"
    }
  );
}

export async function retryRenderJobRequest(renderJobId: string) {
  return requestJson<StudioRenderJob>(
    `/render-jobs/${encodeURIComponent(renderJobId)}/retry`,
    {
      method: "POST"
    }
  );
}

export async function deleteRenderJobRequest(renderJobId: string) {
  await requestJson<void>(`/render-jobs/${encodeURIComponent(renderJobId)}`, {
    method: "DELETE"
  });
}

export function getAssetMediaUrl(assetId: string) {
  return buildApiUrl(`/media/assets/${encodeURIComponent(assetId)}`);
}

export function getCandidateMediaUrl(candidateId: string) {
  return buildApiUrl(`/media/candidates/${encodeURIComponent(candidateId)}/preview`);
}

export function getRenderMediaUrl(renderJobId: string) {
  return buildApiUrl(`/media/renders/${encodeURIComponent(renderJobId)}`);
}

export function getRenderLogUrl(renderJobId: string) {
  return buildApiUrl(`/media/renders/${encodeURIComponent(renderJobId)}/log`);
}

export function getRenderThumbnailUrl(renderJobId: string) {
  return buildApiUrl(
    `/media/renders/${encodeURIComponent(renderJobId)}/thumbnail`
  );
}

