import type { ComicShortOpportunity, ComicStoryMinerPanelRef, ComicStoryMinerReport } from "./comic-story-miner.js";
import type { ComicSagaNarrativeMap, ComicSagaShortCandidate } from "./comic-saga-narrative-map.js";

export type ComicStoryEventType =
  | "battle_beat"
  | "curiosity_fact"
  | "reveal"
  | "turning_point"
  | "relationship_twist"
  | "comic_absurdity"
  | "lore_context"
  | "visual_spectacle";

export type ComicStoryEventBeatRole = "hook" | "context" | "escalation" | "turn" | "payoff";

export type ComicStoryEditorialSlot = "battle" | "curiosity" | "reveal" | "relationship" | "lore" | "spectacle";

export type ComicStoryEventBeat = {
  role: ComicStoryEventBeatRole;
  panelId: string;
  pageNumber: number;
  purpose: string;
  narrationSeed: string;
  zoomInstruction: string;
};

export type ComicStoryEvent = {
  id: string;
  sourceOpportunityId: string | null;
  type: ComicStoryEventType;
  editorialSlot: ComicStoryEditorialSlot;
  title: string;
  editorialTitle: string;
  narrationPreview: string;
  retentionPromise: string;
  languageQualityScore: number;
  specificHook: string;
  keyDialogueLine: string | null;
  keyActionLabel: string | null;
  visualSpecificityScore: number;
  duplicateGroupId: string;
  duplicateOfEventId: string | null;
  duplicateReason: string | null;
  uniquenessScore: number;
  subject: string;
  action: string;
  object: string | null;
  consequence: string;
  curiosityHook: string;
  storyHook: string;
  shortAngle: string;
  pages: number[];
  panelIds: string[];
  characters: string[];
  themes: string[];
  evidence: string[];
  beats: ComicStoryEventBeat[];
  zoomPlan: Array<{
    panelId: string;
    pageNumber: number;
    focus: "full_context" | "face" | "balloon" | "impact" | "reaction" | "detail";
    instruction: string;
  }>;
  estimatedDurationSeconds: number;
  score: number;
  readiness: "ready_for_short" | "needs_panel_review" | "needs_context" | "weak";
  reasons: string[];
  warnings: string[];
};

export type ComicStoryEventExtractorReport = {
  extractorId: "comic_story_event_extractor_v1";
  generatedAt: string;
  source: ComicStoryMinerReport["source"];
  eventCount: number;
  readyEventCount: number;
  curiosityEventCount: number;
  storyEventCount: number;
  events: ComicStoryEvent[];
  recommendedShortEvents: ComicStoryEvent[];
  diversityPlan: ComicStoryDiversityPlan;
  eventSummary: {
    strongestEventTitle: string | null;
    strongestCuriosityTitle: string | null;
    strongestStoryTitle: string | null;
    whatItUnderstands: string;
    blindSpots: string[];
  };
  candidateFirst: true;
  requiresManualApproval: true;
};

export type ComicStoryDiversityPlan = {
  plannerId: "comic_short_opportunity_diversity_planner_v1";
  selectedCount: number;
  slotCoverage: Record<ComicStoryEditorialSlot, number>;
  missingSlots: ComicStoryEditorialSlot[];
  selections: Array<{
    slot: ComicStoryEditorialSlot;
    eventId: string;
    editorialTitle: string;
    selectionMode: "primary" | "expanded";
    whySelected: string;
  }>;
  expansionAttempts: Array<{
    slot: ComicStoryEditorialSlot;
    status: "filled" | "not_found";
    eventId: string | null;
    reason: string;
  }>;
  warnings: string[];
};
export type ComicSagaEventOpportunity = ComicStoryEvent & {
  issueId: string;
  issueNumber: number;
  issueTitle: string;
  sagaShortCandidateId: string | null;
};

export type ComicSagaEventOpportunityReport = {
  extractorId: "comic_saga_event_opportunity_miner_v1";
  generatedAt: string;
  sagaTitle: string;
  issueCount: number;
  eventCount: number;
  readyEventCount: number;
  curiosityEventCount: number;
  storyEventCount: number;
  events: ComicSagaEventOpportunity[];
  recommendedShorts: ComicSagaEventOpportunity[];
  diversityPlan: ComicStoryDiversityPlan;
  episodePlan: Array<{
    order: number;
    eventId: string;
    title: string;
    editorialTitle: string;
    issueNumber: number;
    pages: number[];
    shortAngle: string;
    estimatedDurationSeconds: number;
    whyThisOrder: string;
  }>;
  whatSystemUnderstandsNow: {
    storyProgression: string;
    curiosityMining: string;
    visualEditingPlan: string;
    readiness: "high" | "medium" | "low";
    remainingGaps: string[];
  };
  candidateFirst: true;
  requiresManualApproval: true;
};

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function display(value: string | null | undefined, fallback = "a cena"): string {
  const raw = value?.trim() || fallback;
  return raw
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .replace("Godzilla", "Godzilla")
    .replace("Kong", "Kong")
    .replace("Superman", "Superman")
    .replace("Batman", "Batman");
}

function normalizedText(values: string[]): string {
  return values.join(" ").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function panelText(panel: ComicStoryMinerPanelRef): string[] {
  return unique([
    ...panel.localDialogue,
    ...panel.localNarrationBoxes,
    ...panel.soundEffects,
    ...panel.visualCropEvidence.textSamples,
    panel.visualCropEvidence.strongestActionLabel ?? "",
    panel.visualCropEvidence.strongestRelationshipType ?? "",
    panel.storyFunction,
    ...panel.visibleCharacters,
    ...panel.visibleThemes
  ].filter(Boolean));
}

function inferEventType(opportunity: ComicShortOpportunity): ComicStoryEventType {
  const text = normalizedText([
    opportunity.title,
    opportunity.angle,
    opportunity.hook,
    opportunity.narrationDraft,
    ...opportunity.themes,
    ...opportunity.panels.flatMap(panelText)
  ]);
  if (opportunity.category === "humor" || /absurdo|ridiculo|piada|engracado|banho|namor/.test(text)) return "comic_absurdity";
  if (opportunity.category === "reveal" || /reveal|revelacao|segredo|descobre|mostra que|muda tudo/.test(text)) return "reveal";
  if (opportunity.category === "origin" || /origem|antes|primeira vez|criado/.test(text)) return "lore_context";
  if (opportunity.category === "curiosity" || /curios|detalhe|sabia|voce percebeu|por que/.test(text)) return "curiosity_fact";
  if (opportunity.category === "relationship" || /alianca|relacao|dupla|parceria|traicao|conflito entre/.test(text)) return "relationship_twist";
  if (opportunity.category === "fight" || /fight|luta|battle|batalha|impact|boom|krak|roar|ataque|confronto/.test(text)) return "battle_beat";
  if (opportunity.category === "transformation" || /transform/.test(text)) return "turning_point";
  return "visual_spectacle";
}

function verbForType(type: ComicStoryEventType): string {
  if (type === "battle_beat") return "entra em confronto com";
  if (type === "curiosity_fact") return "revela um detalhe curioso sobre";
  if (type === "reveal") return "revela algo que muda";
  if (type === "turning_point") return "muda o rumo de";
  if (type === "relationship_twist") return "cria tensao com";
  if (type === "comic_absurdity") return "transforma uma ideia absurda em";
  if (type === "lore_context") return "explica o contexto de";
  return "entrega um momento visual sobre";
}

function consequenceForType(type: ComicStoryEventType, subject: string, object: string | null): string {
  const s = display(subject);
  const o = display(object, "essa ameaca");
  if (type === "battle_beat") return `a escala do conflito sobe porque ${s} precisa lidar com ${o}.`;
  if (type === "curiosity_fact") return `o espectador ganha um motivo para rever a cena com outros olhos.`;
  if (type === "reveal") return `a leitura da pagina muda depois desse detalhe.`;
  if (type === "relationship_twist") return `a tensao deixa de ser so acao e vira dinamica entre personagens.`;
  if (type === "comic_absurdity") return `o absurdo vira gancho de retencao porque parece inacreditavel, mas esta na HQ.`;
  if (type === "lore_context") return `o publico entende por que esse trecho importa dentro da historia.`;
  if (type === "turning_point") return `o short ganha uma virada clara, nao apenas uma sequencia bonita.`;
  return `a cena tem impacto visual suficiente para sustentar um short.`;
}

function curiosityHookForType(type: ComicStoryEventType, subject: string, object: string | null): string {
  const s = display(subject);
  const o = display(object, "isso");
  if (type === "battle_beat") return `O detalhe insano e que ${s} nao esta so batendo de frente com ${o}; a HQ vende isso como escala impossivel.`;
  if (type === "curiosity_fact") return `Tem um detalhe nessa pagina que muita gente passaria direto.`;
  if (type === "reveal") return `A HQ esconde a virada no proprio quadro.`;
  if (type === "relationship_twist") return `Essa cena funciona porque a tensao nao esta so na luta, esta na relacao.`;
  if (type === "comic_absurdity") return `Isso parece absurdo demais para funcionar... mas o quadrinho leva completamente a serio.`;
  if (type === "lore_context") return `Esse trecho explica uma coisa que deixa a historia muito mais interessante.`;
  return `Esse quadro tem um detalhe visual que segura um short inteiro.`;
}

function storyHookForType(type: ComicStoryEventType, subject: string, object: string | null): string {
  const s = display(subject);
  const o = display(object, "um problema maior");
  if (type === "battle_beat") return `${s} encontra ${o}, e a historia deixa claro que a forca bruta talvez nao seja suficiente.`;
  if (type === "reveal") return `A historia parecia estar indo para um lado, ate esse painel revelar outra coisa.`;
  if (type === "relationship_twist") return `${s} e ${o} nao estao so dividindo a cena; a dinamica entre eles vira o conflito.`;
  if (type === "curiosity_fact") return `A cena tem uma informacao pequena que muda como voce entende o momento.`;
  return `A sequencia funciona porque tem contexto, impacto e uma recompensa visual.`;
}

function cleanLabel(value: string): string {
  return value
    .replace(/^(luta|curiosidade|relacao|revelacao|momento visual):\s*/i, "")
    .replace(/\bJustice League\b/g, "Liga da Justica")
    .replace(/\s+/g, " ")
    .trim();
}

function strongestTextEvidence(evidence: string[]): string | null {
  return evidence
    .map((item) => item.trim().replace(/[.!?]+$/g, ""))
    .filter((item) => item.length >= 8)
    .sort((left, right) => {
      const textWeight = (value: string) => /[!?]|\b(nao|nunca|segredo|plano|percebeu|aguentou|parar|ameaca)\b/i.test(value) ? 20 : 0;
      return textWeight(right) + Math.min(80, right.length) - (textWeight(left) + Math.min(80, left.length));
    })[0] ?? null;
}

function truncateAtWord(value: string, maxLength: number): string {
  const cleaned = value.trim();
  if (cleaned.length <= maxLength) return cleaned;
  const slice = cleaned.slice(0, maxLength + 1);
  const lastSpace = slice.lastIndexOf(" ");
  return (lastSpace > 24 ? slice.slice(0, lastSpace) : cleaned.slice(0, maxLength)).trim();
}
function cleanQuote(value: string): string {
  return truncateAtWord(
    cleanLabel(value)
      .replace(/^["'“”‘’]+|["'“”‘’]+$/g, "")
      .replace(/[.!?]+$/g, "")
      .trim(),
    72
  );
}

function humanActionLabel(value: string | null | undefined): string | null {
  if (!value) return null;
  return cleanLabel(value)
    .replace(/\bcollides with\b/gi, "bate de frente com")
    .replace(/\breact to\b/gi, "reage a")
    .replace(/\bnotices\b/gi, "percebe")
    .replace(/\bhidden\b/gi, "escondido")
    .replace(/\bblast\b/gi, "rajada")
    .replace(/\bimpossible threat\b/gi, "ameaca impossivel")
    .replace(/\s+/g, " ")
    .trim();
}

function isGenericEditorialEvidence(value: string): boolean {
  return /tem uma curiosidade escondida|vira short|ja tem estrutura|a hq esconde a virada|o short pode explicar|e se .* tivesse que|continua na mesma edicao/i.test(value);
}

function isActionSpecificEvidence(value: string): boolean {
  return /\b(bate|encara|segura|reage|ataca|percebe|colide|rajada|explosao|salva|derruba|foge|invade|destrói|destroi)\b/i.test(value);
}
type EventSpecificity = {
  keyDialogueLine: string | null;
  keyNarrationLine: string | null;
  keyActionLabel: string | null;
  keySoundEffect: string | null;
  visualSpecificityScore: number;
};

function collectSpecificityFromPanels(panels: ComicStoryMinerPanelRef[]): EventSpecificity {
  const dialogue = panels.flatMap((panel) => panel.localDialogue).map(cleanQuote).filter(Boolean);
  const narration = panels.flatMap((panel) => panel.localNarrationBoxes).map(cleanQuote).filter(Boolean);
  const actions = panels.map((panel) => humanActionLabel(panel.visualCropEvidence.strongestActionLabel)).filter(Boolean) as string[];
  const soundEffects = panels.flatMap((panel) => panel.soundEffects).map(cleanQuote).filter(Boolean);
  const score = clampScore(
    (dialogue.length ? 34 : 0) +
    (narration.length ? 24 : 0) +
    (actions.length ? 24 : 0) +
    (soundEffects.length ? 10 : 0) +
    Math.min(8, panels.length)
  );
  return {
    keyDialogueLine: dialogue.sort((left, right) => right.length - left.length)[0] ?? null,
    keyNarrationLine: narration.sort((left, right) => right.length - left.length)[0] ?? null,
    keyActionLabel: actions.sort((left, right) => right.length - left.length)[0] ?? null,
    keySoundEffect: soundEffects[0] ?? null,
    visualSpecificityScore: score
  };
}

function collectSpecificityFromEvidence(evidence: string[]): EventSpecificity {
  const cleaned = evidence.map(cleanQuote).filter((item) => item && !isGenericEditorialEvidence(item));
  const dialogue = cleaned.find((item) => /\?|"|plano|seguro|aguento|chamando|percebeu/i.test(item)) ?? null;
  const action = cleaned.find((item) => isActionSpecificEvidence(item)) ?? null;
  const soundEffect = cleaned.find((item) => /^[A-Z]{3,}|boom|krak|roar|whoosh/i.test(item)) ?? null;
  return {
    keyDialogueLine: dialogue,
    keyNarrationLine: cleaned.find((item) => item !== dialogue && item.length >= 18) ?? null,
    keyActionLabel: humanActionLabel(action),
    keySoundEffect: soundEffect,
    visualSpecificityScore: clampScore((dialogue ? 30 : 0) + (action ? 24 : 0) + (soundEffect ? 8 : 0) + Math.min(18, cleaned.length * 3))
  };
}

function buildSpecificHook(input: {
  type: ComicStoryEventType;
  subject: string;
  object: string | null;
  specificity: EventSpecificity;
}): string {
  const subject = display(input.subject);
  const object = display(input.object, "a ameaca");
  if (input.specificity.keyDialogueLine) return `O balao "${input.specificity.keyDialogueLine}" vira a pista principal da cena.`;
  if (input.specificity.keyActionLabel) return `O quadro em que ${subject} ${input.specificity.keyActionLabel} mostra por que ${object} importa.`;
  if (input.specificity.keySoundEffect) return `O efeito "${input.specificity.keySoundEffect}" marca o ponto exato em que a cena acelera.`;
  if (input.type === "battle_beat") return "A luta so funciona porque a HQ mostra escala antes do impacto.";
  return "A cena tem um detalhe visual que precisa ser mostrado antes do payoff.";
}
function stripSubjectFromAction(action: string, subject: string): string {
  const normalizedSubject = normalizedText([subject]).trim();
  const normalizedAction = normalizedText([action]).trim();
  if (normalizedSubject && normalizedAction.startsWith(`${normalizedSubject} `)) {
    return action.slice(subject.length).trim();
  }
  return action;
}
function buildEditorialTitle(input: {
  type: ComicStoryEventType;
  subject: string;
  object: string | null;
  sourceTitle?: string;
  evidence: string[];
  specificity: EventSpecificity;
}): string {
  const subject = display(input.subject);
  const object = display(input.object, "essa ameaca");
  const evidence = strongestTextEvidence(input.evidence);
  const sourceTitle = input.sourceTitle ? cleanLabel(input.sourceTitle) : null;
  const dialogue = input.specificity.keyDialogueLine;
  const action = input.specificity.keyActionLabel;
  if (input.type === "battle_beat") {
    if (action) return `${subject} ${truncateAtWord(stripSubjectFromAction(action, subject), 42)}: o quadro que muda a escala da luta`;
    if (sourceTitle && sourceTitle.length > 12 && !isGenericEditorialEvidence(sourceTitle)) return sourceTitle;
    return `${subject} descobre que ${object} nao e so mais um inimigo`;
  }
  if (input.type === "curiosity_fact") {
    if (dialogue) return `A fala "${truncateAtWord(dialogue, 42)}" muda essa pagina`;
    return evidence ? `O detalhe que muda essa cena: ${truncateAtWord(cleanLabel(evidence), 58)}` : `O detalhe escondido nessa cena de ${subject}`;
  }
  if (input.type === "reveal") {
    if (dialogue) return `O balao "${truncateAtWord(dialogue, 42)}" entrega a virada`;
    if (action) return `O momento em que ${subject} ${truncateAtWord(stripSubjectFromAction(action, subject), 44)}`;
    if (sourceTitle && sourceTitle.length > 12 && !isGenericEditorialEvidence(sourceTitle)) return `A virada por tras de ${truncateAtWord(sourceTitle, 54)}`;
    return `${subject} percebe a pista que muda a cena`;
  }
  if (input.type === "relationship_twist") return dialogue ? `${subject} e ${object}: a fala que muda a tensao` : `${subject} e ${object}: a tensao que a HQ esconde no quadro`;
  if (input.type === "comic_absurdity") return `A cena absurda que a HQ leva completamente a serio`;
  if (input.type === "lore_context") return `O contexto que faz ${subject} ficar muito mais interessante`;
  if (input.type === "turning_point") return `O momento em que ${subject} muda o rumo da historia`;
  return cleanLabel(input.sourceTitle ?? `${subject}: momento visual forte`);
}
function buildRetentionPromise(input: {
  type: ComicStoryEventType;
  subject: string;
  object: string | null;
}): string {
  const subject = display(input.subject);
  const object = display(input.object, "isso");
  if (input.type === "battle_beat") return `mostrar por que ${subject} nao podia resolver ${object} como uma luta comum`;
  if (input.type === "curiosity_fact") return `revelar um detalhe que faz o espectador querer pausar a pagina`;
  if (input.type === "reveal") return `entregar uma virada curta, visual e facil de entender`;
  if (input.type === "relationship_twist") return `mostrar que a tensao entre os personagens importa tanto quanto a acao`;
  if (input.type === "comic_absurdity") return `vender o absurdo como se fosse o fato mais serio da HQ`;
  if (input.type === "lore_context") return `explicar contexto sem virar resumo cansativo`;
  return `transformar um trecho visual em uma historia de pelo menos 30 segundos`;
}

function buildNarrationPreview(input: {
  type: ComicStoryEventType;
  subject: string;
  object: string | null;
  evidence: string[];
  beats: ComicStoryEventBeat[];
  consequence: string;
  specificity: EventSpecificity;
}): string {
  const subject = display(input.subject);
  const object = display(input.object, "essa ameaca");
  const evidence = strongestTextEvidence(input.evidence);
  const specificLine = input.specificity.keyDialogueLine
    ? `O ponto de entrada e o balao: "${input.specificity.keyDialogueLine}".`
    : input.specificity.keyActionLabel
      ? `O ponto de entrada e a acao visual: ${subject} ${input.specificity.keyActionLabel}.`
      : null;
  const evidenceLine = specificLine ?? (evidence ? `E o detalhe esta aqui: ${cleanLabel(evidence).replace(/[.!?]+$/g, "")}.` : "E a pagina entrega isso mais pelo visual do que por uma frase obvia.");
  const beatCount = input.beats.length;
  const beatCountLabel = beatCount === 1 ? "ao quadro" : `aos ${beatCount} quadros`;
  if (input.type === "battle_beat") {
    return `${subject} parece pronto para encarar ${object}. So que a HQ faz uma coisa esperta: ela mostra o contexto, aumenta a escala e so depois entrega o impacto. ${evidenceLine} No fim, ${input.consequence.replace(/[.!?]+$/g, "")}.`;
  }
  if (input.type === "curiosity_fact") {
    return `Tem um detalhe nessa sequencia que passaria facil batido. ${evidenceLine} E quando voce liga isso ${beatCountLabel} da cena, ela deixa de ser so bonita e vira uma curiosidade perfeita para short.`;
  }
  if (input.type === "reveal") {
    return `A cena parece simples no comeco, mas a HQ vai escondendo a virada quadro por quadro. ${evidenceLine} Quando chega no ultimo painel, a leitura muda: ${input.consequence.replace(/[.!?]+$/g, "")}.`;
  }
  if (input.type === "relationship_twist") {
    return `${subject} e ${object} nao funcionam aqui so como imagem de impacto. A tensao esta em como a HQ coloca os dois na mesma sequencia. ${evidenceLine} E isso cria uma historia curta, com conflito e payoff.`;
  }
  if (input.type === "comic_absurdity") {
    return `Essa e uma daquelas cenas que parecem meme, mas a HQ trata com seriedade total. ${evidenceLine} Justamente por isso ela prende: voce quer ver ate onde esse absurdo vai.`;
  }
  return `Essa sequencia tem uma promessa simples: entender por que esse trecho importa. ${evidenceLine} O short deve ir em linha reta, do contexto ao payoff, sem voltar paginas.`;
}

function scoreLanguageQuality(input: { title: string; narration: string; evidence: string[] }): number {
  let score = 62;
  if (input.title.length >= 28 && input.title.length <= 82) score += 12;
  if (!/^(luta|curiosidade|relacao|momento visual):/i.test(input.title)) score += 12;
  if (/So que|detalhe|virada|percebe|escala|passaria|payoff|impacto|balao|fala|quadro/i.test(input.narration)) score += 10;
  if (input.narration.length >= 180) score += 8;
  if (input.evidence.some((item) => item.length >= 12)) score += 6;
  return clampScore(score);
}

function buildHumanizedEventLanguage(input: {
  type: ComicStoryEventType;
  subject: string;
  object: string | null;
  sourceTitle?: string;
  evidence: string[];
  beats: ComicStoryEventBeat[];
  consequence: string;
  specificity: EventSpecificity;
}) {
  const editorialTitle = buildEditorialTitle(input);
  const retentionPromise = buildRetentionPromise(input);
  const narrationPreview = buildNarrationPreview(input);
  const languageQualityScore = clampScore(scoreLanguageQuality({ title: editorialTitle, narration: narrationPreview, evidence: input.evidence }) + Math.round(input.specificity.visualSpecificityScore * 0.12));
  const specificHook = buildSpecificHook(input);
  return { editorialTitle, retentionPromise, narrationPreview, languageQualityScore, specificHook };
}function focusForPanel(panel: ComicStoryMinerPanelRef): ComicStoryEvent["zoomPlan"][number]["focus"] {
  const evidence = panel.visualCropEvidence;
  if (evidence.evidenceCounts.dialogue > 0 || evidence.evidenceCounts.narrationBoxes > 0 || evidence.evidenceCounts.detectedText > 0) return "balloon";
  if (panel.storyFunction === "climax" || panel.storyFunction === "action" || evidence.evidenceCounts.actions > 0) return "impact";
  if (panel.storyFunction === "reaction") return "reaction";
  if (evidence.evidenceCounts.characters > 0) return "face";
  return "full_context";
}

function zoomInstruction(panel: ComicStoryMinerPanelRef, role: ComicStoryEventBeatRole): string {
  const focus = focusForPanel(panel);
  if (focus === "balloon") return `Comecar no contexto e aproximar no balao/texto que explica o beat ${role}.`;
  if (focus === "impact") return `Mostrar o painel inteiro por meio segundo e dar push-in no impacto/acao do beat ${role}.`;
  if (focus === "reaction") return `Dar zoom suave na reacao para transformar o beat ${role} em payoff emocional.`;
  if (focus === "face") return `Ancorar o zoom no rosto/personagem principal sem cortar informacao do quadro.`;
  return `Usar enquadramento amplo para situar a pagina antes do proximo corte.`;
}

function pickEventBeats(panels: ComicStoryMinerPanelRef[], type: ComicStoryEventType): ComicStoryEventBeat[] {
  const ordered = [...panels].sort((left, right) => left.pageNumber - right.pageNumber || left.panelNumber - right.panelNumber);
  const roles: ComicStoryEventBeatRole[] = ["hook", "context", "escalation", "turn", "payoff"];
  const selected = ordered.length <= 5
    ? ordered
    : [ordered[0]!, ordered[1]!, ordered[Math.floor(ordered.length / 2)]!, ordered[ordered.length - 2]!, ordered[ordered.length - 1]!];
  return selected.map((panel, index) => ({
    role: roles[Math.min(index, roles.length - 1)]!,
    panelId: panel.panelId,
    pageNumber: panel.pageNumber,
    purpose: `${panel.storyFunction}:${type}`,
    narrationSeed: panelText(panel)[0] ?? `${display(panel.visibleCharacters[0])} em ${panel.storyFunction}`,
    zoomInstruction: zoomInstruction(panel, roles[Math.min(index, roles.length - 1)]!)
  }));
}

function scoreEvent(input: {
  type: ComicStoryEventType;
  opportunity: ComicShortOpportunity;
  beats: ComicStoryEventBeat[];
}): { score: number; warnings: string[]; reasons: string[] } {
  const warnings: string[] = [...input.opportunity.warnings];
  const reasons: string[] = [...input.opportunity.reasons];
  const hasHook = input.beats.some((beat) => beat.role === "hook");
  const hasContext = input.beats.some((beat) => beat.role === "context");
  const hasTurn = input.beats.some((beat) => beat.role === "turn" || beat.role === "payoff");
  const hasText = input.opportunity.panels.some((panel) => panel.localDialogue.length || panel.localNarrationBoxes.length || panel.visualCropEvidence.textSamples.length);
  const hasAction = input.opportunity.panels.some((panel) => panel.visualCropEvidence.evidenceCounts.actions > 0 || ["action", "climax"].includes(panel.storyFunction));
  let score = input.opportunity.score;
  if (hasHook && hasContext && hasTurn) score += 12;
  else warnings.push("event_missing_complete_hook_context_turn_payoff");
  if (hasText) score += input.type === "curiosity_fact" || input.type === "reveal" ? 12 : 6;
  else warnings.push("event_needs_better_balloon_or_ocr_context");
  if (hasAction) score += input.type === "battle_beat" ? 10 : 4;
  if (input.opportunity.estimatedDurationSeconds >= 30) score += 4;
  else warnings.push("event_duration_below_30s");
  if (input.opportunity.panelIds.length < 4) warnings.push("event_has_few_panels_for_dynamic_short");
  reasons.push(`event_type:${input.type}`);
  reasons.push(`beats:${input.beats.map((beat) => beat.role).join(">")}`);
  return { score: clampScore(score), warnings: unique(warnings), reasons: unique(reasons) };
}

function eventPageKey(event: Pick<ComicStoryEvent, "pages">): string {
  const pages = event.pages.length ? event.pages : [0];
  return `${pages[0]}-${pages[pages.length - 1]}`;
}

function tokenSet(values: string[]): Set<string> {
  return new Set(normalizedText(values).split(/[^a-z0-9]+/).filter((token) => token.length >= 3));
}

function setOverlap(left: Set<string>, right: Set<string>): number {
  if (left.size === 0 || right.size === 0) return 0;
  let hits = 0;
  for (const item of left) if (right.has(item)) hits += 1;
  return hits / Math.min(left.size, right.size);
}

function pageOverlap(left: number[], right: number[]): number {
  if (left.length === 0 || right.length === 0) return 0;
  const rightSet = new Set(right);
  const hits = left.filter((page) => rightSet.has(page)).length;
  return hits / Math.min(left.length, right.length);
}

function panelOverlap(left: string[], right: string[]): number {
  if (left.length === 0 || right.length === 0) return 0;
  const rightSet = new Set(right);
  const hits = left.filter((panelId) => rightSet.has(panelId)).length;
  return hits / Math.min(left.length, right.length);
}

function eventSimilarity(left: ComicStoryEvent, right: ComicStoryEvent): { score: number; reason: string } {
  const page = pageOverlap(left.pages, right.pages);
  const panel = panelOverlap(left.panelIds, right.panelIds);
  const title = setOverlap(tokenSet([left.editorialTitle, left.title]), tokenSet([right.editorialTitle, right.title]));
  const subjectMatch = left.subject === right.subject ? 0.18 : 0;
  const objectMatch = left.object && right.object && left.object === right.object ? 0.14 : 0;
  const dialogueMatch = left.keyDialogueLine && right.keyDialogueLine && cleanQuote(left.keyDialogueLine) === cleanQuote(right.keyDialogueLine) ? 0.25 : 0;
  const score = clampScore(page * 30 + panel * 28 + title * 18 + subjectMatch * 100 + objectMatch * 100 + dialogueMatch * 100);
  const reasons = [
    page >= 0.75 ? "same_pages" : null,
    panel >= 0.5 ? "same_panels" : null,
    dialogueMatch > 0 ? "same_key_dialogue" : null,
    title >= 0.65 ? "similar_title" : null,
    subjectMatch > 0 && objectMatch > 0 ? "same_subject_object" : null
  ].filter(Boolean).join("+");
  return { score, reason: reasons || `similarity:${score}` };
}

function duplicateGroupId(event: ComicStoryEvent): string {
  const subject = normalizedText([event.subject]).replace(/\s+/g, "-") || "story";
  const object = normalizedText([event.object ?? event.type]).replace(/\s+/g, "-") || event.type;
  return `event-group:${subject}:${object}:${eventPageKey(event)}`;
}

function annotateEventDuplicates<T extends ComicStoryEvent>(events: T[]): T[] {
  const accepted: T[] = [];
  return events.map((event) => {
    const duplicate = accepted
      .map((candidate) => ({ candidate, similarity: eventSimilarity(event, candidate) }))
      .sort((left, right) => right.similarity.score - left.similarity.score)[0];
    if (duplicate && duplicate.similarity.score >= 72) {
      return {
        ...event,
        duplicateGroupId: duplicate.candidate.duplicateGroupId || duplicateGroupId(duplicate.candidate),
        duplicateOfEventId: duplicate.candidate.id,
        duplicateReason: duplicate.similarity.reason,
        uniquenessScore: clampScore(100 - duplicate.similarity.score),
        warnings: unique([...event.warnings, `duplicate_event:${duplicate.candidate.id}`])
      };
    }
    const uniqueEvent = {
      ...event,
      duplicateGroupId: duplicateGroupId(event),
      duplicateOfEventId: null,
      duplicateReason: null,
      uniquenessScore: 100
    };
    accepted.push(uniqueEvent);
    return uniqueEvent;
  });
}

const EDITORIAL_SLOT_ORDER: ComicStoryEditorialSlot[] = ["battle", "curiosity", "reveal", "relationship", "lore", "spectacle"];

function editorialSlotForType(type: ComicStoryEventType): ComicStoryEditorialSlot {
  if (type === "battle_beat" || type === "turning_point") return "battle";
  if (type === "curiosity_fact" || type === "comic_absurdity") return "curiosity";
  if (type === "reveal") return "reveal";
  if (type === "relationship_twist") return "relationship";
  if (type === "lore_context") return "lore";
  return "spectacle";
}

function diversityScore(event: ComicStoryEvent): number {
  const readinessBonus = event.readiness === "ready_for_short" ? 18 : event.readiness === "needs_panel_review" ? 8 : 0;
  const storyBonus = event.beats.length >= 4 ? 10 : 0;
  const specificityBonus = Math.round(event.visualSpecificityScore * 0.18);
  return event.score + readinessBonus + storyBonus + specificityBonus + Math.round(event.uniquenessScore * 0.1);
}

function isExpansionCandidate(event: ComicStoryEvent): boolean {
  if (event.readiness === "weak") return false;
  if (event.duplicateOfEventId && event.uniquenessScore < 18) return false;
  return true;
}

function buildDiversityPlan(events: ComicStoryEvent[], maxSelections = 12): ComicStoryDiversityPlan {
  const primaryAvailable = events
    .filter(isRecommendedUniqueEvent)
    .sort((left, right) => diversityScore(right) - diversityScore(left));
  const selected: ComicStoryEvent[] = [];
  const expanded = new Set<string>();
  const used = new Set<string>();
  const expansionAttempts: ComicStoryDiversityPlan["expansionAttempts"] = [];

  for (const slot of EDITORIAL_SLOT_ORDER) {
    const hit = primaryAvailable.find((event) => !used.has(event.id) && event.editorialSlot === slot);
    if (hit) {
      selected.push(hit);
      used.add(hit.id);
    }
  }

  const missingAfterPrimary = EDITORIAL_SLOT_ORDER.filter((slot) => !selected.some((event) => event.editorialSlot === slot));
  const expansionPool = events
    .filter((event) => !used.has(event.id) && isExpansionCandidate(event))
    .sort((left, right) => diversityScore(right) - diversityScore(left));

  for (const slot of missingAfterPrimary) {
    if (selected.length >= maxSelections) break;
    const hit = expansionPool.find((event) => !used.has(event.id) && event.editorialSlot === slot);
    if (hit) {
      selected.push(hit);
      expanded.add(hit.id);
      used.add(hit.id);
      expansionAttempts.push({
        slot,
        status: "filled",
        eventId: hit.id,
        reason: hit.duplicateOfEventId
          ? `expanded_from_duplicate:${hit.duplicateOfEventId}`
          : `expanded_from_${hit.readiness}`
      });
    } else {
      expansionAttempts.push({
        slot,
        status: "not_found",
        eventId: null,
        reason: "no_candidate_with_enough_quality_for_slot"
      });
    }
  }

  for (const event of primaryAvailable) {
    if (selected.length >= maxSelections) break;
    if (!used.has(event.id)) {
      selected.push(event);
      used.add(event.id);
    }
  }

  const slotCoverage = EDITORIAL_SLOT_ORDER.reduce((acc, slot) => {
    acc[slot] = selected.filter((event) => event.editorialSlot === slot).length;
    return acc;
  }, {} as Record<ComicStoryEditorialSlot, number>);
  const missingSlots = EDITORIAL_SLOT_ORDER.filter((slot) => slotCoverage[slot] === 0);
  return {
    plannerId: "comic_short_opportunity_diversity_planner_v1",
    selectedCount: selected.length,
    slotCoverage,
    missingSlots,
    selections: selected.map((event) => ({
      slot: event.editorialSlot,
      eventId: event.id,
      editorialTitle: event.editorialTitle,
      selectionMode: expanded.has(event.id) ? "expanded" : "primary",
      whySelected: `slot=${event.editorialSlot}; mode=${expanded.has(event.id) ? "expanded" : "primary"}; score=${event.score}; specificity=${event.visualSpecificityScore}; uniqueness=${event.uniquenessScore}`
    })),
    expansionAttempts,
    warnings: [
      ...(selected.length === 0 ? ["no_diverse_events_selected"] : []),
      ...(missingSlots.length ? [`missing_editorial_slots:${missingSlots.join(",")}`] : []),
      ...(expanded.size ? [`expanded_slots_need_manual_review:${[...expanded].length}`] : [])
    ]
  };
}
function isRecommendedUniqueEvent(event: ComicStoryEvent): boolean {
  return !event.duplicateOfEventId && (event.readiness === "ready_for_short" || event.readiness === "needs_panel_review");
}
export function extractComicStoryEvents(report: ComicStoryMinerReport): ComicStoryEventExtractorReport {
  const rawEvents = report.opportunities.map((opportunity, index): ComicStoryEvent => {
    const type = inferEventType(opportunity);
    const subject = opportunity.characters[0] ?? opportunity.themes[0] ?? "a historia";
    const object = opportunity.characters.find((character) => character !== subject) ?? opportunity.themes.find((theme) => theme !== subject) ?? null;
    const beats = pickEventBeats(opportunity.panels, type);
    const scoring = scoreEvent({ type, opportunity, beats });
    const readiness: ComicStoryEvent["readiness"] = scoring.score >= 82 && scoring.warnings.length <= 1
      ? "ready_for_short"
      : scoring.score >= 70
        ? "needs_panel_review"
        : scoring.score >= 55
          ? "needs_context"
          : "weak";
    const pages = unique(opportunity.pages).sort((left, right) => left - right);
    const title = `${display(subject)}: ${opportunity.title}`;
    const evidence = unique([
      opportunity.hook,
      opportunity.angle,
      opportunity.narrationDraft,
      ...opportunity.panels.flatMap(panelText)
    ]).slice(0, 10);
    const specificity = collectSpecificityFromPanels(opportunity.panels);
    const language = buildHumanizedEventLanguage({
      type,
      subject,
      object,
      sourceTitle: opportunity.title,
      evidence,
      beats,
      consequence: consequenceForType(type, subject, object),
      specificity
    });
    return {
      id: `comic-story-event:${index + 1}:${opportunity.id}`,
      sourceOpportunityId: opportunity.id,
      type,
      editorialSlot: editorialSlotForType(type),
      title,
      editorialTitle: language.editorialTitle,
      narrationPreview: language.narrationPreview,
      retentionPromise: language.retentionPromise,
      languageQualityScore: language.languageQualityScore,
      specificHook: language.specificHook,
      keyDialogueLine: specificity.keyDialogueLine,
      keyActionLabel: specificity.keyActionLabel,
      visualSpecificityScore: specificity.visualSpecificityScore,
      duplicateGroupId: "",
      duplicateOfEventId: null,
      duplicateReason: null,
      uniquenessScore: 100,
      subject,
      action: verbForType(type),
      object,
      consequence: consequenceForType(type, subject, object),
      curiosityHook: curiosityHookForType(type, subject, object),
      storyHook: storyHookForType(type, subject, object),
      shortAngle: type === "curiosity_fact" || type === "comic_absurdity" || type === "reveal"
        ? curiosityHookForType(type, subject, object)
        : storyHookForType(type, subject, object),
      pages,
      panelIds: opportunity.panelIds,
      characters: opportunity.characters,
      themes: opportunity.themes,
      evidence,

      beats,
      zoomPlan: beats.map((beat) => {
        const panel = opportunity.panels.find((candidate) => candidate.panelId === beat.panelId)!;
        const focus = focusForPanel(panel);
        return {
          panelId: beat.panelId,
          pageNumber: beat.pageNumber,
          focus,
          instruction: beat.zoomInstruction
        };
      }),
      estimatedDurationSeconds: Math.max(30, opportunity.estimatedDurationSeconds, beats.length * 6),
      score: scoring.score,
      readiness,
      reasons: scoring.reasons,
      warnings: scoring.warnings
    };
  }).sort((left, right) => {
    const ready = (event: ComicStoryEvent) => event.readiness === "ready_for_short" ? 20 : event.readiness === "needs_panel_review" ? 8 : 0;
    return right.score + ready(right) - (left.score + ready(left));
  });
  const events = annotateEventDuplicates(rawEvents);

  const diversityPlan = buildDiversityPlan(events);
  const recommendedShortEvents = diversityPlan.selections
    .map((selection) => events.find((event) => event.id === selection.eventId))
    .filter((event): event is ComicStoryEvent => Boolean(event));

  const readyEvents = events.filter((event) => event.readiness === "ready_for_short");
  const curiosityEvents = events.filter((event) => ["curiosity_fact", "comic_absurdity", "reveal", "lore_context"].includes(event.type));
  const storyEvents = events.filter((event) => ["battle_beat", "turning_point", "relationship_twist", "visual_spectacle"].includes(event.type));
  const blindSpots: string[] = [];
  if (readyEvents.length === 0) blindSpots.push("no_ready_story_events_detected");
  if (events.some((event) => event.warnings.includes("event_needs_better_balloon_or_ocr_context"))) blindSpots.push("some_events_need_better_balloon_ocr");
  if (events.some((event) => event.warnings.includes("event_missing_complete_hook_context_turn_payoff"))) blindSpots.push("some_events_missing_complete_short_arc");

  return {
    extractorId: "comic_story_event_extractor_v1",
    generatedAt: new Date().toISOString(),
    source: report.source,
    eventCount: events.length,
    readyEventCount: readyEvents.length,
    curiosityEventCount: curiosityEvents.length,
    storyEventCount: storyEvents.length,
    events,
    recommendedShortEvents,
    diversityPlan,
    eventSummary: {
      strongestEventTitle: events[0]?.title ?? null,
      strongestCuriosityTitle: curiosityEvents[0]?.title ?? null,
      strongestStoryTitle: storyEvents[0]?.title ?? null,
      whatItUnderstands: `Detectou ${events.length} eventos editoriais, incluindo ${curiosityEvents.length} curiosidades/revelacoes e ${storyEvents.length} trechos de historia/acao.`,
      blindSpots
    },
    candidateFirst: true,
    requiresManualApproval: true
  };
}

function scoreSagaEvent(event: ComicSagaEventOpportunity): number {
  let score = event.score;
  if (event.readiness === "ready_for_short") score += 18;
  if (event.type === "curiosity_fact" || event.type === "reveal" || event.type === "battle_beat") score += 8;
  if (event.pages.length >= 2 && event.pages.length <= 8) score += 5;
  return score;
}

function eventTypeFromSagaCandidate(candidate: ComicSagaShortCandidate): ComicStoryEventType {
  const text = normalizedText([
    candidate.title,
    candidate.hook,
    candidate.conflict,
    candidate.middle,
    candidate.payoff,
    ...candidate.characters,
    ...candidate.themes
  ]);
  if (/revela|segredo|muda|virada|hidden/.test(text)) return "reveal";
  if (/curios|detalhe|sabia|passaria direto/.test(text)) return "curiosity_fact";
  if (/alianca|relacao|dupla|parceria|tensao/.test(text)) return "relationship_twist";
  if (/luta|battle|batalha|confronto|contra|godzilla|kong|titan|kaiju/.test(text)) return "battle_beat";
  if (/origem|contexto|antes|explica/.test(text)) return "lore_context";
  return "visual_spectacle";
}

function sagaCandidateToEvent(candidate: ComicSagaShortCandidate): ComicSagaEventOpportunity {
  const type = eventTypeFromSagaCandidate(candidate);
  const subject = candidate.characters[0] ?? candidate.themes[0] ?? "a historia";
  const object = candidate.characters.find((character) => character !== subject) ?? candidate.themes.find((theme) => theme !== subject) ?? null;
  const sortedPanelIds = candidate.panelIds.length ? candidate.panelIds : [`${candidate.id}:panel-placeholder`];
  const roles: ComicStoryEventBeatRole[] = ["hook", "context", "escalation", "turn", "payoff"];
  const selectedPanelIds = sortedPanelIds.length <= 5
    ? sortedPanelIds
    : [sortedPanelIds[0]!, sortedPanelIds[1]!, sortedPanelIds[Math.floor(sortedPanelIds.length / 2)]!, sortedPanelIds[sortedPanelIds.length - 2]!, sortedPanelIds[sortedPanelIds.length - 1]!];
  const pageStart = Number.isFinite(candidate.chronology.localPageStart) ? candidate.chronology.localPageStart : candidate.pages[0] ?? 1;
  const pageEnd = Number.isFinite(candidate.chronology.localPageEnd) ? candidate.chronology.localPageEnd : candidate.pages[candidate.pages.length - 1] ?? pageStart;
  const beats = selectedPanelIds.map((panelId, index): ComicStoryEventBeat => {
    const role = roles[Math.min(index, roles.length - 1)]!;
    const pageNumber = candidate.pages[Math.min(index, candidate.pages.length - 1)] ?? pageStart;
    return {
      role,
      panelId,
      pageNumber,
      purpose: `${role}:${type}`,
      narrationSeed: role === "hook" ? candidate.hook : role === "payoff" ? candidate.payoff : candidate.middle,
      zoomInstruction: role === "hook"
        ? "Comecar com contexto amplo e empurrar o zoom para o elemento que cria curiosidade."
        : role === "context"
          ? "Mostrar balao/contexto antes de acelerar o corte."
          : role === "escalation"
            ? "Dar push-in no conflito ou detalhe que aumenta a tensao."
            : role === "turn"
              ? "Usar corte/rasgo de pagina para a virada visual."
              : "Fechar em reacao, impacto ou payoff visual sem voltar paginas."
    };
  });
  const warnings = unique([
    ...candidate.warnings,
    ...(beats.length < 4 ? ["event_has_few_panels_for_dynamic_short"] : []),
    ...(candidate.readiness === "needs_more_context" || candidate.readiness === "weak_story" ? ["candidate_needs_more_context"] : [])
  ]);
  const score = clampScore(candidate.score + (beats.length >= 5 ? 8 : 0) + (type === "battle_beat" || type === "curiosity_fact" || type === "reveal" ? 6 : 0) - warnings.length * 4);
  const readiness: ComicStoryEvent["readiness"] = score >= 82 && warnings.length <= 1
    ? "ready_for_short"
    : score >= 70
      ? "needs_panel_review"
      : score >= 55
        ? "needs_context"
        : "weak";
  const evidence = unique([candidate.hook, candidate.conflict, candidate.middle, candidate.payoff, ...candidate.reasons]).slice(0, 10);
  const specificity = collectSpecificityFromEvidence(evidence);
  const language = buildHumanizedEventLanguage({
    type,
    subject,
    object,
    sourceTitle: candidate.title,
    evidence,
    beats,
    consequence: consequenceForType(type, subject, object),
    specificity
  });
  return {
    id: `saga-event:${candidate.id}`,
    sourceOpportunityId: candidate.localCandidateId,
    type,
    editorialSlot: editorialSlotForType(type),
    title: `${display(subject)}: ${candidate.title}`,
    editorialTitle: language.editorialTitle,
    narrationPreview: language.narrationPreview,
    retentionPromise: language.retentionPromise,
    languageQualityScore: language.languageQualityScore,
    specificHook: language.specificHook,
    keyDialogueLine: specificity.keyDialogueLine,
    keyActionLabel: specificity.keyActionLabel,
    visualSpecificityScore: specificity.visualSpecificityScore,
    duplicateGroupId: "",
    duplicateOfEventId: null,
    duplicateReason: null,
    uniquenessScore: 100,
    subject,
    action: verbForType(type),
    object,
    consequence: consequenceForType(type, subject, object),
    curiosityHook: curiosityHookForType(type, subject, object),
    storyHook: storyHookForType(type, subject, object),
    shortAngle: type === "curiosity_fact" || type === "comic_absurdity" || type === "reveal"
      ? curiosityHookForType(type, subject, object)
      : storyHookForType(type, subject, object),
    pages: unique(candidate.pages).sort((left, right) => left - right),
    panelIds: sortedPanelIds,
    characters: candidate.characters,
    themes: candidate.themes,
    evidence,
    beats,
    zoomPlan: beats.map((beat, index) => ({
      panelId: beat.panelId,
      pageNumber: beat.pageNumber,
      focus: index === 0 ? "full_context" : index === beats.length - 1 ? "reaction" : type === "battle_beat" ? "impact" : type === "curiosity_fact" ? "detail" : "balloon",
      instruction: beat.zoomInstruction
    })),
    estimatedDurationSeconds: Math.max(30, candidate.estimatedDurationSeconds, beats.length * 6),
    score,
    readiness,
    reasons: unique([...candidate.reasons, `event_type:${type}`, `page_range:${pageStart}-${pageEnd}`]),
    warnings,
    issueId: candidate.issueId,
    issueNumber: candidate.issueNumber,
    issueTitle: candidate.issueTitle,
    sagaShortCandidateId: candidate.id
  };
}

export function mineComicSagaEventOpportunities(input: {
  sagaMap: ComicSagaNarrativeMap;
}): ComicSagaEventOpportunityReport {
  const rankedRaw = input.sagaMap.recommendedShorts
    .map(sagaCandidateToEvent)
    .sort((left, right) => scoreSagaEvent(right) - scoreSagaEvent(left) || left.issueNumber - right.issueNumber);
  const ranked = annotateEventDuplicates(rankedRaw);
  const diversityPlan = buildDiversityPlan(ranked, 30);
  const recommended = diversityPlan.selections
    .map((selection) => ranked.find((event) => event.id === selection.eventId))
    .filter((event): event is ComicSagaEventOpportunity => Boolean(event));
  const episodePlan = recommended.slice(0, 20).map((event, index) => ({
    order: index + 1,
    eventId: event.id,
    title: event.title,
    editorialTitle: event.editorialTitle,
    issueNumber: event.issueNumber,
    pages: event.pages,
    shortAngle: event.shortAngle,
    estimatedDurationSeconds: event.estimatedDurationSeconds,
    whyThisOrder: index === 0
      ? "Abrir pela oportunidade mais forte de retencao."
      : event.issueNumber === recommended[index - 1]?.issueNumber
        ? "Continua na mesma edicao sem quebrar a cronologia local."
        : "Avanca para outro ponto forte da saga mantendo variedade."
  }));
  const gaps: string[] = [];
  if (recommended.length === 0) gaps.push("no_recommended_event_shorts");
  if (ranked.some((event) => event.warnings.includes("event_has_few_panels_for_dynamic_short"))) gaps.push("some_events_need_more_panels_for_dynamic_30s");
  if (ranked.some((event) => event.warnings.includes("candidate_needs_more_context"))) gaps.push("some_events_need_more_story_context");
  return {
    extractorId: "comic_saga_event_opportunity_miner_v1",
    generatedAt: new Date().toISOString(),
    sagaTitle: input.sagaMap.sagaOverview.title,
    issueCount: input.sagaMap.sagaOverview.issueCount,
    eventCount: ranked.length,
    readyEventCount: ranked.filter((event) => event.readiness === "ready_for_short").length,
    curiosityEventCount: ranked.filter((event) => ["curiosity_fact", "comic_absurdity", "reveal", "lore_context"].includes(event.type)).length,
    storyEventCount: ranked.filter((event) => ["battle_beat", "turning_point", "relationship_twist", "visual_spectacle"].includes(event.type)).length,
    events: ranked,
    recommendedShorts: recommended,
    diversityPlan,
    episodePlan,
    whatSystemUnderstandsNow: {
      storyProgression: `O sistema organizou ${ranked.length} eventos em ${input.sagaMap.sagaOverview.issueCount} edicoes e pode seguir em ordem por edicao/pagina quando o objetivo for explicar a historia.`,
      curiosityMining: `Ele separou ${ranked.filter((event) => ["curiosity_fact", "comic_absurdity", "reveal", "lore_context"].includes(event.type)).length} eventos de curiosidade/revelacao para shorts no estilo fato curioso.`,
      visualEditingPlan: "Cada evento carrega beats, paineis e zoomPlan para alternar contexto, balao, impacto, rosto/reacao e payoff visual.",
      readiness: recommended.length >= 10 && gaps.length <= 1 ? "high" : recommended.length > 0 ? "medium" : "low",
      remainingGaps: gaps
    },
    candidateFirst: true,
    requiresManualApproval: true
  };
}