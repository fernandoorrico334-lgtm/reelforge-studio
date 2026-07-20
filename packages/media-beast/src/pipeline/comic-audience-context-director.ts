export type ComicAudienceContextConcept = {
  conceptId: string;
  labels: string[];
  kind: "character" | "location" | "artifact" | "creature" | "organization" | "event";
  explanationTerms?: string[];
  audienceFamiliar?: boolean;
};

export type ComicAudienceContextBeat = {
  beatId: string;
  narrationLine: string;
  sourcePages: number[];
};

export type ComicAudienceContextBeatReview = {
  beatId: string;
  introducedConceptIds: string[];
  unexplainedConceptIds: string[];
  ambiguousOpening: boolean;
  hasNarrativeBridge: boolean;
  hasStoryPressure: boolean;
  clarityScore: number;
  recommendations: string[];
};

export type ComicAudienceContextPlan = {
  directorId: "comic_audience_context_director_v1";
  beatReviews: ComicAudienceContextBeatReview[];
  conceptCount: number;
  explainedConceptCount: number;
  contextCoverage: number;
  bridgeCoverage: number;
  storyPressureCoverage: number;
  ambiguousOpeningCount: number;
  unexplainedConceptIds: string[];
  score: number;
  warnings: string[];
  passed: boolean;
};

function normalize(value: string) {
  return Array.from(value.normalize("NFD"))
    .filter((character) => character.charCodeAt(0) < 768 || character.charCodeAt(0) > 879)
    .join("")
    .toLowerCase();
}

function containsAny(value: string, terms: string[]) {
  const normalized = normalize(value);
  return terms.some((term) => normalized.includes(normalize(term)));
}

const AMBIGUOUS_OPENING = /^(?:ele|ela|eles|elas|isso|isto|aquilo|aquele|aquela|essa|esse)\b/i;
const NARRATIVE_BRIDGE = /\b(?:quando|enquanto|entao|mas|porque|por isso|foi quando|naquele instante|com isso|com|para|a partir dali|de repente|a verdade|ao mesmo tempo|assim|ate que|no fundo|na superficie|na batalha)\b/i;
const STORY_PRESSURE = /\b(?:ameaca|perigo|guerra|destrui|cair|falhar|tarde|impossivel|ultim|risco|sobreviv|ataque|golpe|portal|arma|caos|vencer|deter|confront|batalha|cercad|vulneravel|resposta|plano|roub|salvar|proteger|control|tempo|abertura|retorno|ferid|vitim|prioridade)\b/i;

function round(value: number) {
  return Math.round(value * 1000) / 1000;
}

export function buildComicAudienceContextPlan(input: {
  beats: ComicAudienceContextBeat[];
  concepts: ComicAudienceContextConcept[];
}): ComicAudienceContextPlan {
  const introduced = new Set<string>();
  const explained = new Set<string>();
  const beatReviews = input.beats.map((beat, index): ComicAudienceContextBeatReview => {
    const introducedConceptIds: string[] = [];
    const unexplainedConceptIds: string[] = [];
    for (const concept of input.concepts) {
      if (introduced.has(concept.conceptId) || !containsAny(beat.narrationLine, concept.labels)) continue;
      introduced.add(concept.conceptId);
      introducedConceptIds.push(concept.conceptId);
      const isExplained = Boolean(concept.audienceFamiliar) || !concept.explanationTerms?.length || containsAny(beat.narrationLine, concept.explanationTerms);
      if (isExplained) explained.add(concept.conceptId);
      else unexplainedConceptIds.push(concept.conceptId);
    }
    const normalizedNarration = normalize(beat.narrationLine);
    const previousNarration = index > 0 ? input.beats[index - 1]?.narrationLine ?? "" : "";
    const previousCharacterCount = input.concepts.filter((concept) => concept.kind === "character" && containsAny(previousNarration, concept.labels)).length;
    const ambiguousOpening = AMBIGUOUS_OPENING.test(normalizedNarration) && previousCharacterCount !== 1;
    const hasNarrativeBridge = index === 0 || NARRATIVE_BRIDGE.test(normalizedNarration);
    const hasStoryPressure = beat.narrationLine.includes("?") || STORY_PRESSURE.test(normalizedNarration);
    const recommendations: string[] = [];
    if (ambiguousOpening) recommendations.push("name_the_subject_before_using_a_pronoun");
    for (const conceptId of unexplainedConceptIds) recommendations.push("explain_" + conceptId + "_at_first_mention");
    if (!hasNarrativeBridge) recommendations.push("connect_this_beat_to_the_previous_consequence");
    if (!hasStoryPressure) recommendations.push("add_a_goal_risk_question_or_consequence");
    const clarityScore = Math.max(0, 100 - unexplainedConceptIds.length * 35 - Number(ambiguousOpening) * 30 - Number(!hasNarrativeBridge) * 10 - Number(!hasStoryPressure) * 10);
    return { beatId: beat.beatId, introducedConceptIds, unexplainedConceptIds, ambiguousOpening, hasNarrativeBridge, hasStoryPressure, clarityScore, recommendations };
  });
  const unexplainedConceptIds = [...new Set(beatReviews.flatMap((review) => review.unexplainedConceptIds))];
  const conceptCount = introduced.size;
  const contextCoverage = conceptCount ? round(explained.size / conceptCount) : 1;
  const bridgeCoverage = input.beats.length ? round(beatReviews.filter((review) => review.hasNarrativeBridge).length / input.beats.length) : 0;
  const storyPressureCoverage = input.beats.length ? round(beatReviews.filter((review) => review.hasStoryPressure).length / input.beats.length) : 0;
  const ambiguousOpeningCount = beatReviews.filter((review) => review.ambiguousOpening).length;
  const score = Math.max(0, Math.min(100, Math.round(contextCoverage * 55 + bridgeCoverage * 20 + storyPressureCoverage * 25 - ambiguousOpeningCount * 10)));
  const warnings: string[] = [];
  if (unexplainedConceptIds.length) warnings.push("named_story_concept_without_audience_context");
  if (ambiguousOpeningCount) warnings.push("story_opens_with_ambiguous_reference");
  if (bridgeCoverage < 0.78) warnings.push("insufficient_narrative_continuity");
  if (storyPressureCoverage < 0.78) warnings.push("insufficient_story_pressure");
  return {
    directorId: "comic_audience_context_director_v1",
    beatReviews,
    conceptCount,
    explainedConceptCount: explained.size,
    contextCoverage,
    bridgeCoverage,
    storyPressureCoverage,
    ambiguousOpeningCount,
    unexplainedConceptIds,
    score,
    warnings,
    passed: input.beats.length > 0 && warnings.length === 0 && score >= 85,
  };
}
