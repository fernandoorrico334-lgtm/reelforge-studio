import {
  humanizeOralPtBr,
  linesTooSimilar,
  optimizeForSpokenDelivery,
  polishPtBrNarration,
  shortenForSpeech
} from "./narration-curiosity-engine.js";
import {
  GLOBAL_FORBIDDEN_CLICHES,
  getNarrationStylePack,
  NARRATION_STYLE_PACKS,
  RETENTION_BEAT_TIMINGS,
  VARIANT_ANGLE_ORDER,
  type NarrationRetentionSubject,
  type NarrationStylePack,
  type NarrationVariantAngle,
  type RetentionBeatRole
} from "./narration-retention-packs.js";

export type {
  NarrationRetentionSubject,
  NarrationStylePack,
  NarrationVariantAngle,
  RetentionBeatRole
} from "./narration-retention-packs.js";

export {
  GLOBAL_FORBIDDEN_CLICHES,
  NARRATION_STYLE_PACKS,
  RETENTION_BEAT_TIMINGS,
  VARIANT_ANGLE_ORDER,
  getNarrationStylePack
} from "./narration-retention-packs.js";

export interface NarrationRetentionInput {
  subject: string;
  headline?: string;
  summary?: string;
  entities?: string[];
  curiosityFact?: string;
  primaryAction?: string;
  visualHints?: string[];
  targetDurationSeconds?: number;
  subjectCategory?: NarrationRetentionSubject;
  seed?: string;
}

export interface RetentionBeatMetadata {
  role: RetentionBeatRole;
  text: string;
  emotion: string;
  pace: "slow" | "medium" | "fast";
  pauseAfterMs: number;
  emphasisWords: string[];
  captionWords: string[];
  visualCue: string;
  retentionGoal: string;
  timing: { startSec: number; endSec: number };
}

export interface NarrationRetentionScoreBreakdown {
  hookStrength: number;
  oralPtBr: number;
  clarity: number;
  curiosity: number;
  rhythm: number;
  clicheFree: number;
  differentiation: number;
  visualSync: number;
  loopClosing: number;
}

export interface NarrationRetentionScore {
  total: number;
  breakdown: NarrationRetentionScoreBreakdown;
  recommendations: string[];
  forbiddenPhrasesFound: string[];
}

export interface NarrationRetentionVariant {
  angle: NarrationVariantAngle;
  script: string;
  beats: RetentionBeatMetadata[];
  score: NarrationRetentionScore;
  voiceMetadata: {
    energyLevel: NarrationStylePack["energyLevel"];
    narrativeTone: string;
    idealPace: NarrationStylePack["idealPace"];
    curiosityType: string;
  };
}

export interface NarrationRetentionReport {
  subjectCategory: NarrationRetentionSubject;
  stylePack: NarrationStylePack;
  variants: NarrationRetentionVariant[];
  overlapMatrix: number[][];
  recommendations: string[];
  generatedAt: string;
}

const SCORE_THRESHOLD = 82;
const MAX_REWRITE_ATTEMPTS = 4;

const SUBJECT_KEYWORDS: Record<NarrationRetentionSubject, RegExp[]> = {
  comics_anime_filmes: [
    /\b(hq|quadrinhos?|marvel|dc|venom|spider|aranha|batman|anime|mang[aá]|simbionte|filme|cinema|her[oó]i)\b/i
  ],
  tecnologia_ia: [
    /\b(ia|intelig[eê]ncia artificial|chatgpt|openai|app|software|chip|algoritmo|tecnologia|digital|robot)\b/i
  ],
  historia_curiosidades: [
    /\b(hist[oó]ri[ao]|s[eé]culo|imp[eé]rio|guerra|curiosidade|fato|antig|arqueolog|descoberta|museu|[eé]poca|bol[ií]var|morte de)\b/i
  ],
  juridico_bancario: [
    /\b(banco|juros|cart[aã]o|cr[eé]dito|d[eé]bito|lei|direito|contrato|cl[aá]usula|processo|consumidor|financeir)\b/i
  ],
  produto_review: [
    /\b(produto|review|teste|shampoo|condicionador|cabelo|beleza|skincare|creme|compra|unboxing)\b/i
  ],
  noticia_polemica: [
    /\b(not[ií]cia|pol[eê]mica|esc[aâ]ndalo|debate|manchete|den[uú]ncia|controv[eé]rsia)\b/i
  ],
  misterio_terror: [
    /\b(mist[eé]rio|terror|horror|assombra|fantasma|crime|investiga|desaparec|sombrio|assust)\b/i
  ],
  generico: []
};

const ANGLE_EMOTIONS: Record<NarrationVariantAngle, string> = {
  factual_documental: "documental, seguro",
  fan_lore: "entusiasta, íntimo",
  suspense_reveal: "suspenso, contido",
  simple_explanatory: "didático, calmo",
  controlled_controversy: "imparcial, tenso",
  quick_curiosity: "rápido, intrigante"
};

const ANGLE_PACE: Record<NarrationVariantAngle, "slow" | "medium" | "fast"> = {
  factual_documental: "medium",
  fan_lore: "fast",
  suspense_reveal: "slow",
  simple_explanatory: "medium",
  controlled_controversy: "medium",
  quick_curiosity: "fast"
};

const CLICHE_REPLACEMENTS: Array<[RegExp, string]> = [
  [/voc[eê] n[aã]o vai acreditar/gi, "presta atenção nisso"],
  [/ningu[eé]m percebeu/gi, "quase ninguém reparou"],
  [/\bsimplesmente\b/gi, ""],
  [/\binsano\b/gi, "forte"],
  [/\babsurdo\b/gi, "impressionante"],
  [/\bgalera\b/gi, ""],
  [/\bmano\b/gi, ""],
  [/\bframe\b/gi, "cena"],
  [/\bbeat\b/gi, "momento"],
  [/escolha narrativa/gi, "intenção na história"],
  [/inspira esse frame/gi, "aparece nos quadrinhos"],
  [/paga uma d[ií]vida com os f[aã]s/gi, "é referência direta pros fãs"]
];

function pickVariant<T>(variants: T[], seed: string, salt: string): T {
  if (variants.length === 0) {
    throw new Error("Expected at least one narration variant.");
  }
  let acc = 0;
  for (const char of `${seed}:${salt}`) {
    acc = (acc + char.charCodeAt(0) * 19) % variants.length;
  }
  return variants[acc] ?? variants[0]!;
}

function normalizeText(text: string): string {
  return polishPtBrNarration(
    humanizeOralPtBr(optimizeForSpokenDelivery(text))
  );
}

function extractEmphasisWords(text: string): string[] {
  const tokens = text.split(/\s+/).filter(Boolean);
  const emphasis = new Set<string>();
  for (const token of tokens) {
    const cleaned = token.replace(/[^a-zA-ZÀ-ÿ0-9]/g, "");
    if (!cleaned) continue;
    if (/\d/.test(cleaned) || (/^[A-ZÀ-Ý]/.test(token) && cleaned.length > 2)) {
      emphasis.add(cleaned);
    }
  }
  return [...emphasis].slice(0, 4);
}

function extractCaptionWords(text: string): string[] {
  return text
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 7)
    .map((word) => word.replace(/[,.!?;:]/g, ""));
}

function resolveLead(input: NarrationRetentionInput): string {
  return input.entities?.[0] ?? input.subject.trim();
}

function resolveSecondary(input: NarrationRetentionInput): string | null {
  return input.entities?.[1] ?? null;
}

function resolveCuriosity(input: NarrationRetentionInput, pack: NarrationStylePack): string {
  if (input.curiosityFact?.trim()) {
    return normalizeText(input.curiosityFact);
  }
  const lead = resolveLead(input);
  const fallbacks: Record<NarrationRetentionSubject, string> = {
    comics_anime_filmes: `Nos quadrinhos, ${lead} carrega uma história que o clipe só sugere.`,
    tecnologia_ia: `O ganho real está no detalhe técnico — não no discurso de marketing.`,
    historia_curiosidades: `O registro da época guarda um detalhe que muda a leitura inteira.`,
    juridico_bancario: `A lei prevê proteção aqui — mas só funciona se você souber o prazo.`,
    produto_review: `O resultado depende do uso correto — e quase ninguém lê a instrução.`,
    noticia_polemica: `O fato central ficou atrás da manchete — e isso muda o julgamento.`,
    misterio_terror: `Um detalhe pequeno não fecha — e é aí que o caso vira outro.`,
    generico: `O detalhe que explica por que esse assunto prende tanta gente.`
  };
  return normalizeText(fallbacks[pack.subject]);
}

function resolveVisualCue(
  role: RetentionBeatRole,
  input: NarrationRetentionInput,
  pack: NarrationStylePack
): string {
  const hint = input.visualHints?.[0] ?? resolveLead(input);
  const byRole: Record<RetentionBeatRole, string> = {
    hook: `Close no elemento visual de ${hint} nos primeiros 2s`,
    promise_context: `Plano médio com texto de apoio sobre ${pack.label.toLowerCase()}`,
    curiosity: `Corte rápido ou zoom no detalhe de ${hint}`,
    development: `B-roll temático alinhado a ${pack.curiosityType}`,
    climax_reveal: `Revelação visual sincronizada com o dado central`,
    loop_closing: `Retorno visual ao gancho inicial para fechar loop`
  };
  return byRole[role];
}

function resolvePauseAfterMs(role: RetentionBeatRole, pace: "slow" | "medium" | "fast"): number {
  const base: Record<RetentionBeatRole, number> = {
    hook: 120,
    promise_context: 220,
    curiosity: 280,
    development: 240,
    climax_reveal: 360,
    loop_closing: 180
  };
  const paceFactor = pace === "slow" ? 1.35 : pace === "fast" ? 0.75 : 1;
  return Math.round(base[role] * paceFactor);
}

export function classifyNarrationSubject(input: NarrationRetentionInput): NarrationRetentionSubject {
  if (input.subjectCategory) {
    return input.subjectCategory;
  }

  const corpus = [
    input.subject,
    input.headline ?? "",
    input.summary ?? "",
    ...(input.entities ?? []),
    input.primaryAction ?? ""
  ]
    .join(" ")
    .toLowerCase();

  let best: NarrationRetentionSubject = "generico";
  let bestScore = 0;

  for (const [subject, patterns] of Object.entries(SUBJECT_KEYWORDS) as Array<
    [NarrationRetentionSubject, RegExp[]]
  >) {
    if (subject === "generico") continue;
    const score = patterns.reduce(
      (acc, pattern) => acc + (pattern.test(corpus) ? 1 : 0),
      0
    );
    if (score > bestScore) {
      bestScore = score;
      best = subject;
    }
  }

  return bestScore > 0 ? best : "generico";
}

export function findForbiddenPhrases(
  text: string,
  pack?: NarrationStylePack
): string[] {
  const forbidden = new Set([
    ...GLOBAL_FORBIDDEN_CLICHES,
    ...(pack?.forbiddenPhrases ?? [])
  ]);
  const lower = text.toLowerCase();
  return [...forbidden].filter((phrase) => lower.includes(phrase.toLowerCase()));
}

export function applyAntiClicheFilter(text: string, pack?: NarrationStylePack): string {
  let filtered = text;
  for (const [pattern, replacement] of CLICHE_REPLACEMENTS) {
    filtered = filtered.replace(pattern, replacement);
  }

  const forbidden = findForbiddenPhrases(filtered, pack);
  for (const phrase of forbidden) {
    const pattern = new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
    filtered = filtered.replace(pattern, "");
  }

  return normalizeText(
    filtered
      .replace(/\s{2,}/g, " ")
      .replace(/\s+([,.!?])/g, "$1")
      .replace(/^\s*,\s*/g, "")
      .trim()
  );
}

function buildBeatText(
  role: RetentionBeatRole,
  angle: NarrationVariantAngle,
  input: NarrationRetentionInput,
  pack: NarrationStylePack
): string {
  const lead = resolveLead(input);
  const secondary = resolveSecondary(input);
  const action = input.primaryAction?.trim() || "momento central";
  const curiosity = resolveCuriosity(input, pack);
  const summary = input.summary?.trim() || input.headline?.trim() || "";
  const seed = input.seed ?? input.subject;

  const hooks: Record<NarrationVariantAngle, string[]> = {
    factual_documental: [
      pickVariant(pack.openingExamples, seed, `hook-doc-${role}`),
      `Vamos entender ${lead} com calma — começando pelo que o vídeo mostra.`
    ],
    fan_lore: [
      secondary
        ? `Quem acompanha ${lead} e ${secondary} reconhece essa cena na hora.`
        : `Fã de ${lead} já sabe por que esse trecho pesa mais.`,
      pickVariant(pack.openingExamples, seed, `hook-fan-${role}`)
    ],
    suspense_reveal: [
      `Tem algo estranho nessa cena de ${lead}. O tom muda rápido.`,
      `Parece simples no primeiro olhar — mas a HQ entrega outra camada.`
    ],
    simple_explanatory: [
      `${lead} em poucas palavras: o que importa é ${action}.`,
      `Sem enrolação: esse recorte de ${lead} explica uma ideia só.`
    ],
    controlled_controversy: [
      `Sobre ${lead}, dá pra discordar — mas o fato central é este.`,
      `A polêmica esquenta, mas vale olhar o que está documentado.`
    ],
    quick_curiosity: [
      `Três segundos. Um detalhe. ${lead} nunca mais parece igual.`,
      `O lance de ${lead} que muda a leitura do começo ao fim.`
    ]
  };

  const promise: Record<NarrationVariantAngle, string[]> = {
    factual_documental: [
      summary
        ? shortenForSpeech(normalizeText(summary), 22)
        : `Promessa: em menos de um minuto você entende o contexto de ${lead}.`,
      `Fica até o fim — a revelação fecha com o gancho.`
    ],
    fan_lore: [
      `A gente abre a camada que o clipe não conta sobre ${lead}.`,
      `Referência, contexto e o porquê dessa cena existir.`
    ],
    suspense_reveal: [
      `Antes do clímax, uma peça não encaixa — e é ela que importa.`,
      `O vídeo esconde metade. A outra metade explica o clima.`
    ],
    simple_explanatory: [
      `Passo a passo: o que acontece, por que importa, o que muda.`,
      `Uma ideia por frase — sem jargão desnecessário.`
    ],
    controlled_controversy: [
      `Dois ângulos, um recorte — e uma consequência clara.`,
      `Separar opinião de fato é o que segura essa história.`
    ],
    quick_curiosity: [
      `Curiosidade rápida: o que o olho passa e o ouvido prende.`,
      `Sem pausa longa — direto ao ponto que segura atenção.`
    ]
  };

  const curiosityLines: Record<NarrationVariantAngle, string[]> = {
    factual_documental: [
      `O registro aponta o seguinte: ${curiosity}`,
      `Dado que raramente aparece no clipe: ${curiosity}`
    ],
    fan_lore: [
      `Nos quadrinhos, a história é essa: ${curiosity}`,
      `Quem leu sabe: ${curiosity}`
    ],
    suspense_reveal: [
      `E aí fica estranho: ${curiosity}`,
      `Quando você descobre isso, o tom muda — ${curiosity}`
    ],
    simple_explanatory: [
      `Em termos simples: ${curiosity}`,
      `Traduzindo: ${curiosity}`
    ],
    controlled_controversy: [
      `O ponto que divide opinião: ${curiosity}`,
      `Fato que pouca gente coloca na mesa: ${curiosity}`
    ],
    quick_curiosity: [
      `Detalhe rápido: ${curiosity}`,
      `Olha isso: ${curiosity}`
    ]
  };

  const development: Record<NarrationVariantAngle, string[]> = {
    factual_documental: [
      secondary
        ? `${lead} e ${secondary} juntos mudam o peso de ${action}.`
        : `${action} ganha outro sentido com o contexto certo.`,
      `O que preparou esse instante com ${lead} raramente aparece no recorte.`
    ],
    fan_lore: [
      `Isso aparece bastante nos quadrinhos — por isso a cena parece maior do que uns segundos.`,
      `Tem referência escondida aqui — ${lead} carrega anos de história.`
    ],
    suspense_reveal: [
      `Cada segundo antes do clímax empurra pra uma leitura mais sombria.`,
      `O silêncio entre as falas também conta — não é só o que se vê.`
    ],
    simple_explanatory: [
      `Resumindo o meio: causa, efeito e por que ${lead} entra nessa hora.`,
      `Se faltar contexto, parece só ${action}. Com contexto, muda tudo.`
    ],
    controlled_controversy: [
      `Quem defende ${lead} aponta um lado; quem critica, outro — mas o registro fica.`,
      `A consequência prática já apareceu — e é isso que segura a discussão.`
    ],
    quick_curiosity: [
      `No meio do vídeo, o corte acelera — e o detalhe some se você piscar.`,
      `É aqui que a maioria desliga. Quem fica, leva o dado bom.`
    ]
  };

  const climax: Record<NarrationVariantAngle, string[]> = {
    factual_documental: [
      `A revelação fecha assim: ${curiosity}`,
      `É esse ponto que explica por que ${lead} viraliza nesse recorte.`
    ],
    fan_lore: [
      `Pra fã, o clímax é reconhecer: ${curiosity}`,
      `Quando cai a ficha: ${curiosity}`
    ],
    suspense_reveal: [
      `A virada vem agora — ${curiosity}`,
      `E o detalhe que não fecha? ${curiosity}`
    ],
    simple_explanatory: [
      `Conclusão direta: ${curiosity}`,
      `Traduzindo o clímax: ${curiosity}`
    ],
    controlled_controversy: [
      `O fato que muda o debate: ${curiosity}`,
      `Depois desse dado, a discussão sobre ${lead} não é a mesma.`
    ],
    quick_curiosity: [
      `Boom — ${curiosity}`,
      `E é por isso que prende: ${curiosity}`
    ]
  };

  const closing: Record<NarrationVariantAngle, string[]> = {
    factual_documental: [
      pickVariant(pack.closingExamples, seed, `close-doc-${role}`),
      `Volta no começo — agora ${lead} faz outro sentido.`
    ],
    fan_lore: [
      pickVariant(pack.closingExamples, seed, `close-fan-${role}`),
      `Repara de novo na abertura — a referência estava ali.`
    ],
    suspense_reveal: [
      pickVariant(pack.closingExamples, seed, `close-susp-${role}`),
      `Reassiste o início: o detalhe perturbador já estava na tela.`
    ],
    simple_explanatory: [
      pickVariant(pack.closingExamples, seed, `close-simple-${role}`),
      `Salva pra explicar ${lead} pra alguém em uma frase.`
    ],
    controlled_controversy: [
      pickVariant(pack.closingExamples, seed, `close-pole-${role}`),
      `Comenta com respeito — qual leitura você acha mais sólida?`
    ],
    quick_curiosity: [
      pickVariant(pack.closingExamples, seed, `close-quick-${role}`),
      `Loop fechado: o gancho inicial agora bate com o clímax.`
    ]
  };

  const byRole: Record<RetentionBeatRole, string[]> = {
    hook: hooks[angle],
    promise_context: promise[angle],
    curiosity: curiosityLines[angle],
    development: development[angle],
    climax_reveal: climax[angle],
    loop_closing: closing[angle]
  };

  return applyAntiClicheFilter(
    pickVariant(byRole[role], seed, `${role}-${angle}`),
    pack
  );
}

export function buildRetentionBeats(
  input: NarrationRetentionInput,
  angle: NarrationVariantAngle,
  pack?: NarrationStylePack
): RetentionBeatMetadata[] {
  const subjectCategory = classifyNarrationSubject(input);
  const stylePack = pack ?? getNarrationStylePack(subjectCategory);
  const pace = ANGLE_PACE[angle];
  const emotion = ANGLE_EMOTIONS[angle];
  const roles = Object.keys(RETENTION_BEAT_TIMINGS) as RetentionBeatRole[];

  return roles.map((role) => {
    const text = buildBeatText(role, angle, input, stylePack);
    const timing = RETENTION_BEAT_TIMINGS[role];
    return {
      role,
      text,
      emotion,
      pace,
      pauseAfterMs: resolvePauseAfterMs(role, pace),
      emphasisWords: extractEmphasisWords(text),
      captionWords: extractCaptionWords(text),
      visualCue: resolveVisualCue(role, input, stylePack),
      retentionGoal: timing.retentionGoal,
      timing: { startSec: timing.startSec, endSec: timing.endSec }
    };
  });
}

export function beatsToRetentionScript(beats: RetentionBeatMetadata[]): string {
  return beats.map((beat) => beat.text).join("\n");
}

export function tokenOverlap(left: string, right: string): number {
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
  const overlap = rightWords.filter((word) => leftWords.has(word)).length;
  return Number((overlap / rightWords.length).toFixed(2));
}

function countSentences(script: string): number {
  return script.split(/(?<=[.!?])\s+/).filter(Boolean).length;
}

function hasQuestionOrContrast(script: string): boolean {
  return /\?|—|não é|parece|até você|mas |porém /i.test(script);
}

function hasLoopClosing(script: string, pack: NarrationStylePack): boolean {
  const lastLine = script.split("\n").filter(Boolean).pop() ?? "";
  return (
    /volta|repara|reassiste|comenta|salva|loop|começo|início|abertura/i.test(
      lastLine
    ) || pack.closingExamples.some((example) => linesTooSimilar(example, lastLine, 0.45))
  );
}

function scoreOralPtBr(script: string): number {
  let score = 100;
  const issues: Array<[RegExp, number]> = [
    [/protagoniza|recorte editorial|pano de fundo/i, 18],
    [/;\s/g, 8],
    [/\bvoce\b|\bnao\b/gi, 12],
    [/\b(instante decisivo|memória coletiva)\b/i, 10],
    [/\b(em|no|na)\s+[^,.]{30,},/i, 8]
  ];
  for (const [pattern, penalty] of issues) {
    if (pattern.test(script)) score -= penalty;
  }
  if (script.includes("você") || script.includes("a gente")) score += 4;
  return Math.max(0, Math.min(100, score));
}

function scoreRhythm(script: string, pack: NarrationStylePack): number {
  const lines = script.split("\n").filter(Boolean);
  if (lines.length < 4) return 55;
  const avgWords =
    lines.reduce((acc, line) => acc + line.split(/\s+/).length, 0) / lines.length;
  const target =
    pack.idealPace === "fast" ? 16 : pack.idealPace === "slow" ? 22 : 18;
  const delta = Math.abs(avgWords - target);
  return Math.max(35, Math.min(100, 100 - delta * 4));
}

function scoreCuriosity(script: string): number {
  let score = 55;
  if (/\d/.test(script)) score += 12;
  if (hasQuestionOrContrast(script)) score += 15;
  if (/detalhe|porque|por que|quando|segredo|revela|virada|fato|registro/i.test(script)) {
    score += 18;
  }
  return Math.min(100, score);
}

function scoreClarity(script: string): number {
  const sentences = countSentences(script);
  const words = script.split(/\s+/).filter(Boolean).length;
  const avg = words / Math.max(sentences, 1);
  if (avg > 22) return 58;
  if (avg < 8) return 62;
  return Math.min(100, 92 - Math.max(0, avg - 14) * 3);
}

function scoreHookStrength(script: string, pack: NarrationStylePack): number {
  const hook = script.split("\n").filter(Boolean)[0] ?? "";
  if (!hook) return 40;
  let score = 62;
  if (hook.split(/\s+/).length <= 18) score += 12;
  if (pack.allowedHookTypes.some((type) => hook.toLowerCase().includes(type.split(" ")[0]!))) {
    score += 8;
  }
  if (/olha|esse|essa|quem|parece|detalhe|vamos/i.test(hook)) score += 10;
  if (findForbiddenPhrases(hook).length > 0) score -= 25;
  return Math.max(0, Math.min(100, score));
}

function scoreVisualSync(script: string, input: NarrationRetentionInput): number {
  const lead = resolveLead(input).toLowerCase();
  const hints = (input.visualHints ?? []).map((h) => h.toLowerCase());
  let score = 68;
  if (script.toLowerCase().includes(lead)) score += 12;
  if (hints.some((hint) => script.toLowerCase().includes(hint))) score += 10;
  if (/cena|plano|close|corte|zoom|tela|vídeo|clipe/i.test(script)) score += 8;
  return Math.min(100, score);
}

function scoreDifferentiation(script: string, priorScripts: string[]): number {
  if (priorScripts.length === 0) return 90;
  const overlaps = priorScripts.map((prior) => tokenOverlap(prior, script));
  const maxOverlap = Math.max(...overlaps, 0);
  return Math.max(0, Math.min(100, Math.round(100 - maxOverlap * 110)));
}

export function scoreNarrationForShorts(
  script: string,
  context?: {
    pack?: NarrationStylePack;
    input?: NarrationRetentionInput;
    priorScripts?: string[];
  }
): NarrationRetentionScore {
  const pack = context?.pack ?? getNarrationStylePack("generico");
  const input = context?.input;
  const priorScripts = context?.priorScripts ?? [];
  const forbiddenPhrasesFound = findForbiddenPhrases(script, pack);

  const breakdown: NarrationRetentionScoreBreakdown = {
    hookStrength: scoreHookStrength(script, pack),
    oralPtBr: scoreOralPtBr(script),
    clarity: scoreClarity(script),
    curiosity: scoreCuriosity(script),
    rhythm: scoreRhythm(script, pack),
    clicheFree: Math.max(0, 100 - forbiddenPhrasesFound.length * 22),
    differentiation: scoreDifferentiation(script, priorScripts),
    visualSync: input ? scoreVisualSync(script, input) : 72,
    loopClosing: hasLoopClosing(script, pack) ? 88 : 52
  };

  const weights: Record<keyof NarrationRetentionScoreBreakdown, number> = {
    hookStrength: 0.14,
    oralPtBr: 0.12,
    clarity: 0.1,
    curiosity: 0.14,
    rhythm: 0.1,
    clicheFree: 0.12,
    differentiation: 0.1,
    visualSync: 0.08,
    loopClosing: 0.1
  };

  const total = Math.round(
    Object.entries(breakdown).reduce(
      (acc, [key, value]) =>
        acc + value * weights[key as keyof NarrationRetentionScoreBreakdown],
      0
    )
  );

  const recommendations: string[] = [];
  if (breakdown.hookStrength < 80) {
    recommendations.push("Reforçar gancho nos primeiros 2s com promessa concreta.");
  }
  if (breakdown.oralPtBr < 80) {
    recommendations.push("Simplificar construções literárias para fala natural em PT-BR.");
  }
  if (breakdown.curiosity < 80) {
    recommendations.push("Abrir lacuna de curiosidade antes do clímax.");
  }
  if (breakdown.clicheFree < 90) {
    recommendations.push(
      `Remover clichês: ${forbiddenPhrasesFound.join(", ") || "expressões proibidas"}.`
    );
  }
  if (breakdown.loopClosing < 80) {
    recommendations.push("Fechar com loop que remeta ao gancho inicial.");
  }
  if (breakdown.differentiation < 75 && priorScripts.length > 0) {
    recommendations.push("Reduzir overlap textual com variações anteriores.");
  }
  if (breakdown.rhythm < 75) {
    recommendations.push(`Ajustar ritmo para o pack (${pack.idealPace}).`);
  }

  return {
    total,
    breakdown,
    recommendations,
    forbiddenPhrasesFound
  };
}

function rewriteBeatLine(
  line: string,
  role: RetentionBeatRole,
  pack: NarrationStylePack,
  attempt: number
): string {
  const alternatives: Record<RetentionBeatRole, string[]> = {
    hook: [
      `Presta atenção: ${line.replace(/^[^:]*:\s*/, "")}`,
      `Começa assim — ${line}`,
      pack.openingExamples[attempt % pack.openingExamples.length] ?? line
    ],
    promise_context: [
      `Em menos de um minuto você entende o recorte.`,
      `Fica até o fim — a virada fecha com o começo.`,
      `A gente abre o contexto que o clipe não conta.`
    ],
    curiosity: [
      `O detalhe que muda a leitura: ${line}`,
      `Pouca gente repara, mas: ${line}`,
      `Quem conhece a HQ saca na hora: ${line}`
    ],
    development: [
      `No meio da cena: ${line}`,
      `O recorte esconde isso: ${line}`,
      `A HQ explica melhor: ${line}`
    ],
    climax_reveal: [
      `A revelação é esta: ${line}`,
      `É aqui que fecha: ${line}`,
      `O ponto alto: ${line}`
    ],
    loop_closing: [
      pack.closingExamples[attempt % pack.closingExamples.length] ?? line,
      `Volta no início — agora o gancho faz outro sentido.`,
      `Comenta o que mais te pegou nesse trecho.`
    ]
  };

  const candidate = alternatives[role][attempt % alternatives[role].length] ?? line;
  return applyAntiClicheFilter(shortenForSpeech(candidate, 24), pack);
}

export function rewriteNarrationForRetention(
  script: string,
  input: NarrationRetentionInput,
  pack?: NarrationStylePack
): { script: string; beats: RetentionBeatMetadata[]; score: NarrationRetentionScore } {
  const subjectCategory = classifyNarrationSubject(input);
  const stylePack = pack ?? getNarrationStylePack(subjectCategory);
  let currentScript = applyAntiClicheFilter(script, stylePack);
  let beats = buildRetentionBeatsFromScript(currentScript, input, stylePack);
  let score = scoreNarrationForShorts(currentScript, { pack: stylePack, input });

  for (let attempt = 0; attempt < MAX_REWRITE_ATTEMPTS && score.total < SCORE_THRESHOLD; attempt++) {
    beats = beats.map((beat, index) => {
      const rewritten = rewriteBeatLine(beat.text, beat.role, stylePack, attempt + index);
      return {
        ...beat,
        text: rewritten,
        emphasisWords: extractEmphasisWords(rewritten),
        captionWords: extractCaptionWords(rewritten)
      };
    });
    currentScript = beatsToRetentionScript(beats);
    score = scoreNarrationForShorts(currentScript, { pack: stylePack, input });
  }

  return { script: currentScript, beats, score };
}

function buildRetentionBeatsFromScript(
  script: string,
  input: NarrationRetentionInput,
  pack: NarrationStylePack
): RetentionBeatMetadata[] {
  const lines = script.split("\n").map((line) => line.trim()).filter(Boolean);
  const roles = Object.keys(RETENTION_BEAT_TIMINGS) as RetentionBeatRole[];
  const pace = pack.idealPace === "slow" ? "slow" : pack.idealPace === "fast" ? "fast" : "medium";

  return roles.map((role, index) => {
    const text = lines[index] ?? lines[lines.length - 1] ?? "";
    const timing = RETENTION_BEAT_TIMINGS[role];
    return {
      role,
      text,
      emotion: pack.narrativeTone,
      pace,
      pauseAfterMs: resolvePauseAfterMs(role, pace),
      emphasisWords: extractEmphasisWords(text),
      captionWords: extractCaptionWords(text),
      visualCue: resolveVisualCue(role, input, pack),
      retentionGoal: timing.retentionGoal,
      timing: { startSec: timing.startSec, endSec: timing.endSec }
    };
  });
}

function ensureDistinctVariant(
  beats: RetentionBeatMetadata[],
  angle: NarrationVariantAngle,
  input: NarrationRetentionInput,
  pack: NarrationStylePack,
  priorScripts: string[]
): RetentionBeatMetadata[] {
  let script = beatsToRetentionScript(beats);
  if (priorScripts.some((prior) => linesTooSimilar(prior, script, 0.62))) {
    const regenerated = buildRetentionBeats(
      { ...input, seed: `${input.seed ?? input.subject}:${angle}:retry` },
      angle,
      pack
    );
    script = beatsToRetentionScript(regenerated);
    if (!priorScripts.some((prior) => linesTooSimilar(prior, script, 0.62))) {
      return regenerated;
    }
  }
  return beats;
}

export function generateNarrationVariants(
  input: NarrationRetentionInput,
  count = 3
): NarrationRetentionReport {
  const subjectCategory = classifyNarrationSubject(input);
  const stylePack = getNarrationStylePack(subjectCategory);
  const angles = VARIANT_ANGLE_ORDER.slice(0, Math.max(1, count));
  const variants: NarrationRetentionVariant[] = [];
  const priorScripts: string[] = [];

  for (const angle of angles) {
    let beats = buildRetentionBeats(
      { ...input, seed: `${input.seed ?? input.subject}:${angle}` },
      angle,
      stylePack
    );
    beats = ensureDistinctVariant(beats, angle, input, stylePack, priorScripts);

    let script = beatsToRetentionScript(beats);
    let score = scoreNarrationForShorts(script, {
      pack: stylePack,
      input,
      priorScripts
    });

    if (score.total < SCORE_THRESHOLD) {
      const rewritten = rewriteNarrationForRetention(script, input, stylePack);
      script = rewritten.script;
      beats = rewritten.beats;
      score = scoreNarrationForShorts(script, {
        pack: stylePack,
        input,
        priorScripts
      });
    }

    priorScripts.push(script);
    variants.push({
      angle,
      script,
      beats,
      score,
      voiceMetadata: {
        energyLevel: stylePack.energyLevel,
        narrativeTone: stylePack.narrativeTone,
        idealPace: stylePack.idealPace,
        curiosityType: stylePack.curiosityType
      }
    });
  }

  const overlapMatrix = variants.map((left, leftIndex) =>
    variants.map((right, rightIndex) =>
      leftIndex === rightIndex ? 1 : tokenOverlap(left.script, right.script)
    )
  );

  const recommendations = [
    ...new Set(variants.flatMap((variant) => variant.score.recommendations))
  ];

  return {
    subjectCategory,
    stylePack,
    variants,
    overlapMatrix,
    recommendations,
    generatedAt: new Date().toISOString()
  };
}

export class NarrationRetentionEngine {
  classifySubject(input: NarrationRetentionInput): NarrationRetentionSubject {
    return classifyNarrationSubject(input);
  }

  getStylePack(subject: NarrationRetentionSubject): NarrationStylePack {
    return getNarrationStylePack(subject);
  }

  buildBeats(
    input: NarrationRetentionInput,
    angle: NarrationVariantAngle = "factual_documental"
  ): RetentionBeatMetadata[] {
    const pack = getNarrationStylePack(classifyNarrationSubject(input));
    return buildRetentionBeats(input, angle, pack);
  }

  score(script: string, context?: Parameters<typeof scoreNarrationForShorts>[1]) {
    return scoreNarrationForShorts(script, context);
  }

  generateVariants(input: NarrationRetentionInput, count = 3): NarrationRetentionReport {
    return generateNarrationVariants(input, count);
  }
}