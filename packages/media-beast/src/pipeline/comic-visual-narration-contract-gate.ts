import type { ComicNarratorDirectorCue } from "./comic-narrator-director.js";

export type ComicVisualNarrationContractReview = {
  phraseId: string;
  sourceBeatIndex: number;
  spokenText: string;
  expectedTerms: string[];
  visualTerms: string[];
  matchedTerms: string[];
  coverage: number;
  evidenceConfidence: number;
  evidenceSources: string[];
  requestedTargets: string[];
  verifiedTargets: string[];
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
const DOMAIN_VISUAL_TERMS = new Set(["batman", "superman", "godzilla", "godzila", "lex", "luthor", "lutor", "caixa", "materna", "portal", "cidade", "golpe", "monstros", "monstro", "arma", "poeira", "kong", "mutano", "lois", "clark", "flash", "lanterna", "verde", "titans", "titas", "jack", "napier", "coringa", "gotham", "fundo", "devastacao", "bairro", "investidores", "lucro", "chapeleiro", "louco", "cara", "barro", "viloes", "criminosos", "controle", "tecnologia", "dick", "asa", "noturna", "barbara", "alfred", "jason", "robin", "bruce", "familia", "gordon", "policia", "unidade", "gto", "comunicacao", "cameras"]);

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
  const emphasis = (cue.emphasisWords ?? []).map(normalize).filter((term) => DOMAIN_VISUAL_TERMS.has(term));
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
    evidenceTerms?: string[];
    evidenceConfidence?: number;
    evidenceSource?: "detector" | "editorial_audit" | "ocr" | "metadata" | null;
    evidenceWarnings?: string[];
  }>;
}): ComicVisualNarrationContractGate {
  const reviews = input.cues.map((cue, cueIndex): ComicVisualNarrationContractReview => {
    const alignedVisual = input.visuals[cueIndex];
    const visuals = alignedVisual?.sourceBeatIndex === cue.sourceBeatIndex
      ? [alignedVisual]
      : input.visuals.filter((visual) => visual.sourceBeatIndex === cue.sourceBeatIndex);
    // Narration text and requested focus targets are intentions, not visual proof.
    // Only detector/editorial evidence and explicitly verified targets may satisfy the contract.
    const visualTerms = termsFrom(visuals.map((visual) => `${(visual.evidenceTerms ?? []).join(" ")} ${(visual.verifiedFocusTargets ?? []).join(" ")}`).join(" "));
    const expectedTerms = expectedFocusTerms(cue);
    const matchedTerms = expectedTerms.filter((term) => visualTerms.includes(term));
    const coverage = expectedTerms.length === 0 ? 1 : round(matchedTerms.length / expectedTerms.length);
    const isAbstractBridge = expectedTerms.length <= 2 && /\b(?:pergunta|problema|questao|agora|outra|maior|entao)\b/i.test(cue.spokenText);
    const evidenceConfidence = round(Math.max(0, ...visuals.map((visual) => visual.evidenceConfidence ?? 0)));
    const evidenceSources = [...new Set(visuals.map((visual) => visual.evidenceSource).filter((source): source is NonNullable<typeof source> => Boolean(source)))];
    const requestedTargets = [...new Set(visuals.map((visual) => visual.focusTarget).filter((target): target is string => Boolean(target)))];
    const verifiedTargets = [...new Set(visuals.flatMap((visual) => visual.verifiedFocusTargets ?? []))];
    const hasConcreteEvidence = visualTerms.length > 0 && evidenceSources.length > 0 && evidenceConfidence >= 0.65;
    const hasUnverifiedNamedTarget = requestedTargets.length > 0 && verifiedTargets.length === 0;
    const status = expectedTerms.length === 0 || isAbstractBridge
      ? "passed"
      : hasConcreteEvidence && !hasUnverifiedNamedTarget && coverage >= 0.5
        ? "passed"
        : hasConcreteEvidence && coverage >= 0.25
          ? "warning"
          : "rejected";
    return {
      phraseId: cue.phraseId,
      sourceBeatIndex: cue.sourceBeatIndex,
      spokenText: cue.spokenText,
      expectedTerms,
      visualTerms,
      matchedTerms,
      coverage,
      evidenceConfidence,
      evidenceSources,
      requestedTargets,
      verifiedTargets,
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
