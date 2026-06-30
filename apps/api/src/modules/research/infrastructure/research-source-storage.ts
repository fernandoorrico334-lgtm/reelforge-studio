import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, normalize, relative, resolve } from "node:path";
import { projectRoot, researchStorageRoot } from "../../../config/paths.js";

const researchRawRoot = join(researchStorageRoot, "raw");

function toProjectRelativePath(absolutePath: string) {
  return relative(projectRoot, absolutePath).replaceAll("\\", "/");
}

function resolveResearchPath(relativePath: string) {
  const absolutePath = resolve(projectRoot, relativePath);
  const normalizedRoot = normalize(researchStorageRoot);
  const normalizedTarget = normalize(absolutePath);

  if (!normalizedTarget.startsWith(normalizedRoot)) {
    throw new Error("Research rawTextPath points outside storage/research.");
  }

  return absolutePath;
}

function sanitizePathSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "-");
}

export async function writeResearchSourceText(
  dossierId: string,
  sourceId: string,
  contents: string
) {
  const safeDossierId = sanitizePathSegment(dossierId);
  const safeSourceId = sanitizePathSegment(sourceId);
  const absolutePath = join(
    researchRawRoot,
    safeDossierId,
    `${safeSourceId}.txt`
  );

  await mkdir(dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, contents, "utf8");
  return toProjectRelativePath(absolutePath);
}

export async function readResearchSourceText(
  rawTextPath: string | null | undefined
) {
  if (!rawTextPath) {
    return null;
  }

  try {
    return await readFile(resolveResearchPath(rawTextPath), "utf8");
  } catch {
    return null;
  }
}