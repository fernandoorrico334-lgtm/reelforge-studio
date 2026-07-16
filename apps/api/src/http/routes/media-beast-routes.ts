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
  buildComicIngestionPlan,
  buildComicBatchProjectBridgePayload,
  buildComicArcProjectsFromMinerV2,
  buildComicShortsBatchFactoryPlan,
  ingestLocalComicSource,
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
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import { extname, resolve, sep } from "node:path";
import type { AssetRepository } from "../../modules/assets/application/asset-repository.js";
import type { ChannelRepository } from "../../modules/channels/application/channel-repository.js";
import type { ProjectRepository } from "../../modules/projects/application/project-repository.js";
import { createProjectScene, createVideoProject } from "../../modules/projects/application/project-service.js";
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

function readOptionalStringArray(value: unknown, fieldName: string): string[] | undefined {
  if (value === undefined || value === null) return undefined;
  return readStringArray(value, fieldName);
}

function readApprovedPanelIdsByArc(value: unknown): Record<string, string[]> {
  if (value === undefined || value === null) return {};
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ValidationError("approvedPanelIdsByArcId must be an object keyed by arc id.");
  }

  const result: Record<string, string[]> = {};
  for (const [arcId, panelIds] of Object.entries(value)) {
    result[arcId] = readStringArray(panelIds, `approvedPanelIdsByArcId.${arcId}`);
  }
  return result;
}

function readPanelReplacementsByArc(value: unknown): Record<string, Record<string, string>> {
  if (value === undefined || value === null) return {};
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ValidationError("selectedPanelReplacementsByArcId must be an object keyed by arc id.");
  }

  const result: Record<string, Record<string, string>> = {};
  for (const [arcId, replacements] of Object.entries(value)) {
    if (!replacements || typeof replacements !== "object" || Array.isArray(replacements)) {
      throw new ValidationError(`selectedPanelReplacementsByArcId.${arcId} must be an object keyed by original panel id.`);
    }
    result[arcId] = {};
    for (const [originalPanelId, replacementPanelId] of Object.entries(replacements)) {
      result[arcId][originalPanelId] = readString(replacementPanelId, `selectedPanelReplacementsByArcId.${arcId}.${originalPanelId}`);
    }
  }
  return result;
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

type ComicArcPanelPreview = {
  panelId: string;
  pageNumber: number | null;
  panelImagePath: string | null;
  previewUrl: string | null;
  role: string | null;
  reason: string | null;
  score: number;
  alternatives: ComicArcPanelAlternative[];
};

type ComicArcPanelAlternative = {
  panelId: string;
  pageNumber: number | null;
  panelImagePath: string | null;
  previewUrl: string | null;
  score: number;
  storyFunction: string | null;
  reasons: string[];
};

function normalizeWorkspacePath(localPath: string) {
  const root = resolve(process.cwd());
  const absolutePath = resolve(root, localPath);
  const rootWithSep = root.endsWith(sep) ? root : `${root}${sep}`;
  if (absolutePath !== root && !absolutePath.startsWith(rootWithSep)) {
    throw new ValidationError("Comic panel preview path must stay inside the project workspace.");
  }
  return { root, absolutePath };
}

function mediaTypeForImagePath(localPath: string) {
  const extension = extname(localPath).toLowerCase();
  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
  if (extension === ".png") return "image/png";
  if (extension === ".webp") return "image/webp";
  if (extension === ".gif") return "image/gif";
  return null;
}

function buildComicPanelPreviewUrl(panelImagePath: string | null | undefined) {
  if (!panelImagePath) return null;
  const mediaType = mediaTypeForImagePath(panelImagePath);
  if (!mediaType) return null;
  return `/media-beast/comic-panel-preview?path=${encodeURIComponent(panelImagePath)}`;
}

type ComicMinerPanelRef = Awaited<ReturnType<typeof mineComicStoryVaultFromDirectory>>["opportunities"][number]["panels"][number];

function comicPanelScore(panel: ComicMinerPanelRef | undefined) {
  if (!panel) return 0;
  const quality = panel.visualCropEvidence.quality;
  const visual = quality.visualQualityScore ?? 0;
  const crop = quality.cropability916Score ?? 0;
  const textPenalty = Math.round((quality.textHeavyRatio ?? 0) * 20);
  return Math.max(0, Math.min(100, Math.round(visual * 0.55 + crop * 0.45 - textPenalty)));
}

function buildPanelAlternative(panel: ComicMinerPanelRef): ComicArcPanelAlternative {
  const quality = panel.visualCropEvidence.quality;
  return {
    panelId: panel.panelId,
    pageNumber: panel.pageNumber ?? null,
    panelImagePath: panel.panelImagePath ?? null,
    previewUrl: buildComicPanelPreviewUrl(panel.panelImagePath),
    score: comicPanelScore(panel),
    storyFunction: panel.storyFunction ?? null,
    reasons: [
      `score_visual:${Math.round(quality.visualQualityScore ?? 0)}`,
      `crop_9_16:${Math.round(quality.cropability916Score ?? 0)}`,
      `texto:${Math.round((quality.textHeavyRatio ?? 0) * 100)}%`
    ]
  };
}

function buildArcPanelPreviews(minerReport: Awaited<ReturnType<typeof mineComicStoryVaultFromDirectory>>) {
  const allPanels = minerReport.opportunities.flatMap((opportunity) => opportunity.panels);
  const panelById = new Map(allPanels.map((panel) => [panel.panelId, panel]));

  return new Map(
    (minerReport.storyArcMinerV2?.recommendedShorts ?? []).map((arc) => {
      const arcPanelIds = new Set(arc.panelIds);
      const previews: ComicArcPanelPreview[] = arc.beats.map((beat) => {
        const panel = panelById.get(beat.panelId);
        const sourcePageNumber = panel?.pageNumber ?? beat.pageNumber;
        const samePage = allPanels.filter((candidate) => (
          candidate.panelId !== beat.panelId &&
          candidate.pageNumber === sourcePageNumber
        ));
        const sameArc = allPanels.filter((candidate) => (
          candidate.panelId !== beat.panelId &&
          arcPanelIds.has(candidate.panelId)
        ));
        const alternatives = [...samePage, ...sameArc]
          .filter((candidate, index, list) => list.findIndex((item) => item.panelId === candidate.panelId) === index)
          .sort((left, right) => comicPanelScore(right) - comicPanelScore(left))
          .slice(0, 4)
          .map(buildPanelAlternative);
        return {
          panelId: beat.panelId,
          pageNumber: panel?.pageNumber ?? beat.pageNumber ?? null,
          panelImagePath: panel?.panelImagePath ?? null,
          previewUrl: buildComicPanelPreviewUrl(panel?.panelImagePath),
          role: beat.role,
          reason: beat.reason,
          score: comicPanelScore(panel),
          alternatives
        };
      });
      return [arc.id, previews] as const;
    })
  );
}
function enrichArcStudioWithPanelPreviews(minerReport: Awaited<ReturnType<typeof mineComicStoryVaultFromDirectory>>) {
  const arcReport = minerReport.storyArcMinerV2;
  if (!arcReport) return null;
  const previewsByArcId = buildArcPanelPreviews(minerReport);
  return {
    totalArcs: arcReport.totalArcs,
    readyArcCount: arcReport.readyArcCount,
    averageScore: arcReport.averageScore,
    recommendedShorts: arcReport.recommendedShorts.map((arc) => ({
      ...arc,
      panelPreviews: previewsByArcId.get(arc.id) ?? []
    })),
    recommendedScripts: arcReport.scriptDoctor.recommendedScripts,
    warnings: arcReport.warnings
  };
}

function applyComicArcPanelReplacements<T extends {
  arcId: string;
  panelAssetManifest: Array<Record<string, unknown>>;
  scenes: Array<Record<string, unknown>>;
  renderBlueprintHints: Record<string, unknown>;
  warnings: string[];
}>(projectPayload: T, replacements: Record<string, string> | undefined, panelById: Map<string, ComicMinerPanelRef>): T {
  if (!replacements || Object.keys(replacements).length === 0) return projectPayload;

  const clone = structuredClone(projectPayload) as T;
  const replacementEntries = Object.entries(replacements).filter(([, replacementPanelId]) => panelById.has(replacementPanelId));
  if (replacementEntries.length === 0) return projectPayload;

  for (const manifest of clone.panelAssetManifest) {
    const originalPanelId = String(manifest.panelId ?? "");
    const replacementPanelId = replacements[originalPanelId];
    const replacementPanel = replacementPanelId ? panelById.get(replacementPanelId) : null;
    if (!replacementPanel) continue;
    manifest.panelId = replacementPanel.panelId;
    manifest.panelImagePath = replacementPanel.panelImagePath;
    manifest.sourcePageNumber = replacementPanel.pageNumber;
    manifest.recommendedTags = [
      ...new Set([
        ...((Array.isArray(manifest.recommendedTags) ? manifest.recommendedTags : []) as string[]),
        "comic-panel-replacement",
        `replacement-for:${originalPanelId}`,
        `replacement-page:${replacementPanel.pageNumber}`
      ])
    ];
  }

  clone.scenes = clone.scenes.map((scene) => {
    let visualRecipe: Record<string, unknown> | null = null;
    if (typeof scene.visualRecipe === "string" && scene.visualRecipe.trim()) {
      try {
        visualRecipe = JSON.parse(scene.visualRecipe) as Record<string, unknown>;
      } catch {
        visualRecipe = null;
      }
    }
    const originalPanelId = typeof visualRecipe?.panelId === "string" ? visualRecipe.panelId : null;
    const replacementPanelId = originalPanelId ? replacements[originalPanelId] : undefined;
    const replacementPanel = replacementPanelId ? panelById.get(replacementPanelId) : null;
    if (!originalPanelId || !replacementPanel) return scene;

    const visualPrompt = typeof scene.visualPrompt === "string"
      ? scene.visualPrompt.replace(originalPanelId, replacementPanel.panelId).replace(/Pagina fonte: [^.]+\./, `Pagina fonte: ${replacementPanel.pageNumber}.`)
      : scene.visualPrompt;
    return {
      ...scene,
      visualPrompt,
      visualRecipe: JSON.stringify({
        ...(visualRecipe ?? {}),
        panelId: replacementPanel.panelId,
        pageNumber: replacementPanel.pageNumber,
        originalPanelId,
        replacementPanelId: replacementPanel.panelId,
        replacementReason: "manual_visual_review_replacement",
        replacementApplied: true
      })
    };
  });

  const selectedBeats = Array.isArray(clone.renderBlueprintHints.selectedBeats)
    ? clone.renderBlueprintHints.selectedBeats.map((beat) => {
        if (!beat || typeof beat !== "object") return beat;
        const record = beat as Record<string, unknown>;
        const originalPanelId = typeof record.panelId === "string" ? record.panelId : null;
        const replacementPanelId = originalPanelId ? replacements[originalPanelId] : undefined;
        const replacementPanel = replacementPanelId ? panelById.get(replacementPanelId) : null;
        if (!originalPanelId || !replacementPanel) return beat;
        return {
          ...record,
          panelId: replacementPanel.panelId,
          pageNumber: replacementPanel.pageNumber,
          originalPanelId,
          replacementApplied: true
        };
      })
    : clone.renderBlueprintHints.selectedBeats;

  clone.renderBlueprintHints = {
    ...clone.renderBlueprintHints,
    selectedBeats,
    panelIds: clone.panelAssetManifest.map((panel) => String(panel.panelId)),
    panelReplacements: replacements
  };
  clone.warnings = [...new Set([...clone.warnings, "comic_panel_replacements_applied"] )];
  return clone;
}
async function sendComicPanelPreview(
  request: IncomingMessage,
  response: ServerResponse
) {
  const url = new URL(request.url ?? "/", "http://localhost");
  const localPath = url.searchParams.get("path");
  if (!localPath) {
    throw new ValidationError("path query parameter is required.");
  }

  const mediaType = mediaTypeForImagePath(localPath);
  if (!mediaType) {
    throw new ValidationError("Only local comic image previews are supported.");
  }

  const { absolutePath } = normalizeWorkspacePath(localPath);
  const fileInfo = await stat(absolutePath);
  if (!fileInfo.isFile()) {
    throw new ValidationError("Comic panel preview path must point to a file.");
  }

  response.writeHead(200, {
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "no-store",
    "Content-Length": fileInfo.size,
    "Content-Type": mediaType
  });

  if (request.method === "HEAD") {
    response.end();
    return;
  }

  createReadStream(absolutePath).pipe(response);
}
interface MediaBeastRouteDependencies {
  assetRepository: AssetRepository;
  channelRepository: ChannelRepository;
  projectRepository: ProjectRepository;
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
    if (pathname === "/media-beast/comic-panel-preview") {
      if (request.method !== "GET" && request.method !== "HEAD") {
        sendMethodNotAllowed(response, ["GET", "HEAD"]);
        return true;
      }
      await sendComicPanelPreview(request, response);
      return true;
    }


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




    if (pathname === "/media-beast/comic-ingestion/run") {
      if (request.method !== "POST") {
        sendMethodNotAllowed(response, ["POST"]);
        return true;
      }

      const payload = await readJsonBody<Record<string, unknown>>(request);
      const sourcePath = readString(payload.sourcePath, "sourcePath");
      const assetDirectory = readOptionalString(payload.assetDirectory);
      const comicTitle = readOptionalString(payload.comicTitle);
      const maxPages = payload.maxPages === undefined || payload.maxPages === null
        ? undefined
        : readPositiveInteger(payload.maxPages, 200);
      const buildIndex = readBoolean(payload.buildIndex, true);
      const forceRebuildIndex = readBoolean(payload.forceRebuildIndex, false);
      const ocrEnabled = readBoolean(payload.ocrEnabled, false);
      const tesseractCommand = readOptionalString(payload.tesseractCommand);
      const ocrLanguages = readOptionalString(payload.ocrLanguages);
      const pdfRasterizerCommand = readOptionalString(payload.pdfRasterizerCommand);
      const pdfDpi = payload.pdfDpi === undefined || payload.pdfDpi === null
        ? undefined
        : readPositiveInteger(payload.pdfDpi, 240);

      const result = await ingestLocalComicSource({
        sourcePath,
        ...(assetDirectory ? { assetDirectory } : {}),
        ...(comicTitle ? { comicTitle } : {}),
        ...(maxPages !== undefined ? { maxPages } : {}),
        ...(pdfRasterizerCommand ? { pdfRasterizerCommand } : {}),
        ...(pdfDpi !== undefined ? { pdfDpi } : {}),
        ...(ocrEnabled !== undefined ? { ocrEnabled } : {}),
        ...(tesseractCommand ? { tesseractCommand } : {}),
        ...(ocrLanguages ? { ocrLanguages } : {}),
        buildIndex,
        forceRebuildIndex
      });

      sendJson(response, 200, {
        ...result,
        riskPolicyGate: {
          candidateFirst: true,
          requiresManualApproval: true,
          autoRenderCount: 0,
          note: "Local comic ingestion only prepares authorized local pages and panel index. Short generation/render still requires manual approval."
        }
      });
      return true;
    }

    if (pathname === "/media-beast/comic-ingestion/plan") {
      if (request.method !== "POST") {
        sendMethodNotAllowed(response, ["POST"]);
        return true;
      }

      const payload = await readJsonBody<Record<string, unknown>>(request);
      const sourcePath = readString(payload.sourcePath, "sourcePath");
      const recommendedAssetDirectory = readOptionalString(payload.recommendedAssetDirectory);
      sendJson(response, 200, {
        ...buildComicIngestionPlan({
          sourcePath,
          ...(recommendedAssetDirectory ? { recommendedAssetDirectory } : {})
        }),
        note: "Planning only. Real files remain local and no import/render happens without approval."
      });
      return true;
    }

    if (pathname === "/media-beast/comic-shorts-factory/plan") {
      if (request.method !== "POST") {
        sendMethodNotAllowed(response, ["POST"]);
        return true;
      }

      const payload = await readJsonBody<Record<string, unknown>>(request);
      const assetDirectory = readString(payload.assetDirectory, "assetDirectory");
      const targetCount = Math.min(readPositiveInteger(payload.targetCount, 20), 50);
      const minScoreRaw = payload.minScore === undefined || payload.minScore === null ? 65 : Number(payload.minScore);
      if (!Number.isFinite(minScoreRaw) || minScoreRaw < 0 || minScoreRaw > 100) {
        throw new ValidationError("minScore must be between 0 and 100.");
      }

      const minerReport = await mineComicStoryVaultFromDirectory({
        assetDirectory,
        maxOpportunities: Math.max(targetCount * 3, 50),
        minScore: Math.max(40, minScoreRaw - 15)
      });
      const factoryPlan = buildComicShortsBatchFactoryPlan({
        minerReport,
        targetCount,
        minScore: minScoreRaw
      });

      sendJson(response, 200, {
        ...factoryPlan,
        minerSummary: {
          opportunityCount: minerReport.opportunities.length,
          topOpportunityCount: minerReport.topOpportunities.length,
          warnings: minerReport.warnings
        },
        arcStudio: enrichArcStudioWithPanelPreviews(minerReport),
        riskPolicyGate: {
          candidateFirst: true,
          requiresManualApproval: true,
          autoRenderCount: 0,
          note: "Factory returns production-ready plans for review. Rendering remains blocked until manual approval."
        }
      });
      return true;
    }

    if (pathname === "/media-beast/comic-studio/create-arc-projects") {
      if (request.method !== "POST") {
        sendMethodNotAllowed(response, ["POST"]);
        return true;
      }

      const payload = await readJsonBody<Record<string, unknown>>(request);
      const assetDirectory = readString(payload.assetDirectory, "assetDirectory");
      const channelId = readString(payload.channelId, "channelId");
      const targetCount = Math.min(readPositiveInteger(payload.targetCount, 6), 20);
      const minScoreRaw = payload.minScore === undefined || payload.minScore === null ? 65 : Number(payload.minScore);
      if (!Number.isFinite(minScoreRaw) || minScoreRaw < 0 || minScoreRaw > 100) {
        throw new ValidationError("minScore must be between 0 and 100.");
      }
      const maxProjects = Math.min(readPositiveInteger(payload.maxProjects, 3), targetCount);
      const titlePrefix = readOptionalString(payload.titlePrefix) ?? "Comic Arc";
      const templateId = readOptionalString(payload.templateId);
      const editingReferencePresetId = readOptionalString(payload.editingReferencePresetId);
      const approvedArcIds = readOptionalStringArray(payload.approvedArcIds, "approvedArcIds");
      const approvedPanelIdsByArcId = readApprovedPanelIdsByArc(payload.approvedPanelIdsByArcId);
      const selectedPanelReplacementsByArcId = readPanelReplacementsByArc(payload.selectedPanelReplacementsByArcId);

      const minerReport = await mineComicStoryVaultFromDirectory({
        assetDirectory,
        maxOpportunities: Math.max(targetCount * 4, 60),
        minScore: Math.max(40, minScoreRaw - 15)
      });
      const arcPayload = buildComicArcProjectsFromMinerV2({
        report: minerReport,
        channelId,
        maxProjects,
        titlePrefix,
        ...(templateId !== undefined ? { templateId } : {}),
        ...(editingReferencePresetId !== undefined ? { editingReferencePresetId } : {})
      });

      const panelById = new Map(
        minerReport.opportunities
          .flatMap((opportunity) => opportunity.panels)
          .map((panel) => [panel.panelId, panel])
      );
      const approvedArcSet = approvedArcIds ? new Set(approvedArcIds) : null;
      const projectPayloads = arcPayload.projects
        .filter((projectPayload) => !approvedArcSet || approvedArcSet.has(projectPayload.arcId))
        .map((projectPayload) => applyComicArcPanelReplacements(
          projectPayload,
          selectedPanelReplacementsByArcId[projectPayload.arcId],
          panelById
        ))
        .filter((projectPayload) => {
          const approvedPanelIds = approvedPanelIdsByArcId[projectPayload.arcId];
          if (!approvedPanelIds) return true;
          const approvedPanelSet = new Set(approvedPanelIds);
          return projectPayload.panelAssetManifest.every((panel) => approvedPanelSet.has(String(panel.panelId)));
        });

      if (approvedArcIds && projectPayloads.length === 0) {
        throw new ValidationError("No approved comic arc projects passed the visual review gate.");
      }

      const createdProjects = [];
      for (const projectPayload of projectPayloads) {
        const project = await createVideoProject(
          dependencies.projectRepository,
          dependencies.channelRepository,
          dependencies.assetRepository,
          projectPayload.project
        );

        const scenes = [];
        for (const scenePayload of projectPayload.scenes) {
          const scene = await createProjectScene(
            dependencies.projectRepository,
            dependencies.assetRepository,
            project.id,
            scenePayload
          );
          scenes.push(scene);
        }

        createdProjects.push({
          projectId: project.id,
          title: project.title,
          arcId: projectPayload.arcId,
          scriptDoctorId: projectPayload.scriptDoctorId,
          scenesCreated: scenes.length,
          panelAssetManifest: projectPayload.panelAssetManifest,
          renderBlueprintHints: projectPayload.renderBlueprintHints,
          qualityChecklist: projectPayload.qualityChecklist,
          warnings: projectPayload.warnings
        });
      }

      sendJson(response, 201, {
        status: "created",
        mode: "arc_project_builder_v2",
        createdCount: createdProjects.length,
        requestedCount: targetCount,
        arcSummary: {
          totalArcs: minerReport.storyArcMinerV2?.totalArcs ?? 0,
          readyArcCount: minerReport.storyArcMinerV2?.readyArcCount ?? 0,
          averageScore: minerReport.storyArcMinerV2?.averageScore ?? 0,
          recommendedScriptCount: minerReport.storyArcMinerV2?.scriptDoctor.recommendedScripts.length ?? 0
        },
        createdProjects,
        warnings: [`visual_review_gate_applied`, ...arcPayload.warnings],
        riskPolicyGate: {
          candidateFirst: true,
          requiresManualApproval: true,
          autoRenderCount: 0,
          autoImportedAssetCount: 0,
          note: "Comic Arc Builder V2 created editable projects from mined story arcs only. Panel assets still require manual review/import and render is not started."
        }
      });
      return true;
    }
    if (pathname === "/media-beast/comic-studio/create-projects") {
      if (request.method !== "POST") {
        sendMethodNotAllowed(response, ["POST"]);
        return true;
      }

      const payload = await readJsonBody<Record<string, unknown>>(request);
      const assetDirectory = readString(payload.assetDirectory, "assetDirectory");
      const channelId = readString(payload.channelId, "channelId");
      const targetCount = Math.min(readPositiveInteger(payload.targetCount, 3), 20);
      const minScoreRaw = payload.minScore === undefined || payload.minScore === null ? 65 : Number(payload.minScore);
      if (!Number.isFinite(minScoreRaw) || minScoreRaw < 0 || minScoreRaw > 100) {
        throw new ValidationError("minScore must be between 0 and 100.");
      }
      const maxProjects = Math.min(readPositiveInteger(payload.maxProjects, targetCount), targetCount);
      const titlePrefix = readOptionalString(payload.titlePrefix) ?? "HQ Short";
      const templateId = readOptionalString(payload.templateId);
      const editingReferencePresetId = readOptionalString(payload.editingReferencePresetId);
      const approvedArcIds = readOptionalStringArray(payload.approvedArcIds, "approvedArcIds");
      const approvedPanelIdsByArcId = readApprovedPanelIdsByArc(payload.approvedPanelIdsByArcId);

      const minerReport = await mineComicStoryVaultFromDirectory({
        assetDirectory,
        maxOpportunities: Math.max(targetCount * 3, 50),
        minScore: Math.max(40, minScoreRaw - 15)
      });
      const factoryPlan = buildComicShortsBatchFactoryPlan({
        minerReport,
        targetCount,
        minScore: minScoreRaw
      });
      const bridgePayload = buildComicBatchProjectBridgePayload({
        batch: factoryPlan,
        channelId,
        maxProjects,
        titlePrefix,
        ...(templateId !== undefined ? { templateId } : {}),
        ...(editingReferencePresetId !== undefined ? { editingReferencePresetId } : {})
      });

      const createdProjects = [];
      for (const projectPayload of bridgePayload.projects) {
        const project = await createVideoProject(
          dependencies.projectRepository,
          dependencies.channelRepository,
          dependencies.assetRepository,
          projectPayload.project
        );

        const scenes = [];
        for (const scenePayload of projectPayload.scenes) {
          const scene = await createProjectScene(
            dependencies.projectRepository,
            dependencies.assetRepository,
            project.id,
            scenePayload
          );
          scenes.push(scene);
        }

        createdProjects.push({
          projectId: project.id,
          title: project.title,
          shortId: projectPayload.shortId,
          sourceOpportunityId: projectPayload.sourceOpportunityId,
          scenesCreated: scenes.length,
          panelAssetManifest: projectPayload.panelAssetManifest,
          renderBlueprintHints: projectPayload.renderBlueprintHints,
          qualityChecklist: projectPayload.qualityChecklist,
          warnings: projectPayload.warnings
        });
      }

      sendJson(response, 201, {
        status: "created",
        createdCount: createdProjects.length,
        requestedCount: targetCount,
        batchOverview: bridgePayload.batchOverview,
        createdProjects,
        rejectedOpportunities: factoryPlan.rejectedOpportunities,
        riskPolicyGate: {
          candidateFirst: true,
          requiresManualApproval: true,
          autoRenderCount: 0,
          autoImportedAssetCount: 0,
          note: "Comic Studio created editable VideoProjects and scenes only. Panel assets still require manual review/import and render is not started."
        }
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




