import { detectTopicCase, type TopicCaseBrief } from "../editorial/topic-knowledge.js";
import type { MediaBeastCandidate } from "../providers/types.js";
import type { MediaBeastNiche } from "../providers/types.js";
import type {
  RemixContentDomain,
  RemixStructuredContentDescription
} from "./remix-content-intelligence.js";
import type { ProductionEmotion } from "./niche-production-profiles.js";

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
  /manual license review/i
];

export interface NarrationBeatDraft {
  role: "hook" | "context" | "climax" | "cta";
  text: string;
  caption: string;
  curiosityTag: string;
}

export interface VideoNarrationHints {
  domain?: RemixContentDomain;
  headline?: string;
  summary?: string;
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
  wordBudget: Record<"hook" | "context" | "climax" | "cta", number>;
  targetDurationSeconds: number;
}

const ENTITY_CURIOSITY_FACTS: Record<string, string[]> = {
  messi: [
    "Messi mede 1,70 m e ainda assim ganha duelos porque lê o quadril do marcador antes de acelerar.",
    "Ele faz o gol parecer improviso, mas o toque nasce de um hábito raro: olhar o pé de apoio do adversário.",
    "A curiosidade é biomecânica: passos curtos e centro de gravidade baixo comprimem o tempo de reação do zagueiro."
  ],
  ronaldo: [
    "CR7 treina cabeceio com salto vertical acima de 70 cm — por isso o timing no ar parece fora do comum.",
    "O detalhe pouco comentado: ele ajusta a corrida de aproximação para chegar no ponto exato do cruzamento.",
    "Muitos veem força bruta; o segredo está na leitura do espaço entre marcação e goleiro."
  ],
  neymar: [
    "Neymar troca de ritmo com o ombro antes do pé — o marcador reage ao movimento errado.",
    "O drible que viraliza costuma nascer de um toque de sola, não de velocidade pura.",
    "Ele usa o corpo como isca: o passe sai no meio da finta, quando a defesa já se comprometeu."
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
    "O momento icônico no filme quase sempre paga dívida com um painel clássico dos quadrinhos.",
    "Diretores costumam esconder referências visuais que só fãs de HQ reconhecem no frame.",
    "A cena que viraliza raramente é CGI puro — é quando ator, luz e composição copiam a página original."
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
    "O detalhe que separa um short genérico de um memorável quase nunca está no título.",
    "Quem entende o contexto antes do clímax percebe camadas que a maioria ignora.",
    "A surpresa real está no que acontece um segundo antes do momento que todo mundo compartilha."
  ]
};

const OBVIOUS_PHRASE_PATTERNS = [
  /o detalhe mais intrigante/i,
  /pouca gente sabe/i,
  /poucos sabem/i,
  /quase ninguem/i,
  /camada que shorts costumam ignorar/i,
  /muda a leitura inteira/i,
  /no feed/i,
  /remix gen[eé]rico/i,
  /recorte editorial do short/i,
  /viralizou no clipe/i
];

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

export function shortenForSpeech(text: string, maxWords: number): string {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) {
    return text.trim();
  }

  const trimmed = words.slice(0, maxWords).join(" ");
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

export function polishPtBrNarration(text: string): string {
  return text
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
    .trim();
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
  subject: string
): NarrationBeatDraft[] {
  const polished = drafts.map((draft) => {
    const sanitized = sanitizeNarrationLine(polishPtBrNarration(draft.text));
    const maxWords = budget[draft.role];
    const text =
      countWords(sanitized) > maxWords
        ? shortenForSpeech(sanitized, maxWords)
        : sanitized;

    return {
      ...draft,
      text,
      caption: buildCaptionFromLine(text)
    };
  });

  return reduceSubjectRepetition(polished, subject);
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
): Record<"hook" | "context" | "climax" | "cta", number> {
  const fillRatio = options?.fillRatio ?? 0.9;
  const minTotalWords =
    options?.minTotalWords ?? Math.max(Math.round(durationSeconds * 1.75), 28);

  const totalWords = Math.max(
    Math.round(durationSeconds * estimateWordsPerSecond(pacing) * fillRatio),
    minTotalWords
  );

  return {
    hook: Math.max(Math.round(totalWords * 0.22), 10),
    context: Math.max(Math.round(totalWords * 0.34), 14),
    climax: Math.max(Math.round(totalWords * 0.28), 12),
    cta: Math.max(Math.round(totalWords * 0.16), 6)
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
      `Sobre ${topic}, pouca gente conecta a onda de casos a mudancas reais nas investigacoes.`,
      `Os anos ${decade} e ${topic} mudaram para sempre como o FBI perseguia assassinos em serie.`,
      `Antes da internet, ${topic} ja alimentava manchetes com camadas que shorts raramente mostram.`
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
      input.hints.headline && !isObviousPhrase(input.hints.headline)
        ? `${input.hints.headline} — e o clipe só mostra metade disso.`
        : null,
      `Esse trecho com ${lead} prende porque antecipa ${action.toLowerCase()} antes da maioria perceber.`,
      `A câmera foca em ${lead}, mas o que importa acontece um segundo antes do que todo mundo compartilha.`,
      themeLine ? `${themeLine} — e é isso que muda a leitura do vídeo.` : null
    ].filter((line): line is string => Boolean(line)),
    input.seed,
    "video-hook"
  );

  const context = pickVariant(
    [
      themeLine ?? `O contexto de ${action.toLowerCase()} muda quando você olha o que ficou fora do corte.`,
      domain === "sports"
        ? `Placar, marcação e ritmo do jogo explicam por que ${action.toLowerCase()} virou memória coletiva.`
        : domain === "gaming"
          ? `No gameplay, timing e leitura de matchup transformam highlight em clip de conhecimento.`
          : domain === "comics_superhero"
            ? `A cena remete a painéis clássicos — por isso o frame parece maior do que alguns segundos.`
            : `O pano de fundo editorial dá peso ao instante e evita que ${lead} vire só mais um corte.`,
      input.hints.mood
        ? `Tom do recorte: ${input.hints.mood}. Isso orienta como o espectador deve sentir o clímax.`
        : `Conecte o que aparece na tela com o que aconteceu imediatamente antes deste trecho.`
    ],
    input.seed,
    "video-context"
  );

  const climax = hasConcreteCuriosity(curiosity)
    ? curiosity
    : pickVariant(
        [
          curiosity,
          `E aqui entra a curiosidade: ${curiosity.charAt(0).toLowerCase()}${curiosity.slice(1)}`
        ],
        input.seed,
        "video-climax"
      );

  const cta = pickVariant(
    [
      domain === "sports"
        ? `Comenta de qual jogo ou lance você lembra quando vê ${lead}.`
        : domain === "gaming"
          ? `Salva e comenta seu main — quer mais breakdown assim?`
          : `Comenta se você já conhecia essa camada sobre ${lead}.`,
      `Salva este corte e comenta o que mais te surpreendeu.`,
      `Quer a continuação? Comenta ${lead.split(" ")[0] ?? "aqui"}.`
    ],
    input.seed,
    "video-cta"
  );

  return [
    { role: "hook", text: hook, curiosityTag: "video-aware-hook" },
    { role: "context", text: context, curiosityTag: "video-aware-context" },
    { role: "climax", text: climax, curiosityTag: "video-aware-curiosity" },
    { role: "cta", text: cta, curiosityTag: "video-aware-cta" }
  ];
}

export function buildRemixNarrationBeats(input: {
  title: string;
  themeSummary: string;
  contextKeywords: string[];
  contentIntelligence: RemixStructuredContentDescription;
  emotion: ProductionEmotion;
  seed: string;
}): Omit<NarrationBeatDraft, "caption">[] {
  const intel = input.contentIntelligence;
  const lead = intel.entities[0]?.name ?? sanitizeTitle(input.title);
  const entityId = intel.entities[0]?.id ?? null;
  const action = intel.actions[0]?.label ?? "momento de destaque";
  const actionVerb = intel.actions[0]?.verb ?? "acontecer";
  const rawKeyword = input.contextKeywords[0] ?? intel.entities[0]?.franchise ?? lead;
  const keyword =
    rawKeyword.toLowerCase() === lead.toLowerCase()
      ? (intel.entities[0]?.franchise ?? "campo")
      : rawKeyword;
  const curiosity = resolveCuriosityFact({
    entityId,
    domain: intel.domain,
    seed: input.seed,
    lead,
    action
  });

  const sceneByRole = new Map(intel.sceneInsights.map((scene) => [scene.role, scene]));
  const hookScene = sceneByRole.get("hook");
  const contextScene = sceneByRole.get("context");
  const climaxScene = sceneByRole.get("climax") ?? sceneByRole.get("evidence");

  const hook = pickVariant(
    [
      hookScene?.visualHint?.includes("crop")
        ? `O corte abre em ${lead} no instante exato em que ${actionVerb} — e já prende.`
        : null,
      intel.headline.length > 12
        ? `${intel.headline}. O vídeo original não explica por que isso funciona.`
        : null,
      `Esse trecho com ${lead} parece simples — até você ver o que acontece antes de ${actionVerb}.`,
      `A maioria assiste ${action.toLowerCase()} e ignora o detalhe que faz ${lead} viralizar de novo.`
    ].filter((line): line is string => Boolean(line)),
    input.seed,
    "remix-hook"
  );

  const themeLine = distillThemeSummary(input.themeSummary, 24);

  const context = pickVariant(
    [
      intel.domain === "sports"
        ? `O lance só faz sentido com pressão, marcação e o ritmo da partida em ${keyword}.`
        : intel.domain === "comics_superhero"
          ? `A cena remete a painéis clássicos — por isso o frame parece icônico em poucos segundos.`
          : intel.domain === "gaming"
            ? `No jogo, ${actionVerb} costuma punir um erro de leitura que o highlight esconde.`
            : `O recorte liga ${lead} a ${keyword} sem repetir o que o clipe já mostra na tela.`,
      themeLine,
      intel.summary && !isMetadataSummary(intel.summary)
        ? shortenForSpeech(intel.summary.replace(/^Domínio:\s*/i, ""), 24)
        : null,
      contextScene?.narrationAngle && !isTemplateSceneAngle(contextScene.narrationAngle)
        ? shortenForSpeech(
            contextScene.narrationAngle.replace(/^[^:]+:\s*/i, ""),
            24
          )
        : null
    ].filter(
      (line): line is string =>
        typeof line === "string" && line.length > 0 && !isObviousPhrase(line)
    ),
    input.seed,
    "remix-context"
  );

  const climaxCandidates = [
    curiosity,
    climaxScene?.focusAction && !hasConcreteCuriosity(curiosity)
      ? `No pico do ${climaxScene.focusAction.toLowerCase()}, ${curiosity.charAt(0).toLowerCase()}${curiosity.slice(1)}`
      : null
  ].filter((line): line is string => Boolean(line));

  const climax = pickVariant(climaxCandidates, input.seed, "remix-climax");

  const cta = pickVariant(
    [
      intel.domain === "sports"
        ? `Comenta se você lembra em qual jogo ${lead} fez isso.`
        : intel.domain === "gaming"
          ? `Salva e comenta — quer mais breakdown de ${lead}?`
          : `Comenta se essa camada sobre ${lead} te surpreendeu.`,
      `Salva o corte e comenta o que mais te pegou.`,
      `Quer a parte 2? Comenta ${lead.split(" ")[0] ?? keyword}.`
    ],
    input.seed,
    "remix-cta"
  );

  return [
    { role: "hook", text: hook, curiosityTag: "remix-hook" },
    { role: "context", text: context, curiosityTag: "remix-context" },
    {
      role: "climax",
      text: climax,
      curiosityTag: hasConcreteCuriosity(climax) ? "remix-curiosity-fact" : "remix-climax"
    },
    { role: "cta", text: cta, curiosityTag: "remix-cta" }
  ];
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
          `${subject} — a resposta não está no título, está no que acontece antes do clímax.`,
          `Todo mundo pergunta sobre ${subject}; poucos conectam as pistas certas.`,
          `Essa pergunta sobre ${subject} só fecha quando você vê o contexto completo.`
        ],
        seed,
        "hook"
      )
    : pickVariant(
        [
          `${focus}${yearHint}: o que a tela mostra é só a superfície.`,
          `Esse recorte de ${focus} funciona porque antecipa a explicação antes do espectador desistir.`,
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
      `E aqui ${focus} revela o fato que fecha o quebra-cabeça.`,
      `Esse ponto transforma ${focus} de curiosidade em revelação.`
    ],
    hype: [
      curiosity,
      `Esse instante resume por que ${focus} virou momento inesquecível.`,
      `Aqui ${focus} atinge o pico — e o frame explica o hype.`
    ],
    horror: [
      curiosity,
      `Quando esse detalhe entra, o clima de ${focus} muda completamente.`,
      `A revelação sobre ${focus} é mais perturbadora do que parece à primeira vista.`
    ],
    epic: [
      curiosity,
      `Esse instante define o legado de ${focus}.`,
      `Esse detalhe explica por que ${focus} ainda é referência hoje.`
    ],
    curious: [
      curiosity,
      `E aqui a explicação de ${focus} finalmente encaixa.`,
      `No fim, ${focus} faz sentido por um motivo mais simples do que parece.`
    ],
    calm: [
      curiosity,
      `Esse ponto fecha a explicação de ${focus} com clareza.`,
      `Esse detalhe amarra o raciocínio inteiro sobre ${focus}.`
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

  return finalizeNarrationBeats(drafts, context.wordBudget, context.subject);
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
    .map((beat) => `${beat.role.toUpperCase()}: ${beat.text}`)
    .join("\n");

  const pacingGuide =
    input.pacing === "tight"
      ? "Entrega rapida, frases curtas, ataque imediato no hook."
      : input.pacing === "breathing"
        ? "Entrega pausada, micro-pausas entre ideias, tom contemplativo."
        : "Entrega equilibrada, fluidez documental, sem correria.";

  return [
    "=== NARRATION ENGINE DIRECTIVE ===",
    `Idioma: ${input.language}.`,
    `Tom do canal: ${input.channelTone}.`,
    `Voice pack: ${input.voicePackName}.`,
    `Duracao alvo: ${input.context.targetDurationSeconds}s (estimativa atual: ${input.estimatedDurationSeconds.toFixed(1)}s).`,
    pacingGuide,
    "",
    "=== CONTEUDO (100% CONTEXTUAL) ===",
    `Assunto: ${input.context.subject}`,
    `Entidade principal: ${input.context.primaryEntity ?? "n/a"}`,
    `Fonte de curiosidade: ${input.context.curiositySource}`,
    input.context.years.length > 0
      ? `Periodo: ${input.context.years.join(", ")}`
      : null,
    "",
    "=== BEAT MAP (VARIACOES DISTINTAS) ===",
    beatMap,
    "",
    "=== SCRIPT FINAL (NARRAR APENAS ISTO) ===",
    beatsToScript(input.beats),
    "",
    "=== PROIBIDO NO AUDIO ===",
    "Nao narre avisos legais, instrucoes de sistema, metadados, notas de producao ou frases administrativas.",
    "Nao mencione aprovacao manual, direitos autorais, discovery ou termos tecnicos de pipeline.",
    "Narre como narrador humano de shorts premium: natural, fluido, com ritmo de conversa e uma curiosidade concreta no clímax.",
    "Varie o sujeito com pronomes depois da primeira menção — não repita o título em todo beat.",
    "Não use frases genéricas tipo 'pouca gente sabe' ou 'detalhe mais intrigante'."
  ]
    .filter((line): line is string => Boolean(line))
    .join("\n");
}