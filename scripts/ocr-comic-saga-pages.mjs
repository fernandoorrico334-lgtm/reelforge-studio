import { readdir, writeFile } from "node:fs/promises";
import { basename, extname, join, resolve } from "node:path";
import { createWorker } from "tesseract.js";

function arg(name, fallback = null) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] ?? fallback : fallback;
}

const pageDir = resolve(arg("--page-dir") ?? "");
const outputPath = resolve(arg("--output") ?? "comic-page-ocr.json");
const languages = arg("--languages", "por+eng");
const langPath = resolve(process.env.REELFORGE_TESSDATA_DIR ?? "storage/ocr/tessdata");
const imageExtensions = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const pages = (await readdir(pageDir, { withFileTypes: true }))
  .filter((entry) => entry.isFile() && imageExtensions.has(extname(entry.name).toLowerCase()))
  .map((entry) => join(pageDir, entry.name))
  .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));

const worker = await createWorker(languages, 1, {
  langPath,
  gzip: true,
  cacheMethod: "readOnly",
  logger: () => {},
});
await worker.setParameters({
  tessedit_pageseg_mode: "11",
  preserve_interword_spaces: "1",
});

const results = [];
try {
  for (let index = 0; index < pages.length; index += 1) {
    const pagePath = pages[index];
    const result = await worker.recognize(pagePath);
    const text = String(result.data.text ?? "")
      .replace(/\r/g, "")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    results.push({
      page: basename(pagePath),
      pageNumber: Number.parseInt(basename(pagePath).replace(/\D/g, ""), 10),
      confidence: Number((result.data.confidence ?? 0).toFixed(2)),
      text,
    });
    console.log(`page=${index + 1}/${pages.length} confidence=${results.at(-1).confidence}`);
  }
} finally {
  await worker.terminate();
}

await writeFile(outputPath, JSON.stringify({
  engine: "tesseract-js",
  languages,
  pageCount: results.length,
  pages: results,
}, null, 2), "utf8");
console.log(outputPath);
