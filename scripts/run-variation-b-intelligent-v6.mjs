import { createHash } from "node:crypto";
import { access, constants, mkdir, readFile, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { compareIntelligentApprovedToRenderInput } from "./audit-variation-b-render-input-mismatch.mjs";
import { safeCheckFfmpeg } from "./lib/smoke-utils.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");

const BEAT_ROLES = [
  "hook",
  "context",
  "curiosity_a",
  "curiosity_b",
  "development_a",
  "development_b",
  "climax",
  "closing"
];

const LOCAL_INDEX_REPORT_PATH = join(projectRoot, "tmp", "variation-b-local-panel-index.json");
const ASSIGNMENTS_PATH = join(projectRoot, "tmp", "variation-b-beat-assignments-validation.json");
const MANIFEST_PATH = join(projectRoot, "tmp", "variation-b-v6-input-manifest.json");
const MATERIALIZATION_PATH = join(
  projectRoot,
  "tmp",
  "variation-b-intelligent-indexed-materialization.json"
);
const MP4_PATH = join(projectRoot, "tmp", "remix-renders", "variation-b-intelligent-v6.mp4");
const CONTACT_SHEET_PATH = join(projectRoot, "tmp", "variation-b-intelligent-v6-contact-sheet.jpg");
const REPORT_PATH = join(projectRoot, "tmp", "variation-b-intelligent-v6-report.json");
const WORK_DIR = join(projectRoot, "tmp", "remix-renders", "variation-b-intelligent-v6-work");

const CONTACT_SHEET_SECONDS = [0.5, 3, 6, 10, 13, 17, 20, 23, 27, 30, 34, 37, 39];

const EXPECTED = {
  uniquePanelCount: 7,
  maxPanelReuseCount: 2,
  continuityScore: 100,
  averageBeatSpecificFitScore: 87.88,
  canRender: true,
  canPublish: true,
  scoresByBeat: {
    hook: 80,
    climax: 80,
    context: 60,
    curiosity_a: 60,
    curiosity_b: 60,
    development_a: 60,
    development_b: 60
  },
  page4Panel1: {
    panelId: "user-remix-asset-bd624296f938:page4:panel1",
    cropAreaRatio: 0.8658376963350786,
    valid: false,
    rejectReason: "oversized_story_mixed_crop"
  }
};

async function importMediaBeast() {
  return import(
    pathToFileURL(join(projectRoot, "packages/media-beast/dist/index.js")).href
  );
}

async function fileExists(path) {
  try {
    await access(path, constants.F_OK | constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

async function sha256File(path) {
  const bytes = await readFile(path);
  return createHash("sha256").update(bytes).digest("hex");
}

function sha256Text(text) {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function probeCommand(command, args) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { shell: false });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr?.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolvePromise({ stdout, stderr });
      else reject(new Error(`${command} exited ${code}: ${stderr.slice(-500)}`));
    });
  });
}

async function probeMp4(path, ffprobe) {
  const { stdout: formatOut } = await probeCommand(ffprobe, [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "default=noprint_wrappers=1:nokey=1",
    path
  ]);
  const { stdout: videoOut } = await probeCommand(ffprobe, [
    "-v",
    "error",
    "-select_streams",
    "v:0",
    "-show_entries",
    "stream=width,height,codec_name",
    "-of",
    "json",
    path
  ]);
  const { stdout: audioOut } = await probeCommand(ffprobe, [
    "-v",
    "error",
    "-select_streams",
    "a:0",
    "-show_entries",
    "stream=codec_name,sample_rate,channels",
    "-of",
    "json",
    path
  ]);
  const video = JSON.parse(videoOut).streams?.[0] ?? {};
  const audio = JSON.parse(audioOut).streams?.[0] ?? {};
  return {
    durationSec: Number(formatOut.trim()),
    width: Number(video.width ?? 0),
    height: Number(video.height ?? 0),
    videoCodec: video.codec_name ?? null,
    audioCodec: audio.codec_name ?? null,
    sampleRateHz: Number(audio.sample_rate ?? 0),
    channels: Number(audio.channels ?? 0)
  };
}

async function extractFrame(mp4Path, sec, outputPath, ffmpeg) {
  await mkdir(dirname(outputPath), { recursive: true });
  await probeCommand(ffmpeg, [
    "-y",
    "-hide_banner",
    "-loglevel",
    "error",
    "-ss",
    sec.toFixed(3),
    "-i",
    mp4Path,
    "-frames:v",
    "1",
    "-q:v",
    "2",
    outputPath
  ]);
}

function buildPageTypeLookup(index) {
  const lookup = new Map();
  for (const page of index.pages) {
    for (const panel of page.panels) {
      lookup.set(panel.panelId, page.pageType);
    }
  }
  return lookup;
}

function validateAgainstExpected(validation) {
  const divergences = [];

  if (validation.uniquePanelCount !== EXPECTED.uniquePanelCount) {
    divergences.push(
      `uniquePanelCount:${validation.uniquePanelCount}!=${EXPECTED.uniquePanelCount}`
    );
  }
  if (validation.maxPanelReuseCount !== EXPECTED.maxPanelReuseCount) {
    divergences.push(
      `maxPanelReuseCount:${validation.maxPanelReuseCount}!=${EXPECTED.maxPanelReuseCount}`
    );
  }
  if (validation.continuityScore !== EXPECTED.continuityScore) {
    divergences.push(
      `continuityScore:${validation.continuityScore}!=${EXPECTED.continuityScore}`
    );
  }
  if (validation.averageBeatSpecificFitScore !== EXPECTED.averageBeatSpecificFitScore) {
    divergences.push(
      `averageBeatSpecificFitScore:${validation.averageBeatSpecificFitScore}!=${EXPECTED.averageBeatSpecificFitScore}`
    );
  }
  if (validation.canRender !== EXPECTED.canRender) {
    divergences.push(`canRender:${validation.canRender}!=${EXPECTED.canRender}`);
  }
  if (validation.canPublish !== EXPECTED.canPublish) {
    divergences.push(`canPublish:${validation.canPublish}!=${EXPECTED.canPublish}`);
  }

  const page4 = validation.page4Panel1Diagnostic;
  if (!page4) {
    divergences.push("page4Panel1Diagnostic:missing");
  } else {
    if (page4.valid !== EXPECTED.page4Panel1.valid) {
      divergences.push(`page4Panel1.valid:${page4.valid}!=${EXPECTED.page4Panel1.valid}`);
    }
    if (Math.abs(page4.cropAreaRatio - EXPECTED.page4Panel1.cropAreaRatio) > 0.001) {
      divergences.push(`page4Panel1.cropAreaRatio:${page4.cropAreaRatio}`);
    }
    if (page4.rejectReason !== EXPECTED.page4Panel1.rejectReason) {
      divergences.push(`page4Panel1.rejectReason:${page4.rejectReason}`);
    }
  }

  for (const beatRole of BEAT_ROLES) {
    const score = validation.scoresByBeat?.[beatRole];
    const min = EXPECTED.scoresByBeat[beatRole] ?? 60;
    if (score === undefined || score < min) {
      divergences.push(`scoresByBeat.${beatRole}:${score ?? "missing"}<${min}`);
    }
  }

  return divergences;
}

function runPreflightGates(input) {
  const failures = [];

  for (const beatRole of BEAT_ROLES) {
    const assignment = input.assignments.find((entry) => entry.beatRole === beatRole);
    if (!assignment?.panelId) {
      failures.push(`missing_panel:${beatRole}`);
    }
  }

  if (input.uniquePanelCount < 5) failures.push(`unique_panel_count:${input.uniquePanelCount}`);
  if (input.maxPanelReuseCount > 2) failures.push(`max_reuse:${input.maxPanelReuseCount}`);
  if (input.continuityScore < 60) failures.push(`continuity:${input.continuityScore}`);

  const devA = input.assignments.find((entry) => entry.beatRole === "development_a")?.panelId;
  const devB = input.assignments.find((entry) => entry.beatRole === "development_b")?.panelId;
  if (devA && devB && devA === devB) failures.push("development_pair_not_distinct");

  for (const assignment of input.assignments) {
    const score = assignment.beatSpecificFitScore;
    const min =
      assignment.beatRole === "hook" || assignment.beatRole === "climax"
        ? 80
        : 60;
    if (score === null || score === undefined || score < min) {
      failures.push(`score_below:${assignment.beatRole}:${score}<${min}`);
    }

    const panel = input.panelById.get(assignment.panelId);
    if (!panel) {
      failures.push(`panel_missing_in_index:${assignment.panelId}`);
      continue;
    }

    const pageType = input.pageTypeLookup.get(assignment.panelId) ?? "unknown";
    if (
      input.beast.isOversizedStoryMixedCrop({
        pageType,
        cropAreaRatio: panel.cropAreaRatio
      })
    ) {
      failures.push(`oversized_crop:${assignment.beatRole}:${panel.cropAreaRatio}`);
    }

    const promo = input.beast.isPromotionalPanelRegion({
      title: panel.parentContext.pageTitle ?? panel.parentContext.issueTitle ?? "",
      tags: panel.parentContext.parentTags,
      visual: {
        analyzable: true,
        eligible: false,
        rejectReason: null,
        duoVisualScore: 0,
        visualTags: panel.localEvidence.visualThemes,
        profile: null,
        warnings: []
      }
    });
    if (promo.reject) failures.push(`promotional_panel:${assignment.beatRole}`);

    if (panel.visualFlags?.doctorStrangeVisible || panel.visualFlags?.unrelatedCharacterVisible) {
      failures.push(`off_theme_character:${assignment.beatRole}`);
    }
  }

  if (!input.validation.canRender) failures.push("validation_can_render_false");
  if (!input.validation.canPublish) failures.push("validation_can_publish_false");

  return failures;
}

async function main() {
  const ffmpegCheck = await safeCheckFfmpeg(probeCommand);
  if (!ffmpegCheck.available) {
    throw new Error(ffmpegCheck.errorMessage ?? "FFmpeg indisponível");
  }

  const beast = await importMediaBeast();
  const {
    applyReferenceAlignedNarrationToPlan,
    buildUserProvidedPreflightReport,
    buildIntelligentIndexedPanelMaterializationReport,
    verifyIntelligentIndexedRenderMaterialization,
    renderRemixTimelineFromMaterialization,
    auditRenderedMp4ForUserProvided,
    loadLocalComicPanelIndex,
    findLocalPanelById,
    DEFAULT_USER_PROVIDED_DIR
  } = beast;

  const ffmpeg = ffmpegCheck.command ?? "ffmpeg";
  const ffprobe = process.env.FFPROBE_PATH?.trim() || "ffprobe";

  const [localIndexReportRaw, validationRaw, planRaw] = await Promise.all([
    readFile(LOCAL_INDEX_REPORT_PATH, "utf8"),
    readFile(ASSIGNMENTS_PATH, "utf8"),
    readFile(join(projectRoot, "tmp", "variation-b-gated-plan.json"), "utf8")
  ]);

  const localIndexReport = JSON.parse(localIndexReportRaw);
  const validation = JSON.parse(validationRaw);
  const plan = applyReferenceAlignedNarrationToPlan(JSON.parse(planRaw));

  const expectedDivergences = validateAgainstExpected(validation);
  if (expectedDivergences.length > 0) {
    const report = {
      generatedAt: new Date().toISOString(),
      phase: "validated_artifact_check",
      divergences: expectedDivergences,
      renderSkipped: true,
      finalPublishReady: false
    };
    await writeFile(REPORT_PATH, JSON.stringify(report, null, 2), "utf8");
    console.log(JSON.stringify(report, null, 2));
    throw new Error(`Validated artifacts diverged: ${expectedDivergences.join("; ")}`);
  }

  const assetDirectory = validation.assetDirectory ?? join(projectRoot, DEFAULT_USER_PROVIDED_DIR);
  const indexPath = validation.indexPath ?? localIndexReport.indexPath;
  const index = await loadLocalComicPanelIndex(assetDirectory);
  if (!index) {
    throw new Error(`missing_local_panel_index:${indexPath}`);
  }

  const pageTypeLookup = buildPageTypeLookup(index);
  const panelById = new Map();
  for (const page of index.pages) {
    for (const panel of page.panels) {
      panelById.set(panel.panelId, panel);
    }
  }

  const indexedBeats = [];
  for (const beatRole of BEAT_ROLES) {
    const assignment = validation.assignments.find((entry) => entry.beatRole === beatRole);
    if (!assignment?.panelId) {
      throw new Error(`validated_assignment_missing:${beatRole}`);
    }
    const panel = findLocalPanelById(index, assignment.panelId);
    if (!panel) {
      throw new Error(`validated_panel_not_in_index:${assignment.panelId}`);
    }
    indexedBeats.push({
      beatRole,
      panelId: panel.panelId,
      panelImagePath: panel.panelImagePath,
      panelImageSha256: panel.panelImageSha256,
      cropBounds: panel.cropBounds,
      sourcePagePath: panel.sourcePagePath,
      pageNumber: panel.pageNumber,
      sequenceId: panel.sequenceId
    });
  }

  const legacyPreflight = await buildUserProvidedPreflightReport({
    plan,
    assetDirectory,
    projectRoot,
    ffprobeCommand: ffprobe,
    ffmpegCommand: ffmpeg
  });

  const materialization = buildIntelligentIndexedPanelMaterializationReport({
    plan,
    beats: indexedBeats,
    beatAssignments: legacyPreflight.beatAssignments,
    assets: legacyPreflight.assetsAccepted,
    projectRoot,
    publishAssetPolicy: legacyPreflight.publishAssetPolicy
  });

  await writeFile(MATERIALIZATION_PATH, JSON.stringify(materialization, null, 2), "utf8");

  const captionsPayload = JSON.stringify(materialization.captionCues ?? [], null, 0);
  const narrationPayload = JSON.stringify(
    {
      narrationBeats: plan.narrationPlan?.narrationBeats ?? [],
      suggestedScript: plan.narrationPlan?.suggestedScript ?? ""
    },
    null,
    0
  );

  const inputManifest = {
    generatedAt: new Date().toISOString(),
    variation: "B — intelligent v6",
    sourceArtifacts: {
      localPanelIndexReport: LOCAL_INDEX_REPORT_PATH,
      beatAssignmentsValidation: ASSIGNMENTS_PATH
    },
    hashes: {
      localPanelIndex: {
        path: indexPath,
        sha256: await sha256File(indexPath)
      },
      localPanelIndexReport: {
        path: LOCAL_INDEX_REPORT_PATH,
        sha256: sha256Text(localIndexReportRaw)
      },
      beatAssignmentsValidation: {
        path: ASSIGNMENTS_PATH,
        sha256: sha256Text(validationRaw)
      },
      intelligentMaterialization: {
        path: MATERIALIZATION_PATH,
        sha256: await sha256File(MATERIALIZATION_PATH)
      },
      captions: {
        sha256: sha256Text(captionsPayload),
        cueCount: materialization.captionCues?.length ?? 0
      },
      narrationPlan: {
        path: join(projectRoot, "tmp", "variation-b-gated-plan.json"),
        sha256: sha256Text(narrationPayload)
      }
    },
    validatedMetrics: {
      uniquePanelCount: validation.uniquePanelCount,
      maxPanelReuseCount: validation.maxPanelReuseCount,
      continuityScore: validation.continuityScore,
      averageBeatSpecificFitScore: validation.averageBeatSpecificFitScore,
      canRender: validation.canRender,
      canPublish: validation.canPublish
    }
  };
  await writeFile(MANIFEST_PATH, JSON.stringify(inputManifest, null, 2), "utf8");

  const integrity = await verifyIntelligentIndexedRenderMaterialization({
    beats: indexedBeats,
    timelineScenes: materialization.timelineScenes,
    ffprobeCommand: ffprobe
  });

  const matchReports = [];
  for (const beat of indexedBeats) {
    const assignment = validation.assignments.find((entry) => entry.beatRole === beat.beatRole);
    const scene = materialization.timelineScenes.find((entry) => entry.sceneRole === beat.beatRole);
    const renderSha = scene?.assetPath ? await sha256File(scene.assetPath) : "";
    const report = compareIntelligentApprovedToRenderInput({
      beat: beat.beatRole,
      approvedPanel: {
        panelId: beat.panelId,
        panelImagePath: beat.panelImagePath,
        panelImageSha256: beat.panelImageSha256,
        cropBounds: beat.cropBounds
      },
      renderScene: scene ?? {},
      manifestEntry: { panelId: beat.panelId },
      renderInputSha256: renderSha
    });
    const panelIdMatch = assignment?.panelId === beat.panelId;
    const pathMatch = assignment?.panelImagePath === scene?.assetPath;
    const hashMatch = beat.panelImageSha256 === renderSha;
    const cropMatch =
      JSON.stringify(assignment ? beat.cropBounds : null) === JSON.stringify(beat.cropBounds);
    const materializedCorrectly = Boolean(
      panelIdMatch && pathMatch && hashMatch && cropMatch && report.pathMatch && report.hashMatch
    );
    matchReports.push({
      ...report,
      panelIdMatch,
      cropMatch,
      materializedCorrectly,
      assignmentPanelId: assignment?.panelId ?? null,
      assignmentPath: assignment?.panelImagePath ?? null,
      beatSpecificFitScore: assignment?.beatSpecificFitScore ?? null
    });
  }

  const materializedCorrectCount = matchReports.filter((entry) => entry.materializedCorrectly).length;
  const planRenderMatchRatio = Number((materializedCorrectCount / BEAT_ROLES.length).toFixed(4));

  const gateFailures = runPreflightGates({
    assignments: validation.assignments,
    uniquePanelCount: validation.uniquePanelCount,
    maxPanelReuseCount: validation.maxPanelReuseCount,
    continuityScore: validation.continuityScore,
    validation,
    panelById,
    pageTypeLookup,
    beast
  });

  if (!integrity.canRender || integrity.failedSceneCount > 0) {
    gateFailures.push(`integrity_failed:${integrity.failedSceneCount}`);
  }
  if (materializedCorrectCount !== BEAT_ROLES.length) {
    gateFailures.push(`plan_render_match:${materializedCorrectCount}/8`);
  }
  if (integrity.verifiedSceneCount !== BEAT_ROLES.length) {
    gateFailures.push(`integrity_verified:${integrity.verifiedSceneCount}/8`);
  }

  const preflightPassed = gateFailures.length === 0;
  const preflightReport = {
    generatedAt: new Date().toISOString(),
    variation: "B — Comics (intelligent v6 preflight)",
    sourceArtifacts: inputManifest.sourceArtifacts,
    validatedMetrics: inputManifest.validatedMetrics,
    assignments: validation.assignments.map((entry) => ({
      beatRole: entry.beatRole,
      panelId: entry.panelId,
      pageNumber: entry.pageNumber,
      cropAreaRatio: entry.cropAreaRatio,
      beatSpecificFitScore: entry.beatSpecificFitScore,
      reuseCount: entry.reuseCount
    })),
    materializedPanels: indexedBeats.map((beat) => ({
      beatRole: beat.beatRole,
      panelId: beat.panelId,
      panelImagePath: beat.panelImagePath,
      panelImageSha256: beat.panelImageSha256
    })),
    integrity,
    planRenderMatchRatio,
    matchReports,
    gateFailures,
    canRender: preflightPassed,
    canPublish: preflightPassed,
    renderSkipped: !preflightPassed
  };

  if (!preflightPassed) {
    preflightReport.finalPublishReady = false;
    await writeFile(REPORT_PATH, JSON.stringify(preflightReport, null, 2), "utf8");
    console.log(JSON.stringify(preflightReport, null, 2));
    throw new Error(`Preflight failed: ${gateFailures.join("; ")}`);
  }

  await mkdir(dirname(MP4_PATH), { recursive: true });
  console.log(`[v6] Rendering ${MP4_PATH}`);
  const renderResult = await renderRemixTimelineFromMaterialization({
    report: materialization,
    plan,
    outputPath: MP4_PATH,
    projectRoot,
    workDir: WORK_DIR,
    ffmpegCommand: ffmpeg,
    publishQualityAudio: true
  });

  const auditPreflight = {
    ...legacyPreflight,
    canRender: true,
    canPublish: true,
    beatAssignments: materialization.timelineScenes.map((scene) => {
      const beat = indexedBeats.find((entry) => entry.beatRole === scene.sceneRole);
      const timing = legacyPreflight.beatAssignments.find((entry) => entry.beatRole === scene.sceneRole);
      return {
        ...(timing ?? {}),
        beatRole: scene.sceneRole,
        panelId: beat?.panelId,
        panelImagePath: beat?.panelImagePath
      };
    })
  };

  const finalAudit = await auditRenderedMp4ForUserProvided({
    mp4Path: renderResult.outputPath,
    preflight: auditPreflight,
    projectRoot,
    ffmpegCommand: ffmpeg,
    ffprobeCommand: ffprobe,
    finalContactSheetPath: CONTACT_SHEET_PATH
  });

  const probe = await probeMp4(renderResult.outputPath, ffprobe);
  const frameDir = join(WORK_DIR, "validation-frames");
  const framePaths = [];
  for (const sec of CONTACT_SHEET_SECONDS) {
    const framePath = join(frameDir, `frame-${String(sec).replace(".", "_")}s.jpg`);
    await extractFrame(renderResult.outputPath, sec, framePath, ffmpeg);
    framePaths.push({ sec, path: framePath });
  }

  const tileListPath = join(frameDir, "tile-list.txt");
  await writeFile(
    tileListPath,
    framePaths.map((entry) => `file '${entry.path.replace(/\\/g, "/")}'`).join("\n"),
    "utf8"
  );
  await probeCommand(ffmpeg, [
    "-y",
    "-hide_banner",
    "-loglevel",
    "error",
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    tileListPath,
    "-vf",
    "scale=360:640:force_original_aspect_ratio=decrease,pad=360:640:(ow-iw)/2:(oh-ih)/2,tile=4x4:padding=4:color=black",
    "-frames:v",
    "1",
    "-q:v",
    "2",
    CONTACT_SHEET_PATH
  ]);

  let legacyRegionalCropCount = 0;
  const visualIssues = [];
  for (const scene of materialization.timelineScenes) {
    const path = scene.assetPath ?? "";
    if (/panel-crops|_(top|mid|bottom)Third\.jpg/i.test(path)) {
      legacyRegionalCropCount += 1;
      visualIssues.push(`legacy_region_crop:${scene.sceneRole}:${path}`);
    }
    if (!path.includes(".panel-index")) {
      visualIssues.push(`non_indexed_crop:${scene.sceneRole}:${path}`);
    }
  }

  const captionLiteralNCount = (materialization.captionCues ?? []).filter((cue) =>
    /\bn\b/i.test(cue.textOnScreen ?? "")
  ).length;

  const audioOk =
    finalAudit.audioProbe.codec === "aac" &&
    finalAudit.audioProbe.sampleRateHz === 48000 &&
    finalAudit.audioProbe.channels === 2 &&
    finalAudit.audioProbe.loudnessLUFS !== null &&
    finalAudit.audioProbe.loudnessLUFS >= -16 &&
    finalAudit.audioProbe.loudnessLUFS <= -14;

  const beatAudit = matchReports.map((entry) => {
    const timing = legacyPreflight.beatAssignments.find((beat) => beat.beatRole === entry.beat);
    const checkpointSec = timing ? Number((timing.startSec + 0.5).toFixed(1)) : 0;
    const cue = materialization.captionCues?.find((c) => c.beatId === entry.beat);
    const issues = [];
    if (!entry.materializedCorrectly) issues.push(entry.reason);
    if (!cue?.textOnScreen?.trim()) issues.push("caption_missing");
    return {
      beat: entry.beat,
      approvedPanelId: entry.approvedPanelId,
      approvedPanelPath: entry.approvedPanelPath,
      approvedSha256: entry.approvedSha256,
      renderInputPath: entry.renderInputPath,
      renderInputSha256: entry.renderInputSha256,
      beatSpecificFitScore: entry.beatSpecificFitScore,
      frameCheckpointSec: checkpointSec,
      materializedCorrectly: entry.materializedCorrectly,
      captionVisible: Boolean(cue?.textOnScreen?.trim()),
      issues
    };
  });

  const finalPublishReady =
    preflightPassed &&
    finalAudit.finalPublishReady &&
    materializedCorrectCount === 8 &&
    legacyRegionalCropCount === 0 &&
    captionLiteralNCount === 0 &&
    audioOk &&
    beatAudit.every((entry) => entry.materializedCorrectly && entry.captionVisible);

  const finalReport = {
    generatedAt: new Date().toISOString(),
    variation: "B — Comics (intelligent v6)",
    inputManifestPath: MANIFEST_PATH,
    inputHashes: inputManifest.hashes,
    outputPath: renderResult.outputPath,
    contactSheetPath: CONTACT_SHEET_PATH,
    materializationPath: MATERIALIZATION_PATH,
    probe,
    audioProbe: finalAudit.audioProbe,
    assignments: beatAudit,
    materializedPanels: indexedBeats,
    integrity,
    planRenderMatchRatio,
    visualIssues,
    checks: {
      materializedCorrectCount,
      legacyRegionalCropCount,
      captionLiteralNCount,
      audioOk,
      durationOk: probe.durationSec >= 38 && probe.durationSec <= 42,
      resolutionOk: probe.width === 1080 && probe.height === 1920
    },
    contactSheetFrames: framePaths,
    gateFailures,
    finalPublishReady
  };

  await writeFile(REPORT_PATH, JSON.stringify(finalReport, null, 2), "utf8");

  const summary = {
    mp4Path: renderResult.outputPath,
    contactSheetPath: CONTACT_SHEET_PATH,
    reportPath: REPORT_PATH,
    manifestPath: MANIFEST_PATH,
    planRenderMatchRatio,
    finalPublishReady,
    audioProbe: finalAudit.audioProbe
  };

  console.log(JSON.stringify(summary, null, 2));

  if (!finalPublishReady) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("[variation-b-intelligent-v6] FAIL");
  console.error(error);
  process.exitCode = 1;
});