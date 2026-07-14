export type PromotionalComicVisualVerdict = {
  reject: boolean;
  reason?: string;
};

const PROMO_TEXT_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /\bqr\s*code\b|\bc[oó]digo\s*qr\b|\bscan\s*(me|aqui)\b/i, reason: "qr_code" },
  { pattern: /\bqr\b/i, reason: "qr_code" },
  { pattern: /\bacesse\b/i, reason: "publisher_cta_acesse" },
  { pattern: /\bacompanhe\b/i, reason: "publisher_cta_acompanhe" },
  { pattern: /\bcompre\b/i, reason: "publisher_cta_compre" },
  { pattern: /\bapoie quem produz\b/i, reason: "publisher_cta_apoie" },
  { pattern: /\bdescubra novas hist[oó]rias\b/i, reason: "publisher_cta_descubra" },
  { pattern: /\bhttps?:\/\/|\bwww\.|\b\.com\b|\b\.br\b|\b\.org\b/i, reason: "publisher_url" },
  { pattern: /\bhouse ad\b|\bpublisher ad\b|\bpropaganda\b/i, reason: "publisher_ad" },
  { pattern: /\bcat[aá]logo\b|\bcatalog\b/i, reason: "catalog_page" },
  { pattern: /\bchecklist\b/i, reason: "checklist_page" },
  { pattern: /\beditorial\b/i, reason: "editorial_page" },
  { pattern: /\bcredits\b|\bcr[eé]ditos\b/i, reason: "credits_page" },
  { pattern: /\bnext issue\b|\bpr[oó]xima edi[cç][aã]o\b|\bna pr[oó]xima\b/i, reason: "next_issue_page" },
  { pattern: /\bletters page\b|\bcartas dos leitores\b/i, reason: "letters_page" },
  { pattern: /\bvisual_catalog_ad\b|\bvisual_text_heavy\b/i, reason: "visual_catalog_ad" },
  { pattern: /\bdia do quadrinho gr[aá]tis\b|\bfcbd\b|\bfree comic book day\b/i, reason: "fcbd_promotional_sampler" }
];

const UNRELATED_FRANCHISE_PATTERN =
  /\b(transformers|gera[cç][aã]o\s*x|mulher[- ]?hulk|wolverine|quarteto fant[aá]stico|fantastic four|x-men|patrulha[- ]?x|deadpool|daredevil|demolidor|capit[aã] marvel|ms\.?\s*marvel)\b/i;

export function isPromotionalComicVisual(input: {
  title?: string;
  detectedText?: string[];
  tags?: string[];
}): PromotionalComicVisualVerdict {
  const blob = [input.title ?? "", ...(input.detectedText ?? []), ...(input.tags ?? [])]
    .join(" ")
    .toLowerCase();

  for (const entry of PROMO_TEXT_PATTERNS) {
    if (entry.pattern.test(blob)) {
      return { reject: true, reason: entry.reason };
    }
  }

  if (UNRELATED_FRANCHISE_PATTERN.test(blob)) {
    return { reject: true, reason: "unrelated_franchise_catalog" };
  }

  return { reject: false };
}

export function buildPromotionalDetectedTextFromAsset(input: {
  description?: string;
  tags?: string[];
  visualTags?: string[];
  selectionSignals?: string[];
}): string[] {
  return [
    input.description ?? "",
    ...(input.tags ?? []),
    ...(input.visualTags ?? []),
    ...(input.selectionSignals ?? [])
  ].filter((value) => value.trim().length > 0);
}

export function isPromotionalUserProvidedAsset(input: {
  title?: string;
  description?: string;
  tags?: string[];
  visualTags?: string[];
  selectionSignals?: string[];
}): PromotionalComicVisualVerdict {
  return isPromotionalComicVisual({
    ...(input.title ? { title: input.title } : {}),
    ...(input.tags ? { tags: input.tags } : {}),
    detectedText: buildPromotionalDetectedTextFromAsset(input)
  });
}

export function auditPromotionalComicAssets(
  assets: Array<{
    title?: string;
    description?: string;
    tags?: string[];
    visualTags?: string[];
    selectionSignals?: string[];
    filename?: string;
  }>
): {
  promotionalAssetCount: number;
  qrAssetCount: number;
  unrelatedTitleCount: number;
  rejected: Array<{ title: string; filename?: string; reason: string }>;
} {
  let promotionalAssetCount = 0;
  let qrAssetCount = 0;
  let unrelatedTitleCount = 0;
  const rejected: Array<{ title: string; filename?: string; reason: string }> = [];

  for (const asset of assets) {
    const verdict = isPromotionalUserProvidedAsset(asset);
    if (!verdict.reject) continue;
    promotionalAssetCount += 1;
    if (verdict.reason === "qr_code") qrAssetCount += 1;
    if (verdict.reason === "unrelated_franchise_catalog") unrelatedTitleCount += 1;
    rejected.push({
      title: asset.title ?? asset.filename ?? "unknown",
      ...(asset.filename ? { filename: asset.filename } : {}),
      reason: verdict.reason ?? "promotional_page"
    });
  }

  return { promotionalAssetCount, qrAssetCount, unrelatedTitleCount, rejected };
}