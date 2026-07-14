import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");
const ASSET_DIR = join(projectRoot, "storage", "assets", "user-provided", "remix", "venom-partner");
const ASSIGNMENTS_PATH = join(projectRoot, "tmp", "variation-b-beat-assignments-validation.json");
const INDEX_REPORT_PATH = join(projectRoot, "tmp", "variation-b-local-panel-index.json");

async function importMediaBeast() {
  return import(
    pathToFileURL(join(projectRoot, "packages/media-beast/dist/index.js")).href
  );
}

function buildPageTypeLookup(index) {
  const lookup = new Map();
  for (const page of index.pages) {
    for (const panel of page.panels) {
      lookup.set(panel.panelId, page.pageType);
    }
  }
  return lookup;
}

async function main() {
  const beast = await importMediaBeast();
  const { loadLocalComicPanelIndex, runSceneFirstNarrationPipeline } = beast;

  const [validationRaw, indexReportRaw] = await Promise.all([
    readFile(ASSIGNMENTS_PATH, "utf8"),
    readFile(INDEX_REPORT_PATH, "utf8")
  ]);
  const validation = JSON.parse(validationRaw);
  const indexReport = JSON.parse(indexReportRaw);

  const index = await loadLocalComicPanelIndex(ASSET_DIR);
  if (!index) {
    throw new Error("missing_local_panel_index");
  }

  const pageTypeByPanelId = buildPageTypeLookup(index);
  const panels = index.pages.flatMap((page) => page.panels).filter((panel) => panel.valid);

  const result = await runSceneFirstNarrationPipeline({
    panels,
    projectRoot,
    pageTypeByPanelId,
    ffmpegCommand: process.env.FFMPEG_PATH?.trim() || "ffmpeg"
  });

  const perfectPartnerProposal = result.proposals.find((entry) => entry.topic === "parceiro_perfeito");
  const summary = {
    sourceArtifacts: {
      localPanelIndexReport: INDEX_REPORT_PATH,
      beatAssignmentsValidation: ASSIGNMENTS_PATH,
      indexPath: indexReport.indexPath
    },
    validatedBaseline: {
      uniquePanelCount: validation.uniquePanelCount,
      continuityScore: validation.continuityScore,
      averageBeatSpecificFitScore: validation.averageBeatSpecificFitScore,
      page4Panel1Rejected: validation.page4Panel1Diagnostic?.valid === false
    },
    storyProposalCount: result.proposals.length,
    proposals: result.proposals.map((proposal) => ({
      proposalId: proposal.proposalId,
      title: proposal.title,
      topic: proposal.topic,
      topicSupportScore: proposal.topicSupportScore,
      continuityScore: proposal.continuityScore,
      visualClarityScore: proposal.visualClarityScore,
      materialCoverageScore: proposal.materialCoverageScore,
      overallScore: proposal.overallScore,
      panelIds: proposal.panelIds
    })),
    selectedProposal: result.selectedProposal
      ? {
          proposalId: result.selectedProposal.proposalId,
          title: result.selectedProposal.title,
          topic: result.selectedProposal.topic,
          topicSupportScore: result.selectedProposal.topicSupportScore,
          panelIds: result.selectedProposal.panelIds
        }
      : null,
    perfectPartnerStatus: result.perfectPartnerRejected
      ? "rejected_insufficient_support"
      : perfectPartnerProposal
        ? "present_in_proposals"
        : "not_generated",
    winningScenes: result.scenes.map((scene) => ({
      sceneId: scene.sceneId,
      panelId: scene.panelId,
      literalDescription: scene.literalDescription,
      visibleEntities: scene.visibleEntities.map((entry) => entry.name),
      visibleActions: scene.visibleActions.map((entry) => entry.action),
      visibleRelationships: scene.visibleRelationships.map((entry) => entry.type)
    })),
    narrationByScene: result.narrationCues.map((cue) => ({
      role: cue.role,
      panelId: cue.panelId,
      narrationText: cue.narrationText,
      alignmentScore: cue.sceneNarrationAlignmentScore,
      warnings: cue.warnings
    })),
    alignment: {
      hook: result.hookAlignmentScore,
      climax: result.climaxAlignmentScore,
      average: result.averageAlignmentScore
    },
    shotPlans: result.storyboard.map((entry) => ({
      panelId: entry.panelId,
      recommendedFit: entry.shotValidation.recommendedFit,
      valid: entry.shotValidation.valid,
      reasons: entry.shotValidation.reasons
    })),
    unsupportedNarrationCueCount: result.unsupportedNarrationCueCount,
    genericNarrationPhraseCount: result.genericNarrationPhraseCount,
    invalidShotCount: result.invalidShotCount,
    wrongCharacterCount: result.wrongCharacterCount,
    promotionalSceneCount: result.promotionalSceneCount,
    canRender: result.canRender,
    canPublish: result.canPublish,
    blockReason: result.blockReason,
    proposalsPath: result.proposalsPath,
    scriptPath: result.scriptPath,
    storyboardContactSheetPath: result.storyboardContactSheetPath
  };

  console.log(JSON.stringify(summary, null, 2));

  if (!result.canPublish) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("[variation-b-scene-first-preflight] FAIL");
  console.error(error);
  process.exitCode = 1;
});