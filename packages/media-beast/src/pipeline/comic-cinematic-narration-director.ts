export type ComicCinematicNarrationRole = "cold_open" | "setup" | "escalation" | "reversal" | "climax" | "resolution";

export type ComicCinematicNarrationBeatInput = {
  beatId: string;
  role: ComicCinematicNarrationRole;
  literalFact: string;
  cinematicLine?: string;
  characterIntent?: string;
  hiddenInformation?: string;
  stakes?: string;
  reveal?: string;
  sourcePages: number[];
};

export type ComicCinematicNarrationBeat = ComicCinematicNarrationBeatInput & {
  narrationLine: string;
  dramaticQuestion: string;
  retentionDevice: "open_loop" | "dramatic_irony" | "escalating_stakes" | "reveal" | "payoff";
  nextBeatBridge: string;
  evidenceLocked: true;
};

export type ComicCinematicNarrationPlan = {
  directorId: "comic_cinematic_narration_director_v1";
  beats: ComicCinematicNarrationBeat[];
  totalWords: number;
  descriptiveLanguageViolations: string[];
  unsupportedClaimWarnings: string[];
  passed: boolean;
};

const DESCRIPTIVE_META = /\b(?:na hq|nesta pagina|nesse painel|a cena mostra|vemos|podemos ver|em seguida|depois disso)\b/i;

function clean(value: string | undefined) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function dramaticQuestion(input: ComicCinematicNarrationBeatInput) {
  if (input.role === "cold_open") return "Que plano colocou dois mundos em rota de colisao?";
  if (input.role === "climax") return `O que ainda pode impedir ${clean(input.stakes) || "a derrota"}?`;
  if (input.role === "resolution") return "Qual foi o preco de sobreviver?";
  if (input.hiddenInformation) return `Quando os outros vao perceber que ${clean(input.hiddenInformation)}?`;
  return `Como ${clean(input.stakes) || "esse conflito"} pode ficar ainda pior?`;
}

function retentionDevice(role: ComicCinematicNarrationRole, input: ComicCinematicNarrationBeatInput) {
  if (role === "cold_open") return "open_loop" as const;
  if (role === "reversal") return "reveal" as const;
  if (role === "climax") return "escalating_stakes" as const;
  if (role === "resolution") return "payoff" as const;
  return input.hiddenInformation ? "dramatic_irony" as const : "escalating_stakes" as const;
}

const PT_BR_ORTHOGRAPHY: Array<[RegExp, string]> = [
  [/\bnao\b/gi, "não"], [/\bja\b/gi, "já"], [/\bviloes\b/gi, "vilões"], [/\bherois\b/gi, "heróis"],
  [/\bcolisao\b/gi, "colisão"], [/\bdistracao\b/gi, "distração"], [/\bavancava\b/gi, "avançava"],
  [/\bninguem\b/gi, "ninguém"], [/\bespaco\b/gi, "espaço"], [/\blancou\b/gi, "lançou"],
  [/\bTitas\b/g, "Titãs"], [/\btitas\b/g, "titãs"], [/\bmaos\b/gi, "mãos"], [/\bameaca\b/gi, "ameaça"],
  [/\batomico\b/gi, "atômico"], [/\bMetropolis\b/g, "Metrópolis"], [/\bmetropolis\b/g, "metrópolis"],
  [/\bunico\b/gi, "único"], [/\bceu\b/gi, "céu"], [/\bfuria\b/gi, "fúria"], [/\bavancando\b/gi, "avançando"],
  [/\bdestruida\b/gi, "destruída"], [/\bAcuados\b/g, "Acuados"], [/\bsuperficie\b/gi, "superfície"],
  [/\btentaculos\b/gi, "tentáculos"], [/\bmecanica\b/gi, "mecânica"], [/\bultima\b/gi, "última"],
  [/\bmissao\b/gi, "missão"], [/\bsaida\b/gi, "saída"], [/\bcomecaram\b/gi, "começaram"],
  [/\bsilencio\b/gi, "silêncio"], [/\bLois\b/g, "Loís"], [/\bEntao\b/g, "Então"], [/\bentao\b/g, "então"],
  [/\bpreco\b/gi, "preço"], [/\bhistorias\b/gi, "histórias"], [/\bconsequencia\b/gi, "consequência"],
];

export function normalizeComicNarrationPtBr(value: string) {
  return PT_BR_ORTHOGRAPHY
    .reduce((text, [pattern, replacement]) => text.replace(pattern, replacement), value)
    .replace(/\bforcas?\b/gi, (word) => {
      const plural = word.toLowerCase().endsWith("s");
      const normalized = plural ? "forças" : "força";
      return word === word.toUpperCase() ? normalized.toUpperCase() : word[0] === "F" ? `F${normalized.slice(1)}` : normalized;
    })
    .replaceAll("Loís", "Lois")
    .replace(/\bGodzila\b/g, "Godzilla");
}

function fallbackNarration(input: ComicCinematicNarrationBeatInput) {
  const fact = clean(input.literalFact).replace(DESCRIPTIVE_META, "");
  const intent = clean(input.characterIntent);
  const hidden = clean(input.hiddenInformation);
  const stakes = clean(input.stakes);
  if (hidden && intent) return `${fact} Mas ${intent}, porque ${hidden}.`;
  if (hidden) return `${fact} O problema era o que ninguem ainda havia percebido: ${hidden}.`;
  if (intent) return `${fact} E havia uma razao para isso: ${intent}.`;
  if (stakes) return `${fact} A partir dali, ${stakes}.`;
  return fact;
}

export function buildComicCinematicNarrationPlan(input: { beats: ComicCinematicNarrationBeatInput[] }): ComicCinematicNarrationPlan {
  const descriptiveLanguageViolations: string[] = [];
  const unsupportedClaimWarnings: string[] = [];
  const beats = input.beats.map((beat, index) => {
    const narrationLine = normalizeComicNarrationPtBr(clean(beat.cinematicLine) || fallbackNarration(beat));
    if (DESCRIPTIVE_META.test(narrationLine)) descriptiveLanguageViolations.push(beat.beatId);
    if (!clean(beat.literalFact)) unsupportedClaimWarnings.push(`${beat.beatId}:missing_literal_fact`);
    return {
      ...beat,
      narrationLine,
      dramaticQuestion: dramaticQuestion(beat),
      retentionDevice: retentionDevice(beat.role, beat),
      nextBeatBridge: index === input.beats.length - 1
        ? "A historia fecha o conflito sem encerrar o interesse pelo universo."
        : `A resposta avanca para ${input.beats[index + 1]?.beatId}.`,
      evidenceLocked: true as const,
    };
  });
  return {
    directorId: "comic_cinematic_narration_director_v1",
    beats,
    totalWords: beats.reduce((sum, beat) => sum + beat.narrationLine.split(/\s+/).filter(Boolean).length, 0),
    descriptiveLanguageViolations,
    unsupportedClaimWarnings,
    passed: beats.length > 0 && descriptiveLanguageViolations.length === 0 && unsupportedClaimWarnings.length === 0,
  };
}
