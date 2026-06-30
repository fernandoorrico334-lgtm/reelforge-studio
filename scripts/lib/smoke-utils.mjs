import { access, mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const minimalPngBuffer = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWOYAAAAASUVORK5CYII=",
  "base64"
);

export async function ensureDir(absolutePath) {
  await mkdir(absolutePath, { recursive: true });
}

export async function ensureFileParent(absolutePath) {
  await mkdir(dirname(absolutePath), { recursive: true });
}

export async function ensureArtifactsExist(projectRoot, relativePaths, hint) {
  for (const relativePath of relativePaths) {
    try {
      await access(join(projectRoot, relativePath));
    } catch {
      throw new Error(
        `Build artifact '${relativePath}' is missing. ${hint}`.trim()
      );
    }
  }
}

export async function resolveFirstExistingPath(projectRoot, relativePaths, hint) {
  for (const relativePath of relativePaths) {
    try {
      await access(join(projectRoot, relativePath));
      return relativePath;
    } catch {
      // Keep scanning candidate paths until one exists.
    }
  }

  const tried = relativePaths.map((value) => `'${value}'`).join(", ");
  throw new Error(
    `None of the expected build artifacts exist (${tried}). ${hint}`.trim()
  );
}

export async function resolveApiBuildRoot(projectRoot, hint) {
  return resolveFirstExistingPath(
    projectRoot,
    [
      "apps/api/dist/apps/api/src",
      "apps/api/dist/src",
      "apps/api/dist"
    ],
    hint
  );
}

export function apiArtifactPath(apiBuildRoot, relativePath) {
  return `${apiBuildRoot}/${relativePath}`;
}

export function isSpawnPermissionError(error) {
  if (!error) {
    return false;
  }

  const message =
    error instanceof Error
      ? `${error.code ?? ""} ${error.message}`
      : String(error);

  return /spawn\s+EPERM/i.test(message) || /\bEPERM\b/i.test(message);
}

export function buildEnvironmentBlockerMessage(subject, fallbackCommand) {
  const fallbackText = fallbackCommand
    ? ` Rode em terminal elevado ou use ${fallbackCommand}.`
    : "";

  return `${subject} bloqueado pelo ambiente. FFmpeg/child_process nao puderam ser executados.${fallbackText}`;
}

export async function safeCheckFfmpeg(runCommand) {
  try {
    const { stdout, stderr } = await runCommand("ffmpeg", ["-version"]);

    return {
      available: true,
      blockedByEnvironment: false,
      versionOutput: `${stdout}${stderr}`.trim(),
      errorMessage: null
    };
  } catch (error) {
    return {
      available: false,
      blockedByEnvironment: isSpawnPermissionError(error),
      versionOutput: "",
      errorMessage:
        error instanceof Error ? error.message : "Unknown FFmpeg error."
    };
  }
}

export async function writeMinimalPng(absolutePath, variantToken = "") {
  await ensureFileParent(absolutePath);
  const variantBuffer = variantToken
    ? Buffer.from(`\n${variantToken}`, "utf8")
    : Buffer.alloc(0);
  await writeFile(absolutePath, Buffer.concat([minimalPngBuffer, variantBuffer]));
  return absolutePath;
}

export function createSilentWavBuffer(
  durationSeconds = 0.6,
  sampleRate = 16000,
  variantToken = ""
) {
  const channelCount = 1;
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;
  const frameCount = Math.max(1, Math.round(durationSeconds * sampleRate));
  const dataSize = frameCount * channelCount * bytesPerSample;
  const byteRate = sampleRate * channelCount * bytesPerSample;
  const blockAlign = channelCount * bytesPerSample;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write("RIFF", 0, "ascii");
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8, "ascii");
  buffer.write("fmt ", 12, "ascii");
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(channelCount, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  buffer.write("data", 36, "ascii");
  buffer.writeUInt32LE(dataSize, 40);

  if (variantToken && dataSize >= 2) {
    const sampleValue = [...variantToken].reduce(
      (total, character) => total + character.charCodeAt(0),
      0
    );
    buffer.writeInt16LE((sampleValue % 32760) - 16380, 44);
  }

  return buffer;
}

export async function writeMinimalWav(
  absolutePath,
  durationSeconds = 0.6,
  sampleRate = 16000,
  variantToken = ""
) {
  await ensureFileParent(absolutePath);
  await writeFile(
    absolutePath,
    createSilentWavBuffer(durationSeconds, sampleRate, variantToken)
  );
  return absolutePath;
}

export async function writeMinimalTextFile(absolutePath, contents) {
  await ensureFileParent(absolutePath);
  await writeFile(absolutePath, contents, "utf8");
  return absolutePath;
}

export function printSmokeSummary(summary) {
  console.log(JSON.stringify(summary, null, 2));
}

export async function cleanupSmokeArtifacts(paths) {
  await Promise.all(
    paths.map((absolutePath) =>
      rm(absolutePath, {
        recursive: true,
        force: true
      })
    )
  );
}

