import type { ComicNarrativeBibleInput, ComicNarrativeEvent, ComicNarrativeFact } from "./comic-narrative-bible-engine.js";

export type ComicStoryCoverageGateIssue = {
  code: string;
  severity: "warning" | "blocker";
  eventId?: string;
  factId?: string;
  character?: string;
  detail: string;
};

export type ComicStoryCoverageGate = {
  gateId: "comic_story_coverage_gate_v1";
  status: "passed" | "blocked";
  mode: "compact_complete" | "too_compressed" | "expanded";
  wordCount: number;
  selectedPageCount: number;
  wordDensityPerPage: number;
  minimumRecommendedWords: number;
  criticalFactCoverage: number;
  coveredCriticalFactCount: number;
  missingCriticalFactCount: number;
  explainedCharacterCoverage: number;
  explainedCharacterCount: number;
  unexplainedCharacterCount: number;
  causeConsequenceCoverage: number;
  warnings: string[];
  blockers: string[];
  issues: ComicStoryCoverageGateIssue[];
};

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
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

function wordCount(value: string): number {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

function containsAny(corpus: string, terms: string[]): boolean {
  return terms.some((term) => corpus.includes(normalize(term)));
}

function containsFact(corpus: string, fact: ComicNarrativeFact): boolean {
  return fact.requiredNarrationTerms.every((alternatives) => containsAny(corpus, alternatives));
}

function characterAliases(name: string): string[] {
  const normalized = normalize(name);
  const firstName = name.split(/\s+/)[0] ?? name;
  const aliases = [name, firstName];
  if (normalized.includes("asa noturna") || normalized.includes("nightwing") || normalized.includes("dick grayson")) aliases.push("Asa Noturna", "Dick", "Dick Grayson", "antigo Robin", "Robin");
  if (normalized.includes("batgirl") || normalized.includes("barbara")) aliases.push("Batgirl", "Barbara", "Barbara Gordon");
  if (normalized.includes("comissario") || normalized.includes("gordon")) aliases.push("Gordon", "comissario", "comissario Gordon", "equipe de Gordon");
  if (normalized.includes("harley") || normalized.includes("harleen")) aliases.push("Harley", "Harley Quinn", "Harleen");
  if (normalized.includes("jack") || normalized.includes("napier")) aliases.push("Jack", "Jack Napier", "antigo Coringa");
  if (normalized.includes("neo coringa") || normalized.includes("marian")) aliases.push("Neo Coringa", "Marian", "nova Coringa");
  if (normalized.includes("gto")) aliases.push("GTO", "forca policial", "força policial", "policia de Gotham", "polícia de Gotham");
  if (normalized.includes("bruce") || normalized.includes("batman")) aliases.push("Batman", "Bruce", "Bruce Wayne");
  return unique(aliases.filter(Boolean));
}

function characterNeedsExplanation(character: string): boolean {
  const normalized = normalize(character);
  const familiar = ["batman", "bruce wayne", "coringa", "gotham", "jack napier"];
  return !familiar.some((term) => normalized === term || normalized.includes(term));
}

function explanationTermsForCharacter(character: string): string[] {
  const normalized = normalize(character);
  if (normalized.includes("asa noturna") || normalized.includes("dick")) return ["asa noturna", "dick", "antigo robin", "aliado", "parceiro", "familia", "família"];
  if (normalized.includes("batgirl") || normalized.includes("barbara")) return ["batgirl", "barbara", "aliada", "parceira", "familia", "família"];
  if (normalized.includes("gto")) return ["forca policial", "força policial", "policia", "polícia", "resgate", "gotham"];
  if (normalized.includes("harley") || normalized.includes("harleen")) return ["harley", "harleen", "parceira", "original"];
  if (normalized.includes("marian") || normalized.includes("neo coringa")) return ["neo coringa", "marian", "nova coringa", "segunda harley"];
  if (normalized.includes("gordon")) return ["gordon", "comissario", "comissário", "policia", "polícia"];
  return characterAliases(character);
}

function characterStoryLabel(character: string): string {
  const normalized = normalize(character);
  if (normalized.includes("asa noturna") || normalized.includes("dick")) return "Asa Noturna, o antigo Robin que conhece as falhas do Batman por dentro";
  if (normalized.includes("batgirl") || normalized.includes("barbara")) return "Batgirl, uma aliada que também cobra limites do Batman";
  if (normalized.includes("gto")) return "a GTO, a força policial criada para conter o caos sem depender só do Batman";
  if (normalized.includes("harley") || normalized.includes("harleen")) return "Harley, a pessoa que mais entende a diferença entre Jack e o Coringa";
  if (normalized.includes("marian") || normalized.includes("neo coringa")) return "Neo Coringa, a nova ameaça que usa o caos do antigo Coringa contra Gotham";
  if (normalized.includes("gordon")) return "Gordon, o elo entre a polícia, a cidade e a família do Batman";
  return character;
}
function eventNarrationCorpus(event: ComicNarrativeEvent, narrationCorpus: string): string {
  const localTerms = [event.title, event.action, event.motivation, ...event.actors, ...event.visualTargets].map(normalize).filter(Boolean);
  const sentences = narrationCorpus.split(/[.!?]+/g);
  return sentences.filter((sentence) => localTerms.some((term) => term && normalize(sentence).includes(term))).join(" ") || narrationCorpus;
}

export function evaluateComicStoryCoverageGate(input: {
  bible?: ComicNarrativeBibleInput | null;
  selectedEvents: ComicNarrativeEvent[];
  narrationText: string;
  selectedPageCount: number;
  maximumDurationSeconds?: number;
  targetWordsPerMinute?: number;
  minimumWordsPerSelectedPage?: number;
  allowCompactIfCriticalCoverage?: boolean;
}): ComicStoryCoverageGate {
  const maximumDurationSeconds = Math.min(180, Math.max(60, input.maximumDurationSeconds ?? 180));
  const targetWordsPerMinute = Math.min(190, Math.max(120, input.targetWordsPerMinute ?? 160));
  const minimumWordsPerSelectedPage = Math.max(4, input.minimumWordsPerSelectedPage ?? 7.2);
  const narrationCorpus = normalize(input.narrationText);
  const words = wordCount(input.narrationText);
  const selectedPageCount = Math.max(1, input.selectedPageCount);
  const maximumWords = Math.floor(maximumDurationSeconds * targetWordsPerMinute / 60);
  const minimumRecommendedWords = Math.min(maximumWords, Math.ceil(selectedPageCount * minimumWordsPerSelectedPage));

  const criticalFacts = input.selectedEvents.flatMap((event) =>
    event.facts.filter((fact) => fact.importance === "critical").map((fact) => ({ event, fact }))
  );
  const missingCriticalFacts = criticalFacts.filter(({ fact }) => !containsFact(narrationCorpus, fact));

  const importantCharacters = unique(input.selectedEvents.flatMap((event) => event.actors))
    .filter(characterNeedsExplanation);
  const unexplainedCharacters = importantCharacters.filter((character) => {
    const aliases = characterAliases(character);
    const mentioned = containsAny(narrationCorpus, aliases);
    const explained = containsAny(narrationCorpus, explanationTermsForCharacter(character));
    return !mentioned || !explained;
  });

  const causeConsequenceReviews = input.selectedEvents.map((event) => {
    const eventCorpus = normalize(eventNarrationCorpus(event, input.narrationText));
    const causeCovered = event.causes.length === 0 || event.causes.some((causeId) => {
      const cause = input.bible?.events.find((candidate) => candidate.eventId === causeId);
      return cause ? containsAny(eventCorpus, [cause.title, cause.action, ...cause.actors]) || containsAny(narrationCorpus, [cause.title, cause.action, ...cause.actors]) : true;
    }) || /porque|por isso|enquanto|quando|depois|antes|com isso|por esse motivo/.test(eventCorpus);
    const consequenceCovered = event.consequences.length === 0 || /entao|então|agora|com isso|por isso|isso faz|isso obriga|leva|provoca|consequencia|consequência/.test(eventCorpus);
    return { event, passed: causeCovered && consequenceCovered };
  });
  const failedCauseConsequence = causeConsequenceReviews.filter((review) => !review.passed);

  const issues: ComicStoryCoverageGateIssue[] = [
    ...missingCriticalFacts.map(({ event, fact }) => ({ code: "missing_critical_fact", severity: "blocker" as const, eventId: event.eventId, factId: fact.factId, detail: fact.statement })),
    ...unexplainedCharacters.map((character) => ({ code: "character_appeared_but_not_explained", severity: "blocker" as const, character, detail: `${character} aparece em eventos selecionados, mas nao recebeu contexto suficiente na narração.` })),
    ...failedCauseConsequence.map(({ event }) => ({ code: "weak_cause_consequence_bridge", severity: "warning" as const, eventId: event.eventId, detail: `${event.title} precisa conectar melhor causa e consequencia.` })),
  ];

  if (words < minimumRecommendedWords) {
    issues.push({ code: "narrative_density_too_low", severity: "blocker", detail: `Narração tem ${words} palavras para ${selectedPageCount} paginas selecionadas; recomendado minimo ${minimumRecommendedWords}.` });
  }

  const blockers = unique(issues.filter((issue) => issue.severity === "blocker").map((issue) => `${issue.code}${issue.eventId ? `:${issue.eventId}` : issue.character ? `:${issue.character}` : ""}`));
  const warnings = unique(issues.filter((issue) => issue.severity === "warning").map((issue) => `${issue.code}${issue.eventId ? `:${issue.eventId}` : ""}`));
  const criticalFactCoverage = criticalFacts.length ? (criticalFacts.length - missingCriticalFacts.length) / criticalFacts.length : 1;
  const explainedCharacterCoverage = importantCharacters.length ? (importantCharacters.length - unexplainedCharacters.length) / importantCharacters.length : 1;
  const causeConsequenceCoverage = causeConsequenceReviews.length ? (causeConsequenceReviews.length - failedCauseConsequence.length) / causeConsequenceReviews.length : 1;
  const wordDensityPerPage = words / selectedPageCount;
  const compactButCovered = words < minimumRecommendedWords && criticalFactCoverage === 1 && explainedCharacterCoverage === 1 && causeConsequenceCoverage >= 0.75 && input.allowCompactIfCriticalCoverage === true;
  const effectiveBlockers = compactButCovered ? blockers.filter((blocker) => !blocker.startsWith("narrative_density_too_low")) : blockers;
  return {
    gateId: "comic_story_coverage_gate_v1",
    status: effectiveBlockers.length === 0 ? "passed" : "blocked",
    mode: words < minimumRecommendedWords ? "too_compressed" : words >= maximumWords * 0.82 ? "expanded" : "compact_complete",
    wordCount: words,
    selectedPageCount,
    wordDensityPerPage: Math.round(wordDensityPerPage * 1000) / 1000,
    minimumRecommendedWords,
    criticalFactCoverage: Math.round(criticalFactCoverage * 1000) / 1000,
    coveredCriticalFactCount: criticalFacts.length - missingCriticalFacts.length,
    missingCriticalFactCount: missingCriticalFacts.length,
    explainedCharacterCoverage: Math.round(explainedCharacterCoverage * 1000) / 1000,
    explainedCharacterCount: importantCharacters.length - unexplainedCharacters.length,
    unexplainedCharacterCount: unexplainedCharacters.length,
    causeConsequenceCoverage: Math.round(causeConsequenceCoverage * 1000) / 1000,
    warnings,
    blockers: effectiveBlockers,
    issues,
  };
}

export function buildCoverageRichComicNarration(input: {
  event: ComicNarrativeEvent;
  bible?: ComicNarrativeBibleInput | null;
  maxAddedSentences?: number;
}): string {
  const { event } = input;
  const additions: string[] = [];
  const narrationCorpus = normalize(event.narrationText);
  const maxAddedSentences = Math.max(0, input.maxAddedSentences ?? 2);

  const missingCriticalStatements = event.facts
    .filter((fact) => fact.importance === "critical" && !containsFact(narrationCorpus, fact))
    .map((fact) => fact.statement);
  additions.push(...missingCriticalStatements.slice(0, 1));

  const importantActors = event.actors
    .filter(characterNeedsExplanation)
    .filter((actor) => !containsAny(narrationCorpus, characterAliases(actor)) || !containsAny(narrationCorpus, explanationTermsForCharacter(actor)));
  if (importantActors.length > 0) {
    additions.push(importantActors.slice(0, 3).map(characterStoryLabel).join(", ") + " importam aqui porque " + event.motivation.replace(/[.!?]+$/g, "") + ".");
  }

  const causeEvents = event.causes
    .map((causeId) => input.bible?.events.find((candidate) => candidate.eventId === causeId))
    .filter((candidate): candidate is ComicNarrativeEvent => Boolean(candidate));
  if (causeEvents.length > 0 && !/porque|por isso|depois|antes|enquanto|com isso/.test(narrationCorpus)) {
    additions.push("Isso vem de " + causeEvents[0]!.title.replace(/[.!?]+$/g, "") + ".");
  }

  const consequenceEvents = event.consequences
    .map((eventId) => input.bible?.events.find((candidate) => candidate.eventId === eventId))
    .filter((candidate): candidate is ComicNarrativeEvent => Boolean(candidate));
  if (consequenceEvents.length > 0 && !/entao|então|agora|com isso|por isso|leva|provoca|consequencia|consequência/.test(narrationCorpus)) {
    additions.push("A consequência é " + consequenceEvents[0]!.title.replace(/[.!?]+$/g, "") + ".");
  }

  return [event.narrationText, ...unique(additions).slice(0, maxAddedSentences)]
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

