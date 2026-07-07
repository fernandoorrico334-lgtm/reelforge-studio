import { getMusicPresetById } from "@reelforge/audio-engine";
import { getVoicePackById } from "@reelforge/narration-engine";
import type { MediaBeastEngine } from "../beast-engine.js";
import { getMediaBeastNichePresetById } from "../niches/niche-presets.js";
import { buildNarrationOverlayPlan } from "../pipeline/narration-overlay.js";
import { createChannelDNA, type ChannelDNA } from "../scheduler/channel-dna.js";
import type { MediaBeastCandidate, MediaBeastNiche, MediaBeastProviderId } from "../providers/types.js";
import {
  buildCaseNarrationScript,
  buildTopicDiscoveryQueries,
  detectTopicCase,
  listShortAngles
} from "./topic-knowledge.js";
import { buildCuratedEditorialCandidates } from "./curated-source-leads.js";
import {
  filterEditorialDisplayCandidates,
  rankEditorialDiscoveryCandidates
} from "./discovery-ranker.js";

const EDITORIAL_DISCOVERY_PROVIDERS: MediaBeastProviderId[] = [
  "google-images",
  "internet-archive",
  "youtube",
  "old-forums",
  "community-miner",
  "reddit",
  "generic-web",
  "pinterest"
];

export interface EditorialShortPackInput {
  query: string;
  nichePresetId: string;
  durationSeconds?: number;
  targetCandidateCount?: number;
  language?: string;
}

export interface EditorialMusicPick {
  presetId: string;
  name: string;
  description: string;
  volume: number;
  ducking: number;
  copyrightSafePath: string;
  moodReason: string;
}

export interface EditorialShortPack {
  query: string;
  topicCaseId: string | null;
  durationSeconds: number;
  channelDNA: ChannelDNA;
  candidates: MediaBeastCandidate[];
  displayCandidates: MediaBeastCandidate[];
  shortAngles: string[];
  narrationScript: string;
  captions: string[];
  voicePackId: string;
  voicePackLabel: string;
  voiceStyle: string;
  music: EditorialMusicPick;
  narrationPlan: ReturnType<typeof buildNarrationOverlayPlan>;
  sensitivityNotes: string[];
  productionNotes: string[];
  warnings: string[];
}

function mapPresetToNiche(presetId: string): MediaBeastNiche {
  const preset = getMediaBeastNichePresetById(presetId);
  return preset?.niches[0] ?? "true_crime";
}

function buildMusicPick(niche: MediaBeastNiche, topicCaseId: string | null): EditorialMusicPick {
  const presetId =
    topicCaseId || niche === "true_crime" || niche === "history"
      ? "true_crime_dark"
      : niche === "vintage_football"
        ? "football_hype"
        : "cinematic_epic";

  const preset = getMusicPresetById(presetId)!;

  return {
    presetId: preset.id,
    name: preset.name,
    description: preset.description,
    volume: topicCaseId ? 0.09 : preset.defaultMusicVolume,
    ducking: preset.defaultNarrationDucking,
    copyrightSafePath:
      "Use trilhas da biblioteca local / presets royalty-free do projeto — nunca trend sounds de TikTok.",
    moodReason:
      topicCaseId === "columbine"
        ? "Tensao suave e cinematografica — sustenta emocao e suspense sem cobrir a voz."
        : "Trilha emocional discreta que amplifica o drama sem competir com a narracao."
  };
}

function synthesizeLeadCandidate(
  query: string,
  niche: MediaBeastNiche,
  top: MediaBeastCandidate | null
): MediaBeastCandidate {
  if (top) {
    return top;
  }

  return {
    id: `editorial-lead-${Buffer.from(query).toString("base64url").slice(0, 12)}`,
    providerId: "google-images",
    kind: "image",
    title: `Editorial lead: ${query}`,
    sourceUrl: `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(`${query} archive photos`)}`,
    previewUrl: null,
    licenseStatus: "unknown",
    riskLevel: "high",
    score: 70,
    reasons: [
      "Lead editorial sintetizado para roteiro quando discovery retorna poucos visuais.",
      "Abra imagens e arquivo manualmente antes de qualquer uso."
    ],
    warnings: [
      "Discovery-only: imagens exigem verificacao de direitos.",
      "Priorize arquivo jornalistico e fotos editoriais licenciadas."
    ],
    metadata: {
      temporalLens: "past",
      searchIntent: "editorial_lead",
      discoveryOnly: true,
      synthesized: true
    }
  };
}

export async function buildEditorialShortPack(
  engine: MediaBeastEngine,
  input: EditorialShortPackInput
): Promise<EditorialShortPack> {
  const preset = getMediaBeastNichePresetById(input.nichePresetId);
  const niche = mapPresetToNiche(input.nichePresetId);
  const durationSeconds = input.durationSeconds ?? 50;
  const language = input.language ?? "pt-BR";
  const topicCase = detectTopicCase(input.query);
  const discoveryQueries = buildTopicDiscoveryQueries(input.query, input.nichePresetId);

  const discoveryRuns = await Promise.all(
    discoveryQueries.slice(0, 4).map((phrase) =>
      engine.discover({
        niche,
        keywords: [phrase],
        language,
        maxCandidates: 8,
        providerIds: EDITORIAL_DISCOVERY_PROVIDERS
      })
    )
  );

  const curatedCandidates = buildCuratedEditorialCandidates(topicCase, input.query);

  const mergedCandidates = rankEditorialDiscoveryCandidates(
    [
      ...curatedCandidates,
      ...discoveryRuns
        .flatMap((run) => run.candidates)
        .filter(
          (candidate, index, array) =>
            array.findIndex((item) => item.id === candidate.id) === index
        )
    ],
    input.query
  );

  const targetCount = input.targetCandidateCount ?? 12;
  const displayCandidates = filterEditorialDisplayCandidates(
    mergedCandidates,
    input.query,
    targetCount
  );
  const leadCandidate = synthesizeLeadCandidate(
    input.query,
    niche,
    displayCandidates[0] ?? mergedCandidates[0] ?? null
  );

  const music = buildMusicPick(niche, topicCase?.id ?? null);
  const voicePackId =
    niche === "true_crime" || niche === "history" || niche === "cinema"
      ? "true_crime_dark_ptbr"
      : niche === "vintage_football"
        ? "sports_hype_ptbr"
        : "documentary_ptbr";
  const voicePack = getVoicePackById(voicePackId);

  const channelDNA = createChannelDNA({
    id: `editorial-${input.nichePresetId}`,
    name: preset?.name ?? "Beast Editorial",
    niche,
    language,
    tone: preset?.channelTone ?? "dark documentary",
    musicPresetId: music.presetId,
    audioMasteringPresetId: music.presetId,
    narrationBias: voicePackId,
    dailyShortTarget: 5
  });

  const caseScript = buildCaseNarrationScript({
    query: input.query,
    durationSeconds,
    language
  });

  const narrationPlan = buildNarrationOverlayPlan({
    candidate: leadCandidate,
    channelDNA,
    maxDurationSeconds: durationSeconds,
    narrationBias: voicePackId
  });

  const narrationScript = topicCase ? caseScript.script : narrationPlan.suggestedScript;
  const captions = topicCase ? caseScript.captions : narrationPlan.overlayCaptions;

  const shortAngles = listShortAngles(input.query, 50);
  const warnings = [
    "Candidate-first: links sao para pesquisa manual, nao import automatico.",
    "Roteiro gerado para ~50 segundos — revise fatos, tom e sensibilidade antes de gravar.",
    ...(topicCase?.sensitivityNotes ?? preset?.riskNotes ?? []).slice(0, 3)
  ];

  return {
    query: input.query,
    topicCaseId: topicCase?.id ?? null,
    durationSeconds,
    channelDNA,
    candidates: mergedCandidates,
    displayCandidates,
    shortAngles,
    narrationScript,
    captions,
    voicePackId,
    voicePackLabel: voicePack?.name ?? voicePackId,
    voiceStyle:
      "cinema documental emotivo — pausas longas no horror, aceleracao no climax, voz grave que prende",
    music,
    narrationPlan: {
      ...narrationPlan,
      suggestedScript: narrationScript,
      overlayCaptions: captions
    },
    sensitivityNotes: topicCase?.sensitivityNotes ?? preset?.riskNotes ?? [],
    productionNotes: [
      `Discovery editorial priorizou fotos, arquivo e reportagens — ${displayCandidates.length} fontes visuais no topo.`,
      `Musica: ${music.name} (${music.presetId}) com volume baixo (${music.volume}) para nao brigar com a voz.`,
      `Legenda inferior: ${captions.length} blocos prontos para caption-engine.`,
      `Potencial de batch: ${shortAngles.length} angulos diferentes para shorts do mesmo caso.`,
      topicCase
        ? `Caso reconhecido: ${topicCase.id} (${topicCase.year}) — roteiro factual embutido.`
        : "Caso generico — enriqueca com pesquisa manual nas fontes listadas."
    ],
    warnings
  };
}