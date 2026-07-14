import { readFile } from "node:fs/promises";
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
  const {
    runIntelligentComicsDiscovery,
    saveIntelligentComicsDiscoveryReport,
    importAcceptedPanelsToUserProvided
  } = beast;

  const planPath = join(projectRoot, "tmp", "variation-b-gated-plan.json");
  const plan = JSON.parse(await readFile(planPath, "utf8"));

  const report = await runIntelligentComicsDiscovery({
    analysis: plan.videoAnalysis,
    variation: "B — Comics",
    projectRoot,
    userApprovedDownload: true,
    maxComicsToDownload: Number(process.env.MAX_COMICS_TO_DOWNLOAD ?? 5),
    minTopicScore: Number(process.env.MIN_TOPIC_SCORE ?? 30)
  });

  const reportPath = await saveIntelligentComicsDiscoveryReport(report, projectRoot);

  let importResult = null;
  if (
    report.totalOnThemePages > 0 &&
    process.env.AUTO_IMPORT_PANELS !== "false"
  ) {
    importResult = await importAcceptedPanelsToUserProvided({
      report,
      projectRoot,
      maxPanels: Number(process.env.MAX_PANELS_TO_IMPORT ?? 16)
    });
  }

  const summary = {
    mode: report.mode,
    narrativeSubject: report.narrativeSubject.subjectTheme,
    resolvedTitles: report.resolvedTitles.length,
    downloadableMatches: report.downloadableMatches.length,
    comicsDownloaded: report.ingestions.length,
    totalPagesExtracted: report.totalPagesExtracted,
    totalOnThemePages: report.totalOnThemePages,
    acceptedPanelCandidates: report.acceptedPanelCandidates.length,
    recommendation: report.recommendation,
    topResolvedTitles: report.resolvedTitles.slice(0, 16).map((entry) => ({
      title: entry.title,
      topicScore: entry.topicScore,
      source: entry.source,
      matchedSignals: entry.matchedSignals.slice(0, 6),
      postUrl: entry.postUrl,
      hasDownloadLink: entry.hasDownloadLink,
      downloadHost: entry.downloadHost
    })),
    downloadablePosts: report.downloadableMatches.slice(0, 10).map((entry) => ({
      title: entry.title,
      postUrl: entry.postUrl,
      topicScore: entry.topicScore,
      matchedSignals: entry.matchedSignals.slice(0, 5),
      downloadHost: entry.downloadHost
    })),
    ingestions: report.ingestions.map((entry) => ({
      title: entry.resolvedTitle.title,
      postUrl: entry.resolvedTitle.postUrl,
      pagesExtracted: entry.totalPagesExtracted,
      onThemePages: entry.onThemePages.length,
      topOnThemePages: entry.onThemePages.slice(0, 5).map((page) => ({
        pageIndex: page.pageIndex,
        themeScore: page.themeScore,
        signals: page.positiveSignals.slice(0, 4)
      })),
      skippedReason: entry.ingestion.skippedReason
    })),
    importResult,
    reportPath
  };

  console.log(JSON.stringify(summary, null, 2));
  console.log(`[intelligent-discovery] Relatório: ${reportPath}`);
}

main().catch((error) => {
  console.error("[intelligent-discovery] FAIL");
  console.error(error);
  process.exit(1);
});