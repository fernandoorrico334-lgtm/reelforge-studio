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

function makePanel(buildMockPanel, id, pageNumber, storyFunction, localEvidence, overrides = {}) {
  return buildMockPanel({
    panelId: id,
    pageNumber,
    panelNumber: Number(id.split("-").at(-1) ?? pageNumber),
    readingOrder: pageNumber * 10 + Number(id.split("-").at(-1) ?? 1),
    sourcePagePath: join(projectRoot, "tmp", `comic-story-page-${pageNumber}.jpg`),
    panelImagePath: join(projectRoot, "tmp", `comic-story-panel-${id}.jpg`),
    panelImageSha256: `${id}-sha256`.padEnd(64, "b"),
    sequenceId: overrides.sequenceId ?? `story-seq-${Math.ceil(pageNumber / 3)}`,
    previousPanelId: overrides.previousPanelId ?? null,
    nextPanelId: overrides.nextPanelId ?? null,
    storyFunction,
    parentContext: {
      comicTitle: "Deadpool vs Venom Test Issue",
      issueTitle: "A Piada do Simbionte",
      pageTitle: `Page ${pageNumber}`,
      parentTags: ["deadpool", "venom", "comic"],
      parentEntities: ["deadpool", "venom"]
    },
    localEvidence,
    quality: { visualQualityScore: 86, cropability916Score: 88, textHeavyRatio: 0.18 },
    confidence: {
      segmentation: 0.9,
      characters: 0.9,
      actions: 0.86,
      relationships: 0.84,
      text: 0.7,
      overall: 0.88
    },
    ...overrides
  });
}

async function main() {
  const beast = await importMediaBeast();
  const { buildMockPanel, mineComicStoryVault } = beast;

  const fightEvidence = {
    characters: [
      { name: "Deadpool", confidence: 0.94, evidenceSource: "visual" },
      { name: "Venom", confidence: 0.9, evidenceSource: "visual" }
    ],
    actions: [{ label: "attack punch conflict", confidence: 0.9 }],
    relationships: [{ type: "conflict", entities: ["deadpool", "venom"], confidence: 0.9 }],
    detectedText: [],
    dialogue: ["Isso vai doer mais em voce do que em mim."],
    narrationBoxes: [],
    soundEffects: ["KRASH", "BOOM"],
    visualThemes: ["rivalry", "chaos", "comics_source"],
    objects: [],
    locations: ["alley"]
  };

  const relationshipEvidence = {
    characters: [
      { name: "Deadpool", confidence: 0.9, evidenceSource: "visual" },
      { name: "Venom", confidence: 0.84, evidenceSource: "visual" }
    ],
    actions: [{ label: "conversation uneasy alliance", confidence: 0.82 }],
    relationships: [{ type: "conversation", entities: ["deadpool", "venom"], confidence: 0.82 }],
    detectedText: ["We are not friends."],
    dialogue: ["A gente devia ter combinado uma palavra de seguranca."],
    narrationBoxes: ["Naquele momento, os dois entendem que precisam cooperar."],
    soundEffects: [],
    visualThemes: ["relationship", "partnership", "comics_source"],
    objects: [],
    locations: ["rooftop"]
  };

  const revealEvidence = {
    characters: [{ name: "Venom", confidence: 0.92, evidenceSource: "visual" }],
    actions: [{ label: "transformation reveal", confidence: 0.9 }],
    relationships: [{ type: "host_symbiote", entities: ["venom"], confidence: 0.86 }],
    detectedText: ["The secret origin"],
    dialogue: [],
    narrationBoxes: ["A origem do simbionte era mais antiga do que parecia."],
    soundEffects: ["SHRAK"],
    visualThemes: ["origin", "symbiosis", "transformation", "comics_source"],
    objects: ["symbiote"],
    locations: ["lab"]
  };

  const panels = [
    makePanel(buildMockPanel, "fight-1", 1, "setup", fightEvidence, { sequenceId: "fight-seq" }),
    makePanel(buildMockPanel, "fight-2", 2, "action", fightEvidence, { sequenceId: "fight-seq" }),
    makePanel(buildMockPanel, "fight-3", 3, "climax", fightEvidence, { sequenceId: "fight-seq" }),
    makePanel(buildMockPanel, "rel-1", 4, "dialogue", relationshipEvidence, { sequenceId: "relationship-seq" }),
    makePanel(buildMockPanel, "rel-2", 5, "context", relationshipEvidence, { sequenceId: "relationship-seq" }),
    makePanel(buildMockPanel, "rel-3", 6, "reaction", relationshipEvidence, { sequenceId: "relationship-seq" }),
    makePanel(buildMockPanel, "reveal-1", 7, "reveal", revealEvidence, { sequenceId: "reveal-seq" }),
    makePanel(buildMockPanel, "reveal-2", 8, "transformation", revealEvidence, { sequenceId: "reveal-seq" }),
    makePanel(buildMockPanel, "reveal-3", 9, "reaction", revealEvidence, { sequenceId: "reveal-seq" })
  ];

  const pages = panels.map((panel) => ({
    sourceAssetId: `page-${panel.pageNumber}`,
    sourcePagePath: panel.sourcePagePath,
    sourceContentHash: `hash-${panel.pageNumber}`,
    pageNumber: panel.pageNumber,
    pageType: "story",
    indexable: true,
    parentContext: panel.parentContext,
    panels: [panel]
  }));

  const index = {
    version: 3,
    assetDirectory: join(projectRoot, "storage", "assets", "comics", "test-issue"),
    generatedAt: new Date().toISOString(),
    sourcePageCount: pages.length,
    panelCount: panels.length,
    validPanelCount: panels.length,
    rejectedPanelCount: 0,
    sequenceCount: 3,
    pages
  };

  const report = mineComicStoryVault({ index, maxOpportunities: 20, minScore: 50 });
  const categories = new Set(report.opportunities.map((opportunity) => opportunity.category));

  assert(report.opportunities.length >= 4, "expected multiple short opportunities");
  assert(categories.has("fight"), "expected fight opportunity");
  assert(categories.has("relationship"), "expected relationship opportunity");
  assert(categories.has("curiosity") || categories.has("reveal"), "expected curiosity or reveal opportunity");
  assert(report.characterMap.some((entry) => entry.name === "deadpool"), "expected character map to include deadpool");
  assert(report.topOpportunities[0].panelIds.length > 0, "top opportunity should include panels");
  assert(report.candidateFirst && report.requiresManualApproval, "expected candidate-first approval gate");

  console.log(JSON.stringify({
    status: "completed",
    opportunityCount: report.opportunities.length,
    categories: [...categories],
    topTitle: report.topOpportunities[0].title,
    topScore: report.topOpportunities[0].score,
    topPanels: report.topOpportunities[0].panelIds,
    candidateFirst: report.candidateFirst
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
