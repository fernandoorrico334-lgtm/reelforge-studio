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

function makePanel(buildMockPanel, id, issue, pageNumber, storyFunction, evidence, overrides = {}) {
  return buildMockPanel({
    panelId: `project-bank-i${issue}-${id}`,
    pageNumber,
    panelNumber: Number(id.split("-").at(-1) ?? pageNumber),
    readingOrder: pageNumber * 10 + Number(id.split("-").at(-1) ?? 1),
    sourcePagePath: join(projectRoot, "tmp", `project-bank-i${issue}-page-${pageNumber}.jpg`),
    panelImagePath: join(projectRoot, "tmp", `project-bank-i${issue}-panel-${id}.jpg`),
    panelImageSha256: `project-bank-i${issue}-${id}-sha256`.padEnd(64, "c"),
    sequenceId: `project-bank-i${issue}-seq-${Math.ceil(pageNumber / 4)}`,
    previousPanelId: null,
    nextPanelId: null,
    storyFunction,
    parentContext: {
      comicTitle: "Justice League vs Godzilla vs Kong Project Builder Test",
      issueTitle: `Issue #${issue}`,
      pageTitle: `Issue ${issue} Page ${pageNumber}`,
      parentTags: ["justice league", "godzilla", "superman", "kong", "kaiju"],
      parentEntities: ["justice_league", "godzilla", "superman", "kong"]
    },
    localEvidence: evidence,
    quality: overrides.quality ?? { visualQualityScore: 90, cropability916Score: 86, textHeavyRatio: 0.18 },
    confidence: overrides.confidence ?? {
      segmentation: 0.92,
      characters: 0.9,
      actions: 0.88,
      relationships: 0.84,
      text: 0.78,
      overall: 0.88
    },
    ...overrides
  });
}

function makeIssueReport(beast, issue, focus) {
  const { buildMockPanel, mineComicStoryVault } = beast;
  const setupEvidence = {
    characters: [{ name: "superman", confidence: 0.92, evidenceSource: "visual" }],
    actions: [{ label: "heroes discover kaiju signal", confidence: 0.74 }],
    relationships: [{ type: "conversation", entities: ["superman", "justice_league"], confidence: 0.8 }],
    detectedText: ["Tem algo chamando o Godzilla"],
    dialogue: ["Tem algo chamando o Godzilla."],
    narrationBoxes: ["A Liga percebe que a crise tem uma origem maior."],
    soundEffects: [],
    visualThemes: ["hero_team", "kaiju_crossover", focus, "mystery_signal"],
    objects: ["monitor"],
    locations: ["watchtower"]
  };
  const actionEvidence = {
    characters: [
      { name: "superman", confidence: 0.92, evidenceSource: "visual" },
      { name: focus === "kong_arrival" ? "kong" : "godzilla", confidence: 0.96, evidenceSource: "visual" }
    ],
    actions: [{ label: "superman clashes with titan in city", confidence: 0.95 }],
    relationships: [{ type: "conflict", entities: ["superman", focus === "kong_arrival" ? "kong" : "godzilla"], confidence: 0.95 }],
    detectedText: ["KRAKOOM"],
    dialogue: ["Segura ele!"],
    narrationBoxes: ["A escala da luta muda em segundos."],
    soundEffects: ["KRAKOOM", "BOOM"],
    visualThemes: ["monster_battle", "titan_standoff", "city_destruction", focus],
    objects: ["buildings", "debris"],
    locations: ["city"]
  };
  const payoffEvidence = {
    characters: [
      { name: "justice_league", confidence: 0.9, evidenceSource: "visual" },
      { name: "godzilla", confidence: 0.91, evidenceSource: "visual" }
    ],
    actions: [{ label: "heroes react to impossible monster scale", confidence: 0.84 }],
    relationships: [{ type: "alliance tension", entities: ["justice_league", "godzilla"], confidence: 0.86 }],
    detectedText: ["Plano B?"],
    dialogue: ["Entao esse e o nosso problema agora."],
    narrationBoxes: ["A reacao deixa claro que a luta esta apenas comecando."],
    soundEffects: ["ROAR"],
    visualThemes: ["reaction", "monster_battle", "cliffhanger", focus],
    objects: [],
    locations: ["city"]
  };

  const panels = [
    makePanel(buildMockPanel, "setup-1", issue, 1, "setup", setupEvidence),
    makePanel(buildMockPanel, "setup-2", issue, 2, "dialogue", setupEvidence),
    makePanel(buildMockPanel, "action-1", issue, 3, "action", actionEvidence),
    makePanel(buildMockPanel, "action-2", issue, 4, "climax", actionEvidence),
    makePanel(buildMockPanel, "payoff-1", issue, 5, "reaction", payoffEvidence),
    makePanel(buildMockPanel, "payoff-2", issue, 6, "reveal", payoffEvidence)
  ];
  const pages = panels.map((panel) => ({
    sourceAssetId: `project-bank-issue-${issue}-page-${panel.pageNumber}`,
    sourcePagePath: panel.sourcePagePath,
    sourceContentHash: `project-bank-issue-${issue}-hash-${panel.pageNumber}`,
    pageNumber: panel.pageNumber,
    pageType: "story",
    indexable: true,
    parentContext: panel.parentContext,
    panels: [panel]
  }));
  return mineComicStoryVault({
    index: {
      version: 3,
      assetDirectory: join(projectRoot, "storage", "assets", "comics", `project-bank-test-${issue}`),
      generatedAt: new Date().toISOString(),
      sourcePageCount: pages.length,
      panelCount: panels.length,
      validPanelCount: panels.length,
      rejectedPanelCount: 0,
      sequenceCount: 2,
      pages
    },
    maxOpportunities: 30,
    minScore: 35
  });
}

async function main() {
  const beast = await importMediaBeast();
  const { buildComicSagaNarrativeMap, buildComicHQWideStoryBank, buildComicStoryBankShortProject } = beast;
  const issues = [
    { issueNumber: 1, title: "Issue #1 - O sinal do monstro", report: makeIssueReport(beast, 1, "godzilla_arrival") },
    { issueNumber: 2, title: "Issue #2 - Kong entra na guerra", report: makeIssueReport(beast, 2, "kong_arrival") },
    { issueNumber: 3, title: "Issue #3 - A Liga tenta segurar os titas", report: makeIssueReport(beast, 3, "titan_standoff") }
  ];
  const sagaMap = buildComicSagaNarrativeMap({ title: "Justice League vs Godzilla vs Kong", issues });
  const storyBank = buildComicHQWideStoryBank({ sagaMap, maxProductionPlanItems: 12 });
  const panelsById = new Map(issues.flatMap((issue) => issue.report.opportunities.flatMap((opportunity) => opportunity.panels.map((panel) => [panel.panelId, panel]))));
  const projectPlan = buildComicStoryBankShortProject({
    storyBank,
    category: "battle",
    channelId: "comic-shorts-test",
    targetDurationSeconds: 36,
    panelsById
  });

  assert(projectPlan.builderId === "comic_story_bank_project_builder_v1", "expected project builder id");
  assert(projectPlan.scenes.length >= 5, "expected at least five scenes");
  assert(projectPlan.estimatedDurationSeconds >= 30, "expected 30s+ short");
  assert(projectPlan.qualityGates.hasMinimumDuration, "expected minimum duration gate");
  assert(projectPlan.qualityGates.hasStoryArc, "expected story arc gate");
  assert(projectPlan.qualityGates.hasChronologicalPages, "expected chronological pages");
  assert(projectPlan.qualityGates.canCreateProject, `expected project creation gates to pass: ${projectPlan.qualityGates.blockers.join(", ")}`);
  assert(projectPlan.candidateFirst && projectPlan.requiresManualApproval, "expected candidate-first manual approval");
  assert(projectPlan.script.includes("Aprovacao manual obrigatoria"), "expected manual approval script note");
  assert(projectPlan.panelAssetManifest.length >= projectPlan.scenes.length, "expected panel manifest coverage");
  assert(projectPlan.scenes.every((scene) => scene.panelSelection?.selectedPanelId), "expected every scene to receive an automatic panel selection");
  assert(projectPlan.scenes.every((scene) => scene.panelSelection?.reasons.some((reason) => reason === "issue_match:1")), "expected every automatic panel selection to stay inside issue 1");
  assert(!projectPlan.narrationPlan.warnings.includes("idea_needs_panel_selection"), "expected automatic panel selection to clear panel warning");
  assert(projectPlan.narrationPlan.fullNarration.includes("balao"), "expected narration to cite detected dialogue/balloon evidence");
  assert(projectPlan.narrationPlan.fullNarration.includes("KRAKOOM"), "expected narration to cite detected SFX/action evidence");
  assert(projectPlan.narrationPlan.fullNarration.includes("Mas a pergunta e:"), "expected retention script doctor question in hook");
  assert(projectPlan.narrationPlan.fullNarration.includes("Guarda esse balao"), "expected script doctor to stage important dialogue");
  assert(!projectPlan.narrationPlan.fullNarration.includes("Aqui entra a prova visual"), "expected narration to avoid generic proof phrasing");
  assert(projectPlan.scenes.at(-1)?.captionText === "A PROXIMA PARTE CONTINUA DAQUI", "expected stronger CTA caption");
  assert(projectPlan.scenes.every((scene) => scene.captionCues.length >= 1), "expected every scene to have premium caption cues");
  assert(projectPlan.scenes.some((scene) => scene.captionCues.some((cue) => cue.emphasis === "impact" || cue.emphasis === "shake")), "expected impact/shake caption emphasis");
  assert(projectPlan.scenes.every((scene) => scene.captionCues.every((cue) => cue.text.length <= 42)), "expected compact caption cue text");
  assert(projectPlan.scenes.every((scene) => scene.captionCues.every((cue) => cue.keyword.length <= 24)), "expected compact caption cue keywords");
  assert(projectPlan.scenes.every((scene) => scene.captionCues.every((cue) => !cue.text.includes("...") && !cue.keyword.includes("..."))), "expected caption cues without ellipsis truncation");
  assert(projectPlan.storyboardOptimization.optimizerId === "comic_story_bank_panel_storyboard_optimizer_v1", "expected storyboard optimizer");
  assert(projectPlan.storyboardOptimization.after.uniquePanelCount >= projectPlan.storyboardOptimization.before.uniquePanelCount, "expected optimizer not to reduce panel variety");
  assert(projectPlan.storyboardOptimization.optimizedSceneCount >= 1, "expected optimizer to replace at least one weak or repeated panel");
  assert(projectPlan.storyboardOptimization.after.reusedPanelIds.length < projectPlan.storyboardOptimization.before.reusedPanelIds.length, "expected optimizer to reduce repeated panel usage");
  assert(projectPlan.visualContinuityGate.gateId === "comic_story_bank_visual_continuity_gate_v1", "expected visual continuity gate");
  assert(projectPlan.visualContinuityGate.status === "passed", `expected polished project plan to pass visual continuity: ${projectPlan.visualContinuityGate.warnings.join(", ")}`);
  assert(projectPlan.storyboardOptimization.after.fallbackSceneOrders.length === 0, "expected storyboard optimizer to avoid generic fallback panels in good plan");
  assert(projectPlan.scenes.some((scene) => scene.panelSelection?.mode === "storybeat_match"), "expected storybeat panel matching for out-of-page but narratively relevant panels");
  assert(projectPlan.visualContinuityGate.uniquePanelCount >= 4, "expected enough unique panels for a 30s+ short");
  assert(projectPlan.qualityGates.hasPanelContinuity, "expected panel continuity gate to pass hard blockers");
  assert(projectPlan.editPlan.maxHoldSeconds === 4, "expected max 4s visual hold rule");

  const onePanelOnly = new Map([[projectPlan.scenes[0].panelSelection.selectedPanelId, panelsById.get(projectPlan.scenes[0].panelSelection.selectedPanelId)]]);
  const blockedPlan = buildComicStoryBankShortProject({
    storyBank,
    ideaId: projectPlan.idea.id,
    channelId: "comic-shorts-test",
    targetDurationSeconds: 36,
    panelsById: onePanelOnly
  });
  assert(blockedPlan.visualContinuityGate.status === "blocked", "expected low-variety panel plan to be blocked");
  assert(blockedPlan.visualContinuityGate.blockers.some((blocker) => blocker.startsWith("low_unique_panel_count")), "expected low unique panel blocker");
  assert(!blockedPlan.qualityGates.canCreateProject, "expected blocked visual continuity to prevent project creation");

  console.log(JSON.stringify({
    status: "completed",
    builderId: projectPlan.builderId,
    title: projectPlan.title,
    idea: {
      id: projectPlan.idea.id,
      category: projectPlan.idea.category,
      title: projectPlan.idea.title,
      pages: projectPlan.idea.pages,
      score: projectPlan.idea.score,
      readiness: projectPlan.idea.readiness
    },
    duration: {
      targetDurationSeconds: projectPlan.targetDurationSeconds,
      estimatedDurationSeconds: projectPlan.estimatedDurationSeconds
    },
    scenes: projectPlan.scenes.map((scene) => ({
      order: scene.order,
      role: scene.role,
      pages: scene.pages,
      panelIds: scene.panelIds,
      panelSelection: scene.panelSelection,
      visualFocus: scene.visualFocus,
      durationSeconds: scene.durationSeconds,
      transition: scene.transition,
      captionText: scene.captionText,
      captionCues: scene.captionCues
    })),
    narrationPlan: projectPlan.narrationPlan,
    editPlan: projectPlan.editPlan,
    storyboardOptimization: projectPlan.storyboardOptimization,
    visualContinuityGate: projectPlan.visualContinuityGate,
    blockedLowVarietyOptimization: blockedPlan.storyboardOptimization,
    blockedLowVarietyGate: blockedPlan.visualContinuityGate,
    qualityGates: projectPlan.qualityGates,
    panelManifestCount: projectPlan.panelAssetManifest.length
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});








