export const comfyWorkflowPackIds = [
  "anime_dark",
  "comic_drama",
  "true_crime_doc",
  "mystery_doc",
  "history_dark",
  "sports_hype",
  "game_epic",
  "cinematic_story",
  "horror_tension",
  "documentary_clean"
] as const;

export type ComfyWorkflowPackId = (typeof comfyWorkflowPackIds)[number];

export type SeedStrategy = "random" | "fixed" | "reuse" | "increment";

export interface ComfyWorkflowPack {
  id: ComfyWorkflowPackId;
  name: string;
  description: string;
  niche: string;
  recommendedWorkflowId: string;
  recommendedPromptPackId: string;
  recommendedNegativePromptPackId: string;
  defaultWidth: number;
  defaultHeight: number;
  defaultSeedStrategy: SeedStrategy;
  defaultQualityPreset: "draft" | "standard" | "high";
  styleNotes: string;
  cameraNotes: string;
  lightingNotes: string;
  compositionNotes: string;
  recommendedUse: string;
  limitations: string;
  supportsReferences: boolean;
  supportsImageToImage: boolean;
  providerCompatibility: string[];
}

export interface WorkflowPackSuggestion {
  pack: ComfyWorkflowPack;
  reason: string;
}

interface ResearchRequirementLike {
  description?: string | null;
  emotion?: string | null;
  mediaType?: string | null;
  sceneRole?: string | null;
  suggestedTags?: string[];
}

interface ChannelLike {
  niche?: string | null;
  visualStyle?: string | null;
  narrativeTone?: string | null;
}

interface SceneLike {
  title?: string | null;
  emotion?: string | null;
  visualPreset?: string | null;
  narrationText?: string | null;
  captionText?: string | null;
}

const workflowPacks: ComfyWorkflowPack[] = [
  {
    id: "anime_dark",
    name: "Anime Dark",
    description: "Anime dramatico com sombras densas, rim light e atmosfera de segredo.",
    niche: "anime lore",
    recommendedWorkflowId: "txt2img-basic",
    recommendedPromptPackId: "anime_dark",
    recommendedNegativePromptPackId: "clean_anime",
    defaultWidth: 1080,
    defaultHeight: 1920,
    defaultSeedStrategy: "reuse",
    defaultQualityPreset: "standard",
    styleNotes: "dark anime key art, sharp linework, subtle film grain, premium poster finish",
    cameraNotes: "close-up or low-angle framing with strong silhouette readability",
    lightingNotes: "cool rim light, controlled bloom, deep background separation",
    compositionNotes: "single focal subject, vertical negative space for captions",
    recommendedUse: "Anime lore, character reveals, betrayals, power scaling and mystery beats.",
    limitations: "Avoid exact franchise names unless the user explicitly provides rights/context.",
    supportsReferences: true,
    supportsImageToImage: true,
    providerCompatibility: ["mock-svg", "mock-png", "comfyui-local"]
  },
  {
    id: "comic_drama",
    name: "Comic Drama",
    description: "Drama de HQ com contraste alto, tinta editorial e gesto heroico.",
    niche: "comics",
    recommendedWorkflowId: "txt2img-basic",
    recommendedPromptPackId: "comic_drama",
    recommendedNegativePromptPackId: "clean_comic",
    defaultWidth: 1080,
    defaultHeight: 1920,
    defaultSeedStrategy: "reuse",
    defaultQualityPreset: "standard",
    styleNotes: "premium comic cover, inked shadows, halftone restraint, dramatic color blocks",
    cameraNotes: "heroic low angle, medium close-up, dynamic diagonal energy",
    lightingNotes: "hard key light, saturated rim accents, noir shadow pockets",
    compositionNotes: "cover-like focal triangle with caption-safe top/bottom margins",
    recommendedUse: "Comic commentary, origin stories, moral conflict and dramatic reveals.",
    limitations: "Do not mimic living artists or copyrighted panels directly.",
    supportsReferences: true,
    supportsImageToImage: true,
    providerCompatibility: ["mock-svg", "mock-png", "comfyui-local"]
  },
  {
    id: "true_crime_doc",
    name: "True Crime Doc",
    description: "Documentario sombrio com evidencias, textura analogica e tensao controlada.",
    niche: "true crime",
    recommendedWorkflowId: "txt2img-basic",
    recommendedPromptPackId: "true_crime_doc",
    recommendedNegativePromptPackId: "clean_photoreal",
    defaultWidth: 1080,
    defaultHeight: 1920,
    defaultSeedStrategy: "fixed",
    defaultQualityPreset: "standard",
    styleNotes: "investigative documentary frame, grounded realism, archival texture",
    cameraNotes: "evidence-table overhead, empty hallway, restrained close-up",
    lightingNotes: "practical lamp pools, cold shadows, low saturation",
    compositionNotes: "evidence cluster with strong negative space for subtitles",
    recommendedUse: "Cases, timelines, unresolved clues and cautionary documentary beats.",
    limitations: "Avoid gore, victim exploitation and identifiable real people without context.",
    supportsReferences: false,
    supportsImageToImage: false,
    providerCompatibility: ["mock-svg", "mock-png", "comfyui-local"]
  },
  {
    id: "mystery_doc",
    name: "Mystery Doc",
    description: "Misterio editorial com neblina, pistas simbolicas e atmosfera investigativa.",
    niche: "mystery",
    recommendedWorkflowId: "txt2img-basic",
    recommendedPromptPackId: "mystery_doc",
    recommendedNegativePromptPackId: "clean_dark_cinematic",
    defaultWidth: 1080,
    defaultHeight: 1920,
    defaultSeedStrategy: "reuse",
    defaultQualityPreset: "standard",
    styleNotes: "cinematic mystery still, fog, symbolic clue, premium documentary polish",
    cameraNotes: "slow push-in feeling, centered clue, soft depth",
    lightingNotes: "teal noir, low-key light, gentle haze",
    compositionNotes: "one clear visual question mark with caption-safe framing",
    recommendedUse: "Mysterious openings, clue reveals, paranormal or unsolved-history beats.",
    limitations: "Keep abstract when facts are uncertain; avoid fake evidence realism.",
    supportsReferences: false,
    supportsImageToImage: false,
    providerCompatibility: ["mock-svg", "mock-png", "comfyui-local"]
  },
  {
    id: "history_dark",
    name: "History Dark",
    description: "Historia sombria, textura de arquivo e composicao cinematografica sobria.",
    niche: "history",
    recommendedWorkflowId: "txt2img-basic",
    recommendedPromptPackId: "history_dark",
    recommendedNegativePromptPackId: "clean_history",
    defaultWidth: 1080,
    defaultHeight: 1920,
    defaultSeedStrategy: "fixed",
    defaultQualityPreset: "standard",
    styleNotes: "historical documentary concept art, aged paper, realistic atmosphere",
    cameraNotes: "museum display framing, wide establishing shot or solemn portrait",
    lightingNotes: "warm candle/torch accents, muted shadows, archival softness",
    compositionNotes: "historic object or location as focal anchor with clean caption lanes",
    recommendedUse: "Historical context, dark eras, battles, biographies and hidden causes.",
    limitations: "Do not present generated scenes as authentic archival photos.",
    supportsReferences: true,
    supportsImageToImage: true,
    providerCompatibility: ["mock-svg", "mock-png", "comfyui-local"]
  },
  {
    id: "sports_hype",
    name: "Sports Hype",
    description: "Energia esportiva, impacto, motion streaks e composicao de thumbnail premium.",
    niche: "sports",
    recommendedWorkflowId: "txt2img-basic",
    recommendedPromptPackId: "sports_hype",
    recommendedNegativePromptPackId: "clean_sports",
    defaultWidth: 1080,
    defaultHeight: 1920,
    defaultSeedStrategy: "random",
    defaultQualityPreset: "draft",
    styleNotes: "sports promo key art, kinetic lighting, glossy arena atmosphere",
    cameraNotes: "telephoto impact frame, athlete silhouette, dramatic crop",
    lightingNotes: "stadium rim lights, bold color accents, high contrast",
    compositionNotes: "big diagonal movement, clear focal body shape, title-safe center",
    recommendedUse: "Highlights, rivalries, comeback stories and hype intros.",
    limitations: "Avoid real athlete likeness unless assets/rights are provided.",
    supportsReferences: true,
    supportsImageToImage: true,
    providerCompatibility: ["mock-svg", "mock-png", "comfyui-local"]
  },
  {
    id: "game_epic",
    name: "Game Epic",
    description: "Fantasia/game cinematic com escala, energia epica e leitura vertical forte.",
    niche: "gaming",
    recommendedWorkflowId: "txt2img-basic",
    recommendedPromptPackId: "game_epic",
    recommendedNegativePromptPackId: "clean_dark_cinematic",
    defaultWidth: 1080,
    defaultHeight: 1920,
    defaultSeedStrategy: "reuse",
    defaultQualityPreset: "high",
    styleNotes: "epic game key art, volumetric light, high-detail environment, cinematic polish",
    cameraNotes: "wide heroic composition or boss-scale low angle",
    lightingNotes: "gold/cyan contrast, magical rim glow, controlled particles",
    compositionNotes: "large scale subject, depth layers, caption-safe lower third",
    recommendedUse: "Game lore, boss fights, endings, theories and worldbuilding scenes.",
    limitations: "Avoid direct reproduction of game characters unless user supplies references.",
    supportsReferences: true,
    supportsImageToImage: true,
    providerCompatibility: ["mock-svg", "mock-png", "comfyui-local"]
  },
  {
    id: "cinematic_story",
    name: "Cinematic Story",
    description: "Preset geral cinematografico para storytelling vertical premium.",
    niche: "cinematic storytelling",
    recommendedWorkflowId: "txt2img-basic",
    recommendedPromptPackId: "cinematic_story",
    recommendedNegativePromptPackId: "clean_dark_cinematic",
    defaultWidth: 1080,
    defaultHeight: 1920,
    defaultSeedStrategy: "reuse",
    defaultQualityPreset: "standard",
    styleNotes: "cinematic editorial keyframe, filmic contrast, premium short-form story mood",
    cameraNotes: "story-driven medium shot, subtle depth, clear subject hierarchy",
    lightingNotes: "motivated light, controlled glow, cinematic shadows",
    compositionNotes: "clean vertical keyframe with room for captions and motion crop",
    recommendedUse: "Default pack for general narrative videos and mixed niches.",
    limitations: "Generic by design; choose niche packs for stronger art direction.",
    supportsReferences: true,
    supportsImageToImage: true,
    providerCompatibility: ["mock-svg", "mock-png", "comfyui-local"]
  },
  {
    id: "horror_tension",
    name: "Horror Tension",
    description: "Tensao horror sem gore, com sombra, silhueta e desconforto cinematografico.",
    niche: "horror",
    recommendedWorkflowId: "txt2img-basic",
    recommendedPromptPackId: "horror_tension",
    recommendedNegativePromptPackId: "clean_dark_cinematic",
    defaultWidth: 1080,
    defaultHeight: 1920,
    defaultSeedStrategy: "random",
    defaultQualityPreset: "standard",
    styleNotes: "psychological horror keyframe, dread atmosphere, no gore, premium darkness",
    cameraNotes: "doorway silhouette, claustrophobic close-up, off-center framing",
    lightingNotes: "single practical light, red/green undertone, heavy falloff",
    compositionNotes: "negative space suggests threat while preserving caption readability",
    recommendedUse: "Creepy hooks, suspense escalations and dark mystery climaxes.",
    limitations: "Keep non-graphic; avoid shock gore and identifiable victim imagery.",
    supportsReferences: false,
    supportsImageToImage: false,
    providerCompatibility: ["mock-svg", "mock-png", "comfyui-local"]
  },
  {
    id: "documentary_clean",
    name: "Documentary Clean",
    description: "Look documental limpo, confiavel, claro e facil de renderizar.",
    niche: "documentary",
    recommendedWorkflowId: "txt2img-basic",
    recommendedPromptPackId: "documentary_clean",
    recommendedNegativePromptPackId: "clean_documentary",
    defaultWidth: 1080,
    defaultHeight: 1920,
    defaultSeedStrategy: "fixed",
    defaultQualityPreset: "standard",
    styleNotes: "clean documentary visual, realistic editorial lighting, restrained texture",
    cameraNotes: "stable composition, evidence or subject centered, readable background",
    lightingNotes: "soft key light, neutral contrast, honest color",
    compositionNotes: "clear focal point, generous safe area for captions and charts",
    recommendedUse: "Explainers, factual dossiers, research summaries and neutral context.",
    limitations: "Less expressive for high-drama hooks; pair with cinematic_story for climax.",
    supportsReferences: true,
    supportsImageToImage: true,
    providerCompatibility: ["mock-svg", "mock-png", "comfyui-local"]
  }
];

function normalizeText(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFKD")
    .replace(/[^\x00-\x7F]/g, "")
    .toLowerCase();
}

function textIncludesAny(value: string, tokens: string[]) {
  return tokens.some((token) => value.includes(token));
}

function suggestion(packId: ComfyWorkflowPackId, reason: string): WorkflowPackSuggestion {
  return {
    pack: getComfyWorkflowPackById(packId) ?? workflowPacks[0]!,
    reason
  };
}

export function getComfyWorkflowPacks() {
  return [...workflowPacks];
}

export function getComfyWorkflowPackById(id: string | null | undefined) {
  return workflowPacks.find((pack) => pack.id === id) ?? null;
}

export function suggestWorkflowPackByNiche(
  niche: string | null | undefined
): WorkflowPackSuggestion {
  const normalized = normalizeText(niche);

  if (textIncludesAny(normalized, ["anime", "manga", "lore"])) {
    return suggestion("anime_dark", "Nicho detectado como anime/lore.");
  }

  if (textIncludesAny(normalized, ["hq", "comic", "quadrinho", "superhero"])) {
    return suggestion("comic_drama", "Nicho detectado como HQ/comics.");
  }

  if (textIncludesAny(normalized, ["crime", "criminal", "true crime"])) {
    return suggestion("true_crime_doc", "Nicho investigativo/true crime.");
  }

  if (textIncludesAny(normalized, ["misterio", "mystery", "unsolved", "paranormal"])) {
    return suggestion("mystery_doc", "Nicho de misterio ou caso nao resolvido.");
  }

  if (textIncludesAny(normalized, ["historia", "history", "ancient", "war"])) {
    return suggestion("history_dark", "Nicho historico detectado.");
  }

  if (textIncludesAny(normalized, ["sport", "futebol", "basket", "corrida"])) {
    return suggestion("sports_hype", "Nicho esportivo com energia alta.");
  }

  if (textIncludesAny(normalized, ["game", "gaming", "rpg", "boss"])) {
    return suggestion("game_epic", "Nicho de games/epic lore.");
  }

  if (textIncludesAny(normalized, ["horror", "terror", "creepy", "dark"])) {
    return suggestion("horror_tension", "Nicho sombrio/horror.");
  }

  if (textIncludesAny(normalized, ["doc", "documentary", "explicativo"])) {
    return suggestion("documentary_clean", "Nicho documental/explicativo.");
  }

  return suggestion("cinematic_story", "Fallback cinematografico geral.");
}

export function suggestWorkflowPackByChannel(
  channel: ChannelLike | null | undefined
): WorkflowPackSuggestion {
  const reasonParts = [
    channel?.niche ? `nicho '${channel.niche}'` : null,
    channel?.visualStyle ? `visual '${channel.visualStyle}'` : null,
    channel?.narrativeTone ? `tom '${channel.narrativeTone}'` : null
  ].filter(Boolean);
  const suggestionByNiche = suggestWorkflowPackByNiche(
    [channel?.niche, channel?.visualStyle, channel?.narrativeTone].join(" ")
  );

  return {
    pack: suggestionByNiche.pack,
    reason: reasonParts.length
      ? `Sugestao por canal: ${reasonParts.join(", ")}.`
      : suggestionByNiche.reason
  };
}

export function suggestWorkflowPackByTemplate(
  templateId: string | null | undefined
): WorkflowPackSuggestion {
  const normalized = normalizeText(templateId);
  return suggestWorkflowPackByNiche(normalized);
}

export function suggestWorkflowPackByScene(
  scene: SceneLike | null | undefined
): WorkflowPackSuggestion {
  const text = normalizeText(
    [
      scene?.title,
      scene?.emotion,
      scene?.visualPreset,
      scene?.narrationText,
      scene?.captionText
    ].join(" ")
  );

  if (textIncludesAny(text, ["horror", "terror", "fear", "scary", "creepy"])) {
    return suggestion("horror_tension", "Cena com emocao/tema de tensao ou horror.");
  }

  if (textIncludesAny(text, ["climax", "epic", "final", "boss", "battle"])) {
    return suggestion("game_epic", "Cena com leitura epica ou climax.");
  }

  if (textIncludesAny(text, ["crime", "evidence", "investigation", "suspect"])) {
    return suggestion("true_crime_doc", "Cena investigativa/evidencial.");
  }

  if (textIncludesAny(text, ["mystery", "misterio", "secret", "hidden"])) {
    return suggestion("mystery_doc", "Cena baseada em misterio ou segredo.");
  }

  return suggestion("cinematic_story", "Cena narrativa geral; pack cinematografico e seguro.");
}

export function suggestWorkflowPackByResearchRequirement(
  requirement: ResearchRequirementLike | null | undefined
): WorkflowPackSuggestion {
  const text = normalizeText(
    [
      requirement?.description,
      requirement?.emotion,
      requirement?.mediaType,
      requirement?.sceneRole,
      ...(requirement?.suggestedTags ?? [])
    ].join(" ")
  );

  if (textIncludesAny(text, ["crime", "evidence", "source", "case"])) {
    return suggestion("true_crime_doc", "Requirement pede visual investigativo/evidencial.");
  }

  if (textIncludesAny(text, ["history", "historic", "arquivo", "timeline"])) {
    return suggestion("history_dark", "Requirement historico/arquivo.");
  }

  if (textIncludesAny(text, ["horror", "tension", "fear", "dark"])) {
    return suggestion("horror_tension", "Requirement pede tensao sombria.");
  }

  if (textIncludesAny(text, ["mystery", "secret", "unknown"])) {
    return suggestion("mystery_doc", "Requirement pede clima de misterio.");
  }

  return suggestion("documentary_clean", "Requirement de pesquisa prioriza clareza documental.");
}
