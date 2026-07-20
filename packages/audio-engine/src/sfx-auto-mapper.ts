import type {
  AudioLicenseStatus,
  SfxAssetProfile,
  SfxCategory,
  SfxIntensity,
  SfxLibraryItem,
  SfxUseCase
} from "./music-library.js";

export type SfxCueSuggestion =
  | "caption_hit"
  | "impact_hit"
  | "soft_hit"
  | "bass_hit"
  | "page_tear"
  | "page_snap"
  | "whoosh"
  | "riser"
  | "bass_drop"
  | "flash_hit"
  | "glitch"
  | "boom"
  | "silence_snap"
  | string;

export interface SfxAutoMapCueInput {
  cueId?: string | null;
  sceneId?: string | null;
  sceneOrder?: number | null;
  cueIndex?: number | null;
  text?: string | null;
  keyword?: string | null;
  sfxSuggestion: SfxCueSuggestion;
  emphasis?: string | null;
  colorMood?: string | null;
  startSeconds?: number | null;
  absoluteStartSeconds?: number | null;
  volume?: number | null;
}

export interface SfxAutoMapOptions {
  allowUnknownLicense?: boolean;
  preferredUseCase?: SfxUseCase | null;
  maxDurationSeconds?: number | null;
}

export interface SfxAutoMapTarget {
  category: SfxCategory;
  intensity: SfxIntensity;
  useCase: SfxUseCase;
  preferredKeywords: string[];
  maxDurationSeconds: number;
  reason: string;
}

export interface SfxAutoMapResult {
  cue: SfxAutoMapCueInput;
  target: SfxAutoMapTarget;
  selectedAsset: SfxLibraryItem | null;
  score: number;
  confidence: number;
  warnings: string[];
  reason: string;
}

const safeLicenseStatuses = new Set<AudioLicenseStatus>([
  "owned",
  "royalty_free",
  "licensed"
]);

function normalize(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase().replaceAll("-", "_");
}

function textHaystack(item: SfxLibraryItem) {
  return [
    item.asset.filename,
    item.asset.tags?.join(" ") ?? "",
    item.asset.recommendedUse ?? "",
    item.profile.title,
    item.profile.notes ?? "",
    item.profile.category,
    item.profile.useCase,
    item.profile.intensity
  ]
    .join(" ")
    .toLowerCase();
}

export function resolveSfxSuggestionTarget(
  suggestion: SfxCueSuggestion,
  cue?: Pick<SfxAutoMapCueInput, "emphasis" | "text" | "keyword">,
  options: SfxAutoMapOptions = {}
): SfxAutoMapTarget {
  const normalized = normalize(suggestion);
  const emphasis = normalize(cue?.emphasis);
  const preferredUseCase = options.preferredUseCase ?? null;

  if (/page_tear|tear|paper|rasgo|pagina/u.test(normalized)) {
    return {
      category: "transition",
      intensity: "high",
      useCase: preferredUseCase ?? "transition",
      preferredKeywords: ["page", "tear", "paper", "rasgo", "swipe", "transition"],
      maxDurationSeconds: options.maxDurationSeconds ?? 0.9,
      reason: "Page tear transition needs a short transition SFX."
    };
  }

  if (/whoosh|swoosh|sweep|zoom/u.test(normalized)) {
    return {
      category: "whoosh",
      intensity: emphasis === "shake" ? "high" : "medium",
      useCase: preferredUseCase ?? "transition",
      preferredKeywords: ["whoosh", "swoosh", "swipe", "zoom", "transition"],
      maxDurationSeconds: options.maxDurationSeconds ?? 0.65,
      reason: "Fast camera move/transition needs whoosh timing."
    };
  }

  if (/riser|rise|tension/u.test(normalized)) {
    return {
      category: "riser",
      intensity: "medium",
      useCase: preferredUseCase ?? "reveal",
      preferredKeywords: ["riser", "rise", "tension", "build", "suspense"],
      maxDurationSeconds: options.maxDurationSeconds ?? 1.4,
      reason: "Tension beat maps to a riser."
    };
  }

  if (/bass_drop|drop/u.test(normalized)) {
    return {
      category: "boom",
      intensity: "extreme",
      useCase: preferredUseCase ?? "impact_moment",
      preferredKeywords: ["bass", "drop", "boom", "sub", "impact"],
      maxDurationSeconds: options.maxDurationSeconds ?? 1,
      reason: "Payoff/drop beat needs a heavy low impact."
    };
  }

  if (/boom|impact_boom/u.test(normalized)) {
    return {
      category: "boom",
      intensity: "high",
      useCase: preferredUseCase ?? "impact_moment",
      preferredKeywords: ["boom", "impact", "hit", "slam", "punch"],
      maxDurationSeconds: options.maxDurationSeconds ?? 0.9,
      reason: "Large impact maps to boom/impact SFX."
    };
  }

  if (/flash|snap|glitch/u.test(normalized)) {
    return {
      category: normalized.includes("glitch") ? "transition" : "flash",
      intensity: "medium",
      useCase: preferredUseCase ?? "reveal",
      preferredKeywords: ["flash", "snap", "glitch", "click", "transition"],
      maxDurationSeconds: options.maxDurationSeconds ?? 0.55,
      reason: "Flash/snap visual cue needs a tight accent."
    };
  }

  return {
    category: /soft/u.test(normalized) ? "hit" : "impact",
    intensity: emphasis === "impact" || emphasis === "shake" ? "high" : "medium",
    useCase: preferredUseCase ?? "impact_moment",
    preferredKeywords: ["hit", "impact", "punch", "slam", "pop", "accent"],
    maxDurationSeconds: options.maxDurationSeconds ?? 0.55,
    reason: "Caption or action accent maps to a short hit/impact."
  };
}

function intensityScore(actual: SfxIntensity, expected: SfxIntensity) {
  const order: SfxIntensity[] = ["low", "medium", "high", "extreme"];
  const distance = Math.abs(order.indexOf(actual) - order.indexOf(expected));
  return Math.max(0, 18 - distance * 7);
}

function scoreSfxCandidate(
  item: SfxLibraryItem,
  target: SfxAutoMapTarget,
  options: SfxAutoMapOptions
) {
  const warnings: string[] = [];
  let score = 0;
  const haystack = textHaystack(item);
  const duration = item.profile.durationSeconds ?? item.asset.duration ?? null;

  if (item.profile.category === target.category) score += 42;
  if (item.profile.useCase === target.useCase) score += 16;
  if (item.profile.useCase === "generic") score += 5;
  score += intensityScore(item.profile.intensity, target.intensity);

  const keywordHits = target.preferredKeywords.filter((keyword) => haystack.includes(keyword));
  score += Math.min(keywordHits.length * 8, 24);

  if (duration !== null) {
    if (duration <= target.maxDurationSeconds) score += 14;
    else if (duration <= target.maxDurationSeconds + 0.45) score += 4;
    else warnings.push(`SFX duration ${duration}s is longer than preferred ${target.maxDurationSeconds}s.`);
  } else {
    warnings.push("SFX duration is unknown; preview manually before final render.");
  }

  if (safeLicenseStatuses.has(item.profile.licenseStatus)) score += 18;
  else if (item.profile.licenseStatus === "unknown") {
    if (options.allowUnknownLicense) score += 2;
    else score -= 36;
    warnings.push("License status is unknown; manual approval required.");
  } else {
    score -= 60;
    warnings.push(`License status '${item.profile.licenseStatus}' requires manual review.`);
  }

  return { score, warnings, keywordHits };
}

export function selectSfxForCue(
  cue: SfxAutoMapCueInput,
  sfxAssets: SfxLibraryItem[],
  options: SfxAutoMapOptions = {}
): SfxAutoMapResult {
  const target = resolveSfxSuggestionTarget(cue.sfxSuggestion, cue, options);
  const eligible = sfxAssets.filter((item) =>
    options.allowUnknownLicense || item.profile.licenseStatus !== "unknown"
  );
  const ranked = eligible
    .map((item) => {
      const scored = scoreSfxCandidate(item, target, options);
      return { item, ...scored };
    })
    .sort((left, right) => right.score - left.score);
  const best = ranked[0] ?? null;

  if (!best || best.score < 28) {
    return {
      cue,
      target,
      selectedAsset: null,
      score: best?.score ?? 0,
      confidence: 0,
      warnings: [
        `No strong local SFX match found for '${cue.sfxSuggestion}'.`,
        ...(best?.warnings ?? [])
      ],
      reason: target.reason
    };
  }

  return {
    cue,
    target,
    selectedAsset: best.item,
    score: Math.round(best.score),
    confidence: Math.max(0, Math.min(100, Math.round(best.score))),
    warnings: best.warnings,
    reason: `${target.reason} Matched ${best.item.profile.category}/${best.item.profile.intensity}.`
  };
}

export function autoMapSfxCues(
  cues: SfxAutoMapCueInput[],
  sfxAssets: SfxLibraryItem[],
  options: SfxAutoMapOptions = {}
): SfxAutoMapResult[] {
  return cues.map((cue) => selectSfxForCue(cue, sfxAssets, options));
}
