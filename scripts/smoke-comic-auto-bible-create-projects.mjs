import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { Readable, Writable } from "node:stream";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");

async function importApi(path) {
  return import(pathToFileURL(join(projectRoot, path)).href);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

class MockRequest extends Readable {
  constructor(body) {
    super();
    this.method = "POST";
    this.headers = { "content-type": "application/json" };
    this._body = Buffer.from(JSON.stringify(body));
  }

  _read() {
    this.push(this._body);
    this._body = null;
  }
}

class MockResponse extends Writable {
  constructor() {
    super();
    this.statusCode = 200;
    this.headers = {};
    this.chunks = [];
  }

  writeHead(statusCode, headers) {
    this.statusCode = statusCode;
    this.headers = headers ?? {};
    return this;
  }

  _write(chunk, _encoding, callback) {
    this.chunks.push(Buffer.from(chunk));
    callback();
  }

  end(chunk) {
    if (chunk) this.chunks.push(Buffer.from(chunk));
    super.end();
  }

  json() {
    const text = Buffer.concat(this.chunks).toString("utf8");
    return text ? JSON.parse(text) : null;
  }
}

const narrativeBibleInput = {
  sagaId: "auto-bible-create-projects-smoke",
  title: "Auto Bible Project Smoke",
  premise: "Um heroi descobre que uma ameaÃƒÂ§a maior estava escondida atras de um ataque inicial.",
  centralQuestion: "Como o heroi percebe que a luta inicial era apenas uma distraÃƒÂ§ÃƒÂ£o?",
  chapters: [
    {
      issueNumber: 1,
      title: "Issue 1",
      storyPages: [3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      eventIds: ["event-1", "event-2", "event-3", "event-4", "event-5", "event-6", "event-7", "event-8"],
      beginning: "A cidade entra em alerta depois de uma invasÃƒÂ£o inesperada.",
      centralConflict: "O ataque parece direto, mas esconde uma segunda ameaÃƒÂ§a.",
      turningPoint: "O vilÃƒÂ£o revela que queria distrair os herois.",
      outcome: "A equipe percebe que precisa correr antes que o plano se complete.",
      openThreads: ["event-8"],
      resolvedThreads: []
    }
  ],
  events: [1, 2, 3, 4, 5, 6, 7, 8].map((sequence) => ({
    eventId: `event-${sequence}`,
    beatIds: [`beat-${sequence}`],
    issueNumber: 1,
    pageNumbers: [sequence + 2, sequence + 3],
    sequence,
    title: `Virada ${sequence}`,
    narrationText: sequence === 1
      ? "Tudo comeÃƒÂ§a quando o ataque parece simples demais para ser verdade, e a ameaÃƒÂ§a forÃƒÂ§a a equipe a olhar para o lugar errado enquanto o plano real avanÃƒÂ§a."
      : sequence === 2
        ? "Enquanto todos olham para a luta, o verdadeiro plano avanÃƒÂ§a em silÃƒÂªncio, porque o vilÃƒÂ£o sabe que uma distraÃƒÂ§ÃƒÂ£o bem montada vale mais do que forÃƒÂ§a bruta."
        : sequence === 3
          ? "A pista aparece quando a equipe percebe que chegou tarde demais, e cada detalhe da pÃƒÂ¡gina mostra que alguÃƒÂ©m jÃƒÂ¡ estava manipulando o conflito antes deles chegarem nessa histÃ³ria."
          : sequence === 4
            ? "Quando a ameaÃƒÂ§a muda de direÃƒÂ§ÃƒÂ£o, o herÃƒÂ³i entende que nÃƒÂ£o estÃƒÂ¡ impedindo uma invasÃƒÂ£o comum, estÃƒÂ¡ tentando fechar uma armadilha que jÃƒÂ¡ comeÃƒÂ§ou."
            : sequence === 5
              ? "A consequÃƒÂªncia vem rÃƒÂ¡pido, porque o plano separa os personagens e transforma uma batalha controlada em uma corrida contra o tempo nessa histÃ³ria."
              : sequence === 6
                ? "Nesse ponto, a histÃƒÂ³ria deixa claro que cada escolha errada abre espaÃƒÂ§o para uma ameaÃƒÂ§a maior, e ninguÃƒÂ©m tem tempo de explicar tudo com calma nessa histÃ³ria."
                : sequence === 7
                  ? "O ÃƒÂºltimo aviso aparece quando o portal responde ao caos, mostrando que o ataque inicial era sÃƒÂ³ a porta de entrada para algo muito pior nessa histÃ³ria."
                  : "E quando a passagem finalmente se abre, a equipe entende que venceu apenas a primeira pergunta, porque a verdadeira ameaÃƒÂ§a acabou de entrar na histÃƒÂ³ria.",
    actors: ["Heroi", "Vilao"],
    action: "A ameaÃƒÂ§a escala em ordem cronologica.",
    motivation: "Explicar causa, consequÃƒÂªncia e tensÃƒÂ£o sem pular contexto.",
    causes: sequence > 1 ? [`event-${sequence - 1}`] : [],
    consequences: sequence < 8 ? [`event-${sequence + 1}`] : [],
    facts: [{
      factId: `fact-${sequence}`,
      statement: `Fato critico ${sequence} precisa aparecer na narraÃƒÂ§ÃƒÂ£o.`,
      importance: "critical",
      requiredNarrationTerms: [["plano"], ["ameaÃƒÂ§a"]],
      sourcePages: [sequence + 2]
    }],
    visualTargets: ["Heroi", "Vilao", "portal"],
    mustNarrate: true
  }))
};

const episodeDefinitions = [
  {
    episodeId: "episode-1",
    title: "Parte 1: A distraÃƒÂ§ÃƒÂ£o",
    eventIds: ["event-1", "event-2", "event-3", "event-4", "event-5", "event-6", "event-7", "event-8"],
    hook: "O ataque parecia obvio. Mas era exatamente isso que o vilÃƒÂ£o queria.",
    context: "Antes da maior ameaÃƒÂ§a aparecer, a equipe precisou entender quem estava manipulando a cidade.",
    payoff: "No fim, a distraÃƒÂ§ÃƒÂ£o funcionou e abriu caminho para algo muito maior.",
    nextEpisodeHook: "A prÃƒÂ³xima parte responde o que saiu daquele portal."
  }
];


function smokePanel(panelId, pageNumber) {
  return {
    panelId,
    pageNumber,
    panelNumber: 1,
    readingOrder: pageNumber * 10,
    sourcePagePath: `storage/assets/generated/smokes/auto-bible-panel-index/page-${pageNumber}.png`,
    panelImagePath: `storage/assets/generated/smokes/auto-bible-panel-index/panel-${pageNumber}.png`,
    panelImageSha256: `sha-${pageNumber}`,
    cropBounds: { x: 0.08, y: 0.08, width: 0.84, height: 0.78 },
    parentContext: { parentTags: ["portal", "plano"], parentEntities: [], comicTitle: "Smoke Comic", issueTitle: "Issue 1" },
    localEvidence: {
      characters: [
        { name: "Heroi", confidence: 0.9, evidenceSource: "visual" },
        { name: "Vilao", confidence: 0.88, evidenceSource: "visual" }
      ],
      actions: [{ label: "portal abre caminho para a ameaca", confidence: 0.9 }],
      relationships: [{ type: "conflict", entities: ["Heroi", "Vilao"], confidence: 0.82 }],
      detectedText: ["plano", "ameaca", "portal"],
      dialogue: ["O plano ja comecou"],
      narrationBoxes: [],
      soundEffects: ["BOOM"],
      visualThemes: ["portal", "amea?a", "conflito"],
      objects: ["portal"],
      locations: ["cidade"]
    },
    storyFunction: pageNumber >= 10 ? "climax" : "action",
    sequenceId: "seq-smoke",
    previousPanelId: null,
    nextPanelId: null,
    valid: true,
    rejectReason: null,
    quality: { visualQualityScore: 86, cropability916Score: 84, textHeavyRatio: 0.1 },
    confidence: { segmentation: 0.9, characters: 0.88, actions: 0.86, relationships: 0.8, text: 0.78, overall: 0.86 },
    warnings: [],
    cropAreaRatio: 0.48,
    estimatedPanelCount: 3,
    estimatedGutterCount: 2,
    isWholePageFallback: false,
    isActualPanelCrop: true,
    visualFlags: {
      venomVisible: false,
      spiderManVisible: false,
      blackSuitVisible: false,
      symbioteVisible: false,
      duoVisible: false,
      doctorStrangeVisible: false,
      unrelatedCharacterVisible: false
    },
    evidenceTier: "direct_evidence"
  };
}

async function writeSmokePanelIndex(assetDirectory) {
  await mkdir(assetDirectory, { recursive: true });
  const pages = Array.from({ length: 10 }, (_, index) => index + 3).map((pageNumber) => ({
    sourceAssetId: `page-${pageNumber}`,
    sourcePagePath: `storage/assets/generated/smokes/auto-bible-panel-index/page-${pageNumber}.png`,
    sourceContentHash: `hash-${pageNumber}`,
    pageNumber,
    pageType: "story",
    indexable: true,
    parentContext: { parentTags: ["portal", "plano"], parentEntities: [], comicTitle: "Smoke Comic", issueTitle: "Issue 1" },
    panels: [smokePanel(`panel-${pageNumber}`, pageNumber)]
  }));
  await writeFile(join(assetDirectory, ".comics-local-panel-index.json"), JSON.stringify({
    version: 3,
    assetDirectory,
    generatedAt: new Date().toISOString(),
    sourcePageCount: pages.length,
    panelCount: pages.length,
    validPanelCount: pages.length,
    rejectedPanelCount: 0,
    sequenceCount: 1,
    pages
  }, null, 2), "utf8");
}

async function main() {
  const { handleMediaBeastRoute } = await importApi("apps/api/dist/apps/api/src/http/routes/media-beast-routes.js");
  const { createInMemoryAssetRepository } = await importApi("apps/api/dist/apps/api/src/modules/assets/infrastructure/in-memory-asset-repository.js");
  const { createInMemoryChannelRepository } = await importApi("apps/api/dist/apps/api/src/modules/channels/infrastructure/in-memory-channel-repository.js");
  const { createProjectRepository } = await importApi("apps/api/dist/apps/api/src/modules/projects/infrastructure/in-memory-project-repository.js");

  const assetRepository = createInMemoryAssetRepository();
  const channelRepository = createInMemoryChannelRepository();
  const projectRepository = createProjectRepository();
  const channel = await channelRepository.create({
    name: "Auto Bible Smoke",
    niche: "comics",
    language: "pt-BR",
    visualStyle: "premium comic documentary",
    narrativeTone: "cinematic suspense",
    defaultTemplate: null,
    defaultRenderMode: "cinematic_v2",
    defaultRenderQuality: "draft",
    defaultAudioMood: null,
    defaultCaptionStyle: null,
    defaultVisualPreset: null,
    defaultMusicAssetId: null,
    defaultVoiceoverAssetId: null,
    defaultDurationTarget: 180,
    defaultSceneDuration: 4,
    preferredAssetCategories: ["PANEL"],
    preferredAssetTags: ["comic-panel"]
  });

  const smokePanelAssetDirectory = join(projectRoot, "storage/assets/generated/smokes/auto-bible-panel-index");
  await writeSmokePanelIndex(smokePanelAssetDirectory);

  const request = new MockRequest({
    channelId: channel.id,
    titlePrefix: "Auto Bible Smoke",
    issues: [{ issueNumber: 1, title: "Issue 1", assetDirectory: smokePanelAssetDirectory }],
    narrativeBibleInput,
    episodeDefinitions,
    maxProjects: 1,
    maximumEpisodeDurationSeconds: 180,
    targetWordsPerMinute: 160
  });
  const response = new MockResponse();
  const handled = await handleMediaBeastRoute(request, response, "/media-beast/comic-auto-bible/create-projects", {
    assetRepository,
    channelRepository,
    projectRepository
  });
  const body = response.json();

  assert(handled, "route should be handled");
  assert(response.statusCode === 201, `expected 201, got ${response.statusCode}: ${JSON.stringify(body)}`);
  assert(body.status === "created", "expected created response");
  assert(body.createdCount === 1, `expected 1 project, got ${body.createdCount}`);
  assert(body.riskPolicyGate.candidateFirst === true, "candidate-first gate required");
  assert(body.riskPolicyGate.autoRenderCount === 0, "must not render automatically");
  assert(body.riskPolicyGate.autoImportedAssetCount === 0, "must not import assets automatically");
  assert(body.createdProjects[0].panelMatchSummary, "panel matcher summary expected");
  assert(body.createdProjects[0].panelMatchSummary.matchedCount >= 4, "expected panel matcher to autofill scene visual review");
  assert(body.createdProjects[0].panelMatches.some((match) => match.selectedPanelId), "expected scene panel matches");

  const createdProject = await projectRepository.getById(body.createdProjects[0].projectId);
  assert(createdProject, "project must persist");
  assert(createdProject.scenes.length >= 4, "expected scenes from narration beats");
  assert(createdProject.scenes.every((scene) => scene.assetId === null), "scene assets must remain manual/candidate-first");
  assert(createdProject.scenes.every((scene) => scene.visualRecipe?.includes("comic_auto_bible_create_projects_v1")), "visual recipe provenance required");

  console.log(JSON.stringify({
    status: "completed",
    endpoint: "/media-beast/comic-auto-bible/create-projects",
    channelId: channel.id,
    projectId: createdProject.id,
    scenesCreated: createdProject.scenes.length,
    autoRenderCount: body.riskPolicyGate.autoRenderCount,
    autoImportedAssetCount: body.riskPolicyGate.autoImportedAssetCount,
    panelMatchedCount: body.createdProjects[0].panelMatchSummary?.matchedCount ?? 0,
    panelAverageScore: body.createdProjects[0].panelMatchSummary?.averageScore ?? 0,
    candidateFirst: body.riskPolicyGate.candidateFirst
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
