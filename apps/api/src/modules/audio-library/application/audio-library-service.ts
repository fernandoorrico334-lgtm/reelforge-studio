import {
  buildBeatSyncPlan,
  getMusicPresetById,
  selectMusicForReel,
  suggestMusicPresetByContext,
  summarizeMusicProfile,
  type AudioLicenseStatus,
  type BeatSyncPlan,
  type MusicAssetProfile,
  type MusicLibraryItem,
  type MusicMood,
  type MusicPreset,
  type MusicPresetId,
  type MusicSourceType,
  type MusicUseCase,
  type SfxAssetProfile,
  type SfxLibraryItem
} from "@reelforge/audio-engine";
import { analyzeAudioAsset } from "@reelforge/audio-engine/music-analysis";
import { resolveStoragePath } from "@reelforge/video-engine/render-server";
import { projectRoot } from "../../../config/paths.js";
import { NotFoundError, ValidationError } from "../../../shared/errors.js";
import type { AssetRepository } from "../../assets/application/asset-repository.js";
import type { StudioAsset } from "../../assets/domain/asset.js";
import type { EditorialMicroclipRepository } from "../../editorial-microclips/application/editorial-microclip-repository.js";
import type { ProjectRepository } from "../../projects/application/project-repository.js";
import type {
  AudioLibraryRepository,
  MusicProfileFilters,
  SfxProfileFilters,
  UpsertMusicAssetProfileInput,
  UpsertSfxAssetProfileInput
} from "./audio-library-repository.js";

export interface MusicLibraryItemRecord {
  asset: StudioAsset;
  profile: MusicAssetProfile | null;
  status: "profiled" | "pending";
  summary: string;
  warnings: string[];
}

export interface SfxLibraryItemRecord {
  asset: StudioAsset;
  profile: SfxAssetProfile | null;
  status: "profiled" | "pending";
  warnings: string[];
}

export interface SelectMusicRequestInput {
  templateId?: string | null;
  musicPresetId?: MusicPresetId | string | null;
  audioMasteringPresetId?: string | null;
  tone?: string | null;
  durationSeconds: number;
  useCase?: MusicUseCase | string | null;
  allowUnknownLicense?: boolean;
}

export interface SelectMusicResponse {
  preset: MusicPreset;
  selectedMusicAsset: MusicLibraryItemRecord | null;
  selectedSfxAssets: SfxLibraryItemRecord[];
  reason: string;
  warnings: string[];
  confidence: number;
}

export interface BuildBeatSyncPlanRequestInput {
  projectId: string;
  musicAssetId?: string | null;
  musicPresetId?: string | null;
  reelDurationSeconds?: number | null;
}

export interface BuildBeatSyncPlanResponse {
  projectId: string;
  selectedMusicAssetId: string | null;
  selectedMusicAssetPath: string | null;
  musicPresetId: string | null;
  beatSyncPlan: BeatSyncPlan;
  warnings: string[];
}

function toSearchHaystack(asset: StudioAsset, profile?: MusicAssetProfile | SfxAssetProfile | null) {
  return [
    asset.filename,
    asset.originalName,
    asset.tags.join(" "),
    asset.recommendedUse ?? "",
    asset.usageNotes ?? "",
    "title" in (profile ?? {}) ? profile?.title ?? "" : "",
    "notes" in (profile ?? {}) ? profile?.notes ?? "" : ""
  ]
    .join(" ")
    .toLowerCase();
}

function normalizeStringCandidate(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function isLikelyMusicAudioAsset(asset: StudioAsset) {
  if (asset.type === "MUSIC") {
    return true;
  }

  if (asset.type !== "AUDIO") {
    return false;
  }

  if (asset.musicProfile) {
    return true;
  }

  const haystack = toSearchHaystack(asset, null);
  return (
    /(music|track|bed|phonk|drill|trap|ambient|score|soundtrack|instrumental)/u.test(
      haystack
    ) &&
    !/(voice|voiceover|narration|tts|dialog|fala|locucao)/u.test(haystack)
  );
}

function isLikelySfxAudioAsset(asset: StudioAsset) {
  if (asset.type === "SFX") {
    return true;
  }

  if (asset.type !== "AUDIO") {
    return false;
  }

  if (asset.sfxProfile) {
    return true;
  }

  const haystack = toSearchHaystack(asset, null);
  return /(sfx|impact|whoosh|riser|boom|hit|flash|transition|crowd|whistle)/u.test(
    haystack
  );
}

function inferLicenseStatus(asset: StudioAsset): AudioLicenseStatus {
  const haystack = [asset.licenseType, asset.sourceLicense, asset.sourceProvider]
    .filter((value): value is string => Boolean(value))
    .join(" ")
    .toLowerCase();

  if (/royalty[_ -]?free/u.test(haystack)) {
    return "royalty_free";
  }

  if (/licensed|license pack/u.test(haystack)) {
    return "licensed";
  }

  if (/platform/u.test(haystack)) {
    return "platform_only";
  }

  if (/owned|local|original/u.test(haystack)) {
    return "owned";
  }

  return "unknown";
}

function inferSourceType(asset: StudioAsset): MusicSourceType {
  const haystack = [asset.sourceProvider, asset.licenseType, asset.sourceLicense]
    .filter((value): value is string => Boolean(value))
    .join(" ")
    .toLowerCase();

  if (/royalty/u.test(haystack)) {
    return "royalty_free";
  }

  if (/licensed/u.test(haystack)) {
    return "licensed_pack";
  }

  if (/owned|original|local/u.test(haystack)) {
    return "user_owned";
  }

  if (/upload/u.test(haystack)) {
    return "local_upload";
  }

  return "unknown";
}

function inferMusicMood(asset: StudioAsset): MusicMood {
  const haystack = toSearchHaystack(asset, asset.musicProfile ?? null);

  if (/hype|sports|goal|impact|phonk|drill/u.test(haystack)) {
    return "hype";
  }

  if (/crime|mystery|dark|suspense|tense/u.test(haystack)) {
    return "dark";
  }

  if (/epic|hero|climax|orchestral/u.test(haystack)) {
    return "epic";
  }

  if (/documentary|history|clean/u.test(haystack)) {
    return "documentary";
  }

  if (/calm|soft|ambient/u.test(haystack)) {
    return "calm";
  }

  return "cinematic";
}

function inferMusicUseCase(asset: StudioAsset): MusicUseCase {
  const haystack = toSearchHaystack(asset, asset.musicProfile ?? null);

  if (/football|soccer|sports/u.test(haystack)) {
    return "football";
  }

  if (/crime|mystery|dark/u.test(haystack)) {
    return "true_crime";
  }

  if (/documentary|history|explain/u.test(haystack)) {
    return "documentary";
  }

  if (/cinematic|epic|story/u.test(haystack)) {
    return "cinematic";
  }

  if (/motivation|inspire/u.test(haystack)) {
    return "motivational";
  }

  if (/shorts|reel|viral/u.test(haystack)) {
    return "shorts";
  }

  return "generic";
}

function inferMusicGenre(asset: StudioAsset): MusicAssetProfile["genre"] {
  const haystack = toSearchHaystack(asset, asset.musicProfile ?? null);

  if (/phonk/u.test(haystack)) return "phonk";
  if (/trap/u.test(haystack)) return "trap";
  if (/drill/u.test(haystack)) return "drill";
  if (/orchestral/u.test(haystack)) return "orchestral";
  if (/electronic|synth/u.test(haystack)) return "electronic";
  if (/ambient/u.test(haystack)) return "ambient";
  if (/rock/u.test(haystack)) return "rock";
  if (/cinematic/u.test(haystack)) return "cinematic";
  return "generic";
}

function inferEnergyFromAsset(asset: StudioAsset): MusicAssetProfile["energy"] {
  const haystack = toSearchHaystack(asset, asset.musicProfile ?? null);

  if (/extreme|explosive/u.test(haystack)) return "extreme";
  if (/hype|impact|epic|aggressive/u.test(haystack)) return "high";
  if (/dark|suspense|cinematic/u.test(haystack)) return "medium";
  return "low";
}

function defaultMusicProfile(asset: StudioAsset): UpsertMusicAssetProfileInput {
  return {
    assetId: asset.id,
    title: asset.originalName || asset.filename,
    artist: asset.sourceAuthor ?? null,
    sourceType: inferSourceType(asset),
    licenseStatus: inferLicenseStatus(asset),
    mood: inferMusicMood(asset),
    genre: inferMusicGenre(asset),
    bpm: null,
    bpmConfidence: 0,
    energy: inferEnergyFromAsset(asset),
    useCase: inferMusicUseCase(asset),
    durationSeconds: asset.duration ?? null,
    loudness: null,
    beatMarkers: [],
    energyTimeline: [],
    notes: asset.usageNotes ?? asset.recommendedUse ?? null,
    safetyWarning:
      inferLicenseStatus(asset) === "unknown"
        ? "Licenca da faixa ainda precisa de confirmacao manual."
        : null
  };
}

function defaultSfxProfile(asset: StudioAsset): UpsertSfxAssetProfileInput {
  const haystack = toSearchHaystack(asset, asset.sfxProfile ?? null);
  return {
    assetId: asset.id,
    title: asset.originalName || asset.filename,
    category: /whoosh/u.test(haystack)
      ? "whoosh"
      : /riser/u.test(haystack)
        ? "riser"
        : /crowd/u.test(haystack)
          ? "crowd"
          : /whistle/u.test(haystack)
            ? "whistle"
            : /flash/u.test(haystack)
              ? "flash"
              : /impact|hit|boom/u.test(haystack)
                ? "impact"
                : "transition",
    intensity: /extreme|huge/u.test(haystack)
      ? "extreme"
      : /impact|boom|hard/u.test(haystack)
        ? "high"
        : /soft|ambient/u.test(haystack)
          ? "low"
          : "medium",
    durationSeconds: asset.duration ?? null,
    useCase: /football|sports/u.test(haystack)
      ? "football"
      : /microclip/u.test(haystack)
        ? "microclip"
        : /reveal/u.test(haystack)
          ? "reveal"
          : /impact/u.test(haystack)
            ? "impact_moment"
            : "transition",
    licenseStatus: inferLicenseStatus(asset),
    notes: asset.usageNotes ?? asset.recommendedUse ?? null
  };
}

function assertMusicCapableAsset(asset: StudioAsset | null, assetId: string): StudioAsset {
  if (!asset) {
    throw new NotFoundError(`Asset '${assetId}' was not found.`);
  }

  if (asset.type !== "MUSIC" && asset.type !== "AUDIO") {
    throw new ValidationError("Audio analysis expects an asset of type MUSIC or AUDIO.");
  }

  return asset;
}

function assertSfxCapableAsset(asset: StudioAsset | null, assetId: string): StudioAsset {
  if (!asset) {
    throw new NotFoundError(`Asset '${assetId}' was not found.`);
  }

  if (asset.type !== "SFX" && asset.type !== "AUDIO") {
    throw new ValidationError("SFX profile expects an asset of type SFX or AUDIO.");
  }

  return asset;
}

function toMusicLibraryItem(asset: StudioAsset): MusicLibraryItemRecord {
  const persistedProfile = asset.musicProfile ?? null;
  const profile = persistedProfile ?? defaultMusicProfile(asset);
  return {
    asset,
    profile,
    status: persistedProfile ? "profiled" : "pending",
    summary: summarizeMusicProfile(profile),
    warnings: profile?.safetyWarning ? [profile.safetyWarning] : []
  };
}

function toSfxLibraryItem(asset: StudioAsset): SfxLibraryItemRecord {
  const persistedProfile = asset.sfxProfile ?? null;
  return {
    asset,
    profile: persistedProfile ?? defaultSfxProfile(asset),
    status: persistedProfile ? "profiled" : "pending",
    warnings:
      inferLicenseStatus(asset) === "unknown"
        ? ["Licenca do SFX ainda precisa de confirmacao manual."]
        : []
  };
}

function filterMusicAssets(asset: StudioAsset) {
  return isLikelyMusicAudioAsset(asset);
}

function filterSfxAssets(asset: StudioAsset) {
  return isLikelySfxAudioAsset(asset);
}

export async function listMusicLibrary(
  assetRepository: AssetRepository,
  filters: MusicProfileFilters = {}
) {
  const assets = await assetRepository.list();
  const search = normalizeStringCandidate(filters.search);

  return assets
    .filter(filterMusicAssets)
    .map(toMusicLibraryItem)
    .filter((item) => {
      if (filters.mood && item.profile?.mood !== filters.mood) return false;
      if (filters.genre && item.profile?.genre !== filters.genre) return false;
      if (filters.energy && item.profile?.energy !== filters.energy) return false;
      if (filters.useCase && item.profile?.useCase !== filters.useCase) return false;
      if (
        filters.licenseStatus &&
        item.profile?.licenseStatus !== filters.licenseStatus
      ) {
        return false;
      }
      if (search && !toSearchHaystack(item.asset, item.profile).includes(search)) {
        return false;
      }
      return true;
    });
}

export async function listSfxLibrary(
  assetRepository: AssetRepository,
  filters: SfxProfileFilters = {}
) {
  const assets = await assetRepository.list();
  const search = normalizeStringCandidate(filters.search);

  return assets
    .filter(filterSfxAssets)
    .map(toSfxLibraryItem)
    .filter((item) => {
      if (filters.category && item.profile?.category !== filters.category) return false;
      if (filters.intensity && item.profile?.intensity !== filters.intensity) return false;
      if (filters.useCase && item.profile?.useCase !== filters.useCase) return false;
      if (
        filters.licenseStatus &&
        item.profile?.licenseStatus !== filters.licenseStatus
      ) {
        return false;
      }
      if (search && !toSearchHaystack(item.asset, item.profile).includes(search)) {
        return false;
      }
      return true;
    });
}

export async function updateMusicLibraryProfile(
  assetRepository: AssetRepository,
  audioLibraryRepository: AudioLibraryRepository,
  assetId: string,
  input: Partial<UpsertMusicAssetProfileInput>
) {
  const asset = assertMusicCapableAsset(await assetRepository.getById(assetId), assetId);
  const existingProfile = asset.musicProfile ?? defaultMusicProfile(asset);
  const nextProfile = await audioLibraryRepository.upsertMusicProfile({
    ...existingProfile,
    ...input,
    assetId
  });

  return {
    asset: (await assetRepository.getById(assetId)) ?? { ...asset, musicProfile: nextProfile },
    profile: nextProfile
  };
}

export async function updateSfxLibraryProfile(
  assetRepository: AssetRepository,
  audioLibraryRepository: AudioLibraryRepository,
  assetId: string,
  input: Partial<UpsertSfxAssetProfileInput>
) {
  const asset = assertSfxCapableAsset(await assetRepository.getById(assetId), assetId);
  const existingProfile = asset.sfxProfile ?? defaultSfxProfile(asset);
  const nextProfile = await audioLibraryRepository.upsertSfxProfile({
    ...existingProfile,
    ...input,
    assetId
  });

  return {
    asset: (await assetRepository.getById(assetId)) ?? { ...asset, sfxProfile: nextProfile },
    profile: nextProfile
  };
}

export async function analyzeMusicLibraryAsset(
  assetRepository: AssetRepository,
  audioLibraryRepository: AudioLibraryRepository,
  assetId: string
) {
  const asset = assertMusicCapableAsset(await assetRepository.getById(assetId), assetId);
  const absolutePath = resolveStoragePath(projectRoot, asset.path);
  const analysis = await analyzeAudioAsset({
    assetPath: absolutePath,
    durationSeconds: asset.duration ?? null
  });
  const baseProfile = asset.musicProfile ?? defaultMusicProfile(asset);
  const nextProfile = await audioLibraryRepository.upsertMusicProfile({
    ...baseProfile,
    durationSeconds: analysis.durationSeconds ?? baseProfile.durationSeconds,
    bpm: analysis.bpm,
    bpmConfidence: analysis.bpmConfidence,
    energy: analysis.energy,
    loudness: analysis.loudness,
    beatMarkers: analysis.beatMarkers,
    energyTimeline: analysis.energyTimeline,
    notes: baseProfile.notes,
    safetyWarning:
      baseProfile.safetyWarning ??
      (baseProfile.licenseStatus === "unknown"
        ? "Licenca da faixa ainda precisa de confirmacao manual."
        : null)
  });

  return {
    asset: (await assetRepository.getById(assetId)) ?? { ...asset, musicProfile: nextProfile },
    profile: nextProfile,
    analysis,
    warnings: analysis.warnings
  };
}

export async function selectMusicForProject(
  assetRepository: AssetRepository,
  input: SelectMusicRequestInput
): Promise<SelectMusicResponse> {
  const musicLibrary = await listMusicLibrary(assetRepository);
  const sfxLibrary = await listSfxLibrary(assetRepository);
  const profiledMusic: MusicLibraryItem[] = musicLibrary
    .filter((item): item is MusicLibraryItemRecord & { profile: MusicAssetProfile } => Boolean(item.profile))
    .map((item) => ({
      asset: {
        id: item.asset.id,
        filename: item.asset.filename,
        type: item.asset.type,
        tags: item.asset.tags,
        recommendedUse: item.asset.recommendedUse,
        duration: item.asset.duration
      },
      profile: item.profile
    }));
  const profiledSfx: SfxLibraryItem[] = sfxLibrary
    .filter((item): item is SfxLibraryItemRecord & { profile: SfxAssetProfile } => Boolean(item.profile))
    .map((item) => ({
      asset: {
        id: item.asset.id,
        filename: item.asset.filename,
        type: item.asset.type,
        tags: item.asset.tags,
        recommendedUse: item.asset.recommendedUse,
        duration: item.asset.duration
      },
      profile: item.profile
    }));
  const selection = selectMusicForReel({
    ...input,
    musicAssets: profiledMusic,
    sfxAssets: profiledSfx
  });
  const selectedMusicCandidate = selection.selectedMusicAsset;
  const selectedMusicAsset = selectedMusicCandidate
    ? musicLibrary.find((item) => item.asset.id === selectedMusicCandidate.asset.id) ?? null
    : null;
  const selectedSfxAssets = selection.selectedSfxAssets
    .map((item) => sfxLibrary.find((entry) => entry.asset.id === item.asset.id) ?? null)
    .filter((item): item is SfxLibraryItemRecord => item !== null);
  const preset =
    getMusicPresetById(input.musicPresetId ?? null) ??
    suggestMusicPresetByContext({
      templateId: input.templateId ?? null,
      tone: input.tone ?? null,
      useCase: input.useCase ?? null
    });

  return {
    preset,
    selectedMusicAsset,
    selectedSfxAssets,
    reason: selection.reason,
    warnings: selection.warnings,
    confidence: selection.confidence
  };
}

export async function buildProjectBeatSyncPlan(
  projectRepository: ProjectRepository,
  assetRepository: AssetRepository,
  editorialMicroclipRepository: EditorialMicroclipRepository,
  input: BuildBeatSyncPlanRequestInput
): Promise<BuildBeatSyncPlanResponse> {
  const project = await projectRepository.getById(input.projectId);

  if (!project) {
    throw new NotFoundError(`Video project '${input.projectId}' was not found.`);
  }

  const selectedMusicAssetId =
    input.musicAssetId ?? project.backgroundMusicAssetId ?? null;
  const selectedMusicAsset = selectedMusicAssetId
    ? await assetRepository.getById(selectedMusicAssetId)
    : null;
  const microclips = await editorialMicroclipRepository.listByProjectId(project.id);
  const reelDurationSeconds =
    input.reelDurationSeconds ??
    project.scenes.reduce((total, scene) => total + (scene.duration ?? 4), 0);
  const resolvedMusicPresetId = input.musicPresetId ?? project.musicPresetId ?? null;
  const beatSyncPlan = buildBeatSyncPlan({
    musicAssetProfile: selectedMusicAsset?.musicProfile ?? null,
    reelDurationSeconds,
    microclips: microclips.map((microclip) => ({
      microclipId: microclip.id,
      sceneId: microclip.sceneId,
      label: microclip.label,
      usageMode: microclip.usageMode,
      durationSeconds: microclip.durationSeconds,
      narrationOverlay: microclip.narrationOverlay
    })),
    sceneCount: project.scenes.length,
    presetId: resolvedMusicPresetId,
    narrationWindows: project.scenes
      .filter((scene) => scene.generatedNarrationAssetId)
      .reduce<Array<{ startSeconds: number; endSeconds: number }>>((windows, scene) => {
        const previousDuration = project.scenes
          .filter((entry) => entry.order < scene.order)
          .reduce((total, entry) => total + (entry.duration ?? 4), 0);
        const duration = scene.duration ?? 4;
        windows.push({
          startSeconds: previousDuration,
          endSeconds: previousDuration + duration
        });
        return windows;
      }, [])
  });

  return {
    projectId: project.id,
    selectedMusicAssetId,
    selectedMusicAssetPath: selectedMusicAsset?.path ?? null,
    musicPresetId: resolvedMusicPresetId,
    beatSyncPlan,
    warnings: beatSyncPlan.warnings
  };
}
