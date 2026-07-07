import { detectTopicCase } from "../editorial/topic-knowledge.js";
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
  summary: string;
  domain: RemixContentDomain;
  entities: RemixDetectedEntity[];
  actions: RemixDetectedAction[];
  setting: string | null;
  mood: string;
  differentiationGoals: string[];
  sceneInsights: RemixStructuredSceneInsight[];
  visualSearchQueries: string[];
  comfyPromptFragments: string[];
  analysisVersion: "phase2-v1";
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
  { id: "tutorial_howto", label: "Explicação / tutorial", verb: "explicar", pattern: /\b(como|tutorial|dica|hack|review|explica)\b/i }
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

function buildCorpus(input: RemixContentIntelligenceInput) {
  const hint = input.topicHint?.trim().split("|")[0]?.trim();
  const parts = [input.title, hint].filter(Boolean);
  return {
    raw: parts.join(" — "),
    normalized: normalizeText(parts.join(" "))
  };
}

function detectEntities(corpus: string): RemixDetectedEntity[] {
  const found: RemixDetectedEntity[] = [];

  for (const entry of ENTITY_CATALOG) {
    const matched = entry.aliases.some((alias) => corpus.includes(normalizeText(alias)));
    if (!matched) continue;

    found.push({
      id: entry.id,
      name: entry.name,
      type: entry.type,
      ...(entry.franchise ? { franchise: entry.franchise } : {}),
      confidence: entry.aliases.some((alias) => corpus.includes(normalizeText(alias)) && alias.length > 5)
        ? "high"
        : "medium",
      aliases: entry.aliases
    });
  }

  if (found.length === 0) {
    const properNouns = inputProperNouns(corpus);
    for (const noun of properNouns.slice(0, 2)) {
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
  return [...unique.values()];
}

function inputProperNouns(corpus: string) {
  const original = corpus;
  return original
    .split(/[\s,!?.\-:|]+/)
    .filter((token) => /^[A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]+/.test(token))
    .slice(0, 4);
}

function detectActions(corpus: string): RemixDetectedAction[] {
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
    actions.push({
      id: "highlight_moment",
      label: "Momento de destaque",
      verb: "destacar",
      confidence: "medium"
    });
  }

  return actions.slice(0, 4);
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
  title: string
): string[] {
  const lead = entities[0]?.name ?? title.slice(0, 60);
  const action = actions[0]?.label ?? "highlight";
  const queries: string[] = [];

  switch (domain) {
    case "comics_superhero":
      queries.push(
        `${lead} comic book panel archive`,
        `${lead} official art reference editorial`,
        `${entities[0]?.franchise ?? "Marvel"} ${lead} golden age comics public domain`
      );
      break;
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

  return [...new Set(queries.map((query) => query.trim()).filter(Boolean))].slice(0, 8);
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
}): RemixStructuredSceneInsight[] {
  const sceneCount = Math.min(
    ROLE_SEQUENCE.length,
    input.intensity === "extreme" ? 5 : 4
  );
  const lead = input.entities[0]?.name ?? "o assunto";
  const action = input.actions[0]?.label ?? "momento de destaque";
  const durationStep = input.outputDurationSeconds / sceneCount;
  let cursor = 0;

  const roleAngles: Record<RemixSceneRole, string> = {
    hook: `Gancho imediato com ${lead} — antecipar ${action.toLowerCase()}.`,
    context: `Contexto editorial: por que ${lead} importa neste recorte.`,
    evidence: `Prova visual: detalhe que sustenta a leitura de ${action.toLowerCase()}.`,
    tension: `Tensão narrativa antes do pico com ${lead}.`,
    climax: `Clímax: ${action} com curiosidade sobre ${lead}.`,
    outro: `Fechamento com CTA curto ligado a ${lead}.`
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
  const entities = detectEntities(corpus.normalized);
  const actions = detectActions(corpus.normalized);
  const domain = inferDomain(corpus.normalized, entities, topicCase);
  const mood = buildMood(domain);
  const lead = entities[0]?.name ?? input.title;
  const action = actions[0]?.label ?? "momento editorial";

  const sceneInsights = buildSceneInsights({
    outputDurationSeconds: input.outputDurationSeconds,
    intensity: input.intensity ?? "extreme",
    entities,
    actions,
    domain
  });

  const visualSearchQueries = buildVisualSearchQueries(
    domain,
    entities,
    actions,
    input.title
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
    domain,
    entities,
    actions,
    setting: topicCase?.location ?? (input.platform !== "local" ? input.platform : null),
    mood,
    differentiationGoals: buildDifferentiationGoals(domain, entities),
    sceneInsights,
    visualSearchQueries,
    comfyPromptFragments,
    analysisVersion: "phase2-v1"
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
    remixEntities: intelligence.entities.map((entity) => entity.name).join(", "),
    remixPrimaryAction: intelligence.actions[0]?.label ?? null,
    remixComfyPromptFragments: intelligence.comfyPromptFragments.join(" | "),
    remixVisualSearchQueries: intelligence.visualSearchQueries.join(" | ")
  };
}