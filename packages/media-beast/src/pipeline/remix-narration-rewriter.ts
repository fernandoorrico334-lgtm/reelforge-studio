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
  buildRemixNarrationBeats,
  buildWordBudget,
  estimateScriptDurationSeconds,
  finalizeNarrationBeats,
  hasConcreteCuriosity,
  resolveNarrationPacingForDuration,
  sanitizeTitle,
  type NarrationBeatDraft
} from "./narration-curiosity-engine.js";
import {
  getNicheProductionProfile,
  resolveProductionEmotion,
  type ProductionEmotion
} from "./niche-production-profiles.js";
import type { NarrationOverlayPlan } from "./narration-overlay.js";
import type { RemixTargetStyle } from "./remix-types.js";
import type { VideoRemixAnalysis } from "./remix-video-analyzer.js";

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

  const fallback = `Curiosidade: ${lead} viraliza nesse trecho porque ${action.toLowerCase()} esconde um contexto que o clipe original não explica.`;

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
  maxDurationSeconds: number;
  narrationBias?: string;
}): NarrationOverlayPlan {
  const language = input.channelDNA.language ?? "pt-BR";
  const channelTone = input.channelDNA.tone;
  const profile = getNicheProductionProfile(input.channelDNA.niche);
  const productionEmotion = resolveProductionEmotion(
    input.channelDNA.niche,
    channelTone
  ) as ProductionEmotion;
  const pacing = resolveNarrationPacingForDuration(
    input.maxDurationSeconds,
    profile.narrationPacing ?? "balanced"
  );
  const voicePackHint = resolveVoicePackId(
    input.narrationBias ?? input.channelDNA.narrationBias ?? profile.narrationVoicePackId
  );
  const voicePack = getVoicePackById(voicePackHint);
  const seed = `${input.analysis.title}:${input.targetStyle}:${input.analysis.sourceDurationSeconds}`;
  const candidate = buildAnalysisCandidate(input.analysis);
  const wordBudget = buildWordBudget(input.maxDurationSeconds, pacing, {
    fillRatio: 0.94,
    minTotalWords: Math.round(input.maxDurationSeconds * 2.05)
  });

  const rawBeats = buildRemixNarrationBeats({
    title: input.analysis.title,
    themeSummary: input.analysis.themeSummary,
    contextKeywords: input.analysis.contextKeywords,
    contentIntelligence: input.analysis.contentIntelligence,
    emotion: productionEmotion,
    seed
  });

  const narrationBeats = ensureClimaxCuriosity(
    finalizeNarrationBeats(rawBeats, wordBudget, sanitizeTitle(input.analysis.title)),
    input.analysis,
    seed
  ).map((beat) => ({
    ...beat,
    caption: beat.caption || buildCaptionFromLine(beat.text),
    curiosityTag:
      beat.role === "climax" && hasConcreteCuriosity(beat.text)
        ? "remix-curiosity-fact"
        : beat.curiosityTag
  }));

  const suggestedScript = beatsToScript(narrationBeats);
  const estimatedDurationSeconds = estimateScriptDurationSeconds(suggestedScript, pacing);

  const narrationContext = buildNarrationContentContext({
    candidate,
    niche: input.channelDNA.niche,
    emotion: productionEmotion,
    durationSeconds: input.maxDurationSeconds,
    pacing,
    videoHints: {
      domain: input.analysis.contentIntelligence.domain,
      headline: input.analysis.contentIntelligence.headline,
      summary: input.analysis.contentIntelligence.summary,
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
    beats: narrationBeats,
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
    voiceVariations: narrationBeats.map((beat, index) => ({
      variationId: `remix-beat-${index + 1}`,
      voicePackId: voicePackHint,
      tone: `${channelTone} remix`,
      emotion: productionEmotion,
      pacing,
      rateShift: index === 0 ? 3 : index === 2 ? 5 : 0,
      emphasis: beat.role,
      line: beat.text,
      curiosityTag: beat.curiosityTag,
      estimatedDurationSeconds: Math.max(
        estimateScriptDurationSeconds(beat.text, pacing),
        beat.role === "cta" ? 2 : 3
      )
    })),
    hookLine: narrationBeats[0]?.text ?? input.analysis.title,
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
      "Narração reescrita a partir da análise do vídeo — confirme fatos antes de publicar.",
      `Tema: ${input.analysis.themeSummary}`,
      `Entidades: ${input.analysis.contentIntelligence.entities.map((entity) => entity.name).join(", ") || "não identificadas"}.`,
      `Duração alvo: ${input.maxDurationSeconds}s (estimativa: ${estimatedDurationSeconds.toFixed(1)}s).`,
      voicePack
        ? `Voice pack '${voicePack.name}' para tom '${voicePack.tone}'.`
        : "Voice pack documental padrão."
    ]
  };
}