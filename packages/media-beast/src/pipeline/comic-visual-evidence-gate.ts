export type ComicVisualEvidenceRegion = {
  target: string;
  box?: { x: number; y: number; width: number; height: number };
  focusPoint?: { x: number; y: number };
  confidence?: number;
};

export type ComicPageVisualEvidence = {
  page: string;
  targets: string[];
  regions?: ComicVisualEvidenceRegion[];
};

export type ComicVisualEvidenceReview = {
  requestedTarget: string | null;
  verified: boolean;
  verifiedTargets: string[];
  matchedPages: string[];
  bestRegion: ComicVisualEvidenceRegion | null;
  safeFramingRequired: boolean;
  warnings: string[];
};

const TARGET_ALIASES: Record<string, string[]> = {
  mother_box: ["mother_box", "caixa_materna", "caixa"],
  monster_group: ["monster_group", "monsters", "titas", "titans", "creatures", "criaturas"],
  mutano: ["mutano", "beast_boy"],
  mutano_combat: ["mutano_combat", "mutano", "beast_boy", "gorilla", "gorila", "combat"],
  clark_lois_proposal: ["clark_lois_proposal", "clark", "lois", "proposal", "pedido_casamento"],
  combat: ["combat", "fight", "battle", "impact", "luta", "batalha"],
};

export function normalizeComicVisualTarget(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function targetAliases(target: string) {
  const normalized = normalizeComicVisualTarget(target);
  return new Set((TARGET_ALIASES[normalized] ?? [normalized]).map(normalizeComicVisualTarget));
}

export function reviewComicCueVisualEvidence(input: {
  pages: string[];
  requestedTarget?: string | null;
  evidence: ComicPageVisualEvidence[];
}): ComicVisualEvidenceReview {
  const requestedTarget = input.requestedTarget ? normalizeComicVisualTarget(input.requestedTarget) : null;
  const pageSet = new Set(input.pages);
  const pageEvidence = input.evidence.filter((entry) => pageSet.has(entry.page));
  const verifiedTargets = [...new Set(pageEvidence.flatMap((entry) => entry.targets.map(normalizeComicVisualTarget)))];
  const aliases = requestedTarget ? targetAliases(requestedTarget) : new Set<string>();
  const matchesTarget = (target: string) => aliases.has(normalizeComicVisualTarget(target));
  const matchedPages = requestedTarget
    ? pageEvidence.filter((entry) => entry.targets.some(matchesTarget)).map((entry) => entry.page)
    : pageEvidence.map((entry) => entry.page);
  const matchingRegions = requestedTarget
    ? pageEvidence.flatMap((entry) => (entry.regions ?? []).filter((region) => matchesTarget(region.target)))
    : [];
  const bestRegion = matchingRegions.sort((left, right) => (right.confidence ?? 0) - (left.confidence ?? 0))[0] ?? null;
  const verified = requestedTarget === null || matchedPages.length > 0;

  return {
    requestedTarget,
    verified,
    verifiedTargets,
    matchedPages,
    bestRegion,
    safeFramingRequired: Boolean(requestedTarget) && !verified,
    warnings: requestedTarget && !verified ? [`named_visual_target_unverified:${requestedTarget}`] : [],
  };
}