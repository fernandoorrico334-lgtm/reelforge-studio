import { writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { ingestLocalComicSource } from "../packages/media-beast/dist/index.js";

const root = resolve(decodeURIComponent(new URL("..", import.meta.url).pathname).replace(/^\/(.:)/, "$1"));
const downloads = "C:/Users/Pichau/Downloads";
const sagaSlug = "batman-green-arrow-question-arc";
const sources = [
  "Btmn ArqrVrd Qst Arcd #01 de 04 (2025) (DarkseidClub).cbr",
  "Btmn ArqrVrd Qst Arcd #02 de 04 (2025) (DarkseidClub).cbr",
  "Btmn ArqrVrd Qst Arcd #03 de 04 (2025) (DarkseidClub).cbr",
];

const issues = [];
for (let index = 0; index < sources.length; index += 1) {
  const issueNumber = index + 1;
  const result = await ingestLocalComicSource({
    sourcePath: join(downloads, sources[index]),
    assetDirectory: join(root, "storage/assets/comics", sagaSlug, `issue-${String(issueNumber).padStart(2, "0")}`),
    comicTitle: `Batman, Arqueiro Verde e Questao - Edicao ${issueNumber}`,
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
  sagaId: sagaSlug,
  expectedIssueCount: 4,
  availableIssueCount: issues.length,
  isComplete: issues.length === 4,
  totalPageCount: issues.reduce((sum, issue) => sum + issue.pageCount, 0),
  issues,
  warnings: issues.length === 4 ? [] : ["issue_04_not_provided_story_must_not_invent_its_resolution"],
}, null, 2), "utf8");

console.log(sagaManifestPath);
