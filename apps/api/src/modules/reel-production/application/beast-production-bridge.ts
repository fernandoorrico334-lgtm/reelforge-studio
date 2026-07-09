import {
  clampRemixOutputDuration,
  clampShortDuration,
  createChannelDNA,
  evenSceneDurations,
  generatePremiumReel,
  limitNarrationLines,
  mediaBeastNiches,
  mediaBeastProviderIds,
  isRemixVideoUrl,
  remixTargetStyles,
  remixVideoFromSource,
  SHORT_DEFAULT_DURATION_SECONDS,
  SHORT_MAX_SCENES,
  type ChannelDNA,
  type MediaBeastCandidate,
  type MediaBeastNiche,
  type MediaBeastProviderId,
  type PremiumReelProductionPlan,
  type RemixTargetStyle,
  type VideoRemixPlan
} from "@reelforge/media-beast";
import { ValidationError } from "../../../shared/errors.js";
import type { IntakeRepository } from "../../intake/application/intake-repository.js";
import type { ProjectRepository } from "../../projects/application/project-repository.js";
import type { StudioProject } from "../../projects/domain/project.js";
import type { OneClickRunInput } from "../domain/reel-production.js";

export interface OneClickBeastProductionResult {
  remixMode: "new" | "remix";
  planType: "premium_reel" | "video_remix";
  visualVariationCount: number;
  musicPresetId: string;
  masteringPresetId: string;
  voicePackId: string | null;
  requiresManualApproval: true;
  canRenderAutomatically: false;
  canRenderAfterManualApproval: boolean;
  plan: PremiumReelProductionPlan | VideoRemixPlan;
}

function mapChannelNicheToMediaBeast(niche: string): MediaBeastNiche {
  const normalized = niche.toLowerCase();

  if (
    normalized.includes("football") ||
    normalized.includes("futebol") ||
    normalized.includes("sport")
  ) {
    return "vintage_football";
  }

  if (normalized.includes("crime") || normalized.includes("mystery")) {
    return "true_crime";
  }

  if (normalized.includes("horror") || normalized.includes("cinema")) {
    return "cinema";
  }

  if (normalized.includes("comic") || normalized.includes("quadrinho")) {
    return "comics";
  }

  if (normalized.includes("gym") || normalized.includes("body")) {
    return "bodybuilding";
  }

  if (normalized.includes("history") || normalized.includes("historia")) {
    return "history";
  }

  if (normalized.includes("anime")) {
    return "anime";
  }

  if (normalized.includes("science") || normalized.includes("curios")) {
    return "science_curiosities";
  }

  if (mediaBeastNiches.includes(normalized as MediaBeastNiche)) {
    return normalized as MediaBeastNiche;
  }

  return "generic_broll";
}

function mapTargetStyleForChannel(
  channelNiche: string,
  explicit: string | null | undefined
): RemixTargetStyle {
  if (
    explicit &&
    remixTargetStyles.includes(explicit as RemixTargetStyle)
  ) {
    return explicit as RemixTargetStyle;
  }

  const normalized = channelNiche.toLowerCase();
  if (normalized.includes("football") || normalized.includes("futebol")) {
    return "hype_sports";
  }
  if (normalized.includes("crime")) {
    return "true_crime";
  }
  if (normalized.includes("horror")) {
    return "horror";
  }

  return "documentary";
}

export function buildChannelDNAFromProject(
  project: StudioProject,
  defaults: { musicPresetId: string; voicePackId: string }
): ChannelDNA {
  const niche = mapChannelNicheToMediaBeast(project.channel.niche);

  return createChannelDNA({
    id: project.channel.id,
    name: project.channel.name,
    niche,
    language: project.channel.language ?? "pt-BR",
    tone: project.channel.narrativeTone ?? "cinematic explainer",
    musicPresetId: defaults.musicPresetId,
    audioMasteringPresetId: project.musicPresetId ?? defaults.musicPresetId,
    narrationBias: defaults.voicePackId,
    dailyShortTarget: Math.max(project.scenes.length, 1)
  });
}

function readBeastCandidateFromPayload(value: unknown): MediaBeastCandidate | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const candidate = value as Partial<MediaBeastCandidate>;
  if (!candidate.id || !candidate.providerId || !candidate.title) {
    return null;
  }

  if (!mediaBeastProviderIds.includes(candidate.providerId as MediaBeastProviderId)) {
    throw new ValidationError(`Unsupported beast candidate provider '${candidate.providerId}'.`);
  }

  return {
    id: candidate.id,
    providerId: candidate.providerId as MediaBeastProviderId,
    kind: candidate.kind ?? "webpage",
    title: candidate.title,
    sourceUrl: candidate.sourceUrl ?? "",
    previewUrl: candidate.previewUrl ?? null,
    licenseStatus: candidate.licenseStatus ?? "unknown",
    riskLevel: candidate.riskLevel ?? "high",
    score: Number(candidate.score ?? 0),
    reasons: Array.isArray(candidate.reasons) ? candidate.reasons : [],
    warnings: Array.isArray(candidate.warnings) ? candidate.warnings : [],
    metadata:
      candidate.metadata && typeof candidate.metadata === "object"
        ? candidate.metadata
        : {}
  };
}

function buildProjectFallbackCandidate(project: StudioProject): MediaBeastCandidate {
  const firstScene = project.scenes[0];

  return {
    id: `project-candidate-${project.id}`,
    providerId: "generic-web",
    kind: "webpage",
    title: firstScene?.title ?? project.title,
    sourceUrl: firstScene?.captionText ?? project.title,
    previewUrl: null,
    licenseStatus: "unknown",
    riskLevel: "high",
    score: 40,
    reasons: [
      "Fallback candidate synthesized from project scenes for premium planning.",
      "Requires manual source approval before render."
    ],
    warnings: [
      "No explicit beast candidate supplied; using project context only.",
      "Candidate-first: discovery/project context does not grant reuse rights."
    ],
    metadata: {
      projectId: project.id,
      sceneCount: project.scenes.length,
      synthesized: true
    }
  };
}

async function resolveBeastCandidateForNewMode(
  project: StudioProject,
  intakeRepository: IntakeRepository,
  input: OneClickRunInput
): Promise<MediaBeastCandidate> {
  const payloadCandidate = readBeastCandidateFromPayload(input.beastCandidate);
  if (payloadCandidate) {
    return payloadCandidate;
  }

  const collections = await intakeRepository.listCollections({ projectId: project.id });
  for (const collection of collections) {
    const candidates = await intakeRepository.listCandidates({
      collectionId: collection.id
    });
    const approved = candidates.find((candidate) => candidate.status === "approved");
    if (approved) {
      return {
        id: approved.id,
        providerId: "generic-web",
        kind: "webpage",
        title: approved.title,
        sourceUrl: approved.sourceUrl ?? approved.downloadUrl ?? "",
        previewUrl: approved.previewUrl,
        licenseStatus: "unknown",
        riskLevel: "medium",
        score: 55,
        reasons: ["Approved intake candidate used for premium reel planning."],
        warnings: [
          "Manual rights review still required before render.",
          "Approval in intake does not auto-enable render."
        ],
        metadata: {
          intakeCandidateId: approved.id,
          collectionId: collection.id
        }
      };
    }
  }

  return buildProjectFallbackCandidate(project);
}

function summarizeBeastPlan(
  remixMode: "new" | "remix",
  plan: PremiumReelProductionPlan | VideoRemixPlan
): OneClickBeastProductionResult {
  if (remixMode === "remix") {
    const remixPlan = plan as VideoRemixPlan;
    return {
      remixMode,
      planType: "video_remix",
      visualVariationCount: remixPlan.visualPlan.comfyVariations.length,
      musicPresetId: remixPlan.musicPlan.musicPresetId,
      masteringPresetId: remixPlan.musicPlan.masteringPresetId,
      voicePackId: remixPlan.narrationPlan?.voicePackHint ?? null,
      requiresManualApproval: true,
      canRenderAutomatically: false,
      canRenderAfterManualApproval: remixPlan.approvalGate.canRenderAfterManualApproval,
      plan: remixPlan
    };
  }

  const premiumPlan = plan as PremiumReelProductionPlan;
  return {
    remixMode,
    planType: "premium_reel",
    visualVariationCount: premiumPlan.visualPlan.comfyVariations.length,
    musicPresetId: premiumPlan.musicPlan.musicPresetId,
    masteringPresetId: premiumPlan.musicPlan.masteringPresetId,
    voicePackId: premiumPlan.narrationPlan.voicePackHint,
    requiresManualApproval: true,
    canRenderAutomatically: false,
    canRenderAfterManualApproval: premiumPlan.renderEligibility.canRenderAfterManualApproval,
    plan: premiumPlan
  };
}

export function isBeastOneClickMode(input: OneClickRunInput) {
  return input.remixMode === "new" || input.remixMode === "remix";
}

export function isBeastRenderAuthorized(input: OneClickRunInput) {
  return (
    isBeastOneClickMode(input) &&
    input.mode === "render" &&
    input.planApproved &&
    input.rightsConfirmed &&
    (input.options.createRenderJob ?? true)
  );
}

function isCachedRemixPlan(plan: Record<string, unknown>): boolean {
  return (
    typeof plan.remixId === "string" &&
    typeof plan.durationSeconds === "number" &&
    Boolean(plan.approvalGate) &&
    Boolean(plan.captionPlan)
  );
}

function isCachedPremiumPlan(plan: Record<string, unknown>): boolean {
  return (
    Boolean(plan.editingBlueprint) &&
    Boolean(plan.narrationPlan) &&
    Boolean(plan.visualPlan)
  );
}

export function resolveBeastPlanFromCache(
  remixMode: "new" | "remix",
  cachedPlan: Record<string, unknown>
): OneClickBeastProductionResult {
  if (remixMode === "remix") {
    if (!isCachedRemixPlan(cachedPlan)) {
      throw new ValidationError(
        "beastProductionPlan invalido para remix — gere o plano novamente antes de renderizar."
      );
    }
    return summarizeBeastPlan("remix", cachedPlan as unknown as VideoRemixPlan);
  }

  if (!isCachedPremiumPlan(cachedPlan)) {
    throw new ValidationError(
      "beastProductionPlan invalido para premium reel — gere o plano novamente antes de renderizar."
    );
  }

  return summarizeBeastPlan("new", cachedPlan as unknown as PremiumReelProductionPlan);
}

export function assertBeastPlanRenderReady(beastResult: OneClickBeastProductionResult) {
  if (!beastResult.canRenderAfterManualApproval) {
    throw new ValidationError(
      beastResult.planType === "video_remix"
        ? "Remix sem fonte local disponivel. Baixe o video ou informe um caminho local antes de renderizar."
        : "Plano premium ainda nao elegivel para render apos aprovacao manual."
    );
  }
}

export function validateBeastRenderAuthorization(
  input: OneClickRunInput,
  options?: { dataBackend?: "memory" | "prisma" }
) {
  if (!isBeastOneClickMode(input)) {
    throw new ValidationError("Beast render authorization applies only to beast remix modes.");
  }

  if (input.mode !== "render") {
    throw new ValidationError("Beast render requires mode 'render'.");
  }

  if (!input.planApproved) {
    throw new ValidationError("planApproved must be true before creating a beast render job.");
  }

  if (!input.rightsConfirmed) {
    throw new ValidationError(
      "rightsConfirmed must be true before creating a beast render job."
    );
  }

  if (options?.dataBackend === "memory") {
    throw new ValidationError(
      "Beast render exige DATA_BACKEND=prisma. Reinicie a API com: $env:DATA_BACKEND='prisma'; npm run dev:api"
    );
  }
}

interface BeastSceneBeat {
  title: string;
  captionText: string;
  narrationText: string;
  durationSeconds: number;
  voicePackId: string | null;
}

function buildEmptySceneInput(beat: BeastSceneBeat) {
  return {
    title: beat.title,
    narrationText: beat.narrationText,
    captionText: beat.captionText,
    duration: beat.durationSeconds,
    emotion: null,
    assetId: null,
    generatedAssetId: null,
    generatedNarrationAssetId: null,
    characterProfileId: null,
    sfxAssetId: null,
    sfxStartTime: null,
    sfxVolume: null,
    visualPreset: null,
    visualSourceMode: "fallback_generated" as const,
    visualPrompt: beat.captionText,
    negativePrompt: null,
    visualRecipe: null,
    generationStatus: null,
    generationProvider: null,
    generationSeed: null,
    transition: null,
    captionStyle: null,
    captionPosition: null,
    captionEmphasisWords: [] as string[],
    energyLevel: null,
    narrationStatus: null,
    narrationProvider: null,
    narrationVoicePackId: beat.voicePackId
  };
}

async function normalizeProjectScenes(
  projectRepository: ProjectRepository,
  project: StudioProject,
  beats: BeastSceneBeat[]
): Promise<StudioProject> {
  const sorted = [...project.scenes].sort((left, right) => left.order - right.order);

  for (let index = beats.length; index < sorted.length; index += 1) {
    const scene = sorted[index];
    if (scene) {
      await projectRepository.deleteScene(project.id, scene.id);
    }
  }

  for (let index = 0; index < beats.length; index += 1) {
    const beat = beats[index]!;
    const existing = sorted[index];

    if (existing) {
      await projectRepository.updateScene(project.id, existing.id, {
        title: beat.title,
        captionText: beat.captionText,
        narrationText: beat.narrationText,
        narrationVoicePackId: beat.voicePackId,
        duration: beat.durationSeconds
      });
      continue;
    }

    await projectRepository.createScene(project.id, buildEmptySceneInput(beat));
  }

  return (await projectRepository.getById(project.id)) ?? project;
}

function buildRemixSceneBeats(plan: VideoRemixPlan): BeastSceneBeat[] {
  const captionScenes = plan.captionPlan.scenes.slice(0, SHORT_MAX_SCENES);
  const beatLines =
    plan.narrationPlan?.narrationBeats?.map((beat) => beat.text).filter(Boolean) ?? [];
  const narrationLines = limitNarrationLines(
    beatLines.length
      ? beatLines
      : (plan.narrationPlan?.suggestedScript.split("\n").filter(Boolean) ?? []),
    SHORT_MAX_SCENES
  );
  const voicePackId = plan.narrationPlan?.voicePackHint ?? null;
  const durationTarget = clampRemixOutputDuration(plan.durationSeconds);
  const fallbackDurations = evenSceneDurations(durationTarget, captionScenes.length);

  return captionScenes.map((captionScene, index) => {
    const narrationLine = narrationLines[index] ?? captionScene.captionText;
    const captionText = captionScene.captionText || narrationLine;
    const sceneDuration =
      captionScene.endSeconds > captionScene.startSeconds
        ? Math.max(captionScene.endSeconds - captionScene.startSeconds, 3)
        : (fallbackDurations[index] ?? 7);

    return {
      title: captionText.slice(0, 80) || `Cena ${index + 1}`,
      captionText,
      narrationText: narrationLine,
      durationSeconds: sceneDuration,
      voicePackId
    };
  });
}

function buildPremiumSceneBeats(plan: PremiumReelProductionPlan): BeastSceneBeat[] {
  const narrationLines = limitNarrationLines(
    plan.narrationPlan.suggestedScript.split("\n").filter(Boolean),
    SHORT_MAX_SCENES
  );
  const captions = limitNarrationLines(
    plan.narrationPlan.overlayCaptions,
    SHORT_MAX_SCENES
  );
  const sceneCount = Math.min(
    narrationLines.length,
    plan.editingBlueprint.sceneFlow.length,
    SHORT_MAX_SCENES
  );
  const durationTarget = clampShortDuration(plan.editingBlueprint.durationSeconds);
  const durations = evenSceneDurations(durationTarget, sceneCount);

  return Array.from({ length: sceneCount }, (_, index) => {
    const narrationLine = narrationLines[index] ?? "";
    const caption = captions[index] ?? narrationLine;

    return {
      title: caption.slice(0, 80) || `Cena ${index + 1}`,
      captionText: caption,
      narrationText: narrationLine,
      durationSeconds: durations[index] ?? 7,
      voicePackId: plan.narrationPlan.voicePackHint
    };
  });
}

export async function attachApprovedRemixAssetsToProject(
  projectRepository: ProjectRepository,
  project: StudioProject,
  assetIds: string[]
): Promise<StudioProject> {
  if (!assetIds.length) {
    return project;
  }

  const sorted = [...project.scenes].sort((left, right) => left.order - right.order);

  for (let index = 0; index < sorted.length; index += 1) {
    const scene = sorted[index];
    const assetId = assetIds[index % assetIds.length];
    if (!scene || !assetId) {
      continue;
    }

    await projectRepository.updateScene(project.id, scene.id, {
      assetId,
      visualSourceMode: "asset_only"
    });
  }

  return (await projectRepository.getById(project.id)) ?? project;
}

export async function syncProjectFromBeastPlan(
  projectRepository: ProjectRepository,
  project: StudioProject,
  beastResult: OneClickBeastProductionResult
): Promise<StudioProject> {
  if (beastResult.remixMode === "remix") {
    const plan = beastResult.plan as VideoRemixPlan;
    const beats = buildRemixSceneBeats(plan);

    await projectRepository.update(project.id, {
      musicPresetId: plan.musicPlan.musicPresetId,
      durationTarget: clampShortDuration(plan.durationSeconds)
    });

    return normalizeProjectScenes(projectRepository, project, beats);
  }

  const premiumPlan = beastResult.plan as PremiumReelProductionPlan;
  const beats = buildPremiumSceneBeats(premiumPlan);

  await projectRepository.update(project.id, {
    musicPresetId: premiumPlan.musicPlan.musicPresetId,
    durationTarget: clampShortDuration(premiumPlan.editingBlueprint.durationSeconds)
  });

  return normalizeProjectScenes(projectRepository, project, beats);
}

export async function buildBeastProductionPlan(
  project: StudioProject,
  intakeRepository: IntakeRepository,
  input: OneClickRunInput,
  defaults: { musicPresetId: string; voicePackId: string }
): Promise<OneClickBeastProductionResult> {
  if (input.beastProductionPlan && (input.remixMode === "new" || input.remixMode === "remix")) {
    const cached = resolveBeastPlanFromCache(input.remixMode, input.beastProductionPlan);
    if (input.mode === "render") {
      assertBeastPlanRenderReady(cached);
    }
    return cached;
  }

  const channelDNA = buildChannelDNAFromProject(project, defaults);
  const intensity = input.intensity ?? "extreme";
  const durationSeconds =
    input.remixMode === "remix"
      ? clampRemixOutputDuration(
          input.durationTarget ??
            project.durationTarget ??
            project.scenes.reduce((total, scene) => total + (scene.duration ?? 4), 0) ??
            SHORT_DEFAULT_DURATION_SECONDS
        )
      : clampShortDuration(
          input.durationTarget ??
            project.durationTarget ??
            project.scenes.reduce((total, scene) => total + (scene.duration ?? 4), 0) ??
            SHORT_DEFAULT_DURATION_SECONDS
        );

  if (input.remixMode === "remix") {
    const sourceUrl = input.sourceUrl?.trim();
    const inputVideoPath = input.inputVideoPath?.trim();
    const resolvedSourceUrl =
      sourceUrl ??
      (inputVideoPath && isRemixVideoUrl(inputVideoPath) ? inputVideoPath : undefined);
    const resolvedInputPath =
      inputVideoPath && !isRemixVideoUrl(inputVideoPath) ? inputVideoPath : undefined;

    if (!resolvedSourceUrl && !resolvedInputPath) {
      throw new ValidationError(
        "sourceUrl or inputVideoPath is required when remixMode is 'remix'."
      );
    }

    const remixPlan = await remixVideoFromSource(
      resolvedSourceUrl ? { sourceUrl: resolvedSourceUrl } : { inputVideoPath: resolvedInputPath! },
      {
        targetStyle: mapTargetStyleForChannel(project.channel.niche, input.targetStyle),
        newMusicPreset: input.newMusicPreset ?? defaults.musicPresetId,
        addNarration: input.addNarration ?? true,
        intensity,
        durationTarget: durationSeconds,
        channelDNA,
        autoDownload: true,
        ...(input.captionText ? { captionText: input.captionText } : {})
      }
    );

    const summarized = summarizeBeastPlan("remix", remixPlan);
    if (input.mode === "render") {
      assertBeastPlanRenderReady(summarized);
    }
    return summarized;
  }

  const candidate = await resolveBeastCandidateForNewMode(
    project,
    intakeRepository,
    input
  );
  const premiumPlan = generatePremiumReel({
    candidate,
    channelDNA,
    intensity,
    durationSeconds
  });

  const summarized = summarizeBeastPlan("new", premiumPlan);
  if (input.mode === "render") {
    assertBeastPlanRenderReady(summarized);
  }
  return summarized;
}