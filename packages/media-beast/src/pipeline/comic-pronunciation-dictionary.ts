export type ComicPronunciationEntry = {
  label: string;
  displayPattern: RegExp;
  spokenReplacement: string;
  reason: string;
};

export type ComicPronunciationResult = {
  spokenText: string;
  appliedLabels: string[];
  displayTextSafe: boolean;
};

const CANONICAL_TEXT_FIXES: Array<[RegExp, string, string]> = [
  [/\bB(?:e|\u00e9)tim(?:e|a|e)?m?\b/gi, "Batman", "Batman"],
  [/\bB(?:e|\u00e9)tman\b/gi, "Batman", "Batman"],
  [/\bG(?:o|\u00f3)tam\b/gi, "Gotham", "Gotham"],
  [/\bN(?:e|\u00ea)o\s+Coringa\b/gi, "Neo Coringa", "Neo Coringa"],
  [/\bJ(?:a|\u00e1)ke\s+Napier\b/gi, "Jack Napier", "Jack Napier"],
  [/\b(?:A|\u00c1)sa\s+Not(?:u|\u00fa)ryna\b|(?:A|\u00c1)sa\s+Not(?:u|\u00fa)ryna/gi, "Asa Noturna", "Asa Noturna"],
  [/\bG(?:o|\u00f3)rdon\b/gi, "Gordon", "Gordon"],
  [/\bG(?:e|\u00ea)\s+T(?:e|\u00ea)\s+(?:O|\u00d3)\b|G(?:e|\u00ea)\s+T(?:e|\u00ea)\s+(?:O|\u00d3)/gi, "GTO", "GTO"],
  [/\bfor\uFFFDa\b/gi, "for\u00e7a", "forca"],
  [/\bdestrui\uFFFD\uFFFDo\b/gi, "destrui\u00e7\u00e3o", "destruicao"],
  [/\ba\uFFFD\uFFFDo\b/gi, "a\u00e7\u00e3o", "acao"],
];
const PT_BR_DIACRITIC_FIXES: Array<[RegExp, string]> = [
  [/\bQuestao\b/g, "Questão"],
  [/\bquestao\b/gi, "questão"],
  [/\bTres\b/g, "Três"],
  [/\btres\b/gi, "três"],
  [/\bEntao\b/g, "Então"],
  [/\bentao\b/gi, "então"],
  [/\btelevisao\b/gi, "televisão"],
  [/\bninguem\b/gi, "ninguém"],
  [/\bviolencia\b/gi, "violência"],
  [/\bseguranca\b/gi, "segurança"],
  [/\bnao\b/gi, "não"],
  [/\bmudanca\b/gi, "mudança"],
  [/\bsalvacao\b/gi, "salvação"],
  [/\bherois\b/gi, "heróis"],
  [/\bfabricas\b/gi, "fábricas"],
  [/\bproducao\b/gi, "produção"],
  [/\bArtico\b/g, "Ártico"],
  [/\bartico\b/gi, "ártico"],
  [/\binstalacao\b/gi, "instalação"],
  [/\bvigilancia\b/gi, "vigilância"],
  [/\bexploracao\b/gi, "exploração"],
  [/\bsacrificio\b/gi, "sacrifício"],
  [/\bnecessario\b/gi, "necessário"],
  [/\bporem\b/gi, "porém"],
  [/\bresistencia\b/gi, "resistência"],
  [/\bversao\b/gi, "versão"],
  [/\bunica\b/gi, "única"],
  [/\bameaca\b/gi, "ameaça"],
  [/\bsaida\b/gi, "saída"],
  [/\baviao\b/gi, "avião"],
  [/\bcombustivel\b/gi, "combustível"],
  [/\bsatelites\b/gi, "satélites"],
  [/\bcomunicacao\b/gi, "comunicação"],
  [/\bconclusao\b/gi, "conclusão"],
  [/\bmetodos\b/gi, "métodos"],
  [/\bforcado\b/gi, "forçado"],
  [/\bheroi\b/gi, "herói"],
  [/\bperseguicao\b/gi, "perseguição"],
  [/\bdestruicao\b/gi, "destruição"],
  [/\bcameras\b/gi, "câmeras"],
  [/\bcamera\b/gi, "câmera"],
  [/\bsimbolo\b/gi, "símbolo"],
  [/\bpolicia\b/gi, "polícia"],
  [/\bviloes\b/gi, "vilões"],
  [/\balguem\b/gi, "alguém"],
  [/\bfamilia\b/gi, "família"],
  [/\btambem\b/gi, "também"],
  [/\bmissao\b/gi, "missão"],
  [/\brazao\b/gi, "razão"],
  [/\btuneis\b/gi, "túneis"],
  [/\bpreco\b/gi, "preço"],
  [/\bproprio\b/gi, "próprio"],
  [/\bvitoria\b/gi, "vitória"],
  [/\bunico\b/gi, "único"],
  [/\bso\b/gi, "só"],
];

export const comicTtsPronunciationDictionary: ComicPronunciationEntry[] = [
  { label: "forca", displayPattern: /\bforca\b/gi, spokenReplacement: "for\u00e7a", reason: "restore cedilla before TTS" },
  { label: "acao", displayPattern: /\bacao\b/gi, spokenReplacement: "a\u00e7\u00e3o", reason: "restore diacritic before TTS" },
  { label: "destruicao", displayPattern: /\bdestruicao\b/gi, spokenReplacement: "destrui\u00e7\u00e3o", reason: "restore diacritics before TTS" },
  { label: "policia", displayPattern: /\bpolicia\b/gi, spokenReplacement: "pol\u00edcia", reason: "restore diacritic before TTS" },
  { label: "camera", displayPattern: /\bcameras?\b/gi, spokenReplacement: "c\u00e2meras", reason: "restore diacritic before TTS" },
  { label: "controle", displayPattern: /\bcontr\u00f3le\b/gi, spokenReplacement: "controle", reason: "avoid unnatural stress" },
];

const VOICEBOX_QWEN_SPOKEN_SAFETY: Array<[RegExp, string, string]> = [
  [/\bGTO\b/g, "for\u00e7a policial de Gotham", "GTO"],
  [/\bNeo Coringa\b/gi, "a nova Coringa", "Neo Coringa"],
  [/\bHarley\b(?!\s+Quinn)/gi, "Harley Quinn", "Harley"],
  [/\bsuperarma\b/gi, "arma final", "superarma"],
];

const PHONETIC_DISPLAY_LEAK = /\b(?:B(?:e|\u00e9)tman|B(?:e|\u00e9)timem?|G(?:o|\u00f3)tam|N(?:e|\u00ea)o\s+Coringa|J(?:a|\u00e1)ke\s+Napier|A(?:s|z)a\s+Not(?:u|\u00fa)ryna|G(?:e|\u00ea)\s+T(?:e|\u00ea)\s+(?:O|\u00d3)|Superm\u00e3n|Godz\u00edla|L\u00e9ks|L\u00fator|Cl\u00e1rk|L\u00f4is|Fl\u00e9sh)\b/i;

export function sanitizeComicNarrationText(text: string): ComicPronunciationResult {
  const appliedLabels: string[] = [];
  let spokenText = restorePtBrDiacriticsForComicNarration(text);
  for (const [pattern, replacement, label] of CANONICAL_TEXT_FIXES) {
    if (pattern.test(spokenText)) {
      appliedLabels.push(label);
      spokenText = spokenText.replace(pattern, replacement);
    }
    pattern.lastIndex = 0;
  }
  for (const entry of comicTtsPronunciationDictionary) {
    if (entry.displayPattern.test(spokenText)) {
      appliedLabels.push(entry.label);
      spokenText = spokenText.replace(entry.displayPattern, entry.spokenReplacement);
    }
    entry.displayPattern.lastIndex = 0;
  }
  spokenText = spokenText
    .replace(/\uFFFD/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return {
    spokenText,
    appliedLabels: [...new Set(appliedLabels)],
    displayTextSafe: !PHONETIC_DISPLAY_LEAK.test(text),
  };
}
export function restorePtBrDiacriticsForComicNarration(text: string) {
  let normalizedText = text.normalize("NFC");
  for (const [pattern, replacement] of PT_BR_DIACRITIC_FIXES) {
    normalizedText = normalizedText.replace(pattern, replacement);
    pattern.lastIndex = 0;
  }
  return normalizedText;
}

export function applyComicTtsPronunciation(text: string): ComicPronunciationResult {
  return sanitizeComicNarrationText(text);
}

export function prepareComicNarrationForVoiceboxQwen(text: string): ComicPronunciationResult {
  const base = sanitizeComicNarrationText(text);
  const appliedLabels = [...base.appliedLabels];
  let spokenText = base.spokenText;
  for (const [pattern, replacement, label] of VOICEBOX_QWEN_SPOKEN_SAFETY) {
    if (pattern.test(spokenText)) {
      appliedLabels.push(`voicebox-safe-${label}`);
      spokenText = spokenText.replace(pattern, replacement);
    }
    pattern.lastIndex = 0;
  }
  spokenText = spokenText
    .replace(/,\s*([^,.!?]{1,24}),\s*/g, ". $1. ")
    .replace(/\s+/g, " ")
    .trim();
  return {
    spokenText,
    appliedLabels: [...new Set(appliedLabels)],
    displayTextSafe: base.displayTextSafe,
  };
}

export function assertComicDisplayTextHasNoPhoneticLeak(text: string) {
  return !PHONETIC_DISPLAY_LEAK.test(text);
}



