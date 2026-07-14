import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { existsSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");

async function importMediaBeast() {
  return import(
    pathToFileURL(join(projectRoot, "packages/media-beast/dist/index.js")).href
  );
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function buildMockSegment(index, role, sourceSegment, start, end) {
  return {
    sceneId: `scene-${index}`,
    order: index,
    role,
    startSeconds: start,
    endSeconds: end,
    sourceSegment,
    transitionIn: "cut",
    effects: ["none"],
    captionHint: role,
    comfyVariationId: null
  };
}

function buildMinimalPlan(overrides = {}) {
  return {
    remixId: "remix-test-venom",
    inputVideoPath: "C:/fake/reference.mp4",
    inputVideoTitle: "Venom test",
    targetStyle: "comics",
    intensity: "extreme",
    durationSeconds: 40,
    variationLabel: "Variação B — comics",
    videoAnalysis: {
      contentIntelligence: {
        entities: [{ name: "Venom" }, { name: "Homem-Aranha" }],
        headline: "Venom HQ"
      }
    },
    assetDiscovery: {
      imageSearch: { candidates: overrides.candidates ?? [] },
      importedAssets: []
    },
    sceneStructure: {
      segments: overrides.segments ?? [
        buildMockSegment(0, "hook", "original_clip", 0, 6),
        buildMockSegment(1, "evidence", "original_clip", 6, 14),
        buildMockSegment(2, "tension", "broll_overlay", 14, 24),
        buildMockSegment(3, "climax", "original_clip", 24, 34),
        buildMockSegment(4, "outro", "broll_overlay", 34, 40)
      ]
    },
    captionPlan: {
      style: { id: "comic_pop" },
      scenes: []
    },
    narrationPlan: {
      narrationBeats: [
        { role: "hook", text: "O corte abre colado em Venom." },
        { role: "context", text: "Isso vem dos quadrinhos." },
        { role: "tension", text: "A dupla perfeita raramente é explicada." },
        { role: "climax", text: "Concurso de arte Marvel anos 80." },
        { role: "cta", text: "Qual dupla você prefere?" }
      ],
      retentionMetadata: {
        captionDirection: {
          cues: [
            { startSec: 0, endSec: 6, textOnScreen: "VENOM ABRE FORTE" },
            { startSec: 24, endSec: 34, textOnScreen: "CONCURSO MARVEL 80" }
          ]
        }
      }
    },
    visualPlan: { comfyVariations: [] },
    musicPlan: { musicPresetId: "viral_fast_cut" },
    fastCutPlan: {
      durationSeconds: 40,
      averageShotLengthSeconds: 0.65,
      cutTimes: Array.from({ length: 61 }, (_, i) => i * 0.65).filter((time) => time > 0 && time < 40),
      effectCues: [],
      transitionSequence: [],
      microclipWindows: [],
      warnings: []
    },
    ...overrides.planPatch
  };
}

async function main() {
  const beast = await importMediaBeast();
  const {
    calculateSourceFootprintRatio,
    validateSourceFootprint,
    rejectHomonymOrIrrelevantAsset,
    buildRemixMaterializationReport,
    INSUFFICIENT_ASSETS_ERROR
  } = beast;

  const results = [];

  // 1) Reference-only timeline must block
  const referenceRatio = calculateSourceFootprintRatio({
    timelineScenes: [
      {
        visualSourceType: "reference_video",
        durationSeconds: 40
      }
    ],
    referenceVideoPath: "C:/fake/reference.mp4"
  });
  assert(referenceRatio === 1, "reference-only ratio should be 1");
  const referenceValidation = validateSourceFootprint({
    sourceFootprintRatio: referenceRatio,
    allowReferenceVideoInFinal: false
  });
  assert(!referenceValidation.ok, "reference-only render must be blocked");
  assert(
    referenceValidation.reason === "reference_video_blocked_as_final_visual",
    "expected reference_video_blocked_as_final_visual"
  );
  results.push({ test: "reference_only_blocked", ok: true });

  // 2) No approved assets -> insufficient error
  const emptyPlan = buildMinimalPlan({ candidates: [] });
  const emptyReport = await buildRemixMaterializationReport({
    plan: emptyPlan,
    allowReferenceVideoInFinal: false,
    importTopCandidates: 0,
    projectRoot
  });
  assert(!emptyReport.canRender, "empty assets must block render");
  assert(
    emptyReport.blockReason === INSUFFICIENT_ASSETS_ERROR,
    `expected ${INSUFFICIENT_ASSETS_ERROR}, got ${emptyReport.blockReason}`
  );
  results.push({
    test: "no_assets_blocked",
    ok: true,
    blockReason: emptyReport.blockReason
  });

  // 3) Homonym rejection (Venom/HQ case)
  const homonyms = [
    { id: "ant", title: "Pogonomyrmex venom ant species", purpose: "science" },
    { id: "poison", title: "veneno biológico toxin", purpose: "science" },
    { id: "hoodie", title: "Venom moletom merch", purpose: "product" },
    { id: "logo", title: "venom 2018 logo png", purpose: "brand" },
    { id: "carnival", title: "Homem-Aranha carnaval foliões", purpose: "event" }
  ];
  for (const item of homonyms) {
    const verdict = rejectHomonymOrIrrelevantAsset(
      { id: item.id, title: item.title, purpose: item.purpose },
      ["Venom", "Homem-Aranha"]
    );
    assert(verdict.rejected, `homonym should be rejected: ${item.title}`);
  }
  results.push({ test: "homonym_rejection", ok: true, count: homonyms.length });

  // 4) Provided assets drive timeline with low source footprint
  const assetDir = join(projectRoot, "tmp", "remix-materialization-test-assets");
  await mkdir(assetDir, { recursive: true });
  const assetPaths = [];
  for (let i = 0; i < 8; i += 1) {
    const assetPath = join(assetDir, `venom-panel-${i}.png`);
    if (!existsSync(assetPath)) {
      const png = Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWOYAAAAASUVORK5CYII=",
        "base64"
      );
      await writeFile(assetPath, png);
    }
    assetPaths.push(assetPath);
  }

  const providedAssets = assetPaths.map((localPath, index) => ({
    id: `provided-${index}`,
    title: `Venom Marvel comic panel ${index}`,
    localPath,
    origin: "provided",
    suggestedSceneRole: index === 0 ? "hook" : "evidence",
    combinedScore: 90
  }));

  const approvedPlan = buildMinimalPlan({
    candidates: [
      {
        candidateId: "bad-ant",
        title: "Pogonomyrmex venom",
        purpose: "science",
        combinedScore: 99,
        previewUrl: "https://example.com/ant.jpg",
        sourceUrl: "https://example.com/ant",
        providerId: "test",
        suggestedSceneRole: "hook"
      }
    ]
  });

  const approvedReport = await buildRemixMaterializationReport({
    plan: approvedPlan,
    allowReferenceVideoInFinal: false,
    providedAssets,
    importTopCandidates: 0,
    projectRoot
  });

  assert(approvedReport.canRender, "approved assets should allow render");
  assert(
    approvedReport.sourceFootprintRatio <= 0.001,
    `source footprint too high: ${approvedReport.sourceFootprintRatio}`
  );
  assert(
    approvedReport.providedAssetsUsageRatio >= 0.5,
    `provided usage too low: ${approvedReport.providedAssetsUsageRatio}`
  );
  assert(
    approvedReport.timelineScenes.every(
      (scene) => scene.visualSourceType !== "reference_video"
    ),
    "no scene may use reference_video when blocked"
  );
  assert(
    approvedReport.timelineScenes.every((scene) => scene.assetPath),
    "all scenes should have asset paths"
  );
  assert(approvedReport.rejectedAssets.length >= 1, "homonym candidate should be rejected");

  results.push({
    test: "provided_assets_timeline",
    ok: true,
    sourceFootprintRatio: approvedReport.sourceFootprintRatio,
    providedAssetsUsageRatio: approvedReport.providedAssetsUsageRatio,
    approvedAssetsUsed: approvedReport.approvedAssetsUsed,
    rejectedAssets: approvedReport.rejectedAssets
  });

  const fastCutPlan = buildMinimalPlan({
    candidates: [],
    planPatch: {
      intensity: "extreme",
      fastCutPlan: {
        cutTimes: Array.from({ length: 61 }, (_, index) =>
          Number(((index + 1) * 0.65).toFixed(2))
        ).filter((time) => time < 40),
        effectCues: [],
        transitionSequence: []
      }
    }
  });
  const fastCutReport = await buildRemixMaterializationReport({
    plan: fastCutPlan,
    allowReferenceVideoInFinal: false,
    providedAssets,
    importTopCandidates: 0,
    projectRoot
  });
  assert(
    fastCutReport.timelineMode === "fast_cut",
    `expected fast_cut timeline, got ${fastCutReport.timelineMode}`
  );
  assert(
    fastCutReport.materializedFastCutCount >= 50,
    `expected >=50 fast cut scenes, got ${fastCutReport.materializedFastCutCount}`
  );
  assert(
    !fastCutReport.plannedButNotMaterialized.some((entry) =>
      entry.startsWith("fastCutPlan.cutTimes")
    ),
    "fastCutPlan should be materialized"
  );
  results.push({
    test: "fast_cut_materialization",
    ok: true,
    materializedFastCutCount: fastCutReport.materializedFastCutCount,
    timelineMode: fastCutReport.timelineMode
  });

  const summary = {
    passed: results.length,
    results,
    materializationPreview: {
      canRender: approvedReport.canRender,
      blockReason: approvedReport.blockReason,
      sourceFootprintRatio: approvedReport.sourceFootprintRatio,
      providedAssetsUsageRatio: approvedReport.providedAssetsUsageRatio,
      timelineScenes: approvedReport.timelineScenes.map((scene) => ({
        sceneId: scene.sceneId,
        visualSourceType: scene.visualSourceType,
        assetPath: scene.assetPath,
        caption: scene.caption
      }))
    }
  };

  console.log(JSON.stringify(summary, null, 2));
  console.log("[test] remix materialization guard: OK");
}

main().catch((error) => {
  console.log("[test] remix materialization guard: FAIL");
  console.error(error);
  process.exit(1);
});