import fs from "node:fs/promises";
import { createReadStream } from "node:fs";
import os from "node:os";
import path from "node:path";
import readline from "node:readline";

const recoveredRoot = path.resolve(process.cwd());
const outputRoot = path.join(recoveredRoot, "recovery", "rebuilt-from-patches");
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

  return null;
}

function patchBodyFromFunctionCall(payload) {
  if (!payload) {
    return null;
  }

  if (
    typeof payload.arguments === "string" &&
    payload.arguments.includes("*** Begin Patch")
  ) {
    return payload.arguments;
  }

  if (typeof payload.input === "string" && payload.input.includes("*** Begin Patch")) {
    return payload.input;
  }

  return null;
}

function splitLinesPreserveTrailing(text) {
  return text.split("\n");
}

function parsePatchOperations(patchBody) {
  const lines = splitLinesPreserveTrailing(patchBody.replace(/\r\n/g, "\n"));
  const operations = [];
  let index = 0;

  if (lines[index] === "*** Begin Patch") {
    index += 1;
  }

  while (index < lines.length) {
    const line = lines[index];

    if (line === "*** End Patch") {
      break;
    }

    if (line.startsWith("*** Add File: ")) {
      const relativePath = sanitizeRelativePath(line.slice("*** Add File: ".length).trim());
      index += 1;
      const addLines = [];

      while (index < lines.length && !lines[index].startsWith("*** ")) {
        if (lines[index].startsWith("+")) {
          addLines.push(lines[index].slice(1));
        }
        index += 1;
      }

      if (relativePath) {
        operations.push({
          kind: "add",
          relativePath,
          content: addLines.join("\n")
        });
      }

      continue;
    }

    if (line.startsWith("*** Update File: ")) {
      const relativePath = sanitizeRelativePath(
        line.slice("*** Update File: ".length).trim()
      );
      index += 1;

      if (lines[index]?.startsWith("*** Move to: ")) {
        index += 1;
      }

      const hunks = [];
      let currentHunk = null;

      while (index < lines.length && !lines[index].startsWith("*** ")) {
        const currentLine = lines[index];

        if (currentLine.startsWith("@@")) {
          if (currentHunk) {
            hunks.push(currentHunk);
          }

          currentHunk = [];
          index += 1;
          continue;
        }

        if (
          currentLine.startsWith(" ") ||
          currentLine.startsWith("+") ||
          currentLine.startsWith("-")
        ) {
          currentHunk ??= [];
          currentHunk.push(currentLine);
        }

        index += 1;
      }

      if (currentHunk) {
        hunks.push(currentHunk);
      }

      if (relativePath) {
        operations.push({
          kind: "update",
          relativePath,
          hunks
        });
      }

      continue;
    }

    if (line.startsWith("*** Delete File: ")) {
      const relativePath = sanitizeRelativePath(
        line.slice("*** Delete File: ".length).trim()
      );
      index += 1;

      if (relativePath) {
        operations.push({
          kind: "delete",
          relativePath
        });
      }

      continue;
    }

    index += 1;
  }

  return operations;
}

function findSequence(haystack, needle, startIndex) {
  if (needle.length === 0) {
    return startIndex;
  }

  for (let index = startIndex; index <= haystack.length - needle.length; index += 1) {
    let matched = true;

    for (let offset = 0; offset < needle.length; offset += 1) {
      if (haystack[index + offset] !== needle[offset]) {
        matched = false;
        break;
      }
    }

    if (matched) {
      return index;
    }
  }

  for (let index = 0; index <= haystack.length - needle.length; index += 1) {
    let matched = true;

    for (let offset = 0; offset < needle.length; offset += 1) {
      if (haystack[index + offset] !== needle[offset]) {
        matched = false;
        break;
      }
    }

    if (matched) {
      return index;
    }
  }

  return -1;
}

function applyUpdate(text, hunks, relativePath) {
  let lines = splitLinesPreserveTrailing(text.replace(/\r\n/g, "\n"));
  let searchStart = 0;

  for (const hunk of hunks) {
    const oldLines = hunk
      .filter((line) => !line.startsWith("+"))
      .map((line) => line.slice(1));
    const newLines = hunk
      .filter((line) => !line.startsWith("-"))
      .map((line) => line.slice(1));
    const matchIndex = findSequence(lines, oldLines, searchStart);

    if (matchIndex === -1) {
      throw new Error(`Could not apply patch hunk for ${relativePath}`);
    }

    lines = [
      ...lines.slice(0, matchIndex),
      ...newLines,
      ...lines.slice(matchIndex + oldLines.length)
    ];
    searchStart = matchIndex + newLines.length;
  }

  return lines.join("\n");
}

async function ensureParent(targetPath) {
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
}

async function applyOperationsForTargets(targets) {
  const targetSet = new Set(targets);
  const states = new Map(targets.map((target) => [target, null]));

  for (const logPath of logCandidates) {
    try {
      await fs.access(logPath);
    } catch {
      continue;
    }

    const reader = readline.createInterface({
      input: createReadStream(logPath, { encoding: "utf8" }),
      crlfDelay: Infinity
    });

    for await (const line of reader) {
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
        parsed.type !== "response_item" ||
        (parsed.payload?.type !== "function_call" &&
          parsed.payload?.type !== "custom_tool_call") ||
        parsed.payload?.name !== "apply_patch"
      ) {
        continue;
      }

      const patchBody = patchBodyFromFunctionCall(parsed.payload);

      if (!patchBody) {
        continue;
      }

      for (const operation of parsePatchOperations(patchBody)) {
        if (!targetSet.has(operation.relativePath)) {
          continue;
        }

        if (operation.kind === "add") {
          states.set(operation.relativePath, operation.content);
          continue;
        }

        if (operation.kind === "delete") {
          states.set(operation.relativePath, null);
          continue;
        }

        const current = states.get(operation.relativePath);

        if (typeof current !== "string") {
          throw new Error(
            `Update found before base content for ${operation.relativePath}`
          );
        }

        states.set(
          operation.relativePath,
          applyUpdate(current, operation.hunks, operation.relativePath)
        );
      }
    }
  }

  const written = [];

  for (const [relativePath, content] of states.entries()) {
    if (typeof content !== "string") {
      continue;
    }

    const outputPath = path.join(outputRoot, relativePath);
    await ensureParent(outputPath);
    await fs.writeFile(outputPath, content, "utf8");
    written.push({
      relativePath,
      outputPath,
      length: content.length
    });
  }

  return written;
}

async function main() {
  const targets = process.argv.slice(2);

  if (targets.length === 0) {
    throw new Error("Pass one or more relative project paths to rebuild.");
  }

  const written = await applyOperationsForTargets(targets);
  console.log(JSON.stringify({ rebuilt: written }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
