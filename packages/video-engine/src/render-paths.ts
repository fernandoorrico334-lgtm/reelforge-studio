import { dirname, join, normalize, relative, resolve, sep } from "node:path";

export interface RenderJobPaths {
  jobRoot: string;
  workDir: string;
  outputPath: string;
  visualOutputPath: string;
  thumbnailPath: string;
  blueprintPath: string;
  srtPath: string;
  assPath: string;
  logPath: string;
  concatListPath: string;
  mergedVideoPath: string;
}

function normalizeForComparison(value: string) {
  return resolve(value).toLowerCase();
}

export function toForwardSlashes(value: string) {
  return value.replaceAll("\\", "/");
}

export function isPathInsideRoot(targetPath: string, rootPath: string) {
  const normalizedRoot = normalizeForComparison(rootPath);
  const normalizedTarget = normalizeForComparison(targetPath);

  return (
    normalizedTarget === normalizedRoot ||
    normalizedTarget.startsWith(`${normalizedRoot}${sep.toLowerCase()}`)
  );
}

export function ensurePathInsideRoot(targetPath: string, rootPath: string) {
  if (!isPathInsideRoot(targetPath, rootPath)) {
    throw new Error(`Path '${targetPath}' escapes the allowed root '${rootPath}'.`);
  }

  return targetPath;
}

export function createRenderJobPaths(
  rendersStorageRoot: string,
  videoProjectId: string,
  renderJobId: string
): RenderJobPaths {
  const jobRoot = join(rendersStorageRoot, videoProjectId, renderJobId);
  const workDir = join(jobRoot, "work");

  return {
    jobRoot,
    workDir,
    outputPath: join(jobRoot, "output.mp4"),
    visualOutputPath: join(workDir, "visual.mp4"),
    thumbnailPath: join(jobRoot, "thumbnail.jpg"),
    blueprintPath: join(jobRoot, "blueprint.json"),
    srtPath: join(jobRoot, "captions.srt"),
    assPath: join(jobRoot, "captions.ass"),
    logPath: join(jobRoot, "render.log"),
    concatListPath: join(workDir, "concat.txt"),
    mergedVideoPath: join(workDir, "merged.mp4")
  };
}

export function toRelativeStoragePath(projectRoot: string, absolutePath: string) {
  const resolvedProjectRoot = resolve(projectRoot);
  const resolvedAbsolutePath = resolve(absolutePath);
  ensurePathInsideRoot(resolvedAbsolutePath, resolvedProjectRoot);
  return toForwardSlashes(relative(resolvedProjectRoot, resolvedAbsolutePath));
}

export function resolveStoragePath(projectRoot: string, relativePath: string) {
  const absolutePath = normalize(resolve(projectRoot, relativePath));
  ensurePathInsideRoot(absolutePath, projectRoot);
  return absolutePath;
}

export function ensureParentDirectoryPath(filePath: string) {
  return dirname(filePath);
}

