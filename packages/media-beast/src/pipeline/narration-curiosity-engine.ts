import { buildNarrationPlan } from "@reelforge/narration-engine";
import { detectTopicCase, type TopicCaseBrief } from "../editorial/topic-knowledge.js";
import type { MediaBeastCandidate } from "../providers/types.js";
import type { MediaBeastNiche } from "../providers/types.js";
import type {
  RemixContentDomain,
  RemixStructuredContentDescription
} from "./remix-content-intelligence.js";
import type { ProductionEmotion } from "./niche-production-profiles.js";
import { repairTruncatedPhrases } from "./narration-pad-sanitizer.js";
import type { RemixTargetStyle } from "./remix-types.js";

const PROVIDER_TITLE_PREFIX =
  /^(Manual |YouTube |Image |Forum |Trend |TikTok |Pinterest |Flickr |Reddit |Generic web |Internet Archive )[\w\s]*(?:lead|candidate):\s*/iu;

const SYSTEM_TEXT_PATTERNS: RegExp[] = [
  /rights must be confirmed/i,
  /manual(?:ly)? approval/i,
  /staging[- ]only/i,
  /platform detected/i,
  /terms of service/i,
  /copyright/i,
  /content[- ]id/i,
  /do not use/i,
  /license review/i,
  /discovery[- ]only/i,
  /public url ingested/i,
  /remix candidate/i,
  /render stays blocked/i,
  /approve only if/i,
  /revisar fontes/i,
  /revisao manual/i,
  /material aprovado/i,
  /fonte nao verificada/i,
  /fontes exigem/i,
  /use apenas material/i,
  /nao afirmar/i,
  /nao narrar/i,
  /o corte deve/i,
  /destacar o detalhe visual aprovado/i,
  /hook:/i,
  /contexto:/i,
  /climax:/i,
  /cta:/i,
  /editorial_lead/i,
  /archival_footage/i,
  /search_intent/i,
  /source_pack/i,
  /temporal_lens/i,
  /https?:\/\//i,
  /archive collections often/i,
  /manual license review/i,
  /dom[ií]nio:\s*\w+/i,
  /entidades:\s*/i,
  /a[cç][aã]o central:/i,
  /plataforma:\s*(local|youtube|tiktok)/i,
  /tom:\s*energia/i,
  /gancho imediato com/i,
  /contexto editorial:/i,
  /prova visual:/i,
  /fechamento com cta/i,
  /narration engine directive/i,
  /beat map/i,
  /script final/i,
  /proibido no audio/i
];

export type NarrationBeatRole = "hook" | "context" | "tension" | "climax" | "cta";

export interface NarrationProsody {
  energy: "whisper" | "low" | "medium" | "high" | "peak";
  tone: string;
  pauseBeforeMs: number;
  emphasisWords: string[];
  deliveryNote: string;
}

export interface NarrationBeatDraft {
  role: NarrationBeatRole;
  text: string;
  caption: string;
  curiosityTag: string;
  prosody?: NarrationProsody;
}

export interface VideoNarrationHints {
  domain?: RemixContentDomain;
  headline?: string;
  summary?: string;
  narrativeBrief?: string;
  narrativeHook?: string;
  curiosityAngle?: string;
  setting?: string | null;
  entities?: string[];
  primaryAction?: string;
  primaryActionVerb?: string;
  themeSummary?: string;
  contextKeywords?: string[];
  mood?: string;
  sceneAngles?: Array<{
    role: string;
    angle: string;
    focusEntity?: string | null;
    visualHint?: string;
  }>;
}

export interface NarrationContentContext {
  subject: string;
  primaryEntity: string | null;
  secondaryEntities: string[];
  niche: MediaBeastNiche | "generic";
  emotion: ProductionEmotion;
  topicCase: TopicCaseBrief | null;
  curiositySource: string;
  years: string[];
  isQuestionTitle: boolean;
  platformHint: string | null;
  videoHints: VideoNarrationHints | null;
  wordBudget: Record<NarrationBeatRole, number>;
  targetDurationSeconds: number;
}

const ENTITY_CURIOSITY_FACTS: Record<string, string[]> = {
  messi: [
    "Messi tem 1,70 m. Mesmo assim, ganha duelo. Ele lê o quadril do zagueiro antes de acelerar.",
    "O gol parece improviso. Não é. Ele olha o pé de apoio do marcador antes do toque.",
    "Passos curtos. Centro de gravidade baixo. Isso comprime o tempo de reação do adversário."
  ],
  ronaldo: [
    "CR7 salta mais de 70 cm no cabeceio. Por isso o timing no ar parece impossível.",
    "Ele ajusta a corrida de aproximação. Chega no ponto exato do cruzamento.",
    "Parece força bruta. O segredo é ler o espaço entre marcação e goleiro."
  ],
  neymar: [
    "Neymar mexe o ombro antes do pé. O marcador reage no movimento errado.",
    "O drible viral nasce de toque de sola. Não de velocidade pura.",
    "Ele usa o corpo como isca. O passe sai no meio da finta."
  ],
  goro: [
    "Goro foi o primeiro chefe jogável da franquia — quatro braços não são só estética, mudam o alcance do grab.",
    "No arcade de 1992, ele existia para punir agressividade: alcance absurdo e dano que assustava no fliperama.",
    "A curiosidade está no design: Shokan foi pensado para intimidar no ritmo, não só no dano bruto."
  ],
  deadpool: [
    "Deadpool quebra a quarta parede porque o roteiro original era paródia direta de Deathstroke da DC.",
    "Wade Wilson nasceu como piada de crossover — e virou fenômeno quando o tom irreverente colou com o público.",
    "O traje vermelho não é acaso: nas HQs iniciais, era para parecer o Aranha-Verde invertido."
  ],
  venom: [
    "Venom surgiu numa história em que o público escolheu o design do traje preto do Homem-Aranha.",
    "Eddie Brock e o simbionte são duas vozes no mesmo corpo — o conflito interno virou assinatura do personagem.",
    "O visual do simbionte nasceu de um fã que venceu concurso de arte nas HQs Marvel dos anos 80."
  ],
  spiderman: [
    "Peter Parker foi criado para ser o herói adolescente comum — dinheiro curto, tarefas e culpa real.",
    "As teias não são magia: na mitologia clássica, são fluido inventado por ele com química caseira.",
    "O traje vermelho e azul foi desenhado para contrastar com o cenário de Nova York nos quadrinhos."
  ],
  batman: [
    "Batman não tem superpoderes — a vantagem é preparação obsessiva e medo usado como arma psicológica.",
    "Gotham foi inspirada em Nova York à noite: sombras, chuva e arquitetura art déco definem o tom.",
    "A regra de não matar nasceu para diferenciá-lo de vigilantes mais brutais dos quadrinhos da época."
  ],
  naruto: [
    "Naruto carrega o selo da Nove-Caudas porque o vilão selou a raposa nele ainda bebê — por isso a aldeia o rejeitou.",
    "O sonho de Hokage não é só ambição: é prova de que um pária pode virar símbolo de união.",
    "O Rasengan foi inspirado em conceitos de rotação de chakra — técnica que o pai dele nunca terminou de ensinar."
  ],
  goku: [
    "Goku foi criado com referência à lenda do Rei Macaco — por isso a evolução e o tom aventureiro.",
    "A transformação em Super Saiyajin nasceu de um roteiro acelerado para salvar a saga de Freeza.",
    "Ele perde lutas de propósito narrativo: cada derrota abre um novo limite de treino."
  ]
};

const DOMAIN_CURIOSITY_FALLBACKS: Record<RemixContentDomain, string[]> = {
  sports: [
    "O lance histórico quase sempre nasce de um detalhe tático invisível na primeira assistida.",
    "Quem viu ao vivo lembra do placar e da pressão — o highlight sozinho esconde metade da história.",
    "O instante decisivo costuma vir depois de uma jogada sem bola que a câmera larga corta."
  ],
  comics_superhero: [
    "O momento icônico no filme quase sempre vem de um painel clássico dos quadrinhos.",
    "Diretores escondem referências visuais que só fã de HQ reconhece na hora.",
    "A cena que viraliza raramente é só efeito — é quando ator, luz e composição copiam a página original."
  ],
  gaming: [
    "Highlights virais costumam esconder frame data e decisão de matchup — não é só reflexo bonito.",
    "O que parece sorte no clipe geralmente é punição repetida em treino contra um padrão específico.",
    "Clip de conhecimento separa reação de leitura: o jogador já sabia o que o oponente ia fazer."
  ],
  anime: [
    "Cenas de anime viralizam quando o storyboard antecipa o impacto antes do golpe conectar.",
    "Mangakás costumam economizar linhas no clímax — o silêncio entre painéis vira tensão no anime.",
    "O frame que gruda na memória quase sempre referencia um capítulo específico do mangá."
  ],
  true_crime: [
    "Casos icônicos só se conectam anos depois, quando arquivos de jurisdições diferentes se cruzam.",
    "A curiosidade está no método: perfil, mapa e entrevistas transformaram caos em padrão investigável.",
    "Manchetes da época mostram um caso; o arquivo revela outra sequência de eventos."
  ],
  horror: [
    "Terror eficaz no cinema usa som e espaço negativo mais do que jump scare — o cérebro completa o medo.",
    "O que assusta de verdade é o que a câmera recusa mostrar por um segundo a mais.",
    "Clássicos do gênero envelhecem bem quando o monstro é metáfora, não só efeito prático."
  ],
  science: [
    "Fenômenos contraintuitivos viralizam quando a explicação simples esconde um mecanismo surpreendente.",
    "O dado que prende não é o óbvio — é a consequência em escala que ninguém calcula na hora.",
    "Ciência de short funciona quando traduz abstração em imagem mental concreta."
  ],
  documentary: [
    "Arquivo histórico muda a leitura: o mesmo evento era percebido de outro jeito na época.",
    "Documentários premium usam silêncio e macro de objeto para dar peso emocional ao fato.",
    "A curiosidade está no que ficou fora do corte original — contexto que só fonte primária revela."
  ],
  generic: [
    "O que separa um short memorável quase nunca está no título.",
    "Quem entende o contexto antes do clímax vê o que a maioria ignora.",
    "O melhor vem um segundo antes do momento que todo mundo compartilha."
  ]
};

const OBVIOUS_PHRASE_PATTERNS = [
  /o detalhe mais intrigante/i,
  /pouca gente sabe/i,
  /poucos sabem/i,
  /quase ninguem/i,
  /quase ninguém/i,
  /camada que shorts costumam ignorar/i,
  /muda a leitura inteira/i,
  /no feed/i,
  /remix gen[eé]rico/i,
  /recorte editorial do short/i,
  /viralizou no clipe/i,
  /antecipa a explica[cç][aã]o/i,
  /surpresa est[aá] no que acontece/i,
  /pausa aqui/i,
  /é nesse instante que tudo vira/i,
  /esse lance de .+ parece simples/i,
  /até você ver o instante anterior/i,
  /todo mundo vê .+ quase ninguém/i,
  /a câmera gruda em/i,
  /o clipe só mostra metade/i,
  /e aí vem o lance que quase ninguém comentou/i,
  /fãs reconhecem na hora\.?$/i,
  /contexto que raramente aparece no clipe/i,
  /por isso o hype explode nesse frame/i,
  /pain[eé]is cl[aá]ssicos inspiram/i,
  /inspiram esse frame/i,
  /escolha narrativa/i,
  /peso emocional da cena/i,
  /paga uma d[ií]vida com os f[aã]s/i,
  /a narra[cç][aã]o abre a camada/i,
  /refer[eê]ncia de f[aã] embutida no corte/i,
  /num beat de f[aã]/i,
  /num beat que parece/i,
  /o v[ií]deo resume demais/i
];

export type NarrationVariationAngle =
  | "curiosity_led"
  | "dark_reveal"
  | "emotional_bond"
  | "fan_lore"
  | "hype_energy"
  | "documentary_fact";

const STYLE_ANGLE_ROTATION: Record<RemixTargetStyle, NarrationVariationAngle[]> = {
  documentary: ["documentary_fact", "curiosity_led", "emotional_bond"],
  dark_cinematic: ["dark_reveal", "curiosity_led", "documentary_fact"],
  horror: ["dark_reveal", "emotional_bond", "curiosity_led"],
  true_crime: ["dark_reveal", "documentary_fact", "curiosity_led"],
  hype_sports: ["hype_energy", "curiosity_led", "fan_lore"],
  vintage_football: ["hype_energy", "fan_lore", "documentary_fact"],
  anime: ["fan_lore", "emotional_bond", "curiosity_led"],
  comics: ["fan_lore", "curiosity_led", "emotional_bond"],
  bodybuilding: ["hype_energy", "documentary_fact", "curiosity_led"],
  generic: ["curiosity_led", "documentary_fact", "emotional_bond", "fan_lore"]
};

const DOMAIN_ANGLE_BOOST: Partial<Record<RemixContentDomain, NarrationVariationAngle[]>> = {
  comics_superhero: ["fan_lore", "emotional_bond"],
  sports: ["hype_energy"],
  gaming: ["fan_lore", "hype_energy"],
  true_crime: ["dark_reveal"],
  horror: ["dark_reveal"]
};

export function resolveNarrationVariationAngle(input: {
  targetStyle?: RemixTargetStyle;
  variationIndex?: number;
  styleSlotIndex?: number;
  domain?: RemixContentDomain;
  emotion?: ProductionEmotion;
}): NarrationVariationAngle {
  const fallbackAngles: NarrationVariationAngle[] = [
    "curiosity_led",
    "documentary_fact",
    "emotional_bond",
    "fan_lore",
    "dark_reveal"
  ];
  if (input.targetStyle) {
    const styleAngles = STYLE_ANGLE_ROTATION[input.targetStyle];
    const slot = input.styleSlotIndex ?? input.variationIndex ?? 0;
    return styleAngles[slot % styleAngles.length] ?? "curiosity_led";
  }

  const boosted = input.domain ? DOMAIN_ANGLE_BOOST[input.domain] ?? [] : [];
  const pool = [...new Set<NarrationVariationAngle>([...fallbackAngles, ...boosted])];
  const slot = input.variationIndex ?? 0;
  return pool[slot % pool.length] ?? "curiosity_led";
}

function spokenHookFromNarrativeHook(hook: string): string {
  return humanizeOralPtBr(
    optimizeForSpokenDelivery(
      hook
        .replace(/\s*—\s*/g, ". ")
        .replace(/\s+-\s+/g, ". ")
        .replace(/!\s*/g, ". ")
        .replace(/\s+\.\s*/g, ". ")
        .replace(/\.\s+\./g, ".")
        .replace(/\s+,/g, ",")
        .trim()
    )
  );
}

export function linesTooSimilar(left: string, right: string, threshold = 0.55): boolean {
  const leftWords = new Set(left.toLowerCase().split(/\s+/).filter((word) => word.length > 3));
  const rightWords = right.toLowerCase().split(/\s+/).filter((word) => word.length > 3);
  if (leftWords.size === 0 || rightWords.length === 0) {
    return false;
  }
  const overlap = rightWords.filter((word) => leftWords.has(word)).length;
  return overlap / rightWords.length >= threshold;
}

export function weaveCuriosityNaturally(
  curiosity: string,
  lead: string,
  angle: NarrationVariationAngle
): string {
  const spoken = optimizeForSpokenDelivery(curiosity);

  const bridges: Record<NarrationVariationAngle, string[]> = {
    curiosity_led: [
      `E o detalhe é esse: ${spoken}`,
      `Aqui que fica interessante — ${spoken}`,
      `Pouca gente liga, mas é o seguinte: ${spoken}`
    ],
    documentary_fact: [
      `O registro diz o seguinte: ${spoken}`,
      `Se você for ver nas HQs: ${spoken}`,
      `Nas HQs a história é outra: ${spoken}`
    ],
    fan_lore: [
      `Quem acompanha ${lead} reconhece na hora: ${spoken}`,
      `Nos quadrinhos, a história é essa: ${spoken}`,
      `Fã antigo já ouviu falar — ${spoken}`
    ],
    emotional_bond: [
      `E tem um lado emocional nisso: ${spoken}`,
      `Por trás dessa cena: ${spoken}`,
      spoken
    ],
    dark_reveal: [
      `E aí fica estranho: ${spoken}`,
      `Quando você descobre isso, o tom muda — ${spoken}`,
      `O que pouca gente lembra: ${spoken}`
    ],
    hype_energy: [
      `E é por isso que explode: ${spoken}`,
      `Esse é o gatilho do hype — ${spoken}`,
      `No auge do momento: ${spoken}`
    ]
  };

  return humanizeOralPtBr(pickVariant(bridges[angle], lead, `curiosity-weave-${angle}`));
}

export function isOperationalText(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) {
    return true;
  }

  return SYSTEM_TEXT_PATTERNS.some((pattern) => pattern.test(trimmed));
}

export function sanitizeTitle(title: string): string {
  return title
    .replace(PROVIDER_TITLE_PREFIX, "")
    .replace(/\s+/g, " ")
    .replace(/[_]+/g, " ")
    .trim();
}

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

const LITERARY_TO_SPOKEN: Array<[RegExp, string]> = [
  [/protagoniza/gi, "é o centro de"],
  [/recorte editorial/gi, "corte"],
  [/pano de fundo editorial/gi, "contexto"],
  [/camada que shorts costumam ignorar/gi, "detalhe que quase ninguém vê"],
  [/muda a leitura inteira/gi, "muda tudo"],
  [/memória coletiva/gi, "história que todo mundo lembra"],
  [/instante decisivo/gi, "momento decisivo"],
  [/pain[eé]is cl[aá]ssicos inspiram esse frame/gi, "isso aparece bastante nos quadrinhos"],
  [/inspiram esse frame/gi, "aparecem muito nos quadrinhos"],
  [/por isso parece maior que segundos/gi, "por isso parece maior do que uns segundos"],
  [/escolha narrativa/gi, "intenção na história"],
  [/peso emocional da cena/gi, "clima da cena"],
  [/paga uma d[ií]vida com os f[aã]s/gi, "é referência direta pros fãs"],
  [/refer[eê]ncia de f[aã] embutida no corte/gi, "tem referência de fã escondida aqui"],
  [/a narra[cç][aã]o abre a camada de tr[aá]s/gi, "a gente abre o que veio antes"],
  [/arquivo e hq contam outra coisa/gi, "nas HQs a história é outra"],
  [/o clipe mostra/gi, "Olha só: aqui aparece"],
  [/o short s[oó] resume/gi, "o vídeo só mostra um pedaço"],
  [/o short s[oó] mostra/gi, "o vídeo só mostra"],
  [/o short s[oó] sugere/gi, "o vídeo só dá uma pista"],
  [/no mesmo frame/gi, "na mesma cena"],
  [/esse frame/gi, "essa cena"],
  [/\besse beat\b/gi, "esse momento"],
  [/\bnum beat\b/gi, "num momento"],
  [/pede contexto/gi, "precisa de contexto"],
  [/pede olhar de f[aã]/gi, "precisa do olhar de fã"],
  [/pede empatia/gi, "pede pra você sentir junto"],
  [/de onde vem essa ideia/gi, "de onde surgiu essa ideia"],
  [/reconhece esse encontro na hora/gi, "saca esse encontro na hora"],
  [/—/g, ". "],
  [/\s-\s/g, ". "],
  [/;\s*/g, ". "],
  [/\bvoce\b/gi, "você"],
  [/\bnao\b/gi, "não"],
  [/\bate voce\b/gi, "até você"],
  [/\bate\s/gi, "até "]
];

function oralizeActionLabel(action: string): string {
  return action
    .replace(/\s*\/\s*/g, " e ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function humanizeOralPtBr(text: string): string {
  let oral = text.trim();
  if (!oral) {
    return "";
  }

  oral = oral
    .replace(/\bPor tr[aá]s de ([^,]+), tem uma\b/gi, "Não é só $1 por acaso — tem uma")
    .replace(/\bEssa dupla funciona porque ([^.]+)\./gi, "Essa dupla funciona por causa da $1.")
    .replace(/\bO t[ií]tulo promete\b/gi, "O título joga com a ideia de")
    .replace(/\bO corte n[aã]o explica\b/gi, "O vídeo não explica")
    .replace(/\bCom contexto, muda tudo\b/gi, "Quando você sabe o contexto, muda tudo")
    .replace(/\bSem contexto, parece s[oó]\b/gi, "Sem contexto, parece só")
    .replace(/\bvirou assinatura do personagem\b/gi, "virou marca do personagem")
    .replace(/\bvenom surgiu\b/gi, "Venom surgiu")
    .replace(/\bem que\.\s+([a-zà-ú])/gi, "em que $1")
    .replace(/\b(de|do|da|um|uma)\.\s+([A-ZÀ-Ú][a-zà-ú]+)/g, (_, prefix, word) => `${prefix} ${word.toLowerCase()}`)
    .replace(/\bpor causa da ([a-z])/gi, "por causa de $1")
    .replace(/\s+\./g, ".")
    .replace(/\.\s*\./g, ".")
    .trim();

  if (oral.length > 0) {
    oral = oral.charAt(0).toUpperCase() + oral.slice(1);
  }

  return oral;
}

const DANGLING_ENDING_PATTERN =
  /\b(o|a|os|as|um|uma|de|do|da|dos|das|em|no|na|nos|nas|que|se|e|ou|com|por|para)\.?$/i;

function polishTruncatedEnding(text: string): string {
  let result = text.trim();
  let guard = 0;

  while (DANGLING_ENDING_PATTERN.test(result) && result.includes(" ") && guard < 6) {
    guard += 1;
    const words = result.replace(/[.!?]$/, "").split(/\s+/).filter(Boolean);
    words.pop();
    if (!words.length) {
      break;
    }
    result = `${words.join(" ")}.`;
  }

  return result;
}

function shortenAtClauseBoundary(text: string, maxWords: number): string {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) {
    return text.trim();
  }

  for (let index = Math.min(words.length, maxWords); index >= Math.max(4, maxWords - 6); index -= 1) {
    const chunk = words.slice(0, index).join(" ");
    if (/[.!?]$/.test(chunk) || /[,;:]$/.test(chunk)) {
      return polishTruncatedEnding(chunk.replace(/[,;:]$/, ".").trim());
    }
  }

  const trimmed = words.slice(0, maxWords).join(" ");
  const withEnding = /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
  return polishTruncatedEnding(withEnding);
}

export function shortenForSpeech(text: string, maxWords: number): string {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) {
    return text.trim();
  }

  const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
  if (sentences.length > 1) {
    let assembled = "";
    let usedWords = 0;

    for (const sentence of sentences) {
      const sentenceWords = sentence.split(/\s+/).filter(Boolean).length;
      if (usedWords + sentenceWords <= maxWords) {
        assembled = assembled ? `${assembled} ${sentence}` : sentence;
        usedWords += sentenceWords;
        continue;
      }
      if (!assembled) {
        return shortenAtClauseBoundary(sentence, maxWords);
      }
      break;
    }

    if (assembled) {
      const withEnding = /[.!?]$/.test(assembled.trim())
        ? assembled.trim()
        : `${assembled.trim()}.`;
      return repairTruncatedPhrases(withEnding);
    }
  }

  return repairTruncatedPhrases(shortenAtClauseBoundary(text, maxWords));
}

export function optimizeForSpokenDelivery(text: string): string {
  let spoken = text.trim();
  if (!spoken) {
    return "";
  }

  for (const [pattern, replacement] of LITERARY_TO_SPOKEN) {
    spoken = spoken.replace(pattern, replacement);
  }

  spoken = spoken
    .replace(/\s+/g, " ")
    .replace(/\s+\./g, ".")
    .replace(/\.\s*\./g, ".")
    .replace(/,\s*,/g, ", ")
    .replace(/\s+([,.!?])/g, "$1")
    .trim();

  const sentences = spoken.split(/(?<=[.!?])\s+/).filter(Boolean);
  const normalized = sentences.flatMap((sentence) => {
    const words = sentence.split(/\s+/).filter(Boolean);
    if (words.length <= 20 || /\bem que\b/i.test(sentence)) {
      return [sentence];
    }

    const clauses = sentence.split(/,\s+/).filter(Boolean);
    if (clauses.length > 1 && clauses.every((clause) => clause.split(/\s+/).length <= 14)) {
      return clauses.map((clause) => (/[.!?]$/.test(clause) ? clause : `${clause}.`));
    }

    const pivot = Math.ceil(words.length / 2);
    const first = words.slice(0, pivot).join(" ");
    const second = words.slice(pivot).join(" ");
    return [
      /[.!?]$/.test(first) ? first : `${first}.`,
      /[.!?]$/.test(second) ? second : `${second}.`
    ];
  });

  return humanizeOralPtBr(
    normalized
      .join(" ")
      .replace(/\s+/g, " ")
      .replace(/(\. )([a-zà-ú])/g, (_, separator, letter) => `${separator}${letter.toUpperCase()}`)
      .trim()
  );
}

function distillNarrativeBriefForSpeech(brief: string, maxWords: number): string {
  const spoken = optimizeForSpokenDelivery(
    brief
      .replace(/\b(em|no|na)\s+[^,.]+,\s*/gi, "")
      .replace(/\bprotagoniza\b/gi, "é o centro de")
  );
  return shortenForSpeech(spoken, maxWords);
}

function extractEmphasisWords(text: string): string[] {
  const tokens = text.split(/\s+/).filter(Boolean);
  const emphasis = new Set<string>();

  for (const token of tokens) {
    const cleaned = token.replace(/[^a-zA-ZÀ-ÿ0-9]/g, "");
    if (!cleaned) {
      continue;
    }
    if (/\d/.test(cleaned)) {
      emphasis.add(cleaned);
    }
    if (/^[A-ZÀ-Ý]/.test(token) && cleaned.length > 2) {
      emphasis.add(cleaned);
    }
  }

  return [...emphasis].slice(0, 4);
}

export function buildBeatProsody(
  role: NarrationBeatRole,
  emotion: ProductionEmotion,
  text: string
): NarrationProsody {
  const emphasisWords = extractEmphasisWords(text);
  const emotionTone: Partial<Record<ProductionEmotion, string>> = {
    dark: "sombrio, contido",
    hype: "energia alta, ritmo acelerado",
    horror: "sussurro tenso, pausas longas",
    epic: "grandioso, seguro",
    curious: "curioso, conversacional",
    calm: "calmo, didático",
    tense: "suspenso, pressão crescente"
  };

  const byRole: Record<NarrationBeatRole, Omit<NarrationProsody, "emphasisWords">> = {
    hook: {
      energy: emotion === "hype" ? "peak" : "high",
      tone: `${emotionTone[emotion] ?? "direto"} — gancho`,
      pauseBeforeMs: 0,
      deliveryNote: "Primeira sílaba forte. Frase curta. Zero hesitação."
    },
    context: {
      energy: "medium",
      tone: `${emotionTone[emotion] ?? "documental"} — contexto`,
      pauseBeforeMs: 180,
      deliveryNote: "Tom explicativo. Uma ideia por frase. Respirar entre períodos."
    },
    tension: {
      energy: emotion === "dark" || emotion === "horror" ? "low" : "medium",
      tone: `${emotionTone[emotion] ?? "suspenso"} — virada`,
      pauseBeforeMs: 320,
      deliveryNote: "Micro-pausa antes da linha. Acelerar na última palavra."
    },
    climax: {
      energy: emotion === "hype" ? "peak" : emotion === "calm" ? "high" : "high",
      tone: `${emotionTone[emotion] ?? "revelação"} — clímax`,
      pauseBeforeMs: 420,
      deliveryNote: "Ênfase em números e no fato surpreendente. Pausa curta antes do dado."
    },
    cta: {
      energy: "low",
      tone: "convite leve — fechamento",
      pauseBeforeMs: 260,
      deliveryNote: "Tom amigável. Desacelerar. Soar como pergunta natural."
    }
  };

  return {
    ...byRole[role],
    emphasisWords
  };
}

function buildTensionBeatText(input: {
  lead: string;
  secondaryEntity?: string | null;
  action?: string;
  actionVerb?: string;
  hookPhrase?: string | null;
  domain?: RemixContentDomain;
  emotion: ProductionEmotion;
  angle?: NarrationVariationAngle;
  seed: string;
}): string {
  const action = input.action ?? "esse momento";
  const actionLower = action.replace(/\s*\/\s*/g, " e ").toLowerCase();
  const secondary = input.secondaryEntity;
  const angle = input.angle ?? "curiosity_led";

  const shared: string[] = [];

  if (secondary && input.domain === "comics_superhero") {
    shared.push(
      `A química entre ${input.lead} e ${secondary} não é acaso — o vídeo não conta de onde veio.`,
      `${input.lead} e ${secondary} juntos mudam o peso da cena. Repara no encontro.`,
      `Essa dupla funciona por causa de ${actionLower} — mas o vídeo não explica o porquê.`
    );
  }

  if (input.hookPhrase && input.hookPhrase.length > 4) {
    shared.push(
      `O título joga com a ideia de ${input.hookPhrase.toLowerCase()}. O vídeo não explica.`,
      `Parece exagero, mas ${input.lead} entrega.`
    );
  }

  const byAngle: Record<NarrationVariationAngle, string[]> = {
    curiosity_led: [
      `Repara no timing. É aqui que ${actionLower} deixa de ser só cena.`,
      `O corte acelera, mas o detalhe está nesse meio segundo.`,
      ...shared
    ],
    dark_reveal: [
      `E o clima pesa. ${input.lead} não escolhe isso por acaso.`,
      `Tem algo incômodo nesse encontro. Proposital.`,
      ...shared
    ],
    emotional_bond: [
      `Não é só ação. É o vínculo que o short quer que você sinta.`,
      `Aqui a cena deixa de ser luta e vira conexão.`,
      ...shared
    ],
    fan_lore: [
      `Quem leu a história original já esperava esse momento.`,
      `Isso é referência direta pros fãs — o vídeo só mostra a superfície.`,
      ...shared
    ],
    hype_energy: [
      `A energia sobe aqui. ${input.lead} entra no modo que o clipe quer vender.`,
      `É nesse pico que o short prende — antes do corte seguinte.`,
      ...shared
    ],
    documentary_fact: [
      `Sem contexto, parece só ${actionLower}. Com contexto, muda tudo.`,
      `O que o vídeo não narra é o que aconteceu imediatamente antes.`,
      ...shared
    ]
  };

  const domainExtras: Partial<Record<RemixContentDomain, string[]>> = {
    sports: [
      `Pressão, marcação e ritmo. ${actionLower} ganha outro sentido com o placar na cabeça.`,
      `O estádio sente esse lance antes da câmera mostrar.`
    ],
    gaming: [
      `Frame a frame, a leitura muda. Highlight bonito, decisão fria.`,
      `${input.lead} já leu o oponente. Só faltava esse segundo.`
    ],
    true_crime: [
      `As peças começam a encaixar. O que parecia isolado, não é.`,
      `Um detalhe pequeno muda o peso de ${actionLower}.`
    ]
  };

  const pool = [
    ...(byAngle[angle] ?? byAngle.curiosity_led),
    ...(input.domain ? domainExtras[input.domain] ?? [] : [])
  ];

  if (input.emotion === "horror" || input.emotion === "dark") {
    pool.push(`O silêncio aqui pesa. ${input.lead} não está sozinho nessa cena.`);
  }

  return humanizeOralPtBr(
    pickVariant(
      pool.filter((line) => !isObviousPhrase(line)),
      input.seed,
      `tension-${angle}`
    )
  );
}

function ensureFiveBeatStructure(
  drafts: Array<Omit<NarrationBeatDraft, "caption">>,
  options?: {
    emotion?: ProductionEmotion;
    lead?: string;
    action?: string;
    domain?: RemixContentDomain;
    seed?: string;
  }
): Array<Omit<NarrationBeatDraft, "caption">> {
  if (drafts.some((draft) => draft.role === "tension")) {
    return drafts;
  }

  const ordered: Array<Exclude<NarrationBeatRole, "tension">> = [
    "hook",
    "context",
    "climax",
    "cta"
  ];
  const result: Array<Omit<NarrationBeatDraft, "caption">> = [];

  for (const role of ordered) {
    const beat = drafts.find((draft) => draft.role === role);
    if (!beat) {
      continue;
    }

    result.push(beat);
    if (role === "context" && options?.seed) {
      const tensionInput: {
        lead: string;
        emotion: ProductionEmotion;
        seed: string;
        action?: string;
        domain?: RemixContentDomain;
      } = {
        lead: options.lead ?? "esse assunto",
        emotion: options.emotion ?? "curious",
        seed: options.seed
      };
      if (options.action) {
        tensionInput.action = options.action;
      }
      if (options.domain) {
        tensionInput.domain = options.domain;
      }

      result.push({
        role: "tension",
        text: buildTensionBeatText(tensionInput),
        curiosityTag: "tension-pivot"
      });
    }
  }

  return result.length >= 4 ? result : drafts;
}

export function polishPtBrNarration(text: string): string {
  return humanizeOralPtBr(
    text
      .replace(/\bvoce\b/gi, "você")
      .replace(/\bnao\b/gi, "não")
      .replace(/\bmidia\b/gi, "mídia")
      .replace(/\bepoca\b/gi, "época")
      .replace(/\bgeracoes\b/gi, "gerações")
      .replace(/\bdecada\b/gi, "década")
      .replace(/\bdecadas\b/gi, "décadas")
      .replace(/\btecnica\b/gi, "técnica")
      .replace(/\bclassico\b/gi, "clássico")
      .replace(/\biconico\b/gi, "icônico")
      .replace(/\bcuriosidade real\b/gi, "curiosidade")
      .replace(/\s{2,}/g, " ")
      .trim()
  );
}

export function hasConcreteCuriosity(text: string): boolean {
  const normalized = text.toLowerCase();
  if (/\d/.test(text)) {
    return true;
  }
  if (
    /porque|por que|já que|quando|antes de|segundo|frame|cm|metros?|ano|anos|criado|nasceu|inspirad|treina|mede|design|arquivo|método|biomecân/i.test(
      normalized
    )
  ) {
    return true;
  }
  return /curiosidade:|fato:|detalhe:/i.test(text);
}

export function resolveCuriosityFact(input: {
  entityId?: string | null;
  domain: RemixContentDomain;
  seed: string;
  lead: string;
  action?: string;
}): string {
  const entityFacts = input.entityId ? ENTITY_CURIOSITY_FACTS[input.entityId] : null;
  if (entityFacts?.length) {
    return pickVariant(entityFacts, input.seed, "entity-curiosity");
  }

  const domainFacts = DOMAIN_CURIOSITY_FALLBACKS[input.domain] ?? DOMAIN_CURIOSITY_FALLBACKS.generic;
  const fallback = pickVariant(domainFacts, input.seed, "domain-curiosity");
  if (input.action && input.domain === "sports") {
    return fallback.replace(/lance|highlight|momento/gi, input.action.toLowerCase());
  }
  return fallback.replace(/assunto|momento/gi, input.lead);
}

function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

function isObviousPhrase(text: string): boolean {
  return OBVIOUS_PHRASE_PATTERNS.some((pattern) => pattern.test(text));
}

function reduceSubjectRepetition(
  beats: NarrationBeatDraft[],
  subject: string
): NarrationBeatDraft[] {
  const subjectTokens = subject.split(/\s+/).filter(Boolean);
  const shortRef =
    subjectTokens.length > 1 ? subjectTokens[0]! : subject.length > 12 ? "ele" : subject;
  let subjectMentions = 0;

  return beats.map((beat) => {
    const subjectPattern = new RegExp(
      subjectTokens.slice(0, 2).join("\\s+").replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      "gi"
    );
    const mentions = (beat.text.match(subjectPattern) ?? []).length;
    subjectMentions += mentions;

    if (subjectMentions <= 1 || mentions === 0) {
      return beat;
    }

    let text = beat.text;
    if (mentions > 1) {
      let replaced = 0;
      text = text.replace(subjectPattern, (match) => {
        replaced += 1;
        if (replaced === 1) {
          return match;
        }
        return shortRef === subject ? "ele" : shortRef;
      });
    } else if (beat.role !== "hook" && mentions === 1 && subjectMentions > 2) {
      text = text.replace(subjectPattern, shortRef === subject ? "ele" : shortRef);
    }

    return {
      ...beat,
      text,
      caption: buildCaptionFromLine(text)
    };
  });
}

export function finalizeNarrationBeats(
  drafts: Array<Omit<NarrationBeatDraft, "caption">>,
  budget: NarrationContentContext["wordBudget"],
  subject: string,
  options?: {
    emotion?: ProductionEmotion;
    lead?: string;
    action?: string;
    domain?: RemixContentDomain;
    seed?: string;
  }
): NarrationBeatDraft[] {
  const structured = ensureFiveBeatStructure(drafts, options);
  const emotion = options?.emotion ?? "curious";

  const polished = structured.map((draft) => {
    const optimized = optimizeForSpokenDelivery(polishPtBrNarration(draft.text));
    const sanitized = sanitizeNarrationLine(optimized);
    const maxWords = budget[draft.role] ?? budget.context;
    const text =
      countWords(sanitized) > maxWords
        ? shortenForSpeech(sanitized, maxWords)
        : sanitized;

    return {
      ...draft,
      text,
      caption: buildCaptionFromLine(text),
      prosody: draft.prosody ?? buildBeatProsody(draft.role, emotion, text)
    };
  });

  return reduceSubjectRepetition(polished, subject);
}

export function validateNarrationScript(script: string): {
  valid: boolean;
  issues: string[];
} {
  const issues: string[] = [];

  for (const line of script.split("\n").map((entry) => entry.trim()).filter(Boolean)) {
    if (isOperationalText(line)) {
      issues.push(`texto operacional: ${line}`);
    }
    if (isMetadataSummary(line)) {
      issues.push(`metadado no script: ${line}`);
    }
    if (isObviousPhrase(line)) {
      issues.push(`frase genérica: ${line}`);
    }
  }

  return {
    valid: issues.length === 0,
    issues
  };
}

export function ensureNarrationBeatsSafe(
  beats: NarrationBeatDraft[],
  fallbackSubject: string
): NarrationBeatDraft[] {
  return beats.map((beat) => {
    const sanitized = sanitizeNarrationLine(polishPtBrNarration(beat.text));
    if (
      sanitized &&
      !isOperationalText(sanitized) &&
      !isMetadataSummary(sanitized)
    ) {
      return {
        ...beat,
        text: sanitized,
        caption: buildCaptionFromLine(sanitized)
      };
    }

    const fallbackByRole: Record<NarrationBeatDraft["role"], string> = {
      hook: `Esse corte de ${fallbackSubject} abre forte. Vamos entender o que está por trás.`,
      context: `Antes do clímax, vale olhar o que preparou esse momento.`,
      tension: `Repara nesse meio segundo. É aqui que a cena muda de rumo.`,
      climax: weaveCuriosityNaturally(
        resolveCuriosityFact({
          domain: "generic",
          seed: fallbackSubject,
          lead: fallbackSubject
        }),
        fallbackSubject,
        "curiosity_led"
      ),
      cta: `Comenta o que mais te pegou nesse trecho.`
    };

    const fallback = fallbackByRole[beat.role];
    return {
      ...beat,
      text: fallback,
      caption: buildCaptionFromLine(fallback),
      curiosityTag: `${beat.curiosityTag}-safe`
    };
  });
}

export function extractVideoHintsFromMetadata(
  metadata: Record<string, unknown>
): VideoNarrationHints | null {
  const domain = metadata.remixContentDomain;
  const entitiesRaw = metadata.remixEntities;
  const hasSignal =
    typeof domain === "string" ||
    typeof entitiesRaw === "string" ||
    typeof metadata.remixContentHeadline === "string" ||
    typeof metadata.remixThemeSummary === "string";

  if (!hasSignal) {
    return null;
  }

  const hints: VideoNarrationHints = {};

  if (typeof domain === "string") {
    hints.domain = domain as RemixContentDomain;
  }
  if (typeof metadata.remixContentHeadline === "string") {
    hints.headline = metadata.remixContentHeadline;
  }
  if (typeof metadata.remixContentSummary === "string") {
    hints.summary = metadata.remixContentSummary;
  }
  if (typeof metadata.remixNarrativeBrief === "string") {
    hints.narrativeBrief = metadata.remixNarrativeBrief;
  }
  if (typeof metadata.remixNarrativeHook === "string") {
    hints.narrativeHook = metadata.remixNarrativeHook;
  }
  if (typeof metadata.remixCuriosityAngle === "string") {
    hints.curiosityAngle = metadata.remixCuriosityAngle;
  }
  if (typeof metadata.remixSetting === "string") {
    hints.setting = metadata.remixSetting;
  }
  if (typeof entitiesRaw === "string") {
    hints.entities = entitiesRaw
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
  }
  if (typeof metadata.remixPrimaryAction === "string") {
    hints.primaryAction = metadata.remixPrimaryAction;
  }
  if (typeof metadata.remixThemeSummary === "string") {
    hints.themeSummary = metadata.remixThemeSummary;
  }
  if (typeof metadata.remixContextKeywords === "string") {
    hints.contextKeywords = metadata.remixContextKeywords
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
  }
  if (typeof metadata.remixMood === "string") {
    hints.mood = metadata.remixMood;
  }

  return hints;
}

export function sanitizeNarrationLine(text: string): string {
  const cleaned = text
    .replace(/[—–]/g, ", ")
    .replace(/\s+,/g, ",")
    .replace(/,(?!\d)\s*/g, ", ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned || isOperationalText(cleaned)) {
    return "";
  }

  return cleaned;
}

function buildCaptionFromLine(line: string, maxLength = 48): string {
  const normalized = line.trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }

  const slicePoint = normalized.lastIndexOf(" ", maxLength - 1);
  if (slicePoint > 20) {
    return `${normalized.slice(0, slicePoint)}…`;
  }

  return `${normalized.slice(0, maxLength - 1)}…`;
}

function estimateWordsPerSecond(pacing: "tight" | "balanced" | "breathing") {
  if (pacing === "tight") {
    return 2.85;
  }

  if (pacing === "breathing") {
    return 2.05;
  }

  return 2.4;
}

export function buildWordBudget(
  durationSeconds: number,
  pacing: "tight" | "balanced" | "breathing",
  options?: { fillRatio?: number; minTotalWords?: number }
): Record<NarrationBeatRole, number> {
  const fillRatio = options?.fillRatio ?? 0.9;
  const minTotalWords =
    options?.minTotalWords ?? Math.max(Math.round(durationSeconds * 1.75), 28);

  const totalWords = Math.max(
    Math.round(durationSeconds * estimateWordsPerSecond(pacing) * fillRatio),
    minTotalWords
  );

  return {
    hook: Math.max(Math.round(totalWords * 0.18), 8),
    context: Math.max(Math.round(totalWords * 0.24), 10),
    tension: Math.max(Math.round(totalWords * 0.12), 9),
    climax: Math.max(Math.round(totalWords * 0.28), 10),
    cta: Math.max(Math.round(totalWords * 0.14), 5)
  };
}

export function resolveNarrationPacingForDuration(
  durationSeconds: number,
  profilePacing: "tight" | "balanced" | "breathing" = "balanced"
): "tight" | "balanced" | "breathing" {
  if (durationSeconds <= 32) {
    return "balanced";
  }
  if (durationSeconds <= 45) {
    return profilePacing === "tight" ? "balanced" : profilePacing;
  }
  return "breathing";
}

function extractTitleEntities(title: string) {
  const subject = sanitizeTitle(title)
    .replace(/\b(documentary|collection|archive|candidate|remix|shorts?)\b/gi, "")
    .replace(/\?+/g, "")
    .replace(/\s+/g, " ")
    .trim();

  const years = [
    ...subject.matchAll(/\b((?:19|20)\d{2})s?\b/gi)
  ].map((match) => match[1] ?? match[0]);

  const tokens = subject
    .split(/[\s,?!\-:]+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 2);

  const properNouns = tokens.filter((token) => /^[A-Z][a-z]+/.test(token));
  const lowerSubject = subject.toLowerCase();

  return {
    subject: subject || "esse assunto",
    years,
    isQuestionTitle: subject.includes("?"),
    hasGoro: /\bgoro\b/i.test(subject),
    hasMortalKombat: /\b(mortal kombat|mk\s*\d+|mk\d+)\b/i.test(subject),
    mkVersion: subject.match(/\bmk\s*(\d+)|mortal kombat\s*(\d+)/i)?.[1] ??
      subject.match(/\bmk\s*(\d+)|mortal kombat\s*(\d+)/i)?.[2] ??
      null,
    hasSerialKillers: /\bserial killers?\b/i.test(subject),
    hasDecade: /\b(19|20)\d{2}s\b/i.test(subject),
    hasFootball: /\b(futebol|football|gol|mundial|libertadores|maracana)\b/i.test(
      subject
    ),
    hasHorror: /\b(horror|terror|filme|cinema|psicose|demônio|demonio)\b/i.test(
      subject
    ),
    hasScience: /\b(ciencia|science|espaco|space|fisica|quimica|dna)\b/i.test(
      subject
    ),
    primaryEntity: properNouns[0] ?? tokens[0] ?? null,
    secondaryEntities: tokens.slice(0, 4)
  };
}

function buildTopicCaseBeats(
  brief: TopicCaseBrief,
  seed: string,
  budget: NarrationContentContext["wordBudget"]
): Omit<NarrationBeatDraft, "caption">[] {
  const hook = pickVariant(
    [
      `${brief.year}: ${brief.location}. O dia em que ${brief.id} entrou para a historia.`,
      `Em ${brief.year}, ${brief.location} viveu um evento que redefiniu como a midia cobre tragedias.`,
      `Poucos casos marcam uma epoca como ${brief.id} em ${brief.year}.`
    ],
    seed,
    "hook"
  );

  const context = pickVariant(brief.summaryFacts, seed, "context");
  const climax = pickVariant(
    brief.timelineBeats.length > 0
      ? brief.timelineBeats
      : brief.editorialAngles,
    seed,
    "climax"
  );

  const cta = pickVariant(
    [
      `Quer a timeline completa? Comenta ${brief.id.toUpperCase()}.`,
      `Comenta se quer a parte 2 com arquivo.`,
      `Salva e comenta — a continuação é mais forte.`
    ],
    seed,
    "cta"
  );

  return [
    {
      role: "hook",
      text: shortenForSpeech(hook, budget.hook),
      curiosityTag: "topic-case-hook"
    },
    {
      role: "context",
      text: shortenForSpeech(context, budget.context),
      curiosityTag: "topic-case-fact"
    },
    {
      role: "climax",
      text: shortenForSpeech(climax, budget.climax),
      curiosityTag: "topic-case-climax"
    },
    {
      role: "cta",
      text: shortenForSpeech(cta, budget.cta),
      curiosityTag: "topic-case-cta"
    }
  ];
}

function buildGamingBeats(
  entities: ReturnType<typeof extractTitleEntities>,
  seed: string,
  budget: NarrationContentContext["wordBudget"]
): Omit<NarrationBeatDraft, "caption">[] {
  const gameLabel = entities.mkVersion
    ? `Mortal Kombat ${entities.mkVersion}`
    : "Mortal Kombat";
  const character = entities.hasGoro ? "Goro" : entities.primaryEntity ?? "esse personagem";

  const hook = entities.hasGoro
    ? pickVariant(
        [
          `${character} existe desde o primeiro Mortal Kombat de 1992 — e pouca gente sabe o quanto ele mudou.`,
          `Quatro bracos, presenca de chefe e um legado de mais de trinta anos: ${character} nao e so estetica.`,
          `No ${gameLabel}, ${character} carrega historia de franquia que a maioria dos players ignora.`
        ],
        seed,
        "hook"
      )
    : pickVariant(
        [
          `Esse momento de ${entities.subject} esconde um detalhe tecnico que muda a leitura do clip.`,
          `No ${gameLabel}, ${entities.subject} mostra uma camada que vai alem do highlight.`,
          `A maioria viu ${entities.subject} — quase ninguem percebeu o que aconteceu nos frames seguintes.`
        ],
        seed,
        "hook"
      );

  const context = entities.hasGoro
    ? pickVariant(
        [
          `O design de ${character} sempre foi sobre alcance: os quatro bracos alteram spacing, punishes e pressao no neutral.`,
          `Desde o arcade, ${character} foi pensado para intimidar no ritmo — nao apenas no dano.`,
          `No ${gameLabel}, a variacao Shokan de ${character} adiciona camadas de mix-up que veteranos exploram pouco.`
        ],
        seed,
        "context"
      )
    : pickVariant(
        [
          `Em jogos de luta, micro-detalhes de animacao e frame data mudam o resultado de um round inteiro.`,
          `O contexto do ${gameLabel} ajuda a entender por que esse clip viraliza: timing, spacing e decisao sob pressao.`,
          `O que parece sorte no highlight costuma ser setup repetido em treino e matchup study.`
        ],
        seed,
        "context"
      );

  const climax = entities.hasGoro
    ? pickVariant(
        [
          `O detalhe que poucos comentam: ${character} no ${gameLabel} pune agressividade mal calculada com grab range absurdo.`,
          `A curiosidade real esta no recurso de variacao — ele transforma matchup contra rushdown.`,
          `Quando o combo conecta, ${character} troca o ritmo da luta em um frame — e isso e o que separa clip de highlight de clip de conhecimento.`
        ],
        seed,
        "climax"
      )
    : pickVariant(
        [
          `E aqui o clip revela o detalhe: decisao correta no frame decisivo, nao apenas reacao bonita.`,
          `Esse e o instante em que mecanica e leitura de jogo aparecem juntas — por isso o momento gruda na memoria.`,
          `O climax nao e o golpe em si, e o contexto que mostra por que ele funcionou.`
        ],
        seed,
        "climax"
      );

  const cta = pickVariant(
    [
      `Voce maina ${character}? Comenta seu combo favorito.`,
      `Salva e comenta qual variacao voce usa no ${gameLabel}.`,
      `Quer mais breakdown de ${entities.subject}? Comenta.`
    ],
    seed,
    "cta"
  );

  return [
    { role: "hook", text: shortenForSpeech(hook, budget.hook), curiosityTag: "gaming-hook" },
    {
      role: "context",
      text: shortenForSpeech(context, budget.context),
      curiosityTag: "gaming-mechanic"
    },
    {
      role: "climax",
      text: shortenForSpeech(climax, budget.climax),
      curiosityTag: "gaming-climax"
    },
    { role: "cta", text: shortenForSpeech(cta, budget.cta), curiosityTag: "gaming-cta" }
  ];
}

function buildTrueCrimeEraBeats(
  entities: ReturnType<typeof extractTitleEntities>,
  seed: string,
  budget: NarrationContentContext["wordBudget"]
): Omit<NarrationBeatDraft, "caption">[] {
  const decade = entities.years[0] ?? "dessa epoca";
  const topic = entities.subject;

  const hook = pickVariant(
    [
      `Os anos ${decade} e ${topic} mudaram para sempre como o FBI perseguia assassinos em série.`,
      `Antes da internet, ${topic} já alimentava manchetes com camadas que shorts raramente mostram.`,
      `${topic} na década de ${decade}: o que os arquivos revelam vai além das manchetes.`
    ],
    seed,
    "hook"
  );

  const context = pickVariant(
    [
      `Em ${decade}, o FBI expandiu a Behavioral Science Unit e comecou a ligar padroes que antes pareciam casos isolados.`,
      `Arquivos jornalisticos da epoca mostram investigacoes lentas, telefonemas anônimos e evidencias forenses limitadas.`,
      `O contexto de ${topic} mistura panico publico, cobertura midiatica e investigacao ainda sem DNA como ferramenta padrao.`
    ],
    seed,
    "context"
  );

  const climax = pickVariant(
    [
      `O detalhe que poucos lembram: varios casos iconicos dessa decada so foram conectados anos depois pelo arquivo.`,
      `A curiosidade esta no metodo — como perfis, mapas e entrevistas transformaram caos em padrao investigavel.`,
      `Quando voce olha as datas e jurisdicoes, percebe quantos casos de ${topic} se cruzam de formas inesperadas.`
    ],
    seed,
    "climax"
  );

  const cta = pickVariant(
    [
      `Quer a timeline de ${topic}? Comenta.`,
      `Comenta se quer a parte 2 com arquivo.`,
      `Salva — a continuação entra nos casos da década.`
    ],
    seed,
    "cta"
  );

  return [
    {
      role: "hook",
      text: shortenForSpeech(hook, budget.hook),
      curiosityTag: "true-crime-era-hook"
    },
    {
      role: "context",
      text: shortenForSpeech(context, budget.context),
      curiosityTag: "true-crime-era-context"
    },
    {
      role: "climax",
      text: shortenForSpeech(climax, budget.climax),
      curiosityTag: "true-crime-era-climax"
    },
    { role: "cta", text: shortenForSpeech(cta, budget.cta), curiosityTag: "true-crime-cta" }
  ];
}

function buildSportsBeats(
  entities: ReturnType<typeof extractTitleEntities>,
  emotion: ProductionEmotion,
  seed: string,
  budget: NarrationContentContext["wordBudget"]
): Omit<NarrationBeatDraft, "caption">[] {
  const hook = pickVariant(
    [
      `${entities.subject} ainda gera debate entre quem viu ao vivo e quem so conhece o highlight.`,
      `Esse lance de ${entities.subject} parece simples — ate voce ver o contexto da partida.`,
      `Pouca gente lembra o que estava em jogo quando ${entities.subject} aconteceu.`
    ],
    seed,
    "hook"
  );

  const context = pickVariant(
    [
      `O placar, o minuto e a pressao do estadio mudam completamente a leitura do lance.`,
      `No arquivo, da para ver sinais antes do momento: posicionamento, marcacao e decisao tecnica.`,
      `O contexto tatico explica por que esse lance virou memoria coletiva — nao foi apenas talento isolado.`
    ],
    seed,
    "context"
  );

  const climax =
    emotion === "hype"
      ? pickVariant(
          [
            `E no frame decisivo a energia explode: timing perfeito, estadio inteiro no mesmo grito.`,
            `Esse e o instante que resume ${entities.subject} — quando habilidade e emocao colidem.`,
            `Aqui o hype deixa de ser nostalgia e vira prova de por que o momento entrou para a historia.`
          ],
          seed,
          "climax"
        )
      : pickVariant(
          [
            `O detalhe que separa lance bom de lance historico aparece nos segundos depois da jogada.`,
            `Quando voce pausa nesse instante, percebe a decisao que ninguem comentou ao vivo.`,
            `Esse frame fecha a narrativa de ${entities.subject} com clareza brutal.`
          ],
          seed,
          "climax"
        );

  const cta = pickVariant(
    [
      `Comenta de qual time voce torcia nesse jogo.`,
      `Salva e comenta se esse e o melhor lance de ${entities.subject}.`,
      `Quer mais contexto tatico? Comenta.`
    ],
    seed,
    "cta"
  );

  return [
    { role: "hook", text: shortenForSpeech(hook, budget.hook), curiosityTag: "sports-hook" },
    {
      role: "context",
      text: shortenForSpeech(context, budget.context),
      curiosityTag: "sports-context"
    },
    {
      role: "climax",
      text: shortenForSpeech(climax, budget.climax),
      curiosityTag: "sports-climax"
    },
    { role: "cta", text: shortenForSpeech(cta, budget.cta), curiosityTag: "sports-cta" }
  ];
}

function isTemplateSceneAngle(angle: string): boolean {
  return /^(gancho imediato|contexto editorial|prova visual|tens[aã]o narrativa|cl[ií]max|fechamento)/i.test(
    angle.trim()
  );
}

function isMetadataSummary(text: string): boolean {
  return /dom[ií]nio:|entidades:|a[cç][aã]o central:|plataforma:|tom:/i.test(text);
}

function distillThemeSummary(themeSummary: string, maxWords = 22): string | null {
  const cleaned = themeSummary
    .replace(/^Tema:\s*/i, "")
    .replace(/\.$/, "")
    .trim();

  if (!cleaned || isMetadataSummary(cleaned) || isOperationalText(cleaned)) {
    return null;
  }

  return shortenForSpeech(cleaned, maxWords);
}

function buildVideoAwareBeats(input: {
  hints: VideoNarrationHints;
  emotion: ProductionEmotion;
  seed: string;
  subject: string;
}): Omit<NarrationBeatDraft, "caption">[] {
  const lead = input.hints.entities?.[0] ?? input.subject;
  const action = input.hints.primaryAction ?? "momento de destaque";
  const domain = input.hints.domain ?? "generic";
  const matchedEntityId = Object.keys(ENTITY_CURIOSITY_FACTS).find((id) =>
    lead.toLowerCase().includes(id)
  );
  const curiosity = resolveCuriosityFact({
    entityId: matchedEntityId ?? null,
    domain,
    seed: input.seed,
    lead,
    action
  });

  const themeLine = input.hints.themeSummary
    ? distillThemeSummary(input.hints.themeSummary, 20)
    : input.hints.summary && !isMetadataSummary(input.hints.summary)
      ? shortenForSpeech(input.hints.summary, 20)
      : null;

  const hook = pickVariant(
    [
      input.hints.narrativeHook && !isOperationalText(input.hints.narrativeHook)
        ? spokenHookFromNarrativeHook(input.hints.narrativeHook)
        : null,
      input.hints.headline && !isObviousPhrase(input.hints.headline)
        ? `${input.hints.headline}. O vídeo resume demais.`
        : null,
      themeLine ? `${themeLine}. É por isso que esse corte prende.` : null,
      `${lead} no centro — e o short não perde tempo com rodeio.`
    ].filter((line): line is string => {
      if (!line) return false;
      return !isObviousPhrase(line);
    }),
    input.seed,
    "video-hook"
  );

  const context = pickVariant(
    [
      input.hints.narrativeBrief && !isMetadataSummary(input.hints.narrativeBrief)
        ? distillNarrativeBriefForSpeech(input.hints.narrativeBrief, 18)
        : null,
      themeLine ?? `Olha o que aconteceu antes de ${action.toLowerCase()}. O contexto muda tudo.`,
      domain === "sports"
        ? `Placar, marcação e ritmo${input.hints.setting ? ` em ${input.hints.setting}` : ""}. É isso que transforma ${action.toLowerCase()} em lance histórico.`
        : domain === "gaming"
          ? `No jogo, timing e leitura de matchup separam highlight de clip de conhecimento.`
          : domain === "comics_superhero"
            ? `A cena puxa painéis clássicos. Por isso o frame parece maior que alguns segundos.`
            : `O contexto dá peso ao instante. ${lead} deixa de ser só mais um corte.`
    ].filter(
      (line): line is string =>
        typeof line === "string" && line.length > 0 && !isMetadataSummary(line)
    ),
    input.seed,
    "video-context"
  );

  const tension = buildTensionBeatText({
    lead,
    secondaryEntity: input.hints.entities?.[1] ?? null,
    action,
    domain,
    emotion: input.emotion,
    angle: resolveNarrationVariationAngle({ domain, emotion: input.emotion }),
    seed: input.seed
  });

  const climaxCandidate =
    input.hints.curiosityAngle && hasConcreteCuriosity(input.hints.curiosityAngle)
      ? input.hints.curiosityAngle
      : curiosity;

  const climax = optimizeForSpokenDelivery(
    hasConcreteCuriosity(climaxCandidate)
      ? weaveCuriosityNaturally(
          climaxCandidate,
          lead,
          resolveNarrationVariationAngle({ domain, emotion: input.emotion })
        )
      : climaxCandidate
  );

  const cta = pickVariant(
    [
      domain === "sports"
        ? `Comenta de qual jogo você lembra quando vê ${lead}.`
        : domain === "gaming"
          ? `Salva e comenta seu main. Quer mais breakdown?`
          : `Comenta se você já sabia disso sobre ${lead}.`,
      `Salva o corte. Comenta o que mais te pegou.`,
      `Quer a parte 2? Comenta ${lead.split(" ")[0] ?? "aqui"}.`
    ],
    input.seed,
    "video-cta"
  );

  return [
    { role: "hook", text: hook, curiosityTag: "video-aware-hook" },
    { role: "context", text: context, curiosityTag: "video-aware-context" },
    { role: "tension", text: tension, curiosityTag: "video-aware-tension" },
    { role: "climax", text: climax, curiosityTag: "video-aware-curiosity" },
    { role: "cta", text: cta, curiosityTag: "video-aware-cta" }
  ];
}

export function reduceNarrationOverlap(
  beats: Array<Omit<NarrationBeatDraft, "caption">>,
  priorScripts: string[],
  seed: string
): Array<Omit<NarrationBeatDraft, "caption">> {
  if (priorScripts.length === 0) {
    return beats;
  }

  return beats.map((beat, beatIndex) => {
    const overlapsPrior = priorScripts.some((script) =>
      linesTooSimilar(beat.text, script, 0.42)
    );
    if (!overlapsPrior) {
      return beat;
    }

    const rewrites = [
      beat.text.replace(/^O clipe mostra/i, "Nesse recorte"),
      beat.text.replace(/^O vídeo/i, "Esse corte"),
      beat.text.replace(/^Nos quadrinhos/i, "Na HQ"),
      beat.text.replace(/^Venom/i, "Aqui, Venom"),
      beat.text.replace(/^Pouca gente liga/i, "O detalhe é"),
      `${beat.text.split(".")[0] ?? beat.text}. A leitura muda no remix.`
    ]
      .map((line) => optimizeForSpokenDelivery(line))
      .filter(
        (line) =>
          line.length > 12 &&
          !priorScripts.some((script) => linesTooSimilar(line, script, 0.42))
      );

    if (rewrites.length === 0) {
      return beat;
    }

    const text = pickVariant(rewrites, seed, `anti-overlap-${beat.role}-${beatIndex}`);
    return {
      ...beat,
      text,
      curiosityTag: `${beat.curiosityTag ?? beat.role}-alt`
    };
  });
}

export function buildRemixNarrationBeats(input: {
  title: string;
  themeSummary: string;
  contextKeywords: string[];
  contentIntelligence: RemixStructuredContentDescription;
  emotion: ProductionEmotion;
  seed: string;
  targetStyle?: RemixTargetStyle;
  variationIndex?: number;
}): Omit<NarrationBeatDraft, "caption">[] {
  const intel = input.contentIntelligence;
  const lead = intel.entities[0]?.name ?? sanitizeTitle(input.title);
  const secondaryEntity = intel.entities[1]?.name ?? null;
  const entityId = intel.entities[0]?.id ?? null;
  const action = intel.actions[0]?.label ?? "momento de destaque";
  const actionVerb = intel.actions[0]?.verb ?? "acontecer";
  const angle = resolveNarrationVariationAngle({
    ...(input.targetStyle ? { targetStyle: input.targetStyle, styleSlotIndex: 0 } : {}),
    ...(input.variationIndex !== undefined ? { variationIndex: input.variationIndex } : {}),
    domain: intel.domain,
    emotion: input.emotion
  });
  const hookPhrase = extractHookPhraseFromTitle(input.title);
  const curiosity = resolveCuriosityFact({
    entityId,
    domain: intel.domain,
    seed: `${input.seed}:${angle}`,
    lead,
    action
  });

  const sceneByRole = new Map(intel.sceneInsights.map((scene) => [scene.role, scene]));
  const hookScene = sceneByRole.get("hook");
  const contextScene = sceneByRole.get("context");
  const climaxScene = sceneByRole.get("climax") ?? sceneByRole.get("evidence");
  const themeLine = distillThemeSummary(input.themeSummary, 18);

  const hookCandidates: Array<string | null> = [];

  if (
    intel.narrativeHook &&
    !isOperationalText(intel.narrativeHook) &&
    (angle === "documentary_fact" || angle === "curiosity_led")
  ) {
    hookCandidates.push(spokenHookFromNarrativeHook(intel.narrativeHook));
  }

  const oralAction = oralizeActionLabel(action);

  const angleHooks: Record<NarrationVariationAngle, string[]> = {
    curiosity_led: [
      hookPhrase
        ? `${lead} e ${hookPhrase.toLowerCase()} — o vídeo inteiro gira em torno disso.`
        : `${lead} no centro, e o vídeo não perde tempo.`,
      secondaryEntity
        ? `Olha só: ${lead} e ${secondaryEntity} na mesma cena. Já prende.`
        : `Esse corte de ${lead} abre com ${actionVerb}. Direto ao ponto.`
    ],
    dark_reveal: [
      `Tem algo estranho nessa cena de ${lead}. O vídeo sabe disso.`,
      hookPhrase
        ? `"${hookPhrase}" soa pesado. ${lead} não está brincando aqui.`
        : `${lead} aparece, e o tom muda na hora.`
    ],
    emotional_bond: [
      secondaryEntity
        ? `Não é só ação. É ${lead} e ${secondaryEntity} num momento que parece íntimo.`
        : `Aqui ${lead} não luta. Conecta.`,
      hookPhrase
        ? `O vídeo vende ${hookPhrase.toLowerCase()}, e funciona.`
        : `${lead} num momento que parece pessoal, não só espetáculo.`
    ],
    fan_lore: [
      secondaryEntity
        ? `Quem curte ${lead} e ${secondaryEntity} saca esse encontro na hora.`
        : `Quem acompanha ${lead} sabe por que essa cena prende.`,
      hookPhrase
        ? `${hookPhrase} — clássico pra quem leu a história.`
        : `${lead} num momento que fã reconhece na hora.`
    ],
    hype_energy: [
      `${lead} entra no modo que o algoritmo ama. ${oralAction}.`,
      hookPhrase
        ? `${hookPhrase}! ${lead} no pico.`
        : `Energia alta, corte rápido, ${lead} no centro.`
    ],
    documentary_fact: [
      hookPhrase
        ? `Olha só: aparece ${lead} com essa ideia de ${hookPhrase.toLowerCase()}. Mas de onde isso veio?`
        : `Vamos entender o que ${lead} está fazendo nesse recorte.`,
      themeLine ?? `Esse corte de ${lead} precisa de contexto — não dá só pra reagir.`
    ]
  };

  const spokenActionVerb =
    actionVerb.charAt(0).toUpperCase() + actionVerb.slice(1).replace(/\s+\.\s*/g, "");

  hookCandidates.push(
    ...angleHooks[angle],
    hookScene?.visualHint?.includes("crop") &&
    (angle === "hype_energy" || angle === "curiosity_led" || angle === "fan_lore")
      ? `O corte abre colado em ${lead}. ${spokenActionVerb}, e já prende.`
      : null
  );

  const hook = pickVariant(
    hookCandidates.filter((line): line is string => {
      if (!line) return false;
      return !isObviousPhrase(line) && !isOperationalText(line);
    }),
    input.seed,
    `remix-hook-${angle}`
  );

  const angleContext: Record<NarrationVariationAngle, string[]> = {
    curiosity_led: [
      secondaryEntity
        ? `A dupla ${lead} e ${secondaryEntity} carrega história. O vídeo só mostra o encontro.`
        : `${lead} num contexto de ${oralAction} — o clipe só mostra o encontro.`,
      themeLine ?? `O vídeo resume ${oralAction}. A gente abre o que veio antes.`
    ],
    dark_reveal: [
      `Não é só ${oralAction} por acaso — tem intenção por trás disso.`,
      secondaryEntity
        ? `${lead} e ${secondaryEntity} juntos deixam a cena mais pesada.`
        : `${lead} num clima que o vídeo original não explica.`
    ],
    emotional_bond: [
      `Não é coincidência: ${oralAction} vende conexão, não só impacto.`,
      secondaryEntity
        ? `A química entre ${lead} e ${secondaryEntity} vem dos quadrinhos — o vídeo só dá uma pista.`
        : themeLine ?? `${lead} num momento que pede pra você sentir junto, não só reagir.`
    ],
    fan_lore: [
      intel.domain === "comics_superhero"
        ? `Isso aparece bastante nos quadrinhos — por isso a cena parece maior do que uns segundos.`
        : `Tem referência de fã escondida nesse corte. ${lead} carrega anos de história.`,
      secondaryEntity
        ? `Quando ${secondaryEntity} entra, a leitura de ${lead} muda completamente.`
        : (themeLine ?? `Pra entender ${lead} aqui, você precisa do olhar de fã.`)
    ],
    hype_energy: [
      intel.domain === "sports"
        ? `Placar, pressão e ritmo${intel.setting ? ` em ${intel.setting}` : ""}. O lance ganha escala.`
        : `Corte rápido, energia alta — ${lead} no momento que o vídeo quer viralizar.`,
      `${oralAction}. É isso que o vídeo quer que você sinta.`
    ],
    documentary_fact: [
      secondaryEntity
        ? `Nos quadrinhos, ${lead} e ${secondaryEntity} já dividiram cena assim — o vídeo só mostra um pedaço.`
        : `A origem desse momento com ${lead} está nos quadrinhos, não só no algoritmo.`,
      intel.domain === "gaming"
        ? `No jogo, ${actionVerb} costuma punir leitura errada. O highlight esconde o setup.`
        : `${oralAction} muda de peso quando você sabe o que veio antes.`
    ]
  };

  const contextCandidates: Array<string | null> = [...angleContext[angle]];

  if (
    contextScene?.narrationAngle &&
    !isTemplateSceneAngle(contextScene.narrationAngle) &&
    !isMetadataSummary(contextScene.narrationAngle)
  ) {
    contextCandidates.push(
      optimizeForSpokenDelivery(shortenForSpeech(contextScene.narrationAngle, 18))
    );
  }

  if (
    contextCandidates.length < 2 &&
    intel.narrativeBrief &&
    !isMetadataSummary(intel.narrativeBrief) &&
    (angle === "documentary_fact" || angle === "curiosity_led")
  ) {
    const brief = distillNarrativeBriefForSpeech(intel.narrativeBrief, 20);
    if (!linesTooSimilar(brief, hook)) {
      contextCandidates.push(brief);
    }
  }

  const context = pickVariant(
    contextCandidates.filter(
      (line): line is string =>
        typeof line === "string" &&
        line.length > 0 &&
        !isObviousPhrase(line) &&
        !isMetadataSummary(line)
    ),
    input.seed,
    `remix-context-${angle}`
  );

  const tension = buildTensionBeatText({
    lead,
    secondaryEntity,
    action,
    actionVerb,
    hookPhrase,
    domain: intel.domain,
    emotion: input.emotion,
    angle,
    seed: input.seed
  });

  const curiosityAngleUsable =
    angle === "documentary_fact" &&
    intel.curiosityAngle &&
    hasConcreteCuriosity(intel.curiosityAngle) &&
    !linesTooSimilar(intel.curiosityAngle, intel.narrativeHook ?? "") &&
    !linesTooSimilar(intel.curiosityAngle, intel.narrativeBrief ?? "");

  const rawClimax =
    curiosityAngleUsable
      ? intel.curiosityAngle
      : resolveCuriosityFact({
          entityId,
          domain: intel.domain,
          seed: `${input.seed}:${angle}:climax:${input.variationIndex ?? 0}`,
          lead,
          action
        });

  const climax = optimizeForSpokenDelivery(
    weaveCuriosityNaturally(
      hasConcreteCuriosity(rawClimax) ? rawClimax : curiosity,
      lead,
      angle
    )
  );

  const ctaByAngle: Record<NarrationVariationAngle, string[]> = {
    curiosity_led: [
      `Você já sabia disso sobre ${lead}? Comenta.`,
      secondaryEntity
        ? `Time ${lead} ou ${secondaryEntity}? Comenta sua dupla favorita.`
        : `Salva e comenta o que mais te pegou nesse corte.`
    ],
    dark_reveal: [
      `Isso te deixou inquieto? Comenta.`,
      `Salva — tem mais camada nessa história de ${lead}.`
    ],
    emotional_bond: [
      `Esse momento te emocionou? Comenta.`,
      secondaryEntity
        ? `Você shippa ${lead} e ${secondaryEntity}? Conta aí.`
        : `Comenta se ${lead} te pegou pelo sentimento, não só pela ação.`
    ],
    fan_lore: [
      `Fã de ${lead}? Comenta sua referência favorita.`,
      secondaryEntity
        ? `Qual dupla ${lead}/${secondaryEntity} você prefere? Comenta.`
        : `Salva pra assistir de novo com olhar de fã.`
    ],
    hype_energy: [
      intel.domain === "sports"
        ? `De qual jogo você lembra esse lance? Comenta.`
        : `Esse hype de ${lead} merece salvar. Comenta.`,
      `Comenta se ${lead} te deu arrepio nesse frame.`
    ],
    documentary_fact: [
      `Quer mais contexto sobre ${lead}? Comenta.`,
      `Salva e comenta — tem fonte por trás dessa cena.`
    ]
  };

  const cta = pickVariant(ctaByAngle[angle], input.seed, `remix-cta-${angle}`);

  return [
    { role: "hook", text: hook, curiosityTag: `remix-hook-${angle}` },
    { role: "context", text: context, curiosityTag: `remix-context-${angle}` },
    { role: "tension", text: tension, curiosityTag: `remix-tension-${angle}` },
    {
      role: "climax",
      text: climax,
      curiosityTag: hasConcreteCuriosity(climax) ? "remix-curiosity-fact" : `remix-climax-${angle}`
    },
    { role: "cta", text: cta, curiosityTag: `remix-cta-${angle}` }
  ];
}

function extractHookPhraseFromTitle(title: string): string | null {
  const cleaned = title
    .replace(/#[\p{L}\p{N}_]+/gu, " ")
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, " ")
    .replace(/!+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const partnership = cleaned.match(
    /(?:parceiro\s*perfeito|perfect\s*partner|dupla\s*perfeita|match\s*perfeito)/i
  );
  if (partnership) {
    return partnership[0]!.trim();
  }

  const found = cleaned.match(
    /(?:encontrou|achou|descobriu|revela|mostra)\s+(?:o|a|seu|sua)?\s*(.+?)(?:\s*[#@]|$)/i
  );
  return found?.[1]?.trim().slice(0, 48) ?? null;
}

function buildTitleDerivedBeats(
  entities: ReturnType<typeof extractTitleEntities>,
  emotion: ProductionEmotion,
  niche: MediaBeastNiche | "generic",
  seed: string,
  budget: NarrationContentContext["wordBudget"]
): Omit<NarrationBeatDraft, "caption">[] {
  const { subject, isQuestionTitle, primaryEntity, years } = entities;
  const focus = primaryEntity ?? subject;
  const yearHint = years[0] ? ` em ${years[0]}` : "";
  const matchedEntityId = Object.keys(ENTITY_CURIOSITY_FACTS).find((id) =>
    focus.toLowerCase().includes(id)
  );
  const curiosity = resolveCuriosityFact({
    entityId: matchedEntityId ?? null,
    domain: "generic",
    seed,
    lead: focus
  });

  const hook = isQuestionTitle
    ? pickVariant(
        [
          `${subject}? A resposta não está no título. Está no segundo anterior.`,
          `Todo mundo pergunta sobre ${subject}. Poucos ligam as pistas certas.`,
          `Essa pergunta sobre ${subject} só fecha com o contexto completo.`
        ],
        seed,
        "hook"
      )
    : pickVariant(
        [
          `${focus}${yearHint}. Na tela, você vê só a superfície.`,
          `Esse corte de ${focus} prende. O melhor vem no segundo seguinte.`,
          `Antes do clímax de ${focus}, tem um detalhe que muda tudo.`
        ],
        seed,
        "hook"
      );

  const nicheContext: Partial<Record<MediaBeastNiche | "generic", string[]>> = {
    true_crime: [
      `Datas, locais e depoimentos sobre ${focus} contam uma história que memes não carregam.`,
      `Arquivos jornalísticos mostram ${focus} com camadas que o algoritmo resume demais.`,
      `Investigações sobre ${focus} ganham outra dimensão quando você ordena os eventos na linha do tempo.`
    ],
    history: [
      `${focus}${yearHint} conecta política, cultura e consequências que ainda ecoam.`,
      `Documentos da época mostram como ${focus} foi vivido na hora — não como contamos hoje.`,
      `O que livros resumem em uma linha sobre ${focus} esconde um giro inesperado.`
    ],
    cinema: [
      `Por trás de ${focus}, uma decisão de direção mudou o tom do filme inteiro.`,
      `O que fica na memória em ${focus} costuma ser som, corte ou efeito prático — não CGI.`,
      `Fãs reconhecem ${focus}, mas o bastidor que o tornou icônico raramente aparece em shorts.`
    ],
    science_curiosities: [
      `A explicação de ${focus} parece simples até você ver o mecanismo por trás.`,
      `Em ciência, ${focus} esconde um princípio contraintuitivo que prende atenção.`,
      `O dado fascinante em ${focus} não é o óbvio — é a consequência que vem depois.`
    ],
    generic: [
      `O contexto muda quando você olha o que ficou fora do corte de ${focus}.`,
      `Conecte o que aparece na tela com o que aconteceu imediatamente antes.`,
      `Esse assunto ganha força quando a narração explica o instante, não repete o título.`
    ]
  };

  const context = pickVariant(
    nicheContext[niche] ?? nicheContext.generic!,
    seed,
    "context"
  );

  const climaxByEmotion: Record<ProductionEmotion, string[]> = {
    dark: [
      curiosity,
      `Agora o fato. ${focus} fecha o quebra-cabeça aqui.`,
      `Esse ponto transforma ${focus} em revelação.`
    ],
    hype: [
      curiosity,
      `Esse instante resume por que ${focus} virou inesquecível.`,
      `Aqui ${focus} atinge o pico. O frame explica o hype.`
    ],
    horror: [
      curiosity,
      `Quando esse detalhe entra, o clima de ${focus} muda.`,
      `A revelação sobre ${focus} é mais forte do que parece.`
    ],
    epic: [
      curiosity,
      `Esse instante define o legado de ${focus}.`,
      `Esse detalhe explica por que ${focus} ainda é referência.`
    ],
    curious: [
      curiosity,
      `Agora encaixa. ${focus} faz sentido por um motivo simples.`,
      `No fim, ${focus} surpreende por algo que estava na cara.`
    ],
    calm: [
      curiosity,
      `Esse ponto fecha ${focus} com clareza.`,
      `Esse detalhe amarra tudo sobre ${focus}.`
    ],
    tense: [
      curiosity,
      `Até que esse detalhe de ${focus} muda tudo.`,
      `Quando isso aparece, ${focus} deixa uma pergunta no ar.`
    ]
  };

  const climax = pickVariant(climaxByEmotion[emotion], seed, "climax");

  const cta = pickVariant(
    [
      `Comenta se você já conhecia essa camada sobre ${focus}.`,
      `Salva e comenta — tem mais contexto sobre ${focus}.`,
      `Quer a parte 2? Comenta aqui.`
    ],
    seed,
    "cta"
  );

  return [
    { role: "hook", text: hook, curiosityTag: "title-derived-hook" },
    { role: "context", text: context, curiosityTag: "title-derived-context" },
    {
      role: "climax",
      text: climax,
      curiosityTag: hasConcreteCuriosity(climax) ? "title-derived-fact" : "title-derived-climax"
    },
    { role: "cta", text: cta, curiosityTag: "title-derived-cta" }
  ];
}

export function buildNarrationContentContext(input: {
  candidate: MediaBeastCandidate;
  niche?: MediaBeastNiche | "generic";
  emotion: ProductionEmotion;
  durationSeconds: number;
  pacing: "tight" | "balanced" | "breathing";
  videoHints?: VideoNarrationHints | null;
}): NarrationContentContext {
  const entities = extractTitleEntities(input.candidate.title);
  const topicCase = detectTopicCase(input.candidate.title);
  const videoHints =
    input.videoHints ?? extractVideoHintsFromMetadata(input.candidate.metadata);
  const platformHint =
    typeof input.candidate.metadata.platform === "string"
      ? input.candidate.metadata.platform
      : typeof input.candidate.metadata.sourcePlatform === "string"
        ? input.candidate.metadata.sourcePlatform
        : null;

  let curiositySource = "title-derived";

  if (videoHints?.domain) {
    curiositySource = `video-context:${videoHints.domain}`;
  } else if (topicCase) {
    curiositySource = `topic-case:${topicCase.id}`;
  } else if (entities.hasGoro || entities.hasMortalKombat) {
    curiositySource = "gaming:mortal-kombat";
  } else if (entities.hasSerialKillers || entities.hasDecade) {
    curiositySource = "true-crime-era";
  } else if (entities.hasFootball || input.niche === "vintage_football") {
    curiositySource = "sports-highlight";
  } else if (input.niche === "true_crime" || input.niche === "history") {
    curiositySource = "niche-documentary";
  }

  const primaryEntity =
    videoHints?.entities?.[0] ?? entities.primaryEntity;

  return {
    subject: entities.subject,
    primaryEntity,
    secondaryEntities: videoHints?.entities?.slice(1) ?? entities.secondaryEntities,
    niche: input.niche ?? "generic",
    emotion: input.emotion,
    topicCase,
    curiositySource,
    years: entities.years,
    isQuestionTitle: entities.isQuestionTitle,
    platformHint,
    videoHints,
    wordBudget: buildWordBudget(input.durationSeconds, input.pacing),
    targetDurationSeconds: input.durationSeconds
  };
}

export function buildContextualNarrationBeats(input: {
  candidate: MediaBeastCandidate;
  niche?: MediaBeastNiche | "generic";
  emotion: ProductionEmotion;
  durationSeconds: number;
  pacing: "tight" | "balanced" | "breathing";
  seed: string;
  videoHints?: VideoNarrationHints | null;
}): NarrationBeatDraft[] {
  const context = buildNarrationContentContext(input);
  const entities = extractTitleEntities(input.candidate.title);

  let drafts: Omit<NarrationBeatDraft, "caption">[];

  if (context.videoHints?.entities?.length || context.videoHints?.domain) {
    drafts = buildVideoAwareBeats({
      hints: context.videoHints,
      emotion: input.emotion,
      seed: input.seed,
      subject: context.subject
    });
  } else if (context.topicCase) {
    drafts = buildTopicCaseBeats(context.topicCase, input.seed, context.wordBudget);
  } else if (entities.hasGoro || entities.hasMortalKombat) {
    drafts = buildGamingBeats(entities, input.seed, context.wordBudget);
  } else if (entities.hasSerialKillers || entities.hasDecade) {
    drafts = buildTrueCrimeEraBeats(entities, input.seed, context.wordBudget);
  } else if (
    entities.hasFootball ||
    input.niche === "vintage_football" ||
    input.niche === "bodybuilding"
  ) {
    drafts = buildSportsBeats(entities, input.emotion, input.seed, context.wordBudget);
  } else {
    drafts = buildTitleDerivedBeats(
      entities,
      input.emotion,
      input.niche ?? "generic",
      input.seed,
      context.wordBudget
    );
  }

  const finalizeOptions: {
    emotion: ProductionEmotion;
    lead: string;
    seed: string;
    action?: string;
    domain?: RemixContentDomain;
  } = {
    emotion: input.emotion,
    lead: context.primaryEntity ?? context.subject,
    seed: input.seed
  };
  if (context.videoHints?.primaryAction) {
    finalizeOptions.action = context.videoHints.primaryAction;
  }
  if (context.videoHints?.domain) {
    finalizeOptions.domain = context.videoHints.domain;
  }

  return finalizeNarrationBeats(drafts, context.wordBudget, context.subject, finalizeOptions);
}

export function beatsToScript(beats: NarrationBeatDraft[]): string {
  return beats
    .map((beat) => beat.text)
    .filter((line) => line.length > 0)
    .join("\n");
}

export function estimateScriptDurationSeconds(
  script: string,
  pacing: "tight" | "balanced" | "breathing"
): number {
  const words = script.split(/\s+/).filter(Boolean).length;
  const punctuationPauses = (script.match(/[.!?]/g) ?? []).length * 0.15;
  return Math.max(words / estimateWordsPerSecond(pacing) + punctuationPauses, 4);
}

export function buildNarrationVoiceVariations(input: {
  voicePackId: string;
  channelTone: string;
  emotion: ProductionEmotion;
  pacing: "tight" | "balanced" | "breathing";
  beats: NarrationBeatDraft[];
  script: string;
}) {
  const basePlan = buildNarrationPlan({
    voicePackId: input.voicePackId,
    text: input.script,
    language: "pt-BR"
  });

  const pacingRates = {
    tight: [6, 1, 3, 8, 2],
    balanced: [4, 0, 2, 6, 0],
    breathing: [2, -1, 0, 4, -2]
  } as const;

  const rates = pacingRates[input.pacing];
  const variationIds = [
    "hook-attack",
    "context-flow",
    "tension-pivot",
    "climax-reveal",
    "cta-soft"
  ];
  const durationWeights = [0.18, 0.22, 0.12, 0.3, 0.18];

  return input.beats.map((beat, index) => ({
    variationId: variationIds[index] ?? `beat-${index + 1}`,
    voicePackId: input.voicePackId,
    tone: beat.prosody?.tone ?? `${input.channelTone} ${beat.role}`,
    emotion: `${input.emotion}_${beat.role}`,
    pacing: input.pacing,
    rateShift: rates[index] ?? 0,
    emphasis: beat.role,
    line: beat.text,
    curiosityTag: beat.curiosityTag,
    pauseBeforeMs: beat.prosody?.pauseBeforeMs ?? 0,
    energy: beat.prosody?.energy ?? "medium",
    emphasisWords: beat.prosody?.emphasisWords ?? [],
    deliveryNote: beat.prosody?.deliveryNote ?? "",
    estimatedDurationSeconds: Math.max(
      basePlan.estimatedDurationSeconds * (durationWeights[index] ?? 0.18),
      beat.role === "cta" ? 1.4 : beat.role === "tension" ? 1.8 : 2.2
    )
  }));
}

export function buildNarrationEnginePrompt(input: {
  beats: NarrationBeatDraft[];
  context: NarrationContentContext;
  channelTone: string;
  voicePackName: string;
  language: string;
  pacing: "tight" | "balanced" | "breathing";
  estimatedDurationSeconds: number;
}): string {
  const beatMap = input.beats
    .map((beat) => {
      const prosody = beat.prosody;
      const direction = prosody
        ? `[${prosody.energy} | pausa ${prosody.pauseBeforeMs}ms | ${prosody.deliveryNote}]`
        : "";
      return `${beat.role.toUpperCase()} ${direction}\n${beat.text}`;
    })
    .join("\n\n");

  const pacingGuide =
    input.pacing === "tight"
      ? "Fala rápida, frases de 6-10 palavras, ataque imediato no hook."
      : input.pacing === "breathing"
        ? "Fala pausada, micro-pausas entre frases, tom contemplativo."
        : "Fala equilibrada, ritmo de documentário moderno, sem correria.";

  const emotionGuide: Partial<Record<ProductionEmotion, string>> = {
    dark: "Tom sombrio e contido. Pausas antes de revelações.",
    hype: "Energia alta no hook e clímax. Aceleração controlada.",
    horror: "Sussurro tenso, pausas longas, frases curtíssimas.",
    epic: "Voz segura e grandiosa, sem teatralidade excessiva.",
    curious: "Tom de conversa inteligente, como quem conta um segredo.",
    calm: "Didático e sereno, uma ideia por frase.",
    tense: "Pressão crescente do hook ao clímax."
  };

  return [
    "=== NARRATION ENGINE DIRECTIVE ===",
    `Idioma: ${input.language}.`,
    `Tom do canal: ${input.channelTone}.`,
    `Emoção de produção: ${emotionGuide[input.context.emotion] ?? input.context.emotion}.`,
    `Voice pack: ${input.voicePackName}.`,
    `Duração alvo: ${input.context.targetDurationSeconds}s (estimativa: ${input.estimatedDurationSeconds.toFixed(1)}s).`,
    pacingGuide,
    "",
    "=== REGRAS DE FALA (OBRIGATÓRIO) ===",
    "Escreva e narre como TEXTO PARA FALA, não para leitura.",
    "Frases curtas. Uma ideia por período. Evite subordinadas longas.",
    "Use ritmo oral: pausa antes do clímax, leve aceleração na tensão.",
    "Curiosidade no clímax deve soar natural — como dado contado, não enciclopédia.",
    "Evite linguagem de roteiro escrito: frame, beat, escolha narrativa, inspiram esse frame.",
    "Prefira fala coloquial brasileira: olha só, saca, a galera, nos quadrinhos, o vídeo.",
    "Depois da primeira menção, use pronomes (ele, ela, isso) em vez de repetir nomes.",
    "",
    "=== CONTEÚDO ===",
    `Assunto: ${input.context.subject}`,
    `Entidade: ${input.context.primaryEntity ?? "n/a"}`,
    `Fonte: ${input.context.curiositySource}`,
    input.context.years.length > 0 ? `Período: ${input.context.years.join(", ")}` : null,
    "",
    "=== BEAT MAP + PROSÓDIA ===",
    "HOOK: gancho imediato, energia alta.",
    "CONTEXT: situa o espectador, tom explicativo.",
    "TENSION: virada narrativa, micro-pausa, suspense.",
    "CLIMAX: fato surpreendente, ênfase em números e nomes.",
    "CTA: convite leve, tom de pergunta.",
    "",
    beatMap,
    "",
    "=== SCRIPT FINAL (NARRAR APENAS ISTO — SEM METADADOS) ===",
    beatsToScript(input.beats),
    "",
    "=== PROIBIDO NO ÁUDIO ===",
    "Não narre avisos legais, instruções de sistema, metadados ou notas de produção.",
    "Não mencione aprovação manual, direitos, discovery ou termos de pipeline.",
    "Não use clichês: 'pouca gente sabe', 'detalhe intrigante', 'recorte editorial'.",
    "Não leia colchetes de prosódia em voz alta — são direção de entrega apenas."
  ]
    .filter((line): line is string => Boolean(line))
    .join("\n");
}