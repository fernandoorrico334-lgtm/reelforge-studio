import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { constants } from "node:fs";
import { access, copyFile, mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { basename, extname, join, resolve } from "node:path";
import { extractPanelImagesFromComicsArchive } from "./comics-catalog-download-ingestion.js";
import { upsertLocalComicPanelIndex, type LocalComicPanelIndex } from "./comics-local-panel-index.js";

const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp"]);
const DEFAULT_PDF_DPI = 240;

export type LocalComicIngestionSourceType =
  | "pdf"
  | "cbz"
  | "cbr"
  | "zip"
  | "image_directory"
  | "unknown";

export type LocalComicIngestedPage = {
  id: string;
  sourcePath: string;
  assetPath: string;
  title: string;
  pageNumber: number;
  contentHash: string;
  bytes: number;
  width: number;
  height: number;
};

export type LocalComicIngestionResult = {
  sourcePath: string;
  sourceType: LocalComicIngestionSourceType;
  assetDirectory: string;
  pageCount: number;
  pages: LocalComicIngestedPage[];
  manifestPath: string;
  indexPath: string | null;
  index: LocalComicPanelIndex | null;
  reportPath: string | null;
  contactSheetPath: string | null;
  warnings: string[];
  candidateFirst: true;
};

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK | constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

function detectSourceType(sourcePath: string): LocalComicIngestionSourceType {
  const ext = extname(sourcePath).toLowerCase();
  if (ext === ".pdf") return "pdf";
  if (ext === ".cbz") return "cbz";
  if (ext === ".cbr") return "cbr";
  if (ext === ".zip") return "zip";
  if (ext === "") return "image_directory";
  return "unknown";
}

async function sha256File(path: string): Promise<string> {
  return createHash("sha256").update(await readFile(path)).digest("hex");
}

function uniqueNonEmpty(values: Array<string | undefined>): string[] {
  return Array.from(new Set(values.map((value) => value?.trim()).filter(Boolean) as string[]));
}

async function runLocalCommand(input: {
  command: string;
  args: string[];
  timeoutMs?: number;
}): Promise<{ stdout: string; stderr: string }> {
  return await new Promise((resolvePromise, reject) => {
    const child = spawn(input.command, input.args, {
      windowsHide: true,
      shell: false
    });
    let stdout = "";
    let stderr = "";
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error(`${input.command} timed_out_after_${input.timeoutMs ?? 300000}ms`));
    }, input.timeoutMs ?? 300000);

    child.stdout?.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr?.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timeout);
      if (code === 0) {
        resolvePromise({ stdout, stderr });
        return;
      }
      reject(new Error(`${input.command}_exited_${code}:${stderr.slice(-1000)}`));
    });
  });
}

async function listImageFilesRecursive(root: string): Promise<string[]> {
  const found: string[] = [];
  async function walk(dir: string) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (IMAGE_EXTENSIONS.has(extname(entry.name).toLowerCase())) {
        found.push(fullPath);
      }
    }
  }
  await walk(root);
  return found.sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));
}

function normalizeCommandName(command: string): string {
  return basename(command).toLowerCase().replace(/\.(exe|cmd|bat)$/i, "");
}

function buildPdfRasterizerCandidates(input: {
  pdfRasterizerCommand?: string;
}): string[] {
  return uniqueNonEmpty([
    input.pdfRasterizerCommand,
    process.env.REELFORGE_PDF_RASTERIZER_COMMAND,
    "pdftoppm",
    "mutool",
    "magick"
  ]);
}

async function rasterizePdfWithCommand(input: {
  pdfPath: string;
  outputDir: string;
  command: string;
  dpi: number;
}): Promise<string[]> {
  const commandName = normalizeCommandName(input.command);
  await mkdir(input.outputDir, { recursive: true });

  if (commandName.includes("pdftoppm")) {
    await runLocalCommand({
      command: input.command,
      args: ["-r", String(input.dpi), "-png", input.pdfPath, join(input.outputDir, "page")],
      timeoutMs: 600000
    });
    return listImageFilesRecursive(input.outputDir);
  }

  if (commandName.includes("mutool")) {
    await runLocalCommand({
      command: input.command,
      args: ["draw", "-r", String(input.dpi), "-o", join(input.outputDir, "page-%04d.png"), input.pdfPath],
      timeoutMs: 600000
    });
    return listImageFilesRecursive(input.outputDir);
  }

  if (commandName.includes("magick") || commandName.includes("convert")) {
    await runLocalCommand({
      command: input.command,
      args: ["-density", String(input.dpi), input.pdfPath, "-quality", "95", join(input.outputDir, "page-%04d.png")],
      timeoutMs: 600000
    });
    return listImageFilesRecursive(input.outputDir);
  }

  throw new Error(`unsupported_pdf_rasterizer_command:${input.command}`);
}

async function rasterizePdfToImages(input: {
  pdfPath: string;
  outputDir: string;
  pdfRasterizerCommand?: string;
  dpi?: number;
}): Promise<{ imagePaths: string[]; command: string; attempts: string[] }> {
  const attempts: string[] = [];
  const dpi = input.dpi ?? DEFAULT_PDF_DPI;
  const commands = buildPdfRasterizerCandidates({
    ...(input.pdfRasterizerCommand ? { pdfRasterizerCommand: input.pdfRasterizerCommand } : {})
  });

  for (const command of commands) {
    try {
      const imagePaths = await rasterizePdfWithCommand({
        pdfPath: input.pdfPath,
        outputDir: input.outputDir,
        command,
        dpi
      });
      if (imagePaths.length > 0) {
        return { imagePaths, command, attempts };
      }
      attempts.push(`${command}:no_pages_generated`);
    } catch (error) {
      attempts.push(`${command}:${error instanceof Error ? error.message : String(error)}`);
    }
  }

  throw new Error(
    [
      "pdf_rasterizer_unavailable",
      "Install Poppler pdftoppm, MuPDF mutool, or ImageMagick magick, or set REELFORGE_PDF_RASTERIZER_COMMAND.",
      `attempts=${attempts.join(" | ")}`
    ].join(":")
  );
}

function safeComicSlug(sourcePath: string): string {
  return basename(sourcePath, extname(sourcePath))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) || "comic";
}

async function probeImageDimensions(input: {
  imagePath: string;
  ffprobeCommand?: string;
}): Promise<{ width: number; height: number } | null> {
  try {
    const { stdout } = await runLocalCommand({
      command: input.ffprobeCommand ?? process.env.FFPROBE_PATH ?? "ffprobe",
      args: [
        "-v",
        "error",
        "-select_streams",
        "v:0",
        "-show_entries",
        "stream=width,height",
        "-of",
        "csv=p=0:s=x",
        input.imagePath
      ],
      timeoutMs: 30000
    });
    const match = stdout.trim().match(/(\d+)x(\d+)/);
    if (!match?.[1] || !match?.[2]) return null;
    const width = Number.parseInt(match[1], 10);
    const height = Number.parseInt(match[2], 10);
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
    return { width, height };
  } catch {
    return null;
  }
}

async function copyImagePagesToAssetDirectory(input: {
  imagePaths: string[];
  assetDirectory: string;
  comicTitle: string;
  ffprobeCommand?: string;
}): Promise<LocalComicIngestedPage[]> {
  const pagesDir = join(input.assetDirectory, "pages");
  await mkdir(pagesDir, { recursive: true });
  const pages: LocalComicIngestedPage[] = [];

  for (let index = 0; index < input.imagePaths.length; index += 1) {
    const sourcePath = input.imagePaths[index]!;
    const ext = extname(sourcePath).toLowerCase() || ".jpg";
    const pageNumber = index + 1;
    const targetPath = join(pagesDir, `page-${String(pageNumber).padStart(4, "0")}${ext}`);
    if (resolve(sourcePath) !== resolve(targetPath)) {
      await copyFile(sourcePath, targetPath);
    }
    const fileStat = await stat(targetPath);
    const dimensions = await probeImageDimensions({
      imagePath: targetPath,
      ...(input.ffprobeCommand ? { ffprobeCommand: input.ffprobeCommand } : {})
    });
    pages.push({
      id: `comic-page-${String(pageNumber).padStart(4, "0")}`,
      sourcePath,
      assetPath: targetPath,
      title: `${input.comicTitle} - pagina ${pageNumber}`,
      pageNumber,
      contentHash: await sha256File(targetPath),
      bytes: fileStat.size,
      width: dimensions?.width ?? 0,
      height: dimensions?.height ?? 0
    });
  }

  return pages;
}

export async function ingestLocalComicSource(input: {
  sourcePath: string;
  assetDirectory?: string;
  comicTitle?: string;
  projectRoot?: string;
  ffmpegCommand?: string;
  ffprobeCommand?: string;
  pdfRasterizerCommand?: string;
  pdfDpi?: number;
  forceRebuildIndex?: boolean;
  maxPages?: number;
  buildIndex?: boolean;
}): Promise<LocalComicIngestionResult> {
  const sourcePath = resolve(input.sourcePath);
  const sourceType = detectSourceType(sourcePath);
  const projectRoot = resolve(input.projectRoot ?? process.cwd());
  const comicTitle = input.comicTitle?.trim() || basename(sourcePath, extname(sourcePath)) || "Imported Comic";
  const assetDirectory = resolve(
    input.assetDirectory ?? join(projectRoot, "storage", "assets", "comics", safeComicSlug(sourcePath))
  );
  const warnings: string[] = [];

  if (!(await fileExists(sourcePath))) {
    throw new Error(`comic_source_not_found:${sourcePath}`);
  }
  if (sourceType === "unknown") {
    throw new Error(`unsupported_comic_source_type:${sourcePath}`);
  }
  await mkdir(assetDirectory, { recursive: true });
  let sourceImages: string[] = [];

  if (sourceType === "image_directory") {
    sourceImages = await listImageFilesRecursive(sourcePath);
  } else if (sourceType === "pdf") {
    const rasterized = await rasterizePdfToImages({
      pdfPath: sourcePath,
      outputDir: join(assetDirectory, ".pdf-pages"),
      ...(input.pdfRasterizerCommand ? { pdfRasterizerCommand: input.pdfRasterizerCommand } : {}),
      ...(input.pdfDpi ? { dpi: input.pdfDpi } : {})
    });
    sourceImages = rasterized.imagePaths;
    warnings.push(`pdf_rasterizer_used:${rasterized.command}`);
    if (rasterized.attempts.length > 0) {
      warnings.push(`pdf_rasterizer_fallback_attempts:${rasterized.attempts.join(" | ")}`);
    }
  } else {
    const extracted = await extractPanelImagesFromComicsArchive({
      archivePath: sourcePath,
      outputDir: join(assetDirectory, ".extract"),
      extractAllPages: true
    });
    sourceImages = extracted.map((page) => page.localPath);
  }

  if (sourceImages.length === 0) {
    warnings.push("no_image_pages_found");
  }
  if (input.maxPages !== undefined && sourceImages.length > input.maxPages) {
    warnings.push(`pages_truncated_by_explicit_maxPages:${input.maxPages}/${sourceImages.length}`);
  }
  const selectedImages = sourceImages.slice(0, input.maxPages ?? sourceImages.length);
  const pages = await copyImagePagesToAssetDirectory({
    imagePaths: selectedImages,
    assetDirectory,
    comicTitle,
    ...(input.ffprobeCommand ? { ffprobeCommand: input.ffprobeCommand } : {})
  });

  const manifestPath = join(assetDirectory, "manifest.json");
  await writeFile(
    manifestPath,
    JSON.stringify(
      {
        sourcePath,
        sourceType,
        comicTitle,
        generatedAt: new Date().toISOString(),
        pageCount: pages.length,
        pages
      },
      null,
      2
    ),
    "utf8"
  );

  let index: LocalComicPanelIndex | null = null;
  let indexPath: string | null = null;
  let reportPath: string | null = null;
  let contactSheetPath: string | null = null;

  if (input.buildIndex !== false && pages.length > 0) {
    const indexed = await upsertLocalComicPanelIndex({
      assetDirectory,
      pages: pages.map((page) => ({
        id: page.id,
        assetPath: page.assetPath,
        title: page.title,
        description: `Imported local comic page ${page.pageNumber} from ${comicTitle}.`,
        tags: ["local-comic", "authorized", "comic-page", `page-${page.pageNumber}`],
        width: page.width,
        height: page.height,
        bytes: page.bytes,
        contentHash: page.contentHash,
        mediaType: "raster"
      })),
      ...(input.ffmpegCommand ? { ffmpegCommand: input.ffmpegCommand } : {}),
      ...(input.forceRebuildIndex ? { forceRebuild: true } : {}),
      evidenceMode: "broad",
      projectRoot
    });
    index = indexed.index;
    indexPath = indexed.indexPath;
    reportPath = indexed.reportPath ?? null;
    contactSheetPath = indexed.contactSheetPath ?? null;
    warnings.push(...indexed.warnings);
  } else if (input.buildIndex === false) {
    warnings.push("local_panel_index_skipped");
  }

  return {
    sourcePath,
    sourceType,
    assetDirectory,
    pageCount: pages.length,
    pages,
    manifestPath,
    indexPath,
    index,
    reportPath,
    contactSheetPath,
    warnings,
    candidateFirst: true
  };
}
