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
  const { parseOsinvisiveisPartnerLinks, discoverOsinvisiveisPartnerCatalogAssets } = beast;

  const labelHtml = await readFile(
    join(projectRoot, "tmp/blogspot-sources/osinvisiveis.html"),
    "utf8"
  );
  const homeHtml = await readFile(
    join(projectRoot, "tmp/blogspot-sources/osinvisiveis-home.html"),
    "utf8"
  );

  const partners = parseOsinvisiveisPartnerLinks(labelHtml);
  assert(partners.length >= 20, `expected many partner links (${partners.length})`);

  const crawlable = partners.filter((partner) => partner.crawlable);
  const integrated = partners.filter((partner) => partner.alreadyIntegrated);
  assert(crawlable.length >= 15, `expected crawlable blogs (${crawlable.length})`);
  assert(integrated.some((p) => /soquadrinhos|ndrangheta|podermarvel/i.test(p.host)), "known integrated");

  const categories = new Set(partners.map((p) => p.category));
  assert(categories.has("Família") || categories.has("parceiros"), "widget categories parsed");

  const offline = await discoverOsinvisiveisPartnerCatalogAssets({
    entities: ["Marvel", "Venom", "Homem-Aranha"],
    pageHtml: labelHtml,
    maxPartners: 6,
    maxCandidates: 12,
    partnerHtmlByUrl: {
      "https://dcinfinita.blogspot.com/": homeHtml,
      "https://mundobonelli.blogspot.com/": labelHtml
    },
    fetchFn: async (url) => {
      const normalized = String(url).replace(/\/$/, "");
      if (normalized.includes("dcinfinita") || normalized.includes("mundobonelli")) {
        return new Response(labelHtml, { status: 200 });
      }
      return new Response("", { status: 404 });
    }
  });

  assert(offline.partners.length >= 20, "partner registry returned");
  console.log(
    `[osinvisiveis-partners] OK — total=${partners.length} crawlable=${crawlable.length} integrated=${integrated.length} offlineCandidates=${offline.candidates.length}`
  );
  console.log(
    "sample partners:",
    partners
      .slice(0, 8)
      .map((p) => `${p.category}:${p.host}${p.alreadyIntegrated ? " [integrated]" : ""}`)
      .join(" | ")
  );
}

main().catch((error) => {
  console.error("[osinvisiveis-partners] FAIL");
  console.error(error);
  process.exit(1);
});