export type ComicRetentionBeatInput = {
  beatId: string;
  role: string;
  narrationLine: string;
  literalFact: string;
  characterIntent?: string;
  hiddenInformation?: string;
  stakes?: string;
};

export type ComicRetentionRewriteGate = {
  gateId: "comic_retention_rewrite_gate_v1";
  status: "passed" | "rejected";
  score: number;
  descriptiveBeatIds: string[];
  weakBeatIds: string[];
  unsupportedBeatIds: string[];
  metrics: { intentCoverage: number; stakesCoverage: number; causalLanguageCoverage: number; openLoopCoverage: number; concreteFactCoverage: number };
  rewriteInstructions: string[];
};

const META_LANGUAGE = /\b(?:na hq|nesta pagina|nesse painel|a cena mostra|vemos|podemos ver|em seguida|depois disso|o personagem)\b/i;
const CAUSAL_LANGUAGE = /\b(?:mas|porque|enquanto|quando|antes que|ate que|sem perceber|por isso|assim|entao|ja|ainda|exatamente)\b/i;
const OPEN_LOOP_LANGUAGE = /\b(?:ninguem|sem imaginar|tarde demais|o problema|o que|so que|ainda|preco|risco|ameaca)\b/i;

function ratio(hits: number, total: number) { return total ? Number((hits / total).toFixed(3)) : 0; }

function sharesConcreteFact(line: string, fact: string) {
  const stop = new Set(["para", "como", "mais", "quando", "entao", "uma", "com", "dos", "das", "que"]);
  const words = fact.toLowerCase().match(/[a-z0-9\u00c0-\u00ff]{4,}/g) ?? [];
  const anchors = [...new Set(words.filter((word) => !stop.has(word)))];
  const normalized = line.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return anchors.some((word) => normalized.includes(word.normalize("NFD").replace(/[\u0300-\u036f]/g, "")));
}

export function evaluateComicRetentionRewriteGate(input: { beats: ComicRetentionBeatInput[]; minimumScore?: number }): ComicRetentionRewriteGate {
  const minimumScore = input.minimumScore ?? 78;
  const descriptiveBeatIds = input.beats.filter((beat) => META_LANGUAGE.test(beat.narrationLine)).map((beat) => beat.beatId);
  const unsupportedBeatIds = input.beats.filter((beat) => !sharesConcreteFact(beat.narrationLine, beat.literalFact)).map((beat) => beat.beatId);
  const weakBeatIds = input.beats.filter((beat) => {
    const words = beat.narrationLine.split(/\s+/).filter(Boolean).length;
    return words < 8 || words > 38 || (!CAUSAL_LANGUAGE.test(beat.narrationLine) && !OPEN_LOOP_LANGUAGE.test(beat.narrationLine));
  }).map((beat) => beat.beatId);
  const total = input.beats.length;
  const intentCoverage = ratio(input.beats.filter((beat) => beat.characterIntent || /\b(?:queria|precisava|tentava|planejava|decidiu)\b/i.test(beat.narrationLine)).length, total);
  const stakesCoverage = ratio(input.beats.filter((beat) => beat.stakes || /\b(?:risco|ameaca|destrui|cair|sobreviver|perder|guerra|fim)\b/i.test(beat.narrationLine)).length, total);
  const causalLanguageCoverage = ratio(input.beats.filter((beat) => CAUSAL_LANGUAGE.test(beat.narrationLine)).length, total);
  const openLoopCoverage = ratio(input.beats.filter((beat) => beat.hiddenInformation || OPEN_LOOP_LANGUAGE.test(beat.narrationLine)).length, total);
  const concreteFactCoverage = ratio(total - unsupportedBeatIds.length, total);
  const score = Math.max(0, Math.min(100, Math.round(18 + intentCoverage * 18 + stakesCoverage * 18 + causalLanguageCoverage * 18 + openLoopCoverage * 12 + concreteFactCoverage * 16 - descriptiveBeatIds.length * 12 - weakBeatIds.length * 2 - unsupportedBeatIds.length * 10)));
  const rewriteInstructions: string[] = [];
  if (descriptiveBeatIds.length) rewriteInstructions.push("Remover linguagem que descreve a pagina e narrar a historia diretamente.");
  if (intentCoverage < 0.45) rewriteInstructions.push("Explicitar o que os personagens querem, nao apenas o que fazem.");
  if (stakesCoverage < 0.6) rewriteInstructions.push("Mostrar o que pode ser perdido em cada virada.");
  if (causalLanguageCoverage < 0.65) rewriteInstructions.push("Conectar os beats por causa e consequencia.");
  if (openLoopCoverage < 0.45) rewriteInstructions.push("Abrir perguntas dramaticas e fecha-las apenas na virada seguinte.");
  if (unsupportedBeatIds.length) rewriteInstructions.push("Reancorar toda afirmacao em um fato confirmado da HQ.");
  return { gateId: "comic_retention_rewrite_gate_v1", status: score >= minimumScore && descriptiveBeatIds.length === 0 && unsupportedBeatIds.length === 0 ? "passed" : "rejected", score, descriptiveBeatIds, weakBeatIds, unsupportedBeatIds, metrics: { intentCoverage, stakesCoverage, causalLanguageCoverage, openLoopCoverage, concreteFactCoverage }, rewriteInstructions };
}
