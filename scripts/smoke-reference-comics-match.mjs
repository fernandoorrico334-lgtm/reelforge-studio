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

function makePanel(buildMockPanel, id, pageNumber, overrides = {}) {
  return buildMockPanel({
    panelId: id,
    pageNumber,
    panelNumber: pageNumber,
    readingOrder: pageNumber,
    sourcePagePath: join(projectRoot, "tmp", `comic-page-${pageNumber}.jpg`),
    panelImagePath: join(projectRoot, "tmp", `comic-panel-${id}.jpg`),
    panelImageSha256: `${id}-sha256`.padEnd(64, "a"),
    cropBounds: { x: 0, y: 0, width: 900, height: 1400 },
    sequenceId: "deadpool-venom:seq:1",
    previousPanelId: pageNumber > 1 ? `story-panel-${pageNumber - 1}` : null,
    nextPanelId: pageNumber < 8 ? `story-panel-${pageNumber + 1}` : null,
    storyFunction: overrides.storyFunction ?? "action",
    localEvidence: overrides.localEvidence ?? {
      characters: [
        { name: "Deadpool", confidence: 0.92, evidenceSource: "visual" },
        { name: "Venom", confidence: 0.88, evidenceSource: "visual" }
      ],
      actions: [{ label: "conflict", confidence: 0.86 }],
      relationships: [{ type: "conflict", entities: ["deadpool", "venom"], confidence: 0.9 }],
      detectedText: [],
      dialogue: [],
      narrationBoxes: [],
      soundEffects: ["KRASH"],
      visualThemes: ["rivalry", "chaos", "comics_source"],
      objects: [],
      locations: []
    },
    ...overrides
  });
}

async function main() {
  const beast = await importMediaBeast();
  const { buildMockPanel, matchReferenceVideoToComicsStories } = beast;

  const analysis = {
    sourceDurationSeconds: 22,
    outputDurationSeconds: 40,
    probeMethod: "metadata",
    platform: "local",
    title: "Deadpool brigando com Venom",
    themeSummary: "Deadpool enfrenta Venom em uma cena caotica com humor e violencia cartunesca.",
    contextKeywords: ["deadpool", "venom", "briga", "rivalidade", "quadrinhos"],
    mainScenes: [
      {
        sceneId: "scene-hook",
        order: 1,
        role: "hook",
        startSeconds: 0,
        endSeconds: 4,
        label: "gancho",
        energy: "high",
        focusEntity: "Deadpool",
        focusAction: "confronta Venom",
        visualHint: "Deadpool e Venom no mesmo quadro em conflito",
        narrationAngle: "o encontro vira caos instantaneo"
      },
      {
        sceneId: "scene-climax",
        order: 2,
        role: "climax",
        startSeconds: 16,
        endSeconds: 22,
        label: "climax",
        energy: "high",
        focusEntity: "Venom",
        focusAction: "ataque simbionte",
        visualHint: "pico visual de conflito",
        narrationAngle: "a HQ vende a pancada pelo exagero visual"
      }
    ],
    narrativeArc: ["gancho", "contexto", "climax"],
    analysisNotes: [],
    contentIntelligence: {
      headline: "Deadpool vs Venom",
      summary: "Conflito caotico entre Deadpool e Venom.",
      narrativeBrief: "O video referencia mostra Deadpool brigando com Venom; a HQ precisa sustentar conflito, caos e presenca dos dois no quadro.",
      narrativeHook: "Quando Deadpool encontra Venom, a cena vira uma piada violenta em forma de painel.",
      curiosityAngle: "por que esse encontro funciona tao bem em quadrinhos",
      domain: "comics_superhero",
      entities: [
        { id: "deadpool", name: "Deadpool", type: "character", franchise: "Marvel", confidence: "high", aliases: ["wade wilson"] },
        { id: "venom", name: "Venom", type: "character", franchise: "Marvel", confidence: "high", aliases: ["simbionte"] }
      ],
      actions: [{ id: "fight", label: "conflito", verb: "briga", confidence: "high" }],
      setting: "painel de quadrinho",
      mood: "chaotic_hype",
      differentiationGoals: ["usar paineis locais com evidencia visual direta"],
      sceneInsights: [],
      visualSearchQueries: [],
      comfyPromptFragments: [],
      analysisVersion: "phase2-v2"
    },
    researchDossier: null
  };

  const themeAnalysis = {
    entities: ["Deadpool", "Venom"],
    primaryEntity: "Deadpool",
    secondaryEntities: ["Venom"],
    narrativeThemes: ["rivalry", "chaos"],
    relationshipType: "hero_vs_villain",
    visualMotifs: ["conflict", "comics_source"],
    recommendedAssetSignals: ["deadpool", "venom", "conflict"],
    disallowedAssetSignals: ["advertisement", "catalog"],
    themeLabels: ["Deadpool vs Venom"]
  };

  const goodPanels = [
    makePanel(buildMockPanel, "story-panel-1", 1, { storyFunction: "action" }),
    makePanel(buildMockPanel, "story-panel-2", 2, { storyFunction: "context" }),
    makePanel(buildMockPanel, "story-panel-3", 3, { storyFunction: "dialogue" }),
    makePanel(buildMockPanel, "story-panel-4", 4, { storyFunction: "relationship" }),
    makePanel(buildMockPanel, "story-panel-5", 5, { storyFunction: "action" }),
    makePanel(buildMockPanel, "story-panel-6", 6, { storyFunction: "transformation" }),
    makePanel(buildMockPanel, "story-panel-7", 7, { storyFunction: "climax" }),
    makePanel(buildMockPanel, "story-panel-8", 8, { storyFunction: "reaction" })
  ];
  const badPanel = makePanel(buildMockPanel, "off-topic-panel", 99, {
    sequenceId: "off-topic:seq:1",
    storyFunction: "context",
    localEvidence: {
      characters: [{ name: "Batman", confidence: 0.95, evidenceSource: "visual" }],
      actions: [{ label: "standing", confidence: 0.8 }],
      relationships: [],
      detectedText: [],
      dialogue: [],
      narrationBoxes: [],
      soundEffects: [],
      visualThemes: ["generic"],
      objects: [],
      locations: []
    }
  });

  const report = matchReferenceVideoToComicsStories({
    analysis,
    themeAnalysis,
    panels: [...goodPanels, badPanel]
  });

  assert(report.brief.leadEntity === "Deadpool", "expected Deadpool as lead entity");
  assert(report.bestStory, "expected best story");
  assert(report.canUseComicsStory, "expected usable story match");
  assert(report.bestStory.beats.length >= 5, "expected enough selected beats");
  assert(report.bestStory.coverageRoles.includes("hook"), "expected hook coverage");
  assert(report.bestStory.coverageRoles.includes("climax"), "expected climax coverage");
  assert(!report.bestStory.panelIds.includes("off-topic-panel"), "off-topic panel should not be selected");

  console.log(
    JSON.stringify(
      {
        status: "completed",
        bestStoryId: report.bestStory.storyId,
        bestStoryScore: report.bestStory.score,
        selectedPanelCount: report.bestStory.beats.length,
        selectedPanels: report.bestStory.panelIds,
        canUseComicsStory: report.canUseComicsStory
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
