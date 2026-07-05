export type DataSource = "api" | "mock";

export const assetTypes = [
  "IMAGE",
  "VIDEO",
  "AUDIO",
  "MUSIC",
  "SFX",
  "OVERLAY",
  "DOCUMENT",
  "FONT"
] as const;

export type AssetType = (typeof assetTypes)[number];

export const assetCategories = [
  "GENERATED",
  "CHARACTER",
  "BACKGROUND",
  "PANEL",
  "SCREENSHOT",
  "COVER",
  "BROLL",
  "REFERENCE",
  "TRACK",
  "EFFECT",
  "OVERLAY",
  "TYPOGRAPHY",
  "OTHER"
] as const;

export type AssetCategory = (typeof assetCategories)[number];

export const copyrightRisks = [
  "LOW",
  "MEDIUM",
  "HIGH",
  "UNKNOWN"
] as const;

export type CopyrightRisk = (typeof copyrightRisks)[number];

export const emotionTags = [
  "NEUTRAL",
  "CURIOUS",
  "EPIC",
  "MYSTERIOUS",
  "DARK",
  "TENSE",
  "JOYFUL",
  "SAD"
] as const;

export type EmotionTag = (typeof emotionTags)[number];

export const visualSourceModes = [
  "asset_only",
  "generated_only",
  "hybrid_overlay",
  "fallback_generated",
  "mixed_sequence"
] as const;

export type VisualSourceMode = (typeof visualSourceModes)[number];

export const visualGenerationProviders = [
  "mock-svg",
  "manual",
  "comfyui-local",
  "stable-diffusion-local",
  "other"
] as const;

export type VisualGenerationProvider =
  (typeof visualGenerationProviders)[number];

export const visualGenerationStatuses = [
  "draft",
  "queued",
  "generating",
  "completed",
  "failed",
  "cancelled"
] as const;

export type VisualGenerationStatus =
  (typeof visualGenerationStatuses)[number];

export const characterReferenceTypes = [
  "face",
  "full_body",
  "pose",
  "outfit",
  "style",
  "expression",
  "other"
] as const;

export type CharacterReferenceType = (typeof characterReferenceTypes)[number];

export const projectStatuses = [
  "DRAFT",
  "SCRIPTING",
  "SCENE_PLANNING",
  "READY_FOR_EDIT"
] as const;

export type ProjectStatus = (typeof projectStatuses)[number];

export const cinematicPresetIds = [
  "action",
  "drama",
  "suspense",
  "horror",
  "mystery",
  "epic",
  "calm"
] as const;

export type CinematicPresetId = (typeof cinematicPresetIds)[number];

export const captionStyleIds = [
  "bold_impact",
  "premium_yellow",
  "anime_punch",
  "documentary_clean",
  "horror_whisper",
  "comic_pop",
  "sports_hype"
] as const;

export type CaptionStyleId = (typeof captionStyleIds)[number];

export const captionPositions = [
  "top",
  "center",
  "lower-third",
  "bottom",
  "split"
] as const;

export type CaptionPosition = (typeof captionPositions)[number];

export const audioMoodPresetIds = [
  "dark_suspense",
  "epic_rise",
  "horror_tension",
  "documentary_bed",
  "sports_hype",
  "calm_story",
  "action_pulse",
  "emotional_piano"
] as const;

export type AudioMoodPresetId = (typeof audioMoodPresetIds)[number];

export const audioMasteringPresetIds = [
  "shorts_clean_voice",
  "football_hype",
  "true_crime_dark",
  "cinematic_epic",
  "documentary_clean",
  "viral_fast_cut"
] as const;

export type AudioMasteringPresetId =
  (typeof audioMasteringPresetIds)[number];

export type AudioDuckingMode = "sidechain" | "global_reduction" | "none";

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

export const musicPresetIds = [
  "football_hype",
  "viral_fast_cut",
  "cinematic_epic",
  "true_crime_dark",
  "documentary_clean",
  "shorts_clean_voice"
] as const;

export type MusicPresetId = (typeof musicPresetIds)[number];

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

export interface MusicPreset {
  id: MusicPresetId;
  name: string;
  description: string;
  preferredMood: MusicMood[];
  preferredGenre: MusicGenre[];
  bpmRange: {
    min: number;
    max: number;
  } | null;
  energyRange: MusicEnergy[];
  recommendedSfxCategories: SfxCategory[];
  defaultMusicVolume: number;
  defaultNarrationDucking: number;
  recommendedAudioMasteringPresetId: string;
  microclipBeatSyncStrategy: string;
  safetyNotes: string;
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

export interface AudioMasteringPresetSummary {
  id: AudioMasteringPresetId;
  name: string;
  description: string;
  targetLufs: number;
  truePeakDb: number;
  narrationGainDb: number;
  musicGainDb: number;
  sfxGainDb: number;
  duckingEnabled: boolean;
  duckingAmountDb: number;
  duckingAttackMs: number;
  duckingReleaseMs: number;
  compressorEnabled: boolean;
  compressorThresholdDb: number;
  compressorRatio: number;
  compressorAttackMs: number;
  compressorReleaseMs: number;
  limiterEnabled: boolean;
  fadeInMs: number;
  fadeOutMs: number;
  removeLongSilences: boolean;
  maxSilenceMs: number;
  recommendedUse: string;
}

export interface AudioMasteringPreview {
  masteringPresetId: AudioMasteringPresetId;
  masteringPresetName: string;
  narrationIncluded: boolean;
  musicIncluded: boolean;
  sfxIncluded: boolean;
  duckingEnabled: boolean;
  duckingMode: AudioDuckingMode;
  compressorApplied: boolean;
  limiterApplied: boolean;
  loudnormApplied: boolean;
  removeLongSilences: boolean;
  maxSilenceMs: number;
  targetLufs: number;
  truePeakDb: number;
  narrationGainDb: number;
  musicGainDb: number;
  sfxGainDb: number;
  warnings: string[];
  summary: string;
}

export interface AudioQualityReport {
  masteringPresetId: AudioMasteringPresetId;
  masteringPresetName: string;
  targetLufs: number;
  truePeakDb: number;
  measuredInputDuration: number;
  measuredOutputDuration: number | null;
  narrationIncluded: boolean;
  musicIncluded: boolean;
  sfxIncluded: boolean;
  duckingEnabled: boolean;
  duckingMode: AudioDuckingMode;
  compressorApplied: boolean;
  limiterApplied: boolean;
  loudnormApplied: boolean;
  silenceTrimmingApplied: boolean;
  narrationGainDb: number;
  musicGainDb: number;
  sfxGainDb: number;
  finalAudioCodec: string | null;
  finalAudioSampleRate: number | null;
  finalAudioBitrate: string | null;
  warnings: string[];
  appliedFilters: string[];
}

export const narrationProviders = [
  "mock-tts",
  "windows-sapi-local",
  "manual",
  "other"
] as const;

export type NarrationProvider = (typeof narrationProviders)[number];

export const narrationJobStatuses = [
  "draft",
  "queued",
  "generating",
  "completed",
  "failed",
  "cancelled"
] as const;

export type NarrationJobStatus = (typeof narrationJobStatuses)[number];

export const templateIds = [
  "anime_dark",
  "comic_drama",
  "game_epic",
  "mystery_doc",
  "history_dark",
  "sports_hype",
  "true_crime",
  "cinematic_story",
  "player_threat_analysis",
  "tactical_breakdown",
  "match_preview",
  "post_match_hot_take",
  "rivalry_hype",
  "top_3_ranking",
  "underdog_story",
  "brazil_warning"
] as const;

export type TemplateId = (typeof templateIds)[number];

export type CinematicPanMode =
  | "static"
  | "drift"
  | "push-in"
  | "push-out"
  | "parallax"
  | "slow-left"
  | "slow-right";

export type CinematicCutPace =
  | "meditative"
  | "measured"
  | "steady"
  | "sharp"
  | "volatile";

export interface CinematicPresetEnergyCurve {
  opening: number;
  build: number;
  peak: number;
  release: number;
}

export interface CinematicPresetSummary {
  id: CinematicPresetId;
  name: string;
  description: string;
  defaultZoomIntensity: number;
  defaultPanMode: CinematicPanMode;
  shakeIntensity: number;
  blurIntensity: number;
  glowIntensity: number;
  vignetteIntensity: number;
  colorMood: string;
  cutPace: CinematicCutPace;
  suggestedTransition: string;
  suggestedCaptionStyle: string;
  suggestedMusicMood: string;
  suggestedSfx: string;
  energyCurve: CinematicPresetEnergyCurve;
}

export interface CaptionOutline {
  color: string;
  width: number;
  blur: number;
}

export interface CaptionShadow {
  color: string;
  offsetX: number;
  offsetY: number;
  blur: number;
  opacity: number;
}

export interface CaptionBackground {
  enabled: boolean;
  color: string;
  opacity: number;
  paddingX: number;
  paddingY: number;
  radius: number;
}

export interface CaptionAnimation {
  entry: string;
  emphasis: string;
  exit: string;
  speed: "calm" | "balanced" | "aggressive";
}

export interface CaptionStyleSummary {
  id: CaptionStyleId;
  name: string;
  description: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: string;
  textTransform: "none" | "uppercase" | "capitalize";
  position: CaptionPosition;
  maxCharsPerLine: number;
  maxLines: number;
  outline: CaptionOutline;
  shadow: CaptionShadow;
  background: CaptionBackground;
  animation: CaptionAnimation;
  emphasisMode: string;
}

export interface ReelTemplateSummary {
  id: TemplateId;
  name: string;
  description: string;
  niche: string;
  defaultVisualPreset: CinematicPresetId;
  defaultCaptionStyle: CaptionStyleId;
  defaultTransition: string;
  colorMood: string;
  musicMood: string;
  sfxMood: string;
  pacing: string;
  cameraBehavior: string;
  overlayStyle: string;
  recommendedSceneDuration: number;
  introStyle: string;
  outroStyle: string;
}

export const reelsFactoryTemplateIds = [
  "player_threat_analysis",
  "tactical_breakdown",
  "match_preview",
  "post_match_hot_take",
  "rivalry_hype",
  "top_3_ranking",
  "underdog_story",
  "brazil_warning"
] as const;

export type ReelsFactoryTemplateId =
  (typeof reelsFactoryTemplateIds)[number];

export type ReelsFactoryNextAction =
  | "generate_narration"
  | "generate_visuals"
  | "attach_microclip"
  | "render";

export type ReelsFactorySceneRole =
  | "hook"
  | "setup"
  | "development"
  | "impactMoment"
  | "conclusion"
  | "cta";

export interface ReelsFactoryTemplateStructure {
  hook: string;
  setup: string;
  development: string;
  impactMoment: string;
  conclusion: string;
  cta: string;
}

export interface ReelsFactoryTemplate {
  id: ReelsFactoryTemplateId;
  name: string;
  description: string;
  bestFor: string;
  defaultDurationSeconds: number;
  defaultSceneCount: number;
  recommendedTone: string;
  recommendedVoicePackId: string;
  recommendedWorkflowPackId: string;
  recommendedQualityPresetId: "draft" | "standard" | "high";
  recommendedAudioMasteringPresetId: AudioMasteringPresetId;
  allowsMicroclip: boolean;
  microclipSuggestion: string;
  structure: ReelsFactoryTemplateStructure;
}

export interface ReelsFactorySceneMicroclipSlot {
  label: string;
  usageMode: "supporting_evidence" | "impact_moment" | "quick_reference";
  textOverlay: string | null;
}

export interface ReelsFactorySceneDraft {
  orderIndex: number;
  role: ReelsFactorySceneRole;
  title: string;
  durationSeconds: number;
  narrationText: string;
  onScreenText: string;
  visualPrompt: string;
  suggestedWorkflowPackId: string;
  suggestedVoicePackId: string;
  suggestedAudioMasteringPresetId: AudioMasteringPresetId;
  suggestedVisualPresetId: CinematicPresetId;
  captionStyleId: CaptionStyleId;
  transition: string;
  energyLevel: number;
  microclipSlot: ReelsFactorySceneMicroclipSlot | null;
}

export interface ReelsFactoryPreviewPayload {
  channelId?: string | null;
  topic: string;
  subject: string;
  angle: string;
  templateId: ReelsFactoryTemplateId;
  editingReferencePresetId?: string | null;
  tone: string;
  durationSeconds: number;
  language: string;
  includeMicroclip: boolean;
}

export interface ReelsFactoryBatchItemPayload {
  topic: string;
  subject?: string | null;
  angle?: string | null;
}

export interface ReelsFactoryBatchPayload {
  channelId?: string | null;
  items: ReelsFactoryBatchItemPayload[];
  templateId: ReelsFactoryTemplateId;
  editingReferencePresetId?: string | null;
  tone: string;
  durationSeconds: number;
  language: string;
  includeMicroclip: boolean;
}

export interface ReelsFactoryPreviewResponse {
  title: string;
  shortDescription: string;
  hook: string;
  templateId: ReelsFactoryTemplateId;
  editingReferencePresetId?: string | null;
  editingStyleSummary?: EditingStyleSummary | null;
  tone: string;
  language: string;
  durationSeconds: number;
  includeMicroclip: boolean;
  scenes: ReelsFactorySceneDraft[];
  hashtags: string[];
  caption: string;
  checklist: string[];
  recommendedNextActions: ReelsFactoryNextAction[];
}

export interface ReelsFactoryCreateProjectResponse {
  projectId: string;
  title: string;
  scenesCreated: number;
  project: StudioProject;
  preview: ReelsFactoryPreviewResponse;
  recommendedNextActions: ReelsFactoryNextAction[];
}

export interface ReelsFactoryBatchProjectResult {
  projectId: string;
  title: string;
  scenesCreated: number;
  topic: string;
}

export interface ReelsFactoryBatchFailure {
  topic: string;
  error: string;
}

export interface ReelsFactoryBatchResponse {
  projects: ReelsFactoryBatchProjectResult[];
  failures: ReelsFactoryBatchFailure[];
  totalCreated: number;
}

export interface StudioChannel {
  id: string;
  name: string;
  niche: string;
  language: string;
  visualStyle: string | null;
  narrativeTone: string | null;
  defaultTemplate: TemplateId | null;
  defaultRenderMode: RenderMode;
  defaultRenderQuality: RenderQuality;
  defaultAudioMood: AudioMoodPresetId | null;
  defaultCaptionStyle: CaptionStyleId | null;
  defaultVisualPreset: CinematicPresetId | null;
  defaultMusicAssetId: string | null;
  defaultVoiceoverAssetId: string | null;
  defaultDurationTarget: number | null;
  defaultSceneDuration: number;
  preferredAssetCategories: AssetCategory[];
  preferredAssetTags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ChannelPayload {
  name: string;
  niche: string;
  language: string;
  visualStyle: string | null;
  narrativeTone: string | null;
  defaultTemplate: TemplateId | null;
  defaultRenderMode: RenderMode;
  defaultRenderQuality: RenderQuality;
  defaultAudioMood: AudioMoodPresetId | null;
  defaultCaptionStyle: CaptionStyleId | null;
  defaultVisualPreset: CinematicPresetId | null;
  defaultMusicAssetId: string | null;
  defaultVoiceoverAssetId: string | null;
  defaultDurationTarget: number | null;
  defaultSceneDuration: number;
  preferredAssetCategories: AssetCategory[];
  preferredAssetTags: string[];
}

export interface StudioAsset {
  id: string;
  filename: string;
  originalName: string;
  path: string;
  type: AssetType;
  category: AssetCategory;
  franchise: string | null;
  character: string | null;
  emotion: EmotionTag | null;
  tags: string[];
  licenseType: string;
  copyrightRisk: CopyrightRisk;
  recommendedUse: string | null;
  duration: number | null;
  width: number | null;
  height: number | null;
  mimeType: string | null;
  extension: string | null;
  fileSize: number | null;
  sourceProvider?: string | null;
  sourceUrl?: string | null;
  sourceAuthor?: string | null;
  sourceLicense?: string | null;
  sourceLicenseUrl?: string | null;
  downloadedAt?: string | null;
  collectionId?: string | null;
  usageNotes?: string | null;
  musicProfile?: MusicAssetProfile | null;
  sfxProfile?: SfxAssetProfile | null;
  createdAt: string;
  updatedAt: string;
}

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

export const editingReferenceSourceTypes = [
  "local_file",
  "asset_library"
] as const;

export type EditingReferenceSourceType =
  (typeof editingReferenceSourceTypes)[number];

export const editingReferenceCategories = [
  "football",
  "documentary",
  "true_crime",
  "cinematic",
  "viral",
  "generic"
] as const;

export type EditingReferenceCategory =
  (typeof editingReferenceCategories)[number];

export const editingReferenceStatuses = [
  "draft",
  "analyzed",
  "preset_ready"
] as const;

export type EditingReferenceStatus =
  (typeof editingReferenceStatuses)[number];

export const editingReferenceBeatIntensities = [
  "low",
  "medium",
  "high",
  "extreme"
] as const;

export type EditingReferenceBeatIntensity =
  (typeof editingReferenceBeatIntensities)[number];

export const editingReferencePacingOptions = [
  "slow",
  "medium",
  "fast",
  "hyper"
] as const;

export type EditingReferencePacing =
  (typeof editingReferencePacingOptions)[number];

export const editingReferenceZoomStyles = [
  "none",
  "subtle",
  "medium",
  "aggressive"
] as const;

export type EditingReferenceZoomStyle =
  (typeof editingReferenceZoomStyles)[number];

export const editingReferenceFlashStyles = [
  "none",
  "low",
  "medium",
  "high"
] as const;

export type EditingReferenceFlashStyle =
  (typeof editingReferenceFlashStyles)[number];

export const editingReferenceTransitionStyles = [
  "cut",
  "fast_cut",
  "flash_cut",
  "smooth",
  "mixed"
] as const;

export type EditingReferenceTransitionStyle =
  (typeof editingReferenceTransitionStyles)[number];

export const editingReferenceCaptionStyles = [
  "none",
  "center_bold",
  "lower_clean",
  "kinetic",
  "dramatic"
] as const;

export type EditingReferenceCaptionStyle =
  (typeof editingReferenceCaptionStyles)[number];

export const editingReferenceNarrationStyles = [
  "none",
  "calm",
  "documentary",
  "hype",
  "aggressive",
  "epic"
] as const;

export type EditingReferenceNarrationStyle =
  (typeof editingReferenceNarrationStyles)[number];

export const editingReferenceMusicStyles = [
  "none",
  "hype",
  "dark",
  "epic",
  "documentary",
  "viral"
] as const;

export type EditingReferenceMusicStyle =
  (typeof editingReferenceMusicStyles)[number];

export const editingReferenceSfxStyles = [
  "none",
  "low",
  "medium",
  "high"
] as const;

export type EditingReferenceSfxStyle =
  (typeof editingReferenceSfxStyles)[number];

export const editingReferenceHookStyles = [
  "question",
  "warning",
  "explosive",
  "curiosity",
  "ranking",
  "story"
] as const;

export type EditingReferenceHookStyle =
  (typeof editingReferenceHookStyles)[number];

export const editingReferenceCtaStyles = [
  "none",
  "short",
  "strong",
  "subtle"
] as const;

export type EditingReferenceCtaStyle =
  (typeof editingReferenceCtaStyles)[number];

export const editingReferenceMicroclipPlacements = [
  "none",
  "intro",
  "middle",
  "climax",
  "outro",
  "multiple"
] as const;

export type EditingReferenceMicroclipPlacement =
  (typeof editingReferenceMicroclipPlacements)[number];

export interface EditingReference {
  id: string;
  title: string;
  description: string | null;
  assetId: string | null;
  asset: StudioAsset | null;
  localPath: string | null;
  sourceType: EditingReferenceSourceType;
  category: EditingReferenceCategory;
  status: EditingReferenceStatus;
  durationSeconds: number | null;
  averageCutPaceSeconds: number | null;
  beatIntensity: EditingReferenceBeatIntensity;
  pacing: EditingReferencePacing;
  zoomStyle: EditingReferenceZoomStyle;
  flashStyle: EditingReferenceFlashStyle;
  transitionStyle: EditingReferenceTransitionStyle;
  captionStyle: EditingReferenceCaptionStyle;
  narrationStyle: EditingReferenceNarrationStyle;
  musicStyle: EditingReferenceMusicStyle;
  sfxStyle: EditingReferenceSfxStyle;
  hookStyle: EditingReferenceHookStyle;
  ctaStyle: EditingReferenceCtaStyle;
  microclipPlacement: EditingReferenceMicroclipPlacement;
  visualStyleNotes: string | null;
  audioStyleNotes: string | null;
  editingStyleNotes: string | null;
  analysisWarnings: string[];
  createdAt: string;
  updatedAt: string;
}

export interface EditingReferencePreset {
  id: string;
  referenceId: string | null;
  reference: EditingReference | null;
  name: string;
  slug: string;
  description: string;
  useCase: EditingReferenceCategory;
  cutPace: number | null;
  pacing: EditingReferencePacing;
  zoomStyle: EditingReferenceZoomStyle;
  flashStyle: EditingReferenceFlashStyle;
  transitionStyle: EditingReferenceTransitionStyle;
  captionStyle: EditingReferenceCaptionStyle;
  narrationStyle: EditingReferenceNarrationStyle;
  musicStyle: EditingReferenceMusicStyle;
  sfxStyle: EditingReferenceSfxStyle;
  hookStyle: EditingReferenceHookStyle;
  ctaStyle: EditingReferenceCtaStyle;
  microclipPlacement: EditingReferenceMicroclipPlacement;
  recommendedTemplates: string[];
  recommendedMusicPresetId: string | null;
  recommendedAudioMasteringPresetId: string | null;
  recommendedNarrationVoicePackId: string | null;
  defaultShotDurationSeconds: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EditingStyleSummary {
  presetId: string;
  presetName: string;
  useCase: EditingReferenceCategory;
  pacing: EditingReferencePacing;
  cutPace: number | null;
  zoomStyle: EditingReferenceZoomStyle;
  flashStyle: EditingReferenceFlashStyle;
  transitionStyle: EditingReferenceTransitionStyle;
  captionStyle: EditingReferenceCaptionStyle;
  narrationStyle: EditingReferenceNarrationStyle;
  musicStyle: EditingReferenceMusicStyle;
  sfxStyle: EditingReferenceSfxStyle;
  hookStyle: EditingReferenceHookStyle;
  ctaStyle: EditingReferenceCtaStyle;
  microclipPlacement: EditingReferenceMicroclipPlacement;
  defaultShotDurationSeconds: number | null;
  recommendedMusicPresetId: string | null;
  recommendedAudioMasteringPresetId: string | null;
  recommendedNarrationVoicePackId: string | null;
  notes: string | null;
}

export interface EditingReferenceSuggestion {
  templateId: string;
  preset: EditingReferencePreset;
  origin: "saved" | "catalog";
  reason: string;
}

export interface EditingReferenceAnalysisResponse {
  reference: EditingReference;
  analysis: {
    status: "completed" | "skipped";
    referencePath: string;
    title: string | null;
    category: EditingReferenceCategory | null;
    durationSeconds: number | null;
    approximateSceneChanges: number | null;
    averageCutPaceSeconds: number | null;
    beatIntensity: EditingReferenceBeatIntensity;
    pacing: EditingReferencePacing;
    audioEnergy: number | null;
    warnings: string[];
    diagnostics: string[];
  };
  summary: string;
}

export interface BuildEditingReferencePresetResponse {
  preset: EditingReferencePreset;
  summary: string;
}

export interface SelectMusicResponse {
  preset: MusicPreset;
  selectedMusicAsset: MusicLibraryItemRecord | null;
  selectedSfxAssets: SfxLibraryItemRecord[];
  reason: string;
  warnings: string[];
  confidence: number;
}

export interface BuildBeatSyncPlanResponse {
  projectId: string;
  selectedMusicAssetId: string | null;
  selectedMusicAssetPath: string | null;
  musicPresetId: string | null;
  beatSyncPlan: BeatSyncPlan;
  warnings: string[];
}

export interface CharacterReference {
  id: string;
  characterProfileId: string;
  assetId: string | null;
  asset: StudioAsset | null;
  sourcePath: string | null;
  title: string | null;
  notes: string | null;
  referenceType: CharacterReferenceType;
  strength: number;
  createdAt: string;
  updatedAt: string;
}

export interface CharacterProfile {
  id: string;
  name: string;
  slug: string;
  franchise: string | null;
  category: string | null;
  description: string | null;
  basePrompt: string | null;
  negativePrompt: string | null;
  styleNotes: string | null;
  defaultVisualStyle: string | null;
  referenceStrength: number;
  preferredProvider: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  references: CharacterReference[];
}

export interface CharacterProfilePayload {
  name: string;
  slug: string;
  franchise: string | null;
  category: string | null;
  description: string | null;
  basePrompt: string | null;
  negativePrompt: string | null;
  styleNotes: string | null;
  defaultVisualStyle: string | null;
  referenceStrength: number | null;
  preferredProvider: string | null;
  tags: string[];
}

export interface CharacterReferencePayload {
  assetId: string | null;
  sourcePath: string | null;
  title: string | null;
  notes: string | null;
  referenceType: CharacterReferenceType;
  strength: number | null;
}

export interface CharacterCreateFromIntakeResponse {
  profile: CharacterProfile;
  referencesCreated: number;
  warnings: string[];
}

export interface VisualSourceModeDescriptor {
  id: VisualSourceMode;
  name: string;
  description: string;
}

export interface VisualGenerationProviderDescriptor {
  id: VisualGenerationProvider;
  name: string;
  configured: boolean;
  available: boolean;
  message: string;
  requiresLocalServer: boolean;
  baseUrl?: string | null;
  kind: "local" | "stub" | "manual";
  description: string;
}

export type ComfyUiProviderState =
  | "disabled"
  | "not_reachable"
  | "reachable"
  | "workflow_invalid"
  | "ready";

export interface ComfyUiProviderStatus {
  enabled: boolean;
  baseUrl: string;
  reachable: boolean;
  message: string;
  workflowTemplate: string;
  configuredWorkflow: string;
  timeoutMs: number;
  info: Record<string, unknown> | null;
  serverInfo: Record<string, unknown> | null;
  queueStatus: Record<string, unknown> | null;
  historyEndpointReachable: boolean;
  promptEndpointReachable: boolean;
  viewEndpointReachable: boolean;
  workflowTemplateExists: boolean;
  workflowTemplateValid: boolean;
  workflowTemplatePath: string | null;
  workflowOrigin: "storage-custom" | "package-default" | null;
  workflowWarnings: string[];
  placeholdersFound: string[];
  missingPlaceholders: string[];
  state: ComfyUiProviderState;
}

export interface ComfyWorkflowValidationResult {
  valid: boolean;
  warnings: string[];
  placeholdersFound: string[];
  missingPlaceholders: string[];
  templatePath: string | null;
  origin: "storage-custom" | "package-default" | null;
  templateId: string;
  errorMessage: string | null;
}

export type SeedStrategy = "random" | "fixed" | "reuse" | "increment";

export interface ComfyWorkflowPack {
  id: string;
  name: string;
  description: string;
  niche: string;
  recommendedWorkflowId: string;
  recommendedPromptPackId: string;
  recommendedNegativePromptPackId: string;
  defaultWidth: number;
  defaultHeight: number;
  defaultSeedStrategy: SeedStrategy;
  defaultQualityPreset: "draft" | "standard" | "high";
  styleNotes: string;
  cameraNotes: string;
  lightingNotes: string;
  compositionNotes: string;
  recommendedUse: string;
  limitations: string;
  supportsReferences: boolean;
  supportsImageToImage: boolean;
  providerCompatibility: string[];
}

export interface ImageQualityPreset {
  id: "draft" | "standard" | "high";
  name: string;
  description: string;
  width: number;
  height: number;
  steps: number;
  cfg: number;
  sampler?: string;
  scheduler?: string;
  denoise?: number;
  seedMode: SeedStrategy;
  timeoutMs: number;
  recommendedUse: string;
}

export interface WorkflowPackSuggestion {
  pack: ComfyWorkflowPack;
  reason: string;
  context?: string;
}

export const promptVariantTypes = [
  "close-up",
  "wide-shot",
  "dramatic-low-angle",
  "silhouette-shot",
  "action-impact-frame",
  "documentary-evidence-frame",
  "emotional-portrait",
  "environment-establishing-shot"
] as const;

export type PromptVariantType = (typeof promptVariantTypes)[number];

export interface VisualPromptPack {
  id: string;
  name: string;
  description: string;
  composition: string;
  camera: string;
  lighting: string;
  colorPalette: string;
  mood: string;
  texture: string;
  aspectRatio: "9:16";
  qualityTags: string[];
  styleTags: string[];
  recommendedNegativePack: string;
  recommendedProvider: string;
  recommendedWorkflow: string;
  promptTemplate: string;
}

export interface NegativePromptPack {
  id: string;
  name: string;
  description: string;
  negativeTerms: string[];
  anatomyTerms: string[];
  artifactTerms: string[];
  textTerms: string[];
  watermarkTerms: string[];
  lowQualityTerms: string[];
  styleAvoidanceTerms: string[];
}

export type PromptPack = VisualPromptPack;

export interface PromptVariant {
  id: string;
  type: PromptVariantType;
  title: string;
  prompt: string;
  negativePrompt: string;
  recommendedUse: string;
  score: number;
}

export interface PromptQualityAnalysis {
  lengthScore: number;
  specificityScore: number;
  visualClarityScore: number;
  compositionScore: number;
  styleConsistencyScore: number;
  safetyWarnings: string[];
  missingElements: string[];
  suggestions: string[];
  overallScore: number;
}

export interface PromptPlan {
  promptPackId: string;
  negativePackId: string;
  variantType: PromptVariantType | "default";
  subject: string;
  action: string;
  environment: string;
  composition: string;
  camera: string;
  lighting: string;
  mood: string;
  style: string;
  quality: string;
  constraints: string;
  notes: string[];
  tags: string[];
}

export interface PromptBuildResponse {
  sceneId?: string | null;
  projectId?: string | null;
  researchAssetRequirementId?: string | null;
  dossierId?: string | null;
  prompt: string;
  negativePrompt: string;
  variants: PromptVariant[];
  qualityAnalysis: PromptQualityAnalysis | null;
  promptPlanSummary: string | null;
  promptPackId: string | null;
  negativePackId: string | null;
}

export interface PromptBuildResult extends PromptBuildResponse {
  plan?: PromptPlan | null;
  promptPack?: VisualPromptPack | null;
  negativePromptPack?: NegativePromptPack | null;
}

export interface ScenePromptBuildResponse extends PromptBuildResponse {
  scene: ProjectScene;
}

export interface ResearchRequirementPromptBuildResponse
  extends PromptBuildResponse {
  requirement: ResearchAssetRequirement;
}

export interface VisualGenerationJob {
  id: string;
  videoProjectId: string | null;
  sceneId: string | null;
  characterProfileId: string | null;
  characterProfile: CharacterProfile | null;
  researchAssetRequirementId: string | null;
  status: VisualGenerationStatus;
  provider: VisualGenerationProvider;
  visualSourceMode: VisualSourceMode | null;
  prompt: string;
  negativePrompt: string | null;
  stylePreset: string | null;
  seed: number | null;
  width: number;
  height: number;
  outputPath: string | null;
  generatedAssetId: string | null;
  generatedAsset: StudioAsset | null;
  errorMessage: string | null;
  metadata: Record<string, unknown> | null;
  summary: string;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

export interface NarrationProviderDescriptor {
  id: "mock-tts" | "windows-sapi-local";
  name: string;
  description: string;
  available: boolean;
  enabled: boolean;
  requiresWindows: boolean;
  offline: boolean;
  status: "ready" | "disabled" | "unavailable";
  reason: string | null;
}

export interface NarrationVoicePack {
  id: string;
  name: string;
  description: string;
  language: string;
  tone: string;
  rate: number;
  pitch: number | null;
  volume: number;
  recommendedUse: string;
  safetyNotes: string;
}

export interface NarrationJob {
  id: string;
  videoProjectId: string | null;
  sceneId: string | null;
  provider: NarrationProvider;
  voicePackId: string | null;
  language: string;
  status: NarrationJobStatus;
  text: string;
  outputPath: string | null;
  generatedAssetId: string | null;
  generatedAsset: StudioAsset | null;
  durationSeconds: number | null;
  sampleRate: number | null;
  errorMessage: string | null;
  metadata: Record<string, unknown> | null;
  summary: string;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

export interface GeneratedNarrationGalleryProjectSummary {
  id: string;
  title: string;
  status: ProjectStatus;
  channelId: string;
  channelName: string;
  format: string;
}

export interface GeneratedNarrationGallerySceneSummary {
  id: string;
  order: number;
  title: string;
  videoProjectId: string;
  narrationText: string | null;
  duration: number | null;
  generatedNarrationAssetId: string | null;
  narrationStatus: NarrationJobStatus | null;
  narrationProvider: NarrationProvider | null;
  narrationVoicePackId: string | null;
}

export interface GeneratedAudioGalleryItem {
  job: NarrationJob;
  asset: StudioAsset | null;
  scene: GeneratedNarrationGallerySceneSummary | null;
  project: GeneratedNarrationGalleryProjectSummary | null;
  metadata: Record<string, unknown> | null;
  previewUrl: string | null;
  isCurrentSceneNarration: boolean;
  isSceneEffectiveNarration: boolean;
}

export interface GeneratedNarrationGalleryFilters {
  projectId?: string;
  sceneId?: string;
  provider?: NarrationProvider;
  voicePackId?: string;
  status?: NarrationJobStatus;
}

export interface GenerateNarrationPayload {
  provider: NarrationProvider;
  voicePackId: string | null;
  text: string | null;
  language: string | null;
  autoAttach: boolean;
}

export interface GenerateNarrationResponse {
  job: NarrationJob;
  asset: StudioAsset | null;
  scene: ProjectScene | null;
}

export interface UseNarrationForSceneResponse {
  scene: ProjectScene;
  projectId: string;
  assetId: string;
  selectedJobId: string | null;
}

export const visualReviewStatuses = ["approved", "rejected", "favorite"] as const;

export type VisualReviewStatus = (typeof visualReviewStatuses)[number];

export interface GeneratedImageGalleryProjectSummary {
  id: string;
  title: string;
  status: ProjectStatus;
  channelId: string;
  channelName: string;
  format: string;
  templateId: string | null;
}

export interface GeneratedImageGallerySceneSummary {
  id: string;
  order: number;
  title: string;
  videoProjectId: string;
  captionText: string | null;
  duration: number | null;
  emotion: EmotionTag | null;
  assetId: string | null;
  generatedAssetId: string | null;
  visualSourceMode: VisualSourceMode | null;
  generationStatus: VisualGenerationStatus | null;
  generationProvider: VisualGenerationProvider | null;
}

export interface GeneratedImageGalleryItem {
  job: VisualGenerationJob;
  asset: StudioAsset | null;
  scene: GeneratedImageGallerySceneSummary | null;
  project: GeneratedImageGalleryProjectSummary | null;
  metadata: Record<string, unknown> | null;
  previewUrl: string | null;
  thumbnailUrl: string | null;
  isCurrentSceneGeneratedAsset: boolean;
  isSceneEffectiveAsset: boolean;
  reviewStatus: VisualReviewStatus | null;
  reviewNotes: string | null;
  isFavorite: boolean;
}

export interface GeneratedImageGalleryFilters {
  projectId?: string;
  sceneId?: string;
  characterProfileId?: string;
  workflowPackId?: string;
  qualityPresetId?: string;
  status?: VisualGenerationStatus;
  provider?: VisualGenerationProvider;
  sourceProvider?: string;
}

export interface MarkVisualGenerationJobReviewedPayload {
  reviewStatus: VisualReviewStatus;
  notes: string | null;
}

export interface RegenerateVisualGenerationJobPayload {
  seedMode?: "random" | "fixed" | "reuse" | "increment" | null;
  qualityPresetId?: string | null;
  workflowPackId?: string | null;
}

export interface UseGeneratedImageForSceneResponse {
  scene: ProjectScene;
  projectId: string;
  assetId: string;
  selectedJobId: string | null;
}

export interface GenerateVisualPayload {
  provider: VisualGenerationProvider;
  visualSourceMode: VisualSourceMode | null;
  characterProfileId: string | null;
  workflowPackId: string | null;
  qualityPresetId: string | null;
  workflowId: string | null;
  seedMode: SeedStrategy | null;
  steps: number | null;
  cfg: number | null;
  sampler: string | null;
  scheduler: string | null;
  denoise: number | null;
  width: number;
  height: number;
  seed: number | null;
  autoAttach: boolean;
}

export interface GenerateMissingVisualsPayload extends GenerateVisualPayload {
  maxScenes: number;
}

export interface SceneVisualNeedReportItem {
  sceneId: string;
  order: number;
  title: string;
  hasAsset: boolean;
  usesRepeatedAsset: boolean;
  weakVisual: boolean;
  captionStrength: number;
  narrationStrength: number;
  score: number;
  reasons: string[];
  suggestedVisualSourceMode: VisualSourceMode;
  suggestedTags: string[];
  priority: "low" | "medium" | "high";
  readyForGeneration: boolean;
  currentAssetId: string | null;
  currentAsset: StudioAsset | null;
  suggestedPrompt: string;
  suggestedNegativePrompt: string | null;
  suggestedCharacterProfileId: string | null;
}

export interface ProjectMissingVisualReport {
  projectId: string;
  totalScenes: number;
  scenesWithoutAsset: number;
  scenesWithWeakVisual: number;
  scenesWithRepeatedAssets: number;
  readyForGeneration: boolean;
  items: SceneVisualNeedReportItem[];
}

export interface GenerateSceneVisualResponse {
  job: VisualGenerationJob;
  asset: StudioAsset | null;
}

export type GeneratedVisualResult = GenerateSceneVisualResponse;

export interface GenerateMissingVisualsResponse {
  projectId: string;
  generatedCount: number;
  assetIds: string[];
  sceneIds: string[];
  report: ProjectMissingVisualReport;
  jobs: VisualGenerationJob[];
}

export type MissingVisualReport = ProjectMissingVisualReport;

export interface AudioMoodPresetSummary {
  id: AudioMoodPresetId;
  name: string;
  description: string;
  musicMood: string;
  recommendedMusicVolume: number;
  recommendedSfxVolume: number;
  recommendedVoiceVolume: number;
  fadeInDuration: number;
  fadeOutDuration: number;
  duckingStrategy: "none" | "bed_under_voice";
  energyLevel: number;
}

export interface AudioMixPlanAsset {
  assetId: string;
  filename: string;
  path: string;
  type: string;
  duration: number | null;
  mimeType: string | null;
  extension: string | null;
  exists: boolean;
}

export interface AudioMixPlanTrack {
  asset: AudioMixPlanAsset;
  volume: number;
  fadeInDuration: number;
  fadeOutDuration: number;
  loopToDuration: boolean;
  cutToDuration: boolean;
  duckedByVoiceover: boolean;
  duckedBySceneNarration: boolean;
}

export interface AudioMixPlanSceneNarration {
  sceneId: string;
  sceneOrder: number;
  sceneTitle: string;
  startTime: number;
  duration: number;
  volume: number;
  duckMusicDuringNarration: boolean;
  fadeInDuration: number;
  fadeOutDuration: number;
  source: "generated" | "manual";
  asset: AudioMixPlanAsset;
}

export interface AudioMixPlanSceneSfx {
  sceneId: string;
  sceneOrder: number;
  sceneTitle: string;
  startTime: number;
  volume: number;
  asset: AudioMixPlanAsset;
}

export interface AudioMixPlanSceneClipAudio {
  microclipId: string;
  label: string;
  sceneId: string;
  sceneOrder: number;
  sceneTitle: string;
  startTime: number;
  sourceStartTime: number;
  duration: number;
  volume: number;
  volumeMode: "low_original" | "keep_original";
  narrationOverlay: boolean;
  asset: AudioMixPlanAsset;
}

export interface AudioMixPlanValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface ProjectAudioPlanResponse {
  enabled: boolean;
  hasConfiguredAudio: boolean;
  totalDuration: number;
  mood: AudioMoodPresetSummary | null;
  musicPresetId: string | null;
  musicPreset: MusicPreset | null;
  backgroundMusic: AudioMixPlanTrack | null;
  voiceover: AudioMixPlanTrack | null;
  sceneNarrations: AudioMixPlanSceneNarration[];
  sceneSfx: AudioMixPlanSceneSfx[];
  sceneClipAudio: AudioMixPlanSceneClipAudio[];
  musicVolume: number;
  voiceVolume: number;
  sfxVolume: number;
  enableAudioDucking: boolean;
  duckingLevel: number;
  narrationDucking: {
    enabled: boolean;
    strategy: "none" | "bed_under_voice";
    amount: number;
  };
  sfxCues: BeatSyncSfxCue[];
  microclipBeatSyncStrategy: string | null;
  beatSyncPlan: BeatSyncPlan | null;
  musicWarnings: string[];
  warnings: string[];
  validation: AudioMixPlanValidation;
  summary: string;
}

export interface AssetPayload {
  filename: string;
  originalName: string;
  path: string;
  type: AssetType;
  category: AssetCategory;
  franchise: string | null;
  character: string | null;
  emotion: EmotionTag | null;
  tags: string[];
  licenseType: string;
  copyrightRisk: CopyrightRisk;
  recommendedUse: string | null;
  duration: number | null;
  width: number | null;
  height: number | null;
  mimeType: string | null;
  extension: string | null;
  fileSize: number | null;
  sourceProvider?: string | null;
  sourceUrl?: string | null;
  sourceAuthor?: string | null;
  sourceLicense?: string | null;
  sourceLicenseUrl?: string | null;
  downloadedAt?: string | null;
  collectionId?: string | null;
  usageNotes?: string | null;
}

export const mediaCollectionStatuses = [
  "draft",
  "scanning",
  "ready_for_review",
  "importing",
  "completed",
  "failed"
] as const;

export type MediaCollectionStatus = (typeof mediaCollectionStatuses)[number];

export const mediaCandidateStatuses = [
  "pending",
  "approved",
  "rejected",
  "imported",
  "failed"
] as const;

export type MediaCandidateStatus = (typeof mediaCandidateStatuses)[number];

export const intakeMediaTypes = [
  "image",
  "video",
  "audio",
  "music",
  "sfx",
  "overlay",
  "document",
  "reference"
] as const;

export type IntakeMediaType = (typeof intakeMediaTypes)[number];

export const mediaCollectorProviderIds = [
  "manual-url",
  "wikimedia-commons",
  "nasa-media",
  "internet-archive",
  "pexels",
  "pixabay",
  "unsplash"
] as const;

export type MediaCollectorProviderId =
  (typeof mediaCollectorProviderIds)[number];

export interface MediaCollectorProviderDescriptor {
  id: MediaCollectorProviderId;
  name: string;
  description: string;
  requiresApiKey: boolean;
  apiKeyEnv: string | null;
  configured: boolean;
  experimental: boolean;
  supportedMediaTypes: IntakeMediaType[];
}

export interface MediaCollection {
  id: string;
  name: string;
  channelId: string | null;
  projectId: string | null;
  dossierId: string | null;
  assetRequirementId: string | null;
  provider: string;
  query: string | null;
  sourcePath: string | null;
  mediaType: IntakeMediaType | null;
  status: MediaCollectionStatus;
  targetCount: number | null;
  importedCount: number;
  rejectedCount: number;
  notes: string | null;
  candidateCount: number;
  pendingCount: number;
  approvedCount: number;
  failedCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface MediaCollectionPayload {
  name: string;
  channelId: string | null;
  projectId: string | null;
  dossierId: string | null;
  assetRequirementId: string | null;
  provider: MediaCollectorProviderId;
  query: string | null;
  targetCount: number | null;
  mediaType: IntakeMediaType | null;
  notes: string | null;
}

export interface MediaCandidate {
  id: string;
  collectionId: string;
  provider: string;
  originalPath: string | null;
  title: string;
  previewUrl: string | null;
  downloadUrl: string | null;
  sourceUrl: string | null;
  sourceAuthor: string | null;
  sourceLicense: string | null;
  sourceLicenseUrl: string | null;
  mediaType: IntakeMediaType;
  detectedType: string | null;
  suggestedCategory: AssetCategory | null;
  suggestedTags: string[];
  suggestedCharacter: string | null;
  suggestedProject: string | null;
  width: number | null;
  height: number | null;
  duration: number | null;
  fileSize: number | null;
  extension: string | null;
  mimeType: string | null;
  category: AssetCategory | null;
  franchise: string | null;
  character: string | null;
  emotion: EmotionTag | null;
  tags: string[];
  copyrightRisk: CopyrightRisk | null;
  recommendedUse: string | null;
  usageNotes: string | null;
  status: MediaCandidateStatus;
  assetId: string | null;
  errorMessage: string | null;
  contentHash: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface IntakeCollectionDetail {
  collection: MediaCollection;
  candidates: MediaCandidate[];
}

export interface IntakeCandidateFilters {
  collectionId?: string;
  status?: MediaCandidateStatus;
  provider?: string;
  mediaType?: IntakeMediaType;
  category?: AssetCategory;
  character?: string;
  suggestedProject?: string;
}

export interface IntakeCandidatePayload {
  previewUrl?: string | null;
  downloadUrl?: string | null;
  sourceUrl?: string | null;
  sourceAuthor?: string | null;
  sourceLicense?: string | null;
  sourceLicenseUrl?: string | null;
  mediaType?: IntakeMediaType;
  detectedType?: string | null;
  suggestedCategory?: AssetCategory | null;
  suggestedTags?: string[];
  suggestedCharacter?: string | null;
  suggestedProject?: string | null;
  width?: number | null;
  height?: number | null;
  duration?: number | null;
  fileSize?: number | null;
  extension?: string | null;
  mimeType?: string | null;
  category?: AssetCategory | null;
  franchise?: string | null;
  character?: string | null;
  emotion?: EmotionTag | null;
  tags?: string[];
  copyrightRisk?: CopyrightRisk | null;
  recommendedUse?: string | null;
  usageNotes?: string | null;
  status?: MediaCandidateStatus;
  assetId?: string | null;
  errorMessage?: string | null;
  contentHash?: string | null;
}

export interface ManualUrlCandidatePayload {
  collectionId: string | null;
  name: string | null;
  channelId: string | null;
  projectId: string | null;
  dossierId: string | null;
  assetRequirementId: string | null;
  title: string;
  sourceUrl: string;
  mediaType: IntakeMediaType;
  category: AssetCategory | null;
  franchise: string | null;
  character: string | null;
  emotion: EmotionTag | null;
  tags: string[];
  copyrightRisk: CopyrightRisk | null;
  recommendedUse: string | null;
  sourceAuthor: string | null;
  sourceLicense: string | null;
  sourceLicenseUrl: string | null;
  usageNotes: string | null;
}

export interface IntakeFolderDescriptor {
  id: string;
  label: string;
  relativePath: string;
  absolutePath: string;
}

export interface IntakeFoldersResponse {
  rootPath: string;
  folders: IntakeFolderDescriptor[];
}

export interface IntakeImportError {
  candidateId: string;
  title: string;
  message: string;
}

export interface ImportApprovedResponse {
  collectionIds: string[];
  candidateIds: string[];
  assetIds: string[];
  importedCount: number;
  failedCount: number;
  errors: IntakeImportError[];
}

export interface MediaCollectionSearchResponse {
  collectionId: string;
  candidatesCreated: number;
  candidatesSkipped: number;
}

export type ResearchRequirementCollectionCreateResponse = MediaCollection;

export interface ResearchDossierCollectionsCreateResponse {
  dossierId: string;
  createdCount: number;
  collectionIds: string[];
  collections: MediaCollection[];
}

export interface ProjectMissingAssetCollectionsResponse {
  projectId: string;
  missingSceneCount: number;
  collectionsCreated: number;
  collectionIds: string[];
}

export const researchDossierStatuses = [
  'draft',
  'researching',
  'ready_for_review',
  'completed',
  'failed'
] as const;

export type ResearchDossierStatus = (typeof researchDossierStatuses)[number];

export const researchSourceTypes = [
  'web_page',
  'wikipedia',
  'wikidata',
  'archive',
  'document',
  'manual_note',
  'book',
  'article',
  'official_record',
  'other'
] as const;

export type ResearchSourceType = (typeof researchSourceTypes)[number];

export const researchSourceStatuses = [
  'candidate',
  'approved',
  'rejected',
  'imported',
  'failed'
] as const;

export type ResearchSourceStatus = (typeof researchSourceStatuses)[number];

export const researchFactTypes = [
  'date',
  'person',
  'place',
  'event',
  'quote',
  'context',
  'statistic',
  'allegation',
  'uncertainty',
  'other'
] as const;

export type ResearchFactType = (typeof researchFactTypes)[number];

export const researchConfidenceLevels = [
  'confirmed',
  'likely',
  'disputed',
  'uncertain'
] as const;

export type ResearchConfidence = (typeof researchConfidenceLevels)[number];

export const researchHookTypes = [
  'mystery',
  'shock',
  'question',
  'contrast',
  'timeline',
  'character',
  'revelation',
  'warning',
  'other'
] as const;

export type ResearchHookType = (typeof researchHookTypes)[number];

export const researchAssetMediaTypes = [
  'image',
  'video',
  'audio',
  'music',
  'sfx',
  'overlay',
  'document',
  'map',
  'text_card'
] as const;

export type ResearchAssetMediaType =
  (typeof researchAssetMediaTypes)[number];

export const researchOutlineRoles = [
  'hook',
  'context',
  'tension',
  'climax',
  'resolution',
  'cta'
] as const;

export type ResearchOutlineRole = (typeof researchOutlineRoles)[number];

export interface ResearchLinkedMediaCollection {
  id: string;
  name: string;
  provider: string;
  query: string | null;
  mediaType: string | null;
  status: string;
  targetCount: number | null;
  importedCount: number;
  rejectedCount: number;
  createdAt: string;
  updatedAt: string;
}
export interface ResearchDossier {
  id: string;
  channelId: string | null;
  channel: StudioChannel | null;
  title: string;
  topic: string;
  niche: string | null;
  tone: string | null;
  targetDuration: number | null;
  status: ResearchDossierStatus;
  summary: string | null;
  narrativeAngle: string | null;
  editorialNotes: string | null;
  safetyNotes: string | null;
  sourceCount: number;
  approvedSourceCount: number;
  factCount: number;
  timelineCount: number;
  outlineSceneCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ResearchSource {
  id: string;
  dossierId: string;
  title: string;
  url: string | null;
  provider: string;
  sourceType: ResearchSourceType;
  author: string | null;
  publishedAt: string | null;
  accessedAt: string | null;
  reliabilityScore: number | null;
  citationText: string | null;
  rawTextPath: string | null;
  excerpt: string | null;
  notes: string | null;
  status: ResearchSourceStatus;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ResearchFact {
  id: string;
  dossierId: string;
  sourceId: string | null;
  claim: string;
  factType: ResearchFactType;
  confidence: ResearchConfidence;
  dateValue: string | null;
  people: string[];
  places: string[];
  tags: string[];
  notes: string | null;
  source: ResearchSource | null;
  createdAt: string;
  updatedAt: string;
}

export interface ResearchTimelineEvent {
  id: string;
  dossierId: string;
  sourceId: string | null;
  title: string;
  description: string;
  dateValue: string | null;
  order: number | null;
  location: string | null;
  people: string[];
  confidence: ResearchConfidence;
  source: ResearchSource | null;
  createdAt: string;
  updatedAt: string;
}

export interface ResearchHook {
  id: string;
  dossierId: string;
  text: string;
  hookType: ResearchHookType;
  strengthScore: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ResearchAssetRequirement {
  id: string;
  dossierId: string;
  sceneRole: ResearchOutlineRole | null;
  description: string;
  mediaType: ResearchAssetMediaType;
  suggestedTags: string[];
  emotion: EmotionTag | null;
  priority: number | null;
  fulfilledAssetId: string | null;
  fulfilledAsset: StudioAsset | null;
  visualSourceMode?: VisualSourceMode | null;
  characterProfileId?: string | null;
  generatedAssetId?: string | null;
  generatedAsset?: StudioAsset | null;
  visualPrompt?: string | null;
  generationStatus?: VisualGenerationStatus | null;
  generationProvider?: VisualGenerationProvider | null;
  mediaCollections?: ResearchLinkedMediaCollection[];
  createdAt: string;
  updatedAt: string;
}

export interface ResearchOutlineScene {
  id: string;
  dossierId: string;
  order: number;
  role: ResearchOutlineRole;
  title: string;
  narrationDraft: string;
  captionDraft: string | null;
  emotion: EmotionTag | null;
  visualPreset: string | null;
  assetRequirementId: string | null;
  assetRequirement: ResearchAssetRequirement | null;
  estimatedDuration: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface ResearchDossierDetail {
  dossier: ResearchDossier;
  sources: ResearchSource[];
  facts: ResearchFact[];
  timeline: ResearchTimelineEvent[];
  hooks: ResearchHook[];
  assetRequirements: ResearchAssetRequirement[];
  outline: ResearchOutlineScene[];
}

export interface ResearchDossierPayload {
  channelId: string | null;
  title: string;
  topic: string;
  niche: string | null;
  tone: string | null;
  targetDuration: number | null;
  status: ResearchDossierStatus;
  summary?: string | null;
  narrativeAngle?: string | null;
  editorialNotes?: string | null;
  safetyNotes?: string | null;
}

export interface ManualResearchSourcePayload {
  title: string;
  url: string | null;
  provider: string | null;
  sourceType: ResearchSourceType;
  author: string | null;
  publishedAt: string | null;
  citationText: string | null;
  excerpt: string | null;
  notes: string | null;
  reliabilityScore: number | null;
}

export interface ResearchFetchUrlPayload {
  url: string;
  title: string | null;
  notes: string | null;
}

export interface ResearchConnectorSearchPayload {
  query: string | null;
  limit: number;
}

export interface ResearchSearchQuerySuggestion {
  id: string;
  query: string;
  reason: string;
}

export interface ResearchSearchLinkSuggestion {
  provider: "google";
  label: string;
  query: string;
  url: string;
}

export interface ResearchSourceChecklistItem {
  id: string;
  label: string;
  reason: string;
  priority: "high" | "medium" | "low";
}

export interface ResearchSearchBundleResponse {
  dossierId: string;
  queries: ResearchSearchQuerySuggestion[];
  links: ResearchSearchLinkSuggestion[];
  checklist: ResearchSourceChecklistItem[];
}

export interface ResearchSearchCandidatesResponse {
  dossierId: string;
  createdSources: ResearchSource[];
  warning: string | null;
}

export interface ResearchAnalyzeResponse {
  dossierId: string;
  approvedSourceCount: number;
  factCount: number;
  timelineCount: number;
  hookCount: number;
  assetRequirementCount: number;
  outlineSceneCount: number;
  safetyWarnings: string[];
  detail: ResearchDossierDetail;
}

export interface ResearchCreateProductionPayload {
  title: string | null;
  status: ProjectStatus;
  format: string;
}

export interface ResearchCreateProductionResponse {
  dossierId: string;
  projectId: string;
  scenesCreated: number;
  project: StudioProject;
  defaultsApplied: string[];
  checklist: ProductionChecklistSummary;
}

export interface ProjectPayload {
  title: string;
  status: ProjectStatus;
  channelId: string;
  script: string | null;
  durationTarget: number | null;
  format: string;
  templateId?: string | null;
  editingReferencePresetId?: string | null;
  editingStyleSummary?: EditingStyleSummary | null;
  defaultCaptionStyle?: string | null;
  backgroundMusicAssetId?: string | null;
  musicPresetId?: string | null;
  voiceoverAssetId?: string | null;
  audioMood?: AudioMoodPresetId | null;
  musicVolume?: number | null;
  voiceVolume?: number | null;
  sfxVolume?: number | null;
  enableAudioDucking?: boolean | null;
  duckingLevel?: number | null;
}

export interface ProjectScene {
  id: string;
  order: number;
  title: string;
  narrationText: string | null;
  captionText: string | null;
  duration: number | null;
  emotion: EmotionTag | null;
  assetId: string | null;
  asset: StudioAsset | null;
  generatedAssetId?: string | null;
  generatedAsset?: StudioAsset | null;
  generatedNarrationAssetId?: string | null;
  generatedNarrationAsset?: StudioAsset | null;
  characterProfileId?: string | null;
  sfxAssetId?: string | null;
  sfxStartTime?: number | null;
  sfxVolume?: number | null;
  visualPreset: string | null;
  visualSourceMode?: VisualSourceMode | null;
  visualPrompt?: string | null;
  negativePrompt?: string | null;
  visualRecipe?: string | null;
  generationStatus?: VisualGenerationStatus | null;
  generationProvider?: VisualGenerationProvider | null;
  generationSeed?: number | null;
  transition: string | null;
  captionStyle: string | null;
  captionPosition: CaptionPosition | null;
  captionEmphasisWords: string[];
  energyLevel: number | null;
  narrationStatus?: NarrationJobStatus | null;
  narrationProvider?: NarrationProvider | null;
  narrationVoicePackId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export const narrativeSceneRoles = [
  "hook",
  "context",
  "tension",
  "climax",
  "resolution",
  "cta"
] as const;

export type NarrativeSceneRole = (typeof narrativeSceneRoles)[number];

export interface ScenePayload {
  order?: number;
  title: string;
  narrationText: string | null;
  captionText: string | null;
  duration: number | null;
  emotion: EmotionTag | null;
  assetId: string | null;
  generatedAssetId?: string | null;
  generatedNarrationAssetId?: string | null;
  characterProfileId?: string | null;
  sfxAssetId?: string | null;
  sfxStartTime?: number | null;
  sfxVolume?: number | null;
  visualPreset: string | null;
  visualSourceMode?: VisualSourceMode | null;
  visualPrompt?: string | null;
  negativePrompt?: string | null;
  visualRecipe?: string | null;
  generationStatus?: VisualGenerationStatus | null;
  generationProvider?: VisualGenerationProvider | null;
  generationSeed?: number | null;
  transition: string | null;
  captionStyle: string | null;
  captionPosition: CaptionPosition | null;
  captionEmphasisWords: string[];
  energyLevel: number | null;
  narrationStatus?: NarrationJobStatus | null;
  narrationProvider?: NarrationProvider | null;
  narrationVoicePackId?: string | null;
}

export const editorialMicroclipSourceTypes = [
  "local_clip",
  "uploaded_clip",
  "library_clip"
] as const;

export type EditorialMicroclipSourceType =
  (typeof editorialMicroclipSourceTypes)[number];

export const editorialMicroclipUsageModes = [
  "supporting_evidence",
  "impact_moment",
  "quick_reference"
] as const;

export type EditorialMicroclipUsageMode =
  (typeof editorialMicroclipUsageModes)[number];

export const editorialMicroclipCalloutStyles = [
  "none",
  "minimal",
  "bold"
] as const;

export type EditorialMicroclipCalloutStyle =
  (typeof editorialMicroclipCalloutStyles)[number];

export const editorialMicroclipTransitions = [
  "cut",
  "flash",
  "whoosh"
] as const;

export type EditorialMicroclipTransition =
  (typeof editorialMicroclipTransitions)[number];

export const editorialMicroclipVolumeModes = [
  "mute_original",
  "low_original",
  "keep_original"
] as const;

export type EditorialMicroclipVolumeMode =
  (typeof editorialMicroclipVolumeModes)[number];

export interface EditorialMicroclip {
  id: string;
  projectId: string;
  sceneId: string | null;
  assetId: string;
  asset: StudioAsset | null;
  label: string;
  sourceType: EditorialMicroclipSourceType;
  startTimeSeconds: number;
  endTimeSeconds: number;
  durationSeconds: number;
  usageMode: EditorialMicroclipUsageMode;
  narrationOverlay: boolean;
  textOverlay: string | null;
  calloutStyle: EditorialMicroclipCalloutStyle;
  transitionIn: EditorialMicroclipTransition;
  transitionOut: EditorialMicroclipTransition;
  volumeMode: EditorialMicroclipVolumeMode;
  orderIndex: number;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface EditorialMicroclipPayload {
  projectId: string;
  sceneId: string | null;
  assetId: string;
  label: string;
  sourceType?: EditorialMicroclipSourceType;
  startTimeSeconds: number;
  endTimeSeconds: number;
  usageMode: EditorialMicroclipUsageMode;
  narrationOverlay: boolean;
  textOverlay: string | null;
  calloutStyle: EditorialMicroclipCalloutStyle;
  transitionIn: EditorialMicroclipTransition;
  transitionOut: EditorialMicroclipTransition;
  volumeMode: EditorialMicroclipVolumeMode;
  orderIndex: number;
  metadata?: Record<string, unknown> | null;
}

export interface MicroclipSelectorCandidate {
  id: string;
  assetId: string;
  startTimeSeconds: number;
  endTimeSeconds: number;
  durationSeconds: number;
  score: number;
  reasons: string[];
  usageMode: EditorialMicroclipUsageMode;
  recommendedTextOverlay: string | null;
  recommendedTransitionIn: EditorialMicroclipTransition;
  recommendedTransitionOut: EditorialMicroclipTransition;
  recommendedVolumeMode: EditorialMicroclipVolumeMode;
}

export interface MicroclipSelectorAnalyzePayload {
  assetId: string;
  targetDurationSeconds: number;
  topN: number;
  useCase: string;
  preset: string;
}

export interface MicroclipSelectorAnalyzeResponse {
  assetId: string;
  durationSeconds: number;
  targetDurationSeconds: number;
  candidates: MicroclipSelectorCandidate[];
  warnings: string[];
}

export interface MicroclipSelectorApplyPayload {
  projectId: string;
  sceneId: string | null;
  assetId: string;
  candidateId: string;
  label: string | null;
  usageMode: EditorialMicroclipUsageMode | null;
}

export interface MicroclipSelectorApplyResponse {
  microclip: EditorialMicroclip;
  candidate: MicroclipSelectorCandidate;
  warnings: string[];
}

export interface SceneReorderPayload {
  sceneIds: string[];
}

export interface StorySuggestedSceneRole {
  sceneId: string;
  order: number;
  role: NarrativeSceneRole;
  energyScore: number;
  reason: string;
}

export interface StoryAnalysisSummary {
  projectId: string;
  totalDuration: number;
  sceneCount: number;
  missingAssets: number;
  missingVisuals?: number;
  visualReadyScenes?: number;
  missingCaptions: number;
  openingStrength: number;
  openingStrengthLabel: string;
  climaxDetected: boolean;
  ctaDetected: boolean;
  averageSceneDuration: number;
  rhythmLabel: string;
  pacingWarnings: string[];
  alerts: string[];
  suggestedSceneRoles: StorySuggestedSceneRole[];
  analysisMode: "deterministic-local-rules";
}

export interface ProjectStorySceneInsight {
  sceneId: string;
  order: number;
  title: string;
  emotion: EmotionTag | null;
  role: NarrativeSceneRole;
  energyScore: number;
  reason: string;
  suggestedPresetId: CinematicPresetId;
  suggestedPreset: CinematicPresetSummary;
  appliedPresetId: CinematicPresetId | null;
  appliedPreset: CinematicPresetSummary | null;
  effectivePresetId: CinematicPresetId;
  effectivePreset: CinematicPresetSummary;
}

export interface ProjectStoryAnalysisResponse {
  projectId: string;
  analysis: StoryAnalysisSummary;
  sceneInsights: ProjectStorySceneInsight[];
}

export interface ProductionChecklistItem {
  id: string;
  label: string;
  done: boolean;
  detail: string;
}

export interface ProductionChecklistSummary {
  projectId: string;
  totalScenes: number;
  totalDuration: number;
  missingAssets: number;
  missingVisuals?: number;
  visualReadyScenes?: number;
  generatedVisualScenes?: number;
  missingCaptions: number;
  missingVisualPresets: number;
  missingDurations: number;
  firstSceneOverFiveSeconds: boolean;
  climaxDetected: boolean;
  ctaDetected: boolean;
  readinessScore: number;
  readyToRender: boolean;
  recommendedRenderMode: RenderMode;
  recommendedRenderQuality: RenderQuality;
  alerts: string[];
  warnings: string[];
  suggestions: string[];
  checklist: ProductionChecklistItem[];
}

export interface ProjectProductionChecklistResponse {
  projectId: string;
  checklist: ProductionChecklistSummary;
}

export interface ScriptSceneDraft {
  id: string;
  order: number;
  title: string;
  narrationText: string;
  captionText: string;
  captionStyle: string | null;
  duration: number;
  emotion: EmotionTag | null;
  suggestedRole: NarrativeSceneRole;
  suggestedPresetId: CinematicPresetId;
  energyLevel: number;
  transitionHint: string;
}

export interface AssetSuggestionMatch {
  assetId: string;
  score: number;
  reasons: string[];
  matchedTags: string[];
  matchedCategories: string[];
  asset: StudioAsset | null;
}

export interface ProjectSceneAssetSuggestions {
  sceneId: string;
  order: number;
  title: string;
  emotion: EmotionTag | null;
  currentAssetId: string | null;
  currentAsset: StudioAsset | null;
  hasEffectiveVisual?: boolean;
  effectiveAssetId?: string | null;
  effectiveAssetSource?: "base" | "generated" | "fallback" | "missing";
  generatedVisualReady?: boolean;
  suggestions: AssetSuggestionMatch[];
}

export interface ProjectAssetSuggestionsResponse {
  projectId: string;
  channelId: string;
  scenes: ProjectSceneAssetSuggestions[];
}

export interface ApplyChannelDefaultsResponse {
  project: StudioProject;
  projectFieldsApplied: string[];
  scenesUpdated: number;
  checklist: ProductionChecklistSummary;
}

export interface CreateProductionFromScriptPayload {
  title: string;
  channelId: string;
  script: string;
  durationTarget: number | null;
  sceneDuration: number | null;
  format: string;
  status: ProjectStatus;
  autoCreateScenes?: boolean;
  autoSuggestAssets?: boolean;
  applyChannelDefaults?: boolean;
  autoAssignAssets?: boolean;
}

export interface CreateProductionFromScriptResponse {
  project: StudioProject;
  checklist: ProductionChecklistSummary;
  scenesCreated: number;
  autoAssignedAssets: number;
  scenes: Array<{
    sceneId: string;
    draft: ScriptSceneDraft;
    selectedAssetId: string | null;
    suggestions: AssetSuggestionMatch[];
  }>;
}

export interface CaptionQualityAnalysis {
  characters: number;
  words: number;
  duration: number;
  estimatedCharactersPerSecond: number;
  readingSpeedStatus: "slow" | "good" | "fast" | "too_fast";
  lineWarnings: string[];
  durationWarnings: string[];
  impactScore: number;
  suggestions: string[];
}

export interface ResolvedProjectTemplate {
  configuredTemplateId: string | null;
  template: ReelTemplateSummary;
  source: "project" | "channel" | "suggested";
}

export interface ResolvedCaptionStyle {
  configuredStyleId: string | null;
  projectDefaultStyleId: string | null;
  templateSuggestedStyleId: CaptionStyleId;
  emotionSuggestedStyleId: CaptionStyleId;
  style: CaptionStyleSummary;
  source: "scene" | "project" | "template" | "emotion";
}

export interface ProjectCaptionAnalysisScene {
  sceneId: string;
  order: number;
  title: string;
  captionText: string | null;
  duration: number | null;
  splitLines: string[];
  quality: CaptionQualityAnalysis;
  suggestedByTemplate: CaptionStyleSummary;
  suggestedByEmotion: CaptionStyleSummary;
  resolvedStyle: ResolvedCaptionStyle;
}

export interface ProjectCaptionAnalysisSummary {
  sceneCount: number;
  scenesWithCaptions: number;
  scenesWithoutCaptions: number;
  tooFastScenes: number;
  scenesWithWarnings: number;
  averageImpactScore: number;
  alerts: string[];
}

export interface ProjectCaptionAnalysisResponse {
  projectId: string;
  template: ResolvedProjectTemplate;
  defaultCaptionStyle: CaptionStyleSummary;
  summary: ProjectCaptionAnalysisSummary;
  scenes: ProjectCaptionAnalysisScene[];
}

export interface ResolvedScenePreset {
  configuredPresetId: string | null;
  templateSuggestedPresetId: CinematicPresetId;
  emotionSuggestedPresetId: CinematicPresetId;
  preset: CinematicPresetSummary;
  source: "scene" | "template" | "emotion";
}

export interface RenderBlueprintAsset {
  id: string;
  filename: string;
  originalName: string;
  path: string;
  type: string;
  category: string;
  franchise: string | null;
  character: string | null;
  emotion: string | null;
  duration: number | null;
  width: number | null;
  height: number | null;
  mimeType: string | null;
  extension: string | null;
  sourceProvider?: string | null;
}

export type RenderBlueprintEffectiveSource =
  | "asset"
  | "generated"
  | "fallback_generated"
  | "placeholder"
  | "project_asset"
  | "generated_asset"
  | "missing"
  | "library"
  | "none";

export interface RenderBlueprintScene {
  sceneId: string;
  order: number;
  title: string;
  narrationText: string | null;
  captionText: string | null;
  captionPreviewLines: string[];
  duration: number | null;
  emotion: EmotionTag | null;
  energyLevel: number;
  assetId?: string | null;
  asset: RenderBlueprintAsset | null;
  generatedAssetId?: string | null;
  generatedAsset?: RenderBlueprintAsset | null;
  generatedNarrationAssetId?: string | null;
  generatedNarrationAsset?: RenderBlueprintAsset | null;
  effectiveAssetId: string | null;
  effectiveAssetPath: string | null;
  effectiveAsset: RenderBlueprintAsset | null;
  effectiveNarrationAssetId: string | null;
  effectiveNarrationAssetPath: string | null;
  effectiveNarrationAsset: RenderBlueprintAsset | null;
  narrationSource: "generated" | "manual" | "missing";
  effectiveNarrationSource: "generated" | "manual" | "missing";
  narrationReady: boolean;
  narrationDurationSeconds: number | null;
  narrationStatus?: NarrationJobStatus | null;
  narrationProvider?: NarrationProvider | null;
  narrationVoicePackId?: string | null;
  effectiveVisualSource?: RenderBlueprintEffectiveSource;
  effectiveAssetSource: RenderBlueprintEffectiveSource;
  effectiveAssetReason?: string | null;
  visualSourceMode?: VisualSourceMode | null;
  renderReadyVisual?: boolean;
  suggestedShotDurationSeconds?: number | null;
  suggestedMicroclipPlacement?: EditingReferenceMicroclipPlacement | null;
  suggestedIntensity?: EditingReferenceBeatIntensity | null;
  transition: string;
  visualPreset: ResolvedScenePreset;
  captionStyle: ResolvedCaptionStyle & {
    effectivePosition: CaptionPosition;
    emphasisWords: string[];
  };
  storyRole: NarrativeSceneRole;
  storyReason: string;
  readingSpeedStatus: CaptionQualityAnalysis["readingSpeedStatus"];
  editorialMicroclips: RenderBlueprintEditorialMicroclip[];
  warnings: string[];
  ready: boolean;
}

export interface RenderBlueprintSummary {
  durationTotal: number;
  sceneCount: number;
  readyScenes: number;
  scenesWithProblems: number;
  templateId: string;
  defaultCaptionStyleId: CaptionStyleId;
  hasEditorialMicroclips: boolean;
  microclipCount: number;
  totalMicroclipDurationSeconds: number;
}

export interface RenderBlueprintEditorialMicroclip {
  microclipId: string;
  assetId: string;
  assetPath: string | null;
  asset: RenderBlueprintAsset | null;
  label: string;
  startTimeSeconds: number;
  endTimeSeconds: number;
  durationSeconds: number;
  usageMode: EditorialMicroclipUsageMode;
  narrationOverlay: boolean;
  textOverlay: string | null;
  calloutStyle: EditorialMicroclipCalloutStyle;
  transitionIn: EditorialMicroclipTransition;
  transitionOut: EditorialMicroclipTransition;
  volumeMode: EditorialMicroclipVolumeMode;
  orderIndex: number;
  insertStartSeconds: number;
  insertEndSeconds: number;
  metadata: Record<string, unknown> | null;
}

export interface RenderBlueprintResponse {
  projectId: string;
  title: string;
  status: string;
  format: "vertical_9_16";
  sourceFormat: string;
  channel: StudioChannel;
  template: ResolvedProjectTemplate;
  defaultCaptionStyle: CaptionStyleSummary;
  storyAnalysis: StoryAnalysisSummary;
  captionAnalysis: ProjectCaptionAnalysisSummary;
  resolution: {
    width: 1080;
    height: 1920;
  };
  fps: 30;
  durationTotal: number;
  sceneCount: number;
  hasEditorialMicroclips: boolean;
  microclipCount: number;
  totalMicroclipDurationSeconds: number;
  editingReferencePresetId?: string | null;
  editingReferencePresetName?: string | null;
  editingStyleSummary?: EditingStyleSummary | null;
  selectedMusicAssetId?: string | null;
  selectedMusicAssetPath?: string | null;
  musicPresetId?: string | null;
  musicLicenseStatus?: AudioLicenseStatus | null;
  beatSyncPlan?: BeatSyncPlan | null;
  sfxCueCount?: number;
  musicWarnings?: string[];
  audio: ProjectAudioPlanResponse;
  summary: RenderBlueprintSummary;
  subtitleExports: {
    srt: string;
    ass: string;
  };
  scenes: RenderBlueprintScene[];
}

export const renderJobStatuses = [
  "queued",
  "processing",
  "completed",
  "failed",
  "cancelled"
] as const;

export type RenderJobStatus = (typeof renderJobStatuses)[number];

export const renderJobSteps = [
  "reading_blueprint",
  "generating_subtitles",
  "rendering_scene",
  "concatenating_segments",
  "burning_subtitles",
  "preparing_audio",
  "mixing_audio",
  "probing_audio",
  "generating_thumbnail",
  "probing_output",
  "completed"
] as const;

export type RenderJobStep = (typeof renderJobSteps)[number];

export const renderModes = ["v1", "cinematic_v2"] as const;

export type RenderMode = (typeof renderModes)[number];

export const renderQualities = ["draft", "standard", "high"] as const;

export type RenderQuality = (typeof renderQualities)[number];

export interface RenderJobProjectSummary {
  id: string;
  title: string;
  status: ProjectStatus;
  channelId: string;
  format: string;
}

export interface StudioRenderJob {
  id: string;
  videoProjectId: string;
  status: RenderJobStatus;
  renderMode: RenderMode;
  renderQuality: RenderQuality;
  outputPath: string | null;
  blueprintPath: string | null;
  srtPath: string | null;
  assPath: string | null;
  logPath: string | null;
  errorMessage: string | null;
  progress: number | null;
  currentStep: RenderJobStep | null;
  currentSceneIndex: number | null;
  totalScenes: number | null;
  outputWidth: number | null;
  outputHeight: number | null;
  outputDuration: number | null;
  outputCodec: string | null;
  hasAudio: boolean | null;
  audioCodec: string | null;
  audioChannels: number | null;
  audioSampleRate: number | null;
  audioMasteringPresetId: AudioMasteringPresetId | null;
  metadata: {
    audioMasteringPresetId: AudioMasteringPresetId;
    audioQualityReport?: AudioQualityReport | null;
    hasEditorialMicroclips?: boolean;
    microclipCount?: number;
    totalMicroclipDurationSeconds?: number;
  } | null;
  outputFileSize: number | null;
  thumbnailPath: string | null;
  cancelledAt: string | null;
  retriedFromJobId: string | null;
  attempt: number;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  mediaUrl: string | null;
  logUrl: string | null;
  thumbnailUrl: string | null;
  videoProject: RenderJobProjectSummary;
}

export interface CreateRenderJobPayload {
  renderMode?: RenderMode;
  renderQuality?: RenderQuality;
  audioMasteringPresetId?: AudioMasteringPresetId;
}

export type ReelProductionRunStatus =
  | "draft"
  | "running"
  | "completed"
  | "failed"
  | "partial"
  | "cancelled";

export type ReelProductionRunMode = "dry_run" | "prepare_only" | "render";

export type ReelProductionStepStatus =
  | "pending"
  | "running"
  | "completed"
  | "skipped"
  | "failed";

export interface ReelProductionStep {
  id: string;
  label: string;
  status: ReelProductionStepStatus;
  message: string;
  entityIds: Record<string, string | string[] | null>;
  startedAt: string | null;
  completedAt: string | null;
}

export interface ReelProductionSceneChecklist {
  sceneId: string;
  order: number;
  title: string;
  narrationReady: boolean;
  visualReady: boolean;
  microclipCount: number;
  effectiveAssetId: string | null;
  effectiveNarrationAssetId: string | null;
  warnings: string[];
}

export interface ReelProductionChecklist {
  projectId: string;
  scenesTotal: number;
  scenesWithNarration: number;
  scenesWithVisual: number;
  scenesWithMicroclips: number;
  hasMusic: boolean;
  hasBeatSyncPlan: boolean;
  hasEditingReferencePreset: boolean;
  hasAudioMasteringPreset: boolean;
  renderReady: boolean;
  missingItems: string[];
  scenes: ReelProductionSceneChecklist[];
  warnings: string[];
  nextActions: string[];
}

export interface ReelProductionRun {
  id: string;
  videoProjectId: string;
  status: ReelProductionRunStatus;
  mode: ReelProductionRunMode;
  steps: ReelProductionStep[];
  startedAt: string | null;
  completedAt: string | null;
  errorMessage: string | null;
  renderJobId: string | null;
  outputPath: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface OneClickProductionPayload {
  mode: ReelProductionRunMode;
  providerStrategy?: {
    visualProvider?: string | null;
    fallbackVisualProvider?: string | null;
    narrationProvider?: string | null;
  };
  defaults?: {
    voicePackId?: string | null;
    musicPresetId?: string | null;
    audioMasteringPresetId?: string | null;
    qualityPresetId?: string | null;
    workflowPackId?: string | null;
  };
  options?: {
    generateMissingNarration?: boolean;
    generateMissingVisuals?: boolean;
    selectMusic?: boolean;
    buildBeatSyncPlan?: boolean;
    useEditorialMicroclips?: boolean;
    createRenderJob?: boolean;
    runRender?: boolean;
  };
}

export interface OneClickProductionResponse {
  runId: string;
  status: ReelProductionRunStatus;
  steps: ReelProductionStep[];
  projectId: string;
  renderJobId: string | null;
  outputPath: string | null;
  checklist: ReelProductionChecklist;
  warnings: string[];
  nextActions: string[];
}

export interface StudioProject {
  id: string;
  title: string;
  status: ProjectStatus;
  channelId: string;
  channel: StudioChannel;
  script: string | null;
  durationTarget: number | null;
  format: string;
  templateId?: string | null;
  editingReferencePresetId?: string | null;
  editingStyleSummary?: EditingStyleSummary | null;
  defaultCaptionStyle?: string | null;
  backgroundMusicAssetId?: string | null;
  musicPresetId?: string | null;
  voiceoverAssetId?: string | null;
  audioMood?: AudioMoodPresetId | null;
  musicVolume?: number | null;
  voiceVolume?: number | null;
  sfxVolume?: number | null;
  enableAudioDucking?: boolean | null;
  duckingLevel?: number | null;
  createdAt: string;
  updatedAt: string;
  scenes: ProjectScene[];
}

export type ComfyProviderStatus = ComfyUiProviderStatus;
export type ComfyWorkflowValidation = ComfyWorkflowValidationResult;
export type VisualGenerationProviderStatus =
  VisualGenerationProviderDescriptor;

export interface DashboardSnapshot {
  channels: StudioChannel[];
  assets: StudioAsset[];
  projects: StudioProject[];
  renders: StudioRenderJob[];
  sources: {
    channels: DataSource;
    assets: DataSource;
    projects: DataSource;
    renders: DataSource;
  };
}

