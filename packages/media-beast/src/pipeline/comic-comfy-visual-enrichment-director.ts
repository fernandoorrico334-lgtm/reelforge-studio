export type ComicComfyVisualEnrichmentUse =
  | "cold_open"
  | "context_card"
  | "act_transition"
  | "weak_panel_support"
  | "thumbnail"
  | "impact_reconstruction";

export type ComicComfyVisualEnrichmentPriority = "low" | "medium" | "high" | "critical";

export type ComicComfyVisualEnrichmentCue = {
  cueId: string;
  sourceBeatIndex: number;
  text: string;
  pages: string[];
  role?: string | undefined;
  hasImpact?: boolean | undefined;
  hasDialogue?: boolean;
  focusTarget?: string | null | undefined;
  verifiedFocusTargets?: string[] | null;
  evidenceTerms?: string[] | undefined;
  evidenceConfidence?: number;
  transitionHint?: "page_tear" | "direct" | string;
};

export type ComicComfyVisualEnrichmentBeat = {
  issueNumber?: number;
  pages: number[];
  headline?: string | undefined;
  role?: string | undefined;
  spokenText?: string;
};

export type ComicComfyVisualEnrichmentItem = {
  itemId: string;
  use: ComicComfyVisualEnrichmentUse;
  priority: ComicComfyVisualEnrichmentPriority;
  sourceBeatIndex: number | null;
  sourceCueId: string | null;
  recommendedWorkflowPackId: string;
  recommendedQualityPresetId: "draft" | "standard" | "high";
  prompt: string;
  negativePrompt: string;
  placement: "before_cue" | "after_cue" | "replace_weak_panel" | "thumbnail_only";
  durationSeconds: number;
  manualApprovalRequired: true;
  reason: string;
  safetyNotes: string[];
  targetVisualRole: string;
};

export type ComicComfyVisualEnrichmentPlan = {
  directorId: "comic_comfy_visual_enrichment_director_v1";
  status: "passed" | "needs_review";
  itemCount: number;
  criticalItemCount: number;
  manualApprovalRequired: true;
  recommendedDefaultWorkflowPackId: string;
  recommendedDefaultQualityPresetId: "standard" | "high";
  items: ComicComfyVisualEnrichmentItem[];
  warnings: string[];
};

function cleanText(value: string | undefined | null) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function unique<T>(values: T[]) {
  return [...new Set(values)];
}

function compactPromptTerms(values: Array<string | undefined | null>) {
  return unique(values.map(cleanText).filter(Boolean)).slice(0, 8).join(", ");
}

function resolveWorkflowPack(input: {
  niche?: string | undefined;
  tone?: string | undefined;
  role?: string | undefined;
  hasImpact?: boolean | undefined;
}) {
  const text = `${input.niche ?? ""} ${input.tone ?? ""} ${input.role ?? ""}`.toLowerCase();
  if (text.includes("horror") || text.includes("terror")) return "horror_tension";
  if (text.includes("crime") || text.includes("sombr") || text.includes("dark")) return "true_crime_doc";
  if (text.includes("history") || text.includes("historia")) return "history_dark";
  if (text.includes("anime")) return "anime_dark";
  if (input.hasImpact || text.includes("climax") || text.includes("impact")) return "cinematic_story";
  return "comic_drama";
}

function priorityFrom(use: ComicComfyVisualEnrichmentUse, confidence: number) {
  if (use === "cold_open" || use === "thumbnail") return "critical";
  if (use === "weak_panel_support" && confidence < 0.45) return "critical";
  if (use === "impact_reconstruction") return "high";
  if (use === "context_card") return "medium";
  return "low";
}

function buildPrompt(input: {
  use: ComicComfyVisualEnrichmentUse;
  text: string;
  headline?: string | undefined;
  focusTarget?: string | null | undefined;
  evidenceTerms?: string[] | undefined;
  visualStyle?: string | undefined;
  tone?: string | undefined;
}) {
  const headline = cleanText(input.headline);
  const focus = cleanText(input.focusTarget);
  const terms = compactPromptTerms([...(input.evidenceTerms ?? []), focus, headline]);
  const style = input.visualStyle ?? "premium vertical comic documentary still, cinematic lighting, rich contrast, editorial poster composition";
  const tone = input.tone ?? "suspenseful, dramatic, clear storytelling";
  const purpose = {
    cold_open: "make the viewer instantly understand the promise of the story",
    context_card: "clarify story context without replacing the original comic panels",
    act_transition: "bridge two story moments with a cinematic page-turn feeling",
    weak_panel_support: "support narration when the selected comic panel is visually weak or too abstract",
    thumbnail: "create a high-retention Shorts thumbnail with a single readable idea",
    impact_reconstruction: "amplify an action or reveal moment while preserving the story logic",
  }[input.use];
  return `${style}. ${tone}. ${purpose}. Scene idea: ${cleanText(input.text)}. Key visual terms: ${terms}. Vertical 9:16, bold central subject, readable silhouette, no text, no logos, no watermark.`;
}

function negativePrompt() {
  return "blurry, unreadable text, watermark, logo, extra fingers, distorted face, random characters, confusing composition, low contrast, cropped important subject, messy speech bubbles";
}

export function buildComicComfyVisualEnrichmentPlan(input: {
  cues: ComicComfyVisualEnrichmentCue[];
  beats?: ComicComfyVisualEnrichmentBeat[];
  title?: string;
  niche?: string | undefined;
  visualStyle?: string | undefined;
  tone?: string | undefined;
  maxContextCards?: number | undefined;
  includeThumbnail?: boolean | undefined;
}): ComicComfyVisualEnrichmentPlan {
  const warnings: string[] = [];
  const items: ComicComfyVisualEnrichmentItem[] = [];
  const cues = input.cues ?? [];
  const beats = input.beats ?? [];
  const defaultWorkflowPackId = resolveWorkflowPack({ niche: input.niche, tone: input.tone });
  const maxContextCards = Math.max(0, input.maxContextCards ?? 4);
  const firstCue = cues[0];

  if (!firstCue) {
    return {
      directorId: "comic_comfy_visual_enrichment_director_v1",
      status: "needs_review",
      itemCount: 0,
      criticalItemCount: 0,
      manualApprovalRequired: true,
      recommendedDefaultWorkflowPackId: defaultWorkflowPackId,
      recommendedDefaultQualityPresetId: "standard",
      items: [],
      warnings: ["No visual cues were provided for ComfyUI enrichment planning."],
    };
  }

  const firstBeat = beats[firstCue.sourceBeatIndex];
  items.push({
    itemId: "comfy-enrichment-cold-open-001",
    use: "cold_open",
    priority: "critical",
    sourceBeatIndex: firstCue.sourceBeatIndex,
    sourceCueId: firstCue.cueId,
    recommendedWorkflowPackId: resolveWorkflowPack({ niche: input.niche, tone: input.tone, role: firstCue.role, hasImpact: firstCue.hasImpact }),
    recommendedQualityPresetId: "high",
    prompt: buildPrompt({ use: "cold_open", text: firstCue.text, headline: firstBeat?.headline ?? input.title, focusTarget: firstCue.focusTarget, evidenceTerms: firstCue.evidenceTerms, visualStyle: input.visualStyle, tone: input.tone }),
    negativePrompt: negativePrompt(),
    placement: "before_cue",
    durationSeconds: 1.6,
    manualApprovalRequired: true,
    reason: "A cold open ComfyUI still can sell the core promise before the comic page sequence begins.",
    safetyNotes: ["Use as a stylized support image, not as a replacement for the source comic story."],
    targetVisualRole: "instant_hook_promise",
  });

  const weakCues = cues
    .filter((cue) => (cue.evidenceConfidence ?? 0.6) < 0.62 || !(cue.verifiedFocusTargets?.length))
    .slice(0, maxContextCards);
  weakCues.forEach((cue, index) => {
    const confidence = cue.evidenceConfidence ?? 0.5;
    items.push({
      itemId: `comfy-enrichment-context-${String(index + 1).padStart(3, "0")}`,
      use: confidence < 0.5 ? "weak_panel_support" : "context_card",
      priority: priorityFrom(confidence < 0.5 ? "weak_panel_support" : "context_card", confidence),
      sourceBeatIndex: cue.sourceBeatIndex,
      sourceCueId: cue.cueId,
      recommendedWorkflowPackId: resolveWorkflowPack({ niche: input.niche, tone: input.tone, role: cue.role, hasImpact: cue.hasImpact }),
      recommendedQualityPresetId: confidence < 0.5 ? "high" : "standard",
      prompt: buildPrompt({ use: confidence < 0.5 ? "weak_panel_support" : "context_card", text: cue.text, headline: beats[cue.sourceBeatIndex]?.headline, focusTarget: cue.focusTarget, evidenceTerms: cue.evidenceTerms, visualStyle: input.visualStyle, tone: input.tone }),
      negativePrompt: negativePrompt(),
      placement: confidence < 0.5 ? "replace_weak_panel" : "before_cue",
      durationSeconds: confidence < 0.5 ? 1.2 : 1,
      manualApprovalRequired: true,
      reason: confidence < 0.5
        ? "The real panel evidence is weak for the narration, so this needs a support visual candidate."
        : "The narration may benefit from a short context card before returning to real comic panels.",
      safetyNotes: ["Candidate-first only. Keep the original comic panels as the factual/story source."],
      targetVisualRole: confidence < 0.5 ? "clarify_weak_panel" : "context_bridge",
    });
  });

  cues
    .filter((cue) => cue.hasImpact || cue.role === "climax" || cue.role === "payoff")
    .slice(0, 3)
    .forEach((cue, index) => {
      items.push({
        itemId: `comfy-enrichment-impact-${String(index + 1).padStart(3, "0")}`,
        use: "impact_reconstruction",
        priority: "high",
        sourceBeatIndex: cue.sourceBeatIndex,
        sourceCueId: cue.cueId,
        recommendedWorkflowPackId: resolveWorkflowPack({ niche: input.niche, tone: input.tone, role: cue.role, hasImpact: true }),
        recommendedQualityPresetId: "high",
        prompt: buildPrompt({ use: "impact_reconstruction", text: cue.text, headline: beats[cue.sourceBeatIndex]?.headline, focusTarget: cue.focusTarget, evidenceTerms: cue.evidenceTerms, visualStyle: input.visualStyle, tone: input.tone }),
        negativePrompt: negativePrompt(),
        placement: "after_cue",
        durationSeconds: 0.8,
        manualApprovalRequired: true,
        reason: "Impact moments deserve a stylized beat that can carry SFX, zoom, flash, or page-tear transition.",
        safetyNotes: ["Do not imply events that are not supported by the comic sequence."],
        targetVisualRole: "impact_amplifier",
      });
    });

  const transitionCueIndexes = cues
    .map((cue, index) => ({ cue, index }))
    .filter(({ cue, index }) => index > 0 && (cue.transitionHint === "page_tear" || cue.sourceBeatIndex !== cues[index - 1]?.sourceBeatIndex))
    .slice(0, 4);
  transitionCueIndexes.forEach(({ cue }, index) => {
    items.push({
      itemId: `comfy-enrichment-transition-${String(index + 1).padStart(3, "0")}`,
      use: "act_transition",
      priority: "medium",
      sourceBeatIndex: cue.sourceBeatIndex,
      sourceCueId: cue.cueId,
      recommendedWorkflowPackId: defaultWorkflowPackId,
      recommendedQualityPresetId: "standard",
      prompt: buildPrompt({ use: "act_transition", text: cue.text, headline: beats[cue.sourceBeatIndex]?.headline, focusTarget: cue.focusTarget, evidenceTerms: cue.evidenceTerms, visualStyle: input.visualStyle, tone: input.tone }),
      negativePrompt: negativePrompt(),
      placement: "before_cue",
      durationSeconds: 0.65,
      manualApprovalRequired: true,
      reason: "This story beat changes act/page rhythm and can use a cinematic bridge instead of a mechanical cut.",
      safetyNotes: ["Use as atmosphere/bridge only; do not replace story evidence."],
      targetVisualRole: "act_bridge",
    });
  });

  if (input.includeThumbnail ?? true) {
    const bestCue = cues.find((cue) => cue.hasImpact) ?? firstCue;
    items.push({
      itemId: "comfy-enrichment-thumbnail-001",
      use: "thumbnail",
      priority: "critical",
      sourceBeatIndex: bestCue.sourceBeatIndex,
      sourceCueId: bestCue.cueId,
      recommendedWorkflowPackId: resolveWorkflowPack({ niche: input.niche, tone: input.tone, role: bestCue.role, hasImpact: bestCue.hasImpact }),
      recommendedQualityPresetId: "high",
      prompt: buildPrompt({ use: "thumbnail", text: bestCue.text, headline: beats[bestCue.sourceBeatIndex]?.headline ?? input.title, focusTarget: bestCue.focusTarget, evidenceTerms: bestCue.evidenceTerms, visualStyle: input.visualStyle, tone: input.tone }),
      negativePrompt: negativePrompt(),
      placement: "thumbnail_only",
      durationSeconds: 0,
      manualApprovalRequired: true,
      reason: "A dedicated thumbnail candidate usually outperforms a random frame from the finished video.",
      safetyNotes: ["Keep thumbnail truthful to the story promise."],
      targetVisualRole: "youtube_shorts_thumbnail",
    });
  }

  if (items.some((item) => item.use === "weak_panel_support")) warnings.push("Some narration moments have weak verified panel support. Review ComfyUI candidates before render.");
  if (items.length > 10) warnings.push("Enrichment plan is dense. Use only the strongest ComfyUI candidates to avoid losing the comic-reading feel.");

  const criticalItemCount = items.filter((item) => item.priority === "critical").length;
  return {
    directorId: "comic_comfy_visual_enrichment_director_v1",
    status: warnings.length ? "needs_review" : "passed",
    itemCount: items.length,
    criticalItemCount,
    manualApprovalRequired: true,
    recommendedDefaultWorkflowPackId: defaultWorkflowPackId,
    recommendedDefaultQualityPresetId: "high",
    items,
    warnings,
  };
}