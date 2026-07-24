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
  repairApplied: boolean;
  repairWarningsResolved: string[];
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

function sentenceCase(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

function withFinalPeriod(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

function compactHookNarration(input: { hookNarration: string; visualPromiseTerms: string[] }) {
  const terms = input.visualPromiseTerms.map((term) => term.trim()).filter(Boolean);
  if (terms.length >= 2) {
    const [first, second] = terms;
    return `${first} encarou ${second}.`;
  }
  if (terms.length === 1) return `${terms[0]} virou o centro da historia.`;
  const words = input.hookNarration.trim().split(/\s+/).filter(Boolean).slice(0, 8).join(" ");
  return withFinalPeriod(words || "Algo impossivel mudou tudo");
}

function buildAnchorExplanation(anchor: ComicTemporalContextAnchor) {
  const terms = anchor.explanationTerms.map((term) => term.trim()).filter(Boolean);
  if (terms.length === 0) return "";
  return `${anchor.entity} aqui significa ${terms.slice(0, 2).join(" e ")}.`;
}

export type ComicTemporalHookRepairResult = {
  repairedInput: {
    hookNarration: string;
    setupNarration: string;
    visualPromiseTerms: string[];
    contextAnchors?: ComicTemporalContextAnchor[];
    rewindLabel?: string;
    coldOpenDurationSeconds?: number;
    hookHeadline?: string;
  };
  repairApplied: boolean;
  repairWarningsResolved: string[];
};
function includesTerm(value: string, term: string) {
  return normalize(value).includes(normalize(term));
}

export function repairComicTemporalHookInput(input: {
  hookNarration: string;
  setupNarration: string;
  visualPromiseTerms: string[];
  contextAnchors?: ComicTemporalContextAnchor[];
  rewindLabel?: string;
  coldOpenDurationSeconds?: number;
  hookHeadline?: string;
}): ComicTemporalHookRepairResult {
  const initialPlan = buildComicTemporalHookPlan({ ...input, autoRepair: false });
  const repairWarningsResolved: string[] = [];
  let hookNarration = input.hookNarration.trim();
  let setupNarration = input.setupNarration.trim();
  let rewindLabel = (input.rewindLabel ?? "Doze horas antes").trim();

  if (initialPlan.warnings.includes("cold_open_narration_does_not_match_visual_promise")) {
    hookNarration = compactHookNarration(input);
    repairWarningsResolved.push("cold_open_narration_does_not_match_visual_promise");
  }

  if (initialPlan.warnings.includes("cold_open_hook_too_long")) {
    hookNarration = compactHookNarration({ hookNarration, visualPromiseTerms: input.visualPromiseTerms });
    repairWarningsResolved.push("cold_open_hook_too_long");
  }

  if (initialPlan.warnings.includes("missing_temporal_rewind_label") || initialPlan.warnings.includes("rewind_does_not_establish_past_time")) {
    rewindLabel = "Pouco antes";
    repairWarningsResolved.push(...initialPlan.warnings.filter((warning) => warning === "missing_temporal_rewind_label" || warning === "rewind_does_not_establish_past_time"));
  }

  if (initialPlan.warnings.includes("missing_post_rewind_setup")) {
    setupNarration = "Antes disso, a historia precisava explicar quem estava em perigo, o que cada personagem queria e por que aquele conflito mudaria tudo.";
    repairWarningsResolved.push("missing_post_rewind_setup");
  }

  const missingAnchorExplanations = initialPlan.unexplainedContextAnchors
    .map((entity) => (input.contextAnchors ?? []).find((anchor) => anchor.entity === entity))
    .filter((anchor): anchor is ComicTemporalContextAnchor => Boolean(anchor))
    .map(buildAnchorExplanation)
    .filter(Boolean);
  if (missingAnchorExplanations.length > 0) {
    setupNarration = `${missingAnchorExplanations.join(" ")} ${sentenceCase(setupNarration)}`.trim();
    repairWarningsResolved.push("post_rewind_entity_without_audience_context");
  }

  const uniqueResolvedWarnings = Array.from(new Set(repairWarningsResolved));
  return {
    repairedInput: {
      ...input,
      hookNarration,
      setupNarration,
      rewindLabel,
      coldOpenDurationSeconds: Math.max(1.5, Math.min(2.5, input.coldOpenDurationSeconds ?? 2.1)),
      hookHeadline: input.hookHeadline ?? hookNarration,
    },
    repairApplied: uniqueResolvedWarnings.length > 0,
    repairWarningsResolved: uniqueResolvedWarnings,
  };
}
export function buildComicTemporalHookPlan(input: {
  hookNarration: string;
  setupNarration: string;
  visualPromiseTerms: string[];
  contextAnchors?: ComicTemporalContextAnchor[];
  rewindLabel?: string;
  coldOpenDurationSeconds?: number;
  hookHeadline?: string;
  autoRepair?: boolean;
}): ComicTemporalHookPlan {
  if (input.autoRepair) {
    const repair = repairComicTemporalHookInput(input);
    const repairedPlan = buildComicTemporalHookPlan({ ...repair.repairedInput, autoRepair: false });
    return {
      ...repairedPlan,
      repairApplied: repair.repairApplied,
      repairWarningsResolved: repair.repairWarningsResolved.filter((warning) => !repairedPlan.warnings.includes(warning)),
    };
  }

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
    repairApplied: false,
    repairWarningsResolved: [],
    hookPromiseAligned,
    temporalContextExplicit,
    contextAnchorsExplained,
    unexplainedContextAnchors,
    warnings,
    passed: warnings.length === 0,
  };
}
