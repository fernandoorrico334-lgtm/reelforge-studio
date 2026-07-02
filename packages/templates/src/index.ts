import type { CaptionStyleId } from "@reelforge/caption-engine";
import type { CinematicPresetId } from "@reelforge/cinematic-engine";

export const templateIds = [
  "anime_dark",
  "comic_drama",
  "game_epic",
  "mystery_doc",
  "history_dark",
  "sports_hype",
  "true_crime",
  "cinematic_story",
  "player_threat_analysis",
  "tactical_breakdown",
  "match_preview",
  "post_match_hot_take",
  "rivalry_hype",
  "top_3_ranking",
  "underdog_story",
  "brazil_warning"
] as const;

export type TemplateId = (typeof templateIds)[number];

export interface ReelTemplate {
  id: TemplateId;
  name: string;
  description: string;
  niche: string;
  defaultVisualPreset: CinematicPresetId;
  defaultCaptionStyle: CaptionStyleId;
  defaultTransition: string;
  colorMood: string;
  musicMood: string;
  sfxMood: string;
  pacing: string;
  cameraBehavior: string;
  overlayStyle: string;
  recommendedSceneDuration: number;
  introStyle: string;
  outroStyle: string;
}

export interface TemplateChannelInput {
  name?: string | null;
  niche?: string | null;
  language?: string | null;
  visualStyle?: string | null;
  narrativeTone?: string | null;
  defaultTemplate?: string | null;
}

export interface TemplateProjectInput {
  title?: string | null;
  script?: string | null;
  templateId?: string | null;
  channel?: TemplateChannelInput | null;
}

function cloneTemplate(template: ReelTemplate): ReelTemplate {
  return { ...template };
}

const templateRegistry: Record<TemplateId, ReelTemplate> = {
  anime_dark: {
    id: "anime_dark",
    name: "Anime Dark",
    description:
      "Mistura frames intensos, contraste sombrio e punch visual para teorias, lore e tragedias anime.",
    niche: "anime lore",
    defaultVisualPreset: "mystery",
    defaultCaptionStyle: "anime_punch",
    defaultTransition: "shadow-flash",
    colorMood: "ink black with crimson accents",
    musicMood: "dark hybrid pulse",
    sfxMood: "metallic swells and blade hits",
    pacing: "escalating intrigue",
    cameraBehavior: "close pushes with parallax tension",
    overlayStyle: "manga grain and subtle kanji texture",
    recommendedSceneDuration: 4.5,
    introStyle: "cold open with ominous claim",
    outroStyle: "twist question to trigger comments"
  },
  comic_drama: {
    id: "comic_drama",
    name: "Comic Drama",
    description:
      "Template editorial para quadrinhos comentados, com energia visual de pagina impressa e leitura clara.",
    niche: "comics and graphic novels",
    defaultVisualPreset: "drama",
    defaultCaptionStyle: "comic_pop",
    defaultTransition: "panel-snap",
    colorMood: "paper cream with noir blue shadows",
    musicMood: "moody bassline with dramatic stabs",
    sfxMood: "paper flips, hits and halftone pops",
    pacing: "measured with impact beats",
    cameraBehavior: "panel zooms and page drifts",
    overlayStyle: "halftone dots and speech-burst accents",
    recommendedSceneDuration: 5,
    introStyle: "issue-cover reveal",
    outroStyle: "fan debate prompt"
  },
  game_epic: {
    id: "game_epic",
    name: "Game Epic",
    description:
      "Escala heroica para trailers, lore de jogos e recaps com progressao de energia alta.",
    niche: "games and fantasy worlds",
    defaultVisualPreset: "epic",
    defaultCaptionStyle: "bold_impact",
    defaultTransition: "flare-reveal",
    colorMood: "electric blue with molten gold",
    musicMood: "orchestral rise with trailer percussion",
    sfxMood: "drops, braams and glitch sparks",
    pacing: "heroic build",
    cameraBehavior: "push-outs, orbital drifts and reveals",
    overlayStyle: "particle haze with rune accents",
    recommendedSceneDuration: 4,
    introStyle: "hero quote or impossible stat",
    outroStyle: "next boss or next chapter tease"
  },
  mystery_doc: {
    id: "mystery_doc",
    name: "Mystery Doc",
    description:
      "Visual analitico e investigativo para fatos curiosos, segredos e dossiers narrativos.",
    niche: "mystery documentary",
    defaultVisualPreset: "mystery",
    defaultCaptionStyle: "documentary_clean",
    defaultTransition: "archive-fade",
    colorMood: "midnight blue with silver archives",
    musicMood: "minimal pulse with investigative strings",
    sfxMood: "projector clicks and tape textures",
    pacing: "steady discovery",
    cameraBehavior: "slow drifts with dossier pushes",
    overlayStyle: "grainy archive cards and scan lines",
    recommendedSceneDuration: 5.2,
    introStyle: "case file opener",
    outroStyle: "open question backed by evidence"
  },
  history_dark: {
    id: "history_dark",
    name: "History Dark",
    description:
      "Template para historias pesadas e fatos obscuros com tratamento mais serio e atmosferico.",
    niche: "dark history",
    defaultVisualPreset: "drama",
    defaultCaptionStyle: "documentary_clean",
    defaultTransition: "dust-fade",
    colorMood: "sepia ash with charcoal contrast",
    musicMood: "low strings and restrained percussion",
    sfxMood: "paper rustle, room tone and distant hits",
    pacing: "measured gravity",
    cameraBehavior: "slow archive moves and grounded framing",
    overlayStyle: "textured paper with subtle date stamps",
    recommendedSceneDuration: 5.5,
    introStyle: "grave claim grounded in time and place",
    outroStyle: "reflection or warning"
  },
  sports_hype: {
    id: "sports_hype",
    name: "Sports Hype",
    description:
      "Ritmo de highlight para jogadas, recaps e curiosidades esportivas com energia competitiva.",
    niche: "sports highlights",
    defaultVisualPreset: "action",
    defaultCaptionStyle: "sports_hype",
    defaultTransition: "whip-cut",
    colorMood: "stadium white with neon team accents",
    musicMood: "driving drums and synth pressure",
    sfxMood: "crowd risers, impacts and sweeps",
    pacing: "fast and punchy",
    cameraBehavior: "quick punches and replay-like emphasis",
    overlayStyle: "scoreboard HUD and motion streaks",
    recommendedSceneDuration: 3.6,
    introStyle: "instant stat shock",
    outroStyle: "debate prompt or next fixture tease"
  },
  true_crime: {
    id: "true_crime",
    name: "True Crime",
    description:
      "Ambiencia fria e inquietante para crimes, sumicos e curiosidades sombrias baseadas em fatos.",
    niche: "true crime",
    defaultVisualPreset: "horror",
    defaultCaptionStyle: "horror_whisper",
    defaultTransition: "blink-cut",
    colorMood: "desaturated graphite with dried red accents",
    musicMood: "sub-bass dread and sparse piano",
    sfxMood: "breaths, camera shutters and reversed tails",
    pacing: "tense reveal",
    cameraBehavior: "slow pushes with abrupt cutaways",
    overlayStyle: "evidence board overlays and redaction bars",
    recommendedSceneDuration: 4.8,
    introStyle: "disturbing fact opener",
    outroStyle: "unanswered angle or chilling CTA"
  },
  cinematic_story: {
    id: "cinematic_story",
    name: "Cinematic Story",
    description:
      "Template coringa premium para historias com arco completo, respiracao visual e fechamento elegante.",
    niche: "cinematic narrative",
    defaultVisualPreset: "drama",
    defaultCaptionStyle: "premium_yellow",
    defaultTransition: "soft-dissolve",
    colorMood: "warm noir with polished highlights",
    musicMood: "modern cinematic bed",
    sfxMood: "subtle whooshes and restrained hits",
    pacing: "balanced narrative arc",
    cameraBehavior: "measured drifts with selective punches",
    overlayStyle: "clean film grain and premium gradients",
    recommendedSceneDuration: 4.7,
    introStyle: "hook then context ladder",
    outroStyle: "clean resolve or CTA depending niche"
  },
  player_threat_analysis: {
    id: "player_threat_analysis",
    name: "Player Threat Analysis",
    description:
      "Template editorial para reels que isolam a maior ameaca individual de um confronto.",
    niche: "sports threat analysis",
    defaultVisualPreset: "action",
    defaultCaptionStyle: "sports_hype",
    defaultTransition: "whip-cut",
    colorMood: "stadium contrast with urgent neon edges",
    musicMood: "pressure drums and rising synths",
    sfxMood: "impact sweeps and sharp crowd lifts",
    pacing: "fast analytical build",
    cameraBehavior: "tight pushes with tactical emphasis",
    overlayStyle: "scoreboard overlays and danger callouts",
    recommendedSceneDuration: 5.2,
    introStyle: "hard warning in the first second",
    outroStyle: "debate question around the threat"
  },
  tactical_breakdown: {
    id: "tactical_breakdown",
    name: "Tactical Breakdown",
    description:
      "Template para explicar espacos, linhas de passe e ajustes decisivos em formato curto.",
    niche: "sports tactical analysis",
    defaultVisualPreset: "suspense",
    defaultCaptionStyle: "documentary_clean",
    defaultTransition: "cut",
    colorMood: "chalkboard teal with broadcast white",
    musicMood: "measured pulse with restrained tension",
    sfxMood: "marker swipes and subtle impacts",
    pacing: "measured tactical climb",
    cameraBehavior: "controlled drifts and zone highlights",
    overlayStyle: "analysis cards and field-map accents",
    recommendedSceneDuration: 5.4,
    introStyle: "where the game opens",
    outroStyle: "final tactical adjustment"
  },
  match_preview: {
    id: "match_preview",
    name: "Match Preview",
    description:
      "Template premium para previas editoriais de jogo com tensao, chave tática e expectativa.",
    niche: "sports match preview",
    defaultVisualPreset: "epic",
    defaultCaptionStyle: "sports_hype",
    defaultTransition: "flash",
    colorMood: "floodlight silver with electric accents",
    musicMood: "trailer percussion with broadcast pulse",
    sfxMood: "crowd swells and kickoff sweeps",
    pacing: "expectation curve",
    cameraBehavior: "hero framing with selective punch-ins",
    overlayStyle: "fixture cards and pre-match HUD",
    recommendedSceneDuration: 5,
    introStyle: "big question opener",
    outroStyle: "prediction or pressure prompt"
  },
  post_match_hot_take: {
    id: "post_match_hot_take",
    name: "Post Match Hot Take",
    description:
      "Template de opiniao quente logo apos o jogo, com tese forte e punch editorial.",
    niche: "sports hot take",
    defaultVisualPreset: "drama",
    defaultCaptionStyle: "sports_hype",
    defaultTransition: "cut",
    colorMood: "late-night highlight glow with sharp contrast",
    musicMood: "snappy bass hits and editorial pulse",
    sfxMood: "stings, swishes and hard punctuation",
    pacing: "short explosive beats",
    cameraBehavior: "tight cuts and statement framing",
    overlayStyle: "headline bars and quick stat badges",
    recommendedSceneDuration: 4.8,
    introStyle: "strong opinion opener",
    outroStyle: "agree or disagree CTA"
  },
  rivalry_hype: {
    id: "rivalry_hype",
    name: "Rivalry Hype",
    description:
      "Template de duelo grande, fisico e emocional, ideal para confrontos pesados.",
    niche: "sports rivalry hype",
    defaultVisualPreset: "epic",
    defaultCaptionStyle: "sports_hype",
    defaultTransition: "flash",
    colorMood: "high-voltage contrast with national-color streaks",
    musicMood: "arena rise and heavy percussion",
    sfxMood: "hits, whooshes and crowd detonations",
    pacing: "collision course",
    cameraBehavior: "impact pushes and collision framing",
    overlayStyle: "versus frames and rivalry badges",
    recommendedSceneDuration: 5.1,
    introStyle: "collision hook",
    outroStyle: "side-picking prompt"
  },
  top_3_ranking: {
    id: "top_3_ranking",
    name: "Top 3 Ranking",
    description:
      "Template ordenado para rankings editoriais curtos com leitura premium.",
    niche: "sports ranking",
    defaultVisualPreset: "drama",
    defaultCaptionStyle: "premium_yellow",
    defaultTransition: "cut",
    colorMood: "studio amber with sharp black panels",
    musicMood: "clean pulse with ranking stabs",
    sfxMood: "ticks, drops and reveal clicks",
    pacing: "ordered acceleration",
    cameraBehavior: "card slides and spotlight reveals",
    overlayStyle: "ranking plates and clean number stacks",
    recommendedSceneDuration: 5.6,
    introStyle: "ranking promise",
    outroStyle: "ask for the audience ranking"
  },
  underdog_story: {
    id: "underdog_story",
    name: "Underdog Story",
    description:
      "Template para narrativas de ascensao, superacao e crescimento inesperado em torneios.",
    niche: "sports underdog story",
    defaultVisualPreset: "drama",
    defaultCaptionStyle: "premium_yellow",
    defaultTransition: "soft-dissolve",
    colorMood: "warm contrast with underdog grit",
    musicMood: "hopeful cinematic bed",
    sfxMood: "subtle rises and controlled impacts",
    pacing: "emotional climb",
    cameraBehavior: "measured documentary drifts",
    overlayStyle: "story cards and trajectory markers",
    recommendedSceneDuration: 5.5,
    introStyle: "nobody believed opener",
    outroStyle: "how far can they go CTA"
  },
  brazil_warning: {
    id: "brazil_warning",
    name: "Brazil Warning",
    description:
      "Template de alerta curto e direto sobre riscos que o Brasil nao pode ignorar.",
    niche: "brazil warning",
    defaultVisualPreset: "suspense",
    defaultCaptionStyle: "premium_yellow",
    defaultTransition: "flash",
    colorMood: "warning gold against stadium shadow",
    musicMood: "tense pulse with controlled hits",
    sfxMood: "alarm swells and tactical clicks",
    pacing: "warning escalation",
    cameraBehavior: "pressure close-ups and sharp pauses",
    overlayStyle: "warning frames and attention bars",
    recommendedSceneDuration: 4.9,
    introStyle: "hard caution opener",
    outroStyle: "is Brazil ready prompt"
  }
};

const templateAliases: Record<string, TemplateId> = {
  "cinematic-story": "cinematic_story",
  "kinetic-reveal": "comic_drama"
};

function normalizeCandidate(value: string) {
  return value.trim().replaceAll("-", "_").toLowerCase();
}

function isTemplateId(value: string): value is TemplateId {
  return templateIds.includes(value as TemplateId);
}

function normalizeFreeText(parts: Array<string | null | undefined>) {
  return parts
    .filter((part): part is string => typeof part === "string")
    .join(" ")
    .toLowerCase();
}

function resolveKeywordTemplate(text: string): TemplateId {
  if (text.includes("anime") || text.includes("manga") || text.includes("otaku")) {
    return "anime_dark";
  }

  if (
    text.includes("hq") ||
    text.includes("comic") ||
    text.includes("quadrinho") ||
    text.includes("batman")
  ) {
    return "comic_drama";
  }

  if (
    text.includes("game") ||
    text.includes("jogo") ||
    text.includes("fantasy") ||
    text.includes("rpg")
  ) {
    return "game_epic";
  }

  if (
    text.includes("misterio") ||
    text.includes("curiosidade") ||
    text.includes("dossie") ||
    text.includes("investig")
  ) {
    return "mystery_doc";
  }

  if (text.includes("historia") || text.includes("historico") || text.includes("guerra")) {
    return "history_dark";
  }

  if (
    text.includes("sport") ||
    text.includes("futebol") ||
    text.includes("nba") ||
    text.includes("ufc")
  ) {
    return "sports_hype";
  }

  if (
    text.includes("crime") ||
    text.includes("sombr") ||
    text.includes("assassin") ||
    text.includes("desaparec")
  ) {
    return "true_crime";
  }

  return "cinematic_story";
}

export function getTemplates(): ReelTemplate[] {
  return templateIds.map((templateId) => cloneTemplate(templateRegistry[templateId]));
}

export function getTemplateById(
  id: string | null | undefined
): ReelTemplate | null {
  if (typeof id !== "string" || id.trim().length === 0) {
    return null;
  }

  const normalized = normalizeCandidate(id);
  const aliasResolved = templateAliases[normalized] ?? normalized;

  if (!isTemplateId(aliasResolved)) {
    return null;
  }

  return cloneTemplate(templateRegistry[aliasResolved]);
}

export function suggestTemplateByNiche(niche: string | null | undefined): ReelTemplate {
  const resolvedId = resolveKeywordTemplate((niche ?? "").toLowerCase());
  return cloneTemplate(templateRegistry[resolvedId]);
}

export function suggestTemplateByChannel(channel: TemplateChannelInput): ReelTemplate {
  const directTemplate = getTemplateById(channel.defaultTemplate);

  if (directTemplate) {
    return directTemplate;
  }

  return suggestTemplateByNiche(
    normalizeFreeText([
      channel.niche,
      channel.visualStyle,
      channel.narrativeTone,
      channel.name
    ])
  );
}

export function suggestTemplateByProject(project: TemplateProjectInput): ReelTemplate {
  const directTemplate = getTemplateById(project.templateId);

  if (directTemplate) {
    return directTemplate;
  }

  if (project.channel) {
    const channelSuggestion = suggestTemplateByChannel(project.channel);

    if (channelSuggestion) {
      return channelSuggestion;
    }
  }

  return suggestTemplateByNiche(
    normalizeFreeText([project.title, project.script, project.channel?.niche])
  );
}

export const templateCatalog = getTemplates();

