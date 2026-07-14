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

function multiverseTheme(beast) {
  return beast.analyzeComicsVideoTheme({
    videoTitle: "Homem-Aranha no multiverso",
    narrationText: "Miles Morales e Gwen Stacy aparecem no Aranhaverso.",
    entities: ["Homem-Aranha"]
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
    analyzeComicsVideoTheme,
    evaluateComicsPublishReadiness,
    evaluateComicsVisualDiversity,
    isTextHeavyComicsAsset,
    isPublishOffThemeAsset,
    validateThemeAlignedTimeline,
    validateCaptionMaterialization,
    NOT_READY_FOR_PUBLICATION
  } = beast;

  const passingVisualDiversity = evaluateComicsVisualDiversity({
    uniqueAssetCount: 4,
    dominantAssetRatio: 0.25,
    longestStaticSegmentSec: 2,
    visualSegmentCount: 10
  });

  const results = [];
  const partnership = venomTheme(beast);
  const narration =
    "Venom encontra parceiro perfeito — simbiose, dupla ideal e ligação entre hospedeiro e simbionte.";

  // Case 1: off-theme Miles/Gwen/2099 in partnership timeline
  {
    const timeline = [
      makeScene("hook-1", "hook", "Venom Spider-Man symbiote bond comic cover"),
      makeScene("dev-1", "development_a", "Miles Morales Homem-Aranha comic panel"),
      makeScene("dev-2", "development_b", "Gwen Stacy Spider-Gwen multiverse comic panel"),
      makeScene("dev-3", "curiosity", "Homem-Aranha 2099 multiverse variant comic cover"),
      makeScene("cli-1", "climax", "Venom symbiote transformation comic cover")
    ];
    const themeAlignment = validateThemeAlignedTimeline({
      videoTitle: "O Venom Encontrou o Parceiro Perfeito!!",
      narrationText: narration,
      themeAnalysis: partnership,
      timelineScenes: timeline
    });
    const report = evaluateComicsPublishReadiness({
      variation: "B — Comics",
      targetStyle: "comics",
      videoTitle: "O Venom Encontrou o Parceiro Perfeito!!",
      narrationText: narration,
      themeAnalysis: partnership,
      canRender: true,
      sourceFootprintOk: true,
      materializationOk: true,
      visualDiversity: passingVisualDiversity,
      timelineScenes: timeline
    });

    assert(themeAlignment.offThemeScenes.length >= 3, "case1 should detect off-theme scenes");
    assert(report.canRender === true, "case1 canRender should stay true when diversity passes");
    assert(report.canPublish === false, "case1 canPublish must be false");
    assert(report.publishBlockReason, "case1 publish block reason required");

    results.push({
      test: "partnership_blocks_miles_gwen_2099",
      ok: true,
      offThemeCount: themeAlignment.offThemeScenes.length,
      publishBlockReason: report.publishBlockReason
    });
  }

  // Case 1b: fast-cut micro "outro" roles still block Miles off-theme
  {
    const timeline = [
      makeScene("fastcut-001", "hook", "Venom Spider-Man symbiote bond comic cover"),
      makeScene("fastcut-007", "outro", "Miles Morales Homem-Aranha #12 comic panel"),
      makeScene("fastcut-008", "outro", "Miles Morales Homem-Aranha #11 comic panel"),
      makeScene("fastcut-004", "climax", "Venom symbiote transformation comic cover")
    ];
    const themeAlignment = validateThemeAlignedTimeline({
      videoTitle: "O Venom Encontrou o Parceiro Perfeito!!",
      narrationText: narration,
      themeAnalysis: partnership,
      timelineScenes: timeline
    });
    const report = evaluateComicsPublishReadiness({
      variation: "B — Comics",
      targetStyle: "comics",
      videoTitle: "O Venom Encontrou o Parceiro Perfeito!!",
      narrationText: narration,
      themeAnalysis: partnership,
      canRender: true,
      sourceFootprintOk: true,
      materializationOk: true,
      visualDiversity: passingVisualDiversity,
      timelineScenes: timeline
    });

    assert(themeAlignment.offThemeScenes.length >= 2, "case1b should detect Miles in outro micro roles");
    assert(report.canPublish === false, "case1b canPublish must be false");

    results.push({
      test: "fastcut_outro_blocks_miles_off_theme",
      ok: true,
      offThemeCount: themeAlignment.offThemeScenes.length
    });
  }

  // Case 2: text-heavy pages blocked
  {
    assert(
      isTextHeavyComicsAsset({ title: "Marvel checklist text page" }),
      "checklist should be text-heavy"
    );
    assert(
      isPublishOffThemeAsset({
        assetTitle: "Stan's Soapbox Marvel bulletin",
        themeAnalysis: partnership,
        narrationText: narration,
        videoTitle: "O Venom Encontrou o Parceiro Perfeito!!"
      }).offTheme,
      "soapbox should be off-theme"
    );

    const timeline = [
      makeScene("hook-1", "hook", "Venom symbiote comic cover"),
      makeScene("dev-1", "development_a", "Marvel checklist text page editorial"),
      makeScene("cli-1", "climax", "Spider-Man black suit symbiote comic cover")
    ];
    const report = evaluateComicsPublishReadiness({
      variation: "B — Comics",
      targetStyle: "comics",
      videoTitle: "O Venom Encontrou o Parceiro Perfeito!!",
      narrationText: narration,
      themeAnalysis: partnership,
      canRender: true,
      sourceFootprintOk: true,
      materializationOk: true,
      visualDiversity: passingVisualDiversity,
      timelineScenes: timeline
    });
    assert(report.canPublish === false, "case2 text pages must block publish");

    results.push({ test: "text_heavy_pages_block_publish", ok: true });
  }

  // Case 3: missing captions block publish
  {
    const timeline = [
      makeScene("hook-1", "hook", "Venom Spider-Man symbiote bond comic cover", ""),
      makeScene("dev-1", "development_a", "Venom symbiote comic panel", ""),
      makeScene("cli-1", "climax", "Spider-Man black suit symbiote comic cover", "")
    ];
    const captions = validateCaptionMaterialization({
      timelineScenes: timeline,
      targetStyle: "comics"
    });
    const report = evaluateComicsPublishReadiness({
      variation: "B — Comics",
      targetStyle: "comics",
      videoTitle: "O Venom Encontrou o Parceiro Perfeito!!",
      narrationText: narration,
      themeAnalysis: partnership,
      canRender: true,
      sourceFootprintOk: true,
      materializationOk: true,
      visualDiversity: passingVisualDiversity,
      timelineScenes: timeline
    });

    assert(!captions.ok, "case3 captions should fail");
    assert(report.canPublish === false, "case3 publish blocked");
    assert(report.publishBlockReason === "captions_not_materialized", "case3 caption block reason");

    results.push({
      test: "missing_captions_block_publish",
      ok: true,
      captionMaterializationRate: captions.captionMaterializationRate
    });
  }

  // Case 4: on-theme timeline with captions passes publish
  {
    const timeline = Array.from({ length: 10 }, (_, index) =>
      makeScene(
        `scene-${index}`,
        index === 0 ? "hook" : index === 9 ? "climax" : "development_a",
        index % 2 === 0
          ? "Venom Spider-Man symbiote bond comic panel duo"
          : "Spider-Man black suit symbiote comic cover",
        index === 0 ? "VENOM DUO" : index === 9 ? "TRAJE PRETO" : "SIMBIONTE HOST"
      )
    );
    const report = evaluateComicsPublishReadiness({
      variation: "B — Comics",
      targetStyle: "comics",
      videoTitle: "O Venom Encontrou o Parceiro Perfeito!!",
      narrationText: narration,
      themeAnalysis: partnership,
      canRender: true,
      sourceFootprintOk: true,
      materializationOk: true,
      visualDiversity: passingVisualDiversity,
      timelineScenes: timeline
    });

    assert(report.canPublish === true, `case4 should publish: ${report.publishBlockReason}`);
    assert(report.publishBlockReason === null, "case4 no block reason");

    results.push({
      test: "on_theme_captions_allow_publish",
      ok: true,
      onThemeRatio: report.themeAlignment.onThemeRatio,
      captionRate: report.captionMaterialization.captionMaterializationRate
    });
  }

  // Case 5: multiverse narration allows Miles/Gwen/2099
  {
    const mv = multiverseTheme(beast);
    const mvNarration = "Miles Morales e Gwen Stacy aparecem no Aranhaverso com 2099.";
    const timeline = [
      makeScene("hook-1", "hook", "Spider-Man Spider-Verse multiverse comic cover variants"),
      makeScene("dev-1", "development_a", "Miles Morales Homem-Aranha comic panel"),
      makeScene("dev-2", "development_b", "Gwen Stacy Spider-Gwen multiverse comic panel"),
      makeScene("cli-1", "climax", "Homem-Aranha 2099 multiverse variant comic splash page")
    ];
    const themeAlignment = validateThemeAlignedTimeline({
      videoTitle: "Homem-Aranha no multiverso",
      narrationText: mvNarration,
      themeAnalysis: mv,
      timelineScenes: timeline
    });
    const report = evaluateComicsPublishReadiness({
      variation: "B — Comics",
      targetStyle: "comics",
      videoTitle: "Homem-Aranha no multiverso",
      narrationText: mvNarration,
      themeAnalysis: mv,
      canRender: true,
      sourceFootprintOk: true,
      materializationOk: true,
      visualDiversity: passingVisualDiversity,
      timelineScenes: timeline
    });

    const milesBlocked = themeAlignment.offThemeScenes.some((s) => /miles/i.test(s.assetTitle));
    assert(!milesBlocked, "case5 Miles should be allowed in multiverse narration");
    assert(report.canPublish === true, "case5 multiverse should publish");

    results.push({ test: "multiverse_allows_variant_characters", ok: true });
  }

  assert(NOT_READY_FOR_PUBLICATION === "not_ready_for_publication", "constant export");

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
  console.log("[test] comics publish readiness: OK");
}

main().catch((error) => {
  console.log("[test] comics publish readiness: FAIL");
  console.error(error);
  process.exit(1);
});