export const researchSourceTypes = [
  "web_page",
  "wikipedia",
  "wikidata",
  "archive",
  "document",
  "manual_note",
  "book",
  "article",
  "official_record",
  "other"
] as const;

export type ResearchSourceType = (typeof researchSourceTypes)[number];

export const researchFactTypes = [
  "date",
  "person",
  "place",
  "event",
  "quote",
  "context",
  "statistic",
  "allegation",
  "uncertainty",
  "other"
] as const;

export type ResearchFactType = (typeof researchFactTypes)[number];

export const researchConfidenceLevels = [
  "confirmed",
  "likely",
  "disputed",
  "uncertain"
] as const;

export type ResearchConfidence = (typeof researchConfidenceLevels)[number];

export const researchHookTypes = [
  "mystery",
  "shock",
  "question",
  "contrast",
  "timeline",
  "character",
  "revelation",
  "warning",
  "other"
] as const;

export type ResearchHookType = (typeof researchHookTypes)[number];

export const researchOutlineRoles = [
  "hook",
  "context",
  "tension",
  "climax",
  "resolution",
  "cta"
] as const;

export type ResearchOutlineRole = (typeof researchOutlineRoles)[number];

export const researchAssetMediaTypes = [
  "image",
  "video",
  "audio",
  "music",
  "sfx",
  "overlay",
  "document",
  "map",
  "text_card"
] as const;

export type ResearchAssetMediaType = (typeof researchAssetMediaTypes)[number];

export type ResearchEmotionTag =
  | "NEUTRAL"
  | "CURIOUS"
  | "EPIC"
  | "MYSTERIOUS"
  | "DARK"
  | "TENSE"
  | "JOYFUL"
  | "SAD";

export type ResearchCinematicPresetId =
  | "action"
  | "drama"
  | "suspense"
  | "horror"
  | "mystery"
  | "epic"
  | "calm";

export interface ResearchQueryOptions {
  niche?: string | null;
  tone?: string | null;
  language?: string | null;
  targetDuration?: number | null;
  channelName?: string | null;
}

export interface SearchQuerySuggestion {
  id: string;
  query: string;
  reason: string;
}

export interface SearchLinkSuggestion {
  provider: "google";
  label: string;
  query: string;
  url: string;
}

export interface SourceChecklistItem {
  id: string;
  label: string;
  reason: string;
  priority: "high" | "medium" | "low";
}

export interface SourceRankingInput {
  title: string;
  provider: string;
  sourceType: ResearchSourceType;
  url?: string | null;
  author?: string | null;
  publishedAt?: string | null;
  excerpt?: string | null;
  notes?: string | null;
}

export interface RankedSourceCandidate {
  score: number;
  label: "high" | "medium" | "low";
  reasons: string[];
}

export interface HtmlMetadataSummary {
  title: string | null;
  description: string | null;
  canonicalUrl: string | null;
  author: string | null;
  publishedAt: string | null;
  excerpt: string | null;
  text: string;
}

export interface TextHeuristicsSummary {
  title: string | null;
  description: string | null;
  excerpt: string | null;
  text: string;
  headings: string[];
  paragraphs: string[];
  wordCount: number;
  warnings: string[];
}

export interface FactCandidate {
  claim: string;
  factType: ResearchFactType;
  confidence: ResearchConfidence;
  dateValue: string | null;
  people: string[];
  places: string[];
  tags: string[];
  notes: string | null;
}

export interface TimelineCandidate {
  title: string;
  description: string;
  dateValue: string | null;
  location: string | null;
  people: string[];
  confidence: ResearchConfidence;
}

export interface DossierSummaryInput {
  title: string;
  topic: string;
  niche?: string | null;
  tone?: string | null;
  targetDuration?: number | null;
}

export interface DossierSummaryResult {
  summary: string;
  narrativeAngle: string;
  editorialNotes: string[];
  safetyNotes: string[];
}

export interface HookDraft {
  text: string;
  hookType: ResearchHookType;
  strengthScore: number | null;
  notes: string | null;
}

export interface OutlineBuildOptions {
  targetDuration?: number | null;
  includeCta?: boolean;
  defaultPreset?: ResearchCinematicPresetId | null;
}

export interface OutlineSceneDraft {
  order: number;
  role: ResearchOutlineRole;
  title: string;
  narrationDraft: string;
  captionDraft: string | null;
  emotion: ResearchEmotionTag | null;
  visualPreset: ResearchCinematicPresetId | null;
  estimatedDuration: number | null;
  assetRequirementRef: string | null;
}

export interface AssetRequirementDraft {
  ref: string;
  sceneRole: ResearchOutlineRole | null;
  description: string;
  mediaType: ResearchAssetMediaType;
  suggestedTags: string[];
  emotion: ResearchEmotionTag | null;
  priority: number | null;
}

const trueCrimeKeywords = [
  "crime",
  "assassin",
  "serial killer",
  "murder",
  "investig",
  "case file",
  "desaparec",
  "forensic"
] as const;

const ctaPhrases = [
  "Comente sua teoria.",
  "Se quiser a parte 2, comenta.",
  "Salve para revisar essa cronologia depois."
] as const;

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

function roundToSingleDecimal(value: number) {
  return Math.round(value * 10) / 10;
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function splitSentences(text: string) {
  return normalizeWhitespace(text)
    .split(/(?<=[.!?])\s+/u)
    .map((entry) => normalizeWhitespace(entry))
    .filter(Boolean);
}

function tokenize(text: string) {
  return normalizeWhitespace(text)
    .toLowerCase()
    .replace(/[^a-z0-9\u00c0-\u017f\s]/giu, " ")
    .split(/\s+/u)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length >= 3);
}

function uniqueValues(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function clipText(value: string, maxLength: number) {
  const normalized = normalizeWhitespace(value);

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, Math.max(0, maxLength - 3)).trim()}...`;
}

function containsAny(text: string, terms: readonly string[]) {
  return terms.some((term) => text.includes(term));
}

function detectEmotion(text: string): ResearchEmotionTag {
  const lowered = text.toLowerCase();

  if (containsAny(lowered, ["mister", "segredo", "arquivo", "enigma"])) {
    return "MYSTERIOUS";
  }

  if (containsAny(lowered, ["crime", "medo", "abismo", "trag", "sombr"])) {
    return "DARK";
  }

  if (containsAny(lowered, ["urg", "queda", "crise", "perigo", "confront"])) {
    return "TENSE";
  }

  if (containsAny(lowered, ["lenda", "epico", "imperio", "hero"])) {
    return "EPIC";
  }

  if (lowered.includes("?")) {
    return "CURIOUS";
  }

  return "NEUTRAL";
}

function detectVisualPreset(
  emotion: ResearchEmotionTag | null
): ResearchCinematicPresetId {
  switch (emotion) {
    case "EPIC":
      return "epic";
    case "TENSE":
      return "action";
    case "DARK":
      return "horror";
    case "MYSTERIOUS":
      return "mystery";
    case "CURIOUS":
      return "suspense";
    case "SAD":
      return "drama";
    case "JOYFUL":
      return "calm";
    default:
      return "drama";
  }
}

function inferHookType(text: string): ResearchHookType {
  const lowered = text.toLowerCase();

  if (lowered.includes("?")) {
    return "question";
  }

  if (containsAny(lowered, ["antes", "depois", "cronologia", "linha do tempo"])) {
    return "timeline";
  }

  if (containsAny(lowered, ["choc", "brutal", "impossivel", "ninguem esperava"])) {
    return "shock";
  }

  if (containsAny(lowered, ["segredo", "arquivo", "mist", "enigma"])) {
    return "mystery";
  }

  if (containsAny(lowered, ["aviso", "alerta", "risco", "perigo"])) {
    return "warning";
  }

  return "revelation";
}

function inferFactType(sentence: string): ResearchFactType {
  const lowered = sentence.toLowerCase();

  if (sentence.includes("\"")) {
    return "quote";
  }

  if (/\b(18|19|20)\d{2}\b/u.test(sentence)) {
    return "date";
  }

  if (containsAny(lowered, ["acus", "alega", "suspeit", "segundo relatos"])) {
    return "allegation";
  }

  if (containsAny(lowered, ["cidade", "bairro", "pais", "regiao"])) {
    return "place";
  }

  if (/%|\bmil\b|\bmilh[oO]es?\b|\bpor cento\b/u.test(lowered)) {
    return "statistic";
  }

  if (containsAny(lowered, ["evento", "caso", "incidente", "operacao"])) {
    return "event";
  }

  if (containsAny(lowered, ["incerto", "nao se sabe", "sem consenso", "duvida"])) {
    return "uncertainty";
  }

  return "context";
}

function inferConfidence(sentence: string): ResearchConfidence {
  const lowered = sentence.toLowerCase();

  if (containsAny(lowered, ["alega", "supost", "segundo relatos", "suspeit"])) {
    return "likely";
  }

  if (containsAny(lowered, ["contest", "disput", "versoes conflitantes"])) {
    return "disputed";
  }

  if (containsAny(lowered, ["nao se sabe", "incerto", "sem confirmar", "duvida"])) {
    return "uncertain";
  }

  return "confirmed";
}

function extractPeople(sentence: string) {
  const matches = sentence.match(
    /\b([A-Z\u00c0-\u017f][a-z\u00c0-\u017f]+(?:\s+[A-Z\u00c0-\u017f][a-z\u00c0-\u017f]+){0,2})\b/gu
  );

  return uniqueValues(
    (matches ?? []).filter((entry) => entry.split(" ").length >= 2)
  ).slice(0, 5);
}

function extractPlaces(sentence: string) {
  const patterns = [
    /\bem\s+([A-Z\u00c0-\u017f][\w\u00c0-\u017f-]+(?:\s+[A-Z\u00c0-\u017f][\w\u00c0-\u017f-]+){0,2})/gu,
    /\bno\s+([A-Z\u00c0-\u017f][\w\u00c0-\u017f-]+(?:\s+[A-Z\u00c0-\u017f][\w\u00c0-\u017f-]+){0,2})/gu,
    /\bna\s+([A-Z\u00c0-\u017f][\w\u00c0-\u017f-]+(?:\s+[A-Z\u00c0-\u017f][\w\u00c0-\u017f-]+){0,2})/gu
  ];
  const places: string[] = [];

  for (const pattern of patterns) {
    for (const match of sentence.matchAll(pattern)) {
      if (match[1]) {
        places.push(match[1]);
      }
    }
  }

  return uniqueValues(places).slice(0, 5);
}

function extractDateString(sentence: string) {
  const matches = sentence.match(
    /\b(?:\d{1,2}\s+de\s+[a-z\u00c0-\u017f]+\s+de\s+\d{4}|\d{4}|[A-Z][a-z]+\s+\d{1,2},\s+\d{4})\b/iu
  );

  return matches?.[0] ?? null;
}

function removeTags(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/giu, " ")
    .replace(/<style[\s\S]*?<\/style>/giu, " ")
    .replace(/<!--([\s\S]*?)-->/gu, " ")
    .replace(/<\/(p|div|section|article|h1|h2|h3|li|ul|ol|br)>/giu, "\n")
    .replace(/<[^>]+>/gu, " ");
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&nbsp;/giu, " ")
    .replace(/&amp;/giu, "&")
    .replace(/&quot;/giu, "\"")
    .replace(/&#39;/giu, "'")
    .replace(/&lt;/giu, "<")
    .replace(/&gt;/giu, ">");
}

function extractTagContent(html: string, tagName: string) {
  const pattern = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "iu");
  const match = html.match(pattern);

  return match?.[1] ? normalizeWhitespace(decodeHtmlEntities(removeTags(match[1]))) : null;
}

function extractMetaContent(html: string, metaName: string) {
  const pattern = new RegExp(
    `<meta[^>]+(?:name|property)=["']${metaName}["'][^>]+content=["']([^"']+)["'][^>]*>`,
    "iu"
  );
  const match = html.match(pattern);
  return match?.[1] ? normalizeWhitespace(decodeHtmlEntities(match[1])) : null;
}

function estimateSceneDurations(
  roleCount: number,
  targetDuration: number
) {
  const weights = [0.18, 0.18, 0.18, 0.2, 0.16, 0.1].slice(0, roleCount);
  const totalWeight = weights.reduce((total, value) => total + value, 0) || 1;

  return weights.map((weight) =>
    roundToSingleDecimal((targetDuration * weight) / totalWeight)
  );
}

export function generateSearchQueries(
  topic: string,
  options: ResearchQueryOptions = {}
): SearchQuerySuggestion[] {
  const normalizedTopic = normalizeWhitespace(topic);
  const languageHint = options.language?.trim() ? ` ${options.language}` : "";
  const nicheHint = options.niche?.trim() ? ` ${options.niche}` : "";
  const toneHint = options.tone?.trim() ? ` ${options.tone}` : "";

  return [
    {
      id: "overview",
      query: `${normalizedTopic}${nicheHint} overview chronology`,
      reason: "Abrir uma visao geral confiavel com cronologia e contexto."
    },
    {
      id: "primary",
      query: `${normalizedTopic}${languageHint} official record archive`,
      reason: "Procurar fontes primarias, registros oficiais ou arquivos."
    },
    {
      id: "reference",
      query: `${normalizedTopic}${languageHint} wikipedia wikidata summary`,
      reason: "Levantar referencias abertas e entidades estruturadas."
    },
    {
      id: "timeline",
      query: `${normalizedTopic}${nicheHint} timeline key dates`,
      reason: "Isolar datas-chave para a linha do tempo."
    },
    {
      id: "angles",
      query: `${normalizedTopic}${toneHint} unanswered questions contradictions`,
      reason: "Mapear ganchos narrativos, contradicoes e pontos em aberto."
    }
  ].map((entry) => ({
    ...entry,
    query: normalizeWhitespace(entry.query)
  }));
}

export function generateGoogleSearchLinks(
  topic: string,
  options: ResearchQueryOptions = {}
): SearchLinkSuggestion[] {
  return generateSearchQueries(topic, options).map((entry) => ({
    provider: "google",
    label: `Google: ${entry.reason}`,
    query: entry.query,
    url: `https://www.google.com/search?q=${encodeURIComponent(entry.query)}`
  }));
}

export function generateSourceChecklist(
  topic: string,
  niche: string | null | undefined
): SourceChecklistItem[] {
  const lowered = `${topic} ${niche ?? ""}`.toLowerCase();
  const isTrueCrime = containsAny(lowered, trueCrimeKeywords);

  return [
    {
      id: "baseline",
      label: "Abrir pelo menos uma fonte de contexto geral",
      reason: "Ajuda a organizar nomes, datas e a cronologia base.",
      priority: "high"
    },
    {
      id: "primary",
      label: "Cruzar com fonte primaria ou registro oficial",
      reason: "Reduz risco de repetir alegacoes sem respaldo.",
      priority: "high"
    },
    {
      id: "timeline",
      label: "Separar eventos por data e local",
      reason: "A timeline melhora roteiro, pacing e verificacao interna.",
      priority: "high"
    },
    {
      id: "visuals",
      label: "Listar requisitos visuais desde cedo",
      reason: "Evita outline sem cobertura visual suficiente.",
      priority: "medium"
    },
    {
      id: "uncertainty",
      label: isTrueCrime
        ? "Marcar alegacoes e pontos sensiveis como incertos quando preciso"
        : "Marcar pontos sem consenso ou sem fonte direta",
      reason: "Preserva rigor editorial e evita conclusoes fortes demais.",
      priority: "high"
    }
  ];
}

export function rankSourceCandidate(
  source: SourceRankingInput
): RankedSourceCandidate {
  let score = 35;
  const reasons: string[] = [];

  switch (source.sourceType) {
    case "official_record":
      score += 35;
      reasons.push("registro oficial ou institucional");
      break;
    case "archive":
    case "document":
      score += 26;
      reasons.push("fonte documental ou de arquivo");
      break;
    case "wikipedia":
      score += 14;
      reasons.push("boa porta de entrada, mas exige cruzamento");
      break;
    case "wikidata":
      score += 18;
      reasons.push("fonte estruturada para entidades e datas");
      break;
    case "manual_note":
      score += 8;
      reasons.push("nota manual depende de verificacao editorial");
      break;
    default:
      score += 12;
      reasons.push("fonte aberta com utilidade editorial");
      break;
  }

  if (source.url?.startsWith("https://")) {
    score += 8;
    reasons.push("URL segura");
  }

  if (source.author) {
    score += 6;
    reasons.push("autor identificado");
  }

  if (source.publishedAt) {
    score += 5;
    reasons.push("data de publicacao registrada");
  }

  if ((source.excerpt ?? "").length >= 120) {
    score += 6;
    reasons.push("excerpt com contexto util");
  }

  if ((source.notes ?? "").length >= 80) {
    score += 4;
    reasons.push("notas editoriais ajudam a triagem");
  }

  const clamped = clamp(Math.round(score), 0, 100);

  return {
    score: clamped,
    label: clamped >= 80 ? "high" : clamped >= 55 ? "medium" : "low",
    reasons
  };
}

export function extractTextHeuristics(html: string): TextHeuristicsSummary {
  const title = extractTagContent(html, "title");
  const description =
    extractMetaContent(html, "description") ??
    extractMetaContent(html, "og:description");
  const headings = uniqueValues(
    Array.from(html.matchAll(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/giu))
      .map((match) => decodeHtmlEntities(removeTags(match[1] ?? "")))
      .map((entry) => normalizeWhitespace(entry))
      .filter(Boolean)
  ).slice(0, 8);
  const text = normalizeWhitespace(decodeHtmlEntities(removeTags(html)));
  const paragraphs = text
    .split(/\n+/u)
    .map((entry) => normalizeWhitespace(entry))
    .filter((entry) => entry.length >= 40)
    .slice(0, 12);
  const warnings: string[] = [];

  if (text.length < 280) {
    warnings.push("Pouco texto util foi extraido da pagina.");
  }

  if (containsAny(text.toLowerCase(), ["subscribe", "sign in", "paywall", "login"])) {
    warnings.push("A pagina parece exigir conta, login ou bloqueio editorial.");
  }

  return {
    title,
    description,
    excerpt: clipText(paragraphs[0] ?? description ?? text, 320) || null,
    text,
    headings,
    paragraphs,
    wordCount: tokenize(text).length,
    warnings
  };
}

export function extractBasicMetadataFromHtml(
  html: string,
  url: string
): HtmlMetadataSummary {
  const heuristics = extractTextHeuristics(html);
  const canonicalUrl =
    extractMetaContent(html, "og:url") ??
    extractMetaContent(html, "twitter:url") ??
    url;
  const author =
    extractMetaContent(html, "author") ??
    extractMetaContent(html, "article:author");
  const publishedAt =
    extractMetaContent(html, "article:published_time") ??
    extractMetaContent(html, "pubdate");

  return {
    title: heuristics.title,
    description: heuristics.description,
    canonicalUrl,
    author,
    publishedAt,
    excerpt: heuristics.excerpt,
    text: heuristics.text
  };
}

export function extractTimelineCandidates(text: string): TimelineCandidate[] {
  const sentences = splitSentences(text);
  const events: TimelineCandidate[] = [];

  for (const sentence of sentences) {
    const dateValue = extractDateString(sentence);

    if (!dateValue) {
      continue;
    }

    events.push({
      title: clipText(sentence, 72),
      description: clipText(sentence, 220),
      dateValue,
      location: extractPlaces(sentence)[0] ?? null,
      people: extractPeople(sentence),
      confidence: inferConfidence(sentence)
    });
  }

  return events.slice(0, 12);
}

export function extractFactCandidates(text: string): FactCandidate[] {
  const sentences = splitSentences(text);

  return sentences
    .filter((sentence) => sentence.length >= 30)
    .slice(0, 18)
    .map((sentence) => ({
      claim: clipText(sentence, 260),
      factType: inferFactType(sentence),
      confidence: inferConfidence(sentence),
      dateValue: extractDateString(sentence),
      people: extractPeople(sentence),
      places: extractPlaces(sentence),
      tags: uniqueValues(tokenize(sentence)).slice(0, 6),
      notes:
        inferConfidence(sentence) === "uncertain"
          ? "Exige confirmacao adicional antes de virar afirmacao forte no roteiro."
          : null
    }));
}

export function buildResearchDossierSummary(
  dossier: DossierSummaryInput,
  facts: FactCandidate[],
  timeline: TimelineCandidate[]
): DossierSummaryResult {
  const confirmedFacts = facts.filter((fact) => fact.confidence === "confirmed");
  const uncertainFacts = facts.filter((fact) => fact.confidence !== "confirmed");
  const dateMentions = timeline
    .map((entry) => entry.dateValue)
    .filter((entry): entry is string => Boolean(entry));
  const isTrueCrime = containsAny(
    `${dossier.topic} ${dossier.niche ?? ""}`.toLowerCase(),
    trueCrimeKeywords
  );
  const summary = [
    `${dossier.title} parte de ${confirmedFacts.length} fato(s) mais solidos`,
    timeline.length > 0
      ? `e uma linha do tempo com ${timeline.length} marco(s) relevante(s)`
      : "e ainda precisa de marcos cronologicos mais claros",
    uncertainFacts.length > 0
      ? `enquanto ${uncertainFacts.length} ponto(s) seguem incertos ou disputados.`
      : "sem conflitos relevantes detectados nesta rodada."
  ].join(" ");
  const narrativeAngle =
    timeline.length >= 3
      ? `Reconstruir ${dossier.topic} pela ordem dos eventos e mostrar onde a narrativa muda de direcao.`
      : `Explorar ${dossier.topic} a partir do contraste entre o fato principal e as duvidas ainda abertas.`;
  const editorialNotes = [
    confirmedFacts.length === 0
      ? "A base ainda depende demais de notas gerais; aprove mais fontes antes de fechar o roteiro."
      : "Use os fatos confirmados como coluna dorsal do roteiro."
  ];

  if (dateMentions.length > 0) {
    editorialNotes.push(
      `Datas detectadas: ${uniqueValues(dateMentions).slice(0, 4).join(", ")}.`
    );
  }

  const safetyNotes = [
    isTrueCrime
      ? "Evite glamurizacao do agressor e trate alegacoes sem fonte como incertas."
      : "Separe contexto confirmado de interpretacoes para preservar clareza."
  ];

  if (uncertainFacts.length > 0) {
    safetyNotes.push(
      "Marque claramente os trechos com baixa confianca no outline e nas legendas."
    );
  }

  return {
    summary,
    narrativeAngle,
    editorialNotes,
    safetyNotes
  };
}

export function buildOutlineFromResearch(
  dossier: DossierSummaryInput,
  facts: FactCandidate[],
  timeline: TimelineCandidate[],
  hooks: HookDraft[],
  options: OutlineBuildOptions = {}
): OutlineSceneDraft[] {
  const includeCta = options.includeCta ?? true;
  const orderedRoles = includeCta
    ? researchOutlineRoles
    : researchOutlineRoles.filter((role) => role !== "cta");
  const targetDuration = clamp(
    Math.round((options.targetDuration ?? dossier.targetDuration ?? 36) * 10) / 10,
    18,
    90
  );
  const roleDurations = estimateSceneDurations(orderedRoles.length, targetDuration);
  const hookLead = hooks[0]?.text ?? facts[0]?.claim ?? `O que torna ${dossier.topic} tao marcante?`;
  const contextLead =
    timeline[0]?.description ??
    facts.find((fact) => fact.factType === "context")?.claim ??
    `Antes do ponto de virada, ${dossier.topic} parecia seguir um caminho previsivel.`;
  const tensionLead =
    facts.find((fact) => fact.confidence !== "confirmed")?.claim ??
    timeline[1]?.description ??
    `A pesquisa revela uma camada de tensao que muda a leitura do caso.`;
  const climaxLead =
    timeline.at(-1)?.description ??
    facts.find((fact) => fact.factType === "event")?.claim ??
    `O climas narrativo aparece quando as pecas finalmente se alinham.`;
  const resolutionLead =
    facts.find((fact) => fact.confidence === "confirmed" && fact.factType !== "date")?.claim ??
    `O fechamento funciona melhor quando os fatos confirmados retomam o controle da narrativa.`;
  const ctaLead = ctaPhrases[0];
  const roleTextMap: Record<ResearchOutlineRole, string> = {
    hook: hookLead,
    context: contextLead,
    tension: tensionLead,
    climax: climaxLead,
    resolution: resolutionLead,
    cta: ctaLead
  };

  return orderedRoles.map((role, index) => {
    const narrationDraft = clipText(roleTextMap[role], 260);
    const emotion =
      role === "hook"
        ? detectEmotion(narrationDraft)
        : role === "tension"
          ? "TENSE"
          : role === "climax"
            ? "EPIC"
            : role === "cta"
              ? "CURIOUS"
              : detectEmotion(narrationDraft);
    const visualPreset = options.defaultPreset ?? detectVisualPreset(emotion);
    const title = (() => {
      switch (role) {
        case "hook":
          return "Hook inicial";
        case "context":
          return "Contexto essencial";
        case "tension":
          return "Escalada de tensao";
        case "climax":
          return "Virada principal";
        case "resolution":
          return "Leitura final";
        case "cta":
          return "Fecho e CTA";
      }
    })();

    return {
      order: index + 1,
      role,
      title,
      narrationDraft,
      captionDraft: clipText(narrationDraft, 92),
      emotion,
      visualPreset,
      estimatedDuration: roleDurations[index] ?? null,
      assetRequirementRef: `req-${role}-${index + 1}`
    };
  });
}

export function buildAssetRequirementsFromOutline(
  outline: OutlineSceneDraft[]
): AssetRequirementDraft[] {
  return outline.map((scene, index) => {
    let mediaType: ResearchAssetMediaType = "image";

    if (scene.role === "context") {
      mediaType = "document";
    } else if (scene.role === "tension" || scene.role === "climax") {
      mediaType = "video";
    } else if (scene.role === "cta") {
      mediaType = "text_card";
    } else if (containsAny(scene.narrationDraft.toLowerCase(), ["mapa", "trajeto", "cidade", "fronteira"])) {
      mediaType = "map";
    }

    return {
      ref: scene.assetRequirementRef ?? `req-scene-${scene.order}`,
      sceneRole: scene.role,
      description:
        scene.role === "context"
          ? "Documento, frame de arquivo ou evidencia visual que sustente o contexto."
          : scene.role === "cta"
            ? "Cartao final limpo para CTA, comentario ou pergunta ao publico."
            : `Visual principal para ${scene.title.toLowerCase()} com foco em ${scene.narrationDraft.toLowerCase()}.`,
      mediaType,
      suggestedTags: uniqueValues([
        ...tokenize(scene.title),
        ...tokenize(scene.narrationDraft),
        scene.role
      ]).slice(0, 8),
      emotion: scene.emotion,
      priority: clamp(100 - index * 10, 50, 100)
    };
  });
}

