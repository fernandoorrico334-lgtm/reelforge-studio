import { constants } from "node:fs";
import { access, mkdir, readdir, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { join, resolve } from "node:path";
import { getMusicPresetById } from "@reelforge/audio-engine";
import {
  generateMockNarrationWav,
  generateWindowsSapiNarrationWav
} from "@reelforge/narration-engine";
import type { PremiumAudioScorePlan } from "./audio-score-planner.js";
import type { VideoRemixPlan } from "./video-remixer.js";

export type RemixAudioMixPlan = {
  musicPath: string | null;
  musicPresetId: string | null;
  musicVolume: number;
  narrationPath: string | null;
  narrationProvider: string | null;
  sfxCues: Array<{ timeSeconds: number; category: string; assetPath: string | null }>;
  duckingLevel: number;
  voiceVolume: number;
  sfxVolume: number;
  totalDurationSec: number;
  warnings: string[];
};

async function fileExists(path: string) {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function collectWavFiles(directory: string): Promise<string[]> {
  if (!(await fileExists(directory))) return [];
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectWavFiles(fullPath)));
      continue;
    }
    if (/\.(wav|mp3|m4a|aac)$/i.test(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
}

export async function resolveLocalMusicBed(
  projectRoot: string,
  musicPresetId: string | null
): Promise<string | null> {
  const preset = getMusicPresetById(musicPresetId);
  const searchRoots = [
    join(projectRoot, "storage", "assets", "track", "music"),
    join(projectRoot, "storage", "assets", "smoke", "premium-audio-render"),
    join(projectRoot, "storage", "assets", "smoke", "music-library"),
    join(projectRoot, "storage", "assets", "smoke", "music-render-plan"),
    join(projectRoot, "storage", "assets", "smoke", "music")
  ];

  const candidates: string[] = [];
  for (const root of searchRoots) {
    candidates.push(...(await collectWavFiles(root)));
  }

  if (candidates.length === 0) return null;

  const ranked = candidates
    .map((path) => {
      const lower = path.toLowerCase();
      let score = 0;
      if (lower.includes("hype") || lower.includes("phonk") || lower.includes("fast")) score += 3;
      if (lower.includes("viral")) score += 4;
      if (lower.includes("stadium")) score += 2;
      if (lower.includes("bed") || lower.includes("track") || lower.includes("music")) score += 1;
      if (preset?.id === "viral_fast_cut" && /hype|phonk|fast|viral/.test(lower)) score += 3;
      return { path, score };
    })
    .sort((left, right) => right.score - left.score);

  return ranked[0]?.path ?? candidates[0] ?? null;
}

export async function resolveLocalSfxAsset(
  projectRoot: string,
  category: string
): Promise<string | null> {
  const sfxDir = join(projectRoot, "storage", "assets", "effect", "sfx");
  const files = await collectWavFiles(sfxDir);
  if (files.length === 0) return null;

  const normalized = category.toLowerCase();
  const match =
    files.find((file) => file.toLowerCase().includes(normalized)) ??
    files.find((file) => /impact|hit|whoosh|flash/.test(file.toLowerCase())) ??
    files[0];

  return match ?? null;
}

export async function prepareRemixNarrationAudio(input: {
  plan: VideoRemixPlan;
  workDir: string;
  totalDurationSec: number;
}): Promise<{ path: string | null; provider: string | null; warnings: string[] }> {
  const warnings: string[] = [];
  const script =
    input.plan.narrationPlan?.suggestedScript?.trim() ??
    input.plan.narrationPlan?.narrationBeats?.map((beat) => beat.text).join(" ").trim() ??
    "";

  if (!script) {
    warnings.push("narration_script_missing");
    return { path: null, provider: null, warnings };
  }

  await mkdir(input.workDir, { recursive: true });
  const outputPath = join(input.workDir, "remix-narration.wav");

  const voicePackId =
    input.plan.narrationPlan?.voicePackHint?.trim() ||
    input.plan.narrationPlan?.voiceVariations?.[0]?.voicePackId ||
    "documentary_ptbr";

  try {
    if (process.platform === "win32") {
      await generateWindowsSapiNarrationWav({
        text: script,
        voicePackId,
        language: "pt-BR",
        outputAbsolutePath: outputPath
      });
      return { path: outputPath, provider: "windows-sapi-local", warnings };
    }
  } catch (error) {
    warnings.push(
      `windows_sapi_failed:${error instanceof Error ? error.message : "unknown"}`
    );
  }

  const generated = generateMockNarrationWav({
    text: script,
    voicePackId,
    language: "pt-BR",
    provider: "mock-tts"
  });
  await writeFile(outputPath, generated.wavBuffer);
  return { path: outputPath, provider: "mock-tts", warnings };
}

export async function buildRemixAudioMixPlan(input: {
  plan: VideoRemixPlan;
  projectRoot: string;
  totalDurationSec: number;
  workDir: string;
}): Promise<RemixAudioMixPlan> {
  const warnings: string[] = [];
  const musicPlan = input.plan.musicPlan;
  const musicPresetId = musicPlan?.musicPresetId ?? null;
  const musicPath = await resolveLocalMusicBed(input.projectRoot, musicPresetId);

  if (!musicPath) {
    warnings.push("music_bed_not_found_local");
  }

  const narration = await prepareRemixNarrationAudio({
    plan: input.plan,
    workDir: input.workDir,
    totalDurationSec: input.totalDurationSec
  });
  warnings.push(...narration.warnings);

  const sfxCuePlan = musicPlan?.sfxCuePlan ?? [];
  const sfxCues: RemixAudioMixPlan["sfxCues"] = [];

  for (const cue of sfxCuePlan.slice(0, 12)) {
    const assetPath = await resolveLocalSfxAsset(input.projectRoot, cue.category);
    sfxCues.push({
      timeSeconds: cue.timeSeconds,
      category: cue.category,
      assetPath
    });
    if (!assetPath) {
      warnings.push(`sfx_missing:${cue.category}@${cue.timeSeconds}s`);
    }
  }

  return {
    musicPath,
    musicPresetId,
    musicVolume: musicPlan?.musicVolume ?? 0.2,
    narrationPath: narration.path,
    narrationProvider: narration.provider,
    sfxCues,
    duckingLevel: musicPlan?.duckingLevel ?? 0.28,
    voiceVolume: musicPlan?.voiceVolume ?? 1,
    sfxVolume: musicPlan?.sfxVolume ?? 0.7,
    totalDurationSec: input.totalDurationSec,
    warnings
  };
}

function runFfmpeg(command: string, args: string[], verbose = false): Promise<void> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      shell: false,
      stdio: verbose ? "inherit" : ["ignore", "ignore", "pipe"]
    });
    let stderr = "";
    child.stderr?.on("data", (chunk) => {
      const next = stderr + String(chunk);
      stderr = next.length > 4000 ? next.slice(-4000) : next;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolvePromise();
      else {
        reject(
          new Error(
            `${command} exited with code ${code}${stderr ? `: ${stderr.slice(-800)}` : ""}`
          )
        );
      }
    });
  });
}

export async function mixAudioIntoRemixVideo(input: {
  videoPath: string;
  outputPath: string;
  audioPlan: RemixAudioMixPlan;
  ffmpegCommand?: string;
  verbose?: boolean;
  publishQuality?: boolean;
}): Promise<{ outputPath: string; hasAudio: boolean }> {
  const ffmpeg = input.ffmpegCommand ?? "ffmpeg";
  const duration = input.audioPlan.totalDurationSec;
  const hasMusic = Boolean(input.audioPlan.musicPath && (await fileExists(input.audioPlan.musicPath)));
  const hasNarration = Boolean(
    input.audioPlan.narrationPath && (await fileExists(input.audioPlan.narrationPath))
  );
  const sfxInputs = input.audioPlan.sfxCues.filter(
    (cue) => cue.assetPath && cue.timeSeconds < duration
  );

  if (!hasMusic && !hasNarration && sfxInputs.length === 0) {
    return { outputPath: input.videoPath, hasAudio: false };
  }

  const args = ["-y", "-hide_banner", "-loglevel", "error", "-i", input.videoPath];
  const filterParts: string[] = [];
  let inputIndex = 1;
  const mixLabels: string[] = [];

  const resamplePrefix =
    input.publishQuality === true ? "aresample=48000,aformat=channel_layouts=stereo," : "";

  if (hasMusic && input.audioPlan.musicPath) {
    args.push("-i", input.audioPlan.musicPath);
    const musicLabel = `[music${inputIndex}]`;
    filterParts.push(
      `[${inputIndex}:a]${resamplePrefix}aloop=loop=-1:size=2e+09,atrim=0:${duration.toFixed(3)},volume=${input.audioPlan.musicVolume.toFixed(3)}${musicLabel}`
    );
    mixLabels.push(musicLabel);
    inputIndex += 1;
  }

  if (hasNarration && input.audioPlan.narrationPath) {
    args.push("-i", input.audioPlan.narrationPath);
    const narrLabel = `[narr${inputIndex}]`;
    filterParts.push(
      `[${inputIndex}:a]${resamplePrefix}apad=whole_dur=${duration.toFixed(3)},volume=${input.audioPlan.voiceVolume.toFixed(3)}${narrLabel}`
    );
    mixLabels.push(narrLabel);
    inputIndex += 1;
  }

  for (const cue of sfxInputs.slice(0, 8)) {
    if (!cue.assetPath) continue;
    args.push("-i", cue.assetPath);
    const delayMs = Math.max(0, Math.round(cue.timeSeconds * 1000));
    const sfxLabel = `[sfx${inputIndex}]`;
    filterParts.push(
      `[${inputIndex}:a]adelay=${delayMs}|${delayMs},atrim=0:0.45,volume=${input.audioPlan.sfxVolume.toFixed(3)}${sfxLabel}`
    );
    mixLabels.push(sfxLabel);
    inputIndex += 1;
  }

  if (mixLabels.length === 0) {
    return { outputPath: input.videoPath, hasAudio: false };
  }

  const mixedLabel = "[amixed]";
  const outputLabel = input.publishQuality === true ? "[aout]" : mixedLabel;
  const mixChain = `${mixLabels.join("")}amix=inputs=${mixLabels.length}:duration=first:dropout_transition=0`;
  if (input.publishQuality === true) {
    filterParts.push(
      `${mixChain},acompressor=threshold=-18dB:ratio=3:attack=20:release=250,loudnorm=I=-15:TP=-1.5:LRA=11:print_format=summary,alimiter=limit=0.89${outputLabel}`
    );
  } else {
    filterParts.push(`${mixChain},alimiter=limit=0.95${outputLabel}`);
  }

  args.push(
    "-filter_complex",
    filterParts.join(";"),
    "-map",
    "0:v:0",
    "-map",
    outputLabel,
    "-c:v",
    "copy",
    "-c:a",
    "aac",
    "-b:a",
    input.publishQuality === true ? "256k" : "192k",
    "-ar",
    input.publishQuality === true ? "48000" : "44100",
    "-ac",
    input.publishQuality === true ? "2" : "2",
    "-movflags",
    "+faststart",
    "-shortest",
    input.outputPath
  );

  await runFfmpeg(ffmpeg, args, input.verbose === true);
  return { outputPath: resolve(input.outputPath), hasAudio: true };
}

export type { PremiumAudioScorePlan };