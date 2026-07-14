import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");
const reportPath = join(projectRoot, "tmp", "narration-fallback-upgrades-report.json");

async function importMediaBeast() {
  return import(
    pathToFileURL(join(projectRoot, "packages/media-beast/dist/index.js")).href
  );
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function makeVenomLegacyBeats() {
  return [
    {
      role: "hook",
      text: "Olha só: aqui aparece Venom encontrando parceiro perfeito.",
      caption: "Olha só: aqui aparece Venom",
      curiosityTag: "hook"
    },
    {
      role: "context",
      text: "O corte mostra Venom e o simbionte no traje preto em confronto.",
      caption: "O corte mostra Venom",
      curiosityTag: "context"
    },
    {
      role: "tension",
      text: "Essa dupla funciona por causa de parceiro ideal e simbiose.",
      caption: "Essa dupla funciona",
      curiosityTag: "tension"
    },
    {
      role: "climax",
      text:
        "Venom surgiu numa história em que o público escolheu o design do traje preto do Homem-Aranha.",
      caption: "Venom surgiu numa história",
      curiosityTag: "climax"
    },
    {
      role: "cta",
      text: "Volta no começo e repara no mesmo gesto.",
      caption: "Volta no começo",
      curiosityTag: "cta"
    }
  ];
}

function makeVenomAnalysis() {
  return {
    sourceDurationSeconds: 42,
    outputDurationSeconds: 40,
    probeMethod: "estimated",
    platform: "youtube",
    title: "Parceiro Perfeito",
    themeSummary:
      "Venom e o simbionte dividem o corpo com duas vozes — parceiro perfeito e simbiose nos quadrinhos Marvel.",
    contextKeywords: ["venom", "simbionte", "homem-aranha", "traje preto"],
    mainScenes: [],
    narrativeArc: ["Venom parceiro perfeito simbiose"],
    analysisNotes: [],
    researchDossier: null,
    contentIntelligence: {
      domain: "comics_superhero",
      headline: "Por que Venom e Eddie funcionam como dupla",
      summary:
        "O simbionte e Eddie dividem o mesmo corpo com duas vozes nos quadrinhos Marvel.",
      narrativeBrief:
        "O simbionte e Eddie dividem o mesmo corpo com duas vozes nos quadrinhos Marvel.",
      narrativeHook: "Parceiro perfeito",
      curiosityAngle:
        "Venom surgiu numa história em que o público escolheu o design do traje preto do Homem-Aranha.",
      setting: null,
      mood: "curious",
      entities: [
        { id: "e1", name: "Venom", type: "character", franchise: "Marvel", confidence: 0.95 },
        {
          id: "e2",
          name: "Homem-Aranha",
          type: "character",
          franchise: "Marvel",
          confidence: 0.95
        },
        { id: "e3", name: "simbionte", type: "concept", franchise: null, confidence: 0.9 },
        { id: "e4", name: "traje preto", type: "concept", franchise: null, confidence: 0.85 }
      ],
      actions: [{ label: "parceiro ideal e simbiose", verb: "mostrar", confidence: 0.9 }],
      visualSearchQueries: ["simbionte", "traje preto"],
      sceneInsights: [
        {
          role: "hook",
          narrationAngle: "close no rosto",
          focusEntity: "Venom",
          visualHint: "close no rosto do simbionte"
        },
        {
          role: "climax",
          narrationAngle: "concurso de arte",
          focusEntity: "Homem-Aranha",
          visualHint: "fã escolhendo design do traje preto"
        }
      ]
    }
  };
}

const VARIATIONS = [
  { variation: "A", angle: "documentary", targetStyle: "documentary", variationIndex: 0 },
  { variation: "B", angle: "comics", targetStyle: "comics", variationIndex: 1 },
  { variation: "C", angle: "dark cinematic", targetStyle: "dark_cinematic", variationIndex: 2 }
];

async function main() {
  const beast = await importMediaBeast();
  const {
    refineRemixNarrationWithRetention,
    buildAuthorizedNarrationContext,
    buildRemixAllowedFactsCorpus,
    detectHallucinations,
    validateNarrationTruth,
    oralizeActionLabelsInNarration,
    findRawActionLabelsInText,
    validateBeatTimingSoft,
    findForbiddenPhrases,
    getNarrationStylePack,
    classifyNarrationSubject,
    buildRemixRetentionInput
  } = beast;

  process.env.ENABLE_NARRATION_RETENTION_ENGINE = "true";

  const legacyBeats = makeVenomLegacyBeats();
  const legacyScript = legacyBeats.map((beat) => beat.text).join("\n");
  const analysis = makeVenomAnalysis();
  const corpus = buildRemixAllowedFactsCorpus(analysis, legacyBeats);
  const authorizedContext = buildAuthorizedNarrationContext({
    facts: [
      "Venom surgiu numa história em que o público escolheu o design do traje preto do Homem-Aranha.",
      "Eddie Brock e o simbionte dividem o mesmo corpo nos quadrinhos Marvel."
    ],
    curiosityFacts: [
      "Venom surgiu numa história em que o público escolheu o design do traje preto do Homem-Aranha."
    ],
    visualDescription: "close no rosto do simbionte; fã escolhendo design do traje preto",
    allowedContext: [analysis.themeSummary, analysis.contentIntelligence.narrativeBrief],
    contentIntelligence: analysis.contentIntelligence,
    topic: analysis.title,
    title: analysis.title,
    tags: analysis.contextKeywords
  });

  const unitResults = [];

  // 1) Entidade autorizada não gera hallucination
  const homemAranhaHallucination = detectHallucinations(
    "Homem-Aranha aparece no traje preto com Venom.",
    corpus
  );
  assert(
    homemAranhaHallucination.length === 0,
    `Homem-Aranha não deve ser hallucination: ${homemAranhaHallucination.join(", ")}`
  );
  unitResults.push({ test: "authorized_entity_no_hallucination", passed: true });

  // 2) Data não autorizada bloqueada
  const dateTruth = validateNarrationTruth({
    facts: [
      "Venom surgiu numa história em que o público escolheu o design do traje preto do Homem-Aranha."
    ],
    generatedScript: "Em 1984, Venom mudou tudo no universo Marvel.",
    allowedContext: authorizedContext,
    topic: "Parceiro Perfeito"
  });
  assert(
    dateTruth.issues.some((issue) => issue.type === "invented_date") ||
      !dateTruth.sanitizedScript.includes("1984"),
    "data não autorizada deve ser bloqueada"
  );
  unitResults.push({ test: "unauthorized_date_blocked", passed: true });

  // 3) Fato específico não autorizado bloqueado
  const inventedTruth = validateNarrationTruth({
    facts: ["Venom surgiu nos quadrinhos Marvel."],
    generatedScript: "Stan Lee criou Venom em 1984 com 99% de aprovação do público.",
    allowedContext: ["Venom", "Marvel"],
    topic: "Venom"
  });
  assert(inventedTruth.issues.length > 0, "fato específico não autorizado deve gerar issues");
  unitResults.push({ test: "unauthorized_specific_fact_blocked", passed: true });

  // 4) Action label oralizado
  const oralized = oralizeActionLabelsInNarration(
    "Essa dupla funciona por causa de parceiro ideal e simbiose."
  );
  assert(
    !/\bparceiro ideal e simbiose\b/i.test(oralized),
    `action label cru permaneceu: ${oralized}`
  );
  unitResults.push({ test: "action_label_oralized", passed: true, oralized });

  // 5) Beat duration soft correction
  const softTiming = validateBeatTimingSoft({
    beats: [
      {
        id: "development-0",
        role: "development",
        text:
          "Venom surgiu numa história em que o público escolheu o design do traje preto do Homem-Aranha e isso mudou a leitura do personagem nos quadrinhos Marvel por muito tempo depois disso.",
        pauseAfterMs: 300
      }
    ],
    targetDurationSec: 40,
    wpm: 155
  });
  assert(softTiming.correctedBeats[0].text.length < 200, "beat longo deve ser encurtado");
  unitResults.push({
    test: "beat_duration_soft_correction",
    passed: true,
    severity: softTiming.severity,
    warnings: softTiming.warnings
  });

  const variationReports = [];
  const priorScripts = [];
  const priorAngles = [];

  for (const variationDef of VARIATIONS) {
    const result = refineRemixNarrationWithRetention({
      legacyBeats,
      legacyScript,
      analysis,
      targetStyle: variationDef.targetStyle,
      variationIndex: variationDef.variationIndex,
      productionEmotion: "curious",
      priorVariationScripts: priorScripts,
      priorVariationAngles: priorAngles,
      seed: `venom-${variationDef.variation}`,
      maxDurationSeconds: 40
    });

    const meta = result.metadata;
    const finalScript = result.suggestedScript;
    const rawActionLabelsFound = findRawActionLabelsInText(finalScript);
    const retentionInput = buildRemixRetentionInput(analysis, null, `venom-${variationDef.variation}`, 40);
    const pack = getNarrationStylePack(classifyNarrationSubject(retentionInput));
    const forbiddenPhrasesFound = findForbiddenPhrases(finalScript, pack);

    if (meta.angle) priorAngles.push(meta.angle);
    priorScripts.push(finalScript);

    variationReports.push({
      variation: variationDef.variation,
      angle: variationDef.angle,
      retentionEngineAttempted: meta.retentionEngineAttempted ?? true,
      retentionEngineUsed: meta.usedRetentionEngine,
      fallbackUsed: meta.fallbackUsed,
      fallbackMode: meta.fallbackMode ?? (meta.fallbackUsed ? "full_legacy" : "none"),
      fallbackReason: meta.fallbackReason ?? null,
      upgradesAppliedOnFallback: meta.upgradesAppliedOnFallback ?? {
        truthGuard: false,
        timing: false,
        captionDirection: false
      },
      truthGuard: meta.truthGuard
        ? {
            ok: meta.truthGuard.ok,
            score: meta.truthGuard.score,
            issues: meta.truthGuard.issues.map((issue) => ({
              type: issue.type,
              reason: issue.reason
            })),
            authorizedContextUsed: meta.truthGuard.authorizedContextUsed ?? []
          }
        : null,
      timing: meta.speechTiming
        ? {
            ok: meta.speechTiming.ok,
            estimatedDurationSec: meta.speechTiming.estimatedDurationSec,
            warnings: meta.speechTiming.warnings
          }
        : null,
      captionDirection: meta.captionDirection
        ? {
            cuesCount: meta.captionDirection.cues?.length ?? 0,
            style: meta.captionDirection.style ?? "premium"
          }
        : null,
      forbiddenPhrasesFound,
      rawActionLabelsFound,
      narrationScore: meta.narrationScore,
      finalScript
    });
  }

  const retentionUsedCount = variationReports.filter((entry) => entry.retentionEngineUsed).length;
  const partialFallbackCount = variationReports.filter(
    (entry) => entry.fallbackMode === "partial_upgrade_on_legacy"
  ).length;
  const upgradesVisibleCount = variationReports.filter(
    (entry) => entry.truthGuard && entry.timing && entry.captionDirection
  ).length;

  assert(retentionUsedCount + partialFallbackCount >= 2, "pelo menos 2 variações com retention ou fallback parcial");
  assert(
    variationReports.every((entry) => entry.forbiddenPhrasesFound.length === 0),
    "nenhuma variação deve conter clichês proibidos"
  );
  assert(
    variationReports.every((entry) => entry.rawActionLabelsFound.length === 0),
    "nenhuma variação deve conter action label cru"
  );
  assert(upgradesVisibleCount >= 1, "upgrades devem aparecer na saída final");

  const payload = {
    generatedAt: new Date().toISOString(),
    subject: "venom-parceiro-perfeito",
    unitResults,
    variations: variationReports,
    summary: {
      retentionEngineUsed: retentionUsedCount,
      partialFallbackUsed: partialFallbackCount,
      upgradesVisibleInOutput: upgradesVisibleCount,
      authorizedContextSample: authorizedContext.slice(0, 12),
      before: {
        retentionApplied: 0,
        upgradesVisible: 0,
        fallbackMode: "full_legacy"
      },
      after: {
        retentionApplied: retentionUsedCount,
        partialFallbackApplied: partialFallbackCount,
        upgradesVisible: upgradesVisibleCount
      }
    }
  };

  await mkdir(dirname(reportPath), { recursive: true });
  await writeFile(reportPath, JSON.stringify(payload, null, 2), "utf8");

  console.log("Fallback upgrades report:", reportPath);
  console.log(JSON.stringify(payload.summary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});