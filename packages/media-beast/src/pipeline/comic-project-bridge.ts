import { applyComicPremiumDirector, type ComicPremiumDirectorReport } from "./comic-premium-director.js";
import { scoreComicRenderReadiness, type ComicRenderQualityScorerReport } from "./comic-render-quality-scorer.js";
import { directComicSfxBeatPlan, type ComicSfxBeatDirectorReport } from "./comic-sfx-beat-director.js";
import type {
  ComicShortProductionPlan,
  ComicShortScenePlan,
  ComicShortsBatchFactoryPlan
} from "./comic-shorts-factory.js";

export type ComicProjectBridgeEmotion =
  | "NEUTRAL"
  | "CURIOUS"
  | "EPIC"
  | "MYSTERIOUS"
  | "DARK"
  | "TENSE"
  | "JOYFUL"
  | "SAD";

export type ComicProjectBridgeProjectInput = {
  title: string;
  status: "DRAFT" | "SCRIPTING" | "SCENE_PLANNING" | "READY_FOR_EDIT";
  channelId: string;
  script: string | null;
  durationTarget: number | null;
  format: "9:16";
  templateId: string | null;
  editingReferencePresetId: string | null;
  editingStyleSummary: null;
  defaultCaptionStyle: string | null;
  backgroundMusicAssetId: string | null;
  musicPresetId: string | null;
  voiceoverAssetId: string | null;
  audioMood: string | null;
  musicVolume: number;
  voiceVolume: number;
  sfxVolume: number;
  enableAudioDucking: boolean;
  duckingLevel: number;
};

export type ComicProjectBridgeSceneInput = {
  order: number;
  title: string;
  narrationText: string | null;
  captionText: string | null;
  duration: number | null;
  emotion: ComicProjectBridgeEmotion | null;
  assetId: string | null;
  generatedAssetId: string | null;
  generatedNarrationAssetId: string | null;
  characterProfileId: string | null;
  sfxAssetId: string | null;
  sfxStartTime: number;
  sfxVolume: number;
  visualPreset: string | null;
  visualSourceMode: "asset_only" | "generated_only" | "hybrid_overlay" | "fallback_generated" | "mixed_sequence" | null;
  visualPrompt: string | null;
  negativePrompt: string | null;
  visualRecipe: string | null;
  generationStatus: null;
  generationProvider: null;
  generationSeed: null;
  transition: string | null;
  captionStyle: string | null;
  captionPosition: "top" | "center" | "lower-third" | "bottom" | null;
  captionEmphasisWords: string[];
  energyLevel: number | null;
  narrationStatus: null;
  narrationProvider: null;
  narrationVoicePackId: string | null;
};

export type ComicProjectPanelAssetManifestEntry = {
  sceneOrder: number;
  panelId: string;
  panelImagePath: string | null;
  sourcePageNumber: number | null;
  recommendedAssetCategory: "PANEL";
  recommendedAssetType: "IMAGE";
  recommendedTags: string[];
  importRequired: boolean;
};

export type ComicProjectBridgePayload = {
  source: "comic-short-project-bridge";
  generatedAt: string;
  shortId: string;
  sourceOpportunityId: string;
  channelId: string;
  project: ComicProjectBridgeProjectInput;
  scenes: ComicProjectBridgeSceneInput[];
  panelAssetManifest: ComicProjectPanelAssetManifestEntry[];
  renderBlueprintHints: {
    renderFormat: ComicShortProductionPlan["renderFormat"];
    captionStyleId: string;
    cinematicPresetId: string;
    audioMasteringPresetId: string;
    musicPresetId: string;
    sourcePages: number[];
    zoomPlan: ComicShortProductionPlan["zoomPlan"];
    premiumDirector: ComicPremiumDirectorReport;
    smartCrop: ComicPremiumDirectorReport["smartCrop"];
    sfxBeatDirector: ComicSfxBeatDirectorReport;
    renderQualityScore: ComicRenderQualityScorerReport;
  };
  qualityChecklist: Array<{
    id: string;
    label: string;
    status: "ready" | "needs_review" | "blocked";
    detail: string;
  }>;
  warnings: string[];
  candidateFirst: true;
  requiresManualApproval: true;
};

export type ComicBatchProjectBridgePayload = {
  source: "comic-batch-project-bridge";
  generatedAt: string;
  channelId: string;
  batchOverview: ComicShortsBatchFactoryPlan["productionOverview"];
  projects: ComicProjectBridgePayload[];
  warnings: string[];
  candidateFirst: true;
  requiresManualApproval: true;
};

function safeJson(value: unknown): string {
  return JSON.stringify(value, null, 0);
}

function emotionForScene(scene: ComicShortScenePlan, short: ComicShortProductionPlan): ComicProjectBridgeEmotion {
  if (scene.role === "hook" || scene.role === "climax") return "EPIC";
  if (short.category === "reveal" || short.category === "cliffhanger") return "MYSTERIOUS";
  if (short.category === "fight" || short.category === "transformation") return "TENSE";
  if (short.category === "humor") return "JOYFUL";
  if (short.category === "curiosity") return "CURIOUS";
  return "NEUTRAL";
}

function energyForScene(scene: ComicShortScenePlan, short: ComicShortProductionPlan): number {
  if (scene.role === "hook" || scene.role === "climax") return 9;
  if (short.category === "fight" || short.category === "transformation") return 8;
  if (scene.role === "payoff") return 6;
  return 7;
}

function titleForScene(scene: ComicShortScenePlan): string {
  const label = scene.role.replace(/_/g, " ");
  return `Cena ${scene.order}: ${label}`;
}

function emphasisWordsForScene(scene: ComicShortScenePlan, short: ComicShortProductionPlan): string[] {
  const text = `${scene.caption} ${short.title}`.toLowerCase();
  const words = ["godzilla", "kong", "batman", "superman", "venom", "deadpool", "luta", "segredo", "revelacao", "impacto"];
  return words.filter((word) => text.includes(word)).slice(0, 4);
}

function visualPromptForScene(scene: ComicShortScenePlan, short: ComicShortProductionPlan, premiumDirector?: ComicPremiumDirectorReport): string {
  return [
    `Use o painel autorizado ${scene.panelId} como visual principal.`,
    `Enquadramento vertical 9:16 com ${scene.motion}.`,
    `Papel narrativo: ${scene.role}.`,
    `Tema do short: ${short.title}.`,
    `Zoom planejado: ${short.zoomPlan.find((entry) => entry.sceneOrder === scene.order)?.zoomPreset ?? "action_center"}.`,
    ...(premiumDirector
      ? [premiumDirector.sceneDirections.find((entry) => entry.sceneOrder === scene.order)?.cropInstruction ?? ""]
      : []),
    "Preservar contexto do quadrinho e evitar inventar eventos que nao aparecem na pagina."
  ].join(" ");
}

function sceneVisualRecipe(scene: ComicShortScenePlan, short: ComicShortProductionPlan, premiumDirector?: ComicPremiumDirectorReport, sfxBeatDirector?: ComicSfxBeatDirectorReport): string {
  return safeJson({
    source: "comic-short-project-bridge",
    shortId: short.id,
    opportunityId: short.sourceOpportunityId,
    category: short.category,
    sourcePages: short.sourcePages,
    panelId: scene.panelId,
    panelImagePath: scene.panelImagePath,
    pageNumber: scene.pageNumber,
    motion: scene.motion,
    role: scene.role,
    zoomPlan: short.zoomPlan.find((entry) => entry.sceneOrder === scene.order) ?? null,
    premiumDirection: premiumDirector?.sceneDirections.find((entry) => entry.sceneOrder === scene.order) ?? null,
    smartCropDirective: premiumDirector?.smartCrop.directives.find((entry) => entry.sceneOrder === scene.order) ?? null,
    captionNarrationDirection: premiumDirector?.captionNarration.scenes.find((entry) => entry.sceneOrder === scene.order) ?? null,
    captionCues: premiumDirector?.captionNarration.scenes.find((entry) => entry.sceneOrder === scene.order)?.captionCues ?? [],
    sfxBeatCue: sfxBeatDirector?.cues.find((entry) => entry.sceneOrder === scene.order) ?? null,
    digestReasons: short.digestReasons,
    productionRank: short.productionRank,
    requiresManualAssetImport: true
  });
}

function buildProjectScript(short: ComicShortProductionPlan): string {
  return [
    `SHORT EXTRAIDO DE HQ: ${short.title}`,
    `Categoria: ${short.category}`,
    `Paginas-fonte: ${short.sourcePages.join(", ") || "nao informadas"}`,
    "",
    short.scenes.map((scene) => `${scene.order}. ${scene.narration}`).join("\n"),
    "",
    "Checklist editorial:",
    ...short.approvalChecklist.map((item) => `- ${item}`)
  ].join("\n");
}

function checklistForShort(short: ComicShortProductionPlan, premiumDirector?: ComicPremiumDirectorReport, renderQualityScore?: ComicRenderQualityScorerReport): ComicProjectBridgePayload["qualityChecklist"] {
  return [
    {
      id: "manual_rights_review",
      label: "Direitos e uso autorizado revisados",
      status: "needs_review",
      detail: "Confirme que a HQ/painel pode ser usado no canal antes de importar assets e renderizar."
    },
    {
      id: "panel_coverage",
      label: "Todos os paineis possuem caminho local",
      status: short.qualityReport.panelCoverage >= 1 ? "ready" : "needs_review",
      detail: `${Math.round(short.qualityReport.panelCoverage * 100)}% das cenas possuem panelImagePath.`
    },
    {
      id: "story_structure",
      label: "Hook e climax detectados",
      status: short.qualityReport.hasHook && short.qualityReport.hasClimax ? "ready" : "needs_review",
      detail: `hook=${short.qualityReport.hasHook}; climax=${short.qualityReport.hasClimax}.`
    },
    {
      id: "narration_review",
      label: "Narracao pronta para revisao humana",
      status: short.narrationScript.length > 80 ? "ready" : "needs_review",
      detail: `${short.qualityReport.narrationLineCount} linhas de narracao planejadas.`
    },
    ...(renderQualityScore
      ? [{
          id: "render_quality_score",
          label: "Score minimo para render premium",
          status: renderQualityScore.status === "blocked" ? "blocked" as const : renderQualityScore.status === "render_ready" ? "ready" as const : "needs_review" as const,
          detail: `score=${renderQualityScore.overallScore}/${renderQualityScore.minimumRecommendedScore}; status=${renderQualityScore.status}; pontos=${renderQualityScore.strengths.join(", ") || "n/a"}.`
        }]
      : []),
    ...(premiumDirector
      ? [{
          id: "premium_director_quality",
          label: "Direcao premium aplicada",
          status: premiumDirector.qualityScore >= 80 ? "ready" as const : "needs_review" as const,
          detail: `score=${premiumDirector.qualityScore}; cutPace=${premiumDirector.targetCutPaceSeconds}s; preset=${premiumDirector.referencePresetId}.`
        }]
      : []),
    {
      id: "render_not_auto_started",
      label: "Render bloqueado ate aprovacao manual",
      status: "needs_review",
      detail: "Este payload prepara o projeto, mas nao importa assets nem renderiza automaticamente."
    }
  ];
}

export function buildComicShortProjectBridgePayload(input: {
  short: ComicShortProductionPlan;
  channelId: string;
  templateId?: string | null;
  editingReferencePresetId?: string | null;
  titlePrefix?: string;
}): ComicProjectBridgePayload {
  const directed = applyComicPremiumDirector({ short: input.short });
  const short = directed.short;
  const premiumDirector = directed.report;
  const sfxBeatDirector = directComicSfxBeatPlan({ short, premiumDirector });
  const renderQualityScore = scoreComicRenderReadiness({ short, premiumDirector, sfxBeatDirector });
  const titlePrefix = input.titlePrefix ? `${input.titlePrefix.trim()} ` : "";
  const scenes: ComicProjectBridgeSceneInput[] = short.scenes.map((scene) => ({
    order: scene.order,
    title: titleForScene(scene),
    narrationText: scene.narration,
    captionText: scene.caption,
    duration: scene.durationSeconds,
    emotion: emotionForScene(scene, short),
    assetId: null,
    generatedAssetId: null,
    generatedNarrationAssetId: null,
    characterProfileId: null,
    sfxAssetId: null,
    sfxStartTime: 0,
    sfxVolume: scene.role === "climax" || scene.role === "hook" ? 0.85 : 0.65,
    visualPreset: short.cinematicPresetId,
    visualSourceMode: "asset_only",
    visualPrompt: visualPromptForScene(scene, short, premiumDirector),
    negativePrompt: "Nao inventar personagens, nao mudar eventos centrais, nao usar imagens externas sem aprovacao.",
    visualRecipe: sceneVisualRecipe(scene, short, premiumDirector, sfxBeatDirector),
    generationStatus: null,
    generationProvider: null,
    generationSeed: null,
    transition: scene.transition,
    captionStyle: short.captionStyleId,
    captionPosition: "lower-third",
    captionEmphasisWords: emphasisWordsForScene(scene, short),
    energyLevel: energyForScene(scene, short),
    narrationStatus: null,
    narrationProvider: null,
    narrationVoicePackId: short.category === "fight" || short.category === "transformation" ? "story_epic_ptbr" : "documentary_ptbr"
  }));

  return {
    source: "comic-short-project-bridge",
    generatedAt: new Date().toISOString(),
    shortId: short.id,
    sourceOpportunityId: short.sourceOpportunityId,
    channelId: input.channelId,
    project: {
      title: `${titlePrefix}${short.title}`.trim(),
      status: "SCENE_PLANNING",
      channelId: input.channelId,
      script: buildProjectScript(short),
      durationTarget: short.estimatedDurationSeconds,
      format: "9:16",
      templateId: input.templateId ?? "comic_drama",
      editingReferencePresetId: input.editingReferencePresetId ?? "builtin-comic-viral-reference-antman",
      editingStyleSummary: null,
      defaultCaptionStyle: short.captionStyleId,
      backgroundMusicAssetId: null,
      musicPresetId: short.musicPresetId,
      voiceoverAssetId: null,
      audioMood: short.category === "fight" ? "epic" : short.category === "reveal" ? "suspense" : "documentary",
      musicVolume: short.category === "fight" || short.category === "transformation" ? 0.24 : 0.16,
      voiceVolume: 1,
      sfxVolume: 0.75,
      enableAudioDucking: true,
      duckingLevel: 0.38
    },
    scenes,
    panelAssetManifest: short.scenes.map((scene) => ({
      sceneOrder: scene.order,
      panelId: scene.panelId,
      panelImagePath: scene.panelImagePath,
      sourcePageNumber: scene.pageNumber,
      recommendedAssetCategory: "PANEL",
      recommendedAssetType: "IMAGE",
      recommendedTags: [
        "comic-panel",
        `short:${short.id}`,
        `opportunity:${short.sourceOpportunityId}`,
        `role:${scene.role}`,
        `page:${scene.pageNumber ?? "unknown"}`
      ],
      importRequired: true
    })),
    renderBlueprintHints: {
      renderFormat: short.renderFormat,
      captionStyleId: short.captionStyleId,
      cinematicPresetId: short.cinematicPresetId,
      audioMasteringPresetId: short.audioMasteringPresetId,
      musicPresetId: short.musicPresetId,
      sourcePages: short.sourcePages,
      zoomPlan: short.zoomPlan,
      premiumDirector,
      smartCrop: premiumDirector.smartCrop,
      sfxBeatDirector,
      renderQualityScore
    },
    qualityChecklist: checklistForShort(short, premiumDirector, renderQualityScore),
    warnings: [...short.warnings, ...sfxBeatDirector.warnings, ...renderQualityScore.warnings, ...renderQualityScore.blockers, "comic_render_quality_scorer_applied", "premium_director_applied", "comic_sfx_beat_director_applied", "manual_sfx_asset_selection_required", "manual_panel_asset_import_required", "manual_approval_required_before_render"],
    candidateFirst: true,
    requiresManualApproval: true
  };
}

export function buildComicBatchProjectBridgePayload(input: {
  batch: ComicShortsBatchFactoryPlan;
  channelId: string;
  maxProjects?: number;
  templateId?: string | null;
  editingReferencePresetId?: string | null;
  titlePrefix?: string;
}): ComicBatchProjectBridgePayload {
  const maxProjects = Math.max(1, Math.min(input.maxProjects ?? input.batch.shorts.length, input.batch.shorts.length));
  const projects = input.batch.shorts.slice(0, maxProjects).map((short) => buildComicShortProjectBridgePayload({
    short,
    channelId: input.channelId,
    ...(input.templateId !== undefined ? { templateId: input.templateId } : {}),
    ...(input.editingReferencePresetId !== undefined
      ? { editingReferencePresetId: input.editingReferencePresetId }
      : {}),
    ...(input.titlePrefix !== undefined ? { titlePrefix: input.titlePrefix } : {})
  }));

  return {
    source: "comic-batch-project-bridge",
    generatedAt: new Date().toISOString(),
    channelId: input.channelId,
    batchOverview: input.batch.productionOverview,
    projects,
    warnings: [
      ...input.batch.productionOverview.warnings,
      "candidate_first_payload_only",
      "no_assets_imported_automatically",
      "no_render_started_automatically"
    ],
    candidateFirst: true,
    requiresManualApproval: true
  };
}
