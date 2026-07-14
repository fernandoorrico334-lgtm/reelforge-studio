import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");

async function importMediaBeast() {
  return import(
    pathToFileURL(resolve(projectRoot, "packages/media-beast/dist/index.js")).href
  );
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function basePanel(overrides = {}) {
  return {
    panelId: "user-remix-asset-test:page1:panel1",
    pageNumber: 1,
    panelNumber: 1,
    readingOrder: 1,
    sourcePagePath: "C:/assets/page1.jpg",
    panelImagePath: "C:/assets/.panel-index/crops/page1_panel1.jpg",
    panelImageSha256: "abc123",
    cropBounds: { x: 0, y: 0, width: 800, height: 1200 },
    parentContext: {
      comicTitle: "Test Comic",
      issueTitle: "Test Issue page 1",
      pageTitle: "Test Issue page 1",
      parentTags: ["test"],
      parentEntities: []
    },
    localEvidence: {
      characters: [],
      actions: [],
      relationships: [],
      detectedText: [],
      dialogue: [],
      narrationBoxes: [],
      soundEffects: [],
      visualThemes: [],
      objects: [],
      locations: []
    },
    storyFunction: "action",
    sequenceId: "test:seq:1",
    previousPanelId: null,
    nextPanelId: null,
    valid: true,
    rejectReason: null,
    quality: {
      visualQualityScore: 78,
      cropability916Score: 72,
      textHeavyRatio: 0.08
    },
    confidence: {
      segmentation: 0.8,
      characters: 0.8,
      actions: 0.75,
      relationships: 0.75,
      text: 0.2,
      overall: 0.78
    },
    warnings: [],
    cropAreaRatio: 0.22,
    estimatedPanelCount: 1,
    estimatedGutterCount: 0,
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
    evidenceTier: "direct_evidence",
    ...overrides
  };
}

async function main() {
  const beast = await importMediaBeast();
  const {
    buildSceneEvidenceContract,
    validateSceneShot,
    validateSceneNarrationAlignment,
    detectGenericNarrationPhrase,
    generateSceneFirstStoryProposals,
    selectSceneFirstStoryProposal,
    rewriteSceneFirstNarrationCue,
    classifyNarrationEvidenceType,
    findAdjacentSequenceEvidence,
    buildComicPanelSequences,
    SCENE_FIRST_PROPOSAL_THRESHOLDS
  } = beast;

  const farmerPanel = basePanel({
    panelId: "user-remix-asset-farm:page2:panel1",
    localEvidence: {
      characters: [{ name: "farmer", confidence: 0.7, evidenceSource: "visual" }],
      actions: [{ label: "rural_scene", confidence: 0.8 }],
      relationships: [],
      detectedText: [],
      dialogue: [],
      narrationBoxes: [],
      soundEffects: [],
      visualThemes: ["rural"],
      objects: ["tractor"],
      locations: ["field"]
    }
  });
  const farmerScene = buildSceneEvidenceContract(farmerPanel);
  const farmerCue = {
    beatId: "t-farmer",
    role: "hook",
    sceneId: farmerScene.sceneId,
    panelId: farmerScene.panelId,
    startSec: 0,
    endSec: 4,
    narrationText: "Venom domina a cena e mostra força bruta no confronto.",
    narrationPurpose: "explain_visible_action",
    evidenceReferences: [],
    sceneNarrationAlignmentScore: 0,
    warnings: []
  };
  const farmerAlign = validateSceneNarrationAlignment({ scene: farmerScene, narration: farmerCue });
  assert(!farmerAlign.ok, "farmer+venom narration should reject");

  const strangePanel = basePanel({
    panelId: "user-remix-asset-strange:page3:panel1",
    visualFlags: {
      venomVisible: false,
      spiderManVisible: false,
      blackSuitVisible: false,
      symbioteVisible: false,
      duoVisible: false,
      doctorStrangeVisible: true,
      unrelatedCharacterVisible: true
    },
    localEvidence: {
      characters: [{ name: "doctor_strange", confidence: 0.9, evidenceSource: "visual" }],
      actions: [{ label: "mystical_pose", confidence: 0.8 }],
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
  const strangeScene = buildSceneEvidenceContract(strangePanel);
  const strangeCue = {
    beatId: "t-strange",
    role: "hook",
    sceneId: strangeScene.sceneId,
    panelId: strangeScene.panelId,
    startSec: 0,
    endSec: 4,
    narrationText: "Venom e Homem-Aranha formam a dupla ideal nesta cena.",
    narrationPurpose: "explain_visible_action",
    evidenceReferences: [],
    sceneNarrationAlignmentScore: 0,
    warnings: []
  };
  const strangeAlign = validateSceneNarrationAlignment({ scene: strangeScene, narration: strangeCue });
  assert(!strangeAlign.ok, "doctor strange + duo venom should reject");

  const symbiotePanel = basePanel({
    panelId: "user-remix-asset-sym:page4:panel1",
    localEvidence: {
      characters: [{ name: "spider-man", confidence: 0.88, evidenceSource: "visual" }],
      actions: [{ label: "suit_transformation", confidence: 0.86 }],
      relationships: [{ type: "host_symbiote", entities: ["spider-man", "symbiote"], confidence: 0.9 }],
      detectedText: [],
      dialogue: [],
      narrationBoxes: [],
      soundEffects: [],
      visualThemes: ["symbiosis", "black_suit"],
      objects: [],
      locations: []
    },
    visualFlags: {
      venomVisible: false,
      spiderManVisible: true,
      blackSuitVisible: true,
      symbioteVisible: true,
      duoVisible: false,
      doctorStrangeVisible: false,
      unrelatedCharacterVisible: false
    }
  });
  const symScene = buildSceneEvidenceContract(symbiotePanel);
  const symCue = {
    beatId: "t-sym",
    role: "context",
    sceneId: symScene.sceneId,
    panelId: symScene.panelId,
    startSec: 4,
    endSec: 9,
    narrationText:
      "Repara no traje preto: ele não funciona como roupa comum, mas como parte do próprio corpo.",
    narrationPurpose: "reveal_local_context",
    evidenceReferences: symScene.allowedClaims,
    sceneNarrationAlignmentScore: 0,
    warnings: []
  };
  const symAlign = validateSceneNarrationAlignment({ scene: symScene, narration: symCue });
  assert(symAlign.ok, "black suit symbiosis narration should accept");

  const conflictPanel = basePanel({
    panelId: "user-remix-asset-conf:page5:panel1",
    localEvidence: {
      characters: [
        { name: "venom", confidence: 0.9, evidenceSource: "visual" },
        { name: "spider-man", confidence: 0.88, evidenceSource: "visual" }
      ],
      actions: [{ label: "clash", confidence: 0.85 }],
      relationships: [
        { type: "conflict", entities: ["venom", "spider-man"], confidence: 0.9 }
      ],
      detectedText: [],
      dialogue: [],
      narrationBoxes: [],
      soundEffects: [],
      visualThemes: ["conflict"],
      objects: [],
      locations: []
    },
    visualFlags: {
      venomVisible: true,
      spiderManVisible: true,
      blackSuitVisible: false,
      symbioteVisible: true,
      duoVisible: false,
      doctorStrangeVisible: false,
      unrelatedCharacterVisible: false
    }
  });
  const conflictScene = buildSceneEvidenceContract(conflictPanel);
  const conflictCue = {
    beatId: "t-conflict",
    role: "climax",
    sceneId: conflictScene.sceneId,
    panelId: conflictScene.panelId,
    startSec: 21,
    endSec: 28,
    narrationText:
      "O embate explode no clímax — a rivalidade deixa de ser subtexto e vira ação visível.",
    narrationPurpose: "deliver_payoff",
    evidenceReferences: conflictScene.allowedClaims,
    sceneNarrationAlignmentScore: 0,
    warnings: []
  };
  const conflictAlign = validateSceneNarrationAlignment({
    scene: conflictScene,
    narration: conflictCue
  });
  assert(conflictAlign.ok, "conflict scene should accept rivalry narration");

  const soloSpiderPanel = basePanel({
    panelId: "user-remix-asset-solo:page6:panel1",
    localEvidence: {
      characters: [{ name: "spider-man", confidence: 0.9, evidenceSource: "visual" }],
      actions: [{ label: "pose", confidence: 0.7 }],
      relationships: [],
      detectedText: [],
      dialogue: [],
      narrationBoxes: [],
      soundEffects: [],
      visualThemes: [],
      objects: [],
      locations: []
    },
    visualFlags: {
      venomVisible: false,
      spiderManVisible: true,
      blackSuitVisible: false,
      symbioteVisible: false,
      duoVisible: false,
      doctorStrangeVisible: false,
      unrelatedCharacterVisible: false
    }
  });
  const soloScene = buildSceneEvidenceContract(soloSpiderPanel);
  const soloCue = {
    beatId: "t-solo",
    role: "hook",
    sceneId: soloScene.sceneId,
    panelId: soloScene.panelId,
    startSec: 0,
    endSec: 4,
    narrationText: "Venom e Homem-Aranha formam a dupla ideal nesta cena.",
    narrationPurpose: "explain_visible_action",
    evidenceReferences: [],
    sceneNarrationAlignmentScore: 0,
    warnings: []
  };
  const soloAlign = validateSceneNarrationAlignment({ scene: soloScene, narration: soloCue });
  assert(!soloAlign.ok, "solo spider-man should not accept perfect duo");

  const duoPanels = [
    conflictPanel,
    basePanel({
      panelId: "user-remix-asset-duo:page5:panel2",
      panelNumber: 2,
      readingOrder: 2,
      previousPanelId: conflictPanel.panelId,
      nextPanelId: null,
      sequenceId: "test:seq:conflict",
      localEvidence: {
        characters: [
          { name: "venom", confidence: 0.9, evidenceSource: "visual" },
          { name: "spider-man", confidence: 0.86, evidenceSource: "visual" }
        ],
        actions: [{ label: "symbiote_duo_presence", confidence: 0.84 }],
        relationships: [{ type: "duo", entities: ["venom", "spider-man"], confidence: 0.88 }],
        detectedText: [],
        dialogue: [],
        narrationBoxes: [],
        soundEffects: [],
        visualThemes: ["partnership"],
        objects: [],
        locations: []
      },
      visualFlags: {
        venomVisible: true,
        spiderManVisible: true,
        blackSuitVisible: false,
        symbioteVisible: true,
        duoVisible: true,
        doctorStrangeVisible: false,
        unrelatedCharacterVisible: false
      }
    })
  ];
  const proposals = generateSceneFirstStoryProposals({ panels: [...duoPanels, symbiotePanel, soloSpiderPanel] });
  assert(proposals.length >= 1, "expected at least one story proposal");
  const partnerProposal = proposals.find((entry) => entry.topic === "parceiro_perfeito");
  if (partnerProposal) {
    assert(
      partnerProposal.topicSupportScore < SCENE_FIRST_PROPOSAL_THRESHOLDS.topicSupport ||
        selectSceneFirstStoryProposal(proposals)?.topic !== "parceiro_perfeito",
      "perfect partner should be rejected when unsupported"
    );
  }

  assert(detectGenericNarrationPhrase("Venom no foco"), "venom no foco must be generic");

  const badZoomPanel = basePanel({
    panelId: "user-remix-asset-zoom:page7:panel1",
    cropBounds: { x: 0, y: 0, width: 1800, height: 400 },
    quality: {
      visualQualityScore: 55,
      cropability916Score: 32,
      textHeavyRatio: 0.12
    },
    localEvidence: {
      characters: [{ name: "venom", confidence: 0.55, evidenceSource: "visual" }],
      actions: [],
      relationships: [],
      detectedText: [],
      dialogue: [],
      narrationBoxes: [],
      soundEffects: [],
      visualThemes: [],
      objects: [],
      locations: []
    }
  });
  const zoomShot = validateSceneShot({ panel: badZoomPanel, pageType: "story" });
  assert(!zoomShot.valid, "bad zoom crop should fail shot validation");

  const setupPanel = basePanel({
    panelId: "user-remix-asset-seq:page8:panel1",
    panelNumber: 1,
    storyFunction: "setup",
    nextPanelId: "user-remix-asset-seq:page8:panel2",
    sequenceId: "test:seq:transform"
  });
  const transformPanel = basePanel({
    panelId: "user-remix-asset-seq:page8:panel2",
    panelNumber: 2,
    readingOrder: 2,
    previousPanelId: setupPanel.panelId,
    nextPanelId: "user-remix-asset-seq:page8:panel3",
    storyFunction: "transformation",
    sequenceId: "test:seq:transform",
    localEvidence: {
      characters: [{ name: "spider-man", confidence: 0.9, evidenceSource: "visual" }],
      actions: [{ label: "suit_transformation", confidence: 0.88 }],
      relationships: [{ type: "host_symbiote", entities: ["spider-man"], confidence: 0.9 }],
      detectedText: [],
      dialogue: [],
      narrationBoxes: [],
      soundEffects: [],
      visualThemes: ["symbiosis"],
      objects: [],
      locations: []
    }
  });
  const reactionPanel = basePanel({
    panelId: "user-remix-asset-seq:page8:panel3",
    panelNumber: 3,
    readingOrder: 3,
    previousPanelId: transformPanel.panelId,
    storyFunction: "reaction",
    sequenceId: "test:seq:transform",
    localEvidence: {
      characters: [{ name: "spider-man", confidence: 0.86, evidenceSource: "visual" }],
      actions: [{ label: "shock_reaction", confidence: 0.8 }],
      relationships: [],
      detectedText: [],
      dialogue: [],
      narrationBoxes: [],
      soundEffects: [],
      visualThemes: [],
      objects: [],
      locations: []
    }
  });
  const seqPanels = [setupPanel, transformPanel, reactionPanel];
  const sequences = buildComicPanelSequences(seqPanels);
  const seqProposal = generateSceneFirstStoryProposals({ panels: seqPanels }).find(
    (entry) => entry.panelIds.length >= 2
  );
  assert(seqProposal, "setup-transform-reaction should yield a proposal");
  assert(seqProposal.continuityScore >= 50, "sequence continuity should be reasonable");

  const setupScene = buildSceneEvidenceContract(setupPanel);
  const transformScene = buildSceneEvidenceContract(transformPanel);
  const adjacentCue = rewriteSceneFirstNarrationCue({
    scene: transformScene,
    cue: {
      beatId: "adj",
      role: "development",
      sceneId: transformScene.sceneId,
      panelId: transformScene.panelId,
      startSec: 9,
      endSec: 15,
      narrationText: "",
      narrationPurpose: "connect_sequence",
      evidenceReferences: [],
      sceneNarrationAlignmentScore: 0,
      warnings: []
    },
    panel: transformPanel,
    proposal: seqProposal,
    previousScene: setupScene
  });
  const evidenceType = classifyNarrationEvidenceType({
    scene: transformScene,
    cue: adjacentCue,
    previousScene: setupScene,
    sequence: findAdjacentSequenceEvidence({ panel: transformPanel, sequences })
  });
  assert(
    evidenceType === "adjacent_scene_sequence" || evidenceType === "direct_current_scene",
    "adjacent narration needs sequence evidence"
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        testsPassed: 11,
        proposalCount: proposals.length,
        selectedTopic: selectSceneFirstStoryProposal(proposals)?.topic ?? null
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error("[test-scene-first-narration] FAIL");
  console.error(error);
  process.exitCode = 1;
});