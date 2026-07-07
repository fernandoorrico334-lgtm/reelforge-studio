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
  beatsToScript,
  estimateScriptDurationSeconds,
  resolveNarrationPacingForDuration,
  sanitizeTitle,
  type NarrationBeatDraft,
  type NarrationContentContext
} from "./narration-curiosity-engine.js";
import {
  getNicheProductionProfile,
  resolveProductionEmotion
} from "./niche-production-profiles.js";

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
}

export interface NarrationVoiceVariation {
  variationId: string;
  voicePackId: string;
  tone: string;
  emotion: string;
  pacing: "tight" | "balanced" | "breathing";
  rateShift: number;
  emphasis: "hook" | "context" | "climax" | "cta";
  line: string;
  curiosityTag: string;
  estimatedDurationSeconds: number;
}

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
  narrationStylePrompt: string;
  narrationEnginePayload: {
    provider: "mock-tts";
    voicePackId: string;
    language: string;
    autoAttach: false;
    textDraft: string;
    styleDirective: string;
    beatMap: Array<{
      role: "hook" | "context" | "climax" | "cta";
      text: string;
      curiosityTag: string;
    }>;
  };
  narrationEnginePlan: NarrationPlan;
  cautionNotes: string[];
}

function buildVoiceVariations(input: {
  voicePackId: string;
  channelTone: string;
  emotion: string;
  pacing: "tight" | "balanced" | "breathing";
  beats: NarrationBeat[];
  script: string;
}) {
  const basePlan = buildNarrationPlan({
    voicePackId: input.voicePackId,
    text: input.script,
    language: "pt-BR"
  });

  const pacingRates = {
    tight: [6, 2, 8, 3],
    balanced: [4, 0, 6, 1],
    breathing: [2, -2, 4, -1]
  } as const;

  const rates = pacingRates[input.pacing];
  const variationIds = [
    "hook-tight",
    "context-controlled",
    "climax-push",
    "cta-soft"
  ];
  const toneLabels = ["direto", "documental", "intenso", "fechamento"];
  const durationWeights = [0.28, 0.34, 0.24, 0.14];
  const emotionSuffixes = ["", "_context", "_climax", "_resolve"];

  return input.beats.map((beat, index) => ({
    variationId: variationIds[index] ?? `beat-${index + 1}`,
    voicePackId: input.voicePackId,
    tone: `${input.channelTone} ${toneLabels[index] ?? "neutro"}`,
    emotion: `${input.emotion}${emotionSuffixes[index] ?? ""}`,
    pacing: input.pacing,
    rateShift: rates[index] ?? 0,
    emphasis: beat.role,
    line: beat.text,
    curiosityTag: beat.curiosityTag,
    estimatedDurationSeconds: Math.max(
      basePlan.estimatedDurationSeconds * (durationWeights[index] ?? 0.2),
      beat.role === "cta" ? 1.4 : 2.2
    )
  }));
}

export function buildNarrationOverlayPlan(
  input: NarrationOverlayPlanInput
): NarrationOverlayPlan {
  const language = input.language ?? input.channelDNA?.language ?? "pt-BR";
  const duration = input.maxDurationSeconds ?? 35;
  const channelTone = input.channelTone ?? input.channelDNA?.tone ?? "cinematic explainer";
  const profile = input.channelDNA
    ? getNicheProductionProfile(input.channelDNA.niche)
    : null;
  const productionEmotion = input.channelDNA
    ? resolveProductionEmotion(input.channelDNA.niche, channelTone)
    : "curious";
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
  const seed = String(
    input.candidate.id.length * 17 + (input.channelDNA?.id.length ?? 0) * 13
  );

  const narrationContext = buildNarrationContentContext({
    candidate: input.candidate,
    niche: input.channelDNA?.niche ?? "generic",
    emotion: productionEmotion,
    durationSeconds: duration,
    pacing
  });

  const narrationBeats = buildContextualNarrationBeats({
    candidate: input.candidate,
    niche: input.channelDNA?.niche ?? "generic",
    emotion: productionEmotion,
    durationSeconds: duration,
    pacing,
    seed
  });

  const suggestedScript = beatsToScript(narrationBeats);
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
    seed: Number(seed)
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
    voiceVariations: buildVoiceVariations({
      voicePackId: voicePackHint,
      channelTone,
      emotion: profile?.narrationEmotion ?? productionEmotion,
      pacing,
      beats: narrationBeats,
      script: suggestedScript
    }),
    hookLine,
    narrationBeats,
    narrationContext,
    suggestedScript,
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
        curiosityTag: beat.curiosityTag
      }))
    },
    narrationEnginePlan,
    cautionNotes: [
      "Nao afirmar fatos sensiveis sem fonte confiavel.",
      "Nao narrar como se midia discovery-only fosse asset aprovado.",
      "Nao imitar voz real, celebridade ou personagem.",
      voicePack
        ? `Voice pack '${voicePack.name}' selecionado para tom '${voicePack.tone}'.`
        : "Voice pack padrao documental aplicado."
    ]
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