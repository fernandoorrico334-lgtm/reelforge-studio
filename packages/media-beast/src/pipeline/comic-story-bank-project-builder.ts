import type { ComicHQWideStoryBankReport, ComicStoryBankCategory, ComicStoryBankIdea } from "./comic-hq-wide-story-bank.js";
import type { ComicStoryMinerPanelRef } from "./comic-story-miner.js";

export type ComicStoryBankShortSceneRole = "hook" | "context" | "evidence" | "escalation" | "payoff" | "cta";

export type ComicStoryBankShortVisualFocus =
  | "wide_context"
  | "speech_balloon"
  | "action_impact"
  | "reaction"
  | "story_detail";

export type ComicStoryBankCaptionCue = {
  index: number;
  text: string;
  keyword: string;
  startSeconds: number;
  endSeconds: number;
  emphasis: "pop" | "shake" | "glow" | "impact" | "whisper";
  colorMood: "gold" | "red" | "blue" | "white";
};

export type ComicStoryBankPanelSelection = {
  mode: "idea_panel" | "page_match" | "storybeat_match" | "fallback_ranked" | "manual_review";
  selectedPanelId: string | null;
  selectedPanelImagePath: string | null;
  score: number;
  reasons: string[];
};

export type ComicStoryBankShortProjectScene = {
  order: number;
  role: ComicStoryBankShortSceneRole;
  title: string;
  narrationText: string;
  captionText: string;
  captionCues: ComicStoryBankCaptionCue[];
  pages: number[];
  panelIds: string[];
  visualFocus: ComicStoryBankShortVisualFocus;
  durationSeconds: number;
  editingDirection: string;
  transition: "page_tear" | "page_snap" | "impact_flash" | "hold_reveal";
  qualityNotes: string[];
  panelSelection?: ComicStoryBankPanelSelection;
};

export type ComicStoryBankVisualContinuityGate = {
  gateId: "comic_story_bank_visual_continuity_gate_v1";
  status: "passed" | "needs_review" | "blocked";
  score: number;
  uniquePanelCount: number;
  reusedPanelIds: string[];
  fallbackSceneOrders: number[];
  manualReviewSceneOrders: number[];
  chronologicalPageFlow: boolean;
  issueLocked: boolean;
  blockers: string[];
  warnings: string[];
  sceneReports: Array<{
    sceneOrder: number;
    panelId: string | null;
    pageNumber: number | null;
    mode: ComicStoryBankPanelSelection["mode"] | "missing";
    score: number;
    status: "ready" | "needs_review" | "blocked";
    reasons: string[];
    warnings: string[];
  }>;
};

export type ComicStoryBankStoryboardOptimizationReport = {
  optimizerId: "comic_story_bank_panel_storyboard_optimizer_v1";
  attempted: boolean;
  optimizedSceneCount: number;
  before: {
    uniquePanelCount: number;
    reusedPanelIds: string[];
    fallbackSceneOrders: number[];
  };
  after: {
    uniquePanelCount: number;
    reusedPanelIds: string[];
    fallbackSceneOrders: number[];
  };
  changes: Array<{
    sceneOrder: number;
    fromPanelId: string | null;
    toPanelId: string | null;
    fromMode: ComicStoryBankPanelSelection["mode"] | "missing";
    toMode: ComicStoryBankPanelSelection["mode"] | "missing";
    reason: string;
  }>;
  warnings: string[];
};

export type ComicStoryBankShortProjectPlan = {
  builderId: "comic_story_bank_project_builder_v1";
  generatedAt: string;
  sagaTitle: string;
  channelId: string | null;
  idea: ComicStoryBankIdea;
  title: string;
  format: "vertical_9_16";
  targetDurationSeconds: number;
  estimatedDurationSeconds: number;
  script: string;
  scenes: ComicStoryBankShortProjectScene[];
  narrationPlan: {
    tone: "human_curiosity" | "epic_explainer" | "dark_documentary" | "fast_hype";
    fullNarration: string;
    voicePackSuggestion: "documentary_ptbr" | "story_epic_ptbr" | "true_crime_dark_ptbr" | "sports_hype_ptbr";
    warnings: string[];
  };
  editPlan: {
    pacing: "dynamic_30s" | "dynamic_45s" | "deep_explainer";
    maxHoldSeconds: 4;
    captionStyle: "comic_premium_pop" | "comic_dark_fact" | "comic_epic_bold";
    transitions: string[];
    sfx: string[];
    visualRule: string;
  };
  panelAssetManifest: Array<{
    sceneOrder: number;
    pageNumber: number | null;
    panelId: string | null;
    intent: ComicStoryBankShortVisualFocus;
    importRequired: true;
  }>;
  storyboardOptimization: ComicStoryBankStoryboardOptimizationReport;
  visualContinuityGate: ComicStoryBankVisualContinuityGate;
  qualityGates: {
    hasMinimumDuration: boolean;
    hasStoryArc: boolean;
    hasChronologicalPages: boolean;
    hasVisualEvidence: boolean;
    hasPanelContinuity: boolean;
    canCreateProject: boolean;
    blockers: string[];
    warnings: string[];
  };
  candidateFirst: true;
  requiresManualApproval: true;
};

export type BuildComicStoryBankShortProjectInput = {
  storyBank: ComicHQWideStoryBankReport;
  ideaId?: string;
  category?: ComicStoryBankCategory;
  channelId?: string | null;
  targetDurationSeconds?: number;
  panelsById?: Map<string, ComicStoryMinerPanelRef> | Record<string, ComicStoryMinerPanelRef> | ComicStoryMinerPanelRef[];
};

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function safeSentence(value: string | null | undefined, fallback: string): string {
  const normalized = (value ?? "").replace(/\s+/g, " ").trim();
  return normalized.length > 0 ? normalized : fallback;
}

function shortText(value: string, maxLength: number): string {
  const trimmed = value.replace(/\s+/g, " ").trim();
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength - 3).trim()}...`;
}

function chooseIdea(input: BuildComicStoryBankShortProjectInput): ComicStoryBankIdea {
  const allIdeas = input.storyBank.topIdeas.length
    ? input.storyBank.topIdeas
    : Object.values(input.storyBank.buckets).flatMap((bucket) => bucket.ideas);
  if (input.ideaId) {
    const found = allIdeas.find((idea) => idea.id === input.ideaId);
    if (found) return found;
  }
  if (input.category) {
    const bucketIdea = input.storyBank.buckets[input.category].ideas.find((idea) => idea.readiness !== "weak")
      ?? input.storyBank.buckets[input.category].ideas[0];
    if (bucketIdea) return bucketIdea;
  }
  const planned = input.storyBank.productionMiningPlan[0];
  if (planned) {
    const found = allIdeas.find((idea) => idea.id === planned.ideaId);
    if (found) return found;
  }
  const best = allIdeas.find((idea) => idea.readiness !== "weak") ?? allIdeas[0];
  if (!best) throw new Error("comic_story_bank_project_builder:no_story_bank_ideas");
  return best;
}

function toneForCategory(category: ComicStoryBankCategory): ComicStoryBankShortProjectPlan["narrationPlan"]["tone"] {
  if (category === "battle" || category === "visual_spectacle" || category === "cliffhanger") return "epic_explainer";
  if (category === "curiosity" || category === "lore") return "human_curiosity";
  if (category === "absurdity") return "fast_hype";
  return "dark_documentary";
}

function voiceForCategory(category: ComicStoryBankCategory): ComicStoryBankShortProjectPlan["narrationPlan"]["voicePackSuggestion"] {
  if (category === "battle" || category === "visual_spectacle" || category === "cliffhanger") return "story_epic_ptbr";
  if (category === "absurdity") return "sports_hype_ptbr";
  if (category === "curiosity" || category === "lore") return "documentary_ptbr";
  return "true_crime_dark_ptbr";
}

function captionStyleForCategory(category: ComicStoryBankCategory): ComicStoryBankShortProjectPlan["editPlan"]["captionStyle"] {
  if (category === "battle" || category === "visual_spectacle" || category === "cliffhanger") return "comic_epic_bold";
  if (category === "curiosity" || category === "lore") return "comic_dark_fact";
  return "comic_premium_pop";
}

function distributeDurations(sceneCount: number, targetDurationSeconds: number): number[] {
  const minScene = 4;
  const base = Math.max(30, targetDurationSeconds);
  const weights = Array.from({ length: sceneCount }, (_, index) => {
    if (index === 0) return 1.05;
    if (index === sceneCount - 2) return 1.15;
    if (index === sceneCount - 1) return 0.85;
    return 1;
  });
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  const durations = weights.map((weight) => Math.max(minScene, Math.round((base * weight) / total)));
  const diff = base - durations.reduce((sum, duration) => sum + duration, 0);
  durations[durations.length - 2] = Math.max(minScene, (durations[durations.length - 2] ?? minScene) + diff);
  return durations;
}

function scenePagesForIdea(idea: ComicStoryBankIdea, order: number, totalScenes: number): number[] {
  const pages = unique([...idea.pages]).sort((left, right) => left - right);
  if (pages.length === 0) return [];
  if (order === 1) return [pages[0]!];
  if (order === totalScenes) return [pages[pages.length - 1]!];
  const index = Math.min(pages.length - 1, Math.floor(((order - 1) / Math.max(1, totalScenes - 1)) * pages.length));
  return unique([pages[index]!, pages[Math.min(pages.length - 1, index + 1)]!]);
}

function scenePanelsForIdea(idea: ComicStoryBankIdea, order: number, totalScenes: number): string[] {
  const panels = unique(idea.panelIds);
  if (panels.length === 0) return [];
  const index = Math.min(panels.length - 1, Math.floor(((order - 1) / Math.max(1, totalScenes - 1)) * panels.length));
  return unique([panels[index]!, panels[Math.min(panels.length - 1, index + 1)]!]).filter(Boolean);
}

function scenePanelCandidatesForBeat(input: {
  idea: ComicStoryBankIdea;
  order: number;
  totalScenes: number;
  pages: number[];
  visualFocus: ComicStoryBankShortVisualFocus;
  panelsById: Map<string, ComicStoryMinerPanelRef>;
  usedPanelIds: Set<string>;
}): string[] {
  const positional = scenePanelsForIdea(input.idea, input.order, input.totalScenes);
  const samePagePanels = [...input.panelsById.values()]
    .filter((panel) => input.pages.includes(panel.pageNumber))
    .filter((panel) => input.idea.issueNumber === null || panelIssueNumber(panel) === input.idea.issueNumber);
  const candidates = unique([
    ...positional.map((panelId) => input.panelsById.get(panelId)).filter((panel): panel is ComicStoryMinerPanelRef => Boolean(panel)),
    ...samePagePanels
  ]);
  const ranked = candidates
    .map((panel) => ({
      panel,
      ...scorePanelForScene({
        panel,
        idea: input.idea,
        scene: {
          order: input.order,
          role: input.order === 1 ? "hook" : input.order === input.totalScenes ? "cta" : input.order >= input.totalScenes - 1 ? "payoff" : "evidence",
          pages: input.pages,
          visualFocus: input.visualFocus
        },
        usedPanelIds: input.usedPanelIds
      })
    }))
    .sort((left, right) => {
      const leftUnused = input.usedPanelIds.has(left.panel.panelId) ? 0 : 1;
      const rightUnused = input.usedPanelIds.has(right.panel.panelId) ? 0 : 1;
      const leftPageMatch = input.pages.includes(left.panel.pageNumber) ? 1 : 0;
      const rightPageMatch = input.pages.includes(right.panel.pageNumber) ? 1 : 0;
      return rightUnused - leftUnused || rightPageMatch - leftPageMatch || right.score - left.score || left.panel.pageNumber - right.panel.pageNumber || left.panel.panelNumber - right.panel.panelNumber;
    });
  return unique(ranked.slice(0, 3).map((candidate) => candidate.panel.panelId));
}

function normalizePanelsById(input: BuildComicStoryBankShortProjectInput["panelsById"]): Map<string, ComicStoryMinerPanelRef> {
  if (!input) return new Map();
  if (input instanceof Map) return input;
  if (Array.isArray(input)) return new Map(input.map((panel) => [panel.panelId, panel] as const));
  const panels = Object.values(input) as ComicStoryMinerPanelRef[];
  return new Map(panels.map((panel) => [panel.panelId, panel] as const));
}

function panelIssueNumber(panel: ComicStoryMinerPanelRef): number | null {
  const text = `${panel.panelId} ${panel.sourcePagePath} ${panel.panelImagePath}`;
  const match = /(?:^|[-_\/\\])i(?:ssue)?[-_ ]?(\d+)|issue[-_ ]?(\d+)/i.exec(text);
  const raw = match?.[1] ?? match?.[2];
  return raw ? Number(raw) : null;
}

function panelText(panel: ComicStoryMinerPanelRef): string {
  return [
    panel.panelId,
    panel.storyFunction,
    ...panel.visibleCharacters,
    ...panel.visibleThemes,
    ...panel.localDialogue,
    ...panel.localNarrationBoxes,
    ...panel.soundEffects,
    panel.visualCropEvidence.strongestActionLabel ?? "",
    panel.visualCropEvidence.strongestRelationshipType ?? "",
    ...panel.visualCropEvidence.textSamples
  ].join(" ").toLowerCase();
}

function panelMatchesFocus(panel: ComicStoryMinerPanelRef, focus: ComicStoryBankShortVisualFocus): number {
  const text = panelText(panel);
  let score = 0;
  if (focus === "speech_balloon") {
    score += panel.localDialogue.length * 20 + panel.localNarrationBoxes.length * 12 + panel.visualCropEvidence.evidenceCounts.detectedText * 8;
  }
  if (focus === "action_impact") {
    score += panel.visualCropEvidence.evidenceCounts.actions * 18 + panel.soundEffects.length * 14;
    if (/action|fight|climax|impact|attack|battle|luta|golpe|boom|krakoom/.test(text)) score += 24;
  }
  if (focus === "reaction") {
    score += panel.visibleCharacters.length * 10;
    if (/reaction|reacao|face|olha|percebe|assusta/.test(text)) score += 22;
  }
  if (focus === "wide_context") {
    if (/setup|context|dialogue|establishing/.test(text)) score += 20;
    score += Math.min(18, panel.visibleCharacters.length * 5 + panel.visibleThemes.length * 3);
  }
  if (focus === "story_detail") {
    score += panel.visualCropEvidence.evidenceCounts.dialogue * 9 + panel.visualCropEvidence.evidenceCounts.actions * 9;
    if (panel.visualCropEvidence.strongestActionLabel || panel.visualCropEvidence.strongestRelationshipType) score += 16;
  }
  score += Math.round(panel.visualCropEvidence.quality.cropability916Score * 0.12);
  score += Math.round(panel.visualCropEvidence.quality.visualQualityScore * 0.1);
  return score;
}

function scorePanelForScene(input: {
  panel: ComicStoryMinerPanelRef;
  idea: ComicStoryBankIdea;
  scene: Pick<ComicStoryBankShortProjectScene, "role" | "pages" | "visualFocus" | "order">;
  usedPanelIds: Set<string>;
}): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;
  if (input.scene.pages.includes(input.panel.pageNumber)) {
    score += 35;
    reasons.push(`page_match:${input.panel.pageNumber}`);
  }
  const panelIssue = panelIssueNumber(input.panel);
  if (input.idea.issueNumber !== null && panelIssue !== null) {
    if (panelIssue === input.idea.issueNumber) {
      score += 32;
      reasons.push(`issue_match:${panelIssue}`);
    } else {
      score -= 80;
      reasons.push(`wrong_issue_penalty:${panelIssue}`);
    }
  }
  if (input.idea.panelIds.includes(input.panel.panelId)) {
    score += 32;
    reasons.push("idea_panel_match");
  }
  const characterHits = input.idea.characters.filter((character) => input.panel.visibleCharacters.includes(character));
  const themeHits = input.idea.themes.filter((theme) => input.panel.visibleThemes.includes(theme));
  score += Math.min(24, characterHits.length * 12);
  score += Math.min(18, themeHits.length * 6);
  if (characterHits.length) reasons.push(`characters:${characterHits.join(",")}`);
  if (themeHits.length) reasons.push(`themes:${themeHits.slice(0, 3).join(",")}`);
  const focusScore = panelMatchesFocus(input.panel, input.scene.visualFocus);
  score += focusScore;
  reasons.push(`focus:${input.scene.visualFocus}:${focusScore}`);
  if (input.usedPanelIds.has(input.panel.panelId)) {
    score -= 45;
    reasons.push("reuse_penalty");
  }
  if (input.scene.role === "hook" && input.panel.visualCropEvidence.evidenceCounts.actions > 0) score += 10;
  if (input.scene.role === "context" && input.panel.localDialogue.length > 0) score += 8;
  if (input.scene.role === "payoff" && /reaction|reveal|cliffhanger/i.test(String(input.panel.storyFunction))) score += 12;
  return { score: Math.round(score), reasons };
}

function selectPanelForScene(input: {
  idea: ComicStoryBankIdea;
  scene: ComicStoryBankShortProjectScene;
  panelsById: Map<string, ComicStoryMinerPanelRef>;
  usedPanelIds: Set<string>;
}): ComicStoryBankPanelSelection {
  if (input.panelsById.size === 0) {
    return { mode: "manual_review", selectedPanelId: null, selectedPanelImagePath: null, score: 0, reasons: ["no_panel_index_provided"] };
  }
  const allPanelsRaw = [...input.panelsById.values()];
  const sameIssuePanels = input.idea.issueNumber === null ? allPanelsRaw : allPanelsRaw.filter((panel) => panelIssueNumber(panel) === input.idea.issueNumber);
  const allPanels = sameIssuePanels.length > 0 ? sameIssuePanels : allPanelsRaw;
  const ideaPanelCandidates = input.scene.panelIds
    .map((panelId) => input.panelsById.get(panelId))
    .filter((panel): panel is ComicStoryMinerPanelRef => Boolean(panel));
  const pageCandidates = allPanels.filter((panel) => input.scene.pages.includes(panel.pageNumber));
  const candidatePool = unique([...ideaPanelCandidates, ...pageCandidates, ...allPanels]);
  const ranked = candidatePool
    .map((panel) => ({ panel, ...scorePanelForScene({ panel, idea: input.idea, scene: input.scene, usedPanelIds: input.usedPanelIds }) }))
    .sort((left, right) => right.score - left.score || left.panel.pageNumber - right.panel.pageNumber || left.panel.panelNumber - right.panel.panelNumber);
  const selected = ranked[0];
  if (!selected || selected.score < 45) {
    return { mode: "manual_review", selectedPanelId: null, selectedPanelImagePath: null, score: selected?.score ?? 0, reasons: selected?.reasons ?? ["no_candidate_above_threshold"] };
  }
  input.usedPanelIds.add(selected.panel.panelId);
  const mode = input.idea.panelIds.includes(selected.panel.panelId)
    ? "idea_panel"
    : input.scene.pages.includes(selected.panel.pageNumber)
      ? "page_match"
      : input.scene.panelIds.includes(selected.panel.panelId) || selected.score >= 90
        ? "storybeat_match"
        : "fallback_ranked";
  return {
    mode,
    selectedPanelId: selected.panel.panelId,
    selectedPanelImagePath: selected.panel.panelImagePath,
    score: selected.score,
    reasons: selected.reasons
  };
}

function visualFocusForRole(role: ComicStoryBankShortSceneRole, idea: ComicStoryBankIdea): ComicStoryBankShortVisualFocus {
  if (role === "hook" && (idea.category === "curiosity" || idea.category === "lore")) return "speech_balloon";
  if (role === "hook") return "action_impact";
  if (role === "context") return "wide_context";
  if (role === "evidence") return idea.category === "curiosity" ? "speech_balloon" : "story_detail";
  if (role === "escalation") return "action_impact";
  if (role === "payoff") return "reaction";
  return "story_detail";
}

function transitionForRole(role: ComicStoryBankShortSceneRole): ComicStoryBankShortProjectScene["transition"] {
  if (role === "hook") return "impact_flash";
  if (role === "payoff") return "hold_reveal";
  if (role === "cta") return "page_snap";
  return "page_tear";
}

function categoryLabel(category: ComicStoryBankCategory): string {
  return category.replace(/_/g, " ");
}

function capitalizeFirst(value: string): string {
  return value.length ? `${value[0]!.toUpperCase()}${value.slice(1)}` : value;
}

function stripFinalPunctuation(value: string): string {
  return value.replace(/([.!?]+)(["'])$/, "$2").replace(/[.!?]+$/, "");
}

function readableName(value: string | null | undefined, fallback: string): string {
  const normalized = (value ?? "").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  return normalized.length ? normalized : fallback;
}

function humanizeAction(value: string): string {
  const readable = readableName(value, "a acao principal").toLowerCase();
  const replacements: Array<[RegExp, string]> = [
    [/superman clashes with titan in city/i, "Superman bate de frente com um tita no meio da cidade"],
    [/heroes discover kaiju signal/i, "os herois descobrem um sinal ligado ao Godzilla"],
    [/heroes react to impossible monster scale/i, "a Liga percebe que o tamanho da ameaca saiu do controle"],
    [/superman bate de frente com godzilla rajada/i, "Superman encara a rajada do Godzilla"],
    [/heroes reage a ameaca impossivel/i, "os herois percebem que a ameaca e maior do que parecia"]
  ];
  for (const [pattern, replacement] of replacements) {
    if (pattern.test(readable)) return replacement;
  }
  return readable;
}

function quotedDialogue(panel: ComicStoryMinerPanelRef | null): string | null {
  const line = panel?.localDialogue.find((item) => item.replace(/\s+/g, " ").trim().length >= 3)
    ?? panel?.visualCropEvidence.textSamples.find((item) => item.replace(/\s+/g, " ").trim().length >= 3)
    ?? null;
  return line ? `"${stripFinalPunctuation(shortText(line, 64))}"` : null;
}

function panelAction(panel: ComicStoryMinerPanelRef | null): string | null {
  return panel?.visualCropEvidence.strongestActionLabel
    ? humanizeAction(panel.visualCropEvidence.strongestActionLabel)
    : null;
}

function panelSfx(panel: ComicStoryMinerPanelRef | null): string | null {
  const sfx = panel?.soundEffects.find((item) => item.trim().length > 0) ?? null;
  return sfx ? shortText(sfx.toUpperCase(), 24) : null;
}

function panelSubject(idea: ComicStoryBankIdea, panel: ComicStoryMinerPanelRef | null): string {
  return readableName(panel?.visibleCharacters[0] ?? idea.characters[0], "a cena");
}

function buildNarrationLine(role: ComicStoryBankShortSceneRole, idea: ComicStoryBankIdea, sagaTitle: string, panel: ComicStoryMinerPanelRef | null = null): string {
  const subject = panelSubject(idea, panel);
  const hook = safeSentence(idea.hook, `Tem um detalhe em ${sagaTitle} que muda tudo.`);
  const conflict = safeSentence(idea.conflict, "O conflito cresce rapido e a pagina deixa claro que algo saiu do controle.");
  const payoff = safeSentence(idea.payoff, "O fechamento deixa uma pergunta que prende para a proxima parte.");
  const dialogue = quotedDialogue(panel);
  const action = panelAction(panel);
  const sfx = panelSfx(panel);
  if (role === "hook") {
    const concrete = action ? (action.toLowerCase().includes(subject.toLowerCase()) ? capitalizeFirst(action) : `${capitalizeFirst(subject)} entra em cena com ${action}`) : capitalizeFirst(hook);
    return shortText(`${concrete}. E repara: esse quadro nao esta aqui por acaso, ele e a promessa do short inteiro.`, 230);
  }
  if (role === "context") {
    const clue = dialogue ? `O balao ${dialogue} entrega o contexto.` : `A HQ coloca ${subject} dentro desse problema: ${conflict}`;
    return shortText(`${clue} Sem esse detalhe, a luta parece so pancadaria; com ele, a cena ganha motivo.`, 230);
  }
  if (role === "evidence") {
    const proof = dialogue ? `A prova esta no texto: ${dialogue}.` : action ? `A prova esta na acao: ${action}.` : `A prova esta no enquadramento desse painel.`;
    return shortText(`${stripFinalPunctuation(proof)}. E o zoom aqui precisa mostrar exatamente esse ponto, porque e ele que faz a historia andar.`, 230);
  }
  if (role === "escalation") {
    const impact = sfx ? `Quando aparece ${sfx},` : action ? `Quando ${action},` : "Quando a pagina vira,";
    return shortText(`${impact} a escala muda. Agora nao e so uma cena bonita: e a consequencia direta do conflito que a HQ plantou.`, 230);
  }
  if (role === "payoff") {
    const reaction = dialogue ? `Depois de ${stripFinalPunctuation(dialogue)},` : capitalizeFirst(payoff);
    return shortText(`${reaction} o espectador entende por que esse trecho vale um short inteiro. E ainda fica a sensacao de que a proxima pagina pode piorar tudo.`, 240);
  }
  return `Se voce quiser, eu monto a parte dois seguindo a HQ em ordem, sem pular o contexto.`;
}

function buildCaption(role: ComicStoryBankShortSceneRole, idea: ComicStoryBankIdea, panel: ComicStoryMinerPanelRef | null = null): string {
  const dialogue = quotedDialogue(panel);
  const action = panelAction(panel);
  if (role === "hook") return shortText(action ?? idea.hook, 70).toUpperCase();
  if (role === "context") return shortText(dialogue ? `O BALAO ENTREGA: ${dialogue}` : "O CONTEXTO MUDA TUDO", 72).toUpperCase();
  if (role === "evidence") return shortText(dialogue ?? action ?? "OLHA O DETALHE DO QUADRO", 72).toUpperCase();
  if (role === "escalation") return shortText(action ?? "A HISTORIA SOBE DE NIVEL", 72).toUpperCase();
  if (role === "payoff") return shortText(dialogue ?? idea.payoff, 70).toUpperCase();
  return "PARTE 2?";
}

function retentionQuestionForIdea(idea: ComicStoryBankIdea): string {
  const subject = readableName(idea.characters[0], "essa cena");
  if (idea.category === "battle" || idea.category === "visual_spectacle") return `Mas a pergunta e: ${capitalizeFirst(subject)} aguenta essa escala ate o fim?`;
  if (idea.category === "curiosity" || idea.category === "lore") return "E o detalhe mais importante quase passa batido.";
  if (idea.category === "cliffhanger") return "E e aqui que a HQ deixa a pior pergunta no ar.";
  return "So que a pagina seguinte muda o sentido da cena.";
}

function doctorSceneNarration(input: { scene: ComicStoryBankShortProjectScene; idea: ComicStoryBankIdea; selectedPanel: ComicStoryMinerPanelRef | null; sagaTitle: string }): { narrationText: string; captionText: string } {
  const { scene, idea, selectedPanel, sagaTitle } = input;
  const baseNarration = buildNarrationLine(scene.role, idea, sagaTitle, selectedPanel);
  const baseCaption = buildCaption(scene.role, idea, selectedPanel);
  const dialogue = quotedDialogue(selectedPanel);
  const action = panelAction(selectedPanel);
  if (scene.role === "hook") {
    const hookLine = action ? `Olha isso: ${action}.` : `Tem uma virada em ${sagaTitle} que muita gente passaria direto.`;
    return { narrationText: shortText(`${hookLine} ${retentionQuestionForIdea(idea)}`, 230), captionText: shortText(action ?? "ISSO MUDA A CENA", 72).toUpperCase() };
  }
  if (scene.role === "context") {
    const bridge = dialogue ? `Guarda esse balao: ${dialogue}.` : "Guarda esse contexto.";
    return { narrationText: shortText(dialogue ? `${bridge} Sem esse detalhe, a luta parece so pancadaria; com ele, a cena ganha motivo.` : `${bridge} ${baseNarration}`, 260), captionText: shortText(dialogue ? `GUARDA ESSE BALAO: ${dialogue}` : baseCaption, 74).toUpperCase() };
  }
  if (scene.role === "evidence") {
    return { narrationText: shortText(`${baseNarration} Esse e o tipo de detalhe que faz a pagina deixar de ser so imagem bonita.`, 280), captionText: baseCaption };
  }
  if (scene.role === "escalation") {
    return { narrationText: shortText(`${baseNarration} Agora o short precisa acelerar, porque a HQ acabou de entregar a virada visual.`, 280), captionText: shortText(action ?? baseCaption, 72).toUpperCase() };
  }
  if (scene.role === "payoff") {
    return { narrationText: shortText(`${baseNarration} E e por isso que essa sequencia funciona: ela nao mostra so a luta, ela mostra o peso da luta.`, 290), captionText: baseCaption };
  }
  return { narrationText: "Se voce quiser, a proxima parte continua daqui, seguindo a HQ em ordem e sem pular o contexto.", captionText: "A PROXIMA PARTE CONTINUA DAQUI" };
}

function compactCaptionText(value: string, maxLength: number): string {
  const normalized = value.replace(/[.!?]+$/g, "").replace(/\s+/g, " ").trim();
  const words = normalized.split(/\s+/).filter(Boolean);
  const selected: string[] = [];
  for (const word of words) {
    const next = [...selected, word].join(" ");
    if (next.length > maxLength) break;
    selected.push(word);
  }
  return selected.length ? selected.join(" ") : normalized.slice(0, maxLength).trim();
}

function captionKeyword(text: string, panel: ComicStoryMinerPanelRef | null): string {
  const candidates = [
    panelAction(panel),
    quotedDialogue(panel)?.replace(/["“”]/g, ""),
    panelSfx(panel),
    ...text.split(/\s+/).filter((word) => word.length >= 6)
  ].filter((item): item is string => Boolean(item));
  return compactCaptionText(readableName(candidates[0], "impacto"), 24).toUpperCase();
}

function cueEmphasis(role: ComicStoryBankShortSceneRole): ComicStoryBankCaptionCue["emphasis"] {
  if (role === "hook") return "impact";
  if (role === "context") return "glow";
  if (role === "evidence") return "pop";
  if (role === "escalation") return "shake";
  if (role === "payoff") return "glow";
  return "pop";
}

function cueColor(role: ComicStoryBankShortSceneRole): ComicStoryBankCaptionCue["colorMood"] {
  if (role === "hook" || role === "escalation") return "red";
  if (role === "context" || role === "evidence") return "gold";
  if (role === "payoff") return "blue";
  return "white";
}

function splitCaptionPhrases(text: string): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  const phrases = clean.split(/(?<=[.!?])\s+|;\s+/).map((item) => item.trim()).filter(Boolean);
  if (phrases.length >= 2) return phrases.slice(0, 3);
  const words = clean.split(/\s+/).filter(Boolean);
  const chunks: string[] = [];
  for (let index = 0; index < words.length; index += 5) chunks.push(words.slice(index, index + 5).join(" "));
  return chunks.slice(0, 3);
}

function buildCaptionCues(input: { scene: Pick<ComicStoryBankShortProjectScene, "role" | "durationSeconds">; narrationText: string; captionText: string; panel: ComicStoryMinerPanelRef | null }): ComicStoryBankCaptionCue[] {
  const source = input.narrationText.length > input.captionText.length + 24 ? input.narrationText : input.captionText;
  const phrases = splitCaptionPhrases(source).map((phrase) => compactCaptionText(phrase, 42)).filter(Boolean);
  const cueCount = Math.max(1, phrases.length);
  const cueDuration = Math.max(0.9, input.scene.durationSeconds / cueCount);
  return phrases.map((phrase, index) => ({
    index: index + 1,
    text: phrase,
    keyword: captionKeyword(phrase, input.panel),
    startSeconds: Number((index * cueDuration).toFixed(2)),
    endSeconds: Number(Math.min(input.scene.durationSeconds, (index + 1) * cueDuration).toFixed(2)),
    emphasis: cueEmphasis(input.scene.role),
    colorMood: cueColor(input.scene.role)
  }));
}

function buildScenes(idea: ComicStoryBankIdea, sagaTitle: string, targetDurationSeconds: number, panelsById: Map<string, ComicStoryMinerPanelRef>): ComicStoryBankShortProjectScene[] {
  const roles: ComicStoryBankShortSceneRole[] = ["hook", "context", "evidence", "escalation", "payoff", "cta"];
  const durations = distributeDurations(roles.length, targetDurationSeconds);
  const usedPanelIds = new Set<string>();
  return roles.map((role, index) => {
    const order = index + 1;
    const visualFocus = visualFocusForRole(role, idea);
    const pages = scenePagesForIdea(idea, order, roles.length);
    const initialPanelIds = scenePanelCandidatesForBeat({ idea, order, totalScenes: roles.length, pages, visualFocus, panelsById, usedPanelIds });
    const sceneBase: ComicStoryBankShortProjectScene = {
      order,
      role,
      title: `Cena ${order}: ${role.replace(/_/g, " ")}`,
      narrationText: buildNarrationLine(role, idea, sagaTitle),
      captionText: buildCaption(role, idea),
      captionCues: [],
      pages,
      panelIds: initialPanelIds,
      visualFocus,
      durationSeconds: durations[index] ?? 5,
      editingDirection: [
        `Manter a ordem cronologica; usar somente paginas ${pages.join(", ") || "a confirmar"}.`,
        `Foco visual: ${visualFocus}.`,
        "Maximo 4s por tela; se a cena durar mais, dividir em zoom de contexto + zoom no detalhe.",
        "Preferir rasgo de pagina, zoom ancorado e punch de legenda em vez de balanco aleatorio."
      ].join(" "),
      transition: transitionForRole(role),
      qualityNotes: [
        ...(pages.length === 0 ? ["scene_needs_page_selection"] : []),
        "requires_reader_safe_crop_before_render"
      ]
    };
    const panelSelection: ComicStoryBankPanelSelection = selectPanelForScene({ idea, scene: sceneBase, panelsById, usedPanelIds });
    const selectedPanelIds = panelSelection.selectedPanelId
      ? unique([panelSelection.selectedPanelId, ...initialPanelIds]).slice(0, 2)
      : initialPanelIds;
    const selectedPanel = panelSelection.selectedPanelId ? panelsById.get(panelSelection.selectedPanelId) ?? null : null;
    const doctored = doctorSceneNarration({ scene: sceneBase, idea, selectedPanel, sagaTitle });
    const captionCues = buildCaptionCues({ scene: sceneBase, narrationText: doctored.narrationText, captionText: doctored.captionText, panel: selectedPanel });
    return {
      ...sceneBase,
      narrationText: doctored.narrationText,
      captionText: doctored.captionText,
      captionCues,
      panelIds: selectedPanelIds,
      panelSelection,
      qualityNotes: [
        ...sceneBase.qualityNotes,
        ...(panelSelection.selectedPanelId ? [] : ["scene_needs_panel_selection"]),
        ...(panelSelection.mode === "fallback_ranked" ? ["panel_selected_outside_page_range_needs_review"] : [])
      ]
    };
  });
}

function selectedPanelStats(scenes: ComicStoryBankShortProjectScene[]): {
  uniquePanelCount: number;
  reusedPanelIds: string[];
  fallbackSceneOrders: number[];
} {
  const selectedIds = scenes
    .map((scene) => scene.panelSelection?.selectedPanelId ?? null)
    .filter((panelId): panelId is string => Boolean(panelId));
  return {
    uniquePanelCount: unique(selectedIds).length,
    reusedPanelIds: unique(selectedIds.filter((panelId, index) => selectedIds.indexOf(panelId) !== index)),
    fallbackSceneOrders: scenes.filter((scene) => scene.panelSelection?.mode === "fallback_ranked").map((scene) => scene.order)
  };
}

function cloneSceneWithPanelSelection(input: { scene: ComicStoryBankShortProjectScene; panelSelection: ComicStoryBankPanelSelection; idea: ComicStoryBankIdea; sagaTitle: string; panelsById: Map<string, ComicStoryMinerPanelRef> }): ComicStoryBankShortProjectScene {
  const { scene, panelSelection, idea, sagaTitle, panelsById } = input;
  const selectedPanelIds = panelSelection.selectedPanelId
    ? unique([panelSelection.selectedPanelId, ...scene.panelIds.filter((panelId) => panelId !== scene.panelSelection?.selectedPanelId)]).slice(0, 2)
    : scene.panelIds;
  const selectedPanel = panelSelection.selectedPanelId ? panelsById.get(panelSelection.selectedPanelId) ?? null : null;
  const doctored = doctorSceneNarration({ scene, idea, selectedPanel, sagaTitle });
  const captionCues = buildCaptionCues({ scene, narrationText: doctored.narrationText, captionText: doctored.captionText, panel: selectedPanel });
  return {
    ...scene,
    panelIds: selectedPanelIds,
    panelSelection,
    narrationText: doctored.narrationText,
    captionText: doctored.captionText,
    captionCues,
    qualityNotes: unique([
      ...scene.qualityNotes.filter((note) => note !== "scene_needs_panel_selection" && note !== "panel_selected_outside_page_range_needs_review"),
      ...(panelSelection.selectedPanelId ? [] : ["scene_needs_panel_selection"]),
      ...(panelSelection.mode === "fallback_ranked" ? ["panel_selected_outside_page_range_needs_review"] : [])
    ])
  };
}

function optimizeStoryboardPanels(input: {
  idea: ComicStoryBankIdea;
  scenes: ComicStoryBankShortProjectScene[];
  panelsById: Map<string, ComicStoryMinerPanelRef>;
  sagaTitle: string;
}): { scenes: ComicStoryBankShortProjectScene[]; report: ComicStoryBankStoryboardOptimizationReport } {
  const before = selectedPanelStats(input.scenes);
  const scenes = input.scenes.map((scene) => ({ ...scene, panelIds: [...scene.panelIds], qualityNotes: [...scene.qualityNotes] }));
  const changes: ComicStoryBankStoryboardOptimizationReport["changes"] = [];
  const warnings: string[] = [];
  const allPanelsRaw = [...input.panelsById.values()];
  const sameIssuePanels = input.idea.issueNumber === null ? allPanelsRaw : allPanelsRaw.filter((panel) => panelIssueNumber(panel) === input.idea.issueNumber);
  const allPanels = sameIssuePanels.length > 0 ? sameIssuePanels : allPanelsRaw;
  const usedPanelIds = new Set(scenes.map((scene) => scene.panelSelection?.selectedPanelId).filter((panelId): panelId is string => Boolean(panelId)));
  const reused = new Set(before.reusedPanelIds);
  const shouldOptimize = (scene: ComicStoryBankShortProjectScene) => {
    const selection = scene.panelSelection;
    if (!selection?.selectedPanelId) return true;
    if (reused.has(selection.selectedPanelId)) return true;
    if (selection.score < 90) return true;
    return false;
  };

  for (const scene of scenes) {
    if (!shouldOptimize(scene)) continue;
    const currentId = scene.panelSelection?.selectedPanelId ?? null;
    const currentIsReused = currentId ? reused.has(currentId) : false;
    if (currentId) usedPanelIds.delete(currentId);
    const minimumScore = currentIsReused || scene.panelSelection?.mode === "fallback_ranked" ? 50 : 70;
    const candidates = allPanels
      .filter((panel) => {
        if (currentIsReused && panel.panelId === currentId) return false;
        return !usedPanelIds.has(panel.panelId) || panel.panelId === currentId;
      })
      .map((panel) => ({ panel, ...scorePanelForScene({ panel, idea: input.idea, scene, usedPanelIds }) }))
      .filter((candidate) => candidate.score >= minimumScore)
      .sort((left, right) => {
        const leftPageMatch = scene.pages.includes(left.panel.pageNumber) ? 1 : 0;
        const rightPageMatch = scene.pages.includes(right.panel.pageNumber) ? 1 : 0;
        return rightPageMatch - leftPageMatch || right.score - left.score || left.panel.pageNumber - right.panel.pageNumber || left.panel.panelNumber - right.panel.panelNumber;
      });
    const best = candidates[0];
    if (!best) {
      if (currentId) usedPanelIds.add(currentId);
      warnings.push(`scene_${scene.order}:no_optimizer_candidate`);
      continue;
    }
    const mode = input.idea.panelIds.includes(best.panel.panelId)
      ? "idea_panel"
      : scene.pages.includes(best.panel.pageNumber)
        ? "page_match"
        : scene.panelIds.includes(best.panel.panelId) || best.score >= 90
          ? "storybeat_match"
          : "fallback_ranked";
    const improved = !currentId || best.panel.panelId !== currentId;
    if (!improved) {
      usedPanelIds.add(best.panel.panelId);
      continue;
    }
    const nextSelection: ComicStoryBankPanelSelection = {
      mode,
      selectedPanelId: best.panel.panelId,
      selectedPanelImagePath: best.panel.panelImagePath,
      score: best.score,
      reasons: unique([...best.reasons, "storyboard_optimizer_selected"])
    };
    const sceneIndex = scenes.findIndex((item) => item.order === scene.order);
    scenes[sceneIndex] = cloneSceneWithPanelSelection({ scene, panelSelection: nextSelection, idea: input.idea, sagaTitle: input.sagaTitle, panelsById: input.panelsById });
    usedPanelIds.add(best.panel.panelId);
    changes.push({
      sceneOrder: scene.order,
      fromPanelId: currentId,
      toPanelId: best.panel.panelId,
      fromMode: scene.panelSelection?.mode ?? "missing",
      toMode: mode,
      reason: `optimized_panel_score:${best.score}`
    });
  }

  const after = selectedPanelStats(scenes);
  return {
    scenes,
    report: {
      optimizerId: "comic_story_bank_panel_storyboard_optimizer_v1",
      attempted: before.reusedPanelIds.length > 0 || before.fallbackSceneOrders.length > 0 || before.uniquePanelCount < Math.min(5, input.scenes.length),
      optimizedSceneCount: changes.length,
      before,
      after,
      changes,
      warnings
    }
  };
}

function evaluateVisualContinuityGate(input: {
  idea: ComicStoryBankIdea;
  scenes: ComicStoryBankShortProjectScene[];
}): ComicStoryBankVisualContinuityGate {
  const selectedIds = input.scenes
    .map((scene) => scene.panelSelection?.selectedPanelId ?? null)
    .filter((panelId): panelId is string => Boolean(panelId));
  const uniquePanelIds = unique(selectedIds);
  const reusedPanelIds = unique(selectedIds.filter((panelId, index) => selectedIds.indexOf(panelId) !== index));
  const fallbackSceneOrders = input.scenes
    .filter((scene) => scene.panelSelection?.mode === "fallback_ranked")
    .map((scene) => scene.order);
  const manualReviewSceneOrders = input.scenes
    .filter((scene) => !scene.panelSelection?.selectedPanelId || scene.panelSelection.mode === "manual_review")
    .map((scene) => scene.order);
  const firstPages = input.scenes.map((scene) => scene.pages[0] ?? null).filter((page): page is number => page !== null);
  const chronologicalPageFlow = firstPages.every((page, index) => index === 0 || page >= firstPages[index - 1]!);
  const issueLocked = input.idea.issueNumber === null || input.scenes.every((scene) => scene.panelSelection?.reasons.some((reason) => reason === `issue_match:${input.idea.issueNumber}`));
  const sceneReports: ComicStoryBankVisualContinuityGate["sceneReports"] = input.scenes.map((scene) => {
    const panelSelection = scene.panelSelection;
    const warnings = [
      ...(!panelSelection?.selectedPanelId ? ["missing_selected_panel"] : []),
      ...(panelSelection?.mode === "fallback_ranked" ? ["fallback_panel_needs_visual_review"] : []),
      ...(panelSelection?.selectedPanelId && reusedPanelIds.includes(panelSelection.selectedPanelId) ? ["panel_reuse_detected"] : []),
      ...(panelSelection && panelSelection.score < 75 ? ["low_panel_selection_score"] : [])
    ];
    const status: ComicStoryBankVisualContinuityGate["sceneReports"][number]["status"] = !panelSelection?.selectedPanelId ? "blocked" : warnings.length > 0 ? "needs_review" : "ready";
    return {
      sceneOrder: scene.order,
      panelId: panelSelection?.selectedPanelId ?? null,
      pageNumber: scene.pages[0] ?? null,
      mode: panelSelection?.mode ?? "missing",
      score: panelSelection?.score ?? 0,
      status,
      reasons: panelSelection?.reasons ?? [],
      warnings
    };
  });
  const blockers = [
    ...(manualReviewSceneOrders.length > 0 ? [`manual_panel_review_required:${manualReviewSceneOrders.join(",")}`] : []),
    ...(uniquePanelIds.length < Math.min(4, input.scenes.length) ? [`low_unique_panel_count:${uniquePanelIds.length}`] : []),
    ...(!chronologicalPageFlow ? ["scene_pages_not_chronological"] : []),
    ...(!issueLocked ? ["panel_selection_crosses_issue_boundary"] : [])
  ];
  const warnings = [
    ...(reusedPanelIds.length > 0 ? [`reused_panels:${reusedPanelIds.join(",")}`] : []),
    ...(fallbackSceneOrders.length > Math.ceil(input.scenes.length / 2) ? [`too_many_fallback_panels:${fallbackSceneOrders.length}`] : []),
    ...sceneReports.flatMap((report) => report.warnings.map((warning) => `scene_${report.sceneOrder}:${warning}`))
  ];
  const score = Math.max(0, Math.min(100, Math.round(
    100
    - blockers.length * 28
    - reusedPanelIds.length * 12
    - fallbackSceneOrders.length * 5
    - manualReviewSceneOrders.length * 18
    - (!chronologicalPageFlow ? 22 : 0)
    - (!issueLocked ? 24 : 0)
  )));
  const status = blockers.length > 0 ? "blocked" : warnings.length > 0 ? "needs_review" : "passed";
  return {
    gateId: "comic_story_bank_visual_continuity_gate_v1",
    status,
    score,
    uniquePanelCount: uniquePanelIds.length,
    reusedPanelIds,
    fallbackSceneOrders,
    manualReviewSceneOrders,
    chronologicalPageFlow,
    issueLocked,
    blockers,
    warnings,
    sceneReports
  };
}

function buildPanelManifest(scenes: ComicStoryBankShortProjectScene[]): ComicStoryBankShortProjectPlan["panelAssetManifest"] {
  const entries: ComicStoryBankShortProjectPlan["panelAssetManifest"] = [];
  for (const scene of scenes) {
    const pageFallback = scene.pages[0] ?? null;
    if (scene.panelIds.length === 0) {
      entries.push({ sceneOrder: scene.order, pageNumber: pageFallback, panelId: null, intent: scene.visualFocus, importRequired: true });
      continue;
    }
    for (const panelId of scene.panelIds) {
      entries.push({
        sceneOrder: scene.order,
        pageNumber: pageFallback,
        panelId,
        intent: scene.visualFocus,
        importRequired: true
      });
    }
  }
  return entries;
}

export function buildComicStoryBankShortProject(input: BuildComicStoryBankShortProjectInput): ComicStoryBankShortProjectPlan {
  const idea = chooseIdea(input);
  const targetDurationSeconds = Math.max(30, input.targetDurationSeconds ?? idea.estimatedDurationSeconds ?? 36);
  const panelsById = normalizePanelsById(input.panelsById);
  const initialScenes = buildScenes(idea, input.storyBank.sagaTitle, targetDurationSeconds, panelsById);
  const optimized = optimizeStoryboardPanels({ idea, scenes: initialScenes, panelsById, sagaTitle: input.storyBank.sagaTitle });
  const scenes = optimized.scenes;
  const storyboardOptimization = optimized.report;
  const visualContinuityGate = evaluateVisualContinuityGate({ idea, scenes });
  const estimatedDurationSeconds = scenes.reduce((sum, scene) => sum + scene.durationSeconds, 0);
  const narrationWarnings = [
    ...(idea.readiness === "weak" ? ["idea_is_weak_for_short"] : []),
    ...(idea.readiness === "needs_context" ? ["idea_needs_more_context_before_render"] : []),
    ...(idea.pages.length === 0 ? ["idea_has_no_page_sequence"] : []),
    ...(scenes.some((scene) => !scene.panelSelection?.selectedPanelId) ? ["idea_needs_panel_selection"] : [])
  ];
  const blockers = [
    ...(estimatedDurationSeconds < 30 ? ["short_under_30_seconds"] : []),
    ...(scenes.length < 5 ? ["not_enough_scenes"] : []),
    ...(idea.pages.length === 0 ? ["missing_story_pages"] : []),
    ...(idea.readiness === "weak" ? ["weak_story_bank_idea"] : []),
    ...visualContinuityGate.blockers
  ];
  const hasChronologicalPages = idea.pages.length === 0 || unique(idea.pages).every((page, index, pages) => index === 0 || page >= pages[index - 1]!);
  const fullNarration = scenes.map((scene) => scene.narrationText).join(" ");
  const script = [
    `SHORT PLAN: ${idea.title}`,
    `Fonte: ${input.storyBank.sagaTitle}`,
    `Categoria: ${categoryLabel(idea.category)}`,
    `Paginas: ${idea.pages.join(", ") || "a confirmar"}`,
    "",
    ...scenes.map((scene) => `${scene.order}. ${scene.narrationText}`),
    "",
    "Aprovacao manual obrigatoria: revisar direitos, paineis, contexto e crop antes de renderizar."
  ].join("\n");
  return {
    builderId: "comic_story_bank_project_builder_v1",
    generatedAt: new Date().toISOString(),
    sagaTitle: input.storyBank.sagaTitle,
    channelId: input.channelId ?? null,
    idea,
    title: shortText(`${idea.title} | Short ${categoryLabel(idea.category)}`, 100),
    format: "vertical_9_16",
    targetDurationSeconds,
    estimatedDurationSeconds,
    script,
    scenes,
    narrationPlan: {
      tone: toneForCategory(idea.category),
      fullNarration,
      voicePackSuggestion: voiceForCategory(idea.category),
      warnings: narrationWarnings
    },
    editPlan: {
      pacing: estimatedDurationSeconds >= 45 ? "dynamic_45s" : "dynamic_30s",
      maxHoldSeconds: 4,
      captionStyle: captionStyleForCategory(idea.category),
      transitions: unique(scenes.map((scene) => scene.transition)),
      sfx: idea.category === "battle" || idea.category === "visual_spectacle"
        ? ["page_tear", "impact_hit", "riser", "bass_drop"]
        : ["page_tear", "whoosh", "subtle_hit"],
      visualRule: "Sempre seguir as paginas para frente; escolher painel completo primeiro, depois zoom em balao/acao/reacao citada pela narracao."
    },
    panelAssetManifest: buildPanelManifest(scenes),
    storyboardOptimization,
    visualContinuityGate,
    qualityGates: {
      hasMinimumDuration: estimatedDurationSeconds >= 30,
      hasStoryArc: scenes.some((scene) => scene.role === "hook") && scenes.some((scene) => scene.role === "payoff"),
      hasChronologicalPages,
      hasVisualEvidence: scenes.some((scene) => Boolean(scene.panelSelection?.selectedPanelId)) || idea.pages.length > 0 || idea.panelIds.length > 0,
      hasPanelContinuity: visualContinuityGate.status !== "blocked",
      canCreateProject: blockers.length === 0 && visualContinuityGate.status !== "blocked",
      blockers,
      warnings: unique([...idea.warnings, ...narrationWarnings, ...visualContinuityGate.warnings, ...(!hasChronologicalPages ? ["pages_not_chronological"] : [])])
    },
    candidateFirst: true,
    requiresManualApproval: true
  };
}
































