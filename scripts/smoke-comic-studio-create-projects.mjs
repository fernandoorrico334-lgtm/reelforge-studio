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

function makePanel({ id, pageNumber, sequenceId, storyFunction, text, isFight = false }) {
  return {
    panelId: id,
    pageNumber,
    panelNumber: pageNumber,
    readingOrder: pageNumber,
    sourcePagePath: join(projectRoot, "tmp", "comic-studio", `page-${pageNumber}.jpg`),
    panelImagePath: join(projectRoot, "tmp", "comic-studio", `panel-${id}.jpg`),
    panelImageSha256: `${id}-sha256`.padEnd(64, "e"),
    cropBounds: { x: 0, y: 0, width: 800, height: 1200 },
    parentContext: {
      comicTitle: "Comic Studio Test",
      issueTitle: "Issue 1",
      pageTitle: `Page ${pageNumber}`,
      parentTags: ["authorized", "comic-studio"],
      parentEntities: ["hero", "villain"]
    },
    localEvidence: {
      characters: [
        { name: "Hero", confidence: 0.9, evidenceSource: "visual" },
        { name: "Villain", confidence: 0.82, evidenceSource: "visual" }
      ],
      actions: [{ label: isFight ? "fight impact attack" : "reveal transformation conversation", confidence: 0.88 }],
      relationships: [{ type: isFight ? "conflict" : "conversation", entities: ["hero", "villain"], confidence: 0.86 }],
      detectedText: [text],
      dialogue: [`dialogue ${text}`],
      narrationBoxes: [`narration ${text}`],
      soundEffects: isFight ? ["BOOM", "KRASH"] : [],
      visualThemes: isFight ? ["rivalry", "comics_source"] : ["origin", "transformation", "comics_source"],
      objects: [],
      locations: []
    },
    storyFunction,
    sequenceId,
    previousPanelId: null,
    nextPanelId: null,
    valid: true,
    rejectReason: null,
    quality: { visualQualityScore: 88, cropability916Score: 90, textHeavyRatio: 0.12 },
    confidence: {
      segmentation: 0.9,
      characters: 0.9,
      actions: 0.88,
      relationships: 0.86,
      text: 0.8,
      overall: 0.9
    },
    warnings: [],
    cropAreaRatio: 0.75,
    estimatedPanelCount: 1,
    estimatedGutterCount: 0,
    isWholePageFallback: false,
    isActualPanelCrop: true,
    visualFlags: {
      venomVisible: false,
      spiderManVisible: false,
      blackSuitVisible: false,
      symbioteVisible: false,
      duoVisible: true,
      doctorStrangeVisible: false,
      unrelatedCharacterVisible: false
    },
    evidenceTier: "direct_evidence"
  };
}

async function writeSyntheticIndex(assetDirectory) {
  await mkdir(assetDirectory, { recursive: true });
  const panels = [];
  for (let i = 1; i <= 5; i += 1) {
    panels.push(makePanel({
      id: `studio-fight-${i}`,
      pageNumber: i,
      sequenceId: "studio-fight-seq",
      storyFunction: i === 5 ? "climax" : i === 1 ? "setup" : "action",
      text: "fight luta impacto hero villain",
      isFight: true
    }));
  }
  for (let i = 6; i <= 10; i += 1) {
    panels.push(makePanel({
      id: `studio-reveal-${i}`,
      pageNumber: i,
      sequenceId: "studio-reveal-seq",
      storyFunction: i === 8 ? "reveal" : "transformation",
      text: "reveal origem transformacao segredo hero villain",
      isFight: false
    }));
  }

  const pages = panels.map((panel) => ({
    sourceAssetId: `page-${panel.pageNumber}`,
    sourcePagePath: panel.sourcePagePath,
    sourceContentHash: `hash-${panel.pageNumber}`,
    pageNumber: panel.pageNumber,
    pageType: "story",
    indexable: true,
    parentContext: panel.parentContext,
    panels: [panel]
  }));

  await writeFile(join(assetDirectory, ".comics-local-panel-index.json"), JSON.stringify({
    version: 3,
    assetDirectory,
    generatedAt: new Date().toISOString(),
    sourcePageCount: pages.length,
    panelCount: panels.length,
    validPanelCount: panels.length,
    rejectedPanelCount: 0,
    sequenceCount: 2,
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
    name: "Comic Studio Smoke",
    niche: "comics",
    language: "pt-BR",
    visualStyle: "dark comic studio",
    narrativeTone: "epic documentary",
    defaultTemplate: null,
    defaultRenderMode: "cinematic_v2",
    defaultRenderQuality: "draft",
    defaultAudioMood: null,
    defaultCaptionStyle: null,
    defaultVisualPreset: null,
    defaultMusicAssetId: null,
    defaultVoiceoverAssetId: null,
    defaultDurationTarget: 35,
    defaultSceneDuration: 5,
    preferredAssetCategories: ["PANEL"],
    preferredAssetTags: ["comic-panel"]
  });

  const assetDirectory = join(projectRoot, "tmp", "comic-studio", `index-${Date.now()}`);
  await writeSyntheticIndex(assetDirectory);

  const request = new MockRequest({
    assetDirectory,
    channelId: channel.id,
    targetCount: 3,
    maxProjects: 2,
    minScore: 60,
    titlePrefix: "Comic Studio Smoke"
  });
  const response = new MockResponse();
  const handled = await handleMediaBeastRoute(request, response, "/media-beast/comic-studio/create-projects", {
    assetRepository,
    channelRepository,
    projectRepository
  });
  const body = response.json();

  assert(handled, "route should be handled");
  assert(response.statusCode === 201, `expected 201, got ${response.statusCode}: ${JSON.stringify(body)}`);
  assert(body.status === "created", "expected created response");
  assert(body.createdCount === 2, `expected 2 projects, got ${body.createdCount}`);
  assert(body.riskPolicyGate?.candidateFirst === true, "candidate-first gate required");
  assert(body.riskPolicyGate?.autoRenderCount === 0, "must not auto-render");
  assert(body.riskPolicyGate?.autoImportedAssetCount === 0, "must not auto-import assets");
  assert(body.createdProjects.every((project) => project.scenesCreated > 0), "each project needs scenes");
  assert(body.createdProjects.every((project) => project.panelAssetManifest.length === project.scenesCreated), "manifest should match scenes");

  const firstProject = await projectRepository.getById(body.createdProjects[0].projectId);
  assert(firstProject, "created project should be retrievable");
  assert(firstProject.scenes.length === body.createdProjects[0].scenesCreated, "project scenes should persist");
  assert(firstProject.scenes.every((scene) => scene.visualRecipe?.includes("comic-short-project-bridge")), "scenes need bridge provenance");
  assert(firstProject.scenes.every((scene) => scene.assetId === null), "panel assets should not be auto-imported");

  console.log(JSON.stringify({
    status: "completed",
    endpoint: "/media-beast/comic-studio/create-projects",
    channelId: channel.id,
    createdCount: body.createdCount,
    firstProjectId: firstProject.id,
    firstSceneCount: firstProject.scenes.length,
    firstPanelManifestCount: body.createdProjects[0].panelAssetManifest.length,
    autoRenderCount: body.riskPolicyGate.autoRenderCount,
    autoImportedAssetCount: body.riskPolicyGate.autoImportedAssetCount,
    candidateFirst: body.riskPolicyGate.candidateFirst
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
