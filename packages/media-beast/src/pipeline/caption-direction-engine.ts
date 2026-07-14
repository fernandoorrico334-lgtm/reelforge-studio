export type CaptionDirectionInput = {
  beats: Array<{
    id?: string;
    text: string;
    emotion?: "curious" | "tense" | "excited" | "serious" | "surprised";
    pace?: "slow" | "normal" | "fast";
    pauseAfterMs?: number;
    emphasisWords?: string[];
    captionWords?: string[];
    visualCue?: string;
    retentionGoal?: string;
    timing?: {
      startSec: number;
      endSec: number;
    };
  }>;
  style?: "clean" | "premium" | "viral" | "documentary" | "dark" | "tech" | "legal";
  maxWordsOnScreen?: number;
};

export type CaptionDirectionCue = {
  beatId: string;
  startSec?: number;
  endSec?: number;
  textOnScreen: string;
  highlightedWords: string[];
  animation:
    | "none"
    | "pop"
    | "slide_up"
    | "typewriter"
    | "pulse"
    | "shake_subtle"
    | "fade";
  cutSuggestion:
    | "none"
    | "cut"
    | "zoom_in"
    | "zoom_out"
    | "push_in"
    | "speed_ramp"
    | "hold_frame";
  sfxSuggestion:
    | "none"
    | "soft_hit"
    | "whoosh"
    | "riser"
    | "bass_hit"
    | "click"
    | "glitch";
  layout:
    | "center"
    | "lower_third"
    | "top_hook"
    | "keyword_focus"
    | "split_caption";
  intensity: "low" | "medium" | "high";
  reason: string;
};

export type CaptionDirectionResult = {
  cues: CaptionDirectionCue[];
  style: string;
  warnings: string[];
};

function normalizeEmotion(
  emotion?: string
): CaptionDirectionInput["beats"][number]["emotion"] {
  if (!emotion) return "curious";
  const lower = emotion.toLowerCase();
  if (lower.includes("tens") || lower.includes("sombri") || lower.includes("suspen")) {
    return "tense";
  }
  if (lower.includes("excit") || lower.includes("hype") || lower.includes("entus")) {
    return "excited";
  }
  if (lower.includes("seri") || lower.includes("document")) {
    return "serious";
  }
  if (lower.includes("surpres") || lower.includes("revel")) {
    return "surprised";
  }
  return "curious";
}

export function selectCaptionText(
  text: string,
  captionWords?: string[],
  maxWordsOnScreen = 6
): string {
  if (captionWords?.length) {
    const fromCaption = captionWords.join(" ").trim();
    if (fromCaption.split(/\s+/).length <= maxWordsOnScreen) {
      return fromCaption;
    }
  }

  const dangling = new Set([
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
    "as"
  ]);
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= maxWordsOnScreen) {
    const last = words[words.length - 1]?.toLowerCase().replace(/[.,!?;:]/g, "") ?? "";
    if (!dangling.has(last)) return text.trim();
  }

  const clauses = text.split(/[:—–-]\s+/);
  if (clauses[0]) {
    const clauseWords = clauses[0].split(/\s+/).filter(Boolean);
    if (clauseWords.length <= maxWordsOnScreen) {
      const last = clauseWords[clauseWords.length - 1]?.toLowerCase().replace(/[.,!?;:]/g, "") ?? "";
      if (!dangling.has(last)) return clauses[0].trim();
    }
  }

  for (let count = Math.min(words.length, maxWordsOnScreen); count >= 3; count -= 1) {
    const slice = words.slice(0, count);
    const last = slice[slice.length - 1]?.toLowerCase().replace(/[.,!?;:]/g, "") ?? "";
    if (!dangling.has(last)) return slice.join(" ");
  }

  return words.slice(0, Math.min(words.length, maxWordsOnScreen)).join(" ");
}

export function selectCaptionAnimation(
  emotion?: string,
  pace?: string,
  retentionGoal?: string
): CaptionDirectionCue["animation"] {
  const normalized = normalizeEmotion(emotion);
  if (normalized === "serious") return "fade";
  if (normalized === "tense") return "pulse";
  if (normalized === "excited" || pace === "fast") return "pop";
  if (retentionGoal?.toLowerCase().includes("gancho")) return "slide_up";
  if (normalized === "surprised") return "shake_subtle";
  return pace === "slow" ? "fade" : "typewriter";
}

export function selectCutSuggestion(
  visualCue?: string,
  pauseAfterMs?: number,
  retentionGoal?: string
): CaptionDirectionCue["cutSuggestion"] {
  const cue = visualCue?.toLowerCase() ?? "";
  if (cue.includes("close") || cue.includes("zoom")) return "zoom_in";
  if (cue.includes("corte") || cue.includes("cut")) return "cut";
  if ((pauseAfterMs ?? 0) >= 300) return "hold_frame";
  if (retentionGoal?.toLowerCase().includes("clímax") || retentionGoal?.toLowerCase().includes("climax")) {
    return "push_in";
  }
  if (retentionGoal?.toLowerCase().includes("gancho")) return "zoom_in";
  return "none";
}

export function selectSfxSuggestion(
  emotion?: string,
  retentionGoal?: string,
  intensity: "low" | "medium" | "high" = "medium"
): CaptionDirectionCue["sfxSuggestion"] {
  const normalized = normalizeEmotion(emotion);
  if (normalized === "tense") {
    return intensity === "high" ? "bass_hit" : "riser";
  }
  if (normalized === "excited") return "whoosh";
  if (normalized === "surprised") return "soft_hit";
  if (retentionGoal?.toLowerCase().includes("curios")) return "click";
  if (intensity === "low") return "none";
  return "soft_hit";
}

function resolveLayout(
  style: CaptionDirectionInput["style"],
  roleIndex: number,
  retentionGoal?: string
): CaptionDirectionCue["layout"] {
  if (style === "legal") return "lower_third";
  if (style === "tech") return "keyword_focus";
  if (roleIndex === 0 || retentionGoal?.toLowerCase().includes("gancho")) return "top_hook";
  if (style === "viral") return "center";
  return "lower_third";
}

function resolveIntensity(
  style: CaptionDirectionInput["style"],
  emotion?: string,
  roleIndex?: number
): "low" | "medium" | "high" {
  if (style === "legal" || style === "documentary") return "low";
  if (style === "dark") return roleIndex === 0 ? "medium" : "low";
  const normalized = normalizeEmotion(emotion);
  if (normalized === "excited" || style === "viral") return "high";
  if (normalized === "tense") return "medium";
  return style === "premium" ? "medium" : "low";
}

function styleOverrides(
  style: CaptionDirectionInput["style"],
  cue: CaptionDirectionCue
): CaptionDirectionCue {
  if (style === "legal") {
    return {
      ...cue,
      animation: cue.animation === "shake_subtle" ? "fade" : cue.animation,
      sfxSuggestion: cue.sfxSuggestion === "bass_hit" || cue.sfxSuggestion === "glitch" ? "none" : cue.sfxSuggestion,
      cutSuggestion: cue.cutSuggestion === "speed_ramp" ? "none" : cue.cutSuggestion,
      intensity: "low"
    };
  }
  if (style === "dark") {
    return {
      ...cue,
      animation: cue.intensity === "high" ? "pulse" : cue.animation,
      sfxSuggestion: cue.sfxSuggestion === "whoosh" ? "riser" : cue.sfxSuggestion,
      intensity: cue.intensity === "high" ? "medium" : cue.intensity
    };
  }
  if (style === "tech") {
    return {
      ...cue,
      animation: "typewriter",
      cutSuggestion: cue.cutSuggestion === "none" ? "cut" : cue.cutSuggestion,
      layout: "keyword_focus"
    };
  }
  return cue;
}

export function generateCaptionDirection(
  input: CaptionDirectionInput
): CaptionDirectionResult {
  const style = input.style ?? "premium";
  const maxWords = input.maxWordsOnScreen ?? 7;
  const warnings: string[] = [];
  const cues: CaptionDirectionCue[] = [];

  input.beats.forEach((beat, index) => {
    const beatId = beat.id ?? `beat-${index + 1}`;
    const emotion = normalizeEmotion(beat.emotion);
    const textOnScreen = selectCaptionText(beat.text, beat.captionWords, maxWords);
    const wordCount = textOnScreen.split(/\s+/).filter(Boolean).length;

    if (wordCount > maxWords) {
      warnings.push(`${beatId}: legenda excede ${maxWords} palavras`);
    }

    const intensity = resolveIntensity(style, emotion, index);
    let cue: CaptionDirectionCue = {
      beatId,
      ...(beat.timing ? { startSec: beat.timing.startSec, endSec: beat.timing.endSec } : {}),
      textOnScreen,
      highlightedWords: (beat.emphasisWords ?? []).slice(0, 4),
      animation: selectCaptionAnimation(emotion, beat.pace, beat.retentionGoal),
      cutSuggestion: selectCutSuggestion(beat.visualCue, beat.pauseAfterMs, beat.retentionGoal),
      sfxSuggestion: selectSfxSuggestion(emotion, beat.retentionGoal, intensity),
      layout: resolveLayout(style, index, beat.retentionGoal),
      intensity,
      reason: `estilo ${style}, emoção ${emotion}, meta: ${beat.retentionGoal ?? "retenção"}`
    };

    cue = styleOverrides(style, cue);
    cues.push(cue);
  });

  return { cues, style, warnings };
}