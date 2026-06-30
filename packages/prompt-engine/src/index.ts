export const visualPromptPackIds = [
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

export const negativePromptPackIds = [
  "clean_anime",
  "clean_documentary",
  "clean_photoreal",
  "clean_comic",
  "clean_dark_cinematic",
  "clean_sports",
  "clean_history"
] as const;

export const promptVariantTypes = [
  "close-up",
  "wide-shot",
  "dramatic-low-angle",
  "silhouette-shot",
  "action-impact-frame",
  "documentary-evidence-frame",
  "emotional-portrait",
  "environment-establishing-shot"
] as const;

export type VisualPromptPackId = (typeof visualPromptPackIds)[number];
export type NegativePromptPackId = (typeof negativePromptPackIds)[number];
export type PromptVariantType = (typeof promptVariantTypes)[number];

export interface VisualPromptPack {
  id: VisualPromptPackId;
  name: string;
  description: string;
  composition: string;
  camera: string;
  lighting: string;
  colorPalette: string;
  mood: string;
  texture: string;
  aspectRatio: "9:16";
  qualityTags: string[];
  styleTags: string[];
  recommendedNegativePack: NegativePromptPackId;
  recommendedProvider: string;
  recommendedWorkflow: string;
  promptTemplate: string;
}

export interface NegativePromptPack {
  id: NegativePromptPackId;
  name: string;
  description: string;
  negativeTerms: string[];
  anatomyTerms: string[];
  artifactTerms: string[];
  textTerms: string[];
  watermarkTerms: string[];
  lowQualityTerms: string[];
  styleAvoidanceTerms: string[];
}

export interface PromptSceneInput {
  id?: string;
  title?: string | null;
  narrationText?: string | null;
  captionText?: string | null;
  emotion?: string | null;
  visualPreset?: string | null;
  energyLevel?: number | null;
  visualPrompt?: string | null;
  negativePrompt?: string | null;
}

export interface PromptProjectInput {
  id?: string;
  title?: string | null;
  script?: string | null;
  format?: string | null;
  templateId?: string | null;
}

export interface PromptChannelInput {
  id?: string;
  name?: string | null;
  niche?: string | null;
  visualStyle?: string | null;
  narrativeTone?: string | null;
  defaultTemplate?: string | null;
}

export interface PromptCharacterReferenceInput {
  title?: string | null;
  notes?: string | null;
  referenceType?: string | null;
  tags?: string[];
}

export interface PromptCharacterProfileInput {
  id?: string;
  name?: string | null;
  franchise?: string | null;
  description?: string | null;
  basePrompt?: string | null;
  negativePrompt?: string | null;
  styleNotes?: string | null;
  defaultVisualStyle?: string | null;
  tags?: string[];
  references?: PromptCharacterReferenceInput[];
}

export interface PromptResearchRequirementInput {
  id?: string;
  description?: string | null;
  suggestedTags?: string[];
  emotion?: string | null;
  mediaType?: string | null;
  sceneRole?: string | null;
}

export interface PromptContext {
  projectId: string | null;
  sceneId: string | null;
  researchRequirementId: string | null;
  templateId: string | null;
  promptPackId: VisualPromptPackId;
  negativePackId: NegativePromptPackId;
  variantType: PromptVariantType | null;
  niche: string | null;
  emotion: string | null;
  subjectText: string;
  actionText: string;
  environmentText: string;
  manualPrompt: string | null;
  manualNegativePrompt: string | null;
  userBasePrompt: string | null;
  styleText: string;
  qualityText: string;
  constraintsText: string;
  supportTags: string[];
  protectedTerms: string[];
  allowedProtectedTerms: string[];
  promptPack: VisualPromptPack;
  negativePack: NegativePromptPack;
  channel: PromptChannelInput | null;
}

export interface PromptBuildInput {
  scene?: PromptSceneInput | null;
  project?: PromptProjectInput | null;
  channel?: PromptChannelInput | null;
  characterProfile?: PromptCharacterProfileInput | null;
  researchAssetRequirement?: PromptResearchRequirementInput | null;
  templateId?: string | null;
  promptPackId?: VisualPromptPackId | null;
  negativePackId?: NegativePromptPackId | null;
  variantType?: PromptVariantType | null;
  supportTags?: string[];
  preferManualPrompt?: boolean;
}

export interface PromptPlan {
  promptPackId: VisualPromptPackId;
  negativePackId: NegativePromptPackId;
  variantType: PromptVariantType | "default";
  subject: string;
  action: string;
  environment: string;
  composition: string;
  camera: string;
  lighting: string;
  mood: string;
  style: string;
  quality: string;
  constraints: string;
  notes: string[];
  tags: string[];
}

export interface PromptVariant {
  id: string;
  type: PromptVariantType;
  title: string;
  prompt: string;
  negativePrompt: string;
  recommendedUse: string;
  score: number;
}

export interface PromptQualityAnalysis {
  lengthScore: number;
  specificityScore: number;
  visualClarityScore: number;
  compositionScore: number;
  styleConsistencyScore: number;
  safetyWarnings: string[];
  missingElements: string[];
  suggestions: string[];
  overallScore: number;
}

export interface NegativePromptBuildResult {
  negativePrompt: string;
  pack: NegativePromptPack;
  terms: string[];
}

export interface PromptBuildResult {
  context: PromptContext;
  prompt: string;
  negativePrompt: string;
  promptPack: VisualPromptPack;
  negativePromptPack: NegativePromptPack;
  plan: PromptPlan;
  variants: PromptVariant[];
  qualityAnalysis: PromptQualityAnalysis;
  promptPlanSummary: string;
}

const visualPromptPacks: VisualPromptPack[] = [
  {
    id: "anime_dark",
    name: "Anime Dark",
    description:
      "Anime sombrio com contraste alto, energia dramática e silhuetas afiadas.",
    composition: "vertical hero frame, dominant foreground subject, layered depth",
    camera: "dynamic close-medium framing, slight dutch tension, anime panel focus",
    lighting: "hard rim light, shadow-heavy fill, selective crimson highlights",
    colorPalette: "ink black, crimson ember, desaturated steel blue",
    mood: "brooding, dramatic, high-stakes lore tension",
    texture: "ink grain, cel-shaded contrast, smoky atmosphere",
    aspectRatio: "9:16",
    qualityTags: ["sharp linework", "high contrast", "clean silhouette", "dramatic depth"],
    styleTags: ["anime noir", "battle aura", "dramatic paneling", "shadow energy"],
    recommendedNegativePack: "clean_anime",
    recommendedProvider: "mock-svg",
    recommendedWorkflow: "txt2img-basic",
    promptTemplate:
      "Anime noir vertical key art with dramatic subject, cinematic lighting, layered depth and clean action silhouette."
  },
  {
    id: "comic_drama",
    name: "Comic Drama",
    description:
      "Quadrinhos dramáticos com tinta marcada, sombras fortes e composição de painel cinematográfico.",
    composition: "panel-driven framing, diagonal tension, editorial focal point",
    camera: "graphic medium shot, purposeful zoom punch, bold foreground separation",
    lighting: "ink-heavy shadows, controlled highlights, contrast hotspots",
    colorPalette: "paper white, ink black, crimson and amber accents",
    mood: "heroic, conflicted, narrative and emotionally charged",
    texture: "halftone grain, brushed ink, print texture",
    aspectRatio: "9:16",
    qualityTags: ["clean inking", "bold edges", "panel readability", "print texture"],
    styleTags: ["comic panel", "dramatic ink", "hero tension", "editorial energy"],
    recommendedNegativePack: "clean_comic",
    recommendedProvider: "mock-svg",
    recommendedWorkflow: "txt2img-basic",
    promptTemplate:
      "Vertical dramatic comic panel with bold ink shadows, expressive pose and premium print finish."
  },
  {
    id: "true_crime_doc",
    name: "True Crime Doc",
    description:
      "Documental escuro com luz policial, arquivos, evidências e atmosfera investigativa.",
    composition: "evidence-board framing, layered documents, strong central clue",
    camera: "documentary close detail with tense push-in and forensic focus",
    lighting: "cold practical light, police red-blue spill, archival darkness",
    colorPalette: "steel blue, desaturated gray, emergency red accents",
    mood: "investigative, uneasy, factual and ominous",
    texture: "paper wear, archival noise, surveillance grain",
    aspectRatio: "9:16",
    qualityTags: ["clear evidence", "archival realism", "legible props", "controlled contrast"],
    styleTags: ["true crime", "forensic mood", "archive board", "cold documentary"],
    recommendedNegativePack: "clean_documentary",
    recommendedProvider: "mock-svg",
    recommendedWorkflow: "txt2img-basic",
    promptTemplate:
      "Vertical true crime documentary frame with archive evidence, forensic lighting and premium investigation mood."
  },
  {
    id: "mystery_doc",
    name: "Mystery Doc",
    description:
      "Suspense documental com neblina, pistas, mapas e documentos em clima conspiratório.",
    composition: "layered map and clue collage, central mystery anchor, atmospheric spacing",
    camera: "slow investigative push, selective focus on clues, vertical documentary framing",
    lighting: "moody teal haze, practical desk light, soft fog diffusion",
    colorPalette: "teal noir, charcoal, parchment amber",
    mood: "mysterious, conspiratorial and quietly tense",
    texture: "fog, paper fibers, analog interference",
    aspectRatio: "9:16",
    qualityTags: ["clear clue hierarchy", "premium depth", "controlled atmosphere", "clean focal separation"],
    styleTags: ["mystery board", "documentary noir", "map overlays", "atmospheric clues"],
    recommendedNegativePack: "clean_documentary",
    recommendedProvider: "mock-svg",
    recommendedWorkflow: "txt2img-basic",
    promptTemplate:
      "Vertical mystery documentary frame with maps, clues, teal haze and cinematic investigative composition."
  },
  {
    id: "history_dark",
    name: "History Dark",
    description:
      "Histórico sombrio com mapas antigos, textura pesada, fumaça e peso trágico.",
    composition: "monumental vertical composition, layered historical artifacts, dignified spacing",
    camera: "measured wide-medium shot with archival emphasis and solemn framing",
    lighting: "low warm practical glow, smoky contrast, sculpted chiaroscuro",
    colorPalette: "aged bronze, soot black, muted parchment",
    mood: "grave, reflective, tragic and epic",
    texture: "aged paper, smoke haze, historical patina",
    aspectRatio: "9:16",
    qualityTags: ["period texture", "solid hierarchy", "clean historical props", "cinematic chiaroscuro"],
    styleTags: ["dark history", "archive war room", "old maps", "solemn spectacle"],
    recommendedNegativePack: "clean_history",
    recommendedProvider: "mock-svg",
    recommendedWorkflow: "txt2img-basic",
    promptTemplate:
      "Vertical dark historical tableau with old maps, smoke, worn textures and dignified cinematic gravity."
  },
  {
    id: "sports_hype",
    name: "Sports Hype",
    description:
      "Energia de estádio, impacto, movimento e luz forte para lances épicos.",
    composition: "impact-driven vertical frame, explosive center action, crowd depth",
    camera: "telephoto action freeze, fast low angle, momentum-focused crop",
    lighting: "stadium beams, hot highlights, crisp high-energy contrast",
    colorPalette: "electric cyan, vivid amber, clean graphite",
    mood: "adrenaline, triumph and explosive anticipation",
    texture: "motion streaks, field haze, crisp sweat highlights",
    aspectRatio: "9:16",
    qualityTags: ["motion clarity", "impact focus", "crowd depth", "premium action detail"],
    styleTags: ["sports promo", "stadium energy", "impact frame", "broadcast polish"],
    recommendedNegativePack: "clean_sports",
    recommendedProvider: "mock-svg",
    recommendedWorkflow: "txt2img-basic",
    promptTemplate:
      "Vertical sports hype frame with explosive motion, stadium lights and premium impact composition."
  },
  {
    id: "game_epic",
    name: "Game Epic",
    description:
      "Fantasia épica de jogo, partículas, atmosfera de boss fight e grandeza visual.",
    composition: "epic vertical key art, layered scale, dominant hero-vs-world silhouette",
    camera: "dramatic low angle, sweeping fantasy perspective, scale-first framing",
    lighting: "mythic glow, volumetric highlights, contrast-driven aura lighting",
    colorPalette: "obsidian, arcane violet-blue, molten gold",
    mood: "epic, adventurous and larger than life",
    texture: "particles, energy mist, fantasy debris",
    aspectRatio: "9:16",
    qualityTags: ["grand scale", "clean silhouette", "depth layers", "fantasy detail"],
    styleTags: ["epic game art", "boss arena", "arcane atmosphere", "particle spectacle"],
    recommendedNegativePack: "clean_dark_cinematic",
    recommendedProvider: "mock-svg",
    recommendedWorkflow: "txt2img-basic",
    promptTemplate:
      "Vertical epic game key art with fantasy scale, powerful atmosphere and boss-fight energy."
  },
  {
    id: "cinematic_story",
    name: "Cinematic Story",
    description:
      "Cinema vertical premium com composição forte, luz dramática e direção versátil.",
    composition: "premium vertical cinematic framing, clear subject priority, elegant negative space",
    camera: "story-led medium shot, refined push-in, polished lens language",
    lighting: "dramatic but balanced, sculpted highlights, premium cinematic contrast",
    colorPalette: "graphite, silver mist, amber accent",
    mood: "emotional, polished and premium",
    texture: "subtle grain, atmosphere depth, soft light bloom",
    aspectRatio: "9:16",
    qualityTags: ["cinematic polish", "clean hierarchy", "balanced contrast", "premium depth"],
    styleTags: ["vertical cinema", "editorial polish", "dramatic story", "premium motion poster"],
    recommendedNegativePack: "clean_dark_cinematic",
    recommendedProvider: "mock-svg",
    recommendedWorkflow: "txt2img-basic",
    promptTemplate:
      "Vertical cinematic story frame with polished composition, emotional lighting and premium finishing."
  },
  {
    id: "horror_tension",
    name: "Horror Tension",
    description:
      "Horror escuro com ruído, silhueta, luz vermelha e tensão claustrofóbica.",
    composition: "negative-space tension, looming silhouette, vertical dread corridor",
    camera: "claustrophobic close-to-medium frame, creeping low angle, suspense hold",
    lighting: "red emergency spill, hard shadow pools, selective silhouette rim",
    colorPalette: "deep black, blood red, sickly gray",
    mood: "fear, dread and sustained tension",
    texture: "film noise, grime, smoky red haze",
    aspectRatio: "9:16",
    qualityTags: ["clean silhouette", "controlled darkness", "tension focus", "high contrast"],
    styleTags: ["horror poster", "red alarm", "shadow dread", "noir terror"],
    recommendedNegativePack: "clean_dark_cinematic",
    recommendedProvider: "mock-svg",
    recommendedWorkflow: "txt2img-basic",
    promptTemplate:
      "Vertical horror tension frame with ominous silhouette, red practical light and oppressive atmosphere."
  },
  {
    id: "documentary_clean",
    name: "Documentary Clean",
    description:
      "Documentário limpo e factual com mapas, fotos, títulos e leitura visual clara.",
    composition: "structured editorial layout, clear focal subject, supportive factual overlays",
    camera: "clean documentary framing, readable medium-wide crop, factual lens language",
    lighting: "neutral soft key, practical realism, crisp detail control",
    colorPalette: "slate, ivory, muted blue, measured amber",
    mood: "factual, polished and trustworthy",
    texture: "clean paper texture, subtle grain, restrained overlays",
    aspectRatio: "9:16",
    qualityTags: ["clear readability", "factual polish", "clean overlays", "balanced detail"],
    styleTags: ["clean documentary", "educational editorial", "map support", "fact-driven layout"],
    recommendedNegativePack: "clean_documentary",
    recommendedProvider: "mock-svg",
    recommendedWorkflow: "txt2img-basic",
    promptTemplate:
      "Vertical clean documentary frame with factual overlays, readable structure and polished editorial clarity."
  }
];

const negativePromptPacks: NegativePromptPack[] = [
  {
    id: "clean_anime",
    name: "Clean Anime",
    description: "Evita artefatos comuns em anime, mantendo linhas limpas e anatomia sólida.",
    negativeTerms: ["muddy colors", "bad perspective", "messy background"],
    anatomyTerms: ["extra arms", "extra fingers", "twisted limbs", "broken hands"],
    artifactTerms: ["double face", "ghosting", "jpeg artifacts", "dirty outlines"],
    textTerms: ["random text", "subtitle fragments", "illegible letters"],
    watermarkTerms: ["watermark", "signature", "brand logo"],
    lowQualityTerms: ["low detail", "blurry", "flat shading", "poor contrast"],
    styleAvoidanceTerms: ["photoreal skin", "plastic texture", "generic 3d render"]
  },
  {
    id: "clean_documentary",
    name: "Clean Documentary",
    description: "Mantém legibilidade documental, remove ruído excessivo e texto acidental.",
    negativeTerms: ["visual clutter", "chaotic overlays", "overprocessed image"],
    anatomyTerms: ["distorted people", "warped hands", "melted face"],
    artifactTerms: ["compression noise", "duplicated objects", "broken geometry"],
    textTerms: ["random captions", "garbled headlines", "unreadable labels"],
    watermarkTerms: ["watermark", "channel logo", "stock photo mark"],
    lowQualityTerms: ["low resolution", "out of focus", "washed colors", "soft details"],
    styleAvoidanceTerms: ["cartoon exaggeration", "oversaturated fantasy lighting"]
  },
  {
    id: "clean_photoreal",
    name: "Clean Photoreal",
    description: "Foco em resultado realista, sem plástico, sem duplicações e sem sujeira digital.",
    negativeTerms: ["plastic skin", "uncanny expression", "fake depth of field"],
    anatomyTerms: ["extra limbs", "crooked eyes", "deformed mouth", "incorrect proportions"],
    artifactTerms: ["cgi look", "render noise", "oversharpen", "halo edges"],
    textTerms: ["random text", "UI debris", "caption fragments"],
    watermarkTerms: ["watermark", "logo", "signature"],
    lowQualityTerms: ["low detail", "blur", "banding", "muddy contrast"],
    styleAvoidanceTerms: ["anime linework", "comic halftone"]
  },
  {
    id: "clean_comic",
    name: "Clean Comic",
    description: "Preserva quadrinhos premium sem sujeira de impressão ou anatomia quebrada.",
    negativeTerms: ["muddy inks", "flat panel", "uncontrolled clutter"],
    anatomyTerms: ["extra fingers", "broken wrists", "distorted face", "twisted anatomy"],
    artifactTerms: ["printing errors", "pixel noise", "double outline", "smudged details"],
    textTerms: ["random speech bubble text", "garbled captions", "illegible typography"],
    watermarkTerms: ["watermark", "artist signature", "brand logo"],
    lowQualityTerms: ["low contrast", "blurry inks", "poor detail"],
    styleAvoidanceTerms: ["photoreal skin", "cheap 3d shading"]
  },
  {
    id: "clean_dark_cinematic",
    name: "Clean Dark Cinematic",
    description: "Segura a atmosfera escura sem perder leitura ou cair em lama visual.",
    negativeTerms: ["muddy blacks", "crushed shadows", "chaotic composition"],
    anatomyTerms: ["distorted anatomy", "extra limbs", "broken silhouette"],
    artifactTerms: ["noise blocks", "ghosting", "duplicated props", "bad masking"],
    textTerms: ["random text", "subtitle residue", "garbled lettering"],
    watermarkTerms: ["watermark", "signature", "brand logo"],
    lowQualityTerms: ["low detail", "blur", "flat lighting", "weak contrast"],
    styleAvoidanceTerms: ["daylight flatness", "cute cartoon tone"]
  },
  {
    id: "clean_sports",
    name: "Clean Sports",
    description: "Reduz borrão ruim, membros deformados e confusão de ação em visuais esportivos.",
    negativeTerms: ["motion mush", "crowd clutter", "bad timing pose"],
    anatomyTerms: ["extra limbs", "warped joints", "broken hands", "wrong posture"],
    artifactTerms: ["ghost players", "duplicated ball", "compression noise"],
    textTerms: ["random jersey text", "garbled scoreboard", "illegible signage"],
    watermarkTerms: ["watermark", "broadcast logo", "brand mark"],
    lowQualityTerms: ["low sharpness", "soft focus", "flat energy"],
    styleAvoidanceTerms: ["stiff posing", "dead atmosphere"]
  },
  {
    id: "clean_history",
    name: "Clean History",
    description: "Mantém a ambiência histórica sem exagero fantasioso ou poluição visual.",
    negativeTerms: ["theme park look", "cheap props", "messy archive collage"],
    anatomyTerms: ["distorted faces", "broken hands", "incorrect proportions"],
    artifactTerms: ["plastic textures", "duplicate objects", "render artifacts"],
    textTerms: ["random labels", "garbled documents", "unreadable dates"],
    watermarkTerms: ["watermark", "logo", "signature"],
    lowQualityTerms: ["low detail", "blur", "flat lighting", "muddy textures"],
    styleAvoidanceTerms: ["sci-fi neon", "cartoon exaggeration"]
  }
];

const variantDescriptors: Array<{
  type: PromptVariantType;
  title: string;
  composition: string;
  camera: string;
  recommendedUse: string;
  scoreBias: number;
}> = [
  {
    type: "close-up",
    title: "Close-up",
    composition: "tight facial priority with minimal distraction and strong eye-line pull",
    camera: "intimate close-up, shallow focus feeling, emotional facial emphasis",
    recommendedUse: "hooks, reveals and emotional micro-beats",
    scoreBias: 8
  },
  {
    type: "wide-shot",
    title: "Wide Shot",
    composition: "full environment read with subject anchored against scale and context",
    camera: "wide lens feel, environment-heavy framing, strong vertical depth",
    recommendedUse: "world-building and context establishment",
    scoreBias: 6
  },
  {
    type: "dramatic-low-angle",
    title: "Dramatic Low Angle",
    composition: "dominant upward framing with empowered silhouette and rising tension",
    camera: "low-angle cinematic hero lens with powerful foreground scale",
    recommendedUse: "villain reveals, hero beats and power escalation",
    scoreBias: 10
  },
  {
    type: "silhouette-shot",
    title: "Silhouette Shot",
    composition: "graphic silhouette against readable light source and strong negative space",
    camera: "held medium-wide suspense frame with silhouette clarity",
    recommendedUse: "mystery, horror and symbolic transitions",
    scoreBias: 7
  },
  {
    type: "action-impact-frame",
    title: "Action Impact Frame",
    composition: "impact pose frozen at the peak beat with kinetic debris and directional energy",
    camera: "fast dynamic lens language with action freeze sensation",
    recommendedUse: "combat beats, sports peaks and explosive transitions",
    scoreBias: 10
  },
  {
    type: "documentary-evidence-frame",
    title: "Documentary Evidence Frame",
    composition: "evidence-first layout with readable documents, props and clue hierarchy",
    camera: "controlled investigative crop with factual object emphasis",
    recommendedUse: "research, proof moments and factual hooks",
    scoreBias: 8
  },
  {
    type: "emotional-portrait",
    title: "Emotional Portrait",
    composition: "portrait-led frame with subtle environment support and emotional breathing room",
    camera: "gentle portrait lens feeling with expressive face priority",
    recommendedUse: "character beats, drama and reflective scenes",
    scoreBias: 7
  },
  {
    type: "environment-establishing-shot",
    title: "Environment Establishing Shot",
    composition: "world-first frame with clear atmosphere, scale and geographic logic",
    camera: "measured opening shot with clean spatial orientation",
    recommendedUse: "openings, transitions and historical or documentary setups",
    scoreBias: 5
  }
];

function normalizeText(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[^\x00-\x7F]/g, "")
    .toLowerCase();
}

function cleanFragment(value: string | null | undefined) {
  return value?.replace(/\s+/g, " ").trim() ?? "";
}

function uniqueStrings(values: Array<string | null | undefined>) {
  const output: string[] = [];

  for (const value of values) {
    const cleaned = cleanFragment(value);

    if (cleaned && !output.includes(cleaned)) {
      output.push(cleaned);
    }
  }

  return output;
}

function uniqueTokens(values: Array<string | null | undefined>) {
  return [
    ...new Set(
      values
        .join(" ")
        .split(/[^a-zA-Z0-9]+/g)
        .map((token) => normalizeText(token))
        .filter((token) => token.length >= 3)
    )
  ];
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function toSentence(value: string) {
  const trimmed = cleanFragment(value);

  if (!trimmed) {
    return "";
  }

  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

function sentenceFromParts(parts: Array<string | null | undefined>, fallback: string) {
  const value = uniqueStrings(parts).join(", ");
  return value || fallback;
}

function listLabel(values: string[]) {
  return values.join(", ");
}

function parseCueSentence(value: string | null | undefined) {
  const cleaned = cleanFragment(value);

  if (!cleaned) {
    return "";
  }

  const [firstSentence] = cleaned.split(/(?<=[.!?])\s+/);
  return cleanFragment(firstSentence);
}

function promptContainsTerm(prompt: string, term: string) {
  const normalizedPrompt = normalizeText(prompt);
  const normalizedTerm = normalizeText(term);
  return Boolean(normalizedTerm) && normalizedPrompt.includes(normalizedTerm);
}

function isProtectedTermAllowed(
  term: string,
  manualSources: Array<string | null | undefined>
) {
  return manualSources.some((source) => promptContainsTerm(source ?? "", term));
}

function getVariantDescriptor(type: PromptVariantType) {
  return variantDescriptors.find((entry) => entry.type === type) ?? variantDescriptors[0]!;
}

function inferPackByTemplate(templateId: string | null | undefined) {
  switch ((templateId ?? "").trim()) {
    case "anime_dark":
      return "anime_dark";
    case "comic_drama":
      return "comic_drama";
    case "game_epic":
      return "game_epic";
    case "mystery_doc":
      return "mystery_doc";
    case "history_dark":
      return "history_dark";
    case "sports_hype":
      return "sports_hype";
    case "true_crime":
      return "true_crime_doc";
    case "cinematic_story":
      return "cinematic_story";
    default:
      return null;
  }
}

function inferPackByNiche(niche: string | null | undefined) {
  const key = normalizeText(niche ?? "");

  if (!key) {
    return null;
  }

  if (key.includes("anime") || key.includes("manga")) {
    return "anime_dark";
  }

  if (key.includes("comic") || key.includes("hq") || key.includes("hero")) {
    return "comic_drama";
  }

  if (key.includes("true crime") || key.includes("crime") || key.includes("police")) {
    return "true_crime_doc";
  }

  if (
    key.includes("mystery") ||
    key.includes("misterio") ||
    key.includes("conspiracy") ||
    key.includes("conspir")
  ) {
    return "mystery_doc";
  }

  if (key.includes("history") || key.includes("histor") || key.includes("war")) {
    return "history_dark";
  }

  if (
    key.includes("sport") ||
    key.includes("futebol") ||
    key.includes("basket") ||
    key.includes("nba")
  ) {
    return "sports_hype";
  }

  if (key.includes("game") || key.includes("gamer") || key.includes("rpg")) {
    return "game_epic";
  }

  if (key.includes("horror") || key.includes("terror")) {
    return "horror_tension";
  }

  if (
    key.includes("science") ||
    key.includes("educ") ||
    key.includes("biography") ||
    key.includes("curios")
  ) {
    return "documentary_clean";
  }

  return "cinematic_story";
}

function inferPackByEmotion(emotion: string | null | undefined) {
  const key = normalizeText(emotion ?? "");

  if (!key) {
    return null;
  }

  if (key.includes("dark") || key.includes("tense")) {
    return "horror_tension";
  }

  if (key.includes("myster")) {
    return "mystery_doc";
  }

  if (key.includes("epic")) {
    return "game_epic";
  }

  if (key.includes("sad")) {
    return "cinematic_story";
  }

  if (key.includes("joy") || key.includes("calm")) {
    return "documentary_clean";
  }

  return "cinematic_story";
}

function deriveDefaultEnvironment(pack: VisualPromptPack, input: PromptBuildInput) {
  const research = input.researchAssetRequirement;
  const channel = input.channel;

  return sentenceFromParts(
    [
      parseCueSentence(research?.description),
      research?.mediaType ? `media focus ${research.mediaType}` : null,
      channel?.niche ? `editorial context ${channel.niche}` : null,
      `${pack.mood} environment`,
      `${pack.texture} texture`
    ],
    `${pack.description}`
  );
}

function deriveConstraints(context: Omit<PromptContext, "constraintsText">) {
  const constraints = [
    "vertical 9:16 composition",
    "no brand logos",
    "no watermarks",
    "no copyrighted franchise names unless user supplied manually",
    "clean focal hierarchy",
    "render-ready readability"
  ];

  if (context.promptPack.id === "documentary_clean" || context.promptPack.id === "true_crime_doc") {
    constraints.push("editorial clarity");
  }

  return constraints.join(", ");
}

function renderPromptFromPlan(plan: PromptPlan) {
  return sanitizePromptForGeneration(
    [
      `subject: ${plan.subject}`,
      `action: ${plan.action}`,
      `environment: ${plan.environment}`,
      `composition: ${plan.composition}`,
      `camera: ${plan.camera}`,
      `lighting: ${plan.lighting}`,
      `mood: ${plan.mood}`,
      `style: ${plan.style}`,
      `quality: ${plan.quality}`,
      `constraints: ${plan.constraints}`
    ].join("\n")
  );
}

function buildPlan(
  context: PromptContext,
  variantType?: PromptVariantType | null
) {
  const descriptor = variantType ? getVariantDescriptor(variantType) : null;
  const composition = descriptor
    ? `${context.promptPack.composition}; ${descriptor.composition}`
    : context.promptPack.composition;
  const camera = descriptor
    ? `${context.promptPack.camera}; ${descriptor.camera}`
    : context.promptPack.camera;
  const subject = sentenceFromParts(
    [
      context.subjectText,
      context.userBasePrompt,
      context.channel?.visualStyle
    ],
    "visually distinct central subject"
  );

  return {
    promptPackId: context.promptPack.id,
    negativePackId: context.negativePack.id,
    variantType: variantType ?? "default",
    subject,
    action: context.actionText,
    environment: context.environmentText,
    composition,
    camera,
    lighting: context.promptPack.lighting,
    mood: sentenceFromParts(
      [
        context.promptPack.mood,
        context.emotion ? `emotion ${context.emotion}` : null,
        context.channel?.narrativeTone
      ],
      context.promptPack.mood
    ),
    style: sentenceFromParts(
      [
        context.promptPack.description,
        context.styleText,
        `color palette ${context.promptPack.colorPalette}`,
        `texture ${context.promptPack.texture}`,
        listLabel(context.promptPack.styleTags)
      ],
      context.promptPack.description
    ),
    quality: sentenceFromParts(
      [
        context.qualityText,
        listLabel(context.promptPack.qualityTags),
        "premium vertical composition"
      ],
      "premium quality, crisp details and clean hierarchy"
    ),
    constraints: context.constraintsText,
    notes: [
      `provider ${context.promptPack.recommendedProvider}`,
      `workflow ${context.promptPack.recommendedWorkflow}`,
      descriptor ? `variant ${descriptor.type}` : "variant default"
    ],
    tags: context.supportTags
  } satisfies PromptPlan;
}

function analyzeGenericTerms(prompt: string) {
  const genericTerms = [
    "nice",
    "cool",
    "awesome",
    "beautiful",
    "good",
    "great",
    "interesting"
  ];

  return genericTerms.filter((term) => promptContainsTerm(prompt, term));
}

function buildReferenceCue(characterProfile?: PromptCharacterProfileInput | null) {
  const references = characterProfile?.references ?? [];

  if (references.length === 0) {
    return null;
  }

  return references
    .slice(0, 3)
    .map((reference) =>
      [reference.referenceType, reference.title, reference.notes]
        .filter(Boolean)
        .join(" - ")
    )
    .join(" | ");
}

function buildCharacterStyleText(characterProfile?: PromptCharacterProfileInput | null) {
  return uniqueStrings([
    characterProfile?.description,
    characterProfile?.basePrompt,
    characterProfile?.styleNotes,
    characterProfile?.defaultVisualStyle,
    buildReferenceCue(characterProfile),
    ...(characterProfile?.tags ?? [])
  ]).join(", ");
}

function resolvePromptPack(input: PromptBuildInput) {
  const explicit = input.promptPackId
    ? getVisualPromptPackById(input.promptPackId)
    : null;

  if (explicit) {
    return explicit;
  }

  const byTemplate = suggestPromptPackByTemplate(
    input.templateId ?? input.project?.templateId ?? input.channel?.defaultTemplate ?? null
  );

  if (byTemplate) {
    return byTemplate;
  }

  const byChannel = suggestPromptPackByChannel(input.channel ?? null);

  if (byChannel) {
    return byChannel;
  }

  const byEmotion = suggestPromptPackByEmotion(
    input.scene?.emotion ?? input.researchAssetRequirement?.emotion ?? null
  );

  if (byEmotion) {
    return byEmotion;
  }

  return getVisualPromptPackById("cinematic_story")!;
}

function resolveNegativePack(
  input: PromptBuildInput,
  promptPack: VisualPromptPack
) {
  const explicit = input.negativePackId
    ? getNegativePromptPackById(input.negativePackId)
    : null;

  if (explicit) {
    return explicit;
  }

  return getNegativePromptPackById(promptPack.recommendedNegativePack)!;
}

export function getVisualPromptPacks() {
  return [...visualPromptPacks];
}

export function getVisualPromptPackById(id: string | null | undefined) {
  return visualPromptPacks.find((pack) => pack.id === id) ?? null;
}

export function getNegativePromptPacks() {
  return [...negativePromptPacks];
}

export function getNegativePromptPackById(id: string | null | undefined) {
  return negativePromptPacks.find((pack) => pack.id === id) ?? null;
}

export function suggestPromptPackByTemplate(templateId: string | null | undefined) {
  const inferredId = inferPackByTemplate(templateId);
  return inferredId ? getVisualPromptPackById(inferredId) : null;
}

export function suggestPromptPackByNiche(niche: string | null | undefined) {
  const inferredId = inferPackByNiche(niche);
  return inferredId ? getVisualPromptPackById(inferredId) : null;
}

export function suggestPromptPackByEmotion(emotion: string | null | undefined) {
  const inferredId = inferPackByEmotion(emotion);
  return inferredId ? getVisualPromptPackById(inferredId) : null;
}

export function suggestPromptPackByChannel(channel: PromptChannelInput | null | undefined) {
  if (!channel) {
    return null;
  }

  return (
    suggestPromptPackByTemplate(channel.defaultTemplate) ??
    suggestPromptPackByNiche(channel.niche) ??
    null
  );
}

export function sanitizePromptForGeneration(prompt: string) {
  return prompt
    .replace(/[“”]/g, "\"")
    .replace(/[‘’]/g, "'")
    .replace(/\t+/g, " ")
    .replace(/[ ]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function buildPromptContext(input: PromptBuildInput): PromptContext {
  const promptPack = resolvePromptPack(input);
  const negativePack = resolveNegativePack(input, promptPack);
  const scene = input.scene ?? null;
  const project = input.project ?? null;
  const channel = input.channel ?? null;
  const characterProfile = input.characterProfile ?? null;
  const requirement = input.researchAssetRequirement ?? null;
  const manualPrompt = cleanFragment(scene?.visualPrompt);
  const manualNegativePrompt = cleanFragment(scene?.negativePrompt);
  const userBasePrompt = cleanFragment(characterProfile?.basePrompt);
  const supportTags = uniqueStrings([
    ...(input.supportTags ?? []),
    ...(characterProfile?.tags ?? []),
    ...(requirement?.suggestedTags ?? [])
  ]);
  const protectedTerms = uniqueStrings([
    characterProfile?.name,
    characterProfile?.franchise
  ]);
  const allowedProtectedTerms = protectedTerms.filter((term) =>
    isProtectedTermAllowed(term, [manualPrompt, userBasePrompt])
  );
  const subjectText = sentenceFromParts(
    [
      parseCueSentence(scene?.title),
      parseCueSentence(requirement?.description),
      parseCueSentence(scene?.captionText),
      parseCueSentence(scene?.narrationText)
    ],
    "premium vertical visual subject"
  );
  const actionText = sentenceFromParts(
    [
      parseCueSentence(scene?.narrationText),
      parseCueSentence(scene?.captionText),
      requirement?.sceneRole ? `scene role ${requirement.sceneRole}` : null,
      scene?.energyLevel ? `energy level ${scene.energyLevel}` : null
    ],
    "capture the decisive dramatic beat"
  );
  const environmentText = deriveDefaultEnvironment(promptPack, input);
  const styleText = sentenceFromParts(
    [
      buildCharacterStyleText(characterProfile),
      channel?.visualStyle,
      channel?.narrativeTone,
      scene?.visualPreset,
      promptPack.description
    ],
    promptPack.description
  );
  const qualityText = sentenceFromParts(
    [
      promptPack.promptTemplate,
      project?.format ? `format ${project.format}` : null,
      `recommended workflow ${promptPack.recommendedWorkflow}`
    ],
    "premium composition, crisp readability and clean vertical finish"
  );

  const partialContext = {
    projectId: project?.id ?? null,
    sceneId: scene?.id ?? null,
    researchRequirementId: requirement?.id ?? null,
    templateId: input.templateId ?? project?.templateId ?? channel?.defaultTemplate ?? null,
    promptPackId: promptPack.id,
    negativePackId: negativePack.id,
    variantType: input.variantType ?? null,
    niche: channel?.niche ?? null,
    emotion: scene?.emotion ?? requirement?.emotion ?? null,
    subjectText,
    actionText,
    environmentText,
    manualPrompt: manualPrompt || null,
    manualNegativePrompt: manualNegativePrompt || null,
    userBasePrompt: userBasePrompt || null,
    styleText,
    qualityText,
    supportTags,
    protectedTerms,
    allowedProtectedTerms,
    promptPack,
    negativePack,
    channel
  };

  return {
    ...partialContext,
    constraintsText: deriveConstraints(partialContext)
  };
}

export function buildNegativePrompt(
  input: PromptBuildInput
): NegativePromptBuildResult {
  const context = buildPromptContext(input);
  const pack = context.negativePack;
  const manualTerms = uniqueStrings([
    input.scene?.negativePrompt,
    input.characterProfile?.negativePrompt
  ])
    .join(", ")
    .split(",")
    .map((entry) => cleanFragment(entry))
    .filter(Boolean);
  const terms = [
    ...new Set(
      [
        ...pack.negativeTerms,
        ...pack.anatomyTerms,
        ...pack.artifactTerms,
        ...pack.textTerms,
        ...pack.watermarkTerms,
        ...pack.lowQualityTerms,
        ...pack.styleAvoidanceTerms,
        ...manualTerms
      ].map((entry) => cleanFragment(entry)).filter(Boolean)
    )
  ];

  return {
    negativePrompt: sanitizePromptForGeneration(terms.join(", ")),
    pack,
    terms
  };
}

export function buildPromptVariants(
  input: PromptBuildInput,
  count = 4
) {
  const context = buildPromptContext(input);
  const negativePrompt = buildNegativePrompt(input).negativePrompt;
  const descriptors = [...variantDescriptors];

  if (input.variantType) {
    const chosen = getVariantDescriptor(input.variantType);
    descriptors.sort((left, right) =>
      left.type === chosen.type ? -1 : right.type === chosen.type ? 1 : 0
    );
  }

  return descriptors.slice(0, clamp(Math.trunc(count || 0), 1, descriptors.length)).map((descriptor) => {
    const plan = buildPlan(context, descriptor.type);
    const prompt = renderPromptFromPlan(plan);
    const baseScore =
      (context.promptPack.id === "sports_hype" &&
      descriptor.type === "action-impact-frame"
        ? 90
        : context.promptPack.id === "documentary_clean" &&
            descriptor.type === "documentary-evidence-frame"
          ? 90
          : 78) + descriptor.scoreBias;

    return {
      id: `${context.sceneId ?? context.researchRequirementId ?? context.projectId ?? "prompt"}:${descriptor.type}`,
      type: descriptor.type,
      title: descriptor.title,
      prompt,
      negativePrompt,
      recommendedUse: descriptor.recommendedUse,
      score: clamp(baseScore, 1, 100)
    } satisfies PromptVariant;
  });
}

export function analyzePromptQuality(
  prompt: string,
  context: PromptContext
) {
  const sanitized = sanitizePromptForGeneration(prompt);
  const tokens = uniqueTokens([sanitized]);
  const missingElements: string[] = [];
  const suggestions: string[] = [];
  const safetyWarnings: string[] = [];

  const hasEnvironment = promptContainsTerm(sanitized, "environment:");
  const hasLighting = promptContainsTerm(sanitized, "lighting:");
  const hasCamera =
    promptContainsTerm(sanitized, "camera:") ||
    /close-up|wide|low angle|portrait|silhouette/i.test(sanitized);
  const hasStyle = promptContainsTerm(sanitized, "style:");
  const hasComposition = promptContainsTerm(sanitized, "composition:");

  if (!hasEnvironment) {
    missingElements.push("environment");
    suggestions.push("Adicione ambiente ou contexto físico para a cena.");
  }

  if (!hasLighting) {
    missingElements.push("lighting");
    suggestions.push("Especifique uma direção de luz mais clara.");
  }

  if (!hasCamera || !hasComposition) {
    missingElements.push("camera/composition");
    suggestions.push("Defina enquadramento e câmera com mais precisão.");
  }

  if (!hasStyle) {
    missingElements.push("style");
    suggestions.push("Inclua linguagem visual, textura e acabamento.");
  }

  if (sanitized.length < 180) {
    safetyWarnings.push("Prompt muito curto para um visual premium consistente.");
  }

  const genericTerms = analyzeGenericTerms(sanitized);

  if (genericTerms.length > 0) {
    suggestions.push(
      `Substitua termos genéricos (${genericTerms.join(", ")}) por detalhes visuais concretos.`
    );
  }

  const conflictingPairs: Array<[string, string]> = [
    ["dark", "bright pastel"],
    ["clean documentary", "chaotic fantasy"],
    ["photoreal", "anime cel-shaded"]
  ];

  for (const [left, right] of conflictingPairs) {
    if (promptContainsTerm(sanitized, left) && promptContainsTerm(sanitized, right)) {
      safetyWarnings.push(`Termos conflitantes detectados: '${left}' e '${right}'.`);
    }
  }

  for (const protectedTerm of context.protectedTerms) {
    if (
      promptContainsTerm(sanitized, protectedTerm) &&
      !context.allowedProtectedTerms.includes(protectedTerm)
    ) {
      safetyWarnings.push(
        `Nome protegido detectado sem origem manual explícita: '${protectedTerm}'.`
      );
    }
  }

  const lengthScore = clamp(Math.round((sanitized.length / 420) * 100), 25, 100);
  const specificityScore = clamp(tokens.length * 4, 20, 100);
  const visualClarityScore = clamp(
    45 +
      (hasEnvironment ? 12 : 0) +
      (hasLighting ? 12 : 0) +
      (tokens.length >= 18 ? 12 : 0),
    20,
    100
  );
  const compositionScore = clamp(
    30 + (hasCamera ? 25 : 0) + (hasComposition ? 25 : 0) + (context.variantType ? 10 : 0),
    15,
    100
  );
  const styleConsistencyScore = clamp(
    40 +
      (context.promptPack.styleTags.filter((tag) => promptContainsTerm(sanitized, tag)).length > 0
        ? 18
        : 0) +
      (context.promptPack.qualityTags.filter((tag) => promptContainsTerm(sanitized, tag)).length > 0
        ? 12
        : 0) -
      safetyWarnings.length * 6,
    10,
    100
  );
  const overallScore = clamp(
    Math.round(
      (lengthScore +
        specificityScore +
        visualClarityScore +
        compositionScore +
        styleConsistencyScore) /
        5
    ),
    1,
    100
  );

  return {
    lengthScore,
    specificityScore,
    visualClarityScore,
    compositionScore,
    styleConsistencyScore,
    safetyWarnings,
    missingElements,
    suggestions,
    overallScore
  } satisfies PromptQualityAnalysis;
}

export function summarizePromptPlan(plan: PromptPlan) {
  return sanitizePromptForGeneration(
    [
      `pack ${plan.promptPackId}`,
      `negative ${plan.negativePackId}`,
      `variant ${plan.variantType}`,
      `camera ${plan.camera}`,
      `lighting ${plan.lighting}`,
      `mood ${plan.mood}`
    ].join(" | ")
  );
}

export function buildVisualPrompt(input: PromptBuildInput): PromptBuildResult {
  const context = buildPromptContext(input);
  const negativePromptResult = buildNegativePrompt(input);
  const variants = buildPromptVariants(input, 4);

  let prompt = "";
  let plan: PromptPlan;

  if (input.preferManualPrompt && context.manualPrompt) {
    plan = buildPlan(context, input.variantType ?? null);
    prompt = sanitizePromptForGeneration(context.manualPrompt);
  } else {
    plan = buildPlan(context, input.variantType ?? null);
    prompt = renderPromptFromPlan(plan);
  }

  const qualityAnalysis = analyzePromptQuality(prompt, context);

  return {
    context,
    prompt,
    negativePrompt: negativePromptResult.negativePrompt,
    promptPack: context.promptPack,
    negativePromptPack: negativePromptResult.pack,
    plan,
    variants,
    qualityAnalysis,
    promptPlanSummary: summarizePromptPlan(plan)
  };
}
