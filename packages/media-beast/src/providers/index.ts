import { comicsArchiveProvider } from "./comics-archive.js";
import { communityMinerProvider } from "./community-miner.js";
import { flickrProvider } from "./flickr.js";
import { genericWebProvider } from "./generic-web.js";
import { googleImagesProvider } from "./google-images.js";
import { internetArchiveProvider } from "./internet-archive.js";
import { oldForumsProvider } from "./old-forums.js";
import { pinterestProvider } from "./pinterest.js";
import { redditProvider } from "./reddit.js";
import { sportsArchiveProvider } from "./sports-archive.js";
import { tiktokProvider } from "./tiktok.js";
import { trendScannerProvider } from "./trend-scanner.js";
import type { MediaBeastProvider, MediaBeastProviderId } from "./types.js";
import { youtubeProvider } from "./youtube.js";

const providerRegistry: Record<MediaBeastProviderId, MediaBeastProvider> = {
  youtube: youtubeProvider,
  "google-images": googleImagesProvider,
  "internet-archive": internetArchiveProvider,
  reddit: redditProvider,
  "sports-archive": sportsArchiveProvider,
  "comics-archive": comicsArchiveProvider,
  "generic-web": genericWebProvider,
  tiktok: tiktokProvider,
  pinterest: pinterestProvider,
  "old-forums": oldForumsProvider,
  flickr: flickrProvider,
  "trend-scanner": trendScannerProvider,
  "community-miner": communityMinerProvider
};

export function listMediaBeastProviders(): MediaBeastProvider[] {
  return Object.values(providerRegistry);
}

export function getMediaBeastProviderById(
  providerId: string | null | undefined
): MediaBeastProvider | null {
  if (!providerId) {
    return null;
  }

  return providerRegistry[providerId as MediaBeastProviderId] ?? null;
}

export {
  comicsArchiveProvider,
  communityMinerProvider,
  flickrProvider,
  genericWebProvider,
  googleImagesProvider,
  internetArchiveProvider,
  oldForumsProvider,
  pinterestProvider,
  redditProvider,
  sportsArchiveProvider,
  tiktokProvider,
  trendScannerProvider,
  youtubeProvider
};