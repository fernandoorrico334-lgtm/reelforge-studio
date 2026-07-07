import type { MediaBeastNiche, MediaBeastProviderId } from "../providers/types.js";

export const mediaBeastNichePresetIds = [
  "serial_killers",
  "futebol_antigo",
  "quadrinhos_classicos",
  "cinema_horror",
  "fisiculturismo",
  "historia_obscura"
] as const;

export type MediaBeastNichePresetId =
  (typeof mediaBeastNichePresetIds)[number];

export interface MediaBeastNichePreset {
  id: MediaBeastNichePresetId;
  name: string;
  description: string;
  niches: MediaBeastNiche[];
  defaultKeywords: string[];
  preferredProviders: MediaBeastProviderId[];
  defaultIntensity: "medium" | "extreme";
  channelTone: string;
  visualBias: string[];
  riskNotes: string[];
}

const presets: Record<MediaBeastNichePresetId, MediaBeastNichePreset> = {
  serial_killers: {
    id: "serial_killers",
    name: "Serial Killers 1970s",
    description:
      "True-crime documentary preset for archive-first research, timelines and dark editorial visuals.",
    niches: ["true_crime", "history"],
    defaultKeywords: ["serial killers", "1970s", "case files", "archive"],
    preferredProviders: [
      "trend-scanner",
      "community-miner",
      "old-forums",
      "internet-archive",
      "flickr",
      "pinterest",
      "tiktok",
      "google-images",
      "youtube",
      "reddit",
      "generic-web"
    ],
    defaultIntensity: "extreme",
    channelTone: "dark documentary",
    visualBias: ["crime_board", "archive_grit", "cinematic_doc"],
    riskNotes: [
      "Avoid sensationalism and unsupported claims.",
      "Prefer public records, archive context and original narration.",
      "Do not use victim imagery without clear rights and ethical review."
    ]
  },
  futebol_antigo: {
    id: "futebol_antigo",
    name: "Futebol Antigo",
    description:
      "Vintage football preset for old players, matches, stadium atmosphere and stat-driven reels.",
    niches: ["vintage_football"],
    defaultKeywords: ["futebol antigo", "craques antigos", "lances raros"],
    preferredProviders: [
      "tiktok",
      "trend-scanner",
      "community-miner",
      "sports-archive",
      "pinterest",
      "youtube",
      "flickr",
      "internet-archive",
      "old-forums",
      "reddit"
    ],
    defaultIntensity: "extreme",
    channelTone: "hype documentary",
    visualBias: ["sports_hype", "archive_grit", "cinematic_doc"],
    riskNotes: [
      "Broadcast footage is high risk unless owned or licensed.",
      "Use stats, generated visuals and approved local microclips.",
      "Keep source attribution for historical references."
    ]
  },
  quadrinhos_classicos: {
    id: "quadrinhos_classicos",
    name: "Quadrinhos Classicos",
    description:
      "Classic comics preset for public-domain candidates, golden age issue context and panel-inspired visuals.",
    niches: ["comics"],
    defaultKeywords: ["quadrinhos classicos", "golden age comics", "public domain"],
    preferredProviders: [
      "trend-scanner",
      "community-miner",
      "comics-archive",
      "pinterest",
      "old-forums",
      "flickr",
      "tiktok",
      "internet-archive",
      "google-images"
    ],
    defaultIntensity: "medium",
    channelTone: "cinematic explainer",
    visualBias: ["comic_halftone", "archive_grit", "cinematic_doc"],
    riskNotes: [
      "Old comics are not automatically public domain.",
      "Verify issue status before import.",
      "Use generated recreations when rights are unclear."
    ]
  },
  cinema_horror: {
    id: "cinema_horror",
    name: "Cinema Horror",
    description:
      "Horror cinema preset for analysis, public-domain trailers, atmosphere and dark motion design.",
    niches: ["cinema"],
    defaultKeywords: ["horror cinema", "classic horror", "behind the scenes"],
    preferredProviders: [
      "trend-scanner",
      "tiktok",
      "community-miner",
      "pinterest",
      "internet-archive",
      "youtube",
      "flickr",
      "old-forums",
      "google-images",
      "generic-web"
    ],
    defaultIntensity: "extreme",
    channelTone: "dark cinematic",
    visualBias: ["crime_board", "cinematic_doc", "archive_grit"],
    riskNotes: [
      "Movie clips and stills are usually restricted.",
      "Prefer commentary, public-domain material or generated scene boards.",
      "Do not imply affiliation with studios or franchises."
    ]
  },
  fisiculturismo: {
    id: "fisiculturismo",
    name: "Fisiculturismo",
    description:
      "Bodybuilding preset for old-school athletes, training eras and physique documentary reels.",
    niches: ["bodybuilding"],
    defaultKeywords: ["fisiculturismo antigo", "old school bodybuilding", "gym archive"],
    preferredProviders: [
      "tiktok",
      "trend-scanner",
      "community-miner",
      "flickr",
      "pinterest",
      "internet-archive",
      "youtube",
      "google-images",
      "reddit",
      "generic-web"
    ],
    defaultIntensity: "extreme",
    channelTone: "intense documentary",
    visualBias: ["bodybuilding_metal", "cinematic_doc", "archive_grit"],
    riskNotes: [
      "Athlete imagery may require rights or editorial constraints.",
      "Avoid medical claims and defamatory framing.",
      "Prefer original narration and generated visual support."
    ]
  },
  historia_obscura: {
    id: "historia_obscura",
    name: "Historia Obscura",
    description:
      "Dark history preset for obscure events, archive records, maps and documentary tension.",
    niches: ["history"],
    defaultKeywords: ["historia obscura", "arquivo historico", "documentary mystery"],
    preferredProviders: [
      "trend-scanner",
      "community-miner",
      "old-forums",
      "flickr",
      "pinterest",
      "internet-archive",
      "google-images",
      "tiktok",
      "generic-web",
      "reddit"
    ],
    defaultIntensity: "medium",
    channelTone: "dark documentary",
    visualBias: ["archive_grit", "crime_board", "cinematic_doc"],
    riskNotes: [
      "Use verified context for sensitive historical claims.",
      "Separate speculation from sourced facts.",
      "Use public-domain or manually approved archive material."
    ]
  }
};

export function listMediaBeastNichePresets() {
  return mediaBeastNichePresetIds.map((presetId) => ({ ...presets[presetId] }));
}

export function getMediaBeastNichePresetById(
  presetId: string | null | undefined
) {
  if (!presetId) {
    return null;
  }

  return presets[presetId as MediaBeastNichePresetId] ?? null;
}

