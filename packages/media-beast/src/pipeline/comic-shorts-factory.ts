import { extname } from "node:path";
import type {
  ComicPanelVisualCropEvidence,
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
  panelVisualEvidence?: ComicPanelVisualCropEvidence;
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
  qualityGate: ComicShortQualityGateReport;
  warnings: string[];
  sourcePages: number[];
  productionRank: number;
  digestReasons: string[];
  zoomPlan: Array<{
    sceneOrder: number;
    panelId: string;
    zoomPreset: "face_focus" | "action_center" | "text_safe_push" | "wide_context" | "impact_detail";
    reason: string;
  }>;
};

export type ComicShortQualityGateReport = {
  status: "passed" | "rejected" | "needs_review";
  score: number;
  minDurationSeconds: number;
  durationSeconds: number;
  hasVisualAction: boolean;
  hasCharacterEvidence: boolean;
  hasConflictOrPayoff: boolean;
  hasCleanNarration: boolean;
  genericNarrationScore: number;
  ocrNoiseScore: number;
  blockers: string[];
  warnings: string[];
  reasons: string[];
};

export type ComicShortsBatchFactoryPlan = {
  generatedAt: string;
  source: ComicStoryMinerReport["source"];
  requestedCount: number;
  selectedCount: number;
  shorts: ComicShortProductionPlan[];
  productionOverview: {
    estimatedShortsAvailable: number;
    recommendedProductionOrder: number[];
    bestPages: number[];
    strongestCharacters: string[];
    strongestThemes: string[];
    readinessScore: number;
    warnings: string[];
  };
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

const MIN_COMIC_SHORT_DURATION_SECONDS = 30;

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

function zoomPresetForScene(scene: ComicShortScenePlan): ComicShortProductionPlan["zoomPlan"][number]["zoomPreset"] {
  if (scene.role === "hook") return "impact_detail";
  if (scene.role === "climax") return "action_center";
  if (scene.role === "context") return "wide_context";
  if (scene.narration.length > 80 || scene.caption.length > 70) return "text_safe_push";
  return "face_focus";
}

function buildZoomPlan(scenes: ComicShortScenePlan[]): ComicShortProductionPlan["zoomPlan"] {
  return scenes.map((scene) => ({
    sceneOrder: scene.order,
    panelId: scene.panelId,
    zoomPreset: zoomPresetForScene(scene),
    reason: `${scene.role}:${scene.motion}:page${scene.pageNumber ?? "unknown"}`
  }));
}

function scoreOcrNoise(text: string): number {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return 100;
  let score = 0;
  if (/[�ÃÂâ□]/.test(cleaned)) score += 30;
  if (/(\d)\1{4,}/.test(cleaned)) score += 18;
  const suspiciousChars = cleaned.match(/[{}[\]<>_=~`|\\]/g)?.length ?? 0;
  score += Math.min(25, suspiciousChars * 3);
  const words = cleaned.split(/\s+/).filter(Boolean);
  const brokenLongWords = words.filter((word) => word.length > 18 && !/[aeiouáéíóúãõâêô]/i.test(word)).length;
  score += Math.min(20, brokenLongWords * 8);
  const shortFragments = words.filter((word) => /^[bcdfghjklmnpqrstvwxyz]{4,}$/i.test(word)).length;
  score += Math.min(14, shortFragments * 3);
  return Math.round(clamp(score, 0, 100));
}

function scoreGenericNarration(text: string): number {
  const normalized = text.toLowerCase().replace(/\s+/g, " ").trim();
  if (!normalized) return 100;
  const weakPhrases = [
    "essa sequencia tem forca visual para short",
    "poucos paineis, leitura rapida",
    "ponto claro para transformar em narracao",
    "tem uma curiosidade escondida nessa sequencia",
    "a hq entrega um momento forte",
    "funciona bem como short",
    "momento forte para transformar em short"
  ];
  let score = 0;
  for (const phrase of weakPhrases) {
    if (normalized.includes(phrase)) score += 18;
  }
  const sentences = normalized.split(/[.!?]+/).map((sentence) => sentence.trim()).filter(Boolean);
  const uniqueSentences = new Set(sentences);
  if (sentences.length > 2 && uniqueSentences.size <= Math.ceil(sentences.length / 2)) score += 22;
  if (normalized.length < 220) score += 10;
  if (!/(mas|porque|entao|quando|antes|depois|virada|perigo|conflito|impacto|revela|vence|perde|quase)/i.test(text)) score += 12;
  return Math.round(clamp(score, 0, 100));
}

function sceneHasVisualAction(scene: ComicShortScenePlan): boolean {
  const evidence = scene.panelVisualEvidence;
  if (!evidence) return scene.role === "climax" || scene.motion === "impact_cut" || scene.transition === "flash";
  const storyFunction = String(evidence.storyFunction).toLowerCase();
  return (
    evidence.evidenceCounts.actions > 0 ||
    evidence.evidenceCounts.soundEffects > 0 ||
    Boolean(evidence.strongestActionLabel) ||
    /action|fight|climax|impact|transformation|reveal|attack|battle/.test(storyFunction) ||
    evidence.visualFlags.duoVisible ||
    evidence.visualFlags.venomVisible ||
    evidence.visualFlags.symbioteVisible ||
    evidence.visualFlags.spiderManVisible
  );
}

function sceneHasCharacterEvidence(scene: ComicShortScenePlan): boolean {
  const evidence = scene.panelVisualEvidence;
  if (!evidence) return false;
  return evidence.evidenceCounts.characters > 0 && evidence.confidence.characters >= 0.45;
}

function sceneHasConflictOrPayoff(scene: ComicShortScenePlan): boolean {
  const evidence = scene.panelVisualEvidence;
  const relationship = String(evidence?.strongestRelationshipType ?? "").toLowerCase();
  const storyFunction = String(evidence?.storyFunction ?? "").toLowerCase();
  return (
    scene.role === "climax" ||
    scene.role === "payoff" ||
    /conflict|host|symbiote|rival|threat|versus|enemy|alliance_break/.test(relationship) ||
    /climax|reveal|transformation|reaction|payoff|action/.test(storyFunction)
  );
}

export function evaluateComicShortQualityGate(short: ComicShortProductionPlan): ComicShortQualityGateReport {
  const blockers: string[] = [];
  const warnings: string[] = [];
  const reasons: string[] = [];
  const durationSeconds = Number(short.estimatedDurationSeconds.toFixed(1));
  const hasVisualAction = short.scenes.some(sceneHasVisualAction);
  const hasCharacterEvidence = short.scenes.some(sceneHasCharacterEvidence);
  const hasConflictOrPayoff = short.scenes.some(sceneHasConflictOrPayoff);
  const narrationText = short.narrationScript || short.scenes.map((scene) => scene.narration).join(" ");
  const ocrNoiseScore = scoreOcrNoise(narrationText);
  const genericNarrationScore = scoreGenericNarration(narrationText);
  const hasCleanNarration = ocrNoiseScore <= 30 && genericNarrationScore <= 45;

  if (durationSeconds < MIN_COMIC_SHORT_DURATION_SECONDS) blockers.push(`duration_below_30s:${durationSeconds}`);
  if (!hasVisualAction) blockers.push("missing_visual_action_evidence");
  if (!hasCharacterEvidence) blockers.push("missing_character_visual_evidence");
  if (!hasConflictOrPayoff) blockers.push("missing_conflict_or_payoff");
  if (!hasCleanNarration) blockers.push(`narration_not_clean:generic=${genericNarrationScore}:ocr=${ocrNoiseScore}`);
  if (short.qualityReport.panelCoverage < 0.8) blockers.push(`panel_coverage_below_80:${short.qualityReport.panelCoverage.toFixed(2)}`);
  if (short.scenes.length < 4) warnings.push("short_has_few_scenes_for_30s_pacing");
  if (short.qualityReport.warnings.length > 0) warnings.push(...short.qualityReport.warnings.map((warning) => `quality_report:${warning}`));

  if (durationSeconds >= MIN_COMIC_SHORT_DURATION_SECONDS) reasons.push("duration_minimum_30s_ok");
  if (hasVisualAction) reasons.push("visual_action_detected");
  if (hasCharacterEvidence) reasons.push("character_evidence_detected");
  if (hasConflictOrPayoff) reasons.push("conflict_or_payoff_detected");
  if (hasCleanNarration) reasons.push("narration_passes_generic_ocr_gate");

  const score = Math.round(clamp(
    100 - blockers.length * 22 - warnings.length * 4 - genericNarrationScore * 0.18 - ocrNoiseScore * 0.16,
    0,
    100
  ));

  return {
    status: blockers.length > 0 ? "rejected" : warnings.length > 0 ? "needs_review" : "passed",
    score,
    minDurationSeconds: MIN_COMIC_SHORT_DURATION_SECONDS,
    durationSeconds,
    hasVisualAction,
    hasCharacterEvidence,
    hasConflictOrPayoff,
    hasCleanNarration,
    genericNarrationScore,
    ocrNoiseScore,
    blockers,
    warnings,
    reasons
  };
}
function digestBoost(input: {
  opportunity: ComicShortOpportunity;
  minerReport: ComicStoryMinerReport;
}): number {
  const digest = input.minerReport.issueStoryDigest;
  const pages = input.opportunity.pages;
  let boost = 0;
  if (pages.some((page) => digest.recommendedProductionOrder.includes(page))) boost += 14;
  if (pages.some((page) => digest.bestPages.includes(page))) boost += 10;
  if (pages.some((page) => digest.climaxPages.includes(page))) boost += 10;
  if (pages.some((page) => digest.revealPages.includes(page))) boost += 8;
  if (pages.some((page) => digest.dialoguePages.includes(page))) boost += 4;
  return boost;
}

function buildDigestReasons(input: {
  opportunity: ComicShortOpportunity;
  minerReport: ComicStoryMinerReport;
}): string[] {
  const digest = input.minerReport.issueStoryDigest;
  const reasons: string[] = [];
  const pages = input.opportunity.pages;
  if (pages.some((page) => digest.recommendedProductionOrder.includes(page))) reasons.push("digest:recommended_page_order");
  if (pages.some((page) => digest.bestPages.includes(page))) reasons.push("digest:best_page");
  if (pages.some((page) => digest.climaxPages.includes(page))) reasons.push("digest:climax_page");
  if (pages.some((page) => digest.revealPages.includes(page))) reasons.push("digest:reveal_page");
  if (pages.some((page) => digest.dialoguePages.includes(page))) reasons.push("digest:text_context_page");
  return reasons;
}

function batchReadinessScore(shorts: ComicShortProductionPlan[]): number {
  if (shorts.length === 0) return 0;
  const average = shorts.reduce((sum, short) => {
    let score = short.score;
    if (short.qualityReport.hasHook) score += 5;
    if (short.qualityReport.hasClimax) score += 8;
    score += short.qualityReport.panelCoverage * 10;
    score -= short.qualityReport.warnings.length * 4;
    return sum + clamp(score, 0, 100);
  }, 0) / shorts.length;
  return Math.round(average);
}
export function buildComicShortProductionPlan(input: {
  opportunity: ComicShortOpportunity;
  index: number;
  minerReport?: ComicStoryMinerReport;
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
  const targetDurationSeconds = clamp(Math.max(opportunity.estimatedDurationSeconds, MIN_COMIC_SHORT_DURATION_SECONDS), MIN_COMIC_SHORT_DURATION_SECONDS, 60);
  const secondsPerScene = clamp(
    Math.ceil(targetDurationSeconds / Math.max(1, visualSequence.length)),
    4,
    10
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
      transition: transitionForRole(visual.role),
      ...(panel?.visualCropEvidence ? { panelVisualEvidence: panel.visualCropEvidence } : {})
    } satisfies ComicShortScenePlan;
  });

  const warnings = [...opportunity.warnings];
  if (!scenes.some((scene) => scene.role === "hook")) warnings.push("missing_hook_scene");
  if (!scenes.some((scene) => scene.role === "climax")) warnings.push("missing_climax_scene");
  if (scenes.some((scene) => !scene.panelImagePath)) warnings.push("missing_panel_image_path");
  const digestReasons = input.minerReport
    ? buildDigestReasons({ opportunity, minerReport: input.minerReport })
    : [];
  const productionRank = input.index + 1;
  const zoomPlan = buildZoomPlan(scenes);


  const plan = {
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
      "Confirmar que o short tem no minimo 30 segundos de duracao final.",
      "Confirmar legendas, musica e direitos dos assets locais."
    ],
    qualityReport: {
      panelCoverage: scenes.filter((scene) => Boolean(scene.panelImagePath)).length / Math.max(1, scenes.length),
      hasHook: scenes.some((scene) => scene.role === "hook"),
      hasClimax: scenes.some((scene) => scene.role === "climax"),
      narrationLineCount: scenes.length,
      warnings
    },
    warnings,
    sourcePages: opportunity.pages,
    productionRank,
    digestReasons,
    zoomPlan
  } as ComicShortProductionPlan;
  plan.qualityGate = evaluateComicShortQualityGate(plan);
  return plan;
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
  const selectedPlans: ComicShortProductionPlan[] = [];

  const ranked = [...input.minerReport.opportunities].sort((left, right) => {
    const categoryBias = (categoryCounts.get(left.category) ?? 0) - (categoryCounts.get(right.category) ?? 0);
    if (categoryBias !== 0) return categoryBias;
    const leftScore = left.score + digestBoost({ opportunity: left, minerReport: input.minerReport });
    const rightScore = right.score + digestBoost({ opportunity: right, minerReport: input.minerReport });
    return rightScore - leftScore;
  });

  for (const opportunity of ranked) {
    if (selectedPlans.length >= targetCount) break;
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
    const candidatePlan = buildComicShortProductionPlan({ opportunity, index: selectedPlans.length, minerReport: input.minerReport });
    if (candidatePlan.qualityGate.status === "rejected") {
      rejectedOpportunities.push({
        opportunityId: opportunity.id,
        reason: `quality_gate:${candidatePlan.qualityGate.blockers.join("|")}`
      });
      continue;
    }
    selectedPlans.push(candidatePlan);
    categoryCounts.set(opportunity.category, (categoryCounts.get(opportunity.category) ?? 0) + 1);
    for (const panelId of opportunity.panelIds) {
      usedPanelCounts.set(panelId, (usedPanelCounts.get(panelId) ?? 0) + 1);
    }
  }

  const shorts = selectedPlans;
  const readinessScore = batchReadinessScore(shorts);

  return {
    generatedAt: new Date().toISOString(),
    source: input.minerReport.source,
    requestedCount: targetCount,
    selectedCount: shorts.length,
    shorts,
    productionOverview: {
      estimatedShortsAvailable: input.minerReport.issueStoryDigest.estimatedShortsAvailable,
      recommendedProductionOrder: input.minerReport.issueStoryDigest.recommendedProductionOrder,
      bestPages: input.minerReport.issueStoryDigest.bestPages,
      strongestCharacters: input.minerReport.issueStoryDigest.strongestCharacters,
      strongestThemes: input.minerReport.issueStoryDigest.strongestThemes,
      readinessScore,
      warnings: input.minerReport.issueStoryDigest.warnings
    },
    rejectedOpportunities,
    nextRecommendedImprovements: [
      "Instalar um rasterizador local de PDF (Poppler pdftoppm, MuPDF mutool ou ImageMagick magick) para ingestao direta de HQs em PDF.",
      "Adicionar leitura OCR mais forte por balao/recordatorio para roteiros mais fieis.",
      "Criar tela Comic Studio para aprovar 20 shorts e disparar render em lote.",
      "Adicionar avaliacao visual com zoom automatico no detalhe mais importante de cada painel.",
      "Quality Gate ativo: rejeitar shorts abaixo de 30s, narracao generica/OCR sujo e cenas sem acao/personagem/payoff.",
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




