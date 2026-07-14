import { readFile } from "node:fs/promises";
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
    parseSoQuadrinhosMarvelIndex,
    rankSoQuadrinhosSeriesForEntities,
    extractSoQuadrinhosSeriesCoverAssets,
    discoverSoQuadrinhosComicsAssets,
    isSubstantiveComicsAssetUrl,
    evaluateComicsAssetQuality,
    SOQUADRINHOS_SOURCE_PRIORITY,
    SOQUADRINHOS_PUBLISHER_INDEXES
  } = beast;

  const indexHtml = await readFile(
    join(projectRoot, "tmp/soquadrinhos-marvel.html"),
    "utf8"
  );
  const seriesHtml = await readFile(
    join(projectRoot, "tmp/soquadrinhos-venom-series.html"),
    "utf8"
  );

  const parsed = parseSoQuadrinhosMarvelIndex(indexHtml);
  assert(parsed.length > 100, "index should expose many Marvel series");

  const ranked = rankSoQuadrinhosSeriesForEntities(parsed, ["Venom", "Homem-Aranha"]);
  assert(
    ranked[0]?.title.toLowerCase().includes("venom") ||
      ranked[0]?.title.toLowerCase().includes("aranha"),
    "top ranked series should mention Venom or Aranha"
  );

  const antiVenom = ranked.find((entry) => /anti-venom/i.test(entry.title));
  assert(antiVenom, "Anti-Venom series should be discoverable");

  const covers = extractSoQuadrinhosSeriesCoverAssets(seriesHtml, antiVenom);
  assert(covers.length >= 1, "series page should expose at least one cover image");
  assert(
    /comicvine\.gamespot\.com|site\.soquadrinhos\.com\/wp-content\/uploads/i.test(
      covers[0].imageUrl
    ),
    "cover should come from ComicVine or SoQuadrinhos uploads"
  );

  const substantive = isSubstantiveComicsAssetUrl(covers[0].imageUrl);
  assert(substantive.ok, `cover URL should be substantive (${substantive.reason})`);

  const quality = evaluateComicsAssetQuality({
    title: `${antiVenom.title} — Marvel comic cover (SoQuadrinhos)`,
    description: "SoQuadrinhos Marvel HQ catalog — symbiote comic cover art",
    sourceUrl: covers[0].imageUrl,
    entities: ["Venom", "Homem-Aranha"],
    franchise: "Marvel",
    targetStyle: "comics",
    requireSubstantiveUrl: true
  });
  assert(quality.ok, `catalog cover should pass gate (${quality.rejectReason})`);
  assert(quality.score >= 75, `catalog cover score should be premium (${quality.score})`);

  const offlineDiscovery = await discoverSoQuadrinhosComicsAssets({
    entities: ["Venom", "Homem-Aranha"],
    indexHtml,
    maxSeries: 1,
    fetchFn: async (url) => {
      if (!url.includes("anti-venom-novas-formas-de-viver")) {
        return new Response("", { status: 404 });
      }
      return new Response(seriesHtml, { status: 200 });
    }
  });

  assert(offlineDiscovery.candidates.length >= 1, "offline discovery should yield candidates");
  assert(
    SOQUADRINHOS_SOURCE_PRIORITY === "critical",
    "SoQuadrinhos should be marked critical priority"
  );
  assert(
    SOQUADRINHOS_PUBLISHER_INDEXES[0]?.heroScope === "multi_hero",
    "SoQuadrinhos catalog should support multi-hero scope"
  );
  assert(
    offlineDiscovery.candidates.every(
      (candidate) => candidate.metadata.sourcePriority === "critical"
    ),
    "catalog candidates should carry critical source priority"
  );

  const wolverineRanked = rankSoQuadrinhosSeriesForEntities(parsed, ["Wolverine"]).slice(0, 8);
  const wolverineHit = wolverineRanked.find(
    (entry) =>
      /wolverine|arma x/i.test(entry.title) && entry.relevanceScore >= 10
  );
  assert(wolverineHit, "catalog should surface other Marvel heroes (e.g. Wolverine / Arma X)");

  console.log(
    `[soquadrinhos] OK — priority=${SOQUADRINHOS_SOURCE_PRIORITY} index=${parsed.length} rankedTop=${ranked[0]?.title} covers=${covers.length} offlineCandidates=${offlineDiscovery.candidates.length} wolverineTop=${wolverineRanked[0]?.title}`
  );
}

main().catch((error) => {
  console.error("[soquadrinhos] FAIL");
  console.error(error);
  process.exit(1);
});