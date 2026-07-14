export type UserProvidedPanelKind =
  | "story_panel"
  | "cover"
  | "catalog_ad"
  | "off_theme_series"
  | "low_quality_thumbnail";

export type UserProvidedPanelGateResult = {
  eligible: boolean;
  panelKind: UserProvidedPanelKind;
  rejectReason: string | null;
  beatRoles: string[];
};

export type UserProvidedPanelGateInput = {
  title: string;
  description?: string;
  tags?: string[];
  width: number;
  height: number;
  bytes: number;
  selectionSignals?: string[];
  beatRole?: string;
  duoVisualScore?: number;
  visualTags?: string[];
  visualRejectReason?: string | null;
};

const COVER_TITLE_PATTERN = /\bcapa\b|\bcover\b|soquadrinhos\b/i;
const INTERIOR_PAGE_PATTERN = /\bp[aá]gina\b/i;
const FCBD_PATTERN = /fcbd|dia do quadrinho gr[aá]tis|free comic book/i;
const CATALOG_AD_SERIES_PATTERN =
  /\bespantoso homem-aranha\b|\bvingadores\b(?![\s\S]*\bvenom\b)/i;
const CROSSOVER_HEAVY_SERIES_PATTERN =
  /\bespiral mortal\b|\bvingadores\b|\bdoutor estranho\b|\bdoctor strange\b/i;
const LATE_CROSSOVER_PAGE_CUTOFF = 22;
const HIGH_STAKES_BEAT_ROLES = new Set([
  "hook",
  "curiosity_a",
  "curiosity_b",
  "climax",
  "closing"
]);

function hasDuoTogetherSignal(input: UserProvidedPanelGateInput): boolean {
  const blob = [
    input.title,
    input.description ?? "",
    ...(input.tags ?? []),
    ...(input.selectionSignals ?? [])
  ]
    .join(" ")
    .toLowerCase();

  return (
    /spiderman_venom_together|both_entities|entity_pair|venom_spiderman|duo/i.test(blob) ||
    (/\bvenom\b/i.test(blob) && /\b(homem[- ]?aranha|spider[- ]?man)\b/i.test(blob))
  );
}

export function extractPageIndex(title: string): number | null {
  const match = title.match(/\bp[aá]gina\s+(\d{1,3})\b/i);
  if (!match?.[1]) return null;
  const value = Number.parseInt(match[1], 10);
  return Number.isFinite(value) ? value : null;
}

export function isCrossoverHeavySeriesTitle(title: string): boolean {
  if (CROSSOVER_HEAVY_SERIES_PATTERN.test(title)) return true;
  const slashCount = (title.match(/\//g) ?? []).length;
  return slashCount >= 2 && /\bvenom\b/i.test(title);
}

export function isLateCrossoverPanel(input: Pick<UserProvidedPanelGateInput, "title">): boolean {
  const pageIndex = extractPageIndex(input.title);
  if (pageIndex === null || pageIndex < LATE_CROSSOVER_PAGE_CUTOFF) return false;
  return isCrossoverHeavySeriesTitle(input.title);
}

export function hasStrongDuoVisualSignal(input: UserProvidedPanelGateInput): boolean {
  const blob = [
    input.title,
    input.description ?? "",
    ...(input.tags ?? []),
    ...(input.selectionSignals ?? [])
  ]
    .join(" ")
    .toLowerCase();

  if (/both_entities_present|venom_spiderman_together|simbionte_pt/i.test(blob)) return true;
  if (/\bsimbionte\b/i.test(blob) && /\bp[aá]gina\b/i.test(blob) && !/espiral mortal/i.test(blob)) {
    return true;
  }
  return false;
}

export function classifyUserProvidedPanel(
  input: UserProvidedPanelGateInput
): UserProvidedPanelGateResult {
  const title = input.title;
  const pageIndex = extractPageIndex(title);
  const isInterior = INTERIOR_PAGE_PATTERN.test(title);
  const isCoverTitle = COVER_TITLE_PATTERN.test(title) && !isInterior;
  const thumbnailLike = input.width < 900 && input.bytes < 250_000 && !isInterior;

  if (isCoverTitle || thumbnailLike) {
    return {
      eligible: false,
      panelKind: isCoverTitle ? "cover" : "low_quality_thumbnail",
      rejectReason: isCoverTitle ? "cover_not_story_panel" : "low_quality_thumbnail",
      beatRoles: ["hook", "closing"]
    };
  }

  if (FCBD_PATTERN.test(title) && pageIndex !== null && pageIndex >= 9) {
    return {
      eligible: false,
      panelKind: "catalog_ad",
      rejectReason: "fcbd_backmatter_catalog_page",
      beatRoles: []
    };
  }

  if (CATALOG_AD_SERIES_PATTERN.test(title) && !/\bvenom\b|\bsimbionte\b/i.test(title)) {
    return {
      eligible: false,
      panelKind: "off_theme_series",
      rejectReason: "spider_only_off_reference_theme",
      beatRoles: []
    };
  }

  if (pageIndex !== null && pageIndex <= 1 && FCBD_PATTERN.test(title)) {
    return {
      eligible: false,
      panelKind: "catalog_ad",
      rejectReason: "fcbd_front_catalog_page",
      beatRoles: []
    };
  }

  if (!isInterior && input.width < 1200 && input.bytes < 180_000) {
    return {
      eligible: false,
      panelKind: "low_quality_thumbnail",
      rejectReason: "promo_thumbnail_not_panel",
      beatRoles: []
    };
  }

  const beatRoles = ["hook", "context", "curiosity_a", "curiosity_b", "development_a", "development_b", "climax", "closing"];
  if (!hasDuoTogetherSignal(input)) {
    return {
      eligible: true,
      panelKind: "story_panel",
      rejectReason: null,
      beatRoles: beatRoles.filter((role) => role === "context" || role.startsWith("development"))
    };
  }

  if (
    input.visualRejectReason === "mystical_off_theme_hero" ||
    input.visualRejectReason === "catalog_ad_visual" ||
    input.visualRejectReason === "text_heavy_visual_page" ||
    input.visualRejectReason === "crowd_crossover_without_duo"
  ) {
    return {
      eligible: false,
      panelKind: "off_theme_series",
      rejectReason: input.visualRejectReason,
      beatRoles: []
    };
  }

  if (isLateCrossoverPanel(input)) {
    return {
      eligible: true,
      panelKind: "story_panel",
      rejectReason: null,
      beatRoles: beatRoles.filter(
        (role) => role === "context" || role.startsWith("development") || role === "curiosity_b"
      )
    };
  }

  const lowDuoVisualScore =
    input.duoVisualScore !== undefined &&
    input.duoVisualScore < 42 &&
    !hasStrongDuoVisualSignal(input);
  if (lowDuoVisualScore) {
    return {
      eligible: true,
      panelKind: "story_panel",
      rejectReason: null,
      beatRoles: beatRoles.filter(
        (role) => !HIGH_STAKES_BEAT_ROLES.has(role) || role === "context"
      )
    };
  }

  if (
    !hasStrongDuoVisualSignal(input) &&
    (isCrossoverHeavySeriesTitle(title) || /vingadores/i.test(title))
  ) {
    return {
      eligible: true,
      panelKind: "story_panel",
      rejectReason: null,
      beatRoles: beatRoles.filter(
        (role) => !HIGH_STAKES_BEAT_ROLES.has(role) || role === "context"
      )
    };
  }

  return {
    eligible: true,
    panelKind: "story_panel",
    rejectReason: null,
    beatRoles
  };
}

export function isUserProvidedPanelEligibleForBeat(
  input: UserProvidedPanelGateInput,
  beatRole: string
): boolean {
  const verdict = classifyUserProvidedPanel(input);
  if (!verdict.eligible) {
    return verdict.beatRoles.includes(beatRole);
  }
  if (verdict.beatRoles.length === 0) return false;
  return verdict.beatRoles.includes(beatRole) || verdict.beatRoles.includes(beatRole.replace(/_\d+$/, ""));
}

export function buildReferenceAlignedUserProvidedNarration(): {
  suggestedScript: string;
  beats: Array<{ role: string; text: string; caption: string }>;
} {
  const beats = [
    {
      role: "hook",
      text: "Venom encontrou o parceiro perfeito — e isso não é só do filme.",
      caption: "VENOM NO FOCO"
    },
    {
      role: "context",
      text: "Nos quadrinhos, essa dupla Venom e Homem-Aranha vira obsessão dos fãs.",
      caption: "DUPLA PERFEITA NAS HQs"
    },
    {
      role: "tension",
      text: "O que torna essa parceria perfeita vem das HQs — e raramente aparece explicado no recorte de 60 segundos.",
      caption: "O PAR PERFEITO ESTÁ NA HQ"
    },
    {
      role: "climax",
      text: "A simbiose certa, a química visual, os dois juntos — é isso que a galera chama de dupla ideal.",
      caption: "A DUPLA QUE OS FÃS QUEREM"
    },
    {
      role: "cta",
      text: "Qual dupla Venom e Homem-Aranha você prefere? Comenta.",
      caption: "QUAL DUPLA VOCÊ PREFERE?"
    }
  ];

  return {
    suggestedScript: beats.map((beat) => beat.text).join("\n"),
    beats
  };
}