import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  ensureArtifactsExist,
  printSmokeSummary
} from "./lib/smoke-utils.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");

async function importHybridVisualEngine() {
  return import(
    pathToFileURL(join(projectRoot, "packages/hybrid-visual-engine/dist/index.js")).href
  );
}

async function main() {
  await ensureArtifactsExist(
    projectRoot,
    ["packages/hybrid-visual-engine/dist/index.js"],
    "Run 'npm run build --workspace @reelforge/hybrid-visual-engine' or 'npm run build' before smoke:workflow-packs."
  );

  const engine = await importHybridVisualEngine();
  const packs = engine.getComfyWorkflowPacks();
  const presets = engine.getImageQualityPresets();

  if (packs.length !== 10) {
    throw new Error(`Expected 10 workflow packs, received ${packs.length}.`);
  }

  if (presets.length !== 3) {
    throw new Error(`Expected 3 quality presets, received ${presets.length}.`);
  }

  for (const pack of packs) {
    if (!pack.recommendedPromptPackId || !pack.recommendedNegativePromptPackId) {
      throw new Error(`Pack ${pack.id} is missing prompt/negative prompt mapping.`);
    }

    if (!pack.recommendedWorkflowId) {
      throw new Error(`Pack ${pack.id} is missing recommended workflow.`);
    }
  }

  const animeSuggestion = engine.suggestWorkflowPackByNiche("anime lore sombrio");
  const sceneSuggestion = engine.suggestWorkflowPackByScene({
    id: "scene-smoke",
    order: 1,
    title: "The terrifying secret",
    narrationText: "A hidden doorway opens in the dark.",
    captionText: "The secret was waiting.",
    emotion: "HORROR",
    visualPreset: "horror"
  });
  const pack = engine.getComfyWorkflowPackById("cinematic_story");
  const quality = engine.resolveQualityPreset("standard");

  if (animeSuggestion.pack.id !== "anime_dark") {
    throw new Error(`Expected anime_dark suggestion, got ${animeSuggestion.pack.id}.`);
  }

  if (sceneSuggestion.pack.id !== "horror_tension") {
    throw new Error(`Expected horror_tension scene suggestion, got ${sceneSuggestion.pack.id}.`);
  }

  const parameters = engine.buildGenerationParameters(
    pack,
    quality,
    {
      prompt: "Smoke cinematic prompt",
      negativePrompt: "low quality",
      seed: 123,
      steps: 22,
      cfg: 3,
      sampler: "res_multistep",
      scheduler: "simple"
    },
    ["{{PROMPT}}", "{{NEGATIVE_PROMPT}}", "{{WIDTH}}", "{{HEIGHT}}", "{{SEED}}"]
  );

  if (parameters.appliedParameters["{{SEED}}"] !== 123) {
    throw new Error("Seed was not applied to supported placeholder metadata.");
  }

  if (!("{{STEPS}}" in parameters.ignoredParameters)) {
    throw new Error("Missing placeholder metadata did not capture ignored steps.");
  }

  printSmokeSummary({
    packs: packs.length,
    presets: presets.length,
    animeSuggestion: animeSuggestion.pack.id,
    sceneSuggestion: sceneSuggestion.pack.id,
    ignoredParameters: Object.keys(parameters.ignoredParameters).length,
    status: "completed"
  });
}

await main();
