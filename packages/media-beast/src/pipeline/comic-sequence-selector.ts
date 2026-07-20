import type { ComicArcScriptBeat, ComicArcScriptDoctorV2Result } from "./comic-arc-script-doctor-v2.js";
import type { ComicStoryArcV2 } from "./comic-story-arc-miner-v2.js";
import type { ComicStoryMinerPanelRef } from "./comic-story-miner.js";

export type ComicSequenceSelectorCandidate = {
  id: string;
  startPage: number;
  endPage: number;
  pageSequence: number[];
  panelSequence: string[];
  panelCount: number;
  score: number;
  storyShapeScore: number;
  visualMaterialScore: number;
  dialogueScore: number;
  actionScore: number;
  cropScore: number;
  continuityScore: number;
  suggestedBeatPanelIds: Partial<Record<ComicArcScriptBeat["role"], string>>;
  reasons: string[];
  warnings: string[];
};

export type ComicSequenceSelectorReport = {
  selectorId: "comic_sequence_selector_v1";
  candidateCount: number;
  selectedCandidate: ComicSequenceSelectorCandidate | null;
  candidates: ComicSequenceSelectorCandidate[];
  warnings: string[];
};

type RuntimePanel = ComicStoryMinerPanelRef & {
  evidenceTier?: string;
  isWholePageFallback?: boolean;
  panelNumber?: number;
  readingOrder?: number;
};

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function panelOrder(panel: ComicStoryMinerPanelRef): number {
  const runtime = panel as RuntimePanel;
  if (typeof runtime.panelNumber === "number" && Number.isFinite(runtime.panelNumber)) return runtime.panelNumber;
  if (typeof runtime.readingOrder === "number" && Number.isFinite(runtime.readingOrder)) return runtime.readingOrder;
  const match = panel.panelId.match(/panel(\d+)/i);
  return match ? Number(match[1]) : 0;
}

function sortPanels(panels: ComicStoryMinerPanelRef[]) {
  return [...panels].sort((left, right) => left.pageNumber - right.pageNumber || panelOrder(left) - panelOrder(right));
}

function counts(panel: ComicStoryMinerPanelRef) {
  return panel.visualCropEvidence.evidenceCounts;
}

function hasDialogue(panel: ComicStoryMinerPanelRef) {
  const evidence = panel.visualCropEvidence;
  const c = counts(panel);
  return c.dialogue > 0 || c.narrationBoxes > 0 || c.detectedText > 0 || panel.localDialogue.length > 0 || panel.localNarrationBoxes.length > 0 || evidence.confidence.text >= 0.7;
}

function hasAction(panel: ComicStoryMinerPanelRef) {
  const evidence = panel.visualCropEvidence;
  const c = counts(panel);
  return c.actions > 0 || c.soundEffects > 0 || panel.soundEffects.length > 0 || evidence.confidence.actions >= 0.68 || Boolean(evidence.strongestActionLabel);
}

function hasConflict(panel: ComicStoryMinerPanelRef) {
  const evidence = panel.visualCropEvidence;
  return evidence.visualFlags.duoVisible || /conflict|threat|rival|enemy|host|versus|battle|fight/i.test(evidence.strongestRelationshipType ?? "");
}

function panelMaterialScore(panel: ComicStoryMinerPanelRef) {
  const evidence = panel.visualCropEvidence;
  const runtime = panel as RuntimePanel;
  let score = 28;
  if (hasDialogue(panel)) score += 18;
  if (hasAction(panel)) score += 20;
  if (hasConflict(panel)) score += 16;
  if (evidence.evidenceCounts.characters > 0 || evidence.confidence.characters >= 0.58) score += 12;
  score += Math.min(16, Math.round(evidence.quality.cropability916Score / 6));
  score += Math.min(8, Math.round(evidence.confidence.overall * 8));
  if (runtime.evidenceTier === "rejected") score -= 28;
  if (runtime.isWholePageFallback && evidence.quality.cropability916Score < 55) score -= 14;
  if (evidence.quality.cropability916Score < 24) score -= 24;
  if (evidence.quality.textHeavyRatio > 0.62) score -= 8;
  return clampScore(score);
}

function beatRoleAffinity(role: ComicArcScriptBeat["role"], panel: ComicStoryMinerPanelRef) {
  let score = 40;
  const storyFunction = panel.visualCropEvidence.storyFunction;
  if (role === "hook") {
    if (hasAction(panel) || hasConflict(panel)) score += 28;
    if (hasDialogue(panel)) score += 8;
  }
  if (role === "setup") {
    if (hasDialogue(panel)) score += 28;
    if (["setup", "context", "dialogue"].includes(storyFunction)) score += 14;
  }
  if (role === "tension") {
    if (hasConflict(panel)) score += 24;
    if (hasAction(panel) || hasDialogue(panel)) score += 10;
  }
  if (role === "climax") {
    if (hasAction(panel)) score += 30;
    if (["climax", "action", "transformation", "reveal"].includes(storyFunction)) score += 16;
  }
  if (role === "payoff") {
    if (hasDialogue(panel)) score += 18;
    if (["reaction", "reveal", "dialogue"].includes(storyFunction)) score += 18;
  }
  return clampScore(score + Math.round(panelMaterialScore(panel) * 0.2));
}

function pickBeatPanels(input: { panels: ComicStoryMinerPanelRef[]; script: ComicArcScriptDoctorV2Result }) {
  const result: Partial<Record<ComicArcScriptBeat["role"], string>> = {};
  const ordered = sortPanels(input.panels);
  const beats = input.script.beats;
  if (!ordered.length || !beats.length) return result;

  let previousIndex = -1;
  for (let beatIndex = 0; beatIndex < beats.length; beatIndex += 1) {
    const beat = beats[beatIndex];
    if (!beat) continue;
    const remainingBeats = beats.length - beatIndex - 1;
    const minIndex = Math.min(ordered.length - 1, previousIndex + 1);
    const maxIndex = Math.max(minIndex, ordered.length - remainingBeats - 1);
    const targetIndex = beats.length === 1
      ? minIndex
      : Math.round((beatIndex / Math.max(1, beats.length - 1)) * (ordered.length - 1));
    const boundedTarget = Math.max(minIndex, Math.min(maxIndex, targetIndex));
    const progressivePool = ordered
      .map((panel, index) => ({ panel, index }))
      .filter((entry) => entry.index >= minIndex && entry.index <= maxIndex);
    const picked = progressivePool
      .sort((left, right) => {
        const leftScore = beatRoleAffinity(beat.role, left.panel) - Math.abs(left.index - boundedTarget) * 10;
        const rightScore = beatRoleAffinity(beat.role, right.panel) - Math.abs(right.index - boundedTarget) * 10;
        return rightScore - leftScore || left.index - right.index;
      })[0];
    if (picked) {
      result[beat.role] = picked.panel.panelId;
      previousIndex = picked.index;
    }
  }
  return result;
}
function scoreWindow(input: { id: string; panels: ComicStoryMinerPanelRef[]; script: ComicArcScriptDoctorV2Result }): ComicSequenceSelectorCandidate {
  const panels = sortPanels(input.panels);
  const pageSequence = unique(panels.map((panel) => panel.pageNumber));
  const panelSequence = panels.map((panel) => panel.panelId);
  const dialogueCount = panels.filter(hasDialogue).length;
  const actionCount = panels.filter(hasAction).length;
  const conflictCount = panels.filter(hasConflict).length;
  const materialScores = panels.map(panelMaterialScore);
  const cropScores = panels.map((panel) => panel.visualCropEvidence.quality.cropability916Score);
  const hasOpeningContext = panels.slice(0, Math.ceil(panels.length / 2)).some((panel) => hasDialogue(panel) || ["setup", "context", "dialogue"].includes(panel.visualCropEvidence.storyFunction));
  const hasMiddleConflict = panels.slice(1, Math.max(2, panels.length - 1)).some((panel) => hasAction(panel) || hasConflict(panel));
  const hasLatePayoff = panels.slice(Math.max(0, panels.length - 3)).some((panel) => hasDialogue(panel) || ["reaction", "reveal", "climax"].includes(panel.visualCropEvidence.storyFunction));
  const storyShapeScore = clampScore((hasOpeningContext ? 32 : 0) + (hasMiddleConflict ? 34 : 0) + (hasLatePayoff ? 24 : 0) + Math.min(10, panels.length));
  const visualMaterialScore = clampScore(materialScores.reduce((sum, score) => sum + score, 0) / Math.max(1, materialScores.length));
  const dialogueScore = clampScore((dialogueCount / Math.max(1, panels.length)) * 100);
  const actionScore = clampScore(((actionCount + conflictCount) / Math.max(1, panels.length)) * 72 + (hasMiddleConflict ? 18 : 0));
  const cropScore = clampScore(cropScores.reduce((sum, score) => sum + score, 0) / Math.max(1, cropScores.length));
  const continuityScore = clampScore(92 - Math.max(0, pageSequence.length - 7) * 5 - (panelSequence.length < 5 ? 12 : 0));
  const narrativeRangeScore = clampScore(
    (panelSequence.length >= 8 ? 34 : panelSequence.length >= 6 ? 20 : 4) +
    (pageSequence.length >= 5 ? 30 : pageSequence.length >= 3 ? 22 : pageSequence.length >= 2 ? 10 : 0) +
    (hasOpeningContext ? 12 : 0) +
    (hasMiddleConflict ? 12 : 0) +
    (hasLatePayoff ? 12 : 0)
  );
  let score = 0;
  score += storyShapeScore * 0.3;
  score += visualMaterialScore * 0.28;
  score += cropScore * 0.16;
  score += actionScore * 0.14;
  score += dialogueScore * 0.06;
  score += continuityScore * 0.04;
  score += narrativeRangeScore * 0.12;
  if (panels.length >= 8) score += 6;
  if (pageSequence.length >= 3) score += 5;
  if (pageSequence.length <= 1 && panels.length >= 8) score -= 10;

  const warnings: string[] = [];
  if (!hasOpeningContext) warnings.push("sequence_missing_opening_context_or_balloon");
  if (!hasMiddleConflict) warnings.push("sequence_missing_visual_conflict_or_action");
  if (!hasLatePayoff) warnings.push("sequence_missing_payoff_or_reaction");
  if (panels.length < 5) warnings.push("sequence_too_short_for_30s_story");
  if (panels.length < 8) warnings.push("sequence_under_ideal_panel_count_for_dynamic_30s");
  if (pageSequence.length < 3 && panels.length >= 8) warnings.push("sequence_too_localized_for_full_story_arc");
  if (cropScore < 62) warnings.push(`sequence_crop_score_low:${cropScore}`);
  if (visualMaterialScore < 64) warnings.push(`sequence_material_score_low:${visualMaterialScore}`);

  return {
    id: input.id,
    startPage: pageSequence[0] ?? 0,
    endPage: pageSequence[pageSequence.length - 1] ?? 0,
    pageSequence,
    panelSequence,
    panelCount: panels.length,
    score: clampScore(score),
    storyShapeScore,
    visualMaterialScore,
    dialogueScore,
    actionScore,
    cropScore,
    continuityScore,
    suggestedBeatPanelIds: pickBeatPanels({ panels, script: input.script }),
    reasons: [
      `story_shape:${storyShapeScore}`,
      `material:${visualMaterialScore}`,
      `crop:${cropScore}`,
      `dialogue:${dialogueScore}`,
      `action:${actionScore}`,
      `continuity:${continuityScore}`,
      `narrative_range:${narrativeRangeScore}`,
      `pages:${pageSequence.join(">")}`,
      `panels:${panelSequence.length}`
    ],
    warnings
  };
}

export function selectComicNarrativeSequence(input: {
  arc: ComicStoryArcV2;
  script: ComicArcScriptDoctorV2Result;
  panelsById: Map<string, ComicStoryMinerPanelRef>;
  maxWindowPages?: number;
  minPanels?: number;
  maxPanels?: number;
  minWindowPages?: number;
}): ComicSequenceSelectorReport {
  const warnings: string[] = [];
  const arcPanelIds = new Set(input.arc.panelIds);
  const arcPages = new Set(input.arc.pages);
  const pageContextRadius = Math.max(1, Math.min(3, Math.floor((input.maxWindowPages ?? 5) / 2)));
  const contextualPages = new Set<number>();
  for (const page of arcPages) {
    for (let offset = -pageContextRadius; offset <= pageContextRadius; offset += 1) {
      if (page + offset > 0) contextualPages.add(page + offset);
    }
  }
  const arcPanels = input.arc.panelIds.flatMap((panelId) => input.panelsById.get(panelId) ? [input.panelsById.get(panelId)!] : []);
  const contextualPanels = [...input.panelsById.values()].filter((panel) =>
    arcPanelIds.has(panel.panelId) || contextualPages.has(panel.pageNumber)
  );
  const panelSource = contextualPanels.length >= 5
    ? contextualPanels
    : arcPanels.length
      ? arcPanels
      : [...input.panelsById.values()];
  if (contextualPanels.length < 5 && input.panelsById.size > 0) {
    warnings.push(`sequence_selector:limited_arc_context:${contextualPanels.length}`);
  }
  const panels = sortPanels(panelSource);
  const panelsByPage = new Map<number, ComicStoryMinerPanelRef[]>();
  for (const panel of panels) {
    panelsByPage.set(panel.pageNumber, [...(panelsByPage.get(panel.pageNumber) ?? []), panel]);
  }
  if (!panels.length) {
    return {
      selectorId: "comic_sequence_selector_v1",
      candidateCount: 0,
      selectedCandidate: null,
      candidates: [],
      warnings: ["sequence_selector:no_panels_available"]
    };
  }

  const maxWindowPages = Math.max(1, input.maxWindowPages ?? 5);
  const minPanels = Math.max(3, input.minPanels ?? Math.min(5, panels.length));
  const maxPanels = Math.max(minPanels, input.maxPanels ?? Math.min(10, Math.max(5, panels.length)));
  const minWindowPages = Math.max(1, Math.min(maxWindowPages, input.minWindowPages ?? 1));
  const candidates: ComicSequenceSelectorCandidate[] = [];

  if (minWindowPages > 1) {
    const spreadPages = [...panelsByPage.keys()].sort((left, right) => left - right);
    if (spreadPages.length >= minWindowPages) {
      const sampledPages = spreadPages.length <= maxPanels
        ? spreadPages
        : Array.from({ length: maxPanels }, (_, index) => spreadPages[Math.round((index / Math.max(1, maxPanels - 1)) * (spreadPages.length - 1))]!).filter((page, index, all) => index === 0 || page !== all[index - 1]);
      const spreadPanels = sampledPages.flatMap((page) => {
        const pagePanels = panelsByPage.get(page) ?? [];
        const best = [...pagePanels].sort((left, right) => panelMaterialScore(right) - panelMaterialScore(left) || panelOrder(left) - panelOrder(right))[0];
        return best ? [best] : [];
      });
      if (spreadPanels.length >= Math.min(minPanels, maxPanels) && unique(spreadPanels.map((panel) => panel.pageNumber)).length >= minWindowPages) {
        candidates.push(scoreWindow({ id: `sequence-story-spread-${spreadPanels.length}`, panels: spreadPanels, script: input.script }));
      }
    }
  }

  for (let start = 0; start < panels.length; start += 1) {
    for (let length = minPanels; length <= maxPanels; length += 1) {
      const window = panels.slice(start, start + length);
      if (window.length < minPanels) continue;
      const pages = unique(window.map((panel) => panel.pageNumber));
      if (pages.length > maxWindowPages) continue;
      if (pages.length < minWindowPages) continue;
      candidates.push(scoreWindow({ id: `sequence-${start + 1}-${window.length}`, panels: window, script: input.script }));
    }
  }

  if (!candidates.length) warnings.push(`sequence_selector:no_window_candidates:min_pages=${minWindowPages}`);
  const ranked = candidates.sort((left, right) =>
    right.score - left.score ||
    right.storyShapeScore - left.storyShapeScore ||
    right.visualMaterialScore - left.visualMaterialScore ||
    left.startPage - right.startPage
  );
  const selectedCandidate = ranked[0] ?? null;
  if (selectedCandidate && selectedCandidate.score < 76) warnings.push(`sequence_selector:selected_score_needs_review:${selectedCandidate.score}`);
  if (selectedCandidate?.warnings.length) warnings.push(...selectedCandidate.warnings.map((warning) => `selected:${warning}`));

  return {
    selectorId: "comic_sequence_selector_v1",
    candidateCount: ranked.length,
    selectedCandidate,
    candidates: ranked.slice(0, 8),
    warnings
  };
}
