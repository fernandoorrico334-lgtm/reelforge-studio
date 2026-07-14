import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");
const reportPath = join(projectRoot, "tmp", "narration-retention-integration-report.json");

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

function makeLegacyBeats(subject, curiosityFact) {
  return [
    {
      role: "hook",
      text: `${subject} abre com um detalhe que prende.`,
      caption: subject,
      curiosityTag: "hook"
    },
    {
      role: "context",
      text: `O vídeo mostra ${subject} em ação. Falta o contexto por trás.`,
      caption: "O vídeo mostra em ação",
      curiosityTag: "context"
    },
    {
      role: "tension",
      text: `E o detalhe é esse: ${curiosityFact}`,
      caption: "E o detalhe é esse",
      curiosityTag: "tension"
    },
    {
      role: "climax",
      text: curiosityFact,
      caption: curiosityFact.split(" ").slice(0, 7).join(" "),
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

function makeAnalysis(caseDef) {
  return {
    sourceDurationSeconds: 42,
    outputDurationSeconds: 40,
    probeMethod: "estimated",
    platform: "youtube",
    title: caseDef.subject,
    themeSummary: caseDef.summary,
    contextKeywords: caseDef.keywords ?? [],
    mainScenes: [],
    narrativeArc: [caseDef.summary],
    analysisNotes: [],
    researchDossier: null,
    contentIntelligence: {
      domain: caseDef.domain ?? "generic",
      headline: caseDef.headline ?? caseDef.subject,
      summary: caseDef.summary,
      narrativeBrief: caseDef.summary,
      narrativeHook: caseDef.headline ?? caseDef.subject,
      curiosityAngle: caseDef.curiosityFact ?? null,
      setting: null,
      mood: "curious",
      entities: (caseDef.entities ?? []).map((name, index) => ({
        id: `e${index}`,
        name,
        type: "topic",
        franchise: null,
        confidence: 0.9
      })),
      actions: caseDef.primaryAction
        ? [{ label: caseDef.primaryAction, verb: "mostrar", confidence: 0.8 }]
        : [],
      visualSearchQueries: caseDef.visualHints ?? [],
      sceneInsights: (caseDef.visualHints ?? []).map((hint, index) => ({
        role: ["hook", "context", "climax"][index] ?? "context",
        narrationAngle: hint,
        focusEntity: caseDef.entities?.[0] ?? null,
        visualHint: hint
      }))
    }
  };
}

const SUBJECT_CASES = [
  {
    id: "venom-hq",
    subject: "Venom parceiro perfeito simbiose",
    headline: "Por que Venom e Eddie funcionam como dupla",
    summary:
      "O simbionte e Eddie dividem o mesmo corpo com duas vozes nos quadrinhos Marvel.",
    entities: ["Venom", "Eddie Brock"],
    curiosityFact:
      "Venom surgiu numa história em que o público escolheu o design do traje preto do Homem-Aranha.",
    primaryAction: "parceiro ideal e simbiose",
    domain: "comics_superhero",
    keywords: ["venom", "simbionte", "hq"],
    visualHints: ["close no rosto", "simbionte"],
    targetStyle: "comics"
  },
  {
    id: "ia",
    subject: "Inteligência artificial no dia a dia",
    headline: "IA que resume reuniões em segundos",
    summary: "Ferramentas de IA transcrevem e destacam decisões automaticamente.",
    entities: ["IA"],
    curiosityFact: "O ganho real é cortar o tempo entre reunião e execução.",
    primaryAction: "automatizar resumo",
    domain: "science",
    keywords: ["ia", "tecnologia"],
    visualHints: ["tela de app"],
    targetStyle: "documentary"
  },
  {
    id: "banco",
    subject: "Cobrança indevida no cartão de crédito",
    headline: "Banco cobrou taxa não autorizada?",
    summary: "Consumidor pode contestar cobrança indevida quando a cláusula não foi clara.",
    entities: ["banco", "cartão de crédito"],
    curiosityFact: "O prazo para contestar pode começar na data da fatura.",
    primaryAction: "contestar cobrança",
    domain: "generic",
    keywords: ["banco", "direito", "consumidor"],
    visualHints: ["fatura"],
    targetStyle: "documentary"
  },
  {
    id: "historia",
    subject: "Relógio de Bolivar",
    headline: "O relógio que marcou a morte de Bolivar",
    summary: "Relógio de bolso teria marcado a hora da morte de Simón Bolívar.",
    entities: ["Bolívar", "relógio"],
    curiosityFact: "O objeto virou peça de museu por causa da hora gravada.",
    primaryAction: "registrar hora da morte",
    domain: "documentary",
    keywords: ["história", "bolivar", "museu"],
    visualHints: ["relógio antigo"],
    targetStyle: "documentary"
  },
  {
    id: "cabelo",
    subject: "Shampoo sem sulfato para cabelo cacheado",
    headline: "Testei shampoo sem sulfato por 14 dias",
    summary: "Produto promete definição sem ressecar cabelo cacheado.",
    entities: ["shampoo sem sulfato", "cabelo cacheado"],
    curiosityFact: "Cacheado pede menos produto e mais água na aplicação.",
    primaryAction: "definir cachos",
    domain: "generic",
    keywords: ["shampoo", "cabelo", "beleza"],
    visualHints: ["frasco", "cachos"],
    targetStyle: "generic"
  }
];

async function runTests() {
  const beast = await importMediaBeast();
  const {
    refineRemixNarrationWithRetention,
    estimateSpeechDurationPtBr,
    validateBeatDurationFit,
    applyAntiClicheFilter,
    detectHallucinations,
    buildAllowedFactsCorpus,
    buildRemixNarrationOverlayPlan,
    createChannelDNA,
    findForbiddenPhrases
  } = beast;

  const channelDNA = createChannelDNA({
    id: "retention-test",
    name: "Retention Test Channel",
    niche: "cinema",
    tone: "cinematic explainer",
    language: "pt-BR"
  });

  const results = [];

  // 1) Flag desligada
  delete process.env.ENABLE_NARRATION_RETENTION_ENGINE;
  const legacy = makeLegacyBeats("Venom", "Venom surgiu nos quadrinhos Marvel.");
  const analysis = makeAnalysis(SUBJECT_CASES[0]);
  const off = refineRemixNarrationWithRetention({
    legacyBeats: legacy,
    legacyScript: legacy.map((b) => b.text).join("\n"),
    analysis,
    targetStyle: "comics",
    variationIndex: 0,
    productionEmotion: "curious",
    priorVariationScripts: [],
    priorVariationAngles: [],
    seed: "flag-off",
    maxDurationSeconds: 40
  });
  assert(!off.metadata.retentionEngineEnabled, "flag off: engine disabled");
  assert(!off.usedRetentionEngine, "flag off: not used");
  assert(off.suggestedScript === legacy.map((b) => b.text).join("\n"), "flag off: script intact");
  results.push({ test: "flag_off", passed: true });

  // 2) Flag ligada
  process.env.ENABLE_NARRATION_RETENTION_ENGINE = "true";
  const on = refineRemixNarrationWithRetention({
    legacyBeats: legacy,
    legacyScript: legacy.map((b) => b.text).join("\n"),
    analysis,
    targetStyle: "comics",
    variationIndex: 0,
    productionEmotion: "curious",
    priorVariationScripts: [],
    priorVariationAngles: [],
    seed: "flag-on",
    maxDurationSeconds: 40
  });
  assert(on.metadata.retentionEngineEnabled, "flag on: enabled");
  assert(
    on.usedRetentionEngine || on.fallbackUsed,
    "flag on: engine attempted"
  );
  if (on.usedRetentionEngine) {
    assert((on.metadata.narrationScore ?? 0) >= 82, "flag on: score >= 82");
  }
  results.push({
    test: "flag_on",
    passed: true,
    usedRetentionEngine: on.usedRetentionEngine,
    score: on.metadata.narrationScore
  });

  // 3) Score baixo forçado -> fallback
  process.env.NARRATION_RETENTION_FORCE_LOW_SCORE = "true";
  const low = refineRemixNarrationWithRetention({
    legacyBeats: legacy,
    legacyScript: legacy.map((b) => b.text).join("\n"),
    analysis,
    targetStyle: "comics",
    variationIndex: 0,
    productionEmotion: "curious",
    priorVariationScripts: [],
    priorVariationAngles: [],
    seed: "low-score",
    maxDurationSeconds: 40
  });
  delete process.env.NARRATION_RETENTION_FORCE_LOW_SCORE;
  assert(low.fallbackUsed, "low score: fallback");
  assert(low.metadata.fallbackReason?.includes("score"), "low score: reason");
  results.push({ test: "low_score_fallback", passed: true });

  // 4) Erro simulado -> fallback
  process.env.NARRATION_RETENTION_FORCE_FAIL = "true";
  const fail = refineRemixNarrationWithRetention({
    legacyBeats: legacy,
    legacyScript: legacy.map((b) => b.text).join("\n"),
    analysis,
    targetStyle: "comics",
    variationIndex: 0,
    productionEmotion: "curious",
    priorVariationScripts: [],
    priorVariationAngles: [],
    seed: "force-fail",
    maxDurationSeconds: 40
  });
  delete process.env.NARRATION_RETENTION_FORCE_FAIL;
  assert(fail.fallbackUsed && fail.metadata.fallbackReason === "erro_simulado", "force fail");
  results.push({ test: "force_fail_fallback", passed: true });

  // 5) Duração dos beats
  const durationBeat = {
    role: "hook",
    text: "Venom e Eddie abrem essa cena com simbiose.",
    emotion: "curious",
    pace: "medium",
    pauseAfterMs: 120,
    emphasisWords: ["Venom"],
    captionWords: ["Venom", "e", "Eddie", "abrem", "essa", "cena", "com"],
    visualCue: "close",
    retentionGoal: "gancho",
    timing: { startSec: 0, endSec: 2 }
  };
  const duration = validateBeatDurationFit(durationBeat);
  const estimated = estimateSpeechDurationPtBr(durationBeat.text);
  assert(estimated > 0 && typeof duration.ok === "boolean", "duration estimation");
  results.push({ test: "beat_duration", passed: true, estimated, duration });

  // 6) Anti-clichê
  const clicheText = "Galera, você não vai acreditar nesse frame insano.";
  const filtered = applyAntiClicheFilter(clicheText);
  const forbidden = findForbiddenPhrases(filtered);
  assert(forbidden.length === 0, "anti-cliche");
  assert(!/\bframe\b/i.test(filtered), "frame removed");
  results.push({ test: "anti_cliche", passed: true, filtered });

  // 7) Anti-alucinação
  const corpus = buildAllowedFactsCorpus([
    "Venom surgiu nos quadrinhos Marvel.",
    "Eddie Brock",
    "Marvel"
  ]);
  const hallucinated = detectHallucinations(
    "Em 1847, Napoleão assinou a lei 9999 com o banco XPTO.",
    corpus
  );
  assert(hallucinated.length > 0, "anti-hallucination detects extras");
  const safe = detectHallucinations("Venom surgiu nos quadrinhos Marvel com Eddie Brock.", corpus);
  assert(safe.length === 0, "anti-hallucination allows known facts");
  results.push({ test: "anti_hallucination", passed: true, hallucinated, safe });

  // 8) Cinco assuntos + integração buildRemixNarrationOverlayPlan
  const subjectReports = [];
  const priorScripts = [];
  const priorAngles = [];
  for (const [index, caseDef] of SUBJECT_CASES.entries()) {
    const caseAnalysis = makeAnalysis(caseDef);
    const overlay = buildRemixNarrationOverlayPlan({
      analysis: caseAnalysis,
      channelDNA,
      targetStyle: caseDef.targetStyle,
      variationIndex: index,
      maxDurationSeconds: 40,
      priorVariationScripts: priorScripts,
      priorVariationAngles: priorAngles
    });

    assert(overlay.retentionMetadata?.retentionEngineEnabled, `${caseDef.id}: retention enabled`);
    assert(overlay.narrationBeats.length >= 4, `${caseDef.id}: beats present`);

    if (overlay.retentionMetadata?.angle) {
      assert(!priorAngles.includes(overlay.retentionMetadata.angle), `${caseDef.id}: unique angle`);
      priorAngles.push(overlay.retentionMetadata.angle);
    }
    priorScripts.push(overlay.suggestedScript);

    subjectReports.push({
      id: caseDef.id,
      retentionEngineEnabled: overlay.retentionMetadata?.retentionEngineEnabled,
      usedRetentionEngine: overlay.retentionMetadata?.usedRetentionEngine,
      fallbackUsed: overlay.retentionMetadata?.fallbackUsed,
      fallbackReason: overlay.retentionMetadata?.fallbackReason,
      narrationScore: overlay.retentionMetadata?.narrationScore,
      scoreBreakdown: overlay.retentionMetadata?.scoreBreakdown,
      forbiddenPhrasesFound: overlay.retentionMetadata?.forbiddenPhrasesFound,
      estimatedDurationSec: overlay.retentionMetadata?.estimatedDurationSec,
      angle: overlay.retentionMetadata?.angle,
      angleUniquenessScore: overlay.retentionMetadata?.angleUniquenessScore,
      variationOverlap: overlay.retentionMetadata?.variationOverlap,
      script: overlay.suggestedScript,
      beats: overlay.retentionMetadata?.beats,
      voiceMetadata: overlay.retentionMetadata?.voiceMetadata,
      narrationBeats: overlay.narrationBeats.map((beat) => ({
        role: beat.role,
        text: beat.text
      }))
    });
  }

  results.push({ test: "five_subjects_integration", passed: true, subjectReports });

  delete process.env.ENABLE_NARRATION_RETENTION_ENGINE;

  const payload = {
    generatedAt: new Date().toISOString(),
    results,
    subjectReports,
    summary: {
      totalTests: results.length,
      passedTests: results.filter((entry) => entry.passed).length,
      subjectsWithRetention: subjectReports.filter((entry) => entry.usedRetentionEngine).length,
      subjectsWithFallback: subjectReports.filter((entry) => entry.fallbackUsed).length
    }
  };

  await mkdir(dirname(reportPath), { recursive: true });
  await writeFile(reportPath, JSON.stringify(payload, null, 2), "utf8");
  console.log("Integration report:", reportPath);
  console.log(JSON.stringify(payload.summary, null, 2));
}

runTests().catch((error) => {
  console.error(error);
  process.exit(1);
});