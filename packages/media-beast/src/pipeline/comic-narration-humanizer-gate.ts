import type { ComicStoryArcV2 } from "./comic-story-arc-miner-v2.js";
import type { ComicArcScriptDoctorV2Result } from "./comic-arc-script-doctor-v2.js";

export type ComicNarrationHumanizerGate = {
  gateId: "comic_narration_humanizer_gate_v1";
  status: "passed" | "needs_review" | "rejected";
  score: number;
  humanScore: number;
  retentionScore: number;
  oralFlowScore: number;
  specificityScore: number;
  hookHumanityScore: number;
  genericSignals: string[];
  strongLines: string[];
  weakLines: string[];
  rewriteHints: string[];
};

const genericPatterns = [
  /voce nao vai acreditar/i,
  /olha so/i,
  /nesse video/i,
  /algo acontece/i,
  /essa cena/i,
  /neste painel/i,
  /aqui vemos/i,
  /muito interessante/i
];

function noAccent(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function splitLines(script: ComicArcScriptDoctorV2Result) {
  return script.beats.map((beat) => beat.narrationText.trim()).filter(Boolean);
}

function scoreOralFlow(lines: string[]) {
  if (!lines.length) return 0;
  const scores = lines.map((line) => {
    const words = line.split(/\s+/).filter(Boolean).length;
    let score = 74;
    if (words >= 8 && words <= 22) score += 12;
    if (/[.?!]$/.test(line)) score += 4;
    if (/[,:;]{2,}/.test(line)) score -= 8;
    if (words > 28) score -= 14;
    if (words < 5) score -= 10;
    return clampScore(score);
  });
  return Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
}

function scoreSpecificity(input: { arc: ComicStoryArcV2; lines: string[] }) {
  const text = noAccent(input.lines.join(" "));
  const concreteTerms = [...input.arc.characters, ...input.arc.themes, input.arc.type]
    .map(noAccent)
    .filter((term) => term.length >= 3);
  const hits = concreteTerms.filter((term) => text.includes(term)).length;
  const visualWords = ["golpe", "impacto", "pagina", "quadro", "monstro", "ameaca", "virada", "pista", "escala"]
    .filter((term) => text.includes(term)).length;
  return clampScore(58 + hits * 8 + visualWords * 5);
}

export function evaluateComicNarrationHumanizerGate(input: {
  arc: ComicStoryArcV2;
  script: ComicArcScriptDoctorV2Result;
}): ComicNarrationHumanizerGate {
  const lines = splitLines(input.script);
  const fullText = lines.join(" ");
  const genericSignals = genericPatterns
    .filter((pattern) => pattern.test(fullText))
    .map((pattern) => `generic:${pattern.source}`);
  const oralFlowScore = scoreOralFlow(lines);
  const specificityScore = scoreSpecificity({ arc: input.arc, lines });
  const hook = lines[0] ?? "";
  const hookHumanityScore = clampScore(
    62 +
      (/[.?!]$/.test(hook) ? 8 : 0) +
      (/absurdo|pista|virada|contra|quase|escala/i.test(hook) ? 18 : 0) -
      genericSignals.length * 12
  );
  const score = clampScore(
    input.script.humanScore * 0.32 +
      input.script.retentionScore * 0.22 +
      oralFlowScore * 0.18 +
      specificityScore * 0.18 +
      hookHumanityScore * 0.1 -
      genericSignals.length * 10
  );
  const weakLines = lines
    .filter((line) => line.split(/\s+/).length < 5 || genericPatterns.some((pattern) => pattern.test(line)))
    .slice(0, 5);
  const strongLines = lines.filter((line) => /absurdo|impacto|virada|ameaca|escala|pista|contra/i.test(line)).slice(0, 5);
  const rewriteHints: string[] = [];
  if (genericSignals.length) rewriteHints.push("Trocar frases genericas por uma observacao concreta do quadro.");
  if (oralFlowScore < 82) rewriteHints.push("Quebrar frases longas em fala curta, com pausa antes do impacto.");
  if (specificityScore < 82) rewriteHints.push("Citar personagem, acao ou detalhe visual que aparece no painel.");
  if (hookHumanityScore < 82) rewriteHints.push("Abrir com uma frase que pareca descoberta, nao resumo.");
  const status = genericSignals.length > 0 || score < 76 ? "rejected" : score >= 86 ? "passed" : "needs_review";
  return {
    gateId: "comic_narration_humanizer_gate_v1",
    status,
    score,
    humanScore: input.script.humanScore,
    retentionScore: input.script.retentionScore,
    oralFlowScore,
    specificityScore,
    hookHumanityScore,
    genericSignals,
    strongLines,
    weakLines,
    rewriteHints
  };
}
