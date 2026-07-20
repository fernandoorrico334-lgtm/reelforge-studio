import {
  buildComicCinematicNarrationPlan,
  buildComicPhraseVoicePlan,
  evaluateComicRetentionRewriteGate,
} from "../packages/media-beast/dist/index.js";

const source = [
  { beatId: "beat-1", role: "cold_open", literalFact: "Lex invadiu a Fortaleza e distraiu a Liga.", cinematicLine: "Enquanto a Liga defendia a Fortaleza, Lex ja conseguia exatamente a distracao que queria.", characterIntent: "Lex queria ganhar tempo", hiddenInformation: "a invasao escondia seu plano real", stakes: "a Liga perderia o controle da Fortaleza", sourcePages: [4, 5] },
  { beatId: "beat-2", role: "escalation", literalFact: "Um golpe atingiu a Caixa Materna e abriu o portal.", cinematicLine: "Quando um golpe atingiu a Caixa Materna, ja era tarde: o portal colocou dois mundos em rota de colisao.", characterIntent: "a Liga queria encerrar a batalha", hiddenInformation: "a Caixa Materna podia romper os mundos", stakes: "os Titas chegariam a Terra", sourcePages: [20, 21] },
  { beatId: "beat-3", role: "climax", literalFact: "Superman enfrentou Godzila.", cinematicLine: "Superman atacou primeiro, mas Godzila respondeu com uma forca que nem ele estava preparado para enfrentar.", characterIntent: "Superman queria proteger Metropolis", hiddenInformation: "Godzila podia derruba-lo", stakes: "Metropolis seria destruida", sourcePages: [29, 30] },
  { beatId: "beat-4", role: "resolution", literalFact: "A Liga reabriu o portal e devolveu os Titas.", cinematicLine: "Quando a Liga reabriu o portal, os Titas voltaram para casa e a guerra finalmente chegou ao fim.", characterIntent: "a Liga queria separar os mundos", hiddenInformation: "todos precisavam agir juntos", stakes: "a Terra nao sobreviveria a outra falha", sourcePages: [34, 35] },
];

const narration = buildComicCinematicNarrationPlan({ beats: source });
if (!narration.passed) throw new Error("Cinematic narration plan failed.");
const gate = evaluateComicRetentionRewriteGate({ beats: narration.beats.map((beat) => ({ ...beat })) });
if (gate.status !== "passed") throw new Error(`Retention gate failed: ${JSON.stringify(gate)}`);
const voice = buildComicPhraseVoicePlan({ beats: narration.beats.map((beat) => ({ beatId: beat.beatId, role: beat.role, narrationLine: beat.narrationLine })) });
if (!voice.passed) throw new Error("Phrase voice plan failed.");
if (voice.emotionalVariationCount < 4) throw new Error("Voice plan lacks emotional variation.");

console.log(JSON.stringify({
  status: "completed",
  narrationDirectorId: narration.directorId,
  retentionScore: gate.score,
  descriptiveBeatCount: gate.descriptiveBeatIds.length,
  phraseCount: voice.phraseCount,
  emotionalVariationCount: voice.emotionalVariationCount,
  emotions: [...new Set(voice.phrases.map((phrase) => phrase.emotion))],
}, null, 2));
