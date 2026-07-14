import {
  buildNarrationPlan,
  getVoicePackById,
  type NarrationPlan
} from "@reelforge/narration-engine";
import type { MediaBeastCandidate } from "../providers/types.js";
import type { ChannelDNA } from "../scheduler/channel-dna.js";
import {
  buildContextualNarrationBeats,
  buildNarrationContentContext,
  buildNarrationEnginePrompt,
  buildNarrationVoiceVariations,
  buildWordBudget,
  beatsToScript,
  ensureNarrationBeatsSafe,
  estimateScriptDurationSeconds,
  hasConcreteCuriosity,
  resolveNarrationPacingForDuration,
  sanitizeTitle,
  validateNarrationScript,
  type NarrationBeatDraft,
  type NarrationBeatRole,
  type NarrationContentContext
} from "./narration-curiosity-engine.js";
import { clampShortDuration } from "./short-production-limits.js";
import {
  getNicheProductionProfile,
  resolveProductionEmotion,
  type ProductionEmotion
} from "./niche-production-profiles.js";
import type { NarrationVariantAngle } from "./narration-retention-packs.js";
import {
  buildRetentionContextFromCandidate,
  resolveTargetStyleFromNiche
} from "./narration-retention-context-bridge.js";
import { applyRetentionRefinementToOverlay } from "./narration-retention-overlay-hook.js";
import type { RemixResearchDossier } from "./remix-research-bridge.js";
import { createChannelDNA } from "../scheduler/channel-dna.js";

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

export type NarrationBeat = NarrationBeatDraft;

export interface NarrationOverlayPlanInput {
  candidate: MediaBeastCandidate;
  channelDNA?: ChannelDNA;
  channelTone?: string;
  language?: string;
  maxDurationSeconds?: number;
  narrationBias?: string;
  variationIndex?: number;
  priorVariationScripts?: string[];
  priorVariationAngles?: NarrationVariantAngle[];
  researchDossier?: RemixResearchDossier | null;
}

export interface NarrationVoiceVariation {
  variationId: string;
  voicePackId: string;
  tone: string;
  emotion: string;
  pacing: "tight" | "balanced" | "breathing";
  rateShift: number;
  emphasis: NarrationBeatRole;
  line: string;
  curiosityTag: string;
  pauseBeforeMs: number;
  energy: "whisper" | "low" | "medium" | "high" | "peak";
  emphasisWords: string[];
  deliveryNote: string;
  estimatedDurationSeconds: number;
}

import type { NarrationRetentionOverlayMetadata } from "./narration-retention-adapter.js";

export interface NarrationOverlayPlan {
  language: string;
  voicePackHint: string;
  provider: "mock-tts" | "windows-sapi-local";
  productionEmotion: string;
  pacing: "tight" | "balanced" | "breathing";
  voiceVariations: NarrationVoiceVariation[];
  hookLine: string;
  narrationBeats: NarrationBeat[];
  narrationContext: NarrationContentContext;
  suggestedScript: string;
  overlayCaptions: string[];
  retentionMetadata?: NarrationRetentionOverlayMetadata;
  narrationStylePrompt: string;
  narrationEnginePayload: {
    provider: "mock-tts";
    voicePackId: string;
    language: string;
    autoAttach: false;
    textDraft: string;
    styleDirective: string;
    beatMap: Array<{
      role: NarrationBeatRole;
      text: string;
      curiosityTag: string;
      prosody?: NarrationBeatDraft["prosody"];
    }>;
  };
  narrationEnginePlan: NarrationPlan;
  cautionNotes: string[];
}

export function buildNarrationOverlayPlan(
  input: NarrationOverlayPlanInput
): NarrationOverlayPlan {
  const language = input.language ?? input.channelDNA?.language ?? "pt-BR";
  const duration = clampShortDuration(input.maxDurationSeconds ?? 35);
  const channelTone = input.channelTone ?? input.channelDNA?.tone ?? "cinematic explainer";
  const profile = input.channelDNA
    ? getNicheProductionProfile(input.channelDNA.niche)
    : null;
  const productionEmotion = (
    input.channelDNA
      ? resolveProductionEmotion(input.channelDNA.niche, channelTone)
      : "curious"
  ) as ProductionEmotion;
  const pacing = resolveNarrationPacingForDuration(
    duration,
    profile?.narrationPacing ?? "balanced"
  );
  const voicePackHint = resolveVoicePackId(
    input.narrationBias ??
      input.channelDNA?.narrationBias ??
      profile?.narrationVoicePackId ??
      "documentary_ptbr"
  );
  const voicePack = getVoicePackById(voicePackHint);
  const seed = `${input.candidate.id}:${input.channelDNA?.tone ?? channelTone}:${productionEmotion}`;

  const narrationContext = buildNarrationContentContext({
    candidate: input.candidate,
    niche: input.channelDNA?.niche ?? "generic",
    emotion: productionEmotion,
    durationSeconds: duration,
    pacing
  });

  const subject = sanitizeTitle(input.candidate.title) || "esse assunto";
  const wordBudget = buildWordBudget(duration, pacing, {
    fillRatio: 0.93,
    minTotalWords: Math.round(duration * 2)
  });

  const legacyBeats = ensureNarrationBeatsSafe(
    buildContextualNarrationBeats({
      candidate: input.candidate,
      niche: input.channelDNA?.niche ?? "generic",
      emotion: productionEmotion,
      durationSeconds: duration,
      pacing,
      seed,
      videoHints: narrationContext.videoHints
    }),
    subject
  );

  const legacyScript = beatsToScript(legacyBeats);
  const fallbackNiche = input.channelDNA?.niche ?? "generic_broll";
  const effectiveChannelDNA =
    input.channelDNA ??
    createChannelDNA({
      id: `overlay-${input.candidate.id}`,
      name: "Overlay Channel",
      niche: fallbackNiche,
      tone: channelTone,
      language,
      narrationBias: voicePackHint
    });
  const targetStyle = resolveTargetStyleFromNiche(
    effectiveChannelDNA.niche,
    narrationContext.videoHints
  );
  const retentionAnalysis = buildRetentionContextFromCandidate({
    candidate: input.candidate,
    channelDNA: effectiveChannelDNA,
    narrationContext,
    legacyBeats,
    ...(input.researchDossier !== undefined ? { researchDossier: input.researchDossier } : {}),
    maxDurationSeconds: duration
  });
  const retentionRefine = applyRetentionRefinementToOverlay({
    legacyBeats,
    legacyScript,
    analysis: retentionAnalysis,
    targetStyle,
    productionEmotion,
    maxDurationSeconds: duration,
    seed,
    ...(input.variationIndex !== undefined ? { variationIndex: input.variationIndex } : {}),
    ...(input.priorVariationScripts ? { priorVariationScripts: input.priorVariationScripts } : {}),
    ...(input.priorVariationAngles ? { priorVariationAngles: input.priorVariationAngles } : {}),
    ...(input.researchDossier !== undefined ? { researchDossier: input.researchDossier } : {})
  });

  const narrationBeats = retentionRefine.narrationBeats;
  const suggestedScript = retentionRefine.suggestedScript;
  const narrationQuality = validateNarrationScript(suggestedScript);
  const climaxBeat = narrationBeats.find((beat) => beat.role === "climax");
  const estimatedDurationSeconds = estimateScriptDurationSeconds(suggestedScript, pacing);

  const narrationStylePrompt = buildNarrationEnginePrompt({
    beats: narrationBeats,
    context: narrationContext,
    channelTone,
    voicePackName: voicePack?.name ?? voicePackHint,
    language,
    pacing,
    estimatedDurationSeconds
  });

  const narrationEnginePlan = buildNarrationPlan({
    provider: "mock-tts",
    voicePackId: voicePackHint,
    language,
    text: suggestedScript,
    seed: seed.split("").reduce((acc, char) => acc + char.charCodeAt(0) * 17, 0)
  });

  const hookLine =
    narrationBeats[0]?.text ??
    (sanitizeTitle(input.candidate.title) || "esse assunto");

  return {
    language,
    voicePackHint,
    provider: "mock-tts",
    productionEmotion,
    pacing,
    voiceVariations: buildNarrationVoiceVariations({
      voicePackId: voicePackHint,
      channelTone,
      emotion: productionEmotion,
      pacing,
      beats: narrationBeats,
      script: suggestedScript
    }),
    hookLine: narrationBeats[0]?.text ?? hookLine,
    narrationBeats,
    narrationContext,
    suggestedScript,
    ...(retentionRefine.retentionMetadata
      ? { retentionMetadata: retentionRefine.retentionMetadata }
      : {}),
    overlayCaptions: narrationBeats.map((beat) => beat.caption),
    narrationStylePrompt,
    narrationEnginePayload: {
      provider: "mock-tts",
      voicePackId: voicePackHint,
      language,
      autoAttach: false,
      textDraft: suggestedScript,
      styleDirective: narrationStylePrompt,
      beatMap: narrationBeats.map((beat) => ({
        role: beat.role,
        text: beat.text,
        curiosityTag: beat.curiosityTag,
        ...(beat.prosody ? { prosody: beat.prosody } : {})
      }))
    },
    narrationEnginePlan,
    cautionNotes: [
      "Nao afirmar fatos sensiveis sem fonte confiavel.",
      "Nao narrar como se midia discovery-only fosse asset aprovado.",
      "Nao imitar voz real, celebridade ou personagem.",
      retentionRefine.retentionMetadata?.usedRetentionEngine
        ? `NarrationRetentionEngine ativa (score ${retentionRefine.retentionMetadata.narrationScore ?? "n/a"}, angulo ${retentionRefine.retentionMetadata.angle ?? "n/a"}).`
        : retentionRefine.retentionMetadata?.fallbackMode === "partial_upgrade_on_legacy"
          ? `NarrationRetentionEngine fallback parcial: ${retentionRefine.retentionMetadata.fallbackReason ?? "motivo nao informado"}.`
          : retentionRefine.retentionAttempted && retentionRefine.retentionMetadata?.fallbackUsed
            ? `NarrationRetentionEngine fallback: ${retentionRefine.retentionMetadata.fallbackReason ?? "motivo nao informado"}.`
            : null,
      narrationQuality.valid
        ? "Script narrativo validado sem metadados ou instrucoes de sistema."
        : `Revisar script: ${narrationQuality.issues.slice(0, 2).join(" | ")}`,
      climaxBeat && hasConcreteCuriosity(climaxBeat.text)
        ? "Climax com curiosidade concreta detectada."
        : "Climax editorial — considere reforcar fato surpreendente.",
      `Budget alvo: ${Object.values(wordBudget).reduce((sum, value) => sum + value, 0)} palavras para ${duration}s.`,
      voicePack
        ? `Voice pack '${voicePack.name}' selecionado para tom '${voicePack.tone}'.`
        : "Voice pack padrao documental aplicado."
    ].filter((note): note is string => Boolean(note))
  };
}

export function buildChannelNarrationOverlay(
  candidate: MediaBeastCandidate,
  channelDNA: ChannelDNA,
  maxDurationSeconds = 35
): NarrationOverlayPlan {
  return buildNarrationOverlayPlan({
    candidate,
    channelDNA,
    channelTone: channelDNA.tone,
    language: channelDNA.language,
    maxDurationSeconds,
    narrationBias: channelDNA.narrationBias
  });
}