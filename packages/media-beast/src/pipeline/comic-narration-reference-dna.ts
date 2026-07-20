export type ComicNarrationReferenceDnaId = "thwip_storytelling_v1" | "historian_cinematic_ptbr_v1";

export type ComicNarrationReferenceDna = {
  id: ComicNarrationReferenceDnaId;
  name: string;
  description: string;
  sourceKind: "reference_analysis" | "built_in";
  targetStyle: "storyteller" | "historian" | "cinematic_documentary";
  loudnessProfile: {
    observedIntegratedLufs: number;
    recommendedShortsIntegratedLufs: number;
    truePeakDb: number;
    macroDynamicRange: "controlled" | "wide";
  };
  pauseProfile: {
    shortPauseMs: [number, number];
    mediumPauseMs: [number, number];
    longPauseMs: [number, number];
    longPauseRatePerMinute: number;
    avoidEqualPauseRuns: true;
  };
  cadenceProfile: {
    averageSpeechBurstSeconds: number;
    medianSpeechBurstSeconds: number;
    energySlopePerSecond: number;
    deliveryPrinciple: string;
  };
  emotionalProfile: {
    baseline: "controlled" | "warm" | "urgent";
    peakStyle: "contained_impact" | "dramatic";
    minimumEmotionIntensity: number;
    preferredDeliveryModes: string[];
  };
  writingRules: string[];
  ttsDirectionRules: string[];
  visualSyncRules: string[];
};

export const comicNarrationReferenceDnas: ComicNarrationReferenceDna[] = [
  {
    id: "thwip_storytelling_v1",
    name: "THWIP Storytelling Reference",
    description: "Reference DNA based on controlled, conversational YouTube narration: frequent micro-pauses, curious reasoning, contained impact and strong story logic.",
    sourceKind: "reference_analysis",
    targetStyle: "storyteller",
    loudnessProfile: {
      observedIntegratedLufs: -22.02,
      recommendedShortsIntegratedLufs: -14.5,
      truePeakDb: -1.5,
      macroDynamicRange: "controlled"
    },
    pauseProfile: {
      shortPauseMs: [170, 260],
      mediumPauseMs: [300, 430],
      longPauseMs: [480, 680],
      longPauseRatePerMinute: 8,
      avoidEqualPauseRuns: true
    },
    cadenceProfile: {
      averageSpeechBurstSeconds: 0.3,
      medianSpeechBurstSeconds: 0.25,
      energySlopePerSecond: 2.14,
      deliveryPrinciple: "A fala deve soar como alguem pensando junto com o espectador, nao lendo um resumo pronto."
    },
    emotionalProfile: {
      baseline: "controlled",
      peakStyle: "contained_impact",
      minimumEmotionIntensity: 0.68,
      preferredDeliveryModes: ["cold_open_question", "low_suspense", "controlled_storytelling", "weighted_reveal", "impact_hit", "emotional_release"]
    },
    writingRules: [
      "Trocar frases informativas por frases com intencao: causa, suspeita, consequencia ou virada.",
      "Abrir perguntas antes de entregar explicacoes completas.",
      "Evitar narrar a HQ como legenda de imagem; narrar o significado dramatico do que aparece.",
      "Usar frases curtas e medias, com uma ideia por frase.",
      "Terminar blocos importantes com consequencia ou pergunta aberta."
    ],
    ttsDirectionRules: [
      "Comecar controlado, com curiosidade, nao empolgado demais.",
      "Antes de revelacoes, reduzir a velocidade e segurar uma pausa media ou longa.",
      "Em impactos, aumentar energia sem gritar.",
      "Alternar final suspenso, final conclusivo e final de impacto para evitar voz linear.",
      "Usar micro-pausas frequentes para parecer fala pensada."
    ],
    visualSyncRules: [
      "Toda frase precisa ter um alvo visual claro: personagem, objeto, acao ou reacao.",
      "Se a frase abre uma pergunta, a imagem deve mostrar a causa visual da pergunta.",
      "Se a frase entrega payoff, manter o visual por tempo suficiente para o espectador entender.",
      "Nao usar pagina cheia quando a frase pede objeto ou personagem especifico."
    ]
  },
  {
    id: "historian_cinematic_ptbr_v1",
    name: "Historiador Cinematico PT-BR",
    description: "Preset de narrador-historiador para HQ: contexto claro, suspense contido, explicacao elegante e payoff emocional.",
    sourceKind: "built_in",
    targetStyle: "historian",
    loudnessProfile: {
      observedIntegratedLufs: -18,
      recommendedShortsIntegratedLufs: -14.5,
      truePeakDb: -1.5,
      macroDynamicRange: "controlled"
    },
    pauseProfile: {
      shortPauseMs: [190, 280],
      mediumPauseMs: [340, 480],
      longPauseMs: [540, 760],
      longPauseRatePerMinute: 6,
      avoidEqualPauseRuns: true
    },
    cadenceProfile: {
      averageSpeechBurstSeconds: 0.42,
      medianSpeechBurstSeconds: 0.32,
      energySlopePerSecond: 1.9,
      deliveryPrinciple: "Contextualizar como historiador, mas cortar como trailer."
    },
    emotionalProfile: {
      baseline: "warm",
      peakStyle: "contained_impact",
      minimumEmotionIntensity: 0.7,
      preferredDeliveryModes: ["cold_open_question", "controlled_storytelling", "low_suspense", "weighted_reveal", "emotional_release"]
    },
    writingRules: [
      "Explicar o contexto sem pressupor que o espectador conhece a HQ.",
      "Conectar cada virada com causa e consequencia.",
      "Manter uma pergunta aberta por bloco narrativo.",
      "Fazer personagens parecerem agentes da historia, nao nomes soltos."
    ],
    ttsDirectionRules: [
      "Falar com autoridade calma.",
      "Dar peso nas consequencias humanas.",
      "Aumentar energia apenas em confronto, revelacao ou cliffhanger.",
      "Evitar cadencia reta por mais de duas frases."
    ],
    visualSyncRules: [
      "Contexto precisa aparecer antes de acao complexa.",
      "Toda mencao a personagem exige foco no personagem ou reacao direta.",
      "Toda mencao a objeto exige crop no objeto ou balao que o explica."
    ]
  }
];

export function getComicNarrationReferenceDnaById(id: ComicNarrationReferenceDnaId = "thwip_storytelling_v1") {
  return comicNarrationReferenceDnas.find((dna) => dna.id === id) ?? comicNarrationReferenceDnas[0]!;
}
