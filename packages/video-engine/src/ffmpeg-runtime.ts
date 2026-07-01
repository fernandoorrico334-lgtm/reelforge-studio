import { spawn } from "node:child_process";

export type BinaryName = "ffmpeg" | "ffprobe";

export interface ResolvedBinaryCommand {
  binary: BinaryName;
  command: string;
  source: "env" | "path";
  envVar: "FFMPEG_PATH" | "FFPROBE_PATH";
}

export interface BinaryAvailability extends ResolvedBinaryCommand {
  available: boolean;
  blockedByEnvironment: boolean;
  notFound: boolean;
  versionOutput: string;
  errorMessage: string | null;
}

const binaryEnvMap = {
  ffmpeg: "FFMPEG_PATH",
  ffprobe: "FFPROBE_PATH"
} as const;

function normalizeConfiguredCommand(value: string | undefined) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length >= 2) {
    return trimmed.slice(1, -1).trim() || null;
  }

  return trimmed;
}

function formatCommandForError(command: string, args: string[]) {
  return [command, ...args].join(" ");
}

export function isSpawnPermissionError(error: unknown) {
  if (!error) {
    return false;
  }

  if (error instanceof Error) {
    if ("code" in error && error.code === "EPERM") {
      return true;
    }

    return /spawn\s+EPERM/i.test(error.message) || /\bEPERM\b/i.test(error.message);
  }

  return /\bEPERM\b/i.test(String(error));
}

export function isBinaryNotFoundError(error: unknown) {
  if (!error) {
    return false;
  }

  if (error instanceof Error) {
    if ("code" in error && error.code === "ENOENT") {
      return true;
    }

    return /\bENOENT\b/i.test(error.message) || /not found/i.test(error.message);
  }

  return /\bENOENT\b/i.test(String(error));
}

export function resolveBinaryCommand(binary: BinaryName): ResolvedBinaryCommand {
  const envVar = binaryEnvMap[binary];
  const configuredCommand = normalizeConfiguredCommand(process.env[envVar]);

  return {
    binary,
    command: configuredCommand ?? binary,
    source: configuredCommand ? "env" : "path",
    envVar
  };
}

export function getFfmpegCommand() {
  return resolveBinaryCommand("ffmpeg").command;
}

export function getFfprobeCommand() {
  return resolveBinaryCommand("ffprobe").command;
}

function formatAvailabilityError(
  resolution: ResolvedBinaryCommand,
  error: unknown
) {
  const attempted = formatCommandForError(resolution.command, ["-version"]);

  if (isSpawnPermissionError(error)) {
    return `child_process.spawn was blocked while executing '${attempted}'. This environment is preventing FFmpeg from starting.`;
  }

  if (isBinaryNotFoundError(error)) {
    return `${resolution.binary.toUpperCase()} was not found using '${resolution.command}'. Add it to PATH or set ${resolution.envVar}.`;
  }

  if (error instanceof Error && error.message.trim()) {
    return `${resolution.binary.toUpperCase()} failed while executing '${attempted}'. ${error.message.trim()}`;
  }

  return `${resolution.binary.toUpperCase()} failed while executing '${attempted}'.`;
}

export async function checkBinaryAvailable(
  binary: BinaryName
): Promise<BinaryAvailability> {
  const resolution = resolveBinaryCommand(binary);

  return new Promise((resolve) => {
    const child = spawn(resolution.command, ["-version"], {
      shell: false,
      windowsHide: true
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      resolve({
        ...resolution,
        available: false,
        blockedByEnvironment: isSpawnPermissionError(error),
        notFound: isBinaryNotFoundError(error),
        versionOutput: "",
        errorMessage: formatAvailabilityError(resolution, error)
      });
    });

    child.on("close", (code) => {
      resolve({
        ...resolution,
        available: code === 0,
        blockedByEnvironment: false,
        notFound: false,
        versionOutput: `${stdout}${stderr}`.trim(),
        errorMessage:
          code === 0
            ? null
            : `${resolution.binary.toUpperCase()} exited with code ${code ?? "unknown"} while executing '${formatCommandForError(
                resolution.command,
                ["-version"]
              )}'.`
      });
    });
  });
}

export async function checkFfmpegAvailable() {
  return checkBinaryAvailable("ffmpeg");
}

export async function checkFfprobeAvailable() {
  return checkBinaryAvailable("ffprobe");
}
