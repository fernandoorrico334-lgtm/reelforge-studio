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
  const beast = await importMediaBeast();
  const {
    isPublishOffThemeAsset,
    isTextHeavyComicsAsset,
    scoreAssetForThemedTimelineRotation,
    isAssetThemeEligibleForTimeline,
    analyzeComicsVideoTheme
  } = beast;

  const theme = analyzeComicsVideoTheme({
    videoTitle: "O Venom Encontrou o Parceiro Perfeito!!",
    narrationText: "Venom encontra parceiro perfeito — simbiose e dupla ideal.",
    entities: ["Venom", "Homem-Aranha"]
  });

  const narration =
    "Venom encontra parceiro perfeito — simbiose, dupla ideal e ligação entre hospedeiro e simbionte.";

  const offThemeAssets = [
    "Miles Morales Homem-Aranha comic panel",
    "Gwen Stacy Spider-Gwen multiverse comic panel",
    "Homem-Aranha 2099 multiverse variant comic cover",
    "Marvel checklist text page",
    "Stan's Soapbox editorial page"
  ];

  for (const title of offThemeAssets) {
    const verdict = isPublishOffThemeAsset({
      assetTitle: title,
      themeAnalysis: theme,
      narrationText: narration
    });
    assert(verdict.offTheme, `off-theme expected: ${title} (${verdict.reason})`);
    assert(
      !isAssetThemeEligibleForTimeline(
        { id: title, title, path: "x.jpg", score: 90, category: "comic_panel" },
        theme,
        narration
      ),
      `rotation pool should reject: ${title}`
    );
    const score = scoreAssetForThemedTimelineRotation(
      { id: title, title, path: "x.jpg", score: 90, category: "comic_panel" },
      "development_a",
      theme,
      narration
    );
    assert(score < 20, `rotation score should be crushed for ${title}: ${score}`);
  }

  const onThemeAssets = [
    "O ESPETACULAR HOMEM-ARANHA/VENOM: Espiral Mortal comic cover",
    "SIMBIONTE HOMEM-ARANHA Marvel comic cover",
    "Venom Spider-Man symbiote bond comic panel duo"
  ];

  for (const title of onThemeAssets) {
    const verdict = isPublishOffThemeAsset({
      assetTitle: title,
      themeAnalysis: theme,
      narrationText: narration
    });
    assert(!verdict.offTheme, `on-theme expected: ${title}`);
    assert(
      isAssetThemeEligibleForTimeline(
        { id: title, title, path: "x.jpg", score: 90, category: "comic_cover" },
        theme,
        narration
      ),
      `rotation pool should accept: ${title}`
    );
  }

  assert(isTextHeavyComicsAsset({ title: "Marvel checklist letters page" }), "text-heavy detect");

  console.log(
    JSON.stringify(
      {
        ok: true,
        offThemeBlocked: offThemeAssets.length,
        onThemeAccepted: onThemeAssets.length
      },
      null,
      2
    )
  );
  console.log("[test] comics theme-aware timeline: OK");
}

main().catch((error) => {
  console.log("[test] comics theme-aware timeline: FAIL");
  console.error(error);
  process.exit(1);
});