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
    sourcePagePath: join(projectRoot, "tmp", `arc-project-page-${pageNumber}.jpg`),
    panelImagePath: join(projectRoot, "tmp", `arc-project-panel-${id}.jpg`),
    panelImageSha256: `${id}-sha256`.padEnd(64, "b"),
    sequenceId: "godzilla-arc-project-seq",
    storyFunction,
    parentContext: {
      comicTitle: "Liga da Justica vs Godzilla vs Kong Test",
      issueTitle: "Teste de projeto por arco",
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
  const { buildMockPanel, mineComicStoryVault, buildComicArcProjectsFromMinerV2 } = beast;

  const panelSpecs = [
    { storyFunction: "setup", dialogue: "Aquilo nao era so um monstro.", text: "A cidade para" },
    { storyFunction: "context", narrationBox: "A Liga percebe que a escala mudou." },
    { storyFunction: "dialogue", dialogue: "Se ele chegar na costa, ninguem segura." },
    { storyFunction: "action", action: "Superman flies toward Godzilla blast", sfx: "WHOOSH" },
    { storyFunction: "reaction", dialogue: "Ele esta usando a cidade contra nos." },
    { storyFunction: "action", action: "Flash crosses ruined avenue toward civilians", sfx: "ZIP" },
    { storyFunction: "dialogue", dialogue: "Lanterna, tira essas pessoas daqui agora." },
    { storyFunction: "tension", action: "Godzilla pushes through hero defense", sfx: "KRASH" },
    { storyFunction: "reaction", dialogue: "Isso nao e uma invasao comum." },
    { storyFunction: "action", action: "Wonder Woman blocks debris near civilians", sfx: "CLANG" },
    { storyFunction: "tension", narrationBox: "Cada golpe empurra a Liga para tras." },
    { storyFunction: "climax", action: "Godzilla blast hits Superman", sfx: "KRAK" },
    { storyFunction: "reaction", dialogue: "Ele aguentou isso?" },
    { storyFunction: "climax", action: "Kong shadow rises over the battlefield", sfx: "BOOM" },
    { storyFunction: "climax", dialogue: "Agora temos dois problemas gigantes." },
    { storyFunction: "payoff", narrationBox: "A batalha deixa de ser defesa e vira sobrevivencia." },
    { storyFunction: "payoff", action: "Justice League regroups while monsters approach", sfx: "THOOM" },
    { storyFunction: "payoff", narrationBox: "E esse era so o primeiro round." }
  ];

  const panels = panelSpecs.map((spec, index) => makePanel(buildMockPanel, `ap-${index + 1}`, index + 1, spec.storyFunction, spec));

  const pages = panels.map((panel) => ({
    sourceAssetId: `arc-project-page-${panel.pageNumber}`,
    sourcePagePath: panel.sourcePagePath,
    sourceContentHash: `arc-project-hash-${panel.pageNumber}`,
    pageNumber: panel.pageNumber,
    pageType: "story",
    indexable: true,
    parentContext: panel.parentContext,
    panels: [panel]
  }));

  const report = mineComicStoryVault({
    index: {
      version: 3,
      assetDirectory: join(projectRoot, "storage", "assets", "comics", "arc-project-test"),
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
    channelId: "channel-comic-arc-project-test",
    maxProjects: 1,
    titlePrefix: "Teste"
  });

  assert(batch.source === "comic-arc-batch-project-builder-v2", "expected batch builder source");
  assert(batch.candidateFirst === true, "batch must be candidate-first");
  assert(batch.requiresManualApproval === true, "batch must require manual approval");
  assert(batch.projects.length === 1, "expected one project payload");

  const payload = batch.projects[0];
  assert(payload.source === "comic-arc-project-builder-v2", "expected project builder source");
  assert(payload.project.format === "9:16", "project must be vertical");
  assert((payload.project.durationTarget ?? 0) >= 40, "long comic story project must target at least 40s");
  assert(payload.scenes.length >= 15, "long comic story project must have at least 15 visual scenes for 40s pacing");
  assert(payload.scenes.every((scene) => scene.narrationText && scene.captionText), "every scene needs narration and caption");
  assert(payload.scenes.every((scene) => (scene.duration ?? 0) <= 4), "every comic scene must stay at or below 4s");
  assert(!/shorts?|video|conteudo|viral|render|frame|rende short|segura o short|vende a ideia|prova visual/i.test(payload.scenes.map((scene) => scene.narrationText).join(" ")), "narration must tell the story, not talk about the short/video itself");
  assert(payload.panelAssetManifest.length === payload.scenes.length, "manifest should match scenes");
  assert(payload.renderBlueprintHints.script.readyForVoiceover === true, "script should be voiceover ready");
  assert(payload.warnings.includes("manual_approval_required_before_render"), "manual approval warning required");
  assert(payload.warnings.includes("issue_narrative_map_applied"), "issue narrative map should be applied");
  assert(payload.renderBlueprintHints.issueNarrativeMap?.mapId === "comic_issue_narrative_map_v1", "expected issue narrative map in render hints");
  assert(payload.renderBlueprintHints.selectedStoryCandidateId, "expected selected story candidate id");
  assert(payload.renderBlueprintHints.issueNarrativeMap?.productionStrategy.firstShortId === payload.renderBlueprintHints.selectedStoryCandidateId, "builder should use narrative map first short by default");
  assert(payload.renderBlueprintHints.narrativeContinuityHardGate, "expected narrative continuity hard gate in render hints");
  assert(payload.renderBlueprintHints.narrativeContinuityHardGate.backwardPageJumpCount === 0, "selected story must never go backward in pages");
  assert(payload.renderBlueprintHints.narrativeContinuityHardGate.repeatedPanelCount === 0, "selected story must not repeat panels");
  assert(payload.qualityChecklist.some((item) => item.id === "minimum_duration_30s" && item.status === "ready"), "minimum duration checklist should be ready");
  assert(payload.renderBlueprintHints.issueNarrativeMap?.productionStrategy.recommendedMinimumPageSpan >= 15, "issue narrative map should require at least 15 pages for main story shorts");
  assert(payload.renderBlueprintHints.storyArc.pages.length >= 15, "selected story arc must cover at least 15 pages");
  assert(payload.renderBlueprintHints.sequenceSelector.selectedCandidate?.pageSequence.length >= 15, "selected sequence must sample at least 15 pages");

  const visualRecipes = payload.scenes.map((scene) => JSON.parse(scene.visualRecipe));
  assert(visualRecipes.every((recipe) => recipe.premiumDirectives), "every scene should carry premium directives");
  assert(visualRecipes.every((recipe) => recipe.captionRenderPlan?.wordCues?.length > 0), "every scene should carry caption word cues");
  assert(visualRecipes.some((recipe) => recipe.premiumDirectives?.humanizedRewrite?.reason !== "line_already_human_enough"), "at least one humanized rewrite should be embedded");
  assert(visualRecipes.some((recipe) => recipe.continuityInstruction), "continuity cuts should be embedded in visual recipes");
  assert(visualRecipes.every((recipe) => recipe.cropQaInstruction?.focusScore >= 68), "crop QA scene reports should confirm strong focus for every scene");
  assert(visualRecipes.every((recipe) => recipe.cropQaInstruction?.captionRisk !== "high"), "crop QA scene reports should avoid high caption overlap risk");

  console.log(JSON.stringify({
    status: "completed",
    projectCount: batch.projectCount,
    projectTitle: payload.project.title,
    durationTarget: payload.project.durationTarget,
    sceneCount: payload.scenes.length,
    manifestCount: payload.panelAssetManifest.length,
    firstScene: {
      title: payload.scenes[0].title,
      narrationText: payload.scenes[0].narrationText,
      captionText: payload.scenes[0].captionText,
      duration: payload.scenes[0].duration,
      visualPreset: payload.scenes[0].visualPreset,
      transition: payload.scenes[0].transition
    },
    qualityChecklist: payload.qualityChecklist,
    warnings: payload.warnings
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
