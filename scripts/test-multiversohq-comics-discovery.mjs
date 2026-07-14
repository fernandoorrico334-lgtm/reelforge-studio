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
    parseMultiversohqComicCards,
    resolveMultiversohqFeedsForEntities,
    discoverMultiversohqComicsAssets,
    isSubstantiveComicsAssetUrl,
    evaluateComicsAssetQuality,
    PRIMARY_CATALOG_SOURCE_PRIORITY
  } = beast;

  const marvelHtml = await readFile(
    join(projectRoot, "tmp/multiversohq-marvel.html"),
    "utf8"
  );
  const spiderHtml = await readFile(
    join(projectRoot, "tmp/multiversohq-homem-aranha.html"),
    "utf8"
  );

  const marvelCards = parseMultiversohqComicCards(
    marvelHtml,
    "https://multiversohq.com/marvel-comics/",
    ["Venom", "Homem-Aranha"]
  );
  assert(marvelCards.length >= 15, "marvel index should expose many cover cards");
  assert(marvelCards[0]?.imageUrl.includes("wp-content/uploads"), "cards should use direct uploads");

  const spiderCards = parseMultiversohqComicCards(
    spiderHtml,
    "https://multiversohq.com/homem-aranha/",
    ["Homem-Aranha"]
  );
  assert(spiderCards.length >= 15, "homem-aranha feed should expose cover cards");
  assert(/homem-aranha/i.test(spiderCards[0]?.title ?? ""), "spider feed should rank spider titles");

  const feeds = resolveMultiversohqFeedsForEntities(["Venom", "Homem-Aranha"]);
  assert(feeds.includes("https://multiversohq.com/marvel-comics/"), "marvel feed always included");
  assert(feeds.includes("https://multiversohq.com/homem-aranha/"), "entity feed resolved");

  const substantive = isSubstantiveComicsAssetUrl(spiderCards[0].imageUrl);
  assert(substantive.ok, `cover should be substantive (${substantive.reason})`);

  const quality = evaluateComicsAssetQuality({
    title: `${spiderCards[0].title} — Marvel comic cover (Multiverso HQ)`,
    description: "Multiverso HQ Marvel catalog — symbiote comic cover art",
    sourceUrl: spiderCards[0].imageUrl,
    entities: ["Homem-Aranha", "Venom"],
    franchise: "Marvel",
    targetStyle: "comics",
    requireSubstantiveUrl: true
  });
  assert(quality.ok, `spider cover should pass gate (${quality.rejectReason})`);
  assert(quality.score >= 75, `spider cover should be premium (${quality.score})`);

  const offline = await discoverMultiversohqComicsAssets({
    entities: ["Homem-Aranha"],
    maxFeeds: 2,
    maxPagesPerFeed: 1,
    feedHtmlByUrl: {
      "https://multiversohq.com/marvel-comics/": marvelHtml,
      "https://multiversohq.com/homem-aranha/": spiderHtml
    },
    fetchFn: async () => new Response("", { status: 404 })
  });
  assert(offline.candidates.length >= 10, "offline discovery should yield catalog candidates");
  assert(
    offline.candidates.every((candidate) => candidate.metadata.sourcePriority === PRIMARY_CATALOG_SOURCE_PRIORITY),
    "all MHQ candidates should be critical priority"
  );

  console.log(
    `[multiversohq] OK — marvelCards=${marvelCards.length} spiderCards=${spiderCards.length} offlineCandidates=${offline.candidates.length}`
  );
}

main().catch((error) => {
  console.error("[multiversohq] FAIL");
  console.error(error);
  process.exit(1);
});