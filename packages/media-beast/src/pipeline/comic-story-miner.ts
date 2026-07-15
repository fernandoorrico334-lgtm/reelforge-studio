import { basename } from "node:path";
import {
  extractLocalPanelEntityIds,
  extractLocalPanelThemeIds,
  normalizeBeatEntityName
} from "./comics-beat-panel-requirements.js";
import {
  buildComicPanelSequences,
  type ComicPanelSequence
} from "./comics-panel-sequences.js";
import {
  loadLocalComicPanelIndex,
  type LocalComicPanelEvidence,
  type LocalComicPanelIndex
} from "./comics-local-panel-index.js";

export type ComicShortOpportunityCategory =
  | "fight"
  | "curiosity"
  | "relationship"
  | "humor"
  | "reveal"
  | "origin"
  | "transformation"
  | "cliffhanger"
  | "visual_moment";

export type ComicStoryMinerPanelRef = {
  panelId: string;
  pageNumber: number;
  panelNumber: number;
  panelImagePath: string;
  sourcePagePath: string;
  storyFunction: LocalComicPanelEvidence["storyFunction"];
  visibleCharacters: string[];
  visibleThemes: string[];
  localDialogue: string[];
  localNarrationBoxes: string[];
  soundEffects: string[];
};

export type ComicPageStorySummary = {
  pageNumber: number;
  pageType: LocalComicPanelIndex["pages"][number]["pageType"];
  panelCount: number;
  validPanelCount: number;
  storyFunctions: string[];
  dominantCharacters: string[];
  dominantThemes: string[];
  dialogueLineCount: number;
  narrationBoxCount: number;
  soundEffectCount: number;
  usableTextSamples: string[];
  editorialRole: "cover" | "setup" | "context" | "action" | "climax" | "reveal" | "transition" | "non_narrative" | "unknown";
  shortPotentialScore: number;
  shortIdeas: Array<{
    category: ComicShortOpportunityCategory;
    title: string;
    reason: string;
  }>;
  warnings: string[];
};

export type ComicIssueStoryDigest = {
  pageCount: number;
  narrativePageCount: number;
  bestPages: number[];
  strongestCharacters: string[];
  strongestThemes: string[];
  actionPages: number[];
  dialoguePages: number[];
  climaxPages: number[];
  revealPages: number[];
  estimatedShortsAvailable: number;
  recommendedProductionOrder: number[];
  warnings: string[];
};

export type ComicShortOpportunity = {
  id: string;
  title: string;
  category: ComicShortOpportunityCategory;
  hook: string;
  angle: string;
  score: number;
  confidence: number;
  estimatedDurationSeconds: number;
  pages: number[];
  panelIds: string[];
  panels: ComicStoryMinerPanelRef[];
  characters: string[];
  themes: string[];
  storyArc: ComicPanelSequence["storyArc"] | "single_panel";
  narrationDraft: string;
  visualSequence: Array<{
    role: "hook" | "context" | "development" | "climax" | "payoff";
    panelId: string;
    reason: string;
  }>;
  recommendedStyle: "comic_drama" | "horror_tension" | "viral_fast_cut" | "cinematic_story";
  reasons: string[];
  warnings: string[];
};

export type ComicStoryMinerReport = {
  generatedAt: string;
  source: {
    assetDirectory: string | null;
    comicTitles: string[];
    issueTitles: string[];
    pageCount: number;
    panelCount: number;
    validPanelCount: number;
  };
  characterMap: Array<{
    name: string;
    panelCount: number;
    pages: number[];
  }>;
  themeMap: Array<{
    theme: string;
    panelCount: number;
    pages: number[];
  }>;
  opportunityCounts: Record<ComicShortOpportunityCategory, number>;
  pageSummaries: ComicPageStorySummary[];
  issueStoryDigest: ComicIssueStoryDigest;
  opportunities: ComicShortOpportunity[];
  topOpportunities: ComicShortOpportunity[];
  warnings: string[];
  candidateFirst: true;
  requiresManualApproval: true;
};

const CATEGORY_LABELS: Record<ComicShortOpportunityCategory, string> = {
  fight: "luta",
  curiosity: "curiosidade",
  relationship: "relacao",
  humor: "humor",
  reveal: "revelacao",
  origin: "origem",
  transformation: "transformacao",
  cliffhanger: "cliffhanger",
  visual_moment: "momento visual"
};

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function compactText(values: string[], fallback: string): string {
  const hit = values.map((value) => value.trim()).find((value) => value.length > 0);
  return hit ?? fallback;
}

function dominantValue(values: string[], fallback = "desconhecido"): string {
  const counts = new Map<string, number>();
  for (const value of values.filter(Boolean)) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] ?? fallback;
}

const DISPLAY_ENTITY_NAMES: Record<string, string> = {
  justice_league: "Liga da Justica",
  godzilla: "Godzilla",
  kong: "Kong",
  superman: "Superman",
  batman: "Batman",
  wonder_woman: "Mulher-Maravilha",
  aquaman: "Aquaman",
  flash: "Flash",
  green_lantern: "Lanterna Verde",
  doctor_strange: "Doutor Estranho",
  spider_man: "Homem-Aranha",
  "spider-man": "Homem-Aranha",
  venom: "Venom",
  symbiote: "Simbionte",
  deadpool: "Deadpool"
};

const THEME_LABELS: Record<string, string> = {
  kaiju_crossover: "crossover de kaijus",
  hero_team: "equipe de herois",
  monster_battle: "batalha de monstros",
  city_destruction: "destruicao urbana",
  titan_standoff: "confronto de titas",
  multiverse_crisis: "crise de mundos",
  partnership: "alianca improvavel",
  symbiosis: "simbiose",
  mystical_speech: "misterio sobrenatural",
  black_suit: "traje sombrio"
};

function normalizeContextText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[_-]+/g, " ");
}

function panelContextText(panel: LocalComicPanelEvidence): string {
  return [
    panel.parentContext.comicTitle ?? "",
    panel.parentContext.issueTitle ?? "",
    panel.parentContext.pageTitle ?? "",
    ...panel.parentContext.parentTags,
    panel.sourcePagePath,
    panel.panelImagePath,
    ...panel.localEvidence.detectedText,
    ...panel.localEvidence.dialogue,
    ...panel.localEvidence.narrationBoxes,
    ...panel.localEvidence.soundEffects,
    ...panel.localEvidence.visualThemes
  ].join(" ");
}

function inferEntitiesFromComicContext(text: string): string[] {
  const normalized = normalizeContextText(text);
  const entities: string[] = [];
  if (/liga da justica|justice league|superman|batman|wonder woman|mulher maravilha|aquaman|flash|lanterna verde|green lantern/.test(normalized)) {
    entities.push("justice_league");
  }
  if (/godzilla/.test(normalized)) entities.push("godzilla");
  if (/\bkong\b|king kong/.test(normalized)) entities.push("kong");
  if (/superman/.test(normalized)) entities.push("superman");
  if (/batman/.test(normalized)) entities.push("batman");
  if (/wonder woman|mulher maravilha/.test(normalized)) entities.push("wonder_woman");
  if (/aquaman/.test(normalized)) entities.push("aquaman");
  if (/\bflash\b/.test(normalized)) entities.push("flash");
  if (/lanterna verde|green lantern/.test(normalized)) entities.push("green_lantern");
  if (/venom/.test(normalized)) entities.push("venom");
  if (/homem aranha|spider man|spider-man/.test(normalized)) entities.push("spider_man");
  if (/deadpool/.test(normalized)) entities.push("deadpool");
  return unique(entities);
}

function inferThemesFromComicContext(text: string): string[] {
  const normalized = normalizeContextText(text);
  const themes: string[] = [];
  if (/godzilla|\bkong\b|kaiju|titan/.test(normalized)) themes.push("kaiju_crossover");
  if (/liga da justica|justice league|superman|batman|wonder woman|aquaman|flash/.test(normalized)) themes.push("hero_team");
  if (/godzilla.*kong|kong.*godzilla|monster|monstro|kaiju/.test(normalized)) themes.push("monster_battle");
  if (/cidade|city|destruicao|destruction|metropolis|gotham/.test(normalized)) themes.push("city_destruction");
  if (/versus| vs |confronto|battle|batalha/.test(normalized)) themes.push("titan_standoff");
  if (/crise|portal|mundo|multiverse|multiverso/.test(normalized)) themes.push("multiverse_crisis");
  return unique(themes);
}

function displayEntityName(value: string): string {
  return DISPLAY_ENTITY_NAMES[value] ?? value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function displayThemeName(value: string): string {
  return THEME_LABELS[value] ?? value.replace(/_/g, " ");
}

function dominantEntitiesForPanels(panels: LocalComicPanelEvidence[]): string[] {
  const counts = new Map<string, number>();
  for (const panel of panels) {
    for (const character of panelCharacters(panel)) {
      counts.set(character, (counts.get(character) ?? 0) + 3);
    }
    for (const inferred of inferEntitiesFromComicContext(panelContextText(panel))) {
      counts.set(inferred, (counts.get(inferred) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1])
    .map(([entity]) => entity);
}

function dominantThemesForPanels(panels: LocalComicPanelEvidence[]): string[] {
  const counts = new Map<string, number>();
  for (const panel of panels) {
    for (const theme of panelThemes(panel)) {
      counts.set(theme, (counts.get(theme) ?? 0) + 3);
    }
    for (const inferred of inferThemesFromComicContext(panelContextText(panel))) {
      counts.set(inferred, (counts.get(inferred) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1])
    .map(([theme]) => theme);
}

function describePages(pages: number[]): string {
  if (pages.length === 0) return "nas paginas selecionadas";
  if (pages.length === 1) return `na pagina ${pages[0]}`;
  const first = pages[0]!;
  const last = pages[pages.length - 1]!;
  return pages.length > 4 ? `entre as paginas ${first} e ${last}` : `nas paginas ${pages.join(", ")}`;
}

function buildOpportunityTitle(input: {
  category: ComicShortOpportunityCategory;
  characters: string[];
  themes: string[];
  pages: number[];
  panels: LocalComicPanelEvidence[];
}): string {
  const label = CATEGORY_LABELS[input.category];
  const displayCharacters = input.characters.slice(0, 3).map(displayEntityName);
  const theme = displayThemeName(input.themes[0] ?? dominantValue(input.panels.flatMap(panelThemes), "sequencia visual"));
  if (displayCharacters.length >= 2) return `${label}: ${displayCharacters[0]} contra ${displayCharacters[1]}`;
  if (displayCharacters.length === 1 && input.category === "fight") return `${label}: ${displayCharacters[0]} no confronto principal`;
  if (displayCharacters.length === 1) return `${label}: ${displayCharacters[0]} em ${theme}`;
  return `${label}: ${theme} ${describePages(input.pages)}`;
}

function panelCharacters(panel: LocalComicPanelEvidence): string[] {
  return unique([
    ...extractLocalPanelEntityIds(panel).map(normalizeBeatEntityName),
    ...inferEntitiesFromComicContext(panelContextText(panel))
  ]);
}

function panelThemes(panel: LocalComicPanelEvidence): string[] {
  return unique([
    ...extractLocalPanelThemeIds(panel),
    ...inferThemesFromComicContext(panelContextText(panel))
  ]);
}

function panelActions(panel: LocalComicPanelEvidence): string[] {
  return panel.localEvidence.actions.map((entry) => entry.label.toLowerCase());
}

function panelRelationships(panel: LocalComicPanelEvidence): string[] {
  return panel.localEvidence.relationships.map((entry) => entry.type);
}

function panelRef(panel: LocalComicPanelEvidence): ComicStoryMinerPanelRef {
  return {
    panelId: panel.panelId,
    pageNumber: panel.pageNumber,
    panelNumber: panel.panelNumber,
    panelImagePath: panel.panelImagePath,
    sourcePagePath: panel.sourcePagePath,
    storyFunction: panel.storyFunction,
    visibleCharacters: panelCharacters(panel),
    visibleThemes: panelThemes(panel),
    localDialogue: panel.localEvidence.dialogue,
    localNarrationBoxes: panel.localEvidence.narrationBoxes,
    soundEffects: panel.localEvidence.soundEffects
  };
}

function flattenIndex(index: LocalComicPanelIndex): LocalComicPanelEvidence[] {
  return index.pages
    .flatMap((page) => page.panels)
    .sort((left, right) => {
      if (left.pageNumber !== right.pageNumber) return left.pageNumber - right.pageNumber;
      return left.readingOrder - right.readingOrder;
    });
}

function panelsForSequence(
  panels: LocalComicPanelEvidence[],
  sequence: ComicPanelSequence
): LocalComicPanelEvidence[] {
  const byId = new Map(panels.map((panel) => [panel.panelId, panel]));
  return sequence.panelIds.map((panelId) => byId.get(panelId)).filter((panel): panel is LocalComicPanelEvidence => Boolean(panel));
}

function detectCategories(input: {
  panels: LocalComicPanelEvidence[];
  sequence: ComicPanelSequence | null;
}): ComicShortOpportunityCategory[] {
  const functions = input.panels.map((panel) => panel.storyFunction);
  const actions = input.panels.flatMap(panelActions).join(" ");
  const relationships = input.panels.flatMap(panelRelationships);
  const text = input.panels
    .flatMap((panel) => [
      ...panel.localEvidence.dialogue,
      ...panel.localEvidence.narrationBoxes,
      ...panel.localEvidence.detectedText,
      ...panel.localEvidence.soundEffects
    ])
    .join(" ")
    .toLowerCase();
  const categories = new Set<ComicShortOpportunityCategory>();

  if (
    input.sequence?.storyArc === "conflict" ||
    relationships.includes("conflict") ||
    functions.some((fn) => ["action", "climax"].includes(fn)) ||
    /fight|attack|punch|hit|explosion|boom|krash|pow|soco|ataque|luta/i.test(actions + " " + text)
  ) {
    categories.add("fight");
  }
  if (
    functions.some((fn) => ["setup", "context", "dialogue"].includes(fn)) ||
    input.panels.some((panel) => panel.localEvidence.narrationBoxes.length > 0) ||
    /secret|segredo|curios|sabia|origem|antes|porque|por que/i.test(text)
  ) {
    categories.add("curiosity");
  }
  if (
    input.sequence?.storyArc === "relationship" ||
    relationships.some((rel) => ["duo", "conversation", "host_symbiote"].includes(rel))
  ) {
    categories.add("relationship");
  }
  if (/haha|piada|joke|funny|ridiculo|absurdo|deadpool|quebra/i.test(text)) {
    categories.add("humor");
  }
  if (functions.includes("reveal") || input.sequence?.storyArc === "reveal") categories.add("reveal");
  if (/origem|origin|primeira vez|nasceu|criado|created/i.test(text)) categories.add("origin");
  if (functions.includes("transformation") || input.sequence?.storyArc === "transformation") {
    categories.add("transformation");
  }
  if (functions.includes("reaction") || /continua|next|fim\?|agora/i.test(text)) {
    categories.add("cliffhanger");
  }
  if (categories.size === 0) categories.add("visual_moment");

  return [...categories];
}

function scoreOpportunity(input: {
  panels: LocalComicPanelEvidence[];
  sequence: ComicPanelSequence | null;
  category: ComicShortOpportunityCategory;
}): { score: number; reasons: string[]; warnings: string[] } {
  const reasons: string[] = [];
  const warnings: string[] = [];
  const visualQuality = input.panels.reduce((sum, panel) => sum + panel.quality.visualQualityScore, 0) / input.panels.length;
  const cropability = input.panels.reduce((sum, panel) => sum + panel.quality.cropability916Score, 0) / input.panels.length;
  const confidence = input.panels.reduce((sum, panel) => sum + panel.confidence.overall * 100, 0) / input.panels.length;
  const directEvidenceRatio = input.panels.filter((panel) => panel.evidenceTier === "direct_evidence").length / input.panels.length;
  const textSignal = input.panels.some(
    (panel) => panel.localEvidence.dialogue.length > 0 || panel.localEvidence.narrationBoxes.length > 0
  )
    ? 8
    : 0;
  let score = visualQuality * 0.22 + cropability * 0.18 + confidence * 0.2 + directEvidenceRatio * 16 + textSignal;

  if (input.sequence) {
    score += input.sequence.continuityScore * 0.16;
    score += input.sequence.narrativeProgressionScore * 0.13;
    score += input.sequence.selfContainedScore * 0.11;
    reasons.push("sequence:" + input.sequence.sequenceId);
    reasons.push("arc:" + input.sequence.storyArc);
  } else {
    score += 8;
  }

  if (input.panels.length >= 3) score += 6;
  if (input.panels.length > 8) {
    score -= 8;
    warnings.push("long_sequence_review_required");
  }
  if (input.panels.some((panel) => panel.isWholePageFallback)) {
    score -= 20;
    warnings.push("contains_whole_page_fallback");
  }
  if (input.category === "fight" && input.panels.some((panel) => panel.storyFunction === "climax")) score += 8;
  if (input.category === "curiosity" && textSignal > 0) score += 8;
  if (input.category === "relationship" && input.panels.flatMap(panelRelationships).length > 0) score += 8;

  reasons.push("visual_quality:" + Math.round(visualQuality));
  reasons.push("cropability:" + Math.round(cropability));
  reasons.push("direct_evidence_ratio:" + directEvidenceRatio.toFixed(2));
  return { score: clampScore(score), reasons, warnings };
}

function buildNarrationDraft(input: {
  category: ComicShortOpportunityCategory;
  characters: string[];
  themes: string[];
  panels: LocalComicPanelEvidence[];
}): string {
  const mainCharacter = input.characters[0] ? displayEntityName(input.characters[0]) : "essa cena";
  const secondCharacter = input.characters[1] ? displayEntityName(input.characters[1]) : undefined;
  const localLine = compactText(
    input.panels.flatMap((panel) => [...panel.localEvidence.dialogue, ...panel.localEvidence.narrationBoxes]),
    "o painel entrega o contexto sem precisar inventar nada"
  );

  if (input.category === "fight") {
    return `Aqui a HQ transforma ${mainCharacter}${secondCharacter ? ` e ${secondCharacter}` : ""} em impacto visual: primeiro vem o contexto, depois a pancada, e o climax esta no painel que segura a tensao.`;
  }
  if (input.category === "curiosity") {
    return `Tem uma curiosidade escondida nessa sequencia: ${localLine}. O short pode explicar por que esse detalhe muda a leitura da cena.`;
  }
  if (input.category === "relationship") {
    return `Essa sequencia funciona porque nao e so acao; e relacao. ${mainCharacter}${secondCharacter ? ` e ${secondCharacter}` : ""} dividem o quadro, e a HQ usa isso para criar tensao.`;
  }
  if (input.category === "humor") {
    return "O humor aqui nasce do contraste: a arte leva a cena a serio, mas o texto e o timing deixam tudo absurdo no melhor sentido.";
  }
  if (input.category === "reveal" || input.category === "origin") {
    return "O short pode vender essa sequencia como revelacao: a HQ prepara a informacao, segura o detalhe e entrega o ponto que faz a cena valer.";
  }
  if (input.category === "transformation") {
    return "A transformacao e o centro desse trecho: a sequencia mostra o antes, o choque visual e a consequencia no mesmo arco.";
  }
  return "Essa sequencia tem forca visual para short: poucos paineis, leitura rapida e um ponto claro para transformar em narracao.";
}

function buildVisualSequence(panels: LocalComicPanelEvidence[]): ComicShortOpportunity["visualSequence"] {
  const roles: ComicShortOpportunity["visualSequence"][number]["role"][] = [
    "hook",
    "context",
    "development",
    "climax",
    "payoff"
  ];
  const selected = panels.length <= 5 ? panels : [panels[0]!, panels[1]!, panels[Math.floor(panels.length / 2)]!, panels[panels.length - 2]!, panels[panels.length - 1]!];
  return selected.map((panel, index) => ({
    role: roles[Math.min(index, roles.length - 1)]!,
    panelId: panel.panelId,
    reason: `${panel.storyFunction}:page${panel.pageNumber}`
  }));
}

function makeOpportunity(input: {
  category: ComicShortOpportunityCategory;
  panels: LocalComicPanelEvidence[];
  sequence: ComicPanelSequence | null;
  index: number;
}): ComicShortOpportunity {
  const characters = unique(dominantEntitiesForPanels(input.panels));
  const themes = unique(dominantThemesForPanels(input.panels));
  const scoring = scoreOpportunity(input);
  const label = CATEGORY_LABELS[input.category];
  const pages = unique(input.panels.map((panel) => panel.pageNumber)).sort((left, right) => left - right);
  const title = buildOpportunityTitle({
    category: input.category,
    characters,
    themes,
    pages,
    panels: input.panels
  });
  const style = input.category === "fight" ? "viral_fast_cut" : input.category === "reveal" ? "horror_tension" : "comic_drama";

  return {
    id: `comic-opportunity-${input.category}-${input.index + 1}`,
    title,
    category: input.category,
    hook: `${title} ja tem estrutura de short ${describePages(pages)}.`,
    angle: `${label} a partir de ${displayThemeName(dominantValue(themes, "sequencia visual"))}`,
    score: scoring.score,
    confidence: clampScore(scoring.score - scoring.warnings.length * 5),
    estimatedDurationSeconds: Math.max(18, Math.min(45, input.panels.length * 5)),
    pages,
    panelIds: input.panels.map((panel) => panel.panelId),
    panels: input.panels.map(panelRef),
    characters,
    themes,
    storyArc: input.sequence?.storyArc ?? "single_panel",
    narrationDraft: buildNarrationDraft({ category: input.category, characters, themes, panels: input.panels }),
    visualSequence: buildVisualSequence(input.panels),
    recommendedStyle: style,
    reasons: scoring.reasons,
    warnings: scoring.warnings
  };
}

function countValues(values: string[]): Array<[string, number]> {
  const counts = new Map<string, number>();
  for (const value of values.filter(Boolean)) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()].sort((left, right) => right[1] - left[1]);
}

function dominantFunctions(panels: LocalComicPanelEvidence[]): string[] {
  return countValues(panels.map((panel) => panel.storyFunction)).map(([value]) => value).slice(0, 5);
}

function inferPageEditorialRole(input: {
  pageType: LocalComicPanelIndex["pages"][number]["pageType"];
  panels: LocalComicPanelEvidence[];
}): ComicPageStorySummary["editorialRole"] {
  if (["cover", "credits", "advertisement", "catalog", "qr_promo", "editorial", "letters"].includes(input.pageType)) {
    return input.pageType === "cover" ? "cover" : "non_narrative";
  }
  const functions = input.panels.map((panel) => panel.storyFunction);
  if (functions.some((fn) => ["climax", "action"].includes(fn))) return "climax";
  if (functions.includes("reveal")) return "reveal";
  if (functions.includes("dialogue")) return "context";
  if (functions.includes("setup")) return "setup";
  if (functions.includes("reaction")) return "transition";
  return functions.length > 0 ? "context" : "unknown";
}

function scorePageShortPotential(input: {
  pageType: LocalComicPanelIndex["pages"][number]["pageType"];
  panels: LocalComicPanelEvidence[];
}): { score: number; warnings: string[] } {
  const warnings: string[] = [];
  if (["advertisement", "catalog", "qr_promo", "credits", "editorial", "letters"].includes(input.pageType)) {
    return { score: 0, warnings: [`non_narrative_page:${input.pageType}`] };
  }
  const validPanels = input.panels.filter((panel) => panel.valid && !panel.isWholePageFallback);
  if (validPanels.length === 0) return { score: 0, warnings: ["no_valid_panels"] };
  const functions = validPanels.map((panel) => panel.storyFunction);
  const avgVisual = validPanels.reduce((sum, panel) => sum + panel.quality.visualQualityScore, 0) / validPanels.length;
  const avgCrop = validPanels.reduce((sum, panel) => sum + panel.quality.cropability916Score, 0) / validPanels.length;
  const textCount = validPanels.reduce((sum, panel) => sum + panel.localEvidence.dialogue.length + panel.localEvidence.narrationBoxes.length, 0);
  let score = avgVisual * 0.28 + avgCrop * 0.22 + Math.min(24, validPanels.length * 4) + Math.min(14, textCount * 3);
  if (functions.some((fn) => ["climax", "action", "reveal", "transformation"].includes(fn))) score += 18;
  if (validPanels.some((panel) => panel.evidenceTier === "direct_evidence")) score += 10;
  if (validPanels.some((panel) => panel.isWholePageFallback)) {
    score -= 18;
    warnings.push("whole_page_fallback_present");
  }
  return { score: clampScore(score), warnings };
}

function buildPageShortIdeas(input: {
  pageNumber: number;
  panels: LocalComicPanelEvidence[];
  characters: string[];
  themes: string[];
}): ComicPageStorySummary["shortIdeas"] {
  const categories = detectCategories({ panels: input.panels, sequence: null }).slice(0, 3);
  return categories.map((category) => ({
    category,
    title: buildOpportunityTitle({
      category,
      characters: input.characters,
      themes: input.themes,
      pages: [input.pageNumber],
      panels: input.panels
    }),
    reason: `page_${input.pageNumber}:${category}:${dominantValue(input.panels.map((panel) => panel.storyFunction), "story")}`
  }));
}

function buildComicPageStorySummaries(index: LocalComicPanelIndex): ComicPageStorySummary[] {
  return index.pages.map((page) => {
    const panels = page.panels.filter((panel) => panel.valid);
    const validPanels = panels.filter((panel) => !panel.isWholePageFallback);
    const characters = dominantEntitiesForPanels(validPanels).slice(0, 5);
    const themes = dominantThemesForPanels(validPanels).slice(0, 5);
    const textSamples = unique(
      validPanels.flatMap((panel) => [
        ...panel.localEvidence.narrationBoxes,
        ...panel.localEvidence.dialogue,
        ...panel.localEvidence.soundEffects
      ])
    ).slice(0, 8);
    const potential = scorePageShortPotential({ pageType: page.pageType, panels });
    return {
      pageNumber: page.pageNumber,
      pageType: page.pageType,
      panelCount: page.panels.length,
      validPanelCount: validPanels.length,
      storyFunctions: dominantFunctions(validPanels),
      dominantCharacters: characters,
      dominantThemes: themes,
      dialogueLineCount: validPanels.reduce((sum, panel) => sum + panel.localEvidence.dialogue.length, 0),
      narrationBoxCount: validPanels.reduce((sum, panel) => sum + panel.localEvidence.narrationBoxes.length, 0),
      soundEffectCount: validPanels.reduce((sum, panel) => sum + panel.localEvidence.soundEffects.length, 0),
      usableTextSamples: textSamples,
      editorialRole: inferPageEditorialRole({ pageType: page.pageType, panels: validPanels }),
      shortPotentialScore: potential.score,
      shortIdeas: buildPageShortIdeas({ pageNumber: page.pageNumber, panels: validPanels, characters, themes }),
      warnings: potential.warnings
    };
  });
}

function buildIssueStoryDigest(input: {
  pageSummaries: ComicPageStorySummary[];
  panels: LocalComicPanelEvidence[];
}): ComicIssueStoryDigest {
  const narrativePages = input.pageSummaries.filter((page) => page.editorialRole !== "non_narrative" && page.editorialRole !== "cover");
  const bestPages = [...input.pageSummaries]
    .filter((page) => page.shortPotentialScore >= 45)
    .sort((left, right) => right.shortPotentialScore - left.shortPotentialScore)
    .map((page) => page.pageNumber);
  const actionPages = input.pageSummaries.filter((page) => ["action", "climax"].includes(page.editorialRole)).map((page) => page.pageNumber);
  const dialoguePages = input.pageSummaries.filter((page) => page.dialogueLineCount + page.narrationBoxCount > 0).map((page) => page.pageNumber);
  const revealPages = input.pageSummaries.filter((page) => page.editorialRole === "reveal").map((page) => page.pageNumber);
  const climaxPages = input.pageSummaries.filter((page) => page.editorialRole === "climax").map((page) => page.pageNumber);
  const estimatedShortsAvailable = Math.max(0, Math.min(30, Math.round(bestPages.length * 0.75 + climaxPages.length * 0.5 + revealPages.length * 0.5)));
  const warnings: string[] = [];
  if (bestPages.length < 5) warnings.push("low_page_short_potential_review_needed");
  if (dialoguePages.length === 0) warnings.push("no_reliable_text_pages_detected");
  return {
    pageCount: input.pageSummaries.length,
    narrativePageCount: narrativePages.length,
    bestPages: bestPages.slice(0, 20),
    strongestCharacters: dominantEntitiesForPanels(input.panels).slice(0, 10),
    strongestThemes: dominantThemesForPanels(input.panels).slice(0, 10),
    actionPages: actionPages.slice(0, 20),
    dialoguePages: dialoguePages.slice(0, 20),
    climaxPages: climaxPages.slice(0, 20),
    revealPages: revealPages.slice(0, 20),
    estimatedShortsAvailable,
    recommendedProductionOrder: unique([...bestPages.slice(0, 12), ...climaxPages.slice(0, 6), ...revealPages.slice(0, 6)]).slice(0, 20),
    warnings
  };
}
function buildCharacterMap(panels: LocalComicPanelEvidence[]): ComicStoryMinerReport["characterMap"] {
  const map = new Map<string, { panelCount: number; pages: Set<number> }>();
  for (const panel of panels) {
    for (const character of panelCharacters(panel)) {
      const entry = map.get(character) ?? { panelCount: 0, pages: new Set<number>() };
      entry.panelCount += 1;
      entry.pages.add(panel.pageNumber);
      map.set(character, entry);
    }
  }
  return [...map.entries()]
    .map(([name, entry]) => ({ name, panelCount: entry.panelCount, pages: [...entry.pages].sort((a, b) => a - b) }))
    .sort((left, right) => right.panelCount - left.panelCount);
}

function buildThemeMap(panels: LocalComicPanelEvidence[]): ComicStoryMinerReport["themeMap"] {
  const map = new Map<string, { panelCount: number; pages: Set<number> }>();
  for (const panel of panels) {
    for (const theme of panelThemes(panel)) {
      const entry = map.get(theme) ?? { panelCount: 0, pages: new Set<number>() };
      entry.panelCount += 1;
      entry.pages.add(panel.pageNumber);
      map.set(theme, entry);
    }
  }
  return [...map.entries()]
    .map(([theme, entry]) => ({ theme, panelCount: entry.panelCount, pages: [...entry.pages].sort((a, b) => a - b) }))
    .sort((left, right) => right.panelCount - left.panelCount);
}

export function mineComicStoryVault(input: {
  index: LocalComicPanelIndex;
  maxOpportunities?: number;
  minScore?: number;
}): ComicStoryMinerReport {
  const allPanels = flattenIndex(input.index);
  const validPanels = allPanels.filter((panel) => panel.valid && !panel.isWholePageFallback);
  const warnings: string[] = [];
  if (validPanels.length < 4) warnings.push(`low_valid_panel_count:${validPanels.length}`);

  const sequences = buildComicPanelSequences(validPanels);
  const opportunities: ComicShortOpportunity[] = [];
  let counter = 0;

  for (const sequence of sequences) {
    const sequencePanels = panelsForSequence(validPanels, sequence);
    if (sequencePanels.length === 0) continue;
    const categories = detectCategories({ panels: sequencePanels, sequence });
    for (const category of categories) {
      const opportunity = makeOpportunity({ category, panels: sequencePanels, sequence, index: counter });
      counter += 1;
      opportunities.push(opportunity);
    }
  }

  for (const panel of validPanels) {
    if (!["climax", "reveal", "transformation", "action", "reaction"].includes(panel.storyFunction)) continue;
    const categories = detectCategories({ panels: [panel], sequence: null });
    for (const category of categories) {
      const opportunity = makeOpportunity({ category, panels: [panel], sequence: null, index: counter });
      counter += 1;
      opportunities.push(opportunity);
    }
  }

  const pageSummaries = buildComicPageStorySummaries(input.index);
  const issueStoryDigest = buildIssueStoryDigest({ pageSummaries, panels: validPanels });

  const minScore = input.minScore ?? 60;
  const ranked = opportunities
    .filter((opportunity) => opportunity.score >= minScore)
    .sort((left, right) => right.score - left.score);
  const max = input.maxOpportunities ?? 50;
  const selected = ranked.slice(0, max);
  const counts = Object.fromEntries(
    (Object.keys(CATEGORY_LABELS) as ComicShortOpportunityCategory[]).map((category) => [
      category,
      selected.filter((opportunity) => opportunity.category === category).length
    ])
  ) as Record<ComicShortOpportunityCategory, number>;

  const comicTitles = unique(
    allPanels.map((panel) => panel.parentContext.comicTitle).filter((value): value is string => Boolean(value))
  );
  const issueTitles = unique(
    allPanels.map((panel) => panel.parentContext.issueTitle).filter((value): value is string => Boolean(value))
  );

  return {
    generatedAt: new Date().toISOString(),
    source: {
      assetDirectory: input.index.assetDirectory || null,
      comicTitles,
      issueTitles,
      pageCount: input.index.pages.length,
      panelCount: allPanels.length,
      validPanelCount: validPanels.length
    },
    characterMap: buildCharacterMap(validPanels).slice(0, 30),
    themeMap: buildThemeMap(validPanels).slice(0, 30),
    opportunityCounts: counts,
    pageSummaries,
    issueStoryDigest,
    opportunities: selected,
    topOpportunities: selected.slice(0, 12),
    warnings,
    candidateFirst: true,
    requiresManualApproval: true
  };
}

export async function mineComicStoryVaultFromDirectory(input: {
  assetDirectory: string;
  maxOpportunities?: number;
  minScore?: number;
}): Promise<ComicStoryMinerReport> {
  const index = await loadLocalComicPanelIndex(input.assetDirectory);
  if (!index) {
    return {
      generatedAt: new Date().toISOString(),
      source: {
        assetDirectory: input.assetDirectory,
        comicTitles: [basename(input.assetDirectory)],
        issueTitles: [],
        pageCount: 0,
        panelCount: 0,
        validPanelCount: 0
      },
      characterMap: [],
      themeMap: [],
      opportunityCounts: Object.fromEntries(
        (Object.keys(CATEGORY_LABELS) as ComicShortOpportunityCategory[]).map((category) => [category, 0])
      ) as Record<ComicShortOpportunityCategory, number>,
      pageSummaries: [],
      issueStoryDigest: {
        pageCount: 0,
        narrativePageCount: 0,
        bestPages: [],
        strongestCharacters: [],
        strongestThemes: [],
        actionPages: [],
        dialoguePages: [],
        climaxPages: [],
        revealPages: [],
        estimatedShortsAvailable: 0,
        recommendedProductionOrder: [],
        warnings: ["local_comic_panel_index_missing_or_outdated"]
      },
      opportunities: [],
      topOpportunities: [],
      warnings: ["local_comic_panel_index_missing_or_outdated"],
      candidateFirst: true,
      requiresManualApproval: true
    };
  }

  return mineComicStoryVault({
    index,
    ...(input.maxOpportunities !== undefined ? { maxOpportunities: input.maxOpportunities } : {}),
    ...(input.minScore !== undefined ? { minScore: input.minScore } : {})
  });
}


