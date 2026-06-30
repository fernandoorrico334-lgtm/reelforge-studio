import { writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { mkdir } from "node:fs/promises";
import { deflateSync } from "node:zlib";

interface RgbColor {
  r: number;
  g: number;
  b: number;
}

export interface MockVisualRasterInput {
  width: number;
  height: number;
  seed: number | null;
  primary: string;
  secondary: string;
  accent: string;
}

const crcTable = new Uint32Array(256);

for (let index = 0; index < 256; index += 1) {
  let value = index;

  for (let bit = 0; bit < 8; bit += 1) {
    value = (value & 1) === 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }

  crcTable[index] = value >>> 0;
}

function clampByte(value: number) {
  return Math.min(255, Math.max(0, Math.round(value)));
}

function parseHexColor(hex: string): RgbColor {
  const normalized = hex.trim().replace(/^#/u, "");

  if (!/^[0-9a-fA-F]{6}$/u.test(normalized)) {
    return { r: 24, g: 32, b: 48 };
  }

  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16)
  };
}

function mixColor(left: RgbColor, right: RgbColor, ratio: number): RgbColor {
  const t = Math.min(1, Math.max(0, ratio));

  return {
    r: clampByte(left.r + (right.r - left.r) * t),
    g: clampByte(left.g + (right.g - left.g) * t),
    b: clampByte(left.b + (right.b - left.b) * t)
  };
}

function multiplyColor(color: RgbColor, factor: number): RgbColor {
  return {
    r: clampByte(color.r * factor),
    g: clampByte(color.g * factor),
    b: clampByte(color.b * factor)
  };
}

function addColor(base: RgbColor, addition: RgbColor, opacity: number): RgbColor {
  const safeOpacity = Math.min(1, Math.max(0, opacity));

  return {
    r: clampByte(base.r + addition.r * safeOpacity),
    g: clampByte(base.g + addition.g * safeOpacity),
    b: clampByte(base.b + addition.b * safeOpacity)
  };
}

function computeCrc32(buffer: Buffer) {
  let crc = 0xffffffff;

  for (const value of buffer) {
    crc = (crcTable[(crc ^ value) & 0xff] ?? 0) ^ (crc >>> 8);
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function createChunk(type: string, data: Buffer) {
  const typeBuffer = Buffer.from(type, "ascii");
  const body = Buffer.concat([typeBuffer, data]);
  const chunk = Buffer.alloc(12 + data.length);

  chunk.writeUInt32BE(data.length, 0);
  body.copy(chunk, 4);
  chunk.writeUInt32BE(computeCrc32(body), 8 + data.length);

  return chunk;
}

function isInsideRoundedRect(
  x: number,
  y: number,
  left: number,
  top: number,
  width: number,
  height: number,
  radius: number
) {
  const right = left + width;
  const bottom = top + height;

  if (x < left || x >= right || y < top || y >= bottom) {
    return false;
  }

  const rx = Math.min(radius, width / 2);
  const ry = Math.min(radius, height / 2);

  if (
    (x >= left + rx && x < right - rx) ||
    (y >= top + ry && y < bottom - ry)
  ) {
    return true;
  }

  const centerX = x < left + rx ? left + rx : right - rx;
  const centerY = y < top + ry ? top + ry : bottom - ry;
  const dx = x - centerX;
  const dy = y - centerY;

  return dx * dx + dy * dy <= rx * ry;
}

export function createMockGeneratedVisualPngBuffer(
  input: MockVisualRasterInput
) {
  const width = Math.max(128, Math.round(input.width));
  const height = Math.max(128, Math.round(input.height));
  const primary = parseHexColor(input.primary);
  const secondary = parseHexColor(input.secondary);
  const accent = parseHexColor(input.accent);
  const raw = Buffer.alloc((width * 4 + 1) * height);
  const centerX = width * 0.5;
  const centerY = height * 0.38;
  const glowX = width * (0.24 + (((input.seed ?? 37) % 31) / 100));
  const glowY = height * (0.16 + (((input.seed ?? 53) % 19) / 100));
  const glowRadius = Math.max(width, height) * 0.22;
  const frameLeft = Math.round(width * 0.085);
  const frameTop = Math.round(height * 0.08);
  const frameWidth = Math.round(width * 0.83);
  const frameHeight = Math.round(height * 0.84);
  const frameRadius = Math.round(width * 0.035);
  const accentBarTop = Math.round(height * 0.12);
  const accentBarHeight = Math.round(height * 0.032);
  const bottomPanelTop = Math.round(height * 0.73);
  const bottomPanelHeight = Math.round(height * 0.12);

  for (let y = 0; y < height; y += 1) {
    const rowOffset = y * (width * 4 + 1);
    raw[rowOffset] = 0;
    const verticalRatio = y / Math.max(height - 1, 1);

    for (let x = 0; x < width; x += 1) {
      const pixelOffset = rowOffset + 1 + x * 4;
      const horizontalRatio = x / Math.max(width - 1, 1);
      let color = mixColor(
        mixColor(primary, secondary, verticalRatio),
        secondary,
        horizontalRatio * 0.15
      );

      const dx = x - centerX;
      const dy = y - centerY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const vignetteFactor = 1 - Math.min(0.34, distance / Math.max(width, height) * 0.48);
      color = multiplyColor(color, vignetteFactor);

      const glowDx = x - glowX;
      const glowDy = y - glowY;
      const glowDistance = Math.sqrt(glowDx * glowDx + glowDy * glowDy);
      const glowOpacity = Math.max(0, 1 - glowDistance / glowRadius) * 0.42;

      if (glowOpacity > 0.001) {
        color = addColor(color, accent, glowOpacity);
      }

      const stripeBand = Math.sin((x + y * 0.45 + (input.seed ?? 17)) / 42);

      if (stripeBand > 0.91 && y > frameTop && y < frameTop + frameHeight) {
        color = addColor(color, accent, 0.08);
      }

      if (
        isInsideRoundedRect(
          x,
          y,
          frameLeft,
          frameTop,
          frameWidth,
          frameHeight,
          frameRadius
        )
      ) {
        color = multiplyColor(color, 0.72);
      }

      if (
        isInsideRoundedRect(
          x,
          y,
          frameLeft + Math.round(width * 0.04),
          accentBarTop,
          Math.round(width * 0.18),
          accentBarHeight,
          Math.round(accentBarHeight / 2)
        )
      ) {
        color = addColor(color, accent, 0.24);
      }

      if (
        isInsideRoundedRect(
          x,
          y,
          frameLeft + Math.round(width * 0.04),
          bottomPanelTop,
          Math.round(width * 0.72),
          bottomPanelHeight,
          Math.round(width * 0.025)
        )
      ) {
        color = multiplyColor(color, 0.62);
        color = addColor(color, accent, 0.08);
      }

      if (
        isInsideRoundedRect(
          x,
          y,
          width - Math.round(width * 0.24),
          accentBarTop + Math.round(height * 0.005),
          Math.round(width * 0.1),
          Math.round(height * 0.045),
          Math.round(width * 0.022)
        )
      ) {
        color = addColor(color, accent, 0.16);
      }

      raw[pixelOffset] = color.r;
      raw[pixelOffset + 1] = color.g;
      raw[pixelOffset + 2] = color.b;
      raw[pixelOffset + 3] = 255;
    }
  }

  const compressed = deflateSync(raw, { level: 9 });
  const header = Buffer.from([
    0x89, 0x50, 0x4e, 0x47,
    0x0d, 0x0a, 0x1a, 0x0a
  ]);
  const ihdr = Buffer.alloc(13);

  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    header,
    createChunk("IHDR", ihdr),
    createChunk("IDAT", compressed),
    createChunk("IEND", Buffer.alloc(0))
  ]);
}

export async function writeMockGeneratedVisualPng(
  absolutePath: string,
  input: MockVisualRasterInput
) {
  await mkdir(dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, createMockGeneratedVisualPngBuffer(input));
  return absolutePath;
}

