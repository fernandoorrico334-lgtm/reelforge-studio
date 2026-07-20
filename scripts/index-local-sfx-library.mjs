import { spawnSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { basename, extname, join, relative, resolve, sep } from "node:path";
import { PrismaClient } from "@prisma/client";

function toFileSystemPath(pathname) {
  return decodeURIComponent(pathname).replace(/^\/([A-Za-z]:\/)/, "$1");
}

const projectRoot = resolve(toFileSystemPath(new URL("..", import.meta.url).pathname));
const effectsRoot = resolve(projectRoot, "storage", "assets", "sfx");
const dryRun = process.argv.includes("--dry-run");
const audioExtensions = new Set([".wav", ".mp3", ".m4a", ".aac", ".ogg", ".flac"]);
const videoExtensions = new Set([".mp4", ".mov"]);
const supportedExtensions = new Set([...audioExtensions, ...videoExtensions]);

const categoryKeywords = [
  { category: "whoosh", keywords: ["whoosh", "swoosh", "swish", "sweep", "woosh", "whip"] },
  { category: "riser", keywords: ["riser", "rise", "build", "swell", "tension"] },
  { category: "boom", keywords: ["boom", "drop", "bass", "sub", "explosion", "impact_boom"] },
  { category: "crowd", keywords: ["crowd", "cheer", "stadium", "applause"] },
  { category: "whistle", keywords: ["whistle", "referee"] },
  { category: "hit", keywords: ["hit", "punch", "slam", "smack", "thud", "kick"] },
  { category: "impact", keywords: ["impact", "crash", "bang", "stomp", "pop", "shock"] },
  { category: "flash", keywords: ["flash", "glitch", "snap", "flicker", "light"] },
  { category: "ambience", keywords: ["ambience", "room", "noise", "atmos", "texture", "clutter"] },
  { category: "transition", keywords: ["transition", "film", "filmstrip", "shape", "tear", "cut"] }
];

function toRepoPath(filePath) {
  return relative(projectRoot, filePath).split(sep).join("/");
}

function normalizeText(value) {
  return value.toLowerCase().replace(/[_-]+/g, " ");
}

function titleFromFilename(filePath) {
  return basename(filePath, extname(filePath))
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function inferCategory(filePath) {
  const searchText = normalizeText(toRepoPath(filePath));

  for (const entry of categoryKeywords) {
    if (entry.keywords.some((keyword) => searchText.includes(keyword))) {
      return entry.category;
    }
  }

  return "transition";
}

function inferIntensity(filePath, category) {
  const searchText = normalizeText(toRepoPath(filePath));

  if (["boom"].includes(category) || /extreme|huge|massive|drop|explosion|slam/.test(searchText)) {
    return "extreme";
  }

  if (["hit", "impact", "flash"].includes(category) || /fast|hard|strong|punch|impact/.test(searchText)) {
    return "high";
  }

  if (/soft|subtle|light|small/.test(searchText)) {
    return "low";
  }

  return "medium";
}

function inferUseCase(category) {
  if (["whoosh", "transition", "flash"].includes(category)) return "transition";
  if (["hit", "impact", "boom"].includes(category)) return "impact_moment";
  if (category === "riser") return "reveal";
  if (["crowd", "whistle"].includes(category)) return "football";
  return "generic";
}

function mimeTypeForExtension(extension) {
  switch (extension) {
    case ".wav":
      return "audio/wav";
    case ".mp3":
      return "audio/mpeg";
    case ".m4a":
      return "audio/mp4";
    case ".aac":
      return "audio/aac";
    case ".ogg":
      return "audio/ogg";
    case ".flac":
      return "audio/flac";
    case ".mov":
      return "video/quicktime";
    case ".mp4":
      return "video/mp4";
    default:
      return "application/octet-stream";
  }
}

function probeDuration(filePath) {
  const ffprobe = process.env.FFPROBE_PATH || "ffprobe";
  const result = spawnSync(
    ffprobe,
    [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "default=noprint_wrappers=1:nokey=1",
      filePath
    ],
    { encoding: "utf8", windowsHide: true }
  );

  if (result.error || result.status !== 0) {
    return {
      duration: null,
      warning:
        result.error?.message ||
        result.stderr?.trim() ||
        "ffprobe could not read duration"
    };
  }

  const duration = Number.parseFloat(result.stdout.trim());

  return {
    duration: Number.isFinite(duration) ? Math.round(duration * 1000) / 1000 : null,
    warning: null
  };
}

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await collectFiles(entryPath)));
      continue;
    }

    if (!entry.isFile() || entry.name === ".gitkeep") {
      continue;
    }

    const extension = extname(entry.name).toLowerCase();
    if (supportedExtensions.has(extension)) {
      files.push(entryPath);
    }
  }

  return files.sort((left, right) => left.localeCompare(right));
}

function buildRecords(filePath) {
  const extension = extname(filePath).toLowerCase();
  const isAudioSfx = audioExtensions.has(extension);
  const stats = statSync(filePath);
  const category = inferCategory(filePath);
  const intensity = inferIntensity(filePath, category);
  const useCase = inferUseCase(category);
  const title = titleFromFilename(filePath);
  const { duration, warning } = probeDuration(filePath);
  const tags = [
    isAudioSfx ? "local-sfx" : "local-visual-sfx",
    "authorized",
    isAudioSfx ? "audio-sfx-pack" : "visual-overlay-pack",
    category,
    intensity,
    useCase,
    extension.replace(".", "")
  ];

  return {
    warning,
    isAudioSfx,
    asset: {
      filename: basename(filePath),
      originalName: basename(filePath),
      path: toRepoPath(filePath),
      type: isAudioSfx ? "SFX" : "OVERLAY",
      category: isAudioSfx ? "EFFECT" : "OVERLAY",
      tags: JSON.stringify([...new Set(tags)]),
      licenseType: "USER_OWNED",
      copyrightRisk: "LOW",
      recommendedUse: isAudioSfx
        ? "Local authorized audio SFX pack for captions, page tears, impacts and motion accents."
        : "Local authorized visual effects overlay pack for film clutter, transitions and cinematic texture.",
      duration,
      mimeType: mimeTypeForExtension(extension),
      extension,
      fileSize: stats.size,
      sourceProvider: isAudioSfx ? "local-sfx-pack" : "local-visual-sfx-pack",
      sourceLicense: "user-owned",
      usageNotes:
        "Imported from storage/assets/sfx. Original file stays local and ignored by Git."
    },
    profile: isAudioSfx
      ? {
          title,
          category,
          intensity,
          durationSeconds: duration,
          useCase,
          licenseStatus: "owned",
          notes: `Local authorized SFX pack. Auto-indexed as ${category}/${intensity}/${useCase}.`
        }
      : null
  };
}

async function main() {
  if (!existsSync(effectsRoot)) {
    throw new Error(`SFX/effects folder not found: ${effectsRoot}`);
  }

  const files = await collectFiles(effectsRoot);
  const warnings = [];
  const typeCounts = new Map();
  const categoryCounts = new Map();
  let createdAssets = 0;
  let updatedAssets = 0;
  let createdProfiles = 0;
  let updatedProfiles = 0;

  if (dryRun) {
    const preview = files.slice(0, 10).map((filePath) => {
      const records = buildRecords(filePath);
      return {
        path: records.asset.path,
        type: records.asset.type,
        category: records.profile?.category ?? "visual_overlay",
        intensity: records.profile?.intensity ?? "medium",
        useCase: records.profile?.useCase ?? "visual_effect",
        duration: records.asset.duration
      };
    });

    console.log(JSON.stringify({
      status: "dry-run",
      scannedFiles: files.length,
      preview
    }, null, 2));
    return;
  }

  const prisma = new PrismaClient();

  try {
    for (const filePath of files) {
      const records = buildRecords(filePath);

      if (records.warning) {
        warnings.push({
          path: records.asset.path,
          warning: records.warning
        });
      }

      typeCounts.set(records.asset.type, (typeCounts.get(records.asset.type) ?? 0) + 1);
      categoryCounts.set(
        records.profile?.category ?? "visual_overlay",
        (categoryCounts.get(records.profile?.category ?? "visual_overlay") ?? 0) + 1
      );

      const existingAsset = await prisma.asset.findUnique({
        where: { path: records.asset.path },
        select: { id: true }
      });

      const asset = await prisma.asset.upsert({
        where: { path: records.asset.path },
        create: records.asset,
        update: records.asset
      });

      if (existingAsset) updatedAssets += 1;
      else createdAssets += 1;

      if (!records.profile) {
        continue;
      }

      const existingProfile = await prisma.sfxAssetProfile.findUnique({
        where: { assetId: asset.id },
        select: { assetId: true }
      });

      await prisma.sfxAssetProfile.upsert({
        where: { assetId: asset.id },
        create: {
          assetId: asset.id,
          ...records.profile
        },
        update: records.profile
      });

      if (existingProfile) updatedProfiles += 1;
      else createdProfiles += 1;
    }
  } finally {
    await prisma.$disconnect();
  }

  console.log(JSON.stringify({
    status: "completed",
    dryRun,
    effectsRoot: toRepoPath(effectsRoot),
    scannedFiles: files.length,
    createdAssets,
    updatedAssets,
    createdProfiles,
    updatedProfiles,
    typeCounts: Object.fromEntries([...typeCounts.entries()].sort()),
    categoryCounts: Object.fromEntries([...categoryCounts.entries()].sort()),
    warnings: warnings.slice(0, 10),
    warningCount: warnings.length
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
