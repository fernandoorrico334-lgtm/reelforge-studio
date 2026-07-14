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

function venomTheme(beast) {
  return beast.analyzeComicsVideoTheme({
    videoTitle: "O Venom Encontrou o Parceiro Perfeito!!",
    narrationText:
      "Venom encontra parceiro perfeito — simbiose, dupla ideal e ligação entre hospedeiro e simbionte.",
    entities: ["Venom", "Homem-Aranha"]
  });
}

function makeScene(id, role, title, caption = "VENOM DUO") {
  return {
    sceneId: id,
    role,
    startSec: 0,
    endSec: 1,
    assetTitle: title,
    caption,
    captionStyle: "comic_pop",
    assetCategory: "comic_cover",
    assetQualityScore: 90
  };
}

async function main() {
  const beast = await importMediaBeast();
  const {
    evaluateComicsReadinessFlags,
    evaluateComicsVisualDiversity,
    evaluateComicsPublishReadiness,
    RENDER_NOT_READY_INSUFFICIENT_VISUAL_DIVERSITY
  } = beast;

  const partnership = venomTheme(beast);
  const narration =
    "Venom encontra parceiro perfeito — simbiose, dupla ideal e ligação entre hospedeiro e simbionte.";
  const onThemeTimeline = Array.from({ length: 8 }, (_, index) =>
    makeScene(
      `scene-${index}`,
      index === 0 ? "hook" : index === 7 ? "climax" : "development_a",
      "Venom Spider-Man symbiote bond comic cover duo",
      index === 0 ? "VENOM DUO" : "SIMBIONTE"
    )
  );

  const results = [];

  // Case 1: canRender=false + narrative/caption true => canPublish false
  {
    const flags = evaluateComicsReadinessFlags({
      sourceFootprintOk: true,
      materializationOk: true,
      themeAlignment: {
        ok: true,
        offThemeScenes: [],
        onThemeRatio: 1,
        hookAligned: true,
        climaxAligned: true,
        warnings: []
      },
      captionMaterialization: {
        ok: true,
        captionMaterializationRate: 1,
        missingCaptionScenes: [],
        wrongStyleScenes: [],
        warnings: []
      },
      visualDiversity: evaluateComicsVisualDiversity({
        uniqueAssetCount: 2,
        dominantAssetRatio: 0.56,
        longestStaticSegmentSec: 3.9,
        visualSegmentCount: 62
      }),
      renderBlockReason: "insufficient_visual_diversity"
    });
    assert(flags.narrativeReady === true, "case1 narrativeReady");
    assert(flags.captionReady === true, "case1 captionReady");
    assert(flags.canRender === false, "case1 canRender false");
    assert(flags.canPublish === false, "case1 canPublish false");
    assert(
      flags.publishBlockReason === RENDER_NOT_READY_INSUFFICIENT_VISUAL_DIVERSITY,
      `case1 publishBlockReason=${flags.publishBlockReason}`
    );
    results.push({ test: "render_false_blocks_publish", ok: true });
  }

  // Case 2: canRender true + narrative false
  {
    const report = evaluateComicsPublishReadiness({
      variation: "B",
      targetStyle: "comics",
      videoTitle: "O Venom Encontrou o Parceiro Perfeito!!",
      narrationText: narration,
      themeAnalysis: partnership,
      canRender: true,
      sourceFootprintOk: true,
      materializationOk: true,
      visualDiversity: evaluateComicsVisualDiversity({
        uniqueAssetCount: 4,
        dominantAssetRatio: 0.25,
        longestStaticSegmentSec: 2,
        visualSegmentCount: 62
      }),
      timelineScenes: [
        makeScene("hook-1", "hook", "Miles Morales comic panel"),
        makeScene("cli-1", "climax", "Venom symbiote comic cover")
      ]
    });
    assert(report.narrativeReady === false, "case2 narrativeReady");
    assert(report.canPublish === false, "case2 canPublish");
    results.push({ test: "narrative_false_blocks_publish", ok: true });
  }

  // Case 3: canRender true + narrative true + caption false
  {
    const report = evaluateComicsPublishReadiness({
      variation: "B",
      targetStyle: "comics",
      videoTitle: "O Venom Encontrou o Parceiro Perfeito!!",
      narrationText: narration,
      themeAnalysis: partnership,
      canRender: true,
      sourceFootprintOk: true,
      materializationOk: true,
      visualDiversity: evaluateComicsVisualDiversity({
        uniqueAssetCount: 4,
        dominantAssetRatio: 0.25,
        longestStaticSegmentSec: 2,
        visualSegmentCount: 62
      }),
      timelineScenes: onThemeTimeline.map((scene) => ({ ...scene, caption: "" }))
    });
    assert(report.captionReady === false, "case3 captionReady");
    assert(report.canPublish === false, "case3 canPublish");
    results.push({ test: "caption_false_blocks_publish", ok: true });
  }

  // Case 4: all true
  {
    const report = evaluateComicsPublishReadiness({
      variation: "B",
      targetStyle: "comics",
      videoTitle: "O Venom Encontrou o Parceiro Perfeito!!",
      narrationText: narration,
      themeAnalysis: partnership,
      canRender: true,
      sourceFootprintOk: true,
      materializationOk: true,
      visualDiversity: evaluateComicsVisualDiversity({
        uniqueAssetCount: 4,
        dominantAssetRatio: 0.25,
        longestStaticSegmentSec: 2,
        visualSegmentCount: 62
      }),
      timelineScenes: onThemeTimeline
    });
    assert(report.canRender === true, "case4 canRender");
    assert(report.narrativeReady === true, "case4 narrativeReady");
    assert(report.captionReady === true, "case4 captionReady");
    assert(report.canPublish === true, "case4 canPublish");
    results.push({ test: "all_flags_true_allows_publish", ok: true });
  }

  // Case 5: 2 unique assets blocks render and publish
  {
    const flags = evaluateComicsReadinessFlags({
      sourceFootprintOk: true,
      materializationOk: true,
      themeAlignment: {
        ok: true,
        offThemeScenes: [],
        onThemeRatio: 1,
        hookAligned: true,
        climaxAligned: true,
        warnings: []
      },
      captionMaterialization: {
        ok: true,
        captionMaterializationRate: 1,
        missingCaptionScenes: [],
        wrongStyleScenes: [],
        warnings: []
      },
      visualDiversity: evaluateComicsVisualDiversity({
        uniqueAssetCount: 2,
        dominantAssetRatio: 0.56,
        longestStaticSegmentSec: 3.9,
        visualSegmentCount: 62
      })
    });
    assert(flags.canRender === false, "case5 canRender");
    assert(flags.canPublish === false, "case5 canPublish");
    assert(flags.renderBlockReason === "insufficient_visual_diversity", "case5 render reason");
    results.push({ test: "two_unique_assets_block_render", ok: true });
  }

  console.log(JSON.stringify({ ok: true, passed: results.length, results }, null, 2));
  console.log("[test] comics readiness flags: OK");
}

main().catch((error) => {
  console.log("[test] comics readiness flags: FAIL");
  console.error(error);
  process.exit(1);
});