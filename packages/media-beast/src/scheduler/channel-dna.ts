import type { MediaBeastNiche } from "../providers/types.js";

export interface ChannelDNA {
  id: string;
  name: string;
  niche: MediaBeastNiche;
  language: string;
  tone: string;
  visualBias: string[];
  narrationBias: string;
  musicPresetId: string;
  audioMasteringPresetId: string;
  riskTolerance: "low" | "medium";
  dailyShortTarget: number;
  preferredProviders: string[];
}

export function createChannelDNA(input: Partial<ChannelDNA> & Pick<ChannelDNA, "id" | "name" | "niche">): ChannelDNA {
  const isSports = input.niche === "vintage_football";
  const isDark = input.niche === "true_crime" || input.niche === "history";
  const isHorror = input.niche === "cinema";

  return {
    id: input.id,
    name: input.name,
    niche: input.niche,
    language: input.language ?? "pt-BR",
    tone: input.tone ?? (isSports ? "hype documentary" : isDark ? "dark documentary" : "cinematic explainer"),
    visualBias:
      input.visualBias ??
      (isSports
        ? ["hype_sports", "sports_hype", "neon_retro", "cinematic_doc"]
        : isDark
          ? ["dark_cinematic", "crime_board", "noir_investigation", "archive_grit"]
          : ["documentary_premium", "cinematic_doc", "museum_macro", "archive_grit"]),
    narrationBias:
      input.narrationBias ??
      (isSports ? "sports_hype_ptbr" : isDark ? "true_crime_dark_ptbr" : "documentary_ptbr"),
    musicPresetId: input.musicPresetId ?? (isSports ? "football_hype" : isDark ? "true_crime_dark" : "cinematic_epic"),
    audioMasteringPresetId:
      input.audioMasteringPresetId ??
      (isSports
        ? "football_hype"
        : input.niche === "true_crime" || isHorror
          ? "true_crime_dark"
          : "documentary_clean"),
    riskTolerance: input.riskTolerance ?? "low",
    dailyShortTarget: input.dailyShortTarget ?? 5,
    preferredProviders:
      input.preferredProviders ??
      (isSports
        ? [
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
          ]
        : [
            "trend-scanner",
            "community-miner",
            "old-forums",
            "internet-archive",
            "flickr",
            "pinterest",
            "google-images",
            "tiktok",
            "generic-web",
            "reddit"
          ])
  };
}

