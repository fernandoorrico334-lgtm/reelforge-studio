const DANGLING_ENDINGS = new Set([
  "de",
  "do",
  "da",
  "dos",
  "das",
  "por",
  "com",
  "em",
  "e",
  "o",
  "a",
  "os",
  "as",
  "um",
  "uma",
  "no",
  "na",
  "nos",
  "nas",
  "ao",
  "aos",
  "à",
  "às"
]);

const MAX_CAPTION_WORDS = 6;
const MIN_CAPTION_WORDS = 3;
const MAX_CAPTION_LINES = 2;
const MAX_CHARS_PER_LINE = 22;
const SAFE_AREA_MIN_X_RATIO = 0.08;
const SAFE_AREA_MAX_X_RATIO = 0.92;
const ESTIMATED_CHAR_WIDTH_RATIO = 0.55;

export const BANNED_CAPTION_PATTERNS = [
  /^VENOM NO CLOSE$/i,
  /^DUPLA PERFEITA NOS HQS?$/i
] as const;

export type BeatCaptionCueRecord = {
  beat: string;
  caption: string;
  startSec: number;
  endSec: number;
  lineCount: number;
  safeAreaOk: boolean;
  semanticComplete: boolean;
};

export type SemanticCaptionResult = {
  caption: string;
  lines: string[];
  grammaticallyComplete: boolean;
  truncated: boolean;
  warnings: string[];
};

function normalizeWords(text: string): string[] {
  return text
    .replace(/[“”"']/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
}

function endsWithDanglingWord(words: string[]): boolean {
  if (words.length === 0) return true;
  const last = words[words.length - 1]!.toLowerCase().replace(/[.,!?;:]/g, "");
  return DANGLING_ENDINGS.has(last);
}

function trimToSemanticUnit(words: string[], maxWords: number): string[] {
  if (words.length <= maxWords && !endsWithDanglingWord(words)) {
    return words;
  }

  for (let count = Math.min(words.length, maxWords); count >= MIN_CAPTION_WORDS; count -= 1) {
    const slice = words.slice(0, count);
    if (!endsWithDanglingWord(slice)) return slice;
  }

  for (let count = Math.min(words.length, maxWords); count >= 1; count -= 1) {
    const slice = words.slice(0, count);
    if (!endsWithDanglingWord(slice)) return slice;
  }

  return words.slice(0, Math.min(words.length, maxWords));
}

export function isCaptionGrammaticallyComplete(caption: string): boolean {
  const words = normalizeWords(caption);
  if (words.length === 0) return false;
  if (words.length < MIN_CAPTION_WORDS) return words.length <= 2 && !endsWithDanglingWord(words);
  return !endsWithDanglingWord(words);
}

export function splitCaptionIntoLines(caption: string, maxCharsPerLine = MAX_CHARS_PER_LINE): string[] {
  const words = normalizeWords(caption);
  if (words.length === 0) return [];

  const lines: string[] = [];
  let current: string[] = [];

  for (const word of words) {
    const candidate = [...current, word].join(" ");
    if (candidate.length > maxCharsPerLine && current.length > 0) {
      lines.push(current.join(" "));
      current = [word];
    } else {
      current.push(word);
    }
  }

  if (current.length > 0) lines.push(current.join(" "));
  return lines.slice(0, MAX_CAPTION_LINES);
}

export function finalizeSemanticCaption(
  text: string,
  options?: { minWords?: number; maxWords?: number; fallback?: string }
): SemanticCaptionResult {
  const warnings: string[] = [];
  const minWords = options?.minWords ?? MIN_CAPTION_WORDS;
  const maxWords = options?.maxWords ?? MAX_CAPTION_WORDS;
  const rawWords = normalizeWords(text);

  if (rawWords.length === 0) {
    const fallback = options?.fallback ?? "VENOM E SIMBIONTE";
    return {
      caption: fallback,
      lines: splitCaptionIntoLines(fallback),
      grammaticallyComplete: true,
      truncated: false,
      warnings: ["empty_source_caption"]
    };
  }

  const trimmed = trimToSemanticUnit(rawWords, maxWords);
  let caption = trimmed.join(" ").toUpperCase();
  const truncated = trimmed.length < rawWords.length;

  if (trimmed.length < minWords) {
    warnings.push(`caption_below_min_words:${trimmed.length}<${minWords}`);
  }

  if (!isCaptionGrammaticallyComplete(caption)) {
    const fallback = options?.fallback;
    if (fallback) {
      warnings.push("caption_replaced_with_fallback");
      caption = fallback.toUpperCase();
    } else {
      warnings.push("caption_grammatically_incomplete");
    }
  }

  const lines = splitCaptionIntoLines(caption);
  if (lines.length > MAX_CAPTION_LINES) {
    warnings.push("caption_exceeds_max_lines");
  }

  return {
    caption,
    lines,
    grammaticallyComplete: isCaptionGrammaticallyComplete(caption),
    truncated,
    warnings
  };
}

export const USER_PROVIDED_BEAT_CAPTIONS: Record<string, string> = {
  hook: "VENOM NO FOCO",
  context: "DUPLA PERFEITA NAS HQs",
  curiosity: "NOS QUADRINHOS ISSO MUDA",
  curiosity_a: "O PAR PERFEITO ESTÁ NA HQ",
  curiosity_b: "A DUPLA IDEAL EXISTE",
  development: "VENOM E HOMEM-ARANHA",
  development_a: "VENOM E HOMEM-ARANHA",
  development_b: "PARCERIA OU CONFLITO",
  climax: "A DUPLA QUE OS FÃS QUEREM",
  closing: "QUAL DUPLA VOCÊ PREFERE?",
  cta: "QUAL DUPLA VOCÊ PREFERE?"
};

export function isBannedCaption(caption: string): boolean {
  const normalized = caption.trim().toUpperCase();
  return BANNED_CAPTION_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function estimateCaptionFitsSafeArea(
  caption: string,
  frameWidth = 1080,
  fontSize = 60
): boolean {
  const lines = splitCaptionIntoLines(caption);
  if (lines.length === 0 || lines.length > MAX_CAPTION_LINES) return false;

  const safeWidth = frameWidth * (SAFE_AREA_MAX_X_RATIO - SAFE_AREA_MIN_X_RATIO);
  const estimatedCharWidth = fontSize * ESTIMATED_CHAR_WIDTH_RATIO;

  for (const line of lines) {
    const estimatedWidth = line.length * estimatedCharWidth;
    if (estimatedWidth > safeWidth) return false;
  }

  return true;
}

export function buildBeatCaptionCueRecord(input: {
  beat: string;
  caption: string;
  startSec: number;
  endSec: number;
}): BeatCaptionCueRecord {
  const finalized = finalizeSemanticCaption(input.caption);
  const lines = splitCaptionIntoLines(finalized.caption);
  const words = normalizeWords(finalized.caption);

  return {
    beat: input.beat,
    caption: finalized.caption,
    startSec: input.startSec,
    endSec: input.endSec,
    lineCount: lines.length,
    safeAreaOk: estimateCaptionFitsSafeArea(finalized.caption),
    semanticComplete:
      finalized.grammaticallyComplete &&
      words.length >= MIN_CAPTION_WORDS &&
      words.length <= MAX_CAPTION_WORDS &&
      lines.length <= MAX_CAPTION_LINES &&
      !isBannedCaption(finalized.caption)
  };
}

export function buildUserProvidedBeatCaptionCues(
  assignments: Array<{
    beatRole: string;
    caption: string;
    startSec: number;
    endSec: number;
  }>
): BeatCaptionCueRecord[] {
  return assignments.map((assignment) =>
    buildBeatCaptionCueRecord({
      beat: assignment.beatRole,
      caption: assignment.caption,
      startSec: assignment.startSec,
      endSec: assignment.endSec
    })
  );
}

export function detectFastCutCaptionFlicker(input: {
  scenes: Array<{ startSec: number; endSec: number; caption: string; sceneRole?: string | null }>;
  beatAssignments: Array<{ beatRole: string; startSec: number; endSec: number; caption: string }>;
}): { hasFlicker: boolean; offendingSceneIds: string[] } {
  const captionChangesWithinBeat: string[] = [];
  for (const assignment of input.beatAssignments) {
    const scenesInBeat = input.scenes.filter(
      (scene) =>
        scene.startSec >= assignment.startSec - 0.001 &&
        scene.endSec <= assignment.endSec + 0.001
    );
    const distinctCaptions = new Set(
      scenesInBeat.map((scene) => scene.caption.trim().toUpperCase()).filter(Boolean)
    );
    const expected = assignment.caption.trim().toUpperCase();
    if (distinctCaptions.size > 1) {
      captionChangesWithinBeat.push(assignment.beatRole);
    }
    if (distinctCaptions.size === 1 && !distinctCaptions.has(expected)) {
      captionChangesWithinBeat.push(assignment.beatRole);
    }
  }

  const perSceneCueCount = input.scenes.filter((scene) => scene.caption.trim().length > 0).length;
  const beatCount = input.beatAssignments.length;
  const hasPerCutReentry = perSceneCueCount > beatCount * 1.5;

  return {
    hasFlicker: captionChangesWithinBeat.length > 0 || hasPerCutReentry,
    offendingSceneIds: captionChangesWithinBeat
  };
}

export function validateBeatCaptionTimeline(input: {
  beatCues: BeatCaptionCueRecord[];
  scenes?: Array<{ startSec: number; endSec: number; caption: string; sceneRole?: string | null }>;
  beatAssignments?: Array<{ beatRole: string; startSec: number; endSec: number; caption: string }>;
}): {
  captionPreflightReady: boolean;
  beatCues: BeatCaptionCueRecord[];
  incompleteCaptions: string[];
  bannedCaptions: string[];
  unsafeCaptions: string[];
  danglingCaptions: string[];
  flickerDetected: boolean;
  warnings: string[];
} {
  const warnings: string[] = [];
  const incompleteCaptions: string[] = [];
  const bannedCaptions: string[] = [];
  const unsafeCaptions: string[] = [];
  const danglingCaptions: string[] = [];

  for (const cue of input.beatCues) {
    const words = normalizeWords(cue.caption);
    if (isBannedCaption(cue.caption)) bannedCaptions.push(cue.beat);
    if (!cue.safeAreaOk) unsafeCaptions.push(cue.beat);
    if (!cue.semanticComplete) incompleteCaptions.push(cue.beat);
    if (endsWithDanglingWord(words)) danglingCaptions.push(cue.beat);
    if (words.length < MIN_CAPTION_WORDS || words.length > MAX_CAPTION_WORDS) {
      incompleteCaptions.push(cue.beat);
      warnings.push(`${cue.beat}:word_count_out_of_range`);
    }
    if (cue.lineCount > MAX_CAPTION_LINES) {
      incompleteCaptions.push(cue.beat);
      warnings.push(`${cue.beat}:line_count_exceeded`);
    }
  }

  const hook = input.beatCues.find((cue) => cue.beat.startsWith("hook"));
  const climax = input.beatCues.find((cue) => cue.beat.startsWith("climax"));
  const closing = input.beatCues.find(
    (cue) => cue.beat.startsWith("closing") || cue.beat === "cta"
  );

  if (!hook?.caption?.trim()) warnings.push("hook_caption_missing");
  if (!climax?.caption?.trim()) warnings.push("climax_caption_missing");
  if (!closing?.caption?.trim()) warnings.push("cta_caption_missing");

  let flickerDetected = false;
  if (input.scenes && input.beatAssignments) {
    const flicker = detectFastCutCaptionFlicker({
      scenes: input.scenes,
      beatAssignments: input.beatAssignments
    });
    flickerDetected = flicker.hasFlicker;
    if (flickerDetected) warnings.push("caption_fast_cut_flicker_detected");
  }

  const captionPreflightReady =
    incompleteCaptions.length === 0 &&
    bannedCaptions.length === 0 &&
    unsafeCaptions.length === 0 &&
    danglingCaptions.length === 0 &&
    !flickerDetected &&
    Boolean(hook?.caption?.trim()) &&
    Boolean(climax?.caption?.trim()) &&
    Boolean(closing?.caption?.trim());

  return {
    captionPreflightReady,
    beatCues: input.beatCues,
    incompleteCaptions: [...new Set(incompleteCaptions)],
    bannedCaptions: [...new Set(bannedCaptions)],
    unsafeCaptions: [...new Set(unsafeCaptions)],
    danglingCaptions: [...new Set(danglingCaptions)],
    flickerDetected,
    warnings
  };
}

export function resolveUserProvidedBeatCaption(
  beatRole: string,
  narrationHint?: string | null
): SemanticCaptionResult {
  const base = beatRole.replace(/_\d+$/, "");
  const preset =
    USER_PROVIDED_BEAT_CAPTIONS[beatRole] ??
    USER_PROVIDED_BEAT_CAPTIONS[base] ??
    narrationHint ??
    base.replace(/_/g, " ");

  return finalizeSemanticCaption(preset, {
    fallback: USER_PROVIDED_BEAT_CAPTIONS[base] ?? "VENOM E SIMBIONTE"
  });
}

export function validateCaptionPreflight(
  captions: Array<{ beatRole: string; caption: string; startSec?: number; endSec?: number }>,
  options?: {
    scenes?: Array<{ startSec: number; endSec: number; caption: string; sceneRole?: string | null }>;
    useBeatTimeline?: boolean;
  }
): {
  captionPreflightReady: boolean;
  beatCues: BeatCaptionCueRecord[];
  incompleteCaptions: string[];
  truncatedCaptions: string[];
  bannedCaptions: string[];
  unsafeCaptions: string[];
  danglingCaptions: string[];
  flickerDetected: boolean;
  warnings: string[];
} {
  const beatCues = captions.map((entry, index) =>
    buildBeatCaptionCueRecord({
      beat: entry.beatRole,
      caption: entry.caption,
      startSec: entry.startSec ?? index,
      endSec: entry.endSec ?? index + 1
    })
  );

  const timeline = validateBeatCaptionTimeline({
    beatCues,
    ...(options?.scenes ? { scenes: options.scenes } : {}),
    ...(options?.useBeatTimeline
      ? {
          beatAssignments: captions.map((entry, index) => ({
            beatRole: entry.beatRole,
            caption: entry.caption,
            startSec: entry.startSec ?? index,
            endSec: entry.endSec ?? index + 1
          }))
        }
      : {})
  });

  const truncatedCaptions: string[] = [];
  for (const entry of captions) {
    const result = finalizeSemanticCaption(entry.caption);
    if (result.truncated) truncatedCaptions.push(entry.beatRole);
    timeline.warnings.push(...result.warnings.map((w) => `${entry.beatRole}:${w}`));
  }

  const captionPreflightReady =
    timeline.captionPreflightReady && truncatedCaptions.length === 0;

  return {
    captionPreflightReady,
    beatCues: timeline.beatCues,
    incompleteCaptions: timeline.incompleteCaptions,
    truncatedCaptions,
    bannedCaptions: timeline.bannedCaptions,
    unsafeCaptions: timeline.unsafeCaptions,
    danglingCaptions: timeline.danglingCaptions,
    flickerDetected: timeline.flickerDetected,
    warnings: timeline.warnings
  };
}