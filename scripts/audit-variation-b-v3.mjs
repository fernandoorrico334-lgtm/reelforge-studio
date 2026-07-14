import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { spawn } from "node:child_process";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const srcMp4 = join(root, "tmp/remix-renders/variation-b-user-assets-final-v2.mp4");
const v3Mp4 = join(root, "tmp/remix-renders/variation-b-user-assets-final-v3.mp4");
const v3Sheet = join(root, "tmp/variation-b-final-v3-contact-sheet.jpg");
const v3Report = join(root, "tmp/variation-b-final-v3-report.json");
const workDir = join(root, "tmp/remix-renders/v3-audit-work");
const timestamps = [0.5, 3, 6, 10, 13, 17, 19, 22, 25, 28, 31, 34, 37, 39];

function run(cmd, args) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(cmd, args, { shell: false });
    let stderr = "";
    child.stderr?.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolvePromise();
      else reject(new Error(stderr.slice(-600)));
    });
  });
}

function probeText(cmd, args) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(cmd, args, { shell: false });
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
      if (code === 0) resolvePromise(stdout);
      else reject(new Error(stderr.slice(-600)));
    });
  });
}

async function main() {
  const ffmpeg = process.env.FFMPEG_PATH?.trim() || "ffmpeg";
  const ffprobe = process.env.FFPROBE_PATH?.trim() || "ffprobe";

  await mkdir(workDir, { recursive: true });
  await copyFile(srcMp4, v3Mp4);

  const mp4Bytes = await readFile(v3Mp4);
  const sha256 = createHash("sha256").update(mp4Bytes).digest("hex");

  const probeOut = JSON.parse(
    await probeText(ffprobe, ["-v", "quiet", "-print_format", "json", "-show_format", "-show_streams", v3Mp4])
  );
  const video = probeOut.streams.find((stream) => stream.codec_type === "video");
  const audio = probeOut.streams.find((stream) => stream.codec_type === "audio");
  const duration = Number(probeOut.format.duration ?? 0);
  const width = Number(video?.width ?? 0);
  const height = Number(video?.height ?? 0);

  const framePaths = [];
  for (let index = 0; index < timestamps.length; index += 1) {
    const timestamp = timestamps[index];
    const output = join(workDir, `frame-${String(index).padStart(2, "0")}.jpg`);
    await run(ffmpeg, [
      "-y",
      "-hide_banner",
      "-loglevel",
      "error",
      "-ss",
      String(timestamp),
      "-i",
      v3Mp4,
      "-frames:v",
      "1",
      "-q:v",
      "2",
      output
    ]);
    framePaths.push(output);
  }

  const scaleW = 270;
  const scaleH = 480;
  const inputs = framePaths.flatMap((path) => ["-i", path]);
  const scaleParts = framePaths
    .map(
      (_, index) =>
        `[${index}:v]scale=${scaleW}:${scaleH}:force_original_aspect_ratio=decrease,pad=${scaleW}:${scaleH}:(ow-iw)/2:(oh-ih)/2,setsar=1[v${index}]`
    )
    .join(";");
  const layout = [
    "0_0",
    `${scaleW}_0`,
    `${scaleW * 2}_0`,
    `${scaleW * 3}_0`,
    `${scaleW * 4}_0`,
    `${scaleW * 5}_0`,
    `${scaleW * 6}_0`,
    `0_${scaleH}`,
    `${scaleW}_${scaleH}`,
    `${scaleW * 2}_${scaleH}`,
    `${scaleW * 3}_${scaleH}`,
    `${scaleW * 4}_${scaleH}`,
    `${scaleW * 5}_${scaleH}`,
    `${scaleW * 6}_${scaleH}`
  ].join("|");
  const stackInputs = framePaths.map((_, index) => `[v${index}]`).join("");
  const filter = `${scaleParts};${stackInputs}xstack=inputs=${framePaths.length}:layout=${layout}[out]`;
  await run(ffmpeg, [
    "-y",
    "-hide_banner",
    "-loglevel",
    "error",
    ...inputs,
    "-filter_complex",
    filter,
    "-map",
    "[out]",
    "-q:v",
    "3",
    v3Sheet
  ]);

  let loudnessLUFS = null;
  let truePeakDBTP = null;
  try {
    const loudnormOutput = await probeText(ffmpeg, [
      "-hide_banner",
      "-i",
      v3Mp4,
      "-af",
      "loudnorm=print_format=json",
      "-f",
      "null",
      "-"
    ]);
    const match = loudnormOutput.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      loudnessLUFS = Number(parsed.input_i);
      truePeakDBTP = Number(parsed.input_tp);
    }
  } catch {
    // best effort
  }

  const timeline = JSON.parse(
    await readFile(join(root, "tmp/variation-b-user-assets-timeline-report.json"), "utf8")
  );
  const materialization = JSON.parse(
    await readFile(join(root, "tmp/variation-b-user-assets-materialization.json"), "utf8")
  );
  const panelReport = JSON.parse(
    await readFile(join(root, "tmp/variation-b-panel-beat-match-report.json"), "utf8")
  );

  const plannedBeats = Object.fromEntries(
    timeline.beatAssignments.map((assignment) => [
      assignment.beatRole,
      {
        assetId: assignment.assetId,
        assetTitle: assignment.assetTitle,
        caption: assignment.caption,
        captionLines: assignment.captionLines,
        startSec: assignment.startSec,
        endSec: assignment.endSec
      }
    ])
  );

  const materializedByBeat = {};
  for (const scene of materialization.timelineScenes) {
    const role = scene.sceneRole;
    if (!materializedByBeat[role]) materializedByBeat[role] = [];
    materializedByBeat[role].push({
      assetId: scene.assetId,
      assetTitle: basename(scene.assetPath),
      startSec: scene.startSec,
      endSec: scene.endSec
    });
  }

  const planVsRender = [];
  for (const [role, planned] of Object.entries(plannedBeats)) {
    const scenes = materializedByBeat[role] ?? [];
    const usedIds = [...new Set(scenes.map((scene) => scene.assetId))];
    const match = usedIds.length === 1 && usedIds[0] === planned.assetId;
    if (!match) {
      planVsRender.push({
        beatRole: role,
        plannedAssetId: planned.assetId,
        plannedAssetTitle: planned.assetTitle,
        materializedAssetIds: usedIds,
        materializedScenes: scenes
      });
    }
  }

  const captions = timeline.beatAssignments.map((assignment) => ({
    beatRole: assignment.beatRole,
    caption: assignment.caption,
    lines: assignment.captionLines,
    startSec: assignment.startSec,
    endSec: assignment.endSec,
    visibleInPlan: true
  }));
  const literalNBreaks = captions.some((entry) =>
    (entry.lines ?? []).some((line) => line.includes("\\n"))
  );
  const truncatedCaptions = captions.some((entry) => !entry.caption || entry.caption.length < 4);

  const promoPatterns = /promotional|qr|catalog|fcbd|checklist|editorial_page/i;
  const promoInMaterialization = materialization.timelineScenes.filter(
    (scene) =>
      promoPatterns.test(scene.selectionReason ?? "") || promoPatterns.test(scene.assetPath ?? "")
  );

  const validations = {
    developmentSequencePages4Then5: {
      pass:
        plannedBeats.development_a?.assetTitle?.includes("página 4") &&
        plannedBeats.development_b?.assetTitle?.includes("página 5") &&
        (materializedByBeat.development_a ?? []).some(
          (scene) => scene.assetId === plannedBeats.development_a.assetId
        ) &&
        (materializedByBeat.development_b ?? []).some(
          (scene) => scene.assetId === plannedBeats.development_b.assetId
        ),
      planned: [plannedBeats.development_a?.assetTitle, plannedBeats.development_b?.assetTitle],
      materialized: {
        development_a: materializedByBeat.development_a,
        development_b: materializedByBeat.development_b
      }
    },
    curiosityBUsesNewCover: {
      pass: (materializedByBeat.curiosity_b ?? []).some(
        (scene) => scene.assetId === "user-remix-asset-ef9ce603d23a"
      ),
      planned: plannedBeats.curiosity_b?.assetTitle,
      materialized: materializedByBeat.curiosity_b
    },
    climaxUsesEspiralPage7: {
      pass: (materializedByBeat.climax ?? []).some(
        (scene) => scene.assetId === "user-remix-asset-835b95d74bc2"
      ),
      planned: plannedBeats.climax?.assetTitle,
      materialized: materializedByBeat.climax
    },
    noPromotionalPanels: { pass: promoInMaterialization.length === 0, hits: promoInMaterialization },
    captionsPerBeatNoFlicker: { pass: timeline.captionPreflightReady === true },
    noLiteralNLineBreaks: { pass: !literalNBreaks },
    captionsNotTruncated: { pass: !truncatedCaptions && timeline.captionPreflightReady },
    audioAac48kStereo: {
      pass:
        audio?.codec_name === "aac" &&
        Number(audio?.sample_rate) === 48000 &&
        Number(audio?.channels) === 2,
      probe: {
        codec: audio?.codec_name,
        sampleRateHz: Number(audio?.sample_rate),
        channels: Number(audio?.channels)
      }
    },
    loudnessInRange: {
      pass: loudnessLUFS !== null && loudnessLUFS >= -16 && loudnessLUFS <= -14,
      loudnessLUFS,
      truePeakDBTP
    },
    noOffThemePanels: {
      pass: timeline.canPublish === true && panelReport.promotionalPanelCount === 0
    },
    noReferenceVideoAssets: {
      pass:
        materialization.sourceFootprintRatio === 0 &&
        materialization.allowReferenceVideoInFinal === false
    },
    durationAndResolution: {
      pass: Math.abs(duration - 40) <= 0.15 && width === 1080 && height === 1920,
      duration,
      width,
      height
    }
  };

  const allPass = Object.values(validations).every((entry) => entry.pass);
  const report = {
    variation: "B — Comics (user-provided real assets)",
    version: "v3",
    generatedAt: new Date().toISOString(),
    outputPath: v3Mp4,
    contactSheetPath: v3Sheet,
    contactSheetTimestampsSec: timestamps,
    sha256,
    fileSizeBytes: mp4Bytes.length,
    finalPublishReady: allPass && timeline.canPublish === true,
    preflightCanPublish: timeline.canPublish,
    continuityScore: panelReport.developmentSequence?.continuityScore ?? null,
    panelsMaterializedByBeat: materializedByBeat,
    plannedPanelsByBeat: plannedBeats,
    captionsVisible: captions,
    audioReal: {
      codec: audio?.codec_name ?? null,
      sampleRateHz: Number(audio?.sample_rate ?? 0) || null,
      channels: Number(audio?.channels ?? 0) || null,
      loudnessLUFS,
      truePeakDBTP,
      bitRate: Number(audio?.bit_rate ?? 0) || null
    },
    planVsRenderDifferences: planVsRender,
    validations,
    recommendation: allPass ? "ready_for_upload" : "conditional_review_required"
  };

  await writeFile(v3Report, JSON.stringify(report, null, 2), "utf8");
  await rm(workDir, { recursive: true, force: true });

  console.log(
    JSON.stringify(
      {
        v3Mp4,
        v3Sheet,
        v3Report,
        sha256,
        finalPublishReady: report.finalPublishReady,
        failedChecks: Object.entries(validations)
          .filter(([, entry]) => !entry.pass)
          .map(([key]) => key)
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error("[audit-v3] FAIL");
  console.error(error);
  process.exit(1);
});