import fs from "node:fs/promises";
import path from "node:path";
import readline from "node:readline";
import { createReadStream } from "node:fs";
import os from "node:os";

const recoveredRoot = path.resolve(process.cwd());
const extractRoot = path.join(recoveredRoot, "recovery", "extracted-logs");
const reportPath = path.join(
  recoveredRoot,
  "recovery",
  "reports",
  "extracted-files-report.md"
);
const manifestPath = path.join(
  recoveredRoot,
  "recovery",
  "manifests",
  "extracted-files.json"
);
const codexRoot = path.join(os.homedir(), ".codex");
const recoveryStartCutoff = Date.parse("2026-06-29T11:57:00.000Z");

const logCandidates = [
  path.resolve(
    codexRoot,
    "sessions",
    "2026",
    "06",
    "26",
    "rollout-2026-06-26T15-18-24-019f0527-80c0-7990-ac53-9fdfb26c413d.jsonl"
  ),
  path.resolve(
    codexRoot,
    "sessions",
    "2026",
    "06",
    "28",
    "rollout-2026-06-28T13-45-55-019f0f1f-7e50-7c90-a4d7-9679b58c85e0.jsonl"
  )
];

const projectSegment = /reelforge-studio(?:-recovered)?[\\/](.+)$/i;

function sanitizeRelativePath(rawPath) {
  if (!rawPath) {
    return null;
  }

  const normalized = rawPath.replace(/^['"]|['"]$/g, "").replace(/\\/g, "/");
  const match = normalized.match(projectSegment);

  if (match?.[1]) {
    return match[1];
  }

  if (normalized.startsWith("reelforge-studio/")) {
    return normalized.slice("reelforge-studio/".length);
  }

  if (normalized.startsWith("reelforge-studio-recovered/")) {
    return normalized.slice("reelforge-studio-recovered/".length);
  }

  if (
    normalized.startsWith("apps/") ||
    normalized.startsWith("packages/") ||
    normalized.startsWith("prisma/") ||
    normalized.startsWith("docs/") ||
    normalized.startsWith("scripts/") ||
    normalized.startsWith("storage/") ||
    normalized === "package.json" ||
    normalized === "package-lock.json" ||
    normalized === "README.md" ||
    normalized === "tsconfig.json" ||
    normalized === "tsconfig.base.json" ||
    normalized === ".gitignore"
  ) {
    return normalized;
  }

  return null;
}

function extractOutputBody(output) {
  const marker = "Output:\n";
  const index = output.indexOf(marker);

  if (index === -1) {
    return null;
  }

  return output.slice(index + marker.length);
}

function hasTruncationMarker(body) {
  return (
    body.includes("Output exceeded the available model context and was truncated") ||
    /tokens truncated/i.test(body)
  );
}

function looksLikeCommandErrorBody(body) {
  const trimmed = body.trimStart();

  return /^(Get-Content|Select-String|Test-Path|Resolve-Path|cmd\.exe)\s*:/i.test(
    trimmed
  );
}

function safeFileName(input) {
  return input.replace(/[^a-zA-Z0-9._/-]/g, "_");
}

function patchBodyFromFunctionCall(payload) {
  if (!payload) {
    return null;
  }

  if (typeof payload.arguments === "string" && payload.arguments.includes("*** Begin Patch")) {
    return payload.arguments;
  }

  if (typeof payload.input === "string" && payload.input.includes("*** Begin Patch")) {
    return payload.input;
  }

  return null;
}

function parsePatchArtifacts(patchBody) {
  const artifacts = [];
  const addFileRegex = /\*\*\* Add File: ([^\n]+)\n([\s\S]*?)(?=(?:\*\*\* Add File: |\*\*\* Update File: |\*\*\* Delete File: |\*\*\* End Patch))/g;
  const updateFileRegex = /\*\*\* Update File: ([^\n]+)\n([\s\S]*?)(?=(?:\*\*\* Add File: |\*\*\* Update File: |\*\*\* Delete File: |\*\*\* End Patch))/g;

  for (const match of patchBody.matchAll(addFileRegex)) {
    const relativePath = sanitizeRelativePath(match[1].trim());

    if (!relativePath) {
      continue;
    }

    const content = match[2]
      .split("\n")
      .filter((line) => line.startsWith("+"))
      .map((line) => line.slice(1))
      .join("\n");

    artifacts.push({
      relativePath,
      extractionType: "apply_patch:add",
      confidence: "high",
      completeness: "complete",
      content
    });
  }

  for (const match of patchBody.matchAll(updateFileRegex)) {
    const relativePath = sanitizeRelativePath(match[1].trim());

    if (!relativePath) {
      continue;
    }

    artifacts.push({
      relativePath,
      extractionType: "apply_patch:update",
      confidence: "medium",
      completeness: "partial",
      content: match[2]
    });
  }

  return artifacts;
}

async function ensureParent(targetPath) {
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
}

async function writeArtifact(baseDir, relativePath, fileSuffix, content) {
  const targetPath = path.join(baseDir, `${safeFileName(relativePath)}${fileSuffix}`);
  await ensureParent(targetPath);
  await fs.writeFile(targetPath, content, "utf8");
  return targetPath;
}

function createRecord({
  relativePath,
  sourceLog,
  extractionType,
  confidence,
  completeness,
  savedPath,
  notes
}) {
  return {
    relativePath,
    sourceLog: path.basename(sourceLog),
    extractionType,
    confidence,
    completeness,
    savedPath: path.relative(recoveredRoot, savedPath).replace(/\\/g, "/"),
    notes
  };
}

function buildReport(records) {
  const lines = [
    "# Extracted Files Report",
    "",
    `- Generated at: \`${new Date().toISOString()}\``,
    `- Candidate records: \`${records.length}\``,
    "",
    "| File | Source | Extraction | Confidence | Completeness | Saved Copy | Notes |",
    "| --- | --- | --- | --- | --- | --- | --- |"
  ];

  for (const record of records) {
    lines.push(
      `| \`${record.relativePath}\` | \`${record.sourceLog}\` | \`${record.extractionType}\` | \`${record.confidence}\` | \`${record.completeness}\` | \`${record.savedPath}\` | ${record.notes} |`
    );
  }

  return lines.join("\n");
}

async function processLog(logPath, records) {
  const pendingCalls = new Map();
  const patchDir = path.join(extractRoot, "patches");
  const fileDir = path.join(extractRoot, "files");

  const reader = readline.createInterface({
    input: createReadStream(logPath, { encoding: "utf8" }),
    crlfDelay: Infinity
  });

  let lineNumber = 0;

  for await (const line of reader) {
    lineNumber += 1;

    if (!line.trim()) {
      continue;
    }

    let parsed;

    try {
      parsed = JSON.parse(line);
    } catch {
      continue;
    }

    if (typeof parsed.timestamp === "string") {
      const entryTimestamp = Date.parse(parsed.timestamp);

      if (Number.isFinite(entryTimestamp) && entryTimestamp >= recoveryStartCutoff) {
        continue;
      }
    }

    if (
      parsed.type === "response_item" &&
      (parsed.payload?.type === "function_call" ||
        parsed.payload?.type === "custom_tool_call")
    ) {
      const payload = parsed.payload;
      const callId = payload.call_id ?? payload.id ?? `${path.basename(logPath)}:${lineNumber}`;
      pendingCalls.set(callId, payload);

      if (payload.name === "apply_patch") {
        const patchBody = patchBodyFromFunctionCall(payload);

        if (patchBody) {
          const rawPatchPath = path.join(
            patchDir,
            `${safeFileName(path.basename(logPath))}--${safeFileName(callId)}.patch`
          );
          await ensureParent(rawPatchPath);
          await fs.writeFile(rawPatchPath, patchBody, "utf8");

          for (const artifact of parsePatchArtifacts(patchBody)) {
            const suffix = artifact.extractionType === "apply_patch:add" ? ".reconstructed.txt" : ".patch.txt";
            const savedPath = await writeArtifact(
              fileDir,
              artifact.relativePath,
              suffix,
              artifact.content
            );

            records.push(
              createRecord({
                ...artifact,
                sourceLog: logPath,
                savedPath,
                notes:
                  artifact.extractionType === "apply_patch:add"
                    ? "Full file recovered from Add File patch."
                    : "Partial update patch recovered; needs base file merge."
              })
            );
          }
        }
      }

      continue;
    }

    if (
      parsed.type === "response_item" &&
      (parsed.payload?.type === "function_call_output" ||
        parsed.payload?.type === "custom_tool_call_output")
    ) {
      const payload = parsed.payload;
      const pending = pendingCalls.get(payload.call_id);

      if (!pending || pending.name !== "shell_command") {
        continue;
      }

      let commandPayload;

      try {
        commandPayload = JSON.parse(pending.arguments);
      } catch {
        continue;
      }

      const command = commandPayload.command;

      if (typeof command !== "string") {
        continue;
      }

      const getContentMatch = command.match(/Get-Content\s+-Raw\s+['"]([^'"]+)['"]/i);

      if (!getContentMatch) {
        continue;
      }

      const relativePath = sanitizeRelativePath(getContentMatch[1]);

      if (!relativePath) {
        continue;
      }

      const body = extractOutputBody(payload.output ?? "");

      if (body === null) {
        continue;
      }

      if (looksLikeCommandErrorBody(body)) {
        continue;
      }

      const isTruncated = hasTruncationMarker(body);
      const savedPath = await writeArtifact(
        fileDir,
        relativePath,
        ".from-get-content.txt",
        body
      );

      records.push(
        createRecord({
          relativePath,
          sourceLog: logPath,
          extractionType: "get-content",
          confidence: isTruncated ? "medium" : "high",
          completeness: isTruncated ? "partial" : "complete",
          savedPath,
          notes: isTruncated
            ? "The captured command output appears truncated in the session log."
            : "Full file body recovered from Get-Content -Raw output."
        })
      );
    }
  }
}

async function main() {
  const availableLogs = [];

  for (const logPath of logCandidates) {
    try {
      await fs.access(logPath);
      availableLogs.push(logPath);
    } catch {
      // Ignore missing logs and continue with the ones that still exist.
    }
  }

  if (availableLogs.length === 0) {
    throw new Error("No Codex logs were found for extraction.");
  }

  await fs.mkdir(extractRoot, { recursive: true });

  const records = [];

  for (const logPath of availableLogs) {
    await processLog(logPath, records);
  }

  records.sort((left, right) => {
    const pathComparison = left.relativePath.localeCompare(right.relativePath);

    if (pathComparison !== 0) {
      return pathComparison;
    }

    return left.extractionType.localeCompare(right.extractionType);
  });

  await fs.mkdir(path.dirname(reportPath), { recursive: true });
  await fs.mkdir(path.dirname(manifestPath), { recursive: true });
  await fs.writeFile(reportPath, buildReport(records), "utf8");
  await fs.writeFile(manifestPath, JSON.stringify(records, null, 2), "utf8");

  console.log(
    JSON.stringify(
      {
        logsProcessed: availableLogs.map((target) => path.basename(target)),
        recordCount: records.length,
        reportPath,
        manifestPath
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
