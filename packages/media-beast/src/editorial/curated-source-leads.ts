import type { MediaBeastCandidate } from "../providers/types.js";
import type { TopicCaseBrief } from "./topic-knowledge.js";

export interface CuratedSourceLead {
  providerId: MediaBeastCandidate["providerId"];
  title: string;
  sourceUrl: string;
  previewUrl?: string | null;
  intent: string;
  score: number;
  reason: string;
}

function leadId(seed: string) {
  return `curated-${Buffer.from(seed).toString("base64url").slice(0, 14)}`;
}

function toCandidate(lead: CuratedSourceLead, topicId: string): MediaBeastCandidate {
  return {
    id: leadId(`${topicId}:${lead.sourceUrl}`),
    providerId: lead.providerId,
    kind: lead.providerId === "youtube" ? "video" : lead.providerId === "google-images" ? "image" : "webpage",
    title: lead.title,
    sourceUrl: lead.sourceUrl,
    previewUrl: lead.previewUrl ?? null,
    licenseStatus: "unknown",
    riskLevel: "medium",
    score: lead.score,
    reasons: [lead.reason, "Fonte curada com query testada para retornar arquivo real."],
    warnings: [
      "Discovery-only: verifique direitos antes de usar qualquer imagem ou clipe.",
      "Priorize memorial, arquivo jornalistico e documentarios — evite conteudo grafico."
    ],
    metadata: {
      temporalLens: "past",
      searchIntent: lead.intent,
      discoveryOnly: true,
      curatedLead: true,
      editorialScore: lead.score
    }
  };
}

const COLUMBINE_LEADS: CuratedSourceLead[] = [
  {
    providerId: "google-images",
    title: "Fotos de arquivo — Columbine 1999 (Google Imagens)",
    sourceUrl:
      "https://www.google.com/search?tbm=isch&q=Columbine+High+School+1999+news+photos",
    intent: "press_photos",
    score: 92,
    reason: "Busca direta em imagens de noticias do caso — costuma retornar milhares de resultados."
  },
  {
    providerId: "google-images",
    title: "Manchetes e jornais — massacre Columbine",
    sourceUrl:
      "https://www.google.com/search?tbm=isch&q=Columbine+massacre+1999+newspaper+headline",
    intent: "newspaper_archive",
    score: 90,
    reason: "Manchetes historicas para b-roll editorial e crime board."
  },
  {
    providerId: "internet-archive",
    title: "Internet Archive — Columbine 1999",
    sourceUrl: "https://archive.org/search?query=Columbine%201999",
    intent: "archive_collection",
    score: 89,
    reason: "Colecao de midia, reportagens e documentos arquivados."
  },
  {
    providerId: "youtube",
    title: "Documentarios e arquivo — Columbine no YouTube",
    sourceUrl:
      "https://www.youtube.com/results?search_query=Columbine+1999+documentary+archive",
    intent: "documentary_footage",
    score: 88,
    reason: "Referencias de documentarios e cobertura para estudo de narracao e cortes."
  },
  {
    providerId: "youtube",
    title: "Reportagens historicas — Columbine news archive",
    sourceUrl:
      "https://www.youtube.com/results?search_query=Columbine+shooting+1999+news+coverage",
    intent: "news_footage",
    score: 87,
    reason: "Cobertura jornalistica para contexto e timeline visual."
  },
  {
    providerId: "old-forums",
    title: "Threads e artigos — investigacao Columbine",
    sourceUrl:
      "https://www.google.com/search?q=Columbine+massacre+investigation+timeline+site%3Areddit.com+OR+forum",
    intent: "investigation_threads",
    score: 84,
    reason: "Discussões profundas, timelines e referencias cruzadas."
  },
  {
    providerId: "generic-web",
    title: "Wikipedia — contexto factual do caso",
    sourceUrl: "https://en.wikipedia.org/wiki/Columbine_High_School_massacre",
    intent: "factual_context",
    score: 82,
    reason: "Base factual para roteiro, datas e checagem antes da narracao."
  },
  {
    providerId: "google-images",
    title: "Memorial e vitimas — tributo editorial",
    sourceUrl:
      "https://www.google.com/search?tbm=isch&q=Columbine+memorial+victims+tribute",
    intent: "memorial_reference",
    score: 80,
    reason: "Referencias de memorial para tom respeitoso — sem sensacionalismo."
  },
  {
    providerId: "internet-archive",
    title: "TV News archive — Columbine broadcast",
    sourceUrl:
      "https://archive.org/search?query=Columbine%20news%20broadcast%201999",
    intent: "broadcast_archive",
    score: 79,
    reason: "Arquivo de telejornais da epoca."
  },
  {
    providerId: "community-miner",
    title: "Reddit — Columbine true crime community",
    sourceUrl: "https://www.reddit.com/search/?q=Columbine%20massacre%20timeline",
    intent: "community_timeline",
    score: 76,
    reason: "Timelines e perguntas do publico para calibrar hooks."
  }
];

function buildGenericLeads(query: string): CuratedSourceLead[] {
  const encoded = encodeURIComponent(query);
  const imageQuery = encodeURIComponent(`${query} archive photos news`);

  return [
    {
      providerId: "google-images",
      title: `Fotos de arquivo — ${query}`,
      sourceUrl: `https://www.google.com/search?tbm=isch&q=${imageQuery}`,
      intent: "press_photos",
      score: 88,
      reason: "Busca ampla em imagens — melhor taxa de resultado que Flickr generico."
    },
    {
      providerId: "internet-archive",
      title: `Internet Archive — ${query}`,
      sourceUrl: `https://archive.org/search?query=${encoded}`,
      intent: "archive_collection",
      score: 86,
      reason: "Documentos e midia arquivada."
    },
    {
      providerId: "youtube",
      title: `Documentarios — ${query}`,
      sourceUrl: `https://www.youtube.com/results?search_query=${encoded}+documentary`,
      intent: "documentary_footage",
      score: 85,
      reason: "Referencias de video para estudo editorial."
    },
    {
      providerId: "old-forums",
      title: `Artigos e threads — ${query}`,
      sourceUrl: `https://www.google.com/search?q=${encoded}+investigation+timeline+article`,
      intent: "article_trail",
      score: 82,
      reason: "Textos e discussoes para embasar roteiro."
    }
  ];
}

export function buildCuratedEditorialCandidates(
  brief: TopicCaseBrief | null,
  query: string
): MediaBeastCandidate[] {
  const leads =
    brief?.id === "columbine" ? COLUMBINE_LEADS : buildGenericLeads(query.trim());

  return leads.map((lead) => toCandidate(lead, brief?.id ?? query));
}