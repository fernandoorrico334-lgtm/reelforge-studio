import { spawn } from "node:child_process";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { existsSync } from "node:fs";
import { safeCheckFfmpeg } from "./lib/smoke-utils.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");
const cliArgs = process.argv.slice(2).filter((arg) => !arg.startsWith("--"));
const FORCE_FRESH_PLAN = process.argv.includes("--fresh-plan");
const VERBOSE_FFMPEG = process.argv.includes("--verbose-ffmpeg");
const REUSE_PLAN =
  !FORCE_FRESH_PLAN &&
  (process.argv.includes("--reuse-plan") ||
    process.env.RENDER_REUSE_PLAN === "true" ||
    process.env.RENDER_REUSE_PLAN !== "false");
const SOURCE_URL = cliArgs[0] ?? "https://youtube.com/shorts/mfOwjnNCV1A";
const TARGET_STYLE = cliArgs[1] ?? "comics";
const OUTPUT_ARG = process.argv.find((arg) => arg.startsWith("--output="));
const OUTPUT_BASENAME = OUTPUT_ARG?.slice("--output=".length)?.trim() || null;

function logProgress(message) {
  console.log(message);
}

async function importMediaBeast() {
  return import(
    pathToFileURL(join(projectRoot, "packages/media-beast/dist/index.js")).href
  );
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
      else reject(new Error(`${command} exited with code ${code}`));
    });
  });
}

function pickVariation(plan, targetStyle) {
  const all = [plan, ...(plan.alternativePlans ?? [])];
  return all.find((entry) => entry.targetStyle === targetStyle) ?? all[1] ?? plan;
}

function planCachePath(slug) {
  return join(projectRoot, "tmp", "remix-renders", `variation-${slug}-full-plan.json`);
}

const DISCOVERY_GATE_REPORT_PATH = join(
  projectRoot,
  "tmp",
  "variation-b-discovery-gate-report.json"
);
const FINAL_RENDER_REPORT_PATH = join(
  projectRoot,
  "tmp",
  "variation-b-render-final-report.json"
);
const GATED_PLAN_PATH = join(projectRoot, "tmp", "variation-b-gated-plan.json");

async function loadJsonIfExists(path) {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    return null;
  }
}

function validateDiscoveryGateForRender(discoveryGate) {
  const errors = [];
  if (!discoveryGate) {
    errors.push("discovery_gate_report_missing");
    return { ok: false, errors };
  }
  if (!discoveryGate.canRender) {
    errors.push(`discovery_gate_canRender_false:${discoveryGate.blockReason ?? "unknown"}`);
  }

  const readiness = discoveryGate.timelineReadiness ?? {};
  const checks = [
    ["sourceFootprintRatio", readiness.sourceFootprintRatio ?? 1, (v) => v <= 0.001],
    ["dominantAssetRatio", readiness.dominantAssetRatio ?? 1, (v) => v <= 0.4],
    [
      "longestStaticSegmentSec",
      readiness.longestStaticSegmentSec ?? 999,
      (v) => v <= 6
    ],
    ["uniqueAssetCount", readiness.uniqueAssetCount ?? 0, (v) => v >= 5],
    ["visualSegmentCount", readiness.visualSegmentCount ?? 0, (v) => v >= 6]
  ];

  for (const [name, value, predicate] of checks) {
    if (!predicate(value)) errors.push(`discovery_gate_${name}_failed:${value}`);
  }

  return { ok: errors.length === 0, errors, readiness };
}

function assertNoRejectedAssetsInTimeline(materialization, discoveryGate) {
  const rejectedIds = new Set(
    (discoveryGate?.rejectedAssets ?? []).map((asset) => asset.id).filter(Boolean)
  );
  const rejectedTitles = new Set(
    (discoveryGate?.rejectedAssets ?? [])
      .map((asset) => asset.title?.toLowerCase())
      .filter(Boolean)
  );

  const violations = [];
  for (const scene of materialization.timelineScenes) {
    if (scene.visualSourceType === "reference_video") {
      violations.push(`reference_video_in_timeline:${scene.sceneId}`);
    }
    if (scene.assetId && rejectedIds.has(scene.assetId)) {
      violations.push(`rejected_asset_in_timeline:${scene.assetId}:${scene.sceneId}`);
    }
    const reason = scene.selectionReason?.toLowerCase() ?? "";
    for (const title of rejectedTitles) {
      if (title && reason.includes(title.slice(0, 24))) {
        violations.push(`rejected_asset_reason_match:${scene.sceneId}`);
      }
    }
  }

  return violations;
}

async function buildFinalRenderReport({
  materialization,
  renderResult,
  discoveryGate,
  rotationReport,
  comicsSelectionReport
}) {
  const rotationStats =
    materialization.timelineRotationStats ??
    rotationReport?.after ??
    discoveryGate?.timelineReadiness ??
    {};
  const rejectedInTimeline = assertNoRejectedAssetsInTimeline(
    materialization,
    discoveryGate
  );
  const visualVariationOk =
    (rotationReport?.guards?.visualVariation?.ok ?? true) &&
    (rotationStats.dominantAssetRatio ?? 1) <= 0.4 &&
    (rotationStats.longestStaticSegmentSec ?? 999) <= 6 &&
    (rotationStats.uniqueAssetCount ?? 0) >= 5 &&
    (rotationStats.visualSegmentCount ?? 0) >= 6 &&
    rejectedInTimeline.length === 0;

  const assetsUsed = (rotationReport?.assetUsage ?? []).map((entry) => ({
    id: entry.assetId,
    title: entry.assetTitle,
    totalDurationSec: entry.totalDurationSec,
    ratio: entry.ratio
  }));

  if (assetsUsed.length === 0) {
    const usage = new Map();
    for (const scene of materialization.timelineScenes) {
      if (!scene.assetPath || scene.visualSourceType === "reference_video") continue;
      const key = scene.assetId ?? scene.assetPath;
      const current = usage.get(key) ?? {
        id: scene.assetId,
        title: scene.assetId,
        totalDurationSec: 0
      };
      current.totalDurationSec += Math.max(0.01, scene.endSec - scene.startSec);
      usage.set(key, current);
    }
    for (const entry of usage.values()) {
      assetsUsed.push({
        id: entry.id,
        title: entry.title,
        totalDurationSec: Number(entry.totalDurationSec.toFixed(2)),
        ratio: Number((entry.totalDurationSec / Math.max(renderResult.totalDurationSec, 1)).toFixed(4))
      });
    }
  }

  const renderWarnings = [
    ...new Set([
      ...(materialization.warnings ?? []),
      ...(renderResult.audioMixPlan?.warnings ?? []),
      ...rejectedInTimeline
    ])
  ];

  const passedGuards = {
    sourceFootprint: materialization.sourceFootprintRatio <= 0.001,
    visualVariation: visualVariationOk,
    materialization: materialization.canRender === true,
    comicsAssetQuality: comicsSelectionReport?.canRender !== false
  };

  const allGuardsPassed = Object.values(passedGuards).every(Boolean);

  return {
    variation: "B — Comics",
    success: allGuardsPassed,
    mp4Path: renderResult.outputPath,
    contactSheetPath: renderResult.contactSheetPath,
    durationSeconds: renderResult.totalDurationSec,
    sourceFootprintRatio: materialization.sourceFootprintRatio,
    dominantAssetRatio: rotationStats.dominantAssetRatio ?? 0,
    longestStaticSegmentSec: rotationStats.longestStaticSegmentSec ?? 0,
    uniqueAssetCount: rotationStats.uniqueAssetCount ?? 0,
    visualSegmentCount: rotationStats.visualSegmentCount ?? 0,
    captionStyle: materialization.captionStyleId ?? "comic_pop",
    musicPreset: materialization.musicPresetId ?? "viral_fast_cut",
    assetsUsed,
    assetsRejected: [
      ...(discoveryGate?.rejectedAssets ?? []).map((asset) => ({
        title: asset.title,
        sourceUrl: asset.sourceUrl,
        rejectReason: asset.rejectReason ?? asset.reason
      })),
      ...(materialization.rejectedAssets ?? [])
    ],
    renderWarnings,
    passedGuards,
    discoveryGateReportPath: DISCOVERY_GATE_REPORT_PATH,
    assetRotationReportPath: materialization.assetRotationReportPath ?? null,
    generatedAt: new Date().toISOString()
  };
}

async function loadCachedPlan(slug) {
  const cachePath = planCachePath(slug);
  if (!existsSync(cachePath)) return null;
  try {
    const raw = await readFile(cachePath, "utf8");
    const plan = JSON.parse(raw);
    if (plan?.inputVideoPath && existsSync(plan.inputVideoPath)) {
      return plan;
    }
  } catch {
    return null;
  }
  return null;
}

async function saveCachedPlan(slug, plan) {
  const cachePath = planCachePath(slug);
  await mkdir(dirname(cachePath), { recursive: true });
  await writeFile(cachePath, JSON.stringify(plan, null, 2), "utf8");
}

async function main() {
  const ffmpeg = await safeCheckFfmpeg(probeCommand);
  if (!ffmpeg.available) {
    throw new Error(ffmpeg.errorMessage ?? "FFmpeg não disponível para render.");
  }

  process.env.ENABLE_NARRATION_RETENTION_ENGINE = "true";
  const slug = TARGET_STYLE.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  const beast = await importMediaBeast();
  const {
    remixVideoFromSource,
    buildRemixMaterializationReport,
    saveRemixMaterializationReport,
    renderRemixTimelineFromMaterialization
  } = beast;

  let variation = REUSE_PLAN ? await loadCachedPlan(slug) : null;

  if (TARGET_STYLE === "comics") {
    const gatedPlan = await loadJsonIfExists(GATED_PLAN_PATH);
    if (gatedPlan) {
      variation = gatedPlan;
      logProgress("[render] Usando plano gated validado (variation-b-gated-plan.json)");
    } else {
      logProgress("[render] Plano gated ausente — executando discovery gate...");
      const { spawn } = await import("node:child_process");
      await new Promise((resolvePromise, reject) => {
        const child = spawn("node", ["scripts/run-variation-b-discovery-gate.mjs"], {
          cwd: projectRoot,
          stdio: "inherit",
          shell: false
        });
        child.on("error", reject);
        child.on("close", (code) => {
          if (code === 0) resolvePromise();
          else reject(new Error(`discovery gate exited with code ${code}`));
        });
      });
      variation = await loadJsonIfExists(GATED_PLAN_PATH);
      if (!variation) {
        throw new Error("Falha ao carregar variation-b-gated-plan.json após discovery gate.");
      }
    }
  } else if (variation) {
    logProgress(`[render] Reutilizando plano completo em cache (variação ${TARGET_STYLE})`);
  }

  if (!variation) {
    logProgress(`[render] Gerando plano para ${SOURCE_URL} (variação ${TARGET_STYLE})`);
    const plan = await remixVideoFromSource(
      { sourceUrl: SOURCE_URL },
      {
        targetStyle: "documentary",
        intensity: "extreme",
        addNarration: true,
        durationTarget: 40,
        language: "pt-BR",
        autoDownload: true,
        enableAssetDiscovery: true,
        executeAssetDiscovery: true,
        variationCount: 3,
        enableResearch: true,
        deepResearch: false,
        downloadOptions: { maxDurationSeconds: 60 }
      }
    );
    variation = pickVariation(plan, TARGET_STYLE);
    await saveCachedPlan(slug, variation);
  }

  const discoveryGate =
    TARGET_STYLE === "comics" ? await loadJsonIfExists(DISCOVERY_GATE_REPORT_PATH) : null;

  if (TARGET_STYLE === "comics") {
    const gateValidation = validateDiscoveryGateForRender(discoveryGate);
    if (!gateValidation.ok) {
      console.error(
        JSON.stringify(
          {
            error: "discovery_gate_not_ready",
            discoveryGateReportPath: DISCOVERY_GATE_REPORT_PATH,
            failures: gateValidation.errors,
            mp4Blocked: true
          },
          null,
          2
        )
      );
      process.exit(1);
    }
    logProgress("[render] Discovery gate validado — pronto para render B — Comics");
  }

  logProgress("[render] Materializando timeline (bloqueio de vídeo referência ativo)");
  const materialization = await buildRemixMaterializationReport({
    plan: variation,
    allowReferenceVideoInFinal: false,
    maxAllowedSourceFootprintRatio: 0.2,
    importTopCandidates: TARGET_STYLE === "comics" ? 12 : 8,
    projectRoot
  });

  const reportPath = await saveRemixMaterializationReport(materialization, projectRoot);
  logProgress(`[render] Relatório de materialização: ${reportPath}`);

  const rejectedInTimeline = assertNoRejectedAssetsInTimeline(materialization, discoveryGate);
  if (rejectedInTimeline.length > 0) {
    console.error(
      JSON.stringify(
        {
          error: "rejected_or_reference_assets_in_timeline",
          violations: rejectedInTimeline,
          mp4Blocked: true
        },
        null,
        2
      )
    );
    process.exit(1);
  }

  if (TARGET_STYLE === "comics") {
    const visualAudit = await loadJsonIfExists(
      join(projectRoot, "tmp", "variation-b-visual-asset-audit.json")
    );
    if (!visualAudit?.canRender) {
      console.error(
        JSON.stringify(
          {
            error: visualAudit?.blockReason ?? "visual_asset_audit_missing_or_failed",
            visualAuditReportPath: join(projectRoot, "tmp", "variation-b-visual-asset-audit.json"),
            contactSheetPath: visualAudit?.contactSheetPath ?? null,
            trueComicsAssetCount: visualAudit?.trueComicsAssetCount ?? 0,
            forbiddenAssetCount: visualAudit?.forbiddenAssetCount ?? 0,
            mp4Blocked: true
          },
          null,
          2
        )
      );
      process.exit(1);
    }
    logProgress("[render] Visual asset audit validado — contact sheet limpo para curadoria");
  }

  if (!materialization.canRender) {
    let comicsSelectionReport = null;
    if (materialization.comicsAssetSelectionReportPath) {
      try {
        comicsSelectionReport = JSON.parse(
          await readFile(materialization.comicsAssetSelectionReportPath, "utf8")
        );
      } catch {
        comicsSelectionReport = null;
      }
    }

    console.error(
      JSON.stringify(
        {
          error: materialization.blockReason,
          reportPath,
          comicsAssetSelectionReportPath: materialization.comicsAssetSelectionReportPath,
          comicsSelectionSummary: comicsSelectionReport
            ? {
                acceptedCount: comicsSelectionReport.acceptedAssets?.length ?? 0,
                rejectedCount: comicsSelectionReport.rejectedAssets?.length ?? 0,
                hookAsset: comicsSelectionReport.hookAsset,
                climaxAsset: comicsSelectionReport.climaxAsset,
                warnings: comicsSelectionReport.warnings,
                canRender: comicsSelectionReport.canRender
              }
            : null,
          sourceFootprintRatio: materialization.sourceFootprintRatio,
          providedAssetsUsageRatio: materialization.providedAssetsUsageRatio,
          warnings: materialization.warnings,
          rejectedAssets: materialization.rejectedAssets,
          approvedAssetsUsed: materialization.approvedAssetsUsed,
          mp4Blocked: true
        },
        null,
        2
      )
    );
    process.exit(1);
  }

  const outDir = join(projectRoot, "tmp", "remix-renders");
  await mkdir(outDir, { recursive: true });
  const outputStem = OUTPUT_BASENAME?.replace(/\.mp4$/i, "") ?? `variation-${slug}-final`;
  const mp4Path = join(outDir, `${outputStem}.mp4`);
  const renderReportPath = join(outDir, `${outputStem}-render-report.json`);

  logProgress(`[render] FFmpeg timeline (assets aprovados) → ${mp4Path}`);
  const renderResult = await renderRemixTimelineFromMaterialization({
    report: materialization,
    plan: variation,
    outputPath: mp4Path,
    projectRoot,
    workDir: join(outDir, `${outputStem}-timeline-work`),
    ffmpegCommand: ffmpeg.command ?? "ffmpeg",
    verbose: VERBOSE_FFMPEG
  });

  const report = {
    generatedAt: new Date().toISOString(),
    sourceUrl: SOURCE_URL,
    targetStyle: TARGET_STYLE,
    variationLabel: variation.variationLabel,
    referenceVideoPath: variation.inputVideoPath,
    allowReferenceVideoInFinal: false,
    outputPath: renderResult.outputPath,
    contactSheetPath: renderResult.contactSheetPath,
    materializationReportPath: reportPath,
    durationSec: renderResult.totalDurationSec,
    sourceFootprintRatio: materialization.sourceFootprintRatio,
    providedAssetsUsageRatio: materialization.providedAssetsUsageRatio,
    approvedAssetsUsed: materialization.approvedAssetsUsed,
    rejectedAssets: materialization.rejectedAssets,
    timelineScenes: materialization.timelineScenes.map((scene) => ({
      sceneId: scene.sceneId,
      visualSourceType: scene.visualSourceType,
      assetPath: scene.assetPath,
      caption: scene.caption,
      selectionReason: scene.selectionReason
    })),
    warnings: materialization.warnings,
    plannedButNotMaterialized: materialization.plannedButNotMaterialized,
    captionStyleId: materialization.captionStyleId,
    musicPresetId: materialization.musicPresetId,
    fastCutCount: materialization.fastCutCount,
    materializedFastCutCount: materialization.materializedFastCutCount,
    timelineMode: materialization.timelineMode,
    hasAudio: renderResult.hasAudio,
    audioMix: renderResult.audioMixPlan
      ? {
          musicPath: renderResult.audioMixPlan.musicPath,
          narrationPath: renderResult.audioMixPlan.narrationPath,
          narrationProvider: renderResult.audioMixPlan.narrationProvider,
          sfxCueCount: renderResult.audioMixPlan.sfxCues.filter((cue) => cue.assetPath).length,
          warnings: renderResult.audioMixPlan.warnings
        }
      : null,
    reusedCachedPlan: REUSE_PLAN && existsSync(planCachePath(slug))
  };

  await writeFile(renderReportPath, JSON.stringify(report, null, 2), "utf8");

  if (TARGET_STYLE === "comics") {
    const rotationReport = await loadJsonIfExists(
      materialization.assetRotationReportPath ??
        join(projectRoot, "tmp", "variation-b-asset-rotation-report.json")
    );
    const comicsSelectionReport = await loadJsonIfExists(
      materialization.comicsAssetSelectionReportPath ??
        join(projectRoot, "tmp", "comics-asset-selection-report.json")
    );
    const finalReport = await buildFinalRenderReport({
      materialization,
      renderResult,
      discoveryGate,
      rotationReport,
      comicsSelectionReport
    });

    await writeFile(FINAL_RENDER_REPORT_PATH, JSON.stringify(finalReport, null, 2), "utf8");
    logProgress(`[render] Relatório final B — Comics: ${FINAL_RENDER_REPORT_PATH}`);

    if (!finalReport.success) {
      console.error(
        JSON.stringify(
          {
            error: "final_render_guards_failed",
            finalReportPath: FINAL_RENDER_REPORT_PATH,
            passedGuards: finalReport.passedGuards,
            renderWarnings: finalReport.renderWarnings,
            mp4Path: finalReport.mp4Path
          },
          null,
          2
        )
      );
      process.exit(1);
    }
  }

  const defaultAlias = join(outDir, `variation-${slug}.mp4`);
  if (mp4Path !== defaultAlias) {
    await copyFile(mp4Path, defaultAlias);
    logProgress(`[render] Cópia espelho: ${defaultAlias}`);
  }

  console.log(JSON.stringify(report, null, 2));
  logProgress(`[render] Concluído: ${mp4Path}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});