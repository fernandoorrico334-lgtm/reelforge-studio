import type { ComicNarrationPanelMatchPlan } from "./comic-narration-panel-matcher.js";
import type { ComicOneClickProductionGate } from "./comic-one-click-production-gate.js";

export type ComicEpisodeGodModeCheckStatus = "passed" | "warning" | "blocked";

export type ComicEpisodeGodModeCheck = {
  id: string;
  label: string;
  status: ComicEpisodeGodModeCheckStatus;
  score: number;
  detail: string;
};

export type ComicEpisodeGodModeGate = {
  gateId: "comic_episode_god_mode_gate_v1";
  status: "god_ready" | "needs_director_review" | "blocked";
  score: number;
  renderCandidateAllowed: boolean;
  checks: ComicEpisodeGodModeCheck[];
  blockers: string[];
  warnings: string[];
  directorNotes: string[];
};

type EpisodeLike = {
  episodeId: string;
  title: string;
  narration: string;
  estimatedDurationSeconds: number;
  narrationBeats?: Array<{
    eventId: string;
    narrationText: string;
    sourcePages: number[];
    visualTargets?: string[];
  }>;
  pageReferences?: Array<{ issueNumber: number; pageNumbers: number[] }>;
  hook?: string;
  context?: string;
  payoff?: string;
  nextEpisodeHook?: string;
};

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function check(status: ComicEpisodeGodModeCheckStatus, id: string, label: string, score: number, detail: string): ComicEpisodeGodModeCheck {
  return { id, label, status, score: clampScore(score), detail };
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9\s?]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function pageKeys(episode: EpisodeLike): number[] {
  return (episode.pageReferences ?? []).flatMap((reference) =>
    reference.pageNumbers.map((pageNumber) => reference.issueNumber * 1000 + pageNumber)
  );
}

function hasChronologicalPageFlow(episode: EpisodeLike): boolean {
  const keys = pageKeys(episode);
  return keys.every((value, index) => index === 0 || value >= keys[index - 1]!);
}

function hasStorySpine(episode: EpisodeLike): boolean {
  const text = normalize(`${episode.hook ?? ""} ${episode.context ?? ""} ${episode.narration} ${episode.payoff ?? ""} ${episode.nextEpisodeHook ?? ""}`);
  const hasSetup = /antes|quando|enquanto|primeiro|come[cç]a|inicio|cidade|gotham|fortaleza|liga|jack|lex|coringa|batman|superman/.test(text);
  const hasCause = /porque|por isso|entao|enquanto|mas|so que|ate que|por tras|plano|queria|precisava/.test(text);
  const hasPayoff = /no fim|finalmente|descobre|percebe|revela|abre|cai|vence|continua|parte 2|proxima/.test(text);
  return hasSetup && hasCause && hasPayoff;
}

function hasOpenQuestionRetention(episode: EpisodeLike): boolean {
  const text = `${episode.hook ?? ""} ${episode.context ?? ""} ${episode.narration} ${episode.nextEpisodeHook ?? ""}`;
  return /\?/.test(text) || /como|por que|quem|o que|qual|sera|consegue|descobre/i.test(text);
}

function countVisualTargetCoverage(episode: EpisodeLike): { beatCount: number; beatsWithTargets: number; coverage: number } {
  const beats = episode.narrationBeats ?? [];
  const beatCount = beats.length;
  const beatsWithTargets = beats.filter((beat) => (beat.visualTargets ?? []).length > 0).length;
  return { beatCount, beatsWithTargets, coverage: beatCount ? beatsWithTargets / beatCount : 0 };
}

function scorePanelPlan(panelMatchPlan: ComicNarrationPanelMatchPlan | null | undefined): {
  coverage: number;
  highConfidenceCoverage: number;
  weakMatchCount: number;
  missingCount: number;
  averageScore: number;
  repeatedPanelCount: number;
  actionOrObjectFocusCount: number;
} {
  if (!panelMatchPlan || panelMatchPlan.beatCount === 0) {
    return {
      coverage: 0,
      highConfidenceCoverage: 0,
      weakMatchCount: 0,
      missingCount: 999,
      averageScore: 0,
      repeatedPanelCount: 999,
      actionOrObjectFocusCount: 0
    };
  }

  const matched = panelMatchPlan.matches.filter((match) => Boolean(match.selectedPanelId));
  const highConfidence = panelMatchPlan.matches.filter((match) => match.confidence === "high");
  const weak = panelMatchPlan.matches.filter((match) => match.score < 58 || match.confidence === "low" || match.confidence === "missing");
  const actionOrObjectFocus = panelMatchPlan.matches.filter((match) =>
    match.zoomInstruction.mode === "action_focus" || match.zoomInstruction.mode === "object_focus" || match.zoomInstruction.mode === "dialogue_focus"
  );

  return {
    coverage: matched.length / panelMatchPlan.beatCount,
    highConfidenceCoverage: highConfidence.length / panelMatchPlan.beatCount,
    weakMatchCount: weak.length,
    missingCount: panelMatchPlan.beatCount - matched.length,
    averageScore: panelMatchPlan.averageScore,
    repeatedPanelCount: panelMatchPlan.repeatedPanelCount,
    actionOrObjectFocusCount: actionOrObjectFocus.length
  };
}

export function evaluateComicEpisodeGodModeGate(input: {
  episode: EpisodeLike;
  productionGate: ComicOneClickProductionGate;
  panelMatchPlan?: ComicNarrationPanelMatchPlan | null;
  minimumScore?: number;
}): ComicEpisodeGodModeGate {
  const minimumScore = input.minimumScore ?? 90;
  const episode = input.episode;
  const panel = scorePanelPlan(input.panelMatchPlan);
  const checks: ComicEpisodeGodModeCheck[] = [];

  checks.push(check(
    input.productionGate.renderAllowed ? "passed" : input.productionGate.status === "needs_review" ? "warning" : "blocked",
    "production_gate",
    "Gate editorial base",
    input.productionGate.score,
    `status=${input.productionGate.status}; score=${input.productionGate.score}; blockers=${input.productionGate.blockers.join(",") || "none"}`
  ));

  checks.push(check(
    hasStorySpine(episode) ? "passed" : "blocked",
    "story_spine",
    "Historia mastigada com causa e consequencia",
    hasStorySpine(episode) ? 96 : 42,
    hasStorySpine(episode) ? "Hook, contexto, causa e payoff aparecem na narracao." : "Falta explicar setup, causa ou payoff antes do render."
  ));

  checks.push(check(
    hasOpenQuestionRetention(episode) ? "passed" : "warning",
    "retention_question",
    "Pergunta aberta de retencao",
    hasOpenQuestionRetention(episode) ? 94 : 68,
    hasOpenQuestionRetention(episode) ? "O episodio abre ou sustenta uma pergunta para o espectador." : "Falta uma pergunta clara para prender a atencao."
  ));

  const visualTargets = countVisualTargetCoverage(episode);
  checks.push(check(
    visualTargets.coverage >= 0.9 ? "passed" : visualTargets.coverage >= 0.75 ? "warning" : "blocked",
    "visual_target_coverage",
    "Cada fala sabe o que precisa mostrar",
    visualTargets.coverage * 100,
    `${visualTargets.beatsWithTargets}/${visualTargets.beatCount} beats possuem alvo visual.`
  ));

  checks.push(check(
    panel.coverage >= 0.92 ? "passed" : panel.coverage >= 0.75 ? "warning" : "blocked",
    "panel_match_coverage",
    "Painel sugerido por beat",
    panel.coverage * 100,
    `${Math.round(panel.coverage * 100)}% dos beats receberam painel local sugerido.`
  ));

  checks.push(check(
    panel.averageScore >= 72 ? "passed" : panel.averageScore >= 58 ? "warning" : "blocked",
    "panel_match_score",
    "Score de painel x narracao",
    panel.averageScore,
    `score medio=${panel.averageScore}; fracos=${panel.weakMatchCount}; missing=${panel.missingCount}`
  ));

  checks.push(check(
    panel.highConfidenceCoverage >= 0.55 ? "passed" : panel.highConfidenceCoverage >= 0.35 ? "warning" : "blocked",
    "panel_high_confidence",
    "Confianca alta em cenas-chave",
    panel.highConfidenceCoverage * 100,
    `${Math.round(panel.highConfidenceCoverage * 100)}% dos beats tem match high confidence.`
  ));

  checks.push(check(
    panel.repeatedPanelCount === 0 ? "passed" : "blocked",
    "no_panel_repetition",
    "Sem repeticao visual evidente",
    panel.repeatedPanelCount === 0 ? 100 : 35,
    panel.repeatedPanelCount === 0 ? "Nenhum painel repetido no plano." : `${panel.repeatedPanelCount} painel(is) repetido(s).`
  ));

  checks.push(check(
    hasChronologicalPageFlow(episode) ? "passed" : "blocked",
    "chronological_flow",
    "Historia sempre para frente",
    hasChronologicalPageFlow(episode) ? 100 : 30,
    hasChronologicalPageFlow(episode) ? "Paginas/edicoes seguem para frente." : "Plano volta paginas e pode confundir a historia."
  ));

  const durationOk = episode.estimatedDurationSeconds >= 30 && episode.estimatedDurationSeconds <= 180;
  checks.push(check(
    durationOk ? "passed" : "blocked",
    "duration_window",
    "Duracao utilizavel para short premium",
    durationOk ? 96 : 40,
    `${episode.estimatedDurationSeconds}s; alvo atual entre 30s e 180s.`
  ));

  const blockers = checks.filter((item) => item.status === "blocked").map((item) => item.id);
  const warnings = checks.filter((item) => item.status === "warning").map((item) => item.id);
  const score = clampScore(checks.reduce((sum, item) => sum + item.score, 0) / checks.length);
  const renderCandidateAllowed = blockers.length === 0 && score >= minimumScore;
  const status = renderCandidateAllowed ? "god_ready" : blockers.length > 0 ? "blocked" : "needs_director_review";

  return {
    gateId: "comic_episode_god_mode_gate_v1",
    status,
    score,
    renderCandidateAllowed,
    checks,
    blockers,
    warnings,
    directorNotes: [
      renderCandidateAllowed
        ? "Episodio esta candidato ao one-click premium: historia clara, painel por fala, sem repeticao e com progressao cronologica."
        : "Ainda precisa de revisao de direcao antes de chamar isso de automatico premium.",
      blockers.length ? `Bloqueios: ${blockers.join(", ")}.` : "Sem bloqueios duros.",
      warnings.length ? `Refinar: ${warnings.join(", ")}.` : "Sem warnings principais.",
      "Este gate nao renderiza nem importa assets: ele apenas decide se o plano esta bom o bastante para aprovacao final."
    ]
  };
}
