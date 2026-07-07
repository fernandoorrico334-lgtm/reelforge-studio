import { createHash } from "node:crypto";
import { mkdir, stat, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { isSearchSurfaceUrl } from "../discovery/candidate-enrichment.js";
import type { RemixAssetSearchCandidate } from "./remix-asset-discovery.js";

export interface RemixAssetImportContext {
  remixId: string;
  headline?: string;
  entities?: string[];
  domain?: string;
}

export interface RemixAssetDiskImportResult {
  candidateId: string;
  success: boolean;
  localPath: string | null;
  importMethod: "direct_download" | "og_image" | "reference_svg" | "failed";
  mimeType: string | null;
  fileSizeBytes: number | null;
  width: number | null;
  height: number | null;
  errorMessage: string | null;
}

const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg", ".avif"];

function resolveProjectRoot() {
  return resolve(process.cwd());
}

function isDirectImageUrl(url: string) {
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    return IMAGE_EXTENSIONS.some((ext) => pathname.endsWith(ext));
  } catch {
    return IMAGE_EXTENSIONS.some((ext) => url.toLowerCase().includes(ext));
  }
}

function extensionFromUrl(url: string, fallback = ".png") {
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    const match = IMAGE_EXTENSIONS.find((ext) => pathname.endsWith(ext));
    return match ?? fallback;
  } catch {
    return fallback;
  }
}

function mimeFromExtension(extension: string) {
  switch (extension.toLowerCase()) {
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".webp":
      return "image/webp";
    case ".gif":
      return "image/gif";
    case ".svg":
      return "image/svg+xml";
    case ".avif":
      return "image/avif";
    default:
      return "image/png";
  }
}

async function fetchBinary(url: string, timeoutMs = 12_000): Promise<Buffer | null> {
  try {
    const response = await fetch(url, {
      headers: { "user-agent": "ReelForge-RemixAssetImporter/1.0" },
      signal: AbortSignal.timeout(timeoutMs)
    });
    if (!response.ok) return null;
    const buffer = Buffer.from(await response.arrayBuffer());
    return buffer.length > 256 ? buffer : null;
  } catch {
    return null;
  }
}

async function fetchOgImageUrl(pageUrl: string): Promise<string | null> {
  try {
    const response = await fetch(pageUrl, {
      headers: { "user-agent": "ReelForge-RemixAssetImporter/1.0" },
      signal: AbortSignal.timeout(8_000)
    });
    if (!response.ok) return null;
    const html = (await response.text()).slice(0, 48_000);
    const match =
      html.match(/property=["']og:image["'][^>]*content=["']([^"']+)["']/i) ??
      html.match(/content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
    return match?.[1]?.trim() ?? null;
  } catch {
    return null;
  }
}

function buildReferenceSvg(candidate: RemixAssetSearchCandidate, context: RemixAssetImportContext) {
  const entity = context.entities?.[0] ?? candidate.title.slice(0, 40);
  const subtitle = candidate.purpose.replace(/_/g, " ");
  const safeTitle = candidate.title.replace(/[<>&]/g, "").slice(0, 72);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920" viewBox="0 0 1080 1920">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#10131f"/>
      <stop offset="100%" stop-color="#2a1538"/>
    </linearGradient>
  </defs>
  <rect width="1080" height="1920" fill="url(#bg)"/>
  <rect x="72" y="220" width="936" height="1240" rx="36" fill="#ffffff10" stroke="#ffffff33"/>
  <text x="96" y="360" fill="#f4f0ff" font-family="Segoe UI, Arial, sans-serif" font-size="54" font-weight="700">${entity}</text>
  <text x="96" y="430" fill="#cdb8ff" font-family="Segoe UI, Arial, sans-serif" font-size="28">${subtitle}</text>
  <text x="96" y="520" fill="#d7d2e5" font-family="Segoe UI, Arial, sans-serif" font-size="24">${safeTitle}</text>
  <text x="96" y="1760" fill="#8f84b8" font-family="Segoe UI, Arial, sans-serif" font-size="20">Remix reference · ${context.domain ?? "editorial"} · candidate-first</text>
</svg>`;
}

function stableFilename(candidateId: string, extension: string) {
  const hash = createHash("sha1").update(candidateId).digest("hex").slice(0, 12);
  return `remix-asset-${hash}${extension}`;
}

export async function importRemixAssetCandidateToDisk(
  candidate: RemixAssetSearchCandidate,
  context: RemixAssetImportContext
): Promise<RemixAssetDiskImportResult> {
  const projectRoot = resolveProjectRoot();
  const batchDir = join(projectRoot, "storage", "assets", "remix-imports", context.remixId);
  await mkdir(batchDir, { recursive: true });

  const downloadTargets = [
    candidate.previewUrl,
    isDirectImageUrl(candidate.sourceUrl) ? candidate.sourceUrl : null
  ].filter((value): value is string => Boolean(value));

  for (const url of downloadTargets) {
    const buffer = await fetchBinary(url);
    if (!buffer) continue;

    const extension = extensionFromUrl(url, ".png");
    const filename = stableFilename(candidate.candidateId, extension);
    const absolutePath = join(batchDir, filename);
    await writeFile(absolutePath, buffer);
    const fileStat = await stat(absolutePath);

    return {
      candidateId: candidate.candidateId,
      success: true,
      localPath: `storage/assets/remix-imports/${context.remixId}/${filename}`,
      importMethod: "direct_download",
      mimeType: mimeFromExtension(extension),
      fileSizeBytes: fileStat.size,
      width: extension === ".svg" ? 1080 : null,
      height: extension === ".svg" ? 1920 : null,
      errorMessage: null
    };
  }

  if (!isSearchSurfaceUrl(candidate.sourceUrl)) {
    const ogImage = await fetchOgImageUrl(candidate.sourceUrl);
    if (ogImage) {
      const buffer = await fetchBinary(ogImage);
      if (buffer) {
        const extension = extensionFromUrl(ogImage, ".jpg");
        const filename = stableFilename(candidate.candidateId, extension);
        const absolutePath = join(batchDir, filename);
        await writeFile(absolutePath, buffer);
        const fileStat = await stat(absolutePath);

        return {
          candidateId: candidate.candidateId,
          success: true,
          localPath: `storage/assets/remix-imports/${context.remixId}/${filename}`,
          importMethod: "og_image",
          mimeType: mimeFromExtension(extension),
          fileSizeBytes: fileStat.size,
          width: null,
          height: null,
          errorMessage: null
        };
      }
    }
  }

  const svg = buildReferenceSvg(candidate, context);
  const filename = stableFilename(candidate.candidateId, ".svg");
  const absolutePath = join(batchDir, filename);
  await writeFile(absolutePath, svg, "utf8");
  const fileStat = await stat(absolutePath);

  return {
    candidateId: candidate.candidateId,
    success: true,
    localPath: `storage/assets/remix-imports/${context.remixId}/${filename}`,
    importMethod: "reference_svg",
    mimeType: "image/svg+xml",
    fileSizeBytes: fileStat.size,
    width: 1080,
    height: 1920,
    errorMessage: null
  };
}

export async function importRemixAssetCandidatesToDisk(
  candidates: RemixAssetSearchCandidate[],
  context: RemixAssetImportContext
): Promise<RemixAssetDiskImportResult[]> {
  const results: RemixAssetDiskImportResult[] = [];

  for (const candidate of candidates) {
    try {
      results.push(await importRemixAssetCandidateToDisk(candidate, context));
    } catch (error) {
      results.push({
        candidateId: candidate.candidateId,
        success: false,
        localPath: null,
        importMethod: "failed",
        mimeType: null,
        fileSizeBytes: null,
        width: null,
        height: null,
        errorMessage: error instanceof Error ? error.message : "Import failed."
      });
    }
  }

  return results;
}