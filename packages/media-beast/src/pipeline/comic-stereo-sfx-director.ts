import type { ComicShotTransition } from "./comic-panel-shot-director.js";

export type ComicSfxCue = {
  cueId: string;
  startSeconds: number;
  category: "page_tear" | "impact" | "whoosh";
  transition: ComicShotTransition;
  sourcePath: string;
  gainDb: number;
  pan: number;
  durationSeconds: number;
  narrationSafe: boolean;
};

export type ComicStereoSfxPlan = {
  directorId: "comic_stereo_sfx_director_v1";
  cueCount: number;
  stereoWidth: number;
  cues: ComicSfxCue[];
  warnings: string[];
};

export function buildComicStereoSfxPlan(input: {
  shots: Array<{ transitionIn: ComicShotTransition; durationSeconds: number }>;
  assets: { pageTear: string; impact: string; whoosh: string };
  maximumCueCount?: number;
}): ComicStereoSfxPlan {
  const cues: ComicSfxCue[] = [];
  const maximumCueCount = Math.max(1, input.maximumCueCount ?? 26);
  let cursor = 0;
  for (let index = 0; index < input.shots.length; index += 1) {
    const shot = input.shots[index]!;
    const isPageTear = shot.transitionIn === "page_tear";
    const isImpact = shot.transitionIn === "impact_cut";
    const isWhoosh = shot.transitionIn === "push" || shot.transitionIn === "motion_match";
    if ((isPageTear || isImpact || isWhoosh) && cues.length < maximumCueCount) {
      const category = isPageTear ? "page_tear" : isImpact ? "impact" : "whoosh";
      const sourcePath = category === "page_tear" ? input.assets.pageTear : category === "impact" ? input.assets.impact : input.assets.whoosh;
      cues.push({
        cueId: `comic-sfx-${index + 1}-${category}`,
        startSeconds: Math.round(cursor * 1000) / 1000,
        category,
        transition: shot.transitionIn,
        sourcePath,
        gainDb: category === "impact" ? -11 : category === "page_tear" ? -14 : -17,
        pan: category === "impact" ? 0 : index % 2 === 0 ? -0.42 : 0.42,
        durationSeconds: category === "page_tear" ? 0.5 : category === "impact" ? 0.34 : 0.42,
        narrationSafe: true
      });
    }
    cursor += shot.durationSeconds;
  }
  return {
    directorId: "comic_stereo_sfx_director_v1",
    cueCount: cues.length,
    stereoWidth: 0.84,
    cues,
    warnings: cues.length === 0 ? ["no_sfx_cues_selected"] : []
  };
}
