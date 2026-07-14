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

function tokenOverlap(left, right) {
  const leftWords = new Set(
    String(left ?? "")
      .toLowerCase()
      .split(/\s+/)
      .filter((word) => word.length > 3)
  );
  const rightWords = String(right ?? "")
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => word.length > 3);
  if (leftWords.size === 0 || rightWords.length === 0) return 0;
  const overlap = rightWords.filter((word) => leftWords.has(word)).length;
  return Number((overlap / rightWords.length).toFixed(2));
}

function assetOverlap(a, b) {
  const titlesA = new Set((a ?? []).map((item) => item.title?.toLowerCase?.() ?? ""));
  const titlesB = (b ?? []).map((item) => item.title?.toLowerCase?.() ?? "");
  if (titlesA.size === 0 || titlesB.length === 0) return 0;
  const shared = titlesB.filter((title) => titlesA.has(title)).length;
  return Number((shared / Math.max(titlesB.length, 1)).toFixed(2));
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

  const retention = plan.narrationPlan?.retentionMetadata ?? null;

  return {
    variationLabel: plan.variationLabel,
    targetStyle: plan.targetStyle,
    narrativeAngle,
    hookLine: plan.narrationPlan?.hookLine ?? null,
    narrationScript: plan.narrationPlan?.suggestedScript ?? null,
    narrationBeats: beats.map((b) => ({ role: b.role, text: b.text })),
    retention: retention
      ? {
          retentionEngineEnabled: retention.retentionEngineEnabled,
          usedRetentionEngine: retention.usedRetentionEngine,
          fallbackUsed: retention.fallbackUsed,
          fallbackReason: retention.fallbackReason ?? null,
          narrationScore: retention.narrationScore ?? null,
          scoreBreakdown: retention.scoreBreakdown ?? null,
          forbiddenPhrasesFound: retention.forbiddenPhrasesFound ?? [],
          estimatedDurationSec: retention.estimatedDurationSec ?? null,
          beats: retention.beats ?? null,
          voiceMetadata: retention.voiceMetadata ?? null,
          variationOverlap: retention.variationOverlap ?? null,
          angleUniquenessScore: retention.angleUniquenessScore ?? null,
          angle: retention.angle ?? null,
          truthGuard: retention.truthGuard
            ? {
                ok: retention.truthGuard.ok,
                score: retention.truthGuard.score,
                issues: retention.truthGuard.issues?.length ?? 0
              }
            : null,
          speechTiming: retention.speechTiming
            ? {
                targetDurationSec: retention.speechTiming.targetDurationSec,
                estimatedDurationSec: retention.speechTiming.estimatedDurationSec,
                differenceSec: retention.speechTiming.differenceSec
              }
            : null,
          captionDirection: retention.captionDirection
            ? {
                style: retention.captionDirection.style,
                cueCount: retention.captionDirection.cues?.length ?? 0
              }
            : null,
          upgradeWarnings: retention.upgradeWarnings ?? []
        }
      : null,
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
  const differentiation = {
    narrationOverlap: [],
    assetOverlap: []
  };

  for (let i = 0; i < variations.length; i += 1) {
    for (let j = i + 1; j < variations.length; j += 1) {
      differentiation.narrationOverlap.push({
        pair: `${variations[i].variationLabel} vs ${variations[j].variationLabel}`,
        overlap: tokenOverlap(
          variations[i].narrationScript,
          variations[j].narrationScript
        )
      });
      differentiation.assetOverlap.push({
        pair: `${variations[i].variationLabel} vs ${variations[j].variationLabel}`,
        overlap: assetOverlap(
          variations[i].suggestedAssets,
          variations[j].suggestedAssets
        )
      });
    }
  }

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
    retentionEngineEnabled: process.env.ENABLE_NARRATION_RETENTION_ENGINE === "true",
    differentiation,
    variations
  };

  const outPath = join(projectRoot, "tmp", "remix-test-report.json");
  await writeFile(outPath, JSON.stringify(report, null, 2), "utf8");
  console.log(JSON.stringify(report, null, 2));
  console.error(`[test] Relatório salvo em ${outPath}`);
}

await main();