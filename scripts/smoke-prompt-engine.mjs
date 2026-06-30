import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  ensureArtifactsExist,
  printSmokeSummary
} from "./lib/smoke-utils.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");

async function importPromptEngine() {
  return import(
    pathToFileURL(join(projectRoot, "packages/prompt-engine/dist/index.js")).href
  );
}

async function main() {
  await ensureArtifactsExist(
    projectRoot,
    ["packages/prompt-engine/dist/index.js"],
    "Run 'npm run build --workspace @reelforge/prompt-engine' or 'npm run build' before smoke:prompt-engine."
  );

  const promptEngine = await importPromptEngine();

  const channel = {
    id: "smoke-channel-premium",
    name: "Smoke Prompt Ops",
    niche: "dark documentary mystery",
    visualStyle: "editorial noir, disciplined lighting, clean evidence framing",
    narrativeTone: "investigative and dramatic",
    defaultTemplate: "mystery_doc"
  };
  const characterProfile = {
    id: "smoke-character-archivist",
    name: "Archive Host",
    franchise: "Internal Smoke Files",
    description:
      "calm archivist host with sharp posture, formal wardrobe and analytical gaze",
    basePrompt:
      "archival documentary host, premium vertical portrait, teal practical light",
    negativePrompt:
      "watermark, bad anatomy, random text, logo, low detail",
    styleNotes:
      "clean documentary realism, archive room atmosphere, controlled shadow depth",
    defaultVisualStyle: "mystery",
    tags: ["archive", "host", "mystery", "documentary"],
    references: [
      {
        title: "Reference still",
        notes: "User provided face reference with cold light and desk setup.",
        referenceType: "face",
        tags: ["portrait", "archive", "reference"]
      }
    ]
  };
  const project = {
    id: "smoke-project-prompt-engine",
    title: "Smoke Prompt Engine Project",
    script:
      "A host unveils the hidden archive and frames the first key clue in a vertical mystery reel.",
    format: "9:16",
    templateId: "mystery_doc"
  };
  const scene = {
    id: "smoke-scene-hook",
    title: "The first archive clue",
    narrationText:
      "The host opens the file drawer and finds the only photograph that survived the blackout.",
    captionText: "Only one clue remained",
    emotion: "MYSTERIOUS",
    visualPreset: "mystery",
    energyLevel: 78,
    visualPrompt: null,
    negativePrompt: null
  };

  const promptResult = promptEngine.buildVisualPrompt({
    scene,
    project,
    channel,
    characterProfile,
    promptPackId: "mystery_doc",
    negativePackId: "clean_documentary",
    variantType: "documentary-evidence-frame",
    supportTags: ["archive", "evidence", "blackout", "vertical"]
  });
  const negativePromptResult = promptEngine.buildNegativePrompt({
    scene,
    project,
    channel,
    characterProfile,
    promptPackId: "mystery_doc",
    negativePackId: "clean_documentary",
    variantType: "documentary-evidence-frame",
    supportTags: ["archive", "evidence", "blackout", "vertical"]
  });
  const variants = promptEngine.buildPromptVariants(
    {
      scene,
      project,
      channel,
      characterProfile,
      promptPackId: "mystery_doc",
      negativePackId: "clean_documentary",
      supportTags: ["archive", "evidence", "blackout", "vertical"]
    },
    5
  );
  const qualityAnalysis = promptEngine.analyzePromptQuality(
    promptResult.prompt,
    promptResult.context
  );

  const appliedScene = {
    ...scene,
    visualPrompt: promptResult.prompt,
    negativePrompt: negativePromptResult.negativePrompt,
    visualRecipe: JSON.stringify({
      promptPackId: promptResult.promptPack.id,
      negativePackId: promptResult.negativePromptPack.id,
      promptQualityScore: qualityAnalysis.overallScore,
      promptPlanSummary: promptResult.promptPlanSummary,
      promptVariantId: variants[0]?.id ?? null
    })
  };

  if (!promptResult.prompt.trim()) {
    throw new Error("Prompt result is empty.");
  }

  if (!negativePromptResult.negativePrompt.trim()) {
    throw new Error("Negative prompt result is empty.");
  }

  if (variants.length < 1) {
    throw new Error("Prompt variants were not generated.");
  }

  if (typeof qualityAnalysis.overallScore !== "number") {
    throw new Error("Prompt quality score is missing.");
  }

  if (appliedScene.visualPrompt !== promptResult.prompt) {
    throw new Error("Scene visualPrompt was not updated.");
  }

  const recipe = JSON.parse(appliedScene.visualRecipe);

  if (recipe.promptPackId !== promptResult.promptPack.id) {
    throw new Error("visualRecipe did not persist promptPackId.");
  }

  printSmokeSummary({
    projectId: project.id,
    sceneId: scene.id,
    promptPackId: promptResult.promptPack.id,
    qualityScore: qualityAnalysis.overallScore,
    variantCount: variants.length,
    status: "completed"
  });
}

await main();