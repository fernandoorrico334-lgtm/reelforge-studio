import { writeFile } from "node:fs/promises";
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
    "Run 'npm run build --workspace @reelforge/media-beast' before smoke:remix-video."
  );

  const sampleVideoPath = join(projectRoot, "tmp", "smoke-remix-source.mp4");
  await writeFile(sampleVideoPath, "smoke-remix-placeholder");

  const beast = await importMediaBeast();
  const engine = beast.createMediaBeastEngine();
  const plan = await engine.remixExistingVideo(sampleVideoPath, {
    targetStyle: "dark_cinematic",
    intensity: "extreme",
    durationTarget: 30
  });

  if (!plan.approvalGate.candidateFirst) {
    throw new Error("Remix plan must remain candidate-first.");
  }

  if (plan.approvalGate.canRenderAutomatically !== false) {
    throw new Error("Remix must never auto-render.");
  }

  if (!plan.cinematicPlan.preset.id) {
    throw new Error("Expected cinematic engine integration.");
  }

  if (!plan.captionPlan.style.id) {
    throw new Error("Expected caption engine integration.");
  }

  if (!plan.musicPlan.musicPresetId) {
    throw new Error("Expected auto-recommended music preset.");
  }

  if (!plan.sourceResolution?.localPath) {
    throw new Error("Expected sourceResolution.localPath.");
  }

  if (plan.renderBlueprint.stages.length < 8) {
    throw new Error("Expected multi-stage render blueprint with ComfyUI stages.");
  }

  if (!plan.sceneStructure?.segments?.length) {
    throw new Error("Expected aggressive scene restructure segments.");
  }

  if (!plan.aggressiveTransform?.comfyVariationCount) {
    throw new Error("Expected aggressive transform metadata.");
  }

  if (!plan.videoAnalysis?.themeSummary) {
    throw new Error("Expected video analysis with theme summary.");
  }

  if (!plan.videoAnalysis.contentIntelligence?.analysisVersion) {
    throw new Error("Expected Phase 2 content intelligence.");
  }

  if (!plan.videoAnalysis.researchDossier?.rankedCuriosities?.length) {
    throw new Error("Expected Research Collector dossier with ranked curiosities.");
  }

  if (!plan.assetDiscovery.comfyui.contextualPrompts?.length) {
    throw new Error("Expected ComfyUI contextual prompts.");
  }

  if (!plan.variationLabel) {
    throw new Error("Expected variation label on remix plan.");
  }

  if (plan.durationSeconds > 45) {
    throw new Error(`Remix output must be <= 45s, got ${plan.durationSeconds}.`);
  }

  if (!plan.assetDiscovery?.comfyui?.variationCount) {
    throw new Error("Expected asset discovery plan with ComfyUI variations.");
  }

  if (!plan.narrationPlan?.suggestedScript?.trim()) {
    throw new Error("Expected rewritten narration script.");
  }

  const narrationWordCount = plan.narrationPlan.suggestedScript
    .split(/\s+/)
    .filter(Boolean).length;
  const minWords = Math.round(plan.durationSeconds * 1.5);
  if (narrationWordCount < minWords) {
    throw new Error(
      `Narration too short for ${plan.durationSeconds}s: ${narrationWordCount} words (min ${minWords}).`
    );
  }

  printSmokeSummary({
    smoke: "remix-video",
    status: "completed",
    remixId: plan.remixId,
    targetStyle: plan.targetStyle,
    cinematicPreset: plan.cinematicPlan.preset.id,
    captionStyle: plan.captionPlan.style.id,
    musicPreset: plan.musicPlan.musicPresetId,
    visualVariations: plan.visualPlan.comfyVariations.length,
    renderStages: plan.renderBlueprint.stages.length,
    candidateFirst: plan.approvalGate.candidateFirst,
    canRenderAfterApproval: plan.approvalGate.canRenderAfterManualApproval,
    sourceDuration: plan.videoAnalysis.sourceDurationSeconds,
    outputDuration: plan.durationSeconds,
    themeSummary: plan.videoAnalysis.themeSummary,
    imageQueries: plan.assetDiscovery.imageSearch.queries.length,
    sourceKind: plan.sourceResolution.kind,
    recommendedMusic: plan.musicPlan.musicPresetId
  });
}

await main();