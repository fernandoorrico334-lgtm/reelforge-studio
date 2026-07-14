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

function panel(title, id = title) {
  return {
    id,
    title,
    description: "catalog download panel",
    category: "comic_panel",
    sourceType: "catalog_download"
  };
}

async function main() {
  const beast = await importMediaBeast();
  const {
    analyzeComicsVideoTheme,
    filterRasterPanelsForComicsTheme,
    validateComicsAssetForTheme,
    evaluateComicsPublishReadiness,
    evaluateComicsVisualDiversity
  } = beast;

  const passingVisualDiversity = evaluateComicsVisualDiversity({
    uniqueAssetCount: 4,
    dominantAssetRatio: 0.25,
    longestStaticSegmentSec: 2,
    visualSegmentCount: 8
  });

  const results = [];
  const partnership = venomTheme(beast);
  const videoTitle = "O Venom Encontrou o Parceiro Perfeito!!";
  const narration =
    "Venom encontra parceiro perfeito — simbiose, dupla ideal e ligação entre hospedeiro e simbionte.";

  // Case 1: Miles raster panels rejected for Venom partnership
  {
    const rasterPanels = [
      panel("Venom Spider-Man symbiote bond comic cover duo", "on-1"),
      panel("Miles Morales: Homem-Aranha #12 comic panel p1", "miles-1"),
      panel("Miles Morales: Homem-Aranha #11 comic panel p2", "miles-2"),
      panel("Spider-Man black suit symbiote comic cover", "on-2")
    ];
    const filtered = filterRasterPanelsForComicsTheme({
      rasterPanels,
      themeAnalysis: partnership,
      narrationText: narration,
      videoTitle
    });

    assert(filtered.rejected.length === 2, "case1 should reject 2 Miles panels");
    assert(filtered.accepted.length === 2, "case1 should keep 2 on-theme panels");
    assert(
      !filtered.accepted.some((entry) => /miles/i.test(entry.title)),
      "case1 Miles must not be in accepted"
    );

    const timeline = [
      {
        sceneId: "hook-1",
        role: "hook",
        startSec: 0,
        endSec: 1,
        assetTitle: "Venom Spider-Man symbiote bond comic cover",
        caption: "VENOM DUO",
        captionStyle: "comic_pop",
        assetCategory: "comic_cover",
        assetQualityScore: 90
      },
      {
        sceneId: "cli-1",
        role: "climax",
        startSec: 1,
        endSec: 2,
        assetTitle: "Spider-Man black suit symbiote comic cover",
        caption: "TRAJE PRETO",
        captionStyle: "comic_pop",
        assetCategory: "comic_cover",
        assetQualityScore: 90
      }
    ];
    const report = evaluateComicsPublishReadiness({
      variation: "B — Comics",
      targetStyle: "comics",
      videoTitle,
      narrationText: narration,
      themeAnalysis: partnership,
      canRender: true,
      sourceFootprintOk: true,
      materializationOk: true,
      visualDiversity: passingVisualDiversity,
      timelineScenes: timeline
    });
    assert(report.canPublish === true, "case1 publish should pass without Miles");

    results.push({
      test: "venom_partnership_rejects_miles_raster",
      ok: true,
      rejected: filtered.rejected.length,
      accepted: filtered.accepted.length
    });
  }

  // Case 2: multiverse allows Miles/Gwen/2099
  {
    const mv = multiverseTheme(beast);
    const mvNarration = "Miles Morales e Gwen Stacy aparecem no Aranhaverso com 2099.";
    const filtered = filterRasterPanelsForComicsTheme({
      rasterPanels: [
        panel("Miles Morales Homem-Aranha comic panel"),
        panel("Gwen Stacy Spider-Gwen multiverse comic panel"),
        panel("Homem-Aranha 2099 multiverse variant comic splash page")
      ],
      themeAnalysis: mv,
      narrationText: mvNarration,
      videoTitle: "Homem-Aranha no multiverso"
    });
    assert(filtered.accepted.length === 3, "case2 multiverse should accept variant characters");
    results.push({ test: "multiverse_allows_variant_raster", ok: true });
  }

  // Case 3: text pages rejected
  {
    const verdict = validateComicsAssetForTheme({
      assetTitle: "Marvel checklist Stan's Soapbox editorial text page",
      themeAnalysis: partnership,
      narrationText: narration,
      videoTitle
    });
    assert(verdict.severity === "reject", "case3 text page must reject");
    results.push({ test: "text_pages_rejected", ok: true, reason: verdict.reason });
  }

  // Case 4: few on-theme assets — no off-theme fallback
  {
    const filtered = filterRasterPanelsForComicsTheme({
      rasterPanels: [panel("Venom symbiote black suit comic cover duo")],
      themeAnalysis: partnership,
      narrationText: narration,
      videoTitle
    });
    assert(filtered.accepted.length === 1, "case4 keeps single on-theme panel");
    assert(filtered.rejected.length === 0, "case4 no rejected when only on-theme");
    const milesFallback = validateComicsAssetForTheme({
      assetTitle: "Miles Morales Homem-Aranha #12 comic panel",
      themeAnalysis: partnership,
      narrationText: narration,
      videoTitle
    });
    assert(milesFallback.severity === "reject", "case4 must not use Miles as fallback");
    results.push({ test: "no_off_theme_fallback_when_sparse", ok: true });
  }

  // Case 5: central validator blocks bypass
  {
    const miles = validateComicsAssetForTheme({
      assetTitle: "Miles Morales: Homem-Aranha #12 (2019) Multiverso HQ — comic panel p1 (catalog download)",
      assetCategory: "comic_panel",
      sourceType: "catalog_download",
      themeAnalysis: partnership,
      narrationText: narration,
      videoTitle
    });
    assert(miles.severity === "reject", "case5 Miles catalog panel must reject");
    assert(miles.reason === "miles_morales_off_theme", `case5 reason=${miles.reason}`);
    results.push({ test: "validateComicsAssetForTheme_blocks_catalog_download", ok: true });
  }

  console.log(JSON.stringify({ ok: true, passed: results.length, results }, null, 2));
  console.log("[test] comics theme fallback filter: OK");
}

main().catch((error) => {
  console.log("[test] comics theme fallback filter: FAIL");
  console.error(error);
  process.exit(1);
});