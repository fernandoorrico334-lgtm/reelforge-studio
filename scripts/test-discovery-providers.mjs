import { dirname, join, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath, pathToFileURL } from "node:url";
import { ensureArtifactsExist } from "./lib/smoke-utils.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");

const TARGET_COUNT = 8;
const TOP_EXAMPLES = 3;

const PROVIDER_IDS = [
  "tiktok",
  "pinterest",
  "old-forums",
  "flickr",
  "trend-scanner",
  "community-miner"
];

const TEST_NICHES = [
  {
    label: "true_crime",
    niche: "true_crime",
    keywords: ["serial killers", "1970s", "case files", "archive"]
  },
  {
    label: "futebol_antigo",
    niche: "vintage_football",
    keywords: ["futebol antigo", "craques antigos", "lances raros"]
  },
  {
    label: "historia_obscura",
    niche: "history",
    keywords: ["historia obscura", "arquivo historico", "documentary mystery"]
  }
];

const TEMPORAL_LENSES = ["past", "present", "future"];

async function importMediaBeast() {
  return import(
    pathToFileURL(join(projectRoot, "packages/media-beast/dist/index.js")).href
  );
}

function formatMs(durationMs) {
  return `${durationMs.toFixed(1)}ms`;
}

function summarizeLensDistribution(candidates) {
  const counts = { past: 0, present: 0, future: 0, unknown: 0 };

  for (const candidate of candidates) {
    const lens = candidate.metadata?.temporalLens;
    if (typeof lens === "string" && lens in counts) {
      counts[lens] += 1;
    } else {
      counts.unknown += 1;
    }
  }

  return counts;
}

function printCandidateExample(candidate, index) {
  const lens = candidate.metadata?.temporalLens ?? "unknown";
  const intent = candidate.metadata?.searchIntent ?? "n/a";

  console.log(`    ${index + 1}. [${lens}/${intent}] score=${candidate.score}`);
  console.log(`       title: ${candidate.title}`);
  console.log(`       url:   ${candidate.sourceUrl}`);
  console.log(`       reasons:`);
  for (const reason of candidate.reasons.slice(0, 2)) {
    console.log(`         - ${reason}`);
  }
}

function scoreProviderPerformance(providerRuns) {
  const totalCandidates = providerRuns.reduce(
    (sum, run) => sum + run.candidates.length,
    0
  );
  const totalDurationMs = providerRuns.reduce(
    (sum, run) => sum + run.durationMs,
    0
  );
  const avgScore =
    totalCandidates === 0
      ? 0
      : providerRuns
          .flatMap((run) => run.candidates)
          .reduce((sum, candidate) => sum + candidate.score, 0) / totalCandidates;

  const lensCoverage = new Set(
    providerRuns
      .flatMap((run) => run.candidates)
      .map((candidate) => candidate.metadata?.temporalLens)
      .filter((lens) => typeof lens === "string")
  ).size;

  const futureSignals = providerRuns
    .flatMap((run) => run.candidates)
    .filter((candidate) => candidate.metadata?.temporalLens === "future").length;

  return {
    totalCandidates,
    totalDurationMs,
    avgScore,
    lensCoverage,
    futureSignals,
    performanceScore:
      totalCandidates * 2 + avgScore + lensCoverage * 5 + futureSignals * 3
  };
}

function pickInterestingCandidates(allCandidates) {
  const ranked = [...allCandidates].sort((left, right) => {
    const leftFuture = left.metadata?.temporalLens === "future" ? 20 : 0;
    const rightFuture = right.metadata?.temporalLens === "future" ? 20 : 0;
    const leftPast = left.metadata?.temporalLens === "past" ? 8 : 0;
    const rightPast = right.metadata?.temporalLens === "past" ? 8 : 0;

    return (
      right.score +
      rightFuture +
      rightPast -
      (left.score + leftFuture + leftPast)
    );
  });

  const seen = new Set();
  const picks = [];

  for (const candidate of ranked) {
    const key = `${candidate.providerId}:${candidate.metadata?.searchIntent ?? ""}:${candidate.title}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    picks.push(candidate);
    if (picks.length >= 6) {
      break;
    }
  }

  return picks;
}

function assertDiscoveryQuality(candidates, providerId, nicheLabel) {
  if (candidates.length === 0) {
    throw new Error(
      `Provider '${providerId}' returned zero candidates for niche '${nicheLabel}'.`
    );
  }

  for (const candidate of candidates) {
    if (!candidate.title || !candidate.sourceUrl) {
      throw new Error(
        `Provider '${providerId}' returned a candidate without title or sourceUrl.`
      );
    }
    if (!Array.isArray(candidate.reasons) || candidate.reasons.length === 0) {
      throw new Error(
        `Provider '${providerId}' returned a candidate without reasons.`
      );
    }
    if (candidate.metadata?.discoveryOnly !== true) {
      throw new Error(
        `Provider '${providerId}' must remain discovery-only (discoveryOnly=true).`
      );
    }
  }
}

async function runProviderNicheDiscovery(engine, providerId, nicheCase) {
  const startedAt = performance.now();

  const result = await engine.discover({
    niche: nicheCase.niche,
    keywords: nicheCase.keywords,
    providerIds: [providerId],
    maxCandidates: TARGET_COUNT,
    language: "pt-BR",
    enrichCandidates: true,
    minCandidateScore: 8
  });

  const durationMs = performance.now() - startedAt;
  const candidates = result.candidates
    .filter((candidate) => candidate.providerId === providerId)
    .sort((left, right) => right.score - left.score)
    .slice(0, TARGET_COUNT);

  assertDiscoveryQuality(candidates, providerId, nicheCase.label);

  return {
    providerId,
    nicheLabel: nicheCase.label,
    niche: nicheCase.niche,
    durationMs,
    candidates,
    lensDistribution: summarizeLensDistribution(candidates)
  };
}

async function main() {
  await ensureArtifactsExist(
    projectRoot,
    ["packages/media-beast/dist/index.js"],
    "Run 'npm run build --workspace @reelforge/media-beast' before test:discovery."
  );

  const beast = await importMediaBeast();
  const engine = beast.createMediaBeastEngine();

  console.log("=== MEDIA BEAST DISCOVERY PROVIDERS TEST ===\n");
  console.log(`Providers: ${PROVIDER_IDS.join(", ")}`);
  console.log(`Niches: ${TEST_NICHES.map((item) => item.label).join(", ")}`);
  console.log(`targetCount (maxCandidates): ${TARGET_COUNT}\n`);

  const allRuns = [];
  const providerSummaries = [];

  for (const providerId of PROVIDER_IDS) {
    console.log(`--- ${providerId} ---`);
    const providerRuns = [];

    for (const nicheCase of TEST_NICHES) {
      const run = await runProviderNicheDiscovery(engine, providerId, nicheCase);
      providerRuns.push(run);
      allRuns.push(run);

      const lensSummary = TEMPORAL_LENSES.map(
        (lens) => `${lens}=${run.lensDistribution[lens]}`
      ).join(", ");

      console.log(
        `  [${nicheCase.label}] ${run.candidates.length} candidatos em ${formatMs(run.durationMs)} (${lensSummary})`
      );

      const topCandidates = run.candidates.slice(0, TOP_EXAMPLES);
      console.log(`  Top ${topCandidates.length} candidatos:`);
      topCandidates.forEach((candidate, index) => {
        printCandidateExample(candidate, index);
      });
      console.log("");
    }

    const performance = scoreProviderPerformance(providerRuns);
    providerSummaries.push({
      providerId,
      ...performance
    });

    console.log(
      `  Resumo ${providerId}: ${performance.totalCandidates} candidatos | tempo total ${formatMs(performance.totalDurationMs)} | score medio ${performance.avgScore.toFixed(1)} | lentes ${performance.lensCoverage}/3\n`
    );
  }

  const allCandidates = allRuns.flatMap((run) =>
    run.candidates.map((candidate) => ({
      ...candidate,
      nicheLabel: run.nicheLabel
    }))
  );

  const totalCandidates = allCandidates.length;
  const totalDurationMs = allRuns.reduce((sum, run) => sum + run.durationMs, 0);

  const rankedProviders = [...providerSummaries].sort(
    (left, right) => right.performanceScore - left.performanceScore
  );

  const interesting = pickInterestingCandidates(allCandidates);

  console.log("=== RESUMO GERAL ===\n");
  console.log(`Total de candidatos: ${totalCandidates}`);
  console.log(`Tempo total de execucao: ${formatMs(totalDurationMs)}`);
  console.log(
    `Cobertura temporal global: past=${allCandidates.filter((c) => c.metadata?.temporalLens === "past").length}, present=${allCandidates.filter((c) => c.metadata?.temporalLens === "present").length}, future=${allCandidates.filter((c) => c.metadata?.temporalLens === "future").length}`
  );

  console.log("\nProviders com melhor performance:");
  for (const [index, summary] of rankedProviders.entries()) {
    console.log(
      `  ${index + 1}. ${summary.providerId} — candidatos=${summary.totalCandidates}, score medio=${summary.avgScore.toFixed(1)}, lentes=${summary.lensCoverage}/3, future=${summary.futureSignals}, tempo=${formatMs(summary.totalDurationMs)}`
    );
  }

  console.log("\nConteudo mais interessante / raro encontrado:");
  interesting.forEach((candidate, index) => {
    const lens = candidate.metadata?.temporalLens ?? "unknown";
    const intent = candidate.metadata?.searchIntent ?? "n/a";
    console.log(
      `  ${index + 1}. [${candidate.providerId}/${candidate.nicheLabel}] ${lens}/${intent} score=${candidate.score}`
    );
    console.log(`     ${candidate.title}`);
    console.log(`     ${candidate.sourceUrl}`);
    if (candidate.reasons[0]) {
      console.log(`     -> ${candidate.reasons[0]}`);
    }
  });

  console.log("\n=== TESTE CONCLUIDO COM SUCESSO ===");

  console.log(
    JSON.stringify(
      {
        test: "discovery-providers",
        status: "completed",
        providers: PROVIDER_IDS,
        niches: TEST_NICHES.map((item) => item.label),
        targetCount: TARGET_COUNT,
        totalCandidates,
        totalDurationMs: Number(totalDurationMs.toFixed(1)),
        topProviders: rankedProviders.slice(0, 3).map((item) => item.providerId),
        interestingSamples: interesting.map((candidate) => ({
          providerId: candidate.providerId,
          niche: candidate.nicheLabel,
          title: candidate.title,
          score: candidate.score,
          temporalLens: candidate.metadata?.temporalLens ?? null,
          searchIntent: candidate.metadata?.searchIntent ?? null
        }))
      },
      null,
      2
    )
  );
}

await main();