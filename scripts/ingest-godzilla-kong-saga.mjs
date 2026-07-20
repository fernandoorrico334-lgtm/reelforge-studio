import { writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { ingestLocalComicSource } from "../packages/media-beast/dist/index.js";

const root = resolve(decodeURIComponent(new URL("..", import.meta.url).pathname).replace(/^\/(.:)/, "$1"));
const downloads = "C:/Users/Pichau/Downloads";
const sources = [
  "Liga da Justiça vs Godzilla vs Kong #01 (2023) (SQ&ZF).cbr",
  "Liga da Justiça vs Godzilla vs Kong #02 (2024) (SoQuadrinhos).cbr",
  "Liga da Justiça vs Godzilla vs Kong #03 (2024) (SoQuadrinhos).cbr",
  "Liga da Justiça vs Godzilla vs Kong #04 (2024) (SoQuadrinhos).cbr",
  "Liga da Justiça vs Godzilla vs Kong #05 (2024) (SoQuadrinhos).cbr",
  "Liga da Justiça vs Godzilla vs Kong #06 (2024) (SoQuadrinhos).cbr",
  "Liga da Justiça vs Godzilla vs Kong #07 (2024) (SoQuadrinhos).cbr",
];

const issues = [];
for (let index = 0; index < sources.length; index += 1) {
  const issueNumber = index + 1;
  const result = await ingestLocalComicSource({
    sourcePath: join(downloads, sources[index]),
    assetDirectory: join(root, "storage/assets/comics/godzilla-kong-complete-saga", `issue-${String(issueNumber).padStart(2, "0")}`),
    comicTitle: `Liga da Justiça vs Godzilla vs Kong #${issueNumber}`,
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

const sagaManifestPath = join(root, "storage/assets/comics/godzilla-kong-complete-saga/saga-manifest.json");
await writeFile(sagaManifestPath, JSON.stringify({
  sagaId: "justice-league-vs-godzilla-vs-kong-complete-saga",
  issueCount: issues.length,
  totalPageCount: issues.reduce((sum, issue) => sum + issue.pageCount, 0),
  issues,
}, null, 2), "utf8");
console.log(sagaManifestPath);
