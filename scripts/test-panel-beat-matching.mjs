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

const symbioteDuoProfile = {
  global: {
    whiteRatio: 0.08,
    blackRatio: 0.18,
    redRatio: 0.06,
    blueRatio: 0.14,
    yellowRatio: 0.01,
    greenRatio: 0.02,
    saturatedRatio: 0.22,
    colorBucketCount: 36
  },
  topThird: {
    whiteRatio: 0.07,
    blackRatio: 0.16,
    redRatio: 0.05,
    blueRatio: 0.13,
    yellowRatio: 0.01,
    greenRatio: 0.02,
    saturatedRatio: 0.2,
    colorBucketCount: 34
  },
  midThird: {
    whiteRatio: 0.08,
    blackRatio: 0.19,
    redRatio: 0.06,
    blueRatio: 0.15,
    yellowRatio: 0.01,
    greenRatio: 0.02,
    saturatedRatio: 0.23,
    colorBucketCount: 36
  },
  bottomThird: {
    whiteRatio: 0.09,
    blackRatio: 0.21,
    redRatio: 0.06,
    blueRatio: 0.14,
    yellowRatio: 0.01,
    greenRatio: 0.02,
    saturatedRatio: 0.24,
    colorBucketCount: 37
  }
};

function mockAsset(overrides) {
  return {
    id: overrides.id,
    filename: `${overrides.id}.jpg`,
    assetPath: `/tmp/${overrides.id}.jpg`,
    title: overrides.title,
    description: overrides.description ?? overrides.title,
    tags: overrides.tags ?? [],
    sourceType: "user_provided",
    approvalStatus: "approved_by_user",
    rightsStatus: "rights_confirmed_by_user",
    mediaType: "raster",
    width: 2000,
    height: 3000,
    bytes: 500000,
    cropable9x16: true,
    contentHash: overrides.id,
    themeScore: 80,
    venomDirect: true,
    hookStrength: 80,
    climaxStrength: 80,
    recommendedBeat: "development",
    selectionSignals: overrides.selectionSignals ?? [],
    rejectReason: null,
    accepted: true,
    duoVisualScore: overrides.duoVisualScore ?? 70,
    visualTags: overrides.visualTags ?? [],
    visualRejectReason: overrides.visualRejectReason ?? null,
    visualAnalysis: overrides.visualAnalysis ?? null
  };
}

async function main() {
  const {
    computeBeatPanelMatchScore,
    buildPanelScoreMatrix,
    simulateGreedyPanelAssignment,
    assignPanelsToBeatsGlobally,
    validateGlobalPanelAssignment,
    hasSignificantMultiRegionCrop,
    buildPanelCropDescriptor,
    validateScoredCropMaterialization
  } = await importMediaBeast();

  const symbioteVisual = {
    analyzable: true,
    eligible: true,
    rejectReason: null,
    visualTags: ["visual_symbiote_duo"],
    profile: symbioteDuoProfile,
    warnings: []
  };

  const peterJohnnyHook = computeBeatPanelMatchScore({
    beatRole: "hook",
    beatText: "Venom encontrou o parceiro perfeito — e isso não é só do filme.",
    asset: mockAsset({
      id: "peter-johnny",
      title: "O ESPETACULAR HOMEM-ARANHA/VENOM: Espiral Mortal (2026) — página 5",
      tags: ["intelligent-discovery"],
      selectionSignals: ["panel_kind:story_panel", "duo_visual_score:22"],
      visualTags: ["visual_ensemble_cameo"],
      duoVisualScore: 22,
      visualAnalysis: {
        analyzable: true,
        eligible: false,
        rejectReason: "mystical_off_theme_hero",
        duoVisualScore: 22,
        visualTags: ["visual_ensemble_cameo", "visual_mystical_off_theme"],
        profile: {
          global: {
            whiteRatio: 0.08,
            blackRatio: 0.24,
            redRatio: 0.03,
            blueRatio: 0.08,
            yellowRatio: 0.01,
            greenRatio: 0.02,
            saturatedRatio: 0.09,
            colorBucketCount: 48
          },
          topThird: {
            whiteRatio: 0.05,
            blackRatio: 0.28,
            redRatio: 0.02,
            blueRatio: 0.1,
            yellowRatio: 0,
            greenRatio: 0,
            saturatedRatio: 0.08,
            colorBucketCount: 46
          },
          midThird: {
            whiteRatio: 0.09,
            blackRatio: 0.22,
            redRatio: 0.03,
            blueRatio: 0.07,
            yellowRatio: 0.01,
            greenRatio: 0.01,
            saturatedRatio: 0.09,
            colorBucketCount: 47
          },
          bottomThird: {
            whiteRatio: 0.1,
            blackRatio: 0.2,
            redRatio: 0.04,
            blueRatio: 0.06,
            yellowRatio: 0.02,
            greenRatio: 0.03,
            saturatedRatio: 0.1,
            colorBucketCount: 45
          }
        },
        warnings: []
      }
    })
  });
  assert(!peterJohnnyHook.meetsMinimum, "Peter/Johnny hook should be rejected");
  assert(peterJohnnyHook.score <= 40, `Peter/Johnny hook score should be <=40, got ${peterJohnnyHook.score}`);

  const doctorStrangeSymbiosis = computeBeatPanelMatchScore({
    beatRole: "climax",
    beatText: "A simbiose certa, a química visual, os dois juntos — é isso que a galera chama de dupla ideal.",
    asset: mockAsset({
      id: "strange-natasha",
      title: "O ESPETACULAR HOMEM-ARANHA/VENOM: Espiral Mortal (2026) — página 33",
      tags: ["intelligent-discovery"],
      selectionSignals: ["visual_mystical_off_theme", "duo_visual_score:18"],
      visualTags: ["visual_mystical_off_theme", "visual_ensemble_cameo"],
      duoVisualScore: 18,
      visualRejectReason: "mystical_off_theme_hero"
    })
  });
  assert(!doctorStrangeSymbiosis.meetsMinimum, "Doctor Strange/Natasha symbiosis climax should be rejected");
  assert(
    doctorStrangeSymbiosis.breakdown.rejectedBecause.length > 0,
    "Doctor Strange panel should list rejection reasons"
  );

  const textHeavyProfile = {
    global: {
      whiteRatio: 0.44,
      blackRatio: 0.05,
      redRatio: 0.02,
      blueRatio: 0.03,
      yellowRatio: 0.01,
      greenRatio: 0.01,
      saturatedRatio: 0.06,
      colorBucketCount: 18
    },
    topThird: {
      whiteRatio: 0.44,
      blackRatio: 0.05,
      redRatio: 0.02,
      blueRatio: 0.03,
      yellowRatio: 0.01,
      greenRatio: 0.01,
      saturatedRatio: 0.06,
      colorBucketCount: 18
    },
    midThird: {
      whiteRatio: 0.44,
      blackRatio: 0.05,
      redRatio: 0.02,
      blueRatio: 0.03,
      yellowRatio: 0.01,
      greenRatio: 0.01,
      saturatedRatio: 0.06,
      colorBucketCount: 18
    },
    bottomThird: {
      whiteRatio: 0.44,
      blackRatio: 0.05,
      redRatio: 0.02,
      blueRatio: 0.03,
      yellowRatio: 0.01,
      greenRatio: 0.01,
      saturatedRatio: 0.06,
      colorBucketCount: 18
    }
  };

  const dialogueNoVenomPartner = computeBeatPanelMatchScore({
    beatRole: "context",
    beatText: "Nos quadrinhos, essa dupla Venom e Homem-Aranha vira obsessão dos fãs.",
    asset: mockAsset({
      id: "dialogue-page",
      title: "O ESPETACULAR HOMEM-ARANHA/VENOM: Espiral Mortal (2026) — página 18",
      tags: ["venom", "homem-aranha", "intelligent-discovery"],
      selectionSignals: ["visual_symbiote_duo", "duo_visual_score:88"],
      visualTags: ["visual_symbiote_duo"],
      duoVisualScore: 88,
      visualAnalysis: {
        analyzable: true,
        eligible: true,
        rejectReason: null,
        duoVisualScore: 12,
        visualTags: ["visual_text_heavy"],
        profile: textHeavyProfile,
        warnings: []
      }
    })
  });
  assert(
    dialogueNoVenomPartner.score < 65,
    `dialogue page without local Venom should score low (${dialogueNoVenomPartner.score})`
  );
  assert(
    !dialogueNoVenomPartner.meetsMinimum ||
      dialogueNoVenomPartner.breakdown.rejectedBecause.length > 0,
    "dialogue-only page should not pass as partner beat"
  );

  const dialogueSymbiosisClimax = computeBeatPanelMatchScore({
    beatRole: "climax",
    beatText: "A simbiose certa, a química visual, os dois juntos — é isso que a galera chama de dupla ideal.",
    asset: mockAsset({
      id: "dialogue-climax",
      title: "O ESPETACULAR HOMEM-ARANHA/VENOM: Espiral Mortal (2026) — página 18",
      tags: ["venom", "homem-aranha"],
      visualTags: ["visual_symbiote_duo"],
      duoVisualScore: 90,
      visualAnalysis: {
        analyzable: true,
        eligible: true,
        rejectReason: null,
        duoVisualScore: 10,
        visualTags: ["visual_text_heavy"],
        profile: textHeavyProfile,
        warnings: []
      }
    })
  });
  assert(!dialogueSymbiosisClimax.meetsMinimum, "dialogue page should fail symbiosis climax");
  assert(
    dialogueSymbiosisClimax.breakdown.rejectedBecause.includes("dialogue_page_without_venom"),
    "dialogue symbiosis should cite dialogue_page_without_venom"
  );

  const cropAsset = mockAsset({
    id: "crop-bind",
    title: "Simbionte Homem-Aranha — página 4",
    tags: ["simbionte"],
    visualTags: ["visual_symbiote_duo"],
    duoVisualScore: 78
  });
  const cropDescriptor = buildPanelCropDescriptor(cropAsset);
  const cropMismatch = validateScoredCropMaterialization({
    assignment: {
      assetId: cropAsset.id,
      assetPath: cropAsset.assetPath,
      panelId: cropDescriptor.panelId,
      panelImagePath: cropDescriptor.panelImagePath,
      cropBounds: cropDescriptor.cropBounds,
      cropContentHash: cropDescriptor.cropContentHash
    },
    materializedAssetPath: cropAsset.assetPath
  });
  assert(!cropMismatch.ok, "materialized full page should fail crop binding validation");
  const cropMatch = validateScoredCropMaterialization({
    assignment: {
      assetId: cropAsset.id,
      assetPath: cropAsset.assetPath,
      panelId: cropDescriptor.panelId,
      panelImagePath: cropDescriptor.panelImagePath,
      cropBounds: cropDescriptor.cropBounds,
      cropContentHash: cropDescriptor.cropContentHash
    },
    materializedAssetPath: cropDescriptor.panelImagePath
  });
  assert(cropMatch.ok, "materialized crop path should pass crop binding validation");

  const weakSpidermanOnly = computeBeatPanelMatchScore({
    beatRole: "climax",
    beatText: "A simbiose certa, a química visual, os dois juntos — é isso que a galera chama de dupla ideal.",
    asset: mockAsset({
      id: "spider-only",
      title: "O ESPANTOSO HOMEM-ARANHA v7 — página 3",
      tags: ["homem-aranha", "spiderman_entity"],
      selectionSignals: ["spiderman_entity", "duo_visual_score:18"],
      duoVisualScore: 18,
      visualTags: []
    })
  });
  assert(weakSpidermanOnly.score < 70, `generic spider symbiosis should be low, got ${weakSpidermanOnly.score}`);
  assert(!weakSpidermanOnly.meetsMinimum, "generic spider symbiosis climax should fail minimum");

  const symbiosisBlackSuit = computeBeatPanelMatchScore({
    beatRole: "climax",
    beatText: "A simbiose certa, a química visual, os dois juntos — é isso que a galera chama de dupla ideal.",
    asset: mockAsset({
      id: "black-suit",
      title: "Simbionte Homem-Aranha — traje preto — página 4",
      tags: ["simbionte", "traje preto", "homem-aranha"],
      selectionSignals: ["visual_symbiote_duo", "duo_visual_score:78", "simbionte_pt"],
      visualTags: ["visual_symbiote_duo"],
      duoVisualScore: 78,
      visualAnalysis: {
        analyzable: true,
        eligible: true,
        rejectReason: null,
        duoVisualScore: 78,
        visualTags: ["visual_symbiote_duo"],
        profile: symbioteDuoProfile,
        warnings: []
      }
    })
  });
  assert(symbiosisBlackSuit.score >= 75, `black suit symbiosis should be high, got ${symbiosisBlackSuit.score}`);
  assert(symbiosisBlackSuit.meetsMinimum, "black suit symbiosis should pass");

  const perfectDuo = computeBeatPanelMatchScore({
    beatRole: "hook",
    beatText: "Venom encontrou o parceiro perfeito — e isso não é só do filme.",
    asset: mockAsset({
      id: "duo-panel",
      title: "O ESPETACULAR HOMEM-ARANHA/VENOM: Espiral Mortal (2026) — página 7",
      tags: ["venom", "homem-aranha"],
      selectionSignals: ["visual_symbiote_duo", "duo_visual_score:90"],
      visualTags: ["visual_symbiote_duo"],
      duoVisualScore: 90,
      visualAnalysis: {
        analyzable: true,
        eligible: true,
        rejectReason: null,
        duoVisualScore: 90,
        visualTags: ["visual_symbiote_duo"],
        profile: symbioteDuoProfile,
        warnings: []
      }
    })
  });
  assert(perfectDuo.score >= 80, `duo hook should be very high, got ${perfectDuo.score}`);
  assert(perfectDuo.meetsMinimum, "duo hook should pass");

  const eddieTransform = computeBeatPanelMatchScore({
    beatRole: "climax",
    beatText: "A simbiose certa, a química visual, os dois juntos — é isso que a galera chama de dupla ideal.",
    asset: mockAsset({
      id: "eddie-transform",
      title: "Simbionte Homem-Aranha — página 2",
      description: "Eddie Brock em transformação simbiótica com o simbionte",
      tags: ["eddie brock", "simbionte", "transformação"],
      selectionSignals: ["visual_symbiote_duo", "duo_visual_score:86"],
      visualTags: ["visual_symbiote_duo"],
      duoVisualScore: 86,
      visualAnalysis: {
        analyzable: true,
        eligible: true,
        rejectReason: null,
        duoVisualScore: 86,
        visualTags: ["visual_symbiote_duo"],
        profile: symbioteDuoProfile,
        warnings: []
      }
    })
  });
  assert(eddieTransform.score >= 82, `Eddie symbiote transform should be very high, got ${eddieTransform.score}`);
  assert(eddieTransform.meetsMinimum, "Eddie symbiote transform should pass");

  const hobgoblinBlackSuit = computeBeatPanelMatchScore({
    beatRole: "climax",
    beatText: "A simbiose certa, a química visual, os dois juntos — é isso que a galera chama de dupla ideal.",
    asset: mockAsset({
      id: "hobgoblin-support",
      title: "Simbionte Homem-Aranha — página 6",
      description: "Hobgoblin e traje preto no mesmo painel",
      tags: ["hobgoblin", "traje preto"],
      selectionSignals: ["duo_visual_score:62"],
      visualTags: [],
      duoVisualScore: 62,
      visualAnalysis: {
        analyzable: true,
        eligible: true,
        rejectReason: null,
        duoVisualScore: 62,
        visualTags: [],
        profile: {
          global: {
            whiteRatio: 0.12,
            blackRatio: 0.26,
            redRatio: 0.04,
            blueRatio: 0.05,
            yellowRatio: 0.02,
            greenRatio: 0.02,
            saturatedRatio: 0.14,
            colorBucketCount: 28
          },
          topThird: {
            whiteRatio: 0.12,
            blackRatio: 0.24,
            redRatio: 0.04,
            blueRatio: 0.05,
            yellowRatio: 0.02,
            greenRatio: 0.02,
            saturatedRatio: 0.13,
            colorBucketCount: 27
          },
          midThird: {
            whiteRatio: 0.12,
            blackRatio: 0.27,
            redRatio: 0.04,
            blueRatio: 0.05,
            yellowRatio: 0.02,
            greenRatio: 0.02,
            saturatedRatio: 0.14,
            colorBucketCount: 28
          },
          bottomThird: {
            whiteRatio: 0.12,
            blackRatio: 0.28,
            redRatio: 0.04,
            blueRatio: 0.05,
            yellowRatio: 0.02,
            greenRatio: 0.02,
            saturatedRatio: 0.15,
            colorBucketCount: 29
          }
        },
        warnings: []
      }
    })
  });
  const perfectDuoClimax = computeBeatPanelMatchScore({
    beatRole: "climax",
    beatText:
      "A simbiose certa, a química visual, os dois juntos — é isso que a galera chama de dupla ideal.",
    asset: mockAsset({
      id: "duo-panel",
      title: "O ESPETACULAR HOMEM-ARANHA/VENOM: Espiral Mortal (2026) — página 7",
      tags: ["venom", "homem-aranha"],
      selectionSignals: ["visual_symbiote_duo", "duo_visual_score:90"],
      visualTags: ["visual_symbiote_duo"],
      duoVisualScore: 90,
      visualAnalysis: {
        analyzable: true,
        eligible: true,
        rejectReason: null,
        duoVisualScore: 90,
        visualTags: ["visual_symbiote_duo"],
        profile: symbioteDuoProfile,
        warnings: []
      }
    })
  });
  assert(
    hobgoblinBlackSuit.score < perfectDuoClimax.score,
    `Hobgoblin + black suit should be support, not top climax (${hobgoblinBlackSuit.score} vs ${perfectDuoClimax.score})`
  );
  assert(hobgoblinBlackSuit.score >= 55, `Hobgoblin support should still be medium/high, got ${hobgoblinBlackSuit.score}`);

  const promoRejected = computeBeatPanelMatchScore({
    beatRole: "climax",
    beatText: "A simbiose certa, a química visual, os dois juntos — é isso que a galera chama de dupla ideal.",
    asset: mockAsset({
      id: "promo",
      title: "DIA DO QUADRINHO GRÁTIS: HOMEM-ARANHA/VENOM — página 4",
      tags: ["venom", "homem-aranha", "fcbd"]
    })
  });
  assert(promoRejected.score === 0, "promotional climax panel should be rejected");

  const devA = mockAsset({
    id: "dev-a",
    title: "O ESPETACULAR HOMEM-ARANHA/VENOM: Espiral Mortal (2026) — página 3",
    tags: ["venom", "homem-aranha"],
    selectionSignals: ["visual_symbiote_duo", "duo_visual_score:72"],
    visualTags: ["visual_symbiote_duo"],
    duoVisualScore: 72,
    visualAnalysis: { ...symbioteVisual, duoVisualScore: 72 }
  });
  const consecutive = computeBeatPanelMatchScore({
    beatRole: "development_b",
    beatText: "O que torna essa parceria perfeita vem das HQs — e raramente aparece explicado no recorte de 60 segundos.",
    asset: mockAsset({
      id: "dev-b",
      title: "O ESPETACULAR HOMEM-ARANHA/VENOM: Espiral Mortal (2026) — página 4",
      tags: ["venom", "homem-aranha"],
      selectionSignals: ["visual_symbiote_duo", "duo_visual_score:70"],
      visualTags: ["visual_symbiote_duo"],
      duoVisualScore: 70,
      visualAnalysis: { ...symbioteVisual, duoVisualScore: 70 }
    }),
    previousAsset: devA
  });
  const randomJump = computeBeatPanelMatchScore({
    beatRole: "development_b",
    beatText: "O que torna essa parceria perfeita vem das HQs — e raramente aparece explicado no recorte de 60 segundos.",
    asset: mockAsset({
      id: "dev-rand",
      title: "SIMBIONTE HOMEM-ARANHA — página 1",
      tags: ["simbionte", "homem-aranha"],
      selectionSignals: ["visual_symbiote_duo", "duo_visual_score:68"],
      visualTags: ["visual_symbiote_duo"],
      duoVisualScore: 68,
      visualAnalysis: { ...symbioteVisual, duoVisualScore: 68 }
    }),
    previousAsset: devA
  });
  assert(
    consecutive.breakdown.storyFunctionScore > randomJump.breakdown.storyFunctionScore,
    `consecutive development pages should score higher on story continuity (${consecutive.breakdown.storyFunctionScore} vs ${randomJump.breakdown.storyFunctionScore})`
  );

  assert(
    peterJohnnyHook.breakdown.parentMetadataScore <= 10,
    "parent metadata from title should be capped"
  );
  assert(
    perfectDuo.breakdown.panelEntityScore > peterJohnnyHook.breakdown.panelEntityScore,
    "panel entity score should dominate over parent metadata"
  );

  const beatSpecs = [
    { beatRole: "hook", beatText: "Venom encontrou o parceiro perfeito — e isso não é só do filme.", startSec: 0, endSec: 4.5, motion: "punch_zoom" },
    { beatRole: "context", beatText: "Nos quadrinhos, essa dupla Venom e Homem-Aranha vira obsessão dos fãs.", startSec: 4.5, endSec: 9.5, motion: "push_in" },
    { beatRole: "curiosity_a", beatText: "O que torna essa parceria perfeita vem das HQs — e raramente aparece explicado no recorte de 60 segundos.", startSec: 9.5, endSec: 13, motion: "hold_pan" },
    { beatRole: "curiosity_b", beatText: "O que torna essa parceria perfeita vem das HQs — e raramente aparece explicado no recorte de 60 segundos.", startSec: 13, endSec: 16.5, motion: "hold_pan" },
    { beatRole: "development_a", beatText: "O que torna essa parceria perfeita vem das HQs — e raramente aparece explicado no recorte de 60 segundos.", startSec: 16.5, endSec: 20.5, motion: "slide_left" },
    { beatRole: "development_b", beatText: "O que torna essa parceria perfeita vem das HQs — e raramente aparece explicado no recorte de 60 segundos.", startSec: 20.5, endSec: 24.5, motion: "slide_right" },
    { beatRole: "climax", beatText: "A simbiose certa, a química visual, os dois juntos — é isso que a galera chama de dupla ideal.", startSec: 24.5, endSec: 32, motion: "punch_zoom" },
    { beatRole: "closing", beatText: "Qual dupla Venom e Homem-Aranha você prefere? Comenta.", startSec: 32, endSec: 40, motion: "pull_back" }
  ];

  const strongHook = mockAsset({
    id: "strong-hook",
    title: "O ESPETACULAR HOMEM-ARANHA/VENOM: Espiral Mortal (2026) — página 7",
    tags: ["venom", "homem-aranha"],
    selectionSignals: ["visual_symbiote_duo", "duo_visual_score:92"],
    visualTags: ["visual_symbiote_duo"],
    duoVisualScore: 92,
    visualAnalysis: { ...symbioteVisual, duoVisualScore: 92 }
  });
  const strongClimax = mockAsset({
    id: "strong-climax",
    title: "O ESPETACULAR HOMEM-ARANHA/VENOM: Espiral Mortal (2026) — página 18",
    tags: ["venom", "homem-aranha"],
    selectionSignals: ["visual_symbiote_duo", "duo_visual_score:100"],
    visualTags: ["visual_symbiote_duo"],
    duoVisualScore: 100,
    visualAnalysis: { ...symbioteVisual, duoVisualScore: 100 }
  });
  const supportA = mockAsset({
    id: "support-a",
    title: "O ESPETACULAR HOMEM-ARANHA/VENOM: Espiral Mortal (2026) — página 3",
    tags: ["venom", "homem-aranha"],
    selectionSignals: ["duo_visual_score:38"],
    duoVisualScore: 38
  });
  const supportB = mockAsset({
    id: "support-b",
    title: "SIMBIONTE HOMEM-ARANHA — página 1",
    tags: ["simbionte"],
    selectionSignals: ["visual_symbiote_duo", "duo_visual_score:72"],
    visualTags: ["visual_symbiote_duo"],
    duoVisualScore: 72,
    visualAnalysis: { ...symbioteVisual, duoVisualScore: 72 }
  });
  const supportC = mockAsset({
    id: "support-c",
    title: "SIMBIONTE HOMEM-ARANHA — página 4",
    tags: ["simbionte"],
    selectionSignals: ["visual_symbiote_duo", "duo_visual_score:70"],
    visualTags: ["visual_symbiote_duo"],
    duoVisualScore: 70,
    visualAnalysis: { ...symbioteVisual, duoVisualScore: 70 }
  });
  const supportD = mockAsset({
    id: "support-d",
    title: "SIMBIONTE HOMEM-ARANHA — página 5",
    tags: ["simbionte"],
    selectionSignals: ["visual_symbiote_duo", "duo_visual_score:68"],
    visualTags: ["visual_symbiote_duo"],
    duoVisualScore: 68,
    visualAnalysis: { ...symbioteVisual, duoVisualScore: 68 }
  });
  const supportE = mockAsset({
    id: "support-e",
    title: "Simbionte Homem-Aranha (2019) — capa SoQuadrinhos",
    tags: ["simbionte", "venom", "homem-aranha"],
    selectionSignals: ["visual_symbiote_duo", "duo_visual_score:90"],
    visualTags: ["visual_symbiote_duo"],
    duoVisualScore: 90,
    visualAnalysis: { ...symbioteVisual, duoVisualScore: 90 }
  });
  const lowSpreadReuse = mockAsset({
    id: "low-spread",
    title: "O ESPETACULAR HOMEM-ARANHA/VENOM: Espiral Mortal (2026) — página 4",
    tags: ["venom", "homem-aranha"],
    selectionSignals: ["duo_visual_score:55"],
    duoVisualScore: 55,
    visualAnalysis: {
      analyzable: true,
      eligible: true,
      rejectReason: null,
      duoVisualScore: 55,
      visualTags: [],
      profile: {
        global: { whiteRatio: 0.1, blackRatio: 0.12, redRatio: 0.04, blueRatio: 0.05, yellowRatio: 0.02, greenRatio: 0.02, saturatedRatio: 0.14, colorBucketCount: 30 },
        topThird: { whiteRatio: 0.1, blackRatio: 0.12, redRatio: 0.04, blueRatio: 0.05, yellowRatio: 0.02, greenRatio: 0.02, saturatedRatio: 0.14, colorBucketCount: 30 },
        midThird: { whiteRatio: 0.1, blackRatio: 0.12, redRatio: 0.04, blueRatio: 0.05, yellowRatio: 0.02, greenRatio: 0.02, saturatedRatio: 0.14, colorBucketCount: 30 },
        bottomThird: { whiteRatio: 0.1, blackRatio: 0.12, redRatio: 0.04, blueRatio: 0.05, yellowRatio: 0.02, greenRatio: 0.02, saturatedRatio: 0.14, colorBucketCount: 30 }
      },
      warnings: []
    }
  });

  const globalCandidates = [
    strongHook,
    strongClimax,
    supportA,
    supportB,
    supportC,
    supportD,
    supportE,
    lowSpreadReuse
  ];
  const scoreMatrix = buildPanelScoreMatrix({ beats: beatSpecs, candidates: globalCandidates });
  const greedy = simulateGreedyPanelAssignment({ beats: beatSpecs, candidates: globalCandidates });
  const global = assignPanelsToBeatsGlobally({
    beats: beatSpecs,
    candidates: globalCandidates,
    scoreMatrix,
    greedyBaseline: new Map([...greedy.entries()].map(([beat, entry]) => [beat, entry.score]))
  });

  const greedyClimax = greedy.get("climax")?.score ?? 0;
  const globalClimax = global.beatPicks.get("climax")?.match.score ?? 0;
  assert(
    greedyClimax < 80 && globalClimax >= 80,
    `greedy should weaken climax (${greedyClimax}) while global preserves strong climax (${globalClimax})`
  );
  assert(
    global.reuse.some((entry) => entry.beatRole === "closing" && entry.reusedFromBeat === "hook"),
    "closing should reuse hook visual"
  );
  assert(
    !hasSignificantMultiRegionCrop(lowSpreadReuse),
    "low region spread should not count as significant crop reuse"
  );

  const globalAssignments = Object.fromEntries(
    global.assignments.map((entry) => [entry.beatRole, entry.scoreAfter])
  );
  const developmentA = globalAssignments.development_a ?? 0;
  const developmentB = globalAssignments.development_b ?? 0;
  const globalValidation = validateGlobalPanelAssignment({
    assignments: global.assignments,
    climaxScore: globalAssignments.climax ?? 0
  });
  if (developmentA >= 60 && developmentB >= 60) {
    assert(
      global.developmentSequence.continuityScore >= 60,
      `development continuityScore should be >= 60 (got ${global.developmentSequence.continuityScore})`
    );
    assert(globalValidation.passes, "valid development pair should pass global validation");
  } else {
    assert(
      !globalValidation.passes && globalValidation.publishBlockReason === "development_panel_below_min",
      `development below min should block publish (a=${developmentA}, b=${developmentB})`
    );
  }

  const blockedDevelopment = validateGlobalPanelAssignment({
    assignments: [
      { beatRole: "development_b", scoreAfter: 58 },
      { beatRole: "climax", scoreAfter: 100 }
    ],
    climaxScore: 100
  });
  assert(
    !blockedDevelopment.passes && blockedDevelopment.publishBlockReason === "development_panel_below_min",
    "development below min should block publish"
  );
  const greedyAssignments = Object.fromEntries(
    [...greedy.entries()].map(([beatRole, entry]) => [beatRole, entry.score])
  );

  console.log(
    JSON.stringify(
      {
        peterJohnnyHook,
        doctorStrangeSymbiosis,
        dialogueNoVenomPartner,
        dialogueSymbiosisClimax,
        cropMismatch,
        cropMatch,
        weakSpidermanOnly,
        symbiosisBlackSuit,
        perfectDuo,
        eddieTransform,
        hobgoblinBlackSuit,
        promoRejected,
        consecutiveDevelopment: consecutive,
        randomDevelopment: randomJump,
        greedyAssignments,
        globalAssignments,
        globalSelection: {
          totalWeightedScore: global.totalWeightedScore,
          continuityBonus: global.continuityBonus,
          developmentSequence: global.developmentSequence,
          reuse: global.reuse
        }
      },
      null,
      2
    )
  );
  console.log("[test] panel beat matching: OK");
}

main().catch((error) => {
  console.error("[test] panel beat matching: FAIL");
  console.error(error);
  process.exit(1);
});