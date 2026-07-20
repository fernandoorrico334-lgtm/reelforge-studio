import type {
  ComicIssueStoryDigest,
  ComicPageStorySummary,
  ComicShortOpportunity,
  ComicStoryMinerPanelRef,
  ComicStoryMinerReport
} from "./comic-story-miner.js";
import type { ComicStoryArcV2 } from "./comic-story-arc-miner-v2.js";

export type ComicIssueNarrativeSectionRole =
  | "opening"
  | "inciting_incident"
  | "conflict_escalation"
  | "midpoint"
  | "climax"
  | "resolution"
  | "bonus_curiosity";

export type ComicIssueNarrativeSection = {
  role: ComicIssueNarrativeSectionRole;
  title: string;
  pageRange: { start: number; end: number };
  pages: number[];
  summary: string;
  conflictSignal: string;
  dominantCharacters: string[];
  dominantThemes: string[];
  strongestPanels: string[];
  dialogueSamples: string[];
  visualEvidence: {
    actionPageCount: number;
    dialoguePageCount: number;
    revealPageCount: number;
    soundEffectCount: number;
  };
  shortPotentialScore: number;
  warnings: string[];
};

export type ComicIssueCuriosity = {
  id: string;
  title: string;
  pages: number[];
  panelIds: string[];
  evidence: string[];
  whyItWorksAsShort: string;
  estimatedDurationSeconds: number;
  score: number;
  riskNotes: string[];
};

export type ComicIssueStoryCandidate = {
  id: string;
  title: string;
  source: "story_arc_v2" | "opportunity_cluster" | "page_section" | "issue_story_series";
  pages: number[];
  panelIds: string[];
  characters: string[];
  themes: string[];
  hook: string;
  conflict: string;
  middle: string;
  payoff: string;
  estimatedDurationSeconds: number;
  score: number;
  readiness:
    | "ready_for_short"
    | "needs_manual_panel_review"
    | "needs_more_context"
    | "weak_story";
  reasons: string[];
  warnings: string[];
};

export type ComicIssueNarrativeMap = {
  mapId: "comic_issue_narrative_map_v1";
  generatedAt: string;
  source: ComicStoryMinerReport["source"];
  issueOverview: {
    title: string;
    pageCount: number;
    narrativePageCount: number;
    panelCount: number;
    estimatedShortsAvailable: number;
    mainCharacters: string[];
    mainThemes: string[];
    centralConflict: string;
    beginning: string;
    middle: string;
    ending: string;
  };
  sections: ComicIssueNarrativeSection[];
  storyCandidates: ComicIssueStoryCandidate[];
  curiosities: ComicIssueCuriosity[];
  recommendedShorts: ComicIssueStoryCandidate[];
  productionStrategy: {
    firstShortId: string | null;
    productionOrder: string[];
    minimumDurationSeconds: 40;
    recommendedMinimumPageSpan: number;
    recommendedBatchSize: number;
    notes: string[];
  };
  coverage: {
    pagesCovered: number[];
    missingNarrativePages: number[];
    pagesWithNoStrongShort: number[];
    panelIdsCovered: string[];
  };
  qualityGates: {
    hasBeginningMiddleEnd: boolean;
    hasClearConflict: boolean;
    hasCuriosities: boolean;
    hasAtLeastOneReadyShort: boolean;
    canAttemptAutomatedShort: boolean;
    blockers: string[];
  };
  warnings: string[];
  candidateFirst: true;
  requiresManualApproval: true;
};

const MIN_MAIN_SHORT_PAGE_SPAN = 15;

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function display(value: string): string {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .replace("Godzilla", "Godzilla")
    .replace("Kong", "Kong")
    .replace("Superman", "Superman")
    .replace("Batman", "Batman");
}

function mostFrequent(values: string[], limit: number): string[] {
  const counts = new Map<string, number>();
  for (const value of values.filter(Boolean)) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, limit)
    .map(([value]) => value);
}

type RuntimePanelEvidence = ComicStoryMinerPanelRef & {
  localEvidence?: {
    dialogue?: string[];
    narrationBoxes?: string[];
    detectedText?: string[];
    soundEffects?: string[];
    actions?: string[];
  };
};

function cleanOcrEvidence(value: string | null | undefined): string | null {
  if (!value) return null;
  const cleaned = value.replace(/[^\p{L}\p{N}?!.,:;"' \-]/gu, " ").replace(/\s+/g, " ").trim();
  if (cleaned.length < 8 || cleaned.length > 120) return null;
  const words = cleaned.split(/\s+/).filter(Boolean);
  const letters = (cleaned.match(/\p{L}/gu) ?? []).length;
  const noisy = (cleaned.match(/[0-9#|/\\_=+<>~]/g) ?? []).length;
  const shortWords = words.filter((word) => word.replace(/[^\p{L}]/gu, "").length <= 2).length;
  if (words.length < 3 || shortWords >= 2) return null;
  if (letters / Math.max(1, cleaned.length) < 0.55 || noisy > 2) return null;
  return cleaned;
}
const COMIC_CREDIT_TEXT_PATTERN = /\b(writer|artist|colorist|letterer|editor|variant\s+cover|cover\s+artist|designer|translation|traducao|roteiro|arte|cores|letras|editor|dc\s+comics|tm\s*&|copyright|all\s+rights|publicado|publicada)\b/i;
const COMIC_TITLE_PAGE_TEXT_PATTERN = /\b(liga\s+da\s+justi[cç]a|justice\s+league|godzilla|kong|versus|vs\.?|#\s*0?1)\b/i;

function pageTextCorpus(page: ComicPageStorySummary): string {
  return page.usableTextSamples.join(" ").replace(/\s+/g, " ").trim();
}

function isLikelyComicCreditPage(page: ComicPageStorySummary): boolean {
  const corpus = pageTextCorpus(page);
  const creditHits = (corpus.match(COMIC_CREDIT_TEXT_PATTERN) ?? []).length;
  return creditHits >= 1 || /\bBrian\s+Buccellato\b|\bChristian\s+Duce\b|\bLuis\s+Guerrero\b|\bRichard\s+Starkings\b/i.test(corpus);
}

function isLikelyComicCoverPage(page: ComicPageStorySummary): boolean {
  if (page.pageNumber > 1) return false;
  const corpus = pageTextCorpus(page);
  const titleSignals = COMIC_TITLE_PAGE_TEXT_PATTERN.test(corpus);
  const weakStory = page.validPanelCount <= 3 && page.shortPotentialScore < 55 && page.soundEffectCount === 0;
  return titleSignals || weakStory;
}

function isNarrativePageForMainShort(page: ComicPageStorySummary): boolean {
  if (page.editorialRole === "non_narrative") return false;
  if (page.validPanelCount <= 0 || page.panelCount <= 0) return false;
  if (["cover", "credits", "advertisement", "catalog", "backmatter", "blank"].includes(page.pageType)) return false;
  if (isLikelyComicCoverPage(page)) return false;
  if (isLikelyComicCreditPage(page)) return false;
  return true;
}

function panelTextEvidence(panel: ComicStoryMinerPanelRef): string[] {
  const runtime = panel as RuntimePanelEvidence;
  return [
    ...panel.localDialogue,
    ...panel.localNarrationBoxes,
    ...panel.soundEffects,
    ...(runtime.localEvidence?.dialogue ?? []),
    ...(runtime.localEvidence?.narrationBoxes ?? []),
    ...(runtime.localEvidence?.detectedText ?? []),
    ...(runtime.localEvidence?.soundEffects ?? []),
    ...panel.visualCropEvidence.textSamples
  ].map(cleanOcrEvidence).filter((line): line is string => Boolean(line));
}

function panelHasActionEvidence(panel: ComicStoryMinerPanelRef): boolean {
  const runtime = panel as RuntimePanelEvidence;
  const action = panel.visualCropEvidence.strongestActionLabel ?? runtime.localEvidence?.actions?.[0] ?? panel.visualCropEvidence.storyFunction;
  return /action|climax|fight|battle|impact|blast|run|hit|attack|monster|kaiju|confronto|luta/i.test(action ?? "")
    || panel.visualCropEvidence.evidenceCounts.actions > 0
    || panel.soundEffects.length > 0
    || (runtime.localEvidence?.soundEffects?.length ?? 0) > 0;
}

function enrichCandidateWithEditorialEvidence(report: ComicStoryMinerReport, candidate: ComicIssueStoryCandidate): ComicIssueStoryCandidate {
  const panelMap = new Map<string, ComicStoryMinerPanelRef>();
  for (const opportunity of report.opportunities) {
    for (const panel of opportunity.panels) panelMap.set(panel.panelId, panel);
  }
  const panels = candidate.panelIds.map((panelId) => panelMap.get(panelId)).filter((panel): panel is ComicStoryMinerPanelRef => Boolean(panel));
  const cleanTextLines = unique(panels.flatMap(panelTextEvidence));
  const actionPanels = panels.filter(panelHasActionEvidence);
  const chronologicalPages = unique(candidate.pages).sort((left, right) => left - right);
  const hasForwardStory = chronologicalPages.length >= 2 || panels.length >= 8;
  const hasBeginning = cleanTextLines.length > 0 || candidate.hook.trim().length > 20;
  const hasConflict = actionPanels.length > 0 || /contra|conflito|ameaca|luta|batalha|impacto|godzilla|kong|superman/i.test(candidate.conflict + " " + candidate.hook);
  const hasPayoff = /pergunta|gancho|payoff|fim|continua|segura|vence|aguenta|muda/i.test(candidate.payoff + " " + candidate.middle) || actionPanels.length >= 2;
  const warnings = [...candidate.warnings];
  if (cleanTextLines.length === 0) warnings.push("candidate_lacks_clean_dialogue_or_narration_evidence");
  if (actionPanels.length === 0) warnings.push("candidate_lacks_action_or_conflict_panel_evidence");
  if (!hasForwardStory) warnings.push("candidate_lacks_forward_story_span_for_30s");
  if (!hasPayoff) warnings.push("candidate_lacks_payoff_or_reaction_signal");
  const evidenceBonus = Math.min(16, cleanTextLines.length * 3)
    + Math.min(14, actionPanels.length * 3)
    + (hasForwardStory ? 8 : -10)
    + (hasBeginning ? 5 : -8)
    + (hasConflict ? 8 : -10)
    + (hasPayoff ? 6 : -8);
  const score = clampScore(candidate.score + evidenceBonus - warnings.filter((warning) => warning.startsWith("candidate_lacks")).length * 4);
  const readiness: ComicIssueStoryCandidate["readiness"] = score >= 82 && hasForwardStory && hasBeginning && hasConflict && hasPayoff
    ? "ready_for_short"
    : score >= 70 && hasConflict
      ? "needs_manual_panel_review"
      : score >= 58
        ? "needs_more_context"
        : "weak_story";
  return {
    ...candidate,
    score,
    readiness,
    reasons: unique([
      ...candidate.reasons,
      "editorial_evidence:clean_text=" + cleanTextLines.length,
      "editorial_evidence:action_panels=" + actionPanels.length,
      "editorial_evidence:forward_story=" + hasForwardStory,
      "editorial_evidence:payoff=" + hasPayoff
    ]),
    warnings: unique(warnings)
  };
}
function issueTitle(report: ComicStoryMinerReport): string {
  return (
    report.source.issueTitles.find((title) => title.trim().length > 0) ??
    report.source.comicTitles.find((title) => title.trim().length > 0) ??
    "HQ importada"
  );
}

function splitIntoNarrativeSections(pages: ComicPageStorySummary[]): ComicPageStorySummary[][] {
  const narrative = pages
    .filter(isNarrativePageForMainShort)
    .sort((left, right) => left.pageNumber - right.pageNumber);
  if (narrative.length === 0) return [];
  const chunkCount = Math.min(6, Math.max(3, Math.ceil(narrative.length / 4)));
  const chunkSize = Math.ceil(narrative.length / chunkCount);
  const chunks: ComicPageStorySummary[][] = [];
  for (let index = 0; index < narrative.length; index += chunkSize) {
    chunks.push(narrative.slice(index, index + chunkSize));
  }
  return chunks;
}

function sectionRole(index: number, total: number, pages: ComicPageStorySummary[]): ComicIssueNarrativeSectionRole {
  const roles = pages.flatMap((page) => page.storyFunctions);
  if (index === 0) return "opening";
  if (index === 1 && total >= 4) return "inciting_incident";
  if (roles.some((role) => role === "climax")) return "climax";
  if (index >= total - 1) return "resolution";
  if (index >= Math.floor(total / 2)) return "midpoint";
  return "conflict_escalation";
}

function sectionTitle(role: ComicIssueNarrativeSectionRole, characters: string[], themes: string[]): string {
  const main = display(characters[0] ?? themes[0] ?? "a historia");
  if (role === "opening") return `Abertura: onde ${main} entra em cena`;
  if (role === "inciting_incident") return `Incidente: o problema fica grande demais`;
  if (role === "conflict_escalation") return `Escalada: a tensao aumenta`;
  if (role === "midpoint") return `Meio: a historia muda de escala`;
  if (role === "climax") return `Climax: o impacto principal`;
  if (role === "resolution") return `Fechamento: a pergunta que fica`;
  return `Curiosidade aproveitavel`;
}

function summarizeSection(role: ComicIssueNarrativeSectionRole, pages: ComicPageStorySummary[]): string {
  const ideas = pages.flatMap((page) => page.shortIdeas.map((idea) => idea.title)).slice(0, 3);
  const samples = pages.flatMap((page) => page.usableTextSamples).slice(0, 2);
  const base = ideas.length > 0 ? ideas.join("; ") : samples.join("; ");
  if (base.trim().length > 0) return base;
  if (role === "opening") return "A HQ estabelece personagens, ambiente e promessa visual.";
  if (role === "climax") return "A HQ concentra aqui o maior impacto visual ou virada.";
  if (role === "resolution") return "A HQ fecha a sequencia com reacao, pergunta ou gancho.";
  return "Trecho narrativo com potencial para explicar contexto e preparar impacto.";
}

function conflictSignal(pages: ComicPageStorySummary[]): string {
  const themes = mostFrequent(pages.flatMap((page) => page.dominantThemes), 3).map(display);
  const chars = mostFrequent(pages.flatMap((page) => page.dominantCharacters), 3).map(display);
  const action = pages.some((page) => page.editorialRole === "action" || page.editorialRole === "climax");
  if (chars.length >= 2 && action) return `${chars[0]} em rota de colisao com ${chars[1]}`;
  if (chars.length >= 2) return `tensao entre ${chars[0]} e ${chars[1]}`;
  if (themes.length > 0 && action) return `conflito visual ligado a ${themes[0]}`;
  return themes.length > 0 ? `misterio ou tema central: ${themes[0]}` : "conflito ainda precisa de leitura manual";
}

function buildSections(report: ComicStoryMinerReport): ComicIssueNarrativeSection[] {
  const chunks = splitIntoNarrativeSections(report.pageSummaries);
  return chunks.map((pages, index) => {
    const role = sectionRole(index, chunks.length, pages);
    const pageNumbers = pages.map((page) => page.pageNumber);
    const characters = mostFrequent(pages.flatMap((page) => page.dominantCharacters), 5);
    const themes = mostFrequent(pages.flatMap((page) => page.dominantThemes), 5);
    const warnings: string[] = [];
    if (pages.every((page) => page.shortPotentialScore < 50)) warnings.push("section_low_short_potential");
    if (pages.every((page) => page.dialogueLineCount === 0 && page.narrationBoxCount === 0)) {
      warnings.push("section_needs_visual_context_or_manual_reading");
    }
    return {
      role,
      title: sectionTitle(role, characters, themes),
      pageRange: { start: Math.min(...pageNumbers), end: Math.max(...pageNumbers) },
      pages: pageNumbers,
      summary: summarizeSection(role, pages),
      conflictSignal: conflictSignal(pages),
      dominantCharacters: characters,
      dominantThemes: themes,
      strongestPanels: [],
      dialogueSamples: pages.flatMap((page) => page.usableTextSamples).slice(0, 5),
      visualEvidence: {
        actionPageCount: pages.filter((page) => page.editorialRole === "action" || page.editorialRole === "climax").length,
        dialoguePageCount: pages.filter((page) => page.dialogueLineCount > 0).length,
        revealPageCount: pages.filter((page) => page.editorialRole === "reveal").length,
        soundEffectCount: pages.reduce((sum, page) => sum + page.soundEffectCount, 0)
      },
      shortPotentialScore: clampScore(pages.reduce((sum, page) => sum + page.shortPotentialScore, 0) / pages.length),
      warnings
    };
  });
}

function storyCandidateFromArc(arc: ComicStoryArcV2): ComicIssueStoryCandidate {
  const warnings = [...arc.warnings];
  if (arc.recommendedDurationSeconds < 30) warnings.push("duration_below_minimum_30s");
  return {
    id: `story-candidate:${arc.id}`,
    title: arc.title,
    source: "story_arc_v2",
    pages: arc.pages,
    panelIds: arc.panelIds,
    characters: arc.characters,
    themes: arc.themes,
    hook: arc.retentionHook,
    conflict: arc.shortAngle,
    middle: arc.viewerPromise,
    payoff: arc.payoff,
    estimatedDurationSeconds: Math.max(30, arc.recommendedDurationSeconds),
    score: arc.overallScore,
    readiness: arc.readyForShort && warnings.length === 0 ? "ready_for_short" : arc.readyForShort ? "needs_manual_panel_review" : "needs_more_context",
    reasons: arc.reasons,
    warnings
  };
}

function clusterKey(opportunity: ComicShortOpportunity): string {
  const firstPage = opportunity.pages[0] ?? 0;
  const pageBand = Math.floor(firstPage / 3);
  const mainCharacter = opportunity.characters[0] ?? "unknown";
  const theme = opportunity.themes[0] ?? opportunity.category;
  return `${mainCharacter}:${theme}:${pageBand}`;
}

function storyCandidatesFromOpportunities(opportunities: ComicShortOpportunity[]): ComicIssueStoryCandidate[] {
  const groups = new Map<string, ComicShortOpportunity[]>();
  for (const opportunity of opportunities) {
    const key = clusterKey(opportunity);
    const group = groups.get(key) ?? [];
    group.push(opportunity);
    groups.set(key, group);
  }

  return [...groups.entries()].map(([key, group], index) => {
    const sorted = [...group].sort((left, right) => right.score - left.score);
    const top = sorted[0]!;
    const pages = unique(sorted.flatMap((item) => item.pages)).sort((left, right) => left - right);
    const panelIds = unique(sorted.flatMap((item) => item.panelIds));
    const characters = unique(sorted.flatMap((item) => item.characters)).slice(0, 6);
    const themes = unique(sorted.flatMap((item) => item.themes)).slice(0, 8);
    const score = clampScore(
      sorted.reduce((sum, item) => sum + item.score, 0) / sorted.length +
      Math.min(12, panelIds.length * 1.5) +
      (pages.length >= 2 ? 6 : 0)
    );
    const warnings: string[] = [];
    if (panelIds.length < 5) warnings.push("candidate_has_few_panels");
    if (pages.length < 2) warnings.push("candidate_has_limited_page_context");
    if (top.estimatedDurationSeconds < 30) warnings.push("candidate_needs_duration_expansion_to_30s");
    return {
      id: `story-cluster:${index + 1}:${key.replace(/[^a-zA-Z0-9_-]/g, "-")}`,
      title: top.title,
      source: "opportunity_cluster",
      pages,
      panelIds,
      characters,
      themes,
      hook: top.hook,
      conflict: top.angle,
      middle: top.narrationDraft,
      payoff: `Transformar ${display(characters[0] ?? themes[0] ?? "este trecho")} em um payoff visual claro.`,
      estimatedDurationSeconds: Math.max(30, top.estimatedDurationSeconds, panelIds.length * 3),
      score,
      readiness: score >= 72 && warnings.length <= 1 ? "ready_for_short" : score >= 62 ? "needs_manual_panel_review" : "needs_more_context",
      reasons: unique(sorted.flatMap((item) => item.reasons)).slice(0, 8),
      warnings
    };
  });
}

function buildIssueStorySeriesCandidates(report: ComicStoryMinerReport): ComicIssueStoryCandidate[] {
  const narrativePages = report.pageSummaries
    .filter(isNarrativePageForMainShort)
    .sort((left, right) => left.pageNumber - right.pageNumber);
  if (narrativePages.length === 0) return [];

  const panelMap = new Map<number, ComicStoryMinerPanelRef[]>();
  for (const opportunity of report.opportunities) {
    for (const panel of opportunity.panels) {
      panelMap.set(panel.pageNumber, [...(panelMap.get(panel.pageNumber) ?? []), panel]);
    }
  }

  const chunks: ComicPageStorySummary[][] = [];
  if (narrativePages.length <= MIN_MAIN_SHORT_PAGE_SPAN + 7) {
    chunks.push(narrativePages);
  } else {
    for (let start = 0; start < narrativePages.length; start += MIN_MAIN_SHORT_PAGE_SPAN) {
      const chunk = narrativePages.slice(start, Math.min(narrativePages.length, start + MIN_MAIN_SHORT_PAGE_SPAN));
      if (chunk.length < MIN_MAIN_SHORT_PAGE_SPAN && chunks.length > 0) {
        chunks[chunks.length - 1] = [...chunks[chunks.length - 1]!, ...chunk];
      } else {
        chunks.push(chunk);
      }
    }
  }

  return chunks.map((pages, index): ComicIssueStoryCandidate => {
    const pageNumbers = pages.map((page) => page.pageNumber);
    const panels = unique(pageNumbers.flatMap((page) => panelMap.get(page) ?? []));
    const panelIds = unique(panels.map((panel) => panel.panelId));
    const characters = mostFrequent(pages.flatMap((page) => page.dominantCharacters), 8);
    const themes = mostFrequent(pages.flatMap((page) => page.dominantThemes), 10);
    const textSamples = pages.flatMap((page) => page.usableTextSamples).slice(0, 8);
    const actionPageCount = pages.filter((page) => page.editorialRole === "action" || page.editorialRole === "climax").length;
    const dialoguePageCount = pages.filter((page) => page.dialogueLineCount > 0 || page.narrationBoxCount > 0).length;
    const score = clampScore(
      70 +
      Math.min(12, pages.length) +
      Math.min(8, actionPageCount * 2) +
      Math.min(8, dialoguePageCount) +
      Math.min(8, panelIds.length / 2)
    );
    const warnings: string[] = [];
    if (pages.length < MIN_MAIN_SHORT_PAGE_SPAN) warnings.push(`series_candidate_below_minimum_page_span:${pages.length}`);
    if (panelIds.length < 10) warnings.push("series_candidate_has_few_panels_for_40s");
    if (textSamples.length < 3) warnings.push("series_candidate_needs_stronger_dialogue_evidence");
    return {
      id: `issue-story-series:${index + 1}:pages-${pageNumbers[0]}-${pageNumbers[pageNumbers.length - 1]}`,
      title: `Parte ${index + 1}: a historia da HQ em ordem`,
      source: "issue_story_series",
      pages: pageNumbers,
      panelIds,
      characters,
      themes,
      hook: `Essa parte acompanha ${display(characters[0] ?? "a Liga")} do começo da crise ate o primeiro grande impacto.`,
      conflict: conflictSignal(pages),
      middle: textSamples.length > 0 ? textSamples.join(" / ") : summarizeSection("midpoint", pages),
      payoff: `Fechar com a pergunta que puxa a proxima parte: o que muda depois das paginas ${pageNumbers[0]}-${pageNumbers[pageNumbers.length - 1]}?`,
      estimatedDurationSeconds: Math.max(40, Math.min(60, Math.round(pages.length * 2.8))),
      score,
      readiness: warnings.some((warning) => warning.startsWith("series_candidate_below")) ? "needs_more_context" : "ready_for_short",
      reasons: [
        `series_page_span:${pages.length}`,
        `series_panels:${panelIds.length}`,
        `series_action_pages:${actionPageCount}`,
        `series_dialogue_pages:${dialoguePageCount}`,
        "main_short_requires_15_plus_pages"
      ],
      warnings
    };
  });
}
function buildCuriosities(report: ComicStoryMinerReport): ComicIssueCuriosity[] {
  const fromOpportunities = report.opportunities
    .filter((item) => item.category === "curiosity" || item.category === "reveal" || item.category === "visual_moment")
    .slice(0, 16)
    .map((item, index): ComicIssueCuriosity => ({
      id: `curiosity:${index + 1}:${item.id}`,
      title: item.title,
      pages: item.pages,
      panelIds: item.panelIds,
      evidence: [
        item.hook,
        item.angle,
        ...item.panels.flatMap((panel) => [
          ...panel.localDialogue,
          ...panel.localNarrationBoxes,
          ...panel.soundEffects
        ]).slice(0, 4)
      ].filter(Boolean),
      whyItWorksAsShort: item.narrationDraft,
      estimatedDurationSeconds: Math.max(30, item.estimatedDurationSeconds),
      score: item.score,
      riskNotes: item.warnings
    }));

  const seen = new Set<string>();
  return fromOpportunities.filter((curiosity) => {
    const key = `${curiosity.title}:${curiosity.pages.join(",")}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function candidateSourcePriority(candidate: ComicIssueStoryCandidate): number {
  if (candidate.source === "issue_story_series") return 80;
  if (candidate.pages.length >= MIN_MAIN_SHORT_PAGE_SPAN) return 50;
  if (candidate.source === "story_arc_v2") return 18;
  if (candidate.source === "page_section") return 10;
  return 0;
}

function rankCandidates(candidates: ComicIssueStoryCandidate[]): ComicIssueStoryCandidate[] {
  return [...candidates].sort((left, right) => {
    const leftReady = left.readiness === "ready_for_short" ? 12 : left.readiness === "needs_manual_panel_review" ? 5 : 0;
    const rightReady = right.readiness === "ready_for_short" ? 12 : right.readiness === "needs_manual_panel_review" ? 5 : 0;
    return candidateSourcePriority(right) - candidateSourcePriority(left)
      || right.score + rightReady - (left.score + leftReady);
  });
}

function pageStart(candidate: ComicIssueStoryCandidate): number {
  return Math.min(...candidate.pages);
}

function pageEnd(candidate: ComicIssueStoryCandidate): number {
  return Math.max(...candidate.pages);
}

function pageOverlapRatio(left: ComicIssueStoryCandidate, right: ComicIssueStoryCandidate): number {
  const leftPages = new Set(left.pages);
  const rightPages = new Set(right.pages);
  const overlap = [...leftPages].filter((page) => rightPages.has(page)).length;
  return overlap / Math.max(1, Math.min(leftPages.size, rightPages.size));
}

function buildChronologicalProductionOrder(candidates: ComicIssueStoryCandidate[]): ComicIssueStoryCandidate[] {
  const eligible = candidates
    .filter((candidate) => candidate.readiness === "ready_for_short" || candidate.readiness === "needs_manual_panel_review")
    .sort((left, right) =>
      candidateSourcePriority(right) - candidateSourcePriority(left) ||
      pageStart(left) - pageStart(right) ||
      pageEnd(right) - pageEnd(left) ||
      right.score - left.score
    );
  const selected: ComicIssueStoryCandidate[] = [];
  for (const candidate of eligible) {
    const overlapsPrevious = selected.some((item) => pageOverlapRatio(item, candidate) >= 0.67);
    if (overlapsPrevious) continue;
    selected.push(candidate);
  }
  return selected.length > 0 ? selected : eligible;
}
function buildOverview(input: {
  report: ComicStoryMinerReport;
  sections: ComicIssueNarrativeSection[];
  candidates: ComicIssueStoryCandidate[];
}): ComicIssueNarrativeMap["issueOverview"] {
  const title = issueTitle(input.report);
  const mainCharacters = input.report.characterMap.slice(0, 8).map((entry) => entry.name);
  const mainThemes = input.report.themeMap.slice(0, 8).map((entry) => entry.theme);
  const opening = input.sections.find((section) => section.role === "opening");
  const middle = input.sections.find((section) => section.role === "midpoint") ?? input.sections[Math.floor(input.sections.length / 2)];
  const ending = [...input.sections].reverse().find((section) => section.role === "resolution" || section.role === "climax");
  const bestCandidate = input.candidates[0];
  return {
    title,
    pageCount: input.report.source.pageCount,
    narrativePageCount: input.report.issueStoryDigest.narrativePageCount,
    panelCount: input.report.source.panelCount,
    estimatedShortsAvailable: input.report.issueStoryDigest.estimatedShortsAvailable,
    mainCharacters,
    mainThemes,
    centralConflict: bestCandidate?.conflict ?? conflictSignal(input.report.pageSummaries),
    beginning: opening?.summary ?? "Comeco ainda precisa de leitura manual mais profunda.",
    middle: middle?.summary ?? "Meio ainda precisa de leitura manual mais profunda.",
    ending: ending?.summary ?? "Final ainda precisa de leitura manual mais profunda."
  };
}

function buildCoverage(report: ComicStoryMinerReport, candidates: ComicIssueStoryCandidate[]): ComicIssueNarrativeMap["coverage"] {
  const narrativePages = report.pageSummaries
    .filter(isNarrativePageForMainShort)
    .map((page) => page.pageNumber);
  const pagesCovered = unique(candidates.flatMap((candidate) => candidate.pages)).sort((left, right) => left - right);
  const coveredSet = new Set(pagesCovered);
  return {
    pagesCovered,
    missingNarrativePages: narrativePages.filter((page) => !coveredSet.has(page)),
    pagesWithNoStrongShort: report.pageSummaries
      .filter((page) => page.editorialRole !== "non_narrative" && page.shortPotentialScore < 48)
      .map((page) => page.pageNumber),
    panelIdsCovered: unique(candidates.flatMap((candidate) => candidate.panelIds))
  };
}

function buildQualityGates(input: {
  sections: ComicIssueNarrativeSection[];
  candidates: ComicIssueStoryCandidate[];
  curiosities: ComicIssueCuriosity[];
  digest: ComicIssueStoryDigest;
}): ComicIssueNarrativeMap["qualityGates"] {
  const roles = new Set(input.sections.map((section) => section.role));
  const hasBeginningMiddleEnd = roles.has("opening") && input.sections.length >= 3 && (roles.has("resolution") || roles.has("climax"));
  const hasClearConflict = input.candidates.some((candidate) => candidate.conflict.trim().length > 0 && candidate.score >= 60);
  const hasCuriosities = input.curiosities.length > 0;
  const hasAtLeastOneReadyShort = input.candidates.some((candidate) => candidate.readiness === "ready_for_short" || candidate.readiness === "needs_manual_panel_review");
  const blockers: string[] = [];
  if (!hasBeginningMiddleEnd) blockers.push("issue_map_missing_beginning_middle_end");
  if (!hasClearConflict) blockers.push("issue_map_missing_clear_conflict");
  if (!hasAtLeastOneReadyShort) blockers.push("issue_map_has_no_short_candidate");
  if (input.digest.narrativePageCount === 0) blockers.push("issue_map_has_no_narrative_pages");
  return {
    hasBeginningMiddleEnd,
    hasClearConflict,
    hasCuriosities,
    hasAtLeastOneReadyShort,
    canAttemptAutomatedShort: blockers.length === 0,
    blockers
  };
}

export function buildComicIssueNarrativeMap(report: ComicStoryMinerReport): ComicIssueNarrativeMap {
  const sections = buildSections(report);
  const seriesCandidates = buildIssueStorySeriesCandidates(report);
  const arcCandidates = report.storyArcMinerV2.recommendedShorts.map(storyCandidateFromArc);
  const opportunityCandidates = storyCandidatesFromOpportunities(report.opportunities);
  const storyCandidates = rankCandidates([...seriesCandidates, ...arcCandidates, ...opportunityCandidates].map((candidate) => enrichCandidateWithEditorialEvidence(report, candidate))).slice(0, 24);
  const curiosities = buildCuriosities(report);
  const chronologicalProductionOrder = buildChronologicalProductionOrder(storyCandidates);
  const recommendedShorts = chronologicalProductionOrder.slice(0, 12);
  const coverage = buildCoverage(report, storyCandidates);
  const qualityGates = buildQualityGates({
    sections,
    candidates: storyCandidates,
    curiosities,
    digest: report.issueStoryDigest
  });
  const warnings = unique([
    ...report.warnings,
    ...sections.flatMap((section) => section.warnings.map((warning) => `section:${section.role}:${warning}`)),
    ...qualityGates.blockers
  ]);

  return {
    mapId: "comic_issue_narrative_map_v1",
    generatedAt: new Date().toISOString(),
    source: report.source,
    issueOverview: buildOverview({ report, sections, candidates: storyCandidates }),
    sections,
    storyCandidates,
    curiosities,
    recommendedShorts,
    productionStrategy: {
      firstShortId: recommendedShorts[0]?.id ?? null,
      productionOrder: chronologicalProductionOrder.map((candidate) => candidate.id),
      minimumDurationSeconds: 40,
      recommendedMinimumPageSpan: MIN_MAIN_SHORT_PAGE_SPAN,
      recommendedBatchSize: Math.min(20, Math.max(1, recommendedShorts.length)),
      notes: [
        "Candidate-first: a HQ e mapeada, mas cada short ainda exige aprovacao manual antes do render final.",
        "Usar reader-safe panel assets para preservar balao, acao e contexto em 9:16.",
        "Priorizar candidatos com conflito claro, arco visual continuo e payoff forte.",
        "ProductionOrder segue cronologia de paginas e evita shorts sobrepostos para contar a HQ em serie.",
        "Short principal de HQ deve cobrir pelo menos 15 paginas quando houver material suficiente; microtrechos ficam como apoio/curiosidade."
      ]
    },
    coverage,
    qualityGates,
    warnings,
    candidateFirst: true,
    requiresManualApproval: true
  };
}

