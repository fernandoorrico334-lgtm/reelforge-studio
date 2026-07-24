import assert from "node:assert/strict";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const beast = await import(pathToFileURL(join(root, "packages/media-beast/dist/index.js")).href);

const productionGate = {
  gateId: "comic_one_click_production_gate_v1",
  status: "render_ready",
  score: 96,
  renderAllowed: true,
  minimumScoreToRender: 86,
  checks: [],
  blockers: [],
  warnings: [],
  directorNotes: []
};

const episode = {
  episodeId: "episode-god-mode",
  title: "Superman encontra Godzilla",
  hook: "Como o Superman foi parar diante do Godzilla?",
  context: "Doze horas antes, Lex usava Kong como distração para abrir caminho até a Caixa Materna.",
  payoff: "No fim, o portal abriu a passagem para uma ameaça muito maior.",
  nextEpisodeHook: "Agora a pergunta é: o Superman consegue segurar Godzilla sozinho?",
  estimatedDurationSeconds: 118,
  wordCount: 310,
  eventIds: ["e1", "e2", "e3", "e4", "e5"],
  issueNumbers: [1],
  pageReferences: [{ issueNumber: 1, pageNumbers: [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19] }],
  narration: "Como o Superman foi parar diante do Godzilla? Doze horas antes, Lex usava Kong como distração. Enquanto a Liga olhava para o caos, Lex queria a Caixa Materna. Então o portal abriu, e aquilo que parecia uma invasão virou uma armadilha muito maior. No fim, Superman entende que a batalha verdadeira acabou de começar.",
  narrationBeats: [1, 2, 3, 4, 5].map((index) => ({
    eventId: `e${index}`,
    narrationText: `Beat ${index} explica causa e consequência com alvo visual claro.`,
    sourcePages: [index + 4, index + 5, index + 6],
    visualTargets: index === 3 ? ["Caixa Materna"] : index === 5 ? ["Godzilla", "Superman"] : ["Lex", "Liga"]
  })),
  criticalFactIds: ["f1", "f2", "f3", "f4", "f5"],
  gate: { status: "passed", blockers: [], warnings: [] }
};

const panelMatchPlan = {
  matcherId: "comic_narration_panel_matcher_v1",
  generatedAt: new Date().toISOString(),
  beatCount: 5,
  matchedCount: 5,
  highConfidenceCount: 4,
  repeatedPanelCount: 0,
  averageScore: 84,
  warnings: [],
  matches: [1, 2, 3, 4, 5].map((index) => ({
    beatId: `beat-${index}`,
    eventId: `e${index}`,
    order: index,
    narrationText: `Beat ${index}`,
    selectedPanelId: `panel-${index}`,
    selectedPanelImagePath: `panel-${index}.png`,
    sourcePagePath: `page-${index}.png`,
    issueNumber: 1,
    pageNumber: index + 4,
    panelNumber: 1,
    readingOrder: index,
    normalizedCrop: { x: 0.1, y: 0.1, width: 0.8, height: 0.7 },
    score: index === 1 ? 66 : 88,
    confidence: index === 1 ? "medium" : "high",
    reasons: ["match"],
    warnings: [],
    zoomInstruction: {
      mode: index === 3 ? "object_focus" : index === 5 ? "action_focus" : "dialogue_focus",
      holdSeconds: 2.8,
      avoidCuttingDialogue: true,
      keepFullActionVisible: index === 5,
      preferredMotion: index === 5 ? "impact_punch_in" : "panel_pan"
    },
    alternatives: []
  }))
};

const good = beast.evaluateComicEpisodeGodModeGate({ episode, productionGate, panelMatchPlan });
assert.equal(good.gateId, "comic_episode_god_mode_gate_v1");
assert.equal(good.status, "god_ready");
assert.equal(good.renderCandidateAllowed, true);
assert.ok(good.score >= 90);

const bad = beast.evaluateComicEpisodeGodModeGate({
  episode: { ...episode, narration: "Algo aconteceu e a historia continua.", pageReferences: [{ issueNumber: 1, pageNumbers: [9, 8, 7] }] },
  productionGate: { ...productionGate, renderAllowed: false, status: "blocked", score: 45, blockers: ["story_material"] },
  panelMatchPlan: { ...panelMatchPlan, matchedCount: 2, highConfidenceCount: 0, repeatedPanelCount: 2, averageScore: 35, matches: panelMatchPlan.matches.map((match, index) => ({ ...match, selectedPanelId: index < 2 ? "same-panel" : null, score: 25, confidence: "missing" })) }
});
assert.equal(bad.status, "blocked");
assert.equal(bad.renderCandidateAllowed, false);
assert.ok(bad.blockers.includes("production_gate"));
assert.ok(bad.blockers.includes("no_panel_repetition"));

console.log(JSON.stringify({
  status: "completed",
  gateId: good.gateId,
  goodStatus: good.status,
  goodScore: good.score,
  badStatus: bad.status,
  badBlockers: bad.blockers,
  checks: good.checks.map((check) => ({ id: check.id, status: check.status, score: check.score }))
}, null, 2));
