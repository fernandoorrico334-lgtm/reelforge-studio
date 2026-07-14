export type NarrationRetentionSubject =
  | "comics_anime_filmes"
  | "tecnologia_ia"
  | "historia_curiosidades"
  | "juridico_bancario"
  | "produto_review"
  | "noticia_polemica"
  | "misterio_terror"
  | "generico";

export type RetentionBeatRole =
  | "hook"
  | "promise_context"
  | "curiosity"
  | "development"
  | "climax_reveal"
  | "loop_closing";

export type NarrationVariantAngle =
  | "factual_documental"
  | "fan_lore"
  | "suspense_reveal"
  | "simple_explanatory"
  | "controlled_controversy"
  | "quick_curiosity";

export interface NarrationStylePack {
  subject: NarrationRetentionSubject;
  label: string;
  narrativeTone: string;
  allowedHookTypes: string[];
  forbiddenPhrases: string[];
  idealPace: "slow" | "medium" | "fast" | "variable";
  openingExamples: string[];
  closingExamples: string[];
  energyLevel: "low" | "medium" | "high" | "peak";
  curiosityType: string;
}

export const GLOBAL_FORBIDDEN_CLICHES: string[] = [
  "você não vai acreditar",
  "ninguém percebeu",
  "simplesmente",
  "insano",
  "absurdo",
  "galera",
  "mano",
  "frame",
  "beat",
  "escolha narrativa",
  "inspira esse frame",
  "paga uma dívida com os fãs",
  "paga uma divida com os fas"
];

export const RETENTION_BEAT_TIMINGS: Record<
  RetentionBeatRole,
  { startSec: number; endSec: number; retentionGoal: string }
> = {
  hook: {
    startSec: 0,
    endSec: 2,
    retentionGoal: "Parar o scroll nos primeiros 2 segundos com promessa concreta"
  },
  promise_context: {
    startSec: 2,
    endSec: 6,
    retentionGoal: "Validar o gancho e prometer o que o espectador vai ganhar"
  },
  curiosity: {
    startSec: 6,
    endSec: 14,
    retentionGoal: "Abrir lacuna de informação que exige continuar assistindo"
  },
  development: {
    startSec: 14,
    endSec: 24,
    retentionGoal: "Entregar contexto denso sem repetir o visual"
  },
  climax_reveal: {
    startSec: 24,
    endSec: 35,
    retentionGoal: "Pagar a curiosidade com revelação ou dado surpreendente"
  },
  loop_closing: {
    startSec: 35,
    endSec: 45,
    retentionGoal: "Fechar com loop narrativo que convida a reassistir ou comentar"
  }
};

export const NARRATION_STYLE_PACKS: Record<NarrationRetentionSubject, NarrationStylePack> = {
  comics_anime_filmes: {
    subject: "comics_anime_filmes",
    label: "Quadrinhos, anime e filmes",
    narrativeTone: "entusiasta de fã, referências visuais, tom cinematográfico leve",
    allowedHookTypes: [
      "referência de HQ",
      "confronto icônico",
      "detalhe que fã reconhece",
      "origem do personagem"
    ],
    forbiddenPhrases: [...GLOBAL_FORBIDDEN_CLICHES, "no feed", "viralizou no clipe"],
    idealPace: "fast",
    openingExamples: [
      "Quem leu a história sabe por que essa cena pesa mais do que parece.",
      "Esse encontro não é só efeito — vem direto dos quadrinhos.",
      "Olha o detalhe na abertura: já é referência de fã."
    ],
    closingExamples: [
      "Repara de novo na abertura — agora o encontro faz outro sentido.",
      "Volta no começo e vê o mesmo gesto com outro peso.",
      "Comenta qual referência você pegou nessa cena."
    ],
    energyLevel: "high",
    curiosityType: "lore e referência visual"
  },
  tecnologia_ia: {
    subject: "tecnologia_ia",
    label: "Tecnologia e IA",
    narrativeTone: "didático, preciso, sem hype vazio, analogias simples",
    allowedHookTypes: [
      "mudança prática no dia a dia",
      "número ou limite surpreendente",
      "erro comum explicado",
      "comparação antes/depois"
    ],
    forbiddenPhrases: [...GLOBAL_FORBIDDEN_CLICHES, "revolucionário", "disruptivo"],
    idealPace: "medium",
    openingExamples: [
      "Essa ferramenta muda uma tarefa que você faz todo dia — em segundos.",
      "A IA não faz mágica aqui. Ela resolve um gargalo específico.",
      "O detalhe técnico que explica por que isso funciona agora."
    ],
    closingExamples: [
      "Testa isso no seu fluxo e vê onde economiza tempo de verdade.",
      "Salva pra comparar com o que você usa hoje.",
      "Comenta se isso já entrou na sua rotina."
    ],
    energyLevel: "medium",
    curiosityType: "mecanismo e impacto prático"
  },
  historia_curiosidades: {
    subject: "historia_curiosidades",
    label: "História e curiosidades",
    narrativeTone: "documental leve, fatos datados, narrativa de descoberta",
    allowedHookTypes: [
      "data ou número marcante",
      "detalhe esquecido",
      "contraste época atual",
      "pergunta histórica"
    ],
    forbiddenPhrases: [...GLOBAL_FORBIDDEN_CLICHES, "pouca gente sabe", "segredo obscuro"],
    idealPace: "medium",
    openingExamples: [
      "Em 1987, um detalhe pequeno mudou como a gente lembra esse evento.",
      "O registro oficial conta uma versão — o arquivo guarda outra.",
      "Parece anedota, mas explica um hábito que ainda existe."
    ],
    closingExamples: [
      "Volta na data do começo — agora a sequência fecha.",
      "Procura esse nome nos livros de história e vê o que mudou.",
      "Comenta qual parte você nunca tinha ouvido falar."
    ],
    energyLevel: "medium",
    curiosityType: "fato datado e contexto esquecido"
  },
  juridico_bancario: {
    subject: "juridico_bancario",
    label: "Jurídico e bancário",
    narrativeTone: "claro, cauteloso, sem alarmismo, foco em direito do consumidor",
    allowedHookTypes: [
      "direito que poucos usam",
      "prazo que vence",
      "cláusula escondida",
      "erro do banco explicado"
    ],
    forbiddenPhrases: [...GLOBAL_FORBIDDEN_CLICHES, "golpe garantido", "processo fácil"],
    idealPace: "slow",
    openingExamples: [
      "Se o banco fez isso, você pode ter um direito que ninguém te explicou.",
      "Essa cláusula parece técnica — mas muda quanto você paga.",
      "Antes de assinar, vale entender o que a lei protege aqui."
    ],
    closingExamples: [
      "Guarda o comprovante e confere o prazo que a lei dá.",
      "Se isso aconteceu com você, anota a data e busca orientação.",
      "Comenta se já passou por situação parecida."
    ],
    energyLevel: "low",
    curiosityType: "direito aplicável e risco evitável"
  },
  produto_review: {
    subject: "produto_review",
    label: "Produto e review",
    narrativeTone: "honesto, sensorial, comparativo, foco em resultado",
    allowedHookTypes: [
      "resultado em X dias",
      "erro de uso comum",
      "comparação com alternativa",
      "teste real sem filtro"
    ],
    forbiddenPhrases: [...GLOBAL_FORBIDDEN_CLICHES, "milagre", "transformação instantânea"],
    idealPace: "fast",
    openingExamples: [
      "Usei por duas semanas — o resultado não é o que o anúncio promete.",
      "O erro que quase todo mundo comete na primeira aplicação.",
      "Antes de comprar, olha o que muda na prática no cabelo."
    ],
    closingExamples: [
      "Testa no seu tipo de cabelo e compara com o que você usa.",
      "Salva pra lembrar na hora da compra.",
      "Comenta se funcionou no seu caso."
    ],
    energyLevel: "high",
    curiosityType: "resultado real e uso correto"
  },
  noticia_polemica: {
    subject: "noticia_polemica",
    label: "Notícia e polêmica",
    narrativeTone: "imparcial, fatos primeiro, tensão controlada",
    allowedHookTypes: [
      "fato que divide opinião",
      "consequência imediata",
      "o que mudou depois",
      "pergunta aberta"
    ],
    forbiddenPhrases: [...GLOBAL_FORBIDDEN_CLICHES, "escândalo bombástico", "caos total"],
    idealPace: "variable",
    openingExamples: [
      "A manchete esquenta, mas o ponto central é outro.",
      "Dois lados, um fato — e uma consequência que já apareceu.",
      "O que aconteceu ontem muda a leitura de quem acompanha o caso."
    ],
    closingExamples: [
      "Acompanha os próximos desdobramentos — o começo já explica o rumo.",
      "Relê a abertura com esse dado novo na cabeça.",
      "Comenta qual lado você acha mais consistente com os fatos."
    ],
    energyLevel: "medium",
    curiosityType: "fato verificável e consequência"
  },
  misterio_terror: {
    subject: "misterio_terror",
    label: "Mistério e terror",
    narrativeTone: "suspenso, pausas longas, revelação gradual",
    allowedHookTypes: [
      "detalhe perturbador",
      "lacuna na investigação",
      "som ou silêncio",
      "reviravolta final"
    ],
    forbiddenPhrases: [...GLOBAL_FORBIDDEN_CLICHES, "pesadelo garantido", "você vai se arrepiar"],
    idealPace: "slow",
    openingExamples: [
      "O caso começa banal — até um detalhe não bater.",
      "Três minutos de silêncio. Depois, o registro muda tudo.",
      "Parece coincidência. Não é."
    ],
    closingExamples: [
      "Volta no começo e escuta o que estava escondido no fundo.",
      "Repara no detalhe que passou rápido — agora pesa diferente.",
      "Comenta qual parte te deixou mais inquieto."
    ],
    energyLevel: "low",
    curiosityType: "lacuna e tensão crescente"
  },
  generico: {
    subject: "generico",
    label: "Genérico",
    narrativeTone: "conversacional, direto, curiosidade universal",
    allowedHookTypes: [
      "pergunta direta",
      "contraste inesperado",
      "número ou prazo",
      "promessa clara"
    ],
    forbiddenPhrases: [...GLOBAL_FORBIDDEN_CLICHES],
    idealPace: "medium",
    openingExamples: [
      "Esse assunto parece simples — até você ver o que vem depois.",
      "Em poucos segundos, a leitura muda completamente.",
      "O detalhe que explica por que isso viralizou."
    ],
    closingExamples: [
      "Volta no início com essa informação — o sentido muda.",
      "Salva pra comparar com o que você já sabia.",
      "Comenta o que mais te surpreendeu."
    ],
    energyLevel: "medium",
    curiosityType: "detalhe escondido e virada"
  }
};

export const VARIANT_ANGLE_ORDER: NarrationVariantAngle[] = [
  "factual_documental",
  "fan_lore",
  "suspense_reveal",
  "simple_explanatory",
  "controlled_controversy",
  "quick_curiosity"
];

export function getNarrationStylePack(subject: NarrationRetentionSubject): NarrationStylePack {
  return NARRATION_STYLE_PACKS[subject] ?? NARRATION_STYLE_PACKS.generico;
}