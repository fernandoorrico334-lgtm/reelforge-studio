import type { ComicsThemeAnalysis } from "./comics-theme-intelligence.js";
import type { RemixRotationAsset } from "./remix-asset-rotation.js";

export const PREMIUM_PLACEHOLDER_COMICS_CATEGORY = "premium_placeholder_comics";
export const MIN_PUBLISH_UNIQUE_ASSETS = 4;

export type PremiumComicsPlaceholderAsset = {
  id: string;
  title: string;
  sceneRole: string;
  themeSignal: string;
  visualNotes: string;
};

const PARTNERSHIP_PLACEHOLDERS: PremiumComicsPlaceholderAsset[] = [
  {
    id: "premium_placeholder_comics_hook_symbiote",
    title: "Premium placeholder — symbiote hook halftone",
    sceneRole: "hook",
    themeSignal: "symbiote_texture",
    visualNotes: "Silhueta simbionte + halftone vermelho/preto, vertical 9:16."
  },
  {
    id: "premium_placeholder_comics_black_suit",
    title: "Premium placeholder — black suit symbiote panel",
    sceneRole: "context",
    themeSignal: "black_suit",
    visualNotes: "Textura traje preto/simbionte sem personagem identificavel."
  },
  {
    id: "premium_placeholder_comics_duo",
    title: "Premium placeholder — Venom/Spidey duo composition",
    sceneRole: "development",
    themeSignal: "duo_pair",
    visualNotes: "Composicao abstrata de dupla/parceria em painel dividido."
  },
  {
    id: "premium_placeholder_comics_host_bond",
    title: "Premium placeholder — host symbiote bond",
    sceneRole: "curiosity",
    themeSignal: "host_symbiote",
    visualNotes: "Ligacao hospedeiro-simbionte em textura de HQ."
  },
  {
    id: "premium_placeholder_comics_climax_symbiosis",
    title: "Premium placeholder — climax symbiosis burst",
    sceneRole: "climax",
    themeSignal: "symbiosis",
    visualNotes: "Climax abstrato simbiose com contraste vermelho/preto."
  },
  {
    id: "premium_placeholder_comics_closing_venom",
    title: "Premium placeholder — closing venom halftone",
    sceneRole: "closing",
    themeSignal: "venom_silhouette",
    visualNotes: "Fechamento com textura HQ e halftone suave."
  }
];

export function isPremiumComicsPlaceholderAsset(input: {
  id?: string | null;
  category?: string | null;
  sourceType?: string | null;
}): boolean {
  return (
    input.category === PREMIUM_PLACEHOLDER_COMICS_CATEGORY ||
    input.sourceType === PREMIUM_PLACEHOLDER_COMICS_CATEGORY ||
    Boolean(input.id?.startsWith("premium_placeholder_comics_"))
  );
}

export function isScenePremiumComicsPlaceholder(input: {
  assetId?: string | null;
  visualSourceType?: string | null;
  selectionReason?: string | null;
}): boolean {
  return (
    isPremiumComicsPlaceholderAsset({
      id: input.assetId ?? null,
      sourceType: input.visualSourceType ?? null
    }) ||
    Boolean(input.selectionReason?.startsWith("premium_placeholder_comics_"))
  );
}

export function countEligibleRotationAssets(
  pool: RemixRotationAsset[],
  isRasterPath: (path: string | null | undefined) => boolean
): number {
  const ids = new Set<string>();
  for (const asset of pool) {
    const id = asset.id ?? asset.title ?? "";
    if (!id) continue;
    const eligible =
      isRasterPath(asset.path) ||
      isPremiumComicsPlaceholderAsset({
        id: asset.id ?? null,
        category: asset.category ?? null
      });
    if (eligible) ids.add(id);
  }
  return ids.size;
}

export function buildThemedPremiumPlaceholderRotationAssets(
  themeAnalysis?: ComicsThemeAnalysis | null
): RemixRotationAsset[] {
  const themes = themeAnalysis?.narrativeThemes ?? ["partnership"];
  const partnershipLike = themes.some((t) =>
    ["partnership", "symbiosis", "team_up"].includes(t)
  );
  const catalog = partnershipLike ? PARTNERSHIP_PLACEHOLDERS : PARTNERSHIP_PLACEHOLDERS.slice(0, 4);

  return catalog.map((entry) => ({
    id: entry.id,
    title: entry.title,
    path: null,
    sourceUrl: null,
    score: 72,
    category: PREMIUM_PLACEHOLDER_COMICS_CATEGORY,
    recommendedScene: entry.sceneRole
  }));
}

export function supplementRotationPoolWithPremiumPlaceholders(
  pool: RemixRotationAsset[],
  themeAnalysis: ComicsThemeAnalysis | null | undefined,
  minUnique = MIN_PUBLISH_UNIQUE_ASSETS,
  isRasterPath: (path: string | null | undefined) => boolean = (path) => Boolean(path)
): { pool: RemixRotationAsset[]; placeholdersAdded: PremiumComicsPlaceholderAsset[] } {
  const workingPool = [...pool];
  const catalog = partnershipLikeCatalog(themeAnalysis);
  const added: PremiumComicsPlaceholderAsset[] = [];

  const needsPlaceholders = countEligibleRotationAssets(workingPool, isRasterPath) < minUnique;

  for (const placeholder of catalog) {
    if (!needsPlaceholders) break;
    if (workingPool.some((asset) => asset.id === placeholder.id)) continue;
    workingPool.push({
      id: placeholder.id,
      title: placeholder.title,
      path: null,
      sourceUrl: null,
      score: 72,
      category: PREMIUM_PLACEHOLDER_COMICS_CATEGORY,
      recommendedScene: placeholder.sceneRole
    });
    added.push(placeholder);
  }

  return { pool: workingPool, placeholdersAdded: added };
}

function partnershipLikeCatalog(
  themeAnalysis?: ComicsThemeAnalysis | null
): PremiumComicsPlaceholderAsset[] {
  const themes = themeAnalysis?.narrativeThemes ?? ["partnership"];
  const partnershipLike = themes.some((t) =>
    ["partnership", "symbiosis", "team_up"].includes(t)
  );
  return partnershipLike ? PARTNERSHIP_PLACEHOLDERS : PARTNERSHIP_PLACEHOLDERS.slice(0, 4);
}

export function listPremiumPlaceholderCatalog(): PremiumComicsPlaceholderAsset[] {
  return [...PARTNERSHIP_PLACEHOLDERS];
}