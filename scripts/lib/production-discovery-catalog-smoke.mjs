import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { ensureArtifactsExist, printSmokeSummary } from "./smoke-utils.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "../..");

const expectedProviderIds = [
  "openverse",
  "wikimedia-commons",
  "pexels",
  "pixabay",
  "unsplash",
  "flickr-creative-commons",
  "internet-archive",
  "library-of-congress",
  "chronicling-america",
  "national-archives",
  "dpla",
  "nypl-digital-collections",
  "europeana",
  "nasa-image-video",
  "noaa-digital-collections",
  "usgs-multimedia",
  "smithsonian-open-access",
  "met-museum",
  "art-institute-chicago",
  "cleveland-museum-art",
  "rijksmuseum",
  "getty-open-content",
  "harvard-art-museums",
  "victoria-and-albert",
  "science-museum-group",
  "princeton-art-museum",
  "british-museum-discovery",
  "public-domain-image-archive",
  "digital-comic-museum",
  "grand-comics-database",
  "project-gutenberg",
  "gutendex",
  "statsbomb-open-data",
  "thesportsdb",
  "football-data-org",
  "balldontlie",
  "api-sports-free-tier-optional",
  "freesound",
  "pixabay-music-sfx",
  "openverse-audio",
  "wikimedia-audio",
  "internet-archive-audio",
  "wikidata",
  "wikipedia-mediawiki",
  "open-library",
  "gdelt-news-discovery",
  "youtube-discovery",
  "google-assisted-search",
  "reddit-discovery",
  "forum-discovery",
  "manual-url",
  "local-library",
  "manual-intake",
  "media-collector",
  "comfyui-generated-fallback"
];

const expectedSourcePackIds = [
  "football_source_pack",
  "basketball_source_pack",
  "true_crime_source_pack",
  "comics_anime_source_pack",
  "history_documentary_source_pack",
  "curiosities_science_source_pack",
  "generic_broll_source_pack",
  "sfx_audio_source_pack"
];

const groups = {
  "smoke:open-media-providers-catalog": "open_media",
  "smoke:museum-providers-catalog": "museums_open_access",
  "smoke:archive-providers-catalog": "archives",
  "smoke:sports-data-providers-catalog": "sports_data",
  "smoke:comic-public-domain-providers-catalog": "comics_literature",
  "smoke:audio-sfx-providers-catalog": "audio_sfx"
};

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function loadEngine() {
  await ensureArtifactsExist(
    projectRoot,
    ["packages/production-discovery-engine/dist/index.js"],
    "Run 'npm run build' before running production discovery catalog smokes."
  );

  return import(
    pathToFileURL(join(projectRoot, "packages/production-discovery-engine/dist/index.js")).href
  );
}

function validateProviderShape(provider) {
  for (const field of [
    "id",
    "requiresApiKey",
    "freeTierAvailable",
    "supportsImage",
    "supportsVideo",
    "supportsAudio",
    "supportsDocuments",
    "supportsData",
    "supportsLicenseMetadata",
    "discoveryOnly",
    "importSupported",
    "defaultRiskLevel",
    "defaultLicenseStatus",
    "notes",
    "setupInstructions"
  ]) {
    assert(field in provider, `Provider ${provider.id} is missing ${field}.`);
  }
}

export async function runProductionDiscoveryCatalogSmoke(smokeName) {
  const engine = await loadEngine();
  const providers = engine.getDiscoveryMediaProviders();
  const activationMatrix = engine.getProviderActivationMatrix({});
  const sourcePacks = engine.getDiscoverySourcePacks();
  const providerIds = new Set(providers.map((provider) => provider.id));
  const sourcePackIds = new Set(sourcePacks.map((pack) => pack.id));

  for (const provider of providers) {
    validateProviderShape(provider);
  }

  if (smokeName === "smoke:source-packs-expanded") {
    for (const id of expectedSourcePackIds) {
      assert(sourcePackIds.has(id), `Missing source pack ${id}.`);
    }

    for (const pack of sourcePacks) {
      assert(pack.primaryProviderIds.length > 0, `${pack.id} needs primary providers.`);
      for (const id of [...pack.primaryProviderIds, ...pack.fallbackProviderIds]) {
        assert(providerIds.has(id), `${pack.id} references unknown provider ${id}.`);
      }
    }
  } else if (smokeName === "smoke:discovery-only-providers") {
    for (const id of [
      "youtube-discovery",
      "google-assisted-search",
      "reddit-discovery",
      "forum-discovery",
      "gdelt-news-discovery"
    ]) {
      const provider = providers.find((item) => item.id === id);
      const status = activationMatrix.find((item) => item.id === id);
      assert(provider, `Missing discovery-only provider ${id}.`);
      assert(status, `Missing activation status for ${id}.`);
      assert(provider.discoveryOnly, `${id} must be discovery-only.`);
      assert(!provider.importSupported, `${id} must not support import.`);
      assert(
        status.mode === "discovery_only" || status.mode === "assisted_links" || status.mode === "not_configured",
        `${id} should be discovery_only, assisted_links or not_configured.`
      );
      assert(!status.canImport, `${id} must not be importable from discovery.`);
    }
  } else if (smokeName === "smoke:provider-activation-matrix") {
    assert(activationMatrix.length === providers.length, "Every provider needs activation status.");
    for (const status of activationMatrix) {
      assert(status.importRequiresConfirmation, `${status.id} must require import confirmation.`);
      assert(status.mode, `${status.id} needs activation mode.`);
    }
  } else if (smokeName === "smoke:optional-key-providers-status") {
    const optionalProviders = activationMatrix.filter((status) => status.requiresApiKey);
    assert(optionalProviders.length > 0, "Expected optional key providers.");
    assert(
      optionalProviders.every((status) => status.mode === "not_configured"),
      "Without env keys, optional providers should be not_configured."
    );
  } else if (smokeName === "smoke:live-search-priority-providers") {
    const result = engine.searchDiscoveryCandidates({
      query: "football stadium night",
      mediaType: "image",
      providers: [
        "wikimedia-commons",
        "internet-archive",
        "library-of-congress",
        "wikipedia-mediawiki",
        "wikidata",
        "openverse",
        "local-library",
        "manual-intake",
        "media-collector",
        "manual-url",
        "comfyui-generated-fallback"
      ],
      targetCount: 10,
      niche: "football"
    });
    assert(result.assetsCreated === 0, "Search must not create assets.");
    assert(result.candidates.length > 0, "Priority live search should return candidates.");
    assert(
      result.candidates.every((candidate) => candidate.assetId === null && candidate.downloadUrl === null),
      "Candidates must not contain assetId or downloadUrl."
    );
  } else if (groups[smokeName]) {
    const groupProviders = providers.filter((provider) => provider.group === groups[smokeName]);
    assert(groupProviders.length > 0, `No providers for group ${groups[smokeName]}.`);
  } else {
    for (const id of expectedProviderIds) {
      assert(providerIds.has(id), `Missing provider ${id}.`);
    }
  }

  printSmokeSummary({
    smoke: smokeName,
    status: "completed",
    providerCount: providers.length,
    sourcePackCount: sourcePacks.length,
    discoveryOnlyCount: providers.filter((provider) => provider.discoveryOnly).length,
    requiresApiKeyCount: providers.filter((provider) => provider.requiresApiKey).length
  });
}
