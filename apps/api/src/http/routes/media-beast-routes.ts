import {
  buildEditorialShortPack,
  createChannelDNA,
  createMediaBeastEngine,
  distributeDailyBeastPlans,
  generateDailyBatch,
  getMediaBeastNichePresetById,
  listMediaBeastProviders,
  listMediaBeastNichePresets,
  mediaBeastNiches,
  mediaBeastProviderIds,
  mineComicStoryVaultFromDirectory,
  remixTargetStyles,
  rebuildRemixNarrationWithResearch,
  remixVideoFromSource,
  runDeepRemixResearch,
  type BeastModeDiscoveryInput,
  type VideoRemixAnalysis,
  type ChannelDNA,
  type MediaBeastCandidate,
  type MediaBeastNiche,
  type MediaBeastProviderId,
  type RemixAssetSearchCandidate
} from "@reelforge/media-beast";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { AssetRepository } from "../../modules/assets/application/asset-repository.js";
import { importApprovedRemixAssets } from "../../modules/reel-production/application/remix-asset-import-service.js";
import { ValidationError } from "../../shared/errors.js";
import {
  handleRouteError,
  readJsonBody,
  sendJson,
  sendMethodNotAllowed
} from "../utils/http-utils.js";

function readString(value: unknown, fieldName: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ValidationError(`${fieldName} is required.`);
  }

  return value.trim();
}

function readOptionalString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function readOptionalMusicPreset(value: unknown) {
  return readOptionalString(value);
}

function readPositiveInteger(value: unknown, fallback: number) {
  if (value === undefined || value === null) {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new ValidationError("Expected a positive integer.");
  }

  return parsed;
}

function readBoolean(value: unknown, fallback = false) {
  if (value === undefined || value === null) {
    return fallback;
  }

  if (typeof value === "boolean") {
    return value;
  }

  throw new ValidationError("Expected a boolean value.");
}

function readRemixTargetStyle(value: unknown) {
  if (typeof value !== "string" || !remixTargetStyles.includes(value as (typeof remixTargetStyles)[number])) {
    throw new ValidationError(
      `targetStyle must be one of: ${remixTargetStyles.join(", ")}.`
    );
  }

  return value as (typeof remixTargetStyles)[number];
}

function readIntensity(value: unknown): "medium" | "extreme" {
  if (value === undefined || value === null || value === "") {
    return "medium";
  }

  if (value === "medium" || value === "extreme") {
    return value;
  }

  throw new ValidationError("intensity must be 'medium' or 'extreme'.");
}

function isMediaBeastNiche(value: unknown): value is MediaBeastNiche {
  return (
    typeof value === "string" &&
    mediaBeastNiches.includes(value as MediaBeastNiche)
  );
}

function resolveNicheIdentifier(value: unknown): MediaBeastNiche[] {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ValidationError(`Unsupported media-beast niche '${String(value)}'.`);
  }

  const trimmed = value.trim();
  if (isMediaBeastNiche(trimmed)) {
    return [trimmed];
  }

  const preset = getMediaBeastNichePresetById(trimmed);
  if (preset) {
    return preset.niches;
  }

  throw new ValidationError(`Unsupported media-beast niche '${trimmed}'.`);
}

function resolvePrimaryNiche(value: unknown): MediaBeastNiche {
  const niches = resolveNicheIdentifier(value);
  return niches[0] ?? "generic_broll";
}

function readNiches(value: unknown): MediaBeastNiche[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new ValidationError("niches must be a non-empty array.");
  }

  const niches = value.flatMap((item) => resolveNicheIdentifier(item));
  return [...new Set(niches)];
}

function resolveNiches(payload: Record<string, unknown>): MediaBeastNiche[] {
  const presetId = readOptionalString(payload.nichePresetId);
  if (presetId) {
    const preset = getMediaBeastNichePresetById(presetId);
    if (!preset) {
      throw new ValidationError(`Unsupported media-beast niche preset '${presetId}'.`);
    }

    return preset.niches;
  }

  return readNiches(payload.niches);
}

function readStringArray(value: unknown, fieldName: string) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new ValidationError(`${fieldName} must be an array of strings.`);
  }

  return value.map((item) => item.trim()).filter(Boolean);
}

function readProviderIds(value: unknown): MediaBeastProviderId[] {
  return readStringArray(value, "providerIds").map((providerId) => {
    if (!mediaBeastProviderIds.includes(providerId as MediaBeastProviderId)) {
      throw new ValidationError(`Unsupported media-beast provider '${providerId}'.`);
    }

    return providerId as MediaBeastProviderId;
  });
}

function readCandidate(value: unknown): MediaBeastCandidate {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ValidationError("candidate object is required.");
  }

  const candidate = value as Partial<MediaBeastCandidate>;
  if (!candidate.id || !candidate.providerId || !candidate.title) {
    throw new ValidationError("candidate must include id, providerId and title.");
  }

  return {
    id: readString(candidate.id, "candidate.id"),
    providerId: candidate.providerId,
    kind: candidate.kind ?? "webpage",
    title: readString(candidate.title, "candidate.title"),
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
  } as MediaBeastCandidate;
}

function readChannelDNA(value: unknown): ChannelDNA {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ValidationError("channelDNA object is required.");
  }

  const channel = value as Partial<ChannelDNA>;
  if (!channel.id || !channel.name || channel.niche === undefined) {
    throw new ValidationError("channelDNA must include id, name and supported niche.");
  }

  return createChannelDNA({
    ...channel,
    id: channel.id,
    name: channel.name,
    niche: resolvePrimaryNiche(channel.niche)
  });
}

function resolveChannelDNA(
  payload: Record<string, unknown>,
  fallbackNiche: MediaBeastNiche
): ChannelDNA | null {
  if (payload.channelDNA !== undefined) {
    return readChannelDNA(payload.channelDNA);
  }

  const channelId = readOptionalString(payload.channelId);
  if (!channelId) {
    return null;
  }

  return createChannelDNA({
    id: channelId,
    name: readOptionalString(payload.channelName) ?? channelId,
    niche: fallbackNiche
  });
}

function buildRiskPolicyGate(result: {
  safetyReview: Array<{
    allowedForAutoImport: boolean;
    allowedForManualReview: boolean;
    riskLevel: string;
  }>;
}) {
  const autoImportCount = result.safetyReview.filter(
    (review) => review.allowedForAutoImport
  ).length;
  if (autoImportCount > 0) {
    throw new ValidationError(
      "Media Beast risk-policy violation: auto-import plans are not allowed."
    );
  }

  return {
    candidateFirst: true,
    requiresManualApproval: true,
    autoImportCount,
    manualReviewCount: result.safetyReview.filter(
      (review) => review.allowedForManualReview
    ).length,
    blockedCount: result.safetyReview.filter(
      (review) => review.riskLevel === "blocked"
    ).length,
    note:
      "Discovery and transform plans are safe to review, but final render remains blocked until manual approval."
  };
}

interface MediaBeastRouteDependencies {
  assetRepository: AssetRepository;
}

const REMIX_ASSET_PURPOSES = [
  "archive_reference",
  "comic_panel",
  "sports_photo",
  "broll_mood",
  "differentiation",
  "character_art",
  "documentary_still"
] as const;

function readRemixAssetPurpose(value: unknown): RemixAssetSearchCandidate["purpose"] {
  if (
    typeof value === "string" &&
    REMIX_ASSET_PURPOSES.includes(value as (typeof REMIX_ASSET_PURPOSES)[number])
  ) {
    return value as RemixAssetSearchCandidate["purpose"];
  }
  return "differentiation";
}

function readRemixAssetCandidates(payload: Record<string, unknown>): RemixAssetSearchCandidate[] {
  if (!Array.isArray(payload.candidates)) {
    throw new ValidationError("candidates must be an array.");
  }

  return payload.candidates.map((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new ValidationError(`candidates[${index}] must be an object.`);
    }

    const record = item as Record<string, unknown>;
    const candidateId = readString(record.candidateId, `candidates[${index}].candidateId`);
    const providerId = readString(record.providerId, `candidates[${index}].providerId`);
    const title = readString(record.title, `candidates[${index}].title`);
    const sourceUrl = readString(record.sourceUrl, `candidates[${index}].sourceUrl`);

    return {
      candidateId,
      providerId,
      title,
      sourceUrl,
      previewUrl:
        typeof record.previewUrl === "string" && record.previewUrl.trim()
          ? record.previewUrl.trim()
          : null,
      query: readOptionalString(record.query) ?? title,
      score: Number(record.score ?? 0),
      qualityScore: Number(record.qualityScore ?? record.score ?? 0),
      recommended: readBoolean(record.recommended, false),
      defaultSelected: readBoolean(record.defaultSelected, false),
      importReady: readBoolean(record.importReady, true),
      purpose: readRemixAssetPurpose(record.purpose),
      licenseStatus:
        typeof record.licenseStatus === "string" ? record.licenseStatus : "unknown",
      riskLevel: typeof record.riskLevel === "string" ? record.riskLevel : "medium",
      providerTier:
        record.providerTier === "premium_archive" ||
        record.providerTier === "editorial_photo" ||
        record.providerTier === "comic_reference" ||
        record.providerTier === "generic_lead"
          ? record.providerTier
          : "generic_lead",
      relevanceScore: Number(record.relevanceScore ?? record.score ?? 0),
      combinedScore: Number(record.combinedScore ?? record.qualityScore ?? record.score ?? 0),
      previewAvailable: readBoolean(record.previewAvailable, Boolean(record.previewUrl)),
      suggestedSceneRole:
        typeof record.suggestedSceneRole === "string" && record.suggestedSceneRole.trim()
          ? record.suggestedSceneRole.trim()
          : "context"
    };
  });
}

export async function handleMediaBeastRoute(
  request: IncomingMessage,
  response: ServerResponse,
  pathname: string,
  dependencies: MediaBeastRouteDependencies
): Promise<boolean> {
  try {
    if (pathname === "/media-beast/providers") {
      if (request.method !== "GET") {
        sendMethodNotAllowed(response, ["GET"]);
        return true;
      }

      sendJson(
        response,
        200,
        {
          providers: listMediaBeastProviders().map((provider) => provider.descriptor),
          nichePresets: listMediaBeastNichePresets(),
          candidateFirst: true
        }
      );
      return true;
    }

    if (pathname === "/media-beast/editorial-short") {
      if (request.method !== "POST") {
        sendMethodNotAllowed(response, ["POST"]);
        return true;
      }

      const payload = await readJsonBody<Record<string, unknown>>(request);
      const query = readString(payload.query, "query");
      const nichePresetId =
        readOptionalString(payload.nichePresetId) ?? "serial_killers";
      const preset = getMediaBeastNichePresetById(nichePresetId);
      if (!preset) {
        throw new ValidationError(`Unsupported media-beast niche preset '${nichePresetId}'.`);
      }

      const engine = createMediaBeastEngine();
      const pack = await buildEditorialShortPack(engine, {
        query,
        nichePresetId,
        durationSeconds: readPositiveInteger(payload.durationSeconds, 50),
        targetCandidateCount: readPositiveInteger(payload.targetCandidateCount, 12),
        language: readOptionalString(payload.language) ?? "pt-BR"
      });

      sendJson(response, 200, {
        ...pack,
        candidateFirst: true,
        shortAngleCount: pack.shortAngles.length
      });
      return true;
    }


    if (pathname === "/media-beast/comic-story-mine") {
      if (request.method !== "POST") {
        sendMethodNotAllowed(response, ["POST"]);
        return true;
      }

      const payload = await readJsonBody<Record<string, unknown>>(request);
      const assetDirectory = readString(payload.assetDirectory, "assetDirectory");
      const maxOpportunities = Math.min(readPositiveInteger(payload.maxOpportunities, 50), 100);
      const minScoreRaw = payload.minScore === undefined || payload.minScore === null ? 60 : Number(payload.minScore);
      if (!Number.isFinite(minScoreRaw) || minScoreRaw < 0 || minScoreRaw > 100) {
        throw new ValidationError("minScore must be between 0 and 100.");
      }

      const report = await mineComicStoryVaultFromDirectory({
        assetDirectory,
        maxOpportunities,
        minScore: minScoreRaw
      });

      sendJson(response, 200, {
        ...report,
        riskPolicyGate: {
          candidateFirst: true,
          requiresManualApproval: true,
          autoImportCount: 0,
          note: "Comic Story Miner only returns short opportunities from local authorized/indexed comic panels. Nothing is rendered or imported automatically."
        }
      });
      return true;
    }

    if (pathname === "/media-beast/discover") {
      if (request.method !== "POST") {
        sendMethodNotAllowed(response, ["POST"]);
        return true;
      }

      const payload = await readJsonBody<Record<string, unknown>>(request);
      const engine = createMediaBeastEngine();
      const niches = resolveNiches(payload);
      const channelDNA = resolveChannelDNA(payload, niches[0] ?? "generic_broll");
      const intensity = readIntensity(payload.intensity);
      const targetCount = readPositiveInteger(payload.targetCount, 10);
      const query = readString(payload.query, "query");

      if (channelDNA) {
        const transformed = await engine.discoverAndTransform(
          query,
          niches,
          targetCount,
          channelDNA,
          intensity
        );
        sendJson(response, 200, {
          ...transformed,
          intensity,
          riskPolicyGate: buildRiskPolicyGate(transformed)
        });
        return true;
      }

      const discoveryInput: BeastModeDiscoveryInput = {
        query,
        niches,
        targetCount
      };
      const language = readOptionalString(payload.language);
      if (language) {
        discoveryInput.language = language;
      }

      if (Array.isArray(payload.providerIds)) {
        discoveryInput.providerIds = readProviderIds(payload.providerIds);
      }

      const result = await engine.discoverAndPlan(discoveryInput);
      sendJson(response, 200, {
        ...result,
        intensity,
        riskPolicyGate: buildRiskPolicyGate(result)
      });
      return true;
    }

    if (pathname === "/media-beast/transform-plan") {
      if (request.method !== "POST") {
        sendMethodNotAllowed(response, ["POST"]);
        return true;
      }

      const payload = await readJsonBody<Record<string, unknown>>(request);
      const engine = createMediaBeastEngine();
      const plan = engine.transformForReel(
        readCandidate(payload.candidate),
        readChannelDNA(payload.channelDNA),
        readIntensity(payload.intensity)
      );
      const riskPolicyGate = buildRiskPolicyGate({
        safetyReview: [plan.safetyReview]
      });
      sendJson(response, 200, {
        ...plan,
        riskPolicyGate
      });
      return true;
    }

    if (pathname === "/media-beast/remix-video") {
      if (request.method !== "POST") {
        sendMethodNotAllowed(response, ["POST"]);
        return true;
      }

      const payload = await readJsonBody<Record<string, unknown>>(request);
      const sourceUrl = readOptionalString(payload.sourceUrl);
      const inputVideoPath = readOptionalString(payload.inputVideoPath);

      if (!sourceUrl && !inputVideoPath) {
        throw new ValidationError("Provide sourceUrl or inputVideoPath.");
      }

      if (sourceUrl && inputVideoPath) {
        throw new ValidationError("Provide only one of sourceUrl or inputVideoPath.");
      }

      const remixOptions: Parameters<typeof remixVideoFromSource>[1] = {
        targetStyle: readRemixTargetStyle(payload.targetStyle),
        intensity: readIntensity(payload.intensity),
        durationTarget: Math.min(
          readPositiveInteger(payload.durationTarget, 35),
          45
        ),
        autoDownload: readBoolean(payload.autoDownload, true),
        enableAssetDiscovery: readBoolean(payload.enableAssetDiscovery, true),
        executeAssetDiscovery: readBoolean(payload.executeAssetDiscovery, true),
        variationCount: Math.min(
          readPositiveInteger(payload.variationCount, 1),
          3
        )
      };

      const newMusicPreset = readOptionalMusicPreset(payload.newMusicPreset);
      if (newMusicPreset) {
        remixOptions.newMusicPreset = newMusicPreset;
      }

      if (payload.addNarration !== undefined && payload.addNarration !== null) {
        remixOptions.addNarration = readBoolean(payload.addNarration);
      }

      if (payload.enableResearch !== undefined && payload.enableResearch !== null) {
        remixOptions.enableResearch = readBoolean(payload.enableResearch, true);
      }

      if (payload.deepResearch !== undefined && payload.deepResearch !== null) {
        remixOptions.deepResearch = readBoolean(payload.deepResearch);
      }

      if (Array.isArray(payload.selectedCuriosityIds)) {
        remixOptions.selectedCuriosityIds = payload.selectedCuriosityIds.filter(
          (item): item is string => typeof item === "string" && item.trim().length > 0
        );
      }

      if (payload.channelDNA !== undefined) {
        remixOptions.channelDNA = readChannelDNA(payload.channelDNA);
      }

      const captionText = readOptionalString(payload.captionText);
      if (captionText) {
        remixOptions.captionText = captionText;
      }

      const language = readOptionalString(payload.language);
      if (language) {
        remixOptions.language = language;
      }

      const maxDownloadDurationSeconds = readOptionalString(payload.maxDownloadDurationSeconds);
      const parsedMaxDownload = maxDownloadDurationSeconds
        ? Number(maxDownloadDurationSeconds)
        : 60;
      if (!Number.isInteger(parsedMaxDownload) || parsedMaxDownload <= 0) {
        throw new ValidationError("maxDownloadDurationSeconds must be a positive integer.");
      }
      remixOptions.downloadOptions = {
        maxDurationSeconds: Math.min(parsedMaxDownload, 60)
      };

      const remixPlan = await remixVideoFromSource(
        sourceUrl ? { sourceUrl } : { inputVideoPath: inputVideoPath! },
        remixOptions
      );

      sendJson(response, 200, {
        ...remixPlan,
        riskPolicyGate: {
          candidateFirst: true,
          requiresManualApproval: true,
          requiresSourceRightsConfirmation: true,
          autoImportCount: 0,
          manualReviewCount: 1,
          blockedCount: remixPlan.sourceResolution.kind === "public_url" ? 1 : 0,
          note:
            remixPlan.sourceResolution.kind === "public_url"
              ? "Public URL was downloaded to staging for planning only. Render stays blocked until manual approval and rights confirmation."
              : "Video Remixer returns a blueprint only. Render stays blocked until manual approval and rights confirmation."
        }
      });
      return true;
    }

    if (pathname === "/media-beast/remix-video/research") {
      if (request.method !== "POST") {
        sendMethodNotAllowed(response, ["POST"]);
        return true;
      }

      const payload = await readJsonBody<Record<string, unknown>>(request);
      const videoAnalysis = payload.videoAnalysis;
      if (!videoAnalysis || typeof videoAnalysis !== "object") {
        throw new ValidationError("videoAnalysis is required.");
      }

      const deepResearch = readBoolean(payload.deepResearch, true);
      const selectedCuriosityIds = Array.isArray(payload.selectedCuriosityIds)
        ? payload.selectedCuriosityIds.filter(
            (item): item is string => typeof item === "string" && item.trim().length > 0
          )
        : undefined;

      const targetStyle = readOptionalString(payload.targetStyle);
      const researchDossier = runDeepRemixResearch(videoAnalysis as VideoRemixAnalysis, {
        ...(selectedCuriosityIds ? { selectedCuriosityIds } : {}),
        ...(targetStyle && remixTargetStyles.includes(targetStyle as (typeof remixTargetStyles)[number])
          ? { targetStyle: targetStyle as (typeof remixTargetStyles)[number] }
          : {}),
        language: readOptionalString(payload.language) ?? "pt-BR"
      });

      const rebuildNarration = readBoolean(payload.rebuildNarration, false);
      let narrationPlan = null;
      if (rebuildNarration) {
        const channelDNA = payload.channelDNA
          ? readChannelDNA(payload.channelDNA)
          : createChannelDNA({
              id: "remix-research",
              name: "Remix Research",
              niche: "generic_broll",
              dailyShortTarget: 3
            });
        const targetStyle = readRemixTargetStyle(
          payload.targetStyle ?? remixTargetStyles[0]
        );
        const maxDurationSeconds = Math.min(
          readPositiveInteger(payload.maxDurationSeconds, 40),
          45
        );

        narrationPlan = rebuildRemixNarrationWithResearch({
          analysis: {
            ...(videoAnalysis as VideoRemixAnalysis),
            researchDossier
          },
          channelDNA,
          targetStyle,
          maxDurationSeconds,
          researchDossier,
          selectedCuriosityIds: researchDossier.selectedCuriosityIds
        });
      }

      sendJson(response, 200, {
        researchDossier,
        narrationPlan,
        candidateFirst: true,
        note: "Research dossier generated from remix analysis heuristics. Confirm facts before publishing."
      });
      return true;
    }

    if (pathname === "/media-beast/remix-video/import-assets") {
      if (request.method !== "POST") {
        sendMethodNotAllowed(response, ["POST"]);
        return true;
      }

      const payload = await readJsonBody<Record<string, unknown>>(request);
      const remixId = readString(payload.remixId, "remixId");
      const candidates = readRemixAssetCandidates(payload);
      const contentContext =
        payload.contentContext && typeof payload.contentContext === "object"
          ? (payload.contentContext as Record<string, unknown>)
          : null;
      const sceneRoles = Array.isArray(payload.sceneRoles)
        ? payload.sceneRoles.filter((item): item is string => typeof item === "string")
        : undefined;

      const contentContextPayload = contentContext
        ? {
            ...(readOptionalString(contentContext.headline)
              ? { headline: readOptionalString(contentContext.headline)! }
              : {}),
            ...(readOptionalString(contentContext.domain)
              ? { domain: readOptionalString(contentContext.domain)! }
              : {}),
            ...(Array.isArray(contentContext.entities)
              ? {
                  entities: contentContext.entities.filter(
                    (item): item is string => typeof item === "string"
                  )
                }
              : {})
          }
        : null;

      const result = await importApprovedRemixAssets(dependencies.assetRepository, {
        remixId,
        candidates,
        ...(contentContextPayload && Object.keys(contentContextPayload).length
          ? { contentContext: contentContextPayload }
          : {}),
        ...(sceneRoles ? { sceneRoles } : {})
      });

      sendJson(response, 200, {
        ...result,
        candidateFirst: true,
        note: "Assets imported after explicit user approval. Review license/risk before render."
      });
      return true;
    }

    if (pathname === "/media-beast/daily-batch") {
      if (request.method !== "POST") {
        sendMethodNotAllowed(response, ["POST"]);
        return true;
      }

      const payload = await readJsonBody<Record<string, unknown>>(request);
      const countPerChannel = readPositiveInteger(payload.countPerChannel, 5);
      if (Array.isArray(payload.channels)) {
        const channels = payload.channels.map((channel) => readChannelDNA(channel));
        const candidates = Array.isArray(payload.candidates)
          ? payload.candidates.map((candidate) => readCandidate(candidate))
          : [];
        sendJson(
          response,
          200,
          {
            ...distributeDailyBeastPlans({
              channels,
              candidates,
              countPerChannel
            }),
            riskPolicyGate: {
              candidateFirst: true,
              requiresManualApproval: true
            }
          }
        );
        return true;
      }

      sendJson(
        response,
        200,
        generateDailyBatch(
          readStringArray(payload.channelIds, "channelIds"),
          countPerChannel
        )
      );
      return true;
    }

    return false;
  } catch (error) {
    handleRouteError(response, error);
    return true;
  }
}
