import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  ensureArtifactsExist,
  printSmokeSummary
} from "./lib/smoke-utils.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");

async function importMediaBeast() {
  return import(
    pathToFileURL(join(projectRoot, "packages/media-beast/dist/index.js")).href
  );
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  await ensureArtifactsExist(
    projectRoot,
    ["packages/media-beast/dist/index.js"],
    "Run 'npm run build --workspace @reelforge/media-beast' or 'npm run build' before smoke:media-beast."
  );

  const beast = await importMediaBeast();
  const engine = beast.createMediaBeastEngine();
  const trueCrimeChannel = beast.createChannelDNA({
    id: "smoke-true-crime",
    name: "Smoke True Crime",
    niche: "true_crime",
    dailyShortTarget: 5
  });
  const footballChannel = beast.createChannelDNA({
    id: "smoke-football",
    name: "Smoke Futebol Antigo",
    niche: "vintage_football",
    dailyShortTarget: 5
  });

  const trueCrimeResult = await engine.discoverAndTransform(
    "serial killers 1970s",
    ["true_crime"],
    5,
    trueCrimeChannel,
    "extreme"
  );
  const footballResult = await engine.discoverAndTransform(
    "craques antigos copa do mundo",
    ["vintage_football"],
    5,
    footballChannel,
    "extreme"
  );
  const distributed = beast.distributeDailyBeastPlans({
    channels: [trueCrimeChannel, footballChannel],
    candidates: [...trueCrimeResult.candidates, ...footballResult.candidates],
    countPerChannel: 5
  });

  assert(trueCrimeResult.candidates.length > 0, "Expected true-crime candidates.");
  assert(footballResult.candidates.length > 0, "Expected football candidates.");
  assert(
    trueCrimeResult.reelPlans.length === trueCrimeResult.candidates.length,
    "Expected one true-crime reel plan per candidate."
  );
  assert(
    footballResult.reelPlans.length === footballResult.candidates.length,
    "Expected one football reel plan per candidate."
  );
  assert(distributed.totalAssignments === 10, "Expected 10 distributed assignments.");
  assert(
    [...trueCrimeResult.safetyReview, ...footballResult.safetyReview].every(
      (review) => review.allowedForAutoImport === false
    ),
    "Media Beast must remain candidate-first with no auto import."
  );

  const firstPlan = trueCrimeResult.reelPlans[0];
  const footballPlan = footballResult.reelPlans[0];
  assert(firstPlan?.visualPlan.comfyVariations.length > 0, "Expected ComfyUI variation plan.");
  assert(
    firstPlan?.visualPlan.randomizationProfile.intensity === "extreme",
    "Expected true-crime visual intensity extreme."
  );
  assert(
    footballPlan?.visualPlan.randomizationProfile.intensity === "extreme",
    "Expected football visual intensity extreme."
  );
  assert(firstPlan?.fastCutPlan.transitionSequence.length > 0, "Expected fast-cut transition plan.");
  assert(
    firstPlan?.renderEligibility.canRenderAutomatically === false,
    "Media Beast must not render automatically."
  );

  printSmokeSummary({
    smoke: "media-beast",
    status: "completed",
    channels: [trueCrimeChannel.id, footballChannel.id],
    intensity: "extreme",
    candidates: trueCrimeResult.candidates.length + footballResult.candidates.length,
    reelPlans: trueCrimeResult.reelPlans.length + footballResult.reelPlans.length,
    providers: [
      ...new Set(
        [...trueCrimeResult.candidates, ...footballResult.candidates].map(
          (candidate) => candidate.providerId
        )
      )
    ],
    dailySlots: distributed.totalAssignments,
    candidateFirst: true,
    firstCandidateId: trueCrimeResult.candidates[0]?.id ?? null,
    firstRiskLevel: trueCrimeResult.safetyReview[0]?.riskLevel ?? null,
    firstVisualVariations: firstPlan?.visualPlan.comfyVariations.length ?? 0
  });
}

await main();
