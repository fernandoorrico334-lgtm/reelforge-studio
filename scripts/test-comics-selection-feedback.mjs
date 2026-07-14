import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");
const testLedgerDir = join(projectRoot, "tmp", "comics-selection-feedback-test");

async function importMediaBeast() {
  return import(
    pathToFileURL(join(projectRoot, "packages/media-beast/dist/index.js")).href
  );
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function buildRequirement(overrides = {}) {
  return {
    beatId: overrides.beatId ?? "beat-climax",
    role: overrides.role ?? "climax",
    narrationText:
      overrides.narrationText ??
      "A dupla perfeita raramente é explicada nos quadrinhos de simbiose.",
    requiredEntities: overrides.requiredEntities ?? ["venom"],
    preferredEntities: overrides.preferredEntities ?? ["spider-man"],
    requiredThemes: overrides.requiredThemes ?? ["symbiosis", "partnership"],
    preferredThemes: overrides.preferredThemes ?? ["relationship"],
    requiredActions: overrides.requiredActions ?? [],
    preferredActions: overrides.preferredActions ?? [],
    preferredRelationships: overrides.preferredRelationships ?? ["duo", "host_symbiote"],
    forbiddenEntities: overrides.forbiddenEntities ?? [
      "doctor_strange",
      "black_widow",
      "miles_morales",
      "gwen_stacy",
      "spider-man_2099"
    ],
    forbiddenThemes: overrides.forbiddenThemes ?? [
      "visual_mystical_off_theme",
      "visual_ensemble_cameo"
    ],
    allowSupportingVisual: false,
    directEvidenceRequired: true,
    minimumDirectEvidenceScore: 80
  };
}

function partnershipPanel(beast, panelId, shaSuffix) {
  const { buildMockPanel } = beast;
  return buildMockPanel({
    panelId,
    panelImageSha256: `${shaSuffix}`.padEnd(64, "a"),
    storyFunction: "relationship",
    localEvidence: {
      characters: [
        { name: "venom", confidence: 0.92, evidenceSource: "visual" },
        { name: "spider-man", confidence: 0.9, evidenceSource: "visual" }
      ],
      actions: [{ label: "duo_presence", confidence: 0.85 }],
      relationships: [{ type: "duo", entities: ["venom", "spider-man"], confidence: 0.9 }],
      detectedText: [],
      dialogue: [],
      narrationBoxes: [],
      soundEffects: [],
      visualThemes: ["partnership", "symbiosis"],
      objects: [],
      locations: []
    },
    parentContext: {
      comicTitle: "Espiral Mortal",
      issueTitle: "Venom",
      pageTitle: "Venom page",
      parentTags: ["venom"],
      parentEntities: ["venom", "spider-man"]
    }
  });
}

function wrongEntitiesPanel(beast) {
  const { buildMockPanel } = beast;
  return buildMockPanel({
    panelId: "panel:doctor-strange-natasha",
    panelImageSha256: "b".repeat(64),
    storyFunction: "conversation",
    localEvidence: {
      characters: [
        { name: "doctor_strange", confidence: 0.9, evidenceSource: "visual" },
        { name: "black_widow", confidence: 0.88, evidenceSource: "visual" }
      ],
      actions: [],
      relationships: [{ type: "conversation", entities: ["doctor_strange", "black_widow"], confidence: 0.8 }],
      detectedText: [],
      dialogue: [],
      narrationBoxes: [],
      soundEffects: [],
      visualThemes: ["visual_ensemble_cameo"],
      objects: [],
      locations: []
    },
    parentContext: {
      comicTitle: "Strange Tales",
      parentTags: ["avengers"],
      parentEntities: ["doctor_strange", "black_widow"]
    }
  });
}

function milesPanel(beast) {
  const { buildMockPanel } = beast;
  return buildMockPanel({
    panelId: "panel:miles-multiverse",
    panelImageSha256: "c".repeat(64),
    storyFunction: "action",
    localEvidence: {
      characters: [{ name: "miles_morales", confidence: 0.93, evidenceSource: "visual" }],
      actions: [{ label: "multiverse_action", confidence: 0.9 }],
      relationships: [],
      detectedText: [],
      dialogue: [],
      narrationBoxes: [],
      soundEffects: [],
      visualThemes: ["multiverse"],
      objects: [],
      locations: []
    }
  });
}

function parentOnlyVenomPanel(beast) {
  const { buildMockPanel } = beast;
  return buildMockPanel({
    panelId: "panel:parent-only-venom",
    panelImageSha256: "d".repeat(64),
    localEvidence: {
      characters: [{ name: "random_civilian", confidence: 0.7, evidenceSource: "visual" }],
      actions: [],
      relationships: [],
      detectedText: [],
      dialogue: [],
      narrationBoxes: [],
      soundEffects: [],
      visualThemes: ["generic"],
      objects: [],
      locations: []
    },
    parentContext: {
      comicTitle: "Venom Issue",
      parentTags: ["venom"],
      parentEntities: ["venom", "spider-man"]
    }
  });
}

async function main() {
  const beast = await importMediaBeast();
  const {
    applySelectionFeedbackAdjustment,
    appendComicsSelectionFeedback,
    loadComicsSelectionFeedbackLedger,
    saveComicsSelectionFeedbackLedger,
    resolveComicsSelectionFeedbackPath,
    panelHasRequiredLocalEvidence,
    derivePanelSelectionFeedbackPattern,
    FEEDBACK_BONUS_CAP,
    FEEDBACK_PENALTY_CAP,
    DEFAULT_COMICS_SELECTION_FEEDBACK_PATH
  } = beast;

  await rm(testLedgerDir, { recursive: true, force: true });
  await mkdir(testLedgerDir, { recursive: true });

  const ledgerPath = resolveComicsSelectionFeedbackPath(testLedgerDir);
  const results = [];

  const symbiosisRequirement = buildRequirement({
    narrationText: "A simbiose entre Venom e Homem-Aranha aparece nos quadrinhos."
  });
  const multiverseRequirement = buildRequirement({
    beatId: "beat-climax-multiverse",
    narrationText: "Miles Morales abre o arco do multiverso nos quadrinhos.",
    requiredEntities: ["miles_morales"],
    preferredEntities: [],
    requiredThemes: ["multiverse"],
    preferredThemes: ["crossover"],
    forbiddenEntities: ["doctor_strange", "black_widow", "gwen_stacy", "spider-man_2099"],
    minimumDirectEvidenceScore: 70
  });

  const approvedPanel = partnershipPanel(beast, "panel:venom-spider-approved", "aa");
  const rejectedPanel = wrongEntitiesPanel(beast);
  const miles = milesPanel(beast);
  const parentOnly = parentOnlyVenomPanel(beast);

  const feedbackEntries = [
    {
      comicId: "espiral_mortal",
      panelId: "panel:venom-spider-approved",
      panelImageSha256: approvedPanel.panelImageSha256,
      beatRole: "climax",
      narrationTheme: "partnership",
      requiredEntities: ["venom", "spider-man"],
      requiredRelationships: ["duo"],
      decision: "approved",
      reason: "correct_entities",
      notes: "test approval"
    },
    {
      comicId: "strange_tales",
      panelId: "panel:doctor-strange-natasha",
      panelImageSha256: rejectedPanel.panelImageSha256,
      beatRole: "climax",
      narrationTheme: "symbiosis",
      requiredEntities: ["doctor_strange", "black_widow"],
      requiredRelationships: ["conversation"],
      decision: "rejected",
      reason: "wrong_entities",
      notes: "test rejection"
    },
    {
      comicId: "multiverse_saga",
      panelId: "panel:doctor-strange-natasha",
      panelImageSha256: rejectedPanel.panelImageSha256,
      beatRole: "climax",
      narrationTheme: "symbiosis",
      requiredEntities: ["doctor_strange", "black_widow"],
      requiredRelationships: ["conversation"],
      decision: "rejected",
      reason: "wrong_entities",
      notes: "symbiosis-only rejection"
    }
  ];

  for (const entry of feedbackEntries) {
    await appendComicsSelectionFeedback(entry, testLedgerDir);
  }

  const approvalAdjustment = applySelectionFeedbackAdjustment({
    panel: approvedPanel,
    requirement: symbiosisRequirement,
    baseScore: 72,
    feedback: feedbackEntries,
    narrationTheme: "partnership"
  });
  assert(approvalAdjustment.adjustment > 0, "approval should add bonus");
  assert(approvalAdjustment.adjustment <= FEEDBACK_BONUS_CAP, "bonus must respect cap");
  assert(approvalAdjustment.adjustedScore > 72, "adjusted score should increase");
  results.push({
    case: "approval_generates_moderate_bonus",
    adjustment: approvalAdjustment.adjustment,
    adjustedScore: approvalAdjustment.adjustedScore
  });

  const rejectionAdjustment = applySelectionFeedbackAdjustment({
    panel: rejectedPanel,
    requirement: symbiosisRequirement,
    baseScore: 68,
    feedback: feedbackEntries,
    narrationTheme: "symbiosis"
  });
  assert(rejectionAdjustment.adjustment < 0, "rejection should penalize");
  assert(Math.abs(rejectionAdjustment.adjustment) <= FEEDBACK_PENALTY_CAP, "penalty must respect cap");
  assert(rejectionAdjustment.adjustedScore < 68, "adjusted score should decrease");
  results.push({
    case: "rejection_generates_penalty",
    adjustment: rejectionAdjustment.adjustment,
    adjustedScore: rejectionAdjustment.adjustedScore
  });

  const insufficientEvidence = applySelectionFeedbackAdjustment({
    panel: parentOnly,
    requirement: symbiosisRequirement,
    baseScore: 40,
    feedback: feedbackEntries,
    narrationTheme: "symbiosis"
  });
  assert(
    !panelHasRequiredLocalEvidence(parentOnly, symbiosisRequirement),
    "parent-only panel should lack required evidence"
  );
  assert(
    insufficientEvidence.adjustment <= 0,
    "feedback must not add positive adjustment without required evidence"
  );
  assert(
    insufficientEvidence.adjustedScore <= 40,
    "missing evidence panel cannot be boosted into acceptance"
  );
  results.push({
    case: "feedback_does_not_override_missing_evidence",
    adjustment: insufficientEvidence.adjustment,
    evidenceBlockedPositive: insufficientEvidence.evidenceBlockedPositive
  });

  const parentPattern = derivePanelSelectionFeedbackPattern({
    panel: parentOnly,
    beatRole: "climax",
    narrationTheme: "symbiosis"
  });
  assert(
    !parentPattern.characterSet.includes("venom"),
    "parent title entities must not leak into pattern character set"
  );
  const parentBonus = applySelectionFeedbackAdjustment({
    panel: parentOnly,
    requirement: symbiosisRequirement,
    baseScore: 42,
    feedback: [feedbackEntries[0]],
    narrationTheme: "symbiosis"
  });
  assert(parentBonus.adjustment === 0, "parent-context approval must not boost unrelated crop");
  results.push({
    case: "parent_feedback_does_not_contaminate_child_panels",
    patternCharacters: parentPattern.characterSet,
    adjustment: parentBonus.adjustment
  });

  const milesAdjustment = applySelectionFeedbackAdjustment({
    panel: miles,
    requirement: multiverseRequirement,
    baseScore: 70,
    feedback: feedbackEntries,
    narrationTheme: "multiverse"
  });
  assert(
    milesAdjustment.adjustment === 0,
    "symbiosis-only rejection must not penalize miles panel in multiverse beat"
  );
  results.push({
    case: "multiverse_feedback_does_not_block_miles_in_multiverse_video",
    adjustment: milesAdjustment.adjustment
  });

  const reloaded = await loadComicsSelectionFeedbackLedger(testLedgerDir);
  assert(reloaded.entries.length === 3, "ledger should reload persisted entries");
  const persistedRaw = JSON.parse(await readFile(ledgerPath, "utf8"));
  assert(persistedRaw.version === 1, "ledger version should be 1");
  results.push({
    case: "persisted_history_reloads",
    entries: reloaded.entries.length,
    ledgerPath: join(DEFAULT_COMICS_SELECTION_FEEDBACK_PATH)
  });

  await saveComicsSelectionFeedbackLedger(
    { version: 1, updatedAt: new Date().toISOString(), entries: [] },
    testLedgerDir
  );
  const cleared = await loadComicsSelectionFeedbackLedger(testLedgerDir);
  assert(cleared.entries.length === 0, "ledger save should overwrite entries");

  const reportPath = join(projectRoot, "tmp", "variation-b-comics-selection-feedback-test.json");
  await writeFile(
    reportPath,
    JSON.stringify(
      {
        ok: true,
        limits: { bonusCap: FEEDBACK_BONUS_CAP, penaltyCap: FEEDBACK_PENALTY_CAP },
        ledgerStructure: {
          version: 1,
          fields: [
            "feedbackId",
            "comicId",
            "panelId",
            "panelImageSha256",
            "beatRole",
            "narrationTheme",
            "requiredEntities",
            "requiredRelationships",
            "decision",
            "reason",
            "notes",
            "createdAt"
          ],
          defaultPath: resolveComicsSelectionFeedbackPath(projectRoot)
        },
        results
      },
      null,
      2
    ),
    "utf8"
  );

  console.log(JSON.stringify({ ok: true, results, reportPath }, null, 2));
}

main().catch((error) => {
  console.error("[test-comics-selection-feedback] FAIL");
  console.error(error);
  process.exit(1);
});