import { spawn } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { stat } from "node:fs/promises";
import {
  ensureDir,
  printSmokeSummary,
  resolveBinaryCommand,
  safeCheckFfmpeg,
  safeCheckFfprobe
} from "./lib/smoke-utils.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");
const outputRoot = join(projectRoot, "storage", "renders", "diagnostics", "comic-golden-runtime-qa");
const outputPath = join(outputRoot, "golden-runtime-qa.mp4");

async function importMediaBeast() {
  return import(pathToFileURL(join(projectRoot, "packages/media-beast/dist/index.js")).href);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function formatCommand(command, args) {
  return [command, ...args].join(" ");
}

function runCommand(command, args, cwd = projectRoot) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, { cwd, shell: false, windowsHide: true });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
    child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
    child.on("error", (error) => rejectPromise(Object.assign(error, { command, args, stdout, stderr })));
    child.on("close", (code) => {
      if (code === 0) resolvePromise({ stdout, stderr });
      else rejectPromise(Object.assign(new Error(`Command failed with code ${code}: ${formatCommand(command, args)}\n${stderr.slice(-1200)}`), { command, args, stdout, stderr, code }));
    });
  });
}

function makePanel(buildMockPanel, id, pageNumber, role, actionLabel) {
  return buildMockPanel({
    panelId: id,
    pageNumber,
    panelNumber: pageNumber,
    readingOrder: pageNumber,
    sourcePagePath: join(projectRoot, "tmp", `runtime-page-${pageNumber}.jpg`),
    panelImagePath: join(projectRoot, "tmp", `runtime-panel-${id}.jpg`),
    panelImageSha256: `${id}-sha256`.padEnd(64, "r"),
    sequenceId: "runtime-golden-seq",
    storyFunction: role,
    parentContext: {
      comicTitle: "Runtime QA Test Comic",
      issueTitle: "Issue 1",
      pageTitle: `Page ${pageNumber}`,
      parentTags: ["comic", "authorized", "runtime"],
      parentEntities: ["Batman", "Godzilla", "Kong"]
    },
    localEvidence: {
      characters: [
        { name: "Batman", confidence: 0.94, evidenceSource: "visual" },
        { name: "Godzilla", confidence: 0.92, evidenceSource: "visual" },
        { name: "Kong", confidence: 0.9, evidenceSource: "visual" }
      ],
      actions: [{ label: actionLabel, confidence: 0.94 }],
      relationships: [{ type: "conflict", entities: ["Batman", "Godzilla"], confidence: 0.92 }],
      detectedText: [role === "climax" ? "BOOM IMPACT" : "WHOOSH"],
      dialogue: [role === "climax" ? "Agora acabou" : "Ele chegou rapido demais"],
      narrationBoxes: ["A cidade inteira sentiu o impacto"],
      soundEffects: role === "climax" ? ["BOOM", "CRASH"] : ["WHOOSH"],
      visualThemes: ["impact", "monster", "battle", "comics_source"],
      objects: [],
      locations: [{ label: "destroyed city", confidence: 0.82 }]
    },
    quality: { visualQualityScore: 94, cropability916Score: 95, textHeavyRatio: 0.05 },
    confidence: {
      segmentation: 0.94,
      characters: 0.93,
      actions: 0.94,
      relationships: 0.92,
      text: 0.84,
      overall: 0.93
    }
  });
}

async function buildPlanQa(beast) {
  const {
    buildMockPanel,
    mineComicStoryVault,
    buildComicShortsBatchFactoryPlan,
    applyComicPremiumDirector,
    directComicSfxBeatPlan,
    scoreComicRenderReadiness,
    buildComicGoldenRenderQaReport
  } = beast;

  const specs = [
    ["runtime-1", 1, "setup", "monster arrival panic"],
    ["runtime-2", 2, "action", "hero rushes into monster fight"],
    ["runtime-3", 3, "action", "Kong impact debris"],
    ["runtime-4", 4, "climax", "Godzilla blast impact explosion"],
    ["runtime-5", 5, "reaction", "heroes shocked final reveal"]
  ];
  const panels = specs.map(([id, page, role, action]) => makePanel(buildMockPanel, id, page, role, action));
  const pages = panels.map((panel) => ({
    sourceAssetId: `runtime-page-${panel.pageNumber}`,
    sourcePagePath: panel.sourcePagePath,
    sourceContentHash: `runtime-hash-${panel.pageNumber}`,
    pageNumber: panel.pageNumber,
    pageType: "story",
    indexable: true,
    parentContext: panel.parentContext,
    panels: [panel]
  }));

  const minerReport = mineComicStoryVault({
    index: {
      version: 3,
      assetDirectory: join(projectRoot, "storage", "assets", "comics", "runtime-test"),
      generatedAt: new Date().toISOString(),
      sourcePageCount: pages.length,
      panelCount: panels.length,
      validPanelCount: panels.length,
      rejectedPanelCount: 0,
      sequenceCount: 1,
      pages
    },
    maxOpportunities: 5,
    minScore: 50
  });
  const batch = buildComicShortsBatchFactoryPlan({ minerReport, targetCount: 1, minScore: 60 });
  const baseShort = batch.shorts[0];
  assert(baseShort, "expected runtime QA short");
  const directed = applyComicPremiumDirector({ short: baseShort });
  const sfxBeatDirector = directComicSfxBeatPlan({ short: directed.short, premiumDirector: directed.report });
  const renderQualityScore = scoreComicRenderReadiness({ short: directed.short, premiumDirector: directed.report, sfxBeatDirector });
  const planQa = buildComicGoldenRenderQaReport({ short: directed.short, premiumDirector: directed.report, sfxBeatDirector, renderQualityScore });
  return { short: directed.short, planQa };
}

async function createRuntimeMp4(durationSeconds) {
  await ensureDir(outputRoot);
  const ffmpegCommand = resolveBinaryCommand("ffmpeg").command;
  const args = [
    "-y",
    "-f", "lavfi",
    "-i", `color=c=#111827:s=1080x1920:d=${durationSeconds}`,
    "-f", "lavfi",
    "-i", `sine=frequency=220:duration=${durationSeconds}:sample_rate=48000`,
    "-shortest",
    "-c:v", "libx264",
    "-pix_fmt", "yuv420p",
    "-c:a", "aac",
    "-b:a", "128k",
    "-movflags", "+faststart",
    outputPath
  ];
  await runCommand(ffmpegCommand, args, outputRoot);
  return { command: formatCommand(ffmpegCommand, args), outputPath };
}

async function probeArtifact(filePath) {
  const ffprobeCommand = resolveBinaryCommand("ffprobe").command;
  const { stdout } = await runCommand(ffprobeCommand, [
    "-v", "error",
    "-print_format", "json",
    "-show_format",
    "-show_streams",
    filePath
  ]);
  const parsed = JSON.parse(stdout);
  const videoStream = Array.isArray(parsed.streams) ? parsed.streams.find((entry) => entry.codec_type === "video") : null;
  const audioStream = Array.isArray(parsed.streams) ? parsed.streams.find((entry) => entry.codec_type === "audio") : null;
  const durationValue = Number(parsed.format?.duration ?? videoStream?.duration ?? 0);
  const stats = await stat(filePath);
  return {
    outputPath: filePath,
    exists: true,
    width: Number(videoStream?.width ?? 0) || null,
    height: Number(videoStream?.height ?? 0) || null,
    durationSeconds: Number.isFinite(durationValue) ? Number(durationValue.toFixed(3)) : null,
    videoCodec: typeof videoStream?.codec_name === "string" ? videoStream.codec_name : null,
    audioCodec: typeof audioStream?.codec_name === "string" ? audioStream.codec_name : null,
    outputBytes: stats.size
  };
}

async function main() {
  const ffmpegCheck = await safeCheckFfmpeg(runCommand);
  const ffprobeCheck = await safeCheckFfprobe(runCommand);
  const beast = await importMediaBeast();
  const { buildComicGoldenRuntimeQaReport } = beast;
  const { short, planQa } = await buildPlanQa(beast);

  if (!ffmpegCheck.available || !ffprobeCheck.available) {
    printSmokeSummary({
      status: "skipped",
      smoke: "comic-golden-runtime-qa",
      reason: "FFmpeg/FFprobe unavailable or blocked in this environment.",
      ffmpeg: ffmpegCheck,
      ffprobe: ffprobeCheck,
      planQa: { verdict: planQa.releaseVerdict, score: planQa.overallScore, durationSeconds: planQa.measured.durationSeconds }
    });
    return;
  }

  const render = await createRuntimeMp4(Math.max(31, short.estimatedDurationSeconds));
  const artifact = await probeArtifact(render.outputPath);
  const runtimeQa = buildComicGoldenRuntimeQaReport({ planQa, artifact });

  assert(runtimeQa.runtimeQaId === "comic_golden_runtime_render_qa_v1", "expected runtime QA id");
  assert(runtimeQa.checks.artifactExists, "expected artifact exists");
  assert(runtimeQa.checks.vertical1080x1920, "expected 1080x1920 vertical artifact");
  assert(runtimeQa.checks.durationAtLeast30s, "expected runtime duration >= 30s");
  assert(runtimeQa.checks.audioPresent, "expected audio stream");
  assert(runtimeQa.verdict === "publish_review_ready" || runtimeQa.verdict === "render_passed", `unexpected runtime verdict ${runtimeQa.verdict}`);

  printSmokeSummary({
    status: "completed",
    smoke: "comic-golden-runtime-qa",
    shortId: short.id,
    planVerdict: planQa.releaseVerdict,
    runtimeVerdict: runtimeQa.verdict,
    overallScore: runtimeQa.overallScore,
    outputPath: artifact.outputPath,
    outputBytes: artifact.outputBytes,
    artifact: {
      width: artifact.width,
      height: artifact.height,
      durationSeconds: artifact.durationSeconds,
      videoCodec: artifact.videoCodec,
      audioCodec: artifact.audioCodec
    },
    checks: runtimeQa.checks,
    warnings: runtimeQa.warnings,
    blockers: runtimeQa.blockers,
    command: render.command
  });
}

main().catch((error) => {
  printSmokeSummary({
    status: "failed",
    smoke: "comic-golden-runtime-qa",
    reason: error instanceof Error ? error.message : String(error)
  });
  process.exitCode = 1;
});
