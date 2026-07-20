#!/usr/bin/env node
import { createWorker } from "tesseract.js";
import { resolve } from "node:path";

function argValue(args, name, fallback = null) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] ?? fallback : fallback;
}

async function main() {
  const args = process.argv.slice(2);
  const imagePath = args[0];
  if (!imagePath || imagePath === "--help" || imagePath === "-h") {
    console.error("Usage: node scripts/tesseract-js-cli.mjs <image> stdout -l por+eng --psm 6");
    process.exit(imagePath ? 0 : 1);
  }

  const languages = (argValue(args, "-l", process.env.REELFORGE_OCR_LANGUAGES ?? "por+eng") ?? "por+eng")
    .split("+")
    .map((language) => language.trim())
    .filter(Boolean)
    .join("+");
  const psm = argValue(args, "--psm", process.env.REELFORGE_OCR_PSM ?? "6") ?? "6";
  const langPath = resolve(process.env.REELFORGE_TESSDATA_DIR ?? "storage/ocr/tessdata");

  const worker = await createWorker(languages, 1, {
    langPath,
    gzip: true,
    cacheMethod: "readOnly",
    logger: () => {}
  });

  await worker.setParameters({
    tessedit_pageseg_mode: psm
  });

  const result = await worker.recognize(resolve(imagePath));
  await worker.terminate();
  process.stdout.write(result.data.text ?? "");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
