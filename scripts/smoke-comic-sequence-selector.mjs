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

function makePanel(buildMockPanel, id, pageNumber, panelNumber, storyFunction, options = {}) {
  return buildMockPanel({
    panelId: id,
    pageNumber,
    panelNumber,
    readingOrder: panelNumber,
    sourcePagePath: join(projectRoot, "tmp", `sequence-page-${pageNumber}.jpg`),
    panelImagePath: join(projectRoot, "tmp", `sequence-panel-${id}.jpg`),
    panelImageSha256: `${id}-sha256`.padEnd(64, "c"),
    sequenceId: "sequence-selector-smoke",
    storyFunction,
    parentContext: {
      comicTitle: "Liga da Justica vs Godzilla vs Kong Test",
      issueTitle: "Sequence selector smoke",
      pageTitle: `Page ${pageNumber}`,
      parentTags: ["godzilla", "superman", "justice league", "kaiju", "comic"],
      parentEntities: ["Superman", "Godzilla", "Liga da Justica"]
    },
    localEvidence: {
      characters: options.characters ?? [
        { name: "Superman", confidence: 0.94, evidenceSource: "visual" },
        { name: "Godzilla", confidence: 0.94, evidenceSource: "visual" }
      ],
      actions: options.action ? [{ label: options.action, confidence: 0.94 }] : [],
      relationships: options.conflict === false ? [] : [{ type: "conflict", entities: ["Superman", "Godzilla"], confidence: 0.9 }],
      detectedText: options.text ? [options.text] : [],
      dialogue: options.dialogue ? [options.dialogue] : [],
      narrationBoxes: options.narrationBox ? [options.narrationBox] : [],
      soundEffects: options.sfx ? [options.sfx] : [],
      visualThemes: ["kaiju_crossover", "comic_story", "battle"],
      objects: [],
      locations: ["city"]
    },
    quality: { visualQualityScore: options.visualQualityScore ?? 90, cropability916Score: options.cropability916Score ?? 86, textHeavyRatio: options.textHeavyRatio ?? 0.18 },
    confidence: {
      segmentation: 0.9,
      characters: 0.9,
      actions: options.action ? 0.92 : 0.48,
      relationships: options.conflict === false ? 0.4 : 0.86,
      text: options.text || options.dialogue || options.narrationBox ? 0.88 : 0.52,
      overall: 0.9
    }
  });
}

async function main() {
  const beast = await importMediaBeast();
  const { buildMockPanel, mineComicStoryVault, buildComicArcProjectsFromMinerV2, selectComicNarrativeSequence } = beast;

  const panels = [
    makePanel(buildMockPanel, "weak-1", 1, 1, "reaction", { cropability916Score: 34, conflict: false }),
    makePanel(buildMockPanel, "seq-1", 2, 1, "setup", { dialogue: "Isso nao e so uma criatura.", text: "A Liga encara o impossivel" }),
    makePanel(buildMockPanel, "seq-2", 2, 2, "context", { narrationBox: "Quando Godzilla aparece, ate os herois hesitam." }),
    makePanel(buildMockPanel, "seq-3", 3, 1, "action", { action: "Superman charges toward Godzilla", sfx: "WHOOSH" }),
    makePanel(buildMockPanel, "seq-4", 3, 2, "climax", { action: "Godzilla atomic blast meets Superman", sfx: "KRAK" }),
    makePanel(buildMockPanel, "seq-5", 4, 1, "reaction", { dialogue: "Ele segurou o golpe?" }),
    makePanel(buildMockPanel, "seq-6", 4, 2, "reveal", { narrationBox: "Mas a luta so estava comecando." }),
    makePanel(buildMockPanel, "weak-2", 9, 1, "setup", { cropability916Score: 28, textHeavyRatio: 0.7, conflict: false })
  ];

  const pagesByNumber = new Map();
  for (const panel of panels) {
    const page = pagesByNumber.get(panel.pageNumber) ?? {
      sourceAssetId: `sequence-page-${panel.pageNumber}`,
      sourcePagePath: panel.sourcePagePath,
      sourceContentHash: `sequence-hash-${panel.pageNumber}`,
      pageNumber: panel.pageNumber,
      pageType: "story",
      indexable: true,
      parentContext: panel.parentContext,
      panels: []
    };
    page.panels.push(panel);
    pagesByNumber.set(panel.pageNumber, page);
  }

  const report = mineComicStoryVault({
    index: {
      version: 3,
      assetDirectory: join(projectRoot, "storage", "assets", "comics", "sequence-selector-test"),
      generatedAt: new Date().toISOString(),
      sourcePageCount: pagesByNumber.size,
      panelCount: panels.length,
      validPanelCount: panels.length,
      rejectedPanelCount: 0,
      sequenceCount: 1,
      pages: [...pagesByNumber.values()]
    },
    maxOpportunities: 12,
    minScore: 50
  });

  const batch = buildComicArcProjectsFromMinerV2({
    report,
    channelId: "channel-comic-sequence-selector-test",
    maxProjects: 1,
    titlePrefix: "Sequence Smoke"
  });
  const payload = batch.projects[0];
  assert(payload, "expected one project");
  const sequenceSelector = payload.renderBlueprintHints.sequenceSelector;
  assert(sequenceSelector?.selectorId === "comic_sequence_selector_v1", "expected sequence selector render hint");
  assert(sequenceSelector.selectedCandidate, "expected selected sequence candidate");
  assert(sequenceSelector.selectedCandidate.score >= 70, `expected usable sequence score, got ${sequenceSelector.selectedCandidate.score}`);
  assert(sequenceSelector.selectedCandidate.pageSequence.every((page, index, pages) => index === 0 || page >= pages[index - 1]), "sequence pages must be forward only");
  assert(sequenceSelector.selectedCandidate.panelSequence.includes("seq-3"), "sequence should include action panel");
  assert(sequenceSelector.selectedCandidate.panelSequence.includes("seq-4"), "sequence should include climax panel");
  assert(payload.qualityChecklist.some((item) => item.id === "comic_sequence_selector"), "checklist must expose sequence selector");
  assert(payload.renderBlueprintHints.panelBattleTest.beatResults.some((beat) => beat.candidates.some((candidate) => candidate.reasons.includes("inside_sequence_selector"))), "battle test should understand sequence candidates");

  const directReport = selectComicNarrativeSequence({
    arc: payload.renderBlueprintHints.storyArc,
    script: payload.renderBlueprintHints.script,
    panelsById: new Map(report.opportunities.flatMap((opportunity) => opportunity.panels.map((panel) => [panel.panelId, panel])))
  });
  assert(directReport.selectedCandidate, "direct selector should select a sequence");

  console.log(JSON.stringify({
    status: "completed",
    selectedSequenceId: sequenceSelector.selectedCandidate.id,
    score: sequenceSelector.selectedCandidate.score,
    pages: sequenceSelector.selectedCandidate.pageSequence,
    panelSequence: sequenceSelector.selectedCandidate.panelSequence,
    suggestedBeatPanelIds: sequenceSelector.selectedCandidate.suggestedBeatPanelIds,
    battleSelectedPanelIds: payload.renderBlueprintHints.panelBattleTest.selectedPanelIds,
    warnings: sequenceSelector.warnings
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});