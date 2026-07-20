import type { ComicNarrationPerformancePlan } from "./comic-narration-performance-director.js";

export type ComicNarrationActingDirection = {
  phraseId: string;
  sourceBeatId: string;
  sourceBeatIndex: number;
  phraseIndex: number;
  displayText: string;
  actingText: string;
  intention: "hook" | "investigate" | "conceal" | "reveal" | "danger" | "action" | "confront" | "resolve";
  subtext: string;
  endingContour: "fall" | "rise" | "suspend" | "impact";
  emotionalArcPosition: number;
  targetExpressiveRangeDb: number;
  pauseBeforeMs: number;
  pauseAfterMs: number;
  gainDb: number;
  exaggerationOffset: number;
  cfgWeightOffset: number;
  temperatureOffset: number;
  expectedVisualTerms: string[];
};

export type ComicNarrationActingPlan = {
  directorId: "comic_narration_acting_director_v2";
  directions: ComicNarrationActingDirection[];
  intentionCount: number;
  expressivePhraseCoverage: number;
  visualIntentCoverage: number;
  pausePatternWarnings: string[];
  endingContourDistribution: Record<ComicNarrationActingDirection["endingContour"], number>;
  passed: boolean;
};

const STOP_WORDS = new Set(["a", "ao", "aos", "as", "com", "da", "das", "de", "do", "dos", "e", "ela", "ele", "em", "foi", "mais", "mas", "na", "nas", "no", "nos", "o", "os", "para", "por", "que", "se", "sem", "um", "uma"]);

function round(value: number) {
  return Math.round(value * 1000) / 1000;
}

function intentionFor(text: string, emotion: string, narrativeFunction: string): ComicNarrationActingDirection["intention"] {
  if (narrativeFunction === "question") return "hook";
  if (narrativeFunction === "payoff" || emotion === "reveal") return "reveal";
  if (emotion === "impact") return /\b(?:confront|contra|lutar|Batman|Oliver)\b/i.test(text) ? "confront" : "action";
  if (emotion === "urgency") return "danger";
  if (emotion === "suspense") return /\b(?:escond|mentira|nunca|bloque|secreto|misterioso)\b/i.test(text) ? "conceal" : "investigate";
  if (emotion === "resolution") return "resolve";
  return "investigate";
}

function actingText(text: string, intention: ComicNarrationActingDirection["intention"]) {
  const clean = text.trim();
  if (intention === "hook") return clean.endsWith("?") ? clean : clean.replace(/[.!]+$/, "?");
  if (intention === "conceal") return clean.replace(/\.$/, "...");
  if (intention === "reveal" && !clean.includes("...") && clean.length < 90) return clean.replace(/\.$/, "...");
  if ((intention === "action" || intention === "confront") && clean.length < 85) return clean.replace(/\.$/, "!");
  return clean;
}

function endingContourFor(
  intention: ComicNarrationActingDirection["intention"],
  index: number,
): ComicNarrationActingDirection["endingContour"] {
  if (intention === "hook") return "rise";
  if (intention === "conceal") return "suspend";
  if (intention === "danger" || intention === "action" || intention === "confront") return "impact";
  if (intention === "reveal") return index % 2 === 0 ? "suspend" : "fall";
  if (intention === "resolve") return "fall";
  return index % 3 === 0 ? "suspend" : "fall";
}

function pauseVariation(index: number, intention: ComicNarrationActingDirection["intention"]) {
  const afterPattern = [0, 70, -45, 125, -75, 35, 155, -25];
  const beforePattern = [0, 35, 0, 85, 15, 0, 55, 0];
  const impactTrim = intention === "action" || intention === "danger" || intention === "confront" ? -35 : 0;
  const resolutionHold = intention === "resolve" ? 130 : 0;
  return {
    before: beforePattern[index % beforePattern.length] ?? 0,
    after: (afterPattern[index % afterPattern.length] ?? 0) + impactTrim + resolutionHold,
  };
}

function visualTerms(text: string, emphasisWords: string[]) {
  const candidates = [...emphasisWords, ...(text.match(/[A-Za-zÀ-ÿ]{5,}/g) ?? [])]
    .map((word) => word.toLocaleLowerCase("pt-BR"))
    .filter((word) => !STOP_WORDS.has(word));
  return [...new Set(candidates)].slice(0, 5);
}

const ACTING = {
  hook: { range: 15, before: 60, after: 180, gain: -0.2, exaggeration: 0.06, cfg: -0.02, temperature: 0.02, subtext: "Abra uma pergunta e faça o espectador precisar da resposta." },
  investigate: { range: 12, before: 0, after: 90, gain: 0, exaggeration: 0.02, cfg: 0, temperature: 0, subtext: "Conduza a descoberta com curiosidade humana, não como resumo." },
  conceal: { range: 16, before: 70, after: 190, gain: -0.35, exaggeration: 0.07, cfg: -0.025, temperature: 0.025, subtext: "Baixe a voz e sugira que existe algo escondido." },
  reveal: { range: 18, before: 90, after: 220, gain: 0.35, exaggeration: 0.08, cfg: -0.025, temperature: 0.025, subtext: "Segure antes da informação decisiva e entregue a última ideia com peso." },
  danger: { range: 17, before: 0, after: 75, gain: 0.55, exaggeration: 0.08, cfg: -0.025, temperature: 0.035, subtext: "Acelere com tensão crescente, preservando cada palavra." },
  action: { range: 20, before: 0, after: 110, gain: 0.95, exaggeration: 0.07, cfg: -0.025, temperature: 0.035, subtext: "Ataque a frase e marque o verbo da ação." },
  confront: { range: 18, before: 35, after: 150, gain: 0.75, exaggeration: 0.08, cfg: -0.025, temperature: 0.03, subtext: "Dê peso ao conflito entre personagens e sustente a consequência." },
  resolve: { range: 13, before: 60, after: 230, gain: -0.1, exaggeration: 0.03, cfg: 0, temperature: -0.01, subtext: "Feche a resposta, mas preserve a tensão do próximo acontecimento." },
} as const;

export function buildComicNarrationActingPlan(input: { performancePlan: ComicNarrationPerformancePlan }): ComicNarrationActingPlan {
  const total = Math.max(1, input.performancePlan.performances.length - 1);
  const directions = input.performancePlan.performances.map((performance, index): ComicNarrationActingDirection => {
    let intention = intentionFor(performance.text, performance.emotion, performance.narrativeFunction);
    if (intention === "reveal" && performance.narrativeFunction !== "payoff") {
      const revealCycle = ["reveal", "conceal", "danger", "confront"] as const;
      intention = revealCycle[index % revealCycle.length] ?? "reveal";
    }
    const profile = ACTING[intention];
    const pause = pauseVariation(index, intention);
    return {
      phraseId: performance.phraseId,
      sourceBeatId: performance.sourceBeatId,
      sourceBeatIndex: performance.sourceBeatIndex,
      phraseIndex: performance.phraseIndex,
      displayText: performance.text,
      actingText: actingText(performance.text, intention),
      intention,
      subtext: profile.subtext,
      endingContour: endingContourFor(intention, index),
      emotionalArcPosition: round(index / total),
      targetExpressiveRangeDb: profile.range,
      pauseBeforeMs: Math.max(0, profile.before + pause.before),
      pauseAfterMs: Math.max(70, Math.max(performance.pauseAfterMs, profile.after) + pause.after),
      gainDb: profile.gain,
      exaggerationOffset: profile.exaggeration,
      cfgWeightOffset: profile.cfg,
      temperatureOffset: profile.temperature,
      expectedVisualTerms: visualTerms(performance.text, performance.emphasisWords),
    };
  });
  for (let pass = 0; pass < 4; pass += 1) {
    let repaired = false;
    for (let index = 2; index < directions.length; index += 1) {
      const current = directions[index]!;
      const previous = directions[index - 1]!;
      const beforePrevious = directions[index - 2]!;
      const similarAfterPauses =
        Math.abs(current.pauseAfterMs - previous.pauseAfterMs) < 80 &&
        Math.abs(previous.pauseAfterMs - beforePrevious.pauseAfterMs) < 80;
      if (similarAfterPauses) {
        const correction = (index + pass) % 2 === 0 ? 155 + pass * 25 : -105 - pass * 15;
        current.pauseAfterMs = Math.max(70, current.pauseAfterMs + correction);
        repaired = true;
      }
    }
    if (!repaired) break;
  }
  const intentionCount = new Set(directions.map((direction) => direction.intention)).size;
  const expressivePhraseCoverage = round(directions.filter((direction) => direction.targetExpressiveRangeDb >= 12).length / Math.max(1, directions.length));
  const visualIntentCoverage = round(directions.filter((direction) => direction.expectedVisualTerms.length > 0).length / Math.max(1, directions.length));
  const endingContourDistribution = directions.reduce(
    (distribution, direction) => {
      distribution[direction.endingContour] += 1;
      return distribution;
    },
    { fall: 0, rise: 0, suspend: 0, impact: 0 } satisfies Record<ComicNarrationActingDirection["endingContour"], number>,
  );
  const pausePatternWarnings = directions.slice(2).flatMap((direction, index) => {
    const previous = directions[index + 1]!;
    const beforePrevious = directions[index]!;
    const similarAfterPauses =
      Math.abs(direction.pauseAfterMs - previous.pauseAfterMs) < 80 &&
      Math.abs(previous.pauseAfterMs - beforePrevious.pauseAfterMs) < 80;
    return similarAfterPauses ? [`three_similar_pauses_from_phrase_${beforePrevious.phraseId}`] : [];
  });
  const endingContourVariety = Object.values(endingContourDistribution).filter((count) => count > 0).length;
  return {
    directorId: "comic_narration_acting_director_v2",
    directions,
    intentionCount,
    expressivePhraseCoverage,
    visualIntentCoverage,
    pausePatternWarnings,
    endingContourDistribution,
    passed:
      intentionCount >= 4 &&
      expressivePhraseCoverage === 1 &&
      visualIntentCoverage >= 0.9 &&
      pausePatternWarnings.length === 0 &&
      endingContourVariety >= 3,
  };
}

export function evaluateComicNarrationScreenAlignment(input: {
  actingPlan: ComicNarrationActingPlan;
  cues: Array<{ cueId: string; sourceBeatIndex: number; text: string; focusTarget: string | null; startSeconds: number; endSeconds: number }>;
}) {
  const reviews = input.actingPlan.directions.map((direction) => {
    const candidates = input.cues.filter((cue) => cue.sourceBeatIndex === direction.sourceBeatIndex);
    const cue = candidates[Math.min(direction.phraseIndex, Math.max(0, candidates.length - 1))] ?? null;
    const visualText = `${cue?.text ?? ""} ${cue?.focusTarget ?? ""}`.toLocaleLowerCase("pt-BR");
    const matchedTerms = direction.expectedVisualTerms.filter((term) => visualText.includes(term));
    return { phraseId: direction.phraseId, cueId: cue?.cueId ?? null, expectedVisualTerms: direction.expectedVisualTerms, matchedTerms, startSeconds: cue?.startSeconds ?? null, endSeconds: cue?.endSeconds ?? null, aligned: Boolean(cue) && (matchedTerms.length > 0 || candidates.length === 1) };
  });
  const alignedCount = reviews.filter((review) => review.aligned).length;
  const coverage = round(alignedCount / Math.max(1, reviews.length));
  return { gateId: "comic_narration_screen_alignment_v1", status: coverage >= 0.9 ? "passed" : "rejected", coverage, alignedCount, phraseCount: reviews.length, reviews };
}
