import { randomBytes } from "node:crypto";
import { basename, extname, resolve, sep } from "node:path";
import type { AssetCategory, AssetType } from "../domain/asset.js";
import { ValidationError } from "../../../shared/errors.js";

export const imageExtensions = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp"
]);

export const videoExtensions = new Set([
  ".mp4",
  ".mov",
  ".webm",
  ".m4v"
]);

export const audioExtensions = new Set([
  ".mp3",
  ".wav",
  ".ogg",
  ".m4a",
  ".aac",
  ".flac"
]);

export const fontExtensions = new Set([
  ".ttf",
  ".otf",
  ".woff",
  ".woff2"
]);

export const documentExtensions = new Set([
  ".txt",
  ".md",
  ".pdf",
  ".doc",
  ".docx",
  ".rtf"
]);

export const allowedExtensionsByType: Record<AssetType, Set<string>> = {
  IMAGE: imageExtensions,
  VIDEO: videoExtensions,
  AUDIO: audioExtensions,
  MUSIC: audioExtensions,
  SFX: audioExtensions,
  OVERLAY: new Set([
    ".png",
    ".webp",
    ".gif",
    ".mov",
    ".webm",
    ".mp4"
  ]),
  DOCUMENT: documentExtensions,
  FONT: fontExtensions
};

export const mimeTypesByExtension: Record<string, string> = {
  ".aac": "audio/aac",
  ".doc": "application/msword",
  ".docx":
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".flac": "audio/flac",
  ".gif": "image/gif",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".m4a": "audio/mp4",
  ".m4v": "video/x-m4v",
  ".md": "text/markdown",
  ".mov": "video/quicktime",
  ".mp3": "audio/mpeg",
  ".mp4": "video/mp4",
  ".ogg": "audio/ogg",
  ".otf": "font/otf",
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".rtf": "application/rtf",
  ".ttf": "font/ttf",
  ".txt": "text/plain",
  ".wav": "audio/wav",
  ".webm": "video/webm",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2"
};

export function normalizeExtension(filename: string) {
  return extname(filename).trim().toLowerCase();
}

function normalizePathForComparison(value: string) {
  return resolve(value).toLowerCase();
}

export function isPathInsideRoot(targetPath: string, rootPath: string) {
  const normalizedRoot = normalizePathForComparison(rootPath);
  const normalizedTarget = normalizePathForComparison(targetPath);

  return (
    normalizedTarget === normalizedRoot ||
    normalizedTarget.startsWith(`${normalizedRoot}${sep.toLowerCase()}`)
  );
}

export function toForwardSlashes(value: string) {
  return value.replaceAll("\\", "/");
}

export function createSafeBasename(filename: string) {
  const extension = extname(filename);
  const baseName = basename(filename, extension)
    .normalize("NFKD")
    .replace(/[^\x00-\x7F]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return baseName || "asset";
}

export function createStoredFilename(originalName: string, extension: string) {
  const timestamp = Date.now();
  const suffix = randomBytes(3).toString("hex");
  return `${createSafeBasename(originalName)}-${timestamp}-${suffix}${extension}`;
}

export function inferMimeType(extension: string, reportedMimeType: string) {
  const normalizedMimeType = reportedMimeType.trim().toLowerCase();

  if (
    !normalizedMimeType ||
    normalizedMimeType === "application/octet-stream"
  ) {
    return mimeTypesByExtension[extension] || "application/octet-stream";
  }

  return normalizedMimeType;
}

export function inferAssetType(
  requestedType: AssetType | null,
  extension: string,
  mimeType: string,
  category: AssetCategory
): AssetType | null {
  if (requestedType) {
    return requestedType;
  }

  if (
    category === "OVERLAY" &&
    (imageExtensions.has(extension) || videoExtensions.has(extension))
  ) {
    return "OVERLAY";
  }

  if (category === "TRACK" && audioExtensions.has(extension)) {
    return "MUSIC";
  }

  if (category === "EFFECT" && audioExtensions.has(extension)) {
    return "SFX";
  }

  if (category === "TYPOGRAPHY" && fontExtensions.has(extension)) {
    return "FONT";
  }

  if (imageExtensions.has(extension) || mimeType.startsWith("image/")) {
    return "IMAGE";
  }

  if (videoExtensions.has(extension) || mimeType.startsWith("video/")) {
    return "VIDEO";
  }

  if (audioExtensions.has(extension) || mimeType.startsWith("audio/")) {
    return "AUDIO";
  }

  if (fontExtensions.has(extension) || mimeType.startsWith("font/")) {
    return "FONT";
  }

  return null;
}

export function validateExtensionForType(type: AssetType, extension: string) {
  if (!allowedExtensionsByType[type].has(extension)) {
    throw new ValidationError(
      `Unsupported file extension '${extension}' for type '${type}'.`
    );
  }
}

function readPngDimensions(buffer: Buffer) {
  const signature = buffer.subarray(0, 8);
  const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  if (buffer.length < 24 || !signature.equals(pngSignature)) {
    return null;
  }

  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20)
  };
}

function readGifDimensions(buffer: Buffer) {
  const header = buffer.subarray(0, 6).toString("ascii");

  if (buffer.length < 10 || (header !== "GIF87a" && header !== "GIF89a")) {
    return null;
  }

  return {
    width: buffer.readUInt16LE(6),
    height: buffer.readUInt16LE(8)
  };
}

function readJpegDimensions(buffer: Buffer) {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) {
    return null;
  }

  let offset = 2;

  while (offset < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    const marker = buffer[offset + 1];

    if (marker === undefined) {
      return null;
    }

    if (marker === 0xd8 || marker === 0xd9) {
      offset += 2;
      continue;
    }

    if (marker === 0xda) {
      return null;
    }

    if (offset + 4 >= buffer.length) {
      return null;
    }

    const segmentLength = buffer.readUInt16BE(offset + 2);

    if (segmentLength < 2 || offset + 2 + segmentLength > buffer.length) {
      return null;
    }

    const isStartOfFrame =
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf);

    if (isStartOfFrame) {
      return {
        height: buffer.readUInt16BE(offset + 5),
        width: buffer.readUInt16BE(offset + 7)
      };
    }

    offset += 2 + segmentLength;
  }

  return null;
}

function readUInt24LE(buffer: Buffer, offset: number) {
  const first = buffer[offset] ?? 0;
  const second = buffer[offset + 1] ?? 0;
  const third = buffer[offset + 2] ?? 0;

  return first | (second << 8) | (third << 16);
}

function readWebpDimensions(buffer: Buffer) {
  if (
    buffer.length < 30 ||
    buffer.subarray(0, 4).toString("ascii") !== "RIFF" ||
    buffer.subarray(8, 12).toString("ascii") !== "WEBP"
  ) {
    return null;
  }

  const chunkType = buffer.subarray(12, 16).toString("ascii");

  if (chunkType === "VP8X" && buffer.length >= 30) {
    return {
      width: readUInt24LE(buffer, 24) + 1,
      height: readUInt24LE(buffer, 27) + 1
    };
  }

  if (chunkType === "VP8L" && buffer.length >= 25) {
    const byte1 = buffer[21];
    const byte2 = buffer[22];
    const byte3 = buffer[23];
    const byte4 = buffer[24];

    if (
      byte1 === undefined ||
      byte2 === undefined ||
      byte3 === undefined ||
      byte4 === undefined
    ) {
      return null;
    }

    return {
      width: 1 + (((byte2 & 0x3f) << 8) | byte1),
      height:
        1 +
        (((byte4 & 0x0f) << 10) | (byte3 << 2) | ((byte2 & 0xc0) >> 6))
    };
  }

  return null;
}

export function detectImageDimensions(
  buffer: Buffer,
  extension: string,
  mimeType: string
) {
  if (!mimeType.startsWith("image/")) {
    return {
      width: null,
      height: null
    };
  }

  if (extension === ".png") {
    return readPngDimensions(buffer) ?? { width: null, height: null };
  }

  if (extension === ".gif") {
    return readGifDimensions(buffer) ?? { width: null, height: null };
  }

  if (extension === ".jpg" || extension === ".jpeg") {
    return readJpegDimensions(buffer) ?? { width: null, height: null };
  }

  if (extension === ".webp") {
    return readWebpDimensions(buffer) ?? { width: null, height: null };
  }

  return {
    width: null,
    height: null
  };
}

export function isRangePreviewable(mimeType: string) {
  return mimeType.startsWith("video/") || mimeType.startsWith("audio/");
}

