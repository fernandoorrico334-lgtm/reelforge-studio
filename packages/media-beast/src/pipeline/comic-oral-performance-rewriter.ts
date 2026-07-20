import { applyComicTtsPronunciation } from "./comic-pronunciation-dictionary.js";

export type ComicOralRewriteInput = {
  beatId: string;
  role?: string;
  text: string;
  hiddenInformation?: string;
  stakes?: string;
  characterIntent?: string;
};

export type ComicOralRewrite = {
  beatId: string;
  originalText: string;
  rewrittenText: string;
  spokenText: string;
  rewriteMode: "question_first" | "suspense_bridge" | "impact_story" | "payoff" | "clear_context";
  appliedPronunciations: string[];
  warnings: string[];
};

export type ComicOralPerformanceRewritePlan = {
  directorId: "comic_oral_performance_rewriter_v1";
  rewrites: ComicOralRewrite[];
  rewriteCoverage: number;
  questionCount: number;
  suspenseBridgeCount: number;
  warnings: string[];
  passed: boolean;
};

function round(value: number) {
  return Math.round(value * 1000) / 1000;
}

function hasQuestion(text: string) {
  return /\?/.test(text) || /\b(?:por que|como|quem|o que|sera que|qual)\b/i.test(text);
}

function rewriteAsOralStory(input: ComicOralRewriteInput): { text: string; mode: ComicOralRewrite["rewriteMode"] } {
  const clean = input.text.trim();
  if (input.role === "cold_open" && !hasQuestion(clean)) {
    return { text: `${clean.replace(/[.!]+$/, "")}. Mas a pergunta era: como isso chegou tão longe?`, mode: "question_first" };
  }
  if (input.hiddenInformation && input.stakes && !hasQuestion(clean)) {
    return { text: `${clean.replace(/[.!]+$/, "")}. E o problema era maior: ${input.stakes.replace(/[.!]+$/, "")}.`, mode: "suspense_bridge" };
  }
  if (/\b(?:bateu|golpe|atacou|explodiu|colidiu|enfrentou|avançou|derrubou)\b/i.test(clean)) {
    return { text: clean.endsWith("!") ? clean : clean.replace(/[.!]+$/, "!"), mode: "impact_story" };
  }
  if (input.role === "resolution" || input.role === "payoff") {
    return { text: clean.replace(/[.!]+$/, "."), mode: "payoff" };
  }
  return { text: clean, mode: "clear_context" };
}

export function buildComicOralPerformanceRewritePlan(input: { beats: ComicOralRewriteInput[] }): ComicOralPerformanceRewritePlan {
  const rewrites = input.beats.map((beat) => {
    const rewritten = rewriteAsOralStory(beat);
    const pronunciation = applyComicTtsPronunciation(rewritten.text);
    const warnings = [
      ...(!pronunciation.displayTextSafe ? ["phonetic_text_leaked_to_display"] : []),
      ...(rewritten.text.length > 210 ? ["oral_sentence_too_long"] : []),
      ...(rewritten.mode === "clear_context" && /\b(?:acontece|vemos|mostra|aparece)\b/i.test(rewritten.text) ? ["too_descriptive_not_story_driven"] : []),
    ];
    return {
      beatId: beat.beatId,
      originalText: beat.text,
      rewrittenText: rewritten.text,
      spokenText: pronunciation.spokenText,
      rewriteMode: rewritten.mode,
      appliedPronunciations: pronunciation.appliedLabels,
      warnings,
    };
  });
  const warningList = rewrites.flatMap((rewrite) => rewrite.warnings.map((warning) => `${rewrite.beatId}:${warning}`));
  const rewriteCoverage = round(rewrites.filter((rewrite) => rewrite.rewrittenText !== rewrite.originalText || rewrite.appliedPronunciations.length > 0).length / Math.max(1, rewrites.length));
  const questionCount = rewrites.filter((rewrite) => hasQuestion(rewrite.rewrittenText)).length;
  const suspenseBridgeCount = rewrites.filter((rewrite) => rewrite.rewriteMode === "suspense_bridge" || rewrite.rewriteMode === "question_first").length;
  const warnings = [
    ...warningList,
    ...(questionCount === 0 ? ["oral_rewrite_has_no_questions"] : []),
    ...(suspenseBridgeCount === 0 ? ["oral_rewrite_has_no_suspense_bridges"] : []),
  ];
  return {
    directorId: "comic_oral_performance_rewriter_v1",
    rewrites,
    rewriteCoverage,
    questionCount,
    suspenseBridgeCount,
    warnings,
    passed: warnings.length === 0,
  };
}
