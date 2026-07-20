import { buildComicAudienceContextPlan } from "../packages/media-beast/dist/index.js";

const concepts = [
  { conceptId: "superman", labels: ["Superman"], kind: "character", audienceFamiliar: true },
  { conceptId: "lois", labels: ["Lois"], kind: "character", explanationTerms: ["casamento"] },
  { conceptId: "fortaleza", labels: ["Fortaleza da Solidão"], kind: "location", explanationTerms: ["base secreta"] },
  { conceptId: "caixa", labels: ["Caixa Materna"], kind: "artifact", explanationTerms: ["portal", "mundos"] },
];
const plan = buildComicAudienceContextPlan({
  beats: [
    { beatId: "hook", narrationLine: "Superman encontrou uma ameaça impossível. Como ele chegou até ali?", sourcePages: [30] },
    { beatId: "rewind", narrationLine: "Enquanto Superman preparava um pedido de casamento para Lois, Lex executava seu plano ao invadir a Fortaleza da Solidão, a base secreta do herói.", sourcePages: [4, 5] },
    { beatId: "artifact", narrationLine: "Quando a Caixa Materna abriu um portal entre mundos, o plano colocou todos em perigo.", sourcePages: [8] },
  ],
  concepts,
});
if (!plan.passed) throw new Error("Audience context plan failed: " + plan.warnings.join(","));
if (plan.contextCoverage !== 1) throw new Error("Every named concept must be explained on first contact.");
const rejected = buildComicAudienceContextPlan({
  beats: [{ beatId: "bad", narrationLine: "Ele entrou na Fortaleza da Solidão.", sourcePages: [4] }],
  concepts,
});
if (rejected.passed) throw new Error("Context gate accepted an ambiguous opening and unexplained location.");
if (!rejected.unexplainedConceptIds.includes("fortaleza")) throw new Error("Unexplained location was not reported.");
if (rejected.ambiguousOpeningCount !== 1) throw new Error("Ambiguous opening was not reported.");
console.log(JSON.stringify({
  directorId: plan.directorId,
  score: plan.score,
  contextCoverage: plan.contextCoverage,
  bridgeCoverage: plan.bridgeCoverage,
  storyPressureCoverage: plan.storyPressureCoverage,
  explainedConceptCount: plan.explainedConceptCount,
  rejectedExampleWarnings: rejected.warnings,
  status: "completed",
}, null, 2));
