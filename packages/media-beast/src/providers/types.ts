export const mediaBeastNiches = [
  "history",
  "cinema",
  "vintage_football",
  "true_crime",
  "anime",
  "bodybuilding",
  "comics",
  "science_curiosities",
  "generic_broll"
] as const;

export type MediaBeastNiche = (typeof mediaBeastNiches)[number];

export const mediaBeastProviderIds = [
  "youtube",
  "google-images",
  "internet-archive",
  "reddit",
  "sports-archive",
  "comics-archive",
  "generic-web",
  "tiktok",
  "pinterest",
  "old-forums",
  "flickr",
  "trend-scanner",
  "community-miner"
] as const;

export type MediaBeastProviderId = (typeof mediaBeastProviderIds)[number];

export type MediaBeastCandidateKind =
  | "image"
  | "video"
  | "audio"
  | "document"
  | "webpage"
  | "dataset";

export type MediaBeastLicenseStatus =
  | "public_domain"
  | "creative_commons"
  | "royalty_free"
  | "owned"
  | "editorial_only"
  | "unknown"
  | "restricted";

export type MediaBeastRiskLevel = "low" | "medium" | "high" | "blocked";

export interface MediaBeastSearchQuery {
  niche: MediaBeastNiche;
  keywords: string[];
  language?: string;
  maxCandidates?: number;
  dateAfter?: string | null;
  dateBefore?: string | null;
  filters?: Record<string, string | number | boolean | null>;
}

export interface MediaBeastProviderCapabilities {
  supportsImages: boolean;
  supportsVideos: boolean;
  supportsAudio: boolean;
  supportsDocuments: boolean;
  supportsDateFilters: boolean;
  supportsLicenseMetadata: boolean;
  discoveryOnly: boolean;
  importSupported: boolean;
  requiresApiKey: boolean;
  setupInstructions: string;
}

export interface MediaBeastProviderDescriptor {
  id: MediaBeastProviderId;
  name: string;
  description: string;
  enabled: boolean;
  capabilities: MediaBeastProviderCapabilities;
  riskNotes: string[];
}

export interface MediaBeastCandidate {
  id: string;
  providerId: MediaBeastProviderId;
  kind: MediaBeastCandidateKind;
  title: string;
  sourceUrl: string;
  previewUrl: string | null;
  licenseStatus: MediaBeastLicenseStatus;
  riskLevel: MediaBeastRiskLevel;
  score: number;
  reasons: string[];
  warnings: string[];
  metadata: Record<string, string | number | boolean | null>;
}

export interface MediaBeastProvider {
  descriptor: MediaBeastProviderDescriptor;
  buildQueries(input: MediaBeastSearchQuery): string[];
  searchCandidates(input: MediaBeastSearchQuery): Promise<MediaBeastCandidate[]>;
}
