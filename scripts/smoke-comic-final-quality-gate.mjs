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

function makePanel(buildMockPanel, id, pageNumber, storyFunction, options = {}) {
  return buildMockPanel({
    panelId: id,
    pageNumber,
    panelNumber: pageNumber,
    readingOrder: pageNumber,
    sourcePagePath: join(projectRoot, "tmp", `final-qa-page-${pageNumber}.jpg`),
    panelImagePath: join(projectRoot, "tmp", `final-qa-panel-${id}.jpg`),
    panelImageSha256: `${id}-sha256`.padEnd(64, "c"),
    sequenceId: "final-qa-godzilla-seq",
    storyFunction,
    parentContext: {
      comicTitle: "Liga da Justica vs Godzilla vs Kong Test",
      issueTitle: "Teste Final QA",
      pageTitle: `Page ${pageNumber}`,
      parentTags: ["godzilla", "superman", "justice league", "kaiju", "comic"],
      parentEntities: ["Superman", "Godzilla", "Liga da Justica"]
    },
    localEvidence: {
      characters: [
        { name: "Superman", confidence: 0.95, evidenceSource: "visual" },
        { name: "Godzilla", confidence: 0.96, evidenceSource: "visual" }
      ],
      actions: [{ label: options.action ?? "Godzilla impact against Superman", confidence: 0.94 }],
      relationships: [{ type: "conflict", entities: ["Superman", "Godzilla"], confidence: 0.92 }],
      detectedText: options.text ? [options.text] : [],
      dialogue: options.dialogue ? [options.dialogue] : [],
      narrationBoxes: options.narrationBox ? [options.narrationBox] : [],
      soundEffects: options.sfx ? [options.sfx] : ["BOOM"],
      visualThemes: ["kaiju_crossover", "monster_battle", "city_destruction", "comics_source"],
      objects: [],
      locations: ["destroyed city"]
    },
    quality: { visualQualityScore: 94, cropability916Score: 93, textHeavyRatio: options.textHeavyRatio ?? 0.12 },
    confidence: {
      segmentation: 0.94,
      characters: 0.95,
      actions: 0.94,
      relationships: 0.92,
      text: options.text || options.dialogue ? 0.86 : 0.58,
      overall: 0.93
    }
  });
}

async function main() {
  const beast = await importMediaBeast();
  const { buildMockPanel, mineComicStoryVault, buildComicArcProjectsFromMinerV2, evaluateComicShortFinalQualityGate } = beast;

  const panels = [
    makePanel(buildMockPanel, "qa-1", 1, "setup", { dialogue: "Aquilo nao era so um monstro.", text: "A cidade para" }),
    makePanel(buildMockPanel, "qa-2", 2, "context", { narrationBox: "A Liga percebe que a escala mudou." }),
    makePanel(buildMockPanel, "qa-3", 3, "action", { action: "Superman flies toward Godzilla blast", sfx: "WHOOSH" }),
    makePanel(buildMockPanel, "qa-4", 4, "climax", { action: "Godzilla blast hits Superman", sfx: "KRAK" }),
    makePanel(buildMockPanel, "qa-5", 5, "reaction", { dialogue: "Ele aguentou isso?" })
  ];

  const pages = panels.map((panel) => ({
    sourceAssetId: `final-qa-page-${panel.pageNumber}`,
    sourcePagePath: panel.sourcePagePath,
    sourceContentHash: `final-qa-hash-${panel.pageNumber}`,
    pageNumber: panel.pageNumber,
    pageType: "story",
    indexable: true,
    parentContext: panel.parentContext,
    panels: [panel]
  }));

  const report = mineComicStoryVault({
    index: {
      version: 3,
      assetDirectory: join(projectRoot, "storage", "assets", "comics", "final-qa-test"),
      generatedAt: new Date().toISOString(),
      sourcePageCount: pages.length,
      panelCount: panels.length,
      validPanelCount: panels.length,
      rejectedPanelCount: 0,
      sequenceCount: 1,
      pages
    },
    maxOpportunities: 12,
    minScore: 50
  });

  const batch = buildComicArcProjectsFromMinerV2({
    report,
    channelId: "channel-comic-final-qa-test",
    maxProjects: 1,
    titlePrefix: "Final QA"
  });

  assert(batch.projects.length === 1, "expected one project payload");
  const payload = batch.projects[0];
  const gate = payload.renderBlueprintHints.finalQualityGate;
  const visualPlan = payload.renderBlueprintHints.arcVisualPlan;
  const battleTest = payload.renderBlueprintHints.panelBattleTest;
  const timingPlan = payload.renderBlueprintHints.beatTimingPlan;
  assert(gate.qaId === "comic_short_final_quality_gate_v1", "expected final qa id");
  assert(visualPlan.directorId === "comic_arc_visual_director_v1", "expected arc visual director");
  assert(battleTest.testerId === "comic_panel_battle_test_v1", "expected panel battle test");
  assert(timingPlan.plannerId === "comic_beat_timing_plan_v1", "expected beat timing plan");
  assert(timingPlan.sceneCount === payload.scenes.length, "timing plan must cover every scene");
  assert(timingPlan.averagePacingScore >= 78, "timing plan must be production safe");
  assert(timingPlan.scenes.every((scene) => scene.events.some((event) => event.type === "caption_in")), "each scene needs caption timing");
  assert(timingPlan.scenes.every((scene) => scene.events.some((event) => event.type === "camera_move")), "each scene needs camera timing");
  assert(battleTest.averageSelectedScore >= 72, "battle-tested panels must be production safe");
  assert(battleTest.beatResults.every((result) => result.candidates.length > 0), "each beat needs tested panel candidates");
  assert(visualPlan.sceneCount === payload.scenes.length, "visual plan must cover every scene");
  assert(visualPlan.averagePanelNarrationAlignmentScore >= 72, "visual alignment must be production safe");
  assert(visualPlan.scenes.every((scene) => scene.selectedEvidenceRegion), "every scene needs a selected visual evidence region");
  assert(visualPlan.scenes.every((scene) => scene.visualEvidenceMap?.regions?.length > 0), "every scene needs evidence regions");
  assert(visualPlan.scenes.every((scene) => scene.visualEvidenceMap?.layoutMap?.preferredCaptionZone), "every scene needs a safe caption zone");
  assert(visualPlan.scenes.every((scene) => scene.visualEvidenceMap?.layoutMap?.readingPath?.length > 0), "every scene needs a visual reading path");
  assert(visualPlan.scenes.every((scene) => scene.visualEvidenceMap?.ocrIntelligence?.detectorId === "comic_ocr_region_intelligence_v1"), "every scene needs OCR region intelligence");
  assert(visualPlan.scenes.some((scene) => (scene.visualEvidenceMap?.ocrIntelligence?.protectedRegions?.length ?? 0) > 0), "at least one scene needs OCR-protected text regions");
  assert(visualPlan.scenes.every((scene) => typeof scene.visualEvidenceMap?.layoutMap?.ocrProtectedRegionCount === "number"), "layout map must expose OCR protected region count");
  assert(gate.checks.durationSeconds >= 30, "duration must be at least 30s");
  assert(gate.checks.hasHook === true, "hook required");
  assert(gate.checks.hasClimax === true, "climax required");
  assert(!gate.blockers.includes("duration_below_30_seconds"), "premium payload cannot be below 30s");
  assert(payload.qualityChecklist.some((item) => item.id === "comic_final_quality_gate"), "checklist must include final qa gate");

  const rejected = evaluateComicShortFinalQualityGate({
    arc: payload.renderBlueprintHints.storyArc,
    script: {
      ...payload.renderBlueprintHints.script,
      fullNarration: "Voce nao vai acreditar. Olha so. Algo acontece.",
      beats: payload.renderBlueprintHints.script.beats.filter((beat) => beat.role !== "climax"),
      humanScore: 40,
      retentionScore: 35,
      overallScore: 42
    },
    scenes: payload.scenes.slice(0, 2).map((scene) => ({ ...scene, duration: 5 })),
    panelAssetManifest: payload.panelAssetManifest.slice(0, 1),
    targetDurationSeconds: 10
  });

  assert(rejected.status === "rejected", "weak short should be rejected");
  assert(rejected.blockers.includes("duration_below_30_seconds"), "weak short should fail duration");
  assert(rejected.blockers.includes("missing_climax_beat"), "weak short should fail climax");
  assert(rejected.blockers.includes("generic_narration_detected"), "weak short should fail generic narration");

  console.log(JSON.stringify({
    status: "completed",
    premiumGate: {
      status: gate.status,
      score: gate.score,
      blockers: gate.blockers,
      warnings: gate.warnings,
      strengths: gate.strengths,
      durationSeconds: gate.checks.durationSeconds,
      averagePanelNarrationAlignmentScore: gate.checks.averagePanelNarrationAlignmentScore,
      visualPlanScore: visualPlan.averagePanelNarrationAlignmentScore,
      selectedEvidenceRegions: visualPlan.scenes.map((scene) => scene.selectedEvidenceRegion?.type),
      safeCaptionZones: visualPlan.scenes.map((scene) => scene.visualEvidenceMap?.layoutMap?.preferredCaptionZone),
      captionRisks: visualPlan.scenes.map((scene) => scene.visualEvidenceMap?.layoutMap?.captionRisk),
      ocrConfidence: visualPlan.scenes.map((scene) => scene.visualEvidenceMap?.ocrIntelligence?.confidence),
      ocrProtectedRegions: visualPlan.scenes.map((scene) => scene.visualEvidenceMap?.layoutMap?.ocrProtectedRegionCount),
      battleTestScore: battleTest.averageSelectedScore,
      battleTestImprovedBeats: battleTest.improvedBeatCount,
      timingScore: timingPlan.averagePacingScore,
      timingCutStyles: timingPlan.scenes.map((scene) => scene.cutStyle)
    },
    rejectedGate: {
      status: rejected.status,
      score: rejected.score,
      blockers: rejected.blockers,
      nextActions: rejected.nextActions
    }
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});






