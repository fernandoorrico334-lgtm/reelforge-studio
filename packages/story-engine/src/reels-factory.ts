import type { CinematicPresetId } from "@reelforge/cinematic-engine";

export const reelsFactoryTemplateIds = [
  "player_threat_analysis",
  "tactical_breakdown",
  "match_preview",
  "post_match_hot_take",
  "rivalry_hype",
  "top_3_ranking",
  "underdog_story",
  "brazil_warning"
] as const;

export type ReelsFactoryTemplateId =
  (typeof reelsFactoryTemplateIds)[number];

export type ReelsFactoryNextAction =
  | "generate_narration"
  | "generate_visuals"
  | "attach_microclip"
  | "render";

export type ReelsFactorySceneRole =
  | "hook"
  | "setup"
  | "development"
  | "impactMoment"
  | "conclusion"
  | "cta";

export interface ReelsFactoryTemplateStructure {
  hook: string;
  setup: string;
  development: string;
  impactMoment: string;
  conclusion: string;
  cta: string;
}

export interface ReelsFactoryTemplate {
  id: ReelsFactoryTemplateId;
  name: string;
  description: string;
  bestFor: string;
  defaultDurationSeconds: number;
  defaultSceneCount: number;
  recommendedTone: string;
  recommendedVoicePackId: string;
  recommendedWorkflowPackId: string;
  recommendedQualityPresetId: "draft" | "standard" | "high";
  recommendedAudioMasteringPresetId: string;
  allowsMicroclip: boolean;
  microclipSuggestion: string;
  structure: ReelsFactoryTemplateStructure;
  defaultVisualPresetId: CinematicPresetId;
  defaultCaptionStyleId: string;
  defaultTransition: string;
}

export interface ReelsFactoryInput {
  topic: string;
  subject: string;
  angle: string;
  templateId: ReelsFactoryTemplateId;
  tone: string;
  durationSeconds: number;
  language: string;
  includeMicroclip: boolean;
}

export interface ReelsFactorySceneMicroclipSlot {
  label: string;
  usageMode: "supporting_evidence" | "impact_moment" | "quick_reference";
  textOverlay: string | null;
}

export interface ReelsFactorySceneDraft {
  orderIndex: number;
  role: ReelsFactorySceneRole;
  title: string;
  durationSeconds: number;
  narrationText: string;
  onScreenText: string;
  visualPrompt: string;
  suggestedWorkflowPackId: string;
  suggestedVoicePackId: string;
  suggestedAudioMasteringPresetId: string;
  suggestedVisualPresetId: CinematicPresetId;
  captionStyleId: string;
  transition: string;
  energyLevel: number;
  microclipSlot: ReelsFactorySceneMicroclipSlot | null;
}

export interface ReelsFactoryPreview {
  title: string;
  shortDescription: string;
  hook: string;
  templateId: ReelsFactoryTemplateId;
  tone: string;
  language: string;
  durationSeconds: number;
  includeMicroclip: boolean;
  scenes: ReelsFactorySceneDraft[];
  hashtags: string[];
  caption: string;
  checklist: string[];
  recommendedNextActions: ReelsFactoryNextAction[];
}

const reelsFactoryTemplates: Record<
  ReelsFactoryTemplateId,
  ReelsFactoryTemplate
> = {
  player_threat_analysis: {
    id: "player_threat_analysis",
    name: "Player Threat Analysis",
    description:
      "Analisa um nome central do adversario e explica por que ele muda o jogo.",
    bestFor: "Ameaça individual, estrela adversária e alertas de confronto.",
    defaultDurationSeconds: 35,
    defaultSceneCount: 6,
    recommendedTone: "hype",
    recommendedVoicePackId: "sports_hype_ptbr",
    recommendedWorkflowPackId: "sports_hype",
    recommendedQualityPresetId: "standard",
    recommendedAudioMasteringPresetId: "football_hype",
    allowsMicroclip: true,
    microclipSuggestion: "arrancada, finalizacao ou close do gesto tecnico decisivo",
    structure: {
      hook: "Abrir com um alerta direto sobre o impacto do jogador.",
      setup: "Enquadrar o contexto do duelo e por que o nome preocupa.",
      development: "Mostrar a arma principal que complica a partida.",
      impactMoment: "Escalar o risco concreto se a equipe nao reagir.",
      conclusion: "Fechar com leitura tatica curta e memoravel.",
      cta: "Empurrar o comentario com pergunta ou provocacao."
    },
    defaultVisualPresetId: "action",
    defaultCaptionStyleId: "sports_hype",
    defaultTransition: "whip-cut"
  },
  tactical_breakdown: {
    id: "tactical_breakdown",
    name: "Tactical Breakdown",
    description:
      "Quebra um padrao tatico em blocos curtos para explicar o que decide o jogo.",
    bestFor: "Linhas de passe, pressao, espacos e ajustes de sistema.",
    defaultDurationSeconds: 40,
    defaultSceneCount: 6,
    recommendedTone: "analysis",
    recommendedVoicePackId: "documentary_ptbr",
    recommendedWorkflowPackId: "sports_hype",
    recommendedQualityPresetId: "standard",
    recommendedAudioMasteringPresetId: "documentary_clean",
    allowsMicroclip: true,
    microclipSuggestion: "repeticao curta do movimento que comprova o ajuste tatico",
    structure: {
      hook: "Abrir com o ponto do campo que define a partida.",
      setup: "Explicar a organizacao inicial e o risco posicional.",
      development: "Detalhar como o problema nasce ou se repete.",
      impactMoment: "Mostrar o instante em que o espaco vira perigo real.",
      conclusion: "Encerrar com o ajuste que precisa acontecer.",
      cta: "Perguntar se o leitor faria o mesmo ajuste."
    },
    defaultVisualPresetId: "suspense",
    defaultCaptionStyleId: "documentary_clean",
    defaultTransition: "cut"
  },
  match_preview: {
    id: "match_preview",
    name: "Match Preview",
    description:
      "Prepara o publico para o proximo jogo com risco, contexto e ponto decisivo.",
    bestFor: "Pre-jogo, confronto chave e narrativa de expectativa.",
    defaultDurationSeconds: 32,
    defaultSceneCount: 6,
    recommendedTone: "epic",
    recommendedVoicePackId: "sports_hype_ptbr",
    recommendedWorkflowPackId: "sports_hype",
    recommendedQualityPresetId: "standard",
    recommendedAudioMasteringPresetId: "football_hype",
    allowsMicroclip: true,
    microclipSuggestion: "entrada em campo, pressao alta ou gesto tecnico do duelo",
    structure: {
      hook: "Abrir com a pergunta que aumenta a expectativa.",
      setup: "Dar o contexto competitivo e o peso do confronto.",
      development: "Apontar os encaixes que podem decidir.",
      impactMoment: "Levar o publico ao detalhe que muda a partida.",
      conclusion: "Fechar com o fator que vale monitorar.",
      cta: "Pedir previsao ou palpite de quem vai decidir."
    },
    defaultVisualPresetId: "epic",
    defaultCaptionStyleId: "sports_hype",
    defaultTransition: "flash"
  },
  post_match_hot_take: {
    id: "post_match_hot_take",
    name: "Post Match Hot Take",
    description:
      "Entrega leitura rápida, opinativa e autoral logo depois do jogo.",
    bestFor: "Resumo quente, leitura imediata e recorte de um detalhe decisivo.",
    defaultDurationSeconds: 28,
    defaultSceneCount: 5,
    recommendedTone: "dramatic",
    recommendedVoicePackId: "sports_hype_ptbr",
    recommendedWorkflowPackId: "sports_hype",
    recommendedQualityPresetId: "standard",
    recommendedAudioMasteringPresetId: "viral_fast_cut",
    allowsMicroclip: true,
    microclipSuggestion: "lance que cristaliza a opiniao ou erro determinante",
    structure: {
      hook: "Abrir com a opiniao mais forte e defendivel.",
      setup: "Contextualizar o recorte do jogo em uma frase.",
      development: "Argumentar com o detalhe mais objetivo disponivel.",
      impactMoment: "Travar a narrativa no lance ou escolha que virou a partida.",
      conclusion: "Fechar com a tese em versao curta e memoravel.",
      cta: "Convidar o publico a concordar ou discordar."
    },
    defaultVisualPresetId: "drama",
    defaultCaptionStyleId: "sports_hype",
    defaultTransition: "cut"
  },
  rivalry_hype: {
    id: "rivalry_hype",
    name: "Rivalry Hype",
    description:
      "Aumenta a tensao de um confronto pesado com linguagem de duelo e fisico.",
    bestFor: "Rivalidades, confronto direto e jogos com peso emocional alto.",
    defaultDurationSeconds: 34,
    defaultSceneCount: 6,
    recommendedTone: "hype",
    recommendedVoicePackId: "sports_hype_ptbr",
    recommendedWorkflowPackId: "sports_hype",
    recommendedQualityPresetId: "standard",
    recommendedAudioMasteringPresetId: "football_hype",
    allowsMicroclip: true,
    microclipSuggestion: "entrada forte, choque fisico ou comemoracao que inflama o duelo",
    structure: {
      hook: "Abrir com o choque central do confronto.",
      setup: "Dar o contexto emocional do duelo.",
      development: "Escalar a disputa tecnica ou fisica que importa.",
      impactMoment: "Marcar o ponto em que o duelo pode explodir.",
      conclusion: "Fechar com a pergunta sobre quem aguenta a pressao.",
      cta: "Pedir lado, favorito ou protagonista do duelo."
    },
    defaultVisualPresetId: "epic",
    defaultCaptionStyleId: "sports_hype",
    defaultTransition: "flash"
  },
  top_3_ranking: {
    id: "top_3_ranking",
    name: "Top 3 Ranking",
    description:
      "Organiza um ranking curto com argumento rapido para cada posicao.",
    bestFor: "Top 3 selecoes, jogadores, ameaças e favoritos.",
    defaultDurationSeconds: 36,
    defaultSceneCount: 5,
    recommendedTone: "analysis",
    recommendedVoicePackId: "narrator_clean_ptbr",
    recommendedWorkflowPackId: "sports_hype",
    recommendedQualityPresetId: "standard",
    recommendedAudioMasteringPresetId: "shorts_clean_voice",
    allowsMicroclip: false,
    microclipSuggestion: "nao usar microclip por padrao; manter ritmo em cards e imagens",
    structure: {
      hook: "Abrir com a promessa do ranking e a tese principal.",
      setup: "Introduzir o criterio do top 3.",
      development: "Justificar os nomes com blocos curtos e diretos.",
      impactMoment: "Reservar o maior choque para a primeira colocacao.",
      conclusion: "Fechar com o que o ranking revela sobre o torneio.",
      cta: "Pedir o top 3 do publico nos comentarios."
    },
    defaultVisualPresetId: "drama",
    defaultCaptionStyleId: "premium_yellow",
    defaultTransition: "cut"
  },
  underdog_story: {
    id: "underdog_story",
    name: "Underdog Story",
    description:
      "Conta a ascensao de quem era ignorado e agora virou problema real.",
    bestFor: "Zebras, crescimento de selecao e virada de percepcao.",
    defaultDurationSeconds: 38,
    defaultSceneCount: 6,
    recommendedTone: "dramatic",
    recommendedVoicePackId: "story_epic_ptbr",
    recommendedWorkflowPackId: "cinematic_story",
    recommendedQualityPresetId: "standard",
    recommendedAudioMasteringPresetId: "cinematic_epic",
    allowsMicroclip: true,
    microclipSuggestion: "comemoracao curta ou gesto de superacao que resume a virada",
    structure: {
      hook: "Abrir com a quebra de expectativa sobre o time.",
      setup: "Lembrar por que ninguem levava a historia a serio.",
      development: "Mostrar a evolucao ou arma que mudou a leitura.",
      impactMoment: "Fixar o momento em que a zebra virou ameaca real.",
      conclusion: "Fechar com o novo status competitivo do time.",
      cta: "Perguntar se a historia pode ir ainda mais longe."
    },
    defaultVisualPresetId: "drama",
    defaultCaptionStyleId: "premium_yellow",
    defaultTransition: "soft-dissolve"
  },
  brazil_warning: {
    id: "brazil_warning",
    name: "Brazil Warning",
    description:
      "Empacota um alerta editorial curto sobre o que o Brasil nao pode ignorar.",
    bestFor: "Alertas taticos, armadilhas de confronto e sinais de risco.",
    defaultDurationSeconds: 30,
    defaultSceneCount: 6,
    recommendedTone: "warning",
    recommendedVoicePackId: "documentary_ptbr",
    recommendedWorkflowPackId: "sports_hype",
    recommendedQualityPresetId: "standard",
    recommendedAudioMasteringPresetId: "true_crime_dark",
    allowsMicroclip: true,
    microclipSuggestion: "erro recorrente, encaixe perdido ou gesto de risco defensivo",
    structure: {
      hook: "Abrir com o alerta mais duro e defensavel.",
      setup: "Explicar por que o risco aparece nesse confronto.",
      development: "Abrir o problema em dois blocos simples.",
      impactMoment: "Chegar ao momento em que o erro pode custar o jogo.",
      conclusion: "Fechar com o ajuste urgente.",
      cta: "Perguntar se o Brasil esta realmente pronto para isso."
    },
    defaultVisualPresetId: "suspense",
    defaultCaptionStyleId: "premium_yellow",
    defaultTransition: "flash"
  }
};

const sceneEnergyByRole: Record<ReelsFactorySceneRole, number> = {
  hook: 96,
  setup: 68,
  development: 78,
  impactMoment: 92,
  conclusion: 70,
  cta: 64
};

const roleDurationWeights: Record<ReelsFactorySceneRole, number> = {
  hook: 0.85,
  setup: 0.95,
  development: 1.15,
  impactMoment: 1.1,
  conclusion: 0.95,
  cta: 0.75
};

const roleScreenTextVerbs: Record<ReelsFactorySceneRole, string[]> = {
  hook: ["o alerta real", "o perigo que cresce", "isso muda o jogo"],
  setup: ["o contexto pesa", "por que isso importa", "o confronto abre aqui"],
  development: ["a arma principal", "o espaco que aparece", "o detalhe que incomoda"],
  impactMoment: ["aqui o risco explode", "o lance que decide", "o momento mais perigoso"],
  conclusion: ["o ajuste urgente", "o recado final", "o ponto que fica"],
  cta: ["qual sua leitura?", "voce concorda?", "quem leva essa?"]
};

function cloneTemplate(template: ReelsFactoryTemplate): ReelsFactoryTemplate {
  return {
    ...template,
    structure: { ...template.structure }
  };
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}+/gu, "")
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function titleCase(value: string) {
  return value
    .split(/\s+/u)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function buildStableSeed(value: string) {
  let hash = 2166136261;

  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }

  return Math.abs(hash >>> 0);
}

function pickBySeed<T>(items: T[], seed: number, offset = 0): T {
  return items[(seed + offset) % items.length] as T;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

function roundToSingleDecimal(value: number) {
  return Math.round(value * 10) / 10;
}

function sanitizeDuration(durationSeconds: number, template: ReelsFactoryTemplate) {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    return template.defaultDurationSeconds;
  }

  return clamp(Math.round(durationSeconds), 25, 60);
}

function sanitizeInput(input: Partial<ReelsFactoryInput>) {
  return {
    topic: String(input.topic ?? "").trim(),
    subject: String(input.subject ?? input.topic ?? "").trim(),
    angle: String(input.angle ?? "").trim(),
    templateId: input.templateId ?? "player_threat_analysis",
    tone: String(input.tone ?? "hype").trim() || "hype",
    durationSeconds: Number(input.durationSeconds ?? 35),
    language: String(input.language ?? "pt-BR").trim() || "pt-BR",
    includeMicroclip: Boolean(input.includeMicroclip)
  };
}

function resolveSceneRoles(sceneCount: number): ReelsFactorySceneRole[] {
  if (sceneCount <= 5) {
    return ["hook", "setup", "development", "impactMoment", "cta"];
  }

  return ["hook", "setup", "development", "impactMoment", "conclusion", "cta"];
}

function buildSceneDurations(
  durationSeconds: number,
  roles: ReelsFactorySceneRole[]
) {
  const weightedTotal = roles.reduce(
    (total, role) => total + roleDurationWeights[role],
    0
  );
  const rawDurations = roles.map(
    (role) => (durationSeconds * roleDurationWeights[role]) / weightedTotal
  );
  const roundedDurations = rawDurations.map(roundToSingleDecimal);
  const roundedTotal = roundToSingleDecimal(
    roundedDurations.reduce((total, value) => total + value, 0)
  );
  const delta = roundToSingleDecimal(durationSeconds - roundedTotal);

  if (Math.abs(delta) >= 0.1) {
    const lastDuration = roundedDurations[roundedDurations.length - 1] ?? 0;
    roundedDurations[roundedDurations.length - 1] = roundToSingleDecimal(
      lastDuration + delta
    );
  }

  return roundedDurations;
}

function buildSceneTitle(
  role: ReelsFactorySceneRole,
  subject: string,
  seed: number,
  offset: number
) {
  const titlesByRole: Record<ReelsFactorySceneRole, string[]> = {
    hook: [
      `${subject} em alerta maximo`,
      `O problema ${subject}`,
      `${subject} ja entra no radar`
    ],
    setup: [
      `Por que ${subject} pesa tanto`,
      `O contexto por tras de ${subject}`,
      `Onde ${subject} muda o duelo`
    ],
    development: [
      `A arma principal de ${subject}`,
      `O detalhe que abre espaco`,
      `O padrao que cresce no jogo`
    ],
    impactMoment: [
      `O instante que decide tudo`,
      `Onde o risco vira castigo`,
      `O momento mais perigoso`
    ],
    conclusion: [
      `O ajuste que precisa acontecer`,
      `A leitura final do duelo`,
      `O recado antes da bola rolar`
    ],
    cta: [
      `Sua leitura do confronto`,
      `O veredito da audiencia`,
      `A pergunta que fecha o video`
    ]
  };

  return pickBySeed(titlesByRole[role], seed, offset);
}

function buildNarrationText(
  role: ReelsFactorySceneRole,
  topic: string,
  subject: string,
  angle: string,
  tone: string,
  template: ReelsFactoryTemplate,
  seed: number,
  offset: number
) {
  const toneHint =
    tone.toLowerCase().includes("warn")
      ? "sem floreio"
      : tone.toLowerCase().includes("analysis")
        ? "com leitura fria"
        : tone.toLowerCase().includes("dram")
          ? "com peso dramatizado"
          : "com ritmo de studio";

  const roleLines: Record<ReelsFactorySceneRole, string[]> = {
    hook: [
      `${topic} nao parece um detalhe menor: ${subject} entra nessa historia ${toneHint} e esse alerta ja muda a forma de olhar o jogo.`,
      `Se ${topic} ainda soa exagero, olha o ponto central: ${subject} ja transforma ${angle} no problema que mais incomoda esse confronto.`,
      `${topic} resume o tamanho do risco: ${subject} aparece cedo e empurra ${angle} para o centro da discussao.`
    ],
    setup: [
      `O contexto deixa isso mais pesado porque ${subject} nao precisa dominar o jogo inteiro para fazer ${angle} aparecer no momento certo.`,
      `Antes da bola rolar, o quadro ja preocupa: ${subject} encontra espaco exatamente onde ${angle} mais castiga.`,
      `Quando o duelo aperta, ${subject} vira pauta porque ${angle} encaixa no ponto mais sensivel da partida.`
    ],
    development: [
      `O que mais assusta e o padrao: ${subject} repete movimentos que esticam a linha, puxam marcação e abrem o corredor onde ${angle} cresce.`,
      `A arma aqui nao e uma jogada isolada; e a forma como ${subject} sustenta ${angle} em sequencia e obriga a defesa a correr para tras.`,
      `No detalhe tatico, ${subject} incomoda porque ${angle} nao nasce do acaso, e sim de um mecanismo que se repete o jogo inteiro.`
    ],
    impactMoment: [
      `E o pior aparece no auge da jogada: se ${subject} recebe meio segundo de vantagem, ${angle} sai do plano teorico e vira lance de gol.`,
      `O momento mais perigoso e simples de imaginar: ${subject} acelera, o bloco quebra e ${angle} finalmente explode no setor decisivo.`,
      `Aqui mora o impacto real: ${subject} precisa de pouco para converter ${angle} numa sequencia que desequilibra a partida.`
    ],
    conclusion: [
      `Por isso o resumo e direto: neutralizar ${subject} significa cortar ${angle} cedo, antes que o jogo entre no roteiro que o rival quer.`,
      `No fechamento, a leitura fica clara: se ${subject} tiver campo para respirar, ${angle} deixa de ser aviso e vira tendencia de partida.`,
      `A conclusao e objetiva: controlar ${subject} e a forma mais limpa de impedir que ${angle} assuma o comando do confronto.`
    ],
    cta: [
      `Agora a pergunta e sua: ${subject} realmente e o ponto que mais assusta, ou existe outro detalhe do jogo que merece entrar nessa conversa?`,
      `Fica a provocacao: voce compraria esse alerta sobre ${subject}, ou acha que ${angle} esta sendo superestimado antes do confronto?`,
      `Me diz nos comentarios se ${subject} e mesmo o centro do problema, ou se ${angle} ainda nao recebeu o peso certo nessa previa.`
    ]
  };

  return pickBySeed(roleLines[role], seed, offset);
}

function buildOnScreenText(
  role: ReelsFactorySceneRole,
  subject: string,
  angle: string,
  seed: number,
  offset: number
) {
  const verb = pickBySeed(roleScreenTextVerbs[role], seed, offset);
  const focus =
    role === "cta"
      ? `${subject} ou outro fator?`
      : angle.length > 0
        ? `${verb}: ${angle}`
        : `${verb}: ${subject}`;

  return titleCase(focus.slice(0, 72));
}

function buildVisualPrompt(
  role: ReelsFactorySceneRole,
  topic: string,
  subject: string,
  angle: string,
  template: ReelsFactoryTemplate
) {
  const roleDescription = template.structure[role];
  const base = `${topic}, ${subject}, ${angle}`.replace(/\s+/g, " ").trim();

  return `${base}. Vertical 9:16 editorial sports frame, ${template.bestFor.toLowerCase()}, ${roleDescription.toLowerCase()}, broadcast-grade composition, caption-safe lower third, premium contrast, high detail, no watermark, local authorial reel aesthetic.`;
}

function buildMicroclipSlot(
  includeMicroclip: boolean,
  template: ReelsFactoryTemplate,
  role: ReelsFactorySceneRole,
  subject: string,
  angle: string
): ReelsFactorySceneMicroclipSlot | null {
  if (!includeMicroclip || !template.allowsMicroclip || role !== "impactMoment") {
    return null;
  }

  return {
    label: template.microclipSuggestion,
    usageMode: "impact_moment",
    textOverlay: `${subject}: ${angle}`.slice(0, 54)
  };
}

function buildHashtags(topic: string, subject: string, templateId: string) {
  const keywords = [topic, subject, "Copa", "Futebol", templateId]
    .flatMap((entry) => normalizeText(entry).split(" "))
    .filter((entry) => entry.length >= 3);
  const tags = [...new Set(keywords)].slice(0, 6);

  return tags.map((entry) => `#${entry.replace(/\s+/g, "")}`);
}

function buildSocialCaption(
  previewTitle: string,
  hook: string,
  ctaScene: ReelsFactorySceneDraft | undefined,
  hashtags: string[]
) {
  const ctaLine = ctaScene?.narrationText ?? "Qual e a sua leitura?";
  return `${previewTitle}\n\n${hook}\n\n${ctaLine}\n\n${hashtags.join(" ")}`.trim();
}

function buildChecklist(
  preview: {
    includeMicroclip: boolean;
    template: ReelsFactoryTemplate;
    scenes: ReelsFactorySceneDraft[];
  }
) {
  const checklist = [
    `Gerar narracao local com ${preview.template.recommendedVoicePackId}.`,
    `Gerar visuais base com workflow pack ${preview.template.recommendedWorkflowPackId}.`,
    `Revisar on-screen text e caption-safe framing nas ${preview.scenes.length} cenas.`,
    `Selecionar preset de mastering ${preview.template.recommendedAudioMasteringPresetId}.`
  ];

  if (preview.includeMicroclip && preview.template.allowsMicroclip) {
    checklist.push(`Anexar microclip opcional de ${preview.template.microclipSuggestion}.`);
  }

  checklist.push("Abrir o Project Studio e fechar o render vertical 9:16.");
  return checklist;
}

function buildRecommendedNextActions(
  includeMicroclip: boolean,
  template: ReelsFactoryTemplate
): ReelsFactoryNextAction[] {
  return [
    "generate_narration",
    "generate_visuals",
    ...(includeMicroclip && template.allowsMicroclip
      ? (["attach_microclip"] as const)
      : []),
    "render"
  ];
}

export function getReelsFactoryTemplates(): ReelsFactoryTemplate[] {
  return reelsFactoryTemplateIds.map((templateId) =>
    cloneTemplate(reelsFactoryTemplates[templateId])
  );
}

export function getReelsFactoryTemplateById(
  templateId: string | null | undefined
): ReelsFactoryTemplate | null {
  if (!templateId) {
    return null;
  }

  const normalized = templateId
    .trim()
    .replaceAll("-", "_")
    .toLowerCase() as ReelsFactoryTemplateId;

  if (!reelsFactoryTemplateIds.includes(normalized)) {
    return null;
  }

  return cloneTemplate(reelsFactoryTemplates[normalized]);
}

export function isReelsFactoryTemplateId(
  templateId: string | null | undefined
): templateId is ReelsFactoryTemplateId {
  return Boolean(getReelsFactoryTemplateById(templateId));
}

export function generateReelsFactoryPreview(
  rawInput: Partial<ReelsFactoryInput>
): ReelsFactoryPreview {
  const input = sanitizeInput(rawInput);
  const template =
    getReelsFactoryTemplateById(input.templateId) ??
    reelsFactoryTemplates.player_threat_analysis;
  const durationSeconds = sanitizeDuration(input.durationSeconds, template);
  const roles = resolveSceneRoles(template.defaultSceneCount);
  const durations = buildSceneDurations(durationSeconds, roles);
  const seed = buildStableSeed(
    [
      input.topic,
      input.subject,
      input.angle,
      input.tone,
      input.language,
      template.id,
      String(input.includeMicroclip),
      String(durationSeconds)
    ].join("::")
  );
  const hookText = buildNarrationText(
    "hook",
    input.topic,
    input.subject,
    input.angle,
    input.tone,
    template,
    seed,
    1
  );
  const scenes = roles.map((role, index) => ({
    orderIndex: index + 1,
    role,
    title: buildSceneTitle(role, input.subject, seed, index),
    durationSeconds: durations[index] ?? roundToSingleDecimal(durationSeconds / roles.length),
    narrationText: buildNarrationText(
      role,
      input.topic,
      input.subject,
      input.angle,
      input.tone,
      template,
      seed,
      index + 2
    ),
    onScreenText: buildOnScreenText(
      role,
      input.subject,
      input.angle,
      seed,
      index + 3
    ),
    visualPrompt: buildVisualPrompt(
      role,
      input.topic,
      input.subject,
      input.angle,
      template
    ),
    suggestedWorkflowPackId: template.recommendedWorkflowPackId,
    suggestedVoicePackId: template.recommendedVoicePackId,
    suggestedAudioMasteringPresetId:
      template.recommendedAudioMasteringPresetId,
    suggestedVisualPresetId: template.defaultVisualPresetId,
    captionStyleId: template.defaultCaptionStyleId,
    transition: template.defaultTransition,
    energyLevel: sceneEnergyByRole[role],
    microclipSlot: buildMicroclipSlot(
      input.includeMicroclip,
      template,
      role,
      input.subject,
      input.angle
    )
  }));
  const previewTitle = pickBySeed(
    [
      `${input.subject}: ${input.angle}`,
      `${input.topic} em 35 segundos`,
      `${input.subject} e o alerta do jogo`
    ].map((value) => value.replace(/\s+/g, " ").trim()),
    seed,
    4
  );
  const hashtags = buildHashtags(input.topic, input.subject, template.id);
  const caption = buildSocialCaption(
    previewTitle,
    hookText,
    scenes.find((scene) => scene.role === "cta"),
    hashtags
  );

  return {
    title: previewTitle,
    shortDescription: `${template.description} Tema: ${input.topic}. Angulo: ${input.angle}.`,
    hook: hookText,
    templateId: template.id,
    tone: input.tone,
    language: input.language,
    durationSeconds,
    includeMicroclip: input.includeMicroclip && template.allowsMicroclip,
    scenes,
    hashtags,
    caption,
    checklist: buildChecklist({
      includeMicroclip: input.includeMicroclip,
      template,
      scenes
    }),
    recommendedNextActions: buildRecommendedNextActions(
      input.includeMicroclip,
      template
    )
  };
}

export function buildReelsFactoryProjectScript(preview: ReelsFactoryPreview) {
  return [
    preview.title,
    preview.shortDescription,
    ...preview.scenes.map(
      (scene) => `${scene.orderIndex}. ${scene.title}: ${scene.narrationText}`
    )
  ].join("\n\n");
}
