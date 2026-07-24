import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const baseRuntimePath = process.env.COMIC_OLLAMA_BASE_RUNTIME_CONFIG
  ? resolve(process.env.COMIC_OLLAMA_BASE_RUNTIME_CONFIG)
  : resolve("scripts/comic-saga-configs/batman-white-knight-series-runtime.mjs");
const overridesPath = process.env.COMIC_OLLAMA_NARRATION_OVERRIDES
  ? resolve(process.env.COMIC_OLLAMA_NARRATION_OVERRIDES)
  : null;

if (!overridesPath) {
  throw new Error("COMIC_OLLAMA_NARRATION_OVERRIDES is required for the Ollama runtime wrapper.");
}

const baseModule = await import(pathToFileURL(baseRuntimePath).href);
const base = baseModule.default;
const overrides = JSON.parse(await readFile(overridesPath, "utf8"));
const overrideByEventId = new Map((overrides.beats ?? []).map((beat) => [beat.eventId, beat]));
const eventIds = base.narrativeEpisode?.eventIds ?? [];

const beats = base.beats.map((beat, index) => {
  const eventId = eventIds[index] ?? beat.beatId ?? String(index + 1);
  const override = overrideByEventId.get(eventId) ?? overrides.beats?.[index];
  if (!override?.narrationText) return beat;
  return {
    ...beat,
    literalSpokenText: beat.literalSpokenText ?? beat.spokenText,
    spokenText: override.narrationText,
    headline: override.headline ?? beat.headline,
    ollamaEventId: eventId,
    ollamaModel: overrides.model ?? null,
  };
});

const cinematicNarration = base.cinematicNarration.map((item, index) => {
  const eventId = eventIds[index] ?? String(index + 1);
  const override = overrideByEventId.get(eventId) ?? overrides.beats?.[index];
  if (!override?.narrationText) return item;
  return {
    ...item,
    cinematicLine: override.narrationText,
    characterIntent: override.characterIntent ?? item.characterIntent,
    hiddenInformation: override.hiddenInformation ?? item.hiddenInformation,
    stakes: override.stakes ?? item.stakes,
  };
});

export default {
  ...base,
  outputSlug: `${base.outputSlug ?? "comic"}-ollama-qwen`,
  beats,
  cinematicNarration,
  temporalHook: {
    ...base.temporalHook,
    hookNarration: overrides.episodeHook ?? base.temporalHook?.hookNarration,
    setupNarration: overrides.episodeContext ?? base.temporalHook?.setupNarration,
    hookHeadline: overrides.episodeHookHeadline ?? base.temporalHook?.hookHeadline,
  },
  ollamaNarration: {
    enabled: true,
    overridesPath,
    model: overrides.model ?? "unknown",
    generatedAt: overrides.generatedAt ?? null,
    notes: overrides.notes ?? [],
  },
};
