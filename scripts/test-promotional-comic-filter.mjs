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
  const { isPromotionalComicVisual } = await importMediaBeast();

  const narrative = isPromotionalComicVisual({
    title: "O ESPETACULAR HOMEM-ARANHA/VENOM: Espiral Mortal (2026) — página 7"
  });
  assert(!narrative.reject, "narrative page should be accepted");

  const qr = isPromotionalComicVisual({
    detectedText: ["Escaneie o QR Code para acompanhar onde você estiver"]
  });
  assert(qr.reject && qr.reason === "qr_code", "QR page should be rejected");

  const catalog = isPromotionalComicVisual({
    detectedText: ["Transformers", "Geração X", "Mulher-Hulk", "descubra novas histórias"]
  });
  assert(catalog.reject, "catalog ad with unrelated covers should be rejected");

  const editorial = isPromotionalComicVisual({
    detectedText: ["Marvel checklist editorial credits"]
  });
  assert(editorial.reject, "editorial/checklist page should be rejected");

  const nextIssue = isPromotionalComicVisual({
    detectedText: ["Next issue on sale now"]
  });
  assert(nextIssue.reject && nextIssue.reason === "next_issue_page", "next issue page should be rejected");

  const fcbd = isPromotionalComicVisual({
    title: "DIA DO QUADRINHO GRÁTIS: HOMEM-ARANHA/VENOM — página 4"
  });
  assert(fcbd.reject && fcbd.reason === "fcbd_promotional_sampler", "FCBD sampler should be rejected");

  console.log(
    JSON.stringify(
      {
        narrative,
        qr,
        catalog,
        editorial,
        nextIssue,
        fcbd
      },
      null,
      2
    )
  );
  console.log("[test] promotional comic filter: OK");
}

main().catch((error) => {
  console.error("[test] promotional comic filter: FAIL");
  console.error(error);
  process.exit(1);
});