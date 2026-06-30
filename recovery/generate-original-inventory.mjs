import fs from "node:fs/promises";
import path from "node:path";

const recoveredRoot = path.resolve(process.cwd());
const originalRoot = path.resolve(
  recoveredRoot,
  "..",
  "reelforge-studio"
);
const reportPath = path.join(
  recoveredRoot,
  "recovery",
  "reports",
  "original-inventory.md"
);
const manifestPath = path.join(
  recoveredRoot,
  "recovery",
  "manifests",
  "original-inventory.json"
);

const criticalPaths = [
  "package.json",
  "README.md",
  ".gitignore",
  "tsconfig.json",
  "tsconfig.base.json",
  "docs/VISION.md",
  "docs/PRODUCT_SPEC.md",
  "docs/ARCHITECTURE.md",
  "docs/ROADMAP.md",
  "docs/MODULES.md",
  "docs/CODEX_GUIDE.md",
  "apps/api/package.json",
  "apps/api/src/index.ts",
  "apps/api/src/http/app.ts",
  "apps/web/package.json",
  "apps/web/src/app/page.tsx",
  "apps/worker/package.json",
  "apps/worker/src/index.ts",
  "prisma/schema.prisma",
  "prisma/seed.mjs",
  "packages/audio-engine/package.json",
  "packages/audio-engine/src/index.ts",
  "packages/caption-engine/package.json",
  "packages/caption-engine/src/index.ts",
  "packages/cinematic-engine/package.json",
  "packages/cinematic-engine/src/index.ts",
  "packages/hybrid-visual-engine/package.json",
  "packages/hybrid-visual-engine/src/index.ts",
  "packages/media-collector/package.json",
  "packages/media-collector/src/index.ts",
  "packages/prompt-engine/package.json",
  "packages/prompt-engine/src/index.ts",
  "packages/research-collector/package.json",
  "packages/research-collector/src/index.ts",
  "packages/story-engine/package.json",
  "packages/story-engine/src/index.ts",
  "packages/templates/package.json",
  "packages/templates/src/index.ts",
  "packages/video-engine/package.json",
  "packages/video-engine/src/index.ts",
  "apps/api/src/modules/characters",
  "apps/api/src/modules/hybrid-visual",
  "apps/api/src/modules/intake",
  "apps/api/src/modules/media-collector",
  "apps/api/src/modules/production",
  "apps/api/src/modules/render-jobs",
  "apps/api/src/modules/research",
  "apps/web/src/app/assets",
  "apps/web/src/app/channels",
  "apps/web/src/app/characters",
  "apps/web/src/app/intake",
  "apps/web/src/app/media-collector",
  "apps/web/src/app/produce",
  "apps/web/src/app/projects",
  "apps/web/src/app/prompt-lab",
  "apps/web/src/app/renders",
  "apps/web/src/app/research",
  "scripts/smoke-research.mjs",
  "scripts/smoke-intake.mjs",
  "scripts/smoke-production-flow.mjs",
  "scripts/smoke-media-collector.mjs",
  "scripts/smoke-hybrid-visual.mjs",
  "scripts/smoke-hybrid-visual-render-ready.mjs",
  "scripts/smoke-comfy-provider-contract.mjs",
  "scripts/smoke-comfy-provider-mock-status.mjs",
  "scripts/smoke-comfy-provider-local.mjs",
  "scripts/smoke-prompt-engine.mjs",
  "scripts/lib/smoke-utils.mjs"
];

async function exists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function walk(currentPath, state) {
  const entries = await fs.readdir(currentPath, { withFileTypes: true });
  const relativePath = path.relative(originalRoot, currentPath).replace(/\\/g, "/");
  const skipDeep = relativePath === "node_modules" || relativePath.startsWith("node_modules/");
  const skipGitDeep = relativePath === ".git" || relativePath.startsWith(".git/");

  if (entries.length === 0 && !skipDeep && !skipGitDeep) {
    state.emptyDirectories.push(relativePath || ".");
  }

  for (const entry of entries) {
    const entryPath = path.join(currentPath, entry.name);
    const entryRelative = path
      .relative(originalRoot, entryPath)
      .replace(/\\/g, "/");

    if (entryRelative === "node_modules" || entryRelative.startsWith("node_modules/")) {
      continue;
    }

    if (entryRelative === ".git") {
      state.gitSummary.exists = true;
      continue;
    }

    if (entry.isDirectory()) {
      await walk(entryPath, state);
      continue;
    }

    const stats = await fs.stat(entryPath);
    state.files.push({
      path: entryRelative,
      size: stats.size
    });
  }
}

function buildMarkdown(state) {
  const preservedFiles = state.files.map((file) => `- \`${file.path}\` (${file.size} bytes)`);
  const emptyDirs = state.emptyDirectories.map((dir) => `- \`${dir}\``);
  const missingCritical = state.missingCriticalPaths.map((target) => `- \`${target}\``);

  return [
    "# Original Inventory",
    "",
    `- Generated from: \`${originalRoot}\``,
    `- Generated at: \`${new Date().toISOString()}\``,
    `- Files outside node_modules: \`${state.files.length}\``,
    `- Empty directories outside node_modules/.git: \`${state.emptyDirectories.length}\``,
    `- Critical missing paths: \`${state.missingCriticalPaths.length}\``,
    `- .git shell present: \`${state.gitSummary.exists ? "yes" : "no"}\``,
    "",
    "## Notes",
    "",
    "- This inventory treats the original ReelForge folder as evidence and does not mutate it.",
    "- `node_modules` is excluded from the file listing.",
    "- Deep `.git` internals are not enumerated here because the old repository is frozen and already known to be unusable.",
    "",
    "## Existing Files",
    "",
    ...(preservedFiles.length ? preservedFiles : ["- None found."]),
    "",
    "## Empty Directories",
    "",
    ...(emptyDirs.length ? emptyDirs : ["- None found."]),
    "",
    "## Critical Missing Paths",
    "",
    ...(missingCritical.length ? missingCritical : ["- None."])
  ].join("\n");
}

async function main() {
  const state = {
    files: [],
    emptyDirectories: [],
    gitSummary: {
      exists: false
    },
    missingCriticalPaths: []
  };

  await walk(originalRoot, state);

  for (const relativePath of criticalPaths) {
    const targetPath = path.join(originalRoot, relativePath);
    if (!(await exists(targetPath))) {
      state.missingCriticalPaths.push(relativePath);
    }
  }

  state.files.sort((left, right) => left.path.localeCompare(right.path));
  state.emptyDirectories.sort((left, right) => left.localeCompare(right));
  state.missingCriticalPaths.sort((left, right) => left.localeCompare(right));

  await fs.mkdir(path.dirname(reportPath), { recursive: true });
  await fs.mkdir(path.dirname(manifestPath), { recursive: true });
  await fs.writeFile(reportPath, buildMarkdown(state), "utf8");
  await fs.writeFile(manifestPath, JSON.stringify(state, null, 2), "utf8");

  console.log(
    JSON.stringify(
      {
        reportPath,
        manifestPath,
        fileCount: state.files.length,
        emptyDirectoryCount: state.emptyDirectories.length,
        missingCriticalCount: state.missingCriticalPaths.length
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
