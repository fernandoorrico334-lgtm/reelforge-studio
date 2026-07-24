import {
  buildCoverageRichComicNarration,
  evaluateComicStoryCoverageGate,
} from "../packages/media-beast/dist/index.js";

const eventA = {
  eventId: "jack-medicine-choice",
  issueNumber: 1,
  beatIds: ["saga-beat-1"],
  pageNumbers: [7, 8, 9, 10],
  title: "Jack tenta provar que pode salvar Gotham",
  action: "Jack Napier usa remédios para controlar o Coringa e tenta expor os excessos do Batman.",
  motivation: "o público precisa entender que Jack não virou outra pessoa do nada; ele está medicado e lutando contra o Coringa por dentro",
  actors: ["Jack Napier", "Batman", "Gotham"],
  visualTargets: ["Jack segurando os remédios", "Batman cercado pela polícia"],
  facts: [{
    factId: "jack-medicated",
    statement: "Jack Napier, antigo Coringa, está medicado e tenta provar que ainda existe alguém lúcido dentro dele.",
    importance: "critical",
    requiredNarrationTerms: [["Jack Napier", "Jack"], ["medicado", "remédios"], ["Coringa"]],
  }],
  causes: [],
  consequences: ["dick-family-conflict"],
  narrationText: "Jack tenta mostrar que Gotham pode ser salva sem o Batman no controle.",
};

const eventB = {
  eventId: "dick-family-conflict",
  issueNumber: 2,
  beatIds: ["saga-beat-2"],
  pageNumbers: [15, 16, 17, 18],
  title: "A família do Batman começa a questionar Bruce",
  action: "Asa Noturna e Batgirl confrontam o jeito como Batman colocou Gotham e seus aliados em risco.",
  motivation: "a tensão familiar mostra que o problema não é só Jack; Bruce também precisa responder pelo que fez",
  actors: ["Asa Noturna", "Batgirl", "Batman"],
  visualTargets: ["Asa Noturna discutindo com Batman", "Batgirl observando Bruce"],
  facts: [{
    factId: "dick-was-robin",
    statement: "Asa Noturna é Dick Grayson, antigo Robin, e sua crítica pesa porque vem da própria família do Batman.",
    importance: "critical",
    requiredNarrationTerms: [["Asa Noturna", "Dick"], ["Robin", "família", "aliado"], ["Batman", "Bruce"]],
  }],
  causes: ["jack-medicine-choice"],
  consequences: ["gto-final-plan"],
  narrationText: "Asa Noturna e Batgirl não estão atacando Batman por fora. Eles conhecem Bruce por dentro e enxergam o preço das escolhas dele.",
};

const eventC = {
  eventId: "gto-final-plan",
  issueNumber: 3,
  beatIds: ["saga-beat-3"],
  pageNumbers: [22, 23, 24, 25],
  title: "A GTO tenta salvar civis enquanto a cidade desaba",
  action: "GTO, Gordon, Batgirl e Asa Noturna dividem resgate, combate e contenção para impedir que Gotham vire uma guerra sem controle.",
  motivation: "o espectador precisa entender quem segura a cidade enquanto Batman e Jack correm para o confronto principal",
  actors: ["GTO", "Gordon", "Batgirl", "Asa Noturna"],
  visualTargets: ["GTO retirando civis", "Gordon coordenando a polícia"],
  facts: [{
    factId: "gto-role",
    statement: "A GTO é a força policial de Gotham tentando salvar civis enquanto os heróis impedem o colapso final.",
    importance: "critical",
    requiredNarrationTerms: [["GTO", "força policial", "polícia"], ["civis", "Gotham"], ["salvar", "resgate", "proteger"]],
  }],
  causes: ["dick-family-conflict"],
  consequences: [],
  narrationText: "A GTO entra para impedir que a cidade pague o preço sozinha.",
};

const bible = { events: [eventA, eventB, eventC] };
const selectedEvents = [eventA, eventB, eventC];
const weakNarration = "Jack virou bom. Batman foi questionado. A cidade entrou em guerra.";
const blocked = evaluateComicStoryCoverageGate({
  bible,
  selectedEvents,
  narrationText: weakNarration,
  selectedPageCount: 45,
  minimumWordsPerSelectedPage: 4,
});

if (blocked.status !== "blocked") throw new Error("Expected weak narration to be blocked.");
if (!blocked.blockers.some((blocker) => blocker.startsWith("missing_critical_fact"))) throw new Error("Missing fact gate did not trigger.");
if (!blocked.blockers.some((blocker) => blocker.startsWith("character_appeared_but_not_explained"))) throw new Error("Character explanation gate did not trigger.");
if (!blocked.blockers.includes("narrative_density_too_low")) throw new Error("Narrative density gate did not trigger.");

const enrichedNarration = selectedEvents
  .map((event) => buildCoverageRichComicNarration({ event, bible, maxAddedSentences: 3 }))
  .join(" ")
  + " Por isso, cada decisão empurra a próxima: Jack tenta controlar o Coringa, a família de Batman cobra Bruce, e a GTO segura Gotham para que os civis sobrevivam. Com isso, a história não pula consequência; ela mostra quem age, por que age e o que muda depois.";

const passed = evaluateComicStoryCoverageGate({
  bible,
  selectedEvents,
  narrationText: enrichedNarration,
  selectedPageCount: 18,
  minimumWordsPerSelectedPage: 4,
  allowCompactIfCriticalCoverage: true,
});

if (passed.status !== "passed") throw new Error("Expected enriched narration to pass: " + passed.blockers.join(", "));
if (passed.criticalFactCoverage !== 1) throw new Error("Critical facts were not fully covered.");
if (passed.explainedCharacterCoverage !== 1) throw new Error("Characters were not fully explained.");

console.log(JSON.stringify({
  status: "completed",
  blockedStatus: blocked.status,
  blockedBlockers: blocked.blockers,
  passedStatus: passed.status,
  criticalFactCoverage: passed.criticalFactCoverage,
  explainedCharacterCoverage: passed.explainedCharacterCoverage,
  causeConsequenceCoverage: passed.causeConsequenceCoverage,
  wordDensityPerPage: passed.wordDensityPerPage,
}, null, 2));
