export type ComicsAssetCategory =
  | "comic_panel"
  | "comic_cover"
  | "character_art"
  | "movie_still"
  | "cosplay"
  | "merchandise"
  | "toy"
  | "product"
  | "specimen"
  | "logo"
  | "biological_venom"
  | "irrelevant"
  | "unknown";

export type ComicsAssetQualityResult = {
  ok: boolean;
  score: number;
  category: ComicsAssetCategory;
  rejectReason?: string;
  positiveSignals: string[];
  negativeSignals: string[];
};

export type ComicsSemanticFitResult = {
  fit: "strong" | "medium" | "weak" | "reject";
  reason: string;
};

export const INSUFFICIENT_HIGH_QUALITY_COMICS_ASSETS = "insufficient_high_quality_comics_assets";
export const INSUFFICIENT_TRUE_COMICS_ASSETS = "insufficient_true_comics_assets";
export const SEARCH_SURFACE_NOT_SUBSTANTIVE_ASSET = "search_surface_not_substantive_asset";

export const HOOK_CLIMAX_MIN_SCORE = 75;
export const SUPPORT_MIN_SCORE = 55;
export const MIN_GOOD_COMICS_ASSETS = 3;
export const MIN_TRUE_COMICS_ASSETS = 5;

export const TRUE_COMICS_TIMELINE_CATEGORIES: ComicsAssetCategory[] = [
  "comic_panel",
  "comic_cover",
  "character_art"
];

const HARD_REJECT_PATTERNS: Array<{ patterns: RegExp[]; category: ComicsAssetCategory; reason: string }> =
  [
    {
      patterns: [
        /\bcandle\b/i,
        /\bcandles\b/i,
        /\bwax\b/i,
        /\bvela\b/i,
        /\bvelas\b/i
      ],
      category: "product",
      reason: "candle_or_wax_product"
    },
    {
      patterns: [
        /\bbeetle\b/i,
        /\bbug\b/i,
        /\binsect\b/i,
        /\bant\b/i,
        /\barachnid\b/i,
        /\bspider venom\b/i,
        /\bvenom ant\b/i,
        /\bvenom gland\b/i
      ],
      category: "biological_venom",
      reason: "insect_or_biological_venom"
    },
    {
      patterns: [
        /\bbiological venom\b/i,
        /\bvenom toxin\b/i,
        /\bvenom poison\b/i,
        /\bveneno biol[oó]gico\b/i,
        /\btoxin\b/i,
        /\bpoison\b/i,
        /\bveneno\b/i,
        /\bpogonomyrmex\b/i,
        /\bformiga\b/i
      ],
      category: "biological_venom",
      reason: "biological_venom_homonym"
    },
    {
      patterns: [
        /\bmollusk\b/i,
        /\bmollusc\b/i,
        /\bshell\b/i,
        /\bconch\b/i,
        /\bpleurotoma\b/i,
        /\bgastropod\b/i,
        /\bzoophyte\b/i,
        /\bcommensal\b/i,
        /\bspecimen\b/i,
        /\btaxonomy\b/i,
        /\bspecies\b/i,
        /\bmuseum\b/i,
        /\bbiodiversity\b/i,
        /\bnaturalis\b/i,
        /\bfmib\b/i,
        /\bzooplankton\b/i,
        /\bkombucha\b/i,
        /\bphotophore\b/i
      ],
      category: "specimen",
      reason: "mollusk_or_biological_specimen"
    },
    {
      patterns: [
        /\blego\b/i,
        /\bminifigure\b/i,
        /\bmini figure\b/i,
        /\bbrick\b/i,
        /\bbricks\b/i,
        /\bmoc\b/i,
        /\btoy\b/i,
        /\bbrinquedo\b/i,
        /\baction figure\b/i,
        /\bfigurine\b/i,
        /\bhasbro\b/i,
        /\bmattel\b/i,
        /\blego set\b/i,
        /\bbuilding instructions\b/i,
        /\b\d{4,5}\s+spider[- ]?man\b/i,
        /\b\d{4,5}\s+venom\b/i,
        /\b\d{4,5}\s+marvel\b/i,
        /\bspider[- ]?man vs\.?\s+the venom symbiote\b/i
      ],
      category: "toy",
      reason: "lego_or_toy_asset"
    },
    {
      patterns: [
        /\bcosplay\b/i,
        /\bcosplayer\b/i,
        /\bcostume\b/i,
        /\bconvention\b/i,
        /\bcomic[- ]?con\b/i,
        /\bnycc\b/i,
        /\banime expo\b/i,
        /\bperson wearing\b/i,
        /\bfan dressed\b/i,
        /\bamateur\b/i,
        /\bcarnaval\b/i,
        /\bcarnival\b/i,
        /\bfoli[oõ]es\b/i,
        /\bfancy dress\b/i,
        /\bhalloween costume\b/i,
        /\bcomic-con photo\b/i
      ],
      category: "cosplay",
      reason: "cosplay_or_amateur_costume"
    },
    {
      patterns: [
        /\bhoodie\b/i,
        /\bmoletom\b/i,
        /\bsweatshirt\b/i,
        /\bt[- ]?shirt\b/i,
        /\bmerch\b/i,
        /\bmerchandise\b/i,
        /\bproduto\b/i,
        /\bproduct\b/i,
        /\bstore\b/i,
        /\bsale\b/i,
        /\bposter shop\b/i,
        /\bprint on demand\b/i
      ],
      category: "merchandise",
      reason: "merchandise_product"
    },
    {
      patterns: [
        /\blogo\.png\b/i,
        /\blogo only\b/i,
        /\bvenom 2018 logo\b/i,
        /\bbrand logo\b/i,
        /\bicon only\b/i,
        /\bmedia-logo\b/i
      ],
      category: "logo",
      reason: "logo_only"
    }
  ];

const AVIATION_HOMONYM_PATTERNS: RegExp[] = [
  /\bde havilland\b/i,
  /\baircraft\b/i,
  /\bairplane\b/i,
  /\baeroplane\b/i,
  /\baviation\b/i,
  /\bfighter aircraft\b/i,
  /\bmilitary aircraft\b/i,
  /\braf\b/i,
  /\broyal air force\b/i,
  /\bcockpit\b/i,
  /\bairframe\b/i,
  /\bsquadron\b/i,
  /\bmuseum aircraft\b/i,
  /\bavi[aã]o\b/i,
  /\baeronave\b/i,
  /\bavia[cç][aã]o\b/i,
  /\bca[cç]a militar\b/i,
  /\b3-view line drawing\b/i,
  /\bline drawing\.png\b/i
];

const COMICS_SUPERHERO_POSITIVE_PATTERNS: RegExp[] = [
  /\bcomics?\b/i,
  /\bcomic panel\b/i,
  /\bcomic cover\b/i,
  /\bissue\b/i,
  /\bmarvel comics?\b/i,
  /\bspider[- ]?man\b/i,
  /\bhomem[- ]?aranha\b/i,
  /\beddie brock\b/i,
  /\bsymbiote\b/i,
  /\bsimbionte\b/i,
  /\bblack suit\b/i,
  /\btraje preto\b/i,
  /\bcharacter art\b/i
];

const BIOLOGICAL_INVALID_PATTERNS: RegExp[] = [
  /\bbiology\b/i,
  /\bbiological\b/i,
  /\bmollusk\b/i,
  /\bmollusc\b/i,
  /\bspecies\b/i,
  /\bspecimen\b/i,
  /\btaxonomy\b/i,
  /\bmuseum\b/i,
  /\binsect\b/i,
  /\bbeetle\b/i,
  /\bshell\b/i,
  /\bvenom gland\b/i,
  /\btoxin\b/i,
  /\bpoison\b/i,
  /\bcommensal\b/i,
  /\bzoophyte\b/i,
  /\bnaturalis\b/i,
  /\bfmib\b/i,
  /\bpleurotoma\b/i,
  /\bkombucha\b/i,
  /\bphotophore\b/i
];

const SYMBIOTE_COMIC_POSITIVE_PATTERNS: RegExp[] = [
  /\bvenom\b/i,
  /\beddie brock\b/i,
  /\bspider[- ]?man\b/i,
  /\bhomem[- ]?aranha\b/i,
  /\bmarvel comics?\b/i,
  /\bcomic\b/i,
  /\bhq\b/i,
  /\bquadrinhos\b/i,
  /\bpanel\b/i,
  /\bcover\b/i,
  /\bissue\b/i,
  /\bblack suit\b/i,
  /\bsymbiote suit\b/i,
  /\bcharacter art\b/i,
  /\bcomic art\b/i,
  /\billustration\b/i,
  /\bmarvel\b/i
];

const COMIC_PANEL_PATTERNS: RegExp[] = [
  /\bcomic panel\b/i,
  /\bcomic book page\b/i,
  /\bcomic page\b/i,
  /\bcomic strip\b/i,
  /\bhalftone\b/i,
  /\bcomic scan\b/i,
  /\bgolden age\b/i,
  /\bcomic book panel\b/i,
  /\bvs\.?\b.*\bcomic\b/i
];

const COMIC_COVER_PATTERNS: RegExp[] = [
  /\bcomic cover\b/i,
  /\bcover art\b/i,
  /\bissue cover\b/i,
  /\bcomic book cover\b/i,
  /\bmarvel comic cover\b/i
];

const CHARACTER_ART_PATTERNS: RegExp[] = [
  /\bcharacter art\b/i,
  /\bofficial art\b/i,
  /\bkey art\b/i,
  /\bcomic art\b/i,
  /\beddie brock\b/i,
  /\bblack suit\b/i,
  /\bsymbiote suit\b/i,
  /\bvenom vs\b/i,
  /\bspider[- ]?man vs\b/i
];

const GENERIC_CHARACTER_PATTERNS: RegExp[] = [
  /\bspider[- ]?man\b/i,
  /\bhomem[- ]?aranha\b/i,
  /\bvenom\b/i,
  /\bsymbiote\b/i,
  /\bsimbiose\b/i
];

const COMICS_CHARACTER_SIGNAL_PATTERNS: RegExp[] = [
  /\bspider[- ]?man\b/i,
  /\bhomem[- ]?aranha\b/i,
  /\bvenomized\b/i,
  /\bvenom symbiote\b/i,
  /\beddie brock\b/i,
  /\bblack suit\b/i,
  /\bsymbiote suit\b/i,
  /\bmarvel\b/i,
  /\bvenom vs\b/i,
  /\bspider[- ]?man vs\b/i,
  /\bdrawing\b/i,
  /\billustration\b/i
];

const LOW_QUALITY_PATTERNS: RegExp[] = [
  /\bwatermark\b/i,
  /\bclickbait\b/i,
  /\bthumbnail\b/i,
  /\blow resolution\b/i,
  /\bblurry\b/i,
  /\bpixelated\b/i,
  /\bmeme\b/i
];

const FOCUSED_STRONG_POSITIVE_PATTERNS: RegExp[] = [
  /\bissue cover\b/i,
  /\bcover art\b/i,
  /\bcomic scan\b/i,
  /\bscan\b/i,
  /\bcomic page\b/i,
  /\bpage\b/i,
  /\bsymbiote suit\b/i,
  /\bcharacter art\b/i,
  /\bmarvel comics?\b/i
];

const FOCUSED_DISCOVERY_NEGATIVE_PATTERNS: RegExp[] = [
  /\bgallery surface\b/i,
  /\bsearch results?\b/i,
  /\bsearch lead\b/i,
  /\bpast lead\b/i,
  /\bpresent lead\b/i,
  /\bconvention gallery\b/i
];

const MOVIE_STILL_PATTERNS: RegExp[] = [
  /\bfilm still\b/i,
  /\bmovie still\b/i,
  /\bscreenshot\b/i,
  /\bromance\b/i,
  /\badult\b/i,
  /\bhollywood movie\b/i,
  /\bmovie poster\b/i,
  /\bproduct poster\b/i
];

const BLOCKED_QUERY_TERMS = [
  "venom cosplay",
  "venom costume",
  "venom hoodie",
  "venom shirt",
  "venom ant",
  "spider venom",
  "venom alone",
  "venom merch",
  "venom candle",
  "symbiote biology",
  "symbiote mollusk",
  "lego venom",
  "lego spider",
  "venom logo",
  "venom movie poster",
  "venom movie",
  "spider-man costume",
  "symbiote specimen"
];

export const COMICS_SUPERHERO_PREMIUM_QUERIES = [
  "Venom Spider-Man comic panel",
  "Venom symbiote comic cover",
  "Spider-Man black suit comic panel",
  "Venom Eddie Brock comic art",
  "Venom vs Spider-Man comic",
  "Marvel Venom symbiote comic cover",
  "Homem-Aranha Venom comic panel HQ",
  "Venom symbiote bond comic panel Marvel"
];

function probeText(input: {
  title?: string;
  description?: string;
  tags?: string[];
  sourceUrl?: string;
  query?: string;
}): string {
  return [
    input.title,
    input.description,
    input.tags?.join(" "),
    input.sourceUrl,
    input.query
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function assetProbeText(input: {
  title?: string;
  description?: string;
  tags?: string[];
  sourceUrl?: string;
}): string {
  return [input.title, input.description, input.tags?.join(" "), input.sourceUrl]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function isPhotoHostingSource(sourceUrl?: string | null): boolean {
  return /\b(flickr\.com|commons\.wikimedia|wikipedia\.org|staticflickr)\b/i.test(sourceUrl ?? "");
}

function isMovieArchiveSource(sourceUrl?: string | null): boolean {
  return /\b(hollywood[- ]?movie|movie[- ]still|film[- ]still|let-there-be-carnage)\b/i.test(
    sourceUrl ?? ""
  );
}

function isSearchSurfaceSource(sourceUrl?: string | null): boolean {
  const url = (sourceUrl ?? "").toLowerCase();
  if (!url) return false;
  return (
    /flickr\.com\/search\//i.test(url) ||
    /archive\.org\/search/i.test(url) ||
    /google\.com\/search/i.test(url) ||
    /\/wiki\/special:search/i.test(url) ||
    (/[?&]query=/i.test(url) && /archive\.org/i.test(url))
  );
}

function isDiscoveryLeadTitle(title?: string | null): boolean {
  return /\b(flickr\s+(past|present)\s+lead|internet archive past|past lead:|present lead:|search lead:)\b/i.test(
    title ?? ""
  );
}

export function isSearchSurfaceAsset(input: {
  title?: string | null;
  sourceUrl?: string | null;
}): boolean {
  return isSearchSurfaceSource(input.sourceUrl) || isDiscoveryLeadTitle(input.title);
}

export type SubstantiveComicsAssetUrlResult = {
  ok: boolean;
  reason: string;
};

export function isSubstantiveComicsAssetUrl(url: string): SubstantiveComicsAssetUrlResult {
  const normalized = (url ?? "").trim().toLowerCase();
  if (!normalized) {
    return { ok: false, reason: "empty_url" };
  }
  if (isSearchSurfaceSource(normalized)) {
    return { ok: false, reason: "search_surface_url" };
  }
  if (/pinterest\.com/i.test(normalized)) {
    return { ok: false, reason: "pinterest_surface" };
  }
  if (/google\.com\/search|bing\.com\/images|duckduckgo\.com/i.test(normalized)) {
    return { ok: false, reason: "search_engine_page" };
  }
  if (/\/tags?\//i.test(normalized) || /\/galleries?\//i.test(normalized)) {
    return { ok: false, reason: "tag_or_gallery_surface" };
  }
  if (/\b(shop|store|merch|product|hoodie|shirt)\b/i.test(normalized)) {
    return { ok: false, reason: "product_or_merch_page" };
  }
  if (/flickr\.com\/photos\//i.test(normalized)) {
    return { ok: true, reason: "flickr_photo_page" };
  }
  if (/archive\.org\/details\//i.test(normalized)) {
    return { ok: true, reason: "archive_details_page" };
  }
  if (/archive\.org\/download\//i.test(normalized)) {
    return { ok: true, reason: "archive_download_url" };
  }
  if (/commons\.wikimedia\.org\/wiki\/file:/i.test(normalized)) {
    return { ok: true, reason: "wikimedia_file_page" };
  }
  if (/upload\.wikimedia\.org\//i.test(normalized)) {
    return { ok: true, reason: "wikimedia_direct_image" };
  }
  if (/staticflickr\.com\/|live\.staticflickr\.com\//i.test(normalized)) {
    return { ok: true, reason: "flickr_direct_image" };
  }
  if (/comicvine\.gamespot\.com\/a\/uploads\//i.test(normalized)) {
    return { ok: true, reason: "comicvine_cover_image" };
  }
  if (/i\d\.wp\.com\/comicvine\.gamespot\.com\/a\/uploads\//i.test(normalized)) {
    return { ok: true, reason: "wp_comicvine_cover_cdn" };
  }
  if (/site\.soquadrinhos\.com\/wp-content\/uploads\/.+\.(jpe?g|png|webp|gif|avif)/i.test(normalized)) {
    return { ok: true, reason: "soquadrinhos_upload_image" };
  }
  if (/multiversohq\.com\/wp-content\/uploads\/.+\.(jpe?g|png|webp|gif|avif)/i.test(normalized)) {
    return { ok: true, reason: "multiversohq_upload_image" };
  }
  if (
    /storage\/assets\/comics-catalog-panels\/.+\.(jpe?g|png|webp|gif|avif)/i.test(normalized) ||
    /comics-catalog-panels\/.+\.(jpe?g|png|webp|gif|avif)/i.test(normalized)
  ) {
    return { ok: true, reason: "comics_catalog_local_panel" };
  }
  if (/supabase\.co\/storage\/v1\/object\/public\/comic-covers\//i.test(normalized)) {
    return { ok: true, reason: "blogspot_supabase_comic_cover" };
  }
  if (/blogger\.googleusercontent\.com\/.+\/(?:s\d+\/)?[^/]+\.(?:jpe?g|png|webp|gif)/i.test(normalized)) {
    return { ok: true, reason: "blogspot_googleusercontent_cover" };
  }
  if (/postimg\.cc\//i.test(normalized) || /i\.wp\.com\/i\.postimg\.cc\//i.test(normalized)) {
    return { ok: true, reason: "blogspot_postimg_cover" };
  }
  if (/sp-ao\.shortpixel\.ai\/.+site\.soquadrinhos\.com\/wp-content\/uploads\/.+\.(jpe?g|png|webp|gif|avif)/i.test(normalized)) {
    return { ok: true, reason: "soquadrinhos_shortpixel_image" };
  }
  if (/\.(jpe?g|png|webp|gif|avif)(\?|$)/i.test(normalized)) {
    return { ok: true, reason: "direct_image_url" };
  }
  return { ok: false, reason: "non_substantive_url" };
}

export function hasSubstantiveComicsAssetUrl(sourceUrl?: string | null): boolean {
  return isSubstantiveComicsAssetUrl(sourceUrl ?? "").ok;
}

export function isPrimaryCatalogAssetUrl(sourceUrl?: string | null): boolean {
  const normalized = (sourceUrl ?? "").trim().toLowerCase();
  if (!normalized) return false;
  return (
    /site\.soquadrinhos\.com\/wp-content\/uploads/i.test(normalized) ||
    /multiversohq\.com\/wp-content\/uploads/i.test(normalized) ||
    /comics-catalog-panels\//i.test(normalized) ||
    /storage\/assets\/comics-catalog-panels/i.test(normalized) ||
    /blogger\.googleusercontent\.com/i.test(normalized) ||
    /supabase\.co\/storage\/v1\/object\/public\/comic-covers/i.test(normalized) ||
    /i\d\.wp\.com\/comicvine\.gamespot\.com/i.test(normalized) ||
    /comicvine\.gamespot\.com\/a\/uploads/i.test(normalized) ||
    /postimg\.cc/i.test(normalized)
  );
}

function matchesAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

function hasComicsVisualLanguage(text: string): boolean {
  return (
    matchesAny(text, COMIC_PANEL_PATTERNS) ||
    matchesAny(text, COMIC_COVER_PATTERNS) ||
    /\bcomic\b|\bhq\b|\bquadrinhos\b|\bpanel\b|\bcover\b|\bissue\b|\bhalftone\b|\bmarvel comics?\b|\bdrawing\b|\billustration\b|\bartwork\b/i.test(
      text
    )
  );
}

function hasSymbioteTerm(text: string): boolean {
  return /\bsymbiotes?\b|\bsymbiosis\b|\bsimbiose\b/i.test(text);
}

export function isBiologicalSymbioteWithoutComicsContext(text: string): boolean {
  if (!hasSymbioteTerm(text)) return false;
  if (matchesAny(text, BIOLOGICAL_INVALID_PATTERNS)) return true;
  if (hasComicsVisualLanguage(text)) return false;
  if (matchesAny(text, CHARACTER_ART_PATTERNS)) return false;
  if (matchesAny(text, COMICS_CHARACTER_SIGNAL_PATTERNS)) return false;
  return true;
}

export function hasComicsSuperheroPositiveSignal(text: string): boolean {
  return matchesAny(text, COMICS_SUPERHERO_POSITIVE_PATTERNS);
}

export function detectNonComicsHomonymRejection(text: string): {
  category: ComicsAssetCategory;
  reason: string;
} | null {
  if (matchesAny(text, AVIATION_HOMONYM_PATTERNS)) {
    return { category: "irrelevant", reason: "non_comics_homonym" };
  }
  if (/\bvenom\b/i.test(text) && !hasComicsSuperheroPositiveSignal(text)) {
    return { category: "irrelevant", reason: "non_comics_homonym" };
  }
  return null;
}

function detectHardReject(text: string): { category: ComicsAssetCategory; reason: string } | null {
  for (const entry of HARD_REJECT_PATTERNS) {
    if (matchesAny(text, entry.patterns)) {
      return { category: entry.category, reason: entry.reason };
    }
  }
  const homonym = detectNonComicsHomonymRejection(text);
  if (homonym) return homonym;
  if (isBiologicalSymbioteWithoutComicsContext(text)) {
    return { category: "specimen", reason: "biological_symbiote_without_comics_context" };
  }
  return null;
}

function detectCategory(text: string): ComicsAssetCategory {
  const hardReject = detectHardReject(text);
  if (hardReject) return hardReject.category;

  if (matchesAny(text, COMIC_PANEL_PATTERNS)) return "comic_panel";
  if (matchesAny(text, COMIC_COVER_PATTERNS)) return "comic_cover";
  if (matchesAny(text, CHARACTER_ART_PATTERNS) && hasComicsVisualLanguage(text)) {
    return "character_art";
  }
  if (matchesAny(text, MOVIE_STILL_PATTERNS)) return "movie_still";
  if (hasComicsVisualLanguage(text) && matchesAny(text, GENERIC_CHARACTER_PATTERNS)) {
    return "character_art";
  }
  if (hasComicsVisualLanguage(text)) return "comic_panel";
  if (matchesAny(text, GENERIC_CHARACTER_PATTERNS)) return "unknown";
  return "unknown";
}

function hasEntityMatch(text: string, entities: string[]): boolean {
  return entities.some((entity) => {
    const lower = entity.toLowerCase();
    if (lower.length <= 3) return false;
    return text.includes(lower) || text.includes(lower.replace(/\s+/g, "-"));
  });
}

export function isTrueComicsAssetCategory(
  category: ComicsAssetCategory,
  quality?: ComicsAssetQualityResult
): boolean {
  if (!TRUE_COMICS_TIMELINE_CATEGORIES.includes(category)) return false;
  if (!quality) return true;
  if (quality.negativeSignals.some((signal) => signal.includes("biological"))) return false;
  if (quality.rejectReason) return false;
  return quality.ok;
}

export function classifyComicsAssetSemanticFit(input: {
  query?: string;
  title?: string;
  description?: string;
  tags?: string[];
  sourceUrl?: string;
  entities: string[];
}): ComicsSemanticFitResult {
  const text = assetProbeText(input);
  const hardReject = detectHardReject(text);
  if (hardReject) {
    return { fit: "reject", reason: hardReject.reason };
  }

  const comicSignals =
    (matchesAny(text, COMIC_PANEL_PATTERNS) ? 1 : 0) +
    (matchesAny(text, COMIC_COVER_PATTERNS) ? 1 : 0) +
    (hasComicsVisualLanguage(text) ? 1 : 0);
  const entitySignals = hasEntityMatch(text, input.entities) ? 1 : 0;
  const characterSignals =
    matchesAny(text, CHARACTER_ART_PATTERNS) && hasComicsVisualLanguage(text) ? 1 : 0;

  if (comicSignals >= 2 && entitySignals >= 1) {
    return { fit: "strong", reason: "comic_entity_match" };
  }
  if (comicSignals >= 1 && (entitySignals >= 1 || characterSignals >= 1)) {
    return { fit: "medium", reason: "comic_or_character_signal" };
  }
  if (entitySignals >= 1 && hasComicsVisualLanguage(text)) {
    return { fit: "medium", reason: "entity_with_comics_visual_language" };
  }
  if (entitySignals >= 1 && matchesAny(text, GENERIC_CHARACTER_PATTERNS)) {
    return { fit: "weak", reason: "entity_only_ambiguous" };
  }
  return { fit: "reject", reason: "no_comics_semantic_fit" };
}

export function evaluateComicsAssetQuality(input: {
  title?: string;
  description?: string;
  tags?: string[];
  sourceUrl?: string;
  query?: string;
  width?: number | null;
  height?: number | null;
  mimeType?: string | null;
  entities: string[];
  franchise?: string | null;
  targetStyle?: string;
  userApproved?: boolean;
  requireSubstantiveUrl?: boolean;
  catalogPriority?: boolean;
  catalogRelevanceScore?: number;
  seriesTitle?: string;
  comicsVisualLanguage?: string;
}): ComicsAssetQualityResult {
  const probeDescription = [input.description, input.seriesTitle, input.comicsVisualLanguage]
    .filter(Boolean)
    .join(" | ");
  const probeInput = {
    ...(input.title ? { title: input.title } : {}),
    ...(probeDescription ? { description: probeDescription } : {}),
    ...(input.tags ? { tags: input.tags } : {}),
    ...(input.sourceUrl ? { sourceUrl: input.sourceUrl } : {})
  };
  const text = assetProbeText(probeInput);
  const positiveSignals: string[] = [];
  const negativeSignals: string[] = [];
  let score = 30;
  const isCatalogAsset =
    input.catalogPriority === true || isPrimaryCatalogAssetUrl(input.sourceUrl);
  const catalogRelevance = Math.max(0, input.catalogRelevanceScore ?? 0);
  let semantic = classifyComicsAssetSemanticFit({
    query: "",
    entities: input.entities,
    ...(input.title ? { title: input.title } : {}),
    ...(probeInput.description ? { description: probeInput.description } : {}),
    ...(input.tags ? { tags: input.tags } : {}),
    ...(input.sourceUrl ? { sourceUrl: input.sourceUrl } : {})
  });
  const category = detectCategory(text);
  const hardReject = detectHardReject(text);

  if (input.userApproved) {
    return {
      ok: true,
      score: 95,
      category: category === "unknown" ? "character_art" : category,
      positiveSignals: ["user_approved"],
      negativeSignals: []
    };
  }

  if (hardReject) {
    return {
      ok: false,
      score: Math.max(0, Math.min(24, score)),
      category: hardReject.category,
      rejectReason: hardReject.reason,
      positiveSignals,
      negativeSignals: [hardReject.reason]
    };
  }

  if (isMovieArchiveSource(input.sourceUrl)) {
    return {
      ok: false,
      score: Math.max(0, Math.min(32, score)),
      category: "movie_still",
      rejectReason: "movie_archive_not_true_comics_asset",
      positiveSignals,
      negativeSignals: ["movie_still_support_only"]
    };
  }

  if (
    isSearchSurfaceAsset({
      title: input.title ?? null,
      sourceUrl: input.sourceUrl ?? null
    })
  ) {
    return {
      ok: false,
      score: 0,
      category: "irrelevant",
      rejectReason: SEARCH_SURFACE_NOT_SUBSTANTIVE_ASSET,
      positiveSignals,
      negativeSignals: [SEARCH_SURFACE_NOT_SUBSTANTIVE_ASSET]
    };
  }

  if (input.sourceUrl) {
    const substantive = isSubstantiveComicsAssetUrl(input.sourceUrl);
    if (input.requireSubstantiveUrl && !substantive.ok) {
      return {
        ok: false,
        score: 0,
        category: "irrelevant",
        rejectReason: substantive.reason,
        positiveSignals,
        negativeSignals: [substantive.reason]
      };
    }
    if (substantive.ok) {
      score += 12;
      positiveSignals.push("substantive_asset_url");
    }
  }

  if (
    isCatalogAsset &&
    hasComicsVisualLanguage(text) &&
    semantic.fit === "reject" &&
    catalogRelevance >= 12
  ) {
    semantic = { fit: "medium", reason: "primary_catalog_franchise_context" };
  } else if (
    isCatalogAsset &&
    category === "comic_cover" &&
    semantic.fit === "weak" &&
    catalogRelevance >= 10
  ) {
    semantic = { fit: "medium", reason: "catalog_cover_contextual_use" };
  }

  if (semantic.fit === "reject") {
    negativeSignals.push(semantic.reason);
  } else if (semantic.fit === "strong") {
    score += 30;
    positiveSignals.push(semantic.reason);
  } else if (semantic.fit === "medium") {
    score += 18;
    positiveSignals.push(semantic.reason);
  } else {
    score += 2;
    negativeSignals.push(semantic.reason);
  }

  if (isCatalogAsset && hasComicsVisualLanguage(text)) {
    score += 10;
    positiveSignals.push("primary_catalog_asset");
    if (catalogRelevance >= 12) {
      score += Math.min(18, catalogRelevance);
      positiveSignals.push("catalog_entity_relevance");
    }
  }
  if (isCatalogAsset && category === "comic_panel") {
    score += 14;
    positiveSignals.push("catalog_interior_panel_preferred");
  } else if (isCatalogAsset && category === "comic_cover") {
    score += 6;
    positiveSignals.push("catalog_cover_contextual");
  }

  if (matchesAny(text, COMIC_PANEL_PATTERNS)) {
    score += 20;
    positiveSignals.push("comic_panel");
  }
  if (matchesAny(text, COMIC_COVER_PATTERNS)) {
    score += 18;
    positiveSignals.push("comic_cover");
  }
  if (matchesAny(text, CHARACTER_ART_PATTERNS) && hasComicsVisualLanguage(text)) {
    score += 14;
    positiveSignals.push("character_art");
  }
  if (hasComicsVisualLanguage(text)) {
    score += 10;
    positiveSignals.push("comics_visual_language");
  }
  if (hasEntityMatch(text, input.entities) && hasComicsVisualLanguage(text)) {
    score += 10;
    positiveSignals.push("entity_match");
  }
  if (input.franchise && text.includes(input.franchise.toLowerCase()) && hasComicsVisualLanguage(text)) {
    score += 6;
    positiveSignals.push("franchise_match");
  }
  for (const pattern of FOCUSED_STRONG_POSITIVE_PATTERNS) {
    if (pattern.test(text)) {
      score += 8;
      positiveSignals.push(`focused_signal:${pattern.source}`);
      break;
    }
  }
  if (matchesAny(text, FOCUSED_DISCOVERY_NEGATIVE_PATTERNS)) {
    score -= 30;
    negativeSignals.push("focused_discovery_negative_signal");
  }

  if (category === "unknown") {
    score -= 28;
    negativeSignals.push("unknown_without_comics_visual_language");
  }
  if (category === "movie_still") {
    score -= 18;
    negativeSignals.push("movie_still_support_only");
  }
  if (matchesAny(text, LOW_QUALITY_PATTERNS)) {
    score -= 20;
    negativeSignals.push("low_quality_or_watermark");
  }
  if (/\bperson\b|\bpeople\b|\bselfie\b|\bportrait photo\b/i.test(text) && !hasComicsVisualLanguage(text)) {
    score -= 24;
    negativeSignals.push("real_person_not_comic_art");
  }
  if (hasSymbioteTerm(text) && !hasComicsVisualLanguage(text)) {
    score -= 35;
    negativeSignals.push("symbiote_without_comics_context");
  }
  if (isPhotoHostingSource(input.sourceUrl) && !hasComicsVisualLanguage(text)) {
    score -= 40;
    negativeSignals.push("photo_source_without_comics_title_signals");
  }
  if (
    /\bvenomized\b/i.test(text) &&
    !hasComicsVisualLanguage(text) &&
    !matchesAny(text, CHARACTER_ART_PATTERNS)
  ) {
    score -= 30;
    negativeSignals.push("venomized_likely_cosplay_or_fan_photo");
  }

  if (typeof input.width === "number" && typeof input.height === "number") {
    const minSide = Math.min(input.width, input.height);
    const maxSide = Math.max(input.width, input.height);
    if (minSide >= 720) {
      score += 8;
      positiveSignals.push("resolution_ok");
    } else if (minSide < 480) {
      score -= 18;
      negativeSignals.push("low_resolution");
    }
    if (maxSide / Math.max(minSide, 1) > 2.2) {
      score -= 10;
      negativeSignals.push("hard_to_crop_horizontal");
    } else if (input.height >= input.width) {
      score += 6;
      positiveSignals.push("vertical_or_square_crop_friendly");
    }
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  const autoRejectCategories: ComicsAssetCategory[] = [
    "cosplay",
    "merchandise",
    "toy",
    "product",
    "specimen",
    "biological_venom",
    "logo",
    "irrelevant",
    "unknown"
  ];

  if (isPhotoHostingSource(input.sourceUrl) && !hasComicsVisualLanguage(text)) {
    return {
      ok: false,
      score,
      category: category === "unknown" ? category : "unknown",
      rejectReason: "photo_source_without_comics_title_signals",
      positiveSignals,
      negativeSignals
    };
  }

  const catalogCoverContextual =
    isCatalogAsset &&
    category === "comic_cover" &&
    hasComicsVisualLanguage(text) &&
    catalogRelevance >= 10 &&
    semantic.fit !== "reject";

  if (
    (autoRejectCategories.includes(category) || semantic.fit === "reject") &&
    !catalogCoverContextual
  ) {
    return {
      ok: false,
      score,
      category,
      rejectReason:
        category === "unknown"
          ? "unknown_not_true_comics_asset"
          : semantic.fit === "reject"
            ? semantic.reason
            : `${category}_not_allowed_for_comics_superhero`,
      positiveSignals,
      negativeSignals
    };
  }

  if (input.targetStyle === "comics" && !isTrueComicsAssetCategory(category)) {
    return {
      ok: false,
      score,
      category,
      rejectReason: "category_not_allowed_for_comics_timeline",
      positiveSignals,
      negativeSignals
    };
  }

  if (score < SUPPORT_MIN_SCORE) {
    return {
      ok: false,
      score,
      category,
      rejectReason: "score_below_support_threshold",
      positiveSignals,
      negativeSignals
    };
  }

  return {
    ok: true,
    score,
    category,
    positiveSignals,
    negativeSignals
  };
}

export function isPremiumHookClimaxAsset(
  quality: ComicsAssetQualityResult,
  origin?: "provided" | "approved" | "generated" | "imported"
): boolean {
  if (origin === "provided") return true;
  if (!quality.ok || quality.score < HOOK_CLIMAX_MIN_SCORE) return false;
  return isTrueComicsAssetCategory(quality.category, quality);
}

export function isBlockedComicsQuery(query: string): boolean {
  const lower = query.toLowerCase().trim();
  if (
    lower === "venom" ||
    lower === "spider" ||
    lower === "spider venom" ||
    lower === "venom ant" ||
    lower === "symbiote" ||
    lower === "homem-aranha" ||
    lower === "venom eddie brock" ||
    lower === "venom symbiote bond"
  ) {
    return true;
  }
  return BLOCKED_QUERY_TERMS.some((term) => lower.includes(term));
}

export const MIN_PREMIUM_ACCEPTED_COUNT = 3;

export function buildComicsSuperheroDiscoveryQueries(entities: string[]): string[] {
  const names = entities.map((entity) => entity.trim()).filter(Boolean);
  const lead = names[0] ?? "Venom";
  const partner = names[1] ?? "Spider-Man";
  const queries = [...COMICS_SUPERHERO_PREMIUM_QUERIES];

  if (/venom/i.test(lead) || /venom/i.test(partner)) {
    queries.push(
      `${lead} ${partner} comic panel`,
      `${lead} symbiote comic cover`,
      `${partner} black suit comic panel`,
      `${lead} Eddie Brock comic art`,
      `Marvel ${lead} symbiote comic cover`
    );
  }

  return [...new Set(queries.map((query) => query.trim()))].filter(
    (query) => query.length >= 12 && !isBlockedComicsQuery(query)
  );
}

export const FORBIDDEN_VISUAL_AUDIT_TERMS: RegExp[] = [
  /\bcandle\b/i,
  /\bbeetle\b/i,
  /\binsect\b/i,
  /\bmollusk\b/i,
  /\bpleurotoma\b/i,
  /\bcosplay\b/i,
  /\blego\b/i,
  /\btoy\b/i,
  /\bbricks\b/i,
  /\bmoc\b/i,
  /\bminifigure\b/i,
  /\b\d{4,5}\s+spider[- ]?man\b/i,
  /\bspider[- ]?man vs\.?\s+the venom symbiote\b/i,
  /\bspecimen\b/i,
  /\bkombucha\b/i,
  /\bphotophore\b/i,
  /\bnaturalis\b/i
];

export function detectForbiddenVisualAuditReason(text: string): string | null {
  if (isDiscoveryLeadTitle(text) || isSearchSurfaceSource(text)) {
    return SEARCH_SURFACE_NOT_SUBSTANTIVE_ASSET;
  }
  for (const pattern of FORBIDDEN_VISUAL_AUDIT_TERMS) {
    if (pattern.test(text)) {
      return `forbidden_visual_term:${pattern.source}`;
    }
  }
  if (isBiologicalSymbioteWithoutComicsContext(text)) {
    return "biological_symbiote_without_comics_context";
  }
  return null;
}