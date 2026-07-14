import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");

async function importMediaBeast() {
  return import(
    pathToFileURL(join(projectRoot, "packages/media-beast/dist/index.js")).href
  );
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function mockVerification(beatId, panelId, finalScore, accepted = true, evidenceType = "direct_evidence") {
  return {
    beatId,
    panelId,
    evidenceType,
    verification: {
      requiredEntityVisible: true,
      preferredEntityVisible: true,
      requiredThemeVisible: true,
      requiredActionVisible: true,
      preferredRelationshipVisible: evidenceType === "direct_evidence",
      forbiddenEntityVisible: false,
      promotionalContent: false
    },
    scores: {
      localVisualEvidence: finalScore,
      localTextEvidence: finalScore,
      localThemeRelationship: finalScore,
      beatFit: finalScore,
      visualQuality: 75,
      finalScore
    },
    evidence: [`mock:${panelId}`],
    rejectionReasons: accepted ? [] : ["mock_reject"],
    accepted
  };
}

function assignNaiveGreedy(beats, pools) {
  const picks = new Map();
  const used = new Set();
  for (const beat of beats) {
    const pool = pools.find((entry) => entry.beatRole === beat.beatRole)?.candidates ?? [];
    const hit = [...pool]
      .filter((candidate) => candidate.verification.accepted)
      .sort((left, right) => right.verification.scores.finalScore - left.verification.scores.finalScore)
      .find((candidate) => !used.has(candidate.panel.panelId));
    if (!hit) continue;
    picks.set(beat.beatRole, hit);
    used.add(hit.panel.panelId);
  }
  return picks;
}

function makePanel(buildMockPanel, id, pageNumber, overrides = {}) {
  return buildMockPanel({
    panelId: id,
    pageNumber,
    panelNumber: 1,
    readingOrder: pageNumber,
    sequenceId: `espiral_mortal:seq:${Math.floor(pageNumber / 2)}`,
    previousPanelId: pageNumber > 1 ? `panel:page${pageNumber - 1}:panel1` : null,
    nextPanelId: `panel:page${pageNumber + 1}:panel1`,
    cropBounds: overrides.cropBounds ?? {
      x: overrides.cropX ?? 0,
      y: 0,
      width: 900,
      height: 1400
    },
    panelImageSha256: overrides.sha256 ?? `${id}-sha256-${pageNumber}`.padEnd(64, "a"),
    panelImagePath: join(projectRoot, "tmp", `mock-crop-${id}.jpg`),
    storyFunction: overrides.storyFunction ?? "relationship",
    localEvidence: overrides.localEvidence ?? {
      characters: [
        { name: "venom", confidence: 0.9, evidenceSource: "visual" },
        { name: "spider-man", confidence: 0.85, evidenceSource: "visual" }
      ],
      actions: [{ label: "symbiote_duo_presence", confidence: 0.85 }],
      relationships: [{ type: "duo", entities: ["venom", "spider-man"], confidence: 0.88 }],
      detectedText: [],
      dialogue: [],
      narrationBoxes: [],
      soundEffects: [],
      visualThemes: ["symbiosis", "perfect_partner"],
      objects: [],
      locations: []
    },
    ...overrides
  });
}

async function main() {
  const beast = await importMediaBeast();

  const {
    buildMockPanel,
    buildComicPanelSequences,
    assignIndexedPanelsToBeatsGlobally,
    canReusePanelBetweenBeats,
    hasSignificantCropDifference,
    scorePairContinuity,
    saveGlobalPanelAssignmentReport,
    GLOBAL_PANEL_SCORE_THRESHOLDS
  } = beast;

  const panelHookStrong = makePanel(buildMockPanel, "panel:hook-strong", 3, { cropX: 0, sha256: "aa".repeat(32) });
  const panelSharedWeakClimax = makePanel(buildMockPanel, "panel:shared-weak-climax", 3, {
    cropX: 0,
    sha256: "aa".repeat(32)
  });
  const panelClimaxStrong = makePanel(buildMockPanel, "panel:climax-strong", 18, {
    cropX: 120,
    sha256: "bb".repeat(32)
  });
  const panelContextGreedy = makePanel(buildMockPanel, "panel:context-greedy", 4, {
    cropX: 0,
    sha256: "cc".repeat(32)
  });
  const panelDevA = makePanel(buildMockPanel, "panel:dev-a", 4, {
    cropX: 0,
    sha256: "dd".repeat(32),
    sequenceId: "espiral_mortal:seq:2"
  });
  const panelDevB = makePanel(buildMockPanel, "panel:dev-b", 5, {
    cropX: 0,
    sha256: "ee".repeat(32),
    sequenceId: "espiral_mortal:seq:2",
    previousPanelId: panelDevA.panelId,
    nextPanelId: null
  });
  panelDevA.nextPanelId = panelDevB.panelId;

  const panelCuriosityOnly = makePanel(buildMockPanel, "panel:curiosity-only", 8, {
    cropX: 40,
    sha256: "hh".repeat(32),
    sequenceId: "espiral_mortal:seq:4"
  });

  const panelDevJump = makePanel(buildMockPanel, "panel:dev-jump", 22, {
    cropX: 0,
    sha256: "ff".repeat(32),
    sequenceId: "espiral_mortal:seq:9"
  });

  const panelReuseSameCrop = makePanel(buildMockPanel, "panel:reuse-same", 7, {
    cropX: 10,
    sha256: "gg".repeat(32)
  });
  const panelReuseSameCrop2 = makePanel(buildMockPanel, "panel:reuse-same-2", 7, {
    cropX: 12,
    sha256: "gg".repeat(32),
    cropBounds: { x: 11, y: 0, width: 900, height: 1400 }
  });

  const panelReject = buildMockPanel({
    panelId: "panel:reject-offtheme",
    pageNumber: 30,
    valid: true,
    localEvidence: {
      characters: [
        { name: "doctor_strange", confidence: 0.8, evidenceSource: "visual" },
        { name: "black_widow", confidence: 0.75, evidenceSource: "visual" }
      ],
      actions: [],
      relationships: [],
      detectedText: [],
      dialogue: [],
      narrationBoxes: [],
      soundEffects: [],
      visualThemes: ["visual_mystical_off_theme"],
      objects: [],
      locations: []
    }
  });

  const allPanels = [
    panelHookStrong,
    panelSharedWeakClimax,
    panelClimaxStrong,
    panelContextGreedy,
    panelDevA,
    panelDevB,
    panelCuriosityOnly,
    panelDevJump,
    panelReuseSameCrop,
    panelReuseSameCrop2,
    panelReject
  ];

  const sequences = buildComicPanelSequences(allPanels);

  const beats = [
    { beatId: "beat-hook", beatRole: "hook" },
    { beatId: "beat-context", beatRole: "context" },
    { beatId: "beat-curiosity-a", beatRole: "curiosity_a" },
    { beatId: "beat-curiosity-b", beatRole: "curiosity_b" },
    { beatId: "beat-development-a", beatRole: "development_a" },
    { beatId: "beat-development-b", beatRole: "development_b" },
    { beatId: "beat-climax", beatRole: "climax" },
    { beatId: "beat-closing", beatRole: "closing" }
  ];

  const verifiedCandidates = beats.map((beat) => {
    const roleCandidates = {
      hook: [
        { panel: panelHookStrong, verification: mockVerification(beat.beatId, panelHookStrong.panelId, 92) },
        { panel: panelSharedWeakClimax, verification: mockVerification(beat.beatId, panelSharedWeakClimax.panelId, 88) }
      ],
      context: [
        { panel: panelContextGreedy, verification: mockVerification(beat.beatId, panelContextGreedy.panelId, 95) },
        { panel: panelHookStrong, verification: mockVerification(beat.beatId, panelHookStrong.panelId, 70) }
      ],
      curiosity_a: [
        { panel: panelClimaxStrong, verification: mockVerification(beat.beatId, panelClimaxStrong.panelId, 82) },
        { panel: panelCuriosityOnly, verification: mockVerification(beat.beatId, panelCuriosityOnly.panelId, 68) }
      ],
      curiosity_b: [
        { panel: panelCuriosityOnly, verification: mockVerification(beat.beatId, panelCuriosityOnly.panelId, 66) }
      ],
      development_a: [
        { panel: panelDevA, verification: mockVerification(beat.beatId, panelDevA.panelId, 78) },
        { panel: panelDevJump, verification: mockVerification(beat.beatId, panelDevJump.panelId, 72) }
      ],
      development_b: [
        { panel: panelDevB, verification: mockVerification(beat.beatId, panelDevB.panelId, 76) },
        { panel: panelDevJump, verification: mockVerification(beat.beatId, panelDevJump.panelId, 70) }
      ],
      climax: [
        { panel: panelClimaxStrong, verification: mockVerification(beat.beatId, panelClimaxStrong.panelId, 88) },
        { panel: panelSharedWeakClimax, verification: mockVerification(beat.beatId, panelSharedWeakClimax.panelId, 62) }
      ],
      closing: [
        { panel: panelHookStrong, verification: mockVerification(beat.beatId, panelHookStrong.panelId, 80) }
      ]
    };

    return {
      beatId: beat.beatId,
      beatRole: beat.beatRole,
      candidates: roleCandidates[beat.beatRole] ?? []
    };
  });

  const naiveGreedy = assignNaiveGreedy(beats, verifiedCandidates);
  const naiveClimax = naiveGreedy.get("climax")?.verification.scores.finalScore ?? 0;

  const global = assignIndexedPanelsToBeatsGlobally({
    beats,
    verifiedCandidates,
    sequences
  });

  const globalClimax = global.beatPicks.get("climax")?.verification.scores.finalScore ?? 0;
  assert(globalClimax >= naiveClimax, "global assignment should preserve or improve climax vs naive greedy");
  const climaxPanelId = global.beatPicks.get("climax")?.panel.panelId;
  assert(
    climaxPanelId === panelClimaxStrong.panelId,
    `global should pick strong climax panel, got ${climaxPanelId ?? "none"}`
  );

  const devSeq = global.developmentSequence;
  assert(devSeq.panelA === panelDevA.panelId, "development_a panel expected");
  assert(devSeq.panelB === panelDevB.panelId, "development_b should prefer consecutive pair");
  assert(devSeq.consecutivePages, "development should be consecutive pages");
  assert(devSeq.sameStorySequence, "development should share story sequence");
  assert(devSeq.continuityScore >= 60, `development continuity expected >= 60, got ${devSeq.continuityScore}`);

  const jumpContinuity = scorePairContinuity(panelDevA, panelDevJump, sequences);
  assert(jumpContinuity < devSeq.continuityScore, "random page jump should score lower than consecutive development");

  const reuseBlocked = canReusePanelBetweenBeats({
    fromBeat: "context",
    toBeat: "curiosity_a",
    fromPanel: panelReuseSameCrop,
    toPanel: panelReuseSameCrop2
  });
  assert(!reuseBlocked.allowed, "insignificant crop reuse must be rejected");

  const closingReuse = global.reuse.find((entry) => entry.beatRole === "closing");
  assert(closingReuse, "closing should reuse hook");
  assert(closingReuse.reusedFromBeat === "hook", "closing reuse source should be hook");

  const weakPools = beats.map((beat) => ({
    beatId: beat.beatId,
    beatRole: beat.beatRole,
    candidates:
      beat.beatRole === "climax"
        ? [{ panel: panelReject, verification: mockVerification(beat.beatId, panelReject.panelId, 55, true, "reject") }]
        : verifiedCandidates.find((pool) => pool.beatRole === beat.beatRole)?.candidates ?? []
  }));

  const blocked = assignIndexedPanelsToBeatsGlobally({
    beats,
    verifiedCandidates: weakPools,
    sequences
  });
  assert(!blocked.canPublish, "beat below minimum must block canPublish");
  assert(blocked.publishBlockReason, "publish block reason expected");

  assert(!hasSignificantCropDifference(panelReuseSameCrop, panelReuseSameCrop2), "near-identical crops not significant");

  const { reportPath, contactSheetPath } = await saveGlobalPanelAssignmentReport({
    result: global,
    projectRoot
  });

  const summary = {
    scoresByBeat: Object.fromEntries(
      global.assignments.map((entry) => [entry.beatRole, entry.finalScore])
    ),
    chosenPanels: Object.fromEntries(
      global.assignments.map((entry) => [entry.beatRole, entry.panelId])
    ),
    developmentSequence: global.developmentSequence,
    hook: global.hookReserve,
    climax: global.climaxReserve,
    reuse: global.reuse,
    averageScore: global.averageScore,
    continuityScore: global.developmentSequence.continuityScore,
    continuityBonus: global.continuityBonus,
    totalWeightedScore: global.totalWeightedScore,
    canPublish: global.canPublish,
    naiveClimax,
    globalClimax,
    rejectedAlternatives: global.rejectedAlternatives.length,
    reportPath,
    contactSheetPath,
    thresholds: GLOBAL_PANEL_SCORE_THRESHOLDS
  };

  console.log(JSON.stringify(summary, null, 2));
  console.log("[test-global-panel-assignment] OK");
}

main().catch((error) => {
  console.error("[test-global-panel-assignment] FAILED", error);
  process.exitCode = 1;
});