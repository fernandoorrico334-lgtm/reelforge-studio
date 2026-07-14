import {
  buildNarrationPlan,
  getVoicePackById,
  type NarrationPlan
} from "@reelforge/narration-engine";
import type { MediaBeastCandidate } from "../providers/types.js";
import type { ChannelDNA } from "../scheduler/channel-dna.js";
import {
  beatsToScript,
  buildNarrationContentContext,
  buildNarrationEnginePrompt,
  buildNarrationVoiceVariations,
  buildRemixNarrationBeats,
  reduceNarrationOverlap,
  buildWordBudget,
  ensureNarrationBeatsSafe,
  estimateScriptDurationSeconds,
  finalizeNarrationBeats,
  hasConcreteCuriosity,
  resolveNarrationPacingForDuration,
  sanitizeTitle,
  validateNarrationScript,
  type NarrationBeatDraft
} from "./narration-curiosity-engine.js";
import { clampShortDuration } from "./short-production-limits.js";
import {
  getNicheProductionProfile,
  resolveProductionEmotion,
  type ProductionEmotion
} from "./niche-production-profiles.js";
import type { NarrationOverlayPlan } from "./narration-overlay.js";
import type { RemixContentDomain } from "./remix-content-intelligence.js";
import type { RemixTargetStyle } from "./remix-types.js";
import {
  injectResearchCuriositiesIntoBeats,
  type RemixResearchDossier
} from "./remix-research-bridge.js";
import type { VideoRemixAnalysis } from "./remix-video-analyzer.js";
import { applyRetentionRefinementToOverlay } from "./narration-retention-overlay-hook.js";
import type { NarrationVariantAngle } from "./narration-retention-packs.js";

const supportedVoicePackIds = [
  "narrator_clean_ptbr",
  "documentary_ptbr",
  "true_crime_dark_ptbr",
  "story_epic_ptbr",
  "sports_hype_ptbr",
  "calm_explainer_ptbr"
] as const;

function resolveVoicePackId(voicePackId: string) {
  return supportedVoicePackIds.includes(
    voicePackId as (typeof supportedVoicePackIds)[number]
  )
    ? voicePackId
    : "documentary_ptbr";
}

function buildCaptionFromLine(text: string): string {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= 7) {
    return text;
  }
  return words.slice(0, 7).join(" ");
}

function buildAnalysisCandidate(analysis: VideoRemixAnalysis): MediaBeastCandidate {
  const subject = sanitizeTitle(analysis.title);
  const intel = analysis.contentIntelligence;

  return {
    id: `remix-analysis-${subject.slice(0, 24).replace(/\s+/g, "-")}`,
    providerId: "youtube",
    kind: "video",
    title: subject || analysis.title,
    sourceUrl: "",
    previewUrl: null,
    licenseStatus: "unknown",
    riskLevel: "high",
    score: 55,
    reasons: [analysis.themeSummary, ...analysis.narrativeArc.slice(0, 2)],
    warnings: [],
    metadata: {
      remixContextKeywords: analysis.contextKeywords.join(", "),
      remixPlatform: analysis.platform,
      remixThemeSummary: analysis.themeSummary,
      remixContentDomain: intel.domain,
      remixContentHeadline: intel.headline,
      remixContentSummary: intel.summary,
      remixNarrativeBrief: intel.narrativeBrief,
      remixNarrativeHook: intel.narrativeHook,
      remixCuriosityAngle: intel.curiosityAngle,
      remixSetting: intel.setting,
      remixEntities: intel.entities.map((entity) => entity.name).join(", "),
      remixPrimaryAction: intel.actions[0]?.label ?? null,
      remixMood: intel.mood
    }
  };
}

function ensureClimaxCuriosity(
  beats: NarrationBeatDraft[],
  analysis: VideoRemixAnalysis,
  seed: string
): NarrationBeatDraft[] {
  const climaxIndex = beats.findIndex((beat) => beat.role === "climax");
  if (climaxIndex < 0) {
    return beats;
  }

  const climax = beats[climaxIndex]!;
  if (hasConcreteCuriosity(climax.text)) {
    return beats;
  }

  const lead = analysis.contentIntelligence.entities[0]?.name ?? sanitizeTitle(analysis.title);
  const action = analysis.contentIntelligence.actions[0]?.label ?? "destaque";

  const fallback = `${lead} viraliza aqui. ${action} esconde um contexto que o clipe original não mostra.`;

  return beats.map((beat, index) =>
    index === climaxIndex
      ? {
          ...beat,
          text: fallback,
          caption: buildCaptionFromLine(fallback),
          curiosityTag: "remix-curiosity-fallback"
        }
      : beat
  );
}

export function buildRemixNarrationOverlayPlan(input: {
  analysis: VideoRemixAnalysis;
  channelDNA: ChannelDNA;
  targetStyle: RemixTargetStyle;
  variationIndex?: number;
  maxDurationSeconds: number;
  narrationBias?: string;
  researchDossier?: RemixResearchDossier | null;
  selectedCuriosityIds?: string[];
  priorVariationScripts?: string[];
  priorVariationAngles?: NarrationVariantAngle[];
}): NarrationOverlayPlan {
  const language = input.channelDNA.language ?? "pt-BR";
  const channelTone = input.channelDNA.tone;
  const profile = getNicheProductionProfile(input.channelDNA.niche);
  const productionEmotion = resolveProductionEmotion(
    input.channelDNA.niche,
    channelTone
  ) as ProductionEmotion;
  const maxDurationSeconds = clampShortDuration(input.maxDurationSeconds);
  const pacing = resolveNarrationPacingForDuration(
    maxDurationSeconds,
    profile.narrationPacing ?? "balanced"
  );
  const voicePackHint = resolveVoicePackId(
    input.narrationBias ?? input.channelDNA.narrationBias ?? profile.narrationVoicePackId
  );
  const voicePack = getVoicePackById(voicePackHint);
  const variationIndex = input.variationIndex ?? 0;
  const seed = `${input.analysis.title}:${input.targetStyle}:v${variationIndex}:${input.analysis.sourceDurationSeconds}`;
  const candidate = buildAnalysisCandidate(input.analysis);
  const wordBudget = buildWordBudget(maxDurationSeconds, pacing, {
    fillRatio: 0.94,
    minTotalWords: Math.round(maxDurationSeconds * 2.05)
  });
  const subject = sanitizeTitle(input.analysis.title);

  const rawBeats = buildRemixNarrationBeats({
    title: input.analysis.title,
    themeSummary: input.analysis.themeSummary,
    contextKeywords: input.analysis.contextKeywords,
    contentIntelligence: input.analysis.contentIntelligence,
    emotion: productionEmotion,
    seed,
    targetStyle: input.targetStyle,
    variationIndex
  });

  const researchDossier = input.researchDossier ?? input.analysis.researchDossier;
  const lead =
    input.analysis.contentIntelligence.entities[0]?.name ?? subject;
  const finalizeOptions: {
    emotion: ProductionEmotion;
    lead: string;
    seed: string;
    action?: string;
    domain?: RemixContentDomain;
  } = {
    emotion: productionEmotion,
    lead,
    seed
  };
  const primaryAction = input.analysis.contentIntelligence.actions[0]?.label;
  if (primaryAction) {
    finalizeOptions.action = primaryAction;
  }
  finalizeOptions.domain = input.analysis.contentIntelligence.domain;

  const finalizedBeats = ensureNarrationBeatsSafe(
    ensureClimaxCuriosity(
      finalizeNarrationBeats(rawBeats, wordBudget, subject, finalizeOptions),
      input.analysis,
      seed
    ),
    subject
  );
  const injectedBeats = injectResearchCuriositiesIntoBeats(
    finalizedBeats,
    researchDossier,
    input.targetStyle,
    input.selectedCuriosityIds ?? researchDossier?.selectedCuriosityIds,
    input.analysis,
    variationIndex
  );
  const overlapAdjustedBeats = reduceNarrationOverlap(
    injectedBeats.map((beat) => ({
      role: beat.role,
      text: beat.text,
      curiosityTag: beat.curiosityTag,
      ...(beat.prosody ? { prosody: beat.prosody } : {})
    })),
    input.priorVariationScripts ?? [],
    seed
  );
  const narrationBeats = finalizeNarrationBeats(
    overlapAdjustedBeats.map((beat) => ({
      role: beat.role,
      text: beat.text,
      curiosityTag: beat.curiosityTag,
      ...(beat.prosody ? { prosody: beat.prosody } : {})
    })),
    wordBudget,
    subject,
    finalizeOptions
  ).map((beat) => ({
    ...beat,
    caption: beat.caption || buildCaptionFromLine(beat.text),
    curiosityTag:
      beat.role === "climax" && hasConcreteCuriosity(beat.text)
        ? "remix-curiosity-fact"
        : beat.curiosityTag
  }));

  const retentionRefine = applyRetentionRefinementToOverlay({
    legacyBeats: narrationBeats,
    legacyScript: beatsToScript(narrationBeats),
    analysis: input.analysis,
    researchDossier: researchDossier,
    targetStyle: input.targetStyle,
    variationIndex,
    productionEmotion,
    priorVariationScripts: input.priorVariationScripts ?? [],
    priorVariationAngles: input.priorVariationAngles ?? [],
    seed,
    maxDurationSeconds
  });
  const finalNarrationBeats = retentionRefine.narrationBeats;
  const suggestedScript = retentionRefine.suggestedScript;

  const estimatedDurationSeconds = estimateScriptDurationSeconds(suggestedScript, pacing);
  const narrationQuality = validateNarrationScript(suggestedScript);

  const narrationContext = buildNarrationContentContext({
    candidate,
    niche: input.channelDNA.niche,
    emotion: productionEmotion,
    durationSeconds: maxDurationSeconds,
    pacing,
    videoHints: {
      domain: input.analysis.contentIntelligence.domain,
      headline: input.analysis.contentIntelligence.headline,
      summary: input.analysis.contentIntelligence.summary,
      narrativeBrief: input.analysis.contentIntelligence.narrativeBrief,
      narrativeHook: input.analysis.contentIntelligence.narrativeHook,
      curiosityAngle: input.analysis.contentIntelligence.curiosityAngle,
      setting: input.analysis.contentIntelligence.setting,
      entities: input.analysis.contentIntelligence.entities.map((entity) => entity.name),
      ...(input.analysis.contentIntelligence.actions[0]?.label
        ? { primaryAction: input.analysis.contentIntelligence.actions[0].label }
        : {}),
      ...(input.analysis.contentIntelligence.actions[0]?.verb
        ? { primaryActionVerb: input.analysis.contentIntelligence.actions[0].verb }
        : {}),
      themeSummary: input.analysis.themeSummary,
      contextKeywords: input.analysis.contextKeywords,
      mood: input.analysis.contentIntelligence.mood,
      sceneAngles: input.analysis.contentIntelligence.sceneInsights.map((scene) => ({
        role: scene.role,
        angle: scene.narrationAngle,
        focusEntity: scene.focusEntity,
        visualHint: scene.visualHint
      }))
    }
  });

  const narrationStylePrompt = buildNarrationEnginePrompt({
    beats: finalNarrationBeats,
    context: narrationContext,
    channelTone,
    voicePackName: voicePack?.name ?? voicePackHint,
    language,
    pacing,
    estimatedDurationSeconds
  });

  const narrationEnginePlan: NarrationPlan = buildNarrationPlan({
    provider: "mock-tts",
    voicePackId: voicePackHint,
    language,
    text: suggestedScript,
    seed: seed.length * 13
  });

  return {
    language,
    voicePackHint,
    provider: "mock-tts",
    productionEmotion,
    pacing,
    voiceVariations: buildNarrationVoiceVariations({
      voicePackId: voicePackHint,
      channelTone: `${channelTone} remix`,
      emotion: productionEmotion,
      pacing,
      beats: finalNarrationBeats,
      script: suggestedScript
    }),
    hookLine: finalNarrationBeats[0]?.text ?? input.analysis.title,
    narrationBeats: finalNarrationBeats,
    ...(retentionRefine.retentionMetadata
      ? { retentionMetadata: retentionRefine.retentionMetadata }
      : {}),
    narrationContext,
    suggestedScript,
    overlayCaptions: finalNarrationBeats.map((beat) => beat.caption),
    narrationStylePrompt,
    narrationEnginePayload: {
      provider: "mock-tts",
      voicePackId: voicePackHint,
      language,
      autoAttach: false,
      textDraft: suggestedScript,
      styleDirective: narrationStylePrompt,
      beatMap: finalNarrationBeats.map((beat) => ({
        role: beat.role,
        text: beat.text,
        curiosityTag: beat.curiosityTag,
        ...(beat.prosody ? { prosody: beat.prosody } : {})
      }))
    },
    narrationEnginePlan,
    cautionNotes: [
      "Narração reescrita a partir da análise do vídeo — confirme fatos antes de publicar.",
      retentionRefine.retentionMetadata?.usedRetentionEngine
        ? `NarrationRetentionEngine ativa (score ${retentionRefine.retentionMetadata.narrationScore ?? "n/a"}, ângulo ${retentionRefine.retentionMetadata.angle ?? "n/a"}).`
        : retentionRefine.retentionMetadata?.fallbackMode === "partial_upgrade_on_legacy"
          ? `NarrationRetentionEngine fallback parcial: ${retentionRefine.retentionMetadata.fallbackReason ?? "motivo não informado"}.`
          : retentionRefine.retentionAttempted && retentionRefine.retentionMetadata?.fallbackUsed
            ? `NarrationRetentionEngine fallback: ${retentionRefine.retentionMetadata.fallbackReason ?? "motivo não informado"}.`
            : null,
      narrationQuality.valid
        ? "Script narrativo validado sem metadados ou instruções de sistema."
        : `Revisar script: ${narrationQuality.issues.slice(0, 2).join(" | ")}`,
      `Brief: ${input.analysis.contentIntelligence.narrativeBrief}`,
      researchDossier?.rankedCuriosities.length
        ? `Research Collector: ${researchDossier.rankedCuriosities.length} curiosidades (${researchDossier.researchMode}${researchDossier.cacheHit ? ", cache" : ""}).`
        : "Research Collector: sem curiosidades ranqueadas.",
      researchDossier?.selectedCuriosityIds.length
        ? `Curiosidades injetadas: ${researchDossier.selectedCuriosityIds.join(", ")}.`
        : null,
      `Entidades: ${input.analysis.contentIntelligence.entities.map((entity) => entity.name).join(", ") || "não identificadas"}.`,
      `Duração alvo: ${maxDurationSeconds}s (estimativa: ${estimatedDurationSeconds.toFixed(1)}s).`,
      voicePack
        ? `Voice pack '${voicePack.name}' para tom '${voicePack.tone}'.`
        : "Voice pack documental padrão."
    ].filter((note): note is string => Boolean(note))
  };
}

export function rebuildRemixNarrationWithResearch(input: {
  analysis: VideoRemixAnalysis;
  channelDNA: ChannelDNA;
  targetStyle: RemixTargetStyle;
  maxDurationSeconds: number;
  researchDossier: RemixResearchDossier;
  selectedCuriosityIds?: string[];
  narrationBias?: string;
}): NarrationOverlayPlan {
  return buildRemixNarrationOverlayPlan({
    analysis: {
      ...input.analysis,
      researchDossier: input.researchDossier
    },
    channelDNA: input.channelDNA,
    targetStyle: input.targetStyle,
    maxDurationSeconds: input.maxDurationSeconds,
    ...(input.narrationBias ? { narrationBias: input.narrationBias } : {}),
    researchDossier: input.researchDossier,
    ...(input.selectedCuriosityIds || input.researchDossier.selectedCuriosityIds.length
      ? {
          selectedCuriosityIds:
            input.selectedCuriosityIds ?? input.researchDossier.selectedCuriosityIds
        }
      : {})
  });
}