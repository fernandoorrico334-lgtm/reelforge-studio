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
    parseBlogspotComicCards,
    resolveBlogspotFeedsForPublisher,
    discoverBlogspotComicsAssets,
    isUsableBlogspotCoverUrl,
    isSubstantiveComicsAssetUrl,
    evaluateComicsAssetQuality,
    BLOGSPOT_CATALOG_PUBLISHERS,
    PRIMARY_CATALOG_SOURCE_PRIORITY
  } = beast;

  const podermarvelHtml = await readFile(
    join(projectRoot, "tmp/blogspot-sources/podermarvel.html"),
    "utf8"
  );
  const ndranghetaHtml = await readFile(
    join(projectRoot, "tmp/blogspot-sources/ndrangheta.html"),
    "utf8"
  );
  const osinvisiveisHtml = await readFile(
    join(projectRoot, "tmp/blogspot-sources/osinvisiveis.html"),
    "utf8"
  );

  const podermarvelPublisher = BLOGSPOT_CATALOG_PUBLISHERS.find(
    (entry) => entry.id === "podermarvel-blogspot"
  );
  assert(podermarvelPublisher, "podermarvel publisher");

  const podermarvelCards = parseBlogspotComicCards(
    podermarvelHtml,
    podermarvelPublisher.baseUrl,
    podermarvelPublisher,
    ["Venom", "Wolverine", "Homem-Aranha"]
  );
  assert(podermarvelCards.length >= 8, `podermarvel cards (${podermarvelCards.length})`);
  assert(
    podermarvelCards.some((card) => /wolverine|venom|ultimate/i.test(card.title)),
    "podermarvel should rank marvel titles"
  );
  assert(
    podermarvelCards[0]?.downloadLinks.length >= 1,
    "podermarvel posts should expose mediafire links"
  );
  assert(
    isUsableBlogspotCoverUrl(podermarvelCards[0].imageUrl),
    "podermarvel cover should be usable"
  );

  const ndranghetaPublisher = BLOGSPOT_CATALOG_PUBLISHERS.find(
    (entry) => entry.id === "ndrangheta-blogspot"
  );
  const ndranghetaCards = parseBlogspotComicCards(
    ndranghetaHtml,
    ndranghetaPublisher.baseUrl,
    ndranghetaPublisher,
    ["Marvel"]
  );
  assert(ndranghetaCards.length >= 5, `ndrangheta cards (${ndranghetaCards.length})`);

  const osinvisiveisPublisher = BLOGSPOT_CATALOG_PUBLISHERS.find(
    (entry) => entry.id === "osinvisiveis-blogspot"
  );
  const osinvisiveisCards = parseBlogspotComicCards(
    osinvisiveisHtml,
    "https://osinvisiveishq.blogspot.com/search/label/Capit%C3%A3o%20Planeta",
    osinvisiveisPublisher,
    ["Capitão Planeta"]
  );
  assert(osinvisiveisCards.length >= 1, "osinvisiveis label page should have cards");
  assert(/planeta/i.test(osinvisiveisCards[0]?.title ?? ""), "capitao planeta title");

  const feeds = resolveBlogspotFeedsForPublisher(podermarvelPublisher, ["Venom", "Homem-Aranha"]);
  assert(feeds.some((url) => /VENOM/i.test(url)), "venom label feed");
  assert(feeds.some((url) => /HOMEM-ARANHA/i.test(url)), "spider label feed");

  const substantive = isSubstantiveComicsAssetUrl(podermarvelCards[0].imageUrl);
  assert(substantive.ok, `cover substantive (${substantive.reason})`);

  const marvelCard =
    podermarvelCards.find((card) => /wolverine|venom|homem-aranha/i.test(card.title)) ??
    podermarvelCards[0];
  const quality = evaluateComicsAssetQuality({
    title: `${marvelCard.title} — Marvel comic cover (Poder Marvel)`,
    description: "Blogspot Marvel catalog symbiote comic cover",
    sourceUrl: marvelCard.imageUrl,
    entities: ["Venom", "Wolverine", "Homem-Aranha"],
    franchise: "Marvel",
    targetStyle: "comics",
    requireSubstantiveUrl: true
  });
  assert(quality.ok, `podermarvel cover gate (${quality.rejectReason})`);

  const offline = await discoverBlogspotComicsAssets({
    entities: ["Venom", "Homem-Aranha"],
    maxFeeds: 3,
    maxPagesPerFeed: 1,
    maxCandidates: 20,
    feedHtmlByUrl: {
      [podermarvelPublisher.baseUrl]: podermarvelHtml,
      "https://podermarvel.blogspot.com/search/label/VENOM": podermarvelHtml,
      [ndranghetaPublisher.baseUrl]: ndranghetaHtml,
      "https://osinvisiveishq.blogspot.com/search/label/Marvel%20Comics": osinvisiveisHtml
    },
    fetchFn: async () => new Response("", { status: 404 })
  });
  assert(offline.candidates.length >= 10, `offline blogspot candidates (${offline.candidates.length})`);
  assert(
    offline.candidates.every(
      (candidate) => candidate.metadata.sourcePriority === PRIMARY_CATALOG_SOURCE_PRIORITY
    ),
    "blogspot candidates should be critical priority"
  );

  console.log(
    `[blogspot] OK — podermarvel=${podermarvelCards.length} ndrangheta=${ndranghetaCards.length} osinvisiveis=${osinvisiveisCards.length} offline=${offline.candidates.length}`
  );
}

main().catch((error) => {
  console.error("[blogspot] FAIL");
  console.error(error);
  process.exit(1);
});