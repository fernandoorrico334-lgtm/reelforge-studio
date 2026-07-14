import { shortenForSpeech } from "./narration-curiosity-engine.js";

export const ENTITY_ALIASES: Record<string, string[]> = {
  "homem aranha": ["homem-aranha", "spider-man", "spiderman", "homemaranha"],
  venom: ["simbionte", "symbiote", "eddie brock"],
  "traje preto": ["uniforme preto", "black suit", "traje negro"]
};

export type TruthGuardInput = {
  facts: string[];
  generatedScript: string;
  topic?: string;
  visualDescription?: string;
  allowedContext?: string[];
  strictness?: "low" | "medium" | "high";
};

export type TruthGuardIssue = {
  type:
    | "unsupported_claim"
    | "possible_hallucination"
    | "invented_date"
    | "invented_number"
    | "invented_name"
    | "legal_risk"
    | "historical_risk"
    | "medical_or_financial_risk";
  severity: "low" | "medium" | "high";
  text: string;
  reason: string;
  suggestion: string;
};

export type TruthGuardResult = {
  ok: boolean;
  score: number;
  issues: TruthGuardIssue[];
  sanitizedScript: string;
  removedOrSoftenedClaims: string[];
  allowedFactsUsed: string[];
  authorizedContextUsed: string[];
};

const SOFTENING_RULES: Array<{
  pattern: RegExp;
  replacement: string;
  type: TruthGuardIssue["type"];
  severity: TruthGuardIssue["severity"];
  reason: string;
}> = [
  {
    pattern: /\btodo mundo sabe que\b/gi,
    replacement: "muita gente associa isso a",
    type: "unsupported_claim",
    severity: "low",
    reason: "generalização não verificável"
  },
  {
    pattern: /\bisso prova que\b/gi,
    replacement: "isso sugere que",
    type: "unsupported_claim",
    severity: "medium",
    reason: "conclusão forte demais"
  },
  {
    pattern: /\ba lei garante\b/gi,
    replacement: "pode haver discussão jurídica sobre",
    type: "legal_risk",
    severity: "high",
    reason: "afirmação jurídica não comprovada"
  },
  {
    pattern: /\bo banco agiu ilegalmente\b/gi,
    replacement: "pode existir indício de irregularidade",
    type: "legal_risk",
    severity: "high",
    reason: "acusação jurídica forte"
  },
  {
    pattern: /\bfoi criado em (\d{4})\b/gi,
    replacement: "",
    type: "invented_date",
    severity: "high",
    reason: "data não autorizada"
  },
  {
    pattern: /\bem (\d{4})\b/gi,
    replacement: "",
    type: "invented_date",
    severity: "high",
    reason: "data não autorizada"
  },
  {
    pattern: /\bgarante resultado\b/gi,
    replacement: "pode influenciar o resultado",
    type: "medical_or_financial_risk",
    severity: "high",
    reason: "promessa de resultado"
  },
  {
    pattern: /\bmilagre\b/gi,
    replacement: "efeito perceptível",
    type: "medical_or_financial_risk",
    severity: "medium",
    reason: "promessa exagerada"
  },
  {
    pattern: /\bcomprovadamente\b/gi,
    replacement: "pelo que os registros indicam",
    type: "unsupported_claim",
    severity: "medium",
    reason: "certeza não suportada"
  },
  {
    pattern: /\bsegundo a jurisprudência\b/gi,
    replacement: "em discussões jurídicas",
    type: "legal_risk",
    severity: "high",
    reason: "referência jurídica não autorizada"
  },
  {
    pattern: /\bartigo \d+/gi,
    replacement: "norma aplicável",
    type: "legal_risk",
    severity: "high",
    reason: "artigo de lei não autorizado"
  }
];

const COMMON_PT = new Set([
  "esse", "essa", "isso", "aqui", "onde", "quando", "porque", "sobre", "mesmo",
  "ainda", "agora", "depois", "antes", "detalhe", "cena", "video", "clipe",
  "momento", "historia", "fato", "ponto", "parte", "trecho", "abertura",
  "repara", "volta", "comenta", "fica", "olha", "vamos", "entender", "revela",
  "virada", "pode", "pode", "haver", "existe", "parece", "sugere", "muita",
  "gente", "todo", "mundo", "ninguem", "sempre", "nunca", "tambem", "muito",
  "mais", "menos", "como", "qual", "quem", "para", "pelo", "pela", "pelos",
  "pelas", "numa", "num", "nas", "nos", "dos", "das", "que", "com", "sem"
]);

export function normalizeToken(token: string): string {
  return token
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

export function normalizePhrase(phrase: string): string {
  return phrase
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[-_/]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function simplePlural(token: string): string[] {
  const variants = [token];
  if (token.endsWith("s") && token.length > 4) {
    variants.push(token.slice(0, -1));
  } else if (!token.endsWith("s")) {
    variants.push(`${token}s`);
  }
  return variants;
}

function expandEntityAliases(terms: string[]): string[] {
  const expanded = new Set<string>();
  for (const term of terms) {
    const normalized = normalizePhrase(term);
    if (!normalized) continue;
    expanded.add(normalized);
    expanded.add(normalized.replace(/\s+/g, ""));

    for (const variant of simplePlural(normalized.replace(/\s+/g, ""))) {
      expanded.add(variant);
    }

    for (const [canonical, aliases] of Object.entries(ENTITY_ALIASES)) {
      const canonicalNorm = normalizePhrase(canonical);
      const aliasNorms = aliases.map((alias) => normalizePhrase(alias));
      const matchesCanonical =
        normalized.includes(canonicalNorm) ||
        canonicalNorm.includes(normalized) ||
        aliasNorms.some(
          (alias) => normalized.includes(alias) || alias.includes(normalized)
        );

      if (matchesCanonical) {
        expanded.add(canonicalNorm);
        expanded.add(canonicalNorm.replace(/\s+/g, ""));
        for (const alias of aliasNorms) {
          expanded.add(alias);
          expanded.add(alias.replace(/\s+/g, ""));
        }
      }
    }
  }
  return [...expanded];
}

export function buildAuthorizedNarrationContext(input: {
  facts?: string[];
  curiosityFacts?: string[];
  visualDescription?: string;
  allowedContext?: string[];
  contentIntelligence?: unknown;
  topic?: string;
  title?: string;
  tags?: string[];
}): string[] {
  const context: string[] = [];

  if (input.facts?.length) context.push(...input.facts);
  if (input.curiosityFacts?.length) context.push(...input.curiosityFacts);
  if (input.visualDescription) context.push(input.visualDescription);
  if (input.allowedContext?.length) context.push(...input.allowedContext);
  if (input.topic) context.push(input.topic);
  if (input.title) context.push(input.title);
  if (input.tags?.length) context.push(...input.tags);

  const intel = input.contentIntelligence as
    | {
        entities?: Array<{ name: string }>;
        actions?: Array<{ label: string }>;
        headline?: string;
        summary?: string;
        narrativeBrief?: string;
        narrativeHook?: string;
        curiosityAngle?: string;
      }
    | undefined;

  if (intel) {
    if (intel.headline) context.push(intel.headline);
    if (intel.summary) context.push(intel.summary);
    if (intel.narrativeBrief) context.push(intel.narrativeBrief);
    if (intel.narrativeHook) context.push(intel.narrativeHook);
    if (intel.curiosityAngle) context.push(intel.curiosityAngle);
    if (intel.entities?.length) {
      context.push(...intel.entities.map((entity) => entity.name));
    }
    if (intel.actions?.length) {
      context.push(...intel.actions.map((action) => action.label));
    }
  }

  const expanded = expandEntityAliases(context);
  return [...new Set([...context, ...expanded].filter((entry) => entry.trim().length > 0))];
}

export function isAuthorizedEntity(
  entity: string,
  authorizedContext: string[]
): boolean {
  const normalizedEntity = normalizePhrase(entity);
  if (!normalizedEntity) return false;

  const expanded = expandEntityAliases(authorizedContext);
  const entityCompact = normalizedEntity.replace(/\s+/g, "");

  for (const entry of expanded) {
    const entryNorm = normalizePhrase(entry);
    const entryCompact = entryNorm.replace(/\s+/g, "");
    if (
      normalizedEntity === entryNorm ||
      entityCompact === entryCompact ||
      normalizedEntity.includes(entryNorm) ||
      entryNorm.includes(normalizedEntity)
    ) {
      return true;
    }
  }

  return false;
}

type FactCorpus = {
  tokens: Set<string>;
  years: Set<string>;
  numbers: Set<string>;
  phrases: string[];
  authorizedEntities: string[];
};

function buildFactCorpus(
  facts: string[],
  allowedContext?: string[],
  visualDescription?: string,
  topic?: string,
  authorizedEntities?: string[]
): FactCorpus {
  const sources = [
    ...facts,
    ...(allowedContext ?? []),
    visualDescription ?? "",
    topic ?? ""
  ].filter(Boolean);

  const joined = sources.join(" ");
  const tokens = new Set<string>();
  const years = new Set<string>();
  const numbers = new Set<string>();

  for (const word of joined.split(/\s+/)) {
    const token = normalizeToken(word);
    if (token.length > 2) tokens.add(token);
    for (const variant of simplePlural(token)) {
      if (variant.length > 2) tokens.add(variant);
    }
  }

  for (const phrase of sources) {
    const normalizedPhrase = normalizePhrase(phrase);
    if (normalizedPhrase.length > 3) {
      tokens.add(normalizedPhrase.replace(/\s+/g, ""));
      for (const part of normalizedPhrase.split(/\s+/)) {
        const token = normalizeToken(part);
        if (token.length > 2) tokens.add(token);
      }
    }
  }

  for (const entity of authorizedEntities ?? []) {
    const normalized = normalizePhrase(entity);
    tokens.add(normalized.replace(/\s+/g, ""));
    for (const part of normalized.split(/\s+/)) {
      const token = normalizeToken(part);
      if (token.length > 2) tokens.add(token);
    }
  }

  for (const year of joined.matchAll(/\b(1[6-9]\d{2}|20\d{2})\b/g)) {
    years.add(year[1]!);
    tokens.add(year[1]!);
  }

  for (const number of joined.matchAll(/\b\d+(?:[.,]\d+)?%?\b/g)) {
    numbers.add(number[0]!);
    tokens.add(normalizeToken(number[0]!));
  }

  return {
    tokens,
    years,
    numbers,
    phrases: sources.filter((s) => s.length > 10),
    authorizedEntities: authorizedEntities ?? []
  };
}

export function extractPossibleClaims(script: string): string[] {
  const sentences = script
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const claims: string[] = [];
  for (const sentence of sentences) {
    claims.push(sentence);
    const clauses = sentence.split(/[,;—–-]\s+/).filter((c) => c.trim().length > 12);
    claims.push(...clauses.map((c) => c.trim()));
  }

  return [...new Set(claims)].filter((c) => c.length > 8);
}

export function claimSeemsSupportedByFacts(
  claim: string,
  facts: string[],
  allowedContext?: string[]
): boolean {
  const corpus = buildFactCorpus(facts, allowedContext);
  const claimLower = claim.toLowerCase();

  for (const phrase of corpus.phrases) {
    if (phrase.length > 12 && claimLower.includes(phrase.toLowerCase().slice(0, Math.min(phrase.length, 40)))) {
      return true;
    }
  }

  const claimYears = [...claim.matchAll(/\b(1[6-9]\d{2}|20\d{2})\b/g)].map((m) => m[1]!);
  if (claimYears.some((year) => !corpus.years.has(year))) {
    return false;
  }

  const claimNumbers = [...claim.matchAll(/\b\d+(?:[.,]\d+)?%?\b/g)].map((m) => m[0]!);
  if (claimNumbers.some((num) => !corpus.numbers.has(num) && !corpus.tokens.has(normalizeToken(num)))) {
    return false;
  }

  const claimTokens = claim
    .split(/\s+/)
    .map((w) => normalizeToken(w))
    .filter((t) => t.length > 3 && !COMMON_PT.has(t));

  if (claimTokens.length === 0) return true;

  const supportedCount = claimTokens.filter((t) => corpus.tokens.has(t)).length;
  return supportedCount / claimTokens.length >= 0.45;
}

function detectIssuesInClaim(
  claim: string,
  corpus: ReturnType<typeof buildFactCorpus>,
  strictness: TruthGuardInput["strictness"]
): TruthGuardIssue[] {
  const issues: TruthGuardIssue[] = [];
  const strict = strictness ?? "medium";

  for (const year of claim.matchAll(/\b(1[6-9]\d{2}|20\d{2})\b/g)) {
    if (!corpus.years.has(year[1]!)) {
      issues.push({
        type: "invented_date",
        severity: strict === "high" ? "high" : "medium",
        text: claim,
        reason: `ano ${year[1]} não está nos fatos autorizados`,
        suggestion: "remover a data ou suavizar para período genérico"
      });
    }
  }

  for (const number of claim.matchAll(/\b\d+(?:[.,]\d+)?%?\b/g)) {
    const value = number[0]!;
    if (!corpus.numbers.has(value) && !corpus.tokens.has(normalizeToken(value))) {
      issues.push({
        type: "invented_number",
        severity: strict === "high" ? "high" : "medium",
        text: claim,
        reason: `número ${value} não está nos fatos autorizados`,
        suggestion: "remover o número ou citar apenas o que está documentado"
      });
    }
  }

  const properMatches = [
    ...claim.matchAll(/\b([A-ZÀ-Ú][a-zà-ú]+(?:[-/][A-ZÀ-Ú]?[a-zà-ú]+)*)\b/g)
  ];
  for (const proper of properMatches) {
    const name = proper[1]!;
    if (isAuthorizedEntity(name, corpus.authorizedEntities)) {
      continue;
    }
    const token = normalizeToken(name);
    if (!corpus.tokens.has(token) && !COMMON_PT.has(token)) {
      issues.push({
        type: "invented_name",
        severity: strict === "low" ? "medium" : "high",
        text: claim,
        reason: `nome próprio '${name}' não está nos fatos autorizados`,
        suggestion: "remover nome ou usar apenas entidades do input"
      });
    }
  }

  if (/\b(ilegal|garante|jurisprudência|artigo \d+|processo garantido|condenado)\b/i.test(claim)) {
    issues.push({
      type: "legal_risk",
      severity: "high",
      text: claim,
      reason: "linguagem jurídica forte sem base documentada",
      suggestion: "suavizar para 'pode haver discussão' ou 'indício'"
    });
  }

  if (/\b(sempre funcionou|resultado garantido|cura|milagre|lucro certo)\b/i.test(claim)) {
    issues.push({
      type: "medical_or_financial_risk",
      severity: "high",
      text: claim,
      reason: "promessa de resultado não autorizada",
      suggestion: "trocar por linguagem condicional"
    });
  }

  if (/\b(históricamente comprovado|descoberto em|fundado por|criado por)\b/i.test(claim) && issues.length === 0) {
    issues.push({
      type: "historical_risk",
      severity: "medium",
      text: claim,
      reason: "afirmação histórica/bastidor sem fonte explícita",
      suggestion: "suavizar ou remover origem não documentada"
    });
  }

  return issues;
}

function computeTruthScore(issues: TruthGuardIssue[], sanitized: boolean): number {
  if (issues.length === 0) return 100;
  let score = 100;
  for (const issue of issues) {
    const penalty = issue.severity === "high" ? 25 : issue.severity === "medium" ? 12 : 6;
    score -= penalty;
  }
  if (sanitized && score < 80) score = Math.min(score + 15, 79);
  return Math.max(0, Math.min(100, score));
}

export function sanitizeUnsupportedClaims(
  generatedScript: string,
  issues: TruthGuardIssue[]
): string {
  let sanitized = generatedScript;
  const removedOrSoftened: string[] = [];

  for (const rule of SOFTENING_RULES) {
    if (rule.pattern.test(sanitized)) {
      const before = sanitized;
      sanitized = sanitized.replace(rule.pattern, rule.replacement);
      if (before !== sanitized) {
        removedOrSoftened.push(rule.reason);
      }
    }
  }

  for (const issue of issues) {
    const issueText = issue.text?.trim() ?? "";
    if (!issueText) continue;

    if (issue.type === "invented_date" || issue.type === "invented_number") {
      const yearPattern = /\b(1[6-9]\d{2}|20\d{2})\b/g;
      const numPattern = /\b\d+(?:[.,]\d+)?%?\b/g;
      if (issue.type === "invented_date" && yearPattern.test(issueText)) {
        sanitized = sanitized.replace(yearPattern, "").replace(/\s{2,}/g, " ");
        removedOrSoftened.push(issue.reason);
      }
      if (issue.type === "invented_number") {
        for (const num of issueText.match(numPattern) ?? []) {
          sanitized = sanitized.replace(
            new RegExp(`\\b${num.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "g"),
            ""
          );
          removedOrSoftened.push(`número removido: ${num}`);
        }
      }
    }

    if (
      issue.severity === "high" &&
      issueText.length > 10 &&
      sanitized.includes(issueText)
    ) {
      const softened = issue.suggestion?.includes("suavizar")
        ? issueText
            .replace(/\bfoi criado\b/gi, "pode ter surgido")
            .replace(/\bcomprovadamente\b/gi, "pelo que se sabe")
        : "";
      if (softened && softened !== issueText) {
        sanitized = sanitized.replace(issueText, softened);
        removedOrSoftened.push(issue.reason);
      }
    }
  }

  sanitized = sanitized
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.!?])/g, "$1")
    .replace(/^\s*,\s*/g, "")
    .replace(/\.\s*\./g, ".")
    .trim();

  return shortenForSpeech(sanitized, 120);
}

export function validateNarrationTruth(input: TruthGuardInput): TruthGuardResult {
  const strictness = input.strictness ?? "medium";
  const authorizedContext = buildAuthorizedNarrationContext({
    facts: input.facts,
    ...(input.allowedContext ? { allowedContext: input.allowedContext } : {}),
    ...(input.visualDescription ? { visualDescription: input.visualDescription } : {}),
    ...(input.topic ? { topic: input.topic } : {})
  });
  const corpus = buildFactCorpus(
    input.facts,
    [...(input.allowedContext ?? []), ...authorizedContext],
    input.visualDescription,
    input.topic,
    authorizedContext
  );

  const claims = extractPossibleClaims(input.generatedScript);
  const issues: TruthGuardIssue[] = [];
  const allowedFactsUsed: string[] = [];
  const authorizedContextUsed: string[] = [];

  for (const fact of input.facts) {
    if (input.generatedScript.toLowerCase().includes(fact.toLowerCase().slice(0, Math.min(fact.length, 24)))) {
      allowedFactsUsed.push(fact);
    }
  }

  for (const entry of authorizedContext) {
    const normalized = normalizePhrase(entry);
    if (
      normalized.length > 3 &&
      normalizePhrase(input.generatedScript).includes(normalized)
    ) {
      authorizedContextUsed.push(entry);
    }
  }

  for (const claim of claims) {
    const hasInventedDateOrNumber = [...claim.matchAll(/\b(1[6-9]\d{2}|20\d{2})\b/g)].some(
      (year) => !corpus.years.has(year[1]!)
    ) || [...claim.matchAll(/\b\d+(?:[.,]\d+)?%?\b/g)].some(
      (num) => !corpus.numbers.has(num[0]!) && !corpus.tokens.has(normalizeToken(num[0]!))
    );

    const entityOnlyClaim = properMatchesFromClaim(claim).every((name) =>
      isAuthorizedEntity(name, authorizedContext)
    );

    if (
      !hasInventedDateOrNumber &&
      !claimSeemsSupportedByFacts(claim, input.facts, input.allowedContext) &&
      !entityOnlyClaim
    ) {
      issues.push({
        type: "unsupported_claim",
        severity: strictness === "high" ? "high" : "medium",
        text: claim,
        reason: "afirmação não claramente suportada pelos fatos",
        suggestion: "suavizar ou remover trecho não documentado"
      });
    }
    issues.push(...detectIssuesInClaim(claim, corpus, strictness));
  }

  const uniqueIssues = issues.filter(
    (issue, index, arr) =>
      arr.findIndex((item) => item.text === issue.text && item.type === issue.type) === index
  );

  const removedOrSoftenedClaims: string[] = [];
  let sanitizedScript = input.generatedScript;

  if (uniqueIssues.length > 0) {
    sanitizedScript = sanitizeUnsupportedClaims(input.generatedScript, uniqueIssues);
    removedOrSoftenedClaims.push(
      ...uniqueIssues.map((issue) => `${issue.type}: ${issue.reason}`)
    );
  }

  const score = computeTruthScore(uniqueIssues, sanitizedScript !== input.generatedScript);
  const ok = uniqueIssues.length === 0 && score >= 80;

  return {
    ok,
    score,
    issues: uniqueIssues,
    sanitizedScript,
    removedOrSoftenedClaims: [...new Set(removedOrSoftenedClaims)],
    allowedFactsUsed: [...new Set(allowedFactsUsed)],
    authorizedContextUsed: [...new Set(authorizedContextUsed)]
  };
}

function properMatchesFromClaim(claim: string): string[] {
  return [
    ...claim.matchAll(/\b([A-ZÀ-Ú][a-zà-ú]+(?:[-/][A-ZÀ-Ú]?[a-zà-ú]+)*)\b/g)
  ].map((match) => match[1]!);
}