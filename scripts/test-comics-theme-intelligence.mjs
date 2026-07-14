import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
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

const TEST_CASES = [
  {
    id: "venom-catalog-covers",
    videoTitle: "O Venom Encontrou o Parceiro Perfeito",
    narrationText:
      "Venom encontra parceiro perfeito — simbiose, dupla ideal entre hospedeiro e simbionte.",
    entities: ["Venom", "Homem-Aranha"],
    expectedThemes: ["partnership"],
    expectedRelationship: "duo",
    hookAsset: "O ESPETACULAR HOMEM-ARANHA/VENOM: Espiral Mortal (2026) — Marvel comic cover",
    climaxAsset: "SIMBIONTE HOMEM-ARANHA — Marvel comic cover",
    offThemeAsset: "Homem-Aranha 2099 multiverse variant comic cover"
  },
  {
    id: "venom-partner",
    videoTitle: "O Venom Encontrou o Parceiro Perfeito!!",
    narrationText:
      "Venom encontra parceiro perfeito — simbiose, dupla ideal e ligação entre hospedeiro e simbionte.",
    entities: ["Venom", "Homem-Aranha"],
    expectedThemes: ["partnership", "symbiosis"],
    expectedRelationship: "duo",
    hookAsset: "Venom Spider-Man symbiote bond comic panel duo",
    climaxAsset: "Spider-Man black suit symbiote transformation comic cover",
    offThemeAsset: "Homem-Aranha 2099 multiverse variant comic cover"
  },
  {
    id: "batman-joker",
    videoTitle: "Batman vs Coringa: o confronto definitivo",
    narrationText: "O rival eterno de Batman volta para um duelo brutal no coração de Gotham.",
    entities: ["Batman", "Coringa"],
    expectedThemes: ["rivalry"],
    expectedRelationship: "hero_vs_villain",
    hookAsset: "Batman vs Joker duel comic panel confrontation",
    climaxAsset: "Batman Joker face-off comic cover battle",
    offThemeAsset: "Batman Robin team up comic cover partnership"
  },
  {
    id: "spider-multiverse",
    videoTitle: "Homem-Aranha no multiverso",
    narrationText: "Variantes do Aranhaverso aparecem juntas em uma viagem pelo multiverso.",
    entities: ["Homem-Aranha"],
    expectedThemes: ["multiverse"],
    expectedRelationship: "multiverse_variant",
    hookAsset: "Spider-Man Spider-Verse multiverse comic cover variants",
    climaxAsset: "Homem-Aranha 2099 multiverse variant comic splash page",
    offThemeAsset: "Spider-Man vs Venom rivalry duel comic panel"
  },
  {
    id: "wolverine-deadpool",
    videoTitle: "Wolverine e Deadpool juntos",
    narrationText: "A dupla mais caótica da Marvel finalmente faz team up em missão suicida.",
    entities: ["Wolverine", "Deadpool"],
    expectedThemes: ["team_up", "partnership"],
    expectedRelationship: "duo",
    hookAsset: "Wolverine Deadpool team up comic panel duo together",
    climaxAsset: "Wolverine and Deadpool assemble comic cover group shot",
    offThemeAsset: "Wolverine solo origin first appearance comic cover"
  },
  {
    id: "superman-origin",
    videoTitle: "A origem do Superman",
    narrationText: "Como nasceu o herói mais poderoso da Terra — primeira aparição e revelação de poder.",
    entities: ["Superman"],
    expectedThemes: ["origin", "power_reveal"],
    expectedRelationship: "unknown",
    hookAsset: "Superman origin first appearance issue #1 comic cover",
    climaxAsset: "Superman power reveal splash page final form comic",
    offThemeAsset: "Superman Batman team up comic cover duo"
  },
  {
    id: "phoenix-transform",
    videoTitle: "Fênix: a transformação de Jean Grey",
    narrationText: "A transformação final libera o poder da Fênix em uma metamorfose devastadora.",
    entities: ["Jean Grey", "Fênix"],
    expectedThemes: ["transformation", "power_reveal"],
    expectedRelationship: "unknown",
    hookAsset: "Jean Grey Phoenix transformation comic panel metamorphosis",
    climaxAsset: "Phoenix force power reveal splash page comic art",
    offThemeAsset: "X-Men team assemble comic cover group"
  },
  {
    id: "thanos-infinity",
    videoTitle: "Thanos e as Joias do Infinito",
    narrationText: "O caos cósmico começa quando Thanos manifesta o poder das Joias do Infinito.",
    entities: ["Thanos"],
    expectedThemes: ["chaos", "power_reveal"],
    expectedRelationship: "unknown",
    hookAsset: "Thanos infinity gauntlet chaos comic splash page",
    climaxAsset: "Thanos apocalypse destruction power reveal comic panel",
    offThemeAsset: "Thanos redemption second chance comic cover"
  },
  {
    id: "spawn-corruption",
    videoTitle: "Spawn e a corrupção do inferno",
    narrationText: "Spawn enfrenta a corrupção demoníaca vinda direto do inferno.",
    entities: ["Spawn"],
    expectedThemes: ["corruption"],
    expectedRelationship: "unknown",
    hookAsset: "Spawn hell corruption demonic comic panel",
    climaxAsset: "Spawn inferno corruption comic cover darkness",
    offThemeAsset: "Spawn redemption heroic comic cover"
  }
];

async function main() {
  const beast = await importMediaBeast();
  const {
    analyzeComicsVideoTheme,
    buildComicsThemeIntelligenceReport,
    scoreAssetForThemedSelection,
    selectAssetForThemedBeat
  } = beast;

  const reports = [];

  for (const testCase of TEST_CASES) {
    const analysis = analyzeComicsVideoTheme({
      videoTitle: testCase.videoTitle,
      narrationText: testCase.narrationText,
      entities: testCase.entities
    });

    assert(
      testCase.expectedThemes.some((theme) => analysis.narrativeThemes.includes(theme)),
      `${testCase.id}: expected one of [${testCase.expectedThemes}] in ${analysis.narrativeThemes}`
    );
    assert(
      analysis.relationshipType === testCase.expectedRelationship,
      `${testCase.id}: expected relationship ${testCase.expectedRelationship}, got ${analysis.relationshipType}`
    );
    assert(analysis.recommendedAssetSignals.length >= 2, `${testCase.id}: expected recommended signals`);
    assert(analysis.disallowedAssetSignals.length >= 0, `${testCase.id}: disallowed signals missing`);

    const candidates = [testCase.hookAsset, testCase.climaxAsset, testCase.offThemeAsset].map(
      (title, index) =>
        scoreAssetForThemedSelection({
          id: `${testCase.id}-${index}`,
          title,
          category: /panel/i.test(title) ? "comic_panel" : "comic_cover",
          assetQualityScore: 90,
          themeAnalysis: analysis
        })
    );

    const hookPick = selectAssetForThemedBeat({
      beatRole: "hook",
      themeAnalysis: analysis,
      acceptedAssets: candidates
    });
    const climaxPick = selectAssetForThemedBeat({
      beatRole: "climax",
      themeAnalysis: analysis,
      acceptedAssets: candidates,
      excludeIds: hookPick.asset ? [hookPick.asset.id] : []
    });

    assert(hookPick.asset, `${testCase.id}: hook selection failed`);
    assert(climaxPick.asset, `${testCase.id}: climax selection failed`);
    assert(
      hookPick.asset.title === testCase.hookAsset,
      `${testCase.id}: hook expected "${testCase.hookAsset}", got "${hookPick.asset.title}"`
    );
    assert(
      climaxPick.asset.title === testCase.climaxAsset,
      `${testCase.id}: climax expected "${testCase.climaxAsset}", got "${climaxPick.asset.title}"`
    );

    const offTheme = candidates.find((c) => c.title === testCase.offThemeAsset);
    assert(offTheme, `${testCase.id}: off-theme candidate missing`);
    assert(
      offTheme.themedFinalScore < hookPick.asset.themedFinalScore,
      `${testCase.id}: off-theme asset should score below hook (${offTheme.themedFinalScore} vs ${hookPick.asset.themedFinalScore})`
    );

    const report = buildComicsThemeIntelligenceReport({
      videoTitle: testCase.videoTitle,
      narrationText: testCase.narrationText,
      entities: testCase.entities,
      candidateAssets: candidates.map((c) => ({
        id: c.id,
        title: c.title,
        category: c.category,
        assetQualityScore: c.assetQualityScore
      }))
    });

    reports.push({
      caseId: testCase.id,
      ...report,
      validation: {
        hookPick: hookPick.asset.title,
        climaxPick: climaxPick.asset.title,
        offThemeScore: offTheme.themedFinalScore,
        hookScore: hookPick.asset.themedFinalScore
      }
    });
  }

  const outputPath = join(projectRoot, "tmp", "comics-theme-intelligence-report.json");
  await mkdir(join(projectRoot, "tmp"), { recursive: true });
  await writeFile(
    outputPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        passed: TEST_CASES.length,
        cases: reports
      },
      null,
      2
    ),
    "utf8"
  );

  console.log(
    JSON.stringify(
      {
        passed: TEST_CASES.length,
        reportPath: outputPath,
        cases: reports.map((entry) => ({
          id: entry.caseId,
          themes: entry.analysis.narrativeThemes,
          relationship: entry.analysis.relationshipType,
          hook: entry.validation.hookPick,
          climax: entry.validation.climaxPick
        }))
      },
      null,
      2
    )
  );
  console.log("[test] comics theme intelligence: OK");
}

main().catch((error) => {
  console.error("[test] comics theme intelligence: FAIL");
  console.error(error);
  process.exit(1);
});