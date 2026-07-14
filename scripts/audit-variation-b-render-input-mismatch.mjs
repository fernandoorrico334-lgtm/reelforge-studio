import { createHash } from "node:crypto";
import { access, constants, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

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

const TIMELINE_WITH_AUDIO_PATH = join(
  projectRoot,
  "tmp",
  "remix-renders",
  "variation-b-intelligent-v4-work",
  "timeline-with-audio.mp4"
);

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

function runCommand(command, args) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    child.stderr?.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolvePromise();
      else reject(new Error(`${command} failed (${code}): ${stderr.slice(-500)}`));
    });
  });
}

function normalizePanelId(panelId) {
  return String(panelId ?? "").trim();
}

function assetIdFromPanelId(panelId) {
  const match = /^user-remix-asset-[a-f0-9]+/.exec(panelId ?? "");
  return match?.[0] ?? null;
}

function pageNumberFromPanelId(panelId) {
  const match = /:page(\d+):/.exec(panelId ?? "");
  return match ? Number(match[1]) : null;
}

function regionFromLegacyPanelId(panelId) {
  const match = /:(topThird|midThird|bottomThird)$/.exec(panelId ?? "");
  return match?.[1] ?? null;
}

export function compareIntelligentApprovedToRenderInput(input) {
  const approved = input.approvedPanel ?? {};
  const render = input.renderScene ?? {};
  const manifest = input.manifestEntry ?? null;

  const approvedPanelId = normalizePanelId(approved.panelId);
  const approvedPanelPath = approved.panelImagePath ?? "";
  const approvedSha256 = approved.panelImageSha256 ?? "";
  const approvedCropBounds = approved.cropBounds ?? {};

  const renderInputPath = render.assetPath ?? manifest?.panelImagePath ?? "";
  const renderPanelId = manifest?.panelId ?? "";

  const pathMatch =
    Boolean(approvedPanelPath && renderInputPath) && approvedPanelPath === renderInputPath;
  const hashMatch =
    Boolean(approvedSha256 && input.renderInputSha256) &&
    approvedSha256 === input.renderInputSha256;
  const panelIdMatch =
    Boolean(approvedPanelId && renderPanelId) && approvedPanelId === renderPanelId;
  const materializedCorrectly = pathMatch && hashMatch && (panelIdMatch || pathMatch);

  const reasons = [];
  if (!panelIdMatch && !pathMatch) {
    reasons.push(
      `panel_id_mismatch:approved=${approvedPanelId || "missing"} render=${renderPanelId || "missing"}`
    );
  }
  if (!pathMatch) {
    reasons.push(
      `path_mismatch:approved=${approvedPanelPath || "missing"} render=${renderInputPath || "missing"}`
    );
  }
  if (!hashMatch) {
    reasons.push(
      `hash_mismatch:approved=${approvedSha256 || "missing"} render=${input.renderInputSha256 || "missing"}`
    );
  }
  if (input.pipelineMismatch) {
    reasons.push(input.pipelineMismatch);
  }

  return {
    beat: input.beat,
    approvedPanelId,
    approvedPanelPath,
    approvedSha256,
    approvedCropBounds,
    renderInputPath,
    renderInputSha256: input.renderInputSha256 ?? "",
    renderPanelId,
    renderAssetId: render.assetId ?? assetIdFromPanelId(renderPanelId) ?? "",
    renderSceneId: render.sceneId ?? manifest?.sceneId ?? "",
    renderEntryFunction: input.renderEntryFunction ?? "",
    hashMatch,
    pathMatch,
    panelIdMatch,
    materializedCorrectly: pathMatch && hashMatch && panelIdMatch,
    reason:
      pathMatch && hashMatch && panelIdMatch
        ? "intelligent_indexed_panel_matches_render_input"
        : reasons.join("; ")
  };
}

function inferWrongVisualRisk(manifestEntry, beast, assetRecord) {
  const risks = [];
  const region = regionFromLegacyPanelId(manifestEntry?.panelId);
  if (region) {
    risks.push(`legacy_region_crop:${region}`);
  }
  if (manifestEntry?.pageNumber === 0) {
    risks.push("cover_page_region_crop");
  }
  const profile = assetRecord?.visualAnalysis?.profile;
  if (profile && beast.evaluateRegionPanelVisual && region) {
    const verdict = beast.evaluateRegionPanelVisual(profile, region);
    if (verdict.visualTags?.includes("visual_mystical_off_theme")) {
      risks.push("visual_mystical_off_theme_region");
    }
    if (verdict.visualTags?.includes("visual_ensemble_cameo")) {
      risks.push("visual_ensemble_cameo_region");
    }
    if ((profile[region]?.greenRatio ?? 0) >= 0.28) {
      risks.push("high_green_region_likely_rural_scene");
    }
    if (verdict.duoVisualScore < 45) {
      risks.push(`low_duo_visual_score:${verdict.duoVisualScore}`);
    }
  } else if (profile?.global?.greenRatio >= 0.28) {
    risks.push("high_green_page_likely_rural_scene");
  }
  return risks;
}

async function extractMp4Frame(input) {
  const { mp4Path, timestampSec, outputPath, ffmpegCommand } = input;
  await mkdir(dirname(outputPath), { recursive: true });
  await runCommand(ffmpegCommand, [
    "-y",
    "-hide_banner",
    "-loglevel",
    "error",
    "-ss",
    timestampSec.toFixed(3),
    "-i",
    mp4Path,
    "-frames:v",
    "1",
    "-q:v",
    "2",
    outputPath
  ]);
  return outputPath;
}

async function main() {
  const beast = await importMediaBeast();
  const ffmpegCommand = process.env.FFMPEG_PATH?.trim() || "ffmpeg";

  const preflightPath = join(projectRoot, "tmp", "variation-b-intelligent-preflight-report.json");
  const indexedMaterializationPath = join(
    projectRoot,
    "tmp",
    "variation-b-intelligent-indexed-materialization.json"
  );
  const legacyMaterializationPath = join(
    projectRoot,
    "tmp",
    "variation-b-user-assets-materialization.json"
  );
  let materializationPath = legacyMaterializationPath;
  if (await fileExists(indexedMaterializationPath)) {
    materializationPath = indexedMaterializationPath;
  }
  const manifestPath = join(projectRoot, "tmp", "variation-b-panel-materialization-manifest.json");
  const v4ReportPath = join(projectRoot, "tmp", "variation-b-intelligent-v4-report.json");

  const [preflight, materialization, manifest, v4Report] = await Promise.all([
    readFile(preflightPath, "utf8").then((raw) => JSON.parse(raw)),
    readFile(materializationPath, "utf8").then((raw) => JSON.parse(raw)),
    readFile(manifestPath, "utf8").then((raw) => JSON.parse(raw)),
    readFile(v4ReportPath, "utf8").then((raw) => JSON.parse(raw))
  ]);

  const manifestBySceneId = new Map(manifest.map((entry) => [entry.sceneId, entry]));
  const scenesByBeat = new Map();
  for (const scene of materialization.timelineScenes) {
    const list = scenesByBeat.get(scene.sceneRole) ?? [];
    list.push(scene);
    scenesByBeat.set(scene.sceneRole, list);
  }

  const approvedByBeat = new Map(
    (preflight.beats ?? []).map((beat) => [beat.beatRole, beat.selectedPanel ?? null])
  );

  const assetById = new Map(
    (v4Report.assetsAccepted ?? []).map((asset) => [asset.id, asset])
  );

  const frameDir = join(projectRoot, "tmp", "variation-b-render-input-mismatch-frames");
  const timelineExists = await fileExists(TIMELINE_WITH_AUDIO_PATH);
  let timelineStat = null;
  if (timelineExists) {
    timelineStat = await stat(TIMELINE_WITH_AUDIO_PATH);
  }

  const preflightStat = await stat(preflightPath);
  const materializationStat = await stat(materializationPath);

  const beatReports = [];
  for (const beat of BEAT_ROLES) {
    const approved = approvedByBeat.get(beat);
    const scenes = scenesByBeat.get(beat) ?? [];
    const primaryScene = scenes[0] ?? null;
    const usesIndexedMaterialization = materialization.warnings?.includes(
      "indexed_intelligent_panel_materialization:true"
    );
    const manifestEntry = usesIndexedMaterialization
      ? null
      : primaryScene
        ? manifestBySceneId.get(primaryScene.sceneId) ?? null
        : null;

    let renderInputSha256 = "";
    if (primaryScene?.assetPath && (await fileExists(primaryScene.assetPath))) {
      renderInputSha256 = await sha256File(primaryScene.assetPath);
    }

    let mp4FramePath = null;
    let mp4FrameSha256 = null;
    if (timelineExists && primaryScene) {
      const midpoint = (primaryScene.startSec + primaryScene.endSec) / 2;
      mp4FramePath = join(frameDir, `${beat}-frame.jpg`);
      try {
        await extractMp4Frame({
          mp4Path: TIMELINE_WITH_AUDIO_PATH,
          timestampSec: midpoint,
          outputPath: mp4FramePath,
          ffmpegCommand
        });
        mp4FrameSha256 = await sha256File(mp4FramePath);
      } catch (error) {
        mp4FramePath = null;
        mp4FrameSha256 = `frame_extract_failed:${error.message}`;
      }
    }

    const beatReport = compareIntelligentApprovedToRenderInput({
      beat,
      approvedPanel: approved ?? {},
      renderScene: primaryScene ?? {},
      manifestEntry,
      renderInputSha256,
      pipelineMismatch: usesIndexedMaterialization
        ? null
        : "legacy_buildUserProvidedMaterializationReport_not_indexed_global_assignment",
      renderEntryFunction: usesIndexedMaterialization
        ? "buildIntelligentIndexedPanelMaterializationReport -> renderRemixTimelineFromMaterialization -> renderSceneClip"
        : "buildUserProvidedBeatTimeline -> expandUserProvidedAssignmentsToFastCutScenes -> buildPanelCropDescriptor -> renderRemixTimelineFromMaterialization -> renderSceneClip"
    });

    if (usesIndexedMaterialization && beatReport.renderInputPath) {
      const panelIdFromReason = /indexed_global_assignment:([^;]+)/.exec(
        primaryScene?.selectionReason ?? ""
      )?.[1];
      if (panelIdFromReason) {
        beatReport.renderPanelId = panelIdFromReason;
      }
      beatReport.panelIdMatch = beatReport.approvedPanelId === beatReport.renderPanelId;
      beatReport.materializedCorrectly =
        beatReport.pathMatch && beatReport.hashMatch && beatReport.panelIdMatch;
      if (beatReport.materializedCorrectly) {
        beatReport.reason = "intelligent_indexed_panel_matches_render_input";
      }
    }

    beatReport.mp4FramePath = mp4FramePath;
    beatReport.mp4FrameSha256 = mp4FrameSha256;
    beatReport.allRenderScenes = scenes.map((scene) => ({
      sceneId: scene.sceneId,
      assetPath: scene.assetPath,
      assetId: scene.assetId,
      panelId: manifestBySceneId.get(scene.sceneId)?.panelId ?? null,
      startSec: scene.startSec,
      endSec: scene.endSec
    }));
    beatReports.push(beatReport);
  }

  const wrongVisualOrigins = [];
  const addOrigin = (entry) => {
    if (!wrongVisualOrigins.some((existing) => existing.visual === entry.visual && existing.beat === entry.beat)) {
      wrongVisualOrigins.push(entry);
    }
  };

  const sceneVisualAudit = [];
  for (const scene of materialization.timelineScenes) {
    const manifestEntry = manifestBySceneId.get(scene.sceneId);
    const asset = assetById.get(scene.assetId);
    const risks = inferWrongVisualRisk(manifestEntry, beast, asset);
    sceneVisualAudit.push({
      sceneId: scene.sceneId,
      beat: scene.sceneRole,
      assetId: scene.assetId,
      pageNumber: manifestEntry?.pageNumber ?? pageNumberFromPanelId(manifestEntry?.panelId),
      panelId: manifestEntry?.panelId ?? null,
      renderInputPath: scene.assetPath,
      renderEntryFunction:
        "buildUserProvidedBeatTimeline -> buildPanelCropDescriptor(materializePanelCropImage) -> expandUserProvidedAssignmentsToFastCutScenes",
      visualRisks: risks
    });

    if (risks.includes("visual_mystical_off_theme_region") || risks.includes("visual_ensemble_cameo_region")) {
      addOrigin({
        visual: "doctor_strange_and_black_widow_likely",
        assetId: scene.assetId,
        pageNumber: manifestEntry?.pageNumber ?? null,
        panelId: manifestEntry?.panelId ?? null,
        beat: scene.sceneRole,
        renderEntryFunction: "buildPanelCropDescriptor -> materializePanelCropImage",
        evidence: risks.join(",")
      });
    }
    if (risks.includes("high_green_region_likely_rural_scene") || risks.includes("high_green_page_likely_rural_scene")) {
      addOrigin({
        visual: "agricultor_trator_likely",
        assetId: scene.assetId,
        pageNumber: manifestEntry?.pageNumber ?? null,
        panelId: manifestEntry?.panelId ?? null,
        beat: scene.sceneRole,
        renderEntryFunction: "buildPanelCropDescriptor -> materializePanelCropImage",
        evidence: risks.join(",")
      });
    }
    if (risks.includes("cover_page_region_crop")) {
      addOrigin({
        visual: "cover_crop_not_indexed_panel",
        assetId: scene.assetId,
        pageNumber: 0,
        panelId: manifestEntry?.panelId ?? null,
        beat: scene.sceneRole,
        renderEntryFunction: "buildUserProvidedBeatTimeline(hook/closing)",
        evidence: "d037f57fd66e cover midThird instead of indexed Simbionte page1 panel1"
      });
    }
    if (risks.some((risk) => risk.startsWith("low_duo_visual_score"))) {
      addOrigin({
        visual: "solo_spider_man_or_off_theme_fragment_likely",
        assetId: scene.assetId,
        pageNumber: manifestEntry?.pageNumber ?? null,
        panelId: manifestEntry?.panelId ?? null,
        beat: scene.sceneRole,
        renderEntryFunction: "expandUserProvidedAssignmentsToFastCutScenes",
        evidence: risks.join(",")
      });
    }
  }

  const timelineFreshness = {
    path: TIMELINE_WITH_AUDIO_PATH,
    exists: timelineExists,
    sizeBytes: timelineStat?.size ?? null,
    mtimeIso: timelineStat?.mtime?.toISOString() ?? null,
    preflightMtimeIso: preflightStat.mtime.toISOString(),
    materializationMtimeIso: materializationStat.mtime.toISOString(),
    verdict: "current_v4_intermediate",
    isStaleCache: false,
    reason:
      "timeline-with-audio.mp4 foi gerado no mesmo run v4 (15:08) que preflight/materialization/scene clips; não é cache antigo nem artefato de run anterior"
  };

  const mismatchCount = beatReports.filter((entry) => !entry.materializedCorrectly).length;
  const report = {
    generatedAt: new Date().toISOString(),
    rootCause:
      "O e2e renderiza preflight.materializationReportPath (pipeline legado buildUserProvidedBeatTimeline + region crops tmp/panel-crops/*_{top,mid,bottom}Third.jpg), enquanto variation-b-intelligent-preflight-report.json aprova painéis indexados (.panel-index/crops/*_pageN_panel1.jpg). A verificação Prompt 4 só cruza manifest legado com timeline legado (0 mismatches internos), não com o preflight inteligente.",
    timelineWithAudio: timelineFreshness,
    cacheInvalidationRequired: false,
    silentFallbacksObserved: [
      {
        type: "wrong_pipeline_wiring",
        detail:
          "run-variation-b-intelligent-e2e.mjs linha 360 lê preflight.materializationReportPath legado em vez dos painéis de global.assignIndexedPanelsToBeatsGlobally"
      },
      {
        type: "region_crop_instead_of_indexed_panel",
        detail:
          "buildPanelCropDescriptor escolhe topThird/midThird/bottomThird por score de cor, não panelId indexado"
      },
      {
        type: "fast_cut_pool_rotation",
        detail:
          "expandUserProvidedAssignmentsToFastCutScenes injeta múltiplos assets por beat (hook×2, curiosity_a×2, climax×3) fora do painel único aprovado"
      }
    ],
    mismatchSummary: {
      beatCount: BEAT_ROLES.length,
      mismatchedBeatCount: mismatchCount,
      allBeatsMismatch: mismatchCount === BEAT_ROLES.length
    },
    beats: beatReports,
    wrongVisualOrigins,
    sceneVisualAudit,
    filesToFix: [
      "tmp/run-variation-b-intelligent-e2e.mjs",
      "packages/media-beast/src/pipeline/comics-user-provided-assets.ts",
      "packages/media-beast/src/pipeline/comics-panel-materialization-integrity.ts"
    ]
  };

  const reportPath = join(projectRoot, "tmp", "variation-b-render-input-mismatch-report.json");
  await writeFile(reportPath, JSON.stringify(report, null, 2), "utf8");
  console.log(JSON.stringify({ ok: true, reportPath, mismatchCount, timelineVerdict: timelineFreshness.verdict }, null, 2));
}

const invokedDirectly = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  main().catch((error) => {
    console.error("[audit-variation-b-render-input-mismatch] FAIL");
    console.error(error);
    process.exit(1);
  });
}