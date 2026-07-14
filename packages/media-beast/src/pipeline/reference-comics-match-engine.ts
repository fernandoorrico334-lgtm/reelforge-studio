import type { VideoRemixAnalysis } from "./remix-video-analyzer.js";
import type { ComicsThemeAnalysis } from "./comics-theme-intelligence.js";
import type { LocalComicPanelEvidence } from "./comics-local-panel-index.js";
import {
  buildBeatVisualRequirement,
  type BeatVisualRequirement
} from "./comics-beat-visual-requirements.js";
import {
  computeBeatSpecificFitScore,
  extractLocalPanelEntityIds,
  extractLocalPanelThemeIds,
  normalizeBeatEntityName,
  normalizeBeatThemeName
} from "./comics-beat-panel-requirements.js";

export type ReferenceComicBeatRole =
  | "hook"
  | "context"
  | "curiosity_a"
  | "curiosity_b"
  | "development_a"
  | "development_b"
  | "climax"
  | "closing";

export type ReferenceVideoComicBrief = {
  title: string;
  topic: string;
  leadEntity: string | null;
  secondaryEntities: string[];
  primaryAction: string | null;
  mood: string;
  storyIntent: string;
  requiredVisuals: string[];
  confidence: number;
  warnings: string[];
};

export type ReferenceComicPanelScore = {
  beatRole: ReferenceComicBeatRole;
  panelId: string;
  panelImagePath: string;
  sourcePagePath: string;
  pageNumber: number;
  panelNumber: number;
  sequenceId: string | null;
  storyFunction: LocalComicPanelEvidence["storyFunction"];
  score: number;
  matchedEntities: string[];
  matchedThemes: string[];
  matchedActions: string[];
  reasons: string[];
  warnings: string[];
  panel: LocalComicPanelEvidence;
};

export type ReferenceComicStoryBeat = {
  beatRole: ReferenceComicBeatRole;
  panelId: string;
  panelImagePath: string;
  panelImageSha256: string;
  cropBounds: LocalComicPanelEvidence["cropBounds"];
  sourcePagePath: string;
  pageNumber: number;
  panelNumber: number;
  sequenceId: string | null;
  score: number;
  reasons: string[];
};

export type ReferenceComicStoryCandidate = {
  storyId: string;
  title: string;
  angle: string;
  score: number;
  confidence: number;
  beats: ReferenceComicStoryBeat[];
  panelIds: string[];
  sequenceIds: string[];
  coverageRoles: ReferenceComicBeatRole[];
  reasons: string[];
  warnings: string[];
};

export type ReferenceComicMatchReport = {
  generatedAt: string;
  brief: ReferenceVideoComicBrief;
  requirements: BeatVisualRequirement[];
  storyCandidates: ReferenceComicStoryCandidate[];
  bestStory: ReferenceComicStoryCandidate | null;
  canUseComicsStory: boolean;
  warnings: string[];
};

const TIMELINE_ROLES: ReferenceComicBeatRole[] = [
  "hook",
  "context",
  "curiosity_a",
  "curiosity_b",
  "development_a",
  "development_b",
  "climax",
  "closing"
];

const ROLE_TEXT_HINTS: Record<ReferenceComicBeatRole, string> = {
  hook: "gancho visual forte com o personagem central e a promessa do conflito",
  context: "contexto da HQ mostrando quem participa da cena",
  curiosity_a: "detalhe curioso que explica a origem ou o motivo do momento",
  curiosity_b: "segundo detalhe visual que sustenta a curiosidade",
  development_a: "desenvolvimento da ação com mudança ou tensão",
  development_b: "continuação da tensão com relação ou consequência",
  climax: "pico visual do conflito, revelação ou transformação",
  closing: "fechamento com reação, consequência ou imagem memorável"
};

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function normalizeLoose(value: string): string {
  return value.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function actionTokens(panel: LocalComicPanelEvidence): string[] {
  return panel.localEvidence.actions
    .filter((action) => action.confidence >= 0.45)
    .map((action) => normalizeLoose(action.label));
}

function buildRoleNarrationText(input: {
  role: ReferenceComicBeatRole;
  analysis: VideoRemixAnalysis;
  brief: ReferenceVideoComicBrief;
}): string {
  const scene = input.analysis.mainScenes.find(
    (entry) => entry.role === input.role || input.role.startsWith(entry.role)
  );
  return [
    input.brief.storyIntent,
    ROLE_TEXT_HINTS[input.role],
    scene?.narrationAngle,
    scene?.visualHint,
    scene?.focusEntity,
    scene?.focusAction,
    input.brief.requiredVisuals.join(" ")
  ]
    .filter(Boolean)
    .join(". ");
}

export function buildReferenceVideoComicBrief(
  analysis: VideoRemixAnalysis,
  themeAnalysis: ComicsThemeAnalysis
): ReferenceVideoComicBrief {
  const intelligence = analysis.contentIntelligence;
  const leadEntity =
    themeAnalysis.primaryEntity ??
    intelligence.entities[0]?.name ??
    analysis.mainScenes.find((scene) => scene.focusEntity)?.focusEntity ??
    null;
  const secondaryEntities = unique([
    ...themeAnalysis.secondaryEntities,
    ...intelligence.entities.slice(1, 4).map((entity) => entity.name),
    ...analysis.mainScenes.map((scene) => scene.focusEntity).filter((value): value is string => Boolean(value))
  ])
    .filter((entity) => normalizeBeatEntityName(entity) !== normalizeBeatEntityName(leadEntity ?? ""))
    .slice(0, 5);
  const primaryAction =
    intelligence.actions[0]?.label ??
    analysis.mainScenes.find((scene) => scene.focusAction)?.focusAction ??
    null;
  const requiredVisuals = unique([
    ...(leadEntity ? [leadEntity] : []),
    ...secondaryEntities.slice(0, 3),
    ...(primaryAction ? [primaryAction] : []),
    ...themeAnalysis.narrativeThemes.filter((theme) => theme !== "unknown"),
    ...themeAnalysis.visualMotifs.slice(0, 4)
  ]).filter(Boolean);

  const warnings: string[] = [];
  if (!leadEntity) warnings.push("reference_brief_missing_lead_entity");
  if (requiredVisuals.length < 2) warnings.push("reference_brief_low_visual_specificity");
  if (analysis.probeMethod === "estimated") warnings.push("reference_video_analysis_estimated");

  const specificity =
    (leadEntity ? 30 : 0) +
    Math.min(25, secondaryEntities.length * 6) +
    (primaryAction ? 20 : 0) +
    Math.min(25, themeAnalysis.narrativeThemes.filter((theme) => theme !== "unknown").length * 8);

  return {
    title: analysis.title,
    topic: intelligence.headline || analysis.themeSummary || analysis.title,
    leadEntity,
    secondaryEntities,
    primaryAction,
    mood: intelligence.mood,
    storyIntent: intelligence.narrativeBrief || analysis.themeSummary,
    requiredVisuals,
    confidence: clampScore(specificity),
    warnings
  };
}

export function buildReferenceComicVisualRequirements(input: {
  analysis: VideoRemixAnalysis;
  themeAnalysis: ComicsThemeAnalysis;
  brief?: ReferenceVideoComicBrief;
}): BeatVisualRequirement[] {
  const brief = input.brief ?? buildReferenceVideoComicBrief(input.analysis, input.themeAnalysis);
  return TIMELINE_ROLES.map((role) =>
    buildBeatVisualRequirement({
      beatId: `reference-${role}`,
      role,
      narrationText: buildRoleNarrationText({ role, analysis: input.analysis, brief }),
      videoTitle: input.analysis.title,
      themeAnalysis: input.themeAnalysis
    })
  );
}

function scoreRoleFit(panel: LocalComicPanelEvidence, role: ReferenceComicBeatRole): number {
  const baseRole = role.replace(/_[ab]$/i, "");
  const story = panel.storyFunction;
  if (baseRole === "hook" && ["action", "relationship", "reveal", "splash"].includes(story)) return 14;
  if (baseRole === "context" && ["setup", "context", "dialogue"].includes(story)) return 12;
  if (baseRole === "curiosity" && ["context", "dialogue", "reveal"].includes(story)) return 10;
  if (baseRole === "development" && ["action", "relationship", "transformation"].includes(story)) return 12;
  if (baseRole === "climax" && ["climax", "action", "transformation", "reveal"].includes(story)) return 16;
  if (baseRole === "closing" && ["reaction", "context", "relationship"].includes(story)) return 10;
  return 0;
}

export function scorePanelForReferenceBeat(input: {
  panel: LocalComicPanelEvidence;
  requirement: BeatVisualRequirement;
  role: ReferenceComicBeatRole;
  brief: ReferenceVideoComicBrief;
}): ReferenceComicPanelScore {
  const panel = input.panel;
  const warnings: string[] = [];
  const reasons: string[] = [];
  if (!panel.valid) warnings.push(`invalid_panel:${panel.rejectReason ?? "unknown"}`);
  if (panel.isWholePageFallback) warnings.push("whole_page_fallback_penalty");
  if (panel.quality.textHeavyRatio > 0.55) warnings.push("text_heavy_panel_penalty");

  const localEntities = extractLocalPanelEntityIds(panel);
  const localThemes = extractLocalPanelThemeIds(panel);
  const localActions = actionTokens(panel);
  const requiredEntities = input.requirement.requiredEntities.map(normalizeBeatEntityName);
  const preferredEntities = input.requirement.preferredEntities.map(normalizeBeatEntityName);
  const requiredThemes = input.requirement.requiredThemes.map(normalizeBeatThemeName);
  const preferredThemes = input.requirement.preferredThemes.map(normalizeBeatThemeName);
  const requiredActions = input.requirement.requiredActions.map(normalizeLoose);
  const preferredActions = input.requirement.preferredActions.map(normalizeLoose);

  const matchedEntities = unique([...requiredEntities, ...preferredEntities].filter((entity) =>
    localEntities.includes(entity)
  ));
  const matchedThemes = unique([...requiredThemes, ...preferredThemes].filter((theme) =>
    localThemes.includes(theme)
  ));
  const matchedActions = unique([...requiredActions, ...preferredActions].filter((action) =>
    localActions.some((local) => local.includes(action) || action.includes(local))
  ));

  let score = computeBeatSpecificFitScore({ panel, requirement: input.requirement });
  score += scoreRoleFit(panel, input.role);
  score += Math.min(12, matchedEntities.length * 5);
  score += Math.min(10, matchedThemes.length * 4);
  score += Math.min(8, matchedActions.length * 4);
  score += Math.round(panel.quality.visualQualityScore * 0.08);
  score += Math.round(panel.quality.cropability916Score * 0.08);

  const lead = input.brief.leadEntity ? normalizeBeatEntityName(input.brief.leadEntity) : null;
  if (lead && localEntities.includes(lead)) {
    score += 10;
    reasons.push(`lead_entity:${lead}`);
  }
  for (const entity of input.brief.secondaryEntities.map(normalizeBeatEntityName)) {
    if (localEntities.includes(entity)) {
      score += 4;
      reasons.push(`secondary_entity:${entity}`);
    }
  }
  if (panel.evidenceTier === "direct_evidence") score += 8;
  if (panel.evidenceTier === "supporting_only") score -= 12;
  if (panel.isWholePageFallback) score -= 35;
  if (panel.cropAreaRatio > 0.7) score -= 25;
  if (panel.quality.textHeavyRatio > 0.55) score -= 10;

  if (matchedEntities.length > 0) reasons.push(`matched_entities:${matchedEntities.join("|")}`);
  if (matchedThemes.length > 0) reasons.push(`matched_themes:${matchedThemes.join("|")}`);
  if (matchedActions.length > 0) reasons.push(`matched_actions:${matchedActions.join("|")}`);
  reasons.push(`story_function:${panel.storyFunction}`);

  return {
    beatRole: input.role,
    panelId: panel.panelId,
    panelImagePath: panel.panelImagePath,
    sourcePagePath: panel.sourcePagePath,
    pageNumber: panel.pageNumber,
    panelNumber: panel.panelNumber,
    sequenceId: panel.sequenceId,
    storyFunction: panel.storyFunction,
    score: clampScore(score),
    matchedEntities,
    matchedThemes,
    matchedActions,
    reasons,
    warnings,
    panel
  };
}

function flattenPanels(panels: LocalComicPanelEvidence[]): LocalComicPanelEvidence[] {
  return [...panels].sort((left, right) => {
    if (left.pageNumber !== right.pageNumber) return left.pageNumber - right.pageNumber;
    return left.readingOrder - right.readingOrder;
  });
}

function continuityScore(beats: ReferenceComicStoryBeat[]): number {
  if (beats.length < 2) return 0;
  let score = 0;
  const sequenceIds = beats.map((beat) => beat.sequenceId).filter(Boolean);
  if (sequenceIds.length >= 2 && new Set(sequenceIds).size <= Math.ceil(sequenceIds.length / 2)) {
    score += 12;
  }
  const sorted = [...beats].sort((left, right) => left.pageNumber - right.pageNumber);
  const monotonic = beats.every((beat, index) => beat.panelId === sorted[index]?.panelId);
  if (monotonic) score += 8;
  const pageSpan = Math.max(...beats.map((beat) => beat.pageNumber)) - Math.min(...beats.map((beat) => beat.pageNumber));
  if (pageSpan <= 8) score += 8;
  if (pageSpan > 20) score -= 10;
  return score;
}

function makeStoryCandidate(input: {
  id: string;
  title: string;
  angle: string;
  picks: ReferenceComicPanelScore[];
  brief: ReferenceVideoComicBrief;
}): ReferenceComicStoryCandidate {
  const used = new Set<string>();
  const beats: ReferenceComicStoryBeat[] = [];
  const warnings: string[] = [];
  const reasons: string[] = [];

  for (const pick of input.picks) {
    if (used.has(pick.panelId)) {
      warnings.push(`duplicate_panel_skipped:${pick.panelId}:${pick.beatRole}`);
      continue;
    }
    used.add(pick.panelId);
    beats.push({
      beatRole: pick.beatRole,
      panelId: pick.panelId,
      panelImagePath: pick.panelImagePath,
      panelImageSha256: pick.panel.panelImageSha256,
      cropBounds: pick.panel.cropBounds,
      sourcePagePath: pick.sourcePagePath,
      pageNumber: pick.pageNumber,
      panelNumber: pick.panelNumber,
      sequenceId: pick.sequenceId,
      score: pick.score,
      reasons: pick.reasons
    });
  }

  const average = beats.length
    ? beats.reduce((sum, beat) => sum + beat.score, 0) / beats.length
    : 0;
  const roleCoverage = beats.length / TIMELINE_ROLES.length;
  const continuity = continuityScore(beats);
  const score = clampScore(average * 0.68 + roleCoverage * 18 + continuity + input.brief.confidence * 0.08);
  if (beats.length < 5) warnings.push(`low_story_coverage:${beats.length}/${TIMELINE_ROLES.length}`);
  if (average < 65) warnings.push(`low_average_panel_score:${Math.round(average)}`);
  reasons.push(`average_panel_score:${Math.round(average)}`);
  reasons.push(`role_coverage:${beats.length}/${TIMELINE_ROLES.length}`);
  reasons.push(`continuity_score:${continuity}`);

  return {
    storyId: input.id,
    title: input.title,
    angle: input.angle,
    score,
    confidence: clampScore(score - warnings.length * 6),
    beats,
    panelIds: beats.map((beat) => beat.panelId),
    sequenceIds: unique(beats.map((beat) => beat.sequenceId).filter((value): value is string => Boolean(value))),
    coverageRoles: beats.map((beat) => beat.beatRole),
    reasons,
    warnings
  };
}

export function matchReferenceVideoToComicsStories(input: {
  analysis: VideoRemixAnalysis;
  themeAnalysis: ComicsThemeAnalysis;
  panels: LocalComicPanelEvidence[];
  minStoryScore?: number;
}): ReferenceComicMatchReport {
  const brief = buildReferenceVideoComicBrief(input.analysis, input.themeAnalysis);
  const requirements = buildReferenceComicVisualRequirements({
    analysis: input.analysis,
    themeAnalysis: input.themeAnalysis,
    brief
  });
  const sortedPanels = flattenPanels(input.panels).filter((panel) => panel.valid && !panel.isWholePageFallback);
  const warnings: string[] = [...brief.warnings];
  if (sortedPanels.length < 4) warnings.push(`low_local_panel_count:${sortedPanels.length}`);

  const scoreMatrix = requirements.map((requirement) => ({
    requirement,
    role: requirement.role as ReferenceComicBeatRole,
    scores: sortedPanels
      .map((panel) =>
        scorePanelForReferenceBeat({
          panel,
          requirement,
          role: requirement.role as ReferenceComicBeatRole,
          brief
        })
      )
      .sort((left, right) => right.score - left.score)
  }));

  const greedyPicks: ReferenceComicPanelScore[] = [];
  const used = new Set<string>();
  for (const entry of scoreMatrix) {
    const pick = entry.scores.find((candidate) => candidate.score >= 55 && !used.has(candidate.panelId));
    if (!pick) {
      warnings.push(`no_panel_for_reference_role:${entry.role}`);
      continue;
    }
    greedyPicks.push(pick);
    used.add(pick.panelId);
  }

  const candidates: ReferenceComicStoryCandidate[] = [];
  if (greedyPicks.length > 0) {
    candidates.push(
      makeStoryCandidate({
        id: "reference-role-greedy",
        title: `Sequencia alinhada ao video: ${brief.topic}`,
        angle: brief.storyIntent,
        picks: greedyPicks,
        brief
      })
    );
  }

  const bySequence = new Map<string, LocalComicPanelEvidence[]>();
  for (const panel of sortedPanels) {
    if (!panel.sequenceId) continue;
    const list = bySequence.get(panel.sequenceId) ?? [];
    list.push(panel);
    bySequence.set(panel.sequenceId, list);
  }

  for (const [sequenceId, sequencePanels] of bySequence) {
    if (sequencePanels.length < 3) continue;
    const sequencePicks: ReferenceComicPanelScore[] = [];
    const sequenceUsed = new Set<string>();
    for (const entry of scoreMatrix) {
      const pick = entry.scores.find(
        (candidate) =>
          candidate.sequenceId === sequenceId &&
          candidate.score >= 45 &&
          !sequenceUsed.has(candidate.panelId)
      );
      if (!pick) continue;
      sequencePicks.push(pick);
      sequenceUsed.add(pick.panelId);
    }
    if (sequencePicks.length < 3) continue;
    candidates.push(
      makeStoryCandidate({
        id: `reference-sequence-${sequenceId.replace(/[^a-z0-9_-]/gi, "_")}`,
        title: `Historia candidata da HQ (${sequenceId})`,
        angle: `Usar uma sequencia continua da HQ para explicar: ${brief.topic}`,
        picks: sequencePicks,
        brief
      })
    );
  }

  const storyCandidates = candidates.sort((left, right) => right.score - left.score).slice(0, 8);
  const bestStory = storyCandidates[0] ?? null;
  const minStoryScore = input.minStoryScore ?? 72;
  const canUseComicsStory = Boolean(
    bestStory &&
      bestStory.score >= minStoryScore &&
      bestStory.beats.length >= 5 &&
      bestStory.coverageRoles.includes("hook") &&
      bestStory.coverageRoles.includes("climax")
  );

  if (!bestStory) warnings.push("no_reference_comic_story_candidate");
  else if (!canUseComicsStory) {
    warnings.push(`best_reference_comic_story_below_threshold:${bestStory.score}<${minStoryScore}`);
  }

  return {
    generatedAt: new Date().toISOString(),
    brief,
    requirements,
    storyCandidates,
    bestStory,
    canUseComicsStory,
    warnings
  };
}
