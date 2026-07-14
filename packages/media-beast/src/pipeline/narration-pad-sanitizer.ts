import { shortenForSpeech } from "./narration-curiosity-engine.js";

const WEAK_PAD_PATTERNS: RegExp[] = [
  /\bSem repetir o visual\.?\s*/gi,
  /\bSem repetir o que já está na tela\.?\s*/gi,
  /\bSem repetir a imagem[^.!?]*[.!?]\s*/gi,
  /\bO contexto muda a leitura\.?\s*/gi,
  /\bÉ aqui que fica interessante\.?\s*/gi,
  /\bAqui que fica interessante[^.!?]*[.!?]\s*/gi,
  /\bO detalhe vem já já\.?\s*/gi,
  /\bO detalhe vem ja ja\.?\s*/gi,
  /\bA leitura muda com esse contexto\.?\s*/gi,
  /\bRepara nisso\.?\s*/gi,
  /\bEsse lance parece simples[^.!?]*[.!?]\s*/gi,
  /\bEm poucos segundos você entende o recorte\.?\s*/gi,
  /\bE o gancho é direto\.?\s*/gi,
  /\bÉ esse o ponto central\.?\s*/gi,
  /\bA virada vem agora\.?\s*/gi,
  /\bContexto que segura atenção:\s*/gi,
  /\bSem repetir o visual:\s*/gi,
  /\bNo meio do vídeo:\s*/gi,
  /\bPromessa direta: contexto sem enrolação\.?\s*/gi,
  /\bFica até o fim[^.!?]*[.!?]\s*/gi
];

const TRUNCATION_REPAIRS: Array<{ pattern: RegExp; replacement: string }> = [
  {
    pattern: /\bligação entre\.?\s*$/i,
    replacement: "ligaçao entre os dois."
  },
  {
    pattern: /\bligacao entre\.?\s*$/i,
    replacement: "ligacao entre os dois."
  },
  {
    pattern: /\bdupla perfeita e a ligação entre\.?\s*$/i,
    replacement: "dupla perfeita e a ligaçao entre os dois."
  },
  {
    pattern: /\bideia de dupla perfeita e a ligação entre\.?\s*$/i,
    replacement: "ideia de dupla perfeita e a ligaçao entre os dois."
  },
  {
    pattern: /\bdupla perfeita e a ligação entre\.(?!\s*os\b)/gi,
    replacement: "dupla perfeita e a ligação entre os dois."
  },
  {
    pattern: /\bideia de dupla perfeita e a ligação entre\.(?!\s*os\b)/gi,
    replacement: "ideia de dupla perfeita e a ligação entre os dois."
  },
  {
    pattern: /\bentre os dois\.?\s+entre os dois\.?\s*/gi,
    replacement: "entre os dois. "
  },
  {
    pattern: /\b(os dois)\s+\1\b/gi,
    replacement: "$1"
  },
  {
    pattern: /\b(ligação entre os dois)\s+os dois\b/gi,
    replacement: "$1"
  }
];

export function repairTruncatedPhrases(text: string): string {
  let repaired = text.trim();
  for (const rule of TRUNCATION_REPAIRS) {
    repaired = repaired.replace(rule.pattern, rule.replacement);
  }
  return repaired.replace(/\s{2,}/g, " ").replace(/\s+([,.!?])/g, "$1").trim();
}

export function stripWeakNarrationPads(text: string): string {
  let cleaned = text;
  for (const pattern of WEAK_PAD_PATTERNS) {
    cleaned = cleaned.replace(pattern, " ");
  }
  return repairTruncatedPhrases(
    cleaned
      .replace(/\s+([,.!?])/g, "$1")
      .replace(/([.!?])\s*([.!?])+/g, "$1")
      .replace(/\s{2,}/g, " ")
      .trim()
  );
}

const LOW_VALUE_EXPANSION_PATTERNS: RegExp[] = [
  /#[\p{L}\p{N}_]+/u,
  /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u,
  /\bdomínio:/i,
  /\bplataforma:/i,
  /\bparceiro ideal\s*\/\s*simbiose/i,
  /\bo clipe mostra\b/i
];

function isLowValueExpansionFact(fact: string): boolean {
  const trimmed = fact.trim();
  if (trimmed.length < 22) return true;
  if (LOW_VALUE_EXPANSION_PATTERNS.some((pattern) => pattern.test(trimmed))) {
    return true;
  }
  if (/^[^:]+:\s*[^.!?]{0,40}\//.test(trimmed)) return true;
  return false;
}

function overlapRatio(left: string, right: string): number {
  const leftWords = new Set(
    left
      .toLowerCase()
      .split(/\s+/)
      .filter((word) => word.length > 3)
  );
  const rightWords = right
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => word.length > 3);
  if (leftWords.size === 0 || rightWords.length === 0) return 0;
  const shared = rightWords.filter((word) => leftWords.has(word)).length;
  return shared / rightWords.length;
}

export function prioritizeExpansionFacts(facts: string[]): string[] {
  return [...facts]
    .map((fact, index) => {
      const trimmed = fact.trim();
      let score = trimmed.length;
      if (isLowValueExpansionFact(trimmed)) score -= 80;
      if (/concurso|escolheu|surgiu|nasceu|anos\s*\d{2}/i.test(trimmed)) score += 35;
      if (/quadrinhos|hq|marvel|simbionte/i.test(trimmed)) score += 18;
      if (trimmed.split(/\s+/).length < 8) score -= 12;
      return { fact: trimmed, score, index };
    })
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .map((entry) => entry.fact);
}

export function expandBeatWithAuthorizedFact(
  text: string,
  authorizedFacts: string[],
  maxExtraWords = 14,
  usedSnippets?: Set<string>
): string {
  const normalized = text.toLowerCase();
  let expanded = text;

  for (const fact of prioritizeExpansionFacts(authorizedFacts)) {
    if (isLowValueExpansionFact(fact)) continue;
    const probe = fact.toLowerCase().slice(0, Math.min(28, fact.length));
    if (normalized.includes(probe)) continue;
    if (usedSnippets?.has(probe)) continue;
    if (overlapRatio(expanded, fact) >= 0.55) continue;

    const snippet = shortenForSpeech(fact, maxExtraWords);
    if (snippet.length < 12 || isLowValueExpansionFact(snippet)) continue;
    const snippetProbe = snippet.toLowerCase().slice(0, Math.min(28, snippet.length));
    if (usedSnippets?.has(snippetProbe)) continue;
    if (overlapRatio(expanded, snippet) >= 0.5) continue;

    usedSnippets?.add(probe);
    usedSnippets?.add(snippetProbe);
    expanded = repairTruncatedPhrases(`${expanded} ${snippet}`.trim());
    if (
      expanded.split(/\s+/).filter(Boolean).length >=
      text.split(/\s+/).filter(Boolean).length + Math.max(6, maxExtraWords - 4)
    ) {
      break;
    }
  }

  return expanded;
}

export function dedupeSentences(text: string): string {
  const parts = text
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
  const unique: string[] = [];

  for (const part of parts) {
    const key = part.toLowerCase().replace(/[^\wà-ú]/gi, "");
    const containedIndex = unique.findIndex((existing) => {
      const existingKey = existing.toLowerCase().replace(/[^\wà-ú]/gi, "");
      return (
        existingKey === key ||
        overlapRatio(existing, part) >= 0.72 ||
        (existingKey.length > 18 && key.startsWith(existingKey.slice(0, Math.min(existingKey.length, 42)))) ||
        (key.length > 18 && existingKey.startsWith(key.slice(0, Math.min(key.length, 42))))
      );
    });
    if (containedIndex >= 0) {
      if (part.length > unique[containedIndex]!.length) {
        unique[containedIndex] = part;
      }
      continue;
    }
    unique.push(part);
  }

  return unique.join(" ").trim();
}

export function sanitizeNarrationForSpeech(text: string): string {
  return dedupeSentences(stripWeakNarrationPads(repairTruncatedPhrases(text)));
}