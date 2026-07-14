import { detectTopicCase } from "../editorial/topic-knowledge.js";
import {
  buildComicsSuperheroDiscoveryQueries,
  isBlockedComicsQuery
} from "./comics-asset-quality-gate.js";
import type { RemixVideoPlatform } from "./remix-video-downloader.js";
import type { RemixSceneRole } from "./remix-scene-restructure.js";

export type RemixContentDomain =
  | "sports"
  | "comics_superhero"
  | "gaming"
  | "true_crime"
  | "documentary"
  | "anime"
  | "science"
  | "horror"
  | "generic";

export type RemixEntityType =
  | "person"
  | "character"
  | "team"
  | "franchise"
  | "place"
  | "event";

export interface RemixDetectedEntity {
  id: string;
  name: string;
  type: RemixEntityType;
  franchise?: string;
  confidence: "high" | "medium" | "low";
  aliases: string[];
}

export interface RemixDetectedAction {
  id: string;
  label: string;
  verb: string;
  confidence: "high" | "medium" | "low";
}

export interface RemixStructuredSceneInsight {
  sceneId: string;
  order: number;
  role: RemixSceneRole;
  focusEntity: string | null;
  focusAction: string | null;
  visualHint: string;
  narrationAngle: string;
  energy: "low" | "medium" | "high";
}

export interface RemixStructuredContentDescription {
  headline: string;
  /** Resumo técnico para pipeline e metadados — não narrar diretamente. */
  summary: string;
  /** Resumo narrativo em linguagem natural para guiar a narração. */
  narrativeBrief: string;
  /** Sugestão de abertura/gancho em tom de narrador. */
  narrativeHook: string;
  /** Ângulo de curiosidade sugerido para o clímax. */
  curiosityAngle: string;
  domain: RemixContentDomain;
  entities: RemixDetectedEntity[];
  actions: RemixDetectedAction[];
  setting: string | null;
  mood: string;
  differentiationGoals: string[];
  sceneInsights: RemixStructuredSceneInsight[];
  visualSearchQueries: string[];
  comfyPromptFragments: string[];
  analysisVersion: "phase2-v2";
}

export interface RemixContentIntelligenceInput {
  title: string;
  platform: RemixVideoPlatform | "local";
  topicHint?: string | null;
  outputDurationSeconds: number;
  intensity?: "medium" | "extreme";
}

interface EntityCatalogEntry {
  id: string;
  name: string;
  type: RemixEntityType;
  franchise?: string;
  domain: RemixContentDomain;
  aliases: string[];
}

const ENTITY_CATALOG: EntityCatalogEntry[] = [
  {
    id: "deadpool",
    name: "Deadpool",
    type: "character",
    franchise: "Marvel",
    domain: "comics_superhero",
    aliases: ["deadpool", "wade wilson"]
  },
  {
    id: "venom",
    name: "Venom",
    type: "character",
    franchise: "Marvel",
    domain: "comics_superhero",
    aliases: ["venom", "eddie brock", "simbiote", "simbionte"]
  },
  {
    id: "spiderman",
    name: "Homem-Aranha",
    type: "character",
    franchise: "Marvel",
    domain: "comics_superhero",
    aliases: ["spiderman", "spider-man", "homem aranha", "peter parker"]
  },
  {
    id: "batman",
    name: "Batman",
    type: "character",
    franchise: "DC",
    domain: "comics_superhero",
    aliases: ["batman", "cavaleiro das trevas", "bruce wayne"]
  },
  {
    id: "superman",
    name: "Superman",
    type: "character",
    franchise: "DC",
    domain: "comics_superhero",
    aliases: ["superman", "clark kent", "homem de aco"]
  },
  {
    id: "wolverine",
    name: "Wolverine",
    type: "character",
    franchise: "Marvel",
    domain: "comics_superhero",
    aliases: ["wolverine", "logan"]
  },
  {
    id: "messi",
    name: "Lionel Messi",
    type: "person",
    franchise: "Futebol",
    domain: "sports",
    aliases: ["messi", "lionel messi", "leo messi"]
  },
  {
    id: "ronaldo",
    name: "Cristiano Ronaldo",
    type: "person",
    franchise: "Futebol",
    domain: "sports",
    aliases: ["ronaldo", "cristiano ronaldo", "cr7"]
  },
  {
    id: "neymar",
    name: "Neymar",
    type: "person",
    franchise: "Futebol",
    domain: "sports",
    aliases: ["neymar", "neymar jr"]
  },
  {
    id: "goro",
    name: "Goro",
    type: "character",
    franchise: "Mortal Kombat",
    domain: "gaming",
    aliases: ["goro", "mortal kombat", "mk"]
  },
  {
    id: "naruto",
    name: "Naruto",
    type: "character",
    franchise: "Naruto",
    domain: "anime",
    aliases: ["naruto", "uzumaki"]
  },
  {
    id: "goku",
    name: "Goku",
    type: "character",
    franchise: "Dragon Ball",
    domain: "anime",
    aliases: ["goku", "dragon ball", "saiyan"]
  },
  {
    id: "iron_man",
    name: "Homem de Ferro",
    type: "character",
    franchise: "Marvel",
    domain: "comics_superhero",
    aliases: ["iron man", "homem de ferro", "tony stark", "stark"]
  },
  {
    id: "joker",
    name: "Coringa",
    type: "character",
    franchise: "DC",
    domain: "comics_superhero",
    aliases: ["joker", "coringa"]
  },
  {
    id: "scorpion",
    name: "Scorpion",
    type: "character",
    franchise: "Mortal Kombat",
    domain: "gaming",
    aliases: ["scorpion", "mortal kombat"]
  },
  {
    id: "sub_zero",
    name: "Sub-Zero",
    type: "character",
    franchise: "Mortal Kombat",
    domain: "gaming",
    aliases: ["sub-zero", "sub zero"]
  },
  {
    id: "luffy",
    name: "Luffy",
    type: "character",
    franchise: "One Piece",
    domain: "anime",
    aliases: ["luffy", "one piece", "monkey d luffy"]
  },
  {
    id: "mbappe",
    name: "Kylian Mbappé",
    type: "person",
    franchise: "Futebol",
    domain: "sports",
    aliases: ["mbappe", "mbappé", "kylian mbappe"]
  },
  {
    id: "haaland",
    name: "Erling Haaland",
    type: "person",
    franchise: "Futebol",
    domain: "sports",
    aliases: ["haaland", "erling haaland"]
  },
  {
    id: "liverpool",
    name: "Liverpool",
    type: "team",
    franchise: "Premier League",
    domain: "sports",
    aliases: ["liverpool", "lfc", "reds"]
  },
  {
    id: "barcelona",
    name: "Barcelona",
    type: "team",
    franchise: "La Liga",
    domain: "sports",
    aliases: ["barcelona", "barça", "barca", "fc barcelona"]
  },
  {
    id: "real_madrid",
    name: "Real Madrid",
    type: "team",
    franchise: "La Liga",
    domain: "sports",
    aliases: ["real madrid", "madrid", "merengues"]
  },
  {
    id: "champions_league",
    name: "Champions League",
    type: "event",
    franchise: "UEFA",
    domain: "sports",
    aliases: ["champions league", "liga dos campeoes", "ucl"]
  },
  {
    id: "world_cup",
    name: "Copa do Mundo",
    type: "event",
    franchise: "FIFA",
    domain: "sports",
    aliases: ["world cup", "copa do mundo", "mundial"]
  }
];

const ACTION_PATTERNS: Array<{
  id: string;
  label: string;
  verb: string;
  pattern: RegExp;
}> = [
  { id: "score_goal", label: "Gol marcado", verb: "marcar gol", pattern: /\b(gol|goal|scored|marcou|finaliza)\b/i },
  { id: "free_kick", label: "Falta / cobrança", verb: "cobrar falta", pattern: /\b(falta|free\s*kick|cobran[cç]a)\b/i },
  { id: "fight_scene", label: "Cena de luta", verb: "lutar", pattern: /\b(luta|fight|combat|round|combo|fatality)\b/i },
  { id: "reveal_twist", label: "Revelação / plot twist", verb: "revelar", pattern: /\b(revela|twist|plot|segredo|surpresa)\b/i },
  { id: "chase_escape", label: "Perseguição / fuga", verb: "fugir", pattern: /\b(persegui|chase|fuga|escape|corre)\b/i },
  { id: "transformation", label: "Transformação", verb: "transformar", pattern: /\b(transforma|muta|evolui|power\s*up)\b/i },
  { id: "interview_quote", label: "Declaração / entrevista", verb: "declarar", pattern: /\b(entrevista|declara|disse|fala|quote)\b/i },
  { id: "tutorial_howto", label: "Explicação / tutorial", verb: "explicar", pattern: /\b(como|tutorial|dica|hack|review|explica)\b/i },
  { id: "dribble_skill", label: "Drible / habilidade", verb: "driblar", pattern: /\b(drible|dribble|skill|finta|caneta)\b/i },
  { id: "assist_pass", label: "Assistência / passe", verb: "assistir", pattern: /\b(assist|assistencia|passe|pass|cross|cruzamento)\b/i },
  { id: "goalkeeper_save", label: "Defesa do goleiro", verb: "defender", pattern: /\b(defesa|save|goleiro|keeper|parada)\b/i },
  { id: "knockout_finish", label: "Nocaute / finalização", verb: "nocautear", pattern: /\b(knockout|nocaute|ko|finaliza|finish)\b/i },
  { id: "celebration", label: "Comemoração", verb: "comemorar", pattern: /\b(comemora|celebration|celebra|danca)\b/i },
  { id: "emotional_moment", label: "Momento emocional", verb: "emocionar", pattern: /\b(emocion|choro|lágrima|lagrima|tributo|homenagem)\b/i },
  {
    id: "perfect_partner",
    label: "Parceiro ideal / simbiose",
    verb: "encontrar o par perfeito",
    pattern: /\b(parceiro\s*perfeito|perfect\s*partner|dupla\s*perfeita|match\s*perfeito)\b/i
  },
  {
    id: "discovery_meet",
    label: "Encontro / descoberta",
    verb: "encontrar",
    pattern: /\b(encontrou|achou|descobriu|found|meet|conheceu|apresentou)\b/i
  },
  {
    id: "symbiosis_bond",
    label: "Simbiose / vínculo",
    verb: "se fundir",
    pattern: /\b(simbiose|simbiote|simbionte|symbiote|bond|vinculo|vínculo|fusion|fusao|fusão)\b/i
  },
  {
    id: "team_up",
    label: "Dupla / parceria",
    verb: "formar dupla",
    pattern: /\b(dupla|parceria|team\s*up|together|juntos|aliado|sidekick)\b/i
  },
  {
    id: "action_scene",
    label: "Cena de ação",
    verb: "entrar em ação",
    pattern: /\b(acao|ação|action|fight|luta|confronto|battle|batalha)\b/i
  }
];

const ROLE_SEQUENCE: RemixSceneRole[] = ["hook", "context", "evidence", "climax", "outro"];

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export interface RemixTitleSemantics {
  cleanTitle: string;
  hookPhrase: string | null;
  subjectPhrase: string | null;
  hashtags: string[];
}

function extractHashtags(rawTitle: string): string[] {
  return [...rawTitle.matchAll(/#([\p{L}\p{N}_]+)/gu)].map((match) => match[1]!.toLowerCase());
}

function stripTitleDecorations(rawTitle: string): string {
  return rawTitle
    .replace(/#[\p{L}\p{N}_]+/gu, " ")
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, " ")
    .replace(/!+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseVideoTitleSemantics(rawTitle: string): RemixTitleSemantics {
  const hashtags = extractHashtags(rawTitle);
  const cleanTitle = stripTitleDecorations(rawTitle);

  let hookPhrase: string | null = null;
  let subjectPhrase: string | null = null;

  const partnershipMatch = cleanTitle.match(
    /(?:o|a)\s+(.+?)\s+(?:encontrou|achou|descobriu|revela|mostra|apresenta)\s+(?:o|a|seu|sua)\s+(.+)/i
  );
  if (partnershipMatch) {
    subjectPhrase = partnershipMatch[1]!.trim();
    hookPhrase = partnershipMatch[2]!.trim();
  }

  const invertedMatch = cleanTitle.match(
    /(.+?)\s+(?:encontrou|achou|descobriu)\s+(?:o|a)\s+(.+)/i
  );
  if (!hookPhrase && invertedMatch) {
    subjectPhrase = invertedMatch[1]!.replace(/^(o|a)\s+/i, "").trim();
    hookPhrase = invertedMatch[2]!.trim();
  }

  if (!hookPhrase && cleanTitle.length > 10) {
    hookPhrase = cleanTitle.replace(/^(o|a|os|as)\s+/i, "").trim();
  }

  return {
    cleanTitle,
    hookPhrase,
    subjectPhrase,
    hashtags
  };
}

function buildCorpus(input: RemixContentIntelligenceInput) {
  const hint = input.topicHint?.trim().split("|")[0]?.trim();
  const semantics = parseVideoTitleSemantics(input.title);
  const hashtagText = semantics.hashtags.join(" ");
  const parts = [semantics.cleanTitle, hint, hashtagText].filter(Boolean);
  return {
    raw: parts.join(" — "),
    normalized: normalizeText(parts.join(" ")),
    semantics
  };
}

function aliasMatchesCorpus(corpus: string, alias: string): boolean {
  const normalizedAlias = normalizeText(alias);
  if (normalizedAlias.length < 3) {
    return false;
  }
  if (normalizedAlias.includes(" ")) {
    return corpus.includes(normalizedAlias);
  }
  const pattern = new RegExp(`(?:^|[\\s,.:;!?\\-])${normalizedAlias}(?:$|[\\s,.:;!?\\-])`);
  return pattern.test(` ${corpus} `);
}

function detectEntities(
  corpus: string,
  rawCorpus: string,
  hashtags: string[] = [],
  subjectPhrase: string | null = null
): RemixDetectedEntity[] {
  const found: RemixDetectedEntity[] = [];
  const extendedCorpus = normalizeText(`${corpus} ${hashtags.join(" ")}`);
  const sortedCatalog = [...ENTITY_CATALOG].sort(
    (left, right) =>
      Math.max(...right.aliases.map((alias) => alias.length)) -
      Math.max(...left.aliases.map((alias) => alias.length))
  );

  const normalizeTagAlias = (alias: string) => alias.replace(/[\s-]+/g, "").toLowerCase();

  for (const entry of sortedCatalog) {
    const matchedAlias = entry.aliases.find(
      (alias) =>
        aliasMatchesCorpus(extendedCorpus, alias) ||
        hashtags.some((tag) => tag === normalizeTagAlias(alias))
    );
    if (!matchedAlias) continue;

    const fromHashtag = hashtags.some((tag) =>
      entry.aliases.some(
        (alias) => tag === normalizeTagAlias(alias) || tag.includes(normalizeTagAlias(alias))
      )
    );

    found.push({
      id: entry.id,
      name: entry.name,
      type: entry.type,
      ...(entry.franchise ? { franchise: entry.franchise } : {}),
      confidence:
        fromHashtag || matchedAlias.length > 6 || entry.type === "person" || entry.type === "character"
          ? "high"
          : "medium",
      aliases: entry.aliases
    });
  }

  if (found.length === 0) {
    const properNouns = inputProperNouns(rawCorpus);
    for (const noun of properNouns.slice(0, 3)) {
      found.push({
        id: `entity-${noun.toLowerCase().replace(/\s+/g, "-")}`,
        name: noun,
        type: "person",
        confidence: "low",
        aliases: [noun.toLowerCase()]
      });
    }
  }

  const unique = new Map<string, RemixDetectedEntity>();
  for (const entity of found) {
    unique.set(entity.id, entity);
  }

  const ranked = [...unique.values()].sort((left, right) => {
    const typeWeight: Record<RemixEntityType, number> = {
      person: 4,
      character: 4,
      team: 3,
      event: 2,
      franchise: 2,
      place: 1
    };
    const confidenceWeight = { high: 3, medium: 2, low: 1 };
    const leftScore = typeWeight[left.type] * confidenceWeight[left.confidence];
    const rightScore = typeWeight[right.type] * confidenceWeight[right.confidence];
    return rightScore - leftScore;
  });

  return prioritizeTitleSubjectEntity(ranked, subjectPhrase);
}

function prioritizeTitleSubjectEntity(
  entities: RemixDetectedEntity[],
  subjectPhrase: string | null
): RemixDetectedEntity[] {
  if (!subjectPhrase || entities.length < 2) return entities;

  const normalizedSubject = normalizeText(subjectPhrase);
  const matchIndex = entities.findIndex(
    (entity) =>
      normalizeText(entity.name) === normalizedSubject ||
      entity.aliases.some(
        (alias) =>
          normalizedSubject.includes(normalizeText(alias)) ||
          normalizeText(alias).includes(normalizedSubject)
      )
  );

  if (matchIndex <= 0) return entities;

  const reordered = [...entities];
  const [match] = reordered.splice(matchIndex, 1);
  return match ? [match, ...reordered] : entities;
}

function inputProperNouns(corpus: string) {
  const original = corpus;
  return original
    .split(/[\s,!?.\-:|]+/)
    .filter((token) => /^[A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]+/.test(token))
    .slice(0, 4);
}

function detectActions(corpus: string, domain: RemixContentDomain): RemixDetectedAction[] {
  const actions: RemixDetectedAction[] = [];

  for (const pattern of ACTION_PATTERNS) {
    if (pattern.pattern.test(corpus)) {
      actions.push({
        id: pattern.id,
        label: pattern.label,
        verb: pattern.verb,
        confidence: "high"
      });
    }
  }

  if (actions.length === 0) {
    const domainFallback: Partial<Record<RemixContentDomain, RemixDetectedAction>> = {
      sports: {
        id: "highlight_moment",
        label: "Lance decisivo",
        verb: "decidir o lance",
        confidence: "medium"
      },
      gaming: {
        id: "highlight_moment",
        label: "Jogada de highlight",
        verb: "converter a jogada",
        confidence: "medium"
      },
      comics_superhero: {
        id: "highlight_moment",
        label: "Cena de ação",
        verb: "entrar em ação",
        confidence: "medium"
      },
      anime: {
        id: "highlight_moment",
        label: "Momento épico",
        verb: "virar o confronto",
        confidence: "medium"
      }
    };
    actions.push(
      domainFallback[domain] ?? {
        id: "highlight_moment",
        label: "Momento de destaque",
        verb: "marcar o instante",
        confidence: "medium"
      }
    );
  }

  return actions.slice(0, 4);
}

function detectSetting(
  corpus: string,
  entities: RemixDetectedEntity[],
  platform: RemixVideoPlatform | "local"
): string | null {
  const eventEntity = entities.find((entity) => entity.type === "event");
  if (eventEntity) {
    return eventEntity.name;
  }

  const teamEntities = entities.filter((entity) => entity.type === "team");
  if (teamEntities.length >= 2) {
    return `${teamEntities[0]!.name} x ${teamEntities[1]!.name}`;
  }
  if (teamEntities.length === 1) {
    return teamEntities[0]!.name;
  }

  if (/champions\s*league|liga\s*dos\s*campeoes|ucl/i.test(corpus)) {
    return "Champions League";
  }
  if (/world\s*cup|copa\s*do\s*mundo|mundial/i.test(corpus)) {
    return "Copa do Mundo";
  }
  if (/libertadores/i.test(corpus)) {
    return "Libertadores";
  }
  if (/premier\s*league/i.test(corpus)) {
    return "Premier League";
  }
  if (/brasileir[aã]o/i.test(corpus)) {
    return "Brasileirão";
  }

  return platform !== "local" ? platform : null;
}

function buildNarrativeContent(input: {
  lead: string;
  action: string;
  actionVerb: string;
  domain: RemixContentDomain;
  setting: string | null;
  entities: RemixDetectedEntity[];
  title: string;
  titleSemantics: RemixTitleSemantics;
}): {
  narrativeBrief: string;
  narrativeHook: string;
  curiosityAngle: string;
} {
  const settingHint = input.setting ? ` em ${input.setting}` : "";
  const secondary =
    input.entities[1]?.type === "team" || input.entities[1]?.type === "event"
      ? input.entities[1].name
      : null;
  const hookPhrase = input.titleSemantics.hookPhrase;
  const hasPartnershipHook =
    Boolean(hookPhrase) &&
    /parceiro|partner|simbiose|simbiote|simbionte|dupla|bond|match/i.test(
      `${hookPhrase} ${input.titleSemantics.cleanTitle}`
    );

  if (hasPartnershipHook && input.domain === "comics_superhero") {
    const partnerLabel = (hookPhrase ?? "o par perfeito").toLowerCase();
    return {
      narrativeHook: `${input.lead} encontra ${partnerLabel} — e o short inteiro gira em torno dessa dupla.`,
      narrativeBrief: `O clipe mostra ${input.lead} encontrando ${partnerLabel}. Não é só ação: é a fantasia da combinação certa — simbiose, química visual e o momento em que os fãs reconhecem a dupla ideal.`,
      curiosityAngle: `O que torna essa dupla "perfeita" vem dos quadrinhos — e raramente aparece explicado no recorte de 60 segundos.`
    };
  }

  if (hookPhrase && hookPhrase.length > 8 && input.titleSemantics.cleanTitle.length > 12) {
    return {
      narrativeHook: `Parece só mais um short — mas o gancho é "${hookPhrase}".`,
      narrativeBrief: `${input.titleSemantics.cleanTitle}. ${input.lead} ${input.actionVerb}${settingHint}${secondary ? ` com ${secondary}` : ""}. O vídeo entrega o momento; a narração precisa explicar por que esse gancho prende.`,
      curiosityAngle: `O detalhe por trás de "${hookPhrase}" é o que separa quem assiste de quem comenta.`
    };
  }

  switch (input.domain) {
    case "sports":
      return {
        narrativeHook: `Esse lance de ${input.lead}${settingHint} parece simples — até você ver o instante anterior.`,
        narrativeBrief: `${input.lead} protagoniza ${input.action.toLowerCase()}${settingHint}${secondary ? ` contra ${secondary}` : ""}. O vídeo mostra o golpe final, mas o contexto tático é o que transforma o trecho em memória coletiva.`,
        curiosityAngle: `O detalhe antes de ${input.actionVerb} muda completamente a leitura do lance.`
      };
    case "comics_superhero":
      return {
        narrativeHook: `Essa cena com ${input.lead} parece só ação — mas ela paga uma dívida visual com os quadrinhos.`,
        narrativeBrief: `${input.lead} entra em ${input.action.toLowerCase()}${settingHint}. O frame que viraliza costuma copiar composição de painel clássico — luz, enquadramento e timing fazem o short parecer maior do que é.`,
        curiosityAngle: `A referência de HQ escondida nesse frame é o que separa fã de espectador casual.`
      };
    case "gaming":
      return {
        narrativeHook: `Esse highlight de ${input.lead} parece reflexo puro — mas é leitura de jogo.`,
        narrativeBrief: `${input.lead} ${input.actionVerb}${settingHint}. O clipe mostra o resultado bonito; a narrativa precisa explicar a decisão que tornou a jogada possível.`,
        curiosityAngle: `Frame data e matchup explicam por que essa jogada não foi sorte.`
      };
    case "anime":
      return {
        narrativeHook: `Esse momento de ${input.lead} prende porque o storyboard antecipa o impacto.`,
        narrativeBrief: `${input.lead} vive ${input.action.toLowerCase()}${settingHint}. Em anime, o clímax costuma nascer do silêncio antes do golpe — o short precisa recuperar essa tensão.`,
        curiosityAngle: `O painel ou capítulo que inspirou esse frame raramente aparece no clipe original.`
      };
    case "true_crime":
      return {
        narrativeHook: `Esse recorte sobre ${input.lead} parece direto — o arquivo conta outra sequência.`,
        narrativeBrief: `O caso envolvendo ${input.lead}${settingHint} ganha outra dimensão quando datas, locais e depoimentos entram na ordem certa.`,
        curiosityAngle: `O detalhe investigativo que a internet resume costuma ser o elo que faltava.`
      };
    case "horror":
      return {
        narrativeHook: `Esse trecho de ${input.lead} assusta mais pelo que esconde do que pelo que mostra.`,
        narrativeBrief: `${input.title.slice(0, 80)}${settingHint}. Terror eficaz usa espaço negativo e som — o vídeo precisa de contexto para não virar só jump scare.`,
        curiosityAngle: `O que a câmera recusa mostrar por um segundo a mais é o que fica na memória.`
      };
    case "science":
      return {
        narrativeHook: `Esse fenômeno parece óbvio — até você ver o mecanismo por trás.`,
        narrativeBrief: `${input.lead} ilustra ${input.action.toLowerCase()}${settingHint}. Ciência em short funciona quando traduz abstração em imagem mental concreta.`,
        curiosityAngle: `O princípio contraintuitivo por trás disso é mais surpreendente que o título.`
      };
    case "documentary":
      return {
        narrativeHook: `Esse arquivo sobre ${input.lead} muda quando você vê como a época percebeu o fato.`,
        narrativeBrief: `${input.lead}${settingHint}: ${input.action.toLowerCase()} com peso histórico. Documentário premium usa contexto, não só imagem bonita.`,
        curiosityAngle: `O que ficou fora do corte original costuma ser a camada que dá peso emocional.`
      };
    default:
      return {
        narrativeHook: `Esse trecho sobre ${input.lead} prende porque antecipa a explicação.`,
        narrativeBrief: `${input.lead} em ${input.action.toLowerCase()}${settingHint}. O clipe mostra o momento; a narração precisa entregar o porquê.`,
        curiosityAngle: `A surpresa está no que acontece um segundo antes do que todo mundo compartilha.`
      };
  }
}

function inferDomain(
  corpus: string,
  entities: RemixDetectedEntity[],
  topicCase: ReturnType<typeof detectTopicCase>
): RemixContentDomain {
  if (topicCase) return "true_crime";

  for (const entity of entities) {
    const catalogEntry = ENTITY_CATALOG.find((entry) => entry.id === entity.id);
    if (catalogEntry) return catalogEntry.domain;
  }

  if (/football|futebol|gol|lance|nba|sport/i.test(corpus)) return "sports";
  if (/marvel|dc|comic|hq|superhero|heroi/i.test(corpus)) return "comics_superhero";
  if (/anime|manga|naruto|goku/i.test(corpus)) return "anime";
  if (/crime|assassin|serial|mystery|caso/i.test(corpus)) return "true_crime";
  if (/horror|terror|assombra|paranormal/i.test(corpus)) return "horror";
  if (/ciencia|science|curios|universo|espaco/i.test(corpus)) return "science";
  if (/historia|history|documentary|arquivo/i.test(corpus)) return "documentary";
  if (/game|gaming|jogo|mk\d|mortal kombat/i.test(corpus)) return "gaming";

  return "generic";
}

function buildMood(domain: RemixContentDomain): string {
  switch (domain) {
    case "sports":
      return "energia de highlight esportivo";
    case "comics_superhero":
      return "ação cinematográfica de universo de quadrinhos";
    case "gaming":
      return "ritmo de gameplay competitivo";
    case "true_crime":
      return "tensão documental investigativa";
    case "horror":
      return "suspense sombrio";
    case "anime":
      return "dinamismo de cultura pop japonesa";
    case "science":
      return "curiosidade explicativa";
    case "documentary":
      return "tom arquivístico premium";
    default:
      return "short-form editorial dinâmico";
  }
}

function buildDifferentiationGoals(
  domain: RemixContentDomain,
  entities: RemixDetectedEntity[]
): string[] {
  const lead = entities[0]?.name ?? "o assunto";
  const base = [
    "Substituir trechos repetitivos do clip original por inserts visuais gerados.",
    "Reescrever narração com contexto e curiosidade editorial.",
    "Trocar trilha, legendas e grade para criar identidade própria do remix."
  ];

  switch (domain) {
    case "comics_superhero":
      return [
        ...base,
        `Inserir painéis/HQs e reconstruções estilizadas de ${lead} sem copiar frames do filme.`,
        "Usar halftone, noir ou neon para diferenciar do trailer original."
      ];
    case "sports":
      return [
        ...base,
        `Buscar arquivo fotográfico e b-roll de ${lead} para contextualizar o lance.`,
        "Sincronizar cortes ao ritmo da narração esportiva."
      ];
    case "gaming":
      return [
        ...base,
        "Gerar inserts de personagem e HUD estilizado via ComfyUI.",
        "Destacar mecânica do jogo em vez de só repetir o highlight."
      ];
    default:
      return base;
  }
}

function buildVisualSearchQueries(
  domain: RemixContentDomain,
  entities: RemixDetectedEntity[],
  actions: RemixDetectedAction[],
  title: string,
  hookPhrase?: string | null
): string[] {
  const lead = entities[0]?.name ?? title.slice(0, 60);
  const action = actions[0]?.label ?? "highlight";
  const queries: string[] = [];

  if (hookPhrase && hookPhrase.length > 4) {
    queries.push(`${lead} ${hookPhrase} comic art`, `${lead} ${hookPhrase} illustration`);
  }

  for (const entity of entities.slice(1, 3)) {
    queries.push(
      `${entity.name} comic art reference`,
      `${lead} ${entity.name} comic panel`,
      `${entity.name} ${entities[0]?.franchise ?? "Marvel"} illustration`
    );
  }

  switch (domain) {
    case "comics_superhero": {
      const entityNames = entities.map((entity) => entity.name);
      queries.push(...buildComicsSuperheroDiscoveryQueries(entityNames));
      if (entities[1]) {
        queries.push(
          `${lead} ${entities[1].name} symbiote comic panel Marvel`,
          `Venom vs ${entities[1].name} comic cover`,
          `${entities[1].name} black suit comic panel`
        );
      }
      if (/parceiro|partner|simbiose|symbiote/i.test(`${hookPhrase ?? ""} ${action}`)) {
        queries.push(
          `${lead} symbiote bond comic panel Marvel`,
          `${entities[0]?.franchise ?? "Marvel"} ${lead} symbiote comic cover`
        );
        if (entities[1]) {
          queries.push(`${lead} ${entities[1].name} symbiote comic panel`);
        }
      }
      break;
    }
    case "sports":
      queries.push(
        `${lead} match archive photo press`,
        `${lead} ${action} sports photography`,
        `${lead} stadium action editorial photo`
      );
      break;
    case "gaming":
      queries.push(
        `${lead} game character concept art`,
        `${lead} fighting game arcade archive`,
        `${lead} esports highlight b-roll`
      );
      break;
    case "anime":
      queries.push(
        `${lead} anime key visual reference`,
        `${lead} manga panel editorial`,
        `${lead} anime scene composition study`
      );
      break;
    default:
      queries.push(
        `${lead} editorial photo archive`,
        `${lead} documentary b-roll reference`,
        `${lead} ${action} news photo`
      );
  }

  return [...new Set(queries.map((query) => query.trim()).filter(Boolean))]
    .filter((query) => !isBlockedComicsQuery(query))
    .slice(0, 12);
}

function buildComfyPromptFragments(
  domain: RemixContentDomain,
  entities: RemixDetectedEntity[],
  actions: RemixDetectedAction[],
  mood: string
): string[] {
  const lead = entities[0]?.name ?? "subject";
  const action = actions[0]?.verb ?? "highlight moment";

  const domainFragments: Record<RemixContentDomain, string[]> = {
    comics_superhero: [
      `cinematic ${lead} inspired composition, comic halftone texture, premium lens`,
      `noir dramatic lighting, ${lead} silhouette, editorial poster frame`,
      `neon retro action frame, ${lead} motion blur, short-form vertical`
    ],
    sports: [
      `sports hype photography, ${lead} stadium energy, dynamic freeze frame`,
      `editorial football action, ${lead} ${action}, grain archive look`,
      `slow-motion sports b-roll plate, crowd bokeh, premium broadcast grade`
    ],
    gaming: [
      `fighting game UI inspired plate, ${lead} character pose, arcade neon`,
      `gameplay highlight reconstruction, ${lead} ${action}, cinematic depth`,
      `esports arena mood, controller macro, competitive energy`
    ],
    anime: [
      `anime key visual style, ${lead} dramatic pose, cel-shaded lighting`,
      `manga panel composition, speed lines, premium vertical short`,
      `neon cyberpunk anime b-roll, ${lead} action frame`
    ],
    true_crime: [
      `noir investigation board, archival newspaper texture`,
      `documentary crime archive mood, desaturated premium grade`,
      `evidence close-up plate, dramatic shadow, true crime short`
    ],
    horror: [
      `horror atmosphere fog plate, vignette, unsettling negative space`,
      `dark cinematic texture overlay, film grain, whisper mood`
    ],
    science: [
      `scientific macro b-roll, data visualization mood, clean explainer frame`,
      `space documentary plate, curiosity-driven composition`
    ],
    documentary: [
      `museum archive macro, historical photograph texture`,
      `premium documentary b-roll, neutral cinematic grade`
    ],
    generic: [
      `cinematic documentary b-roll, ${mood}, vertical short-form`,
      `editorial texture plate, premium lens character, remix-safe original frame`
    ]
  };

  return domainFragments[domain] ?? domainFragments.generic;
}

function buildSceneInsights(input: {
  outputDurationSeconds: number;
  intensity: "medium" | "extreme";
  entities: RemixDetectedEntity[];
  actions: RemixDetectedAction[];
  domain: RemixContentDomain;
  setting: string | null;
  narrativeHook: string;
  curiosityAngle: string;
}): RemixStructuredSceneInsight[] {
  const sceneCount = Math.min(
    ROLE_SEQUENCE.length,
    input.intensity === "extreme" ? 5 : 4
  );
  const lead = input.entities[0]?.name ?? "o assunto";
  const action = input.actions[0]?.label ?? "momento de destaque";
  const actionVerb = input.actions[0]?.verb ?? "acontecer";
  const settingHint = input.setting ? ` em ${input.setting}` : "";
  const durationStep = input.outputDurationSeconds / sceneCount;
  let cursor = 0;

  const roleAngles: Record<RemixSceneRole, string> = {
    hook: input.narrativeHook,
    context:
      input.domain === "sports"
        ? `Para entender ${action.toLowerCase()} de ${lead}${settingHint}, olhe pressão, marcação e ritmo da partida.`
        : input.domain === "gaming"
          ? `Antes de ${actionVerb}, ${lead} já leu o padrão do oponente — o highlight esconde essa decisão.`
          : `O recorte de ${lead} só ganha peso quando você conecta o instante ao que veio antes.`,
    evidence:
      input.domain === "comics_superhero"
        ? `O frame remete a painel clássico — composição e luz antecipam ${action.toLowerCase()}.`
        : `O detalhe visual que sustenta ${action.toLowerCase()} aparece nos segundos que o corte original ignora.`,
    tension: `A tensão sobe quando ${lead} se aproxima do pico — o espectador precisa sentir que algo vai virar.`,
    climax: input.curiosityAngle,
    outro: `Fechamento curto: convide o espectador a comentar o que mais surpreendeu em ${lead}.`
  };

  const roleVisuals: Record<RemixSceneRole, string> = {
    hook: "Insert ComfyUI hero frame ou crop agressivo do original",
    context: "B-roll de arquivo / HQ relacionada ao personagem",
    evidence: "Close editorial ou painel de quadrinho estilizado",
    tension: "Transição com textura e motion blur",
    climax: "Reconstrução ComfyUI do momento de pico",
    outro: "Placa de fechamento + legenda CTA"
  };

  return Array.from({ length: sceneCount }, (_, index) => {
    const role = ROLE_SEQUENCE[index] ?? "context";
    const duration = durationStep;
    const startSeconds = Number(cursor.toFixed(2));
    const endSeconds = Number((cursor + duration).toFixed(2));
    cursor += duration;

    return {
      sceneId: `intel-scene-${index + 1}`,
      order: index + 1,
      role,
      focusEntity: lead,
      focusAction: index >= 2 ? action : null,
      visualHint: roleVisuals[role],
      narrationAngle: roleAngles[role],
      energy:
        role === "hook" || role === "climax"
          ? "high"
          : role === "context" || role === "outro"
            ? "medium"
            : "low"
    };
  });
}

export function buildRemixContentIntelligence(
  input: RemixContentIntelligenceInput
): RemixStructuredContentDescription {
  const corpus = buildCorpus(input);
  const topicCase = detectTopicCase(corpus.raw);
  const entities = detectEntities(
    corpus.normalized,
    corpus.raw,
    corpus.semantics.hashtags,
    corpus.semantics.subjectPhrase
  );
  const domain = inferDomain(corpus.normalized, entities, topicCase);
  const actions = detectActions(corpus.normalized, domain);
  const mood = buildMood(domain);
  const lead = entities[0]?.name ?? corpus.semantics.subjectPhrase ?? corpus.semantics.cleanTitle;
  const action = actions[0]?.label ?? "momento editorial";
  const actionVerb = actions[0]?.verb ?? "acontecer";
  const setting = detectSetting(corpus.normalized, entities, input.platform);
  const narrativeContent = buildNarrativeContent({
    lead,
    action,
    actionVerb,
    domain,
    setting,
    entities,
    title: corpus.semantics.cleanTitle,
    titleSemantics: corpus.semantics
  });

  const sceneInsights = buildSceneInsights({
    outputDurationSeconds: input.outputDurationSeconds,
    intensity: input.intensity ?? "extreme",
    entities,
    actions,
    domain,
    setting,
    narrativeHook: narrativeContent.narrativeHook,
    curiosityAngle: narrativeContent.curiosityAngle
  });

  const visualSearchQueries = buildVisualSearchQueries(
    domain,
    entities,
    actions,
    corpus.semantics.cleanTitle,
    corpus.semantics.hookPhrase
  );
  const comfyPromptFragments = buildComfyPromptFragments(domain, entities, actions, mood);

  const headline =
    entities.length > 0
      ? `${lead}: ${action}`
      : `${input.title.slice(0, 80)} — recorte editorial`;

  const summary = [
    `Domínio: ${domain}.`,
    entities.length
      ? `Entidades: ${entities.map((entity) => entity.name).join(", ")}.`
      : "Entidades: não identificadas com alta confiança.",
    `Ação central: ${action}.`,
    `Tom: ${mood}.`,
    `Plataforma: ${input.platform}.`
  ].join(" ");

  return {
    headline,
    summary,
    narrativeBrief: narrativeContent.narrativeBrief,
    narrativeHook: narrativeContent.narrativeHook,
    curiosityAngle: narrativeContent.curiosityAngle,
    domain,
    entities,
    actions,
    setting: topicCase?.location ?? setting,
    mood,
    differentiationGoals: buildDifferentiationGoals(domain, entities),
    sceneInsights,
    visualSearchQueries,
    comfyPromptFragments,
    analysisVersion: "phase2-v2"
  };
}

export function enrichCandidateWithContentIntelligence(
  metadata: Record<string, unknown>,
  intelligence: RemixStructuredContentDescription
): Record<string, unknown> {
  return {
    ...metadata,
    remixContentDomain: intelligence.domain,
    remixContentHeadline: intelligence.headline,
    remixNarrativeBrief: intelligence.narrativeBrief,
    remixNarrativeHook: intelligence.narrativeHook,
    remixCuriosityAngle: intelligence.curiosityAngle,
    remixEntities: intelligence.entities.map((entity) => entity.name).join(", "),
    remixPrimaryAction: intelligence.actions[0]?.label ?? null,
    remixSetting: intelligence.setting,
    remixComfyPromptFragments: intelligence.comfyPromptFragments.join(" | "),
    remixVisualSearchQueries: intelligence.visualSearchQueries.join(" | ")
  };
}