export type ComicOneClickProductionCheckStatus = "passed" | "warning" | "blocked";

export type ComicOneClickProductionCheck = {
  id: string;
  label: string;
  status: ComicOneClickProductionCheckStatus;
  score: number;
  detail: string;
};

export type ComicOneClickProductionGate = {
  gateId: "comic_one_click_production_gate_v1";
  status: "render_ready" | "needs_review" | "blocked";
  score: number;
  renderAllowed: boolean;
  minimumScoreToRender: number;
  checks: ComicOneClickProductionCheck[];
  blockers: string[];
  warnings: string[];
  directorNotes: string[];
};

type EpisodeLike = {
  episodeId: string;
  title: string;
  hook?: string;
  context?: string;
  payoff?: string;
  nextEpisodeHook?: string;
  estimatedDurationSeconds: number;
  wordCount: number;
  eventIds: string[];
  issueNumbers: number[];
  pageReferences?: Array<{ issueNumber: number; pageNumbers: number[] }>;
  narration: string;
  narrationBeats?: Array<{
    eventId: string;
    narrationText: string;
    sourcePages: number[];
    visualTargets?: string[];
  }>;
  criticalFactIds: string[];
  gate: { status: "passed" | "blocked"; blockers: string[]; warnings: string[] };
};

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function check(status: ComicOneClickProductionCheckStatus, id: string, label: string, score: number, detail: string): ComicOneClickProductionCheck {
  return { id, label, status, score: clampScore(score), detail };
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasChronologicalPages(episode: EpisodeLike): boolean {
  const pageKeys = (episode.pageReferences ?? []).flatMap((ref) =>
    ref.pageNumbers.map((pageNumber) => ref.issueNumber * 1000 + pageNumber)
  );
  return pageKeys.every((value, index) => index === 0 || value >= pageKeys[index - 1]!);
}

function countConcreteSignals(text: string): number {
  const normalized = normalize(text);
  const signals = [
    "batman", "bétman", "jack", "napier", "coringa", "gotham", "arlequina", "superman", "godzilla", "lex", "liga", "caixa", "materna", "kong"
  ];
  return signals.filter((signal) => normalized.includes(normalize(signal))).length;
}

function hasQuestionDrivenRetention(episode: EpisodeLike): boolean {
  const text = `${episode.hook ?? ""} ${episode.context ?? ""} ${episode.narration} ${episode.nextEpisodeHook ?? ""}`;
  return /\?/.test(text) || /como|por que|quem|o que|quando|qual/i.test(text);
}

function hasGenericNarrationRisk(text: string): boolean {
  const normalized = normalize(text);
  const genericPatterns = [
    "algo aconteceu",
    "as coisas ficaram complicadas",
    "a historia continua",
    "varias coisas acontecem",
    "uma grande batalha acontece",
    "eles precisam resolver"
  ];
  return genericPatterns.some((pattern) => normalized.includes(normalize(pattern)));
}

export function evaluateComicOneClickProductionGate(input: {
  episode: EpisodeLike;
  minimumDurationSeconds?: number;
  maximumDurationSeconds?: number;
  minimumScoreToRender?: number;
}): ComicOneClickProductionGate {
  const minimumDurationSeconds = input.minimumDurationSeconds ?? 30;
  const maximumDurationSeconds = input.maximumDurationSeconds ?? 180;
  const minimumScoreToRender = input.minimumScoreToRender ?? 86;
  const episode = input.episode;
  const checks: ComicOneClickProductionCheck[] = [];

  const durationPassed = episode.estimatedDurationSeconds >= minimumDurationSeconds && episode.estimatedDurationSeconds <= maximumDurationSeconds;
  checks.push(check(
    durationPassed ? "passed" : "blocked",
    "duration_window",
    "Duracao editorial",
    durationPassed ? 100 : 30,
    `${episode.estimatedDurationSeconds}s precisa ficar entre ${minimumDurationSeconds}s e ${maximumDurationSeconds}s.`
  ));

  const baseGatePassed = episode.gate.status === "passed" && episode.gate.blockers.length === 0;
  checks.push(check(
    baseGatePassed ? "passed" : "blocked",
    "planner_gate",
    "Planner narrativo",
    baseGatePassed ? 100 : 20,
    baseGatePassed ? "Planner da biblia passou sem bloqueios." : `Bloqueios: ${episode.gate.blockers.join("; ")}`
  ));

  const eventScore = episode.eventIds.length >= 4 ? 100 : episode.eventIds.length >= 3 ? 82 : 45;
  checks.push(check(
    episode.eventIds.length >= 3 ? "passed" : "blocked",
    "story_material",
    "Material de historia",
    eventScore,
    `${episode.eventIds.length} eventos narrativos no episodio.`
  ));

  const criticalScore = episode.criticalFactIds.length >= episode.eventIds.length ? 100 : episode.criticalFactIds.length > 0 ? 78 : 20;
  checks.push(check(
    episode.criticalFactIds.length > 0 ? (criticalScore >= 86 ? "passed" : "warning") : "blocked",
    "critical_facts",
    "Fatos criticos mastigados",
    criticalScore,
    `${episode.criticalFactIds.length} fatos criticos cobertos.`
  ));

  const chronological = hasChronologicalPages(episode);
  checks.push(check(
    chronological ? "passed" : "blocked",
    "chronological_pages",
    "Ordem de paginas sem voltar",
    chronological ? 100 : 25,
    chronological ? "Paginas seguem para frente." : "Pagina/edicao volta no tempo dentro do episodio."
  ));

  const beatCount = episode.narrationBeats?.length ?? 0;
  const beatsWithTargets = episode.narrationBeats?.filter((beat) => (beat.visualTargets ?? []).length > 0).length ?? 0;
  const visualCoverage = beatCount === 0 ? 0 : beatsWithTargets / beatCount;
  checks.push(check(
    visualCoverage >= 0.85 ? "passed" : visualCoverage >= 0.65 ? "warning" : "blocked",
    "visual_target_coverage",
    "Narracao com alvo visual",
    visualCoverage * 100,
    `${beatsWithTargets}/${beatCount} beats possuem alvo visual explicito.`
  ));

  const questionDriven = hasQuestionDrivenRetention(episode);
  checks.push(check(
    questionDriven ? "passed" : "warning",
    "curiosity_retention",
    "Pergunta aberta e payoff",
    questionDriven ? 94 : 68,
    questionDriven ? "Episodio cria pergunta/curiosidade para segurar retencao." : "Falta pergunta clara para o espectador querer resposta."
  ));

  const concreteSignals = countConcreteSignals(episode.narration);
  const genericRisk = hasGenericNarrationRisk(episode.narration);
  const narrationSpecificityScore = genericRisk ? 45 : Math.min(100, 68 + concreteSignals * 4);
  checks.push(check(
    genericRisk ? "blocked" : narrationSpecificityScore >= 86 ? "passed" : "warning",
    "narration_specificity",
    "Narracao cinematografica e especifica",
    narrationSpecificityScore,
    genericRisk ? "Narracao contem frases genericas demais." : `${concreteSignals} sinais concretos de personagem/lugar/objeto na narracao.`
  ));

  const pageSpan = (episode.pageReferences ?? []).reduce((total, ref) => total + ref.pageNumbers.length, 0);
  checks.push(check(
    pageSpan >= 15 ? "passed" : "warning",
    "page_span",
    "Cobertura suficiente de paginas",
    pageSpan >= 15 ? 94 : 70,
    `${pageSpan} paginas cobertas; alvo recomendado para episodio denso e mastigado: 15+. `
  ));

  const blockers = checks.filter((item) => item.status === "blocked").map((item) => item.id);
  const warnings = checks.filter((item) => item.status === "warning").map((item) => item.id);
  const score = clampScore(checks.reduce((sum, item) => sum + item.score, 0) / checks.length);
  const renderAllowed = blockers.length === 0 && score >= minimumScoreToRender;
  const status = renderAllowed ? "render_ready" : blockers.length > 0 ? "blocked" : "needs_review";
  const directorNotes = [
    renderAllowed
      ? "Episodio liberado para render aprovado: historia, duracao, ordem e alvos visuais passaram."
      : "Episodio ainda precisa de direcao antes do render automatico.",
    warnings.length ? `Pontos para refinar: ${warnings.join(", ")}.` : "Sem warnings editoriais fortes.",
    "Render automatico continua bloqueado sem aprovacao humana explicita."
  ];

  return {
    gateId: "comic_one_click_production_gate_v1",
    status,
    score,
    renderAllowed,
    minimumScoreToRender,
    checks,
    blockers,
    warnings,
    directorNotes
  };
}
