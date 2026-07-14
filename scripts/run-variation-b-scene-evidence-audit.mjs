import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");
const SCRIPT_PATH = join(projectRoot, "tmp", "variation-b-scene-first-best-script.json");

async function importMediaBeast() {
  return import(
    pathToFileURL(join(projectRoot, "packages/media-beast/dist/index.js")).href
  );
}

async function main() {
  const beast = await importMediaBeast();
  const { runSceneEvidenceAudit } = beast;

  const result = await runSceneEvidenceAudit({
    projectRoot,
    scriptPath: SCRIPT_PATH,
    ffmpegCommand: process.env.FFMPEG_PATH?.trim() || "ffmpeg"
  });

  const summary = {
    sourceScriptPath: result.sourceScriptPath,
    originalProposal: {
      title: result.originalProposalTitle,
      topic: result.originalProposalTopic
    },
    revisedProposal: {
      title: result.revisedProposalTitle,
      topic: result.revisedProposalTopic
    },
    transformationArcVisible: result.transformationArcVisible,
    distinctVisualStepCount: result.distinctVisualStepCount,
    arcAssessment: result.arcAssessment,
    panels: result.panels.map((panel) => ({
      panelId: panel.panelId,
      literalDescriptionPtBr: panel.literalDescriptionPtBr,
      whoAppears: panel.whoAppears,
      visibleAction: panel.visibleAction,
      cannotConclude: panel.cannotConclude,
      visibleFacts: panel.visibleFacts,
      strongInferences: panel.strongInferences,
      unsupportedInterpretations: panel.unsupportedInterpretations,
      indexMismatch: panel.indexMismatch,
      indexMismatchReasons: panel.indexMismatchReasons
    })),
    narrationBeforeAfter: result.narrationBeforeAfter,
    allRemovedClaims: result.allRemovedClaims,
    evidenceScores: {
      hook: result.hookEvidenceScore,
      climax: result.climaxEvidenceScore,
      average: result.averageEvidenceScore,
      byScene: result.scenes.map((scene) => ({
        panelId: scene.panelId,
        evidenceScore: scene.evidenceScore
      }))
    },
    unsupportedClaimCount: result.unsupportedClaimCount,
    literalDescriptionsSpecific: result.literalDescriptionsSpecific,
    canRender: result.canRender,
    canPublish: result.canPublish,
    blockReason: result.blockReason,
    auditPath: result.auditPath,
    contactSheetPath: result.contactSheetPath
  };

  console.log(JSON.stringify(summary, null, 2));

  if (!result.canPublish) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("[variation-b-scene-evidence-audit] FAIL");
  console.error(error);
  process.exitCode = 1;
});