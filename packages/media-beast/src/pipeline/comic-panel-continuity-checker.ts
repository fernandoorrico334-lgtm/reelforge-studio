import type { ComicArcScriptBeat } from "./comic-arc-script-doctor-v2.js";
import type { ComicStoryArcV2 } from "./comic-story-arc-miner-v2.js";
import type { ComicArcVisualDirection } from "./comic-arc-visual-director.js";

export type ComicPanelContinuityReport = {
  checkerId: "comic_panel_continuity_checker_v1";
  status: "passed" | "needs_review" | "rejected";
  score: number;
  pageJumpWarnings: string[];
  roleSequence: string[];
  panelSequence: string[];
  visualFocusSequence: string[];
  missingContextCount: number;
  repeatedPanelCount: number;
  warnings: string[];
};

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function checkComicPanelContinuity(input: {
  arc: ComicStoryArcV2;
  beats: ComicArcScriptBeat[];
  visualDirections: ComicArcVisualDirection[];
}): ComicPanelContinuityReport {
  const warnings: string[] = [];
  const pageJumpWarnings: string[] = [];
  const roles = input.beats.map((beat) => beat.role);
  const panels = input.beats.map((beat) => beat.panelId);
  const uniquePanels = new Set(panels);
  const repeatedPanelCount = Math.max(0, panels.length - uniquePanels.size);
  let pageJumpPenalty = 0;
  for (let index = 1; index < input.beats.length; index += 1) {
    const previous = input.beats[index - 1];
    const current = input.beats[index];
    if (!previous || !current) continue;
    const jump = Math.abs(current.pageNumber - previous.pageNumber);
    if (jump > 3) {
      pageJumpWarnings.push(`large_page_jump:${previous.pageNumber}->${current.pageNumber}`);
      pageJumpPenalty += Math.min(18, jump * 2);
    }
  }
  const hasHook = roles.includes("hook");
  const hasSetup = roles.includes("setup");
  const hasTension = roles.includes("tension");
  const hasClimax = roles.includes("climax");
  const hasPayoff = roles.includes("payoff");
  const missingContextCount = [hasHook, hasSetup || hasTension, hasClimax, hasPayoff].filter((value) => !value).length;
  const focusSequence = input.visualDirections.map((direction) =>
    direction.visualEvidenceMap?.visualFocus?.primaryFocus.type ?? direction.primaryTarget
  );
  if (repeatedPanelCount > 1) warnings.push(`continuity_repeated_panels:${repeatedPanelCount}`);
  if (missingContextCount > 0) warnings.push(`continuity_missing_story_steps:${missingContextCount}`);
  warnings.push(...pageJumpWarnings);
  const score = clampScore(
    94 -
      repeatedPanelCount * 9 -
      missingContextCount * 12 -
      pageJumpPenalty +
      (input.arc.storyCompletenessScore >= 88 ? 5 : 0)
  );
  const status = score >= 84 && warnings.length <= 1 ? "passed" : score >= 70 ? "needs_review" : "rejected";
  return {
    checkerId: "comic_panel_continuity_checker_v1",
    status,
    score,
    pageJumpWarnings,
    roleSequence: roles,
    panelSequence: panels,
    visualFocusSequence: focusSequence,
    missingContextCount,
    repeatedPanelCount,
    warnings
  };
}
