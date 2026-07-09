import { writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");
const SOURCE_URL = process.argv[2] ?? "https://youtube.com/shorts/mfOwjnNCV1A";

async function importMediaBeast() {
  return import(
    pathToFileURL(join(projectRoot, "packages/media-beast/dist/index.js")).href
  );
}

function getVariations(plan) {
  return [plan, ...(plan.alternativePlans ?? [])];
}

function summarizeVariation(plan) {
  const topAssets = (plan.assetDiscovery?.imageSearch?.candidates ?? [])
    .slice(0, 6)
    .map((c) => ({
      title: c.title,
      providerId: c.providerId,
      purpose: c.purpose,
      suggestedSceneRole: c.suggestedSceneRole,
      combinedScore: c.combinedScore ?? c.qualityScore ?? c.score,
      previewUrl: c.previewUrl ?? null,
      query: c.query
    }));

  const beats = plan.narrationPlan?.narrationBeats ?? [];
  const narrativeAngle =
    plan.videoAnalysis?.contentIntelligence?.curiosityAngle ??
    plan.videoAnalysis?.contentIntelligence?.narrativeHook ??
    plan.narrationPlan?.hookLine ??
    plan.videoAnalysis?.themeSummary ??
    null;

  return {
    variationLabel: plan.variationLabel,
    targetStyle: plan.targetStyle,
    narrativeAngle,
    hookLine: plan.narrationPlan?.hookLine ?? null,
    narrationScript: plan.narrationPlan?.suggestedScript ?? null,
    narrationBeats: beats.map((b) => ({ role: b.role, text: b.text })),
    curiositiesUsed: plan.narrationPlan?.narrationContext?.curiosityLines ?? [],
    editingStyle: {
      cinematicPreset: plan.cinematicPlan?.preset?.id ?? plan.cinematicPlan?.preset?.name,
      captionStyle: plan.captionPlan?.style?.id,
      fastCutCount: plan.fastCutPlan?.cutTimes?.length ?? 0,
      sceneRoles: plan.sceneStructure?.segments?.map((s) => s.role) ?? []
    },
    music: {
      presetId: plan.musicPlan?.musicPresetId,
      presetName: plan.musicPlan?.musicPresetName,
      voicePack: plan.narrationPlan?.voicePackHint
    },
    visualVariations: (plan.visualPlan?.comfyVariations ?? []).map((v) => ({
      id: v.variationId,
      style: v.style,
      workflowId: v.workflowId,
      sourceMixMode: v.sourceMixMode
    })),
    assetDiscoveryProfile: plan.assetDiscovery?.discoveryProfile ?? null,
    assetQueries: plan.assetDiscovery?.imageSearch?.queries?.slice(0, 6) ?? [],
    suggestedAssets: topAssets
  };
}

async function main() {
  const beast = await importMediaBeast();
  const { remixVideoFromSource } = beast;

  console.error(`[test] Baixando e analisando: ${SOURCE_URL}`);
  const startedAt = Date.now();

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

  const analysis = plan.videoAnalysis;
  const variations = getVariations(plan).map(summarizeVariation);

  const report = {
    sourceUrl: SOURCE_URL,
    elapsedMs: Date.now() - startedAt,
    sourceTitle: plan.inputVideoTitle,
    sourceResolution: {
      kind: plan.sourceResolution?.kind,
      platform: plan.sourceResolution?.platform,
      durationSeconds: analysis?.sourceDurationSeconds,
      outputDurationSeconds: plan.durationSeconds
    },
    videoAnalysis: {
      themeSummary: analysis?.themeSummary,
      domain: analysis?.contentIntelligence?.domain,
      domainLabel: plan.assetDiscovery?.discoveryProfile?.domainLabel,
      headline: analysis?.contentIntelligence?.headline,
      summary: analysis?.contentIntelligence?.summary,
      narrativeBrief: analysis?.contentIntelligence?.narrativeBrief,
      narrativeHook: analysis?.contentIntelligence?.narrativeHook,
      curiosityAngle: analysis?.contentIntelligence?.curiosityAngle,
      mood: analysis?.contentIntelligence?.mood,
      entities: analysis?.contentIntelligence?.entities?.map((e) => ({
        name: e.name,
        type: e.type,
        franchise: e.franchise,
        confidence: e.confidence
      })),
      actions: analysis?.contentIntelligence?.actions?.map((a) => a.label),
      visualSearchQueries: analysis?.contentIntelligence?.visualSearchQueries
    },
    titleSemantics: analysis?.contentIntelligence
      ? {
          actions: analysis.contentIntelligence.actions,
          narrativeHook: analysis.contentIntelligence.narrativeHook,
          curiosityAngle: analysis.contentIntelligence.curiosityAngle
        }
      : null,
    assetQuality: {
      totalCandidates: plan.assetDiscovery?.imageSearch?.candidates?.length ?? 0,
      withPreview: (plan.assetDiscovery?.imageSearch?.candidates ?? []).filter((c) => c.previewUrl)
        .length,
      withDirectPreview: (plan.assetDiscovery?.imageSearch?.candidates ?? []).filter(
        (c) => c.previewUrl && !String(c.previewUrl).includes("/search")
      ).length,
      topPreviewUrls: (plan.assetDiscovery?.imageSearch?.candidates ?? [])
        .slice(0, 4)
        .map((c) => c.previewUrl)
    },
    research: {
      curiosityCount: analysis?.researchDossier?.rankedCuriosities?.length ?? 0,
      topCuriosities: (analysis?.researchDossier?.rankedCuriosities ?? [])
        .slice(0, 5)
        .map((c) => ({ title: c.title, spokenLine: c.spokenLine, score: c.score }))
    },
    warnings: plan.warnings ?? [],
    variationCount: variations.length,
    variations
  };

  const outPath = join(projectRoot, "tmp", "remix-test-report.json");
  await writeFile(outPath, JSON.stringify(report, null, 2), "utf8");
  console.log(JSON.stringify(report, null, 2));
  console.error(`[test] Relatório salvo em ${outPath}`);
}

await main();