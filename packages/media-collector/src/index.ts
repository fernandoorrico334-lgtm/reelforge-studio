export const mediaCollectorMediaTypes = [
  "image",
  "video",
  "audio",
  "music",
  "sfx",
  "overlay",
  "document",
  "reference"
] as const;

export type MediaCollectorMediaType =
  (typeof mediaCollectorMediaTypes)[number];

export interface MediaSearchQuery {
  query: string;
  reason: string;
  mediaType: MediaCollectorMediaType | null;
  tags: string[];
}

export interface MediaSearchOptions {
  limit?: number;
  mediaType?: MediaCollectorMediaType | null;
  apiKey?: string | null;
  timeoutMs?: number;
}

export interface MediaSearchResult {
  title: string;
  previewUrl: string | null;
  downloadUrl: string | null;
  sourceUrl: string | null;
  sourceAuthor: string | null;
  sourceLicense: string | null;
  sourceLicenseUrl: string | null;
  mediaType: MediaCollectorMediaType;
  detectedType: string | null;
  suggestedCategory: string | null;
  suggestedTags: string[];
  suggestedCharacter?: string | null;
  suggestedProject?: string | null;
  width: number | null;
  height: number | null;
  duration: number | null;
  fileSize: number | null;
  extension: string | null;
  mimeType: string | null;
  usageNotes: string | null;
}

export interface MediaDownloadResult {
  localPath: string;
  filename: string;
  mimeType: string | null;
  extension: string;
  fileSize: number;
  width: number | null;
  height: number | null;
  duration: number | null;
}

export class MediaProviderError extends Error {
  code: string;
  providerId: string;
  retryable: boolean;

  constructor(input: {
    code: string;
    message: string;
    providerId: string;
    retryable?: boolean;
  }) {
    super(input.message);
    this.name = "MediaProviderError";
    this.code = input.code;
    this.providerId = input.providerId;
    this.retryable = input.retryable ?? false;
  }
}

export interface MediaProviderCandidateLike {
  title: string;
  previewUrl?: string | null;
  downloadUrl?: string | null;
  sourceUrl?: string | null;
  mediaType: MediaCollectorMediaType;
  mimeType?: string | null;
  extension?: string | null;
}

export interface MediaProvider {
  id: string;
  name: string;
  description: string;
  requiresApiKey: boolean;
  supportedMediaTypes: MediaCollectorMediaType[];
  search(
    query: string,
    options: MediaSearchOptions
  ): Promise<MediaSearchResult[]>;
  getCandidateDetails(
    candidate: MediaProviderCandidateLike
  ): Promise<Partial<MediaSearchResult>>;
  download(
    candidate: MediaProviderCandidateLike,
    destination: string
  ): Promise<MediaDownloadResult>;
}

export interface AssetRequirementQueryInput {
  description: string;
  mediaType?: string | null;
  suggestedTags?: string[] | null;
  emotion?: string | null;
  sceneRole?: string | null;
}

export interface DossierQueryInput {
  title: string;
  topic: string;
  niche?: string | null;
  tone?: string | null;
}

const imageExtensions = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const videoExtensions = new Set([".mp4", ".mov", ".webm"]);
const audioExtensions = new Set([".mp3", ".wav", ".m4a", ".aac", ".ogg"]);
const documentExtensions = new Set([".pdf", ".txt", ".md", ".json", ".csv"]);

const allowedExtensionsByMediaType: Record<
  MediaCollectorMediaType,
  Set<string>
> = {
  image: imageExtensions,
  video: videoExtensions,
  audio: audioExtensions,
  music: audioExtensions,
  sfx: audioExtensions,
  overlay: new Set([".png", ".webp", ".mov", ".webm"]),
  document: documentExtensions,
  reference: new Set([
    ...imageExtensions,
    ...videoExtensions,
    ...audioExtensions,
    ...documentExtensions
  ])
};

function uniqueStrings(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function normalizeToken(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[^\x00-\x7F]/g, "")
    .toLowerCase();
}

export function normalizeMediaType(
  value: string | null | undefined
): MediaCollectorMediaType {
  const normalized = normalizeToken(value ?? "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  switch (normalized) {
    case "image":
    case "video":
    case "audio":
    case "music":
    case "sfx":
    case "overlay":
    case "document":
    case "reference":
      return normalized;
    case "map":
      return "image";
    case "text_card":
      return "reference";
    default:
      return "reference";
  }
}

export function inferMediaTypeFromUrl(value: string) {
  try {
    const url = new URL(value);
    const normalizedPath = url.pathname.toLowerCase();

    if ([...imageExtensions].some((extension) => normalizedPath.endsWith(extension))) {
      return "image" as const;
    }

    if ([...videoExtensions].some((extension) => normalizedPath.endsWith(extension))) {
      return "video" as const;
    }

    if ([...audioExtensions].some((extension) => normalizedPath.endsWith(extension))) {
      return "audio" as const;
    }

    if ([...documentExtensions].some((extension) => normalizedPath.endsWith(extension))) {
      return "document" as const;
    }
  } catch {
    return null;
  }

  return null;
}

export function sanitizeDownloadFilename(filename: string) {
  const trimmed = filename.trim();
  const normalized = trimmed
    .normalize("NFKD")
    .replace(/[^\x00-\x7F]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || "media-file";
}

export function isAllowedMediaExtension(
  mediaType: MediaCollectorMediaType,
  extension: string
) {
  return allowedExtensionsByMediaType[mediaType].has(
    extension.trim().toLowerCase()
  );
}

export function isSafeDownloadContentType(
  mediaType: MediaCollectorMediaType,
  contentType: string | null | undefined
) {
  const normalized = (contentType ?? "").trim().toLowerCase();

  if (!normalized || normalized === "application/octet-stream") {
    return true;
  }

  if (normalized.includes("text/html")) {
    return false;
  }

  switch (mediaType) {
    case "image":
      return normalized.startsWith("image/");
    case "video":
      return normalized.startsWith("video/");
    case "audio":
    case "music":
    case "sfx":
      return normalized.startsWith("audio/");
    case "overlay":
      return normalized.startsWith("image/") || normalized.startsWith("video/");
    case "document":
      return (
        normalized === "application/pdf" ||
        normalized === "text/plain" ||
        normalized === "text/markdown" ||
        normalized === "application/json" ||
        normalized === "text/csv"
      );
    case "reference":
      return (
        normalized.startsWith("image/") ||
        normalized.startsWith("video/") ||
        normalized.startsWith("audio/") ||
        normalized === "application/pdf" ||
        normalized.startsWith("text/") ||
        normalized === "application/json"
      );
    default:
      return false;
  }
}

export function buildMediaTagsFromQuery(query: string) {
  return uniqueStrings(
    query
      .split(/[^a-zA-Z0-9]+/g)
      .map((token) => normalizeToken(token))
      .filter((token) => token.length >= 3)
  );
}

export function buildSearchQueriesFromAssetRequirement(
  requirement: AssetRequirementQueryInput
) {
  const mediaType = normalizeMediaType(requirement.mediaType ?? "reference");
  const descriptor = [
    requirement.description,
    requirement.sceneRole ?? "",
    requirement.emotion ?? "",
    ...(requirement.suggestedTags ?? [])
  ]
    .join(" ")
    .trim();
  const tags = uniqueStrings([
    ...buildMediaTagsFromQuery(descriptor),
    ...(requirement.suggestedTags ?? [])
  ]);

  return [
    {
      query: descriptor,
      reason: "Busca principal pelo requisito visual descrito no dossie.",
      mediaType,
      tags
    },
    {
      query: `${descriptor} reference archival`,
      reason: "Abrir variacoes documentais e visuais de referencia.",
      mediaType,
      tags
    },
    {
      query: `${descriptor} ${mediaType}`,
      reason: "Refinar o tipo de midia desejado para a colecao.",
      mediaType,
      tags
    }
  ] satisfies MediaSearchQuery[];
}

export function buildSearchQueriesFromDossier(
  dossier: DossierQueryInput,
  requirements: AssetRequirementQueryInput[]
) {
  const queries = requirements.flatMap((requirement) =>
    buildSearchQueriesFromAssetRequirement({
      ...requirement,
      description: `${dossier.topic} ${requirement.description}`.trim()
    })
  );
  const seen = new Set<string>();

  return queries.filter((query) => {
    const key = `${query.mediaType ?? "reference"}::${query.query.toLowerCase()}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

