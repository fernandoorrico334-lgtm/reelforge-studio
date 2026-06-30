import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const moduleDirectory = dirname(fileURLToPath(import.meta.url));

function resolveProjectRoot(startDirectory: string) {
  let currentDirectory = startDirectory;

  for (let index = 0; index < 10; index += 1) {
    const hasWorkspaceMarkers =
      existsSync(join(currentDirectory, "package.json")) &&
      existsSync(join(currentDirectory, "prisma", "schema.prisma")) &&
      existsSync(join(currentDirectory, "apps")) &&
      existsSync(join(currentDirectory, "packages"));

    if (hasWorkspaceMarkers) {
      return currentDirectory;
    }

    const parentDirectory = dirname(currentDirectory);

    if (parentDirectory === currentDirectory) {
      break;
    }

    currentDirectory = parentDirectory;
  }

  return fileURLToPath(new URL("../../../../", import.meta.url));
}

export const projectRoot = resolveProjectRoot(moduleDirectory);

export const storageRoot = join(projectRoot, "storage");
export const assetsStorageRoot = join(storageRoot, "assets");
export const inboxStorageRoot = join(storageRoot, "inbox");
export const researchStorageRoot = join(storageRoot, "research");
export const rendersStorageRoot = join(storageRoot, "renders");

