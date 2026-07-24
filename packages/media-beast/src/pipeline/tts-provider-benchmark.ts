export type TtsBenchmarkProviderId = "chatterbox-current" | "qwen-custom-voice" | "qwen-cloned-voice";
export type TtsBenchmarkSection = "hook" | "context" | "suspense" | "action" | "cliffhanger";

export type TtsBenchmarkMetrics = {
  textualFidelity: number;
  criticalNamesApproved: boolean;
  naturalness: number;
  actingMatch: number;
  continuity: number;
  timbreAbruptChanges: number;
  repeatedPauseRuns: number;
  deterministicSeed: boolean;
  generationTimeSec: number;
  peakVramMb: number;
  failed: boolean;
  error?: string;
};

export type TtsBenchmarkEntry = {
  providerId: TtsBenchmarkProviderId;
  section: TtsBenchmarkSection;
  audioPath: string;
  metrics: TtsBenchmarkMetrics;
};

export const TTS_BENCHMARK_SECTIONS: Array<{ id: TtsBenchmarkSection; intent: string }> = [
  { id: "hook", intent: "abrir uma pergunta imediata" },
  { id: "context", intent: "explicar sem soar expositivo" },
  { id: "suspense", intent: "segurar informacao e criar expectativa" },
  { id: "action", intent: "aumentar energia sem perder diccao" },
  { id: "cliffhanger", intent: "fechar suspenso com desejo de continuidade" },
];

export function evaluateTtsProviderBenchmark(entries: TtsBenchmarkEntry[]) {
  const providers = [...new Set(entries.map((entry) => entry.providerId))];
  const results = providers.map((providerId) => {
    const samples = entries.filter((entry) => entry.providerId === providerId);
    const successful = samples.filter((entry) => !entry.metrics.failed);
    const average = (key: "textualFidelity" | "naturalness" | "actingMatch" | "continuity") =>
      successful.length ? successful.reduce((sum, entry) => sum + entry.metrics[key], 0) / successful.length : 0;
    const textualFidelity = average("textualFidelity");
    const naturalness = average("naturalness");
    const actingMatch = average("actingMatch");
    const continuity = average("continuity");
    const passed = successful.length === TTS_BENCHMARK_SECTIONS.length
      && textualFidelity >= 0.94
      && naturalness >= 0.85
      && actingMatch >= 0.85
      && continuity >= 0.85
      && successful.every((entry) => entry.metrics.criticalNamesApproved && entry.metrics.deterministicSeed)
      && successful.every((entry) => entry.metrics.timbreAbruptChanges === 0 && entry.metrics.repeatedPauseRuns === 0);
    return {
      providerId,
      sampleCount: samples.length,
      successfulCount: successful.length,
      textualFidelity: Number(textualFidelity.toFixed(4)),
      naturalness: Number(naturalness.toFixed(4)),
      actingMatch: Number(actingMatch.toFixed(4)),
      continuity: Number(continuity.toFixed(4)),
      passed,
    };
  });
  const incumbent = results.find((result) => result.providerId === "chatterbox-current");
  const winner = results
    .filter((result) => result.passed)
    .sort((left, right) => (right.naturalness + right.actingMatch + right.continuity) - (left.naturalness + left.actingMatch + left.continuity))[0] ?? null;
  return {
    results,
    winner,
    canReplaceDefault: Boolean(winner && winner.providerId !== "chatterbox-current" && incumbent
      && winner.naturalness > incumbent.naturalness
      && winner.actingMatch > incumbent.actingMatch
      && winner.continuity >= incumbent.continuity),
  };
}

