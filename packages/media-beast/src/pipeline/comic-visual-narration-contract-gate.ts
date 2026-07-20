import type { ComicNarratorDirectorCue } from "./comic-narrator-director.js";

export type ComicVisualNarrationContractReview = {
  phraseId: string;
  sourceBeatIndex: number;
  spokenText: string;
  expectedTerms: string[];
  visualTerms: string[];
  matchedTerms: string[];
  coverage: number;
  status: "passed" | "warning" | "rejected";
  recommendation: string;
};

export type ComicVisualNarrationContractGate = {
  gateId: "comic_visual_narration_contract_gate_v1";
  reviews: ComicVisualNarrationContractReview[];
  averageCoverage: number;
  rejectedCount: number;
  warningCount: number;
  warnings: string[];
  status: "passed" | "rejected";
};

const STOP_WORDS = new Set(["a", "ao", "aos", "as", "com", "da", "das", "de", "do", "dos", "e", "em", "na", "nas", "no", "nos", "o", "os", "para", "por", "que", "sem", "uma", "um", "era", "foi", "isso", "esse", "essa"]);
const ABSTRACT_TERMS = new Set(["pergunta", "problema", "maior", "chegou", "longe", "como", "quem", "tinha", "usado", "quando", "mudou", "deixava", "segundo", "cada", "verdadeiro", "plano", "instavel", "aquele", "todos", "junto", "errassem", "abriu", "acertou"]);
const DOMAIN_VISUAL_TERMS = new Set(["batman", "superman", "godzilla", "godzila", "lex", "luthor", "lutor", "caixa", "materna", "portal", "cidade", "golpe", "monstros", "monstro", "arma", "poeira", "kong", "mutano", "lois", "clark", "flash", "lanterna", "verde", "titans", "titas"]);

function round(value: number) {
  return Math.round(value * 1000) / 1000;
}

function normalize(value: string) {
  return value.toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function termsFrom(text: string) {
  return [...new Set((text.match(/[A-Za-zÀ-ÿ0-9]{4,}/g) ?? []).map(normalize).filter((term) => !STOP_WORDS.has(term)))];
}

function visualFocusTerms(text: string) {
  return termsFrom(text).filter((term) => DOMAIN_VISUAL_TERMS.has(term) || (!ABSTRACT_TERMS.has(term) && /^[A-Z0-9]/.test(term)));
}

function expectedFocusTerms(cue: ComicNarratorDirectorCue) {
  const emphasis = (cue.emphasisWords ?? []).map(normalize).filter((term) => DOMAIN_VISUAL_TERMS.has(term) || !ABSTRACT_TERMS.has(term));
  const spoken = termsFrom(cue.spokenText).filter((term) => DOMAIN_VISUAL_TERMS.has(term));
  return [...new Set([...emphasis, ...spoken])].slice(0, 5);
}

export function evaluateComicVisualNarrationContract(input: {
  cues: ComicNarratorDirectorCue[];
  visuals: Array<{
    sourceBeatIndex: number;
    text?: string;
    focusTarget?: string | null;
    verifiedFocusTargets?: string[] | null;
    evidenceWarnings?: string[];
  }>;
}): ComicVisualNarrationContractGate {
  const reviews = input.cues.map((cue): ComicVisualNarrationContractReview => {
    const visuals = input.visuals.filter((visual) => visual.sourceBeatIndex === cue.sourceBeatIndex);
    const visualTerms = termsFrom(visuals.map((visual) => `${visual.text ?? ""} ${visual.focusTarget ?? ""} ${(visual.verifiedFocusTargets ?? []).join(" ")}`).join(" "));
    const expectedTerms = expectedFocusTerms(cue);
    const matchedTerms = expectedTerms.filter((term) => visualTerms.some((visualTerm) => visualTerm.includes(term) || term.includes(visualTerm)));
    const coverage = expectedTerms.length === 0 ? 1 : round(matchedTerms.length / expectedTerms.length);
    const isAbstractBridge = expectedTerms.length <= 2 && /\b(?:pergunta|problema|questao|agora|outra|maior|entao)\b/i.test(cue.spokenText);
    const status = expectedTerms.length === 0 || isAbstractBridge || coverage >= 0.45 ? "passed" : coverage >= 0.25 ? "warning" : "rejected";
    return {
      phraseId: cue.phraseId,
      sourceBeatIndex: cue.sourceBeatIndex,
      spokenText: cue.spokenText,
      expectedTerms,
      visualTerms,
      matchedTerms,
      coverage,
      status,
      recommendation: status === "passed" ? "visual_proves_narration" : "trocar painel/crop: a fala promete termos que nao aparecem claramente na tela",
    };
  });
  const rejectedCount = reviews.filter((review) => review.status === "rejected").length;
  const warningCount = reviews.filter((review) => review.status === "warning").length;
  const concreteReviews = reviews.filter((review) => review.expectedTerms.length > 0 && !/\b(?:pergunta|problema|questao|agora|outra|maior|entao)\b/i.test(review.spokenText));
  const averageCoverage = round(concreteReviews.reduce((sum, review) => sum + review.coverage, 0) / Math.max(1, concreteReviews.length));
  const warnings = [
    ...(rejectedCount > 0 ? [`visual_contract_rejected:${rejectedCount}`] : []),
    ...(averageCoverage < 0.55 ? ["visual_contract_average_coverage_low"] : []),
  ];
  return {
    gateId: "comic_visual_narration_contract_gate_v1",
    reviews,
    averageCoverage,
    rejectedCount,
    warningCount,
    warnings,
    status: warnings.length === 0 ? "passed" : "rejected",
  };
}
