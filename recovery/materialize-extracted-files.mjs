import fs from "node:fs/promises";
import path from "node:path";

const recoveredRoot = path.resolve(process.cwd());
const manifestPath = path.join(
  recoveredRoot,
  "recovery",
  "manifests",
  "extracted-files.json"
);
const reportPath = path.join(
  recoveredRoot,
  "recovery",
  "reports",
  "materialized-files-report.md"
);
const materializedManifestPath = path.join(
  recoveredRoot,
  "recovery",
  "manifests",
  "materialized-files.json"
);

const excludedPrefixes = [".git/", ".codex-temp/", "node_modules/", "dist/"];
const allowedPrefixes = [
  "apps/",
  "packages/",
  "prisma/",
  "docs/",
  "scripts/",
  "storage/",
  ".gitignore",
  "README.md",
  "package.json",
  "package-lock.json",
  "tsconfig.json",
  "tsconfig.base.json"
];

function isAllowed(relativePath) {
  if (!relativePath) {
    return false;
  }

  if (excludedPrefixes.some((prefix) => relativePath.startsWith(prefix))) {
    return false;
  }

  return allowedPrefixes.some((prefix) => relativePath === prefix || relativePath.startsWith(prefix));
}

function score(record) {
  const confidenceScore =
    record.confidence === "high" ? 30 : record.confidence === "medium" ? 20 : 10;
  const completenessScore =
    record.completeness === "complete" ? 30 : record.completeness === "partial" ? 10 : 0;
  const extractionScore =
    record.extractionType === "get-content"
      ? 30
      : record.extractionType === "apply_patch:add"
        ? 25
        : record.extractionType === "apply_patch:update"
          ? 5
          : 0;

  return confidenceScore + completenessScore + extractionScore;
}

async function exists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function buildReport(records) {
  const lines = [
    "# Materialized Files Report",
    "",
    `- Generated at: \`${new Date().toISOString()}\``,
    `- Files materialized from extracted logs: \`${records.length}\``,
    "",
    "| File | Source | Extraction | Confidence | Completeness | Status |",
    "| --- | --- | --- | --- | --- | --- |"
  ];

  for (const record of records) {
    lines.push(
      `| \`${record.relativePath}\` | \`${record.sourceLog}\` | \`${record.extractionType}\` | \`${record.confidence}\` | \`${record.completeness}\` | \`${record.status}\` |`
    );
  }

  return lines.join("\n");
}

async function main() {
  const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
  const chosenByFile = new Map();

  for (const record of manifest) {
    if (!isAllowed(record.relativePath)) {
      continue;
    }

    const current = chosenByFile.get(record.relativePath);

    if (!current || score(record) > score(current)) {
      chosenByFile.set(record.relativePath, record);
      continue;
    }

    if (current && score(record) === score(current)) {
      chosenByFile.set(record.relativePath, record);
    }
  }

  const applied = [];

  for (const record of [...chosenByFile.values()].sort((left, right) => left.relativePath.localeCompare(right.relativePath))) {
    if (record.extractionType === "apply_patch:update") {
      continue;
    }

    const sourcePath = path.join(recoveredRoot, record.savedPath);
    const targetPath = path.join(recoveredRoot, record.relativePath);
    const targetPreviouslyExisted = await exists(targetPath);

    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.copyFile(sourcePath, targetPath);

    applied.push({
      ...record,
      status: targetPreviouslyExisted ? "updated from logs" : "created from logs"
    });
  }

  await fs.writeFile(reportPath, buildReport(applied), "utf8");
  await fs.writeFile(materializedManifestPath, JSON.stringify(applied, null, 2), "utf8");

  console.log(
    JSON.stringify(
      {
        materializedCount: applied.length,
        reportPath,
        materializedManifestPath
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
