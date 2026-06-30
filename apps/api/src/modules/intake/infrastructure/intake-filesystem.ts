import { createHash } from "node:crypto";
import { mkdir, open, readdir, readFile, stat, copyFile } from "node:fs/promises";
import { basename, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  assetsStorageRoot,
  inboxStorageRoot,
  projectRoot,
  storageRoot
} from "../../../config/paths.js";
import type { AssetCategory, AssetType } from "../../assets/domain/asset.js";
import {
  createStoredFilename,
  detectImageDimensions,
  documentExtensions,
  imageExtensions,
  inferMimeType,
  isPathInsideRoot,
  isRangePreviewable,
  normalizeExtension,
  toForwardSlashes,
  videoExtensions,
  audioExtensions
} from "../../assets/infrastructure/asset-file-utils.js";
import type {
  IntakeFolderDescriptor,
  IntakeFoldersResponse,
  IntakeMediaType,
  MediaCandidate
} from "../domain/intake.js";

export const manualIntakeProvider = "manual-intake";

const intakeFolderDescriptors = [
  { id: "drop-images", label: "drop/images", relativePath: "storage/inbox/drop/images" },
  { id: "drop-videos", label: "drop/videos", relativePath: "storage/inbox/drop/videos" },
  { id: "drop-audio", label: "drop/audio", relativePath: "storage/inbox/drop/audio" },
  { id: "drop-music", label: "drop/music", relativePath: "storage/inbox/drop/music" },
  { id: "drop-sfx", label: "drop/sfx", relativePath: "storage/inbox/drop/sfx" },
  { id: "drop-overlays", label: "drop/overlays", relativePath: "storage/inbox/drop/overlays" },
  { id: "drop-documents", label: "drop/documents", relativePath: "storage/inbox/drop/documents" },
  { id: "drop-references", label: "drop/references", relativePath: "storage/inbox/drop/references" },
  { id: "characters", label: "characters", relativePath: "storage/inbox/characters" },
  {
    id: "character-example-references",
    label: "characters/_example-character/references",
    relativePath: "storage/inbox/characters/_example-character/references"
  },
  {
    id: "character-example-notes",
    label: "characters/_example-character/notes",
    relativePath: "storage/inbox/characters/_example-character/notes"
  },
  { id: "projects", label: "projects", relativePath: "storage/inbox/projects" },
  {
    id: "project-example-raw",
    label: "projects/_example-project/raw",
    relativePath: "storage/inbox/projects/_example-project/raw"
  },
  {
    id: "project-example-selected",
    label: "projects/_example-project/selected",
    relativePath: "storage/inbox/projects/_example-project/selected"
  },
  {
    id: "project-example-references",
    label: "projects/_example-project/references",
    relativePath: "storage/inbox/projects/_example-project/references"
  },
  { id: "reviewed", label: "reviewed", relativePath: "storage/inbox/reviewed" },
  { id: "rejected", label: "rejected", relativePath: "storage/inbox/rejected" }
] as const;

const scanRoots = [
  join(inboxStorageRoot, "drop"),
  join(inboxStorageRoot, "characters"),
  join(inboxStorageRoot, "projects")
];

export interface ScannedInboxFile {
  originalPath: string;
  title: string;
  mediaType: IntakeMediaType;
  detectedType: string | null;
  suggestedCategory: AssetCategory | null;
  suggestedTags: string[];
  suggestedCharacter: string | null;
  suggestedProject: string | null;
  width: number | null;
  height: number | null;
  duration: number | null;
  fileSize: number;
  extension: string;
  mimeType: string;
  category: AssetCategory | null;
  franchise: string | null;
  character: string | null;
  tags: string[];
  recommendedUse: string | null;
  contentHash: string | null;
}

export interface StoredImportedCandidate {
  filename: string;
  path: string;
  type: AssetType;
  mimeType: string;
  extension: string;
  fileSize: number;
  width: number | null;
  height: number | null;
}

export interface ResolvedCandidatePreview {
  absolutePath: string;
  mimeType: string;
  fileSize: number;
  supportsRange: boolean;
}

function toAbsolute(relativePath: string) {
  return join(projectRoot, relativePath.replaceAll("/", "\\"));
}

function tokenize(value: string) {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);
}

function uniqueStrings(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function isTemporaryName(name: string) {
  const normalized = name.trim().toLowerCase();

  return (
    !normalized ||
    normalized === ".gitkeep" ||
    normalized === "thumbs.db" ||
    normalized === "desktop.ini" ||
    normalized.startsWith(".") ||
    normalized.endsWith(".tmp") ||
    normalized.endsWith(".temp") ||
    normalized.endsWith(".part") ||
    normalized.endsWith(".crdownload") ||
    normalized.startsWith("~$")
  );
}

function inferDetectedType(extension: string, mimeType: string) {
  if (imageExtensions.has(extension) || mimeType.startsWith("image/")) {
    return "image";
  }

  if (videoExtensions.has(extension) || mimeType.startsWith("video/")) {
    return "video";
  }

  if (audioExtensions.has(extension) || mimeType.startsWith("audio/")) {
    return "audio";
  }

  if (documentExtensions.has(extension) || mimeType.startsWith("text/")) {
    return "document";
  }

  return null;
}

function inferMediaTypeFromExtension(extension: string, mimeType: string) {
  const detectedType = inferDetectedType(extension, mimeType);

  switch (detectedType) {
    case "image":
      return "image";
    case "video":
      return "video";
    case "audio":
      return "audio";
    case "document":
      return "document";
    default:
      return null;
  }
}

function inferCategoryFromMediaType(mediaType: IntakeMediaType): AssetCategory | null {
  switch (mediaType) {
    case "video":
      return "BROLL";
    case "audio":
    case "music":
      return "TRACK";
    case "sfx":
      return "EFFECT";
    case "overlay":
      return "OVERLAY";
    case "document":
    case "reference":
    case "image":
    default:
      return "REFERENCE";
  }
}

function inferRelativeMetadata(relativePath: string, extension: string, mimeType: string) {
  const normalizedPath = toForwardSlashes(relativePath);
  const segments = normalizedPath.split("/");
  const detectedType = inferDetectedType(extension, mimeType);
  let mediaType: IntakeMediaType =
    inferMediaTypeFromExtension(extension, mimeType) ?? "reference";
  let suggestedCategory = inferCategoryFromMediaType(mediaType);
  let suggestedCharacter: string | null = null;
  let suggestedProject: string | null = null;
  let recommendedUse: string | null = null;
  const extraTags: string[] = [];

  if (normalizedPath.startsWith("storage/inbox/drop/")) {
    const lane = segments[3] ?? "";

    switch (lane) {
      case "images":
        mediaType = "image";
        suggestedCategory = "REFERENCE";
        break;
      case "videos":
        mediaType = "video";
        suggestedCategory = "BROLL";
        break;
      case "audio":
        mediaType = "audio";
        suggestedCategory = "TRACK";
        break;
      case "music":
        mediaType = "music";
        suggestedCategory = "TRACK";
        break;
      case "sfx":
        mediaType = "sfx";
        suggestedCategory = "EFFECT";
        break;
      case "overlays":
        mediaType = "overlay";
        suggestedCategory = "OVERLAY";
        break;
      case "documents":
        mediaType = "document";
        suggestedCategory = "REFERENCE";
        break;
      case "references":
        suggestedCategory = "REFERENCE";
        mediaType =
          inferMediaTypeFromExtension(extension, mimeType) ?? "reference";
        break;
      default:
        break;
    }

    extraTags.push("manual-drop");
    if (lane) {
      extraTags.push(lane);
    }
  }

  if (
    normalizedPath.startsWith("storage/inbox/characters/") &&
    segments[4] === "references"
  ) {
    suggestedCharacter = segments[3] ?? null;
    suggestedCategory = "REFERENCE";
    mediaType = inferMediaTypeFromExtension(extension, mimeType) ?? "reference";

    if (detectedType === "image") {
      mediaType = "image";
    }

    if (suggestedCharacter) {
      extraTags.push("character-reference", suggestedCharacter);
    }
  }

  if (normalizedPath.startsWith("storage/inbox/projects/")) {
    suggestedProject = segments[3] ?? null;

    if (suggestedProject) {
      extraTags.push(suggestedProject);
    }

    if (segments[4] === "raw") {
      recommendedUse = "project-material";
      extraTags.push("project-material");
    }
  }

  return {
    detectedType,
    mediaType,
    suggestedCategory,
    suggestedCharacter,
    suggestedProject,
    recommendedUse,
    extraTags
  };
}

async function maybeReadImageDimensions(absolutePath: string, extension: string, mimeType: string) {
  if (!mimeType.startsWith("image/")) {
    return {
      width: null,
      height: null
    };
  }

  const buffer = await readFile(absolutePath);
  return detectImageDimensions(buffer, extension, mimeType);
}

async function createLightweightContentHash(absolutePath: string, fileSize: number) {
  if (fileSize <= 0 || fileSize > 20 * 1024 * 1024) {
    return null;
  }

  const file = await open(absolutePath, "r");

  try {
    const hash = createHash("sha1");
    const sampleSize = Math.min(fileSize, 256 * 1024);
    const headBuffer = Buffer.alloc(sampleSize);
    await file.read(headBuffer, 0, sampleSize, 0);
    hash.update(headBuffer);

    if (fileSize > sampleSize) {
      const tailBuffer = Buffer.alloc(sampleSize);
      await file.read(tailBuffer, 0, sampleSize, Math.max(0, fileSize - sampleSize));
      hash.update(tailBuffer);
    }

    hash.update(String(fileSize));
    return hash.digest("hex");
  } finally {
    await file.close();
  }
}

async function walkDirectory(rootPath: string, entries: ScannedInboxFile[]) {
  try {
    const directoryEntries = await readdir(rootPath, { withFileTypes: true });

    for (const entry of directoryEntries) {
      if (isTemporaryName(entry.name)) {
        continue;
      }

      const absolutePath = join(rootPath, entry.name);

      if (entry.isDirectory()) {
        await walkDirectory(absolutePath, entries);
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      const extension = normalizeExtension(entry.name);

      if (!extension) {
        continue;
      }

      const mimeType = inferMimeType(extension, "");
      const relativePath = toForwardSlashes(relative(projectRoot, absolutePath));

      if (!relativePath.startsWith("storage/inbox/")) {
        continue;
      }

      const metadata = inferRelativeMetadata(relativePath, extension, mimeType);

      if (
        metadata.mediaType === "reference" &&
        !documentExtensions.has(extension) &&
        !imageExtensions.has(extension) &&
        !videoExtensions.has(extension) &&
        !audioExtensions.has(extension)
      ) {
        continue;
      }

      const fileStats = await stat(absolutePath);
      const dimensions = await maybeReadImageDimensions(
        absolutePath,
        extension,
        mimeType
      );
      const contentHash = await createLightweightContentHash(
        absolutePath,
        fileStats.size
      );
      const title = basename(entry.name, extension);
      const inferredTags = uniqueStrings([
        ...tokenize(title),
        ...relativePath
          .split("/")
          .slice(2, -1)
          .flatMap((segment) => tokenize(segment)),
        ...metadata.extraTags
      ]);

      entries.push({
        originalPath: relativePath,
        title,
        mediaType: metadata.mediaType,
        detectedType: metadata.detectedType,
        suggestedCategory: metadata.suggestedCategory,
        suggestedTags: inferredTags,
        suggestedCharacter: metadata.suggestedCharacter,
        suggestedProject: metadata.suggestedProject,
        width: dimensions.width,
        height: dimensions.height,
        duration: null,
        fileSize: fileStats.size,
        extension,
        mimeType,
        category: metadata.suggestedCategory,
        franchise: null,
        character: metadata.suggestedCharacter,
        tags: inferredTags,
        recommendedUse: metadata.recommendedUse,
        contentHash
      });
    }
  } catch {
    return;
  }
}

export async function ensureInboxStructure() {
  await mkdir(inboxStorageRoot, { recursive: true });

  await Promise.all(
    intakeFolderDescriptors.map((folder) =>
      mkdir(toAbsolute(folder.relativePath), { recursive: true })
    )
  );
}

export async function getInboxFolders(): Promise<IntakeFoldersResponse> {
  await ensureInboxStructure();

  return {
    rootPath: inboxStorageRoot,
    folders: intakeFolderDescriptors.map((folder) => ({
      ...folder,
      absolutePath: toAbsolute(folder.relativePath)
    }))
  };
}

export async function scanInboxFiles() {
  await ensureInboxStructure();
  const entries: ScannedInboxFile[] = [];

  for (const rootPath of scanRoots) {
    await walkDirectory(rootPath, entries);
  }

  return entries.sort((left, right) =>
    left.originalPath.localeCompare(right.originalPath)
  );
}

export function getCandidatePreviewUrl(candidateId: string) {
  return `/media/candidates/${encodeURIComponent(candidateId)}/preview`;
}

export function resolveCandidateAbsolutePath(originalPath: string) {
  const trimmed = originalPath.trim();

  if (!trimmed) {
    return null;
  }

  let absolutePath: string;

  if (trimmed.startsWith("file://")) {
    try {
      absolutePath = fileURLToPath(trimmed);
    } catch {
      return null;
    }
  } else {
    absolutePath = resolve(projectRoot, trimmed);
  }

  if (trimmed.startsWith("storage/inbox/") && !isPathInsideRoot(absolutePath, inboxStorageRoot)) {
    return null;
  }

  if (trimmed.startsWith("storage/assets/") && !isPathInsideRoot(absolutePath, assetsStorageRoot)) {
    return null;
  }

  if (trimmed.startsWith("storage/") && !isPathInsideRoot(absolutePath, storageRoot)) {
    return null;
  }

  return absolutePath;
}

export async function resolveCandidatePreview(candidate: MediaCandidate) {
  if (!candidate.originalPath) {
    return null;
  }

  const absolutePath = resolveCandidateAbsolutePath(candidate.originalPath);

  if (!absolutePath) {
    return null;
  }

  try {
    const fileStats = await stat(absolutePath);

    if (!fileStats.isFile()) {
      return null;
    }

    const extension =
      candidate.extension ?? normalizeExtension(candidate.originalPath);
    const mimeType = inferMimeType(extension, candidate.mimeType ?? "");

    return {
      absolutePath,
      mimeType,
      fileSize: fileStats.size,
      supportsRange: isRangePreviewable(mimeType)
    } satisfies ResolvedCandidatePreview;
  } catch {
    return null;
  }
}

export function resolveAssetTypeFromCandidate(candidate: MediaCandidate): AssetType | null {
  switch (candidate.mediaType) {
    case "image":
      return "IMAGE";
    case "video":
      return "VIDEO";
    case "audio":
      return "AUDIO";
    case "music":
      return "MUSIC";
    case "sfx":
      return "SFX";
    case "overlay":
      return "OVERLAY";
    case "document":
      return "DOCUMENT";
    case "reference":
      if (candidate.mimeType?.startsWith("image/")) {
        return "IMAGE";
      }

      if (candidate.mimeType?.startsWith("video/")) {
        return "VIDEO";
      }

      if (candidate.mimeType?.startsWith("audio/")) {
        return "AUDIO";
      }

      if (
        candidate.mimeType === "application/pdf" ||
        candidate.mimeType === "application/json" ||
        candidate.mimeType?.startsWith("text/")
      ) {
        return "DOCUMENT";
      }

      return null;
    default:
      return null;
  }
}

export function resolveAssetCategoryFromCandidate(candidate: MediaCandidate): AssetCategory {
  return candidate.category ?? candidate.suggestedCategory ?? inferCategoryFromMediaType(candidate.mediaType) ?? "REFERENCE";
}

export async function importCandidateFile(
  candidate: MediaCandidate
): Promise<StoredImportedCandidate | null> {
  if (!candidate.originalPath) {
    return null;
  }

  const absoluteOriginalPath = resolveCandidateAbsolutePath(candidate.originalPath);

  if (!absoluteOriginalPath) {
    return null;
  }

  const assetType = resolveAssetTypeFromCandidate(candidate);

  if (!assetType) {
    return null;
  }

  const category = resolveAssetCategoryFromCandidate(candidate);
  const extension =
    candidate.extension ?? normalizeExtension(candidate.originalPath);

  if (!extension) {
    return null;
  }

  const targetDirectory = join(
    assetsStorageRoot,
    category.toLowerCase(),
    assetType.toLowerCase()
  );
  await mkdir(targetDirectory, { recursive: true });

  const filename = createStoredFilename(
    candidate.originalPath.split("/").at(-1) ?? candidate.title,
    extension
  );
  const absoluteTargetPath = join(targetDirectory, filename);
  await copyFile(absoluteOriginalPath, absoluteTargetPath);

  const targetStats = await stat(absoluteTargetPath);
  const mimeType = inferMimeType(extension, candidate.mimeType ?? "");
  const relativePath = toForwardSlashes(
    relative(projectRoot, absoluteTargetPath)
  );
  const dimensions = await maybeReadImageDimensions(
    absoluteTargetPath,
    extension,
    mimeType
  );

  return {
    filename,
    path: relativePath,
    type: assetType,
    mimeType,
    extension,
    fileSize: targetStats.size,
    width: dimensions.width,
    height: dimensions.height
  };
}

