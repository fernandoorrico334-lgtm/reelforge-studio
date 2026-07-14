import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");
const reportPath = join(projectRoot, "tmp", "narration-upgrades-report.json");

async function importMediaBeast() {
  return import(
    pathToFileURL(join(projectRoot, "packages/media-beast/dist/index.js")).href
  );
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const SUBJECTS = [
  {
    id: "venom-hq",
    topic: "Venom parceiro perfeito simbiose",
    facts: [
      "Venom surgiu numa história em que o público escolheu o design do traje preto do Homem-Aranha.",
      "Eddie Brock e o simbionte dividem o mesmo corpo nos quadrinhos Marvel."
    ],
    visualDescription: "close no rosto do personagem, simbionte, confronto",
    targetDurationSec: 35,
    subjectCategory: "comics_anime_filmes"
  },
  {
    id: "ia",
    topic: "Inteligência artificial no dia a dia",
    facts: [
      "Ferramentas de IA transcrevem reuniões e destacam decisões automaticamente.",
      "O ganho real é cortar o tempo entre reunião e execução."
    ],
    visualDescription: "tela de app, lista de tarefas",
    targetDurationSec: 36,
    subjectCategory: "tecnologia_ia"
  },
  {
    id: "banco",
    topic: "Cobrança indevida no cartão de crédito",
    facts: [
      "Consumidor pode contestar cobrança indevida quando a cláusula não foi clara.",
      "O prazo para contestar pode começar na data da fatura."
    ],
    visualDescription: "fatura, app do banco",
    targetDurationSec: 38,
    subjectCategory: "juridico_bancario"
  },
  {
    id: "historia",
    topic: "Relógio de Bolivar",
    facts: [
      "Relógio de bolso teria marcado a hora da morte de Simón Bolívar.",
      "O objeto virou peça de museu por causa da hora gravada."
    ],
    visualDescription: "relógio antigo, documento histórico",
    targetDurationSec: 37,
    subjectCategory: "historia_curiosidades"
  },
  {
    id: "cabelo",
    topic: "Shampoo sem sulfato para cabelo cacheado",
    facts: [
      "Produto promete definição sem ressecar cabelo cacheado.",
      "Cacheado pede menos produto e mais água na aplicação."
    ],
    visualDescription: "frasco, cachos molhados",
    targetDurationSec: 34,
    subjectCategory: "produto_review"
  }
];

function buildBeatsFromScript(lines) {
  const roles = [
    "hook",
    "promise_context",
    "curiosity",
    "development",
    "climax_reveal",
    "loop_closing"
  ];
  const timings = [
    { startSec: 0, endSec: 2 },
    { startSec: 2, endSec: 6 },
    { startSec: 6, endSec: 14 },
    { startSec: 14, endSec: 24 },
    { startSec: 24, endSec: 35 },
    { startSec: 35, endSec: 45 }
  ];
  return roles.map((role, index) => ({
    role,
    text: lines[index] ?? lines[lines.length - 1] ?? "",
    emotion: "curioso, conversacional",
    pace: "medium",
    pauseAfterMs: 220,
    emphasisWords: [],
    captionWords: (lines[index] ?? "").split(/\s+/).slice(0, 7),
    visualCue: "sincronizar com visual",
    retentionGoal: `meta ${role}`,
    timing: timings[index]
  }));
}

async function main() {
  const beast = await importMediaBeast();
  const {
    validateNarrationTruth,
    sanitizeUnsupportedClaims,
    extractPossibleClaims,
    claimSeemsSupportedByFacts,
    optimizeSpeechTiming,
    estimateSpeechDurationPtBr,
    shortenBeatForTiming,
    expandBeatForTiming,
    generateCaptionDirection,
    selectCaptionText,
    selectCaptionAnimation,
    applyNarrationUpgrades,
    buildRetentionBeats,
    classifyNarrationSubject
  } = beast;

  const unitTests = [];
  const subjectReports = [];

  // Invented fact detection
  const invented = validateNarrationTruth({
    facts: ["Venom surgiu nos quadrinhos Marvel."],
    generatedScript: "Venom foi criado em 1984 por Stan Lee em Nova York.",
    strictness: "high"
  });
  assert(!invented.ok, "invented fact: ok must be false");
  assert(invented.issues.length > 0, "invented fact: issues detected");
  unitTests.push({ test: "invented_fact_detected", passed: true });

  // Date removal
  assert(
    !invented.sanitizedScript.includes("1984"),
    "invented date removed from sanitized script"
  );
  unitTests.push({ test: "invented_date_removed", passed: true });

  // Number removal
  const inventedNumber = validateNarrationTruth({
    facts: ["Produto testado por 14 dias."],
    generatedScript: "Funciona em 97% dos casos comprovadamente.",
    strictness: "high"
  });
  assert(!inventedNumber.ok, "invented number detected");
  unitTests.push({ test: "invented_number_detected", passed: true });

  // Legal softening
  const legal = validateNarrationTruth({
    facts: ["Consumidor pode contestar cobrança indevida."],
    generatedScript: "O banco agiu ilegalmente e a lei garante estorno total.",
    strictness: "high"
  });
  const softened = legal.sanitizedScript;
  assert(
    /irregularidade|discussão jurídica/i.test(softened),
    "legal claim softened"
  );
  const directSanitize = sanitizeUnsupportedClaims(
    "O banco agiu ilegalmente e a lei garante estorno.",
    legal.issues
  );
  assert(directSanitize.length > 0, "sanitize helper returns text");
  unitTests.push({ test: "legal_softening", passed: true, softened });

  // Timing compression
  const longBeats = buildBeatsFromScript([
    "Hook forte que prende atenção imediatamente no começo do vídeo inteiro.",
    "Contexto longo demais com muitos detalhes que explicam tudo o que acontece antes do clímax.",
    "Curiosidade extensa com informação demais para caber em poucos segundos de narração.",
    "Desenvolvimento muito longo com explicação completa e repetida várias vezes no meio.",
    "Clímax revelador com frase enorme que tenta explicar tudo de uma vez só no final.",
    "Fechamento longo com convite repetido para comentar e reassistir o vídeo completo."
  ]);
  const compressed = optimizeSpeechTiming({
    beats: longBeats.map((beat, index) => ({
      id: `long-${index}`,
      role: beat.role,
      text: beat.text,
      pauseAfterMs: beat.pauseAfterMs,
      timing: beat.timing
    })),
    targetDurationSec: 35
  });
  assert(
    compressed.estimatedDurationSec <= compressed.targetDurationSec + 3,
    "timing compression approximates target"
  );
  unitTests.push({
    test: "timing_compression",
    passed: true,
    estimated: compressed.estimatedDurationSec,
    actions: compressed.actions.length
  });

  // Timing expansion without invented facts
  const shortText = "Detalhe rápido.";
  const expanded = expandBeatForTiming(shortText, "development", [
    "Detalhe rápido sobre o produto."
  ]);
  assert(expanded.length > shortText.length, "timing expansion adds oral reinforcement");
  assert(!/\d{4}/.test(expanded), "expansion does not invent dates");
  unitTests.push({ test: "timing_expansion_no_facts", passed: true, expanded });

  // Caption word limit
  const caption = selectCaptionText(
    "Repara nisso: o Venom não parece assustador por acaso nesta cena específica do clipe.",
    ["Repara nisso", "não", "é", "por", "acaso"],
    7
  );
  assert(caption.split(/\s+/).length <= 7, "caption respects word limit");
  unitTests.push({ test: "caption_word_limit", passed: true, caption });

  // Emotion influences animation
  const excitedAnim = selectCaptionAnimation("excited", "fast", "abrir curiosidade");
  const seriousAnim = selectCaptionAnimation("serious", "slow", "contexto");
  assert(excitedAnim !== seriousAnim, "emotion changes animation");
  unitTests.push({ test: "emotion_animation", passed: true, excitedAnim, seriousAnim });

  // Style legal avoids exaggeration
  const legalDirection = generateCaptionDirection({
    style: "legal",
    beats: [
      {
        id: "b1",
        text: "Pode existir indício de irregularidade na cobrança.",
        emotion: "serious",
        pace: "slow",
        pauseAfterMs: 200,
        captionWords: ["indício", "de", "irregularidade"],
        retentionGoal: "contexto jurídico"
      }
    ]
  });
  assert(
    legalDirection.cues[0].intensity === "low" &&
      legalDirection.cues[0].sfxSuggestion !== "bass_hit",
    "legal style avoids exaggeration"
  );
  unitTests.push({ test: "legal_style_subtle", passed: true });

  // Style dark tense
  const darkDirection = generateCaptionDirection({
    style: "dark",
    beats: [
      {
        id: "d1",
        text: "Parece coincidência. Não é.",
        emotion: "tense",
        pace: "slow",
        pauseAfterMs: 360,
        visualCue: "close tenso",
        retentionGoal: "tensão crescente"
      }
    ]
  });
  assert(
    ["pulse", "riser", "bass_hit", "hold_frame"].includes(darkDirection.cues[0].sfxSuggestion) ||
      darkDirection.cues[0].cutSuggestion === "hold_frame",
    "dark style suggests tense direction"
  );
  unitTests.push({ test: "dark_style_tense", passed: true });

  // claim support helper
  assert(
    claimSeemsSupportedByFacts(
      "Venom surgiu nos quadrinhos Marvel.",
      ["Venom surgiu nos quadrinhos Marvel."]
    ),
    "supported claim passes"
  );
  unitTests.push({ test: "claim_support", passed: true });

  // extract claims
  assert(
    extractPossibleClaims("Primeira frase com contexto. Segunda frase com detalhe.").length >= 2,
    "extract claims"
  );
  unitTests.push({ test: "extract_claims", passed: true });

  for (const subject of SUBJECTS) {
    const retentionInput = {
      subject: subject.topic,
      summary: subject.facts[0],
      entities: subject.topic.split(" ").slice(0, 2),
      curiosityFact: subject.facts[1],
      visualHints: subject.visualDescription.split(", "),
      targetDurationSeconds: subject.targetDurationSec,
      subjectCategory: subject.subjectCategory,
      seed: subject.id
    };

    const classified = classifyNarrationSubject(retentionInput);
    const beats = buildRetentionBeats(retentionInput, "factual_documental");
    const script = beats.map((beat) => beat.text).join("\n");

    const upgrades = applyNarrationUpgrades({
      beats,
      script,
      facts: subject.facts,
      topic: subject.topic,
      visualDescription: subject.visualDescription,
      targetDurationSec: subject.targetDurationSec,
      subjectCategory: classified,
      truthStrictness: subject.id === "banco" ? "high" : "medium"
    });

    assert(upgrades.captionDirection.cues.length >= beats.length, `${subject.id}: cues per beat`);
    for (const cue of upgrades.captionDirection.cues) {
      assert(
        cue.textOnScreen.split(/\s+/).length <= 7,
        `${subject.id}: caption too long`
      );
    }

    subjectReports.push({
      id: subject.id,
      classifiedSubject: classified,
      authorizedFacts: subject.facts,
      visualDescription: subject.visualDescription,
      targetDurationSec: subject.targetDurationSec,
      truthGuard: {
        ok: upgrades.truthGuard.ok,
        score: upgrades.truthGuard.score,
        issues: upgrades.truthGuard.issues,
        removedOrSoftenedClaims: upgrades.truthGuard.removedOrSoftenedClaims,
        allowedFactsUsed: upgrades.truthGuard.allowedFactsUsed
      },
      speechTiming: {
        targetDurationSec: upgrades.speechTiming.targetDurationSec,
        estimatedDurationSec: upgrades.speechTiming.estimatedDurationSec,
        differenceSec: upgrades.speechTiming.differenceSec,
        actions: upgrades.speechTiming.actions
      },
      captionDirection: {
        style: upgrades.captionDirection.style,
        cues: upgrades.captionDirection.cues
      },
      finalScript: upgrades.finalScript,
      beats: upgrades.beats,
      warnings: upgrades.warnings
    });
  }

  const sampleReport = subjectReports[0];
  const payload = {
    generatedAt: new Date().toISOString(),
    unitTests,
    subjects: subjectReports,
    truthGuard: sampleReport?.truthGuard ?? null,
    speechTiming: sampleReport?.speechTiming ?? null,
    captionDirection: sampleReport?.captionDirection ?? null,
    finalScript: sampleReport?.finalScript ?? "",
    beats: sampleReport?.beats ?? [],
    warnings: sampleReport?.warnings ?? [],
    summary: {
      unitTestsPassed: unitTests.length,
      subjectsTested: subjectReports.length,
      avgTruthScore:
        subjectReports.reduce((acc, s) => acc + s.truthGuard.score, 0) /
        Math.max(subjectReports.length, 1),
      avgTimingDiff:
        subjectReports.reduce(
          (acc, s) => acc + Math.abs(s.speechTiming.differenceSec),
          0
        ) / Math.max(subjectReports.length, 1)
    }
  };

  await mkdir(dirname(reportPath), { recursive: true });
  await writeFile(reportPath, JSON.stringify(payload, null, 2), "utf8");

  console.log("Narration upgrades report:", reportPath);
  console.log(JSON.stringify(payload.summary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});