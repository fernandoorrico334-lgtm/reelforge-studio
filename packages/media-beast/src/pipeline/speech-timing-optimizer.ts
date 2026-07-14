import { shortenForSpeech } from "./narration-curiosity-engine.js";
import {
  expandBeatWithAuthorizedFact,
  sanitizeNarrationForSpeech
} from "./narration-pad-sanitizer.js";
import type { RemixTargetStyle } from "./remix-types.js";

export type SpeechTimingBeat = {
  id: string;
  role:
    | "hook"
    | "promise_context"
    | "curiosity"
    | "development"
    | "climax_reveal"
    | "loop_closing";
  text: string;
  timing?: {
    startSec: number;
    endSec: number;
  };
  pace?: "slow" | "normal" | "fast";
  pauseAfterMs?: number;
};

export type SpeechTimingAction = {
  beatId: string;
  type:
    | "shortened"
    | "expanded"
    | "pause_reduced"
    | "pause_added"
    | "pace_changed"
    | "unchanged";
  before: string;
  after: string;
  reason: string;
};

export type SpeechTimingInput = {
  beats: SpeechTimingBeat[];
  targetDurationSec: number;
  wpm?: number;
  minPauseMs?: number;
  maxPauseMs?: number;
  allowCompression?: boolean;
  allowExpansion?: boolean;
  authorizedFacts?: string[];
  targetStyle?: RemixTargetStyle;
};

export type SpeechTimingResult = {
  ok: boolean;
  targetDurationSec: number;
  estimatedDurationSec: number;
  differenceSec: number;
  beats: SpeechTimingBeat[];
  actions: SpeechTimingAction[];
  warnings: string[];
};

export const DEFAULT_BEAT_TIMING_LIMITS: Record<
  SpeechTimingBeat["role"],
  { minSec: number; maxSec: number }
> = {
  hook: { minSec: 1.2, maxSec: 2.5 },
  promise_context: { minSec: 2.5, maxSec: 5 },
  curiosity: { minSec: 5, maxSec: 9 },
  development: { minSec: 7, maxSec: 12 },
  climax_reveal: { minSec: 6, maxSec: 11 },
  loop_closing: { minSec: 4, maxSec: 8 }
};

const SHORTEN_PRIORITY: SpeechTimingBeat["role"][] = [
  "development",
  "loop_closing",
  "curiosity",
  "promise_context",
  "climax_reveal",
  "hook"
];

const EXPAND_PRIORITY: SpeechTimingBeat["role"][] = [
  "climax_reveal",
  "development",
  "curiosity",
  "promise_context",
  "loop_closing"
];

const CONVERSATIONAL_EXPANSIONS: Record<SpeechTimingBeat["role"], string[]> = {
  hook: [],
  promise_context: [
    "Isso pesa mais quando você conhece o contexto da cena.",
    "A HQ costuma explicar o que o clipe só insinua."
  ],
  curiosity: [
    "Quem acompanha o personagem percebe na hora.",
    "Fã de longa data já esperava esse tipo de cena."
  ],
  development: [
    "O recorte esconde metade da história nos quadrinhos.",
    "O vídeo mostra o instante — a origem fica fora do frame."
  ],
  climax_reveal: [
    "Esse é o detalhe que muda a leitura da cena.",
    "É por isso que essa dupla prende tanto nos quadrinhos."
  ],
  loop_closing: [
    "Reassistindo, o começo ganha outro sentido.",
    "Volta no gancho com esse detalhe na cabeça."
  ]
};

const DOCUMENTARY_EXPANSIONS: Record<SpeechTimingBeat["role"], string[]> = {
  hook: [],
  promise_context: ["O contexto dos quadrinhos explica por que a cena prende."],
  curiosity: ["O título promete uma coisa; a HQ entrega outra camada."],
  development: ["O vídeo mostra o instante — a origem fica fora do frame."],
  climax_reveal: ["O fato que fecha essa curiosidade raramente aparece no recorte."],
  loop_closing: ["Volta no gancho com esse detalhe na cabeça."]
};

export type BeatDurationSeverity = "info" | "warning" | "blocking";

const MAX_WORDS_BY_ROLE: Record<SpeechTimingBeat["role"], number> = {
  hook: 14,
  promise_context: 22,
  curiosity: 28,
  development: 32,
  climax_reveal: 30,
  loop_closing: 20
};

export function estimateSpeechDurationPtBr(text: string, wpm = 155): number {
  const words = text.split(/\s+/).filter(Boolean).length;
  return Number(((words / wpm) * 60).toFixed(2));
}

export function estimateBeatDurationSec(beat: SpeechTimingBeat, wpm = 155): number {
  const speechSec = estimateSpeechDurationPtBr(beat.text, wpm);
  const pauseSec = (beat.pauseAfterMs ?? 0) / 1000;
  return Number((speechSec + pauseSec).toFixed(2));
}

export function shortenBeatForTiming(text: string, role: SpeechTimingBeat["role"]): string {
  const maxWords = MAX_WORDS_BY_ROLE[role];
  let shortened = shortenForSpeech(text, maxWords);
  const limits = DEFAULT_BEAT_TIMING_LIMITS[role];
  const wpm = 155;
  while (
    estimateSpeechDurationPtBr(shortened, wpm) > limits.maxSec &&
    shortened.split(/\s+/).length > 4
  ) {
    shortened = shortenForSpeech(shortened, Math.max(4, shortened.split(/\s+/).length - 3));
  }
  return shortened.trim();
}

function oralExpansionsForStyle(
  targetStyle?: RemixTargetStyle
): Record<SpeechTimingBeat["role"], string[]> {
  if (
    targetStyle === "comics" ||
    targetStyle === "anime" ||
    targetStyle === "hype_sports" ||
    targetStyle === "dark_cinematic"
  ) {
    return CONVERSATIONAL_EXPANSIONS;
  }
  return DOCUMENTARY_EXPANSIONS;
}

export function expandBeatForTiming(
  text: string,
  role: SpeechTimingBeat["role"],
  allowedFacts?: string[],
  targetStyle?: RemixTargetStyle,
  durationPressure: "normal" | "high" = "normal",
  usedSnippets?: Set<string>
): string {
  const limits = DEFAULT_BEAT_TIMING_LIMITS[role];
  const targetSec =
    durationPressure === "high"
      ? limits.minSec + (limits.maxSec - limits.minSec) * 0.6
      : limits.minSec;
  let expanded = sanitizeNarrationForSpeech(text.trim());

  if (allowedFacts?.length && estimateSpeechDurationPtBr(expanded) < targetSec) {
    expanded = expandBeatWithAuthorizedFact(
      expanded,
      allowedFacts,
      role === "climax_reveal" ? (durationPressure === "high" ? 22 : 18) : durationPressure === "high" ? 18 : 14,
      usedSnippets
    );
  }

  const bridges = oralExpansionsForStyle(targetStyle)[role];
  for (const bridge of bridges) {
    if (estimateSpeechDurationPtBr(expanded) >= targetSec) break;
    const candidate = sanitizeNarrationForSpeech(`${expanded} ${bridge}`.trim());
    const usesOnlyAllowed =
      !allowedFacts?.length ||
      allowedFacts.some((fact) => candidate.toLowerCase().includes(fact.toLowerCase().slice(0, 12))) ||
      !/\d{4}|\b\d+%/.test(bridge);
    if (usesOnlyAllowed && candidate !== expanded) {
      expanded = candidate;
    }
  }

  return expanded.trim();
}

function totalDuration(beats: SpeechTimingBeat[], wpm: number): number {
  return beats.reduce((acc, beat) => acc + estimateBeatDurationSec(beat, wpm), 0);
}

function cloneBeat(beat: SpeechTimingBeat): SpeechTimingBeat {
  return { ...beat };
}

export function optimizeSpeechTiming(input: SpeechTimingInput): SpeechTimingResult {
  const wpm = input.wpm ?? 155;
  const minPause = input.minPauseMs ?? 80;
  const maxPause = input.maxPauseMs ?? 420;
  const allowCompression = input.allowCompression !== false;
  const allowExpansion = input.allowExpansion !== false;
  const actions: SpeechTimingAction[] = [];
  const warnings: string[] = [];

  let beats = input.beats.map(cloneBeat);
  let estimated = totalDuration(beats, wpm);
  let difference = Number((estimated - input.targetDurationSec).toFixed(2));

  if (Math.abs(difference) <= 1.2) {
    return {
      ok: true,
      targetDurationSec: input.targetDurationSec,
      estimatedDurationSec: estimated,
      differenceSec: difference,
      beats,
      actions,
      warnings
    };
  }

  if (difference > 0 && allowCompression) {
    for (const role of SHORTEN_PRIORITY) {
      if (estimated <= input.targetDurationSec + 0.8) break;
      const index = beats.findIndex((beat) => beat.role === role);
      if (index < 0) continue;
      const beat = beats[index]!;
      const before = beat.text;
      const after = shortenBeatForTiming(before, role);
      if (after !== before) {
        beats[index] = { ...beat, text: after };
        actions.push({
          beatId: beat.id,
          type: "shortened",
          before,
          after,
          reason: `encurtar ${role} para caber no alvo`
        });
        estimated = totalDuration(beats, wpm);
        difference = Number((estimated - input.targetDurationSec).toFixed(2));
      }
    }

    if (estimated > input.targetDurationSec + 0.5) {
      for (const beat of beats) {
        if (estimated <= input.targetDurationSec + 0.5) break;
        const currentPause = beat.pauseAfterMs ?? 180;
        if (currentPause > minPause) {
          const reduced = Math.max(minPause, currentPause - 80);
          beat.pauseAfterMs = reduced;
          actions.push({
            beatId: beat.id,
            type: "pause_reduced",
            before: String(currentPause),
            after: String(reduced),
            reason: "reduzir pausa para aproximar duração alvo"
          });
          estimated = totalDuration(beats, wpm);
          difference = Number((estimated - input.targetDurationSec).toFixed(2));
        }
      }
    }
  }

  if (difference < -1 && allowExpansion) {
    const usedExpansionSnippets = new Set<string>();
    for (let pass = 0; pass < 3 && estimated < input.targetDurationSec - 0.8; pass++) {
      for (const role of EXPAND_PRIORITY) {
        if (estimated >= input.targetDurationSec - 0.8) break;
        const index = beats.findIndex((beat) => beat.role === role);
        if (index < 0) continue;
        const beat = beats[index]!;
        const before = beat.text;
        const after = expandBeatForTiming(
          before,
          role,
          input.authorizedFacts,
          input.targetStyle,
          pass >= 1 ? "high" : "normal",
          usedExpansionSnippets
        );
        if (after !== before) {
          beats[index] = { ...beat, text: after };
          actions.push({
            beatId: beat.id,
            type: "expanded",
            before,
            after,
            reason: `expandir ${role} com reforço oral (pass ${pass + 1})`
          });
          estimated = totalDuration(beats, wpm);
          difference = Number((estimated - input.targetDurationSec).toFixed(2));
        }
      }
    }

    if (estimated < input.targetDurationSec - 0.8) {
      const hook = beats.find((b) => b.role === "hook");
      if (hook && (hook.pauseAfterMs ?? 0) < maxPause) {
        const added = Math.min(maxPause, (hook.pauseAfterMs ?? 120) + 100);
        hook.pauseAfterMs = added;
        actions.push({
          beatId: hook.id,
          type: "pause_added",
          before: String(hook.pauseAfterMs ?? 120),
          after: String(added),
          reason: "pausa no gancho para preencher tempo"
        });
        estimated = totalDuration(beats, wpm);
        difference = Number((estimated - input.targetDurationSec).toFixed(2));
      }
    }
  }

  for (const beat of beats) {
    const duration = estimateBeatDurationSec(beat, wpm);
    const limits = DEFAULT_BEAT_TIMING_LIMITS[beat.role];
    if (duration < limits.minSec * 0.7) {
      warnings.push(`${beat.role} muito curto (${duration}s)`);
    }
    if (duration > limits.maxSec * 1.35) {
      warnings.push(`${beat.role} muito longo (${duration}s)`);
    }
  }

  if (difference < -1.5) {
    for (const beat of beats) {
      if (estimated >= input.targetDurationSec - 1) break;
      if ((beat.pauseAfterMs ?? 0) < maxPause) {
        const added = Math.min(maxPause, (beat.pauseAfterMs ?? 140) + 90);
        beat.pauseAfterMs = added;
        estimated = totalDuration(beats, wpm);
        difference = Number((estimated - input.targetDurationSec).toFixed(2));
      }
    }
  }

  beats = beats.map((beat) => ({
    ...beat,
    text: sanitizeNarrationForSpeech(beat.text)
  }));

  estimated = totalDuration(beats, wpm);
  difference = Number((estimated - input.targetDurationSec).toFixed(2));
  const ok = Math.abs(difference) <= 2.5;

  return {
    ok,
    targetDurationSec: input.targetDurationSec,
    estimatedDurationSec: Number(estimated.toFixed(2)),
    differenceSec: difference,
    beats,
    actions,
    warnings
  };
}

const MOVE_OVERFLOW_ROLES: Partial<
  Record<SpeechTimingBeat["role"], SpeechTimingBeat["role"][]>
> = {
  development: ["climax_reveal", "loop_closing"],
  promise_context: ["curiosity"]
};

export function validateBeatTimingSoft(input: {
  beats: SpeechTimingBeat[];
  targetDurationSec: number;
  wpm?: number;
}): {
  ok: boolean;
  severity: BeatDurationSeverity;
  warnings: string[];
  correctedBeats: SpeechTimingBeat[];
} {
  const wpm = input.wpm ?? 155;
  let beats = input.beats.map(cloneBeat);
  const warnings: string[] = [];
  let blocking = false;

  for (let index = 0; index < beats.length; index++) {
    const beat = beats[index]!;
    const limits = DEFAULT_BEAT_TIMING_LIMITS[beat.role];
    let duration = estimateBeatDurationSec(beat, wpm);
    const ratio = limits.maxSec > 0 ? duration / limits.maxSec : 1;

    if (ratio <= 1) continue;

    if (ratio > 1.45) {
      const shortened = shortenBeatForTiming(beat.text, beat.role);
      if (shortened !== beat.text) {
        beats[index] = { ...beat, text: shortened };
        warnings.push(`${beat.role}: encurtado automaticamente (${duration}s -> alvo <= ${limits.maxSec}s)`);
        duration = estimateBeatDurationSec(beats[index]!, wpm);
      }

      const currentPause = beats[index]!.pauseAfterMs ?? 180;
      if (duration > limits.maxSec * 1.2 && currentPause > 80) {
        beats[index] = {
          ...beats[index]!,
          pauseAfterMs: Math.max(80, currentPause - 120)
        };
        warnings.push(`${beat.role}: pausa reduzida para ajustar duração`);
        duration = estimateBeatDurationSec(beats[index]!, wpm);
      }

      if (duration > limits.maxSec * 1.15) {
        beats[index] = { ...beats[index]!, pace: "fast" };
        warnings.push(`${beat.role}: pace alterado para fast`);
        duration = estimateBeatDurationSec(beats[index]!, wpm);
      }

      if (duration > limits.maxSec * 1.45) {
        const overflowRoles = MOVE_OVERFLOW_ROLES[beat.role] ?? [];
        for (const targetRole of overflowRoles) {
          const targetIndex = beats.findIndex((entry) => entry.role === targetRole);
          if (targetIndex < 0) continue;
          const targetBeat = beats[targetIndex]!;
          const words = beat.text.split(/\s+/).filter(Boolean);
          if (words.length <= 6) break;
          const moved = words.slice(-4).join(" ");
          const trimmed = words.slice(0, -4).join(" ").trim();
          if (!trimmed || trimmed.split(/\s+/).length < 4) break;
          beats[index] = { ...beat, text: trimmed };
          beats[targetIndex] = {
            ...targetBeat,
            text: `${targetBeat.text} ${moved}`.trim()
          };
          warnings.push(`${beat.role}: trecho movido para ${targetRole}`);
          duration = estimateBeatDurationSec(beats[index]!, wpm);
          break;
        }
      }
    } else {
      warnings.push(`${beat.role}: levemente longo (${duration}s, limite ${limits.maxSec}s)`);
    }

    const finalDuration = estimateBeatDurationSec(beats[index]!, wpm);
    const finalRatio = limits.maxSec > 0 ? finalDuration / limits.maxSec : 1;
    if (finalRatio > 1.45) {
      blocking = true;
      warnings.push(`${beat.role}: ainda acima de 45% do limite após correção`);
    }
  }

  const estimatedTotal = totalDuration(beats, wpm);
  if (estimatedTotal > input.targetDurationSec * 1.3) {
    blocking = true;
    warnings.push(
      `duração total ${estimatedTotal}s excede alvo ${input.targetDurationSec}s em mais de 30%`
    );
  }

  const severity: BeatDurationSeverity = blocking
    ? "blocking"
    : warnings.length > 0
      ? "warning"
      : "info";

  return {
    ok: !blocking,
    severity,
    warnings,
    correctedBeats: beats
  };
}