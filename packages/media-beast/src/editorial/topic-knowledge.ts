export interface TopicCaseBrief {
  id: string;
  aliases: string[];
  year: string;
  location: string;
  summaryFacts: string[];
  timelineBeats: string[];
  editorialAngles: string[];
  visualSearchQueries: string[];
  sensitivityNotes: string[];
}

const CASE_BRIEFS: TopicCaseBrief[] = [
  {
    id: "columbine",
    aliases: [
      "columbine",
      "massacre de columbine",
      "massacre columbine",
      "columbine massacre",
      "littleton",
      "eric harris",
      "dylan klebold"
    ],
    year: "1999",
    location: "Littleton, Colorado",
    summaryFacts: [
      "Ataque ocorrido em 20 de abril de 1999 no Columbine High School.",
      "Dois estudantes armados mataram 13 pessoas e feriram mais de 20 antes de tirarem a propria vida.",
      "Foi um dos primeiros massacres escolares com cobertura televisiva ao vivo nos EUA.",
      "Diarios, videos-case e investigacoes posteriores mudaram o debate sobre prevencao e sinais ignorados."
    ],
    timelineBeats: [
      "Manha de 20/04/1999: explosivos caseiros sao acionados no estacionamento.",
      "Atiradores entram na biblioteca e em outras areas do campus.",
      "SWAT e midia chegam enquanto estudantes buscam abrigo.",
      "Investigacao federal e estadual redefine protocolos escolares nos anos seguintes."
    ],
    editorialAngles: [
      "Linha do tempo minuto a minuto do dia do ataque",
      "O que os diarios e videos-case revelaram depois",
      "Como a cobertura ao vivo mudou a midia de tragedias",
      "Sinais ignorados: o debate sobre prevencao",
      "Memoria das vitimas versus sensacionalismo",
      "Comparacao com outros massacres escolares dos anos 90",
      "O papel do bullying na narrativa publica",
      "Armas e legislacao: o que mudou depois de Columbine",
      "A biblioteca do colégio: o epicentro do horror",
      "Documentarios e livros essenciais sobre o caso",
      "Teorias que circularam versus fatos confirmados",
      "Impacto no cinema e na cultura pop dos 2000s"
    ],
    visualSearchQueries: [
      "Columbine High School 1999 archive photos",
      "Columbine massacre news footage archive",
      "Columbine library crime scene archive editorial",
      "Columbine 1999 newspaper front page",
      "Littleton Colorado school shooting historical photos",
      "Columbine investigation FBI archive",
      "Columbine memorial victims documentary photos"
    ],
    sensitivityNotes: [
      "Evite imagens graficas de vitimas ou glorificacao dos autores.",
      "Priorize contexto historico, arquivo jornalistico e memorial.",
      "Nao trate o caso como entretenimento."
    ]
  }
];

const GENERIC_TRUE_CRIME_ANGLES = [
  "Linha do tempo em 60 segundos",
  "O detalhe que a maioria esquece",
  "O que as investigacoes revelaram depois",
  "Arquivo jornalistico versus versao popular",
  "Por que o caso voltou a trendar",
  "Documentarios e fontes primarias",
  "Mapa mental do caso para iniciantes",
  "Mitos que a internet espalhou",
  "O papel da midia na memoria do caso",
  "Comparacao com casos parecidos"
];

export function detectTopicCase(query: string): TopicCaseBrief | null {
  const normalized = query.toLowerCase();

  for (const brief of CASE_BRIEFS) {
    if (brief.aliases.some((alias) => normalized.includes(alias))) {
      return brief;
    }
  }

  return null;
}

export function buildTopicDiscoveryQueries(query: string, nichePresetId: string) {
  const brief = detectTopicCase(query);
  const trimmed = query.trim();

  if (brief) {
    return [
      trimmed,
      `${brief.id} ${brief.year} archive photos`,
      `${brief.id} ${brief.year} news footage documentary`,
      ...brief.visualSearchQueries.slice(0, 5)
    ];
  }

  if (nichePresetId === "serial_killers" || nichePresetId === "historia_obscura") {
    return [
      trimmed,
      `${trimmed} archive photos historical`,
      `${trimmed} documentary news footage`,
      `${trimmed} investigation timeline`,
      `${trimmed} newspaper archive`
    ];
  }

  return [trimmed, `${trimmed} archive photos`, `${trimmed} documentary footage`];
}

export function listShortAngles(query: string, limit = 50) {
  const brief = detectTopicCase(query);
  const base = brief?.editorialAngles ?? GENERIC_TRUE_CRIME_ANGLES;
  const extras: string[] = [];

  for (let index = 0; extras.length < limit; index += 1) {
    for (const angle of base) {
      extras.push(
        index === 0 ? angle : `${angle} — variacao ${index + 1}`
      );
      if (extras.length >= limit) {
        break;
      }
    }
  }

  return extras.slice(0, limit);
}

export function buildCaseNarrationScript(input: {
  query: string;
  durationSeconds: number;
  language: string;
}) {
  const brief = detectTopicCase(input.query);

  if (brief?.id === "columbine") {
    return {
      script: [
        "Vinte de abril de mil novecentos e noventa e nove. Um dia comum em Littleton, Colorado... ate o silencio quebrar.",
        "Dois estudantes entraram armados no Columbine High School. Em menos de uma hora, treze pessoas estavam mortas. Mais de vinte feridas. E o mundo inteiro assistindo, ao vivo, sem conseguir intervir.",
        "Nao foi so uma tragedia — foi um choque que atravessou geracoes. Diarios encontrados depois. Videos-case. Investigacoes que expuseram falhas, sinais ignorados e um sistema que nao estava pronto.",
        "Columbine nao e apenas um nome. E um antes e depois na historia da violencia escolar, da midia e da memoria coletiva.",
        "Se esse caso te prende como prende milhoes de pessoas, comenta Columbine — e eu trago a linha do tempo completa."
      ].join("\n\n"),
      captions: [
        "Um dia normal… até virar pesadelo",
        "13 vidas. Menos de 60 minutos.",
        "O mundo assistiu — ao vivo",
        "Sinais ignorados. Silêncio depois.",
        "Antes e depois da história",
        "Ainda ecoa. Até hoje.",
        "Comenta COLUMBINE → parte 2"
      ],
      estimatedWords: 132
    };
  }

  const title = input.query.trim();
  return {
    script: [
      `Hoje voce vai entender, em menos de um minuto, por que ${title} ainda prende atencao.`,
      `As fontes de arquivo e reportagens mostram um caso com camadas que a internet resume demais. Ha contexto historico, investigacao e consequencias que quase nunca aparecem no mesmo short.`,
      `O ponto central e este: fatos confirmados valem mais que especulacao. Por isso, qualquer reel sobre ${title} precisa de fonte, tom documental e revisao manual.`,
      `Se quiser a versao completa com timeline e referencias, comenta aqui.`
    ].join("\n\n"),
    captions: [
      `Você acha que conhece ${title}?`,
      "O detalhe que muda tudo",
      "Arquivo. Fatos. Não rumor.",
      "Isso ainda prende atenção",
      "Comenta → parte 2"
    ],
    estimatedWords: 95
  };
}