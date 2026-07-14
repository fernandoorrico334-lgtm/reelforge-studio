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

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function main() {
  const beast = await importMediaBeast();
  const {
    extractComicsDownloadLinksFromHtml,
    extractPostTitleFromHtml,
    ingestComicsCatalogPanelsFromPost,
    extractPanelImagesFromComicsArchive,
    isSubstantiveComicsAssetUrl,
    evaluateComicsAssetQuality,
    isComicsCatalogDownloadCandidate
  } = beast;

  const postHtml = await readFile(join(projectRoot, "tmp/multiversohq-post.html"), "utf8");
  const links = extractComicsDownloadLinksFromHtml(postHtml);
  assert(links.length >= 1, "post should expose at least one download link");
  assert(/workupload\.com/i.test(links[0].url), "first link should be workupload");

  const title = extractPostTitleFromHtml(postHtml, "https://multiversohq.com/homem-aranha-a-morte-de-gwen-stacy/");
  assert(/gwen stacy/i.test(title), `title parsed (${title})`);

  const live = process.argv.includes("--live-download");
  if (!live) {
    console.log(
      `[comics-download-ingestion] OK offline — links=${links.length} host=${links[0].host} title="${title}"`
    );
    console.log("Run with --live-download to fetch CBZ panels (requires network).");
    return;
  }

  let panelCandidate = null;
  const result = await ingestComicsCatalogPanelsFromPost({
    postUrl: "https://multiversohq.com/homem-aranha-a-morte-de-gwen-stacy/",
    postHtml,
    postTitle: title,
    entities: ["Homem-Aranha", "Venom"],
    franchise: "Marvel",
    catalogSource: "multiversohq_catalog",
    projectRoot,
    maxPanels: 3,
    userApprovedDownload: true
  });

  if (!result.skippedReason && result.candidates.length >= 2) {
    panelCandidate = result.candidates[0];
  } else {
    const cachedArchive = join(projectRoot, "tmp/comics-download/test.cbz");
    const panels = await extractPanelImagesFromComicsArchive({
      archivePath: cachedArchive,
      outputDir: join(projectRoot, "tmp/comics-download/panel-test"),
      maxPanels: 3
    });
    assert(panels.length >= 2, `cached archive should yield panels (${panels.length})`);
    panelCandidate = {
      title: `${title} — comic panel p1 (catalog download)`,
      sourceUrl: panels[0].relativePath,
      metadata: { discoverySource: "comics_catalog_download_ingestion", query: `${title} Marvel comic panel` }
    };
    console.warn(
      `[comics-download-ingestion] live download skipped (${result.skippedReason ?? "unknown"}); used cached CBZ`
    );
  }

  assert(panelCandidate, "panel candidate required");
  if (panelCandidate.id) {
    assert(
      isComicsCatalogDownloadCandidate(panelCandidate),
      "candidate should be catalog download ingestion"
    );
  }
  const panelSourceUrl = panelCandidate.sourceUrl.replace(/\\/g, "/");
  const substantive = isSubstantiveComicsAssetUrl(
    /storage\/assets\//i.test(panelSourceUrl)
      ? panelSourceUrl
      : `storage/assets/comics-catalog-panels/offline/${panelSourceUrl.split("/").pop()}`
  );
  assert(substantive.ok, `panel path should be substantive (${substantive.reason})`);

  const quality = evaluateComicsAssetQuality({
    title: panelCandidate.title,
    description: panelCandidate.metadata.query,
    sourceUrl: panelCandidate.sourceUrl,
    entities: ["Homem-Aranha"],
    franchise: "Marvel",
    targetStyle: "comics",
    requireSubstantiveUrl: true
  });
  assert(quality.ok, `panel should pass gate (${quality.rejectReason})`);
  assert(quality.category === "comic_panel", `expected comic_panel (${quality.category})`);

  console.log(
    `[comics-download-ingestion] OK live — panels=${result.panelAssets?.length ?? "cached"} archiveBytes=${result.archiveBytes ?? "n/a"}`
  );
}

main().catch((error) => {
  console.error("[comics-download-ingestion] FAIL");
  console.error(error);
  process.exit(1);
});