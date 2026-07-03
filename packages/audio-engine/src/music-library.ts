export const musicSourceTypes = [
  "local_upload",
  "user_owned",
  "royalty_free",
  "licensed_pack",
  "unknown"
] as const;

export type MusicSourceType = (typeof musicSourceTypes)[number];

export const audioLicenseStatuses = [
  "owned",
  "royalty_free",
  "licensed",
  "platform_only",
  "unknown"
] as const;

export type AudioLicenseStatus = (typeof audioLicenseStatuses)[number];

export const musicMoods = [
  "hype",
  "dark",
  "epic",
  "suspense",
  "emotional",
  "aggressive",
  "cinematic",
  "calm",
  "documentary",
  "viral"
] as const;

export type MusicMood = (typeof musicMoods)[number];

export const musicGenres = [
  "phonk",
  "trap",
  "drill",
  "cinematic",
  "orchestral",
  "electronic",
  "ambient",
  "rock",
  "generic"
] as const;

export type MusicGenre = (typeof musicGenres)[number];

export const musicEnergies = [
  "low",
  "medium",
  "high",
  "extreme"
] as const;

export type MusicEnergy = (typeof musicEnergies)[number];

export const musicUseCases = [
  "football",
  "shorts",
  "true_crime",
  "documentary",
  "cinematic",
  "motivational",
  "generic"
] as const;

export type MusicUseCase = (typeof musicUseCases)[number];

export const sfxCategories = [
  "whoosh",
  "hit",
  "riser",
  "boom",
  "crowd",
  "whistle",
  "impact",
  "flash",
  "transition",
  "ambience"
] as const;

export type SfxCategory = (typeof sfxCategories)[number];

export const sfxIntensities = [
  "low",
  "medium",
  "high",
  "extreme"
] as const;

export type SfxIntensity = (typeof sfxIntensities)[number];

export const sfxUseCases = [
  "football",
  "transition",
  "impact_moment",
  "reveal",
  "microclip",
  "generic"
] as const;

export type SfxUseCase = (typeof sfxUseCases)[number];

export interface BeatMarker {
  timeSeconds: number;
  strength: number;
  confidence: number;
}

export interface EnergyTimelinePoint {
  timeSeconds: number;
  energy: number;
}

export interface MusicAssetProfile {
  assetId: string;
  title: string;
  artist: string | null;
  sourceType: MusicSourceType;
  licenseStatus: AudioLicenseStatus;
  mood: MusicMood;
  genre: MusicGenre;
  bpm: number | null;
  bpmConfidence: number;
  energy: MusicEnergy;
  useCase: MusicUseCase;
  durationSeconds: number | null;
  loudness: number | null;
  beatMarkers: BeatMarker[];
  energyTimeline: EnergyTimelinePoint[];
  notes: string | null;
  safetyWarning: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface SfxAssetProfile {
  assetId: string;
  title: string;
  category: SfxCategory;
  intensity: SfxIntensity;
  durationSeconds: number | null;
  useCase: SfxUseCase;
  licenseStatus: AudioLicenseStatus;
  notes: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface MusicLibraryAsset {
  id: string;
  filename: string;
  type: string;
  tags?: string[] | null;
  recommendedUse?: string | null;
  duration?: number | null;
}

export interface MusicLibraryItem {
  asset: MusicLibraryAsset;
  profile: MusicAssetProfile;
}

export interface SfxLibraryItem {
  asset: MusicLibraryAsset;
  profile: SfxAssetProfile;
}

export interface BpmRange {
  min: number;
  max: number;
}

export const musicPresetIds = [
  "football_hype",
  "viral_fast_cut",
  "cinematic_epic",
  "true_crime_dark",
  "documentary_clean",
  "shorts_clean_voice"
] as const;

export type MusicPresetId = (typeof musicPresetIds)[number];

export interface MusicPreset {
  id: MusicPresetId;
  name: string;
  description: string;
  preferredMood: MusicMood[];
  preferredGenre: MusicGenre[];
  bpmRange: BpmRange | null;
  energyRange: MusicEnergy[];
  recommendedSfxCategories: SfxCategory[];
  defaultMusicVolume: number;
  defaultNarrationDucking: number;
  recommendedAudioMasteringPresetId: string;
  microclipBeatSyncStrategy: string;
  safetyNotes: string;
}

export interface SfxPreset {
  id: MusicPresetId;
  name: string;
  recommendedCategories: SfxCategory[];
  recommendedIntensity: SfxIntensity[];
  useCases: SfxUseCase[];
}

export interface SelectMusicForReelInput {
  templateId?: string | null;
  musicPresetId?: MusicPresetId | string | null;
  audioMasteringPresetId?: string | null;
  tone?: string | null;
  durationSeconds: number;
  useCase?: MusicUseCase | string | null;
  allowUnknownLicense?: boolean;
  musicAssets: MusicLibraryItem[];
  sfxAssets?: SfxLibraryItem[];
}

export interface SelectMusicForReelResult {
  selectedMusicAsset: MusicLibraryItem | null;
  selectedSfxAssets: SfxLibraryItem[];
  reason: string;
  warnings: string[];
  confidence: number;
}

export interface BeatSyncNarrationWindow {
  startSeconds: number;
  endSeconds: number;
}

export interface BeatSyncMicroclipInput {
  microclipId?: string | null;
  sceneId?: string | null;
  label?: string | null;
  usageMode?: string | null;
  durationSeconds?: number | null;
  insertStartSeconds?: number | null;
  narrationOverlay?: boolean | null;
}

export interface BeatSyncSfxCue {
  category: SfxCategory;
  timeSeconds: number;
  reason: string;
  intensity: SfxIntensity;
}

export interface BeatSyncMicroclipPlacement {
  microclipId: string | null;
  sceneId: string | null;
  label: string | null;
  suggestedStartSeconds: number;
  nearestBeatSeconds: number;
  reason: string;
}

export interface BeatSyncPlan {
  beatMarkersUsed: BeatMarker[];
  suggestedCutTimes: number[];
  suggestedFlashTimes: number[];
  suggestedSfxCues: BeatSyncSfxCue[];
  suggestedMicroclipPlacement: BeatSyncMicroclipPlacement[];
  introBeatTime: number | null;
  climaxBeatTime: number | null;
  outroBeatTime: number | null;
  warnings: string[];
  confidence: number;
}

export interface BuildBeatSyncPlanInput {
  musicAssetProfile: MusicAssetProfile | null;
  reelDurationSeconds: number;
  microclips?: BeatSyncMicroclipInput[];
  sceneCount: number;
  presetId?: MusicPresetId | string | null;
  narrationWindows?: BeatSyncNarrationWindow[];
}

function roundToThreeDecimals(value: number) {
  return Math.round(value * 1000) / 1000;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function normalizeInterval(seconds: number) {
  return roundToThreeDecimals(Math.max(seconds, 0.1));
}

function normalizeConfidence(value: number) {
  return roundToThreeDecimals(clamp(value, 0, 1));
}

function energyWeight(energy: MusicEnergy) {
  switch (energy) {
    case "low":
      return 0;
    case "medium":
      return 1;
    case "high":
      return 2;
    case "extreme":
      return 3;
  }
}

function licenseWeight(status: AudioLicenseStatus) {
  switch (status) {
    case "owned":
      return 1;
    case "royalty_free":
      return 0.92;
    case "licensed":
      return 0.86;
    case "platform_only":
      return 0.45;
    case "unknown":
      return 0.25;
  }
}

function normalizeMusicPresetId(value: string | null | undefined): MusicPresetId | null {
  if (!value) {
    return null;
  }

  const normalized = value.trim().replaceAll("-", "_").toLowerCase();
  return musicPresetIds.includes(normalized as MusicPresetId)
    ? (normalized as MusicPresetId)
    : null;
}

const musicPresets: MusicPreset[] = [
  {
    id: "football_hype",
    name: "Football Hype",
    description: "Alta energia para reels de futebol, cortes rapidos e impacto editorial.",
    preferredMood: ["hype", "aggressive", "epic"],
    preferredGenre: ["phonk", "trap", "drill", "electronic", "cinematic"],
    bpmRange: { min: 130, max: 175 },
    energyRange: ["high", "extreme"],
    recommendedSfxCategories: ["impact", "crowd", "whistle", "whoosh", "hit"],
    defaultMusicVolume: 0.22,
    defaultNarrationDucking: 0.32,
    recommendedAudioMasteringPresetId: "football_hype",
    microclipBeatSyncStrategy: "drop_on_impact",
    safetyNotes: "Use apenas trilhas locais/autorizadas. Evite catalogos de plataforma sem licenca clara."
  },
  {
    id: "viral_fast_cut",
    name: "Viral Fast Cut",
    description: "Preset para cortes agressivos baseados em grid ritmico e batidas densas.",
    preferredMood: ["viral", "hype", "aggressive"],
    preferredGenre: ["phonk", "trap", "electronic", "drill"],
    bpmRange: { min: 140, max: 185 },
    energyRange: ["high", "extreme"],
    recommendedSfxCategories: ["flash", "hit", "transition", "whoosh"],
    defaultMusicVolume: 0.2,
    defaultNarrationDucking: 0.28,
    recommendedAudioMasteringPresetId: "viral_fast_cut",
    microclipBeatSyncStrategy: "rapid_grid",
    safetyNotes: "Bom para reels muito rapidos; pode cansar em roteiros longos."
  },
  {
    id: "cinematic_epic",
    name: "Cinematic Epic",
    description: "Base cinematografica para build-up, hero moments e climax visual.",
    preferredMood: ["epic", "cinematic", "emotional"],
    preferredGenre: ["cinematic", "orchestral", "electronic"],
    bpmRange: { min: 80, max: 140 },
    energyRange: ["medium", "high"],
    recommendedSfxCategories: ["riser", "boom", "impact", "transition"],
    defaultMusicVolume: 0.18,
    defaultNarrationDucking: 0.38,
    recommendedAudioMasteringPresetId: "cinematic_epic",
    microclipBeatSyncStrategy: "climax_build",
    safetyNotes: "Prefira trilhas com abertura e payoff claro para nao esmagar a narracao."
  },
  {
    id: "true_crime_dark",
    name: "True Crime Dark",
    description: "Tensao baixa e constante para crime, misterio e tom investigativo.",
    preferredMood: ["dark", "suspense", "documentary"],
    preferredGenre: ["ambient", "cinematic", "orchestral", "generic"],
    bpmRange: { min: 65, max: 110 },
    energyRange: ["low", "medium"],
    recommendedSfxCategories: ["riser", "impact", "ambience", "whoosh"],
    defaultMusicVolume: 0.12,
    defaultNarrationDucking: 0.42,
    recommendedAudioMasteringPresetId: "true_crime_dark",
    microclipBeatSyncStrategy: "sparse_tension_hits",
    safetyNotes: "Segure o BPM para manter legibilidade e suspense."
  },
  {
    id: "documentary_clean",
    name: "Documentary Clean",
    description: "Documental limpo, discreto e focado em voz clara.",
    preferredMood: ["documentary", "calm", "cinematic"],
    preferredGenre: ["ambient", "cinematic", "generic", "orchestral"],
    bpmRange: { min: 70, max: 120 },
    energyRange: ["low", "medium"],
    recommendedSfxCategories: ["transition", "ambience", "whoosh"],
    defaultMusicVolume: 0.1,
    defaultNarrationDucking: 0.46,
    recommendedAudioMasteringPresetId: "documentary_clean",
    microclipBeatSyncStrategy: "soft_grid",
    safetyNotes: "Evite musica chamativa demais; a voz deve liderar."
  },
  {
    id: "shorts_clean_voice",
    name: "Shorts Clean Voice",
    description: "Preset seguro para reels guiados por narracao, com cama discreta.",
    preferredMood: ["calm", "cinematic", "documentary", "emotional"],
    preferredGenre: ["ambient", "generic", "cinematic", "electronic"],
    bpmRange: { min: 80, max: 130 },
    energyRange: ["low", "medium"],
    recommendedSfxCategories: ["transition", "whoosh", "flash"],
    defaultMusicVolume: 0.09,
    defaultNarrationDucking: 0.48,
    recommendedAudioMasteringPresetId: "shorts_clean_voice",
    microclipBeatSyncStrategy: "voice_first",
    safetyNotes: "Preset conservador para manter inteligibilidade da voz."
  }
];

const sfxPresets: SfxPreset[] = [
  {
    id: "football_hype",
    name: "Football Hype",
    recommendedCategories: ["impact", "crowd", "whistle", "whoosh"],
    recommendedIntensity: ["medium", "high", "extreme"],
    useCases: ["football", "impact_moment", "transition"]
  },
  {
    id: "viral_fast_cut",
    name: "Viral Fast Cut",
    recommendedCategories: ["flash", "hit", "transition", "whoosh"],
    recommendedIntensity: ["medium", "high", "extreme"],
    useCases: ["transition", "impact_moment", "generic"]
  },
  {
    id: "cinematic_epic",
    name: "Cinematic Epic",
    recommendedCategories: ["riser", "boom", "impact", "transition"],
    recommendedIntensity: ["medium", "high"],
    useCases: ["reveal", "impact_moment", "generic"]
  },
  {
    id: "true_crime_dark",
    name: "True Crime Dark",
    recommendedCategories: ["ambience", "riser", "impact", "whoosh"],
    recommendedIntensity: ["low", "medium", "high"],
    useCases: ["reveal", "transition", "generic"]
  }
];

export function getMusicPresets() {
  return [...musicPresets];
}

export function getMusicPresetById(id: string | null | undefined) {
  const normalized = normalizeMusicPresetId(id);
  if (!normalized) {
    return null;
  }

  return musicPresets.find((preset) => preset.id === normalized) ?? null;
}

export function getSfxPresets() {
  return [...sfxPresets];
}

export function getSfxPresetById(id: string | null | undefined) {
  const normalized = normalizeMusicPresetId(id);
  if (!normalized) {
    return null;
  }

  return sfxPresets.find((preset) => preset.id === normalized) ?? null;
}

export function suggestMusicPresetByContext(input: {
  templateId?: string | null;
  tone?: string | null;
  useCase?: string | null;
  niche?: string | null;
}) {
  const haystack = [
    input.templateId ?? "",
    input.tone ?? "",
    input.useCase ?? "",
    input.niche ?? ""
  ]
    .join(" ")
    .toLowerCase();

  if (/(football|soccer|match|hype|sports)/u.test(haystack)) {
    return getMusicPresetById("football_hype")!;
  }

  if (/(viral|fast|rapid|shorts cut)/u.test(haystack)) {
    return getMusicPresetById("viral_fast_cut")!;
  }

  if (/(crime|mystery|horror|dark|suspense)/u.test(haystack)) {
    return getMusicPresetById("true_crime_dark")!;
  }

  if (/(documentary|history|explain|clean)/u.test(haystack)) {
    return getMusicPresetById("documentary_clean")!;
  }

  if (/(cinematic|epic|hero|story)/u.test(haystack)) {
    return getMusicPresetById("cinematic_epic")!;
  }

  return getMusicPresetById("shorts_clean_voice")!;
}

function bpmMatchScore(profile: MusicAssetProfile, preset: MusicPreset, durationSeconds: number) {
  if (!preset.bpmRange || typeof profile.bpm !== "number") {
    return 0.08;
  }

  const bpm = profile.bpm;
  const { min, max } = preset.bpmRange;

  if (bpm >= min && bpm <= max) {
    return 0.2;
  }

  const distance = bpm < min ? min - bpm : bpm - max;
  const decay = clamp(1 - distance / 60, 0, 1);
  return roundToThreeDecimals(decay * 0.12);
}

function durationScore(profile: MusicAssetProfile, durationSeconds: number) {
  const duration = profile.durationSeconds;

  if (typeof duration !== "number" || duration <= 0 || durationSeconds <= 0) {
    return 0.04;
  }

  if (duration >= durationSeconds) {
    return 0.08;
  }

  const ratio = clamp(duration / durationSeconds, 0, 1);
  return roundToThreeDecimals(ratio * 0.08);
}

function scoreMusicCandidate(
  item: MusicLibraryItem,
  preset: MusicPreset,
  input: SelectMusicForReelInput
) {
  let score = 0;
  const reasons: string[] = [];

  const licenseScore = licenseWeight(item.profile.licenseStatus);
  score += licenseScore * 0.24;
  reasons.push(`license=${item.profile.licenseStatus}`);

  if (preset.preferredMood.includes(item.profile.mood)) {
    score += 0.18;
    reasons.push(`mood=${item.profile.mood}`);
  }

  if (preset.preferredGenre.includes(item.profile.genre)) {
    score += 0.16;
    reasons.push(`genre=${item.profile.genre}`);
  }

  if (preset.energyRange.includes(item.profile.energy)) {
    score += 0.14;
    reasons.push(`energy=${item.profile.energy}`);
  }

  if (
    input.useCase &&
    item.profile.useCase ===
      input.useCase.toLowerCase().replaceAll("-", "_")
  ) {
    score += 0.12;
    reasons.push(`useCase=${item.profile.useCase}`);
  }

  const bpmScore = bpmMatchScore(item.profile, preset, input.durationSeconds);
  score += bpmScore;
  if (bpmScore > 0.12) {
    reasons.push(`bpm=${item.profile.bpm ?? "n/a"}`);
  }

  score += durationScore(item.profile, input.durationSeconds);

  if (item.profile.bpmConfidence >= 0.7) {
    score += 0.04;
  } else if (item.profile.bpmConfidence <= 0.25) {
    score -= 0.03;
  }

  if (
    input.allowUnknownLicense === false &&
    (item.profile.licenseStatus === "unknown" ||
      item.profile.licenseStatus === "platform_only")
  ) {
    score -= 0.28;
    reasons.push("license-warning");
  }

  return {
    item,
    score: roundToThreeDecimals(score),
    reasons
  };
}

function scoreSfxCandidate(
  item: SfxLibraryItem,
  preset: MusicPreset,
  input: SelectMusicForReelInput
) {
  let score = 0;

  if (preset.recommendedSfxCategories.includes(item.profile.category)) {
    score += 0.4;
  }

  if (
    input.useCase &&
    item.profile.useCase ===
      input.useCase.toLowerCase().replaceAll("-", "_")
  ) {
    score += 0.24;
  }

  score += licenseWeight(item.profile.licenseStatus) * 0.2;
  score += energyWeight(item.profile.intensity as MusicEnergy) * 0.05;

  return roundToThreeDecimals(score);
}

export function selectMusicForReel(
  input: SelectMusicForReelInput
): SelectMusicForReelResult {
  const preset =
    getMusicPresetById(input.musicPresetId) ??
    suggestMusicPresetByContext({
      templateId: input.templateId ?? null,
      tone: input.tone ?? null,
      useCase: input.useCase ?? null
    });
  const warnings: string[] = [];
  const candidates = input.musicAssets
    .map((item) => scoreMusicCandidate(item, preset, input))
    .sort((left, right) => right.score - left.score);
  const selectedMusicAsset = candidates[0]?.item ?? null;

  if (!selectedMusicAsset) {
    return {
      selectedMusicAsset: null,
      selectedSfxAssets: [],
      reason: `Nenhuma musica local encontrada para o preset ${preset.name}.`,
      warnings: ["Biblioteca vazia ou sem perfis de musica."],
      confidence: 0
    };
  }

  if (
    input.allowUnknownLicense === false &&
    (selectedMusicAsset.profile.licenseStatus === "unknown" ||
      selectedMusicAsset.profile.licenseStatus === "platform_only")
  ) {
    warnings.push(
      "A melhor musica encontrada ainda possui status de licenca sensivel para uso automatico."
    );
  }

  if (selectedMusicAsset.profile.bpmConfidence < 0.45) {
    warnings.push(
      "O BPM detectado tem baixa confianca; o beat sync pode cair para grid ritmico."
    );
  }

  if (
    typeof selectedMusicAsset.profile.durationSeconds === "number" &&
    selectedMusicAsset.profile.durationSeconds < input.durationSeconds
  ) {
    warnings.push(
      "A musica selecionada e menor que a duracao do reel e precisara de loop."
    );
  }

  const sfxCandidates = (input.sfxAssets ?? [])
    .map((item) => ({
      item,
      score: scoreSfxCandidate(item, preset, input)
    }))
    .filter((entry) => entry.score > 0.25)
    .sort((left, right) => right.score - left.score);
  const selectedSfxAssets = sfxCandidates.slice(0, 3).map((entry) => entry.item);

  const topScore = candidates[0]?.score ?? 0;
  const secondScore = candidates[1]?.score ?? 0;
  const confidence = normalizeConfidence(
    clamp(topScore - secondScore + 0.45, 0, 1)
  );

  return {
    selectedMusicAsset,
    selectedSfxAssets,
    reason: `Preset ${preset.name} selecionou ${selectedMusicAsset.asset.filename} por mood, energia e compatibilidade ritmica.`,
    warnings: [...new Set(warnings)],
    confidence
  };
}

function buildFallbackBeatMarkers(durationSeconds: number, bpm: number, confidence: number) {
  const intervalSeconds = normalizeInterval(60 / bpm);
  const beatMarkers: BeatMarker[] = [];

  for (let cursor = 0; cursor <= durationSeconds + 0.001; cursor += intervalSeconds) {
    beatMarkers.push({
      timeSeconds: roundToThreeDecimals(cursor),
      strength: beatMarkers.length % 4 === 0 ? 0.95 : 0.65,
      confidence
    });
  }

  return beatMarkers;
}

function nearestBeatTime(timeSeconds: number, beatMarkers: BeatMarker[]) {
  let nearest = beatMarkers[0]?.timeSeconds ?? 0;
  let smallestDistance = Number.POSITIVE_INFINITY;

  for (const marker of beatMarkers) {
    const distance = Math.abs(marker.timeSeconds - timeSeconds);
    if (distance < smallestDistance) {
      smallestDistance = distance;
      nearest = marker.timeSeconds;
    }
  }

  return roundToThreeDecimals(nearest);
}

function overlapsNarration(timeSeconds: number, windows: BeatSyncNarrationWindow[]) {
  return windows.some(
    (window) => timeSeconds >= window.startSeconds && timeSeconds <= window.endSeconds
  );
}

export function buildBeatSyncPlan(input: BuildBeatSyncPlanInput): BeatSyncPlan {
  const preset =
    getMusicPresetById(input.presetId) ??
    suggestMusicPresetByContext({ tone: input.presetId ?? null });
  const durationSeconds = roundToThreeDecimals(Math.max(input.reelDurationSeconds, 0));
  const warnings: string[] = [];
  const profile = input.musicAssetProfile;
  const narrationWindows = input.narrationWindows ?? [];
  let beatMarkersUsed: BeatMarker[] = [];
  let confidence = 0.35;

  if (profile?.beatMarkers?.length && profile.bpmConfidence >= 0.4) {
    beatMarkersUsed = profile.beatMarkers
      .filter((marker) => marker.timeSeconds <= durationSeconds + 0.001)
      .sort((left, right) => left.timeSeconds - right.timeSeconds);
    confidence = normalizeConfidence(
      (profile.bpmConfidence + averageMarkerConfidence(beatMarkersUsed)) / 2
    );
  }

  if (beatMarkersUsed.length === 0) {
    const fallbackBpm = (() => {
      if (typeof profile?.bpm === "number") {
        return profile.bpm;
      }

      if (preset.bpmRange) {
        return Math.round((preset.bpmRange.min + preset.bpmRange.max) / 2);
      }

      return 110;
    })();
    beatMarkersUsed = buildFallbackBeatMarkers(
      durationSeconds,
      fallbackBpm,
      profile?.bpmConfidence ?? 0.24
    );
    confidence = normalizeConfidence(Math.max(profile?.bpmConfidence ?? 0.24, 0.22));
    warnings.push("Beat markers reais indisponiveis; usando grid ritmico aproximado.");
  }

  if (profile && profile.bpmConfidence < 0.45) {
    warnings.push("BPM com baixa confianca. Ajuste manual pode ser necessario.");
  }

  const strongBeats = beatMarkersUsed.filter((marker, index) => marker.strength >= 0.8 || index % 4 === 0);
  const suggestedCutTimes = strongBeats
    .filter((_, index) => index % 2 === 0)
    .map((marker) => marker.timeSeconds)
    .filter((time) => time > 0 && time < durationSeconds);
  const suggestedFlashTimes = strongBeats
    .filter((marker) => !overlapsNarration(marker.timeSeconds, narrationWindows))
    .map((marker) => marker.timeSeconds)
    .filter((_, index) => index % 3 === 0);

  const suggestedSfxCues: BeatSyncSfxCue[] = [];

  for (const marker of strongBeats) {
    if (marker.timeSeconds <= 0 || marker.timeSeconds >= durationSeconds) {
      continue;
    }

    if (overlapsNarration(marker.timeSeconds, narrationWindows)) {
      continue;
    }

    if (suggestedSfxCues.length >= Math.max(input.sceneCount, 3)) {
      break;
    }

    suggestedSfxCues.push({
      category:
        preset.recommendedSfxCategories[
          suggestedSfxCues.length % preset.recommendedSfxCategories.length
        ] ?? "impact",
      timeSeconds: marker.timeSeconds,
      reason: "Strong beat candidate",
      intensity:
        suggestedSfxCues.length === 0 || marker.strength >= 0.9 ? "high" : "medium"
    });
  }

  const suggestedMicroclipPlacement = (input.microclips ?? []).map((microclip, index) => {
    const approximateSlot =
      microclip.insertStartSeconds ??
      ((index + 1) * durationSeconds) / ((input.microclips?.length ?? 0) + 1);
    const nearestBeatSeconds = nearestBeatTime(approximateSlot, beatMarkersUsed);
    return {
      microclipId: microclip.microclipId ?? null,
      sceneId: microclip.sceneId ?? null,
      label: microclip.label ?? null,
      suggestedStartSeconds: nearestBeatSeconds,
      nearestBeatSeconds,
      reason:
        microclip.usageMode === "impact_moment"
          ? "Aligned to a stronger beat for impact."
          : "Aligned to nearest beat to preserve rhythm."
    };
  });

  const introBeatTime = beatMarkersUsed[0]?.timeSeconds ?? null;
  const climaxBeatTime =
    strongBeats[Math.max(Math.floor(strongBeats.length * 0.7), 0)]?.timeSeconds ?? null;
  const outroBeatTime = beatMarkersUsed[beatMarkersUsed.length - 1]?.timeSeconds ?? null;

  return {
    beatMarkersUsed,
    suggestedCutTimes,
    suggestedFlashTimes,
    suggestedSfxCues,
    suggestedMicroclipPlacement,
    introBeatTime,
    climaxBeatTime,
    outroBeatTime,
    warnings: [...new Set(warnings)],
    confidence
  };
}

function averageMarkerConfidence(markers: BeatMarker[]) {
  if (markers.length === 0) {
    return 0;
  }

  return (
    markers.reduce((total, marker) => total + normalizeConfidence(marker.confidence), 0) /
    markers.length
  );
}

export function summarizeMusicProfile(profile: MusicAssetProfile | null | undefined) {
  if (!profile) {
    return "Sem perfil de musica associado.";
  }

  const fragments = [
    profile.title,
    profile.mood,
    profile.genre,
    `energy ${profile.energy}`,
    typeof profile.bpm === "number" ? `${Math.round(profile.bpm)} BPM` : "BPM n/a",
    `license ${profile.licenseStatus}`
  ];

  return fragments.join(", ");
}
