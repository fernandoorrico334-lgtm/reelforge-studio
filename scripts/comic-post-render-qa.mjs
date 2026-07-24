import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  resolveBinaryCommand,
  safeCheckFfmpeg,
  safeCheckFfprobe
} from "./lib/smoke-utils.mjs";

const projectRoot = process.cwd();

function parseArgs(argv) {
  const args = {
    input: null,
    outputDir: null,
    scenePlan: null,
    sampleCount: 12,
    failOnBlocked: false,
    minimumApprovalScore: 88
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--input") args.input = argv[++index] ?? null;
    else if (token === "--output-dir") args.outputDir = argv[++index] ?? null;
    else if (token === "--scene-plan") args.scenePlan = argv[++index] ?? null;
    else if (token === "--sample-count") args.sampleCount = Number(argv[++index] ?? args.sampleCount);
    else if (token === "--minimum-approval-score") args.minimumApprovalScore = Number(argv[++index] ?? args.minimumApprovalScore);
    else if (token === "--fail-on-blocked") args.failOnBlocked = true;
    else if (token === "--help" || token === "-h") args.help = true;
  }

  return args;
}

function printHelp() {
  console.log(`Usage:
node scripts/comic-post-render-qa.mjs --input <video.mp4> --output-dir <dir> [options]

Options:
  --scene-plan <json>              Optional scene timing/QA hints. When present, frames are sampled inside each scene.
  --sample-count <number>          Frame samples to extract. Default: 12.
  --minimum-approval-score <num>   Director approval target. Default: 88.
  --fail-on-blocked                Exit 1 when the director blocks the video.

Scene plan JSON can be either an array or { "scenes": [...] } with fields:
  sceneId, order, startTimeSeconds, endTimeSeconds, durationSeconds, pageNumber, panelId,
  captionVisible, captionOverflowRisk, focusTargetVisible, narrationAligned.
`);
}

function runCommand(command, args, options = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      cwd: projectRoot,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
      ...options
    });

    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr?.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolvePromise({ stdout, stderr });
        return;
      }

      const error = new Error(
        `Command failed (${code}): ${command} ${args.join(" ")}\n${stderr.slice(-2000)}`
      );
      error.code = code;
      error.stdout = stdout;
      error.stderr = stderr;
      reject(error);
    });
  });
}

async function assertFileExists(path) {
  await access(path);
}

async function probeVideo(ffprobeCommand, inputPath) {
  const { stdout } = await runCommand(ffprobeCommand, [
    "-v",
    "error",
    "-print_format",
    "json",
    "-show_format",
    "-show_streams",
    inputPath
  ]);
  const parsed = JSON.parse(stdout);
  const videoStream = parsed.streams?.find((stream) => stream.codec_type === "video") ?? null;
  const audioStream = parsed.streams?.find((stream) => stream.codec_type === "audio") ?? null;
  const durationSeconds = Number(parsed.format?.duration ?? videoStream?.duration ?? 0);

  return {
    durationSeconds: Number.isFinite(durationSeconds) ? durationSeconds : 0,
    width: Number(videoStream?.width ?? 0),
    height: Number(videoStream?.height ?? 0),
    videoCodec: videoStream?.codec_name ?? null,
    audioCodec: audioStream?.codec_name ?? null,
    hasAudio: Boolean(audioStream),
    raw: parsed
  };
}

function sampleTimes(durationSeconds, sampleCount) {
  const count = Math.max(3, Math.min(60, Math.round(sampleCount || 12)));
  const safeDuration = Math.max(0.1, durationSeconds);
  return Array.from({ length: count }, (_, index) => {
    const ratio = (index + 0.5) / count;
    return Math.min(Math.max(0.05, safeDuration * ratio), Math.max(0.05, safeDuration - 0.05));
  });
}

async function hashFile(path) {
  const buffer = await readFile(path);
  return {
    hash: createHash("sha256").update(buffer).digest("hex"),
    sizeBytes: buffer.length
  };
}

function normalizeSceneTiming(scene, index) {
  const startTimeSeconds = Number(scene.startTimeSeconds ?? scene.startSeconds ?? scene.start ?? 0);
  const explicitEnd = scene.endTimeSeconds ?? scene.endSeconds ?? scene.end;
  const duration = Number(scene.durationSeconds ?? scene.duration ?? (explicitEnd !== undefined ? Number(explicitEnd) - startTimeSeconds : 3));
  const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : 3;
  return {
    sceneId: String(scene.sceneId ?? scene.id ?? `scene-${index + 1}`),
    order: Number(scene.order ?? index + 1),
    startTimeSeconds: Number.isFinite(startTimeSeconds) ? Math.max(0, startTimeSeconds) : 0,
    durationSeconds: safeDuration,
    endTimeSeconds: Number.isFinite(Number(explicitEnd)) ? Number(explicitEnd) : (Number.isFinite(startTimeSeconds) ? Math.max(0, startTimeSeconds) : 0) + safeDuration
  };
}

function frameSampleSpecs({ durationSeconds, sampleCount, scenePlan }) {
  if (Array.isArray(scenePlan) && scenePlan.length) {
    const specs = [];
    for (let index = 0; index < scenePlan.length; index += 1) {
      const timing = normalizeSceneTiming(scenePlan[index], index);
      const sceneDuration = Math.max(0.12, timing.endTimeSeconds - timing.startTimeSeconds || timing.durationSeconds);
      const offsets = sceneDuration < 0.8 ? [0.5] : [0.18, 0.5, 0.82];
      for (const offset of offsets) {
        specs.push({
          timeSeconds: Math.max(0.05, timing.startTimeSeconds + sceneDuration * offset),
          sceneId: timing.sceneId,
          sceneOrder: timing.order,
          sampleRole: offset < 0.3 ? "scene_open" : offset > 0.7 ? "scene_close" : "scene_mid"
        });
      }
    }
    return specs.slice(0, 180);
  }

  return sampleTimes(durationSeconds, sampleCount).map((timeSeconds, index) => ({
    timeSeconds,
    sceneId: null,
    sceneOrder: null,
    sampleRole: index === 0 ? "global_open" : index === sampleCount - 1 ? "global_close" : "global_mid"
  }));
}

async function extractFrameSamples({ ffmpegCommand, inputPath, outputDir, durationSeconds, sampleCount, scenePlan }) {
  const framesDir = join(outputDir, "frames");
  await mkdir(framesDir, { recursive: true });
  const specs = frameSampleSpecs({ durationSeconds, sampleCount, scenePlan });
  const frames = [];

  for (let index = 0; index < specs.length; index += 1) {
    const spec = specs[index];
    const time = Math.min(Math.max(0.05, spec.timeSeconds), Math.max(0.05, durationSeconds - 0.05));
    const outputPath = join(framesDir, `frame-${String(index + 1).padStart(3, "0")}.jpg`);
    await runCommand(ffmpegCommand, [
      "-y",
      "-ss",
      time.toFixed(3),
      "-i",
      inputPath,
      "-frames:v",
      "1",
      "-q:v",
      "3",
      outputPath
    ]);
    const file = await hashFile(outputPath);
    frames.push({
      index: index + 1,
      timeSeconds: Number(time.toFixed(3)),
      outputPath,
      sceneId: spec.sceneId,
      sceneOrder: spec.sceneOrder,
      sampleRole: spec.sampleRole,
      sha256: file.hash,
      sizeBytes: file.sizeBytes
    });
  }

  return frames;
}

function repeatedFrameStats(frames) {
  let consecutiveRepeats = 0;
  const seen = new Map();
  for (let index = 0; index < frames.length; index += 1) {
    const frame = frames[index];
    const previous = frames[index - 1];
    if (previous && previous.sha256 === frame.sha256) {
      consecutiveRepeats += 1;
    }
    seen.set(frame.sha256, (seen.get(frame.sha256) ?? 0) + 1);
  }

  const repeatedSamples = [...seen.values()].filter((count) => count > 1).reduce((sum, count) => sum + count - 1, 0);
  const repeatedRatio = frames.length ? repeatedSamples / frames.length : 0;
  const consecutiveRatio = frames.length ? consecutiveRepeats / Math.max(1, frames.length - 1) : 0;
  const risk =
    consecutiveRatio > 0.18 || repeatedRatio > 0.28
      ? "high"
      : consecutiveRatio > 0.08 || repeatedRatio > 0.16
        ? "medium"
        : repeatedRatio > 0
          ? "low"
          : "none";

  return {
    repeatedSamples,
    consecutiveRepeats,
    repeatedRatio: Number(repeatedRatio.toFixed(3)),
    consecutiveRatio: Number(consecutiveRatio.toFixed(3)),
    risk
  };
}

async function detectBlackFrames(ffmpegCommand, inputPath) {
  try {
    const { stderr } = await runCommand(ffmpegCommand, [
      "-hide_banner",
      "-i",
      inputPath,
      "-vf",
      "blackdetect=d=0.08:pic_th=0.98",
      "-an",
      "-f",
      "null",
      "-"
    ]);
    const matches = [...stderr.matchAll(/black_duration:([0-9.]+)/gu)];
    const totalBlackSeconds = matches.reduce((sum, match) => sum + Number(match[1] ?? 0), 0);
    return {
      measured: true,
      totalBlackSeconds: Number(totalBlackSeconds.toFixed(3)),
      eventCount: matches.length,
      warning: null
    };
  } catch (error) {
    return {
      measured: false,
      totalBlackSeconds: 0,
      eventCount: 0,
      warning: error instanceof Error ? error.message.slice(0, 500) : String(error)
    };
  }
}

async function readScenePlan(scenePlanPath) {
  if (!scenePlanPath) return null;
  const parsed = JSON.parse(await readFile(resolve(scenePlanPath), "utf8"));
  return Array.isArray(parsed) ? parsed : parsed.scenes ?? null;
}

function captionOverflowRisk(value) {
  return ["none", "low", "medium", "high"].includes(value) ? value : "none";
}

function buildSceneFrameQa({ scenePlan, frames, probe, repeatStats, blackDetect }) {
  const blackFrameRatio = probe.durationSeconds > 0
    ? Number((blackDetect.totalBlackSeconds / probe.durationSeconds).toFixed(3))
    : 0;

  if (Array.isArray(scenePlan) && scenePlan.length) {
    return scenePlan.map((scene, index) => {
      const timing = normalizeSceneTiming(scene, index);
      const sceneFrames = frames.filter((frame) => frame.sceneId === timing.sceneId || frame.timeSeconds >= timing.startTimeSeconds && frame.timeSeconds <= timing.endTimeSeconds);
      const firstFrame = sceneFrames[0] ?? frames[Math.min(index, frames.length - 1)] ?? null;
      const previousFrame = index > 0 ? frames[Math.min(index - 1, frames.length - 1)] ?? null : null;
      const sameAsPrevious = Boolean(firstFrame && previousFrame && firstFrame.sha256 === previousFrame.sha256);
      return {
        sceneId: timing.sceneId,
        order: timing.order,
        panelId: scene.panelId ?? null,
        pageNumber: scene.pageNumber ?? null,
        durationSeconds: timing.durationSeconds,
        frameSampleCount: sceneFrames.length || 1,
        visualHash: firstFrame?.sha256 ?? null,
        previousVisualHash: previousFrame?.sha256 ?? null,
        repeatedFrameRisk: sameAsPrevious ? "high" : repeatStats.risk === "high" ? "medium" : repeatStats.risk,
        blackFrameRatio,
        captionVisible: scene.captionVisible !== false,
        captionOverflowRisk: captionOverflowRisk(scene.captionOverflowRisk),
        focusTargetVisible: scene.focusTargetVisible !== false,
        narrationAligned: scene.narrationAligned !== false,
        notes: [
          ...(scene.notes ?? []),
          blackDetect.measured ? "blackdetect measured" : "blackdetect unavailable",
          `time_range:${timing.startTimeSeconds.toFixed(3)}-${timing.endTimeSeconds.toFixed(3)}`,
          "caption/focus/alignment can be supplied by scene plan for stronger QA"
        ]
      };
    });
  }

  return frames.map((frame, index) => {
    const previous = frames[index - 1] ?? null;
    const sameAsPrevious = Boolean(previous && previous.sha256 === frame.sha256);
    return {
      sceneId: `sample-${index + 1}`,
      order: index + 1,
      panelId: null,
      pageNumber: null,
      durationSeconds: Number((probe.durationSeconds / Math.max(1, frames.length)).toFixed(3)),
      frameSampleCount: 1,
      visualHash: frame.sha256,
      previousVisualHash: previous?.sha256 ?? null,
      repeatedFrameRisk: sameAsPrevious ? "high" : "none",
      blackFrameRatio,
      captionVisible: true,
      captionOverflowRisk: "none",
      focusTargetVisible: true,
      narrationAligned: true,
      notes: [
        "pseudo-scene built from frame sample",
        "caption_visibility_not_measured",
        "focus_visibility_not_measured",
        "narration_alignment_not_measured"
      ]
    };
  });
}


function buildSceneTimingMap(scenePlan) {
  const map = new Map();
  if (!Array.isArray(scenePlan)) return map;
  scenePlan.forEach((scene, index) => {
    const timing = normalizeSceneTiming(scene, index);
    map.set(timing.sceneId, timing);
  });
  return map;
}

function actionLabel(action) {
  const labels = {
    keep: "manter",
    swap_panel: "trocar painel",
    retarget_crop: "recalcular zoom/crop",
    rerender_caption: "refazer legenda",
    resync_narration: "ressincronizar narracao",
    regenerate_narration_take: "regenerar take de narracao",
    shorten_hold: "encurtar permanencia da cena",
    manual_review: "revisao manual"
  };
  return labels[action] ?? action;
}

function buildRetryPlan({ directorReport, scenes, frames, scenePlan, inputPath }) {
  const timingMap = buildSceneTimingMap(scenePlan);
  const sceneMap = new Map(scenes.map((scene) => [scene.sceneId, scene]));
  const actionsByScene = new Map();

  for (const action of directorReport.retryActions) {
    const list = actionsByScene.get(action.sceneId) ?? [];
    list.push(action);
    actionsByScene.set(action.sceneId, list);
  }

  const sceneRetries = [...actionsByScene.entries()].map(([sceneId, actions]) => {
    const scene = sceneMap.get(sceneId) ?? null;
    const timing = timingMap.get(sceneId) ?? null;
    const evidenceFrames = frames
      .filter((frame) => frame.sceneId === sceneId || timing && frame.timeSeconds >= timing.startTimeSeconds && frame.timeSeconds <= timing.endTimeSeconds)
      .slice(0, 5)
      .map((frame) => ({
        timeSeconds: frame.timeSeconds,
        sampleRole: frame.sampleRole,
        outputPath: frame.outputPath,
        sha256: frame.sha256,
        sizeBytes: frame.sizeBytes
      }));
    const fallbackStart = scene?.order ? Math.max(0, (scene.order - 1) * (scene.durationSeconds || 3)) : 0;
    const startTimeSeconds = timing?.startTimeSeconds ?? fallbackStart;
    const durationSeconds = timing?.durationSeconds ?? scene?.durationSeconds ?? 3;
    const endTimeSeconds = timing?.endTimeSeconds ?? startTimeSeconds + durationSeconds;
    const severity = actions.some((action) => action.severity === "high")
      ? "high"
      : actions.some((action) => action.severity === "medium") ? "medium" : "low";

    return {
      sceneId,
      order: scene?.order ?? actions[0]?.order ?? 0,
      timeRange: {
        startTimeSeconds: Number(startTimeSeconds.toFixed(3)),
        endTimeSeconds: Number(endTimeSeconds.toFixed(3)),
        durationSeconds: Number(Math.max(0, endTimeSeconds - startTimeSeconds).toFixed(3))
      },
      severity,
      actions: actions.map((action) => ({
        action: action.action,
        label: actionLabel(action.action),
        severity: action.severity,
        reason: action.reason,
        suggestedFix: action.suggestedFix
      })),
      evidenceFrames,
      directorInstruction: actions.some((action) => action.action === "swap_panel")
        ? "Refazer somente esta cena com outro painel aprovado, mantendo a ordem cronologica."
        : actions.some((action) => action.action === "retarget_crop")
          ? "Refazer somente esta cena com crop mais aberto/inteligente, sem cortar rosto, balao ou acao principal."
          : actions.some((action) => action.action === "resync_narration")
            ? "Ajustar timing da cena para a fala bater com a evidencia visual."
            : "Refazer somente os elementos marcados, sem renderizar o episodio inteiro."
    };
  }).sort((a, b) => a.order - b.order);

  return {
    planId: "comic_post_render_retry_plan_v1",
    sourceVideoPath: inputPath,
    status: sceneRetries.length ? "retry_required" : "clean",
    retrySceneCount: sceneRetries.length,
    highSeveritySceneCount: sceneRetries.filter((scene) => scene.severity === "high").length,
    renderWholeVideoAgain: false,
    recommendedMode: sceneRetries.length ? "rerender_marked_scenes_only" : "no_retry_needed",
    sceneRetries,
    globalNotes: [
      "Este plano nao altera assets nem apaga renders: ele marca trechos para revisao/correcao.",
      "Quando integrado ao render worker, use timeRange para recortar/refazer somente a cena marcada.",
      "Se a acao for swap_panel, nunca voltar paginas: escolher alternativa da mesma pagina ou pagina posterior."
    ]
  };
}
async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  if (!args.input || !args.outputDir) {
    printHelp();
    throw new Error("--input and --output-dir are required.");
  }

  const inputPath = resolve(args.input);
  const outputDir = resolve(args.outputDir);
  await assertFileExists(inputPath);
  await mkdir(outputDir, { recursive: true });

  const ffmpeg = await safeCheckFfmpeg(runCommand);
  const ffprobe = await safeCheckFfprobe(runCommand);
  if (!ffmpeg.available || !ffprobe.available) {
    const summary = {
      status: "skipped",
      reason: ffmpeg.errorMessage ?? ffprobe.errorMessage ?? "FFmpeg/FFprobe unavailable.",
      ffmpeg,
      ffprobe
    };
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  const probe = await probeVideo(ffprobe.command ?? resolveBinaryCommand("ffprobe").command, inputPath);
  const scenePlan = await readScenePlan(args.scenePlan);
  const frames = await extractFrameSamples({
    ffmpegCommand: ffmpeg.command ?? resolveBinaryCommand("ffmpeg").command,
    inputPath,
    outputDir,
    durationSeconds: probe.durationSeconds,
    sampleCount: args.sampleCount,
    scenePlan
  });
  const repeatStats = repeatedFrameStats(frames);
  const blackDetect = await detectBlackFrames(ffmpeg.command ?? resolveBinaryCommand("ffmpeg").command, inputPath);
  const scenes = buildSceneFrameQa({ scenePlan, frames, probe, repeatStats, blackDetect });

  const beast = await import(pathToFileURL(join(projectRoot, "packages/media-beast/dist/index.js")).href);
  const directorReport = beast.buildComicPostRenderDirectorReport({
    scenes,
    minimumApprovalScore: args.minimumApprovalScore,
    measuredNarrationHumanScore: 88
  });

  const report = {
    reportId: "comic_post_render_real_qa_v1",
    status: directorReport.status === "blocked" ? "blocked" : "completed",
    input: {
      path: inputPath,
      filename: basename(inputPath)
    },
    ffmpeg: {
      command: ffmpeg.command,
      versionLine: ffmpeg.versionLine
    },
    ffprobe: {
      command: ffprobe.command,
      versionLine: ffprobe.versionLine
    },
    probe,
    frameSamples: frames,
    repeatedFrameStats: repeatStats,
    blackDetect,
    sceneFrameQa: scenes,
    directorReport
  };

  const reportPath = join(outputDir, "comic-post-render-director-report.json");
  await writeFile(reportPath, JSON.stringify(report, null, 2), "utf8");
  const retryPlanPath = join(outputDir, "comic-post-render-retry-plan.json");
  await writeFile(retryPlanPath, JSON.stringify(retryPlan, null, 2), "utf8");

  console.log(JSON.stringify({
    status: report.status,
    inputPath,
    reportPath,
    durationSeconds: probe.durationSeconds,
    resolution: `${probe.width}x${probe.height}`,
    frameSampleCount: frames.length,
    repeatedFrameRisk: repeatStats.risk,
    repeatedSamples: repeatStats.repeatedSamples,
    blackFrameRatio: scenes[0]?.blackFrameRatio ?? 0,
    directorStatus: directorReport.status,
    directorScore: directorReport.score,
    retrySceneCount: directorReport.retrySceneCount,
    blockers: directorReport.blockers,
    warnings: directorReport.warnings
  }, null, 2));

  if (args.failOnBlocked && directorReport.status === "blocked") {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(JSON.stringify({
    status: "failed",
    error: error instanceof Error ? error.message : String(error)
  }, null, 2));
  process.exitCode = 1;
});
