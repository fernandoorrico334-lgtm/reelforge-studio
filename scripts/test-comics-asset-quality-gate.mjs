import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");

async function importMediaBeast() {
  return import(
    pathToFileURL(resolve(projectRoot, "packages/media-beast/dist/index.js")).href
  );
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const ENTITIES = ["Venom", "Homem-Aranha", "simbionte"];

const GOOD_CASES = [
  {
    id: "venom-comic-panel",
    title: "Venom Spider-Man comic panel Marvel golden age scan halftone",
    expectedCategory: "comic_panel",
    minScore: 75
  },
  {
    id: "vs-comic-panel",
    title: "Spider-Man vs Venom comic panel Marvel HQ black suit",
    expectedCategory: "comic_panel",
    minScore: 75
  },
  {
    id: "comic-cover",
    title: "Venom symbiote comic cover Marvel issue cover art",
    expectedCategory: "comic_cover",
    minScore: 75
  },
  {
    id: "black-suit-cover",
    title: "Spider-Man black suit comic cover Marvel HQ",
    expectedCategory: "comic_cover",
    minScore: 75
  },
  {
    id: "eddie-brock-art",
    title: "Eddie Brock Venom character art official Marvel comic art illustration",
    expectedCategory: "character_art",
    minScore: 75
  },
  {
    id: "symbiote-panel",
    title: "Venom symbiote suit comic panel Marvel comic art",
    expectedCategory: "comic_panel",
    minScore: 75
  },
  {
    id: "venom-comic-cover-title",
    title: "Venom comic cover Marvel issue symbiote",
    expectedCategory: "comic_cover",
    minScore: 70
  },
  {
    id: "venom-symbiote-spiderman-panel",
    title: "Venom symbiote Spider-Man panel Marvel comic",
    expectedCategory: "comic_panel",
    minScore: 70
  }
];

const BAD_CASES = [
  {
    id: "candle",
    title: "Venom candle wax product scented candle",
    expectedCategory: "product"
  },
  {
    id: "beetle",
    title: "beetle insect venom toxin biology species",
    expectedCategory: "biological_venom"
  },
  {
    id: "mollusk-symbiote",
    title: "Pleurotoma symbiotes FMIB mollusk species museum specimen",
    expectedCategory: "specimen"
  },
  {
    id: "shell-conch",
    title: "marine shell conch mollusc symbiosis biology",
    expectedCategory: "specimen"
  },
  {
    id: "lego",
    title: "LEGO Symbiote-Suit Spider Man minifigure toy Marvel",
    expectedCategory: "toy"
  },
  {
    id: "lego-set-number",
    title: "30448 Spider-Man vs. The Venom Symbiote",
    expectedCategory: "toy"
  },
  {
    id: "cosplay",
    title: "Venom cosplay convention costume amateur fan dressed Comic-Con",
    expectedCategory: "cosplay"
  },
  {
    id: "comic-con-cosplay",
    title: "2023 NYCC Cosplay of Venom Spider-Man",
    expectedCategory: "cosplay"
  },
  {
    id: "movie-poster",
    title: "Venom Let There Be Carnage movie poster hollywood product",
    expectedCategory: "movie_still"
  },
  {
    id: "logo",
    title: "venom 2018 logo png brand icon only",
    expectedCategory: "logo"
  },
  {
    id: "hoodie",
    title: "Venom moletom hoodie merch store product sale shirt",
    expectedCategory: "merchandise"
  },
  {
    id: "kombucha-symbiote",
    title: "Photophore en symbiote de kombucha.png Naturalis specimen",
    expectedCategory: "specimen"
  },
  {
    id: "biological-ant",
    title: "Pogonomyrmex venom ant species insect",
    expectedCategory: "biological_venom"
  },
  {
    id: "de-havilland-venom",
    title: "De Havilland Venom 3-view line drawing.png",
    sourceUrl:
      "https://commons.wikimedia.org/wiki/File:De_Havilland_Venom_3-view_line_drawing.png",
    expectedCategory: "irrelevant",
    expectedRejectReason: "non_comics_homonym"
  },
  {
    id: "flickr-cosplay-photo",
    title: "Venomized Spider-man",
    sourceUrl: "https://www.flickr.com/photos/9139965@N07/38294352342",
    expectedCategory: "unknown"
  },
  {
    id: "flickr-lego-photo",
    title: "Spider-Man vs. Venom",
    sourceUrl: "https://www.flickr.com/photos/59454670@N07/30519118435",
    expectedCategory: "unknown"
  },
  {
    id: "commons-cosplay-photo",
    title: "Symbiote Spider-Man",
    sourceUrl: "https://www.flickr.com/photos/19953384@N00/48343887467",
    expectedCategory: "unknown"
  },
  {
    id: "flickr-search-lead",
    title: "Flickr past lead: Flickr past: golden age comic scan",
    sourceUrl:
      "https://www.flickr.com/search/?text=Venom+symbiote+comic+cover+golden+age+comic+scan",
    expectedCategory: "irrelevant",
    expectedRejectReason: "search_surface_not_substantive_asset"
  },
  {
    id: "archive-search-lead",
    title: "Internet Archive past: Historical image collections",
    sourceUrl:
      "https://archive.org/search?query=%22Venom+Spider-Man+comic+panel%22+AND+mediatype%3Aimage",
    expectedCategory: "irrelevant",
    expectedRejectReason: "search_surface_not_substantive_asset"
  }
];

async function main() {
  const beast = await importMediaBeast();
  const {
    evaluateComicsAssetQuality,
    classifyComicsAssetSemanticFit,
    isPremiumHookClimaxAsset,
    isTrueComicsAssetCategory,
    isBiologicalSymbioteWithoutComicsContext,
    detectForbiddenVisualAuditReason,
    isBlockedComicsQuery,
    buildComicsSuperheroDiscoveryQueries,
    buildFocusedComicsDiscoveryQueries,
    isSubstantiveComicsAssetUrl,
    HOOK_CLIMAX_MIN_SCORE,
    SUPPORT_MIN_SCORE,
    MIN_TRUE_COMICS_ASSETS,
    MIN_PREMIUM_ACCEPTED_COUNT
  } = beast;

  const results = [];

  for (const sample of GOOD_CASES) {
    const quality = evaluateComicsAssetQuality({
      title: sample.title,
      entities: ENTITIES,
      targetStyle: "comics",
      width: 1080,
      height: 1920
    });
    assert(quality.ok, `good asset should pass: ${sample.id} -> ${quality.rejectReason}`);
    assert(
      quality.score >= sample.minScore,
      `good asset score too low (${sample.id}): ${quality.score}`
    );
    assert(isTrueComicsAssetCategory(quality.category), `not true comics: ${sample.id}`);
    assert(
      isPremiumHookClimaxAsset(quality),
      `good asset should qualify for hook/climax: ${sample.id}`
    );
    assert(!detectForbiddenVisualAuditReason(sample.title), `forbidden term in good: ${sample.id}`);
    results.push({ id: sample.id, ok: quality.ok, score: quality.score, category: quality.category });
  }

  for (const sample of BAD_CASES) {
    const quality = evaluateComicsAssetQuality({
      title: sample.title,
      ...(sample.sourceUrl ? { sourceUrl: sample.sourceUrl } : {}),
      query: "Venom Spider-Man comic panel Marvel",
      entities: ENTITIES,
      targetStyle: "comics"
    });
    assert(!quality.ok, `bad asset should be rejected: ${sample.id}`);
    assert(
      !isPremiumHookClimaxAsset(quality),
      `bad asset must not qualify for hook/climax: ${sample.id}`
    );
    if (sample.expectedCategory !== "movie_still" && sample.expectedRejectReason == null) {
      assert(
        quality.category === sample.expectedCategory,
        `expected category ${sample.expectedCategory} for ${sample.id}, got ${quality.category}`
      );
    }
    if (sample.expectedRejectReason) {
      assert(
        quality.rejectReason === sample.expectedRejectReason,
        `expected reject ${sample.expectedRejectReason} for ${sample.id}, got ${quality.rejectReason}`
      );
    }
    results.push({
      id: sample.id,
      ok: quality.ok,
      score: quality.score,
      category: quality.category,
      rejectReason: quality.rejectReason
    });
  }

  assert(
    isBiologicalSymbioteWithoutComicsContext("Pleurotoma symbiotes FMIB mollusk"),
    "biological symbiote should be detected"
  );
  assert(
    !isBiologicalSymbioteWithoutComicsContext("Venom symbiote comic panel Marvel"),
    "comic symbiote should not be biological"
  );
  assert(
    !isBiologicalSymbioteWithoutComicsContext("Symbiote Spider-Man"),
    "symbiote with Spider-Man character should not be biological"
  );

  const semanticStrong = classifyComicsAssetSemanticFit({
    query: "Venom Spider-Man comic panel",
    title: "Venom symbiote comic panel Marvel",
    entities: ENTITIES
  });
  assert(semanticStrong.fit === "strong", `expected strong fit, got ${semanticStrong.fit}`);

  const semanticReject = classifyComicsAssetSemanticFit({
    query: "venom ant",
    title: "Pogonomyrmex venom ant",
    entities: ENTITIES
  });
  assert(semanticReject.fit === "reject", `expected reject fit, got ${semanticReject.fit}`);

  const blockedQueries = ["venom", "spider venom", "venom cosplay", "venom hoodie", "symbiote", "lego venom"];
  for (const query of blockedQueries) {
    assert(isBlockedComicsQuery(query), `query should be blocked: ${query}`);
  }

  const premiumQueries = buildComicsSuperheroDiscoveryQueries(ENTITIES);
  assert(premiumQueries.length >= 6, "expected premium discovery queries");
  assert(
    premiumQueries.every((query) => !isBlockedComicsQuery(query)),
    "premium queries must not include blocked terms"
  );

  assert(SUPPORT_MIN_SCORE === 55, "support threshold should be 55");
  assert(HOOK_CLIMAX_MIN_SCORE === 75, "hook/climax threshold should be 75");
  assert(MIN_TRUE_COMICS_ASSETS === 5, "min true comics assets should be 5");
  assert(MIN_PREMIUM_ACCEPTED_COUNT === 3, "min premium accepted should be 3");

  const focusedQueries = buildFocusedComicsDiscoveryQueries({
    entities: ENTITIES,
    topic: "Venom Homem-Aranha simbionte",
    franchise: "Marvel"
  });
  assert(focusedQueries.length >= 10, "focused queries should include premium set");
  assert(
    focusedQueries.every((query) => !isBlockedComicsQuery(query)),
    "focused queries must avoid blocked generic terms"
  );
  assert(isBlockedComicsQuery("Venom"), "bare venom query should be blocked");

  assert(
    isSubstantiveComicsAssetUrl("https://www.flickr.com/photos/92090133@N04/26800460510").ok,
    "flickr photo page should be substantive"
  );
  assert(
    !isSubstantiveComicsAssetUrl("https://www.flickr.com/search/?text=venom").ok,
    "flickr search should not be substantive"
  );
  assert(
    isSubstantiveComicsAssetUrl("https://archive.org/details/venom-comic-panel").ok,
    "archive details should be substantive"
  );
  assert(
    isSubstantiveComicsAssetUrl(
      "https://comicvine.gamespot.com/a/uploads/scale_small/0/9116/957424-1.jpg"
    ).ok,
    "comicvine cover image should be substantive"
  );
  assert(
    isSubstantiveComicsAssetUrl(
      "https://i3.wp.com/comicvine.gamespot.com/a/uploads/scale_small/0/9116/957424-1.jpg?ssl=1"
    ).ok,
    "wp comicvine CDN cover should be substantive"
  );
  assert(
    isSubstantiveComicsAssetUrl(
      "https://multiversohq.com/wp-content/uploads/2026/05/Homem-Aranha-A-Morte-de-Gwen-Stacy.jpg"
    ).ok,
    "multiversohq upload cover should be substantive"
  );

  console.log(
    JSON.stringify(
      {
        passed: results.length,
        acceptedGood: GOOD_CASES.length,
        rejectedBad: BAD_CASES.length,
        premiumQueryCount: premiumQueries.length,
        results
      },
      null,
      2
    )
  );
  console.log("[test] comics asset quality gate: OK");
}

main().catch((error) => {
  console.log("[test] comics asset quality gate: FAIL");
  console.error(error);
  process.exit(1);
});