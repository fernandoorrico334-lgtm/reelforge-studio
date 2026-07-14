import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { stableCandidateId } from "../providers/provider-utils.js";
import type { MediaBeastCandidate } from "../providers/types.js";
import {
  PRIMARY_CATALOG_SOURCE_PRIORITY,
  PRIMARY_CATALOG_SOURCE_TIER,
  scoreComicsTitleRelevance
} from "./comics-catalog-discovery-shared.js";

export const COMICS_CATALOG_DOWNLOAD_INGESTION_SOURCE = "comics_catalog_download_ingestion";

export const COMICS_CATALOG_PANELS_STORAGE_DIR = "storage/assets/comics-catalog-panels";

export const COMICS_DOWNLOAD_HOSTS = [
  "workupload.com",
  "mediafire.com",
  "mega.nz",
  "mega.io",
  "dropbox.com",
  "drive.google.com"
] as const;

export type ComicsDownloadLink = {
  url: string;
  host: string;
  label: string;
  format: "pdf" | "cbr" | "cbz" | "unknown";
};

export type ComicsCatalogPanelAsset = {
  localPath: string;
  relativePath: string;
  pageFileName: string;
  pageIndex: number;
  width: number | null;
  height: number | null;
  fileSizeBytes: number;
};

export type ComicsCatalogDownloadIngestionResult = {
  postUrl: string;
  postTitle: string;
  downloadLink: ComicsDownloadLink | null;
  archivePath: string | null;
  archiveBytes: number | null;
  panelAssets: ComicsCatalogPanelAsset[];
  candidates: MediaBeastCandidate[];
  warnings: string[];
  skippedReason: string | null;
};

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"]);
export const DEFAULT_MAX_DOWNLOAD_BYTES = 80 * 1024 * 1024;
const DEFAULT_MAX_PANELS_PER_POST = 6;
export const MAX_FULL_COMIC_PAGES = 120;
const DEFAULT_POST_FETCH_TIMEOUT_MS = 20_000;
const DEFAULT_DOWNLOAD_TIMEOUT_MS = 120_000;
const DEFAULT_FETCH_RETRIES = 3;

async function fetchWithRetries(
  fetchFn: typeof fetch,
  url: string,
  init: RequestInit,
  retries = DEFAULT_FETCH_RETRIES
): Promise<Response> {
  let lastError: unknown = null;
  for (let attempt = 0; attempt < retries; attempt += 1) {
    try {
      const response = await fetchFn(url, init);
      return response;
    } catch (error) {
      lastError = error;
      if (attempt < retries - 1) {
        await new Promise((resolvePromise) => setTimeout(resolvePromise, 400 * (attempt + 1)));
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error("fetch_failed");
}

const DOWNLOAD_LINK_PATTERNS: Array<{ host: string; pattern: RegExp; format?: ComicsDownloadLink["format"] }> = [
  { host: "workupload.com", pattern: /https?:\/\/workupload\.com\/(?:file|archive)\/[A-Za-z0-9]+/gi },
  { host: "mediafire.com", pattern: /https?:\/\/(?:www\.)?mediafire\.com\/(?:file|download)\/[A-Za-z0-9/_-]+/gi },
  { host: "mega.nz", pattern: /https?:\/\/mega\.nz\/(?:file|folder)\/[A-Za-z0-9#_-]+/gi },
  { host: "mega.io", pattern: /https?:\/\/mega\.io\/(?:file|folder)\/[A-Za-z0-9#_-]+/gi },
  {
    host: "direct",
    pattern: /https?:\/\/[^\s"'<>]+\.(?:pdf|cbr|cbz)(?:\?[^\s"'<>]*)?/gi,
    format: "unknown"
  }
];

function resolveProjectRoot(projectRoot?: string): string {
  return resolve(projectRoot ?? process.cwd());
}

function detectFormatFromUrl(url: string): ComicsDownloadLink["format"] {
  const lower = url.toLowerCase();
  if (/\.pdf(?:\?|$)/i.test(lower)) return "pdf";
  if (/\.cbr(?:\?|$)/i.test(lower)) return "cbr";
  if (/\.cbz(?:\?|$)/i.test(lower)) return "cbz";
  return "unknown";
}

function sha256Hex(message: string): string {
  return createHash("sha256").update(message).digest("hex");
}

class FetchCookieJar {
  private cookies = new Map<string, string>();

  ingest(response: Response): void {
    const raw = response.headers.getSetCookie?.() ?? [];
    for (const entry of raw) {
      const [pair] = entry.split(";");
      if (!pair) continue;
      const eq = pair.indexOf("=");
      if (eq > 0) {
        this.cookies.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
      }
    }
  }

  header(): string {
    return [...this.cookies.entries()].map(([key, value]) => `${key}=${value}`).join("; ");
  }
}

function normalizeComicsDownloadUrl(url: string): string {
  return url
    .replace(/[),.;]+$/, "")
    .replace(/\/download\/([^/]+)\/file/i, "/file/$1")
    .replace(/mediafire\.com\/view\//i, "mediafire.com/file/");
}

function detectDownloadHost(url: string): string {
  if (/workupload\.com/i.test(url)) return "workupload.com";
  if (/mediafire\.com/i.test(url)) return "mediafire.com";
  if (/mega\.nz|mega\.io/i.test(url)) return "mega.nz";
  if (/dropbox\.com/i.test(url)) return "dropbox.com";
  if (/drive\.google\.com/i.test(url)) return "drive.google.com";
  return "direct";
}

function extractEditionNumber(text: string): number | null {
  const normalized = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  const editionMatch =
    normalized.match(/(?:edicao|ed\.?|#|n[ºo°.]?\s*)(\d{1,3})/i) ??
    normalized.match(/(?:^|\s)(\d{1,2})(?:\s*[-–]\s*|$|\s+cbr|\s+cbz)/i);
  if (!editionMatch?.[1]) return null;
  const value = Number.parseInt(editionMatch[1], 10);
  return Number.isFinite(value) ? value : null;
}

export function rankDownloadLinksForPostTitle(
  links: ComicsDownloadLink[],
  postTitle: string
): ComicsDownloadLink[] {
  const titleEdition = extractEditionNumber(postTitle);
  const targetEdition = titleEdition ?? 1;

  return [...links].sort((left, right) => {
    const score = (link: ComicsDownloadLink) => {
      let value = 0;
      const context = `${link.label} ${link.url}`.toLowerCase();
      const linkEdition = extractEditionNumber(context);
      if (linkEdition === targetEdition) value += 60;
      else if (!titleEdition && linkEdition === 1) value += 35;
      if (/\.cbz/i.test(link.url) || link.format === "cbz") value += 18;
      if (/\.cbr/i.test(link.url) || link.format === "cbr") value += 12;
      if (link.host === "workupload.com") value += 16;
      if (link.host === "mediafire.com") value += 8;
      if (link.format !== "unknown") value += 4;
      return value;
    };
    return score(right) - score(left);
  });
}

export function extractComicsDownloadLinksFromHtml(html: string): ComicsDownloadLink[] {
  const links: ComicsDownloadLink[] = [];
  const seen = new Set<string>();
  const anchorLabels = new Map<string, string>();

  for (const match of html.matchAll(/<a[^>]*href=["'](https?:\/\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const url = normalizeComicsDownloadUrl(match[1] ?? "");
    const anchorText = (match[2] ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (!anchorText || anchorLabels.has(url)) continue;
    anchorLabels.set(url, anchorText.slice(0, 120));
  }

  for (const rule of DOWNLOAD_LINK_PATTERNS) {
    for (const match of html.matchAll(rule.pattern)) {
      const url = normalizeComicsDownloadUrl(match[0]);
      if (seen.has(url)) continue;
      seen.add(url);
      const host = rule.host === "direct" ? detectDownloadHost(url) : rule.host;
      links.push({
        url,
        host,
        label: anchorLabels.get(url) ?? (rule.host === "direct" ? "direct_file" : rule.host),
        format: rule.format ?? detectFormatFromUrl(url)
      });
    }
  }

  return links.sort((left, right) => {
    const score = (link: ComicsDownloadLink) => {
      let value = 0;
      if (/\.cbz|\.cbr/i.test(link.url)) value += 6;
      if (link.format === "cbz" || link.format === "cbr") value += 5;
      if (link.host === "workupload.com") value += 4;
      if (link.host === "mediafire.com") value += 3;
      if (link.format !== "unknown") value += 2;
      return value;
    };
    return score(right) - score(left);
  });
}

export function extractPostTitleFromHtml(html: string, fallbackUrl: string): string {
  const ogTitle = html.match(/property=["']og:title["'][^>]*content=["']([^"']+)["']/i)?.[1];
  const titleTag = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1];
  const raw = ogTitle ?? titleTag ?? fallbackUrl;
  return raw
    .replace(/&#8902;|&#8211;|&amp;/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
}

async function solveWorkuploadCaptcha(input: {
  fileUrl: string;
  fetchFn: typeof fetch;
  jar: FetchCookieJar;
  userAgent: string;
}): Promise<void> {
  const origin = "https://workupload.com";
  const initial = await fetchWithRetries(input.fetchFn, input.fileUrl, {
    headers: { "user-agent": input.userAgent, cookie: input.jar.header() }
  });
  input.jar.ingest(initial);
  await initial.arrayBuffer().catch(() => null);

  const puzzleRes = await fetchWithRetries(input.fetchFn, `${origin}/puzzle`, {
    headers: {
      "user-agent": input.userAgent,
      cookie: input.jar.header(),
      accept: "application/json"
    }
  });
  input.jar.ingest(puzzleRes);
  const puzzleJson = (await puzzleRes.json()) as {
    data?: { puzzle: string; range: number; find: string[] };
  };
  const puzzle = puzzleJson.data?.puzzle;
  const range = puzzleJson.data?.range ?? 0;
  const find = puzzleJson.data?.find ?? [];
  if (!puzzle || !range || !find.length) {
    throw new Error("workupload_puzzle_unavailable");
  }

  const solutions: number[] = [];
  for (let index = 0; index < range; index += 1) {
    const hash = sha256Hex(`${puzzle}${index}`);
    if (find.includes(hash)) solutions.push(index);
    if (solutions.length === find.length) break;
  }
  if (solutions.length !== find.length) {
    throw new Error("workupload_puzzle_unsolved");
  }

  const captchaRes = await fetchWithRetries(input.fetchFn, `${origin}/captcha`, {
    method: "POST",
    headers: {
      "user-agent": input.userAgent,
      cookie: input.jar.header(),
      "content-type": "application/x-www-form-urlencoded",
      referer: input.fileUrl
    },
    body: new URLSearchParams({ captcha: `${solutions.join(" ")} ` })
  });
  input.jar.ingest(captchaRes);
  await captchaRes.text().catch(() => "");

  const pageRes = await fetchWithRetries(input.fetchFn, input.fileUrl, {
    headers: { "user-agent": input.userAgent, cookie: input.jar.header() }
  });
  input.jar.ingest(pageRes);
  const pageHtml = await pageRes.text();
  const title = pageHtml.match(/<title>([^<]+)<\/title>/i)?.[1] ?? "";
  if (/are you a human/i.test(title)) {
    throw new Error("workupload_captcha_failed");
  }
}

export async function resolveMediafireDownloadUrl(input: {
  fileUrl: string;
  fetchFn?: typeof fetch;
}): Promise<{ downloadUrl: string; fileName: string | null }> {
  const fetchFn = input.fetchFn ?? fetch;
  const userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";
  const response = await fetchWithRetries(fetchFn, input.fileUrl, {
    headers: {
      "user-agent": userAgent,
      accept: "text/html,application/xhtml+xml"
    },
    signal: AbortSignal.timeout(DEFAULT_POST_FETCH_TIMEOUT_MS)
  });
  if (!response.ok) {
    throw new Error(`mediafire_page_fetch_failed:${response.status}`);
  }
  const html = await response.text();

  const direct =
    html.match(/id="downloadButton"[^>]*href="(https:\/\/download\d+\.mediafire\.com\/[^"]+)"/i)?.[1] ??
    html.match(/class="[^"]*input popsok[^"]*"[^>]*href="(https:\/\/download\d+\.mediafire\.com\/[^"]+)"/i)?.[1] ??
    html.match(/aria-label="Download file"[^>]*href="(https:\/\/download\d+\.mediafire\.com\/[^"]+)"/i)?.[1] ??
    html.match(/href="(https:\/\/download\d+\.mediafire\.com\/[^"]+)"/i)?.[1] ??
    html.match(/href='(https:\/\/download\d+\.mediafire\.com\/[^']+)'/i)?.[1] ??
    html.match(/"downloadUrl":"(https:\\\/\\\/download\d+\\.mediafire\\.com\\\/[^"]+)"/i)?.[1]?.replace(
      /\\\//g,
      "/"
    ) ??
    html.match(/"href":"(https:\\\/\\\/download\d+\\.mediafire\\.com\\\/[^"]+)"/i)?.[1]?.replace(
      /\\\//g,
      "/"
    ) ??
    html.match(/window\.location\.href\s*=\s*['"](https:\/\/download\d+\.mediafire\.com\/[^'"]+)['"]/i)?.[1];

  if (!direct) {
    throw new Error("mediafire_direct_download_missing");
  }

  const fileName =
    html.match(/<div class="filename">([^<]+)<\/div>/i)?.[1]?.trim() ??
    html.match(/<title>Download ([^<]+)<\/title>/i)?.[1]?.trim() ??
    null;

  return { downloadUrl: direct, fileName };
}

export async function resolveWorkuploadDownloadUrl(input: {
  fileUrl: string;
  fetchFn?: typeof fetch;
}): Promise<{ downloadUrl: string; fileName: string | null; cookieHeader: string }> {
  const fetchFn = input.fetchFn ?? fetch;
  const jar = new FetchCookieJar();
  const userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";
  const fileId = input.fileUrl.match(/workupload\.com\/(?:file|archive)\/([A-Za-z0-9]+)/i)?.[1];
  if (!fileId) throw new Error("workupload_invalid_url");

  await solveWorkuploadCaptcha({ fileUrl: input.fileUrl, fetchFn, jar, userAgent });

  const apiRes = await fetchWithRetries(
    fetchFn,
    `https://workupload.com/api/file/getDownloadServer/${fileId}`,
    {
      headers: {
        "user-agent": userAgent,
        cookie: jar.header(),
        accept: "application/json",
        referer: input.fileUrl
      }
    }
  );
  jar.ingest(apiRes);
  const apiJson = (await apiRes.json()) as { success?: boolean; data?: { url?: string } };
  const downloadUrl = apiJson.data?.url;
  if (!downloadUrl) throw new Error("workupload_download_url_missing");

  const pageRes = await fetchWithRetries(fetchFn, input.fileUrl, {
    headers: { "user-agent": userAgent, cookie: jar.header() }
  });
  const pageHtml = await pageRes.text();
  const fileName =
    pageHtml.match(/<title>([^<]+\.(?:cbz|cbr|pdf))<\/title>/i)?.[1]?.trim() ?? null;

  return { downloadUrl, fileName, cookieHeader: jar.header() };
}

export async function downloadComicsArchiveFile(input: {
  downloadLink: ComicsDownloadLink;
  outputDir: string;
  fetchFn?: typeof fetch;
  maxBytes?: number;
  timeoutMs?: number;
  userApprovedDownload: boolean;
}): Promise<{ localPath: string; bytes: number; fileName: string; warnings: string[] }> {
  if (!input.userApprovedDownload) {
    throw new Error("download_not_approved");
  }

  const fetchFn = input.fetchFn ?? fetch;
  const maxBytes = input.maxBytes ?? DEFAULT_MAX_DOWNLOAD_BYTES;
  const timeoutMs = input.timeoutMs ?? DEFAULT_DOWNLOAD_TIMEOUT_MS;
  const warnings: string[] = [];
  await mkdir(input.outputDir, { recursive: true });

  let resolvedUrl = input.downloadLink.url;
  let cookieHeader = "";
  let fileName =
    basename(new URL(input.downloadLink.url).pathname) ||
    `comics-archive-${createHash("sha1").update(input.downloadLink.url).digest("hex").slice(0, 10)}`;

  if (input.downloadLink.host === "workupload.com") {
    const resolved = await resolveWorkuploadDownloadUrl({
      fileUrl: input.downloadLink.url,
      fetchFn
    });
    resolvedUrl = resolved.downloadUrl;
    cookieHeader = resolved.cookieHeader;
    if (resolved.fileName) fileName = resolved.fileName;
    warnings.push("workupload_captcha_solved");
  } else if (
    input.downloadLink.host === "mediafire.com" ||
    /mediafire\.com/i.test(input.downloadLink.url)
  ) {
    const resolved = await resolveMediafireDownloadUrl({
      fileUrl: input.downloadLink.url,
      fetchFn
    });
    resolvedUrl = resolved.downloadUrl;
    if (resolved.fileName) fileName = resolved.fileName;
    warnings.push("mediafire_direct_link_resolved");
  }

  const response = await fetchWithRetries(fetchFn, resolvedUrl, {
    headers: {
      "user-agent": "ReelForge-ComicsCatalogIngestion/1.0",
      ...(cookieHeader ? { cookie: cookieHeader } : {})
    },
    signal: AbortSignal.timeout(timeoutMs),
    redirect: "follow"
  });
  if (!response.ok) {
    throw new Error(`download_failed_http_${response.status}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length > maxBytes) {
    throw new Error(`download_exceeds_max_bytes:${buffer.length}/${maxBytes}`);
  }
  if (buffer.length < 1024) {
    throw new Error("download_too_small");
  }

  const extension = fileName.includes(".")
    ? fileName.slice(fileName.lastIndexOf("."))
    : buffer[0] === 0x50 && buffer[1] === 0x4b
      ? ".cbz"
      : buffer.slice(0, 4).toString("ascii") === "%PDF"
        ? ".pdf"
        : ".bin";

  const safeName = fileName.replace(/[^\w.\-()[\]]+/g, "_").slice(0, 120);
  const localPath = join(input.outputDir, safeName.endsWith(extension) ? safeName : `${safeName}${extension}`);
  await writeFile(localPath, buffer);

  return { localPath, bytes: buffer.length, fileName: basename(localPath), warnings };
}

async function runCommand(command: string, args: string[]): Promise<void> {
  await new Promise<void>((resolvePromise, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolvePromise();
      else reject(new Error(`${command} exited ${code}: ${stderr.slice(-400)}`));
    });
  });
}

async function listImageFilesRecursive(rootDir: string): Promise<string[]> {
  const results: string[] = [];
  async function walk(currentDir: string) {
    const entries = await readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(currentDir, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
        continue;
      }
      const ext = entry.name.slice(entry.name.lastIndexOf(".")).toLowerCase();
      if (IMAGE_EXTENSIONS.has(ext)) results.push(fullPath);
    }
  }
  await walk(rootDir);
  return results.sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));
}

const STORY_PANEL_SAMPLE_FRACTIONS = [0.22, 0.32, 0.42, 0.52, 0.62, 0.72];

async function scoreStoryPanelPaths(
  imagePaths: string[]
): Promise<Map<string, number>> {
  const scores = new Map<string, number>();
  if (imagePaths.length === 0) return scores;

  const total = imagePaths.length;
  const skipHead = Math.min(2, Math.max(1, Math.floor(total * 0.04)));
  const skipTail = Math.min(1, Math.max(0, Math.floor(total * 0.02)));
  const storyStart = skipHead;
  const storyEnd = Math.max(storyStart, total - skipTail - 1);
  const storySpan = Math.max(1, storyEnd - storyStart);

  for (let index = 0; index < imagePaths.length; index += 1) {
    const path = imagePaths[index]!;
    if (index < storyStart || index > storyEnd) {
      scores.set(path, -100);
      continue;
    }

    const relativePos = (index - storyStart) / storySpan;
    const storyPeak = 1 - Math.abs(relativePos - 0.45) * 1.6;
    let sizeScore = 0;
    try {
      const fileStat = await stat(path);
      sizeScore = Math.min(24, fileStat.size / 45_000);
    } catch {
      sizeScore = 0;
    }
    scores.set(path, storyPeak * 55 + sizeScore);
  }

  return scores;
}

function pickPanelPagePaths(
  imagePaths: string[],
  maxPanels: number,
  pathScores?: Map<string, number>
): string[] {
  const storyPaths = imagePaths.filter((path) => (pathScores?.get(path) ?? 0) > 0);
  const pool = storyPaths.length >= maxPanels ? storyPaths : imagePaths;
  if (pool.length <= maxPanels) return pool;

  if (pathScores && pathScores.size > 0) {
    const ranked = [...pool].sort(
      (left, right) => (pathScores.get(right) ?? 0) - (pathScores.get(left) ?? 0)
    );
    const picks: string[] = [];
    for (const path of ranked) {
      if (picks.length >= maxPanels) break;
      if (!picks.includes(path)) picks.push(path);
    }
    if (picks.length >= maxPanels) return picks;
  }

  const picks: string[] = [];
  for (const fraction of STORY_PANEL_SAMPLE_FRACTIONS) {
    if (picks.length >= maxPanels) break;
    const position = Math.min(
      pool.length - 1,
      Math.max(0, Math.floor(fraction * pool.length))
    );
    const path = pool[position];
    if (path && !picks.includes(path)) picks.push(path);
  }

  for (let index = 0; picks.length < maxPanels && index < pool.length; index += 1) {
    const path = pool[index];
    if (path && !picks.includes(path)) picks.push(path);
  }

  return picks;
}

function resolveSevenZipCandidates(): string[] {
  const cwd = process.cwd();
  const roots = [cwd, resolve(cwd, ".."), resolve(cwd, "../..")];
  const portable = roots.map((root) => join(root, "tools", "7zip", "7z.exe"));
  return [
    ...portable,
    "C:/tmp/7zipapp/7z.exe",
    "C:/Program Files/7-Zip/7z.exe",
    "C:/Program Files (x86)/7-Zip/7z.exe",
    "7z"
  ];
}

async function extractCbrArchiveWithNodeUnrar(archivePath: string, extractDir: string): Promise<void> {
  const { createExtractorFromData } = await import("node-unrar-js");
  const archiveBuffer = await readFile(archivePath);
  const data = archiveBuffer.buffer.slice(
    archiveBuffer.byteOffset,
    archiveBuffer.byteOffset + archiveBuffer.byteLength
  );
  const extractor = await createExtractorFromData({ data });
  const list = extractor.getFileList();
  const headers = [...list.fileHeaders];
  const fileNames = headers.filter((header) => !header.flags.directory).map((header) => header.name);
  if (fileNames.length === 0) {
    throw new Error("cbr_empty_archive");
  }

  const extracted = extractor.extract({ files: fileNames });
  for (const file of extracted.files) {
    if (file.fileHeader.flags.directory || !file.extraction) continue;
    const relativeName = file.fileHeader.name.replace(/\\/g, "/");
    const targetPath = join(extractDir, relativeName);
    await mkdir(dirname(targetPath), { recursive: true });
    await writeFile(targetPath, Buffer.from(file.extraction));
  }
}

export async function extractPanelImagesFromComicsArchive(input: {
  archivePath: string;
  outputDir: string;
  maxPanels?: number;
  extractAllPages?: boolean;
}): Promise<ComicsCatalogPanelAsset[]> {
  const extractAllPages = input.extractAllPages === true;
  const maxPanels = extractAllPages
    ? MAX_FULL_COMIC_PAGES
    : (input.maxPanels ?? DEFAULT_MAX_PANELS_PER_POST);
  await mkdir(input.outputDir, { recursive: true });

  const lowerPath = input.archivePath.toLowerCase();
  const extractDir = join(input.outputDir, "pages");
  await mkdir(extractDir, { recursive: true });

  if (lowerPath.endsWith(".cbz") || lowerPath.endsWith(".zip")) {
    const zipPath = lowerPath.endsWith(".cbz")
      ? join(input.outputDir, "archive.zip")
      : input.archivePath;
    if (lowerPath.endsWith(".cbz")) {
      const archiveBuffer = await readFile(input.archivePath);
      await writeFile(zipPath, archiveBuffer);
    }
    if (process.platform === "win32") {
      await runCommand("powershell", [
        "-NoProfile",
        "-Command",
        `Expand-Archive -LiteralPath '${zipPath.replace(/'/g, "''")}' -DestinationPath '${extractDir.replace(/'/g, "''")}' -Force`
      ]);
    } else {
      await runCommand("unzip", ["-oq", zipPath, "-d", extractDir]);
    }
  } else if (lowerPath.endsWith(".cbr")) {
    const sevenZipCandidates = resolveSevenZipCandidates();
    let extracted = false;
    for (const sevenZip of sevenZipCandidates) {
      try {
        await runCommand(sevenZip, ["x", input.archivePath, `-o${extractDir}`, "-y"]);
        extracted = true;
        break;
      } catch {
        continue;
      }
    }
    if (!extracted) {
      await extractCbrArchiveWithNodeUnrar(input.archivePath, extractDir);
    }
  } else if (lowerPath.endsWith(".pdf")) {
    throw new Error("pdf_rasterizer_unavailable");
  } else {
    throw new Error("unsupported_archive_format");
  }

  const imagePaths = await listImageFilesRecursive(extractDir);
  const pathScores = await scoreStoryPanelPaths(imagePaths);
  const selectedPaths = extractAllPages
    ? imagePaths.slice(0, MAX_FULL_COMIC_PAGES)
    : pickPanelPagePaths(imagePaths, maxPanels, pathScores);
  const panelAssets: ComicsCatalogPanelAsset[] = [];

  for (let index = 0; index < selectedPaths.length; index += 1) {
    const sourcePath = selectedPaths[index]!;
    const pageFileName = `panel-${String(index + 1).padStart(3, "0")}-${basename(sourcePath)}`;
    const targetPath = join(input.outputDir, pageFileName);
    const sourceBuffer = await readFile(sourcePath);
    await writeFile(targetPath, sourceBuffer);
    const fileStat = await stat(targetPath);
    panelAssets.push({
      localPath: targetPath,
      relativePath: targetPath,
      pageFileName,
      pageIndex: index + 1,
      width: null,
      height: null,
      fileSizeBytes: fileStat.size
    });
  }

  return panelAssets;
}

function buildPanelCandidate(input: {
  postUrl: string;
  postTitle: string;
  panel: ComicsCatalogPanelAsset;
  entities: string[];
  franchise: string;
  downloadLink: ComicsDownloadLink;
  catalogSource: string;
  projectRoot: string;
  catalogRelevanceScore: number;
}): MediaBeastCandidate {
  const relativePath = input.panel.localPath
    .replace(/\\/g, "/")
    .replace(`${input.projectRoot.replace(/\\/g, "/")}/`, "");
  const relevance = scoreComicsTitleRelevance(input.postTitle, input.entities);
  const title = `${input.postTitle} — comic panel p${input.panel.pageIndex} (catalog download)`;

  return {
    id: stableCandidateId("comics-archive", `${relativePath}:${input.postUrl}`),
    providerId: "comics-archive",
    kind: "image",
    title: title.slice(0, 120),
    sourceUrl: relativePath,
    previewUrl: relativePath,
    licenseStatus: "editorial_only",
    riskLevel: "high",
    score: Math.min(100, 88 + Math.min(relevance, 10)),
    reasons: [
      "comics_catalog_download_ingestion",
      PRIMARY_CATALOG_SOURCE_PRIORITY,
      `panel_page:${input.panel.pageIndex}`,
      `title_relevance:${relevance}`
    ],
    warnings: [
      "Downloaded comic panel — copyrighted; editorial analysis only unless licensed.",
      "User-approved download for pipeline visual audit — render still requires manual license review."
    ],
    metadata: {
      discoverySource: COMICS_CATALOG_DOWNLOAD_INGESTION_SOURCE,
      sourcePriority: PRIMARY_CATALOG_SOURCE_PRIORITY,
      sourceTier: PRIMARY_CATALOG_SOURCE_TIER,
      catalogPriority: true,
      catalogRelevanceScore: input.catalogRelevanceScore,
      catalogPostUrl: input.postUrl,
      catalogPostTitle: input.postTitle,
      catalogSource: input.catalogSource,
      comicsPanelPage: input.panel.pageIndex,
      comicsPanelFile: input.panel.pageFileName,
      downloadHost: input.downloadLink.host,
      downloadUrl: input.downloadLink.url,
      userApprovedDownload: true,
      directImage: true,
      searchSurface: false,
      franchise: input.franchise,
      query: `${input.postTitle} ${input.franchise} comic panel`,
      comicsVisualLanguage: `${input.franchise} comic panel scan hq quadrinhos page art`
    }
  };
}

export async function ingestComicsCatalogPanelsFromPost(input: {
  postUrl: string;
  postHtml?: string;
  postTitle?: string;
  entities: string[];
  franchise?: string;
  catalogSource: string;
  fetchFn?: typeof fetch;
  projectRoot?: string;
  batchId?: string;
  maxPanels?: number;
  extractAllPages?: boolean;
  maxDownloadBytes?: number;
  userApprovedDownload: boolean;
}): Promise<ComicsCatalogDownloadIngestionResult> {
  const fetchFn = input.fetchFn ?? fetch;
  const projectRoot = resolveProjectRoot(input.projectRoot);
  const franchise = input.franchise ?? "Marvel";
  const warnings: string[] = [];
  const batchId =
    input.batchId ??
    createHash("sha1").update(input.postUrl).digest("hex").slice(0, 12);

  let postHtml = input.postHtml;
  if (!postHtml) {
    try {
      const response = await fetchFn(input.postUrl, {
        headers: {
          "user-agent": "ReelForgeStudio/1.0 (+https://reelforge.studio; comics-download-ingestion)",
          accept: "text/html,application/xhtml+xml"
        },
        signal: AbortSignal.timeout(DEFAULT_POST_FETCH_TIMEOUT_MS)
      });
      if (!response.ok) {
        return {
          postUrl: input.postUrl,
          postTitle: input.postTitle ?? input.postUrl,
          downloadLink: null,
          archivePath: null,
          archiveBytes: null,
          panelAssets: [],
          candidates: [],
          warnings: [`post_fetch_failed:${response.status}`],
          skippedReason: "post_fetch_failed"
        };
      }
      postHtml = await response.text();
    } catch (error) {
      return {
        postUrl: input.postUrl,
        postTitle: input.postTitle ?? input.postUrl,
        downloadLink: null,
        archivePath: null,
        archiveBytes: null,
        panelAssets: [],
        candidates: [],
        warnings: [`post_fetch_error:${error instanceof Error ? error.message : "unknown"}`],
        skippedReason: "post_fetch_failed"
      };
    }
  }

  const postTitle = input.postTitle ?? extractPostTitleFromHtml(postHtml, input.postUrl);
  const downloadLinks = rankDownloadLinksForPostTitle(
    extractComicsDownloadLinksFromHtml(postHtml),
    postTitle
  );
  if (downloadLinks.length === 0) {
    return {
      postUrl: input.postUrl,
      postTitle,
      downloadLink: null,
      archivePath: null,
      archiveBytes: null,
      panelAssets: [],
      candidates: [],
      warnings: ["no_download_link_on_post"],
      skippedReason: "no_download_link"
    };
  }

  if (!input.userApprovedDownload) {
    return {
      postUrl: input.postUrl,
      postTitle,
      downloadLink: downloadLinks[0] ?? null,
      archivePath: null,
      archiveBytes: null,
      panelAssets: [],
      candidates: [],
      warnings: ["download_not_user_approved"],
      skippedReason: "not_approved"
    };
  }

  const storageDir = join(projectRoot, COMICS_CATALOG_PANELS_STORAGE_DIR, batchId);
  let downloadLink: ComicsDownloadLink | null = null;
  let downloaded: { localPath: string; bytes: number; fileName: string; warnings: string[] } | null =
    null;
  const attemptWarnings: string[] = [];

  for (const candidateLink of downloadLinks.slice(0, 12)) {
    try {
      downloaded = await downloadComicsArchiveFile({
        downloadLink: candidateLink,
        outputDir: storageDir,
        fetchFn,
        ...(input.maxDownloadBytes !== undefined ? { maxBytes: input.maxDownloadBytes } : {}),
        userApprovedDownload: true
      });
      downloadLink = candidateLink;
      warnings.push(...downloaded.warnings);
      break;
    } catch (error) {
      attemptWarnings.push(
        `download_attempt_failed:${candidateLink.url}:${error instanceof Error ? error.message : "unknown"}`
      );
    }
  }

  if (!downloaded || !downloadLink) {
    return {
      postUrl: input.postUrl,
      postTitle,
      downloadLink: downloadLinks[0] ?? null,
      archivePath: null,
      archiveBytes: null,
      panelAssets: [],
      candidates: [],
      warnings: [...attemptWarnings, "all_download_links_failed"],
      skippedReason:
        attemptWarnings[attemptWarnings.length - 1]?.split(":").pop() ?? "download_failed"
    };
  }

  try {
    const panelAssets = await extractPanelImagesFromComicsArchive({
      archivePath: downloaded.localPath,
      outputDir: join(storageDir, "panels"),
      ...(input.extractAllPages === true
        ? { extractAllPages: true }
        : input.maxPanels !== undefined
          ? { maxPanels: input.maxPanels }
          : {})
    });

    for (const panel of panelAssets) {
      panel.relativePath = panel.localPath
        .replace(/\\/g, "/")
        .replace(`${projectRoot.replace(/\\/g, "/")}/`, "");
    }

    const catalogRelevanceScore = scoreComicsTitleRelevance(postTitle, input.entities);
    const candidates = panelAssets.map((panel) =>
      buildPanelCandidate({
        postUrl: input.postUrl,
        postTitle,
        panel,
        entities: input.entities,
        franchise,
        downloadLink,
        catalogSource: input.catalogSource,
        projectRoot,
        catalogRelevanceScore
      })
    );

    warnings.push(
      `ingested_panels:${panelAssets.length} from ${downloaded.fileName} (${downloaded.bytes} bytes)`
    );

    return {
      postUrl: input.postUrl,
      postTitle,
      downloadLink,
      archivePath: downloaded.localPath,
      archiveBytes: downloaded.bytes,
      panelAssets,
      candidates,
      warnings,
      skippedReason: null
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_ingestion_error";
    return {
      postUrl: input.postUrl,
      postTitle,
      downloadLink,
      archivePath: null,
      archiveBytes: null,
      panelAssets: [],
      candidates: [],
      warnings: [`ingestion_failed:${message}`],
      skippedReason: message
    };
  }
}

export async function discoverComicsCatalogPanelAssets(input: {
  postUrls: string[];
  entities: string[];
  franchise?: string;
  catalogSource: string;
  fetchFn?: typeof fetch;
  projectRoot?: string;
  maxPosts?: number;
  maxPanelsPerPost?: number;
  extractAllPages?: boolean;
  maxDownloadBytes?: number;
  userApprovedDownload: boolean;
}): Promise<{
  candidates: MediaBeastCandidate[];
  ingestions: ComicsCatalogDownloadIngestionResult[];
  warnings: string[];
}> {
  const maxPosts = input.maxPosts ?? 3;
  const warnings: string[] = [];
  const ingestions: ComicsCatalogDownloadIngestionResult[] = [];
  const candidateMap = new Map<string, MediaBeastCandidate>();

  for (const postUrl of input.postUrls.slice(0, maxPosts)) {
    const result = await ingestComicsCatalogPanelsFromPost({
      postUrl,
      entities: input.entities,
      ...(input.franchise ? { franchise: input.franchise } : {}),
      catalogSource: input.catalogSource,
      ...(input.fetchFn ? { fetchFn: input.fetchFn } : {}),
      ...(input.projectRoot ? { projectRoot: input.projectRoot } : {}),
      ...(input.extractAllPages === true
        ? { extractAllPages: true }
        : input.maxPanelsPerPost !== undefined
          ? { maxPanels: input.maxPanelsPerPost }
          : {}),
      ...(input.maxDownloadBytes !== undefined
        ? { maxDownloadBytes: input.maxDownloadBytes }
        : {}),
      userApprovedDownload: input.userApprovedDownload
    });
    ingestions.push(result);
    warnings.push(...result.warnings.map((entry) => `${postUrl}:${entry}`));
    for (const candidate of result.candidates) {
      candidateMap.set(candidate.id, candidate);
    }
  }

  return {
    candidates: [...candidateMap.values()],
    ingestions,
    warnings
  };
}

export function isComicsCatalogDownloadCandidate(
  candidate: Pick<MediaBeastCandidate, "metadata">
): boolean {
  return candidate.metadata.discoverySource === COMICS_CATALOG_DOWNLOAD_INGESTION_SOURCE;
}