import type { LocalComicPanelEvidence, LocalComicPanelIndex, LocalPanelCropBounds } from "./comics-local-panel-index.js";
import { flattenPanelIndex } from "./comics-panel-retrieval.js";

export type ComicNarrationPanelBeatInput = {
  beatId: string;
  eventId?: string;
  order?: number;
  issueNumber?: number;
  narrationText: string;
  captionText?: string;
  sourcePages?: number[];
  visualTargets?: string[];
  emotion?: string;
};

export type ComicNarrationPanelIssueIndex = {
  issueNumber?: number;
  assetDirectory?: string;
  index: LocalComicPanelIndex;
};

export type ComicNarrationPanelMatch = {
  beatId: string;
  eventId: string | null;
  order: number;
  narrationText: string;
  selectedPanelId: string | null;
  selectedPanelImagePath: string | null;
  sourcePagePath: string | null;
  issueNumber: number | null;
  pageNumber: number | null;
  panelNumber: number | null;
  readingOrder: number | null;
  normalizedCrop: LocalPanelCropBounds | null;
  score: number;
  confidence: "high" | "medium" | "low" | "missing";
  reasons: string[];
  warnings: string[];
  zoomInstruction: {
    mode: "dialogue_focus" | "action_focus" | "reaction_focus" | "object_focus" | "wide_context";
    holdSeconds: number;
    avoidCuttingDialogue: boolean;
    keepFullActionVisible: boolean;
    preferredMotion: "slow_push" | "panel_pan" | "impact_punch_in" | "steady_hold";
  };
  alternatives: Array<{
    panelId: string;
    panelImagePath: string;
    pageNumber: number;
    panelNumber: number;
    score: number;
    reasons: string[];
  }>;
};

export type ComicNarrationPanelMatchPlan = {
  matcherId: "comic_narration_panel_matcher_v1";
  generatedAt: string;
  beatCount: number;
  matchedCount: number;
  highConfidenceCount: number;
  repeatedPanelCount: number;
  averageScore: number;
  matches: ComicNarrationPanelMatch[];
  warnings: string[];
};

type CandidatePanel = {
  issueNumber: number | null;
  panel: LocalComicPanelEvidence;
};

const STOP_WORDS = new Set([
  "a", "o", "as", "os", "um", "uma", "de", "do", "da", "dos", "das", "e", "em", "no", "na", "nos", "nas",
  "para", "por", "com", "sem", "que", "isso", "esse", "essa", "aquele", "aquela", "ele", "ela", "eles", "elas",
  "quando", "enquanto", "antes", "depois", "mas", "porque", "como", "ali", "aqui", "tudo", "todos", "toda", "todo"
]);

const ENTITY_ALIASES: Record<string, string[]> = {
  batman: ["batman", "bétman", "bruce", "morcego", "cavaleiro das trevas"],
  superman: ["superman", "super-homem", "clark", "kal-el"],
  godzilla: ["godzilla", "gojira"],
  kong: ["kong"],
  mutano: ["mutano", "garfield", "beast boy", "gorila"],
  "caixa materna": ["caixa materna", "mother box", "caixa"],
  lex: ["lex", "luthor", "lex luthor"],
  lois: ["lois", "lois lane", "sra lane"],
  coringa: ["coringa", "joker", "jack napier", "napier"],
  gotham: ["gotham"],
  portal: ["portal", "fenda", "abriu", "teletransporte"]
};

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

function tokensFrom(text: string): string[] {
  return unique(normalizeText(text).split(" ").filter((token) => token.length >= 3 && !STOP_WORDS.has(token)));
}

function detectIntent(text: string, visualTargets: string[] = []) {
  const combined = normalizeText(`${text} ${visualTargets.join(" ")}`);
  const targets = Object.entries(ENTITY_ALIASES)
    .filter(([, aliases]) => aliases.some((alias) => combined.includes(normalizeText(alias))))
    .flatMap(([canonical, aliases]) => [canonical, ...aliases]);
  const actionWords = ["soco", "golpe", "luta", "ataca", "batalha", "explode", "corrida", "portal", "fuga", "roubou", "invadiu", "capturou", "transformou", "caiu", "surge"];
  const dialogueWords = ["fala", "disse", "pergunta", "responde", "conversa", "explica", "balão", "balao"];
  const objectWords = ["caixa", "arma", "portal", "anel", "remédio", "remedio", "pílula", "pilula"];
  const isDialogue = dialogueWords.some((word) => combined.includes(word));
  const isAction = actionWords.some((word) => combined.includes(word));
  const isObject = objectWords.some((word) => combined.includes(word));
  return {
    tokens: unique([...tokensFrom(text), ...visualTargets.flatMap(tokensFrom)]),
    targets: unique([...targets, ...visualTargets]),
    wantsDialogue: isDialogue || /\?/.test(text),
    wantsAction: isAction,
    wantsObject: isObject,
    wantsReaction: /reac|assust|medo|surpres|olhar|percebeu|entendeu/.test(combined)
  };
}

function panelText(panel: LocalComicPanelEvidence): string {
  const evidence = panel.localEvidence;
  return normalizeText([
    ...evidence.characters.map((entry) => entry.name),
    ...evidence.actions.map((entry) => entry.label),
    ...evidence.relationships.flatMap((entry) => [entry.type, ...entry.entities]),
    ...evidence.detectedText,
    ...evidence.dialogue,
    ...evidence.narrationBoxes,
    ...evidence.soundEffects,
    ...evidence.visualThemes,
    ...evidence.objects,
    ...evidence.locations,
    ...panel.parentContext.parentTags,
    panel.storyFunction
  ].join(" "));
}

function scorePanel(input: {
  beat: ComicNarrationPanelBeatInput;
  candidate: CandidatePanel;
  previousPage: number | null;
  usedPanelIds: Set<string>;
}) {
  const { beat, candidate, previousPage, usedPanelIds } = input;
  const panel = candidate.panel;
  const intent = detectIntent(`${beat.narrationText} ${beat.captionText ?? ""}`, beat.visualTargets ?? []);
  const text = panelText(panel);
  const reasons: string[] = [];
  const warnings: string[] = [];
  let score = 0;

  if (!panel.valid || panel.evidenceTier === "rejected") {
    score -= 80;
    warnings.push(panel.rejectReason ?? "painel rejeitado pelo indice local");
  }

  if (beat.issueNumber !== undefined && candidate.issueNumber !== null) {
    if (beat.issueNumber === candidate.issueNumber) {
      score += 10;
      reasons.push("mesma edição do beat");
    } else {
      score -= 14;
      warnings.push("painel de outra edição");
    }
  }

  const sourcePages = beat.sourcePages ?? [];
  if (sourcePages.length > 0) {
    const exact = sourcePages.includes(panel.pageNumber);
    const distance = Math.min(...sourcePages.map((page) => Math.abs(page - panel.pageNumber)));
    if (exact) {
      score += 30;
      reasons.push("mesma página da narração");
    } else if (distance <= 2) {
      score += 12 - distance * 3;
      reasons.push(`perto da página citada (${distance})`);
    } else {
      score -= Math.min(18, distance);
    }
  }

  if (previousPage !== null) {
    if (panel.pageNumber >= previousPage) {
      score += 6;
      reasons.push("mantém progressão para frente");
    } else {
      score -= 28;
      warnings.push("quebra progressão: volta página");
    }
  }

  let tokenHits = 0;
  for (const token of intent.tokens) {
    if (text.includes(normalizeText(token))) tokenHits += 1;
  }
  if (tokenHits > 0) {
    score += Math.min(28, tokenHits * 5);
    reasons.push(`${tokenHits} termo(s) da narração encontrados no painel`);
  }

  let targetHits = 0;
  for (const target of intent.targets) {
    const normalized = normalizeText(target);
    if (normalized.length >= 3 && text.includes(normalized)) targetHits += 1;
  }
  if (targetHits > 0) {
    score += Math.min(34, targetHits * 9);
    reasons.push(`${targetHits} alvo(s) visual(is) confirmados`);
  } else if (intent.targets.length > 0) {
    score -= 18;
    warnings.push(`alvo visual não confirmado: ${unique(intent.targets).slice(0, 3).join(", ")}`);
  }

  if (intent.wantsDialogue) {
    const hasDialogue = panel.localEvidence.dialogue.length > 0 || panel.localEvidence.detectedText.length > 0;
    score += hasDialogue ? 14 : -10;
    reasons.push(hasDialogue ? "tem balão/texto para fala" : "sem balão claro para fala");
  }

  if (intent.wantsAction) {
    const actionFit = panel.storyFunction === "action" || panel.storyFunction === "climax" || panel.localEvidence.actions.length > 0 || panel.localEvidence.soundEffects.length > 0;
    score += actionFit ? 16 : -12;
    reasons.push(actionFit ? "ação/impacto detectado" : "pouca ação para este beat");
  }

  if (intent.wantsObject) {
    const objectFit = panel.storyFunction === "reveal" || panel.localEvidence.objects.length > 0 || /caixa|portal|arma|anel|remedio|pilula/.test(text);
    score += objectFit ? 14 : -10;
    reasons.push(objectFit ? "objeto/revelação detectado" : "objeto citado não aparece com clareza");
  }

  if (intent.wantsReaction) {
    const reactionFit = panel.storyFunction === "reaction" || /olho|rosto|express|assust|surpres/.test(text);
    score += reactionFit ? 10 : -4;
  }

  score += Math.round((panel.quality.visualQualityScore ?? 0) * 0.18);
  score += Math.round((panel.quality.cropability916Score ?? 0) * 0.16);
  score -= Math.round((panel.quality.textHeavyRatio ?? 0) * 10);

  if (panel.isWholePageFallback) {
    score -= 8;
    warnings.push("usa página inteira como fallback; revisar crop");
  }
  if (usedPanelIds.has(panel.panelId)) {
    score -= 35;
    warnings.push("painel já usado neste episódio");
  }

  return { score: Math.max(0, Math.min(100, Math.round(score))), reasons, warnings };
}

function zoomInstructionFor(panel: LocalComicPanelEvidence | null, beat: ComicNarrationPanelBeatInput): ComicNarrationPanelMatch["zoomInstruction"] {
  const intent = detectIntent(`${beat.narrationText} ${beat.captionText ?? ""}`, beat.visualTargets ?? []);
  if (!panel) {
    return { mode: "wide_context", holdSeconds: 2.4, avoidCuttingDialogue: true, keepFullActionVisible: true, preferredMotion: "steady_hold" };
  }
  if (intent.wantsAction || panel.storyFunction === "action" || panel.storyFunction === "climax" || panel.storyFunction === "transformation") {
    return { mode: "action_focus", holdSeconds: 2.6, avoidCuttingDialogue: false, keepFullActionVisible: true, preferredMotion: "impact_punch_in" };
  }
  if (intent.wantsDialogue || panel.localEvidence.dialogue.length > 0) {
    return { mode: "dialogue_focus", holdSeconds: 3.0, avoidCuttingDialogue: true, keepFullActionVisible: false, preferredMotion: "panel_pan" };
  }
  if (intent.wantsObject || panel.storyFunction === "reveal") {
    return { mode: "object_focus", holdSeconds: 2.8, avoidCuttingDialogue: true, keepFullActionVisible: true, preferredMotion: "slow_push" };
  }
  if (intent.wantsReaction || panel.storyFunction === "reaction") {
    return { mode: "reaction_focus", holdSeconds: 2.4, avoidCuttingDialogue: true, keepFullActionVisible: false, preferredMotion: "slow_push" };
  }
  return { mode: "wide_context", holdSeconds: 2.5, avoidCuttingDialogue: true, keepFullActionVisible: true, preferredMotion: "panel_pan" };
}

function confidenceFor(score: number): ComicNarrationPanelMatch["confidence"] {
  if (score >= 72) return "high";
  if (score >= 52) return "medium";
  if (score > 0) return "low";
  return "missing";
}

export function buildComicNarrationPanelMatchPlan(input: {
  beats: ComicNarrationPanelBeatInput[];
  issueIndexes: ComicNarrationPanelIssueIndex[];
  maxAlternatives?: number;
}): ComicNarrationPanelMatchPlan {
  const maxAlternatives = input.maxAlternatives ?? 4;
  const candidates: CandidatePanel[] = input.issueIndexes.flatMap((issue) =>
    flattenPanelIndex(issue.index).map((panel) => ({
      issueNumber: issue.issueNumber ?? null,
      panel
    }))
  );
  const warnings: string[] = [];
  const usedPanelIds = new Set<string>();
  let previousPage: number | null = null;

  const matches = input.beats.map((beat, index) => {
    const ranked = candidates
      .map((candidate) => ({ candidate, ...scorePanel({ beat, candidate, previousPage, usedPanelIds }) }))
      .sort((left, right) => right.score - left.score || left.candidate.panel.pageNumber - right.candidate.panel.pageNumber || left.candidate.panel.readingOrder - right.candidate.panel.readingOrder);

    const best = ranked[0];
    const selected = best && best.score >= 32 ? best.candidate.panel : null;
    if (selected) {
      usedPanelIds.add(selected.panelId);
      previousPage = selected.pageNumber;
    } else {
      warnings.push(`Sem painel confiável para beat ${beat.beatId}.`);
    }

    const alternatives = ranked
      .filter((entry) => !selected || entry.candidate.panel.panelId !== selected.panelId)
      .slice(0, maxAlternatives)
      .map((entry) => ({
        panelId: entry.candidate.panel.panelId,
        panelImagePath: entry.candidate.panel.panelImagePath,
        pageNumber: entry.candidate.panel.pageNumber,
        panelNumber: entry.candidate.panel.panelNumber,
        score: entry.score,
        reasons: entry.reasons.slice(0, 4)
      }));

    const selectedScore = selected && best ? best.score : 0;
    const selectedReasons = selected && best ? best.reasons.slice(0, 8) : [];

    const selectedWarnings = selected && best ? best.warnings : ["Nenhum painel local bateu com a narracao."];

    return {
      beatId: beat.beatId,
      eventId: beat.eventId ?? null,
      order: beat.order ?? index + 1,
      narrationText: beat.narrationText,
      selectedPanelId: selected?.panelId ?? null,
      selectedPanelImagePath: selected?.panelImagePath ?? null,
      sourcePagePath: selected?.sourcePagePath ?? null,
      issueNumber: best?.candidate.issueNumber ?? null,
      pageNumber: selected?.pageNumber ?? null,
      panelNumber: selected?.panelNumber ?? null,
      readingOrder: selected?.readingOrder ?? null,
      normalizedCrop: selected?.cropBounds ?? null,
      score: selectedScore,
      confidence: selected ? confidenceFor(selectedScore) : "missing",
      reasons: selectedReasons,
      warnings: selectedWarnings,
      zoomInstruction: zoomInstructionFor(selected, beat),
      alternatives
    } satisfies ComicNarrationPanelMatch;
  });

  const usedCounts = new Map<string, number>();
  for (const match of matches) {
    if (!match.selectedPanelId) continue;
    usedCounts.set(match.selectedPanelId, (usedCounts.get(match.selectedPanelId) ?? 0) + 1);
  }
  const repeatedPanelCount = [...usedCounts.values()].filter((count) => count > 1).length;
  if (repeatedPanelCount > 0) warnings.push(`${repeatedPanelCount} painel(is) repetido(s) no plano visual.`);

  const scored = matches.filter((match) => match.score > 0);
  return {
    matcherId: "comic_narration_panel_matcher_v1",
    generatedAt: new Date().toISOString(),
    beatCount: input.beats.length,
    matchedCount: matches.filter((match) => Boolean(match.selectedPanelId)).length,
    highConfidenceCount: matches.filter((match) => match.confidence === "high").length,
    repeatedPanelCount,
    averageScore: scored.length ? Math.round(scored.reduce((sum, match) => sum + match.score, 0) / scored.length) : 0,
    matches,
    warnings
  };
}
