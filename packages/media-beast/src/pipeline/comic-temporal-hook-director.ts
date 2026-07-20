export type ComicTemporalContextAnchor = {
  entity: string;
  explanationTerms: string[];
};

export type ComicTemporalHookPlan = {
  directorId: "comic_temporal_hook_director_v1";
  hookNarration: string;
  rewindNarration: string;
  setupNarration: string;
  combinedNarration: string;
  hookHeadline: string;
  rewindHeadline: string;
  coldOpenDurationSeconds: number;
  rewindAtSeconds: number;
  visualPromiseTerms: string[];
  hookPromiseAligned: boolean;
  temporalContextExplicit: boolean;
  contextAnchorsExplained: boolean;
  unexplainedContextAnchors: string[];
  warnings: string[];
  passed: boolean;
};

function normalize(value: string) {
  return Array.from(value.normalize("NFD"))
    .filter((character) => character.charCodeAt(0) < 768 || character.charCodeAt(0) > 879)
    .join("")
    .toLowerCase();
}

function includesTerm(value: string, term: string) {
  return normalize(value).includes(normalize(term));
}

export function buildComicTemporalHookPlan(input: {
  hookNarration: string;
  setupNarration: string;
  visualPromiseTerms: string[];
  contextAnchors?: ComicTemporalContextAnchor[];
  rewindLabel?: string;
  coldOpenDurationSeconds?: number;
  hookHeadline?: string;
}): ComicTemporalHookPlan {
  const coldOpenDurationSeconds = Math.max(1.5, Math.min(2.5, input.coldOpenDurationSeconds ?? 2.4));
  const rewindLabel = (input.rewindLabel ?? "Doze horas antes").trim();
  const hookNarration = input.hookNarration.trim();
  const setupNarration = input.setupNarration.trim();
  const warnings: string[] = [];
  const hookPromiseAligned = input.visualPromiseTerms.length >= 2 && input.visualPromiseTerms.every((term) => includesTerm(hookNarration, term));
  if (!hookPromiseAligned) warnings.push("cold_open_narration_does_not_match_visual_promise");
  if (!rewindLabel) warnings.push("missing_temporal_rewind_label");
  if (!setupNarration) warnings.push("missing_post_rewind_setup");
  if (hookNarration.trim().split(" ").filter(Boolean).length > 9) warnings.push("cold_open_hook_too_long");
  const rewindNarration = rewindLabel.replace(/[.]+$/, "") + ",";
  const temporalContextExplicit = includesTerm(rewindNarration, "antes");
  if (!temporalContextExplicit) warnings.push("rewind_does_not_establish_past_time");
  const unexplainedContextAnchors = (input.contextAnchors ?? [])
    .filter((anchor) => !includesTerm(setupNarration, anchor.entity) || !anchor.explanationTerms.some((term) => includesTerm(setupNarration, term)))
    .map((anchor) => anchor.entity);
  const contextAnchorsExplained = unexplainedContextAnchors.length === 0;
  if (!contextAnchorsExplained) warnings.push("post_rewind_entity_without_audience_context");
  return {
    directorId: "comic_temporal_hook_director_v1",
    hookNarration,
    rewindNarration,
    setupNarration,
    combinedNarration: hookNarration.replace(/[.]+$/, "") + ". " + rewindNarration + " " + setupNarration,
    hookHeadline: (input.hookHeadline ?? hookNarration).replace(/[.!?]+$/, "").toUpperCase(),
    rewindHeadline: rewindLabel.replace(/[.!?]+$/, "").toUpperCase() + "...",
    coldOpenDurationSeconds,
    rewindAtSeconds: coldOpenDurationSeconds,
    visualPromiseTerms: [...input.visualPromiseTerms],
    hookPromiseAligned,
    temporalContextExplicit,
    contextAnchorsExplained,
    unexplainedContextAnchors,
    warnings,
    passed: warnings.length === 0,
  };
}
