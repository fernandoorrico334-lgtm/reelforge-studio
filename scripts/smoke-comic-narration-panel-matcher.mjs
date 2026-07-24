import assert from "node:assert/strict";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const beast = await import(pathToFileURL(join(root, "packages/media-beast/dist/index.js")).href);

function panel(panelId, pageNumber, panelNumber, storyFunction, evidence) {
  return {
    panelId,
    pageNumber,
    panelNumber,
    readingOrder: pageNumber * 10 + panelNumber,
    sourcePagePath: `storage/assets/comics/mock/page-${pageNumber}.png`,
    panelImagePath: `storage/assets/comics/mock/panel-${panelId}.png`,
    panelImageSha256: `sha-${panelId}`,
    cropBounds: { x: 0.1, y: 0.1, width: 0.8, height: 0.7 },
    parentContext: { parentTags: [], parentEntities: [], comicTitle: "Mock Comic", issueTitle: "Issue 1" },
    localEvidence: {
      characters: evidence.characters ?? [],
      actions: (evidence.actions ?? []).map((label) => ({ label, confidence: 0.9 })),
      relationships: evidence.relationships ?? [],
      detectedText: evidence.detectedText ?? [],
      dialogue: evidence.dialogue ?? [],
      narrationBoxes: evidence.narrationBoxes ?? [],
      soundEffects: evidence.soundEffects ?? [],
      visualThemes: evidence.visualThemes ?? [],
      objects: evidence.objects ?? [],
      locations: evidence.locations ?? []
    },
    storyFunction,
    sequenceId: "seq-1",
    previousPanelId: null,
    nextPanelId: null,
    valid: true,
    rejectReason: null,
    quality: { visualQualityScore: 88, cropability916Score: 86, textHeavyRatio: 0.12 },
    confidence: { segmentation: 0.9, characters: 0.9, actions: 0.8, relationships: 0.7, text: 0.75, overall: 0.86 },
    warnings: [],
    cropAreaRatio: 0.42,
    estimatedPanelCount: 4,
    estimatedGutterCount: 3,
    isWholePageFallback: false,
    isActualPanelCrop: true,
    visualFlags: {
      venomVisible: false,
      spiderManVisible: false,
      blackSuitVisible: false,
      symbioteVisible: false,
      duoVisible: false,
      doctorStrangeVisible: false,
      unrelatedCharacterVisible: false
    },
    evidenceTier: "direct_evidence"
  };
}

const index = {
  version: 3,
  assetDirectory: "storage/assets/comics/mock",
  generatedAt: new Date().toISOString(),
  sourcePageCount: 10,
  panelCount: 4,
  validPanelCount: 4,
  rejectedPanelCount: 0,
  sequenceCount: 1,
  pages: [
    {
      sourceAssetId: "page-5",
      sourcePagePath: "storage/assets/comics/mock/page-5.png",
      sourceContentHash: "page-5-sha",
      pageNumber: 5,
      pageType: "story",
      indexable: true,
      parentContext: { parentTags: [], parentEntities: [], comicTitle: "Mock Comic", issueTitle: "Issue 1" },
      panels: [
        panel("caixa-materna", 5, 1, "reveal", { objects: ["Caixa Materna"], detectedText: ["Caixa Materna"], visualThemes: ["portal", "energia"] }),
        panel("clark-rosto", 5, 2, "reaction", { characters: [{ name: "Clark", confidence: 0.92, evidenceSource: "visual" }], detectedText: ["Lois"], visualThemes: ["reacao"] })
      ]
    },
    {
      sourceAssetId: "page-8",
      sourcePagePath: "storage/assets/comics/mock/page-8.png",
      sourceContentHash: "page-8-sha",
      pageNumber: 8,
      pageType: "story",
      indexable: true,
      parentContext: { parentTags: [], parentEntities: [], comicTitle: "Mock Comic", issueTitle: "Issue 1" },
      panels: [
        panel("mutano-gorila", 8, 1, "transformation", { characters: [{ name: "Mutano", confidence: 0.95, evidenceSource: "visual" }], actions: ["transformou em gorila gigante"], visualThemes: ["transformacao", "gorila gigante"] }),
        panel("batman-dialogo", 8, 2, "dialogue", { characters: [{ name: "Batman", confidence: 0.95, evidenceSource: "visual" }], dialogue: ["Precisamos agir agora"], detectedText: ["Batman"] })
      ]
    }
  ]
};

const plan = beast.buildComicNarrationPanelMatchPlan({
  issueIndexes: [{ issueNumber: 1, assetDirectory: index.assetDirectory, index }],
  beats: [
    {
      beatId: "beat-1",
      eventId: "event-caixa",
      order: 1,
      issueNumber: 1,
      narrationText: "A Caixa Materna revelou que o plano era muito maior.",
      sourcePages: [5],
      visualTargets: ["Caixa Materna"]
    },
    {
      beatId: "beat-2",
      eventId: "event-mutano",
      order: 2,
      issueNumber: 1,
      narrationText: "Mutano se tornou um gorila gigante para abrir caminho.",
      sourcePages: [8],
      visualTargets: ["Mutano", "gorila gigante"]
    }
  ]
});

assert.equal(plan.matcherId, "comic_narration_panel_matcher_v1");
assert.equal(plan.beatCount, 2);
assert.equal(plan.matchedCount, 2);
assert.equal(plan.repeatedPanelCount, 0);
assert.equal(plan.matches[0].selectedPanelId, "caixa-materna");
assert.equal(plan.matches[1].selectedPanelId, "mutano-gorila");
assert.ok(plan.matches[0].score >= 70, "Caixa Materna should be high confidence");
assert.ok(plan.matches[1].score >= 70, "Mutano transformation should be high confidence");

console.log(JSON.stringify({
  status: "completed",
  matcherId: plan.matcherId,
  beatCount: plan.beatCount,
  matchedCount: plan.matchedCount,
  highConfidenceCount: plan.highConfidenceCount,
  repeatedPanelCount: plan.repeatedPanelCount,
  selections: plan.matches.map((match) => ({
    eventId: match.eventId,
    selectedPanelId: match.selectedPanelId,
    pageNumber: match.pageNumber,
    score: match.score,
    confidence: match.confidence,
    zoomMode: match.zoomInstruction.mode
  }))
}, null, 2));
