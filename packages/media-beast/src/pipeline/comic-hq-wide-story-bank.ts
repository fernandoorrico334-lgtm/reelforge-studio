import type { ComicSagaNarrativeMap, ComicSagaShortCandidate, ComicSagaStoryline, ComicSagaTimelineEntry } from "./comic-saga-narrative-map.js";

export type ComicStoryBankCategory =
  | "battle"
  | "curiosity"
  | "lore"
  | "relationship"
  | "absurdity"
  | "cliffhanger"
  | "visual_spectacle"
  | "story_explainer";

export type ComicStoryBankIdea = {
  id: string;
  category: ComicStoryBankCategory;
  title: string;
  sourceType: "recommended_short" | "issue_curiosity" | "timeline_section" | "storyline";
  sourceId: string;
  issueId: string | null;
  issueNumber: number | null;
  issueTitle: string | null;
  pages: number[];
  panelIds: string[];
  characters: string[];
  themes: string[];
  hook: string;
  conflict: string;
  payoff: string;
  whyItCouldWork: string;
  estimatedDurationSeconds: number;
  score: number;
  readiness: "ready_for_short" | "needs_panel_review" | "needs_context" | "weak";
  chronology: {
    issueNumber: number | null;
    pageStart: number | null;
    pageEnd: number | null;
  };
  riskNotes: string[];
  warnings: string[];
};

export type ComicStoryBankBucket = {
  category: ComicStoryBankCategory;
  ideaCount: number;
  readyCount: number;
  strongestIdeaId: string | null;
  ideas: ComicStoryBankIdea[];
  warnings: string[];
};

export type ComicHQWideStoryBankReport = {
  bankId: "comic_hq_wide_story_bank_v1";
  generatedAt: string;
  sagaTitle: string;
  issueCount: number;
  totalIdeaCount: number;
  readyIdeaCount: number;
  buckets: Record<ComicStoryBankCategory, ComicStoryBankBucket>;
  topIdeas: ComicStoryBankIdea[];
  productionMiningPlan: Array<{
    order: number;
    category: ComicStoryBankCategory;
    ideaId: string;
    title: string;
    issueNumber: number | null;
    pages: number[];
    whyThisOne: string;
  }>;
  whatItCanMine: {
    battleShorts: number;
    curiosityShorts: number;
    loreShorts: number;
    relationshipShorts: number;
    cliffhangerShorts: number;
    storyExplainers: number;
    readiness: "high" | "medium" | "low";
    missingCategories: ComicStoryBankCategory[];
  };
  qualityGates: {
    hasMultipleCategories: boolean;
    hasAtLeastFiveIdeas: boolean;
    hasReadyIdeas: boolean;
    canGenerateShortBatch: boolean;
    blockers: string[];
  };
  warnings: string[];
  candidateFirst: true;
  requiresManualApproval: true;
};

const STORY_BANK_CATEGORIES: ComicStoryBankCategory[] = [
  "battle",
  "curiosity",
  "lore",
  "relationship",
  "absurdity",
  "cliffhanger",
  "visual_spectacle",
  "story_explainer"
];

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function display(value: string | null | undefined, fallback = "a historia"): string {
  const raw = value?.trim() || fallback;
  return raw
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .replace("Godzilla", "Godzilla")
    .replace("Kong", "Kong")
    .replace("Superman", "Superman")
    .replace("Batman", "Batman");
}

function normalizedText(values: string[]): string {
  return values.join(" ").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function candidateCategory(candidate: ComicSagaShortCandidate): ComicStoryBankCategory {
  const text = normalizedText([
    candidate.title,
    candidate.hook,
    candidate.conflict,
    candidate.middle,
    candidate.payoff,
    ...candidate.themes,
    ...candidate.reasons
  ]);
  if (/absurdo|engracado|bizarro|ridiculo|impossivel demais/.test(text)) return "absurdity";
  if (/cliffhanger|pergunta que fica|continua|so comecando|gancho/.test(text)) return "cliffhanger";
  if (/origem|contexto|explica|lore|historia por tras|mundo/.test(text)) return "lore";
  if (/relacao|alianca|parceria|traicao|tensao entre|dupla/.test(text)) return "relationship";
  if (/curios|detalhe|sabia|passaria direto|segredo|revela/.test(text)) return "curiosity";
  if (/luta|batalha|confronto|contra|impacto|kaiju|godzilla|kong|titan/.test(text)) return "battle";
  if (/visual|splash|painel|quadro|escala/.test(text)) return "visual_spectacle";
  return "story_explainer";
}

function timelineCategory(entry: ComicSagaTimelineEntry): ComicStoryBankCategory {
  const text = normalizedText([entry.role, entry.summary, entry.conflictSignal, ...entry.dominantThemes]);
  if (/climax|impacto|luta|batalha|confronto|monster|titan|kaiju/.test(text)) return "battle";
  if (/opening|inciting|context|setup|abertura/.test(text)) return "story_explainer";
  if (/resolution|cliffhanger|pergunta|gancho|fechamento/.test(text)) return "cliffhanger";
  if (/reveal|revelacao|segredo|detalhe|curiosidade/.test(text)) return "curiosity";
  if (/relacao|tensao entre|alianca|dupla/.test(text)) return "relationship";
  return "visual_spectacle";
}

function storylineCategory(storyline: ComicSagaStoryline): ComicStoryBankCategory {
  const text = normalizedText([storyline.title, storyline.beginning, storyline.conflict, storyline.middle, storyline.payoff, ...storyline.themes]);
  if (/origem|contexto|explica|lore/.test(text)) return "lore";
  if (/relacao|alianca|parceria|tensao/.test(text)) return "relationship";
  if (/luta|batalha|confronto|monster|titan|kaiju|godzilla|kong/.test(text)) return "battle";
  return "story_explainer";
}

function readinessFromCandidate(readiness: ComicSagaShortCandidate["readiness"]): ComicStoryBankIdea["readiness"] {
  if (readiness === "ready_for_short") return "ready_for_short";
  if (readiness === "needs_manual_panel_review") return "needs_panel_review";
  if (readiness === "needs_more_context") return "needs_context";
  return "weak";
}

function scoreIdea(baseScore: number, category: ComicStoryBankCategory, pages: number[], panels: string[], warnings: string[]): number {
  const categoryBonus = category === "battle" || category === "curiosity" || category === "story_explainer" ? 8 : 4;
  const durationBonus = pages.length >= 2 ? 6 : 0;
  const panelBonus = panels.length >= 4 ? 6 : panels.length >= 2 ? 3 : 0;
  return clampScore(baseScore + categoryBonus + durationBonus + panelBonus - warnings.length * 4);
}

function ideaFromCandidate(candidate: ComicSagaShortCandidate): ComicStoryBankIdea {
  const category = candidateCategory(candidate);
  const warnings = [...candidate.warnings];
  if (candidate.pages.length < 2) warnings.push("story_bank_candidate_has_few_pages");
  return {
    id: `story-bank:candidate:${candidate.id}`,
    category,
    title: candidate.title,
    sourceType: "recommended_short",
    sourceId: candidate.id,
    issueId: candidate.issueId,
    issueNumber: candidate.issueNumber,
    issueTitle: candidate.issueTitle,
    pages: candidate.pages,
    panelIds: candidate.panelIds,
    characters: candidate.characters,
    themes: candidate.themes,
    hook: candidate.hook,
    conflict: candidate.conflict,
    payoff: candidate.payoff,
    whyItCouldWork: `Ja veio como candidato de short; categoria=${category}; score=${candidate.score}.`,
    estimatedDurationSeconds: Math.max(30, candidate.estimatedDurationSeconds),
    score: scoreIdea(candidate.score, category, candidate.pages, candidate.panelIds, warnings),
    readiness: readinessFromCandidate(candidate.readiness),
    chronology: {
      issueNumber: candidate.issueNumber,
      pageStart: candidate.chronology.localPageStart,
      pageEnd: candidate.chronology.localPageEnd
    },
    riskNotes: ["candidate_first_manual_approval_required"],
    warnings
  };
}

function ideaFromTimeline(entry: ComicSagaTimelineEntry): ComicStoryBankIdea {
  const category = timelineCategory(entry);
  const warnings = [...entry.warnings];
  if (entry.shortPotentialScore < 55) warnings.push("timeline_section_low_short_potential");
  return {
    id: `story-bank:timeline:${entry.issueId}:${entry.pageRange.start}-${entry.pageRange.end}:${category}`,
    category,
    title: `${display(entry.dominantCharacters[0] ?? entry.dominantThemes[0])}: ${entry.summary}`,
    sourceType: "timeline_section",
    sourceId: `${entry.issueId}:${entry.absoluteOrder}`,
    issueId: entry.issueId,
    issueNumber: entry.issueNumber,
    issueTitle: entry.issueTitle,
    pages: entry.localPages,
    panelIds: [],
    characters: entry.dominantCharacters,
    themes: entry.dominantThemes,
    hook: entry.summary,
    conflict: entry.conflictSignal,
    payoff: entry.role === "resolution" ? "O trecho fecha com pergunta, reacao ou gancho." : "O trecho prepara o proximo impacto visual.",
    whyItCouldWork: `Secao da timeline com papel=${entry.role}; ajuda a explicar a historia em linha reta.`,
    estimatedDurationSeconds: Math.max(30, entry.localPages.length * 6),
    score: scoreIdea(entry.shortPotentialScore, category, entry.localPages, [], warnings),
    readiness: entry.shortPotentialScore >= 70 ? "needs_panel_review" : entry.shortPotentialScore >= 55 ? "needs_context" : "weak",
    chronology: {
      issueNumber: entry.issueNumber,
      pageStart: entry.pageRange.start,
      pageEnd: entry.pageRange.end
    },
    riskNotes: ["timeline_section_needs_panel_confirmation"],
    warnings
  };
}

function ideaFromStoryline(storyline: ComicSagaStoryline): ComicStoryBankIdea {
  const category = storylineCategory(storyline);
  const warnings = [...storyline.warnings];
  return {
    id: `story-bank:storyline:${storyline.id}`,
    category,
    title: storyline.title,
    sourceType: "storyline",
    sourceId: storyline.id,
    issueId: null,
    issueNumber: storyline.issueNumbers[0] ?? null,
    issueTitle: null,
    pages: [],
    panelIds: [],
    characters: storyline.characters,
    themes: storyline.themes,
    hook: storyline.beginning,
    conflict: storyline.conflict,
    payoff: storyline.payoff,
    whyItCouldWork: `Linha narrativa atravessa ${storyline.issueNumbers.length} edicao(oes), boa para serie ou explicacao da HQ.`,
    estimatedDurationSeconds: Math.max(30, Math.min(60, storyline.issueNumbers.length * 12)),
    score: scoreIdea(storyline.score, category, [], [], warnings),
    readiness: storyline.readiness === "ready_for_series_short" ? "needs_panel_review" : storyline.readiness === "needs_more_story_context" ? "needs_context" : "weak",
    chronology: {
      issueNumber: storyline.issueNumbers[0] ?? null,
      pageStart: null,
      pageEnd: null
    },
    riskNotes: ["storyline_requires_panel_selection_before_render"],
    warnings
  };
}

function ideaFromCuriosity(issue: ComicSagaNarrativeMap["issueMaps"][number], curiosity: ComicSagaNarrativeMap["issueMaps"][number]["map"]["curiosities"][number]): ComicStoryBankIdea {
  const warnings = [...curiosity.riskNotes];
  return {
    id: `story-bank:curiosity:${issue.issueId}:${curiosity.id}`,
    category: "curiosity",
    title: curiosity.title,
    sourceType: "issue_curiosity",
    sourceId: curiosity.id,
    issueId: issue.issueId,
    issueNumber: issue.issueNumber,
    issueTitle: issue.title,
    pages: curiosity.pages,
    panelIds: curiosity.panelIds,
    characters: issue.map.issueOverview.mainCharacters,
    themes: issue.map.issueOverview.mainThemes,
    hook: curiosity.evidence[0] ?? curiosity.title,
    conflict: curiosity.whyItWorksAsShort,
    payoff: "A curiosidade muda como o espectador entende a pagina.",
    whyItCouldWork: curiosity.whyItWorksAsShort,
    estimatedDurationSeconds: Math.max(30, curiosity.estimatedDurationSeconds),
    score: scoreIdea(curiosity.score, "curiosity", curiosity.pages, curiosity.panelIds, warnings),
    readiness: curiosity.score >= 75 ? "needs_panel_review" : "needs_context",
    chronology: {
      issueNumber: issue.issueNumber,
      pageStart: curiosity.pages[0] ?? null,
      pageEnd: curiosity.pages[curiosity.pages.length - 1] ?? null
    },
    riskNotes: ["curiosity_needs_manual_fact_check", ...curiosity.riskNotes],
    warnings
  };
}

function ideaFromIssueOverview(issue: ComicSagaNarrativeMap["issueMaps"][number]): ComicStoryBankIdea {
  const overview = issue.map.issueOverview;
  const pages = issue.map.coverage.pagesCovered.length ? issue.map.coverage.pagesCovered : Array.from({ length: overview.pageCount }, (_, index) => index + 1);
  const warnings = [...issue.map.warnings];
  if (!issue.map.qualityGates.hasBeginningMiddleEnd) warnings.push("issue_overview_needs_clearer_beginning_middle_end");
  return {
    id: `story-bank:issue-overview:${issue.issueId}`,
    category: "story_explainer",
    title: `A historia da edicao ${issue.issueNumber}: ${overview.centralConflict}`,
    sourceType: "timeline_section",
    sourceId: `${issue.issueId}:overview`,
    issueId: issue.issueId,
    issueNumber: issue.issueNumber,
    issueTitle: issue.title,
    pages,
    panelIds: issue.map.coverage.panelIdsCovered,
    characters: overview.mainCharacters,
    themes: overview.mainThemes,
    hook: overview.beginning,
    conflict: overview.centralConflict,
    payoff: overview.ending,
    whyItCouldWork: "Condensa a edicao em uma linha cronologica com comeco, conflito e fechamento.",
    estimatedDurationSeconds: Math.max(30, Math.min(60, pages.length * 4)),
    score: scoreIdea(issue.map.productionStrategy.firstShortId ? 82 : 68, "story_explainer", pages, issue.map.coverage.panelIdsCovered, warnings),
    readiness: issue.map.qualityGates.canAttemptAutomatedShort ? "needs_panel_review" : "needs_context",
    chronology: {
      issueNumber: issue.issueNumber,
      pageStart: pages[0] ?? null,
      pageEnd: pages[pages.length - 1] ?? null
    },
    riskNotes: ["issue_explainer_requires_manual_story_review"],
    warnings
  };
}
function dedupeIdeas(ideas: ComicStoryBankIdea[]): ComicStoryBankIdea[] {
  const seen = new Set<string>();
  const output: ComicStoryBankIdea[] = [];
  for (const idea of [...ideas].sort((left, right) => right.score - left.score)) {
    const key = `${idea.category}:${idea.issueId ?? "saga"}:${idea.pages.join("-")}:${idea.characters.slice(0, 2).sort().join("+")}:${idea.themes[0] ?? "theme"}`;
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(idea);
  }
  return output.sort((left, right) => right.score - left.score || (left.chronology.issueNumber ?? 999) - (right.chronology.issueNumber ?? 999));
}

function buildBucket(category: ComicStoryBankCategory, ideas: ComicStoryBankIdea[]): ComicStoryBankBucket {
  const sorted = ideas.filter((idea) => idea.category === category).sort((left, right) => right.score - left.score);
  return {
    category,
    ideaCount: sorted.length,
    readyCount: sorted.filter((idea) => idea.readiness === "ready_for_short" || idea.readiness === "needs_panel_review").length,
    strongestIdeaId: sorted[0]?.id ?? null,
    ideas: sorted,
    warnings: sorted.length === 0 ? [`no_${category}_ideas_found`] : []
  };
}

function buildProductionMiningPlan(buckets: Record<ComicStoryBankCategory, ComicStoryBankBucket>, limit: number): ComicHQWideStoryBankReport["productionMiningPlan"] {
  const plan: ComicHQWideStoryBankReport["productionMiningPlan"] = [];
  const used = new Set<string>();
  for (const category of STORY_BANK_CATEGORIES) {
    const idea = buckets[category].ideas.find((candidate) => !used.has(candidate.id));
    if (idea) {
      used.add(idea.id);
      plan.push({
        order: plan.length + 1,
        category,
        ideaId: idea.id,
        title: idea.title,
        issueNumber: idea.issueNumber,
        pages: idea.pages,
        whyThisOne: `Melhor ideia da categoria ${category}; score=${idea.score}; readiness=${idea.readiness}.`
      });
    }
  }
  const leftovers = STORY_BANK_CATEGORIES
    .flatMap((category) => buckets[category].ideas)
    .filter((idea) => !used.has(idea.id))
    .sort((left, right) => right.score - left.score);
  for (const idea of leftovers) {
    if (plan.length >= limit) break;
    used.add(idea.id);
    plan.push({
      order: plan.length + 1,
      category: idea.category,
      ideaId: idea.id,
      title: idea.title,
      issueNumber: idea.issueNumber,
      pages: idea.pages,
      whyThisOne: `Complementa o lote com alta pontuacao; score=${idea.score}.`
    });
  }
  return plan;
}

export function buildComicHQWideStoryBank(input: {
  sagaMap: ComicSagaNarrativeMap;
  maxIdeasPerCategory?: number;
  maxProductionPlanItems?: number;
}): ComicHQWideStoryBankReport {
  const rawIdeas = [
    ...input.sagaMap.recommendedShorts.map(ideaFromCandidate),
    ...input.sagaMap.timeline.map(ideaFromTimeline),
    ...input.sagaMap.storylines.map(ideaFromStoryline),
    ...input.sagaMap.issueMaps.map(ideaFromIssueOverview),
    ...input.sagaMap.issueMaps.flatMap((issue) => issue.map.curiosities.map((curiosity) => ideaFromCuriosity(issue, curiosity)))
  ];
  const ideas = dedupeIdeas(rawIdeas);
  const maxPerCategory = input.maxIdeasPerCategory ?? 20;
  const buckets = STORY_BANK_CATEGORIES.reduce((acc, category) => {
    const bucket = buildBucket(category, ideas);
    acc[category] = { ...bucket, ideas: bucket.ideas.slice(0, maxPerCategory) };
    return acc;
  }, {} as Record<ComicStoryBankCategory, ComicStoryBankBucket>);
  const topIdeas = STORY_BANK_CATEGORIES
    .flatMap((category) => buckets[category].ideas)
    .sort((left, right) => right.score - left.score)
    .slice(0, 30);
  const productionMiningPlan = buildProductionMiningPlan(buckets, input.maxProductionPlanItems ?? 20);
  const missingCategories = STORY_BANK_CATEGORIES.filter((category) => buckets[category].ideaCount === 0);
  const readyIdeaCount = ideas.filter((idea) => idea.readiness === "ready_for_short" || idea.readiness === "needs_panel_review").length;
  const warnings = [
    ...missingCategories.map((category) => `story_bank_missing_category:${category}`),
    ...(productionMiningPlan.length < 5 ? ["story_bank_has_small_production_plan"] : [])
  ];
  const blockers = [
    ...(ideas.length === 0 ? ["no_story_bank_ideas"] : []),
    ...(readyIdeaCount === 0 ? ["no_ready_story_bank_ideas"] : [])
  ];
  return {
    bankId: "comic_hq_wide_story_bank_v1",
    generatedAt: new Date().toISOString(),
    sagaTitle: input.sagaMap.sagaOverview.title,
    issueCount: input.sagaMap.sagaOverview.issueCount,
    totalIdeaCount: ideas.length,
    readyIdeaCount,
    buckets,
    topIdeas,
    productionMiningPlan,
    whatItCanMine: {
      battleShorts: buckets.battle.ideaCount,
      curiosityShorts: buckets.curiosity.ideaCount,
      loreShorts: buckets.lore.ideaCount,
      relationshipShorts: buckets.relationship.ideaCount,
      cliffhangerShorts: buckets.cliffhanger.ideaCount,
      storyExplainers: buckets.story_explainer.ideaCount,
      readiness: readyIdeaCount >= 10 && missingCategories.length <= 2 ? "high" : readyIdeaCount > 0 ? "medium" : "low",
      missingCategories
    },
    qualityGates: {
      hasMultipleCategories: STORY_BANK_CATEGORIES.filter((category) => buckets[category].ideaCount > 0).length >= 3,
      hasAtLeastFiveIdeas: ideas.length >= 5,
      hasReadyIdeas: readyIdeaCount > 0,
      canGenerateShortBatch: blockers.length === 0 && productionMiningPlan.length >= 3,
      blockers
    },
    warnings,
    candidateFirst: true,
    requiresManualApproval: true
  };
}