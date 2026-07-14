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
  if (!condition) throw new Error(message);
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
    remixId: "remix-test-venom-visual",
    inputVideoPath: "C:/fake/reference.mp4",
    inputVideoTitle: "Venom test",
    targetStyle: "comics",
    intensity: "extreme",
    durationSeconds: 40,
    variationLabel: "Variação B — comics",
    videoAnalysis: {
      contentIntelligence: {
        domain: "comics_superhero",
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
        buildMockSegment(1, "evidence", "broll_overlay", 6, 14),
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
      ]
    },
    visualPlan: { comfyVariations: [] },
    musicPlan: { musicPresetId: "viral_fast_cut" },
    fastCutPlan: null,
    ...overrides.planPatch
  };
}

function candidate(id, title, extra = {}) {
  return {
    candidateId: id,
    title,
    purpose: extra.purpose ?? "comic_panel",
    combinedScore: extra.combinedScore ?? 80,
    previewUrl: extra.previewUrl ?? `https://example.com/${id}.jpg`,
    sourceUrl: extra.sourceUrl ?? `https://example.com/${id}`,
    providerId: extra.providerId ?? "comics-archive",
    suggestedSceneRole: extra.suggestedSceneRole ?? "evidence",
    query: extra.query ?? title
  };
}

async function main() {
  const beast = await importMediaBeast();
  const {
    buildRemixMaterializationReport,
    selectVisualAssetForRemixScene,
    evaluateComicsAssetQuality,
    isPremiumHookClimaxAsset,
    HOOK_CLIMAX_MIN_SCORE,
    INSUFFICIENT_HIGH_QUALITY_COMICS_ASSETS
  } = beast;

  const results = [];

  // 1) Hook/climax reject cosplay and low-quality assets
  const cosplayAsset = {
    id: "cosplay-1",
    title: "Venom cosplay convention costume amateur",
    origin: "imported",
    query: "venom cosplay"
  };
  const hookSelection = selectVisualAssetForRemixScene({
    sceneRole: "hook",
    targetStyle: "comics",
    entities: ["Venom", "Homem-Aranha"],
    providedAssets: [],
    approvedAssets: [cosplayAsset],
    generatedAssets: []
  });
  assert(
    hookSelection.sourceType === "placeholder",
    "hook must not use cosplay asset"
  );
  results.push({ test: "hook_rejects_cosplay", ok: true, reason: hookSelection.reason });

  const merchAsset = {
    id: "merch-1",
    title: "Venom moletom hoodie merch store",
    origin: "imported"
  };
  const climaxSelection = selectVisualAssetForRemixScene({
    sceneRole: "climax",
    targetStyle: "comics",
    entities: ["Venom", "Homem-Aranha"],
    providedAssets: [],
    approvedAssets: [merchAsset],
    generatedAssets: []
  });
  assert(
    climaxSelection.sourceType === "placeholder",
    "climax must not use merchandise asset"
  );
  results.push({ test: "climax_rejects_merch", ok: true, reason: climaxSelection.reason });

  // 2) Premium comic assets qualify for hook/climax
  const premiumAsset = {
    id: "panel-1",
    title: "Venom Spider-Man comic panel Marvel symbiote halftone",
    origin: "imported",
    localPath: "C:/fake/panel.jpg",
    width: 1200,
    height: 1800
  };
  const quality = evaluateComicsAssetQuality({
    title: premiumAsset.title,
    entities: ["Venom", "Homem-Aranha"],
    targetStyle: "comics",
    width: premiumAsset.width,
    height: premiumAsset.height
  });
  assert(quality.ok && quality.score >= HOOK_CLIMAX_MIN_SCORE, "premium asset should pass gate");
  assert(isPremiumHookClimaxAsset(quality), "premium asset should qualify for hook/climax");

  const premiumHook = selectVisualAssetForRemixScene({
    sceneRole: "hook",
    targetStyle: "comics",
    entities: ["Venom", "Homem-Aranha"],
    providedAssets: [],
    approvedAssets: [premiumAsset],
    generatedAssets: []
  });
  assert(premiumHook.asset?.id === "panel-1", "hook should select premium comic panel");
  results.push({
    test: "hook_accepts_premium_panel",
    ok: true,
    score: quality.score,
    category: quality.category
  });

  // 3) Materialization blocks when only bad assets are available
  const badOnlyPlan = buildMinimalPlan({
    candidates: [
      candidate("bad-cosplay", "Venom cosplay convention costume", { combinedScore: 99 }),
      candidate("bad-ant", "Pogonomyrmex venom ant", { combinedScore: 95 }),
      candidate("bad-hoodie", "Venom moletom merch", { combinedScore: 90 })
    ]
  });
  const badReport = await buildRemixMaterializationReport({
    plan: badOnlyPlan,
    allowReferenceVideoInFinal: false,
    importTopCandidates: 3,
    projectRoot
  });
  assert(!badReport.canRender, "render must block with only bad comics assets");
  assert(
    badReport.blockReason === INSUFFICIENT_HIGH_QUALITY_COMICS_ASSETS ||
      badReport.blockReason === "insufficient_assets" ||
      badReport.blockReason === "insufficient_approved_assets_for_remix_render",
    `expected comics or assets block, got ${badReport.blockReason}`
  );
  assert(
    badReport.rejectedAssets.length >= 3,
    "all bad candidates should be rejected"
  );
  results.push({
    test: "bad_assets_block_render",
    ok: true,
    blockReason: badReport.blockReason,
    rejectedCount: badReport.rejectedAssets.length,
    comicsReportPath: badReport.comicsAssetSelectionReportPath
  });

  // 4) Provided premium assets allow render with comics report
  const assetDir = join(projectRoot, "tmp", "remix-visual-timeline-test-assets");
  await mkdir(assetDir, { recursive: true });
  const assetPaths = [];
  for (let i = 0; i < 4; i += 1) {
    const assetPath = join(assetDir, `venom-premium-${i}.png`);
    if (!existsSync(assetPath)) {
      const png = Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWOYAAAAASUVORK5CYII=",
        "base64"
      );
      await writeFile(assetPath, png);
    }
    assetPaths.push(assetPath);
  }

  const providedAssets = [
    {
      id: "provided-hook",
      title: "Venom Spider-Man comic panel Marvel symbiote halftone",
      localPath: assetPaths[0],
      origin: "provided",
      suggestedSceneRole: "hook"
    },
    {
      id: "provided-evidence-1",
      title: "Venom symbiote comic cover Marvel issue",
      localPath: assetPaths[1],
      origin: "provided",
      suggestedSceneRole: "evidence"
    },
    {
      id: "provided-evidence-2",
      title: "Spider-Man black suit comic panel Marvel",
      localPath: assetPaths[2],
      origin: "provided",
      suggestedSceneRole: "evidence"
    },
    {
      id: "provided-climax",
      title: "Venom Eddie Brock comic art Marvel symbiote",
      localPath: assetPaths[3],
      origin: "provided",
      suggestedSceneRole: "climax"
    }
  ];

  const goodPlan = buildMinimalPlan({
    candidates: [
      candidate("rejected-cosplay", "Venom cosplay amateur", { combinedScore: 99 })
    ]
  });
  const goodReport = await buildRemixMaterializationReport({
    plan: goodPlan,
    allowReferenceVideoInFinal: false,
    providedAssets,
    importTopCandidates: 1,
    projectRoot
  });

  assert(goodReport.canRender, "provided premium assets should allow render");
  assert(
    goodReport.comicsAssetSelectionReportPath &&
      existsSync(goodReport.comicsAssetSelectionReportPath),
    "comics selection report should be written"
  );

  const hookScene = goodReport.timelineScenes.find((scene) => scene.sceneRole === "hook");
  const climaxScene = goodReport.timelineScenes.find((scene) => scene.sceneRole === "climax");
  assert(hookScene?.assetId === "provided-hook", "hook should use provided premium asset");
  assert(
    climaxScene?.assetId && climaxScene.visualSourceType !== "placeholder",
    "climax must use a premium asset, never placeholder"
  );
  assert(
    ["provided-hook", "provided-climax", "provided-evidence-1", "provided-evidence-2"].includes(
      climaxScene.assetId
    ),
    `climax should reuse a provided premium asset, got ${climaxScene.assetId}`
  );
  assert(
    goodReport.timelineScenes.every((scene) => scene.visualSourceType !== "reference_video"),
    "timeline must not use reference video"
  );

  results.push({
    test: "provided_premium_timeline",
    ok: true,
    hookAssetId: hookScene?.assetId,
    climaxAssetId: climaxScene?.assetId,
    comicsReportPath: goodReport.comicsAssetSelectionReportPath,
    rejectedAssets: goodReport.rejectedAssets
  });

  console.log(JSON.stringify({ passed: results.length, results }, null, 2));
  console.log("[test] remix visual timeline guard: OK");
}

main().catch((error) => {
  console.log("[test] remix visual timeline guard: FAIL");
  console.error(error);
  process.exit(1);
});