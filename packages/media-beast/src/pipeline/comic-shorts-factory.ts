import { extname } from "node:path";
import type {
  ComicShortOpportunity,
  ComicShortOpportunityCategory,
  ComicStoryMinerReport
} from "./comic-story-miner.js";

export type ComicIngestionSourceType = "pdf" | "cbz" | "cbr" | "image_directory" | "unknown";

export type ComicIngestionPlan = {
  sourcePath: string;
  sourceType: ComicIngestionSourceType;
  supported: boolean;
  recommendedAssetDirectory: string;
  steps: Array<{
    stepId: string;
    title: string;
    status: "ready" | "requires_tooling" | "manual_review";
    description: string;
  }>;
  warnings: string[];
  candidateFirst: true;
};

export type ComicShortScenePlan = {
  order: number;
  role: "hook" | "context" | "development" | "climax" | "payoff";
  panelId: string;
  panelImagePath: string | null;
  pageNumber: number | null;
  durationSeconds: number;
  narration: string;
  caption: string;
  motion: "punch_zoom" | "slow_push" | "panel_pan" | "impact_cut" | "pull_back";
  transition: "cut" | "flash" | "whoosh";
};

export type ComicShortProductionPlan = {
  id: string;
  title: string;
  sourceOpportunityId: string;
  category: ComicShortOpportunityCategory;
  score: number;
  estimatedDurationSeconds: number;
  scenes: ComicShortScenePlan[];
  narrationScript: string;
  captionStyleId: string;
  cinematicPresetId: string;
  audioMasteringPresetId: string;
  musicPresetId: string;
  renderFormat: "vertical_9_16";
  approvalChecklist: string[];
  qualityReport: {
    panelCoverage: number;
    hasHook: boolean;
    hasClimax: boolean;
    narrationLineCount: number;
    warnings: string[];
  };
  warnings: string[];
};

export type ComicShortsBatchFactoryPlan = {
  generatedAt: string;
  source: ComicStoryMinerReport["source"];
  requestedCount: number;
  selectedCount: number;
  shorts: ComicShortProductionPlan[];
  rejectedOpportunities: Array<{
    opportunityId: string;
    reason: string;
  }>;
  nextRecommendedImprovements: string[];
  candidateFirst: true;
  requiresManualApproval: true;
};

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80) || "comic-short";
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function splitNarration(text: string, count: number): string[] {
  const parts = text
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length >= count) return parts.slice(0, count);
  const fallback = text.trim() || "A HQ entrega um momento forte para transformar em short.";
  return Array.from({ length: count }, (_, index) => parts[index] ?? fallback);
}

function styleForCategory(category: ComicShortOpportunityCategory): {
  captionStyleId: string;
  cinematicPresetId: string;
  audioMasteringPresetId: string;
  musicPresetId: string;
} {
  if (category === "fight" || category === "transformation") {
    return {
      captionStyleId: "sports_hype",
      cinematicPresetId: "action",
      audioMasteringPresetId: "viral_fast_cut",
      musicPresetId: "viral_fast_cut"
    };
  }
  if (category === "reveal" || category === "cliffhanger") {
    return {
      captionStyleId: "horror_whisper",
      cinematicPresetId: "mystery",
      audioMasteringPresetId: "true_crime_dark",
      musicPresetId: "true_crime_dark"
    };
  }
  return {
    captionStyleId: "comic_pop",
    cinematicPresetId: "drama",
    audioMasteringPresetId: "shorts_clean_voice",
    musicPresetId: "documentary_clean"
  };
}

function motionForRole(role: ComicShortScenePlan["role"]): ComicShortScenePlan["motion"] {
  if (role === "hook") return "punch_zoom";
  if (role === "climax") return "impact_cut";
  if (role === "payoff") return "pull_back";
  return role === "context" ? "slow_push" : "panel_pan";
}

function transitionForRole(role: ComicShortScenePlan["role"]): ComicShortScenePlan["transition"] {
  if (role === "hook" || role === "climax") return "flash";
  if (role === "development") return "whoosh";
  return "cut";
}

function makeCaption(line: string): string {
  return line.replace(/\s+/g, " ").trim().slice(0, 88);
}

export function buildComicShortProductionPlan(input: {
  opportunity: ComicShortOpportunity;
  index: number;
}): ComicShortProductionPlan {
  const opportunity = input.opportunity;
  const style = styleForCategory(opportunity.category);
  const fallbackRoles = ["hook", "context", "development", "climax", "payoff"] as const;
  const visualSequence =
    opportunity.visualSequence.length > 0
      ? opportunity.visualSequence
      : opportunity.panelIds.slice(0, 5).map((panelId, index) => ({
          role: fallbackRoles[Math.min(index, fallbackRoles.length - 1)]!,
          panelId,
          reason: "fallback_panel_sequence"
        }));
  const narrationLines = splitNarration(opportunity.narrationDraft, visualSequence.length);
  const secondsPerScene = clamp(
    Math.round(opportunity.estimatedDurationSeconds / Math.max(1, visualSequence.length)),
    3,
    8
  );

  const scenes = visualSequence.map((visual, sceneIndex) => {
    const panel = opportunity.panels.find((entry) => entry.panelId === visual.panelId);
    const narration = narrationLines[sceneIndex] ?? opportunity.narrationDraft;
    return {
      order: sceneIndex + 1,
      role: visual.role,
      panelId: visual.panelId,
      panelImagePath: panel?.panelImagePath ?? null,
      pageNumber: panel?.pageNumber ?? null,
      durationSeconds: secondsPerScene,
      narration,
      caption: makeCaption(narration),
      motion: motionForRole(visual.role),
      transition: transitionForRole(visual.role)
    } satisfies ComicShortScenePlan;
  });

  const warnings = [...opportunity.warnings];
  if (!scenes.some((scene) => scene.role === "hook")) warnings.push("missing_hook_scene");
  if (!scenes.some((scene) => scene.role === "climax")) warnings.push("missing_climax_scene");
  if (scenes.some((scene) => !scene.panelImagePath)) warnings.push("missing_panel_image_path");

  return {
    id: `comic-short-${input.index + 1}-${slug(opportunity.title)}`,
    title: opportunity.title,
    sourceOpportunityId: opportunity.id,
    category: opportunity.category,
    score: opportunity.score,
    estimatedDurationSeconds: scenes.reduce((sum, scene) => sum + scene.durationSeconds, 0),
    scenes,
    narrationScript: scenes.map((scene) => scene.narration).join(" "),
    ...style,
    renderFormat: "vertical_9_16",
    approvalChecklist: [
      "Confirmar que a HQ/material e autorizado para uso.",
      "Revisar se os paineis contam a historia sem contexto inventado.",
      "Revisar narracao antes de renderizar.",
      "Confirmar legendas, musica e direitos dos assets locais."
    ],
    qualityReport: {
      panelCoverage: scenes.filter((scene) => Boolean(scene.panelImagePath)).length / Math.max(1, scenes.length),
      hasHook: scenes.some((scene) => scene.role === "hook"),
      hasClimax: scenes.some((scene) => scene.role === "climax"),
      narrationLineCount: scenes.length,
      warnings
    },
    warnings
  };
}

export function buildComicShortsBatchFactoryPlan(input: {
  minerReport: ComicStoryMinerReport;
  targetCount?: number;
  minScore?: number;
  maxPanelReuse?: number;
}): ComicShortsBatchFactoryPlan {
  const targetCount = clamp(input.targetCount ?? 20, 1, 50);
  const minScore = input.minScore ?? 65;
  const maxPanelReuse = input.maxPanelReuse ?? 1;
  const usedPanelCounts = new Map<string, number>();
  const categoryCounts = new Map<ComicShortOpportunityCategory, number>();
  const rejectedOpportunities: ComicShortsBatchFactoryPlan["rejectedOpportunities"] = [];
  const selected: ComicShortOpportunity[] = [];

  const ranked = [...input.minerReport.opportunities].sort((left, right) => {
    const categoryBias = (categoryCounts.get(left.category) ?? 0) - (categoryCounts.get(right.category) ?? 0);
    if (categoryBias !== 0) return categoryBias;
    return right.score - left.score;
  });

  for (const opportunity of ranked) {
    if (selected.length >= targetCount) break;
    if (opportunity.score < minScore) {
      rejectedOpportunities.push({
        opportunityId: opportunity.id,
        reason: `score_below_min:${opportunity.score}<${minScore}`
      });
      continue;
    }
    const overused = opportunity.panelIds.some((panelId) => (usedPanelCounts.get(panelId) ?? 0) >= maxPanelReuse);
    if (overused) {
      rejectedOpportunities.push({ opportunityId: opportunity.id, reason: "panel_reuse_limit" });
      continue;
    }
    selected.push(opportunity);
    categoryCounts.set(opportunity.category, (categoryCounts.get(opportunity.category) ?? 0) + 1);
    for (const panelId of opportunity.panelIds) {
      usedPanelCounts.set(panelId, (usedPanelCounts.get(panelId) ?? 0) + 1);
    }
  }

  const shorts = selected.map((opportunity, index) => buildComicShortProductionPlan({ opportunity, index }));

  return {
    generatedAt: new Date().toISOString(),
    source: input.minerReport.source,
    requestedCount: targetCount,
    selectedCount: shorts.length,
    shorts,
    rejectedOpportunities,
    nextRecommendedImprovements: [
      "Instalar um rasterizador local de PDF (Poppler pdftoppm, MuPDF mutool ou ImageMagick magick) para ingestao direta de HQs em PDF.",
      "Adicionar leitura OCR mais forte por balao/recordatorio para roteiros mais fieis.",
      "Criar tela Comic Studio para aprovar 20 shorts e disparar render em lote.",
      "Adicionar avaliacao visual com zoom automatico no detalhe mais importante de cada painel.",
      "Adicionar anti-repeticao semantica para evitar 20 shorts com o mesmo gancho."
    ],
    candidateFirst: true,
    requiresManualApproval: true
  };
}

export function buildComicIngestionPlan(input: {
  sourcePath: string;
  recommendedAssetDirectory?: string;
}): ComicIngestionPlan {
  const ext = extname(input.sourcePath).toLowerCase();
  const sourceType: ComicIngestionSourceType =
    ext === ".pdf"
      ? "pdf"
      : ext === ".cbz"
        ? "cbz"
        : ext === ".cbr"
          ? "cbr"
          : ext === ""
            ? "image_directory"
            : "unknown";
  const supported = sourceType !== "unknown";
  const recommendedAssetDirectory = input.recommendedAssetDirectory ?? "storage/assets/comics/imported-comic";
  const warnings: string[] = [];
  if (sourceType === "unknown") warnings.push("unsupported_comic_source_type");
  if (sourceType === "cbr") warnings.push("cbr_requires_unrar_tooling_available");
  if (sourceType === "pdf") {
    warnings.push("pdf_requires_local_rasterizer:pdftoppm_or_mutool_or_magick_or_REELFORGE_PDF_RASTERIZER_COMMAND");
  }

  return {
    sourcePath: input.sourcePath,
    sourceType,
    supported,
    recommendedAssetDirectory,
    steps: [
      {
        stepId: "extract_pages",
        title: "Extrair paginas da HQ",
        status: sourceType === "image_directory" || sourceType === "pdf" ? "ready" : "requires_tooling",
        description: sourceType === "pdf"
          ? "Rasterizar todas as paginas do PDF local com pdftoppm, mutool, magick ou REELFORGE_PDF_RASTERIZER_COMMAND, preservando ordem e evidencias."
          : "Converter CBZ/CBR em imagens de paginas ordenadas dentro da pasta local autorizada."
      },
      {
        stepId: "segment_panels",
        title: "Segmentar paineis",
        status: "ready",
        description: "Usar o indexador local para detectar paineis, crop 9:16, hash e evidencias visuais."
      },
      {
        stepId: "mine_opportunities",
        title: "Minerar oportunidades de shorts",
        status: "ready",
        description: "Executar Comic Story Miner para lutas, curiosidades, revelacoes, humor, relacoes e cliffhangers."
      },
      {
        stepId: "manual_approval",
        title: "Aprovacao editorial",
        status: "manual_review",
        description: "Escolher quais oportunidades viram shorts antes de narracao/render."
      }
    ],
    warnings,
    candidateFirst: true
  };
}
