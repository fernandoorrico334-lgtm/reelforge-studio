import { randomUUID } from "node:crypto";
import type { EmotionTag, StudioAsset } from "../../modules/assets/domain/asset.js";
import type { StudioChannel } from "../../modules/channels/domain/channel.js";
import type {
  MediaCandidate,
  MediaCollection
} from "../../modules/intake/domain/intake.js";
import type {
  ProjectScene,
  ProjectStatus
} from "../../modules/projects/domain/project.js";
import type {
  RenderMode,
  RenderQuality,
  RenderJobStep,
  RenderJobStatus
} from "../../modules/render-jobs/domain/render-job.js";
import type {
  ResearchAssetMediaType,
  ResearchConfidence,
  ResearchDossierStatus,
  ResearchFactType,
  ResearchHookType,
  ResearchOutlineRole,
  ResearchSourceStatus,
  ResearchSourceType
} from "../../modules/research/domain/research.js";

export interface MemoryVideoProjectRecord {
  id: string;
  title: string;
  status: ProjectStatus;
  channelId: string;
  script: string | null;
  durationTarget: number | null;
  format: string;
  templateId: string | null;
  defaultCaptionStyle: string | null;
  backgroundMusicAssetId: string | null;
  voiceoverAssetId: string | null;
  audioMood: string | null;
  musicVolume: number;
  voiceVolume: number;
  sfxVolume: number;
  enableAudioDucking: boolean;
  duckingLevel: number;
  createdAt: string;
  updatedAt: string;
}

export interface MemorySceneRecord {
  id: string;
  videoProjectId: string;
  order: number;
  title: string;
  narrationText: string | null;
  captionText: string | null;
  duration: number | null;
  emotion: EmotionTag | null;
  assetId: string | null;
  generatedAssetId: string | null;
  characterProfileId: string | null;
  sfxAssetId: string | null;
  sfxStartTime: number;
  sfxVolume: number;
  visualPreset: string | null;
  visualSourceMode: ProjectScene["visualSourceMode"];
  visualPrompt: string | null;
  negativePrompt: string | null;
  visualRecipe: string | null;
  generationStatus: ProjectScene["generationStatus"];
  generationProvider: ProjectScene["generationProvider"];
  generationSeed: number | null;
  transition: string | null;
  captionStyle: string | null;
  captionPosition: ProjectScene["captionPosition"];
  captionEmphasisWords: string[];
  energyLevel: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface MemoryRenderJobRecord {
  id: string;
  videoProjectId: string;
  status: RenderJobStatus;
  renderMode: RenderMode;
  renderQuality: RenderQuality;
  outputPath: string | null;
  blueprintPath: string | null;
  srtPath: string | null;
  assPath: string | null;
  logPath: string | null;
  errorMessage: string | null;
  progress: number | null;
  currentStep: RenderJobStep | null;
  currentSceneIndex: number | null;
  totalScenes: number | null;
  outputWidth: number | null;
  outputHeight: number | null;
  outputDuration: number | null;
  outputCodec: string | null;
  hasAudio: boolean | null;
  audioCodec: string | null;
  audioChannels: number | null;
  audioSampleRate: number | null;
  outputFileSize: number | null;
  thumbnailPath: string | null;
  cancelledAt: string | null;
  retriedFromJobId: string | null;
  attempt: number;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MemoryResearchDossierRecord {
  id: string;
  channelId: string | null;
  title: string;
  topic: string;
  niche: string | null;
  tone: string | null;
  targetDuration: number | null;
  status: ResearchDossierStatus;
  summary: string | null;
  narrativeAngle: string | null;
  editorialNotes: string | null;
  safetyNotes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MemoryResearchSourceRecord {
  id: string;
  dossierId: string;
  title: string;
  url: string | null;
  provider: string;
  sourceType: ResearchSourceType;
  author: string | null;
  publishedAt: string | null;
  accessedAt: string | null;
  reliabilityScore: number | null;
  citationText: string | null;
  rawTextPath: string | null;
  excerpt: string | null;
  notes: string | null;
  status: ResearchSourceStatus;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MemoryResearchFactRecord {
  id: string;
  dossierId: string;
  sourceId: string | null;
  claim: string;
  factType: ResearchFactType;
  confidence: ResearchConfidence;
  dateValue: string | null;
  people: string[];
  places: string[];
  tags: string[];
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MemoryResearchTimelineEventRecord {
  id: string;
  dossierId: string;
  sourceId: string | null;
  title: string;
  description: string;
  dateValue: string | null;
  order: number | null;
  location: string | null;
  people: string[];
  confidence: ResearchConfidence;
  createdAt: string;
  updatedAt: string;
}

export interface MemoryResearchHookRecord {
  id: string;
  dossierId: string;
  text: string;
  hookType: ResearchHookType;
  strengthScore: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MemoryResearchAssetRequirementRecord {
  id: string;
  dossierId: string;
  sceneRole: ResearchOutlineRole | null;
  description: string;
  mediaType: ResearchAssetMediaType;
  suggestedTags: string[];
  emotion: EmotionTag | null;
  priority: number | null;
  fulfilledAssetId: string | null;
  visualSourceMode: ProjectScene["visualSourceMode"];
  characterProfileId: string | null;
  generatedAssetId: string | null;
  visualPrompt: string | null;
  generationStatus: ProjectScene["generationStatus"];
  generationProvider: ProjectScene["generationProvider"];
  createdAt: string;
  updatedAt: string;
}

export interface MemoryResearchOutlineSceneRecord {
  id: string;
  dossierId: string;
  order: number;
  role: ResearchOutlineRole;
  title: string;
  narrationDraft: string;
  captionDraft: string | null;
  emotion: EmotionTag | null;
  visualPreset: string | null;
  assetRequirementId: string | null;
  estimatedDuration: number | null;
  createdAt: string;
  updatedAt: string;
}

interface MemoryStudioState {
  channels: StudioChannel[];
  assets: StudioAsset[];
  characterProfiles: any[];
  characterReferences: any[];
  mediaCollections: MediaCollection[];
  mediaCandidates: MediaCandidate[];
  researchAssetRequirements: MemoryResearchAssetRequirementRecord[];
  researchDossiers: MemoryResearchDossierRecord[];
  researchFacts: MemoryResearchFactRecord[];
  researchHooks: MemoryResearchHookRecord[];
  researchOutlineScenes: MemoryResearchOutlineSceneRecord[];
  researchSources: MemoryResearchSourceRecord[];
  researchTimelineEvents: MemoryResearchTimelineEventRecord[];
  videoProjects: MemoryVideoProjectRecord[];
  scenes: MemorySceneRecord[];
  renderJobs: MemoryRenderJobRecord[];
  visualGenerationJobs: any[];
}

function createInitialState(): MemoryStudioState {
  const createdAt = "2026-06-26T00:00:00.000Z";

  return {
    channels: [
      {
        id: "channel-anime-lore",
        name: "Anime Lore",
        niche: "Universos anime, teorias e explicacoes de lore",
        language: "pt-BR",
        visualStyle: "Cortes dramaticos, overlays editoriais e close-ups intensos",
        narrativeTone: "Analitico com suspense",
        defaultTemplate: "anime_dark",
        defaultRenderMode: "cinematic_v2",
        defaultRenderQuality: "high",
        defaultAudioMood: "dark_suspense",
        defaultCaptionStyle: "anime_punch",
        defaultVisualPreset: "mystery",
        defaultMusicAssetId: "asset-music-001",
        defaultVoiceoverAssetId: "asset-voice-001",
        defaultDurationTarget: 32,
        defaultSceneDuration: 4.2,
        preferredAssetCategories: ["PANEL", "BACKGROUND", "CHARACTER"],
        preferredAssetTags: ["anime", "lore", "uchiha", "suspense"],
        createdAt,
        updatedAt: createdAt
      },
      {
        id: "channel-hqs-comentadas",
        name: "HQs Comentadas",
        niche: "Resumos e opinioes sobre quadrinhos e sagas classicas",
        language: "pt-BR",
        visualStyle: "Painel editorial com zooms ritmados e captions bold",
        narrativeTone: "Explicativo com energia de review",
        defaultTemplate: "comic_drama",
        defaultRenderMode: "cinematic_v2",
        defaultRenderQuality: "standard",
        defaultAudioMood: "documentary_bed",
        defaultCaptionStyle: "comic_pop",
        defaultVisualPreset: "drama",
        defaultMusicAssetId: null,
        defaultVoiceoverAssetId: null,
        defaultDurationTarget: 38,
        defaultSceneDuration: 4.8,
        preferredAssetCategories: ["COVER", "PANEL", "SCREENSHOT"],
        preferredAssetTags: ["hq", "comic", "review", "batman"],
        createdAt,
        updatedAt: createdAt
      },
      {
        id: "channel-curiosidades-sombrias",
        name: "Curiosidades Sombrias",
        niche: "Historias inquietantes, misterios e curiosidades obscuras",
        language: "pt-BR",
        visualStyle: "Texturas escuras, silhuetas e contraste alto",
        narrativeTone: "Misterioso e provocativo",
        defaultTemplate: "true_crime",
        defaultRenderMode: "cinematic_v2",
        defaultRenderQuality: "high",
        defaultAudioMood: "horror_tension",
        defaultCaptionStyle: "horror_whisper",
        defaultVisualPreset: "horror",
        defaultMusicAssetId: "asset-music-001",
        defaultVoiceoverAssetId: "asset-voice-001",
        defaultDurationTarget: 34,
        defaultSceneDuration: 4,
        preferredAssetCategories: ["BROLL", "BACKGROUND", "SCREENSHOT"],
        preferredAssetTags: ["sombrio", "misterio", "crime", "arquivo"],
        createdAt,
        updatedAt: createdAt
      }
    ],
    assets: [
      {
        id: "asset-anime-001",
        filename: "uchiha-panel-01.png",
        originalName: "uchiha-panel-01.png",
        path: "storage/assets/panel/image/uchiha-panel-01.png",
        type: "IMAGE",
        category: "PANEL",
        franchise: "Naruto",
        character: "Itachi Uchiha",
        emotion: "MYSTERIOUS",
        tags: ["anime", "lore", "uchiha", "hook"],
        licenseType: "editorial-reference",
        copyrightRisk: "HIGH",
        recommendedUse: "Aberturas de reels narrativos",
        duration: null,
        width: 1080,
        height: 1920,
        mimeType: "image/png",
        extension: ".png",
        fileSize: 284000,
        sourceProvider: null,
        sourceUrl: null,
        sourceAuthor: null,
        sourceLicense: null,
        sourceLicenseUrl: null,
        downloadedAt: null,
        collectionId: null,
        usageNotes: null,
        createdAt,
        updatedAt: createdAt
      },
      {
        id: "asset-anime-002",
        filename: "village-corridor-shot.jpg",
        originalName: "village-corridor-shot.jpg",
        path: "storage/assets/background/image/village-corridor-shot.jpg",
        type: "IMAGE",
        category: "BACKGROUND",
        franchise: "Naruto",
        character: null,
        emotion: "DARK",
        tags: ["anime", "vila", "suspense"],
        licenseType: "editorial-reference",
        copyrightRisk: "HIGH",
        recommendedUse: "Planos de respiracao entre falas densas",
        duration: null,
        width: 1080,
        height: 1920,
        mimeType: "image/jpeg",
        extension: ".jpg",
        fileSize: 412000,
        sourceProvider: null,
        sourceUrl: null,
        sourceAuthor: null,
        sourceLicense: null,
        sourceLicenseUrl: null,
        downloadedAt: null,
        collectionId: null,
        usageNotes: null,
        createdAt,
        updatedAt: createdAt
      },
      {
        id: "asset-hq-001",
        filename: "batman-cover-issue-01.jpg",
        originalName: "batman-cover-issue-01.jpg",
        path: "storage/assets/cover/image/batman-cover-issue-01.jpg",
        type: "IMAGE",
        category: "COVER",
        franchise: "Batman",
        character: "Batman",
        emotion: "DARK",
        tags: ["hq", "batman", "capa"],
        licenseType: "editorial-reference",
        copyrightRisk: "HIGH",
        recommendedUse: "Capas e aberturas de episodios comentados",
        duration: null,
        width: 1080,
        height: 1920,
        mimeType: "image/jpeg",
        extension: ".jpg",
        fileSize: 503000,
        sourceProvider: null,
        sourceUrl: null,
        sourceAuthor: null,
        sourceLicense: null,
        sourceLicenseUrl: null,
        downloadedAt: null,
        collectionId: null,
        usageNotes: null,
        createdAt,
        updatedAt: createdAt
      },
      {
        id: "asset-dark-001",
        filename: "shadow-realm-clip.mp4",
        originalName: "shadow-realm-clip.mp4",
        path: "storage/assets/broll/video/shadow-realm-clip.mp4",
        type: "VIDEO",
        category: "BROLL",
        franchise: null,
        character: null,
        emotion: "TENSE",
        tags: ["sombrio", "misterio", "broll"],
        licenseType: "owned-original",
        copyrightRisk: "LOW",
        recommendedUse: "Textura de transicao para blocos sombrios",
        duration: 4.2,
        width: 1080,
        height: 1920,
        mimeType: "video/mp4",
        extension: ".mp4",
        fileSize: 2480000,
        sourceProvider: null,
        sourceUrl: null,
        sourceAuthor: null,
        sourceLicense: null,
        sourceLicenseUrl: null,
        downloadedAt: null,
        collectionId: null,
        usageNotes: null,
        createdAt,
        updatedAt: createdAt
      },
      {
        id: "asset-music-001",
        filename: "ambient-dark-bed.wav",
        originalName: "ambient-dark-bed.wav",
        path: "storage/assets/track/music/ambient-dark-bed.wav",
        type: "MUSIC",
        category: "TRACK",
        franchise: null,
        character: null,
        emotion: "DARK",
        tags: ["audio", "music", "dark", "bed"],
        licenseType: "local-generated",
        copyrightRisk: "LOW",
        recommendedUse: "Base musical para narrativas sombrias",
        duration: 18,
        width: null,
        height: null,
        mimeType: "audio/wav",
        extension: ".wav",
        fileSize: 1640000,
        sourceProvider: null,
        sourceUrl: null,
        sourceAuthor: null,
        sourceLicense: null,
        sourceLicenseUrl: null,
        downloadedAt: null,
        collectionId: null,
        usageNotes: null,
        createdAt,
        updatedAt: createdAt
      },
      {
        id: "asset-voice-001",
        filename: "narration-guide.wav",
        originalName: "narration-guide.wav",
        path: "storage/assets/track/audio/narration-guide.wav",
        type: "AUDIO",
        category: "TRACK",
        franchise: null,
        character: null,
        emotion: "NEUTRAL",
        tags: ["audio", "voiceover", "guide"],
        licenseType: "local-generated",
        copyrightRisk: "LOW",
        recommendedUse: "Guia de narracao para testes locais",
        duration: 14,
        width: null,
        height: null,
        mimeType: "audio/wav",
        extension: ".wav",
        fileSize: 1280000,
        sourceProvider: null,
        sourceUrl: null,
        sourceAuthor: null,
        sourceLicense: null,
        sourceLicenseUrl: null,
        downloadedAt: null,
        collectionId: null,
        usageNotes: null,
        createdAt,
        updatedAt: createdAt
      },
      {
        id: "asset-sfx-001",
        filename: "impact-hit.wav",
        originalName: "impact-hit.wav",
        path: "storage/assets/effect/sfx/impact-hit.wav",
        type: "SFX",
        category: "EFFECT",
        franchise: null,
        character: null,
        emotion: "TENSE",
        tags: ["audio", "sfx", "impact"],
        licenseType: "local-generated",
        copyrightRisk: "LOW",
        recommendedUse: "Impacto de corte ou revelacao",
        duration: 0.6,
        width: null,
        height: null,
        mimeType: "audio/wav",
        extension: ".wav",
        fileSize: 64000,
        sourceProvider: null,
        sourceUrl: null,
        sourceAuthor: null,
        sourceLicense: null,
        sourceLicenseUrl: null,
        downloadedAt: null,
        collectionId: null,
        usageNotes: null,
        createdAt,
        updatedAt: createdAt
      }
    ],
    characterProfiles: [],
    characterReferences: [],
    mediaCollections: [],
    mediaCandidates: [],
    researchDossiers: [
      {
        id: "dossier-estacao-aurora",
        channelId: "channel-curiosidades-sombrias",
        title: "Dossie: O caso da Estacao Aurora",
        topic: "desaparecimento da equipe da Estacao Aurora",
        niche: "documentario sombrio",
        tone: "investigativo",
        targetDuration: 42,
        status: "ready_for_review",
        summary:
          "O dossie organiza a cronologia do desaparecimento ficticio da equipe da Estacao Aurora com foco em fatos confirmados, ruÃ­dos de radio e o ultimo sinal enviado.",
        narrativeAngle:
          "Reconstruir a sequencia final da equipe e destacar o ponto em que o caso deixa de ser falha tecnica e vira misterio.",
        editorialNotes:
          "Abrir com o ultimo sinal. Contextualizar a estacao. Fechar com a divergencia entre o relatorio oficial e o diario de bordo.",
        safetyNotes:
          "Caso ficticio usado apenas para demonstracao local. Tratar alegacoes sem fonte como incertas.",
        createdAt,
        updatedAt: createdAt
      }
    ],
    researchSources: [
      {
        id: "source-aurora-001",
        dossierId: "dossier-estacao-aurora",
        title: "Relatorio tecnico da Estacao Aurora",
        url: "https://example.invalid/aurora-report",
        provider: "manual",
        sourceType: "official_record",
        author: "Conselho Orbital",
        publishedAt: "1998",
        accessedAt: createdAt,
        reliabilityScore: 91,
        citationText: "Relatorio tecnico emitido apos a perda de contato com a estacao.",
        rawTextPath: null,
        excerpt:
          "O relatorio confirma a perda de energia na madrugada e registra um ultimo sinal manual 11 minutos antes do apagao total.",
        notes: "Fonte base para cronologia e linguagem cautelosa.",
        status: "approved",
        errorMessage: null,
        createdAt,
        updatedAt: createdAt
      },
      {
        id: "source-aurora-002",
        dossierId: "dossier-estacao-aurora",
        title: "Diario de bordo recuperado",
        url: null,
        provider: "manual",
        sourceType: "manual_note",
        author: "Arquivo interno",
        publishedAt: null,
        accessedAt: createdAt,
        reliabilityScore: 63,
        citationText: null,
        rawTextPath: null,
        excerpt:
          "Entradas finais mencionam um ruido crescente, debate na equipe e uma porta selada minutos antes do corte de energia.",
        notes: "Exige leitura como material parcial e possivelmente incompleto.",
        status: "approved",
        errorMessage: null,
        createdAt,
        updatedAt: createdAt
      }
    ],
    researchFacts: [
      {
        id: "fact-aurora-001",
        dossierId: "dossier-estacao-aurora",
        sourceId: "source-aurora-001",
        claim: "A perda total de energia ocorreu na madrugada logo apos o ultimo sinal manual da equipe.",
        factType: "event",
        confidence: "confirmed",
        dateValue: "1998",
        people: [],
        places: ["Estacao Aurora"],
        tags: ["apagao", "sinal", "cronologia"],
        notes: null,
        createdAt,
        updatedAt: createdAt
      },
      {
        id: "fact-aurora-002",
        dossierId: "dossier-estacao-aurora",
        sourceId: "source-aurora-002",
        claim: "O diario de bordo descreve um ruido anormal e a selagem de uma porta pouco antes do apagao.",
        factType: "allegation",
        confidence: "likely",
        dateValue: null,
        people: [],
        places: ["Modulo de manutencao"],
        tags: ["ruido", "porta", "incerteza"],
        notes: "Manter como alegacao ate aparecer confirmacao cruzada.",
        createdAt,
        updatedAt: createdAt
      }
    ],
    researchTimelineEvents: [
      {
        id: "timeline-aurora-001",
        dossierId: "dossier-estacao-aurora",
        sourceId: "source-aurora-001",
        title: "Ultimo sinal manual",
        description: "A equipe envia o ultimo sinal manual 11 minutos antes do apagao total.",
        dateValue: "1998",
        order: 1,
        location: "Estacao Aurora",
        people: [],
        confidence: "confirmed",
        createdAt,
        updatedAt: createdAt
      },
      {
        id: "timeline-aurora-002",
        dossierId: "dossier-estacao-aurora",
        sourceId: "source-aurora-002",
        title: "Ruido e porta selada",
        description: "O diario registra ruido crescente e uma porta selada minutos antes da perda de energia.",
        dateValue: null,
        order: 2,
        location: "Modulo de manutencao",
        people: [],
        confidence: "likely",
        createdAt,
        updatedAt: createdAt
      }
    ],
    researchHooks: [
      {
        id: "hook-aurora-001",
        dossierId: "dossier-estacao-aurora",
        text: "O ultimo sinal da Estacao Aurora terminou 11 minutos antes do sumico total.",
        hookType: "mystery",
        strengthScore: 88,
        notes: "Abrir com cronologia seca e corte abrupto.",
        createdAt,
        updatedAt: createdAt
      }
    ],
    researchAssetRequirements: [
      {
        id: "req-aurora-001",
        dossierId: "dossier-estacao-aurora",
        sceneRole: "hook",
        description: "Mapa da estacao e interface de radio para abrir o caso.",
        mediaType: "map",
        suggestedTags: ["estacao", "radio", "ultimo sinal"],
        emotion: "MYSTERIOUS",
        priority: 95,
        fulfilledAssetId: null,
        visualSourceMode: null,
        characterProfileId: null,
        generatedAssetId: null,
        visualPrompt: null,
        generationStatus: null,
        generationProvider: null,
        createdAt,
        updatedAt: createdAt
      }
    ],
    researchOutlineScenes: [
      {
        id: "outline-aurora-001",
        dossierId: "dossier-estacao-aurora",
        order: 1,
        role: "hook",
        title: "O ultimo sinal",
        narrationDraft:
          "Onze minutos antes do apagao total, a equipe da Estacao Aurora ainda conseguiu enviar um ultimo sinal manual.",
        captionDraft: "O ultimo sinal veio 11 minutos antes do sumico",
        emotion: "MYSTERIOUS",
        visualPreset: "mystery",
        assetRequirementId: "req-aurora-001",
        estimatedDuration: 6.5,
        createdAt,
        updatedAt: createdAt
      }
    ],
    videoProjects: [
      {
        id: "proj-anime-lore-001",
        title: "A queda do cla Uchiha em 3 atos",
        status: "SCENE_PLANNING",
        channelId: "channel-anime-lore",
        script:
          "Hook sobre o misterio do cla. Contexto rapido sobre a tensao politica. Fechamento com pergunta para a audiencia.",
        durationTarget: 30,
        format: "9:16",
        templateId: "anime_dark",
        defaultCaptionStyle: "anime_punch",
        backgroundMusicAssetId: "asset-music-001",
        voiceoverAssetId: "asset-voice-001",
        audioMood: "dark_suspense",
        musicVolume: 0.16,
        voiceVolume: 1,
        sfxVolume: 0.72,
        enableAudioDucking: true,
        duckingLevel: 0.35,
        createdAt,
        updatedAt: createdAt
      }
    ],
    scenes: [
      {
        id: "scene-anime-001",
        videoProjectId: "proj-anime-lore-001",
        order: 1,
        title: "Hook sombrio",
        narrationText:
          "Pouca gente percebe como a tragedia comecou muito antes da noite final.",
        captionText: "A historia comecou antes do massacre",
        duration: 7.5,
        emotion: "MYSTERIOUS",
        assetId: "asset-anime-001",
        generatedAssetId: null,
        characterProfileId: null,
        sfxAssetId: "asset-sfx-001",
        sfxStartTime: 0.2,
        sfxVolume: 0.74,
        visualPreset: "mystery",
        visualSourceMode: null,
        visualPrompt: null,
        negativePrompt: null,
        visualRecipe: null,
        generationStatus: null,
        generationProvider: null,
        generationSeed: null,
        transition: "flash-cut",
        captionStyle: "anime_punch",
        captionPosition: "split",
        captionEmphasisWords: ["historia", "massacre"],
        energyLevel: 88,
        createdAt,
        updatedAt: createdAt
      },
      {
        id: "scene-anime-002",
        videoProjectId: "proj-anime-lore-001",
        order: 2,
        title: "Contexto do conflito",
        narrationText:
          "A ruptura entre poder, vigilancia e medo transformou cada gesto em suspeita.",
        captionText: "Quando medo e poder se misturam",
        duration: 11,
        emotion: "DARK",
        assetId: "asset-anime-002",
        generatedAssetId: null,
        characterProfileId: null,
        sfxAssetId: "asset-sfx-001",
        sfxStartTime: 0.9,
        sfxVolume: 0.62,
        visualPreset: "horror",
        visualSourceMode: null,
        visualPrompt: null,
        negativePrompt: null,
        visualRecipe: null,
        generationStatus: null,
        generationProvider: null,
        generationSeed: null,
        transition: "fade",
        captionStyle: "horror_whisper",
        captionPosition: "lower-third",
        captionEmphasisWords: ["medo", "poder"],
        energyLevel: 64,
        createdAt,
        updatedAt: createdAt
      },
      {
        id: "scene-anime-003",
        videoProjectId: "proj-anime-lore-001",
        order: 3,
        title: "Cliffhanger final",
        narrationText:
          "E se o verdadeiro ponto de nao retorno tiver acontecido muito antes do que contam?",
        captionText: "O ponto de nao retorno veio antes?",
        duration: 8.5,
        emotion: "CURIOUS",
        assetId: null,
        generatedAssetId: null,
        characterProfileId: null,
        sfxAssetId: "asset-sfx-001",
        sfxStartTime: 0.35,
        sfxVolume: 0.68,
        visualPreset: "suspense",
        visualSourceMode: null,
        visualPrompt: null,
        negativePrompt: null,
        visualRecipe: null,
        generationStatus: null,
        generationProvider: null,
        generationSeed: null,
        transition: "hard-cut",
        captionStyle: null,
        captionPosition: null,
        captionEmphasisWords: ["ponto", "retorno"],
        energyLevel: 74,
        createdAt,
        updatedAt: createdAt
      }
    ],
    renderJobs: [],
    visualGenerationJobs: []
  };
}

const memoryStudioState = createInitialState();

export function getMemoryStudioState(): MemoryStudioState {
  return memoryStudioState;
}

export function createMemoryId(prefix: string): string {
  return `${prefix}-${randomUUID()}`;
}

export function createTimestamp(): string {
  return new Date().toISOString();
}

