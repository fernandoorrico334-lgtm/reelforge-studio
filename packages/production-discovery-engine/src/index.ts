export const productionDiscoveryNiches = [
  "true_crime",
  "football",
  "comics",
  "anime",
  "movies",
  "games",
  "history",
  "mystery",
  "documentary",
  "generic"
] as const;

export type ProductionDiscoveryNiche =
  (typeof productionDiscoveryNiches)[number];

export type VisualRequirementMediaType =
  | "image"
  | "video"
  | "microclip"
  | "document"
  | "map"
  | "generated_image"
  | "card"
  | "sfx";

export type VisualRequirementImportance =
  | "low"
  | "medium"
  | "high"
  | "must_have";

export type VisualRequirementFallback =
  | "local_asset"
  | "generated_image"
  | "media_candidate"
  | "text_card";

export interface NicheProfile {
  id: ProductionDiscoveryNiche;
  name: string;
  description: string;
  defaultTemplates: string[];
  defaultTone: string;
  defaultStructure: string[];
  researchFocus: string[];
  entityTypes: string[];
  mediaNeeds: string[];
  sourceSuggestions: string[];
  visualStyle: string;
  safetyRules: string[];
  recommendedWorkflowPackId: string;
  recommendedMusicPresetId: string;
  recommendedAudioMasteringPresetId: string;
  recommendedEditingPresetUseCase: string;
  defaultSceneRoles: string[];
}

export interface BuildNicheResearchQueriesInput {
  topic: string;
  niche: ProductionDiscoveryNiche | string;
  angle?: string | null;
  language?: string | null;
}

export interface NicheResearchQueries {
  researchQueries: string[];
  mediaQueries: string[];
  entityQueries: string[];
  sourceDiscoveryLinks: string[];
  suggestedFactsToFind: string[];
  suggestedMediaToFind: string[];
}

export interface NicheDossier {
  topic: string;
  niche: ProductionDiscoveryNiche;
  title: string;
  angle: string | null;
  language: string;
  tone: string;
  summary: string;
  entities: Array<{ type: string; name: string; notes: string }>;
  timeline: Array<{ order: number; title: string; description: string }>;
  facts: Array<{ claim: string; confidence: "confirmed" | "uncertain" }>;
  uncertainties: string[];
  editorialSafety: string[];
  outline: NicheOutlineScene[];
  assetSeeds: string[];
}

export interface NicheOutlineScene {
  order: number;
  role: string;
  title: string;
  narrationDraft: string;
  captionDraft: string;
  emotion: string;
  estimatedDuration: number;
}

export interface VisualRequirement {
  id: string;
  sceneOrder: number;
  role: string;
  narrationGoal: string;
  visualNeedDescription: string;
  mediaType: VisualRequirementMediaType;
  suggestedQueries: string[];
  suggestedTags: string[];
  fallbackStrategy: VisualRequirementFallback;
  importance: VisualRequirementImportance;
  requiresUserReview: boolean;
}

const genericSafetyRules = [
  "Tratar toda midia candidata como pendente ate revisao do usuario.",
  "Nunca baixar automaticamente; criar apenas candidatos e avisos.",
  "Sinalizar licenca desconhecida sem descartar automaticamente."
];

const profiles: Record<ProductionDiscoveryNiche, NicheProfile> = {
  football: {
    id: "football",
    name: "Football",
    description: "Analises de jogadores, times, taticas e momentos de jogo.",
    defaultTemplates: ["player_threat_analysis", "rivalry_breakdown"],
    defaultTone: "hype",
    defaultStructure: ["hook", "context", "threat", "weakness", "climax", "cta"],
    researchFocus: ["estatisticas", "momento atual", "pontos fortes", "pontos fracos", "contexto do confronto"],
    entityTypes: ["player", "team", "match", "competition", "tactic", "stadium"],
    mediaNeeds: ["portrait", "stadium", "tactical_card", "microclip", "generated_image", "crowd", "stat_card"],
    sourceSuggestions: ["biblioteca local", "Wikimedia", "press kit autorizado", "microclips locais/autorizados"],
    visualStyle: "cortes rapidos, cards taticos, energia alta e microclips de impacto",
    safetyRules: [
      ...genericSafetyRules,
      "Clipes oficiais podem ter restricao; usar apenas material local/autorizado."
    ],
    recommendedWorkflowPackId: "cinematic_story",
    recommendedMusicPresetId: "football_hype",
    recommendedAudioMasteringPresetId: "football_hype",
    recommendedEditingPresetUseCase: "football_hype",
    defaultSceneRoles: ["hook", "context", "threat", "proof", "climax", "cta"]
  },
  true_crime: {
    id: "true_crime",
    name: "True Crime",
    description: "Dossies factuais, linha do tempo e narrativa documental segura.",
    defaultTemplates: ["documentary_case_file", "mystery_timeline"],
    defaultTone: "dark documentary",
    defaultStructure: ["hook", "case_context", "timeline", "uncertainty", "resolution", "cta"],
    researchFocus: ["timeline", "local", "investigacao", "tribunal", "fontes", "pontos incertos"],
    entityTypes: ["person", "location", "date", "event", "investigation", "court"],
    mediaNeeds: ["map", "document", "archive_photo", "newspaper", "location", "text_card", "generated_image"],
    sourceSuggestions: ["fontes publicas", "arquivos locais", "mapas fornecidos", "documentos autorizados"],
    visualStyle: "baixo contraste, cards documentais, mapas e documentos com cuidado editorial",
    safetyRules: [
      ...genericSafetyRules,
      "Nao glorificar criminosos.",
      "Separar fato confirmado de alegacao.",
      "Evitar detalhes graficos e linguagem sensacionalista."
    ],
    recommendedWorkflowPackId: "true_crime_doc",
    recommendedMusicPresetId: "true_crime_dark",
    recommendedAudioMasteringPresetId: "true_crime_dark",
    recommendedEditingPresetUseCase: "true_crime_dark",
    defaultSceneRoles: ["hook", "context", "timeline", "evidence", "uncertainty", "cta"]
  },
  comics: {
    id: "comics",
    name: "Comics",
    description: "Breakdowns de personagem, origem, poderes, feitos e comparacoes.",
    defaultTemplates: ["character_power_breakdown", "origin_story"],
    defaultTone: "epic analysis",
    defaultStructure: ["hook", "origin", "powers", "feat", "comparison", "cta"],
    researchFocus: ["origem", "poderes", "arcos", "feitos", "rivais", "comparacoes"],
    entityTypes: ["character", "power", "origin", "arc", "feat", "rival"],
    mediaNeeds: ["comic_panel", "generated_image", "power_card", "comparison_card", "visual_proof_insert"],
    sourceSuggestions: ["paineis fornecidos pelo usuario", "assets locais", "imagens geradas"],
    visualStyle: "textura de quadrinho, cards de poder e prova visual revisada",
    safetyRules: [
      ...genericSafetyRules,
      "Paineis oficiais podem ter restricao; revisar antes de importar."
    ],
    recommendedWorkflowPackId: "comic_drama",
    recommendedMusicPresetId: "cinematic_epic",
    recommendedAudioMasteringPresetId: "cinematic_epic",
    recommendedEditingPresetUseCase: "cinematic_epic",
    defaultSceneRoles: ["hook", "origin", "power", "feat", "comparison", "cta"]
  },
  anime: {
    id: "anime",
    name: "Anime",
    description: "Lore e analise de personagem/arco com assets locais ou gerados.",
    defaultTemplates: ["character_power_breakdown"],
    defaultTone: "dramatic lore",
    defaultStructure: ["hook", "origin", "power", "arc", "climax", "cta"],
    researchFocus: ["origem", "habilidades", "arco", "rival", "transformacao"],
    entityTypes: ["character", "power", "arc", "rival", "form"],
    mediaNeeds: ["generated_image", "character_card", "power_card", "user_panel", "visual_proof_insert"],
    sourceSuggestions: ["assets fornecidos pelo usuario", "imagens geradas", "cards textuais"],
    visualStyle: "contraste dramatico, energia alta e foco em personagem",
    safetyRules: [...genericSafetyRules, "Cenas oficiais devem ser revisadas pelo usuario antes de uso."],
    recommendedWorkflowPackId: "anime_dark",
    recommendedMusicPresetId: "cinematic_epic",
    recommendedAudioMasteringPresetId: "cinematic_epic",
    recommendedEditingPresetUseCase: "cinematic_epic",
    defaultSceneRoles: ["hook", "origin", "power", "tension", "climax", "cta"]
  },
  movies: {
    id: "movies",
    name: "Movies",
    description: "Analise documental/critica com foco em cenas autorizadas ou geradas.",
    defaultTemplates: ["documentary_case_file"],
    defaultTone: "cinematic analysis",
    defaultStructure: ["hook", "context", "scene", "meaning", "climax", "cta"],
    researchFocus: ["contexto", "personagens", "temas", "bastidores", "analise de cena"],
    entityTypes: ["movie", "character", "scene", "director", "theme"],
    mediaNeeds: ["generated_image", "poster_card", "scene_reference", "text_card"],
    sourceSuggestions: ["assets locais", "press kit autorizado", "imagens geradas"],
    visualStyle: "cinematico, limpo, com cards de cena",
    safetyRules: [...genericSafetyRules, "Cenas oficiais devem passar por revisao de uso."],
    recommendedWorkflowPackId: "cinematic_story",
    recommendedMusicPresetId: "cinematic_epic",
    recommendedAudioMasteringPresetId: "documentary_clean",
    recommendedEditingPresetUseCase: "cinematic_epic",
    defaultSceneRoles: ["hook", "context", "analysis", "meaning", "resolution", "cta"]
  },
  games: {
    id: "games",
    name: "Games",
    description: "Lore, mecanicas, personagens e momentos de gameplay autorizados.",
    defaultTemplates: ["character_power_breakdown"],
    defaultTone: "epic gameplay",
    defaultStructure: ["hook", "context", "mechanic", "proof", "climax", "cta"],
    researchFocus: ["lore", "personagens", "mecanicas", "itens", "chefes", "comunidade"],
    entityTypes: ["character", "game", "mechanic", "boss", "item", "map"],
    mediaNeeds: ["game_card", "generated_image", "local_clip", "screenshot", "map"],
    sourceSuggestions: ["screenshots proprios", "clipes locais/autorizados", "imagens geradas"],
    visualStyle: "game epic, HUD cards e cortes energeticos",
    safetyRules: [...genericSafetyRules, "Gameplay de terceiros deve ser autorizado pelo usuario."],
    recommendedWorkflowPackId: "game_epic",
    recommendedMusicPresetId: "viral_fast_cut",
    recommendedAudioMasteringPresetId: "viral_fast_cut",
    recommendedEditingPresetUseCase: "viral_fast_cut",
    defaultSceneRoles: ["hook", "context", "mechanic", "proof", "climax", "cta"]
  },
  history: {
    id: "history",
    name: "History",
    description: "Narrativa historica com mapas, datas, eventos e personagens.",
    defaultTemplates: ["documentary_case_file"],
    defaultTone: "documentary",
    defaultStructure: ["hook", "context", "timeline", "turning_point", "legacy", "cta"],
    researchFocus: ["datas", "locais", "personagens", "eventos", "fontes primarias"],
    entityTypes: ["person", "location", "date", "event", "document"],
    mediaNeeds: ["map", "document", "archive_photo", "generated_image", "timeline_card"],
    sourceSuggestions: ["Wikimedia", "arquivos publicos", "biblioteca local"],
    visualStyle: "documental escuro, mapas e cards historicos",
    safetyRules: [...genericSafetyRules, "Marcar fonte ausente como incerta."],
    recommendedWorkflowPackId: "history_dark",
    recommendedMusicPresetId: "documentary_clean",
    recommendedAudioMasteringPresetId: "documentary_clean",
    recommendedEditingPresetUseCase: "documentary_clean",
    defaultSceneRoles: ["hook", "context", "timeline", "turning_point", "resolution", "cta"]
  },
  mystery: {
    id: "mystery",
    name: "Mystery",
    description: "Misterios, teorias e investigacao leve com cuidado de incerteza.",
    defaultTemplates: ["mystery_timeline"],
    defaultTone: "suspense",
    defaultStructure: ["hook", "clue", "context", "theory", "uncertainty", "cta"],
    researchFocus: ["pistas", "locais", "datas", "teorias", "incertezas"],
    entityTypes: ["event", "location", "person", "clue", "theory"],
    mediaNeeds: ["map", "generated_image", "document", "text_card", "ambient"],
    sourceSuggestions: ["fontes publicas", "assets locais", "imagens geradas"],
    visualStyle: "suspense limpo, pistas e mapas",
    safetyRules: [...genericSafetyRules, "Separar teoria de fato confirmado."],
    recommendedWorkflowPackId: "mystery_doc",
    recommendedMusicPresetId: "true_crime_dark",
    recommendedAudioMasteringPresetId: "true_crime_dark",
    recommendedEditingPresetUseCase: "true_crime_dark",
    defaultSceneRoles: ["hook", "clue", "context", "tension", "uncertainty", "cta"]
  },
  documentary: {
    id: "documentary",
    name: "Documentary",
    description: "Conteudo explicativo limpo, factual e visualmente organizado.",
    defaultTemplates: ["documentary_case_file"],
    defaultTone: "clean documentary",
    defaultStructure: ["hook", "context", "fact", "development", "resolution", "cta"],
    researchFocus: ["contexto", "dados", "fontes", "personagens", "locais"],
    entityTypes: ["person", "location", "event", "data", "source"],
    mediaNeeds: ["document", "photo", "map", "generated_image", "text_card"],
    sourceSuggestions: ["fontes publicas", "biblioteca local", "Wikimedia"],
    visualStyle: "limpo, editorial, legivel",
    safetyRules: genericSafetyRules,
    recommendedWorkflowPackId: "documentary_clean",
    recommendedMusicPresetId: "documentary_clean",
    recommendedAudioMasteringPresetId: "documentary_clean",
    recommendedEditingPresetUseCase: "documentary_clean",
    defaultSceneRoles: ["hook", "context", "fact", "development", "resolution", "cta"]
  },
  generic: {
    id: "generic",
    name: "Generic",
    description: "Descoberta geral para temas ainda sem nicho especifico.",
    defaultTemplates: ["documentary_case_file"],
    defaultTone: "informative",
    defaultStructure: ["hook", "context", "detail", "tension", "resolution", "cta"],
    researchFocus: ["contexto", "fatos", "entidades", "fontes", "visuais"],
    entityTypes: ["topic", "person", "location", "event"],
    mediaNeeds: ["generated_image", "text_card", "local_asset", "document"],
    sourceSuggestions: ["biblioteca local", "fontes publicas", "imagens geradas"],
    visualStyle: "editorial flexivel",
    safetyRules: genericSafetyRules,
    recommendedWorkflowPackId: "cinematic_story",
    recommendedMusicPresetId: "shorts_clean_voice",
    recommendedAudioMasteringPresetId: "shorts_clean_voice",
    recommendedEditingPresetUseCase: "documentary_clean",
    defaultSceneRoles: ["hook", "context", "detail", "tension", "resolution", "cta"]
  }
};

function normalizeNiche(value: string | null | undefined): ProductionDiscoveryNiche {
  const normalized = (value ?? "generic").trim().toLowerCase().replaceAll("-", "_");
  return productionDiscoveryNiches.includes(normalized as ProductionDiscoveryNiche)
    ? (normalized as ProductionDiscoveryNiche)
    : "generic";
}

function cleanText(value: string | null | undefined, fallback: string) {
  const text = (value ?? "").trim().replace(/\s+/g, " ");
  return text.length > 0 ? text : fallback;
}

function unique(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

export function getNicheProfiles() {
  return productionDiscoveryNiches.map((niche) => profiles[niche]);
}

export function getNicheProfileById(id: string | null | undefined) {
  return profiles[normalizeNiche(id)];
}

export function buildNicheResearchQueries(
  input: BuildNicheResearchQueriesInput
): NicheResearchQueries {
  const profile = getNicheProfileById(input.niche);
  const topic = cleanText(input.topic, "tema do video");
  const angle = cleanText(input.angle, profile.defaultTone);
  const language = cleanText(input.language, "pt-BR");

  const researchQueries = unique([
    `${topic} contexto ${language}`,
    `${topic} ${angle}`,
    ...profile.researchFocus.map((focus) => `${topic} ${focus}`),
    ...profile.entityTypes.slice(0, 4).map((entity) => `${topic} ${entity}`)
  ]);

  const mediaQueries = unique([
    ...profile.mediaNeeds.map((need) => `${topic} ${need}`),
    `${topic} visual reference`,
    `${topic} public domain media`,
    `${topic} local authorized asset`
  ]);

  return {
    researchQueries,
    mediaQueries,
    entityQueries: profile.entityTypes.map((entity) => `${topic} ${entity}`),
    sourceDiscoveryLinks: profile.sourceSuggestions.map(
      (source) => `${source}: pesquisar manualmente por "${topic}"`
    ),
    suggestedFactsToFind: profile.researchFocus.map(
      (focus) => `Encontrar ${focus} sobre ${topic}`
    ),
    suggestedMediaToFind: profile.mediaNeeds.map(
      (need) => `Encontrar ${need} para ${topic}`
    )
  };
}

export function buildNicheDossier(input: BuildNicheResearchQueriesInput): NicheDossier {
  const profile = getNicheProfileById(input.niche);
  const topic = cleanText(input.topic, "Tema do video");
  const angle = cleanText(input.angle, profile.defaultTone);
  const language = cleanText(input.language, "pt-BR");

  const outline = profile.defaultSceneRoles.slice(0, 6).map((role, index) => {
    const order = index + 1;
    return {
      order,
      role,
      title: `${role.toUpperCase()}: ${topic}`,
      narrationDraft:
        order === 1
          ? `E se ${topic} for mais importante do que parece?`
          : `Agora olhe para ${topic} pelo angulo: ${angle}.`,
      captionDraft:
        order === 1 ? `${topic}: o ponto que muda tudo` : `${role}: ${angle}`,
      emotion:
        profile.id === "football"
          ? "EPIC"
          : profile.id === "true_crime" || profile.id === "mystery"
            ? "TENSE"
            : "MYSTERIOUS",
      estimatedDuration: order === 1 ? 4 : 6
    };
  });

  return {
    topic,
    niche: profile.id,
    title: `${topic} - ${profile.name}`,
    angle,
    language,
    tone: profile.defaultTone,
    summary: `${profile.name}: pacote deterministico para "${topic}" com foco em ${angle}.`,
    entities: profile.entityTypes.slice(0, 6).map((type) => ({
      type,
      name: `${topic} / ${type}`,
      notes: `Entidade sugerida para pesquisa ${type}.`
    })),
    timeline: profile.defaultStructure.map((step, index) => ({
      order: index + 1,
      title: step,
      description: `Bloco ${index + 1} da narrativa: ${step}.`
    })),
    facts: profile.researchFocus.slice(0, 5).map((focus) => ({
      claim: `Verificar ${focus} sobre ${topic}.`,
      confidence: "uncertain"
    })),
    uncertainties: [
      "Fontes publicas ainda precisam de revisao humana.",
      "Midias candidatas nao devem ser importadas sem confirmacao."
    ],
    editorialSafety: profile.safetyRules,
    outline,
    assetSeeds: profile.mediaNeeds
  };
}

export function buildVisualRequirementsFromDossier(
  dossier: NicheDossier,
  profile: NicheProfile = getNicheProfileById(dossier.niche)
): VisualRequirement[] {
  return dossier.outline.map((scene, index) => {
    const mediaNeed = profile.mediaNeeds[index % profile.mediaNeeds.length] ?? "generated_image";
    const mediaType: VisualRequirementMediaType =
      mediaNeed.includes("microclip") || scene.role.includes("proof")
        ? "microclip"
        : mediaNeed.includes("map")
          ? "map"
          : mediaNeed.includes("document") || mediaNeed.includes("newspaper")
            ? "document"
            : mediaNeed.includes("card")
              ? "card"
              : "generated_image";

    return {
      id: `req-${dossier.niche}-${scene.order}`,
      sceneOrder: scene.order,
      role: scene.role,
      narrationGoal: scene.narrationDraft,
      visualNeedDescription: `${mediaNeed} para ${scene.title}`,
      mediaType,
      suggestedQueries: unique([
        `${dossier.topic} ${mediaNeed}`,
        `${dossier.topic} ${scene.role}`,
        `${dossier.topic} ${profile.visualStyle}`
      ]),
      suggestedTags: unique([dossier.niche, scene.role, mediaNeed, ...profile.entityTypes.slice(0, 2)]),
      fallbackStrategy:
        mediaType === "microclip" ? "media_candidate" : "generated_image",
      importance: scene.order <= 2 ? "must_have" : scene.role === "cta" ? "medium" : "high",
      requiresUserReview: mediaType !== "generated_image"
    };
  });
}

export function buildDiscoveryTitle(topic: string, profile: NicheProfile) {
  return `${cleanText(topic, "Novo Reel")} (${profile.name})`;
}

export function buildDiscoveryWarnings(profile: NicheProfile) {
  return [
    ...profile.safetyRules,
    "Candidate-first ativo: search cria candidato, importacao exige acao do usuario."
  ];
}
