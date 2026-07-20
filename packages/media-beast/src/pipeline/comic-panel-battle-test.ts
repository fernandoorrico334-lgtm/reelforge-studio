import type { ComicArcScriptBeat, ComicArcScriptDoctorV2Result } from "./comic-arc-script-doctor-v2.js";
import { directComicArcVisualScene, type ComicArcVisualTargetType } from "./comic-arc-visual-director.js";
import type { ComicStoryArcV2 } from "./comic-story-arc-miner-v2.js";
import type { ComicStoryMinerPanelRef } from "./comic-story-miner.js";

export type ComicPanelBattleTestCandidate = {
  panelId: string;
  pageNumber: number;
  score: number;
  selectedTarget: ComicArcVisualTargetType;
  alignmentScore: number;
  regionConfidence: number;
  materialScore: number;
  panelOrder: number;
  captionRisk: string;
  reasons: string[];
  warnings: string[];
  selected: boolean;
};

export type ComicPanelBattleTestBeatResult = {
  beatRole: ComicArcScriptBeat["role"];
  originalPanelId: string;
  selectedPanelId: string;
  selectedPageNumber: number;
  improved: boolean;
  selectedScore: number;
  originalScore: number;
  candidates: ComicPanelBattleTestCandidate[];
  warnings: string[];
};

export type ComicPanelBattleTestReport = {
  testerId: "comic_panel_battle_test_v1";
  beatCount: number;
  improvedBeatCount: number;
  averageSelectedScore: number;
  optimizedBeats: ComicArcScriptBeat[];
  beatResults: ComicPanelBattleTestBeatResult[];
  selectedPanelIds: string[];
  rejectedAlternatives: Array<{
    beatRole: ComicArcScriptBeat["role"];
    panelId: string;
    score: number;
    reason: string;
  }>;
  warnings: string[];
};

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function panelText(panel: ComicStoryMinerPanelRef) {
  return normalize([
    ...panel.visibleCharacters,
    ...panel.visibleThemes,
    ...panel.localDialogue,
    ...panel.localNarrationBoxes,
    ...panel.soundEffects,
    panel.visualCropEvidence.strongestActionLabel ?? "",
    panel.visualCropEvidence.strongestRelationshipType ?? "",
    panel.visualCropEvidence.storyFunction
  ].join(" "));
}

function beatText(beat: ComicArcScriptBeat, arc: ComicStoryArcV2) {
  return normalize([
    beat.role,
    beat.purpose,
    beat.narrationText,
    beat.captionText,
    beat.evidenceReason,
    ...arc.characters,
    ...arc.themes,
    arc.type
  ].join(" "));
}

function wordOverlap(left: string, right: string) {
  const leftWords = new Set(left.split(/\s+/).filter((word) => word.length >= 4));
  const rightWords = new Set(right.split(/\s+/).filter((word) => word.length >= 4));
  if (!leftWords.size || !rightWords.size) return 0;
  let hits = 0;
  for (const word of leftWords) {
    if (rightWords.has(word)) hits += 1;
  }
  return hits / Math.max(1, Math.min(leftWords.size, rightWords.size));
}


function panelOrderFromId(panelId: string): number {
  const match = panelId.match(/panel(\d+)/i);
  return match ? Number(match[1]) : 0;
}

function materialScoreFor(input: {
  beat: ComicArcScriptBeat;
  panel: ComicStoryMinerPanelRef;
  visual: ReturnType<typeof directComicArcVisualScene>;
}) {
  const evidence = input.panel.visualCropEvidence;
  const counts = evidence.evidenceCounts;
  const map = input.visual.visualEvidenceMap;
  const target = input.visual.primaryTarget;
  const textLoad = counts.dialogue + counts.narrationBoxes + counts.detectedText;
  const hasSpeech = textLoad > 0 || Boolean(map?.bestRegionByType.speech_balloon);
  const hasAction = counts.actions > 0 || counts.soundEffects > 0 || evidence.confidence.actions >= 0.68 || Boolean(evidence.strongestActionLabel);
  const hasCharacters = counts.characters > 0 || evidence.confidence.characters >= 0.58;
  const hasConflict = evidence.visualFlags.duoVisible || /conflict|threat|rival|enemy|host|versus/i.test(evidence.strongestRelationshipType ?? "");
  let score = 28;

  if (hasSpeech) score += 16;
  if (hasAction) score += 18;
  if (hasCharacters) score += 12;
  if (hasConflict) score += 12;
  if (target === "speech_balloon" && hasSpeech) score += 14;
  if (target === "impact_zone" && hasAction) score += 14;
  if (target === "duo_conflict" && hasConflict) score += 12;
  if ((input.beat.role === "setup" || input.beat.role === "tension" || input.beat.role === "payoff") && hasSpeech) score += 8;
  if ((input.beat.role === "hook" || input.beat.role === "climax") && (hasAction || hasConflict)) score += 8;
  score += Math.min(10, Math.round(evidence.quality.cropability916Score / 10));
  score += Math.min(8, Math.round((input.visual.selectedEvidenceRegion?.confidence ?? 0) / 12));

  const panelRuntimeMetadata = input.panel as ComicStoryMinerPanelRef & { evidenceTier?: string; isWholePageFallback?: boolean };
  if (evidence.quality.cropability916Score < 24) score -= 26;
  if (panelRuntimeMetadata.evidenceTier === "rejected") score -= 24;
  if (panelRuntimeMetadata.isWholePageFallback && evidence.quality.cropability916Score < 50) score -= 10;
  if (!hasSpeech && ["setup", "tension", "payoff"].includes(input.beat.role)) score -= 16;
  if (!hasAction && input.beat.role === "climax") score -= 18;
  if (!hasCharacters) score -= 8;
  if (map?.layoutMap.captionRisk === "high") score -= 8;
  if (input.visual.warnings.some((warning) => warning.includes("missing") || warning.includes("low_confidence"))) score -= 8;
  return clampScore(score);
}
function roleFitScore(beat: ComicArcScriptBeat, panel: ComicStoryMinerPanelRef) {
  const evidence = panel.visualCropEvidence;
  const counts = evidence.evidenceCounts;
  let score = 45;
  if (beat.role === "hook") {
    if (counts.actions > 0 || counts.soundEffects > 0) score += 18;
    if (evidence.visualFlags.duoVisible || evidence.strongestRelationshipType === "conflict") score += 16;
  }
  if (beat.role === "setup") {
    if (counts.dialogue > 0 || counts.narrationBoxes > 0 || counts.detectedText > 0) score += 16;
    if (["setup", "context", "dialogue"].includes(evidence.storyFunction)) score += 12;
  }
  if (beat.role === "tension") {
    if (counts.actions > 0 || counts.dialogue > 0) score += 10;
    if (evidence.strongestRelationshipType === "conflict") score += 14;
  }
  if (beat.role === "climax") {
    if (counts.actions > 0 || counts.soundEffects > 0) score += 22;
    if (["climax", "action", "transformation", "reveal"].includes(evidence.storyFunction)) score += 16;
  }
  if (beat.role === "payoff") {
    if (counts.dialogue > 0 || counts.narrationBoxes > 0) score += 10;
    if (["reaction", "reveal", "dialogue"].includes(evidence.storyFunction)) score += 16;
  }
  score += Math.min(8, Math.round(evidence.quality.cropability916Score / 14));
  const panelRuntimeMetadata = panel as ComicStoryMinerPanelRef & { evidenceTier?: string };
  if (evidence.quality.cropability916Score < 24) score -= 18;
  if (panelRuntimeMetadata.evidenceTier === "rejected") score -= 14;
  score += Math.min(6, Math.round(evidence.confidence.overall * 6));
  return clampScore(score);
}

function scoreCandidate(input: {
  arc: ComicStoryArcV2;
  beat: ComicArcScriptBeat;
  panel: ComicStoryMinerPanelRef;
  originalPanelIds: Set<string>;
  usedPanelIds: Set<string>;
  preferredPanelIds?: Set<string> | undefined;
  preferredBeatPanelId?: string | undefined;
}) : ComicPanelBattleTestCandidate {
  const visual = directComicArcVisualScene({ arc: input.arc, beat: input.beat, panel: input.panel });
  const overlap = wordOverlap(beatText(input.beat, input.arc), panelText(input.panel));
  const roleFit = roleFitScore(input.beat, input.panel);
  const regionConfidence = visual.selectedEvidenceRegion?.confidence ?? 0;
  const materialScore = materialScoreFor({ beat: input.beat, panel: input.panel, visual });
  const panelOrder = panelOrderFromId(input.panel.panelId);
  const pageDistance = Math.abs(input.beat.pageNumber - input.panel.pageNumber);
  const inOriginalArc = input.originalPanelIds.has(input.panel.panelId);
  const inPreferredSequence = input.preferredPanelIds?.has(input.panel.panelId) ?? false;
  const preferredForBeat = input.preferredBeatPanelId === input.panel.panelId;
  const reused = input.usedPanelIds.has(input.panel.panelId);
  let score = 0;
  score += visual.panelNarrationAlignmentScore * 0.28;
  score += roleFit * 0.22;
  score += materialScore * 0.28;
  score += regionConfidence * 0.14;
  score += Math.round(overlap * 100) * 0.08;
  score += inOriginalArc ? 5 : 0;
  score += inPreferredSequence ? 10 : 0;
  score += preferredForBeat ? 28 : 0;
  score -= Math.min(10, pageDistance * 2);
  score -= reused ? 18 : 0;
  if (visual.visualEvidenceMap?.layoutMap.captionRisk === "high") score -= 8;
  if (visual.warnings.some((warning) => warning.includes("missing") || warning.includes("low"))) score -= 6;

  return {
    panelId: input.panel.panelId,
    pageNumber: input.panel.pageNumber,
    score: clampScore(score),
    selectedTarget: visual.primaryTarget,
    alignmentScore: visual.panelNarrationAlignmentScore,
    regionConfidence,
    materialScore,
    panelOrder,
    captionRisk: visual.visualEvidenceMap?.layoutMap.captionRisk ?? "unknown",
    reasons: [
      `alignment:${visual.panelNarrationAlignmentScore}`,
      `role_fit:${roleFit}`,
      `region:${visual.primaryTarget}:${regionConfidence}`,
      `material:${materialScore}`,
      `text_overlap:${Math.round(overlap * 100)}`,
      inOriginalArc ? "inside_original_arc" : "nearby_candidate",
      inPreferredSequence ? "inside_sequence_selector" : "outside_sequence_selector",
      preferredForBeat ? "preferred_for_beat" : "not_preferred_for_beat",
      reused ? "reuse_penalty" : "unique_panel_candidate"
    ],
    warnings: visual.warnings,
    selected: false
  };
}

function candidatePool(input: {
  beat: ComicArcScriptBeat;
  arc: ComicStoryArcV2;
  panels: ComicStoryMinerPanelRef[];
}) {
  const arcPanelIds = new Set(input.arc.panelIds);
  const beatTerms = beatText(input.beat, input.arc);
  return input.panels
    .filter((panel) => {
      if (arcPanelIds.has(panel.panelId)) return true;
      if (Math.abs(panel.pageNumber - input.beat.pageNumber) <= 2) return true;
      return wordOverlap(beatTerms, panelText(panel)) >= 0.18;
    })
    ;
}

function chooseEarliestStrongCandidate(candidates: ComicPanelBattleTestCandidate[]): ComicPanelBattleTestCandidate | undefined {
  const bestScore = candidates[0]?.score ?? 0;
  const qualityFloor = Math.max(bestScore - 20, 64);
  const strongCandidates = candidates.filter((candidate) => candidate.score >= qualityFloor || candidate.materialScore >= 76);
  return (strongCandidates.length ? strongCandidates : candidates)
    .sort((left, right) => left.pageNumber - right.pageNumber || left.panelOrder - right.panelOrder || right.score - left.score)[0] ?? candidates[0];
}
export function runComicPanelBattleTest(input: {
  arc: ComicStoryArcV2;
  script: ComicArcScriptDoctorV2Result;
  panelsById: Map<string, ComicStoryMinerPanelRef>;
  preferredPanelIds?: string[] | undefined;
  preferredBeatPanelIds?: Partial<Record<ComicArcScriptBeat["role"], string>> | undefined;
}): ComicPanelBattleTestReport {
  const warnings: string[] = [];
  const usedPanelIds = new Set<string>();
  const originalPanelIds = new Set(input.arc.panelIds);
  const preferredPanelIds = new Set(input.preferredPanelIds ?? []);
  const panels = [...input.panelsById.values()];
  const optimizedBeats: ComicArcScriptBeat[] = [];
  const beatResults: ComicPanelBattleTestBeatResult[] = [];
  const rejectedAlternatives: ComicPanelBattleTestReport["rejectedAlternatives"] = [];
  let previousSelectedPageNumber = 0;
  let previousSelectedPanelOrder = 0;

  for (const beat of input.script.beats) {
    const pool = candidatePool({ beat, arc: input.arc, panels });
    const preferredPanels = [...preferredPanelIds]
      .flatMap((panelId) => input.panelsById.get(panelId) ? [input.panelsById.get(panelId)!] : []);
    const expandedPool = preferredPanelIds.size >= Math.min(4, input.script.beats.length)
      ? preferredPanels
      : unique([...pool, ...preferredPanels]);
    if (preferredPanelIds.size >= Math.min(4, input.script.beats.length)) {
      warnings.push(`battle_test:locked_to_sequence_selector:${preferredPanelIds.size}`);
    }
    if (!expandedPool.length) {
      warnings.push(`battle_test:no_candidates:${beat.role}:${beat.panelId}`);
      optimizedBeats.push(beat);
      continue;
    }

    const candidates = expandedPool
      .map((panel) => scoreCandidate({
        arc: input.arc,
        beat,
        panel,
        originalPanelIds,
        usedPanelIds,
        preferredPanelIds,
        preferredBeatPanelId: input.preferredBeatPanelIds?.[beat.role]
      }))
      .sort((left, right) => right.score - left.score);
    const originalScore = candidates.find((candidate) => candidate.panelId === beat.panelId)?.score ?? 0;
    const forwardUniqueCandidates = candidates.filter((candidate) =>
      (candidate.pageNumber > previousSelectedPageNumber ||
        (candidate.pageNumber === previousSelectedPageNumber && candidate.panelOrder >= previousSelectedPanelOrder)) &&
      !usedPanelIds.has(candidate.panelId)
    );
    const forwardCandidates = candidates.filter((candidate) =>
      candidate.pageNumber > previousSelectedPageNumber ||
      (candidate.pageNumber === previousSelectedPageNumber && candidate.panelOrder >= previousSelectedPanelOrder)
    );
    const bridgeWindowLimit = previousSelectedPageNumber > 0 ? previousSelectedPageNumber + 4 : Number.POSITIVE_INFINITY;
    const bridgeUniqueCandidates = forwardUniqueCandidates.filter((candidate) => candidate.pageNumber <= bridgeWindowLimit);
    const bridgeCandidates = forwardCandidates.filter((candidate) => candidate.pageNumber <= bridgeWindowLimit);
    const bridgeQualityCandidates = bridgeCandidates.some((candidate) => candidate.score >= 64 || candidate.materialScore >= 76)
      ? bridgeCandidates
      : [];
    const bridgeQualityUniqueCandidates = bridgeUniqueCandidates.some((candidate) => candidate.score >= 64 || candidate.materialScore >= 76)
      ? bridgeUniqueCandidates
      : [];
    const uniqueCandidates = candidates.filter((candidate) => !usedPanelIds.has(candidate.panelId));
    const preferredCandidate = candidates.find((candidate) =>
      candidate.panelId === input.preferredBeatPanelIds?.[beat.role] &&
      !usedPanelIds.has(candidate.panelId) &&
      (candidate.pageNumber > previousSelectedPageNumber ||
        (candidate.pageNumber === previousSelectedPageNumber && candidate.panelOrder >= previousSelectedPanelOrder))
    );
    const selected =
      preferredCandidate ??
      chooseEarliestStrongCandidate(bridgeQualityUniqueCandidates) ??
      chooseEarliestStrongCandidate(bridgeQualityCandidates) ??
      chooseEarliestStrongCandidate(forwardUniqueCandidates) ??
      chooseEarliestStrongCandidate(forwardCandidates) ??
      chooseEarliestStrongCandidate(uniqueCandidates) ??
      candidates[0];
    if (!selected) {
      warnings.push(`battle_test:no_selected_candidate:${beat.role}:${beat.panelId}`);
      optimizedBeats.push(beat);
      continue;
    }

    const beatWarnings: string[] = [];
    if (selected.pageNumber < previousSelectedPageNumber) {
      beatWarnings.push(`selected_panel_goes_backward:${previousSelectedPageNumber}->${selected.pageNumber}`);
      warnings.push(`battle_test:selected_panel_goes_backward:${beat.role}:${previousSelectedPageNumber}->${selected.pageNumber}`);
    }
    if (usedPanelIds.has(selected.panelId)) {
      beatWarnings.push(`selected_panel_reused:${selected.panelId}`);
      warnings.push(`battle_test:selected_panel_reused:${beat.role}:${selected.panelId}`);
    }

    selected.selected = true;
    usedPanelIds.add(selected.panelId);
    if (selected.pageNumber > previousSelectedPageNumber) {
      previousSelectedPanelOrder = selected.panelOrder;
    } else if (selected.pageNumber === previousSelectedPageNumber) {
      previousSelectedPanelOrder = Math.max(previousSelectedPanelOrder, selected.panelOrder);
    }
    previousSelectedPageNumber = Math.max(previousSelectedPageNumber, selected.pageNumber);
    optimizedBeats.push({ ...beat, panelId: selected.panelId, pageNumber: selected.pageNumber });
    rejectedAlternatives.push(...candidates.slice(1, 4).map((candidate) => ({
      beatRole: beat.role,
      panelId: candidate.panelId,
      score: candidate.score,
      reason: candidate.warnings[0] ?? `lower_score_than_selected:${selected.panelId}`
    })));
    beatResults.push({
      beatRole: beat.role,
      originalPanelId: beat.panelId,
      selectedPanelId: selected.panelId,
      selectedPageNumber: selected.pageNumber,
      improved: selected.panelId !== beat.panelId && selected.score > originalScore,
      selectedScore: selected.score,
      originalScore,
      candidates,
      warnings: [
        ...(selected.score < 72 ? [`selected_panel_score_low:${selected.score}`] : []),
        ...beatWarnings
      ]
    });
  }

  const selectedScores = beatResults.map((result) => result.selectedScore);
  const averageSelectedScore = selectedScores.length
    ? Math.round(selectedScores.reduce((sum, score) => sum + score, 0) / selectedScores.length)
    : 0;
  const improvedBeatCount = beatResults.filter((result) => result.improved).length;
  if (averageSelectedScore < 76) warnings.push(`battle_test:average_score_low:${averageSelectedScore}`);
  const selectedPanelIds = unique(optimizedBeats.map((beat) => beat.panelId));
  if (selectedPanelIds.length < Math.min(4, optimizedBeats.length)) warnings.push("battle_test:low_visual_variety_after_selection");

  return {
    testerId: "comic_panel_battle_test_v1",
    beatCount: input.script.beats.length,
    improvedBeatCount,
    averageSelectedScore,
    optimizedBeats,
    beatResults,
    selectedPanelIds,
    rejectedAlternatives,
    warnings
  };
}