import { spawn } from "node:child_process";
import type {
  BeatMarker,
  EnergyTimelinePoint,
  MusicAssetProfile,
  MusicEnergy
} from "./music-library.js";

export interface AudioAnalysisInput {
  assetPath: string;
  durationSeconds?: number | null;
}

export interface AudioAnalysisResult {
  durationSeconds: number | null;
  bpm: number | null;
  bpmConfidence: number;
  energy: MusicEnergy;
  loudness: number | null;
  beatMarkers: BeatMarker[];
  energyTimeline: EnergyTimelinePoint[];
  warnings: string[];
}

interface CommandResult {
  stdout: Buffer;
  stderr: string;
}

function roundToThreeDecimals(value: number) {
  return Math.round(value * 1000) / 1000;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function resolveBinary(envName: "FFMPEG_PATH" | "FFPROBE_PATH", fallback: string) {
  const fromEnv = process.env[envName]?.trim();
  return fromEnv && fromEnv.length > 0 ? fromEnv : fallback;
}

function runCommand(command: string, args: string[]) {
  return new Promise<CommandResult>((resolve, reject) => {
    const child = spawn(command, args, {
      windowsHide: true,
      shell: false
    });

    const stdoutChunks: Buffer[] = [];
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdoutChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      reject(
        new Error(
          `Failed to spawn '${command}'. ${error.message}`
        )
      );
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve({
          stdout: Buffer.concat(stdoutChunks),
          stderr
        });
        return;
      }

      reject(
        new Error(
          `Command '${command} ${args.join(" ")}' failed with code ${code ?? "unknown"}. ${stderr.trim()}`
        )
      );
    });
  });
}

async function probeDurationSeconds(assetPath: string) {
  const ffprobeCommand = resolveBinary("FFPROBE_PATH", "ffprobe");
  const { stdout } = await runCommand(ffprobeCommand, [
    "-v",
    "error",
    "-print_format",
    "json",
    "-show_format",
    "-show_streams",
    assetPath
  ]);
  const parsed = JSON.parse(stdout.toString("utf8")) as {
    format?: { duration?: string };
    streams?: Array<{ duration?: string }>;
  };
  const durationCandidates = [
    Number(parsed.format?.duration ?? 0),
    ...(parsed.streams ?? []).map((stream) => Number(stream.duration ?? 0))
  ].filter((value) => Number.isFinite(value) && value > 0);

  return durationCandidates.length > 0
    ? roundToThreeDecimals(Math.max(...durationCandidates))
    : null;
}

async function detectLoudness(assetPath: string) {
  const ffmpegCommand = resolveBinary("FFMPEG_PATH", "ffmpeg");
  const { stderr } = await runCommand(ffmpegCommand, [
    "-hide_banner",
    "-i",
    assetPath,
    "-af",
    "volumedetect",
    "-f",
    "null",
    "-"
  ]);
  const match = stderr.match(/mean_volume:\s*(-?\d+(?:\.\d+)?)\s*dB/iu);
  return match ? roundToThreeDecimals(Number(match[1])) : null;
}

async function extractPcmBuffer(assetPath: string) {
  const ffmpegCommand = resolveBinary("FFMPEG_PATH", "ffmpeg");
  const { stdout } = await runCommand(ffmpegCommand, [
    "-hide_banner",
    "-loglevel",
    "error",
    "-i",
    assetPath,
    "-ac",
    "1",
    "-ar",
    "200",
    "-f",
    "s16le",
    "-"
  ]);
  return stdout;
}

function normalizeEnergyLabel(averageEnergy: number): MusicEnergy {
  if (averageEnergy < 0.16) {
    return "low";
  }

  if (averageEnergy < 0.34) {
    return "medium";
  }

  if (averageEnergy < 0.58) {
    return "high";
  }

  return "extreme";
}

function analyzePcmSamples(
  buffer: Buffer,
  durationSeconds: number
): Pick<AudioAnalysisResult, "bpm" | "bpmConfidence" | "energy" | "beatMarkers" | "energyTimeline"> {
  const sampleCount = Math.floor(buffer.length / 2);

  if (sampleCount === 0 || durationSeconds <= 0) {
    return {
      bpm: null,
      bpmConfidence: 0,
      energy: "medium",
      beatMarkers: [],
      energyTimeline: []
    };
  }

  const amplitudes = new Array<number>(sampleCount);
  let maxAmplitude = 1;
  let sum = 0;

  for (let index = 0; index < sampleCount; index += 1) {
    const sample = buffer.readInt16LE(index * 2);
    const amplitude = Math.abs(sample) / 32768;
    amplitudes[index] = amplitude;
    maxAmplitude = Math.max(maxAmplitude, amplitude);
    sum += amplitude;
  }

  const normalized = amplitudes.map((value) => value / maxAmplitude);
  const mean = sum / sampleCount;
  const variance =
    normalized.reduce((total, value) => total + (value - mean) ** 2, 0) / sampleCount;
  const standardDeviation = Math.sqrt(variance);
  const threshold = clamp(mean + standardDeviation * 1.2, 0.1, 0.92);
  const samplesPerSecond = sampleCount / durationSeconds;
  const minimumPeakGapSamples = Math.max(Math.round(samplesPerSecond * 0.18), 4);
  const peaks: number[] = [];

  for (let index = 2; index < normalized.length - 2; index += 1) {
    const current = normalized[index] ?? 0;

    if (current < threshold) {
      continue;
    }

    if (
      current >= (normalized[index - 1] ?? 0) &&
      current >= (normalized[index + 1] ?? 0) &&
      current >= (normalized[index - 2] ?? 0) &&
      current >= (normalized[index + 2] ?? 0)
    ) {
      const lastPeak = peaks[peaks.length - 1];
      if (typeof lastPeak === "number" && index - lastPeak < minimumPeakGapSamples) {
        continue;
      }

      peaks.push(index);
    }
  }

  const peakIntervals = peaks
    .slice(1)
    .map((peak, index) => (peak - (peaks[index] ?? peak)) / samplesPerSecond)
    .filter((interval) => interval >= 0.24 && interval <= 1.2);
  const averageInterval =
    peakIntervals.length > 0
      ? peakIntervals.reduce((total, value) => total + value, 0) / peakIntervals.length
      : null;
  const bpm =
    averageInterval && averageInterval > 0
      ? roundToThreeDecimals(clamp(60 / averageInterval, 60, 190))
      : null;
  const intervalVariance =
    peakIntervals.length > 1 && averageInterval
      ? peakIntervals.reduce(
          (total, value) => total + (value - averageInterval) ** 2,
          0
        ) / peakIntervals.length
      : 0.4;
  const bpmConfidence = averageInterval
    ? roundToThreeDecimals(
        clamp(
          0.28 +
            Math.min(peakIntervals.length / Math.max(durationSeconds * 1.8, 1), 0.42) +
            Math.max(0.22 - intervalVariance, 0),
          0,
          0.95
        )
      )
    : 0;

  const beatMarkers: BeatMarker[] = peaks.map((peakIndex) => {
    const peakAmplitude = normalized[peakIndex] ?? 0.2;
    return {
      timeSeconds: roundToThreeDecimals(peakIndex / samplesPerSecond),
      strength: roundToThreeDecimals(clamp(peakAmplitude, 0.1, 1)),
      confidence: bpmConfidence
    };
  });

  const energyTimeline: EnergyTimelinePoint[] = [];
  const windowSize = Math.max(Math.round(samplesPerSecond), 1);

  for (let cursor = 0; cursor < normalized.length; cursor += windowSize) {
    const slice = normalized.slice(cursor, cursor + windowSize);
    const averageEnergy =
      slice.reduce((total, value) => total + value, 0) / Math.max(slice.length, 1);
    energyTimeline.push({
      timeSeconds: roundToThreeDecimals(cursor / samplesPerSecond),
      energy: roundToThreeDecimals(clamp(averageEnergy, 0, 1))
    });
  }

  const averageEnergy =
    energyTimeline.reduce((total, point) => total + point.energy, 0) /
    Math.max(energyTimeline.length, 1);

  return {
    bpm,
    bpmConfidence,
    energy: normalizeEnergyLabel(averageEnergy),
    beatMarkers,
    energyTimeline
  };
}

export async function detectApproxBpm(assetPath: string) {
  const durationSeconds = await probeDurationSeconds(assetPath);
  if (!durationSeconds) {
    return {
      bpm: null,
      bpmConfidence: 0
    };
  }

  const pcmBuffer = await extractPcmBuffer(assetPath);
  const analysis = analyzePcmSamples(pcmBuffer, durationSeconds);

  return {
    bpm: analysis.bpm,
    bpmConfidence: analysis.bpmConfidence
  };
}

export async function detectBeatMarkers(assetPath: string) {
  const durationSeconds = await probeDurationSeconds(assetPath);
  if (!durationSeconds) {
    return [];
  }

  const pcmBuffer = await extractPcmBuffer(assetPath);
  return analyzePcmSamples(pcmBuffer, durationSeconds).beatMarkers;
}

export async function detectEnergyTimeline(assetPath: string) {
  const durationSeconds = await probeDurationSeconds(assetPath);
  if (!durationSeconds) {
    return [];
  }

  const pcmBuffer = await extractPcmBuffer(assetPath);
  return analyzePcmSamples(pcmBuffer, durationSeconds).energyTimeline;
}

export async function analyzeAudioAsset(
  input: AudioAnalysisInput
): Promise<AudioAnalysisResult> {
  const warnings: string[] = [];
  const durationSeconds =
    (await probeDurationSeconds(input.assetPath)) ?? input.durationSeconds ?? null;

  if (!durationSeconds) {
    warnings.push("Nao foi possivel detectar a duracao do audio.");
    return {
      durationSeconds: null,
      bpm: null,
      bpmConfidence: 0,
      energy: "medium",
      loudness: null,
      beatMarkers: [],
      energyTimeline: [],
      warnings
    };
  }

  const pcmBuffer = await extractPcmBuffer(input.assetPath);
  const sampleAnalysis = analyzePcmSamples(pcmBuffer, durationSeconds);
  const loudness = await detectLoudness(input.assetPath).catch(() => null);

  if (sampleAnalysis.bpmConfidence < 0.4) {
    warnings.push("BPM estimado com baixa confianca; use como referencia aproximada.");
  }

  if (sampleAnalysis.beatMarkers.length === 0) {
    warnings.push("Nao houve deteccao confiavel de picos; o beat sync pode usar grid fallback.");
  }

  return {
    durationSeconds,
    bpm: sampleAnalysis.bpm,
    bpmConfidence: sampleAnalysis.bpmConfidence,
    energy: sampleAnalysis.energy,
    loudness,
    beatMarkers: sampleAnalysis.beatMarkers,
    energyTimeline: sampleAnalysis.energyTimeline,
    warnings
  };
}

export function summarizeMusicAnalysis(
  profile: Pick<
    MusicAssetProfile,
    "title" | "bpm" | "bpmConfidence" | "energy" | "loudness" | "licenseStatus"
  >
) {
  return [
    profile.title,
    typeof profile.bpm === "number" ? `${Math.round(profile.bpm)} BPM` : "BPM n/a",
    `confidence ${Math.round(profile.bpmConfidence * 100)}%`,
    `energy ${profile.energy}`,
    typeof profile.loudness === "number" ? `${profile.loudness} dB` : "loudness n/a",
    `license ${profile.licenseStatus}`
  ].join(", ");
}
