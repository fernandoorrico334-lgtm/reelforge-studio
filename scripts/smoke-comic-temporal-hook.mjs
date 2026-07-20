import { buildComicTemporalHookPlan } from "../packages/media-beast/dist/index.js";

const plan = buildComicTemporalHookPlan({
  hookNarration: "Superman deu de cara com Godzila.",
  setupNarration: "ele estava prestes a pedir Lois em casamento. Enquanto isso, Lex invadia a Fortaleza da Solidão, a base secreta do herói. O que ele queria roubar ali?",
  visualPromiseTerms: ["Superman", "Godzila"],
  contextAnchors: [
    { entity: "Lois", explanationTerms: ["casamento"] },
    { entity: "Fortaleza da Solidão", explanationTerms: ["base secreta", "Superman", "herói"] },
  ],
  rewindLabel: "Doze horas antes",
  coldOpenDurationSeconds: 2.4,
  hookHeadline: "Superman deu de cara com Godzilla",
});
if (!plan.passed) throw new Error("Temporal hook plan failed: " + plan.warnings.join(","));
if (!plan.hookPromiseAligned) throw new Error("Hook narration is not aligned with the cold-open visual.");
if (!plan.temporalContextExplicit) throw new Error("Temporal rewind was not made explicit.");
if (!plan.contextAnchorsExplained) throw new Error("A named story entity was introduced without audience context.");
if (!plan.combinedNarration.includes("Doze horas antes")) throw new Error("Narration is missing the spoken rewind.");
if (!plan.combinedNarration.includes("base secreta")) throw new Error("The Fortress was not explained to a new viewer.");
if (plan.rewindAtSeconds !== plan.coldOpenDurationSeconds) throw new Error("Rewind caption is not synchronized with the visual transition.");
const rejected = buildComicTemporalHookPlan({
  hookNarration: "Superman encontrou Godzila.",
  setupNarration: "Lex invadiu a Fortaleza.",
  visualPromiseTerms: ["Superman", "Godzila"],
  contextAnchors: [{ entity: "Fortaleza", explanationTerms: ["base secreta"] }],
});
if (rejected.passed || !rejected.unexplainedContextAnchors.includes("Fortaleza")) throw new Error("The context gate accepted an unexplained location.");
console.log(JSON.stringify({
  directorId: plan.directorId,
  combinedNarration: plan.combinedNarration,
  hookHeadline: plan.hookHeadline,
  rewindHeadline: plan.rewindHeadline,
  rewindAtSeconds: plan.rewindAtSeconds,
  hookPromiseAligned: plan.hookPromiseAligned,
  temporalContextExplicit: plan.temporalContextExplicit,
  contextAnchorsExplained: plan.contextAnchorsExplained,
  status: "completed",
}, null, 2));
