import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import type { ActingIntent, VoiceProfile, VoiceReferenceSample, VoiceReferenceStyle } from "./voicebox-qwen-types.js";

const STYLE_BY_INTENT: Record<ActingIntent, VoiceReferenceStyle[]> = {
  hook: ["cliffhanger", "reveal", "conversational"],
  context: ["conversational", "neutral"],
  mystery: ["mystery", "tension"],
  tension: ["tension", "mystery"],
  action: ["action", "reveal"],
  reveal: ["reveal", "emotional"],
  payoff: ["emotional", "reveal"],
  closing: ["cliffhanger", "emotional"],
};

export class VoiceProfileStore {
  readonly #profiles = new Map<string, VoiceProfile>();

  constructor(profiles: VoiceProfile[] = []) {
    profiles.forEach((profile) => this.upsert(profile));
  }

  upsert(profile: VoiceProfile) {
    if (!profile.consentConfirmed) throw new Error(`Voice profile '${profile.id}' requires explicit owner consent.`);
    this.#profiles.set(profile.id, structuredClone(profile));
    return profile;
  }

  get(profileId: string) {
    return this.#profiles.get(profileId) ?? null;
  }

  require(profileId: string) {
    const profile = this.get(profileId);
    if (!profile) throw new Error(`Voice profile '${profileId}' was not found.`);
    if (!profile.consentConfirmed) throw new Error(`Voice profile '${profileId}' is not consent-approved.`);
    return profile;
  }
}

export class VoiceReferenceSampleStore {
  readonly #samples = new Map<string, VoiceReferenceSample>();

  constructor(samples: VoiceReferenceSample[] = []) {
    samples.forEach((sample) => this.upsert(sample));
  }

  upsert(sample: VoiceReferenceSample) {
    if (sample.clippingDetected) throw new Error(`Reference '${sample.id}' is clipped and cannot be promoted.`);
    this.#samples.set(sample.id, structuredClone(sample));
    return sample;
  }

  get(id: string) {
    return this.#samples.get(id) ?? null;
  }

  listForProfile(profileId: string) {
    return [...this.#samples.values()].filter((sample) => sample.profileId === profileId);
  }

  static async sha256(audioPath: string) {
    return createHash("sha256").update(await readFile(audioPath)).digest("hex");
  }
}

export class VoiceReferenceSelector {
  constructor(
    private readonly profiles: VoiceProfileStore,
    private readonly samples: VoiceReferenceSampleStore,
  ) {}

  select(input: { profileId: string; intent: ActingIntent; maxReferences?: number }) {
    const profile = this.profiles.require(input.profileId);
    const preferred = STYLE_BY_INTENT[input.intent];
    const eligible = this.samples.listForProfile(profile.id)
      .filter((sample) => !sample.clippingDetected && sample.qualityScore >= 0.72 && sample.noiseScore <= 0.35)
      .sort((left, right) => {
        const leftRank = preferred.indexOf(left.style);
        const rightRank = preferred.indexOf(right.style);
        return (leftRank < 0 ? 99 : leftRank) - (rightRank < 0 ? 99 : rightRank)
          || right.qualityScore - left.qualityScore
          || left.id.localeCompare(right.id);
      });
    const limit = Math.max(1, Math.min(3, input.maxReferences ?? 3));
    const selected = eligible.slice(0, limit);
    const neutral = eligible.find((sample) => sample.style === "neutral");
    if (neutral && !selected.some((sample) => sample.id === neutral.id) && selected.length < limit) selected.push(neutral);
    if (!selected.length) throw new Error(`No production-ready samples are available for voice profile '${profile.id}'.`);
    const primaryStyle = selected[0]?.style ?? "neutral";
    return {
      samples: selected,
      providerProfileId: profile.voiceboxProfileIdsByStyle?.[primaryStyle] ?? profile.defaultVoiceboxProfileId,
    };
  }
}

export class VoicePromptCache<T = unknown> {
  readonly #cache = new Map<string, T>();

  key(profileId: string, sampleIds: string[], engine: string) {
    return createHash("sha256").update(JSON.stringify({ profileId, sampleIds: [...sampleIds].sort(), engine })).digest("hex");
  }

  get(key: string) { return this.#cache.get(key); }
  set(key: string, value: T) { this.#cache.set(key, value); return value; }
  clear() { this.#cache.clear(); }
}

