import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");
const reportPath = join(projectRoot, "tmp", "narration-retention-premium-reel-report.json");

async function importMediaBeast() {
  return import(
    pathToFileURL(join(projectRoot, "packages/media-beast/dist/index.js")).href
  );
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function makeVenomCandidate() {
  return {
    id: "candidate-venom-premium",
    providerId: "youtube",
    kind: "video",
    title: "Parceiro Perfeito — Venom e simbiose",
    sourceUrl: "",
    previewUrl: null,
    licenseStatus: "unknown",
    riskLevel: "high",
    score: 72,
    reasons: [
      "Venom surgiu numa história em que o público escolheu o design do traje preto do Homem-Aranha.",
      "Eddie Brock e o simbionte dividem o mesmo corpo nos quadrinhos Marvel."
    ],
    warnings: [],
    metadata: {
      remixContentDomain: "comics_superhero",
      remixContentHeadline: "Por que Venom e Eddie funcionam como dupla",
      remixContentSummary:
        "O simbionte e Eddie dividem o mesmo corpo com duas vozes nos quadrinhos Marvel.",
      remixNarrativeBrief:
        "O simbionte e Eddie dividem o mesmo corpo com duas vozes nos quadrinhos Marvel.",
      remixNarrativeHook: "Parceiro perfeito",
      remixCuriosityAngle:
        "Venom surgiu numa história em que o público escolheu o design do traje preto do Homem-Aranha.",
      remixEntities: "Venom, Homem-Aranha, simbionte, traje preto",
      remixPrimaryAction: "parceiro ideal e simbiose",
      remixMood: "curious"
    }
  };
}

async function main() {
  const beast = await importMediaBeast();
  const {
    buildNarrationOverlayPlan,
    buildChannelNarrationOverlay,
    generatePremiumReel,
    createChannelDNA,
    buildRetentionContextFromCandidate,
    resolveTargetStyleFromNiche,
    findRawActionLabelsInText
  } = beast;

  const candidate = makeVenomCandidate();
  const channelDNA = createChannelDNA({
    id: "premium-venom-test",
    name: "Premium Venom Test",
    niche: "comics",
    tone: "cinematic explainer",
    language: "pt-BR",
    narrationBias: "documentary_ptbr"
  });

  const results = [];

  delete process.env.ENABLE_NARRATION_RETENTION_ENGINE;
  const off = buildChannelNarrationOverlay(candidate, channelDNA, 40);
  assert(!off.retentionMetadata?.retentionEngineEnabled, "flag off: sem retention metadata");
  results.push({ test: "flag_off_overlay", passed: true, scriptLength: off.suggestedScript.length });

  process.env.ENABLE_NARRATION_RETENTION_ENGINE = "true";
  const on = buildChannelNarrationOverlay(candidate, channelDNA, 40);
  assert(on.retentionMetadata?.retentionEngineEnabled, "flag on: retention habilitada");
  assert(on.retentionMetadata?.retentionEngineAttempted, "flag on: retention tentada");
  assert(
    on.retentionMetadata?.usedRetentionEngine ||
      on.retentionMetadata?.fallbackMode === "partial_upgrade_on_legacy" ||
      on.retentionMetadata?.fallbackUsed,
    "flag on: retention ou fallback registrado"
  );
  assert(
    findRawActionLabelsInText(on.suggestedScript).length === 0,
    "premium overlay: sem action label cru"
  );
  results.push({
    test: "flag_on_overlay",
    passed: true,
    usedRetentionEngine: on.retentionMetadata?.usedRetentionEngine,
    fallbackMode: on.retentionMetadata?.fallbackMode,
    hasUpgrades: Boolean(
      on.retentionMetadata?.truthGuard &&
        on.retentionMetadata?.speechTiming &&
        on.retentionMetadata?.captionDirection
    )
  });

  const premiumPlan = generatePremiumReel({ candidate, channelDNA, durationSeconds: 40 });
  assert(
    premiumPlan.narrationPlan.retentionMetadata?.retentionEngineAttempted,
    "generatePremiumReel propaga retentionMetadata"
  );
  results.push({
    test: "generate_premium_reel",
    passed: true,
    retentionUsed: premiumPlan.narrationPlan.retentionMetadata?.usedRetentionEngine,
    fallbackMode: premiumPlan.narrationPlan.retentionMetadata?.fallbackMode
  });

  const analysis = buildRetentionContextFromCandidate({
    candidate,
    channelDNA,
    narrationContext: on.narrationContext,
    legacyBeats: on.narrationBeats,
    maxDurationSeconds: 40
  });
  assert(analysis.contentIntelligence.entities.some((e) => e.name.includes("Venom")), "bridge: Venom nas entidades");
  assert(
    resolveTargetStyleFromNiche(channelDNA.niche, on.narrationContext.videoHints) === "comics",
    "bridge: niche comics -> style comics"
  );
  results.push({
    test: "context_bridge",
    passed: true,
    entities: analysis.contentIntelligence.entities.map((e) => e.name),
    targetStyle: resolveTargetStyleFromNiche(channelDNA.niche, on.narrationContext.videoHints)
  });

  const direct = buildNarrationOverlayPlan({
    candidate,
    channelDNA,
    maxDurationSeconds: 40,
    variationIndex: 0,
    priorVariationScripts: []
  });
  assert(direct.retentionMetadata, "buildNarrationOverlayPlan com campos opcionais");
  results.push({ test: "overlay_optional_fields", passed: true });

  delete process.env.ENABLE_NARRATION_RETENTION_ENGINE;

  const payload = {
    generatedAt: new Date().toISOString(),
    results,
    summary: {
      passed: results.length,
      premiumRetentionAttempted: on.retentionMetadata?.retentionEngineAttempted,
      premiumUpgradesVisible: Boolean(
        on.retentionMetadata?.truthGuard && on.retentionMetadata?.captionDirection
      )
    },
    samples: {
      overlayScript: on.suggestedScript,
      retentionMetadata: on.retentionMetadata
    }
  };

  await mkdir(dirname(reportPath), { recursive: true });
  await writeFile(reportPath, JSON.stringify(payload, null, 2), "utf8");
  console.log("Premium reel retention report:", reportPath);
  console.log(JSON.stringify(payload.summary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});