import {
  buildBeatProsody,
  shortenForSpeech,
  type NarrationBeatDraft,
  type NarrationBeatRole
} from "./narration-curiosity-engine.js";
import type { RemixResearchDossier } from "./remix-research-bridge.js";
import type { VideoRemixAnalysis } from "./remix-video-analyzer.js";
import type { ProductionEmotion } from "./niche-production-profiles.js";
import type { RemixTargetStyle } from "./remix-types.js";
import {
  applyAntiClicheFilter,
  beatsToRetentionScript,
  classifyNarrationSubject,
  findForbiddenPhrases,
  getNarrationStylePack,
  scoreNarrationForShorts,
  tokenOverlap,
  type NarrationRetentionInput,
  type NarrationRetentionScore,
  type NarrationRetentionScoreBreakdown,
  type NarrationVariantAngle,
  type RetentionBeatMetadata,
  type RetentionBeatRole
} from "./narration-retention-engine.js";
import {
  RETENTION_BEAT_TIMINGS,
  VARIANT_ANGLE_ORDER,
  type NarrationStylePack
} from "./narration-retention-packs.js";
import {
  findRawActionLabelsInText,
  oralizeActionLabelsInNarration,
  oralizeNarrationBeats
} from "./narration-action-oralization.js";
import type { CaptionDirectionResult } from "./caption-direction-engine.js";
import {
  applyNarrationUpgrades,
  applyPartialUpgradesOnLegacy
} from "./narration-upgrades-pipeline.js";
import type { TruthGuardResult } from "./narration-truth-guard.js";
import {
  buildAuthorizedNarrationContext,
  isAuthorizedEntity,
  normalizePhrase
} from "./narration-truth-guard.js";
import type { BeatDurationSeverity, SpeechTimingResult } from "./speech-timing-optimizer.js";
import { sanitizeNarrationForSpeech } from "./narration-pad-sanitizer.js";
import {
  estimateSpeechDurationPtBr,
  validateBeatTimingSoft
} from "./speech-timing-optimizer.js";

export const RETENTION_SCORE_THRESHOLD = 82;

const SAFE_LOOP_BRIDGES = [
  "Reassistindo, o gancho pesa diferente.",
  "Comenta qual dupla você curtiu mais nessa cena."
];

const SAFE_SHORT_PADS: string[] = [];

const STYLE_ANGLE_PREFERENCE: Partial<Record<RemixTargetStyle, NarrationVariantAngle[]>> = {
  documentary: ["factual_documental", "simple_explanatory", "controlled_controversy"],
  dark_cinematic: ["suspense_reveal", "factual_documental", "quick_curiosity"],
  horror: ["suspense_reveal", "quick_curiosity", "fan_lore"],
  true_crime: ["suspense_reveal", "factual_documental", "controlled_controversy"],
  hype_sports: ["quick_curiosity", "fan_lore", "factual_documental"],
  vintage_football: ["fan_lore", "quick_curiosity", "factual_documental"],
  anime: ["fan_lore", "suspense_reveal", "quick_curiosity"],
  comics: ["fan_lore", "quick_curiosity", "factual_documental"],
  bodybuilding: ["factual_documental", "quick_curiosity", "simple_explanatory"],
  generic: ["factual_documental", "quick_curiosity", "simple_explanatory"]
};

const RETENTION_TO_LEGACY: Record<RetentionBeatRole, NarrationBeatRole> = {
  hook: "hook",
  promise_context: "context",
  curiosity: "tension",
  development: "tension",
  climax_reveal: "climax",
  loop_closing: "cta"
};

export type NarrationFallbackMode =
  | "none"
  | "partial_upgrade_on_legacy"
  | "full_legacy"
  | "hard_fallback";

export interface AllowedFactsCorpus {
  tokens: Set<string>;
  phrases: string[];
  years: Set<string>;
  numbers: Set<string>;
  authorizedEntities: string[];
}

export interface NarrationRetentionOverlayMetadata {
  retentionEngineEnabled: boolean;
  retentionEngineAttempted?: boolean;
  usedRetentionEngine: boolean;
  fallbackUsed: boolean;
  fallbackMode?: NarrationFallbackMode;
  fallbackReason?: string;
  upgradesAppliedOnFallback?: {
    truthGuard: boolean;
    timing: boolean;
    captionDirection: boolean;
  };
  rawActionLabelsFound?: string[];
  narrationScore?: number;
  scoreBreakdown?: NarrationRetentionScoreBreakdown;
  forbiddenPhrasesFound?: string[];
  estimatedDurationSec?: number;
  beats?: RetentionBeatMetadata[];
  voiceMetadata?: {
    energyLevel: NarrationStylePack["energyLevel"];
    narrativeTone: string;
    idealPace: NarrationStylePack["idealPace"];
    curiosityType: string;
  };
  variationOverlap?: number;
  angleUniquenessScore?: number;
  angle?: NarrationVariantAngle;
  truthGuard?: TruthGuardResult;
  speechTiming?: SpeechTimingResult;
  captionDirection?: CaptionDirectionResult;
  upgradeWarnings?: string[];
}

export interface RemixRetentionRefineInput {
  legacyBeats: NarrationBeatDraft[];
  legacyScript: string;
  analysis: VideoRemixAnalysis;
  researchDossier?: RemixResearchDossier | null;
  targetStyle: RemixTargetStyle;
  variationIndex: number;
  productionEmotion: ProductionEmotion;
  priorVariationScripts: string[];
  priorVariationAngles: NarrationVariantAngle[];
  seed: string;
  maxDurationSeconds: number;
}

export interface RemixRetentionRefineResult {
  usedRetentionEngine: boolean;
  fallbackUsed: boolean;
  fallbackReason?: string;
  narrationBeats: NarrationBeatDraft[];
  suggestedScript: string;
  metadata: NarrationRetentionOverlayMetadata;
}

export function isNarrationRetentionEngineEnabled(): boolean {
  return process.env.ENABLE_NARRATION_RETENTION_ENGINE === "true";
}

export { estimateSpeechDurationPtBr } from "./speech-timing-optimizer.js";

function normalizeToken(token: string): string {
  return token
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function extractYears(text: string): string[] {
  return [...text.matchAll(/\b(1[6-9]\d{2}|20\d{2})\b/g)].map((match) => match[1]!);
}

function extractNumbers(text: string): string[] {
  return [...text.matchAll(/\b\d+(?:[.,]\d+)?\b/g)].map((match) => match[0]!);
}

function extractSignificantTokens(text: string): string[] {
  return text
    .split(/\s+/)
    .map((word) => normalizeToken(word.replace(/[,.!?;:]/g, "")))
    .filter((token) => token.length > 3);
}

const COMMON_PT_TOKENS = new Set([
  "esse",
  "essa",
  "isso",
  "aqui",
  "onde",
  "quando",
  "porque",
  "sobre",
  "mesmo",
  "ainda",
  "agora",
  "depois",
  "antes",
  "detalhe",
  "cena",
  "video",
  "clipe",
  "momento",
  "historia",
  "fato",
  "ponto",
  "parte",
  "trecho",
  "abertura",
  "comeco",
  "final",
  "repara",
  "volta",
  "comenta",
  "fica",
  "olha",
  "vamos",
  "entender",
  "revela",
  "virada"
]);

export function buildAllowedFactsCorpus(
  sources: string[],
  authorizedEntities: string[] = []
): AllowedFactsCorpus {
  const joined = sources.filter(Boolean).join(" ");
  const tokens = new Set<string>();
  const years = new Set<string>();
  const numbers = new Set<string>();

  for (const token of extractSignificantTokens(joined)) {
    tokens.add(token);
  }
  for (const entity of authorizedEntities) {
    const normalized = normalizePhrase(entity);
    tokens.add(normalized.replace(/\s+/g, ""));
    for (const part of normalized.split(/\s+/)) {
      const token = normalizeToken(part);
      if (token.length > 2) tokens.add(token);
    }
  }
  for (const year of extractYears(joined)) {
    years.add(year);
    tokens.add(year);
  }
  for (const number of extractNumbers(joined)) {
    numbers.add(number);
    tokens.add(normalizeToken(number));
  }

  return {
    tokens,
    phrases: sources.filter((entry) => entry.trim().length > 8),
    years,
    numbers,
    authorizedEntities
  };
}

export function detectHallucinations(text: string, corpus: AllowedFactsCorpus): string[] {
  const issues: string[] = [];

  for (const year of extractYears(text)) {
    if (!corpus.years.has(year)) {
      issues.push(`ano não permitido: ${year}`);
    }
  }

  for (const number of extractNumbers(text)) {
    const normalized = normalizeToken(number);
    if (!corpus.numbers.has(number) && !corpus.tokens.has(normalized)) {
      issues.push(`número não permitido: ${number}`);
    }
  }

  const properMatches = [
    ...text.matchAll(/\b([A-ZÀ-Ú][a-zà-ú]+(?:[-/][A-ZÀ-Ú]?[a-zà-ú]+)*)\b/g)
  ];
  for (const proper of properMatches) {
    const name = proper[1]!;
    if (isAuthorizedEntity(name, corpus.authorizedEntities)) {
      continue;
    }
    const token = normalizeToken(name);
    if (!corpus.tokens.has(token) && !COMMON_PT_TOKENS.has(token)) {
      issues.push(`nome próprio não permitido: ${name}`);
    }
  }

  return issues;
}

export function validateBeatDurationFit(
  beat: RetentionBeatMetadata,
  wpm = 160
): { ok: boolean; estimatedSec: number; expectedSec: number; ratio: number } {
  const expectedSec = beat.timing.endSec - beat.timing.startSec;
  const estimatedSec = estimateSpeechDurationPtBr(beat.text, wpm);
  const ratio = expectedSec > 0 ? estimatedSec / expectedSec : 1;
  const maxRatio =
    beat.role === "loop_closing" ? 2.2 : expectedSec >= 8 ? 1.65 : 1.45;
  const minRatio = beat.role === "loop_closing" ? 0.2 : 0.35;
  return {
    ok: ratio >= minRatio && ratio <= maxRatio,
    estimatedSec,
    expectedSec,
    ratio
  };
}

function maxWordsForBeat(role: RetentionBeatRole, wpm = 160): number {
  const windowSec = RETENTION_BEAT_TIMINGS[role].endSec - RETENTION_BEAT_TIMINGS[role].startSec;
  return Math.max(4, Math.round((windowSec / 60) * wpm * 1.25));
}

function minWordsForBeat(role: RetentionBeatRole, wpm = 160): number {
  const windowSec = RETENTION_BEAT_TIMINGS[role].endSec - RETENTION_BEAT_TIMINGS[role].startSec;
  return Math.max(3, Math.round((windowSec / 60) * wpm * 0.35));
}

export function fitBeatTextToDuration(
  text: string,
  role: RetentionBeatRole,
  corpus: AllowedFactsCorpus,
  wpm = 160
): string {
  let fitted = applyAntiClicheFilter(text);
  const maxWords = maxWordsForBeat(role, wpm);
  const minWords = minWordsForBeat(role, wpm);
  const words = fitted.split(/\s+/).filter(Boolean);

  if (words.length > maxWords) {
    fitted = shortenForSpeech(fitted, maxWords);
  }

  let fittedWords = fitted.split(/\s+/).filter(Boolean);
  if (fittedWords.length < minWords) {
    const pads = role === "loop_closing" ? SAFE_LOOP_BRIDGES : SAFE_SHORT_PADS;
    for (const pad of pads) {
      if (role === "loop_closing" && /\bcomenta\b/i.test(fitted)) continue;
      if (detectHallucinations(pad, corpus).length > 0) continue;
      const candidate = `${fitted} ${pad}`.trim();
      if (detectHallucinations(candidate, corpus).length === 0) {
        fitted = candidate;
        fittedWords = fitted.split(/\s+/).filter(Boolean);
        if (fittedWords.length >= minWords) break;
      }
    }
  }

  return sanitizeNarrationForSpeech(fitted.trim());
}

function splitSentences(text: string): string[] {
  return text.split(/(?<=[.!?])\s+/).filter(Boolean);
}

function legacyBeatMap(beats: NarrationBeatDraft[]): Map<NarrationBeatRole, NarrationBeatDraft> {
  return new Map(beats.map((beat) => [beat.role, beat]));
}

export function mapLegacyBeatsToRetention(
  legacyBeats: NarrationBeatDraft[],
  input: NarrationRetentionInput,
  angle: NarrationVariantAngle,
  pack: NarrationStylePack,
  corpus: AllowedFactsCorpus
): RetentionBeatMetadata[] {
  const byRole = legacyBeatMap(legacyBeats);
  const pace =
    pack.idealPace === "slow" ? "slow" : pack.idealPace === "fast" ? "fast" : "medium";
  const emotion = pack.narrativeTone;

  const contextText = byRole.get("context")?.text ?? "";
  const tensionText = byRole.get("tension")?.text ?? "";
  const contextSentences = splitSentences(contextText);
  const tensionSentences = splitSentences(tensionText);

  const developmentSource = shortenForSpeech(
    contextSentences.length > 1
      ? contextSentences.slice(1).join(" ")
      : tensionSentences.length > 1
        ? tensionSentences[0]!
        : contextText || tensionText,
    maxWordsForBeat("development")
  );

  const sourceByRetention: Record<RetentionBeatRole, string> = {
    hook: byRole.get("hook")?.text ?? "",
    promise_context: contextSentences[0] ?? contextText,
    curiosity: tensionSentences[0] ?? (tensionText || contextSentences[0] || contextText),
    development: developmentSource,
    climax_reveal: byRole.get("climax")?.text ?? "",
    loop_closing: byRole.get("cta")?.text ?? ""
  };

  return (Object.keys(RETENTION_BEAT_TIMINGS) as RetentionBeatRole[]).map((role) => {
    const rawText = sourceByRetention[role] || legacyBeats[0]?.text || "";
    const text = fitBeatTextToDuration(rawText, role, corpus);
    const timing = RETENTION_BEAT_TIMINGS[role];
    return {
      role,
      text,
      emotion,
      pace,
      pauseAfterMs: Math.round(
        (role === "hook" ? 120 : role === "loop_closing" ? 180 : 260) *
          (pace === "slow" ? 1.3 : pace === "fast" ? 0.8 : 1)
      ),
      emphasisWords: text
        .split(/\s+/)
        .filter((word) => /^[A-ZÀ-Ú]/.test(word) || /\d/.test(word))
        .slice(0, 4)
        .map((word) => word.replace(/[,.!?;:]/g, "")),
      captionWords: text.split(/\s+/).slice(0, 7).map((w) => w.replace(/[,.!?;:]/g, "")),
      visualCue: input.visualHints?.[0]
        ? `Sincronizar com ${input.visualHints[0]}`
        : `Sincronizar com ${input.subject}`,
      retentionGoal: timing.retentionGoal,
      timing: { startSec: timing.startSec, endSec: timing.endSec }
    };
  });
}

export function adaptRetentionBeatsToNarrationBeats(
  retentionBeats: RetentionBeatMetadata[],
  emotion: ProductionEmotion,
  curiosityTags: Partial<Record<NarrationBeatRole, string>> = {}
): NarrationBeatDraft[] {
  const mergedTension = [
    retentionBeats.find((beat) => beat.role === "curiosity")?.text ?? "",
    retentionBeats.find((beat) => beat.role === "development")?.text ?? ""
  ]
    .filter(Boolean)
    .join(" ")
    .trim();

  const roleText: Partial<Record<NarrationBeatRole, string>> = {};
  const hookText = retentionBeats.find((beat) => beat.role === "hook")?.text;
  const contextText = retentionBeats.find((beat) => beat.role === "promise_context")?.text;
  const climaxText = retentionBeats.find((beat) => beat.role === "climax_reveal")?.text;
  const ctaText = retentionBeats.find((beat) => beat.role === "loop_closing")?.text;
  if (hookText) roleText.hook = hookText;
  if (contextText) roleText.context = contextText;
  if (mergedTension) roleText.tension = mergedTension;
  if (climaxText) roleText.climax = climaxText;
  if (ctaText) roleText.cta = ctaText;

  const order: NarrationBeatRole[] = ["hook", "context", "tension", "climax", "cta"];
  return order
    .filter((role) => Boolean(roleText[role]?.trim()))
    .map((role) => {
      const text = sanitizeNarrationForSpeech(roleText[role]!.trim());
      return {
        role,
        text,
        caption: text.split(/\s+/).slice(0, 7).join(" "),
        curiosityTag: curiosityTags[role] ?? `retention-${role}`,
        prosody: buildBeatProsody(role, emotion, text)
      };
    });
}

export function resolveUniqueVariationAngle(
  variationIndex: number,
  targetStyle: RemixTargetStyle,
  priorAngles: NarrationVariantAngle[]
): { angle: NarrationVariantAngle; angleUniquenessScore: number } {
  const preferred = STYLE_ANGLE_PREFERENCE[targetStyle] ?? STYLE_ANGLE_PREFERENCE.generic!;
  const pool = [
    ...preferred,
    ...VARIANT_ANGLE_ORDER.filter((angle) => !preferred.includes(angle))
  ];

  const taken = new Set(priorAngles);
  let angle =
    pool.find((candidate) => !taken.has(candidate)) ??
    pool[variationIndex % pool.length] ??
    "factual_documental";

  if (taken.has(angle)) {
    angle =
      VARIANT_ANGLE_ORDER.find((candidate) => !taken.has(candidate)) ??
      VARIANT_ANGLE_ORDER[variationIndex % VARIANT_ANGLE_ORDER.length]!;
  }

  const duplicateCount = priorAngles.filter((entry) => entry === angle).length;
  const angleUniquenessScore = Math.max(20, 100 - duplicateCount * 45 - taken.size * 5);

  return { angle, angleUniquenessScore };
}

export function buildRemixRetentionInput(
  analysis: VideoRemixAnalysis,
  researchDossier?: RemixResearchDossier | null,
  seed?: string,
  maxDurationSeconds?: number
): NarrationRetentionInput {
  const intel = analysis.contentIntelligence;
  const topCuriosity = researchDossier?.rankedCuriosities?.[0]?.text;
  const primaryAction = intel.actions[0]?.label;
  return {
    subject: analysis.title,
    headline: intel.headline,
    summary: intel.summary ?? analysis.themeSummary,
    entities: intel.entities.map((entity) => entity.name),
    ...(topCuriosity || intel.curiosityAngle
      ? { curiosityFact: topCuriosity ?? intel.curiosityAngle ?? undefined }
      : {}),
    ...(primaryAction ? { primaryAction } : {}),
    visualHints: intel.sceneInsights
      .map((scene) => scene.visualHint)
      .filter((hint): hint is string => Boolean(hint)),
    ...(maxDurationSeconds !== undefined ? { targetDurationSeconds: maxDurationSeconds } : {}),
    ...(seed ? { seed } : {})
  };
}

export function buildRemixAuthorizedFacts(
  analysis: VideoRemixAnalysis,
  legacyBeats: NarrationBeatDraft[],
  researchDossier?: RemixResearchDossier | null
): string[] {
  const intel = analysis.contentIntelligence;
  return [
    analysis.title,
    analysis.themeSummary,
    intel.headline,
    intel.summary,
    intel.narrativeBrief,
    intel.narrativeHook,
    intel.curiosityAngle,
    ...intel.entities.map((entity) => entity.name),
    ...intel.actions.map((action) => action.label),
    ...analysis.contextKeywords,
    ...legacyBeats.map((beat) => beat.text),
    ...intel.sceneInsights
      .map((scene) => scene.visualHint)
      .filter((hint): hint is string => Boolean(hint)),
    ...(researchDossier?.rankedCuriosities?.map((entry) => entry.text) ?? [])
  ].filter(Boolean);
}

export function buildRemixAllowedFactsCorpus(
  analysis: VideoRemixAnalysis,
  legacyBeats: NarrationBeatDraft[],
  researchDossier?: RemixResearchDossier | null
): AllowedFactsCorpus {
  const intel = analysis.contentIntelligence;
  const curiosityFacts = researchDossier?.rankedCuriosities?.map((entry) => entry.text) ?? [];
  const authorizedContext = buildAuthorizedNarrationContext({
    facts: buildRemixAuthorizedFacts(analysis, legacyBeats, researchDossier),
    curiosityFacts,
    visualDescription: intel.sceneInsights
      .map((scene) => scene.visualHint)
      .filter((hint): hint is string => Boolean(hint))
      .join("; "),
    allowedContext: [intel.narrativeBrief, analysis.themeSummary].filter(
      (entry): entry is string => Boolean(entry)
    ),
    contentIntelligence: intel,
    topic: analysis.title,
    title: analysis.title,
    tags: analysis.contextKeywords
  });
  const sources = [
    analysis.title,
    analysis.themeSummary,
    intel.headline,
    intel.summary,
    intel.narrativeBrief,
    intel.narrativeHook,
    intel.curiosityAngle,
    ...intel.entities.map((entity) => entity.name),
    ...intel.actions.map((action) => action.label),
    ...analysis.contextKeywords,
    ...legacyBeats.map((beat) => beat.text),
    ...curiosityFacts,
    ...authorizedContext
  ];
  return buildAllowedFactsCorpus(sources, authorizedContext);
}

function maxVariationOverlap(script: string, priorScripts: string[]): number {
  if (priorScripts.length === 0) return 0;
  return Math.max(...priorScripts.map((prior) => tokenOverlap(prior, script)));
}

function retentionBeatsToTimingBeats(beats: RetentionBeatMetadata[]) {
  return beats.map((beat, index) => ({
    id: `${beat.role}-${index}`,
    role: beat.role,
    text: beat.text,
    timing: beat.timing,
    pace:
      beat.pace === "slow" ? ("slow" as const) : beat.pace === "fast" ? ("fast" as const) : ("normal" as const),
    pauseAfterMs: beat.pauseAfterMs
  }));
}

function applyTimingCorrectionsToRetention(
  beats: RetentionBeatMetadata[],
  corrected: ReturnType<typeof validateBeatTimingSoft>["correctedBeats"]
): RetentionBeatMetadata[] {
  return beats.map((beat, index) => {
    const timed =
      corrected.find((entry) => entry.role === beat.role && entry.id === `${beat.role}-${index}`) ??
      corrected.find((entry) => entry.role === beat.role);
    if (!timed) return beat;
    return {
      ...beat,
      text: timed.text,
      pauseAfterMs: timed.pauseAfterMs ?? beat.pauseAfterMs,
      pace: timed.pace === "slow" ? "slow" : timed.pace === "fast" ? "fast" : "medium"
    };
  });
}

function validateRetentionBeatSet(
  beats: RetentionBeatMetadata[],
  corpus: AllowedFactsCorpus,
  legacyBeats: NarrationBeatDraft[],
  targetDurationSec: number
): {
  error: string | null;
  beats: RetentionBeatMetadata[];
  timingWarnings: string[];
  timingSeverity: BeatDurationSeverity;
} {
  if (beats.length !== 6) {
    return {
      error: "beats_retention_incompletos",
      beats,
      timingWarnings: [],
      timingSeverity: "blocking"
    };
  }
  if (beats.some((beat) => !beat.text.trim())) {
    return {
      error: "beat_vazio",
      beats,
      timingWarnings: [],
      timingSeverity: "blocking"
    };
  }

  const oralizedBeats = oralizeNarrationBeats(beats);
  const timing = validateBeatTimingSoft({
    beats: retentionBeatsToTimingBeats(oralizedBeats),
    targetDurationSec,
    wpm: 155
  });
  let workingBeats = applyTimingCorrectionsToRetention(oralizedBeats, timing.correctedBeats);

  const legacyByRole = legacyBeatMap(legacyBeats);
  for (const beat of workingBeats) {
    const hallucinations = detectHallucinations(beat.text, corpus);
    if (hallucinations.length > 0) {
      return {
        error: `hallucination_${beat.role}`,
        beats: workingBeats,
        timingWarnings: timing.warnings,
        timingSeverity: timing.severity
      };
    }
    if (beat.role === "loop_closing") {
      continue;
    }

    const legacySources =
      beat.role === "development"
        ? [
            legacyByRole.get("context")?.text ?? "",
            legacyByRole.get("tension")?.text ?? ""
          ].filter(Boolean)
        : [legacyByRole.get(RETENTION_TO_LEGACY[beat.role])?.text ?? ""].filter(Boolean);

    if (legacySources.length === 0) {
      continue;
    }

    const maxSourceOverlap = Math.max(
      ...legacySources.map((source) => tokenOverlap(source, beat.text))
    );
    if (maxSourceOverlap < 0.2) {
      return {
        error: `desvio_fonte_${beat.role}`,
        beats: workingBeats,
        timingWarnings: timing.warnings,
        timingSeverity: timing.severity
      };
    }
  }

  if (!timing.ok && timing.severity === "blocking") {
    const longBeat = workingBeats.find((beat) => {
      const limits = RETENTION_BEAT_TIMINGS[beat.role];
      const window = limits.endSec - limits.startSec;
      const estimated = estimateSpeechDurationPtBr(beat.text);
      return window > 0 && estimated / window > 1.45;
    });
    return {
      error: `beat_duration_${longBeat?.role ?? "development"}`,
      beats: workingBeats,
      timingWarnings: timing.warnings,
      timingSeverity: timing.severity
    };
  }

  return {
    error: null,
    beats: workingBeats,
    timingWarnings: timing.warnings,
    timingSeverity: timing.severity
  };
}

function buildPartialFallbackResult(input: {
  input: RemixRetentionRefineInput;
  baseMetadata: NarrationRetentionOverlayMetadata;
  fallbackReason: string;
  retentionInput: NarrationRetentionInput;
  subjectCategory: ReturnType<typeof classifyNarrationSubject>;
  authorizedFacts: string[];
  visualDescription?: string;
  retentionBeats?: RetentionBeatMetadata[];
  score?: NarrationRetentionScore;
  angle?: NarrationVariantAngle;
  angleUniquenessScore?: number;
  variationOverlap?: number;
  stylePack: NarrationStylePack;
}): RemixRetentionRefineResult {
  const oralizedLegacyBeats = oralizeNarrationBeats(input.input.legacyBeats);
  const oralizedLegacyScript = oralizeActionLabelsInNarration(input.input.legacyScript);

  try {
    const partial = applyPartialUpgradesOnLegacy({
      legacyBeats: oralizedLegacyBeats,
      legacyScript: oralizedLegacyScript,
      facts: input.authorizedFacts,
      topic: input.retentionInput.subject,
      ...(input.visualDescription ? { visualDescription: input.visualDescription } : {}),
      allowedContext: [
        input.input.analysis.contentIntelligence.narrativeBrief,
        input.input.analysis.themeSummary
      ].filter((entry): entry is string => Boolean(entry)),
      targetDurationSec: input.input.maxDurationSeconds,
      subjectCategory: input.subjectCategory,
      truthStrictness: input.subjectCategory === "juridico_bancario" ? "high" : "medium",
      targetStyle: input.input.targetStyle
    });

    const finalScript = partial.finalScript.trim();
    const rawActionLabelsFound = findRawActionLabelsInText(finalScript);
    const hardTruthRisk =
      partial.truthGuard.score < 40 ||
      partial.truthGuard.issues.some(
        (issue) => issue.severity === "high" && issue.type === "invented_date"
      );

    if (!finalScript || hardTruthRisk) {
      return {
        usedRetentionEngine: false,
        fallbackUsed: true,
        fallbackReason: hardTruthRisk
          ? "truth_guard_risco_alto"
          : input.fallbackReason,
        narrationBeats: oralizedLegacyBeats,
        suggestedScript: oralizedLegacyScript,
        metadata: {
          ...input.baseMetadata,
          retentionEngineAttempted: true,
          fallbackUsed: true,
          fallbackMode: "full_legacy",
          fallbackReason: hardTruthRisk ? "truth_guard_risco_alto" : input.fallbackReason,
          ...(input.score?.total !== undefined ? { narrationScore: input.score.total } : {}),
          ...(input.score?.breakdown ? { scoreBreakdown: input.score.breakdown } : {}),
          ...(input.score?.forbiddenPhrasesFound
            ? { forbiddenPhrasesFound: input.score.forbiddenPhrasesFound }
            : {}),
          ...(input.retentionBeats ? { beats: input.retentionBeats } : {}),
          ...(input.angle ? { angle: input.angle } : {}),
          ...(input.angleUniquenessScore !== undefined
            ? { angleUniquenessScore: input.angleUniquenessScore }
            : {}),
          ...(input.variationOverlap !== undefined
            ? { variationOverlap: input.variationOverlap }
            : {}),
          rawActionLabelsFound,
          voiceMetadata: {
            energyLevel: input.stylePack.energyLevel,
            narrativeTone: input.stylePack.narrativeTone,
            idealPace: input.stylePack.idealPace,
            curiosityType: input.stylePack.curiosityType
          }
        }
      };
    }

    return {
      usedRetentionEngine: false,
      fallbackUsed: true,
      fallbackReason: input.fallbackReason,
      narrationBeats: partial.narrationBeats,
      suggestedScript: finalScript,
      metadata: {
        ...input.baseMetadata,
        retentionEngineAttempted: true,
        fallbackUsed: true,
        fallbackMode: "partial_upgrade_on_legacy",
        fallbackReason: input.fallbackReason,
        upgradesAppliedOnFallback: {
          truthGuard: true,
          timing: true,
          captionDirection: true
        },
        ...(input.score?.total !== undefined ? { narrationScore: input.score.total } : {}),
        ...(input.score?.breakdown ? { scoreBreakdown: input.score.breakdown } : {}),
        ...(input.score?.forbiddenPhrasesFound
          ? { forbiddenPhrasesFound: input.score.forbiddenPhrasesFound }
          : {}),
        estimatedDurationSec: partial.speechTiming.estimatedDurationSec,
        ...(input.retentionBeats ? { beats: input.retentionBeats } : {}),
        ...(input.angle ? { angle: input.angle } : {}),
        ...(input.angleUniquenessScore !== undefined
          ? { angleUniquenessScore: input.angleUniquenessScore }
          : {}),
        ...(input.variationOverlap !== undefined
          ? { variationOverlap: input.variationOverlap }
          : {}),
        truthGuard: partial.truthGuard,
        speechTiming: partial.speechTiming,
        captionDirection: partial.captionDirection,
        upgradeWarnings: partial.warnings,
        rawActionLabelsFound,
        voiceMetadata: {
          energyLevel: input.stylePack.energyLevel,
          narrativeTone: input.stylePack.narrativeTone,
          idealPace: input.stylePack.idealPace,
          curiosityType: input.stylePack.curiosityType
        }
      }
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "partial_upgrade_failed";
    return {
      usedRetentionEngine: false,
      fallbackUsed: true,
      fallbackReason: reason,
      narrationBeats: oralizedLegacyBeats,
      suggestedScript: oralizedLegacyScript,
      metadata: {
        ...input.baseMetadata,
        retentionEngineAttempted: true,
        fallbackUsed: true,
        fallbackMode: "hard_fallback",
        fallbackReason: reason
      }
    };
  }
}

export function refineRemixNarrationWithRetention(
  input: RemixRetentionRefineInput
): RemixRetentionRefineResult {
  const retentionEngineEnabled = isNarrationRetentionEngineEnabled();
  const baseMetadata: NarrationRetentionOverlayMetadata = {
    retentionEngineEnabled,
    retentionEngineAttempted: retentionEngineEnabled,
    usedRetentionEngine: false,
    fallbackUsed: false,
    fallbackMode: "none",
    upgradesAppliedOnFallback: {
      truthGuard: false,
      timing: false,
      captionDirection: false
    }
  };

  if (!retentionEngineEnabled) {
    return {
      usedRetentionEngine: false,
      fallbackUsed: false,
      narrationBeats: input.legacyBeats,
      suggestedScript: input.legacyScript,
      metadata: baseMetadata
    };
  }

  if (process.env.NARRATION_RETENTION_FORCE_FAIL === "true") {
    return {
      usedRetentionEngine: false,
      fallbackUsed: true,
      fallbackReason: "erro_simulado",
      narrationBeats: input.legacyBeats,
      suggestedScript: input.legacyScript,
      metadata: {
        ...baseMetadata,
        fallbackUsed: true,
        fallbackReason: "erro_simulado"
      }
    };
  }

  try {
    const retentionInput = buildRemixRetentionInput(
      input.analysis,
      input.researchDossier,
      input.seed,
      input.maxDurationSeconds
    );
    const subjectCategory = classifyNarrationSubject(retentionInput);
    const stylePack = getNarrationStylePack(subjectCategory);
    const corpus = buildRemixAllowedFactsCorpus(
      input.analysis,
      input.legacyBeats,
      input.researchDossier
    );
    const { angle, angleUniquenessScore } = resolveUniqueVariationAngle(
      input.variationIndex,
      input.targetStyle,
      input.priorVariationAngles
    );

    const oralizedLegacyBeats = oralizeNarrationBeats(input.legacyBeats);

    let retentionBeats = mapLegacyBeatsToRetention(
      oralizedLegacyBeats,
      retentionInput,
      angle,
      stylePack,
      corpus
    );
    retentionBeats = oralizeNarrationBeats(retentionBeats);

    let script = oralizeActionLabelsInNarration(beatsToRetentionScript(retentionBeats));
    let score = scoreNarrationForShorts(script, {
      pack: stylePack,
      input: retentionInput,
      priorScripts: input.priorVariationScripts
    });

    const forceLowScore = process.env.NARRATION_RETENTION_FORCE_LOW_SCORE === "true";
    if (forceLowScore) {
      score = { ...score, total: 40 };
    }

    let beatValidation = validateRetentionBeatSet(
      retentionBeats,
      corpus,
      oralizedLegacyBeats,
      input.maxDurationSeconds
    );
    retentionBeats = beatValidation.beats;

    if (!forceLowScore && (score.total < RETENTION_SCORE_THRESHOLD || beatValidation.error)) {
      retentionBeats = mapLegacyBeatsToRetention(
        oralizedLegacyBeats,
        retentionInput,
        angle,
        stylePack,
        corpus
      ).map((beat) => ({
        ...beat,
        text: oralizeActionLabelsInNarration(
          fitBeatTextToDuration(
            shortenForSpeech(beat.text, maxWordsForBeat(beat.role)),
            beat.role,
            corpus
          )
        )
      }));
      script = oralizeActionLabelsInNarration(beatsToRetentionScript(retentionBeats));
      score = scoreNarrationForShorts(script, {
        pack: stylePack,
        input: retentionInput,
        priorScripts: input.priorVariationScripts
      });
      beatValidation = validateRetentionBeatSet(
        retentionBeats,
        corpus,
        oralizedLegacyBeats,
        input.maxDurationSeconds
      );
      retentionBeats = beatValidation.beats;
    }

    const estimatedDurationSec = retentionBeats.reduce(
      (acc, beat) => acc + estimateSpeechDurationPtBr(beat.text),
      0
    );
    const variationOverlap = maxVariationOverlap(script, input.priorVariationScripts);

    const authorizedFacts = buildRemixAuthorizedFacts(
      input.analysis,
      oralizedLegacyBeats,
      input.researchDossier
    );
    const visualDescription = retentionInput.visualHints?.join("; ");

    if (
      forceLowScore ||
      score.total < RETENTION_SCORE_THRESHOLD ||
      beatValidation.error ||
      findForbiddenPhrases(script, stylePack).length > 0
    ) {
      const fallbackReason = forceLowScore
        ? `score_baixo_${score.total}`
        : beatValidation.error ??
          (findForbiddenPhrases(script, stylePack).length > 0
            ? "cliches_detectados"
            : `score_baixo_${score.total}`);
      return buildPartialFallbackResult({
        input,
        baseMetadata,
        fallbackReason,
        retentionInput,
        subjectCategory,
        authorizedFacts,
        ...(visualDescription ? { visualDescription } : {}),
        retentionBeats,
        score,
        angle,
        angleUniquenessScore,
        variationOverlap,
        stylePack
      });
    }

    const upgrades = applyNarrationUpgrades({
      beats: retentionBeats,
      script,
      facts: authorizedFacts,
      topic: retentionInput.subject,
      ...(visualDescription ? { visualDescription } : {}),
      allowedContext: [
        input.analysis.contentIntelligence.narrativeBrief,
        input.analysis.themeSummary
      ].filter((entry): entry is string => Boolean(entry)),
      targetDurationSec: input.maxDurationSeconds,
      subjectCategory,
      truthStrictness: subjectCategory === "juridico_bancario" ? "high" : "medium",
      targetStyle: input.targetStyle
    });

    retentionBeats = upgrades.beats;
    script = upgrades.finalScript;

    const curiosityTags = Object.fromEntries(
      input.legacyBeats.map((beat) => [beat.role, beat.curiosityTag])
    ) as Partial<Record<NarrationBeatRole, string>>;

    const narrationBeats = adaptRetentionBeatsToNarrationBeats(
      retentionBeats,
      input.productionEmotion,
      curiosityTags
    );

    const upgradedEstimatedDuration = retentionBeats.reduce(
      (acc, beat) => acc + estimateSpeechDurationPtBr(beat.text),
      0
    );

    const finalScript = narrationBeats.map((beat) => beat.text).join("\n");

    return {
      usedRetentionEngine: true,
      fallbackUsed: false,
      narrationBeats,
      suggestedScript: finalScript,
      metadata: {
        retentionEngineEnabled: true,
        retentionEngineAttempted: true,
        usedRetentionEngine: true,
        fallbackUsed: false,
        fallbackMode: "none",
        upgradesAppliedOnFallback: {
          truthGuard: false,
          timing: false,
          captionDirection: false
        },
        narrationScore: score.total,
        scoreBreakdown: score.breakdown,
        forbiddenPhrasesFound: score.forbiddenPhrasesFound,
        estimatedDurationSec: upgradedEstimatedDuration,
        beats: retentionBeats,
        angle,
        angleUniquenessScore,
        variationOverlap,
        truthGuard: upgrades.truthGuard,
        speechTiming: upgrades.speechTiming,
        captionDirection: upgrades.captionDirection,
        upgradeWarnings: [...upgrades.warnings, ...beatValidation.timingWarnings],
        rawActionLabelsFound: findRawActionLabelsInText(finalScript),
        voiceMetadata: {
          energyLevel: stylePack.energyLevel,
          narrativeTone: stylePack.narrativeTone,
          idealPace: stylePack.idealPace,
          curiosityType: stylePack.curiosityType
        }
      }
    };
  } catch (error) {
    const fallbackReason = error instanceof Error ? error.message : "erro_retention_engine";
    const oralizedLegacyBeats = oralizeNarrationBeats(input.legacyBeats);
    const oralizedLegacyScript = oralizeActionLabelsInNarration(input.legacyScript);
    return {
      usedRetentionEngine: false,
      fallbackUsed: true,
      fallbackReason,
      narrationBeats: oralizedLegacyBeats,
      suggestedScript: oralizedLegacyScript,
      metadata: {
        ...baseMetadata,
        retentionEngineAttempted: true,
        fallbackUsed: true,
        fallbackMode: "hard_fallback",
        fallbackReason
      }
    };
  }
}

export function scoreLegacyNarrationForRetention(
  script: string,
  analysis: VideoRemixAnalysis,
  priorScripts: string[] = []
): NarrationRetentionScore {
  const retentionInput = buildRemixRetentionInput(analysis);
  const pack = getNarrationStylePack(classifyNarrationSubject(retentionInput));
  return scoreNarrationForShorts(script, {
    pack,
    input: retentionInput,
    priorScripts
  });
}