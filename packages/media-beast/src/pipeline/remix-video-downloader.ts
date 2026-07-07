import { execFile } from "node:child_process";
import { mkdir, stat } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export const remixVideoPlatforms = [
  "youtube",
  "tiktok",
  "instagram",
  "facebook",
  "twitter",
  "vimeo",
  "reddit",
  "unknown"
] as const;

export type RemixVideoPlatform = (typeof remixVideoPlatforms)[number];

export interface RemixVideoUrlInfo {
  sourceUrl: string;
  platform: RemixVideoPlatform;
  normalizedUrl: string;
  videoId: string | null;
}

export interface RemixVideoDownloadResult {
  localPath: string;
  sourceUrl: string;
  platform: RemixVideoPlatform;
  title: string;
  durationSeconds: number | null;
  thumbnailUrl: string | null;
  downloadedAt: string;
  downloader: "yt-dlp";
  fileSizeBytes: number | null;
  ytdlpVersion: string | null;
}

export interface RemixVideoDownloadOptions {
  outputDir?: string;
  maxDurationSeconds?: number;
  ytdlpPath?: string;
  timeoutMs?: number;
}

interface YtDlpMetadata {
  id?: string;
  title?: string;
  duration?: number;
  thumbnail?: string;
  extractor?: string;
  webpage_url?: string;
}

const PLATFORM_PATTERNS: Array<{ platform: RemixVideoPlatform; pattern: RegExp }> = [
  { platform: "youtube", pattern: /(^|\.)youtube\.com$/i },
  { platform: "youtube", pattern: /(^|\.)youtu\.be$/i },
  { platform: "tiktok", pattern: /(^|\.)tiktok\.com$/i },
  { platform: "instagram", pattern: /(^|\.)instagram\.com$/i },
  { platform: "facebook", pattern: /(^|\.)facebook\.com$/i },
  { platform: "facebook", pattern: /(^|\.)fb\.watch$/i },
  { platform: "twitter", pattern: /(^|\.)twitter\.com$/i },
  { platform: "twitter", pattern: /(^|\.)x\.com$/i },
  { platform: "vimeo", pattern: /(^|\.)vimeo\.com$/i },
  { platform: "reddit", pattern: /(^|\.)reddit\.com$/i }
];

const LOCAL_VIDEO_EXTENSIONS = new Set([
  ".mp4",
  ".mov",
  ".mkv",
  ".webm",
  ".m4v",
  ".avi"
]);

export class RemixVideoDownloadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RemixVideoDownloadError";
  }
}

const YOUTUBE_CLIENT_STRATEGIES = [
  "youtube:player_client=android",
  "youtube:player_client=ios",
  "youtube:player_client=web",
  "youtube:player_client=android,web"
] as const;

const DOWNLOAD_FORMAT_STRATEGIES = [
  "bv*[ext=mp4]+ba[ext=m4a]/b[ext=mp4]/bv*+ba/b",
  "bv*+ba/b",
  "best[ext=mp4]/best",
  "bestvideo*+bestaudio/best",
  "b",
  "worst"
] as const;

export function isLocalVideoPath(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) {
    return false;
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return false;
  }

  const extension = trimmed.slice(trimmed.lastIndexOf(".")).toLowerCase();
  return LOCAL_VIDEO_EXTENSIONS.has(extension) || trimmed.includes("\\") || trimmed.includes("/");
}

export function isRemixVideoUrl(value: string): boolean {
  try {
    parseRemixVideoUrl(value);
    return true;
  } catch {
    return false;
  }
}

function detectPlatform(hostname: string): RemixVideoPlatform {
  const match = PLATFORM_PATTERNS.find((entry) => entry.pattern.test(hostname));
  return match?.platform ?? "unknown";
}

function extractVideoId(platform: RemixVideoPlatform, url: URL): string | null {
  if (platform === "youtube") {
    if (url.hostname.includes("youtu.be")) {
      return url.pathname.replace(/^\//, "") || null;
    }
    return url.searchParams.get("v");
  }

  if (platform === "tiktok") {
    const parts = url.pathname.split("/").filter(Boolean);
    const videoIndex = parts.indexOf("video");
    if (videoIndex >= 0 && parts[videoIndex + 1]) {
      return parts[videoIndex + 1] ?? null;
    }
  }

  if (platform === "instagram") {
    const parts = url.pathname.split("/").filter(Boolean);
    const reelOrPost = parts[0];
    if ((reelOrPost === "reel" || reelOrPost === "p" || reelOrPost === "tv") && parts[1]) {
      return parts[1] ?? null;
    }
  }

  if (platform === "vimeo") {
    const parts = url.pathname.split("/").filter(Boolean);
    return parts[0] ?? null;
  }

  if (platform === "reddit") {
    const parts = url.pathname.split("/").filter(Boolean);
    const commentsIndex = parts.indexOf("comments");
    if (commentsIndex >= 0 && parts[commentsIndex + 1]) {
      return parts[commentsIndex + 1] ?? null;
    }
  }

  return null;
}

export function parseRemixVideoUrl(rawUrl: string): RemixVideoUrlInfo {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    throw new Error("sourceUrl is required.");
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error(`Invalid remix source URL: ${trimmed}`);
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Remix source URL must use http or https.");
  }

  const platform = detectPlatform(parsed.hostname);
  if (platform === "unknown") {
    throw new Error(
      `Unsupported remix source host '${parsed.hostname}'. Supported: YouTube, TikTok, Instagram, Facebook, X/Twitter, Vimeo, Reddit.`
    );
  }

  return {
    sourceUrl: trimmed,
    platform,
    normalizedUrl: parsed.toString(),
    videoId: extractVideoId(platform, parsed)
  };
}

function resolveDefaultOutputDir(customDir?: string): string {
  if (customDir) {
    return resolve(customDir);
  }

  return resolve(
    process.env.REELFORGE_REMIX_DOWNLOAD_DIR ??
      join(homedir(), ".reelforge", "remix-downloads")
  );
}

function resolveYtdlpPath(customPath?: string): string {
  return customPath ?? process.env.YTDLP_PATH ?? process.env.YT_DLP_PATH ?? "yt-dlp";
}

async function runYtdlp(
  ytdlpPath: string,
  args: string[],
  timeoutMs: number
): Promise<{ stdout: string; stderr: string }> {
  try {
    const result = await execFileAsync(ytdlpPath, args, {
      timeout: timeoutMs,
      maxBuffer: 8 * 1024 * 1024,
      windowsHide: true
    });

    return {
      stdout: result.stdout?.toString() ?? "",
      stderr: result.stderr?.toString() ?? ""
    };
  } catch (error) {
    const execError = error as NodeJS.ErrnoException & {
      stdout?: string;
      stderr?: string;
      killed?: boolean;
      signal?: string;
    };

    if (execError.code === "ENOENT") {
      throw new Error(
        `yt-dlp not found at '${ytdlpPath}'. Install yt-dlp and ensure it is on PATH, or set YTDLP_PATH.`
      );
    }

    if (execError.killed) {
      throw new Error(`yt-dlp timed out after ${timeoutMs}ms.`);
    }

    const stderr = execError.stderr?.toString().trim();
    const stdout = execError.stdout?.toString().trim();
    const detail = stderr || stdout || execError.message;
    const needsYtdlpUpgrade =
      /yt-dlp -U|latest version|no video formats found|requested format is not available/i.test(
        detail
      );
    const upgradeHint = needsYtdlpUpgrade
      ? " Atualize o yt-dlp: pip install -U yt-dlp (versão atual pode estar desatualizada para YouTube)."
      : "";
    throw new RemixVideoDownloadError(`Download falhou: ${detail}${upgradeHint}`);
  }
}

function buildYtdlpBaseArgs(
  platform: RemixVideoPlatform,
  options?: { youtubeClient?: string | null }
): string[] {
  const args = [
    "--no-playlist",
    "--no-warnings",
    "--retries",
    "3",
    "--fragment-retries",
    "3",
    "--ignore-no-formats-error"
  ];

  if (platform === "youtube" && options?.youtubeClient) {
    args.push("--extractor-args", options.youtubeClient);
  }

  if (platform === "instagram" || platform === "tiktok") {
    args.push("--user-agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36");
  }

  return args;
}

async function probeYtdlpMetadata(
  ytdlpPath: string,
  url: string,
  platform: RemixVideoPlatform,
  timeoutMs: number
): Promise<YtDlpMetadata> {
  const clientAttempts =
    platform === "youtube"
      ? [...YOUTUBE_CLIENT_STRATEGIES, null]
      : [null];

  let lastError: unknown = null;

  for (const youtubeClient of clientAttempts) {
    try {
      const args = [
        ...buildYtdlpBaseArgs(platform, { youtubeClient }),
        "--skip-download",
        "--dump-single-json",
        url
      ];
      const { stdout } = await runYtdlp(ytdlpPath, args, timeoutMs);

      try {
        return JSON.parse(stdout) as YtDlpMetadata;
      } catch {
        throw new RemixVideoDownloadError("yt-dlp retornou JSON de metadados inválido.");
      }
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError instanceof RemixVideoDownloadError) {
    throw lastError;
  }

  throw new RemixVideoDownloadError(
    "Não foi possível ler metadados do vídeo. Tente outro link ou atualize o yt-dlp (yt-dlp -U)."
  );
}

async function downloadWithFormatFallback(input: {
  ytdlpPath: string;
  url: string;
  platform: RemixVideoPlatform;
  outputTemplate: string;
  maxDurationSeconds: number;
  timeoutMs: number;
  youtubeClient: string | null;
}): Promise<void> {
  let lastError: unknown = null;

  for (const format of DOWNLOAD_FORMAT_STRATEGIES) {
    try {
      const downloadArgs = [
        ...buildYtdlpBaseArgs(input.platform, { youtubeClient: input.youtubeClient }),
        "--restrict-filenames",
        "-f",
        format,
        "--merge-output-format",
        "mp4",
        "-o",
        input.outputTemplate
      ];

      if (input.maxDurationSeconds > 0) {
        downloadArgs.push("--match-filter", `duration <= ${input.maxDurationSeconds}`);
      }

      downloadArgs.push(input.url);
      await runYtdlp(input.ytdlpPath, downloadArgs, input.timeoutMs);
      return;
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError instanceof RemixVideoDownloadError) {
    throw lastError;
  }

  throw new RemixVideoDownloadError(
    "Nenhum formato de vídeo compatível encontrado para este link."
  );
}

async function readYtdlpVersion(ytdlpPath: string): Promise<string | null> {
  try {
    const { stdout } = await runYtdlp(ytdlpPath, ["--version"], 10_000);
    return stdout.trim() || null;
  } catch {
    return null;
  }
}

function sanitizeFilenamePart(value: string): string {
  return value
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

export async function downloadRemixVideoFromUrl(
  sourceUrl: string,
  options: RemixVideoDownloadOptions = {}
): Promise<RemixVideoDownloadResult> {
  const urlInfo = parseRemixVideoUrl(sourceUrl);
  const ytdlpPath = resolveYtdlpPath(options.ytdlpPath);
  const outputDir = resolveDefaultOutputDir(options.outputDir);
  const timeoutMs = options.timeoutMs ?? 180_000;
  const maxDurationSeconds = options.maxDurationSeconds ?? 60;

  await mkdir(outputDir, { recursive: true });

  const metadata = await probeYtdlpMetadata(
    ytdlpPath,
    urlInfo.normalizedUrl,
    urlInfo.platform,
    timeoutMs
  );
  const videoId = metadata.id ?? urlInfo.videoId ?? Buffer.from(urlInfo.normalizedUrl).toString("base64url").slice(0, 12);
  const title = metadata.title?.trim() || `${urlInfo.platform} video ${videoId}`;
  const outputStem = `${urlInfo.platform}-${videoId}-${sanitizeFilenamePart(title)}`.replace(/\s+/g, "_");
  const outputTemplate = join(outputDir, `${outputStem}.%(ext)s`);

  const clientAttempts =
    urlInfo.platform === "youtube"
      ? [...YOUTUBE_CLIENT_STRATEGIES, null]
      : [null];

  let downloaded = false;
  let lastDownloadError: unknown = null;

  for (const youtubeClient of clientAttempts) {
    try {
      await downloadWithFormatFallback({
        ytdlpPath,
        url: urlInfo.normalizedUrl,
        platform: urlInfo.platform,
        outputTemplate,
        maxDurationSeconds,
        timeoutMs,
        youtubeClient
      });
      downloaded = true;
      break;
    } catch (error) {
      lastDownloadError = error;
    }
  }

  if (!downloaded) {
    if (lastDownloadError instanceof RemixVideoDownloadError) {
      throw lastDownloadError;
    }
    throw new RemixVideoDownloadError(
      "Falha ao baixar o vídeo. Verifique o link ou atualize o yt-dlp (yt-dlp -U)."
    );
  }

  const expectedMp4 = join(outputDir, `${outputStem}.mp4`);
  let localPath = expectedMp4;

  try {
    await stat(expectedMp4);
  } catch {
    const { stdout } = await runYtdlp(
      ytdlpPath,
      [...buildYtdlpBaseArgs(urlInfo.platform), "--print", "after_move:filepath", urlInfo.normalizedUrl],
      timeoutMs
    );
    const printedPath = stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .at(-1);

    if (!printedPath) {
      throw new Error("yt-dlp finished but no output file path was detected.");
    }

    localPath = resolve(printedPath);
    await stat(localPath);
  }

  const fileStats = await stat(localPath);
  const ytdlpVersion = await readYtdlpVersion(ytdlpPath);

  return {
    localPath,
    sourceUrl: metadata.webpage_url ?? urlInfo.normalizedUrl,
    platform: urlInfo.platform,
    title,
    durationSeconds:
      typeof metadata.duration === "number" && Number.isFinite(metadata.duration)
        ? Math.round(metadata.duration)
        : null,
    thumbnailUrl: metadata.thumbnail ?? null,
    downloadedAt: new Date().toISOString(),
    downloader: "yt-dlp",
    fileSizeBytes: fileStats.size,
    ytdlpVersion
  };
}

export async function resolveRemixVideoInput(input: {
  inputVideoPath?: string;
  sourceUrl?: string;
  downloadOptions?: RemixVideoDownloadOptions;
  autoDownload?: boolean;
}): Promise<{
  localPath: string;
  title: string;
  kind: "local_path" | "public_url";
  sourceUrl: string | null;
  platform: RemixVideoPlatform | "local";
  download: RemixVideoDownloadResult | null;
}> {
  const sourceUrl = input.sourceUrl?.trim();
  const inputVideoPath = input.inputVideoPath?.trim();

  if (sourceUrl && inputVideoPath) {
    throw new Error("Provide only one of sourceUrl or inputVideoPath.");
  }

  if (!sourceUrl && !inputVideoPath) {
    throw new Error("Provide sourceUrl or inputVideoPath.");
  }

  if (inputVideoPath) {
    const resolved = resolve(inputVideoPath);
    await stat(resolved);
    return {
      localPath: resolved,
      title: basename(resolved),
      kind: "local_path",
      sourceUrl: null,
      platform: "local",
      download: null
    };
  }

  if (!sourceUrl) {
    throw new Error("sourceUrl is required.");
  }

  if (isLocalVideoPath(sourceUrl)) {
    const resolved = resolve(sourceUrl);
    await stat(resolved);
    return {
      localPath: resolved,
      title: basename(resolved),
      kind: "local_path",
      sourceUrl: null,
      platform: "local",
      download: null
    };
  }

  const shouldDownload = input.autoDownload !== false;
  if (!shouldDownload) {
    throw new Error("autoDownload=false is not supported for public URLs in remix flow.");
  }

  const download = await downloadRemixVideoFromUrl(sourceUrl, input.downloadOptions);
  return {
    localPath: download.localPath,
    title: download.title,
    kind: "public_url",
    sourceUrl: download.sourceUrl,
    platform: download.platform,
    download
  };
}

export function getDefaultRemixDownloadDir(): string {
  return resolveDefaultOutputDir();
}

export function getRemixDownloadTempDir(): string {
  return join(tmpdir(), "reelforge-remix-downloads");
}