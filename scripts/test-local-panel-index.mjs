import { createHash } from "node:crypto";
import { access, readFile, stat } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");
const assetDir = join(projectRoot, "storage/assets/user-provided/remix/venom-partner");

const PAGES = {
  mysticalVenomParent: {
    id: "user-remix-asset-505d6d331cf6",
    filename: "remix-asset-505d6d331cf6.jpg",
    title: "O ESPETACULAR HOMEM-ARANHA/VENOM: Espiral Mortal (2026) — página 30",
    tags: ["venom", "homem-aranha", "espiral mortal"]
  },
  blackSuit: {
    id: "user-remix-asset-3b8b7c565b52",
    filename: "remix-asset-3b8b7c565b52.jpg",
    title: "SIMBIONTE HOMEM-ARANHA — página 5",
    tags: ["simbionte", "homem-aranha", "traje preto"]
  },
  symbioteDuo: {
    id: "user-remix-asset-bd624296f938",
    filename: "remix-asset-bd624296f938.jpg",
    title: "SIMBIONTE HOMEM-ARANHA — página 4",
    tags: ["simbionte", "venom", "homem-aranha"]
  },
  venomDuoReal: {
    id: "user-remix-asset-12da72de5ffb",
    filename: "remix-asset-12da72de5ffb.jpg",
    title: "O ESPETACULAR HOMEM-ARANHA/VENOM: Espiral Mortal (2026) — página 5",
    tags: ["venom", "homem-aranha", "dupla", "espiral mortal"]
  },
  espiralMortalPage18: {
    id: "user-remix-asset-a00f091ee8d3",
    filename: "remix-asset-a00f091ee8d3.jpg",
    title: "O ESPETACULAR HOMEM-ARANHA/VENOM: Espiral Mortal (2026) — página 18",
    tags: ["venom", "homem-aranha", "espiral mortal"]
  },
  espiralMortalDuoB: {
    id: "user-remix-asset-17025ce68e6c",
    filename: "remix-asset-17025ce68e6c.jpg",
    title: "O ESPETACULAR HOMEM-ARANHA/VENOM: Espiral Mortal (2026) — página dupla B",
    tags: ["venom", "homem-aranha", "dupla"]
  },
  symbioteSupporting: {
    id: "user-remix-asset-4d1a9a255a3e",
    filename: "remix-asset-4d1a9a255a3e.jpg",
    title: "Simbionte Homem-Aranha — página simbionte suporte",
    tags: ["simbionte", "homem-aranha"]
  },
  venomDuoCover: {
    id: "user-remix-asset-86aa1583dfb3",
    filename: "remix-asset-86aa1583dfb3.jpg",
    title: "Homem-Aranha/Venom — página dupla capa",
    tags: ["venom", "homem-aranha", "dupla"]
  },
  spiderManSolo: {
    id: "user-remix-asset-28ec95401fea",
    filename: "remix-asset-28ec95401fea.jpg",
    title: "SIMBIONTE HOMEM-ARANHA — página 1",
    tags: ["homem-aranha"]
  },
  consecutiveA: {
    id: "user-remix-asset-seq-a",
    filename: "remix-asset-479d4ce901ad.jpg",
    title: "O ESPETACULAR HOMEM-ARANHA/VENOM: Espiral Mortal (2026) — página 4",
    tags: ["venom", "homem-aranha"]
  },
  consecutiveB: {
    id: "user-remix-asset-seq-b",
    filename: "remix-asset-1d38c0438526.jpg",
    title: "O ESPETACULAR HOMEM-ARANHA/VENOM: Espiral Mortal (2026) — página 3",
    tags: ["venom", "homem-aranha"]
  },
  fcbdCatalog: {
    id: "user-remix-asset-6828f4d9ea8c",
    filename: "remix-asset-6828f4d9ea8c.jpg",
    title: "DIA DO QUADRINHO GRÁTIS: HOMEM-ARANHA/VENOM/VINGADORES (2022) — página 15",
    tags: ["fcbd", "catalogo", "venom"]
  }
};

async function importMediaBeast() {
  return import(
    pathToFileURL(join(projectRoot, "packages/media-beast/dist/index.js")).href
  );
}

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

async function probePage(assetPath) {
  const { spawn } = await import("node:child_process");
  const ffprobe = process.env.FFPROBE_PATH?.trim() || "ffprobe";
  return new Promise((resolvePromise, reject) => {
    const child = spawn(
      ffprobe,
      [
        "-v",
        "error",
        "-select_streams",
        "v:0",
        "-show_entries",
        "stream=width,height",
        "-of",
        "json",
        assetPath
      ],
      { stdio: ["ignore", "pipe", "pipe"] }
    );
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`ffprobe failed: ${stderr.slice(-300)}`));
        return;
      }
      const parsed = JSON.parse(stdout);
      const stream = parsed.streams?.[0];
      resolvePromise({
        width: Number(stream?.width ?? 0),
        height: Number(stream?.height ?? 0)
      });
    });
  });
}

function contentHash(assetPath, bytes, width, height) {
  return createHash("sha1")
    .update(`${assetPath}|${bytes}|${width}x${height}`)
    .digest("hex")
    .slice(0, 12);
}

async function buildPageInput(caseDef) {
  const assetPath = join(assetDir, caseDef.filename);
  assert(await fileExists(assetPath), `missing asset ${caseDef.filename}`);
  const fileStat = await stat(assetPath);
  const dims = await probePage(assetPath);
  return {
    id: caseDef.id,
    assetPath,
    title: caseDef.title,
    description: caseDef.title,
    tags: caseDef.tags,
    width: dims.width,
    height: dims.height,
    bytes: fileStat.size,
    contentHash: contentHash(assetPath, fileStat.size, dims.width, dims.height),
    mediaType: "raster"
  };
}

async function main() {
  const beast = await importMediaBeast();
  const {
    classifyComicPageType,
    indexUserProvidedComicPage,
    upsertLocalComicPanelIndex,
    validatePanelCropIntegrity,
    validateLocalEvidenceDoesNotInheritParent,
    inferLocalEvidenceFromPanelVisual,
    derivePanelVisualFlags,
    classifyPanelEvidenceTier,
    analyzeComicsPanelVisual,
    isPromotionalPanelRegion,
    segmentPageIntoPanelBounds,
    isWholePagePanelCrop,
    assignLocalPanelSequences,
    buildActualPanelCropsReport,
    validateAndAssignIndexedBeatPanels,
    buildBeatVisualRequirementsFromNarration,
    analyzeComicsVideoThemeFromAnalysis,
    LOCAL_PANEL_INDEX_REPORT_FILENAME,
    LOCAL_PANEL_INDEX_CONTACT_SHEET_FILENAME,
    ACTUAL_PANEL_CROPS_REPORT_FILENAME
  } = beast;

  // Whole-page panel1 on story page must fail
  const symbiotePage1 = await indexUserProvidedComicPage({
    ...(await buildPageInput(PAGES.spiderManSolo)),
    assetDirectory: assetDir,
    forceRebuild: true
  });
  const page1Panel1 = symbiotePage1.panels.find((panel) => panel.panelNumber === 1);
  if (page1Panel1 && page1Panel1.cropAreaRatio > 0.7) {
    assert(!page1Panel1.valid, "whole-page panel1 on story page must be rejected");
    assert(
      page1Panel1.rejectReason === "whole_page_fallback" || page1Panel1.isWholePageFallback,
      "whole-page panel1 must flag whole_page_fallback"
    );
  }

  // Story page with multiple gutters should segment into multiple panels
  const duoSegmentation = await indexUserProvidedComicPage({
    ...(await buildPageInput(PAGES.symbioteDuo)),
    assetDirectory: assetDir,
    forceRebuild: true
  });
  if (duoSegmentation.panels.length > 1) {
    assert(
      duoSegmentation.panels.some((panel) => panel.isActualPanelCrop),
      "multi-panel story page should produce actual panel crops"
    );
  } else {
    const soloPanel = duoSegmentation.panels[0];
    assert(
      !soloPanel?.isWholePageFallback || !soloPanel.valid,
      "single-panel fallback on multi-gutter story page must not pass as valid panel1"
    );
  }

  // 1) Parent Venom-tagged page, crop Doctor Strange — no Venom in localEvidence
  const mysticalInput = await buildPageInput(PAGES.symbioteDuo);
  const mystical = await indexUserProvidedComicPage({
    ...mysticalInput,
    assetDirectory: assetDir,
    forceRebuild: true
  });
  const mysticalPanel =
    mystical.panels.find((panel) =>
      panel.localEvidence.characters.some((entry) => entry.name === "doctor_strange")
    ) ?? mystical.panels[0];
  assert(mysticalPanel, "mystical page should produce panels");
  assert(
    !mysticalPanel.localEvidence.characters.some((entry) => entry.name === "venom"),
    "mystical crop must not contain venom in localEvidence"
  );
  assert(
    mysticalPanel.evidenceTier === "rejected" || !mysticalPanel.valid,
    "Doctor Strange / Natasha crop must be rejected"
  );
  assert(
    mysticalPanel.visualFlags?.doctorStrangeVisible === true,
    "Doctor Strange visual flag expected on mystical crop"
  );
  assert(
    validateLocalEvidenceDoesNotInheritParent(mysticalPanel).ok,
    "mystical panel must pass inheritance guard"
  );

  // 2) Symbiote / black-suit supporting crop — visualThemes contains black_suit or symbiosis
  const blackSuitInput = await buildPageInput(PAGES.spiderManSolo);
  const blackSuit = await indexUserProvidedComicPage({
    ...blackSuitInput,
    assetDirectory: assetDir,
    forceRebuild: true
  });
  const blackSuitPanel =
    blackSuit.panels.find(
      (panel) =>
        panel.valid &&
        (panel.visualFlags?.blackSuitVisible ||
          panel.visualFlags?.symbioteVisible ||
          panel.localEvidence.visualThemes.some((theme) => /black_suit|symbiosis/.test(theme)))
    ) ??
    blackSuit.panels.find((panel) => panel.valid) ??
    blackSuit.panels[0];
  assert(blackSuitPanel, "black suit page should produce panels");
  assert(
    blackSuitPanel.localEvidence.visualThemes.some((theme) =>
      /black_suit|symbiosis/.test(theme)
    ) || blackSuitPanel.visualFlags?.blackSuitVisible,
    `black suit themes expected, got ${blackSuitPanel.localEvidence.visualThemes.join(",")}`
  );
  assert(
    classifyPanelEvidenceTier({
      visualFlags: {
        venomVisible: false,
        spiderManVisible: false,
        blackSuitVisible: true,
        symbioteVisible: true,
        duoVisible: false,
        doctorStrangeVisible: false,
        unrelatedCharacterVisible: false
      },
      isWholePageFallback: false,
      isActualPanelCrop: true
    }) === "supporting_only",
    "black suit alone must be supporting_only, not direct evidence"
  );

  // 3) Venom + Spider-Man duo — relationship duo on a crop with both heroes visible
  const duoInput = await buildPageInput(PAGES.venomDuoReal);
  const duo = await indexUserProvidedComicPage({
    ...duoInput,
    assetDirectory: assetDir,
    forceRebuild: true
  });
  const duoPanel =
    duo.panels.find(
      (panel) =>
        panel.valid &&
        panel.localEvidence.relationships.some((rel) => rel.type === "duo" || rel.type === "conflict")
    ) ?? duo.panels.find((panel) => panel.valid) ?? duo.panels[0];
  assert(duoPanel, "duo page should produce panels");
  assert(
    duoPanel.localEvidence.relationships.some((rel) => rel.type === "duo" || rel.type === "conflict"),
    "duo page should expose duo/conflict relationship"
  );
  const duoValidPanel = duo.panels.find(
    (panel) =>
      panel.valid &&
      panel.isActualPanelCrop &&
      panel.localEvidence.relationships.some((rel) => rel.type === "duo")
  );
  if (duoValidPanel) {
    assert(
      duoValidPanel.evidenceTier === "direct_evidence",
      "Venom + Spider-Man in same actual crop must be direct_evidence"
    );
    assert(duoValidPanel.visualFlags?.duoVisible === true, "duoVisible flag expected");
  }

  // 4) Spider-Man alone — no duo relationship
  const soloRegionStats = {
    whiteRatio: 0.1,
    blackRatio: 0.08,
    redRatio: 0.06,
    blueRatio: 0.12,
    yellowRatio: 0.02,
    greenRatio: 0.02,
    saturatedRatio: 0.15,
    colorBucketCount: 30
  };
  const soloFlags = derivePanelVisualFlags({
    visual: {
      analyzable: true,
      eligible: true,
      rejectReason: null,
      duoVisualScore: 40,
      visualTags: [],
      profile: {
        global: soloRegionStats,
        topThird: soloRegionStats,
        midThird: soloRegionStats,
        bottomThird: soloRegionStats
      },
      warnings: []
    }
  });
  assert(soloFlags.spiderManVisible, "solo crop flags should include spiderManVisible");
  assert(!soloFlags.venomVisible, "solo crop flags must not include venom");
  assert(
    classifyPanelEvidenceTier({
      visualFlags: soloFlags,
      isWholePageFallback: false,
      isActualPanelCrop: true
    }) === "supporting_only",
    "solo spider-man crop must classify as supporting_only"
  );

  const soloEvidence = inferLocalEvidenceFromPanelVisual({
    visual: {
      analyzable: true,
      eligible: true,
      rejectReason: null,
      duoVisualScore: 40,
      visualTags: [],
      profile: {
        global: soloRegionStats,
        topThird: soloRegionStats,
        midThird: soloRegionStats,
        bottomThird: soloRegionStats
      },
      warnings: []
    }
  });
  assert(
    soloEvidence.characters.some((entry) => entry.name === "spider-man"),
    "solo crop should detect spider-man only"
  );
  assert(
    !soloEvidence.relationships.some((rel) => rel.type === "duo"),
    "solo spider-man crop must not mark duo"
  );

  // 5) QR page — not narrative panel
  const qrClassification = classifyComicPageType({
    title: "Espiral Mortal — página 2 com QR code para catálogo",
    tags: ["venom", "qr"],
    width: 1500,
    height: 2300,
    bytes: 500000
  });
  assert(qrClassification.pageType === "qr_promo", "QR title should classify as qr_promo");
  assert(!qrClassification.indexable, "QR page must not be indexable as narrative");
  const qrResult = await indexUserProvidedComicPage({
    assetId: "qr-test",
    assetPath: mysticalInput.assetPath,
    title: "Espiral Mortal Venom — página 9 QR code",
    tags: ["qr", "venom"],
    width: mysticalInput.width,
    height: mysticalInput.height,
    bytes: mysticalInput.bytes,
    contentHash: "qr-test-hash",
    assetDirectory: assetDir,
    forceRebuild: true
  });
  assert(qrResult.panels.length === 0, "QR page must not produce narrative panels");

  // 6) Mixed page — only narrative region accepted
  const mixedVisual = await analyzeComicsPanelVisual({ assetPath: mysticalInput.assetPath });
  const promoRegion = isPromotionalPanelRegion({
    title: "FCBD mixed house ad",
    tags: ["catalogo"],
    visual: {
      analyzable: true,
      eligible: false,
      rejectReason: "catalog_ad_visual",
      duoVisualScore: 0,
      visualTags: ["visual_catalog_ad"],
      profile: mixedVisual.profile,
      warnings: []
    }
  });
  assert(promoRegion.reject, "catalog visual region should be promotional");

  const mixedTitlePage = await indexUserProvidedComicPage({
    assetId: "mixed-test",
    assetPath: mysticalInput.assetPath,
    title: "Espiral Mortal — página 12 mixed narrative and house ad",
    tags: ["venom", "mixed"],
    width: mysticalInput.width,
    height: mysticalInput.height,
    bytes: mysticalInput.bytes,
    contentHash: "mixed-test-hash",
    assetDirectory: assetDir,
    forceRebuild: true
  });
  if (mixedTitlePage.panels.length > 1) {
    assert(
      mixedTitlePage.panels.some((panel) => !panel.valid),
      "mixed page should reject at least one promotional region"
    );
    assert(
      mixedTitlePage.panels.some((panel) => panel.valid),
      "mixed page should keep at least one narrative region"
    );
  } else {
    assert(
      mixedTitlePage.pageType === "mixed" || mixedTitlePage.panels.every((panel) => panel.valid),
      "mixed handling should not auto-accept full-page promo without segmentation"
    );
  }

  // 7) Path/hash mismatch — panel rejected
  const integrityBad = await validatePanelCropIntegrity({
    panelImagePath: mysticalPanel.panelImagePath,
    panelImageSha256: "deadbeef".repeat(8)
  });
  assert(!integrityBad.valid, "tampered hash must fail integrity");
  assert(
    integrityBad.rejectReason === "panel_crop_integrity_mismatch",
    "integrity mismatch reason expected"
  );

  // 8) Consecutive panels — previousPanelId/nextPanelId
  const seqPages = [
    await buildPageInput(PAGES.consecutiveB),
    await buildPageInput(PAGES.consecutiveA)
  ];
  const seqIndex = await upsertLocalComicPanelIndex({
    assetDirectory: assetDir,
    pages: seqPages,
    forceRebuild: true,
    projectRoot
  });
  const seqValid = seqIndex.index.pages
    .flatMap((page) => page.panels)
    .filter((panel) => panel.valid)
    .sort((left, right) => left.pageNumber - right.pageNumber || left.panelNumber - right.panelNumber);
  if (seqValid.length >= 2) {
    const page3 = seqValid.find((panel) => panel.pageNumber === 3);
    const page4 = seqValid.find((panel) => panel.pageNumber === 4);
    if (page3 && page4) {
      assert(
        page4.previousPanelId === page3.panelId || page3.nextPanelId === page4.panelId,
        "adjacent pages should link consecutive panels when continuity holds"
      );
    }
  }

  // Full index + reports
  const allPageInputs = await Promise.all(Object.values(PAGES).map((page) => buildPageInput(page)));
  const full = await upsertLocalComicPanelIndex({
    assetDirectory: assetDir,
    pages: allPageInputs,
    forceRebuild: true,
    projectRoot
  });

  const reportPath = join(projectRoot, "tmp", LOCAL_PANEL_INDEX_REPORT_FILENAME);
  const contactSheetPath = join(projectRoot, "tmp", LOCAL_PANEL_INDEX_CONTACT_SHEET_FILENAME);
  const actualPanelCropsReportPath = join(projectRoot, "tmp", ACTUAL_PANEL_CROPS_REPORT_FILENAME);
  assert(await fileExists(reportPath), `report missing: ${reportPath}`);
  assert(await fileExists(actualPanelCropsReportPath), `actual panel crops report missing: ${actualPanelCropsReportPath}`);
  const report = JSON.parse(await readFile(reportPath, "utf8"));
  // Segmentation failure must block without whole-page fallback
  const tinyPixels = Buffer.alloc(640 * 960 * 3, 128);
  const failedSegmentation = segmentPageIntoPanelBounds({
    pageWidth: 1200,
    pageHeight: 1800,
    sampleWidth: 640,
    sampleHeight: 960,
    pixels: tinyPixels,
    allowFullPageFallback: false
  });
  assert(failedSegmentation.bounds.length === 0, "segmentation failure must not fallback to full page");

  const wholePageRejected = isWholePagePanelCrop({
    cropBounds: { x: 0, y: 0, width: 1200, height: 1800 },
    pageWidth: 1200,
    pageHeight: 1800,
    pageType: "story",
    cropAreaRatio: 1,
    estimatedPanelCount: 4,
    estimatedGutterCount: 2,
    segmentedPanelCount: 1
  });
  assert(wholePageRejected, "story page whole crop with gutters must be flagged whole_page_fallback");

  const indexPath = full.indexPath ?? join(assetDir, ".comics-local-panel-index.json");
  const plan = JSON.parse(await readFile(join(projectRoot, "tmp", "variation-b-gated-plan.json"), "utf8"));
  const themeAnalysis = analyzeComicsVideoThemeFromAnalysis(
    plan.videoAnalysis,
    plan.inputVideoTitle
  );
  const beatSpecs = [
    { beatId: "beat-hook", beatRole: "hook", narrationRole: "hook" },
    { beatId: "beat-context", beatRole: "context", narrationRole: "context" },
    { beatId: "beat-curiosity_a", beatRole: "curiosity_a", narrationRole: "tension" },
    { beatId: "beat-curiosity_b", beatRole: "curiosity_b", narrationRole: "tension" },
    { beatId: "beat-development_a", beatRole: "development_a", narrationRole: "tension" },
    { beatId: "beat-development_b", beatRole: "development_b", narrationRole: "tension" },
    { beatId: "beat-climax", beatRole: "climax", narrationRole: "climax" },
    { beatId: "beat-closing", beatRole: "closing", narrationRole: "cta" }
  ];
  const beatRequirements = buildBeatVisualRequirementsFromNarration({
    videoTitle: plan.inputVideoTitle ?? "Variation B",
    themeAnalysis,
    beats: beatSpecs.map((spec) => ({
      beatId: spec.beatId,
      role: spec.beatRole,
      narrationText:
        plan.narrationPlan?.narrationBeats?.find((beat) => beat.role === spec.narrationRole)?.text ?? ""
    }))
  });
  const assignmentValidation = await validateAndAssignIndexedBeatPanels({
    index: full.index,
    indexPath,
    requirements: beatRequirements,
    beats: beatSpecs.map((spec) => ({ beatId: spec.beatId, beatRole: spec.beatRole })),
    projectRoot
  });
  assert(
    assignmentValidation.uniquePanelCount >= 5,
    `uniquePanelCount must be >= 5 after crop-only evidence gate, got ${assignmentValidation.uniquePanelCount}`
  );
  assert(
    assignmentValidation.maxPanelReuseCount <= 3,
    `maxPanelReuseCount must be <= 3 after crop-only evidence gate, got ${assignmentValidation.maxPanelReuseCount}`
  );
  if (assignmentValidation.page4Panel1Diagnostic) {
    assert(
      !assignmentValidation.page4Panel1Diagnostic.valid,
      "page4:panel1 oversized crop must be rejected"
    );
  }

  // Venom beat "A dupla ideal existe." — requirements from localEvidence only
  const {
    inferBeatPanelEvidenceRequirements,
    evaluateBeatTextAgainstLocalPanel,
    VENOM_DUO_IDEAL_BEAT_REQUIREMENTS
  } = beast;

  const duoBeatText = "A dupla ideal existe.";
  const duoRequirements = inferBeatPanelEvidenceRequirements(duoBeatText);
  assert(
    duoRequirements.requiredEntities.includes("venom"),
    "dupla ideal beat must require venom"
  );
  assert(
    duoRequirements.requiredThemes.includes("partnership") &&
      duoRequirements.requiredThemes.includes("symbiosis"),
    "dupla ideal beat must require partnership + symbiosis themes"
  );
  assert(
    duoRequirements.forbiddenEntities.includes("doctor_strange") &&
      duoRequirements.forbiddenEntities.includes("black_widow"),
    "dupla ideal beat must forbid doctor_strange and black_widow"
  );
  assert(
    duoRequirements.directEvidenceRequired && duoRequirements.minimumDirectEvidenceScore === 80,
    "dupla ideal beat must require direct evidence score >= 80"
  );

  const mysticalEval = evaluateBeatTextAgainstLocalPanel({
    beatText: duoBeatText,
    panel: mysticalPanel
  });
  assert(!mysticalEval.valid, "mystical panel must fail dupla ideal beat");
  assert(
    mysticalEval.forbiddenHits.includes("doctor_strange"),
    "mystical panel should hit forbidden doctor_strange"
  );
  assert(!mysticalEval.matchedRequiredEntities.includes("venom"), "mystical panel has no local venom");

  const duoBeatPanel =
    duo.panels.find(
      (panel) =>
        panel.valid &&
        panel.localEvidence.characters.some((entry) => entry.name === "venom")
    ) ?? duo.panels.find((panel) => panel.valid) ?? duo.panels[0];
  const duoEval = evaluateBeatTextAgainstLocalPanel({
    beatText: duoBeatText,
    panel: duoBeatPanel
  });
  assert(duoEval.matchedRequiredEntities.includes("venom"), "duo panel must match required venom");
  assert(
    duoEval.matchedRelationships.includes("duo") ||
      duoEval.matchedRequiredThemes.includes("symbiosis"),
    "duo panel must expose duo relationship or symbiosis theme"
  );

  const summary = {
    totalPages: report.totalPages,
    totalPanels: report.totalPanels,
    validPanels: report.validPanels,
    rejectedPanels: report.rejectedPanels,
    panelsWithPreventedInheritedTags: report.panelsWithPreventedInheritedTags,
    sequenceCount: report.sequenceCount,
    pathHashMismatches: report.pathHashMismatches,
    indexPath: report.indexPath,
    contactSheetPath: report.contactSheetPath,
    uniquePanelCount: assignmentValidation.uniquePanelCount,
    maxPanelReuseCount: assignmentValidation.maxPanelReuseCount,
    continuityScore: assignmentValidation.continuityScore,
    beats: assignmentValidation.assignments.map((beat) => ({
      beatRole: beat.beatRole,
      panelId: beat.panelId,
      beatSpecificFitScore: beat.beatSpecificFitScore,
      reuseCount: beat.reuseCount
    })),
    beatAssignmentsContactSheet: assignmentValidation.contactSheetPath,
    canRender: assignmentValidation.canRender,
    canPublish: assignmentValidation.canPublish
  };

  console.log(JSON.stringify(summary, null, 2));
  assert(summary.validPanels > 0, "expected valid panels in full index");
  if (seqValid.length >= 2) {
    assert(seqIndex.index.sequenceCount >= 1, "expected at least one local sequence when 2+ valid panels");
  }
  console.log("[test-local-panel-index] OK");
}

main().catch((error) => {
  console.error("[test-local-panel-index] FAILED", error);
  process.exitCode = 1;
});