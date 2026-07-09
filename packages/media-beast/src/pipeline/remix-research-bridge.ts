import { detectTopicCase } from "../editorial/topic-knowledge.js";
import {
  extractFactCandidates,
  extractTimelineCandidates,
  generateSearchQueries,
  type FactCandidate,
  type HookDraft,
  type ResearchConfidence,
  type SearchQuerySuggestion,
  type TimelineCandidate
} from "@reelforge/research-collector";
import type { RemixTargetStyle } from "./remix-types.js";
import {
  optimizeForSpokenDelivery,
  resolveCuriosityFact,
  resolveNarrationVariationAngle,
  shortenForSpeech,
  weaveCuriosityNaturally,
  type NarrationBeatDraft
} from "./narration-curiosity-engine.js";
import type { VideoRemixAnalysis } from "./remix-video-analyzer.js";

export interface RemixResearchOptions {
  enabled?: boolean;
  deepResearch?: boolean;
  selectedCuriosityIds?: string[];
  bypassCache?: boolean;
  targetStyle?: RemixTargetStyle;
  language?: string;
  niche?: string | null;
}

export interface RemixCuriosityScores {
  relevance: number;
  surprise: number;
  narrative: number;
  total: number;
}

export interface RemixRankedCuriosity {
  id: string;
  text: string;
  source:
    | "entity_knowledge"
    | "topic_case"
    | "research_fact"
    | "research_hook"
    | "timeline"
    | "narrative_brief";
  confidence: "high" | "medium" | "low";
  scores: RemixCuriosityScores;
  entityId?: string;
  entityName?: string;
  suggestedBeat: "hook" | "context" | "tension" | "climax" | "cta";
  tags: string[];
}

export interface RemixResearchDossier {
  dossierId: string;
  cacheKey: string;
  cacheHit: boolean;
  researchMode: "automatic" | "deep";
  topic: string;
  entities: string[];
  searchQueries: SearchQuerySuggestion[];
  facts: FactCandidate[];
  timeline: TimelineCandidate[];
  hooks: HookDraft[];
  rankedCuriosities: RemixRankedCuriosity[];
  selectedCuriosityIds: string[];
  autoInjectedCuriosityIds: string[];
  narrativeBrief: string;
  researchNotes: string[];
  sourceCount: number;
  createdAt: string;
}

const CACHE_TTL_MS = 60 * 60 * 1000;
const researchCache = new Map<
  string,
  { dossier: RemixResearchDossier; expiresAt: number }
>();

const ENTITY_RESEARCH_PARAGRAPHS: Record<string, string[]> = {
  messi: [
    "Lionel Messi mede 1,70 m e compensa com centro de gravidade baixo e passos curtos que comprimem o tempo de reação do marcador.",
    "Messi costuma ler o quadril e o pé de apoio do adversário antes de acelerar — hábito raro entre atacantes de elite.",
    "Em cobranças de falta, Messi ajusta distância e ângulo de aproximação para maximizar curva e precisão no alvo."
  ],
  ronaldo: [
    "Cristiano Ronaldo registra salto vertical acima de 70 cm em treinos — o que explica timing incomum em cabeceios decisivos.",
    "CR7 modula a corrida de aproximação para chegar no ponto exato do cruzamento, não apenas para ganhar velocidade.",
    "A carreira de Ronaldo combina força física com leitura de espaço entre marcação e goleiro."
  ],
  goro: [
    "Goro foi o primeiro chefe jogável de Mortal Kombat em 1992, pensado para punir agressividade com alcance de grab absurdo.",
    "O design Shokan de quatro braços altera spacing, punishes e pressão no neutral — não é só estética de chefe.",
    "No arcade original, Goro existia para intimidar no ritmo da luta, não apenas no dano bruto."
  ],
  deadpool: [
    "Deadpool nasceu como paródia de Deathstroke na DC, com tom irreverente que depois definiu o personagem Marvel.",
    "O traje vermelho nas HQs iniciais invertia a paleta do Aranha-Verde — referência visual intencional.",
    "Wade Wilson quebra a quarta parede porque o roteiro sempre tratou o personagem como comentário meta sobre quadrinhos."
  ],
  liverpool: [
    "Liverpool FC tem história marcada por viradas épicas em finais europeias, especialmente sob Anfield.",
    "A torcida do Liverpool é fator tático narrativo: jogos de mando costumam mudar ritmo e pressão no segundo tempo."
  ],
  champions_league: [
    "A Champions League concentra os jogos com maior densidade tática e emocional do futebol europeu.",
    "Lances icônicos da competição costumam nascer de contexto de eliminatória — não só de talento isolado."
  ]
};

function stableHash(value: string): string {
  let hash = 0;
  for (const char of value) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return hash.toString(36);
}

function buildCacheKey(analysis: VideoRemixAnalysis, deepResearch: boolean): string {
  const entityIds = analysis.contentIntelligence.entities.map((entity) => entity.id).join(",");
  return stableHash(
    `${analysis.title}:${entityIds}:${analysis.contentIntelligence.domain}:${deepResearch ? "deep" : "auto"}`
  );
}

function confidenceToLevel(confidence: ResearchConfidence): "high" | "medium" | "low" {
  if (confidence === "confirmed") return "high";
  if (confidence === "likely") return "medium";
  return "low";
}

function buildResearchTopic(analysis: VideoRemixAnalysis): string {
  const intel = analysis.contentIntelligence;
  const lead = intel.entities[0]?.name ?? analysis.title;
  const action = intel.actions[0]?.label;
  return action ? `${lead} — ${action}` : lead;
}

function buildSyntheticCorpusBlocks(analysis: VideoRemixAnalysis, deepResearch: boolean): string[] {
  const intel = analysis.contentIntelligence;
  const blocks: string[] = [
    analysis.title,
    intel.narrativeBrief,
    intel.narrativeHook,
    intel.curiosityAngle,
    analysis.themeSummary,
    intel.headline,
    ...intel.entities.map(
      (entity) =>
        `${entity.name} (${entity.type})${entity.franchise ? ` — ${entity.franchise}` : ""}.`
    ),
    ...intel.actions.map((action) => `${action.label}: ${action.verb}.`),
    intel.setting ? `Contexto: ${intel.setting}.` : ""
  ].filter(Boolean);

  for (const entity of intel.entities) {
    const paragraphs = ENTITY_RESEARCH_PARAGRAPHS[entity.id];
    if (paragraphs) {
      blocks.push(...paragraphs);
    }
    blocks.push(
      resolveCuriosityFact({
        entityId: entity.id,
        domain: intel.domain,
        seed: `${analysis.title}:${entity.id}`,
        lead: entity.name,
        ...(intel.actions[0]?.label ? { action: intel.actions[0].label } : {})
      })
    );
  }

  const topicCase = detectTopicCase(`${analysis.title} ${intel.narrativeBrief}`);
  if (topicCase) {
    blocks.push(
      ...topicCase.summaryFacts,
      ...topicCase.timelineBeats.slice(0, 4),
      ...topicCase.editorialAngles.slice(0, 3)
    );
  }

  if (deepResearch) {
    const queries = generateSearchQueries(buildResearchTopic(analysis), {
      niche: intel.domain,
      tone: intel.mood,
      language: "pt-BR",
      targetDuration: analysis.outputDurationSeconds
    });
    for (const query of queries.slice(0, 5)) {
      blocks.push(
        `Pesquisa sugerida (${query.id}): ${query.query}. ${query.reason}. Hipótese editorial para ${buildResearchTopic(analysis)}.`
      );
    }
  }

  return blocks.filter((block) => block.trim().length >= 20);
}

function buildHooksFromFacts(facts: FactCandidate[]): HookDraft[] {
  return facts.slice(0, 6).map((fact, index) => ({
    text: fact.claim,
    hookType:
      fact.factType === "statistic"
        ? "shock"
        : fact.factType === "event"
          ? "timeline"
          : index === 0
            ? "question"
            : "revelation",
    strengthScore: fact.confidence === "confirmed" ? 0.85 : 0.6,
    notes: fact.notes
  }));
}

function scoreCuriosity(
  text: string,
  analysis: VideoRemixAnalysis,
  source: RemixRankedCuriosity["source"]
): RemixCuriosityScores {
  const intel = analysis.contentIntelligence;
  const lowered = text.toLowerCase();
  const entityNames = intel.entities.map((entity) => entity.name.toLowerCase());

  let relevance = 0.35;
  if (entityNames.some((name) => lowered.includes(name))) {
    relevance += 0.35;
  }
  if (intel.setting && lowered.includes(intel.setting.toLowerCase())) {
    relevance += 0.15;
  }
  if (intel.actions[0]?.label && lowered.includes(intel.actions[0].label.toLowerCase())) {
    relevance += 0.1;
  }

  let surprise = 0.25;
  if (/\d/.test(text)) surprise += 0.2;
  if (/porque|por que|antes de|segundo|raramente|poucos|incomum|contraintuit/i.test(lowered)) {
    surprise += 0.2;
  }
  if (source === "entity_knowledge" || source === "topic_case") surprise += 0.15;

  let narrative = 0.3;
  const words = text.split(/\s+/).filter(Boolean).length;
  if (words >= 12 && words <= 32) narrative += 0.25;
  if (words >= 8) narrative += 0.1;
  if (/mede|treina|design|criado|nasceu|arquivo|método|frame|biomecân/i.test(lowered)) {
    narrative += 0.2;
  }

  const total = Number(
    (relevance * 0.42 + surprise * 0.33 + narrative * 0.25).toFixed(3)
  );

  return {
    relevance: Number(relevance.toFixed(3)),
    surprise: Number(surprise.toFixed(3)),
    narrative: Number(narrative.toFixed(3)),
    total
  };
}

function sharesTooManyWords(text: string, reference: string, threshold = 0.5): boolean {
  const referenceWords = reference
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => word.length > 3);
  if (referenceWords.length === 0) {
    return false;
  }
  const textWords = new Set(
    text
      .toLowerCase()
      .split(/\s+/)
      .filter((word) => word.length > 3)
  );
  const overlap = referenceWords.filter((word) => textWords.has(word)).length;
  return overlap / referenceWords.length >= threshold;
}

function isLowQualityCuriosity(text: string, analysis: VideoRemixAnalysis): boolean {
  const normalized = text.trim().toLowerCase();
  if (normalized.length < 28 || normalized.length > 220) {
    return true;
  }
  if (
    /protagoniza.*protagoniza|pesquisa sugerida|dom[ií]nio:|entidades:|a[cç][aã]o central:/i.test(
      text
    ) ||
    /\(character\)|\(person\)|\(team\)|headline:|narrative brief/i.test(text) ||
    /^[\p{L}\p{N}\s-]+:\s*.+\s*\(character\)/iu.test(text)
  ) {
    return true;
  }
  const hook = analysis.contentIntelligence.narrativeHook ?? "";
  const brief = analysis.contentIntelligence.narrativeBrief ?? "";
  if (hook && sharesTooManyWords(text, hook, 0.45)) {
    return true;
  }
  if (brief && sharesTooManyWords(text, brief, 0.55)) {
    return true;
  }
  const titleTokens = analysis.title.toLowerCase().split(/\s+/).filter((token) => token.length > 4);
  const matchedTitleTokens = titleTokens.filter((token) => normalized.includes(token)).length;
  if (matchedTitleTokens >= Math.min(6, titleTokens.length)) {
    return true;
  }
  return false;
}

function suggestBeatForCuriosity(
  curiosity: Omit<RemixRankedCuriosity, "suggestedBeat" | "scores">
): RemixRankedCuriosity["suggestedBeat"] {
  if (curiosity.source === "research_hook" || curiosity.source === "narrative_brief") {
    return "hook";
  }
  if (curiosity.source === "timeline") {
    return "context";
  }
  if (curiosity.source === "entity_knowledge" || curiosity.source === "topic_case") {
    return "climax";
  }
  return "climax";
}

function buildRankedCuriosities(
  analysis: VideoRemixAnalysis,
  facts: FactCandidate[],
  timeline: TimelineCandidate[],
  hooks: HookDraft[]
): RemixRankedCuriosity[] {
  const intel = analysis.contentIntelligence;
  const candidates: Array<Omit<RemixRankedCuriosity, "scores" | "suggestedBeat">> = [];

  candidates.push({
    id: `narrative-hook-${stableHash(intel.narrativeHook)}`,
    text: intel.narrativeHook,
    source: "narrative_brief",
    confidence: "high",
    ...(intel.entities[0]?.name ? { entityName: intel.entities[0].name } : {}),
    ...(intel.entities[0]?.id ? { entityId: intel.entities[0].id } : {}),
    tags: ["hook", "analysis"]
  });

  candidates.push({
    id: `curiosity-angle-${stableHash(intel.curiosityAngle)}`,
    text: intel.curiosityAngle,
    source: "narrative_brief",
    confidence: "medium",
    ...(intel.entities[0]?.name ? { entityName: intel.entities[0].name } : {}),
    ...(intel.entities[0]?.id ? { entityId: intel.entities[0].id } : {}),
    tags: ["climax", "analysis"]
  });

  for (const entity of intel.entities) {
    const paragraphs = ENTITY_RESEARCH_PARAGRAPHS[entity.id] ?? [];
    for (const paragraph of paragraphs) {
      candidates.push({
        id: `entity-${entity.id}-${stableHash(paragraph)}`,
        text: paragraph,
        source: "entity_knowledge",
        confidence: "high",
        entityId: entity.id,
        entityName: entity.name,
        tags: [entity.type, entity.franchise ?? intel.domain]
      });
    }
  }

  const topicCase = detectTopicCase(`${analysis.title} ${intel.narrativeBrief}`);
  if (topicCase) {
    for (const fact of topicCase.summaryFacts.slice(0, 4)) {
      candidates.push({
        id: `topic-${topicCase.id}-${stableHash(fact)}`,
        text: fact,
        source: "topic_case",
        confidence: "high",
        tags: ["true-crime", topicCase.id]
      });
    }
  }

  for (const fact of facts.slice(0, 10)) {
    const entityName = fact.people[0] ?? intel.entities[0]?.name;
    candidates.push({
      id: `fact-${stableHash(fact.claim)}`,
      text: fact.claim,
      source: "research_fact",
      confidence: confidenceToLevel(fact.confidence),
      ...(entityName ? { entityName } : {}),
      tags: fact.tags
    });
  }

  for (const event of timeline.slice(0, 4)) {
    candidates.push({
      id: `timeline-${stableHash(event.title)}`,
      text: event.description || event.title,
      source: "timeline",
      confidence: confidenceToLevel(event.confidence),
      tags: ["timeline", ...(event.people ?? [])]
    });
  }

  for (const hook of hooks.slice(0, 4)) {
    candidates.push({
      id: `hook-${stableHash(hook.text)}`,
      text: hook.text,
      source: "research_hook",
      confidence: hook.strengthScore && hook.strengthScore >= 0.8 ? "high" : "medium",
      tags: [hook.hookType]
    });
  }

  const unique = new Map<string, RemixRankedCuriosity>();
  for (const candidate of candidates) {
    const normalized = candidate.text.trim().toLowerCase();
    if (
      normalized.length < 24 ||
      unique.has(normalized) ||
      isLowQualityCuriosity(candidate.text, analysis)
    ) {
      continue;
    }

    const scores = scoreCuriosity(candidate.text, analysis, candidate.source);
    if (candidate.source === "research_fact") {
      scores.total *= 0.82;
    }
    unique.set(normalized, {
      ...candidate,
      scores,
      suggestedBeat: suggestBeatForCuriosity(candidate)
    });
  }

  return [...unique.values()].sort((left, right) => right.scores.total - left.scores.total);
}

function selectAutoCuriosities(
  ranked: RemixRankedCuriosity[],
  selectedIds?: string[]
): string[] {
  if (selectedIds?.length) {
    return selectedIds.filter((id) => ranked.some((item) => item.id === id));
  }

  const picks: string[] = [];
  const byBeat: Record<RemixRankedCuriosity["suggestedBeat"], RemixRankedCuriosity | null> = {
    hook: null,
    context: null,
    tension: null,
    climax: null,
    cta: null
  };

  const climaxPreferred = ranked.find(
    (curiosity) =>
      curiosity.suggestedBeat === "climax" &&
      (curiosity.source === "entity_knowledge" ||
        curiosity.source === "topic_case" ||
        curiosity.source === "narrative_brief")
  );
  if (climaxPreferred) {
    byBeat.climax = climaxPreferred;
  }

  for (const curiosity of ranked) {
    if (!byBeat[curiosity.suggestedBeat]) {
      byBeat[curiosity.suggestedBeat] = curiosity;
    }
  }

  if (byBeat.climax) picks.push(byBeat.climax.id);
  if (byBeat.hook && byBeat.hook.id !== byBeat.climax?.id) picks.push(byBeat.hook.id);
  if (byBeat.context) picks.push(byBeat.context.id);

  return picks.slice(0, 3);
}

export function collectRemixResearch(
  analysis: VideoRemixAnalysis,
  options: RemixResearchOptions = {}
): RemixResearchDossier {
  const enabled = options.enabled !== false;
  if (!enabled) {
    return buildEmptyDossier(analysis);
  }

  const deepResearch = options.deepResearch === true;
  const cacheKey = buildCacheKey(analysis, deepResearch);
  const bypassCache = options.bypassCache === true || deepResearch;

  if (!bypassCache) {
    const cached = researchCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      const selectedCuriosityIds = selectAutoCuriosities(
        cached.dossier.rankedCuriosities,
        options.selectedCuriosityIds
      );
      return {
        ...cached.dossier,
        cacheHit: true,
        selectedCuriosityIds,
        autoInjectedCuriosityIds: selectedCuriosityIds
      };
    }
  }

  const corpusBlocks = buildSyntheticCorpusBlocks(analysis, deepResearch);
  const corpus = corpusBlocks.join("\n\n");
  const facts = extractFactCandidates(corpus);
  const timeline = extractTimelineCandidates(corpus);
  const hooks = buildHooksFromFacts(facts);
  const searchQueries = generateSearchQueries(buildResearchTopic(analysis), {
    niche: analysis.contentIntelligence.domain,
    tone: analysis.contentIntelligence.mood,
    language: options.language ?? "pt-BR",
    targetDuration: analysis.outputDurationSeconds
  });

  const rankedCuriosities = buildRankedCuriosities(analysis, facts, timeline, hooks);
  const selectedCuriosityIds = selectAutoCuriosities(
    rankedCuriosities,
    options.selectedCuriosityIds
  );

  const dossier: RemixResearchDossier = {
    dossierId: `remix-research-${cacheKey}`,
    cacheKey,
    cacheHit: false,
    researchMode: deepResearch ? "deep" : "automatic",
    topic: buildResearchTopic(analysis),
    entities: analysis.contentIntelligence.entities.map((entity) => entity.name),
    searchQueries,
    facts,
    timeline,
    hooks,
    rankedCuriosities,
    selectedCuriosityIds,
    autoInjectedCuriosityIds: selectedCuriosityIds,
    narrativeBrief: analysis.contentIntelligence.narrativeBrief,
    researchNotes: [
      `Modo: ${deepResearch ? "pesquisa profunda" : "pesquisa automática"}.`,
      `${rankedCuriosities.length} curiosidades ranqueadas a partir de ${corpusBlocks.length} blocos de corpus.`,
      `${facts.length} fatos e ${timeline.length} marcos de timeline extraídos via Research Collector.`,
      selectedCuriosityIds.length
        ? `Auto-selecionadas para narração: ${selectedCuriosityIds.join(", ")}.`
        : "Nenhuma curiosidade auto-selecionada."
    ],
    sourceCount: corpusBlocks.length,
    createdAt: new Date().toISOString()
  };

  if (!bypassCache) {
    researchCache.set(cacheKey, {
      dossier,
      expiresAt: Date.now() + CACHE_TTL_MS
    });
  }

  return dossier;
}

function buildEmptyDossier(analysis: VideoRemixAnalysis): RemixResearchDossier {
  const cacheKey = buildCacheKey(analysis, false);
  return {
    dossierId: `remix-research-disabled-${cacheKey}`,
    cacheKey,
    cacheHit: false,
    researchMode: "automatic",
    topic: buildResearchTopic(analysis),
    entities: [],
    searchQueries: [],
    facts: [],
    timeline: [],
    hooks: [],
    rankedCuriosities: [],
    selectedCuriosityIds: [],
    autoInjectedCuriosityIds: [],
    narrativeBrief: analysis.contentIntelligence.narrativeBrief,
    researchNotes: ["Pesquisa automática desabilitada para este remix."],
    sourceCount: 0,
    createdAt: new Date().toISOString()
  };
}

export function getRemixResearchCuriosities(
  dossier: RemixResearchDossier | null | undefined,
  selectedIds?: string[]
): RemixRankedCuriosity[] {
  if (!dossier) {
    return [];
  }

  const ids = selectedIds?.length ? selectedIds : dossier.selectedCuriosityIds;
  return dossier.rankedCuriosities.filter((curiosity) => ids.includes(curiosity.id));
}

function spokenCuriosityLine(text: string): string {
  return optimizeForSpokenDelivery(text);
}

function blendCuriosityIntoBeat(beatText: string, curiosityText: string, maxWords = 26): string {
  const curiosity = shortenForSpeech(spokenCuriosityLine(curiosityText), 14);
  const base = beatText.replace(/\s+/g, " ").trim().replace(/\.+$/, "");
  const merged = `${base}. ${curiosity.charAt(0).toUpperCase()}${curiosity.slice(1)}`;
  return shortenForSpeech(merged, maxWords);
}

export function adaptCuriosityToRemixStyle(
  text: string,
  targetStyle: RemixTargetStyle,
  lead?: string,
  variationIndex = 0,
  domain?: VideoRemixAnalysis["contentIntelligence"]["domain"]
): string {
  const angle = resolveNarrationVariationAngle({
    targetStyle,
    variationIndex,
    ...(domain ? { domain } : {})
  });
  if (lead) {
    return weaveCuriosityNaturally(text, lead, angle);
  }
  return spokenCuriosityLine(text);
}

function isInjectReadyCuriosity(
  curiosity: RemixRankedCuriosity,
  analysis?: VideoRemixAnalysis
): boolean {
  if (curiosity.text.length < 28 || curiosity.text.length > 200) {
    return false;
  }
  if (curiosity.scores.total < 0.42) {
    return false;
  }
  if (analysis && isLowQualityCuriosity(curiosity.text, analysis)) {
    return false;
  }
  return true;
}

export function injectResearchCuriositiesIntoBeats(
  beats: NarrationBeatDraft[],
  dossier: RemixResearchDossier | null | undefined,
  targetStyle: RemixTargetStyle,
  selectedIds?: string[],
  analysis?: VideoRemixAnalysis,
  variationIndex = 0
): NarrationBeatDraft[] {
  const curiosities = getRemixResearchCuriosities(dossier, selectedIds).filter((curiosity) =>
    isInjectReadyCuriosity(curiosity, analysis)
  );
  if (!curiosities.length) {
    return beats;
  }

  const byBeat = new Map<RemixRankedCuriosity["suggestedBeat"], RemixRankedCuriosity>();
  for (const curiosity of curiosities) {
    if (!byBeat.has(curiosity.suggestedBeat)) {
      byBeat.set(curiosity.suggestedBeat, curiosity);
    }
  }

  const rankedClimax = [
    ...curiosities.filter(
      (curiosity) =>
        curiosity.suggestedBeat === "climax" &&
        (curiosity.source === "entity_knowledge" || curiosity.source === "topic_case")
    ),
    ...curiosities.filter((curiosity) => curiosity.source === "entity_knowledge"),
    ...curiosities.filter((curiosity) => curiosity.suggestedBeat === "climax"),
    ...curiosities
  ];
  const uniqueRanked = [...new Map(rankedClimax.map((item) => [item.id, item])).values()];
  const climaxCuriosity = uniqueRanked[variationIndex % uniqueRanked.length] ?? curiosities[0];
  const contextCuriosity = byBeat.get("context");
  const lead =
    analysis?.contentIntelligence.entities[0]?.name ??
    analysis?.title?.slice(0, 40) ??
    "esse assunto";

  return beats.map((beat) => {
    if (beat.role === "climax" && climaxCuriosity) {
      const curiosityLooksOperational =
        analysis && isLowQualityCuriosity(climaxCuriosity.text, analysis);
      const text = curiosityLooksOperational
        ? beat.text
        : adaptCuriosityToRemixStyle(
            climaxCuriosity.text,
            targetStyle,
            lead,
            variationIndex,
            analysis?.contentIntelligence.domain
          );
      return {
        ...beat,
        text,
        curiosityTag: curiosityLooksOperational
          ? beat.curiosityTag
          : `research-${climaxCuriosity.source}`,
        caption: text.split(/\s+/).slice(0, 7).join(" ")
      };
    }

    if (
      beat.role === "context" &&
      contextCuriosity &&
      contextCuriosity.id !== climaxCuriosity?.id
    ) {
      const text = blendCuriosityIntoBeat(beat.text, contextCuriosity.text);
      return {
        ...beat,
        text,
        curiosityTag: `research-${contextCuriosity.source}`,
        caption: text.split(/\s+/).slice(0, 7).join(" ")
      };
    }

    return beat;
  });
}

export function clearRemixResearchCache(cacheKey?: string): void {
  if (cacheKey) {
    researchCache.delete(cacheKey);
    return;
  }
  researchCache.clear();
}

export function runDeepRemixResearch(
  analysis: VideoRemixAnalysis,
  options: Omit<RemixResearchOptions, "deepResearch" | "bypassCache"> = {}
): RemixResearchDossier {
  if (options.enabled === false) {
    return buildEmptyDossier(analysis);
  }

  return collectRemixResearch(analysis, {
    ...options,
    deepResearch: true,
    bypassCache: true
  });
}