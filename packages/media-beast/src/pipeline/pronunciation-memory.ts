import type { PronunciationMemory } from "./voicebox-qwen-types.js";

export const CRITICAL_COMIC_NAMES = ["Batman", "Gotham", "Darkseid", "Apokolips", "Luthor", "Superman"] as const;

export class PronunciationMemoryStore {
  readonly #entries = new Map<string, PronunciationMemory>();

  key(word: string, engine: string, profileId: string) {
    return `${engine}:${profileId}:${word.toLocaleLowerCase("pt-BR")}`;
  }

  remember(entry: PronunciationMemory) {
    if (entry.confidence < 0 || entry.confidence > 1) throw new Error("Pronunciation confidence must be between 0 and 1.");
    this.#entries.set(this.key(entry.word, entry.engine, entry.profileId), structuredClone(entry));
    return entry;
  }

  get(word: string, engine: string, profileId: string) {
    return this.#entries.get(this.key(word, engine, profileId)) ?? null;
  }

  requireCriticalApprovals(input: { text: string; engine: string; profileId: string }) {
    const required = CRITICAL_COMIC_NAMES.filter((name) => new RegExp(`\\b${name}\\b`, "iu").test(input.text));
    const missing = required.filter((name) => (this.get(name, input.engine, input.profileId)?.confidence ?? 0) < 0.9);
    return { required, missing, passed: missing.length === 0 };
  }
}

export function buildPronunciationCandidates(word: string) {
  const clean = word.trim();
  return [...new Set([clean, clean.replace(/([a-z])([A-Z])/g, "$1 $2"), clean.replace(/th/gi, "t"), clean.replace(/man$/i, "man")])];
}

