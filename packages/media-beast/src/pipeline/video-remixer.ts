import { access } from "node:fs/promises";
import { basename, resolve } from "node:path";
import {
  analyzeCaptionQuality,
  getCaptionStyleById,
  suggestCaptionStyleByEmotion,
  type CaptionEmotionTag,
  type CaptionStyle
} from "@reelforge/caption-engine";
import {
  buildCinematicProfile,
  describePresetMotion,
  getCinematicPresetById,
  suggestPresetForEmotion,
  type CinematicPreset,
  type CinematicProfile,
  type PresetEmotionTag
} from "@reelforge/cinematic-engine";
import { getMusicPresetById } from "@reelforge/audio-engine";
import type { MediaBeastCandidate } from "../providers/types.js";
import { createChannelDNA, type ChannelDNA } from "../scheduler/channel-dna.js";
import { buildPremiumAudioScorePlan, type PremiumAudioScorePlan } from "./audio-score-planner.js";
import {
  type RemixVideoDownloadOptions,
  type RemixVideoDownloadResult,
  type RemixVideoPlatform,
  resolveRemixVideoInput
} from "./remix-video-downloader.js";
import { buildFastCutEditorPlan, type FastCutEditorPlan } from "./fast-cut-editor.js";
import type { NarrationOverlayPlan } from "./narration-overlay.js";
import {
  buildRemixAssetDiscoveryPlan,
  discoverRemixAssetCandidates,
  type RemixAssetDiscoveryPlan
} from "./remix-asset-discovery.js";
import {
  enrichCandidateWithContentIntelligence,
  type RemixContentDomain
} from "./remix-content-intelligence.js";
import { buildRemixNarrationOverlayPlan } from "./remix-narration-rewriter.js";
import { analyzeRemixSourceVideo, type VideoRemixAnalysis } from "./remix-video-analyzer.js";
import {
  getNicheProductionProfile,
  resolveProductionEmotion,
  type ProductionEmotion
} from "./niche-production-profiles.js";
import {
  buildAggressiveRemixSceneStructure,
  enhanceFastCutForAggressiveRemix,
  type RemixSceneStructure
} from "./remix-scene-restructure.js";
import { remixTargetStyles, type RemixTargetStyle } from "./remix-types.js";
import { buildAggressiveRemixVisualPlan } from "./remix-visual-transformer.js";
import {
  clampRemixOutputDuration,
  limitNarrationLines,
  REMIX_DEFAULT_OUTPUT_SECONDS,
  REMIX_MAX_SOURCE_SECONDS,
  SHORT_MAX_SCENES
} from "./short-production-limits.js";
import { transformVisual, type VisualTransformerPlan } from "./visual-transformer.js";

export { remixTargetStyles, type RemixTargetStyle };

export interface VideoRemixSourceInput {
  inputVideoPath?: string;
  sourceUrl?: string;
}

export interface VideoRemixOptions {
  targetStyle: RemixTargetStyle;
  newMusicPreset?: string;
  addNarration?: boolean;
  intensity: "medium" | "extreme";
  durationTarget?: number;
  channelDNA?: ChannelDNA;
  captionText?: string;
  language?: string;
  autoDownload?: boolean;
  downloadOptions?: RemixVideoDownloadOptions;
  enableAssetDiscovery?: boolean;
  executeAssetDiscovery?: boolean;
  variationCount?: number;
  variationStyles?: RemixTargetStyle[];
  enableResearch?: boolean;
  deepResearch?: boolean;
  selectedCuriosityIds?: string[];
}

export interface VideoRemixSourceResolution {
  kind: "local_path" | "public_url";
  sourceUrl: string | null;
  localPath: string;
  platform: RemixVideoPlatform | "local";
  title: string;
  download: RemixVideoDownloadResult | null;
}

export interface VideoRemixCaptionPlan {
  style: CaptionStyle;
  position: CaptionStyle["position"];
  scenes: Array<{
    order: number;
    startSeconds: number;
    endSeconds: number;
    captionText: string;
    styleId: string;
    quality: ReturnType<typeof analyzeCaptionQuality>;
  }>;
  captionEnginePayload: {
    styleId: string;
    position: string;
    exportFormat: "ass" | "srt";
    scenes: Array<{
      order: number;
      captionText: string;
      duration: number;
    }>;
  };
}

export interface VideoRemixCinematicPlan {
  preset: CinematicPreset;
  profile: CinematicProfile;
  motionSummary: string;
  effectStack: string[];
  cinematicEnginePayload: {
    presetId: string;
    panMode: string;
    zoomIntensity: number;
    cutPace: string;
    transitionStyle: string;
  };
}

export interface VideoRemixRenderBlueprint {
  engine: "video-engine";
  mode: "remix-blueprint-only";
  inputVideoPath: string;
  outputRole: "remixed_short";
  stages: Array<{
    stageId: string;
    engine: string;
    description: string;
    blockedUntilApproval: true;
  }>;
  checklist: string[];
}

export interface VideoRemixPlan {
  remixId: string;
  inputVideoPath: string;
  inputVideoTitle: string;
  sourceResolution: VideoRemixSourceResolution;
  targetStyle: RemixTargetStyle;
  durationSeconds: number;
  intensity: "medium" | "extreme";
  sourceCandidate: MediaBeastCandidate;
  channelDNA: ChannelDNA;
  visualPlan: VisualTransformerPlan;
  cinematicPlan: VideoRemixCinematicPlan;
  captionPlan: VideoRemixCaptionPlan;
  musicPlan: PremiumAudioScorePlan;
  narrationPlan: NarrationOverlayPlan | null;
  fastCutPlan: FastCutEditorPlan;
  sceneStructure: RemixSceneStructure;
  aggressiveTransform: {
    enabled: boolean;
    comfyVariationCount: number;
    originalFootprintRatio: number;
  };
  renderBlueprint: VideoRemixRenderBlueprint;
  approvalGate: {
    candidateFirst: true;
    requiresManualApproval: true;
    requiresSourceRightsConfirmation: true;
    canRenderAutomatically: false;
    canRenderAfterManualApproval: boolean;
    reason: string;
  };
  videoAnalysis: VideoRemixAnalysis;
  assetDiscovery: RemixAssetDiscoveryPlan;
  variationIndex: number;
  variationLabel: string;
  alternativePlans?: VideoRemixPlan[];
  productionNotes: string[];
  warnings: string[];
}

export interface VideoRemixVariationSummary {
  variationIndex: number;
  variationLabel: string;
  targetStyle: RemixTargetStyle;
  remixId: string;
  durationSeconds: number;
  visualVariationCount: number;
  narrationPreview: string | null;
}

interface RemixStyleProfile {
  niche: ChannelDNA["niche"];
  cinematicEmotion: PresetEmotionTag;
  captionEmotion: CaptionEmotionTag;
  tone: string;
  cinematicPresetId: string;
  captionStyleId: string;
}

const remixStyleProfiles: Record<RemixTargetStyle, RemixStyleProfile> = {
  dark_cinematic: {
    niche: "true_crime",
    cinematicEmotion: "DARK",
    captionEmotion: "DARK",
    tone: "dark cinematic",
    cinematicPresetId: "horror",
    captionStyleId: "horror_whisper"
  },
  hype_sports: {
    niche: "vintage_football",
    cinematicEmotion: "EPIC",
    captionEmotion: "JOYFUL",
    tone: "hype sports",
    cinematicPresetId: "action",
    captionStyleId: "sports_hype"
  },
  documentary: {
    niche: "history",
    cinematicEmotion: "CURIOUS",
    captionEmotion: "NEUTRAL",
    tone: "documentary premium",
    cinematicPresetId: "drama",
    captionStyleId: "documentary_clean"
  },
  horror: {
    niche: "cinema",
    cinematicEmotion: "DARK",
    captionEmotion: "TENSE",
    tone: "horror cinematic",
    cinematicPresetId: "horror",
    captionStyleId: "horror_whisper"
  },
  true_crime: {
    niche: "true_crime",
    cinematicEmotion: "MYSTERIOUS",
    captionEmotion: "MYSTERIOUS",
    tone: "dark documentary",
    cinematicPresetId: "mystery",
    captionStyleId: "documentary_clean"
  },
  vintage_football: {
    niche: "vintage_football",
    cinematicEmotion: "EPIC",
    captionEmotion: "JOYFUL",
    tone: "hype documentary",
    cinematicPresetId: "action",
    captionStyleId: "sports_hype"
  },
  anime: {
    niche: "anime",
    cinematicEmotion: "EPIC",
    captionEmotion: "CURIOUS",
    tone: "cinematic explainer",
    cinematicPresetId: "epic",
    captionStyleId: "anime_punch"
  },
  comics: {
    niche: "comics",
    cinematicEmotion: "CURIOUS",
    captionEmotion: "JOYFUL",
    tone: "cinematic explainer",
    cinematicPresetId: "suspense",
    captionStyleId: "comic_pop"
  },
  bodybuilding: {
    niche: "bodybuilding",
    cinematicEmotion: "TENSE",
    captionEmotion: "EPIC",
    tone: "intense documentary",
    cinematicPresetId: "action",
    captionStyleId: "bold_impact"
  },
  generic: {
    niche: "generic_broll",
    cinematicEmotion: "NEUTRAL",
    captionEmotion: "NEUTRAL",
    tone: "cinematic explainer",
    cinematicPresetId: "calm",
    captionStyleId: "premium_yellow"
  }
};

const remixMusicPresetByStyle: Record<RemixTargetStyle, string> = {
  dark_cinematic: "true_crime_dark",
  hype_sports: "football_hype",
  documentary: "documentary_clean",
  horror: "true_crime_dark",
  true_crime: "true_crime_dark",
  vintage_football: "football_hype",
  anime: "cinematic_epic",
  comics: "viral_fast_cut",
  bodybuilding: "viral_fast_cut",
  generic: "shorts_clean_voice"
};

function stableRemixId(seedSource: string, targetStyle: RemixTargetStyle) {
  const seed = `${seedSource}:${targetStyle}`;
  return `remix-${Buffer.from(seed).toString("base64url").slice(0, 20)}`;
}

export function recommendRemixMusicPreset(targetStyle: RemixTargetStyle): string {
  return remixMusicPresetByStyle[targetStyle];
}

export function recommendRemixNarration(targetStyle: RemixTargetStyle): boolean {
  return !["hype_sports", "vintage_football", "anime", "comics"].includes(targetStyle);
}

function resolveRemixMusicPresetId(options: VideoRemixOptions): string {
  if (options.newMusicPreset?.trim()) {
    return options.newMusicPreset.trim();
  }
  return recommendRemixMusicPreset(options.targetStyle);
}

function resolveRemixAddNarration(options: VideoRemixOptions): boolean {
  if (options.addNarration !== undefined) {
    return options.addNarration;
  }
  return recommendRemixNarration(options.targetStyle);
}

async function assertInputVideoExists(inputVideoPath: string) {
  const resolved = resolve(inputVideoPath);
  try {
    await access(resolved);
  } catch {
    throw new Error(`Input video not found or inaccessible: ${resolved}`);
  }
  return resolved;
}

export async function isRemixSourceStagedForRender(
  sourceResolution: VideoRemixSourceResolution
): Promise<boolean> {
  const candidates = [
    sourceResolution.download?.localPath,
    sourceResolution.localPath
  ].filter((value): value is string => Boolean(value?.trim()));

  for (const candidate of candidates) {
    try {
      await access(resolve(candidate));
      return true;
    } catch {
      continue;
    }
  }

  return false;
}

function buildSourceCandidate(
  sourceResolution: VideoRemixSourceResolution
): MediaBeastCandidate {
  const isPublicUrl = sourceResolution.kind === "public_url";
  const seed = sourceResolution.sourceUrl ?? sourceResolution.localPath;

  return {
    id: stableRemixId(seed, "generic"),
    providerId: isPublicUrl ? "youtube" : "generic-web",
    kind: "video",
    title: sourceResolution.title,
    sourceUrl: sourceResolution.sourceUrl ?? sourceResolution.localPath,
    previewUrl: sourceResolution.download?.thumbnailUrl ?? null,
    licenseStatus: isPublicUrl ? "unknown" : "owned",
    riskLevel: isPublicUrl ? "high" : "low",
    score: isPublicUrl ? 48 : 72,
    reasons: isPublicUrl
      ? [
          "Public URL ingested as remix candidate — rights must be confirmed manually.",
          "Automatic download is staging-only; render stays blocked until approval.",
          `Platform detected: ${sourceResolution.platform}.`
        ]
      : [
          "User-supplied source clip flagged as owned/local for remix planning.",
          "Remix plan still requires manual approval before render."
        ],
    warnings: isPublicUrl
      ? [
          "Downloading a public Short/Reel/TikTok does not grant remix or republish rights.",
          "Platform Terms of Service may restrict re-upload even after heavy transformation.",
          "Approve only if you own the content or have explicit permission.",
          "Do not use remix to evade copyright, bans or content-ID systems."
        ]
      : [
          "Confirm you own or have explicit rights to remix and republish this clip.",
          "Third-party podcast cuts, sports broadcasts and platform downloads remain high-risk."
        ],
    metadata: {
      remixSource: true,
      remixSourceKind: sourceResolution.kind,
      remixPlatform: sourceResolution.platform,
      originalAssetPath: sourceResolution.localPath,
      downloadedAt: sourceResolution.download?.downloadedAt ?? null,
      downloadFileSizeBytes: sourceResolution.download?.fileSizeBytes ?? null,
      discoveryOnly: false,
      candidateFirst: true,
      remixThemeSummary: null,
      remixContextKeywords: null
    }
  };
}

function enrichSourceCandidateWithAnalysis(
  candidate: MediaBeastCandidate,
  analysis: VideoRemixAnalysis
): MediaBeastCandidate {
  const intelligence = analysis.contentIntelligence;
  return {
    ...candidate,
    title: analysis.title,
    reasons: [
      ...candidate.reasons,
      `Análise editorial: ${analysis.themeSummary}`,
      intelligence.entities.length
        ? `Entidades detectadas: ${intelligence.entities.map((entity) => entity.name).join(", ")}.`
        : "Análise Fase 2: contexto inferido a partir do título/legenda."
    ],
    metadata: enrichCandidateWithContentIntelligence(
      {
        ...(candidate.metadata ?? {}),
        remixThemeSummary: analysis.themeSummary,
        remixContextKeywords: analysis.contextKeywords.join(", "),
        remixSourceDurationSeconds: analysis.sourceDurationSeconds,
        remixOutputDurationSeconds: analysis.outputDurationSeconds,
        remixProbeMethod: analysis.probeMethod,
        remixAnalysisVersion: intelligence.analysisVersion
      } as Record<string, unknown>,
      intelligence
    ) as MediaBeastCandidate["metadata"]
  };
}

const VARIATION_STYLE_ROTATION: Record<RemixContentDomain | "default", RemixTargetStyle[]> = {
  sports: ["hype_sports", "documentary", "vintage_football"],
  comics_superhero: ["comics", "dark_cinematic", "anime"],
  gaming: ["anime", "dark_cinematic", "hype_sports"],
  anime: ["anime", "dark_cinematic", "documentary"],
  true_crime: ["true_crime", "dark_cinematic", "documentary"],
  horror: ["horror", "dark_cinematic", "true_crime"],
  science: ["documentary", "dark_cinematic", "generic"],
  documentary: ["documentary", "dark_cinematic", "generic"],
  generic: ["documentary", "dark_cinematic", "hype_sports"],
  default: ["documentary", "dark_cinematic", "hype_sports"]
};

function clampVariationCount(value: number | undefined) {
  if (!value || value < 1) return 1;
  return Math.min(3, Math.round(value));
}

function resolveVariationStyles(
  baseStyle: RemixTargetStyle,
  domain: RemixContentDomain,
  count: number,
  explicit?: RemixTargetStyle[]
): RemixTargetStyle[] {
  const pool = explicit?.length
    ? explicit
    : VARIATION_STYLE_ROTATION[domain] ?? VARIATION_STYLE_ROTATION.default;
  const ordered = [baseStyle, ...pool.filter((style) => style !== baseStyle)];
  return ordered.slice(0, count);
}

function buildVariationLabel(index: number, style: RemixTargetStyle) {
  const letter = String.fromCharCode(65 + index);
  return `Variação ${letter} — ${style.replace(/_/g, " ")}`;
}

function resolveRemixChannelDNA(
  options: VideoRemixOptions,
  styleProfile: RemixStyleProfile
): ChannelDNA {
  if (options.channelDNA) {
    return options.channelDNA;
  }

  const nicheProfile = getNicheProductionProfile(styleProfile.niche);
  return createChannelDNA({
    id: `remix-${options.targetStyle}`,
    name: `Remix ${options.targetStyle.replace(/_/g, " ")}`,
    niche: styleProfile.niche,
    tone: styleProfile.tone,
    language: options.language ?? "pt-BR",
    musicPresetId: resolveRemixMusicPresetId(options),
    audioMasteringPresetId: nicheProfile.masteringPresetId,
    narrationBias: nicheProfile.narrationVoicePackId
  });
}

function buildCinematicRemixPlan(
  targetStyle: RemixTargetStyle,
  styleProfile: RemixStyleProfile,
  fastCutPlan: FastCutEditorPlan,
  visualPlan: VisualTransformerPlan
): VideoRemixCinematicPlan {
  const preset =
    getCinematicPresetById(styleProfile.cinematicPresetId) ??
    suggestPresetForEmotion(styleProfile.cinematicEmotion);

  const beats = fastCutPlan.cutTimes.slice(0, 6).map((time, index) => ({
    beatId: `remix-beat-${index + 1}`,
    shot: index === 0 ? ("close-up" as const) : index < 3 ? ("medium" as const) : ("wide" as const),
    motion: (index % 2 === 0 ? preset.defaultPanMode : "push-in") as
      | "static"
      | "drift"
      | "push-in"
      | "push-out"
      | "parallax"
      | "whip-pan",
    transitionOut: (fastCutPlan.transitionSequence[index]?.transition === "soft-drift"
      ? "fade"
      : fastCutPlan.transitionSequence[index]?.transition === "flash-cut"
        ? "flash"
        : "cut") as "cut" | "fade" | "flash" | "match-cut",
    effectStack: visualPlan.cinematicEffects
      .slice(index, index + 2)
      .map((effect) => effect.type)
  }));

  if (beats.length === 0) {
    beats.push({
      beatId: "remix-beat-1",
      shot: "medium",
      motion: preset.defaultPanMode as "drift",
      transitionOut: "cut",
      effectStack: visualPlan.cinematicEffects.slice(0, 2).map((effect) => effect.type)
    });
  }

  const profile = buildCinematicProfile(
    `remix-${targetStyle}`,
    `Remix ${targetStyle}`,
    beats
  );

  return {
    preset,
    profile,
    motionSummary: describePresetMotion(preset),
    effectStack: visualPlan.cinematicEffects.map((effect) => effect.type),
    cinematicEnginePayload: {
      presetId: preset.id,
      panMode: preset.defaultPanMode,
      zoomIntensity: preset.defaultZoomIntensity,
      cutPace: preset.cutPace,
      transitionStyle: visualPlan.transitionStyle
    }
  };
}

function buildCaptionRemixPlan(input: {
  styleProfile: RemixStyleProfile;
  durationSeconds: number;
  fastCutPlan: FastCutEditorPlan;
  captionText: string;
  narrationPlan: NarrationOverlayPlan | null;
}): VideoRemixCaptionPlan {
  const style =
    getCaptionStyleById(input.styleProfile.captionStyleId) ??
    suggestCaptionStyleByEmotion(input.styleProfile.captionEmotion);

  const captionLines = limitNarrationLines(
    input.narrationPlan?.overlayCaptions ??
      input.captionText.split("\n").filter(Boolean),
    SHORT_MAX_SCENES
  );

  const boundaries = [
    0,
    ...input.fastCutPlan.cutTimes.slice(0, Math.max(captionLines.length - 1, 0)),
    input.durationSeconds
  ];

  const scenes = captionLines.map((line, index) => {
    const startSeconds = boundaries[index] ?? 0;
    const endSeconds = boundaries[index + 1] ?? input.durationSeconds;
    const duration = Math.max(endSeconds - startSeconds, 0.8);

    return {
      order: index + 1,
      startSeconds: Number(startSeconds.toFixed(2)),
      endSeconds: Number(endSeconds.toFixed(2)),
      captionText: line,
      styleId: style.id,
      quality: analyzeCaptionQuality(line, duration, style)
    };
  });

  return {
    style,
    position: style.position,
    scenes,
    captionEnginePayload: {
      styleId: style.id,
      position: style.position,
      exportFormat: "ass",
      scenes: scenes.map((scene) => ({
        order: scene.order,
        captionText: scene.captionText,
        duration: Number((scene.endSeconds - scene.startSeconds).toFixed(2))
      }))
    }
  };
}

function buildRenderBlueprint(input: {
  inputVideoPath: string;
  sourceResolution: VideoRemixSourceResolution;
  visualPlan: VisualTransformerPlan;
  cinematicPlan: VideoRemixCinematicPlan;
  captionPlan: VideoRemixCaptionPlan;
  musicPlan: PremiumAudioScorePlan;
  narrationPlan: NarrationOverlayPlan | null;
  fastCutPlan: FastCutEditorPlan;
}): VideoRemixRenderBlueprint {
  const urlIngestStage =
    input.sourceResolution.kind === "public_url"
      ? [
          {
            stageId: "url_download_staging",
            engine: "yt-dlp",
            description: `Downloaded from ${input.sourceResolution.platform} to local staging path for planning only.`,
            blockedUntilApproval: true as const
          }
        ]
      : [];

  return {
    engine: "video-engine",
    mode: "remix-blueprint-only",
    inputVideoPath: input.inputVideoPath,
    outputRole: "remixed_short",
    stages: [
      {
        stageId: "rights_confirmation",
        engine: "human-review",
        description:
          input.sourceResolution.kind === "public_url"
            ? "Confirm remix rights for downloaded public URL before any render."
            : "Confirm source ownership and remix rights before any render.",
        blockedUntilApproval: true
      },
      ...urlIngestStage,
      {
        stageId: "video_analysis",
        engine: "media-beast-remix",
        description: "Analyze source duration, main scenes and editorial theme before rewrite.",
        blockedUntilApproval: true
      },
      {
        stageId: "asset_discovery",
        engine: "media-beast-discovery",
        description:
          "Search or generate new visuals (image providers + ComfyUI) to differentiate from source.",
        blockedUntilApproval: true
      },
      {
        stageId: "source_ingest",
        engine: "video-engine",
        description: "Ingest staged source clip and normalize to edit timeline.",
        blockedUntilApproval: true
      },
      {
        stageId: "cinematic_reframe",
        engine: "cinematic-engine",
        description: `Apply ${input.cinematicPlan.preset.name} motion, cuts and effect stack.`,
        blockedUntilApproval: true
      },
      {
        stageId: "scene_restructure",
        engine: "media-beast-remix",
        description: `Rebuild timeline with ${input.sourceResolution.kind === "public_url" ? "aggressive" : "editorial"} scene roles and ComfyUI inserts.`,
        blockedUntilApproval: true
      },
      {
        stageId: "comfyui_variations",
        engine: "comfyui-local",
        description: `Generate ${input.visualPlan.comfyVariations.length} ComfyUI variations (reconstruction, inserts, b-roll).`,
        blockedUntilApproval: true
      },
      {
        stageId: "visual_grade",
        engine: "hybrid-visual-engine",
        description: `Apply ${input.visualPlan.colorGrade.name} grade and ${input.visualPlan.comfyVariations.length} variation overlays.`,
        blockedUntilApproval: true
      },
      {
        stageId: "audio_remix",
        engine: "audio-engine",
        description: `Replace bed with ${input.musicPlan.musicPresetName} and sync SFX cues.`,
        blockedUntilApproval: true
      },
      {
        stageId: "narration_overlay",
        engine: "narration-engine",
        description: input.narrationPlan
          ? `Render narration from approved script (${input.narrationPlan.narrationBeats.length} beats, voice '${input.narrationPlan.voicePackHint}'). Apply styleDirective metadata for prosody.`
          : "Skipped — remix keeps original audio bed only.",
        blockedUntilApproval: true
      },
      {
        stageId: "caption_restyle",
        engine: "caption-engine",
        description: `Restyle captions using ${input.captionPlan.style.name} at ${input.captionPlan.position}.`,
        blockedUntilApproval: true
      },
      {
        stageId: "final_render",
        engine: "video-engine",
        description: "Emit remixed short only after full manual approval.",
        blockedUntilApproval: true
      }
    ],
    checklist: [
      "Confirm owned/licensed rights to source clip.",
      "Approve remix plan and music/SFX selections.",
      "Review caption readability and timing per scene.",
      "Validate cinematic motion does not obscure original meaning unfairly.",
      `Align ${input.fastCutPlan.cutTimes.length} cuts to beat markers before export.`
    ]
  };
}

interface RemixSharedContext {
  resolvedPath: string;
  sourceResolution: VideoRemixSourceResolution;
  title: string;
  videoAnalysis: VideoRemixAnalysis;
  sourceCandidate: MediaBeastCandidate;
  discoveredCandidates: Awaited<ReturnType<typeof discoverRemixAssetCandidates>>["candidates"];
  assetDiscoveryWarnings: string[];
}

async function buildRemixPlanForVariation(
  shared: RemixSharedContext,
  options: VideoRemixOptions,
  variationIndex: number,
  targetStyle: RemixTargetStyle
): Promise<VideoRemixPlan> {
  const variationOptions: VideoRemixOptions = {
    ...options,
    targetStyle
  };
  const musicPresetId = resolveRemixMusicPresetId(variationOptions);
  const musicPreset = getMusicPresetById(musicPresetId);
  if (!musicPreset) {
    throw new Error(`Unsupported music preset '${musicPresetId}'.`);
  }

  const addNarration = resolveRemixAddNarration(variationOptions);
  const styleProfile = remixStyleProfiles[targetStyle];
  const channelDNA = resolveRemixChannelDNA(
    {
      ...variationOptions,
      newMusicPreset: musicPresetId,
      addNarration
    },
    styleProfile
  );

  const durationSeconds = shared.videoAnalysis.outputDurationSeconds;
  const sourceCandidate = {
    ...shared.sourceCandidate,
    id: stableRemixId(
      `${shared.sourceResolution.sourceUrl ?? shared.resolvedPath}:v${variationIndex}`,
      targetStyle
    )
  };
  const productionEmotion = resolveProductionEmotion(
    channelDNA.niche,
    channelDNA.tone
  ) as ProductionEmotion;

  const useAggressiveTransform = options.intensity === "extreme";
  let visualPlan: VisualTransformerPlan = useAggressiveTransform
    ? buildAggressiveRemixVisualPlan(
        sourceCandidate,
        channelDNA,
        options.intensity,
        durationSeconds,
        targetStyle
      )
    : transformVisual(sourceCandidate, channelDNA, options.intensity, durationSeconds);

  let fastCutPlan = buildFastCutEditorPlan({
    durationSeconds,
    energy: options.intensity === "extreme" ? "extreme" : "high",
    visualPlan,
    emotion: productionEmotion,
    beatMarkers: []
  });

  if (useAggressiveTransform) {
    fastCutPlan = enhanceFastCutForAggressiveRemix(fastCutPlan, options.intensity);
    visualPlan = buildAggressiveRemixVisualPlan(
      sourceCandidate,
      channelDNA,
      options.intensity,
      durationSeconds,
      targetStyle,
      buildAggressiveRemixSceneStructure({
        durationSeconds,
        fastCutPlan,
        targetStyle,
        intensity: options.intensity,
        visualPlan
      })
    );
  }

  const sceneStructure = buildAggressiveRemixSceneStructure({
    durationSeconds,
    fastCutPlan,
    targetStyle,
    intensity: options.intensity,
    visualPlan
  });
  const musicPlan = buildPremiumAudioScorePlan({
    channelDNA: {
      ...channelDNA,
      musicPresetId
    },
    durationSeconds,
    fastCutPlan,
    emotion: productionEmotion
  });
  const cinematicPlan = buildCinematicRemixPlan(
    targetStyle,
    styleProfile,
    fastCutPlan,
    visualPlan
  );

  const narrationPlan = addNarration
    ? buildRemixNarrationOverlayPlan({
        analysis: shared.videoAnalysis,
        channelDNA,
        targetStyle,
        variationIndex,
        maxDurationSeconds: clampRemixOutputDuration(durationSeconds),
        narrationBias: channelDNA.narrationBias,
        researchDossier: shared.videoAnalysis.researchDossier,
        ...(options.selectedCuriosityIds
          ? { selectedCuriosityIds: options.selectedCuriosityIds }
          : {})
      })
    : null;

  const assetDiscovery = buildRemixAssetDiscoveryPlan({
    analysis: shared.videoAnalysis,
    comfyVariations: visualPlan.comfyVariations,
    enableImageSearch: options.enableAssetDiscovery !== false,
    niche: styleProfile.niche,
    discoveredCandidates: shared.discoveredCandidates
  });

  const captionPlan = buildCaptionRemixPlan({
    styleProfile,
    durationSeconds,
    fastCutPlan,
    captionText:
      options.captionText ??
      narrationPlan?.suggestedScript ??
      `Remix: ${shared.title}`,
    narrationPlan
  });

  const renderBlueprint = buildRenderBlueprint({
    inputVideoPath: shared.resolvedPath,
    sourceResolution: shared.sourceResolution,
    visualPlan,
    cinematicPlan,
    captionPlan,
    musicPlan,
    narrationPlan,
    fastCutPlan
  });

  const canRenderAfterManualApproval = await isRemixSourceStagedForRender(
    shared.sourceResolution
  );
  const seedSource = shared.sourceResolution.sourceUrl ?? shared.resolvedPath;
  const variationLabel = buildVariationLabel(variationIndex, targetStyle);

  return {
    remixId: stableRemixId(`${seedSource}:v${variationIndex}`, targetStyle),
    inputVideoPath: shared.resolvedPath,
    inputVideoTitle: shared.title,
    sourceResolution: shared.sourceResolution,
    targetStyle,
    durationSeconds,
    intensity: options.intensity,
    sourceCandidate,
    channelDNA,
    visualPlan,
    cinematicPlan,
    captionPlan,
    musicPlan,
    narrationPlan,
    fastCutPlan,
    sceneStructure,
    aggressiveTransform: {
      enabled: useAggressiveTransform,
      comfyVariationCount: visualPlan.comfyVariations.length,
      originalFootprintRatio: sceneStructure.originalFootprintRatio
    },
    renderBlueprint,
    approvalGate: {
      candidateFirst: true,
      requiresManualApproval: true,
      requiresSourceRightsConfirmation: true,
      canRenderAutomatically: false,
      canRenderAfterManualApproval,
      reason: canRenderAfterManualApproval
        ? "Fonte local disponivel. Render liberado apos aprovacao manual e confirmacao de direitos."
        : "Fonte nao encontrada no disco. Baixe o video ou informe um caminho local valido antes de renderizar."
    },
    videoAnalysis: shared.videoAnalysis,
    assetDiscovery,
    variationIndex,
    variationLabel,
    productionNotes: [
      `${variationLabel} planejada com análise Fase 2 (${shared.videoAnalysis.contentIntelligence.domain}).`,
      shared.sourceResolution.kind === "public_url"
        ? `Downloaded public URL (${shared.sourceResolution.platform}) to staging path for remix planning (máx. ${REMIX_MAX_SOURCE_SECONDS}s).`
        : `Video Remixer planned '${targetStyle}' transform for local clip '${shared.title}'.`,
      `Análise: fonte ${shared.videoAnalysis.sourceDurationSeconds}s → remix ${durationSeconds}s (${shared.videoAnalysis.probeMethod}).`,
      `Tema: ${shared.videoAnalysis.contentIntelligence.headline}`,
      shared.videoAnalysis.contentIntelligence.entities.length
        ? `Personagens/entidades: ${shared.videoAnalysis.contentIntelligence.entities.map((entity) => entity.name).join(", ")}.`
        : null,
      shared.videoAnalysis.contentIntelligence.actions.length
        ? `Ações: ${shared.videoAnalysis.contentIntelligence.actions.map((action) => action.label).join(", ")}.`
        : null,
      assetDiscovery.imageSearch.candidates.length
        ? `${assetDiscovery.imageSearch.candidates.length} candidatos visuais discovery-only sugeridos.`
        : assetDiscovery.imageSearch.queries.length
          ? `Busca de imagens sugerida: ${assetDiscovery.imageSearch.queries.slice(0, 2).join(" | ")}.`
          : "Variações ComfyUI priorizadas para diferenciar do original.",
      assetDiscovery.comfyui.contextualPrompts.length
        ? `${assetDiscovery.comfyui.contextualPrompts.length} prompts ComfyUI contextuais gerados.`
        : null,
      `Cinematic preset: ${cinematicPlan.preset.name} (${cinematicPlan.motionSummary}).`,
      `Caption style: ${captionPlan.style.name} at ${captionPlan.position}.`,
      `Music preset: ${musicPlan.musicPresetId} with mastering ${musicPlan.masteringPresetId}.`,
      addNarration
        ? `Narration enabled with voice pack '${narrationPlan?.voicePackHint}'.`
        : "Narration disabled — original audio structure preserved in plan.",
      `${fastCutPlan.cutTimes.length} new cuts and ${visualPlan.comfyVariations.length} visual variations proposed.`,
      `Scene restructure: ${sceneStructure.totalScenes} cenas (${Math.round(sceneStructure.originalFootprintRatio * 100)}% footprint do clip original).`,
      useAggressiveTransform
        ? "Transformação agressiva ativa: inserts ComfyUI + nova estrutura de cenas."
        : "Transformação editorial moderada.",
      shared.sourceResolution.download
        ? `yt-dlp staging file: ${shared.sourceResolution.download.localPath} (${shared.sourceResolution.download.fileSizeBytes ?? "?"} bytes, filtro <= ${REMIX_MAX_SOURCE_SECONDS}s).`
        : "No remote download performed.",
      ...shared.videoAnalysis.analysisNotes
    ].filter((note): note is string => Boolean(note)),
    warnings: [
      "Candidate-first remix: this endpoint returns a plan only, never renders automatically.",
      "Confirm ownership or explicit remix rights for the source clip.",
      "Replacing music, captions and grade does not remove platform or copyright obligations.",
      "Assets discovery-only não são importados automaticamente — aprove manualmente antes do render.",
      ...(shared.sourceResolution.kind === "public_url"
        ? [
            "Public URL was auto-downloaded for planning — this is not permission to publish.",
            "Manual approval is required before any render or distribution."
          ]
        : []),
      ...shared.assetDiscoveryWarnings,
      ...sourceCandidate.warnings,
      ...musicPlan.cautionNotes,
      ...(narrationPlan?.cautionNotes ?? []),
      ...visualPlan.safetyNotes.slice(0, 1)
    ]
  };
}

export async function remixVideoFromSource(
  source: VideoRemixSourceInput,
  options: VideoRemixOptions
): Promise<VideoRemixPlan> {
  if (!remixTargetStyles.includes(options.targetStyle)) {
    throw new Error(`Unsupported remix target style '${options.targetStyle}'.`);
  }

  const variationCount = clampVariationCount(options.variationCount);
  const resolveInput: Parameters<typeof resolveRemixVideoInput>[0] = {};
  if (source.inputVideoPath) {
    resolveInput.inputVideoPath = source.inputVideoPath;
  }
  if (source.sourceUrl) {
    resolveInput.sourceUrl = source.sourceUrl;
  }
  if (options.autoDownload !== undefined) {
    resolveInput.autoDownload = options.autoDownload;
  }
  if (options.downloadOptions) {
    resolveInput.downloadOptions = {
      maxDurationSeconds: REMIX_MAX_SOURCE_SECONDS,
      ...options.downloadOptions
    };
  } else {
    resolveInput.downloadOptions = {
      maxDurationSeconds: REMIX_MAX_SOURCE_SECONDS
    };
  }

  const resolved = await resolveRemixVideoInput(resolveInput);
  const resolvedPath = await assertInputVideoExists(resolved.localPath);
  const sourceResolution: VideoRemixSourceResolution = {
    kind: resolved.kind,
    sourceUrl: resolved.sourceUrl,
    localPath: resolvedPath,
    platform: resolved.platform,
    title: resolved.title,
    download: resolved.download
  };

  const videoAnalysis = await analyzeRemixSourceVideo({
    localPath: resolvedPath,
    title: sourceResolution.title,
    topicHint: options.captionText ?? null,
    platform: sourceResolution.platform,
    metadataDurationSeconds: sourceResolution.download?.durationSeconds ?? null,
    targetOutputSeconds: options.durationTarget ?? REMIX_DEFAULT_OUTPUT_SECONDS,
    intensity: options.intensity,
    researchOptions: {
      enabled: options.enableResearch !== false,
      deepResearch: options.deepResearch === true,
      ...(options.selectedCuriosityIds
        ? { selectedCuriosityIds: options.selectedCuriosityIds }
        : {}),
      targetStyle: options.targetStyle,
      language: options.language ?? "pt-BR"
    }
  });

  const sourceCandidate = enrichSourceCandidateWithAnalysis(
    buildSourceCandidate(sourceResolution),
    videoAnalysis
  );

  let discoveredCandidates: RemixSharedContext["discoveredCandidates"] = [];
  const assetDiscoveryWarnings: string[] = [];
  const shouldDiscover =
    options.enableAssetDiscovery !== false && options.executeAssetDiscovery !== false;

  if (shouldDiscover) {
    const baseStyleProfile = remixStyleProfiles[options.targetStyle];
    const discovery = await discoverRemixAssetCandidates({
      analysis: videoAnalysis,
      niche: baseStyleProfile.niche,
      maxCandidatesPerQuery: 6,
      maxQueries: 14
    });
    discoveredCandidates = discovery.candidates;
    assetDiscoveryWarnings.push(...discovery.warnings);
  }

  const shared: RemixSharedContext = {
    resolvedPath,
    sourceResolution,
    title: sourceResolution.title,
    videoAnalysis,
    sourceCandidate,
    discoveredCandidates,
    assetDiscoveryWarnings
  };

  const variationStyles = resolveVariationStyles(
    options.targetStyle,
    videoAnalysis.contentIntelligence.domain,
    variationCount,
    options.variationStyles
  );

  const plans = await Promise.all(
    variationStyles.map((style, index) =>
      buildRemixPlanForVariation(shared, options, index, style)
    )
  );

  const [primaryPlan, ...alternativePlans] = plans;
  if (!primaryPlan) {
    throw new Error("Failed to build remix plan.");
  }

  if (alternativePlans.length > 0) {
    primaryPlan.alternativePlans = alternativePlans;
    primaryPlan.productionNotes.unshift(
      `${plans.length} variações de remix geradas para o mesmo vídeo (Fase 2).`
    );
  }

  return primaryPlan;
}

export async function remixExistingVideo(
  inputVideoPath: string,
  options: VideoRemixOptions
): Promise<VideoRemixPlan> {
  return remixVideoFromSource({ inputVideoPath }, options);
}