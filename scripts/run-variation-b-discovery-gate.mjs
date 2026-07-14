import { readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { listMediaBeastProviders } from "../packages/media-beast/dist/providers/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");

const PREMIUM_QUERIES = [
  "Venom Spider-Man comic panel",
  "Venom symbiote comic cover",
  "Spider-Man black suit comic panel",
  "Venom Eddie Brock comic art",
  "Venom vs Spider-Man comic",
  "Marvel Venom symbiote comic cover"
];

const HOOK_CLIMAX_MIN_SCORE = 75;
const PREMIUM_CATEGORIES = new Set(["comic_panel", "comic_cover", "character_art"]);

async function importMediaBeast() {
  return import(
    pathToFileURL(join(projectRoot, "packages/media-beast/dist/index.js")).href
  );
}

async function importAssetApiClients() {
  return import(
    pathToFileURL(
      join(projectRoot, "packages/media-beast/dist/providers/asset-api-clients.js")
    ).href
  );
}

function computeTimelineReadiness(timelineScenes, sourceFootprintRatio) {
  const visualSegments = timelineScenes.filter(
    (scene) =>
      scene.assetPath &&
      scene.visualSourceType !== "placeholder" &&
      scene.visualSourceType !== "reference_video"
  );

  const assetDuration = new Map();
  let longestStaticSegmentSec = 0;
  let currentAssetId = null;
  let currentRunSec = 0;

  for (const scene of timelineScenes) {
    const duration = Math.max(0.01, scene.endSec - scene.startSec);
    const assetId = scene.assetId ?? "__placeholder__";

    if (scene.assetPath && assetId !== "__placeholder__") {
      assetDuration.set(assetId, (assetDuration.get(assetId) ?? 0) + duration);
    }

    if (assetId !== "__placeholder__" && assetId === currentAssetId) {
      currentRunSec += duration;
    } else {
      longestStaticSegmentSec = Math.max(longestStaticSegmentSec, currentRunSec);
      currentAssetId = assetId === "__placeholder__" ? null : assetId;
      currentRunSec = assetId === "__placeholder__" ? 0 : duration;
    }
  }
  longestStaticSegmentSec = Math.max(longestStaticSegmentSec, currentRunSec);

  const visualSegmentCount = visualSegments.length;
  const uniqueAssetCount = new Set(visualSegments.map((scene) => scene.assetId).filter(Boolean))
    .size;
  const totalVisualDuration = visualSegments.reduce(
    (sum, scene) => sum + Math.max(0.01, scene.endSec - scene.startSec),
    0
  );
  const maxAssetDuration = Math.max(
    0,
    ...[...assetDuration.values()].map((value) => value)
  );
  const dominantAssetRatio =
    totalVisualDuration > 0 ? maxAssetDuration / totalVisualDuration : 1;

  const canMaterializeTimeline =
    visualSegmentCount >= 5 &&
    uniqueAssetCount >= 3 &&
    dominantAssetRatio <= 0.4 &&
    longestStaticSegmentSec <= 6 &&
    sourceFootprintRatio <= 0.2;

  return {
    canMaterializeTimeline,
    visualSegmentCount,
    uniqueAssetCount,
    dominantAssetRatio: Number(dominantAssetRatio.toFixed(4)),
    longestStaticSegmentSec: Number(longestStaticSegmentSec.toFixed(2)),
    sourceFootprintRatio: Number(sourceFootprintRatio.toFixed(4))
  };
}

function purposeToScene(purpose, score) {
  if (score >= HOOK_CLIMAX_MIN_SCORE && purpose === "comic_panel") return "hook";
  if (score >= HOOK_CLIMAX_MIN_SCORE && purpose === "character_art") return "climax";
  if (purpose === "comic_panel") return "evidence";
  if (purpose === "character_art") return "context";
  return "support";
}

function isPremiumQuality(quality) {
  return (
    quality.ok &&
    quality.score >= HOOK_CLIMAX_MIN_SCORE &&
    PREMIUM_CATEGORIES.has(quality.category)
  );
}

async function searchPremiumQueries(analysis, entities) {
  const { searchDirectAssetBundle } = await importAssetApiClients();
  const entityTerms = entities.map((entity) => entity.name.toLowerCase());
  const candidateMap = new Map();

  const bundles = await Promise.all(
    PREMIUM_QUERIES.map((query) =>
      searchDirectAssetBundle({
        query,
        maxPerSource: 6,
        entityTerms,
        includeFlickr: true,
        domain: "comics_superhero"
      })
    )
  );

  for (const group of bundles) {
    for (const candidate of group) {
      candidateMap.set(candidate.id, candidate);
    }
  }

  const strategyProviderIds = [
    "comics-archive",
    "internet-archive",
    "flickr",
    "google-images",
    "generic-web"
  ];
  const providers = listMediaBeastProviders().filter(
    (provider) =>
      provider.descriptor.enabled &&
      strategyProviderIds.includes(provider.descriptor.id) &&
      provider.descriptor.id !== "google-images" &&
      provider.descriptor.id !== "generic-web"
  );

  for (const query of PREMIUM_QUERIES) {
    const groups = await Promise.all(
      providers.map((provider) =>
        provider.searchCandidates({
          keywords: query.split(/\s+/).filter((token) => token.length > 2),
          niche: "comics",
          maxCandidates: 6
        })
      )
    );
    for (const group of groups) {
      for (const candidate of group) {
        candidateMap.set(candidate.id, {
          ...candidate,
          metadata: {
            ...candidate.metadata,
            query
          }
        });
      }
    }
  }

  return [...candidateMap.values()];
}

async function main() {
  const beast = await importMediaBeast();
  const {
    discoverRemixAssetCandidates,
    rankRemixAssetCandidates,
    evaluateComicsAssetQuality,
    buildRemixMaterializationReport,
    candidateToAssetLike,
    enrichAndScoreCandidates
  } = beast;

  const planPath = join(projectRoot, "tmp", "remix-renders", "variation-comics-full-plan.json");
  const plan = JSON.parse(await readFile(planPath, "utf8"));
  const analysis = plan.videoAnalysis;
  const entities =
    analysis.contentIntelligence?.entities?.map((entity) => entity.name) ?? [
      "Venom",
      "Homem-Aranha"
    ];

  console.log("[discovery-gate] Carregando plano cached: Variação B — Comics");
  console.log("[discovery-gate] Executando discovery com queries premium...");

  const [pipelineDiscovery, premiumRawCandidates] = await Promise.all([
    discoverRemixAssetCandidates({
      analysis,
      niche: "comics",
      maxCandidatesPerQuery: 6,
      maxQueries: 14
    }),
    searchPremiumQueries(analysis, analysis.contentIntelligence.entities)
  ]);

  const candidateMap = new Map();
  for (const candidate of [
    ...pipelineDiscovery.candidates,
    ...premiumRawCandidates
  ]) {
    candidateMap.set(candidate.id, candidate);
  }

  let enrichmentWarnings = [];
  if (typeof enrichAndScoreCandidates === "function") {
    const enrichment = await enrichAndScoreCandidates([...candidateMap.values()], {
      query: analysis.contentIntelligence.headline,
      minScore: 20,
      enrichRemote: true,
      maxRemoteFetches: 24
    });
    enrichmentWarnings = enrichment.warnings;
    for (const candidate of enrichment.candidates) {
      candidateMap.set(candidate.id, candidate);
    }
  }

  const allRawCandidates = [...candidateMap.values()];
  const rankedCandidates = rankRemixAssetCandidates(allRawCandidates, analysis, {
    niche: "comics"
  });

  const queriesUsed = [
    ...new Set([
      ...PREMIUM_QUERIES,
      ...pipelineDiscovery.queriesExecuted,
      ...rankedCandidates.map((candidate) => candidate.query).filter(Boolean)
    ])
  ].filter((query) => query && query.length > 4);

  const acceptedAssets = [];
  const rejectedAssets = [];

  for (const candidate of rankedCandidates) {
    const quality = evaluateComicsAssetQuality({
      title: candidate.title,
      description: candidate.purpose,
      sourceUrl: candidate.sourceUrl,
      query: candidate.query,
      entities,
      franchise: analysis.contentIntelligence.entities[0]?.franchise ?? "Marvel",
      targetStyle: "comics"
    });

    const entry = {
      id: candidate.candidateId,
      title: candidate.title,
      sourceUrl: candidate.sourceUrl,
      score: quality.score,
      category: quality.category,
      combinedScore: candidate.combinedScore,
      positiveSignals: quality.positiveSignals,
      negativeSignals: quality.negativeSignals,
      rejectReason: quality.rejectReason ?? null
    };

    if (quality.ok) {
      acceptedAssets.push({
        ...entry,
        recommendedScene: purposeToScene(candidate.purpose, quality.score)
      });
    } else {
      rejectedAssets.push(entry);
    }
  }

  acceptedAssets.sort((left, right) => right.score - left.score);
  rejectedAssets.sort((left, right) => right.score - left.score);

  const premiumAccepted = acceptedAssets.filter((asset) => asset.score >= HOOK_CLIMAX_MIN_SCORE);
  const gatedPlan = {
    ...plan,
    assetDiscovery: {
      ...plan.assetDiscovery,
      imageSearch: {
        ...plan.assetDiscovery.imageSearch,
        queries: queriesUsed,
        executed: true,
        candidates: rankedCandidates
      }
    }
  };

  console.log("[discovery-gate] Materializando timeline (sem render)...");
  const materialization = await buildRemixMaterializationReport({
    plan: gatedPlan,
    allowReferenceVideoInFinal: false,
    importTopCandidates: 12,
    projectRoot
  });

  let comicsReport = null;
  if (materialization.comicsAssetSelectionReportPath) {
    comicsReport = JSON.parse(
      await readFile(materialization.comicsAssetSelectionReportPath, "utf8")
    );
  }

  const timelineReadiness =
    materialization.timelineRotationStats != null
      ? {
          canMaterializeTimeline: materialization.canRender,
          ...materialization.timelineRotationStats,
          sourceFootprintRatio: materialization.sourceFootprintRatio
        }
      : computeTimelineReadiness(
          materialization.timelineScenes,
          materialization.sourceFootprintRatio
        );

  const hookAsset =
    comicsReport?.hookAsset ??
    (materialization.timelineScenes.find((scene) => scene.sceneRole === "hook")?.assetId
      ? acceptedAssets.find(
          (asset) =>
            asset.id ===
            materialization.timelineScenes.find((scene) => scene.sceneRole === "hook")?.assetId
        ) ?? null
      : null);

  const climaxAsset =
    comicsReport?.climaxAsset ??
    (materialization.timelineScenes.find((scene) => scene.sceneRole === "climax")?.assetId
      ? acceptedAssets.find(
          (asset) =>
            asset.id ===
            materialization.timelineScenes.find((scene) => scene.sceneRole === "climax")?.assetId
        ) ?? null
      : null);

  const warnings = [
    ...pipelineDiscovery.warnings,
    ...enrichmentWarnings,
    ...materialization.warnings,
    ...(comicsReport?.warnings ?? [])
  ];

  const hasHookPremium = Boolean(
    hookAsset &&
      hookAsset.score >= HOOK_CLIMAX_MIN_SCORE &&
      PREMIUM_CATEGORIES.has(hookAsset.category)
  );
  const hasClimaxPremium = Boolean(
    climaxAsset &&
      climaxAsset.score >= HOOK_CLIMAX_MIN_SCORE &&
      PREMIUM_CATEGORIES.has(climaxAsset.category)
  );

  const visualAuditReport = materialization.visualAssetAuditReportPath
    ? JSON.parse(await readFile(materialization.visualAssetAuditReportPath, "utf8"))
    : null;

  const canRender =
    premiumAccepted.length >= 3 &&
    hasHookPremium &&
    hasClimaxPremium &&
    timelineReadiness.canMaterializeTimeline &&
    materialization.canRender &&
    (visualAuditReport?.canRender ?? false);

  let blockReason = null;
  if (premiumAccepted.length < 3) {
    blockReason = "insufficient_premium_assets_score_75";
  } else if (!hasHookPremium) {
    blockReason = "hook_asset_missing_or_below_threshold";
  } else if (!hasClimaxPremium) {
    blockReason = "climax_asset_missing_or_below_threshold";
  } else if (!timelineReadiness.canMaterializeTimeline) {
    blockReason = "timeline_not_ready";
  } else if (!materialization.canRender) {
    blockReason = materialization.blockReason;
  } else if (visualAuditReport && !visualAuditReport.canRender) {
    blockReason = visualAuditReport.blockReason ?? "visual_asset_audit_failed";
  }

  const report = {
    variation: "B — Comics",
    targetStyle: "comics",
    queriesUsed,
    totalCandidatesFound: rankedCandidates.length,
    acceptedCount: acceptedAssets.length,
    rejectedCount: rejectedAssets.length,
    premiumAcceptedCount: premiumAccepted.length,
    acceptedAssets: acceptedAssets.map((asset) => ({
      title: asset.title,
      sourceUrl: asset.sourceUrl,
      score: asset.score,
      category: asset.category,
      recommendedScene: asset.recommendedScene,
      positiveSignals: asset.positiveSignals
    })),
    rejectedAssets: rejectedAssets.map((asset) => ({
      title: asset.title,
      sourceUrl: asset.sourceUrl,
      score: asset.score,
      category: asset.category,
      rejectReason: asset.rejectReason,
      negativeSignals: asset.negativeSignals
    })),
    hookAsset: hookAsset
      ? {
          title: hookAsset.title,
          sourceUrl: hookAsset.sourceUrl,
          score: hookAsset.score,
          category: hookAsset.category,
          positiveSignals: hookAsset.positiveSignals ?? []
        }
      : null,
    climaxAsset: climaxAsset
      ? {
          title: climaxAsset.title,
          sourceUrl: climaxAsset.sourceUrl,
          score: climaxAsset.score,
          category: climaxAsset.category,
          positiveSignals: climaxAsset.positiveSignals ?? []
        }
      : null,
    timelineReadiness,
    canRender,
    blockReason,
    warnings: [...new Set(warnings)],
    visualAssetAudit: visualAuditReport
      ? {
          trueComicsAssetCount: visualAuditReport.trueComicsAssetCount,
          forbiddenAssetCount: visualAuditReport.forbiddenAssetCount,
          hasForbiddenTerms: visualAuditReport.hasForbiddenTerms,
          hookPremium: visualAuditReport.hookPremium,
          climaxPremium: visualAuditReport.climaxPremium,
          contactSheetPath: visualAuditReport.contactSheetPath,
          reportPath: materialization.visualAssetAuditReportPath,
          canRender: visualAuditReport.canRender,
          blockReason: visualAuditReport.blockReason
        }
      : null,
    materializationSummary: {
      sourceFootprintRatio: materialization.sourceFootprintRatio,
      providedAssetsUsageRatio: materialization.providedAssetsUsageRatio,
      approvedAssetsUsed: materialization.approvedAssetsUsed,
      timelineMode: materialization.timelineMode,
      materializedFastCutCount: materialization.materializedFastCutCount,
      comicsAssetSelectionReportPath: materialization.comicsAssetSelectionReportPath,
      visualAssetAuditReportPath: materialization.visualAssetAuditReportPath,
      visualAssetContactSheetPath: materialization.visualAssetContactSheetPath,
      assetRotationReportPath: materialization.assetRotationReportPath,
      timelineRotationStats: materialization.timelineRotationStats
    },
    recommendation: canRender
      ? "ready_to_render_after_manual_review"
      : "continue_discovery_or_provide_premium_assets"
  };

  const outputPath = join(projectRoot, "tmp", "variation-b-discovery-gate-report.json");
  const gatedPlanPath = join(projectRoot, "tmp", "variation-b-gated-plan.json");
  await writeFile(outputPath, JSON.stringify(report, null, 2), "utf8");
  await writeFile(gatedPlanPath, JSON.stringify(gatedPlan, null, 2), "utf8");

  console.log(JSON.stringify(report, null, 2));
  console.log(`[discovery-gate] Relatório salvo: ${outputPath}`);
  console.log(
    `[discovery-gate] Resumo: ${report.totalCandidatesFound} candidatos | ${report.acceptedCount} aceitos | ${report.rejectedCount} rejeitados | canRender=${report.canRender}`
  );
}

main().catch((error) => {
  console.error("[discovery-gate] FAIL");
  console.error(error);
  process.exit(1);
});