import { evaluateCandidateRisk } from "../compliance/risk-policy.js";
import type { MediaBeastCandidate } from "../providers/types.js";
import type { ChannelDNA } from "../scheduler/channel-dna.js";
import { buildPremiumAudioScorePlan, type PremiumAudioScorePlan } from "./audio-score-planner.js";
import { buildFastCutEditorPlan, type FastCutEditorPlan } from "./fast-cut-editor.js";
import {
  estimateScriptDurationSeconds,
  hasConcreteCuriosity,
  validateNarrationScript
} from "./narration-curiosity-engine.js";
import {
  buildChannelNarrationOverlay,
  type NarrationOverlayPlan
} from "./narration-overlay.js";
import {
  getNicheProductionProfile,
  resolveProductionEmotion
} from "./niche-production-profiles.js";
import {
  clampShortDuration,
  SHORT_DEFAULT_DURATION_SECONDS
} from "./short-production-limits.js";
import { buildMediaBeastTransformPlan } from "./transform-pipeline.js";
import { transformVisual, type VisualTransformerPlan } from "./visual-transformer.js";

export interface PremiumEditingBlueprint {
  durationSeconds: number;
  productionProfile: string;
  transitionStyle: VisualTransformerPlan["transitionStyle"];
  sceneFlow: Array<{
    sceneId: string;
    startSeconds: number;
    endSeconds: number;
    purpose: "hook" | "context" | "evidence" | "climax" | "cta";
    visualVariationId: string | null;
    cameraCue: string | null;
    transition: string | null;
    narrationEmphasis: string | null;
    narrationLine: string | null;
    narrationCuriosityTag: string | null;
    sfxCategory: string | null;
  }>;
  colorGradeId: string;
  masteringPresetId: string;
  musicPresetId: string;
  beatMarkers: number[];
  renderChecklist: string[];
}

export interface PremiumReelProductionPlan {
  candidate: MediaBeastCandidate;
  channelDNA: ChannelDNA;
  approvedCandidateRequired: true;
  visualPlan: VisualTransformerPlan;
  narrationPlan: NarrationOverlayPlan;
  musicPlan: PremiumAudioScorePlan;
  fastCutPlan: FastCutEditorPlan;
  editingBlueprint: PremiumEditingBlueprint;
  transformPlan: ReturnType<typeof buildMediaBeastTransformPlan>;
  safetyReview: ReturnType<typeof evaluateCandidateRisk> & {
    candidateId: string;
    providerId: string;
  };
  renderEligibility: {
    canRenderAutomatically: false;
    canRenderAfterManualApproval: boolean;
    reason: string;
  };
  productionNotes: string[];
  warnings: string[];
}

function buildPremiumNarrationProductionNotes(input: {
  narrationPlan: NarrationOverlayPlan;
  durationSeconds: number;
  profileLabel: string;
  visualVariationCount: number;
  cinematicEffectCount: number;
  musicPresetId: string;
  masteringPresetId: string;
  sceneCount: number;
}): string[] {
  const estimatedDuration = estimateScriptDurationSeconds(
    input.narrationPlan.suggestedScript,
    input.narrationPlan.pacing
  );
  const climaxBeat =
    input.narrationPlan.narrationBeats.find((beat) => beat.role === "climax") ??
    input.narrationPlan.narrationBeats.at(-2);
  const narrationSeconds = Math.min(input.durationSeconds, 45);
  const scriptWordCount = input.narrationPlan.suggestedScript
    .split(/\s+/)
    .filter(Boolean).length;
  const durationFit =
    estimatedDuration <= narrationSeconds + 2
      ? "ok"
      : estimatedDuration < narrationSeconds * 0.75
        ? "curto"
        : "longo";
  const narrationQuality = validateNarrationScript(input.narrationPlan.suggestedScript);

  return [
    `Production profile '${input.profileLabel}' applied with contextual narration engine.`,
    `Generated ${input.visualVariationCount} visual variations with ${input.cinematicEffectCount} cinematic effects.`,
    `Narration subject '${input.narrationPlan.narrationContext.subject}' via curiosity source '${input.narrationPlan.narrationContext.curiositySource}'.`,
    `Hook: "${input.narrationPlan.hookLine}"`,
    climaxBeat
      ? `Climax curiosity (${hasConcreteCuriosity(climaxBeat.text) ? "concreta" : "editorial"}): "${climaxBeat.text}"`
      : "Climax curiosity beat generated.",
    `Script fit: ~${estimatedDuration.toFixed(1)}s / ${narrationSeconds}s alvo (${scriptWordCount} palavras, ${durationFit}, ${input.narrationPlan.pacing} pacing).`,
    narrationQuality.valid
      ? "Narration script clean: sem metadados ou instrucoes de sistema."
      : `Narration script review: ${narrationQuality.issues.slice(0, 2).join(" | ")}`,
    `Music preset '${input.musicPresetId}' paired with mastering '${input.masteringPresetId}'.`,
    `Editing blueprint defines ${input.sceneCount} scenes with beat-synced cuts and per-scene narration lines.`
  ];
}

function buildEditingBlueprint(input: {
  durationSeconds: number;
  channelDNA: ChannelDNA;
  visualPlan: VisualTransformerPlan;
  narrationPlan: NarrationOverlayPlan;
  musicPlan: PremiumAudioScorePlan;
  fastCutPlan: FastCutEditorPlan;
}): PremiumEditingBlueprint {
  const profile = getNicheProductionProfile(input.channelDNA.niche);
  const purposes: PremiumEditingBlueprint["sceneFlow"][number]["purpose"][] = [
    "hook",
    "context",
    "evidence",
    "climax",
    "cta"
  ];
  const boundaries = [
    0,
    ...input.fastCutPlan.cutTimes.slice(0, 3),
    input.durationSeconds * 0.72,
    input.durationSeconds
  ].map((value) => Number(value.toFixed(2)));

  const sceneFlow = purposes.map((purpose, index) => {
    const startSeconds = boundaries[index] ?? 0;
    const endSeconds = boundaries[index + 1] ?? input.durationSeconds;
    const variation = input.visualPlan.comfyVariations[index] ?? null;
    const cameraCue = input.visualPlan.cameraMovements[index] ?? null;
    const transition = input.fastCutPlan.transitionSequence[index] ?? null;
    const voiceVariation = input.narrationPlan.voiceVariations[index] ?? null;
    const sfxCue = input.musicPlan.sfxCuePlan[index] ?? null;

    return {
      sceneId: `scene-${index + 1}`,
      startSeconds,
      endSeconds,
      purpose,
      visualVariationId: variation?.variationId ?? null,
      cameraCue: cameraCue?.type ?? null,
      transition: transition?.transition ?? null,
      narrationEmphasis: voiceVariation?.emphasis ?? null,
      narrationLine: voiceVariation?.line ?? null,
      narrationCuriosityTag: voiceVariation?.curiosityTag ?? null,
      sfxCategory: sfxCue?.category ?? null
    };
  });

  return {
    durationSeconds: input.durationSeconds,
    productionProfile: profile.label,
    transitionStyle: input.visualPlan.transitionStyle,
    sceneFlow,
    colorGradeId: input.visualPlan.colorGrade.profileId,
    masteringPresetId: input.musicPlan.masteringPresetId,
    musicPresetId: input.musicPlan.musicPresetId,
    beatMarkers: input.musicPlan.beatSyncPlan.suggestedCutTimes,
    renderChecklist: [
      "Confirm candidate manual approval and source rights.",
      "Import or generate only approved visual variations.",
      "Render narration from narrationEnginePayload.textDraft only (no legal notes).",
      "Apply narrationEnginePayload.styleDirective as voice-direction metadata.",
      "Attach licensed/local music and SFX from audio plan.",
      "Apply mastering preset before final video render.",
      "Verify overlay captions match narration beats (hook, context, climax, CTA)."
    ]
  };
}

export function generatePremiumReel(input: {
  candidate: MediaBeastCandidate;
  channelDNA: ChannelDNA;
  intensity?: "medium" | "extreme";
  durationSeconds?: number;
}): PremiumReelProductionPlan {
  const durationSeconds = clampShortDuration(
    input.durationSeconds ?? SHORT_DEFAULT_DURATION_SECONDS
  );
  const profile = getNicheProductionProfile(input.channelDNA.niche);
  const productionEmotion = resolveProductionEmotion(
    input.channelDNA.niche,
    input.channelDNA.tone
  );
  const intensity =
    input.intensity ??
    (profile.editEnergy === "extreme" ? "extreme" : "medium");

  const visualPlan = transformVisual(
    input.candidate,
    input.channelDNA,
    intensity,
    durationSeconds
  );
  const narrationPlan = buildChannelNarrationOverlay(
    input.candidate,
    input.channelDNA,
    Math.min(durationSeconds, 45)
  );
  const fastCutPlan = buildFastCutEditorPlan({
    durationSeconds,
    energy: profile.editEnergy,
    visualPlan,
    emotion: productionEmotion,
    beatMarkers: []
  });
  const musicPlan = buildPremiumAudioScorePlan({
    channelDNA: input.channelDNA,
    durationSeconds,
    fastCutPlan,
    emotion: productionEmotion
  });

  const riskDecision = evaluateCandidateRisk(input.candidate);
  const canRenderAfterManualApproval =
    riskDecision.allowedForManualReview && riskDecision.riskLevel !== "blocked";

  const editingBlueprint = buildEditingBlueprint({
    durationSeconds,
    channelDNA: input.channelDNA,
    visualPlan,
    narrationPlan,
    musicPlan,
    fastCutPlan
  });

  return {
    candidate: input.candidate,
    channelDNA: input.channelDNA,
    approvedCandidateRequired: true,
    visualPlan,
    narrationPlan,
    musicPlan,
    fastCutPlan,
    editingBlueprint,
    transformPlan: buildMediaBeastTransformPlan(input.candidate),
    safetyReview: {
      candidateId: input.candidate.id,
      providerId: input.candidate.providerId,
      ...riskDecision
    },
    renderEligibility: {
      canRenderAutomatically: false,
      canRenderAfterManualApproval,
      reason: canRenderAfterManualApproval
        ? "Premium reel plan is ready after manual candidate approval and licensed assets."
        : "Candidate is blocked or needs replacement before premium production."
    },
    productionNotes: buildPremiumNarrationProductionNotes({
      narrationPlan,
      durationSeconds,
      profileLabel: profile.label,
      visualVariationCount: visualPlan.comfyVariations.length,
      cinematicEffectCount: visualPlan.cinematicEffects.length,
      musicPresetId: musicPlan.musicPresetId,
      masteringPresetId: musicPlan.masteringPresetId,
      sceneCount: editingBlueprint.sceneFlow.length
    }),
    warnings: [
      "Candidate-first: discovery metadata informs the plan but does not grant reuse rights.",
      "Premium plans do not download, render or publish automatically.",
      ...narrationPlan.cautionNotes,
      ...musicPlan.cautionNotes,
      ...visualPlan.safetyNotes.slice(0, 2)
    ]
  };
}