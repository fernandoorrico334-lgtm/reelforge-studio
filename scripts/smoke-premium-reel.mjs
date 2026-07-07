import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { ensureArtifactsExist, printSmokeSummary } from "./lib/smoke-utils.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");

async function importMediaBeast() {
  return import(
    pathToFileURL(join(projectRoot, "packages/media-beast/dist/index.js")).href
  );
}

async function main() {
  await ensureArtifactsExist(
    projectRoot,
    ["packages/media-beast/dist/index.js"],
    "Run 'npm run build --workspace @reelforge/media-beast' before smoke:premium-reel."
  );

  const beast = await importMediaBeast();
  const channel = beast.createChannelDNA({
    id: "premium-true-crime",
    name: "Premium True Crime",
    niche: "true_crime",
    dailyShortTarget: 5
  });
  const candidate = {
    id: "internet-archive-premium-test",
    providerId: "internet-archive",
    kind: "webpage",
    title: "Internet Archive candidate: serial killers 1970s documentary",
    sourceUrl: "https://archive.org/search?query=serial%20killers%201970s",
    previewUrl: null,
    licenseStatus: "unknown",
    riskLevel: "medium",
    score: 58,
    reasons: ["Archive collections often include useful historical media."],
    warnings: ["Manual license review required before download/import."],
    metadata: {
      temporalLens: "past",
      searchIntent: "archival_footage",
      sourcePackHint: "true_crime"
    }
  };

  const engine = beast.createMediaBeastEngine();
  const plan = engine.generatePremiumReel(candidate, channel, {
    intensity: "extreme",
    durationSeconds: 35
  });

  if (plan.visualPlan.comfyVariations.length < 6) {
    throw new Error("Expected at least 6 premium visual variations.");
  }

  if (!plan.narrationPlan.suggestedScript.includes("serial killers")) {
    throw new Error("Expected narration script derived from candidate content.");
  }

  if (!plan.narrationPlan.narrationEnginePlan.estimatedDurationSeconds) {
    throw new Error("Expected narration engine plan integration.");
  }

  if (!plan.musicPlan.musicPresetId) {
    throw new Error("Expected music plan.");
  }

  if (plan.editingBlueprint.sceneFlow.length !== 5) {
    throw new Error("Expected 5-scene editing blueprint.");
  }

  if (plan.renderEligibility.canRenderAutomatically !== false) {
    throw new Error("Premium reel must remain candidate-first.");
  }

  printSmokeSummary({
    smoke: "premium-reel",
    status: "completed",
    productionProfile: plan.editingBlueprint.productionProfile,
    visualVariations: plan.visualPlan.comfyVariations.length,
    cinematicEffects: plan.visualPlan.cinematicEffects.length,
    cameraCues: plan.visualPlan.cameraMovements.length,
    colorGrade: plan.visualPlan.colorGrade.profileId,
    voicePack: plan.narrationPlan.voicePackHint,
    musicPreset: plan.musicPlan.musicPresetId,
    masteringPreset: plan.musicPlan.masteringPresetId,
    scenes: plan.editingBlueprint.sceneFlow.length,
    candidateFirst: true,
    canRenderAfterApproval: plan.renderEligibility.canRenderAfterManualApproval
  });
}

await main();