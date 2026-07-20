export type ComicPanelBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type ComicDetectedBalloon = {
  balloonId: string;
  readingOrder: number;
  normalizedBox: ComicPanelBox;
  speakerSide: "left" | "center" | "right";
  speakerAnchor: { x: number; y: number };
  confidence: number;
};

export type ComicDetectedPanel = {
  panelId: string;
  readingOrder: number;
  normalizedBox: ComicPanelBox;
  contentScore: number;
  confidence: number;
  balloons?: ComicDetectedBalloon[];
  dialogueImportanceScore?: number;
  semanticRole?: "dialogue" | "visual_action_or_context";
  primarySpeakerAnchor?: { x: number; y: number } | null;
};

export type ComicDetectedPage = {
  page: string;
  width: number;
  height: number;
  panelCount: number;
  panels: ComicDetectedPanel[];
  warnings: string[];
};

export type ComicShotRole =
  | "cold_open"
  | "establishing"
  | "dialogue"
  | "reaction"
  | "action"
  | "impact"
  | "payoff";

export type ComicShotTransition =
  | "cut"
  | "push"
  | "page_tear"
  | "flash_white"
  | "black_flash"
  | "motion_match"
  | "impact_cut";

export type ComicShotCameraMove =
  | "slow_push"
  | "dialogue_push"
  | "reaction_push"
  | "action_pan"
  | "impact_snap"
  | "payoff_hold";

export type ComicPanelShot = {
  shotId: string;
  beatIndex: number;
  page: string;
  pageNumber: number;
  panelId: string;
  panelReadingOrder: number;
  shotRole: ComicShotRole;
  durationSeconds: number;
  normalizedCrop: ComicPanelBox;
  cameraMove: ComicShotCameraMove;
  transitionIn: ComicShotTransition;
  isColdOpen: boolean;
  narrativeOrderExempt: boolean;
  confidence: number;
  dialogueBalloonId: string | null;
  speakerAnchor: { x: number; y: number } | null;
  semanticAssociationConfidence: number;
  warnings: string[];
};

export type ComicPanelShotPlan = {
  directorId: "comic_panel_shot_director_v1";
  shotCount: number;
  averageShotDurationSeconds: number;
  maximumShotDurationSeconds: number;
  coldOpenDurationSeconds: number;
  mainStoryIsMonotonic: boolean;
  repeatedPanelCount: number;
  repeatedSourcePanelCount: number;
  transitionCounts: Record<ComicShotTransition, number>;
  shots: ComicPanelShot[];
  warnings: string[];
};

export type ComicShotBeatInput = {
  pages: string[];
  durationSeconds: number;
  role?: "hook" | "setup" | "context" | "tension" | "climax" | "payoff";
  hasDialogue?: boolean;
  hasImpact?: boolean;
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function round(value: number) {
  return Math.round(value * 1000) / 1000;
}

function pageNumber(page: string) {
  return Number.parseInt(page.replace(/\D/g, ""), 10) || 0;
}

function fallbackPanel(page: string): ComicDetectedPanel {
  return {
    panelId: `${page.replace(/\.[^.]+$/, "")}-directed-full-page`,
    readingOrder: 1,
    normalizedBox: { x: 0.04, y: 0.02, width: 0.92, height: 0.96 },
    contentScore: 0.7,
    confidence: 55
  };
}

function expandPanelsForDirectedCoverage(panels: ComicDetectedPanel[], targetCount: number) {
  const expanded = [...panels];
  const anchors = [
    { x: 0.5, y: 0.3 },
    { x: 0.5, y: 0.5 },
    { x: 0.5, y: 0.7 },
    { x: 0.38, y: 0.5 },
    { x: 0.62, y: 0.5 }
  ];
  let variantIndex = 0;
  while (expanded.length < targetCount) {
    const source = panels[variantIndex % panels.length]!;
    const anchor = anchors[variantIndex % anchors.length]!;
    const width = clamp(source.normalizedBox.width * 0.82, 0.5, 0.9);
    const height = clamp(source.normalizedBox.height * 0.62, 0.46, 0.82);
    expanded.push({
      ...source,
      panelId: `${source.panelId}-focus-${variantIndex + 1}`,
      readingOrder: source.readingOrder + (variantIndex + 1) / 10,
      normalizedBox: {
        x: clamp(anchor.x - width / 2, source.normalizedBox.x, source.normalizedBox.x + source.normalizedBox.width - width),
        y: clamp(anchor.y - height / 2, source.normalizedBox.y, source.normalizedBox.y + source.normalizedBox.height - height),
        width,
        height
      },
      confidence: Math.max(50, source.confidence - 5)
    });
    variantIndex += 1;
  }
  return expanded.sort((left, right) => left.readingOrder - right.readingOrder);
}


function choosePanels(page: ComicDetectedPage | undefined, targetCount: number) {
  const panels = page?.panels?.length ? page.panels : [fallbackPanel(page?.page ?? "unknown")];
  if (panels.length < targetCount) return panels;
  if (panels.length === targetCount) return panels;
  if (targetCount === 1) {
    return [panels.reduce((best, panel) => (panel.contentScore + (panel.dialogueImportanceScore ?? 0) / 180) > (best.contentScore + (best.dialogueImportanceScore ?? 0) / 180) ? panel : best)];
  }

  const selected = new Map<string, ComicDetectedPanel>();
  const firstPanel = panels[0]!;
  const lastPanel = panels[panels.length - 1]!;
  selected.set(firstPanel.panelId, firstPanel);
  selected.set(lastPanel.panelId, lastPanel);
  for (const panel of [...panels].sort((left, right) =>
    (right.contentScore + (right.dialogueImportanceScore ?? 0) / 180) -
    (left.contentScore + (left.dialogueImportanceScore ?? 0) / 180)
  )) {
    if (selected.size >= targetCount) break;
    selected.set(panel.panelId, panel);
  }
  return [...selected.values()].sort((left, right) => left.readingOrder - right.readingOrder);
}

function selectPagesForDuration(pages: string[], targetCount: number) {
  if (pages.length <= targetCount) return pages;
  if (targetCount <= 1) return [pages[Math.floor((pages.length - 1) / 2)]!];
  const selected = Array.from({ length: targetCount }, (_, index) => {
    const sourceIndex = Math.round(index * (pages.length - 1) / (targetCount - 1));
    return pages[sourceIndex]!;
  });
  return [...new Set(selected)];
}

function roleFor(input: { beat: ComicShotBeatInput; panelIndex: number; panelCount: number }): ComicShotRole {
  if (input.beat.role === "payoff" && input.panelIndex === input.panelCount - 1) return "payoff";
  if (input.beat.hasImpact || input.beat.role === "climax") {
    return input.panelIndex === input.panelCount - 1 ? "impact" : "action";
  }
  if (input.beat.hasDialogue) return input.panelIndex % 2 === 0 ? "dialogue" : "reaction";
  if (input.panelIndex === 0) return "establishing";
  return input.panelIndex === input.panelCount - 1 ? "reaction" : "action";
}

function cameraMoveFor(role: ComicShotRole): ComicShotCameraMove {
  if (role === "dialogue") return "dialogue_push";
  if (role === "reaction") return "reaction_push";
  if (role === "action") return "action_pan";
  if (role === "impact" || role === "cold_open") return "impact_snap";
  if (role === "payoff") return "payoff_hold";
  return "slow_push";
}

function transitionFor(input: {
  role: ComicShotRole;
  shotIndex: number;
  previous: ComicShotTransition | null;
  isFirstMainStoryShot: boolean;
}): ComicShotTransition {
  if (input.isFirstMainStoryShot) return "page_tear";
  if (input.role === "impact" || input.role === "cold_open") return "impact_cut";
  if (input.role === "action" && input.shotIndex % 4 === 0) return "motion_match";
  if (input.role === "reaction" && input.shotIndex % 3 === 0) return "push";
  if (input.previous === "cut" && input.shotIndex % 5 === 0) return "push";
  return "cut";
}

function durationDistribution(total: number, count: number) {
  if (count <= 1) return [round(total)];
  const weights = Array.from({ length: count }, (_, index) => index === 0 ? 1.08 : index === count - 1 ? 1.12 : 1);
  const weightTotal = weights.reduce((sum, weight) => sum + weight, 0);
  const durations = weights.map((weight) => round(total * weight / weightTotal));
  durations[durations.length - 1] = round(total - durations.slice(0, -1).reduce((sum, value) => sum + value, 0));
  return durations;
}

export function buildComicPanelShotPlan(input: {
  beats: ComicShotBeatInput[];
  detectedPages: ComicDetectedPage[];
  coldOpenPage?: string;
  coldOpenDurationSeconds?: number;
  maximumShotDurationSeconds?: number;
  minimumShotDurationSeconds?: number;
}): ComicPanelShotPlan {
  const pageMap = new Map(input.detectedPages.map((page) => [page.page, page]));
  const maximumShotDurationSeconds = clamp(input.maximumShotDurationSeconds ?? 2.1, 1.2, 4);
  const minimumShotDurationSeconds = clamp(input.minimumShotDurationSeconds ?? 1.05, 0.8, maximumShotDurationSeconds);
  const coldOpenDurationSeconds = input.coldOpenPage ? clamp(input.coldOpenDurationSeconds ?? 2, 1.2, 2.5) : 0;
  const shots: ComicPanelShot[] = [];
  const warnings: string[] = [];
  let previousTransition: ComicShotTransition | null = null;

  if (input.coldOpenPage) {
    const detected = pageMap.get(input.coldOpenPage);
    const strongest = choosePanels(detected, 1)[0] ?? fallbackPanel(input.coldOpenPage);
    shots.push({
      shotId: "cold-open",
      beatIndex: -1,
      page: input.coldOpenPage,
      pageNumber: pageNumber(input.coldOpenPage),
      panelId: strongest.panelId,
      panelReadingOrder: strongest.readingOrder,
      shotRole: "cold_open",
      durationSeconds: round(coldOpenDurationSeconds),
      normalizedCrop: strongest.normalizedBox,
      cameraMove: "impact_snap",
      transitionIn: "cut",
      isColdOpen: true,
      narrativeOrderExempt: true,
      confidence: strongest.confidence,
      dialogueBalloonId: strongest.balloons?.[0]?.balloonId ?? null,
      speakerAnchor: strongest.balloons?.[0]?.speakerAnchor ?? strongest.primarySpeakerAnchor ?? null,
      semanticAssociationConfidence: strongest.balloons?.[0]?.confidence ?? 0,
      warnings: ["cold_open_page_order_exception"]
    });
    previousTransition = "cut";
  }

  let firstMainStoryShot = true;
  input.beats.forEach((beat, beatIndex) => {
    const availableDuration = beatIndex === 0 ? Math.max(0.8, beat.durationSeconds - coldOpenDurationSeconds) : beat.durationSeconds;
    const maximumReadableShotCount = Math.max(1, Math.floor(availableDuration / minimumShotDurationSeconds));
    const desiredShotCount = Math.max(beat.pages.length, Math.ceil(availableDuration / maximumShotDurationSeconds));
    const targetShotCount = Math.min(desiredShotCount, maximumReadableShotCount);
    const selectedPages = selectPagesForDuration(beat.pages, Math.min(beat.pages.length, targetShotCount));
    const pageAllocations = selectedPages.map((page, pageIndex) => {
      const detected = pageMap.get(page);
      const base = Math.max(1, Math.floor(targetShotCount / selectedPages.length));
      const remainder = pageIndex < targetShotCount % selectedPages.length ? 1 : 0;
      return { page, detected, panels: choosePanels(detected, base + remainder) };
    });
    const selectedPanels = pageAllocations.flatMap((allocation) => allocation.panels.map((panel) => ({ ...allocation, panel })));
    const durations = durationDistribution(availableDuration, selectedPanels.length);

    selectedPanels.forEach((selection, panelIndex) => {
      const detectedBalloon = selection.panel.balloons?.[0] ?? null;
      const role = detectedBalloon && beat.hasDialogue
        ? "dialogue"
        : roleFor({ beat, panelIndex, panelCount: selectedPanels.length });
      const transitionIn = transitionFor({
        role,
        shotIndex: shots.length,
        previous: previousTransition,
        isFirstMainStoryShot: firstMainStoryShot
      });
      const panelWarnings = [...(selection.detected?.warnings ?? [])];
      if (selection.panel.confidence < 64) panelWarnings.push("low_panel_detection_confidence");
      shots.push({
        shotId: `beat-${beatIndex + 1}-${selection.panel.panelId}`,
        beatIndex,
        page: selection.page,
        pageNumber: pageNumber(selection.page),
        panelId: selection.panel.panelId,
        panelReadingOrder: selection.panel.readingOrder,
        shotRole: role,
        durationSeconds: durations[panelIndex] ?? round(availableDuration / selectedPanels.length),
        normalizedCrop: selection.panel.normalizedBox,
        cameraMove: cameraMoveFor(role),
        transitionIn,
        isColdOpen: false,
        narrativeOrderExempt: false,
        confidence: selection.panel.confidence,
        dialogueBalloonId: detectedBalloon?.balloonId ?? null,
        speakerAnchor: detectedBalloon?.speakerAnchor ?? selection.panel.primarySpeakerAnchor ?? null,
        semanticAssociationConfidence: detectedBalloon?.confidence ?? 0,
        warnings: panelWarnings
      });
      firstMainStoryShot = false;
      previousTransition = transitionIn;
    });
  });

  const mainStoryShots = shots.filter((shot) => !shot.narrativeOrderExempt);
  const mainStoryIsMonotonic = mainStoryShots.every((shot, index) => index === 0 || shot.pageNumber >= mainStoryShots[index - 1]!.pageNumber);
  const repeatedPanelCount = shots.length - new Set(shots.map((shot) => `${shot.isColdOpen ? "cold:" : "main:"}${shot.panelId}`)).size;
  const repeatedSourcePanelCount = shots.length - new Set(shots.map((shot) => {
    const canonicalPanelId = shot.panelId.replace(/-focus-\d+$/, "");
    return `${shot.isColdOpen ? "cold:" : "main:"}${canonicalPanelId}`;
  })).size;
  if (!mainStoryIsMonotonic) warnings.push("main_story_page_order_is_not_monotonic");
  if (repeatedPanelCount > 0) warnings.push("panel_repetition_detected");
  if (repeatedSourcePanelCount > 0) warnings.push("source_panel_repetition_detected");

  const transitionCounts = shots.reduce<Record<ComicShotTransition, number>>((counts, shot) => {
    counts[shot.transitionIn] += 1;
    return counts;
  }, { cut: 0, push: 0, page_tear: 0, flash_white: 0, black_flash: 0, motion_match: 0, impact_cut: 0 });
  const averageShotDurationSeconds = shots.length
    ? round(shots.reduce((sum, shot) => sum + shot.durationSeconds, 0) / shots.length)
    : 0;

  return {
    directorId: "comic_panel_shot_director_v1",
    shotCount: shots.length,
    averageShotDurationSeconds,
    maximumShotDurationSeconds: round(Math.max(0, ...shots.map((shot) => shot.durationSeconds))),
    coldOpenDurationSeconds: round(coldOpenDurationSeconds),
    mainStoryIsMonotonic,
    repeatedPanelCount,
    repeatedSourcePanelCount,
    transitionCounts,
    shots,
    warnings
  };
}

