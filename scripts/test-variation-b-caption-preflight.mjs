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

async function main() {
  const {
    buildBeatCaptionCueRecord,
    detectFastCutCaptionFlicker,
    validateCaptionPreflight,
    isCaptionGrammaticallyComplete,
    estimateCaptionFitsSafeArea
  } = await importMediaBeast();

  const venomNoClose = buildBeatCaptionCueRecord({
    beat: "hook",
    caption: "VENOM NO CLOSE",
    startSec: 0,
    endSec: 4.5
  });
  assert(!venomNoClose.semanticComplete, "VENOM NO CLOSE should fail preflight");

  const duplaNosHqs = buildBeatCaptionCueRecord({
    beat: "context",
    caption: "DUPLA PERFEITA NOS HQS",
    startSec: 4.5,
    endSec: 9.5
  });
  assert(!duplaNosHqs.semanticComplete, "DUPLA PERFEITA NOS HQS should fail preflight");

  assert(
    !isCaptionGrammaticallyComplete("DUPLA PERFEITA DO"),
    "caption ending in 'do' should fail"
  );

  const unsafeCtaCaption = "SUPERCALIFRAGILISTICEXPIALIDOCIOUS VENOM DUPLA";
  assert(
    !estimateCaptionFitsSafeArea(unsafeCtaCaption),
    "CTA outside safe area should fail"
  );

  const beatAssignments = [
    { beatRole: "hook", caption: "VENOM NO FOCO", startSec: 0, endSec: 4.5 },
    { beatRole: "context", caption: "DUPLA PERFEITA NAS HQS", startSec: 4.5, endSec: 9.5 }
  ];
  const flickerScenes = [
    { startSec: 0, endSec: 2.2, caption: "VENOM NO FOCO", sceneRole: "hook" },
    { startSec: 2.2, endSec: 4.5, caption: "OUTRA LEGENDA", sceneRole: "hook" },
    { startSec: 4.5, endSec: 7, caption: "DUPLA PERFEITA NAS HQS", sceneRole: "context" },
    { startSec: 7, endSec: 9.5, caption: "DUPLA PERFEITA NAS HQS", sceneRole: "context" }
  ];
  const flicker = detectFastCutCaptionFlicker({
    scenes: flickerScenes,
    beatAssignments
  });
  assert(flicker.hasFlicker, "caption repeated/changed every fast cut should fail");

  const perCutScenes = Array.from({ length: 14 }, (_, index) => ({
    startSec: index * (40 / 14),
    endSec: (index + 1) * (40 / 14),
    caption: `LEGENDA ${index + 1}`,
    sceneRole: index < 4 ? "hook" : "context"
  }));
  const perCutFlicker = detectFastCutCaptionFlicker({
    scenes: perCutScenes,
    beatAssignments: [
      { beatRole: "hook", caption: "VENOM NO FOCO", startSec: 0, endSec: 4.5 },
      { beatRole: "context", caption: "DUPLA PERFEITA NAS HQS", startSec: 4.5, endSec: 40 }
    ]
  });
  assert(perCutFlicker.hasFlicker, "per-cut caption reentry should fail");

  const persistentScenes = [
    { startSec: 0, endSec: 2.2, caption: "", sceneRole: "hook" },
    { startSec: 2.2, endSec: 4.5, caption: "", sceneRole: "hook" },
    { startSec: 4.5, endSec: 7, caption: "", sceneRole: "context" },
    { startSec: 7, endSec: 9.5, caption: "", sceneRole: "context" }
  ];
  const persistent = validateCaptionPreflight(
    [
      { beatRole: "hook", caption: "VENOM NO FOCO", startSec: 0, endSec: 4.5 },
      { beatRole: "context", caption: "DUPLA PERFEITA NAS HQS", startSec: 4.5, endSec: 9.5 },
      { beatRole: "climax", caption: "A DUPLA QUE OS FÃS QUEREM", startSec: 24.5, endSec: 32 },
      { beatRole: "closing", caption: "QUAL DUPLA VOCÊ PREFERE?", startSec: 32, endSec: 40 }
    ],
    { scenes: persistentScenes, useBeatTimeline: true }
  );
  assert(persistent.captionPreflightReady, "caption persistent within beat should pass");
  assert(!persistent.flickerDetected, "beat-level captions should not flicker across microcuts");

  console.log(
    JSON.stringify(
      {
        ok: true,
        cases: {
          venomNoCloseFails: !venomNoClose.semanticComplete,
          duplaNosHqsFails: !duplaNosHqs.semanticComplete,
          danglingDoFails: !isCaptionGrammaticallyComplete("DUPLA PERFEITA DO"),
          unsafeCtaFails: !estimateCaptionFitsSafeArea(unsafeCtaCaption),
          fastCutFlickerFails: flicker.hasFlicker,
          perCutReentryFails: perCutFlicker.hasFlicker,
          beatPersistencePasses: persistent.captionPreflightReady
        }
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error("[test-variation-b-caption-preflight] FAIL");
  console.error(error);
  process.exit(1);
});