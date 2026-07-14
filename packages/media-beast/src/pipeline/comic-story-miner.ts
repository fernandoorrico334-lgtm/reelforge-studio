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

function panelCharacters(panel: LocalComicPanelEvidence): string[] {
  return extractLocalPanelEntityIds(panel).map(normalizeBeatEntityName);
}

function panelThemes(panel: LocalComicPanelEvidence): string[] {
  return extractLocalPanelThemeIds(panel);
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
  const mainCharacter = input.characters[0] ?? "essa cena";
  const secondCharacter = input.characters[1];
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
  const characters = unique(input.panels.flatMap(panelCharacters));
  const themes = unique(input.panels.flatMap(panelThemes));
  const scoring = scoreOpportunity(input);
  const label = CATEGORY_LABELS[input.category];
  const mainCharacter = characters[0] ?? "a HQ";
  const pages = unique(input.panels.map((panel) => panel.pageNumber)).sort((left, right) => left - right);
  const style = input.category === "fight" ? "viral_fast_cut" : input.category === "reveal" ? "horror_tension" : "comic_drama";

  return {
    id: `comic-opportunity-${input.category}-${input.index + 1}`,
    title: `${label}: ${mainCharacter}${characters[1] ? ` + ${characters[1]}` : ""}`,
    category: input.category,
    hook: `A HQ tem um short de ${label} pronto nas paginas ${pages.join(", ")}.`,
    angle: `${label} a partir de ${dominantValue(themes, "sequencia visual")}`,
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
