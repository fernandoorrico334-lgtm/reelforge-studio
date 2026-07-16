import type { ComicStoryMinerReport } from "./comic-story-miner.js";
import type { ComicStoryArcV2 } from "./comic-story-arc-miner-v2.js";
import type { ComicArcScriptBeat, ComicArcScriptDoctorV2Result } from "./comic-arc-script-doctor-v2.js";
import { evaluateComicShortFinalQualityGate, type ComicShortFinalQaReport } from "./comic-short-final-quality-gate.js";
import { directComicArcVisualPlan, type ComicArcVisualDirection } from "./comic-arc-visual-director.js";
import { runComicPanelBattleTest, type ComicPanelBattleTestReport } from "./comic-panel-battle-test.js";
import { buildComicBeatTimingPlan, type ComicBeatTimingPlan } from "./comic-beat-timing-plan.js";
import { evaluateComicNarrationHumanizerGate, type ComicNarrationHumanizerGate } from "./comic-narration-humanizer-gate.js";
import { buildComicCaptionImpactPlan, type ComicCaptionImpactPlan } from "./comic-caption-impact-director.js";
import { checkComicPanelContinuity, type ComicPanelContinuityReport } from "./comic-panel-continuity-checker.js";
import { evaluateComicPostRenderCropQa, type ComicPostRenderCropQaReport } from "./comic-post-render-crop-qa.js";
import type { ComicStoryMinerPanelRef } from "./comic-story-miner.js";
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
    finalQualityGate: ComicShortFinalQaReport;
    arcVisualPlan: ReturnType<typeof directComicArcVisualPlan>;
    panelBattleTest: ComicPanelBattleTestReport;
    beatTimingPlan: ComicBeatTimingPlan;
    narrationHumanizerGate: ComicNarrationHumanizerGate;
    captionImpactPlan: ComicCaptionImpactPlan;
    panelContinuityReport: ComicPanelContinuityReport;
    postRenderCropQa: ComicPostRenderCropQaReport;
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
  panelsById?: Map<string, ComicStoryMinerPanelRef>;
};

function safeJson(value: unknown): string {
  return JSON.stringify(value, null, 0);
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function applyHumanizedNarration(input: {
  script: ComicArcScriptDoctorV2Result;
  humanizerGate: ComicNarrationHumanizerGate;
}): ComicArcScriptDoctorV2Result {
  const rewriteByRole = new Map(input.humanizerGate.beatRewrites.map((rewrite) => [rewrite.beatRole, rewrite]));
  const beats = input.script.beats.map((beat) => {
    const rewrite = rewriteByRole.get(beat.role);
    const suggested = rewrite?.suggested.trim();
    if (!rewrite || !suggested || rewrite.reason === "line_already_human_enough") return beat;
    return {
      ...beat,
      narrationText: suggested,
      delivery: {
        ...beat.delivery,
        pauseAfterMs: input.humanizerGate.voiceDirection.pauseMap.find((pause) => pause.afterBeatRole === beat.role)?.pauseMs ?? beat.delivery.pauseAfterMs,
        voiceNote: `${beat.delivery.voiceNote} Humanizer: ${input.humanizerGate.voiceDirection.tone}; ${rewrite.reason}.`
      }
    };
  });
  return {
    ...input.script,
    beats,
    fullNarration: beats.map((beat) => beat.narrationText).join(" "),
    warnings: unique([
      ...input.script.warnings,
      ...(input.humanizerGate.beatRewrites.some((rewrite) => rewrite.reason !== "line_already_human_enough") ? ["comic_humanized_rewrites_applied"] : [])
    ])
  };
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

type CaptionPosition = "center" | "lower-third" | "top" | "bottom";

function safeCaptionPosition(value: string | undefined, fallback: CaptionPosition): CaptionPosition {
  if (value === "center" || value === "lower-third" || value === "top" || value === "bottom") return value;
  return fallback;
}

function visualPromptForBeat(beat: ComicArcScriptBeat, arc: ComicStoryArcV2, visualDirection?: ComicArcVisualDirection): string {
  return [
    `Use o painel autorizado ${beat.panelId} como imagem principal da cena.`,
    `Pagina fonte: ${beat.pageNumber}.`,
    `Historia do short: ${arc.title}.`,
    `Papel narrativo: ${beat.role}.`,
    `Objetivo da narracao: ${beat.purpose}.`,
    `Foque no elemento que prova esta frase: ${beat.narrationText}`,
    visualDirection?.renderInstruction ?? "Enquadramento vertical 9:16, zoom dinamico no rosto, balao, impacto ou reacao mais importante.",
    "Nao inventar evento, personagem ou acao fora da HQ; usar somente material autorizado/importado."
  ].join(" ");
}

function visualRecipeForBeat(beat: ComicArcScriptBeat, arc: ComicStoryArcV2, script: ComicArcScriptDoctorV2Result, visualDirection?: ComicArcVisualDirection, timingScene?: ComicBeatTimingPlan["scenes"][number], premiumDirectives?: { humanizedRewrite?: ComicNarrationHumanizerGate["beatRewrites"][number] | undefined; captionCue?: ComicCaptionImpactPlan["cues"][number] | undefined; continuityCut?: ComicPanelContinuityReport["continuityCuts"][number] | undefined; continuityBridge?: ComicPanelContinuityReport["bridgeNarrationHints"][number] | undefined; cropQaScene?: ComicPostRenderCropQaReport["sceneReports"][number] | undefined }): string {
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
    arcVisualDirection: visualDirection ?? null,
    beatTiming: timingScene ?? null,
    premiumDirectives: premiumDirectives ?? null,
    captionRenderPlan: premiumDirectives?.captionCue ?? null,
    continuityInstruction: premiumDirectives?.continuityCut ?? null,
    cropQaInstruction: premiumDirectives?.cropQaScene ?? null,
    viewerPromise: arc.viewerPromise,
    payoff: arc.payoff,
    requiresManualPanelImport: true,
    requiresManualApproval: true
  });
}

function buildScenes(input: { arc: ComicStoryArcV2; script: ComicArcScriptDoctorV2Result; targetDurationSeconds: number; arcVisualPlan: ReturnType<typeof directComicArcVisualPlan>; beatTimingPlan: ComicBeatTimingPlan; narrationHumanizerGate: ComicNarrationHumanizerGate; captionImpactPlan: ComicCaptionImpactPlan; panelContinuityReport: ComicPanelContinuityReport; postRenderCropQa: ComicPostRenderCropQaReport }): ComicProjectBridgeSceneInput[] {
  const durations = durationPlan(input.script.beats, input.targetDurationSeconds);
  const visualPreset = visualPresetForArc(input.arc);
  const captionStyle = captionStyleForArc(input.arc);
  return input.script.beats.map((beat, index) => {
    const visualDirection = input.arcVisualPlan.scenes.find((scene) => scene.panelId === beat.panelId && scene.beatRole === beat.role);
    const timingScene = input.beatTimingPlan.scenes.find((scene) => scene.panelId === beat.panelId && scene.beatRole === beat.role);
    const captionCue = input.captionImpactPlan.cues.find((cue) => cue.panelId === beat.panelId && cue.beatRole === beat.role);
    const continuityCut = input.panelContinuityReport.continuityCuts[index - 1];
    const continuityBridge = input.panelContinuityReport.bridgeNarrationHints[index - 1];
    const cropQaScene = input.postRenderCropQa.sceneReports.find((scene) => scene.panelId === beat.panelId && scene.beatRole === beat.role);
    const humanizedRewrite = input.narrationHumanizerGate.beatRewrites.find((rewrite) => rewrite.beatRole === beat.role);
    return {
      order: index + 1,
      title: beatTitle(beat, index + 1),
      narrationText: beat.narrationText,
      captionText: captionCue?.text ?? beat.captionText,
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
      visualPrompt: visualPromptForBeat(beat, input.arc, visualDirection),
      negativePrompt: "Nao inventar personagens, nao alterar a HQ, nao usar imagem externa sem aprovacao, nao cortar rosto ou balao importante.",
      visualRecipe: visualRecipeForBeat(beat, input.arc, input.script, visualDirection, timingScene, { humanizedRewrite, captionCue, continuityCut, continuityBridge, cropQaScene }),
      generationStatus: null,
      generationProvider: null,
      generationSeed: null,
      transition: transitionForBeat(beat),
      captionStyle,
      captionPosition: safeCaptionPosition(captionCue?.safeZone, beat.role === "hook" || beat.role === "climax" ? "center" : "lower-third"),
      captionEmphasisWords: captionCue?.emphasisWords ?? beat.delivery.emphasisWords,
      energyLevel: beat.role === "hook" || beat.role === "climax" ? 9 : beat.role === "tension" ? 8 : 7,
      narrationStatus: null,
      narrationProvider: null,
      narrationVoicePackId: input.arc.type === "hero_vs_kaiju_showdown" || input.arc.type === "battle_escalation" ? "story_epic_ptbr" : "documentary_ptbr"
    };
  });
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

function checklist(input: { arc: ComicStoryArcV2; script: ComicArcScriptDoctorV2Result; scenes: ComicProjectBridgeSceneInput[]; targetDurationSeconds: number; finalQualityGate: ComicShortFinalQaReport; panelBattleTest: ComicPanelBattleTestReport; narrationHumanizerGate: ComicNarrationHumanizerGate; captionImpactPlan: ComicCaptionImpactPlan; panelContinuityReport: ComicPanelContinuityReport; postRenderCropQa: ComicPostRenderCropQaReport }): ComicArcProjectBuilderV2Payload["qualityChecklist"] {
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
      id: "comic_final_quality_gate",
      label: "Final QA de historia, paineis e narracao",
      status: input.finalQualityGate.status === "passed" ? "ready" : input.finalQualityGate.status === "rejected" ? "blocked" : "needs_review",
      detail: `score=${input.finalQualityGate.score}/${input.finalQualityGate.minimumScore}; blockers=${input.finalQualityGate.blockers.join(",") || "none"}; warnings=${input.finalQualityGate.warnings.join(",") || "none"}.`
    },
    {
      id: "panel_battle_test",
      label: "Paineis testados contra alternativas",
      status: input.panelBattleTest.averageSelectedScore >= 78 ? "ready" : input.panelBattleTest.averageSelectedScore >= 68 ? "needs_review" : "blocked",
      detail: `score=${input.panelBattleTest.averageSelectedScore}; improved=${input.panelBattleTest.improvedBeatCount}; selected=${input.panelBattleTest.selectedPanelIds.join(",")}.`
    },
    {
      id: "narration_humanizer_gate",
      label: "Narracao humana e especifica",
      status: input.narrationHumanizerGate.status === "passed" ? "ready" : input.narrationHumanizerGate.status === "rejected" ? "blocked" : "needs_review",
      detail: `score=${input.narrationHumanizerGate.score}; oral=${input.narrationHumanizerGate.oralFlowScore}; specific=${input.narrationHumanizerGate.specificityScore}; generic=${input.narrationHumanizerGate.genericSignals.length}.`
    },
    {
      id: "caption_impact_director",
      label: "Legendas com punch e zona segura",
      status: input.captionImpactPlan.averageImpactScore >= 84 && input.captionImpactPlan.warnings.length === 0 ? "ready" : "needs_review",
      detail: `score=${input.captionImpactPlan.averageImpactScore}; cues=${input.captionImpactPlan.cueCount}; warnings=${input.captionImpactPlan.warnings.join(",") || "none"}.`
    },
    {
      id: "panel_continuity_checker",
      label: "Continuidade visual da historia",
      status: input.panelContinuityReport.status === "passed" ? "ready" : input.panelContinuityReport.status === "rejected" ? "blocked" : "needs_review",
      detail: `score=${input.panelContinuityReport.score}; sequence=${input.panelContinuityReport.roleSequence.join(">")}; warnings=${input.panelContinuityReport.warnings.join(",") || "none"}.`
    },
    {
      id: "post_render_crop_qa",
      label: "QA de crop, legenda e foco visual",
      status: input.postRenderCropQa.status === "passed" ? "ready" : input.postRenderCropQa.status === "rejected" ? "blocked" : "needs_review",
      detail: `score=${input.postRenderCropQa.score}; overlap=${input.postRenderCropQa.captionOverlapRiskCount}; weakFocus=${input.postRenderCropQa.weakFocusCount}.`
    },    {
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
  const panelsById = input.panelsById ?? new Map();
  const panelBattleTest = runComicPanelBattleTest({ arc: input.arc, script: input.script, panelsById });
  const preHumanizedScript: ComicArcScriptDoctorV2Result = { ...input.script, beats: panelBattleTest.optimizedBeats };
  const preHumanizerGate = evaluateComicNarrationHumanizerGate({ arc: input.arc, script: preHumanizedScript });
  const optimizedScript = applyHumanizedNarration({ script: preHumanizedScript, humanizerGate: preHumanizerGate });
  const arcVisualPlan = directComicArcVisualPlan({
    arc: input.arc,
    scriptBeats: optimizedScript.beats,
    panelsById
  });
  const durations = durationPlan(optimizedScript.beats, targetDurationSeconds);
  const beatTimingPlan = buildComicBeatTimingPlan({ beats: optimizedScript.beats, durations, visualDirections: arcVisualPlan.scenes });
  const narrationHumanizerGate = evaluateComicNarrationHumanizerGate({ arc: input.arc, script: optimizedScript });
  const captionImpactPlan = buildComicCaptionImpactPlan({ beats: optimizedScript.beats, timingPlan: beatTimingPlan, visualDirections: arcVisualPlan.scenes });
  const panelContinuityReport = checkComicPanelContinuity({ arc: input.arc, beats: optimizedScript.beats, visualDirections: arcVisualPlan.scenes });
  const postRenderCropQa = evaluateComicPostRenderCropQa({ visualDirections: arcVisualPlan.scenes, captionImpactPlan });
  const scenes = buildScenes({ arc: input.arc, script: optimizedScript, targetDurationSeconds, arcVisualPlan, beatTimingPlan, narrationHumanizerGate: preHumanizerGate, captionImpactPlan, panelContinuityReport, postRenderCropQa });
  const project = buildProject({ ...input, script: optimizedScript }, scenes.reduce((sum, scene) => sum + (scene.duration ?? 0), 0));
  const panelAssetManifest = buildManifest(optimizedScript.beats, input.arc);
  const finalQualityGate = evaluateComicShortFinalQualityGate({
    arc: input.arc,
    script: optimizedScript,
    scenes,
    panelAssetManifest,
    targetDurationSeconds: project.durationTarget ?? targetDurationSeconds,
    arcVisualPlan
  });
  const warnings = unique([
    ...input.arc.warnings,
    ...optimizedScript.warnings,
    ...panelBattleTest.warnings,
    "comic_arc_project_builder_v2_applied",
    "candidate_first_payload_only",
    "manual_panel_asset_import_required",
    "manual_approval_required_before_render",
    "no_assets_imported_automatically",
    "no_render_started_automatically",
    `comic_final_quality_gate:${finalQualityGate.status}`,
    `comic_arc_visual_alignment:${arcVisualPlan.averagePanelNarrationAlignmentScore}`,
    `comic_panel_battle_test:${panelBattleTest.averageSelectedScore}`,
    `comic_beat_timing:${beatTimingPlan.averagePacingScore}`,
    `comic_narration_humanizer:${narrationHumanizerGate.score}`,
    `comic_caption_impact:${captionImpactPlan.averageImpactScore}`,
    `comic_panel_continuity:${panelContinuityReport.score}`,
    `comic_post_render_crop_qa:${postRenderCropQa.score}`
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
      script: optimizedScript,
      selectedBeats: optimizedScript.beats,
      targetDurationSeconds: project.durationTarget ?? targetDurationSeconds,
      sourcePages: input.arc.pages,
      panelIds: input.arc.panelIds,
      candidateFirst: true,
      finalQualityGate,
      arcVisualPlan,
      panelBattleTest,
      beatTimingPlan,
      narrationHumanizerGate,
      captionImpactPlan,
      panelContinuityReport,
      postRenderCropQa
    },
    qualityChecklist: checklist({ arc: input.arc, script: optimizedScript, scenes, targetDurationSeconds: project.durationTarget ?? targetDurationSeconds, finalQualityGate, panelBattleTest, narrationHumanizerGate, captionImpactPlan, panelContinuityReport, postRenderCropQa }),
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
  const panelsById = new Map(input.report.opportunities.flatMap((opportunity) => opportunity.panels.map((panel) => [panel.panelId, panel] as const)));
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
        ...(input.titlePrefix !== undefined ? { titlePrefix: input.titlePrefix } : {}),
        panelsById
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










