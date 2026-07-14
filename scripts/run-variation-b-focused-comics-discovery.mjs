import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");

async function importMediaBeast() {
  return import(
    pathToFileURL(join(projectRoot, "packages/media-beast/dist/index.js")).href
  );
}

async function main() {
  const beast = await importMediaBeast();
  const { readFile } = await import("node:fs/promises");
  const { runFocusedComicsDiscovery } = beast;

  const planPath = join(projectRoot, "tmp", "remix-renders", "variation-comics-full-plan.json");
  const plan = JSON.parse(await readFile(planPath, "utf8"));
  const analysis = plan.videoAnalysis;
  const entities =
    analysis.contentIntelligence?.entities?.map((entity) => entity.name) ?? [
      "Venom",
      "Homem-Aranha"
    ];
  const franchise = analysis.contentIntelligence?.entities?.[0]?.franchise ?? "Marvel";

  const enableDownload = process.argv.includes("--no-download")
    ? false
    : true;

  console.log("[focused-discovery] Variação B — Comics (modo focused_comics_discovery)");
  console.log("[focused-discovery] Fontes: SoQuadrinhos + MultiversoHQ + Blogspot + parceiros Os Invisíveis");
  console.log(
    `[focused-discovery] Download ingestion: ${enableDownload ? "ON (userApprovedDownload)" : "OFF"}`
  );

  const report = await runFocusedComicsDiscovery({
    analysis,
    entities,
    franchise,
    projectRoot,
    importTopAccepted: 12,
    ...(enableDownload
      ? {
          enableDownloadIngestion: true,
          userApprovedDownload: true,
          maxDownloadPosts: 2
        }
      : {})
  });

  const outputPath = join(projectRoot, "tmp", "variation-b-focused-comics-discovery-report.json");
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, JSON.stringify(report, null, 2), "utf8");

  console.log(JSON.stringify(report, null, 2));
  console.log(`[focused-discovery] Relatório: ${outputPath}`);
  const catalogSources = report.primaryCatalogSources?.map((source) => source.id).join(", ") ?? "";
  console.log(
    `[focused-discovery] Resumo: ${report.totalCandidatesFound} candidatos | ${report.substantiveUrlCount} substantivos | ${report.acceptedCount} aceitos | ${report.premiumAcceptedCount} premium | trueComics=${report.trueComicsAssetCount} | canRender=${report.canRender}`
  );
  console.log(`[focused-discovery] Catálogos: ${catalogSources}`);
  if (report.blockReason) {
    console.log(`[focused-discovery] Bloqueio: ${report.blockReason}`);
  }
  if (report.contactSheetPath) {
    console.log(`[focused-discovery] Contact sheet: ${report.contactSheetPath}`);
  }
}

main().catch((error) => {
  console.error("[focused-discovery] FAIL");
  console.error(error);
  process.exit(1);
});