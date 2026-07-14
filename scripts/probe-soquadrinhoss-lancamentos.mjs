import { writeFile } from "node:fs/promises";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const url = "https://soquadrinhoss.blogspot.com/p/lancamentos.html";

const response = await fetch(url, {
  headers: { "user-agent": "ReelForgeStudio/1.0 (+comics-discovery)" }
});
const html = await response.text();
await writeFile(join(root, "tmp/soquadrinhoss-lancamentos.html"), html, "utf8");

const scriptBlocks = html.match(/<script[\s\S]*?<\/script>/gi) ?? [];
for (const [index, block] of scriptBlocks.entries()) {
  if (/lancamento|supabase|fetch\(|api|json|firebase|sheet/i.test(block)) {
    console.log(`--- script ${index} ---`);
    console.log(block.slice(0, 1200));
  }
}

const urls = [...html.matchAll(/(?:src|href)=["']([^"']+)["']/gi)].map((m) => m[1]);
console.log(
  "\ninteresting urls:",
  urls.filter((u) => /script|api|json|supabase|lancamento|sheet|firebase/i.test(u))
);