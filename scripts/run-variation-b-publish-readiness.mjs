import { readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");

async function importMediaBeast() {
  return import(
    pathToFileURL(join(projectRoot, "packages/media-beast/dist/index.js")).href
  );
}

function focusedAssetToCandidate(asset) {
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
    recommended: true,
    defaultSelected: true,
    importReady: true,
    previewAvailable: true,
    purpose: asset.category === "comic_panel" ? "comic_panel" : "character_art",
    suggestedSceneRole: asset.recommendedScene ?? "support",
    licenseStatus: "editorial_only",
    riskLevel: "high",
    providerTier: "comic_reference"
  };
}

async function main() {
  const beast = await importMediaBeast();
  const { buildRemixMaterializationReport, saveRemixMaterializationReport, NOT_READY_FOR_PUBLICATION } =
    beast;

  const focusedPath = join(projectRoot, "tmp", "variation-b-focused-comics-discovery-report.json");
  const planPath = join(projectRoot, "tmp", "variation-b-gated-plan.json");
  const focusedReport = JSON.parse(await readFile(focusedPath, "utf8"));
  const plan = JSON.parse(await readFile(planPath, "utf8"));

  let accepted = focusedReport.acceptedAssets ?? [];
  const themeAnalysis = beast.analyzeComicsVideoThemeFromAnalysis
    ? beast.analyzeComicsVideoThemeFromAnalysis(plan.videoAnalysis, plan.inputVideoTitle)
    : beast.analyzeComicsVideoTheme({
        videoTitle: plan.inputVideoTitle ?? plan.videoAnalysis?.contentIntelligence?.headline ?? "",
        narrationText: [
          plan.videoAnalysis?.contentIntelligence?.narrativeHook,
          plan.videoAnalysis?.contentIntelligence?.narrativeBrief
        ]
          .filter(Boolean)
          .join(" "),
        entities: plan.videoAnalysis?.contentIntelligence?.entities?.map((e) => e.name) ?? []
      });
  const videoTitle = plan.inputVideoTitle ?? plan.videoAnalysis?.contentIntelligence?.headline ?? "";
  const narrationText = [
    plan.videoAnalysis?.contentIntelligence?.narrativeHook,
    plan.videoAnalysis?.contentIntelligence?.narrativeBrief,
    ...(plan.narrationPlan?.narrationBeats?.map((beat) => beat.text) ?? [])
  ]
    .filter(Boolean)
    .join(" ");

  const cacheInvalidated = [];
  accepted = accepted.filter((asset) => {
    const verdict = beast.validateComicsAssetForTheme({
      assetTitle: asset.title,
      assetDescription: asset.category,
      assetCategory: asset.category,
      sourceType: asset.sourceUrl?.includes("catalog-panels") ? "catalog_download" : "focused_discovery",
      themeAnalysis,
      narrationText,
      videoTitle
    });
    if (verdict.severity === "reject") {
      cacheInvalidated.push(`${asset.id}:${verdict.reason}`);
      return false;
    }
    return true;
  });

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

  const providedAssets = accepted
    .filter((asset) => asset.localPath)
    .map((asset) => ({
      id: asset.id,
      title: asset.title,
      sourceUrl: asset.sourceUrl,
      localPath: asset.localPath,
      suggestedSceneRole: asset.recommendedScene ?? "support",
      origin: "provided",
      combinedScore: asset.score,
      purpose: asset.category === "comic_panel" ? "comic_panel" : "character_art"
    }));

  await writeFile(
    join(projectRoot, "tmp", "variation-b-gated-plan.json"),
    JSON.stringify(enrichedPlan, null, 2),
    "utf8"
  );

  const materialization = await buildRemixMaterializationReport({
    plan: enrichedPlan,
    allowReferenceVideoInFinal: false,
    maxAllowedSourceFootprintRatio: 0.001,
    importTopCandidates: accepted.length,
    providedAssets,
    projectRoot
  });

  await saveRemixMaterializationReport(materialization, projectRoot);

  const captioned = materialization.timelineScenes.filter((s) => s.caption?.trim()).length;
  const captionRate =
    materialization.timelineScenes.length > 0
      ? Number((captioned / materialization.timelineScenes.length).toFixed(4))
      : 0;

  const rotationStats = materialization.timelineRotationStats ?? {};
  const summary = {
    canRender: materialization.canRender,
    narrativeReady: materialization.narrativeReady,
    captionReady: materialization.captionReady,
    canPublish: materialization.canPublish,
    publishBlockReason: materialization.publishBlockReason,
    renderBlockReason: materialization.renderBlockReason,
    publishReadinessReportPath: materialization.publishReadinessReportPath,
    publishReadinessContactSheetPath: materialization.publishReadinessContactSheetPath,
    captionMaterializationRate: captionRate,
    scenesWithCaption: captioned,
    totalScenes: materialization.timelineScenes.length,
    visualDiversity: {
      uniqueAssetCount: rotationStats.uniqueAssetCount ?? 0,
      dominantAssetRatio: rotationStats.dominantAssetRatio ?? 1,
      longestStaticSegmentSec: rotationStats.longestStaticSegmentSec ?? 0,
      visualSegmentCount: rotationStats.visualSegmentCount ?? 0
    },
    placeholderUsage: materialization.placeholderUsage ?? {
      used: false,
      count: 0,
      placeholders: []
    },
    cache: {
      used: cacheInvalidated.length > 0,
      invalidatedOffThemeAssets: [
        ...cacheInvalidated,
        ...(materialization.themeFilterCache?.invalidatedOffThemeAssets ?? [])
      ]
    },
    recommendation: materialization.canPublish
      ? "ready_for_publication"
      : NOT_READY_FOR_PUBLICATION,
    mp4Blocked: !materialization.canPublish
  };

  console.log(JSON.stringify(summary, null, 2));
  console.log(`[publish-readiness] Relatório: ${materialization.publishReadinessReportPath}`);
  if (materialization.publishReadinessContactSheetPath) {
    console.log(`[publish-readiness] Contact sheet: ${materialization.publishReadinessContactSheetPath}`);
  }
  if (!materialization.canPublish) {
    console.log(`[publish-readiness] MP4 bloqueado: ${materialization.publishBlockReason ?? NOT_READY_FOR_PUBLICATION}`);
    process.exit(materialization.canRender ? 0 : 1);
  }
}

main().catch((error) => {
  console.error("[publish-readiness] FAIL");
  console.error(error);
  process.exit(1);
});