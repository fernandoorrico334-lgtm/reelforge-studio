# Contracts Inventory

- Date: `2026-06-29`
- Recovery workspace: `C:\Users\Pichau\Documents\New project\reelforge-studio-recovered`
- Sources used:
  - `apps/api/src/modules/*/domain/*.ts`
  - `apps/api/src/modules/*/infrastructure/prisma-*.ts`
  - `packages/*/src/index.ts`
  - `docs/MODULES.md`
  - `docs/ARCHITECTURE.md`
  - `docs/ROADMAP.md`
  - `recovery/reports/current-recovery-status.md`
  - extracted candidates under `recovery/extracted-logs/files/...`

## Entities and Expected Fields

### Channel

- Core: `id`, `name`, `niche`, `language`, `visualStyle`, `narrativeTone`, `defaultTemplate`, `createdAt`, `updatedAt`
- Late-stage defaults: `defaultRenderMode`, `defaultRenderQuality`, `defaultAudioMood`, `defaultCaptionStyle`, `defaultVisualPreset`, `defaultMusicAssetId`, `defaultVoiceoverAssetId`, `defaultDurationTarget`, `defaultSceneDuration`, `preferredAssetCategories`, `preferredAssetTags`

### Asset

- Core: `id`, `filename`, `originalName`, `path`, `type`, `category`, `franchise`, `character`, `emotion`, `tags`, `licenseType`, `copyrightRisk`, `recommendedUse`, `duration`, `width`, `height`, `createdAt`, `updatedAt`
- Late-stage source metadata: `mimeType`, `extension`, `fileSize`, `sourceProvider`, `sourceUrl`, `sourceAuthor`, `sourceLicense`, `sourceLicenseUrl`, `downloadedAt`, `collectionId`, `usageNotes`

### VideoProject

- Core: `id`, `title`, `status`, `channelId`, `script`, `durationTarget`, `format`, `createdAt`, `updatedAt`
- Late-stage fields: `templateId`, `defaultCaptionStyle`, `backgroundMusicAssetId`, `voiceoverAssetId`, `audioMood`, `musicVolume`, `voiceVolume`, `sfxVolume`, `enableAudioDucking`, `duckingLevel`, `defaultRenderMode`, `defaultRenderQuality`

### Scene

- Core: `id`, `videoProjectId`, `order`, `title`, `narrationText`, `captionText`, `duration`, `emotion`, `assetId`, `visualPreset`, `transition`, `createdAt`, `updatedAt`
- Caption layer: `captionStyle`, `captionPosition`, `captionEmphasisWords`
- Audio layer: `sfxAssetId`, `sfxStartTime`, `sfxVolume`
- Visual generation layer: `energyLevel`, `visualSourceMode`, `characterProfileId`, `generatedAssetId`, `visualPrompt`, `negativePrompt`, `visualRecipe`, `generationStatus`, `generationProvider`, `generationSeed`

### RenderJob

- Core: `id`, `videoProjectId`, `status`, `outputPath`, `blueprintPath`, `srtPath`, `assPath`, `logPath`, `errorMessage`, `progress`, `startedAt`, `completedAt`, `createdAt`, `updatedAt`
- Late-stage ops: `renderMode`, `renderQuality`, `currentStep`, `currentSceneIndex`, `totalScenes`, `outputWidth`, `outputHeight`, `outputDuration`, `outputCodec`, `outputFileSize`, `thumbnailPath`, `cancelledAt`, `retriedFromJobId`, `attempt`, `hasAudio`, `audioCodec`, `audioChannels`, `audioSampleRate`

### MediaCollection

- `id`, `name`, `channelId`, `projectId`, `dossierId`, `assetRequirementId`, `provider`, `query`, `sourcePath`, `mediaType`, `status`, `targetCount`, `importedCount`, `rejectedCount`, `notes`, `createdAt`, `updatedAt`

### MediaCandidate

- `id`, `collectionId`, `provider`, `originalPath`, `title`, `previewUrl`, `downloadUrl`, `sourceUrl`, `sourceAuthor`, `sourceLicense`, `sourceLicenseUrl`, `mediaType`, `detectedType`, `suggestedCategory`, `suggestedTags`, `suggestedCharacter`, `suggestedProject`, `width`, `height`, `duration`, `fileSize`, `extension`, `mimeType`, `category`, `franchise`, `character`, `emotion`, `tags`, `copyrightRisk`, `recommendedUse`, `usageNotes`, `status`, `assetId`, `errorMessage`, `contentHash`, `createdAt`, `updatedAt`

### ResearchDossier

- `id`, `channelId`, `title`, `topic`, `niche`, `tone`, `targetDuration`, `status`, `summary`, `narrativeAngle`, `editorialNotes`, `safetyNotes`, `createdAt`, `updatedAt`
- Derived counts expected by repository output: `sourceCount`, `approvedSourceCount`, `factCount`, `timelineCount`, `outlineSceneCount`

### ResearchSource

- `id`, `dossierId`, `title`, `url`, `provider`, `sourceType`, `author`, `publishedAt`, `accessedAt`, `reliabilityScore`, `citationText`, `rawTextPath`, `excerpt`, `notes`, `status`, `errorMessage`, `createdAt`, `updatedAt`

### ResearchFact

- `id`, `dossierId`, `sourceId`, `claim`, `factType`, `confidence`, `dateValue`, `people`, `places`, `tags`, `notes`, `createdAt`, `updatedAt`

### ResearchTimelineEvent

- `id`, `dossierId`, `sourceId`, `title`, `description`, `dateValue`, `order`, `location`, `people`, `confidence`, `createdAt`, `updatedAt`

### ResearchHook

- `id`, `dossierId`, `text`, `hookType`, `strengthScore`, `notes`, `createdAt`, `updatedAt`

### ResearchAssetRequirement

- Core: `id`, `dossierId`, `sceneRole`, `description`, `mediaType`, `suggestedTags`, `emotion`, `priority`, `fulfilledAssetId`, `createdAt`, `updatedAt`
- Late-stage visual fields: `visualSourceMode`, `characterProfileId`, `generatedAssetId`, `visualPrompt`, `generationStatus`, `generationProvider`

### ResearchOutlineScene

- `id`, `dossierId`, `order`, `role`, `title`, `narrationDraft`, `captionDraft`, `emotion`, `visualPreset`, `assetRequirementId`, `estimatedDuration`, `createdAt`, `updatedAt`

### CharacterProfile

- `id`, `name`, `slug`, `franchise`, `category`, `description`, `basePrompt`, `negativePrompt`, `styleNotes`, `defaultVisualStyle`, `referenceStrength`, `preferredProvider`, `tags`, `createdAt`, `updatedAt`

### CharacterReference

- `id`, `characterProfileId`, `assetId`, `sourcePath`, `title`, `notes`, `referenceType`, `strength`, `createdAt`, `updatedAt`

### VisualGenerationJob

- `id`, `videoProjectId`, `sceneId`, `characterProfileId`, `researchAssetRequirementId`, `status`, `provider`, `visualSourceMode`, `prompt`, `negativePrompt`, `stylePreset`, `seed`, `width`, `height`, `outputPath`, `generatedAssetId`, `errorMessage`, `metadata`, `startedAt`, `completedAt`, `createdAt`, `updatedAt`

## Enums and String Unions Required

### Assets

- `AssetType`: `IMAGE | VIDEO | AUDIO | MUSIC | SFX | OVERLAY | DOCUMENT | FONT`
- `AssetCategory`: `CHARACTER | BACKGROUND | PANEL | SCREENSHOT | COVER | BROLL | REFERENCE | TRACK | EFFECT | OVERLAY | TYPOGRAPHY | OTHER`
- `CopyrightRisk`: `LOW | MEDIUM | HIGH | UNKNOWN`
- `EmotionTag`: `NEUTRAL | CURIOUS | EPIC | MYSTERIOUS | DARK | TENSE | JOYFUL | SAD`

### Projects and Rendering

- `ProjectStatus`: `DRAFT | SCRIPTING | SCENE_PLANNING | READY_FOR_EDIT`
- `RenderJobStatus`: `queued | processing | completed | failed | cancelled`
- `RenderJobStep`: `reading_blueprint | generating_subtitles | rendering_scene | concatenating_segments | burning_subtitles | generating_thumbnail | probing_output | completed`
- `RenderMode`: `v1 | cinematic_v2`
- `RenderQuality`: `draft | standard | high`

### Intake and Media Collector

- `MediaCollectionStatus`: `draft | scanning | ready_for_review | importing | completed | failed`
- `MediaCandidateStatus`: `pending | approved | rejected | imported | failed`
- `IntakeMediaType`: `image | video | audio | music | sfx | overlay | document | reference`
- `MediaCollectorProviderId`: `manual-url | wikimedia-commons | nasa-media | internet-archive | pexels | pixabay | unsplash`

### Research

- `ResearchDossierStatus`: `draft | researching | ready_for_review | completed | failed`
- `ResearchSourceType`: `web_page | wikipedia | wikidata | archive | document | manual_note | book | article | official_record | other`
- `ResearchSourceStatus`: `candidate | approved | rejected | imported | failed`
- `ResearchFactType`: `date | person | place | event | quote | context | statistic | allegation | uncertainty | other`
- `ResearchConfidence`: `confirmed | likely | disputed | uncertain`
- `ResearchHookType`: `mystery | shock | question | contrast | timeline | character | revelation | warning | other`
- `ResearchAssetMediaType`: `image | video | audio | music | sfx | overlay | document | map | text_card`
- `ResearchOutlineRole`: `hook | context | tension | climax | resolution | cta`

### Hybrid Visual and Characters

- `VisualSourceMode`: `asset_only | generated_only | hybrid_overlay | fallback_generated | mixed_sequence`
- `VisualGenerationProvider`: `mock-svg | manual | comfyui-local | stable-diffusion-local | other`
- `VisualGenerationStatus`: `draft | queued | generating | completed | failed | cancelled`
- `CharacterReferenceType`: `face | full_body | pose | outfit | style | expression | other`

## Prisma Relations Required

- `Channel 1:N VideoProject`
- `Channel 1:N MediaCollection`
- `Channel 1:N ResearchDossier`
- `VideoProject 1:N Scene`
- `VideoProject 1:N RenderJob`
- `VideoProject 1:N MediaCollection`
- `Scene N:1 Asset` via `assetId`
- `Scene N:1 Asset` via `generatedAssetId`
- `Scene N:1 Asset` via `sfxAssetId`
- `Scene N:1 CharacterProfile` via `characterProfileId`
- `RenderJob N:1 VideoProject`
- `RenderJob self relation` via `retriedFromJobId`
- `MediaCollection 1:N MediaCandidate`
- `MediaCollection 1:N Asset`
- `MediaCollection N:1 Channel`
- `MediaCollection N:1 VideoProject`
- `MediaCollection N:1 ResearchDossier`
- `MediaCollection N:1 ResearchAssetRequirement`
- `MediaCandidate N:1 MediaCollection`
- `MediaCandidate N:1 Asset` via `assetId`
- `ResearchDossier 1:N ResearchSource`
- `ResearchDossier 1:N ResearchFact`
- `ResearchDossier 1:N ResearchTimelineEvent`
- `ResearchDossier 1:N ResearchHook`
- `ResearchDossier 1:N ResearchAssetRequirement`
- `ResearchDossier 1:N ResearchOutlineScene`
- `ResearchAssetRequirement N:1 Asset` via `fulfilledAssetId`
- `ResearchAssetRequirement N:1 Asset` via `generatedAssetId`
- `ResearchAssetRequirement N:1 CharacterProfile` via `characterProfileId`
- `ResearchAssetRequirement 1:N MediaCollection`
- `ResearchOutlineScene N:1 ResearchAssetRequirement`
- `CharacterProfile 1:N CharacterReference`
- `CharacterReference N:1 Asset` via `assetId`
- `VisualGenerationJob N:1 VideoProject`
- `VisualGenerationJob N:1 Scene`
- `VisualGenerationJob N:1 CharacterProfile`
- `VisualGenerationJob N:1 ResearchAssetRequirement`
- `VisualGenerationJob N:1 Asset` via `generatedAssetId`

## Expected API Route Families

### Channels

- `GET /channels`
- `GET /channels/:id`
- `POST /channels`
- `PUT /channels/:id`
- `DELETE /channels/:id`

### Assets

- `GET /assets`
- `GET /assets/:id`
- `POST /assets`
- `PUT /assets/:id`
- `DELETE /assets/:id`
- `POST /assets/upload`
- `GET /media/assets/:assetId`

### Projects

- `GET /video-projects`
- `GET /video-projects/:id`
- `POST /video-projects`
- `PUT /video-projects/:id`
- `DELETE /video-projects/:id`
- `GET /video-projects/:id/scenes`
- `POST /video-projects/:id/scenes`
- `PUT /video-projects/:id/scenes/:sceneId`
- `DELETE /video-projects/:id/scenes/:sceneId`
- `POST /video-projects/:id/scenes/reorder`
- `GET /video-projects/:id/story-analysis`
- `GET /video-projects/:id/caption-analysis`
- `GET /video-projects/:id/audio-plan`
- `GET /video-projects/:id/render-blueprint`
- `GET /video-projects/:id/production-checklist`
- `GET /video-projects/:id/asset-suggestions`
- `POST /video-projects/:id/apply-channel-defaults`
- `POST /video-projects/:id/missing-asset-collections`

### Production

- `POST /production/create-from-script`

### Render Jobs

- `GET /render-jobs`
- `GET /video-projects/:id/render-jobs`
- `POST /video-projects/:id/render-jobs`
- `POST /render-jobs/:id/cancel`
- `POST /render-jobs/:id/retry`
- `DELETE /render-jobs/:id`
- `GET /media/renders/:renderJobId`
- `GET /media/renders/:renderJobId/log`
- `GET /media/renders/:renderJobId/thumbnail`

### Intake

- `GET /intake/folders`
- `POST /intake/scan`
- `GET /intake/collections`
- `GET /intake/collections/:id`
- `GET /intake/candidates`
- `PUT /intake/candidates/:id`
- `POST /intake/candidates/:id/approve`
- `POST /intake/candidates/:id/reject`
- `POST /intake/import-approved`
- `GET /media/candidates/:candidateId`

### Media Collector

- `GET /media-collector/providers`
- `GET /media-collections`
- `GET /media-collections/:id`
- `GET /media-collections/:id/candidates`
- `POST /media-collections`
- `POST /media-collections/:id/search`
- `POST /media-collections/:id/import-approved`
- `POST /media-collections/manual-url`
- `PUT /media-candidates/:id`
- `POST /media-candidates/:id/approve`
- `POST /media-candidates/:id/reject`
- `POST /research/:dossierId/media-collections/from-dossier`
- `POST /research/asset-requirements/:id/media-collection`

### Research

- `GET /research`
- `GET /research/:id`
- `POST /research`
- `PUT /research/:id`
- `DELETE /research/:id`
- `POST /research/:id/queries`
- `POST /research/:id/manual-source`
- `POST /research/:id/fetch-url`
- `POST /research/:id/search/wikipedia`
- `POST /research/:id/search/wikidata`
- `POST /research/sources/:id/approve`
- `POST /research/sources/:id/reject`
- `POST /research/:id/analyze`
- `POST /research/:id/create-production`

### Characters

- `GET /characters`
- `GET /characters/:id`
- `POST /characters`
- `PUT /characters/:id`
- `DELETE /characters/:id`
- `POST /characters/:id/build-base-prompt`
- `GET /characters/:id/references`
- `POST /characters/:id/references`
- `PUT /characters/:id/references/:referenceId`
- `DELETE /characters/:id/references/:referenceId`
- `POST /characters/from-intake/:slug`

### Hybrid Visual and Prompt Engine

- `GET /visual-generation/modes`
- `GET /visual-generation/providers`
- `GET /visual-generation/providers/comfyui-local/status`
- `POST /visual-generation/providers/comfyui-local/test`
- `POST /visual-generation/providers/comfyui-local/validate-workflow`
- `GET /visual-generation/jobs`
- `GET /visual-generation/jobs/:id`
- `POST /visual-generation/jobs/:id/cancel`
- `GET /video-projects/:id/missing-visual-report`
- `POST /video-projects/:id/generate-missing-visuals`
- `POST /scenes/:sceneId/generate-visual`
- `POST /research/asset-requirements/:id/generate-visual`
- `GET /prompt-engine/packs`
- `GET /prompt-engine/packs/:id`
- `GET /prompt-engine/negative-packs`
- `GET /prompt-engine/negative-packs/:id`
- `POST /prompt-engine/preview`
- `POST /prompt-engine/scene-build`
- `POST /prompt-engine/research-requirement-build`

## Expected Web Types

- Shared primitives: `DataSource`, asset enums, project enums, render enums, research enums, `VisualSourceMode`, `VisualGenerationProvider`, `VisualGenerationStatus`, `CharacterReferenceType`
- Entities: `Channel`, `Asset`, `VideoProject`, `Scene`, `RenderJob`, `MediaCollection`, `MediaCandidate`, `ResearchDossier`, `ResearchSource`, `ResearchFact`, `ResearchTimelineEvent`, `ResearchHook`, `ResearchAssetRequirement`, `ResearchOutlineScene`, `CharacterProfile`, `CharacterReference`, `VisualGenerationJob`
- Analysis/engine payloads: `StoryAnalysis`, `ProjectStoryAnalysisResponse`, `CaptionQualityAnalysis`, `ProjectCaptionAnalysisResponse`, `AudioPlan`, `RenderBlueprint`, `ProductionChecklist`, `AssetSuggestion`
- Prompt engine types: `VisualPromptPack`, `NegativePromptPack`, `PromptBuildResult`, `PromptQualityAnalysis`, prompt scene/research build responses
- Snapshot aggregations: dashboard snapshots, project detail snapshots, render job snapshots, research/intake/media collector snapshots

## High-Risk Mismatches Observed

- `prisma/schema.prisma` is missing `CharacterProfile`, `CharacterReference`, `VisualGenerationJob`, plus late-stage scene and research requirement fields.
- `apps/web/src/lib/studio-types.ts` live file is behind Stage 10 contracts; the extracted candidate is newer but has a truncation gap around `MediaCandidate`.
- `apps/web/src/lib/studio-api.ts` live file is behind Stage 10 contracts; the extracted candidate has the expected export surface but also contains a truncation gap.
- `apps/api/src/modules/hybrid-visual/application/hybrid-visual-service.ts` live file lacks prompt-pack and ComfyUI helper exports required by current routes.
- `apps/api/src/config/env.ts` is behind current route/service expectations and must expose ComfyUI-related settings.
- `apps/api/src/modules/projects/infrastructure/prisma-project-repository.ts` and `apps/api/src/modules/research/infrastructure/prisma-research-repository.ts` are still mapped to older schemas and will need follow-up updates after Prisma regeneration.
