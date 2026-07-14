import {
  scoreAssetForThemedSelection,
  type ComicsThemeAnalysis
} from "./comics-theme-intelligence.js";
import type { ComicsAssetCategory } from "./comics-asset-quality-gate.js";
import { detectNonComicsHomonymRejection } from "./comics-asset-quality-gate.js";
import { isPremiumComicsPlaceholderAsset } from "./comics-premium-placeholder-assets.js";

export type ComicsThemeAssetSeverity = "allow" | "supporting_only" | "reject";

export type ComicsThemeAssetValidation = {
  ok: boolean;
  reason: string;
  severity: ComicsThemeAssetSeverity;
  matchedSignals: string[];
  blockedSignals: string[];
};

export type ComicsThemeAssetCandidate = {
  id?: string;
  title?: string | null;
  description?: string | null;
  tags?: string[];
  category?: string | null;
  sourceType?: string | null;
  sourceUrl?: string | null;
};

export type ThemeFilteredRasterPanels<T extends ComicsThemeAssetCandidate> = {
  accepted: T[];
  rejected: Array<{ asset: T; reason: string }>;
};

const TEXT_HEAVY_PATTERNS: Array<{ pattern: RegExp; signal: string }> = [
  { pattern: /\bchecklist\b/i, signal: "checklist" },
  { pattern: /\bsoapbox\b/i, signal: "soapbox" },
  { pattern: /\bstan['']?s soapbox\b/i, signal: "stans_soapbox" },
  { pattern: /\bbulletin\b/i, signal: "bulletin" },
  { pattern: /\bletters page\b/i, signal: "letters_page" },
  { pattern: /\beditorial page\b/i, signal: "editorial_page" },
  { pattern: /\btext page\b/i, signal: "text_page" },
  { pattern: /\bad page\b/i, signal: "ad_page" },
  { pattern: /\badvertisement\b/i, signal: "advertisement" },
  { pattern: /\bindex\b/i, signal: "index" },
  { pattern: /\bcredits\b/i, signal: "credits" },
  { pattern: /\btable of contents\b/i, signal: "table_of_contents" },
  { pattern: /\bletters column\b/i, signal: "letters_column" },
  { pattern: /\bmarvel checklist\b/i, signal: "marvel_checklist" }
];

const OFF_THEME_BLOCK_PATTERNS: Array<{
  pattern: RegExp;
  reason: string;
  signal: string;
  narrationEscape?: RegExp;
  titleNarrationEscape?: RegExp;
  allowedThemes?: string[];
}> = [
  {
    pattern: /\bmiles morales\b/i,
    reason: "miles_morales_off_theme",
    signal: "miles_morales",
    narrationEscape: /\bmiles morales\b|\bmiles\b/i,
    titleNarrationEscape: /\bmiles\b/i
  },
  {
    pattern: /\bgwen stacy\b|\bspider-gwen\b|\bgwen\b.*\bspider\b/i,
    reason: "gwen_stacy_off_theme",
    signal: "gwen_stacy",
    narrationEscape: /\bgwen\b/i,
    titleNarrationEscape: /\bgwen\b/i
  },
  {
    pattern: /\b2099\b|\bhomem[- ]?aranha 2099\b|\bspider[- ]?man 2099\b/i,
    reason: "spider_man_2099_off_theme",
    signal: "spider_man_2099",
    narrationEscape: /\b2099\b/i,
    titleNarrationEscape: /\b2099\b/i
  },
  {
    pattern: /\baranhaverso\b|\bspider[- ]?verse\b/i,
    reason: "spider_verse_off_theme",
    signal: "spider_verse",
    narrationEscape: /\baranhaverso\b|\bspider[- ]?verse\b|\bmultiverso\b/i,
    titleNarrationEscape: /\baranhaverso\b|\bspider[- ]?verse\b/i
  },
  {
    pattern: /\bmultiverse variant\b|\bvariant cover\b.*\bvariant\b/i,
    reason: "multiverse_variant_off_theme",
    signal: "multiverse_variant",
    allowedThemes: ["multiverse"]
  },
  {
    pattern: /\banti[- ]?venom\b/i,
    reason: "anti_venom_off_theme",
    signal: "anti_venom",
    narrationEscape: /\banti[- ]?venom\b/i
  },
  {
    pattern: /\bdoutor estranho\b|\bdoctor strange\b|\bstephen strange\b/i,
    reason: "doctor_strange_off_theme",
    signal: "doctor_strange"
  },
  {
    pattern: /\bvingadores\b(?![\s\S]{0,80}\bvenom\b)/i,
    reason: "avengers_without_venom_context",
    signal: "avengers_off_theme"
  }
];

const PARTNERSHIP_REQUIRED_SIGNALS =
  /\b(venom|symbiote|simbionte|black suit|traje preto|eddie brock|parceiro|partner|duo|dupla|bond|host|hospedeiro)\b/i;

export const INSUFFICIENT_THEME_ALIGNED_ASSETS =
  "insufficient_theme_aligned_assets_after_filtering";

export const MIN_THEME_ALIGNED_COMICS_ASSETS = 4;

function probeAssetText(input: {
  title?: string | null;
  description?: string | null;
  tags?: string[];
  videoTitle?: string;
}): string {
  return [
    input.title ?? "",
    input.description ?? "",
    ...(input.tags ?? []),
    input.videoTitle ?? ""
  ]
    .join(" ")
    .toLowerCase();
}

function isMultiverseTheme(themeAnalysis: ComicsThemeAnalysis): boolean {
  return themeAnalysis.narrativeThemes.includes("multiverse");
}

function narrationExplicitlyAllows(
  narrationText: string,
  videoTitle: string,
  escapePattern?: RegExp,
  titleEscape?: RegExp
): boolean {
  const combined = `${videoTitle} ${narrationText}`;
  if (escapePattern?.test(combined)) return true;
  if (titleEscape?.test(videoTitle)) return true;
  return false;
}

export function isTextHeavyComicsAsset(asset: {
  title?: string | null;
  description?: string | null;
  tags?: string[];
}): boolean {
  const text = probeAssetText(asset);
  return TEXT_HEAVY_PATTERNS.some((entry) => entry.pattern.test(text));
}

export function validateComicsAssetForTheme(input: {
  assetTitle?: string | null;
  assetDescription?: string | null;
  assetTags?: string[];
  assetCategory?: string | null;
  sourceType?: string | null;
  themeAnalysis: ComicsThemeAnalysis;
  narrationText?: string;
  videoTitle: string;
}): ComicsThemeAssetValidation {
  if (
    isPremiumComicsPlaceholderAsset({
      id: input.assetTitle ?? null,
      category: input.assetCategory ?? null,
      sourceType: input.sourceType ?? null
    })
  ) {
    return {
      ok: true,
      reason: "premium_placeholder_on_theme",
      severity: "allow",
      matchedSignals: ["premium_placeholder_comics"],
      blockedSignals: []
    };
  }

  const narrationText = input.narrationText ?? "";
  const matchedSignals: string[] = [];
  const blockedSignals: string[] = [];
  const homonymText = probeAssetText({
    title: input.assetTitle ?? null,
    description: input.assetDescription ?? null,
    ...(input.assetTags ? { tags: input.assetTags } : {}),
    videoTitle: input.videoTitle
  });
  const homonymReject = detectNonComicsHomonymRejection(homonymText);
  if (homonymReject) {
    blockedSignals.push(homonymReject.reason);
    return {
      ok: false,
      reason: homonymReject.reason,
      severity: "reject",
      matchedSignals,
      blockedSignals
    };
  }

  const text = probeAssetText({
    title: input.assetTitle ?? null,
    description: input.assetDescription ?? null,
    ...(input.assetTags ? { tags: input.assetTags } : {}),
    videoTitle: input.videoTitle
  });

  if (
    isTextHeavyComicsAsset({
      title: input.assetTitle ?? null,
      description: input.assetDescription ?? null,
      ...(input.assetTags ? { tags: input.assetTags } : {})
    })
  ) {
    blockedSignals.push("text_heavy_comics_page");
    return {
      ok: false,
      reason: "text_heavy_comics_page",
      severity: "reject",
      matchedSignals,
      blockedSignals
    };
  }

  for (const blocked of OFF_THEME_BLOCK_PATTERNS) {
    if (!blocked.pattern.test(text)) continue;
    if (
      blocked.allowedThemes?.some((theme) =>
        input.themeAnalysis.narrativeThemes.includes(theme as never)
      ) &&
      isMultiverseTheme(input.themeAnalysis)
    ) {
      matchedSignals.push(`multiverse_allowed:${blocked.signal}`);
      continue;
    }
    if (
      narrationExplicitlyAllows(
        narrationText,
        input.videoTitle,
        blocked.narrationEscape,
        blocked.titleNarrationEscape
      )
    ) {
      matchedSignals.push(`narration_escape:${blocked.signal}`);
      continue;
    }
    blockedSignals.push(blocked.signal);
    return {
      ok: false,
      reason: blocked.reason,
      severity: "reject",
      matchedSignals,
      blockedSignals
    };
  }

  const themes = input.themeAnalysis.narrativeThemes.filter((t) => t !== "unknown");
  const partnershipLike = themes.some((t) =>
    ["partnership", "symbiosis", "team_up"].includes(t)
  );
  if (partnershipLike) {
    const hasSpidey = /\b(homem[- ]?aranha|spider[- ]?man)\b/i.test(text);
    const hasVenomContext = PARTNERSHIP_REQUIRED_SIGNALS.test(text);
    if (hasSpidey && !hasVenomContext) {
      blockedSignals.push("generic_spiderman_without_venom_context");
      return {
        ok: false,
        reason: "generic_spiderman_without_venom_context",
        severity: "reject",
        matchedSignals,
        blockedSignals
      };
    }
    const marvelOnly =
      /\bmarvel\b/i.test(text) &&
      !hasVenomContext &&
      !/\b(duo|dupla|together|juntos|symbiote|simbionte)\b/i.test(text);
    if (marvelOnly && !hasSpidey) {
      blockedSignals.push("generic_marvel_without_theme_context");
      return {
        ok: false,
        reason: "generic_marvel_without_theme_context",
        severity: "reject",
        matchedSignals,
        blockedSignals
      };
    }
  }

  if (isMultiverseTheme(input.themeAnalysis)) {
    const multiverseAssetPattern =
      /\b(miles morales|gwen stacy|spider-gwen|2099|spider[- ]?verse|aranhaverso|multiverse|multiverso)\b/i;
    if (multiverseAssetPattern.test(text)) {
      matchedSignals.push("multiverse_variant_asset");
      return {
        ok: true,
        reason: "multiverse_variant_allowed",
        severity: "allow",
        matchedSignals,
        blockedSignals
      };
    }
  }

  for (const signal of input.themeAnalysis.disallowedAssetSignals) {
    const pattern = new RegExp(signal.replace(/_/g, "[_ ]?"), "i");
    if (pattern.test(text) || text.includes(signal.replace(/_/g, " "))) {
      blockedSignals.push(signal);
      return {
        ok: false,
        reason: `disallowed_theme_signal:${signal}`,
        severity: "reject",
        matchedSignals,
        blockedSignals
      };
    }
  }

  const themed = scoreAssetForThemedSelection({
    id: input.assetTitle ?? "theme-asset",
    title: input.assetTitle ?? "",
    description: input.assetDescription ?? "",
    category: (input.assetCategory as ComicsAssetCategory) ?? "unknown",
    assetQualityScore: 70,
    themeAnalysis: input.themeAnalysis
  });

  matchedSignals.push(...themed.positiveSignals);

  if (themed.relevance === "reject") {
    blockedSignals.push(themed.reason);
    return {
      ok: false,
      reason: `theme_reject:${themed.reason}`,
      severity: "reject",
      matchedSignals,
      blockedSignals
    };
  }

  if (themed.relevance === "generic_entity_match" || themed.themeMatchScore < 28) {
    return {
      ok: false,
      reason: `weak_theme_match:${themed.reason}`,
      severity: "reject",
      matchedSignals,
      blockedSignals: [...blockedSignals, ...themed.themeNegativeSignals]
    };
  }

  if (
    themed.relevance === "weak_match" ||
    themed.themeMatchScore < 36 ||
    themed.themeNegativeSignals.length > 0
  ) {
    return {
      ok: true,
      reason: "supporting_theme_context",
      severity: "supporting_only",
      matchedSignals,
      blockedSignals: themed.themeNegativeSignals
    };
  }

  return {
    ok: true,
    reason: "theme_aligned",
    severity: "allow",
    matchedSignals,
    blockedSignals
  };
}

export function filterRasterPanelsForComicsTheme<T extends ComicsThemeAssetCandidate>(input: {
  rasterPanels: T[];
  themeAnalysis: ComicsThemeAnalysis;
  narrationText?: string;
  videoTitle: string;
  allowSupportingOnly?: boolean;
}): ThemeFilteredRasterPanels<T> {
  const accepted: T[] = [];
  const rejected: Array<{ asset: T; reason: string }> = [];

  for (const asset of input.rasterPanels) {
    const verdict = validateComicsAssetForTheme({
      assetTitle: asset.title ?? null,
      assetDescription: asset.description ?? null,
      ...(asset.tags ? { assetTags: asset.tags } : {}),
      assetCategory: asset.category ?? null,
      sourceType: asset.sourceType ?? null,
      themeAnalysis: input.themeAnalysis,
      narrationText: input.narrationText ?? "",
      videoTitle: input.videoTitle
    });

    const passes =
      verdict.severity === "allow" ||
      (input.allowSupportingOnly === true && verdict.severity === "supporting_only");

    if (passes) {
      accepted.push(asset);
    } else {
      rejected.push({
        asset,
        reason: verdict.reason
      });
    }
  }

  return { accepted, rejected };
}

export function filterComicsAssetsForTheme<T extends ComicsThemeAssetCandidate>(input: {
  assets: T[];
  themeAnalysis: ComicsThemeAnalysis;
  narrationText?: string;
  videoTitle: string;
  allowSupportingOnly?: boolean;
}): ThemeFilteredRasterPanels<T> {
  return filterRasterPanelsForComicsTheme({
    rasterPanels: input.assets,
    themeAnalysis: input.themeAnalysis,
    narrationText: input.narrationText ?? "",
    videoTitle: input.videoTitle,
    ...(input.allowSupportingOnly !== undefined
      ? { allowSupportingOnly: input.allowSupportingOnly }
      : {})
  });
}

export function isThemeRejectedComicsAsset(input: {
  assetTitle?: string | null;
  assetDescription?: string | null;
  assetTags?: string[];
  themeAnalysis: ComicsThemeAnalysis;
  narrationText?: string;
  videoTitle: string;
}): boolean {
  return (
    validateComicsAssetForTheme({
      assetTitle: input.assetTitle ?? null,
      assetDescription: input.assetDescription ?? null,
      ...(input.assetTags ? { assetTags: input.assetTags } : {}),
      themeAnalysis: input.themeAnalysis,
      narrationText: input.narrationText ?? "",
      videoTitle: input.videoTitle
    }).severity === "reject"
  );
}