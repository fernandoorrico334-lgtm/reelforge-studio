import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const currentFilePath = fileURLToPath(import.meta.url);
const repoRoot = dirname(dirname(currentFilePath));

const prismaCliPath = join(repoRoot, "node_modules", "prisma", "build", "index.js");
const enginesPackageDir = join(repoRoot, "node_modules", "@prisma", "engines");
const enginesDistDir = join(enginesPackageDir, "dist");
const enginesIndexPath = join(enginesDistDir, "index.js");
const enginesTypesPath = join(enginesDistDir, "index.d.ts");

function ensurePrismaEnginesRuntime() {
  if (existsSync(enginesIndexPath)) {
    return;
  }

  mkdirSync(enginesDistDir, { recursive: true });

  const runtimeSource = `"use strict";
const path = require("node:path");
const { enginesVersion } = require("@prisma/engines-version");

function getEnginesPath() {
  return path.join(__dirname, "..");
}

function getCliQueryEngineBinaryType() {
  const configuredType =
    process.env.PRISMA_CLI_QUERY_ENGINE_TYPE ??
    process.env.PRISMA_QUERY_ENGINE_TYPE ??
    "library";

  return configuredType === "binary" ? "query-engine" : "libquery-engine";
}

async function ensureNeededBinariesExist() {
  return;
}

module.exports = {
  enginesVersion,
  getEnginesPath,
  getCliQueryEngineBinaryType,
  ensureNeededBinariesExist,
};
`;

  const typesSource = `export declare const enginesVersion: string;
export declare function getEnginesPath(): string;
export declare function getCliQueryEngineBinaryType(): "query-engine" | "libquery-engine";
export declare function ensureNeededBinariesExist(): Promise<void>;
`;

  writeFileSync(enginesIndexPath, runtimeSource, "utf8");
  writeFileSync(enginesTypesPath, typesSource, "utf8");
}

ensurePrismaEnginesRuntime();

const child = spawn(process.execPath, [prismaCliPath, ...process.argv.slice(2)], {
  cwd: repoRoot,
  env: process.env,
  stdio: "inherit",
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 1);
});
