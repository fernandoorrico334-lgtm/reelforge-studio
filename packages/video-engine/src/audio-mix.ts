import { constants } from "node:fs";
import { access } from "node:fs/promises";
import type { RenderBlueprint } from "./index.js";
import { getFfmpegCommand } from "./ffmpeg-runtime.js";
import { resolveStoragePath } from "./render-paths.js";

interface AudioMixLogContext {
  jobId: string;
  projectId: string;
  label?: string;
}

interface AudioMixLogger {
  appendLog: (
    logPath: string,
    context: AudioMixLogContext,
    message: string
  ) => Promise<void>;
  runCommand: (
    command: string,
    args: string[],
    cwd: string,
    logPath: string,
    context: AudioMixLogContext
  ) => Promise<{ stdout: string; stderr: string }>;
}

export interface FinalizeRenderAudioOptions {
  blueprint: RenderBlueprint;
  projectRoot: string;
  jobRoot: string;
  visualOutputPath: string;
  outputPath: string;
  totalDuration: number;
  logPath: string;
  context: AudioMixLogContext;
  logger: AudioMixLogger;
}

interface TimeWindow {
  start: number;
  end: number;
}

function roundToThreeDecimals(value: number) {
  return Math.round(value * 1000) / 1000;
}

function clampPositive(value: number) {
  return Math.max(roundToThreeDecimals(value), 0);
}

async function fileExists(absolutePath: string) {
  try {
    await access(absolutePath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function withLabel(context: AudioMixLogContext, label: string): AudioMixLogContext {
  return {
    ...context,
    label
  };
}

function mergeTimeWindows(windows: TimeWindow[]) {
  if (windows.length === 0) {
    return [];
  }

  const normalized = windows
    .map((window) => ({
      start: clampPositive(window.start),
      end: clampPositive(window.end)
    }))
    .filter((window) => window.end > window.start)
    .sort((left, right) => left.start - right.start);

  if (normalized.length === 0) {
    return [];
  }

  const merged: TimeWindow[] = [normalized[0] as TimeWindow];

  for (const window of normalized.slice(1)) {
    const current = merged[merged.length - 1];

    if (!current) {
      merged.push(window);
      continue;
    }

    if (window.start <= current.end + 0.02) {
      current.end = Math.max(current.end, window.end);
      continue;
    }

    merged.push(window);
  }

  return merged.map((window) => ({
    start: roundToThreeDecimals(window.start),
    end: roundToThreeDecimals(window.end)
  }));
}

function buildWindowConditionExpression(windows: TimeWindow[]) {
  const merged = mergeTimeWindows(windows);

  if (merged.length === 0) {
    return "0";
  }

  return merged
    .map(
      (window) =>
        `between(t,${window.start.toFixed(3)},${window.end.toFixed(3)})`
    )
    .join("+");
}

function buildMutedVolumeExpression(baseVolume: number, windows: TimeWindow[]) {
  const condition = buildWindowConditionExpression(windows);

  if (condition === "0") {
    return roundToThreeDecimals(baseVolume).toFixed(3);
  }

  return `'if(${condition},0,1)*${roundToThreeDecimals(baseVolume).toFixed(3)}'`;
}

function buildDuckedVolumeExpression(
  baseVolume: number,
  duckingLevel: number,
  windows: TimeWindow[]
) {
  const condition = buildWindowConditionExpression(windows);

  if (condition === "0") {
    return roundToThreeDecimals(baseVolume).toFixed(3);
  }

  return `'${roundToThreeDecimals(baseVolume).toFixed(3)}*if(${condition},${roundToThreeDecimals(
    duckingLevel
  ).toFixed(3)},1)'`;
}

export async function muxSilentAudioTrack(
  options: FinalizeRenderAudioOptions
) {
  const { logger, visualOutputPath, outputPath, totalDuration, jobRoot, logPath, context } =
    options;

  await logger.appendLog(
    logPath,
    withLabel(context, "audio"),
    "Audio disabled. Preserving silent AAC fallback for compatibility."
  );

  await logger.runCommand(
    getFfmpegCommand(),
    [
      "-y",
      "-i",
      visualOutputPath,
      "-f",
      "lavfi",
      "-t",
      totalDuration.toFixed(3),
      "-i",
      "anullsrc=channel_layout=stereo:sample_rate=48000",
      "-map",
      "0:v:0",
      "-map",
      "1:a:0",
      "-c:v",
      "copy",
      "-c:a",
      "aac",
      "-ar",
      "48000",
      "-ac",
      "2",
      "-movflags",
      "+faststart",
      "-shortest",
      outputPath
    ],
    jobRoot,
    logPath,
    withLabel(context, "audio")
  );

  return {
    hasAudio: false
  };
}

function buildFadeFilters(totalDuration: number, fadeIn: number, fadeOut: number) {
  const filters: string[] = [];

  if (fadeIn > 0) {
    filters.push(`afade=t=in:st=0:d=${clampPositive(fadeIn).toFixed(3)}`);
  }

  if (fadeOut > 0) {
    const fadeStart = Math.max(totalDuration - fadeOut, 0);
    filters.push(
      `afade=t=out:st=${clampPositive(fadeStart).toFixed(3)}:d=${clampPositive(
        fadeOut
      ).toFixed(3)}`
    );
  }

  return filters;
}

export async function finalizeRenderAudio(
  options: FinalizeRenderAudioOptions
) {
  const { blueprint, projectRoot, jobRoot, visualOutputPath, outputPath, totalDuration, logPath, context, logger } =
    options;
  const plan = blueprint.audio;
  const labelContext = withLabel(context, "audio");

  await logger.appendLog(
    logPath,
    labelContext,
    `Audio enabled=${plan.enabled} | configured=${plan.hasConfiguredAudio} | mood=${plan.mood?.id ?? "none"} | summary=${plan.summary}`
  );

  if (!plan.enabled) {
    return muxSilentAudioTrack(options);
  }

  const trackInputs: string[] = [];
  const filterChains: string[] = [];
  const mixLabels: string[] = [];
  const warnings = [...plan.warnings];
  const sceneNarrationWindows = plan.sceneNarrations.map((sceneNarration) => ({
    start: sceneNarration.startTime,
    end:
      sceneNarration.startTime +
      Math.min(
        sceneNarration.duration,
        sceneNarration.asset.duration ?? sceneNarration.duration
      )
  }));
  const duckingNarrationWindows = plan.sceneNarrations
    .filter((sceneNarration) => sceneNarration.duckMusicDuringNarration)
    .map((sceneNarration) => ({
      start: sceneNarration.startTime,
      end:
        sceneNarration.startTime +
        Math.min(
          sceneNarration.duration,
          sceneNarration.asset.duration ?? sceneNarration.duration
        )
    }));
  let inputIndex = 1;

  if (plan.backgroundMusic) {
    const musicPath = resolveStoragePath(projectRoot, plan.backgroundMusic.asset.path);

    if (!(await fileExists(musicPath))) {
      throw new Error(
        `Background music asset '${plan.backgroundMusic.asset.path}' is missing on disk.`
      );
    }

    const effectiveMusicVolume =
      plan.enableAudioDucking && plan.voiceover
        ? roundToThreeDecimals(plan.backgroundMusic.volume * plan.duckingLevel)
        : plan.backgroundMusic.volume;
    const musicVolumeFilter =
      plan.enableAudioDucking &&
      !plan.voiceover &&
      duckingNarrationWindows.length > 0
        ? `volume=${buildDuckedVolumeExpression(
            effectiveMusicVolume,
            plan.duckingLevel,
            duckingNarrationWindows
          )}`
        : `volume=${roundToThreeDecimals(effectiveMusicVolume).toFixed(3)}`;
    const musicFilters = [
      `atrim=0:${totalDuration.toFixed(3)}`,
      "asetpts=N/SR/TB",
      musicVolumeFilter,
      ...buildFadeFilters(
        totalDuration,
        plan.backgroundMusic.fadeInDuration,
        plan.backgroundMusic.fadeOutDuration
      )
    ];

    trackInputs.push("-stream_loop", "-1", "-i", musicPath);
    filterChains.push(`[${inputIndex}:a]${musicFilters.join(",")}[amusic]`);
    mixLabels.push("[amusic]");
    inputIndex += 1;
  }

  if (plan.voiceover) {
    const voicePath = resolveStoragePath(projectRoot, plan.voiceover.asset.path);

    if (!(await fileExists(voicePath))) {
      throw new Error(
        `Voiceover asset '${plan.voiceover.asset.path}' is missing on disk.`
      );
    }

    trackInputs.push("-i", voicePath);
    const voiceFilters = [
      `atrim=0:${totalDuration.toFixed(3)}`,
      "asetpts=N/SR/TB",
      `volume=${buildMutedVolumeExpression(plan.voiceover.volume, sceneNarrationWindows)}`
    ];
    filterChains.push(
      `[${inputIndex}:a]${voiceFilters.join(",")}[avoice]`
    );
    mixLabels.push("[avoice]");
    inputIndex += 1;
  }

  for (const [index, sceneNarration] of plan.sceneNarrations.entries()) {
    const narrationPath = resolveStoragePath(projectRoot, sceneNarration.asset.path);

    if (!(await fileExists(narrationPath))) {
      throw new Error(
        `Scene narration asset '${sceneNarration.asset.path}' is missing on disk for scene '${sceneNarration.sceneTitle}'.`
      );
    }

    const remainingDuration = Math.max(totalDuration - sceneNarration.startTime, 0.05);
    const clipDuration = Math.max(
      Math.min(
        remainingDuration,
        sceneNarration.duration,
        sceneNarration.asset.duration ?? sceneNarration.duration
      ),
      0.05
    );
    const delayMs = Math.max(Math.round(sceneNarration.startTime * 1000), 0);
    const outputLabel = `anarr${index}`;
    const narrationFilters = [
      `atrim=0:${clipDuration.toFixed(3)}`,
      "asetpts=N/SR/TB",
      `volume=${roundToThreeDecimals(sceneNarration.volume).toFixed(3)}`,
      ...buildFadeFilters(
        clipDuration,
        sceneNarration.fadeInDuration,
        sceneNarration.fadeOutDuration
      ),
      `adelay=${delayMs}|${delayMs}`
    ];

    trackInputs.push("-i", narrationPath);
    filterChains.push(`[${inputIndex}:a]${narrationFilters.join(",")}[${outputLabel}]`);
    mixLabels.push(`[${outputLabel}]`);
    inputIndex += 1;
  }

  for (const [index, sceneSfx] of plan.sceneSfx.entries()) {
    const sfxPath = resolveStoragePath(projectRoot, sceneSfx.asset.path);

    if (!(await fileExists(sfxPath))) {
      throw new Error(
        `Scene SFX asset '${sceneSfx.asset.path}' is missing on disk for scene '${sceneSfx.sceneTitle}'.`
      );
    }

    const remainingDuration = Math.max(totalDuration - sceneSfx.startTime, 0.05);
    const delayMs = Math.max(Math.round(sceneSfx.startTime * 1000), 0);
    const outputLabel = `asfx${index}`;

    trackInputs.push("-i", sfxPath);
    filterChains.push(
      `[${inputIndex}:a]atrim=0:${remainingDuration.toFixed(3)},asetpts=N/SR/TB,volume=${roundToThreeDecimals(
        sceneSfx.volume
      ).toFixed(3)},adelay=${delayMs}|${delayMs}[${outputLabel}]`
    );
    mixLabels.push(`[${outputLabel}]`);
    inputIndex += 1;
  }

  if (mixLabels.length === 0) {
    warnings.push("Audio plan was configured but no valid audio tracks were resolved.");
    await logger.appendLog(
      logPath,
      labelContext,
      warnings[warnings.length - 1] ?? "Audio track resolution warning."
    );
    return muxSilentAudioTrack(options);
  }

  const outputAudioLabel = "[aout]";

  if (mixLabels.length === 1) {
    filterChains.push(
      `${mixLabels[0]}aresample=48000:async=1:first_pts=0,atrim=0:${totalDuration.toFixed(
        3
      )}${outputAudioLabel}`
    );
  } else {
    filterChains.push(
      `${mixLabels.join("")}amix=inputs=${mixLabels.length}:duration=longest:dropout_transition=0,aresample=48000:async=1:first_pts=0,atrim=0:${totalDuration.toFixed(
        3
      )}${outputAudioLabel}`
    );
  }

  await logger.appendLog(
    logPath,
    labelContext,
    `Background music asset: ${plan.backgroundMusic?.asset.path ?? "none"} | voiceover asset: ${plan.voiceover?.asset.path ?? "none"} | scene narrations: ${plan.sceneNarrations.length} | scene SFX count: ${plan.sceneSfx.length} | ducking=${plan.enableAudioDucking ? `${plan.duckingLevel}` : "off"}`
  );

  await logger.runCommand(
    getFfmpegCommand(),
    [
      "-y",
      "-i",
      visualOutputPath,
      ...trackInputs,
      "-filter_complex",
      filterChains.join(";"),
      "-map",
      "0:v:0",
      "-map",
      outputAudioLabel,
      "-c:v",
      "copy",
      "-c:a",
      "aac",
      "-ar",
      "48000",
      "-ac",
      "2",
      "-movflags",
      "+faststart",
      "-shortest",
      outputPath
    ],
    jobRoot,
    logPath,
    labelContext
  );

  return {
    hasAudio: true
  };
}
