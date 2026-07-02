import { constants } from "node:fs";
import { access } from "node:fs/promises";
import {
  buildPremiumAudioMixPlan,
  type AudioDuckingMode,
  type AudioQualityReport,
  type PremiumAudioMixPlan
} from "@reelforge/audio-engine/mastering";
import type { RenderBlueprint } from "./index.js";
import { getFfmpegCommand, getFfprobeCommand } from "./ffmpeg-runtime.js";
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
  audioMasteringPresetId?: string | null;
}

export interface FinalizeRenderAudioResult {
  hasAudio: boolean;
  audioQualityReport: AudioQualityReport;
}

interface TimeWindow {
  start: number;
  end: number;
}

interface AudioFilterSupport {
  acompressor: boolean;
  alimiter: boolean;
  loudnorm: boolean;
  sidechaincompress: boolean;
  silenceremove: boolean;
}

function roundToThreeDecimals(value: number) {
  return Math.round(value * 1000) / 1000;
}

function clampPositive(value: number) {
  return Math.max(roundToThreeDecimals(value), 0);
}

function dbToLinear(db: number) {
  return Math.pow(10, db / 20);
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

function parseAvailableFilters(output: string): AudioFilterSupport {
  const support: AudioFilterSupport = {
    acompressor: false,
    alimiter: false,
    loudnorm: false,
    sidechaincompress: false,
    silenceremove: false
  };

  for (const line of output.split(/\r?\n/u)) {
    const match = line.match(/^[\s\.A-Z\|]+([a-z0-9_]+)\s+/iu);

    if (!match) {
      continue;
    }

    const filterName = match[1]?.toLowerCase();

    if (filterName === "acompressor") support.acompressor = true;
    if (filterName === "alimiter") support.alimiter = true;
    if (filterName === "loudnorm") support.loudnorm = true;
    if (filterName === "sidechaincompress") support.sidechaincompress = true;
    if (filterName === "silenceremove") support.silenceremove = true;
  }

  const normalizedOutput = output.toLowerCase();

  if (!support.acompressor && normalizedOutput.includes("acompressor")) {
    support.acompressor = true;
  }

  if (!support.alimiter && normalizedOutput.includes("alimiter")) {
    support.alimiter = true;
  }

  if (!support.loudnorm && normalizedOutput.includes("loudnorm")) {
    support.loudnorm = true;
  }

  if (
    !support.sidechaincompress &&
    normalizedOutput.includes("sidechaincompress")
  ) {
    support.sidechaincompress = true;
  }

  if (!support.silenceremove && normalizedOutput.includes("silenceremove")) {
    support.silenceremove = true;
  }

  return support;
}

async function loadAudioFilterSupport(
  options: Pick<FinalizeRenderAudioOptions, "jobRoot" | "logPath" | "context" | "logger">
) {
  try {
    const result = await options.logger.runCommand(
      getFfmpegCommand(),
      ["-hide_banner", "-filters"],
      options.jobRoot,
      options.logPath,
      withLabel(options.context, "audio-filters")
    );
    return parseAvailableFilters(`${result.stdout}\n${result.stderr}`);
  } catch {
    return {
      acompressor: false,
      alimiter: false,
      loudnorm: false,
      sidechaincompress: false,
      silenceremove: false
    } satisfies AudioFilterSupport;
  }
}

async function probeHasAudioStream(
  logger: AudioMixLogger,
  jobRoot: string,
  logPath: string,
  context: AudioMixLogContext,
  inputPath: string
) {
  try {
    const result = await logger.runCommand(
      getFfprobeCommand(),
      [
        "-v",
        "error",
        "-select_streams",
        "a:0",
        "-show_entries",
        "stream=codec_type",
        "-of",
        "default=nokey=1:noprint_wrappers=1",
        inputPath
      ],
      jobRoot,
      logPath,
      withLabel(context, "ffprobe-audio")
    );

    return /audio/iu.test(`${result.stdout}\n${result.stderr}`);
  } catch {
    return true;
  }
}

function buildNarrationTrimFilters(
  premiumPlan: PremiumAudioMixPlan,
  filterSupport: AudioFilterSupport
) {
  if (!premiumPlan.removeLongSilences || !filterSupport.silenceremove) {
    return [];
  }

  return [
    `silenceremove=start_periods=1:start_threshold=-45dB:stop_periods=-1:stop_duration=${(
      premiumPlan.maxSilenceMs / 1000
    ).toFixed(3)}:stop_threshold=-45dB`
  ];
}

function buildMasteringFilters(
  totalDuration: number,
  premiumPlan: PremiumAudioMixPlan,
  filterSupport: AudioFilterSupport
) {
  const filters: string[] = [];
  const appliedFilters: string[] = [];
  const warnings = [...premiumPlan.warnings];
  let duckingMode: AudioDuckingMode = premiumPlan.duckingMode;
  let compressorApplied = false;
  let limiterApplied = false;
  let loudnormApplied = false;

  if (premiumPlan.preset.compressorEnabled) {
    if (filterSupport.acompressor) {
      filters.push(
        `acompressor=threshold=${dbToLinear(
          premiumPlan.preset.compressorThresholdDb
        ).toFixed(3)}:ratio=${premiumPlan.preset.compressorRatio.toFixed(
          2
        )}:attack=${premiumPlan.preset.compressorAttackMs.toFixed(
          0
        )}:release=${premiumPlan.preset.compressorReleaseMs.toFixed(
          0
        )}:makeup=1`
      );
      appliedFilters.push("acompressor");
      compressorApplied = true;
    } else {
      warnings.push("FFmpeg acompressor indisponivel; compressor premium nao aplicado.");
    }
  }

  if (filterSupport.loudnorm) {
    filters.push(
      `loudnorm=I=${premiumPlan.targetLufs.toFixed(1)}:TP=${premiumPlan.truePeakDb.toFixed(
        1
      )}:LRA=11:linear=true:print_format=summary`
    );
    appliedFilters.push("loudnorm");
    loudnormApplied = true;
  } else {
    warnings.push("FFmpeg loudnorm indisponivel; mix final ficou no fallback simples.");
  }

  if (premiumPlan.preset.limiterEnabled) {
    if (filterSupport.alimiter) {
      filters.push(
        `alimiter=limit=${dbToLinear(premiumPlan.truePeakDb).toFixed(
          3
        )}:level=disabled`
      );
      appliedFilters.push("alimiter");
      limiterApplied = true;
    } else {
      warnings.push("FFmpeg alimiter indisponivel; limiter premium nao aplicado.");
    }
  }

  filters.push(
    ...buildFadeFilters(
      totalDuration,
      premiumPlan.preset.fadeInMs / 1000,
      premiumPlan.preset.fadeOutMs / 1000
    )
  );

  if (premiumPlan.preset.fadeInMs > 0 || premiumPlan.preset.fadeOutMs > 0) {
    appliedFilters.push("afade");
  }

  if (!premiumPlan.duckingEnabled) {
    duckingMode = "none";
  }

  return {
    filters,
    appliedFilters,
    warnings,
    duckingMode,
    compressorApplied,
    limiterApplied,
    loudnormApplied
  };
}

function buildBaseAudioQualityReport(
  options: {
    totalDuration: number;
    premiumPlan: PremiumAudioMixPlan;
    duckingMode: AudioDuckingMode;
    appliedFilters: string[];
    warnings: string[];
    compressorApplied: boolean;
    limiterApplied: boolean;
    loudnormApplied: boolean;
    silenceTrimmingApplied: boolean;
  }
): AudioQualityReport {
  const { premiumPlan } = options;

  return {
    masteringPresetId: premiumPlan.masteringPresetId,
    masteringPresetName: premiumPlan.preset.name,
    targetLufs: premiumPlan.targetLufs,
    truePeakDb: premiumPlan.truePeakDb,
    measuredInputDuration: options.totalDuration,
    measuredOutputDuration: options.totalDuration,
    narrationIncluded: premiumPlan.narrationIncluded,
    musicIncluded: premiumPlan.musicIncluded,
    sfxIncluded: premiumPlan.sfxIncluded,
    duckingEnabled: premiumPlan.duckingEnabled,
    duckingMode: options.duckingMode,
    compressorApplied: options.compressorApplied,
    limiterApplied: options.limiterApplied,
    loudnormApplied: options.loudnormApplied,
    silenceTrimmingApplied: options.silenceTrimmingApplied,
    narrationGainDb: premiumPlan.narrationGainDb,
    musicGainDb: premiumPlan.musicGainDb,
    sfxGainDb: premiumPlan.sfxGainDb,
    finalAudioCodec: "aac",
    finalAudioSampleRate: 48000,
    finalAudioBitrate: "192k",
    warnings: [...new Set(options.warnings)],
    appliedFilters: options.appliedFilters
  };
}

export async function muxSilentAudioTrack(
  options: FinalizeRenderAudioOptions,
  premiumPlan: PremiumAudioMixPlan
): Promise<FinalizeRenderAudioResult> {
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
      "-b:a",
      "192k",
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
    hasAudio: false,
    audioQualityReport: buildBaseAudioQualityReport({
      totalDuration,
      premiumPlan,
      duckingMode: "none",
      appliedFilters: ["anullsrc"],
      warnings: [
        ...premiumPlan.warnings,
        "Audio plan desabilitado; render final recebeu trilha silenciosa de compatibilidade."
      ],
      compressorApplied: false,
      limiterApplied: false,
      loudnormApplied: false,
      silenceTrimmingApplied: false
    })
  };
}

export async function finalizeRenderAudio(
  options: FinalizeRenderAudioOptions
): Promise<FinalizeRenderAudioResult> {
  const { blueprint, projectRoot, jobRoot, visualOutputPath, outputPath, totalDuration, logPath, context, logger } =
    options;
  const plan = blueprint.audio;
  const labelContext = withLabel(context, "audio");
  const filterSupport = await loadAudioFilterSupport(options);
  const premiumPlan = buildPremiumAudioMixPlan({
    audioPlan: plan,
    ...(options.audioMasteringPresetId !== undefined
      ? {
          audioMasteringPresetId: options.audioMasteringPresetId
        }
      : {}),
    preferSidechainDucking: true,
    loudnormSupported: filterSupport.loudnorm
  });
  const silenceTrimmingApplied =
    premiumPlan.removeLongSilences && filterSupport.silenceremove;

  await logger.appendLog(
    logPath,
    labelContext,
    `Audio enabled=${plan.enabled} | configured=${plan.hasConfiguredAudio} | mood=${plan.mood?.id ?? "none"} | preset=${premiumPlan.masteringPresetId} | summary=${plan.summary}`
  );

  if (!plan.enabled) {
    return muxSilentAudioTrack(options, premiumPlan);
  }

  const trackInputs: string[] = [];
  const filterChains: string[] = [];
  const mixLabels: string[] = [];
  const duckBusLabels: string[] = [];
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
  const duckingAmountLinear = Math.min(
    clampPositive(plan.duckingLevel),
    roundToThreeDecimals(dbToLinear(premiumPlan.preset.duckingAmountDb))
  );
  const narrationGainScalar = dbToLinear(premiumPlan.narrationGainDb);
  const musicGainScalar = dbToLinear(premiumPlan.musicGainDb);
  const sfxGainScalar = dbToLinear(premiumPlan.sfxGainDb);
  const canUseSidechainDucking =
    premiumPlan.duckingEnabled &&
    premiumPlan.duckingMode === "sidechain" &&
    filterSupport.sidechaincompress;
  let inputIndex = 1;
  let musicOutputLabel: string | null = null;
  let duckingMode: AudioDuckingMode = premiumPlan.duckingMode;

  if (premiumPlan.removeLongSilences && !filterSupport.silenceremove) {
    warnings.push(
      "FFmpeg silenceremove indisponivel; a narracao foi mantida sem limpeza de silencio."
    );
  }

  if (plan.backgroundMusic) {
    const musicPath = resolveStoragePath(projectRoot, plan.backgroundMusic.asset.path);

    if (!(await fileExists(musicPath))) {
      throw new Error(
        `Background music asset '${plan.backgroundMusic.asset.path}' is missing on disk.`
      );
    }

    let effectiveMusicVolume = plan.backgroundMusic.volume * musicGainScalar;

    if (premiumPlan.duckingEnabled && duckingMode !== "sidechain") {
      if (plan.voiceover) {
        effectiveMusicVolume *= duckingAmountLinear;
      }
    }

    const musicVolumeFilter =
      premiumPlan.duckingEnabled &&
      duckingMode !== "sidechain" &&
      !plan.voiceover &&
      duckingNarrationWindows.length > 0
        ? `volume=${buildDuckedVolumeExpression(
            effectiveMusicVolume,
            duckingAmountLinear,
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
    filterChains.push(`[${inputIndex}:a]${musicFilters.join(",")}[amusicraw]`);
    musicOutputLabel = "[amusicraw]";
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
      ...buildNarrationTrimFilters(premiumPlan, filterSupport),
      `volume=${buildMutedVolumeExpression(
        plan.voiceover.volume * narrationGainScalar,
        sceneNarrationWindows
      )}`
    ];
    filterChains.push(`[${inputIndex}:a]${voiceFilters.join(",")}[avoice]`);
    mixLabels.push("[avoice]");

    if (canUseSidechainDucking) {
      const duckVoiceFilters = [
        `atrim=0:${totalDuration.toFixed(3)}`,
        "asetpts=N/SR/TB",
        ...buildNarrationTrimFilters(premiumPlan, filterSupport),
        "volume=1.000"
      ];
      filterChains.push(
        `[${inputIndex}:a]${duckVoiceFilters.join(",")}[aduckvoice]`
      );
      duckBusLabels.push("[aduckvoice]");
    }

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
      ...buildNarrationTrimFilters(premiumPlan, filterSupport),
      `volume=${roundToThreeDecimals(
        sceneNarration.volume * narrationGainScalar
      ).toFixed(3)}`,
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

    if (canUseSidechainDucking) {
      const duckFilters = [
        `atrim=0:${clipDuration.toFixed(3)}`,
        "asetpts=N/SR/TB",
        ...buildNarrationTrimFilters(premiumPlan, filterSupport),
        "volume=1.000",
        `adelay=${delayMs}|${delayMs}`
      ];
      filterChains.push(
        `[${inputIndex}:a]${duckFilters.join(",")}[aducknarr${index}]`
      );
      duckBusLabels.push(`[aducknarr${index}]`);
    }

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
      `[${inputIndex}:a]atrim=0:${remainingDuration.toFixed(
        3
      )},asetpts=N/SR/TB,volume=${roundToThreeDecimals(
        sceneSfx.volume * sfxGainScalar
      ).toFixed(3)},adelay=${delayMs}|${delayMs}[${outputLabel}]`
    );
    mixLabels.push(`[${outputLabel}]`);
    inputIndex += 1;
  }

  for (const [index, clipAudio] of plan.sceneClipAudio.entries()) {
    const clipPath = resolveStoragePath(projectRoot, clipAudio.asset.path);

    if (!(await fileExists(clipPath))) {
      throw new Error(
        `Microclip audio asset '${clipAudio.asset.path}' is missing on disk for scene '${clipAudio.sceneTitle}'.`
      );
    }

    if (
      clipAudio.asset.type === "VIDEO" &&
      !(await probeHasAudioStream(
        logger,
        jobRoot,
        logPath,
        context,
        clipPath
      ))
    ) {
      warnings.push(
        `Microclip '${clipAudio.label}' has no detectable audio stream and was skipped in the final mix.`
      );
      continue;
    }

    const remainingDuration = Math.max(totalDuration - clipAudio.startTime, 0.05);
    const clipDuration = Math.max(
      Math.min(
        remainingDuration,
        clipAudio.duration,
        (clipAudio.asset.duration ?? clipAudio.duration) - clipAudio.sourceStartTime
      ),
      0.05
    );
    const delayMs = Math.max(Math.round(clipAudio.startTime * 1000), 0);
    const outputLabel = `amicro${index}`;

    trackInputs.push("-i", clipPath);
    filterChains.push(
      `[${inputIndex}:a]atrim=${clipAudio.sourceStartTime.toFixed(
        3
      )}:${(clipAudio.sourceStartTime + clipDuration).toFixed(
        3
      )},asetpts=N/SR/TB,volume=${roundToThreeDecimals(
        clipAudio.volume * sfxGainScalar
      ).toFixed(3)},adelay=${delayMs}|${delayMs}[${outputLabel}]`
    );
    mixLabels.push(`[${outputLabel}]`);
    inputIndex += 1;
  }

  if (mixLabels.length === 0 && !musicOutputLabel) {
    warnings.push("Audio plan was configured but no valid audio tracks were resolved.");
    await logger.appendLog(
      logPath,
      labelContext,
      warnings[warnings.length - 1] ?? "Audio track resolution warning."
    );
    return muxSilentAudioTrack(options, premiumPlan);
  }

  if (
    premiumPlan.duckingEnabled &&
    duckingMode === "sidechain" &&
    musicOutputLabel &&
    duckBusLabels.length > 0 &&
    canUseSidechainDucking
  ) {
    if (duckBusLabels.length === 1) {
      filterChains.push(
        `${duckBusLabels[0]}aresample=48000:async=1:first_pts=0[aduckbus]`
      );
    } else {
      filterChains.push(
        `${duckBusLabels.join("")}amix=inputs=${duckBusLabels.length}:duration=longest:dropout_transition=0,aresample=48000:async=1:first_pts=0[aduckbus]`
      );
    }

    const sidechainRatio = Math.min(
      Math.max(Math.abs(premiumPlan.preset.duckingAmountDb) / 2 + 2, 2),
      12
    );
    filterChains.push(
      `${musicOutputLabel}[aduckbus]sidechaincompress=threshold=0.025:ratio=${sidechainRatio.toFixed(
        2
      )}:attack=${premiumPlan.preset.duckingAttackMs.toFixed(
        0
      )}:release=${premiumPlan.preset.duckingReleaseMs.toFixed(0)}[amusic]`
    );
    musicOutputLabel = "[amusic]";
  } else if (
    premiumPlan.duckingEnabled &&
    duckingMode === "sidechain" &&
    musicOutputLabel
  ) {
    duckingMode = premiumPlan.musicIncluded && premiumPlan.narrationIncluded
      ? "global_reduction"
      : "none";
    warnings.push(
      "FFmpeg sidechaincompress indisponivel; ducking caiu para global_reduction."
    );
    filterChains.push(`${musicOutputLabel}anull[amusic]`);
    musicOutputLabel = "[amusic]";
  }

  if (musicOutputLabel) {
    if (musicOutputLabel === "[amusicraw]") {
      filterChains.push(`${musicOutputLabel}anull[amusic]`);
      musicOutputLabel = "[amusic]";
    }

    mixLabels.unshift(musicOutputLabel);
  }

  const outputAudioLabel = "[aout]";

  if (mixLabels.length === 1) {
    filterChains.push(
      `${mixLabels[0]}aresample=48000:async=1:first_pts=0,atrim=0:${totalDuration.toFixed(
        3
      )}[amixbase]`
    );
  } else {
    filterChains.push(
      `${mixLabels.join("")}amix=inputs=${mixLabels.length}:duration=longest:dropout_transition=0,aresample=48000:async=1:first_pts=0,atrim=0:${totalDuration.toFixed(
        3
      )}[amixbase]`
    );
  }

  const mastering = buildMasteringFilters(totalDuration, premiumPlan, filterSupport);
  filterChains.push(
    `[amixbase]${mastering.filters.join(",")}${outputAudioLabel}`
  );

  await logger.appendLog(
    logPath,
    labelContext,
    `Background music asset: ${plan.backgroundMusic?.asset.path ?? "none"} | voiceover asset: ${plan.voiceover?.asset.path ?? "none"} | scene narrations: ${plan.sceneNarrations.length} | scene SFX count: ${plan.sceneSfx.length} | microclip audio count: ${plan.sceneClipAudio.length} | preset=${premiumPlan.masteringPresetId} | ducking=${duckingMode}`
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
      "-b:a",
      "192k",
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
    hasAudio: true,
    audioQualityReport: buildBaseAudioQualityReport({
      totalDuration,
      premiumPlan,
      duckingMode,
      appliedFilters: mastering.appliedFilters,
      warnings: [...warnings, ...mastering.warnings],
      compressorApplied: mastering.compressorApplied,
      limiterApplied: mastering.limiterApplied,
      loudnormApplied: mastering.loudnormApplied,
      silenceTrimmingApplied
    })
  };
}
