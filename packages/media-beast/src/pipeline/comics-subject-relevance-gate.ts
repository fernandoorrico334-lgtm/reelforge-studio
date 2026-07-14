import type { ComicsAssetCategory } from "./comics-asset-quality-gate.js";
import {
  expandEntityTerms,
  scoreComicsTitleRelevance,
  scoreEntityMatch
} from "./comics-catalog-discovery-shared.js";
import type { VideoRemixAnalysis } from "./remix-video-analyzer.js";

export type SubjectRelevanceLevel =
  | "direct_subject_match"
  | "supporting_context"
  | "generic_entity_match"
  | "weak_match"
  | "reject";

export type AssetSubjectRelevanceResult = {
  ok: boolean;
  score: number;
  relevance: SubjectRelevanceLevel;
  positiveSignals: string[];
  negativeSignals: string[];
  reason: string;
};

export type NarrativeSubjectContext = {
  videoTitle: string;
  narrativeTheme: string;
  curiosityAngle?: string;
  entities: string[];
  actions: string[];
  subjectTheme: string;
};

export type SubjectScoredAssetCandidate = {
  id: string;
  title: string;
  sourceUrl?: string;
  description?: string;
  tags?: string[];
  category: ComicsAssetCategory;
  assetQualityScore: number;
  entityMatchScore: number;
  subjectRelevanceScore: number;
  finalSelectionScore: number;
  relevance: SubjectRelevanceLevel;
  recommendedBeat: string;
  reason: string;
  positiveSignals: string[];
  negativeSignals: string[];
  subjectOk: boolean;
};

const STRONG_SUBJECT_PATTERNS: Array<{ pattern: RegExp; signal: string; weight: number }> = [
  { pattern: /\bperfect partner\b/i, signal: "perfect_partner", weight: 22 },
  { pattern: /\bparceiro perfeito\b/i, signal: "parceiro_perfeito", weight: 24 },
  { pattern: /\bideal partner\b/i, signal: "ideal_partner", weight: 20 },
  { pattern: /\bpartner(?:ship)?\b/i, signal: "partner", weight: 16 },
  { pattern: /\bparceiro\b/i, signal: "parceiro", weight: 16 },
  { pattern: /\bduo\b|\bdupla\b/i, signal: "duo_pair", weight: 18 },
  { pattern: /\bpair\b|\bdupla ideal\b/i, signal: "pair", weight: 16 },
  { pattern: /\bbond(?:ing)?\b/i, signal: "bond", weight: 16 },
  { pattern: /\bliga[cç][aã]o\b|\bconex[aã]o\b/i, signal: "connection_pt", weight: 16 },
  { pattern: /\bsymbiosis\b|\bsimbiose\b/i, signal: "symbiosis", weight: 20 },
  { pattern: /\bsymbiote bond\b|\bsimbionte\b.*\b(liga|bond|host)\b/i, signal: "symbiote_bond", weight: 22 },
  { pattern: /\bsymbiote suit\b|\btraje preto\b|\bblack suit\b/i, signal: "black_suit_symbiote", weight: 20 },
  {
    pattern: /\bblack suit\b.*\bsymbiote\b|\bsymbiote\b.*\bblack suit\b/i,
    signal: "black_suit_symbiote_combo",
    weight: 26
  },
  { pattern: /\bhost\b|\bhospedeiro\b/i, signal: "host", weight: 14 },
  { pattern: /\beddie brock\b/i, signal: "eddie_brock", weight: 18 },
  { pattern: /\bvenom\b.*\b(spider[- ]?man|homem[- ]?aranha)\b/i, signal: "venom_spiderman_together", weight: 22 },
  { pattern: /\b(spider[- ]?man|homem[- ]?aranha)\b.*\bvenom\b/i, signal: "spiderman_venom_together", weight: 22 },
  { pattern: /\bvenom\b.*\b(symbiote|simbionte)\b/i, signal: "venom_symbiote", weight: 18 },
  { pattern: /\bsimbionte\b/i, signal: "simbionte_pt", weight: 20 },
  {
    pattern: /\bsimbionte\b.*\b(homem[- ]?aranha|spider[- ]?man)\b/i,
    signal: "simbionte_spiderman_pt",
    weight: 28
  },
  {
    pattern: /\b(homem[- ]?aranha|spider[- ]?man)\b.*\bsimbionte\b/i,
    signal: "spiderman_simbionte_pt",
    weight: 28
  },
  { pattern: /\bvolta ao negro\b/i, signal: "volta_ao_negro_pt", weight: 22 },
  { pattern: /\btransformation\b|\btransforma[cç][aã]o\b/i, signal: "transformation", weight: 14 },
  { pattern: /\btwo characters?\b|\bdois personagens\b/i, signal: "two_characters", weight: 12 },
  { pattern: /\binteraction\b|\bintera[cç][aã]o\b/i, signal: "interaction", weight: 12 },
  { pattern: /\bvs\b.*\bvenom\b|\bvenom\b.*\bvs\b/i, signal: "venom_conflict_relation", weight: 10 }
];

const SUPPORTING_SUBJECT_PATTERNS: Array<{ pattern: RegExp; signal: string; weight: number }> = [
  { pattern: /\bvenom\b.*\bcomic\b/i, signal: "venom_comic", weight: 8 },
  { pattern: /\bspider[- ]?man\b.*\bcomic\b/i, signal: "spiderman_comic", weight: 8 },
  { pattern: /\bmarvel\b.*\bvenom\b/i, signal: "marvel_venom", weight: 6 },
  { pattern: /\bcharacter art\b|\bofficial art\b/i, signal: "character_art", weight: 6 },
  { pattern: /\bcomic cover\b|\bissue cover\b/i, signal: "comic_cover", weight: 5 },
  { pattern: /\bvenom\b/i, signal: "venom_entity", weight: 4 },
  { pattern: /\bspider[- ]?man\b|\bhomem[- ]?aranha\b/i, signal: "spiderman_entity", weight: 4 }
];

const NEGATIVE_SUBJECT_PATTERNS: Array<{ pattern: RegExp; signal: string; weight: number }> = [
  { pattern: /\banti[- ]?venom\b/i, signal: "anti_venom_off_theme", weight: 28 },
  { pattern: /\btext page\b|\btexto\b|\bletters?\s+page\b/i, signal: "text_page", weight: 30 },
  { pattern: /\bchecklist\b|\bmarvel checklist\b/i, signal: "checklist_page", weight: 28 },
  { pattern: /\blogo\b|\bwordmark\b/i, signal: "logo_only", weight: 24 },
  { pattern: /\bmiles morales\b/i, signal: "miles_morales_off_partner_theme", weight: 18 },
  { pattern: /\bcarnage\b/i, signal: "carnage_off_partner_theme", weight: 14 },
  {
    pattern: /\bfight panel\b|\brandom\b.*\bfight\b|\bgeneric action\b|\bluta gen[eé]rica\b/i,
    signal: "generic_fight",
    weight: 22
  },
  { pattern: /\bwithout symbiote\b|\bsem simbionte\b/i, signal: "without_symbiote", weight: 18 },
  {
    pattern: /\bwithout\b.*\b(venom|symbiote|partner|context)\b/i,
    signal: "explicit_without_subject_context",
    weight: 26
  }
];

const THEME_KEYWORDS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\bparceiro perfeito\b|\bperfect partner\b/i, label: "parceiro perfeito" },
  { pattern: /\bsimbiose\b|\bsymbiosis\b/i, label: "simbiose" },
  { pattern: /\bdupla\b|\bduo\b|\bpair\b/i, label: "dupla ideal" },
  { pattern: /\bsymbiote bond\b|\bliga[cç][aã]o\b.*\bsimbionte\b/i, label: "ligação simbionte" },
  { pattern: /\bblack suit\b|\btraje preto\b/i, label: "traje preto / black suit" }
];

function probeText(input: {
  assetTitle?: string | undefined;
  assetDescription?: string | undefined;
  assetTags?: string[] | undefined;
  videoTitle?: string | undefined;
  narrativeTheme?: string | undefined;
  curiosityAngle?: string | undefined;
}): string {
  const parts: string[] = [];
  if (input.assetTitle) parts.push(input.assetTitle);
  if (input.assetDescription) parts.push(input.assetDescription);
  if (input.assetTags?.length) parts.push(input.assetTags.join(" "));
  if (input.videoTitle) parts.push(input.videoTitle);
  if (input.narrativeTheme) parts.push(input.narrativeTheme);
  if (input.curiosityAngle) parts.push(input.curiosityAngle);
  return parts.join(" ").toLowerCase();
}

function themeRequiresPartnerBond(context: NarrativeSubjectContext): boolean {
  const haystack = probeText({
    videoTitle: context.videoTitle,
    narrativeTheme: context.narrativeTheme,
    curiosityAngle: context.curiosityAngle
  });
  return (
    /\bparceiro\b|\bpartner\b|\bdupla\b|\bduo\b|\bsimbiose\b|\bsymbiosis\b|\bbond\b|\bliga[cç][aã]o\b/i.test(
      haystack
    )
  );
}

export function deriveSubjectTheme(input: {
  videoTitle?: string;
  narrativeTheme?: string;
  curiosityAngle?: string;
  actions?: string[];
}): string {
  const haystack = probeText({
    ...(input.videoTitle ? { videoTitle: input.videoTitle } : {}),
    ...(input.narrativeTheme ? { narrativeTheme: input.narrativeTheme } : {}),
    ...(input.curiosityAngle ? { curiosityAngle: input.curiosityAngle } : {})
  });
  const labels = THEME_KEYWORDS.filter((entry) => entry.pattern.test(haystack)).map(
    (entry) => entry.label
  );
  if (labels.length > 0) return labels.join(" / ");
  const action = input.actions?.find((entry) => entry.trim().length > 3);
  if (action) return action.toLowerCase();
  return "tema narrativo do vídeo";
}

export function buildNarrativeSubjectContext(
  analysis: VideoRemixAnalysis,
  videoTitle?: string
): NarrativeSubjectContext {
  const intel = analysis.contentIntelligence;
  const title = videoTitle ?? analysis.title ?? intel.headline ?? "";
  const actions = intel.actions?.map((action) => action.label).filter(Boolean) ?? [];
  const entities = intel.entities?.map((entity) => entity.name).filter(Boolean) ?? [];

  return {
    videoTitle: title,
    narrativeTheme:
      intel.narrativeBrief ?? intel.summary ?? analysis.themeSummary ?? intel.headline ?? title,
    ...(intel.curiosityAngle ? { curiosityAngle: intel.curiosityAngle } : {}),
    entities,
    actions,
    subjectTheme: deriveSubjectTheme({
      videoTitle: title,
      narrativeTheme: intel.narrativeBrief ?? analysis.themeSummary,
      ...(intel.curiosityAngle ? { curiosityAngle: intel.curiosityAngle } : {}),
      actions
    })
  };
}

export function computeEntityMatchScore(
  text: string,
  entities: string[]
): { score: number; signals: string[] } {
  const entityTerms = expandEntityTerms(entities);
  const raw = scoreEntityMatch(text, entityTerms);
  const signals: string[] = [];
  if (/\bvenom\b/i.test(text)) signals.push("entity:venom");
  if (/\bspider[- ]?man\b|\bhomem[- ]?aranha\b/i.test(text)) signals.push("entity:spiderman");
  if (/\bsymbiote\b|\bsimbionte\b/i.test(text)) signals.push("entity:symbiote");
  if (/\beddie brock\b/i.test(text)) signals.push("entity:eddie_brock");
  const score = Math.min(100, Math.max(0, Math.round((raw / 30) * 100)));
  return { score, signals };
}

function classifyRelevance(
  score: number,
  strongCount: number,
  entityScore: number,
  hasStrongNegative: boolean
): SubjectRelevanceLevel {
  if (hasStrongNegative && score < 55) return "reject";
  if (score >= 72 && strongCount >= 2) return "direct_subject_match";
  if (score >= 52 && strongCount >= 1) return "direct_subject_match";
  if (score >= 58 && strongCount >= 1) return "direct_subject_match";
  if (score >= 48 && strongCount >= 1) return "supporting_context";
  if (score >= 40) return "supporting_context";
  if (entityScore >= 35 && strongCount === 0) return "generic_entity_match";
  if (score >= 22 || entityScore >= 20) return "weak_match";
  return "reject";
}

export function evaluateAssetSubjectRelevance(input: {
  videoTitle: string;
  narrativeTheme: string;
  curiosityAngle?: string;
  entities: string[];
  actions: string[];
  assetTitle?: string;
  assetDescription?: string;
  assetTags?: string[];
  assetCategory: ComicsAssetCategory;
  targetStyle: string;
}): AssetSubjectRelevanceResult {
  const assetText = probeText({
    ...(input.assetTitle ? { assetTitle: input.assetTitle } : {}),
    ...(input.assetDescription ? { assetDescription: input.assetDescription } : {}),
    ...(input.assetTags ? { assetTags: input.assetTags } : {})
  });
  const text = assetText;

  const positiveSignals: string[] = [];
  const negativeSignals: string[] = [];
  let score = 8;
  let strongCount = 0;
  const isAntiVenom = /\banti[- ]?venom\b/i.test(text);

  for (const entry of STRONG_SUBJECT_PATTERNS) {
    if (isAntiVenom && /\bvenom\b/i.test(entry.pattern.source)) continue;
    if (entry.pattern.test(text)) {
      score += entry.weight;
      strongCount += 1;
      positiveSignals.push(entry.signal);
    }
  }

  for (const entry of SUPPORTING_SUBJECT_PATTERNS) {
    if (entry.pattern.test(text)) {
      score += entry.weight;
      if (!positiveSignals.includes(entry.signal)) positiveSignals.push(entry.signal);
    }
  }

  const partnerTheme = themeRequiresPartnerBond({
    videoTitle: input.videoTitle,
    narrativeTheme: input.narrativeTheme,
    ...(input.curiosityAngle ? { curiosityAngle: input.curiosityAngle } : {}),
    entities: input.entities,
    actions: input.actions,
    subjectTheme: ""
  });

  for (const entry of NEGATIVE_SUBJECT_PATTERNS) {
    if (entry.pattern.test(text)) {
      score -= entry.weight;
      negativeSignals.push(entry.signal);
    }
  }

  if (isAntiVenom) {
    score -= partnerTheme ? 32 : 18;
    strongCount = 0;
    if (!negativeSignals.includes("anti_venom_off_theme")) {
      negativeSignals.push("anti_venom_off_theme");
    }
  }

  const entityMatch = computeEntityMatchScore(text, input.entities);
  let entityCoverSupport = false;
  if (
    strongCount === 0 &&
    /\bcomic cover\b|\bissue cover\b/i.test(text) &&
    (/\bvenom\b/i.test(text) || /\bspider[- ]?man\b|\bhomem[- ]?aranha\b/i.test(text))
  ) {
    score += 18;
    positiveSignals.push("entity_cover_support");
    entityCoverSupport = true;
  } else if (
    strongCount === 0 &&
    /\bcharacter art\b|\bofficial art\b/i.test(text) &&
    /\bvenom\b|\bspider[- ]?man\b|\bhomem[- ]?aranha\b/i.test(text)
  ) {
    score += 16;
    positiveSignals.push("entity_character_art_support");
  } else if (entityMatch.score > 0 && strongCount === 0) {
    score += Math.min(12, Math.round(entityMatch.score * 0.12));
    negativeSignals.push("entity_only_without_subject");
  }

  if (input.assetCategory === "comic_cover" && strongCount === 0 && !entityCoverSupport) {
    score -= 6;
    negativeSignals.push("cover_without_subject_signals");
  }

  if (input.assetCategory === "comic_panel" && strongCount === 0 && /\bvenom\b/i.test(text)) {
    score -= 8;
    negativeSignals.push("generic_venom_panel");
  }

  if (
    /\brandom\b/i.test(text) &&
    /\bfight\b|\baction\b/i.test(text) &&
    strongCount === 0
  ) {
    score -= 16;
    negativeSignals.push("random_fight_without_subject");
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  const hasStrongNegative = negativeSignals.some((signal) =>
    ["text_page", "checklist_page", "logo_only", "anti_venom_off_theme"].includes(signal)
  );

  if (negativeSignals.includes("logo_only") || negativeSignals.includes("text_page")) {
    return {
      ok: false,
      score: Math.min(score, 18),
      relevance: "reject",
      positiveSignals,
      negativeSignals,
      reason: negativeSignals.includes("logo_only") ? "logo_only" : "text_page"
    };
  }

  let relevance = classifyRelevance(score, strongCount, entityMatch.score, hasStrongNegative);
  if (isAntiVenom && partnerTheme) {
    relevance =
      score >= 28 ? "generic_entity_match" : score >= 18 ? "weak_match" : "reject";
  }
  if (
    negativeSignals.some((signal) =>
      ["generic_fight", "random_fight_without_subject"].includes(signal)
    )
  ) {
    relevance = score >= 20 ? "weak_match" : "reject";
  }

  let reason = "no_subject_alignment";
  if (relevance === "direct_subject_match") reason = "direct_subject_alignment";
  else if (relevance === "supporting_context") reason = "supporting_subject_context";
  else if (relevance === "generic_entity_match") reason = "generic_entity_match_only";
  else if (relevance === "weak_match") reason = "weak_subject_match";
  else reason = hasStrongNegative ? "subject_negative_signal" : "insufficient_subject_relevance";

  const ok =
    relevance === "direct_subject_match" ||
    (relevance === "supporting_context" && score >= 40 && !hasStrongNegative);

  return {
    ok,
    score,
    relevance,
    positiveSignals: [...new Set([...positiveSignals, ...entityMatch.signals])],
    negativeSignals,
    reason
  };
}

export function computeFinalSelectionScore(input: {
  entityMatchScore: number;
  assetQualityScore: number;
  subjectRelevanceScore: number;
}): number {
  return Math.round(
    input.entityMatchScore * 0.3 +
      input.assetQualityScore * 0.3 +
      input.subjectRelevanceScore * 0.4
  );
}

export function boostCatalogSeriesSubjectScore(
  title: string,
  entities: string[]
): { boost: number; signals: string[] } {
  const haystack = title.toLowerCase();
  const signals: string[] = [];
  if (/\banti[- ]?venom\b/i.test(haystack)) {
    return { boost: 0, signals: ["catalog_anti_venom_series"] };
  }
  if (/\bsimbionte\b/i.test(haystack)) {
    signals.push("catalog_simbionte_series");
    return { boost: 26, signals };
  }
  if (/\bvolta ao negro\b/i.test(haystack)) {
    signals.push("catalog_black_suit_series");
    return { boost: 24, signals };
  }
  if (/\beddie brock\b/i.test(haystack)) {
    signals.push("catalog_eddie_brock_series");
    return { boost: 22, signals };
  }
  const relevance = scoreComicsTitleRelevance(title, entities);
  if (relevance >= 16) {
    signals.push(`catalog_series_relevance:${relevance}`);
    return { boost: Math.min(18, relevance), signals };
  }
  return { boost: 0, signals };
}

export function scoreAssetForSubjectSelection(input: {
  id: string;
  title: string;
  sourceUrl?: string;
  description?: string;
  tags?: string[];
  category: ComicsAssetCategory;
  assetQualityScore: number;
  context: NarrativeSubjectContext;
  targetStyle?: string;
}): SubjectScoredAssetCandidate {
  const text = probeText({
    assetTitle: input.title,
    ...(input.description ? { assetDescription: input.description } : {}),
    ...(input.tags ? { assetTags: input.tags } : {})
  });
  const entityMatch = computeEntityMatchScore(text, input.context.entities);
  const subjectProbeTitle = [input.title, input.description].filter(Boolean).join(" — ");
  const subject = evaluateAssetSubjectRelevance({
    videoTitle: input.context.videoTitle,
    narrativeTheme: input.context.narrativeTheme,
    ...(input.context.curiosityAngle ? { curiosityAngle: input.context.curiosityAngle } : {}),
    entities: input.context.entities,
    actions: input.context.actions,
    assetTitle: subjectProbeTitle,
    ...(input.tags ? { assetTags: input.tags } : {}),
    assetCategory: input.category,
    targetStyle: input.targetStyle ?? "comics"
  });

  const catalogBoost = boostCatalogSeriesSubjectScore(subjectProbeTitle, input.context.entities);
  const adjustedSubjectScore = Math.min(
    100,
    subject.score + catalogBoost.boost
  );
  const adjustedRelevance =
    catalogBoost.boost >= 22 && adjustedSubjectScore >= 52
      ? "direct_subject_match"
      : catalogBoost.boost >= 14 && adjustedSubjectScore >= 42
        ? "supporting_context"
        : subject.relevance;
  const adjustedSubject = {
    ...subject,
    score: adjustedSubjectScore,
    relevance: adjustedRelevance,
    ok:
      adjustedRelevance === "direct_subject_match" ||
      (adjustedRelevance === "supporting_context" &&
        adjustedSubjectScore >= MIN_SUBJECT_RELEVANCE_SCORE),
    positiveSignals: [...new Set([...subject.positiveSignals, ...catalogBoost.signals])],
    ...(adjustedRelevance !== subject.relevance
      ? { reason: "catalog_series_subject_alignment" }
      : {})
  };

  return {
    id: input.id,
    title: input.title,
    ...(input.sourceUrl ? { sourceUrl: input.sourceUrl } : {}),
    ...(input.description ? { description: input.description } : {}),
    ...(input.tags ? { tags: input.tags } : {}),
    category: input.category,
    assetQualityScore: input.assetQualityScore,
    entityMatchScore: entityMatch.score,
    subjectRelevanceScore: adjustedSubject.score,
    finalSelectionScore: computeFinalSelectionScore({
      entityMatchScore: entityMatch.score,
      assetQualityScore: input.assetQualityScore,
      subjectRelevanceScore: adjustedSubject.score
    }),
    relevance: adjustedSubject.relevance,
    recommendedBeat: recommendBeatForAsset(adjustedSubject, input.category),
    reason: adjustedSubject.reason,
    positiveSignals: adjustedSubject.positiveSignals,
    negativeSignals: adjustedSubject.negativeSignals,
    subjectOk: adjustedSubject.ok
  };
}

function recommendBeatForAsset(
  subject: AssetSubjectRelevanceResult,
  category: ComicsAssetCategory
): string {
  if (subject.relevance === "direct_subject_match") {
    if (
      subject.positiveSignals.some((s) =>
        /bond|symbi|simbionte|partner|duo|black_suit|eddie|catalog_simbionte/.test(s)
      )
    ) {
      return "hook";
    }
    return "curiosity";
  }
  if (subject.relevance === "supporting_context") {
    return category === "comic_cover" ? "context" : "development";
  }
  if (subject.relevance === "generic_entity_match") return "support";
  return "reject";
}

const HOOK_REQUIRED_SIGNALS =
  /perfect_partner|parceiro_perfeito|venom_spiderman_together|spiderman_venom_together|symbiote_bond|black_suit_symbiote|symbiosis|duo_pair|bond|parceiro|partner|eddie_brock/;

const CLIMAX_REQUIRED_SIGNALS =
  /black_suit_symbiote|symbiote_bond|symbiosis|transformation|eddie_brock|venom_symbiote|symbiote|simbionte|host|venom_spiderman_together|spiderman_venom_together|catalog_simbionte|catalog_black_suit|catalog_eddie_brock/;

const CLIMAX_DUO_PAYOFF_SIGNALS =
  /venom_spiderman_together|spiderman_venom_together|catalog_simbionte|catalog_black_suit|catalog_eddie_brock/;

export function isHookSubjectAligned(asset: SubjectScoredAssetCandidate): boolean {
  if (!asset.subjectOk) return false;
  if (asset.relevance === "reject" || asset.relevance === "weak_match") return false;
  if (asset.relevance === "generic_entity_match") return false;
  if (asset.negativeSignals.some((s) => ["text_page", "checklist_page", "anti_venom_off_theme", "generic_fight", "generic_venom_panel"].includes(s))) {
    return false;
  }
  if (asset.relevance === "direct_subject_match" && asset.subjectRelevanceScore >= 55) return true;
  return (
    asset.subjectRelevanceScore >= 62 &&
    asset.positiveSignals.some((signal) => HOOK_REQUIRED_SIGNALS.test(signal))
  );
}

export function isClimaxSubjectAligned(asset: SubjectScoredAssetCandidate): boolean {
  if (!asset.subjectOk) return false;
  if (asset.relevance === "reject" || asset.relevance === "weak_match" || asset.relevance === "generic_entity_match") {
    return false;
  }
  if (asset.negativeSignals.some((s) => ["text_page", "checklist_page", "without_symbiote", "anti_venom_off_theme"].includes(s))) {
    return false;
  }
  if (asset.relevance === "direct_subject_match" && asset.subjectRelevanceScore >= 52) return true;
  if (
    asset.relevance === "supporting_context" &&
    asset.subjectRelevanceScore >= 72 &&
    asset.positiveSignals.some((signal) => CLIMAX_DUO_PAYOFF_SIGNALS.test(signal))
  ) {
    return true;
  }
  return (
    asset.subjectRelevanceScore >= 58 &&
    asset.positiveSignals.some((signal) => CLIMAX_REQUIRED_SIGNALS.test(signal))
  );
}

export function selectAssetForNarrativeBeat(input: {
  beatRole: string;
  beatText: string;
  videoTitle: string;
  narrativeTheme: string;
  acceptedAssets: SubjectScoredAssetCandidate[];
}): { asset: SubjectScoredAssetCandidate | null; reason: string } {
  const role = input.beatRole.toLowerCase();
  const pool = input.acceptedAssets.filter((asset) => asset.subjectOk);

  const rank = (assets: SubjectScoredAssetCandidate[]) =>
    [...assets].sort((left, right) => right.finalSelectionScore - left.finalSelectionScore);

  if (role === "hook") {
    const direct = pool.filter(
      (asset) =>
        asset.relevance === "direct_subject_match" &&
        isHookSubjectAligned(asset) &&
        asset.positiveSignals.some((signal) => HOOK_REQUIRED_SIGNALS.test(signal))
    );
    const pick = rank(direct)[0] ?? rank(pool.filter((asset) => isHookSubjectAligned(asset)))[0];
    return pick
      ? { asset: pick, reason: `hook_subject_aligned:${pick.reason}` }
      : { asset: null, reason: "no_hook_subject_aligned_asset" };
  }

  if (role === "climax") {
    const aligned = pool.filter((asset) => isClimaxSubjectAligned(asset));
    const direct = aligned.filter(
      (asset) =>
        asset.relevance === "direct_subject_match" &&
        asset.positiveSignals.some((signal) => CLIMAX_REQUIRED_SIGNALS.test(signal))
    );
    const duoPayoff = aligned.filter(
      (asset) =>
        asset.relevance === "supporting_context" &&
        asset.subjectRelevanceScore >= 72 &&
        asset.positiveSignals.some((signal) => CLIMAX_DUO_PAYOFF_SIGNALS.test(signal))
    );
    const pick =
      rank(direct)[0] ??
      rank(duoPayoff)[0] ??
      rank(aligned.filter((asset) => asset.positiveSignals.some((signal) => CLIMAX_REQUIRED_SIGNALS.test(signal))))[0] ??
      rank(aligned)[0];
    return pick
      ? { asset: pick, reason: `climax_subject_aligned:${pick.reason}` }
      : { asset: null, reason: "no_climax_subject_aligned_asset" };
  }

  if (role === "context" || role === "curiosity") {
    const supporting = pool.filter(
      (asset) =>
        asset.relevance === "supporting_context" || asset.relevance === "direct_subject_match"
    );
    const pick = rank(supporting)[0] ?? rank(pool)[0];
    return pick
      ? { asset: pick, reason: `${role}_supporting_asset` }
      : { asset: null, reason: `no_${role}_asset` };
  }

  const thematic = pool.filter((asset) => asset.relevance !== "generic_entity_match");
  const pick = rank(thematic)[0] ?? rank(pool)[0];
  return pick
    ? { asset: pick, reason: `${role}_thematic_asset` }
    : { asset: null, reason: `no_${role}_asset` };
}

export const MIN_SUBJECT_ALIGNED_ASSETS = 5;
export const MIN_SUBJECT_RELEVANCE_SCORE = 40;