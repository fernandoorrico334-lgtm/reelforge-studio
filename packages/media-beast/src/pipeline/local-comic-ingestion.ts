import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { access, copyFile, mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { basename, extname, join, resolve } from "node:path";
import { extractPanelImagesFromComicsArchive } from "./comics-catalog-download-ingestion.js";
import { upsertLocalComicPanelIndex, type LocalComicPanelIndex } from "./comics-local-panel-index.js";

const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp"]);

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

function safeComicSlug(sourcePath: string): string {
  return basename(sourcePath, extname(sourcePath))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) || "comic";
}

async function copyImagePagesToAssetDirectory(input: {
  imagePaths: string[];
  assetDirectory: string;
  comicTitle: string;
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
    pages.push({
      id: `comic-page-${String(pageNumber).padStart(4, "0")}`,
      sourcePath,
      assetPath: targetPath,
      title: `${input.comicTitle} - pagina ${pageNumber}`,
      pageNumber,
      contentHash: await sha256File(targetPath),
      bytes: fileStat.size
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
  if (sourceType === "pdf") {
    throw new Error("pdf_rasterizer_unavailable:convert PDF to image pages or CBZ before ingestion");
  }

  await mkdir(assetDirectory, { recursive: true });
  let sourceImages: string[] = [];

  if (sourceType === "image_directory") {
    sourceImages = await listImageFilesRecursive(sourcePath);
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
  const selectedImages = sourceImages.slice(0, input.maxPages ?? sourceImages.length);
  const pages = await copyImagePagesToAssetDirectory({
    imagePaths: selectedImages,
    assetDirectory,
    comicTitle
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
        width: 0,
        height: 0,
        bytes: page.bytes,
        contentHash: page.contentHash,
        mediaType: "raster"
      })),
      ...(input.ffmpegCommand ? { ffmpegCommand: input.ffmpegCommand } : {}),
      ...(input.forceRebuildIndex ? { forceRebuild: true } : {}),
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
