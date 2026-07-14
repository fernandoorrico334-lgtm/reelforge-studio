import { access, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");
const assetDir = join(projectRoot, "storage/assets/user-provided/remix/venom-partner");
const indexPath = join(assetDir, ".comics-local-panel-index.json");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function fileExists(path) {
  try {
    await access(path, constants.F_OK | constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

async function importMediaBeast() {
  return import(
    pathToFileURL(join(projectRoot, "packages/media-beast/dist/index.js")).href
  );
}

function region(overrides) {
  return {
    whiteRatio: 0,
    blackRatio: 0,
    redRatio: 0,
    blueRatio: 0,
    yellowRatio: 0,
    greenRatio: 0,
    saturatedRatio: 0,
    colorBucketCount: 0,
    ...overrides
  };
}

function profileFromRegions(global, topThird = global, midThird = global, bottomThird = global) {
  return { global, topThird, midThird, bottomThird };
}

function analyzeSynthetic(beast, panelId, profile) {
  return beast.analyzeCropVisualEvidenceFromProfile({
    panelId,
    panelImagePath: `/synthetic/${panelId}.jpg`,
    panelImageSha256: "synthetic",
    profile
  });
}

const FALSE_POSITIVE_IDS = [
  "user-remix-asset-28ec95401fea:page1:panel1",
  "user-remix-asset-28ec95401fea:page1:panel5",
  "user-remix-asset-28ec95401fea:page1:panel10",
  "user-remix-asset-3b8b7c565b52:page5:panel7"
];

async function main() {
  const beast = await importMediaBeast();
  const {
    analyzeCropVisualEvidenceFromProfile,
    analyzeCropVisualEvidenceFromVisualVerdict,
    analyzeComicsPanelVisual,
    reindexVariationBCropVisualEvidence,
    REINDEXED_VISUAL_EVIDENCE_FILENAME,
    REINDEXED_VISUAL_EVIDENCE_CONTACT_SHEET_FILENAME
  } = beast;

  // 1) agricultor/trator — no Venom
  const rural = analyzeSynthetic(beast, "synthetic:rural", profileFromRegions(
    region({ redRatio: 0.33, blueRatio: 0.17, yellowRatio: 0.19, saturatedRatio: 0.61, blackRatio: 0.07, greenRatio: 0.003 }),
    region({ blueRatio: 0.42, redRatio: 0.02, whiteRatio: 0.05 })
  ));
  assert(rural.sceneClassification === "rural_dominant", "rural crop must classify as rural_dominant");
  assert(!rural.flags.venomVisible.value, "rural crop must not receive Venom");
  assert(!rural.flags.spiderManVisible.value, "rural crop must not receive Spider-Man");
  assert(!rural.flags.duoVisible.value, "rural crop must not receive duo");

  // 2) Doutor Estranho — no Venom/Spider-Man
  const doctor = analyzeSynthetic(beast, "synthetic:doctor", profileFromRegions(
    region({ whiteRatio: 0.092, blueRatio: 0.265, redRatio: 0.071, blackRatio: 0.08, greenRatio: 0.011, saturatedRatio: 0.32 }),
    region({ whiteRatio: 0.193, blueRatio: 0.386, redRatio: 0.023 }),
    region({ redRatio: 0.04, blueRatio: 0.16 })
  ));
  assert(doctor.flags.doctorStrangeVisible.value, "doctor strange crop must set doctorStrangeVisible");
  assert(doctor.flags.doctorStrangeVisible.confidence >= 0.8, "doctor strange confidence must be >= 0.8");
  assert(!doctor.flags.venomVisible.value, "doctor strange crop must not receive Venom");
  assert(!doctor.flags.spiderManVisible.value, "doctor strange crop must not receive Spider-Man");
  assert(doctor.evidenceStatus === "forbidden_character", "doctor strange crop must be forbidden_character");

  // 3) abóbora + tentáculos — no body transformation
  const pumpkin = analyzeSynthetic(beast, "synthetic:pumpkin", profileFromRegions(
    region({ redRatio: 0.2, blackRatio: 0.16, yellowRatio: 0.08, saturatedRatio: 0.38, blueRatio: 0.02, whiteRatio: 0.02 })
  ));
  assert(pumpkin.sceneClassification === "pumpkin_organic", "pumpkin crop must classify as pumpkin_organic");
  assert(!pumpkin.flags.transformationVisible.value, "pumpkin crop must not receive body transformation");
  assert(!pumpkin.flags.venomVisible.value, "pumpkin crop must not receive Venom");
  assert(pumpkin.symbioteSignals.organic_tendrils_visible.value, "pumpkin crop may expose organic tendrils");

  // 4) Homem-Aranha comum — no Venom
  const spiderSolo = analyzeSynthetic(beast, "synthetic:spider", profileFromRegions(
    region({ blueRatio: 0.12, redRatio: 0.06, blackRatio: 0.08, whiteRatio: 0.1, saturatedRatio: 0.15 })
  ));
  assert(spiderSolo.flags.spiderManVisible.value, "spider-man solo crop must set spiderManVisible");
  assert(!spiderSolo.flags.venomVisible.value, "spider-man solo crop must not receive Venom");

  // 5) traje preto claro — blackSuitVisible
  const blackSuit = analyzeSynthetic(beast, "synthetic:black-suit", profileFromRegions(
    region({ blackRatio: 0.48, blueRatio: 0.05, redRatio: 0.04, saturatedRatio: 0.2 })
  ));
  assert(blackSuit.flags.blackSuitVisible.value, "black suit crop must set blackSuitVisible");

  // 6) Venom visualmente claro — venomVisible
  const venom = analyzeSynthetic(beast, "synthetic:venom", profileFromRegions(
    region({ blackRatio: 0.36, whiteRatio: 0.05, blueRatio: 0.04, saturatedRatio: 0.22 })
  ));
  assert(venom.flags.venomVisible.value, "venom crop must set venomVisible");

  // 7) Venom + Homem-Aranha no mesmo crop — duoVisible
  const duo = analyzeSynthetic(beast, "synthetic:duo", profileFromRegions(
    region({ blackRatio: 0.11, blueRatio: 0.14, redRatio: 0.06, whiteRatio: 0.14, saturatedRatio: 0.26 })
  ));
  assert(duo.flags.venomVisible.value && duo.flags.spiderManVisible.value, "duo crop must confirm both heroes");
  assert(duo.flags.duoVisible.value, "duo crop must set duoVisible");

  // 8) análise incerta — unknown, not invented character
  const uncertain = analyzeSynthetic(beast, "synthetic:uncertain", profileFromRegions(
    region({ blueRatio: 0.09, redRatio: 0.03, blackRatio: 0.04, whiteRatio: 0.03, saturatedRatio: 0.08 })
  ));
  assert(uncertain.confirmedCharacters.length === 0, "uncertain crop must not invent confirmed characters");
  assert(
    uncertain.evidenceStatus === "uncertain" || uncertain.evidenceStatus === "no_relevant_evidence",
    "uncertain crop must stay uncertain or no_relevant_evidence"
  );

  const index = JSON.parse(await readFile(indexPath, "utf8"));
  const report = await reindexVariationBCropVisualEvidence({
    index,
    indexPath,
    projectRoot
  });

  const reportPath = join(projectRoot, "tmp", REINDEXED_VISUAL_EVIDENCE_FILENAME);
  const contactSheetPath = join(projectRoot, "tmp", REINDEXED_VISUAL_EVIDENCE_CONTACT_SHEET_FILENAME);
  assert(await fileExists(reportPath), `missing report: ${reportPath}`);
  assert(await fileExists(contactSheetPath), `missing contact sheet: ${contactSheetPath}`);

  for (const panelId of FALSE_POSITIVE_IDS) {
    const crop = report.crops.find((entry) => entry.panelId === panelId);
    assert(crop, `missing reindexed crop for ${panelId}`);
    assert(!crop.flags.venomVisible.value, `${panelId} must not keep Venom after reindex`);
    assert(!crop.flags.spiderManVisible.value, `${panelId} must not keep Spider-Man after reindex`);
    assert(!crop.flags.duoVisible.value, `${panelId} must not keep duo after reindex`);
    if (panelId.endsWith("page5:panel7")) {
      assert(crop.flags.doctorStrangeVisible.value, `${panelId} must confirm doctor strange`);
      assert(crop.evidenceStatus === "forbidden_character", `${panelId} must be forbidden_character`);
    } else {
      assert(
        crop.evidenceStatus === "no_relevant_evidence",
        `${panelId} must be no_relevant_evidence, got ${crop.evidenceStatus}`
      );
      assert(!crop.flags.transformationVisible.value, `${panelId} must not claim transformation`);
    }
  }

  const duoPanelId = "user-remix-asset-12da72de5ffb:page5:panel4";
  const duoPanel = index.pages.flatMap((page) => page.panels).find((panel) => panel.panelId === duoPanelId);
  if (duoPanel?.panelImagePath) {
    const visual = await analyzeComicsPanelVisual({ assetPath: duoPanel.panelImagePath });
    const duoEvidence = analyzeCropVisualEvidenceFromVisualVerdict({
      panelId: duoPanelId,
      panelImagePath: duoPanel.panelImagePath,
      panelImageSha256: duoPanel.panelImageSha256,
      visual
    });
    assert(duoEvidence.flags.duoVisible.value, "real duo panel must keep duoVisible after reindex rules");
  }

  const summary = {
    reindexedCropCount: report.reindexedCropCount,
    venomConfirmedCount: report.venomConfirmedCount,
    spiderManConfirmedCount: report.spiderManConfirmedCount,
    symbioteConfirmedCount: report.symbioteConfirmedCount,
    unknownCount: report.unknownCount,
    rejectedCount: report.rejectedCount,
    falsePositivePanels: report.falsePositivePanels.map((entry) => ({
      panelId: entry.panelId,
      reindexedStatus: entry.reindexedStatus,
      confirmedCharacters: entry.confirmedCharacters,
      venom: entry.flags.venomVisible.value,
      spiderMan: entry.flags.spiderManVisible.value,
      doctorStrange: entry.flags.doctorStrangeVisible.value,
      duo: entry.flags.duoVisible.value,
      transformation: entry.flags.transformationVisible?.value ?? false
    })),
    reportPath,
    contactSheetPath: report.contactSheetPath
  };

  console.log(JSON.stringify(summary, null, 2));
  console.log("[test-crop-visual-evidence] OK");
}

main().catch((error) => {
  console.error("[test-crop-visual-evidence] FAIL", error);
  process.exitCode = 1;
});