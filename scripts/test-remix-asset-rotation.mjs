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

const PREMIUM_CATEGORIES = ["comic_panel", "comic_cover", "character_art"];

function makePremiumAsset(index) {
  const category = PREMIUM_CATEGORIES[index % PREMIUM_CATEGORIES.length];
  return {
    id: `premium-${index}`,
    title: `Venom Spider-Man Marvel symbiote ${category.replace("_", " ")} ${index}`,
    path: `C:/assets/premium-${index}.jpg`,
    score: 95 + (index % 5),
    category
  };
}

function make12Assets() {
  return Array.from({ length: 12 }, (_, index) => makePremiumAsset(index));
}

function makeDominantTimeline(durationSeconds = 40, dominantPath = "C:/assets/dominant.jpg") {
  const scenes = [];
  let cursor = 0;
  let index = 1;
  while (cursor < durationSeconds - 0.01) {
    const end = Math.min(durationSeconds, cursor + 0.65);
    scenes.push({
      sceneId: `fastcut-${String(index).padStart(3, "0")}`,
      role: cursor < 3 ? "hook" : cursor < 32 ? "context" : "climax",
      startSec: cursor,
      endSec: end,
      currentAssetPath: dominantPath,
      visualSourceType: "approved_asset"
    });
    cursor = end;
    index += 1;
  }
  return scenes;
}

function makeStatic32Timeline() {
  const scenes = [];
  let cursor = 0;
  let index = 1;
  while (cursor < 40 - 0.01) {
    const end = Math.min(40, cursor + 0.65);
    scenes.push({
      sceneId: `static-${String(index).padStart(3, "0")}`,
      role: "context",
      startSec: cursor,
      endSec: end,
      currentAssetPath: "C:/assets/static-dominant.jpg",
      visualSourceType: "approved_asset"
    });
    cursor = end;
    index += 1;
  }
  return scenes;
}

function toRotatedScenesForStats(timelineScenes, assetPath, assetId) {
  return timelineScenes.map((scene) => ({
    sceneId: scene.sceneId,
    startSec: scene.startSec,
    endSec: scene.endSec,
    assetPath,
    assetId,
    assetTitle: assetId,
    visualSourceType: "approved_asset"
  }));
}

function hasConsecutiveDuplicateAssetIds(scenes) {
  let previousId = null;
  for (const scene of scenes) {
    const assetId = scene.assetId ?? scene.assetPath;
    if (assetId && assetId === previousId) {
      return true;
    }
    previousId = assetId ?? null;
  }
  return false;
}

function hasConsecutiveDuplicateBeatAssets(beatWindows) {
  let previousId = null;
  for (const beat of beatWindows) {
    if (beat.assetId && beat.assetId === previousId) {
      return true;
    }
    previousId = beat.assetId ?? null;
  }
  return false;
}

async function main() {
  const beast = await importMediaBeast();
  const {
    analyzeComicsVideoTheme,
    buildRemixAssetRotationPlan,
    buildRemixAssetRotationReport,
    computeTimelineRotationStats,
    validateVisualTimelineReadiness,
    scoreAssetForTimelineRotation,
    isAssetThemeEligibleForTimeline,
    MAX_DOMINANT_ASSET_RATIO,
    MAX_STATIC_SEGMENT_SEC,
    MIN_UNIQUE_ASSETS
  } = beast;

  const results = [];
  const assets12 = make12Assets();
  const hookAsset = assets12[0];
  const climaxAsset = assets12[1];

  // Case 1: 12 assets accepted, selector leaves 1 dominant — before fails, after passes
  {
    const timeline = makeDominantTimeline(40, assets12[0].path);
    const beforeStats = computeTimelineRotationStats(
      toRotatedScenesForStats(timeline, assets12[0].path, assets12[0].id)
    );
    const beforeValidation = validateVisualTimelineReadiness(beforeStats, 0);

    assert(
      beforeStats.dominantAssetRatio > MAX_DOMINANT_ASSET_RATIO,
      `case1 before dominant ratio should fail: ${beforeStats.dominantAssetRatio}`
    );
    assert(!beforeValidation.ok, "case1 before validation should fail");

    const plan = buildRemixAssetRotationPlan({
      durationSeconds: 40,
      targetStyle: "comics",
      timelineScenes: timeline,
      acceptedAssets: assets12,
      hookAsset,
      climaxAsset
    });
    const afterValidation = validateVisualTimelineReadiness(plan.stats, 0);

    assert(afterValidation.ok, `case1 after should pass: ${afterValidation.warnings.join(", ")}`);
    assert(
      plan.stats.uniqueAssetCount >= MIN_UNIQUE_ASSETS,
      `case1 unique assets too low: ${plan.stats.uniqueAssetCount}`
    );

    results.push({
      test: "twelve_assets_one_dominant_before_after",
      ok: true,
      before: beforeStats,
      after: plan.stats
    });
  }

  // Case 2: 32s static segment must be split automatically
  {
    const timeline = makeStatic32Timeline();
    const beforeStats = computeTimelineRotationStats(
      toRotatedScenesForStats(timeline, "C:/assets/static-dominant.jpg", "static-dominant")
    );

    assert(
      beforeStats.longestStaticSegmentSec >= 32,
      `case2 before static run expected >=32s, got ${beforeStats.longestStaticSegmentSec}s`
    );

    const plan = buildRemixAssetRotationPlan({
      durationSeconds: 40,
      targetStyle: "comics",
      timelineScenes: timeline,
      acceptedAssets: assets12,
      hookAsset,
      climaxAsset
    });

    assert(
      plan.stats.longestStaticSegmentSec <= MAX_STATIC_SEGMENT_SEC,
      `case2 after static segment too long: ${plan.stats.longestStaticSegmentSec}s`
    );

    results.push({
      test: "static_32s_split",
      ok: true,
      beforeStaticSec: beforeStats.longestStaticSegmentSec,
      afterStaticSec: plan.stats.longestStaticSegmentSec
    });
  }

  // Case 3: Hook and climax receive different premium assets
  {
    const timeline = makeDominantTimeline(40, assets12[5].path);
    const plan = buildRemixAssetRotationPlan({
      durationSeconds: 40,
      targetStyle: "comics",
      timelineScenes: timeline,
      acceptedAssets: assets12,
      hookAsset,
      climaxAsset
    });

    const hookBeat = plan.beatWindows.find((beat) => beat.role === "hook");
    const climaxBeat = plan.beatWindows.find((beat) => beat.role === "climax");

    assert(hookBeat?.assetId === hookAsset.id, "case3 hook must use hook asset");
    assert(climaxBeat?.assetId === climaxAsset.id, "case3 climax must use climax asset");
    assert(hookBeat.assetId !== climaxBeat.assetId, "case3 hook and climax must differ");

    results.push({
      test: "hook_climax_premium_different",
      ok: true,
      hookAssetId: hookBeat.assetId,
      climaxAssetId: climaxBeat.assetId
    });
  }

  // Case 4: Repeated asset in sequence should be avoided at beat level
  {
    const timeline = makeDominantTimeline(40, assets12[2].path);
    const plan = buildRemixAssetRotationPlan({
      durationSeconds: 40,
      targetStyle: "comics",
      timelineScenes: timeline,
      acceptedAssets: assets12,
      hookAsset,
      climaxAsset
    });

    assert(
      !hasConsecutiveDuplicateBeatAssets(plan.beatWindows),
      "case4 consecutive duplicate beat assets should be avoided"
    );

    results.push({
      test: "avoid_consecutive_asset_reuse",
      ok: true,
      beatCount: plan.beatWindows.length
    });
  }

  // Case 5: dominantAssetRatio <= 0.4
  {
    const timeline = makeDominantTimeline(40, assets12[3].path);
    const plan = buildRemixAssetRotationPlan({
      durationSeconds: 40,
      targetStyle: "comics",
      timelineScenes: timeline,
      acceptedAssets: assets12,
      hookAsset,
      climaxAsset
    });

    assert(
      plan.stats.dominantAssetRatio <= MAX_DOMINANT_ASSET_RATIO,
      `case5 dominant ratio too high: ${plan.stats.dominantAssetRatio}`
    );

    results.push({
      test: "dominant_asset_ratio_cap",
      ok: true,
      dominantAssetRatio: plan.stats.dominantAssetRatio
    });
  }

  // Case 6: longestStaticSegmentSec <= 6s
  {
    const timeline = makeDominantTimeline(40, assets12[4].path);
    const plan = buildRemixAssetRotationPlan({
      durationSeconds: 40,
      targetStyle: "comics",
      timelineScenes: timeline,
      acceptedAssets: assets12,
      hookAsset,
      climaxAsset
    });

    assert(
      plan.stats.longestStaticSegmentSec <= MAX_STATIC_SEGMENT_SEC,
      `case6 static segment too long: ${plan.stats.longestStaticSegmentSec}s`
    );

    const validation = validateVisualTimelineReadiness(plan.stats, 0);
    assert(validation.ok, `case6 timeline should be ready: ${validation.warnings.join(", ")}`);

    const report = buildRemixAssetRotationReport({
      variation: "B — Comics",
      targetStyle: "comics",
      before: computeTimelineRotationStats(
        toRotatedScenesForStats(timeline, assets12[4].path, assets12[4].id)
      ),
      plan,
      acceptedAssets: assets12,
      durationSeconds: 40,
      visualVariationGuard: validation,
      sourceFootprintGuard: {
        ok: true,
        warnings: [],
        sourceFootprintRatio: 0
      },
      materializationGuard: {
        ok: true,
        blockReason: null,
        providedAssetsUsageRatio: 1,
        scenesWithRealAssets: plan.stats.visualSegmentCount
      },
      canRender: validation.ok,
      blockReason: null
    });

    assert(report.timelineScenes.length > 0, "case6 report should include timeline scenes");
    assert(report.assetUsage.length >= MIN_UNIQUE_ASSETS, "case6 report should include asset usage");
    assert(report.guards.visualVariation.ok, "case6 report visual guard should be ok");

    results.push({
      test: "longest_static_segment_cap",
      ok: true,
      longestStaticSegmentSec: plan.stats.longestStaticSegmentSec,
      reportSceneCount: report.timelineScenes.length,
      reportAssetUsageCount: report.assetUsage.length
    });
  }

  // Case 7: partnership theme filters off-theme multiverse assets from development beats
  {
    const themeAnalysis = analyzeComicsVideoTheme({
      videoTitle: "O Venom Encontrou o Parceiro Perfeito!!",
      narrationText:
        "Venom encontra parceiro perfeito — simbiose, dupla ideal e ligação entre hospedeiro e simbionte.",
      entities: ["Venom", "Homem-Aranha"]
    });

    const onThemeAssets = Array.from({ length: 8 }, (_, index) => ({
      id: `venom-duo-${index}`,
      title: `Venom Spider-Man symbiote bond duo comic panel ${index}`,
      path: `C:/assets/venom-duo-${index}.jpg`,
      score: 92,
      category: index % 2 === 0 ? "comic_panel" : "comic_cover"
    }));
    const offThemeAssets = [
      {
        id: "spider-2099",
        title: "Homem-Aranha 2099 multiverse variant comic cover",
        path: "C:/assets/spider-2099.jpg",
        score: 94,
        category: "comic_cover"
      },
      {
        id: "gwen-stacy",
        title: "Gwen Stacy Spider-Gwen multiverse comic panel",
        path: "C:/assets/gwen-stacy.jpg",
        score: 93,
        category: "comic_panel"
      },
      {
        id: "miles-morales",
        title: "Miles Morales Spider-Verse multiverse comic splash",
        path: "C:/assets/miles-morales.jpg",
        score: 91,
        category: "comic_panel"
      },
      {
        id: "aranhaverso",
        title: "Aranhaverso Spider-Verse multiple versions comic cover",
        path: "C:/assets/aranhaverso.jpg",
        score: 90,
        category: "comic_cover"
      }
    ];
    const themedAssets = [...onThemeAssets, ...offThemeAssets];

    for (const asset of offThemeAssets) {
      assert(
        !isAssetThemeEligibleForTimeline(asset, themeAnalysis),
        `case7 off-theme asset should be filtered: ${asset.id}`
      );
    }

    const timeline = makeDominantTimeline(40, offThemeAssets[0].path);
    const plan = buildRemixAssetRotationPlan({
      durationSeconds: 40,
      targetStyle: "comics",
      timelineScenes: timeline,
      acceptedAssets: themedAssets,
      hookAsset: onThemeAssets[0],
      climaxAsset: onThemeAssets[1],
      themeAnalysis
    });

    const developmentBeats = plan.beatWindows.filter((beat) =>
      /development|curiosity|climax_setup/.test(beat.role)
    );
    const offThemeIds = new Set(offThemeAssets.map((asset) => asset.id));
    const offThemeInDevelopment = developmentBeats.filter((beat) =>
      offThemeIds.has(beat.assetId)
    );

    assert(
      offThemeInDevelopment.length === 0,
      `case7 off-theme assets in development beats: ${offThemeInDevelopment.map((beat) => beat.assetId).join(", ")}`
    );
    assert(plan.themedPoolSize >= MIN_UNIQUE_ASSETS, "case7 themed pool should stay usable");

    results.push({
      test: "partnership_theme_filters_off_theme_assets",
      ok: true,
      themedPoolSize: plan.themedPoolSize,
      developmentBeatCount: developmentBeats.length,
      offThemeInDevelopment: offThemeInDevelopment.length
    });
  }

  // Scoring sanity: support-only assets penalized for hook/climax
  assert(
    scoreAssetForTimelineRotation(
      {
        id: "coloring",
        title: "Spider-Man black suit coloring page",
        path: "C:/assets/coloring.jpg",
        score: 96,
        category: "comic_panel"
      },
      "climax"
    ) <
      scoreAssetForTimelineRotation(hookAsset, "climax"),
    "coloring page should score lower than premium panel for climax"
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        passed: results.length,
        results
      },
      null,
      2
    )
  );
  console.log("[test] remix asset rotation: OK");
}

main().catch((error) => {
  console.log("[test] remix asset rotation: FAIL");
  console.error(error);
  process.exit(1);
});