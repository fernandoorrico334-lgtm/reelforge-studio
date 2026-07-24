export type ComicNarrationLanguageReview = {
  beatId: string;
  text: string;
  issues: string[];
};

export type ComicNarrationLanguageGateResult = {
  gateId: "comic_narration_language_gate_v1";
  status: "passed" | "rejected";
  reviews: ComicNarrationLanguageReview[];
  issueCount: number;
};

const BROKEN_PT_BR = /\b(?:Questao|Tres|Entao|televisao|ninguem|violencia|seguranca|nao|mudanca|salvacao|herois|fabricas|producao|Artico|instalacao|vigilancia|exploracao|sacrificio|necessario|porem|resistencia|versao|unica|ameaca|saida|aviao|combustivel|satelites|comunicacao|conclusao|metodos|forcado|heroi|perseguicao|destruicao|cameras|simbolo|policia|viloes|alguem|familia|tambem|missao|razao|tuneis|preco|proprio|vitoria|unico|so)\b/i;
const INTERROGATIVE_OPENING = /^(?:mas\s+)?(?:por que|quem|como|quando|onde|qual|quais|o que|ser[aá] que|conseguiriam?)\b/i;
const PHONETIC_LEAK = /\b(?:B[eé]t-?m[eé]n|B[eé]tman|[ÓO]liver Cu[ií]n|Br[uú]ss U[eê]in)\b/i;

function splitSentences(text: string) {
  return text.match(/[^.!?]+[.!?]?/g)?.map((value) => value.trim()).filter(Boolean) ?? [];
}

export function evaluateComicNarrationLanguage(input: {
  beats: Array<{ beatId: string; narrationLine: string }>;
}): ComicNarrationLanguageGateResult {
  const reviews = input.beats.map((beat): ComicNarrationLanguageReview => {
    const issues: string[] = [];
    const broken = beat.narrationLine.match(BROKEN_PT_BR)?.[0];
    if (broken) issues.push(`missing_pt_br_diacritic:${broken}`);
    if (PHONETIC_LEAK.test(beat.narrationLine)) issues.push("tts_phonetic_text_leaked_into_display_text");
    for (const sentence of splitSentences(beat.narrationLine)) {
      const temporalClause = /^quando\b/i.test(sentence) && sentence.includes(",");
      if (INTERROGATIVE_OPENING.test(sentence) && !temporalClause && !sentence.endsWith("?")) issues.push(`missing_question_mark:${sentence}`);
    }
    return { beatId: beat.beatId, text: beat.narrationLine, issues };
  });
  const issueCount = reviews.reduce((sum, review) => sum + review.issues.length, 0);
  return { gateId: "comic_narration_language_gate_v1", status: issueCount === 0 ? "passed" : "rejected", reviews, issueCount };
}


