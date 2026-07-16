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
    sourcePagePath: join(projectRoot, "tmp", `arc-script-page-${pageNumber}.jpg`),
    panelImagePath: join(projectRoot, "tmp", `arc-script-panel-${id}.jpg`),
    panelImageSha256: `${id}-sha256`.padEnd(64, "a"),
    sequenceId: "godzilla-arc-script-seq",
    storyFunction,
    parentContext: {
      comicTitle: "Liga da Justica vs Godzilla vs Kong Test",
      issueTitle: "Teste de arco premium",
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
  const { buildMockPanel, mineComicStoryVault, doctorComicStoryArcScriptsV2 } = beast;

  const panels = [
    makePanel(buildMockPanel, "g-1", 1, "setup", { dialogue: "Aquilo nao era so um monstro.", text: "A cidade para" }),
    makePanel(buildMockPanel, "g-2", 2, "context", { narrationBox: "A Liga percebe que a escala mudou." }),
    makePanel(buildMockPanel, "g-3", 3, "action", { action: "Superman flies toward Godzilla blast", sfx: "WHOOSH" }),
    makePanel(buildMockPanel, "g-4", 4, "climax", { action: "Godzilla blast hits Superman", sfx: "KRAK" }),
    makePanel(buildMockPanel, "g-5", 5, "reaction", { dialogue: "Ele aguentou isso?" })
  ];

  const pages = panels.map((panel) => ({
    sourceAssetId: `arc-script-page-${panel.pageNumber}`,
    sourcePagePath: panel.sourcePagePath,
    sourceContentHash: `arc-script-hash-${panel.pageNumber}`,
    pageNumber: panel.pageNumber,
    pageType: "story",
    indexable: true,
    parentContext: panel.parentContext,
    panels: [panel]
  }));

  const report = mineComicStoryVault({
    index: {
      version: 3,
      assetDirectory: join(projectRoot, "storage", "assets", "comics", "arc-script-test"),
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

  const arcs = report.storyArcMinerV2.recommendedShorts;
  assert(arcs.length > 0, "expected recommended arcs");

  const doctor = doctorComicStoryArcScriptsV2({ arcs });
  assert(doctor.doctorId === "comic_arc_script_doctor_v2", "expected script doctor id");
  assert(doctor.recommendedScripts.length > 0, "expected recommended scripts");
  const top = doctor.recommendedScripts[0];
  assert(top.estimatedDurationSeconds >= 30, "script must target at least 30s");
  assert(top.beats.length >= 4, "script needs at least four beats");
  assert(top.fullNarration.length > 160, "script should be substantial");
  assert(top.humanScore >= 78, `expected human score >= 78, got ${top.humanScore}`);
  assert(top.readyForVoiceover, "top script should be ready for voiceover");
  assert(!/essa sequencia tem forca visual|poucos paineis|aqui vemos/i.test(top.fullNarration), "script should avoid generic narration phrases");

  console.log(JSON.stringify({
    status: "completed",
    arcCount: arcs.length,
    readyScriptCount: doctor.readyScriptCount,
    averageScore: doctor.averageScore,
    topScript: {
      title: top.title,
      score: top.overallScore,
      humanScore: top.humanScore,
      retentionScore: top.retentionScore,
      duration: top.estimatedDurationSeconds,
      hookLine: top.hookLine,
      beatCount: top.beats.length,
      captions: top.beats.map((beat) => beat.captionText),
      narrationPreview: top.fullNarration
    },
    warnings: doctor.warnings
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
