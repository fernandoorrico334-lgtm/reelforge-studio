import {
  buildComicNarrationVisualSyncPlan,
  buildComicNarrationZoomPlan,
  buildCompleteComicSagaPlan,
  buildComicStereoSfxPlan,
} from "../packages/media-beast/dist/index.js";

const issueRanges = [
  { issueNumber: 1, firstStoryPage: 4, lastStoryPage: 32, excludedPages: [1, 2, 3, 33, 34, 35, 36, 37, 38, 39] },
  { issueNumber: 2, firstStoryPage: 6, lastStoryPage: 32, excludedPages: [1, 2, 3, 4, 5, 33] },
  { issueNumber: 3, firstStoryPage: 7, lastStoryPage: 34, excludedPages: [1, 2, 3, 4, 5, 6, 35] },
  { issueNumber: 4, firstStoryPage: 7, lastStoryPage: 33, excludedPages: [1, 2, 3, 4, 5, 6, 34] },
  { issueNumber: 5, firstStoryPage: 7, lastStoryPage: 35, excludedPages: [1, 2, 3, 4, 5, 6, 36] },
  { issueNumber: 6, firstStoryPage: 7, lastStoryPage: 34, excludedPages: [1, 2, 3, 4, 5, 6, 35] },
  { issueNumber: 7, firstStoryPage: 8, lastStoryPage: 36, excludedPages: [1, 2, 3, 4, 5, 6, 7, 37] },
];
const beats = issueRanges.flatMap((range) => [0, 1, 2].map((part) => ({
  beatId: `issue-${range.issueNumber}-beat-${part + 1}`,
  issueNumber: range.issueNumber,
  pageNumbers: [range.firstStoryPage + part * 4, Math.min(range.lastStoryPage, range.firstStoryPage + part * 4 + 3)],
  role: part === 0 ? "setup" : part === 2 ? "climax" : "escalation",
  narrationText: `Na ediÃ§Ã£o ${range.issueNumber}, a batalha muda de escala e forÃ§a os herÃ³is a encontrar uma nova saÃ­da antes do prÃ³ximo confronto.`,
  headline: `EDIÃ‡ÃƒO ${range.issueNumber}`,
  hasDialogue: part !== 2,
  hasImpact: part === 2,
  weight: 1,
})));
const plan = buildCompleteComicSagaPlan({ issueRanges, beats, maximumDurationSeconds: 180, targetWordsPerMinute: 165 });
if (!plan.completeStoryCovered) throw new Error(`Saga plan incomplete: ${plan.warnings.join(",")}`);
if (plan.coveredIssueNumbers.length !== 7) throw new Error("All seven issues must be covered.");
if (plan.pageTearAfterBeatIds.length !== 6) throw new Error("Expected one page tear between each issue.");
if (plan.estimatedDurationSeconds > 180) throw new Error("Saga exceeds duration ceiling.");

const sync = buildComicNarrationVisualSyncPlan({
  beats: [{
    spokenText: "Clark prepares the proposal, the villains attack, and the Mother Box opens the path.",
    pages: ["i01-page-0010.jpg", "i01-page-0012.jpg", "i01-page-0014.jpg", "i01-page-0016.jpg"],
    durationSeconds: 8.4,
    role: "setup",
    hasDialogue: true,
    visualCues: [
      { text: "Clark prepares the proposal", pages: ["i01-page-0010.jpg", "i01-page-0012.jpg"], durationSeconds: 2.15 },
      { text: "the villains attack", pages: ["i01-page-0014.jpg"], durationSeconds: 1.75 },
      { text: "the Mother Box opens the path?", pages: ["i01-page-0016.jpg"], durationSeconds: 4.5 },
    ],
  }],
});
if (sync.timelineDriftSeconds !== 0) throw new Error("Narration/visual sync introduced timeline drift.");
if (sync.cues.map((cue) => cue.durationSeconds).join(",") !== "2.15,1.75,4.5") throw new Error("Measured narration durations were not preserved in the visual timeline.");
if (!sync.cues.at(-1)?.text.endsWith("?")) throw new Error("Question punctuation was lost from the measured narration cue.");
if (sync.cues.at(-1)?.pages.at(-1) !== "i01-page-0016.jpg") throw new Error("Mother Box cue is not mapped to its intended page.");
const zoom = buildComicNarrationZoomPlan({
  cues: [
    { cueId: "box", text: "A Mother Box opens the portal", focusTarget: "mother_box", hasImpact: true },
    { cueId: "unknown-character", text: "Superman observes the horizon" },
    { cueId: "dialogue", text: "The hero answers", hasDialogue: true },
  ],
  shots: [
    { shotId: "box-shot", beatIndex: 0, confidence: 80, speakerAnchor: null, semanticAssociationConfidence: 0, shotRole: "impact" },
    { shotId: "safe-shot", beatIndex: 1, confidence: 58, speakerAnchor: null, semanticAssociationConfidence: 0, shotRole: "reaction" },
    { shotId: "dialogue-shot", beatIndex: 2, confidence: 82, speakerAnchor: { x: 0.7, y: 0.3 }, semanticAssociationConfidence: 84, shotRole: "dialogue" },
  ],
});
if (zoom.unsafeAggressiveZoomCount !== 0) throw new Error("Unsafe narration zoom detected.");
if (zoom.safeWideCount !== 1) throw new Error("Unconfirmed target must remain a safe wide shot.");

const sfx = buildComicStereoSfxPlan({
  shots: [
    { transitionIn: "page_tear", durationSeconds: 2 },
    { transitionIn: "impact_cut", durationSeconds: 1.5 },
    { transitionIn: "motion_match", durationSeconds: 1.4 },
  ],
  assets: { pageTear: "page-tear.mp4", impact: "impact.mp4", whoosh: "whoosh.mp4" },
});
if (sfx.cueCount !== 3) throw new Error("SFX director did not map all transition classes.");
if (!sfx.cues.some((cue) => Math.abs(cue.pan) > 0)) throw new Error("Stereo spatialization is missing.");

console.log(JSON.stringify({
  directorId: plan.directorId,
  issueCount: plan.issueCount,
  storyPageCount: plan.storyPageCount,
  selectedPageCount: plan.selectedPageCount,
  estimatedDurationSeconds: plan.estimatedDurationSeconds,
  pageTearCount: plan.pageTearAfterBeatIds.length,
  narrationVisualSyncDirectorId: sync.directorId,
  narrationVisualCueCount: sync.cueCount,
  narrationVisualTimelineDriftSeconds: sync.timelineDriftSeconds,
  narrationZoomDirectorId: zoom.directorId,
  narrationZoomSafeWideCount: zoom.safeWideCount,
  unsafeAggressiveZoomCount: zoom.unsafeAggressiveZoomCount,
  sfxDirectorId: sfx.directorId,
  sfxCueCount: sfx.cueCount,
  status: "completed",
}, null, 2));

