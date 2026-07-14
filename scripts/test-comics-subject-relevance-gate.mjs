import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");

async function importMediaBeast() {
  return import(
    pathToFileURL(resolve(projectRoot, "packages/media-beast/dist/index.js")).href
  );
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const VIDEO_CONTEXT = {
  videoTitle: "O Venom Encontrou o Parceiro Perfeito!!",
  narrativeTheme:
    "O clipe mostra Venom encontrando parceiro perfeito — simbiose, dupla ideal e ligação entre personagem e simbionte.",
  curiosityAngle:
    "O que torna essa dupla perfeita vem dos quadrinhos — simbiose, traje preto e a ligação Venom/Homem-Aranha.",
  entities: ["Venom", "Homem-Aranha"],
  actions: ["Parceiro ideal / simbiose"],
  targetStyle: "comics"
};

const STRONG_CASES = [
  "Venom Spider-Man symbiote bond comic panel",
  "Spider-Man black suit symbiote comic cover",
  "Eddie Brock Venom symbiote host comic art",
  "Venom and Spider-Man comic panel",
  "Venom symbiote transformation comic page"
];

const SUPPORT_CASES = [
  "Venom comic cover",
  "Spider-Man vs Venom comic panel",
  "Marvel Venom character art"
];

const WEAK_CASES = [
  {
    title: "Anti-Venom New Ways To Live comic cover",
    maxRelevance: "generic_entity_match"
  },
  {
    title: "Venom logo wordmark",
    expectReject: true
  },
  {
    title: "Marvel checklist text page letters only",
    expectReject: true
  },
  {
    title: "random Spider-Man fight panel generic action",
    maxRelevance: "weak_match"
  },
  {
    title: "generic marvel city splash page without symbiote partner context",
    expectReject: true
  }
];

async function main() {
  const beast = await importMediaBeast();
  const {
    evaluateAssetSubjectRelevance,
    scoreAssetForSubjectSelection,
    deriveSubjectTheme,
    selectAssetForNarrativeBeat,
    isClimaxSubjectAligned
  } = beast;

  const results = [];

  for (const title of STRONG_CASES) {
    const result = evaluateAssetSubjectRelevance({
      ...VIDEO_CONTEXT,
      assetTitle: title,
      assetCategory: /cover/i.test(title) ? "comic_cover" : "comic_panel"
    });
    results.push({ id: title, ...result });
    assert(
      result.relevance === "direct_subject_match" && result.ok && result.score >= 50,
      `strong case failed: ${title} -> ${result.relevance} score=${result.score}`
    );
  }

  for (const title of SUPPORT_CASES) {
    const result = evaluateAssetSubjectRelevance({
      ...VIDEO_CONTEXT,
      assetTitle: title,
      assetCategory: /cover/i.test(title) ? "comic_cover" : /art/i.test(title) ? "character_art" : "comic_panel"
    });
    results.push({ id: title, ...result });
    assert(
      (result.relevance === "supporting_context" || result.relevance === "direct_subject_match") &&
        result.ok,
      `support case failed: ${title} -> ${result.relevance} ok=${result.ok}`
    );
  }

  for (const entry of WEAK_CASES) {
    const result = evaluateAssetSubjectRelevance({
      ...VIDEO_CONTEXT,
      assetTitle: entry.title,
      assetCategory: "comic_cover"
    });
    results.push({ id: entry.title, ...result });
    if (entry.expectReject) {
      assert(!result.ok, `weak case should reject: ${entry.title}`);
    }
    if (entry.maxRelevance) {
      const order = [
        "reject",
        "weak_match",
        "generic_entity_match",
        "supporting_context",
        "direct_subject_match"
      ];
      assert(
        order.indexOf(result.relevance) <= order.indexOf(entry.maxRelevance),
        `weak case too strong: ${entry.title} -> ${result.relevance}`
      );
    }
  }

  const narrativeContext = {
    videoTitle: VIDEO_CONTEXT.videoTitle,
    narrativeTheme: VIDEO_CONTEXT.narrativeTheme,
    curiosityAngle: VIDEO_CONTEXT.curiosityAngle,
    entities: VIDEO_CONTEXT.entities,
    actions: VIDEO_CONTEXT.actions,
    subjectTheme: deriveSubjectTheme({
      videoTitle: VIDEO_CONTEXT.videoTitle,
      narrativeTheme: VIDEO_CONTEXT.narrativeTheme,
      curiosityAngle: VIDEO_CONTEXT.curiosityAngle,
      actions: VIDEO_CONTEXT.actions
    })
  };

  const climaxCandidate = scoreAssetForSubjectSelection({
    id: "climax-venom-spiderman",
    title: "O ESPETACULAR HOMEM-ARANHA/VENOM: Espiral Mortal (2026) — Marvel comic cover (Poder Marvel — Blogspot)",
    category: "comic_cover",
    assetQualityScore: 100,
    context: narrativeContext,
    targetStyle: "comics"
  });

  assert(isClimaxSubjectAligned(climaxCandidate), "supporting Venom+Spidey cover should align for climax");
  const climaxSelection = selectAssetForNarrativeBeat({
    beatRole: "climax",
    beatText: VIDEO_CONTEXT.curiosityAngle,
    videoTitle: VIDEO_CONTEXT.videoTitle,
    narrativeTheme: VIDEO_CONTEXT.narrativeTheme,
    acceptedAssets: [climaxCandidate]
  });
  assert(
    climaxSelection.asset?.id === "climax-venom-spiderman",
    `climax should pick supporting duo cover, got ${climaxSelection.asset?.id ?? "null"} (${climaxSelection.reason})`
  );

  const passed = results.length;
  console.log(
    JSON.stringify(
      {
        passed,
        strong: STRONG_CASES.length,
        support: SUPPORT_CASES.length,
        weak: WEAK_CASES.length,
        climaxSelection: {
          assetId: climaxSelection.asset?.id ?? null,
          reason: climaxSelection.reason
        },
        results: results.map((entry) => ({
          id: entry.id,
          ok: entry.ok,
          score: entry.score,
          relevance: entry.relevance,
          reason: entry.reason
        }))
      },
      null,
      2
    )
  );
  console.log("[test] comics subject relevance gate: OK");
}

main().catch((error) => {
  console.error("[test] comics subject relevance gate: FAIL");
  console.error(error);
  process.exit(1);
});