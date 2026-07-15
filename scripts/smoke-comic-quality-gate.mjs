import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");

async function importMediaBeast() {
  return import(pathToFileURL(join(projectRoot, "packages/media-beast/dist/index.js")).href);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function makeScene(order, role) {
  return {
    order,
    role,
    panelId: `gate-panel-${order}`,
    panelImagePath: join(projectRoot, "tmp", `gate-panel-${order}.jpg`),
    pageNumber: order,
    durationSeconds: order === 3 ? 8 : 7.5,
    narration: order === 1
      ? "Esse confronto parece so mais uma pancadaria, mas a pagina esconde a virada que muda toda a luta."
      : order === 2
        ? "Antes do golpe principal, o vilao domina o quadro e prende a atencao no perigo real."
        : order === 3
          ? "Quando o impacto acontece, a cena deixa de ser resumo e vira o ponto alto do short."
          : "E o payoff vem quando a composicao mostra quem saiu por cima e por que isso importa.",
    caption: "VIRADA BRUTAL",
    motion: role === "climax" ? "impact_cut" : "punch_zoom",
    transition: role === "climax" ? "flash" : "cut",
    panelVisualEvidence: {
      storyFunction: role === "climax" ? "climax" : "action",
      quality: { visualQualityScore: 90, cropability916Score: 88, textHeavyRatio: 0.1 },
      confidence: { characters: 0.9, actions: 0.88, relationships: 0.84, text: 0.7, overall: 0.88 },
      visualFlags: { venomVisible: true, spiderManVisible: true, blackSuitVisible: false, symbioteVisible: true, duoVisible: true, doctorStrangeVisible: false, unrelatedCharacterVisible: false },
      evidenceCounts: { characters: 2, actions: 1, dialogue: 1, narrationBoxes: 0, soundEffects: role === "climax" ? 1 : 0, detectedText: 1 },
      strongestActionLabel: role === "climax" ? "impact attack" : "threat pose",
      strongestRelationshipType: "conflict",
      textSamples: ["impacto", "virada"]
    }
  };
}

function makeShort(overrides = {}) {
  const scenes = [
    makeScene(1, "hook"),
    makeScene(2, "context"),
    makeScene(3, "climax"),
    makeScene(4, "payoff")
  ];
  const narrationScript = scenes.map((scene) => scene.narration).join(" ");
  return {
    id: "quality-gate-strong-short",
    title: "Luta: virada visual forte",
    sourceOpportunityId: "quality-gate-opportunity",
    category: "fight",
    score: 91,
    estimatedDurationSeconds: scenes.reduce((sum, scene) => sum + scene.durationSeconds, 0),
    scenes,
    narrationScript,
    captionStyleId: "sports_hype",
    cinematicPresetId: "action",
    audioMasteringPresetId: "viral_fast_cut",
    musicPresetId: "viral_fast_cut",
    renderFormat: "vertical_9_16",
    approvalChecklist: [],
    qualityReport: {
      panelCoverage: 1,
      hasHook: true,
      hasClimax: true,
      narrationLineCount: scenes.length,
      warnings: []
    },
    warnings: [],
    sourcePages: [1, 2, 3, 4],
    productionRank: 1,
    digestReasons: ["test"],
    zoomPlan: [],
    ...overrides
  };
}

async function main() {
  const { evaluateComicShortQualityGate } = await importMediaBeast();

  const strong = makeShort();
  const strongGate = evaluateComicShortQualityGate(strong);
  assert(strongGate.status !== "rejected", `expected strong short to pass, got ${strongGate.blockers.join(",")}`);
  assert(strongGate.durationSeconds >= 30, "strong short must satisfy 30s minimum");
  assert(strongGate.hasVisualAction, "strong short must have visual action");
  assert(strongGate.hasCharacterEvidence, "strong short must have character evidence");
  assert(strongGate.hasConflictOrPayoff, "strong short must have conflict/payoff");
  assert(strongGate.hasCleanNarration, "strong short narration must be clean");

  const badScenes = strong.scenes.map((scene) => ({ ...scene, panelVisualEvidence: undefined, durationSeconds: 2 }));
  const bad = makeShort({
    id: "quality-gate-bad-short",
    estimatedDurationSeconds: 8,
    scenes: badScenes,
    narrationScript: "Essa sequencia tem forca visual para short. Poucos paineis, leitura rapida. 222222 ÃÃÃ xxxxzzzzzzzzzzzzzzzzzz.",
    qualityReport: {
      panelCoverage: 0.25,
      hasHook: true,
      hasClimax: false,
      narrationLineCount: badScenes.length,
      warnings: ["missing_panel_image_path"]
    }
  });
  const badGate = evaluateComicShortQualityGate(bad);
  assert(badGate.status === "rejected", "bad short must be rejected");
  assert(badGate.blockers.some((blocker) => blocker.startsWith("duration_below_30s")), "bad short must fail duration gate");
  assert(badGate.blockers.some((blocker) => blocker.startsWith("narration_not_clean")), "bad short must fail narration gate");

  console.log(JSON.stringify({
    status: "completed",
    strongGate,
    rejectedBlockers: badGate.blockers,
    minDurationSeconds: strongGate.minDurationSeconds
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
