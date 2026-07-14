import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");
const reportPath = join(projectRoot, "tmp", "narration-retention-report.json");

const TEST_SUBJECTS = [
  {
    id: "venom-hq",
    label: "Venom / HQ",
    input: {
      subject: "Venom parceiro perfeito simbiose",
      headline: "Por que Venom e Eddie Brock funcionam como dupla",
      summary:
        "O simbionte e Eddie dividem o mesmo corpo com duas vozes — conflito interno que virou assinatura do personagem nos quadrinhos Marvel.",
      entities: ["Venom", "Eddie Brock", "simbionte"],
      curiosityFact:
        "Venom surgiu numa história em que o público escolheu o design do traje preto do Homem-Aranha.",
      primaryAction: "parceiro ideal e simbiose",
      visualHints: ["close no rosto", "simbionte", "confronto"],
      targetDurationSeconds: 42,
      seed: "venom-hq-test"
    },
    variantCount: 4
  },
  {
    id: "inteligencia-artificial",
    label: "Inteligência artificial",
    input: {
      subject: "Inteligência artificial no dia a dia",
      headline: "IA que resume reuniões em segundos",
      summary:
        "Ferramentas de IA agora transcrevem, destacam decisões e geram tarefas automaticamente — mudando o fluxo de trabalho remoto.",
      entities: ["IA", "transcrição automática"],
      curiosityFact:
        "O ganho real não é gerar texto bonito — é cortar o tempo entre reunião e execução.",
      primaryAction: "automatizar resumo de reunião",
      visualHints: ["tela de app", "lista de tarefas"],
      targetDurationSeconds: 40,
      seed: "ia-test"
    },
    variantCount: 3
  },
  {
    id: "direito-bancario",
    label: "Direito bancário",
    input: {
      subject: "Cobrança indevida no cartão de crédito",
      headline: "Banco cobrou taxa que você não autorizou?",
      summary:
        "Consumidor pode contestar cobrança indevida e pedir estorno quando a cláusula não foi informada de forma clara.",
      entities: ["banco", "cartão de crédito", "consumidor"],
      curiosityFact:
        "O prazo para contestar pode começar na data da fatura — anotar o vencimento evita perder o direito.",
      primaryAction: "contestar cobrança indevida",
      visualHints: ["fatura", "app do banco"],
      targetDurationSeconds: 44,
      seed: "banco-test"
    },
    variantCount: 3
  },
  {
    id: "curiosidade-historica",
    label: "Curiosidade histórica",
    input: {
      subject: "Relógio de Bolivar",
      headline: "O relógio que parou no momento da morte de Bolivar",
      summary:
        "Um relógio de bolso teria marcado a hora exata da morte de Simón Bolívar — objeto que virou símbolo histórico.",
      entities: ["Bolívar", "relógio", "1819"],
      curiosityFact:
        "O objeto virou peça de museu porque a hora gravada não batia com todos os registros oficiais da época.",
      primaryAction: "registrar hora da morte",
      visualHints: ["relógio antigo", "documento histórico"],
      targetDurationSeconds: 41,
      seed: "historia-test"
    },
    variantCount: 3
  },
  {
    id: "produto-cabelo",
    label: "Produto beleza / cabelo",
    input: {
      subject: "Shampoo sem sulfato para cabelo cacheado",
      headline: "Testei shampoo sem sulfato por 14 dias",
      summary:
        "Produto promete definição sem ressecar — resultado depende de quantidade, frequência e tipo de água.",
      entities: ["shampoo sem sulfato", "cabelo cacheado"],
      curiosityFact:
        "O erro mais comum é usar quantidade de shampoo comum — cacheado pede menos produto e mais água.",
      primaryAction: "definir cachos sem ressecar",
      visualHints: ["frasco", "cachos molhados", "antes e depois"],
      targetDurationSeconds: 38,
      seed: "cabelo-test"
    },
    variantCount: 3
  }
];

async function importMediaBeast() {
  return import(
    pathToFileURL(join(projectRoot, "packages/media-beast/dist/index.js")).href
  );
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

function summarizeSubjectResult(testCase, report) {
  const scripts = report.variants.map((variant) => variant.script);
  const pairwiseOverlap = [];
  for (let i = 0; i < scripts.length; i++) {
    for (let j = i + 1; j < scripts.length; j++) {
      pairwiseOverlap.push({
        pair: `${report.variants[i].angle}↔${report.variants[j].angle}`,
        overlap: tokenOverlap(scripts[i], scripts[j])
      });
    }
  }

  return {
    id: testCase.id,
    label: testCase.label,
    subjectCategory: report.subjectCategory,
    stylePack: {
      label: report.stylePack.label,
      narrativeTone: report.stylePack.narrativeTone,
      idealPace: report.stylePack.idealPace,
      energyLevel: report.stylePack.energyLevel,
      curiosityType: report.stylePack.curiosityType
    },
    variants: report.variants.map((variant) => ({
      angle: variant.angle,
      script: variant.script,
      score: variant.score,
      forbiddenPhrasesFound: variant.score.forbiddenPhrasesFound,
      beats: variant.beats,
      voiceMetadata: variant.voiceMetadata
    })),
    overlap: {
      matrix: report.overlapMatrix,
      pairwise: pairwiseOverlap,
      maxPairwise: pairwiseOverlap.reduce(
        (max, entry) => Math.max(max, entry.overlap),
        0
      )
    },
    recommendations: report.recommendations,
    passed: report.variants.every((variant) => variant.score.total >= 82)
  };
}

async function main() {
  const mediaBeast = await importMediaBeast();
  const { NarrationRetentionEngine } = mediaBeast;
  const engine = new NarrationRetentionEngine();

  const subjectResults = [];
  for (const testCase of TEST_SUBJECTS) {
    const report = engine.generateVariants(testCase.input, testCase.variantCount);
    subjectResults.push(summarizeSubjectResult(testCase, report));
  }

  const summary = {
    totalSubjects: subjectResults.length,
    passedSubjects: subjectResults.filter((entry) => entry.passed).length,
    minScore: Math.min(
      ...subjectResults.flatMap((entry) =>
        entry.variants.map((variant) => variant.score.total)
      )
    ),
    maxOverlap: Math.max(...subjectResults.map((entry) => entry.overlap.maxPairwise)),
    forbiddenHits: subjectResults.flatMap((entry) =>
      entry.variants.flatMap((variant) => variant.forbiddenPhrasesFound)
    )
  };

  const payload = {
    generatedAt: new Date().toISOString(),
    engine: "NarrationRetentionEngine",
    scoreThreshold: 82,
    summary,
    subjects: subjectResults
  };

  await mkdir(dirname(reportPath), { recursive: true });
  await writeFile(reportPath, JSON.stringify(payload, null, 2), "utf8");

  console.log("NarrationRetentionEngine report:", reportPath);
  console.log(JSON.stringify(summary, null, 2));

  for (const subject of subjectResults) {
    console.log(`\n[${subject.label}] ${subject.subjectCategory}`);
    for (const variant of subject.variants) {
      console.log(
        `  ${variant.angle}: score=${variant.score.total} forbidden=${variant.forbiddenPhrasesFound.length} overlap-ready`
      );
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});