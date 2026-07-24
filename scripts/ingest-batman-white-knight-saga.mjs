import { writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { ingestLocalComicSource } from "../packages/media-beast/dist/index.js";

const root = resolve(decodeURIComponent(new URL("..", import.meta.url).pathname).replace(/^\/(.:)/, "$1"));
const downloads = "C:/Users/Pichau/Downloads";
const sagaSlug = "batman-white-knight-complete-saga";
const sources = [
  "Batman - Cavaleiro Branco #1 (de 8) (2017) (c) (SQ).cbr",
  "Batman - Cavaleiro Branco #2 (de 8) (2018) (c) (SQ).cbr",
  "Batman - Cavaleiro Branco #3 (de 8) (2018) (c) (SQ).cbr",
  "Batman - Cavaleiro Branco #4 (de 8) (2018) (SQ).cbr",
  "Batman - Cavaleiro Branco #5 (de 8) (2018) (ZF).cbr",
  "Batman - Cavaleiro Branco #6 (de 8) (2018) (SQ-ZF).cbr",
  "Batman - Cavaleiro Branco #7 (de 8) (2018) (SQ-ZF).cbr",
  "Batman - Cavaleiro Branco #8 (de 8) (2018) (SQ-ZF).cbr",
];

const issues = [];
for (let index = 0; index < sources.length; index += 1) {
  const issueNumber = index + 1;
  const result = await ingestLocalComicSource({
    sourcePath: join(downloads, sources[index]),
    assetDirectory: join(root, "storage/assets/comics", sagaSlug, `issue-${String(issueNumber).padStart(2, "0")}`),
    comicTitle: `Batman - Cavaleiro Branco #${issueNumber}`,
    projectRoot: root,
    buildIndex: false,
  });
  issues.push({
    issueNumber,
    sourcePath: result.sourcePath,
    assetDirectory: result.assetDirectory,
    pageCount: result.pageCount,
    manifestPath: result.manifestPath,
    warnings: result.warnings,
  });
  console.log(`issue=${issueNumber} pages=${result.pageCount}`);
}

const sagaManifestPath = join(root, "storage/assets/comics", sagaSlug, "saga-manifest.json");
await writeFile(sagaManifestPath, JSON.stringify({
  sagaId: "batman-white-knight-complete-saga",
  title: "Batman - Cavaleiro Branco",
  issueCount: issues.length,
  totalPageCount: issues.reduce((sum, issue) => sum + issue.pageCount, 0),
  issues,
}, null, 2), "utf8");
console.log(sagaManifestPath);
