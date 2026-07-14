import { spawn } from "node:child_process";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { safeCheckFfmpeg } from "./lib/smoke-utils.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");
const SOURCE_URL = "https://youtube.com/shorts/mfOwjnNCV1A";
const OUTPUT_BASENAME = "variation-comics-final";

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
      else reject(new Error(`${command} exited with code ${code}: ${stderr.slice(-400)}`));
    });
  });
}

function focusedAssetToCandidate(asset) {
  const purpose =
    asset.category === "comic_panel"
      ? "comic_panel"
      : asset.category === "comic_cover"
        ? "character_art"
        : "character_art";

  return {
    candidateId: asset.id,
    providerId: "comics-archive",
    title: asset.title,
    sourceUrl: asset.sourceUrl,
    previewUrl: asset.localPath ?? asset.sourceUrl,
    query: asset.title,
    score: asset.score,
    qualityScore: asset.score,
    relevanceScore: asset.score,
    combinedScore: asset.score,
    recommended: asset.score >= 75,
    defaultSelected: true,
    importReady: true,
    previewAvailable: true,
    purpose,
    suggestedSceneRole: asset.recommendedScene ?? "support",
    licenseStatus: "editorial_only",
    riskLevel: "high",
    providerTier: "comic_reference"
  };
}

function buildDiscoveryGateReport(focusedReport, materialization) {
  const readiness = materialization.timelineRotationStats ?? {};
  return {
    variation: "B — Comics",
    targetStyle: "comics",
    mode: "focused_comics_discovery_render_bridge",
    queriesUsed: focusedReport.queriesUsed,
    totalCandidatesFound: focusedReport.totalCandidatesFound,
    acceptedCount: focusedReport.acceptedCount,
    rejectedCount: focusedReport.rejectedCount,
    premiumAcceptedCount: focusedReport.premiumAcceptedCount,
    acceptedAssets: focusedReport.acceptedAssets,
    rejectedAssets: focusedReport.rejectedAssets,
    hookAsset: focusedReport.hookAsset,
    climaxAsset: focusedReport.climaxAsset,
    canRender: focusedReport.canRender && materialization.canRender,
    blockReason: materialization.canRender ? null : materialization.blockReason,
    timelineReadiness: {
      canMaterializeTimeline: materialization.canRender,
      sourceFootprintRatio: materialization.sourceFootprintRatio,
      dominantAssetRatio: readiness.dominantAssetRatio ?? 0,
      longestStaticSegmentSec: readiness.longestStaticSegmentSec ?? 0,
      uniqueAssetCount: readiness.uniqueAssetCount ?? 0,
      visualSegmentCount: readiness.visualSegmentCount ?? 0
    },
    focusedDiscoveryReportPath: join(projectRoot, "tmp", "variation-b-focused-comics-discovery-report.json"),
    generatedAt: new Date().toISOString()
  };
}

async function main() {
  const ffmpeg = await safeCheckFfmpeg(probeCommand);
  if (!ffmpeg.available) {
    throw new Error(ffmpeg.errorMessage ?? "FFmpeg não disponível.");
  }

  const beast = await importMediaBeast();
  const {
    buildRemixMaterializationReport,
    saveRemixMaterializationReport,
    renderRemixTimelineFromMaterialization,
    importRemixAssetCandidatesToDisk
  } = beast;

  const focusedPath = join(projectRoot, "tmp", "variation-b-focused-comics-discovery-report.json");
  const planPath = join(projectRoot, "tmp", "variation-b-gated-plan.json");
  const focusedReport = JSON.parse(await readFile(focusedPath, "utf8"));
  const plan = JSON.parse(await readFile(planPath, "utf8"));

  if (!focusedReport.canRender) {
    throw new Error(`Focused discovery não está pronto: ${focusedReport.blockReason ?? "unknown"}`);
  }

  const accepted = focusedReport.acceptedAssets ?? [];
  if (accepted.length < 5) {
    throw new Error(`Poucos assets aceitos (${accepted.length}) para render.`);
  }

  console.log(`[render-b-focused] ${accepted.length} assets aceitos | hook=${focusedReport.hookAsset?.title ?? "?"}`);

  const candidates = accepted.map(focusedAssetToCandidate);
  const enrichedPlan = {
    ...plan,
    assetDiscovery: {
      ...plan.assetDiscovery,
      imageSearch: {
        ...plan.assetDiscovery.imageSearch,
        executed: true,
        candidates
      }
    }
  };

  const importResults = await importRemixAssetCandidatesToDisk(candidates, {
    remixId: plan.remixId,
    headline: plan.videoAnalysis?.contentIntelligence?.headline,
    entities: plan.videoAnalysis?.contentIntelligence?.entities?.map((e) => e.name) ?? [
      "Venom",
      "Homem-Aranha"
    ],
    domain: plan.videoAnalysis?.contentIntelligence?.domain
  });

  const localPathById = new Map(
    importResults
      .filter((entry) => entry.success && entry.localPath)
      .map((entry) => [entry.candidateId, join(projectRoot, entry.localPath)])
  );

  for (const asset of accepted) {
    if (asset.localPath) {
      localPathById.set(asset.id, asset.localPath);
    }
  }

  const providedAssets = accepted
    .map((asset) => {
      const localPath = localPathById.get(asset.id);
      if (!localPath) return null;
      return {
        id: asset.id,
        title: asset.title,
        sourceUrl: asset.sourceUrl,
        localPath,
        suggestedSceneRole: asset.recommendedScene ?? "support",
        origin: "provided",
        combinedScore: asset.score,
        purpose: asset.category === "comic_panel" ? "comic_panel" : "character_art"
      };
    })
    .filter(Boolean);

  console.log(`[render-b-focused] ${providedAssets.length} assets com path local para timeline`);

  const materialization = await buildRemixMaterializationReport({
    plan: enrichedPlan,
    allowReferenceVideoInFinal: false,
    maxAllowedSourceFootprintRatio: 0.001,
    importTopCandidates: accepted.length,
    providedAssets,
    projectRoot
  });

  const materializationPath = await saveRemixMaterializationReport(materialization, projectRoot);
  console.log(`[render-b-focused] Materialização: ${materializationPath}`);

  if (!materialization.canRender) {
    console.error(
      JSON.stringify(
        {
          error: materialization.blockReason ?? "materialization_blocked",
          warnings: materialization.warnings,
          rejectedAssets: materialization.rejectedAssets?.slice(0, 8)
        },
        null,
        2
      )
    );
    process.exit(1);
  }

  if (!materialization.canPublish) {
    console.error(
      JSON.stringify(
        {
          error: materialization.publishBlockReason ?? "not_ready_for_publication",
          canRender: materialization.canRender,
          canPublish: false,
          publishReadinessReportPath: materialization.publishReadinessReportPath,
          publishReadinessContactSheetPath: materialization.publishReadinessContactSheetPath,
          mp4Blocked: true,
          recommendation: "not_ready_for_publication"
        },
        null,
        2
      )
    );
    process.exit(1);
  }

  const discoveryGatePath = join(projectRoot, "tmp", "variation-b-discovery-gate-report.json");
  await writeFile(
    discoveryGatePath,
    JSON.stringify(buildDiscoveryGateReport(focusedReport, materialization), null, 2),
    "utf8"
  );

  const gatedPlanPath = join(projectRoot, "tmp", "variation-b-gated-plan.json");
  await writeFile(gatedPlanPath, JSON.stringify(enrichedPlan, null, 2), "utf8");

  const outDir = join(projectRoot, "tmp", "remix-renders");
  await mkdir(outDir, { recursive: true });
  const outputStem = OUTPUT_BASENAME;
  const mp4Path = join(outDir, `${outputStem}.mp4`);
  const renderReportPath = join(outDir, `${outputStem}-render-report.json`);

  console.log(`[render-b-focused] FFmpeg → ${mp4Path}`);
  const renderResult = await renderRemixTimelineFromMaterialization({
    report: materialization,
    plan: enrichedPlan,
    outputPath: mp4Path,
    projectRoot,
    workDir: join(outDir, `${outputStem}-timeline-work`),
    ffmpegCommand: ffmpeg.command ?? "ffmpeg"
  });

  const finalReport = {
    generatedAt: new Date().toISOString(),
    sourceUrl: SOURCE_URL,
    targetStyle: "comics",
    variationLabel: plan.variationLabel ?? "B — Comics",
    outputPath: renderResult.outputPath,
    contactSheetPath: renderResult.contactSheetPath,
    durationSec: renderResult.totalDurationSec,
    sourceFootprintRatio: materialization.sourceFootprintRatio,
    providedAssetsUsageRatio: materialization.providedAssetsUsageRatio,
    hasAudio: renderResult.hasAudio,
    acceptedAssetsUsed: providedAssets.length,
    hookAsset: focusedReport.hookAsset?.title ?? null,
    climaxAsset: focusedReport.climaxAsset?.title ?? null,
    materializationReportPath: materializationPath,
    focusedDiscoveryReportPath: focusedPath,
    warnings: [...materialization.warnings, ...(renderResult.audioMixPlan?.warnings ?? [])]
  };

  await writeFile(renderReportPath, JSON.stringify(finalReport, null, 2), "utf8");
  await copyFile(mp4Path, join(outDir, "variation-comics.mp4"));

  console.log(JSON.stringify(finalReport, null, 2));
  console.log(`[render-b-focused] Concluído: ${mp4Path}`);
}

main().catch((error) => {
  console.error("[render-b-focused] FAIL");
  console.error(error);
  process.exit(1);
});