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

const OFFLINE_FEED = {
  feed: {
    entry: [
      {
        title: { $t: "Venom (2019) #35 (2023)" },
        content: {
          $t: '<a href="https://sq-apresenta.blogspot.com/2026/06/venom-2019-35.html"><img src="https://i.postimg.cc/abc123/venom-cover.jpg" /></a><br/>Equipe: Donny Cates'
        },
        published: { $t: "2026-06-15T10:00:00-07:00" },
        category: [{ term: "Em Andamento" }, { term: "Lancamentos" }],
        link: [
          {
            rel: "alternate",
            href: "https://sq-apresenta.blogspot.com/2026/06/venom-2019-35.html"
          }
        ]
      },
      {
        title: { $t: "G.I. Joe - Um Verdadeiro Herói Americano #181 (2012)" },
        content: {
          $t: '<a href="https://sq-apresenta.blogspot.com/2026/07/gi-joe.html"><img src="https://i.postimg.cc/wMdCxvsr/VHA181-001.jpg" /></a>'
        },
        published: { $t: "2026-07-01T10:00:00-07:00" },
        category: [{ term: "Em Andamento" }, { term: "Lancamentos" }],
        link: [
          {
            rel: "alternate",
            href: "https://sq-apresenta.blogspot.com/2026/07/gi-joe.html"
          }
        ]
      }
    ]
  }
};

async function main() {
  const beast = await importMediaBeast();
  const {
    parseSoQuadrinhossLancamentosFeed,
    discoverSoQuadrinhossLancamentosAssets,
    buildSqApresentaFeedUrl,
    isUsableBlogspotCoverUrl,
    isSubstantiveComicsAssetUrl,
    evaluateComicsAssetQuality,
    SOQUADRINHOSS_LANCAMENTOS_DISCOVERY_SOURCE,
    SOQUADRINHOSS_LANCAMENTOS_PAGE_URL,
    SOQUADRINHOSS_LANCAMENTOS_SOURCE_PRIORITY,
    SOQUADRINHOSS_LANCAMENTOS_PUBLISHER
  } = beast;

  const feedUrl = buildSqApresentaFeedUrl("Lancamentos", { maxResults: 6 });
  assert(
    feedUrl.includes("sq-apresenta.blogspot.com/feeds/posts/default/-/Lancamentos"),
    "feed URL should target sq-apresenta Lancamentos tag"
  );

  const parsed = parseSoQuadrinhossLancamentosFeed(
    OFFLINE_FEED,
    feedUrl,
    "Lancamentos",
    ["Venom", "Homem-Aranha"]
  );
  assert(parsed.length === 2, `expected 2 parsed cards (${parsed.length})`);
  assert(
    parsed[0]?.title.toLowerCase().includes("venom"),
    "Venom card should rank first for entity filter"
  );
  assert(
    isUsableBlogspotCoverUrl(parsed[0].imageUrl),
    "cover URL should be usable"
  );
  assert(
    parsed[0].postUrl.includes("sq-apresenta.blogspot.com"),
    "post URL should point to sq-apresenta"
  );
  assert(parsed[0].status === "Em Andamento", "status should be extracted from categories");

  const offlineDiscovery = await discoverSoQuadrinhossLancamentosAssets({
    entities: ["Venom", "Homem-Aranha"],
    maxResultsPerFeed: 6,
    maxCandidates: 8,
    fetchFn: async () => new Response("", { status: 404 }),
    feedJsonByUrl: {
      [feedUrl]: OFFLINE_FEED,
      [buildSqApresentaFeedUrl("Estreia", { maxResults: 6 })]: { feed: { entry: [] } },
      [buildSqApresentaFeedUrl("Última Edição", { maxResults: 6 })]: { feed: { entry: [] } }
    }
  });

  assert(
    offlineDiscovery.candidates.length === 1,
    `only Venom should pass relevance gate (${offlineDiscovery.candidates.length})`
  );
  assert(
    offlineDiscovery.candidates[0]?.metadata.discoverySource ===
      SOQUADRINHOSS_LANCAMENTOS_DISCOVERY_SOURCE,
    "candidate should carry lancamentos discovery source"
  );
  assert(
    offlineDiscovery.candidates[0]?.metadata.blogspotPostUrl?.includes("venom"),
    "candidate should expose blogspotPostUrl for ingestion"
  );

  const quality = evaluateComicsAssetQuality({
    title: offlineDiscovery.candidates[0].title,
    description: "SoQuadrinhos lançamentos catalog cover",
    sourceUrl: offlineDiscovery.candidates[0].sourceUrl,
    entities: ["Venom"],
    franchise: "Marvel",
    targetStyle: "comics",
    requireSubstantiveUrl: true
  });
  assert(quality.ok, `catalog cover should pass gate (${quality.rejectReason})`);

  const substantive = isSubstantiveComicsAssetUrl(offlineDiscovery.candidates[0].sourceUrl);
  assert(substantive.ok, `cover URL should be substantive (${substantive.reason})`);

  assert(
    SOQUADRINHOSS_LANCAMENTOS_SOURCE_PRIORITY === "critical",
    "lancamentos source should be critical priority"
  );
  assert(
    SOQUADRINHOSS_LANCAMENTOS_PUBLISHER.indexUrl === SOQUADRINHOSS_LANCAMENTOS_PAGE_URL,
    "publisher should reference lancamentos page"
  );

  let liveCandidates = 0;
  try {
    const liveDiscovery = await discoverSoQuadrinhossLancamentosAssets({
      entities: ["Marvel", "Venom", "Homem-Aranha", "Spider-Man"],
      maxResultsPerFeed: 8,
      maxCandidates: 16
    });
    liveCandidates = liveDiscovery.candidates.length;
    assert(liveDiscovery.feedsScanned === 3, "live discovery should scan 3 feeds");
    assert(liveDiscovery.entriesFound > 0, "live feeds should return entries");
  } catch (error) {
    console.warn("[soquadrinhoss-lancamentos] live fetch skipped:", error.message);
  }

  console.log(
    `[soquadrinhoss-lancamentos] OK — parsed=${parsed.length} offlineCandidates=${offlineDiscovery.candidates.length} liveCandidates=${liveCandidates} publisher=${SOQUADRINHOSS_LANCAMENTOS_PUBLISHER.label}`
  );
}

main().catch((error) => {
  console.error("[soquadrinhoss-lancamentos] FAIL");
  console.error(error);
  process.exit(1);
});