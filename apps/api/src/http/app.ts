import type { AssetStorage } from "../modules/assets/application/asset-storage.js";
import { createServer } from "node:http";
import type { AppEnv } from "../config/env.js";
import type { AssetRepository } from "../modules/assets/application/asset-repository.js";
import type { AudioLibraryRepository } from "../modules/audio-library/application/audio-library-repository.js";
import type { CharacterRepository } from "../modules/characters/application/character-repository.js";
import type { ChannelRepository } from "../modules/channels/application/channel-repository.js";
import type { EditorialMicroclipRepository } from "../modules/editorial-microclips/application/editorial-microclip-repository.js";
import type { EditingReferenceRepository } from "../modules/editing-references/application/editing-reference-repository.js";
import type { VisualGenerationJobRepository } from "../modules/hybrid-visual/application/visual-generation-job-repository.js";
import type { IntakeRepository } from "../modules/intake/application/intake-repository.js";
import type { NarrationJobRepository } from "../modules/narration/application/narration-job-repository.js";
import { createStudioManifest } from "../modules/projects/application/create-studio-manifest.js";
import type { ProjectRepository } from "../modules/projects/application/project-repository.js";
import type { ReelProductionRunRepository } from "../modules/reel-production/application/reel-production-run-repository.js";
import type { ResearchRepository } from "../modules/research/application/research-repository.js";
import type { RenderJobRepository } from "../modules/render-jobs/application/render-job-repository.js";
import type { RenderStorage } from "../modules/render-jobs/application/render-storage.js";
import { handleAssetMediaRoute } from "./routes/asset-media-routes.js";
import { handleAssetRoute } from "./routes/assets-routes.js";
import { handleAudioLibraryRoute } from "./routes/audio-library-routes.js";
import { handleAudioMasteringRoute } from "./routes/audio-mastering-routes.js";
import { handleAudioMoodRoute } from "./routes/audio-mood-routes.js";
import { handleCandidateMediaRoute } from "./routes/candidate-media-routes.js";
import { handleCaptionStyleRoute } from "./routes/caption-style-routes.js";
import { handleCharacterRoute } from "./routes/characters-routes.js";
import { handleChannelRoute } from "./routes/channels-routes.js";
import { handleEditorialMicroclipRoute } from "./routes/editorial-microclip-routes.js";
import { handleEditingReferenceRoute } from "./routes/editing-reference-routes.js";
import { handleHybridVisualRoute } from "./routes/hybrid-visual-routes.js";
import { handleIntakeRoute } from "./routes/intake-routes.js";
import { handleMediaCollectorRoute } from "./routes/media-collector-routes.js";
import { handleMicroclipSelectorRoute } from "./routes/microclip-selector-routes.js";
import { handleNarrationRoute } from "./routes/narration-routes.js";
import { handleProductionRoute } from "./routes/production-routes.js";
import { handlePromptEngineRoute } from "./routes/prompt-engine-routes.js";
import { handleReelProductionRoute } from "./routes/reel-production-routes.js";
import { handleReelsFactoryRoute } from "./routes/reels-factory-routes.js";
import { handleResearchRoute } from "./routes/research-routes.js";
import { handleRenderJobRoute } from "./routes/render-job-routes.js";
import { handleRenderMediaRoute } from "./routes/render-media-routes.js";
import { handleTemplateRoute } from "./routes/template-routes.js";
import { handleVideoProjectRoute } from "./routes/video-project-routes.js";
import {
  sendJson,
  sendMethodNotAllowed,
  sendNoContent
} from "./utils/http-utils.js";

type RepositoryMode = "memory" | "prisma" | "mixed";

interface AppDependencies {
  appEnv: AppEnv;
  assetStorage: AssetStorage;
  assetRepository: AssetRepository;
  audioLibraryRepository: AudioLibraryRepository;
  characterRepository: CharacterRepository;
  channelRepository: ChannelRepository;
  editorialMicroclipRepository: EditorialMicroclipRepository;
  editingReferenceRepository: EditingReferenceRepository;
  intakeRepository: IntakeRepository;
  narrationJobRepository: NarrationJobRepository;
  repositoryMode: RepositoryMode;
  projectRepository: ProjectRepository;
  reelProductionRunRepository: ReelProductionRunRepository;
  researchRepository: ResearchRepository;
  renderJobRepository: RenderJobRepository;
  renderStorage: RenderStorage;
  visualGenerationJobRepository: VisualGenerationJobRepository;
}

export function createApp({
  appEnv,
  assetStorage,
  assetRepository,
  audioLibraryRepository,
  characterRepository,
  channelRepository,
  editorialMicroclipRepository,
  editingReferenceRepository,
  intakeRepository,
  narrationJobRepository,
  repositoryMode,
  projectRepository,
  reelProductionRunRepository,
  researchRepository,
  renderJobRepository,
  renderStorage,
  visualGenerationJobRepository
}: AppDependencies) {
  return createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", "http://localhost");

    if (request.method === "OPTIONS") {
      sendNoContent(response);
      return;
    }

    if (
      await handleCharacterRoute(
        request,
        response,
        url.pathname,
        {
          assetRepository,
          characterRepository,
          intakeRepository
        }
      )
    ) {
      return;
    }

    if (
      await handleChannelRoute(
        request,
        response,
        url.pathname,
        {
          channelRepository,
          assetRepository
        }
      )
    ) {
      return;
    }

    if (
      await handleEditorialMicroclipRoute(
        request,
        response,
        url.pathname,
        {
          assetRepository,
          editorialMicroclipRepository,
          projectRepository
        }
      )
    ) {
      return;
    }

    if (
      await handleEditingReferenceRoute(
        request,
        response,
        url,
        {
          assetRepository,
          editingReferenceRepository
        }
      )
    ) {
      return;
    }

    if (
      await handleMicroclipSelectorRoute(
        request,
        response,
        url.pathname,
        {
          assetRepository,
          editorialMicroclipRepository,
          projectRepository
        }
      )
    ) {
      return;
    }

    if (
      await handleNarrationRoute(
        request,
        response,
        url,
        {
          appEnv,
          assetRepository,
          narrationJobRepository,
          projectRepository
        }
      )
    ) {
      return;
    }

    if (
      await handleProductionRoute(
        request,
        response,
        url.pathname,
        {
          assetRepository,
          channelRepository,
          projectRepository
        }
      )
    ) {
      return;
    }

    if (
      await handleReelProductionRoute(
        request,
        response,
        url.pathname,
        {
          appEnv,
          assetRepository,
          audioLibraryRepository,
          characterRepository,
          editorialMicroclipRepository,
          narrationJobRepository,
          projectRepository,
          renderJobRepository,
          renderStorage,
          runRepository: reelProductionRunRepository,
          visualGenerationJobRepository
        }
      )
    ) {
      return;
    }

    if (
      await handleReelsFactoryRoute(
        request,
        response,
        url.pathname,
        {
          channelRepository,
          editingReferenceRepository,
          projectRepository
        }
      )
    ) {
      return;
    }

    if (
      await handleMediaCollectorRoute(
        request,
        response,
        url.pathname,
        {
          assetRepository,
          assetStorage,
          channelRepository,
          intakeRepository,
          projectRepository,
          researchRepository
        }
      )
    ) {
      return;
    }

    if (
      await handleResearchRoute(
        request,
        response,
        url.pathname,
        {
          assetRepository,
          channelRepository,
          projectRepository,
          researchRepository
        }
      )
    ) {
      return;
    }

    if (await handleTemplateRoute(request, response, url.pathname)) {
      return;
    }

    if (await handleAudioMasteringRoute(request, response, url.pathname)) {
      return;
    }

    if (
      await handleAudioLibraryRoute(
        request,
        response,
        url,
        {
          assetRepository,
          audioLibraryRepository,
          editorialMicroclipRepository,
          projectRepository
        }
      )
    ) {
      return;
    }

    if (await handleAudioMoodRoute(request, response, url.pathname)) {
      return;
    }

    if (await handleCaptionStyleRoute(request, response, url.pathname)) {
      return;
    }

    if (
      await handlePromptEngineRoute(
        request,
        response,
        url.pathname,
        {
          characterRepository,
          projectRepository,
          researchRepository
        }
      )
    ) {
      return;
    }

    if (
      await handleHybridVisualRoute(
        request,
        response,
        url,
        {
          appEnv,
          assetRepository,
          characterRepository,
          projectRepository,
          researchRepository,
          visualGenerationJobRepository
        }
      )
    ) {
      return;
    }

    if (
      await handleAssetRoute(
        request,
        response,
        url,
        assetRepository,
        assetStorage
      )
    ) {
      return;
    }

    if (
      await handleIntakeRoute(
        request,
        response,
        url,
        {
          assetRepository,
          intakeRepository
        }
      )
    ) {
      return;
    }

    if (
      await handleAssetMediaRoute(
        request,
        response,
        url.pathname,
        assetRepository,
        assetStorage
      )
    ) {
      return;
    }

    if (
      await handleCandidateMediaRoute(
        request,
        response,
        url.pathname,
        intakeRepository
      )
    ) {
      return;
    }

    if (
      await handleRenderMediaRoute(
        request,
        response,
        url.pathname,
        renderJobRepository,
        renderStorage
      )
    ) {
      return;
    }

    if (
      await handleVideoProjectRoute(request, response, url.pathname, {
        assetRepository,
        channelRepository,
        editorialMicroclipRepository,
        projectRepository,
        renderJobRepository,
        renderStorage
      })
    ) {
      return;
    }

    if (
      await handleRenderJobRoute(
        request,
        response,
        url.pathname,
        {
          assetRepository,
          editorialMicroclipRepository,
          projectRepository,
          renderJobRepository,
          renderStorage
        }
      )
    ) {
      return;
    }

    if (url.pathname === "/health") {
      if (request.method !== "GET") {
        sendMethodNotAllowed(response, ["GET"]);
        return;
      }

      sendJson(response, 200, {
        status: "ok",
        app: "ReelForge API",
        phase: "render-engine-v1-plus-cinematic-v2",
        dataBackend: repositoryMode
      });
      return;
    }

    if (url.pathname === "/studio/manifest") {
      if (request.method !== "GET") {
        sendMethodNotAllowed(response, ["GET"]);
        return;
      }

      sendJson(
        response,
        200,
        await createStudioManifest(projectRepository)
      );
      return;
    }

    if (url.pathname === "/projects") {
      if (request.method !== "GET") {
        sendMethodNotAllowed(response, ["GET"]);
        return;
      }

      sendJson(response, 200, await projectRepository.list());
      return;
    }

    sendJson(response, 404, {
      error: "Route not found",
      availableRoutes: [
        "/health",
        "/studio/manifest",
        "/projects",
        "/video-projects",
        "/video-projects/:id",
        "/video-projects/:id/story-analysis",
        "/video-projects/:id/caption-analysis",
        "/video-projects/:id/production-checklist",
        "/video-projects/:id/asset-suggestions",
        "/video-projects/:id/apply-channel-defaults",
        "/video-projects/:id/create-media-collection-for-missing-assets",
        "/video-projects/:id/missing-visual-report",
        "/video-projects/:id/generate-missing-visuals",
        "/video-projects/:id/render-blueprint",
        "/video-projects/:id/render-jobs",
        "/video-projects/:id/scenes",
        "/video-projects/:id/scenes/:sceneId",
        "/video-projects/:id/scenes/reorder",
        "/render-jobs",
        "/render-jobs/:id",
        "/render-jobs/:id/cancel",
        "/render-jobs/:id/retry",
        "/channels",
        "/characters",
        "/characters/:id",
        "/characters/:id/build-base-prompt",
        "/characters/:id/references",
        "/characters/:id/references/:referenceId",
        "/characters/create-from-intake/:slug",
        "/templates",
        "/templates/:id",
        "/audio-moods",
        "/audio-moods/:id",
        "/audio/music-presets",
        "/audio/music-presets/:id",
        "/audio/music-library",
        "/audio/music-library/analyze/:assetId",
        "/audio/music-library/:assetId/profile",
        "/audio/sfx-library",
        "/audio/sfx-library/:assetId/profile",
        "/audio/select-music",
        "/audio/beat-sync-plan",
        "/editing-references",
        "/editing-references/:id",
        "/editing-references/:id/analyze",
        "/editing-references/:id/build-preset",
        "/editing-reference-presets",
        "/editing-reference-presets/:id",
        "/editing-reference-presets/suggestions",
        "/editorial-microclips/project/:projectId",
        "/editorial-microclips/:id",
        "/microclip-selector/analyze",
        "/microclip-selector/apply",
        "/caption-styles",
        "/caption-styles/:id",
        "/prompt-packs",
        "/prompt-packs/:id",
        "/negative-prompt-packs",
        "/negative-prompt-packs/:id",
        "/prompt-engine/build",
        "/assets",
        "/assets/upload",
        "/visual-source-modes",
        "/visual-generation/providers",
        "/visual-generation/providers/comfyui-local/status",
        "/visual-generation/providers/comfyui-local/test",
        "/visual-generation/providers/comfyui-local/validate-workflow",
        "/visual-generation/gallery",
        "/visual-generation/jobs",
        "/visual-generation/jobs/:id",
        "/visual-generation/jobs/:id/cancel",
        "/visual-generation/jobs/:id/mark-reviewed",
        "/visual-generation/jobs/:id/regenerate",
        "/scenes/:sceneId/build-visual-prompt",
        "/scenes/:sceneId/generated-images",
        "/scenes/:sceneId/generate-visual",
        "/scenes/:sceneId/use-generated-image/:assetId",
        "/research/asset-requirements/:id/build-visual-prompt",
        "/intake/folders",
        "/intake/scan",
        "/intake/collections",
        "/intake/collections/:id",
        "/intake/candidates",
        "/intake/candidates/:id",
        "/intake/candidates/:id/approve",
        "/intake/candidates/:id/reject",
        "/intake/import-approved",
        "/media-collector/providers",
        "/media-collector/manual-url",
        "/media-collections",
        "/media-collections/:id",
        "/media-collections/:id/search",
        "/media-collections/:id/candidates",
        "/media-collections/:id/import-approved",
        "/media-candidates/:id",
        "/media-candidates/:id/approve",
        "/media-candidates/:id/reject",
        "/research/dossiers",
        "/research/dossiers/:id",
        "/research/asset-requirements/:id/create-media-collection",
        "/research/dossiers/:id/create-media-collections-for-requirements",
        "/research/dossiers/:id/generate-search-queries",
        "/research/dossiers/:id/sources",
        "/research/dossiers/:id/sources/manual",
        "/research/dossiers/:id/sources/fetch-url",
        "/research/dossiers/:id/sources/search-wikipedia",
        "/research/dossiers/:id/sources/search-wikidata",
        "/research/sources/:id",
        "/research/sources/:id/approve",
        "/research/sources/:id/reject",
        "/research/dossiers/:id/analyze",
        "/research/dossiers/:id/facts",
        "/research/dossiers/:id/timeline",
        "/research/dossiers/:id/hooks",
        "/research/dossiers/:id/asset-requirements",
        "/research/dossiers/:id/outline",
        "/research/dossiers/:id/create-production",
        "/research/asset-requirements/:id/generate-visual",
        "/production/create-from-script",
        "/reel-production/projects/:projectId/checklist",
        "/reel-production/projects/:projectId/run",
        "/reel-production/projects/:projectId/runs",
        "/reel-production/runs/:id",
        "/reel-production/runs/:id/cancel",
        "/reels-factory/templates",
        "/reels-factory/templates/:id",
        "/reels-factory/preview",
        "/reels-factory/create-project",
        "/reels-factory/create-batch",
        "/video-projects/:id/audio-plan",
        "/media/assets/:assetId",
        "/media/candidates/:candidateId/preview",
        "/media/renders/:renderJobId",
        "/media/renders/:renderJobId/log",
        "/media/renders/:renderJobId/thumbnail"
      ]
    });
  });
}

