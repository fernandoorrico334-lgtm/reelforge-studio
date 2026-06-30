import { copyFile, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  MediaProviderError,
  inferMediaTypeFromUrl,
  isAllowedMediaExtension,
  isSafeDownloadContentType,
  normalizeMediaType,
  sanitizeDownloadFilename,
  type MediaCollectorMediaType,
  type MediaDownloadResult,
  type MediaProvider,
  type MediaProviderCandidateLike,
  type MediaSearchOptions,
  type MediaSearchResult
} from "@reelforge/media-collector";
import { projectRoot } from "../../../config/paths.js";
import {
  detectImageDimensions,
  inferMimeType,
  normalizeExtension
} from "../../assets/infrastructure/asset-file-utils.js";
import type {
  MediaCollectorProviderDescriptor,
  MediaCollectorProviderId
} from "../domain/media-collector.js";

const maxDownloadBytes = Number(
  process.env.MEDIA_COLLECTOR_MAX_DOWNLOAD_BYTES ?? 120 * 1024 * 1024
);
const defaultTimeoutMs = Number(
  process.env.MEDIA_COLLECTOR_DOWNLOAD_TIMEOUT_MS ?? 20_000
);
const redirectLimit = Number(
  process.env.MEDIA_COLLECTOR_MAX_REDIRECTS ?? 4
);
const collectorUserAgent =
  process.env.MEDIA_COLLECTOR_USER_AGENT ??
  "ReelForgeStudio/1.0 (local media collector)";

const imageMediaTypes: MediaCollectorMediaType[] = ["image", "overlay", "reference"];
const audiovisualMediaTypes: MediaCollectorMediaType[] = [
  "image",
  "video",
  "audio",
  "music",
  "sfx",
  "overlay",
  "reference"
];
const allMediaTypes: MediaCollectorMediaType[] = [
  "image",
  "video",
  "audio",
  "music",
  "sfx",
  "overlay",
  "document",
  "reference"
];
const mimeExtensionFallbacks: Record<string, string> = {
  "application/json": ".json",
  "application/pdf": ".pdf",
  "audio/aac": ".aac",
  "audio/mp4": ".m4a",
  "audio/mpeg": ".mp3",
  "audio/ogg": ".ogg",
  "audio/wav": ".wav",
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "text/csv": ".csv",
  "text/markdown": ".md",
  "text/plain": ".txt",
  "video/mp4": ".mp4",
  "video/quicktime": ".mov",
  "video/webm": ".webm"
};

interface ProviderDefinition {
  descriptor: Omit<MediaCollectorProviderDescriptor, "configured">;
  provider: MediaProvider;
}

export interface ResolvedMediaProviderEntry {
  descriptor: MediaCollectorProviderDescriptor;
  provider: MediaProvider;
}

interface DownloadContext {
  providerId: MediaCollectorProviderId;
  candidate: MediaProviderCandidateLike;
  destinationDir: string;
}

function stripHtml(value: string | null | undefined) {
  return value?.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() ?? null;
}

function ensureSearchQuery(query: string, providerId: MediaCollectorProviderId) {
  const normalized = query.trim();

  if (!normalized) {
    throw new MediaProviderError({
      code: "missing_query",
      message: "A search query is required for this provider.",
      providerId
    });
  }

  return normalized;
}

function ensureApiKey(
  providerId: MediaCollectorProviderId,
  apiKey: string | null | undefined,
  envName: string
) {
  const normalized = apiKey?.trim();

  if (!normalized) {
    throw new MediaProviderError({
      code: "missing_api_key",
      message: `Configure ${envName} before using ${providerId}.`,
      providerId
    });
  }

  return normalized;
}

function resolveAbortSignal(timeoutMs: number) {
  return AbortSignal.timeout(timeoutMs > 0 ? timeoutMs : defaultTimeoutMs);
}

function inferExtensionFromSource(
  sourceUrl: string | null | undefined,
  mimeType: string | null | undefined,
  fallbackExtension: string | null | undefined
) {
  const explicitExtension = normalizeExtension(fallbackExtension ?? "");

  if (explicitExtension) {
    return explicitExtension;
  }

  if (sourceUrl) {
    try {
      const url = new URL(sourceUrl);
      const fromUrl = normalizeExtension(url.pathname);

      if (fromUrl) {
        return fromUrl;
      }
    } catch {
      const fromPath = normalizeExtension(sourceUrl);

      if (fromPath) {
        return fromPath;
      }
    }
  }

  const normalizedMimeType = (mimeType ?? "").split(";")[0]?.trim().toLowerCase() ?? "";
  return mimeExtensionFallbacks[normalizedMimeType] ?? "";
}

function resolveMimeType(
  extension: string,
  candidate: MediaProviderCandidateLike,
  responseContentType: string | null | undefined
) {
  return inferMimeType(extension, responseContentType ?? candidate.mimeType ?? "");
}

async function buildDownloadResult(
  localPath: string,
  filename: string,
  candidate: MediaProviderCandidateLike,
  responseContentType: string | null | undefined
): Promise<MediaDownloadResult> {
  const fileStats = await stat(localPath);
  const extension =
    inferExtensionFromSource(
      candidate.downloadUrl ?? candidate.sourceUrl ?? candidate.previewUrl ?? null,
      responseContentType,
      candidate.extension
    ) || normalizeExtension(filename);
  const mimeType = resolveMimeType(extension, candidate, responseContentType);
  const imageDimensions = mimeType.startsWith("image/")
    ? detectImageDimensions(await readFile(localPath), extension, mimeType)
    : { width: null, height: null };

  return {
    localPath,
    filename,
    mimeType,
    extension,
    fileSize: fileStats.size,
    width: imageDimensions.width,
    height: imageDimensions.height,
    duration: null
  };
}

function buildSafeFilename(candidate: MediaProviderCandidateLike, extension: string) {
  const rawName =
    candidate.title ||
    basename(candidate.downloadUrl ?? candidate.sourceUrl ?? "media-file");

  return `${sanitizeDownloadFilename(rawName)}${extension}`;
}

async function writeBufferDownload(
  buffer: Buffer,
  destinationDir: string,
  candidate: MediaProviderCandidateLike,
  responseContentType: string | null | undefined
) {
  const extension =
    inferExtensionFromSource(
      candidate.downloadUrl ?? candidate.sourceUrl ?? candidate.previewUrl ?? null,
      responseContentType,
      candidate.extension
    ) || ".bin";
  const filename = buildSafeFilename(candidate, extension);
  const localPath = join(destinationDir, filename);

  await writeFile(localPath, buffer);
  return buildDownloadResult(localPath, filename, candidate, responseContentType);
}

function assertAllowedDownload(
  providerId: MediaCollectorProviderId,
  candidate: MediaProviderCandidateLike,
  extension: string,
  contentType: string | null | undefined
) {
  if (!extension || !isAllowedMediaExtension(candidate.mediaType, extension)) {
    throw new MediaProviderError({
      code: "unsupported_extension",
      message: `Extension '${extension || "unknown"}' is not supported for ${candidate.mediaType}.`,
      providerId
    });
  }

  if (!isSafeDownloadContentType(candidate.mediaType, contentType)) {
    throw new MediaProviderError({
      code: "unsafe_content_type",
      message: `Content-Type '${contentType ?? "unknown"}' is not allowed for ${candidate.mediaType}.`,
      providerId
    });
  }
}

async function fetchWithRedirects(
  rawUrl: string,
  timeoutMs: number,
  providerId: MediaCollectorProviderId
) {
  let currentUrl = rawUrl;

  for (let attempt = 0; attempt <= redirectLimit; attempt += 1) {
    const response = await fetch(currentUrl, {
      method: "GET",
      redirect: "manual",
      signal: resolveAbortSignal(timeoutMs),
      headers: {
        "User-Agent": collectorUserAgent,
        Accept: "*/*"
      }
    });

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");

      if (!location) {
        throw new MediaProviderError({
          code: "redirect_missing_location",
          message: "The provider returned a redirect without a location.",
          providerId
        });
      }

      currentUrl = new URL(location, currentUrl).toString();
      continue;
    }

    if (!response.ok) {
      throw new MediaProviderError({
        code: "download_failed",
        message: `Download request failed with status ${response.status}.`,
        providerId,
        retryable: response.status >= 500
      });
    }

    return response;
  }

  throw new MediaProviderError({
    code: "redirect_limit",
    message: "The download exceeded the redirect safety limit.",
    providerId
  });
}

function resolveLocalCandidatePath(source: string) {
  const trimmed = source.trim();

  if (trimmed.startsWith("file://")) {
    return fileURLToPath(trimmed);
  }

  return resolve(projectRoot, trimmed);
}

async function downloadLocalFile({
  providerId,
  candidate,
  destinationDir
}: DownloadContext): Promise<MediaDownloadResult> {
  const source = candidate.downloadUrl ?? candidate.sourceUrl ?? candidate.previewUrl;

  if (!source) {
    throw new MediaProviderError({
      code: "missing_source_url",
      message: "The provider candidate does not expose a downloadable local source.",
      providerId
    });
  }

  const absoluteSourcePath = resolveLocalCandidatePath(source);
  const sourceStats = await stat(absoluteSourcePath);

  if (!sourceStats.isFile()) {
    throw new MediaProviderError({
      code: "invalid_local_source",
      message: "The provided local path does not point to a file.",
      providerId
    });
  }

  if (sourceStats.size > maxDownloadBytes) {
    throw new MediaProviderError({
      code: "file_too_large",
      message: `The local file exceeds the ${maxDownloadBytes} byte limit.`,
      providerId
    });
  }

  const extension =
    inferExtensionFromSource(source, candidate.mimeType ?? null, candidate.extension) ||
    normalizeExtension(absoluteSourcePath);
  const mimeType = resolveMimeType(extension, candidate, candidate.mimeType ?? null);
  assertAllowedDownload(providerId, candidate, extension, mimeType);

  const filename = buildSafeFilename(candidate, extension);
  const destinationPath = join(destinationDir, filename);
  await copyFile(absoluteSourcePath, destinationPath);

  return buildDownloadResult(destinationPath, filename, candidate, mimeType);
}

async function downloadHttpFile({
  providerId,
  candidate,
  destinationDir
}: DownloadContext): Promise<MediaDownloadResult> {
  const source = candidate.downloadUrl ?? candidate.sourceUrl ?? candidate.previewUrl;

  if (!source) {
    throw new MediaProviderError({
      code: "missing_source_url",
      message: "The provider candidate does not expose a downloadable URL.",
      providerId
    });
  }

  const response = await fetchWithRedirects(
    source,
    defaultTimeoutMs,
    providerId
  );
  const contentType = response.headers.get("content-type");
  const advertisedLength = Number(response.headers.get("content-length") ?? 0);

  if (Number.isFinite(advertisedLength) && advertisedLength > maxDownloadBytes) {
    throw new MediaProviderError({
      code: "file_too_large",
      message: `The download exceeds the ${maxDownloadBytes} byte limit.`,
      providerId
    });
  }

  const extension =
    inferExtensionFromSource(source, contentType, candidate.extension) || ".bin";
  assertAllowedDownload(providerId, candidate, extension, contentType);

  const buffer = Buffer.from(await response.arrayBuffer());

  if (buffer.byteLength > maxDownloadBytes) {
    throw new MediaProviderError({
      code: "file_too_large",
      message: `The download exceeds the ${maxDownloadBytes} byte limit.`,
      providerId
    });
  }

  return writeBufferDownload(buffer, destinationDir, candidate, contentType);
}

async function genericDownload(context: DownloadContext) {
  const source =
    context.candidate.downloadUrl ??
    context.candidate.sourceUrl ??
    context.candidate.previewUrl;

  if (!source) {
    throw new MediaProviderError({
      code: "missing_source_url",
      message: "The provider candidate does not expose a downloadable source.",
      providerId: context.providerId
    });
  }

  await mkdir(context.destinationDir, { recursive: true });

  if (source.startsWith("file://")) {
    return downloadLocalFile(context);
  }

  if (/^[a-zA-Z]:\\/u.test(source) || source.startsWith("./") || source.startsWith("../")) {
    return downloadLocalFile(context);
  }

  return downloadHttpFile(context);
}

async function fetchJson<T>(
  url: string,
  providerId: MediaCollectorProviderId,
  init?: RequestInit
) {
  const response = await fetch(url, {
    ...init,
    signal: resolveAbortSignal(defaultTimeoutMs),
    headers: {
      "User-Agent": collectorUserAgent,
      Accept: "application/json",
      ...(init?.headers ?? {})
    }
  });

  if (!response.ok) {
    throw new MediaProviderError({
      code: "search_failed",
      message: `${providerId} search failed with status ${response.status}.`,
      providerId,
      retryable: response.status >= 500
    });
  }

  return (await response.json()) as T;
}

function createProviderDefinition(input: ProviderDefinition) {
  return input;
}

const providerDefinitions = [
  createProviderDefinition({
    descriptor: {
      id: "manual-url",
      name: "Manual URL",
      description:
        "Aceita URLs diretas ou caminhos locais informados pelo usuario, sem scraping.",
      requiresApiKey: false,
      apiKeyEnv: null,
      experimental: false,
      supportedMediaTypes: allMediaTypes
    },
    provider: {
      id: "manual-url",
      name: "Manual URL",
      description:
        "Aceita URLs diretas ou caminhos locais informados pelo usuario.",
      requiresApiKey: false,
      supportedMediaTypes: allMediaTypes,
      async search() {
        return [];
      },
      async getCandidateDetails(candidate) {
        const inferredMediaType = inferMediaTypeFromUrl(
          candidate.downloadUrl ?? candidate.sourceUrl ?? candidate.previewUrl ?? ""
        );
        const extension = inferExtensionFromSource(
          candidate.downloadUrl ?? candidate.sourceUrl ?? candidate.previewUrl ?? null,
          candidate.mimeType ?? null,
          candidate.extension
        );

        return {
          detectedType: inferredMediaType,
          mimeType: extension ? inferMimeType(extension, candidate.mimeType ?? "") : null,
          extension: extension || null
        };
      },
      async download(candidate, destination) {
        return genericDownload({
          providerId: "manual-url",
          candidate,
          destinationDir: destination
        });
      }
    }
  }),
  createProviderDefinition({
    descriptor: {
      id: "wikimedia-commons",
      name: "Wikimedia Commons",
      description:
        "Busca midias publicas da Wikimedia Commons por query textual.",
      requiresApiKey: false,
      apiKeyEnv: null,
      experimental: false,
      supportedMediaTypes: imageMediaTypes
    },
    provider: {
      id: "wikimedia-commons",
      name: "Wikimedia Commons",
      description: "Busca midias publicas na Wikimedia Commons.",
      requiresApiKey: false,
      supportedMediaTypes: imageMediaTypes,
      async search(query, options) {
        const limit = Math.min(Math.max(options.limit ?? 8, 1), 25);
        const normalizedQuery = ensureSearchQuery(query, "wikimedia-commons");
        const url =
          "https://commons.wikimedia.org/w/api.php?" +
          new URLSearchParams({
            action: "query",
            generator: "search",
            gsrsearch: normalizedQuery,
            gsrlimit: String(limit),
            prop: "imageinfo|info",
            iiprop: "url|mime|extmetadata",
            iiurlwidth: "720",
            inprop: "url",
            format: "json",
            origin: "*"
          }).toString();
        const payload = await fetchJson<{
          query?: {
            pages?: Record<
              string,
              {
                title: string;
                canonicalurl?: string;
                imageinfo?: Array<{
                  url?: string;
                  thumburl?: string;
                  mime?: string;
                  size?: number;
                  width?: number;
                  height?: number;
                  extmetadata?: Record<string, { value?: string }>;
                }>;
              }
            >;
          };
        }>(url, "wikimedia-commons");

        return Object.values(payload.query?.pages ?? {}).flatMap((page) => {
          const info = page.imageinfo?.[0];

          if (!info?.url) {
            return [];
          }

          return [
            {
              title: page.title.replace(/^File:/iu, ""),
              previewUrl: info.thumburl ?? info.url,
              downloadUrl: info.url,
              sourceUrl: page.canonicalurl ?? info.url,
              sourceAuthor: stripHtml(info.extmetadata?.Artist?.value) ?? "Wikimedia Commons",
              sourceLicense:
                stripHtml(info.extmetadata?.LicenseShortName?.value) ?? "Commons",
              sourceLicenseUrl:
                stripHtml(info.extmetadata?.LicenseUrl?.value) ?? null,
              mediaType: normalizeMediaType(options.mediaType ?? "image"),
              detectedType: "image",
              suggestedCategory: "REFERENCE",
              suggestedTags: [],
              width: info.width ?? null,
              height: info.height ?? null,
              duration: null,
              fileSize: info.size ?? null,
              extension: inferExtensionFromSource(info.url, info.mime ?? null, null) || null,
              mimeType: info.mime ?? null,
              usageNotes: "Verifique atribuicao e licenca antes de publicar."
            } satisfies MediaSearchResult
          ];
        });
      },
      async getCandidateDetails(candidate) {
        return {
          detectedType: inferMediaTypeFromUrl(candidate.downloadUrl ?? candidate.sourceUrl ?? "") ?? "image"
        };
      },
      async download(candidate, destination) {
        return genericDownload({
          providerId: "wikimedia-commons",
          candidate,
          destinationDir: destination
        });
      }
    }
  }),
  createProviderDefinition({
    descriptor: {
      id: "nasa-media",
      name: "NASA Media",
      description: "Busca imagens e videos publicos do acervo oficial da NASA.",
      requiresApiKey: false,
      apiKeyEnv: null,
      experimental: false,
      supportedMediaTypes: ["image", "video", "reference"]
    },
    provider: {
      id: "nasa-media",
      name: "NASA Media",
      description: "Busca imagens e videos publicos da NASA.",
      requiresApiKey: false,
      supportedMediaTypes: ["image", "video", "reference"],
      async search(query, options) {
        const normalizedQuery = ensureSearchQuery(query, "nasa-media");
        const limit = Math.min(Math.max(options.limit ?? 8, 1), 25);
        const mediaType =
          options.mediaType && options.mediaType !== "reference"
            ? options.mediaType
            : "image";
        const payload = await fetchJson<{
          collection?: {
            items?: Array<{
              data?: Array<{
                title?: string;
                description?: string;
                nasa_id?: string;
                media_type?: string;
                photographer?: string;
                secondary_creator?: string;
              }>;
              links?: Array<{
                href?: string;
                rel?: string;
                render?: string;
              }>;
              href?: string;
            }>;
          };
        }>(
          "https://images-api.nasa.gov/search?" +
            new URLSearchParams({
              q: normalizedQuery,
              media_type: mediaType === "video" ? "video" : "image"
            }).toString(),
          "nasa-media"
        );

        return (payload.collection?.items ?? []).slice(0, limit).flatMap((item) => {
          const data = item.data?.[0];
          const preview = item.links?.find((entry) => Boolean(entry.href))?.href ?? null;

          if (!data?.title || !preview) {
            return [];
          }

          return [
            {
              title: data.title,
              previewUrl: preview,
              downloadUrl: preview,
              sourceUrl: item.href ?? preview,
              sourceAuthor: data.photographer ?? data.secondary_creator ?? "NASA",
              sourceLicense: "public-domain",
              sourceLicenseUrl: "https://www.nasa.gov/multimedia/guidelines/index.html",
              mediaType: normalizeMediaType(data.media_type ?? mediaType),
              detectedType: data.media_type ?? null,
              suggestedCategory: "REFERENCE",
              suggestedTags: [],
              width: null,
              height: null,
              duration: null,
              fileSize: null,
              extension: inferExtensionFromSource(preview, null, null) || null,
              mimeType: null,
              usageNotes: "Acervo NASA. Revisar contexto e atribuicao."
            } satisfies MediaSearchResult
          ];
        });
      },
      async getCandidateDetails(candidate) {
        return {
          detectedType: inferMediaTypeFromUrl(candidate.downloadUrl ?? candidate.sourceUrl ?? "") ?? "image"
        };
      },
      async download(candidate, destination) {
        return genericDownload({
          providerId: "nasa-media",
          candidate,
          destinationDir: destination
        });
      }
    }
  }),
  createProviderDefinition({
    descriptor: {
      id: "internet-archive",
      name: "Internet Archive",
      description:
        "Busca itens publicos e documentais do Internet Archive. Provider experimental.",
      requiresApiKey: false,
      apiKeyEnv: null,
      experimental: true,
      supportedMediaTypes: ["image", "document", "reference"]
    },
    provider: {
      id: "internet-archive",
      name: "Internet Archive",
      description: "Busca metadados publicos do Internet Archive.",
      requiresApiKey: false,
      supportedMediaTypes: ["image", "document", "reference"],
      async search(query, options) {
        const limit = Math.min(Math.max(options.limit ?? 8, 1), 20);
        const normalizedQuery = ensureSearchQuery(query, "internet-archive");
        const payload = await fetchJson<{
          response?: {
            docs?: Array<{
              identifier?: string;
              title?: string;
              creator?: string;
              mediatype?: string;
              licenseurl?: string;
            }>;
          };
        }>(
          "https://archive.org/advancedsearch.php?" +
            new URLSearchParams({
              q: normalizedQuery,
              "fl[]": "identifier,title,creator,licenseurl,mediatype",
              rows: String(limit),
              page: "1",
              output: "json"
            }).toString(),
          "internet-archive"
        );

        return (payload.response?.docs ?? []).flatMap((doc) => {
          if (!doc.identifier || !doc.title) {
            return [];
          }

          const sourceUrl = `https://archive.org/details/${doc.identifier}`;
          return [
            {
              title: doc.title,
              previewUrl: null,
              downloadUrl: null,
              sourceUrl,
              sourceAuthor: doc.creator ?? "Internet Archive",
              sourceLicense: doc.licenseurl ? "see-license-url" : "public-archive",
              sourceLicenseUrl: doc.licenseurl ?? null,
              mediaType:
                doc.mediatype === "texts"
                  ? "document"
                  : normalizeMediaType(options.mediaType ?? "reference"),
              detectedType: doc.mediatype ?? null,
              suggestedCategory: "REFERENCE",
              suggestedTags: [],
              width: null,
              height: null,
              duration: null,
              fileSize: null,
              extension: null,
              mimeType: null,
              usageNotes:
                "Provider experimental. Confirme se ha arquivo direto antes de importar."
            } satisfies MediaSearchResult
          ];
        });
      },
      async getCandidateDetails() {
        return {
          usageNotes:
            "Provider experimental. Alguns itens podem exigir revisao manual do link direto."
        };
      },
      async download(candidate, destination) {
        return genericDownload({
          providerId: "internet-archive",
          candidate,
          destinationDir: destination
        });
      }
    }
  }),
  createProviderDefinition({
    descriptor: {
      id: "pexels",
      name: "Pexels",
      description:
        "Busca fotos e videos via API oficial da Pexels. Requer key opcional.",
      requiresApiKey: true,
      apiKeyEnv: "PEXELS_API_KEY",
      experimental: false,
      supportedMediaTypes: ["image", "video", "reference"]
    },
    provider: {
      id: "pexels",
      name: "Pexels",
      description: "Busca fotos e videos via API oficial da Pexels.",
      requiresApiKey: true,
      supportedMediaTypes: ["image", "video", "reference"],
      async search(query, options) {
        const apiKey = ensureApiKey("pexels", options.apiKey, "PEXELS_API_KEY");
        const normalizedQuery = ensureSearchQuery(query, "pexels");
        const limit = Math.min(Math.max(options.limit ?? 8, 1), 30);

        if (options.mediaType === "video") {
          const payload = await fetchJson<{
            videos?: Array<{
              id: number;
              user?: { name?: string };
              url?: string;
              duration?: number;
              width?: number;
              height?: number;
              image?: string;
              video_files?: Array<{ link?: string; file_type?: string }>;
            }>;
          }>(
            "https://api.pexels.com/videos/search?" +
              new URLSearchParams({
                query: normalizedQuery,
                per_page: String(limit)
              }).toString(),
            "pexels",
            {
              headers: {
                Authorization: apiKey
              }
            }
          );

          return (payload.videos ?? []).flatMap((video) => {
            const videoFile = video.video_files?.find((file) => file.link?.includes(".mp4"));

            if (!videoFile?.link) {
              return [];
            }

            return [
              {
                title: `Pexels video ${video.id}`,
                previewUrl: video.image ?? null,
                downloadUrl: videoFile.link,
                sourceUrl: video.url ?? videoFile.link,
                sourceAuthor: video.user?.name ?? "Pexels",
                sourceLicense: "pexels-license",
                sourceLicenseUrl: "https://www.pexels.com/license/",
                mediaType: "video",
                detectedType: "video",
                suggestedCategory: "BROLL",
                suggestedTags: [],
                width: video.width ?? null,
                height: video.height ?? null,
                duration: video.duration ?? null,
                fileSize: null,
                extension: ".mp4",
                mimeType: "video/mp4",
                usageNotes: "Verifique os termos da licenca Pexels para o seu canal."
              } satisfies MediaSearchResult
            ];
          });
        }

        const payload = await fetchJson<{
          photos?: Array<{
            id: number;
            photographer?: string;
            url?: string;
            width?: number;
            height?: number;
            src?: {
              large2x?: string;
              medium?: string;
            };
          }>;
        }>(
          "https://api.pexels.com/v1/search?" +
            new URLSearchParams({
              query: normalizedQuery,
              per_page: String(limit)
            }).toString(),
          "pexels",
          {
            headers: {
              Authorization: apiKey
            }
          }
        );

        return (payload.photos ?? []).flatMap((photo) => {
          const downloadUrl = photo.src?.large2x ?? photo.src?.medium ?? null;

          if (!downloadUrl) {
            return [];
          }

          return [
            {
              title: `Pexels photo ${photo.id}`,
              previewUrl: photo.src?.medium ?? downloadUrl,
              downloadUrl,
              sourceUrl: photo.url ?? downloadUrl,
              sourceAuthor: photo.photographer ?? "Pexels",
              sourceLicense: "pexels-license",
              sourceLicenseUrl: "https://www.pexels.com/license/",
              mediaType: "image",
              detectedType: "image",
              suggestedCategory: "REFERENCE",
              suggestedTags: [],
              width: photo.width ?? null,
              height: photo.height ?? null,
              duration: null,
              fileSize: null,
              extension: inferExtensionFromSource(downloadUrl, "image/jpeg", null) || ".jpg",
              mimeType: "image/jpeg",
              usageNotes: "Verifique os termos da licenca Pexels para o seu canal."
            } satisfies MediaSearchResult
          ];
        });
      },
      async getCandidateDetails() {
        return {};
      },
      async download(candidate, destination) {
        return genericDownload({
          providerId: "pexels",
          candidate,
          destinationDir: destination
        });
      }
    }
  }),
  createProviderDefinition({
    descriptor: {
      id: "pixabay",
      name: "Pixabay",
      description:
        "Busca fotos, vetores e videos pela API oficial do Pixabay. Requer key opcional.",
      requiresApiKey: true,
      apiKeyEnv: "PIXABAY_API_KEY",
      experimental: false,
      supportedMediaTypes: ["image", "video", "reference"]
    },
    provider: {
      id: "pixabay",
      name: "Pixabay",
      description: "Busca fotos e videos via API oficial do Pixabay.",
      requiresApiKey: true,
      supportedMediaTypes: ["image", "video", "reference"],
      async search(query, options) {
        const apiKey = ensureApiKey("pixabay", options.apiKey, "PIXABAY_API_KEY");
        const normalizedQuery = ensureSearchQuery(query, "pixabay");
        const limit = Math.min(Math.max(options.limit ?? 8, 1), 50);

        if (options.mediaType === "video") {
          const payload = await fetchJson<{
            hits?: Array<{
              id: number;
              user?: string;
              pageURL?: string;
              videos?: {
                medium?: { url?: string; width?: number; height?: number };
              };
            }>;
          }>(
            "https://pixabay.com/api/videos/?" +
              new URLSearchParams({
                key: apiKey,
                q: normalizedQuery,
                per_page: String(limit)
              }).toString(),
            "pixabay"
          );

          return (payload.hits ?? []).flatMap((hit) => {
            const video = hit.videos?.medium;

            if (!video?.url) {
              return [];
            }

            return [
              {
                title: `Pixabay video ${hit.id}`,
                previewUrl: null,
                downloadUrl: video.url,
                sourceUrl: hit.pageURL ?? video.url,
                sourceAuthor: hit.user ?? "Pixabay",
                sourceLicense: "pixabay-license",
                sourceLicenseUrl: "https://pixabay.com/service/license-summary/",
                mediaType: "video",
                detectedType: "video",
                suggestedCategory: "BROLL",
                suggestedTags: [],
                width: video.width ?? null,
                height: video.height ?? null,
                duration: null,
                fileSize: null,
                extension: ".mp4",
                mimeType: "video/mp4",
                usageNotes: "Revise os termos da licenca Pixabay."
              } satisfies MediaSearchResult
            ];
          });
        }

        const payload = await fetchJson<{
          hits?: Array<{
            id: number;
            user?: string;
            pageURL?: string;
            largeImageURL?: string;
            previewURL?: string;
            imageWidth?: number;
            imageHeight?: number;
          }>;
        }>(
          "https://pixabay.com/api/?" +
            new URLSearchParams({
              key: apiKey,
              q: normalizedQuery,
              per_page: String(limit)
            }).toString(),
          "pixabay"
        );

        return (payload.hits ?? []).flatMap((hit) => {
          if (!hit.largeImageURL) {
            return [];
          }

          return [
            {
              title: `Pixabay image ${hit.id}`,
              previewUrl: hit.previewURL ?? hit.largeImageURL,
              downloadUrl: hit.largeImageURL,
              sourceUrl: hit.pageURL ?? hit.largeImageURL,
              sourceAuthor: hit.user ?? "Pixabay",
              sourceLicense: "pixabay-license",
              sourceLicenseUrl: "https://pixabay.com/service/license-summary/",
              mediaType: "image",
              detectedType: "image",
              suggestedCategory: "REFERENCE",
              suggestedTags: [],
              width: hit.imageWidth ?? null,
              height: hit.imageHeight ?? null,
              duration: null,
              fileSize: null,
              extension: inferExtensionFromSource(hit.largeImageURL, "image/jpeg", null) || ".jpg",
              mimeType: "image/jpeg",
              usageNotes: "Revise os termos da licenca Pixabay."
            } satisfies MediaSearchResult
          ];
        });
      },
      async getCandidateDetails() {
        return {};
      },
      async download(candidate, destination) {
        return genericDownload({
          providerId: "pixabay",
          candidate,
          destinationDir: destination
        });
      }
    }
  }),
  createProviderDefinition({
    descriptor: {
      id: "unsplash",
      name: "Unsplash",
      description:
        "Busca imagens via API oficial do Unsplash. Requer access key opcional.",
      requiresApiKey: true,
      apiKeyEnv: "UNSPLASH_ACCESS_KEY",
      experimental: false,
      supportedMediaTypes: ["image", "reference"]
    },
    provider: {
      id: "unsplash",
      name: "Unsplash",
      description: "Busca imagens via API oficial do Unsplash.",
      requiresApiKey: true,
      supportedMediaTypes: ["image", "reference"],
      async search(query, options) {
        const apiKey = ensureApiKey(
          "unsplash",
          options.apiKey,
          "UNSPLASH_ACCESS_KEY"
        );
        const normalizedQuery = ensureSearchQuery(query, "unsplash");
        const limit = Math.min(Math.max(options.limit ?? 8, 1), 30);
        const payload = await fetchJson<{
          results?: Array<{
            id: string;
            alt_description?: string | null;
            description?: string | null;
            user?: { name?: string };
            links?: { html?: string };
            urls?: { regular?: string; small?: string };
            width?: number;
            height?: number;
          }>;
        }>(
          "https://api.unsplash.com/search/photos?" +
            new URLSearchParams({
              query: normalizedQuery,
              per_page: String(limit)
            }).toString(),
          "unsplash",
          {
            headers: {
              Authorization: `Client-ID ${apiKey}`
            }
          }
        );

        return (payload.results ?? []).flatMap((result) => {
          const downloadUrl = result.urls?.regular ?? result.urls?.small ?? null;

          if (!downloadUrl) {
            return [];
          }

          return [
            {
              title:
                result.alt_description ??
                result.description ??
                `Unsplash image ${result.id}`,
              previewUrl: result.urls?.small ?? downloadUrl,
              downloadUrl,
              sourceUrl: result.links?.html ?? downloadUrl,
              sourceAuthor: result.user?.name ?? "Unsplash",
              sourceLicense: "unsplash-license",
              sourceLicenseUrl: "https://unsplash.com/license",
              mediaType: "image",
              detectedType: "image",
              suggestedCategory: "REFERENCE",
              suggestedTags: [],
              width: result.width ?? null,
              height: result.height ?? null,
              duration: null,
              fileSize: null,
              extension: inferExtensionFromSource(downloadUrl, "image/jpeg", null) || ".jpg",
              mimeType: "image/jpeg",
              usageNotes: "Revise a politica de atribuicao do Unsplash."
            } satisfies MediaSearchResult
          ];
        });
      },
      async getCandidateDetails() {
        return {};
      },
      async download(candidate, destination) {
        return genericDownload({
          providerId: "unsplash",
          candidate,
          destinationDir: destination
        });
      }
    }
  })
] satisfies ProviderDefinition[];

export function resolveMediaProviderEntries() {
  return providerDefinitions.map(({ descriptor, provider }) => ({
    descriptor: {
      ...descriptor,
      configured: descriptor.requiresApiKey
        ? Boolean(descriptor.apiKeyEnv && process.env[descriptor.apiKeyEnv]?.trim())
        : true
    },
    provider
  })) satisfies ResolvedMediaProviderEntry[];
}

export function getMediaProviderEntry(providerId: MediaCollectorProviderId) {
  return resolveMediaProviderEntries().find(
    (entry) => entry.descriptor.id === providerId
  );
}

export function getMediaProviderApiKey(providerId: MediaCollectorProviderId) {
  const entry = getMediaProviderEntry(providerId);

  if (!entry?.descriptor.apiKeyEnv) {
    return null;
  }

  return process.env[entry.descriptor.apiKeyEnv] ?? null;
}