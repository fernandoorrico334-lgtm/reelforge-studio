import type { ComicStoryMinerReport } from "./comic-story-miner.js";
import type { ComicStoryArcV2 } from "./comic-story-arc-miner-v2.js";
import type { ComicArcScriptBeat, ComicArcScriptDoctorV2Result } from "./comic-arc-script-doctor-v2.js";
import type {
  ComicProjectBridgeEmotion,
  ComicProjectBridgeProjectInput,
  ComicProjectBridgeSceneInput,
  ComicProjectPanelAssetManifestEntry
} from "./comic-project-bridge.js";

export type ComicArcProjectBuilderV2Payload = {
  source: "comic-arc-project-builder-v2";
  generatedAt: string;
  arcId: string;
  scriptDoctorId: "comic_arc_script_doctor_v2";
  channelId: string;
  project: ComicProjectBridgeProjectInput;
  scenes: ComicProjectBridgeSceneInput[];
  panelAssetManifest: ComicProjectPanelAssetManifestEntry[];
  renderBlueprintHints: {
    source: "comic_arc_project_builder_v2";
    storyArc: ComicStoryArcV2;
    script: ComicArcScriptDoctorV2Result;
    selectedBeats: ComicArcScriptBeat[];
    targetDurationSeconds: number;
    sourcePages: number[];
    panelIds: string[];
    candidateFirst: true;
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

export type ComicArcBatchProjectBuilderV2Payload = {
  source: "comic-arc-batch-project-builder-v2";
  generatedAt: string;
  channelId: string;
  projectCount: number;
  projects: ComicArcProjectBuilderV2Payload[];
  warnings: string[];
  candidateFirst: true;
  requiresManualApproval: true;
};

type BuildComicArcProjectPayloadV2Input = {
  arc: ComicStoryArcV2;
  script: ComicArcScriptDoctorV2Result;
  channelId: string;
  templateId?: string | null;
  editingReferencePresetId?: string | null;
  titlePrefix?: string;
};

function safeJson(value: unknown): string {
  return JSON.stringify(value, null, 0);
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function emotionForBeat(beat: ComicArcScriptBeat, arc: ComicStoryArcV2): ComicProjectBridgeEmotion {
  if (beat.role === "hook" || beat.role === "climax") return "EPIC";
  if (beat.role === "tension") return "TENSE";
  if (arc.type === "hidden_reveal" || arc.type === "visual_curiosity") return "MYSTERIOUS";
  if (arc.type === "comic_absurdity") return "JOYFUL";
  if (arc.type === "unlikely_alliance") return "CURIOUS";
  return "NEUTRAL";
}

function visualPresetForArc(arc: ComicStoryArcV2): string {
  if (arc.type === "hero_vs_kaiju_showdown" || arc.type === "battle_escalation") return "epic";
  if (arc.type === "hidden_reveal" || arc.type === "visual_curiosity") return "mystery";
  if (arc.type === "comic_absurdity") return "action";
  if (arc.type === "unlikely_alliance" || arc.type === "character_turning_point") return "drama";
  return "epic";
}

function musicPresetForArc(arc: ComicStoryArcV2): string {
  if (arc.type === "hero_vs_kaiju_showdown" || arc.type === "battle_escalation") return "cinematic_epic";
  if (arc.type === "hidden_reveal" || arc.type === "visual_curiosity") return "true_crime_dark";
  if (arc.type === "comic_absurdity") return "viral_fast_cut";
  return "documentary_clean";
}

function audioMoodForArc(arc: ComicStoryArcV2): string {
  if (arc.type === "hero_vs_kaiju_showdown" || arc.type === "battle_escalation") return "epic";
  if (arc.type === "hidden_reveal" || arc.type === "visual_curiosity") return "suspense";
  if (arc.type === "comic_absurdity") return "hype";
  return "documentary";
}

function captionStyleForArc(arc: ComicStoryArcV2): string {
  if (arc.type === "hero_vs_kaiju_showdown" || arc.type === "battle_escalation") return "sports_hype";
  if (arc.type === "hidden_reveal" || arc.type === "visual_curiosity") return "true_crime_dark";
  return "comic_bold";
}

function transitionForBeat(beat: ComicArcScriptBeat): string {
  if (beat.role === "hook" || beat.role === "climax") return "flash";
  if (beat.role === "tension") return "whoosh";
  return "cut";
}

function durationPlan(beats: ComicArcScriptBeat[], targetDurationSeconds: number): number[] {
  if (beats.length === 0) return [];
  const weights = beats.map((beat) => {
    if (beat.role === "hook") return 1.1;
    if (beat.role === "setup") return 1.05;
    if (beat.role === "tension") return 1.15;
    if (beat.role === "climax") return 1.25;
    return 1;
  });
  const weightTotal = weights.reduce((sum, value) => sum + value, 0);
  const raw = weights.map((weight) => Math.max(5, Math.round((targetDurationSeconds * weight) / weightTotal)));
  const diff = targetDurationSeconds - raw.reduce((sum, value) => sum + value, 0);
  const lastIndex = raw.length - 1;
  raw[lastIndex] = Math.max(5, (raw[lastIndex] ?? 5) + diff);
  return raw;
}

function beatTitle(beat: ComicArcScriptBeat, order: number): string {
  const role = beat.role.replace(/_/g, " ");
  return `Cena ${order}: ${role}`;
}

function visualPromptForBeat(beat: ComicArcScriptBeat, arc: ComicStoryArcV2): string {
  return [
    `Use o painel autorizado ${beat.panelId} como imagem principal da cena.`,
    `Pagina fonte: ${beat.pageNumber}.`,
    `Historia do short: ${arc.title}.`,
    `Papel narrativo: ${beat.role}.`,
    `Objetivo da narracao: ${beat.purpose}.`,
    `Foque no elemento que prova esta frase: ${beat.narrationText}`,
    "Enquadramento vertical 9:16, zoom dinamico no rosto, balao, impacto ou reacao mais importante.",
    "Nao inventar evento, personagem ou acao fora da HQ; usar somente material autorizado/importado."
  ].join(" ");
}

function visualRecipeForBeat(beat: ComicArcScriptBeat, arc: ComicStoryArcV2, script: ComicArcScriptDoctorV2Result): string {
  return safeJson({
    source: "comic-arc-project-builder-v2",
    arcId: arc.id,
    arcType: arc.type,
    scriptDoctorId: script.doctorId,
    scriptScore: script.overallScore,
    panelId: beat.panelId,
    pageNumber: beat.pageNumber,
    role: beat.role,
    narrationPurpose: beat.purpose,
    delivery: beat.delivery,
    evidenceReason: beat.evidenceReason,
    viewerPromise: arc.viewerPromise,
    payoff: arc.payoff,
    requiresManualPanelImport: true,
    requiresManualApproval: true
  });
}

function buildScenes(input: { arc: ComicStoryArcV2; script: ComicArcScriptDoctorV2Result; targetDurationSeconds: number }): ComicProjectBridgeSceneInput[] {
  const durations = durationPlan(input.script.beats, input.targetDurationSeconds);
  const visualPreset = visualPresetForArc(input.arc);
  const captionStyle = captionStyleForArc(input.arc);
  return input.script.beats.map((beat, index) => ({
    order: index + 1,
    title: beatTitle(beat, index + 1),
    narrationText: beat.narrationText,
    captionText: beat.captionText,
    duration: durations[index] ?? 6,
    emotion: emotionForBeat(beat, input.arc),
    assetId: null,
    generatedAssetId: null,
    generatedNarrationAssetId: null,
    characterProfileId: null,
    sfxAssetId: null,
    sfxStartTime: beat.role === "hook" || beat.role === "climax" ? 0.15 : 0,
    sfxVolume: beat.role === "hook" || beat.role === "climax" ? 0.88 : 0.68,
    visualPreset,
    visualSourceMode: "asset_only",
    visualPrompt: visualPromptForBeat(beat, input.arc),
    negativePrompt: "Nao inventar personagens, nao alterar a HQ, nao usar imagem externa sem aprovacao, nao cortar rosto ou balao importante.",
    visualRecipe: visualRecipeForBeat(beat, input.arc, input.script),
    generationStatus: null,
    generationProvider: null,
    generationSeed: null,
    transition: transitionForBeat(beat),
    captionStyle,
    captionPosition: beat.role === "hook" || beat.role === "climax" ? "center" : "lower-third",
    captionEmphasisWords: beat.delivery.emphasisWords,
    energyLevel: beat.role === "hook" || beat.role === "climax" ? 9 : beat.role === "tension" ? 8 : 7,
    narrationStatus: null,
    narrationProvider: null,
    narrationVoicePackId: input.arc.type === "hero_vs_kaiju_showdown" || input.arc.type === "battle_escalation" ? "story_epic_ptbr" : "documentary_ptbr"
  }));
}

function buildProject(input: BuildComicArcProjectPayloadV2Input, targetDurationSeconds: number): ComicProjectBridgeProjectInput {
  const prefix = input.titlePrefix ? `${input.titlePrefix.trim()} ` : "";
  const musicPresetId = musicPresetForArc(input.arc);
  return {
    title: `${prefix}${input.script.title}`.trim(),
    status: "SCENE_PLANNING",
    channelId: input.channelId,
    script: [
      `SHORT EXTRAIDO DE ARCO DE HQ: ${input.script.title}`,
      `Tipo de arco: ${input.arc.type}`,
      `Promessa: ${input.arc.viewerPromise}`,
      `Payoff: ${input.arc.payoff}`,
      "",
      input.script.beats.map((beat, index) => `${index + 1}. ${beat.narrationText}`).join("\n"),
      "",
      "Observacao: payload candidate-first; importar paineis e aprovar manualmente antes de renderizar."
    ].join("\n"),
    durationTarget: targetDurationSeconds,
    format: "9:16",
    templateId: input.templateId ?? "comic_story_premium",
    editingReferencePresetId: input.editingReferencePresetId ?? "builtin-comic-viral-reference-antman",
    editingStyleSummary: null,
    defaultCaptionStyle: captionStyleForArc(input.arc),
    backgroundMusicAssetId: null,
    musicPresetId,
    voiceoverAssetId: null,
    audioMood: audioMoodForArc(input.arc),
    musicVolume: musicPresetId === "cinematic_epic" || musicPresetId === "viral_fast_cut" ? 0.24 : 0.16,
    voiceVolume: 1,
    sfxVolume: 0.78,
    enableAudioDucking: true,
    duckingLevel: 0.4
  };
}

function buildManifest(beats: ComicArcScriptBeat[], arc: ComicStoryArcV2): ComicProjectPanelAssetManifestEntry[] {
  return beats.map((beat, index) => ({
    sceneOrder: index + 1,
    panelId: beat.panelId,
    panelImagePath: null,
    sourcePageNumber: beat.pageNumber,
    recommendedAssetCategory: "PANEL",
    recommendedAssetType: "IMAGE",
    recommendedTags: [
      "comic-panel",
      "comic-arc-v2",
      `arc:${arc.id}`,
      `arc-type:${arc.type}`,
      `role:${beat.role}`,
      `page:${beat.pageNumber}`
    ],
    importRequired: true
  }));
}

function checklist(input: { arc: ComicStoryArcV2; script: ComicArcScriptDoctorV2Result; scenes: ComicProjectBridgeSceneInput[]; targetDurationSeconds: number }): ComicArcProjectBuilderV2Payload["qualityChecklist"] {
  return [
    {
      id: "manual_rights_review",
      label: "Direitos e uso autorizado revisados",
      status: "needs_review",
      detail: "Confirme que a HQ e os paineis podem ser usados no canal antes de importar assets ou renderizar."
    },
    {
      id: "arc_story_ready",
      label: "Arco narrativo pronto para short",
      status: input.arc.readyForShort ? "ready" : "needs_review",
      detail: `score=${input.arc.overallScore}; beats=${input.arc.beats.length}; type=${input.arc.type}.`
    },
    {
      id: "script_voiceover_ready",
      label: "Script pronto para narracao",
      status: input.script.readyForVoiceover ? "ready" : "needs_review",
      detail: `score=${input.script.overallScore}; human=${input.script.humanScore}; retention=${input.script.retentionScore}.`
    },
    {
      id: "minimum_duration_30s",
      label: "Duracao minima de 30 segundos",
      status: input.targetDurationSeconds >= 30 ? "ready" : "blocked",
      detail: `target=${input.targetDurationSeconds}s; scenes=${input.scenes.length}.`
    },
    {
      id: "scene_structure",
      label: "Hook, tensao, climax e payoff planejados",
      status: input.scenes.length >= 4 && input.script.beats.some((beat) => beat.role === "hook") && input.script.beats.some((beat) => beat.role === "climax") ? "ready" : "needs_review",
      detail: `roles=${input.script.beats.map((beat) => beat.role).join(",")}.`
    },
    {
      id: "panel_assets_required",
      label: "Paineis precisam ser importados como assets",
      status: "needs_review",
      detail: "O builder escolhe os paineis e cenas, mas nao importa imagens nem inicia render automaticamente."
    },
    {
      id: "render_not_auto_started",
      label: "Render bloqueado ate aprovacao manual",
      status: "needs_review",
      detail: "Candidate-first ativo: revisar historia, paineis e direitos antes do render final."
    }
  ];
}

export function buildComicArcProjectPayloadV2(input: BuildComicArcProjectPayloadV2Input): ComicArcProjectBuilderV2Payload {
  const targetDurationSeconds = Math.max(30, input.script.estimatedDurationSeconds, input.arc.recommendedDurationSeconds);
  const scenes = buildScenes({ arc: input.arc, script: input.script, targetDurationSeconds });
  const project = buildProject(input, scenes.reduce((sum, scene) => sum + (scene.duration ?? 0), 0));
  const panelAssetManifest = buildManifest(input.script.beats, input.arc);
  const warnings = unique([
    ...input.arc.warnings,
    ...input.script.warnings,
    "comic_arc_project_builder_v2_applied",
    "candidate_first_payload_only",
    "manual_panel_asset_import_required",
    "manual_approval_required_before_render",
    "no_assets_imported_automatically",
    "no_render_started_automatically"
  ]);

  return {
    source: "comic-arc-project-builder-v2",
    generatedAt: new Date().toISOString(),
    arcId: input.arc.id,
    scriptDoctorId: input.script.doctorId,
    channelId: input.channelId,
    project,
    scenes,
    panelAssetManifest,
    renderBlueprintHints: {
      source: "comic_arc_project_builder_v2",
      storyArc: input.arc,
      script: input.script,
      selectedBeats: input.script.beats,
      targetDurationSeconds: project.durationTarget ?? targetDurationSeconds,
      sourcePages: input.arc.pages,
      panelIds: input.arc.panelIds,
      candidateFirst: true
    },
    qualityChecklist: checklist({ arc: input.arc, script: input.script, scenes, targetDurationSeconds: project.durationTarget ?? targetDurationSeconds }),
    warnings,
    candidateFirst: true,
    requiresManualApproval: true
  };
}

export function buildComicArcProjectsFromMinerV2(input: {
  report: ComicStoryMinerReport;
  channelId: string;
  maxProjects?: number;
  templateId?: string | null;
  editingReferencePresetId?: string | null;
  titlePrefix?: string;
}): ComicArcBatchProjectBuilderV2Payload {
  const arcReport = input.report.storyArcMinerV2;
  const warnings: string[] = [];
  if (!arcReport) warnings.push("story_arc_miner_v2_missing");

  const arcs = arcReport?.arcs ?? [];
  const scripts = arcReport?.scriptDoctor.recommendedScripts.length
    ? arcReport.scriptDoctor.recommendedScripts
    : arcReport?.scriptDoctor.scripts ?? [];
  const arcById = new Map(arcs.map((arc) => [arc.id, arc]));
  const maxProjects = Math.max(1, Math.min(input.maxProjects ?? scripts.length, scripts.length || 1));
  const projects = scripts
    .slice(0, maxProjects)
    .flatMap((script) => {
      const arc = arcById.get(script.arcId);
      if (!arc) {
        warnings.push(`missing_arc_for_script:${script.arcId}`);
        return [];
      }
      return [buildComicArcProjectPayloadV2({
        arc,
        script,
        channelId: input.channelId,
        ...(input.templateId !== undefined ? { templateId: input.templateId } : {}),
        ...(input.editingReferencePresetId !== undefined ? { editingReferencePresetId: input.editingReferencePresetId } : {}),
        ...(input.titlePrefix !== undefined ? { titlePrefix: input.titlePrefix } : {})
      })];
    });

  if (projects.length === 0) warnings.push("no_comic_arc_projects_generated");

  return {
    source: "comic-arc-batch-project-builder-v2",
    generatedAt: new Date().toISOString(),
    channelId: input.channelId,
    projectCount: projects.length,
    projects,
    warnings: unique([
      ...warnings,
      ...(arcReport?.warnings ?? []),
      "candidate_first_payload_only",
      "no_assets_imported_automatically",
      "no_render_started_automatically"
    ]),
    candidateFirst: true,
    requiresManualApproval: true
  };
}

